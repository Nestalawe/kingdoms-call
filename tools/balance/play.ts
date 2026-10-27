// Plays one game of the balance matrix in the GM portal (jsdom, through tests/lib/boot.js, so KC_SITE picks the copy
// of the site) and returns its hashes and statistics. Until P1-18 gives the engine a turn function, this is how a turn
// is run.
//
// The same seed gives the same game (P1-02, Decisions; measured, not assumed):
// - each game gets its own fresh page, with an explicit seed and clock (bootJsdom's `seed` and `now`): some names
//   drawn in one game survive in the page into the next;
// - turn mode is manual: in "auto" mode the auto-turn watcher runs a turn by itself, at a moment that depends on load;
// - the stand-in database's own stamps and ids are left out of the hashes (hash.ts);
// - the turn's writes are recorded on the stand-in's one client, below bootJsdom's own wrapper (writes.ts);
// - the runner stops at gameOver: runTurn doesn't stop a finished game.
// After every turn it checks the invariants (tests/lib/invariants.ts, P1-04b) and, in a scripted game, the scripted
// realm's report for leaks (tests/lib/report-leaks.ts, P1-04c): a breach fails the game. They only read.
// The save's check fails a game too (P1-15e1: a-game-fails-on-the-save-check.ts): a `[Save check]` line in a turn's GM
// log, and, after the last turn, the check of the last save. With KC_SITE the line is the other copy's and the last
// save's check this checkout's.
import { bootJsdom, readPage, type PageWindow } from '../../tests/lib/boot.js';
import { checkTurn, describeBreaches } from '../../tests/lib/invariants.ts';
import type { RealmReport } from '../../tests/lib/report-leaks.ts';
import { makeStub, type Row } from '../../tests/lib/stub-db.js';
import {
  whatTheSaveCheckFindsOnTheLastSave,
  whatTheSaveCheckFoundInATurnsLog,
} from './a-game-fails-on-the-save-check.ts';
import { h, reportSectionHashes, turnHashes, withoutStamps, playHash } from './hash.ts';
import { MAP_SIZES, MAX_TURNS, SCRIPTED_REALM, START, type GameSpec } from './matrix.ts';
import { scriptedOrders, type Plan, type State } from './scripted.ts';
import { gameStats, LINES, type GameOver, type Stats, type TelemetryRow } from './stats.ts';
import { recordCalls } from './writes.ts';

/** How long the page is given to boot. A fixed wait until a "boot finished" condition is found that doesn't depend on
 *  load; any replacement is proved by identical hashes at 1 and many games side by side. */
export const BOOT_WAIT_MS = 900;

/** How often each scripted case happened in a game: what bots never do, or too rarely to measure. run.ts fails a run
 *  in which a case never happened, unless a required scenario gives it (run.ts's CASES_A_REQUIRED_SCENARIO_GIVES). */
export interface Cases {
  /** The scripted chaser set out after an enemy on an Encounter Character order. */
  encounter: number;
  /** A scripted chase held by an unresolved battle where the chaser stood or caught up (advancePursuit's "must
   *  wait"): 0 times in 144 bot games at scoping. Counted and printed, but required of the named scenario
   *  `a-chase-held-by-an-unresolved-battle` (P1-15e2b), not of the games: they meet it only by luck. */
  battleChase: number;
}
export const CASE_NAMES: Record<keyof Cases, string> = {
  encounter: 'Encounter Character',
  battleChase: 'a chase held by an unresolved battle',
};

export interface GameResult {
  id: string;
  /** One line per turn played: the hashes in hash.ts's TURN_COLUMNS order. */
  turns: string[];
  /** The game's results rows (game_results, game_records), hashed; '' if the game didn't end. */
  results: string;
  /** Scripted games: each report section's hashes over the whole game, [play, words]. */
  report?: Record<string, [string, string]>;
  stats: Stats;
  cases?: Cases;
  /** A replay (PlayOptions.untilTurn): the GM log lines of its last turn. */
  log?: LogEntry[];
  ms: number;
}

/** A GM log line, as turn_logs keeps it. */
export interface LogEntry {
  text?: unknown;
  type?: unknown;
  charId?: unknown;
  [key: string]: unknown;
}

export interface PlayOptions {
  /** Stop after this turn and keep its GM log lines (a replay, to find where two runs part). */
  untilTurn?: number;
}

function setupGame(W: PageWindow, spec: GameSpec, DB: Record<string, Row[]>): void {
  const size = MAP_SIZES[spec.realms];
  if (!size) throw new Error(`${spec.id}: no map for ${String(spec.realms)} realms`);
  const scripted = spec.group === 'scripted';
  W['currentUser'] = { id: 'gm1' };
  W['__sp'] = Array.from({ length: spec.realms }, (_, i) => ({
    id: i,
    gamePlayerId: 'gp' + String(i),
    isBot: !(scripted && i === SCRIPTED_REALM),
    name: 'Realm' + String(i),
    kingName: 'King' + String(i),
    kingdomName: 'Realm' + String(i),
    race: spec.races[i % spec.races.length],
    alignment: spec.alignments[i % spec.alignments.length],
    temper: 'Brave',
    skills: { melee: 1, tactical: 1, march: 1, white: 1, naval: i % 3 === 0 ? 1 : 0, sage: 1, explorer: 1 },
  }));
  W['__sz'] = size;
  W['__opt'] = { seaPct: spec.seaPct };
  W.eval(`(function(){ const g=generateNewGame(__sp,__sz,0,__opt);
    g.turnMode={mode:'manual',time:'20:00',everyDays:1,nextDeadlineAt:null,turnRanAt:new Date().toISOString()};
    g.botDifficulty='hard'; g.botDiplomacy=${JSON.stringify(spec.diplomacy)}; window.__G=g; })()`);
  (DB['games'] ??= []).push({
    id: 'G1',
    name: 'Matrix',
    gm_user_id: 'gm1',
    status: 'active',
    turn: 1,
    max_players: spec.realms,
    max_turns: 0,
    created_at: START,
    game_state: W.eval('JSON.stringify(__G)'),
    meta: W.eval('JSON.parse(JSON.stringify(buildGameMeta(__G)))'),
  });
  for (let i = 0; i < spec.realms; i++) {
    const human = scripted && i === SCRIPTED_REALM;
    (DB['game_players'] ??= []).push({
      id: 'G1gp' + String(i),
      game_id: 'G1',
      user_id: human ? 'u' + String(i) : null,
      player_index: i,
      display_name: 'Realm' + String(i),
      orders_submitted: false,
      orders: null,
      turn_report: JSON.stringify(human ? {} : { isBot: true, playerSetup: {} }),
    });
  }
}

/** Plays `spec` on `html` (by default the GM portal of the site in KC_SITE, or site/). */
export async function playGame(
  spec: GameSpec,
  html = readPage('kingdoms-call-gm-portal.html'),
  options: PlayOptions = {},
): Promise<GameResult> {
  const t0 = performance.now();
  const S = makeStub();
  const DB = S.DB;
  const calls = recordCalls(S.supabase.createClient());
  const errors: string[] = [];
  const W = bootJsdom(html, {
    supabase: S.supabase,
    seed: spec.seed,
    now: START,
    setup(w) {
      w.addEventListener('error', (e) => errors.push(e.error?.stack ?? e.message));
      w.onunhandledrejection = (e) => errors.push(String(e.reason));
      w.console.error = (...a) => errors.push('console.error: ' + a.map(String).join(' '));
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  }).window;
  const fail = (what: string) => new Error(`${spec.id} (seed ${String(spec.seed)}): ${what}`);
  try {
    await new Promise((r) => setTimeout(r, BOOT_WAIT_MS));
    if (errors.length) throw fail('the page failed to boot: ' + String(errors[0]));
    setupGame(W, spec, DB);
    const scripted = spec.group === 'scripted';
    const game = () => {
      const g = DB['games']?.[0];
      if (!g) throw fail('the game row is gone');
      return g;
    };
    const me = DB['game_players']?.find((p) => p['player_index'] === SCRIPTED_REALM);
    const turns: string[] = [];
    const unresolved: number[] = [];
    const gmLog: LogEntry[] = [];
    const sections = new Map<string, string[]>();
    const cases: Cases = { encounter: 0, battleChase: 0 };
    let lastLog: LogEntry[] = [];

    for (let t = 1; t <= Math.min(MAX_TURNS, options.untilTurn ?? MAX_TURNS); t++) {
      const row = game();
      const before = JSON.parse(String(row['game_state'])) as State & { gameOver?: GameOver };
      if (row['status'] !== 'active' || before.gameOver) break;
      let plan: Plan | null = null;
      if (scripted && me) {
        const s = scriptedOrders(before, SCRIPTED_REALM, Number(row['turn']));
        me['orders'] = JSON.stringify(s.orders);
        me['orders_submitted'] = true;
        plan = s.plan;
      }
      const nLogs = (DB['turn_logs'] ??= []).length;
      const nEvents = (DB['turn_events'] ??= []).length;
      errors.length = 0;
      calls.length = 0;
      W['__game'] = structuredClone(row);
      const res = (await W.eval('runTurn({auto:true,game:__game,reason:"matrix"})')) as { ok?: boolean } | null;
      if (errors.length || res?.ok === false) throw fail(`turn ${String(t)} failed: ${errors[0] ?? 'not ok'}`);

      const after = game();
      const state = JSON.parse(String(after['game_state'])) as State;
      const rows = DB['turn_logs'].slice(nLogs);
      const log = rows.filter((l) => l['player_index'] === -1).flatMap((l) => l['entries'] as LogEntry[]);
      const telemetry = DB['turn_events'].slice(nEvents);
      const breaches = checkTurn({
        before,
        after: state,
        gmLog: log,
        telemetry,
        players: DB['game_players'] ?? [],
        reports: rows
          .filter((l) => Number(l['player_index']) >= 0)
          .map((l) => ({ realm: Number(l['player_index']), report: l['entries'] as RealmReport['report'] })),
      });
      if (breaches.length) throw fail('an invariant broke\n' + describeBreaches(`turn ${String(t)}`, breaches));
      const places = whatTheSaveCheckFoundInATurnsLog(log);
      if (places.length) throw fail(`the save's check, turn ${String(t)}: ${places.join('; ')}`);
      const report = scripted && me ? (JSON.parse(String(me['turn_report'])) as Record<string, unknown>) : null;
      turns.push(turnHashes({ state, gmLog: log, telemetry, report, writes: calls.splice(0) }));
      gmLog.push(...log);
      lastLog = log;
      unresolved.push(state.world.provinces.filter((p) => p._battleUnresolved).length);
      if (report) {
        // Each section's hashes turn by turn; '-' for a turn without it.
        const now = reportSectionHashes(report);
        for (const k of Object.keys(now))
          if (!sections.has(k)) sections.set(k, Array<string>(turns.length - 1).fill('-'));
        for (const [k, list] of sections) list.push(now[k]?.join('/') ?? '-');
      }
      if (plan) {
        const by = (id: number, re: RegExp) =>
          log.some((e) => e.charId === id && typeof e.text === 'string' && re.test(e.text));
        if (plan.chaser && by(plan.chaser.heroId, LINES.chaseStart)) cases.encounter++;
        // Counted once a turn per hero: a held chase is logged again in each phase it waits.
        for (const c of [plan.chaser, ...plan.battleChases])
          if (c && by(c.heroId, LINES.chaseWaited)) cases.battleChase++;
      }
    }

    const lastSave = String(game()['game_state']);
    const placesInTheLastSave = whatTheSaveCheckFindsOnTheLastSave(lastSave);
    if (placesInTheLastSave.length)
      throw fail(
        `the save's check, the last save (after turn ${String(turns.length)}): ${placesInTheLastSave.join('; ')}`,
      );
    const final = JSON.parse(lastSave) as { gameOver?: GameOver };
    const resultRows = [...(DB['game_results'] ?? []), ...(DB['game_records'] ?? [])].map(withoutStamps);
    const result: GameResult = {
      id: spec.id,
      turns,
      results: resultRows.length ? playHash(resultRows) : '',
      stats: gameStats({
        telemetry: DB['turn_events'] as unknown as TelemetryRow[],
        gmLog,
        unresolved,
        gameOver: final.gameOver ?? null,
      }),
      ms: Math.round(performance.now() - t0),
    };
    if (options.untilTurn != null) result.log = lastLog;
    if (scripted) {
      const part = (list: string[], i: number) => h(list.map((x) => x.split('/')[i] ?? '-').join(' '));
      result.report = Object.fromEntries([...sections].map(([k, list]) => [k, [part(list, 0), part(list, 1)]]));
      result.cases = cases;
    }
    return result;
  } finally {
    W.close();
  }
}
