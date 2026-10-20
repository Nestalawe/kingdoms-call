import { kcDbGuard } from '../../db/kc-db-guard.js';

// ══════════════════════════════════════════════════════════════════════════════════════════════
// KINGDOMS CALL — THE OVERLORD PAGE (plan step P0-32f, ruling R-097)
// ══════════════════════════════════════════════════════════════════════════════════════════════
// For the Overlord only: every account (overlord_accounts), offering, withdrawing and revoking Game Master, handing a
// game to another Game Master (reassign_game, which revoking needs first), suspending, lifting a suspension and deleting
// an account (P0-32h), every game, and the reported dispatches of every game. Every action is a database function or rule that checks the Overlord itself (P0-32b, P0-32e), so this
// page grants nothing: anyone else is told "This page is for the Overlord" and nothing is read.
// Not linked from any public page; the Overlord bookmarks it.
// Everything shown that an account or a player wrote (names, emails, game names, dispatches, reasons) goes in as text
// (el() below), never as markup.
// Its sign-in is kept apart from the portals' (storageKey), so signing in here never switches the account a GM tab in
// the same browser is running turns with.
if (typeof KC_CONFIG === 'undefined') throw new Error('kc-config.js did not load: reload the page.');
export const sb = supabase.createClient(KC_CONFIG.supabaseUrl, KC_CONFIG.supabaseKey, {
  auth: { storageKey: 'kc-overlord-auth' },
});
// The oldest database this page works with (P0-34): P0-32h's, which added suspending and deleting accounts (and
// suspended_until) on top of P0-32e's reassign_game and the Overlord's rights on every game. The page can't work without it.
export const KC_DB_MIN = '20261015051826';

export let ME = null; // the signed-in account
export let ACCOUNTS = []; // overlord_accounts(); null if it failed (ACCOUNTS_ERROR says why)
export let ACCOUNTS_ERROR = '';
export let GAMES = []; // every game, light columns; null if the read failed (GAMES_ERROR)
export let GAMES_ERROR = '';
export let REPORTS = []; // gm_reported_messages(null)
export let REALMS = {}; // game id -> {player_index: realm name}, for the reported games
export let REVOKING = null; // the account whose Revoke panel is open
export let DELETING = null; // the account whose Delete panel is open (one panel at a time)

export const $ = (id) => document.getElementById(id);
// One element, its attributes and its children. Children are nodes or text: text is never read as markup.
export function el(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  kids.flat(Infinity).forEach((c) => {
    if (c != null && c !== false) e.append(c instanceof Node ? c : String(c));
  });
  return e;
}
export const fill = (id, ...kids) => {
  const box = $(id);
  box.replaceChildren(...kids.flat(Infinity).filter((c) => c != null && c !== false));
};
export const day = (v) => (v ? String(v).slice(0, 10) : '—');
export function say(kind, text) {
  fill('msg', text ? el('div', { class: 'msg-' + kind }, text) : null);
}
export function section(id) {
  ['sec-auth', 'sec-denied', 'sec-main'].forEach((s) => $(s).classList.toggle('on', s === id));
}

// ── SIGN-IN ───────────────────────────────────────────────────────────────────────────────────
export async function init() {
  $('spinner').style.display = 'none';
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (session && session.user) {
    ME = session.user;
    onSignedIn();
  } else section('sec-auth');
}
export async function doSignIn() {
  const email = $('si-email').value.trim(),
    password = $('si-password').value;
  if (!email || !password) {
    fill('auth-msg', el('div', { class: 'msg-error' }, 'Enter your email and password.'));
    return;
  }
  fill('auth-msg', el('div', { class: 'msg-info' }, 'Signing in…'));
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    fill(
      'auth-msg',
      el(
        'div',
        { class: 'msg-error' },
        /Invalid login/.test(error.message) ? 'Email or password incorrect.' : error.message,
      ),
    );
    return;
  }
  fill('auth-msg');
  ME = (data && data.user) || ((await sb.auth.getSession()).data.session || {}).user || null;
  if (ME) onSignedIn();
}
export async function doSignOut() {
  await sb.auth.signOut();
  ME = null;
  ACCOUNTS = [];
  GAMES = [];
  REPORTS = [];
  REALMS = {};
  REVOKING = null;
  DELETING = null;
  section('sec-auth');
}
export async function onSignedIn() {
  const { data, error } = await sb.rpc('is_site_admin');
  if (error || data !== true) {
    const m = $('denied-msg');
    m.className = error ? 'msg-error' : 'msg-info';
    m.textContent = error
      ? `Couldn't check whether you're the Overlord (${error.message}). Reload to try again.`
      : 'This page is for the Overlord.';
    section('sec-denied');
    return;
  }
  $('me-email').textContent = ME.email || '';
  section('sec-main');
  await loadAll();
}

// ── LOADING ───────────────────────────────────────────────────────────────────────────────────
export async function loadAll() {
  fill('accounts', el('div', { class: 'msg-info' }, 'Loading…'));
  fill('games', el('div', { class: 'msg-info' }, 'Loading…'));
  fill('reports', el('div', { class: 'msg-info' }, 'Loading…'));
  await Promise.all([loadAccounts(), loadGames()]);
  renderAccounts();
  renderGames();
  await loadReports();
}
export async function loadAccounts() {
  const { data, error } = await sb.rpc('overlord_accounts');
  ACCOUNTS = error ? null : data || [];
  ACCOUNTS_ERROR = error ? error.message : '';
}
// Every game, newest first, in pages: the light columns only, never the world (traps.md, "select('*') on big tables").
export async function loadGames() {
  const rows = [];
  for (let from = 0; ; from += 200) {
    const { data, error } = await sb
      .from('games')
      .select('id,name,gm_user_id,status,turn,max_turns,created_at,meta')
      .order('created_at', { ascending: false })
      .range(from, from + 199);
    if (error) {
      GAMES = null;
      GAMES_ERROR = error.message;
      return;
    }
    rows.push(...(data || []));
    if (!data || data.length < 200) break;
  }
  GAMES = rows;
}
export async function loadReports() {
  const { data, error } = await sb.rpc('gm_reported_messages', { p_game: null });
  if (error) {
    fill('reports', el('div', { class: 'msg-error' }, error.message));
    return;
  }
  REPORTS = Array.isArray(data) ? data : [];
  const ids = [...new Set(REPORTS.map((r) => r.game_id))];
  REALMS = {};
  if (ids.length) {
    const { data: slots } = await sb
      .from('game_players')
      .select('game_id,player_index,display_name')
      .in('game_id', ids);
    (slots || []).forEach((s) => {
      (REALMS[s.game_id] = REALMS[s.game_id] || {})[s.player_index] = s.display_name;
    });
  }
  renderReports();
}

// ── WHO'S WHO ─────────────────────────────────────────────────────────────────────────────────
export const account = (id) => (ACCOUNTS || []).find((a) => a.user_id === id) || null;
export const nameOf = (id) => {
  const a = account(id);
  return a ? a.name || a.email || '(no name)' : id ? '(unknown account)' : '(no GM)';
};
export const gameMasters = (except) =>
  (ACCOUNTS || [])
    .filter((a) => a.gm_status === 'game_master' && a.user_id !== except)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
export const unfinished = (gm) => (GAMES || []).filter((g) => g.gm_user_id === gm && g.status !== 'complete');
export function metaOf(g) {
  try {
    const m = typeof g.meta === 'string' ? JSON.parse(g.meta) : g.meta;
    return m && typeof m === 'object' ? m : {};
  } catch (e) {
    return {};
  }
}
export const TURN_MODES = { manual: 'By hand', auto: 'When all orders are in', deadline: 'Orders in, or the deadline' };

// ── ACCOUNTS ──────────────────────────────────────────────────────────────────────────────────
export function renderAccounts() {
  if (ACCOUNTS == null) {
    fill('accounts', el('div', { class: 'msg-error' }, ACCOUNTS_ERROR));
    return;
  }
  const q = $('acct-q').value.trim().toLowerCase();
  const list = ACCOUNTS.filter(
    (a) =>
      !q ||
      String(a.name || '')
        .toLowerCase()
        .includes(q) ||
      String(a.email || '')
        .toLowerCase()
        .includes(q),
  );
  if (!list.length) {
    fill('accounts', el('div', { class: 'muted' }, q ? 'No account matches.' : 'No accounts.'));
    return;
  }
  const rows = list.map((a) => {
    const self = ME && a.user_id === ME.id;
    const status = self
      ? el('span', { class: 'pill pill-blue' }, 'Overlord')
      : a.gm_status === 'game_master'
        ? el('span', { class: 'pill pill-green' }, 'Game Master')
        : a.gm_status === 'offered'
          ? el('span', { class: 'pill pill-amber' }, 'Offered')
          : el('span', { class: 'pill pill-grey' }, 'Player');
    const gmAction = self
      ? null
      : a.gm_status === 'game_master'
        ? el(
            'button',
            {
              class: 'btn btn-crimson btn-sm',
              'data-act': 'revoke',
              onclick: () => {
                REVOKING = REVOKING === a.user_id ? null : a.user_id;
                DELETING = null;
                renderAccounts();
              },
            },
            'Revoke GM…',
          )
        : a.gm_status === 'offered'
          ? el(
              'button',
              { class: 'btn btn-ghost btn-sm', 'data-act': 'withdraw', onclick: () => withdrawOffer(a) },
              'Withdraw offer',
            )
          : el(
              'button',
              { class: 'btn btn-forest btn-sm', 'data-act': 'offer', onclick: () => offerGm(a) },
              'Offer GM',
            );
    const tr = el(
      'tr',
      { 'data-user': a.user_id },
      el('td', null, a.name || '(no name)'),
      el('td', null, a.email || ''),
      el('td', null, day(a.joined)),
      el('td', null, day(a.last_sign_in)),
      el(
        'td',
        null,
        status,
        a.suspended_until
          ? [' ', el('span', { class: 'pill pill-red', 'data-suspended': '' }, suspendedText(a))]
          : null,
      ),
      el('td', { class: 'num' }, a.games_run || 0),
      el('td', { class: 'num' }, a.games_played || 0),
      el('td', null, el('div', { class: 'actions' }, gmAction, self ? null : accountActions(a))),
    );
    if (self) return [tr];
    if (REVOKING === a.user_id) return [tr, el('tr', null, el('td', { colspan: 8 }, revokePanel(a)))];
    if (DELETING === a.user_id) return [tr, el('tr', null, el('td', { colspan: 8 }, deletePanel(a)))];
    return [tr];
  });
  fill(
    'accounts',
    el(
      'table',
      { class: 'kc' },
      el(
        'thead',
        null,
        el(
          'tr',
          null,
          ['Name', 'Email', 'Joined', 'Last sign-in', 'Status'].map((h) => el('th', null, h)),
          el('th', { class: 'num' }, 'Games run'),
          el('th', { class: 'num' }, 'Played'),
          el('th', null, ''),
        ),
      ),
      el('tbody', null, rows),
    ),
  );
}
// Revoking: first every unfinished game the account runs goes to another Game Master; then Revoke is enabled
// (gm_revoke refuses until then anyway).
export function revokePanel(a) {
  const left = unfinished(a.user_id);
  return el(
    'div',
    { class: 'revoke', id: 'revoke-panel' },
    el(
      'div',
      { style: 'margin-bottom:6px' },
      'Revoke Game Master from ',
      el('strong', null, a.name || a.email || ''),
      '.',
    ),
    left.length
      ? [
          el(
            'div',
            { class: 'muted', style: 'margin-bottom:6px' },
            `They run ${left.length} unfinished game${left.length > 1 ? 's' : ''}. Hand ${left.length > 1 ? 'each' : 'it'} to another Game Master first.`,
          ),
          el(
            'table',
            { class: 'kc' },
            el(
              'tbody',
              null,
              left.map((g) => el('tr', { 'data-game': g.id }, el('td', null, g.name), el('td', null, handOver(g)))),
            ),
          ),
        ]
      : el('div', { class: 'muted', style: 'margin-bottom:6px' }, 'They run no unfinished game.'),
    el(
      'div',
      { class: 'actions', style: 'margin-top:8px' },
      el(
        'button',
        {
          class: 'btn btn-crimson btn-sm',
          id: 'revoke-confirm',
          disabled: left.length > 0,
          onclick: () => revokeGm(a),
        },
        'Revoke GM',
      ),
      el(
        'button',
        {
          class: 'btn btn-ghost btn-sm',
          onclick: () => {
            REVOKING = null;
            renderAccounts();
          },
        },
        'Cancel',
      ),
    ),
  );
}
// ── SUSPEND AND DELETE (P0-32h, R-097) ───────────────────────────────────────────────────────
// A suspension "until lifted" is stored a hundred years ahead (account_suspend), so anything past fifty reads as that.
export const label = (a) => a.name || a.email || '(no name)';
export function suspendedText(a) {
  const t = new Date(a.suspended_until);
  return t.getTime() - Date.now() > 50 * 365 * 864e5
    ? 'Suspended until lifted'
    : 'Suspended until ' + t.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
}
export const SUSPEND_FOR = {
  day: ['for a day', 864e5],
  week: ['for a week', 7 * 864e5],
  lifted: ['until you lift it', null],
};
export function accountActions(a) {
  const suspension = a.suspended_until
    ? el(
        'button',
        { class: 'btn btn-ghost btn-sm', 'data-act': 'unsuspend', onclick: () => unsuspend(a) },
        'Lift suspension',
      )
    : (() => {
        const pick = el(
          'select',
          { 'data-act': 'suspend-for' },
          el('option', { value: 'day' }, 'For a day'),
          el('option', { value: 'week' }, 'For a week'),
          el('option', { value: 'lifted' }, 'Until lifted'),
        );
        return [
          pick,
          el(
            'button',
            { class: 'btn btn-ghost btn-sm', 'data-act': 'suspend', onclick: () => suspend(a, pick.value) },
            'Suspend',
          ),
        ];
      })();
  return [
    suspension,
    el(
      'button',
      {
        class: 'btn btn-crimson btn-sm',
        'data-act': 'delete',
        onclick: () => {
          DELETING = DELETING === a.user_id ? null : a.user_id;
          REVOKING = null;
          renderAccounts();
        },
      },
      'Delete…',
    ),
  ];
}
export async function suspend(a, how) {
  const [words, ms] = SUSPEND_FOR[how] || SUSPEND_FOR.day;
  if (
    !confirm(
      `Suspend ${label(a)} ${words}? They can't sign in until then. If they're signed in now, that session lasts until it expires, up to an hour. They keep their realms and games.`,
    )
  )
    return;
  await act(
    sb.rpc('account_suspend', {
      p_user: a.user_id,
      p_until: ms == null ? null : new Date(Date.now() + ms).toISOString(),
    }),
    `${label(a)} is suspended ${words}.`,
  );
}
export async function unsuspend(a) {
  await act(sb.rpc('account_unsuspend', { p_user: a.user_id }), `${label(a)} can sign in again.`);
}
// Deleting: says what goes and what stays, and needs the account's email (or name) typed in. The database refuses while
// the account runs or plays in an unfinished game, and says which.
export function deletePanel(a) {
  const word = a.email || a.name || '';
  const runs = unfinished(a.user_id);
  const typed = el('input', {
    type: 'text',
    id: 'delete-typed',
    autocomplete: 'off',
    placeholder: word,
    style: 'max-width:320px',
  });
  const go = el(
    'button',
    { class: 'btn btn-crimson btn-sm', id: 'delete-confirm', disabled: true, onclick: () => deleteAccount(a) },
    'Delete this account',
  );
  typed.addEventListener('input', () => {
    go.disabled = typed.value.trim().toLowerCase() !== word.toLowerCase();
  });
  return el(
    'div',
    { class: 'revoke', id: 'delete-panel' },
    el('div', { style: 'margin-bottom:6px' }, 'Delete ', el('strong', null, label(a)), ". This can't be undone."),
    el(
      'div',
      { class: 'muted' },
      'Goes: their sign-in, their profile, any Game Master role or offer, and their unread-dispatch markers.',
    ),
    el(
      'div',
      { class: 'muted', style: 'margin-bottom:6px' },
      'Stays: their finished games, with their realms in them (no longer linked to an account), any game they ran (with no GM), their dispatches and their Hall of Fame records.',
    ),
    runs.length
      ? el(
          'div',
          { class: 'msg-info' },
          `They run ${runs.length} unfinished game${runs.length > 1 ? 's' : ''}: hand ${runs.length > 1 ? 'them' : 'it'} over first (Revoke GM… lists them).`,
        )
      : null,
    el(
      'div',
      { class: 'muted', style: 'margin-bottom:6px' },
      "An account playing in an unfinished game can't be deleted either: suspend it until the game ends.",
    ),
    el('label', { for: 'delete-typed' }, `Type ${a.email ? 'their email' : 'their name'} to confirm`),
    typed,
    el(
      'div',
      { class: 'actions', style: 'margin-top:8px' },
      go,
      el(
        'button',
        {
          class: 'btn btn-ghost btn-sm',
          onclick: () => {
            DELETING = null;
            renderAccounts();
          },
        },
        'Cancel',
      ),
    ),
  );
}
export async function deleteAccount(a) {
  DELETING = null;
  await act(sb.rpc('account_delete', { p_user: a.user_id }), `${label(a)}'s account is deleted.`);
}
export async function offerGm(a) {
  await act(
    sb.rpc('gm_offer', { p_user: a.user_id }),
    `Offered Game Master to ${a.name || a.email}. They'll see it at the top of their player portal.`,
  );
}
export async function withdrawOffer(a) {
  await act(sb.rpc('gm_withdraw_offer', { p_user: a.user_id }), `Withdrew the offer to ${a.name || a.email}.`);
}
export async function revokeGm(a) {
  if (!confirm(`Revoke Game Master from ${a.name || a.email}? They can still play.`)) return;
  REVOKING = null;
  await act(sb.rpc('gm_revoke', { p_user: a.user_id }), `${a.name || a.email} is no longer a Game Master.`);
}

// ── GAMES ─────────────────────────────────────────────────────────────────────────────────────
// A picker of Game Masters (not the game's own) and a Hand over button.
export function handOver(g) {
  const pick = el(
    'select',
    { 'data-act': 'pick' },
    el('option', { value: '' }, 'Hand over to…'),
    gameMasters(g.gm_user_id).map((a) => el('option', { value: a.user_id }, a.name || a.email || '(no name)')),
  );
  return el(
    'div',
    { class: 'actions' },
    pick,
    el(
      'button',
      { class: 'btn btn-gold btn-sm', 'data-act': 'handover', onclick: () => reassign(g, pick.value) },
      'Hand over',
    ),
  );
}
export async function reassign(g, to) {
  if (!to) {
    say('error', 'Choose the Game Master to hand the game to.');
    return;
  }
  if (
    !confirm(
      `Hand ${g.name} to ${nameOf(to)}? Their GM portal picks it up; ${nameOf(g.gm_user_id)}'s can no longer save it.`,
    )
  )
    return;
  await act(sb.rpc('reassign_game', { p_game: g.id, p_new_gm: to }), `${g.name} is now run by ${nameOf(to)}.`);
}
export function renderGames() {
  if (GAMES == null) {
    fill('games', el('div', { class: 'msg-error' }, GAMES_ERROR));
    return;
  }
  if (!GAMES.length) {
    fill('games', el('div', { class: 'muted' }, 'No games.'));
    return;
  }
  fill(
    'games',
    el(
      'table',
      { class: 'kc' },
      el(
        'thead',
        null,
        el(
          'tr',
          null,
          ['Game', 'GM', 'Status', 'Turn', 'Turns run', ''].map((h) => el('th', null, h)),
        ),
      ),
      el(
        'tbody',
        null,
        GAMES.map((g) => {
          const m = metaOf(g),
            mode = (m.turnMode && m.turnMode.mode) || 'manual';
          return el(
            'tr',
            { 'data-game': g.id },
            el('td', null, g.name),
            el('td', null, nameOf(g.gm_user_id)),
            el(
              'td',
              null,
              g.status,
              m.archived ? el('span', { class: 'pill pill-grey', style: 'margin-left:5px' }, 'Archived') : null,
            ),
            el('td', { class: 'num' }, g.status === 'setup' ? '—' : g.turn),
            el('td', null, TURN_MODES[mode] || mode),
            el(
              'td',
              null,
              el(
                'div',
                { class: 'actions' },
                handOver(g),
                el(
                  'a',
                  {
                    class: 'btn btn-ghost btn-sm',
                    href: 'kingdoms-call-gm-portal.html?game=' + encodeURIComponent(g.id),
                    target: '_blank',
                    rel: 'noopener',
                  },
                  'Open in the GM portal',
                ),
              ),
            ),
          );
        }),
      ),
    ),
  );
}

// ── REPORTED DISPATCHES ───────────────────────────────────────────────────────────────────────
export function renderReports() {
  if (!REPORTS.length) {
    fill('reports', el('div', { class: 'muted' }, 'No dispatches reported.'));
    return;
  }
  const gameName = (id) => ((GAMES || []).find((g) => String(g.id) === String(id)) || {}).name || '(a deleted game)';
  const realm = (gid, i) => (REALMS[gid] || {})[i] || 'Realm ' + (Number(i) + 1);
  fill(
    'reports',
    REPORTS.map((r) =>
      el(
        'div',
        { class: 'report', 'data-message': r.message_id },
        el(
          'div',
          { class: 'muted' },
          el('strong', null, gameName(r.game_id)),
          ' · ',
          r.turn != null ? `Turn ${r.turn} · ` : '',
          'from ',
          el('strong', null, realm(r.game_id, r.from_index)),
          ' to ',
          r.scope === 'public' ? 'every realm' : (r.to_indexes || []).map((i) => realm(r.game_id, i)).join(', '),
          ' · reported by ',
          el('strong', null, realm(r.game_id, r.reporter_index)),
          r.reason ? [' · “', r.reason, '”'] : null,
        ),
        el('div', { class: 'body' }, r.body),
        el(
          'button',
          { class: 'btn btn-crimson btn-sm', 'data-act': 'delete-dispatch', onclick: () => deleteDispatch(r) },
          'Delete this dispatch',
        ),
      ),
    ),
  );
}
export async function deleteDispatch(r) {
  if (!confirm('Delete this dispatch for everyone in the game? Its reports go with it.')) return;
  const { error } = await sb.from('game_messages').delete().eq('id', r.message_id);
  if (error) {
    say('error', error.message);
    return;
  }
  say('success', 'Dispatch deleted.');
  await loadReports();
}

// ── ACTIONS ───────────────────────────────────────────────────────────────────────────────────
// Runs one database call; on success says so and reloads everything, on a refusal shows the database's reason.
export async function act(call, done) {
  const { error } = await call;
  if (error) {
    say('error', error.message);
    return false;
  }
  say('success', done);
  await loadAll();
  return true;
}

kcDbGuard(sb, KC_DB_MIN).then(() => init());
