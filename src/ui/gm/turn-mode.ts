import { kcArg, kcHtml } from '../shared/kc-safe.ts';
import { SAFE_START_TURN } from '../../engine/army-tables.ts';
import { thePagesDb } from './config.ts';
import { TURN_MODES, normalizeTurnMode, parseGameState } from './startup.ts';
import { isBotRow } from '../../engine/bots/setup.ts';
import { gameMetaOf } from '../../engine/rules-on-plain-values/a-games-settings-read-from-its-row.ts';
import { normSeaPct } from '../../engine/world/generate.ts';
import { _kcHasMeta } from './startup.ts';
import type { AGamesRowAsItsSettingsAreRead, ATurnMode } from './startup.ts';
import {
  isAList,
  theDateOf,
  theField,
  theListToSearch,
  thisOrElse,
} from '../shared/a-value-of-any-kind-read-as-javascript-reads-it.ts';

/** A games row as the turn-mode panel and the watcher read it: its settings, status, turn and dispatch switch. */
type AGamesRowAsTheTurnModeReadsIt = AGamesRowAsItsSettingsAreRead & {
  readonly status?: string | null | undefined;
  readonly turn?: number | null | undefined;
  readonly block_eliminated_msgs?: boolean | null | undefined;
};
/** A realm's row as the watcher counts the orders it waits on. */
interface ARealmsRowAsTheWatcherReadsIt {
  readonly user_id?: string | null | undefined;
  readonly player_index: number;
  readonly orders_submitted?: boolean | null | undefined;
}

export function turnModeOf(game: AGamesRowAsItsSettingsAreRead | null | undefined) {
  const m = gameMetaOf(game);
  return normalizeTurnMode(m ? m['turnMode'] : theField(parseGameState(game), 'turnMode'));
}
// The game's sea share: the setup cfg before Turn 0, the world record after it. Games made before
// the setting existed carry neither and read as the default.
export function seaPctOf(game: AGamesRowAsItsSettingsAreRead | null | undefined) {
  const m = gameMetaOf(game);
  if (m?.['seaPct'] != null) return normSeaPct(m['seaPct']);
  const gs = parseGameState(game);
  const sea = theField(gs, 'seaPct');
  if (sea != null) return normSeaPct(sea);
  const world = theField(gs, 'world');
  return normSeaPct(world && theField(world, 'seaPct'));
}
// First HH:MM (local clock) strictly after `from` + (everyDays-1) days.
export function computeNextDeadline(tm: unknown, from: Date | string | number | null | undefined) {
  const mode = normalizeTurnMode(tm);
  const base = new Date(
    (from instanceof Date ? from : new Date((from ?? 0) || Date.now())).getTime() + (mode.everyDays - 1) * 86400000,
  );
  const time = mode.time;
  if (typeof time !== 'string') throw new TypeError('tm.time.split is not a function');
  const [hh, mm] = time.split(':').map((n) => parseInt(n) || 0);
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), Number(hh), Number(mm), 0, 0);
  if (d.getTime() <= base.getTime()) d.setDate(d.getDate() + 1);
  return d.toISOString();
}
export function fmtDeadline(iso: unknown) {
  if (!iso) return '—';
  try {
    return theDateOf(iso).toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    const shown: unknown = iso;
    return String(shown);
  }
}
// Absolute date+time of a past event, for the games list. Unlike fmtDeadline (which looks forward
// and omits the year), this includes the year, because the list can hold games months old.
export function fmtLastRun(iso: unknown) {
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
  } catch {
    return '';
  }
}
// Parse to a valid Date or null. normalizeTurnMode passes turnRanAt through untouched, so a corrupt
// or hand-edited game_state can hold junk here; without this the card would print a bare "Invalid
// Date".
export function asDate(iso: unknown) {
  if (!iso || (typeof iso !== 'string' && typeof iso !== 'number')) return null;
  const d = new Date(iso);
  return isFinite(d.getTime()) ? d : null;
}
// "just now" / "3h ago" / "2 days ago" — the at-a-glance scan value when a GM has many games
// running.
export function fmtAgo(iso: unknown) {
  const d = asDate(iso);
  if (!d) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 0) return '';
  if (mins < 1) return 'just now';
  if (mins < 60) return String(mins) + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return String(hrs) + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 30) return String(days) + (days === 1 ? ' day ago' : ' days ago');
  const mons = Math.floor(days / 30);
  return String(mons) + (mons === 1 ? ' month ago' : ' months ago');
}
// Human slots the turn is still waiting on. `rows` = game_players; G = parsed active state (may be
// {}).
export function realmExemptFromOrders(G: unknown, idx: number) {
  const pl = theField(thisOrElse(G ? theField(G, 'players') : G, []), idx);
  if (!pl) return false;
  if (theField(pl, 'conceded') || theField(pl, '_eliminated')) return true;
  const hasProv = Number(theField(thisOrElse(theField(pl, 'provinces'), []), 'length')) > 0;
  const hasChar = theListToSearch(thisOrElse(G ? theField(G, 'characters') : G, [])).some(
    (c) => c && theField(c, 'alive') && theField(c, 'player') === idx,
  );
  return !hasProv && !hasChar;
}
// The same test from a games ROW: meta.exempt when the row carries meta, else the parsed state.
export function realmExemptIn(game: AGamesRowAsItsSettingsAreRead | null | undefined, idx: number) {
  const m = gameMetaOf(game);
  const exempt = m ? m['exempt'] : undefined;
  if (isAList(exempt)) return exempt.includes(idx);
  return realmExemptFromOrders(parseGameState(game), idx);
}
export function ordersWaitingOn(
  rows: readonly ARealmsRowAsTheWatcherReadsIt[] | null | undefined,
  game: AGamesRowAsItsSettingsAreRead | null | undefined,
) {
  return (rows ?? []).filter(
    (p) => p.user_id && !isBotRow(p) && !realmExemptIn(game, p.player_index) && !p.orders_submitted,
  );
}
// Has this realm already conceded (voluntarily or by GM removal)? Read from the parsed state — the
// light `meta` column only carries the combined exempt list, which also covers extinguished realms.
export function realmConcededIn(game: AGamesRowAsItsSettingsAreRead | null | undefined, idx: number) {
  const gs = parseGameState(game);
  const pl = theField(thisOrElse(gs ? theField(gs, 'players') : gs, []), idx);
  return !!(pl && theField(pl, 'conceded'));
}
// {ready, reason} for the auto-turn watcher. Requires an active game with at least one realm.
export function autoTurnReady(
  game: AGamesRowAsTheTurnModeReadsIt | null | undefined,
  rows: readonly ARealmsRowAsTheWatcherReadsIt[] | null | undefined,
  tm: ATurnMode | null | undefined,
) {
  if (game?.status !== 'active') return { ready: false, reason: 'not active' };
  const mode = tm ?? turnModeOf(game);
  if (mode.mode === 'manual') return { ready: false, reason: 'manual' };
  const humans = (rows ?? []).filter((p) => p.user_id && !isBotRow(p));
  const bots = (rows ?? []).filter(isBotRow);
  if (humans.length + bots.length === 0) return { ready: false, reason: 'no realms' };
  const waiting = ordersWaitingOn(rows, game);
  if (waiting.length === 0) return { ready: true, reason: 'all orders in' };
  if (mode.mode === 'deadline' && mode.nextDeadlineAt && Date.now() >= theDateOf(mode.nextDeadlineAt).getTime())
    return { ready: true, reason: 'deadline passed' };
  return { ready: false, reason: `waiting on ${String(waiting.length)}` };
}
export function turnModeSummary(tm: unknown) {
  const mode = normalizeTurnMode(tm);
  if (mode.mode === 'manual') return '🧑‍⚖️ Manual';
  if (mode.mode === 'auto') return '⚙️ Auto (all orders in)';
  const time: unknown = mode.time;
  return `⏱ Auto · deadline ${fmtDeadline(mode.nextDeadlineAt)} (${String(time)}${mode.everyDays > 1 ? ' every ' + String(mode.everyDays) + ' days' : ' daily'})`;
}
export function updateTurnModeFields(prefix: string) {
  const sel = document.getElementById(prefix + '-turnmode'),
    f = document.getElementById(prefix + '-turnmode-fields');
  if (sel instanceof HTMLSelectElement && f) f.style.display = sel.value === 'deadline' ? 'block' : 'none';
}
/** The value of the form's field with the id `id`, a <select> or an <input> the form writes, as
 *  `document.getElementById(id)?.value` read it. */
function theValueOfTheFormsField(id: string) {
  const el = document.getElementById(id);
  return el instanceof HTMLSelectElement || el instanceof HTMLInputElement ? el.value : undefined;
}
export function readTurnModeForm(prefix: string) {
  return normalizeTurnMode({
    mode: theValueOfTheFormsField(prefix + '-turnmode'),
    time: theValueOfTheFormsField(prefix + '-deadline-time'),
    everyDays: theValueOfTheFormsField(prefix + '-deadline-days'),
  });
}
export function turnModeFormHtml(prefix: string, mode: unknown) {
  const tm = normalizeTurnMode(mode);
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
export function renderTurnModePanel(game: AGamesRowAsTheTurnModeReadsIt | null | undefined) {
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
  wrap.innerHTML =
    String(kcHtml`<div style="border:1px solid var(--gold);border-radius:4px;padding:10px;background:#20160c">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
        <span style="color:var(--parchment);font-weight:600">Turn running</span>
        <span class="pill pill-blue">${turnModeSummary(tm)}</span>
        <button class="btn btn-gold" style="margin-left:auto;font-size:.72rem;padding:4px 10px" onclick="saveTurnMode()">💾 Save</button>
      </div>
      ${turnModeFormHtml('detail', tm)}
      ${watcherNote}
      <div id="detail-turnmode-msg" style="font-size:.78rem;margin-top:4px"></div>
    </div>${botDiplomacyPanelHtml(game)}${safeStartNoteHtml(game)}${blockEliminatedPanelHtml(game)}`);
}
// R-075 (P0-25): the GM's switch for realms that are out. Until the game is over, a realm that has conceded or been
// extinguished sends no private dispatches; with the switch on it sends none at all. Saved in
// games.block_eliminated_msgs (the game's GM, or the Overlord as Master GM); the player portal applies it.
export function blockEliminatedPanelHtml(game: AGamesRowAsTheTurnModeReadsIt | null | undefined) {
  const on = !!game?.block_eliminated_msgs;
  return kcHtml`<div style="border:1px solid var(--gold);border-radius:4px;padding:10px;background:#20160c;margin-top:8px">
      <label style="display:flex;align-items:center;gap:8px;margin:0;color:var(--parchment);font-weight:600;cursor:pointer">
        <input type="checkbox" id="detail-block-eliminated" ${on ? 'checked' : ''} onchange="saveBlockEliminated(this.checked)" style="width:auto;margin:0">
        Block eliminated realms from sending dispatches
      </label>
      <div style="font-size:.76rem;color:var(--stone);margin-top:4px">Until the game is over, a realm that has conceded or been extinguished sends no private dispatches. Off: it may still write to All Realms. On: it can't send any. Players see a change the next time they open the game.</div>
      <div id="detail-block-eliminated-msg" style="font-size:.78rem;margin-top:4px"></div>
    </div>`;
}
export async function saveBlockEliminated(on: unknown) {
  if (!currentGame) return;
  const msg = document.getElementById('detail-block-eliminated-msg');
  const say = (t: string, c: string) => {
    if (msg) {
      msg.style.color = c;
      msg.textContent = t;
    }
  };
  say('Saving…', 'var(--stone)');
  const { data, error } = await thePagesDb.theGameMastersGames.keepTheRealmsThatAreOutOfThisGameFromSendingDispatches(
    currentGame.id,
    !!on,
  );
  if (error || !data) {
    const b = document.getElementById('detail-block-eliminated');
    if (b instanceof HTMLInputElement) b.checked = !on;
    say('Not saved: ' + (error ? error.message : 'this game could not be changed.'), '#e88');
    return;
  }
  currentGame.block_eliminated_msgs = data.block_eliminated_msgs;
  say(
    on ? "Saved: realms that are out can't send dispatches." : 'Saved: realms that are out may write to All Realms.',
    '#8c8',
  );
}
// 2026-09-26b (Toby item 10): Bot Diplomacy for a game that has bot realms — Normal (bots follow
// their alignment; some may ally with humans) or Aggressive (every bot at war with every human realm,
// never allied). Set at creation; editable here during setup or play. Takes effect from the next
// turn resolved (an existing bot–human alliance is broken by the bot's declaration of war then).
export function _gameHasBots(gs: unknown) {
  if (!gs) return false;
  if (typeof currentGamePlayers !== 'undefined' && isAList(currentGamePlayers) && currentGamePlayers.some(isBotRow))
    return true;
  const players = theField(gs, 'players');
  if (isAList(players) && players.some((p) => p && thisOrElse(theField(p, 'isBot'), theField(p, 'bot')))) return true;
  return Number(thisOrElse(theField(gs, 'botCount'), 0)) > 0 || !!theField(gs, 'allBot');
}
// SAFE START (2026-09-29): read-only note in the game detail — set at creation, not changeable.
export function safeStartNoteHtml(game: AGamesRowAsTheTurnModeReadsIt | null | undefined) {
  const gs = parseGameState(game);
  if (!gs || !theField(gs, 'safeStart')) return '';
  const t = Number(game?.turn) || 0,
    open = t >= SAFE_START_TURN;
  return kcHtml`<div style="border:1px solid var(--gold);border-radius:4px;padding:8px 10px;background:#20160c;margin-top:8px;color:var(--parchment);font-size:.84rem">🕊 <strong>Safe Start</strong> — no Treats or declarations of war until the orders for Turn ${SAFE_START_TURN}. ${open ? kcHtml`<span style="color:var(--stone)">(Diplomacy is now open.)</span>` : ''}</div>`;
}
export function botDiplomacyPanelHtml(game: AGamesRowAsItsSettingsAreRead | null | undefined) {
  const gs = parseGameState(game);
  if (!_gameHasBots(gs)) return '';
  const cur = theField(gs, 'botDiplomacy') === 'hostile' ? 'hostile' : 'normal';
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
  const choice = document.getElementById('detail-botdiplomacy');
  const v = choice instanceof HTMLSelectElement && choice.value === 'hostile' ? 'hostile' : 'normal';
  const gs = parseGameState(currentGame);
  if (typeof gs !== 'object' || gs === null)
    throw new TypeError(`Cannot create property 'botDiplomacy' on ${typeof gs} '${String(gs)}'`);
  Reflect.set(gs, 'botDiplomacy', v);
  if (msg) msg.innerHTML = '<span style="color:var(--stone)">Saving…</span>';
  const { data, error } = await thePagesDb.theGameMastersGames.changeThisGameWhileOnThisTurnAndAnswerItsId(
    currentGame.id,
    currentGame.turn,
    { game_state: JSON.stringify(gs), ...metaPatch(gs) },
  );
  if (error) {
    if (msg) msg.innerHTML = String(kcHtml`<span style="color:#e88">${error.message}</span>`);
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
export function buildGameMeta(state: unknown) {
  const gs: object = state && typeof state === 'object' ? state : {};
  const m: Record<string, unknown> = { v: 1, turnMode: normalizeTurnMode(Reflect.get(gs, 'turnMode')) };
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
    if (Reflect.get(gs, k) !== undefined) m[k] = Reflect.get(gs, k);
  });
  // ARCHIVE (2026-09-27, Toby item 1). The flag lives in game_state — the one place every writer
  // round-trips — and is copied up into meta here so the LIGHT games-list read can see it without
  // pulling the world. Because meta is rebuilt from game_state on every save, a later turn
  // resolution cannot silently drop it.
  if (Reflect.get(gs, 'archived')) {
    m['archived'] = true;
    if (Reflect.get(gs, 'archivedAt')) m['archivedAt'] = Reflect.get(gs, 'archivedAt');
  }
  const sp = theSeaShareHeldBy(gs);
  if (sp != null) m['seaPct'] = sp;
  const players: unknown = Reflect.get(gs, 'players');
  if (isAList(players)) {
    m['realms'] = players.length;
    m['exempt'] = players.map((_pl, i) => (realmExemptFromOrders(gs, i) ? i : -1)).filter((i) => i >= 0);
  }
  return m;
}
/** The sea share a game's setup or world holds, as `gs.seaPct != null ? gs.seaPct : gs.world && gs.world.seaPct != null
 *  ? gs.world.seaPct : null` read it. */
function theSeaShareHeldBy(gs: object): unknown {
  const sea: unknown = Reflect.get(gs, 'seaPct');
  if (sea != null) return sea;
  const world: unknown = Reflect.get(gs, 'world');
  if (!world) return null;
  const worldsSea = theField(world, 'seaPct');
  return worldsSea ?? null;
}
// Spread into any games insert/update that writes game_state: `{game_state:…, ...metaPatch(gs)}`.
export function metaPatch(gs: unknown) {
  return _kcHasMeta ? { meta: buildGameMeta(gs) } : {};
}
