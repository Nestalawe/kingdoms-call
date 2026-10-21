// The player portal's copies of the engine's rules, and the engine's functions they restate (plan P1-11a, Decisions 5
// and 6): the pairs, and the values they are compared on. tests/unit/the-player-portals-copies-agree-with-the-engine.test.ts
// checks them.
//
// The player page loads no engine file: where it needs a rule of a hero, an army, an item or a number, it keeps its own
// copy (`floorNumP`, `unitBaseStrengthP`, …). P1-11a swaps each copy that agrees with the engine's function for that
// function. Before that, this file says whether they agree, two ways (Decision 6):
//   swap   the copy and the engine's function on the same value: the one the portal is handed. It decides whether
//          the copy can go.
//   truth  the copy on the report's value, the engine's function on the state's value the report made it from. It says
//          whether the portal tells the player what the turn will do. None where the portal is handed the very value
//          the engine reads (a number, a level, an alignment, a games row): there it is the swap.
//
// The copies are read from src/ui/player/ by their syntax tree (tests/lib/source.ts) and run in a context of their
// own, with the data file run beside them as a script: the content as the player page holds it, before the engine
// rewrites the item catalogue's tiers as it loads. The player page's modules can't be imported here: they start the
// page (its database client) as they load. The engine's functions are imported directly, with no vm (P1-11a1).
//
// The values (Decision 5): the balance matrix's game scripted-05 played with the engine's modules imported directly,
// its scripted realm's report after every turn and the state it was built from; and a staged world in the engine's
// shape handed through the report's own projection (buildTurnReport): every catalogue item, held by a hero of every
// race and alignment; every unit type at every quality, with the flags the engine and the report use; columns made of
// every kind of unit, led by heroes with and without the naval mastery that doubles a hull. Then every alignment pair,
// every level from -1 to 10, a set of games rows, and every number the reports hold, with fractions.
import vm from 'node:vm';
import {
  ALL_MAGIC_ITEMS_P,
  KC_ALIGNMENTS,
  KC_CARRIER_BERTHS,
  KC_ITEM_RACE_ALIAS,
  KC_MAGIC_SCHOOLS,
  KC_QUALITY_TIERS,
  KC_UNIT_CLASS,
  KC_UNIT_TYPE,
  LEGENDARY_ITEMS_P,
} from '../../src/content/kingdoms-call-data.ts';
import { SKILL_LABELS } from '../../src/engine/army-tables.ts';
import { getSeaCapability } from '../../src/engine/units/sea-lift-stranding-and-retreats.ts';
import { gameMetaOf } from '../../src/engine/rules-on-plain-values/a-games-settings-read-from-its-row.ts';
import { dispFloor } from '../../src/engine/rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import {
  isLegendaryItem,
  itemRaceOf,
  itemSlot,
  itemUsableBy,
} from '../../src/engine/rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';
import { MITHRIL_ARMOUR } from '../../src/engine/heroes/fame-and-consecration.ts';
import {
  skillFameLabelM,
  topSkillOf,
} from '../../src/engine/rules-on-plain-values/skills-in-order-and-a-heros-fame-in-words.ts';
import { unitBaseStrength, unitTypeOf } from '../../src/engine/rules-on-plain-values/unit-types-and-base-strength.ts';
import {
  getFlyCapability,
  isAirCarriable,
} from '../../src/engine/rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { beastCommandCount } from '../../src/engine/world/tables.ts';
import {
  alignDistP,
  heroHireWage,
} from '../../src/engine/rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import {
  actionSpellsAllowedPerSchoolEachTurn,
  combatSpellsAllowedPerSchoolEachFight,
} from '../../src/engine/rules-on-plain-values/spells-each-school-allows-a-turn-and-a-fight.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { resolveTurn } from '../../src/engine/run-turn.ts';
import { kcRng } from '../../src/engine/rng.ts';
import { buildTurnReport } from '../../src/views/turn-report.ts';
import { MAP_SIZES, MAX_TURNS, SCRIPTED_REALM } from '../../tools/balance/matrix.ts';
import { GAME, SETUPS, slotRowsJson } from './matrix-game.ts';
import { scriptOf, sourceOf, type SourceOptions } from './source.ts';

/** A value as the JSON of a save or a report holds it. */
export type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const objects = (x: unknown): Obj[] => (Array.isArray(x) ? x.filter(isObj) : []);
const copyOf = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const SCHOOLS: string[] = KC_MAGIC_SCHOOLS;

// ── The copies ────

/** The copies (and the tables they read) by file, as the player portal declares them. */
const COPIES: Record<string, string[]> = {
  'ui/player/items-and-heroes.ts': [
    'ITEM_SLOT_OF_P',
    'isLegendaryItemP',
    'itemSlotP',
    '_ITEM_RACE_ALIAS_P',
    'itemRaceOfP',
    'itemUsableByP',
  ],
  'ui/player/order-chances.ts': [
    'ITEM_UNCAPPED_SKILLS_P',
    'effMagicLvl',
    'actionSpellLimit',
    'combatSpellLimit',
    'ALL_SKILLS',
    'floorNumP',
    'UNIT_BASE_STR_P',
    'unitTypeOfP',
    'UNIT_Q_MULT_P',
    'unitBaseStrengthP',
  ],
  'ui/player/skills-and-projections.ts': ['ALIGN_SPECTRUM_PP', 'alignDistPP', 'heroHireWagePP'],
  'ui/player/map-symbols.ts': ['beastCommandCountP', 'heroFameTextP', 'skillFameLabel'],
  'ui/player/game-lists.ts': ['gameMetaP'],
  'ui/player/move-analysis.ts': [
    'PO_SEA_TYPES',
    'PO_CARRIER_TYPES',
    'PO_AERIAL_TYPES',
    'PO_FLYING_TYPES',
    'PO_CAVALRY_TYPES',
    'PO_CREATURE_TYPES',
    'PO_MONSTER_TYPES',
    'PO_LIGHT_TYPES',
    'poAirCarriable',
    'poFlyCapability',
    'poSeaAnalysis',
    'SKILL_LABELS',
  ],
};
/** The functions among them that the pairs call. */
const COPY_FUNCTIONS = [
  'floorNumP',
  'unitTypeOfP',
  'unitBaseStrengthP',
  'isLegendaryItemP',
  'itemSlotP',
  'itemRaceOfP',
  'itemUsableByP',
  'alignDistPP',
  'heroHireWagePP',
  'gameMetaP',
  'skillFameLabel',
  'heroFameTextP',
  'poAirCarriable',
  'poFlyCapability',
  'actionSpellLimit',
  'combatSpellLimit',
  'beastCommandCountP',
  'poSeaAnalysis',
  'effMagicLvl',
] as const;
export type CopyName = (typeof COPY_FUNCTIONS)[number];
export type Copies = Record<CopyName, (...args: unknown[]) => unknown>;

/** The player portal's copies, read from `src` (default: this checkout's src/), run with the data file beside them. */
export function playerPortalCopies(opts: SourceOptions = {}): Copies {
  const code = [
    scriptOf('content/kingdoms-call-data.ts', opts),
    ...Object.entries(COPIES).map(([file, names]) => sourceOf(file, names, opts)),
  ].join('\n');
  const made: unknown = vm.runInNewContext(`(() => {\n${code}\nreturn { ${COPY_FUNCTIONS.join(', ')} };\n})()`);
  if (!isObj(made)) throw new Error('the copies did not load');
  for (const name of COPY_FUNCTIONS)
    if (typeof made[name] !== 'function') throw new Error(`the player portal has no function ${name}`);
  return made as Copies;
}

// ── The values ────

/** A value the report hands the portal, and the value in the state the report made it from (null: none here). */
export interface Projected {
  readonly report: Obj;
  readonly state: Obj | null;
}
export interface Samples {
  /** Every number the reports hold, and fractions of it. */
  readonly numbers: number[];
  /** Every level a skill can be at, and past both ends; and none. */
  readonly levels: unknown[];
  /** Every pair of alignments, an unknown one and none included. */
  readonly alignmentPairs: [unknown, unknown][];
  /** Games rows as the database hands them (meta: JSON text, an object, missing, broken). */
  readonly gameRows: unknown[];
  /** Every unit type: the content's, the reports', and two the tables don't know. */
  readonly unitTypes: string[];
  /** Every unit in the reports (a hero's, a garrison's, …); a hero's with the state's unit. */
  readonly armies: Projected[];
  /** Every item in the reports; a hero's with the state's item and both its holders. */
  readonly items: (Projected & { readonly holder: Projected | null })[];
  /** Every one of the realm's heroes in the reports, with the state's hero. */
  readonly heroes: Projected[];
  /** The skills of every hero in the reports, and staged ties, as a hero without the report's top skill. */
  readonly skillSets: Obj[];
  /** How many reports the values come from: the game's, and the staged world's. */
  readonly reports: number;
}

/** Each turn of the matrix's game scripted-05, played with the engine's modules imported directly: the state after
 *  the turn (as saved) and the scripted realm's report, built from it. */
export function scripted05(): { state: Obj; report: Obj }[] {
  kcRng.seed(GAME.seed);
  const g = generateNewGame(copyOf(SETUPS), copyOf(MAP_SIZES[GAME.realms]), 0, { seaPct: GAME.seaPct }) as Obj;
  g['turnMode'] = { mode: 'manual', time: '20:00', everyDays: 1, nextDeadlineAt: null, turnRanAt: null };
  g['botDifficulty'] = 'hard';
  g['botDiplomacy'] = GAME.diplomacy;
  let state = JSON.stringify(g);
  const turns: { state: Obj; report: Obj }[] = [];
  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    if ((JSON.parse(state) as Obj)['gameOver']) break;
    const result = resolveTurn(
      state,
      JSON.parse(slotRowsJson(state, turn)),
      turn,
      Math.floor(kcRng() * 2 ** 32) || 1,
    ) as {
      state: string;
      buildReports: () => { reports: { gp: Obj; report: Obj }[] };
    };
    const ours = result.buildReports().reports.find((r) => r.gp['player_index'] === SCRIPTED_REALM);
    if (!ours) throw new Error(`turn ${String(turn)}: no report for the scripted realm`);
    state = result.state;
    turns.push({ state: JSON.parse(state) as Obj, report: ours.report });
  }
  return turns;
}

/** The catalogue as the engine holds it once loaded (it re-tiers the data file's lists in place, and adds the
 *  alternates): every lair item, every legendary relic, and Mithril Armour. */
const catalogue = (): Obj[] => [...objects(ALL_MAGIC_ITEMS_P), ...objects(LEGENDARY_ITEMS_P), copyOf(MITHRIL_ARMOUR)];

/** One type of each kind of unit a column can hold, for the staged columns. */
function oneOfEachKind(): string[] {
  const classes: Record<string, string[]> = KC_UNIT_CLASS;
  const kinds = ['flying', 'aerial', 'carrier', 'sea', 'cavalry', 'lightFoot', 'creature', 'monster'];
  const chosen: string[] = [];
  for (const kind of kinds) {
    const t = (classes[kind] ?? []).find((x) => !chosen.includes(x));
    if (t) chosen.push(t);
  }
  const berths = Object.keys(KC_CARRIER_BERTHS).find((t) => !chosen.includes(t));
  if (berths) chosen.push(berths); // a carrier with more than one berth
  const classed = new Set(kinds.flatMap((k) => classes[k] ?? []));
  const foot = Object.keys(KC_UNIT_TYPE).find((t) => !classed.has(t));
  if (foot) chosen.push(foot); // heavy foot: in none of those classes
  return chosen;
}

/** Every column of 1 to 3 units of those kinds (each kind as often as the size allows). No unit in it is a phantom: a
 *  spectral double joins a column only for a battle (engine/world/map-helpers.ts) and is gone before the turn is saved,
 *  so no report is made from one. */
function stagedColumns(): Obj[][] {
  const kinds = oneOfEachKind();
  const columns: Obj[][] = [];
  const grow = (from: number, column: string[]) => {
    if (column.length)
      columns.push(column.map((type, i) => ({ type, quality: 'Average', unitName: `${type} ${String(i)}` })));
    if (column.length === 3) return;
    for (let k = from; k < kinds.length; k++) grow(k, [...column, kinds[k] ?? '']);
  };
  grow(0, []);
  return columns;
}

/** A world in the engine's shape, staged, and realm 0's report on it: the values the game doesn't reach. */
export function stagedWorld(): { state: Obj; report: Obj } {
  kcRng.seed(7);
  const setups = [0, 1, 2].map((i) => ({
    id: i,
    gamePlayerId: 'gp' + String(i),
    isBot: i > 0,
    name: 'Realm' + String(i),
    kingName: 'King' + String(i),
    kingdomName: 'Realm' + String(i),
    race: ['Human', 'Elven', 'Orcish'][i],
    alignment: ['Good', 'Druidic', 'Evil'][i],
    temper: 'Brave',
    skills: { melee: 1 },
  }));
  const g = generateNewGame(setups, copyOf(MAP_SIZES[3]), 0, { seaPct: 20 }) as Obj;
  const characters = objects(g['characters']);
  const king = characters.find((c) => c['player'] === 0 && c['isKing']);
  if (!king) throw new Error('the staged world has no king for realm 0');
  // Three provinces of the world: the king's, and two others. Each group of staged heroes stands in its own, so the
  // Crown of Command's aura (it lifts every skill of the bearer's realm's heroes in his province) reaches only the
  // heroes staged for it, and the report doesn't look through the catalogue's items for every hero it shows.
  const land = objects(isObj(g['world']) ? g['world']['provinces'] : [])
    .filter((p) => p['terrain'] !== 'sea' && p['id'] !== king['location'])
    .map((p) => p['id']);
  const [elsewhere, third] = land;
  if (elsewhere === undefined || third === undefined) throw new Error('the staged world has too few land provinces');
  let id = 10_000;
  const hero = (fields: Obj): Obj => {
    const h = {
      ...copyOf(king),
      isKing: false,
      items: [],
      armies: [],
      skills: { melee: 1 },
      ...fields,
      id: id++,
      name: `Staged ${String(id)}`,
    };
    characters.push(h);
    return h;
  };
  let itemId = 50_000;
  const item = (it: Obj): Obj => ({ ...copyOf(it), id: itemId++ });
  // The king holds the whole catalogue, and every unit type at every quality, plain and with each flag the engine and
  // the report read (no phantom: see stagedColumns).
  king['items'] = catalogue().map(item);
  const flags: Obj[] = [{}, { _isSkeletal: true }, { _temporary: true }, { _wildHuntUntilTurn: 3 }];
  king['armies'] = Object.keys(KC_UNIT_TYPE).flatMap((type) =>
    KC_QUALITY_TIERS.flatMap((quality) => flags.map((f) => ({ type, quality, unitName: type, ...f }))),
  );
  // A hero of every race and alignment holds every item bound to a race or an alignment, and each race-bound item as
  // an older save holds it, tagged with an old name of the race ('Elf', 'Dwarves', …: the data file's
  // KC_ITEM_RACE_ALIAS, which both read).
  const aliases: Record<string, string> = KC_ITEM_RACE_ALIAS;
  const bound = catalogue().filter((it) => it['race'] || it['alignment']);
  const oldNames = Object.entries(aliases).flatMap(([old, race]) =>
    bound.filter((it) => it['race'] === race).map((it) => ({ ...it, race: old })),
  );
  bound.push(...oldNames);
  for (const race of ['Human', 'Elven', 'Dwarven', 'Orcish'])
    for (const alignment of KC_ALIGNMENTS) hero({ race, alignment, items: bound.map(item) });
  // A hero leads each staged column, without and with the naval mastery that doubles a hull (Naval 8), elsewhere.
  for (const armies of stagedColumns())
    for (const naval of [0, 8]) hero({ location: elsewhere, armies: copyOf(armies), skills: { melee: 1, naval } });
  // In a third province, a hero wearing the Crown of Command beside a hero of every magic school at level 2: the
  // aura the report's effective levels count and effMagicLvl doesn't (STATUS, Parked: the Warlock's extra cast).
  const crown = catalogue().find((it) => isObj(it['effect']) && it['effect']['stat'] === 'aura');
  if (!crown) throw new Error('the catalogue has no item with an aura');
  hero({ location: third, items: [item(crown)] });
  hero({ location: third, skills: Object.fromEntries(SCHOOLS.map((school) => [school, 2])) });
  g['characters'] = characters;
  const state = copyOf(g);
  const report: Obj = buildTurnReport(g, 0);
  return { state, report };
}

/** Every number `x` holds, at any depth. */
function numbersIn(x: unknown, into: Set<number>): void {
  if (typeof x === 'number') into.add(x);
  else if (Array.isArray(x)) for (const v of x) numbersIn(v, into);
  else if (isObj(x)) for (const v of Object.values(x)) numbersIn(v, into);
}
/** Every object `x` holds, at any depth, that `is` picks. */
function objectsIn(x: unknown, is: (o: Obj) => boolean, into: Obj[] = []): Obj[] {
  if (Array.isArray(x)) for (const v of x) objectsIn(v, is, into);
  else if (isObj(x)) {
    if (is(x)) into.push(x);
    for (const v of Object.values(x)) objectsIn(v, is, into);
  }
  return into;
}
const isArmy = (o: Obj) => typeof o['type'] === 'string' && 'quality' in o;
const isItem = (o: Obj) => typeof o['name'] === 'string' && isObj(o['effect']);

/** `fn`, with the engine's echo of the GM's log to console.log (engine/turn/context.ts) quiet. */
function quietly<T>(fn: () => T): T {
  const was = console.log;
  console.log = () => undefined;
  try {
    return fn();
  } finally {
    console.log = was;
  }
}

let made: Samples | null = null;
/** The values the pairs are compared on (made once in a process: the game takes about a second). */
export function samples(): Samples {
  if (made) return made;
  const pairs = quietly(() => [...scripted05(), stagedWorld()]);
  const numbers = new Set<number>();
  const armies: Projected[] = [];
  const items: (Projected & { holder: Projected | null })[] = [];
  const heroes: Projected[] = [];
  for (const { state, report } of pairs) {
    numbersIn(report, numbers);
    const stateHeroes = new Map(objects(state['characters']).map((c) => [c['id'], c]));
    const own = objects(report['characters']);
    const ownArmies = new Set<Obj>();
    const ownItems = new Set<Obj>();
    for (const c of own) {
      const sc = stateHeroes.get(c['id']) ?? null;
      const holder = { report: c, state: sc };
      heroes.push(holder);
      objects(c['armies']).forEach((a, i) => {
        ownArmies.add(a);
        armies.push({ report: a, state: sc ? (objects(sc['armies'])[i] ?? null) : null });
      });
      objects(c['items']).forEach((it, i) => {
        ownItems.add(it);
        items.push({ report: it, state: sc ? (objects(sc['items'])[i] ?? null) : null, holder });
      });
    }
    // The rest the report shows: garrisons, other realms' columns, lair hoards, the market, …
    for (const a of objectsIn(report, isArmy)) if (!ownArmies.has(a)) armies.push({ report: a, state: null });
    for (const it of objectsIn(report, isItem))
      if (!ownItems.has(it)) items.push({ report: it, state: null, holder: null });
  }
  for (const n of [...numbers]) for (const m of [n + 0.5, n * 0.29, n / 7, -n - 0.5, n - 1e-12]) numbers.add(m);
  const alignments: unknown[] = [...KC_ALIGNMENTS, 'Nonsense', undefined];
  const unitTypes = [
    ...new Set([...Object.keys(KC_UNIT_TYPE), ...armies.map((a) => String(a.report['type'])), 'Unknown Thing', '']),
  ];
  const skillSets: Obj[] = [
    ...heroes.map((h) => ({ skills: h.report['skills'] })),
    {},
    { skills: {} },
    { skills: { melee: 3, tactical: 3 } },
    { skills: { tactical: 3, melee: 3 } },
    { skills: { white: 0, spy: 2, thief: 2, sage: 2 } },
    { skills: { druid: 9 } },
    { skills: { necromancy: 7, white: 7, melee: 4 } },
  ];
  made = {
    numbers: [...numbers],
    levels: [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 2.5, undefined, null],
    alignmentPairs: alignments.flatMap((a) => alignments.map((b): [unknown, unknown] => [a, b])),
    gameRows: [
      null,
      {},
      { meta: null },
      { meta: '{"v":1,"botCount":2}' },
      { meta: '{"botCount":2}' },
      { meta: 'not json' },
      { meta: { v: 2, archived: true } },
      { meta: { v: 0 } },
      { meta: '"text"' },
      { meta: '[1]' },
      { meta: 7 },
    ],
    unitTypes,
    armies,
    items,
    heroes,
    skillSets,
    reports: pairs.length,
  };
  deepFreeze(made);
  return made;
}

// ── The pairs ────

/** One value compared: what the copy answers, what the engine answers, and whether the engine's function tried to
 *  change its input (a read that writes: plan P1-11a, "What the code is"). The values are frozen, so a write throws:
 *  the answer is then "(wrote to its input)". */
export interface Comparison {
  readonly on: unknown;
  readonly copy: unknown;
  readonly engine: unknown;
  readonly engineChangedItsInput: boolean;
}
/** The same answer: undefined, NaN and -0 told apart, a Set as its members. */
export function sameAnswer(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}
function canonical(x: unknown): string {
  return JSON.stringify(x, (_k, v: unknown) =>
    v === undefined
      ? '(undefined)'
      : typeof v === 'number' && !Number.isFinite(v)
        ? `(${String(v)})`
        : Object.is(v, -0)
          ? '(-0)'
          : v instanceof Set
            ? [...(v as Set<unknown>)]
            : v,
  );
}
/** `x` and everything it holds, frozen: a function handed it can read it, and a write to it throws (the engine's
 *  modules are strict). Frozen once: what is frozen already is left as it is. */
export function deepFreeze<T>(x: T): T {
  if (typeof x !== 'object' || x === null || Object.isFrozen(x)) return x;
  Object.freeze(x);
  for (const v of Object.values(x)) deepFreeze(v);
  return x;
}
/** What a strict function's write to a frozen object throws (V8's words: assign, add, delete, define). */
const WRITE_TO_FROZEN = /read[- ]only|not extensible|Cannot (add|assign|delete|define|redefine)/i;
/** The engine's function on `args`, frozen, and whether it tried to change them (a write to one throws). */
function engineOn(fn: (...args: never[]) => unknown, args: unknown[]): { answer: unknown; changed: boolean } {
  for (const a of args) deepFreeze(a);
  try {
    return { answer: (fn as (...a: unknown[]) => unknown)(...args), changed: false };
  } catch (e) {
    if (e instanceof TypeError && WRITE_TO_FROZEN.test(e.message))
      return { answer: '(wrote to its input)', changed: true };
    throw e;
  }
}
const compare = (on: unknown, copy: unknown, engine: { answer: unknown; changed: boolean }): Comparison => ({
  on,
  copy,
  engine: engine.answer,
  engineChangedItsInput: engine.changed,
});

/** The values of `list` with no two the same (by canonical), so a count says how many different values were checked. */
function distinct<T>(list: T[], key: (x: T) => unknown = (x) => x): T[] {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = canonical(key(x));
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** A pair: a copy in the player portal and the engine's function it restates. */
export interface Pair {
  /** The portal's name and the engine's. */
  readonly copy: string;
  readonly engine: string;
  /** What the copy is handed. */
  readonly on: string;
  /** Swap parity: both on what the portal is handed. */
  readonly swap: (c: Copies, s: Samples) => Comparison[];
  /** Truth parity: the copy on the report's value, the engine's function on the state's. Absent where the portal is
   *  handed the very value the engine reads. */
  readonly truth?: (c: Copies, s: Samples) => Comparison[];
}

const withState = <T extends { state: Obj | null }>(list: T[]) =>
  list.filter((x): x is T & { state: Obj } => x.state !== null);
/** The text heroFameTextP builds, from the engine's top skill and fame label. */
const engineFameText = (hero: unknown): { answer: unknown; changed: boolean } => {
  const top = engineOn(topSkillOf, [hero]);
  const ts = top.answer as { skill: string; level: number } | null;
  const labels = SKILL_LABELS as unknown as Record<string, string>;
  return {
    answer: ts ? `${skillFameLabelM(ts.level)} ${labels[ts.skill] ?? ts.skill}` : 'no notable skills',
    changed: top.changed,
  };
};

/** The 16 pairs whose copy P1-11a swaps for the engine's function. */
export const PAIRS: Pair[] = [
  {
    copy: 'floorNumP',
    engine: 'dispFloor',
    on: 'every number the reports hold, and fractions of it',
    swap: (c, s) => s.numbers.map((n) => compare(n, c.floorNumP(n), engineOn(dispFloor, [n]))),
  },
  {
    copy: 'unitTypeOfP',
    engine: 'unitTypeOf',
    on: 'every unit type',
    swap: (c, s) => s.unitTypes.map((t) => compare(t, c.unitTypeOfP(t), engineOn(unitTypeOf, [t]))),
    truth: (c, s) =>
      withState(s.armies).map((a) =>
        compare(a.report, c.unitTypeOfP(a.report['type']), engineOn(unitTypeOf, [a.state['type']])),
      ),
  },
  {
    copy: 'unitBaseStrengthP',
    engine: 'unitBaseStrength',
    on: 'every unit the reports show',
    swap: (c, s) =>
      distinct(s.armies, (a) => a.report).map((a) =>
        compare(a.report, c.unitBaseStrengthP(a.report), engineOn(unitBaseStrength, [a.report])),
      ),
    truth: (c, s) =>
      withState(s.armies).map((a) =>
        compare(a.report, c.unitBaseStrengthP(a.report), engineOn(unitBaseStrength, [a.state])),
      ),
  },
  {
    copy: 'isLegendaryItemP',
    engine: 'isLegendaryItem',
    on: 'every item the reports show',
    swap: (c, s) =>
      distinct(s.items, (i) => i.report).map((i) =>
        compare(i.report, c.isLegendaryItemP(i.report), engineOn(isLegendaryItem, [i.report])),
      ),
    truth: (c, s) =>
      withState(s.items).map((i) =>
        compare(i.report, c.isLegendaryItemP(i.report), engineOn(isLegendaryItem, [i.state])),
      ),
  },
  {
    copy: 'itemSlotP',
    engine: 'itemSlot',
    on: 'every item the reports show',
    swap: (c, s) =>
      distinct(s.items, (i) => i.report).map((i) =>
        compare(i.report, c.itemSlotP(i.report), engineOn(itemSlot, [i.report])),
      ),
    truth: (c, s) =>
      withState(s.items).map((i) => compare(i.report, c.itemSlotP(i.report), engineOn(itemSlot, [i.state]))),
  },
  {
    copy: 'itemRaceOfP',
    engine: 'itemRaceOf',
    on: 'every item the reports show',
    swap: (c, s) =>
      distinct(s.items, (i) => i.report).map((i) =>
        compare(i.report, c.itemRaceOfP(i.report), engineOn(itemRaceOf, [i.report])),
      ),
    truth: (c, s) =>
      withState(s.items).map((i) => compare(i.report, c.itemRaceOfP(i.report), engineOn(itemRaceOf, [i.state]))),
  },
  {
    copy: 'itemUsableByP',
    engine: 'itemUsableBy',
    on: 'every item a hero holds in the reports, and that hero; every item, and no hero',
    swap: (c, s) => [
      ...s.items.flatMap((i) =>
        i.holder
          ? [
              compare(
                [i.report, i.holder.report],
                c.itemUsableByP(i.report, i.holder.report),
                engineOn(itemUsableBy, [i.report, i.holder.report]),
              ),
            ]
          : [],
      ),
      ...distinct(s.items, (i) => i.report).map((i) =>
        compare([i.report, null], c.itemUsableByP(i.report, null), engineOn(itemUsableBy, [i.report, null])),
      ),
    ],
    truth: (c, s) =>
      withState(s.items).flatMap((i) =>
        i.holder?.state
          ? [
              compare(
                [i.report, i.holder.report],
                c.itemUsableByP(i.report, i.holder.report),
                engineOn(itemUsableBy, [i.state, i.holder.state]),
              ),
            ]
          : [],
      ),
  },
  {
    copy: 'alignDistPP',
    engine: 'alignDistP',
    on: 'every pair of alignments',
    swap: (c, s) => s.alignmentPairs.map((p) => compare(p, c.alignDistPP(...p), engineOn(alignDistP, p))),
  },
  {
    copy: 'heroHireWagePP',
    engine: 'heroHireWage (the realm and the hero alignments only)',
    on: 'every pair of alignments',
    swap: (c, s) => s.alignmentPairs.map((p) => compare(p, c.heroHireWagePP(...p), engineOn(heroHireWage, p))),
  },
  {
    copy: 'gameMetaP',
    engine: 'gameMetaOf',
    on: 'games rows',
    swap: (c, s) => s.gameRows.map((g) => compare(g, c.gameMetaP(g), engineOn(gameMetaOf, [g]))),
  },
  {
    copy: 'skillFameLabel',
    engine: 'skillFameLabelM',
    on: 'every level',
    swap: (c, s) => s.levels.map((l) => compare(l, c.skillFameLabel(l), engineOn(skillFameLabelM, [l]))),
  },
  {
    copy: "heroFameTextP's top skill",
    engine: 'topSkillOf (with skillFameLabelM)',
    on: "every hero's skills in the reports, and staged ties, without the report's top skill",
    swap: (c, s) => distinct(s.skillSets).map((h) => compare(h, c.heroFameTextP(h), engineFameText(h))),
    truth: (c, s) =>
      withState(s.heroes).map((h) => compare(h.report, c.heroFameTextP(h.report), engineFameText(h.state))),
  },
  {
    copy: 'poAirCarriable (of a unit type)',
    engine: 'isAirCarriable (of a unit)',
    on: 'every unit type; every unit the reports show',
    swap: (c, s) => [
      ...s.unitTypes.map((type) => compare(type, c.poAirCarriable(type), engineOn(isAirCarriable, [{ type }]))),
      ...distinct(s.armies, (a) => a.report).map((a) =>
        compare(a.report, c.poAirCarriable(a.report['type']), engineOn(isAirCarriable, [a.report])),
      ),
    ],
    truth: (c, s) =>
      withState(s.armies).map((a) =>
        compare(a.report, c.poAirCarriable(a.report['type']), engineOn(isAirCarriable, [a.state])),
      ),
  },
  {
    copy: 'poFlyCapability',
    engine: 'getFlyCapability',
    on: 'every column a hero leads in the reports, and none',
    swap: (c, s) => [
      ...distinct(s.heroes, (h) => h.report['armies']).map((h) =>
        compare(
          h.report['armies'],
          c.poFlyCapability(h.report['armies']),
          engineOn(getFlyCapability, [h.report['armies']]),
        ),
      ),
      ...[undefined, null, []].map((none) =>
        compare(none, c.poFlyCapability(none), engineOn(getFlyCapability, [none])),
      ),
    ],
    truth: (c, s) =>
      withState(s.heroes).map((h) =>
        compare(
          h.report['armies'],
          c.poFlyCapability(h.report['armies']),
          engineOn(getFlyCapability, [h.state['armies']]),
        ),
      ),
  },
  {
    copy: 'actionSpellLimit',
    engine: 'actionSpellsAllowedPerSchoolEachTurn',
    on: 'every level',
    swap: (c, s) =>
      s.levels.map((l) => compare(l, c.actionSpellLimit(l), engineOn(actionSpellsAllowedPerSchoolEachTurn, [l]))),
  },
  {
    copy: 'combatSpellLimit',
    engine: 'combatSpellsAllowedPerSchoolEachFight',
    on: 'every level',
    swap: (c, s) =>
      s.levels.map((l) => compare(l, c.combatSpellLimit(l), engineOn(combatSpellsAllowedPerSchoolEachFight, [l]))),
  },
];

/** A copy that stays in P1-11a (it reads the report's shape: P1-11b's), and the engine's function it restates. */
export interface Staying {
  readonly copy: string;
  readonly engine: string;
  readonly on: string;
  /** Truth parity: the copy on the report's value, the engine's function on the state's. */
  readonly truth: (c: Copies, s: Samples) => Comparison[];
}

/** Two of the three copies that stay, whose truth cases agree on every value. */
export const STAYING: Staying[] = [
  {
    copy: 'beastCommandCountP',
    engine: 'beastCommandCount',
    on: "every unit of the realm's heroes (the report's flags against the state's)",
    truth: (c, s) =>
      withState(s.armies).map((a) =>
        compare(a.report, c.beastCommandCountP(a.report), engineOn(beastCommandCount, [a.state])),
      ),
  },
  {
    copy: "poSeaAnalysis's cap",
    engine: 'getSeaCapability',
    on: "every column the realm's heroes lead, with the hero's naval skill",
    truth: (c, s) =>
      withState(s.heroes).map((h) => {
        const naval = (isObj(h.report['skills']) ? h.report['skills']['naval'] : 0) ?? 0;
        const analysis = c.poSeaAnalysis(h.report['armies'], naval);
        return compare(
          [h.report['armies'], naval],
          isObj(analysis) ? analysis['cap'] : analysis,
          engineOn(getSeaCapability, [h.state['armies'], h.state]),
        );
      }),
  },
];

/** The third: effMagicLvl, the level of a magic school the order form offers spells by, against the effective level
 *  the report sends (skillEff: the engine's skillBonusBreakdown, the level the turn casts at), for every school of every
 *  hero of the realm; with the aura the report says it counts. */
export function effMagicLvlAgainstTheReport(
  c: Copies,
  s: Samples,
): { hero: unknown; school: string; copy: unknown; report: number; aura: number }[] {
  return s.heroes.flatMap((h) =>
    SCHOOLS.map((school) => {
      const eff = isObj(h.report['skillEff']) ? h.report['skillEff'][school] : undefined;
      const n = (x: unknown) => (typeof x === 'number' ? x : 0);
      return {
        hero: h.report['name'],
        school,
        copy: c.effMagicLvl(h.report, school),
        report: isObj(eff) ? n(eff['total']) : 0,
        aura: isObj(eff) ? n(eff['aura']) : 0,
      };
    }),
  );
}
