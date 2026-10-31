import { KC_UNIT_CLASS, SAGE_DISCOVERIES_P } from '../content/kingdoms-call-data.ts';
import type {
  TheEffectOfADiscovery,
  ADiscoverysRow,
} from '../content/discovery-effects-their-kinds-numbers-and-words.ts';
import {
  DISC_BY_ID,
  aRealmsDiscoveriesLetABeastFollowWithoutItsDruid,
  theEffectsOfAKindARealmHolds,
  theFactorARealmsDiscoveriesMultiplyExploringBy,
  theFactorARealmsDiscoveriesStrengthenAUnitBy,
  theMultiplierARealmsDiscoveriesLeaveOnABeatenUnitsDeath,
  whatARealmsDiscoveriesAddToAUnitsPromotion,
  type ARealmAsTheDiscoveriesReadIt,
} from './rules/the-registry-of-discovery-effects.ts';
import {
  DISC_CLS_SETS,
  discUnitMatch,
  type AUnitAsTheDiscoveriesReadIt,
} from './rules-on-plain-values/units-a-discoverys-effect-reaches-by-type-class-race-and-quality.ts';
import { gdActiveFor, homeFounderOf } from './grand-design.ts';
import { getNeighborsP } from './world/map-helpers.ts';
import type { TurnContext } from './turn/context.ts';
import type { Army, Character, Province } from '../schemas/saved-game-state.ts';

// Its types (plan P1-10b8): a discovery's effect has one shape, TheEffectOfADiscovery (since plan P1-19aa in
// src/content/discovery-effects-their-kinds-numbers-and-words.ts, beside the kinds the registry holds), which discEffectsOf,
// discEff and every hook below hand their readers. A value the body guards (`pl &&`, `|| []`, `|| 0`) is typed as wide as
// the guard, so each guard stays (plan P1-10b's Decision 3), though a state the turn hands always holds it.
/** The fields of an effect that hold a number: what discSumOf adds up and discParam reads. */
type ANumberFieldOfAnEffect = {
  [F in keyof TheEffectOfADiscovery]-?: NonNullable<TheEffectOfADiscovery[F]> extends number ? F : never;
}[keyof TheEffectOfADiscovery];
/** What each capped effect has paid (or saved) so far this collection: a Map, one per realm per collection. */
interface WhatEachCappedEffectHasPaid {
  get(effect: TheEffectOfADiscovery): number | undefined;
  set(effect: TheEffectOfADiscovery, paid: number): unknown;
}
/** A province's place and ground, which discProvCoastal reads. */
type AProvinceOnTheMap = Pick<Province, 'row' | 'col' | 'terrain'>;
/** The map as discProvCoastal reads it. */
interface TheMapAsTheDiscoveriesReadIt {
  readonly world?: {
    readonly cols: number;
    readonly rows: number;
    readonly provinces: readonly (AProvinceOnTheMap | null | undefined)[];
  } | null;
}
/** The state as the tax discoveries read it: the map, and the realms' homes (homeFounderOf's). */
type TheStateAsTheTaxDiscoveriesReadIt = TheMapAsTheDiscoveriesReadIt &
  NonNullable<Parameters<typeof homeFounderOf>[0]>;
/** A province as the tax discoveries read it: its garrison guarded. */
type AProvinceAsTheTaxDiscoveriesReadIt = AProvinceOnTheMap &
  Pick<Province, 'id' | 'tax' | 'race'> & { readonly garrisonArmies?: readonly unknown[] | null | undefined };

// ── RESOLVE TURN — FULL INLINE ENGINE ────
// This is a self-contained turn resolver embedded directly in the portal. It processes all 5 phases
// for all characters, resolves actions, updates the game state, generates new turn reports, and
// pushes everything to Supabase.

// fields of study a player can never choose or see listed — found only as a side result of
// researching any other field (see case 'research').
export const RESEARCH_HIDDEN_CATS = new Set(['Heroic', 'Special']);
// the odds of an unlooked-for find in a HIDDEN field (Heroic / Special), expressed against the
// character's ordinary Sage discovery chance. Divisor 5 with a 10% ceiling.
export const HIDDEN_DISCOVERY_DIVISOR = 5;
export const HIDDEN_DISCOVERY_CAP_PCT = 10;
// ── RESEARCH CHOICE (2026-09-21, Toby) ── a successful Research order no longer hands over one random
// discovery: it turns up TWO in the chosen field, held on the realm as a pending choice
// (`pl.pendingDiscoveryChoices`: {key, turn, charId, charName, category, options:[id,id]}). In the
// NEXT turn's orders the player keeps one; the other is FORGOTTEN for good (`pl.forgottenDiscoveries`,
// ids) and never comes up again from Research, a Breakthrough or the Grand Library. No choice sent
// (bots, or a player who left it blank) → one is kept at random. Options awaiting a choice are also
// withheld from every other roll, so the same discovery is never offered twice at once.
export function discBlockedIds(pl: ARealmAsTheDiscoveriesReadIt | null | undefined) {
  const s = new Set((pl?.forgottenDiscoveries ?? []).map(String));
  (pl?.pendingDiscoveryChoices ?? []).forEach((p) => {
    (p?.options ?? []).forEach((id) => s.add(String(id)));
  });
  return s;
}
// ── Discovery eligibility & generic effect readers ────
// Race/alignment discoveries carry `race` / `alignment`; a realm can only research, breakthrough,
// Grand-Library or steal (spy) a discovery it is eligible for. Their effects are data-driven
// (`effect.kind`) and read through discEffectsOf / discSumOf at the relevant engine hooks. The table of the
// discoveries by id is the discoveries' registry's (plan P1-19aa), which finds a realm's effects of a kind by it.
export { DISC_BY_ID };
export function discEligible(
  d: Pick<ADiscoverysRow, 'race' | 'alignment'> | null | undefined,
  pl: ARealmAsTheDiscoveriesReadIt | null | undefined,
) {
  if (!d) return false;
  if (d.race && pl?.race !== d.race) return false;
  if (d.alignment && pl?.alignment !== d.alignment) return false;
  return true;
}
// 2026-09-21 rebalance: a discovery may carry a SECOND, smaller effect (`effect2`) — used by the
// Espionage and exploration discoveries whose single lever was too weak on its own. Both are read
// through the same generic hooks, so every effect below applies to either slot.
// (The rule is the discoveries' registry's since plan P1-19aa: theEffectsOfAKindARealmHolds.)
export function discEffectsOf(
  pl: ARealmAsTheDiscoveriesReadIt | null | undefined,
  kind: string,
): TheEffectOfADiscovery[] {
  return theEffectsOfAKindARealmHolds(pl, kind);
}
// Tunable magnitude of a discovery still wired by id (its row in SAGE_DISCOVERIES_P holds the number).
export function discParam(id: string, field: ANumberFieldOfAnEffect, dflt: number) {
  const d = DISC_BY_ID[id];
  const v = d?.effect ? d.effect[field] : undefined;
  return v ?? dflt;
}
// sd14 Taxation Records: +pct% of province income (integer maths, rounded down), capped.
export function taxRecordsGold(income: number | null | undefined, capG: number | null | undefined) {
  const pc = Math.round(discParam('sd14', 'pct', 0.05) * 100);
  const raw = Math.floor(((Number(income) || 0) * pc) / 100);
  return Math.min(capG ?? discParam('sd14', 'max', 99), raw);
}
// ── TAX-BONUS CEILING (Toby 2026-09-24) ─────────────────────────────────────────────────────
// No single source of extra TAX INCOME may pay more than 5% of the realm's BASE tax income — the
// bare sum of its provinces' tax, before consecration, Bless, enslavement, earthquakes, discoveries
// or anything else. It binds each province-tax discovery, Taxation Records, and the magic items
// that pay tax gold (their combined total). Always at least 1g, so a small realm still gains.
export const TAX_BONUS_CAP_PCT = 0.05;
export function realmBaseTax(
  gs:
    | {
        readonly world?: {
          readonly provinces?: readonly (Pick<Province, 'owner' | 'tax'> | null | undefined)[] | null;
        } | null;
      }
    | null
    | undefined,
  pi: number,
): number {
  const provs = gs?.world?.provinces ?? [];
  return provs.reduce((s, pv) => s + (pv?.owner === pi ? pv.tax || 0 : 0), 0);
}
export function taxBonusCap(baseTax: number | null | undefined) {
  return Math.max(1, Math.floor((Number(baseTax) || 0) * TAX_BONUS_CAP_PCT));
}
// Magic items that pay tax gold (`taxBonus` flat, `taxPerProv` per province) share ONE ceiling:
// the flat bonuses are paid first, the per-province gold fills whatever is left.
export function capItemTaxGold(
  taxBonus: number | null | undefined,
  perProvBonus: number | null | undefined,
  capG: number,
) {
  const flat = Math.min(Number(taxBonus) || 0, capG);
  const perProv = Math.min(Number(perProvBonus) || 0, Math.max(0, capG - flat));
  return {
    taxBonus: flat,
    perProvBonus: perProv,
    cut: (Number(taxBonus) || 0) + (Number(perProvBonus) || 0) - (flat + perProv),
  };
}
// Does a `tax` effect pay on this province? Filters: minTax / maxTax (the province's own tax),
// terrains, race (the province's folk), ownRace / foreign (folk of / not of the king's race),
// coastal, garrisoned, home (the realm's founding capital).
export function discTaxMatch(
  e: TheEffectOfADiscovery,
  pv: AProvinceAsTheTaxDiscoveriesReadIt,
  gs: TheStateAsTheTaxDiscoveriesReadIt | null | undefined,
  pi: number | null | undefined,
  pl: ARealmAsTheDiscoveriesReadIt | null | undefined,
) {
  const t = pv.tax || 0;
  if (e.minTax != null && t < e.minTax) return false;
  if (e.maxTax != null && t > e.maxTax) return false;
  if (e.terrains && !e.terrains.includes(pv.terrain)) return false;
  if (e.race && pv.race !== e.race) return false;
  if (e.ownRace && !(pl && pv.race && pv.race === pl.race)) return false;
  if (e.foreign && !(pl && pv.race && pv.race !== pl.race)) return false;
  if (e.coastal && !discProvCoastal(gs, pv)) return false;
  if (e.garrisoned && !((pv.garrisonArmies ?? []).length > 0)) return false;
  if (e.home && homeFounderOf(gs, pv.id) !== pi) return false;
  return true;
}
// Module-level coastal test for the discovery helpers (provIsCoastal itself lives inside runTurn's
// scope, so the report builder cannot call it). Same rule: a land province with a sea neighbour.
export function discProvCoastal(
  gs: TheMapAsTheDiscoveriesReadIt | null | undefined,
  pv: AProvinceOnTheMap | null | undefined,
) {
  if (!gs?.world || !pv || pv.terrain === 'sea') return false;
  return getNeighborsP(pv, gs.world.cols, gs.world.rows, gs.world.provinces).some((n) => n.terrain === 'sea');
}
// Per-province `tax` discovery gold. `acc` (a Map, one per realm per collection) tracks what each
// capped effect (`max`) has already paid this turn, so a capped discovery never pays more than its
// ceiling however large the realm grows. Shared by the collector and the report forecast.
export function discTaxAdd(
  pl: ARealmAsTheDiscoveriesReadIt | null | undefined,
  pv: AProvinceAsTheTaxDiscoveriesReadIt,
  gs: TheStateAsTheTaxDiscoveriesReadIt | null | undefined,
  pi: number | null | undefined,
  acc: WhatEachCappedEffectHasPaid,
  capG: number | null | undefined,
) {
  let add = 0;
  discEffectsOf(pl, 'tax').forEach((e) => {
    if (!discTaxMatch(e, pv, gs, pi, pl)) return;
    let b = e.bonus ?? 0;
    // every province-tax discovery is capped: at `capG` (5% of the realm's base tax income) and, if
    // its row still carries a fixed `max`, at that too. `acc` tracks what each effect has paid.
    const lim = capG != null ? Math.min(capG, e.max ?? capG) : e.max;
    if (lim != null) {
      const u = Number(acc.get(e)) || 0;
      b = Math.max(0, Math.min(b, lim - u));
      acc.set(e, u + b);
    }
    add += b;
  });
  return add;
}
// `upkeep` discoveries: the wage of one army after every matching cut (minimum 1g per unit). The
// per-turn ceiling on what a single upkeep discovery may save is now the SAME 5%-of-base-income cap
// the tax discoveries use (2026-09-26, Toby): `capG` replaces whatever fixed `max` the row carried,
// so Goblin Warrens' old flat 1g becomes 5% of the realm's base tax income and grows with the realm.
// `acc` tracks what each capped effect has already saved this turn.
// It hands back the wage `w` it is given when there is no realm, no unit or a skeleton.
export function discUpkeepWage(
  pl: ARealmAsTheDiscoveriesReadIt | null | undefined,
  a: AUnitAsTheDiscoveriesReadIt | null | undefined,
  w: number,
  acc: WhatEachCappedEffectHasPaid,
  capG: number | null | undefined,
): number {
  if (!pl || !a || a._isSkeletal) return w;
  let out = w;
  discEffectsOf(pl, 'upkeep').forEach((e) => {
    if (!discUnitMatch(e, a)) return;
    let cut = Math.min(-(e.delta ?? 0), out - 1);
    if (cut <= 0) return;
    const lim = capG ?? e.max;
    if (lim != null) {
      const u = Number(acc.get(e)) || 0;
      cut = Math.min(cut, lim - u);
      if (cut <= 0) return;
      acc.set(e, u + cut);
    }
    out -= cut;
  });
  return out;
}
// Hero wage after discoveries: `heroWage` cuts (optionally only for heroes of given alignments) then
// the `heroWageCap` ceiling. Minimum 1g. Both are capped per turn at `capG` (5% of base income).
export function discHeroWage(
  pl: ARealmAsTheDiscoveriesReadIt | null | undefined,
  h: Pick<Character, 'alignment'>,
  raw: number,
  acc: WhatEachCappedEffectHasPaid,
  capG: number | null | undefined,
) {
  let w = raw;
  discEffectsOf(pl, 'heroWage').forEach((e) => {
    if (e.heroAlign && !e.heroAlign.includes(h.alignment)) return;
    let cut = Math.min(e.amount ?? 0, w - 1);
    if (cut <= 0) return;
    const lim = capG ?? e.max;
    if (lim != null) {
      const u = Number(acc.get(e)) || 0;
      cut = Math.min(cut, lim - u);
      if (cut <= 0) return;
      acc.set(e, u + cut);
    }
    w -= cut;
  });
  discEffectsOf(pl, 'heroWageCap').forEach((e) => {
    if (e.cap == null || w <= e.cap) return;
    let cut = w - Math.max(1, e.cap);
    const lim = capG ?? e.max;
    if (lim != null) {
      const u = Number(acc.get(e)) || 0;
      cut = Math.min(cut, lim - u);
      if (cut <= 0) return;
      acc.set(e, u + cut);
    }
    w -= cut;
  });
  return Math.max(1, w);
}
// `maxHp` discoveries for one character (filters: king, heroOnly, skill — at least one trained level).
export function discMaxHpFor(
  pl: ARealmAsTheDiscoveriesReadIt | null | undefined,
  ch:
    | {
        readonly isKing?: boolean | null;
        readonly skills?: Readonly<Partial<Record<string, number>>> | null;
      }
    | null
    | undefined,
) {
  if (!pl || !ch) return 0;
  const levels: Readonly<Partial<Record<string, number>>> = ch.skills ?? {};
  return discSumOf(
    pl,
    'maxHp',
    'hp',
    (e) => (!e.king || !!ch.isKing) && (!e.heroOnly || !ch.isKing) && (!e.skill || (levels[e.skill] ?? 0) >= 1),
  );
}
// Chance (0..1) that a newly raised unit of this type starts one tier higher (`recruitQ`).
export function discRecruitQChance(pl: ARealmAsTheDiscoveriesReadIt | null | undefined, armyType: string) {
  return Math.min(
    1,
    discSumOf(pl, 'recruitQ', 'pct', (e) => discUnitMatch(e, armyType, true)),
  );
}
// Per-terrain explore multiplier from `explore` discoveries (shipped in the report so the player
// portal's preview no longer parses description text).
export function discExploreMult(pl: ARealmAsTheDiscoveriesReadIt | null | undefined, terrain: string) {
  // (the discoveries' registry's since plan P1-19ad: "orderOutcome: a realm's discoveries add to exploring", the rule
  // the Explore order reads)
  return theFactorARealmsDiscoveriesMultiplyExploringBy(pl, { theGround: terrain });
}
export function discSumOf(
  pl: ARealmAsTheDiscoveriesReadIt | null | undefined,
  kind: string,
  field: ANumberFieldOfAnEffect,
  pred?: ((e: TheEffectOfADiscovery) => boolean) | null,
) {
  let s = 0;
  discEffectsOf(pl, kind).forEach((e) => {
    if (!pred || pred(e)) s += e[field] ?? 0;
  });
  return s;
}
// Garrison units always muster into the province garrison when recruited (2026-09-23c, Toby).
export function isGarrisonUnitType(t: string) {
  return DISC_CLS_SETS.garrison.has(t);
}
// Realm-level recruit cost of one unit: sd16 Shipbuilding (fleets half, rounded up) then the race /
// alignment `recruitCost` discoveries (delta, then factor; minimum 1g). Per-character reductions
// (Druid L6 half-price beasts) are applied by the engine on top. Used by the engine AND the report
// builders so the player portal's recruit preview shows the realm's real price.
export const _FLEET_TYPES_DISC = new Set(KC_UNIT_CLASS.carrier);
export function realmRecruitCost(
  pl: ARealmAsTheDiscoveriesReadIt | null | undefined,
  armyType: string,
  baseCost: number | null | undefined,
) {
  let c = Number(baseCost) || 2; // sd16 Shipbuilding is now an ordinary `recruitCost` factor effect (cls fleet)
  discEffectsOf(pl, 'recruitCost').forEach((e) => {
    if (!discUnitMatch(e, armyType, true)) return;
    if (e.delta) c += e.delta;
    if (e.factor) c = Math.ceil(c * e.factor);
  });
  return Math.max(1, c);
}

// Spells available in encounters as CA tactic (subset of above)

// opts.auto — called by the auto-turn watcher: no confirm dialog, status goes to the watcher banner
// opts.game — the game row to run (defaults to currentGame); the watcher may run a game the GM
// isn't viewing
// ── PENDING SYNTHETIC ENCOUNTER PLANS (2026-09-21) ────
// A pre-order card for a hero a realm only INTENDS to take into service (hired_/resurrect_/charm_)
// carries an encounter plan as well as orders. The plan used to be written onto the real character
// at ingestion, so a player who lost the race — or never landed the cast at all — still set that
// hero's combat stance, and an encounter plan PERSISTS from turn to turn. Plans on synthetic cards
// are now held here and applied only inside the branch where the hero actually enters service.
export function applyPendingSynthPlan(
  G: { readonly _pendingSynthPlans?: unknown } | null | undefined,
  hero: { readonly id?: unknown; encounterPlan?: unknown } | null | undefined,
  pi: number | null | undefined,
) {
  // the plans held (the turn's own: made at the merge, thrown away at the turn's end), each as the merge kept it
  const isAListOfHeldPlans = (
    l: unknown,
  ): l is readonly ({ readonly heroId?: unknown; readonly player?: unknown; readonly plan?: unknown } | null)[] =>
    Array.isArray(l);
  if (!G || !hero || !isAListOfHeldPlans(G._pendingSynthPlans)) return false;
  const p = G._pendingSynthPlans.find((x) => x && x.heroId === hero.id && x.player === pi && x.plan);
  if (!p) return false;
  hero.encounterPlan = p.plan;
  return true;
}

// ── LIFTED OUT OF resolveTurn (plan P1-08a) ── the discovery helpers, and _isHumanoidRace (the Plague's victims). Each
// takes the turn's context first (src/engine/turn/context.ts), but _isHumanoidRace, which reads none
// (discFanaticApplies, and discoveryArmyBonus's body, are the discoveries' registry's since plan P1-19aa; discDuelVs's
// rule, since P1-19ac).
// ── DISCOVERY EFFECT HELPERS ────
// Returns true if player has a specific discovery
export function hasDisc(turnContext: Pick<TurnContext, 'G'>, playerIdx: number, discId: string) {
  const { G } = turnContext;
  return (G.players[playerIdx]?.discoveries ?? []).some((d) => d.id === discId);
}
export function gdActive(turnContext: Pick<TurnContext, 'G'>, playerIdx: number, align: string | null | undefined) {
  const { G } = turnContext;
  return gdActiveFor(G, playerIdx, align);
}
// sd40 Dragon Taming: true when this commander's realm leads this winged beast without Druid
// penalty.
export function dragonTamed(
  turnContext: Pick<TurnContext, 'G'>,
  heroChar: Pick<Character, 'player'> | null | undefined,
  army: Pick<Army, 'type'> | null | undefined,
) {
  // (the discoveries' registry's since plan P1-19aa: "strength: a realm's discoveries let a beast follow without its
  // Druid")
  const { G } = turnContext;
  return !!(
    heroChar?.player != null &&
    army &&
    aRealmsDiscoveriesLetABeastFollowWithoutItsDruid(G.players[heroChar.player], { theUnitsType: army.type })
  );
}
// data-driven discovery effects (race / alignment discoveries).
export function discEff(
  turnContext: Pick<TurnContext, 'G'>,
  pi: number | null | undefined,
  kind: string,
): TheEffectOfADiscovery[] {
  const { G } = turnContext;
  return pi == null ? [] : discEffectsOf(G.players[pi], kind);
}
export function discSum(
  turnContext: Pick<TurnContext, 'G'>,
  pi: number | null | undefined,
  kind: string,
  field: ANumberFieldOfAnEffect,
  pred?: ((e: TheEffectOfADiscovery) => boolean) | null,
) {
  const { G } = turnContext;
  return pi == null ? 0 : discSumOf(G.players[pi], kind, field, pred);
}
// Multiplier on ONE army's strength from `unitStr` discoveries (race / types / cls / terrain /
// side).
export function discUnitMult(
  turnContext: Pick<TurnContext, 'G'>,
  pi: number | null | undefined,
  army: AUnitAsTheDiscoveriesReadIt | null | undefined,
  terrain: string | null | undefined,
  ctx: { readonly isAttacker?: boolean | null } | null | undefined,
  heroChar: Pick<Character, 'isKing'> | null | undefined,
) {
  if (pi == null || !army) return 1;
  // the discoveries' registry's since plan P1-19aa: "strength: a realm's discoveries strengthen a unit", the product
  // capped at the kind's ceiling (Toby 2026-09-21)
  const { G } = turnContext;
  return theFactorARealmsDiscoveriesStrengthenAUnitBy(G.players[pi], {
    theUnit: army,
    theGround: terrain,
    isItsSideTheAttacker: ctx?.isAttacker,
    isItLedByTheKing: !!heroChar?.isKing,
    hasItACommander: !!heroChar,
  });
}
// Per-unit promotion bonus from `promo` discoveries (unit filters).
export function discPromo(
  turnContext: Pick<TurnContext, 'G'>,
  pi: number | null | undefined,
  army: AUnitAsTheDiscoveriesReadIt | null | undefined,
) {
  if (pi == null || !army) return 0;
  // (the discoveries' registry's since plan P1-19ab: "fate: a realm's discoveries promote a unit")
  const { G } = turnContext;
  return whatARealmsDiscoveriesAddToAUnitsPromotion(G.players[pi], { theUnit: army });
}
// 1 - (summed death-chance reduction) for one army.
export function discDeathMult(
  turnContext: Pick<TurnContext, 'G'>,
  pi: number | null | undefined,
  army: AUnitAsTheDiscoveriesReadIt | null | undefined,
  side: string | null | undefined,
) {
  if (pi == null || !army) return 1;
  // (the discoveries' registry's since plan P1-19ab: "fate: a realm's discoveries spare a beaten unit", never below the
  // kind's floor, a quarter)
  const { G } = turnContext;
  return theMultiplierARealmsDiscoveriesLeaveOnABeatenUnitsDeath(G.players[pi], { theUnit: army, theSide: side });
}
// Only discoveries the realm is eligible for (race / alignment) can be researched, found or
// stolen.
export function discAvailableFor(turnContext: Pick<TurnContext, 'G'>, pi: number, known: ReadonlySet<string>) {
  const { G } = turnContext;
  const pl = G.players[pi];
  const _blk = discBlockedIds(pl);
  return SAGE_DISCOVERIES_P.filter((d) => !known.has(d.id) && !_blk.has(d.id) && discEligible(d, pl));
} // forgotten + awaiting-choice ids excluded (research choice)

export function _isHumanoidRace(r: string | null | undefined) {
  return r === 'Human' || r === 'Elven' || r === 'Dwarven' || r === 'Orcish';
}
