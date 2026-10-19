// The bots' diplomacy (plan P1-08l1, lifted out of resolveTurn): each bot realm writes its declarations for the turn
// into the realms' declarations, as a human realm's arrive with its orders: a Treat or war on each rival it had met when
// the turn began. First a human realm's war on a bot is remembered for good (the grudge, on the bot's own record). Then,
// for each bot, in order: Safe Start (nothing); a conceded bot, or one with neither king nor land (nothing); for each
// rival, one that has conceded or has neither king nor land is passed over; under the Aggressive setting, war on every
// human realm; when a rival's king holds a claim to the throne, war on the claimant and a Treat to everyone else (but a
// bot allied to the claimant and of his creed keeps faith); a grudge bends only when the human is five times the bot's
// strength (a truce, Treats until it is two times or less again; then an alliance is broken); a rival of the bot's creed
// or one step from it is offered a Treat until allied (never by a grudge, nor at peace while it is allied to one of the
// bot's foes); an ally is kept; anyone else is weighed (`botWarAssess`: war, or peace with a foe).
// resolveTurn makes the declarations twice: before the first phase (between the research choices and war without
// warning) and after the phases, just before diplomacy is resolved.
// Staged on the middle of a bot world (lib/middle-of-a-bot-world.ts), as P1-08k8's cases are: plain realms of the
// Divine creed, each holding only its seat with a living king there, every realm having met every other, realms 0 and 1
// at war, 0 and 2 allied, 1 and 2 at peace, Safe Start over, each realm a player's but those the case makes bots'.
// scenario/bot-diplomacy-in-a-whole-turn.test.ts plays each through a whole turn (resolveTurn) and reads the realms'
// declarations at two moments: once the bots have declared before the first phase (`early`) and just before diplomacy
// is resolved (`late`); unit/bot-diplomacy-called-directly.test.ts calls the function once, as resolveTurn calls it
// first. Where the bots' strength reckoning or war assessment decides (src/engine/bots/war.js, not part of this
// function), a case stands it in for the turn's length by a fixed answer (`instead`), recording what it is handed.
// Every outcome is certain: every case fixes the dice for the whole turn (LANDS).
import vm from 'node:vm';
import { engineFn } from './engine.ts';
import { must, type Board, type Line, type World } from './middle-of-a-bot-world.ts';
import { withCaseDice } from './espionage-order-cases.ts';
import { claim, landless, relate, turnIs, unmet } from './diplomacy-and-victory-cases.ts';
import { safeStart } from './set-up-and-order-merge-cases.ts';
import {
  LANDS,
  creed,
  kingOf,
  prepare,
  realm,
  rows,
  stageCase as stageBeforeCase,
  type BeforeCase,
  type Staged as BeforeStaged,
} from './before-the-first-phase-cases.ts';

export { LANDS, claim, creed, kingOf, landless, realm, relate, safeStart, turnIs, unmet };
type Raw = Record<string, unknown>;
type Fn = (...a: unknown[]) => unknown;
/** The realms' declarations: realm index → (realm index → 'treat' or 'enemy'). */
export type Declarations = Record<string, Record<string, string>>;
/** The helpers of src/engine/bots/war.js a case may stand in for the turn's length. */
export const HELPERS = ['botWarAssess', 'botOwnPower', 'botRivalPower', 'botAlignFriendly'] as const;
export type Helper = (typeof HELPERS)[number];
/** A helper stood in: handed which declarations it is called for, then the call's arguments but the state. */
export type StandIn = (when: Call['when'], ...a: unknown[]) => unknown;
export type Instead = Partial<Record<Helper, StandIn>>;
export interface Staged extends BeforeStaged {
  /** The realms that are bots' (a slot row with no player and `isBot` in its report). */
  bots: number[];
  /** Helpers stood in for the turn's length, each by a fixed answer. */
  instead?: Instead;
}
/** One call of a stood-in helper: which, the bots' declarations it came from (the first or the second), and what it
 *  was handed, the state aside. */
export interface Call {
  fn: Helper;
  when: 'early' | 'late';
  args: unknown[];
}
export interface Outcome {
  /** The realms' declarations once the bots have declared before the first phase (the humans' with them). */
  early: Declarations;
  /** Each realm's grudges then (the realms its record holds a grudge against), by realm. */
  grudgesEarly: (number[] | null)[];
  /** The realms' declarations just before diplomacy is resolved, after the phases (called directly: after the second
   *  call). */
  late: Declarations;
  /** The world after the turn (or after the call). */
  world: World;
  /** The calls of the stood-in helpers, in order. */
  calls: Call[];
  /** Every line of the log. */
  all: Line[];
  /** Whether the outcome is a whole turn's (or a direct call's). */
  whole: boolean;
}
export interface BotDiplomacyCase {
  name: string;
  /** Plays only in a whole turn: what the case reads is the second declarations, after the phases. */
  wholeTurnOnly?: boolean;
  stage(b: Board): Staged;
  /** What the case found, and what it should have found: the same keys. */
  check(o: Outcome, s: Staged): { got: Record<string, unknown>; want: Record<string, unknown> };
}

// ── Reading ──────────────────────────────────────────────────────────────────────────────────────────────────────
const json = (v: unknown): unknown => JSON.parse(JSON.stringify(v ?? null));
const grudgesOf = (G: { players: unknown[] }) =>
  G.players.map((p) => {
    const g = (p as Raw | null)?.['botGrudges'];
    return Array.isArray(g) ? (json(g) as number[]) : null;
  });
/** Records each call of the helpers stood in by `instead`, tagged with `when()`, for the length of `body`. */
function standingIn<T>(
  engine: vm.Context,
  instead: Instead | undefined,
  when: () => Call['when'],
  body: (calls: Call[]) => T,
) {
  const g = engine;
  const calls: Call[] = [];
  const was = Object.keys(instead ?? {}).map((f) => [f as Helper, g[f] as Fn] as const);
  for (const [f] of was)
    g[f] = (...args: unknown[]) => {
      const w = when();
      calls.push({ fn: f, when: w, args: json(args.slice(1)) as unknown[] });
      return must(instead?.[f], f)(w, ...args.slice(1));
    };
  try {
    return body(calls);
  } finally {
    for (const [f, w] of was) g[f] = w;
  }
}

// ── Playing a case ───────────────────────────────────────────────────────────────────────────────────────────────
/** resolveTurn's stages either side of the bots' declarations (P1-08k8's and P1-08k3's, P1-08k4's). */
const FIRST = 'relationsReadyAndLastTurnsResearchChoicesSettledWithTheBotsOwnPicks';
const AFTER_FIRST = 'warWithoutWarningTitlesHeldSafeStartAndStaleOrderLinesGmRemovalsAndMessages';
const BEFORE_LATE = 'afterThePhasesStandOffsTheDeadGravesCouriersMassHealingCowardsAndLocationNames';
const AFTER_LATE = 'diplomacyResolutionOverturesPeaceAlliancesWarAndWarFrontWarnings';
/** Plays `c`, staged as `s` on `b`, through a whole turn, with every die fixed (LANDS); the realms' declarations are read
 *  as the stage after each of the bots' two declarations begins (each wrapped in the vm for the turn's length). */
export const playCase = (b: Board, _c: BotDiplomacyCase, s: Staged): Outcome => {
  const g = b.engine;
  const was = [FIRST, AFTER_FIRST, BEFORE_LATE, AFTER_LATE].map((f) => [f, g[f] as Fn] as const);
  const seen: { early?: Declarations; grudgesEarly?: (number[] | null)[]; late?: Declarations } = {};
  let when: Call['when'] = 'early';
  const wrap = (f: string, before: (tc: Raw) => void) => {
    const w = must(
      was.find(([n]) => n === f),
      f,
    )[1];
    g[f] = (tc: Raw, ...rest: unknown[]) => {
      before(tc);
      return w(tc, ...rest);
    };
  };
  wrap(FIRST, () => {
    when = 'early';
  });
  wrap(AFTER_FIRST, (tc) => {
    seen.early = json(tc['diploDeclarations']) as Declarations;
    seen.grudgesEarly = grudgesOf(tc['G'] as World);
  });
  wrap(BEFORE_LATE, () => {
    when = 'late';
  });
  wrap(AFTER_LATE, (tc) => {
    seen.late = json(tc['diploDeclarations']) as Declarations;
  });
  const resolveTurn = engineFn(b.engine, 'resolveTurn') as (
    state: string,
    rows: unknown,
    turn: number,
  ) => { state: string; log: Line[] };
  const inVm = vm.runInContext('(j)=>JSON.parse(j)', b.engine) as (j: string) => unknown;
  try {
    const slotRows = rows(b, s);
    const state = JSON.stringify(b.G);
    return standingIn(
      b.engine,
      s.instead,
      () => when,
      (calls) => {
        const r = withCaseDice(b.engine, LANDS, () => resolveTurn(state, inVm(slotRows), b.G.turn));
        return {
          early: must(seen.early, 'the first declarations'),
          grudgesEarly: must(seen.grudgesEarly, 'the grudges'),
          late: must(seen.late, 'the second declarations'),
          world: JSON.parse(r.state) as World,
          calls,
          all: r.log,
          whole: true,
        };
      },
    );
  } finally {
    for (const [f, w] of was) g[f] = w;
  }
};
/** The function, as P1-08l1 named it. */
export const BOT_DIPLOMACY = 'botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim';
/** Readies the context on `b`, staged as `s`, as resolveTurn has it when it first makes the bots' declarations:
 *  P1-08k8's `prepare` (the merge run, the bot realms set), then each bot realm's rivals met as the turn began. */
export const ready = (b: Board, s: Staged) => {
  const tc = prepare(b, s);
  (
    vm.runInContext(
      `(tc)=>{ const m={}; tc._botPlayerIdx.forEach(idx=>{ m[idx]=[...(((tc.G.players||[])[idx]||{})._encountered||[])]; });
      tc._botEncounteredAtStart=m; }`,
      b.engine,
    ) as (t: Raw) => void
  )(tc);
  return tc;
};
/** Calls the function on `b`, staged as `s` and readied as `ready` readies it, twice, as resolveTurn calls it (with
 *  nothing between: the phases and the stages around them aside), with every die fixed; the declarations are read after
 *  each call. */
export const directCase = (b: Board, _c: BotDiplomacyCase, s: Staged): Outcome => {
  const tc = ready(b, s);
  let when: Call['when'] = 'early';
  return standingIn(
    b.engine,
    s.instead,
    () => when,
    (calls) => {
      const call = () => {
        withCaseDice(b.engine, LANDS, () => {
          (engineFn(b.engine, BOT_DIPLOMACY) as (t: Raw) => void)(tc);
        });
      };
      call();
      const early = json(tc['diploDeclarations']) as Declarations;
      const grudgesEarly = grudgesOf(b.G);
      when = 'late';
      call();
      return {
        early,
        grudgesEarly,
        late: json(tc['diploDeclarations']) as Declarations,
        world: json(b.G) as World,
        calls,
        all: json(tc['turnLog']) as Line[],
        whole: false,
      };
    },
  );
};

// ── Staging ──────────────────────────────────────────────────────────────────────────────────────────────────────
const raw = (b: Board) => b.G as unknown as Raw;
/** Stages `c` on `b` as P1-08k8's cases are (`stageCase`). */
export const stageCase = (b: Board, c: BotDiplomacyCase): Staged => {
  let staged: Staged = { bots: [] };
  const asBefore: BeforeCase = {
    name: c.name,
    stage: (bb) => (staged = c.stage(bb)),
    check: () => ({ got: {}, want: {} }),
  };
  return { ...stageBeforeCase(b, asBefore), ...staged };
};
/** The game's bot diplomacy is the Aggressive setting (chosen when the game was made). */
export const aggressive = (b: Board) => {
  raw(b)['botDiplomacy'] = 'hostile';
};
/** Realm `pi`'s record holds a grudge against each of `against` (as it would after they declared war on it). */
export const grudge = (b: Board, pi: number, ...against: number[]) => {
  realm(b, pi)['botGrudges'] = against;
};
/** Realm `pi`'s record holds a truce in its grudge against `rival`, made on turn `since`. */
export const truce = (b: Board, pi: number, rival: number, since: number) => {
  const r = realm(b, pi);
  r['_botGrudgeTruce'] = { ...(r['_botGrudgeTruce'] ?? {}), [rival]: since };
};
/** Realm `pi` has conceded the game, on an earlier turn. */
export const conceded = (b: Board, pi: number) => {
  Object.assign(realm(b, pi), { conceded: true, concededTurn: b.G.turn - 1 });
};
/** Realm `pi` has no living king: its king, still in his seat, has given up the crown (no realm crowns an heir for
 *  him before the turn's end). */
export const crownless = (b: Board, pi: number) => {
  kingOf(b, pi).isKing = false;
};
/** Strength stood in for the turn's length: the bot's own (`own`) and what it believes of a rival (`rival`, by realm,
 *  or one figure for all), each a figure or, by which declarations it is called for, two (`[early, late]`). */
export const strength = (
  own: number | [number, number],
  rival: number | Record<number, number | [number, number]>,
): Instead => {
  const at = (v: number | [number, number], when: Call['when']) =>
    typeof v === 'number' ? v : v[when === 'early' ? 0 : 1];
  return {
    botOwnPower: (when) => at(own, when),
    botRivalPower: (when, _pi, j) => at(typeof rival === 'number' ? rival : (rival[j as number] ?? 1), when),
  };
};
/** The war assessment stood in for the turn's length: `decision` for every rival, or by rival. */
export const assessed = (decision: string | null | Record<number, string | null>): Instead => ({
  botWarAssess: (_when, _pi, j) => ({
    decision: typeof decision === 'object' && decision ? (decision[j as number] ?? null) : decision,
  }),
});

// ── Reading the outcome ──────────────────────────────────────────────────────────────────────────────────────────
/** What realm `pi` declared toward each realm (none: `{}`). */
export const declared = (d: Declarations, pi: number) => d[String(pi)] ?? {};
/** Realm `pi`'s grudges after the turn (null: no record of any). */
export const grudgesAfter = (o: Outcome, pi: number) => grudgesOf(o.world)[pi] ?? null;
/** Realm `pi`'s truces after the turn, by rival (null: no record). */
export const trucesAfter = (o: Outcome, pi: number) =>
  json(must(o.world.players[pi], 'realm ' + String(pi))['_botGrudgeTruce'] ?? null) as Record<string, number> | null;
/** `v`, read after a whole turn; called directly, diplomacy is not resolved, so nothing is read (on either side). */
export const inTurn = (o: Outcome, v: unknown) => (o.whole ? v : 'diplomacy is resolved only in a whole turn');
/** The relation between realms `a` and `x` after the turn. */
export const relationAfter = (o: Outcome, a: number, x: number) =>
  o.world.relations[a < x ? `${String(a)}-${String(x)}` : `${String(x)}-${String(a)}`] ?? 'neutral';
/** The stood-in calls of `fn`, as the realms they were about (the bot, then the rival; or the bot alone). */
export const callsOf = (o: Outcome, fn: Helper, when: Call['when'] = 'early') =>
  o.calls.filter((c) => c.fn === fn && c.when === when).map((c) => c.args.slice(0, fn === 'botOwnPower' ? 1 : 2));
/** The war assessment's calls, each with what it was told: [bot, rival, offered peace]. */
export const assessments = (o: Outcome, when: Call['when'] = 'early') =>
  o.calls
    .filter((c) => c.fn === 'botWarAssess' && c.when === when)
    .map((c) => [c.args[0], c.args[1], (c.args[2] as Raw | null)?.['offeredPeace'] ?? null]);

// ── 1. The grudge: a human realm's war on a bot, remembered ───────────────────────────────────────────────────────
export const GRUDGE_CASES: BotDiplomacyCase[] = [
  {
    name: 'a human realm that declares war on a bot is remembered on the bot’s record before the first phase, and kept',
    stage: () => ({ bots: [1], sends: { 2: { diplomacy: { 1: 'enemy' } } } }),
    check: (o) => ({
      got: { early: o.grudgesEarly[1], after: grudgesAfter(o, 1), others: [o.grudgesEarly[0], o.grudgesEarly[2]] },
      want: { early: [2], after: [2], others: [null, null] },
    }),
  },
  {
    name: 'a human realm’s Treat to a bot leaves no grudge',
    stage: () => ({ bots: [1], sends: { 0: { diplomacy: { 1: 'treat' } }, 2: { diplomacy: { 1: 'treat' } } } }),
    check: (o) => ({ got: { grudges: grudgesAfter(o, 1) }, want: { grudges: null } }),
  },
  {
    name: 'a human realm’s war on another human realm leaves no grudge with anyone',
    stage: () => ({ bots: [1], sends: { 2: { diplomacy: { 0: 'enemy' } } } }),
    check: (o) => ({ got: { grudges: grudgesOf(o.world) }, want: { grudges: [null, null, null] } }),
  },
  {
    name: 'a bot’s own war on another bot leaves no grudge',
    stage: (b) => {
      creed(b, 1, 'Undead');
      return { bots: [1, 2], instead: assessed({ 2: 'war' }) };
    },
    check: (o) => ({
      got: { declared: declared(o.early, 1)['2'] ?? null, grudges: [grudgesAfter(o, 1), grudgesAfter(o, 2)] },
      want: { declared: 'enemy', grudges: [null, null] },
    }),
  },
  {
    name: 'a grudge already held is not written twice, and older grudges stay in their order',
    stage: (b) => {
      grudge(b, 1, 2, 0);
      return { bots: [1], sends: { 2: { diplomacy: { 1: 'enemy' } } } };
    },
    check: (o) => ({ got: { grudges: grudgesAfter(o, 1) }, want: { grudges: [2, 0] } }),
  },
  {
    name: 'a new grudge is added after those the bot already holds',
    stage: (b) => {
      grudge(b, 1, 0);
      return { bots: [1], sends: { 2: { diplomacy: { 1: 'enemy' } } } };
    },
    check: (o) => ({ got: { grudges: grudgesAfter(o, 1) }, want: { grudges: [0, 2] } }),
  },
  {
    name: 'two human realms declaring war on two bots: each bot holds a grudge against both, in realm order',
    stage: (b) => {
      relate(b, { '1-2': 'allied' });
      return { bots: [1, 2], sends: { 0: { diplomacy: { 1: 'enemy', 2: 'enemy' } } } };
    },
    check: (o) => ({
      got: { grudges: [grudgesAfter(o, 1), grudgesAfter(o, 2)] },
      want: { grudges: [[0], [0]] },
    }),
  },
  {
    name: 'a record whose grudges are not a list is given a list, holding the new grudge alone',
    stage: (b) => {
      realm(b, 1)['botGrudges'] = 'corrupt';
      return { bots: [1], sends: { 2: { diplomacy: { 1: 'enemy' } } } };
    },
    check: (o) => ({ got: { grudges: grudgesAfter(o, 1) }, want: { grudges: [2] } }),
  },
  {
    name: 'a grudge stops the bot offering a Treat it would otherwise offer, from the very turn war is declared',
    stage: (b) => {
      relate(b, { '0-1': 'enemy' });
      return { bots: [1], sends: { 2: { diplomacy: { 1: 'enemy' } } } };
    },
    check: (o) => ({
      got: { early: declared(o.early, 1), late: declared(o.late, 1) },
      want: { early: { 0: 'treat' }, late: { 0: 'treat' } },
    }),
  },
  {
    name: 'under Safe Start no grudge is recorded (the war is set aside before it is read)',
    stage: (b) => {
      safeStart(b);
      return { bots: [1], sends: { 2: { diplomacy: { 1: 'enemy' } } } };
    },
    check: (o) => ({ got: { grudges: grudgesAfter(o, 1) }, want: { grudges: null } }),
  },
];

// ── 2. Alignment: a Treat to a realm of the bot's creed or one step from it ───────────────────────────────────────
export const ALIGNMENT_CASES: BotDiplomacyCase[] = [
  {
    name: 'a bot offers a Treat to a rival of its creed it is at peace with',
    stage: (b) => {
      relate(b, {});
      return { bots: [1] };
    },
    check: (o) => ({ got: { early: declared(o.early, 1) }, want: { early: { 0: 'treat', 2: 'treat' } } }),
  },
  {
    name: 'a bot offers a Treat to a rival of its creed it is at war with',
    stage: (b) => {
      relate(b, { '0-1': 'enemy', '1-2': 'enemy' });
      return { bots: [1] };
    },
    check: (o) => ({ got: { early: declared(o.early, 1) }, want: { early: { 0: 'treat', 2: 'treat' } } }),
  },
  {
    name: 'a bot offers a Treat to a rival one step from its creed (Good beside Divine), every turn until allied',
    stage: (b) => {
      relate(b, {});
      creed(b, 2, 'Good');
      return { bots: [1] };
    },
    check: (o) => ({ got: { toGood: declared(o.early, 1)['2'] ?? null }, want: { toGood: 'treat' } }),
  },
  {
    name: 'a bot offers no Treat to a rival it is allied with already',
    stage: (b) => {
      relate(b, { '1-2': 'allied', '0-1': 'allied' });
      return { bots: [1] };
    },
    check: (o) => ({ got: { early: declared(o.early, 1), late: declared(o.late, 1) }, want: { early: {}, late: {} } }),
  },
  {
    name: 'a bot offers no Treat to a realm at peace with it that is allied to one of its foes',
    stage: () => ({ bots: [1] }),
    check: (o) => ({ got: { early: declared(o.early, 1) }, want: { early: { 0: 'treat' } } }),
  },
  {
    name: 'a bot still offers peace to a realm at war with it that is allied to one of its foes',
    stage: (b) => {
      relate(b, { '0-1': 'enemy', '0-2': 'allied', '1-2': 'enemy' });
      return { bots: [1] };
    },
    check: (o) => ({ got: { toTwo: declared(o.early, 1)['2'] ?? null }, want: { toTwo: 'treat' } }),
  },
  {
    name: 'a realm allied to a realm that is merely at peace with the bot is offered a Treat',
    stage: (b) => {
      relate(b, { '0-2': 'allied' });
      return { bots: [1] };
    },
    check: (o) => ({ got: { early: declared(o.early, 1) }, want: { early: { 0: 'treat', 2: 'treat' } } }),
  },
  {
    name: 'a rival of the bot’s creed is never weighed for war',
    stage: (b) => {
      relate(b, {});
      return { bots: [1], instead: assessed('war') };
    },
    check: (o) => ({
      got: { assessed: assessments(o), late: assessments(o, 'late') },
      want: { assessed: [], late: [] },
    }),
  },
  {
    name: 'the friendship of creeds is read for the bot and each rival in turn',
    stage: (b) => {
      relate(b, {});
      return { bots: [1], instead: { botAlignFriendly: () => true } };
    },
    check: (o) => ({
      got: { early: o.calls.filter((c) => c.when === 'early').map((c) => c.args) },
      want: {
        early: [
          [1, 0],
          [1, 2],
        ],
      },
    }),
  },
  {
    name: 'two bots of one creed at peace both offer a Treat, each to the other (no alliance is forged in a game of three)',
    stage: (b) => {
      relate(b, { '0-1': 'enemy', '0-2': 'enemy' });
      return { bots: [1, 2] };
    },
    check: (o) => ({
      got: {
        one: declared(o.early, 1)['2'] ?? null,
        two: declared(o.early, 2)['1'] ?? null,
        after: inTurn(o, relationAfter(o, 1, 2)),
      },
      want: { one: 'treat', two: 'treat', after: inTurn(o, 'neutral') },
    }),
  },
];

// ── 3. The war assessment: a rival two or more steps from the bot's creed ─────────────────────────────────────────
export const ASSESSMENT_CASES: BotDiplomacyCase[] = [
  {
    name: 'a rival two steps from the bot’s creed is weighed: judged war, the bot declares war',
    stage: (b) => {
      relate(b, {});
      creed(b, 2, 'Druidic');
      return { bots: [1], instead: assessed({ 2: 'war' }) };
    },
    check: (o) => ({
      got: {
        toTwo: declared(o.early, 1)['2'] ?? null,
        assessed: assessments(o),
        after: inTurn(o, relationAfter(o, 1, 2)),
      },
      want: { toTwo: 'enemy', assessed: [[1, 2, false]], after: inTurn(o, 'enemy') },
    }),
  },
  {
    name: 'judged war against a realm the bot is at war with already: nothing more is declared',
    stage: (b) => {
      relate(b, { '1-2': 'enemy' });
      creed(b, 2, 'Evil');
      return { bots: [1], instead: assessed({ 2: 'war' }) };
    },
    check: (o) => ({ got: { toTwo: declared(o.early, 1)['2'] ?? null }, want: { toTwo: null } }),
  },
  {
    name: 'judged peace with a realm the bot is at war with: the bot offers a Treat',
    stage: (b) => {
      relate(b, { '1-2': 'enemy' });
      creed(b, 2, 'Pagan');
      return { bots: [1], instead: assessed({ 2: 'peace' }) };
    },
    check: (o) => ({ got: { toTwo: declared(o.early, 1)['2'] ?? null }, want: { toTwo: 'treat' } }),
  },
  {
    name: 'judged peace with a realm the bot is at peace with: nothing is declared',
    stage: (b) => {
      relate(b, {});
      creed(b, 2, 'Pagan');
      return { bots: [1], instead: assessed({ 2: 'peace' }) };
    },
    check: (o) => ({ got: { toTwo: declared(o.early, 1)['2'] ?? null }, want: { toTwo: null } }),
  },
  {
    name: 'judged peace, but the bot holds a grudge against the realm: no Treat',
    stage: (b) => {
      relate(b, { '1-2': 'enemy' });
      creed(b, 2, 'Pagan');
      grudge(b, 1, 2);
      return { bots: [1], instead: { ...assessed({ 2: 'peace' }), ...strength(10, 10) } };
    },
    check: (o) => ({ got: { toTwo: declared(o.early, 1)['2'] ?? null }, want: { toTwo: null } }),
  },
  {
    name: 'judged neither: nothing is declared',
    stage: (b) => {
      relate(b, { '1-2': 'enemy' });
      creed(b, 2, 'Pagan');
      return { bots: [1], instead: assessed(null) };
    },
    check: (o) => ({ got: { toTwo: declared(o.early, 1)['2'] ?? null }, want: { toTwo: null } }),
  },
  {
    name: 'the assessment is told whether the rival offered peace this turn',
    stage: (b) => {
      relate(b, { '1-2': 'enemy', '0-1': 'enemy' });
      creed(b, 0, 'Evil');
      creed(b, 2, 'Pagan');
      return { bots: [1], instead: assessed(null), sends: { 2: { diplomacy: { 1: 'treat' } } } };
    },
    check: (o) => ({
      got: { assessed: assessments(o) },
      want: {
        assessed: [
          [1, 0, false],
          [1, 2, true],
        ],
      },
    }),
  },
  {
    name: 'an ally of any creed is kept faith with: not weighed, nothing declared',
    stage: (b) => {
      relate(b, { '1-2': 'allied' });
      creed(b, 2, 'Undead');
      return { bots: [1], instead: assessed('war') };
    },
    check: (o) => ({
      got: { toTwo: declared(o.early, 1)['2'] ?? null, assessed: assessments(o).map((a) => a[1]) },
      want: { toTwo: null, assessed: [] },
    }),
  },
  {
    name: 'a bot’s Treat this turn is a peace offered to the next bot weighed after it (bots in realm order)',
    stage: (b) => {
      relate(b, { '1-2': 'enemy', '0-1': 'enemy', '0-2': 'enemy' });
      creed(b, 2, 'Undead');
      creed(b, 0, 'Undead');
      return { bots: [0, 1], instead: assessed({ 1: 'peace', 0: 'peace', 2: null }) };
    },
    check: (o) => ({
      got: { assessed: assessments(o) },
      want: {
        assessed: [
          [0, 1, false],
          [1, 0, true],
          [1, 2, false],
        ],
      },
    }),
  },
  {
    name: 'an Evil bot’s war, judged before the first phase, stands at once (war without warning)',
    stage: (b) => {
      relate(b, {});
      creed(b, 1, 'Evil');
      return { bots: [1], instead: assessed('war') };
    },
    check: (o) => ({
      got: { early: declared(o.early, 1), after: inTurn(o, [relationAfter(o, 0, 1), relationAfter(o, 1, 2)]) },
      want: { early: { 0: 'enemy', 2: 'enemy' }, after: inTurn(o, ['enemy', 'enemy']) },
    }),
  },
];

// ── 4. The Aggressive setting ─────────────────────────────────────────────────────────────────────────────────────
export const AGGRESSIVE_CASES: BotDiplomacyCase[] = [
  {
    name: 'under the Aggressive setting a bot declares war on every human realm it has met, of its creed or allied (the alliance broken)',
    stage: (b) => {
      aggressive(b);
      relate(b, { '1-2': 'allied' });
      return { bots: [1] };
    },
    check: (o) => ({
      got: { early: declared(o.early, 1), after: inTurn(o, [relationAfter(o, 0, 1), relationAfter(o, 1, 2)]) },
      want: { early: { 0: 'enemy', 2: 'enemy' }, after: inTurn(o, ['enemy', 'neutral']) },
    }),
  },
  {
    name: 'under the Aggressive setting nothing is declared on a human realm already at war with the bot',
    stage: (b) => {
      aggressive(b);
      relate(b, { '0-1': 'enemy', '1-2': 'enemy' });
      return { bots: [1] };
    },
    check: (o) => ({ got: { early: declared(o.early, 1) }, want: { early: {} } }),
  },
  {
    name: 'under the Aggressive setting a bot treats another bot as ever (a Treat to one of its creed), and wars on a human realm not at war with it yet',
    stage: (b) => {
      aggressive(b);
      relate(b, { '0-1': 'enemy' });
      return { bots: [1, 2] };
    },
    check: (o) => ({
      got: { one: declared(o.early, 1), two: declared(o.early, 2) },
      want: { one: { 2: 'treat' }, two: { 0: 'enemy', 1: 'treat' } },
    }),
  },
  {
    name: 'under the Aggressive setting a claim to the throne changes nothing toward a human realm',
    stage: (b) => {
      aggressive(b);
      relate(b, { '0-1': 'allied' });
      claim(b, 2, [2], b.G.turn + 2, 50);
      return { bots: [1] };
    },
    check: (o) => ({ got: { early: declared(o.early, 1) }, want: { early: { 0: 'enemy', 2: 'enemy' } } }),
  },
  {
    name: 'under the Aggressive setting a grudge’s truce is not weighed against a human realm',
    stage: (b) => {
      aggressive(b);
      grudge(b, 1, 2);
      return { bots: [1], instead: strength(1, 100) };
    },
    check: (o) => ({
      got: { toTwo: declared(o.early, 1)['2'] ?? null, weighed: callsOf(o, 'botOwnPower'), truce: trucesAfter(o, 1) },
      want: { toTwo: 'enemy', weighed: [], truce: null },
    }),
  },
];

// ── 5. A claim to the throne ──────────────────────────────────────────────────────────────────────────────────────
export const CLAIM_CASES: BotDiplomacyCase[] = [
  {
    name: 'a rival’s claim to the throne: the bot declares war on the claimant, ally or not, and treats every other realm',
    stage: (b) => {
      relate(b, { '1-2': 'allied', '0-1': 'enemy' });
      creed(b, 2, 'Good');
      creed(b, 0, 'Undead');
      claim(b, 2, [2], b.G.turn + 2, 50);
      return { bots: [1] };
    },
    check: (o) => ({ got: { early: declared(o.early, 1) }, want: { early: { 0: 'treat', 2: 'enemy' } } }),
  },
  {
    name: 'a claim: no war on a claimant the bot is at war with already',
    stage: (b) => {
      relate(b, { '1-2': 'enemy' });
      claim(b, 2, [2], b.G.turn + 2, 50);
      return { bots: [1] };
    },
    check: (o) => ({ got: { toClaimant: declared(o.early, 1)['2'] ?? null }, want: { toClaimant: null } }),
  },
  {
    name: 'a claim: a bot allied to the claimant and of his creed keeps faith, and plays its ordinary diplomacy',
    stage: (b) => {
      relate(b, { '1-2': 'allied' });
      claim(b, 2, [2], b.G.turn + 2, 50);
      return { bots: [1] };
    },
    check: (o) => ({ got: { early: declared(o.early, 1) }, want: { early: { 0: 'treat' } } }),
  },
  {
    name: 'a claim: an ally of the claimant of another creed breaks with him',
    stage: (b) => {
      relate(b, { '1-2': 'allied' });
      creed(b, 2, 'Good');
      claim(b, 2, [2], b.G.turn + 2, 50);
      return { bots: [1] };
    },
    check: (o) => ({ got: { toClaimant: declared(o.early, 1)['2'] ?? null }, want: { toClaimant: 'enemy' } }),
  },
  {
    name: 'a claim: a bot of the claimant’s creed but not his ally declares war on him',
    stage: (b) => {
      relate(b, {});
      claim(b, 2, [2], b.G.turn + 2, 50);
      return { bots: [1] };
    },
    check: (o) => ({ got: { toClaimant: declared(o.early, 1)['2'] ?? null }, want: { toClaimant: 'enemy' } }),
  },
  {
    name: 'a claim: a realm of any creed is offered a Treat, but not an ally (nothing more to offer)',
    stage: (b) => {
      relate(b, { '0-1': 'allied' });
      creed(b, 0, 'Undead');
      claim(b, 2, [2], b.G.turn + 2, 50);
      return { bots: [1] };
    },
    check: (o) => ({ got: { early: declared(o.early, 1) }, want: { early: { 2: 'enemy' } } }),
  },
  {
    name: 'a claim: a human realm the bot holds a grudge against is not offered a Treat',
    stage: (b) => {
      relate(b, {});
      grudge(b, 1, 0);
      claim(b, 2, [2], b.G.turn + 2, 50);
      return { bots: [1], instead: strength(1, 100) };
    },
    check: (o) => ({
      got: { early: declared(o.early, 1), weighed: callsOf(o, 'botOwnPower') },
      want: { early: { 2: 'enemy' }, weighed: [] },
    }),
  },
  {
    name: 'a claim the bot itself holds: it plays its ordinary diplomacy',
    stage: (b) => {
      relate(b, {});
      creed(b, 2, 'Undead');
      claim(b, 1, [1], b.G.turn + 2, 50);
      return { bots: [1], instead: assessed('war') };
    },
    check: (o) => ({ got: { early: declared(o.early, 1) }, want: { early: { 0: 'treat', 2: 'enemy' } } }),
  },
  {
    name: 'a claim whose claimant has no living king counts for nothing: ordinary diplomacy',
    stage: (b) => {
      relate(b, { '1-2': 'allied' });
      creed(b, 2, 'Good');
      crownless(b, 2);
      claim(b, 2, [2], b.G.turn + 2, 50);
      return { bots: [1] };
    },
    check: (o) => ({ got: { early: declared(o.early, 1) }, want: { early: { 0: 'treat' } } }),
  },
  {
    name: 'a claim held by realm 0 is a claim (the first realm counts)',
    stage: (b) => {
      relate(b, { '0-1': 'allied' });
      creed(b, 0, 'Good');
      claim(b, 0, [0], b.G.turn + 2, 50);
      return { bots: [1] };
    },
    check: (o) => ({ got: { early: declared(o.early, 1) }, want: { early: { 0: 'enemy', 2: 'treat' } } }),
  },
  {
    name: 'two bots and a human claimant: both declare war on him and treat each other',
    stage: (b) => {
      relate(b, { '0-1': 'allied', '1-2': 'enemy' });
      creed(b, 0, 'Good');
      creed(b, 2, 'Undead');
      claim(b, 0, [0], b.G.turn + 2, 50);
      return { bots: [1, 2] };
    },
    check: (o) => ({
      got: { one: declared(o.early, 1), two: declared(o.early, 2), after: inTurn(o, relationAfter(o, 1, 2)) },
      want: { one: { 0: 'enemy', 2: 'treat' }, two: { 0: 'enemy', 1: 'treat' }, after: inTurn(o, 'neutral') },
    }),
  },
];

// ── 6. The grudge bends only to survival ──────────────────────────────────────────────────────────────────────────
export const TRUCE_CASES: BotDiplomacyCase[] = [
  {
    name: 'a grudge against a human realm five times the bot’s strength: a truce, dated this turn, and a Treat',
    stage: (b) => {
      turnIs(b, 7);
      relate(b, { '1-2': 'enemy' });
      grudge(b, 1, 2);
      return { bots: [1], instead: strength(10, { 2: 50 }) };
    },
    check: (o) => ({
      got: { toTwo: declared(o.early, 1)['2'] ?? null, truce: trucesAfter(o, 1), weighed: callsOf(o, 'botRivalPower') },
      want: { toTwo: 'treat', truce: { 2: 7 }, weighed: [[1, 2]] },
    }),
  },
  {
    name: 'a grudge against a human realm a little under five times the bot’s strength: no truce, no Treat',
    stage: (b) => {
      relate(b, { '1-2': 'enemy' });
      grudge(b, 1, 2);
      return { bots: [1], instead: strength(10, { 2: 49 }) };
    },
    check: (o) => ({
      got: { toTwo: declared(o.early, 1)['2'] ?? null, truce: trucesAfter(o, 1) },
      want: { toTwo: null, truce: {} },
    }),
  },
  {
    name: 'a truce made earlier holds while the human is more than twice the bot’s strength: a Treat still',
    stage: (b) => {
      relate(b, {});
      grudge(b, 1, 2);
      truce(b, 1, 2, 3);
      return { bots: [1], instead: strength(10, { 2: 21 }) };
    },
    check: (o) => ({
      got: { toTwo: declared(o.early, 1)['2'] ?? null, truce: trucesAfter(o, 1) },
      want: { toTwo: 'treat', truce: { 2: 3 } },
    }),
  },
  {
    name: 'a truce while allied: kept, and nothing is declared',
    stage: (b) => {
      relate(b, { '1-2': 'allied' });
      grudge(b, 1, 2);
      truce(b, 1, 2, 3);
      return { bots: [1], instead: strength(10, { 2: 30 }) };
    },
    check: (o) => ({
      got: {
        toTwo: declared(o.early, 1)['2'] ?? null,
        truce: trucesAfter(o, 1),
        after: inTurn(o, relationAfter(o, 1, 2)),
      },
      want: { toTwo: null, truce: { 2: 3 }, after: inTurn(o, 'allied') },
    }),
  },
  {
    name: 'once the human is no more than twice the bot’s strength, the truce ends and the alliance is broken',
    stage: (b) => {
      relate(b, { '1-2': 'allied' });
      grudge(b, 1, 2);
      truce(b, 1, 2, 3);
      return { bots: [1], instead: strength(10, { 2: 20 }) };
    },
    check: (o) => ({
      got: {
        toTwo: declared(o.early, 1)['2'] ?? null,
        truce: trucesAfter(o, 1),
        after: inTurn(o, relationAfter(o, 1, 2)),
      },
      want: { toTwo: 'enemy', truce: {}, after: inTurn(o, 'neutral') },
    }),
  },
  {
    name: 'a grudge against an ally with no truce: the alliance is broken',
    stage: (b) => {
      relate(b, { '1-2': 'allied' });
      grudge(b, 1, 2);
      return { bots: [1], instead: strength(10, { 2: 10 }) };
    },
    check: (o) => ({ got: { toTwo: declared(o.early, 1)['2'] ?? null }, want: { toTwo: 'enemy' } }),
  },
  {
    name: 'a truce ended at peace: the grudge remembered, no Treat (of the bot’s creed)',
    stage: (b) => {
      relate(b, {});
      grudge(b, 1, 2);
      truce(b, 1, 2, 3);
      return { bots: [1], instead: strength(10, { 2: 15 }) };
    },
    check: (o) => ({
      got: { toTwo: declared(o.early, 1)['2'] ?? null, truce: trucesAfter(o, 1) },
      want: { toTwo: null, truce: {} },
    }),
  },
  {
    name: 'a grudge against a realm of another creed with no truce: weighed, and war if judged so',
    stage: (b) => {
      relate(b, {});
      creed(b, 2, 'Evil');
      grudge(b, 1, 2);
      return { bots: [1], instead: { ...strength(10, 10), ...assessed({ 2: 'war' }) } };
    },
    check: (o) => ({
      got: { toTwo: declared(o.early, 1)['2'] ?? null, assessed: assessments(o).map((a) => a[1]) },
      want: { toTwo: 'enemy', assessed: [2] },
    }),
  },
  {
    name: 'a strength of nothing is read as one: a human realm of strength 0 is no threat',
    stage: (b) => {
      relate(b, { '1-2': 'enemy' });
      grudge(b, 1, 2);
      return { bots: [1], instead: strength(0, { 2: 0 }) };
    },
    check: (o) => ({
      got: { toTwo: declared(o.early, 1)['2'] ?? null, truce: trucesAfter(o, 1) },
      want: { toTwo: 'treat', truce: { 2: 1 } },
    }),
  },
  {
    name: 'only a rival held in a grudge has its strength weighed',
    stage: (b) => {
      relate(b, {});
      grudge(b, 1, 2);
      return { bots: [1], instead: strength(10, 10) };
    },
    check: (o) => ({
      got: { own: callsOf(o, 'botOwnPower'), rival: callsOf(o, 'botRivalPower') },
      want: { own: [[1]], rival: [[1, 2]] },
    }),
  },
  {
    name: 'after the phases the truce is weighed again, on the strength as the phases left it',
    wholeTurnOnly: true,
    stage: (b) => {
      turnIs(b, 4);
      relate(b, { '1-2': 'enemy' });
      grudge(b, 1, 2);
      return { bots: [1], instead: strength(10, { 2: [30, 60] }) };
    },
    check: (o) => ({
      got: {
        early: declared(o.early, 1)['2'] ?? null,
        late: declared(o.late, 1)['2'] ?? null,
        truce: trucesAfter(o, 1),
      },
      want: { early: null, late: 'treat', truce: { 2: 4 } },
    }),
  },
];

// ── 7. Who makes declarations, and to whom ────────────────────────────────────────────────────────────────────────
export const WHO_CASES: BotDiplomacyCase[] = [
  {
    name: 'under Safe Start no bot declares anything',
    stage: (b) => {
      safeStart(b);
      relate(b, {});
      return { bots: [1, 2], instead: assessed('war') };
    },
    check: (o) => ({
      got: { early: o.early, late: o.late, assessed: o.calls.length },
      want: { early: {}, late: {}, assessed: 0 },
    }),
  },
  {
    name: 'on the turn Safe Start ends the bots declare',
    stage: (b) => {
      safeStart(b);
      turnIs(b, 6);
      relate(b, {});
      return { bots: [1] };
    },
    check: (o) => ({ got: { early: declared(o.early, 1) }, want: { early: { 0: 'treat', 2: 'treat' } } }),
  },
  {
    name: 'a human realm’s declarations are never written by the bots',
    stage: (b) => {
      relate(b, {});
      return { bots: [1], sends: { 0: { diplomacy: { 2: 'enemy' } } } };
    },
    check: (o) => ({
      got: { zero: declared(o.early, 0), two: declared(o.early, 2) },
      want: { zero: { 2: 'enemy' }, two: {} },
    }),
  },
  {
    name: 'a bot that has conceded declares nothing',
    stage: (b) => {
      relate(b, {});
      conceded(b, 1);
      return { bots: [1] };
    },
    check: (o) => ({ got: { early: declared(o.early, 1), late: declared(o.late, 1) }, want: { early: {}, late: {} } }),
  },
  {
    name: 'no declaration is made toward a realm that has conceded',
    stage: (b) => {
      relate(b, {});
      conceded(b, 2);
      return { bots: [1] };
    },
    check: (o) => ({ got: { early: declared(o.early, 1) }, want: { early: { 0: 'treat' } } }),
  },
  {
    name: 'a bot with neither king nor land declares nothing',
    stage: (b) => {
      relate(b, {});
      crownless(b, 1);
      landless(b, 1);
      return { bots: [1] };
    },
    check: (o) => ({ got: { early: declared(o.early, 1) }, want: { early: {} } }),
  },
  {
    name: 'a bot with land but no king still declares',
    stage: (b) => {
      relate(b, {});
      crownless(b, 1);
      return { bots: [1] };
    },
    check: (o) => ({ got: { early: declared(o.early, 1) }, want: { early: { 0: 'treat', 2: 'treat' } } }),
  },
  {
    name: 'a bot with a king but no land still declares',
    stage: (b) => {
      relate(b, {});
      landless(b, 1);
      return { bots: [1] };
    },
    check: (o) => ({ got: { early: declared(o.early, 1) }, want: { early: { 0: 'treat', 2: 'treat' } } }),
  },
  {
    name: 'no declaration is made toward a realm with neither king nor land; one with either is declared on',
    stage: (b) => {
      relate(b, {});
      crownless(b, 2);
      landless(b, 2);
      landless(b, 0);
      return { bots: [1] };
    },
    check: (o) => ({ got: { early: declared(o.early, 1) }, want: { early: { 0: 'treat' } } }),
  },
  {
    name: 'no declaration is made toward a realm the bot had not met when the turn began',
    stage: (b) => {
      relate(b, {});
      unmet(b, 1, 2);
      return { bots: [1] };
    },
    check: (o) => ({
      got: { early: declared(o.early, 1), late: declared(o.late, 1) },
      want: { early: { 0: 'treat' }, late: { 0: 'treat' } },
    }),
  },
  {
    name: 'a bot that had met no one declares nothing',
    stage: (b) => {
      relate(b, {});
      realm(b, 1)['_encountered'] = [];
      return { bots: [1] };
    },
    check: (o) => ({ got: { early: declared(o.early, 1) }, want: { early: {} } }),
  },
  {
    name: 'a record of meeting itself, or a realm the game lacks, is passed over',
    stage: (b) => {
      relate(b, {});
      realm(b, 1)['_encountered'] = [1, 7, null, 2];
      return { bots: [1] };
    },
    check: (o) => ({ got: { early: declared(o.early, 1) }, want: { early: { 2: 'treat' } } }),
  },
  {
    name: 'rivals are declared on in the order the bot met them',
    stage: (b) => {
      relate(b, {});
      realm(b, 1)['_encountered'] = [2, 0];
      return { bots: [1] };
    },
    check: (o) => ({ got: { order: Object.keys(declared(o.early, 1)) }, want: { order: ['0', '2'] } }),
  },
  {
    name: 'every bot declares, each for itself',
    stage: (b) => {
      relate(b, {});
      return { bots: [0, 1, 2] };
    },
    check: (o) => ({
      got: { early: o.early },
      want: { early: { 0: { 1: 'treat', 2: 'treat' }, 1: { 0: 'treat', 2: 'treat' }, 2: { 0: 'treat', 1: 'treat' } } },
    }),
  },
  {
    name: 'no bots, no declarations but the humans’',
    stage: (b) => {
      relate(b, {});
      return { bots: [], sends: { 1: { diplomacy: { 2: 'treat' } } } };
    },
    check: (o) => ({
      got: { early: o.early, late: o.late },
      want: { early: { 0: {}, 1: { 2: 'treat' }, 2: {} }, late: { 0: {}, 1: { 2: 'treat' }, 2: {} } },
    }),
  },
];

// ── 8. The two declarations ───────────────────────────────────────────────────────────────────────────────────────
export const TWICE_CASES: BotDiplomacyCase[] = [
  {
    name: 'the bots declare before the first phase, and again just before diplomacy is resolved, alike',
    wholeTurnOnly: true,
    stage: (b) => {
      relate(b, {});
      creed(b, 2, 'Undead');
      return { bots: [1], instead: assessed({ 2: 'war' }) };
    },
    check: (o) => ({
      got: {
        early: declared(o.early, 1),
        late: declared(o.late, 1),
        assessed: [assessments(o), assessments(o, 'late')],
      },
      want: {
        early: { 0: 'treat', 2: 'enemy' },
        late: { 0: 'treat', 2: 'enemy' },
        assessed: [[[1, 2, false]], [[1, 2, false]]],
      },
    }),
  },
  {
    name: 'the second declarations read the rivals met when the turn began',
    wholeTurnOnly: true,
    stage: (b) => {
      relate(b, {});
      creed(b, 2, 'Undead');
      unmet(b, 1, 2);
      return { bots: [1], instead: assessed('war') };
    },
    check: (o) => ({
      got: { late: declared(o.late, 1), assessed: assessments(o, 'late').map((a) => a[1]) },
      want: { late: { 0: 'treat' }, assessed: [] },
    }),
  },
  {
    name: 'a war that stands from the first phase is not declared again after the phases',
    wholeTurnOnly: true,
    stage: (b) => {
      relate(b, {});
      creed(b, 1, 'Evil');
      return { bots: [1], instead: assessed({ 0: 'war' }) };
    },
    check: (o) => ({
      got: {
        early: declared(o.early, 1)['0'] ?? null,
        late: assessments(o, 'late').map((a) => a[1]),
        after: relationAfter(o, 0, 1),
      },
      want: { early: 'enemy', late: [0, 2], after: 'enemy' },
    }),
  },
];

/** Every case, by part of the bots' diplomacy. */
export const BOT_DIPLOMACY_CASES: [string, BotDiplomacyCase[]][] = [
  ['the grudge', GRUDGE_CASES],
  ['alignment', ALIGNMENT_CASES],
  ['the war assessment', ASSESSMENT_CASES],
  ['the Aggressive setting', AGGRESSIVE_CASES],
  ['a claim to the throne', CLAIM_CASES],
  ['the truce', TRUCE_CASES],
  ['who declares, and to whom', WHO_CASES],
  ['the two declarations', TWICE_CASES],
];
