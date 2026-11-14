import { kcArg, kcHtml } from '../shared/kc-safe.ts';
import type { KcSafeHtml } from '../shared/kc-safe.ts';
import { thePagesDb } from './config.ts';
import { thisPagesBuild } from '../shared/a-newer-version-of-this-page.ts';
import { theElementWithTheId } from '../shared/the-pages-element-with-the-id.ts';
import { theField, thisOrElse } from '../shared/a-value-of-any-kind-read-as-javascript-reads-it.ts';
import type { TheRealmsOfTheGameTheGmHasOpen } from './startup.ts';
import type { AReportedDispatch } from '../../db/the-db-interface-and-its-areas.ts';

export function show(id: string) {
  document.querySelectorAll('section').forEach((s) => {
    s.classList.remove('section-active');
  });
  document.getElementById(id)?.classList.add('section-active');
}

export async function doSignOut() {
  await thePagesDb.signingIn.signOut();
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
  theElementWithTheId('cp-new', HTMLInputElement).focus();
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
      kcHtml`<span style="color:#c00">${thisOrElse(theField(e, 'message'), 'Update failed.')}</span>`,
    );
  }
}

// P0-32c: the GM portal is for Game Masters (an accepted offer, P0-32b) and the Overlord. Anyone else, or a
// check that fails, gets the "not a Game Master" page and nothing else: no game list, no watcher, no probes.
// Master GM mode (P0-32g): true while the Overlord is signed in. The database lets the Overlord do every GM action on
// any game (P0-32e); this switches the list to every game, hides New Game and keeps the watcher off.
export let _kcOverlord = false;
export async function gmPortalAllowed() {
  const [gm, ov] = await Promise.all([
    thePagesDb.theRoles.isTheSignedInAccountAGameMaster(),
    thePagesDb.theRoles.isTheSignedInAccountTheOverlord(),
  ]);
  const err = gm.error ?? ov.error;
  _kcOverlord = !err && ov.data === true;
  if (!err && (gm.data === true || ov.data === true)) return true;
  const msg = theElementWithTheId('not-gm-msg', HTMLElement);
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
/** A reported dispatch as the card reads it: its turn and its reason as the tables hold them (none where they hold
 *  null), and its addressees as given. */
type AReportedDispatchAsTheCardReadsIt = Omit<AReportedDispatch, 'turn' | 'reason' | 'to_indexes'> & {
  readonly turn: number | null | undefined;
  readonly reason: string | null | undefined;
  readonly to_indexes: readonly number[] | null | undefined;
};
export async function loadReportedDispatches(
  game:
    | { readonly id: string; readonly game_players?: TheRealmsOfTheGameTheGmHasOpen | null | undefined }
    | null
    | undefined,
) {
  const card = document.getElementById('detail-reports-card'),
    el = document.getElementById('detail-reports');
  if (!card || !el) return;
  card.style.display = 'none';
  if (!game || !_kcHasMsg) return;
  card.style.display = 'block';
  if ((game.game_players ?? currentGamePlayers ?? []).some((p) => p.user_id && p.user_id === currentUser?.id)) {
    el.innerHTML =
      '<div class="msg-info">You play a realm in this game, so its reported dispatches go to the Overlord, not to you.</div>';
    return;
  }
  el.innerHTML = '<div class="msg-info">Loading…</div>';
  const { data, error } = await thePagesDb.theReportedDispatches.theDispatchesReportedToThisAccount(game.id);
  if (currentGame?.id !== game.id) return; // another game was opened meanwhile
  if (error) {
    el.innerHTML = String(kcHtml`<div class="msg-error">${error.message}</div>`);
    return;
  }
  const rows: readonly AReportedDispatchAsTheCardReadsIt[] = Array.isArray(data) ? data : [];
  if (!rows.length) {
    el.innerHTML = '<div style="color:var(--stone);font-size:.85rem">No dispatches reported.</div>';
    return;
  }
  const realm = (i: number) => {
    const p = (currentGamePlayers ?? []).find((x) => x.player_index === i);
    return (p?.display_name ?? '') || 'Realm ' + String(i + 1);
  };
  el.innerHTML = String(
    kcHtml`${rows.map((r) => {
      const to = r.scope === 'public' ? 'every realm' : (r.to_indexes ?? []).map(realm).join(', ');
      return kcHtml`<div class="player-slot" style="display:block">
      <div style="font-size:.78rem;color:var(--stone)">${r.turn != null ? 'Turn ' + String(r.turn) + ' · ' : ''}from <strong>${realm(r.from_index)}</strong> to ${to} · reported by <strong>${realm(r.reporter_index)}</strong>${r.reason ? ' · “' + r.reason + '”' : ''}</div>
      <div style="margin:6px 0;white-space:pre-wrap">${r.body}</div>
      <button class="btn btn-crimson" style="font-size:.66rem" onclick="deleteReportedDispatch(${kcArg(r.message_id || 0)})">Delete this dispatch</button>
    </div>`;
    })}`,
  );
}
export async function deleteReportedDispatch(id: number) {
  if (!confirm('Delete this dispatch for everyone in the game? Its reports go with it.')) return;
  const { error } = await thePagesDb.theDispatches.deleteThisDispatch(id);
  if (error) {
    alert(error.message);
    return;
  }
  await loadReportedDispatches(currentGame);
}
export function setAutoTurnStatus(html: KcSafeHtml | string | null | undefined) {
  const el = document.getElementById('auto-turn-status');
  if (!el) return;
  el.style.display = html ? 'block' : 'none';
  el.innerHTML = html ? String(html) : '';
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
