// The resolvers the items' registry has taken name no item effect (plan P1-19's items family, Decision 6 and Choice
// 4): each function the registry's rows have taken holds no string naming an item's effect key (a `stat` that isn't a
// skill, a `use`, a `ward` or a rider's `ward`) or an item (its name or a second name), read from the content's tables
// with Mithril Armour added, whatever the code does with it (compared, switched on, passed to a helper, held in a list,
// or in a function nested inside: but the words listed with what else each is there, and the checks listed with the
// step each is left to); and it reads none of the six effects an item carries on itself, beside its
// `effect` (`fleetStr`, `landFullAtSea`, `emberTwo`, `exploreMove`, `primalStrike`, `drumTierUp`), which no string
// names, but the reads listed with the step each is left to; and, from P1-19r, it uses no field of the wards a fighter
// wears (`x.arm.meleeDR`, `x.arm?.dodge`, or through a name bound to `x.arm` in the function: the table pcArmourMerge
// builds, whose names alone are the lines'), but a guardian's perks' own wards (stunWard, dotWard, schoolWard), listed
// with the step each is left to; nor does any other function of src/engine/ outside rules/, but the guardian's build,
// listed. Its
// effects find what an item carries by the key the content's row gives, in src/engine/rules/. Each row of the family
// adds the functions it takes. With them, the ratchet's count of the engine's checks of an item outside the registry
// (tools/ratchet.ts's itemEffectChecksInEngine, by its helper itemEffectChecksByFunction: a string of the vocabulary
// compared with an item's key or name, switched on, or passed to hasItemBase, has or itemStat), so that count only
// falls: the helper counts each such check planted, and none in src/engine/rules/ or a page's code.
//
// Red on its row's base by design (armStr held 9 checks, and read `fleetStr` and `landFullAtSea`, on P1-19m's base; the
// two battles' functions 8, and pursuitsOfTheBeaten 1, on P1-19n's; Early Winter 2 and the orders' and the bots' plan
// 5, and resolveMoveOrder's read of `exploreMove`, on P1-19o's; itemMaxHpBonus, applyItemMaxHp, effTemper and
// skillBonusBreakdown 1 each, and skillBonusBreakdown's 'Crown of Command', on P1-19p's; pcArmourMerge 21, pcArmourOf
// 1 and pcCharCombatant's Mithril 1 on P1-19q's; the uses of a ward's field, 57 in eight functions, 50 of an item's
// ward, and pcMeleeStrike's 'thorns', pcTakeHit's 5 and pcRoundStart's 'regen', on P1-19r's; pcCombatItemWanted 19,
// pcUseCombatItem 19, pcAct 1, pcMeleeDamage 1, pcBuildGuardian 4 and pcCharCombatant's 'combatUse' 1 on P1-19s's;
// _useScore 20, itemPowerScore 8, itemSlot 2, plain 1, tiers-and-hoards.ts' copy pass 1, and the 7 item effects in
// ITEM_COMBAT_STATS, on P1-19t's; primalStrikeItemBonus 1, and its read of `primalStrike`, on P1-19v's; pcCastCombatSpell's
// Dreamstone and Death's Finger Ring, left to the spells family until then, on P1-19w's; resolvePersonalCombat's
// Mirror Shard, likewise, on P1-19x's), as the unit-name test was: the one exception to refactor-only's rule
// that new tests pass before and after (Theo,
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
  ['src/engine/personal-combat/helpers.ts', 'pcArmourMerge', 'P1-19q, what a fighter wears'],
  ['src/engine/personal-combat/helpers.ts', 'pcArmourOf', 'P1-19q, what a fighter wears'],
  ['src/engine/personal-combat/speed-encounter-plans-and-combatants.ts', 'pcApplyFx', 'P1-19q, what a fighter wears'],
  [
    'src/engine/personal-combat/speed-encounter-plans-and-combatants.ts',
    'pcApplyItemFx',
    'P1-19q, what a fighter wears',
  ],
  [
    'src/engine/personal-combat/speed-encounter-plans-and-combatants.ts',
    'pcCharCombatant',
    'P1-19q, what a fighter wears',
  ],
  ['src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts', 'pcHitChance', 'P1-19r, what a ward does'],
  ['src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts', 'pcStunWard', 'P1-19r, what a ward does'],
  ['src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts', 'pcTakeHit', 'P1-19r, what a ward does'],
  ['src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts', 'pcRoundStart', 'P1-19r, what a ward does'],
  ['src/engine/personal-combat/melee-flight-and-archery.ts', 'pcMeleeStrike', 'P1-19r, what a ward does'],
  ['src/engine/personal-combat/melee-flight-and-archery.ts', 'pcArrowHitChance', 'P1-19r, what a ward does'],
  [
    'src/engine/personal-combat/combat-spells-and-guardian-abilities.ts',
    'pcCastCombatSpell',
    'P1-19r, what a ward does',
  ],
  [
    'src/engine/personal-combat/combat-spells-and-guardian-abilities.ts',
    'pcMonsterSpecial',
    'P1-19r, what a ward does',
  ],
  ['src/engine/personal-combat/tactics-combat-items-and-actions.ts', 'pcCombatItemWanted', 'P1-19s, the combat items'],
  ['src/engine/personal-combat/tactics-combat-items-and-actions.ts', 'pcTryCombatItem', 'P1-19s, the combat items'],
  ['src/engine/personal-combat/tactics-combat-items-and-actions.ts', 'pcUseCombatItem', 'P1-19s, the combat items'],
  ['src/engine/personal-combat/tactics-combat-items-and-actions.ts', 'pcAct', "P1-19s, the Lock-Pick's steal"],
  [
    'src/engine/personal-combat/resolve-personal-combat.ts',
    'resolvePersonalCombat',
    "P1-19x, the Mirror Shard's half (with the spells family)",
  ],
  [
    'src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts',
    'pcMeleeDamage',
    "P1-19s, the Warbringer Gauntlets' blow",
  ],
  ['src/engine/personal-combat/lair-guardians-and-the-odds.ts', 'pcBuildGuardian', "P1-19s, a guardian's hoard"],
  ['src/engine/items/equipment.ts', 'itemRole', "P1-19t, the treasury: an item's role"],
  ['src/engine/items/equipment.ts', 'itemPowerScore', "P1-19t, the treasury: an item's worth"],
  ['src/engine/items/equipment.ts', '_useScore', "P1-19t, the treasury: a combat use's worth"],
  ['src/engine/items/equipment.ts', '_wardScore', "P1-19t, the treasury: a ward's worth"],
  ['src/engine/items/equipment.ts', '_pcScore', "P1-19t, the treasury: a rider's worth"],
  ['src/engine/items/equipment.ts', 'plain', 'P1-19t, the treasury: the seeds of a minted item'],
  [
    'src/engine/rules-on-plain-values/items-slots-races-and-who-may-use-them.ts',
    'itemSlot',
    "P1-19t, the treasury: a combat item's and the Mithril suit's slot",
  ],
  ['src/engine/chances-and-lair-grades.ts', 'primalStrikeItemBonus', "P1-19v, the totems' bonus to a strike"],
];

/** The passes that build the treasury as the engine loads, each a named function run at once (`(function name()
 *  {…})()`), which the ratchet's helper counts at the top of its file, by the file: the registry has taken them. */
const TAKEN_PASSES: readonly (readonly [file: string, fn: string, row: string])[] = [
  ['src/engine/items/tiers-and-hoards.ts', '_tripleLowerTierItems', "P1-19t, the treasury: a combat item isn't copied"],
];

/** The sets of stats itemRole reads, each by its file: the skills' alone (an item effect's role is the registry's). */
const THE_SETS_OF_STATS_ITEM_ROLE_READS: readonly (readonly [file: string, name: string])[] = [
  ['src/engine/items/equipment.ts', 'ITEM_COMBAT_STATS'],
  ['src/engine/items/equipment.ts', 'ITEM_DUEL_SCHOOLS'],
  ['src/engine/items/equipment.ts', 'ITEM_FIELD_SCHOOLS'],
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
  // the key a guardian's perk is named by in the drain's line (`_perkName.drain`), not a check of an item: what a
  // drain rider does in the fight (`actor.drain`, a field of his riders) no row of the items family takes (Parked
  // "What an item's riders do in a personal combat is read inline: no row of P1-19's items family takes it")
  pcMeleeStrike: ['drain'],
  // the armour slot the Mithril suit is worn in (`return 'armour'`), not an armour's stat
  itemSlot: ['armour'],
  // the reason a fighter flees, his temper's panic (`pcAttemptFlee(…, 'temper')`), not a temper item's stat
  resolvePersonalCombat: ['temper'],
};

/** The reads of an item's own field a taken function still holds, by the function, each left to a later step (the
 *  items family's Decisions don't take them): matched with the words above, so one more, or one gone, turns it red. */
const READS_LEFT_TO_A_LATER_STEP: Readonly<Record<string, readonly string[]>> = {
  // `.drumTierUp`: the War Drum's chance to lift a unit a tier, which no row of the items family takes (Parked "The War
  // Drum's tier-up is an item effect no row of P1-19's items family takes", found by P1-19n). The Ember Rune's
  // `.emberTwo` went with the spells family's first row (P1-19u: "strength: a hero's items change his battle spell")
  combatVsChar: ['.drumTierUp'],
  combatVsNPC: ['.drumTierUp'],
};

/** The checks of an item's effect a taken function still holds, by the function, each left to a later step (the items
 *  family's Decisions don't take them): the ratchet's helper counts exactly these, and their words are matched with
 *  the words above, so one more, or one gone, turns it red. */
const CHECKS_LEFT_TO_A_LATER_STEP: Readonly<Record<string, readonly string[]>> = {
  // `'hidden'`: an older save's Cloak of Many Faces, which a spy can't fix on, with P1-23's `visibility` (the items
  // family's Decision 5)
  resolveSpyOrder: ['hidden'],
};

/** The uses of a field of the wards a fighter wears that a function of src/engine/ outside rules/ still holds, by the
 *  function, each left to a later step: a guardian's perks' own wards and a guardian's grade's cap, with the guardian
 *  family (the items family's "Parked for later"; P1-19q left their merge in pcArmourMerge). Every other function holds
 *  none: one more, or one gone, turns it red. */
const WARD_USES_LEFT_TO_A_LATER_STEP: Readonly<Record<string, readonly string[]>> = {
  // a guardian's perk's chance to shrug off a stun
  pcStunWard: ['stunWard'],
  // a guardian's perk's share off a lingering harm, and its whole (100)
  pcRoundStart: ['dotWard', 'dotWard'],
  // a guardian's perk's ward against one school of magic (read once since P1-10b16: `?.arm?.schoolWard?.[school]`)
  pcCastCombatSpell: ['schoolWard'],
  // a guardian's own cap beside its grade's bulk (the guardian's build)
  pcMonsterCombatant: ['cap', 'cap'],
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

/** An expression without its parentheses, its `!` and the right of a `??` (`target.arm ?? null` is the table). */
function bare(node: ts.Expression): ts.Expression {
  if (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)) return bare(node.expression);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
    return bare(node.left);
  return node;
}

/** Each use of a field of the wards a fighter wears in a function, in the order written: `x.arm.f`, `x.arm?.f`,
 *  `x.arm['f']`, or the same through a name the function binds to `x.arm` (`const a = t?.arm`); not `names` (what gave
 *  them, the lines'). */
function everyWardUseIn(fn: ts.Node): string[] {
  const boundToTheWards = new Set<string>();
  const isTheWards = (node: ts.Expression): boolean => {
    const b = bare(node);
    return (
      (ts.isPropertyAccessExpression(b) && b.name.text === 'arm') || (ts.isIdentifier(b) && boundToTheWards.has(b.text))
    );
  };
  const bind = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      isTheWards(node.initializer)
    )
      boundToTheWards.add(node.name.text);
    ts.forEachChild(node, bind);
  };
  bind(fn);
  const uses: string[] = [];
  const collect = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node) && node.name.text !== 'names' && isTheWards(node.expression))
      uses.push(node.name.text);
    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteral(node.argumentExpression) &&
      node.argumentExpression.text !== 'names' &&
      isTheWards(node.expression)
    )
      uses.push(node.argumentExpression.text);
    ts.forEachChild(node, collect);
  };
  collect(fn);
  return uses;
}

/** In a file: each function's uses of a ward's field (as everyWardUseIn), for the functions that hold one (a function
 *  inside another counts for the outer one). */
function everyWardUseByFunction(file: string, text: string): Map<string, string[]> {
  const byFunction = new Map<string, string[]>();
  const visit = (node: ts.Node): void => {
    const name = aFunctionsName(node);
    if (name !== null) {
      const uses = everyWardUseIn(node);
      if (uses.length) byFunction.set(name, [...(byFunction.get(name) ?? []), ...uses]);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true));
  return byFunction;
}

/** Whether a node declares the function named (as the ratchet's helper finds a function), or is a function expression
 *  of that name (a pass run at once, which the helper counts at the top of its file). */
function declares(node: ts.Node, fn: string): boolean {
  return aFunctionsName(node) === fn || (ts.isFunctionExpression(node) && node.name?.text === fn);
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
  expect(
    everyWardUseByFunction(file, text).get(fn) ?? [],
    `every use in ${fn} of a field of the wards a fighter wears (his arm)`,
  ).toEqual(WARD_USES_LEFT_TO_A_LATER_STEP[fn] ?? []);
});

test.for(TAKEN_PASSES)('%s: %s names no item effect (%s)', ([file, fn]) => {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  expect(itemEffectChecksByFunction(file, text).get('(top)') ?? 0, `the checks at the top of ${file}`).toBe(0);
  expect(everyItemWordIn(file, text, fn), `every string in ${fn} naming an item's effect or an item`).toEqual([]);
});

test.for(THE_SETS_OF_STATS_ITEM_ROLE_READS)('%s: %s names no item effect (P1-19t, the treasury)', ([file, name]) => {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(path.join(ROOT, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const words: string[] = [];
  const collect = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) && ITEM_EFFECT_VOCABULARY.has(node.text)) words.push(node.text);
    ts.forEachChild(node, collect);
  };
  const found = source.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find((d) => ts.isIdentifier(d.name) && d.name.text === name);
  expect(found, `${file} declares ${name}`).toBeDefined();
  if (found) collect(found);
  expect(words).toEqual([]);
});

// No function of src/engine/ outside rules/ uses a field of the wards a fighter wears, but the ones listed: what each
// ward does is its entry's in the items' registry (src/engine/rules/, not counted), and the table is read by its runners.
test("no function of the engine outside the registries uses a ward's field, but the guardian's listed", () => {
  const uses: Record<string, string[]> = {};
  for (const [file, text] of theCodeFiles())
    if (file.startsWith('src/engine/') && !file.startsWith('src/engine/rules/'))
      for (const [fn, found] of everyWardUseByFunction(file, text)) uses[fn] = [...(uses[fn] ?? []), ...found];
  expect(uses).toEqual(WARD_USES_LEFT_TO_A_LATER_STEP);
});

test("every use of a ward's field is found: on the table, through a name bound to it, and none other", () => {
  const planted = `
    export function planted(t, cbt, f) {
      const a = t?.arm, b = (cbt.arm ?? null), c = f.status;
      const nested = () => f.arm.thorns;
      return t.arm.meleeDR + t.arm?.dodge + cbt.arm['block'] + a.stunImmune + b?.cap + nested() + f.arm.names.length
        + c.dodge + f.dodge + f.armour.block + a.names;
    }
    const after = (x) => x.arm.regen;`;
  expect(Object.fromEntries(everyWardUseByFunction('planted.ts', planted))).toEqual({
    planted: ['thorns', 'meleeDR', 'dodge', 'block', 'stunImmune', 'cap'],
    after: ['regen'],
  });
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
