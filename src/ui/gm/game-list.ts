import { kcArg, kcHtml } from '../shared/kc-safe.ts';
import { sb } from './config.ts';
import { _kcOverlord, show } from './sign-in.ts';
import { openGame } from './game-detail.ts';
import { _showArchived, gameArchived, gameArchivedAt, gamesListCols, metaPatch } from '../../db/game-meta.ts';
import {
  fmtAgo,
  fmtLastRun,
  readTurnModeForm,
  realmExemptIn,
  seaPctOf,
  turnModeOf,
  turnModeSummary,
  updateTurnModeFields,
} from './turn-mode.ts';
import { botConfigFor, gameVisibility, isBotRow } from '../../engine/bots/setup.ts';
import { SEA_PCT_DEFAULT, normSeaPct } from '../../engine/world/generate.ts';

// ── GAME LIST ────
export let _listGames = []; // the last list read: the GM's own games, or every game for the Overlord
export let _gmNames = {}; // Master GM mode: account id -> name, for grouping by GM
export async function loadGames() {
  const el = document.getElementById('games-list');
  el.innerHTML = '<div class="msg-info">Loading…</div>';
  // Disk-IO (2026-09-25): the list needs name / turn / status / meta and the slots' submitted flags —
  // never the world or the reports. See gamesListCols.
  const { data, error } = _kcOverlord
    ? await loadEveryGame()
    : await sb
        .from('games')
        .select(gamesListCols())
        .eq('gm_user_id', currentUser.id)
        .order('created_at', { ascending: false });
  if (error) {
    el.innerHTML = kcHtml`<div class="msg-error">${error.message}</div>`;
    return;
  }
  _listGames = data || [];
  if (_kcOverlord) {
    const ids = [...new Set(_listGames.map((g) => g.gm_user_id).filter(Boolean))];
    const { data: prof } = ids.length ? await sb.from('profiles').select('id,name').in('id', ids) : { data: [] };
    _gmNames = {};
    (prof || []).forEach((p) => {
      _gmNames[p.id] = p.name || '';
    });
  }
  renderGameList();
}
// Master GM mode: every game, newest first, light columns, in pages of 200.
export async function loadEveryGame() {
  const rows = [];
  for (let from = 0; ; from += 200) {
    const { data, error } = await sb
      .from('games')
      .select(gamesListCols())
      .order('created_at', { ascending: false })
      .range(from, from + 199);
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < 200) break;
  }
  return { data: rows, error: null };
}
export function renderGameList() {
  const el = document.getElementById('games-list');
  const data = _listGames;
  if (!data || data.length === 0) {
    el.innerHTML = _kcOverlord
      ? '<div class="msg-info">No games yet.</div>'
      : '<div class="msg-info">No games yet. Click "+ New Game" to create your first game.</div>';
    return;
  }
  // ARCHIVE (2026-09-27 item 1): the main list shows live games; the Archived list shows the rest.
  // Nothing is deleted either way — the switch only changes which half is on screen.
  const _archCount = data.filter(gameArchived).length;
  const _rows = data.filter((g) => gameArchived(g) === _showArchived);
  const _switch =
    _archCount > 0 || _showArchived
      ? kcHtml`<div class="topbar" style="display:flex;justify-content:flex-end;margin-bottom:10px">
         <button class="btn btn-ghost" style="font-size:.7rem" onclick="toggleArchivedView()">${_showArchived ? `← Back to active games (${data.length - _archCount})` : `🗄 Archived games (${_archCount})`}</button>
       </div>`
      : '';
  const _banner = _showArchived
    ? kcHtml`<div class="msg-info" style="margin-bottom:10px">🗄 <strong>Archived games.</strong> Everything is kept — the world, the players, every turn report, the dispatches, the statistics and the Hall-of-Fame record. Archived games are simply out of the way, and the auto-turn watcher leaves them alone. Open one and press <strong>Restore</strong> to bring it back.</div>`
    : '';
  if (_rows.length === 0) {
    el.innerHTML = kcHtml`${_switch}${_banner}<div class="msg-info">${_showArchived ? 'No archived games.' : _kcOverlord ? 'No active games.' : 'No active games. Click "+ New Game" to start one.'}</div>`;
    return;
  }
  if (_kcOverlord) {
    // Master GM mode: grouped by GM (by name), narrowed by the filter (game or GM name).
    const q = (document.getElementById('overlord-filter').value || '').trim().toLowerCase();
    const gmName = (g) => _gmNames[g.gm_user_id] || (g.gm_user_id ? '(unknown GM)' : '(no GM)');
    const groups = {};
    _rows
      .filter(
        (g) =>
          !q ||
          String(g.name || '')
            .toLowerCase()
            .includes(q) ||
          gmName(g).toLowerCase().includes(q),
      )
      .forEach((g) => {
        (groups[gmName(g)] = groups[gmName(g)] || []).push(g);
      });
    const names = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    el.innerHTML = kcHtml`${_switch}${_banner}${
      names.length
        ? names.map(
            (n) => kcHtml`<div class="gm-group" data-gm="${n}">
      <h3 style="color:var(--gold);margin:14px 0 8px">${n} <span style="font-size:.75rem;color:var(--parchment)">· ${groups[n].length} game${groups[n].length > 1 ? 's' : ''}</span></h3>
      ${groups[n].map((g) => gameCardHtml(g))}</div>`,
          )
        : kcHtml`<div class="msg-info">No game matches.</div>`
    }`;
    return;
  }
  el.innerHTML = kcHtml`${_switch}${_banner}${_rows.map((g) => gameCardHtml(g))}`;
}
export function gameCardHtml(g) {
  const total = g.game_players?.length || 0;
  const joined = g.game_players?.filter((p) => p.user_id).length || 0;
  const submitted = g.game_players?.filter((p) => p.orders_submitted).length || 0;
  const maxP = g.max_players || 4;
  const { botCount: _bc, allBot: _ab } = botConfigFor(g);
  const _plannedBots = _ab ? maxP : _bc;
  const _humanCap = _ab ? 0 : maxP - _plannedBots;
  const _botTag = _plannedBots ? ` +${_plannedBots}🤖` : '';
  let pill = '';
  if (g.status === 'setup')
    pill = kcHtml`<span class="pill pill-amber">Setup — ${joined}/${_humanCap} joined${_botTag}</span>`;
  else if (g.status === 'active') {
    // Green once every joined human has submitted (submitted>=joined, including the all-bot
    // joined===0 case, where there are no human orders to wait on) — signals the turn is ready to
    // run. Conceded / extinguished realms are exempt (they are never waited on), so count only
    // the rest.
    const _need = (g.game_players || []).filter((p) => p.user_id && !isBotRow(p) && !realmExemptIn(g, p.player_index));
    const _in = _need.filter((p) => p.orders_submitted).length;
    const _allIn = _in >= _need.length;
    const _tm = turnModeOf(g);
    pill = kcHtml`<span class="pill ${_allIn ? 'pill-green' : 'pill-blue'}">Turn ${g.turn} — ${_in}/${_need.length} orders in${_allIn ? ' ✓' : ''}${_botTag}</span>${_tm.mode !== 'manual' ? kcHtml` <span class="pill pill-amber">${turnModeSummary(_tm)}</span>` : ''}`;
  } else if (g.status === 'complete') pill = kcHtml`<span class="pill pill-green">Complete</span>`;
  // Visibility lives in the setup-phase game_state; active/complete games no longer carry it.
  const _vis = gameVisibility(g);
  const _visTag =
    g.status === 'setup'
      ? _vis.private
        ? kcHtml` <span class="pill pill-amber" title="Only invited players can see this game">🔒 Private · ${_vis.invited.length} invited</span>`
        : kcHtml` <span class="pill pill-blue">🌍 Public</span>`
      : '';
  // Last turn run: G.turnMode.turnRanAt is stamped at world-gen (Turn 0) and again on every turn
  // resolution, so no schema change is needed. Setup-phase games have not run a turn yet; games
  // created before turn-modes existed carry no stamp, so both fall back gracefully.
  const _ranAt = fmtLastRun(turnModeOf(g).turnRanAt); // '' when missing or unparseable
  const _ranAgo = fmtAgo(turnModeOf(g).turnRanAt); // '' when missing, unparseable, or in the future
  const _lastRunTag =
    g.status === 'setup'
      ? ''
      : _ranAt
        ? kcHtml` · Last turn run ${_ranAt}${_ranAgo ? kcHtml` <span style="opacity:.75">(${_ranAgo})</span>` : ''}`
        : kcHtml` · Last turn run <span style="opacity:.75">not recorded</span>`;
  const _archTag = gameArchived(g)
    ? kcHtml` <span class="pill pill-amber" title="Archived — all data kept">🗄 Archived${(() => {
        const a = gameArchivedAt(g);
        return a ? ` ${fmtLastRun(a)}` : '';
      })()}</span>`
    : '';
  return kcHtml`<div class="game-card" data-game="${g.id}" onclick="openGame(${kcArg(String(g.id))})"${gameArchived(g) ? kcHtml` style="opacity:.82"` : ''}>
    <div>
      <div class="gc-name">${g.name}${pill}${_visTag}${_archTag}</div>
      <div class="gc-meta">${maxP} player slots · Sea ${seaPctOf(g)}% · Created ${new Date(g.created_at).toLocaleDateString()}${_lastRunTag}</div>
    </div>
    <div class="gc-action"><span style="color:var(--gold);font-size:1.2rem">›</span></div>
  </div>`;
}

// ── NEW GAME ────
export function showNewGame() {
  document.getElementById('new-game-msg').innerHTML = '';
  updateMaxPlayersForMap(); // ensure the player-count options match the selected map size
  // Reset visibility to Public (the default / current behaviour) each time the form opens.
  const _pub = document.querySelector('input[name="new-game-visibility"][value="public"]');
  if (_pub) _pub.checked = true;
  _inviteSelected = new Set();
  const _search = document.getElementById('new-game-invite-search');
  if (_search) _search.value = '';
  {
    const _tmSel = document.getElementById('new-game-turnmode');
    if (_tmSel) {
      _tmSel.value = 'manual';
      updateTurnModeFields('new-game');
    }
  }
  {
    const _sp = document.getElementById('new-game-seapct');
    if (_sp) {
      _sp.value = String(SEA_PCT_DEFAULT);
      updateSeaHint();
    }
  }
  const _wrap = document.getElementById('new-game-invite-wrap');
  if (_wrap) _wrap.style.display = 'none';
  show('sec-new-game');
}

// ── PRIVATE-GAME INVITES ────
// Private games are stored WITHOUT any DB schema change: the setup-phase game_state JSON carries
// {visibility:'private', invited:[<profile.id>,…]}. Existing/running games have no `visibility` key,
// so they read as Public and are unaffected. (game_state is overwritten with world state at Turn 0,
// by which point the game is 'active' and no longer joinable, so the invite list is self-cleaning.)
// Declared globals (plan P1-09b): one binding the page's files and its tests share (ui/gm/globals.ts says why).
globalThis._invitablePlayers = null; // cached profiles [{id,name,joined}]
globalThis._inviteSelected = new Set(); // ids ticked in the New Game picker
// 2026-09-25: how many profile rows the LAST fetch returned BEFORE the GM's own row was dropped.
// Row-Level Security filters silently — a GM account the profiles policy does not cover gets an
// empty result and no error — so the picker used to print "No other registered players yet." for
// a permissions problem exactly as it did for a genuinely empty table. Zero raw rows means the
// query could not even see the signed-in account's own profile: that is an RLS symptom, and the
// empty-list message now says so.
export let _invitableRawCount = null;

// Fetch every registered player's name and the month they joined (never their email: ruling D-08, P0-31).
// Excludes the signed-in GM. Cached for the session; pass force=true to refetch.
export async function loadInvitablePlayers(force) {
  if (_invitablePlayers && !force) return _invitablePlayers;
  const { data, error } = await sb.from('profiles').select('id,name,created_at').order('name', { ascending: true });
  if (error) {
    _invitablePlayers = null;
    _invitableRawCount = null;
    throw error;
  }
  _invitableRawCount = (data || []).length;
  _invitablePlayers = (data || [])
    .filter((p) => p && p.id !== currentUser.id) // don't offer the GM as a joinable player
    .map((p) => ({ id: p.id, name: p.name || '(unnamed)', joined: joinedMonth(p.created_at) }));
  return _invitablePlayers;
}
// "Oct 2026", to tell two players of one name apart. Fixed month names: browsers differ ("Sep" / "Sept").
export function joinedMonth(ts) {
  const d = new Date(ts);
  if (!ts || isNaN(d)) return '';
  return (
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()] +
    ' ' +
    d.getUTCFullYear()
  );
}

// Toggle the picker when Public/Private changes; lazily load the player list the first time.
export async function updateGameVisibility() {
  const priv = document.querySelector('input[name="new-game-visibility"]:checked')?.value === 'private';
  const wrap = document.getElementById('new-game-invite-wrap');
  if (wrap) wrap.style.display = priv ? 'block' : 'none';
  if (!priv) return;
  const list = document.getElementById('new-game-invite-list');
  if (list)
    list.innerHTML = '<div style="padding:10px;color:var(--stone);font-size:.82rem">Loading registered players…</div>';
  try {
    await loadInvitablePlayers();
    renderInviteCheckboxes('new-game-invite-list', 'new-game-invite-search', _inviteSelected, 'new-game-invite-count');
  } catch (e) {
    if (list)
      list.innerHTML = kcHtml`<div class="msg-error" style="margin:8px">Couldn't load players: ${e.message}<br><small>The GM account needs SELECT access to the <code>profiles</code> table (RLS).</small></div>`;
  }
}

// Shared renderer for both the New Game picker and the detail-screen Edit-Invites modal. Reads the
// cached _invitablePlayers, filters by the search box, and reflects/updates the given Set of ids.
export function renderInviteCheckboxes(listId, searchId, selectedSet, countId) {
  const list = document.getElementById(listId);
  if (!list) return;
  const q = (document.getElementById(searchId)?.value || '').trim().toLowerCase();
  const players = _invitablePlayers || [];
  const shown = players.filter((p) => !q || p.name.toLowerCase().includes(q));
  if (players.length === 0) {
    list.innerHTML =
      _invitableRawCount === 0
        ? '<div class="msg-error" style="margin:8px">No profiles came back at all — not even this GM account\'s own. That is almost always a permissions problem, not an empty table: this GM account cannot read the <code>profiles</code> table under its Row-Level Security policy.<br><small>In Supabase → Authentication → Policies (table <code>profiles</code>), add a SELECT policy that covers this account — e.g. <code>for select to authenticated using (true)</code> — then reload.</small></div>'
        : '<div style="padding:10px;color:var(--stone);font-size:.82rem">No other registered players yet.</div>';
  } else if (shown.length === 0) {
    list.innerHTML =
      '<div style="padding:10px;color:var(--stone);font-size:.82rem">No players match that filter.</div>';
  } else {
    list.innerHTML = kcHtml`${shown.map((p) => {
      const on = selectedSet.has(p.id);

      return kcHtml`<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid #2a2015;cursor:pointer;font-weight:normal">
        <input type="checkbox" ${on ? 'checked' : ''} onchange="toggleInvite(${kcArg(listId)},${kcArg(searchId)},${kcArg(countId)},${kcArg(String(p.id))},this.checked)">
        <span style="flex:1;min-width:0">
          <span style="color:var(--parchment)">${p.name || ''}</span>
          ${p.joined ? kcHtml`<span style="color:var(--stone);font-size:.78rem"> · joined ${p.joined}</span>` : ''}
        </span>
      </label>`;
    })}`;
  }
  const cnt = document.getElementById(countId);
  if (cnt) {
    cnt.textContent = `${selectedSet.size} player${selectedSet.size !== 1 ? 's' : ''} invited`;
  }
  // stash the working Set + ids on the list so toggleInvite can reach the right one
  list._selectedSet = selectedSet;
}
export function toggleInvite(listId, searchId, countId, id, on) {
  const list = document.getElementById(listId);
  const set = list && list._selectedSet;
  if (!set) return;
  if (on) set.add(id);
  else set.delete(id);
  const cnt = document.getElementById(countId);
  if (cnt) cnt.textContent = `${set.size} player${set.size !== 1 ? 's' : ''} invited`;
}
// Map a set/array of invited ids to display names (for the detail screen).
export function invitedNames(ids) {
  const byId = {};
  (_invitablePlayers || []).forEach((p) => (byId[p.id] = p.name));
  return (ids || []).map((id) => byId[id] || '(unknown player)');
}

// ── EDIT INVITES (game-detail modal, setup-phase private games) ──
// A declared global (plan P1-09b): one binding the page's files and its tests share (ui/gm/globals.ts says why).
globalThis._editInviteSelected = new Set();
export async function openEditInvites() {
  if (!currentGame) {
    return;
  }
  if (currentGame.status !== 'setup') {
    alert('Invites can only be edited while the game is still in setup.');
    return;
  }
  const vis = gameVisibility(currentGame);
  _editInviteSelected = new Set(vis.invited || []);
  // Build the modal shell
  if (document.getElementById('edit-invite-overlay')) return;
  const ov = document.createElement('div');
  ov.id = 'edit-invite-overlay';
  ov.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;z-index:99999';
  ov.innerHTML = `
    <div style="background:#12100b;border:2px solid var(--gold);border-radius:6px;padding:16px;max-width:460px;width:92%;max-height:82vh;display:flex;flex-direction:column">
      <div style="font-family:'Cinzel',serif;font-size:1rem;margin-bottom:8px;color:var(--gold)">🔒 Edit invited players</div>
      <input type="text" id="edit-invite-search" placeholder="Filter by name…" oninput="renderInviteCheckboxes('edit-invite-list','edit-invite-search',_editInviteSelected,'edit-invite-count')" style="margin-bottom:8px">
      <div id="edit-invite-list" style="flex:1;overflow:auto;border:1px solid var(--stone);border-radius:3px;background:#0d0b07;min-height:120px"><div style="padding:10px;color:var(--stone);font-size:.82rem">Loading registered players…</div></div>
      <div id="edit-invite-count" style="font-size:.78rem;color:var(--gold);margin:6px 0"></div>
      <div id="edit-invite-msg" style="font-size:.8rem;min-height:16px;margin-bottom:6px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="closeEditInvites()">Cancel</button>
        <button class="btn btn-crimson" onclick="saveEditInvites()">Save invites</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  try {
    await loadInvitablePlayers();
    renderInviteCheckboxes('edit-invite-list', 'edit-invite-search', _editInviteSelected, 'edit-invite-count');
  } catch (e) {
    const l = document.getElementById('edit-invite-list');
    if (l)
      l.innerHTML = kcHtml`<div class="msg-error" style="margin:8px">Couldn't load players: ${e.message}<br><small>The GM account needs SELECT access to the <code>profiles</code> table (RLS).</small></div>`;
  }
}
export function closeEditInvites() {
  const o = document.getElementById('edit-invite-overlay');
  if (o) o.remove();
}
export async function saveEditInvites() {
  const msg = document.getElementById('edit-invite-msg');
  if (!currentGame) {
    closeEditInvites();
    return;
  }
  const invited = [..._editInviteSelected];
  // Merge into the existing setup config (keep mapSize/botCount/allBot etc. intact).
  let cfg = {};
  try {
    cfg =
      typeof currentGame.game_state === 'string' ? JSON.parse(currentGame.game_state) : currentGame.game_state || {};
  } catch (e) {
    cfg = {};
  }
  cfg.visibility = 'private';
  cfg.invited = invited;
  if (msg) msg.innerHTML = '<span style="color:var(--stone)">Saving…</span>';
  const { error } = await sb
    .from('games')
    .update({ game_state: JSON.stringify(cfg), ...metaPatch(cfg) })
    .eq('id', currentGame.id);
  if (error) {
    if (msg) msg.innerHTML = kcHtml`<span style="color:#e88">${error.message}</span>`;
    return;
  }
  currentGame.game_state = JSON.stringify(cfg);
  Object.assign(currentGame, metaPatch(cfg)); // keep the in-memory copy fresh
  closeEditInvites();
  openGame(currentGame.id); // re-render the detail with the updated invite list
}

// Comfortable player caps per map size — the most kings that fit with at least ~3 provinces between
// every pair of home provinces (worked out from the best-of-N home placement). Minimum 2.
export const MAP_MAX_PLAYERS = { p2: 2, p3: 3, p4: 4, p5: 5, p6: 6, p7: 7, p8: 8, p9: 9, p10: 10 };
export function updateMaxPlayersForMap() {
  const sizeEl = document.getElementById('new-game-mapsize');
  const sel = document.getElementById('new-game-maxplayers');
  if (!sizeEl || !sel) return;
  const max = MAP_MAX_PLAYERS[sizeEl.value] || 10;
  const prev = parseInt(sel.value) || max; // keep the GM's choice where possible
  sel.innerHTML = '';
  for (let n = 2; n <= max; n++) {
    const opt = document.createElement('option');
    opt.value = String(n);
    opt.textContent = `${n} players`;
    sel.appendChild(opt);
  }
  sel.value = String(Math.min(Math.max(2, prev), max));
  updateBotHint();
  updateSeaHint();
}

// Sea share (2026-09-25): 20–80% in steps of 5, default 35% (the old fixed fill averaged ~33%). The
// hint tells the GM what the share does to the world before they commit.
export function updateSeaHint() {
  const el = document.getElementById('new-game-seapct'),
    lab = document.getElementById('new-game-seapct-label'),
    hint = document.getElementById('new-game-sea-hint');
  if (!el) return;
  const v = normSeaPct(el.value);
  if (String(v) !== el.value) el.value = String(v);
  if (lab) lab.textContent = v + '%';
  if (!hint) return;
  const sizeEl = document.getElementById('new-game-mapsize');
  const sizemap = {
    p2: { cols: 8, rows: 5 },
    p3: { cols: 8, rows: 7 },
    p4: { cols: 9, rows: 7 },
    p5: { cols: 12, rows: 7 },
    p6: { cols: 15, rows: 7 },
    p7: { cols: 16, rows: 7 },
    p8: { cols: 17, rows: 8 },
    p9: { cols: 16, rows: 11 },
    p10: { cols: 16, rows: 11 },
  };
  const sz = sizemap[sizeEl ? sizeEl.value : 'p5'] || sizemap.p5,
    cells = sz.cols * sz.rows,
    sea = Math.round((cells * v) / 100),
    land = cells - sea;
  const maxEl = document.getElementById('new-game-maxplayers');
  const realms = Math.max(2, parseInt(maxEl && maxEl.value) || 2);
  let flavour;
  if (v <= 25)
    flavour = 'A continent — a few lakes and inland seas. Fleets and Naval matter little; wars are fought overland.';
  else if (v <= 40)
    flavour = 'Coasts and channels — the classic map. Most realms touch the sea; a navy is useful but not essential.';
  else if (v <= 55)
    flavour =
      'Archipelagos — land splits into islands. Fleets (or flyers) are needed to reach most rivals; Naval and Part Sea become strong.';
  else
    flavour =
      'A drowned world — scattered islands in open ocean. Every campaign is amphibious; expect far less land, tax and lairs per realm.';
  hint.textContent = `${sea} sea · ${land} land of ${cells} provinces — about ${(land / realms).toFixed(1)} land provinces per realm. ${flavour}`;
}
// Bot realms (Phase 1): validate the bot count against map capacity and show the GM the resulting
// human/bot split. Bots consume the same realm capacity as humans.
export function updateBotHint() {
  const maxEl = document.getElementById('new-game-maxplayers');
  const botEl = document.getElementById('new-game-botcount');
  const allEl = document.getElementById('new-game-allbot');
  const hint = document.getElementById('new-game-bot-hint');
  if (!maxEl || !botEl || !hint) return;
  const maxP = parseInt(maxEl.value) || 2;
  const allBot = !!(allEl && allEl.checked);
  // All-bot fills every slot; disable & clamp the bot-count field in that mode.
  botEl.disabled = allBot;
  let bots = allBot ? maxP : Math.max(0, Math.min(parseInt(botEl.value) || 0, maxP));
  if (!allBot && String(bots) !== botEl.value) botEl.value = String(bots);
  if (!allBot && bots === 0) {
    hint.style.display = 'none';
    return;
  }
  const humans = allBot ? 0 : maxP - bots;
  hint.style.display = 'block';
  if (allBot) {
    hint.innerHTML = kcHtml`🤖 <strong>All-bot game:</strong> all ${maxP} realms will be GM-controlled bots. No humans can join. Needs at least 2.`;
  } else if (humans <= 0) {
    hint.innerHTML = kcHtml`🤖 <strong>${bots} bots</strong>, no room for human players (bots fill all ${maxP} slots). Tick “All-bot game”, or lower the bot count to leave human slots.`;
  } else {
    hint.innerHTML = kcHtml`🤖 <strong>${bots} bot${bots !== 1 ? 's' : ''}</strong> + up to <strong>${humans} human${humans !== 1 ? 's' : ''}</strong> = ${maxP} realms. Bots are generated when you run Turn 0.`;
  }
}

export async function createGame() {
  const name = document.getElementById('new-game-name').value.trim();
  const mapSize = document.getElementById('new-game-mapsize').value;
  const cap = MAP_MAX_PLAYERS[mapSize] || 10;
  const maxP = Math.min(Math.max(2, parseInt(document.getElementById('new-game-maxplayers').value) || 2), cap);
  const maxTurns = 0; // no turn limit — the game ends only at the Reckoning or by elimination (0 = unlimited)
  // ── Bot realms (Phase 1) ──
  const allBot = !!document.getElementById('new-game-allbot')?.checked;
  let botCount = allBot
    ? maxP
    : Math.max(0, Math.min(parseInt(document.getElementById('new-game-botcount')?.value) || 0, maxP));
  const msg = document.getElementById('new-game-msg');
  if (!name) {
    msg.innerHTML = '<div class="msg-error">Please enter a game name.</div>';
    return;
  }
  if (allBot && maxP < 2) {
    msg.innerHTML = '<div class="msg-error">An all-bot game needs at least 2 realms — raise Maximum Players.</div>';
    return;
  }
  if (!allBot && botCount >= maxP && maxP >= 2) {
    // Bots fill every slot but the GM didn't tick all-bot — treat as all-bot rather than lock
    // humans out silently.
    if (!confirm(`You've set ${botCount} bots with no room for human players. Create this as an all-bot game?`)) return;
  }
  // ── Visibility (Public / Private) ──
  const isPrivate = document.querySelector('input[name="new-game-visibility"]:checked')?.value === 'private';
  const invited = isPrivate ? [..._inviteSelected] : [];
  if (isPrivate && !allBot && invited.length === 0) {
    if (
      !confirm(
        'This private game has no invited players — nobody will be able to join it. Create it anyway (you can add invites from the game screen)?',
      )
    )
      return;
  }
  msg.innerHTML = '<div class="msg-info">Creating game…</div>';
  const _cfg = {
    mapSize,
    maxTurns,
    maxPlayers: maxP,
    botCount: botCount >= maxP ? maxP : botCount,
    allBot: allBot || botCount >= maxP,
  };
  _cfg.seaPct = normSeaPct(document.getElementById('new-game-seapct')?.value); // 20–80% of the world is water (world gen makes it exact)
  _cfg.botDiplomacy = document.getElementById('new-game-botdiplomacy')?.value === 'hostile' ? 'hostile' : 'normal'; // 2026-09-26b (Toby item 10)
  _cfg.safeStart = !!document.getElementById('new-game-safestart')?.checked; // 2026-09-29 (Toby): Safe Start
  _cfg.botDifficulty = 'hard'; // 2026-09-26 (Toby item 9): one bot strength — the former Hard. Saved with the game so Turn 0 and telemetry read it.
  _cfg.turnMode = readTurnModeForm('new-game'); // manual / auto / deadline (deadline clock starts at Turn 0)
  if (isPrivate) {
    _cfg.visibility = 'private';
    _cfg.invited = invited;
  }
  const { data: game, error } = await sb
    .from('games')
    .insert({
      name,
      gm_user_id: currentUser.id,
      status: 'setup',
      turn: 0,
      max_players: maxP,
      max_turns: maxTurns,
      game_state: JSON.stringify(_cfg),
      ...metaPatch(_cfg),
    })
    .select()
    .single();
  if (error) {
    const isRLS = error.message?.includes('row-level security') || error.code === '42501';
    msg.innerHTML = kcHtml`<div class="msg-error">${error.message}${isRLS ? kcHtml`<br><small>Add an INSERT policy on the games table in your Supabase dashboard.</small>` : ''}</div>`;
    return;
  }
  msg.innerHTML = kcHtml`<div class="msg-success">Game created! ${isPrivate ? `Only your ${invited.length} invited player${invited.length !== 1 ? 's' : ''} will see it.` : 'Any registered player can now see and join it.'}</div>`;
  setTimeout(() => {
    show('sec-games');
    loadGames();
  }, 1500);
}
