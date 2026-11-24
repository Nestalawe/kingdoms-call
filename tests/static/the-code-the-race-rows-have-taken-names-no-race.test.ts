// The code the race rows have taken names no race (B-06, T7, the rules pulled out: Run 3a's races, B-06ac to
// B-06ah): each function (or file's top level) the family's rows have taken holds no string naming a race (a humanoid
// race, `'Human'`; the wild's, `'Primal'` or `'Primal:Wolf'`; a beast's class, `'Creature'`, `'Monster'`), whatever the
// code does with it (compared, a `case`, a lookup, a list, a map's value, a literal type, or in a function nested
// inside). It reads the race's row or content's constant instead. Each row adds what it takes to TAKEN. With them, the ratchet's count of the races the engine names outside
// src/engine/rules/ (tools/ratchet.ts's raceChecksInEngine, by its helper raceChecksByFunction), so that count only
// falls: the helper counts each race planted, and none in src/engine/rules/ or a page's code.
// Not seen: a race as a property's key (`{ Human: 'plain' }`), inside a unit's name, or in lower case.
//
// Level 0 (static): the files' syntax trees and content's list of races as written; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { KC_HUMANOID_RACES } from '../../src/content/kingdoms-call-data.ts';
import { ROOT } from '../../tools/build.ts';
import {
  compare,
  namesARace,
  RACE_VOCABULARY,
  raceChecksByFunction,
  raceChecksInEngine,
  readBaseline,
  theCodeFiles,
} from '../../tools/ratchet.ts';
import { everyStringIn, TOP } from '../lib/the-strings-a-function-of-the-code-holds.ts';

/** Each function (or a file's top level) the race rows have taken, by its file, from the row that took it: each of the
 *  family's rows adds what it takes. */
const TAKEN: readonly (readonly [file: string, fn: string, row: string])[] = [
  [
    'src/engine/rules-on-plain-values/the-company-a-call-to-arms-musters-a-blood-offerings-companies-and-a-consecrations-checks.ts',
    'theCompanyACallToArmsMusters',
    "B-06ac, the company's race in a province of no race, from the content's constant",
  ],
  [
    'src/engine/realms/relations-and-captures.ts',
    'applyEvilConquest',
    "B-06ac, Evil's conquest: whether the folk are the wild's, and the enslaved garrison's race, from content",
  ],
  [
    'src/engine/turn/new-turn-counter-king-succession-summons-and-spells-end-and-the-grand-designs.ts',
    'newTurnCounterKingSuccessionSummonsAndSpellsEndAndTheGrandDesigns',
    "B-06ac, an heir's race in a province of no race, from the content's constant",
  ],
  [
    'src/engine/units/drill-and-spoils.ts',
    'resyncNeutralDefenders',
    "B-06ac, the neutral defenders' race in a province of no race, from the content's constant",
  ],
  [
    'src/engine/orders/recruit-and-hire-orders-companies-mercenaries-and-heroes.ts',
    'resolveRecruitArmiesOrder',
    "B-06ac, a recruit's race: the sea beasts the wild's, a province of no race's the content's constant",
  ],
  [
    'src/engine/orders/army-orders-hand-over-garrison-disband-and-pick-up-companies-and-release-a-hero.ts',
    'resolveDisbandArmyOrder',
    "B-06ac, a disbanded company of no race's folk, from the content's constant",
  ],
  [
    'src/engine/orders/alignment/call-to-arms-a-good-kings-order-to-muster-a-company-from-his-folk.ts',
    'resolveCallToArmsOrder',
    "B-06ac, no Call to Arms in a province of the wild's race, from content's race and its helper",
  ],
  [
    'src/engine/orders/alignment/perform-rite-a-pagan-heros-rite-of-the-wild-hunt-or-blood-offering.ts',
    'resolvePerformRiteOrder',
    "B-06ac, a Wild Hunt's beasts in a province of no race are of the wild's race, from content",
  ],
  [
    'src/engine/orders/realm-works-orders-consecration-muster-broker-the-wild-and-grand-design.ts',
    'resolveAwakenGroveOrder',
    "B-06ac, Awaken Grove in a province of the wild's race, from content's race and its helper",
  ],
  [
    'src/engine/world/the-worlds-making/s00-the-set-up-the-maps-grid-and-the-provinces-names.ts',
    'themedName',
    "B-06ad, a province's name: the whale and shark waters and a wild province by the wild's sub-races, a race of none's names from content",
  ],
  [
    'src/engine/world/the-worlds-making/s03-every-province-made-its-terrain-tax-armies-and-lairs.ts',
    'everyProvinceMadeItsTerrainTaxArmiesAndLairs',
    "B-06ad, a wild province's sub-race, its defenders' grade and a province of no race's defenders, from content and the helpers",
  ],
  [
    'src/engine/world/the-worlds-making/s05-the-coastal-fleets-a-humanoid-shore-offers.ts',
    'theCoastalFleetsAHumanoidShoreOffers',
    "B-06ad, the fleet of a coast of no race, from the content's constant",
  ],
  [
    'src/engine/world/the-worlds-making/s06-the-seas-by-kind-primal-poor-waters-and-open-water.ts',
    'theSeasByKindPrimalPoorWatersAndOpenWater',
    "B-06ad, a primal sea's sub-race and its beasts' race, from content and the helper",
  ],
  [
    'src/engine/world/the-worlds-making/s09-each-home-tailored-and-its-king-and-heroes-made.ts',
    'eachHomeTailoredAndItsKingAndHeroesMade',
    "B-06ad, the creed's wild neighbour and the one-primal cap, from the helpers",
  ],
  [
    'src/engine/world/the-worlds-making/s09-each-home-tailored-and-its-king-and-heroes-made.ts',
    '_isHumanoid',
    "B-06ad, a home's humanoid neighbour: not the wild's, from the helper",
  ],
  [
    'src/engine/world/the-worlds-making/s10-the-two-crowns-given-wild-country-within-two-provinces-of-home.ts',
    'theTwoCrownsGivenWildCountryWithinTwoProvincesOfHome',
    "B-06ad, a crown's wild ring and the wild country turned, from the helpers",
  ],
  [
    'src/engine/world/the-worlds-making/s10-the-two-crowns-given-wild-country-within-two-provinces-of-home.ts',
    '_famOf',
    "B-06ad, a wild province's family: the wild's, from the helper",
  ],
  [
    'src/engine/world/the-worlds-making/s15-every-neutral-province-fields-the-strongest-mix-of-its-own-units.ts',
    'everyNeutralProvinceFieldsTheStrongestMixOfItsOwnUnits',
    "B-06ad, the wild left as it is and a slot of no race's, from content and the helper",
  ],
  [
    'src/engine/battle/terrain-and-unit-strength.ts',
    'armStr',
    "B-06ae, Woodland Mastery and the Bulwark, from the race gifts' runner",
  ],
  [
    'src/engine/battle/battles-against-province-defenders.ts',
    'combatVsNPC',
    "B-06ae, Raiders' Muster's flag, from the race gifts' runner",
  ],
  [
    'src/engine/battle/battles-between-heroes.ts',
    'combatVsChar',
    "B-06ae, Raiders' Muster's flag, from the race gifts' runner",
  ],
  [
    'src/engine/units/drill-and-spoils.ts',
    'markOrcAttackWin',
    "B-06ae, the War-spoils' stamp, from the race gifts' runner",
  ],
  [
    'src/engine/turn/early-winter-charms-fade-taxes-wages-raiders-muster-and-garrison-drill.ts',
    'earlyWinterCharmsFadeTaxesWagesRaidersMusterAndGarrisonDrill',
    "B-06ae, the War-spoils' half wage, from the race gifts' runner",
  ],
  [
    'src/engine/heroes/experience-skill-rises-and-earned-hp.ts',
    'trySkillGain',
    "B-06af, Quick learners in the field, from the race gifts' runner",
  ],
  [
    'src/engine/orders/research-and-practice-orders-discoveries-skill-drills-and-rest.ts',
    'resolvePracticeSkillOrder',
    "B-06af, Quick learners at practice, from the race gifts' runner",
  ],
  ['src/engine/heroes/skills-and-hp.ts', 'maxHpIsOrc', "B-06af, Iron constitution, from the race gifts' runner"],
  ['src/engine/personal-combat/helpers.ts', 'mithrilQualifies', "B-06af, Mithril Armour, from the race gifts' runner"],
  [
    'src/engine/orders/recruit-and-hire-orders-companies-mercenaries-and-heroes.ts',
    'resolveHireHeroOrder',
    "B-06af, Mithril Armour on a hire, from the race gifts' runner",
  ],
  [
    'src/engine/orders/alignment/broker-a-neutral-kings-order-to-hire-a-hero-or-buy-word-from-afar.ts',
    'resolveBrokerOrder',
    "B-06af, Mithril Armour on the Broker's hire, from the race gifts' runner",
  ],
  ['src/engine/units/drill-and-spoils.ts', 'humanXPMult', "B-06af, Drillmasters, from the race gifts' runner"],
  ['src/engine/graves.ts', 'recordBattleGraves', "B-06af, Homeward Flight, from the race gifts' runner"],
  [
    'src/engine/rules-on-plain-values/units-a-discoverys-effect-reaches-by-type-class-race-and-quality.ts',
    TOP,
    "B-06ag, the race of each unit type of the four races, content's",
  ],
  ['src/engine/discoveries.ts', '_isHumanoidRace', "B-06ag, the Plague's humanoid races, content's"],
  ['src/engine/army-tables.ts', TOP, "B-06ag, an old save's races of the wild renamed, content's"],
  [
    'src/engine/saves/upgrade-a-saved-game-and-check-it.ts',
    'everyNeutralHeroWearingABeastsRaceGivenAPeoplesRace',
    "B-06ag, the beasts' classes an old save's neutral hero may wear, content's",
  ],
  [
    'src/engine/bots/intel.ts',
    'botTuning',
    "B-06ah, the race's overlay, by the gift its row gives, from the race gifts' runners and the raceGift weights",
  ],
  [
    'src/engine/bots/intel.ts',
    'botRaceTerrainMult',
    "B-06ah, Woodland Mastery and the Bulwark in the bots' estimate, from the race gifts' runner",
  ],
  [
    'src/engine/bots/strategy.ts',
    'botRecruitableTypes',
    "B-06ah, a recruit's province of no race and the grudge's wild check, from content's constant and the helper",
  ],
  ['src/engine/bots/strategy.ts', 'effOf', "B-06ah, a recruit's province of no race, from content's constant"],
  [
    'src/engine/bots/missions.ts',
    'botSignaturePre',
    "B-06ah, no Call to Arms in a province of the wild's race, from the helper",
  ],
  [
    'src/engine/bots/missions.ts',
    'consider',
    "B-06ah, a sea's kind: the poor seas' race tags, content's, and the wild's sub-races, from the helper",
  ],
  ['src/engine/bots/specialists.ts', 'botScoutTarget', "B-06ah, a scout's wild province, from the helper"],
];

test.for(TAKEN)('%s: %s names no race (%s)', ([file, fn]) => {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const counts = raceChecksByFunction(file, text);
  expect(fn === TOP || counts.has(fn), `${file} declares ${fn}`).toBe(true);
  expect(counts.get(fn) ?? 0, `${fn}'s names of a race (the ratchet's helper)`).toBe(0);
  expect(everyStringIn(file, text, fn, namesARace), `every string in ${fn} naming a race`).toEqual([]);
});

test("the vocabulary holds content's humanoid races, the wild's race and the beasts' two classes, and no other word", () => {
  expect([...RACE_VOCABULARY]).toEqual([...KC_HUMANOID_RACES, 'Primal', 'Creature', 'Monster']);
  expect(['Primal:Wolf', 'Primal:'].map(namesARace), "a sub-race of the wild's").toEqual([true, true]);
  expect(['Undead', 'human', 'Orc Garrison', 'Primals'].map(namesARace), 'none of these').toEqual([
    false,
    false,
    false,
    false,
  ]);
});

// The helper finds what it counts: each form of a race planted in one function of the engine (an arrow given to a
// name counts for that name, as a named function does; one outside every function for the top level), and none of what
// isn't a race or is a literal type or a property's key.
test("the ratchet's helper counts each race's name, a literal type's and a key's aside", () => {
  const planted = `
    type Race = 'Human' | 'Elven';
    const HEARTLAND = { Human: 'plain', x: 'Dwarven' };
    export function planted(u: { race: string }, list: string[]) {
      const a = (u.race === 'Orcish') + list.includes('Primal') + ['Creature'].length;
      const inner = () => \`Monster\` + 'Primal:Wolf';
      function named() { return u.race || 'Human'; }
      switch (u.race) { case 'Elven': return a + inner() + named(); }
      return 'Undead' + 'human' + 'Orc Garrison';
    }`;
  expect(Object.fromEntries(raceChecksByFunction('src/engine/planted.ts', planted))).toEqual({
    [TOP]: 1,
    planted: 4,
    inner: 2,
    named: 1,
  });
});

// The count on the tree is the ratchet's baseline; a race planted in an engine function raises it by one, in the
// engine's world's making and its bots too, and the ratchet fails on it; one planted in src/engine/rules/ or a page's
// code isn't counted.
test.for([
  ['src/engine/world/generate.ts', "return 'Elven';", 1],
  ['src/engine/bots/setup.ts', "return 'Primal:Bear';", 1],
  ['src/engine/battle/terrain-and-unit-strength.ts', "return ['Human', 'Monster'];", 2],
  ['src/engine/rules/the-registry-of-alignment-abilities.ts', "return 'Dwarven';", 0],
  ['src/ui/player/map-symbols.ts', "return 'Orcish';", 0],
] as const)('%s: %s raises raceChecksInEngine by %i', ([file, body, rise]) => {
  const files = theCodeFiles();
  const asTheyAre = { ...readBaseline(), raceChecksInEngine: raceChecksInEngine(files) };
  expect(asTheyAre.raceChecksInEngine, 'raceChecksInEngine on the tree as it is').toBe(
    readBaseline()['raceChecksInEngine'],
  );
  const withThePlant = files.map(([f, text]): [string, string] =>
    f === file ? [f, `${text}\nexport function aPlantedRace() { ${body} }\n`] : [f, text],
  );
  const planted = { ...asTheyAre, raceChecksInEngine: raceChecksInEngine(withThePlant) };
  expect(planted.raceChecksInEngine, `raceChecksInEngine with ${body} planted in ${file}`).toBe(
    asTheyAre.raceChecksInEngine + rise,
  );
  expect(compare(asTheyAre, planted).rose, 'the ratchet fails on a rise').toHaveLength(rise > 0 ? 1 : 0);
});
