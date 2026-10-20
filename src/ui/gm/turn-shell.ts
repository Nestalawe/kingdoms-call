// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcHtml } from '../shared/kc-safe.ts';
import { kcRng } from '../../engine/rng.ts';
import { kcClock } from '../../engine/clock.ts';
import { sb } from './config.ts';
import { loadGames } from './game-list.ts';
import { openGame } from './game-detail.ts';
import { metaPatch, normalizeTurnMode } from '../../db/game-meta.ts';
import { writeTurnTelemetry } from '../../db/telemetry.ts';
import { computeNextDeadline } from './turn-mode.ts';
import { runningBuildStamp, setAutoTurnStatus } from './auto-turn.ts';
import { resolveTurn } from '../../engine/run-turn.ts';

// ── THE TURN SHELL (plan P1-18d, 2026-10-18) ────
// runTurn runs one turn of a game for the GM: from the Resolve Turn button, or from the auto-turn watcher (auto-turn.ts).
// It does the turn's database and screen work, around the engine's resolveTurn (src/engine/run-turn.ts), in this order:
// confirm, load the game and its slots, check the turn, clear the orders, resolveTurn, save the world (only if the game
// is still on that turn), then buildReports() and write each realm's report, the GM's log and the telemetry. It always
// returns {ok, committed, conflict, error} (and `turn` when it worked); docs/traps.md, "Post-commit work in runTurn".
// Once the turn has started it returns its `seed` too: the turn's dice (P1-18e, "The turn's dice" below).
export async function runTurn(opts) {
  opts = opts || {};
  const auto = !!opts.auto;
  const gameRow = opts.game || currentGame;
  const viewing = !!(currentGame && gameRow && currentGame.id === gameRow.id);
  const _detailMsg = document.getElementById('detail-msg');
  // In auto mode the detail panel may be showing another game (or not at all) — route status to the
  // watcher banner, and mirror it into the detail panel only when the GM is looking at this very
  // game.
  const msg =
    !auto && _detailMsg
      ? _detailMsg
      : {
          _v: '',
          get innerHTML() {
            return this._v;
          },
          set innerHTML(v) {
            this._v = v;
            if (v)
              setAutoTurnStatus(
                kcHtml`<strong>⚙️ Auto-turn watcher</strong> · ${gameRow.name || ''} (${opts.reason || 'auto'})<br>${v}`,
              );
            if (viewing && _detailMsg) _detailMsg.innerHTML = v;
          },
        };

  // Confirm before running — prevent accidental double-runs
  const expectedTurnToRun = gameRow.turn;
  if (
    !auto &&
    !confirm(
      `Run Turn ${expectedTurnToRun}? This will resolve all submitted orders and advance the game. This cannot be undone.`,
    )
  ) {
    msg.innerHTML = '';
    return { ok: false, committed: false, error: 'cancelled' };
  }

  msg.innerHTML = kcHtml`<div class="msg-info">⏳ Loading game state and player orders…</div>`;

  // ── ONE FAILURE PATH (P1-18a, 2026-10-18) ────
  // Everything from the load to the save sits in the one try below, so every failure reaches the one
  // catch at the end of runTurn, and runTurn always RETURNS {ok, committed, conflict, error}: it never
  // throws and never returns nothing. ordersSnapshot is what a failed run may put back; the four flags
  // say how far the run got, which decides whether it may.
  let ordersSnapshot = []; // each submitted row's orders as loaded: what a failed run puts back
  let _ordersCleared = false; // the orders were cleared in the database: a failure before the save restores them
  let _saveSent = false; // the save was sent: a failure from here re-reads the turn before restoring anything
  let _saveConflict = false; // set if the conditional state save finds the turn already advanced elsewhere
  // ── RUNAWAY-TURN GUARD (2026-09-27) ────
  // Set the moment the new world state is committed. Everything after that point — reports,
  // turn_logs, telemetry — is post-commit work, and a throw there must NOT put the orders back:
  // the turn they belonged to has already been resolved and the game has advanced past it.
  // Restoring them re-flagged every realm as "orders in", so the auto-turn watcher ran the NEXT
  // turn a minute later, and the next, and the next — games resolving themselves turn after turn
  // with nobody submitting anything. (The trigger was a TypeError in buildTurnReport: SEA_UNIT_TYPES
  // is a Set and was being called with .includes.)
  let _turnCommitted = false;
  let G;
  let seed = null; // the turn's seed, once drawn (below): returned on success, and from the catch

  try {
    // 1. Load fresh data
    const { data: freshGame, error: gErr } = await sb.from('games').select('*').eq('id', gameRow.id).single();
    const { data: freshPlayers, error: pErr } = await sb.from('game_players').select('*').eq('game_id', gameRow.id);
    if (gErr || pErr || !freshGame) {
      msg.innerHTML = kcHtml`<div class="msg-error">Could not load game: ${gErr?.message || pErr?.message}</div>`;
      return { ok: false, committed: false, error: 'could not load game' };
    }

    // Verify the turn hasn't already advanced (double-run protection)
    if (freshGame.turn !== expectedTurnToRun) {
      msg.innerHTML = kcHtml`<div class="msg-error">⚠ Turn mismatch: expected Turn ${expectedTurnToRun} but game is now on Turn ${freshGame.turn}. The turn may have already been run. Reload the page.</div>`;
      return { ok: false, committed: false, conflict: true, error: 'turn mismatch' };
    }

    // 2a. Snapshot the orders, then clear them in the database — ONCE, here, before the save is upgraded
    // and the orders are merged (P1-18a). The upgrades and the merge below only change this run's copy
    // in memory, so nothing but a failure notices that the clear comes first; and the clear has to come
    // before them, because they are engine work and the engine will run as one step with no database
    // writes inside it (plan step P1-18d). Not after resolution: a second GM tab could then wipe the
    // NEXT turn's orders, every realm would read "orders in" while the turn ran, and a late declaration
    // or concession would be lost.
    // 2026-09-27: the snapshot carries each row's ORIGINAL orders_submitted flag. It used to restore
    // `orders_submitted:true` for every row that held any `orders` value, which promoted a merely
    // SAVED DRAFT into a submitted turn whenever a run failed.
    ordersSnapshot = freshPlayers
      .filter((p) => p.user_id && p.orders)
      .map((p) => ({ id: p.id, orders: p.orders, submitted: !!p.orders_submitted }));
    const { error: clearErr } = await sb
      .from('game_players')
      .update({ orders: null, orders_submitted: false })
      .eq('game_id', gameRow.id);
    if (clearErr) {
      // Nothing was cleared (one update, all or nothing), so nothing needs putting back. Stop before the
      // turn runs: a turn saved over orders still marked "in" would let the watcher run the next turn at
      // once.
      msg.innerHTML = kcHtml`<div class="msg-error">Could not start Turn ${expectedTurnToRun}: the submitted orders could not be cleared (${clearErr.message}). Nothing was changed, and the orders are still in. Try again.</div>`;
      return { ok: false, committed: false, conflict: false, error: 'could not clear orders' };
    }
    _ordersCleared = true;

    // The turn itself (src/engine/run-turn.ts): resolveTurn brings the save up to date, merges the orders and resolves
    // the turn, with no database and no screen. It is synchronous, as the turn always was between the clear and the save.
    const playersWithOrders = freshPlayers.filter((p) => p.user_id && p.orders).length;
    msg.innerHTML = kcHtml`<div class="msg-info">⏳ Loaded orders from ${playersWithOrders} player${playersWithOrders !== 1 ? 's' : ''}. Resolving 5 phases…</div>`;
    msg.innerHTML = kcHtml`<div class="msg-info">⏳ Resolving 5 phases…</div>`;
    // ── THE TURN'S DICE (P1-18e, 2026-10-18; P1-08m, 2026-10-20) ────
    // Each turn plays from its own seed: one number drawn from the page's dice, as a 32-bit integer (kcRngStream reads
    // 0 as 1, so 0 becomes 1 here and the seed returned is the one that played). resolveTurn takes the seed and lends
    // itself the dice made from it (src/engine/run-turn.ts), and lends them again to buildReports(), whose Spy-stealth
    // rolls are the turn's too; it gives the page its own dice back after each, so the turn's are never lent across an
    // await, and nothing else the page runs meanwhile (another game's turn, the watcher) draws from them. runTurn returns
    // the seed.
    seed = Math.floor(kcRng() * 2 ** 32) || 1;
    const resolved = resolveTurn(freshGame.game_state, freshPlayers, expectedTurnToRun, seed);

    // 9. Save updated game state
    msg.innerHTML = kcHtml`<div class="msg-info">⏳ Saving game state…</div>`;
    G = JSON.parse(resolved.state);
    // Turn-running clock: stamp the run and, in deadline mode, schedule the next fixed-clock deadline
    // from now
    // (an early "all orders in" run also resets the clock, so the next deadline is always relative to the last run).
    {
      const _tm = normalizeTurnMode(G.turnMode);
      _tm.turnRanAt = kcClock.date().toISOString();
      _tm.nextDeadlineAt = _tm.mode === 'deadline' ? computeNextDeadline(_tm, kcClock.date()) : null;
      G.turnMode = _tm;
    }
    // Conditional save (.eq turn): if another GM tab / device already advanced this turn, 0 rows
    // match and we abort WITHOUT restoring orders (the other run consumed them) — the double-run
    // guard for automatic modes.
    _saveSent = true;
    const { data: _savedRow, error: saveErr } = await sb
      .from('games')
      .update({
        game_state: JSON.stringify(G),
        ...metaPatch(G),
        turn: G.turn,
        // Victory (#7): no turn limit. The game is complete only when decided by the Reckoning or by
        // elimination (G.gameOver). max_turns is retained only as an optional GM hard-backstop below.
        status:
          G.gameOver || (G.maxTurns && G.maxTurns > 0 && G.turn > G.maxTurns && G.maxTurnsHardStop)
            ? 'complete'
            : 'active',
      })
      .eq('id', gameRow.id)
      .eq('turn', expectedTurnToRun)
      .select('id')
      .maybeSingle();
    if (saveErr) throw new Error(`Error saving: ${saveErr.message}`); // the catch re-reads the turn: an error doesn't prove the save failed
    if (!_savedRow) {
      _saveConflict = true;
      throw new Error(
        `Turn ${expectedTurnToRun} was already run elsewhere (another GM tab or device) — this run was discarded.`,
      );
    }
    _turnCommitted = true; // from here on the turn is resolved and saved: never put the orders back

    // 10. Generate and push new turn reports to each player
    msg.innerHTML = kcHtml`<div class="msg-info">⏳ Generating turn reports…</div>`;
    const { reports, tel } = resolved.buildReports();
    let reportErrors = [];
    for (const { gp, report } of reports) {
      report.engineStamp = typeof runningBuildStamp === 'function' ? runningBuildStamp() : null; // which GM build wrote it: the page's to know, not the engine's
      const { error: rErr } = await sb
        .from('game_players')
        .update({
          turn_report: JSON.stringify(report),
        })
        .eq('id', gp.id);
      if (rErr) reportErrors.push(gp.player_index + ': ' + rErr.message);

      // Save a per-player snapshot of this report so the player portal can render the correct MAP and
      // chronicle for this turn later. Keyed by the RESOLVED turn number (G.turn-1), matching the
      // "Turn N results" the player sees. Stored as a separate turn_logs row
      // (player_index = this player) — the GM full log uses player_index = -1.
      try {
        await sb.from('turn_logs').insert({
          game_id: gameRow.id,
          player_index: gp.player_index,
          turn: G.turn - 1,
          entries: report,
        });
      } catch (snapErr) {
        /* snapshot is best-effort — never block the turn on it */
      }
    }

    // 11. Save full log to turn_logs table
    await sb.from('turn_logs').insert({
      game_id: gameRow.id,
      player_index: -1, // -1 = full GM log
      turn: G.turn - 1,
      entries: resolved.log,
    });

    // 12. TELEMETRY (2026-09-25): one turn_events row per realm, and game_results when the game ended.
    // Best-effort: a failure is shown on the game list, never thrown, and the turn is already saved.
    try {
      await writeTurnTelemetry(tel.gs, gameRow, freshPlayers, tel.collected, G.turn - 1);
    } catch (_te) {
      _kcTelLastErr = (_te && _te.message) || String(_te);
      console.warn('telemetry:', _te);
    }

    // Orders and flags already cleared in step 2a, before the save was upgraded

    if (reportErrors.length > 0) {
      msg.innerHTML = kcHtml`<div class="msg-error">Turn resolved but some reports failed: ${reportErrors.join('; ')}</div>`;
    } else {
      msg.innerHTML = kcHtml`<div class="msg-success">
      ✅ Turn ${G.turn - 1} resolved! New turn reports pushed to ${reports.length} players.<br>
      <strong>Turn ${G.turn} is now open for orders.</strong> 
      ${G.gameOver ? kcHtml`<strong>Game is complete!</strong>` : ''}
    </div>`;
    }
  } catch (e) {
    // Every failure from the load to the save ends here (P1-18a), and only ONE kind puts the orders
    // back. _saveConflict: another tab resolved this turn, nothing here was changed.
    // _turnCommitted: THIS run resolved and saved the turn, then something after the save failed —
    // the turn stands, the orders belonged to it and are spent, and re-arming them would make the
    // auto-turn watcher resolve the following turn on them a minute later (see the runaway-turn
    // guard above). Not yet _ordersCleared: the run stopped before it touched anything. Otherwise:
    // resolution failed before anything was saved, so the orders are genuinely unspent and go back
    // exactly as they were.
    console.error('runTurn error:', e);
    // A save that answered with an error (or never answered) may still have landed: a request can
    // time out after the database committed it. So before anything is put back, read the game's turn
    // again. Moved on: the save went through, the turn counts as committed and its orders stay spent.
    // Can't be read: put nothing back either, since orders restored onto a saved turn would set every
    // realm to "orders in" and the watcher would run the next turn on them at once.
    let _savedAnyway = false,
      _saveUnknown = false;
    if (_saveSent && !_turnCommitted && !_saveConflict) {
      let _turnNow = null;
      try {
        const { data: _g, error: _gErr } = await sb.from('games').select('turn').eq('id', gameRow.id).maybeSingle();
        if (!_gErr && _g) _turnNow = _g.turn;
      } catch (_re) {
        /* unknown: handled below */
      }
      if (_turnNow == null) _saveUnknown = true;
      else if (_turnNow !== expectedTurnToRun) {
        _turnCommitted = true;
        _savedAnyway = true;
      }
    }
    // Restore orders to DB so players don't lose their submissions — unless another run already
    // consumed them, or this run already committed the turn they belonged to.
    let _restoreFailed = false;
    if (_ordersCleared && !_saveConflict && !_turnCommitted && !_saveUnknown && ordersSnapshot.length > 0) {
      try {
        const _res = await Promise.all(
          ordersSnapshot.map((snap) =>
            sb.from('game_players').update({ orders: snap.orders, orders_submitted: snap.submitted }).eq('id', snap.id),
          ),
        );
        _restoreFailed = _res.some((r) => r && r.error);
      } catch (_re) {
        _restoreFailed = true;
      }
    }
    const _why = _saveConflict
      ? 'Nothing was changed by this run.'
      : _savedAnyway
        ? `The save answered with an error, but the game has moved on: Turn ${expectedTurnToRun} WAS saved. The orders for that turn are spent and have not been restored. No turn reports were sent; re-push reports or check the browser console (F12).`
        : _turnCommitted
          ? `Turn ${expectedTurnToRun} WAS resolved and saved — the failure came after the save, while writing reports. The orders for that turn are spent and have not been restored. Players may be missing this turn's report; re-push reports or check the browser console (F12).`
          : _saveUnknown
            ? `The save may or may not have gone through, and the game could not be read again to tell. The orders have NOT been restored, so the turn can't run twice. Reload the page: if the game is on Turn ${expectedTurnToRun + 1}, the turn was saved; if it is still on Turn ${expectedTurnToRun}, ask the players to send their orders again.`
            : !_ordersCleared
              ? 'Nothing was changed by this run.'
              : _restoreFailed
                ? 'Check browser console (F12) for full details. The orders could NOT all be restored: ask the players to send theirs again.'
                : 'Check browser console (F12) for full details. Your orders have been restored.';
    msg.innerHTML = kcHtml`<div class="msg-error">⚠ Resolution error: ${e.message}<br><small>${_why}</small></div>`;
    return { ok: false, committed: _turnCommitted, conflict: _saveConflict, error: e.message, seed };
  }

  // Refresh UI (only the game the GM is looking at; a watcher run of another game just refreshes
  // the list)
  if (viewing) {
    currentGame.turn = G.turn;
    currentGame.status = G.gameOver ? 'complete' : 'active';
    setTimeout(() => openGame(currentGame.id), 2000);
  } else if (auto && document.getElementById('sec-games')?.classList.contains('section-active')) {
    loadGames();
  }
  return { ok: true, committed: true, turn: G.turn, seed };
}
