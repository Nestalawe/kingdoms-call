// The set-up (plan P1-08k7, two stages of resolveTurn's own body lifted out): once the save is read and the bots'
// flags stamped, the turn's start repairs, then the merge of the realms' orders. Staged on the middle of a bot world
// (lib/middle-of-a-bot-world.ts), from plain realms each holding only its seat with a living king there (P1-08k5a's
// `stageCase`), every realm having met every other, each case with what must be true after it in game terms.
// The repairs: a wandering hero wearing a beast's race is given a people's race; a neutral guard with no companies, or
// standing in a realm's land, becomes a wanderer; no company carries a stranded hull's marker into the turn; a hero in a
// realm's service loses his "(wandering)" tag, told at the turn's end; last turn's orders and scratch lists are gone;
// every living hero of a realm notes the realm he serves. The merge: each realm that sent orders has them read, as text
// or as an object, in the form of today or an older one; its heroes' order in its column kept; its declarations (or the
// Safe Start's refusal), research choices, Reckoning call, messages and concession taken for the stages that act on
// them; orders sent for another turn refused, and told; the orders written for a hero it means to raise, hire or charm
// held until that lands; a conceded realm's heroes made to hold; its encounter plans set (or held, for a hero not yet
// its own); and a new heir's skills, name and temper applied. What a realm sends is taken only for its own heroes (the
// rest set aside, and the GM told); a plan keeps only the fields a plan has; an heir's skills are taken only as his
// crowned skills plus at most his points.
// scenario/set-up-and-order-merge-in-a-whole-turn.test.ts plays each through a whole turn (resolveTurn);
// unit/set-up-and-order-merge-called-directly.test.ts calls the two stages directly on the staged world. A case stages
// its world and what each realm sends; after the turn it reads what it needs from the world (as the first phase began,
// and after the turn) and the log (`got`) beside what must be so (`want`). Every outcome is certain: every case fixes
// the dice for the whole turn (default LANDS: every percentile roll lands, every other die at its highest). By default
// every realm is a player's, sending every living hero of its own Resting, nothing else, for this turn, with Safe Start
// over, and the turn is turn 1.
import vm from 'node:vm';
import { engineFn } from './engine.ts';
import {
  must,
  order,
  plan,
  type Board,
  type Character,
  type Line,
  type Order,
  type Province,
  type Unit,
  type World,
} from './middle-of-a-bot-world.ts';
import { withCaseDice, type Dice } from './espionage-order-cases.ts';
import { at, realm, ring1, wanderer } from './cast-spell-order-cases.ts';
import { LANDS } from './war-order-cases.ts';
import { companies } from './item-and-army-order-cases.ts';
import { kingOf, stageCase as stageNewTurnCase, type NewTurnCase } from './new-turn-succession-and-summons-cases.ts';
import { nm, relate, relation, seatOf, tooEarly, turnIs, war } from './diplomacy-and-victory-cases.ts';

export { LANDS, kingOf, nm, order, plan, relation, ring1, seatOf, turnIs, wanderer };
type Raw = Record<string, unknown>;
/** What a realm sends with its orders, as the order form writes it. */
export type Payload = Raw;
/** A realm's slot row, as the turn loads it, where a case changes it. */
export interface Slot {
  /** The player who holds the seat (null: nobody's, as an empty seat or a bot's). Default: a player's. */
  user?: string | null;
  /** The orders sent, replacing the whole of what the realm would send (an object is sent as an object, text as
   *  text; null: nothing sent). */
  orders?: Payload | string | null;
}
export interface Staged {
  /** Heroes given orders, with them (any other living hero of a realm Rests). */
  orders?: [Character, Order[]][];
  /** Fields a realm sends beside its heroes' orders, over the defaults (`orders` adds to its heroes' orders). */
  sends?: Record<number, Payload>;
  /** A realm's slot row, where a case changes it. */
  slots?: Record<number, Slot>;
  /** The order the slot rows come in, by realm (default: realm 0 first). */
  rowOrder?: number[];
  /** The hero the case is about, if one. */
  hero?: Character;
  /** Other heroes the case needs. */
  others?: Character[];
  /** The province the case is about. */
  there?: Province;
  /** Other provinces the case needs. */
  places?: Province[];
  /** The board the case was staged on (`stageCase` sets it). */
  board?: Board;
}
export interface Outcome {
  /** The world after the turn. */
  world: World;
  /** The world as the first phase of the turn began (after the set-up, the bots' plans and the default to Defend). */
  first: World;
  /** Every line in the log. */
  all: Line[];
  /** The turn played. */
  turn: number;
  /** The turn's record of every realm's orders, by realm (the statistics the GM keeps: the reports' `tel.collected.orders`). */
  record: Record<string, Raw>;
}
/** What the two stages leave, called directly: the world, and the turn's context (the collectors the merge fills). */
export interface Merged {
  G: World & Raw;
  tc: Raw;
  /** The turn the stages were called for. */
  turn: number;
}
export interface SetUpCase {
  name: string;
  /** The dice for the whole turn (default LANDS). */
  dice?: Dice;
  stage(b: Board): Staged;
  /** What the case found after the whole turn, and what it should have found: the same keys. */
  check(o: Outcome, s: Staged): { got: Record<string, unknown>; want: Record<string, unknown> };
  /** What the two stages leave when called directly, and what they should: the same keys (none: the case is about
   *  what only a whole turn shows). */
  merged?: (m: Merged, s: Staged) => { got: Record<string, unknown>; want: Record<string, unknown> };
}

// ── The slot rows ────────────────────────────────────────────────────────────────────────────────────────────────
/** What realm `pi` sends by default: every living hero of its own Resting (or doing his staged orders), nothing else,
 *  for this turn; then the case's own fields over it (its `orders` added to the heroes'). */
export const payloadOf = (b: Board, s: Staged, pi: number): Payload => {
  const given = new Map((s.orders ?? []).map(([h, os]) => [h.id, os]));
  const extra = s.sends?.[pi] ?? {};
  const { orders: more, ...rest } = extra as { orders?: Raw };
  return {
    orders: {
      ...Object.fromEntries(
        b.G.characters.filter((c) => c.alive && c.player === pi).map((c) => [c.id, given.get(c.id) ?? plan()]),
      ),
      ...more,
    },
    encounterPlans: {},
    kingSkills: {},
    diplomacy: {},
    discoveryChoices: {},
    callReckoning: false,
    concede: false,
    messages: [],
    heroOrder: [],
    forTurn: b.G.turn,
    ...rest,
  };
};
/** The game's slot rows as the turn loads them, as JSON text: one per realm, in the case's order. */
export const rowsOf = (b: Board, s: Staged) => {
  const order_ = s.rowOrder ?? b.G.players.map((_, i) => i);
  return JSON.stringify(
    order_.map((i) => {
      const slot = s.slots?.[i] ?? {};
      const sent = 'orders' in slot ? slot.orders : JSON.stringify(payloadOf(b, s, i));
      return {
        id: 'G1gp' + String(i),
        game_id: 'G1',
        user_id: slot.user === undefined ? 'u' + String(i) : slot.user,
        player_index: i,
        display_name: 'Realm ' + String(i),
        orders_submitted: sent != null,
        orders: sent ?? null,
        turn_report: '{}',
      };
    }),
  );
};

/** A turn's lines in words, as the views write them and the GM's log stores them (theTurnsLinesInWords, P1-12c3): a
 *  line that records a fact has its words there alone (P1-12d6: the orders' lines are facts). */
const inWords = (engine: vm.Context, log: unknown): Line[] =>
  (engineFn(engine, 'theTurnsLinesInWords') as (l: unknown) => { gmLog: Line[] })(log).gmLog;

// ── Playing a case ───────────────────────────────────────────────────────────────────────────────────────────────
const FIRST_PHASE = 'startPhaseHealingSnapshotsAndStalledBattles';
/** Plays `c`, staged as `s` on `b`, through a whole turn, with the case's dice; the world as the first phase began is
 *  read when the turn starts its first phase (P1-08k1's stage, wrapped in the vm for the turn's length), and the
 *  turn's record of orders from the reports built after it. */
export const playCase = (b: Board, c: SetUpCase, s: Staged): Outcome => {
  const g: Raw = b.engine;
  const was = g[FIRST_PHASE] as (tc: Raw, ph: number) => unknown;
  const seen: { first?: string } = {};
  g[FIRST_PHASE] = (tc: Raw, ph: number) => {
    seen.first ??= JSON.stringify(tc['G']);
    return was(tc, ph);
  };
  const resolveTurn = engineFn(b.engine, 'resolveTurn') as (
    state: string,
    rows: unknown,
    turn: number,
  ) => {
    state: string;
    log: Line[];
    spyStealthAndInvisibilityStampedForTheReports: () => void;
    whatTheReportsRead: () => unknown;
  };
  const buildReports = engineFn(b.engine, 'buildReports') as (whatTheReportsRead: unknown) => {
    tel: { collected: { orders: Record<string, Raw> } };
  };
  const inVm = vm.runInContext('(j)=>JSON.parse(j)', b.engine) as (j: string) => unknown;
  try {
    const turn = b.G.turn;
    const rows = rowsOf(b, s);
    const state = JSON.stringify(b.G);
    const [result, record] = withCaseDice(b.engine, c.dice ?? LANDS, () => {
      const r = resolveTurn(state, inVm(rows), turn);
      r.spyStealthAndInvisibilityStampedForTheReports();
      return [
        r,
        JSON.parse(JSON.stringify(buildReports(r.whatTheReportsRead()).tel.collected.orders)) as Record<string, Raw>,
      ] as const;
    });
    return {
      world: JSON.parse(result.state) as World,
      first: JSON.parse(must(seen.first, 'the first phase')) as World,
      all: inWords(b.engine, result.log),
      turn,
      record,
    };
  } finally {
    g[FIRST_PHASE] = was;
  }
};
const SET_UP = 'turnStartRepairsAndAFreshSlateOfOrdersForEveryHero';
const MERGE = 'mergeTheRealmsSubmittedOrdersDeclarationsMessagesAndEncounterPlans';
/** Calls the two stages directly on `b`, staged as `s`: the context given the slot rows and the turn, as resolveTurn
 *  makes it (Safe Start as the case stages it), then the repairs, then the merge. */
export const mergeCase = (b: Board, s: Staged): Merged => {
  const inVm = vm.runInContext('(j)=>JSON.parse(j)', b.engine) as (j: string) => unknown;
  const tc = b.tc as unknown as Raw;
  tc['freshPlayers'] = inVm(rowsOf(b, s));
  tc['expectedTurnToRun'] = b.G.turn;
  (engineFn(b.engine, SET_UP) as (t: Raw) => void)(tc);
  (engineFn(b.engine, MERGE) as (t: Raw) => void)(tc);
  return { G: b.G as World & Raw, tc, turn: b.G.turn };
};

// ── Staging ──────────────────────────────────────────────────────────────────────────────────────────────────────
const raw = (b: Board) => b.G as unknown as Raw;
const hero = (s: Staged) => must(s.hero, 'the hero');
const other = (s: Staged, i: number) => must(s.others?.[i], 'hero ' + String(i));
const there = (s: Staged) => must(s.there, 'the province');
/** Stages `c` on `b` (P1-08k5a's `stageCase`: plain realms, each holding only its seat with a living king there),
 *  every realm having met every other, realms 0 and 1 at war, 0 and 2 allied, 1 and 2 neither, Safe Start over. */
export const stageCase = (b: Board, c: SetUpCase): Staged => {
  const asNewTurn: NewTurnCase = { name: c.name, stage: () => ({ orders: [] }), check: () => ({ got: {}, want: {} }) };
  stageNewTurnCase(b, asNewTurn);
  b.G.players.forEach((pl, i) => {
    pl['_encountered'] = b.G.players.map((_, k) => k).filter((k) => k !== i);
  });
  relate(b, { '0-1': 'enemy', '0-2': 'allied' });
  raw(b)['safeStart'] = false;
  return { ...c.stage(b), board: b };
};
/** Safe Start holds on this game (no Treat or war before the orders for turn 6). */
export const safeStart = (b: Board) => {
  raw(b)['safeStart'] = true;
};
/** A hero of realm `pi` (default 0) in the middle. */
export const realmHero = (b: Board, pi = 0, extra: Raw = {}) => Object.assign(at(b, {}, { player: pi }), extra);
/** A wandering hero in the middle, of `race`. */
export const wanderingAs = (b: Board, race: string) => Object.assign(wanderer(b), { race });
/** A neutral guard of `p` (default the middle), leading `n` companies of beasts. */
export const guard = (b: Board, n: number, p: Province = b.X) => {
  const g = at(b, {}, { player: null, at: p });
  g.name = `${g.name} (Guardian)`;
  g['_isNeutralGuard'] = true;
  g.armies = companies(n, 'Dire Wolves', 'Veteran', 'Guard');
  return g;
};
/** Last turn's orders for `c`, left in the save. */
export const leftOrders = (b: Board, c: Character, os: Order[]) => {
  (b.G.turnOrders as Record<string, unknown>)[c.id] = os;
};
/** A pending research choice for realm `pi`: `options`, found last turn by `by`, under `key`. */
export const pendingChoice = (b: Board, pi: number, key: string, options: string[], by = 'Sage Orrin') => {
  realm(b, pi)['pendingDiscoveryChoices'] = [{ key, options, turn: b.G.turn - 1, charName: by }];
};
/** A newly crowned heir of realm `pi` (default 0), awaiting his allocation. */
export const heir = (b: Board, pi = 0) => {
  const h = kingOf(b, pi);
  Object.assign(h, { _isHeir: true, _pendingSkillAllocation: 4, temper: 'Cautious' });
  return h;
};
/** A newly crowned heir of realm `pi`, as `heir` makes him, crowned with `skills`. */
export const heirCrownedWith = (b: Board, pi: number, skills: Record<string, number>) =>
  Object.assign(heir(b, pi), { skills: { ...skills } });
/** The GM's line when a realm's orders name heroes not in its service (by the ids as sent): those parts are set aside. */
export const notInService = (realmName: string, ids: (string | number)[]) =>
  `⚠ Set aside from ${realmName}'s orders: what it sent for heroes not in its service (${ids.map(String).join(', ')}).`;
/** The GM's line when a realm sends skills for its heir that aren't his crowned skills plus at most `points` more. */
export const heirSkillsSetAside = (realmName: string, heirName: string, points: number) =>
  `⚠ Set aside from ${realmName}'s orders: skills for its heir ${heirName} that are not his crowned skills plus at most ${String(points)} points (no more than 2 in one skill); he keeps his crowned skills.`;
/** The game's Sage discovery `id`, as the data file has it. */
export const discovery = (b: Board, id: string) =>
  JSON.parse(vm.runInContext(`JSON.stringify(DISC_BY_ID[${JSON.stringify(id)}])`, b.engine) as string) as {
    id: string;
    name: string;
    category: string;
  };
/** The people's races a wanderer may be given, in the game's order. */
export const races = (b: Board) =>
  JSON.parse(vm.runInContext('JSON.stringify(RACES_P)', b.engine) as string) as string[];
/** The race a wanderer wearing a beast's race is given: the people's race at his id, round the list. */
export const raceFor = (b: Board, c: Character) => {
  const rs = races(b);
  return must(rs[((c.id % rs.length) + rs.length) % rs.length], 'a race');
};
/** A garrison company of realm `pi`'s seat carrying a stranded hull's marker (`hold`). */
export const heldHull = (b: Board, pi: number, hold: unknown) => {
  const p = seatOf(b, pi);
  const u = { ...must(companies(1, 'Men-at-Arms', 'Average', 'Hull')[0], 'a company'), _navalHold: hold } as Unit;
  p.garrisonArmies = [...p.garrisonArmies, u];
  return p;
};
const nothing = (): Staged => ({});
/** Realm `pi` sends `p` beside its orders. */
const sending = (sends: Record<number, Payload>): Staged => ({ sends });

// ── Reading the outcome ──────────────────────────────────────────────────────────────────────────────────────────
const rawOf = (w: World) => w as unknown as Raw;
export const charIn = (w: World, c: Character) =>
  must(
    w.characters.find((x) => x.id === c.id),
    'hero ' + c.name,
  );
/** A hero's orders as the first phase began (or as the stages left them), each phase's action and description. */
export const ordersOf = (w: World, c: Character | string | number) => {
  const os = (w.turnOrders as Record<string, (Order | null)[] | undefined>)[
    typeof c === 'object' ? String(c.id) : String(c)
  ];
  return os === undefined ? null : os.map((o) => (o ? `${o.action}${o.desc ? ': ' + o.desc : ''}` : null));
};
/** The heroes the orders are kept for, as the first phase began (or as the stages left them). */
export const orderedHeroes = (w: World) => Object.keys(w.turnOrders).sort();
/** A per-turn list of the save (`_pendingHireOrders`, …) as the first phase began (or as the stages left it). */
export const scratch = (w: World, key: string) => rawOf(w)[key] ?? null;
/** Every line saying `text`, with whom it is told to and whether it is public. */
export const told = (o: { all: Line[] }, text: string) =>
  o.all.filter((l) => l.text === text).map((l) => ({ targets: l.targets ?? null, public: l['public'] ?? false }));
/** Every line that starts with `start`. */
export const starting = (o: { all: Line[] }, start: string) =>
  o.all.filter((l) => l.text.startsWith(start)).map((l) => l.text);
export const stale = (realmName: string, sent: number, turn: number) =>
  `⚠ Ignoring stale orders from ${realmName} — submitted for Turn ${String(sent)}, not Turn ${String(turn)}.`;
export const conceded = (realmName: string) =>
  `\u{1F3F3} ${realmName} has CONCEDED the game. Its heroes lay down their ambitions and will only defend what they hold from now on.`;
export const SAFE_START_LINE =
  '🕊 Safe Start: no Treat or declaration of war may be made before the orders for Turn 6. Your diplomacy this turn was set aside — relations are unchanged.';
export const dispatch = (from: string, text: string) => `📨 Dispatch from ${from}: “${text}”`;
export const sentTo = (to: string[], text: string) => `📨 You sent to ${to.join(', ')}: “${text}”`;
export const repaired = (n: number) =>
  `[Integrity] ${String(n)} hero${n !== 1 ? 'es' : ''} in a realm's service still bore the “(wandering)” tag — the name has been corrected.`;
const HOLD_CONCEDED = 'defend: Hold (conceded)';
const DEFEND = 'defend: Defend';
const REST = 'rest';
const nameOf = (b: Board, pi: number) => realm(b, pi).name;
/** A hero's province after the turn (or as the first phase began). */
const whereIs = (w: World, c: Character) => charIn(w, c).location;
/** What the merge left in a collector of the context, as JSON (a set, made in the vm, as a list). */
export const collected = (m: Merged, key: string) => {
  const v = m.tc[key];
  return Object.prototype.toString.call(v) === '[object Set]'
    ? [...(v as Set<unknown>)]
    : (JSON.parse(JSON.stringify(v ?? null)) as unknown);
};

// ── The turn's start repairs ─────────────────────────────────────────────────────────────────────────────────────
export const REPAIR_CASES: SetUpCase[] = [
  {
    name: 'a wandering hero wearing a beast’s race (Monster) is given the people’s race at his id, by the first phase and after',
    stage: (b) => ({ hero: wanderingAs(b, 'Monster'), board: b }),
    check(o, s) {
      const want = raceFor(must(s.board, 'board'), hero(s));
      return {
        got: { first: charIn(o.first, hero(s))['race'], after: charIn(o.world, hero(s))['race'] },
        want: { first: want, after: want },
      };
    },
    merged: (m, s) => ({
      got: { race: charIn(m.G, hero(s))['race'] },
      want: { race: raceFor(must(s.board, 'board'), hero(s)) },
    }),
  },
  {
    name: 'a wandering hero wearing the other beast’s race (Creature) is given a people’s race too',
    stage: (b) => ({ hero: wanderingAs(b, 'Creature'), board: b }),
    check: (o, s) => ({
      got: { race: charIn(o.first, hero(s))['race'] },
      want: { race: raceFor(must(s.board, 'board'), hero(s)) },
    }),
    merged: (m, s) => ({
      got: { race: charIn(m.G, hero(s))['race'] },
      want: { race: raceFor(must(s.board, 'board'), hero(s)) },
    }),
  },
  {
    name: 'two wanderers wearing beasts’ races are each given the race at their own id',
    stage: (b) => {
      const a = wanderingAs(b, 'Monster');
      const c = wanderingAs(b, 'Monster');
      return { hero: a, others: [c], board: b };
    },
    check: (o, s) => ({
      got: { races: [hero(s), other(s, 0)].map((c) => charIn(o.first, c)['race']) },
      want: { races: [hero(s), other(s, 0)].map((c) => raceFor(must(s.board, 'board'), c)) },
    }),
    merged: (m, s) => ({
      got: { races: [hero(s), other(s, 0)].map((c) => charIn(m.G, c)['race']) },
      want: { races: [hero(s), other(s, 0)].map((c) => raceFor(must(s.board, 'board'), c)) },
    }),
  },
  {
    name: 'a hero in a realm’s service keeps a beast’s race; a wandering Elf keeps his own',
    stage: (b) => ({ hero: realmHero(b, 0, { race: 'Monster' }), others: [wanderingAs(b, 'Elf')] }),
    check: (o, s) => ({
      got: { served: charIn(o.first, hero(s))['race'], wandering: charIn(o.first, other(s, 0))['race'] },
      want: { served: 'Monster', wandering: 'Elf' },
    }),
    merged: (m, s) => ({
      got: { served: charIn(m.G, hero(s))['race'], wandering: charIn(m.G, other(s, 0))['race'] },
      want: { served: 'Monster', wandering: 'Elf' },
    }),
  },
  {
    name: 'a neutral guard who leads no companies is a wanderer by the first phase',
    stage: (b) => ({ hero: guard(b, 0) }),
    check: (o, s) => ({
      got: { guard: charIn(o.first, hero(s))['_isNeutralGuard'] ?? false },
      want: { guard: false },
    }),
    merged: (m, s) => ({ got: { guard: charIn(m.G, hero(s))['_isNeutralGuard'] ?? false }, want: { guard: false } }),
  },
  {
    name: 'a neutral guard standing in a realm’s land is a wanderer by the first phase',
    stage: (b) => {
      const p = seatOf(b, 1);
      return { hero: guard(b, 2, p), there: p };
    },
    check: (o, s) => ({
      got: { guard: charIn(o.first, hero(s))['_isNeutralGuard'] ?? false },
      want: { guard: false },
    }),
    merged: (m, s) => ({ got: { guard: charIn(m.G, hero(s))['_isNeutralGuard'] ?? false }, want: { guard: false } }),
  },
  {
    name: 'a neutral guard leading companies on unclaimed ground still guards it at the first phase',
    stage: (b) => ({ hero: guard(b, 2) }),
    check: (o, s) => ({
      got: { guard: charIn(o.first, hero(s))['_isNeutralGuard'] ?? false },
      want: { guard: true },
    }),
    merged: (m, s) => ({ got: { guard: charIn(m.G, hero(s))['_isNeutralGuard'] ?? false }, want: { guard: true } }),
  },
  {
    name: 'no garrison company carries a stranded hull’s marker into the turn',
    stage: (b) => ({ there: heldHull(b, 1, 2) }),
    check: (o, s) => ({
      got: { held: (o.first.world.provinces[there(s).id]?.garrisonArmies ?? []).map((u) => '_navalHold' in u) },
      want: { held: [false] },
    }),
    merged: (m, s) => ({
      got: { held: (m.G.world.provinces[there(s).id]?.garrisonArmies ?? []).map((u) => '_navalHold' in u) },
      want: { held: [false] },
    }),
  },
  {
    name: 'a stranded hull’s marker of phase 0 is taken off as well',
    stage: (b) => ({ there: heldHull(b, 2, 0) }),
    check: (o, s) => ({
      got: { held: (o.first.world.provinces[there(s).id]?.garrisonArmies ?? []).map((u) => '_navalHold' in u) },
      want: { held: [false] },
    }),
    merged: (m, s) => ({
      got: { held: (m.G.world.provinces[there(s).id]?.garrisonArmies ?? []).map((u) => '_navalHold' in u) },
      want: { held: [false] },
    }),
  },
  {
    name: 'a hero in a realm’s service who still bears “(wandering)” loses the tag, and the turn’s end tells the GM one was mended',
    stage: (b) => {
      const h = realmHero(b, 1);
      const name = h.name;
      h.name = `${name} (wandering)`;
      return { hero: h };
    },
    check: (o, s) => ({
      got: { name: charIn(o.first, hero(s)).name, told: told(o, repaired(1)) },
      want: { name: hero(s).name.replace(' (wandering)', ''), told: [{ targets: [], public: false }] },
    }),
    merged: (m, s) => ({
      got: { name: charIn(m.G, hero(s)).name, repairs: m.G['_nameRepairs'] },
      want: { name: hero(s).name.replace(' (wandering)', ''), repairs: 1 },
    }),
  },
  {
    name: 'two heroes in realms’ service bearing the tag are both mended, and the line counts two',
    stage: (b) => {
      const a = realmHero(b, 0);
      const c = realmHero(b, 2);
      a.name = `${a.name} (wandering)`;
      c.name = `${c.name} (Wandering)`;
      return { hero: a, others: [c] };
    },
    check: (o, s) => ({
      got: { names: [hero(s), other(s, 0)].map((c) => charIn(o.first, c).name), told: told(o, repaired(2)).length },
      want: { names: [hero(s), other(s, 0)].map((c) => c.name.replace(/ \(wandering\)/i, '')), told: 1 },
    }),
    merged: (m) => ({ got: { repairs: m.G['_nameRepairs'] }, want: { repairs: 2 } }),
  },
  {
    name: 'with no hero to mend, no line is told and the save keeps a count of none',
    stage: nothing,
    check: (o) => ({
      got: { told: starting(o, '[Integrity] ').filter((t) => t.includes('(wandering)')) },
      want: { told: [] },
    }),
    merged: (m) => ({ got: { repairs: m.G['_nameRepairs'] }, want: { repairs: 0 } }),
  },
  {
    name: 'last turn’s orders left in the save don’t carry over: a realm that sends none has its hero Defend where he stands',
    stage: (b) => {
      const h = realmHero(b, 1);
      leftOrders(b, h, plan(order('move', ring1(b, 0).id)));
      return { hero: h, slots: { 1: { orders: null } } };
    },
    check: (o, s) => ({
      got: { orders: ordersOf(o.first, hero(s)), at: whereIs(o.world, hero(s)) },
      want: { orders: [DEFEND, DEFEND, DEFEND, DEFEND, DEFEND], at: hero(s).location },
    }),
    merged: (m, s) => ({
      got: { orders: ordersOf(m.G, hero(s)) },
      want: { orders: [null, null, null, null, null] },
    }),
  },
  {
    name: 'the save’s orders for a hero no longer in play are dropped',
    stage: (b) => {
      (b.G.turnOrders as Raw)['424242'] = plan();
      return {};
    },
    check: (o) => ({ got: { kept: orderedHeroes(o.first).includes('424242') }, want: { kept: false } }),
    merged: (m) => ({ got: { kept: orderedHeroes(m.G).includes('424242') }, want: { kept: false } }),
  },
  ...(
    [
      ['_resurrectedThisTurn', 'the heroes raised “this turn”', [7]],
      [
        '_pendingResurrectOrders',
        'the orders held for a hero to be raised',
        [{ heroId: 7, casterId: 8, castPhase: 1, player: 0, orders: [] }],
      ],
      [
        '_pendingCharmOrders',
        'the orders held for a hero to be charmed',
        [{ heroId: 7, casterId: 8, castPhase: 1, player: 0, orders: [] }],
      ],
      [
        '_pendingHireOrders',
        'the orders held for a hero to be hired',
        [{ heroId: 7, viaId: '8', plannedPhase: 1, player: 0, orders: [] }],
      ],
      [
        '_pendingSynthPlans',
        'the encounter plans held for a hero not yet a realm’s',
        [{ heroId: 7, player: 0, plan: { tactics: ['FL'] } }],
      ],
    ] as [string, string, unknown[]][]
  ).map(([key, what, left]): SetUpCase => ({
    name: `${what}, left in the save from an earlier turn, are gone by the first phase`,
    stage: (b) => {
      raw(b)[key] = left;
      return {};
    },
    check: (o) => ({ got: { [key]: scratch(o.first, key) }, want: { [key]: [] } }),
    merged: (m) => ({ got: { [key]: scratch(m.G, key) }, want: { [key]: [] } }),
  })),
  {
    name: 'every living hero of a realm notes the realm he serves; a wanderer and a fallen hero don’t',
    stage: (b) => {
      const h = realmHero(b, 1);
      const w = wanderer(b);
      const f = realmHero(b, 2, { alive: false });
      return { hero: h, others: [w, f] };
    },
    check: (o, s) => ({
      got: {
        served: charIn(o.first, hero(s))['_servedRealms'] ?? null,
        wanderer: charIn(o.first, other(s, 0))['_servedRealms'] ?? null,
        fallen: charIn(o.first, other(s, 1))['_servedRealms'] ?? null,
      },
      want: { served: [1], wanderer: null, fallen: null },
    }),
    merged: (m, s) => ({
      got: {
        served: charIn(m.G, hero(s))['_servedRealms'] ?? null,
        wanderer: charIn(m.G, other(s, 0))['_servedRealms'] ?? null,
        fallen: charIn(m.G, other(s, 1))['_servedRealms'] ?? null,
      },
      want: { served: [1], wanderer: null, fallen: null },
    }),
  },
  {
    name: 'a hero who served another realm before keeps both in his record, his own added once',
    stage: (b) => ({ hero: realmHero(b, 2, { _servedRealms: [0, 2] }) }),
    check: (o, s) => ({ got: { served: charIn(o.first, hero(s))['_servedRealms'] }, want: { served: [0, 2] } }),
    merged: (m, s) => ({ got: { served: charIn(m.G, hero(s))['_servedRealms'] }, want: { served: [0, 2] } }),
  },
  {
    name: 'every living hero of a realm starts the turn with five empty phases; a wanderer and a fallen hero have none',
    stage: (b) => {
      const h = realmHero(b, 1);
      const w = wanderer(b);
      const f = realmHero(b, 2, { alive: false });
      return { hero: h, others: [w, f], slots: { 1: { orders: null } } };
    },
    check: (o, s) => ({
      got: {
        hero: ordersOf(o.first, hero(s)),
        wanderer: ordersOf(o.first, other(s, 0)),
        fallen: ordersOf(o.first, other(s, 1)),
      },
      want: { hero: [DEFEND, DEFEND, DEFEND, DEFEND, DEFEND], wanderer: null, fallen: null },
    }),
    merged: (m, s) => ({
      got: { hero: ordersOf(m.G, hero(s)), wanderer: ordersOf(m.G, other(s, 0)), fallen: ordersOf(m.G, other(s, 1)) },
      want: { hero: [null, null, null, null, null], wanderer: null, fallen: null },
    }),
  },
];

// ── Which realms' orders are read, and how ───────────────────────────────────────────────────────────────────────
/** Realm 1's hero, ordered to march to the province next to the middle. */
const marcher = (b: Board, pi = 1): Staged => {
  const h = realmHero(b, pi);
  return { hero: h, there: ring1(b, 0), orders: [[h, plan(order('move', ring1(b, 0).id))]] };
};
const marched = (o: Outcome, s: Staged) => ({ orders: ordersOf(o.first, hero(s)), at: whereIs(o.world, hero(s)) });
const MARCHED = (s: Staged) => ({ orders: ['move', REST, REST, REST, REST], at: there(s).id });
const STOOD = (s: Staged) => ({ orders: [DEFEND, DEFEND, DEFEND, DEFEND, DEFEND], at: hero(s).location });
const mergedOrders = (m: Merged, s: Staged) => ordersOf(m.G, hero(s));
const MOVE_REST = ['move', REST, REST, REST, REST];
const NO_ORDERS = [null, null, null, null, null];
/** Realm `pi`'s payload as the case sends it, with `drop` taken out and `add` put in. */
const sentAs = (b: Board, s: Staged, pi: number, add: Payload = {}, ...drop: string[]): Payload => {
  const p = { ...payloadOf(b, s, pi), ...add };
  drop.forEach((k) => {
    Reflect.deleteProperty(p, k);
  });
  return p;
};
export const READ_CASES: SetUpCase[] = [
  {
    name: 'a realm’s orders are read: its hero marches as ordered (the control)',
    stage: (b) => marcher(b),
    check: (o, s) => ({ got: marched(o, s), want: MARCHED(s) }),
    merged: (m, s) => ({ got: { orders: mergedOrders(m, s) }, want: { orders: MOVE_REST } }),
  },
  {
    name: 'a seat nobody holds sends nothing the turn reads: its hero Defends where he stands',
    stage: (b) => ({ ...marcher(b), slots: { 1: { user: null, orders: JSON.stringify(sentAs(b, marcher(b), 1)) } } }),
    check: (o, s) => ({ got: marched(o, s), want: STOOD(s) }),
    merged: (m, s) => ({ got: { orders: mergedOrders(m, s) }, want: { orders: NO_ORDERS } }),
  },
  {
    name: 'a realm that sent no orders: its hero Defends where he stands',
    stage: (b) => ({ ...marcher(b), slots: { 1: { orders: null } } }),
    check: (o, s) => ({ got: marched(o, s), want: STOOD(s) }),
    merged: (m, s) => ({ got: { orders: mergedOrders(m, s) }, want: { orders: NO_ORDERS } }),
  },
  {
    name: 'orders sent as an object, not as text, are read the same',
    stage: (b) => {
      const s = marcher(b);
      return { ...s, slots: { 1: { orders: payloadOf(b, s, 1) } } };
    },
    check: (o, s) => ({ got: marched(o, s), want: MARCHED(s) }),
    merged: (m, s) => ({ got: { orders: mergedOrders(m, s) }, want: { orders: MOVE_REST } }),
  },
  {
    name: 'orders in the older form (each hero’s phases alone, no turn on them) are read',
    stage: (b) => {
      const s = marcher(b);
      return { ...s, slots: { 1: { orders: JSON.stringify({ [hero(s).id]: plan(order('move', ring1(b, 0).id)) }) } } };
    },
    check: (o, s) => ({ got: marched(o, s), want: MARCHED(s) }),
    merged: (m, s) => ({ got: { orders: mergedOrders(m, s) }, want: { orders: MOVE_REST } }),
  },
  {
    name: 'orders sent without encounter plans are read as the older form: no hero’s phases are found, so the hero Defends (the list of messages, no hero of the realm’s, is set aside)',
    stage: (b) => {
      const s = marcher(b);
      return { ...s, slots: { 1: { orders: JSON.stringify(sentAs(b, s, 1, {}, 'encounterPlans')) } } };
    },
    check: (o, s) => ({ got: marched(o, s), want: STOOD(s) }),
    merged: (m, s) => ({
      got: { orders: mergedOrders(m, s), keys: orderedHeroes(m.G).filter((k) => !/^\d+$/.test(k)) },
      want: { orders: NO_ORDERS, keys: [] },
    }),
  },
  {
    name: 'a payload with encounter plans but no orders is read as the older form: its declaration is not taken',
    stage: (b) => ({
      slots: { 1: { orders: JSON.stringify(sentAs(b, {}, 1, { diplomacy: { 2: 'enemy' } }, 'orders')) } },
    }),
    check: (o) => ({ got: { relation: relation(o, 1, 2) }, want: { relation: 'neutral' } }),
    merged: (m) => ({
      got: { declared: (collected(m, 'diploDeclarations') as Raw)['1'] ?? null },
      want: { declared: null },
    }),
  },
  {
    name: 'orders sent with encounter plans set to nothing are read in today’s form',
    stage: (b) => {
      const s = marcher(b);
      return { ...s, slots: { 1: { orders: JSON.stringify(sentAs(b, s, 1, { encounterPlans: null })) } } };
    },
    check: (o, s) => ({ got: marched(o, s), want: MARCHED(s) }),
    merged: (m, s) => ({ got: { orders: mergedOrders(m, s) }, want: { orders: MOVE_REST } }),
  },
  {
    name: 'orders in today’s form with no hero’s phases in them leave every hero to Defend',
    stage: (b) => {
      const s = marcher(b);
      return { ...s, slots: { 1: { orders: JSON.stringify(sentAs(b, s, 1, { orders: null })) } } };
    },
    check: (o, s) => ({ got: marched(o, s), want: STOOD(s) }),
    merged: (m, s) => ({ got: { orders: mergedOrders(m, s) }, want: { orders: NO_ORDERS } }),
  },
  {
    name: 'every realm’s orders are read, whichever row comes first',
    stage: (b) => {
      const hs = [0, 1, 2].map((pi) => realmHero(b, pi));
      const to = [ring1(b, 0), ring1(b, 2), ring1(b, 4)];
      return {
        others: hs,
        places: to,
        rowOrder: [2, 0, 1],
        orders: hs.map((h, i): [Character, Order[]] => [h, plan(order('move', must(to[i], 'a place').id))]),
      };
    },
    check: (o, s) => ({
      got: { at: (s.others ?? []).map((h) => whereIs(o.world, h)) },
      want: { at: (s.places ?? []).map((p) => p.id) },
    }),
    merged: (m, s) => ({
      got: { orders: (s.others ?? []).map((h) => ordersOf(m.G, h)) },
      want: { orders: [MOVE_REST, MOVE_REST, MOVE_REST] },
    }),
  },
  {
    name: 'a hero whose phases aren’t a list is given none: he Defends',
    stage: (b) => {
      const s = marcher(b);
      return { ...s, sends: { 1: { orders: { [hero(s).id]: { 0: order('move', ring1(b, 0).id) } } } } };
    },
    check: (o, s) => ({ got: marched(o, s), want: STOOD(s) }),
    merged: (m, s) => ({ got: { orders: mergedOrders(m, s) }, want: { orders: NO_ORDERS } }),
  },
];

// ── The heroes' order in the column ──────────────────────────────────────────────────────────────────────────────
const heroOrderOf = (w: World, pi: number) => must(w.players[pi], 'realm ' + String(pi))['heroOrder'] ?? null;
export const HERO_ORDER_CASES: SetUpCase[] = [
  {
    name: 'the order a realm keeps its heroes in is kept on the realm, every id as text',
    stage: (b) => {
      const h = realmHero(b, 1);
      const k = kingOf(b, 1);
      return { hero: h, others: [k], sends: { 1: { heroOrder: [h.id, k.id] } } };
    },
    check: (o, s) => ({
      got: { order: heroOrderOf(o.world, 1) },
      want: { order: [String(hero(s).id), String(other(s, 0).id)] },
    }),
    merged: (m, s) => ({
      got: { order: heroOrderOf(m.G, 1) },
      want: { order: [String(hero(s).id), String(other(s, 0).id)] },
    }),
  },
  {
    name: 'only the first 200 places of a realm’s order are kept',
    stage: () => ({ sends: { 2: { heroOrder: Array.from({ length: 205 }, (_, i) => i) } } }),
    check: (o) => {
      const kept = heroOrderOf(o.world, 2) as string[];
      return { got: { n: kept.length, last: kept[199] }, want: { n: 200, last: '199' } };
    },
    merged: (m) => {
      const kept = heroOrderOf(m.G, 2) as string[];
      return { got: { n: kept.length, last: kept[199] }, want: { n: 200, last: '199' } };
    },
  },
  {
    name: 'an order that isn’t a list leaves the realm’s order as it was',
    stage: (b) => {
      realm(b, 0)['heroOrder'] = ['7', '8'];
      return { sends: { 0: { heroOrder: '8,7' } } };
    },
    check: (o) => ({ got: { order: heroOrderOf(o.world, 0) }, want: { order: ['7', '8'] } }),
    merged: (m) => ({ got: { order: heroOrderOf(m.G, 0) }, want: { order: ['7', '8'] } }),
  },
  {
    name: 'an order sent in the older form is kept too, and is no hero’s phases',
    stage: (b) => {
      const s = marcher(b);
      return {
        ...s,
        slots: {
          1: { orders: JSON.stringify({ heroOrder: [hero(s).id], [hero(s).id]: plan(order('move', ring1(b, 0).id)) }) },
        },
      };
    },
    check: (o, s) => ({
      got: { order: heroOrderOf(o.world, 1), ...marched(o, s), keys: orderedHeroes(o.first).includes('heroOrder') },
      want: { order: [String(hero(s).id)], ...MARCHED(s), keys: false },
    }),
    merged: (m, s) => ({
      got: { order: heroOrderOf(m.G, 1), keys: orderedHeroes(m.G).includes('heroOrder') },
      want: { order: [String(hero(s).id)], keys: false },
    }),
  },
  {
    name: 'an order sent with orders for another turn is still kept (it is read first)',
    stage: (b) => ({ hero: realmHero(b, 1), sends: { 1: { heroOrder: ['3'], forTurn: b.G.turn + 1 } } }),
    check: (o) => ({ got: { order: heroOrderOf(o.world, 1) }, want: { order: ['3'] } }),
    merged: (m) => ({ got: { order: heroOrderOf(m.G, 1) }, want: { order: ['3'] } }),
  },
];

// ── Orders for another turn ──────────────────────────────────────────────────────────────────────────────────────
export const STALE_CASES: SetUpCase[] = [
  {
    name: 'orders sent for another turn are refused, the GM is told, and the realm’s hero Defends',
    stage: (b) => ({ ...marcher(b), sends: { 1: { forTurn: b.G.turn + 1 } }, board: b }),
    check: (o, s) => ({
      got: {
        ...marched(o, s),
        told: told(o, stale(nm(o, 1), o.turn + 1, o.turn)),
        meta: o.all.find((l) => l.text.startsWith('⚠ Ignoring stale'))?.actor ?? null,
      },
      want: { ...STOOD(s), told: [{ targets: [], public: false }], meta: -1 },
    }),
    merged: (m, s) => ({
      got: { orders: mergedOrders(m, s), warnings: collected(m, 'staleOrderWarnings') },
      want: { orders: NO_ORDERS, warnings: [stale(nameOf(must(s.board, 'board'), 1), m.turn + 1, m.turn)] },
    }),
  },
  {
    name: 'orders sent for an earlier turn are refused the same way',
    stage: (b) => {
      turnIs(b, 3);
      return { ...marcher(b), sends: { 1: { forTurn: 2 } } };
    },
    check: (o, s) => ({
      got: { ...marched(o, s), told: told(o, stale(nm(o, 1), 2, 3)).length },
      want: { ...STOOD(s), told: 1 },
    }),
    merged: (m) => ({
      got: { warnings: (collected(m, 'staleOrderWarnings') as string[]).length },
      want: { warnings: 1 },
    }),
  },
  {
    name: 'orders with no turn on them are read',
    stage: (b) => ({ ...marcher(b), sends: { 1: { forTurn: null } } }),
    check: (o, s) => ({
      got: { ...marched(o, s), told: starting(o, '⚠ Ignoring stale') },
      want: { ...MARCHED(s), told: [] },
    }),
    merged: (m, s) => ({
      got: { orders: mergedOrders(m, s), warnings: collected(m, 'staleOrderWarnings') },
      want: { orders: MOVE_REST, warnings: [] },
    }),
  },
  {
    name: 'refused orders bring no encounter plan and no heir’s choices with them',
    stage: (b) => {
      const h = heir(b, 1);
      const old = { tactics: ['MA'], duelStance: 'accept' };
      h['encounterPlan'] = old;
      return {
        hero: h,
        sends: {
          1: {
            forTurn: b.G.turn + 1,
            encounterPlans: { [h.id]: { tactics: ['FL'], duelStance: 'refuse' } },
            kingSkills: { [h.id]: { skills: { melee: 5 }, name: 'Aldric the Bold', temper: 'Brave' } },
          },
        },
      };
    },
    check: (o, s) => {
      const h = charIn(o.first, hero(s));
      return {
        got: { plan: h['encounterPlan'], name: h.name, temper: h['temper'], heir: h['_isHeir'] ?? false },
        want: { plan: { tactics: ['MA'], duelStance: 'accept' }, name: hero(s).name, temper: 'Cautious', heir: true },
      };
    },
    merged: (m, s) => {
      const h = charIn(m.G, hero(s));
      return {
        got: { plan: h['encounterPlan'], name: h.name, heir: h['_isHeir'] ?? false },
        want: { plan: { tactics: ['MA'], duelStance: 'accept' }, name: hero(s).name, heir: true },
      };
    },
  },
  {
    name: 'a realm whose orders are refused still has its declaration of war taken',
    stage: (b) => ({ sends: { 1: { forTurn: b.G.turn + 1, diplomacy: { 2: 'enemy' } } } }),
    check: (o) => ({ got: { relation: relation(o, 1, 2) }, want: { relation: 'enemy' } }),
    merged: (m) => ({
      got: { declared: collected(m, 'diploDeclarations') },
      want: { declared: { 0: {}, 1: { 2: 'enemy' }, 2: {} } },
    }),
  },
  {
    name: 'a realm whose orders are refused still has its messages delivered',
    stage: (b) => ({ sends: { 1: { forTurn: b.G.turn + 1, messages: [{ to: [2], text: 'Hold the ford.' }] } } }),
    check: (o) => ({
      got: { told: told(o, dispatch(nm(o, 1), 'Hold the ford.')) },
      want: { told: [{ targets: [2], public: false }] },
    }),
    merged: (m) => ({
      got: { messages: collected(m, 'playerMessages') },
      want: { messages: { 0: [], 1: [{ to: [2], text: 'Hold the ford.' }], 2: [] } },
    }),
  },
  {
    name: 'a realm whose orders are refused still concedes, and its concession is told before the refusal',
    stage: (b) => ({ sends: { 1: { forTurn: b.G.turn + 1, concede: true } } }),
    check: (o) => ({
      got: {
        conceded: must(o.world.players[1], 'realm 1')['conceded'] ?? false,
        lines: o.all.filter((l) => l.actor === -1).map((l) => l.text),
      },
      want: { conceded: true, lines: [conceded(nm(o, 1)), stale(nm(o, 1), o.turn + 1, o.turn)] },
    }),
    merged: (m, s) => ({
      got: { warnings: collected(m, 'staleOrderWarnings') },
      want: {
        warnings: [
          conceded(nameOf(must(s.board, 'board'), 1)),
          stale(nameOf(must(s.board, 'board'), 1), m.turn + 1, m.turn),
        ],
      },
    }),
  },
];

// ── Declarations ─────────────────────────────────────────────────────────────────────────────────────────────────
export const DECLARATION_CASES: SetUpCase[] = [
  {
    name: 'a realm’s declaration of war is taken: war stands between the two at the turn’s end',
    stage: () => sending({ 1: { diplomacy: { 2: 'enemy' } } }),
    check: (o) => ({
      got: {
        relation: relation(o, 1, 2),
        told: told(o, war(nm(o, 1), nm(o, 2))).length > 0,
        refused: told(o, SAFE_START_LINE),
      },
      want: { relation: 'enemy', told: true, refused: [] },
    }),
    merged: (m) => ({
      got: { declared: collected(m, 'diploDeclarations'), refused: collected(m, 'safeStartRefused') },
      want: { declared: { 0: {}, 1: { 2: 'enemy' }, 2: {} }, refused: [] },
    }),
  },
  {
    name: 'under Safe Start a declaration of war is set aside, the realm alone is told, and relations stand',
    stage: (b) => {
      safeStart(b);
      return sending({ 1: { diplomacy: { 2: 'enemy' } } });
    },
    check: (o) => ({
      got: { relation: relation(o, 1, 2), told: told(o, SAFE_START_LINE) },
      want: { relation: 'neutral', told: [{ targets: [1], public: false }] },
    }),
    merged: (m) => ({
      got: { declared: collected(m, 'diploDeclarations'), refused: collected(m, 'safeStartRefused') },
      want: { declared: {}, refused: [1] },
    }),
  },
  {
    name: 'under Safe Start an offer to Treat is set aside the same way',
    stage: (b) => {
      safeStart(b);
      return sending({ 0: { diplomacy: { 1: 'treat' } }, 1: { diplomacy: { 0: 'treat' } } });
    },
    check: (o) => ({
      got: { relation: relation(o, 0, 1), told: told(o, SAFE_START_LINE).map((t) => t.targets) },
      want: { relation: 'enemy', told: [[0], [1]] },
    }),
    merged: (m) => ({ got: { refused: collected(m, 'safeStartRefused') }, want: { refused: [0, 1] } }),
  },
  {
    name: 'under Safe Start a realm that declares nothing (or only neutral) is told nothing',
    stage: (b) => {
      safeStart(b);
      return sending({ 2: { diplomacy: { 1: 'neutral' } } });
    },
    check: (o) => ({ got: { told: told(o, SAFE_START_LINE) }, want: { told: [] } }),
    merged: (m) => ({
      got: { declared: collected(m, 'diploDeclarations'), refused: collected(m, 'safeStartRefused') },
      want: { declared: {}, refused: [] },
    }),
  },
  {
    name: 'Safe Start is over with the orders for turn 6: the declaration is taken',
    stage: (b) => {
      safeStart(b);
      turnIs(b, 6);
      return sending({ 1: { diplomacy: { 2: 'enemy' } } });
    },
    check: (o) => ({
      got: { relation: relation(o, 1, 2), told: told(o, SAFE_START_LINE) },
      want: { relation: 'enemy', told: [] },
    }),
    merged: (m) => ({
      got: { refused: collected(m, 'safeStartRefused'), declared: (collected(m, 'diploDeclarations') as Raw)['1'] },
      want: { refused: [], declared: { 2: 'enemy' } },
    }),
  },
  {
    name: 'on turn 5 Safe Start still holds',
    stage: (b) => {
      safeStart(b);
      turnIs(b, 5);
      return sending({ 1: { diplomacy: { 2: 'enemy' } } });
    },
    check: (o) => ({
      got: { relation: relation(o, 1, 2), told: told(o, SAFE_START_LINE).length },
      want: { relation: 'neutral', told: 1 },
    }),
    merged: (m) => ({ got: { refused: collected(m, 'safeStartRefused') }, want: { refused: [1] } }),
  },
  {
    name: 'declarations sent as text, not as a table of realms, are not read',
    stage: () => sending({ 1: { diplomacy: '2:enemy' } }),
    check: (o) => ({ got: { relation: relation(o, 1, 2) }, want: { relation: 'neutral' } }),
    merged: (m) => ({
      got: { declared: (collected(m, 'diploDeclarations') as Raw)['1'] ?? null },
      want: { declared: null },
    }),
  },
  {
    name: 'declarations set to nothing are not read, and under Safe Start no realm is told',
    stage: (b) => {
      safeStart(b);
      return sending({ 1: { diplomacy: null } });
    },
    check: (o) => ({ got: { told: told(o, SAFE_START_LINE) }, want: { told: [] } }),
    merged: (m) => ({ got: { refused: collected(m, 'safeStartRefused') }, want: { refused: [] } }),
  },
];

// ── Research choices ─────────────────────────────────────────────────────────────────────────────────────────────
const CHOICE = ['sd03', 'sd04'];
const pursued = (o: Outcome, pi: number) =>
  starting(o, '💡 ').filter((t) => t.includes(must(o.world.players[pi], 'realm').name));
const pursues = (b: Board, pi: number, id: string) => `💡 ${nameOf(b, pi)} pursues **${discovery(b, id).name}**`;
const chosenFor = (b: Board, pi: number) =>
  `💡 No choice was sent, so ${nameOf(b, pi)}'s scholars choose for themselves and pursue`;
export const RESEARCH_CHOICE_CASES: SetUpCase[] = [
  {
    name: 'a realm’s research choice is taken: it pursues the lead it picked',
    stage: (b) => {
      pendingChoice(b, 1, 'k1', CHOICE);
      return { ...sending({ 1: { discoveryChoices: { k1: 'sd03' } } }), board: b };
    },
    check: (o, s) => ({
      got: { line: pursued(o, 1).map((t) => t.startsWith(pursues(must(s.board, 'board'), 1, 'sd03'))) },
      want: { line: [true] },
    }),
    merged: (m) => ({
      got: { picks: collected(m, 'discoveryChoicePicks') },
      want: { picks: { 0: {}, 1: { k1: 'sd03' }, 2: {} } },
    }),
  },
  {
    name: 'a choice sent with orders for another turn is not taken: the scholars choose',
    stage: (b) => {
      pendingChoice(b, 1, 'k1', CHOICE);
      return { ...sending({ 1: { discoveryChoices: { k1: 'sd03' }, forTurn: b.G.turn + 1 } }), board: b };
    },
    check: (o, s) => ({
      got: { line: pursued(o, 1).map((t) => t.startsWith(chosenFor(must(s.board, 'board'), 1))) },
      want: { line: [true] },
    }),
    merged: (m) => ({
      got: { picks: (collected(m, 'discoveryChoicePicks') as Raw)['1'] ?? null },
      want: { picks: null },
    }),
  },
  {
    name: 'a choice sent with no turn on the orders is taken',
    stage: (b) => {
      pendingChoice(b, 2, 'k2', CHOICE);
      return { ...sending({ 2: { discoveryChoices: { k2: 'sd03' }, forTurn: null } }), board: b };
    },
    check: (o, s) => ({
      got: { line: pursued(o, 2).map((t) => t.startsWith(pursues(must(s.board, 'board'), 2, 'sd03'))) },
      want: { line: [true] },
    }),
    merged: (m) => ({
      got: { picks: (collected(m, 'discoveryChoicePicks') as Raw)['2'] },
      want: { picks: { k2: 'sd03' } },
    }),
  },
  {
    name: 'choices sent as text are not read: the scholars choose',
    stage: (b) => {
      pendingChoice(b, 1, 'k1', CHOICE);
      return { ...sending({ 1: { discoveryChoices: 'k1=sd03' } }), board: b };
    },
    check: (o, s) => ({
      got: { line: pursued(o, 1).map((t) => t.startsWith(chosenFor(must(s.board, 'board'), 1))) },
      want: { line: [true] },
    }),
    merged: (m) => ({
      got: { picks: (collected(m, 'discoveryChoicePicks') as Raw)['1'] ?? null },
      want: { picks: null },
    }),
  },
];

// ── The Reckoning ────────────────────────────────────────────────────────────────────────────────────────────────
export const RECKONING_CASES: SetUpCase[] = [
  {
    name: 'a realm’s call for the Reckoning is taken: too early, it is told so',
    stage: () => sending({ 1: { callReckoning: true } }),
    check: (o) => ({ got: { told: told(o, tooEarly(nm(o, 1))).length }, want: { told: 1 } }),
    merged: (m) => ({ got: { calls: collected(m, 'reckoningCalls') }, want: { calls: [1] } }),
  },
  {
    name: 'a realm that has conceded can’t call the Reckoning',
    stage: (b) => {
      Object.assign(realm(b, 1), { conceded: true, concededTurn: 0 });
      return sending({ 1: { callReckoning: true } });
    },
    check: (o) => ({ got: { told: told(o, tooEarly(nm(o, 1))).length }, want: { told: 0 } }),
    merged: (m) => ({ got: { calls: collected(m, 'reckoningCalls') }, want: { calls: [] } }),
  },
  {
    name: 'a call sent as text (“true”) is not taken',
    stage: () => sending({ 2: { callReckoning: 'true' } }),
    check: (o) => ({ got: { told: told(o, tooEarly(nm(o, 2))).length }, want: { told: 0 } }),
    merged: (m) => ({ got: { calls: collected(m, 'reckoningCalls') }, want: { calls: [] } }),
  },
  {
    name: 'a realm that calls the Reckoning and concedes in the same orders has its call taken (it is read first)',
    stage: () => sending({ 1: { callReckoning: true, concede: true } }),
    check: (o) => ({
      got: { conceded: must(o.world.players[1], 'realm 1')['conceded'] ?? false },
      want: { conceded: true },
    }),
    merged: (m) => ({ got: { calls: collected(m, 'reckoningCalls') }, want: { calls: [1] } }),
  },
  {
    name: 'calls from two realms are both taken, in the rows’ order',
    stage: () => ({ ...sending({ 0: { callReckoning: true }, 2: { callReckoning: true } }), rowOrder: [2, 1, 0] }),
    check: (o) => ({
      got: { told: [0, 2].map((pi) => told(o, tooEarly(nm(o, pi))).length) },
      want: { told: [1, 1] },
    }),
    merged: (m) => ({ got: { calls: collected(m, 'reckoningCalls') }, want: { calls: [2, 0] } }),
  },
];

// ── Messages ─────────────────────────────────────────────────────────────────────────────────────────────────────
export const MESSAGE_CASES: SetUpCase[] = [
  {
    name: 'a realm’s message is delivered to the realm it is for, with a copy to the sender',
    stage: () => sending({ 0: { messages: [{ to: [2], text: 'Meet at the ford.' }] } }),
    check: (o) => ({
      got: {
        to: told(o, dispatch(nm(o, 0), 'Meet at the ford.')),
        copy: told(o, sentTo([nm(o, 2)], 'Meet at the ford.')),
      },
      want: { to: [{ targets: [2], public: false }], copy: [{ targets: [0], public: false }] },
    }),
    merged: (m) => ({
      got: { messages: (collected(m, 'playerMessages') as Raw)['0'] },
      want: { messages: [{ to: [2], text: 'Meet at the ford.' }] },
    }),
  },
  {
    name: 'messages sent as text, not as a list, are not delivered',
    stage: () => sending({ 0: { messages: 'Meet at the ford.' } }),
    check: (o) => ({ got: { lines: starting(o, '📨 ') }, want: { lines: [] } }),
    merged: (m) => ({
      got: { messages: (collected(m, 'playerMessages') as Raw)['0'] ?? null },
      want: { messages: null },
    }),
  },
  {
    name: 'every message a realm sends is delivered, in its order',
    stage: () =>
      sending({
        0: {
          messages: [
            { to: [1], text: 'Yield.' },
            { to: [2], text: 'Stand with us.' },
          ],
        },
      }),
    check: (o) => ({
      got: { lines: starting(o, '📨 Dispatch from ') },
      want: { lines: [dispatch(nm(o, 0), 'Yield.'), dispatch(nm(o, 0), 'Stand with us.')] },
    }),
    merged: (m) => ({ got: { n: ((collected(m, 'playerMessages') as Raw)['0'] as unknown[]).length }, want: { n: 2 } }),
  },
  {
    name: 'every realm’s messages are delivered',
    stage: () =>
      sending({ 1: { messages: [{ to: [0], text: 'Truce?' }] }, 2: { messages: [{ to: [1], text: 'Never.' }] } }),
    check: (o) => ({
      got: { lines: [told(o, dispatch(nm(o, 1), 'Truce?')), told(o, dispatch(nm(o, 2), 'Never.'))] },
      want: { lines: [[{ targets: [0], public: false }], [{ targets: [1], public: false }]] },
    }),
    merged: (m) => ({
      got: { messages: collected(m, 'playerMessages') },
      want: { messages: { 0: [], 1: [{ to: [0], text: 'Truce?' }], 2: [{ to: [1], text: 'Never.' }] } },
    }),
  },
];

// ── Concession ───────────────────────────────────────────────────────────────────────────────────────────────────
const concededOf = (w: World, pi: number) => {
  const pl = must(w.players[pi], 'realm ' + String(pi));
  return { conceded: pl['conceded'] ?? false, on: pl['concededTurn'] ?? null };
};
export const CONCESSION_CASES: SetUpCase[] = [
  {
    name: 'a realm that concedes is out from this turn, everyone is told, and its heroes hold whatever they were ordered',
    stage: (b) => ({ ...marcher(b), sends: { 1: { concede: true } } }),
    check: (o, s) => ({
      got: {
        realm: concededOf(o.world, 1),
        told: told(o, conceded(nm(o, 1))),
        at: whereIs(o.world, hero(s)),
        orders: ordersOf(o.first, hero(s)),
      },
      want: {
        realm: { conceded: true, on: o.turn },
        told: [{ targets: [], public: true }],
        at: hero(s).location,
        orders: [HOLD_CONCEDED, HOLD_CONCEDED, HOLD_CONCEDED, HOLD_CONCEDED, HOLD_CONCEDED],
      },
    }),
    merged: (m, s) => ({
      got: { realm: concededOf(m.G, 1), warnings: collected(m, 'staleOrderWarnings'), orders: mergedOrders(m, s) },
      want: {
        realm: { conceded: true, on: m.turn },
        warnings: [conceded(nameOf(must(s.board, 'board'), 1))],
        orders: [HOLD_CONCEDED, HOLD_CONCEDED, HOLD_CONCEDED, HOLD_CONCEDED, HOLD_CONCEDED],
      },
    }),
  },
  {
    name: 'a realm that conceded before is not told of again, and keeps the turn it conceded on',
    stage: (b) => {
      turnIs(b, 4);
      Object.assign(realm(b, 2), { conceded: true, concededTurn: 2 });
      return sending({ 2: { concede: true } });
    },
    check: (o) => ({
      got: { realm: concededOf(o.world, 2), told: told(o, conceded(nm(o, 2))) },
      want: { realm: { conceded: true, on: 2 }, told: [] },
    }),
    merged: (m) => ({
      got: { realm: concededOf(m.G, 2), warnings: collected(m, 'staleOrderWarnings') },
      want: { realm: { conceded: true, on: 2 }, warnings: [] },
    }),
  },
  {
    name: 'a concession sent as text (“true”) is not taken',
    stage: () => sending({ 0: { concede: 'true' } }),
    check: (o) => ({ got: { realm: concededOf(o.world, 0) }, want: { realm: { conceded: false, on: null } } }),
    merged: (m) => ({ got: { realm: concededOf(m.G, 0) }, want: { realm: { conceded: false, on: null } } }),
  },
  {
    name: 'a realm that conceded before has its heroes hold whatever it sends',
    stage: (b) => {
      Object.assign(realm(b, 1), { conceded: true, concededTurn: 0 });
      return marcher(b);
    },
    check: (o, s) => ({
      got: { at: whereIs(o.world, hero(s)), orders: ordersOf(o.first, hero(s)) },
      want: {
        at: hero(s).location,
        orders: [HOLD_CONCEDED, HOLD_CONCEDED, HOLD_CONCEDED, HOLD_CONCEDED, HOLD_CONCEDED],
      },
    }),
    merged: (m, s) => ({
      got: { orders: mergedOrders(m, s) },
      want: { orders: [HOLD_CONCEDED, HOLD_CONCEDED, HOLD_CONCEDED, HOLD_CONCEDED, HOLD_CONCEDED] },
    }),
  },
  {
    name: 'a conceded realm that sends no orders holds as conceded once another realm’s orders are read',
    stage: (b) => {
      Object.assign(realm(b, 1), { conceded: true, concededTurn: 0 });
      return { ...marcher(b), slots: { 1: { orders: null } } };
    },
    check: (o, s) => ({
      got: { orders: ordersOf(o.first, hero(s)) },
      want: { orders: [HOLD_CONCEDED, HOLD_CONCEDED, HOLD_CONCEDED, HOLD_CONCEDED, HOLD_CONCEDED] },
    }),
    merged: (m, s) => ({
      got: { orders: mergedOrders(m, s) },
      want: { orders: [HOLD_CONCEDED, HOLD_CONCEDED, HOLD_CONCEDED, HOLD_CONCEDED, HOLD_CONCEDED] },
    }),
  },
  {
    name: 'when no realm’s orders are read at all, a conceded realm’s hero Defends as any hero does',
    stage: (b) => {
      Object.assign(realm(b, 1), { conceded: true, concededTurn: 0 });
      const h = realmHero(b, 1);
      return { hero: h, slots: { 0: { orders: null }, 1: { orders: null }, 2: { orders: null } } };
    },
    check: (o, s) => ({
      got: { orders: ordersOf(o.first, hero(s)) },
      want: { orders: [DEFEND, DEFEND, DEFEND, DEFEND, DEFEND] },
    }),
    merged: (m, s) => ({ got: { orders: mergedOrders(m, s) }, want: { orders: NO_ORDERS } }),
  },
  {
    name: 'a conceded realm’s fallen hero is given no orders; its other realms’ heroes march as ordered',
    stage: (b) => {
      Object.assign(realm(b, 1), { conceded: true, concededTurn: 0 });
      const f = realmHero(b, 1, { alive: false });
      const s = marcher(b, 2);
      return { ...s, others: [f] };
    },
    check: (o, s) => ({
      got: { fallen: ordersOf(o.first, other(s, 0)), ...marched(o, s) },
      want: { fallen: null, ...MARCHED(s) },
    }),
    merged: (m, s) => ({
      got: { fallen: ordersOf(m.G, other(s, 0)), orders: mergedOrders(m, s) },
      want: { fallen: null, orders: MOVE_REST },
    }),
  },
  {
    name: 'concessions are told in the rows’ order',
    stage: () => ({ ...sending({ 0: { concede: true }, 2: { concede: true } }), rowOrder: [2, 1, 0] }),
    check: (o) => ({
      got: { lines: o.all.filter((l) => l.actor === -1).map((l) => l.text) },
      want: { lines: [conceded(nm(o, 2)), conceded(nm(o, 0))] },
    }),
    merged: (m, s) => ({
      got: { warnings: collected(m, 'staleOrderWarnings') },
      want: { warnings: [conceded(nameOf(must(s.board, 'board'), 2)), conceded(nameOf(must(s.board, 'board'), 0))] },
    }),
  },
];

// ── Orders held for a hero a realm means to raise, hire or charm ─────────────────────────────────────────────────
const held = (w: World, key: string) => (scratch(w, key) as Raw[] | null) ?? [];
export const HELD_ORDER_CASES: SetUpCase[] = [
  {
    name: 'orders written for a hero a realm means to raise are held until he rises, not given to him',
    stage: (b) => {
      const caster = realmHero(b, 1);
      return {
        hero: caster,
        sends: { 1: { orders: { [`resurrect_4321_via_${String(caster.id)}_ph2`]: plan(order('rest')) } } },
      };
    },
    check: (o, s) => ({
      got: { held: held(o.first, '_pendingResurrectOrders'), given: ordersOf(o.first, 4321) },
      want: {
        held: [{ heroId: 4321, casterId: hero(s).id, castPhase: 2, player: 1, orders: plan(order('rest')) }],
        given: null,
      },
    }),
    merged: (m, s) => ({
      got: {
        held: held(m.G, '_pendingResurrectOrders'),
        given: ordersOf(m.G, 4321),
        keys: orderedHeroes(m.G).filter((k) => k.startsWith('resurrect_')),
      },
      want: {
        held: [{ heroId: 4321, casterId: hero(s).id, castPhase: 2, player: 1, orders: plan(order('rest')) }],
        given: null,
        keys: [],
      },
    }),
  },
  {
    name: 'orders written for a hero a realm means to hire are held, the hirer named as sent (a hirer himself to be hired too)',
    stage: () => ({ sends: { 2: { orders: { hired_77_via_hired_55_via_9_ph1_ph3: plan(order('rest')) } } } }),
    check: (o) => ({
      got: { held: held(o.first, '_pendingHireOrders') },
      want: {
        held: [{ heroId: 77, viaId: 'hired_55_via_9_ph1', plannedPhase: 3, player: 2, orders: plan(order('rest')) }],
      },
    }),
    merged: (m) => ({
      got: { held: held(m.G, '_pendingHireOrders'), keys: orderedHeroes(m.G).filter((k) => k.startsWith('hired_')) },
      want: {
        held: [{ heroId: 77, viaId: 'hired_55_via_9_ph1', plannedPhase: 3, player: 2, orders: plan(order('rest')) }],
        keys: [],
      },
    }),
  },
  {
    name: 'orders written for a hero a realm means to charm are held until the charm lands',
    stage: () => ({ sends: { 0: { orders: { charm_88_via_12_ph0: plan(order('rest')) } } } }),
    check: (o) => ({
      got: { held: held(o.first, '_pendingCharmOrders') },
      want: { held: [{ heroId: 88, casterId: 12, castPhase: 0, player: 0, orders: plan(order('rest')) }] },
    }),
    merged: (m) => ({
      got: { held: held(m.G, '_pendingCharmOrders'), keys: orderedHeroes(m.G).filter((k) => k.startsWith('charm_')) },
      want: { held: [{ heroId: 88, casterId: 12, castPhase: 0, player: 0, orders: plan(order('rest')) }], keys: [] },
    }),
  },
  {
    name: 'two realms’ orders for one body to be raised are both held, each with its own realm',
    stage: () => ({
      sends: {
        0: { orders: { resurrect_500_via_10_ph1: plan(order('rest')) } },
        2: { orders: { resurrect_500_via_20_ph3: plan(order('defend')) } },
      },
    }),
    check: (o) => ({
      got: { held: held(o.first, '_pendingResurrectOrders').map((h) => [h['player'], h['casterId'], h['castPhase']]) },
      want: {
        held: [
          [0, 10, 1],
          [2, 20, 3],
        ],
      },
    }),
    merged: (m) => ({
      got: { held: held(m.G, '_pendingResurrectOrders').map((h) => [h['player'], h['casterId'], h['castPhase']]) },
      want: {
        held: [
          [0, 10, 1],
          [2, 20, 3],
        ],
      },
    }),
  },
  {
    name: 'a written key that doesn’t match the form names no hero of the realm’s: it is set aside, and held for nobody',
    stage: () => ({
      sends: {
        1: {
          orders: {
            resurrect_x_via_3_ph1: plan(order('rest')),
            hired_5_ph1: plan(order('rest')),
            resurrect_5_via_hired_3_via_1_ph0_ph2: plan(order('rest')),
            resurrect_6_via_3_ph2x: plan(order('rest')),
            charm_7_via_x_ph1: plan(order('rest')),
            '9z': plan(order('rest')),
          },
        },
      },
    }),
    check: (o) => ({
      got: {
        keys: orderedHeroes(o.first).filter((k) => !/^\d+$/.test(k)),
        held: [held(o.first, '_pendingResurrectOrders'), held(o.first, '_pendingHireOrders')],
      },
      want: {
        keys: [],
        held: [[], []],
      },
    }),
    merged: (m) => ({
      got: {
        keys: orderedHeroes(m.G).filter((k) => !/^\d+$/.test(k)),
        held: [held(m.G, '_pendingResurrectOrders'), held(m.G, '_pendingCharmOrders'), held(m.G, '_pendingHireOrders')],
        nine: ordersOf(m.G, 9),
      },
      want: {
        keys: [],
        held: [[], [], []],
        nine: null,
      },
    }),
  },
];

// ── Encounter plans ──────────────────────────────────────────────────────────────────────────────────────────────
const FLEE = { tactics: ['FL'], duelStance: 'refuse' };
const STAND = { tactics: ['MA', 'MA'], duelStance: 'accept' };
const FULL = { tactics: ['FL', 'CS:white'], notes: 'For the crown!', duelStance: 'refuse', evilMode: 'enslave' };
export const PLAN_CASES: SetUpCase[] = [
  {
    name: 'a realm’s encounter plan for its hero is set, and kept for later turns',
    stage: (b) => {
      const h = realmHero(b, 1);
      return { hero: h, sends: { 1: { encounterPlans: { [h.id]: FLEE } } } };
    },
    check: (o, s) => ({ got: { plan: charIn(o.world, hero(s))['encounterPlan'] }, want: { plan: FLEE } }),
    merged: (m, s) => ({ got: { plan: charIn(m.G, hero(s))['encounterPlan'] }, want: { plan: FLEE } }),
  },
  {
    name: 'a plan sent as nothing leaves the hero’s plan as it was',
    stage: (b) => {
      const h = realmHero(b, 1, { encounterPlan: STAND });
      return { hero: h, sends: { 1: { encounterPlans: { [h.id]: null } } } };
    },
    check: (o, s) => ({ got: { plan: charIn(o.world, hero(s))['encounterPlan'] }, want: { plan: STAND } }),
    merged: (m, s) => ({ got: { plan: charIn(m.G, hero(s))['encounterPlan'] }, want: { plan: STAND } }),
  },
  {
    name: 'a plan on the card of a hero a realm means to hire is held until he is hired, not set on him',
    stage: (b) => {
      const w = Object.assign(wanderer(b), { encounterPlan: STAND });
      return { hero: w, sends: { 2: { encounterPlans: { [`hired_${String(w.id)}_via_9_ph1`]: FLEE } } } };
    },
    check: (o, s) => ({
      got: { held: held(o.first, '_pendingSynthPlans'), plan: charIn(o.first, hero(s))['encounterPlan'] },
      want: { held: [{ heroId: hero(s).id, player: 2, plan: FLEE }], plan: STAND },
    }),
    merged: (m, s) => ({
      got: { held: held(m.G, '_pendingSynthPlans'), plan: charIn(m.G, hero(s))['encounterPlan'] },
      want: { held: [{ heroId: hero(s).id, player: 2, plan: FLEE }], plan: STAND },
    }),
  },
  {
    name: 'plans on the cards of heroes to be raised or charmed are held the same way',
    stage: () => ({
      sends: { 0: { encounterPlans: { resurrect_61_via_hired_3_via_1_ph0_ph2: FLEE, charm_62_via_4_ph1: STAND } } },
    }),
    check: (o) => ({
      got: { held: held(o.first, '_pendingSynthPlans') },
      want: {
        held: [
          { heroId: 61, player: 0, plan: FLEE },
          { heroId: 62, player: 0, plan: STAND },
        ],
      },
    }),
    merged: (m) => ({
      got: { held: held(m.G, '_pendingSynthPlans') },
      want: {
        held: [
          { heroId: 61, player: 0, plan: FLEE },
          { heroId: 62, player: 0, plan: STAND },
        ],
      },
    }),
  },
  {
    name: 'a plan on a card whose key doesn’t match the form is held for nobody and set on nobody',
    stage: () => ({ sends: { 0: { encounterPlans: { hired_64_via_4_ph1x: FLEE } } } }),
    check: (o) => ({ got: { held: held(o.first, '_pendingSynthPlans') }, want: { held: [] } }),
    merged: (m) => ({ got: { held: held(m.G, '_pendingSynthPlans') }, want: { held: [] } }),
  },
  {
    name: 'a plan sent as nothing on a card is not held',
    stage: () => ({ sends: { 0: { encounterPlans: { hired_63_via_4_ph1: null } } } }),
    check: (o) => ({ got: { held: held(o.first, '_pendingSynthPlans') }, want: { held: [] } }),
    merged: (m) => ({ got: { held: held(m.G, '_pendingSynthPlans') }, want: { held: [] } }),
  },
  {
    name: 'an encounter plan keeps only the fields a plan has: its tactics, notes, duel stance and conquest doctrine',
    stage: (b) => {
      const h = realmHero(b, 1);
      const sent = { ...FULL, _botStance: true, _auto: true, hp: 99 };
      return { hero: h, sends: { 1: { encounterPlans: { [h.id]: sent } } } };
    },
    check: (o, s) => ({ got: { plan: charIn(o.world, hero(s))['encounterPlan'] }, want: { plan: FULL } }),
    merged: (m, s) => ({ got: { plan: charIn(m.G, hero(s))['encounterPlan'] }, want: { plan: FULL } }),
  },
  {
    name: 'a field of a plan sent as the wrong kind is not kept, nor a tactic that isn’t text',
    stage: (b) => {
      const h = realmHero(b, 1);
      const sent = { tactics: ['FL', 5], notes: 7, duelStance: 'refuse', evilMode: null };
      return { hero: h, sends: { 1: { encounterPlans: { [h.id]: sent } } } };
    },
    check: (o, s) => ({ got: { plan: charIn(o.world, hero(s))['encounterPlan'] }, want: { plan: FLEE } }),
    merged: (m, s) => ({ got: { plan: charIn(m.G, hero(s))['encounterPlan'] }, want: { plan: FLEE } }),
  },
  {
    name: 'a plan sent as text, not as a plan, leaves the hero’s plan as it was',
    stage: (b) => {
      const h = realmHero(b, 1, { encounterPlan: STAND });
      return { hero: h, sends: { 1: { encounterPlans: { [h.id]: 'FL' } } } };
    },
    check: (o, s) => ({ got: { plan: charIn(o.world, hero(s))['encounterPlan'] }, want: { plan: STAND } }),
    merged: (m, s) => ({ got: { plan: charIn(m.G, hero(s))['encounterPlan'] }, want: { plan: STAND } }),
  },
  {
    name: 'a plan held for a hero to be hired keeps only the fields a plan has',
    stage: (b) => {
      const w = wanderer(b);
      const sent = { ...FULL, _botStance: true, hp: 99 };
      return { hero: w, sends: { 2: { encounterPlans: { [`hired_${String(w.id)}_via_9_ph1`]: sent } } } };
    },
    check: (o, s) => ({
      got: { held: held(o.first, '_pendingSynthPlans') },
      want: { held: [{ heroId: hero(s).id, player: 2, plan: FULL }] },
    }),
    merged: (m, s) => ({
      got: { held: held(m.G, '_pendingSynthPlans') },
      want: { held: [{ heroId: hero(s).id, player: 2, plan: FULL }] },
    }),
  },
  {
    name: 'a plan for a hero nobody has is set on nobody, and the turn goes on',
    stage: (b) => ({ ...marcher(b), sends: { 1: { encounterPlans: { 987654: FLEE } } } }),
    check: (o, s) => ({ got: marched(o, s), want: MARCHED(s) }),
    merged: (m) => ({
      got: { planned: m.G.characters.filter((c) => c['encounterPlan'] === FLEE).length },
      want: { planned: 0 },
    }),
  },
];

// ── A new heir's choices ─────────────────────────────────────────────────────────────────────────────────────────
const heirOf = (w: World, c: Character) => {
  const h = charIn(w, c);
  return {
    skills: h.skills,
    name: h.name,
    temper: h['temper'],
    heir: h['_isHeir'] ?? false,
    allocation: h['_pendingSkillAllocation'] ?? null,
  };
};
/** An heir's crowned skills, and those skills with his four points placed (one each in melee, tactical, march, spy). */
const CROWNED = { melee: 2, tactical: 1, march: 1 };
const SKILLS = { melee: 3, tactical: 2, march: 2, spy: 1 };
/** The name an heir is crowned with, where a case needs it after the merge has renamed him. */
const CROWNED_AS = 'Edric the Young';
/** Realm 1's heir, crowned with CROWNED as CROWNED_AS, sent `skills` (named and tempered as the first case). */
const heirSent = (b: Board, skills: unknown, extra: Raw = {}): Staged => {
  const h = Object.assign(heirCrownedWith(b, 1, CROWNED), { name: CROWNED_AS }, extra);
  return { hero: h, sends: { 1: { kingSkills: { [h.id]: { skills, name: 'Aldric the Bold', temper: 'Brave' } } } } };
};
/** The heir after a set-aside: his crowned skills, but the name and temper chosen, and an heir no longer. */
const KEPT_CROWN = { skills: CROWNED, name: 'Aldric the Bold', temper: 'Brave', heir: false, allocation: null };
/** A case where realm 1's heir is sent `skills` that aren't his crowned skills plus at most his points. */
const setAside = (name: string, skills: unknown, extra: Raw = {}, points = 4): SetUpCase => ({
  name,
  stage: (b) => heirSent(b, skills, extra),
  check: (o, s) => ({
    got: { heir: heirOf(o.first, hero(s)), told: told(o, heirSkillsSetAside(nm(o, 1), CROWNED_AS, points)) },
    want: { heir: KEPT_CROWN, told: [{ targets: [], public: false }] },
  }),
  merged: (m, s) => ({
    got: { heir: heirOf(m.G, hero(s)), warnings: collected(m, 'staleOrderWarnings') },
    want: {
      heir: KEPT_CROWN,
      warnings: [heirSkillsSetAside(nameOf(must(s.board, 'board'), 1), CROWNED_AS, points)],
    },
  }),
});
export const HEIR_CASES: SetUpCase[] = [
  {
    name: 'a new heir is given the skills, name and temper his realm chose, and is an heir no longer',
    stage: (b) => {
      const h = heirCrownedWith(b, 1, CROWNED);
      return {
        hero: h,
        sends: { 1: { kingSkills: { [h.id]: { skills: SKILLS, name: '  Aldric the Bold  ', temper: 'Brave' } } } },
      };
    },
    check: (o, s) => ({
      got: { heir: heirOf(o.first, hero(s)) },
      want: { heir: { skills: SKILLS, name: 'Aldric the Bold', temper: 'Brave', heir: false, allocation: null } },
    }),
    merged: (m, s) => ({
      got: { heir: heirOf(m.G, hero(s)) },
      want: { heir: { skills: SKILLS, name: 'Aldric the Bold', temper: 'Brave', heir: false, allocation: null } },
    }),
  },
  {
    name: 'an heir may be given fewer points than he has (two in one skill): the rest are not kept for later',
    stage: (b) => heirSent(b, { melee: 4, tactical: 1, march: 1 }),
    check: (o, s) => ({
      got: { heir: heirOf(o.first, hero(s)), told: starting(o, '⚠ Set aside') },
      want: { heir: { ...KEPT_CROWN, skills: { melee: 4, tactical: 1, march: 1 } }, told: [] },
    }),
    merged: (m, s) => ({
      got: { heir: heirOf(m.G, hero(s)), warnings: collected(m, 'staleOrderWarnings') },
      want: { heir: { ...KEPT_CROWN, skills: { melee: 4, tactical: 1, march: 1 } }, warnings: [] },
    }),
  },
  setAside(
    'an heir’s skills are his crowned skills plus at most his points: more points are set aside, he keeps his crowned skills, and the GM is told',
    { melee: 4, tactical: 3, march: 2 },
  ),
  setAside('an heir is given no more than two points in one skill: three are set aside', {
    melee: 5,
    tactical: 1,
    march: 1,
  }),
  setAside('an heir’s skills never fall below his crowned skills: a skill lowered to raise others is set aside', {
    melee: 1,
    tactical: 1,
    march: 1,
    spy: 2,
    sage: 2,
  }),
  setAside('an heir’s skills are skills the game has: one it doesn’t know is set aside', {
    melee: 2,
    tactical: 1,
    march: 1,
    flying: 1,
  }),
  setAside('an heir’s skill levels are whole numbers: a fraction is set aside', { melee: 2.5, tactical: 1, march: 1 }),
  setAside('an heir’s skills sent as a list, not by skill, are set aside', [3, 2, 2]),
  setAside(
    'the points an heir may place are those the game gave him, whatever the orders say: two points, sent three, are set aside',
    { melee: 3, tactical: 2, march: 2 },
    { _pendingSkillAllocation: 2 },
    2,
  ),
  {
    name: 'an heir’s name is cut to 40 letters, once the spaces around it are gone',
    stage: (b) => {
      const h = heir(b, 0);
      return { hero: h, sends: { 0: { kingSkills: { [h.id]: { name: '   ' + 'A'.repeat(45) } } } } };
    },
    check: (o, s) => ({ got: { name: charIn(o.world, hero(s)).name }, want: { name: 'A'.repeat(40) } }),
    merged: (m, s) => ({ got: { name: charIn(m.G, hero(s)).name }, want: { name: 'A'.repeat(40) } }),
  },
  {
    name: 'an heir sent a temper the game doesn’t know, and an empty name, keeps his own; his skills as they were, he is an heir no longer',
    stage: (b) => {
      const h = heir(b, 2);
      return {
        hero: h,
        others: [],
        sends: { 2: { kingSkills: { [h.id]: { name: '   ', temper: 'Reckless' } } } },
        board: b,
      };
    },
    check: (o, s) => ({
      got: { heir: heirOf(o.first, hero(s)) },
      want: { heir: { skills: hero(s).skills, name: hero(s).name, temper: 'Cautious', heir: false, allocation: null } },
    }),
    merged: (m, s) => ({
      got: { heir: heirOf(m.G, hero(s)) },
      want: { heir: { skills: hero(s).skills, name: hero(s).name, temper: 'Cautious', heir: false, allocation: null } },
    }),
  },
  {
    name: 'a hero who isn’t a new heir is left as he is',
    stage: (b) => {
      const k = kingOf(b, 1);
      return {
        hero: k,
        sends: { 1: { kingSkills: { [k.id]: { skills: SKILLS, name: 'Usurper', temper: 'Brave' } } } },
      };
    },
    check: (o, s) => ({
      got: { name: charIn(o.world, hero(s)).name, temper: charIn(o.world, hero(s))['temper'] },
      want: { name: hero(s).name, temper: hero(s)['temper'] },
    }),
    merged: (m, s) => ({
      got: { name: charIn(m.G, hero(s)).name, skills: charIn(m.G, hero(s)).skills },
      want: { name: hero(s).name, skills: hero(s).skills },
    }),
  },
  {
    name: 'an heir sent no choices at all is still an heir',
    stage: (b) => {
      const h = heir(b, 1);
      return { hero: h, sends: { 1: { kingSkills: { [h.id]: null } } } };
    },
    check: (o, s) => ({ got: { heir: charIn(o.first, hero(s))['_isHeir'] ?? false }, want: { heir: true } }),
    merged: (m, s) => ({
      got: { heir: heirOf(m.G, hero(s)).heir, allocation: heirOf(m.G, hero(s)).allocation },
      want: { heir: true, allocation: 4 },
    }),
  },
];

// ── Only a realm's own heroes take what it sends ─────────────────────────────────────────────────────────────────
/** Realm 0's hero in the middle, and realm 1's orders naming him: march to the province next to the middle. */
const namedBy1 = (b: Board, extra: Raw = {}): Staged => {
  const h = realmHero(b, 0, extra);
  return { hero: h, there: ring1(b, 0), sends: { 1: { orders: { [h.id]: plan(order('move', ring1(b, 0).id)) } } } };
};
const RESTS = [REST, REST, REST, REST, REST];
/** The GM's line for the case's hero, named by realm 1 (in a whole turn, or called directly). */
const toldOf1 = (o: Outcome, s: Staged) => told(o, notInService(nm(o, 1), [hero(s).id]));
const warnedOf1 = (s: Staged) => [notInService(nameOf(must(s.board, 'board'), 1), [hero(s).id])];
const GM_ONLY = [{ targets: [], public: false }];
export const OWN_CASES: SetUpCase[] = [
  {
    name: 'a hero takes orders only from his own realm: another realm’s orders for him are set aside, the GM is told, and he does as his own realm ordered',
    stage: (b) => namedBy1(b),
    check: (o, s) => ({
      got: { orders: ordersOf(o.first, hero(s)), at: whereIs(o.world, hero(s)), told: toldOf1(o, s) },
      want: { orders: RESTS, at: hero(s).location, told: GM_ONLY },
    }),
    merged: (m, s) => ({
      got: { orders: ordersOf(m.G, hero(s)), warnings: collected(m, 'staleOrderWarnings') },
      want: { orders: RESTS, warnings: warnedOf1(s) },
    }),
  },
  {
    name: 'a hero takes orders only from his own realm, whichever row comes first',
    stage: (b) => ({ ...namedBy1(b), rowOrder: [1, 0, 2] }),
    check: (o, s) => ({
      got: { orders: ordersOf(o.first, hero(s)), at: whereIs(o.world, hero(s)) },
      want: { orders: RESTS, at: hero(s).location },
    }),
    merged: (m, s) => ({ got: { orders: ordersOf(m.G, hero(s)) }, want: { orders: RESTS } }),
  },
  {
    name: 'a wandering hero takes no realm’s orders: they are set aside, and the GM is told',
    stage: (b) => {
      const w = wanderer(b);
      return { hero: w, sends: { 1: { orders: { [w.id]: plan(order('move', ring1(b, 0).id)) } } } };
    },
    check: (o, s) => ({
      got: { orders: ordersOf(o.first, hero(s)), told: toldOf1(o, s) },
      want: { orders: null, told: GM_ONLY },
    }),
    merged: (m, s) => ({
      got: { orders: ordersOf(m.G, hero(s)), warnings: collected(m, 'staleOrderWarnings') },
      want: { orders: null, warnings: warnedOf1(s) },
    }),
  },
  {
    name: 'a hero’s encounter plan is set only by his own realm: another realm’s is set aside, and the GM is told',
    stage: (b) => {
      const h = realmHero(b, 0, { encounterPlan: STAND });
      return { hero: h, sends: { 1: { encounterPlans: { [h.id]: FLEE } } } };
    },
    check: (o, s) => ({
      got: { plan: charIn(o.world, hero(s))['encounterPlan'], told: toldOf1(o, s) },
      want: { plan: STAND, told: GM_ONLY },
    }),
    merged: (m, s) => ({
      got: { plan: charIn(m.G, hero(s))['encounterPlan'], warnings: collected(m, 'staleOrderWarnings') },
      want: { plan: STAND, warnings: warnedOf1(s) },
    }),
  },
  {
    name: 'an heir’s skills, name and temper are chosen only by his own realm: another realm’s choices are set aside, he is still an heir, and the GM is told',
    stage: (b) => {
      const h = heirCrownedWith(b, 0, CROWNED);
      return {
        hero: h,
        sends: { 1: { kingSkills: { [h.id]: { skills: SKILLS, name: 'Usurper', temper: 'Brave' } } } },
      };
    },
    check: (o, s) => ({
      got: { heir: heirOf(o.first, hero(s)), told: toldOf1(o, s) },
      want: {
        heir: { skills: CROWNED, name: hero(s).name, temper: 'Cautious', heir: true, allocation: 4 },
        told: GM_ONLY,
      },
    }),
    merged: (m, s) => ({
      got: { heir: heirOf(m.G, hero(s)), warnings: collected(m, 'staleOrderWarnings') },
      want: {
        heir: { skills: CROWNED, name: hero(s).name, temper: 'Cautious', heir: true, allocation: 4 },
        warnings: warnedOf1(s),
      },
    }),
  },
  {
    name: 'what a realm sends for heroes not its own is told to the GM in one line, each hero once, in the order sent',
    stage: (b) => {
      const h = realmHero(b, 0, { encounterPlan: STAND });
      const w = wanderer(b);
      return {
        hero: h,
        others: [w],
        sends: {
          1: {
            orders: { [h.id]: plan(order('rest')), [w.id]: plan(order('rest')) },
            encounterPlans: { [h.id]: FLEE },
          },
        },
      };
    },
    check: (o, s) => ({
      got: { told: told(o, notInService(nm(o, 1), [hero(s).id, other(s, 0).id])) },
      want: { told: GM_ONLY },
    }),
    merged: (m, s) => ({
      got: { warnings: collected(m, 'staleOrderWarnings') },
      want: { warnings: [notInService(nameOf(must(s.board, 'board'), 1), [hero(s).id, other(s, 0).id])] },
    }),
  },
  {
    name: 'a realm whose orders name only its own heroes is told nothing',
    stage: (b) => marcher(b),
    check: (o) => ({ got: { told: starting(o, '⚠ Set aside') }, want: { told: [] } }),
    merged: (m) => ({ got: { warnings: collected(m, 'staleOrderWarnings') }, want: { warnings: [] } }),
  },
];

// ── The turn's record of orders ──────────────────────────────────────────────────────────────────────────────────
const recordOf = (o: Outcome, pi: number) => must(o.record[String(pi)], 'the record of realm ' + String(pi));
export const RECORD_CASES: SetUpCase[] = [
  {
    name: 'the turn’s record of a realm’s orders shows its heroes’ orders, its declarations and its Reckoning call as merged',
    stage: (b) => ({ ...marcher(b), sends: { 1: { diplomacy: { 2: 'enemy' }, callReckoning: true } } }),
    check: (o, s) => {
      const r = recordOf(o, 1);
      const ph = ((r['chars'] as Record<string, Raw>)[String(hero(s).id)]?.['ph'] as Raw[]).map((x) => x['a']);
      return {
        got: { ph, diplomacy: r['diplomacy'], call: r['callReckoning'] ?? false },
        want: { ph: ['move', 'rest', 'rest', 'rest', 'rest'], diplomacy: { 2: 'enemy' }, call: true },
      };
    },
  },
  {
    name: 'the turn’s record shows a realm that conceded this turn, and the plan of its hero',
    stage: (b) => {
      const h = realmHero(b, 2);
      return { hero: h, sends: { 2: { concede: true, encounterPlans: { [h.id]: STAND } } } };
    },
    check: (o, s) => {
      const r = recordOf(o, 2);
      return {
        got: { concede: r['concede'] ?? false, plan: (r['plans'] as Raw | undefined)?.[String(hero(s).id)] ?? null },
        want: { concede: true, plan: STAND.tactics },
      };
    },
  },
  {
    name: 'the turn’s record of a realm that sent nothing shows no declaration, call or concession',
    stage: () => ({ slots: { 0: { orders: null } } }),
    check: (o) => {
      const r = recordOf(o, 0);
      return {
        got: { diplomacy: r['diplomacy'] ?? null, call: r['callReckoning'] ?? null, concede: r['concede'] ?? null },
        want: { diplomacy: null, call: null, concede: null },
      };
    },
  },
];

/** Every case, by part of the two stages. */
export const SET_UP_CASES: [string, SetUpCase[]][] = [
  ['the turn’s start repairs', REPAIR_CASES],
  ['which orders are read', READ_CASES],
  ['the heroes’ order', HERO_ORDER_CASES],
  ['orders for another turn', STALE_CASES],
  ['declarations', DECLARATION_CASES],
  ['research choices', RESEARCH_CHOICE_CASES],
  ['the Reckoning', RECKONING_CASES],
  ['messages', MESSAGE_CASES],
  ['concession', CONCESSION_CASES],
  ['orders held for a hero to come', HELD_ORDER_CASES],
  ['encounter plans', PLAN_CASES],
  ['a new heir’s choices', HEIR_CASES],
  ['only a realm’s own heroes', OWN_CASES],
  ['the turn’s record of orders', RECORD_CASES],
];
