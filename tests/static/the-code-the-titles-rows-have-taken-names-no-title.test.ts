// The code the titles' rows have taken names no title (B-06, T7, the rules pulled out: its Reckoning and titles
// family, B-06i to B-06r, the bots' reading of the titles included): each function (or file's top level) the family's rows have taken holds no string naming an
// Imperial Title or a minor title by its key or its name (`'duelist'`, `'The Duelist'`), whatever the code does with it
// (compared, a `case`, a lookup, a list, a map's key or value, a literal type, or in a function nested inside). It
// reads the title's row instead. Each row adds what it takes to TAKEN, which is empty until the first of them
// (B-06i). With them, the ratchet's count of the titles the engine names outside src/engine/rules/ (tools/ratchet.ts's
// titleChecksInEngine, by its helper titleChecksByFunction: a title's key or name anywhere but a literal type), so
// that count only falls: the helper counts each title planted, and none in src/engine/rules/ or a page's code.
// Not seen: a title read as a property's key (`G._minorHolders?.warlock`), and the six Imperial keys that are another
// rule's words too (`sea`, `spy`, `monster`, `beast`, `wild`, `arch`).
//
// Level 0 (static): the files' syntax trees and the titles' tables as written; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';
import { TITLE_DEFS } from '../../src/content/kingdoms-call-data.ts';
import { ROOT } from '../../tools/build.ts';
import {
  compare,
  readBaseline,
  THE_IMPERIAL_KEYS_THAT_ARE_OTHER_WORDS,
  THE_MINOR_TITLES_FILE,
  theCodeFiles,
  theMinorTitlesKeysAndNames,
  TITLE_VOCABULARY,
  titleChecksByFunction,
  titleChecksInEngine,
} from '../../tools/ratchet.ts';

/** The top level of a file: what no function holds. */
const TOP = '(top)';

/** Each function (or a file's top level) the titles' rows have taken, by its file, from the row that took it: each of
 *  the family's rows adds what it takes. */
const TAKEN: readonly (readonly [file: string, fn: string, row: string])[] = [
  [
    'src/engine/titles/reckoning.ts',
    TOP,
    "B-06i, the minor titles' rows and the skills they add to (MINOR_TITLES, SKILL_EXTRA_MINORS), to content",
  ],
  [
    'src/engine/personal-combat/speed-encounter-plans-and-combatants.ts',
    'pcCharCombatant',
    "B-06j, a hero's titles add to his skills in a fight, to the minor titles' registry (personalCombat)",
  ],
  [
    'src/engine/battle/best-commander.ts',
    'commandScore',
    "B-06k, the Strategist's Tactical, to the minor titles' registry (strength: a hero's titles add to his Tactical)",
  ],
  [
    'src/engine/battle/battles-between-heroes.ts',
    'combatVsChar',
    "B-06k, the Strategist's Tactical on each side, to the minor titles' registry (strength)",
  ],
  [
    'src/engine/battle/the-battle-between-heroes/h0-to-h2-the-set-up-the-duel-and-the-sides-to-the-front.ts',
    'theSetUpTheDuelAndTheSidesOfTheBattleBetweenHeroes',
    "B-06k, the Strategist's Tactical on each side, to the minor titles' registry (strength) (B-06bf: combatVsChar's set-up, duel and sides, moved)",
  ],
  [
    'src/engine/battle/the-battle-between-heroes/h3-both-sides-pre-battle-magic-and-army-spells.ts',
    'bothSidesPreBattleMagicAndArmySpellsInTheBattleBetweenHeroes',
    "B-06k, the Strategist's Tactical on each side, to the minor titles' registry (strength) (B-06bg: combatVsChar's magic and army spells, moved)",
  ],
  [
    'src/engine/battle/the-battle-between-heroes/h4-both-sides-archery-flak-and-breach.ts',
    'bothSidesArcheryFlakAndBreachInTheBattleBetweenHeroes',
    "B-06k, the Strategist's Tactical on each side, to the minor titles' registry (strength) (B-06bh: combatVsChar's archery, Flak and Breach, moved)",
  ],
  [
    'src/engine/battle/battles-against-province-defenders.ts',
    'combatVsNPC',
    "B-06k, the Strategist's Tactical on each side, to the minor titles' registry (strength)",
  ],
  [
    'src/engine/battle/the-battle-against-the-defenders/n0-to-n2-the-set-up-the-duel-and-the-sides-to-the-home-ground.ts',
    'theSetUpTheDuelAndTheSidesOfTheBattleAgainstTheDefenders',
    "B-06k, the Strategist's Tactical on each side, to the minor titles' registry (strength) (B-06az: combatVsNPC's set-up, duel and sides, moved)",
  ],
  [
    'src/engine/battle/the-battle-against-the-defenders/n3-to-n4-the-attackers-pre-battle-magic-army-spells-archery-flak-and-breach.ts',
    'theAttackersPreBattlePhasesInTheBattleAgainstTheDefenders',
    "B-06k, the Strategist's Tactical on each side, to the minor titles' registry (strength) (B-06ba: combatVsNPC's attacker's pre-battle phases, moved)",
  ],
  [
    'src/engine/battle/the-battle-against-the-defenders/n5-to-n7-the-defenders-pre-battle-magic-archery-and-army-spells.ts',
    'theDefendersPreBattlePhasesInTheBattleAgainstTheDefenders',
    "B-06k, the Strategist's Tactical on each side, to the minor titles' registry (strength) (B-06bb: combatVsNPC's defenders' pre-battle phases, moved)",
  ],
  [
    'src/engine/battle/the-battle-against-the-defenders/n8-to-n10-the-grounds-notes-the-lines-fortune-and-the-result.ts',
    'theGroundsNotesTheLinesTheFortuneAndTheResultOfTheBattleAgainstTheDefenders',
    "B-06k, the Strategist's Tactical on each side, to the minor titles' registry (strength) (B-06bc: combatVsNPC's lines, fortune and result, moved)",
  ],
  [
    'src/engine/battle/the-battle-against-the-defenders/n11-to-n13-the-casualties-the-rout-and-the-end.ts',
    'theCasualtiesTheRoutAndTheEndOfTheBattleAgainstTheDefenders',
    "B-06k, the Strategist's Tactical on each side, to the minor titles' registry (strength) (B-06bd: combatVsNPC's casualties, rout and end, moved)",
  ],
  [
    'src/engine/battle/terrain-and-unit-strength.ts',
    'armStr',
    "B-06k, the ladder's words for the commander's minor titles' army perks, by the perk his title's row names",
  ],
  [
    'src/engine/rules-on-plain-values/the-quality-a-commanders-druid-8-or-necromancy-6-lifts-a-unit-to-and-the-minor-titles-army-perks.ts',
    'theStrengthAUnitsCommandersMinorTitlesLiftItTo',
    "B-06k, the army perks, to their rows and the minor titles' registry (strength: the commander's minor titles)",
  ],
  [
    'src/engine/units/movement-pools.ts',
    'computeMovePoolMax',
    "B-06l, the Swift's and the Sea-Wolf's move points, to the minor titles' registry (movementCost)",
  ],
  [
    'src/engine/orders/espionage-orders-spy-steal-sabotage-grand-heist-assassinate-and-vanish.ts',
    'resolveSpyOrder',
    "B-06l, the Shadow's unseen spying, both places, to the minor titles' registry (orderOutcome)",
  ],
  [
    'src/engine/orders/research-and-practice-orders-discoveries-skill-drills-and-rest.ts',
    'resolveResearchOrder',
    "B-06l, the Loreseeker's level of Sage, to the minor titles' registry (orderOutcome)",
  ],
  [
    'src/engine/orders/research-and-practice-orders-discoveries-skill-drills-and-rest.ts',
    'resolveRestOrder',
    "B-06l, the Colossus's hit points, to the minor titles' registry (orderOutcome)",
  ],
  [
    'src/engine/orders/explore-and-search-orders-maps-lairs-rites-and-rumours.ts',
    'resolveExploreOrder',
    "B-06l, the Trailblazer's factor, to the minor titles' registry (orderOutcome)",
  ],
  [
    'src/engine/orders/cast-spell-order-white-psychic-illusory-elemental-and-necromancy-spells.ts',
    'resolveCastSpellOrder',
    "B-06l, the Warlock's cast, to the minor titles' registry (orderValidity)",
  ],
  [
    'src/engine/turn/early-winter-charms-fade-taxes-wages-raiders-muster-and-garrison-drill.ts',
    'earlyWinterCharmsFadeTaxesWagesRaidersMusterAndGarrisonDrill',
    "B-06m, the titles' gold and the Host-Leader's cut, to the minor titles' registry (turnEnd)",
  ],
  [
    'src/engine/titles/reckoning.ts',
    '_charTitleMerit',
    "B-06n, each Imperial Title's measure of a hero, from its row (TITLE_DEFS' howTheHolderIsFound)",
  ],
  [
    'src/engine/titles/reckoning.ts',
    'computeStandings',
    "B-06n, the Throne's and the Vaultkeeper's figures, from their rows (TITLE_DEFS' howTheHolderIsFound)",
  ],
  [
    'src/engine/titles/reckoning.ts',
    'titleRaceFor',
    "B-06n, the Throne's and the Vaultkeeper's figures, from their rows (TITLE_DEFS' howTheHolderIsFound)",
  ],
  [
    'src/engine/titles/title-holders-and-battle-merit.ts',
    'creditBattle',
    "B-06n, the Grand Marshal's and the Sea Lord's battle merit, from their rows (theBattlesItsDeedsCount)",
  ],
  [
    'src/engine/titles/title-intel-for-each-holder-and-the-titles-won-and-lost-this-turn.ts',
    'imperialTitleIntelEachHoldersReportOnRivalRealmsAndTheLoremastersCopy',
    "B-06o and B-06p, each title's board, to the Imperial Titles' registry (turnEnd)",
  ],
  [
    'src/engine/bots/spellcraft.ts',
    'botTargetTitles',
    "B-06r, the titles a bot realm chases by training, by what each row measures, and their worth, to the bots' weights",
  ],
  [
    'src/engine/bots/spellcraft.ts',
    'botTitleFocusSkill',
    'B-06r, the skills the bots train towards each title, by what its row measures',
  ],
  [
    'src/engine/bots/spellcraft.ts',
    TOP,
    "B-06r, the bots' ways of training towards a title and the deeds each specialist's work earns, by the rows' measures",
  ],
  [
    'src/engine/bots/specialists.ts',
    'botSpecialistRoles',
    "B-06r, a chased title's specialist, the role whose work earns its row's deeds",
  ],
  [
    'src/engine/bots/economy.ts',
    'botCastLimit',
    "B-06r, the Warlock's cast (read by his holders' key before), to the minor titles' registry (orderValidity)",
  ],
];

/** A function's or a method's declaration, or a variable's arrow or function, and its name (as the ratchet's helper
 *  finds a function). */
function aFunctionsName(node: ts.Node): string | null {
  if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) return node.name.getText();
  return ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer !== undefined &&
    (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ? node.name.text
    : null;
}

/** In the function named (or the file's top level, outside every named function): every string naming a title, in the
 *  order written, a literal type's too (a function nested inside with no name counts); null if the file doesn't
 *  declare the function. */
function everyTitleIn(file: string, text: string, fn: string): string[] | null {
  let found: string[] | null = fn === TOP ? [] : null;
  const collect = (node: ts.Node, into: string[], atTheTop: boolean): void => {
    if (atTheTop && aFunctionsName(node) !== null) return;
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && TITLE_VOCABULARY.has(node.text))
      into.push(node.text);
    ts.forEachChild(node, (child) => {
      collect(child, into, atTheTop);
    });
  };
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  if (found) {
    collect(source, found, true);
    return found;
  }
  const visit = (node: ts.Node): void => {
    if (aFunctionsName(node) === fn) {
      found ??= [];
      collect(node, found, false);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

test.for(TAKEN)('%s: %s names no title (%s)', ([file, fn]) => {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const counts = titleChecksByFunction(file, text);
  expect(fn === TOP || counts.has(fn), `${file} declares ${fn}`).toBe(true);
  expect(counts.get(fn) ?? 0, `${fn}'s names of a title (the ratchet's helper)`).toBe(0);
  expect(everyTitleIn(file, text, fn), `every string in ${fn} naming a title`).toEqual([]);
});

// The words are the tables' own: every key and name of TITLE_DEFS and of MINOR_TITLES (read from its syntax tree), the
// six keys that are other words aside, and nothing written by hand.
test("the vocabulary is every title's key and name in the two tables, less the six keys that are other words", () => {
  const minor = theMinorTitlesKeysAndNames(fs.readFileSync(path.join(ROOT, THE_MINOR_TITLES_FILE), 'utf8'));
  expect(minor.length, 'a key and a name for each minor title').toBe(40);
  expect(minor.slice(0, 2)).toEqual(['duelist', 'The Duelist']);
  const imperial = TITLE_DEFS.flatMap((t): string[] => [t.key, t.name]);
  expect(imperial.length, 'a key and a name for each of the thirteen Imperial Titles').toBe(26);
  expect([...THE_IMPERIAL_KEYS_THAT_ARE_OTHER_WORDS].filter((k) => !imperial.includes(k))).toEqual([]);
  expect([...TITLE_VOCABULARY]).toEqual(
    [...imperial, ...minor].filter((w) => !THE_IMPERIAL_KEYS_THAT_ARE_OTHER_WORDS.has(w)),
  );
  expect(TITLE_VOCABULARY.size).toBe(60);
});

test("the minor titles' reader reads a list behind `satisfies` (and `as const`), and refuses a file without one", () => {
  const planted = `export const MINOR_TITLES = [
    { key: 'a', name: 'The A', perk: 'p', metric: (c) => c },
    { key: 'b', name: "The B's" },
  ] satisfies readonly unknown[];`;
  expect(theMinorTitlesKeysAndNames(planted)).toEqual(['a', 'The A', 'b', "The B's"]);
  expect(
    theMinorTitlesKeysAndNames(
      `export const MINOR_TITLES = [{ key: 'a', name: 'The A', howTheHolderIsFound: { theMeasure: 'm' } }] as const satisfies readonly unknown[];`,
    ),
  ).toEqual(['a', 'The A']);
  expect(() => theMinorTitlesKeysAndNames('export const OTHER = [];')).toThrow(/no "const MINOR_TITLES/);
});

// The helper finds what it counts: each form of a title planted in one function of the engine (an arrow with no name
// inside it counts for it, a named one for itself; one outside every function for the top level), and none of what
// isn't a title's key or name, or is a literal type, or is one of the six keys left out.
test("the ratchet's helper counts each title's key and name, a literal type's aside", () => {
  const planted = `
    type Key = 'duelist' | 'warlock';
    const TABLE = { 'swift': 1, x: 'The Throne' };
    export function planted(h: { titles: string[] }, key: string) {
      const a = (key === 'cutpurse') + h.titles.includes('The Sea-Wolf') + ['hostleader'].length;
      switch (key) { case 'throne': break; }
      const t = { key: \`lore\` };
      const inside = [h].some(() => key !== 'The Cartographer');
      const notTitles = 'Duelist' + 'the throne' + 'sea' + 'spy' + 'wild' + 'arch' + 'beast' + 'monster';
      return a + t.key + inside + notTitles;
    }
    const nested = function named() { return 'champion'; };`;
  expect(Object.fromEntries(titleChecksByFunction('src/engine/planted.ts', planted))).toEqual({
    [TOP]: 2,
    planted: 6,
    nested: 1,
  });
});

test('every string naming a title in a function, or at the top level, is found', () => {
  const planted = `
    type Key = 'duelist';
    const before = 'The Throne';
    export function planted(h) {
      const a = holds(h, 'cutpurse') + [\`seawolf\`].length + (h.key === 'swift');
      const inside = () => 'The Warlock', notATitle = 'warlocks' || 'sea';
      return a + inside() + notATitle;
    }
    const after = 'vault';`;
  expect(everyTitleIn('planted.ts', planted, 'planted')).toEqual(['cutpurse', 'seawolf', 'swift', 'The Warlock']);
  expect(everyTitleIn('planted.ts', planted, TOP)).toEqual(['duelist', 'The Throne', 'vault']);
  expect(everyTitleIn('planted.ts', planted, 'absent')).toBeNull();
});

// A title planted in a file of src/engine/ (the bots' included) raises titleChecksInEngine by one, and the ratchet
// fails on it; one in src/engine/rules/ or in a page's code isn't counted.
test.for([
  ['src/engine/battle/x.ts', 1],
  ['src/engine/bots/x.ts', 1],
  ['src/engine/rules/x.ts', 0],
  ['src/ui/player/x.ts', 0],
] as const)('a title planted in %s raises titleChecksInEngine by %i', ([file, rise]) => {
  const files = theCodeFiles();
  const asTheyAre = { ...readBaseline(), titleChecksInEngine: titleChecksInEngine(files) };
  expect(asTheyAre.titleChecksInEngine).toBe(readBaseline()['titleChecksInEngine']);
  const planted = {
    ...asTheyAre,
    titleChecksInEngine: titleChecksInEngine([
      ...files,
      [file, "export const planted = (key: string): boolean => key === 'trailblazer';\n"],
    ]),
  };
  expect(planted.titleChecksInEngine).toBe(asTheyAre.titleChecksInEngine + rise);
  const { rose } = compare(asTheyAre, planted);
  expect(rose).toHaveLength(rise);
  expect(rose.filter((r) => /^titleChecksInEngine rose from \d+ to \d+\./.test(r))).toEqual(rose);
});
