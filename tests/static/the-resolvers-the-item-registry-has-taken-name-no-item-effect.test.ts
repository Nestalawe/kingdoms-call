// The resolvers the items' registry has taken name no item effect (plan P1-19's items family, Decision 6 and Choice
// 4): each function the registry's rows have taken holds no string naming an item's effect key (a `stat` that isn't a
// skill, a `use`, a `ward` or a rider's `ward`) or an item (its name or a second name), read from the content's tables
// with Mithril Armour added, whatever the code does with it (compared, switched on, passed to a helper, held in a list,
// or in a function nested inside: but the words listed with what else each is there, and the checks listed with the
// step each is left to); and it reads none of the six effects an item carries on itself, beside its
// `effect` (`fleetStr`, `landFullAtSea`, `emberTwo`, `exploreMove`, `primalStrike`, `drumTierUp`), which no string
// names, but the reads listed with the step each is left to. Its
// effects find what an item carries by the key the content's row gives, in src/engine/rules/. Each row of the family
// adds the functions it takes. With them, the ratchet's count of the engine's checks of an item outside the registry
// (tools/ratchet.ts's itemEffectChecksInEngine, by its helper itemEffectChecksByFunction: a string of the vocabulary
// compared with an item's key or name, switched on, or passed to hasItemBase, has or itemStat), so that count only
// falls: the helper counts each such check planted, and none in src/engine/rules/ or a page's code.
//
// Red on its row's base by design (armStr held 9 checks, and read `fleetStr` and `landFullAtSea`, on P1-19m's base; the
// two battles' functions 8, and pursuitsOfTheBeaten 1, on P1-19n's; Early Winter 2 and the orders' and the bots' plan
// 5, and resolveMoveOrder's read of `exploreMove`, on P1-19o's; itemMaxHpBonus, applyItemMaxHp, effTemper and
// skillBonusBreakdown 1 each, and skillBonusBreakdown's 'Crown of Command', on P1-19p's), as the unit-name test was: the one exception to refactor-only's rule that new tests pass before and after (Theo,
// 2026-10-25; the items family's Decision 6, "red on its row's base by design").
// Level 0 (static): the files' syntax trees and the content's tables as written; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import {
  compare,
  ITEM_EFFECT_VOCABULARY,
  itemEffectChecksByFunction,
  itemEffectChecksInEngine,
  readBaseline,
  theCodeFiles,
} from '../../tools/ratchet.ts';

/** Each function the items' registry has taken, by its file, from the row that took it. */
const TAKEN: readonly (readonly [file: string, fn: string, row: string])[] = [
  ['src/engine/battle/terrain-and-unit-strength.ts', 'armStr', "P1-19m, the commander's items"],
  ['src/engine/battle/battles-between-heroes.ts', 'combatVsChar', "P1-19n, the battles' items"],
  ['src/engine/battle/battles-between-heroes.ts', 'applyPreBattleArchery', "P1-19n, the battles' items"],
  ['src/engine/battle/battles-against-province-defenders.ts', 'combatVsNPC', "P1-19n, the battles' items"],
  ['src/engine/units/movement.ts', 'pursuitsOfTheBeaten', "P1-19n, the battles' items"],
  [
    'src/engine/turn/early-winter-charms-fade-taxes-wages-raiders-muster-and-garrison-drill.ts',
    'earlyWinterCharmsFadeTaxesWagesRaidersMusterAndGarrisonDrill',
    "P1-19o, the turn's items",
  ],
  [
    'src/engine/orders/espionage-orders-spy-steal-sabotage-grand-heist-assassinate-and-vanish.ts',
    'resolveSpyOrder',
    "P1-19o, the orders' items",
  ],
  [
    'src/engine/orders/explore-and-search-orders-maps-lairs-rites-and-rumours.ts',
    'resolveExploreOrder',
    "P1-19o, the orders' items",
  ],
  [
    'src/engine/orders/research-and-practice-orders-discoveries-skill-drills-and-rest.ts',
    'resolveRestOrder',
    "P1-19o, the orders' items",
  ],
  [
    'src/engine/orders/move-order-marches-voyages-and-battles-on-arrival.ts',
    'resolveMoveOrder',
    "P1-19o, the orders' items",
  ],
  [
    'src/engine/orders/item-orders-equip-use-and-send-magic-items.ts',
    'resolveUseItemOrder',
    "P1-19o, the orders' items",
  ],
  ['src/engine/bots/missions.ts', 'botItemPre', "P1-19o, the orders' items"],
  ['src/engine/heroes/skills-and-hp.ts', 'itemMaxHpBonus', "P1-19p, a hero's standing"],
  ['src/engine/personal-combat/helpers.ts', 'applyItemMaxHp', "P1-19p, a hero's standing"],
  ['src/engine/items/equipment.ts', 'effTemper', "P1-19p, a hero's standing"],
  ['src/engine/heroes/skills-and-hp.ts', 'skillBonusBreakdown', "P1-19p, a hero's standing"],
];

/** The words of the vocabulary a taken function holds for something else, by the function, each with what it is (the
 *  effect keys are common words: a combat item's `use` 'terror' is also the ladder's reason for an Evil realm's Terror).
 *  Each is matched in the function's own list, so a second one, or one gone, turns the test red. */
const WORDS_FOR_SOMETHING_ELSE: Readonly<Record<string, readonly string[]>> = {
  // the ladder's reason for an Evil realm's Terror ({ kind: 'terror', multiplier }), not the combat item's use
  armStr: ['terror'],
  // an Evil realm's doctrine after a decisive win, `(encounterPlan.evilMode || 'terror') === 'terror'`, not the use
  combatVsChar: ['terror', 'terror'],
  combatVsNPC: ['terror', 'terror'],
  // the kind of source the portals colour a skill's bonus by ({ kind: 'aura' }), not the Crown of Command's key
  skillBonusBreakdown: ['aura'],
};

/** The reads of an item's own field a taken function still holds, by the function, each left to a later step (the
 *  items family's Decisions don't take them): matched with the words above, so one more, or one gone, turns it red. */
const READS_LEFT_TO_A_LATER_STEP: Readonly<Record<string, readonly string[]>> = {
  // `.drumTierUp`: the War Drum's chance to lift a unit a tier, which no row of the items family takes (Parked "The War
  // Drum's tier-up is an item effect no row of P1-19's items family takes", found by P1-19n); `.emberTwo`: the Ember
  // Rune's second Fireball, with the spells family (the items family's Decision 5)
  combatVsChar: ['.drumTierUp', '.emberTwo'],
  combatVsNPC: ['.drumTierUp', '.emberTwo'],
};

/** The checks of an item's effect a taken function still holds, by the function, each left to a later step (the items
 *  family's Decisions don't take them): the ratchet's helper counts exactly these, and their words are matched with
 *  the words above, so one more, or one gone, turns it red. */
const CHECKS_LEFT_TO_A_LATER_STEP: Readonly<Record<string, readonly string[]>> = {
  // `'hidden'`: an older save's Cloak of Many Faces, which a spy can't fix on, with P1-23's `visibility` (the items
  // family's Decision 5)
  resolveSpyOrder: ['hidden'],
};

/** The effects an item carries on itself, beside its `effect` (Parked: one key per effect, later). */
const AN_ITEMS_OWN_FIELDS: ReadonlySet<string> = new Set([
  'fleetStr',
  'landFullAtSea',
  'emberTwo',
  'exploreMove',
  'primalStrike',
  'drumTierUp',
]);

/** Whether a node declares the function named (as the ratchet's helper finds a function). */
function declares(node: ts.Node, fn: string): boolean {
  if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) return node.name.getText() === fn;
  return (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === fn &&
    node.initializer !== undefined &&
    (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
  );
}

/** In the function named: every string naming an item's effect key or an item, whatever the code does with it, and
 *  every read of a field an item carries an effect on (`.fleetStr`, `['fleetStr']`), in the order written; null if
 *  the file doesn't declare the function. */
function everyItemWordIn(file: string, text: string, fn: string): string[] | null {
  let found: string[] | null = null;
  const collect = (node: ts.Node, into: string[]): void => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && ITEM_EFFECT_VOCABULARY.has(node.text))
      into.push(node.text);
    if (ts.isPropertyAccessExpression(node) && AN_ITEMS_OWN_FIELDS.has(node.name.text)) into.push(`.${node.name.text}`);
    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteral(node.argumentExpression) &&
      AN_ITEMS_OWN_FIELDS.has(node.argumentExpression.text)
    )
      into.push(`['${node.argumentExpression.text}']`);
    ts.forEachChild(node, (child) => {
      collect(child, into);
    });
  };
  const visit = (node: ts.Node): void => {
    if (declares(node, fn)) {
      found ??= [];
      collect(node, found);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true));
  return found;
}

test.for(TAKEN)('%s: %s names no item effect (%s)', ([file, fn]) => {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const counts = itemEffectChecksByFunction(file, text);
  expect(counts.has(fn), `${file} declares ${fn}`).toBe(true);
  const left = CHECKS_LEFT_TO_A_LATER_STEP[fn] ?? [];
  expect(counts.get(fn), `${fn}'s checks of an item's effect or an item (the ratchet's helper)`).toBe(left.length);
  expect(
    [...(everyItemWordIn(file, text, fn) ?? [])].sort(),
    `every string in ${fn} naming an item's effect or an item, and every read of an item's own field`,
  ).toEqual([...(WORDS_FOR_SOMETHING_ELSE[fn] ?? []), ...(READS_LEFT_TO_A_LATER_STEP[fn] ?? []), ...left].sort());
});

test("the vocabulary holds the content's effect keys and item names, no skill, and Mithril Armour", () => {
  for (const word of ['cavBonus', 'heal', 'meleeDR', 'thorns', 'Golden Spur', "Tide-Lord's Glass"])
    expect(ITEM_EFFECT_VOCABULARY.has(word), word).toBe(true);
  for (const word of ['mithrilArmour', 'Mithril Armour']) expect(ITEM_EFFECT_VOCABULARY.has(word), word).toBe(true);
  for (const word of ['naval', 'melee', 'white', 'Average', 'Divine', 'sea'])
    expect(ITEM_EFFECT_VOCABULARY.has(word), word).toBe(false);
});

// The helper finds what it counts: each kind of check planted in one function (an arrow with no name inside it counts
// for it, a named one for itself), and none of the strings that aren't a check or aren't in the vocabulary.
test("the ratchet's helper counts each check of an item's effect or an item, and nothing else", () => {
  const planted = `
    export function planted(it, ch, st) {
      if (it.effect.stat === 'cavBonus' || 'heal' !== e.use || it.ward == 'meleeDR' || st != 'armyBonus') return 1;
      switch (it.effect.use) { case 'stun': return 2; }
      if (it.name === 'Golden Spur' || (_ITEM_ALT_BASE[it.name] || it.name) === 'Chalice of Dawn') return 3;
      const x = hasItemBase(ch, "Admiral's Spyglass") + has('undeadBonus') + itemStat(ch, 'taxBonus');
      const inside = [it].some((i) => i.effect.stat === 'heavyBonus'), nested = () => it.use === 'drain';
      const notChecks = ['infBonus', 'Black Sceptre'], label = 'archerStr', other = it.kind === 'cavBonus';
      const notAWord = it.effect.stat === 'naval' || it.name === 'Testblade' || other || label || notChecks;
      return x + inside + nested() + notAWord;
    }
    const nestedNamed = function named() { return it.effect.stat === 'navalBonus'; };`;
  expect(Object.fromEntries(itemEffectChecksByFunction('planted.ts', planted))).toEqual({
    planted: 11,
    nested: 1,
    nestedNamed: 1,
  });
});

test('every string naming an item effect or an item, and every read of an item field of its own, is found', () => {
  const planted = `
    const before = 'cavBonus';
    export function planted(ch, it) {
      const a = helper(ch, 'Golden Spur') + [\`armyBonus\`].length + it.fleetStr + it['landFullAtSea'];
      const inside = () => 'heal', notAWord = it.effect.stat === 'naval' || it.fleet || 'Testblade';
      return a + inside() + notAWord;
    }
    const after = 'infBonus';`;
  expect(everyItemWordIn('planted.ts', planted, 'planted')).toEqual([
    'Golden Spur',
    'armyBonus',
    '.fleetStr',
    "['landFullAtSea']",
    'heal',
  ]);
  expect(everyItemWordIn('planted.ts', planted, 'absent')).toBeNull();
});

// A check planted in a file of src/engine/ raises itemEffectChecksInEngine by one, and the ratchet fails on it; one in
// src/engine/rules/ (the registries' effects, which find an item's effect by its row's key) or in a page's code isn't
// counted.
test.for([
  ['src/engine/battle/x.ts', 1],
  ['src/engine/rules/x.ts', 0],
  ['src/ui/gm/x.ts', 0],
] as const)('an item-effect check planted in %s raises itemEffectChecksInEngine by %i', ([file, rise]) => {
  const files = theCodeFiles();
  const asTheyAre = { ...readBaseline(), itemEffectChecksInEngine: itemEffectChecksInEngine(files) };
  expect(asTheyAre.itemEffectChecksInEngine).toBe(readBaseline()['itemEffectChecksInEngine']);
  const planted = {
    ...asTheyAre,
    itemEffectChecksInEngine: itemEffectChecksInEngine([
      ...files,
      [file, "export const planted = (it: { effect: { stat: string } }): boolean => it.effect.stat === 'cavBonus';\n"],
    ]),
  };
  expect(planted.itemEffectChecksInEngine).toBe(asTheyAre.itemEffectChecksInEngine + rise);
  const { rose } = compare(asTheyAre, planted);
  expect(rose).toHaveLength(rise);
  expect(rose.filter((r) => /^itemEffectChecksInEngine rose from \d+ to \d+\./.test(r))).toEqual(rose);
});
