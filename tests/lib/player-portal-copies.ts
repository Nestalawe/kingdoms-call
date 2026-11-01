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
//               one value, nothing left to compare), for the beast command P1-11b3 swapped (the portal's
//               beastCommandCountP gave way to countsAgainstBeastCommand, its Druid table to the engine's), and for the
//               sea lift P1-11b4 swapped (poSeaAnalysis counts through seaLiftOfAColumn, getSeaCapability's body).
//   truth       for the copies that stay (they read the report's shape, the realm or the world): the copy on the
//               report's value, the engine's function on the state's. It says whether the portal tells the
//               player what the turn will do. P1-11b1 added the Druid a hero needs to lead a unit (druidNeedP), the
//               army card's Druid and sea-transport lines, the turn report's own flying carry and the Explore order's
//               forecast (exploreGainFor); where a copy is known to disagree (plan P1-11b's questions for Toby), the
//               difference is pinned exactly. P1-11b2 retired the turn report's copy (it calls getFlyCapability): its
//               statement that gives a column the flyers' pace is checked against the engine on the state's column.
//               Since P1-11b3 druidNeedP and the army card's Druid lines call the engine's rule (src/shared/) with the
//               portal's own level of the hero's Druid, so their truth cases check the level each side feeds it.
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
// test runs in a few seconds. For the order form's Cast Spell checks and the army card's kin (P1-11c1, at the end): a
// report staged for the target field, a world of five casters and one of the kin (kinWorld).
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
  SPELL_DEFS_P,
} from '../../src/content/kingdoms-call-data.ts';
import { SKILL_LABELS, type ArmyInABattle, type HeroInABattle } from '../../src/engine/army-tables.ts';
import { getSeaCapability } from '../../src/engine/units/movement-pools.ts';
import { seaLiftOfAColumn } from '../../src/engine/rules-on-plain-values/ships-and-flyers-that-carry-a-column-across-the-sea.ts';
import { perkTier } from '../../src/engine/titles/perks.ts';
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
import { countsAgainstBeastCommand } from '../../src/engine/rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';
import { beastCommandCount, druIdPenaltyMult } from '../../src/engine/world/tables.ts';
import { armStr, druidMasteryGain } from '../../src/engine/battle/terrain-and-unit-strength.ts';
import { resolveCastSpellOrder } from '../../src/engine/orders/cast-spell-order-white-psychic-illusory-elemental-and-necromancy-spells.ts';
import { theMarkOfThisSpellMustStandInTheProvince } from '../../src/engine/rules/the-registry-of-spell-effects.ts';
import { dragonTamed } from '../../src/engine/discoveries.ts';
import { resolveExploreOrder } from '../../src/engine/orders/explore-and-search-orders-maps-lairs-rites-and-rumours.ts';
import { createTurnContext, type TurnContext } from '../../src/engine/turn/context.ts';
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
import { initializersOf, scriptOf, sourceOf, statementsBetween, type SourceOptions } from './source.ts';
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
  // a hero's skill as the report counts it (skillEff): druidNeedP, exploreGainFor and the army card read it
  'ui/player/briefing-and-submit.ts': ['effSkillP'],
  // druidNeedP feeds the portal's level of the hero's Druid to the engine's rule (since P1-11b3); the army card reads
  // the two sets
  'ui/player/skills-and-projections.ts': ['CREATURE_ARMIES_UI', 'MONSTER_ARMIES_UI', 'druidNeedP'],
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
// The army card's strength for one unit \`a\` of the hero \`c\`, as its line shows it ("str …"): the unit's kin (its
// realm's king's and its leader's), a rival kin's leader, a Druid shortfall and the Druid mastery, in the card's order
// (plan P1-11c1).
function armyCardUnitStrength(a, c, report) {
  ${statementsBetween(ARMY_CARD, 'renderReportView', 'kingdom', 'kingdom', opts)}
  ${statementsBetween(ARMY_CARD, 'renderReportView', 'druLevel', 'druLevel', opts)}
  let totalStr = 0, druidUnits = 0, druidShort = 0;
  ${statementsBetween(ARMY_CARD, 'renderReportView', 'rawBs', 'totalStr+=bs;', opts)}
  return bs;
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
  'effMagicLvl',
  'druidNeedP',
  'exploreGainOn',
  'armyCardDruidLines',
  'armyCardSeaNote',
  'armyCardUnitStrength',
  'turnReportFlyingCarry',
] as const;
export type CopyName = (typeof COPY_FUNCTIONS)[number];
export type Copies = Record<CopyName, (...args: unknown[]) => unknown>;

/** The player portal's copies, read from `src` (default: this checkout's src/), run with the data file and kc-safe
 *  (kcHtml: the army card's notes) beside them, and the names src/shared/ hands the portal (effMagicLvl calls itemSlot
 *  and itemUsableBy). The turn report's flying carry runs beside them too: it reads the data file and
 *  getFlyCapability, which the views import from the folder (the portal no longer does, since P1-11b4). */
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
    getFlyCapability,
  });
  if (!isObj(made)) throw new Error('the copies did not load');
  for (const name of COPY_FUNCTIONS)
    if (typeof made[name] !== 'function') throw new Error(`the player portal has no function ${name}`);
  return made as Copies;
}

/** The order form's Cast Spell tables, as it declares them (plan P1-11c1; since P1-11c3 each is the call of the engine
 *  folder's function that makes it, and these are the answers): every school's spells, each spell's school and the
 *  mastery spells' levels (order-chances.ts, at top level), the action spells and those offered a hero of unseen levels
 *  (buildTargetField), the combat spells by school an Encounter plan offers (the Encounter's plan), and the spells
 *  aimed at a province or at a hero (spellSecondaryHtml). A Set as its list, in its order. */
export interface TheOrderFormsSpellTables {
  readonly SPELLS_BY_SCHOOL: Record<string, string[]>;
  readonly SPELL_TO_SCHOOL: Record<string, string>;
  readonly SPELL_REQ_LEVEL: Record<string, number>;
  readonly PHASE_SPELLS: string[];
  readonly _hsPhase: string[];
  readonly ENCOUNTER_VALID: Record<string, string[]>;
  readonly NEEDS_PROV: string[];
  readonly NEEDS_CHAR: string[];
}
/** A spell the form offers a caster in a phase, as its Cast Spell field builds it: whether its school's casting limit
 *  is reached, and its label. */
export interface ASpellTheFormOffers {
  readonly spell: string;
  readonly atLimit: boolean;
  readonly label: string;
}
export interface TheOrderFormsSpells {
  readonly tables: TheOrderFormsSpellTables;
  /** The spells the Cast Spell field offers the hero `c` (as his realm's report holds him) in phase `ph`, the form's
   *  fields (`po-action-<id>-<phase>`, `po-target-<id>-<phase>`) holding `fields`: buildTargetField's statements from
   *  the action spells through the rows it builds. */
  readonly castSpellRows: (c: Obj, ph: number, fields: Record<string, string>) => ASpellTheFormOffers[];
  /** The target field spellSecondaryHtml builds for the spell, the caster `c` in phase 0 of `report`'s orders, with no
   *  target chosen: its markup. */
  readonly targetField: (report: Obj, c: Obj, spell: string) => string;
}

/** The order form's Cast Spell tables, and its two functions that read them, read from `src` (default: this
 *  checkout's src/) by their statements and run beside the data file and kc-safe, with the names src/shared/ hands the
 *  portal: order-chances.ts whole (its tables, effMagicLvl and projectedMagicLevels), the helpers the target field
 *  calls as the portal declares them, and a stand-in for the page's fields (document.getElementById, which the form's
 *  count and getOrderTarget read). Apart from playerPortalCopies: order-chances.ts runs whole here. */
export function theOrderFormsSpells(opts: SourceOptions = {}): TheOrderFormsSpells {
  const one = (file: string, name: string) => {
    const found = initializersOf(file, name, opts);
    if (found.length !== 1) throw new Error(`${file}: ${String(found.length)} declarations of ${name}`);
    return found[0] ?? '';
  };
  const code = [
    'let currentReport = null;',
    // the page's fields, as the form reads them by id: here, the values handed in
    'let theFields = {};',
    'const document = { getElementById: (id) => (id in theFields ? { value: theFields[id] } : null) };',
    scriptOf('content/kingdoms-call-data.ts', opts),
    scriptOf('ui/shared/kc-safe.ts', opts),
    scriptOf('ui/player/order-chances.ts', opts),
    sourceOf('ui/player/pre-orders.ts', ['getOrderTarget'], opts),
    sourceOf('ui/player/order-targets.ts', ['predictedLocation', 'provDirectionLabel'], opts),
    sourceOf(
      'ui/player/items-and-heroes.ts',
      ['isPreOrderIdP', 'orderTargetCharsP', 'preOrderTagP', 'realmOfP', 'realmNameP', 'realmOptStyleP'],
      opts,
    ),
    sourceOf('ui/player/map-symbols.ts', ['leadsArmiesP'], opts),
    sourceOf('ui/player/move-analysis.ts', ['SKILL_LABELS'], opts),
    sourceOf('ui/player/titles.ts', ['spellSecondaryHtml'], opts),
    `function castSpellRows(c, ph, fields) {
      theFields = fields;
      try {
        ${statementsBetween('ui/player/order-targets.ts', 'buildTargetField', 'PHASE_SPELLS', '_spellRows', opts)}
        return _spellRows;
      } finally { theFields = {}; }
    }`,
    `function targetField(report, c, spell) {
      currentReport = report;
      try { return String(spellSecondaryHtml(report, c, 0, spell, '', spell)); } finally { currentReport = null; }
    }`,
    `const tables = JSON.parse(JSON.stringify({
      SPELLS_BY_SCHOOL, SPELL_TO_SCHOOL, SPELL_REQ_LEVEL,
      PHASE_SPELLS: [...${one('ui/player/order-targets.ts', 'PHASE_SPELLS')}],
      _hsPhase: [...${one('ui/player/order-targets.ts', '_hsPhase')}],
      ENCOUNTER_VALID: ${one('ui/player/orders-form.ts', 'ENCOUNTER_VALID')},
      NEEDS_PROV: [...${one('ui/player/titles.ts', 'NEEDS_PROV')}],
      NEEDS_CHAR: [...${one('ui/player/titles.ts', 'NEEDS_CHAR')}],
    }));`,
  ].join('\n');
  const made: unknown = vm.runInNewContext(`(() => {\n${code}\nreturn { tables, castSpellRows, targetField };\n})()`, {
    ...theRulesTheSharedDoorHandsThePortal,
  });
  if (!isObj(made) || typeof made['castSpellRows'] !== 'function' || typeof made['targetField'] !== 'function')
    throw new Error("the order form's spells did not load");
  // (the vm's values, made by the form's own statements: its tables as JSON, its rows and its markup)
  return made as unknown as TheOrderFormsSpells;
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

/** The 9 rules of the 16 P1-11a4 swapped whose value the report makes from the state, and the beast command P1-11b3
 *  swapped: their truth cases, now that the portal calls the engine's function, as projection cases (Decision 7). */
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
  {
    // The report's unit carries the names its realm sees it by (skeletal, temporary, wildHunt); the engine's,
    // _isSkeletal and the rest: beastCommandCount hands its unit through unitAsItsRealmSeesIt (P1-11b2).
    engine: 'countsAgainstBeastCommand',
    retiredCopy: 'beastCommandCountP',
    on: "every unit of the realm's heroes (the report's flags; on the state's unit, as beastCommandCount asks it)",
    cases: (s) =>
      withState(s.armies).map((a) =>
        project(a.report, engineOn(countsAgainstBeastCommand, [a.report]), engineOn(beastCommandCount, [a.state])),
      ),
  },
  {
    // The Move notice (poSeaAnalysis) counts a column through seaLiftOfAColumn (P1-11b4), whose figures it explains
    // itself by: the lift on the report's column under the report's hero against it on the state's, the leader's naval
    // mastery worked out as getSeaCapability works it out, and on the state's side getSeaCapability's own answer.
    engine: 'seaLiftOfAColumn (getSeaCapability its wrapper)',
    retiredCopy: "poSeaAnalysis's own lift",
    on: "every column the realm's heroes lead, under its leader",
    cases: (s) =>
      withState(s.heroes).map((h) =>
        project(
          [h.report['armies'], skillOf(h.report, 'naval')],
          engineOn(theSeaLiftOf, [h.report['armies'], h.report]),
          engineOn(
            (armies: unknown, hero: Obj) => ({ ...theSeaLiftOf(armies, hero), answer: getSeaCapability(armies, hero) }),
            [h.state['armies'], h.state],
          ),
        ),
      ),
  },
];
const hasAType = (a: Obj): a is Obj & { type: string } => typeof a['type'] === 'string';
/** A column's sea lift (seaLiftOfAColumn) under its leader, with his naval mastery as getSeaCapability works it out;
 *  the units left ashore by their type and name. */
function theSeaLiftOf(armies: unknown, hero: Obj) {
  const lift = seaLiftOfAColumn(objects(armies).filter(hasAType), perkTier(hero, 'naval') >= 3);
  return { ...lift, unitsLeftAshore: lift.unitsLeftAshore.map((a) => [a.type, a['unitName']]) };
}

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

/** The copy that stays of the two P1-11a2 checked the truth of (the other, poSeaAnalysis's cap, is a projection case
 *  since P1-11b4): effMagicLvl, the level of a magic school the order form offers spells by, against the effective
 *  level the report sends (skillEff: the engine's skillBonusBreakdown, the level the turn casts at), for every school
 *  of every hero of the realm; with the aura the report says it counts. */
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
  // the staged world's state, hero, unit and realm's alignment, given the types the battle hands them, by assertion as
  // the staged worlds give the saved state's (dragonTamed reads the hero's realm, the unit's type and the realm's
  // discoveries; druIdPenaltyMult the unit's type and race, and takes the hero's fields as they are)
  druIdPenaltyMult(
    hero,
    unit as ArmyInABattle,
    realmOf(world, hero)['alignment'] as string | undefined,
    dragonTamed({ G: world.state } as unknown as TurnContext, hero as HeroInABattle, unit as ArmyInABattle),
  );

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
        (h: HeroInABattle, u: ArmyInABattle, a: string | null | undefined) => {
          // (the turn's context holds only the state the report was made from: the context's type by assertion, as
          // stagedWorld's state; druidMasteryGain reads only its state)
          const turn = { G: world.state } as unknown as TurnContext;
          const gain: unknown = druidMasteryGain(turn, h, u, a);
          return isObj(gain) && typeof gain['gain'] === 'number' ? Math.round(gain['gain'] * 100) : gain;
        },
        [hero.state, unit.state, alignment],
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
    // (the staged world's hero and his province, given the types the order takes, by assertion as the staged worlds
    // give the saved state's: the turn's context is made by the engine's own createTurnContext)
    resolveExploreOrder(tc as unknown as TurnContext, c as never, prov as never);
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

// ── The order form's Cast Spell tables and checks, and the army card's kin and feud (P1-11c1) ────
// Plan P1-11c's parity cases, before the form takes its tables and its check from the engine's side (P1-11c2 to c5).
// The truth, as above: the form's copy on what the realm's report holds, against the content's spells (SPELL_DEFS_P)
// or the engine's function on the state. Where the two are known to disagree (plan P1-11c, question 28 for Toby, and the
// Warlock's extra cast, Parked), the difference is pinned exactly.

/** A spell as the content's table (SPELL_DEFS_P) writes what the order form reads of it. */
interface ASpellAsTheFormReadsIt {
  readonly school: string;
  readonly target?: string;
  readonly encounter?: boolean;
  readonly phase?: boolean;
  readonly reqLevel?: number;
}
const THE_SPELLS: [string, ASpellAsTheFormReadsIt][] = Object.entries(
  SPELL_DEFS_P as Record<string, ASpellAsTheFormReadsIt>,
);
/** The spells the content's table writes as `keep` says, in its order. */
const spellsThat = (keep: (d: ASpellAsTheFormReadsIt) => boolean | undefined) =>
  THE_SPELLS.filter(([, d]) => keep(d)).map(([name]) => name);
/** The spells named, by school, each school in the order its first spell comes, its spells in the table's order. */
function bySchool(names: readonly string[]): Record<string, string[]> {
  const schools: Record<string, string[]> = {};
  for (const name of names) {
    const school = THE_SPELLS.find(([n]) => n === name)?.[1].school ?? '(no school)';
    (schools[school] ??= []).push(name);
  }
  return schools;
}

/** How a table is compared: in its order (a list the form shows in its order), as a map (each key's value, whatever the
 *  keys' order), as a set (the form only asks whether a spell is in it), or by school as sets (each school in its order,
 *  its spells whatever their order). */
type HowATableIsCompared = 'in order' | 'as a map' | 'as a set' | 'by school, as sets';
const HOW_EACH_TABLE_IS_COMPARED: Record<keyof TheOrderFormsSpellTables, HowATableIsCompared> = {
  SPELLS_BY_SCHOOL: 'in order',
  SPELL_TO_SCHOOL: 'as a map',
  SPELL_REQ_LEVEL: 'as a map',
  PHASE_SPELLS: 'in order',
  _hsPhase: 'in order',
  ENCOUNTER_VALID: 'by school, as sets',
  NEEDS_PROV: 'as a set',
  NEEDS_CHAR: 'as a set',
};
/** A table as it is compared (`how`): the keys of a map sorted, a set's spells sorted, each school's spells sorted. */
function asCompared(how: HowATableIsCompared, table: unknown): unknown {
  const sorted = (x: unknown) => (Array.isArray(x) ? x.map(String).sort() : x);
  if (how === 'in order' || !isObj(table)) return how === 'as a set' ? sorted(table) : table;
  if (how === 'as a map') return Object.fromEntries(Object.entries(table).sort(([a], [b]) => (a < b ? -1 : 1)));
  return Object.fromEntries(Object.entries(table).map(([school, spells]) => [school, sorted(spells)]));
}
/** The tables the content's spells (SPELL_DEFS_P) make of the order form's eight: every spell by school, each spell's
 *  school, the mastery spells' levels, the action spells, those offered a hero of unseen levels (an action spell with
 *  no mastery level), the combat spells by school, and the action spells aimed at a province and at a hero. */
export function theContentsSpellTables(): TheOrderFormsSpellTables {
  const everySpellBySchool = bySchool(spellsThat(() => true));
  return {
    SPELLS_BY_SCHOOL: everySpellBySchool,
    SPELL_TO_SCHOOL: Object.fromEntries(
      Object.entries(everySpellBySchool).flatMap(([school, spells]) => spells.map((name) => [name, school])),
    ),
    SPELL_REQ_LEVEL: Object.fromEntries(THE_SPELLS.flatMap(([name, d]) => (d.reqLevel ? [[name, d.reqLevel]] : []))),
    PHASE_SPELLS: spellsThat((d) => d.phase),
    _hsPhase: spellsThat((d) => d.phase && !d.reqLevel),
    ENCOUNTER_VALID: bySchool(spellsThat((d) => d.encounter)),
    NEEDS_PROV: spellsThat((d) => d.phase && d.target === 'province'),
    NEEDS_CHAR: spellsThat((d) => d.phase && d.target === 'character'),
  };
}
/** Each of the order form's eight Cast Spell tables, against the table the content's spells make of it, each compared
 *  as HOW_EACH_TABLE_IS_COMPARED says. */
export function theFormsSpellTablesAgainstTheContent(form: TheOrderFormsSpells): Comparison[] {
  const content = theContentsSpellTables();
  return Object.entries(HOW_EACH_TABLE_IS_COMPARED).map(([name, how]) => {
    const table = name as keyof TheOrderFormsSpellTables;
    return compare(`${table} (${how})`, asCompared(how, form.tables[table]), {
      answer: asCompared(how, content[table]),
      changed: false,
    });
  });
}

/** Where a spell's target field looks for the hero it is aimed at: in the caster's province only, anywhere, or at no
 *  hero (a spell aimed at a province, or at none). */
export type WhereTheFormLooks = "the caster's province" | 'anywhere' | 'no hero';
/** The report staged for the target field: realm 0's caster in province 100 with a hero of his realm there and one in
 *  province 200; and in each of the two provinces, a lone hero of realm 1, one of realm 1 leading armies, a lone
 *  wanderer, and the body of a fallen hero of realm 0 (every one of them seen, and every one a mark some spell may
 *  take). */
function aReportToAimSpellsIn(): {
  report: Obj;
  caster: Obj;
  whereEachStands: Map<string, number>;
  nameOfEach: Map<string, string>;
} {
  const HERE = 100;
  const caster: Obj = { id: 1, name: 'Ysolde Fen', player: 0, locationId: HERE, alive: true, skills: {} };
  const own: Obj[] = [caster];
  const others: Obj[] = [];
  const bodies: Obj[] = [];
  let id = 2;
  for (const where of [HERE, 200]) {
    const at = { locationId: where, locationName: `Province ${String(where)}`, alive: true };
    own.push({ ...at, id: id++, name: `Ally ${String(where)}`, player: 0, skills: {} });
    others.push({ ...at, id: id++, name: `Lone ${String(where)}`, player: 1, armies: 0, isKing: false });
    others.push({ ...at, id: id++, name: `Leader ${String(where)}`, player: 1, armies: 3, leadsArmies: true });
    others.push({ ...at, id: id++, name: `Wanderer ${String(where)}`, player: null, isWandering: true, armies: 0 });
    bodies.push({ id: id++, name: `Fallen ${String(where)}`, locationId: where, raisable: true, wasOwnHero: true });
  }
  const report: Obj = {
    characters: own,
    visibleChars: others,
    everSeenChars: others,
    knownDeadHeroes: bodies,
    allKingdoms: [
      { index: 0, name: 'Realm0' },
      { index: 1, name: 'Realm1' },
    ],
  };
  const whereEachStands = new Map(
    [...own, ...others, ...bodies].map((x) => [String(x['id']), Number(x['locationId'])]),
  );
  const nameOfEach = new Map([...own, ...others, ...bodies].map((x) => [String(x['id']), String(x['name'])]));
  return { report: deepFreeze(report), caster, whereEachStands, nameOfEach };
}
/** For each spell aimed at a hero (the content's), the heroes and bodies its target field offers on the staged report,
 *  by their names, in the field's order (the caster himself among them where the field offers him). Since P1-11c4 the
 *  field's lists that look in the caster's province ask the engine's mark check, so this pins what they offer. */
export function theHeroesEachSpellAimedAtAHeroOffers(form: TheOrderFormsSpells): Record<string, string[]> {
  const { report, caster, nameOfEach } = aReportToAimSpellsIn();
  return Object.fromEntries(
    theContentsSpellTables().NEEDS_CHAR.map((spell) => [
      spell,
      [...form.targetField(report, caster, spell).matchAll(/<option value="([^"]*)"/g)].flatMap((m) => {
        const name = nameOfEach.get(m[1] ?? '');
        return name === undefined ? [] : [name];
      }),
    ]),
  );
}
/** One spell's target field: where the form looks for its mark, against whether the engine's Cast Spell order holds
 *  that its mark must stand in the caster's province (the spells' registry's "a spell's mark must stand in the
 *  province", the check the order makes before the cast roll). */
export interface WhereTheMarkStandsComparison extends Comparison {
  readonly where: WhereTheFormLooks;
  /** The heroes the field offers but the caster himself, by their ids. */
  readonly othersOffered: string[];
}
/** For every spell of the content's table, the form's target field on the staged report (the heroes it offers, by the
 *  province each stands in) against the engine's check that its mark must stand in the caster's province. */
export function theFormsTargetsAgainstTheMarkCheck(form: TheOrderFormsSpells): WhereTheMarkStandsComparison[] {
  const { report, caster, whereEachStands } = aReportToAimSpellsIn();
  const here = caster['locationId'];
  return THE_SPELLS.map(([spell]) => {
    const offered = [...form.targetField(report, caster, spell).matchAll(/<option value="([^"]*)"/g)]
      .map((m) => m[1] ?? '')
      .filter((v) => whereEachStands.has(v));
    const where: WhereTheFormLooks = !offered.length
      ? 'no hero'
      : offered.every((v) => whereEachStands.get(v) === here)
        ? "the caster's province"
        : 'anywhere';
    return {
      ...compare(spell, where === "the caster's province", {
        answer: theMarkOfThisSpellMustStandInTheProvince(spell),
        changed: false,
      }),
      where,
      othersOffered: offered.filter((v) => v !== String(caster['id'])),
    };
  });
}

/** One cast compared: whether the form greys the spell out at its school's casting limit, and whether the engine's
 *  Cast Spell order blocks it there; with the engine's answer for the same cast in a realm without the Grand Cathedral
 *  and by a hero without the Warlock's title. */
export interface CastingLimitComparison extends Comparison {
  readonly cathedral: boolean;
  readonly warlock: boolean;
  readonly engineWithNeither: unknown;
  /** The engine's answer with neither, on the casts as the two rules leave them: under a Grand Cathedral a Bless
   *  Province is never blocked and an earlier one is not counted; for the Warlock, in his best school, one earlier cast
   *  of it is not counted (his limit one higher). */
  readonly engineAsTheTwoRulesSay: unknown;
}
/** The spells each cast and earlier cast is made of: a White spell, the White spell a Grand Cathedral frees, and a
 *  Psychic spell. */
const SPELLS_CAST = ['Holy Symbol', 'Bless Province', 'Oratory'] as const;
/** A spell's school, as the content's table writes it. */
const schoolOf = (spell: string) => THE_SPELLS.find(([n]) => n === spell)?.[1].school ?? '(no school)';
/** Every list of earlier casts of SPELLS_CAST, from none to three (the phases before the cast's). */
function earlierCasts(): string[][] {
  const lists: string[][] = [[]];
  for (let n = 1; n <= 3; n++)
    for (const list of lists.filter((l) => l.length === n - 1)) for (const s of SPELLS_CAST) lists.push([...list, s]);
  return lists;
}
/** Whether the engine's Cast Spell order (resolveCastSpellOrder, called as processOrder calls it) blocks the cast at
 *  its school's casting limit: the hero `c` (a copy, so a cast that lands and teaches him changes no other case) casts
 *  `spell` in the phase after `earlier`, his realm's orders for those phases. */
function theOrderBlocks(G: Obj, c: Obj, earlier: readonly string[], spell: string): boolean {
  const extraOf = (s: string) =>
    s === 'Bless Province' ? String(c['location']) : s === 'Oratory' ? String(c['id']) : '';
  const order = (s: string): Obj => ({ action: 'Cast Spell', target: s, extra: extraOf(s) });
  const ph = earlier.length;
  const cast = order(spell);
  G['turnOrders'] = { [String(c['id'])]: [...earlier.map(order), cast] };
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], Number(G['turn']) || 1), { KC_SEASONS, isBotRow });
  tc._currentPhase = ph;
  tc._logCtx = { charId: c['id'], phase: ph };
  const prov = objects(isObj(G['world']) ? G['world']['provinces'] : []).find((p) => p['id'] === c['location']);
  const realm = objects(G['players'])[Number(c['player'])];
  quietly(() => {
    // (the staged world's hero, his order, his province and his realm, given the types the order takes, by assertion
    // as the staged worlds give the saved state's: the turn's context is made by the engine's own createTurnContext)
    resolveCastSpellOrder(
      tc as unknown as TurnContext,
      copyOf(c) as never,
      cast as never,
      ph,
      spell,
      extraOf(spell),
      prov as never,
      realm as never,
      null,
    );
  });
  return tc.turnLog.some((l) => isObj(l['fact']) && l['fact']['kind'] === "a school's casting limit blocks a spell");
}
/** The form's casting count against the engine's: a hero of realm 0 (a Divine realm) of White Magic 1 to 5 and Psychic
 *  1 casts each of SPELLS_CAST after every list of earlier casts, in a realm with and without a Grand Cathedral, and
 *  holding the Warlock's title or not. The form greys a spell out at its school's limit (its rows' `atLimit`); the
 *  engine blocks it ("a school's casting limit blocks a spell"). */
export function castingLimitAgainstTheOrder(form: TheOrderFormsSpells): CastingLimitComparison[] {
  const { g, king, hero } = aWorldToStageIn();
  const realm = objects(g['players'])[0];
  if (!realm) throw new Error('the staged world has no realm 0');
  realm['alignment'] = 'Divine';
  realm['gdProvinceId'] = null; // a Wonder raised before Wonders were sited: always on (gdActiveFor)
  const casters = [1, 2, 3, 4, 5].map((white) => hero({ location: king['location'], skills: { white, psychic: 1 } }));
  const world = quietly(() => savedAndReported(g));
  const G = copyOf(world.state);
  const realmInG = objects(G['players'])[0] ?? {};
  const out: CastingLimitComparison[] = [];
  for (const caster of casters) {
    // (as saved, before any cast: a cast that lands may teach the hero in the state, which no later case may see)
    const saved = objects(world.state['characters']).find((x) => x['id'] === caster['id']);
    const reported = objects(world.report['characters']).find((x) => x['id'] === caster['id']);
    if (!saved || !reported) throw new Error('a staged caster is missing from the state or the report');
    const c = deepFreeze(copyOf(saved));
    for (const earlier of earlierCasts()) {
      const fields: Record<string, string> = {};
      earlier.forEach((s, ph) => {
        fields[`po-action-${String(c['id'])}-${String(ph)}`] = 'Cast Spell';
        fields[`po-target-${String(c['id'])}-${String(ph)}`] = s;
      });
      const rows = form.castSpellRows(reported, earlier.length, fields);
      for (const spell of SPELLS_CAST) {
        const row = rows.find((r) => r.spell === spell);
        const blocks = (cathedral: boolean, warlock: boolean) => {
          realmInG['discoveries'] = cathedral ? [{ id: 'gd' }] : [];
          G['_minorHolders'] = warlock ? { warlock: { charId: c['id'] } } : {};
          return theOrderBlocks(G, c, earlier, spell);
        };
        const engineWithNeither = blocks(false, false);
        const asTheTwoRulesSay = (cathedral: boolean, warlock: boolean) => {
          if (cathedral && spell === 'Bless Province') return false;
          const counted = cathedral ? earlier.filter((s) => s !== 'Bless Province') : [...earlier];
          const school = schoolOf(spell);
          const at = counted.findIndex((s) => schoolOf(s) === school);
          if (warlock && skillOf(c, school) === Math.max(...SCHOOLS.map((s) => skillOf(c, s))) && at >= 0)
            counted.splice(at, 1);
          realmInG['discoveries'] = [];
          G['_minorHolders'] = {};
          return theOrderBlocks(G, c, counted, spell);
        };
        for (const cathedral of [false, true])
          for (const warlock of [false, true])
            out.push({
              ...compare({ white: skillOf(c, 'white'), earlier, spell }, row ? row.atLimit : '(not offered)', {
                answer: cathedral || warlock ? blocks(cathedral, warlock) : engineWithNeither,
                changed: false,
              }),
              cathedral,
              warlock,
              engineWithNeither,
              engineAsTheTwoRulesSay: asTheTwoRulesSay(cathedral, warlock),
            });
      }
    }
  }
  return out;
}

/** One unit's strength on the army card compared with the battle's, and what the battle makes of the Druid its leader
 *  falls short of: its multiplier (1: none short), and its figure for the unit under the same leader trained in Druid
 *  enough to lead it. */
export interface KinComparison extends Comparison {
  readonly druidMultiplier: number;
  readonly engineWithoutTheShortfall: unknown;
}
/** The world staged for the kin and feud: realm 0 (a Good realm whose king is a Human) with a hero of every humanoid
 *  race, of Druid 0 and 1, away from the king; the king leads a unit of every type a race can raise (neither a creature
 *  nor a monster, nor an elemental) at every quality, of every race and of none. */
export function kinWorld(): World {
  const { g, king, land, hero } = aWorldToStageIn();
  const [away] = land;
  if (!away) throw new Error('the staged world has too few land provinces');
  const classes: Record<string, readonly string[]> = KC_UNIT_CLASS;
  const has = (cls: string, t: string) => (classes[cls] ?? []).includes(t);
  const raised = Object.keys(KC_UNIT_TYPE).filter(
    (t) => !has('creature', t) && !has('monster', t) && Object.keys(classes).some((cls) => has(cls, t)),
  );
  king['armies'] = raised.flatMap((type) =>
    KC_QUALITY_TIERS.flatMap((quality) =>
      [...KC_HUMANOID_RACES, null].map((race) => ({ type, quality, unitName: type, ...(race ? { race } : {}) })),
    ),
  );
  for (const race of KC_HUMANOID_RACES)
    for (const druid of [0, 1]) hero({ race, alignment: 'Good', location: away['id'], skills: { druid } });
  return quietly(() => savedAndReported(g));
}
/** The army card's strength of each unit the king leads, under each staged hero (armyCardUnitStrength, read by its
 *  statements), against the battle's (armStr, on the ground of no terrain, with nothing of the battle around it). */
export function armyCardKinAgainstTheBattle(c: Copies, world: World): KinComparison[] {
  const G = copyOf(world.state);
  G['_titleHolders'] = {};
  G['_minorHolders'] = {};
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], Number(G['turn']) || 1), { KC_SEASONS, isBotRow });
  deepFreeze(G);
  const heroes = ownHeroes({ state: G, report: world.report });
  const king = heroes.find((h) => h.report['isKing']);
  if (!king) throw new Error('the kin world has no king in its report');
  const alignment = realmOf({ state: G, report: world.report }, king.state)['alignment'];
  const multiplier = battleDruidMultiplier({ state: G, report: world.report });
  // (the staged world's hero and unit, given the types armStr takes, by assertion as battleDruidMultiplier's)
  const battle = (h: Obj, u: Obj) =>
    armStr(tc as unknown as TurnContext, u as ArmyInABattle, h as HeroInABattle, String(alignment), null, null);
  const units = objects(king.report['armies']).map((a, i) => ({ report: a, state: objects(king.state['armies'])[i] }));
  return heroes
    .filter((h) => !h.report['isKing'])
    .flatMap((h) =>
      units.flatMap((u) => {
        if (!u.state) return [];
        return [
          {
            ...compare(
              [
                u.report['type'],
                u.report['quality'],
                u.report['race'] ?? null,
                h.report['race'],
                skillOf(h.state, 'druid'),
              ],
              c.armyCardUnitStrength(u.report, h.report, world.report),
              engineOn(battle, [h.state, u.state]),
            ),
            druidMultiplier: multiplier(h.state, u.state),
            engineWithoutTheShortfall: engineOn(battle, [withSkillAt(h.state, 'druid', 5), u.state]).answer,
          },
        ];
      }),
    );
}
