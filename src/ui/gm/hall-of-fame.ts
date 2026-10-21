// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcHtml } from '../shared/kc-safe.ts';
import { KC_UNIT_CLASS, TITLE_DEFS } from '../../content/kingdoms-call-data.ts';
import { kcClock } from '../../engine/clock.ts';
import { KC_BUILD_STAMP } from './startup.ts';
import { GUARDIAN_POWER_RANK, SKILL_LABELS } from '../../engine/army-tables.ts';
import { UNIT_BASE_STR, UNIT_Q_MULT } from '../../engine/rules-on-plain-values/unit-types-and-base-strength.ts';
import { sb } from './config.ts';
import { kcMissingMsg, parseGameState } from '../../db/game-meta.ts';
import { gameMetaOf } from '../../engine/rules-on-plain-values/a-games-settings-read-from-its-row.ts';
import { computeStandings } from '../../engine/titles/reckoning.ts';

// ════════════════════════════════════════════════════════════════════════════════════════════════
// LEADERBOARD & ACHIEVEMENTS (2026-09-27) — the Hall of Fame's one table
// ════════════════════════════════════════════════════════════════════════════════════════════════
// `kingdoms-call-leaderboard.html` is a third page, linked from both portals beside the rulebook.
// It reads ONE table, public.game_records — one small row per FINISHED game — and nothing else.
// Everything on it is precomputed HERE because only the GM portal has what the maths needs: the
// engine's UNIT_BASE_STR / UNIT_Q_MULT (a stored unit is only {type,quality}; its strength has to be
// recomputed), the unit classes, and computeStandings for the Imperial Title merits.
//
// WHY A PRECOMPUTED TABLE and not "the leaderboard reads turn_events". turn_events is 3–10 KB per
// realm per turn; a season of games is tens of MB, and the board would be opened by every player.
// That is the 2026-09-25 Disk-IO fault (DEV_LOG §182) waiting to happen again. One ~12 KB row per
// game is read instead, and the sweep over turn_events happens once, in the GM's tab, when a game
// ends (or when the GM presses Rebuild).
//
// RECORD KEYS. `records` is {key: [{v, d, pi, …context}, …]} — the best entry of EACH REALM in THIS
// game for that key, best first (rows built before lb3 hold one {v, d, …} per key: the game's best);
// the board merges them across games and ranks them. The catalogue of labels and
// categories lives in kingdoms-call-leaderboard.html (KC_ACH). A key emitted here that the board
// does not know is still shown, under "Other records", with the key prettified — so adding a record
// here can never break the board, it only loses a nice label until the catalogue catches up.
export const KC_LB_V = 3; // bump when the row shape changes (rows carry it in build) · 3: records hold every realm's best
// Declared globals (plan P1-09b): one binding the page's files and its tests share (ui/gm/globals.ts says why).
globalThis._kcHasLb = false;
globalThis._kcLbLastErr = null;
export async function probeLeaderboard() {
  try {
    const { error } = await sb.from('game_records').select('game_id').limit(1);
    _kcHasLb = !error;
    if (error) console.warn('game_records probe:', error.message);
  } catch (e) {
    _kcHasLb = false;
  }
  renderLeaderboardBanner();
  return _kcHasLb;
}
export function renderLeaderboardBanner() {
  const el = document.getElementById('msg-leaderboard');
  if (!el) return;
  if (!_kcHasLb) {
    el.innerHTML = kcMissingMsg(
      '🏆 Leaderboard not active',
      kcHtml`<code>game_records</code> table`,
      'finished games are not being added to the Hall of Fame',
    );
  } else if (_kcLbLastErr) {
    el.innerHTML = kcHtml`<div class="msg-error"><strong>🏆 Leaderboard write failed</strong>: ${_kcLbLastErr}. The turn and its statistics were saved; only the Hall-of-Fame row was lost. Use ↻ Rebuild on the Stats tab.</div>`;
  } else el.innerHTML = '';
}

// ── unit maths on a SNAPSHOT unit record ({t:type, q:quality, sk:1 if skeletal}) ──────────────────
export const _LB_SEA = new Set(KC_UNIT_CLASS.sea);
export const _LB_AIR = new Set(KC_UNIT_CLASS.aerial);
export const _LB_BEAST = new Set([...KC_UNIT_CLASS.creature, ...KC_UNIT_CLASS.monster]);
export const _LB_MISSILE = new Set(KC_UNIT_CLASS.missile);
export const _LB_CAV = new Set(KC_UNIT_CLASS.cavalry);
// A snapshot arrives as JSON written by an older build, or by a hook that caught a half-built
// object: every list and map below is defended, because this runs on the turn path.
export const _lbArr = (v) => (Array.isArray(v) ? v : []);
export const _lbObj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
export const _lbN = (v) => {
  const n = Number(v);
  return isFinite(n) ? n : 0;
};
export function lbUnitStr(u) {
  return u && typeof u === 'object' ? (UNIT_BASE_STR[u.t] || 4) * (UNIT_Q_MULT[u.q || 'Average'] || 2) : 0;
}
export function lbSumStr(units, pred) {
  return _lbArr(units).reduce((s, u) => s + (!pred || pred(u) ? lbUnitStr(u) : 0), 0);
}

// ── the record accumulator ───────────────────────────────────────────────────────────────────────
// put(key, value, ctx, dir): keeps the best value of EACH REALM in this game (ctx.pi; the whole-game
// records, pi null, keep one). dir 'min' for records where small wins (an upset, an early
// elimination, a long-shot spell). 2026-10-09 (Toby item 5): it kept only the game's single best, so
// a realm whose best battle was beaten by another realm in the same game had nothing on the board.
// A "most" record of zero is no feat and is not kept. finish() returns {key: [entries, best first]}.
export function lbRecorder() {
  const R = {};
  return {
    R,
    put(key, v, ctx, dir) {
      if (v == null) return;
      v = Number(v);
      if (!isFinite(v)) return;
      const d = dir === 'min' ? 'min' : 'max';
      if (d === 'max' && !(v > 0)) return;
      const pi = ctx && ctx.pi != null ? ctx.pi : null;
      const list = (R[key] = R[key] || []);
      const i = list.findIndex((e) => e.pi === pi);
      if (i >= 0 && !(d === 'min' ? v < list[i].v : v > list[i].v)) return;
      const e = Object.assign({ v: Math.round(v * 100) / 100, d }, ctx || {});
      if (i < 0) list.push(e);
      else list[i] = e;
    },
    finish() {
      Object.values(R).forEach((l) =>
        l.sort(
          (a, b) => (a.d === 'min' ? a.v - b.v : b.v - a.v) || (a.pi == null ? -1 : a.pi) - (b.pi == null ? -1 : b.pi),
        ),
      );
      return R;
    },
  };
}
// A record points at a realm by its INDEX and says when it happened — nothing else. The realm's
// name, race, creed, bot flag and the human behind it all live once, in this game's `standings`,
// and the board resolves them by `pi`. Two reasons: the row is far smaller (no identity repeated
// on 95 records), and a player who later renames themselves is renamed on every record at once,
// because nothing is snapshotted in the record itself.
export function lbCtx(pi, turn, extra) {
  return Object.assign({ pi: pi == null ? null : pi, t: turn == null ? null : turn }, extra || {});
}

// ── THE BUILDER ──────────────────────────────────────────────────────────────────────────────────
// gameRow  : the games row (id, name, created_at) — may be null for a game since deleted
// players  : game_players rows (user_id + display_name; may be [])
// results  : this game's game_results rows (one per realm)
// events   : this game's turn_events rows, each {turn, player_index, is_bot, realm, race, alignment, post, outcomes}
// gs       : the final parsed game_state, when the game still exists — only the Imperial Title
//            merits need it; everything else is built from results + events.
// profNames: {auth user id → profiles.name}, the PEOPLE. See the note below on why this is needed.
//
// REALM ≠ PLAYER (2026-09-27b). `game_players.display_name` is NOT the player's name — the join
// form writes the KINGDOM name into it (`display_name:kingdomName`), and the portal renders it as
// "Your realm: …". The person's own name lives in `profiles.name`, keyed on the auth user id. The
// first cut of this builder took display_name for the player and so printed the realm twice. Each
// standing now carries `uid` (the auth id — stable for ever) and `player` (the name at the time,
// a fallback only); the board keys every player statistic on `uid` and prints the CURRENT name, so
// one person is one line on the leaderboard however many realms they have ruled, and a rename
// rewrites their whole history rather than splitting it in two.
export function buildGameRecords(gameId, gameRow, players, results, events, gs, profNames) {
  results = (results || []).filter(Boolean);
  events = (events || []).filter(Boolean);
  if (!results.length) return null;
  profNames = _lbObj(profNames);
  const uidByIdx = {},
    kingdomByIdx = {};
  (players || []).forEach((p) => {
    if (!p || p.player_index == null) return;
    if (p.user_id) uidByIdx[p.player_index] = p.user_id;
    if (p.display_name) kingdomByIdx[p.player_index] = p.display_name;
  });
  const uidOf = (pi) => uidByIdx[pi] || null;
  const personOf = (pi) => {
    const u = uidOf(pi);
    return (u && profNames[u]) || null;
  };
  const any = results[0];
  const setupIn = _lbObj(any.setup);
  const meta = gameRow ? gameMetaOf(gameRow) : null;
  const setup = {
    realms: setupIn.realms || results.length,
    humans: setupIn.humans != null ? setupIn.humans : results.filter((r) => !r.is_bot).length,
    bots: setupIn.bots != null ? setupIn.bots : results.filter((r) => r.is_bot).length,
    diplomacy: setupIn.diplomacy || (gs && gs.botDiplomacy) || (meta && meta.botDiplomacy) || 'normal',
    difficulty: setupIn.difficulty || (gs && gs.botDifficulty) || (meta && meta.botDifficulty) || null,
    mapSize: setupIn.mapSize || (meta && meta.mapSize) || null,
    cols: setupIn.cols || (gs && gs.world && gs.world.cols) || null,
    rows: setupIn.rows || (gs && gs.world && gs.world.rows) || null,
    seaPct: setupIn.seaPct != null ? setupIn.seaPct : meta && meta.seaPct != null ? meta.seaPct : null,
    maxTurns: (gameRow && gameRow.max_turns) || (gs && gs.maxTurns) || null,
  };
  const turns = any.turns || Math.max(0, ...events.map((e) => e.turn || 0));

  // ── final standings, one entry per realm ───────────────────────────────────────────────────────
  let titleTop = null;
  if (gs && gs.players) {
    try {
      const st = computeStandings(gs);
      titleTop = {};
      TITLE_DEFS.forEach((t) => {
        const h = _lbObj(st.titles)[t.key];
        if (!h || h.playerIndex == null || !(h.merit > 0)) return;
        const ch = h.charId != null ? _lbArr(gs.characters).find((c) => c && c.id === h.charId) : null;
        titleTop[t.key] = {
          name: t.name,
          merit: Math.round(h.merit * 100) / 100,
          pi: h.playerIndex,
          who: ch ? ch.name : null,
        };
      });
    } catch (e) {
      titleTop = null;
    }
  }
  const titlesByPi = {};
  if (titleTop)
    Object.entries(titleTop).forEach(([k, v]) => {
      (titlesByPi[v.pi] = titlesByPi[v.pi] || []).push(k);
    });
  const standings = results
    .slice()
    .sort((a, b) => (a.rank || 99) - (b.rank || 99))
    .map((r) => {
      const f = _lbObj(r.final);
      return {
        pi: r.player_index,
        realm: r.realm || kingdomByIdx[r.player_index] || null,
        uid: r.is_bot ? null : uidOf(r.player_index),
        player: r.is_bot ? null : personOf(r.player_index),
        race: r.race,
        al: r.alignment,
        bot: !!r.is_bot,
        rank: r.rank || null,
        score: r.score || 0,
        winner: !!r.winner,
        outTurn: r.out_turn || null,
        outHow: r.out_how || null,
        prov: f.provinces || 0,
        land: f.land || 0,
        sea: f.sea || 0,
        gold: f.gold || 0,
        tax: f.tax || 0,
        taxShare: f.taxShare || 0,
        str: f.str || 0,
        units: f.units || 0,
        heroes: f.heroes || 0,
        items: f.items || 0,
        relics: f.relics || 0,
        disc: f.discoveries || 0,
        consec: f.consecrated || 0,
        explored: f.explored || 0,
        titles: titlesByPi[r.player_index] || [],
      };
    });
  const win = results.find((r) => r.winner) || null;

  // ── the sweep ──────────────────────────────────────────────────────────────────────────────────
  const rk = lbRecorder(),
    put = rk.put;
  const agg = {}; // per realm, summed over the game
  const A = (pi) =>
    (agg[pi] = agg[pi] || {
      caps: 0,
      lost: 0,
      battles: 0,
      won: 0,
      unitsLost: 0,
      unitsKilled: 0,
      lairs: 0,
      lairsWon: 0,
      fled: 0,
      spells: 0,
      spellsOk: 0,
      deaths: 0,
      kills: 0,
      kingKills: 0,
      spellCount: {},
      killsByChar: {},
    });
  const seenTen = {}; // pi → first turn at 10 provinces
  const uniqBattles = new Set();
  let gameBattles = 0,
    gameCasualties = 0,
    gameSpells = 0,
    gameCaps = 0,
    gameDeaths = 0,
    gameLairs = 0;

  events.forEach((ev) => {
    const pi = ev.player_index,
      post = _lbObj(ev.post),
      out = _lbObj(ev.outcomes),
      t = ev.turn;
    const a = A(pi),
      C = (x) => lbCtx(pi, t, x);

    // realm & dominion
    put('most_provinces', post.provinces, C());
    put('most_land', post.land, C());
    put('most_sea', post.sea, C());
    put('top_tax_share', post.taxShare, C());
    put('richest', post.gold, C());
    put('most_explored', post.explored, C());
    put('most_discoveries', post.discoveries, C());
    put('most_consecrated', post.consecrated, C());
    put('most_relics', post.relics, C());
    put('most_heroes', post.heroes, C());
    put('most_units_realm', post.units, C());
    put('mightiest_host', post.str, C());
    put('largest_garrison', post.garStr, C());
    if ((post.provinces || 0) >= 10 && seenTen[pi] == null) {
      seenTen[pi] = t;
      put('fastest_ten', t, C({ det: '10 provinces' }), 'min');
    }
    const dl = _lbObj(out.delta);
    put('gold_gain_turn', dl.gold, C());
    put('str_gain_turn', dl.str, C());

    // characters — the per-hero hosts, skills, baggage. A hero who fell this turn is counted too
    // (post.fallen, 2026-10-09): a peak reached in the turn he died used to be lost with him.
    _lbArr(post.characters)
      .concat(_lbArr(post.fallen))
      .forEach((c) => {
        if (!c || typeof c !== 'object') return;
        const who = c.name || null,
          units = _lbArr(c.units);
        const ctx = (x) => C(Object.assign({ who }, x || {}));
        put('biggest_field_army', lbSumStr(units), ctx({ det: `${units.length} units` }));
        put('most_units_one_char', units.length, ctx());
        put(
          'grand_armada',
          lbSumStr(units, (u) => _LB_SEA.has(u.t)),
          ctx({ det: `${units.filter((u) => _LB_SEA.has(u.t)).length} hulls & sea-beasts` }),
        );
        put(
          'sky_host',
          lbSumStr(units, (u) => _LB_AIR.has(u.t)),
          ctx({ det: `${units.filter((u) => _LB_AIR.has(u.t)).length} airborne units` }),
        );
        put(
          'beast_host',
          lbSumStr(units, (u) => _LB_BEAST.has(u.t)),
          ctx({ det: `${units.filter((u) => _LB_BEAST.has(u.t)).length} creatures & monsters` }),
        );
        put(
          'horse_host',
          lbSumStr(units, (u) => _LB_CAV.has(u.t)),
          ctx(),
        );
        put(
          'arrow_storm',
          lbSumStr(units, (u) => _LB_MISSILE.has(u.t)),
          ctx(),
        );
        put('undead_legion', units.filter((u) => u.sk).length, ctx());
        put(
          'most_items_one_char',
          _lbArr(c.items).length,
          ctx({
            det:
              _lbArr(c.items)
                .filter((x) => typeof x === 'string')
                .slice(0, 3)
                .join(', ') || null,
          }),
        );
        put('hardiest', c.maxHp, ctx());
        const sk = _lbObj(c.skills),
          tot = Object.values(sk).reduce((s, v) => s + (Number(v) || 0), 0);
        put('greatest_hero', tot, ctx({ det: `${Object.keys(sk).length} skills` }));
        Object.entries(sk).forEach(([k, v]) => {
          const lv = _lbN(v);
          put('sk_' + k, lv, ctx({ lbl: 'Highest ' + (SKILL_LABELS[k] || k), det: (SKILL_LABELS[k] || k) + ' ' + lv }));
        });
      });

    // the Imperial Titles this realm held at the end of this turn (post.titles, 2026-10-09): a title
    // held for a while and lost before the end of the game is still on its record.
    _lbArr(post.titles).forEach((h) => {
      if (!h || typeof h.key !== 'string') return;
      const def = (typeof TITLE_DEFS !== 'undefined' ? TITLE_DEFS : []).find((x) => x.key === h.key);
      const nm = (def && def.name) || h.key;
      put(
        'title_' + h.key,
        h.merit,
        C({ who: (typeof h.who === 'string' && h.who) || null, lbl: nm + ' — highest rating', det: nm }),
      );
    });

    // battles
    const B = _lbObj(out.battles);
    put('battles_turn', B.fought, C());
    put('kills_turn', B.unitsKilled, C());
    put('losses_turn', B.unitsLost, C());
    a.battles += B.fought || 0;
    a.won += B.won || 0;
    a.unitsLost += B.unitsLost || 0;
    a.unitsKilled += B.unitsKilled || 0;
    _lbArr(B.list).forEach((b) => {
      if (!b || typeof b !== 'object') return;
      const atk = b.side === 'atk',
        aS = _lbN(b.atkStr),
        dS = _lbN(b.defStr);
      const aL = _lbN(b.atkLost),
        dL = _lbN(b.defLost);
      const mine = atk ? aS : dS,
        theirs = atk ? dS : aS;
      const key = [t, b.prov, b.atkPi, b.defPi, aS, dS].join('|');
      if (!uniqBattles.has(key)) {
        uniqBattles.add(key);
        gameBattles++;
        gameCasualties += aL + dL;
      }
      const det = `${Math.round(aS)} vs ${Math.round(dS)}${typeof b.terrain === 'string' ? ' · ' + b.terrain : ''}`;
      const ctx = C({ det, kind: typeof b.kind === 'string' ? b.kind : null });
      put('biggest_battle', aS + dS, ctx);
      if (b.kind === 'pvp') put('biggest_pvp', aS + dS, ctx);
      put('bloodiest_battle', aL + dL, C({ det }));
      put('longest_siege', _lbN(b.carry), C({ det }));
      put('worst_rout', atk ? aL : dL, C({ det }));
      if (b.win && theirs > 0 && mine > 0) {
        put(
          'greatest_upset',
          Math.round((1000 * mine) / theirs) / 1000,
          C({ det: `${Math.round(mine)} beat ${Math.round(theirs)}` }),
          'min',
        );
        if (atk === false)
          put(
            'stubbornest_defence',
            Math.round((1000 * mine) / theirs) / 1000,
            C({ det: `${Math.round(mine)} held off ${Math.round(theirs)}` }),
            'min',
          );
        if ((atk ? aL : dL) === 0)
          put('flawless_victory', theirs, C({ det: `${Math.round(theirs)} destroyed, nothing lost` }));
      }
    });

    // lairs and their guardians
    const E = _lbObj(out.encounters);
    a.lairs += E.fought || 0;
    a.lairsWon += E.won || 0;
    a.fled += E.fled || 0;
    gameLairs += E.fought || 0;
    put('lairs_turn', E.won, C());
    _lbArr(E.list).forEach((e) => {
      if (!e || typeof e !== 'object') return;
      const pw = GUARDIAN_POWER_RANK[typeof e.power === 'string' ? e.power : ''] || 0;
      const gname =
        (typeof e.guardian === 'string' && e.guardian) || (typeof e.feature === 'string' && e.feature) || 'a guardian';
      const ctx = C({ who: null, det: `${gname}${e.power ? ' (' + e.power + ')' : ''}` });
      if (e.won) {
        put('guardian_slain', pw, ctx);
        put('narrowest_escape', e.hpAfter, ctx, 'min');
        if (pw >= 3)
          put('luckiest_kill', e.hpAfter, C({ det: `${gname} (${e.power}) — ${_lbN(e.hpAfter)} hp left` }), 'min');
        put('hardest_fight', e.dmg, ctx);
      }
      if (e.killed)
        put('deadliest_guardian', pw, C({ det: `${gname}${e.power ? ' (' + e.power + ')' : ''} slew a champion` }));
    });

    // captures
    const Cp = _lbObj(out.captures);
    a.caps += Cp.gained || 0;
    a.lost += Cp.lost || 0;
    gameCaps += Cp.gained || 0;
    put('captures_turn', Cp.gained, C());
    put('lost_turn', Cp.lost, C());
    _lbArr(Cp.list).forEach((cp) => {
      if (cp && cp.to === pi)
        put(
          'richest_capture',
          cp.tax,
          C({ det: `a ${(typeof cp.terrain === 'string' && cp.terrain) || 'province'} worth ${_lbN(cp.tax)} tax` }),
        );
    });

    // deaths
    const D = _lbObj(out.deaths);
    a.deaths += D.own || 0;
    a.kills += D.killed || 0;
    gameDeaths += D.own || 0;
    put('deaths_turn', D.own, C());
    _lbArr(D.list).forEach((d) => {
      if (d && d.killerPi === pi && d.pi !== pi) {
        if (d.killerId != null) a.killsByChar[d.killerId] = (a.killsByChar[d.killerId] || 0) + 1;
        if (d.king) a.kingKills++;
      }
    });

    // spells
    const S = _lbObj(out.spells);
    a.spells += S.cast || 0;
    a.spellsOk += S.ok || 0;
    gameSpells += S.cast || 0;
    put('spells_turn', S.cast, C());
    _lbArr(S.list).forEach((s) => {
      if (!s || typeof s !== 'object') return;
      const sname = (typeof s.spell === 'string' && s.spell) || 'an unnamed spell';
      a.spellCount[sname] = (a.spellCount[sname] || 0) + 1;
      if (s.ok && _lbN(s.chance) > 0)
        put('longest_shot', s.chance, C({ det: `${sname} at ${_lbN(s.chance)}%` }), 'min');
      if (s.ok) put('grandest_casting', s.lvl, C({ det: sname }));
    });
  });

  // per-realm totals → game-long records
  Object.entries(agg).forEach(([k, a]) => {
    const pi = Number(k),
      C = (x) => lbCtx(pi, null, x);
    put('captures_game', a.caps, C());
    put('lost_game', a.lost, C());
    put('battles_game', a.battles, C());
    put('battles_won_game', a.won, C());
    put('kills_game', a.unitsKilled, C());
    put('losses_game', a.unitsLost, C());
    put('lairs_game', a.lairsWon, C());
    put('flights_game', a.fled, C());
    put('spells_game', a.spells, C());
    put('failed_spells_game', a.spells - a.spellsOk, C());
    put('champions_lost', a.deaths, C());
    put('champions_slain', a.kills, C());
    put('kingslayer', a.kingKills, C());
    if (a.battles >= 4)
      put('best_win_rate', Math.round((1000 * a.won) / a.battles) / 10, C({ det: `${a.won} of ${a.battles} battles` }));
    const topChar = Object.entries(a.killsByChar).sort((x, y) => y[1] - x[1])[0];
    if (topChar) {
      const nm = _lbObj(
        (
          events.find(
            (e) =>
              e &&
              e.player_index === pi &&
              _lbArr(_lbObj(e.post).characters).some((c) => c && String(c.id) === String(topChar[0])),
          ) || {}
        ).post,
      );
      const ch = _lbArr(nm.characters).find((c) => c && String(c.id) === String(topChar[0]));
      put('deadliest_champion', topChar[1], C({ who: ch ? ch.name : null }));
    }
    const topSpell = Object.entries(a.spellCount).sort((x, y) => y[1] - x[1])[0];
    if (topSpell) put('favourite_spell', topSpell[1], C({ det: topSpell[0] }));
  });

  // from the final results rows
  results.forEach((r) => {
    const pi = r.player_index,
      f = _lbObj(r.final),
      C = (x) => lbCtx(pi, turns, x);
    put('final_score', r.score, C());
    put('final_provinces', f.provinces, C());
    put('final_gold', f.gold, C());
    put('final_strength', f.str, C());
    put('final_tax_share', f.taxShare, C());
    if (r.out_turn) put('earliest_out', r.out_turn, C({ det: r.out_how || 'out' }), 'min');
  });
  // the Imperial Titles — highest merit recorded for each, this game
  if (titleTop)
    Object.entries(titleTop).forEach(([k, v]) => {
      put('title_' + k, v.merit, lbCtx(v.pi, turns, { who: v.who, lbl: v.name + ' — highest rating', det: v.name }));
    });
  // whole-game records (no realm)
  const G0 = { pi: null, t: null };
  put('longest_game', turns, G0);
  put('shortest_game', turns, G0, 'min');
  put('most_realms', setup.realms, G0);
  put('most_humans', setup.humans, G0);
  put('biggest_world', (setup.cols || 0) * (setup.rows || 0), G0, 'max');
  put('most_battles_game', gameBattles, G0);
  put('bloodiest_game', gameCasualties, G0);
  put('most_spells_game', gameSpells, G0);
  put('most_captures_game', gameCaps, G0);
  put('most_deaths_game', gameDeaths, G0);
  put('most_lairs_game', gameLairs, G0);

  const finishedAt =
    results
      .map((r) => r.created_at)
      .filter(Boolean)
      .sort()[0] || kcClock.date().toISOString();
  return {
    game_id: String(gameId),
    game_name: (gameRow && gameRow.name) || any.game_name || 'Game ' + gameId,
    gm_user_id: (gameRow && gameRow.gm_user_id) || (currentUser ? currentUser.id : null),
    started_at: (gameRow && gameRow.created_at) || null,
    finished_at: finishedAt,
    turns,
    winner_realm: win ? win.realm : null,
    winner_player: win ? (win.is_bot ? null : personOf(win.player_index)) : null,
    winner_is_bot: win ? !!win.is_bot : null,
    victory: any.victory || null,
    setup,
    standings,
    records: rk.finish(),
    totals: {
      battles: gameBattles,
      casualties: gameCasualties,
      spells: gameSpells,
      captures: gameCaps,
      deaths: gameDeaths,
      lairs: gameLairs,
      events: events.length,
    },
    build: `GM ${KC_BUILD_STAMP} lb${KC_LB_V}`,
  };
}

// Fetch this game's turn_events (only the two columns the records need) and write its record row.
// Idempotent: upsert on game_id. `preserve` keeps a GM's hand edits (note, hidden, display name).
export async function writeGameRecord(gameId, opts) {
  if (!_kcHasLb) return false;
  opts = opts || {};
  try {
    const gid = String(gameId);
    const { data: results, error: rErr } = await sb.from('game_results').select('*').eq('game_id', gid);
    if (rErr || !results || !results.length) return false;
    // 2026-10-09 (Toby item 5): ordered by turn AND realm. There is one row per realm per turn, so
    // ordering by turn alone left the order within a turn to the database, which may differ from one
    // page query to the next: rows at a page edge were skipped or read twice. A page that fails now
    // stops the build, rather than saving a record from part of the game over a complete one.
    const events = [];
    for (let from = 0; ; from += 500) {
      const { data, error } = await sb
        .from('turn_events')
        .select('turn,player_index,is_bot,realm,race,alignment,post,outcomes')
        .eq('game_id', gid)
        .order('turn')
        .order('player_index')
        .range(from, from + 499);
      if (error) {
        _kcLbLastErr = 'Could not read the turn history of game ' + gid + ': ' + error.message;
        renderLeaderboardBanner();
        return false;
      }
      events.push(...(data || []));
      if (!data || data.length < 500) break;
    }
    let gameRow = opts.gameRow || null,
      players = opts.players || null,
      gs = opts.gs || null;
    if (!gameRow || !players || !gs) {
      const { data: full } = await sb
        .from('games')
        .select(
          'id,name,gm_user_id,created_at,max_turns,meta,game_state,game_players(id,player_index,user_id,display_name)',
        )
        .eq('id', gid)
        .maybeSingle();
      if (full) {
        gameRow = gameRow || full;
        players = players || full.game_players || [];
        if (!gs) {
          const p = parseGameState(full);
          if (p && p.players) gs = p;
        }
      }
    }
    const row = buildGameRecords(gid, gameRow, players || [], results, events, gs, await lbProfileNames(players));
    if (!row) return false;
    lbCountRow(row);
    const { data: old } = await sb
      .from('game_records')
      .select('note,hidden,game_name')
      .eq('game_id', gid)
      .maybeSingle();
    if (old) {
      if (old.note) row.note = old.note;
      if (old.hidden) row.hidden = true;
      if (old.game_name) row.game_name = old.game_name;
    }
    const { error } = await sb.from('game_records').upsert([row], { onConflict: 'game_id' });
    if (error) {
      _kcLbLastErr = error.message;
      renderLeaderboardBanner();
      return false;
    }
    _kcLbLastErr = null;
    renderLeaderboardBanner();
    return true;
  } catch (e) {
    _kcLbLastErr = String((e && e.message) || e);
    return false;
  }
}
// {auth user id → profiles.name} for the humans in one game's slots. `profiles` is the only place
// a PERSON's name lives (game_players.display_name is their kingdom), and the GM portal can already
// read the table — the invite picker does. Cached for the tab's lifetime so a backfill over twenty
// games is one query, not twenty. A failure is not fatal: the standings then carry uid but no name,
// and the board falls back to whatever name it can resolve itself.
export let _lbProfCache = null,
  _lbProfErr = null;
export async function lbProfileNames(players) {
  if (!_lbProfCache) {
    _lbProfCache = {};
    _lbProfErr = null;
    try {
      const { data, error } = await sb.from('profiles').select('id,name');
      if (error) _lbProfErr = error.message;
      (data || []).forEach((r) => {
        if (r && r.id && r.name) _lbProfCache[r.id] = r.name;
      });
      if (!error && !Object.keys(_lbProfCache).length) _lbProfErr = 'the profiles table returned no names at all';
    } catch (e) {
      _lbProfErr = String((e && e.message) || e);
    }
  }
  const want = [...new Set((players || []).map((p) => p && p.user_id).filter(Boolean))];
  const out = {};
  want.forEach((id) => {
    if (_lbProfCache[id]) out[id] = _lbProfCache[id];
  });
  return out;
}
// What the last build actually managed to resolve — the tally the rebuild button reports, so a
// silent "names are still wrong" has a visible cause instead of needing the console.
export const _lbTally = { games: 0, humans: 0, uids: 0, named: 0 };
export function lbCountRow(row) {
  _lbTally.games++;
  (row.standings || []).forEach((st) => {
    if (!st || st.bot) return;
    _lbTally.humans++;
    if (st.uid) _lbTally.uids++;
    if (st.player) _lbTally.named++;
  });
}
// Build a Hall-of-Fame row for every finished game of this GM's that has results but no record yet.
// Button-driven, NOT automatic at sign-in: each game costs one sweep of its turn_events, and the
// Disk-IO lesson says never to put that on a path that runs by itself.
export async function backfillGameRecords(force) {
  if (!_kcHasLb || !currentUser) return 0;
  const btn = document.getElementById('lb-build-btn');
  const say = (t) => {
    const el = document.getElementById('lb-build-msg');
    if (el) el.textContent = t;
  };
  try {
    const { data: games } = await sb
      .from('games')
      .select('id,name,gm_user_id,created_at,max_turns,meta')
      .eq('gm_user_id', currentUser.id)
      .eq('status', 'complete');
    // paged (2026-10-09): one row per realm per game passes the database's 1000-row answer limit
    // after a hundred or so games, and the games past it were never offered for a record
    const res = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb
        .from('game_results')
        .select('game_id')
        .order('game_id')
        .order('player_index')
        .range(from, from + 999);
      if (error) {
        say('Could not read the finished games: ' + error.message);
        return 0;
      }
      res.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    const withResults = new Set(res.map((r) => r.game_id));
    const { data: have } = await sb.from('game_records').select('game_id');
    const done = new Set((have || []).map((r) => r.game_id));
    // every game that HAS results — this GM's finished games, plus recorded games since deleted
    const todo = [...withResults].filter((id) => force || !done.has(id));
    if (!todo.length) {
      say('Every finished game already has a Hall-of-Fame record.');
      return 0;
    }
    if (btn) btn.disabled = true;
    _lbProfCache = null; // a rebuild re-reads the names
    _lbTally.games = _lbTally.humans = _lbTally.uids = _lbTally.named = 0;
    let n = 0;
    for (let i = 0; i < todo.length; i++) {
      say(`Building ${i + 1} of ${todo.length}…`);
      const g = (games || []).find((x) => String(x.id) === todo[i]) || null;
      if (await writeGameRecord(todo[i], { gameRow: g })) n++;
    }
    const el = document.getElementById('lb-build-msg');
    const t = _lbTally;
    const out = [
      kcHtml`Recorded ${n} game${n !== 1 ? 's' : ''} · ${t.humans} human realm${t.humans !== 1 ? 's' : ''} · ${t.uids} with a player account · <strong>${t.named} with a name</strong> · built by <code>${KC_BUILD_STAMP} lb${KC_LB_V}</code>`,
    ];
    if (t.humans && !t.named)
      out.push(
        kcHtml`<div class="msg-warning" style="margin-top:6px"><strong>No player names were resolved.</strong> A player's name lives in the <code>profiles</code> table (<code>game_players.display_name</code> is their realm), and this build could not read one for any of them.${_lbProfErr ? kcHtml` The table said: <em>${_lbProfErr}</em>.` : ''}<br>Either those accounts have no name saved — each player can set one with <strong>✏ Change Display Name</strong> in the player portal — or this GM account cannot read <code>profiles</code> under its Row-Level Security policy (the same policy the invite picker needs).</div>`,
      );
    else if (t.uids > t.named)
      out.push(
        kcHtml` <span style="color:#8a5a00">(${t.uids - t.named} account${t.uids - t.named !== 1 ? 's have' : ' has'} no name saved yet)</span>`,
      );
    if (el) el.innerHTML = kcHtml`${out}`;
    else say(String(kcHtml`${out}`));
    if (btn) btn.disabled = false;
    return n;
  } catch (e) {
    say('Failed: ' + ((e && e.message) || e));
    if (btn) btn.disabled = false;
    return 0;
  }
}
