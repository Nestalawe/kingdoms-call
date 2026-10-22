// The player portal's copies of the engine's rules that are left, the engine's functions it now calls in their place,
// and the values both are checked on (plan P1-11a, Decisions 5, 6 and 7). tests/unit/the-player-portals-copies-agree-with-the-engine.test.ts
// checks them.
//
// Until P1-11a4 the player page loaded no engine file: where it needed a rule of a hero, an army, an item or a number, it
// kept its own copy (`floorNumP`, `unitBaseStrengthP`, …). P1-11a4 swapped each of the 16 copies that agreed with the
// engine's function for that function, which the portal now imports through src/shared/. So two ways of checking are
// left (Decision 7):
//   projection  the engine's function on the report's value against it on the state's value the report made it from:
//               the report hands the portal what the engine reads. For the 9 swapped rules whose value the report
//               makes from the state (the other 7 take a number, a level, an alignment or a games row: one function on
//               one value, nothing left to compare).
//   truth       for the three copies that stay until P1-11b (they read the report's shape): the copy on the report's
//               value, the engine's function on the state's. It says whether the portal tells the player what the turn
//               will do.
//
// The copies are read from src/ui/player/ by their syntax tree (tests/lib/source.ts) and run in a context of their
// own, with the data file run beside them as a script (the content as the player page holds it, before the engine
// rewrites the item catalogue's tiers as it loads) and the names src/shared/ hands the portal, as it imports them. The
// player page's modules can't be imported here: they start the page (its database client) as they load. The engine's
// functions are imported directly, with no vm (P1-11a1).
//
// The values (Decision 5): the balance matrix's game scripted-05 played with the engine's modules imported directly,
// its scripted realm's report after every turn and the state it was built from; and a staged world in the engine's
// shape handed through the report's own projection (buildTurnReport): every catalogue item, held by a hero of every
// race and alignment; every unit type at every quality, with the flags the engine and the report use; columns made of
// every kind of unit, led by heroes with and without the naval mastery that doubles a hull. The checks read the
// realm's own heroes, their units and their items: the values the report makes from the state. (Until P1-11a4 the swap
// cases also took every alignment pair, every level, games rows and every number the reports hold.)
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
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { resolveTurn } from '../../src/engine/run-turn.ts';
import { buildReports } from '../../src/views/every-realms-report-and-the-lines-each-realm-reads.ts';
import { kcRng } from '../../src/engine/rng.ts';
import { buildTurnReport } from '../../src/views/turn-report.ts';
import * as theRulesTheSharedDoorHandsThePortal from '../../src/shared/the-engines-rules-the-player-portal-shares.ts';
import { MAP_SIZES, MAX_TURNS, SCRIPTED_REALM } from '../../tools/balance/matrix.ts';
import { GAME, SETUPS, slotRowsJson } from './matrix-game.ts';
import { scriptOf, sourceOf, type SourceOptions } from './source.ts';

/** A value as the JSON of a save or a report holds it. */
export type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const objects = (x: unknown): Obj[] => (Array.isArray(x) ? x.filter(isObj) : []);
const copyOf = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const SCHOOLS: readonly string[] = KC_MAGIC_SCHOOLS;

// ── The copies ────

/** The copies left (and the tables they read) by file, as the player portal declares them. */
const COPIES: Record<string, string[]> = {
  'ui/player/order-chances.ts': ['ITEM_UNCAPPED_SKILLS_P', 'effMagicLvl'],
  'ui/player/map-symbols.ts': ['beastCommandCountP'],
  'ui/player/move-analysis.ts': [
    'PO_SEA_TYPES',
    'PO_CARRIER_TYPES',
    'PO_AERIAL_TYPES',
    'PO_FLYING_TYPES',
    'PO_LIGHT_TYPES',
    'poSeaAnalysis',
  ],
};
/** The functions among them that the checks call. */
const COPY_FUNCTIONS = ['beastCommandCountP', 'poSeaAnalysis', 'effMagicLvl'] as const;
export type CopyName = (typeof COPY_FUNCTIONS)[number];
export type Copies = Record<CopyName, (...args: unknown[]) => unknown>;

/** The player portal's copies, read from `src` (default: this checkout's src/), run with the data file beside them and
 *  the names src/shared/ hands the portal (effMagicLvl calls itemSlot and itemUsableBy; poSeaAnalysis getFlyCapability
 *  and isAirCarriable). */
export function playerPortalCopies(opts: SourceOptions = {}): Copies {
  const code = [
    scriptOf('content/kingdoms-call-data.ts', opts),
    ...Object.entries(COPIES).map(([file, names]) => sourceOf(file, names, opts)),
  ].join('\n');
  const made: unknown = vm.runInNewContext(`(() => {\n${code}\nreturn { ${COPY_FUNCTIONS.join(', ')} };\n})()`, {
    ...theRulesTheSharedDoorHandsThePortal,
  });
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
  /** Every unit of the realm's heroes in the reports, with the state's unit. */
  readonly armies: Projected[];
  /** Every item of the realm's heroes in the reports, with the state's item and both its holders. */
  readonly items: (Projected & { readonly holder: Projected | null })[];
  /** Every one of the realm's heroes in the reports, with the state's hero. */
  readonly heroes: Projected[];
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
      spyStealthAndInvisibilityStampedForTheReports: () => void;
      whatTheReportsRead: () => unknown;
    };
    result.spyStealthAndInvisibilityStampedForTheReports();
    const { reports } = buildReports(result.whatTheReportsRead()) as { reports: { gp: Obj; report: Obj }[] };
    const ours = reports.find((r) => r.gp['player_index'] === SCRIPTED_REALM);
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
/** The values the checks are made on (made once in a process: the game takes about a second). */
export function samples(): Samples {
  if (made) return made;
  const pairs = quietly(() => [...scripted05(), stagedWorld()]);
  const armies: Projected[] = [];
  const items: (Projected & { holder: Projected | null })[] = [];
  const heroes: Projected[] = [];
  for (const { state, report } of pairs) {
    const stateHeroes = new Map(objects(state['characters']).map((c) => [c['id'], c]));
    const own = objects(report['characters']);
    for (const c of own) {
      const sc = stateHeroes.get(c['id']) ?? null;
      const holder = { report: c, state: sc };
      heroes.push(holder);
      objects(c['armies']).forEach((a, i) => {
        armies.push({ report: a, state: sc ? (objects(sc['armies'])[i] ?? null) : null });
      });
      objects(c['items']).forEach((it, i) => {
        items.push({ report: it, state: sc ? (objects(sc['items'])[i] ?? null) : null, holder });
      });
    }
  }
  made = { armies, items, heroes, reports: pairs.length };
  deepFreeze(made);
  return made;
}

// ── Comparing answers ────

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
const withState = <T extends { state: Obj | null }>(list: T[]) =>
  list.filter((x): x is T & { state: Obj } => x.state !== null);

// ── The projections ────

/** One value compared: the engine's answer on the report's value and on the state's value it was made from, and
 *  whether the engine's function tried to change either (the values are frozen, so a write throws: the answer is then
 *  "(wrote to its input)"). */
export interface ProjectionComparison {
  readonly on: unknown;
  readonly fromTheReport: unknown;
  readonly fromTheState: unknown;
  readonly engineChangedItsInput: boolean;
}
const project = (
  on: unknown,
  fromTheReport: { answer: unknown; changed: boolean },
  fromTheState: { answer: unknown; changed: boolean },
): ProjectionComparison => ({
  on,
  fromTheReport: fromTheReport.answer,
  fromTheState: fromTheState.answer,
  engineChangedItsInput: fromTheReport.changed || fromTheState.changed,
});

/** A rule the portal now calls the engine's function for, whose value the report makes from the state. */
export interface Projection {
  /** The engine's function, and the portal's copy P1-11a4 retired for it. */
  readonly engine: string;
  readonly retiredCopy: string;
  /** What it is handed. */
  readonly on: string;
  /** The engine's function on the report's value and on the state's. */
  readonly cases: (s: Samples) => ProjectionComparison[];
}

/** The text heroFameTextP builds when the hero carries no top skill of his own, from the engine's top skill and fame
 *  label. */
const engineFameText = (hero: unknown): { answer: unknown; changed: boolean } => {
  const top = engineOn(topSkillOf, [hero]);
  const ts = top.answer as { skill: string; level: number } | null;
  const labels = SKILL_LABELS as unknown as Record<string, string>;
  return {
    answer: ts ? `${skillFameLabelM(ts.level)} ${labels[ts.skill] ?? ts.skill}` : 'no notable skills',
    changed: top.changed,
  };
};

/** The 9 rules of the 16 P1-11a4 swapped whose value the report makes from the state: their truth cases, now that the
 *  portal calls the engine's function, as projection cases (Decision 7). */
export const PROJECTIONS: Projection[] = [
  {
    engine: 'unitTypeOf',
    retiredCopy: 'unitTypeOfP',
    on: "every unit of the realm's heroes",
    cases: (s) =>
      withState(s.armies).map((a) =>
        project(a.report, engineOn(unitTypeOf, [a.report['type']]), engineOn(unitTypeOf, [a.state['type']])),
      ),
  },
  {
    engine: 'unitBaseStrength',
    retiredCopy: 'unitBaseStrengthP',
    on: "every unit of the realm's heroes",
    cases: (s) =>
      withState(s.armies).map((a) =>
        project(a.report, engineOn(unitBaseStrength, [a.report]), engineOn(unitBaseStrength, [a.state])),
      ),
  },
  {
    engine: 'isLegendaryItem',
    retiredCopy: 'isLegendaryItemP',
    on: "every item of the realm's heroes",
    cases: (s) =>
      withState(s.items).map((i) =>
        project(i.report, engineOn(isLegendaryItem, [i.report]), engineOn(isLegendaryItem, [i.state])),
      ),
  },
  {
    engine: 'itemSlot',
    retiredCopy: 'itemSlotP',
    on: "every item of the realm's heroes",
    cases: (s) =>
      withState(s.items).map((i) => project(i.report, engineOn(itemSlot, [i.report]), engineOn(itemSlot, [i.state]))),
  },
  {
    engine: 'itemRaceOf',
    retiredCopy: 'itemRaceOfP',
    on: "every item of the realm's heroes",
    cases: (s) =>
      withState(s.items).map((i) =>
        project(i.report, engineOn(itemRaceOf, [i.report]), engineOn(itemRaceOf, [i.state])),
      ),
  },
  {
    engine: 'itemUsableBy',
    retiredCopy: 'itemUsableByP',
    on: "every item of the realm's heroes, and the hero who holds it",
    cases: (s) =>
      withState(s.items).flatMap((i) =>
        i.holder?.state
          ? [
              project(
                [i.report, i.holder.report],
                engineOn(itemUsableBy, [i.report, i.holder.report]),
                engineOn(itemUsableBy, [i.state, i.holder.state]),
              ),
            ]
          : [],
      ),
  },
  {
    engine: 'topSkillOf (with skillFameLabelM)',
    retiredCopy: "heroFameTextP's top skill",
    on: "every one of the realm's heroes",
    cases: (s) => withState(s.heroes).map((h) => project(h.report, engineFameText(h.report), engineFameText(h.state))),
  },
  {
    engine: 'isAirCarriable',
    retiredCopy: 'poAirCarriable',
    on: "every unit of the realm's heroes",
    cases: (s) =>
      withState(s.armies).map((a) =>
        project(a.report, engineOn(isAirCarriable, [a.report]), engineOn(isAirCarriable, [a.state])),
      ),
  },
  {
    engine: 'getFlyCapability',
    retiredCopy: 'poFlyCapability',
    on: "every column the realm's heroes lead",
    cases: (s) =>
      withState(s.heroes).map((h) =>
        project(
          h.report['armies'],
          engineOn(getFlyCapability, [h.report['armies']]),
          engineOn(getFlyCapability, [h.state['armies']]),
        ),
      ),
  },
];

// ── The copies that stay ────

/** One value compared: what the copy answers, what the engine answers, and whether the engine's function tried to
 *  change its input (a read that writes: plan P1-11a, "What the code is"). The values are frozen, so a write throws:
 *  the answer is then "(wrote to its input)". */
export interface Comparison {
  readonly on: unknown;
  readonly copy: unknown;
  readonly engine: unknown;
  readonly engineChangedItsInput: boolean;
}
const compare = (on: unknown, copy: unknown, engine: { answer: unknown; changed: boolean }): Comparison => ({
  on,
  copy,
  engine: engine.answer,
  engineChangedItsInput: engine.changed,
});

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
