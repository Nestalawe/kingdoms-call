import { kcArg, kcHtml } from '../shared/kc-safe.ts';
import { thePagesDb } from './config.ts';
import { _kcOverlord, loadReportedDispatches, show } from './sign-in.ts';
import { invitedNames, loadInvitablePlayers, closeEditInvites } from './game-list.ts';
import { loadTurnLog } from './turn-log.ts';
import { gameArchived, gameArchivedAt, parseGameState } from './startup.ts';
import {
  fmtLastRun,
  ordersWaitingOn,
  realmConcededIn,
  realmExemptIn,
  renderTurnModePanel,
  seaPctOf,
  turnModeOf,
  turnModeSummary,
  computeNextDeadline,
  metaPatch,
  readTurnModeForm,
} from './turn-mode.ts';
import { botConfigFor, gameVisibility, isBotRow } from '../../engine/bots/setup.ts';
import { theElementFound } from './game-list.ts';
import { theElementWithTheId } from '../shared/the-pages-element-with-the-id.ts';
import { isAList, theField, thisOrElse } from '../shared/a-value-of-any-kind-read-as-javascript-reads-it.ts';
import { asItsGuardReadsIt } from '../../engine/rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { KcSafeHtml } from '../shared/kc-safe.ts';
import type { AGamesRowAsItsSettingsAreRead, TheGameTheGmHasOpen, TheRealmsOfTheGameTheGmHasOpen } from './startup.ts';

/** The game the GM has open, read again after an await (another handler may have changed it meanwhile): for none, the
 *  TypeError the read or write (`theReadOrWrite`, in V8's words) threw. */
export function theGameOpenNow(theReadOrWrite: string): TheGameTheGmHasOpen {
  if (currentGame === null) throw new TypeError(`Cannot ${theReadOrWrite}`);
  return currentGame;
}
/** The realms of the game the GM has open, where the code reads them unguarded: for none, the TypeError that read
 *  threw. */
function theRealmsOfTheGameOpen(): TheRealmsOfTheGameTheGmHasOpen {
  if (currentGamePlayers === null || currentGamePlayers === undefined)
    throw new TypeError(`Cannot read properties of ${String(currentGamePlayers)} (reading 'filter')`);
  return currentGamePlayers;
}
/** A game's state as parsed, before a field is written on it: anything but an object throws the TypeError that write
 *  threw in a module. */
function theStateToWriteOn(gs: unknown, field: string): object {
  if (typeof gs !== 'object' || gs === null)
    throw new TypeError(`Cannot create property '${field}' on ${typeof gs} '${String(gs)}'`);
  return gs;
}

// ── GAME DETAIL ────
export async function openGame(gameId: string) {
  show('sec-game-detail');
  theElementWithTheId('detail-game-name', HTMLElement).textContent = 'Loading…';
  theElementWithTheId('detail-msg', HTMLElement).innerHTML = '';
  theElementWithTheId('detail-players-list', HTMLElement).innerHTML = '';
  theElementWithTheId('detail-orders-card', HTMLElement).style.display = 'none';
  theElementWithTheId('detail-log-card', HTMLElement).style.display = 'none';
  theElementWithTheId('detail-run-turn0-wrap', HTMLElement).style.display = 'none';

  const { data: game, error } = await thePagesDb.theGameMastersGames.thisGameWithItsRealms(gameId);
  if (error) {
    const theRefusal = String(kcHtml`<div class="msg-error">${error.message}</div>`);
    theElementWithTheId('detail-msg', HTMLElement).innerHTML = theRefusal;
    return;
  }
  currentGame = game;
  if (game === null) throw new TypeError("Cannot read properties of null (reading 'game_players')");
  // 2026-09-25: the legacy unit-name rewrite used to be called here on the raw game_state, which is
  // a JSON string — a silent no-op. It now runs inside runTurn on the parsed state (where the
  // rewritten names are actually used and saved).
  currentGamePlayers = asItsGuardReadsIt(game.game_players) ?? [];
  void loadReportedDispatches(game); // P0-24; fills its own card when it answers

  theElementWithTheId('detail-game-name', HTMLElement).textContent = game.name;
  const maxP = game.max_players || 4;
  // ── Bot-aware counts (Phase 1) ──
  const { botCount, allBot } = botConfigFor(game);
  const plannedBots = allBot ? maxP : botCount; // intended bot count
  const joined = currentGamePlayers.filter((p) => p.user_id).length;
  const existingBots = currentGamePlayers.filter(isBotRow).length; // 0 in setup, filled after Turn 0
  const reservedBots = game.status === 'setup' ? Math.max(0, plannedBots - existingBots) : 0;
  const humanCap = allBot ? 0 : maxP - plannedBots;
  const statusLabel =
    game.status === 'setup' ? 'Setup' : game.status === 'active' ? `Turn ${String(game.turn)}` : 'Complete';
  // ARCHIVE (2026-09-27 item 1) — the header says so, and the button becomes Restore.
  const _isArch = gameArchived(game);
  const theStatusPill = String(
    kcHtml`<span class="pill ${game.status === 'active' ? 'pill-blue' : 'pill-amber'}">${statusLabel}</span>${
      _isArch
        ? kcHtml` <span class="pill pill-amber" title="Archived — every scrap of this game is kept">🗄 Archived${(() => {
            const a = gameArchivedAt(game);
            return a ? ` ${fmtLastRun(a)}` : '';
          })()}</span>`
        : ''
    }`,
  );
  theElementWithTheId('detail-status-pill', HTMLElement).innerHTML = theStatusPill;
  {
    const _ab = document.getElementById('detail-archive-btn');
    if (_ab) {
      _ab.textContent = _isArch ? '♻ Restore Game' : '🗄 Archive Game';
      _ab.title = _isArch
        ? 'Bring this game back into the main list. Nothing was lost while it was archived.'
        : 'Put this game away. Everything is kept — the world, the players, every report, the statistics and the Hall-of-Fame record — it simply leaves the main list and the auto-turn watcher stops watching it.';
    }
  }
  const thePlayersCount =
    game.status === 'setup'
      ? `${String(joined)}/${String(humanCap)} human${humanCap !== 1 ? 's' : ''}${plannedBots ? ` · ${String(plannedBots)} bot${plannedBots !== 1 ? 's' : ''}` : ''} · sea ${String(seaPctOf(game))}%`
      : `${String(joined)} human${joined !== 1 ? 's' : ''}${existingBots ? ` · ${String(existingBots)} bot${existingBots !== 1 ? 's' : ''}` : ''} / ${String(maxP)}`;
  theElementWithTheId('detail-player-count', HTMLElement).textContent = thePlayersCount;

  // Player slots (bots labelled for the GM; they stay hidden from players elsewhere)
  const slotsHtml = currentGamePlayers.map((p) => {
    const bot = isBotRow(p);
    const statusPill = bot
      ? kcHtml`<span class="pill pill-green">🤖 Bot</span>`
      : p.user_id
        ? kcHtml`<span class="pill pill-green">Joined</span>`
        : kcHtml`<span class="pill pill-amber">Waiting</span>`;
    // Remove-player control (2026-09-26, Toby item 4). Available at EVERY stage: in setup the slot
    // simply reopens; in a live game the realm concedes and plays no further part.
    const _con = game.status !== 'setup' && realmConcededIn(game, p.player_index);
    const _rmLabel = game.status === 'setup' ? 'Remove player' : 'Remove player (realm concedes)';
    return kcHtml`
    <div class="player-slot">
      <div class="slot-name">${bot ? '🤖 ' : ''}${p.display_name || '(slot open)'}</div>
      <div class="slot-status">${statusPill}</div>
      ${_con ? kcHtml`<span class="pill pill-red">🏳 Conceded</span>` : ''}
      ${p.orders_submitted && !bot ? kcHtml`<span class="pill pill-blue">Orders in</span>` : ''}
      ${!p.user_id && !bot && p.invite_code ? kcHtml`<div class="slot-code">Invite: ${p.invite_code}</div>` : ''}
      <button class="btn btn-ghost" style="color:#8a1010;border-color:#8a1010;font-size:.62rem;padding:4px 9px" title="${_rmLabel}" onclick="removePlayer(${kcArg(p.id)})">✖ Remove</button>
    </div>`;
  });

  // Reserved bot slots (setup only — the actual bot rows are created when Turn 0 runs)
  const reservedBotHtml = Array(reservedBots)
    .fill(0)
    .map(
      () => kcHtml`
    <div class="player-slot" style="opacity:.7">
      <div class="slot-name">🤖 Bot realm</div>
      <div class="slot-status"><span class="pill pill-amber">Generated at Turn 0</span></div>
    </div>`,
    );

  // Open human slots (setup only)
  const openHuman = game.status === 'setup' ? Math.max(0, humanCap - joined) : 0;
  const emptySlotsHtml = Array(openHuman)
    .fill(0)
    .map(
      () => kcHtml`
    <div class="player-slot" style="opacity:.5">
      <div class="slot-name">(open slot)</div>
      <div class="slot-status">Waiting for player</div>
    </div>`,
    );

  const theSlots = String(kcHtml`${slotsHtml}${reservedBotHtml}${emptySlotsHtml}`);
  theElementWithTheId('detail-players-list', HTMLElement).innerHTML = theSlots;

  // Visibility / invites panel (setup phase only — visibility is dropped once a game goes active).
  const _visWrap = document.getElementById('detail-visibility-wrap');
  if (_visWrap) {
    if (game.status !== 'setup') {
      _visWrap.innerHTML = '';
    } else {
      const vis = gameVisibility(game);
      if (!vis.private) {
        _visWrap.innerHTML = `<div class="msg-info" style="margin:0">🌍 <strong>Public game</strong> — any registered player can see and join it.</div>`;
      } else {
        // Names need the profile cache; load it (best-effort) so we can show who's invited.
        let namesHtml: KcSafeHtml | KcSafeHtml[];
        try {
          await loadInvitablePlayers();
          const names = invitedNames(vis.invited);
          namesHtml = names.length
            ? names.map((n) => kcHtml`<span class="pill pill-blue" style="margin:2px 4px 2px 0">${n || ''}</span>`)
            : kcHtml`<span style="color:#c88">nobody invited yet — no one can join</span>`;
        } catch (e) {
          namesHtml = kcHtml`<span style="color:#c88">${vis.invited.length} invited (couldn't load names: ${theField(e, 'message')})</span>`;
        }
        _visWrap.innerHTML =
          String(kcHtml`<div style="border:1px solid var(--gold);border-radius:4px;padding:10px;background:#20160c">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
            <span style="color:var(--parchment);font-weight:600">🔒 Private game</span>
            <span style="color:var(--stone);font-size:.8rem">— only the players below can see and join it.</span>
            <button class="btn btn-gold" style="margin-left:auto;font-size:.72rem;padding:4px 10px" onclick="openEditInvites()">✎ Edit invited players</button>
          </div>
          <div>${namesHtml}</div>
        </div>`);
      }
    }
  }

  renderTurnModePanel(game); // manual / auto / deadline switcher (setup and active)

  // Turn 0: show run button when enough realms (humans + planned bots) exist
  if (game.status === 'setup' && joined + plannedBots >= 2) {
    theElementWithTheId('detail-run-turn0-wrap', HTMLElement).style.display = 'block';
  }

  // Active game: show orders + GM order entry
  if (game.status === 'active') {
    theElementWithTheId('detail-orders-card', HTMLElement).style.display = 'block';
    renderOrdersStatus(game);
  }

  // Log
  if (game.turn > 0) {
    theElementWithTheId('detail-log-card', HTMLElement).style.display = 'block';
    void loadTurnLog(game.id, game.turn - 1);
  }
}

export function renderOrdersStatus(game: AGamesRowAsItsSettingsAreRead) {
  const players = theRealmsOfTheGameOpen().filter((p) => p.user_id);
  const bots = theRealmsOfTheGameOpen().filter(isBotRow);
  // Bots are auto-satisfied (Phase 1: they submit no orders and default to Defend). The run button
  // shows once every non-exempt HUMAN has submitted — conceded / extinguished realms are never
  // waited on — and in an all-bot game (0 humans) it shows immediately.
  const humansAllIn = ordersWaitingOn(players, game).length === 0;
  const allIn = humansAllIn && players.length + bots.length > 0;
  const _tm = turnModeOf(game);
  const _tmLine =
    _tm.mode === 'manual'
      ? ''
      : kcHtml`<div class="msg-info" style="margin-bottom:8px">${turnModeSummary(_tm)} — ${_tm.mode === 'auto' ? "the watcher runs the turn as soon as every realm's orders are in." : "the watcher runs the turn when every realm's orders are in, or at the deadline."}</div>`;

  const theOrdersStatus = String(kcHtml`${_tmLine}
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">
      ${players.map((p) => {
        const ex = realmExemptIn(game, p.player_index);
        return kcHtml`<div style="padding:5px 12px;border-radius:2px;font-size:.8rem;
        background:${p.orders_submitted ? '#d4edda' : ex ? '#eae3d2' : '#fff3cd'};
        border:1px solid ${p.orders_submitted ? '#28a745' : ex ? '#c9bd9e' : '#ffc107'}">
        ${p.display_name}: ${p.orders_submitted ? '✓ Orders submitted' : ex ? '— exempt (conceded / no realm)' : '⏳ Awaiting orders'}
      </div>`;
      })}
      ${bots.map(
        (b) => kcHtml`<div style="padding:5px 12px;border-radius:2px;font-size:.8rem;
        background:#eae3d2;border:1px solid #c9bd9e">
        🤖 ${b.display_name}: auto
      </div>`,
      )}
    </div>`);
  theElementWithTheId('detail-orders-status', HTMLElement).innerHTML = theOrdersStatus;

  // Master GM mode (P0-32g): the Overlord may run any game's turn now, in any turn mode, orders in or not (to rescue
  // a game whose GM is away). If the game's own GM tab resolves the same turn, the conditional save lets only one win.
  theElementWithTheId('detail-run-turn-btn', HTMLElement).innerHTML = _kcOverlord
    ? '⚡ Run turn now'
    : '⚡ Resolve Turn &amp; Generate New Reports';
  theElementWithTheId('detail-run-now-note', HTMLElement).style.display = _kcOverlord ? 'block' : 'none';
  if (allIn || _kcOverlord) {
    theElementWithTheId('detail-run-turn-wrap', HTMLElement).style.display = 'block';
  }
}
export async function saveEditInvites() {
  const msg = document.getElementById('edit-invite-msg');
  if (!currentGame) {
    closeEditInvites();
    return;
  }
  const invited = [..._editInviteSelected];
  // Merge into the existing setup config (keep mapSize/botCount/allBot etc. intact).
  let cfg: unknown;
  try {
    cfg =
      typeof currentGame.game_state === 'string'
        ? JSON.parse(currentGame.game_state)
        : thisOrElse(currentGame.game_state, {});
  } catch {
    cfg = {};
  }
  Reflect.set(theStateToWriteOn(cfg, 'visibility'), 'visibility', 'private');
  Reflect.set(theStateToWriteOn(cfg, 'invited'), 'invited', invited);
  if (msg) msg.innerHTML = '<span style="color:var(--stone)">Saving…</span>';
  const { error } = await thePagesDb.theGameMastersGames.changeThisGame(currentGame.id, {
    game_state: JSON.stringify(cfg),
    ...metaPatch(cfg),
  });
  if (error) {
    if (msg) msg.innerHTML = String(kcHtml`<span style="color:#e88">${error.message}</span>`);
    return;
  }
  const theGame = theGameOpenNow("set properties of null (setting 'game_state')");
  theGame.game_state = JSON.stringify(cfg);
  Object.assign(theGame, metaPatch(cfg)); // keep the in-memory copy fresh
  closeEditInvites();
  void openGame(theGame.id); // re-render the detail with the updated invite list
}
// ── GM: REMOVE A PLAYER FROM A GAME (2026-09-26, Toby item 4) ────
// Available at every stage. In SETUP the row is simply deleted and the slot reopens (join assigns
// the lowest free player_index, so the gap is filled by the next player to sign up). In a LIVE game
// the realm CONCEDES first — the engine's existing concession machinery then holds every one of its
// characters on Defend for the rest of the game, stops it making declarations or claims, excludes
// it from the victory count and never waits on its orders — and only then is the seat deleted, so
// the removed player can no longer reach the game at all. The realm's provinces, armies and
// characters stay on the map exactly as they were; they simply never advance again.
export async function removePlayer(gamePlayerId: string) {
  if (!currentGame) return;
  const row = (currentGamePlayers ?? []).find((p) => p.id === gamePlayerId);
  if (!row) {
    return;
  }
  const msg = document.getElementById('detail-msg');
  const who = row.display_name || `Realm ${String(row.player_index + 1)}`;
  const live = currentGame.status !== 'setup';
  const warn = live
    ? `Remove ${who} from "${currentGame.name}"?\n\nTheir realm CONCEDES the game immediately: every one of its characters will do nothing but Defend from now on, it can make no declarations and cannot win, and it is never waited on for orders. Its lands and armies stay on the map.\n\nThe player loses access to this game. This cannot be undone.`
    : `Remove ${who} from "${currentGame.name}"?\n\nThe game has not started, so their slot simply reopens for another player. This cannot be undone.`;
  if (!confirm(warn)) return;
  theElementFound(msg).innerHTML = '<div class="msg-info">Removing player…</div>';
  try {
    if (live) {
      const gs = parseGameState(currentGame);
      const pl = theField(thisOrElse(gs ? theField(gs, 'players') : gs, []), row.player_index);
      if (pl && !theField(pl, 'conceded')) {
        const theRealm = theStateToWriteOn(pl, 'conceded');
        Reflect.set(theRealm, 'conceded', true);
        Reflect.set(theRealm, 'concededTurn', currentGame.turn);
        Reflect.set(theRealm, '_gmRemoved', true);
        // a realm was found among its players, so the state is an object
        const theState = theStateToWriteOn(gs, '_gmRemovedRealms');
        const removed: unknown = Reflect.get(theState, '_gmRemovedRealms');
        Reflect.set(theState, '_gmRemovedRealms', isAList(removed) ? removed : []);
        const theRemoved: unknown = Reflect.get(theState, '_gmRemovedRealms');
        if (Array.isArray(theRemoved) && !theRemoved.includes(row.player_index)) theRemoved.push(row.player_index);
        const { error: sErr } = await thePagesDb.theGameMastersGames.changeThisGame(currentGame.id, {
          game_state: JSON.stringify(gs),
          ...metaPatch(gs),
        });
        if (sErr) {
          theElementFound(msg).innerHTML = String(
            kcHtml`<div class="msg-error">Could not record the concession: ${sErr.message}</div>`,
          );
          return;
        }
        const theGame = theGameOpenNow("set properties of null (setting 'game_state')");
        theGame.game_state = JSON.stringify(gs);
        Object.assign(theGame, metaPatch(gs));
      }
    }
    const { error } = await thePagesDb.theGameMastersRealms.removeThisRealm(row.id);
    if (error) {
      theElementFound(msg).innerHTML = String(kcHtml`<div class="msg-error">${error.message}</div>`);
      return;
    }
    theElementFound(msg).innerHTML = String(
      kcHtml`<div class="msg-success">${who} has been removed${live ? ' — their realm has conceded and will only defend from here on.' : ' and their slot is open again.'}</div>`,
    );
    await openGame(theGameOpenNow("read properties of null (reading 'id')").id);
    const _m2 = document.getElementById('detail-msg'); // openGame clears the panel — say it again
    if (_m2)
      _m2.innerHTML = String(
        kcHtml`<div class="msg-success">${who} has been removed${live ? ' — their realm has conceded and will only defend from here on.' : ' and their slot is open again.'}</div>`,
      );
  } catch (e) {
    theElementFound(msg).innerHTML = String(
      kcHtml`<div class="msg-error">${thisOrElse(theField(e, 'message'), 'Could not remove the player.')}</div>`,
    );
  }
}
export async function saveTurnMode() {
  const msg = document.getElementById('detail-turnmode-msg');
  if (!currentGame) return;
  const prev = turnModeOf(currentGame);
  const tm = readTurnModeForm('detail');
  // Reset the clock from now whenever the deadline settings change (or a deadline is first set).
  if (tm.mode === 'deadline') {
    const changed =
      prev.mode !== 'deadline' || prev.time !== tm.time || prev.everyDays !== tm.everyDays || !prev.nextDeadlineAt;
    tm.nextDeadlineAt = changed ? computeNextDeadline(tm, new Date()) : prev.nextDeadlineAt;
  } else tm.nextDeadlineAt = null;
  tm.turnRanAt = thisOrElse(prev.turnRanAt, null);
  const gs = parseGameState(currentGame);
  Reflect.set(theStateToWriteOn(gs, 'turnMode'), 'turnMode', tm);
  if (msg) msg.innerHTML = '<span style="color:var(--stone)">Saving…</span>';
  // Optimistic-concurrency guard: refuse to overwrite a state the watcher (in another tab) has just
  // advanced.
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
  const theGame = theGameOpenNow("set properties of null (setting 'game_state')");
  theGame.game_state = JSON.stringify(gs);
  Object.assign(theGame, metaPatch(gs));
  if (msg) msg.innerHTML = '<span style="color:#8c8">Saved.</span>';
  renderTurnModePanel(theGame);
  if (theGame.status === 'active') renderOrdersStatus(theGame);
}
