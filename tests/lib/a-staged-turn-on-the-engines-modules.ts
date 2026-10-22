// One real turn on a small staged world, played on the engine's modules, imported directly (plan P1-14a): the same
// staging and the same results as tests/lib/scenario-in-the-vm.ts's turn() and play(), without the vm. A scenario test
// (level 2) calls the functions it needs from their modules, and stands one in with vi.spyOn on the module that
// exports it (tests/README.md, "How the tests reach the engine").
//
//   const sc = await aStagedTurnOnTheEnginesModules({ seed });   // fresh modules, the dice seeded `seed`
//   const r = sc.turn({ realms: 2, prepare(S) { … }, orders: { [charId]: [o0, o1, o2, o3, o4] } });
//   r.S  the world as staged          r.S2  the world after the turn, as the shell saves it
//   r.log  the GM's full log          r.reports[playerIndex]  each human realm's turn report, as the shell writes it
//   r.collected  the turn's statistics (turn_events), as the shell hands them to its telemetry
//   r.text(charId?)  every log line (or one character's lines) as one string, for matching
//   r.extra  what prepare returned
//   sc.play(state, rows)  one turn of a saved world on slot rows of the test's own (an all-bot game, say)
//   sc.reportEveryRealm()  from now on, a report for every realm, bots' too
//
// Fresh modules: it calls vi.resetModules() and imports the whole engine again (tests/lib/the-whole-engine.ts) before
// it seeds the dice, so the world doesn't depend on what the tests before it made (the name pools are the modules'
// state) and `-t "<name>"` repeats a test. A module the test imports after this call (`await import(…)`) is the same
// fresh one the turn uses, so a stand-in set on it reaches the turn.
//
// The turn is the shell's: resolveTurn on the saved world (JSON) and the slot rows, with a seed drawn from the engine's
// dice as the shell draws it from the page's (src/ui/gm/turn-shell.ts), then the Spy-stealth step and buildReports().
// Every realm is human-held (so no bot plans for it) unless listed in `bots`; every living character not given orders
// Rests all turn. The console is quiet (its log and its warnings) while the engine makes the world and plays the turn.
import { vi } from 'vitest';

export interface Order {
  action: string;
  target: string;
  extra: string;
  desc: string;
}
export type World = Record<string, unknown> & { turn: number; safeStart?: boolean };
/** One line of the GM's log. */
export interface Line {
  text?: string;
  type?: string;
  /** The phase (0–4; 99 for the end of the turn), or null. */
  phase?: number | null;
  charId?: unknown;
  charIds?: unknown[];
  [key: string]: unknown;
}

/** A turn to stage: `St` is the test's own type for the world, `X` what `prepare` returns. */
export interface TurnOptions<St = World, X = unknown> {
  realms?: number;
  cols?: number;
  rows?: number;
  seaPct?: number;
  /** A realm's alignment and race, by index (a realm not named keeps the one it was dealt). */
  alignments?: string[];
  races?: string[];
  /** The realms left to the bots, by index (every other realm is human-held). */
  bots?: number[];
  /** Edits the fresh world before the turn; what it returns is the turn's `extra`. */
  prepare?: (S: St) => X;
  /** Each character's five orders, by id; every other character Rests. */
  orders?: Record<number, Order[]> | ((S: St, extra: X) => Record<number, Order[]>);
}

interface Resolved {
  state: string;
  log: Line[];
  spyStealthAndInvisibilityStampedForTheReports(): void;
  buildReports(): {
    reports: { gp: { player_index: number }; report: Record<string, unknown> }[];
    tel: { gs: unknown; collected: Record<string, unknown> };
  };
}

/** A copy, as a page's writes are JSON. */
const plain = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** The console quiet while `body` runs. */
function quietly<T>(body: () => T): T {
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    return body();
  } finally {
    log.mockRestore();
    warn.mockRestore();
  }
}

/** The engine's modules, fresh, with the dice seeded `seed`, ready to play staged turns. */
export async function aStagedTurnOnTheEnginesModules({ seed }: { seed: number }) {
  vi.resetModules();
  await import('./the-whole-engine.ts');
  const { kcRng } = await import('../../src/engine/rng.ts');
  const { BOT_SKILL_BUILD, generateBotSetups } = await import('../../src/engine/bots/setup.ts');
  const { generateNewGame } = await import('../../src/engine/world/generate.ts');
  const { resolveTurn } = await import('../../src/engine/run-turn.ts');
  const reportsModule = await import('../../src/engine/turn/realm-reports-and-spy-stealth.ts');
  kcRng.seed(seed);

  const rest = (): Order[] => [0, 1, 2, 3, 4].map(() => ({ action: 'rest', target: '', extra: '', desc: '' }));

  /** A fresh world, made by the engine: `realms` realms on a cols×rows map, safe start off. */
  function world({
    realms = 2,
    cols = 10,
    rows = 6,
    seaPct = 20,
    alignments = [] as string[],
    races = [] as string[],
  } = {}) {
    const builds = BOT_SKILL_BUILD as Record<string, Record<string, number>>;
    const setup = (generateBotSetups([], realms, 0) as Record<string, unknown>[]).map(
      (b): Record<string, unknown> & { gamePlayerId: string; name: unknown } => ({
        ...b,
        gamePlayerId: 'gp' + String(b['id']),
        name: b['kingdomName'],
      }),
    );
    setup.forEach((s, i) => {
      const alignment = alignments[i];
      if (alignment) {
        s['alignment'] = alignment;
        const build = builds[alignment];
        if (build) s['skills'] = { ...build };
      }
      const race = races[i];
      if (race) s['race'] = race;
    });
    const S = plain(quietly(() => generateNewGame(setup, { cols, rows }, 999, { seaPct }) as World));
    S.safeStart = false;
    return { S, setup };
  }

  /** Stages a world, plays one turn on it as the shell does, and returns what the turn wrote. */
  function turn<St = World, X = unknown>(o: TurnOptions<St, X> = {}) {
    const { S, setup } = world(o);
    const staged = S as unknown as St;
    const extra = (o.prepare ? o.prepare(staged) : null) as X;
    const given = typeof o.orders === 'function' ? o.orders(staged, extra) : (o.orders ?? {});
    const bots = o.bots ?? [];
    const characters = S['characters'] as { id: number; alive?: boolean; player?: number | null }[];
    const all: Record<number, Order[]> = {};
    characters
      .filter((c) => c.alive && c.player != null)
      .forEach((c) => {
        all[c.id] = given[c.id] ?? rest();
      });
    const payload = (pi: number) =>
      JSON.stringify({
        orders: Object.fromEntries(characters.filter((c) => c.alive && c.player === pi).map((c) => [c.id, all[c.id]])),
        encounterPlans: {},
        kingSkills: {},
        diplomacy: {},
        discoveryChoices: {},
        callReckoning: false,
        concede: false,
        messages: [],
        heroOrder: [],
        forTurn: S.turn,
      });
    const players = setup.map((sp) => {
      const id = Number(sp['id']);
      const bot = bots.includes(id);
      return {
        id: sp.gamePlayerId,
        user_id: bot ? null : 'u' + String(id),
        player_index: id,
        display_name: sp.name,
        orders: bot ? null : payload(id),
        orders_submitted: !bot,
        turn_report: JSON.stringify(bot ? { isBot: true } : {}),
      };
    });
    const before = plain(S);
    const played = play(S, players);
    return { ...played, S: before as unknown as St, extra };
  }

  /** Plays one turn of the saved world `state` on the slot rows `rows`, as the shell does (src/ui/gm/turn-shell.ts):
   *  a seed drawn from the engine's dice, resolveTurn, then the Spy-stealth step and buildReports. Returns the world
   *  after the turn, the GM's log, each report by its realm, and the turn's statistics. */
  function play(state: World | string, rows: unknown[]) {
    const json = typeof state === 'string' ? state : JSON.stringify(state);
    const turnNumber = (JSON.parse(json) as World).turn;
    // the shell's seed: one number from the dice, as a 32-bit integer (0 read as 1)
    const turnSeed = Math.floor(kcRng() * 2 ** 32) || 1;
    const resolved = quietly(() => resolveTurn(json, plain(rows), turnNumber, turnSeed) as Resolved);
    const built = quietly(() => {
      resolved.spyStealthAndInvisibilityStampedForTheReports();
      return resolved.buildReports();
    });
    const log = plain(resolved.log);
    const reports: Record<number, Record<string, unknown>> = {};
    for (const { gp, report } of built.reports) reports[gp.player_index] = plain(report);
    return {
      S2: JSON.parse(resolved.state) as World,
      log,
      reports,
      collected: plain(built.tel.collected),
      seed: turnSeed,
      text: (charId?: unknown) =>
        log
          .filter((e) => charId == null || e.charId === charId || (e.charIds ?? []).includes(charId))
          .map((e) => e.text)
          .join('\n'),
    };
  }

  /** From now on every realm gets a report each turn, bots' too: the engine builds reports only for the realms people
   *  play (slot rows with a user_id), so an all-bot game writes none. buildReports (src/engine/turn/realm-reports-and-
   *  spy-stealth.ts) is stood in on its module, for resolveTurn's call from run-turn.ts, to see every row as played,
   *  on copies of the rows; the shell writes each report by the row's id and player_index, which the copies keep. */
  function reportEveryRealm() {
    const buildFor = reportsModule.buildReports;
    vi.spyOn(reportsModule, 'buildReports').mockImplementation(
      (turnContext: { freshPlayers: { user_id?: unknown }[] }) =>
        buildFor({
          ...turnContext,
          freshPlayers: turnContext.freshPlayers.map((p) => ({ ...p, user_id: p.user_id ?? 'every-realm' })),
        }),
    );
  }
  return { world, turn, play, reportEveryRealm, rest };
}

/** One phase's order: `order('move', 12)`. */
export const order = (action: string, target: string | number = '', extra: string | number = ''): Order => ({
  action,
  target: String(target),
  extra: String(extra),
  desc: '',
});
/** Five orders: the given ones first, then Rest. */
export const plan = (...orders: Order[]): Order[] => {
  const out = orders.slice(0, 5);
  while (out.length < 5) out.push(order('rest'));
  return out;
};
