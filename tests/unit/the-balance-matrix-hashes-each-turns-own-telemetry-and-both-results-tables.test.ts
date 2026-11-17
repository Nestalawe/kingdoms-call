// The balance matrix's game runner (tools/balance/play.ts's playGame, on the fake since P1-17s1) hashes what each turn
// and the game wrote, read from the right rows (plan P1-21, the mutation session of 2026-11-17 over P1-17s1):
// - each turn's telemetry column is the hash of the telemetry rows that turn wrote, and of no other turn's, counted from
//   the telemetry table's own length (a turn writes more GM log rows than telemetry rows, so a count taken on another
//   table cuts the window in the wrong place);
// - the game's results column is the hash of both results tables, the statistics' results and the Hall of Fame's
//   entries, in that order.
// The matrix catches either only as a changed hash against its baseline, which can't say which column read what.
// Level 1 (unit): playGame plays a made-up GM page, handed in as its HTML, whose runTurn writes known rows through the
// Db the runner hands it: one GM log row more than the telemetry each turn, then the two results tables and the game
// finished on turn 2. The page saves the made-up version-1 save (tests/fixtures/saves/version-1.json) unchanged, so the
// runner's checks (the invariants, the save's check) pass on it. The real GM portal would take minutes to finish a
// game, and its rows can't be known ahead.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { playHash, TURN_COLUMNS, withoutStamps } from '../../tools/balance/hash.ts';
import type { GameSpec } from '../../tools/balance/matrix.ts';
import { playGame } from '../../tools/balance/play.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const SAVE = fs.readFileSync(path.join(import.meta.dirname, '../fixtures/saves/version-1.json'), 'utf8');

/** The telemetry row the made-up page writes on turn `turn`, for its one realm. */
const aTelemetryRow = (turn: number) => ({
  game_id: 'G1',
  turn,
  player_index: 0,
  is_bot: true,
  pre: { gold: 10 * turn, provinces: 1, str: 0 },
  post: { gold: 10 * turn + 5, provinces: 1, str: 0, titles: [] },
  outcomes: {
    battles: { list: [] },
    encounters: { list: [] },
    deaths: { list: [] },
    spells: { list: [] },
    delta: { items: 0 },
  },
});
/** The statistics' result and the Hall of Fame's entry the made-up page writes when its game ends. */
const A_RESULT = { game_id: 'G1', player_index: 0, is_bot: true, place: 1 };
const AN_ENTRY = { game_id: 'G1', game_name: 'Made-up Matrix', winner_name: 'Realm0' };
/** The GM log rows the page writes a turn: one more than its telemetry rows. */
const GM_LOG_ROWS_A_TURN = 2;

/** A made-up GM page: the three functions the runner calls (generateNewGame, buildGameMeta, runTurn). Its runTurn
 *  writes each turn's GM log rows and telemetry row, and on turn 2 the results and the Hall of Fame's entry, and
 *  finishes the game, all through the Db the runner hands the page. */
function aMadeUpGmPage(): string {
  const save: unknown = JSON.parse(SAVE);
  const data = JSON.stringify({ save, telemetry: [aTelemetryRow(1), aTelemetryRow(2)] }).replaceAll('<', '\\u003c');
  return `<!doctype html><html><body><script>
const MADE_UP = ${data};
const RESULT = ${JSON.stringify(A_RESULT)};
const ENTRY = ${JSON.stringify(AN_ENTRY)};
function generateNewGame() { return JSON.parse(JSON.stringify(MADE_UP.save)); }
function buildGameMeta() { return { v: 1 }; }
async function runTurn({ game }) {
  const db = window.kcTheDbATestHandsThePage;
  const turn = Number(game.turn);
  for (let i = 0; i < ${String(GM_LOG_ROWS_A_TURN)}; i++)
    await db.theTurnAsTheGameMasterRunsIt.writeThisLog({ game_id: 'G1', turn, player_index: -1, entries: [] });
  await db.theStatistics.writeTheseTurnRecords([MADE_UP.telemetry[turn - 1]]);
  const last = turn === 2;
  if (last) {
    await db.theStatistics.writeTheseResults([RESULT]);
    await db.theHallOfFame.writeTheseEntries([ENTRY]);
  }
  await db.theTurnAsTheGameMasterRunsIt.clearTheOrdersOfEveryRealmOfThisGame('G1');
  await db.theTurnAsTheGameMasterRunsIt.saveThisGameWhileOnThisTurnAndAnswerItsId('G1', turn, {
    turn: turn + 1,
    game_state: game.game_state,
    status: last ? 'finished' : 'active',
  });
  return { ok: true };
}
</script></body></html>`;
}

const A_BOT_GAME: GameSpec = {
  id: 'bots-made-up',
  group: 'bots',
  seed: 1,
  realms: 3,
  seaPct: 0,
  diplomacy: 'normal',
  races: ['Human'],
  alignments: ['Neutral'],
};

// One game through the matrix's runner: two turns on the made-up page, about a second (its boot wait alone is 0.9 s)
test(
  "each turn's telemetry is the rows it wrote, and the results are both tables'",
  timeLimitForTheWork({ matrixGamesPlayed: 1 }),
  async () => {
    const game = await playGame(A_BOT_GAME, aMadeUpGmPage());
    expect(game.turns, 'two turns played, then the game is finished').toHaveLength(2);
    const telemetry = TURN_COLUMNS.indexOf('telemetry');
    expect(
      game.turns.map((line) => line.split(' ')[telemetry]),
      "each turn's telemetry column: its own row",
    ).toEqual([playHash([withoutStamps(aTelemetryRow(1))]), playHash([withoutStamps(aTelemetryRow(2))])]);
    expect(game.results, "the results column: the statistics' result, then the Hall of Fame's entry").toBe(
      playHash([A_RESULT, AN_ENTRY].map(withoutStamps)),
    );
  },
);
