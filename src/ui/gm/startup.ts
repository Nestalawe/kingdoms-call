import { thisPagesBuild } from '../shared/a-newer-version-of-this-page.ts';
import { gameMetaOf } from '../../engine/rules-on-plain-values/a-games-settings-read-from-its-row.ts';
import { computeStandings } from '../../engine/titles/reckoning.ts';
import { thePagesDb } from './config.ts';
import { kcHtml } from '../shared/kc-safe.ts';
import { theField, thisOrElse } from '../shared/a-value-of-any-kind-read-as-javascript-reads-it.ts';
import type { AGameWithItsRealms, ARealm } from '../../db/the-db-interface-and-its-areas.ts';
import type { TheStatisticsOfTheTurn } from '../../views/the-statistics-of-the-turn.ts';

/** The game the GM has opened, as the game screen's read gives it (game-detail.ts and turn-zero.ts set `currentGame`
 *  to it): every column, with its realms'. */
export type TheGameTheGmHasOpen = AGameWithItsRealms;
/** The realms of the game the GM has opened, as `currentGamePlayers` holds them (none before a game is opened). */
export type TheRealmsOfTheGameTheGmHasOpen = readonly ARealm[];
/** A games row as the GM page reads its settings: its `meta` and `game_state` columns, JSON words or parsed. */
export interface AGamesRowAsItsSettingsAreRead {
  readonly meta?: unknown;
  readonly game_state?: unknown;
}

// The oldest database this page works with (P0-34): a migration's version. kcDbGuard checks it before the
// first read. Raise it when this page needs a newer database change (docs/traps.md, "A site change that needs
// a database change"). Now P0-25's: the game screen's switch saves games.block_eliminated_msgs. (Since P0-32e,
// Master GM mode (P0-32g) has needed the Overlord's rights on every game.)
export const KC_DB_MIN = '20261015062128';
// This build: the commit the page was built from, 7 characters, from its kc-build meta (tools/build.ts, plan P1-06).
// Telemetry rows, Hall of Fame records and the Stats export carry it; "unknown" on a page built without git.
export const KC_BUILD_STAMP = thisPagesBuild() ?? 'unknown';

// ════
// TURN RUNNING MODES (Sept 2026) — manual / auto / deadline. The mode lives inside game_state
// (setup cfg before Turn 0, then G.turnMode once the game is active) so no schema change is needed
// and the player portal can read it too.
// {mode:'manual'|'auto'|'deadline', time:'HH:MM', everyDays:N, nextDeadlineAt:ISO|null, turnRanAt:ISO|null}
// 'auto': the watcher in this GM tab runs the turn as soon as every non-exempt human realm has
// submitted. 'deadline': as 'auto', OR once the fixed clock deadline has passed (whichever comes
// first). The deadline is
// the first HH:MM (this computer's clock) strictly after the last run + (everyDays-1) days.
// Exempt realms (never waited on): bots, conceded realms, extinguished dynasties (_eliminated), and
// realms with neither a living character nor a province.
// ════
export const TURN_MODES = {
  manual: 'Manual — GM runs each turn',
  auto: 'Automatic — runs when all orders are in',
  deadline: 'Automatic with deadline',
};
/** A game's world or setup, parsed from its row: any value JSON holds (never a falsy one: `{}` for none). */
export function parseGameState(game: AGamesRowAsItsSettingsAreRead | null | undefined): unknown {
  if (!game) return {};
  try {
    const gs: unknown = typeof game.game_state === 'string' ? JSON.parse(game.game_state) : game.game_state;
    return thisOrElse(gs, {});
  } catch {
    return {};
  }
}
/** The three ways a turn is run. */
export type ATurnModesName = keyof typeof TURN_MODES;
/** Whether a value is one of the three ways a turn is run, as `['manual', 'auto', 'deadline'].includes` read it. */
function isATurnModesName(mode: unknown): mode is ATurnModesName {
  return mode === 'manual' || mode === 'auto' || mode === 'deadline';
}
/** A game's turn mode, as normalizeTurnMode gives it: its time and deadlines as the mode held them (the time: any value
 *  whose words are HH:MM). */
export interface ATurnMode {
  mode: ATurnModesName;
  time: unknown;
  everyDays: number;
  nextDeadlineAt: unknown;
  turnRanAt: unknown;
}
export function normalizeTurnMode(tm: unknown): ATurnMode {
  const held: object = tm && typeof tm === 'object' ? tm : {};
  const heldMode: unknown = Reflect.get(held, 'mode');
  const mode = isATurnModesName(heldMode) ? heldMode : 'manual';
  const heldTime: unknown = Reflect.get(held, 'time');
  const time = /^\d{2}:\d{2}$/.test(String(thisOrElse(heldTime, ''))) ? heldTime : '20:00';
  const everyDays = Math.max(1, Math.min(30, parseInt(String(Reflect.get(held, 'everyDays'))) || 1));
  return {
    mode,
    time,
    everyDays,
    nextDeadlineAt: thisOrElse(Reflect.get(held, 'nextDeadlineAt'), null),
    turnRanAt: thisOrElse(Reflect.get(held, 'turnRanAt'), null),
  };
}
// ════
// GAME META — the light summary column (Disk-IO fix, 2026-09-25)
// ════
// Supabase warned that the project was exhausting its Disk IO budget. Measured on a 6-realm game
// after four turns: `select('*, game_players(*)')` returned ~810 KB (game_state 474 KB + six
// reports of 33–53 KB), and the auto-turn watcher issued exactly that query once a minute per open
// GM tab — ~1.1 GB a day per game, all of it TOAST reads of columns the tick never looks at. It
// only wanted the turn mode and which realms are exempt from orders; the player portal's My Games
// list wanted the same two things and pulled the whole world for them too.
// `games.meta` (jsonb, ~1 KB) now carries that summary, written by every code path that writes
// game_state: {v, turnMode, exempt:[player indices], realms, seaPct, mapSize, maxPlayers,
// botCount, allBot, botDifficulty, visibility, invited}. Readers prefer meta and fall back to
// parsing game_state, so a row that predates the column still works; backfillGameMeta stamps
// those once. The column is in the database's migrations (supabase/); if it's ever missing,
// probeGameMeta() leaves _kcHasMeta=false, no write mentions the column (an unknown column would
// fail the whole turn save) and the heavy selects are used as before, with a message on the game list.
export let _kcHasMeta = false;
// The plain "missing from the database" message every probe below shows. Since P0-17 the database changes
// only through migrations, applied by the deploy before the site goes live, so there is no SQL to paste:
// seeing this means the database is behind this copy of the site.
export function kcMissingMsg(title: string, what: unknown, effect: string) {
  return kcHtml`<div class="msg-error"><strong>${title}</strong> — the database has no ${what}, so ${effect}. The deploy adds it to the database before the site goes live, so this copy of the site is ahead of its database: tell Theo.</div>`;
}
export async function probeGameMeta() {
  try {
    const { error } = await thePagesDb.theGameMastersGames.oneGamesMeta();
    _kcHasMeta = !error;
    if (error) console.warn('games.meta probe:', error.message);
  } catch {
    _kcHasMeta = false;
  }
  const el = document.getElementById('msg-games');
  if (el)
    el.innerHTML = _kcHasMeta
      ? ''
      : String(
          kcMissingMsg(
            'Disk-IO fix not active',
            kcHtml`<code>games.meta</code> column`,
            "this tab is still pulling every game's full world and reports once a minute",
          ),
        );
  return _kcHasMeta;
}
// ════════════════════════════════════════════════════════════════════════════════════════════════
// ARCHIVE A GAME (2026-09-27, Toby item 1)
// ════════════════════════════════════════════════════════════════════════════════════════════════
// Deleting a game destroys it. Archiving puts it away: the row, its world, its players, its turn
// logs, its dispatches, its telemetry and its Hall-of-Fame record are ALL kept exactly as they are —
// the game simply drops out of the main list, and the auto-turn watcher stops watching it. The GM
// sees archived games by switching the list to Archived, and can restore one at any time.
//
// NO SCHEMA CHANGE. The flag is `archived` on game_state (the object every save round-trips) and is
// mirrored into `meta` by buildGameMeta, so the light list read sees it without pulling the world.
// A build that predates this feature simply ignores the key.
//
// An archived game is NOT hidden from the leaderboard — nothing is deleted, so the Hall of Fame
// keeps its record. To take a finished game off the board, use the Hall-of-Fame `hidden` flag
// instead; that is what it is for.
export function gameArchived(game: AGamesRowAsItsSettingsAreRead | null | undefined) {
  const m = gameMetaOf(game);
  if (m?.['archived'] !== undefined) return !!m['archived'];
  return !!theField(parseGameState(game), 'archived');
}
export function gameArchivedAt(game: AGamesRowAsItsSettingsAreRead | null | undefined) {
  const m = gameMetaOf(game);
  if (m?.['archivedAt']) return m['archivedAt'];
  return thisOrElse(theField(parseGameState(game), 'archivedAt'), null);
}
// ════
// GAME TELEMETRY (2026-09-25) — every realm's orders, situation and results, turn by turn
// ════
// Two Supabase tables, written by the GM portal only (the player portal never touches them):
//   turn_events  — ONE row per realm per resolved turn: the orders that realm gave (human or bot),
//                  a compact snapshot of its situation BEFORE the turn (gold, land, tax, armies,
//                  every character's place / health / skills / units / items), the same snapshot
//                  AFTER, and what happened to it in between (every battle with the pre-dice
//                  strengths, lair fights, provinces taken and lost, characters killed, spells
//                  cast and whether they took). ~3–8 KB a row.
//   game_results — ONE row per realm when a game ends: final rank, score, how the game was won,
//                  the turn the realm dropped out, and its final snapshot.
// Both are read by the STATS tab (see openStats) — the balance view — and both export as CSV/JSON
// so the same rows can be used as (situation → orders → outcome) examples to tune the bots.
// Neither table is ever read on the turn path, and a failed write never blocks a turn: the write is
// best-effort, the error is kept in _kcTelLastErr and shown on the game list.
// The tables are in the database's migrations (supabase/). If they're ever missing, probeTelemetry()
// leaves _kcHasTel=false, nothing is written, and the game list says so.
// game_id is TEXT (not a foreign key) so the rows survive a game being deleted — finished test games
// are usually deleted to tidy the list, and their data is the whole point. The Stats tab has a
// "forget deleted games" button for when that is NOT wanted.
export const KC_TEL_V = 1; // bump when the row shape changes (rows carry it in build)
// Declared globals (plan P1-09b): one binding the page's files and its tests share (ui/gm/globals.ts says why).
globalThis._kcHasTel = false;
globalThis._kcTelLastErr = null;
export async function probeTelemetry() {
  try {
    const a = await thePagesDb.theStatistics.oneTurnRecordsId();
    const b = await thePagesDb.theStatistics.oneGameResultsId();
    _kcHasTel = !a.error && !b.error;
    if (a.error) console.warn('turn_events probe:', a.error.message);
    if (b.error) console.warn('game_results probe:', b.error.message);
  } catch {
    _kcHasTel = false;
  }
  renderTelemetryBanner();
  return _kcHasTel;
}
export function renderTelemetryBanner() {
  const el = document.getElementById('msg-telemetry');
  if (!el) return;
  if (!_kcHasTel) {
    el.innerHTML = String(
      kcMissingMsg(
        '📈 Game telemetry not active',
        kcHtml`<code>turn_events</code> / <code>game_results</code> tables`,
        'nothing is being recorded for the Stats tab or for bot training',
      ),
    );
  } else if (_kcTelLastErr) {
    el.innerHTML = String(
      kcHtml`<div class="msg-error"><strong>📈 Telemetry write failed</strong> on the last turn run: ${_kcTelLastErr}. The turn itself was saved; only the statistics row was lost.</div>`,
    );
  } else el.innerHTML = '';
}
// ════════════════════════════════════════════════════════════════════════════════════════════════
// DISPATCHES — the player-to-player messaging tables (2026-09-27)
// ════════════════════════════════════════════════════════════════════════════════════════════════
// The messaging UI lives entirely in the PLAYER portal (it replaced the duplicate Report tab beside
// the map). The GM portal carries only this: a probe so the game list can say when the tables are
// missing, and the two deletes that keep a removed game from leaving dispatches behind. No turn-path
// code touches these tables, so a messaging fault can never cost a turn.
//
// WHAT THE POLICIES GUARANTEE, and what they do not:
//  * A dispatch can only be INSERTED with from_index = the realm the signed-in account actually holds
//    in that game, and from_user_id = auth.uid(). A player cannot write in another realm's name.
//  * A dispatch can only be READ by its sender, its addressees, or anybody in the game if it is
//    public — plus the GM of that game. THE GM CAN THEREFORE READ PRIVATE DIPLOMACY. That is a
//    referee power, deliberate and easy to revoke: a migration that drops the second
//    `or exists (…games…)` branch of the read policy.
//  * "You may only write to a realm you have MET" is enforced in the player portal's UI only — the
//    encountered list lives inside game_state, which the access rules cannot read. Bypassing it would let a
//    player write to a stranger; it would NOT let them read anything more.
//  * Nobody can UPDATE a dispatch and only the game's GM can DELETE one, so a message cannot be
//    edited or withdrawn after it is sent — which is what "messages don't get lost" has to mean.
// game_id is TEXT and casts the other side (gp.game_id::text) so it does not matter whether the games
// table's key is uuid or text, and the rows outlive the game row itself. The tables and their policies
// are in supabase/schemas/, with their tests in supabase/tests/.
// A declared global (plan P1-09b): one binding the page's files and its tests share (ui/gm/globals.ts says why).
globalThis._kcHasMsg = false;
export async function probeMessaging() {
  try {
    const a = await thePagesDb.theDispatches.oneDispatchsId();
    const b = await thePagesDb.theDispatches.oneReadMarksGame();
    _kcHasMsg = !a.error && !b.error;
    if (a.error) console.warn('game_messages probe:', a.error.message);
    if (b.error) console.warn('game_message_reads probe:', b.error.message);
  } catch {
    _kcHasMsg = false;
  }
  renderMessagingBanner();
  return _kcHasMsg;
}
export function renderMessagingBanner() {
  const el = document.getElementById('msg-messaging');
  if (!el) return;
  el.innerHTML = _kcHasMsg
    ? ''
    : String(
        kcMissingMsg(
          '✉ Player messaging not active',
          kcHtml`<code>game_messages</code> / <code>game_message_reads</code> tables`,
          'the Dispatches panel in the player portal cannot send or receive',
        ),
      );
}

// Final standings order: score, then tax base, then treasury (the Reckoning tie-break).
/** A realm's standing read by its index, as `standings[i].score` read it: none throws the TypeError that read threw. */
function theScoreOfTheStandingAt(standings: ReturnType<typeof computeStandings>['standings'], i: number): number {
  const standing = standings[i];
  if (standing === undefined) throw new TypeError("Cannot read properties of undefined (reading 'score')");
  return standing.score;
}
export function telRankOrder(gs: Parameters<typeof computeStandings>[0]) {
  const s = computeStandings(gs);
  const idx = s.standings.map((st) => st.index);
  idx.sort(
    (a, b) =>
      theScoreOfTheStandingAt(s.standings, b) - theScoreOfTheStandingAt(s.standings, a) ||
      (Number(s.taxByPlayer[b]) || 0) - (Number(s.taxByPlayer[a]) || 0) ||
      (Number(s.goldByPlayer[b]) || 0) - (Number(s.goldByPlayer[a]) || 0),
  );
  const rank: Record<number, number> = {};
  idx.forEach((pi, i) => {
    rank[pi] = i + 1;
  });
  return { rank, standings: s };
}
export function telBotDifficultyOf(gs: unknown) {
  return thisOrElse(gs ? theField(gs, 'botDifficulty') : gs, 'hard');
} // 2026-09-26: 'hard' is the only strength now; older saves keep whatever word they carry
/** A realm's snapshot as the outcomes read it (a turn's telemetry's, before and after the turn): its numbers by name. */
type ARealmsSnapshotAsTheOutcomesReadIt = Readonly<Partial<Record<string, unknown>>>;
// The per-realm view of what the collectors caught this turn, plus the before/after deltas.
export function telOutcomesFor(
  _gs: unknown,
  pi: number,
  tel: Readonly<Partial<TheStatisticsOfTheTurn>>,
  pre: ARealmsSnapshotAsTheOutcomesReadIt | null | undefined,
  post: ARealmsSnapshotAsTheOutcomesReadIt | null | undefined,
  rank: number | null | undefined,
) {
  const B = (tel.battles ?? []).filter((b) => b.atkPi === pi || b.defPi === pi);
  const mine = (b: TheStatisticsOfTheTurn['battles'][number]) => b.atkPi === pi;
  const battles = {
    fought: B.length,
    asAttacker: B.filter(mine).length,
    won: B.filter((b) => (mine(b) ? b.won : !b.won)).length,
    unitsLost: B.reduce((s, b) => s + (mine(b) ? b.atkLost : b.defLost), 0),
    unitsKilled: B.reduce((s, b) => s + (mine(b) ? b.defLost : b.atkLost), 0),
    list: B.map((b) => ({ ...b, side: mine(b) ? 'atk' : 'def', win: mine(b) ? b.won : !b.won })),
  };
  const E = (tel.encounters ?? []).filter((e) => e.pi === pi);
  const encounters = {
    fought: E.length,
    won: E.filter((e) => e.won).length,
    fled: E.filter((e) => e.fled).length,
    heroKilled: E.filter((e) => e.killed).length,
    list: E,
  };
  const C = (tel.captures ?? []).filter((c) => c.from === pi || c.to === pi);
  const captures = {
    gained: C.filter((c) => c.to === pi).length,
    lost: C.filter((c) => c.from === pi).length,
    list: C,
  };
  const D = (tel.deaths ?? []).filter((d) => d.pi === pi || d.killerPi === pi);
  const deaths = {
    own: D.filter((d) => d.pi === pi).length,
    king: D.some((d) => d.pi === pi && d.king),
    killed: D.filter((d) => d.killerPi === pi && d.pi !== pi).length,
    list: D,
  };
  const S = (tel.spells ?? []).filter((x) => x.pi === pi);
  const spells = { cast: S.length, ok: S.filter((x) => x.ok).length, list: S };
  const d = (k: string) => {
    const after = post?.[k];
    const before = pre?.[k];
    return after != null && before != null ? Number(after) - Number(before) : null;
  };
  return {
    battles,
    encounters,
    captures,
    deaths,
    spells,
    delta: {
      gold: d('gold'),
      provinces: d('provinces'),
      tax: d('tax'),
      units: d('units'),
      str: d('str'),
      heroes: d('heroes'),
      items: d('items'),
      discoveries: d('discoveries'),
      explored: d('explored'),
    },
    rank: (rank ?? 0) || null,
    score: post?.['_score'] ?? null,
  };
}
