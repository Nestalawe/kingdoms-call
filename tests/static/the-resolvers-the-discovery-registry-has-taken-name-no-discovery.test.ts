// The resolvers the discoveries' registry has taken name no discovery (plan P1-19's discoveries family, Decision 6):
// each function the registry's rows have taken holds no string naming a discovery by its id (`'sd40'`) or an effect's
// kind (`'unitStr'`), whatever the code does with it (passed to a reader or a helper, compared, held in a list, or in a
// function nested inside). Its effects find a realm's effects of a kind by its discoveries' ids, in src/engine/rules/.
// Each row of the family adds the functions it takes. With them, the ratchet's count of the engine's checks of a
// discovery outside the registry (tools/ratchet.ts's discoveryChecksInEngine, by its helper discoveryChecksByFunction:
// an id anywhere but where a reader takes no id, a kind as the kind a reader takes or compared with an effect's `.kind`
// or `.type`), so that count only falls: the helper counts each such check planted, and none in src/engine/rules/ or a
// page's code.
//
// Red on its row's base by design (applyPreBattleMagic held 1 check, discUnitMult 1 and dragonTamed 1 on P1-19aa's
// base; pcCharCombatant 5 on P1-19ac's; resolveSpyOrder 6 on P1-19ad's; each of P1-19ae's ten 1; P1-19af's
// spreadTerror and resolveMoveOrder 2, its other four 1; P1-19ag's new turn 7, Early Winter, Herbal Lore's stage,
// taxRecordsGold and discHeroWage 2, its other three 1), as the unit-name, item-effect and spell tests were: the one
// exception to refactor-only's rule that new tests pass before and after (Theo, 2026-10-25; the discoveries family's
// Decision 6).
// Level 0 (static): the files' syntax trees and the content's discoveries as written; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import {
  compare,
  DISCOVERY_EFFECT_KINDS,
  DISCOVERY_IDS,
  discoveryChecksByFunction,
  discoveryChecksInEngine,
  readBaseline,
  theCodeFiles,
} from '../../tools/ratchet.ts';

/** The Evil doctrine a victor's plan names (`encounterPlan.evilMode`, 'terror' or 'slaves'): the same word as the kind
 *  of Reign of Terror's effect, but no discovery's (both battles read it as the victor's choice, twice). */
const THE_EVIL_DOCTRINE_IN_A_BATTLE: readonly string[] = ['terror', 'terror'];

/** The Spy skill (read, risen and shown) and the type of the order's lines, `'spy'`: the word of the kind of a spy's
 *  discoveries, but no discovery's (resolveSpyOrder, eleven times). */
const THE_SPY_SKILL_AND_ITS_LINES: readonly string[] = Array<string>(11).fill('spy');

/** The type of an explorer's or a scholar's line, `'explore'`: the word of the kind of an explorer's discoveries, but no
 *  discovery's (n times in a function). */
function theExploreLines(n: number): readonly string[] {
  return Array<string>(n).fill('explore');
}

/** The type of a march's lines and of an ally's order the unify rolls read, `'move'`, and of the lines of what the
 *  march maps, `'explore'`: the words of the kinds of a march's and an explorer's discoveries, but no discovery's
 *  (resolveMoveOrder, 34 and 2 times, in the order written). */
const THE_MARCHS_LINES_AND_ORDERS: readonly string[] = [
  ...Array<string>(23).fill('move'),
  'explore',
  ...Array<string>(11).fill('move'),
  'explore',
];
/** Each function the discoveries' registry has taken, by its file, from the row that took it, with the strings in it
 *  that name something else (none, unless given). */
const TAKEN: readonly (readonly [file: string, fn: string, row: string, nameSomethingElse?: readonly string[]])[] = [
  ['src/engine/discoveries.ts', 'discUnitMult', "P1-19aa, a realm's discoveries strengthen a unit"],
  ['src/engine/discoveries.ts', 'dragonTamed', "P1-19aa, a realm's discoveries let a beast follow without its Druid"],
  [
    'src/engine/battle/battles-between-heroes.ts',
    'applyPreBattleMagic',
    "P1-19aa, a realm's discoveries add to a caster's chance",
  ],
  [
    'src/engine/battle/battles-against-province-defenders.ts',
    'combatVsNPC',
    "P1-19aa and P1-19ab, the army's strength; a realm's discoveries weight the lines behind the front",
    THE_EVIL_DOCTRINE_IN_A_BATTLE,
  ],
  [
    'src/engine/battle/battles-between-heroes.ts',
    'combatVsChar',
    "P1-19aa and P1-19ab, the army's strength; a realm's discoveries weight the lines behind the front",
    THE_EVIL_DOCTRINE_IN_A_BATTLE,
  ],
  [
    'src/engine/battle/best-commander.ts',
    'commandScore',
    "P1-19ab, a realm's discoveries weight the lines behind the front",
  ],
  ['src/engine/battle/lines.ts', 'flankLineMults', "P1-19ab, a realm's discoveries weight the lines behind the front"],
  ['src/engine/discoveries.ts', 'discDeathMult', "P1-19ab, a realm's discoveries spare a beaten unit"],
  ['src/engine/discoveries.ts', 'discPromo', "P1-19ab, a realm's discoveries promote a unit"],
  ['src/engine/graves.ts', 'recordBattleGraves', "P1-19ab, a realm's discoveries carry a fallen unit home"],
  [
    'src/engine/heroes/hero-death-and-leaderless-hosts.ts',
    'handleHeroDeath',
    "P1-19ab, a realm's discoveries drag a hero from the field",
  ],
  ['src/engine/chances-and-lair-grades.ts', 'castChanceFor', "P1-19ac, a realm's discoveries add to a caster's chance"],
  [
    'src/engine/personal-combat/combat-spells-and-guardian-abilities.ts',
    'pcCastCombatSpell',
    "P1-19ac, a realm's discoveries add to a caster's chance",
  ],
  [
    'src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts',
    'pcHitChance',
    "P1-19ac, a realm's discoveries steady a fighter's aim",
  ],
  [
    'src/engine/personal-combat/melee-flight-and-archery.ts',
    'pcArrowHitChance',
    "P1-19ac, a realm's discoveries steady a fighter's aim",
  ],
  [
    'src/engine/personal-combat/speed-encounter-plans-and-combatants.ts',
    'pcCharCombatant',
    "P1-19ac, a realm's discoveries add to a fighter's skills and strengthen his Mithril",
  ],
  ['src/engine/titles/reckoning.ts', 'extraSkillBonuses', "P1-19ac, a realm's discoveries add to a fighter's skills"],
  [
    'src/engine/heroes/experience-skill-rises-and-earned-hp.ts',
    'trySkillGain',
    "P1-19ac, a realm's discoveries add to a skill's rise",
  ],
  [
    'src/engine/heroes/experience-skill-rises-and-earned-hp.ts',
    'awardHpRoll',
    "P1-19ac, a realm's discoveries harden the king",
  ],
  [
    'src/engine/orders/espionage-orders-spy-steal-sabotage-grand-heist-assassinate-and-vanish.ts',
    'resolveSpyOrder',
    "P1-19ad, a realm's discoveries add to a spy's chance, cut a rival's, add to spying on a hero and to catching a " +
      "spy, and keep a spy's success quiet",
    THE_SPY_SKILL_AND_ITS_LINES,
  ],
  [
    'src/engine/orders/explore-and-search-orders-maps-lairs-rites-and-rumours.ts',
    'resolveExploreOrder',
    "P1-19ad, a realm's discoveries add to exploring and map the provinces around an explorer",
    theExploreLines(6),
  ],
  [
    'src/engine/orders/explore-and-search-orders-maps-lairs-rites-and-rumours.ts',
    'resolvePerformRiteOrder',
    "P1-19ad, a realm's discoveries lengthen the wild hunt",
  ],
  [
    'src/engine/orders/explore-and-search-orders-maps-lairs-rites-and-rumours.ts',
    'resolveSearchLairOrder',
    "P1-19ad, a realm's discoveries add to a lair's gold and its item",
    theExploreLines(21),
  ],
  [
    'src/engine/orders/research-and-practice-orders-discoveries-skill-drills-and-rest.ts',
    'resolveResearchOrder',
    "P1-19ad, a realm's discoveries add to research",
    theExploreLines(3),
  ],
  [
    'src/engine/orders/research-and-practice-orders-discoveries-skill-drills-and-rest.ts',
    'resolvePracticeSkillOrder',
    "P1-19ad, a realm's discoveries add to practice",
    // the action of another order of his this phase, `'practice'`: the word of the kind, but no discovery's
    ['practice'],
  ],
  [
    'src/engine/orders/research-and-practice-orders-discoveries-skill-drills-and-rest.ts',
    'resolveRestOrder',
    "P1-19ad, a realm's discoveries add to a rest's heal and heal a resting hero in full",
  ],
  [
    'src/engine/heroes/fame-and-consecration.ts',
    'spotEnemyInOwnedProvince',
    "P1-19ad, a realm's discoveries spot a hero lurking in its province",
  ],
  ['src/engine/discoveries.ts', 'discExploreMult', "P1-19ad, a realm's discoveries add to exploring"],
  [
    'src/engine/orders/recruit-and-hire-orders-companies-mercenaries-and-heroes.ts',
    'resolveHireHeroOrder',
    "P1-19ae, a realm's discoveries waive the hiring ban",
  ],
  [
    'src/engine/orders/realm-works-orders-consecration-muster-broker-the-wild-and-grand-design.ts',
    'resolveBrokerOrder',
    "P1-19ae, a realm's discoveries waive the hiring ban",
    // the Broker's spying, `'spy'`: the word of the kind of a spy's discoveries, but no discovery's
    ['spy'],
  ],
  [
    'src/engine/orders/spells/psychic-spells-the-cast-spell-order-works-and-the-charms-backlash.ts',
    'workCharm',
    "P1-19ae, a realm's discoveries waive the hiring ban",
  ],
  [
    'src/views/what-each-realm-may-see-of-the-world.ts',
    'playerView',
    "P1-19ae, a realm's discoveries waive the hiring ban",
  ],
  [
    'src/engine/orders/realm-works-orders-consecration-muster-broker-the-wild-and-grand-design.ts',
    'resolveConsecrateOrder',
    "P1-19ae, a realm's discoveries add to the consecrations a crown may hold",
    theExploreLines(1),
  ],
  [
    'src/engine/orders/realm-works-orders-consecration-muster-broker-the-wild-and-grand-design.ts',
    'resolveCallToArmsOrder',
    "P1-19ae, a realm's discoveries raise a call to arms' quality",
  ],
  [
    'src/engine/orders/realm-works-orders-consecration-muster-broker-the-wild-and-grand-design.ts',
    'resolveHarvestTheFieldOrder',
    "P1-19ae, a realm's discoveries cut the corpse-carters' cost",
  ],
  [
    'src/engine/orders/recruit-and-hire-orders-companies-mercenaries-and-heroes.ts',
    'resolveRecruitArmiesOrder',
    "P1-19ae, a realm's discoveries cut a company's price",
  ],
  ['src/engine/discoveries.ts', 'realmRecruitCost', "P1-19ae, a realm's discoveries cut a unit's price"],
  ['src/engine/discoveries.ts', 'discRecruitQChance', "P1-19ae, a realm's discoveries raise a recruit's quality"],
  [
    'src/engine/orders/spells/white-magic-spells-the-cast-spell-order-works.ts',
    'workBlessProvince',
    "P1-19ae, a realm's discoveries add to a Bless",
    theExploreLines(1),
  ],
  [
    'src/engine/battle/blood-harvest-and-iron-throne.ts',
    'bloodHarvest',
    "P1-19af, a realm's discoveries add to a blood harvest",
  ],
  [
    'src/engine/battle/evil-terror.ts',
    'spreadTerror',
    "P1-19af, a realm's discoveries add to the terror a victory leaves",
  ],
  [
    'src/engine/realms/relations-and-captures.ts',
    'applyEvilConquest',
    "P1-19af, a realm's discoveries add to a conquest's plunder",
    // the Evil doctrine a conqueror's plan names when it names none, 'terror'
    ['terror'],
  ],
  [
    'src/engine/orders/move-order-marches-voyages-and-battles-on-arrival.ts',
    'resolveMoveOrder',
    "P1-19af, a realm's discoveries help converging columns unite",
    THE_MARCHS_LINES_AND_ORDERS,
  ],
  ['src/engine/units/movement-pools.ts', 'computeMovePoolMax', "P1-19af, a realm's discoveries add to a march"],
  ['src/engine/units/movement.ts', 'garrisonMoveRate', "P1-19af, a realm's discoveries add to a march"],
  ['src/engine/discoveries.ts', 'discTaxAdd', "P1-19ag, a realm's discoveries add to a province's tax"],
  ['src/engine/discoveries.ts', 'taxRecordsGold', "P1-19ag, a realm's discoveries add to the realm's tax"],
  ['src/engine/discoveries.ts', 'discUpkeepWage', "P1-19ag, a realm's discoveries cut a unit's wage"],
  ['src/engine/discoveries.ts', 'discHeroWage', "P1-19ag, a realm's discoveries cut a hero's wage and cap it"],
  ['src/engine/discoveries.ts', 'discMaxHpFor', "P1-19ag, a realm's discoveries add to maximum HP"],
  [
    'src/engine/turn/early-winter-charms-fade-taxes-wages-raiders-muster-and-garrison-drill.ts',
    'earlyWinterCharmsFadeTaxesWagesRaidersMusterAndGarrisonDrill',
    "P1-19ag, a realm's discoveries earn interest and add to the realm's tax",
  ],
  [
    'src/engine/turn/new-turn-war-academy-informants-divine-resurrection-graves-mercenaries-wanderers-and-the-final-reconcile.ts',
    'newTurnWarAcademyInformantsDivineResurrectionGravesMercenariesWanderersAndTheFinalReconcile',
    "P1-19ag, a realm's discoveries promote the capital's armies, heal the wounded, name an unseen captain, chart a province and keep the graves",
    // the type of the Observatory's two lines and of a Divine hero's return (found, or not), `'explore'`
    theExploreLines(4),
  ],
  [
    'src/engine/turn/phase-stages-start-intents-and-reactions-orders-in-two-tiers-and-end.ts',
    'startPhaseHealingSnapshotsAndStalledBattles',
    "P1-19ag, a realm's discoveries dress a fighter's wounds",
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

/** In the function named: every string naming a discovery by its id or an effect's kind, in the order written (a
 *  function nested inside counts); null if the file doesn't declare the function. */
function everyDiscoveryWordIn(file: string, text: string, fn: string): string[] | null {
  let found: string[] | null = null;
  const collect = (node: ts.Node, into: string[]): void => {
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      (DISCOVERY_IDS.has(node.text) || DISCOVERY_EFFECT_KINDS.has(node.text))
    )
      into.push(node.text);
    ts.forEachChild(node, (child) => {
      collect(child, into);
    });
  };
  const visit = (node: ts.Node): void => {
    if (aFunctionsName(node) === fn) {
      found ??= [];
      collect(node, found);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true));
  return found;
}

test.for(TAKEN)('%s: %s names no discovery (%s)', ([file, fn, , nameSomethingElse = []]) => {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const counts = discoveryChecksByFunction(file, text);
  expect(counts.has(fn), `${file} declares ${fn}`).toBe(true);
  expect(counts.get(fn), `${fn}'s checks of a discovery (the ratchet's helper)`).toBe(0);
  expect(everyDiscoveryWordIn(file, text, fn), `every string in ${fn} naming a discovery or a kind`).toEqual(
    nameSomethingElse,
  );
});

test("the vocabulary holds every discovery's id and every kind of effect, and no retired id or other word", () => {
  for (const id of ['sd01', 'sd09', 'sd40', 'rd09', 'ap02']) expect(DISCOVERY_IDS.has(id), id).toBe(true);
  for (const id of ['sd30', 'sd34', 'sd99', 'Dragon Taming']) expect(DISCOVERY_IDS.has(id), id).toBe(false);
  // the fifteen read by their discovery's id name a kind since P1-19aa (flankBonus, flyingNoDruid, …)
  for (const kind of ['unitStr', 'siege', 'defOwn', 'fanatic', 'cast', 'flankBonus', 'flyingNoDruid'])
    expect(DISCOVERY_EFFECT_KINDS.has(kind), kind).toBe(true);
  for (const word of ['pct', 'delta', 'battle', 'atk', 'Siege Engines'])
    expect(DISCOVERY_EFFECT_KINDS.has(word), word).toBe(false);
});

// The helper finds what it counts: each kind of check planted in one function (an arrow with no name inside it counts
// for it, a named one for itself), and none of the strings that aren't a check or aren't in the vocabulary.
test("the ratchet's helper counts each check of a discovery by its id or an effect by its kind, and nothing else", () => {
  const planted = `
    export function planted(tc, pi, pl, e, list) {
      const a = hasDisc(tc, pi, 'sd40') + botHasDisc(G, pi, 'sd09') + discParam('sd14', 'pct', 0.05);
      const b = discEff(tc, pi, 'unitStr') + discSum(tc, pi, 'siege', 'delta') + discEffectsOf(pl, 'defOwn');
      const c = discSumOf(pl, 'fanatic', 'pct') + (e.kind === 'cast') + ('flankBonus' !== e.type) + helper('sd37');
      const d = DISC_BY_ID['sd31'] + (pi === 'sd08') + list.includes('sd28');
      const inside = [e].some((x) => x.kind == 'tax'), nested = () => hasDisc(tc, pi, 'sd39');
      const notChecks = helper('unitStr') + (e.name === 'siege') + discSum(tc, pi, 'pct', 'unitStr');
      const notAWord = hasDisc(tc, pi, 'sd34') + discEff(tc, pi, 'strength') + (e.kind === 'pct') + 'Dragon Taming';
      return a + b + c + d + inside + nested() + notChecks + notAWord;
    }
    const nestedNamed = function named() { return discSum(tc, 0, 'tax', 'bonus'); };`;
  expect(Object.fromEntries(discoveryChecksByFunction('planted.ts', planted))).toEqual({
    planted: 14,
    nested: 1,
    nestedNamed: 1,
  });
});

test('every string naming a discovery or a kind in a function is found, a nested one too', () => {
  const planted = `
    const before = 'sd40';
    export function planted(tc, pi) {
      const a = helper('sd09') + [\`unitStr\`].length + discSum(tc, pi, 'siege', 'delta');
      const inside = () => 'flyingNoDruid', notAWord = 'sd34' || 'pct' || 'Dragon Taming';
      return a + inside() + notAWord;
    }
    const after = 'defOwn';`;
  expect(everyDiscoveryWordIn('planted.ts', planted, 'planted')).toEqual(['sd09', 'unitStr', 'siege', 'flyingNoDruid']);
  expect(everyDiscoveryWordIn('planted.ts', planted, 'absent')).toBeNull();
});

// A check planted in a file of src/engine/ raises discoveryChecksInEngine by one, and the ratchet fails on it; one in
// src/engine/rules/ (the registries' effects, which find a realm's effects by kind) or in a page's code isn't counted.
test.for([
  ['src/engine/battle/x.ts', 1],
  ['src/engine/rules/x.ts', 0],
  ['src/ui/gm/x.ts', 0],
] as const)('a discovery check planted in %s raises discoveryChecksInEngine by %i', ([file, rise]) => {
  const files = theCodeFiles();
  const asTheyAre = { ...readBaseline(), discoveryChecksInEngine: discoveryChecksInEngine(files) };
  expect(asTheyAre.discoveryChecksInEngine).toBe(readBaseline()['discoveryChecksInEngine']);
  const planted = {
    ...asTheyAre,
    discoveryChecksInEngine: discoveryChecksInEngine([
      ...files,
      [file, "export const planted = (tc: never, pi: number): boolean => hasDisc(tc, pi, 'sd40');\n"],
    ]),
  };
  expect(planted.discoveryChecksInEngine).toBe(asTheyAre.discoveryChecksInEngine + rise);
  const { rose } = compare(asTheyAre, planted);
  expect(rose).toHaveLength(rise);
  expect(rose.filter((r) => /^discoveryChecksInEngine rose from \d+ to \d+\./.test(r))).toEqual(rose);
});
