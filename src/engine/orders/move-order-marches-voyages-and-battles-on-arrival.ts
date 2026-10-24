// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { carrierBerths } from '../units/movement.ts';
import {
  AERIAL_TYPES,
  FLYING_TYPES,
  PRIMAL_SEA_TYPES,
  SEA_TYPES,
  isAirCarriable,
} from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { senseGravesUnderfoot } from '../graves.ts';
import { discoverFeat, featDiscovered } from '../sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import { activeItems } from '../items/equipment.ts';
import { markOrcAttackWin } from '../units/drill-and-spoils.ts';
import { d100, describeArmy } from '../dice-and-army-names.ts';
import { getNeighborsP, neighborInDir } from '../world/map-helpers.ts';
import { TM, creditMapped, perkTier } from '../titles/perks.ts';
import { discSum } from '../discoveries.ts';
import { narrText } from '../turn/log-line-helpers.ts';
import { emit, narrateAt, notifyTarget } from '../turn/events-and-their-audiences.ts';
import { noteBattleLoss } from '../turn/mercenary-ids-and-battle-records.ts';
import { applyEvilConquest, areEnemies, relationBetween, setProvinceOwner } from '../realms/relations-and-captures.ts';
import { creditBattle } from '../titles/title-holders-and-battle-merit.ts';
import { effStat, isVeiled } from '../heroes/effective-skills-and-hidden-heroes.ts';
import {
  clearNavalHold,
  getSeaCapability,
  navalHeldIn,
  navalHoldLine,
} from '../units/sea-lift-stranding-and-retreats.ts';
import { canEnterTerrain, contingentUnifyChance, refreshMovePool, setMovePool } from '../units/movement-pools.ts';
import { commandHandoverLine, pickBattleCommander, relocateChar, syncLeaderCopy } from '../battle/best-commander.ts';
import {
  SKILLGAIN_COMMON,
  SKILLGAIN_STD,
  rollNavalVoyage,
  trySkillGain,
} from '../heroes/experience-skill-rises-and-earned-hp.ts';
import { emitBattle } from '../battle/battle-report-lines-and-force-markers.ts';
import { landingPartyFlags } from '../battle/raid-the-coast-and-landing-parties.ts';
import { combatVsNPC } from '../battle/battles-against-province-defenders.ts';
import { combatVsChar } from '../battle/battles-between-heroes.ts';
import { intendedDestination, normaliseAction } from '../turn/phase-intents-and-dependency-ordering.ts';
import { provDistance, stepTowardPreferSafe } from '../world/routes-and-distances.ts';
import { noteEntered } from '../world/province-bookkeeping-and-rallied-garrisons.ts';
import { erodeGuardSurvivors } from '../battle/hosts-gained-in-a-province.ts';

// ── THE MOVE ORDER (plan P1-08j1: the first order taken out of processOrder in resolveTurn) ────
// One hero's Move this phase, once processOrder has read the order (a Forced March is a Move here, with _fmSlip set)
// and checked he may act: where the order leads (a province's id, the portal's prov:<id>, a compass direction), the
// border of a neutral realm, the sea and the coast, the march itself and what he sees on the way in, then whatever
// holds the province: a neutral guard, an enemy hero, a garrison, nobody, or a friend. It takes the turn's context
// first (src/engine/turn/context.ts) and the values processOrder worked out before it. The body keeps
// processOrder's indent (plan P1-08's Decisions); a case-level break became a return.
export function resolveMoveOrder(turnContext, c, ph, _fmSlip, target, prov, player) {
  const { movePoints, seaMovePoints, G, seaCap, lightSeaMoves, lightLandMoves } = turnContext;
  // Safety net: if this owned hero never had a move pool computed (both pools undefined) —
  // e.g. a hero hired in a previous turn whose start-of-turn init was somehow missed —
  // compute it now so they aren't wrongly told they have no movement left. We only do this
  // when BOTH pools are undefined (never set), never when a pool is 0 from being spent.
  if (movePoints[c.id] === undefined && seaMovePoints[c.id] === undefined) {
    setMovePool(turnContext, c);
  }
  // Reconcile the pool with the character's CURRENT army composition before checking it, so
  // any mid-turn change (a recruit or mercenary hire to this hero, a transfer/gift, a
  // disband, a spell-raised unit) is reflected here even if the handler that made the change
  // did not itself refresh. refreshMovePool preserves moves already spent and discounts
  // light-travel moves, so this is idempotent — it never refunds or double-charges — and
  // closes the whole class of "movement points wrongly zeroed after gaining armies" bugs.
  if (typeof refreshMovePool === 'function') refreshMovePool(turnContext, c);
  const mp = movePoints[c.id] ?? 0;
  const smpAvail = seaMovePoints[c.id] ?? 0;
  if (mp <= 0 && smpAvail <= 0) {
    emit(turnContext, {
      type: 'move',
      text: `${c.name} has no movement points remaining this turn.`,
      audience: { actor: c.player, realms: [c.player] },
    });
    return;
  }
  // discovery ("…notices the Lost City!") lines are captured here and flushed at the END of
  // the move case, so the ACTION line ("moves to / claims / battle") is reported FIRST and
  // the consequence (what was noticed on arrival) follows it.
  const _discoveryLines = [];
  let toProv = null;
  if (target.startsWith('dir:')) {
    const dir = target.slice(4);
    toProv = neighborInDir(turnContext, prov, dir);
    if (!toProv) {
      emit(turnContext, {
        type: 'move',
        text: `${c.name} marches ${dir} to the edge of the world, but the impassable icy wastelands bar the way — no army can cross them to the far north or south.`,
        audience: { actor: c.player, realms: [c.player] },
      });
      return;
    }
  } else if (target.startsWith('prov:')) {
    // ABSOLUTE move target (player portal, v2026.09.10+): the order names the specific
    // province chosen at order time rather than a compass direction, so a character displaced
    // earlier in the turn (a retreat after a lost battle, a Terror-Walker rout) still heads
    // for the province the player actually wanted. If that province is adjacent, march
    // straight in. If the displacement put it out of reach, take ONE step along the shortest
    // passable route toward it (terrain-aware BFS — the same stepToward the wandering-hero
    // code uses); the step is then subject to every normal movement rule below (pools,
    // borders, sea/land capability) exactly like a direct move.
    const _wantId = parseInt(target.slice(5));
    const _want = isNaN(_wantId) ? null : G.world.provinces[_wantId];
    if (!_want) {
      emit(turnContext, {
        type: 'move',
        text: `${c.name}: invalid move target.`,
        audience: { actor: c.player, realms: [c.player] },
      });
      return;
    }
    if (_want.id === prov.id) {
      emit(turnContext, {
        type: 'move',
        text: `${c.name} is already in ${_want.name} — the move order is moot.`,
        audience: { actor: c.player, realms: [c.player] },
      });
      return;
    }
    const _adjacent = getNeighborsP(prov, G.world.cols, G.world.rows, G.world.provinces).some(
      (n) => n && n.id === _want.id,
    );
    if (_adjacent) {
      toProv = _want;
    } else {
      seaCap[c.id] = getSeaCapability(c.armies || [], c); // stepToward reads the cache — make it current
      const _step = stepTowardPreferSafe(turnContext, c, _want.id);
      if (!_step) {
        emit(turnContext, {
          type: 'move',
          text: `${c.name} intended to march to ${_want.name}, but from ${prov.name} no passable route leads there this phase — the column holds.`,
          audience: { actor: c.player, realms: [c.player] },
        });
        return;
      }
      toProv = _step;
      emit(turnContext, {
        type: 'move',
        text: `${c.name} intended to march to ${_want.name}, but after being displaced it no longer lies adjacent — the column turns toward it by way of ${toProv.name}.`,
        audience: { actor: c.player, realms: [c.player] },
        province: toProv.id,
      });
    }
  } else {
    const id = parseInt(target);
    if (!isNaN(id)) toProv = G.world.provinces[id];
  }
  if (!toProv) {
    emit(turnContext, {
      type: 'move',
      text: `${c.name}: invalid move target.`,
      audience: { actor: c.player, realms: [c.player] },
    });
    return;
  }
  // NAVAL L9 Raid the Coast — a fleet-led raider launching FROM the sea INTO a coastal land
  // province plunders that province's treasury if the assault captures it (checked at the end
  // of the case).
  const _raidPriorOwner = toProv.owner;
  const _raidActive =
    c._raidCoastTurn === G.turn &&
    (c.armies || []).some((a) => SEA_TYPES.has(a.type)) &&
    prov.terrain === 'sea' &&
    toProv.terrain !== 'sea';
  // ── DIPLOMACY BORDER (KC alliance system) ────
  // A character LEADING ARMIES may not cross into a province owned by a player we are merely
  // NEUTRAL with — the column is turned back at the frontier (no move, no movement spent).
  // Only an ALLIANCE (free passage) or a state of WAR (invasion) opens a foreign border to
  // armies. Unarmed characters pass freely either way (AK code of honour: no capture without
  // an army).
  if (
    toProv.owner != null &&
    toProv.owner !== c.player &&
    (c.armies || []).length > 0 &&
    relationBetween(turnContext, c.player, toProv.owner) === 'neutral'
  ) {
    emit(turnContext, {
      type: 'move',
      text: `${c.name}'s column is turned back at the border of ${toProv.name} — ${player.name} and ${G.players[toProv.owner]?.name || 'that realm'} are at peace. Neither may march an army across the other's frontier without a treaty of alliance or a declaration of war.`,
      audience: { actor: c.player, realms: [c.player] },
      province: toProv.id,
    });
    return;
  }
  // Recompute sea capability from the LIVE force here rather than trusting the turn-start
  // cache. The cache (seaCap[c.id]) is only refreshed at a handful of points, so a force that
  // gained or lost fleets earlier this turn could be judged on a stale composition — the
  // reported symptom was a force with enough hulls being told "need 3 hulls, but the force
  // has only 4 fleet units. Move blocked." (the block read a stale 'land' capability while
  // the message counted the live hulls). Recomputing here keeps the gate and the message in
  // agreement. Cache is refreshed too.
  const sc = getSeaCapability(c.armies || [], c);
  seaCap[c.id] = sc;

  // Determine which move pool to use
  const enteringSea = toProv.terrain === 'sea';
  const leavingSea = prov.terrain === 'sea';
  // Coastal landing: moving from sea province to adjacent land province costs from the sea
  // pool (not land pool) since the journey is naval
  const coastalLanding = leavingSea && !enteringSea;
  // 2026-10-08 (Toby item 6): WINNING a battle costs one more point, from the SAME pool the step
  // in was paid from — sea points for a fight at sea or a coastal landing. Every win path used
  // to take it from the land pool, so a fleet with no land points won sea battles for free.
  const _payWinPoint = () => {
    if (enteringSea || coastalLanding) seaMovePoints[c.id] = Math.max(0, (seaMovePoints[c.id] ?? 0) - 1);
    else movePoints[c.id] = Math.max(0, (movePoints[c.id] ?? 0) - 1);
  };

  // Coastal hop REMOVED: a force containing naval units may no longer sail directly from one
  // coastal land province to an adjacent coastal land province. A naval force sitting on land
  // can only move to an ADJACENT SEA province (land→sea). To reach another coast it must sail
  // through the sea. (Mixed land+naval stacks still march overland on their land armies.)
  const moveArmies = c.armies || [];
  // NAVAL L7 Blockade: an enemy-sealed sea province cannot be crossed this turn.
  if (
    toProv &&
    toProv._blockadeTurn === G.turn &&
    toProv._blockadeBy != null &&
    toProv._blockadeBy !== c.player &&
    areEnemies(turnContext, c.player, toProv._blockadeBy)
  ) {
    emit(turnContext, {
      type: 'move',
      text: `${c.name} finds the waters of ${toProv.name} sealed by an enemy blockade — the crossing is barred this turn.`,
      audience: { actor: c.player, realms: [c.player] },
      province: prov.id,
    });
    return;
  }

  if (false) {
    // (coastal-hop path retired)
  } else if (enteringSea) {
    // Check sea capability
    if (!canEnterTerrain(c, toProv.terrain, sc)) {
      // if the target is a LAND province that a Flood spell has turned to sea, that — not a
      // shortage of shipping — is why the column is turned back. Say so plainly so the player
      // understands the ground itself is underwater this turn.
      if (toProv._flood) {
        emit(turnContext, {
          type: 'move',
          text: `${c.name} is turned back at ${toProv.name}: the province has been FLOODED and acts as open sea this turn. Land armies cannot wade across — only fleets (or flying units) may pass until the waters recede at turn's end.`,
          audience: { actor: c.player, realms: [c.player] },
          province: prov.id,
        });
        return;
      }
      const armies = c.armies || [];
      const landArmies = armies.filter((a) => !AERIAL_TYPES.has(a.type) && !SEA_TYPES.has(a.type));
      const seaArmies = armies.filter((a) => SEA_TYPES.has(a.type));
      let seaBlockReason = '';
      if (armies.length > 0 && armies.every((a) => SEA_TYPES.has(a.type))) {
        seaBlockReason = `${c.name} leads only naval armies (${armies.map((a) => a.type).join(', ')}) and cannot move directly between land provinces without crossing sea.`;
      } else {
        // Restate the ACTUAL capacity rule: light foot take half a hull, everything else a
        // full one, and primal sea beasts (which swim but carry nothing) provide no capacity.
        const LIGHT_MSG = new Set(KC_UNIT_CLASS.lightFoot);
        const hulls = armies.reduce((s, a) => s + carrierBerths(a), 0); // berths (a turtle's Island Back offers two)
        const capNeed = landArmies.reduce((s, a) => s + (LIGHT_MSG.has(a.type) ? 0.5 : 1), 0);
        const swimmers = armies.filter((a) => PRIMAL_SEA_TYPES.has(a.type));
        // hulls and flyers pool their lift, so the block message must account for both —
        // otherwise a player with griffons is told only about his shipping.
        const _flyLift = armies.filter((a) => FLYING_TYPES.has(a.type)).length;
        const _stuck = landArmies.filter((a) => !isAirCarriable(a));
        seaBlockReason =
          `${c.name} cannot put to sea: ${landArmies.length} land arm${landArmies.length !== 1 ? 'ies' : 'y'} (${landArmies.map((a) => a.type).join(', ')}) need ${capNeed} hull${capNeed !== 1 ? 's' : ''} of shipping, but the force has only ${hulls} berth${hulls !== 1 ? 's' : ''} aboard its hulls` +
          (_flyLift > 0
            ? ` and ${_flyLift} flying unit${_flyLift !== 1 ? 's' : ''} to carry the leftovers (one foot soldier each)`
            : ` and no flyers to carry the leftovers`) +
          `.` +
          (_stuck.length > 0
            ? ` The ${_stuck.map((a) => a.type).join(', ')} cannot be lifted at all — cavalry, siege and beasts must go aboard ship.`
            : '') +
          (swimmers.length > 0
            ? ` The ${swimmers.map((a) => a.type).join(' and ')} swim under their own power but cannot carry troops.`
            : '') +
          ` (Light foot take half a hull each; cavalry, heavy foot, siege and beasts take a full hull; a humanoid flyer lifts one foot soldier.) Move blocked.`;
      }
      emit(turnContext, { type: 'move', text: seaBlockReason, audience: { actor: c.player, realms: [c.player] } });
      return;
    }
    // Use sea move pool
    const smp = seaMovePoints[c.id] ?? 0;
    if (smp <= 0) {
      // when the water is a FLOOD spell's doing, say so — "no sea points" alone reads as a
      // shipping problem when the real cause is that the ground is underwater this turn.
      if (toProv._flood)
        emit(turnContext, {
          type: 'move',
          text: `${c.name} cannot enter ${toProv.name}: the province has been FLOODED and lies under open sea this turn, and ${c.name} has no sea movement to cross water. Only fleets or flyers may enter until the waters recede at turn's end.`,
          audience: { actor: c.player, realms: [c.player] },
        });
      else if (prov._flood)
        emit(turnContext, {
          type: 'move',
          text: `${c.name} is stranded in ${prov.name}: a FLOOD has turned the province to open sea this turn, and ${c.name} has no sea movement to sail out of it. The column must wait for the waters to recede at turn's end.`,
          audience: { actor: c.player, realms: [c.player] },
        });
      else
        emit(turnContext, {
          type: 'move',
          text: `${c.name} has no sea movement points remaining this turn.`,
          audience: { actor: c.player, realms: [c.player] },
        });
      return;
    }
    if ((c.armies || []).length === 0) lightSeaMoves[c.id] = (lightSeaMoves[c.id] || 0) + 1; // free-passage sea leg — don't charge a later fleet for it
    seaMovePoints[c.id] = smp - 1;
    const navalLvl = effStat(turnContext, c, 'naval');
    emit(turnContext, {
      type: 'move',
      text: `${c.name} moves across sea to ${toProv.name}.`,
      audience: { actor: c.player, realms: [c.player] },
      province: toProv.id,
    });
  } else if (coastalLanding) {
    // Moving from sea province to land: coastal landing, costs 1 sea MP
    const smp = seaMovePoints[c.id] ?? 0;
    if (smp <= 0) {
      // a land column caught by a FLOOD is "at sea" without a ship — name the flood, not a
      // shortage of sea points, as the reason it cannot walk out.
      if (prov._flood)
        emit(turnContext, {
          type: 'move',
          text: `${c.name} is stranded in ${prov.name}: a FLOOD has turned the province to open sea this turn, and a land column cannot wade out to ${toProv.name}. The waters recede at turn's end — ${c.name} may move again next turn.`,
          audience: { actor: c.player, realms: [c.player] },
        });
      else
        emit(turnContext, {
          type: 'move',
          text: `${c.name} has no sea movement points remaining to make a coastal landing in ${toProv.name}.`,
          audience: { actor: c.player, realms: [c.player] },
        });
      return;
    }
    // Check the target province is actually adjacent (coastal landing must be to adjacent
    // land)
    if ((c.armies || []).length === 0) lightSeaMoves[c.id] = (lightSeaMoves[c.id] || 0) + 1; // free-passage landing — don't charge a later fleet for it
    seaMovePoints[c.id] = smp - 1;
    // 2026-09-23e (Toby): Raid the Coast strikes only a coast ATTACKED FROM THE SEA — record
    // which province this column came ashore in, and when. Kept for the whole turn so a
    // landing battle that carries on into later phases stays a raid.
    c._seaLandingAt = { turn: G.turn, prov: toProv.id };
    // ORC — Reaver Crews: troops put ashore from longships hit the beach at a run and fight
    // at +25% in any battle this phase. (There is no coastal-landing PENALTY in the engine to
    // remove, so the ability is a bonus for landing rather than a waiver — see DEV_LOG.)
    if ((c.armies || []).some((a) => a && a.type === 'Orcish Longships')) {
      c._amphibiousAssault = true;
      emit(turnContext, {
        type: 'move',
        text: `${c.name}'s longships drive onto the shingle at ${toProv.name} — the reavers are over the side before the keels stop moving.`,
        audience: { actor: c.player, realms: [c.player] },
        province: toProv.id,
      });
    } else {
      emit(turnContext, {
        type: 'move',
        text: `${c.name} makes a coastal landing in ${toProv.name}.`,
        audience: { actor: c.player, realms: [c.player] },
        province: toProv.id,
      });
    }
  } else {
    // Land-to-land move: check land pool. Fleets and primal sea-beasts cannot cross land. A
    // mixed land+naval stack therefore may NOT step from one land province to another while
    // it still carries naval units — the land-side counterpart of the retired coastal hop
    // (which stopped naval forces sailing coast-to-coast). The old land branch only blocked
    // ALL-sea forces, so a hero with a fleet AND land armies slipped through and effectively
    // walked the fleet coast-to-coast. To march, the troops must first be split off from the
    // fleet (Leave/Transfer Army); to move
    // the fleet, sail to an adjacent sea province (land→sea).
    const _navalAboard = (c.armies || []).filter((a) => a && SEA_TYPES.has(a.type));
    if (_navalAboard.length > 0) {
      emit(turnContext, {
        type: 'move',
        text: `${c.name} cannot march overland while leading naval units (${_navalAboard.map((a) => a.type).join(', ')}) — ships and sea-beasts cannot cross land. Leave them behind to march, or sail to an adjacent sea province.`,
        audience: { actor: c.player, realms: [c.player] },
      });
      return;
    }
    if (!canEnterTerrain(c, toProv.terrain, sc)) {
      const armies = c.armies || [];
      if (armies.length > 0 && armies.every((a) => SEA_TYPES.has(a.type))) {
        // Naval-only force sitting on land: its only legal move is to an adjacent SEA
        // province.
        emit(turnContext, {
          type: 'move',
          text: `${c.name} leads only naval armies (${armies.map((a) => a.type).join(', ')}) and cannot march overland — from a land province a fleet can only sail to an adjacent sea province.`,
          audience: { actor: c.player, realms: [c.player] },
        });
        return;
      }
      emit(turnContext, {
        type: 'move',
        text: `${c.name} cannot enter ${toProv.name} (${toProv.terrain}).`,
        audience: { actor: c.player, realms: [c.player] },
      });
      return;
    }
    if (mp <= 0) {
      emit(turnContext, {
        type: 'move',
        text: `${c.name} has no land movement points left this turn.`,
        audience: { actor: c.player, realms: [c.player] },
      });
      return;
    }
    if ((c.armies || []).length === 0) lightLandMoves[c.id] = (lightLandMoves[c.id] || 0) + 1; // free-passage land leg — don't charge a later army for it
    movePoints[c.id] = mp - 1;
  }
  prov.characters = (prov.characters || []).filter((id) => id !== c.id);
  c.location = toProv.id;
  c._attackedFrom = prov.id; // the ground they came from — where a later forced retreat this turn falls back to
  // Illusory Terrain: an enemy hero setting foot here dispels it — but not until the END of
  // this turn (the illusion holds for the rest of the turn they arrive, then lifts).
  if (toProv._illusoryTerrain && c.player !== toProv._illusoryTerrain.caster) {
    toProv._illusoryTerrain._enteredByEnemy = true;
  }
  // Skill gains from movement: March (land move leading an army) / Naval (sea move with a
  // fleet). 2026-10-14 (batch item 9): a passenger learns no Naval (rollNavalVoyage).
  if (toProv.terrain === 'sea') {
    rollNavalVoyage(turnContext, c, SKILLGAIN_STD);
  } else if ((c.armies || []).length > 0) {
    trySkillGain(turnContext, c, 'march', SKILLGAIN_COMMON);
  }
  if (!toProv.characters) toProv.characters = [];
  toProv.characters.push(c.id);
  // remember which province this character MARCHED INTO this phase, so a lone defender on
  // Defend can tell an incursion (a fresh mover) from a force that was already standing
  // nearby.
  c._enteredProvThisPhase = toProv.id;
  // Remember that this player set foot here THIS PHASE, before any battle is fought. If the
  // move ends in a repulse the character will be gone by the end of the phase, but they still
  // scouted the province and its surrounds and the map must reflect that.
  noteEntered(turnContext, c.player, toProv.id);
  // a necromancer reads the ground the moment they set foot on it — every province of the
  // march, not just the one they stop in. Feeds the report's Graveyards Known.
  senseGravesUnderfoot(G, c, toProv, (pv) =>
    emit(turnContext, {
      type: 'explore',
      text: `💀 ${c.name} crosses into ${pv.name} and the dead stir underfoot — battlefield graves lie in this province, though nothing tells how many or what they hold.`,
      audience: { actor: c.player, realms: [c.player] },
      province: pv.id,
    }),
  );
  if (!toProv.visitedBy) toProv.visitedBy = [];
  if (!toProv.visitedBy.includes(c.player)) toProv.visitedBy.push(c.player);
  let _moveExplNote = ''; // exploration change to append to the move-in line
  {
    // Moving into a province raises this player's exploration by 10% + 5% per Explorer skill
    // level of the moving character — applied on EVERY move in, not just the first.
    if (!toProv.exploredBy) toProv.exploredBy = {};
    const explLvlMove = effStat(turnContext, c, 'explorer');
    const explGainMove =
      10 +
      5 * explLvlMove +
      activeItems(c).reduce((sm, it) => sm + ((it && it.exploreMove) || 0), 0) +
      (perkTier(c, 'march') > 0 ? 2 * (c.armies || []).length : 0); // Traveller's Cloak +20% · MARCH L6 +2%/army led (Loremaster explore bonus removed \u2014 now an intel line)
    // (The old Elven "Pathfinder" forest/jungle exploration doubling is REPLACED this session by
    // the Elven escape ability — no exploration bonus now.)
    const prevExp = toProv.exploredBy[c.player] || 0;
    // 2026-09-21 (Toby): the FIRST time a character sets foot in a province their realm has not
    // fully mapped, they may learn Explorer (frequent-action rate). Remembered per character.
    if (prevExp < 100) {
      c._xpFirstEntry = c._xpFirstEntry || [];
      if (!c._xpFirstEntry.includes(toProv.id)) {
        c._xpFirstEntry.push(toProv.id);
        trySkillGain(turnContext, c, 'explorer', SKILLGAIN_COMMON);
      }
    }
    toProv.exploredBy[c.player] = Math.min(100, prevExp + explGainMove);
    toProv.explored = toProv.exploredBy[c.player];
    creditMapped(c, prevExp, toProv.exploredBy[c.player]); // TITLE MERIT: Cartographer
    // NAVAL L6 — charting the coast: entering a SEA province while leading naval units adds
    // +5% exploration to each LAND province adjacent to this sea province.
    if (toProv.terrain === 'sea' && perkTier(c, 'naval') > 0 && (c.armies || []).some((a) => SEA_TYPES.has(a.type))) {
      getNeighborsP(toProv, G.world.cols, G.world.rows, G.world.provinces).forEach((nb) => {
        if (nb && nb.terrain !== 'sea') {
          if (!nb.exploredBy) nb.exploredBy = {};
          const _npe = nb.exploredBy[c.player] || 0;
          nb.exploredBy[c.player] = Math.min(100, _npe + 5);
          nb.explored = nb.exploredBy[c.player];
          creditMapped(c, _npe, nb.exploredBy[c.player]);
        }
      });
    }
    // tell the player how far this move mapped the province, and its new total (or that it
    // was already fully explored).
    {
      const _eg = toProv.explored - prevExp,
        _en = toProv.explored;
      _moveExplNote =
        _en >= 100
          ? prevExp >= 100
            ? ` (${toProv.name} was already fully explored — 100% mapped.)`
            : ` Their passage completes the map of ${toProv.name} — now 100% explored (+${_eg}%).`
          : _eg > 0
            ? ` Exploration of ${toProv.name} rises +${_eg}% to ${_en}%.`
            : '';
    }
    // Check if any features are now discoverable
    const totalF = (toProv.features || []).length;
    if (totalF > 0) {
      const thresh = 100 / totalF;
      const _spotted = [];
      toProv.features.forEach((f, idx) => {
        if (
          !featDiscovered(f, c.player) &&
          !(f._hidden && f._hiddenBy !== c.player) &&
          toProv.explored >= thresh * (idx + 1)
        ) {
          discoverFeat(f, c.player);
          TM(c).featuresFound += 1; // TITLE MERIT: Loremaster
          _spotted.push(f);
        }
      });
      // EXPLORER L6 — Pathfinder: on entry, automatically spot ONE random not-yet-found lair
      // (was: all of them).
      if (perkTier(c, 'explorer') > 0) {
        const _hiddenPool = toProv.features.filter(
          (f) => !featDiscovered(f, c.player) && !(f._hidden && f._hiddenBy !== c.player),
        );
        if (_hiddenPool.length > 0) {
          const _pf = _hiddenPool[Math.floor(kcRng() * _hiddenPool.length)];
          discoverFeat(_pf, c.player);
          TM(c).featuresFound += 1;
          _spotted.push(_pf);
        }
      }
      // Hide Lairs: a rival's illusion conceals lairs here that this explorer has not already
      // found — they sense the interference but cannot discover what lies hidden.
      if (toProv.features.some((f) => f._hidden && f._hiddenBy !== c.player && !featDiscovered(f, c.player))) {
        _discoveryLines.push([
          `🌫 Something clouds ${c.name}'s search of ${toProv.name} — a veiling illusion conceals lairs hidden here, blocking any discovery.`,
          { audience: { actor: c.player, realms: [c.player] }, province: toProv.id },
        ]);
      }
      // Item: report a spotted-on-entry lair in the SAME style as an Explore discovery, and
      // note when a lair the character stumbles into has already been cleared (no guardian
      // remains).
      const _artM = (n) => {
        if (!n) return 'a creature';
        if (/s$/.test(n)) return n;
        return (/^[aeiou]/i.test(n) ? 'an ' : 'a ') + n;
      };
      // a ritual site has no guardian — never describe it as "guarded by a creature".
      const _featTail = (f) =>
        f.ritualSite
          ? `It is an ancient ritual site of the old gods — no guardian lairs here.`
          : f.cleared
            ? `Its guardian has already been slain — the lair lies cleared.`
            : `Legend says it is guarded by ${_artM(f.monster?.name)}.`;
      const _featFrag = (f) =>
        f.ritualSite
          ? `the ${f.name} (a ritual site)`
          : `the ${f.name}${f.cleared ? ' (already cleared)' : ` (guarded by ${_artM(f.monster?.name)})`}`;
      if (_spotted.length === 1) {
        const f = _spotted[0];
        _discoveryLines.push([
          `Moving into ${toProv.name}, ${c.name} discovers the ${f.name}! ${_featTail(f)}`,
          { audience: { actor: c.player, realms: [c.player] }, province: toProv.id },
        ]);
      } else if (_spotted.length > 1) {
        const frags = _spotted.map(_featFrag);
        const list = frags.slice(0, -1).join(', ') + ' and ' + frags[frags.length - 1];
        _discoveryLines.push([
          `Moving into ${toProv.name}, ${c.name} discovers ${list}.`,
          { audience: { actor: c.player, realms: [c.player] }, province: toProv.id },
        ]);
      }
    }
  }
  // Check for neutral guard hero defending this province
  const neutralGuard = G.characters.find(
    (ng) =>
      ng.alive && ng.player === null && ng._isNeutralGuard && ng.location === toProv.id && (ng.armies || []).length > 0,
  );

  if (neutralGuard && toProv.owner === null && (c.armies || []).length > 0) {
    c._attackedFrom = prov.id; // track for retreat
    // ── CONTINGENT UNIFY (AK 4.1.2) ── Check if other friendly characters also have a Move
    // order to this province this phase
    const phOrders = G.turnOrders || {};
    const friendlyReinforcements = [];
    G.characters.forEach((ally) => {
      if (!ally.alive || ally.id === c.id || ally.player !== c.player) return;
      if ((ally.armies || []).length === 0) return;
      const allyOrder = phOrders[ally.id]?.[ph];
      // Same normalisation trap as the casting limit: the player portal saves "Move" with a
      // "prov:<id>" target, the bots save "move" with a bare id. The raw comparison matched
      // only the bots, so allied contingents of a HUMAN realm never unified — and the Good
      // realm's Banner of Fellowship had nothing to modify.
      if (!allyOrder || normaliseAction(allyOrder) !== 'move') return;
      const allyDest = intendedDestination(turnContext, ally, allyOrder);
      if (!allyDest || allyDest.id !== toProv.id) return;
      // Roll contingent unify chance based on March skill and distance
      const marchLvl = effStat(turnContext, c, 'march');
      // AK [4.1.2]: the unify chance depends on how far apart the two contingents started — 0
      // = both set out from the same province, 1 = adjacent, 2+ = converging from opposite
      // directions.
      const unifyDist = Math.min(2, provDistance(turnContext, ally.location, prov.id));
      // GOOD — Banner of Fellowship: allies rally to an honourable cause (+15pp unify).
      const _goodUnify =
        (G.players[c.player]?.alignment === 'Good' ? 15 : 0) + discSum(turnContext, c.player, 'unify', 'pct'); // ag08 Common Cause
      const unifyChancePct = Math.min(100, contingentUnifyChance(marchLvl, unifyDist, false) + _goodUnify); // sd04 Signal Fires is now a `unify` effect
      const unifyRoll = d100();
      if (unifyRoll <= unifyChancePct) {
        friendlyReinforcements.push(ally);
        emit(turnContext, {
          type: 'combat',
          text: `📊 Contingent unify: ${ally.name} joins ${c.name}'s assault on ${toProv.name}! (March ${marchLvl}: ${unifyChancePct}% chance, roll ${unifyRoll} ✓)`,
          audience: { actor: c.player, realms: [c.player] },
          province: toProv.id,
        });
        // Move ally into province and mark as having used their move this phase
        prov.characters = (prov.characters || []).filter((id) => id !== ally.id);
        toProv.characters = toProv.characters || [];
        if (!toProv.characters.includes(ally.id)) toProv.characters.push(ally.id);
        ally.location = toProv.id;
        movePoints[ally.id] = Math.max(0, (movePoints[ally.id] ?? 0) - 1);
        // Prevent ally from processing their own move this phase (mark as spent)
        if (!G.turnOrders[ally.id]) G.turnOrders[ally.id] = [];
        G.turnOrders[ally.id][ph] = { ...G.turnOrders[ally.id][ph], _unifiedWith: c.id };
      } else {
        emit(turnContext, {
          type: 'combat',
          text: `${ally.name} cannot link up with ${c.name} in time — they will attack ${toProv.name} separately. (March ${marchLvl}: ${unifyChancePct}% chance, roll ${unifyRoll} ✗)`,
          audience: { actor: c.player, realms: [c.player] },
        });
      }
    });

    // Build combined army list for battle
    const combinedArmies = [...(c.armies || []), ...friendlyReinforcements.flatMap((a) => a.armies || [])];
    // the BEST commander present leads the pooled host, not simply the mover.
    const _aPick = pickBattleCommander(turnContext, c, friendlyReinforcements, combinedArmies, toProv, true);
    const _aLead = _aPick.leader,
      _aParty = [c, ...friendlyReinforcements];
    const battleAttacker = {
      ..._aLead,
      armies: combinedArmies,
      _reinforcedBy: _aPick.others.map((a) => a.name),
      ...landingPartyFlags(turnContext, _aParty, toProv),
    }; // Reaver Crews (2026-09-23e) and Raid the Coast (2026-09-23f) stay with the landed troops whoever commands
    if (friendlyReinforcements.length > 0) {
      if (_aPick.changed)
        emit(turnContext, {
          type: 'combat',
          text: commandHandoverLine(_aLead, c, toProv.name),
          audience: { actor: c.player, realms: [c.player], seen: 'battle' },
          province: toProv.id,
        });
      emit(turnContext, {
        type: 'combat',
        text: `${_aLead.name} leads a combined force of ${combinedArmies.length} units into battle, reinforced by ${_aPick.others.map((a) => a.name).join(', ')}.`,
        audience: { actor: c.player, realms: [c.player] },
        province: toProv.id,
      });
    }

    // Give province the neutral guard's armies as defenders for this battle
    const _savedNeutralDefs = toProv.neutralDefenders;
    toProv.neutralDefenders = [...(neutralGuard.armies || [])];
    if (_fmSlip && kcRng() < 0.5) {
      toProv._battleUnresolved = true;
      emit(turnContext, {
        type: 'move',
        text: `⚡ ${c.name}'s Forced March filters into ${toProv.name} without giving battle this phase — but the enemy still holds the ground, and the reckoning only waits.`,
        audience: { actor: c.player, realms: [c.player], seen: 'there' },
        province: toProv.id,
      });
      return;
    } // MARCH L7 slip
    const battle = combatVsNPC(turnContext, battleAttacker, toProv, neutralGuard);
    // The guard may have been slain in the pre-battle duel — if so their surviving troops
    // fight on and remain as a LEADERLESS neutral garrison of the province, never as the dead
    // hero's personal army (and never as a player garrison).
    const _guardSlainInDuel = !neutralGuard.alive;
    // Sync hero's armies back from what survived in the battle
    neutralGuard.armies = [...(toProv.neutralDefenders || [])];
    toProv.neutralDefenders = _savedNeutralDefs;
    // Split surviving combined armies back to each hero.
    // IMPORTANT: this MUST run even when there are no reinforcements. The battle is fought
    // on a shallow copy (battleAttacker) whose army array is a *copy* of c.armies, so the
    // casualties applied inside combatVsNPC (a._died / the filter on battleAttacker.armies)
    // never reach the real c.armies unless we re-sync here. Skipping this for the
    // no-reinforcement case left units that were "annihilated in the rout" still alive under
    // their leader in the next report.
    const survivingCombined = battleAttacker.armies || [];
    // Simple split: each original army keeps its identity via reference
    _aParty.forEach((m) => {
      m.armies = (m.armies || []).filter((a) => survivingCombined.includes(a));
    });
    // combatVsNPC applies a losing retreat to the *copy* — propagate it to the REAL
    // characters. Item 2: the whole pooled party falls back together, not just the leader's
    // copy, and the surviving state written onto the copy (HP, items spent, skill gains) is
    // synced back onto the real commander who actually led.
    syncLeaderCopy(turnContext, _aLead, battleAttacker);
    // a chieftain's guard is a real land (or sea) battle and pays Grand Marshal / Sea Lord
    // merit exactly as a war with a rival realm does. `creditBattle` picks the bucket off the
    // province's terrain, so a neutral SEA province pays the Sea Lord, and the neutral
    // commander (player==null) is never debited — only the attacker's own losses count
    // against them. Credited AFTER the copy is synced back, so the sync can never write a
    // pre-battle snapshot of `tm` over the merit just earned.
    creditBattle(turnContext, _aLead, null, battle, toProv);
    if (battleAttacker.location !== _aLead.location || battleAttacker.location !== c.location) {
      _aParty.forEach((m) => {
        if (m.location !== battleAttacker.location) relocateChar(turnContext, m, battleAttacker.location);
      });
    }
    if (battle.won) markOrcAttackWin(c, G, battle); // orc war-spoils — this attacking force won (line appended to the report)
    emitBattle(turnContext, battle, toProv, ph, [c.player], { actor: c.player }); // item 5
    // 2026-10-09 (Toby item 1): a hero pulled into this assault marched and fought, but every
    // line above is filed under the mover, so his own season was blank. Point him at it, as the
    // realm-vs-realm assault below does.
    friendlyReinforcements.forEach((r) =>
      notifyTarget(
        turnContext,
        r,
        r.alive === false
          ? `⚔ ${r.name} marched in ${c.name}'s host against ${toProv.name}, and fell there — the full account is under ${c.name}.`
          : `⚔ ${r.name} marches in ${c.name}'s host against ${toProv.name} — the full account is under ${c.name}.`,
        ph,
        'combat',
      ),
    );
    if (battle.won) {
      _payWinPoint();
      // ── Fate of the guard's SURVIVORS ── combatVsNPC has already applied the casualty
      // rolls — identical to a beaten player, plus the extra no-escape roll, since neutrals
      // cannot retreat. Whatever is left here LIVED. erodeGuardSurvivors then flees / demotes
      // / disbands them; the same helper runs on every contested re-fight, so a guard erodes
      // at the same rate each time he loses.
      const defSurvivors = erodeGuardSurvivors(
        turnContext,
        _guardSlainInDuel ? null : neutralGuard,
        toProv,
        neutralGuard.armies || [],
        (line) =>
          emit(turnContext, {
            type: 'combat',
            text: line,
            audience: { actor: c.player, realms: [] },
            province: toProv.id,
          }),
        c.name,
      );
      neutralGuard.armies = defSurvivors;
      if (_guardSlainInDuel) {
        // The guard is dead — the survivors are the province's leaderless garrison now.
        neutralGuard.armies = [];
        neutralGuard._isNeutralGuard = false;
        toProv.neutralDefenders = defSurvivors;
        toProv.npcArmies = defSurvivors.length;
        toProv._leaderlessDefenders = defSurvivors.length > 0;
        if (defSurvivors.length > 0) {
          toProv._battleUnresolved = true;
          emit(turnContext, {
            type: 'combat',
            text: `💢 Though their commander lies dead, ${defSurvivors.length} surviving unit${defSurvivors.length !== 1 ? 's' : ''} of the garrison refuse to yield ${toProv.name} — the leaderless remnant will contest it again in the next action phase!`,
            audience: { actor: c.player, realms: [], seen: 'battle' },
            province: toProv.id,
          });
        }
      } else
        // If survivors remain, guard rallies — they will fight again next phase (they stay in
        // province)
        if (defSurvivors.length > 0) {
          neutralGuard._isNeutralGuard = true; // stays as guard — will trigger another battle next phase
          toProv._battleUnresolved = true; // co-located forces will fight again at the start of next phase
          emit(turnContext, {
            type: 'combat',
            text: `💢 ${neutralGuard.name.replace(' (wandering)', '')} rallies ${defSurvivors.length} surviving unit${defSurvivors.length !== 1 ? 's' : ''} — they will contest ${toProv.name} again in the next action phase!`,
            audience: { actor: c.player, realms: [], seen: 'battle' },
            province: toProv.id,
          });
          emit(turnContext, {
            type: 'combat',
            text: `⚔ The battle for ${toProv.name} is not over — ${neutralGuard.name.replace(' (wandering)', '')} rallies and will fight again!`,
            audience: { actor: c.player, realms: [], seen: 'battle' },
            province: toProv.id,
          });
        } else {
          neutralGuard._isNeutralGuard = false;
          neutralGuard._justDefeated = true;
          neutralGuard.name = neutralGuard.name.replace(' (wandering)', '') + ' (wandering)';
          // Immediately flee to an adjacent province — prefer non-enemy provinces
          const ngProv = G.world.provinces[neutralGuard.location];
          if (ngProv) {
            const ngNeighbors = getNeighborsP(ngProv, G.world.cols, G.world.rows, G.world.provinces).filter(
              (n) => n.terrain !== 'sea',
            );
            // Prefer province not owned by the attacker
            const safeNeighbors = ngNeighbors.filter((n) => n.owner !== c.player);
            const fleeDest = (safeNeighbors.length > 0 ? safeNeighbors : ngNeighbors)[
              Math.floor(kcRng() * (safeNeighbors.length || ngNeighbors.length))
            ];
            if (fleeDest) {
              ngProv.characters = (ngProv.characters || []).filter((id) => id !== neutralGuard.id);
              fleeDest.characters = fleeDest.characters || [];
              if (!fleeDest.characters.includes(neutralGuard.id)) fleeDest.characters.push(neutralGuard.id);
              neutralGuard.location = fleeDest.id;
              neutralGuard.locationName = fleeDest.name;
              emit(turnContext, {
                type: 'combat',
                text: `💀 ${neutralGuard.name.replace(' (wandering)', '')} has been defeated — all forces destroyed, they flee bitterly to ${fleeDest.name}.`,
                audience: { actor: c.player, realms: [], seen: 'battle' },
                province: toProv.id,
              });
            } else {
              emit(turnContext, {
                type: 'combat',
                text: `💀 ${neutralGuard.name.replace(' (wandering)', '')} has been defeated — all forces destroyed, they retreat into the wilderness.`,
                audience: { actor: c.player, realms: [], seen: 'battle' },
                province: toProv.id,
              });
            }
          }
        }
      // Province is claimed when all defenders are eliminated (no survivors to rally)
      if (defSurvivors.length === 0) {
        setProvinceOwner(turnContext, toProv, c.player, c, ph);
        toProv.neutralDefenders = [];
        player.merits += toProv.tax;
        if (c.alive !== false) c.merits = (c.merits || 0) + toProv.tax; // 2026-09-21: a commander slain in the pre-battle duel earns no personal merit
        applyEvilConquest(turnContext, c, toProv, player); // Evil doctrine: loot or enslave
        toProv._hadBattleThisTurn = true;
        emit(turnContext, {
          type: 'combat',
          text: `${c.alive === false ? `${c.name}'s leaderless host` : c.name} claims ${toProv.name} for ${player.name}!${c.alive === false ? '' : ` (+${toProv.tax} merit)`}`,
          audience: { actor: c.player, realms: [], seen: 'battle' },
          province: toProv.id,
        });
        if (!player.provinces.includes(toProv.id)) player.provinces.push(toProv.id);
      } // end if(defSurvivors.length===0)
    } else {
      // Attacker lost — neutral guard holds (survivors already rallied above)
      toProv.neutralDefenders = [...(neutralGuard.armies || [])];
      if (_guardSlainInDuel) {
        // The guard died in the duel but their troops threw the attack back regardless.
        neutralGuard.armies = [];
        neutralGuard._isNeutralGuard = false;
        toProv.npcArmies = toProv.neutralDefenders.length;
        toProv._leaderlessDefenders = toProv.neutralDefenders.length > 0;
        if (toProv._leaderlessDefenders)
          emit(turnContext, {
            type: 'combat',
            text: `🛡 Their commander fell, but the garrison of ${toProv.name} held — the leaderless defenders keep the province.`,
            audience: { actor: c.player, realms: [], seen: 'battle' },
            province: toProv.id,
          });
      }
      toProv.characters = toProv.characters.filter((id) => id !== c.id);
      prov.characters.push(c.id);
      c.location = prov.id; // rule: never zero remaining move points — the attack move already cost its point; the rest of the turn's budget stays.
    }
  } else if (
    toProv.owner !== null &&
    toProv.owner !== c.player &&
    (c.armies || []).length > 0 &&
    areEnemies(turnContext, c.player, toProv.owner)
  ) {
    // ENEMY-owned province → invasion/battle (below). ALLIED-owned falls through to the final
    // else and is treated as a peaceful entry (allies grant free passage and never fight
    // here); NEUTRAL-owned was already turned back at the border above.
    c._attackedFrom = prov.id; // track for retreat
    const defChar = G.characters.find(
      (d) => d.alive && d.player === toProv.owner && d.location === toProv.id && (d.armies || []).length > 0,
    );
    if (!defChar) {
      // No living commander to rally them: any leaderless host of the owner standing here
      // folds into the garrison and fights on as a commanderless force.
      const _llHere = (G.characters || []).filter(
        (dc) =>
          !dc.alive &&
          dc._leaderlessHost &&
          dc.player === toProv.owner &&
          dc.location === toProv.id &&
          (dc.armies || []).length > 0,
      );
      if (_llHere.length > 0) {
        toProv.garrisonArmies = (toProv.garrisonArmies || []).concat(
          _llHere.flatMap((dc) => {
            const a = dc.armies || [];
            dc.armies = [];
            delete dc._leaderlessHost;
            return a;
          }),
        );
        emit(turnContext, {
          type: 'combat',
          text: `⚑ With no commander to lead them, the leaderless troops in ${toProv.name} form up with the garrison to hold the ground.`,
          audience: { actor: toProv.owner, realms: [toProv.owner], seen: 'battle' },
          province: toProv.id,
        });
      }
    }
    if (defChar) {
      // Contingent unify for PvP attacker too
      const pvpReinforcements = [];
      G.characters.forEach((ally) => {
        if (!ally.alive || ally.id === c.id || ally.player !== c.player) return;
        if ((ally.armies || []).length === 0) return;
        const allyOrder = G.turnOrders?.[ally.id]?.[ph];
        if (!allyOrder || normaliseAction(allyOrder) !== 'move') return; // see the note on the NPC-side unify above
        {
          const _aDest = intendedDestination(turnContext, ally, allyOrder);
          if (!_aDest || _aDest.id !== toProv.id) return;
        }
        const marchLvl = effStat(turnContext, c, 'march');
        const unifyDist = Math.min(2, provDistance(turnContext, ally.location, prov.id));
        const unifyPct = Math.min(
          100,
          contingentUnifyChance(marchLvl, unifyDist, false) +
            (G.players[c.player]?.alignment === 'Good' ? 15 : 0) +
            discSum(turnContext, c.player, 'unify', 'pct'),
        ); // GOOD — Banner of Fellowship; + ag08 Common Cause
        const roll = d100();
        if (roll <= unifyPct) {
          pvpReinforcements.push(ally);
          emit(turnContext, {
            type: 'combat',
            text: `📊 ${ally.name} unifies with ${c.name} for the assault on ${toProv.name}! (${unifyPct}% → roll ${roll} ✓)`,
            audience: { actor: c.player, realms: [c.player], seen: 'battle' },
            province: toProv.id,
          });
          prov.characters = (prov.characters || []).filter((id) => id !== ally.id);
          if (!toProv.characters.includes(ally.id)) toProv.characters.push(ally.id);
          ally.location = toProv.id;
          movePoints[ally.id] = Math.max(0, (movePoints[ally.id] ?? 0) - 1);
          if (!G.turnOrders[ally.id]) G.turnOrders[ally.id] = [];
          G.turnOrders[ally.id][ph] = { ...G.turnOrders[ally.id][ph], _unifiedWith: c.id };
        } else {
          emit(turnContext, {
            type: 'combat',
            text: `${ally.name} misses the timing — will attack ${toProv.name} separately this phase.`,
            audience: { actor: c.player, realms: [c.player] },
          });
        }
      });
      // Defender unify (defenders in same province always combine)
      const defReinforcements = G.characters.filter(
        (d) =>
          d.alive &&
          d.id !== defChar.id &&
          d.player === toProv.owner &&
          d.location === toProv.id &&
          (d.armies || []).length > 0,
      );
      const defNavLvl = effStat(turnContext, defChar, 'naval');
      // Item (reorder): the "…moves into… a battle is initiated" line must be the FIRST line
      // of the battle block — before the defender's reinforce/rally form-up. Those lines are
      // therefore COLLECTED here (not logged inline) and spliced into battle.narrative right
      // after the move-in line, once combatVsChar has produced it. (Previously they were
      // emitted immediately, so they printed ABOVE the move-in line.)
      const _defFormupLines = [];
      // Naval skill gives defenders unify bonus for sea battles
      if (defReinforcements.length > 0) {
        _defFormupLines.push(
          `${defChar.name} is reinforced by ${defReinforcements.map((d) => d.name).join(', ')} in the defence of ${toProv.name}!`,
        );
      }
      // ── Standing troops rally to the defence ── A province's own units do not stand idle
      // while a friendly hero fights for it. Two sources join the defender's line:
      // • the unled garrison (toProv.garrisonArmies)
      // • any leaderless host here — a hero of this player who fell earlier this turn but
      // whose army fought on; his troops rally to the living commander.
      // They are pooled onto combinedDef so they share the battle line, terrain, tactics and
      // casualties. Their origin is tracked so survivors can be returned to the right place
      // (garrison vs. leaderless host) afterwards.
      const _garrisonHere = [...(toProv.garrisonArmies || [])];
      _garrisonHere.forEach((a) => {
        a._fromGarrison = true;
      });
      const _leaderlessHosts = (G.characters || []).filter(
        (dc) =>
          !dc.alive &&
          dc._leaderlessHost &&
          dc.player === toProv.owner &&
          dc.location === toProv.id &&
          (dc.armies || []).length > 0,
      );
      _leaderlessHosts.forEach((dc) =>
        dc.armies.forEach((a) => {
          a._fromLeaderless = dc.id;
        }),
      );
      const _rallied = [..._garrisonHere, ..._leaderlessHosts.flatMap((dc) => dc.armies)];
      if (_rallied.length > 0) {
        // say how many units rally and what they are — "(1)" read as a bare number.
        const _bits = [];
        if (_garrisonHere.length > 0)
          _bits.push(
            `the garrison (${_garrisonHere.length} unit${_garrisonHere.length !== 1 ? 's' : ''} — ${describeArmy(_garrisonHere)})`,
          );
        _leaderlessHosts.forEach((dc) =>
          _bits.push(
            `${dc.name}'s leaderless host (${dc.armies.length} unit${dc.armies.length !== 1 ? 's' : ''} — ${describeArmy(dc.armies)})`,
          ),
        );
        _defFormupLines.push(
          `🛡 The standing troops of ${toProv.name} rally to ${defChar.name}: ${_bits.join(', ')} join the defence.`,
        );
      }
      const _atkPooled = [...(c.armies || []), ...pvpReinforcements.flatMap((a) => a.armies || [])];
      const _defPooled = [...(defChar.armies || []), ...defReinforcements.flatMap((d) => d.armies || []), ..._rallied];
      // the BEST commander on each side takes the combined host. Strict best score wins; the
      // loser of the contest stands in the line as a contingent commander.
      const _aP = pickBattleCommander(turnContext, c, pvpReinforcements, _atkPooled, toProv, true);
      const _dP = pickBattleCommander(turnContext, defChar, defReinforcements, _defPooled, toProv, false);
      const _atkLead = _aP.leader,
        _defLead = _dP.leader;
      const _atkParty = [c, ...pvpReinforcements],
        _defParty = [defChar, ...defReinforcements];
      if (_aP.changed)
        emit(turnContext, {
          type: 'combat',
          text: commandHandoverLine(_atkLead, c, toProv.name),
          audience: { actor: c.player, realms: [c.player], seen: 'battle' },
          province: toProv.id,
        });
      if (_dP.changed) _defFormupLines.push(commandHandoverLine(_defLead, defChar, toProv.name));
      const combinedAtk = { ..._atkLead, armies: _atkPooled, ...landingPartyFlags(turnContext, _atkParty, toProv) }; // Reaver Crews (2026-09-23e) and Raid the Coast (2026-09-23f) stay with the landed troops whoever commands
      const combinedDef = { ..._defLead, armies: _defPooled };
      const _vDefs = [defChar, ...defReinforcements].filter(Boolean);
      if (isVeiled(turnContext, c) || (_vDefs.length > 0 && _vDefs.every((d) => isVeiled(turnContext, d)))) {
        return;
      } // ILLUSORY L9 VEIL: a veiled attacker slips in unseen; a wholly-veiled defence cannot be found — no battle, no contest flagged (it triggers when the veil parts, via the re-trigger scan).
      if (_fmSlip && kcRng() < 0.5) {
        toProv._battleUnresolved = true;
        emit(turnContext, {
          type: 'move',
          text: `⚡ ${c.name}'s Forced March filters into ${toProv.name} without giving battle this phase — but the enemy still holds the ground, and the reckoning only waits.`,
          audience: { actor: c.player, realms: [c.player], seen: 'there' },
          province: toProv.id,
        });
        return;
      } // MARCH L7 slip
      const battle = combatVsChar(turnContext, combinedAtk, combinedDef, toProv);
      syncLeaderCopy(turnContext, _atkLead, combinedAtk);
      syncLeaderCopy(turnContext, _defLead, combinedDef); // wounds, deaths, spent items and skill gains land on the real commanders
      creditBattle(turnContext, _atkLead, _defLead, battle, toProv);
      const targets = [c.player, defChar.player];
      // Reorder: place the collected reinforce/rally lines immediately AFTER the "…moves
      // into… a battle is initiated." line so the move that triggers the fight reads first,
      // then the defence forms up. Splice after that line if present (first-contact battle);
      // otherwise (no move-in line, e.g. a suppressed/edge case) prepend so they still lead
      // the block.
      if (_defFormupLines.length && battle && Array.isArray(battle.narrative)) {
        let _mi = battle.narrative.findIndex(
          (l) => typeof narrText(l) === 'string' && String(narrText(l)).includes('a battle is initiated'),
        );
        narrateAt(battle.narrative, _mi >= 0 ? _mi + 1 : 0, _defFormupLines);
      }
      // charIds names EVERY commander who fought — attacker + his reinforcements, defender +
      // his. Without it the DEFENDING player's copy of the battle inherited the attacker's
      // log context (a charId not in their Chronicle) and fell into Realm Events, leaving the
      // defending hero's own phase block empty. Each extra same-side commander also gets a
      // pointer line.
      const _battleChars = [
        c.id,
        ...pvpReinforcements.map((r) => r.id),
        defChar.id,
        ...defReinforcements.map((d) => d.id),
      ];
      if (battle && battle.won) markOrcAttackWin(c, G, battle); // orc war-spoils — this attacking force won (line appended to the report)
      emitBattle(turnContext, battle, toProv, ph, targets, { actor: c.player, charIds: _battleChars }); // item 5
      // 2026-09-21: these pointers are written AFTER the battle, so a same-side hero who fell in
      // its pre-battle duel must be told in the past tense, not as if he still marches.
      defReinforcements.forEach((d) =>
        notifyTarget(
          turnContext,
          d,
          d.alive === false
            ? `⚔ ${d.name} stood in the battle line beside ${defChar.name} in the defence of ${toProv.name}, and fell there — the full account is under ${defChar.name}.`
            : `⚔ ${d.name} stands in the battle line beside ${defChar.name} in the defence of ${toProv.name} — the full account is under ${defChar.name}.`,
          ph,
          'combat',
        ),
      );
      pvpReinforcements.forEach((r) =>
        notifyTarget(
          turnContext,
          r,
          r.alive === false
            ? `⚔ ${r.name} marched in ${c.name}'s host against ${toProv.name}, and fell there — the full account is under ${c.name}.`
            : `⚔ ${r.name} marches in ${c.name}'s host against ${toProv.name} — the full account is under ${c.name}.`,
          ph,
          'combat',
        ),
      );
      // combatVsChar fights on pooled COPIES (combinedAtk/combinedDef) and marks fallen units
      // with _died on the shared army objects. Write those casualties back to the real
      // characters and their reinforcements so destroyed armies are actually removed
      // (otherwise annihilated units linger on the real characters).
      [c, ...pvpReinforcements].forEach((ch) => {
        ch.armies = (ch.armies || []).filter((a) => !a._died && !a._disbanded);
      });
      [defChar, ...defReinforcements].forEach((ch) => {
        ch.armies = (ch.armies || []).filter((a) => !a._died && !a._disbanded);
      });
      // AK [3.15]: a beaten general stops Defending — every general in the beaten party, not only its commander
      if (battle)
        (battle.won ? [defChar, ...defReinforcements] : [c, ...pvpReinforcements]).forEach((ch) =>
          noteBattleLoss(turnContext, ch.id),
        );
      // Rallied troops: survivors of the garrison and of any leaderless host.
      // 2026-09-27 (Toby): HULLS LEFT ASHORE. If the beaten defender had ships it could not
      // take with it, navalSplitRetreat has already put them into toProv.garrisonArmies and
      // flagged the province contested. Three blocks below then behaved as if they were not
      // there — the assignment a few lines down replaced the array outright, the fall-back
      // block emptied it, and the capture check looked only for hostile CHARACTERS — so the
      // report announced hulls holding the field, then deleted them and handed the attacker
      // the province in the same breath. Hold them aside from here on.
      const _navalHeld = navalHeldIn(toProv);
      // combatVsChar fights on a POOLED COPY, and syncLeaderCopy deliberately does not write
      // `armies` back — the caller splits the pooled list to its owners, and it only strips
      // the dead. A hull the naval retreat took off the copy's list was therefore still on
      // the real commander's, so the same object ended up marching inland with him AND
      // sitting in the province garrison. Take the stranded hulls off every real party
      // member on both sides; they belong to the ground now.
      if (_navalHeld.length) {
        [c, ...pvpReinforcements, defChar, ...defReinforcements].forEach((ch) => {
          if (!ch || !Array.isArray(ch.armies)) return;
          const _n = ch.armies.length;
          ch.armies = ch.armies.filter((a) => _navalHeld.indexOf(a) < 0);
          if (ch.armies.length !== _n && typeof refreshMovePool === 'function') refreshMovePool(turnContext, ch);
        });
      }
      const _garrisonSurv = _garrisonHere.filter((a) => !a._died && !a._disbanded && _navalHeld.indexOf(a) < 0);
      _garrisonSurv.forEach((a) => {
        delete a._fromGarrison;
      });
      // A leaderless host that has now taken casualties: strip the dead and, if it is wiped
      // out, retire the corpse's host flag so it stops being a combatant.
      _leaderlessHosts.forEach((dc) => {
        dc.armies = (dc.armies || []).filter((a) => !a._died && !a._disbanded && _navalHeld.indexOf(a) < 0);
        dc.armies.forEach((a) => {
          delete a._fromLeaderless;
        });
        if (dc.armies.length === 0) delete dc._leaderlessHost;
      });
      // The garrison's home is toProv.garrisonArmies. Whether the survivors stay or fall back
      // is decided once the battle outcome is known, just below. Hulls stranded ashore by the
      // naval retreat stay put whatever the garrison does — they cannot take to the road.
      toProv.garrisonArmies = _navalHeld.concat(_garrisonSurv);
      // combatVsChar decides the DEFENDER's fate on the pooled copy too: on a clean rout it
      // moves combinedDef to the retreat province (fixing both provinces' character lists),
      // while a trapped defence (incl. a trapped Dwarven Shield Fort) is deliberately left
      // standing where it is. The real defChar's location was never synced back from that
      // copy, leaving a retreating defender as a ghost — listed in the retreat province but
      // still claiming to be located in the province they just fled. Sync it, and take the
      // rest of the defending contingent with them: they fought as one pooled force, so they
      // rout as one rather than being abandoned as orphans in a province that is about to
      // change hands.
      if (combinedDef.location !== _defLead.location || combinedDef.location !== defChar.location) {
        const _defFellBackTo = G.world.provinces[combinedDef.location];
        if (_defFellBackTo) {
          if (!_defFellBackTo.characters) _defFellBackTo.characters = [];
          [defChar, ...defReinforcements].forEach((ch) => {
            // a commander slain in the pre-battle duel does NOT follow the rout — the corpse
            // stays in the province where the battle was fought (their grave is already
            // recorded there). Only the living fall back.
            if (!ch.alive) {
              return;
            }
            toProv.characters = (toProv.characters || []).filter((id) => id !== ch.id);
            if (!_defFellBackTo.characters.includes(ch.id)) _defFellBackTo.characters.push(ch.id);
            ch.location = _defFellBackTo.id;
            ch.locationName = _defFellBackTo.name;
            // forced retreat/fall-back does NOT consume move points.
          });
          if (defReinforcements.length > 0) {
            emit(turnContext, {
              type: 'combat',
              text: `${defReinforcements.map((d) => d.name).join(', ')} fall back to ${_defFellBackTo.name} alongside ${defChar.name}.`,
              audience: { actor: defChar.player, realms: targets, seen: 'battle' },
              province: _defFellBackTo.id,
            });
          }
          // The rallied garrison retreats WITH the hero — it garrisons the province he falls
          // back to, since it has no commander of its own to lead it elsewhere. Any surviving
          // leaderless host does the same: its dead commander can no longer carry it.
          const _fallenBack = [
            ..._garrisonSurv,
            ..._leaderlessHosts.flatMap((dc) => {
              const a = dc.armies || [];
              dc.armies = [];
              delete dc._leaderlessHost;
              return a;
            }),
          ];
          if (_fallenBack.length > 0) {
            _defFellBackTo.garrisonArmies = (_defFellBackTo.garrisonArmies || []).concat(_fallenBack);
            toProv.garrisonArmies = _navalHeld.slice(); // the stranded hulls do not march inland
            emit(turnContext, {
              type: 'combat',
              text: `The standing troops of ${toProv.name} fall back to ${_defFellBackTo.name} with ${defChar.name} rather than be left to the enemy.`,
              audience: { actor: defChar.player, realms: targets, seen: 'battle' },
              province: _defFellBackTo.id,
            });
          }
        }
      } else {
        // Defender held the ground (won, or repelled and stayed). Any surviving leaderless
        // host is done fighting for now — fold it into the garrison it fought beside, so a
        // corpse is not left owning an army into the next phase.
        const _absorb = _leaderlessHosts.flatMap((dc) => {
          const a = dc.armies || [];
          dc.armies = [];
          delete dc._leaderlessHost;
          return a;
        });
        if (_absorb.length > 0) toProv.garrisonArmies = (toProv.garrisonArmies || []).concat(_absorb);
      }
      if (battle.won) {
        // Winning the battle is not the same as taking the ground. A dug-in or trapped
        // defence
        // (a trapped Dwarven Shield Fort / nowhere to retreat) leaves enemy armies still standing here,
        // and so does a third party's force that was never part of this fight. Claiming the
        // province over the top of them would hand the attacker ownership of ground they do
        // not hold and quietly end a battle that is still going. Only take the province if
        // nobody armed and hostile is left standing in it; otherwise leave it contested so
        // resolveStalledBattles resumes the fight next phase.
        const _hostileLeft = (G.characters || []).some(
          (ch) =>
            ch.alive &&
            ch.location === toProv.id &&
            (ch.armies || []).length > 0 &&
            ch.player !== null &&
            ch.player !== c.player,
        );
        // …and hulls the beaten defender left ashore are an armed enemy force standing on the
        // ground too, commander or no commander (2026-09-27, Toby).
        const _navalBlock = navalHeldIn(toProv, c.player);
        _payWinPoint();
        if (_hostileLeft || _navalBlock.length > 0) {
          toProv._battleUnresolved = true;
          emit(turnContext, {
            type: 'combat',
            text: `${c.alive === false ? `${c.name}'s leaderless host` : c.name} carries the field at ${toProv.name}, but enemy forces still hold their ground — the province remains contested.`,
            audience: { actor: c.player, realms: targets, seen: 'battle' },
            province: toProv.id,
          });
          if (!_hostileLeft && _navalBlock.length > 0)
            emit(turnContext, {
              type: 'combat',
              text: navalHoldLine(turnContext, toProv, _navalBlock, player.name),
              audience: { actor: c.player, realms: targets, seen: 'battle' },
              province: toProv.id,
            });
        } else {
          G.players.forEach((p, pi) => {
            if (pi !== c.player) {
              const i = p.provinces.indexOf(toProv.id);
              if (i > -1) p.provinces.splice(i, 1);
            }
          });
          setProvinceOwner(turnContext, toProv, c.player, c, ph);
          if (!player.provinces.includes(toProv.id)) player.provinces.push(toProv.id);
          emit(turnContext, {
            type: 'combat',
            text: `${c.alive ? c.name : `${c.name}'s leaderless host`} claims ${toProv.name} for ${player.name}!`,
            audience: { actor: c.player, realms: targets, seen: 'battle' },
            province: toProv.id,
          });
          applyEvilConquest(turnContext, c, toProv, player);
        }
      } else {
        // Attacker repelled. combatVsChar fights on COPIES and decides the attacker's fate on
        // the copy: if they were TRAPPED (no friendly province to fall back to) or dug in
        // (a trapped Dwarven Shield Fort) the copy is deliberately LEFT standing in the province and
        // the province is flagged _battleUnresolved so the fight resumes next phase. Hauling
        // the REAL character back to their origin regardless would separate the two forces —
        // resolveStalledBattles would then find only one side in the contested province,
        // silently clear the flag, and the battle would never resume on its own. So follow
        // the copy's decision rather than overriding it.
        const _stoodGround = combinedAtk.location === toProv.id;
        const _fellBackTo = _stoodGround ? toProv : G.world.provinces[combinedAtk.location] || prov;
        // if the attacking commander was slain in the pre-battle duel, the corpse stays where
        // they fell (toProv) — only a LIVING repelled attacker falls back. Their leaderless
        // host still retreats via the host-dispersal logic; the body does not travel with it.
        // Item 2: the whole attacking party falls back together — they fought as one pooled
        // host under one commander, so they are repelled as one, not scattered.
        _atkParty.forEach((m) => {
          if (!m || !m.alive) return; // a commander slain in the duel stays where they fell
          if (!_stoodGround) toProv.characters = (toProv.characters || []).filter((id) => id !== m.id);
          if (!_fellBackTo.characters) _fellBackTo.characters = [];
          if (!_fellBackTo.characters.includes(m.id)) _fellBackTo.characters.push(m.id);
          m.location = _fellBackTo.id;
          m.locationName = _fellBackTo.name;
        });
        // rule: never zero remaining move points on a move-in/battle — the move already cost
        // its point; the rest of the turn’s budget stays.
      }
      // ── Garrison joins the hero for the whole fight ── If this battle left the province
      // CONTESTED (a resume is pending) and the defending hero is still standing in it, the
      // rallied garrison must keep fighting alongside him — not sit benched in
      // toProv.garrisonArmies while the resume (which fights only the hero's own armies)
      // ignores it. Fold the surviving garrison (and any leaderless-host survivors already
      // absorbed into it above) into the hero's force, so they carry into every resume battle
      // here as one host. Each folded unit REMEMBERS its home province (_garrisonOf): once
      // the whole contest resolves, settleRalliedGarrisons() either RETURNS them to garrison
      // the province (if the hero held it) or lets them stay with the hero (if he lost and
      // retreated) — see that helper.
      if (
        toProv._battleUnresolved &&
        defChar.alive &&
        defChar.location === toProv.id &&
        (toProv.garrisonArmies || []).length > 0
      ) {
        const _join = toProv.garrisonArmies;
        _join.forEach((a) => {
          delete a._fromGarrison;
          delete a._fromLeaderless;
          a._garrisonOf = toProv.id;
        });
        defChar.armies = (defChar.armies || []).concat(_join);
        toProv.garrisonArmies = [];
        if (typeof refreshMovePool === 'function') refreshMovePool(turnContext, defChar); // added units may change his pace
        emit(turnContext, {
          type: 'combat',
          text: `🛡 The standing troops of ${toProv.name} fall in with ${defChar.name} and fight on at their side as the battle continues.`,
          audience: { actor: defChar.player, realms: targets, seen: 'battle' },
          province: toProv.id,
        });
      }
      // The stranded-hull tag has done its work for this phase: the claim decision is made and
      // the hulls are wherever they belong. From here they are ordinary units again (a pending
      // resume fights them through resolveUnitGainInProvince), so the marker never persists.
      clearNavalHold(toProv);
      _navalHeld.forEach((a) => {
        if (a) delete a._navalHold;
      });
    } else {
      // ── Unled garrison ── A battle is fought exactly as it would be against any other
      // commanderless force. combatVsNPC is driven off prov.neutralDefenders, so the garrison
      // is swapped in there for the duration and the SURVIVORS ARE READ BACK OUT before the
      // array is restored.
      //
      // What this replaced was not a normal battle: it restored the saved array and threw
      // combatVsNPC's survivor list away, then on a win deleted every garrison unit and
      // claimed the province even when defenders were still standing (combatVsNPC had already
      // flagged _battleUnresolved), and on a loss never removed the garrison's own casualties
      // — dead units stayed in garrisonArmies carrying stale _died flags into the next fight.
      // It also marched the attacker home even when combatVsNPC had judged him trapped and
      // deliberately left him standing.
      const garrisonArmies = toProv.garrisonArmies || [];
      if (garrisonArmies.length > 0 && (c.armies || []).length > 0) {
        c._attackedFrom = prov.id; // so combatVsNPC retreats him the way he came
        const _savedDefs = toProv.neutralDefenders;
        const _savedNpcCount = toProv.npcArmies;
        toProv.neutralDefenders = [...garrisonArmies];
        // No commander: no Tactical, no duel, no battle magic on the defending side.
        if (_fmSlip && kcRng() < 0.5) {
          toProv._battleUnresolved = true;
          emit(turnContext, {
            type: 'move',
            text: `⚡ ${c.name}'s Forced March filters into ${toProv.name} without giving battle this phase — but the enemy still holds the ground, and the reckoning only waits.`,
            audience: { actor: c.player, realms: [c.player], seen: 'there' },
            province: toProv.id,
          });
          return;
        } // MARCH L7 slip
        const garBattle = combatVsNPC(turnContext, c, toProv, null);
        // combatVsNPC writes the survivors back to prov.neutralDefenders in BOTH branches.
        const garSurvivors = [...(toProv.neutralDefenders || [])];
        toProv.neutralDefenders = _savedDefs;
        toProv.npcArmies = _savedNpcCount;
        toProv.garrisonArmies = garSurvivors;
        // breaking an enemy realm's garrison destroys THEIR units, so it earns Grand Marshal
        // / Sea Lord merit like any other land battle. No commander stands opposite, so
        // nobody is debited for the garrison's dead.
        if (toProv.owner != null && toProv.owner !== c.player) creditBattle(turnContext, c, null, garBattle, toProv);
        toProv._hadBattleThisTurn = true;
        if (garBattle.won) markOrcAttackWin(c, G, garBattle); // orc war-spoils — this attacking force won (line appended to the report)
        emitBattle(
          turnContext,
          garBattle,
          toProv,
          ph,
          [c.player, toProv.owner].filter((x) => x !== null),
          { actor: c.player },
        ); // item 5
        if (garBattle.won) {
          _payWinPoint();
          if (garSurvivors.length > 0) {
            // a beaten garrison RETREATS if it has somewhere to go — an adjacent land
            // province still held by its own crown. With no commander to lead them elsewhere
            // they fall back as a garrison, and the province falls to the attacker as its
            // defenders withdraw. Only if truly hemmed in (no friendly land neighbour) do
            // they stand and fight on, contesting the ground into the next phase.
            const _garrRetreat = getNeighborsP(toProv, G.world.cols, G.world.rows, G.world.provinces).filter(
              (p2) => p2 && p2.owner === toProv.owner && p2.terrain !== 'sea',
            );
            if (_garrRetreat.length > 0) {
              const _dest = _garrRetreat[0];
              _dest.garrisonArmies = (_dest.garrisonArmies || []).concat(garSurvivors);
              toProv.garrisonArmies = [];
              emit(turnContext, {
                type: 'combat',
                text: `The garrison of ${toProv.name} is broken and falls back to ${_dest.name} rather than be overrun.`,
                audience: {
                  actor: c.player,
                  realms: [c.player, toProv.owner].filter((x) => x !== null),
                  seen: 'battle',
                },
                province: _dest.id,
              });
              G.players.forEach((p, pi) => {
                if (pi !== c.player) {
                  const i = p.provinces.indexOf(toProv.id);
                  if (i > -1) p.provinces.splice(i, 1);
                }
              });
              setProvinceOwner(turnContext, toProv, c.player, c, ph);
              if (!player.provinces.includes(toProv.id)) player.provinces.push(toProv.id);
              emit(turnContext, {
                type: 'combat',
                text: `${c.name} takes ${toProv.name} as its garrison withdraws!`,
                audience: { actor: c.player, realms: [], seen: 'battle' },
                province: toProv.id,
              });
              applyEvilConquest(turnContext, c, toProv, player);
            } else {
              // Beaten but not broken — the province is still held and still contested.
              toProv._battleUnresolved = true;
              emit(turnContext, {
                type: 'combat',
                text: `💢 The garrison of ${toProv.name} is driven back but not broken — ${garSurvivors.length} unit${garSurvivors.length !== 1 ? 's' : ''} still hold the ground, and the fight resumes next phase.`,
                audience: {
                  actor: c.player,
                  realms: [c.player, toProv.owner].filter((x) => x !== null),
                  seen: 'battle',
                },
                province: toProv.id,
              });
            }
          } else {
            G.players.forEach((p, pi) => {
              if (pi !== c.player) {
                const i = p.provinces.indexOf(toProv.id);
                if (i > -1) p.provinces.splice(i, 1);
              }
            });
            setProvinceOwner(turnContext, toProv, c.player, c, ph);
            if (!player.provinces.includes(toProv.id)) player.provinces.push(toProv.id);
            emit(turnContext, {
              type: 'combat',
              text: `${c.name} breaks through the last of the garrison and seizes ${toProv.name}!`,
              audience: { actor: c.player, realms: [], seen: 'battle' },
              province: toProv.id,
            });
            applyEvilConquest(turnContext, c, toProv, player);
          }
        } else {
          // Repelled. combatVsNPC has already decided the attacker's fate on the real
          // character — it either retreated him (updating both province lists and zeroing his
          // movement) or deliberately LEFT HIM STANDING because he was trapped. Follow that
          // decision instead of overriding it, exactly as the PvP branch does.
          const _stoodGround = c.location === toProv.id;
          emit(turnContext, {
            type: 'combat',
            text: _stoodGround
              ? `The garrison of ${toProv.name} throws ${c.name} back, but there is no ${toProv.terrain === 'sea' ? 'open water to escape by' : 'road out'} — leaderless troops can hold ${toProv.terrain === 'sea' ? 'their waters' : 'walls'}, and the struggle goes on.`
              : `The garrison of ${toProv.name} repels ${c.name}'s attack — leaderless troops can hold ${toProv.terrain === 'sea' ? 'their waters' : 'walls'}!`,
            audience: { actor: c.player, realms: [c.player, toProv.owner].filter((x) => x !== null), seen: 'battle' },
            province: toProv.id,
          });
          if (_stoodGround) toProv._battleUnresolved = true;
          // rule: never zero remaining move points on a move-in/battle — the move already
          // cost its point; the rest of the turn’s budget stays.
        }
      } else {
        const _prevOwnerIdx = toProv.owner != null && toProv.owner !== c.player ? toProv.owner : null; // capture before ownership transfers
        const _prevOwnerName = _prevOwnerIdx != null ? G.players[_prevOwnerIdx]?.name || null : null;
        G.players.forEach((p, pi) => {
          if (pi !== c.player) {
            const i = p.provinces.indexOf(toProv.id);
            if (i > -1) p.provinces.splice(i, 1);
          }
        });
        setProvinceOwner(turnContext, toProv, c.player, c, ph);
        if (!player.provinces.includes(toProv.id)) player.provinces.push(toProv.id);
        // 2026-10-08 (Toby item 6): no battle, so no second point — the step in was the cost.
        emit(turnContext, {
          type: 'move',
          text: `${c.name} seizes the undefended province of ${toProv.name}${_prevOwnerName ? ` from ${_prevOwnerName}` : ''} for ${player.name}!`,
          audience: { actor: c.player, realms: _prevOwnerIdx != null ? [_prevOwnerIdx] : [], seen: 'there' },
          province: toProv.id,
        });
        applyEvilConquest(turnContext, c, toProv, player);
      }
    }
  } else {
    let _moveLineLogged = false;
    if (
      toProv.owner === null &&
      !neutralGuard &&
      toProv._leaderlessDefenders &&
      (toProv.neutralDefenders || []).length > 0 &&
      (c.armies || []).length > 0
    ) {
      // ── Leaderless neutral garrison ── The province's guard commander is dead (slain in a
      // pre-battle duel), but their surviving troops still hold the ground. They fight as a
      // commanderless garrison — no Tactical, no duel, no spells — but they DO fight.
      c._attackedFrom = prov.id;
      if (_fmSlip && kcRng() < 0.5) {
        toProv._battleUnresolved = true;
        emit(turnContext, {
          type: 'move',
          text: `⚡ ${c.name}'s Forced March filters into ${toProv.name} without giving battle this phase — but the enemy still holds the ground, and the reckoning only waits.`,
          audience: { actor: c.player, realms: [c.player], seen: 'there' },
          province: toProv.id,
        });
        return;
      } // MARCH L7 slip
      const llBattle = combatVsNPC(turnContext, c, toProv, null);
      creditBattle(turnContext, c, null, llBattle, toProv); // a leaderless neutral guard still pays merit
      if (llBattle.won) markOrcAttackWin(c, G, llBattle); // 2026-09-27 (Toby item 8): war-spoils were credited on only three of the six attacking-win paths — a leaderless neutral garrison is still a battle won on the attack
      emitBattle(
        turnContext,
        llBattle,
        toProv,
        ph,
        [c.player, toProv.owner].filter((x) => x != null),
        { actor: c.player },
      ); // item 5
      c.armies = (c.armies || []).filter((a) => !a._died && !a._disbanded);
      toProv._hadBattleThisTurn = true;
      if (llBattle.won) {
        _payWinPoint();
        const llSurv = erodeGuardSurvivors(
          turnContext,
          null,
          toProv,
          toProv.neutralDefenders || [],
          (line) =>
            emit(turnContext, {
              type: 'combat',
              text: line,
              audience: { actor: c.player, realms: [] },
              province: toProv.id,
            }),
          c.name,
        );
        toProv.neutralDefenders = llSurv;
        toProv.npcArmies = llSurv.length;
        toProv._leaderlessDefenders = llSurv.length > 0;
        if (llSurv.length > 0) {
          toProv._battleUnresolved = true;
          emit(turnContext, {
            type: 'combat',
            text: `💢 The leaderless garrison of ${toProv.name} refuses to yield — ${llSurv.length} unit${llSurv.length !== 1 ? 's' : ''} still contest the province!`,
            audience: { actor: c.player, realms: [], seen: 'battle' },
            province: toProv.id,
          });
        } else {
          setProvinceOwner(turnContext, toProv, c.player, c, ph);
          delete toProv._leaderlessDefenders;
          player.merits += toProv.tax;
          c.merits = (c.merits || 0) + toProv.tax;
          if (!player.provinces.includes(toProv.id)) player.provinces.push(toProv.id);
          emit(turnContext, {
            type: 'combat',
            text: `${c.name} overcomes the last of the leaderless defenders and claims ${toProv.name} for ${player.name}! (+${toProv.tax} merit)`,
            audience: { actor: c.player, realms: [], seen: 'battle' },
            province: toProv.id,
          });
          applyEvilConquest(turnContext, c, toProv, player);
        }
      } else {
        // Repelled by a garrison with no commander — back the way they came.
        toProv._leaderlessDefenders = (toProv.neutralDefenders || []).length > 0;
        toProv.characters = (toProv.characters || []).filter((id) => id !== c.id);
        prov.characters.push(c.id);
        c.location = prov.id;
        // rule: never zero remaining move points on a move-in/battle — the move already cost
        // its point; the rest of the turn’s budget stays.
        emit(turnContext, {
          type: 'combat',
          text: `Even without a commander, the garrison of ${toProv.name} throws ${c.name} back!`,
          audience: { actor: c.player, realms: [], seen: 'battle' },
          province: toProv.id,
        });
      }
      _moveLineLogged = true;
    } else if (toProv.owner === null && !neutralGuard) {
      // No active guard hero defends this province (its neutralDefenders array may still hold
      // stale intel, but the real defenders live on the guard hero — and there is none here).
      // Only armies can claim a province — a hero without troops cannot conquer
      if ((c.armies || []).length > 0) {
        setProvinceOwner(turnContext, toProv, c.player, c, ph);
        toProv.neutralDefenders = [];
        toProv.npcArmies = 0;
        delete toProv._leaderlessDefenders; // clear any stale intel now it's ours
        if (!player.provinces.includes(toProv.id)) player.provinces.push(toProv.id);
        if (!toProv.visitedBy.includes(c.player)) toProv.visitedBy.push(c.player);
        // (Exploration for this move already applied above at move-in — no extra bump here.)
        emit(turnContext, {
          type: 'move',
          text: `${c.name} claims ${toProv.name} for ${player.name}!`,
          audience: { actor: c.player, realms: [c.player], seen: 'there' },
          province: toProv.id,
        });
        _moveLineLogged = true;
      } else {
        emit(turnContext, {
          type: 'move',
          text: `${c.name} ventures into ${toProv.name} to explore — without armies at their back, they can only observe, not conquer.${_moveExplNote}`,
          audience: { actor: c.player, realms: [c.player] },
          province: toProv.id,
        });
        _moveLineLogged = true;
      }
    }
    // Generic "moves to" is only needed for a plain land move where nothing more descriptive
    // was logged. Sea moves ("moves across sea to…"), coastal landings, and claim/venture
    // lines already describe the move, so skip the redundant generic line in those cases.
    if (!coastalLanding && !enteringSea && !_moveLineLogged) {
      emit(turnContext, {
        type: 'move',
        text: `${c.name} moves to ${toProv.name}.${_moveExplNote}`,
        audience: { actor: c.player, realms: [c.player] },
        province: toProv.id,
      });
    }
  }
  // now that the move action has been reported, emit any discovery lines after it.
  if (_raidActive && c.alive !== false && toProv.owner === c.player && _raidPriorOwner !== c.player) {
    // NAVAL L9: the coastal raid took the province — plunder its treasury (2026-09-21: a raider slain in the landing plunders nothing)
    const _loot = Math.max(0, toProv.tax || 0);
    if (_loot > 0) {
      if (_raidPriorOwner != null && G.players[_raidPriorOwner])
        G.players[_raidPriorOwner].gold = Math.max(0, (G.players[_raidPriorOwner].gold || 0) - _loot);
      const _pl = G.players[c.player];
      if (_pl) _pl.gold = (_pl.gold || 0) + _loot;
      emit(turnContext, {
        type: 'move',
        text: `💰 ${c.name}'s coastal raid sacks ${toProv.name} — ${_loot}g plundered${_raidPriorOwner != null ? ` from ${G.players[_raidPriorOwner]?.name || 'the enemy'}` : ''}.`,
        audience: {
          actor: c.player,
          realms: [c.player].concat(_raidPriorOwner != null ? [_raidPriorOwner] : []),
          seen: 'there',
        },
        province: toProv.id,
      });
    }
  }
  // a commander slain in the battle this march led to reports nothing more this turn — the
  // "notices the Lost City" lines they earned on arrival are dropped rather than trailing
  // their own death (the exploration itself was already credited to the realm).
  if (c.alive) _discoveryLines.forEach(([msg, place]) => emit(turnContext, { type: 'explore', text: msg, ...place }));
  return;
}
