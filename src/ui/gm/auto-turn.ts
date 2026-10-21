// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcHtml } from '../shared/kc-safe.ts';
import { kcRng } from '../../engine/rng.ts';
import { sb } from './config.ts';
import { gameArchived, gamesListCols } from '../../db/game-meta.ts';
import { autoTurnReady, fmtDeadline, turnModeOf } from './turn-mode.ts';
import { runTurn } from './turn-shell.ts';
import { checkForANewerVersion, thisPagesBuild } from '../shared/a-newer-version-of-this-page.ts';

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
export function setAutoTurnStatus(html) {
  const el = document.getElementById('auto-turn-status');
  if (!el) return;
  el.style.display = html ? 'block' : 'none';
  el.innerHTML = html || '';
}
// ── AUTO-REFRESH TO THE NEWEST UPLOADED BUILD ────
// A GM tab left open for days keeps running the engine it loaded, however many newer builds have
// been uploaded since. So the moment an automatic turn is DUE — and BEFORE it is resolved, so the
// new engine is the one that resolves it — the watcher asks whether a newer GM page is ready
// (ui/shared/a-newer-version-of-this-page.ts, plan P1-06): version.json, read afresh, names another
// fingerprint for this page, first seen at least 10 minutes ago (GitHub's cache can hand out the old
// page for 10 minutes after a deploy). If so it reloads the tab. After the reload the GM is still
// signed in (Supabase keeps the session), onSignedIn restarts the watcher, and its first tick runs
// the turn on the new build. No newer page → no reload, the turn simply runs.
// LOOP GUARD: sessionStorage remembers "already reloaded for <game>:<turn>", so whatever a server
// or CDN does with caching, one due turn can cause at most ONE reload. No sessionStorage, a file://
// page or a failed download of version.json → never reload; the turn runs on the current build.
// Which GM build is running: the 7-character commit of the page's kc-build meta (tools/build.ts).
export function runningBuildStamp() {
  return thisPagesBuild();
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
