// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { TITLE_DEFS } from '../content/kingdoms-call-data.ts';
import { KC_BUILD_STAMP } from '../ui/gm/startup.ts';
import { sb } from '../ui/gm/config.ts';
import { KC_TEL_V, parseGameState, renderTelemetryBanner } from './game-meta.ts';
import { writeGameRecord } from '../ui/gm/hall-of-fame.ts';
import { isBotRow } from '../engine/bots/setup.ts';
import { gameMetaOf } from '../engine/rules-on-plain-values/a-games-settings-read-from-its-row.ts';
import { computeStandings } from '../engine/titles/reckoning.ts';
import { telRealmSnapshot } from '../engine/turn/log-line-helpers.ts';

// Final standings order: score, then tax base, then treasury (the Reckoning tie-break).
export function telRankOrder(gs) {
  const s = computeStandings(gs);
  const idx = s.standings.map((st) => st.index);
  idx.sort(
    (a, b) =>
      s.standings[b].score - s.standings[a].score ||
      (s.taxByPlayer[b] || 0) - (s.taxByPlayer[a] || 0) ||
      (s.goldByPlayer[b] || 0) - (s.goldByPlayer[a] || 0),
  );
  const rank = {};
  idx.forEach((pi, i) => {
    rank[pi] = i + 1;
  });
  return { rank, standings: s };
}
export function telBotDifficultyOf(gs) {
  return (gs && gs.botDifficulty) || 'hard';
} // 2026-09-26: 'hard' is the only strength now; older saves keep whatever word they carry
// One game_results row per realm, from a FINISHED state (gs.gameOver set). `players` = game_players rows.
export function buildGameResultRows(gs, gameRow, players) {
  if (!gs || !gs.players) return [];
  const bots = new Set((players || []).filter(isBotRow).map((p) => p.player_index));
  const { rank } = telRankOrder(gs);
  const go = gs.gameOver || {};
  const victory = go.byReckoning
    ? 'reckoning'
    : go.byElimination
      ? 'elimination'
      : go.byConcession
        ? 'concession'
        : gs.gameOver
          ? 'other'
          : 'unfinished';
  const setup = {
    mapSize: gs.mapSize || (gameMetaOf(gameRow) || {}).mapSize || null,
    cols: gs.world && gs.world.cols,
    rows: gs.world && gs.world.rows,
    seaPct: gs.seaPct != null ? gs.seaPct : gs.world && gs.world.seaPct,
    realms: gs.players.length,
    bots: bots.size,
    humans: gs.players.length - bots.size,
    difficulty: telBotDifficultyOf(gs),
    diplomacy: gs.botDiplomacy === 'hostile' ? 'hostile' : 'normal',
  };
  return gs.players
    .map((pl, pi) => {
      if (!pl) return null;
      const snap = telRealmSnapshot(gs, pi);
      let outTurn = null,
        outHow = null;
      if (pl.conceded) {
        outTurn = pl.concededTurn || null;
        outHow = 'conceded';
      } else if (pl._eliminated) {
        outTurn = pl._eliminatedTurn || null;
        outHow = 'eliminated';
      }
      return {
        game_id: String(gameRow.id),
        game_name: gameRow.name || null,
        player_index: pi,
        is_bot: bots.has(pi),
        bot_difficulty: bots.has(pi) ? telBotDifficultyOf(gs) : null,
        realm: pl.name || null,
        race: pl.race || null,
        alignment: pl.alignment || null,
        rank: rank[pi] || null,
        score: Math.round(((gs.gameOver && gs.gameOver.standings) || []).find((s) => s && s.index === pi)?.score ?? 0),
        winner: go.winner === pi,
        victory,
        turns: go.turn || gs.turn || 0,
        out_turn: outTurn,
        out_how: outHow,
        setup,
        final: snap,
        build: `GM ${KC_BUILD_STAMP} tel${KC_TEL_V}`,
      };
    })
    .filter(Boolean);
}
// Record the results of a finished game (idempotent — upsert on game_id + player_index).
export async function writeGameResults(gs, gameRow, players) {
  if (!_kcHasTel) return false;
  const rows = buildGameResultRows(gs, gameRow, players);
  if (!rows.length) return false;
  const { error } = await sb.from('game_results').upsert(rows, { onConflict: 'game_id,player_index' });
  if (error) {
    _kcTelLastErr = error.message;
    renderTelemetryBanner();
    return false;
  }
  return true;
}
// One-off / repair: any of this GM's COMPLETE games with no game_results rows gets them now.
export async function backfillGameResults() {
  if (!_kcHasTel || !currentUser) return 0;
  try {
    const { data: games, error } = await sb
      .from('games')
      .select('id,name,status')
      .eq('gm_user_id', currentUser.id)
      .eq('status', 'complete');
    if (error || !games || !games.length) return 0;
    const { data: have } = await sb
      .from('game_results')
      .select('game_id')
      .in(
        'game_id',
        games.map((g) => String(g.id)),
      );
    const done = new Set((have || []).map((r) => r.game_id));
    let n = 0;
    for (const g of games) {
      if (done.has(String(g.id))) continue;
      const { data: full } = await sb
        .from('games')
        .select('id,name,game_state,game_players(*)')
        .eq('id', g.id)
        .single();
      if (!full) continue;
      const gs = parseGameState(full);
      if (!gs || !gs.players) continue;
      if (await writeGameResults(gs, full, full.game_players || [])) n++;
    }
    if (n) console.log(`[telemetry] recorded results for ${n} finished game(s)`);
    return n;
  } catch (e) {
    return 0;
  }
}
// The per-realm view of what the collectors caught this turn, plus the before/after deltas.
export function telOutcomesFor(gs, pi, tel, pre, post, rank) {
  const B = (tel.battles || []).filter((b) => b.atkPi === pi || b.defPi === pi);
  const mine = (b) => b.atkPi === pi;
  const battles = {
    fought: B.length,
    asAttacker: B.filter(mine).length,
    won: B.filter((b) => (mine(b) ? b.won : !b.won)).length,
    unitsLost: B.reduce((s, b) => s + (mine(b) ? b.atkLost : b.defLost), 0),
    unitsKilled: B.reduce((s, b) => s + (mine(b) ? b.defLost : b.atkLost), 0),
    list: B.map((b) => ({ ...b, side: mine(b) ? 'atk' : 'def', win: mine(b) ? b.won : !b.won })),
  };
  const E = (tel.encounters || []).filter((e) => e.pi === pi);
  const encounters = {
    fought: E.length,
    won: E.filter((e) => e.won).length,
    fled: E.filter((e) => e.fled).length,
    heroKilled: E.filter((e) => e.killed).length,
    list: E,
  };
  const C = (tel.captures || []).filter((c) => c.from === pi || c.to === pi);
  const captures = {
    gained: C.filter((c) => c.to === pi).length,
    lost: C.filter((c) => c.from === pi).length,
    list: C,
  };
  const D = (tel.deaths || []).filter((d) => d.pi === pi || d.killerPi === pi);
  const deaths = {
    own: D.filter((d) => d.pi === pi).length,
    king: D.some((d) => d.pi === pi && d.king),
    killed: D.filter((d) => d.killerPi === pi && d.pi !== pi).length,
    list: D,
  };
  const S = (tel.spells || []).filter((x) => x.pi === pi);
  const spells = { cast: S.length, ok: S.filter((x) => x.ok).length, list: S };
  // (ideas round 4) the companies the realm recruited or hired this turn, by class
  const R = (tel.recruits || []).filter((x) => x.pi === pi);
  const recruits = {
    count: R.length,
    creatures: R.filter((x) => x.cls === 'creature').length,
    monsters: R.filter((x) => x.cls === 'monster').length,
  };
  const d = (k) => (post && pre && post[k] != null && pre[k] != null ? post[k] - pre[k] : null);
  return {
    battles,
    encounters,
    captures,
    deaths,
    spells,
    recruits,
    delta: {
      gold: d('gold'),
      provinces: d('provinces'),
      tax: d('tax'),
      units: d('units'),
      str: d('str'),
      heroes: d('heroes'),
      items: d('items'),
      discoveries: d('discoveries'),
      explored: d('explored'),
    },
    rank: rank || null,
    score: post && post._score != null ? post._score : null,
  };
}
export async function writeTurnTelemetry(gs, gameRow, players, tel, turn) {
  if (!_kcHasTel || !gs || !gs.players) return false;
  const bots = new Set((players || []).filter(isBotRow).map((p) => p.player_index));
  const { rank, standings } = telRankOrder(gs);
  const rows = [];
  gs.players.forEach((pl, pi) => {
    if (!pl) return;
    const post = telRealmSnapshot(gs, pi);
    if (post) post._score = (standings.standings[pi] || {}).score || 0;
    // the Imperial Titles this realm holds now (2026-10-09, Toby item 5) — the Hall of Fame keeps the
    // highest rating each holder reached, not only the holders at the end of the game
    if (post) {
      const held = [];
      (TITLE_DEFS || []).forEach((t) => {
        const h = (standings.titles || {})[t.key];
        if (!h || h.playerIndex !== pi || !(h.merit > 0)) return;
        const ch = h.charId != null ? (gs.characters || []).find((c) => c && c.id === h.charId) : null;
        held.push({ key: t.key, merit: Math.round(h.merit * 100) / 100, who: ch ? ch.name : null });
      });
      if (held.length) post.titles = held;
    }
    const pre = (tel.pre || {})[pi] || null;
    rows.push({
      game_id: String(gameRow.id),
      turn,
      player_index: pi,
      is_bot: bots.has(pi),
      bot_difficulty: bots.has(pi) ? telBotDifficultyOf(gs) : null,
      realm: pl.name || null,
      race: pl.race || null,
      alignment: pl.alignment || null,
      orders: (tel.orders || {})[pi] || null,
      pre,
      post,
      outcomes: telOutcomesFor(gs, pi, tel, pre, post, rank[pi]),
      build: `GM ${KC_BUILD_STAMP} tel${KC_TEL_V}`,
    });
  });
  const { error } = await sb.from('turn_events').upsert(rows, { onConflict: 'game_id,turn,player_index' });
  if (error) {
    _kcTelLastErr = error.message;
    renderTelemetryBanner();
    return false;
  }
  _kcTelLastErr = null;
  if (gs.gameOver) {
    await writeGameResults(gs, gameRow, players);
    try {
      await writeGameRecord(gameRow.id, { gameRow, players, gs });
    } catch (_le) {} // Hall of Fame (2026-09-27)
  }
  return true;
}
