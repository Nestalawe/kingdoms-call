// One real turn on a small staged world, played in the engine's bare vm (tests/lib/engine.ts) instead of on the GM
// portal (plan P1-09a): the same staging as tests/lib/scenario.js, for the scenario tests (level 2) that used to reach
// inside the page with a code-anchor hook. Here they stand a top-level function in through the vm instead (`W.name =
// …`, as tests/unit/xp-naval-passenger.test.ts does), which a page can't do once its files are modules (P1-09d).
//
//   const sc = scenarioInTheVm({ seed: 1 });
//   const r = sc.turn({ realms: 2, prepare(S, W) { … }, orders: { [charId]: [o0, o1, o2, o3, o4] } });
//   r.S  the world as staged          r.S2  the world after the turn, as the shell saves it
//   r.log  the GM's full log          r.reports[playerIndex]  each human realm's turn report, as the shell writes it
//   r.collected  the turn's statistics (turn_events), as the shell hands them to its telemetry
//   r.text(charId?)  every log line (or one character's lines) as one string, for matching
//   sc.play(state, rows)  one turn of a saved world on slot rows of the test's own (an all-bot game, say)
//   sc.reportEveryRealm()  from now on, a report for every realm, bots' too
//
// The turn is the shell's: resolveTurn on the saved world (JSON) and the slot rows, with a seed drawn from the
// engine's dice as the shell draws it from the page's (src/ui/gm/turn-shell.ts), then buildReports(). Every realm is
// human-held (so no bot plans for it) unless listed in `bots`; every living character not given orders Rests all turn. The
// engine's console is quiet (its log and its warnings, as the page's are in scenario.js) while it makes the world and
// plays the turn.
// W is the engine's global scope: `W.getNeighborsP(…)` calls a top-level function, `W.name = f` stands one in for the
// calls made inside the engine (until it is put back), and `W.eval(code)` runs code there.
import vm from 'node:vm';
import { loadEngine, quietEngineLog } from './engine.ts';

export interface Order {
  action: string;
  target: string;
  extra: string;
  desc: string;
}
export type World = Record<string, unknown> & { turn: number; safeStart?: boolean };
/** The engine's global scope, as a test reaches it. */
export type EngineWindow = Record<string, unknown> & {
  eval(code: string): unknown;
  getNeighborsP(p: unknown, cols: number, rows: number, provinces: unknown[]): unknown[];
};
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
  prepare?: (S: St, W: EngineWindow) => X;
  /** Each character's five orders, by id; every other character Rests. */
  orders?: Record<number, Order[]> | ((S: St, extra: X) => Record<number, Order[]>);
}

interface Resolved {
  state: string;
  log: Line[];
  buildReports(): {
    reports: { gp: { player_index: number }; report: Record<string, unknown> }[];
    tel: { gs: unknown; collected: Record<string, unknown> };
  };
}

/** A copy made outside the vm: the engine's objects become this realm's, as a page's writes are JSON. */
const plain = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** The engine, loaded fresh with its dice seeded `seed` (and from `src`, another copy, if given), ready to play staged
 *  turns. Its console is quiet. */
export function scenarioInTheVm(opts: { seed?: number; src?: string } = {}) {
  const engine = loadEngine({ seed: opts.seed ?? 1, ...(opts.src ? { src: opts.src } : {}) });
  // The engine's console is this process's: it is quiet only while the engine works, so a script's own lines print.
  const quietly = <T>(body: () => T): T => {
    const restore = quietEngineLog(engine);
    const engineConsole = vm.runInContext('console', engine) as Console;
    const warn = engineConsole.warn;
    engineConsole.warn = () => undefined;
    try {
      return body();
    } finally {
      engineConsole.warn = warn;
      restore();
    }
  };
  const run = (code: string): unknown => vm.runInContext(code, engine);
  const W = new Proxy({} as EngineWindow, {
    get(_, name) {
      if (name === 'eval') return run;
      if (typeof name !== 'string') return undefined;
      return run(`typeof ${name}==='undefined'?undefined:${name}`);
    },
    set(_, name, value) {
      if (typeof name !== 'string') return false;
      (run(`(v)=>{ ${name}=v; }`) as (v: unknown) => void)(value);
      return true;
    },
  });
  const call = (name: string, ...args: unknown[]) => (run(name) as (...a: unknown[]) => unknown)(...args);
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
    const builds = run('BOT_SKILL_BUILD') as Record<string, Record<string, number>>;
    const setup = (call('generateBotSetups', [], realms, 0) as Record<string, unknown>[]).map(
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
    const S = plain(quietly(() => call('generateNewGame', setup, { cols, rows }, 999, { seaPct })) as World);
    S.safeStart = false;
    return { S, setup };
  }

  /** Stages a world, plays one turn on it as the shell does, and returns what the turn wrote. */
  function turn<St = World, X = unknown>(o: TurnOptions<St, X> = {}) {
    const { S, setup } = world(o);
    const staged = S as unknown as St;
    const extra = (o.prepare ? o.prepare(staged, W) : null) as X;
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
   *  a seed drawn from the engine's dice, resolveTurn, then buildReports. Returns the world after the turn, the GM's
   *  log, each report by its realm, and the turn's statistics. */
  function play(state: World | string, rows: unknown[]) {
    const json = typeof state === 'string' ? state : JSON.stringify(state);
    const turn = (JSON.parse(json) as World).turn;
    // the shell's seed: one number from the dice, as a 32-bit integer (0 read as 1)
    const seed = Math.floor((run('kcRng()') as number) * 2 ** 32) || 1;
    const rowsInVm = (run('(j)=>JSON.parse(j)') as (j: string) => unknown)(JSON.stringify(rows));
    const resolved = quietly(() => call('resolveTurn', json, rowsInVm, turn, seed) as Resolved);
    const built = quietly(() => resolved.buildReports());
    const log = plain(resolved.log);
    const reports: Record<number, Record<string, unknown>> = {};
    for (const { gp, report } of built.reports) reports[gp.player_index] = plain(report);
    return {
      S2: JSON.parse(resolved.state) as World,
      log,
      reports,
      collected: plain(built.tel.collected),
      seed,
      text: (charId?: unknown) =>
        log
          .filter((e) => charId == null || e.charId === charId || (e.charIds ?? []).includes(charId))
          .map((e) => e.text)
          .join('\n'),
    };
  }

  /** From now on every realm gets a report each turn, bots' too: the engine builds reports only for the realms people
   *  play (slot rows with a user_id), so an all-bot game writes none. buildReports (src/engine/turn/realm-reports-and-
   *  spy-stealth.js) is stood in, in the vm, to see every row as played, on copies of the rows; the shell writes each
   *  report by the row's id and player_index, which the copies keep. (It was tests/lib/boot.js's reportEveryRealm, on
   *  the booted GM portal, until plan P1-09a.) */
  function reportEveryRealm() {
    run(
      "{ const buildFor=buildReports; buildReports=function(turnContext, ...rest){ return buildFor({...turnContext, freshPlayers:turnContext.freshPlayers.map(p=>({...p, user_id:p.user_id||'every-realm'}))}, ...rest); }; }",
    );
  }
  return { engine, W, world, turn, play, reportEveryRealm, rest, errs: [] as string[] };
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
