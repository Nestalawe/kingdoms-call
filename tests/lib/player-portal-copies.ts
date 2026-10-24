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
//   truth       for the copies that stay until P1-11b (they read the report's shape, the realm or the world): the
//               copy on the report's value, the engine's function on the state's. It says whether the portal tells the
//               player what the turn will do. P1-11b1 added the Druid a hero needs to lead a unit (druidNeedP), the
//               army card's Druid and sea-transport lines, the turn report's own flying carry and the Explore order's
//               forecast (exploreGainFor); where a copy is known to disagree (plan P1-11b's questions for Toby), the
//               difference is pinned exactly. P1-11b2 retired the turn report's copy (it calls getFlyCapability): its
//               statement that gives a column the flyers' pace is checked against the engine on the state's column.
//
// The copies are read from src/ui/player/ by their syntax tree (tests/lib/source.ts) and run in a context of their
// own, with the data file run beside them as a script (the content as the player page holds it, before the engine
// rewrites the item catalogue's tiers as it loads) and the names src/shared/ hands the portal, as it imports them. The
// player page's modules can't be imported here: they start the page (its database client) as they load. A copy written
// inline in a longer function is read by its statements (statementsBetween) and run as a function of what they read.
// The engine's functions are imported directly, with no vm (P1-11a1).
//
// The values (Decision 5): the balance matrix's game scripted-05 played with the engine's modules imported directly,
// its scripted realm's report after every turn and the state it was built from; and a staged world in the engine's
// shape handed through the report's own projection (buildTurnReport): every catalogue item, held by a hero of every
// race and alignment; every unit type at every quality, with the flags the engine and the report use; columns made of
// every kind of unit, led by heroes with and without the naval mastery that doubles a hull. The checks read the
// realm's own heroes, their units and their items: the values the report makes from the state. (Until P1-11a4 the swap
// cases also took every alignment pair, every level, games rows and every number the reports hold.) For the Druid
// rule, six more staged worlds (druidWorlds) and for the Explore order one more (exploreWorld), each sized so the whole
// test runs in a few seconds.
import vm from 'node:vm';
import {
  ALL_MAGIC_ITEMS_P,
  KC_ALIGNMENTS,
  KC_CARRIER_BERTHS,
  KC_DRUID_LEVELS,
  KC_HUMANOID_RACES,
  KC_ITEM_RACE_ALIAS,
  KC_MAGIC_SCHOOLS,
  KC_QUALITY_TIERS,
  KC_SEASONS,
  KC_UNIT_CLASS,
  KC_UNIT_TYPE,
  LEGENDARY_ITEMS_P,
  SAGE_DISCOVERIES_P,
} from '../../src/content/kingdoms-call-data.ts';
import { SKILL_LABELS } from '../../src/engine/army-tables.ts';
import { getSeaCapability } from '../../src/engine/units/movement-pools.ts';
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
  AERIAL_TYPES,
  getFlyCapability,
  isAirCarriable,
} from '../../src/engine/rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { beastCommandCount, druIdPenaltyMult } from '../../src/engine/world/tables.ts';
import { druidMasteryGain } from '../../src/engine/battle/terrain-and-unit-strength.ts';
import { dragonTamed } from '../../src/engine/discoveries.ts';
import { resolveExploreOrder } from '../../src/engine/orders/explore-and-search-orders-maps-lairs-rites-and-rumours.ts';
import { createTurnContext } from '../../src/engine/turn/context.ts';
import { isBotRow } from '../../src/engine/bots/setup.ts';
import { computeMinorTitles, computeStandings } from '../../src/engine/titles/reckoning.ts';
import { TITLES_PUBLIC_FROM_TURN } from '../../src/engine/titles/perks.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { resolveTurn } from '../../src/engine/run-turn.ts';
import { buildReports } from '../../src/views/every-realms-report-and-the-lines-each-realm-reads.ts';
import { kcRng } from '../../src/engine/rng.ts';
import { buildTurnReport } from '../../src/views/turn-report.ts';
import { playerView } from '../../src/views/what-each-realm-may-see-of-the-world.ts';
import type { GameState } from '../../src/schemas/saved-game-state.ts';
import * as theRulesTheSharedDoorHandsThePortal from '../../src/shared/the-engines-rules-the-player-portal-shares.ts';
import { MAP_SIZES, MAX_TURNS, SCRIPTED_REALM } from '../../tools/balance/matrix.ts';
import { GAME, SETUPS, slotRowsJson } from './matrix-game.ts';
import { scriptOf, sourceOf, statementsBetween, type SourceOptions } from './source.ts';
import { addTheFieldsResolveTurnAdds } from './the-fields-resolve-turn-adds-to-the-turns-context.ts';

/** A value as the JSON of a save or a report holds it. */
export type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const objects = (x: unknown): Obj[] => (Array.isArray(x) ? x.filter(isObj) : []);
const copyOf = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const SCHOOLS: readonly string[] = KC_MAGIC_SCHOOLS;

// ── The copies ────

/** The copies left (and the tables and helpers they read) by file, as the player portal declares them. */
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
  // a hero's skill as the report counts it (skillEff): druidNeedP, exploreGainFor and the army card read it
  'ui/player/briefing-and-submit.ts': ['effSkillP'],
  'ui/player/skills-and-projections.ts': [
    'CREATURE_ARMIES_UI',
    'MONSTER_ARMIES_UI',
    'DRUID_LEVEL_OF_P',
    'TAMED_FLYERS_P',
    'druidNeedP',
  ],
  'ui/player/order-targets.ts': ['exploreGainFor'],
};
const ARMY_CARD = 'ui/player/report.ts';
const TURN_REPORT = 'views/turn-report.ts';
/** The copies written inline, inside a longer function: each read by its statements (tests/lib/source.ts's
 *  statementsBetween) and run as a function of what those statements read. The army card is the "Armies leading" part
 *  of a hero's card on the player's report screen (renderReportView); the turn report's flying carry is the statement
 *  that gives a column the flyers' pace when it takes to the air (buildTurnReport: it calls getFlyCapability, since
 *  P1-11b2, where it kept a copy of it and of isAirCarriable). */
const statementCopies = (opts: SourceOptions) => `
// The army card's Druid lines for one unit \`a\` of the hero \`c\`: the strength left of a unit of 1,000 by a Druid
// shortfall (the card's own sum), the Druid mastery bonus in percent, and the shortfall.
function armyCardDruidLines(a, c, report) {
  ${statementsBetween(ARMY_CARD, 'renderReportView', 'druLevel', 'druLevel', opts)}
  let bs = 1000, druidUnits = 0, druidShort = 0;
  ${statementsBetween(ARMY_CARD, 'renderReportView', 'creature', 'mastery', opts)}
  return { strengthOfAThousand: bs, mastery, shortfall };
}
// The army card's sea-transport note for the column \`arr\` the hero \`c\` leads, as the words the card shows.
function armyCardSeaNote(arr, c) {
  let druidUnits = 0, druidShort = 0;
  ${statementsBetween(ARMY_CARD, 'renderReportView', '_FLY_UI2', 'druNote', opts)}
  return String(_seaNote);
}
// The turn report's flying carry, on the column \`armies\` as the report projects it.
function turnReportFlyingCarry(armies) {
  ${statementsBetween(TURN_REPORT, 'buildTurnReport', 'SEA_UNIT_TYPES', 'AERIAL_UNIT_TYPES', opts)}
  ${statementsBetween(TURN_REPORT, 'buildTurnReport', 'canFlyRep', 'canFlyRep', opts)}
  return { canFly: canFlyRep };
}
// exploreGainFor reads the report the page shows (its currentReport): here, the one handed in.
function exploreGainOn(report, c, terrain) {
  currentReport = report;
  try { return exploreGainFor(c, terrain); } finally { currentReport = null; }
}`;
/** The functions the checks call: the portal's copies, and those made of a copy's statements. */
const COPY_FUNCTIONS = [
  'beastCommandCountP',
  'poSeaAnalysis',
  'effMagicLvl',
  'druidNeedP',
  'exploreGainOn',
  'armyCardDruidLines',
  'armyCardSeaNote',
  'turnReportFlyingCarry',
] as const;
export type CopyName = (typeof COPY_FUNCTIONS)[number];
export type Copies = Record<CopyName, (...args: unknown[]) => unknown>;

/** The player portal's copies, read from `src` (default: this checkout's src/), run with the data file and kc-safe
 *  (kcHtml: the army card's notes) beside them, and the names src/shared/ hands the portal (effMagicLvl calls itemSlot
 *  and itemUsableBy; poSeaAnalysis getFlyCapability and isAirCarriable). The turn report's flying carry runs beside
 *  them too: it reads the data file and getFlyCapability. */
export function playerPortalCopies(opts: SourceOptions = {}): Copies {
  const code = [
    'let currentReport = null;',
    scriptOf('content/kingdoms-call-data.ts', opts),
    scriptOf('ui/shared/kc-safe.ts', opts),
    ...Object.entries(COPIES).map(([file, names]) => sourceOf(file, names, opts)),
    statementCopies(opts),
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
/** The values of the copies that read the realm, the report's shape or the world (P1-11b1). */
export interface WorldSamples {
  /** A hero of the realm and a unit he might lead: each of his own units in the game's reports; and in the worlds
   *  staged for the Druid rule, every staged hero with every staged unit. */
  readonly druid: DruidCase[];
  /** A hero of the realm and a province he might explore: his own in the game's reports; one of every land terrain in
   *  the world staged for exploring. */
  readonly explore: ExploreCase[];
}
/** The world a case comes from: the report the portal is handed, and the state it was made from. */
export interface World {
  readonly state: Obj;
  readonly report: Obj;
}
export interface DruidCase {
  readonly world: World;
  readonly hero: Projected & { readonly state: Obj };
  readonly unit: Projected & { readonly state: Obj };
}
export interface ExploreCase {
  readonly world: World;
  readonly hero: Projected & { readonly state: Obj };
  /** The province the engine explores (its terrain is the forecast's). */
  readonly province: Obj;
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
  // (a staged world, made with the fields the report reads: a saved state's type by assertion, as the view's unit cases)
  const report: Obj = buildTurnReport(playerView(g as unknown as GameState, 0));
  return { state, report };
}

/** A new world of three realms (realm 0's king a Human of a Good realm), with a way to stage heroes of realm 0 in it
 *  as copies of its king, and its land provinces other than the king's. */
function aWorldToStageIn(): { g: Obj; king: Obj; land: Obj[]; hero: (fields: Obj) => Obj } {
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
  const land = objects(isObj(g['world']) ? g['world']['provinces'] : []).filter(
    (p) => p['terrain'] !== 'sea' && p['id'] !== king['location'],
  );
  let id = 20_000;
  const hero = (fields: Obj): Obj => {
    const h: Obj = { ...copyOf(king), isKing: false, items: [], armies: [], skills: {}, ...fields, id };
    h['name'] = `Staged ${String(id++)}`;
    characters.push(h);
    return h;
  };
  g['characters'] = characters;
  return { g, king, land, hero };
}
/** The world `g` as saved, and realm 0's report on it. */
function savedAndReported(g: Obj): World {
  const state = copyOf(g);
  // (a staged world, made with the fields the report reads: a saved state's type by assertion, as stagedWorld's)
  const report: Obj = buildTurnReport(playerView(copyOf(g) as unknown as GameState, 0));
  return { state, report };
}

/** One unit type for each Druid level a unit can need (0: none) and each class the Druid rule reads: neither
 *  creature nor monster, creature, monster, and either of them a winged beast Dragon Taming tames. */
export function oneUnitTypePerDruidLevelAndClass(): string[] {
  const classes: Record<string, readonly string[]> = KC_UNIT_CLASS;
  const has = (cls: string, t: string) => (classes[cls] ?? []).includes(t);
  const classOf = (t: string) =>
    `${has('creature', t) ? 'creature' : has('monster', t) ? 'monster' : 'neither'}${has('tamedFlyer', t) ? ' tamed' : ''}`;
  const levels: Record<string, readonly string[]> = KC_DRUID_LEVELS;
  const inTheTable = new Set(Object.values(levels).flat());
  const byLevel: [string, readonly string[]][] = [
    ['0', Object.keys(KC_UNIT_TYPE).filter((t) => !inTheTable.has(t))],
    ...Object.entries(levels),
  ];
  const chosen = new Map<string, string>();
  for (const [level, types] of byLevel)
    for (const t of types) if (!chosen.has(`${level} ${classOf(t)}`)) chosen.set(`${level} ${classOf(t)}`, t);
  return [...chosen.values()];
}

/** The worlds staged for the Druid rule: realm 0 Good, Druidic or Evil, without and with Dragon Taming (sd40). In
 *  each, realm 0's king leads one unit of each type oneUnitTypePerDruidLevelAndClass gives, of his own race (Human)
 *  and of none, alive and skeletal; and a hero of every race, alignment and Druid level 0 to 5 stands in a province
 *  beside one wearing the Crown of Command (its aura lifts every skill of his realm's heroes there: the report's
 *  effective Druid counts it) and in another, away from it. */
export function druidWorlds(): World[] {
  const { g, king, land, hero } = aWorldToStageIn();
  const [besideTheCrown, away] = land;
  if (!besideTheCrown || !away) throw new Error('the staged world has too few land provinces');
  king['armies'] = oneUnitTypePerDruidLevelAndClass().flatMap((type) =>
    [{ race: 'Human' }, {}].flatMap((race) =>
      [{}, { _isSkeletal: true }].map((flag) => ({ type, quality: 'Average', unitName: type, ...race, ...flag })),
    ),
  );
  const crown = catalogue().find((it) => isObj(it['effect']) && it['effect']['stat'] === 'aura');
  if (!crown) throw new Error('the catalogue has no item with an aura');
  // (worn, as a saved game holds it once the turn has put it on: so reading his items changes nothing)
  hero({ location: besideTheCrown['id'], items: [{ ...copyOf(crown), id: 60_000, equipped: true }], skills: {} });
  for (const race of KC_HUMANOID_RACES)
    for (const alignment of KC_ALIGNMENTS)
      for (let druid = 0; druid <= 5; druid++)
        for (const where of [besideTheCrown, away]) hero({ race, alignment, location: where['id'], skills: { druid } });
  const sd40 = objects(SAGE_DISCOVERIES_P).find((d) => d['id'] === 'sd40');
  if (!sd40) throw new Error('the data file has no Dragon Taming (sd40)');
  const realm = objects(g['players'])[0];
  if (!realm) throw new Error('the staged world has no realm 0');
  return ['Good', 'Druidic', 'Evil'].flatMap((alignment) =>
    [false, true].map((tamed) => {
      realm['alignment'] = alignment;
      realm['discoveries'] = tamed ? [copyOf(sd40)] : [];
      return savedAndReported(g);
    }),
  );
}

/** The world staged for exploring: titles public (turn 10), realm 0 with no discovery that adds to exploring, and a
 *  hero of each Explorer level 0 to 5, the Loremaster (the best at Sage; Explorer 2) and the Trailblazer (the best at
 *  Explorer: 9), each standing in a province of every land terrain in turn (the forecast reads the terrain; the
 *  engine's order explores the province it is handed). */
export function exploreWorld(): { world: World; provinces: Obj[] } {
  const { g, land, hero } = aWorldToStageIn();
  g['turn'] = 10;
  const realm = objects(g['players'])[0];
  if (realm) realm['discoveries'] = [];
  for (let explorer = 0; explorer <= 5; explorer++) hero({ skills: { explorer } });
  hero({ skills: { explorer: 2, sage: 9 } });
  hero({ skills: { explorer: 9 } });
  const provinces = [...new Map(land.map((p) => [p['terrain'], p])).values()];
  return { world: savedAndReported(g), provinces };
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

let theGame: World[] | null = null;
/** scripted-05's turns (played once in a process: the game takes about a second). A test may play it in a hook of its
 *  own, before samples() and worldSamples() read it, so that each hook has Vitest's limit for itself. */
export const theGamePlayed = (): World[] => (theGame ??= quietly(scripted05));

let made: Samples | null = null;
/** The values the checks are made on (made once in a process). */
export function samples(): Samples {
  if (made) return made;
  const pairs = [...theGamePlayed(), quietly(stagedWorld)];
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

let madeOfTheWorld: WorldSamples | null = null;
/** The values of the copies that read the realm, the report's shape or the world (made once in a process, apart from
 *  samples(): a test builds each in its own hook, each well inside Vitest's limit for one). */
export function worldSamples(): WorldSamples {
  if (madeOfTheWorld) return madeOfTheWorld;
  const druid: DruidCase[] = [];
  const explore: ExploreCase[] = [];
  const provinceOf = (state: Obj, id: unknown) =>
    objects(isObj(state['world']) ? state['world']['provinces'] : []).find((p) => p['id'] === id) ?? null;
  // the game's: each hero of the realm with each unit he leads, and the province he stands in
  for (const world of theGamePlayed())
    for (const hero of ownHeroes(world)) {
      objects(hero.report['armies']).forEach((a, i) => {
        const unit = objects(hero.state['armies'])[i];
        if (unit) druid.push({ world, hero, unit: { report: a, state: unit } });
      });
      const province = provinceOf(world.state, hero.state['location']);
      if (province) explore.push({ world, hero, province });
    }
  // the staged worlds': every staged hero (not the king) with every unit the king leads; every staged explorer in a
  // province of every land terrain
  for (const world of quietly(druidWorlds)) {
    const heroes = ownHeroes(world);
    const king = heroes.find((h) => h.report['isKing']);
    if (!king) throw new Error('a Druid world has no king in its report');
    const units = objects(king.report['armies']).map((a, i) => ({
      report: a,
      state: objects(king.state['armies'])[i],
    }));
    for (const hero of heroes.filter((h) => !h.report['isKing']))
      for (const unit of units)
        if (unit.state) druid.push({ world, hero, unit: { report: unit.report, state: unit.state } });
  }
  const { world, provinces } = quietly(exploreWorld);
  for (const hero of ownHeroes(world).filter((h) => !h.report['isKing']))
    for (const province of provinces) explore.push({ world, hero, province });
  madeOfTheWorld = { druid, explore };
  deepFreeze(madeOfTheWorld);
  return madeOfTheWorld;
}
/** The realm's own heroes in a world's report, each with the state's hero (those the state holds). */
function ownHeroes(world: World): (Projected & { state: Obj })[] {
  const inTheState = new Map(objects(world.state['characters']).map((c) => [c['id'], c]));
  return objects(world.report['characters']).flatMap((c) => {
    const state = inTheState.get(c['id']);
    return state ? [{ report: c, state }] : [];
  });
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

// ── The copies that read the realm, the report's shape or the world (P1-11b1) ────
// Truth parity (Decision 6), each a copy on the report's value against the engine's function on the state's: what
// the portal tells the player against what the turn does. Where the two are known to disagree (plan P1-11b's
// Decisions, questions 13 and 15 for Toby), the difference is pinned exactly: the check fails the day either side
// changes alone, which is when the fix rewrites it.

/** What a case is about, short enough for a line. */
const aboutTheUnit = (world: World, hero: Projected & { state: Obj }, unit: Projected) => ({
  unit: [unit.report['type'], unit.report['race'], unit.report['skeletal'] ? 'skeletal' : 'alive'],
  hero: [
    hero.report['race'],
    hero.report['alignment'],
    (isObj(hero.report['skills']) ? hero.report['skills'] : {})['druid'],
  ],
  realm: [realmOf(world, hero.state)['alignment'], objects(world.report['discoveries']).map((d) => d['id'])],
});
const realmOf = (world: World, hero: Obj): Obj => objects(world.state['players'])[Number(hero['player'])] ?? {};
/** The aura of a Crown of Command in the report's effective level of a hero's skill (0: none). */
export const auraIn = (reportHero: Obj, skill: string): number => {
  const e = isObj(reportHero['skillEff']) ? reportHero['skillEff'][skill] : undefined;
  return isObj(e) && typeof e['aura'] === 'number' ? e['aura'] : 0;
};
/** The hero with his trained level of `skill` set to `level`. */
const withSkillAt = (hero: Obj, skill: string, level: number): Obj => ({
  ...hero,
  skills: { ...(isObj(hero['skills']) ? hero['skills'] : {}), [skill]: level },
});
const skillOf = (hero: Obj, skill: string): number => {
  const v = isObj(hero['skills']) ? hero['skills'][skill] : 0;
  return typeof v === 'number' ? v : 0;
};

/** The battle's Druid multiplier on a unit's strength (druIdPenaltyMult, as the battle calls it: the realm's
 *  alignment, and whether its Dragon Taming tames the unit). */
const battleDruidMultiplier = (world: World) => (hero: Obj, unit: Obj) =>
  druIdPenaltyMult(hero, unit, realmOf(world, hero)['alignment'], dragonTamed({ G: world.state }, hero, unit));

/** One Druid case compared, and the Crown's aura in the report's effective Druid of the hero, with the engine's
 *  answer for the hero trained that much higher. */
export interface DruidComparison extends Comparison {
  readonly aura: number;
  readonly engineWithTheAura: unknown;
}
/** The engine's answer `fn` on the state's hero and unit, and on the hero trained higher by the aura. */
function druidCase(on: unknown, copy: unknown, hero: Obj, unit: Obj, aura: number, fn: (h: Obj, u: Obj) => unknown) {
  return {
    ...compare(on, copy, engineOn(fn, [hero, unit])),
    aura,
    engineWithTheAura: engineOn(fn, [withSkillAt(hero, 'druid', skillOf(hero, 'druid') + aura), unit]).answer,
  };
}

/** The strength a Druid shortfall of `levels` leaves a unit in battle, as the rule says (each level short costs 20%,
 *  down to a tenth): what the shortfall druidNeedP answers comes to. */
const strengthLeftByAShortfall = (levels: unknown) =>
  typeof levels === 'number' ? Math.max(0.1, 1 - levels * 0.2) : levels;

/** druidNeedP (the Druid a hero needs to lead a unit, and his shortfall: the order form's Druid line and the army
 *  card read it), against the battle's druIdPenaltyMult: the strength the shortfall leaves. */
export function druidNeedAgainstTheBattle(c: Copies, w: WorldSamples): DruidComparison[] {
  return w.druid.map(({ world, hero, unit }) => {
    const need = c.druidNeedP(unit.report, hero.report, world.report);
    return druidCase(
      aboutTheUnit(world, hero, unit),
      strengthLeftByAShortfall(isObj(need) ? need['shortfall'] : need),
      hero.state,
      unit.state,
      auraIn(hero.report, 'druid'),
      battleDruidMultiplier(world),
    );
  });
}

/** The army card's Druid shortfall line, read by its statements: the strength it shows a unit of 1,000 after a
 *  shortfall, against the battle's (druIdPenaltyMult, rounded as the card rounds). */
export function armyCardShortfallAgainstTheBattle(c: Copies, w: WorldSamples): DruidComparison[] {
  return w.druid.map(({ world, hero, unit }) => {
    const card = c.armyCardDruidLines(unit.report, hero.report, world.report);
    const multiplier = battleDruidMultiplier(world);
    return druidCase(
      aboutTheUnit(world, hero, unit),
      isObj(card) ? card['strengthOfAThousand'] : card,
      hero.state,
      unit.state,
      auraIn(hero.report, 'druid'),
      (h, u) => Math.round(1000 * multiplier(h, u)),
    );
  });
}
/** The army card's Druid mastery line, read by its statements: its bonus in percent, against the turn's
 *  (druidMasteryGain). */
export function armyCardMasteryAgainstTheTurn(c: Copies, w: WorldSamples): Comparison[] {
  return w.druid.map(({ world, hero, unit }) => {
    const card = c.armyCardDruidLines(unit.report, hero.report, world.report);
    const alignment = realmOf(world, hero.state)['alignment'];
    return compare(
      aboutTheUnit(world, hero, unit),
      isObj(card) ? card['mastery'] : card,
      engineOn(
        (h: Obj, u: Obj) => {
          const gain: unknown = druidMasteryGain({ G: world.state }, h, u, alignment);
          return isObj(gain) && typeof gain['gain'] === 'number' ? Math.round(gain['gain'] * 100) : gain;
        },
        [hero.state, unit.state],
      ),
    );
  });
}

/** The turn report's flying carry, read by its statements: whether a column takes to the air (the flyers lift every
 *  foot soldier), on the report's column, against getFlyCapability on the state's, on every column of the realm's
 *  heroes (a column all of whose units fly is not carried: the report gives it the flyers' pace apart). Until P1-11b2
 *  the report kept its own copy of getFlyCapability and of isAirCarriable, and this checked the second on every unit
 *  type too; it calls getFlyCapability now. */
export function flyingCarryAgainstTheEngine(c: Copies, s: Samples): { columns: Comparison[] } {
  const carry = (armies: unknown): Obj => {
    const answer = c.turnReportFlyingCarry(armies);
    if (!isObj(answer)) throw new Error("the turn report's flying carry gave no answer");
    return answer;
  };
  const columns = withState(s.heroes)
    .filter((h) => objects(h.report['armies']).length > 0)
    .map((h) =>
      compare(
        objects(h.report['armies']).map((a) => a['type']),
        carry(h.report['armies'])['canFly'],
        engineOn(
          (armies: Obj[]) =>
            getFlyCapability(armies as { type: string }[]) && !armies.every((a) => AERIAL_TYPES.has(String(a['type']))),
          [objects(h.state['armies'])],
        ),
      ),
    );
  return { columns };
}

/** The gain the engine's Explore order makes for the hero in the province, on a copy of the state as the next turn
 *  starts: the title holders worked out from it as the turn does before its first phase. */
function exploreOrderGain(state: Obj, heroId: unknown, provinceId: unknown): number {
  const G = copyOf(state);
  G['_titleHolders'] = {};
  G['_minorHolders'] = {};
  const turn = typeof G['turn'] === 'number' ? G['turn'] : 1;
  // (the titles' perks are live from the turn the titles go public: TITLE_PERKS_ENABLED is on)
  if (turn >= TITLES_PUBLIC_FROM_TURN) {
    const standings: unknown = computeStandings(G);
    G['_titleHolders'] = (isObj(standings) ? standings['titles'] : null) ?? {};
    G['_minorHolders'] = computeMinorTitles(G);
  }
  const c = objects(G['characters']).find((x) => x['id'] === heroId);
  const prov = objects(isObj(G['world']) ? G['world']['provinces'] : []).find((p) => p['id'] === provinceId);
  if (!c || !prov) throw new Error('the explore case has no hero or no province');
  prov['exploredBy'] = {};
  prov['explored'] = 0;
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], turn), { KC_SEASONS, isBotRow });
  tc._currentPhase = 0;
  tc._logCtx = { charId: c['id'], phase: 0 };
  kcRng.seed(1);
  quietly(() => {
    resolveExploreOrder(tc, c, prov);
  });
  const by = prov['exploredBy'];
  const gain = isObj(by) ? by[String(c['player'])] : undefined;
  return typeof gain === 'number' ? gain : 0;
}
/** One Explore case compared, and whether the hero holds the Loremaster (in the report: the forecast reads it). */
export interface ExploreComparison extends Comparison {
  readonly loremaster: boolean;
}
/** The Explore order's forecast (exploreGainFor: the percentage of the province the order form says the order maps),
 *  against what the engine's order maps. */
export function exploreForecastAgainstTheOrder(c: Copies, w: WorldSamples): ExploreComparison[] {
  return w.explore.map(({ world, hero, province }) => ({
    ...compare(
      [
        hero.report['name'],
        province['terrain'],
        (isObj(hero.report['skills']) ? hero.report['skills'] : {})['explorer'],
      ],
      c.exploreGainOn(world.report, hero.report, province['terrain']),
      { answer: exploreOrderGain(world.state, hero.state['id'], province['id']), changed: false },
    ),
    loremaster: objects(hero.report['titlesHeld']).some((t) => String(t['name']).includes('Loremaster')),
  }));
}

/** What the army card's sea note tells the player, in the engine's words (getSeaCapability's answers): 'all' (every
 *  unit sails or flies on its own), 'sea' (the column can put to sea: its hulls carry it, or its flyers lift it and
 *  the card shows no note), 'land' (it needs more fleet units). */
function seaNoteVerdict(note: unknown): string {
  const words = String(note);
  if (words === '') return 'sea';
  if (words.includes('every unit sails or flies on its own')) return 'all';
  if (words.includes('can put to sea')) return 'sea';
  if (words.includes('more fleet unit')) return 'land';
  return `(a note the check doesn't know: ${words})`;
}
/** One sea case compared, whether the hero has the naval mastery that doubles a hull (Naval 8), and the engine's
 *  answer for the column under a leader one level short of it. */
export interface SeaNoteComparison extends Comparison {
  readonly naval8: boolean;
  readonly engineWithoutTheMastery: unknown;
}
/** The army card's sea-transport note, read by its statements, against getSeaCapability, on every column of the
 *  realm's heroes. */
export function armyCardSeaNoteAgainstTheEngine(c: Copies, s: Samples): SeaNoteComparison[] {
  return withState(s.heroes)
    .filter((h) => objects(h.report['armies']).length > 0)
    .map((h) => {
      const armies = objects(h.state['armies']);
      return {
        ...compare(
          [objects(h.report['armies']).map((a) => a['type']), skillOf(h.state, 'naval')],
          seaNoteVerdict(c.armyCardSeaNote(h.report['armies'], h.report)),
          engineOn(getSeaCapability, [armies, h.state]),
        ),
        naval8: skillOf(h.state, 'naval') >= 8,
        engineWithoutTheMastery: engineOn(getSeaCapability, [armies, withSkillAt(h.state, 'naval', 7)]).answer,
      };
    });
}
