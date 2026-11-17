import { kcHtml } from '../shared/kc-safe.ts';
import { kcRng } from '../../engine/rng.ts';
import { thePagesDb } from './config.ts';
import { _kcHasMeta, gameArchived, probeGameMeta, probeMessaging, probeTelemetry } from './startup.ts';
import { autoTurnReady, fmtDeadline, turnModeOf } from './turn-mode.ts';
import { runTurn } from './turn-shell.ts';
import { checkForANewerVersion } from '../shared/a-newer-version-of-this-page.ts';
import { _kcOverlord, gmPortalAllowed, setAutoTurnStatus, show } from './sign-in.ts';
import { backfillGameResults, probeLeaderboard } from './hall-of-fame.ts';
import { backfillGameMeta, loadGames } from './game-list.ts';
import { openGame } from './game-detail.ts';
import { theElementFound } from './game-list.ts';
import { theElementWithTheId } from '../shared/the-pages-element-with-the-id.ts';
import { theField, thisOrElse } from '../shared/a-value-of-any-kind-read-as-javascript-reads-it.ts';
import { asItsGuardReadsIt } from '../../engine/rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { AGame, AGameInTheGameMastersList } from '../../db/the-db-interface-and-its-areas.ts';

/** A game as the watcher reads it: its light columns and its realms' (its world too, on a database without the light
 *  `games.meta` column, where the list reads every column). */
type AGameAsTheWatcherReadsIt = AGameInTheGameMastersList & Partial<Pick<AGame, 'game_state'>>;
/** A game as the reload before its due turn reads it: its id, its turn and its name. */
type AGameAsTheReloadReadsIt = Pick<AGame, 'id' | 'turn' | 'name'>;
/** The signed-in account, where the code reads it unguarded: for none, the TypeError reading its address threw. */
function theSignedInAccount(): NonNullable<typeof currentUser> {
  if (currentUser === null) throw new TypeError("Cannot read properties of null (reading 'email')");
  return currentUser;
}

// ── AUTO-TURN WATCHER ────
// Polls this GM's active games once a minute and runs any whose mode condition is met. Two guards
// against a double run: a same-browser localStorage lease (two tabs of the same browser) and the
// conditional save in runTurn (`.eq('turn',expected)`), which also covers two different devices.
export const AUTO_WATCH_MS = 60000;
// Declared globals (plan P1-09b): one binding the page's files and its tests share (ui/gm/globals.ts says why).
globalThis._autoWatcherTimer = null;
globalThis._autoRunBusy = false;
// ── CRASH COOLDOWN (2026-09-27) ────
// A turn that throws is very likely to throw again on identical input, and the watcher ticks once a
// minute: without this, one broken build turns into a failed turn every 60 seconds per game, for as
// long as the tab is open. After a failed run a game is left alone for AUTO_FAIL_COOLDOWN_MS, and
// the watcher says so on the banner. Any successful run clears the mark, and so does a reload.
export const AUTO_FAIL_COOLDOWN_MS = 15 * 60000;
export const _autoFailUntil = new Map<string, number>(); // gameId -> timestamp to resume trying
export const _tabId = kcRng().toString(36).slice(2);
export function _autoLease(gameId: string, take: boolean) {
  try {
    const key = 'kc_autorun_' + gameId;
    if (!take) {
      localStorage.removeItem(key);
      return true;
    }
    const cur: unknown = JSON.parse((localStorage.getItem(key) ?? '') || 'null');
    if (cur && theField(cur, 'tab') !== _tabId && Date.now() - Number(theField(cur, 'at')) < 20 * 60000) return false; // another tab holds a fresh lease
    localStorage.setItem(key, JSON.stringify({ tab: _tabId, at: Date.now() }));
    return true;
  } catch {
    return true;
  } // no localStorage — fall back to the conditional save alone
}
// Returns true when the tab is reloading (the caller must stop and let the reload happen).
export async function refreshIfNewerBuild(g: AGameAsTheReloadReadsIt) {
  const key = g.id + ':' + String(g.turn);
  try {
    if (sessionStorage.getItem('kc_autorefresh') === key) return false;
  } catch {
    return false;
  }
  const newer = await checkForANewerVersion();
  if (!newer) return false;
  try {
    sessionStorage.setItem('kc_autorefresh', key);
  } catch {
    return false;
  }
  setAutoTurnStatus(
    kcHtml`<strong>⚙️ Auto-turn watcher</strong> · a newer build of the GM portal is ready (build ${newer.commit.slice(0, 7)}) — reloading this tab before running ${g.name || 'the game'} Turn ${g.turn}…`,
  );
  setTimeout(() => {
    location.reload();
  }, 400);
  return true;
}
export function startAutoTurnWatcher() {
  if (_autoWatcherTimer) return;
  _autoWatcherTimer = setInterval(() => {
    void autoTurnTick();
  }, AUTO_WATCH_MS);
  setTimeout(() => {
    void autoTurnTick();
  }, 3000);
}
export async function autoTurnTick() {
  if (!currentUser || _autoRunBusy) return;
  _autoRunBusy = true;
  try {
    // Disk-IO (2026-09-25): light columns only — this runs once a minute for as long as the tab is
    // open. runTurn loads the full world itself when a turn is actually due.
    const { data: theGamesRead, error } = _kcHasMeta
      ? await thePagesDb.theGameMastersGames.theActiveGamesThisGameMasterRuns(currentUser.id)
      : await thePagesDb.theGameMastersGames.theActiveGamesThisGameMasterRunsEveryColumn(currentUser.id);
    if (error || !theGamesRead) return;
    const data: readonly AGameAsTheWatcherReadsIt[] = theGamesRead;
    // An ARCHIVED game is put away, so the watcher leaves it alone (2026-09-27 item 1).
    const watched = data
      .filter((g) => !gameArchived(g))
      .map((g) => ({ g, tm: turnModeOf(g) }))
      .filter((x) => x.tm.mode !== 'manual');
    if (!watched.length) {
      setAutoTurnStatus('');
      return;
    }
    const lines = [];
    for (const { g, tm } of watched) {
      const rows = asItsGuardReadsIt(g.game_players) ?? [];
      const r = autoTurnReady(g, rows, tm);
      if (!r.ready) {
        lines.push(
          `${g.name}: Turn ${String(g.turn)} — ${r.reason}${tm.mode === 'deadline' ? ` · deadline ${fmtDeadline(tm.nextDeadlineAt)}` : ''}`,
        );
        continue;
      }
      const pausedUntil = _autoFailUntil.get(g.id);
      if (pausedUntil !== undefined && pausedUntil > Date.now()) {
        lines.push(
          `${g.name}: Turn ${String(g.turn)} — paused after a failed run, retrying ${fmtDeadline(new Date(pausedUntil).toISOString())}`,
        );
        continue;
      }
      if (await refreshIfNewerBuild(g)) return; // a newer build is uploaded — reload first, the turn runs on it after the reload
      if (!_autoLease(g.id, true)) {
        lines.push(`${g.name}: another GM tab is running Turn ${String(g.turn)}`);
        continue;
      }
      lines.push(`${g.name}: ⏳ running Turn ${String(g.turn)} (${r.reason})…`);
      setAutoTurnStatus(
        kcHtml`<strong>⚙️ Auto-turn watcher</strong> · checked ${new Date().toLocaleTimeString()}${lines.map((l) => kcHtml`<br>${l}`)}`,
      );
      try {
        if (currentGame?.id === g.id) {
          currentGame.turn = g.turn;
          if (g.game_state !== undefined) currentGame.game_state = g.game_state;
          if (asItsGuardReadsIt(g.meta) !== undefined) currentGame.meta = g.meta;
        }
        const _res = await runTurn({ auto: true, game: g, reason: r.reason });
        // runTurn reports its own failures rather than throwing; a failed run puts this game on the
        // crash cooldown so a broken build cannot grind a turn every minute.
        if (asItsGuardReadsIt(_res) && !_res.ok) {
          _autoFailUntil.set(g.id, Date.now() + AUTO_FAIL_COOLDOWN_MS);
          lines[lines.length - 1] =
            `${g.name}: ⚠ Turn ${String(g.turn)} failed (${String(thisOrElse(_res.error, 'see console'))}) — paused for ${String(Math.round(AUTO_FAIL_COOLDOWN_MS / 60000))} min`;
        } else _autoFailUntil.delete(g.id);
      } catch (e) {
        console.error('auto-turn error', e);
        _autoFailUntil.set(g.id, Date.now() + AUTO_FAIL_COOLDOWN_MS);
        lines[lines.length - 1] =
          `${g.name}: ⚠ ${String(theField(e, 'message'))} — paused for ${String(Math.round(AUTO_FAIL_COOLDOWN_MS / 60000))} min`;
      } finally {
        _autoLease(g.id, false);
      }
      // One turn per tick: the next tick re-reads fresh rows (and the next game).
      break;
    }
    setAutoTurnStatus(
      kcHtml`<strong>⚙️ Auto-turn watcher</strong> · checked ${new Date().toLocaleTimeString()} · keep this tab open${lines.map((l) => kcHtml`<br>${l}`)}`,
    );
  } catch (e) {
    console.error('autoTurnTick', e);
  } finally {
    _autoRunBusy = false;
  }
}

// ── INIT ────
export async function init() {
  theElementWithTheId('spinner', HTMLElement).style.display = 'none';
  const {
    data: { session },
  } = await thePagesDb.signingIn.theSessionKeptInThisBrowser();
  if (session) {
    currentUser = session.user;
    void onSignedIn();
  } else show('sec-auth');
}

// ── AUTH ────
export async function doSignIn() {
  const email = theElementWithTheId('si-email', HTMLInputElement).value.trim();
  const pwd = theElementWithTheId('si-password', HTMLInputElement).value;
  const msg = document.getElementById('auth-msg');
  if (!email || !pwd) {
    theElementFound(msg).innerHTML = '<div class="msg-error">Please enter your email and password.</div>';
    return;
  }
  theElementFound(msg).innerHTML = '<div class="msg-info">Signing in…</div>';
  const { data, error } = await thePagesDb.signingIn.signInWithEmailAndPassword(email, pwd);
  if (error) {
    let m = error.message;
    if (m.includes('Email not confirmed'))
      m =
        'Email not confirmed. In Supabase → Authentication → Providers → Email, turn off "Confirm email", then try again. Or confirm your account in Supabase → Authentication → Users.';
    if (m.includes('Invalid login')) m = 'Email or password incorrect.';
    theElementFound(msg).innerHTML = String(kcHtml`<div class="msg-error">${m}</div>`);
    return;
  }
  currentUser = data.user;
  void onSignedIn();
}

export async function onSignedIn() {
  theElementWithTheId('gm-email-display', HTMLElement).textContent = theSignedInAccount().email ?? null;
  if (!(await gmPortalAllowed())) return; // P0-32c: Game Masters and the Overlord only; nothing else loads
  // Master GM mode (P0-32g, R-097): the Overlord sees every game and runs any of them by hand, but creates none.
  theElementWithTheId('gm-role-label', HTMLElement).textContent = _kcOverlord ? 'Overlord · Master GM' : 'Game Master';
  theElementWithTheId('new-game-btn', HTMLElement).style.display = _kcOverlord ? 'none' : '';
  theElementWithTheId('overlord-filter-wrap', HTMLElement).style.display = _kcOverlord ? 'block' : 'none';
  show('sec-games');
  await probeGameMeta(); // Disk-IO fix (2026-09-25): is the light `games.meta` column there?
  void probeTelemetry().then((ok) => {
    if (ok) void backfillGameResults();
  }); // telemetry tables (2026-09-25) — never blocks sign-in
  void probeLeaderboard(); // Hall-of-Fame table (2026-09-27); records are built on game-over or by button, never at sign-in
  void probeMessaging(); // player-messaging tables (2026-09-27); the GM portal only reports whether they exist
  await loadGames();
  // Automatic turn modes only fire while a signed-in GM tab is open. Never for the Overlord (P0-32g): one tab
  // resolving every game would be heavy and a single point of failure. Each game's own GM tab runs its turns.
  if (!_kcOverlord) startAutoTurnWatcher();
  // The sign-in backfills read only the signed-in account's own games, so they do nothing for the Overlord.
  void backfillGameMeta(); // one-off: stamp meta on any game that predates the column (no-op after)
  // The Overlord page links each game here as ?game=<id> (P0-32f): open it straight away.
  const _openId = _kcOverlord && new URLSearchParams(location.search).get('game');
  if (_openId) void openGame(_openId);
}
