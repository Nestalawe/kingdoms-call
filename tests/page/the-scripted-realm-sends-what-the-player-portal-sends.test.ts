// The balance matrix's scripted realm sends what the player portal sends (plan P1-15e2; P1-15e's Decision 2). The
// scripted realm's orders are built by a typed copy of the portal's payload (tools/balance/the-orders-the-player-portal-
// sends.ts) from the choices it makes on the saved state (tools/balance/scripted.ts). Here the portal itself is booted
// on the realm's turn report for each state of two scripted games of set A (scripted-05, and scripted-06, the one
// whose scripted realm is Evil), plus one state with what the games don't reach staged on it, and given the same choices
// through its form: each order through its select and onActionChange, each target through its field and its change
// (the Encounter Character list, the Recruit Armies boxes; P1-15e3: the Spy, Search Lair, Hire Hero, Research and
// Practice Skill fields, a hire's card made by its change and its plan driven as a hero's), the plan through its inputs (each tactic's button, the pre-battle school's picker,
// the battle cry, the duel stance, an Evil realm's conquest doctrine), the heir's points through allocateHeirSkill, a
// research lead through its radio button, a declaration through its button. What the portal writes to the realm's row
// must deep-equal the copy's payload. A choice the form doesn't offer leaves its field empty (or its button disabled),
// so the test also proves the copy gives only what the form offers. Each kind of choice the copy makes is asserted to
// happen at least once.
//
// The states and reports are the matrix's: each game is played in the engine's vm as tools/balance/every-realm.ts plays
// the matrix's games (tests/lib/matrix-game.ts), and the report for a state is the one the turn before wrote, after its
// Spy stealth (the first turn's, which no turn wrote, and the staged state's are built by the views on the world, as
// Turn 0's is).
//
// Level 4 (page): the payload is assembled from the form's DOM (its selects, hidden inputs and the page's globals), so
// only the booted portal can say what it sends. One page booted once, about 1 s, then about 0.2 s a state.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { DISC_BY_ID } from '../../src/engine/discoveries.ts';
import { L79_ORDERS } from '../../src/ui/player/l79-orders.ts';
import type { GameState } from '../../src/schemas/saved-game-state.ts';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';
import { bootJsdom, readPage, type PageWindow } from '../lib/boot.js';
import { PAGE_DRAWS_AS_IT_LOADS, setupsOf, slotRowsJsonOf, stampedAsTheShellSaves } from '../lib/matrix-game.ts';
import { MAP_SIZES, matrix, MAX_TURNS, SCRIPTED_REALM } from '../../tools/balance/matrix.ts';
import { scriptedChoices, type State } from '../../tools/balance/scripted.ts';
import {
  theHeroesTheFormLists,
  theOrdersThePlayerPortalSends,
  type WhatTheRealmChose,
} from '../../tools/balance/the-orders-the-player-portal-sends.ts';

/** One state the portal is driven on: the saved state the turn will load, and the realm's report on it. */
interface AState {
  name: string;
  turn: number;
  state: State;
  report: Record<string, unknown>;
}
type Report = Record<string, unknown>;

/** Each state of `id` (set A), with the scripted realm's report on it, played on the engine's modules; and a function
 *  that builds the scripted realm's report on a state with no turn (as Turn 0's is built), with the same modules. */
async function statesOf(id: string): Promise<{ states: AState[]; reportOn: (state: State) => Report }> {
  const spec = matrix('A').find((g) => g.id === id);
  const size = MAP_SIZES[spec?.realms ?? 0];
  if (!spec || !size) throw new Error(`no game ${id} in set A`);
  const sc = await aStagedTurnOnTheEnginesModules({ seed: spec.seed });
  const { kcRng } = await import('../../src/engine/rng.ts');
  const { generateNewGame } = await import('../../src/engine/world/generate.ts');
  const { playerView } = await import('../../src/views/what-each-realm-may-see-of-the-world.ts');
  const { buildTurnReport } = await import('../../src/views/turn-report.ts');
  const reportOn = (state: State): Report =>
    JSON.parse(
      JSON.stringify(buildTurnReport(playerView(structuredClone(state) as unknown as GameState, SCRIPTED_REALM))),
    ) as Report;
  for (let i = 0; i < PAGE_DRAWS_AS_IT_LOADS; i++) kcRng();
  const made = generateNewGame(setupsOf(spec), { ...size }, 0, { seaPct: spec.seaPct }) as Record<string, unknown>;
  Object.assign(made, {
    turnMode: { mode: 'manual', time: '20:00', everyDays: 1, nextDeadlineAt: null, turnRanAt: null },
    botDifficulty: 'hard',
    botDiplomacy: spec.diplomacy,
  });
  let state = JSON.stringify(made);
  let report = reportOn(JSON.parse(state) as State);
  const states: AState[] = [];
  for (let t = 1; t <= MAX_TURNS; t++) {
    const S = JSON.parse(state) as State & { gameOver?: unknown };
    if (S.gameOver) break;
    states.push({ name: `${id}, turn ${String(S.turn)}`, turn: S.turn, state: S, report });
    const played = sc.play(state, JSON.parse(slotRowsJsonOf(spec, state, S.turn)) as unknown[]);
    state = stampedAsTheShellSaves(JSON.stringify(played.S2));
    report = played.reports[SCRIPTED_REALM] ?? {};
  }
  return { states, reportOn };
}

/** `from` with what the two scripted games don't reach staged on the scripted realm (a research pair only after a
 *  discovery, an heir is crowned only when a king falls, no scripted realm reorders its column, and no scripted hero
 *  reaches a mastery's level): a research pair, an heir with points to spend, the column arranged in another order
 *  than the world's, and its last hero at Tactical 7 (Feigned Retreat); its report built by the views. */
function withWhatTheGamesDontReachStaged(from: AState, reportOn: (state: State) => Report): AState {
  const S = structuredClone(from.state);
  const mine = S.characters.filter((c) => c.alive && c.player === SCRIPTED_REALM);
  const king = mine.find((c) => c.isKing);
  const heir = mine.find((c) => !c.isKing);
  const realm = S.players[SCRIPTED_REALM];
  if (!king || !heir || !realm) throw new Error(`${from.name}: no king, no other hero, or no realm to stage on`);
  realm.pendingDiscoveryChoices = [
    {
      key: `rc${String(S.turn - 1)}_${String(king.id)}_2`,
      options: Object.keys(DISC_BY_ID).slice(0, 2),
      ...{ turn: S.turn - 1, charId: king.id, charName: king.name ?? '', category: '' },
    },
  ];
  Object.assign(heir, { _isHeir: true, _pendingSkillAllocation: 4 });
  const master = mine.filter((c) => !c.isKing).at(-1);
  if (master) master.skills = { ...master.skills, tactical: 7 };
  // the column as the player arranged it: not the world's order, which the games' own columns keep
  realm.heroOrder = mine.map((c) => String(c.id)).reverse();
  return {
    name: `${from.name}, a research pair, an heir, an arrangement and a master staged`,
    turn: S.turn,
    state: S,
    report: reportOn(S),
  };
}

/** States made from `from` on which each of the spare heroes' orders (P1-15e3) is given whatever the games' dice: the
 *  realm at peace (so no hero chases), its heroes but the king unarmed in a province of its own where no one else
 *  stands, and then: a wandering hero beside them who will serve (one hires him, the other spies on him); a rival's
 *  hero beside them (each spies on him); a Weak lair they know there and Sage 1, on five turns running (each order
 *  of the rest in turn: Search Lair, Research, Practice Skill, Explore, Rest); and the orders for turn 6 (a release).
 *  Each report built by the views. */
function theSpareHeroesOrdersStaged(from: AState, reportOn: (state: State) => Report): AState[] {
  const moveTo = (S: State, c: State['characters'][number], to: number) => {
    const was = S.world.provinces[c.location];
    if (was?.characters) was.characters = was.characters.filter((id) => id !== c.id);
    const now = S.world.provinces[to];
    if (now) now.characters = [...(now.characters ?? []), c.id];
    c.location = to;
  };
  const staged = (what: string, stage: (S: State, home: number) => void, turn = from.turn): AState => {
    const S = structuredClone(from.state);
    S.turn = turn;
    S.relations = {};
    const realm = S.players[SCRIPTED_REALM];
    const someoneElseThere = (id: number) =>
      S.characters.some((c) => c.alive && c.player !== SCRIPTED_REALM && c.location === id);
    const home = (realm?.provinces ?? []).find((id) => !someoneElseThere(id));
    const spare = S.characters.filter((c) => c.alive && c.player === SCRIPTED_REALM && !c.isKing);
    if (home == null || spare.length < 2) throw new Error(`${from.name}: no empty province, or fewer than two heroes`);
    for (const c of spare) {
      moveTo(S, c, home);
      c.armies = [];
    }
    stage(S, home);
    return { name: `${from.name}, ${what} staged`, turn, state: S, report: reportOn(S) };
  };
  const alignment = from.state.players[SCRIPTED_REALM]?.alignment;
  const beside = (S: State, home: number, c: State['characters'][number] | undefined, who: string) => {
    if (!c) throw new Error(`${from.name}: no ${who} to stage`);
    moveTo(S, c, home);
    Object.assign(c, { armies: [], items: [], _invisTurn: undefined, _unspottedTurn: undefined });
  };
  return [
    staged('a wandering hero beside the spare heroes', (S, home) => {
      const wanderer = S.characters.find((c) => c.alive && c.player === null && !c._isNeutralGuard);
      beside(S, home, wanderer, 'wandering hero');
      // no Spy to slip by with, and of the realm's own alignment: he will serve
      Object.assign(wanderer ?? {}, { skills: { melee: 1 }, alignment, _justDefeated: false });
    }),
    staged('a rival realm’s hero beside the spare heroes', (S, home) => {
      const rival = S.characters.find((c) => c.alive && c.player != null && c.player !== SCRIPTED_REALM && !c.isKing);
      beside(S, home, rival, 'rival realm’s hero');
    }),
    ...[0, 1, 2, 3, 4].map((i) =>
      staged(
        `a Weak lair the spare heroes know and Sage 1, turn ${String(from.turn + i)}`,
        (S, home) => {
          const p = S.world.provinces[home];
          const like = S.world.provinces.flatMap((q) => q.features ?? []).find((f) => !f.ritualSite);
          if (!p || !like) throw new Error(`${from.name}: no lair to copy`);
          const lair = structuredClone(like);
          Object.assign(lair, { cleared: false, tier: 'Weak', discoveredBy: [SCRIPTED_REALM] });
          if (lair.monster) lair.monster.power = 'Weak';
          p.features = [...(p.features ?? []), lair];
          for (const c of S.characters.filter((x) => x.player === SCRIPTED_REALM && !x.isKing))
            c.skills = { ...c.skills, sage: 1 };
        },
        from.turn + i,
      ),
    ),
    staged('the orders for turn 6', () => undefined, 6),
  ];
}

const fifth = await statesOf('scripted-05');
const sixth = await statesOf('scripted-06');
const turn5 = fifth.states.find((s) => s.turn === 5);
if (!turn5) throw new Error('scripted-05 has no turn 5');
const STATES = [
  ...fifth.states,
  ...sixth.states,
  withWhatTheGamesDontReachStaged(turn5, fifth.reportOn),
  ...theSpareHeroesOrdersStaged(turn5, fifth.reportOn),
];
const choicesOf = (s: AState): WhatTheRealmChose => scriptedChoices(s.state, SCRIPTED_REALM, s.turn).chose;

// ── The page, on a stand-in database of its own ──
// Two rows the form reads and writes (the game, and the scripted realm's slot), on a client that answers every other
// read with nothing; no stand-in of lib/stub-db.js, which this test needs no more of.
type Row = Record<string, unknown>;
const slot: Row = {
  id: 'gp0',
  game_id: 'G1',
  user_id: 'u0',
  player_index: SCRIPTED_REALM,
  display_name: 'Realm0',
  orders_submitted: false,
  orders: null,
  turn_report: '{}',
};
const game: Row = {
  id: 'G1',
  name: 'Matrix',
  gm_user_id: 'gm1',
  status: 'active',
  turn: 1,
  max_players: 4,
  max_turns: 0,
  block_eliminated_msgs: false,
};
const TABLES: Record<string, Row[]> = { games: [game], game_players: [slot] };

/** A client that reads and updates TABLES' rows by `eq`, and answers every other call with nothing. */
function aClientOnTwoRows(): unknown {
  const query = (table: string) => {
    const where: [string, unknown][] = [];
    let change: Row | null = null;
    const rows = () => (TABLES[table] ?? []).filter((r) => where.every(([k, v]) => r[k] === v));
    const answer = () => {
      if (change) for (const r of rows()) Object.assign(r, change);
      return { data: change ? null : rows().map((r) => ({ ...r })), error: null };
    };
    const q: Record<string, unknown> = {
      eq: (k: string, v: unknown) => (where.push([k, v]), q),
      update: (values: Row) => ((change = values), q),
      single: () => Promise.resolve({ data: rows()[0] ? { ...rows()[0] } : null, error: null }),
      maybeSingle: () => Promise.resolve({ data: rows()[0] ? { ...rows()[0] } : null, error: null }),
      then: (resolve: (r: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(answer()).then(resolve, reject),
    };
    for (const m of ['select', 'neq', 'in', 'is', 'not', 'or', 'gt', 'gte', 'lt', 'lte', 'order', 'limit', 'range'])
      q[m] = () => q;
    for (const m of ['insert', 'upsert', 'delete']) q[m] = () => q;
    return q;
  };
  const session = { user: { id: 'u0', email: 'player@example.com' } };
  const channel = { on: () => channel, subscribe: () => channel, unsubscribe: () => undefined };
  return {
    from: query,
    rpc: () => Promise.resolve({ data: null, error: null }),
    auth: {
      getSession: () => Promise.resolve({ data: { session }, error: null }),
      getUser: () => Promise.resolve({ data: { user: session.user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    },
    channel: () => channel,
    removeChannel: () => undefined,
  };
}

let W: PageWindow;
const errors: string[] = [];

beforeAll(async () => {
  const client = aClientOnTwoRows();
  W = bootJsdom(readPage('kingdoms-call-player-portal.html'), {
    supabase: { createClient: () => client },
    setup(w) {
      w.addEventListener('error', (e) => errors.push(e.error?.stack ?? e.message));
      w.onunhandledrejection = (e) => errors.push(String(e.reason));
      w.console.error = (...a) => errors.push('console.error: ' + a.map(String).join(' '));
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
      w['alert'] = (m: unknown) => errors.push('alert: ' + String(m));
      w['scrollTo'] = () => undefined; // jsdom has no scrolling: the mobile view scrolls to the report
    },
  }).window;
  await new Promise((r) => setTimeout(r, 900));
  // The page's short timers (a field rebuilt "once the DOM exists", the research box) are queued and run in order at
  // the end of each step, as tests/lib/screens.js does; long ones (polls) are dropped.
  W.eval(`window.__kcQ=[];window.__kcN=0;
    window.setTimeout=(f,ms,...a)=>{ if(ms>=1000) return 0; const id=++window.__kcN; window.__kcQ.push({f,a,ms:+ms||0,id}); return id; };
    window.clearTimeout=id=>{ window.__kcQ=window.__kcQ.filter(t=>t.id!==id); };
    window.__kcRun=()=>{ for(let r=0;r<20&&window.__kcQ.length;r++){ const q=window.__kcQ.splice(0).sort((x,y)=>x.ms-y.ms||x.id-y.id);
      for(const t of q){ if(typeof t.f==='function') t.f(...t.a); } } };`);
}, 10_000);
afterAll(() => {
  W.close();
});

// Gives the form the realm's choices as a player does, then submits. A function in the page, given the choices (JSON).
const DRIVE = `async (choseJson) => {
  const chose = JSON.parse(choseJson);
  const run = () => window.__kcRun();
  const byId = (id) => document.getElementById(id);
  // the heir first: each point saves a draft and rebuilds the form from it
  for (const [id, points] of Object.entries(chose.heirPoints)) for (const k of points) { await allocateHeirSkill(Number(id), k, 1); run(); }
  for (const [id, phases] of Object.entries(chose.orders)) phases.forEach((o, ph) => {
    if (!o) return;
    const sel = byId('po-action-' + id + '-' + ph);
    if (!sel) return;
    sel.value = o.action; onActionChange(id, ph, 99); run();
    if (o.action === 'Recruit Armies') {
      const wrap = byId('po-target-wrap-inner-' + id + '-' + ph);
      const box = [...(wrap ? wrap.querySelectorAll('input[type=checkbox]') : [])].find((b) => b.value === o.target && !b.checked);
      if (box) box.click();
    } else {
      const field = byId('po-target-' + id + '-' + ph);
      // as a player picks: the value, then the field's own change (a Spy's or Practice Skill's odds, a hire's card)
      if (field) { field.value = o.target; field.dispatchEvent(new Event('change')); }
    }
    run();
  });
  for (const [id, p] of Object.entries(chose.plans)) {
    const tactics = byId('ep-tactics-' + id);
    if (!tactics) continue;
    while (tactics.value.split(',').filter(Boolean).length) removeEncounterTactic(id, 0);
    const buttons = [...tactics.previousElementSibling.querySelectorAll('button')];
    for (const code of p.tactics) buttons.find((b) => b.textContent.trim() === '+ ' + code)?.click();
    clearPreSchool(id);
    if (p.school) {
      openPreSchoolPicker(id);
      const picker = byId('ep-school-picker-' + id);
      [...(picker ? picker.querySelectorAll('button') : [])].find((b) => (b.getAttribute('onclick') || '').includes(JSON.stringify(p.school)))?.click();
    }
    byId('ep-notes-' + id).value = p.notes;
    byId('ep-duel-' + id).value = p.duelStance;
    const doctrine = byId('ep-evilmode-' + id);
    if (doctrine && p.evilMode) doctrine.value = p.evilMode;
  }
  run();
  for (const [key, lead] of Object.entries(chose.discoveryChoices))
    [...document.querySelectorAll('#orders-discovery-choice input[type=radio]')].find((r) => r.name === 'dc-' + key && r.value === lead)?.click();
  for (const [realm, stance] of Object.entries(chose.diplomacy))
    [...document.querySelectorAll('#orders-diplomacy button')].find((b) => b.getAttribute('onclick') === 'setDiploChoice(' + realm + ',' + JSON.stringify(stance) + ')')?.click();
  run();
  await doSubmitOrders();
  run();
}`;

/** What the portal writes to the realm's row for `s`, given the realm's choices through its form. */
async function whatThePortalSends(s: AState): Promise<unknown> {
  game['turn'] = s.turn;
  Object.assign(slot, { turn_report: JSON.stringify(s.report), orders: null, orders_submitted: false });
  errors.length = 0;
  await W.eval(`(async()=>{ await openReport('gp0'); window.__kcRun(); })()`);
  await (W.eval(DRIVE) as (j: string) => Promise<void>)(JSON.stringify(choicesOf(s)));
  expect(errors).toEqual([]);
  expect(slot['orders_submitted']).toBe(true);
  return JSON.parse(String(slot['orders']));
}

describe('the portal, given the scripted realm’s choices, sends what the copy sends', () => {
  test.for(STATES.map((s) => [s.name, s] as const))('%s', async ([, s]) => {
    const copy = JSON.parse(
      JSON.stringify(theOrdersThePlayerPortalSends(s.state, SCRIPTED_REALM, s.turn, choicesOf(s))),
    ) as unknown;
    expect(await whatThePortalSends(s)).toEqual(copy);
  });
});

describe('each kind of choice the copy makes is driven at least once', () => {
  const each = STATES.map((s) => ({ s, chose: choicesOf(s) }));
  const plans = each.flatMap(({ chose }) => Object.values(chose.plans));
  const picked = each.flatMap(({ chose }) => Object.values(chose.orders).flatMap((o) => o.filter((x) => x != null)));
  const gave = (action: string, target?: (t: string) => boolean): boolean =>
    picked.some((o) => o.action === action && (!target || target(o.target)));
  const wanderers = new Set(
    STATES.flatMap((s) => s.state.characters.filter((c) => c.player == null).map((c) => `char:${String(c.id)}`)),
  );
  const kinds: [string, boolean][] = [
    ['an Encounter Character order', gave('Encounter Character')],
    ['a Recruit Armies order', gave('Recruit Armies')],
    ['a Spy on a wandering hero', gave('Spy', (t) => wanderers.has(t))],
    ['a Spy on a rival realm’s hero', gave('Spy', (t) => t.startsWith('char:') && !wanderers.has(t))],
    ['a Search Lair order', gave('Search Lair')],
    [
      'a Hire Hero order, with its card’s plan',
      gave('Hire Hero') && each.some(({ chose }) => Object.keys(chose.plans).some((id) => id.startsWith('hired_'))),
    ],
    ['a Release Hero order', gave('Release Hero')],
    ['an Explore order', gave('Explore')],
    ['a Rest order', gave('Rest')],
    ['a Practice Skill order', gave('Practice Skill')],
    ['a Research order', gave('Research')],
    ['a mastery', picked.some((o) => o.action in L79_ORDERS)],
    [
      'a hero fallen this turn',
      each.some(({ s }) => theHeroesTheFormLists(s.state, SCRIPTED_REALM).some((c) => !c.alive)),
    ],
    [
      'two heroes or more in the column',
      each.some(({ s }) => theHeroesTheFormLists(s.state, SCRIPTED_REALM).length > 1),
    ],
    [
      'the column in an arrangement that isn’t the world’s order',
      each.some(({ s }) => {
        const column = theHeroesTheFormLists(s.state, SCRIPTED_REALM).map((c) => c.id);
        return column.join() !== [...column].sort((a, b) => a - b).join();
      }),
    ],
    ['an heir’s points', each.some(({ chose }) => Object.values(chose.heirPoints).some((p) => p.length > 0))],
    ['a research lead kept', each.some(({ chose }) => Object.keys(chose.discoveryChoices).length > 0)],
    ['a declaration of war', each.some(({ chose }) => Object.values(chose.diplomacy).includes('enemy'))],
    ['three tactics', plans.some((p) => p.tactics.length === 3)],
    ['the Steal tactic', plans.some((p) => p.tactics.includes('ST'))],
    ['a pre-battle school', plans.some((p) => p.school !== '')],
    ['a battle cry', plans.some((p) => p.notes !== '')],
    ...['challenge', 'accept', 'refuse'].map((d): [string, boolean] => [
      `the duel stance ${d}`,
      plans.some((p) => p.duelStance === d),
    ]),
    ...['terror', 'enslave'].map((m): [string, boolean] => [
      `the conquest doctrine ${m}`,
      plans.some((p) => p.evilMode === m),
    ]),
  ];
  test.for(kinds)('%s', ([, happened]) => {
    expect(happened).toBe(true);
  });
});
