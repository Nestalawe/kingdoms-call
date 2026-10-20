import { kcHtml } from '../shared/kc-safe.js';
import { sb } from './startup.js';
import { show } from './init.js';
import { loadMyGames, loadOpenGames, startUpdatePolling } from './game-lists.js';
import { openReport } from './report.js';
import { saveMessageReads, stopMessagePolling } from './dispatches.js';

// ── AUTH ────
export function setAuthTab(tab) {
  document.getElementById('tab-signin').classList.toggle('active', tab === 'signin');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('auth-signin').style.display = tab === 'signin' ? 'block' : 'none';
  document.getElementById('auth-signup').style.display = tab === 'signup' ? 'block' : 'none';
  document.getElementById('auth-msg').innerHTML = '';
}

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
      m = 'Account not confirmed yet. Ask your GM, or check your email for a confirmation link.';
    if (m.includes('Invalid login')) m = 'Email or password incorrect. Check your details and try again.';
    msg.innerHTML = kcHtml`<div class="msg-error">${m}</div>`;
    return;
  }
  currentUser = data.user;
  await onSignedIn();
}

export async function doSignUp() {
  const name = document.getElementById('su-name').value.trim();
  const email = document.getElementById('su-email').value.trim();
  const pwd = document.getElementById('su-password').value;
  const pwd2 = document.getElementById('su-password2').value;
  const msg = document.getElementById('auth-msg');
  if (!name || !email || !pwd) {
    msg.innerHTML = '<div class="msg-error">Please fill in all fields.</div>';
    return;
  }
  if (pwd !== pwd2) {
    msg.innerHTML = '<div class="msg-error">Passwords do not match.</div>';
    return;
  }
  if (pwd.length < 6) {
    msg.innerHTML = '<div class="msg-error">Password must be at least 6 characters.</div>';
    return;
  }
  msg.innerHTML = '<div class="msg-info">Creating account…</div>';
  const { data, error } = await sb.auth.signUp({ email, password: pwd, options: { data: { display_name: name } } });
  if (error) {
    msg.innerHTML = kcHtml`<div class="msg-error">${error.message}</div>`;
    return;
  }
  if (data.user && !data.session) {
    msg.innerHTML =
      '<div class="msg-success">Account created! Check your email for a confirmation link, then sign in.</div>';
    setTimeout(() => setAuthTab('signin'), 3000);
  } else if (data.user) {
    currentUser = data.user;
    await onSignedIn();
  }
}

export async function doSignOut() {
  try {
    stopMessagePolling();
    await saveMessageReads();
  } catch (e) {} // flush read marks before the session goes
  await sb.auth.signOut();
  currentUser = null;
  currentProfile = null;
  currentGamePlayer = null;
  currentReport = null;
  location.reload(); // full reset so no stale state carries over when another player signs in on the same browser
}

// ── Change Display Name (2026-09-27b) ──────────────────────────────────────────────────────────
// The name a PERSON is known by, in `profiles.name`. It is NOT the realm name: the realm is chosen
// per game on the join form and written to game_players.display_name, and the same player rules a
// differently-named realm in every game. The Hall of Fame keys every player statistic on the auth
// account and prints whatever this name is at the time it is read, so changing it here renames the
// player on every game they have ever played rather than splitting their record in two.
export function changeDisplayName() {
  if (document.getElementById('dn-overlay')) return;
  const cur = (currentProfile && currentProfile.name) || currentUser?.user_metadata?.display_name || '';
  const ov = document.createElement('div');
  ov.id = 'dn-overlay';
  ov.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:99999';
  ov.innerHTML = kcHtml`
    <div style="background:#f5ecd8;color:#1a1208;border:2px solid #c8922a;border-radius:6px;padding:20px;max-width:380px;width:90%">
      <div style="font-family:'Cinzel',serif;font-size:1rem;margin-bottom:6px;color:#7a1c1c">✏ Change Display Name</div>
      <div style="font-size:.8rem;margin-bottom:12px;color:#4a3a22">This is <strong>you</strong>, not your realm. Your realm is named afresh in every game you join; this name follows you across all of them and is what the Hall of Fame records your wins under. Changing it updates your name on every game you have played.</div>
      <label style="font-size:.75rem;display:block;margin-bottom:2px">Display name</label>
      <input type="text" id="dn-name" maxlength="40" value="${cur}" placeholder="How other players will see you" style="width:100%;padding:7px;margin-bottom:8px;border:1px solid #c8922a;border-radius:3px;box-sizing:border-box" onkeydown="if(event.key==='Enter')submitDisplayName()">
      <div id="dn-msg" style="font-size:.78rem;margin-bottom:10px;min-height:16px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button onclick="closeDisplayName()" style="padding:7px 14px;border:1px solid #999;background:#eee;border-radius:3px;cursor:pointer">Cancel</button>
        <button onclick="submitDisplayName()" style="padding:7px 14px;border:none;background:#7a1c1c;color:#fff;border-radius:3px;cursor:pointer">Save Name</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const f = document.getElementById('dn-name');
  f.focus();
  f.select();
}
export function closeDisplayName() {
  const o = document.getElementById('dn-overlay');
  if (o) o.remove();
}
export async function submitDisplayName() {
  const msg = document.getElementById('dn-msg');
  const name = (document.getElementById('dn-name').value || '').trim();
  if (name.length < 2) {
    msg.innerHTML = '<span style="color:#c00">Please give a name of at least two characters.</span>';
    return;
  }
  msg.innerHTML = '<span style="color:#231e16">Saving…</span>';
  try {
    // upsert, not update: an account created before the profiles trigger existed has no row yet
    const { error } = await sb.from('profiles').upsert({ id: currentUser.id, name }, { onConflict: 'id' });
    if (error) {
      msg.innerHTML = kcHtml`<span style="color:#c00">${error.message}</span>`;
      return;
    }
    try {
      await sb.auth.updateUser({ data: { display_name: name } });
    } catch (e) {} // keep the auth copy in step; not fatal
    currentProfile = Object.assign({}, currentProfile || {}, { id: currentUser.id, name });
    const el = document.getElementById('player-name-display');
    if (el) el.textContent = name;
    msg.innerHTML = '<span style="color:#1d5a1d">✓ Saved — this is your name on every game you have played.</span>';
    setTimeout(closeDisplayName, 1400);
  } catch (e) {
    msg.innerHTML = kcHtml`<span style="color:#c00">${e.message || 'Could not save the name.'}</span>`;
  }
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
  // Load profile
  const { data: profile } = await sb.from('profiles').select('id,name').eq('id', currentUser.id).single(); // never email (P0-31)
  currentProfile = profile;
  const displayName = profile?.name || currentUser.user_metadata?.display_name || currentUser.email.split('@')[0];
  document.getElementById('player-name-display').textContent = displayName;
  // a game opened from My Games reloads the page with "#game=<slot>" in the address, so this fresh
  // load lands straight in that game's report (and a browser refresh while reading a report comes
  // back to the same report, not to My Games). The games list still loads, in the background, so
  // polling and the "← My Games" list are ready when needed.
  const _gm = (location.hash || '').match(/^#game=([A-Za-z0-9_-]+)$/);
  if (_gm) {
    show('sec-report');
    loadAllGames()
      .then(() => startUpdatePolling())
      .catch(() => {});
    await openReport(_gm[1]);
    return;
  }
  show('sec-games');
  await loadAllGames();
  startUpdatePolling(); // keep the games list live and flag newly-resolved turns
}
// open a game with a FULL browser reload. The reload picks up the latest portal build and a clean
// state; the hash tells onSignedIn which report to open. Nothing unsaved can be lost here — this is
// only reachable from the My Games list, never from inside an orders form.
export function openGameFresh(gamePlayerId) {
  try {
    history.replaceState(null, '', location.pathname + location.search + '#game=' + encodeURIComponent(gamePlayerId));
  } catch (e) {}
  location.reload();
}

// ── OTHER REALMS' SLOTS (P0-20) ────
// The portal sees other realms only through get_game_slots: each slot's game_id, player_index, is_bot,
// orders_submitted, and alignment while the game is in setup. It never reads another realm's game_players row
// (the database answers those only for their own player and the game's GM: Unit B). Games the account may not
// see are left out.
export async function fetchGameSlots(gameIds) {
  const ids = [...new Set((gameIds || []).filter(Boolean))];
  if (!ids.length) return { data: [], error: null };
  const { data, error } = await sb.rpc('get_game_slots', { p_games: ids });
  return { data: Array.isArray(data) ? data : [], error };
}

// ── GAME LISTS ────
export async function loadAllGames() {
  await Promise.all([loadMyGames(), loadOpenGames(), loadGmOffer()]);
}

// ── GAME MASTER OFFER (P0-32c) ────
// The Overlord offers an account Game Master (P0-32b): its own game_masters row, open while accepted_at is
// null. Accept and No thanks are database functions acting on the signed-in account's own offer. The banner
// is an extra: if the read fails, it just stays hidden.
export async function loadGmOffer() {
  const el = document.getElementById('gm-offer-banner');
  const { data, error } = await sb
    .from('game_masters')
    .select('accepted_at')
    .eq('user_id', currentUser.id)
    .maybeSingle();
  const open = !error && data && !data.accepted_at;
  if (open) {
    document.getElementById('gm-offer-ask').style.display = 'block';
    document.getElementById('gm-offer-done').style.display = 'none';
  }
  el.style.display = open ? 'block' : 'none';
}
export async function answerGmOffer(fn) {
  const ask = document.getElementById('gm-offer-ask'),
    msg = document.getElementById('gm-offer-msg');
  ask.querySelectorAll('button').forEach((b) => {
    b.disabled = true;
  });
  msg.innerHTML = '';
  const { error } = await sb.rpc(fn);
  ask.querySelectorAll('button').forEach((b) => {
    b.disabled = false;
  });
  if (error) {
    msg.className = 'msg-error';
    msg.textContent = error.message;
    return false;
  }
  return true;
}
export async function acceptGmOffer() {
  if (!(await answerGmOffer('gm_accept_offer'))) return;
  document.getElementById('gm-offer-ask').style.display = 'none';
  document.getElementById('gm-offer-done').style.display = 'block';
}
export async function declineGmOffer() {
  if (!confirm('Turn down the offer to become a Game Master? The Overlord would have to offer again.')) return;
  if (await answerGmOffer('gm_decline_offer')) document.getElementById('gm-offer-banner').style.display = 'none';
}
