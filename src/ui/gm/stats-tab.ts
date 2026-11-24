import { kcHtml } from '../shared/kc-safe.ts';
import { SPELL_DEFS_P } from '../../content/kingdoms-call-data.ts';
import { KC_BUILD_STAMP } from './startup.ts';
import { ARMY_COST_MASTER } from '../../engine/army-tables.ts';
import { thePagesDb } from './config.ts';
import { _kcOverlord, show } from './sign-in.ts';
import { fortuneWinChance } from '../../engine/rules-on-plain-values/the-fortune-of-a-battle-its-curve-and-the-win-chance-it-gives.ts';
import { KC_TEL_V } from './startup.ts';
import { THE_ALIGNMENT_ORDERS } from '../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { theElementWithTheId } from '../shared/the-pages-element-with-the-id.ts';
import {
  isAList,
  theField,
  theRefusalAsThrown,
  theSumAsJavaScriptMakesIt,
  thisOrElse,
} from '../shared/a-value-of-any-kind-read-as-javascript-reads-it.ts';
import type {
  AGameResult,
  AGamesNameStatusAndTurn,
  ATurnRecordForTheStatsTab,
} from '../../db/the-db-interface-and-its-areas.ts';
import type { AnObjectReadByItsFields } from './hall-of-fame.ts';

// ════
// STATS TAB (2026-09-25) — reads turn_events + game_results and answers the balance questions.
// ════
// All the maths is done client-side on the raw rows (a few hundred realm-turns is a few MB, fine).
// Charts are plain HTML bars in the portal's own palette — no chart library, so nothing to load or
// fail. Every chart is also a table: the number sits beside every bar.
//
// ITS TYPES (plan P1-16r). A turn record's orders, snapshots and outcomes, and a result's setup and final state, are
// JSON written by any older build, so each is held as a value of any kind (`unknown`) and read as JavaScript reads
// it: `(x || {}).f` through `theFieldOfAValueOrOfNothing`, `(x || []).forEach` through `theListOrNothingToWalk`, and a
// `+` on them through `theSumAsJavaScriptMakesIt`, so each gives the value, or throws the error, the untyped read gave.
// The forms: docs/architecture/the-forms-that-keep-a-value-numbers-words-and-lists.md.

/** A realm's turn record as the tab holds it: its columns as read, its four JSON columns parsed, each any value. */
export type ATurnRecordAsTheTabHoldsIt = Omit<ATurnRecordForTheStatsTab, 'orders' | 'pre' | 'post' | 'outcomes'> & {
  readonly orders: unknown;
  readonly pre: unknown;
  readonly post: unknown;
  readonly outcomes: unknown;
};
/** A realm's result in a finished game as the tab holds it: its setup and final state parsed, each any value. */
export type AResultAsTheTabHoldsIt = Omit<AGameResult, 'setup' | 'final'> & {
  readonly setup: unknown;
  readonly final: unknown;
};
/** What the tab has loaded: the turn records, the results and the games' names, and when (0: not yet). */
export interface TheStatisticsTheTabHolds {
  rows: readonly ATurnRecordAsTheTabHoldsIt[] | null;
  results: readonly AResultAsTheTabHoldsIt[] | null;
  games: readonly AGamesNameStatusAndTurn[] | null;
  loadedAt: number;
}
export const _stats: TheStatisticsTheTabHolds = { rows: null, results: null, games: null, loadedAt: 0 };
export const STATS_ACTION_LABEL = {
  move: 'Move',
  defend: 'Defend',
  explore: 'Explore',
  search: 'Search lair',
  hunt_rumours: 'Hunt rumours',
  recruit: 'Recruit',
  hire: 'Hire hero',
  release: 'Release hero',
  leave_army: 'Leave army',
  pickup_army: 'Pick up army',
  disband_army: 'Disband',
  practice: 'Practice',
  rest: 'Rest',
  research: 'Research',
  spy: 'Spy',
  steal: 'Steal',
  cast_spell: 'Cast spell',
  use_item: 'Use item',
  equip_items: 'Equip',
  give_item: 'Give item',
  encounter: 'Encounter',
  // the five creed orders by their rows' names (R-189); the two removed orders have no row, so keep their words
  consecrate: THE_ALIGNMENT_ORDERS.consecrate.name,
  call_to_arms: THE_ALIGNMENT_ORDERS['call-to-arms'].name,
  broker: THE_ALIGNMENT_ORDERS.broker.name,
  awaken_wild: 'Awaken Wild',
  call_pit: 'Call from the Pit',
  harvest_field: THE_ALIGNMENT_ORDERS['harvest-the-field'].name,
  rite: THE_ALIGNMENT_ORDERS['perform-rite'].name,
};
export const STATS_COL = { crimson: '#7a1c1c', forest: '#2d4a1e', gold: '#c8922a', blue: '#2f5f8f', stone: '#6b5a42' };

// ── reading the statistics' JSON as JavaScript reads it ──
/** `(value || {})[key]` on a value of any kind: the field of a truthy value, else the empty object's. */
export function theFieldOfAValueOrOfNothing(value: unknown, key: string): unknown {
  return Reflect.get(Object(thisOrElse(value, {})), key);
}
/** `(value || [])` walked by `forEach` or `map`: a list as it is, none as an empty one; any other value throws the
 *  TypeError the call threw (only a list has them, and JSON holds no other value that does). */
export function theListOrNothingToWalk(value: unknown): readonly unknown[] {
  const held = thisOrElse(value, []);
  if (isAList(held)) return held;
  throw new TypeError('the value walked is not a list');
}
/** `Object.values(value)` on a value of any kind: for none, the TypeError the call threw. */
export function theValuesOf(value: unknown): unknown[] {
  if (value === null || value === undefined) throw new TypeError('Cannot convert undefined or null to object');
  return Object.values(value);
}
/** `{ ...value }` of a value of any kind: its own fields (none for none), as a spread copies them. */
export function theOwnFieldsOf(value: unknown): AnObjectReadByItsFields {
  if (value === null || value === undefined) return {};
  return Object.fromEntries(Object.entries(value));
}
/** A value of any kind in words, as `String` writes it: the key a table is read by (`table[value]` reads it so), or a
 *  part of a line of words (`'…' + value` and `${value}` write a JSON value so). */
function inWords(value: unknown): string {
  return String(value);
}
/** The signed-in account's id, where the code reads it unguarded: for none, the TypeError that read threw. */
function theSignedInAccountsId(): string {
  if (currentUser === null) throw new TypeError("Cannot read properties of null (reading 'id')");
  return currentUser.id;
}
/** `e.message || e` on what a `catch` caught: its message, else itself (for none, the TypeError the read threw). */
function theMessageOrTheValueCaught(e: unknown): unknown {
  return thisOrElse(theField(e, 'message'), e);
}

export async function openStats(force?: unknown) {
  show('sec-stats');
  const msg = theElementWithTheId('stats-msg', HTMLElement);
  if (!_kcHasTel) {
    msg.innerHTML = `<div class="msg-info">Telemetry is not active: the database has no telemetry tables (see the message on the game list). Nothing has been recorded.</div>`;
    theElementWithTheId('stats-body', HTMLElement).innerHTML = '';
    return;
  }
  if (force || !_stats.rows || Date.now() - _stats.loadedAt > 120000) {
    msg.innerHTML = '<div class="msg-info">⏳ Loading recorded turns…</div>';
    theElementWithTheId('stats-body', HTMLElement).innerHTML = '';
    try {
      const rows: ATurnRecordForTheStatsTab[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await thePagesDb.theStatistics.everyTurnRecordFromRowToRow(from, from + 999);
        if (error) throw theRefusalAsThrown(error);
        rows.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      const res: AGameResult[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await thePagesDb.theStatistics.everyResultFromRowToRow(from, from + 999);
        if (error) throw theRefusalAsThrown(error);
        res.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      // Master GM mode: every game's name (P0-32g, D-09)
      const { data: games } = await (_kcOverlord
        ? thePagesDb.theHallOfFamesGames.everyGamesNameStatusAndTurn()
        : thePagesDb.theHallOfFamesGames.theNameStatusAndTurnOfTheGamesThisGameMasterRuns(theSignedInAccountsId()));
      _stats.rows = rows.map((r) => ({
        ...r,
        orders: _statsJ(r.orders),
        pre: _statsJ(r.pre),
        post: _statsJ(r.post),
        outcomes: _statsJ(r.outcomes),
      }));
      _stats.results = res.map((r) => ({ ...r, setup: _statsJ(r.setup), final: _statsJ(r.final) }));
      _stats.games = games ?? [];
      _stats.loadedAt = Date.now();
    } catch (e) {
      msg.innerHTML = String(
        kcHtml`<div class="msg-error">Could not load statistics: ${theMessageOrTheValueCaught(e)}</div>`,
      );
      return;
    }
  }
  msg.innerHTML = '';
  // game picker: names from the games table; deleted games keep their rows under their id
  const sel = theElementWithTheId('stats-game', HTMLSelectElement);
  const keep = sel.value;
  const names: Record<string, string | null> = {};
  (_stats.games ?? []).forEach((g) => {
    names[g.id] = g.name;
  });
  (_stats.results ?? []).forEach((r) => {
    if (!names[r.game_id] && r.game_name) names[r.game_id] = r.game_name;
  });
  const ids = [...new Set(_stats.rows.map((r) => r.game_id))];
  sel.innerHTML = String(
    kcHtml`<option value="">All games</option>${ids.map((id) => kcHtml`<option value="${id}">${(names[id] ?? '') || 'deleted game ' + id.slice(0, 8)}${_statsFinished(id) ? ' ✓' : ''}</option>`)}`,
  );
  sel.value = ids.includes(keep) ? keep : '';
  renderStats();
}
export function _statsJ(v: unknown): unknown {
  if (v == null) return null;
  if (typeof v === 'string') {
    try {
      const parsed: unknown = JSON.parse(v);
      return parsed;
    } catch {
      return null;
    }
  }
  return v;
}
export function _statsFinished(gameId: string): boolean {
  return (_stats.results ?? []).some((r) => r.game_id === gameId);
}
export function _statsFilter() {
  const gid = theElementWithTheId('stats-game', HTMLSelectElement).value,
    who = theElementWithTheId('stats-who', HTMLSelectElement).value,
    diff = theElementWithTheId('stats-diff', HTMLSelectElement).value,
    fin = theElementWithTheId('stats-fin', HTMLSelectElement).value;
  const okGame = (id: string) => (!gid || id === gid) && (!fin || (fin === 'finished') === _statsFinished(id));
  const okRealm = (r: { readonly is_bot?: boolean | null; readonly bot_difficulty?: string | null }) =>
    (!who || (who === 'bot') === !!r.is_bot) && (!diff || !r.is_bot || r.bot_difficulty === diff);
  return {
    rows: (_stats.rows ?? []).filter((r) => okGame(r.game_id) && okRealm(r)),
    results: (_stats.results ?? []).filter((r) => okGame(r.game_id) && okRealm(r)),
    allRows: (_stats.rows ?? []).filter((r) => okGame(r.game_id)),
  };
}
/** One bar of a chart: its label, its value (read as a number), the words beside it, its colour and its tick. */
export interface ABarOfTheStatsTab {
  readonly label: unknown;
  readonly v: unknown;
  readonly txt?: string;
  readonly col?: unknown;
  readonly mark?: number;
}
// ── tiny chart kit ── a horizontal bar per row: label · bar · value text. `items` = [{label, v, txt, col, sub}]
export function statsBars(
  items: readonly ABarOfTheStatsTab[],
  opt?: { readonly labelW?: number; readonly max?: number } | null,
) {
  opt = opt ?? {};
  const max = Math.max(1e-9, ...items.map((i) => Number(thisOrElse(i.v, 0))), (opt.max ?? 0) || 0);
  return kcHtml`<div style="display:grid;grid-template-columns:${(opt.labelW ?? 0) || 150}px 1fr auto;gap:4px 8px;align-items:center;font-size:.8rem">${items.map(
    (i) => kcHtml`
    <div style="color:var(--ink-light);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${thisOrElse(i.label, '')}">${i.label}</div>
    <div style="background:#eee4cc;border-radius:3px;height:12px;position:relative"><div style="width:${Math.max(0, Math.min(100, (100 * Number(thisOrElse(i.v, 0))) / max))}%;height:100%;border-radius:3px;background:${thisOrElse(i.col, STATS_COL.crimson)}"></div>${i.mark != null ? kcHtml`<div title="expected" style="position:absolute;top:-2px;left:${Math.max(0, Math.min(100, (100 * i.mark) / max))}%;width:2px;height:16px;background:${STATS_COL.blue}"></div>` : ''}</div>
    <div style="font-family:monospace;font-size:.74rem;color:var(--stone);white-space:nowrap">${i.txt ?? i.v}</div>`,
  )}</div>`;
}
/** One line of a line chart: its name, its points (a turn and a value) and its colour. */
export interface ALineOfTheStatsTab {
  readonly name: string;
  readonly pts: readonly (readonly [number, number])[];
  readonly col: unknown;
}
// a small SVG line chart: series = [{name, pts:[[x,y]...], col}], x = turn number
export function statsLines(series: readonly ALineOfTheStatsTab[], opt?: { readonly note?: string } | null) {
  opt = opt ?? {};
  const W = 560,
    H = 170,
    L = 40,
    R = 12,
    T = 12,
    B = 26;
  const xs = series.flatMap((s) => s.pts.map((p) => p[0])),
    ys = series.flatMap((s) => s.pts.map((p) => p[1]));
  if (!xs.length) return kcHtml`<div style="color:var(--stone);font-size:.8rem">No data.</div>`;
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y1 = Math.max(1e-9, ...ys),
    y0 = 0;
  const X = (x: number) => L + (x1 === x0 ? 0 : (x - x0) / (x1 - x0)) * (W - L - R),
    Y = (y: number) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  const ticks = [0, 0.5, 1].map((f) => y0 + f * (y1 - y0));
  const svg = [
    kcHtml`<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;font-family:'Crimson Text',serif;font-size:10px">`,
  ];
  ticks.forEach((t) => {
    svg.push(
      kcHtml`<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" stroke="#d8cbb0" stroke-width="1"/><text x="${L - 4}" y="${Y(t) + 3}" text-anchor="end" fill="#6b5a42">${Math.round(t * 10) / 10}</text>`,
    );
  });
  for (let x = x0; x <= x1; x++) {
    if (x1 - x0 > 12 && x % Math.ceil((x1 - x0) / 12)) continue;
    svg.push(kcHtml`<text x="${X(x)}" y="${H - 8}" text-anchor="middle" fill="#6b5a42">${x}</text>`);
  }
  series.forEach((s) => {
    const pts = s.pts.slice().sort((a, b) => a[0] - b[0]);
    if (!pts.length) return;
    svg.push(
      kcHtml`<polyline fill="none" stroke="${s.col}" stroke-width="2" stroke-linejoin="round" points="${pts.map((p) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/>`,
    );
    pts.forEach((p) => {
      svg.push(
        kcHtml`<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="2.5" fill="${s.col}"><title>${s.name} · turn ${p[0]}: ${Math.round(p[1] * 10) / 10}</title></circle>`,
      );
    });
  });
  svg.push(
    kcHtml`<text x="${W - R}" y="${H - 8}" text-anchor="start" fill="#6b5a42" font-size="9" dx="6">turn</text></svg>`,
  );
  return kcHtml`<div>${svg}<div style="font-size:.74rem;color:var(--stone);margin-top:2px">${series.map((s, i) => kcHtml`${i ? kcHtml` &nbsp; ` : ''}<span style="display:inline-block;width:10px;height:10px;background:${s.col};border-radius:2px;vertical-align:middle;margin-right:4px"></span>${s.name}`)}${opt.note ? ' · ' + opt.note : ''}</div></div>`;
}
export function statsCard(title: string, body: unknown, note?: string) {
  return kcHtml`<div class="card"><h2>${title}</h2>${note ? kcHtml`<div style="font-size:.78rem;color:var(--stone);margin:-6px 0 10px">${note}</div>` : ''}${body}</div>`;
}
export const _pct = (a: number, b: number) => (b > 0 ? Math.round((100 * a) / b) : 0);
/** The mean of values of any kind (statistics as held), added as `+` adds them, then divided as `/` reads the sum. */
export const _avg = (a: readonly unknown[]) =>
  a.length ? Number(a.reduce<number | string>((s, x) => theSumAsJavaScriptMakesIt(s, x), 0)) / a.length : 0;
export function renderStats() {
  const body = document.getElementById('stats-body');
  if (!body || !_stats.rows) return;
  const { rows, results, allRows } = _statsFilter();
  if (!rows.length) {
    body.innerHTML =
      '<div class="msg-info">No recorded turns match these filters yet. Rows are written each time a turn is resolved.</div>';
    return;
  }
  const pk = theFieldOfAValueOrOfNothing;
  const games = [...new Set(rows.map((r) => r.game_id))];
  const winners = new Set(results.filter((r) => r.winner).map((r) => `${r.game_id}#${String(r.player_index)}`));
  const isWinner = (r: Pick<ATurnRecordAsTheTabHoldsIt, 'game_id' | 'player_index'>) =>
    winners.has(`${r.game_id}#${String(r.player_index)}`);
  const finishedGames = new Set(results.map((r) => r.game_id));
  const html: ReturnType<typeof statsCard>[] = [];
  // 1. overview
  const humansRT = rows.filter((r) => !r.is_bot).length,
    botsRT = rows.length - humansRT;
  // `s + x || 0` is `(s + x) || 0`: a turn that holds no such count starts the total again from 0, as it always did
  const theTotalOf = (outcome: string, count: string) =>
    rows.reduce<unknown>((s, r) => thisOrElse(theSumAsJavaScriptMakesIt(s, pk(pk(r.outcomes, outcome), count)), 0), 0);
  html.push(
    statsCard(
      'Overview',
      kcHtml`<div style="display:flex;gap:18px;flex-wrap:wrap;font-size:.85rem">
    <div><div style="font-family:Cinzel,serif;font-size:1.4rem;color:var(--crimson)">${games.length}</div><div style="color:var(--stone)">games recorded</div></div>
    <div><div style="font-family:Cinzel,serif;font-size:1.4rem;color:var(--crimson)">${finishedGames.size}</div><div style="color:var(--stone)">finished</div></div>
    <div><div style="font-family:Cinzel,serif;font-size:1.4rem;color:var(--crimson)">${rows.length}</div><div style="color:var(--stone)">realm-turns (${humansRT} human · ${botsRT} bot)</div></div>
    <div><div style="font-family:Cinzel,serif;font-size:1.4rem;color:var(--crimson)">${theTotalOf('battles', 'asAttacker')}</div><div style="color:var(--stone)">battles</div></div>
    <div><div style="font-family:Cinzel,serif;font-size:1.4rem;color:var(--crimson)">${theTotalOf('encounters', 'fought')}</div><div style="color:var(--stone)">lair fights</div></div>
    <div><div style="font-family:Cinzel,serif;font-size:1.4rem;color:var(--crimson)">${theTotalOf('deaths', 'own')}</div><div style="color:var(--stone)">characters killed</div></div>
  </div>`,
    ),
  );
  // 2. who wins
  if (results.length) {
    const by = (key: (r: AResultAsTheTabHoldsIt) => string | null | undefined) => {
      const m: Record<string, { n: number; w: number; rank: number[] }> = {};
      results.forEach((r) => {
        const k = key(r);
        if (k == null) return;
        const o = (m[k] ??= { n: 0, w: 0, rank: [] });
        o.n++;
        if (r.winner) o.w++;
        if (r.rank) o.rank.push(r.rank);
      });
      return Object.entries(m)
        .map(([k, o]) => ({
          label: k,
          v: _pct(o.w, o.n),
          txt: `${String(_pct(o.w, o.n))}% won · ${String(o.n)} realm${o.n !== 1 ? 's' : ''} · avg rank ${_avg(o.rank).toFixed(1)}`,
        }))
        .sort((a, b) => b.v - a.v);
    };
    const gv: Record<string, string | null> = {},
      glen: Record<string, number | null> = {};
    results.forEach((r) => {
      gv[r.game_id] = r.victory;
      glen[r.game_id] = r.turns;
    });
    const vict: Record<string, number> = {};
    Object.values(gv).forEach((v) => {
      vict[String(v)] = (vict[String(v)] ?? 0) + 1;
    });
    const gN = Object.keys(glen).length;
    html.push(
      statsCard(
        'Who wins',
        kcHtml`<h3>Humans vs bots</h3>${statsBars(by((r) => (r.is_bot ? `Bot (${(r.bot_difficulty ?? '') || '?'})` : 'Human')))}
       <h3 style="margin-top:14px">By race</h3>${statsBars(by((r) => r.race))}
       <h3 style="margin-top:14px">By alignment</h3>${statsBars(by((r) => r.alignment))}
       <h3 style="margin-top:14px">How games end</h3>${statsBars(Object.entries(vict).map(([k, n]) => ({ label: k, v: n, txt: `${String(n)} game${n !== 1 ? 's' : ''}`, col: STATS_COL.forest })))}
       <div style="font-size:.8rem;margin-top:8px">Average game length: <strong>${_avg(Object.values(glen)).toFixed(1)} turns</strong> over ${gN} finished game${gN !== 1 ? 's' : ''}. Realms that dropped out early: ${results.filter((r) => r.out_how).length} (${results.filter((r) => r.out_how === 'conceded').length} conceded, ${results.filter((r) => r.out_how === 'eliminated').length} eliminated).</div>`,
        'From the game_results rows — one per realm per finished game. Win rates are per realm, so with 4 realms a fair race sits at 25%.',
      ),
    );
    // 3. early lead → final rank
    const T5 = 5;
    let lead = 0,
      leadWon = 0;
    const corr: [unknown, number][] = [];
    finishedGames.forEach((gid) => {
      const at = allRows.filter((r) => r.game_id === gid && r.turn === T5);
      if (!at.length) return;
      const top = at
        .slice()
        .sort(
          (a, b) => Number(thisOrElse(pk(b.post, 'taxShare'), 0)) - Number(thisOrElse(pk(a.post, 'taxShare'), 0)),
        )[0];
      // never met: the list was just found to hold a row
      if (top === undefined) return;
      lead++;
      if (isWinner(top)) leadWon++;
      at.forEach((r) => {
        const fr = results.find((x) => x.game_id === gid && x.player_index === r.player_index);
        if (fr?.rank) corr.push([thisOrElse(theField(r.post, 'taxShare'), 0), fr.rank]);
      });
    });
    if (lead) {
      html.push(
        statsCard(
          'Does an early lead decide it?',
          kcHtml`<div style="font-size:.85rem">The realm holding the most of the world's tax base at the end of turn ${T5} went on to win <strong>${leadWon} of ${lead}</strong> finished games (${_pct(leadWon, lead)}%). ${_pct(leadWon, lead) >= 75 ? 'That is a strong snowball — the mid-game may be too kind to the leader (coalitions, catch-up mechanics, lair rewards for the trailing realms are the usual levers).' : _pct(leadWon, lead) <= 35 ? 'Early leads are not sticking — the game has real come-backs.' : 'A lead helps but does not settle it — a healthy place to be.'}</div>
        <h3 style="margin-top:12px">Turn-${T5} tax share vs final rank</h3>${statsBars(
          corr
            .sort((a, b) => Number(b[0]) - Number(a[0]))
            .slice(0, 16)
            .map(([sh, rk]) => ({
              label: `${inWords(sh)}% of world`,
              v: sh,
              txt: `finished #${String(rk)}`,
              col: rk === 1 ? STATS_COL.gold : STATS_COL.stone,
            })),
          { labelW: 110 },
        )}`,
          `Needs finished games with at least ${String(T5)} turns recorded.`,
        ),
      );
    }
  } else {
    html.push(
      statsCard(
        'Who wins',
        kcHtml`<div style="font-size:.85rem;color:var(--stone)">No finished games in this selection yet — win rates, victory types and the early-lead test appear once a game ends (or once you Record Results for a game that finished before telemetry existed: this happens automatically at sign-in for finished games).</div>`,
      ),
    );
  }
  // 4. trajectories
  {
    const key = (r: ATurnRecordAsTheTabHoldsIt) =>
      isWinner(r) ? 'winners' : finishedGames.has(r.game_id) ? 'others' : 'running';
    const mk = (f: (p: unknown) => unknown, name: string) => {
      const byT: Record<string, Record<string, unknown[]>> = {};
      rows.forEach((r) => {
        if (!r.post) return;
        const k = key(r);
        if (k === 'running' && finishedGames.size) return;
        const o = (byT[String(r.turn)] ??= {});
        (o[k] ??= []).push(f(r.post));
      });
      const ser: ALineOfTheStatsTab[] = [];
      ['winners', 'others', 'running'].forEach((k, i) => {
        const pts = Object.entries(byT)
          .map(([t, o]): readonly [number, number] | null => {
            const atTheTurn = o[k];
            return atTheTurn ? [+t, _avg(atTheTurn)] : null;
          })
          .filter((p) => p !== null);
        if (pts.length)
          ser.push({
            name:
              k === 'running' ? 'all realms (games still running)' : k === 'winners' ? 'eventual winners' : 'the rest',
            pts,
            col: [STATS_COL.gold, STATS_COL.stone, STATS_COL.blue][i],
          });
      });
      return kcHtml`<h3 style="margin-top:12px">${name}</h3>${statsLines(ser)}`;
    };
    html.push(
      statsCard(
        'How realms grow',
        [
          mk((p) => theField(p, 'provinces'), 'Provinces held'),
          mk((p) => theField(p, 'gold'), 'Treasury (gold)'),
          mk((p) => theField(p, 'str'), 'Army strength (led + garrison)'),
          mk((p) => theField(p, 'heroes'), 'Heroes in service'),
        ],
        'Average per realm at the end of each turn. Where a game has finished, eventual winners are drawn apart from the rest — the gap between the two lines is what winning looks like in this ruleset, and the turn where it opens is where the game is decided.',
      ),
    );
  }
  // 5. orders
  {
    /** Each phase order of every character in a turn record, as the record's orders hold them (`chars[*].ph[*]`). */
    const eachPhaseOrderOf = (r: ATurnRecordAsTheTabHoldsIt, onEach: (o: unknown) => void) => {
      theValuesOf(thisOrElse(pk(r.orders, 'chars'), {})).forEach((c) => {
        theListOrNothingToWalk(theField(c, 'ph')).forEach(onEach);
      });
    };
    const mix = (sub: readonly ATurnRecordAsTheTabHoldsIt[]) => {
      const m: Record<string, number> = {};
      let tot = 0;
      sub.forEach((r) => {
        eachPhaseOrderOf(r, (o) => {
          const a = inWords(theField(o, 'a'));
          // a count: `|| 0` and `?? 0` give the same for none and for every count (1 and up)
          m[a] = (m[a] ?? 0) + 1;
          tot++;
        });
      });
      return { m, tot };
    };
    const H = mix(rows.filter((r) => !r.is_bot)),
      Bt = mix(rows.filter((r) => r.is_bot)),
      Wn = mix(rows.filter((r) => isWinner(r))),
      Ls = mix(rows.filter((r) => finishedGames.has(r.game_id) && !isWinner(r)));
    const acts = [...new Set([...Object.keys(H.m), ...Object.keys(Bt.m)])].sort(
      (a, b) => (H.m[b] ?? 0) + (Bt.m[b] ?? 0) - ((H.m[a] ?? 0) + (Bt.m[a] ?? 0)),
    );
    const labels: Readonly<Partial<Record<string, string>>> = STATS_ACTION_LABEL;
    const lab = (a: string) => (labels[a] ?? '') || a.replace(/_/g, ' ');
    type AMix = ReturnType<typeof mix>;
    const twoCol = (A: AMix, B: AMix, an: string, bn: string) =>
      kcHtml`<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div><h3>${an} (${A.tot} character-phases)</h3>${statsBars(
        acts.map((a) => ({
          label: lab(a),
          v: _pct(A.m[a] ?? 0, A.tot),
          txt: `${String(_pct(A.m[a] ?? 0, A.tot))}%`,
        })),
        { labelW: 110, max: 60 },
      )}</div><div><h3>${bn} (${B.tot})</h3>${statsBars(
        acts.map((a) => ({
          label: lab(a),
          v: _pct(B.m[a] ?? 0, B.tot),
          txt: `${String(_pct(B.m[a] ?? 0, B.tot))}%`,
          col: STATS_COL.forest,
        })),
        { labelW: 110, max: 60 },
      )}</div></div>`;
    const ob = [twoCol(H, Bt, 'Humans', 'Bots')];
    if (Wn.tot && Ls.tot)
      ob.push(kcHtml`<div style="margin-top:14px">${twoCol(Wn, Ls, 'Eventual winners', 'The rest')}</div>`);
    html.push(
      statsCard(
        'What players order',
        ob,
        'Share of every character-phase given each order. Orders humans give that bots never do (and the reverse) are the first thing to teach the bots; orders winners give more than losers are the ones that matter. A "defend" share above ~40% usually means idle heroes.',
      ),
    );
    // recruits by unit type
    const rec: Record<string, number> = {};
    rows.forEach((r) => {
      eachPhaseOrderOf(r, (o) => {
        if (theField(o, 'a') !== 'recruit' || !theField(o, 't')) return;
        const m = /^([^|]+)\|(\d+)/.exec(inWords(theField(o, 't')));
        // a count of whole numbers (0 and up): `|| 0` and `?? 0` give the same
        if (m) rec[String(m[1])] = (rec[String(m[1])] ?? 0) + parseInt(String(m[2]));
      });
    });
    const inPlay: Record<string, number> = {};
    rows
      .filter((r) => r.post)
      .forEach((r) => {
        theListOrNothingToWalk(theField(r.post, 'characters')).forEach((c) => {
          theListOrNothingToWalk(theField(c, 'units')).forEach((u) => {
            const t = inWords(theField(u, 't'));
            inPlay[t] = (inPlay[t] ?? 0) + 1;
          });
        });
      });
    const types = Object.keys(ARMY_COST_MASTER)
      .filter((t) => Boolean(rec[t]) || Boolean(inPlay[t]))
      .sort((a, b) => (rec[b] ?? 0) - (rec[a] ?? 0));
    const never = Object.keys(ARMY_COST_MASTER).filter((t) => !rec[t] && !inPlay[t] && !t.includes('Garrison'));
    html.push(
      statsCard(
        'Units recruited',
        [
          statsBars(
            types.slice(0, 24).map((t) => ({
              label: t,
              v: rec[t] ?? 0,
              txt: `${String(rec[t] ?? 0)} ordered · ${String(inPlay[t] ?? 0)} unit-turns led`,
            })),
            { labelW: 150 },
          ),
          never.length
            ? kcHtml`<div style="font-size:.78rem;color:var(--stone);margin-top:8px">Never recruited or led in these rows: ${never.join(', ')}.</div>`
            : '',
        ],
        'Units ordered by type (from Recruit orders) beside how often each type is actually seen in a led column. A unit nobody buys is either priced wrong, unavailable, or not understood.',
      ),
    );
  }
  // 6. battles
  {
    const B: AnObjectReadByItsFields[] = [];
    const seen = new Set<string>();
    rows.forEach((r) => {
      theListOrNothingToWalk(pk(pk(r.outcomes, 'battles'), 'list')).forEach((b) => {
        const k = `${r.game_id}#${String(r.turn)}#${inWords(theField(b, 'ph'))}#${inWords(theField(b, 'prov'))}#${inWords(theField(b, 'atkChar'))}#${inWords(theField(b, 'atkStr'))}#${inWords(theField(b, 'defStr'))}`;
        if (seen.has(k)) return;
        seen.add(k);
        B.push({
          ...theOwnFieldsOf(b),
          game: r.game_id,
          turn: r.turn,
          atkBot: r.is_bot && theField(b, 'atkPi') === r.player_index,
        });
      });
    });
    if (B.length) {
      const buckets: readonly (readonly [label: string, lo: number, hi: number])[] = [
        ['< 0.5×', 0, 0.5],
        ['0.5–0.8×', 0.5, 0.8],
        ['0.8–1.25× (even)', 0.8, 1.25],
        ['1.25–2×', 1.25, 2],
        ['2–3×', 2, 3],
        ['3–4×', 3, 4],
        ['≥ 4×', 4, 1e9],
      ];
      /** A battle's strength ratio, attacker to defender (`1e9` where the defender has none), as `/` reads them. */
      const theRatioOf = (b: AnObjectReadByItsFields) =>
        Number(b['defStr']) > 0 ? Number(b['atkStr']) / Number(b['defStr']) : 1e9;
      const items = buckets
        .map(([label, lo, hi]) => {
          const sub = B.filter((b) => {
            const r = theRatioOf(b);
            return r >= lo && r < hi;
          });
          if (!sub.length) return null;
          const exp = _avg(sub.map((b) => 100 * fortuneWinChance(theRatioOf(b))));
          return {
            label,
            v: _pct(sub.filter((b) => b['won']).length, sub.length),
            mark: exp,
            txt: `${String(_pct(sub.filter((b) => b['won']).length, sub.length))}% attacker wins · expected ${String(Math.round(exp))}% · ${String(sub.length)} battle${sub.length !== 1 ? 's' : ''}`,
          };
        })
        .filter((i) => i !== null);
      const byT: Record<string, { n: number; w: number }> = {};
      B.forEach((b) => {
        const o = (byT[inWords(b['terrain'])] ??= { n: 0, w: 0 });
        o.n++;
        if (b['won']) o.w++;
      });
      const byK: Record<string, { n: number; w: number; al: number | string; dl: number | string }> = {};
      B.forEach((b) => {
        const o = (byK[inWords(b['kind'])] ??= { n: 0, w: 0, al: 0, dl: 0 });
        o.n++;
        if (b['won']) o.w++;
        o.al = theSumAsJavaScriptMakesIt(o.al, thisOrElse(b['atkLost'], 0));
        o.dl = theSumAsJavaScriptMakesIt(o.dl, thisOrElse(b['defLost'], 0));
      });
      // its words are never empty, so `??` gives what `||` gave
      const kindLab: Readonly<Partial<Record<string, string>>> = {
        neutral: 'vs neutral defenders',
        garrison: 'vs an enemy garrison',
        guard: 'vs a neutral chieftain',
        pvp: 'vs an enemy commander',
      };
      html.push(
        statsCard(
          'Battles',
          kcHtml`<div style="font-size:.85rem;margin-bottom:8px">${B.length} battles · attackers won <strong>${_pct(B.filter((b) => b['won']).length, B.length)}%</strong> · average losses ${_avg(B.map((b) => thisOrElse(b['atkLost'], 0))).toFixed(2)} units (attacker) / ${_avg(B.map((b) => thisOrElse(b['defLost'], 0))).toFixed(2)} (defender) · ${B.filter((b) => Number(b['carry']) > 0).length} carried on into a later phase.</div>
         <h3>Attacker win rate by strength ratio (attacker ÷ defender, before the dice)</h3>${statsBars(items, { labelW: 130, max: 100 })}
         <div style="font-size:.76rem;color:var(--stone);margin:4px 0 12px">The blue tick is what the fortune-of-battle curve says should happen at that ratio (2× → 80%, 3× → 90%, 4× → certain). Bars well off their ticks over many battles mean something outside the strength maths is deciding fights — pre-battle magic, archery, or a bug.</div>
         <h3>By terrain</h3>${statsBars(
           Object.entries(byT).map(([t, o]) => ({
             label: t,
             v: _pct(o.w, o.n),
             txt: `${String(_pct(o.w, o.n))}% attacker wins · ${String(o.n)}`,
             col: STATS_COL.forest,
           })),
           { max: 100 },
         )}
         <h3 style="margin-top:12px">By opponent</h3>${statsBars(
           Object.entries(byK).map(([k, o]) => ({
             label: kindLab[k] ?? k,
             v: _pct(o.w, o.n),
             txt: `${String(_pct(o.w, o.n))}% attacker wins · ${String(o.n)} · losses ${(Number(o.al) / o.n).toFixed(1)} / ${(Number(o.dl) / o.n).toFixed(1)}`,
             col: STATS_COL.blue,
           })),
           { labelW: 170, max: 100 },
         )}`,
          "Every field battle, once (a battle appears in both sides' rows; it is counted here a single time).",
        ),
      );
    }
  }
  // 7. lairs
  {
    const E: AnObjectReadByItsFields[] = [];
    rows.forEach((r) => {
      theListOrNothingToWalk(pk(pk(r.outcomes, 'encounters'), 'list')).forEach((e) =>
        E.push({ ...theOwnFieldsOf(e), bot: r.is_bot }),
      );
    });
    if (E.length) {
      const byP: Record<string, { n: number; w: number; f: number; k: number; d: unknown[] }> = {};
      E.forEach((e) => {
        const o = (byP[inWords(thisOrElse(e['power'], '?'))] ??= { n: 0, w: 0, f: 0, k: 0, d: [] });
        o.n++;
        if (e['won']) o.w++;
        if (e['fled']) o.f++;
        if (e['killed']) o.k++;
        o.d.push(thisOrElse(e['dmg'], 0));
      });
      const order = ['Weak', 'Moderate', 'Powerful', 'Legendary'];
      html.push(
        statsCard('Lair fights', [
          statsBars(
            Object.entries(byP)
              .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
              .map(([p, o]) => ({
                label: p,
                v: _pct(o.w, o.n),
                txt: `${String(_pct(o.w, o.n))}% cleared · ${String(o.n)} fight${o.n !== 1 ? 's' : ''} · ${String(o.f)} fled · ${String(o.k)} hero${o.k !== 1 ? 'es' : ''} killed · avg ${_avg(o.d).toFixed(1)} damage taken`,
              })),
            { max: 100 },
          ),
          kcHtml`<div style="font-size:.78rem;color:var(--stone);margin-top:8px">Bots fought ${E.filter((e) => e['bot']).length} of these; humans ${E.filter((e) => !e['bot']).length}. The guardian ladder was tuned to a ~95% clear rate for a hero built for the band — a band far below that is being attempted too early.</div>`,
        ]),
      );
    }
  }
  // 8. spells
  {
    const S: Record<string, { n: number; ok: number; bot: number; ch: unknown[] }> = {};
    rows.forEach((r) => {
      theListOrNothingToWalk(pk(pk(r.outcomes, 'spells'), 'list')).forEach((s) => {
        const o = (S[inWords(theField(s, 'spell'))] ??= { n: 0, ok: 0, bot: 0, ch: [] });
        o.n++;
        if (theField(s, 'ok')) o.ok++;
        if (r.is_bot) o.bot++;
        o.ch.push(thisOrElse(theField(s, 'chance'), 0));
      });
    });
    const ents = Object.entries(S).sort((a, b) => b[1].n - a[1].n);
    if (ents.length) {
      const spells: Readonly<Partial<Record<string, { readonly phase?: unknown }>>> = SPELL_DEFS_P;
      const never = Object.keys(spells).filter((n) => Boolean(spells[n]?.phase) && !S[n]);
      html.push(
        statsCard(
          'Spells cast (phase orders)',
          [
            statsBars(
              ents.map(([n, o]) => ({
                label: n,
                v: o.n,
                txt: `${String(o.n)} cast · ${String(_pct(o.ok, o.n))}% took (avg chance ${String(Math.round(_avg(o.ch)))}%) · ${String(o.bot)} by bots`,
              })),
              { labelW: 150 },
            ),
            never.length
              ? kcHtml`<div style="font-size:.78rem;color:var(--stone);margin-top:8px">Never cast as a phase order: ${never.join(', ')}.</div>`
              : '',
          ],
          'Battle-magic and duel spells are not counted here (they are chosen in encounter plans, not as orders).',
        ),
      );
    }
  }
  // 9. deaths & captures
  {
    const D: (AnObjectReadByItsFields & { readonly turn: number })[] = [];
    const seen = new Set<string>();
    rows.forEach((r) => {
      theListOrNothingToWalk(pk(pk(r.outcomes, 'deaths'), 'list')).forEach((d) => {
        const k = `${r.game_id}#${String(r.turn)}#${inWords(theField(d, 'charId'))}`;
        if (seen.has(k)) return;
        seen.add(k);
        D.push({ ...theOwnFieldsOf(d), game: r.game_id, turn: r.turn });
      });
    });
    const C: unknown[] = [];
    const seenC = new Set<string>();
    rows.forEach((r) => {
      theListOrNothingToWalk(pk(pk(r.outcomes, 'captures'), 'list')).forEach((c) => {
        const k = `${r.game_id}#${String(r.turn)}#${inWords(theField(c, 'ph'))}#${inWords(theField(c, 'prov'))}#${inWords(theField(c, 'to'))}`;
        if (seenC.has(k)) return;
        seenC.add(k);
        C.push(c);
      });
    });
    const byTurn: Record<string, number> = {};
    D.forEach((d) => {
      byTurn[d.turn] = (byTurn[d.turn] ?? 0) + 1;
    });
    const how: Record<string, number> = {};
    D.forEach((d) => {
      const cause = inWords(thisOrElse(d['how'], 'other'));
      how[cause] = (how[cause] ?? 0) + 1;
    });
    const Dr = D.filter((d) => d['pi'] != null),
      Dn = D.length - Dr.length;
    // its words are never empty, so `??` gives what `||` gave
    const causes: Readonly<Partial<Record<string, string>>> = {
      character: 'killed by an enemy character',
      neutral: 'killed by a neutral / guardian',
      other: 'other (duel, spell, execution…)',
    };
    html.push(
      statsCard(
        'Deaths and conquests',
        kcHtml`<div style="font-size:.85rem">${Dr.length} realm character${Dr.length !== 1 ? 's' : ''} killed (${Dr.filter((d) => d['king']).length} king${Dr.filter((d) => d['king']).length !== 1 ? 's' : ''}) over ${rows.length} realm-turns — one every ${Dr.length ? (rows.length / Dr.length).toFixed(1) : '∞'} realm-turns — plus ${Dn} neutral hero${Dn !== 1 ? 'es' : ''} / chieftain${Dn !== 1 ? 's' : ''} slain. ${C.length} provinces changed hands: ${C.filter((c) => theField(c, 'from') == null).length} taken from neutrals, ${C.filter((c) => theField(c, 'from') != null).length} taken from rivals.</div>
      <h3 style="margin-top:12px">Deaths by cause (realm characters and neutrals)</h3>${statsBars(
        Object.entries(how).map(([k, n]) => ({
          label: causes[k] ?? k,
          v: n,
        })),
        { labelW: 220 },
      )}
      <h3 style="margin-top:12px">Deaths by turn</h3>${statsBars(
        Object.entries(byTurn)
          .sort((a, b) => +a[0] - +b[0])
          .map(([t, n]) => ({ label: 'turn ' + t, v: n, col: STATS_COL.stone })),
        { labelW: 70 },
      )}`,
      ),
    );
  }
  body.innerHTML = String(kcHtml`${html}`);
}
// ── exports ──
export function _csv<R extends object>(rows: readonly R[], cols: readonly (string | ((r: R) => unknown))[]) {
  const esc = (v: unknown) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : inWords(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [cols.join(',')]
    .concat(rows.map((r) => cols.map((c) => esc(typeof c === 'function' ? c(r) : Reflect.get(r, c))).join(',')))
    .join('\n');
}
export function _download(name: string, text: string, type?: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: (type ?? '') || 'text/csv' }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}
export function exportStats(kind: string) {
  if (!_stats.rows) return;
  const { rows, results } = _statsFilter();
  const stamp = new Date().toISOString().slice(0, 10);
  const pk = theFieldOfAValueOrOfNothing;
  if (kind === 'turns') {
    const cols = [
      'game_id',
      'turn',
      'player_index',
      'realm',
      'is_bot',
      'bot_difficulty',
      'race',
      'alignment',
      (r: ATurnRecordAsTheTabHoldsIt) => pk(r.pre, 'gold'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(r.post, 'gold'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(r.pre, 'provinces'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(r.post, 'provinces'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(r.post, 'tax'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(r.post, 'taxShare'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(r.post, 'units'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(r.post, 'str'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(r.post, 'heroes'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(r.post, 'kingAlive'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(r.post, 'items'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(r.post, 'discoveries'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(pk(r.outcomes, 'battles'), 'fought'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(pk(r.outcomes, 'battles'), 'won'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(pk(r.outcomes, 'encounters'), 'fought'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(pk(r.outcomes, 'encounters'), 'won'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(pk(r.outcomes, 'captures'), 'gained'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(pk(r.outcomes, 'captures'), 'lost'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(pk(r.outcomes, 'deaths'), 'own'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(pk(r.outcomes, 'deaths'), 'killed'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(pk(r.outcomes, 'spells'), 'cast'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(r.outcomes, 'rank'),
      (r: ATurnRecordAsTheTabHoldsIt) => pk(r.outcomes, 'score'),
      (r: ATurnRecordAsTheTabHoldsIt) =>
        theValuesOf(thisOrElse(pk(r.orders, 'chars'), {}))
          .map((c) =>
            theListOrNothingToWalk(theField(c, 'ph'))
              .map((o) => theField(o, 'a'))
              .join('>'),
          )
          .join(' | '),
    ];
    const names = [
      'game_id',
      'turn',
      'player_index',
      'realm',
      'is_bot',
      'bot_difficulty',
      'race',
      'alignment',
      'gold_before',
      'gold_after',
      'provinces_before',
      'provinces_after',
      'tax',
      'tax_share_pct',
      'units',
      'army_strength',
      'heroes',
      'king_alive',
      'items',
      'discoveries',
      'battles',
      'battles_won',
      'lair_fights',
      'lairs_cleared',
      'provinces_gained',
      'provinces_lost',
      'own_deaths',
      'enemies_killed',
      'spells_cast',
      'rank',
      'score',
      'orders_by_character',
    ];
    _download(`kc-turns-${stamp}.csv`, _csv(rows, cols).replace(/^[^\n]*/, names.join(',')));
  } else if (kind === 'battles') {
    const B: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    rows.forEach((r) => {
      theListOrNothingToWalk(pk(pk(r.outcomes, 'battles'), 'list')).forEach((b) => {
        const k = `${r.game_id}#${String(r.turn)}#${inWords(theField(b, 'ph'))}#${inWords(theField(b, 'prov'))}#${inWords(theField(b, 'atkChar'))}#${inWords(theField(b, 'atkStr'))}#${inWords(theField(b, 'defStr'))}`;
        if (seen.has(k)) return;
        seen.add(k);
        const atkStr = theField(b, 'atkStr'),
          defStr = theField(b, 'defStr');
        B.push({
          game_id: r.game_id,
          turn: r.turn,
          phase: theField(b, 'ph'),
          province: theField(b, 'prov'),
          terrain: theField(b, 'terrain'),
          kind: theField(b, 'kind'),
          attacker: theField(b, 'atkPi'),
          defender: theField(b, 'defPi'),
          atk_strength: atkStr,
          def_strength: defStr,
          ratio: Number(defStr) > 0 ? Math.round((100 * Number(atkStr)) / Number(defStr)) / 100 : '',
          fortune_swing: theField(b, 'S'),
          expected_atk_win_pct: Math.round(
            100 * fortuneWinChance(Number(defStr) > 0 ? Number(atkStr) / Number(defStr) : 1e9),
          ),
          attacker_won: theField(b, 'won'),
          atk_units: theField(b, 'atkUnits'),
          def_units: theField(b, 'defUnits'),
          atk_lost: theField(b, 'atkLost'),
          def_lost: theField(b, 'defLost'),
          carry_on_round: theField(b, 'carry'),
        });
      });
    });
    _download(`kc-battles-${stamp}.csv`, _csv(B, Object.keys(B[0] ?? { game_id: 1 })));
  } else if (kind === 'results') {
    const cols = [
      'game_id',
      'game_name',
      'player_index',
      'realm',
      'is_bot',
      'bot_difficulty',
      'race',
      'alignment',
      'rank',
      'score',
      'winner',
      'victory',
      'turns',
      'out_turn',
      'out_how',
      (r: AResultAsTheTabHoldsIt) => pk(r.setup, 'realms'),
      (r: AResultAsTheTabHoldsIt) => pk(r.setup, 'humans'),
      (r: AResultAsTheTabHoldsIt) => pk(r.setup, 'seaPct'),
      (r: AResultAsTheTabHoldsIt) => pk(r.final, 'provinces'),
      (r: AResultAsTheTabHoldsIt) => pk(r.final, 'gold'),
      (r: AResultAsTheTabHoldsIt) => pk(r.final, 'str'),
      (r: AResultAsTheTabHoldsIt) => pk(r.final, 'heroes'),
    ];
    const names = [
      'game_id',
      'game_name',
      'player_index',
      'realm',
      'is_bot',
      'bot_difficulty',
      'race',
      'alignment',
      'rank',
      'score',
      'winner',
      'victory',
      'turns',
      'out_turn',
      'out_how',
      'realms',
      'humans',
      'sea_pct',
      'final_provinces',
      'final_gold',
      'final_strength',
      'final_heroes',
    ];
    _download(`kc-results-${stamp}.csv`, _csv(results, cols).replace(/^[^\n]*/, names.join(',')));
  } else if (kind === 'json') {
    // (situation → orders → outcome) examples, one per realm-turn, with the realm's final result attached
    const byKey: Record<string, AResultAsTheTabHoldsIt> = {};
    results.forEach((r) => {
      byKey[`${r.game_id}#${String(r.player_index)}`] = r;
    });
    const out = rows.map((r) => {
      const fr = byKey[`${r.game_id}#${String(r.player_index)}`];
      return {
        game_id: r.game_id,
        turn: r.turn,
        player_index: r.player_index,
        is_bot: r.is_bot,
        bot_difficulty: r.bot_difficulty,
        realm: r.realm,
        race: r.race,
        alignment: r.alignment,
        situation: r.pre,
        orders: r.orders,
        result: r.post,
        outcomes: r.outcomes,
        final: fr
          ? { rank: fr.rank, winner: fr.winner, victory: fr.victory, turns: fr.turns, out_how: fr.out_how }
          : null,
      };
    });
    _download(
      `kc-training-${stamp}.json`,
      JSON.stringify({ v: KC_TEL_V, exported: new Date().toISOString(), build: KC_BUILD_STAMP, rows: out }, null, 0),
      'application/json',
    );
  }
}
export async function forgetDeletedGames() {
  if (!_stats.rows) return;
  // A game is "deleted" only if no games row exists for it, whoever runs it: the statistics on screen can include
  // other GMs' games (the Overlord sees every game's, since P0-22), so _stats.games (this account's own) can't decide.
  const heldResults = _stats.results;
  // never met: the load sets the results with the rows
  if (heldResults === null) throw new TypeError("Cannot read properties of null (reading 'map')");
  const recorded = [...new Set([..._stats.rows.map((r) => r.game_id), ...heldResults.map((r) => r.game_id)])];
  const live = new Set<string>();
  for (let i = 0; i < recorded.length; i += 100) {
    const { data, error } = await thePagesDb.theHallOfFamesGames.whichOfTheseGamesStillExist(
      recorded.slice(i, i + 100),
    );
    if (error) {
      alert('Could not check which games still exist: ' + error.message + '. Nothing was deleted.');
      return;
    }
    (data ?? []).forEach((g) => live.add(g.id));
  }
  const gone = recorded.filter((id) => !live.has(id));
  if (!gone.length) {
    alert('Every recorded game still exists — nothing to forget.');
    return;
  }
  if (
    !confirm(
      `Delete the recorded turns and results of ${String(gone.length)} game${gone.length !== 1 ? 's' : ''} that no longer exist? This cannot be undone.`,
    )
  )
    return;
  await thePagesDb.theStatistics.deleteTheseGamesTurnRecords(gone);
  await thePagesDb.theStatistics.deleteTheseGamesResults(gone);
  if (_kcHasLb) await thePagesDb.theHallOfFame.deleteTheseGamesEntries(gone); // and their Hall-of-Fame rows
  void openStats(true);
}
