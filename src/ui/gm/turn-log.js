import { kcHtml } from '../shared/kc-safe.js';
import { KC_PHASE_COLORS, KC_PHASE_NAMES } from '../../content/kingdoms-call-data.js';
import { sb } from './config.js';
import { show } from './sign-in.js';
import { loadGames } from './game-list.js';
import { parseGameState } from '../../db/game-meta.js';

export async function loadTurnLog(gameId, turn) {
  const { data } = await sb.from('turn_logs').select('*').eq('game_id', gameId).eq('turn', turn).eq('player_index', -1);
  const el = document.getElementById('detail-log');
  if (!data || data.length === 0) {
    el.innerHTML = '<div style="color:#3a3224;font-size:.85rem;font-style:italic">No log entries yet.</div>';
    return;
  }

  const allEntries = data.flatMap((d) => d.entries || []);
  // 2026-09-25: game_state arrives from Supabase as a JSON STRING; reading .characters off it gave
  // an empty roster, so every character section was dropped and the GM's Last Turn Chronicle showed
  // only the Intelligence block ("No entries." when there was none). Parse it like everywhere else.
  const gameState = parseGameState(currentGame);
  const allChars = gameState?.characters || [];
  const allPlayers = gameState?.players || [];

  // index 5 = End of Turn, matching the player portal.
  const PHASE_NAMES = KC_PHASE_NAMES.slice();
  const PHASE_COLORS = KC_PHASE_COLORS.slice();

  function renderEntry(e) {
    const raw0 = e.text || '';
    if (raw0.startsWith('⚑FORCE⚑')) {
      try {
        const f = JSON.parse(raw0.slice(7));
        const col = f.neutral ? '#555' : f.color || '#555';
        const rows = (f.armies || []).length
          ? f.armies.map(
              (a) =>
                kcHtml`<div style="padding-left:14px;font-size:.78rem">• ${a.unitName ? a.unitName + ' — ' : ''}${a.quality} ${a.type}</div>`,
            )
          : kcHtml`<div style="padding-left:14px;font-size:.78rem;opacity:.7">— no armies —</div>`;
        return kcHtml`<div class="log-entry combat" style="border-left:4px solid var(--crimson);background:#fdf0f0;padding:4px 8px;margin-top:4px"><div style="font-weight:600">⚔ <span style="color:${col}">${f.name}</span> ${f.verb || ''}:</div>${rows}</div>`;
      } catch (_) {
        /* fall through */
      }
    }
    // Narrative is shown as text, then each **bold** run becomes <strong> (the engine writes no markup into it).
    const text = kcHtml`${raw0.split(/\*\*(.+?)\*\*/).map((s, i) => (i % 2 ? kcHtml`<strong>${s}</strong>` : s))}`;
    const isStat = raw0.startsWith('📊');
    const isBattle = raw0.startsWith('⚔') || raw0.startsWith('⚠');
    if (isStat)
      return kcHtml`<div class="log-entry stat" style="font-size:.78rem;color:#231e16;padding:2px 6px;background:#f5f0e8${/│/.test(raw0) ? ';font-family:monospace;white-space:pre;overflow-x:auto' : ''}">${text}</div>`;
    if (isBattle)
      return kcHtml`<div class="log-entry combat" style="border-left:4px solid var(--crimson);background:#fdf0f0;padding:4px 8px;margin-top:4px;font-weight:600">${text}</div>`;
    return kcHtml`<div class="log-entry ${e.type || ''}" style="padding:2px 6px">${text}</div>`;
  }

  function phaseHeader(ph) {
    return kcHtml`<div style="font-family:'Cinzel',serif;font-size:.68rem;color:${PHASE_COLORS[ph]};
      text-transform:uppercase;letter-spacing:.1em;padding:3px 8px;
      border-bottom:1px dotted #ddd;margin:6px 0 3px;
      display:flex;align-items:center;gap:5px">
      <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${PHASE_COLORS[ph]}"></span>
      ${PHASE_NAMES[ph]}
    </div>`;
  }

  // Group entries: by character (charId) → phase; then system by phase; then intel by phase
  const charGroups = {}; // charId → {name, player, isKing, phases:[[],...x6]} ([5] = End of Turn)
  const intelByPhase = { 0: [], 1: [], 2: [], 3: [], 4: [], 99: [] };
  const charIds = new Set(allChars.map((c) => c.id));

  // Build char groups keyed by charId, king first
  [...allChars]
    .sort((a, b) => (b.isKing ? 1 : 0) - (a.isKing ? 1 : 0))
    .forEach((c) => {
      charGroups[c.id] = {
        id: c.id,
        name: c.name,
        isKing: c.isKing,
        player: c.player,
        phases: [[], [], [], [], [], []],
      }; // [5] = End of Turn
    });

  allEntries.forEach((e) => {
    const ph = e.phase != null && e.phase >= 0 && e.phase <= 4 ? e.phase : 99;
    const isIntel = (e.text || '').startsWith('[Intelligence]') || (e.text || '').startsWith('[Intel]');
    // Route to a character section by charId, or via charIds.
    const _secCharId =
      e.charId != null && charGroups[e.charId]
        ? e.charId
        : Array.isArray(e.charIds)
          ? e.charIds.find((id) => charGroups[id])
          : undefined;
    if (isIntel) {
      (intelByPhase[ph] = intelByPhase[ph] || []).push(e);
    } else if (_secCharId != null && _secCharId !== undefined) {
      charGroups[_secCharId].phases[ph >= 0 && ph <= 4 ? ph : 5].push(e);
    } // unphased → End of Turn, never Spring
    // else: realm-level (no-character) lines are not shown in the GM chronicle
  });

  const html = [];

  // Group characters by player for GM view
  const playerGroups = {};
  Object.values(charGroups).forEach((cg) => {
    const pi = cg.player ?? 'unowned';
    if (!playerGroups[pi]) playerGroups[pi] = [];
    playerGroups[pi].push(cg);
  });

  Object.entries(playerGroups).forEach(([pi, chars]) => {
    const player = allPlayers[pi] || { name: `Player ${pi}` };
    const accentColor = pi === 'unowned' ? '#888' : 'var(--crimson)';
    html.push(kcHtml`<div style="margin-bottom:6px;font-family:Cinzel,serif;font-size:.78rem;color:#fff;
      padding:5px 10px;background:${accentColor};border-radius:2px 2px 0 0;letter-spacing:.04em">
      👑 ${player.name || 'Unknown'}
    </div>`);

    chars.forEach((cg) => {
      const hasAny = cg.phases.some((ph) => ph.length > 0);
      if (!hasAny) return;
      html.push(kcHtml`<div style="margin-bottom:14px;border:1px solid ${cg.isKing ? 'var(--crimson)' : 'var(--stone)'};border-radius:0 0 3px 3px;overflow:hidden">
        <div style="font-family:'Cinzel',serif;font-size:.82rem;color:#fff;
          padding:5px 10px;background:${cg.isKing ? 'var(--crimson)' : 'var(--forest)'};
          display:flex;align-items:center;gap:6px">
          ${cg.isKing ? '👑' : '⚔'} ${cg.name}
        </div>
        <div style="padding:4px 6px">`);
      cg.phases.forEach((entries, ph) => {
        if (!entries.length) return;
        html.push(phaseHeader(ph));
        entries.forEach((e) => {
          html.push(renderEntry(e));
        });
      });
      html.push(kcHtml`</div></div>`);
    });
  });

  // Intel
  const hasIntel = Object.values(intelByPhase).some((a) => a.length > 0);
  if (hasIntel) {
    html.push(kcHtml`<div style="margin-bottom:14px;border:1px solid #c8922a;border-radius:3px;overflow:hidden">
      <div style="font-family:'Cinzel',serif;font-size:.82rem;color:#fff;padding:5px 10px;background:#c8922a;display:flex;align-items:center;gap:6px">👁 Intelligence</div>
      <div style="padding:4px 6px">`);
    [0, 1, 2, 3, 4, 99].forEach((ph) => {
      if (!(intelByPhase[ph] || []).length) return;
      if (ph < 5) html.push(phaseHeader(ph));
      (intelByPhase[ph] || []).forEach((e) => {
        html.push(renderEntry(e));
      });
    });
    html.push(kcHtml`</div></div>`);
  }

  el.innerHTML = html.length ? kcHtml`${html}` : '<div style="color:#3a3224;font-size:.85rem">No entries.</div>';
}

// ── DELETE GAME ────
// 2026-09-27 (Toby item 1): a delete now really is a delete. The telemetry tables and the
// Hall-of-Fame row key off `game_id` as plain text with no foreign key, so before this they
// SURVIVED the games row — a deleted game went on being counted in the Stats tab and went on
// showing on the leaderboard for ever, with no way to reach it. All four are purged here. If you
// want the game kept but out of the way, use Archive instead.
export async function deleteGame(gameId) {
  if (
    !confirm(
      'Delete this game permanently?\n\nThe world, the players, every turn report and dispatch, all recorded statistics AND its Hall-of-Fame leaderboard entry are destroyed. This cannot be undone.\n\nTo keep the game but take it out of your list, cancel and use Archive instead.',
    )
  )
    return;
  const msg = document.getElementById('detail-msg');
  msg.innerHTML = '<div class="msg-info">Deleting…</div>';
  // Delete players first (cascade should handle it, but be explicit)
  await sb.from('turn_logs').delete().eq('game_id', gameId);
  // Dispatches BEFORE the games row: the delete policy on game_messages checks that the caller is the
  // GM of a game with this id, so once the games row is gone nobody can remove them any more.
  if (_kcHasMsg) {
    try {
      await sb.from('game_messages').delete().eq('game_id', String(gameId));
      await sb.from('game_message_reads').delete().eq('game_id', String(gameId));
    } catch (e) {
      console.warn('dispatch cleanup:', e);
    }
  }
  // Telemetry + Hall of Fame — same reason, and the game_records write policy checks the games row
  // exists, so this must happen while it still does.
  if (_kcHasTel) {
    try {
      await sb.from('turn_events').delete().eq('game_id', String(gameId));
      await sb.from('game_results').delete().eq('game_id', String(gameId));
    } catch (e) {
      console.warn('telemetry cleanup:', e);
    }
  }
  if (_kcHasLb) {
    try {
      await sb.from('game_records').delete().eq('game_id', String(gameId));
    } catch (e) {
      console.warn('leaderboard cleanup:', e);
    }
  }
  await sb.from('game_players').delete().eq('game_id', gameId);
  const { error } = await sb.from('games').delete().eq('id', gameId);
  if (error) {
    msg.innerHTML = kcHtml`<div class="msg-error">${error.message}</div>`;
    return;
  }
  show('sec-games');
  loadGames();
}
