// The research and practice orders' cases (plan P1-08j4): Research, Practice Skill, Rest and Research Breakthrough,
// staged on the middle of a bot world (lib/middle-of-a-bot-world.ts), from plain realms, each with what must be true
// after it in game terms. scenario/research-and-practice-orders-in-a-whole-turn.test.ts plays each through a whole
// turn (resolveTurn); unit/research-and-practice-orders-called-directly.test.ts calls each order's own function on
// them, one phase at a time. A case stages its world and the heroes' orders; after them, it reads what it needs from
// the world and the log (`got`) beside what must be so (`want`), and the test compares the two. Every outcome is
// certain: a case reads the chance a roll was made at, or checks that what the roll decided holds together (a
// discovery and the line that tells it), never what the dice gave. A realm that knows every discovery of the hidden
// fields (Heroic and Special) can't make an unlooked-for find, so its Research always reaches the ordinary roll.
import vm from 'node:vm';
import {
  hero,
  must,
  order,
  plan,
  type Board,
  type Character,
  type HeroSpec,
  type Line,
  type Order,
  type World,
} from './middle-of-a-bot-world.ts';
import { companies, plainRealms } from './recruit-hire-and-realm-works-order-cases.ts';

export interface Staged {
  /** The hero whose orders the case is about. */
  hero: Character;
  /** Every hero given orders, with them (the hero's own first). */
  orders: [Character, Order[]][];
  /** Another hero the case needs (a mentor, a pupil, a comrade). */
  other?: Character;
  /** The realm's discoveries before the orders, by id. */
  knew?: string[];
  /** The discoveries the order may yield, by id. */
  pool?: string[];
}
export interface Outcome {
  world: World;
  /** The hero's own lines in the log. */
  lines: Line[];
  /** Every line in the log. */
  all: Line[];
  /** The turn the orders were played in. */
  turn: number;
}
export interface ResearchAndPracticeOrderCase {
  name: string;
  /** Plays only in a whole turn: processOrder refuses the order before the order's own function runs (a mastery once
   *  a turn), or the turn's end tells it (a hero who does nothing). */
  wholeTurnOnly?: boolean;
  stage(b: Board): Staged;
  /** What the case found after the orders, and what it should have found: the same keys. */
  check(o: Outcome, s: Staged): { got: Record<string, unknown>; want: Record<string, unknown> };
}

export interface Discovery {
  id: string;
  name: string;
  category: string;
  desc: string;
  race?: string;
  alignment?: string;
}
/** Every discovery of the game's, as the engine holds them. */
export const discoveries = (b: Board): Discovery[] =>
  JSON.parse(vm.runInContext('JSON.stringify(SAGE_DISCOVERIES_P)', b.engine) as string) as Discovery[];
/** The fields a Research order can't name: they turn up only as an unlooked-for find. */
export const HIDDEN_FIELDS = ['Heroic', 'Special'];
/** What a realm of `alignment` and `race` may study (as discEligible has it). */
export const eligible = (d: Discovery, alignment: string, race: string) =>
  (!d.race || d.race === race) && (!d.alignment || d.alignment === alignment);
const entry = (d: Discovery) => ({ id: d.id, name: d.name, category: d.category, desc: d.desc, turnDiscovered: 0 });
/** Realm `i` knows `pick`'s discoveries, as well as its own. */
export const knows = (b: Board, pick: (d: Discovery) => boolean, i = 0) => {
  const pl = must(b.G.players[i], 'realm ' + String(i));
  const had = (pl['discoveries'] as { id: string }[] | undefined) ?? [];
  pl['discoveries'] = [
    ...had,
    ...discoveries(b)
      .filter((d) => pick(d) && !had.some((x) => x.id === d.id))
      .map(entry),
  ];
};
/** Realm `i` has made every discovery of the hidden fields: its Research never turns up an unlooked-for find. */
export const knowsHidden = (b: Board, i = 0) => {
  knows(b, (d) => HIDDEN_FIELDS.includes(d.category), i);
};
const ids = (o: Outcome, i = 0) =>
  ((must(o.world.players[i], 'realm ' + String(i))['discoveries'] as { id: string }[] | undefined) ?? []).map(
    (d) => d.id,
  );
const knew = (b: Board, i = 0) =>
  ((must(b.G.players[i], 'realm ' + String(i))['discoveries'] as { id: string }[] | undefined) ?? []).map((d) => d.id);
interface Choice {
  key: string;
  turn: number;
  charId: number;
  charName: string;
  category: string;
  options: string[];
}
const choices = (o: Outcome, i = 0) =>
  (must(o.world.players[i], 'realm ' + String(i))['pendingDiscoveryChoices'] as Choice[] | undefined) ?? [];

const text = (ls: Line[]) => ls.map((l) => l.text).join('\n');
/** Whether the hero's lines say `what` (a string, or a pattern). */
const says = (o: Outcome, what: string | RegExp) =>
  typeof what === 'string' ? text(o.lines).includes(what) : what.test(text(o.lines));
/** `c`'s own lines. */
const linesOf = (o: Outcome, c: Character) => o.all.filter((l) => l.charId === c.id);
/** `c`'s own line that matches `what`, or ''. */
const lineOf = (o: Outcome, c: Character, what: RegExp) => linesOf(o, c).find((l) => what.test(l.text))?.text ?? '';
const char = (o: Outcome, c: Character) =>
  must(
    o.world.characters.find((x) => x.id === c.id),
    'hero ' + c.name,
  );
const realm = (b: Board, i = 0) => must(b.G.players[i], 'realm ' + String(i));
const skilled = (skills: Record<string, number>) => ({ melee: 2, tactical: 2, march: 1, spy: 0, ...skills });
/** A hero of realm 0 standing in the middle, at full health but for `hp`. His maximum HP is the turn's own reckoning
 *  of it (15 to start, and what he has earned), so the turn keeps it as staged. */
const at = (b: Board, extra: Partial<HeroSpec> & { race?: string; wounded?: number } = {}) => {
  const { race, wounded, ...spec } = extra;
  const h = hero(b, { player: 0, at: b.X, ...spec });
  h['hpEarned'] = Math.max(0, h.maxHp - 15);
  if (race) h['race'] = race;
  if (wounded != null) h.hp = wounded;
  return h;
};
/** The king of realm 0, in the middle. */
const king = (b: Board, extra: Parameters<typeof at>[1] = {}) => at(b, { king: true, ...extra });
/** Realm `i` of the creed `alignment` (and the folk `race`). */
const creed = (b: Board, alignment: string, i = 0, race?: string) => {
  realm(b, i)['alignment'] = alignment;
  if (race) realm(b, i)['race'] = race;
};
/** Realm `i` holds the discovery `id`. */
const discovered = (b: Board, id: string, i = 0) => {
  knows(b, (d) => d.id === id, i);
};
const one = (c: Character, ...os: Order[]): [Character, Order[]] => [c, plan(...os)];

// ── Research ────────────────────────────────────────────────────────────────────────────────────────────────────
/** The 📊 Research lines of `c`, each with the chance it quotes and whether its roll landed. */
const rolls = (o: Outcome, c: Character) =>
  linesOf(o, c)
    .filter((l) => l.text.startsWith('📊 Research'))
    .map((l) => ({
      text: l.text,
      chance: Number((/(\d+)% chance/.exec(l.text) ?? [])[1]),
      landed: l.text.includes('✓ Success!'),
    }));
const firstRoll = (o: Outcome, c: Character) => rolls(o, c)[0] ?? { text: '', chance: NaN, landed: false };

export const RESEARCH_ORDER_CASES: ResearchAndPracticeOrderCase[] = [
  {
    name: 'Research: refused without any Sage learning, with no roll',
    stage(b) {
      const h = king(b, { skills: skilled({ sage: 0 }) });
      return { hero: h, orders: [one(h, order('research', 'any'))], knew: knew(b) };
    },
    check(o, { hero: h, knew: k }) {
      return {
        got: {
          told: says(o, 'pores over the archives, but without any Sage learning (Sage 1+) the pages mean nothing'),
          rolled: rolls(o, h).length,
          learned: ids(o).length,
        },
        want: { told: true, rolled: 0, learned: k?.length },
      };
    },
  },
  {
    name: 'Research: the chance is five in a hundred a level of Sage',
    stage(b) {
      knowsHidden(b);
      const h = king(b, { skills: skilled({ sage: 3 }) });
      return { hero: h, orders: [one(h, order('research', 'any'))] };
    },
    check(o, { hero: h }) {
      return {
        got: { chance: firstRoll(o, h).chance, quoted: firstRoll(o, h).text.includes('(Sage level 3)') },
        want: { chance: 15, quoted: true },
      };
    },
  },
  {
    name: 'Research: past Sage 5 the chance climbs no further (the masteries take over)',
    stage(b) {
      knowsHidden(b);
      const h = king(b, { skills: skilled({ sage: 8 }) });
      return { hero: h, orders: [one(h, order('research', 'any'))] };
    },
    check(o, { hero: h }) {
      return { got: { chance: firstRoll(o, h).chance }, want: { chance: 25 } };
    },
  },
  {
    name: 'Research: a Neutral realm’s scholars have twice the chance',
    stage(b) {
      creed(b, 'Neutral');
      knowsHidden(b);
      const h = king(b, { skills: skilled({ sage: 3 }) });
      return { hero: h, orders: [one(h, order('research', 'any'))] };
    },
    check(o, { hero: h }) {
      return {
        got: { chance: firstRoll(o, h).chance, quoted: firstRoll(o, h).text.includes('(Sage level 3, Neutral ×2)') },
        want: { chance: 30, quoted: true },
      };
    },
  },
  {
    name: 'Research: Open Archives adds four in a hundred',
    stage(b) {
      creed(b, 'Neutral');
      knowsHidden(b);
      discovered(b, 'an06');
      const h = king(b, { skills: skilled({ sage: 3 }) });
      return { hero: h, orders: [one(h, order('research', 'any'))] };
    },
    check(o, { hero: h }) {
      return { got: { chance: firstRoll(o, h).chance }, want: { chance: 34 } };
    },
  },
  {
    name: 'Research: Lich Lore adds nine in a hundred in the realm’s own creed’s field',
    stage(b) {
      creed(b, 'Undead');
      knowsHidden(b);
      discovered(b, 'az10');
      const h = king(b, { skills: skilled({ sage: 3 }) });
      return { hero: h, orders: [one(h, order('research', 'Undead Creed'))] };
    },
    check(o, { hero: h }) {
      return {
        got: { chance: firstRoll(o, h).chance, field: firstRoll(o, h).text.startsWith('📊 Research (Undead Creed)') },
        want: { chance: 24, field: true },
      };
    },
  },
  {
    name: 'Research: Lich Lore adds nothing in another field',
    stage(b) {
      creed(b, 'Undead');
      knowsHidden(b);
      discovered(b, 'az10');
      const h = king(b, { skills: skilled({ sage: 3 }) });
      return { hero: h, orders: [one(h, order('research', 'Military'))] };
    },
    check(o, { hero: h }) {
      return { got: { chance: firstRoll(o, h).chance }, want: { chance: 15 } };
    },
  },
  {
    name: 'Research: the Heroic field can’t be named: the study is of every field',
    stage(b) {
      knowsHidden(b);
      const h = king(b, { skills: skilled({ sage: 3 }) });
      return { hero: h, orders: [one(h, order('research', 'Heroic'))] };
    },
    check(o, { hero: h }) {
      return {
        got: { unnamed: firstRoll(o, h).text.startsWith('📊 Research — Sage discovery roll: 15% chance') },
        want: { unnamed: true },
      };
    },
  },
  {
    name: 'Research: a field with nothing left turns to another that still has something, before the roll',
    stage(b) {
      knowsHidden(b);
      knows(b, (d) => d.category === 'Military');
      const h = king(b, { skills: skilled({ sage: 3 }) });
      return { hero: h, orders: [one(h, order('research', 'Military'))] };
    },
    check(o, { hero: h }) {
      const turned = /finds the Military archives already spent — .* — and turns instead to ([^.]+)\./.exec(
        text(o.lines),
      );
      const to = turned?.[1] ?? '';
      return {
        got: {
          turned: !!turned,
          to: to !== 'Military' && !HIDDEN_FIELDS.includes(to) && to !== '',
          rolledIn: firstRoll(o, h).text.startsWith(`📊 Research (${to})`),
        },
        want: { turned: true, to: true, rolledIn: true },
      };
    },
  },
  {
    name: 'Research: with every field spent, nothing is left to research, and there is no roll',
    stage(b) {
      knows(b, () => true);
      const h = king(b, { skills: skilled({ sage: 3 }) });
      return { hero: h, orders: [one(h, order('research', 'Military'))] };
    },
    check(o, { hero: h }) {
      return {
        got: { told: says(o, 'There is nothing left to research.'), rolled: rolls(o, h).length },
        want: { told: true, rolled: 0 },
      };
    },
  },
  {
    name: 'Research: the hidden fields are no field to turn to: with every other spent, nothing is left to research',
    stage(b) {
      knows(b, (d) => !HIDDEN_FIELDS.includes(d.category));
      const h = king(b, { skills: skilled({ sage: 3 }) });
      return { hero: h, orders: [one(h, order('research', 'Military'))], knew: knew(b) };
    },
    check(o, { hero: h, knew: k }) {
      return {
        got: {
          told: says(o, 'There is nothing left to research.'),
          rolled: rolls(o, h).length,
          learned: ids(o).length,
        },
        want: { told: true, rolled: 0, learned: k?.length },
      };
    },
  },
  {
    name: 'Research: with every discovery made, a roll that lands finds nothing new',
    stage(b) {
      knows(b, () => true);
      const h = king(b, { skills: skilled({ sage: 5 }) });
      return { hero: h, orders: [one(h, order('research', 'any'))], knew: knew(b) };
    },
    check(o, { hero: h, knew: k }) {
      const r = firstRoll(o, h);
      return {
        got: {
          rolled: rolls(o, h).length,
          told: says(o, r.landed ? 'the roll succeeded but all known discoveries' : 'makes no new discovery'),
          learned: ids(o).length,
          offered: choices(o).length,
        },
        want: { rolled: 1, told: true, learned: k?.length, offered: 0 },
      };
    },
  },
  {
    name: 'Research: a discovery offers two of the field to choose between next turn (keyed by the phase); a fruitless season says so',
    stage(b) {
      knowsHidden(b);
      const h = king(b, { skills: skilled({ sage: 5 }) });
      const pool = discoveries(b)
        .filter((d) => d.category === 'Military')
        .map((d) => d.id);
      return { hero: h, orders: [one(h, order('rest'), order('research', 'Military'))], knew: knew(b), pool };
    },
    check(o, { hero: h, knew: k, pool }) {
      const r = firstRoll(o, h);
      const offered = choices(o);
      const c = offered[0];
      return {
        got: {
          offered: offered.length,
          choice: c && { key: c.key, charId: c.charId, category: c.category, two: new Set(c.options).size },
          ofTheField: (c?.options ?? []).every((id) => (pool ?? []).includes(id)),
          told: says(o, r.landed ? 'research bears fruit — two discoveries come to light' : 'makes no new discovery'),
          learned: ids(o).length,
          streak: (char(o, h)['_researchFailStreak'] as { n: number } | undefined)?.n,
        },
        want: {
          offered: r.landed ? 1 : 0,
          choice: r.landed
            ? { key: `rc${String(o.turn)}_${String(h.id)}_1`, charId: h.id, category: 'Military', two: 2 }
            : undefined,
          ofTheField: true,
          told: true,
          learned: k?.length,
          streak: r.landed ? 0 : 1,
        },
      };
    },
  },
  {
    name: 'Research: a certain discovery (a Neutral Sage 5 who has failed five times this turn) is two to choose, keyed by the phase',
    stage(b) {
      creed(b, 'Neutral');
      knowsHidden(b);
      const h = king(b, { skills: skilled({ sage: 5 }) });
      h['_researchFailStreak'] = { turn: b.G.turn, n: 5 };
      return { hero: h, orders: [one(h, order('rest'), order('research', 'Military'))] };
    },
    check(o, { hero: h }) {
      const c = choices(o)[0];
      return {
        got: { chance: firstRoll(o, h).chance, key: c?.key, two: new Set(c?.options ?? []).size },
        want: { chance: 100, key: `rc${String(o.turn)}_${String(h.id)}_1`, two: 2 },
      };
    },
  },
  {
    name: 'Research: the last discovery a field holds is made outright, with nothing to choose',
    stage(b) {
      knowsHidden(b);
      const military = discoveries(b).filter((d) => d.category === 'Military');
      const last = must(military[military.length - 1], 'a Military discovery');
      knows(b, (d) => d.category === 'Military' && d.id !== last.id);
      const h = king(b, { skills: skilled({ sage: 5 }) });
      return { hero: h, orders: [one(h, order('research', 'Military'))], knew: knew(b) };
    },
    check(o, { hero: h, knew: k }) {
      const r = firstRoll(o, h);
      const military = ids(o).filter((id) => !(k ?? []).includes(id));
      return {
        got: {
          learned: military.length,
          told: says(
            o,
            r.landed ? 'the last discovery this field still holds for your realm' : 'makes no new discovery',
          ),
          offered: choices(o).length,
        },
        want: { learned: r.landed ? 1 : 0, told: true, offered: 0 },
      };
    },
  },
  {
    name: 'Research: Perseverance: each failure this turn makes the next ×1.2 likelier; a discovery starts it afresh',
    stage(b) {
      knowsHidden(b);
      const h = king(b, { skills: skilled({ sage: 5 }) });
      const r = order('research', 'any');
      return { hero: h, orders: [one(h, r, r, r, r, r)] };
    },
    check(o, { hero: h }) {
      const rs = rolls(o, h);
      let streak = 0;
      const expected = rs.map((r) => {
        const chance = Math.floor(25 * 1.2 ** streak + 1e-9);
        const why =
          streak > 0
            ? `×${(1.2 ** streak).toFixed(2)} for ${String(streak)} earlier failed Research${streak > 1 ? ' orders' : ''} this turn`
            : null;
        streak = r.landed ? 0 : streak + 1;
        return { chance, why };
      });
      return {
        got: {
          rolled: rs.length,
          chances: rs.map((r, i) => {
            const why = expected[i]?.why;
            return { chance: r.chance, why: why ? r.text.includes(why) : !r.text.includes('earlier failed Research') };
          }),
        },
        want: { rolled: 5, chances: expected.map((e) => ({ chance: e.chance, why: true })) },
      };
    },
  },
];

// ── Practice Skill ──────────────────────────────────────────────────────────────────────────────────────────────
/** `c`'s practice line for `skill` (its label), or ''. */
const practised = (o: Outcome, c: Character, label: string) => lineOf(o, c, new RegExp(`practises ${label}`));
/** The chance `c`'s practice line quotes, or NaN. */
const practiceChance = (o: Outcome, c: Character, label: string) =>
  Number((/(\d+)% \[roll/.exec(practised(o, c, label)) ?? [])[1]);
/** An Elven hero of realm 0 in the middle: a Human of a Human realm learns half as fast again (Quick Learners). */
const elf = (b: Board, skills: Record<string, number>, extra: Parameters<typeof at>[1] = {}) =>
  at(b, { race: 'Elven', skills: skilled(skills), ...extra });

export const PRACTICE_ORDER_CASES: ResearchAndPracticeOrderCase[] = [
  {
    name: 'Practice Skill: an order naming no skill does nothing, and the season leaves him where he was',
    wholeTurnOnly: true,
    stage(b) {
      const h = elf(b, { spy: 1 });
      return { hero: h, orders: [one(h, order('practice'))] };
    },
    check(o, { hero: h }) {
      const first = linesOf(o, h).filter((l) => l.phase === 0);
      return {
        got: { lines: first.map((l) => l.text), spy: char(o, h).skills['spy'] },
        want: { lines: [`${h.name} remains in ${String(h['locationName'])} this season.`], spy: 1 },
      };
    },
  },
  ...[0, 1, 2, 3, 4].map((level): ResearchAndPracticeOrderCase => ({
    name: `Practice Skill: alone at level ${String(level)}, the chance is ${String(25 - 5 * level)} in a hundred`,
    stage(b) {
      const h = elf(b, { spy: level });
      return { hero: h, orders: [one(h, order('practice', 'spy'))] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          chance: practiceChance(o, h, 'Spy'),
          why: practised(o, h, 'Spy').includes(`(base ${String(25 - 5 * level)}% at level ${String(level)})`),
        },
        want: { chance: 25 - 5 * level, why: true },
      };
    },
  })),
  {
    name: 'Practice Skill: a Human of a Human realm practises half as fast again; an Elf of the same realm doesn’t',
    stage(b) {
      const h = at(b, { skills: skilled({ spy: 3 }) });
      const e = elf(b, { spy: 3 }, { at: must(b.ring1[0], 'a neighbour') });
      return { hero: h, other: e, orders: [one(h, order('practice', 'spy')), one(e, order('practice', 'spy'))] };
    },
    check(o, { hero: h, other: e }) {
      const ee = must(e, 'the elf');
      return {
        got: {
          human: practiceChance(o, h, 'Spy'),
          why: practised(o, h, 'Spy').includes('×1.5 (Human: Quick Learners)'),
          elf: practiceChance(o, ee, 'Spy'),
          elfWhy: practised(o, ee, 'Spy').includes('Quick Learners'),
        },
        want: { human: 15, why: true, elf: 10, elfWhy: false },
      };
    },
  },
  {
    name: 'Practice Skill: a Human of another folk’s realm has no Quick Learners',
    stage(b) {
      creed(b, 'Divine', 0, 'Elven');
      const h = at(b, { skills: skilled({ spy: 3 }) });
      return { hero: h, orders: [one(h, order('practice', 'spy'))] };
    },
    check(o, { hero: h }) {
      return { got: { chance: practiceChance(o, h, 'Spy') }, want: { chance: 10 } };
    },
  },
  {
    name: 'Practice Skill: beside a comrade better at it, at the same drill that phase, the rise is certain, and the comrade’s line names his pupil',
    stage(b) {
      const h = elf(b, { spy: 1 });
      const m = elf(b, { spy: 3 });
      return {
        hero: h,
        other: m,
        orders: [
          one(h, order('rest'), order('rest'), order('practice', 'spy')),
          one(m, order('rest'), order('rest'), order('practice', 'spy')),
        ],
      };
    },
    check(o, { hero: h, other: m }) {
      const mm = must(m, 'the mentor');
      return {
        got: {
          spy: char(o, h).skills['spy'],
          told: practised(o, h, 'Spy').endsWith(
            `improves to level 2! — trained by ${mm.name} (Spy 3), a more skilled mentor`,
          ),
          pupil: practised(o, mm, 'Spy').includes(`trains ${h.name} (Spy 1) in Spy`),
        },
        want: { spy: 2, told: true, pupil: true },
      };
    },
  },
  {
    name: 'Practice Skill: a master at 5 still teaches, though he no longer rises himself',
    stage(b) {
      const h = elf(b, { spy: 3 });
      const m = elf(b, { spy: 5 });
      return { hero: h, other: m, orders: [one(h, order('practice', 'spy')), one(m, order('practice', 'spy'))] };
    },
    check(o, { hero: h, other: m }) {
      const mm = must(m, 'the master');
      return {
        got: { spy: char(o, h).skills['spy'], master: char(o, mm).skills['spy'] },
        want: { spy: 4, master: 5 },
      };
    },
  },
  {
    name: 'Practice Skill: a better hero of an allied realm, or of the realm but practising elsewhere, teaches nothing',
    stage(b) {
      const h = elf(b, { spy: 1 });
      const ally = hero(b, { player: 2, at: b.X, skills: skilled({ spy: 4 }) });
      const away = elf(b, { spy: 4 }, { at: must(b.ring1[0], 'a neighbour') });
      return {
        hero: h,
        other: ally,
        orders: [
          one(h, order('practice', 'spy')),
          one(ally, order('practice', 'spy')),
          one(away, order('practice', 'spy')),
        ],
      };
    },
    check(o, { hero: h }) {
      return {
        got: { chance: practiceChance(o, h, 'Spy'), mentor: practised(o, h, 'Spy').includes('trained by') },
        want: { chance: 20, mentor: false },
      };
    },
  },
  {
    name: 'Practice Skill: a comrade of the realm practising another skill is no mentor',
    stage(b) {
      const h = elf(b, { spy: 1, thief: 0 });
      const m = elf(b, { spy: 4, thief: 0 });
      return { hero: h, other: m, orders: [one(h, order('practice', 'spy')), one(m, order('practice', 'thief'))] };
    },
    check(o, { hero: h }) {
      return { got: { chance: practiceChance(o, h, 'Spy') }, want: { chance: 20 } };
    },
  },
  {
    name: 'Practice Skill: beside comrades of the same level, half as likely again, and the line names them',
    stage(b) {
      const h = elf(b, { spy: 1 });
      const p = elf(b, { spy: 1 });
      return { hero: h, other: p, orders: [one(h, order('practice', 'spy')), one(p, order('practice', 'spy'))] };
    },
    check(o, { hero: h, other: p }) {
      const pp = must(p, 'the peer');
      return {
        got: {
          chance: practiceChance(o, h, 'Spy'),
          why: practised(o, h, 'Spy').includes(
            `practising alongside ${pp.name} (base 20% at level 1, +50% group bonus)`,
          ),
          peer: practiceChance(o, pp, 'Spy'),
        },
        want: { chance: 30, why: true, peer: 30 },
      };
    },
  },
  {
    name: 'Practice Skill: a skill at 5 is trained as far as drilling takes it',
    stage(b) {
      const h = elf(b, { spy: 5 });
      return { hero: h, orders: [one(h, order('practice', 'spy'))] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          told: says(o, `${h.name} has trained Spy as far as drilling can take them (level 5).`),
          rolled: says(o, '[roll'),
          spy: char(o, h).skills['spy'],
        },
        want: { told: true, rolled: false, spy: 5 },
      };
    },
  },
  {
    name: 'Practice Skill: a discovery for the skill adds to the chance (Tradecraft Manuals, thirty for Spy)',
    stage(b) {
      discovered(b, 'sd61');
      const h = elf(b, { spy: 3 });
      return { hero: h, orders: [one(h, order('practice', 'spy'))] };
    },
    check(o, { hero: h }) {
      return { got: { chance: practiceChance(o, h, 'Spy') }, want: { chance: 40 } };
    },
  },
  {
    name: 'Practice Skill: Astronomical Tables adds three for any skill; a discovery for other skills adds nothing',
    stage(b) {
      discovered(b, 'sd26');
      discovered(b, 'sd70');
      const h = elf(b, { spy: 3 });
      return { hero: h, orders: [one(h, order('practice', 'spy'))] };
    },
    check(o, { hero: h }) {
      return { got: { chance: practiceChance(o, h, 'Spy') }, want: { chance: 13 } };
    },
  },
  {
    name: 'Practice Skill: a rise that makes a hired hero more skilled raises his wage, and he is told',
    stage(b) {
      const h = elf(b, { melee: 2, tactical: 2, march: 1, spy: 3 });
      h['pay'] = 2;
      const m = elf(b, { spy: 5 });
      return { hero: h, other: m, orders: [one(h, order('practice', 'spy')), one(m, order('practice', 'spy'))] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          pay: char(o, h)['pay'],
          told: says(o, `💰 ${h.name}'s growing renown raises their wage to 3g/turn (was 2g/turn).`),
        },
        want: { pay: 3, told: true },
      };
    },
  },
  {
    name: 'Practice Skill: Tactical drills the companies he leads, and Elite ones are already at the top',
    stage(b) {
      const h = elf(b, { tactical: 3 });
      h.armies = companies(3, 'Men-at-Arms', 'Elite');
      return { hero: h, orders: [one(h, order('practice', 'tactical'))] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          told: says(o, `${h.name}'s training drills were thorough but no units achieved a breakthrough this season.`),
          grades: char(o, h).armies.map((a) => a.quality),
        },
        want: { told: true, grades: ['Elite', 'Elite', 'Elite'] },
      };
    },
  },
  {
    name: 'Practice Skill: Tactical with no companies to lead is theory alone',
    stage(b) {
      const h = elf(b, { tactical: 3 });
      return { hero: h, orders: [one(h, order('practice', 'tactical'))] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          told: says(o, `${h.name} practises Tactical theory alone — leading land armies would yield greater benefit.`),
        },
        want: { told: true },
      };
    },
  },
  {
    name: 'Practice Skill: Naval drills only fleets, so land companies leave it theory alone',
    stage(b) {
      const h = elf(b, { naval: 3 });
      h.armies = companies(2);
      return { hero: h, orders: [one(h, order('practice', 'naval'))] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          told: says(
            o,
            `${h.name} drills Naval theory alone — commanding fleets or sea-beasts would yield greater benefit.`,
          ),
          grades: char(o, h).armies.map((a) => a.quality),
        },
        want: { told: true, grades: ['Average', 'Average'] },
      };
    },
  },
  {
    name: 'Practice Skill: a Tactical 5 general rises no further, but still drills his troops',
    stage(b) {
      const h = elf(b, { tactical: 5 });
      h.armies = companies(2, 'Men-at-Arms', 'Elite');
      return { hero: h, orders: [one(h, order('practice', 'tactical'))] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          maxed: says(o, `${h.name} has trained Tactical as far as drilling can take them (level 5).`),
          drilled: says(o, 'training drills were thorough but no units achieved a breakthrough'),
        },
        want: { maxed: true, drilled: true },
      };
    },
  },
];

// ── Rest ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The HP the hero's first Rest line says he recovered, and what it says he stands at. */
const rested = (o: Outcome) => {
  const m = /rests and recovers\. \+(\d+) HP \((\d+)\/(\d+)/.exec(text(o.lines));
  return m ? { healed: Number(m[1]), hp: `${String(m[2])}/${String(m[3])}` } : null;
};
/** A wounded king of realm 0 (20 HP at most, 5 left) resting once, in the middle. */
const resting = (b: Board, extra: Parameters<typeof at>[1] = {}): Staged => {
  const h = king(b, { wounded: 5, ...extra });
  return { hero: h, orders: [one(h, order('rest'), order('practice', 'march'))] };
};

export const REST_ORDER_CASES: ResearchAndPracticeOrderCase[] = [
  {
    name: 'Rest: three tenths of his maximum HP back, rounded up, for a realm of no blessing',
    stage(b) {
      creed(b, 'Good');
      return resting(b, { hp: 21 });
    },
    check(o) {
      return { got: { rest: rested(o) }, want: { rest: { healed: 7, hp: '12/21' } } };
    },
  },
  {
    name: 'Rest: a Divine realm’s heroes heal half as much again, rounded up, and the line says why',
    stage(b) {
      return resting(b);
    },
    check(o) {
      return {
        got: { rest: rested(o), why: says(o, ' — Divine blessing lifts healing by half).') },
        want: { rest: { healed: 9, hp: '14/20' }, why: true },
      };
    },
  },
  {
    name: 'Rest: never past his maximum',
    stage(b) {
      creed(b, 'Good');
      return resting(b, { wounded: 18 });
    },
    check(o) {
      return { got: { rest: rested(o) }, want: { rest: { healed: 6, hp: '20/20' } } };
    },
  },
  {
    name: 'Rest: Medical Arts restores him to full, blessing or none',
    stage(b) {
      discovered(b, 'sd28');
      return resting(b, { wounded: 3 });
    },
    check(o) {
      return { got: { rest: rested(o) }, want: { rest: { healed: 17, hp: '20/20' } } };
    },
  },
  {
    name: 'Rest: Healing Hands adds five on top of the Divine rest',
    stage(b) {
      discovered(b, 'ad06');
      return resting(b);
    },
    check(o) {
      return { got: { rest: rested(o) }, want: { rest: { healed: 14, hp: '19/20' } } };
    },
  },
  {
    name: 'Rest: the Healers’ Guild adds six in a province the realm holds',
    stage(b) {
      creed(b, 'Good');
      discovered(b, 'ag06');
      b.own(b.X, 0);
      return resting(b, { wounded: 2 });
    },
    check(o) {
      return { got: { rest: rested(o) }, want: { rest: { healed: 12, hp: '14/20' } } };
    },
  },
  {
    name: 'Rest: the Healers’ Guild adds nothing on ground the realm doesn’t hold',
    stage(b) {
      creed(b, 'Good');
      discovered(b, 'ag06');
      return resting(b, { wounded: 2 });
    },
    check(o) {
      return { got: { rest: rested(o) }, want: { rest: { healed: 6, hp: '8/20' } } };
    },
  },
  {
    name: 'Rest: Herbcraft adds six in forest',
    stage(b) {
      creed(b, 'Druidic');
      discovered(b, 'au07');
      b.X.terrain = 'forest';
      return resting(b, { wounded: 2 });
    },
    check(o) {
      return { got: { rest: rested(o) }, want: { rest: { healed: 12, hp: '14/20' } } };
    },
  },
  {
    name: 'Rest: Herbcraft adds nothing on the plain',
    stage(b) {
      creed(b, 'Druidic');
      discovered(b, 'au07');
      return resting(b, { wounded: 2 });
    },
    check(o) {
      return { got: { rest: rested(o) }, want: { rest: { healed: 6, hp: '8/20' } } };
    },
  },
  {
    name: 'Rest: Longhouse Feasts adds six in the realm’s own capital',
    stage(b) {
      creed(b, 'Pagan');
      discovered(b, 'ap20');
      b.own(b.X, 0);
      realm(b)['homeProvinceId'] = b.X.id;
      return resting(b, { wounded: 2 });
    },
    check(o) {
      return { got: { rest: rested(o) }, want: { rest: { healed: 12, hp: '14/20' } } };
    },
  },
  {
    name: 'Rest: Longhouse Feasts adds nothing in a province the realm holds that isn’t its capital',
    stage(b) {
      creed(b, 'Pagan');
      discovered(b, 'ap20');
      b.own(b.X, 0);
      return resting(b, { wounded: 2 });
    },
    check(o) {
      return { got: { rest: rested(o) }, want: { rest: { healed: 6, hp: '8/20' } } };
    },
  },
];

// ── Research Breakthrough ───────────────────────────────────────────────────────────────────────────────────────
const sage7 = (b: Board) => king(b, { skills: skilled({ sage: 7 }) });

export const RESEARCH_BREAKTHROUGH_ORDER_CASES: ResearchAndPracticeOrderCase[] = [
  {
    name: 'Research Breakthrough: refused without the Sage mastery (7)',
    stage(b) {
      const h = king(b, { skills: skilled({ sage: 6 }) });
      return { hero: h, orders: [one(h, order('research_breakthrough'))], knew: knew(b) };
    },
    check(o, { knew: k }) {
      return {
        got: { told: says(o, 'lacks the Sage mastery (7) for a Research Breakthrough.'), learned: ids(o).length },
        want: { told: true, learned: k?.length },
      };
    },
  },
  {
    name: 'Research Breakthrough: one discovery the realm may study, made outright, with no roll',
    stage(b) {
      const h = sage7(b);
      return { hero: h, orders: [one(h, order('research_breakthrough'))], knew: knew(b) };
    },
    check(o, { knew: k }) {
      const fresh = ids(o).filter((id) => !(k ?? []).includes(id));
      const made = /drives a Research Breakthrough — \*\*([^*]+)\*\* \(([^)]+)\) discovered!/.exec(text(o.lines));
      return {
        got: { fresh: fresh.length, told: !!made, rolled: says(o, '[roll') || says(o, '📊') },
        want: { fresh: 1, told: true, rolled: false },
      };
    },
  },
  {
    name: 'Research Breakthrough: the hidden fields may yield to it too',
    stage(b) {
      const heroic = must(
        discoveries(b).find((d) => d.category === 'Heroic'),
        'a Heroic discovery',
      );
      knows(b, (d) => d.id !== heroic.id);
      const h = sage7(b);
      return { hero: h, orders: [one(h, order('research_breakthrough'))], knew: [heroic.id] };
    },
    check(o, { knew: k }) {
      return { got: { made: ids(o).includes(must(k?.[0], 'the Heroic id')) }, want: { made: true } };
    },
  },
  {
    name: 'Research Breakthrough: with every discovery made, the scholars are told so',
    stage(b) {
      knows(b, () => true);
      const h = sage7(b);
      return { hero: h, orders: [one(h, order('research_breakthrough'))], knew: knew(b) };
    },
    check(o, { knew: k }) {
      return {
        got: {
          told: says(
            o,
            'Research Breakthrough succeeds, but your scholars have already unlocked every known discovery.',
          ),
          learned: ids(o).length,
        },
        want: { told: true, learned: k?.length },
      };
    },
  },
  {
    name: 'Research Breakthrough is a mastery: once a turn, and a second is refused',
    wholeTurnOnly: true,
    stage(b) {
      const h = sage7(b);
      return {
        hero: h,
        orders: [one(h, order('research_breakthrough'), order('research_breakthrough'))],
        knew: knew(b),
      };
    },
    check(o, { knew: k }) {
      return {
        got: { learned: ids(o).length - (k?.length ?? 0), refused: says(o, 'mastery this turn') },
        want: { learned: 1, refused: true },
      };
    },
  },
];

/** Stages `c` on `b`, from plain realms. */
export const stageCase = (b: Board, c: ResearchAndPracticeOrderCase): Staged => {
  plainRealms(b);
  return c.stage(b);
};

/** Every case, by order. */
export const RESEARCH_AND_PRACTICE_ORDER_CASES: [string, ResearchAndPracticeOrderCase[]][] = [
  ['research', RESEARCH_ORDER_CASES],
  ['practice', PRACTICE_ORDER_CASES],
  ['rest', REST_ORDER_CASES],
  ['research_breakthrough', RESEARCH_BREAKTHROUGH_ORDER_CASES],
];
