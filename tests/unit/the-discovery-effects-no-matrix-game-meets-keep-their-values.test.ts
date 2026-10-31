// The discoveries' effects no matrix game meets keep their values (plan P1-19's discoveries family, the tests of its
// rows: each effect the scoping counted 0 meetings of in the 60 games of set A, where "identical" proves nothing). The
// later rows of the family add their own cases here.
// - P1-19aa: a realm's own-ground discoveries (`defOwn`: Sanctified Walls, +15% anywhere it holds; Bulwark of the
//   Realm, +30% at its home only), in the registry's runner and in a battle against a province's defenders that a
//   realm holds (combatVsNPC): each share where it holds, none away from home for Bulwark, the two together capped at
//   the kind's ceiling (+30%), none when the attacker holds the province, and the realm's home asked only by an effect
//   that needs it (asking may fix a realm's home). Between two heroes' hosts the line is
//   tests/unit/the-sides-and-the-defenders-of-a-battle-against-a-province-in-the-lines-no-matrix-game-reaches.test.ts's.
//   And the army's other effects on rows the content doesn't write (planted in the table of the discoveries by id for
//   their case, and taken out after): a siege, own-ground, fanaticism or casting effect with no number, a siege's unit
//   types met by no unit, a gap among the attacker's units (none but gaps: nothing), a gap in a force asked for a class
//   of unit (no unit of it, a humanoid's neither), a unit's strength stacked past its ceiling (×1.30).
// - P1-19ab: Homeward Song (re10: +40 to an Elven unit's chance of slipping away home; met 4 times in 1 game of the
//   matrix, which no game's outcome shows), in recordBattleGraves called with its die fed: the fallen unit flees home
//   on a roll its song lifts it past, and leaves a grave without the song. And the lines' and the fates' effects on rows
//   the content doesn't write: a beaten unit's death cut stacked past its floor (a quarter), a side asked with none
//   given, a flight home or a surgery with no number (Battlefield Surgery's 20%: discParam's fallback, moved as it is),
//   and Flanking Tactics' weights when no discovery has the kind.
// - P1-19ac: a fighter's aim steadied against each kind of foe (Saints' Relics against the undead, a hero or a guardian:
//   no game meets it; Bestiaries, Champions' Tourney, Duelling Code), in pcHitChance and pcArrowHitChance, the foe's
//   kind asked only by an effect against the undead; Veteran Training's +1 in a hero's fighter (pcCharCombatant, his
//   Melee, Archery and their raw levels) and on his card (extraSkillBonuses), which games meet but no test saw; Mithril
//   Craft in his fighter; the Order of the Golden Shield in awardHpRoll (the king's gain and earned hit points doubled,
//   no other hero's), its die fed; and an aim, a Mithril and a rise on rows the content doesn't write.
// - P1-19ad: the spies', explorers', scholars' and resters' discoveries and Watch Houses, in their runners on a staged
//   realm: each kind anywhere and only on the ground, coast or home its row names (a rival's cut and a rest's: no game
//   meets them), each question asked only by an effect that needs it, the report's odds (no province, field or skill
//   named), Disguise Techniques' and Ancient Lore's chance and share, The Long Hunt's turn (its order's case is
//   tests/lib/explore-and-search-order-cases.ts'), Medical Arts; and each kind on a row with no number.
// - P1-19ae: the recruits' and the realm's works' discoveries in their runners on a staged realm: Diplomatic
//   Protocols' waiver, Holy Sites for a consecrator of White 3 and less (and a row's White 0, read as 1), Muster Rolls'
//   quality and chance, the corpse-carters' cost, a band's price by class (no game meets these four), a unit's price
//   (each effect in turn: its gold added, then its factor, rounded up), a recruit's grade by type and class (capped at
//   1 by discRecruitQChance), Rites of Plenty; and each kind on a row with no number.
// - P1-19af: war's spoils and the march, in their runners on a staged realm and in the functions that ask them: Skull
//   Tithe in a Pagan victor's blood harvest (bloodHarvest), Reign of Terror in the stacks an Evil victory leaves and its
//   line (spreadTerror), the plunder discoveries on the ground they name (applyEvilConquest; no game meets these three
//   but Skull Tithe, once, and no test saw it), the march's discoveries for each unit they reach (a land unit of Speed
//   1–2: computeMovePoolMax and garrisonMoveRate), Signal Fires' unify points; and each kind on a row with no number.
// - P1-19ag: the turn's end and the new turn, in their runners on a staged realm and in the functions that ask them: a
//   province's tax by each filter (its coast and home asked only by an effect that needs them, once each filter before
//   holds), each effect under the realm's ceiling and its row's own, its account kept across provinces; Taxation
//   Records; interest; a unit's and a hero's wage cut in turn, never below 1g, and the heroes' ceiling; a hero's maximum
//   HP for the king, the heroes or a skill; the gardens; the Embalmers' rate; War Academy's and Herbal Lore's chance and
//   share; Informant Network and Arcane Observatory; and each kind on a row with no number.
// - P1-19ah: the bots' strength estimates (botEffForce, botBattleForce, botDruidShortfall, botRecruitableTypes) with
//   Dragon Taming and Flanking Tactics, which the matrix meets in the bots' plan but no test saw: an Elder Dragon led
//   at full strength by a Druid-0 commander whose realm holds Dragon Taming, and at a Druid shortfall of 5 without it,
//   with no realm or no list of realms; a host's lines behind the front weighted with Flanking Tactics, for a commander
//   of a realm that holds it only. (Messenger Birds is made sure by the code: nothing reads the set it widens.)
// Level 1 (unit): the runner on a staged realm, and combatVsNPC, recordBattleGraves, the to-hit chances,
// pcCharCombatant, extraSkillBonuses and awardHpRoll called directly (on a world the engine makes from a fixed seed, or
// a staged realm), no turn played; whether the line is written is decided before any die is drawn (a seeded stream
// feeds the rest of the battle), and the graves' and the hardening's one die is fed. Not lower: the effects read the
// content's rows and the battle writes the line. Not higher: a whole turn adds dice and orders before the battle, and no
// bot researches these discoveries in the matrix.
import '../lib/the-whole-engine.ts';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { KC_SEASONS } from '../../src/content/kingdoms-call-data.ts';
import { kcRng, kcRngStream } from '../../src/engine/rng.ts';
import { generateBotSetups, isBotRow } from '../../src/engine/bots/setup.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { createTurnContext } from '../../src/engine/turn/context.ts';
import { homeProvinceIdFor } from '../../src/engine/grand-design.ts';
import { combatVsNPC } from '../../src/engine/battle/battles-against-province-defenders.ts';
import { recordBattleGraves } from '../../src/engine/graves.ts';
import { pcHitChance } from '../../src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts';
import { pcArrowHitChance } from '../../src/engine/personal-combat/melee-flight-and-archery.ts';
import {
  pcCharCombatant,
  pcMonsterCombatant,
  pcNewStatus,
} from '../../src/engine/personal-combat/speed-encounter-plans-and-combatants.ts';
import { extraSkillBonuses } from '../../src/engine/titles/reckoning.ts';
import { awardHpRoll } from '../../src/engine/heroes/experience-skill-rises-and-earned-hp.ts';
import { bloodHarvest } from '../../src/engine/battle/blood-harvest-and-iron-throne.ts';
import { spreadTerror } from '../../src/engine/battle/evil-terror.ts';
import { applyEvilConquest } from '../../src/engine/realms/relations-and-captures.ts';
import { computeMovePoolMax } from '../../src/engine/units/movement-pools.ts';
import { garrisonMoveRate } from '../../src/engine/units/movement.ts';
import { botBattleForce, botDruidShortfall, botEffForce } from '../../src/engine/bots/intel.ts';
import { botRecruitableTypes } from '../../src/engine/bots/strategy.ts';
import {
  DISC_BY_ID,
  doARealmsDiscoveriesWeightTheLinesBehindTheFront,
  theChanceARealmsDiscoveriesDragAHeroFromTheField,
  theMultiplierARealmsDiscoveriesLeaveOnABeatenUnitsDeath,
  theWeightsADiscoveryGivesTheLinesBehindTheFront,
  whatARealmsDiscoveriesAddToAFallenUnitsFlightHome,
  theFactorARealmsDiscoveriesStrengthenAUnitBy,
  theShareARealmsDiscoveriesFortifyItsOwnGroundBy,
  whatARealmsDiscoveriesAddToACastersChance,
  whatARealmsDiscoveriesAddToASidesFanaticism,
  whatARealmsDiscoveriesAddToASiege,
  theFactorARealmsDiscoveriesHardenTheKingBy,
  theLevelsARealmsDiscoveriesAddToAFightersSkills,
  whatARealmsDiscoveriesAddToAFightersAim,
  whatARealmsDiscoveriesAddToAFightersMithril,
  whatARealmsDiscoveriesAddToASkillsRise,
  aRealmsDiscoveriesHealARestingHeroInFull,
  theChanceARealmsDiscoveriesKeepASpysSuccessQuiet,
  theFactorARealmsDiscoveriesMultiplyExploringBy,
  theShareARealmsDiscoveriesMapAroundAnExplorer,
  theSharesARealmsDiscoveriesAddToPracticeSkillBySkill,
  theTurnsARealmsDiscoveriesLengthenTheWildHuntBy,
  whatARealmsDiscoveriesAddToALairsGold,
  whatARealmsDiscoveriesAddToALairsItemChance,
  whatARealmsDiscoveriesAddToARestsHeal,
  whatARealmsDiscoveriesAddToASpysChance,
  whatARealmsDiscoveriesAddToCatchingASpy,
  whatARealmsDiscoveriesAddToPractice,
  whatARealmsDiscoveriesAddToResearch,
  whatARealmsDiscoveriesAddToSpottingALurker,
  whatARealmsDiscoveriesAddToSpyingOnAHero,
  whatARealmsDiscoveriesCutARivalSpysChanceBy,
  doARealmsDiscoveriesWaiveTheHiringBan,
  theQualitiesARealmsDiscoveriesMayRaiseACallToArmsAt,
  theUnitsPriceARealmsDiscoveriesLeave,
  whatARealmsDiscoveriesAddToABless,
  whatARealmsDiscoveriesAddToAMercenaryBandsPrice,
  whatARealmsDiscoveriesAddToARecruitsChanceOfAHigherGrade,
  whatARealmsDiscoveriesAddToTheConsecrationsACrownMayHold,
  whatARealmsDiscoveriesAddToTheCorpseCartersCost,
  whatARealmsDiscoveriesAddToABloodHarvest,
  whatARealmsDiscoveriesAddToAConquestsPlunder,
  whatARealmsDiscoveriesAddToAMarch,
  whatARealmsDiscoveriesAddToConvergingColumnsChanceToUnite,
  whatARealmsDiscoveriesAddToTheTerrorAVictoryLeaves,
  doARealmsDiscoveriesAddToTheRealmsTax,
  doARealmsDiscoveriesChartAProvince,
  doARealmsDiscoveriesHealTheWounded,
  doARealmsDiscoveriesNameAnUnseenCaptain,
  theChanceARealmsDiscoveriesPromoteTheCapitalsArmies,
  theGoldADiscoveryAddsToTheRealmsTax,
  theHpARealmsDiscoveriesHealAWoundedHeroBy,
  theRateARealmsDiscoveriesLetTheGravesRotAt,
  theShareARealmsDiscoveriesDressAFightersWoundsBy,
  theWageARealmsDiscoveriesCeilingsLeaveAHero,
  theWageARealmsDiscoveriesCutsLeaveAHero,
  theWageARealmsDiscoveriesLeaveAUnit,
  whatARealmsDiscoveriesAddToAHerosMaximumHp,
  whatARealmsDiscoveriesAddToAProvincesTax,
  whatARealmsDiscoveriesEarnInInterest,
} from '../../src/engine/rules/the-registry-of-discovery-effects.ts';
import {
  THE_REPORTS_ODDS_NAME_NO_PROVINCE,
  THE_REPORTS_PRACTICE_NAMES_NO_SKILL,
  THE_REPORTS_RESEARCH_NAMES_NO_FIELD,
} from '../../src/engine/rules/discoveries/a-realms-discoveries-in-its-heroes-orders-and-its-sight.ts';
import {
  discExploreMult,
  discHeroWage,
  discMaxHpFor,
  discRecruitQChance,
  discTaxAdd,
  discUpkeepWage,
  realmRecruitCost,
  taxRecordsGold,
} from '../../src/engine/discoveries.ts';
import { detRoll, spotEnemyInOwnedProvince } from '../../src/engine/heroes/fame-and-consecration.ts';
import type { ArmyInABattle } from '../../src/engine/army-tables.ts';
import type { AFighterInAPersonalCombat } from '../../src/engine/personal-combat/helpers.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import { theWordsOf } from '../../src/views/prose/the-words-of-each-line.ts';
import { addTheFieldsResolveTurnAdds } from '../lib/the-fields-resolve-turn-adds-to-the-turns-context.ts';

// The GM's log echoes each line on the console: quiet while the battles write lines.
const consoleLog = console.log;
beforeAll(() => {
  console.log = () => undefined;
});
afterAll(() => {
  console.log = consoleLog;
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** Sanctified Walls (Divine: +15% on any ground the realm holds) and Bulwark of the Realm (Good: +30% at its home). */
const SANCTIFIED_WALLS = { id: 'ad08' };
const BULWARK_OF_THE_REALM = { id: 'ag10' };

describe("a realm's own-ground discoveries, in the registry's runner", () => {
  test.for([
    ['Sanctified Walls, away from home', [SANCTIFIED_WALLS], false, 0.15],
    ['Sanctified Walls, at home', [SANCTIFIED_WALLS], true, 0.15],
    ['Bulwark of the Realm, away from home', [BULWARK_OF_THE_REALM], false, 0],
    ['Bulwark of the Realm, at home', [BULWARK_OF_THE_REALM], true, 0.3],
    ['the two, away from home', [SANCTIFIED_WALLS, BULWARK_OF_THE_REALM], false, 0.15],
    ['the two, at home: capped at the ceiling', [SANCTIFIED_WALLS, BULWARK_OF_THE_REALM], true, 0.3],
    ['none', [], true, 0],
  ] as const)('%s', ([, discoveries, atHome, share]) => {
    expect(
      theShareARealmsDiscoveriesFortifyItsOwnGroundBy({ discoveries }, { isItTheRealmsHome: () => atHome }),
    ).toBeCloseTo(share, 12);
  });

  test('the realm with no discoveries, or none: no share', () => {
    expect(theShareARealmsDiscoveriesFortifyItsOwnGroundBy(undefined, { isItTheRealmsHome: () => true })).toBe(0);
    expect(theShareARealmsDiscoveriesFortifyItsOwnGroundBy({}, { isItTheRealmsHome: () => true })).toBe(0);
  });

  test('its home is asked only by an effect that needs it, once each', () => {
    const isItTheRealmsHome = vi.fn(() => true);
    theShareARealmsDiscoveriesFortifyItsOwnGroundBy({ discoveries: [SANCTIFIED_WALLS] }, { isItTheRealmsHome });
    expect(isItTheRealmsHome).not.toHaveBeenCalled();
    theShareARealmsDiscoveriesFortifyItsOwnGroundBy(
      { discoveries: [SANCTIFIED_WALLS, BULWARK_OF_THE_REALM] },
      { isItTheRealmsHome },
    );
    expect(isItTheRealmsHome).toHaveBeenCalledTimes(1);
  });
});

/** Runs `fn` with rows planted in the discoveries' table (each id `test-<key>`, its effect as given), and a realm that
 *  holds them; the rows are taken out after. */
function withPlantedRows<T>(effects: Record<string, object>, fn: (realm: { discoveries: { id: string }[] }) => T): T {
  const ids = Object.keys(effects).map((k) => `test-${k}`);
  Object.entries(effects).forEach(([k, effect]) => {
    Reflect.set(DISC_BY_ID, `test-${k}`, { id: `test-${k}`, name: k, category: 'Test', desc: '', effect });
  });
  try {
    return fn({ discoveries: ids.map((id) => ({ id })) });
  } finally {
    ids.forEach((id) => Reflect.deleteProperty(DISC_BY_ID, id));
  }
}

describe("the army's effects on rows the content doesn't write", () => {
  test("a siege: no delta, unit types no unit has, a gap among the attacker's units", () => {
    const added = withPlantedRows(
      {
        bare: { kind: 'siege' },
        rams: { kind: 'siege', delta: 0.1, withTypes: ['Ironhoof Rams'] },
        guns: { kind: 'siege', delta: 0.2, withTypes: ['Mountain Guns'] },
      },
      (realm) =>
        whatARealmsDiscoveriesAddToASiege(realm, { theAttackersUnits: [null, undefined, { type: 'Mountain Guns' }] }),
    );
    expect(added).toBeCloseTo(0.2, 12);
  });

  test("a siege whose unit types only a gap among the attacker's units could hold: nothing", () => {
    const added = withPlantedRows({ guns: { kind: 'siege', delta: 0.2, withTypes: ['Mountain Guns'] } }, (realm) =>
      whatARealmsDiscoveriesAddToASiege(realm, { theAttackersUnits: [null, undefined] }),
    );
    expect(added).toBe(0);
  });

  test("fanaticism with a class of unit in the force: a gap in the force is no unit of it, a humanoid's neither", () => {
    const added = withPlantedRows({ kin: { kind: 'fanatic', pct: 0.1, withCls: 'humanoid' } }, (realm) => [
      whatARealmsDiscoveriesAddToASidesFanaticism(realm, { theSide: 'def', theGround: 'plain', theForce: [null] }),
      whatARealmsDiscoveriesAddToASidesFanaticism(realm, {
        theSide: 'def',
        theGround: 'plain',
        theForce: [null, { type: 'Men-at-Arms' }],
      }),
    ]);
    expect(added).toEqual([0, 0.1]);
  });

  test('own ground, fanaticism and casting: no pct', () => {
    const got = withPlantedRows(
      {
        ground: { kind: 'defOwn' },
        walls: { kind: 'defOwn', pct: 0.1 },
        zeal: { kind: 'fanatic' },
        fury: { kind: 'fanatic', pct: 0.1 },
        cast: { kind: 'cast' },
        lore: { kind: 'cast', pct: 4 },
      },
      (realm) => [
        theShareARealmsDiscoveriesFortifyItsOwnGroundBy(realm, { isItTheRealmsHome: () => true }),
        whatARealmsDiscoveriesAddToASidesFanaticism(realm, { theSide: 'atk', theGround: 'plain', theForce: [] }),
        whatARealmsDiscoveriesAddToACastersChance(realm, { theSchool: 'white', whereHeCasts: 'battle' }),
      ],
    );
    expect(got).toEqual([0.1, 0.1, 4]);
  });

  test("a unit's strength stacked past the kind's ceiling: ×1.30", () => {
    const factor = withPlantedRows(
      { drums: { kind: 'unitStr', pct: 0.2 }, horns: { kind: 'unitStr', pct: 0.2 } },
      (realm) =>
        theFactorARealmsDiscoveriesStrengthenAUnitBy(realm, {
          theUnit: { type: 'Free Lances' },
          theGround: 'plain',
          isItsSideTheAttacker: true,
          isItLedByTheKing: false,
          hasItACommander: true,
        }),
    );
    expect(factor).toBe(1.3);
  });

  test("casting: a school or a place that isn't his", () => {
    const got = withPlantedRows(
      {
        fire: { kind: 'cast', pct: 3, school: 'elemental' },
        duel: { kind: 'cast', pct: 5, ctx: 'duel' },
        any: { kind: 'cast', pct: 7, school: 'white', ctx: 'battle' },
      },
      (realm) => [
        whatARealmsDiscoveriesAddToACastersChance(realm, { theSchool: 'white', whereHeCasts: 'battle' }),
        whatARealmsDiscoveriesAddToACastersChance(realm, { theSchool: 'elemental', whereHeCasts: 'duel' }),
      ],
    );
    expect(got).toEqual([7, 8]);
  });
});

/** Homeward Song (Elven Heritage: +40 to an Elven unit's chance of slipping away home), and Battlefield Surgery (15%). */
const HOMEWARD_SONG = { id: 're10' };
const BATTLEFIELD_SURGERY = { id: 'sd36' };

/** An Elven realm holding the discoveries given loses one Elven company on the ground given, its die fed: whether the
 *  company slipped away home (queued, no grave) or left a grave. */
function anElvenCompanyFalls(
  discoveries: readonly { readonly id: string }[],
  terrain: string,
  theDie: number,
): 'it slips away home' | 'it leaves a grave' {
  const queue: unknown[] = [];
  const tc = { G: { players: [{ race: 'Elven', discoveries }] }, _elvenEscapeQueue: queue };
  const field: { terrain: string; battleGraves?: unknown[] } = { terrain };
  const was = kcRng.use(() => theDie);
  try {
    recordBattleGraves(
      tc,
      field,
      [{ type: 'Elven Archers', quality: 'Average', race: 'Elven', unitName: 'Wardens' }],
      0,
    );
  } finally {
    kcRng.use(was);
  }
  if (queue.length === 1 && field.battleGraves?.length === 0) return 'it slips away home';
  if (queue.length === 0 && field.battleGraves?.length === 1) return 'it leaves a grave';
  throw new Error('the company both fled and left a grave, or neither');
}

describe('Homeward Song, as a fallen Elven company rolls to slip away home (recordBattleGraves)', () => {
  test.for([
    ['the song, on the plain: 80 is below 45 + 40', [HOMEWARD_SONG], 'plain', 0.8, 'it slips away home'],
    ['no song, on the plain: 80 is not below 45', [], 'plain', 0.8, 'it leaves a grave'],
    ['the song, on the plain: 86 is not below 45 + 40', [HOMEWARD_SONG], 'plain', 0.86, 'it leaves a grave'],
    ['the song, in the forest: 99 is below 60 + 40', [HOMEWARD_SONG], 'forest', 0.99, 'it slips away home'],
    ['no song, in the forest: 99 is not below 60', [], 'forest', 0.99, 'it leaves a grave'],
  ] as const)('%s', ([, discoveries, terrain, theDie, what]) => {
    expect(anElvenCompanyFalls(discoveries, terrain, theDie)).toBe(what);
  });

  test("the runner: the song's 40 points, none for a realm without it or no realm", () => {
    expect(whatARealmsDiscoveriesAddToAFallenUnitsFlightHome({ discoveries: [HOMEWARD_SONG] })).toBe(40);
    expect(whatARealmsDiscoveriesAddToAFallenUnitsFlightHome({ discoveries: [] })).toBe(0);
    expect(whatARealmsDiscoveriesAddToAFallenUnitsFlightHome(undefined)).toBe(0);
  });
});

describe("the lines' and the fates' effects, in their runners", () => {
  test("Battlefield Surgery's chance: its row's 15%, or nothing for a realm without it", () => {
    expect(theChanceARealmsDiscoveriesDragAHeroFromTheField({ discoveries: [BATTLEFIELD_SURGERY] })).toBe(0.15);
    expect(theChanceARealmsDiscoveriesDragAHeroFromTheField({ discoveries: [HOMEWARD_SONG] })).toBeNull();
    expect(theChanceARealmsDiscoveriesDragAHeroFromTheField(undefined)).toBeNull();
  });

  test("Flanking Tactics: a realm holding it has its lines weighted, by its row's four; one without, not", () => {
    expect(doARealmsDiscoveriesWeightTheLinesBehindTheFront({ discoveries: [{ id: 'sd09' }] })).toBe(true);
    expect(doARealmsDiscoveriesWeightTheLinesBehindTheFront({ discoveries: [BATTLEFIELD_SURGERY] })).toBe(false);
    expect(doARealmsDiscoveriesWeightTheLinesBehindTheFront(undefined)).toBe(false);
    expect(theWeightsADiscoveryGivesTheLinesBehindTheFront()).toEqual([1, 0.5625, 0.3125, 0.1563]);
  });
});

describe("the lines' and the fates' effects on rows the content doesn't write", () => {
  const unit = { type: 'Free Lances', quality: 'Average', race: 'Human' };

  test("a beaten unit's death cut stacked past the kind's floor: a quarter", () => {
    const left = withPlantedRows(
      { mail: { kind: 'deathRed', pct: 0.5 }, plate: { kind: 'deathRed', pct: 0.4 } },
      (realm) => theMultiplierARealmsDiscoveriesLeaveOnABeatenUnitsDeath(realm, { theUnit: unit, theSide: 'atk' }),
    );
    expect(left).toBe(0.25);
  });

  test("a death cut for one side: the other side's unit, and a unit whose side isn't given, keep their chance", () => {
    const left = withPlantedRows({ charge: { kind: 'deathRed', pct: 0.4, side: 'atk' } }, (realm) =>
      (['atk', 'def', null, undefined] as const).map((theSide) =>
        theMultiplierARealmsDiscoveriesLeaveOnABeatenUnitsDeath(realm, { theUnit: unit, theSide }),
      ),
    );
    expect(left).toEqual([0.6, 1, 1, 1]);
  });

  test("a flight home with no number, beside one with: the other's points; a surgery with no number, before one with: 20%", () => {
    const got = withPlantedRows(
      {
        hum: { kind: 'elvenEscape' },
        song: { kind: 'elvenEscape', pct: 10 },
        knife: { kind: 'nearDeathSurvival' },
        saw: { kind: 'nearDeathSurvival', pct: 0.3 },
      },
      (realm) => [
        whatARealmsDiscoveriesAddToAFallenUnitsFlightHome(realm),
        theChanceARealmsDiscoveriesDragAHeroFromTheField(realm),
      ],
    );
    expect(got).toEqual([10, 0.2]);
  });

  test("Flanking Tactics' weights when no discovery has the kind: none", () => {
    const sd09: unknown = Reflect.get(DISC_BY_ID, 'sd09');
    try {
      Reflect.deleteProperty(DISC_BY_ID, 'sd09');
      expect(theWeightsADiscoveryGivesTheLinesBehindTheFront()).toBeUndefined();
    } finally {
      Reflect.set(DISC_BY_ID, 'sd09', sd09);
    }
  });
});

interface Character {
  id: number | string;
  player: number | null;
  isKing?: boolean;
  alive: boolean;
  location: number;
  armies: ArmyInABattle[];
  encounterPlan?: { tactics: string[]; duelStance: string };
  [key: string]: unknown;
}
interface Province {
  id: number;
  terrain: string;
  owner: number | null;
  characters: (number | string)[];
  neutralDefenders?: ArmyInABattle[];
  [key: string]: unknown;
}
interface World {
  turn: number;
  relations: Record<string, string>;
  characters: Character[];
  players: { name: string; discoveries: { id: string }[] }[];
  world: { cols: number; rows: number; provinces: Province[] };
}

// A world of two bot realms, made by the engine from a fixed seed, kept as JSON: each battle stages a fresh copy.
kcRng.seed(1);
const THE_WORLD = JSON.stringify(
  generateNewGame(
    (generateBotSetups([], 2, 0) as Record<string, unknown>[]).map((b) => ({
      ...b,
      gamePlayerId: 'gp' + String(b['id']),
      name: b['kingdomName'],
    })),
    { cols: 10, rows: 6 },
    999,
    { seaPct: 10 },
  ),
);

/** `n` companies of the type and quality given. */
const companies = (n: number, quality: string): ArmyInABattle[] =>
  Array.from({ length: n }, (_, i) => ({
    type: 'Men-at-Arms',
    quality,
    race: 'Human',
    unitName: `Company ${String(i)}`,
  }));

/** Realm 0's king attacks a province of realm 1 (its home, or another it holds), held by its garrison with no guard to
 *  lead it, realm 1 holding the discoveries given (or realm 0 holding the province, `the attackers`). The lines the
 *  battle writes, in words, and realm 1's name. */
function aBattleAgainstAGarrison(
  discoveries: readonly { readonly id: string }[],
  where: 'its home' | 'away from home' | 'the attackers',
): { readonly words: readonly string[]; readonly realm1: string } {
  const G = JSON.parse(THE_WORLD) as World;
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
  tc._currentPhase = 1;
  tc._logCtx.phase = 1;
  G.relations['0-1'] = 'enemy';
  const atk = G.characters.find((c) => c.alive && c.player === 0 && c.isKing);
  const realm1 = G.players[1];
  const home = homeProvinceIdFor(G as never, 1);
  const field =
    where === 'its home'
      ? G.world.provinces.find((p) => p.id === home)
      : G.world.provinces.find((p) => p.terrain === 'plain' && p.owner === null && p.id !== home);
  if (!atk || !realm1 || !field) throw new Error('the world has no king in realm 0, no realm 1 or no field');
  field.owner = where === 'the attackers' ? 0 : 1;
  realm1.discoveries = discoveries.map((d) => ({ ...d }));
  Object.assign(field, { characters: [atk.id], features: [], garrisonArmies: [], npcArmies: 0 });
  field.neutralDefenders = companies(2, 'Green');
  atk['_attackedFrom'] = atk.location;
  atk.location = field.id;
  atk.armies = companies(4, 'Average');
  atk.encounterPlan = { tactics: ['ME', 'ME', 'ME', 'ME', 'ME'], duelStance: 'refuse' };
  const was = kcRng.use(kcRngStream(7));
  let narrative: NarrativeLine[];
  try {
    narrative = (combatVsNPC(tc, atk, field, null) as { narrative: NarrativeLine[] }).narrative;
  } finally {
    kcRng.use(was);
  }
  return { words: narrative.map((l) => theWordsOf(l)), realm1: realm1.name };
}

describe("a realm's own-ground discoveries, in a battle against a province's defenders it holds", () => {
  test.for([
    ['Sanctified Walls, away from home', [SANCTIFIED_WALLS], 'away from home', 15],
    ['Bulwark of the Realm, at home', [BULWARK_OF_THE_REALM], 'its home', 30],
    ['the two, at home: capped at the ceiling', [SANCTIFIED_WALLS, BULWARK_OF_THE_REALM], 'its home', 30],
    ['the two, away from home', [SANCTIFIED_WALLS, BULWARK_OF_THE_REALM], 'away from home', 15],
  ] as const)('%s', ([, discoveries, where, pct]) => {
    const shown = aBattleAgainstAGarrison(discoveries, where);
    expect(shown.words).toContain(
      `  🛡 ${shown.realm1}'s realm holds its own ground the harder (+${String(pct)}% defence).`,
    );
  });

  test.for([
    ['Bulwark of the Realm, away from home', [BULWARK_OF_THE_REALM], 'away from home'],
    ['none', [], 'its home'],
    ['the attacker holds the province', [SANCTIFIED_WALLS, BULWARK_OF_THE_REALM], 'the attackers'],
  ] as const)('%s: no line', ([, discoveries, where]) => {
    const shown = aBattleAgainstAGarrison(discoveries, where);
    expect(shown.words.filter((w) => w.includes('holds its own ground the harder'))).toEqual([]);
  });
});

/** Realm 0's king attacks a free province held by twelve companies, led by a guard hero of realm 1 (or of no realm),
 *  realm 1 holding the discoveries given: the defenders' strength in their battle lines, as the GM's ladder gives it. */
function theDefendersLinesStrength(
  discoveries: readonly { readonly id: string }[],
  guard: 'of realm 1' | 'of no realm',
) {
  const G = JSON.parse(THE_WORLD) as World;
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
  tc._currentPhase = 1;
  tc._logCtx.phase = 1;
  G.relations['0-1'] = 'enemy';
  const atk = G.characters.find((c) => c.alive && c.player === 0 && c.isKing);
  const theGuard = G.characters.find((c) => c.alive && c.player === 1 && !c.isKing);
  const realm1 = G.players[1];
  const field = G.world.provinces.find((p) => p.terrain === 'plain' && p.owner === null);
  if (!atk || !theGuard || !realm1 || !field)
    throw new Error('the world has no king in realm 0, no hero in realm 1 or no field');
  realm1.discoveries = discoveries.map((d) => ({ ...d }));
  if (guard === 'of no realm') theGuard.player = null;
  Object.assign(field, { characters: [atk.id], features: [], garrisonArmies: [], npcArmies: 0 });
  field.neutralDefenders = companies(12, 'Average');
  theGuard.location = field.id;
  theGuard.armies = [];
  atk['_attackedFrom'] = atk.location;
  atk.location = field.id;
  atk.armies = companies(4, 'Average');
  atk.encounterPlan = { tactics: ['ME', 'ME', 'ME', 'ME', 'ME'], duelStance: 'refuse' };
  const was = kcRng.use(kcRngStream(7));
  let narrative: NarrativeLine[];
  try {
    narrative = (combatVsNPC(tc, atk, field, theGuard) as { narrative: NarrativeLine[] }).narrative;
  } finally {
    kcRng.use(was);
  }
  const theLines = narrative.flatMap((l) =>
    l.kind === "the strength ladder's battle lines" ? [l.battleLinesStrength] : [],
  );
  if (theLines.length !== 2)
    throw new Error(`the battle wrote ${String(theLines.length)} ladders of battle lines, not 2`);
  const [, theDefenders] = theLines;
  if (theDefenders === undefined) throw new Error('the battle wrote no ladder of battle lines for the defenders');
  return theDefenders;
}

describe("Flanking Tactics held by the realm of a guard hero who leads a free province's defenders (combatVsNPC)", () => {
  test('his realm holding it weights the lines behind the front: more strength than without; a guard of no realm, none', () => {
    const withIt = theDefendersLinesStrength([{ id: 'sd09' }], 'of realm 1');
    const without = theDefendersLinesStrength([], 'of realm 1');
    expect(withIt).toBeGreaterThan(without);
    expect(theDefendersLinesStrength([{ id: 'sd09' }], 'of no realm')).toBe(without);
  });
});

/** Saints' Relics (+20% to hit an undead foe), Bestiaries (+20% a monster), Champions' Tourney (+19% a character),
 *  Duelling Code (+14% any foe), Veteran Training (+1 Melee and Archery in a fight), the Order of the Golden Shield
 *  (the king's hardening doubled) and Mithril Craft (Mithril turns aside 4, not 2). */
const SAINTS_RELICS = { id: 'ad14' };
const BESTIARIES = { id: 'sd73' };
const CHAMPIONS_TOURNEY = { id: 'sd74' };
const DUELLING_CODE = { id: 'sd33' };
const VETERAN_TRAINING = { id: 'sd37' };
const GOLDEN_SHIELD = { id: 'sd35' };
const MITHRIL_CRAFT = { id: 'rd08' };

/** A plain fighter (a guardian of no perks, 20 HP, Melee and Archery 2, no wards, of the temper "None": no bonus), with
 *  the fields given. */
function aFighter(over: Record<string, unknown> = {}): AFighterInAPersonalCombat {
  return { ...pcMonsterCombatant({ name: 'Made-up Mole', hp: 20, melee: 2 }), archery: 2, ...over };
}

/** The foes an aim may be steadied against: a hero of the undead, a living hero, an undead guardian and a beast. */
const THE_FOES = {
  'an undead hero': { kind: 'character', isUndead: true, cat: undefined },
  'a living hero': { kind: 'character', isUndead: false, cat: undefined },
  'an undead guardian': { kind: 'monster', cat: 'undead' },
  'a beast': { kind: 'monster', cat: 'beast' },
} as const;

/** A fighter of realm 0, holding the discoveries given, swings at (or shoots) each foe: his chances to hit. */
function theChancesToHitEachFoe(
  discoveries: readonly { readonly id: string }[],
  how: 'a blow' | 'an arrow',
): Record<keyof typeof THE_FOES, number> {
  const tc = { G: { players: [{ discoveries }] } } as unknown as Parameters<typeof pcHitChance>[0];
  const out: Partial<Record<keyof typeof THE_FOES, number>> = {};
  for (const [name, foe] of Object.entries(THE_FOES) as [keyof typeof THE_FOES, object][]) {
    const actor = aFighter({ player: 0, status: pcNewStatus() });
    const target = aFighter({ ...foe, status: pcNewStatus() });
    out[name] = how === 'a blow' ? pcHitChance(tc, actor, target) : pcArrowHitChance(tc, actor, target);
  }
  return out as Record<keyof typeof THE_FOES, number>;
}

describe("a fighter's aim steadied by his realm's discoveries, against each kind of foe (pcHitChance, pcArrowHitChance)", () => {
  // 30 + 10 × Melee (or Archery) 2: 50 against any foe, before the discoveries
  test.for([
    ['none', [], [50, 50, 50, 50]],
    ["Saints' Relics: the undead only, a hero or a guardian", [SAINTS_RELICS], [70, 50, 70, 50]],
    ['Bestiaries: monsters only', [BESTIARIES], [50, 50, 70, 70]],
    ["Champions' Tourney: characters only", [CHAMPIONS_TOURNEY], [69, 69, 50, 50]],
    ['Duelling Code: every foe', [DUELLING_CODE], [64, 64, 64, 64]],
    ["Saints' Relics and Bestiaries: both against an undead guardian", [SAINTS_RELICS, BESTIARIES], [70, 50, 80, 70]],
  ] as const)('%s', ([, discoveries, chances]) => {
    for (const how of ['a blow', 'an arrow'] as const)
      expect(Object.values(theChancesToHitEachFoe(discoveries, how)), how).toEqual(chances);
  });

  test("the foe's kind is asked only by an effect against the undead", () => {
    const theFoesKind = vi.fn(() => 'undead');
    const facts = { whatTheFoeIs: 'character', theFoesKind };
    expect(whatARealmsDiscoveriesAddToAFightersAim({ discoveries: [DUELLING_CODE, BESTIARIES] }, facts)).toBe(14);
    expect(theFoesKind).not.toHaveBeenCalled();
    expect(whatARealmsDiscoveriesAddToAFightersAim({ discoveries: [SAINTS_RELICS] }, facts)).toBe(20);
    expect(theFoesKind).toHaveBeenCalledTimes(1);
  });
});

describe("Veteran Training and Mithril Craft in a hero's fighter (pcCharCombatant), and Veteran Training on his card", () => {
  /** Realm 1's first hero who isn't its king, of Melee and Archery given, no items, Cautious (no rage), his realm
   *  holding the discoveries given: his fighter's Melee, Archery, their raw levels, and what Mithril turns aside. */
  function hisFighter(discoveries: readonly { readonly id: string }[], melee: number, archery: number) {
    const G = JSON.parse(THE_WORLD) as World;
    const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
    const hero = G.characters.find((c) => c.alive && c.player === 1 && !c.isKing);
    const realm1 = G.players[1];
    if (!hero || !realm1) throw new Error('the world has no hero in realm 1');
    realm1.discoveries = discoveries.map((d) => ({ ...d }));
    Object.assign(hero, { skills: { ...(hero['skills'] as object), melee, archery }, items: [], temper: 'Cautious' });
    const was = kcRng.use(() => 0.5);
    try {
      const f = pcCharCombatant(tc as never, hero as never);
      return [f.melee, f.archery, f.meleeRaw, f.archeryRaw, f.mithrilDR];
    } finally {
      kcRng.use(was);
    }
  }

  test('Melee 3 and Archery 2: each a level higher with it, the raw levels too', () => {
    expect(hisFighter([], 3, 2)).toEqual([3, 2, 3, 2, 2]);
    expect(hisFighter([VETERAN_TRAINING], 3, 2)).toEqual([4, 3, 4, 3, 2]);
  });

  test("Mithril Craft: his Mithril turns aside its row's 2 more (4), whether he wears it or not", () => {
    expect(hisFighter([MITHRIL_CRAFT], 3, 2)).toEqual([3, 2, 3, 2, 4]);
  });

  test("his card: Veteran Training's +1 on Melee and Archery, in personal combat only; none without it", () => {
    const state = { players: [{ discoveries: [VETERAN_TRAINING] }, { discoveries: [DUELLING_CODE] }] };
    const theLine = {
      label: 'Veteran Training',
      delta: 1,
      kind: 'discovery',
      scope: 'combat',
      note: 'personal combat only',
    };
    expect(extraSkillBonuses({ id: 'a', player: 0 }, state, {})).toEqual({ melee: [theLine], archery: [theLine] });
    expect(extraSkillBonuses({ id: 'b', player: 1 }, state, {})).toEqual({});
    expect(extraSkillBonuses({ id: 'c', player: null }, state, {})).toEqual({});
  });

  test('the runner: its +1, once however often the realm holds it; none without it or a realm', () => {
    expect(theLevelsARealmsDiscoveriesAddToAFightersSkills({ discoveries: [VETERAN_TRAINING] })).toBe(1);
    expect(theLevelsARealmsDiscoveriesAddToAFightersSkills({ discoveries: [VETERAN_TRAINING, VETERAN_TRAINING] })).toBe(
      1,
    );
    expect(theLevelsARealmsDiscoveriesAddToAFightersSkills({ discoveries: [DUELLING_CODE] })).toBe(0);
    expect(theLevelsARealmsDiscoveriesAddToAFightersSkills(undefined)).toBe(0);
  });
});

describe('the Order of the Golden Shield: the king hardened twice as much (awardHpRoll)', () => {
  /** Realm 1's king (or its first other hero) rolls his hardening after a fight he won, the die fed at its middle, his
   *  realm holding the discoveries given: what he gained, and whether the line names the Order. */
  function hisHardening(discoveries: readonly { readonly id: string }[], who: 'the king' | 'another hero') {
    const G = JSON.parse(THE_WORLD) as World;
    const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
    const hero = G.characters.find((c) => c.alive && c.player === 1 && (who === 'the king') === !!c.isKing);
    const realm1 = G.players[1];
    if (!hero || !realm1) throw new Error('the world has no such hero in realm 1');
    realm1.discoveries = discoveries.map((d) => ({ ...d }));
    const before = Number(hero['hpEarned']) || 0;
    const was = kcRng.use(() => 0.5);
    try {
      const r = awardHpRoll(tc, hero, [], 'kill', true) as { gain: number; sd35?: boolean };
      return { gain: r.gain, earned: (Number(hero['hpEarned']) || 0) - before, theOrder: r.sd35 === true };
    } finally {
      kcRng.use(was);
    }
  }

  test('the king: twice the gain with it, the earned hit points too; another hero: as without', () => {
    const without = hisHardening([], 'the king');
    expect(without.theOrder).toBe(false);
    expect(without.gain).toBeGreaterThan(0);
    expect(hisHardening([GOLDEN_SHIELD], 'the king')).toEqual({
      gain: without.gain * 2,
      earned: without.earned + without.gain,
      theOrder: true,
    });
    expect(hisHardening([GOLDEN_SHIELD], 'another hero')).toEqual(hisHardening([], 'another hero'));
  });

  test("the runner: the kind's ×2, or nothing for a realm without it", () => {
    expect(theFactorARealmsDiscoveriesHardenTheKingBy({ discoveries: [GOLDEN_SHIELD] })).toBe(2);
    expect(theFactorARealmsDiscoveriesHardenTheKingBy({ discoveries: [DUELLING_CODE] })).toBeNull();
    expect(theFactorARealmsDiscoveriesHardenTheKingBy(undefined)).toBeNull();
  });
});

describe("the fighter's and his rise's effects on rows the content doesn't write", () => {
  test('an aim, a Mithril and a rise with no number; an aim against a foe no kind names; a rise for listed skills', () => {
    const got = withPlantedRows(
      {
        squint: { kind: 'duelHit' },
        stare: { kind: 'duelHit', pct: 3, vs: 'dragon' },
        steady: { kind: 'duelHit', pct: 5 },
        tin: { kind: 'mithril' },
        silver: { kind: 'mithril', extra: 1 },
        dull: { kind: 'skillGain' },
        drill: { kind: 'skillGain', pct: 0.1, skills: ['melee', 'archery'] },
      },
      (realm) => [
        whatARealmsDiscoveriesAddToAFightersAim(realm, { whatTheFoeIs: 'monster', theFoesKind: () => 'dragon' }),
        whatARealmsDiscoveriesAddToAFightersMithril(realm),
        whatARealmsDiscoveriesAddToASkillsRise(realm, { theSkill: 'melee' }),
        whatARealmsDiscoveriesAddToASkillsRise(realm, { theSkill: 'white' }),
      ],
    );
    expect(got).toEqual([5, 1, 0.1, 0]);
  });
});

/** The discoveries of P1-19ad's cases, by id (their rows' numbers in SAGE_DISCOVERIES_P). */
const SPIES = {
  forgeryArts: { id: 'sd21' }, // spy +0.4, anywhere
  silentScouts: { id: 're05' }, // spy +0.5 and spying on a hero +0.5, in forest and jungle
  silverTongues: { id: 'an07' }, // spy +0.5 and spying on a hero +0.5, on coastal ground
  cipherScripts: { id: 'sd19' }, // a rival spy's chance −0.45, anywhere
  hiddenTrails: { id: 're08' }, // −0.6 in forest and jungle (and catching a spy +50 there)
  watchmen: { id: 'ag17' }, // −0.6 at the realm's home (and a rest +6 at its home)
  shadowCouriers: { id: 'sd62' }, // spying on a hero +0.5 anywhere (and catching a spy +50 on plain and desert)
  informerRewards: { id: 'sd63' }, // catching a spy +50, anywhere
  bulwark: { id: 'ag10' }, // catching a spy +50 at the realm's home
  disguise: { id: 'sd23' }, // a spy's success kept quiet: 0.65
} as const;

/** Where a spy acts: the ground, and each question answered as given, counted. */
function whereHeSpies(theGround: string | undefined, coastal: boolean, home: boolean) {
  return { theGround, isItCoastal: vi.fn(() => coastal), isItTheRealmsHome: vi.fn(() => home) };
}

describe("the spies' discoveries, in their runners (P1-19ad: no game meets a rival's cut, or a ground's, a coast's or a home's scope for each)", () => {
  test('an effect for both the coast and its home: the coast asked first, the home only if it is coastal', () => {
    const asked = withPlantedRows({ both: { kind: 'spy', pct: 0.2, coastal: true, home: true } }, (realm) => {
      const out: string[] = [];
      whatARealmsDiscoveriesAddToASpysChance(realm, {
        theGround: 'plain',
        isItCoastal: () => (out.push('coast'), false),
        isItTheRealmsHome: () => (out.push('home'), true),
      });
      return out;
    });
    expect(asked).toEqual(['coast']);
  });

  test("a spy's chance: anywhere, and on the ground or the coast its row names; the coast asked only by its effect", () => {
    const realm = { discoveries: [SPIES.forgeryArts, SPIES.silentScouts, SPIES.silverTongues] };
    const inTheForest = whereHeSpies('forest', false, true);
    expect(whatARealmsDiscoveriesAddToASpysChance(realm, inTheForest)).toBeCloseTo(0.9, 12);
    expect(inTheForest.isItCoastal).toHaveBeenCalledTimes(1);
    expect(inTheForest.isItTheRealmsHome).not.toHaveBeenCalled();
    expect(whatARealmsDiscoveriesAddToASpysChance(realm, whereHeSpies('plain', true, false))).toBeCloseTo(0.9, 12);
    expect(whatARealmsDiscoveriesAddToASpysChance(realm, whereHeSpies('plain', false, false))).toBeCloseTo(0.4, 12);
    expect(whatARealmsDiscoveriesAddToASpysChance(realm, whereHeSpies(undefined, false, true))).toBeCloseTo(0.4, 12);
    expect(whatARealmsDiscoveriesAddToASpysChance(undefined, whereHeSpies('plain', true, true))).toBe(0);
  });

  test("a rival spy's chance cut: anywhere, on its ground, and at the realm's home, asked only by its effect", () => {
    const realm = { discoveries: [SPIES.cipherScripts, SPIES.hiddenTrails, SPIES.watchmen] };
    const atHomeInTheForest = whereHeSpies('forest', false, true);
    expect(whatARealmsDiscoveriesCutARivalSpysChanceBy(realm, atHomeInTheForest)).toBeCloseTo(1.65, 12);
    expect(atHomeInTheForest.isItTheRealmsHome).toHaveBeenCalledTimes(1);
    expect(atHomeInTheForest.isItCoastal).not.toHaveBeenCalled();
    expect(whatARealmsDiscoveriesCutARivalSpysChanceBy(realm, whereHeSpies('plain', false, false))).toBeCloseTo(
      0.45,
      12,
    );
  });

  test('spying on a hero: anywhere, and on its ground; a spy discovery adds nothing to it', () => {
    const realm = { discoveries: [SPIES.shadowCouriers, SPIES.silentScouts, SPIES.forgeryArts] };
    expect(whatARealmsDiscoveriesAddToSpyingOnAHero(realm, whereHeSpies('jungle', false, false))).toBeCloseTo(1, 12);
    expect(whatARealmsDiscoveriesAddToSpyingOnAHero(realm, whereHeSpies('plain', false, false))).toBeCloseTo(0.5, 12);
  });

  test("catching a spy: anywhere, on its ground, and at the realm's home", () => {
    const realm = { discoveries: [SPIES.informerRewards, SPIES.bulwark, SPIES.hiddenTrails] };
    expect(whatARealmsDiscoveriesAddToCatchingASpy(realm, whereHeSpies('forest', false, true))).toBe(150);
    expect(whatARealmsDiscoveriesAddToCatchingASpy(realm, whereHeSpies('plain', false, true))).toBe(100);
    expect(whatARealmsDiscoveriesAddToCatchingASpy(realm, whereHeSpies('plain', false, false))).toBe(50);
  });

  test("Disguise Techniques: its row's 0.65, or nothing for a realm without it", () => {
    expect(theChanceARealmsDiscoveriesKeepASpysSuccessQuiet({ discoveries: [SPIES.disguise] })).toBe(0.65);
    expect(theChanceARealmsDiscoveriesKeepASpysSuccessQuiet({ discoveries: [SPIES.forgeryArts] })).toBeNull();
    expect(theChanceARealmsDiscoveriesKeepASpysSuccessQuiet(undefined)).toBeNull();
  });

  test("the report's odds name no province: an effect for a ground or a coast doesn't count, one for a home does", () => {
    const realm = { discoveries: [SPIES.forgeryArts, SPIES.silentScouts, SPIES.silverTongues] };
    expect(whatARealmsDiscoveriesAddToASpysChance(realm, THE_REPORTS_ODDS_NAME_NO_PROVINCE)).toBeCloseTo(0.4, 12);
    const homeOnly = withPlantedRows({ hearth: { kind: 'spy', pct: 0.2, home: true } }, (planted) => [
      whatARealmsDiscoveriesAddToASpysChance(planted, THE_REPORTS_ODDS_NAME_NO_PROVINCE),
      whatARealmsDiscoveriesAddToASpysChance(planted, whereHeSpies('plain', false, false)),
    ]);
    expect(homeOnly).toEqual([0.2, 0]);
  });
});

describe("the explorers' discoveries, in their runners (P1-19ad)", () => {
  test('exploring: the factors that reach the ground, multiplied; the same rule discExploreMult ships', () => {
    const realm = { discoveries: [{ id: 'sd24' }, { id: 'sd10' }, { id: 'rd06' }] };
    expect(theFactorARealmsDiscoveriesMultiplyExploringBy(realm, { theGround: 'plain' })).toBeCloseTo(7.2, 12);
    expect(theFactorARealmsDiscoveriesMultiplyExploringBy(realm, { theGround: 'mountain' })).toBeCloseTo(7.2, 12);
    expect(theFactorARealmsDiscoveriesMultiplyExploringBy(realm, { theGround: 'forest' })).toBeCloseTo(2.4, 12);
    expect(discExploreMult(realm, 'forest')).toBe(
      theFactorARealmsDiscoveriesMultiplyExploringBy(realm, { theGround: 'forest' }),
    );
    expect(theFactorARealmsDiscoveriesMultiplyExploringBy(undefined, { theGround: 'plain' })).toBe(1);
  });

  test("Ancient Lore: its row's 25, or nothing for a realm without it", () => {
    expect(theShareARealmsDiscoveriesMapAroundAnExplorer({ discoveries: [{ id: 'sd32' }] })).toBe(25);
    expect(theShareARealmsDiscoveriesMapAroundAnExplorer({ discoveries: [{ id: 'sd24' }] })).toBeNull();
  });

  test("The Long Hunt: its row's turn more; none without it", () => {
    expect(theTurnsARealmsDiscoveriesLengthenTheWildHuntBy({ discoveries: [{ id: 'ap08' }] })).toBe(1);
    expect(theTurnsARealmsDiscoveriesLengthenTheWildHuntBy({ discoveries: [{ id: 'sd24' }] })).toBe(0);
  });

  test("a lair's gold: anywhere, on its ground, for a hero of its race; a lair's item: anywhere and on its ground", () => {
    const realm = { discoveries: [{ id: 'an10' }, { id: 'ro03' }, { id: 'sd10' }, { id: 'sd25' }, { id: 'rd10' }] };
    expect(whatARealmsDiscoveriesAddToALairsGold(realm, { theGround: 'plain', theHerosRace: 'Orcish' })).toBeCloseTo(
      1.25,
      12,
    );
    expect(whatARealmsDiscoveriesAddToALairsGold(realm, { theGround: 'forest', theHerosRace: 'Human' })).toBeCloseTo(
      0.35,
      12,
    );
    expect(whatARealmsDiscoveriesAddToALairsItemChance(realm, { theGround: 'mountain' })).toBe(1);
    expect(whatARealmsDiscoveriesAddToALairsItemChance(realm, { theGround: 'plain' })).toBe(0.5);
  });
});

describe("the scholars' and the resters' discoveries, in their runners (P1-19ad: no game meets a rest's)", () => {
  test("research: anywhere, and the realm's own creed only when it is the field studied, asked only by its effect", () => {
    const realm = { discoveries: [{ id: 'an06' }, { id: 'az10' }] };
    const itsOwnCreed = vi.fn(() => true);
    expect(whatARealmsDiscoveriesAddToResearch(realm, { isTheFieldStudiedItsOwnCreed: itsOwnCreed })).toBe(13);
    expect(itsOwnCreed).toHaveBeenCalledTimes(1);
    expect(whatARealmsDiscoveriesAddToResearch(realm, { isTheFieldStudiedItsOwnCreed: () => false })).toBe(4);
    expect(whatARealmsDiscoveriesAddToResearch(realm, THE_REPORTS_RESEARCH_NAMES_NO_FIELD)).toBe(4);
    const another = withPlantedRows({ other: { kind: 'research', pct: 3, field: 'Military' } }, (planted) =>
      whatARealmsDiscoveriesAddToResearch(planted, { isTheFieldStudiedItsOwnCreed: () => true }),
    );
    expect(another).toBe(0);
  });

  test('practice: for every skill and for the skills it lists; the report: every skill, then each listed one', () => {
    const realm = { discoveries: [{ id: 'sd26' }, { id: 'sd61' }, { id: 'sd76' }] };
    expect(whatARealmsDiscoveriesAddToPractice(realm, { theSkill: 'spy' })).toBeCloseTo(0.33, 12);
    expect(whatARealmsDiscoveriesAddToPractice(realm, { theSkill: 'melee' })).toBeCloseTo(0.13, 12);
    expect(whatARealmsDiscoveriesAddToPractice(realm, THE_REPORTS_PRACTICE_NAMES_NO_SKILL)).toBeCloseTo(0.03, 12);
    expect(theSharesARealmsDiscoveriesAddToPracticeSkillBySkill(realm)).toEqual([
      ['spy', 0.3],
      ['thief', 0.3],
      ['melee', 0.1],
      ['archery', 0.1],
    ]);
  });

  test("a rest's heal: anywhere, on the realm's ground, at its home (asked only there) and on its ground", () => {
    const realm = { discoveries: [{ id: 'ad06' }, { id: 'ag06' }, SPIES.watchmen, { id: 'au07' }] };
    const atHome = vi.fn(() => true);
    const healAt = (isItHisRealmsGround: boolean, theGround: string, isItHisRealmsHome: () => boolean) =>
      whatARealmsDiscoveriesAddToARestsHeal(realm, { isItHisRealmsGround, isItHisRealmsHome, theGround });
    expect(healAt(true, 'forest', atHome)).toBe(23);
    expect(atHome).toHaveBeenCalledTimes(1);
    expect(healAt(true, 'plain', () => false)).toBe(11);
    const abroad = vi.fn(() => true);
    expect(healAt(false, 'forest', abroad)).toBe(11);
    expect(abroad).not.toHaveBeenCalled();
  });

  test('Medical Arts: a resting hero healed in full with it, not without', () => {
    expect(aRealmsDiscoveriesHealARestingHeroInFull({ discoveries: [{ id: 'sd28' }] })).toBe(true);
    expect(aRealmsDiscoveriesHealARestingHeroInFull({ discoveries: [{ id: 'ad06' }] })).toBe(false);
    expect(aRealmsDiscoveriesHealARestingHeroInFull(undefined)).toBe(false);
  });
});

describe("a realm's discoveries that spot a hero lurking in its province (P1-19ad, visibility's first stage)", () => {
  test('Watch Houses anywhere, Spies in Every Court on plain and desert', () => {
    const realm = { discoveries: [{ id: 'sd60' }, { id: 'ae16' }] };
    const watch = (theGround: string) =>
      whatARealmsDiscoveriesAddToSpottingALurker(realm, {
        theGround,
        isItTheRealmsHome: () => false,
        isItCoastal: () => false,
      });
    expect([watch('plain'), watch('forest')]).toEqual([100, 50]);
  });

  test('an effect for the home or the coast (no row writes one): each counted only there, asked only by it', () => {
    const got = withPlantedRows(
      { hearth: { kind: 'spotLurker', pct: 20, home: true }, shore: { kind: 'spotLurker', pct: 30, coastal: true } },
      (realm) => {
        const asked: string[] = [];
        const watch = (home: boolean, coastal: boolean) =>
          whatARealmsDiscoveriesAddToSpottingALurker(realm, {
            theGround: 'plain',
            isItTheRealmsHome: () => (asked.push('home'), home),
            isItCoastal: () => (asked.push('coast'), coastal),
          });
        return [watch(true, true), watch(false, false), watch(true, false), asked];
      },
    );
    expect(got).toEqual([50, 0, 20, ['home', 'coast', 'home', 'coast', 'home', 'coast']]);
  });

  test('an effect for both its home and the coast: the home asked first, the coast only if it is the home', () => {
    const asked = withPlantedRows({ both: { kind: 'spotLurker', pct: 20, home: true, coastal: true } }, (realm) => {
      const out: string[] = [];
      whatARealmsDiscoveriesAddToSpottingALurker(realm, {
        theGround: 'plain',
        isItTheRealmsHome: () => (out.push('home'), false),
        isItCoastal: () => (out.push('coast'), true),
      });
      return out;
    });
    expect(asked).toEqual(['home']);
  });

  test("spotEnemyInOwnedProvince asks whether the province is the watching realm's home", () => {
    // a Spy 5 lurker: 0 before the discoveries, so the 25% floor, or the home effect's 70
    let t = 1;
    while (!(detRoll(t, 0, 5, 0) * 100 >= 25 && detRoll(t, 0, 5, 0) * 100 < 70)) t++;
    const spotted = (homeProvinceId: number) =>
      withPlantedRows({ hearth: { kind: 'spotLurker', pct: 70, home: true } }, (realm) =>
        spotEnemyInOwnedProvince(
          {
            players: [{ ...realm, homeProvinceId }],
            characters: [],
            turn: t,
            world: { cols: 8, rows: 8, provinces: [] },
          } as never,
          0,
          { id: 0, row: 0, col: 0, terrain: 'plain', tax: 2, characters: [] },
          { id: 5, skills: { spy: 5 } },
          t,
        ),
      );
    expect([spotted(0), spotted(7)]).toEqual([true, false]);
  });
});

describe("the orders' and the sight's effects on rows the content doesn't write (P1-19ad)", () => {
  test('no number: each kind adds nothing, multiplies by 1, or gives its fallback (Disguise 0.5, Ancient Lore 10)', () => {
    const got = withPlantedRows(
      {
        spy: { kind: 'spy' },
        cut: { kind: 'counterSpy' },
        hero: { kind: 'spyChar' },
        catch: { kind: 'catchSpy' },
        quiet: { kind: 'spyDisguise' },
        far: { kind: 'explore' },
        hunt: { kind: 'wildHunt' },
        gold: { kind: 'lairGold' },
        item: { kind: 'itemChance' },
        study: { kind: 'research' },
        drill: { kind: 'practice' },
        rest: { kind: 'rest' },
        watch: { kind: 'spotLurker' },
        lore: { kind: 'adjacentReveal' },
      },
      (realm) => {
        const anywhere = whereHeSpies('plain', false, false);
        return [
          whatARealmsDiscoveriesAddToASpysChance(realm, anywhere),
          whatARealmsDiscoveriesCutARivalSpysChanceBy(realm, anywhere),
          whatARealmsDiscoveriesAddToSpyingOnAHero(realm, anywhere),
          whatARealmsDiscoveriesAddToCatchingASpy(realm, anywhere),
          theChanceARealmsDiscoveriesKeepASpysSuccessQuiet(realm),
          theFactorARealmsDiscoveriesMultiplyExploringBy(realm, { theGround: 'plain' }),
          theTurnsARealmsDiscoveriesLengthenTheWildHuntBy(realm),
          whatARealmsDiscoveriesAddToALairsGold(realm, { theGround: 'plain', theHerosRace: 'Human' }),
          whatARealmsDiscoveriesAddToALairsItemChance(realm, { theGround: 'plain' }),
          whatARealmsDiscoveriesAddToResearch(realm, THE_REPORTS_RESEARCH_NAMES_NO_FIELD),
          whatARealmsDiscoveriesAddToPractice(realm, { theSkill: 'spy' }),
          whatARealmsDiscoveriesAddToARestsHeal(realm, {
            isItHisRealmsGround: true,
            isItHisRealmsHome: () => true,
            theGround: 'plain',
          }),
          whatARealmsDiscoveriesAddToSpottingALurker(realm, {
            theGround: 'plain',
            isItTheRealmsHome: () => true,
            isItCoastal: () => true,
          }),
          theShareARealmsDiscoveriesMapAroundAnExplorer(realm),
        ];
      },
    );
    expect(got).toEqual([0, 0, 0, 0, 0.5, 1, 0, 0, 0, 0, 0, 0, 0, 10]);
  });
});

/** The discoveries of P1-19ae's cases, by id (their rows' numbers in SAGE_DISCOVERIES_P). */
const WORKS = {
  diplomaticProtocols: { id: 'sd31' }, // the ban on hiring across the gulf between Divine and Undead waived
  holySites: { id: 'ad03' }, // +1 consecrated province, for a consecrator of White 3 or more
  musterRolls: { id: 'ag05' }, // a Call to Arms raises Average, at a chance of 0.4
  corpseCarters: { id: 'az06' }, // Harvest the Field −2g
  freeSwords: { id: 'ag18' }, // a humanoid band −3g (and a humanoid recruit +0.05 to start Veteran)
  hiredBlades: { id: 'an08' }, // any band −3g
  blackMarket: { id: 'ae20' }, // a band of beasts (primal) −3g (and a primal recruit +0.15)
  shipbuilding: { id: 'sd16' }, // a fleet's price ×0.5
  yeomanMusters: { id: 'rh02' }, // Shieldwall Levies and Yeoman Longbows −1g (and +0.3 to start Veteran)
  superiorForging: { id: 'sd01' }, // any recruit +0.05
  levyTraining: { id: 'sd46' }, // a garrison recruit +0.3
  ritesOfPlenty: { id: 'ad09' }, // a Bless +0.45 of the province's tax
} as const;

/** A realm holding the discoveries given. */
const holding = (...held: readonly { readonly id: string }[]) => ({ discoveries: [...held] });

describe("the recruits' and the realm's works' discoveries, in their runners (P1-19ae: no game meets Holy Sites, the carters' cost or a band's price)", () => {
  test('Diplomatic Protocols waive the hiring ban; no other discovery does, nor no realm', () => {
    expect(doARealmsDiscoveriesWaiveTheHiringBan(holding(WORKS.musterRolls, WORKS.diplomaticProtocols))).toBe(true);
    expect(doARealmsDiscoveriesWaiveTheHiringBan(holding(WORKS.musterRolls, WORKS.holySites))).toBe(false);
    expect(doARealmsDiscoveriesWaiveTheHiringBan(holding())).toBe(false);
    expect(doARealmsDiscoveriesWaiveTheHiringBan(undefined)).toBe(false);
  });

  test('Holy Sites: one more consecrated province for a consecrator of White 3 or more, none below', () => {
    const more = (white: number) =>
      whatARealmsDiscoveriesAddToTheConsecrationsACrownMayHold(holding(WORKS.holySites), {
        theConsecratorsWhiteSkill: white,
      });
    expect([more(2), more(3), more(5)]).toEqual([0, 1, 1]);
  });

  test('Muster Rolls: the quality and its chance, as the row writes them, for the order to roll', () => {
    expect(theQualitiesARealmsDiscoveriesMayRaiseACallToArmsAt(holding(WORKS.musterRolls))).toEqual([
      { theChance: 0.4, theQuality: 'Average' },
    ]);
    expect(theQualitiesARealmsDiscoveriesMayRaiseACallToArmsAt(holding(WORKS.holySites))).toEqual([]);
  });

  test("the corpse-carters' cost and a band's price: the gold each adds, a band's only for the class it names", () => {
    expect(whatARealmsDiscoveriesAddToTheCorpseCartersCost(holding(WORKS.corpseCarters))).toBe(-2);
    expect(whatARealmsDiscoveriesAddToTheCorpseCartersCost(holding(WORKS.freeSwords))).toBe(0);
    const band = (theUnitsType: string) =>
      whatARealmsDiscoveriesAddToAMercenaryBandsPrice(holding(WORKS.freeSwords, WORKS.hiredBlades, WORKS.blackMarket), {
        theUnitsType,
      });
    expect([band('Shieldwall Levies'), band('Great Bears'), band('Elven Galleys')]).toEqual([-6, -6, -3]);
  });

  test("a unit's price: each effect in turn, its gold added, then its factor, rounded up; at least 1g", () => {
    const price = (ids: readonly { readonly id: string }[], type: string, base: number) =>
      realmRecruitCost(holding(...ids), type, base);
    expect(price([WORKS.shipbuilding], 'Elven Galleys', 3)).toBe(2);
    expect(price([WORKS.yeomanMusters], 'Shieldwall Levies', 2)).toBe(1);
    expect(price([WORKS.yeomanMusters, WORKS.shipbuilding], 'Free Lances', 3)).toBe(3);
    // a gold cut and a factor on one row, then a second row's factor on the price the first left
    const left = withPlantedRows(
      {
        cut: { kind: 'recruitCost', delta: -2, factor: 0.5 },
        half: { kind: 'recruitCost', factor: 0.5, types: ['Free Lances'] },
        none: { kind: 'recruitCost', delta: -1, types: ['Great Bears'] },
      },
      (realm) => [
        theUnitsPriceARealmsDiscoveriesLeave(realm, { theUnitsType: 'Free Lances' }, 5),
        theUnitsPriceARealmsDiscoveriesLeave(realm, { theUnitsType: 'Shieldwall Levies' }, 5),
        realmRecruitCost(realm, 'Free Lances', 1),
      ],
    );
    // 5 − 2 = 3, × 0.5 = 1.5 → 2, × 0.5 = 1; 3 → 2; 1 − 2 = −1, × 0.5 → 0, × 0.5 → 0, then at least 1
    expect(left).toEqual([1, 2, 1]);
  });

  test("a recruit's chance of a higher grade: each effect that reaches the unit, added, at most 1", () => {
    const realm = holding(WORKS.superiorForging, WORKS.levyTraining, WORKS.yeomanMusters);
    expect(discRecruitQChance(realm, 'Human Garrison')).toBeCloseTo(0.35, 12);
    expect(discRecruitQChance(realm, 'Shieldwall Levies')).toBeCloseTo(0.35, 12);
    expect(discRecruitQChance(realm, 'Free Lances')).toBeCloseTo(0.05, 12);
    const stacked = withPlantedRows(
      { a: { kind: 'recruitQ', pct: 0.7 }, b: { kind: 'recruitQ', pct: 0.6 } },
      (planted) => [
        whatARealmsDiscoveriesAddToARecruitsChanceOfAHigherGrade(planted, { theUnitsType: 'Free Lances' }),
        discRecruitQChance(planted, 'Free Lances'),
      ],
    );
    expect(stacked[0]).toBeCloseTo(1.3, 12);
    expect(stacked[1]).toBe(1);
  });

  test('Rites of Plenty add their share to a Bless', () => {
    expect(whatARealmsDiscoveriesAddToABless(holding(WORKS.ritesOfPlenty, WORKS.holySites))).toBe(0.45);
    expect(whatARealmsDiscoveriesAddToABless(holding(WORKS.holySites))).toBe(0);
  });
});

describe("the recruits' and the realm's works' effects on rows the content doesn't write (P1-19ae)", () => {
  test("no number: each adds nothing or leaves the price; a consecration's White 0 is read as 1", () => {
    const got = withPlantedRows(
      {
        waive: { kind: 'alignmentHire' },
        holy: { kind: 'consecrate' },
        muster: { kind: 'ctaQuality' },
        carters: { kind: 'harvestCost' },
        band: { kind: 'merc' },
        price: { kind: 'recruitCost' },
        grade: { kind: 'recruitQ' },
        bless: { kind: 'bless' },
      },
      (realm) => [
        doARealmsDiscoveriesWaiveTheHiringBan(realm),
        whatARealmsDiscoveriesAddToTheConsecrationsACrownMayHold(realm, { theConsecratorsWhiteSkill: 9 }),
        theQualitiesARealmsDiscoveriesMayRaiseACallToArmsAt(realm),
        whatARealmsDiscoveriesAddToTheCorpseCartersCost(realm),
        whatARealmsDiscoveriesAddToAMercenaryBandsPrice(realm, { theUnitsType: 'Free Lances' }),
        theUnitsPriceARealmsDiscoveriesLeave(realm, { theUnitsType: 'Free Lances' }, 3),
        whatARealmsDiscoveriesAddToARecruitsChanceOfAHigherGrade(realm, { theUnitsType: 'Free Lances' }),
        whatARealmsDiscoveriesAddToABless(realm),
      ],
    );
    expect(got).toEqual([true, 0, [{ theChance: undefined, theQuality: undefined }], 0, 0, 3, 0, 0]);
    const consecrations = (minWhite: number | undefined, white: number) =>
      withPlantedRows({ holy: { kind: 'consecrate', cap: 2, minWhite } }, (realm) =>
        whatARealmsDiscoveriesAddToTheConsecrationsACrownMayHold(realm, { theConsecratorsWhiteSkill: white }),
      );
    expect([
      consecrations(0, 0),
      consecrations(0, 1),
      consecrations(undefined, 0),
      consecrations(undefined, 1),
    ]).toEqual([0, 2, 0, 2]);
  });
});

/** The discoveries of P1-19af's cases, by id (their rows' numbers in SAGE_DISCOVERIES_P). */
const SPOILS = {
  skullTithe: { id: 'ap09' }, // a blood harvest +1g for each enemy unit destroyed
  reignOfTerror: { id: 'ae03' }, // each terror stack +0.15
  raidingParties: { id: 'ap16' }, // plunder +0.3 in forest, jungle or mountains
  sackAndBurn: { id: 'ae09' }, // plunder +0.2 anywhere
  roadNetwork: { id: 'sd13' }, // +1 move point, every unit (of Speed 1–2)
  tollRoads: { id: 'rh09' }, // +1, Human units
  greatMigrations: { id: 'au03' }, // +1, Creature armies
  tirelessMarch: { id: 'az04' }, // +1, skeletal armies
  signalFires: { id: 'sd04' }, // +75 points to unify
} as const;

/** A unit as the march's discoveries read it. */
const aUnit = (type: string, race: string | undefined, extra: { readonly _isSkeletal?: boolean } = {}) => ({
  type,
  quality: 'Average',
  ...(race === undefined ? {} : { race }),
  ...extra,
});

/** A turn on a fresh copy of the world of two bot realms, realm 0 of the alignment given and holding the discoveries
 *  given. */
function aTurnWith(alignment: string, held: readonly { readonly id: string }[]) {
  const G = JSON.parse(THE_WORLD) as World;
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
  const realm0 = G.players[0];
  if (!realm0) throw new Error('the world has no realm 0');
  const realm = Object.assign(realm0, { alignment, gold: 10, discoveries: held.map((d) => ({ ...d })) });
  return { G, tc, realm };
}

describe("war's spoils and the march, in their runners (P1-19af: no game meets a plunder discovery or Reign of Terror)", () => {
  test('Skull Tithe adds its gold to a blood harvest, Reign of Terror its share to each terror stack', () => {
    expect(whatARealmsDiscoveriesAddToABloodHarvest(holding(SPOILS.skullTithe, SPOILS.sackAndBurn))).toBe(1);
    expect(whatARealmsDiscoveriesAddToABloodHarvest(holding(SPOILS.sackAndBurn))).toBe(0);
    expect(whatARealmsDiscoveriesAddToTheTerrorAVictoryLeaves(holding(SPOILS.reignOfTerror))).toBe(0.15);
    expect(whatARealmsDiscoveriesAddToTheTerrorAVictoryLeaves(holding(SPOILS.skullTithe))).toBe(0);
  });

  test("the plunder: Sack and Burn's share on any ground, Raiding Parties' on the ground it names only", () => {
    const realm = holding(SPOILS.raidingParties, SPOILS.sackAndBurn);
    const plunder = (theGround: string) => whatARealmsDiscoveriesAddToAConquestsPlunder(realm, { theGround });
    expect([plunder('forest'), plunder('jungle'), plunder('mountain'), plunder('plain')]).toEqual([0.5, 0.5, 0.5, 0.2]);
  });

  test('the march: each discovery adds its point to the units it reaches, by race, class or the skeletal dead', () => {
    const realm = holding(SPOILS.roadNetwork, SPOILS.tollRoads, SPOILS.greatMigrations, SPOILS.tirelessMarch);
    const march = (theUnit: ReturnType<typeof aUnit>) => whatARealmsDiscoveriesAddToAMarch(realm, { theUnit });
    expect([
      march(aUnit('Shieldwall Levies', 'Human')),
      march(aUnit('Dwarven Guard', 'Dwarven')),
      march(aUnit('Forest Ents', undefined)),
      march(aUnit('Shieldwall Levies', 'Human', { _isSkeletal: true })),
      march(aUnit('Dwarven Guard', 'Dwarven', { _isSkeletal: true })),
    ]).toEqual([2, 1, 2, 3, 2]);
    expect(whatARealmsDiscoveriesAddToAMarch(holding(), { theUnit: aUnit('Shieldwall Levies', 'Human') })).toBe(0);
  });

  test("Signal Fires add their points to a converging column's chance to unite", () => {
    expect(whatARealmsDiscoveriesAddToConvergingColumnsChanceToUnite(holding(SPOILS.signalFires))).toBe(75);
    expect(whatARealmsDiscoveriesAddToConvergingColumnsChanceToUnite(holding(SPOILS.roadNetwork))).toBe(0);
    expect(whatARealmsDiscoveriesAddToConvergingColumnsChanceToUnite(undefined)).toBe(0);
  });
});

describe("war's spoils and the march, in the functions that ask the runners (P1-19af)", () => {
  test("Skull Tithe: a Pagan victor's blood harvest takes 2g, not 1g, for each enemy unit destroyed", () => {
    const harvest = (held: readonly { readonly id: string }[]) => {
      const { G, realm } = aTurnWith('Pagan', held);
      const narrative: NarrativeLine[] = [];
      bloodHarvest({ G } as never, { player: 0 }, 3, narrative);
      return { gold: realm.gold, words: narrative.map((l) => theWordsOf(l)).join(' ') };
    };
    const [withTithe, without] = [harvest([SPOILS.skullTithe]), harvest([])];
    expect([withTithe.gold, without.gold]).toEqual([16, 13]);
    expect(withTithe.words).toContain('3 fallen enemy units: +6g in offerings');
    expect(without.words).toContain('3 fallen enemy units: +3g in offerings');
  });

  test('Reign of Terror: each province the terror grips costs 25%, not 10%, a stack, and the line says so', () => {
    const terror = (held: readonly { readonly id: string }[]) => {
      const { G, tc } = aTurnWith('Evil', held);
      const field = G.world.provinces.find((p) => p.terrain !== 'sea');
      if (!field) throw new Error('the world has no land province');
      const narrative: NarrativeLine[] = [];
      spreadTerror(tc as never, field as never, 0, narrative);
      const gripped = G.world.provinces.filter((p) => p['_terrorisedBy'] === 0).map((p) => p['_terrorPct']);
      return { shares: [...new Set(gripped)], line: narrative.map((l) => theWordsOf(l)).join(' ') };
    };
    const [withReign, without] = [terror([SPOILS.reignOfTerror]), terror([])];
    expect(withReign.shares).toEqual([0.25]);
    expect(without.shares).toEqual([0.1]);
    expect(withReign.line).toContain('25%');
    expect(without.line).toContain('10%');
  });

  test("the plunder: an Evil conqueror's gold from a province of 10g tax, by the ground and the discoveries held", () => {
    const loot = (held: readonly { readonly id: string }[], terrain: string) => {
      const { tc, realm } = aTurnWith('Evil', held);
      const prov = { id: 2, name: 'Wendmeadow', terrain, tax: 10 };
      applyEvilConquest(tc as never, { name: 'Thorn', player: 0 }, prov, realm);
      return realm.gold - 10;
    };
    const both = [SPOILS.raidingParties, SPOILS.sackAndBurn];
    expect([
      loot(both, 'forest'),
      loot(both, 'plain'),
      loot([SPOILS.raidingParties], 'plain'),
      loot([], 'forest'),
    ]).toEqual([10, 7, 5, 5]);
  });

  test("the march: a hero's land pace, and an unled unit's, gain each point that reaches a unit of Speed 1–2", () => {
    const paces = (held: readonly { readonly id: string }[], unit: ReturnType<typeof aUnit>) => {
      const { G, tc, realm } = aTurnWith('Undead', held);
      const king = G.characters.find((c) => c.alive && c.player === 0 && c.isKing);
      if (!king) throw new Error('the world has no king in realm 0');
      king.armies = [{ ...unit, unitName: 'the Column' }] as never;
      const led = (computeMovePoolMax(tc, king) as { land: number }).land;
      const alone = garrisonMoveRate({ ...unit, unitName: 'the Column' } as never, realm as never).moveRate;
      return [led, alone];
    };
    const skeletalLevies = aUnit('Shieldwall Levies', 'Human', { _isSkeletal: true });
    const marches = [SPOILS.roadNetwork, SPOILS.tirelessMarch];
    const [none, held] = [paces([], skeletalLevies), paces(marches, skeletalLevies)];
    expect([(held[0] ?? 0) - (none[0] ?? 0), none[1], held[1]]).toEqual([2, 2, 4]);
    // a unit of Speed 3 or 4, a flyer and a ship gain nothing
    for (const unit of [
      aUnit('Gilded Lances', 'Human'),
      aUnit('Free Lances', 'Human'),
      aUnit('Eagle Riders', 'Human'),
      aUnit('Elven Galleys', 'Elven'),
    ]) {
      const [a, b] = [paces([], unit), paces(marches, unit)];
      expect(b).toEqual(a);
    }
  });
});

describe("war's spoils and the march, on rows the content doesn't write (P1-19af)", () => {
  test('no number: each adds nothing; a plunder row with no terrains reaches any ground', () => {
    const got = withPlantedRows(
      {
        harvest: { kind: 'bloodHarvest' },
        terror: { kind: 'terror' },
        plunder: { kind: 'plunder' },
        march: { kind: 'move' },
        unify: { kind: 'unify' },
      },
      (realm) => [
        whatARealmsDiscoveriesAddToABloodHarvest(realm),
        whatARealmsDiscoveriesAddToTheTerrorAVictoryLeaves(realm),
        whatARealmsDiscoveriesAddToAConquestsPlunder(realm, { theGround: 'plain' }),
        whatARealmsDiscoveriesAddToAMarch(realm, { theUnit: aUnit('Shieldwall Levies', 'Human') }),
        whatARealmsDiscoveriesAddToConvergingColumnsChanceToUnite(realm),
      ],
    );
    expect(got).toEqual([0, 0, 0, 0, 0]);
    const plunder = (terrains: readonly string[] | undefined, theGround: string) =>
      withPlantedRows({ loot: { kind: 'plunder', pct: 0.4, terrains } }, (realm) =>
        whatARealmsDiscoveriesAddToAConquestsPlunder(realm, { theGround }),
      );
    expect([
      plunder(undefined, 'sea'),
      plunder([], 'plain'),
      plunder(['plain'], 'plain'),
      plunder(['hill'], 'plain'),
    ]).toEqual([0.4, 0, 0.4, 0]);
  });
});

/** The discoveries of P1-19ag's cases, by id (their rows' numbers in SAGE_DISCOVERIES_P). */
const THE_TURNS_END = {
  advancedAgriculture: { id: 'sd11' }, // +1 tax on a province of tax 3 or more
  frontierCharters: { id: 'sd53' }, // +1 on a province of tax 3 or less
  miningTechniques: { id: 'sd15' }, // +1 on a mountain
  harbourDues: { id: 'sd51' }, // +1 on a coastal province
  freePorts: { id: 'an02' }, // +1 on a coastal province of tax 4 or more
  royalMint: { id: 'sd52' }, // +1 at the realm's home
  garrisonFarms: { id: 'sd54' }, // +1 on a garrisoned province
  woolTrade: { id: 'rh16' }, // +1 on a plain of Human folk
  templeCharities: { id: 'ag20' }, // +1 on a province of the king's race
  extortion: { id: 'ae06' }, // +1 on a province of another race
  taxationRecords: { id: 'sd14' }, // 5% of the income
  merchantGuilds: { id: 'sd12' }, // 5% interest on the treasury
  quartermasters: { id: 'sd45' }, // −1g an infantry unit's wage, at most 1g a turn
  supplyDepots: { id: 'sd55' }, // −1g every unit's wage, at most 1g a turn
  granaries: { id: 'sd17' }, // −1g every hero's wage, at most 1g
  loyalRetainers: { id: 'ag03' }, // −1g a Good or Divine hero's, at most 1g
  mercenaryContracts: { id: 'an03' }, // −1g a Neutral hero's, at most 1g
  inspiringLeadership: { id: 'sd38' }, // no hero paid above 3g, at most 2g saved
  royalPhysicians: { id: 'sd72' }, // +8 maximum HP and +4 HP a turn, the king's
  thickHides: { id: 'ro08' }, // +2 maximum HP
  bestiaries: { id: 'sd73' }, // +1 for a trained explorer
  blessedVigour: { id: 'ad19' }, // +2 for a hero, not the king
  physickGardens: { id: 'sd65' }, // +3 HP a turn
  embalmers: { id: 'az08' }, // the graves never rot
  warAcademy: { id: 'sd08' }, // 7% a company
  herbalLore: { id: 'sd29' }, // 60% of last season's wounds
  informantNetwork: { id: 'sd22' },
  arcaneObservatory: { id: 'sd39' },
} as const;

/** A province as the tax discoveries read it: tax 3, plain, of Human folk, inland, ungarrisoned, not the home, for a
 *  Human realm; its questions count how often they are asked. */
function aProvinceToTax(over: Partial<{ theTax: number; theGround: string; theFolk: string | undefined }> = {}) {
  const asked = { coast: 0, home: 0 };
  const facts = {
    theTax: 3,
    theGround: 'plain',
    theFolk: 'Human' as string | undefined,
    theRealmsRace: 'Human',
    isItGarrisoned: false,
    isItCoastal: () => (asked.coast++, false),
    isItTheRealmsHome: () => (asked.home++, false),
    ...over,
  };
  return { facts, asked };
}
const taxOf = (realm: object, facts: ReturnType<typeof aProvinceToTax>['facts'], ceiling: number | null = 99) =>
  whatARealmsDiscoveriesAddToAProvincesTax(realm, facts, new Map(), ceiling);

describe("the turn's end and the new turn, in their runners (P1-19ag)", () => {
  test("a province's tax: each filter of a row, its tax, ground and folk", () => {
    const T = THE_TURNS_END;
    const byTax = holding(T.advancedAgriculture, T.frontierCharters, T.miningTechniques);
    expect([
      taxOf(byTax, aProvinceToTax().facts),
      taxOf(byTax, aProvinceToTax({ theTax: 2, theGround: 'mountain' }).facts),
      taxOf(byTax, aProvinceToTax({ theTax: 4 }).facts),
    ]).toEqual([2, 2, 1]);
    const byFolk = holding(T.woolTrade, T.templeCharities, T.extortion);
    expect([
      taxOf(byFolk, aProvinceToTax().facts),
      taxOf(byFolk, aProvinceToTax({ theGround: 'forest' }).facts),
      taxOf(byFolk, aProvinceToTax({ theFolk: 'Elven' }).facts),
      taxOf(byFolk, aProvinceToTax({ theFolk: undefined }).facts),
      taxOf(byFolk, aProvinceToTax({ theFolk: '' }).facts),
    ]).toEqual([2, 1, 1, 0, 0]);
  });

  test("a province's tax: a garrison, the coast and the realm's home, each question asked only by an effect that needs it", () => {
    const T = THE_TURNS_END;
    const realm = holding(T.garrisonFarms, T.harbourDues, T.freePorts, T.royalMint);
    const inland = aProvinceToTax();
    expect(taxOf(realm, inland.facts)).toBe(0);
    // Free Ports asks no coast of a province of tax 3: only Harbour Dues asks it
    expect(inland.asked).toEqual({ coast: 1, home: 1 });
    const coastalHome = aProvinceToTax({ theTax: 4 });
    const facts = {
      ...coastalHome.facts,
      isItGarrisoned: true,
      isItCoastal: () => true,
      isItTheRealmsHome: () => true,
    };
    expect(taxOf(realm, facts)).toBe(4);
    const none = aProvinceToTax();
    expect(taxOf(holding(T.advancedAgriculture), none.facts)).toBe(1);
    expect(none.asked).toEqual({ coast: 0, home: 0 });
  });

  test("a province's tax: each effect under the realm's ceiling and its row's own, its account kept across provinces", () => {
    const realm = holding(THE_TURNS_END.advancedAgriculture, THE_TURNS_END.frontierCharters);
    const account = new Map();
    const pay = (ceiling: number | null | undefined) =>
      whatARealmsDiscoveriesAddToAProvincesTax(realm, aProvinceToTax().facts, account, ceiling);
    // two effects, each 1g: a ceiling of 2 lets each pay twice, then nothing
    expect([pay(2), pay(2), pay(2)]).toEqual([2, 2, 0]);
    const own = withPlantedRows({ capped: { kind: 'tax', bonus: 3, max: 2 } }, (planted) => {
      const acc = new Map();
      const one = (ceiling: number | null) =>
        whatARealmsDiscoveriesAddToAProvincesTax(planted, aProvinceToTax().facts, acc, ceiling);
      return [one(null), one(null), one(5)];
    });
    // its own max of 2 with no ceiling, then nothing left; given a ceiling, the lower of the two, the account kept
    expect(own).toEqual([2, 0, 0]);
  });

  test('discTaxAdd hands the province as it is: its tax, folk, garrison, coast and home', () => {
    const T = THE_TURNS_END;
    const realm = { race: 'Human', ...holding(T.advancedAgriculture, T.garrisonFarms, T.templeCharities, T.royalMint) };
    const state = { world: { cols: 1, rows: 1, provinces: [] }, homes: {} };
    const province = { id: 0, row: 0, col: 0, tax: 3, terrain: 'plain', race: 'Human', garrisonArmies: [{}] };
    expect(discTaxAdd(realm, province as never, state as never, 0, new Map(), 99)).toBe(3);
    expect(
      discTaxAdd(realm, { ...province, tax: undefined, race: 'Elven' } as never, state as never, 0, new Map(), 99),
    ).toBe(1);
  });

  test('Taxation Records: 5% of the income, rounded down, under the ceiling, for a realm that holds it', () => {
    expect(doARealmsDiscoveriesAddToTheRealmsTax(holding(THE_TURNS_END.taxationRecords))).toBe(true);
    expect(doARealmsDiscoveriesAddToTheRealmsTax(holding(THE_TURNS_END.advancedAgriculture))).toBe(false);
    expect(doARealmsDiscoveriesAddToTheRealmsTax(undefined)).toBe(false);
    expect([
      theGoldADiscoveryAddsToTheRealmsTax({ theIncome: 139, theCeiling: 10 }),
      theGoldADiscoveryAddsToTheRealmsTax({ theIncome: 1000, theCeiling: 10 }),
      taxRecordsGold(139, 10),
    ]).toEqual([6, 10, 6]);
  });

  test('Taxation Records with no discovery of its kind in the table: the old fallbacks, 5% and 99g', () => {
    const theRow = DISC_BY_ID['sd14'];
    Reflect.set(DISC_BY_ID, 'sd14', { ...theRow, effect: undefined });
    try {
      expect([taxRecordsGold(1000, null), taxRecordsGold(5000, null), taxRecordsGold(1000, 10)]).toEqual([50, 99, 10]);
    } finally {
      Reflect.set(DISC_BY_ID, 'sd14', theRow);
    }
  });

  test('interest: 5% of the treasury, rounded down, under the ceiling', () => {
    const realm = holding(THE_TURNS_END.merchantGuilds);
    const interest = (theTreasury: number, theCeiling: number) =>
      whatARealmsDiscoveriesEarnInInterest(realm, { theTreasury, theCeiling });
    expect([interest(100, 10), interest(100, 2), interest(39, 10), interest(0, 10)]).toEqual([5, 2, 1, 0]);
    expect(whatARealmsDiscoveriesEarnInInterest(holding(), { theTreasury: 100, theCeiling: 10 })).toBe(0);
  });

  test("a unit's wage: each cut that reaches it in turn, never below 1g, each at most its own max a turn", () => {
    const realm = holding(THE_TURNS_END.quartermasters, THE_TURNS_END.supplyDepots);
    const infantry = { type: 'Shieldwall Levies', quality: 'Average', race: 'Human' };
    const cavalry = { type: 'Free Lances', quality: 'Average', race: 'Human' };
    const acc = new Map();
    expect([
      theWageARealmsDiscoveriesLeaveAUnit(realm, { theUnit: infantry }, 5, acc, null),
      theWageARealmsDiscoveriesLeaveAUnit(realm, { theUnit: infantry }, 5, acc, null),
      theWageARealmsDiscoveriesLeaveAUnit(realm, { theUnit: cavalry }, 5, new Map(), null),
      theWageARealmsDiscoveriesLeaveAUnit(realm, { theUnit: infantry }, 2, new Map(), null),
      theWageARealmsDiscoveriesLeaveAUnit(realm, { theUnit: infantry }, 5, new Map(), 0),
      discUpkeepWage(realm, infantry, 5, new Map(), 3),
    ]).toEqual([3, 5, 4, 1, 5, 3]);
  });

  test("a hero's wage: the cuts for his alignment in turn, then the heroes' ceiling, each at most its own max", () => {
    const T = THE_TURNS_END;
    const realm = holding(T.granaries, T.loyalRetainers, T.mercenaryContracts, T.inspiringLeadership);
    const wage = (alignment: string, raw: number, ceiling: number | null) =>
      discHeroWage(realm, { alignment }, raw, new Map(), ceiling);
    expect([
      wage('Good', 6, 10),
      wage('Neutral', 6, 10),
      wage('Evil', 8, 10),
      wage('Evil', 8, null),
      wage('Evil', 1, 10),
    ]).toEqual([3, 3, 3, 5, 1]);
    expect([
      theWageARealmsDiscoveriesCutsLeaveAHero(realm, { theHerosAlignment: 'Divine' }, 6, new Map(), 10),
      theWageARealmsDiscoveriesCeilingsLeaveAHero(realm, 6, new Map(), 10),
      theWageARealmsDiscoveriesCeilingsLeaveAHero(realm, 3, new Map(), 10),
      theWageARealmsDiscoveriesCeilingsLeaveAHero(realm, 6, new Map(), 0),
    ]).toEqual([4, 3, 3, 6]);
  });

  test("a hero's maximum HP: the king's, the heroes' and a trained skill's", () => {
    const T = THE_TURNS_END;
    const realm = holding(T.royalPhysicians, T.thickHides, T.bestiaries, T.blessedVigour);
    const hp = (isHeTheKing: boolean, explorer: number) =>
      whatARealmsDiscoveriesAddToAHerosMaximumHp(realm, { isHeTheKing, theLevelsOfHisSkills: { explorer } });
    expect([hp(true, 0), hp(true, 1), hp(false, 0), hp(false, 2)]).toEqual([10, 11, 4, 5]);
    expect([discMaxHpFor(realm, { isKing: true }), discMaxHpFor(realm, { skills: { explorer: 1 } })]).toEqual([10, 5]);
  });

  test("the gardens heal the wounded: the king's effects for the king alone", () => {
    const realm = holding(THE_TURNS_END.physickGardens, THE_TURNS_END.royalPhysicians);
    expect([
      theHpARealmsDiscoveriesHealAWoundedHeroBy(realm, { isHeTheKing: true }),
      theHpARealmsDiscoveriesHealAWoundedHeroBy(realm, { isHeTheKing: false }),
      doARealmsDiscoveriesHealTheWounded(realm),
      doARealmsDiscoveriesHealTheWounded(holding(THE_TURNS_END.royalPhysicians)),
      doARealmsDiscoveriesHealTheWounded(holding(THE_TURNS_END.thickHides)),
    ]).toEqual([7, 3, true, true, false]);
  });

  test("the Embalmers: the graves of the realm's ground never rot; with none, the ground's own rate", () => {
    expect(theRateARealmsDiscoveriesLetTheGravesRotAt(holding(THE_TURNS_END.embalmers), 0.1)).toBe(0);
    expect(theRateARealmsDiscoveriesLetTheGravesRotAt(holding(THE_TURNS_END.physickGardens), 0.1)).toBe(0.1);
    expect(theRateARealmsDiscoveriesLetTheGravesRotAt(undefined, 0.05)).toBe(0.05);
  });

  test("War Academy's chance, Herbal Lore's share, Informant Network and Arcane Observatory, or none", () => {
    const T = THE_TURNS_END;
    const all = holding(T.warAcademy, T.herbalLore, T.informantNetwork, T.arcaneObservatory);
    const none = holding(T.thickHides);
    expect(
      [all, none].map((realm) => [
        theChanceARealmsDiscoveriesPromoteTheCapitalsArmies(realm),
        theShareARealmsDiscoveriesDressAFightersWoundsBy(realm),
        doARealmsDiscoveriesNameAnUnseenCaptain(realm),
        doARealmsDiscoveriesChartAProvince(realm),
      ]),
    ).toEqual([
      [0.07, 0.6, true, true],
      [null, null, false, false],
    ]);
  });
});

describe("the turn's end and the new turn, on rows the content doesn't write (P1-19ag)", () => {
  test("no number: each adds, cuts or heals nothing, keeps the ground's rate, or takes its fallback", () => {
    const got = withPlantedRows(
      {
        tax: { kind: 'tax' },
        interest: { kind: 'interest' },
        upkeep: { kind: 'upkeep' },
        heroWage: { kind: 'heroWage' },
        heroWageCap: { kind: 'heroWageCap' },
        maxHp: { kind: 'maxHp' },
        regen: { kind: 'regen' },
        graveDecay: { kind: 'graveDecay' },
        homePromotion: { kind: 'homePromotion' },
        autoHeal: { kind: 'autoHeal' },
      },
      (realm) => [
        taxOf(realm, aProvinceToTax().facts),
        whatARealmsDiscoveriesEarnInInterest(realm, { theTreasury: 100, theCeiling: 10 }),
        theWageARealmsDiscoveriesLeaveAUnit(realm, { theUnit: { type: 'Free Lances' } }, 5, new Map(), 10),
        theWageARealmsDiscoveriesCutsLeaveAHero(realm, { theHerosAlignment: 'Good' }, 5, new Map(), 10),
        theWageARealmsDiscoveriesCeilingsLeaveAHero(realm, 5, new Map(), 10),
        whatARealmsDiscoveriesAddToAHerosMaximumHp(realm, { isHeTheKing: false, theLevelsOfHisSkills: {} }),
        theHpARealmsDiscoveriesHealAWoundedHeroBy(realm, { isHeTheKing: false }),
        theRateARealmsDiscoveriesLetTheGravesRotAt(realm, 0.1),
        theChanceARealmsDiscoveriesPromoteTheCapitalsArmies(realm),
        theShareARealmsDiscoveriesDressAFightersWoundsBy(realm),
      ],
    );
    expect(got).toEqual([0, 0, 5, 5, 5, 0, 0, 0.1, 0.5, 0.4]);
  });

  test("a row's filters the content writes with no other: a tax row's ceiling of its own only, a hero's wage for no alignment", () => {
    const got = withPlantedRows(
      { own: { kind: 'tax', bonus: 2, max: 1 }, nobody: { kind: 'heroWage', amount: 2, heroAlign: [] } },
      (realm) => [
        taxOf(realm, aProvinceToTax().facts, 5),
        theWageARealmsDiscoveriesCutsLeaveAHero(realm, { theHerosAlignment: 'Good' }, 5, new Map(), 10),
      ],
    );
    expect(got).toEqual([1, 5]);
  });
});

describe("the bots' strength estimates, with Dragon Taming and Flanking Tactics (P1-19ah: the matrix meets them in the bots' plan; no test saw them)", () => {
  /** A world of one Good Human realm holding the discoveries given, and its Druid-0 Human commander. */
  const aRealmHolding = (ids: readonly string[]) => ({
    G: {
      players: [{ alignment: 'Good', race: 'Human', discoveries: ids.map((id) => ({ id })) }],
      turn: -2,
      world: { provinces: [] },
    },
    theCommander: { player: 0, race: 'Human', skills: {}, armies: [] },
  });
  const aDragon = [{ type: 'Elder Dragons', race: 'Primal', quality: 'Average' }];
  const aHost = Array.from({ length: 8 }, () => ({ type: 'Shieldwall Levies', race: 'Human', quality: 'Average' }));
  const aProvince = { id: 1, race: 'Human', armyTypes: ['Shieldwall Levies', 'Elder Dragons'] };

  test('an Elder Dragon follows a Druid-0 commander whose realm tames it at full strength, and at a shortfall of 5 without', () => {
    const estimates = (G: object, c: object): unknown[] => [
      botEffForce(G, c, aDragon),
      botBattleForce(G, c, aDragon, 'plains', {}),
      botDruidShortfall(G, c, aDragon),
      botRecruitableTypes(aProvince, G, c),
    ];
    const tamed = aRealmHolding(['sd40']);
    expect(estimates(tamed.G, tamed.theCommander)).toEqual([38, 38, 0, ['Elder Dragons', 'Shieldwall Levies']]);
    const untamed = aRealmHolding(['sd09']);
    const without = estimates(untamed.G, untamed.theCommander);
    expect(without.slice(2)).toEqual([5, ['Shieldwall Levies', 'Elder Dragons']]);
    expect(without[0]).toBeCloseTo(3.8, 9);
    expect(without[1]).toBeCloseTo(3.8, 9);
    // a commander of no realm, and a world with no list of realms, hold no discovery
    for (const [G, c] of [
      [tamed.G, { ...tamed.theCommander, player: null }],
      [{ turn: -2, world: { provinces: [] } }, tamed.theCommander],
    ] as const) {
      const none = estimates(G, c);
      expect(none.slice(2)).toEqual([5, ['Shieldwall Levies', 'Elder Dragons']]);
      expect(none[0]).toBeCloseTo(3.8, 9);
      expect(none[1]).toBeCloseTo(3.8, 9);
    }
  });

  test("Flanking Tactics weights a host's lines behind the front, for a commander of a realm that holds it only", () => {
    const flanking = aRealmHolding(['sd09']);
    const plain = aRealmHolding([]);
    expect(botBattleForce(flanking.G, flanking.theCommander, aHost, 'plains', {})).toBeCloseTo(87.12, 9);
    expect(botBattleForce(plain.G, plain.theCommander, aHost, 'plains', {})).toBeCloseTo(86.4, 9);
    // a commander of no realm: no flank, and no kinship with a king's folk
    for (const G of [flanking.G, plain.G])
      expect(botBattleForce(G, { ...flanking.theCommander, player: null }, aHost, 'plains', {})).toBeCloseTo(72, 9);
  });
});
