// The scripted realm (plan P1-02, Decisions; P1-15e2): in 12 of the matrix's games one realm is held by the runner,
// which chooses its orders each turn from the saved state, with no randomness of its own, and sends them as the player
// portal sends them (the-orders-the-player-portal-sends.ts): its choices are the form's, in the form's names, and
// only what the form offers. It does what bots never do, so the matrix reaches those rules:
// - it declares war on the nearest realm it has met (the form offers a declaration only on a realm met, still in the
//   game, not already at war, and not before Safe Start ends); a chase between realms at peace passes without a fight;
// - one character sets out after the nearest enemy he can see (Encounter Character: the form lists a rival realm's
//   heroes the realm sees, and only a king may hunt a king): the king while it leads an army, or else the first hero.
//   An armed chaser is what meets a battle on the way: a hero without an army is never held by one;
// - any other armed hero sets out after the nearest armed enemy he can see standing in a province with an unresolved
//   battle;
// - its king, when he isn't chasing, recruits one unit where he stands (Recruit Armies), if it is his realm's land;
// - every other living hero (a spare one: P1-15e3, P1-15e's Decision 5) gets one order in the first phase, by hero and
//   turn, of those the form offers him where he stands: with a wandering hero or a rival beside him, Spy on him (a
//   wanderer first) or Hire Hero (the wanderer, with his card and its plan); else a mastery at its level (one with no
//   target); else Search Lair on a Weak lair his realm knows there (a hero fights its guardian alone), Research (Sage
//   1), Practice Skill, Explore or Rest, in turn.
//   Once a game (the orders for turn 6) the realm's first unarmed hero, if it has three or more, is released;
// - every other phase is left at "— Choose —", which the form sends as Defend;
// - every living hero gets a plan, varied by hero and turn: tactics from the form's own (not Cast Spell, whose spell
//   picker this doesn't drive; Steal only at Thief 1), a pre-battle school from his own schools on some turns, a
//   battle cry on some, each duel stance in turn, and an Evil realm's conquest doctrine in turn;
// - an heir spends his points; the first lead of each pending research pair is kept; it never calls the Reckoning
//   nor concedes.
// It also gives the matrix a per-realm report to hash: all-bot games write none.
import { PRIMAL_SEA_NAMES, SAFE_START_TURN } from '../../src/engine/army-tables.ts';
import { DISC_BY_ID } from '../../src/engine/discoveries.ts';
import { effSkillOf } from '../../src/engine/heroes/skills-and-hp.ts';
import { heroHireWage } from '../../src/engine/rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import { ALL_SKILLS } from '../../src/engine/rules-on-plain-values/skills-in-order-and-a-heros-fame-in-words.ts';
import {
  encounterUntargetableReason,
  enemyCharVisibleTo,
  featDiscovered,
  nearSpiedProvIds,
  type SightContext,
} from '../../src/engine/sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import { perkTier } from '../../src/engine/titles/perks.ts';
import type { OrdersARealmSubmits } from '../../src/schemas/orders-a-realm-submits.ts';
import type { GameState } from '../../src/schemas/saved-game-state.ts';
import {
  hireCardId,
  PHASES,
  theHeroesTheFormLists,
  theOrdersThePlayerPortalSends,
  type AnOrderPicked,
  type APlanSet,
  type HeroTheFormLists,
  type WhatTheRealmChose,
} from './the-orders-the-player-portal-sends.ts';

/** The parts of a saved game state the script reads. */
export interface State {
  turn: number;
  safeStart?: boolean;
  world: { cols: number; rows: number; provinces: Province[] };
  players: Realm[];
  characters: Character[];
  relations?: Record<string, string>;
}
export interface Realm {
  provinces?: number[];
  homeProvinceId?: number;
  _encountered?: number[];
  alignment?: string;
  discoveries?: { id?: string }[];
  heroOrder?: string[];
  conceded?: boolean;
  _eliminated?: boolean;
  _spiedProvincesThisTurn?: number[];
  pendingDiscoveryChoices?: { key?: string; options?: string[] }[];
}
export interface Province {
  id: number;
  row: number;
  col: number;
  owner: number | null;
  terrain: string;
  armyTypes?: string[];
  characters?: number[];
  _battleUnresolved?: boolean;
  features?: Lair[];
  /** How much of the province each realm has explored, by its index. */
  exploredBy?: Record<string, number>;
}
/** A province's feature: a lair, or a ritual site (which can't be searched). */
export interface Lair {
  cleared?: boolean;
  ritualSite?: boolean;
  tier?: string;
  monster?: { power?: string } | null;
  /** Its hoard, which the matrix's invariants read. */
  hoardItems?: { id?: unknown; name?: unknown }[];
}
export interface Character extends HeroTheFormLists {
  location: number;
  armies?: unknown[];
  /** The turn an Invisibility was cast: unseen that turn's report. */
  _invisTurn?: number;
  alignment?: string;
  _isNeutralGuard?: boolean;
  _justDefeated?: boolean;
  /** A charmed hero: whose skills the realm can't see, and who is held by an enchantment. */
  _hiddenSkills?: boolean;
  _charmEnemy?: boolean;
}

/** Which scripted orders were given this turn, by the hero that got them: for counting the scripted cases. */
export interface Plan {
  chaser: { heroId: number; quarryId: number } | null;
  battleChases: { heroId: number; quarryId: number; provinceId: number }[];
}

/** The orders for this turn release a hero, once a game. */
const RELEASE_TURN = 6;
/** The lairs the scripted realm sends a hero into: the weakest grade only (a hero fights a lair's guardian alone). */
const LAIR_POWER_IT_SEARCHES = 'Weak';
/** The masteries a hero is given at their level: the form's (L79_ORDERS, src/ui/player/l79-orders.ts) that need no
 *  target, but the Grand Design (offered only until the realm's Wonder stands), in the form's order. A copy: the page
 *  file isn't the matrix's to import (tools/balance/engine-paths.ts), and the unit test holds the two equal. */
export const MASTERIES: readonly { name: string; skill: string; lvl: number }[] = [
  { name: 'Awaken Grove', skill: 'druid', lvl: 7 },
  { name: 'Research Breakthrough', skill: 'sage', lvl: 7 },
  { name: 'Vanish', skill: 'thief', lvl: 9 },
  { name: 'Feigned Retreat', skill: 'tactical', lvl: 7 },
  { name: 'Grand Stratagem', skill: 'tactical', lvl: 9 },
  { name: 'Lightning Advance', skill: 'march', lvl: 9 },
  { name: 'Raid the Coast', skill: 'naval', lvl: 9 },
  { name: 'Wild Calling', skill: 'druid', lvl: 9 },
];

/** The tactics a plan is made from: the form's own, but Cast Spell (its spell picker) and Steal (Thief 1, below). */
const TACTICS = ['ME', 'FI', 'FL'];
const STANCES = ['challenge', 'accept', 'refuse'];
const DOCTRINES = ['terror', 'enslave'];
/** The schools the pre-battle picker offers, of those a hero knows (openPreSchoolPicker). */
const BATTLE_SCHOOLS = ['white', 'elemental', 'psychic', 'necromancy'];
const BATTLE_CRIES = ['For the realm!', 'Hold the line!', 'None shall pass!'];
/** An heir's points, in the order spent. */
const HEIR_PICKS = ['melee', 'tactical', 'melee', 'tactical'];

/** Hex distance with the map's east-west wrap (the GM portal's hexDistP). */
export function hexDistance(a: Province, b: Province, cols: number): number {
  let dc = Math.abs(a.col - b.col);
  dc = Math.min(dc, cols - dc);
  const dr = Math.abs(a.row - b.row);
  return Math.max(dc, dr, (dc + dr) >> 1);
}

const relKey = (a: number, b: number) => (a < b ? `${String(a)}-${String(b)}` : `${String(b)}-${String(a)}`);
const armed = (c: Character) => (c.armies ?? []).length > 0;

/** The nearest of `items` to province `from`, ties to the lowest id; null if there are none. */
function nearest<T extends { id: number }>(S: State, from: number, items: T[], where: (x: T) => number): T | null {
  const p = S.world.provinces;
  const here = p[from];
  if (!here) return null;
  let best: T | null = null;
  let bestD = Infinity;
  for (const x of [...items].sort((a, b) => a.id - b.id)) {
    const there = p[where(x)];
    if (!there) continue;
    const d = hexDistance(here, there, S.world.cols);
    if (d < bestD) {
      best = x;
      bestD = d;
    }
  }
  return best;
}

/** The realm still in the game, met by realm `me`, whose land is nearest its king (or its home, once the king is
 *  gone); null if there is none. */
export function nearestMetRealm(S: State, me: number): number | null {
  const king = S.characters.find((c) => c.alive && c.player === me && c.isKing);
  const from = king ? king.location : S.players[me]?.homeProvinceId;
  if (from == null) return null;
  const met = new Set(S.players[me]?._encountered ?? []);
  const inTheGame = (i: number) => {
    const realm = S.players[i];
    return !!realm && !realm.conceded && !realm._eliminated;
  };
  const land = S.world.provinces.filter(
    (p) => p.owner != null && p.owner !== me && met.has(p.owner) && inTheGame(p.owner) && p.terrain !== 'sea',
  );
  const hit = nearest(S, from, land, (p) => p.id);
  return hit ? hit.owner : null;
}

/** The heroes of other realms realm `me` sees and may set out after, as its report's Encounter Character list holds
 *  them (src/views/turn-report.ts, encounterTargets): the sight rule the views apply (heroesItSees), on the world the
 *  report is built from, but a hero who can't be hunted (Cloak of Many Faces). The report's world has one stamp the
 *  save doesn't: an Invisibility cast in the turn is stamped to the report's turn after the save. */
export function heroesTheRealmSeesToHunt(S: State, me: number): Character[] {
  const realm = S.players[me];
  const world = S as unknown as GameState;
  const spied = new Set(realm?._spiedProvincesThisTurn ?? []);
  const sight = {
    ownedProvIds: new Set(realm?.provinces ?? []),
    ownCharLocs: new Set(S.characters.filter((c) => c.alive && c.player === me).map((c) => c.location)),
    spiedThisTurn: spied,
    nearSpied: nearSpiedProvIds(world, spied),
  };
  // the sight rule reads a hero's items, and puts his equipment in order as it does: on a copy
  const asSaved = (c: Character) => structuredClone(c) as unknown as GameState['characters'][number];
  return S.characters.filter(
    (c) =>
      c.alive &&
      c.player != null &&
      c.player !== me &&
      c._invisTurn !== S.turn - 1 &&
      enemyCharVisibleTo(world, me, asSaved(c), sight) &&
      encounterUntargetableReason(asSaved(c)) == null,
  );
}

/** The sight the realm's report lists the heroes beside its own by, on the saved state (the view's hiringSight). */
function sightBesideItsOwn(S: State, me: number): SightContext {
  const realm = S.players[me];
  return {
    ownedProvIds: new Set(realm?.provinces ?? []),
    ownCharLocs: new Set(S.characters.filter((c) => c.alive && c.player === me).map((c) => c.location)),
    spiedThisTurn: new Set(realm?._spiedProvincesThisTurn ?? []),
  };
}

/** The heroes of other realms, and the wanderers, standing beside `hero` that his realm's report lists (its
 *  visibleChars: the sight rule, as the view applies it to the heroes beside its own), in id order. The report's world
 *  has two stamps the save doesn't: an Invisibility cast in the turn, and the Spy stealth each hero rolls once the turn
 *  is saved (run-turn.ts), which can hide a wanderer. A wanderer who might have slipped by (any Spy in play, or the
 *  Shimmer) is left out, as the realm can't know. */
export function heroesBesideHim(S: State, me: number, hero: Character): Character[] {
  const world = S as unknown as GameState;
  const sight = sightBesideItsOwn(S, me);
  const asSaved = (c: Character) => structuredClone(c) as unknown as GameState['characters'][number];
  const mightHaveSlippedBy = (c: Character) =>
    c.player == null &&
    (Math.min(5, Number(effSkillOf(asSaved(c), 'spy', S.characters)) || 0) > 0 || perkTier(c, 'illusory') >= 1);
  return S.characters
    .filter(
      (c) =>
        c.alive &&
        c.player !== me &&
        c.location === hero.location &&
        c._invisTurn !== S.turn - 1 &&
        !mightHaveSlippedBy(c) &&
        enemyCharVisibleTo(world, me, asSaved(c), sight),
    )
    .sort((a, b) => a.id - b.id);
}

/** The lairs realm `me` knows where `hero` stands and may search, as the Search Lair form lists them (the report's
 *  provinceOrderData: not cleared, not a ritual site, found by the realm or revealed by its exploring), each by its
 *  index in the province, in order, with its grade. */
export function lairsHeKnows(S: State, me: number, hero: Character): { index: number; power: string }[] {
  const p = S.world.provinces[hero.location];
  const features = p?.features ?? [];
  const explored = p?.exploredBy?.[String(me)] ?? 0;
  type Feature = NonNullable<GameState['world']['provinces'][number]['features']>[number];
  return features.flatMap((f, index) => {
    const threshold = Math.ceil(100 / features.length) * (index + 1);
    const asSaved = structuredClone(f) as unknown as Feature;
    const known = !f.cleared && !f.ritualSite && (featDiscovered(asSaved, me) || explored >= threshold);
    return known ? [{ index, power: f.monster?.power ?? f.tier ?? '' }] : [];
  });
}

/** The order a spare hero gives in the first phase, by hero and turn, of those the form offers him where he stands
 *  (actionsFor and each order's target field); null to leave it at "— Choose —". `hired` holds the wanderers already
 *  hired this turn, so no two heroes hire the same one. */
function spareHeroOrder(S: State, me: number, hero: Character, turn: number, hired: Set<number>): AnOrderPicked | null {
  // a charmed hero's choices are narrower (no mastery, no release, no items): he defends
  if (hero._hiddenSkills || hero._charmEnemy) return null;
  const k = hero.id + turn;
  const skills = hero.skills ?? {};
  const realm = S.players[me];
  const beside = heroesBesideHim(S, me, hero);
  const spyOn = beside.find((c) => c.player == null) ?? beside[0];
  const sd31 = (realm?.discoveries ?? []).some((d) => d.id === 'sd31');
  const crown = realm?.alignment ?? 'Neutral';
  const toHire = beside.find(
    (c) =>
      c.player === null &&
      !c._isNeutralGuard &&
      !c._justDefeated &&
      !hired.has(c.id) &&
      heroHireWage(crown, c.alignment ?? '', sd31, c) != null,
  );
  // someone beside him: a Spy on him, or a hire on even turns
  if (toHire && (k % 2 === 0 || !spyOn)) {
    hired.add(toHire.id);
    return { action: 'Hire Hero', target: String(toHire.id) };
  }
  if (spyOn) return { action: 'Spy', target: `char:${String(spyOn.id)}` };
  // a master uses his mastery
  const mastery = MASTERIES.find((m) => (skills[m.skill] ?? 0) >= m.lvl);
  if (mastery) return { action: mastery.name, target: '' };
  // else one of the rest, in turn
  const lair = lairsHeKnows(S, me, hero).find((l) => l.power === LAIR_POWER_IT_SEARCHES);
  const offered: AnOrderPicked[] = [
    ...(lair ? [{ action: 'Search Lair', target: String(lair.index) }] : []),
    ...((skills['sage'] ?? 0) >= 1 ? [{ action: 'Research', target: '' }] : []),
    { action: 'Practice Skill', target: ALL_SKILLS[k % ALL_SKILLS.length] ?? 'melee' },
    { action: 'Explore', target: '' },
    { action: 'Rest', target: '' },
  ];
  return offered[k % offered.length] ?? null;
}

/** The first kind of unit the Recruit Armies form offers where `hero` stands: his realm's land, its kinds but a sea
 *  beast on land (the report's provinceOrderData); null if none. */
function kindToRecruit(S: State, me: number, hero: Character): string | null {
  const p = S.world.provinces[hero.location];
  if (!p || !(S.players[me]?.provinces ?? []).includes(p.id)) return null;
  return (p.armyTypes ?? []).find((t) => !(PRIMAL_SEA_NAMES.has(t) && p.terrain !== 'sea')) ?? null;
}

/** A living hero's plan for `turn`, varied by hero and turn. */
export function planFor(hero: Character, turn: number, evil: boolean): APlanSet {
  const k = hero.id + turn;
  const skills = hero.skills ?? {};
  const codes = [...TACTICS, ...((skills['thief'] ?? 0) >= 1 ? ['ST'] : [])];
  const tactics = Array.from({ length: 1 + (k % 3) }, (_, i) => codes[(k + i) % codes.length] ?? 'ME');
  const schools = BATTLE_SCHOOLS.filter((s) => (skills[s] ?? 0) >= 1);
  const plan: APlanSet = {
    tactics,
    school: schools.length && k % 2 === 0 ? (schools[(k >> 1) % schools.length] ?? '') : '',
    notes: k % 3 === 1 ? (BATTLE_CRIES[(k >> 1) % BATTLE_CRIES.length] ?? '') : '',
    duelStance: STANCES[k % STANCES.length] ?? 'refuse',
  };
  if (evil) plan.evilMode = DOCTRINES[k % DOCTRINES.length] ?? 'terror';
  return plan;
}

/** The scripted realm's choices for `turn`, the turn about to run (the game row's `turn`: orders for any other turn
 *  are dropped as stale), and which scripted orders it gave. */
export function scriptedChoices(S: State, me: number, turn: number): { chose: WhatTheRealmChose; plan: Plan } {
  // the heroes who can be given an order in the first phase: alive, and not hired in it (the form locks it)
  const mine = S.characters
    .filter((c) => c.alive && c.player === me && (c.hiredInPhase ?? -1) < 0)
    .sort((a, b) => a.id - b.id);
  const atWar = (pi: number | null) => pi != null && pi !== me && S.relations?.[relKey(me, pi)] === 'enemy';
  const seen = heroesTheRealmSeesToHunt(S, me).filter((q) => atWar(q.player));
  const orders: Record<string, (AnOrderPicked | null)[]> = {};
  const give = (hero: Character, action: string, target: string) => {
    orders[String(hero.id)] = [{ action, target }, ...Array.from({ length: PHASES - 1 }, () => null)];
  };
  const plan: Plan = { chaser: null, battleChases: [] };

  // The chaser sets out after the nearest enemy he sees. Only a king may hunt a king.
  const chaser = mine.find((c) => c.isKing && armed(c)) ?? mine.find((c) => !c.isKing);
  const quarry = chaser
    ? nearest(
        S,
        chaser.location,
        seen.filter((q) => chaser.isKing || !q.isKing),
        (x) => x.location,
      )
    : null;
  if (chaser && quarry) {
    give(chaser, 'Encounter Character', String(quarry.id));
    plan.chaser = { heroId: chaser.id, quarryId: quarry.id };
  }

  // Every other armed hero sets out after the nearest armed enemy he sees standing in a province whose battle is
  // unresolved. Only a king may hunt a king.
  const fields = new Set(S.world.provinces.filter((p) => p._battleUnresolved).map((p) => p.id));
  const quarries = seen.filter((q) => armed(q) && fields.has(q.location));
  for (const hero of mine.filter((c) => armed(c) && !orders[String(c.id)])) {
    const q = nearest(
      S,
      hero.location,
      quarries.filter((x) => hero.isKing || !x.isKing),
      (x) => x.location,
    );
    if (!q) continue;
    give(hero, 'Encounter Character', String(q.id));
    plan.battleChases.push({ heroId: hero.id, quarryId: q.id, provinceId: q.location });
  }

  // The king recruits one unit of the first kind the form offers where he stands; everyone else defends.
  const king = mine.find((c) => c.isKing && !orders[String(c.id)]);
  const kind = king ? kindToRecruit(S, me, king) : null;
  if (king && kind) give(king, 'Recruit Armies', kind + '|1');

  // Every spare hero gives one order the form offers him; once a game, the first unarmed one is released.
  const spare = mine.filter((c) => !orders[String(c.id)]);
  const released =
    turn === RELEASE_TURN && S.characters.filter((c) => c.alive && c.player === me).length >= 3
      ? spare.find((c) => !c.isKing && !armed(c) && !c._hiddenSkills && !c._charmEnemy)
      : undefined;
  const hired = new Set<number>();
  for (const hero of spare) {
    const o = hero === released ? { action: 'Release Hero', target: '' } : spareHeroOrder(S, me, hero, turn, hired);
    if (o) give(hero, o.action, o.target);
  }

  // A plan for every living hero the form lists, and each hired hero's card; an heir's points; the first lead of
  // each research pair.
  const evil = S.players[me]?.alignment === 'Evil';
  const heroes = theHeroesTheFormLists(S, me);
  const plans: Record<string, APlanSet> = {};
  for (const hero of heroes.filter((c) => c.alive)) plans[String(hero.id)] = planFor(hero, turn, evil);
  for (const [id, picked] of Object.entries(orders)) {
    const o = picked[0];
    if (o?.action !== 'Hire Hero') continue;
    const wanderer = S.characters.find((c) => String(c.id) === o.target);
    if (!wanderer) continue;
    const { tactics, notes, duelStance } = planFor({ ...wanderer, skills: {} }, turn, false);
    plans[hireCardId(o.target, Number(id), 0)] = { tactics, school: '', notes, duelStance };
  }
  const heirPoints: Record<string, string[]> = {};
  for (const heir of heroes.filter((c) => c._isHeir))
    heirPoints[String(heir.id)] = HEIR_PICKS.slice(0, heir._pendingSkillAllocation ?? 0);
  const discoveryChoices: Record<string, string> = {};
  for (const pair of S.players[me]?.pendingDiscoveryChoices ?? []) {
    const lead = (pair.options ?? []).find((id) => id in DISC_BY_ID);
    if (pair.key && lead) discoveryChoices[pair.key] = lead;
  }

  // War on the nearest realm met, when the form offers it.
  const foe = nearestMetRealm(S, me);
  const safeStartLocked = !!S.safeStart && turn < SAFE_START_TURN;
  const diplomacy: Record<string, string> =
    foe != null && !safeStartLocked && !atWar(foe) ? { [String(foe)]: 'enemy' } : {};

  return { chose: { orders, plans, heirPoints, discoveryChoices, diplomacy }, plan };
}

/** The scripted realm's orders for `turn`, as the player portal sends them, and which scripted orders it gave. */
export function scriptedOrders(S: State, me: number, turn: number): { orders: OrdersARealmSubmits; plan: Plan } {
  const { chose, plan } = scriptedChoices(S, me, turn);
  return { orders: theOrdersThePlayerPortalSends(S, me, turn, chose), plan };
}
