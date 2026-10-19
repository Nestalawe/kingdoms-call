// The checks processOrder makes before any hero's order (plan P1-08j9, processOrder lifted out of resolveTurn), staged
// on the middle of a bot world (lib/middle-of-a-bot-world.ts), from plain realms, each with what must be true after it
// in game terms: a hero who joined another's assault has his own order superseded; the order's name is read as the
// order form or an old save writes it, and an unknown one is a Defend; a bot's Practice on a skill already at 5
// switches skill, and a bot's Search too hurt, on talk not heard, or out of the province it was written for becomes a
// Rest; a Move or an Encounter out of an unresolved battle is refused; a charmed enemy hero won't disband, perform the
// rites or spend a mastery; a mastery is charged once a turn; a Forced March is a Move that may slip past a battle; a
// spell item's Use Item is a cast. scenario/order-dispatch-in-a-whole-turn.test.ts plays each through a whole turn
// (resolveTurn); unit/order-dispatch-called-directly.test.ts calls processOrder on them, one phase at a time. A case
// stages its world and the heroes' orders; after them, it reads what it needs from the world and the log (`got`) beside
// what must be so (`want`), and the test compares the two.
// A case with `bots` makes those realms bots: the orders it gives their heroes are the bots' own, written in after the
// bots have planned (`asTheBotsPlan`), as a bot's planner writes them (`_botMinHp`, `_botIfRumour`, `prov`). Every
// outcome is certain: every case fixes the dice for the whole turn (default LANDS), every percentile roll at one number
// and every other die at one value, so the outcome holds however many dice the turn draws before the order. Realms 0
// and 1 are at war, 0 and 2 allied, 1 and 2 at peace (the board's relations).
import vm from 'node:vm';
import {
  hero,
  must,
  order,
  playTurn,
  type Board,
  type Character,
  type Line,
  type Order,
  type Province,
} from './middle-of-a-bot-world.ts';
import { companies, item, type Item } from './item-and-army-order-cases.ts';
import { withCaseDice, type Dice, type ExperienceRoll } from './espionage-order-cases.ts';
import {
  at,
  char,
  holding,
  one,
  ring1,
  rival,
  says,
  anySays,
  type Outcome,
  type Staged,
} from './cast-spell-order-cases.ts';
import { plainRealms } from './recruit-hire-and-realm-works-order-cases.ts';
import { LANDS, told, watch } from './war-order-cases.ts';

export type { Outcome, Staged };
export { LANDS };
export interface OrderDispatchCase {
  name: string;
  /** Plays only in a whole turn: the phase loop makes what the check reads (an assault a friend joins, a battle left
   *  unresolved, a skill risen earlier in the turn, a mastery spent in an earlier season). */
  wholeTurnOnly?: boolean;
  /** The dice for the whole turn (default LANDS). */
  dice?: Dice;
  /** The realms that are bots: the orders the case gives their heroes are the bots' own. */
  bots?: number[];
  stage(b: Board): Staged;
  /** What the case found after the orders, and what it should have found: the same keys. */
  check(o: Outcome, s: Staged): { got: Record<string, unknown>; want: Record<string, unknown> };
}

/** Every roll lands; every other die at its lowest (a skill rises at every lesson, a Forced March slips past). */
export const LUCKY: Dice = { roll: 1, die: 0 };

/** Writes the orders `writes` gives (by hero) into the turn after the bots have planned theirs, by wrapping the
 *  top-level runBotOrderHygiene (the bots' last pass) in the vm, for the length of a body. Wrap once per engine. */
export const asTheBotsPlan = (engine: vm.Context) => {
  vm.runInContext(
    `{ const lastPass=runBotOrderHygiene;
       runBotOrderHygiene=function(G, botIdxSet){
         const r=lastPass.apply(this, arguments); const w=globalThis.__botWrites;
         if(w) Object.keys(w).forEach(id=>{ G.turnOrders[id]=JSON.parse(JSON.stringify(w[id])); });
         return r; }; }`,
    engine,
  );
  return <T>(writes: Record<number, Order[]> | undefined, body: () => T): T => {
    engine['__botWrites'] = writes;
    try {
      return body();
    } finally {
      engine['__botWrites'] = undefined;
    }
  };
};

/** Plays `c`, staged as `s` on `b`, through a whole turn: the bots' heroes' orders written in as theirs, every other
 *  hero's sent by his realm, with the case's dice. `recording` records the experience rolls (recordExperienceRolls). */
export const playCase = (
  b: Board,
  c: OrderDispatchCase,
  s: Staged,
  bots: ReturnType<typeof asTheBotsPlan>,
  recording: <T>(body: () => T) => { result: T; xp: ExperienceRoll[] },
): Outcome => {
  const isBot = (h: Character) => h.player != null && (c.bots ?? []).includes(h.player);
  const theirs = Object.fromEntries(s.orders.filter(([h]) => isBot(h)).map(([h, os]) => [h.id, os]));
  const sent = Object.fromEntries(s.orders.filter(([h]) => !isBot(h)).map(([h, os]) => [h.id, os]));
  const { result, xp } = recording(() =>
    withCaseDice(b.engine, c.dice ?? LANDS, () => bots(theirs, () => playTurn(b, sent, s.written ?? {}, c.bots ?? []))),
  );
  return {
    world: result.after,
    lines: result.lines.filter((l) => l.charId === s.hero.id),
    all: result.lines,
    turn: b.G.turn,
    xp,
  };
};

const there = (s: Staged) => must(s.there, 'the province');
const other = (s: Staged) => must(s.other, 'the other hero');
const mark = (s: Staged) => must(s.mark, 'the mark');
/** The texts of a hero's own lines in phase `ph`. */
const linesIn = (o: Outcome, c: Character, ph: number) =>
  o.all.filter((l: Line) => l.charId === c.id && l.phase === ph).map((l) => l.text);
/** Whether a hero's own lines in phase `ph` say `what`. */
const saysIn = (o: Outcome, c: Character, ph: number, what: string) => linesIn(o, c, ph).some((t) => t.includes(what));
/** The line a Defend order writes for a hero with no companies: he lies in wait. */
const liesInWait = (c: Character, p: Province) => `${c.name} melts into the country around ${p.name} and lies in wait`;
/** The line a Rest order writes for a wounded hero. */
const rests = (c: Character) => `${c.name} rests and recovers.`;
/** The turn this mastery was last charged to the hero (undefined if never). */
const charged = (o: Outcome, c: Character, action: string) =>
  (char(o, c)['_masteryOrderUsed'] as Record<string, number> | undefined)?.[action];

// ── Superseded: a friend who joined another's assault ────────────────────────────────────────────────────────────
/** A neutral guard on `to`, a column of realm 0 in the middle marching on it first (Tactical 4), and a friend one
 *  province from both who marches on it too, slower (no skills): the friend joins the assault (every roll lands). */
const assault = (b: Board) => {
  const to = ring1(b, 0);
  hero(b, { player: null, at: to, troops: 1, quality: 'Green' })._isNeutralGuard = true;
  const leader = at(b, { tactical: 4, march: 2 });
  leader.armies = companies(3);
  const near = must(
    b.ring1.find((p) => p !== to && b.nbrs(p).includes(to)),
    'a neighbour of both',
  );
  const friend = at(b, { melee: 0, tactical: 0, march: 0 }, { at: near });
  friend.armies = companies(2);
  return { to, leader, friend, near };
};
export const SUPERSEDED_CASES: OrderDispatchCase[] = [
  {
    name: "a friend carried into another's assault: his own order is superseded, and he is told so under his name",
    wholeTurnOnly: true,
    stage(b) {
      const { to, leader, friend } = assault(b);
      return {
        hero: friend,
        other: leader,
        there: to,
        orders: [one(leader, order('move', to.id)), one(friend, order('move', to.id))],
      };
    },
    check(o, s) {
      const line = `${s.hero.name}'s order superseded — they unified with ${other(s).name}'s forces this phase.`;
      const l = o.all.find((x) => x.text === line);
      return {
        got: {
          joined: anySays(
            o,
            `📊 Contingent unify: ${s.hero.name} joins ${other(s).name}'s assault on ${there(s).name}!`,
          ),
          told: told(o, line),
          hisOwn: l ? { charId: l.charId, actor: l.actor } : null,
          // the line is all his order comes to: nothing more of his own in that season
          season: linesIn(o, s.hero, 0).filter((t) => !t.startsWith('📈') && !t.startsWith('💰')),
        },
        want: {
          joined: true,
          told: { type: 'move', targets: [0], provinceId: null, public: false, phase: 0 },
          hisOwn: { charId: s.hero.id, actor: 0 },
          season: [
            `⚔ ${s.hero.name} marches in ${other(s).name}'s host against ${there(s).name} — the full account is under ${other(s).name}.`,
            line,
          ],
        },
      };
    },
  },
  {
    name: 'a friend who misses the timing marches on his own: nothing is superseded',
    wholeTurnOnly: true,
    dice: { roll: 100, die: 0.99999 },
    stage(b) {
      const { to, leader, friend } = assault(b);
      return {
        hero: friend,
        other: leader,
        there: to,
        orders: [one(leader, order('move', to.id)), one(friend, order('move', to.id))],
      };
    },
    check(o, s) {
      return {
        got: {
          missed: anySays(o, `${s.hero.name} cannot link up with ${other(s).name} in time`),
          superseded: anySays(o, `${s.hero.name}'s order superseded`),
          ownMarch: linesIn(o, s.hero, 0).length > 0,
        },
        want: { missed: true, superseded: false, ownMarch: true },
      };
    },
  },
];

// ── The order's name ────────────────────────────────────────────────────────────────────────────────────────────
/** A hero of realm 0 in the middle, wounded (10 of 20 HP). */
const wounded = (b: Board) => {
  const h = at(b);
  h.hp = 10;
  return h;
};
export const ORDER_NAME_CASES: OrderDispatchCase[] = [
  {
    name: 'an order the game does not know is a Defend: he sets a watch where he stands',
    stage(b) {
      const h = at(b);
      return { hero: h, there: b.X, orders: [one(h, order('juggle', 'torches'))] };
    },
    check(o, s) {
      return {
        got: { told: told(o, liesInWait(s.hero, there(s))), watching: !!watch(o, s.hero) },
        want: {
          told: { type: 'move', targets: [0], provinceId: there(s).id, public: false, phase: 0 },
          watching: true,
        },
      };
    },
  },
  {
    name: 'an order with no name is a Defend',
    stage(b) {
      const h = at(b);
      return { hero: h, there: b.X, orders: [one(h, order(''))] };
    },
    check(o, s) {
      return {
        got: { watch: saysIn(o, s.hero, 0, liesInWait(s.hero, there(s))) },
        want: { watch: true },
      };
    },
  },
  {
    name: 'an order with no name at all (an old save) is a Defend',
    stage(b) {
      const h = at(b);
      const nameless = Object.fromEntries(
        Object.entries(order('')).filter(([k]) => k !== 'action'),
      ) as unknown as Order;
      return { hero: h, there: b.X, orders: [one(h, nameless)] };
    },
    check(o, s) {
      return {
        got: { watch: saysIn(o, s.hero, 0, liesInWait(s.hero, there(s))) },
        want: { watch: true },
      };
    },
  },
  {
    name: 'the order form\'s "Rest & Heal", in any case and with spaces about it, is a Rest',
    stage(b) {
      const h = wounded(b);
      return { hero: h, orders: [one(h, order('  REST & Heal '))] };
    },
    check(o, s) {
      return {
        got: { rested: saysIn(o, s.hero, 0, rests(s.hero)), watch: !!watch(o, s.hero) },
        want: { rested: true, watch: false },
      };
    },
  },
  {
    name: 'a Pursue order from an old save is an Encounter: he sets out after his quarry',
    stage(b) {
      const h = at(b);
      const q = rival(b, { at: ring1(b, 0) });
      return { hero: h, mark: q, orders: [one(h, order('pursue', q.id))] };
    },
    check(o, s) {
      return {
        got: {
          setOut: saysIn(o, s.hero, 0, `${s.hero.name} sets out to run down ${mark(s).name}`),
          cornered: anySays(o, `⚔ ${s.hero.name} finally corners ${mark(s).name}`),
        },
        want: { setOut: true, cornered: true },
      };
    },
  },
  {
    name: "every line of a hero's order is filed under him and the season (a Rest each season)",
    stage(b) {
      const h = wounded(b);
      return { hero: h, orders: [one(h, order('rest'))] };
    },
    check(o, s) {
      const l = o.all.filter((x) => x.text.startsWith(rests(s.hero)));
      return {
        got: { filed: l.map((x) => [x.charId, x.phase]) },
        want: { filed: [0, 1, 2, 3, 4].map((ph) => [s.hero.id, ph]) },
      };
    },
  },
];

// ── A bot's Practice on a skill at 5 ────────────────────────────────────────────────────────────────────────────
/** The line a Practice writes for the skill it drills (`label` as the game names the skill). */
const practises = (c: Character, label: string) => `${c.name} practises ${label}`;
/** The line a Practice writes for a skill already at 5. */
const maxed = (c: Character, label: string) =>
  `${c.name} has trained ${label} as far as drilling can take them (level 5).`;
/** A bot hero of realm 0 in the middle, of `skills` and no others. */
const pupil = (b: Board, skills: Record<string, number>) => {
  const h = at(b, {});
  h.skills = { ...skills };
  return h;
};
/** A Practice on `skill`. */
const practice = (skill: string) => order('practice', skill);
/** What a hero practised in phase 0: the skills his lines name. */
const drilled = (o: Outcome, c: Character) =>
  ['Melee', 'Tactical', 'March', 'Naval', 'Spy'].filter(
    (label) => saysIn(o, c, 0, practises(c, label)) || saysIn(o, c, 0, maxed(c, label)),
  );
export const BOT_PRACTICE_CASES: OrderDispatchCase[] = [
  {
    name: "a bot's Practice on a skill already at 5: he practises his best skill below 5 instead",
    bots: [0],
    stage(b) {
      const h = pupil(b, { melee: 5, tactical: 3, march: 1 });
      return { hero: h, orders: [one(h, practice('melee'))] };
    },
    check(o, s) {
      return { got: { drilled: drilled(o, s.hero) }, want: { drilled: ['Tactical'] } };
    },
  },
  {
    name: "a bot's Practice on a skill at 5 when every skill he has is at 5: the first of Melee, Tactical, March he lacks",
    bots: [0],
    stage(b) {
      const h = pupil(b, { melee: 5, tactical: 5 });
      return { hero: h, orders: [one(h, practice('melee'))] };
    },
    check(o, s) {
      return { got: { drilled: drilled(o, s.hero) }, want: { drilled: ['March'] } };
    },
  },
  {
    name: "a bot's Practice when Melee, Tactical and March are all at 5: he keeps watch instead",
    bots: [0],
    stage(b) {
      const h = pupil(b, { melee: 5, tactical: 5, march: 5 });
      return { hero: h, there: b.X, orders: [one(h, practice('melee'))] };
    },
    check(o, s) {
      return {
        got: { drilled: drilled(o, s.hero), watch: saysIn(o, s.hero, 0, liesInWait(s.hero, there(s))) },
        want: { drilled: [], watch: true },
      };
    },
  },
  {
    name: "the same order from a player's realm is carried out as given: drilling can take him no further",
    stage(b) {
      const h = pupil(b, { melee: 5, tactical: 3, march: 1 });
      return { hero: h, orders: [one(h, practice('melee'))] };
    },
    check(o, s) {
      return { got: { drilled: drilled(o, s.hero) }, want: { drilled: ['Melee'] } };
    },
  },
  {
    name: "a bot's Practice on a skill below 5 is carried out as given",
    bots: [0],
    stage(b) {
      const h = pupil(b, { melee: 4, tactical: 3, march: 1 });
      return { hero: h, orders: [one(h, practice('melee'))] };
    },
    check(o, s) {
      return { got: { drilled: drilled(o, s.hero) }, want: { drilled: ['Melee'] } };
    },
  },
  {
    name: "a bot's skill that reached 5 earlier in the turn: the next season's Practice on it switches",
    wholeTurnOnly: true,
    bots: [0],
    dice: LUCKY,
    stage(b) {
      const h = pupil(b, { melee: 4, tactical: 3, march: 1 });
      return { hero: h, orders: [one(h, practice('melee'), practice('melee'))] };
    },
    check(o, s) {
      return {
        got: {
          first: saysIn(o, s.hero, 0, practises(s.hero, 'Melee')),
          second: ['Melee', 'Tactical'].filter((l) => saysIn(o, s.hero, 1, practises(s.hero, l))),
        },
        want: { first: true, second: ['Tactical'] },
      };
    },
  },
  ...(
    [
      ['a comrade below him practising it beside him: he teaches, and keeps to it', 2, 'here', 'melee', 0, ['Melee']],
      ['a comrade at his own level is no pupil: he switches', 5, 'here', 'melee', 0, ['Tactical']],
      ['a comrade practising it in another province is no pupil', 2, 'away', 'melee', 0, ['Tactical']],
      ['a comrade practising another skill is no pupil', 2, 'here', 'tactical', 0, ['Tactical']],
      ['a comrade practising it in another season is no pupil', 2, 'here', 'melee', 1, ['Tactical']],
      ["another realm's hero practising it beside him is no pupil", 2, 'ally', 'melee', 0, ['Tactical']],
    ] as const
  ).map(([name, level, where, skill, ph, want]): OrderDispatchCase => ({
    name: `a bot's Practice on Melee at 5, ${name}`,
    bots: [0],
    stage(b) {
      const h = pupil(b, { melee: 5, tactical: 3, march: 1 });
      const t = at(b, {}, { player: where === 'ally' ? 2 : 0, at: where === 'away' ? ring1(b, 0) : b.X });
      t.skills = { melee: level, tactical: 0, march: 0 };
      const his = ph === 0 ? one(t, practice(skill)) : one(t, order('rest'), practice(skill));
      return { hero: h, other: t, orders: [one(h, practice('melee')), his] };
    },
    check(o, s) {
      return { got: { drilled: drilled(o, s.hero) }, want: { drilled: [...want] } };
    },
  })),
  {
    name: "a bot's Practice on Tactical at 5, leading companies drilling can still improve: he keeps to it",
    bots: [0],
    stage(b) {
      const h = pupil(b, { tactical: 5, melee: 3, march: 1 });
      h.armies = companies(2, 'Men-at-Arms', 'Average');
      return { hero: h, orders: [one(h, practice('tactical'))] };
    },
    check(o, s) {
      return { got: { drilled: drilled(o, s.hero) }, want: { drilled: ['Tactical'] } };
    },
  },
  {
    name: "a bot's Practice on Tactical at 5, leading only Elite companies (drilling can't improve them): he switches",
    bots: [0],
    stage(b) {
      const h = pupil(b, { tactical: 5, melee: 3, march: 1 });
      h.armies = companies(2, 'Men-at-Arms', 'Elite');
      return { hero: h, orders: [one(h, practice('tactical'))] };
    },
    check(o, s) {
      return { got: { drilled: drilled(o, s.hero) }, want: { drilled: ['Melee'] } };
    },
  },
  {
    name: "a bot's Practice on Melee at 5, leading companies drilling can improve: Melee drills no troops, he switches",
    bots: [0],
    stage(b) {
      const h = pupil(b, { melee: 5, tactical: 3, march: 1 });
      h.armies = companies(2, 'Men-at-Arms', 'Average');
      return { hero: h, orders: [one(h, practice('melee'))] };
    },
    check(o, s) {
      return { got: { drilled: drilled(o, s.hero) }, want: { drilled: ['Tactical'] } };
    },
  },
  {
    name: "a bot's Practice on Naval at 5, leading only land companies: no fleet to drill, he switches",
    bots: [0],
    stage(b) {
      const h = pupil(b, { naval: 5, melee: 3, march: 1 });
      h.armies = companies(2, 'Men-at-Arms', 'Average');
      return { hero: h, orders: [one(h, practice('naval'))] };
    },
    check(o, s) {
      return { got: { drilled: drilled(o, s.hero) }, want: { drilled: ['Melee'] } };
    },
  },
];

// ── A bot's Search ──────────────────────────────────────────────────────────────────────────────────────────────
/** A lair cleared long ago, at place 0 in the middle: a search of it only revisits it (no fight, no die). */
const DEN = 'Old Test Den';
const den = (b: Board) => {
  b.X['features'] = [{ name: DEN, tier: 'Weak', cleared: true, discovered: true, treasure: 0, monster: null }];
  return must((b.X['features'] as Record<string, unknown>[])[0], 'the den');
};
/** The line a search of the den writes. */
const revisits = (c: Character) => `${c.name} revisits the cleared ${DEN} in `;
/** A Search of the den as a bot writes it, with `extra` (`_botMinHp`, `_botIfRumour`, `prov`, …). */
const search = (extra: Record<string, unknown> = {}): Order => ({ ...order('search', 0), ...extra });
/** A bot hero of realm 0 in the middle at `hp` of 20, sent to search the den with `extra`. */
const searcher = (b: Board, hp: number, extra: Record<string, unknown>): Staged => {
  den(b);
  const h = at(b);
  h.hp = hp;
  return { hero: h, there: b.X, orders: [one(h, search(extra))] };
};
/** What a search came to in phase 0: in, or a rest, and why. */
const searched = (o: Outcome, s: Staged) => ({
  wentIn: saysIn(o, s.hero, 0, revisits(s.hero)),
  rested: saysIn(o, s.hero, 0, rests(s.hero)),
});
const hurt = (c: Character) => `${c.name} is too badly hurt to face another guardian this season and rests instead.`;
const leaves = (c: Character, what = `the ${DEN}`) =>
  `${c.name} weighs what the taverns said of ${what} and leaves it for another day.`;
const notThere = (c: Character, p?: Province) =>
  `${c.name} never reaches the lair they set out for${p ? ` in ${p.name}` : ''}, and will not go blind into another — the search is abandoned and they rest instead.`;
/** The talk a hero heard of the den: `{charId, turn, band}` under his realm. */
const heard = (b: Board, by: Character, band: number, { turn = b.G.turn, realm = 0 } = {}) => {
  const f = den(b);
  f['_rumourOdds'] = { [realm]: { charId: by.id, turn, band, win: 0.5, felled: 0.1 } };
};
export const BOT_SEARCH_CASES: OrderDispatchCase[] = [
  {
    name: 'too badly hurt (below the share of his HP his orders name): he rests instead, and is told why',
    bots: [0],
    stage(b) {
      return searcher(b, 10, { _botMinHp: 0.6 });
    },
    check(o, s) {
      return {
        got: { ...searched(o, s), told: told(o, hurt(s.hero)) },
        want: {
          wentIn: false,
          rested: true,
          told: { type: 'explore', targets: [0], provinceId: there(s).id, public: false, phase: 0 },
        },
      };
    },
  },
  {
    name: 'at exactly that share of his HP: he goes in',
    bots: [0],
    stage(b) {
      return searcher(b, 12, { _botMinHp: 0.6 });
    },
    check(o, s) {
      return {
        got: { ...searched(o, s), hurt: anySays(o, hurt(s.hero)) },
        want: { wentIn: true, rested: false, hurt: false },
      };
    },
  },
  {
    name: 'no share named: even badly hurt he goes in',
    bots: [0],
    stage(b) {
      return searcher(b, 2, {});
    },
    check(o, s) {
      return { got: searched(o, s), want: { wentIn: true, rested: false } };
    },
  },
  {
    name: 'talk this hero heard this turn at the band his orders name: he goes in',
    bots: [0],
    stage(b) {
      const s = searcher(b, 20, { _botIfRumour: 3 });
      heard(b, s.hero, 3);
      return s;
    },
    check(o, s) {
      return { got: searched(o, s), want: { wentIn: true, rested: false } };
    },
  },
  {
    name: 'talk at a better band than named: he goes in',
    bots: [0],
    stage(b) {
      const s = searcher(b, 20, { _botIfRumour: 3 });
      heard(b, s.hero, 4);
      return s;
    },
    check(o, s) {
      return { got: searched(o, s), want: { wentIn: true, rested: false } };
    },
  },
  ...(
    [
      ['at a worse band than named', { band: 2 }],
      ['heard by another hero of his realm', { by: 'other' }],
      ['heard in an earlier turn', { turn: -1 }],
      ['heard by a hero of another realm', { realm: 1 }],
      ['none at all', { none: true }],
    ] as const
  ).map(([name, how]): OrderDispatchCase => ({
    name: `talk ${name}: he leaves the lair for another day, and rests`,
    bots: [0],
    stage(b) {
      b.G.turn = 3;
      const s = searcher(b, 20, { _botIfRumour: 3 });
      const by = 'by' in how ? at(b, {}) : s.hero;
      if (!('none' in how))
        heard(b, by, 'band' in how ? how.band : 3, {
          turn: b.G.turn + ('turn' in how ? how.turn : 0),
          realm: 'realm' in how ? how.realm : 0,
        });
      return s;
    },
    check(o, s) {
      return {
        got: { ...searched(o, s), told: told(o, leaves(s.hero)) },
        want: {
          wentIn: false,
          rested: true,
          told: { type: 'explore', targets: [0], provinceId: there(s).id, public: false, phase: 0 },
        },
      };
    },
  })),
  {
    name: 'talk at the lower band his orders allow, at full health: he goes in',
    bots: [0],
    stage(b) {
      const s = searcher(b, 20, { _botIfRumour: 3, _botIfRumourLow: 2 });
      heard(b, s.hero, 2);
      return s;
    },
    check(o, s) {
      return { got: searched(o, s), want: { wentIn: true, rested: false } };
    },
  },
  {
    name: 'talk at the lower band, below 95% of his HP: he leaves it',
    bots: [0],
    stage(b) {
      const s = searcher(b, 18, { _botIfRumour: 3, _botIfRumourLow: 2 });
      heard(b, s.hero, 2);
      return s;
    },
    check(o, s) {
      return {
        got: { ...searched(o, s), left: anySays(o, leaves(s.hero)) },
        want: { wentIn: false, rested: true, left: true },
      };
    },
  },
  {
    name: 'talk at the lower band, at 95% of his HP exactly: he goes in',
    bots: [0],
    stage(b) {
      const s = searcher(b, 19, { _botIfRumour: 3, _botIfRumourLow: 2 });
      heard(b, s.hero, 2);
      // 19 of 20 is 95%
      return s;
    },
    check(o, s) {
      return { got: searched(o, s), want: { wentIn: true, rested: false } };
    },
  },
  {
    name: 'talk at the lower band, with the share of his HP his orders name for it: he goes in',
    bots: [0],
    stage(b) {
      const s = searcher(b, 17, { _botIfRumour: 3, _botIfRumourLow: 2, _botIfRumourLowHp: 0.85 });
      heard(b, s.hero, 2);
      return s;
    },
    check(o, s) {
      return { got: searched(o, s), want: { wentIn: true, rested: false } };
    },
  },
  {
    name: 'talk at the lower band, below the share his orders name for it: he leaves it',
    bots: [0],
    stage(b) {
      const s = searcher(b, 16, { _botIfRumour: 3, _botIfRumourLow: 2, _botIfRumourLowHp: 0.85 });
      heard(b, s.hero, 2);
      return s;
    },
    check(o, s) {
      return { got: searched(o, s), want: { wentIn: false, rested: true } };
    },
  },
  {
    name: 'talk below the lower band: he leaves it',
    bots: [0],
    stage(b) {
      const s = searcher(b, 20, { _botIfRumour: 3, _botIfRumourLow: 2 });
      heard(b, s.hero, 1);
      return s;
    },
    check(o, s) {
      return { got: searched(o, s), want: { wentIn: false, rested: true } };
    },
  },
  {
    name: 'no lair at the place his orders name: he weighs what was said "of the lair" and rests',
    bots: [0],
    stage(b) {
      den(b);
      const h = at(b);
      return { hero: h, there: b.X, orders: [one(h, { ...search({ _botIfRumour: 3 }), target: '4' })] };
    },
    check(o, s) {
      return {
        got: { left: saysIn(o, s.hero, 0, leaves(s.hero, 'the lair')), rested: saysIn(o, s.hero, 0, rests(s.hero)) },
        want: { left: true, rested: true },
      };
    },
  },
  {
    name: 'a search written for another province: he will not go blind into a lair here, and rests',
    stage(b) {
      const s = searcher(b, 20, { prov: String(ring1(b, 0).id) });
      return { ...s, places: [ring1(b, 0)] };
    },
    check(o, s) {
      const p = must(s.places?.[0], 'the province it was written for');
      return {
        got: { ...searched(o, s), told: told(o, notThere(s.hero, p)) },
        want: {
          wentIn: false,
          rested: true,
          told: { type: 'explore', targets: [0], provinceId: there(s).id, public: false, phase: 0 },
        },
      };
    },
  },
  {
    name: 'a search written for a province the map does not have: abandoned the same, the line naming none',
    stage(b) {
      return searcher(b, 20, { prov: '9999' });
    },
    check(o, s) {
      return {
        got: { ...searched(o, s), told: saysIn(o, s.hero, 0, notThere(s.hero)) },
        want: { wentIn: false, rested: true, told: true },
      };
    },
  },
  ...(
    [
      ['for the province he stands in (as a number)', (b: Board) => b.X.id],
      ['for the province he stands in (as text)', (b: Board) => String(b.X.id)],
      ['for no province (written before searches named one)', () => ''],
    ] as const
  ).map(([name, prov]): OrderDispatchCase => ({
    name: `a search written ${name}: he goes in`,
    stage(b) {
      return searcher(b, 20, { prov: prov(b) });
    },
    check(o, s) {
      return { got: searched(o, s), want: { wentIn: true, rested: false } };
    },
  })),
  {
    name: 'too hurt, with no talk heard and written elsewhere: he is told only the first reason',
    bots: [0],
    stage(b) {
      return searcher(b, 10, { _botMinHp: 0.6, _botIfRumour: 3, prov: String(ring1(b, 0).id) });
    },
    check(o, s) {
      return {
        got: {
          hurt: anySays(o, hurt(s.hero)),
          left: anySays(o, leaves(s.hero)),
          notThere: anySays(o, `${s.hero.name} never reaches the lair`),
          rested: saysIn(o, s.hero, 0, rests(s.hero)),
        },
        want: { hurt: true, left: false, notThere: false, rested: true },
      };
    },
  },
  {
    name: 'no talk heard and written elsewhere: he is told only that he leaves it for another day',
    bots: [0],
    stage(b) {
      return searcher(b, 20, { _botIfRumour: 3, prov: String(ring1(b, 0).id) });
    },
    check(o, s) {
      return {
        got: { left: anySays(o, leaves(s.hero)), notThere: anySays(o, `${s.hero.name} never reaches the lair`) },
        want: { left: true, notThere: false },
      };
    },
  },
];

// ── The battle lock ─────────────────────────────────────────────────────────────────────────────────────────────
/** Realm 0 holds the middle; its hero `h` stands there with three companies and no ground of his own behind him (a
 *  beaten host with nowhere to retreat does not yield), and an enemy column of realm 1 marches in from next door in the
 *  first phase, quicker than he is (Tactical 5): the battle for the middle is left unresolved. `h` acts after it. */
const lockedIn = (b: Board) => {
  b.own(b.X, 0);
  const h = at(b, { tactical: 1, march: 0 });
  h.armies = companies(3);
  const e = rival(b, { at: ring1(b, 0) }, { tactical: 5, march: 3 });
  e.armies = companies(3);
  const q = rival(b, { at: must(b.ring2[5], 'a province two away') });
  return { h, e, q };
};
const locked = (c: Character, p: Province) =>
  `${c.name} is still locked in the unresolved battle for ${p.name} and cannot march away — the enemy is on the field and the fight must be seen through before the column can move on.`;
const CONTESTED = 'the province remains contested';
export const BATTLE_LOCK_CASES: OrderDispatchCase[] = [
  {
    name: 'an Encounter out of a province whose battle was left unresolved this season: refused, and he stays',
    wholeTurnOnly: true,
    stage(b) {
      const { h, e, q } = lockedIn(b);
      return {
        hero: h,
        other: e,
        mark: q,
        there: b.X,
        orders: [one(h, order('encounter', q.id)), one(e, order('move', b.X.id))],
      };
    },
    check(o, s) {
      const l = o.all.find((x) => x.text === locked(s.hero, there(s)));
      return {
        got: {
          contested: anySays(o, CONTESTED),
          told: told(o, locked(s.hero, there(s))),
          notice: l ? [l.charId, l['pinNotice']] : null,
          setOut: anySays(o, `${s.hero.name} sets out to run down`),
        },
        want: {
          contested: true,
          told: { type: 'combat', targets: [0], provinceId: there(s).id, public: false, phase: 0 },
          notice: [s.hero.id, true],
          setOut: false,
        },
      };
    },
  },
  {
    name: 'a Pursue (an Encounter in an old save) out of it: refused the same',
    wholeTurnOnly: true,
    stage(b) {
      const { h, e, q } = lockedIn(b);
      return {
        hero: h,
        other: e,
        mark: q,
        there: b.X,
        orders: [one(h, order('pursue', q.id)), one(e, order('move', b.X.id))],
      };
    },
    check(o, s) {
      return {
        got: { locked: saysIn(o, s.hero, 0, locked(s.hero, there(s))), setOut: anySays(o, `${s.hero.name} sets out`) },
        want: { locked: true, setOut: false },
      };
    },
  },
  {
    name: 'a Move out of it, by a hero handed his companies earlier in the season (no column to stop at the gates then): refused',
    wholeTurnOnly: true,
    stage(b) {
      const { h, e } = lockedIn(b);
      // h starts the season with no companies: a comrade beside him hands him his own before the enemy marches in
      const g = at(b, { tactical: 0, march: 0 });
      g.armies = h.armies;
      h.armies = [];
      return {
        hero: h,
        other: e,
        there: b.X,
        orders: [
          one(h, order('move', ring1(b, 3).id)),
          one(g, order('leave_army', 'all', String(b.G.characters.indexOf(h)))),
          one(e, order('move', b.X.id)),
        ],
      };
    },
    check(o, s) {
      return {
        got: {
          handed: anySays(o, `takes command of Men-at-Arms c0, Men-at-Arms c1, Men-at-Arms c2`),
          contested: anySays(o, CONTESTED),
          locked: saysIn(o, s.hero, 0, locked(s.hero, there(s))),
          where: char(o, s.hero).location,
        },
        want: { handed: true, contested: true, locked: true, where: there(s).id },
      };
    },
  },
  {
    name: 'a hero of the same realm with no companies, in the same province: he is not held, and sets out',
    wholeTurnOnly: true,
    stage(b) {
      const { h, e, q } = lockedIn(b);
      const lone = at(b, { tactical: 0, march: 0 });
      return {
        hero: lone,
        other: e,
        mark: q,
        there: b.X,
        orders: [one(lone, order('encounter', q.id)), one(h, order('defend')), one(e, order('move', b.X.id))],
      };
    },
    check(o, s) {
      return {
        got: {
          contested: anySays(o, CONTESTED),
          locked: anySays(o, locked(s.hero, there(s))),
          setOut: saysIn(o, s.hero, 0, `${s.hero.name} sets out to run down ${mark(s).name}`),
        },
        want: { contested: true, locked: false, setOut: true },
      };
    },
  },
  {
    name: 'any other order in the same province (a Defend) is carried out',
    wholeTurnOnly: true,
    stage(b) {
      const { h, e } = lockedIn(b);
      return { hero: h, other: e, there: b.X, orders: [one(h, order('defend')), one(e, order('move', b.X.id))] };
    },
    check(o, s) {
      return {
        got: {
          contested: anySays(o, CONTESTED),
          locked: anySays(o, locked(s.hero, there(s))),
          defended: linesIn(o, s.hero, 0).some((t) => t.includes('sets a watch') || t.includes('Defend order is done')),
        },
        want: { contested: true, locked: false, defended: true },
      };
    },
  },
];

// ── A charmed enemy hero ────────────────────────────────────────────────────────────────────────────────────────
/** A hero of realm 1 charmed for this turn into realm 0's service, in the middle, of every war and craft skill at 9. */
const charmed = (b: Board) => {
  const h = at(b, {
    melee: 9,
    tactical: 9,
    march: 9,
    naval: 9,
    archery: 9,
    sage: 9,
    explorer: 9,
    spy: 9,
    thief: 9,
  });
  Object.assign(h, { _charmTempControl: true, _charmOriginalPlayer: 1 });
  return h;
};
const refusal = (c: Character, why: string) =>
  `${c.name} is held by an enchantment, not an oath — they will not ${why}. The order comes to nothing.`;
const MASTERIES = [
  'challenge',
  'rampage',
  'rain_of_arrows',
  'snipers_mark',
  'feigned_retreat',
  'grand_stratagem',
  'forced_march',
  'lightning_advance',
  'blockade',
  'raid_coast',
  'research_breakthrough',
  'grand_design',
  'sabotage',
  'assassinate',
  'grand_heist',
  'vanish',
  'awaken_grove',
  'wild_calling',
  'chart_unknown',
  'discover_ruin',
];
const RITES = ['consecrate', 'call_to_arms', 'broker', 'harvest_field', 'rite'];
export const CHARM_CASES: OrderDispatchCase[] = [
  {
    name: 'Disband Army: he will not break up companies not his own',
    stage(b) {
      const h = charmed(b);
      h.armies = companies(2);
      return { hero: h, orders: [one(h, order('disband_army', 'all'))] };
    },
    check(o, s) {
      return {
        got: {
          told: told(o, refusal(s.hero, 'break up companies that are not theirs to disband')),
          companies: char(o, s.hero).armies.length,
        },
        want: { told: { type: 'system', targets: [0], provinceId: null, public: false, phase: 0 }, companies: 2 },
      };
    },
  },
  ...RITES.map((rite): OrderDispatchCase => ({
    name: `a rite of a realm he does not serve (${rite}): refused`,
    stage(b) {
      const h = charmed(b);
      return { hero: h, orders: [one(h, order(rite))] };
    },
    check(o, s) {
      return {
        got: { refused: saysIn(o, s.hero, 0, refusal(s.hero, 'perform the rites of a realm they do not serve')) },
        want: { refused: true },
      };
    },
  })),
  ...MASTERIES.map((mastery): OrderDispatchCase => ({
    name: `his own mastery for a crown that only holds his mind (${mastery}): refused, and not spent`,
    stage(b) {
      const h = charmed(b);
      return { hero: h, orders: [one(h, order(mastery))] };
    },
    check(o, s) {
      return {
        got: {
          refused: saysIn(
            o,
            s.hero,
            0,
            refusal(s.hero, 'spend their own mastery for a crown that merely holds their mind'),
          ),
          spent: charged(o, s.hero, mastery) ?? null,
        },
        want: { refused: true, spent: null },
      };
    },
  })),
  {
    name: 'any other order (a Move) he obeys',
    stage(b) {
      const h = charmed(b);
      return { hero: h, there: ring1(b, 0), orders: [one(h, order('move', ring1(b, 0).id))] };
    },
    check(o, s) {
      return {
        got: { where: char(o, s.hero).location, refused: anySays(o, 'is held by an enchantment') },
        want: { where: there(s).id, refused: false },
      };
    },
  },
  {
    name: 'a hero won over for good (no enchantment holding him) spends his mastery as any hero of the realm',
    stage(b) {
      const h = at(b, { tactical: 7 });
      h['_charmOriginalPlayer'] = 1;
      return { hero: h, orders: [one(h, order('feigned_retreat'))] };
    },
    check(o, s) {
      return {
        got: {
          laid: saysIn(o, s.hero, 0, `🏳 ${s.hero.name} lays a Feigned Retreat`),
          spent: charged(o, s.hero, 'feigned_retreat'),
        },
        want: { laid: true, spent: o.turn },
      };
    },
  },
];

// ── A mastery once a turn ───────────────────────────────────────────────────────────────────────────────────────
const feint = (c: Character) => `🏳 ${c.name} lays a Feigned Retreat`;
const stratagem = (c: Character) => `📜 ${c.name} sets a Grand Stratagem in motion`;
const already = (c: Character, label: string) =>
  `${c.name} has already used their ${label} mastery this turn — it may be commanded but once per turn.`;
export const ONCE_A_TURN_CASES: OrderDispatchCase[] = [
  {
    name: 'a mastery given twice in a turn: the second is refused, and he is told under his name',
    wholeTurnOnly: true,
    stage(b) {
      const h = at(b, { tactical: 7 });
      return { hero: h, orders: [one(h, order('feigned_retreat'), order('feigned_retreat'))] };
    },
    check(o, s) {
      return {
        got: {
          laid: [0, 1].map((ph) => saysIn(o, s.hero, ph, feint(s.hero))),
          told: told(o, already(s.hero, 'Feigned Retreat')),
          spent: charged(o, s.hero, 'feigned_retreat'),
        },
        want: {
          laid: [true, false],
          told: { type: 'system', targets: [0], provinceId: null, public: false, phase: 1 },
          spent: o.turn,
        },
      };
    },
  },
  {
    name: 'two masteries in one turn: each is carried out',
    wholeTurnOnly: true,
    stage(b) {
      const h = at(b, { tactical: 9 });
      return { hero: h, orders: [one(h, order('feigned_retreat'), order('grand_stratagem'))] };
    },
    check(o, s) {
      return {
        got: { feint: saysIn(o, s.hero, 0, feint(s.hero)), stratagem: saysIn(o, s.hero, 1, stratagem(s.hero)) },
        want: { feint: true, stratagem: true },
      };
    },
  },
  {
    name: 'a mastery used last turn may be used again this turn',
    stage(b) {
      b.G.turn = 3;
      const h = at(b, { tactical: 7 });
      h['_masteryOrderUsed'] = { feigned_retreat: 2 };
      return { hero: h, orders: [one(h, order('feigned_retreat'))] };
    },
    check(o, s) {
      return {
        got: { laid: saysIn(o, s.hero, 0, feint(s.hero)), spent: charged(o, s.hero, 'feigned_retreat') },
        want: { laid: true, spent: o.turn },
      };
    },
  },
  {
    name: 'a mastery already spent this turn (as the save holds it): refused',
    stage(b) {
      const h = at(b, { tactical: 7 });
      h['_masteryOrderUsed'] = { feigned_retreat: b.G.turn };
      return { hero: h, orders: [one(h, order('feigned_retreat'))] };
    },
    check(o, s) {
      return {
        got: { laid: anySays(o, feint(s.hero)), refused: saysIn(o, s.hero, 0, already(s.hero, 'Feigned Retreat')) },
        want: { laid: false, refused: true },
      };
    },
  },
  {
    name: 'two heroes, the same mastery in the same turn: each spends his own',
    stage(b) {
      const h = at(b, { tactical: 7 });
      const g = at(b, { tactical: 7 });
      return { hero: h, other: g, orders: [one(h, order('feigned_retreat')), one(g, order('feigned_retreat'))] };
    },
    check(o, s) {
      return {
        got: { his: saysIn(o, s.hero, 0, feint(s.hero)), theirs: saysIn(o, other(s), 0, feint(other(s))) },
        want: { his: true, theirs: true },
      };
    },
  },
  {
    name: 'a mastery refused for want of the skill is still spent: the next try is "already used" (today\'s rule)',
    wholeTurnOnly: true,
    stage(b) {
      const h = at(b, { tactical: 6 });
      return { hero: h, orders: [one(h, order('feigned_retreat'), order('feigned_retreat'))] };
    },
    check(o, s) {
      return {
        got: {
          lacks: saysIn(o, s.hero, 0, `${s.hero.name} lacks the Tactical mastery (7)`),
          already: saysIn(o, s.hero, 1, already(s.hero, 'Feigned Retreat')),
        },
        want: { lacks: true, already: true },
      };
    },
  },
  {
    name: 'a mastery named as the order form names it ("Feigned Retreat") is the same mastery',
    wholeTurnOnly: true,
    stage(b) {
      const h = at(b, { tactical: 7 });
      return { hero: h, orders: [one(h, order('Feigned Retreat'), order('feigned_retreat'))] };
    },
    check(o, s) {
      return {
        got: {
          laid: saysIn(o, s.hero, 0, feint(s.hero)),
          already: saysIn(o, s.hero, 1, already(s.hero, 'Feigned Retreat')),
        },
        want: { laid: true, already: true },
      };
    },
  },
];

// ── Forced March ────────────────────────────────────────────────────────────────────────────────────────────────
/** A column of realm 0 in the middle (March 7) and a province next door held by realm 1's companies. */
const forced = (b: Board) => {
  const to = ring1(b, 0);
  b.own(to, 1);
  hero(b, { player: 1, at: to, troops: 2, quality: 'Average' });
  const h = at(b, { march: 7, tactical: 3 });
  h.armies = companies(3);
  return { h, to };
};
const slips = (c: Character, p: Province) =>
  `⚡ ${c.name}'s Forced March filters into ${p.name} without giving battle this phase`;
export const FORCED_MARCH_CASES: OrderDispatchCase[] = [
  {
    name: 'a Forced March on enemy ground, on a low die: the column slips in without giving battle',
    dice: LUCKY,
    stage(b) {
      const { h, to } = forced(b);
      return { hero: h, there: to, orders: [one(h, order('forced_march', to.id))] };
    },
    check(o, s) {
      return {
        got: { slipped: saysIn(o, s.hero, 0, slips(s.hero, there(s))), spent: charged(o, s.hero, 'forced_march') },
        want: { slipped: true, spent: o.turn },
      };
    },
  },
  {
    name: 'an ordinary Move on the same ground, on the same die: battle is given',
    dice: LUCKY,
    stage(b) {
      const { h, to } = forced(b);
      return { hero: h, there: to, orders: [one(h, order('move', to.id))] };
    },
    check(o, s) {
      return {
        got: { slipped: anySays(o, slips(s.hero, there(s))), battle: anySays(o, `⚔ **Battle for ${there(s).name}**`) },
        want: { slipped: false, battle: true },
      };
    },
  },
  {
    name: 'a Forced March without March 7: refused, and still spent (the next try is "already used")',
    wholeTurnOnly: true,
    stage(b) {
      const { h, to } = forced(b);
      h.skills['march'] = 6;
      return { hero: h, there: to, orders: [one(h, order('forced_march', to.id), order('forced_march', to.id))] };
    },
    check(o, s) {
      const lacks = `${s.hero.name} lacks the March mastery (7) for a Forced March.`;
      return {
        got: {
          told: told(o, lacks),
          already: saysIn(o, s.hero, 1, already(s.hero, 'Forced March')),
          where: char(o, s.hero).location,
        },
        want: {
          told: { type: 'system', targets: [0], provinceId: null, public: false, phase: 0 },
          already: true,
          where: s.hero.location,
        },
      };
    },
  },
];

// ── A spell item's Use Item ─────────────────────────────────────────────────────────────────────────────────────
const censer = (b: Board): Item => item(b, 'Censer of Plenty');
const invokes = (c: Character) => `🔮 ${c.name} invokes the Censer of Plenty to work Bless Province.`;
export const SPELL_ITEM_CASES: OrderDispatchCase[] = [
  ...(
    [
      ['named by its id', (i: Item) => String(i['id'])],
      ['named by its name', (i: Item) => i.name],
    ] as const
  ).map(([name, target]): OrderDispatchCase => ({
    name: `Use Item on a spell item, ${name}: the spell is cast from it`,
    stage(b) {
      const h = at(b, {});
      const it = censer(b);
      holding(h, it);
      return { hero: h, there: b.X, orders: [one(h, order('use_item', target(it), b.X.id))] };
    },
    check(o, s) {
      return {
        got: {
          invoked: says(o, invokes(s.hero)),
          blessed: o.world.world.provinces[there(s).id]?.['_blessedTurn'] ?? null,
        },
        want: { invoked: true, blessed: o.turn },
      };
    },
  })),
  {
    name: 'Use Item on an item whose spell the game does not know: used as an item, nothing cast',
    stage(b) {
      const h = at(b, {});
      const it: Item = {
        ...censer(b),
        name: 'Censer of Nothing',
        effect: { stat: 'castSpell', spell: 'No Such Spell', bonus: 0 },
      };
      holding(h, it);
      return { hero: h, there: b.X, orders: [one(h, order('use_item', String(it['id']), b.X.id))] };
    },
    check(o, s) {
      return {
        // as an item: its power is a castSpell one, which the Use Item order counts as always active
        got: { lines: linesIn(o, s.hero, 0) },
        want: {
          lines: ['The Censer of Nothing is a passive item and does not need to be used — its power is always active.'],
        },
      };
    },
  },
  {
    name: 'Use Item naming an item he does not carry: nothing cast',
    stage(b) {
      const h = at(b, {});
      holding(h, censer(b));
      return { hero: h, there: b.X, orders: [one(h, order('use_item', '424242', b.X.id))] };
    },
    check(o, s) {
      return { got: { lines: linesIn(o, s.hero, 0) }, want: { lines: [`${s.hero.name}: no such item to use.`] } };
    },
  },
];

/** Stages `c` on `b`, from plain realms; a bot realm keeps a province beyond the middle, so it doesn't concede. */
export const stageCase = (b: Board, c: OrderDispatchCase): Staged => {
  plainRealms(b);
  b.G.players.forEach((pl) => {
    pl['heroes'] = [];
  });
  for (const i of c.bots ?? []) {
    const pl = must(b.G.players[i], 'realm ' + String(i));
    if (!pl.provinces.length) {
      const beyond = must(
        b.G.world.provinces.find((p) => !b.near.includes(p) && p.owner == null && p.terrain !== 'sea'),
        'an unheld province beyond the middle',
      );
      b.own(beyond, i);
    }
  }
  return c.stage(b);
};

/** Every case, by the check (named as a player meets it). */
export const ORDER_DISPATCH_CASES: [string, OrderDispatchCase[]][] = [
  ['Superseded (a friend in the assault)', SUPERSEDED_CASES],
  ["The order's name", ORDER_NAME_CASES],
  ["A bot's Practice", BOT_PRACTICE_CASES],
  ["A bot's Search", BOT_SEARCH_CASES],
  ['The battle lock', BATTLE_LOCK_CASES],
  ['A charmed enemy hero', CHARM_CASES],
  ['A mastery once a turn', ONCE_A_TURN_CASES],
  ['Forced March', FORCED_MARCH_CASES],
  ["A spell item's Use Item", SPELL_ITEM_CASES],
];
