// tests/lib/scenario.ts: run one real turn on a small staged world, for scenario (level 2) tests.
//
//   const sc=await bootScenario();
//   const r=await sc.turn({realms:2, prepare(S,W){…}, orders:{[charId]:[o0,o1,o2,o3,o4]}});
//   r.S      the world as staged (before the turn)      r.S2   the world as saved after the turn
//   r.log    the GM's full log for the turn ({type,text,actor,targets,charId,phase,…} entries)
//   r.reports[playerIndex]   each human realm's turn report, as the player portal receives it
//   r.text(charId?)   every log line (or one character's lines) as one string, for matching
//   r.events   the turn's statistics rows (turn_events, one per realm), with bootScenario({telemetry:true})
//
// Every realm is human-held (so no bot plans for it) unless listed in `bots`; every living
// character not given orders Rests all turn. `seed` fixes the page's own Math.random (bootJsdom's opts.seed); by
// default it comes from KC_SEED and how many pages this process has booted. `now` pins the page's clock (bootJsdom's
// opts.now). `telemetry` has the page write its statistics rows, as it does once it has found the turn_events table
// (its own probe, run here as sign-in runs it, finds it on the fake database, tests/lib/fake-db.ts): the balance scenarios
// (tests/balance/scenarios/) read them. (The code-anchor hooks, `inject`, are gone since plan P1-09a: a test that must
// reach inside the turn plays it in the engine's bare vm, tests/lib/scenario-in-the-vm.ts.)
//
// Plain Node runs this file as it is (its types are stripped), so the old JavaScript scripts in tests/*.test.js can
// require it: it uses only TypeScript that can be erased. It has no import.meta, so Playwright can compile it for a
// browser spec (playwright.config.ts leaves only tests/lib/boot.ts to Node).
import { readPage, bootJsdom, DB_VERSION, type PageWindow } from './boot.ts';
import { makeAFakeDbHoldingTheGameMastersTurn, type AChangeTheGameMastersTurnSent } from './fake-db.ts';
import type { AGameWithItsRealms, ARealm } from '../../src/db/the-db-interface-and-its-areas.ts';

/** One line of the GM's log, as a test reads it. */
export interface ALogLine {
  text?: unknown;
  type?: unknown;
  phase?: unknown;
  charId?: unknown;
  charIds?: unknown[];
  [key: string]: unknown;
}

/** One turn played: S2 is the world as saved after it. */
export interface Turn<S = unknown, X = unknown> {
  /** The world as staged (before the turn). */
  S: S;
  S2: unknown;
  /** The GM's full log for the turn. */
  log: ALogLine[];
  /** The turn's statistics rows (turn_events, one per realm), with bootScenario({telemetry:true}). */
  events: unknown[];
  /** Each human realm's turn report, by its index, as the player portal receives it. */
  reports: Record<number, Record<string, unknown>>;
  /** What `prepare` returned. */
  extra: X;
  text(charId?: number): string;
}

/** One phase's order. */
export interface Order {
  action: string;
  target: string;
  extra: string;
  desc: string;
}

/** A fresh world's size and its realms' crowns. */
export interface WorldOptions {
  realms?: number;
  cols?: number;
  rows?: number;
  seaPct?: number;
  /** A realm's alignment and race, by index (a realm not named keeps the one it was dealt). */
  alignments?: string[];
  races?: string[];
}

export interface TurnOptions<S, X> extends WorldOptions {
  /** The realms left to the bots, by index (every other realm is human-held). */
  bots?: number[];
  /** Edits the fresh world before the turn; what it returns is the turn's `extra`. */
  prepare?: (S: S, W: ScenarioWindow) => X;
  /** Each character's five orders, by id; every other character Rests. */
  orders?: Record<number, Order[]> | ((S: S, extra: X) => Record<number, Order[]>);
}

/** A realm's setup as generateBotSetups deals it, with what the staging adds. */
interface ARealmsSetup {
  id: number;
  kingdomName: string;
  alignment?: string;
  race?: string;
  skills?: Record<string, unknown>;
  gamePlayerId: string;
  name: string;
}

/** The turn mode the staging gives a world: manual, so no watcher reads the clock or runs a turn. */
interface TheStagedTurnMode {
  mode: 'manual';
  time: string;
  everyDays: number;
  nextDeadlineAt: null;
  turnRanAt: null;
}

/** The staged world, as far as the staging reads and sets it. */
interface AStagedWorld {
  turn: number;
  safeStart: boolean;
  botDifficulty: string;
  botDiplomacy: string;
  turnMode: TheStagedTurnMode;
  characters: { id: number; alive: boolean; player: number | null }[];
}

/** The GM portal's window: its functions (e.g. buildTurnReport) as the turn left them. */
export interface ScenarioWindow extends PageWindow {
  /** A realm's report from its view (playerView) and, after a turn, the lines it reads (playerEvents). */
  buildTurnReport(view: unknown, itsLines?: unknown): Record<string, unknown> | null;
  /** What realm `playerIndex` may see of the world S. */
  playerView(S: unknown, playerIndex: number): unknown;
  getNeighborsP(p: unknown, cols: number, rows: number, provinces: unknown[]): unknown[];
  /** A character's skill with every bonus counted, as the rolls use it. */
  effSkillOf(c: unknown, stat: string, chars: unknown[]): number;
  runTurn(): Promise<void>;
  probeTelemetry(): Promise<boolean>;
  generateBotSetups(taken: unknown[], count: number, from: number): { id: number; kingdomName: string }[];
  generateNewGame(
    setup: ARealmsSetup[],
    size: { cols: number; rows: number },
    maxTurns: number,
    opts: { seaPct: number },
  ): Promise<AStagedWorld>;
}

export interface Scenario {
  W: ScenarioWindow;
  /** Page errors seen so far. */
  errs: string[];
  world(opts?: WorldOptions): Promise<{ S: AStagedWorld; setup: ARealmsSetup[] }>;
  turn<S = unknown, X = unknown>(opts: TurnOptions<S, X>): Promise<Turn<S, X>>;
  rest(): Order[];
}

/** The rows the fake database holds for the turn: the game, its realms, its logs. */
interface TheRowsTheTurnReads {
  games_one?: unknown;
  game_players_list?: unknown[];
  turn_logs_list?: unknown[];
}

/** A change the page sent, as the staging reads it back. */
interface AChangeAsRead {
  table: string;
  val?: { game_state?: string; player_index?: number; entries?: unknown };
}

/** opts.seed fixes the page's own Math.random; opts.now pins its clock; opts.telemetry has the page write its
 *  statistics rows (Turn.events). */
export async function bootScenario(
  opts: { seed?: number; now?: number | string; telemetry?: boolean; page?: string } = {},
): Promise<Scenario> {
  const html = readPage(opts.page !== undefined && opts.page !== '' ? opts.page : 'kingdoms-call-gm-portal.html');
  let ROWS: TheRowsTheTurnReads = {};
  const WRITES: AChangeTheGameMastersTurnSent[] = [];
  const errs: string[] = [];
  const d = bootJsdom(html, {
    ...(opts.seed === undefined ? {} : { seed: opts.seed }),
    ...(opts.now === undefined ? {} : { now: opts.now }),
    supabase: { createClient: () => ({}) },
    db: makeAFakeDbHoldingTheGameMastersTurn(DB_VERSION, {
      // `as`: the staged rows hold the columns the GM's turn reads, not every column of a game or a realm
      theGame: () => (ROWS.games_one ?? null) as AGameWithItsRealms | null,
      theRealms: () => (ROWS.game_players_list ?? []) as ARealm[],
      changes: WRITES,
    }).db,
    setup(w) {
      w.addEventListener('error', (e) =>
        errs.push(e.error?.stack !== undefined && e.error.stack !== '' ? e.error.stack : e.message),
      );
      w.console.error = (...a) => {
        const t = a.map(String).join(' ');
        if (/Could not load|stub|fetch/i.test(t)) return;
        errs.push('console.error: ' + t);
      };
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  });
  await new Promise((r) => setTimeout(r, 500));
  // `as`: the GM portal's window, checked for runTurn below as the old helper checked it
  const W = d.window as ScenarioWindow;
  if (typeof W.runTurn !== 'function') throw new Error('GM portal did not boot: ' + errs.slice(0, 2).join(' | '));
  if (opts.telemetry === true && !(await W.probeTelemetry()))
    throw new Error('telemetry: the page did not find the turn_events table');
  const rest = (): Order[] => [0, 1, 2, 3, 4].map(() => ({ action: 'rest', target: '', extra: '', desc: '' }));

  // A fresh world: `realms` realms on a cols×rows map; safe start off; then prepare(S,W) edits it.
  // `alignments` (and `races`) name a realm's alignment (race) by index, for a test that needs a particular
  // crown; a realm not named keeps the random one it was dealt.
  async function world({
    realms = 2,
    cols = 10,
    rows = 6,
    seaPct = 20,
    alignments = [],
    races = [],
  }: WorldOptions = {}): Promise<{ S: AStagedWorld; setup: ARealmsSetup[] }> {
    const setup: ARealmsSetup[] = W.generateBotSetups([], realms, 0).map((b) => ({
      ...b,
      gamePlayerId: 'gp' + String(b.id),
      name: b.kingdomName,
    }));
    // `as`: the page's table of each crown's skill build, read through eval
    const builds = W.eval('(typeof BOT_SKILL_BUILD!=="undefined")?BOT_SKILL_BUILD:{}') as Record<
      string,
      Record<string, unknown> | undefined
    >;
    setup.forEach((s, i) => {
      const alignment = alignments[i];
      if (alignment !== undefined && alignment !== '') {
        s.alignment = alignment;
        const build = builds[s.alignment];
        if (build) s.skills = { ...build };
      }
      const race = races[i];
      if (race !== undefined && race !== '') s.race = race;
    }); // a crown's own skill build, as a bot of that alignment would be dealt
    const S = await W.generateNewGame(setup, { cols, rows }, 999, { seaPct });
    S.safeStart = false;
    // what Turn 0 adds (turn-zero.ts), so the world is a whole save, which the GM page's stop lets play (P1-15f8)
    S.botDifficulty = 'hard';
    S.botDiplomacy = 'normal';
    S.turnMode = { mode: 'manual', time: '20:00', everyDays: 1, nextDeadlineAt: null, turnRanAt: null };
    return { S, setup };
  }
  async function turn<S = unknown, X = unknown>({
    realms = 2,
    cols = 10,
    rows = 6,
    seaPct = 20,
    alignments = [],
    races = [],
    bots = [],
    prepare,
    orders = {},
  }: TurnOptions<S, X>): Promise<Turn<S, X>> {
    const { S, setup } = await world({ realms, cols, rows, seaPct, alignments, races });
    // `as`: the test's own type for the staged world (S), which it reads and edits
    const staged = S as unknown as S;
    // `as`: with no `prepare`, `extra` is null, as the old helper gave it
    const extra = prepare ? prepare(staged, W) : (null as X);
    const ord = typeof orders === 'function' ? orders(staged, extra) : orders;
    const all: Record<number, Order[]> = {};
    S.characters
      .filter((c) => c.alive && c.player != null)
      .forEach((c) => {
        all[c.id] = ord[c.id] ?? rest();
      });
    const payload = (pi: number) => {
      const o: Record<number, Order[] | undefined> = {};
      S.characters
        .filter((c) => c.alive && c.player === pi)
        .forEach((c) => {
          o[c.id] = all[c.id];
        });
      return JSON.stringify({
        orders: o,
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
    };
    const players = setup.map((sp) => {
      const bot = bots.includes(sp.id);
      return {
        id: sp.gamePlayerId,
        user_id: bot ? null : 'u' + String(sp.id),
        player_index: sp.id,
        display_name: sp.name,
        orders: bot ? null : payload(sp.id),
        orders_submitted: !bot,
        turn_report: JSON.stringify(bot ? { isBot: true } : {}),
      };
    });
    ROWS = {
      games_one: {
        id: 'gs',
        name: 'T',
        turn: S.turn,
        status: 'active',
        game_state: JSON.stringify(S),
        max_turns: 999,
        game_players: players,
      },
      game_players_list: players,
      turn_logs_list: [],
    };
    W.eval(`currentGame={id:'gs',turn:${String(S.turn)},status:'active',name:'T'};`);
    WRITES.length = 0;
    // `as`: a copy of the staged world, the test's type
    const before = JSON.parse(JSON.stringify(S)) as S;
    await W.runTurn();
    await new Promise((r) => setTimeout(r, 10));
    // `as`: what the page sent, read as the old helper read it
    const sent = WRITES as AChangeAsRead[];
    const w = [...sent].reverse().find((x) => x.table === 'games' && x.val?.game_state);
    const lg = sent.find((x) => x.table === 'turn_logs' && x.val?.player_index === -1);
    // `as`: the GM's log as the page wrote it
    const log = (lg?.val?.entries ?? []) as ALogLine[];
    const reports: Record<number, Record<string, unknown>> = {};
    sent
      .filter((x) => x.table === 'turn_logs' && x.val?.player_index != null && x.val.player_index >= 0)
      .forEach((x) => {
        // `as`: a realm's report as the page wrote it
        if (x.val?.player_index != null) reports[x.val.player_index] = x.val.entries as Record<string, unknown>;
      });
    const events = sent.filter((x) => x.table === 'turn_events').flatMap((x) => x.val);
    return {
      S: before,
      S2: w?.val?.game_state != null ? JSON.parse(w.val.game_state) : null,
      log,
      reports,
      extra,
      events,
      text: (charId) =>
        log
          .filter((e) => charId == null || e.charId === charId || (e.charIds ?? []).includes(charId))
          .map((e) => e.text)
          .join('\n'),
    };
  }
  return { W, errs, world, turn, rest };
}

// Helpers for staging.
export const order = (action: string, target: string | number = '', extra: string | number = ''): Order => ({
  action,
  target: String(target),
  extra: String(extra),
  desc: '',
});
export const restOrder = (): Order => order('rest');
/** Five orders: the given ones first, then Rest. */
export const plan = (...os: Order[]): Order[] => {
  const out = os.slice(0, 5);
  while (out.length < 5) out.push(restOrder());
  return out;
};
