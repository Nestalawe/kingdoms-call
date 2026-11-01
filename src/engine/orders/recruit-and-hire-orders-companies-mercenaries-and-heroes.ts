import { KC_HUMANOID_RACES } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { ARMY_COST_MASTER } from '../army-tables.ts';
import {
  CREATURE_ARMIES,
  MONSTER_ARMIES,
  PRIMAL_SEA_TYPES,
} from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { beastCommandCount, beastCommandRoom, theBeastCommandAsALineTellsIt } from '../world/tables.ts';
import {
  alignDistP,
  heroHireWage,
  heroSkillWage,
} from '../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import { grantMithrilTo } from '../personal-combat/helpers.ts';
import { armyUnitName } from '../dice-and-army-names.ts';
import { TM, creditBeastUnit, perkTier } from '../titles/perks.ts';
import { orderCharRef } from '../heroes/charms-and-neutrals.ts';
import {
  applyPendingSynthPlan,
  discRecruitQChance,
  gdActive,
  isGarrisonUnitType,
  realmRecruitCost,
} from '../discoveries.ts';
import {
  doARealmsDiscoveriesWaiveTheHiringBan,
  whatARealmsDiscoveriesAddToAMercenaryBandsPrice,
} from '../rules/the-registry-of-discovery-effects.ts';
import { emit, notifyTarget, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from '../turn/events-and-their-audiences.ts';
import { refreshMovePool, setMovePool } from '../units/movement-pools.ts';
import { canRecruit, getRecruitLimit, recordRecruit } from '../units/recruit-limits.ts';
import { SKILLGAIN_COMMON, SKILLGAIN_STD, trySkillGain } from '../heroes/experience-skill-rises-and-earned-hp.ts';
import { resolveUnitGainInProvince } from '../battle/hosts-gained-in-a-province.ts';
import { asItsGuardReadsIt } from '../personal-combat/to-hit-wounds-stuns-and-courage.ts';
import { servesARealm } from './spells/what-an-action-spell-of-the-cast-spell-order-is-handed.ts';
import type {
  CompaniesRaisedAsTheLineCountsThem,
  TheFactOfTheRecruitAndHireOrdersLine,
  WhereTheCompaniesMuster,
  WhyACompanyWasNotRaised,
} from './the-facts-the-recruit-and-hire-orders-lines-record.ts';
import type { Army, Character, GameState, Province, Realm } from '../../schemas/saved-game-state.ts';
import type { TurnContext, TurnOrder } from '../turn/context.ts';

// ── THE RECRUIT AND HIRE ORDERS (plan P1-08j3: the third family taken out of processOrder in resolveTurn) ──
// Recruit Armies (companies raised in a province the realm holds, and mercenary bands hired where they roam) and Hire
// Hero (a wandering hero sworn where he stands), each once processOrder has read the order and checked he may act;
// and landHirePreOrders, which lands the hirer's pre-written orders for a hero once he is sworn (also the Broker's,
// in realm-works-orders-consecration-muster-broker-the-wild-and-grand-design.ts). Each takes the turn's context first
// (src/engine/turn/context.ts), then the values processOrder worked out before it that it reads, in the order
// processOrder declares them. Each body keeps processOrder's indent (plan P1-08's Decisions); a case-level break
// became a return.
// The humanoid races, as a Set: a recruit of any other race may raise the Druid skill of the hero it joins.
export const HUMANOID_RACES_SG: ReadonlySet<string> = new Set(KC_HUMANOID_RACES);
/** The orders a realm wrote for a hero it means to hire, held by the merge until the hire lands (each field compared
 *  as it is; the orders a list of the phases', with gaps). */
interface OrdersHeldForAHeroToBeHired {
  readonly heroId?: unknown;
  readonly viaId?: unknown;
  readonly player?: unknown;
  readonly orders?: (TurnOrder | null | undefined)[] | null | undefined;
}
/** The state as the hire's written orders read it: the heroes' orders for the turn (the saved state holds them
 *  cleared), and the turn's lists of the orders held for a hero a realm means to hire and the plans held for him. */
export type TheStateAsTheHireReadsIt = Omit<GameState, 'turnOrders'> & {
  turnOrders: Record<string, (TurnOrder | null | undefined)[] | undefined>;
  _pendingHireOrders?: readonly OrdersHeldForAHeroToBeHired[] | undefined;
  _pendingSynthPlans?: unknown;
};
/** The realm processOrder hands a hero of a realm: his own (every realm's index names a realm of the state), so there
 *  is one; for none, a TypeError. */
export function theRealmIsHanded(player: Realm | undefined): asserts player is Realm {
  if (!player) throw new TypeError('a hero of a realm is handed no realm');
}
/** The province processOrder hands a hero whose order resolves, the one he stands in: every living hero stands in a
 *  province of the map (the matrix's invariant "armies in real provinces"), so there is one; for none, a TypeError, as
 *  the first read of it throws. */
export function theProvinceIsHanded(prov: Province | undefined): asserts prov is Province {
  if (!prov) throw new TypeError("Cannot read properties of undefined (reading 'owner')");
}
/** A company's name as armyUnitName draws it: always one (a die's pick from a pool that is never empty, or a name it
 *  composes), though its type allows none; for none, a TypeError. */
export function theNameDrawn(name: string | undefined): string {
  if (name === undefined) throw new TypeError('armyUnitName drew no name');
  return name;
}
/** A skill held above 0, as the hire's line copies it (`v > 0`, as before: a level missing is not). */
function aLevelAboveNothing(skill: [string, number | undefined]): skill is [string, number] {
  return Number(skill[1]) > 0;
}
// ── HIRE PRE-ORDERS LAND (shared by Hire Hero and the Neutral BROKER hire) ────
// The hirer's pre-written orders are applied only once the hire has landed. Matched on hero + this
// realm (an exact match on the hiring character wins if two cards were somehow submitted), so a
// rival's pre-orders for the same hero are ignored. Phases are bounded by the ACTUAL hire phase,
// not the phase the player planned to hire in. 2026-09-23 (Toby item 4): the Broker hire never
// called this — since hire pre-orders became PENDING (09-21) a brokered hero's pre-written orders
// were silently dropped, his remaining phases were left empty, and his encounter plan was never
// set. Both paths now share this one function.
export function landHirePreOrders(
  turnContext: TurnContext,
  h: Character,
  c: Character,
  ph: number,
  player: Pick<Realm, 'name'>,
) {
  const { G }: { readonly G: TheStateAsTheHireReadsIt } = turnContext;
  // Matched on hero + this realm (an exact match on the hiring character wins if two cards
  // were somehow submitted), so a rival's pre-orders for the same hero are ignored. Phases are
  // bounded by the ACTUAL hire phase, not the phase the player planned to hire in — if the
  // hire slipped a phase, the orders for the phases he was not yet sworn are dropped.
  {
    const _ph = G._pendingHireOrders ?? [];
    const _pend =
      _ph.find((x) => x.heroId === h.id && x.player === c.player && x.viaId === String(c.id)) ??
      _ph.find((x) => x.heroId === h.id && x.player === c.player);
    let _applied = 0;
    if (_pend && Array.isArray(_pend.orders)) {
      const slots = G.turnOrders[h.id] ?? [null, null, null, null, null];
      _pend.orders.forEach((o, pi2) => {
        if (pi2 > ph && o?.action && o.action !== 'Defend' && o.action !== 'defend') {
          slots[pi2] = o;
          _applied++;
        }
      });
      G.turnOrders[h.id] = slots;
    }
    // Step 3 of order ingestion only defaults LIVING OWNED characters to Defend, and this
    // hero belonged to nobody when it ran, so his post-hire phases were left empty and he
    // simply did nothing (no watch) for the rest of the turn. Fill them in like everyone else
    // — the same closing step Resurrect and Charm already do.
    const fin = G.turnOrders[h.id] ?? [null, null, null, null, null];
    for (let pz = 0; pz < 5; pz++) {
      if (pz > ph && !fin[pz]) fin[pz] = { action: 'defend', target: '', extra: '', desc: 'Defend' };
    }
    G.turnOrders[h.id] = fin;
    applyPendingSynthPlan(G, h, c.player);
    if (_applied > 0)
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: 'a hired hero takes up the orders his hirer laid down',
          heroName: h.name,
          realmName: player.name,
          phasesLeft: _applied,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: h.id,
        phase: ph,
      });
  }
}
// Recruit Armies: mercenary bands hired where they roam, then companies raised in a province the realm holds, to the recruiter, a comrade or the garrison.
export function resolveRecruitArmiesOrder(
  turnContext: TurnContext,
  c: Character,
  ph: number,
  target: string,
  extra: string,
  prov: Province | undefined,
  player: Realm | undefined,
) {
  const { G, recruitedThisTurn } = turnContext;
  // Only a hero of a realm acts in a phase (actingThisPhase passes none without one, and Release Hero frees only the
  // hero who gives it, for the phases after), so he serves one, and processOrder hands him it and the province he
  // stands in; for none, a TypeError.
  if (!servesARealm(c)) throw new TypeError('a hero who serves no realm recruits');
  theRealmIsHanded(player);
  theProvinceIsHanded(prov);
  const ARMY_COST_P: Readonly<Partial<Record<string, number>>> = ARMY_COST_MASTER; // alias → master table at top of script
  // ── First: mercenary bands roaming this province ── The order form now lists mercenaries
  // alongside native units, tagged 'merc:<id>'. A single Recruit Armies order may therefore
  // mix the two, so mercenary tokens are consumed here and stripped from the list before
  // native recruitment runs on the remainder. (The older bare id / type / unitName tokens are
  // still accepted so orders saved by an earlier build resolve.)
  const mercsHere = (asItsGuardReadsIt(G.mercenaries) ?? []).filter((m) => m.location === c.location);
  let _rawSel = (target || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  // ── Recruit destination ── 'to:self' (default), 'to:garrison', or 'to:<charId>' (a
  // FRIENDLY character standing in this province this phase). The token may arrive in either
  // the target or the extra list; it is stripped before unit tokens are processed.
  const _destTok =
    (_rawSel.find((t) => t.startsWith('to:')) ?? '') ||
    (extra || '')
      .split(',')
      .map((t) => t.trim())
      .find((t) => t.startsWith('to:'));
  _rawSel = _rawSel.filter((t) => !t.startsWith('to:'));
  let _destChar: Character = c,
    _destGarrison = false,
    _destination: WhereTheCompaniesMuster | null = null; // where the companies muster, when not his own column: the prose says it (P1-12d6)
  if (_destTok && _destTok !== 'to:self') {
    if (_destTok === 'to:garrison') {
      if (prov.owner === c.player) {
        _destGarrison = true;
        _destination = { kind: 'the companies muster straight into the garrison', provinceName: prov.name };
      } else _destination = { kind: "the garrison is not the realm's to muster into" };
    } else {
      const _r = orderCharRef(G, _destTok.slice(3)); // plain id or pre-order hero
      if (_r?.alive && _r.player === c.player && _r.location === c.location) {
        _destChar = _r;
        _destination = { kind: "the companies muster under a comrade's banner", heroName: _r.name };
      } else _destination = { kind: 'the comrade named to receive the companies is not here' };
    }
  }
  const _autoGarr: string[] = []; // garrison-type recruits diverted from a character's column
  const _pushRecruit = (unit: Army) => {
    // GARRISON UNITS GO STRAIGHT TO THE GARRISON (2026-09-23c, Toby): a Human / Elven / Dwarf /
    // Orc Garrison unit never joins a column when recruited — it musters into the garrison of the
    // province it was raised in, whatever "Muster to" names (native recruiting already needs the
    // province to be ours). A character can still march it out with Pick Up Army.
    const _toGarr = _destGarrison || (isGarrisonUnitType(unit.type) && prov.owner === c.player);
    // Item 24 (2026-10-12): a beast recruited into a column already holding as many beasts as its leader's
    // Druid musters into the garrison instead (native beasts are raised only in a province the realm holds).
    const _overCmd =
      !_toGarr && prov.owner === c.player && beastCommandCount(unit) && beastCommandRoom(_destChar, G.characters) <= 0;
    if (_toGarr) {
      prov.garrisonArmies = asItsGuardReadsIt(prov.garrisonArmies) ?? [];
      prov.garrisonArmies.push(unit);
      if (!_destGarrison) _autoGarr.push(unit.type);
    } else if (_overCmd) {
      prov.garrisonArmies = asItsGuardReadsIt(prov.garrisonArmies) ?? [];
      prov.garrisonArmies.push(unit);
      emit(turnContext, {
        type: 'hire',
        fact: {
          kind: 'a beast a full column cannot take musters into the garrison',
          beastCommand: theBeastCommandAsALineTellsIt(_destChar, G.characters),
          unitName: unit.unitName || null,
          unitType: unit.type,
          provinceName: prov.name,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    } else {
      _destChar.armies = asItsGuardReadsIt(_destChar.armies) ?? [];
      _destChar.armies.push(unit);
    }
    // TITLE MERIT: Beastlord / Wildwarden. Credited to the RECRUITER `c`, not the recipient:
    // the merit is for finding and mustering the beast, and a hero who musters a griffon wing
    // and hands it straight to a colleague has still done the mustering. Garrison musters
    // count.
    creditBeastUnit(TM(c), unit, 1);
  };
  const _mercTokens = new Set<string>();
  let mHired = false;
  if (mercsHere.length > 0 && _rawSel.length > 0) {
    for (const merc of mercsHere) {
      const tok = _rawSel.find(
        (t) => t === `merc:${merc.id}` || t === merc.id || t === merc.type || t === merc.unitName,
      );
      if (!tok) continue;
      _mercTokens.add(tok);
      // Item 24: a mercenary beast is not hired into a full column where there is no garrison to take it.
      if (
        !_destGarrison &&
        prov.owner !== c.player &&
        beastCommandCount({ type: merc.type }) &&
        beastCommandRoom(_destChar, G.characters) <= 0
      ) {
        emit(turnContext, {
          type: 'hire',
          fact: {
            kind: 'mercenary beasts are not hired into a full column',
            beastCommand: theBeastCommandAsALineTellsIt(_destChar, G.characters),
            mercenaryName: merc.unitName || null,
            mercenaryType: merc.type,
          },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        });
        continue;
      }
      const baseMercCost = (ARMY_COST_P[merc.type] ?? 0) || 2;
      // Neutral alignment: mercenaries cost 2g less (min 1g)
      const mCost = Math.max(
        1,
        baseMercCost -
          (G.players[c.player]?.alignment === 'Neutral' ? 2 : 0) +
          whatARealmsDiscoveriesAddToAMercenaryBandsPrice(G.players[c.player], { theUnitsType: merc.type }),
      ); // + merc discoveries (the discoveries' registry's since plan P1-19ae: "orderOutcome: a realm's discoveries cut a
      // company's price", which the report's price asks too)
      if ((player.gold || 0) < mCost) {
        emit(turnContext, {
          type: 'hire',
          fact: {
            kind: 'a hero cannot afford a mercenary band',
            heroName: c.name,
            mercenaryName: merc.unitName || null,
            mercenaryType: merc.type,
            cost: mCost,
          },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
        continue;
      }
      player.gold -= mCost;
      _pushRecruit({ type: merc.type, quality: merc.quality, race: merc.race, unitName: merc.unitName });
      G.mercenaries = G.mercenaries.filter((m) => m.id !== merc.id);
      mHired = true;
      emit(turnContext, {
        type: 'hire',
        fact: {
          kind: 'a hero hires a mercenary band',
          heroName: c.name,
          mercenaryName: merc.unitName || null,
          mercenaryType: merc.type,
          quality: merc.quality,
          cost: mCost,
          baseCost: baseMercCost,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: c.location,
      });
    }
    if (mHired) {
      resolveUnitGainInProvince(turnContext, _destGarrison ? c : _destChar, prov, ph);
      if (!_destGarrison) refreshMovePool(turnContext, _destChar);
    } // mercenaries joined a column — recompute its pace
  }
  // Whatever is left of the order after the mercenary tokens are removed is native
  // recruitment. a 'to:' destination token that arrived in `extra` must never be parsed as a
  // unit type (it produced a spurious "to:garrison (not raised in …)" block note).
  const _extraClean = (extra || '')
    .split(',')
    .map((s) => s.trim())
    .filter((t) => t && !t.startsWith('to:'))
    .join(',');
  const _nativeSel = (
    _extraClean ||
    _rawSel.filter((t) => !_mercTokens.has(t) && !t.startsWith('merc:')).join(',') ||
    (mHired ? '' : 'Shieldwall Levies|1')
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (_nativeSel.length === 0) return; // mercenaries only — nothing further to raise
  // Native army recruitment requires CONTROL of the province — you cannot raise local troops
  // in land you merely scouted or passed through. (Mercenaries, handled above, can be hired
  // wherever they roam.) Conquering a province this turn sets prov.owner, so that counts.
  const isOwned = prov.owner === c.player;
  if (!isOwned) {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'a hero cannot recruit in a province his realm does not hold',
        heroName: c.name,
        provinceName: prov.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const selections = _nativeSel;
  let totalCost = 0;
  const recruited: CompaniesRaisedAsTheLineCountsThem[] = [];
  const blocked: WhyACompanyWasNotRaised[] = [];

  for (const sel of selections) {
    const [armyType, qtyStr] = sel.split('|');
    if (armyType === undefined) throw new TypeError('a split holds no first part'); // never: a split holds one at least
    // A mercenary token that reached this far is stale (the band was already hired or has
    // moved on) — it must never be treated as a native army type, or it spawns a phantom "the
    // Guard (merc:merc_…, Average)" unit.
    if (armyType.startsWith('merc:') || armyType.startsWith('merc_')) continue;
    const qty = parseInt(String(qtyStr)) || 1;
    // Primal sea beasts are called out of deep water — they can only be raised in a sea
    // province, never on a coast. (Fleets remain recruitable wherever the province offers
    // them.)
    if (PRIMAL_SEA_TYPES.has(armyType) && prov.terrain !== 'sea') {
      blocked.push({ kind: 'a sea beast can be summoned only in a sea province', type: armyType });
      continue;
    }
    // the ordered type must actually be OFFERED by the province the character is standing in
    // AT RESOLUTION. Orders are set against a predicted location, but a battle can end the
    // phase somewhere else — without this guard a character shoved into a different province
    // would still raise units that province never offered. armyTypes is the province's own
    // recruitable list (racial field units + its garrison).
    if (!(asItsGuardReadsIt(prov.armyTypes) ?? []).includes(armyType)) {
      blocked.push({ kind: 'the province does not raise the unit', type: armyType, provinceName: prov.name });
      continue;
    }
    // Check turn-wide recruit limit
    if (!canRecruit(turnContext, armyType, prov.id, prov, c.player)) {
      blocked.push({ kind: 'the unit was already recruited this turn', type: armyType });
      continue;
    }
    const limit = getRecruitLimit(turnContext, armyType, prov, c.player);
    const alreadyDone = Number(recruitedThisTurn[`${String(prov.id)}:${armyType}`]) || 0;
    const actualQty = Math.min(qty, limit - alreadyDone);
    let _unitCost = realmRecruitCost(G.players[c.player], armyType, (ARMY_COST_P[armyType] ?? 0) || 2); // sd16 + recruitCost discoveries
    if (perkTier(c, 'druid') > 0 && (CREATURE_ARMIES.has(armyType) || MONSTER_ARMIES.has(armyType)))
      _unitCost = Math.floor(_unitCost * 0.5); // DRUID L6: creatures/monsters cost half (rounded down)
    const unitCost = _unitCost;
    const cost = actualQty * unitCost;
    if ((player.gold || 0) < totalCost + cost) {
      blocked.push({ kind: 'the treasury cannot pay for the unit', type: armyType, cost });
      continue;
    }
    totalCost += cost;
    for (let q = 0; q < actualQty; q++) {
      // sd01 Superior Forging: recruited armies start at Veteran
      const startQuality =
        (gdActive(turnContext, c.player, 'Druidic') &&
          (CREATURE_ARMIES.has(armyType) || MONSTER_ARMIES.has(armyType))) ||
        kcRng() < discRecruitQChance(G.players[c.player], armyType)
          ? 'Veteran'
          : 'Average'; // GRAND DESIGN Druidic; recruitQ discoveries (sd01 Superior Forging …) roll per unit
      // Whale Cohorts and Shark Shoals are wild sea beasts — always the Primal race, whoever raises them.
      const recruitRace =
        armyType === 'Whale Cohort' || armyType === 'Shark Shoals' ? 'Primal' : (prov.race ?? '') || 'Human';
      _pushRecruit({
        type: armyType,
        quality: startQuality,
        race: recruitRace,
        unitName: theNameDrawn(armyUnitName(armyType)),
      });
      if (!HUMANOID_RACES_SG.has(recruitRace) && !_destGarrison)
        trySkillGain(turnContext, _destChar, 'druid', SKILLGAIN_STD); // Druid: led a non-humanoid recruit
      else if (CREATURE_ARMIES.has(armyType) || MONSTER_ARMIES.has(armyType))
        trySkillGain(turnContext, _destGarrison ? c : _destChar, 'druid', SKILLGAIN_COMMON); // 2026-09-21: any primal recruit (incl. into a garrison) — small chance for the recruiter
    }
    recordRecruit(turnContext, armyType, prov.id, actualQty);
    recruited.push({ count: actualQty, type: armyType });
  }
  if (recruited.length > 0) {
    player.gold -= totalCost;
    emit(turnContext, {
      type: 'hire',
      fact: {
        kind: 'a hero recruits companies',
        heroName: c.name,
        recruited: recruited.map((r) => ({ ...r })),
        provinceName: prov.name,
        destination: _destination,
        autoGarrisoned: _autoGarr.length,
        cost: totalCost,
        treasury: player.gold,
        blocked: blocked.map((b) => ({ ...b })),
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    // if the muster went to ANOTHER of the player's characters, notify them in their section.
    if (!_destGarrison && _destChar.id !== c.id)
      notifyTarget(
        turnContext,
        _destChar,
        {
          kind: "companies muster to a comrade's banner",
          recruited: recruited.map((r) => ({ ...r })),
          recipientName: _destChar.name,
          provinceName: prov.name,
          heroName: c.name,
        },
        ph,
        'hire',
      );
    // Newly-mustered units join the destination character's column — recompute their pace (a
    // slow recruit can only reduce it), preserving points already spent. Garrison musters
    // don't march.
    if (!_destGarrison) refreshMovePool(turnContext, _destChar);
  } else {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: "a hero's recruitment is entirely blocked",
        heroName: c.name,
        provinceName: prov.name,
        blocked: blocked.map((b) => ({ ...b })),
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
  }
  return;
}
// Hire Hero: a wandering hero where the hirer stands, for a wage set by the distance between their alignments.
export function resolveHireHeroOrder(
  turnContext: TurnContext,
  c: Character,
  ph: number,
  target: string,
  prov: Province | undefined,
  player: Realm | undefined,
) {
  const { G, SEASONS }: Pick<TurnContext, 'SEASONS'> & { readonly G: TheStateAsTheHireReadsIt } = turnContext;
  // Only a hero of a realm acts in a phase, and processOrder hands him his realm and his province (as for a Recruit);
  // for none, a TypeError.
  if (!servesARealm(c)) throw new TypeError('a hero who serves no realm hires');
  theRealmIsHanded(player);
  theProvinceIsHanded(prov);
  // resolve the hero by id, not by array position (defensive — the id==index invariant holds
  // today, but a positional lookup would silently hire the WRONG hero if it ever broke).
  const heroId = parseInt(target);
  const h = Number.isInteger(heroId)
    ? ((asItsGuardReadsIt(G.characters) ?? []).find((x: Character | null | undefined) => x?.id === heroId) ?? null)
    : null;
  // the dead take no actions: a wanderer slain earlier in the turn is none to be hired (P1-23b)
  if (h?.player !== null || !h.alive || h.location !== c.location) {
    emit(turnContext, {
      type: 'hire',
      fact: { kind: 'no hero of that description is to be hired here', heroName: c.name, provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (h._isNeutralGuard) {
    emit(turnContext, {
      type: 'hire',
      fact: {
        kind: "a neutral province's guardian cannot be hired away",
        guardianName: h.name,
        provinceName: prov.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (h._justDefeated) {
    emit(turnContext, {
      type: 'hire',
      fact: { kind: 'a hero driven from his home refuses to be hired this turn', heroName: h.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (h._releasedTurn === G.turn) {
    emit(turnContext, {
      type: 'hire',
      fact: { kind: 'a hero just released from service hears no offers this turn', heroName: h.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  // ── Alignment-distance wages ── replaces the old race-based 2g/3g system. Wage = 2g + 1g
  // per 2 steps between the hero's alignment and the hiring KINGDOM's alignment on the
  // Divine…Undead spectrum. Divine realms cannot hire Undead heroes and vice versa (distance
  // 6) — unless sd31 Diplomatic Protocols waives the ban (at 5g).
  const kingdomAlign = (G.players[c.player]?.alignment ?? '') || 'Neutral';
  // (the discoveries' registry's since plan P1-19ae: "orderValidity: a realm's discoveries waive the hiring ban")
  const _waiveBan = doARealmsDiscoveriesWaiveTheHiringBan(G.players[c.player]);
  const hireWage = heroHireWage(kingdomAlign, h.alignment, _waiveBan, h); // (a wanderer's, the check above made sure)
  if (hireWage == null) {
    emit(turnContext, {
      type: 'hire',
      fact: {
        kind: 'a hero recoils from a hire across the gulf between Divine and Undead',
        heroName: h.name,
        alignment: h.alignment,
        hirerName: c.name,
        realmIsDivine: kingdomAlign === 'Divine',
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if ((player.gold || 0) < hireWage) {
    emit(turnContext, {
      type: 'hire',
      fact: {
        kind: 'a hero cannot afford to hire another',
        heroName: c.name,
        hiredName: h.name,
        wage: hireWage,
        treasury: player.gold,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  h.pay = hireWage;
  // remember the ALIGNMENT part of the bargain (wage minus the skill premium). recalcHeroPay
  // rebuilds the wage from skills whenever the hero improves in service, and without this the
  // alignment premium a Divine crown paid for an Undead sword would vanish on their first
  // skill rise.
  h._hireAlignWage = Math.max(1, hireWage - heroSkillWage(h));
  player.gold -= hireWage;
  h.player = c.player;
  h.name = h.name.replace(' (wandering)', '');
  if (h.race === 'Dwarven' && G.players[c.player]?.race === 'Dwarven') grantMithrilTo(h, G); // mithril on hire into a dwarf realm
  player.heroes = asItsGuardReadsIt(player.heroes) ?? [];
  player.heroes.push(h.id);
  // Hero can receive orders starting the phase AFTER they were hired (AK 3.5) We mark the
  // hire phase so the turn report knows which phases they can act in
  h.hiredInPhase = ph;
  const hiredsId = h.id; // (a plain name as the key: the compiler sees his orders made sure below)
  G.turnOrders[hiredsId] ??= [null, null, null, null, null];
  // Default unfilled phases (before hire) to a "not yet hired" placeholder
  for (let p2 = 0; p2 <= ph; p2++)
    G.turnOrders[hiredsId][p2] = G.turnOrders[hiredsId][p2] ?? {
      action: 'defend',
      target: '',
      extra: '',
      desc: '(not yet hired)',
    };
  // ── 2026-09-21: the hirer's pre-written orders are applied HERE, now the hire has landed.
  // (2026-09-23: moved into landHirePreOrders so the Neutral BROKER hire applies them too.)
  landHirePreOrders(turnContext, h, c, ph, player);
  setMovePool(turnContext, h); // give the newly hired hero a movement pool for this turn (item: hired heroes had 0 MP)
  const _aDist = alignDistP(kingdomAlign, h.alignment);
  // Both hire paths now say which it is.
  // the hire's line, filed twice (the prose writes it): his skills above 0, copied as the line is told
  const _hireFact: Extract<TheFactOfTheRecruitAndHireOrdersLine, { kind: 'a hero agrees to serve the realm' }> = {
    kind: 'a hero agrees to serve the realm',
    heroName: h.name,
    race: h.race,
    alignment: h.alignment,
    realmName: player.name,
    wage: h.pay,
    alignmentSteps: _aDist,
    skills: Object.entries(asItsGuardReadsIt(h.skills) ?? {}).filter(aLevelAboveNothing),
    seasonTheyMayActFrom: (SEASONS[ph + 1] ?? '') || null,
  };
  emit(turnContext, {
    type: 'hire',
    fact: _hireFact,
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  // also file the same line under the HIRED hero's own Chronicle section, at the hire phase,
  // so their section opens by explaining when and how they entered service.
  emit(turnContext, {
    type: 'hire',
    fact: _hireFact,
    audience: { actor: c.player, realms: [c.player] },
    province: prov.id,
    hero: h.id,
    phase: ph,
  });
  return;
}
