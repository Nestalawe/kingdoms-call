// The bots' record of their choices (B-17b, BOT-V7's first part): per bot realm and turn, each order the order hygiene
// drops or changes, by its reason; each order a bot pads a hero's free phase with, by its kind; and each hero's cast
// limit in each school and the casts he is given. It is kept in memory, outside the game's state: nothing of it goes
// into the save, the telemetry or the GM log, and no choice reads it, so every game plays the same with it and without.
// It is off unless a page asks for it (the balance matrix's page half does: tools/balance/play.ts); off, each call is
// one look-up that finds nothing. The page's ask is read in economy.ts, the one bots' file that may read a page.
import type { Character, GameState } from '../../schemas/saved-game-state.ts';
import { THE_ORDERS_A_HERO_GIVES_IN_A_SEASON } from '../rules-on-plain-values/the-orders-a-hero-gives-in-a-season-and-the-hit-points-he-has-when-his-maximum-is-not-written.ts';

/** What the order hygiene (economy.ts's runBotOrderHygiene) does to an order, each as it counts it: the eight reasons
 *  it drops an order for, then the three changes it makes (a hand-over trimmed to the living, a lesson and a pairing
 *  added). The keys are the hygiene's tally's (`window.__botHyg`). */
export const THE_ORDER_HYGIENES_OUTCOMES = [
  'summonTwice',
  'overLimit',
  'hireGone',
  'hireTwice',
  'hireElsewhere',
  'hireUnaffordable',
  'handoverAllSkeletal',
  'practiceCapped',
  'handoverTrimmed',
  'teachAdded',
  'pairAdded',
] as const;
export type AnOrderHygienesOutcome = (typeof THE_ORDER_HYGIENES_OUTCOMES)[number];

/** The kinds of order a bot pads a hero's free phases with (each a Defend), as the code that writes it names it (never
 *  read from the order's words, BOT-S6): a plain hold ('Hold'); a specialist's hold of his post ('Hold the post'); a
 *  hero waiting with a host for its pick-up ('Hold with the host'); a spy's or a thief's wait ('Lie in wait'); a thief
 *  lying low after the Grand Heist ('Lie low'); a hunter at the end of his stalk ('Lie in wait for …'); and a hero
 *  holding the province his second-front attack or advance takes ('Hold …'). */
export const THE_KINDS_OF_PADDING_ORDER = [
  'hold',
  'hold-the-post',
  'hold-with-the-host',
  'lie-in-wait',
  'lie-low',
  'lie-in-wait-for-a-quarry',
  'hold-the-ground-won',
] as const;
export type AKindOfPaddingOrder = (typeof THE_KINDS_OF_PADDING_ORDER)[number];

/** A hero's casts in a school in a turn, on his plan as the hygiene leaves it: his limit as the turn begins
 *  (botCastLimit, before any practice of the turn); the limit the hygiene applies to his last cast in the school (each
 *  practice of the school before it counted as a level; with no cast, the limit as the turn begins), which his casts
 *  never pass; and the cast orders in the school he is left with. */
export interface AHerosCastsInASchool {
  hero: number;
  school: string;
  limit: number;
  limitTheHygieneApplies: number;
  casts: number;
}

/** A hero's phases with nothing else to do in a turn: padded (any kind) or left empty. */
export interface AHerosPhasesWithNothingElseToDo {
  hero: number;
  phases: number;
}

/** The record of one bot realm's turn. `phasesLeftEmpty`: the phases a hero is left without an order, which the turn
 *  fills with the engine's Defend. `idle`: each hero's phases padded or left empty (B-17d's casts left unused read
 *  them against his room under the cast limits). */
export interface TheBotsRecordOfARealmsTurn {
  turn: number;
  realm: number;
  hygiene: Partial<Record<AnOrderHygienesOutcome, number>>;
  padding: Partial<Record<AKindOfPaddingOrder, number>>;
  phasesLeftEmpty: number;
  idle: AHerosPhasesWithNothingElseToDo[];
  casts: AHerosCastsInASchool[];
}

/** A turn's open record: the realms' records so far, the padding orders marked by their kind, and where the page keeps
 *  the records once each realm's is closed. */
interface TheTurnsOpenRecord {
  realms: Map<number, TheBotsRecordOfARealmsTurn>;
  padding: WeakMap<object, AKindOfPaddingOrder>;
  thePagesRecords: TheBotsRecordOfARealmsTurn[];
}

/** Each turn's open record, by the turn's state: none when no page asks for one. */
const THE_OPEN_RECORDS = new WeakMap<GameState, TheTurnsOpenRecord>();

/** The turn's record opens, afresh, where the page keeps the records (`null`: no page asks, and the record stays off). */
export function theBotsRecordOpensTheTurn(G: GameState, thePagesRecords: TheBotsRecordOfARealmsTurn[] | null): void {
  if (thePagesRecords) THE_OPEN_RECORDS.set(G, { realms: new Map(), padding: new WeakMap(), thePagesRecords });
  else THE_OPEN_RECORDS.delete(G);
}

function theRealmsRecord(open: TheTurnsOpenRecord, G: GameState, realm: number): TheBotsRecordOfARealmsTurn {
  const had = open.realms.get(realm);
  if (had) return had;
  const made: TheBotsRecordOfARealmsTurn = {
    turn: G.turn,
    realm,
    hygiene: {},
    padding: {},
    phasesLeftEmpty: 0,
    idle: [],
    casts: [],
  };
  open.realms.set(realm, made);
  return made;
}

/** The hygiene's outcome for an order of the realm, counted. */
export function theBotsRecordCountsAHygienesOutcome(G: GameState, realm: number, outcome: AnOrderHygienesOutcome) {
  const open = THE_OPEN_RECORDS.get(G);
  if (!open) return;
  const record = theRealmsRecord(open, G, realm);
  record.hygiene[outcome] = (record.hygiene[outcome] ?? 0) + 1;
}

/** A padding order, marked with its kind while the record is open; the order itself is handed back unchanged. */
export function aPaddingOrder<TheOrder extends object>(G: GameState, kind: AKindOfPaddingOrder, order: TheOrder) {
  THE_OPEN_RECORDS.get(G)?.padding.set(order, kind);
  return order;
}

/** A copy of an order (`{ ...order }`), marked as the order is if it pads. */
export function aCopyOfAnOrderKeepingItsPaddingKind<TheOrder extends object>(G: GameState, order: TheOrder): TheOrder {
  const copy = { ...order };
  const open = THE_OPEN_RECORDS.get(G);
  const kind = open?.padding.get(order);
  if (open && kind) open.padding.set(copy, kind);
  return copy;
}

/** What closing a realm's record reads of the hygiene: a hero's limit in a school after a number of the turn's
 *  practices of it, a cast order's school, and whether an order is a practice of a school. */
export interface WhatTheRecordReadsOfAHerosCasts {
  readonly schools: readonly string[];
  readonly theLimitOf: (c: Character, school: string, practised: number) => number;
  readonly theSchoolOfACast: (order: object | null | undefined) => string | null;
  readonly practises: (order: object | null | undefined, school: string) => boolean;
}

/** Whether the turn's record is open (a page asked for it): the hygiene builds what the close reads only then. */
export function theBotsRecordIsOpen(G: GameState): boolean {
  return THE_OPEN_RECORDS.has(G);
}

/** A bot realm's record closes once the hygiene has run, on its heroes' plans as they stand: each padding order by its
 *  kind, each phase left empty, and each hero's limit and casts in each school where he has either. */
export function theBotsRecordClosesARealmsTurn(
  G: GameState,
  realm: number,
  plans: readonly { readonly hero: Character; readonly plan: readonly (object | null | undefined)[] }[],
  casts: WhatTheRecordReadsOfAHerosCasts,
): void {
  const open = THE_OPEN_RECORDS.get(G);
  if (!open) return;
  const record = theRealmsRecord(open, G, realm);
  for (const { hero, plan } of plans) {
    let idle = 0;
    for (let p = 0; p < THE_ORDERS_A_HERO_GIVES_IN_A_SEASON; p++) {
      const order = plan[p];
      if (!order) {
        record.phasesLeftEmpty++;
        idle++;
        continue;
      }
      const kind = open.padding.get(order);
      if (kind) {
        record.padding[kind] = (record.padding[kind] ?? 0) + 1;
        idle++;
      }
    }
    record.idle.push({ hero: hero.id, phases: idle });
    for (const school of casts.schools) {
      const limit = casts.theLimitOf(hero, school, 0);
      const phases = plan.slice(0, THE_ORDERS_A_HERO_GIVES_IN_A_SEASON);
      const given = phases.filter((order) => casts.theSchoolOfACast(order) === school).length;
      const last = phases.findLastIndex((order) => casts.theSchoolOfACast(order) === school);
      const practisedBefore = phases.slice(0, Math.max(0, last)).filter((o) => casts.practises(o, school)).length;
      const limitTheHygieneApplies = last < 0 ? limit : casts.theLimitOf(hero, school, practisedBefore);
      if (limit > 0 || given > 0)
        record.casts.push({ hero: hero.id, school, limit, limitTheHygieneApplies, casts: given });
    }
  }
  open.thePagesRecords.push(record);
  open.realms.delete(realm);
}

/** The turn's record closes: what wasn't closed goes, so the next turn's opens afresh. */
export function theBotsRecordClosesTheTurn(G: GameState): void {
  THE_OPEN_RECORDS.delete(G);
}
