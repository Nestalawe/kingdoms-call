// The code the alignment abilities' registry has taken names no alignment (plan P1-19's alignment abilities family,
// Decision A): each function (or file's top level) the registry (src/engine/rules/the-registry-of-alignment-
// abilities.ts) has taken holds no string naming an alignment (`'Neutral'`, `'Undead'`), whatever the code does with it
// (compared, a `case`, a lookup, a list, a map's key or value, a literal type, or in a function nested inside). It asks
// the registry's runner, which reads the ability's row, instead. Each row of the family adds what it takes. With them,
// the ratchet's count of the alignments the engine names outside src/engine/rules/ (tools/ratchet.ts's
// alignmentChecksInEngine, by its helper alignmentChecksByFunction: a name anywhere but a literal type), so that count
// only falls: the helper counts each name planted, and none in src/engine/rules/ or a page's code.
//
// Red on its row's base by design (neutralTradeGold held 1 on P1-19at1's base: the Neutral trade's 'Neutral'), as the
// unit-name, item-effect, spell, discovery, perk and alignment-order tests were: the one exception to refactor-only's
// rule that new tests pass before and after (Theo, 2026-10-25).
// Level 0 (static): the files' syntax trees and the content's list of alignments as written; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import {
  ALIGNMENT_VOCABULARY,
  alignmentChecksByFunction,
  alignmentChecksInEngine,
  compare,
  readBaseline,
  theCodeFiles,
} from '../../tools/ratchet.ts';

/** The top level of a file: what no function holds. */
const TOP = '(top)';

/** Each function (or a file's top level) the alignment abilities' registry has taken, by its file, from the row that
 *  took it. */
const TAKEN: readonly (readonly [file: string, fn: string, row: string])[] = [
  ['src/engine/grand-design.ts', 'neutralTradeGold', 'P1-19at1, the Neutral trade: its alignment, from its row'],
  [
    'src/engine/orders/move-order-marches-voyages-and-battles-on-arrival.ts',
    'resolveMoveOrder',
    "P1-19au2, the Banner of Fellowship: its points at both of the columns' rolls, from its row",
  ],
  [
    'src/engine/orders/spells/white-magic-spells-the-cast-spell-order-works.ts',
    'workBlessProvince',
    "P1-19av1, Bless Province's rates: the Divine blessing's yield, from its row",
  ],
  [
    'src/engine/rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts',
    'druidNeedWaivedByAlignment',
    "P1-19av1, the Druid waiver: the Druidic Creatures' and the Evil Monsters' alignments, from their rows",
  ],
  [
    'src/engine/orders/research-and-practice-orders-discoveries-skill-drills-and-rest.ts',
    'resolveResearchOrder',
    'P1-19av1, the Neutral scholars: their points a Sage level, from their row',
  ],
  [
    'src/engine/personal-combat/resolve-personal-combat.ts',
    'resolvePersonalCombat',
    "P1-19av2, mercy: a plea's odds and the foe's laughter, from the ladder's rung of his alignment",
  ],
  [
    'src/engine/rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts',
    'heroHireWage',
    "P1-19av2, the hire wage and the gulf's ban: their gold and steps, from the ladder's numbers",
  ],
  [
    'src/engine/heroes/hero-death-and-leaderless-hosts.ts',
    'handleHeroDeath',
    "P1-19ax1, Divine grace: whether a fallen monarch's realm raises its fallen, from its row",
  ],
  [
    'src/engine/orders/research-and-practice-orders-discoveries-skill-drills-and-rest.ts',
    'resolveRestOrder',
    'P1-19ax1, the Divine Rest: its factor, from its row',
  ],
  [
    'src/engine/battle/blood-harvest-and-iron-throne.ts',
    'bloodHarvest',
    'P1-19ax1, the Blood Harvest: its gold for each foe, from its row',
  ],
  [
    'src/engine/realms/relations-and-captures.ts',
    'applyEvilConquest',
    "P1-19ax1, the conquest doctrine: its plunder, its garrison's grade and its turns, from its row",
  ],
  [
    'src/engine/turn/new-turn-war-academy-informants-divine-resurrection-graves-mercenaries-wanderers-and-the-final-reconcile.ts',
    'newTurnWarAcademyInformantsDivineResurrectionGravesMercenariesWanderersAndTheFinalReconcile',
    "P1-19ax1 and ax2, Divine grace's return and the graves on Undead land: their numbers, from their rows",
  ],
  [
    'src/engine/turn/diplomacy-resolution-and-victory-the-reckoning-elimination-concession-and-the-announcement.ts',
    'diplomacyResolutionOverturesPeaceAlliancesWarAndWarFrontWarnings',
    'P1-19ax2, a broken alliance: the creeds that go to war, from their rows',
  ],
  [
    'src/engine/personal-combat/speed-encounter-plans-and-combatants.ts',
    'pcCharCombatant',
    "P1-19ax2, an Undead hero in personal combat: his own alignment's row",
  ],
  [
    'src/engine/rules-on-plain-values/the-items-a-send-item-hands-over-and-the-companies-a-hand-over-or-a-pick-up-moves.ts',
    'theRisenDeadFollowAHandOverTo',
    "P1-19ax2, the risen dead's hand-over: the creed they follow, from its row",
  ],
  [
    'src/engine/rules-on-plain-values/the-creeds-that-war-without-warning-break-an-alliance-into-war-and-conquer-by-a-doctrine.ts',
    TOP,
    'P1-19ax2, war without warning, a broken alliance and the doctrine for the portal: their rows',
  ],
  [
    'src/engine/battle/battles-against-province-defenders.ts',
    'combatVsNPC',
    "P1-19bb1, a realm of none: the attacker's alignment, from the content's constant",
  ],
  [
    'src/engine/battle/the-battle-against-the-defenders/n0-to-n2-the-set-up-the-duel-and-the-sides-to-the-home-ground.ts',
    'theSetUpTheDuelAndTheSidesOfTheBattleAgainstTheDefenders',
    "P1-19bb1, a realm of none: the attacker's alignment, from the content's constant (B-06az: combatVsNPC's set-up, duel and sides, moved)",
  ],
  [
    'src/engine/battle/the-battle-against-the-defenders/n3-to-n4-the-attackers-pre-battle-magic-army-spells-archery-flak-and-breach.ts',
    'theAttackersPreBattlePhasesInTheBattleAgainstTheDefenders',
    "P1-19bb1, a realm of none: the attacker's alignment, from the content's constant (B-06ba: combatVsNPC's attacker's pre-battle phases, moved)",
  ],
  [
    'src/engine/battle/the-battle-against-the-defenders/n5-to-n7-the-defenders-pre-battle-magic-archery-and-army-spells.ts',
    'theDefendersPreBattlePhasesInTheBattleAgainstTheDefenders',
    "P1-19bb1, a realm of none: the attacker's alignment, from the content's constant (B-06bb: combatVsNPC's defenders' pre-battle phases, moved)",
  ],
  [
    'src/engine/battle/the-battle-against-the-defenders/n8-to-n10-the-grounds-notes-the-lines-fortune-and-the-result.ts',
    'theGroundsNotesTheLinesTheFortuneAndTheResultOfTheBattleAgainstTheDefenders',
    "P1-19bb1, a realm of none: the attacker's alignment, from the content's constant (B-06bc: combatVsNPC's lines, fortune and result, moved)",
  ],
  [
    'src/engine/battle/the-battle-against-the-defenders/n11-to-n13-the-casualties-the-rout-and-the-end.ts',
    'theCasualtiesTheRoutAndTheEndOfTheBattleAgainstTheDefenders',
    "P1-19bb1, a realm of none: the attacker's alignment, from the content's constant (B-06bd: combatVsNPC's casualties, rout and end, moved)",
  ],
  [
    'src/engine/battle/battles-between-heroes.ts',
    'combatVsChar',
    "P1-19bb1, a realm of none: each side's alignment, from the content's constant",
  ],
  [
    'src/engine/battle/the-battle-between-heroes/h0-to-h2-the-set-up-the-duel-and-the-sides-to-the-front.ts',
    'theSetUpTheDuelAndTheSidesOfTheBattleBetweenHeroes',
    "P1-19bb1, a realm of none: each side's alignment, from the content's constant (B-06bf: combatVsChar's set-up, duel and sides, moved)",
  ],
  [
    'src/engine/battle/the-battle-between-heroes/h3-both-sides-pre-battle-magic-and-army-spells.ts',
    'bothSidesPreBattleMagicAndArmySpellsInTheBattleBetweenHeroes',
    "P1-19bb1, a realm of none: each side's alignment, from the content's constant (B-06bg: combatVsChar's magic and army spells, moved)",
  ],
  [
    'src/engine/battle/the-battle-between-heroes/h4-both-sides-archery-flak-and-breach.ts',
    'bothSidesArcheryFlakAndBreachInTheBattleBetweenHeroes',
    "P1-19bb1, a realm of none: each side's alignment, from the content's constant (B-06bh: combatVsChar's archery, Flak and Breach, moved)",
  ],
  [
    'src/engine/battle/the-battle-between-heroes/h5-to-h7-sanctuary-the-mastery-orders-the-lines-fortune-and-the-result.ts',
    'sanctuaryTheMasteryOrdersTheLinesTheFortuneAndTheResultOfTheBattleBetweenHeroes',
    "P1-19bb1, a realm of none: each side's alignment, from the content's constant (B-06bi: combatVsChar's Sanctuary, mastery orders, lines, fortune and result, moved)",
  ],
  [
    'src/engine/battle/best-commander.ts',
    'commandScore',
    "P1-19bb1, a realm of none: the candidate's realm's alignment, from the content's constant",
  ],
  [
    'src/engine/orders/alignment/broker-a-neutral-kings-order-to-hire-a-hero-or-buy-word-from-afar.ts',
    'resolveBrokerOrder',
    "P1-19bb1, a realm of none: the hiring realm's alignment in the wage, from the content's constant",
  ],
  [
    'src/engine/orders/realm-works-orders-consecration-muster-broker-the-wild-and-grand-design.ts',
    'resolveGrandDesignOrder',
    "P1-19bb1, a realm of none: the Wonder's alignment, from the content's constant",
  ],
  [
    'src/engine/orders/spells/psychic-spells-the-cast-spell-order-works-and-the-charms-backlash.ts',
    'workCharm',
    "P1-19bb1, a realm of none: the charming realm's alignment in the wage, from the content's constant",
  ],
  [
    'src/engine/orders/spells/necromancy-spells-the-cast-spell-order-works.ts',
    'workControlUndead',
    "P1-19bb2, the risen dead's race: the dead Control Undead finds, by the content's race",
  ],
  [
    'src/engine/orders/spells/necromancy-spells-the-cast-spell-order-works.ts',
    'workRaiseWraiths',
    "P1-19bb2, the risen dead's race: the wraiths raised, of the content's race",
  ],
  [
    'src/engine/world/the-worlds-making/s09-each-home-tailored-and-its-king-and-heroes-made.ts',
    'eachHomeTailoredAndItsKingAndHeroesMade',
    "P1-19bb2, the risen dead's race: an Undead king's skeletal company, of the content's race",
  ],
  [
    'src/engine/rules-on-plain-values/a-guardians-kind-and-the-label-a-player-reads-it-by.ts',
    TOP,
    "P1-19bb2, a guardian's kind: the labels a player reads, moved to the content",
  ],
  [
    'src/engine/battle/blood-harvest-and-iron-throne.ts',
    'ironThroneRaise',
    "P1-19bb2 and bb3, the Iron Throne's rises: their race, and the Wonder by its row",
  ],
  ['src/engine/battle/terrain-and-unit-strength.ts', 'armStr', 'P1-19bb3, the Standing Stones: the Wonder by its row'],
  [
    'src/engine/orders/alignment/harvest-the-field-an-undead-realms-order-to-raise-a-grave-as-a-skeletal-company.ts',
    'resolveHarvestTheFieldOrder',
    "P1-19bb2 and bb3, Harvest the Field: the risen's race, and the Deathless Legion by its row",
  ],
  [
    'src/engine/orders/cast-spell-order-white-psychic-illusory-elemental-and-necromancy-spells.ts',
    'resolveCastSpellOrder',
    "P1-19bb3, the Grand Cathedral's Bless: the Wonder by its row",
  ],
  [
    'src/engine/orders/recruit-and-hire-orders-companies-mercenaries-and-heroes.ts',
    'resolveRecruitArmiesOrder',
    "P1-19bb3, the World-Tree Grove's Veterans: the Wonder by its row",
  ],
  [
    'src/engine/orders/spells/necromancy-spells-the-cast-spell-order-works.ts',
    'workSkeletalArmies',
    "P1-19bb2 and bb3, Skeletal Armies: the risen's race, and the Deathless Legion by its row",
  ],
  [
    'src/engine/orders/spells/necromancy-spells-the-cast-spell-order-works.ts',
    'workDeathsDominion',
    "P1-19bb2 and bb3, Death's Dominion: the risen's race, and the Deathless Legion by its row",
  ],
  [
    'src/engine/turn/before-the-first-phase-war-without-warning-research-choices-messages-move-pools-and-default-defend.ts',
    'movePoolsPerTurnTrackersEspionageResetsAndTheSaveSweepsBeforeTheBotsPlan',
    "P1-19bb4, the Grand Cathedral's ward: the Wonder by its row",
  ],
  [
    'src/engine/turn/early-winter-charms-fade-taxes-wages-raiders-muster-and-garrison-drill.ts',
    'earlyWinterCharmsFadeTaxesWagesRaidersMusterAndGarrisonDrill',
    "P1-19bb4, the Free City Charter's tax, the World-Tree Grove's wages and the Deathless Legion's unpaid: their Wonders by their rows",
  ],
  [
    'src/engine/turn/new-turn-counter-king-succession-summons-and-spells-end-and-the-grand-designs.ts',
    'newTurnCounterKingSuccessionSummonsAndSpellsEndAndTheGrandDesigns',
    "P1-19bb1 and bb4, the new turn: a realm of none's alignment, from the content's constant, and the Grand Library by its row",
  ],
  [
    'src/engine/turn/before-the-first-phase-war-without-warning-research-choices-messages-move-pools-and-default-defend.ts',
    'warWithoutWarningTitlesHeldSafeStartAndStaleOrderLinesGmRemovalsAndMessages',
    "P1-19bb5, war without warning's words: the dead's, from the Undead's row",
  ],
  [
    'src/engine/orders/recruit-and-hire-orders-companies-mercenaries-and-heroes.ts',
    'resolveHireHeroOrder',
    "P1-19bb1 and bb5, Hire Hero: a realm of none's alignment, from the content's constant, and the gulf's words, from the ladder's first rung",
  ],
  [
    'src/engine/orders/explore-and-search-orders-maps-lairs-rites-and-rumours.ts',
    'resolveSearchLairOrder',
    "P1-19bb5, a ritual site walked: the words for Perform Rite's creed, from its row",
  ],
  [
    'src/engine/world/the-worlds-making/s16-every-neutral-province-gets-its-guard-hero-and-garreth-his-province.ts',
    'everyNeutralProvinceGetsItsGuardHeroAndGarrethHisProvince',
    "P1-19bb5, Garreth the Independent: his creed, from the content's constant",
  ],
  [
    'src/engine/bots/intel.ts',
    'botEffForce',
    "P1-19bb6, the bots' force estimate: a realm of none's alignment, from the content's constant",
  ],
  [
    'src/engine/bots/intel.ts',
    'botBattleForce',
    "P1-19bb6, the bots' battle estimate: a realm of none's alignment, from the content's constant",
  ],
  [
    'src/engine/bots/intel.ts',
    'botDruidShortfall',
    "P1-19bb6, the bots' Druid shortfall: a realm of none's alignment, from the content's constant",
  ],
  [
    'src/engine/bots/intel.ts',
    'botAlignOf',
    "P1-19bb6, the bots' read of a realm's alignment: a realm of none's alignment, from the content's constant",
  ],
  [
    'src/engine/bots/movement.ts',
    'theAlignmentOf',
    "P1-19bb6, the bots' marches: a realm of none's alignment, from the content's constant",
  ],
  [
    'src/engine/bots/setup.ts',
    'pickBotAlignment',
    "P1-19bb6, a bot's alignment: the one a bot takes with none left, from the content's constant",
  ],
  [
    'src/engine/bots/setup.ts',
    'pickBotAlignmentBalanced',
    "P1-19bb6, a bot's balanced alignment: the one a bot takes with none left, from the content's constant",
  ],
  [
    'src/engine/bots/strategy.ts',
    'botHireOrder',
    "P1-19bb6, the bots' Hire Hero: a realm of none's alignment, from the content's constant",
  ],
  [
    'src/engine/bots/economy.ts',
    'runBotOrderHygiene',
    "P1-19bb7, the bots' hand-overs: whether the risen dead follow, from the Undead's row (and bb6's wage)",
  ],
  [
    'src/engine/bots/missions.ts',
    'botConsecrateOK',
    "P1-19bb7, the bots' Consecrate: the realm of its creed, from its row",
  ],
  [
    'src/engine/bots/missions.ts',
    'botSignaturePre',
    "P1-19bb7, the bots' creed orders: Consecrate, Call to Arms, Harvest the Field and Broker, each by its row",
  ],
  [
    'src/engine/bots/missions.ts',
    'botRitePre',
    "P1-19bb7, the bots' Perform Rite: the realm of its creed, from its row",
  ],
  [
    'src/engine/bots/spellcraft.ts',
    'botCastPlan',
    "P1-19bb7, the bots' Bless: a hero leaves it to his king where the Divine blessing raises it, from its row",
  ],
  [
    'src/engine/bots/intel.ts',
    'botFervourMult',
    "P1-19bb8, the bots' fervour: savage fury's, skeletal fervour's and Righteous Defence's factors, from their rows (and bb6's realm of none)",
  ],
  [
    'src/engine/bots/strategy.ts',
    'effOf',
    "P1-19bb8, the bots' worth of a recruit: savage fury's factor, from its row (and bb6's realm of none)",
  ],
  [
    'src/engine/bots/strategy.ts',
    'botHeroCap',
    "P1-19bb8, the bots' court: the realm whose dearest wanderer asks the least, by the hire wage, wants the weights' heroes more",
  ],
  [
    'src/engine/bots/specialists.ts',
    'botSpecialistRoles',
    "P1-19bb8, the bots' scholars: a realm whose alignment adds to research, by its row, wants the weights' scholars more",
  ],
  [
    'src/engine/bots/specialists.ts',
    'botScholarOrders',
    "P1-19bb8, the bots' scholar: researches from the weights' Sage level for a realm whose alignment adds to research",
  ],
  [
    'src/engine/bots/specialists.ts',
    'botRoleWork',
    "P1-19bb8, the bots' scholar's work: from the weights' Sage level for a realm whose alignment adds to research",
  ],
  [
    'src/engine/bots/specialists.ts',
    'botRoleReady',
    "P1-19bb8, the bots' scholar is ready: at the weights' Sage level for a realm whose alignment adds to research",
  ],
  [
    'src/engine/bots/intel.ts',
    'botTuning',
    "P1-19bb9, the bots' tuning: Divine grace's, the Banner's, the doctrine's and the Blood Harvest's overlays, by their rows",
  ],
  [
    'src/engine/bots/war.ts',
    'botWarAssess',
    "P1-19bb9, the bots' war bar: the dark creeds' lower bar for a realm that declares war without warning, by its rows",
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

/** In the function named (or the file's top level, outside every named function): every string naming an alignment, in
 *  the order written, a literal type's too (a function nested inside with no name counts); null if the file doesn't
 *  declare the function. */
function everyAlignmentIn(file: string, text: string, fn: string): string[] | null {
  let found: string[] | null = fn === TOP ? [] : null;
  const collect = (node: ts.Node, into: string[], atTheTop: boolean): void => {
    if (atTheTop && aFunctionsName(node) !== null) return;
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && ALIGNMENT_VOCABULARY.has(node.text))
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

test.for(TAKEN)('%s: %s names no alignment (%s)', ([file, fn]) => {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const counts = alignmentChecksByFunction(file, text);
  expect(fn === TOP || counts.has(fn), `${file} declares ${fn}`).toBe(true);
  expect(counts.get(fn) ?? 0, `${fn}'s names of an alignment (the ratchet's helper)`).toBe(0);
  expect(everyAlignmentIn(file, text, fn), `every string in ${fn} naming an alignment`).toEqual([]);
});

test("the vocabulary holds the seven alignments' names, and no other word", () => {
  expect([...ALIGNMENT_VOCABULARY]).toEqual(['Divine', 'Good', 'Druidic', 'Neutral', 'Pagan', 'Evil', 'Undead']);
});

// The helper finds what it counts: each form of a name planted in one function of the engine (an arrow with no name
// inside it counts for it, a named one for itself; one outside every function for the top level), and none of what
// isn't a name or is a literal type.
test("the ratchet's helper counts each alignment's name, a literal type's aside", () => {
  const planted = `
    type Creed = 'Divine' | 'Undead';
    const CHANCE = { 'Divine': 0.5, Good: 0.4, x: 'Evil' };
    export function planted(p: { alignment: string }, list: string[]) {
      const a = (p.alignment === 'Neutral') + list.includes('Pagan') + ['Druidic'].length;
      switch (p.alignment) { case 'Good': break; }
      const realm = { alignment: \`Undead\` };
      const inside = [p].some((x) => x.alignment !== 'Evil');
      const notNames = 'neutral' + 'Divine ' + 'Undeads' + 'Goodly' + 'Druid';
      return a + realm.alignment + inside + notNames;
    }
    const nested = function named() { return 'Divine'; };`;
  expect(Object.fromEntries(alignmentChecksByFunction('src/engine/planted.ts', planted))).toEqual({
    [TOP]: 2,
    planted: 6,
    nested: 1,
  });
});

test('every string naming an alignment in a function, or at the top level, is found', () => {
  const planted = `
    type Creed = 'Divine';
    const before = 'Good';
    export function planted(p) {
      const a = helper('Pagan') + [\`Undead\`].length + (p.alignment === 'Neutral');
      const inside = () => 'Evil', notAName = 'evil' || 'Druid';
      return a + inside() + notAName;
    }
    const after = 'Druidic';`;
  expect(everyAlignmentIn('planted.ts', planted, 'planted')).toEqual(['Pagan', 'Undead', 'Neutral', 'Evil']);
  expect(everyAlignmentIn('planted.ts', planted, TOP)).toEqual(['Divine', 'Good', 'Druidic']);
  expect(everyAlignmentIn('planted.ts', planted, 'absent')).toBeNull();
});

// A name planted in a file of src/engine/ raises alignmentChecksInEngine by one, and the ratchet fails on it; one in
// src/engine/rules/ or in a page's code isn't counted.
test.for([
  ['src/engine/bots/x.ts', 1],
  ['src/engine/rules/x.ts', 0],
  ['src/ui/gm/x.ts', 0],
] as const)('a name planted in %s raises alignmentChecksInEngine by %i', ([file, rise]) => {
  const files = theCodeFiles();
  const asTheyAre = { ...readBaseline(), alignmentChecksInEngine: alignmentChecksInEngine(files) };
  expect(asTheyAre.alignmentChecksInEngine).toBe(readBaseline()['alignmentChecksInEngine']);
  const planted = {
    ...asTheyAre,
    alignmentChecksInEngine: alignmentChecksInEngine([
      ...files,
      [file, "export const planted = (p: { alignment: string }): boolean => p.alignment === 'Neutral';\n"],
    ]),
  };
  expect(planted.alignmentChecksInEngine).toBe(asTheyAre.alignmentChecksInEngine + rise);
  const { rose } = compare(asTheyAre, planted);
  expect(rose).toHaveLength(rise);
  expect(rose.filter((r) => /^alignmentChecksInEngine rose from \d+ to \d+\./.test(r))).toEqual(rose);
});
