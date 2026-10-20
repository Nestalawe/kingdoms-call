import { kcArg, kcHtml } from '../shared/kc-safe.ts';
import { sb } from './config.ts';
import { loadGames } from './game-list.ts';
import { openGame } from './game-detail.ts';
import { backfillGameMeta, probeGameMeta, probeMessaging, probeTelemetry } from '../../db/game-meta.ts';
import { backfillGameResults } from '../../db/telemetry.ts';
import { probeLeaderboard } from './hall-of-fame.ts';
import { startAutoTurnWatcher } from './auto-turn.ts';

// ── INIT ────
export async function init() {
  document.getElementById('spinner').style.display = 'none';
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (session) {
    currentUser = session.user;
    onSignedIn();
  } else show('sec-auth');
}

export function show(id) {
  document.querySelectorAll('section').forEach((s) => s.classList.remove('section-active'));
  document.getElementById(id)?.classList.add('section-active');
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
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pwd });
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

export async function doSignOut() {
  await sb.auth.signOut();
  currentUser = null;
  _kcOverlord = false;
  show('sec-auth');
}

// ── Change Password (Supabase updateUser — requires the active signed-in session) ──
export function changePassword() {
  if (document.getElementById('cp-overlay')) return;
  const ov = document.createElement('div');
  ov.id = 'cp-overlay';
  ov.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:99999';
  ov.innerHTML = `
    <div style="background:#f5ecd8;color:#1a1208;border:2px solid #c8922a;border-radius:6px;padding:20px;max-width:360px;width:90%">
      <div style="font-family:'Cinzel',serif;font-size:1rem;margin-bottom:12px;color:#7a1c1c">🔑 Change Password</div>
      <label style="font-size:.75rem;display:block;margin-bottom:2px">New password</label>
      <input type="password" id="cp-new" placeholder="At least 6 characters" style="width:100%;padding:7px;margin-bottom:8px;border:1px solid #c8922a;border-radius:3px;box-sizing:border-box" onkeydown="if(event.key==='Enter')document.getElementById('cp-new2').focus()">
      <label style="font-size:.75rem;display:block;margin-bottom:2px">Confirm new password</label>
      <input type="password" id="cp-new2" placeholder="Repeat password" style="width:100%;padding:7px;margin-bottom:8px;border:1px solid #c8922a;border-radius:3px;box-sizing:border-box" onkeydown="if(event.key==='Enter')submitChangePassword()">
      <div id="cp-msg" style="font-size:.78rem;margin-bottom:10px;min-height:16px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button onclick="closeChangePassword()" style="padding:7px 14px;border:1px solid #999;background:#eee;border-radius:3px;cursor:pointer">Cancel</button>
        <button onclick="submitChangePassword()" style="padding:7px 14px;border:none;background:#7a1c1c;color:#fff;border-radius:3px;cursor:pointer">Update Password</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  document.getElementById('cp-new').focus();
}
export function closeChangePassword() {
  const o = document.getElementById('cp-overlay');
  if (o) o.remove();
}
export async function submitChangePassword() {
  const p1 = document.getElementById('cp-new').value;
  const p2 = document.getElementById('cp-new2').value;
  const msg = document.getElementById('cp-msg');
  if (!p1 || p1.length < 6) {
    msg.innerHTML = '<span style="color:#c00">Password must be at least 6 characters.</span>';
    return;
  }
  if (p1 !== p2) {
    msg.innerHTML = '<span style="color:#c00">Passwords do not match.</span>';
    return;
  }
  msg.innerHTML = '<span style="color:#231e16">Updating…</span>';
  try {
    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) {
      msg.innerHTML = kcHtml`<span style="color:#c00">${error.message}</span>`;
      return;
    }
    msg.innerHTML = '<span style="color:#1d5a1d">✓ Password updated.</span>';
    setTimeout(closeChangePassword, 1200);
  } catch (e) {
    msg.innerHTML = kcHtml`<span style="color:#c00">${e.message || 'Update failed.'}</span>`;
  }
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

// P0-32c: the GM portal is for Game Masters (an accepted offer, P0-32b) and the Overlord. Anyone else, or a
// check that fails, gets the "not a Game Master" page and nothing else: no game list, no watcher, no probes.
// Master GM mode (P0-32g): true while the Overlord is signed in. The database lets the Overlord do every GM action on
// any game (P0-32e); this switches the list to every game, hides New Game and keeps the watcher off.
export let _kcOverlord = false;
export async function gmPortalAllowed() {
  const [gm, ov] = await Promise.all([sb.rpc('is_game_master'), sb.rpc('is_site_admin')]);
  const err = gm.error || ov.error;
  _kcOverlord = !err && ov.data === true;
  if (!err && (gm.data === true || ov.data === true)) return true;
  const msg = document.getElementById('not-gm-msg');
  msg.className = err ? 'msg-error' : 'msg-info';
  msg.textContent = err
    ? `Couldn't check whether you're a Game Master (${err.message}). Reload to try again.`
    : "You're not a Game Master. Game Masters are chosen by the Overlord.";
  // a Game Master who signed out in this tab may have left the watcher running
  if (_autoWatcherTimer) {
    clearInterval(_autoWatcherTimer);
    _autoWatcherTimer = null;
  }
  show('sec-not-gm');
  return false;
}

// ── REPORTED DISPATCHES (P0-24, rulings D-01 and D-13g) ────
// A player reports a dispatch they received; the game's GM sees it here (gm_reported_messages), with the reporter
// and their reason, and may delete it. A GM who plays a realm in the game sees none: its reports go to the Overlord.
// Every player-written string is shown as text (kcHtml).
export async function loadReportedDispatches(game) {
  const card = document.getElementById('detail-reports-card'),
    el = document.getElementById('detail-reports');
  if (!card || !el) return;
  card.style.display = 'none';
  if (!game || !_kcHasMsg) return;
  card.style.display = 'block';
  if (
    (game.game_players || currentGamePlayers || []).some(
      (p) => p.user_id && currentUser && p.user_id === currentUser.id,
    )
  ) {
    el.innerHTML =
      '<div class="msg-info">You play a realm in this game, so its reported dispatches go to the Overlord, not to you.</div>';
    return;
  }
  el.innerHTML = '<div class="msg-info">Loading…</div>';
  const { data, error } = await sb.rpc('gm_reported_messages', { p_game: game.id });
  if (!currentGame || String(currentGame.id) !== String(game.id)) return; // another game was opened meanwhile
  if (error) {
    el.innerHTML = kcHtml`<div class="msg-error">${error.message}</div>`;
    return;
  }
  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) {
    el.innerHTML = '<div style="color:var(--stone);font-size:.85rem">No dispatches reported.</div>';
    return;
  }
  const realm = (i) => {
    const p = (currentGamePlayers || []).find((x) => Number(x.player_index) === Number(i));
    return (p && p.display_name) || 'Realm ' + (Number(i) + 1);
  };
  el.innerHTML = kcHtml`${rows.map((r) => {
    const to = r.scope === 'public' ? 'every realm' : (r.to_indexes || []).map(realm).join(', ');
    return kcHtml`<div class="player-slot" style="display:block">
      <div style="font-size:.78rem;color:var(--stone)">${r.turn != null ? 'Turn ' + r.turn + ' · ' : ''}from <strong>${realm(r.from_index)}</strong> to ${to} · reported by <strong>${realm(r.reporter_index)}</strong>${r.reason ? ' · “' + r.reason + '”' : ''}</div>
      <div style="margin:6px 0;white-space:pre-wrap">${r.body}</div>
      <button class="btn btn-crimson" style="font-size:.66rem" onclick="deleteReportedDispatch(${kcArg(Number(r.message_id) || 0)})">Delete this dispatch</button>
    </div>`;
  })}`;
}
export async function deleteReportedDispatch(id) {
  if (!confirm('Delete this dispatch for everyone in the game? Its reports go with it.')) return;
  const { error } = await sb.from('game_messages').delete().eq('id', id);
  if (error) {
    alert(error.message);
    return;
  }
  await loadReportedDispatches(currentGame);
}
