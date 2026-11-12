// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcArg, kcHtml } from '../shared/kc-safe.ts';
import { SAFE_START_TURN } from '../../engine/army-tables.ts';
import { sb } from './config.ts';
import { TURN_MODES, normalizeTurnMode, parseGameState } from './startup.ts';
import { isBotRow } from '../../engine/bots/setup.ts';
import { gameMetaOf } from '../../engine/rules-on-plain-values/a-games-settings-read-from-its-row.ts';
import { normSeaPct } from '../../engine/world/generate.ts';
import { _kcHasMeta } from './startup.ts';

export function turnModeOf(game) {
  const m = gameMetaOf(game);
  return normalizeTurnMode(m ? m.turnMode : parseGameState(game).turnMode);
}
// The game's sea share: the setup cfg before Turn 0, the world record after it. Games made before
// the setting existed carry neither and read as the default.
export function seaPctOf(game) {
  const m = gameMetaOf(game);
  if (m && m.seaPct != null) return normSeaPct(m.seaPct);
  const gs = parseGameState(game);
  return normSeaPct(gs.seaPct != null ? gs.seaPct : gs.world && gs.world.seaPct);
}
// First HH:MM (local clock) strictly after `from` + (everyDays-1) days.
export function computeNextDeadline(tm, from) {
  tm = normalizeTurnMode(tm);
  const base = new Date(
    (from instanceof Date ? from : new Date(from || Date.now())).getTime() + (tm.everyDays - 1) * 86400000,
  );
  const [hh, mm] = tm.time.split(':').map((n) => parseInt(n) || 0);
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh, mm, 0, 0);
  if (d.getTime() <= base.getTime()) d.setDate(d.getDate() + 1);
  return d.toISOString();
}
export function fmtDeadline(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return String(iso);
  }
}
// Absolute date+time of a past event, for the games list. Unlike fmtDeadline (which looks forward
// and omits the year), this includes the year, because the list can hold games months old.
export function fmtLastRun(iso) {
  const d = asDate(iso);
  if (!d) return '';
  try {
    return d.toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return '';
  }
}
// Parse to a valid Date or null. normalizeTurnMode passes turnRanAt through untouched, so a corrupt
// or hand-edited game_state can hold junk here; without this the card would print a bare "Invalid
// Date".
export function asDate(iso) {
  if (!iso || (typeof iso !== 'string' && typeof iso !== 'number')) return null;
  const d = new Date(iso);
  return isFinite(d.getTime()) ? d : null;
}
// "just now" / "3h ago" / "2 days ago" — the at-a-glance scan value when a GM has many games
// running.
export function fmtAgo(iso) {
  const d = asDate(iso);
  if (!d) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 0) return '';
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 30) return days + (days === 1 ? ' day ago' : ' days ago');
  const mons = Math.floor(days / 30);
  return mons + (mons === 1 ? ' month ago' : ' months ago');
}
// Human slots the turn is still waiting on. `rows` = game_players; G = parsed active state (may be
// {}).
export function realmExemptFromOrders(G, idx) {
  const pl = ((G && G.players) || [])[idx];
  if (!pl) return false;
  if (pl.conceded || pl._eliminated) return true;
  const hasProv = (pl.provinces || []).length > 0;
  const hasChar = ((G && G.characters) || []).some((c) => c && c.alive && c.player === idx);
  return !hasProv && !hasChar;
}
// The same test from a games ROW: meta.exempt when the row carries meta, else the parsed state.
export function realmExemptIn(game, idx) {
  const m = gameMetaOf(game);
  if (m && Array.isArray(m.exempt)) return m.exempt.includes(idx);
  return realmExemptFromOrders(parseGameState(game), idx);
}
export function ordersWaitingOn(rows, game) {
  return (rows || []).filter(
    (p) => p.user_id && !isBotRow(p) && !realmExemptIn(game, p.player_index) && !p.orders_submitted,
  );
}
// Has this realm already conceded (voluntarily or by GM removal)? Read from the parsed state — the
// light `meta` column only carries the combined exempt list, which also covers extinguished realms.
export function realmConcededIn(game, idx) {
  const gs = parseGameState(game);
  const pl = ((gs && gs.players) || [])[idx];
  return !!(pl && pl.conceded);
}
// {ready, reason} for the auto-turn watcher. Requires an active game with at least one realm.
export function autoTurnReady(game, rows, tm) {
  if (!game || game.status !== 'active') return { ready: false, reason: 'not active' };
  tm = tm || turnModeOf(game);
  if (tm.mode === 'manual') return { ready: false, reason: 'manual' };
  const humans = (rows || []).filter((p) => p.user_id && !isBotRow(p));
  const bots = (rows || []).filter(isBotRow);
  if (humans.length + bots.length === 0) return { ready: false, reason: 'no realms' };
  const waiting = ordersWaitingOn(rows, game);
  if (waiting.length === 0) return { ready: true, reason: 'all orders in' };
  if (tm.mode === 'deadline' && tm.nextDeadlineAt && Date.now() >= new Date(tm.nextDeadlineAt).getTime())
    return { ready: true, reason: 'deadline passed' };
  return { ready: false, reason: `waiting on ${waiting.length}` };
}
export function turnModeSummary(tm) {
  tm = normalizeTurnMode(tm);
  if (tm.mode === 'manual') return '🧑‍⚖️ Manual';
  if (tm.mode === 'auto') return '⚙️ Auto (all orders in)';
  return `⏱ Auto · deadline ${fmtDeadline(tm.nextDeadlineAt)} (${tm.time}${tm.everyDays > 1 ? ' every ' + tm.everyDays + ' days' : ' daily'})`;
}
export function updateTurnModeFields(prefix) {
  const sel = document.getElementById(prefix + '-turnmode'),
    f = document.getElementById(prefix + '-turnmode-fields');
  if (sel && f) f.style.display = sel.value === 'deadline' ? 'block' : 'none';
}
export function readTurnModeForm(prefix) {
  return normalizeTurnMode({
    mode: document.getElementById(prefix + '-turnmode')?.value,
    time: document.getElementById(prefix + '-deadline-time')?.value,
    everyDays: document.getElementById(prefix + '-deadline-days')?.value,
  });
}
export function turnModeFormHtml(prefix, tm) {
  tm = normalizeTurnMode(tm);
  return kcHtml`<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <select id="${prefix}-turnmode" onchange="updateTurnModeFields(${kcArg(prefix)})" style="flex:1;min-width:220px">
        ${Object.entries(TURN_MODES).map(([k, v]) => kcHtml`<option value="${k}" ${tm.mode === k ? 'selected' : ''}>${v}</option>`)}
      </select>
    </div>
    <div id="${prefix}-turnmode-fields" style="display:${tm.mode === 'deadline' ? 'block' : 'none'};margin-top:6px;font-size:.84rem">
      <label style="margin:0;font-weight:normal">Deadline time <input type="time" id="${prefix}-deadline-time" value="${tm.time}" style="width:auto;margin-left:6px"></label>
      <label style="margin:0 0 0 14px;font-weight:normal">every <input type="number" id="${prefix}-deadline-days" min="1" max="30" value="${tm.everyDays}" style="width:60px;margin-left:6px"> day(s)</label>
    </div>`;
}
// Game-detail panel: shows the current mode and lets the GM switch it (setup or active).
export function renderTurnModePanel(game) {
  const wrap = document.getElementById('detail-turnmode-wrap');
  if (!wrap) return;
  if (!game || game.status === 'complete') {
    wrap.innerHTML = '';
    return;
  }
  const tm = turnModeOf(game);
  const watcherNote =
    tm.mode === 'manual'
      ? ''
      : kcHtml`<div style="font-size:.76rem;color:var(--stone);margin-top:6px">${_autoWatcherTimer ? '✅ This tab is watching and will run the turn automatically' : '⚠ Watcher not running in this tab'} — automatic turns only fire while a signed-in GM Portal tab is open.${tm.mode === 'deadline' && tm.turnRanAt ? ` Last run ${fmtDeadline(tm.turnRanAt)}.` : ''}</div>`;
  wrap.innerHTML = kcHtml`<div style="border:1px solid var(--gold);border-radius:4px;padding:10px;background:#20160c">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
        <span style="color:var(--parchment);font-weight:600">Turn running</span>
        <span class="pill pill-blue">${turnModeSummary(tm)}</span>
        <button class="btn btn-gold" style="margin-left:auto;font-size:.72rem;padding:4px 10px" onclick="saveTurnMode()">💾 Save</button>
      </div>
      ${turnModeFormHtml('detail', tm)}
      ${watcherNote}
      <div id="detail-turnmode-msg" style="font-size:.78rem;margin-top:4px"></div>
    </div>${botDiplomacyPanelHtml(game)}${safeStartNoteHtml(game)}${blockEliminatedPanelHtml(game)}`;
}
// R-075 (P0-25): the GM's switch for realms that are out. Until the game is over, a realm that has conceded or been
// extinguished sends no private dispatches; with the switch on it sends none at all. Saved in
// games.block_eliminated_msgs (the game's GM, or the Overlord as Master GM); the player portal applies it.
export function blockEliminatedPanelHtml(game) {
  const on = !!(game && game.block_eliminated_msgs);
  return kcHtml`<div style="border:1px solid var(--gold);border-radius:4px;padding:10px;background:#20160c;margin-top:8px">
      <label style="display:flex;align-items:center;gap:8px;margin:0;color:var(--parchment);font-weight:600;cursor:pointer">
        <input type="checkbox" id="detail-block-eliminated" ${on ? 'checked' : ''} onchange="saveBlockEliminated(this.checked)" style="width:auto;margin:0">
        Block eliminated realms from sending dispatches
      </label>
      <div style="font-size:.76rem;color:var(--stone);margin-top:4px">Until the game is over, a realm that has conceded or been extinguished sends no private dispatches. Off: it may still write to All Realms. On: it can't send any. Players see a change the next time they open the game.</div>
      <div id="detail-block-eliminated-msg" style="font-size:.78rem;margin-top:4px"></div>
    </div>`;
}
export async function saveBlockEliminated(on) {
  if (!currentGame) return;
  const msg = document.getElementById('detail-block-eliminated-msg');
  const say = (t, c) => {
    if (msg) {
      msg.style.color = c;
      msg.textContent = t;
    }
  };
  say('Saving…', 'var(--stone)');
  const { data, error } = await sb
    .from('games')
    .update({ block_eliminated_msgs: !!on })
    .eq('id', currentGame.id)
    .select('id,block_eliminated_msgs')
    .maybeSingle();
  if (error || !data) {
    const b = document.getElementById('detail-block-eliminated');
    if (b) b.checked = !on;
    say('Not saved: ' + (error ? error.message : 'this game could not be changed.'), '#e88');
    return;
  }
  currentGame.block_eliminated_msgs = !!data.block_eliminated_msgs;
  say(
    on ? "Saved: realms that are out can't send dispatches." : 'Saved: realms that are out may write to All Realms.',
    '#8c8',
  );
}
// 2026-09-26b (Toby item 10): Bot Diplomacy for a game that has bot realms — Normal (bots follow
// their alignment; some may ally with humans) or Aggressive (every bot at war with every human realm,
// never allied). Set at creation; editable here during setup or play. Takes effect from the next
// turn resolved (an existing bot–human alliance is broken by the bot's declaration of war then).
export function _gameHasBots(gs) {
  if (!gs) return false;
  if (
    typeof currentGamePlayers !== 'undefined' &&
    Array.isArray(currentGamePlayers) &&
    currentGamePlayers.some(isBotRow)
  )
    return true;
  if (Array.isArray(gs.players) && gs.players.some((p) => p && (p.isBot || p.bot))) return true;
  return (gs.botCount || 0) > 0 || !!gs.allBot;
}
// SAFE START (2026-09-29): read-only note in the game detail — set at creation, not changeable.
export function safeStartNoteHtml(game) {
  const gs = parseGameState(game);
  if (!gs || !gs.safeStart) return '';
  const t = Number(game && game.turn) || 0,
    open = t >= SAFE_START_TURN;
  return kcHtml`<div style="border:1px solid var(--gold);border-radius:4px;padding:8px 10px;background:#20160c;margin-top:8px;color:var(--parchment);font-size:.84rem">🕊 <strong>Safe Start</strong> — no Treats or declarations of war until the orders for Turn ${SAFE_START_TURN}. ${open ? kcHtml`<span style="color:var(--stone)">(Diplomacy is now open.)</span>` : ''}</div>`;
}
export function botDiplomacyPanelHtml(game) {
  const gs = parseGameState(game);
  if (!_gameHasBots(gs)) return '';
  const cur = gs.botDiplomacy === 'hostile' ? 'hostile' : 'normal';
  return kcHtml`<div style="border:1px solid var(--gold);border-radius:4px;padding:10px;background:#20160c;margin-top:8px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="color:var(--parchment);font-weight:600">Bot diplomacy</span>
        <select id="detail-botdiplomacy" style="flex:1;min-width:220px;margin:0">
          <option value="normal" ${cur === 'normal' ? 'selected' : ''}>Normal — bots follow their alignment; some may ally with humans</option>
          <option value="hostile" ${cur === 'hostile' ? 'selected' : ''}>Aggressive — bots always at war with human realms, never allied</option>
        </select>
        <button class="btn btn-gold" style="font-size:.72rem;padding:4px 10px" onclick="saveBotDiplomacy()">💾 Save</button>
      </div>
      <div id="detail-botdiplomacy-msg" style="font-size:.78rem;margin-top:4px"></div>
    </div>`;
}
export async function saveBotDiplomacy() {
  const msg = document.getElementById('detail-botdiplomacy-msg');
  if (!currentGame) return;
  const v = document.getElementById('detail-botdiplomacy')?.value === 'hostile' ? 'hostile' : 'normal';
  const gs = parseGameState(currentGame);
  gs.botDiplomacy = v;
  if (msg) msg.innerHTML = '<span style="color:var(--stone)">Saving…</span>';
  const { data, error } = await sb
    .from('games')
    .update({ game_state: JSON.stringify(gs), ...metaPatch(gs) })
    .eq('id', currentGame.id)
    .eq('turn', currentGame.turn)
    .select('id')
    .maybeSingle();
  if (error) {
    if (msg) msg.innerHTML = kcHtml`<span style="color:#e88">${error.message}</span>`;
    return;
  }
  if (!data) {
    if (msg)
      msg.innerHTML =
        '<span style="color:#e88">The turn advanced while you were editing — reload the game and try again.</span>';
    return;
  }
  currentGame.game_state = JSON.stringify(gs);
  Object.assign(currentGame, metaPatch(gs));
  if (msg) msg.innerHTML = '<span style="color:#8c8">Saved — applies from the next turn resolved.</span>';
}

// gs = the parsed game_state (setup cfg before Turn 0, the world G after it).
export function buildGameMeta(gs) {
  gs = gs && typeof gs === 'object' ? gs : {};
  const m = { v: 1, turnMode: normalizeTurnMode(gs.turnMode) };
  [
    'mapSize',
    'maxPlayers',
    'botCount',
    'allBot',
    'botDifficulty',
    'botDiplomacy',
    'safeStart',
    'visibility',
    'invited',
  ].forEach((k) => {
    if (gs[k] !== undefined) m[k] = gs[k];
  });
  // ARCHIVE (2026-09-27, Toby item 1). The flag lives in game_state — the one place every writer
  // round-trips — and is copied up into meta here so the LIGHT games-list read can see it without
  // pulling the world. Because meta is rebuilt from game_state on every save, a later turn
  // resolution cannot silently drop it.
  if (gs.archived) {
    m.archived = true;
    if (gs.archivedAt) m.archivedAt = gs.archivedAt;
  }
  const sp = gs.seaPct != null ? gs.seaPct : gs.world && gs.world.seaPct != null ? gs.world.seaPct : null;
  if (sp != null) m.seaPct = sp;
  if (Array.isArray(gs.players)) {
    m.realms = gs.players.length;
    m.exempt = gs.players.map((pl, i) => (realmExemptFromOrders(gs, i) ? i : -1)).filter((i) => i >= 0);
  }
  return m;
}
// Spread into any games insert/update that writes game_state: `{game_state:…, ...metaPatch(gs)}`.
export function metaPatch(gs) {
  return _kcHasMeta ? { meta: buildGameMeta(gs) } : {};
}
