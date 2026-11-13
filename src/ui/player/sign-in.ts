import type { AnAnswerToTheGameMasterOffer } from '../../db/the-db-interface-and-its-areas.ts';
import { kcHtml } from '../shared/kc-safe.ts';
import { theElementWithTheId } from '../shared/the-pages-element-with-the-id.ts';
import { thePagesDb } from './startup.ts';
import { show } from './init.ts';
import { startUpdatePolling, loadAllGames, theSignedInAccountsId, thisOrElse } from './game-lists.ts';
import { openReport } from './report.ts';
import { saveMessageReads, stopMessagePolling, theRefusalAsThrown } from './dispatches.ts';

/** What was thrown's message, in words, as `'…' + err.message` wrote it: an error's message; `undefined` for a value
 *  with none; nothing thrown (`null`, `undefined`) throws the TypeError reading its message threw. */
export function theMessageOf(err: unknown): string {
  return String(theMessageReadOff(err));
}
/** What was thrown's message, as `err.message` read it: an error's message; `undefined` for a value with none; nothing
 *  thrown (`null`, `undefined`) throws the TypeError reading its message threw, in its words. */
function theMessageReadOff(err: unknown): unknown {
  if (err === null || err === undefined)
    throw new TypeError(`Cannot read properties of ${String(err)} (reading 'message')`);
  return Reflect.get(Object(err), 'message');
}
/** The signed-in account, as a read of one of its fields read it: none throws the TypeError that read threw. */
function theAccountSignedIn(field: string): NonNullable<typeof currentUser> {
  if (currentUser === null) throw new TypeError(`Cannot read properties of null (reading '${field}')`);
  return currentUser;
}
/** The name a player is shown by, as `name || <the address's first part>` gave it: the address is read only for no
 *  name. */
function theNameOrTheAddress(name: unknown): unknown {
  if (name) return name;
  return theAddressOf(theAccountSignedIn('email')).split('@')[0];
}
/** The account's address, as `.split` read it: none throws the TypeError that read threw. */
function theAddressOf(account: { readonly email?: string | undefined }): string {
  if (account.email === undefined) throw new TypeError("Cannot read properties of undefined (reading 'split')");
  return account.email;
}

// ── AUTH ────
export function setAuthTab(tab: unknown) {
  theElementWithTheId('tab-signin', HTMLElement).classList.toggle('active', tab === 'signin');
  theElementWithTheId('tab-signup', HTMLElement).classList.toggle('active', tab === 'signup');
  theElementWithTheId('auth-signin', HTMLElement).style.display = tab === 'signin' ? 'block' : 'none';
  theElementWithTheId('auth-signup', HTMLElement).style.display = tab === 'signup' ? 'block' : 'none';
  theElementWithTheId('auth-msg', HTMLElement).innerHTML = '';
}

export async function doSignIn() {
  const email = theElementWithTheId('si-email', HTMLInputElement).value.trim();
  const pwd = theElementWithTheId('si-password', HTMLInputElement).value;
  const msg = theElementWithTheId('auth-msg', HTMLElement);
  if (!email || !pwd) {
    msg.innerHTML = '<div class="msg-error">Please enter your email and password.</div>';
    return;
  }
  msg.innerHTML = '<div class="msg-info">Signing in…</div>';
  const { data, error } = await thePagesDb.signingIn.signInWithEmailAndPassword(email, pwd);
  if (error) {
    let m = error.message;
    if (m.includes('Email not confirmed'))
      m = 'Account not confirmed yet. Ask your GM, or check your email for a confirmation link.';
    if (m.includes('Invalid login')) m = 'Email or password incorrect. Check your details and try again.';
    msg.innerHTML = String(kcHtml`<div class="msg-error">${m}</div>`);
    return;
  }
  currentUser = data.user;
  await onSignedIn();
}

export async function doSignUp() {
  const name = theElementWithTheId('su-name', HTMLInputElement).value.trim();
  const email = theElementWithTheId('su-email', HTMLInputElement).value.trim();
  const pwd = theElementWithTheId('su-password', HTMLInputElement).value;
  const pwd2 = theElementWithTheId('su-password2', HTMLInputElement).value;
  const msg = theElementWithTheId('auth-msg', HTMLElement);
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
  const { data, error } = await thePagesDb.signingIn.signUpWithEmailPasswordAndName(email, pwd, name);
  if (error) {
    msg.innerHTML = String(kcHtml`<div class="msg-error">${error.message}</div>`);
    return;
  }
  if (data.user && !data.session) {
    msg.innerHTML =
      '<div class="msg-success">Account created! Check your email for a confirmation link, then sign in.</div>';
    setTimeout(() => {
      setAuthTab('signin');
    }, 3000);
  } else if (data.user) {
    currentUser = data.user;
    await onSignedIn();
  }
}

export async function doSignOut() {
  try {
    stopMessagePolling();
    await saveMessageReads();
  } catch {
    // flush read marks before the session goes
  }
  await thePagesDb.signingIn.signOut();
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
  const cur = thisOrElse((currentProfile?.name ?? '') || currentUser?.user_metadata?.['display_name'], '');
  const ov = document.createElement('div');
  ov.id = 'dn-overlay';
  ov.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:99999';
  ov.innerHTML = String(kcHtml`
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
    </div>`);
  document.body.appendChild(ov);
  const f = theElementWithTheId('dn-name', HTMLInputElement);
  f.focus();
  f.select();
}
export function closeDisplayName() {
  const o = document.getElementById('dn-overlay');
  if (o) o.remove();
}
export async function submitDisplayName() {
  const msg = theElementWithTheId('dn-msg', HTMLElement);
  const name = (theElementWithTheId('dn-name', HTMLInputElement).value || '').trim();
  if (name.length < 2) {
    msg.innerHTML = '<span style="color:#c00">Please give a name of at least two characters.</span>';
    return;
  }
  msg.innerHTML = '<span style="color:#231e16">Saving…</span>';
  try {
    // upsert, not update: an account created before the profiles trigger existed has no row yet
    const { error } = await thePagesDb.theAccountsNames.giveThisAccountItsName(theSignedInAccountsId(), name);
    if (error) {
      msg.innerHTML = String(kcHtml`<span style="color:#c00">${error.message}</span>`);
      return;
    }
    try {
      await thePagesDb.signingIn.changeTheNameKeptWithTheSignIn(name);
    } catch {
      // keep the auth copy in step; not fatal
    }
    currentProfile = Object.assign({}, currentProfile ?? {}, { id: theSignedInAccountsId(), name });
    const el = document.getElementById('player-name-display');
    if (el) el.textContent = name;
    msg.innerHTML = '<span style="color:#1d5a1d">✓ Saved — this is your name on every game you have played.</span>';
    setTimeout(closeDisplayName, 1400);
  } catch (e) {
    msg.innerHTML = String(
      kcHtml`<span style="color:#c00">${thisOrElse(theMessageReadOff(e), 'Could not save the name.')}</span>`,
    );
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
  theElementWithTheId('cp-new', HTMLElement).focus();
}
export function closeChangePassword() {
  const o = document.getElementById('cp-overlay');
  if (o) o.remove();
}
export async function submitChangePassword() {
  const p1 = theElementWithTheId('cp-new', HTMLInputElement).value;
  const p2 = theElementWithTheId('cp-new2', HTMLInputElement).value;
  const msg = theElementWithTheId('cp-msg', HTMLElement);
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
    const { error } = await thePagesDb.signingIn.changeThePassword(p1);
    if (error) {
      msg.innerHTML = String(kcHtml`<span style="color:#c00">${error.message}</span>`);
      return;
    }
    msg.innerHTML = '<span style="color:#1d5a1d">✓ Password updated.</span>';
    setTimeout(closeChangePassword, 1200);
  } catch (e) {
    msg.innerHTML = String(
      kcHtml`<span style="color:#c00">${thisOrElse(theMessageReadOff(e), 'Update failed.')}</span>`,
    );
  }
}

export async function onSignedIn() {
  // Load profile
  const { data: profile } = await thePagesDb.theAccountsNames.theNameOfThisAccount(theSignedInAccountsId()); // never email (P0-31)
  currentProfile = profile;
  const displayName = theNameOrTheAddress(
    (profile?.name ?? '') || theAccountSignedIn('user_metadata').user_metadata?.['display_name'],
  );
  Reflect.set(theElementWithTheId('player-name-display', HTMLElement), 'textContent', displayName);
  // a game opened from My Games reloads the page with "#game=<slot>" in the address, so this fresh
  // load lands straight in that game's report (and a browser refresh while reading a report comes
  // back to the same report, not to My Games). The games list still loads, in the background, so
  // polling and the "← My Games" list are ready when needed.
  const _gm = /^#game=([A-Za-z0-9_-]+)$/.exec(location.hash || '');
  if (_gm) {
    show('sec-report');
    loadAllGames()
      .then(() => {
        startUpdatePolling();
      })
      .catch(() => {
        // the report opens whether or not the games list loads
      });
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
export function openGameFresh(gamePlayerId: string | number | boolean) {
  try {
    history.replaceState(null, '', location.pathname + location.search + '#game=' + encodeURIComponent(gamePlayerId));
  } catch {
    // the reload still opens My Games
  }
  location.reload();
}
export async function answerGmOffer(fn: AnAnswerToTheGameMasterOffer) {
  const ask = theElementWithTheId('gm-offer-ask', HTMLElement);
  ask.querySelectorAll('button').forEach((b) => {
    b.disabled = true;
  });
  const msg = theElementWithTheId('gm-offer-msg', HTMLElement);
  msg.innerHTML = '';
  const { error } = await thePagesDb.theRoles.answerTheGameMasterOffer(fn);
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
  theElementWithTheId('gm-offer-ask', HTMLElement).style.display = 'none';
  theElementWithTheId('gm-offer-done', HTMLElement).style.display = 'block';
}
export async function declineGmOffer() {
  if (!confirm('Turn down the offer to become a Game Master? The Overlord would have to offer again.')) return;
  if (await answerGmOffer('gm_decline_offer'))
    theElementWithTheId('gm-offer-banner', HTMLElement).style.display = 'none';
}

// ── INIT ────
export async function init() {
  try {
    theElementWithTheId('spinner', HTMLElement).style.display = 'none';
    const {
      data: { session },
      error,
    } = await thePagesDb.signingIn.theSessionKeptInThisBrowser();
    if (error) throw theRefusalAsThrown(error);
    if (session) {
      currentUser = session.user;
      await onSignedIn();
    } else show('sec-auth');
  } catch (e) {
    theElementWithTheId('spinner', HTMLElement).style.display = 'block';
    theElementWithTheId('spinner', HTMLElement).textContent =
      'Connection error: ' + theMessageOf(e) + '. Check your internet connection and refresh.';
    console.error('Init failed:', e);
  }
}
