// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcHtml } from '../shared/kc-safe.ts';
import { kcRng } from '../../engine/rng.ts';
import { sb, thePagesDb } from './config.ts';
import { gameArchived, gamesListCols, probeGameMeta, probeMessaging, probeTelemetry } from './startup.ts';
import { autoTurnReady, fmtDeadline, turnModeOf } from './turn-mode.ts';
import { runTurn } from './turn-shell.ts';
import { checkForANewerVersion } from '../shared/a-newer-version-of-this-page.ts';
import { _kcOverlord, gmPortalAllowed, setAutoTurnStatus, show } from './sign-in.ts';
import { backfillGameResults, probeLeaderboard } from './hall-of-fame.ts';
import { backfillGameMeta, loadGames } from './game-list.ts';
import { openGame } from './game-detail.ts';

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
export const _autoFailUntil = new Map(); // gameId -> timestamp to resume trying
export const _tabId = kcRng().toString(36).slice(2);
export function _autoLease(gameId, take) {
  try {
    const key = 'kc_autorun_' + gameId;
    if (!take) {
      localStorage.removeItem(key);
      return true;
    }
    const cur = JSON.parse(localStorage.getItem(key) || 'null');
    if (cur && cur.tab !== _tabId && Date.now() - cur.at < 20 * 60000) return false; // another tab holds a fresh lease
    localStorage.setItem(key, JSON.stringify({ tab: _tabId, at: Date.now() }));
    return true;
  } catch (e) {
    return true;
  } // no localStorage — fall back to the conditional save alone
}
// Returns true when the tab is reloading (the caller must stop and let the reload happen).
export async function refreshIfNewerBuild(g) {
  const key = g.id + ':' + g.turn;
  try {
    if (sessionStorage.getItem('kc_autorefresh') === key) return false;
  } catch (e) {
    return false;
  }
  const newer = await checkForANewerVersion();
  if (!newer) return false;
  try {
    sessionStorage.setItem('kc_autorefresh', key);
  } catch (e) {
    return false;
  }
  setAutoTurnStatus(
    kcHtml`<strong>⚙️ Auto-turn watcher</strong> · a newer build of the GM portal is ready (build ${newer.commit.slice(0, 7)}) — reloading this tab before running ${g.name || 'the game'} Turn ${g.turn}…`,
  );
  setTimeout(() => location.reload(), 400);
  return true;
}
export function startAutoTurnWatcher() {
  if (_autoWatcherTimer) return;
  _autoWatcherTimer = setInterval(autoTurnTick, AUTO_WATCH_MS);
  setTimeout(autoTurnTick, 3000);
}
export async function autoTurnTick() {
  if (!currentUser || _autoRunBusy) return;
  _autoRunBusy = true;
  try {
    // Disk-IO (2026-09-25): light columns only — this runs once a minute for as long as the tab is
    // open. runTurn loads the full world itself when a turn is actually due.
    const { data, error } = await sb
      .from('games')
      .select(gamesListCols())
      .eq('gm_user_id', currentUser.id)
      .eq('status', 'active');
    if (error || !data) return;
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
      const rows = g.game_players || [];
      const r = autoTurnReady(g, rows, tm);
      if (!r.ready) {
        lines.push(
          `${g.name}: Turn ${g.turn} — ${r.reason}${tm.mode === 'deadline' ? ` · deadline ${fmtDeadline(tm.nextDeadlineAt)}` : ''}`,
        );
        continue;
      }
      if (_autoFailUntil.get(g.id) > Date.now()) {
        lines.push(
          `${g.name}: Turn ${g.turn} — paused after a failed run, retrying ${fmtDeadline(new Date(_autoFailUntil.get(g.id)).toISOString())}`,
        );
        continue;
      }
      if (await refreshIfNewerBuild(g)) return; // a newer build is uploaded — reload first, the turn runs on it after the reload
      if (!_autoLease(g.id, true)) {
        lines.push(`${g.name}: another GM tab is running Turn ${g.turn}`);
        continue;
      }
      lines.push(`${g.name}: ⏳ running Turn ${g.turn} (${r.reason})…`);
      setAutoTurnStatus(
        kcHtml`<strong>⚙️ Auto-turn watcher</strong> · checked ${new Date().toLocaleTimeString()}${lines.map((l) => kcHtml`<br>${l}`)}`,
      );
      try {
        if (currentGame && currentGame.id === g.id) {
          currentGame.turn = g.turn;
          if (g.game_state !== undefined) currentGame.game_state = g.game_state;
          if (g.meta !== undefined) currentGame.meta = g.meta;
        }
        const _res = await runTurn({ auto: true, game: g, reason: r.reason });
        // runTurn reports its own failures rather than throwing; a failed run puts this game on the
        // crash cooldown so a broken build cannot grind a turn every minute.
        if (_res && _res.ok === false) {
          _autoFailUntil.set(g.id, Date.now() + AUTO_FAIL_COOLDOWN_MS);
          lines[lines.length - 1] =
            `${g.name}: ⚠ Turn ${g.turn} failed (${_res.error || 'see console'}) — paused for ${Math.round(AUTO_FAIL_COOLDOWN_MS / 60000)} min`;
        } else _autoFailUntil.delete(g.id);
      } catch (e) {
        console.error('auto-turn error', e);
        _autoFailUntil.set(g.id, Date.now() + AUTO_FAIL_COOLDOWN_MS);
        lines[lines.length - 1] =
          `${g.name}: ⚠ ${e.message} — paused for ${Math.round(AUTO_FAIL_COOLDOWN_MS / 60000)} min`;
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
  document.getElementById('spinner').style.display = 'none';
  const {
    data: { session },
  } = await thePagesDb.signingIn.theSessionKeptInThisBrowser();
  if (session) {
    currentUser = session.user;
    onSignedIn();
  } else show('sec-auth');
}

// ── AUTH ────
export async function doSignIn() {
  const email = document.getElementById('si-email').value.trim();
  const pwd = document.getElementById('si-password').value;
  const msg = document.getElementById('auth-msg');
  if (!email || !pwd) {
    msg.innerHTML = '<div class="msg-error">Please enter your email and password.</div>';
    return;
  }
  msg.innerHTML = '<div class="msg-info">Signing in…</div>';
  const { data, error } = await thePagesDb.signingIn.signInWithEmailAndPassword(email, pwd);
  if (error) {
    let m = error.message;
    if (m.includes('Email not confirmed'))
      m =
        'Email not confirmed. In Supabase → Authentication → Providers → Email, turn off "Confirm email", then try again. Or confirm your account in Supabase → Authentication → Users.';
    if (m.includes('Invalid login')) m = 'Email or password incorrect.';
    msg.innerHTML = kcHtml`<div class="msg-error">${m}</div>`;
    return;
  }
  currentUser = data.user;
  onSignedIn();
}

export async function onSignedIn() {
  document.getElementById('gm-email-display').textContent = currentUser.email;
  if (!(await gmPortalAllowed())) return; // P0-32c: Game Masters and the Overlord only; nothing else loads
  // Master GM mode (P0-32g, R-097): the Overlord sees every game and runs any of them by hand, but creates none.
  document.getElementById('gm-role-label').textContent = _kcOverlord ? 'Overlord · Master GM' : 'Game Master';
  document.getElementById('new-game-btn').style.display = _kcOverlord ? 'none' : '';
  document.getElementById('overlord-filter-wrap').style.display = _kcOverlord ? 'block' : 'none';
  show('sec-games');
  await probeGameMeta(); // Disk-IO fix (2026-09-25): is the light `games.meta` column there?
  probeTelemetry().then((ok) => {
    if (ok) backfillGameResults();
  }); // telemetry tables (2026-09-25) — never blocks sign-in
  probeLeaderboard(); // Hall-of-Fame table (2026-09-27); records are built on game-over or by button, never at sign-in
  probeMessaging(); // player-messaging tables (2026-09-27); the GM portal only reports whether they exist
  await loadGames();
  // Automatic turn modes only fire while a signed-in GM tab is open. Never for the Overlord (P0-32g): one tab
  // resolving every game would be heavy and a single point of failure. Each game's own GM tab runs its turns.
  if (!_kcOverlord) startAutoTurnWatcher();
  // The sign-in backfills read only the signed-in account's own games, so they do nothing for the Overlord.
  backfillGameMeta(); // one-off: stamp meta on any game that predates the column (no-op after)
  // The Overlord page links each game here as ?game=<id> (P0-32f): open it straight away.
  const _openId = _kcOverlord && new URLSearchParams(location.search).get('game');
  if (_openId) openGame(_openId);
}
