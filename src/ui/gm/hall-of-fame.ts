import { kcHtml } from '../shared/kc-safe.ts';
import { KC_UNIT_CLASS, TITLE_DEFS } from '../../content/kingdoms-call-data.ts';
import { kcClock } from '../../engine/clock.ts';
import { KC_BUILD_STAMP } from './startup.ts';
import { GUARDIAN_POWER_RANK, SKILL_LABELS } from '../../engine/army-tables.ts';
import { UNIT_BASE_STR, UNIT_Q_MULT } from '../../engine/rules-on-plain-values/unit-types-and-base-strength.ts';
import { thePagesDb } from './config.ts';
import { kcMissingMsg, parseGameState } from './startup.ts';
import { gameMetaOf } from '../../engine/rules-on-plain-values/a-games-settings-read-from-its-row.ts';
import { computeStandings } from '../../engine/titles/reckoning.ts';
import { isBotRow } from '../../engine/bots/setup.ts';
import { telRealmSnapshot } from '../../engine/turn/log-line-helpers.ts';
import { KC_TEL_V, renderTelemetryBanner, telBotDifficultyOf, telOutcomesFor, telRankOrder } from './startup.ts';
import {
  isAList,
  theField,
  theSumAsJavaScriptMakesIt,
  thisOrElse,
} from '../shared/a-value-of-any-kind-read-as-javascript-reads-it.ts';
import type {
  AHallOfFameEntryAsTheGmPageWritesIt,
  AResultAsTheGmPageWritesIt,
  ATurnRecordAsTheGmPageWritesIt,
} from '../../db/the-db-interface-and-its-areas.ts';
import type { Character, Province, Realm } from '../../schemas/saved-game-state.ts';
import type { TheStatisticsOfTheTurn } from '../../views/the-statistics-of-the-turn.ts';

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
//
// ITS TYPES (plan P1-16q). The statistics a record is built from (a realm's snapshot, a turn's outcomes, a result's
// setup) are JSON written by any older build, so each is read as JavaScript reads it: an object through `_lbObj`, its
// fields values of any kind (`unknown`), and a `+`, a `||` or a comparison on them through the readers in
// ../shared/a-value-of-any-kind-read-as-javascript-reads-it.ts, so each gives the value it gave untyped. The forms:
// docs/architecture/the-forms-that-keep-a-value-numbers-words-and-lists.md.
export const KC_LB_V = 3; // bump when the row shape changes (rows carry it in build) · 3: records hold every realm's best
// Declared globals (plan P1-09b): one binding the page's files and its tests share (ui/gm/globals.ts says why).
globalThis._kcHasLb = false;
globalThis._kcLbLastErr = null;
export async function probeLeaderboard() {
  try {
    const { error } = await thePagesDb.theHallOfFame.oneEntrysGame();
    _kcHasLb = !error;
    if (error) console.warn('game_records probe:', error.message);
  } catch {
    _kcHasLb = false;
  }
  renderLeaderboardBanner();
  return _kcHasLb;
}
export function renderLeaderboardBanner() {
  const el = document.getElementById('msg-leaderboard');
  if (!el) return;
  if (!_kcHasLb) {
    el.innerHTML = String(
      kcMissingMsg(
        '🏆 Leaderboard not active',
        kcHtml`<code>game_records</code> table`,
        'finished games are not being added to the Hall of Fame',
      ),
    );
  } else if (_kcLbLastErr) {
    el.innerHTML = String(
      kcHtml`<div class="msg-error"><strong>🏆 Leaderboard write failed</strong>: ${_kcLbLastErr}. The turn and its statistics were saved; only the Hall-of-Fame row was lost. Use ↻ Rebuild on the Stats tab.</div>`,
    );
  } else el.innerHTML = '';
}

// ── unit maths on a SNAPSHOT unit record ({t:type, q:quality, sk:1 if skeletal}) ──────────────────
// Each set is asked about a unit's type as the snapshot holds it (a value of any kind), so it holds values of any kind.
export const _LB_SEA = new Set<unknown>(KC_UNIT_CLASS.sea);
export const _LB_AIR = new Set<unknown>(KC_UNIT_CLASS.aerial);
export const _LB_BEAST = new Set<unknown>([...KC_UNIT_CLASS.creature, ...KC_UNIT_CLASS.monster]);
export const _LB_MISSILE = new Set<unknown>(KC_UNIT_CLASS.missile);
export const _LB_CAV = new Set<unknown>(KC_UNIT_CLASS.cavalry);
/** A value of the statistics read field by field: an object or a list (what `typeof v === 'object'` passes, but none),
 *  each field a value of any kind. */
export type AnObjectReadByItsFields = Readonly<Partial<Record<string, unknown>>>;
/** Whether a value of the statistics is something read field by field (`v && typeof v === 'object'`: JSON holds no
 *  object that reads as false). */
export function isAnObjectReadByItsFields(v: unknown): v is AnObjectReadByItsFields {
  return typeof v === 'object' && v !== null;
}
/** A value of any kind in words as `'…' + v` writes it (the value read as a `+` reads it). */
export function asAPlusWritesIt(v: unknown): string {
  return String(theSumAsJavaScriptMakesIt('', v));
}
// A snapshot arrives as JSON written by an older build, or by a hook that caught a half-built
// object: every list and map below is defended, because this runs on the turn path.
export const _lbArr = (v: unknown): readonly unknown[] => (isAList(v) ? v : []);
export const _lbObj = (v: unknown): AnObjectReadByItsFields => (isAnObjectReadByItsFields(v) && !isAList(v) ? v : {});
export const _lbN = (v: unknown): number => {
  const n = Number(v);
  return isFinite(n) ? n : 0;
};
export function lbUnitStr(u: unknown): number {
  return isAnObjectReadByItsFields(u)
    ? ((UNIT_BASE_STR[String(u['t'])] ?? 0) || 4) * ((UNIT_Q_MULT[String(thisOrElse(u['q'], 'Average'))] ?? 0) || 2)
    : 0;
}
export function lbSumStr(units: unknown, pred?: (u: unknown) => boolean): number {
  return _lbArr(units).reduce((s: number, u) => s + (!pred || pred(u) ? lbUnitStr(u) : 0), 0);
}

// ── the record accumulator ───────────────────────────────────────────────────────────────────────
/** What a record's entry is put with: its realm (`pi`, null for the whole game's), its turn (`t`), and its details
 *  (`who`, `det`, `lbl`, `kind`), each a value of any kind as the statistics held it. */
export interface ARecordsContext {
  readonly pi?: number | null | undefined;
  readonly t?: number | null | undefined;
  readonly [detail: string]: unknown;
}
/** A record's entry: its value, rounded, whether the least or the most is best, and what it was put with. */
export type ARecordsEntry = { readonly v: number; readonly d: 'min' | 'max' } & ARecordsContext;
// put(key, value, ctx, dir): keeps the best value of EACH REALM in this game (ctx.pi; the whole-game
// records, pi null, keep one). dir 'min' for records where small wins (an upset, an early
// elimination, a long-shot spell). 2026-10-09 (Toby item 5): it kept only the game's single best, so
// a realm whose best battle was beaten by another realm in the same game had nothing on the board.
// A "most" record of zero is no feat and is not kept. finish() returns {key: [entries, best first]}.
export function lbRecorder() {
  const R: Record<string, ARecordsEntry[]> = {};
  return {
    R,
    put: (key: string, value: unknown, ctx?: ARecordsContext | null, dir?: string) => {
      if (value == null) return;
      const v = Number(value);
      if (!isFinite(v)) return;
      const d = dir === 'min' ? 'min' : 'max';
      if (d === 'max' && !(v > 0)) return;
      const pi = ctx?.pi ?? null;
      const list = R[key] ?? [];
      R[key] = list;
      const i = list.findIndex((e) => e.pi === pi);
      const held = i >= 0 ? list[i] : undefined;
      if (held !== undefined && !(d === 'min' ? v < held.v : v > held.v)) return;
      const valued: { v: number; d: 'min' | 'max' } = { v: Math.round(v * 100) / 100, d };
      const e = Object.assign(valued, ctx ?? {});
      if (i < 0) list.push(e);
      else list[i] = e;
    },
    finish() {
      Object.values(R).forEach((l) =>
        l.sort((a, b) => (a.d === 'min' ? a.v - b.v : b.v - a.v) || (a.pi ?? -1) - (b.pi ?? -1)),
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
export function lbCtx(
  pi: number | null | undefined,
  turn: number | null | undefined,
  extra?: ARecordsContext | null,
): ARecordsContext {
  return Object.assign({ pi: pi ?? null, t: turn ?? null }, extra ?? {});
}

/** A game's row as its record reads it (a games row, or a game the GM runs, or none for a game since deleted): its
 *  name, Game Master, start, turn limit and settings. */
export interface AGameAsItsRecordReadsIt {
  readonly id?: unknown;
  readonly name?: string | null | undefined;
  readonly gm_user_id?: string | null | undefined;
  readonly created_at?: string | null | undefined;
  readonly max_turns?: number | null | undefined;
  readonly meta?: unknown;
}
/** A realm's slot in a game (game_players) as the records read it: its index, its account and its kingdom's name. */
export interface ARealmsSlotAsTheRecordsReadIt {
  readonly player_index?: number | null | undefined;
  readonly user_id?: string | null | undefined;
  readonly display_name?: string | null | undefined;
}
/** A realm's result in a finished game (game_results) as its record reads it: every field the builder guards may be
 *  missing; its setup and final snapshot are JSON. */
export interface ARealmsResultAsItsRecordReadsIt {
  readonly player_index: number;
  readonly is_bot?: boolean | null | undefined;
  readonly winner?: boolean | null | undefined;
  readonly realm: string | null;
  readonly race?: unknown;
  readonly alignment?: unknown;
  readonly rank?: number | null | undefined;
  readonly score?: number | null | undefined;
  readonly out_turn?: number | null | undefined;
  readonly out_how?: string | null | undefined;
  readonly turns?: number | null | undefined;
  readonly victory?: string | null | undefined;
  readonly game_name?: string | null | undefined;
  readonly created_at?: string | null | undefined;
  readonly setup?: unknown;
  readonly final?: unknown;
}
/** A realm's turn (turn_events) as a record reads it: its turn, its realm's index, and its snapshot and outcomes (JSON). */
export interface ARealmsTurnAsItsRecordReadsIt {
  readonly turn: number;
  readonly player_index: number;
  readonly post?: unknown;
  readonly outcomes?: unknown;
}
/** A game's state as the Hall of Fame and the statistics read it (a save of any age as parsed, or the world as the turn
 *  left it: every field may be missing): its realms and heroes as the standings and the telemetry read them, its
 *  world's size, its settings and its end. */
export interface TheStateAsTheHallOfFameReadsIt {
  readonly players?: readonly (Realm | null | undefined)[] | null | undefined;
  readonly characters?: readonly (Character | null | undefined)[] | null | undefined;
  readonly world?:
    | {
        readonly provinces?: readonly (Province | null | undefined)[] | null | undefined;
        readonly cols?: unknown;
        readonly rows?: unknown;
        readonly seaPct?: unknown;
      }
    | null
    | undefined;
  readonly botDiplomacy?: unknown;
  readonly botDifficulty?: unknown;
  readonly maxTurns?: unknown;
  readonly mapSize?: unknown;
  readonly seaPct?: unknown;
  readonly turn?: number | null | undefined;
  readonly gameOver?:
    | {
        readonly byReckoning?: unknown;
        readonly byElimination?: unknown;
        readonly byConcession?: unknown;
        readonly winner?: unknown;
        readonly turn?: number | null | undefined;
        readonly standings?:
          readonly ({ readonly index?: unknown; readonly score?: unknown } | null | undefined)[] | null | undefined;
      }
    | null
    | undefined;
}
/** A realm's running totals over a game. A total a `+=` adds the statistics to is a number, or words where the JSON
 *  held words (as `+` makes them). */
interface ARealmsTotals {
  caps: number | string;
  lost: number | string;
  battles: number | string;
  won: number | string;
  unitsLost: number | string;
  unitsKilled: number | string;
  lairs: number | string;
  lairsWon: number | string;
  fled: number | string;
  spells: number | string;
  spellsOk: number | string;
  deaths: number | string;
  kills: number | string;
  kingKills: number;
  spellCount: Record<string, number>;
  killsByChar: Record<string, number>;
}
/** `a || b` on a value of any kind where `b` is made only when it is needed: `a` where it is truthy, else what
 *  `makeB` makes. */
function thisOrElseWhatIsMade(a: unknown, makeB: () => unknown): unknown {
  if (a) return a;
  return makeB();
}
/** A value of any kind in words, as `String` writes it: a key a table is read by (`table[value]` reads it so), or an id
 *  written in words. */
function inWords(value: unknown): string {
  return String(value);
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
export function buildGameRecords(
  gameId: string,
  gameRow: AGameAsItsRecordReadsIt | null | undefined,
  players: readonly (ARealmsSlotAsTheRecordsReadIt | null | undefined)[] | null | undefined,
  resultsAsHanded: readonly (ARealmsResultAsItsRecordReadsIt | null | undefined)[] | null | undefined,
  eventsAsHanded: readonly (ARealmsTurnAsItsRecordReadsIt | null | undefined)[] | null | undefined,
  gs?: TheStateAsTheHallOfFameReadsIt | null,
  profNames?: Readonly<Partial<Record<string, string>>> | null,
) {
  const results = (resultsAsHanded ?? []).filter((r): r is ARealmsResultAsItsRecordReadsIt => Boolean(r));
  const events = (eventsAsHanded ?? []).filter((e): e is ARealmsTurnAsItsRecordReadsIt => Boolean(e));
  if (!results.length) return null;
  // the names by account (an object, as lbProfileNames gives them, or none)
  const names = profNames ?? {};
  const uidByIdx: Partial<Record<number, string>> = {},
    kingdomByIdx: Partial<Record<number, string>> = {};
  (players ?? []).forEach((p) => {
    if (p?.player_index == null) return;
    if (p.user_id) uidByIdx[p.player_index] = p.user_id;
    if (p.display_name) kingdomByIdx[p.player_index] = p.display_name;
  });
  // (each table holds only the ids and names its `if` found truthy: no '')
  const uidOf = (pi: number) => uidByIdx[pi] ?? null;
  const personOf = (pi: number) => {
    const u = uidOf(pi);
    return u ? (names[u] ?? '') || null : null;
  };
  const any = results[0];
  if (any === undefined) return null; // (results is not empty: the test above)
  const setupIn = _lbObj(any.setup);
  const meta = gameRow ? gameMetaOf(gameRow) : null;
  const setup = {
    realms: thisOrElse(setupIn['realms'], results.length),
    humans: setupIn['humans'] ?? results.filter((r) => !r.is_bot).length,
    bots: setupIn['bots'] ?? results.filter((r) => r.is_bot).length,
    diplomacy: thisOrElse(
      thisOrElse(thisOrElse(setupIn['diplomacy'], gs ? gs.botDiplomacy : gs), meta ? meta['botDiplomacy'] : meta),
      'normal',
    ),
    difficulty: thisOrElse(
      thisOrElse(thisOrElse(setupIn['difficulty'], gs ? gs.botDifficulty : gs), meta ? meta['botDifficulty'] : meta),
      null,
    ),
    mapSize: thisOrElse(thisOrElse(setupIn['mapSize'], meta ? meta['mapSize'] : meta), null),
    cols: thisOrElse(thisOrElse(setupIn['cols'], gs?.world ? gs.world.cols : null), null),
    rows: thisOrElse(thisOrElse(setupIn['rows'], gs?.world ? gs.world.rows : null), null),
    seaPct: setupIn['seaPct'] ?? meta?.['seaPct'] ?? null,
    maxTurns: thisOrElse(thisOrElse(gameRow ? gameRow.max_turns : gameRow, gs ? gs.maxTurns : gs), null),
  };
  const turns = (any.turns ?? 0) || Math.max(0, ...events.map((e) => e.turn || 0));

  // ── final standings, one entry per realm ───────────────────────────────────────────────────────
  let titleTop: Record<string, { name: string; merit: number; pi: number; who: unknown }> | null = null;
  if (gs?.players) {
    try {
      const st = computeStandings(gs);
      const top: Record<string, { name: string; merit: number; pi: number; who: unknown }> = {};
      titleTop = top;
      TITLE_DEFS.forEach((t) => {
        const h = st.titles[t.key];
        if (h?.playerIndex == null || !(h.merit > 0)) return;
        const charId = h.charId;
        const ch =
          charId != null ? _lbArr(gs.characters).find((c) => isAnObjectReadByItsFields(c) && c['id'] === charId) : null;
        top[t.key] = {
          name: t.name,
          merit: Math.round(h.merit * 100) / 100,
          pi: h.playerIndex,
          who: ch ? theField(ch, 'name') : null,
        };
      });
    } catch {
      titleTop = null;
    }
  }
  const titlesByPi: Partial<Record<number, string[]>> = {};
  if (titleTop)
    Object.entries(titleTop).forEach(([k, v]) => {
      const held = titlesByPi[v.pi] ?? [];
      titlesByPi[v.pi] = held;
      held.push(k);
    });
  const standings = results
    .slice()
    .sort((a, b) => ((a.rank ?? 0) || 99) - ((b.rank ?? 0) || 99))
    .map((r) => {
      const f = _lbObj(r.final);
      return {
        pi: r.player_index,
        realm: (r.realm ?? '') || (kingdomByIdx[r.player_index] ?? null),
        uid: r.is_bot ? null : uidOf(r.player_index),
        player: r.is_bot ? null : personOf(r.player_index),
        race: r.race,
        al: r.alignment,
        bot: !!r.is_bot,
        rank: (r.rank ?? 0) || null,
        score: (r.score ?? 0) || 0,
        winner: !!r.winner,
        outTurn: (r.out_turn ?? 0) || null,
        outHow: (r.out_how ?? '') || null,
        prov: thisOrElse(f['provinces'], 0),
        land: thisOrElse(f['land'], 0),
        sea: thisOrElse(f['sea'], 0),
        gold: thisOrElse(f['gold'], 0),
        tax: thisOrElse(f['tax'], 0),
        taxShare: thisOrElse(f['taxShare'], 0),
        str: thisOrElse(f['str'], 0),
        units: thisOrElse(f['units'], 0),
        heroes: thisOrElse(f['heroes'], 0),
        items: thisOrElse(f['items'], 0),
        relics: thisOrElse(f['relics'], 0),
        disc: thisOrElse(f['discoveries'], 0),
        consec: thisOrElse(f['consecrated'], 0),
        explored: thisOrElse(f['explored'], 0),
        titles: titlesByPi[r.player_index] ?? [],
      };
    });
  const win = results.find((r) => r.winner) ?? null;

  // ── the sweep ──────────────────────────────────────────────────────────────────────────────────
  const rk = lbRecorder(),
    put = rk.put;
  const agg: Record<number, ARealmsTotals> = {}; // per realm, summed over the game
  const A = (pi: number): ARealmsTotals =>
    (agg[pi] = agg[pi] ?? {
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
  const seenTen: Partial<Record<number, number>> = {}; // pi → first turn at 10 provinces
  const uniqBattles = new Set<string>();
  let gameBattles = 0,
    gameCasualties = 0,
    gameSpells: number | string = 0,
    gameCaps: number | string = 0,
    gameDeaths: number | string = 0,
    gameLairs: number | string = 0;
  // `x += y || 0` on a total, the statistics' `y` a value of any kind
  const plus = (total: number | string, y: unknown) => theSumAsJavaScriptMakesIt(total, thisOrElse(y, 0));

  events.forEach((ev) => {
    const pi = ev.player_index,
      post = _lbObj(ev.post),
      out = _lbObj(ev.outcomes),
      t = ev.turn;
    const a = A(pi),
      C = (x?: ARecordsContext) => lbCtx(pi, t, x);

    // realm & dominion
    put('most_provinces', post['provinces'], C());
    put('most_land', post['land'], C());
    put('most_sea', post['sea'], C());
    put('top_tax_share', post['taxShare'], C());
    put('richest', post['gold'], C());
    put('most_explored', post['explored'], C());
    put('most_discoveries', post['discoveries'], C());
    put('most_consecrated', post['consecrated'], C());
    put('most_relics', post['relics'], C());
    put('most_heroes', post['heroes'], C());
    put('most_units_realm', post['units'], C());
    put('mightiest_host', post['str'], C());
    put('largest_garrison', post['garStr'], C());
    if (Number(thisOrElse(post['provinces'], 0)) >= 10 && seenTen[pi] == null) {
      seenTen[pi] = t;
      put('fastest_ten', t, C({ det: '10 provinces' }), 'min');
    }
    const dl = _lbObj(out['delta']);
    put('gold_gain_turn', dl['gold'], C());
    put('str_gain_turn', dl['str'], C());

    // characters — the per-hero hosts, skills, baggage. A hero who fell this turn is counted too
    // (post.fallen, 2026-10-09): a peak reached in the turn he died used to be lost with him.
    _lbArr(post['characters'])
      .concat(_lbArr(post['fallen']))
      .forEach((c) => {
        if (!isAnObjectReadByItsFields(c)) return;
        const who = thisOrElse(c['name'], null),
          units = _lbArr(c['units']);
        const ctx = (x?: ARecordsContext) => C(Object.assign({ who }, x ?? {}));
        put('biggest_field_army', lbSumStr(units), ctx({ det: `${String(units.length)} units` }));
        put('most_units_one_char', units.length, ctx());
        put(
          'grand_armada',
          lbSumStr(units, (u) => _LB_SEA.has(theField(u, 't'))),
          ctx({ det: `${String(units.filter((u) => _LB_SEA.has(theField(u, 't'))).length)} hulls & sea-beasts` }),
        );
        put(
          'sky_host',
          lbSumStr(units, (u) => _LB_AIR.has(theField(u, 't'))),
          ctx({ det: `${String(units.filter((u) => _LB_AIR.has(theField(u, 't'))).length)} airborne units` }),
        );
        put(
          'beast_host',
          lbSumStr(units, (u) => _LB_BEAST.has(theField(u, 't'))),
          ctx({ det: `${String(units.filter((u) => _LB_BEAST.has(theField(u, 't'))).length)} creatures & monsters` }),
        );
        put(
          'horse_host',
          lbSumStr(units, (u) => _LB_CAV.has(theField(u, 't'))),
          ctx(),
        );
        put(
          'arrow_storm',
          lbSumStr(units, (u) => _LB_MISSILE.has(theField(u, 't'))),
          ctx(),
        );
        put('undead_legion', units.filter((u) => theField(u, 'sk')).length, ctx());
        put(
          'most_items_one_char',
          _lbArr(c['items']).length,
          ctx({
            det:
              _lbArr(c['items'])
                .filter((x) => typeof x === 'string')
                .slice(0, 3)
                .join(', ') || null,
          }),
        );
        put('hardiest', c['maxHp'], ctx());
        const sk = _lbObj(c['skills']),
          tot = Object.values(sk).reduce((s: number, v) => s + (Number(v) || 0), 0);
        put('greatest_hero', tot, ctx({ det: `${String(Object.keys(sk).length)} skills` }));
        // (SKILL_LABELS names every skill in words: it holds no '')
        const skillLabels: Readonly<Partial<Record<string, string>>> = SKILL_LABELS;
        Object.entries(sk).forEach(([k, v]) => {
          const lv = _lbN(v);
          put(
            'sk_' + k,
            lv,
            ctx({ lbl: 'Highest ' + (skillLabels[k] ?? k), det: (skillLabels[k] ?? k) + ' ' + String(lv) }),
          );
        });
      });

    // the Imperial Titles this realm held at the end of this turn (post.titles, 2026-10-09): a title
    // held for a while and lost before the end of the game is still on its record.
    _lbArr(post['titles']).forEach((h) => {
      if (!h) return;
      const key = theField(h, 'key');
      if (typeof key !== 'string') return;
      const def = TITLE_DEFS.find((x) => x.key === key);
      const nm = (def?.name ?? '') || key;
      const who = theField(h, 'who');
      put(
        'title_' + key,
        theField(h, 'merit'),
        C({ who: (typeof who === 'string' && who) || null, lbl: nm + ' — highest rating', det: nm }),
      );
    });

    // battles
    const B = _lbObj(out['battles']);
    put('battles_turn', B['fought'], C());
    put('kills_turn', B['unitsKilled'], C());
    put('losses_turn', B['unitsLost'], C());
    a.battles = plus(a.battles, B['fought']);
    a.won = plus(a.won, B['won']);
    a.unitsLost = plus(a.unitsLost, B['unitsLost']);
    a.unitsKilled = plus(a.unitsKilled, B['unitsKilled']);
    _lbArr(B['list']).forEach((b) => {
      if (!isAnObjectReadByItsFields(b)) return;
      const atk = b['side'] === 'atk',
        aS = _lbN(b['atkStr']),
        dS = _lbN(b['defStr']);
      const aL = _lbN(b['atkLost']),
        dL = _lbN(b['defLost']);
      const mine = atk ? aS : dS,
        theirs = atk ? dS : aS;
      const key = [t, b['prov'], b['atkPi'], b['defPi'], aS, dS].join('|');
      if (!uniqBattles.has(key)) {
        uniqBattles.add(key);
        gameBattles++;
        gameCasualties += aL + dL;
      }
      const terrain = b['terrain'];
      const det = `${String(Math.round(aS))} vs ${String(Math.round(dS))}${typeof terrain === 'string' ? ' · ' + terrain : ''}`;
      const kind = b['kind'];
      const ctx = C({ det, kind: typeof kind === 'string' ? kind : null });
      put('biggest_battle', aS + dS, ctx);
      if (kind === 'pvp') put('biggest_pvp', aS + dS, ctx);
      put('bloodiest_battle', aL + dL, C({ det }));
      put('longest_siege', _lbN(b['carry']), C({ det }));
      put('worst_rout', atk ? aL : dL, C({ det }));
      if (b['win'] && theirs > 0 && mine > 0) {
        put(
          'greatest_upset',
          Math.round((1000 * mine) / theirs) / 1000,
          C({ det: `${String(Math.round(mine))} beat ${String(Math.round(theirs))}` }),
          'min',
        );
        if (!atk)
          put(
            'stubbornest_defence',
            Math.round((1000 * mine) / theirs) / 1000,
            C({ det: `${String(Math.round(mine))} held off ${String(Math.round(theirs))}` }),
            'min',
          );
        if ((atk ? aL : dL) === 0)
          put('flawless_victory', theirs, C({ det: `${String(Math.round(theirs))} destroyed, nothing lost` }));
      }
    });

    // lairs and their guardians
    const E = _lbObj(out['encounters']);
    a.lairs = plus(a.lairs, E['fought']);
    a.lairsWon = plus(a.lairsWon, E['won']);
    a.fled = plus(a.fled, E['fled']);
    gameLairs = plus(gameLairs, E['fought']);
    put('lairs_turn', E['won'], C());
    // (GUARDIAN_POWER_RANK holds a number for each power: `?? 0` is its `|| 0`)
    const powerRanks: Readonly<Partial<Record<string, number>>> = GUARDIAN_POWER_RANK;
    _lbArr(E['list']).forEach((e) => {
      if (!isAnObjectReadByItsFields(e)) return;
      const power = e['power'];
      const pw = powerRanks[typeof power === 'string' ? power : ''] ?? 0;
      const guardian = e['guardian'],
        feature = e['feature'];
      const gname =
        (typeof guardian === 'string' && guardian) || (typeof feature === 'string' && feature) || 'a guardian';
      const ctx = C({ who: null, det: `${gname}${power ? ' (' + asAPlusWritesIt(power) + ')' : ''}` });
      if (e['won']) {
        put('guardian_slain', pw, ctx);
        put('narrowest_escape', e['hpAfter'], ctx, 'min');
        if (pw >= 3)
          put(
            'luckiest_kill',
            e['hpAfter'],
            C({ det: `${gname} (${String(power)}) — ${String(_lbN(e['hpAfter']))} hp left` }),
            'min',
          );
        put('hardest_fight', e['dmg'], ctx);
      }
      if (e['killed'])
        put(
          'deadliest_guardian',
          pw,
          C({ det: `${gname}${power ? ' (' + asAPlusWritesIt(power) + ')' : ''} slew a champion` }),
        );
    });

    // captures
    const Cp = _lbObj(out['captures']);
    a.caps = plus(a.caps, Cp['gained']);
    a.lost = plus(a.lost, Cp['lost']);
    gameCaps = plus(gameCaps, Cp['gained']);
    put('captures_turn', Cp['gained'], C());
    put('lost_turn', Cp['lost'], C());
    _lbArr(Cp['list']).forEach((cp) => {
      if (cp && theField(cp, 'to') === pi) {
        const terrain = theField(cp, 'terrain');
        put(
          'richest_capture',
          theField(cp, 'tax'),
          C({
            det: `a ${(typeof terrain === 'string' && terrain) || 'province'} worth ${String(_lbN(theField(cp, 'tax')))} tax`,
          }),
        );
      }
    });

    // deaths
    const D = _lbObj(out['deaths']);
    a.deaths = plus(a.deaths, D['own']);
    a.kills = plus(a.kills, D['killed']);
    gameDeaths = plus(gameDeaths, D['own']);
    put('deaths_turn', D['own'], C());
    _lbArr(D['list']).forEach((d) => {
      if (d && theField(d, 'killerPi') === pi && theField(d, 'pi') !== pi) {
        const killerId = theField(d, 'killerId');
        if (killerId != null) {
          // (a count only `+ 1` writes: never 0)
          const k = inWords(killerId);
          a.killsByChar[k] = (a.killsByChar[k] ?? 0) + 1;
        }
        if (theField(d, 'king')) a.kingKills++;
      }
    });

    // spells
    const S = _lbObj(out['spells']);
    a.spells = plus(a.spells, S['cast']);
    a.spellsOk = plus(a.spellsOk, S['ok']);
    gameSpells = plus(gameSpells, S['cast']);
    put('spells_turn', S['cast'], C());
    _lbArr(S['list']).forEach((s) => {
      if (!isAnObjectReadByItsFields(s)) return;
      const spell = s['spell'];
      const sname = (typeof spell === 'string' && spell) || 'an unnamed spell';
      a.spellCount[sname] = (a.spellCount[sname] ?? 0) + 1; // (a count only `+ 1` writes: never 0)
      if (s['ok'] && _lbN(s['chance']) > 0)
        put('longest_shot', s['chance'], C({ det: `${sname} at ${String(_lbN(s['chance']))}%` }), 'min');
      if (s['ok']) put('grandest_casting', s['lvl'], C({ det: sname }));
    });
  });

  // per-realm totals → game-long records
  Object.entries(agg).forEach(([k, a]) => {
    const pi = Number(k),
      C = (x?: ARecordsContext) => lbCtx(pi, null, x);
    put('captures_game', a.caps, C());
    put('lost_game', a.lost, C());
    put('battles_game', a.battles, C());
    put('battles_won_game', a.won, C());
    put('kills_game', a.unitsKilled, C());
    put('losses_game', a.unitsLost, C());
    put('lairs_game', a.lairsWon, C());
    put('flights_game', a.fled, C());
    put('spells_game', a.spells, C());
    put('failed_spells_game', Number(a.spells) - Number(a.spellsOk), C());
    put('champions_lost', a.deaths, C());
    put('champions_slain', a.kills, C());
    put('kingslayer', a.kingKills, C());
    if (Number(a.battles) >= 4)
      put(
        'best_win_rate',
        Math.round((1000 * Number(a.won)) / Number(a.battles)) / 10,
        C({ det: `${String(a.won)} of ${String(a.battles)} battles` }),
      );
    const topChar = Object.entries(a.killsByChar).sort((x, y) => y[1] - x[1])[0];
    if (topChar) {
      const nm = _lbObj(
        events.find(
          (e) =>
            e.player_index === pi &&
            _lbArr(_lbObj(e.post)['characters']).some((c) => c && String(theField(c, 'id')) === topChar[0]),
        )?.post,
      );
      const ch = _lbArr(nm['characters']).find((c) => c && String(theField(c, 'id')) === topChar[0]);
      put('deadliest_champion', topChar[1], C({ who: ch ? theField(ch, 'name') : null }));
    }
    const topSpell = Object.entries(a.spellCount).sort((x, y) => y[1] - x[1])[0];
    if (topSpell) put('favourite_spell', topSpell[1], C({ det: topSpell[0] }));
  });

  // from the final results rows
  results.forEach((r) => {
    const pi = r.player_index,
      f = _lbObj(r.final),
      C = (x?: ARecordsContext) => lbCtx(pi, turns, x);
    put('final_score', r.score, C());
    put('final_provinces', f['provinces'], C());
    put('final_gold', f['gold'], C());
    put('final_strength', f['str'], C());
    put('final_tax_share', f['taxShare'], C());
    if (r.out_turn) put('earliest_out', r.out_turn, C({ det: (r.out_how ?? '') || 'out' }), 'min');
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
  put('biggest_world', Number(thisOrElse(setup.cols, 0)) * Number(thisOrElse(setup.rows, 0)), G0, 'max');
  put('most_battles_game', gameBattles, G0);
  put('bloodiest_game', gameCasualties, G0);
  put('most_spells_game', gameSpells, G0);
  put('most_captures_game', gameCaps, G0);
  put('most_deaths_game', gameDeaths, G0);
  put('most_lairs_game', gameLairs, G0);

  const finishedAt =
    (results
      .map((r) => r.created_at)
      .filter((at): at is string => Boolean(at))
      .sort()[0] ??
      '') ||
    kcClock.date().toISOString();
  return {
    game_id: inWords(gameId),
    game_name: (gameRow?.name ?? '') || (any.game_name ?? '') || 'Game ' + gameId,
    gm_user_id: (gameRow?.gm_user_id ?? '') || (currentUser ? currentUser.id : null),
    started_at: (gameRow?.created_at ?? '') || null,
    finished_at: finishedAt,
    turns,
    winner_realm: win ? win.realm : null,
    winner_player: win ? (win.is_bot ? null : personOf(win.player_index)) : null,
    winner_is_bot: win ? !!win.is_bot : null,
    victory: (any.victory ?? '') || null,
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
    build: `GM ${KC_BUILD_STAMP} lb${String(KC_LB_V)}`,
  };
}

/** What a game's record is built with when its caller already holds it: the games row, its realms' slots, its state. */
export interface WhatAGamesRecordIsBuiltWith {
  readonly gameRow?: AGameAsItsRecordReadsIt | null | undefined;
  readonly players?: readonly (ARealmsSlotAsTheRecordsReadIt | null | undefined)[] | null | undefined;
  readonly gs?: TheStateAsTheHallOfFameReadsIt | null | undefined;
}
/** `(e && e.message) || e` on what a `catch` caught: its message where it has one, else itself. */
function theMessageOrTheValueCaught(e: unknown): unknown {
  return thisOrElse(e ? theField(e, 'message') : e, e);
}
// Fetch this game's turn_events (only the two columns the records need) and write its record row.
// Idempotent: upsert on game_id. `preserve` keeps a GM's hand edits (note, hidden, display name).
export async function writeGameRecord(gameId: unknown, opts?: WhatAGamesRecordIsBuiltWith | null) {
  if (!_kcHasLb) return false;
  opts = opts ?? {};
  try {
    const gid = String(gameId);
    const { data: results, error: rErr } = await thePagesDb.theStatistics.theResultsOfThisGame(gid);
    if (rErr || !results?.length) return false;
    // 2026-10-09 (Toby item 5): ordered by turn AND realm. There is one row per realm per turn, so
    // ordering by turn alone left the order within a turn to the database, which may differ from one
    // page query to the next: rows at a page edge were skipped or read twice. A page that fails now
    // stops the build, rather than saving a record from part of the game over a complete one.
    const events: ARealmsTurnAsItsRecordReadsIt[] = [];
    for (let from = 0; ; from += 500) {
      const { data, error } = await thePagesDb.theStatistics.thisGamesTurnRecordsForItsEntryFromRowToRow(
        gid,
        from,
        from + 499,
      );
      if (error) {
        _kcLbLastErr = 'Could not read the turn history of game ' + gid + ': ' + error.message;
        renderLeaderboardBanner();
        return false;
      }
      events.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }
    let gameRow = opts.gameRow ?? null,
      players = opts.players ?? null,
      gs = opts.gs ?? null;
    if (!gameRow || !players || !gs) {
      const { data: full } = await thePagesDb.theHallOfFamesGames.thisGameWithItsWorldAndRealms(gid);
      if (full) {
        gameRow = gameRow ?? full;
        players = players ?? thisGamesSlots(full);
        if (!gs) {
          // the one place a game's state as parsed is read as the state the Hall of Fame reads: an object (its
          // `.players` read only on one; JSON holds no other kind that has them)
          const p = parseGameState(full);
          if (typeof p === 'object' && p !== null && theField(p, 'players')) gs = p;
        }
      }
    }
    const row = buildGameRecords(gid, gameRow, players ?? [], results, events, gs, await lbProfileNames(players));
    if (!row) return false;
    lbCountRow(row);
    const entry: AHallOfFameEntryAsTheGmPageWritesIt = row;
    const { data: old } = await thePagesDb.theHallOfFame.theGameMastersNotesOnThisGamesEntry(gid);
    if (old) {
      if (old.note) entry.note = old.note;
      if (old.hidden) entry.hidden = true;
      if (old.game_name) entry.game_name = old.game_name;
    }
    const { error } = await thePagesDb.theHallOfFame.writeTheseEntries([entry]);
    if (error) {
      _kcLbLastErr = error.message;
      renderLeaderboardBanner();
      return false;
    }
    _kcLbLastErr = null;
    renderLeaderboardBanner();
    return true;
  } catch (e) {
    _kcLbLastErr = String(theMessageOrTheValueCaught(e));
    return false;
  }
}
/** A game's slots as its read gives them, `full.game_players || []`: the list, or none for a read that held none. */
function thisGamesSlots(full: { readonly game_players?: ARealmsSlotAsTheRecordsReadIt[] | null | undefined }) {
  return full.game_players ?? [];
}
// {auth user id → profiles.name} for the humans in one game's slots. `profiles` is the only place
// a PERSON's name lives (game_players.display_name is their kingdom), and the GM portal can already
// read the table — the invite picker does. Cached for the tab's lifetime so a backfill over twenty
// games is one query, not twenty. A failure is not fatal: the standings then carry uid but no name,
// and the board falls back to whatever name it can resolve itself.
export let _lbProfCache: Record<string, string> | null = null,
  _lbProfErr: string | null = null;
/** The names kept so far, as a read or a write of the name of `id` meets them: for none (a rebuild began meanwhile),
 *  the TypeError that read or that write threw. */
function theNamesKept(id: string, how: 'reading' | 'setting'): Record<string, string> {
  if (_lbProfCache === null)
    throw new TypeError(`Cannot ${how === 'reading' ? 'read' : 'set'} properties of null (${how} '${id}')`);
  return _lbProfCache;
}
export async function lbProfileNames(
  players: readonly (ARealmsSlotAsTheRecordsReadIt | null | undefined)[] | null | undefined,
) {
  if (!_lbProfCache) {
    _lbProfCache = {};
    _lbProfErr = null;
    try {
      const { data, error } = await thePagesDb.theAccountsNames.theNameOfEveryAccount();
      if (error) _lbProfErr = error.message;
      (data ?? []).forEach((r) => {
        if (r.id && r.name) theNamesKept(r.id, 'setting')[r.id] = r.name;
      });
      if (!error && !Object.keys(theNamesKeptAsAWhole()).length)
        _lbProfErr = 'the profiles table returned no names at all';
    } catch (e) {
      _lbProfErr = String(theMessageOrTheValueCaught(e));
    }
  }
  const want = [...new Set((players ?? []).map((p) => p?.user_id).filter((id): id is string => Boolean(id)))];
  const out: Record<string, string> = {};
  want.forEach((id) => {
    const name = theNamesKept(id, 'reading')[id];
    if (name) out[id] = name;
  });
  return out;
}
/** The names kept so far, as `Object.keys` meets them: for none, the TypeError it threw. */
function theNamesKeptAsAWhole(): Record<string, string> {
  if (_lbProfCache === null) throw new TypeError('Cannot convert undefined or null to object');
  return _lbProfCache;
}
// What the last build actually managed to resolve — the tally the rebuild button reports, so a
// silent "names are still wrong" has a visible cause instead of needing the console.
export const _lbTally = { games: 0, humans: 0, uids: 0, named: 0 };
export function lbCountRow(row: {
  readonly standings?:
    | readonly ({ readonly bot?: unknown; readonly uid?: unknown; readonly player?: unknown } | null | undefined)[]
    | null
    | undefined;
}) {
  _lbTally.games++;
  (row.standings ?? []).forEach((st) => {
    if (!st || st.bot) return;
    _lbTally.humans++;
    if (st.uid) _lbTally.uids++;
    if (st.player) _lbTally.named++;
  });
}
// Build a Hall-of-Fame row for every finished game of this GM's that has results but no record yet.
// Button-driven, NOT automatic at sign-in: each game costs one sweep of its turn_events, and the
// Disk-IO lesson says never to put that on a path that runs by itself.
export async function backfillGameRecords(force: boolean) {
  if (!_kcHasLb || !currentUser) return 0;
  const btn = document.getElementById('lb-build-btn');
  const say = (t: string) => {
    const el = document.getElementById('lb-build-msg');
    if (el) el.textContent = t;
  };
  try {
    const { data: games } = await thePagesDb.theHallOfFamesGames.theFinishedGamesThisGameMasterRuns(currentUser.id);
    // paged (2026-10-09): one row per realm per game passes the database's 1000-row answer limit
    // after a hundred or so games, and the games past it were never offered for a record
    const res: { readonly game_id: string }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await thePagesDb.theStatistics.theGameOfEveryResultFromRowToRow(from, from + 999);
      if (error) {
        say('Could not read the finished games: ' + error.message);
        return 0;
      }
      res.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const withResults = new Set(res.map((r) => r.game_id));
    const { data: have } = await thePagesDb.theHallOfFame.theGameOfEveryEntry();
    const done = new Set((have ?? []).map((r) => r.game_id));
    // every game that HAS results — this GM's finished games, plus recorded games since deleted
    const todo = [...withResults].filter((id) => force || !done.has(id));
    if (!todo.length) {
      say('Every finished game already has a Hall-of-Fame record.');
      return 0;
    }
    if (btn) Reflect.set(btn, 'disabled', true);
    _lbProfCache = null; // a rebuild re-reads the names
    _lbTally.games = _lbTally.humans = _lbTally.uids = _lbTally.named = 0;
    let n = 0;
    for (const [i, id] of todo.entries()) {
      say(`Building ${String(i + 1)} of ${String(todo.length)}…`);
      const g = (games ?? []).find((x) => inWords(x.id) === id) ?? null;
      if (await writeGameRecord(id, { gameRow: g })) n++;
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
    if (el) el.innerHTML = String(kcHtml`${out}`);
    else say(String(kcHtml`${out}`));
    if (btn) Reflect.set(btn, 'disabled', false);
    return n;
  } catch (e) {
    say('Failed: ' + asAPlusWritesIt(theMessageOrTheValueCaught(e)));
    if (btn) Reflect.set(btn, 'disabled', false);
    return 0;
  }
}
/** A realm's slot as the statistics read it: its index, and its account (a bot's slot has none). */
interface ARealmsSlotAsTheStatisticsReadIt {
  readonly player_index: number;
  readonly user_id?: string | null | undefined;
}
/** A game's row as the statistics read it: its id (in words where it is written), its name and its settings. */
interface AGameAsTheStatisticsReadIt {
  readonly id: unknown;
  readonly name?: string | null | undefined;
  readonly meta?: unknown;
}
// One game_results row per realm, from a FINISHED state (gs.gameOver set). `players` = game_players rows.
export function buildGameResultRows(
  gs: TheStateAsTheHallOfFameReadsIt | null | undefined,
  gameRow: AGameAsTheStatisticsReadIt,
  players: readonly ARealmsSlotAsTheStatisticsReadIt[] | null | undefined,
): AResultAsTheGmPageWritesIt[] {
  if (!gs?.players) return [];
  const bots = new Set((players ?? []).filter(isBotRow).map((p) => p.player_index));
  const { rank } = telRankOrder(gs);
  const go = gs.gameOver ?? {};
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
    mapSize: thisOrElse(
      thisOrElseWhatIsMade(gs.mapSize, () => gameMetaOf(gameRow)?.['mapSize']),
      null,
    ),
    cols: gs.world ? gs.world.cols : gs.world,
    rows: gs.world ? gs.world.rows : gs.world,
    seaPct: gs.seaPct ?? (gs.world ? gs.world.seaPct : gs.world),
    realms: gs.players.length,
    bots: bots.size,
    humans: gs.players.length - bots.size,
    difficulty: telBotDifficultyOf(gs),
    diplomacy: gs.botDiplomacy === 'hostile' ? 'hostile' : 'normal',
  };
  const standingsAtTheEnd = gs.gameOver?.standings ?? [];
  return gs.players
    .map((pl, pi): AResultAsTheGmPageWritesIt | null => {
      if (!pl) return null;
      const snap = telRealmSnapshot(gs, pi);
      let outTurn = null,
        outHow = null;
      if (pl.conceded) {
        outTurn = (pl.concededTurn ?? 0) || null;
        outHow = 'conceded';
      } else if (pl._eliminated) {
        outTurn = (pl._eliminatedTurn ?? 0) || null;
        outHow = 'eliminated';
      }
      return {
        game_id: inWords(gameRow.id),
        game_name: (gameRow.name ?? '') || null,
        player_index: pi,
        is_bot: bots.has(pi),
        bot_difficulty: bots.has(pi) ? telBotDifficultyOf(gs) : null,
        realm: pl.name || null,
        race: pl.race || null,
        alignment: pl.alignment || null,
        rank: (rank[pi] ?? 0) || null,
        score: Math.round(Number(standingsAtTheEnd.find((s) => s?.index === pi)?.score ?? 0)),
        winner: go.winner === pi,
        victory,
        turns: (go.turn ?? 0) || (gs.turn ?? 0) || 0,
        out_turn: outTurn,
        out_how: outHow,
        setup,
        final: snap,
        build: `GM ${KC_BUILD_STAMP} tel${String(KC_TEL_V)}`,
      };
    })
    .filter((row) => row !== null);
}
// Record the results of a finished game (idempotent — upsert on game_id + player_index).
export async function writeGameResults(
  gs: TheStateAsTheHallOfFameReadsIt | null | undefined,
  gameRow: AGameAsTheStatisticsReadIt,
  players: readonly ARealmsSlotAsTheStatisticsReadIt[] | null | undefined,
) {
  if (!_kcHasTel) return false;
  const rows = buildGameResultRows(gs, gameRow, players);
  if (!rows.length) return false;
  const { error } = await thePagesDb.theStatistics.writeTheseResults(rows);
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
    const { data: games, error } =
      await thePagesDb.theHallOfFamesGames.theIdNameAndStateOfTheFinishedGamesThisGameMasterRuns(currentUser.id);
    if (error || !games?.length) return 0;
    const { data: have } = await thePagesDb.theStatistics.theGamesOfTheseGamesResults(games.map((g) => inWords(g.id)));
    const done = new Set((have ?? []).map((r) => r.game_id));
    let n = 0;
    for (const g of games) {
      if (done.has(inWords(g.id))) continue;
      const { data: full } = await thePagesDb.theHallOfFamesGames.thisGamesIdNameAndWorldWithEveryColumnOfItsRealms(
        g.id,
      );
      if (!full) continue;
      // the one place a game's state as parsed is read as the state the statistics read: an object (its `.players`
      // read only on one; JSON holds no other kind that has them)
      const gs = parseGameState(full);
      if (typeof gs !== 'object' || gs === null || !theField(gs, 'players')) continue;
      if (await writeGameResults(gs, full, thisGamesSlotsWithEveryColumn(full))) n++;
    }
    if (n) console.log(`[telemetry] recorded results for ${String(n)} finished game(s)`);
    return n;
  } catch {
    return 0;
  }
}
/** A game's slots, every column, as its read gives them, `full.game_players || []`. */
function thisGamesSlotsWithEveryColumn(full: {
  readonly game_players?: ARealmsSlotAsTheStatisticsReadIt[] | null | undefined;
}) {
  return full.game_players ?? [];
}
/** The turn's statistics as the telemetry writes them: each realm's snapshot before the turn and its orders, and the
 *  facts the turn's collectors caught. */
type TheTurnsStatisticsAsTheTelemetryWritesThem = Readonly<Partial<TheStatisticsOfTheTurn>>;
/** A realm's snapshot after the turn, as its turn record holds it: with its score and the titles it holds. */
type ARealmsSnapshotWithItsScoreAndTitles = NonNullable<ReturnType<typeof telRealmSnapshot>> & {
  _score?: number;
  titles?: { key: string; merit: number; who: string | null }[];
};
export async function writeTurnTelemetry(
  gs: TheStateAsTheHallOfFameReadsIt | null | undefined,
  gameRow: AGameAsTheStatisticsReadIt & AGameAsItsRecordReadsIt,
  players: readonly ARealmsSlotAsTheStatisticsReadIt[] | null | undefined,
  tel: TheTurnsStatisticsAsTheTelemetryWritesThem,
  turn: number,
) {
  if (!_kcHasTel || !gs?.players) return false;
  const bots = new Set((players ?? []).filter(isBotRow).map((p) => p.player_index));
  const { rank, standings } = telRankOrder(gs);
  const rows: ATurnRecordAsTheGmPageWritesIt[] = [];
  gs.players.forEach((pl, pi) => {
    if (!pl) return;
    const post: ARealmsSnapshotWithItsScoreAndTitles | null = telRealmSnapshot(gs, pi);
    if (post) post._score = (standings.standings[pi]?.score ?? 0) || 0;
    // the Imperial Titles this realm holds now (2026-10-09, Toby item 5) — the Hall of Fame keeps the
    // highest rating each holder reached, not only the holders at the end of the game
    if (post) {
      const held: { key: string; merit: number; who: string | null }[] = [];
      TITLE_DEFS.forEach((t) => {
        const h = standings.titles[t.key];
        if (h?.playerIndex !== pi || !(h.merit > 0)) return;
        const charId = h.charId;
        const ch = charId != null ? (gs.characters ?? []).find((c) => c?.id === charId) : null;
        held.push({ key: t.key, merit: Math.round(h.merit * 100) / 100, who: ch ? ch.name : null });
      });
      if (held.length) post.titles = held;
    }
    const pre = tel.pre?.[pi] ?? null;
    rows.push({
      game_id: inWords(gameRow.id),
      turn,
      player_index: pi,
      is_bot: bots.has(pi),
      bot_difficulty: bots.has(pi) ? telBotDifficultyOf(gs) : null,
      realm: pl.name || null,
      race: pl.race || null,
      alignment: pl.alignment || null,
      orders: tel.orders?.[pi] ?? null,
      pre,
      post,
      outcomes: telOutcomesFor(gs, pi, tel, pre, post, rank[pi]),
      build: `GM ${KC_BUILD_STAMP} tel${String(KC_TEL_V)}`,
    });
  });
  const { error } = await thePagesDb.theStatistics.writeTheseTurnRecords(rows);
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
    } catch {
      // Hall of Fame (2026-09-27): its failure never stops the turn
    }
  }
  return true;
}
