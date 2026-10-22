// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import { carrierBerths } from './movement.ts';
import {
  AERIAL_TYPES,
  FLYING_TYPES,
  SEA_TYPES,
  getFlyCapability,
  isAirCarriable,
} from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { unitBaseStrength } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import { describeArmy } from '../dice-and-army-names.ts';
import { BOT_LIGHT_ARMIES } from '../bots/war.ts';
import { getNeighborsP } from '../world/map-helpers.ts';
import { perkTier } from '../titles/perks.ts';
import { newMercId } from '../turn/mercenary-ids-and-battle-records.ts';
import { isFriendlyProvFor, setProvinceOwner } from '../realms/relations-and-captures.ts';
import { canEnterTerrain, refreshMovePool } from './movement-pools.ts';
import { emit, narrate } from '../turn/events-and-their-audiences.ts';

// ── SEA LIFT, STRANDING AND RETREATS (plan P1-08b: lifted out of resolveTurn) ────
// Whether a column can put to sea (getSeaCapability, seaLiftShortfall), who is put ashore when the hulls can no longer
// carry it (stranding), where a beaten force may fall back and which ground it prefers, and a fleet's retreat to water
// with the hulls left ashore (naval holds). settleStrandedAtSea, retreatValue, bestRetreat, retreatOptions,
// _navalLeaveBehind, navalHoldLine and navalSplitRetreat take the turn's context first (src/engine/turn/context.ts);
// the rest read no turn state.
// Get movement allowance for a character AT THE START OF THE TURN (before any armies picked up)
// stored per character for the whole turn
export function getSeaCapability(armies, leadChar) {
  // spectral doubles are illusions — they weigh nothing, need no berth and no griffon, and are
  // never counted against a force's lift. (They normally live outside ch.armies entirely; this
  // guards the case where a fighting copy is still attached mid-phase.)
  armies = (armies || []).filter((a) => a && !a._phantom);
  if (armies.length === 0) return 'all';
  const landArmies = armies.filter((a) => !AERIAL_TYPES.has(a.type) && !SEA_TYPES.has(a.type));
  // Only CARRIERS provide capacity. Primal sea beasts swim themselves across but carry nothing,
  // so they contribute 0 — a force of one Kraken plus one Goblin Horde still cannot put to sea.
  const seaCount = armies.reduce((s, a) => s + carrierBerths(a), 0); // berths, not hulls: a turtle offers two (Island Back)
  const flyCount = armies.filter((a) => AERIAL_TYPES.has(a.type)).length;
  if (landArmies.length === 0) return 'all'; // only flying/sea
  // if the humanoid flyers can lift every foot soldier, the whole column takes to the air and
  // crosses sea without a fleet — just like an all-flying host.
  if (getFlyCapability(armies)) return 'sea';
  // Fleet capacity: light foot = 0.5 capacity (2 per hull), heavy/cavalry/siege/beast = 1 per
  // hull
  const LIGHT_ARMIES = new Set(KC_UNIT_CLASS.lightFoot); // gun-crews ride as light foot — an Ironclad ferries a Gun + a Guard
  // HULLS AND FLYERS POOL THEIR LIFT. Now:
  // • units a flyer cannot lift (cavalry, siege, walking creatures/monsters) MUST go aboard ship;
  // • everything a flyer CAN lift rides a hull if there is room, else is carried by one humanoid
  // flyer apiece (primal winged beasts still carry nothing);
  // • the shortfall is what the flyers must cover, so hulls + flyers together decide the question.
  const _capOf = (a) => (LIGHT_ARMIES.has(a.type) ? 0.5 : 1); // light foot take half a hull, everything else a full one
  let hullCap = seaCount;
  if (leadChar && perkTier(leadChar, 'naval') >= 3) hullCap *= 2; // NAVAL L8: one naval hull carries what once needed two
  const _mustSail = landArmies.filter((a) => !isAirCarriable(a)); // horses, siege, beasts — ship or nothing
  const _liftable = landArmies.filter((a) => isAirCarriable(a)); // humanoid foot — ship OR air
  let _room = hullCap - _mustSail.reduce((s, a) => s + _capOf(a), 0);
  if (_room < 0) return 'land'; // no berth for the unliftable — stay ashore
  // Fill the remaining berths with the LIGHTEST liftable units first: that puts the most bodies
  // aboard and so leaves the fewest for the flyers (a flyer lifts one unit whatever its weight).
  let _byAir = 0;
  _liftable
    .slice()
    .sort((a, b) => _capOf(a) - _capOf(b))
    .forEach((a) => {
      const _c = _capOf(a);
      if (_room >= _c) _room -= _c;
      else _byAir++;
    });
  const flyerLift = armies.filter((a) => FLYING_TYPES.has(a.type)).length; // humanoid flyers: one unit each
  if (_byAir <= flyerLift) return 'sea';
  return 'land';
}

// ── STRANDED AT SEA (2026-09-23c, Toby) ──────────────────────────────────────────────────────
// A column standing on open water must stay CARRIED: its hulls (and humanoid flyers) must lift
// every land unit it leads — the rule getSeaCapability applies to putting to sea. When hulls are
// lost (sunk in battle, Breach and Swamp, demoted away, given away) the land units that can no
// longer be carried are put ashore — WEAKEST FIRST, and only units the lost lift was actually
// needed for (a light levy is not landed when the shortfall is a berth for cavalry). They join the
// garrison of an adjacent LAND province of the realm's own: the one the column sailed from if it
// qualifies, else the one with the smallest garrison. With none they hold the sea province itself as
// its garrison (claiming it if unowned and undefended); in another realm's waters they are lost.
// Skipped: flooded land (a Flood strands a land host by design) and any province whose battle is
// still unresolved — a beaten column pinned at sea stays aboard and fights on (see retreatOptions).
// Hulls are never shared between characters: each commander's ships carry his own troops only.
export function isOpenSea(prov) {
  return !!prov && prov.terrain === 'sea' && !prov._flood;
}
// 0 exactly when getSeaCapability(armies) !== 'land'; otherwise a positive measure of the lift
// missing — berths short for units only a hull can take (in half-hulls, ×1000), then foot left
// over beyond what the flyers can lift. Mirrors getSeaCapability's pooled hull + flyer rule.
export function seaLiftShortfall(armies, leadChar) {
  armies = (armies || []).filter((a) => a && !a._phantom);
  if (getSeaCapability(armies, leadChar) !== 'land') return 0;
  const capOf = (a) => (BOT_LIGHT_ARMIES.has(a.type) ? 1 : 2); // half-hulls: light foot 1, everything else 2
  const land = armies.filter((a) => !AERIAL_TYPES.has(a.type) && !SEA_TYPES.has(a.type));
  let hull2 = armies.reduce((s, a) => s + carrierBerths(a), 0) * 2; // half-berths: a turtle offers two berths (Island Back)
  if (leadChar && perkTier(leadChar, 'naval') >= 3) hull2 *= 2;
  const must = land.filter((a) => !isAirCarriable(a)),
    lift = land.filter((a) => isAirCarriable(a));
  const mustNeed = must.reduce((s, a) => s + capOf(a), 0);
  let room = Math.max(0, hull2 - mustNeed),
    byAir = 0;
  lift
    .slice()
    .sort((a, b) => capOf(a) - capOf(b))
    .forEach((a) => {
      const c2 = capOf(a);
      if (room >= c2) room -= c2;
      else byAir++;
    });
  const flyLift = armies.filter((a) => FLYING_TYPES.has(a.type)).length;
  return Math.max(1, Math.max(0, mustNeed - hull2) * 1000 + Math.max(0, byAir - flyLift));
}
// The land units to put ashore so the rest can be carried: repeatedly the WEAKEST land unit whose
// removal actually reduces the shortfall (fallback: the weakest outright). Never flyers or hulls.
export function pickStrandedUnits(armies, leadChar) {
  const kept = (armies || []).filter((a) => a && !a._phantom),
    out = [];
  let sf = seaLiftShortfall(kept, leadChar),
    guard = 0;
  while (sf > 0 && guard++ < 500) {
    const cands = kept
      .filter((a) => !AERIAL_TYPES.has(a.type) && !SEA_TYPES.has(a.type))
      .sort((x, y) => unitBaseStrength(x) - unitBaseStrength(y) || (x._temporary ? 1 : 0) - (y._temporary ? 1 : 0));
    if (!cands.length) break;
    let pick = null,
      nsf = sf;
    for (const a of cands) {
      const s2 = seaLiftShortfall(
        kept.filter((x) => x !== a),
        leadChar,
      );
      if (s2 < sf) {
        pick = a;
        nsf = s2;
        break;
      }
    }
    if (!pick) {
      pick = cands[0];
      nsf = seaLiftShortfall(
        kept.filter((x) => x !== pick),
        leadChar,
      );
    }
    kept.splice(kept.indexOf(pick), 1);
    out.push(pick);
    sf = nsf;
  }
  // Take back aboard, strongest first, anything that still fits once the rest are ashore — a unit
  // landed early to ease the shortfall may have room again after a heavier unit went.
  out
    .slice()
    .sort((x, y) => unitBaseStrength(y) - unitBaseStrength(x))
    .forEach((a) => {
      if (seaLiftShortfall(kept.concat([a]), leadChar) === 0) {
        kept.push(a);
        out.splice(out.indexOf(a), 1);
      }
    });
  return out;
}
export function strandLabel(a) {
  return a.unitName ? `${a.unitName} (${a.quality} ${a.type})` : `a ${a.quality} ${a.type}`;
}
// Called after every order, at the top and end of every phase, and after wages (see the phase loop).
export function settleStrandedAtSea(turnContext, ph, cause) {
  const { G } = turnContext;
  (G.characters || []).forEach((c) => {
    if (!c || c.alive === false || c.player == null || !(c.armies || []).length) return;
    const prov = G.world.provinces[c.location];
    if (!isOpenSea(prov) || prov._battleUnresolved) return;
    if (seaLiftShortfall(c.armies, c) === 0) return;
    const out = pickStrandedUnits(c.armies, c);
    if (!out.length) return;
    c.armies = (c.armies || []).filter((a) => !out.includes(a));
    const owner = c._charmTempControl && c._charmOriginalPlayer != null ? c._charmOriginalPlayer : c.player; // a seized hero's troops stay his own lord's
    const why = cause || 'too few hulls left afloat to carry the whole column';
    const place = {
      audience: { actor: owner, realms: [owner] },
      hero: c.id,
      phase: ph != null ? ph : turnContext._currentPhase,
      province: prov.id,
    };
    const temps = out.filter((a) => a._temporary),
      units = out.filter((a) => !a._temporary);
    if (temps.length)
      emit(turnContext, {
        type: 'move',
        text: `✨ ${c.name}'s ${temps.map(strandLabel).join(', ')} cannot be carried over open water — the binding fails and ${temps.length === 1 ? 'it dissolves' : 'they dissolve'}.`,
        ...place,
      });
    if (units.length) {
      const lbl = units.map(strandLabel).join(', '),
        are = units.length === 1 ? 'is' : 'are',
        join = units.length === 1 ? 'joins' : 'join';
      const shore = getNeighborsP(prov, G.world.cols, G.world.rows, G.world.provinces).filter(
        (p2) => p2 && p2.owner === owner && p2.terrain !== 'sea',
      );
      const from = G.world.provinces[c._attackedFrom];
      const dest =
        from && shore.some((p2) => p2.id === from.id)
          ? from
          : shore
              .slice()
              .sort(
                (x, y) =>
                  (x.garrisonArmies || []).length - (y.garrisonArmies || []).length ||
                  (y.tax || 0) - (x.tax || 0) ||
                  x.id - y.id,
              )[0];
      if (dest) {
        dest.garrisonArmies = (dest.garrisonArmies || []).concat(units);
        emit(turnContext, {
          type: 'move',
          text: `⚓ ${c.name} has ${why}: ${lbl} ${are} put ashore at ${dest.name} and ${join} its garrison (the weakest go first).`,
          ...place,
        });
      } else if (prov.owner === owner) {
        prov.garrisonArmies = (prov.garrisonArmies || []).concat(units);
        emit(turnContext, {
          type: 'move',
          text: `⚓ ${c.name} has ${why}, and no shore of the realm lies alongside: ${lbl} ${are} left holding ${prov.name} as its garrison (the weakest go first).`,
          ...place,
        });
      } else if (prov.owner == null && !(prov.neutralDefenders || []).length) {
        setProvinceOwner(turnContext, prov, owner, c, place.phase);
        const _pl = G.players[owner];
        if (_pl) {
          _pl.provinces = _pl.provinces || [];
          if (!_pl.provinces.includes(prov.id)) _pl.provinces.push(prov.id);
        }
        prov.garrisonArmies = (prov.garrisonArmies || []).concat(units);
        emit(turnContext, {
          type: 'move',
          text: `⚓ ${c.name} has ${why}, and no shore of the realm lies alongside: ${lbl} ${are} left holding ${prov.name}, which they claim for ${_pl ? _pl.name : 'the realm'} as its garrison (the weakest go first).`,
          ...place,
        });
      } else {
        const _whose =
          prov.owner != null
            ? `${(G.players[prov.owner] || {}).name || 'another realm'}'s waters`
            : 'waters its neutral defenders still hold';
        emit(turnContext, {
          type: 'move',
          text: `⚓ ${c.name} has ${why}, no shore of the realm lies alongside and ${prov.name} is ${_whose}: ${lbl} ${are} lost at sea.`,
          ...place,
        });
      }
    }
    refreshMovePool(turnContext, c); // shedding units can change the column's pace; points already spent are kept
  });
}
// Where a beaten force may LEGALLY fall back (2026-09-23c). Adjacent only: own or allied ground it
// could enter as a move — so a column at sea whose surviving hulls can no longer carry it may still
// come ashore on friendly land beside it, but cannot sail on into another sea province (Toby's
// ruling: with no friendly shore alongside it has nowhere to retreat and fights on). Also the SEA
// PROVINCE IT CAME FROM when that water is unowned and undefended — a beaten landing falls back to
// its ships (Toby's ruling) — provided the force can still be carried there. Sea provinces a realm
// owns were already friendly ground.
// ── RETREAT DESTINATION VALUE (2026-09-26, Toby item 1) ───────────────────────────────────
// A beaten force used to fall back on whatever came first out of retreatOptions — effectively map
// order, so a general could abandon a rich province for a worthless one standing right beside it.
// Where there is a CHOICE, the most valuable ground now wins. Value is the province's tax base
// first (the one number the game already uses for a province's worth), then own ground ahead of
// an ally's, then the hero's own capital, then a friendly garrison already standing there, and
// finally province id so the result is deterministic rather than map-order chance.
export function retreatValue(turnContext, ch, p) {
  const { G } = turnContext;
  if (!p) return -Infinity;
  const own = ch && ch.player != null && p.owner === ch.player ? 1 : 0;
  const pl = ch && ch.player != null ? (G.players || [])[ch.player] : null;
  const home = pl && pl.homeProvinceId === p.id ? 1 : 0;
  const garrison = (p.garrisonArmies || []).length > 0 ? 1 : 0;
  return (p.tax || 0) * 1000 + own * 400 + home * 200 + garrison * 100 + (1 - (p.id || 0) / 1e6);
}
// Best of a list of candidate retreat provinces (null when the list is empty).
export function bestRetreat(turnContext, ch, list) {
  let best = null,
    bv = -Infinity;
  (list || []).forEach((p) => {
    const v = retreatValue(turnContext, ch, p);
    if (v > bv) {
      bv = v;
      best = p;
    }
  });
  return best;
}
export function retreatOptions(turnContext, ch, prov, force) {
  const { G } = turnContext;
  if (!ch || !prov) return [];
  force = (force || []).filter((a) => a && !a._died && !a._disbanded);
  const sc = getSeaCapability(force, ch);
  const probe = { _partSeaThisPhase: ch._partSeaThisPhase, armies: force };
  const from = G.world.provinces[ch._attackedFrom];
  return preferDryGround(
    getNeighborsP(prov, G.world.cols, G.world.rows, G.world.provinces).filter((p2) => {
      if (!p2 || p2.id === prov.id || !canEnterTerrain(probe, p2.terrain, sc)) return false;
      if (isFriendlyProvFor(turnContext, p2, ch.player)) return true;
      return (
        !!from && p2.id === from.id && p2.terrain === 'sea' && p2.owner == null && !(p2.neutralDefenders || []).length
      );
    }),
  );
}
// 2026-10-09 (Toby item 10): a beaten force NEVER falls back into a FLOODED province. It may fall
// back onto a sea province PARTED into dry ground, but only when no province of ordinary land is open
// to it. (Open sea stays open to a fleet: that is not magic ground.)
export function preferDryGround(list) {
  const open = (list || []).filter((p) => p && !p._flood);
  const ordinary = open.filter((p) => p.terrain !== 'sea' && !p._partSea);
  return ordinary.length ? open.filter((p) => !p._partSea) : open;
}
// ── NAVAL RETREAT: THE FLEET MAKES FOR WATER (2026-09-27, Toby item 3) ─────────────────────
// A beaten force that has SHIPS on a coastal shore no longer falls back as one body.
//   • Friendly water alongside → the hulls sail there carrying the hero and as many land and
//     flying units as their lift allows. `pickStrandedUnits` decides exactly who fits (weakest
//     left ashore first) — the same rule the stranding sweep already uses, so the two can never
//     disagree about what a column can carry.
//   • Whatever will not fit falls back overland to an adjacent province of the realm's OWN if
//     there is one, joining its garrison (they have no commander any more). Otherwise they hold
//     the ground and fight again.
//   • NO friendly water, but friendly land → the hero and every land / flying unit march inland;
//     the SHIPS stay and fight on. Hulls cannot be dragged overland.
//   • Ships that must retreat with no water to retreat to stay and fight again.
// Returns '' when it did nothing (the caller then runs the ordinary retreat), 'left' when the
// whole force got away, or 'stay' when part of it is still contesting the province.
// JUDGEMENT CALL: a leaderless contingent can only join a garrison of its OWN realm. Units left
// on ground the realm does not hold — a landing thrown back off an enemy coast — have no
// garrison to join and no commander left, so they scatter as mercenaries: the same fate the
// engine already gives a fallen commander's host on hostile ground.
export function _navalLeaveBehind(turnContext, ch, prov, units, why, narrative, cName) {
  const { G } = turnContext;
  if (!units || !units.length) return false;
  const owner = ch._charmTempControl && ch._charmOriginalPlayer != null ? ch._charmOriginalPlayer : ch.player;
  const temps = units.filter((a) => a._temporary),
    real = units.filter((a) => !a._temporary);
  if (temps.length)
    narrate(
      narrative,
      `— ✨ ${cName}'s ${temps.map(strandLabel).join(', ')} ${temps.length === 1 ? 'is' : 'are'} left behind ${why}; the binding fails and ${temps.length === 1 ? 'it dissolves' : 'they dissolve'}.`,
    );
  if (!real.length) return false;
  if (prov.owner === owner) {
    // 2026-09-27 (Toby): TAG THE HULLS LEFT ASHORE. These units are now sitting in the province's
    // garrison array, but they are NOT the standing garrison — they are a beaten force's ships,
    // left contesting the ground. The post-battle garrison book-keeping (which replaces the array
    // wholesale, and marches the garrison inland with a routed defender) would otherwise delete
    // them or drag hulls overland, and the winner's capture check — which looks only for hostile
    // CHARACTERS — would claim the province out from under them. navalHeldIn() reads this tag;
    // the battle caller clears it once the outcome is settled, so it never reaches saved state.
    real.forEach((a) => {
      a._navalHold = owner;
      delete a._fromGarrison;
      delete a._fromLeaderless;
      delete a._garrisonOf;
    });
    // A ship that rallied out of this province's own garrison is ALREADY in the array (the rally
    // copies the list, it does not empty it), so concat would duplicate the object. Push only
    // what is not there.
    prov.garrisonArmies = prov.garrisonArmies || [];
    real.forEach((a) => {
      if (prov.garrisonArmies.indexOf(a) < 0) prov.garrisonArmies.push(a);
    });
    prov._battleUnresolved = true;
    narrate(
      narrative,
      `— ⚓ ${cName}'s ${real.map(strandLabel).join(', ')} ${real.length === 1 ? 'is' : 'are'} left in ${prov.name} ${why} — ${real.length === 1 ? 'it holds' : 'they hold'} the ground and will fight again.`,
    );
    return true;
  }
  if (!G.mercenaries) G.mercenaries = [];
  real.forEach((a) =>
    G.mercenaries.push({
      type: a.type,
      quality: a.quality,
      race: a.race || 'Unknown',
      unitName: a.unitName,
      location: prov.id,
      isSea: SEA_TYPES.has(a.type),
      id: newMercId(turnContext),
    }),
  );
  narrate(
    narrative,
    `— ⚓ ${cName}'s ${real.map(strandLabel).join(', ')} ${real.length === 1 ? 'is' : 'are'} left behind ${why} on ground the realm does not hold — leaderless, ${real.length === 1 ? 'it scatters' : 'they scatter'} into the mercenary bands.`,
  );
  return false;
}
// ── HULLS LEFT ASHORE, AFTER THE BATTLE (2026-09-27, Toby) ───────────────────────────────────
// Units _navalLeaveBehind stranded in a province, still flying their own realm's colours. They
// live in prov.garrisonArmies but must be kept out of every "the garrison retreats with the
// hero" sweep, and they count as forces still holding the ground when the winner tries to claim
// it. `against` is the would-be claimant: hulls of that same realm are not an obstacle to it.
export function navalHeldIn(prov, against) {
  const out = [];
  ((prov && prov.garrisonArmies) || []).forEach((a) => {
    if (!a || a._navalHold == null || a._died || a._disbanded) return;
    if (against != null && a._navalHold === against) return;
    if (out.indexOf(a) < 0) out.push(a);
  });
  return out;
}
// The tag is a within-phase marker only: once the battle's outcome is logged the hulls are
// ordinary garrison again (a stalled battle resumes against them through resolveUnitGainInProvince).
export function clearNavalHold(prov) {
  ((prov && prov.garrisonArmies) || []).forEach((a) => {
    if (a && a._navalHold != null) delete a._navalHold;
  });
}
export function navalHoldLine(turnContext, prov, units, claimant) {
  const { G } = turnContext;
  const who =
    units[0] && units[0]._navalHold != null && G.players[units[0]._navalHold]
      ? G.players[units[0]._navalHold].name
      : 'the enemy';
  return `⚓ ${who}'s ${describeArmy(units)} still ${units.length === 1 ? 'lies' : 'lie'} off ${prov.name} — the ground is not ${claimant}'s while ${units.length === 1 ? 'it is' : 'they are'} there, and the fight resumes next phase.`;
}
export function navalSplitRetreat(turnContext, ch, prov, live, narrative, cName, noSea) {
  const { G } = turnContext;
  if (!ch || !prov || prov.terrain === 'sea' || ch.alive === false || ch.killedThisTurn) return '';
  live = (live || []).filter((a) => a && !a._died && !a._disbanded && !a._phantom);
  const ships = live.filter((a) => SEA_TYPES.has(a.type));
  if (!ships.length) return ''; // no fleet — the ordinary retreat applies
  const adj = getNeighborsP(prov, G.world.cols, G.world.rows, G.world.provinces).filter(
    (p2) => p2 && p2.id !== prov.id,
  );
  const from = G.world.provinces[ch._attackedFrom];
  // Friendly water: ours or an ally's, plus the unowned, undefended sea a landing came from (the
  // 2026-09-23c ruling — a beaten landing falls back to its ships).
  const seaOk = noSea
    ? []
    : adj.filter(
        (p2) =>
          p2.terrain === 'sea' &&
          !p2._flood &&
          (isFriendlyProvFor(turnContext, p2, ch.player) ||
            (!!from && p2.id === from.id && p2.owner == null && !(p2.neutralDefenders || []).length)),
      );
  const landFriendly = preferDryGround(
    adj.filter((p2) => p2.terrain !== 'sea' && isFriendlyProvFor(turnContext, p2, ch.player)),
  ); // item 10: parted sea only when no ordinary land
  const landOwn = landFriendly.filter((p2) => p2.owner === ch.player);
  const move = (dest) => {
    prov.characters = (prov.characters || []).filter((id) => id !== ch.id);
    dest.characters = dest.characters || [];
    if (!dest.characters.includes(ch.id)) dest.characters.push(ch.id);
    ch.location = dest.id;
    ch.locationName = dest.name;
  };
  let stayed = false;
  if (seaOk.length) {
    const dest = bestRetreat(turnContext, ch, seaOk) || seaOk[0];
    const ashore = pickStrandedUnits(live, ch); // exactly who the hulls cannot lift
    const taken = live.filter((a) => !ashore.includes(a));
    ch.armies = (ch.armies || []).filter((a) => !ashore.includes(a)); // dead/disbanded stay for the caller's own sweep
    move(dest);
    narrate(
      narrative,
      `⛵ ${cName} puts to sea — the fleet stands off ${prov.name} and makes for ${dest.name}${taken.length ? ` with ${describeArmy(taken)}` : ' with the hulls alone'}.`,
    );
    if (ashore.length) {
      const shore = bestRetreat(turnContext, ch, landOwn);
      if (shore) {
        const temps = ashore.filter((a) => a._temporary),
          real = ashore.filter((a) => !a._temporary);
        if (temps.length)
          narrate(
            narrative,
            `— ✨ ${cName}'s ${temps.map(strandLabel).join(', ')} cannot be carried; the binding fails and ${temps.length === 1 ? 'it dissolves' : 'they dissolve'}.`,
          );
        if (real.length) {
          shore.garrisonArmies = (shore.garrisonArmies || []).concat(real);
          narrate(
            narrative,
            `— ⚓ ${cName}'s ${real.map(strandLabel).join(', ')} cannot be carried and fall back overland to ${shore.name}, joining its garrison.`,
          );
        }
      } else
        stayed =
          _navalLeaveBehind(
            turnContext,
            ch,
            prov,
            ashore,
            'with no room aboard and no friendly ground to fall back to',
            narrative,
            cName,
          ) || stayed;
    }
    refreshMovePool(turnContext, ch);
    return stayed ? 'stay' : 'left';
  }
  const goInland = live.filter((a) => !SEA_TYPES.has(a.type));
  if (landFriendly.length && goInland.length) {
    const dest = bestRetreat(turnContext, ch, landFriendly) || landFriendly[0];
    ch.armies = (ch.armies || []).filter((a) => !ships.includes(a));
    move(dest);
    narrate(
      narrative,
      `${cName} retreats overland to ${dest.name} with ${describeArmy(goInland)} — there is no friendly water to sail to, so the ships are left behind.`,
    );
    stayed = _navalLeaveBehind(
      turnContext,
      ch,
      prov,
      ships,
      'because no friendly water lies alongside for them to sail to',
      narrative,
      cName,
    );
    refreshMovePool(turnContext, ch);
    return stayed ? 'stay' : 'left';
  }
  if (!goInland.length) {
    // A fleet alone, with nowhere to sail: hulls cannot take to the road, so they stand and fight
    // on rather than being run down in a rout they could not have fled.
    prov._battleUnresolved = true;
    narrate(
      narrative,
      `⚓ ${cName}'s ships have no friendly water to fall back to and cannot take to the road — they hold ${prov.name} and will fight again.`,
    );
    return 'stay';
  }
  return ''; // nothing to fall back on at all — the ordinary rules decide
}
// The line that explains WHY a beaten force at sea cannot fall back (null when that is not why).
export function seaTrapLine(name, ch, prov, force) {
  if (!isOpenSea(prov)) return null;
  force = (force || []).filter((a) => a && !a._died && !a._disbanded);
  if (getSeaCapability(force, ch) !== 'land') return null;
  return `⚓ ${name} has too few hulls left afloat to sail the column off ${prov.name}, and no friendly shore lies alongside to land on — there is no falling back.`;
}
