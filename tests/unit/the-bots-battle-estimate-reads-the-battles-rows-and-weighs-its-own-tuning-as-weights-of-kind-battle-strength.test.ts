// The bots' battle estimate reads the battle's rows, and weighs its own tuning as weights of kind battleStrength
// (B-06bq, T7, the rules pulled out: the battles' family). Where the bots' figure is the battle's rule, it is the row's:
// Tactical's rise a level (0.2) and its most (×2.0), Naval's rise (0.2), the defender's edge (×1.25, BOT_DEF_BONUS) and
// a Druid shortfall's step (0.2, the row the rule itself reads, strengthLeftByADruidShortfall). Where the bots' figure
// differs, or the battle has no rule, it is the first version's weights, each as the bot wrote it: Tactical and Naval
// each weighed to level 5 (KD-477: a commander of Naval 7 lifts his fleets ×2.0, where the battle lifts them ×2.4);
// the guess at a defence it can't see (an average unit of strength 6, and a rival's province ×1.25; the units by
// tax are the middle of neutralDefBand's band, which the guess asks); and the margin it wants before an attack (its floors, a king's 1.15
// and a hero's 1.0, eased 0.08 a turn without land to at least 0.6 of it, and 0.02 more for each unit of a host past 5,
// at most 0.1). No matrix game shows which figure reads which: the balance games hold the bots' plans only as a whole.
// Tactical's most binds from level 5, so the bots' Tactical level shows only lowered (a plant that raises it stays
// green, as the rule is written).
//
// Level 1 (unit): the bots' functions called directly, on small synthetic commanders and realms (each input pinned: the
// commander's race and skills, the realm's race and alignment, the units' types, qualities and races, the ground, the
// tax), and botGuessDefence on the middle of a bot world (tests/lib/the-middle-of-a-bot-world-on-the-engines-
// modules.ts) of the seed given, every province it reads pinned. A static test can't run them.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { aBotBoard } from '../lib/the-middle-of-a-bot-world-on-the-engines-modules.ts';
import {
  BOT_DEF_BONUS,
  botBattleForce,
  botDruidShortfall,
  botGuessDefence,
  botMarginFor,
} from '../../src/engine/bots/intel.ts';
import { neutralDefBand } from '../../src/engine/units/drill-and-spoils.ts';
import { strengthLeftByADruidShortfall } from '../../src/engine/rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';
import type { GameState } from '../../src/schemas/saved-game-state.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

/** A realm of Humans of no creed but Neutral, and a Human commander of its, of the skills given, with no units. */
const aNeutralHumanRealm = () => ({ players: [{ race: 'Human', alignment: 'Neutral' }], turn: 1 });
const aHumanCommander = (skills: Readonly<Record<string, number>>) => ({
  player: 0,
  race: 'Human',
  skills,
  armies: [],
});

describe("botBattleForce: Tactical's and Naval's rise and Tactical's most are the battle's rows, the levels the bots'", () => {
  /** The strength the bots give a Human commander of the skills given, leading one unit of the type given (Human,
   *  Regular) on the ground given, as a share of what the same commander with no skills is given. */
  const theLift = (type: string, terrain: string, skills: Readonly<Record<string, number>>) => {
    const theUnits = [{ type, quality: 'Regular', race: 'Human' }];
    const G = aNeutralHumanRealm();
    return (
      botBattleForce(G, aHumanCommander(skills), theUnits, terrain, {}) /
      botBattleForce(G, aHumanCommander({}), theUnits, terrain, {})
    );
  };

  test('Tactical lifts a land unit 1 + 0.2 a level, to at most ×2.0, his skills weighed to level 5', () => {
    const lifts = [1, 4, 5, 7].map((tactical) => theLift('Men-at-Arms', 'plains', { tactical }));
    expect(lifts[0], 'Tactical 1').toBeCloseTo(1.2, 10);
    expect(lifts[1], 'Tactical 4').toBeCloseTo(1.8, 10);
    expect(lifts[2], 'Tactical 5').toBeCloseTo(2.0, 10);
    expect(lifts[3], 'Tactical 7: weighed as 5, and at most ×2.0').toBeCloseTo(2.0, 10);
  });

  test("Naval lifts a fleet 1 + 0.2 a level, weighed to level 5 (KD-477: the battle's Naval 7 is ×2.4)", () => {
    const lifts = [3, 5, 7].map((naval) => theLift('Galleon Fleet', 'sea', { naval }));
    expect(lifts[0], 'Naval 3').toBeCloseTo(1.6, 10);
    expect(lifts[1], 'Naval 5').toBeCloseTo(2.0, 10);
    expect(lifts[2], 'Naval 7: weighed as 5').toBeCloseTo(2.0, 10);
  });
});

describe("the defender's edge the bots assume is the battle's row", () => {
  test('BOT_DEF_BONUS is ×1.25', () => {
    expect(BOT_DEF_BONUS).toBe(1.25);
  });
});

describe("botGuessDefence: a defence the bot can't see, by the weights, times the defender's edge", () => {
  /** Realm 0 holds the middle province; six provinces round it, each of no garrison, guard or hero: one of tax 7, one
   *  of tax 4, one of tax 3, one of tax 6, one of tax 7 of realm 1's, and one of tax 2 that realm 0's heroes have walked
   *  on, held by two neutral defenders. Returns the bot's guess at each, in that order. */
  const theGuesses = () => {
    const b = aBotBoard(SEED);
    b.own(b.X, 0);
    const [rich, prosperous, poor, prosperousToo, rivals, walkedOn] = b.ring1;
    const each = [rich, prosperous, poor, prosperousToo, rivals, walkedOn].map((p, k) =>
      b.must(p, `province ${String(k)}`),
    );
    const taxes = [7, 4, 3, 6, 7, 2];
    each.forEach((p, k) => {
      p.tax = taxes[k] ?? 0;
    });
    b.own(b.must(rivals, "realm 1's province"), 1);
    const theWalkedOn = b.must(walkedOn, 'the province walked on');
    theWalkedOn['visitedBy'] = [0];
    theWalkedOn.neutralDefenders = [
      { type: 'Men-at-Arms', quality: 'Regular', race: 'Human', unitName: 'First Watch' },
      { type: 'Men-at-Arms', quality: 'Regular', race: 'Human', unitName: 'Second Watch' },
    ];
    const G: GameState = b.state();
    return each.map((p) => botGuessDefence(G, 0, G.world.provinces[p.id]));
  };

  test('Rich 3.5 units, Prosperous 2.5, Poor 1.5, of strength 6, a rival’s ×1.25 more, walked-on ground by its count', () => {
    const [rich, prosperous, poor, prosperousToo, rivals, walkedOn] = theGuesses();
    expect(rich, 'tax 7: Rich, 3.5 × 6 × 1.25').toBeCloseTo(26.25, 10);
    expect(prosperous, 'tax 4: Prosperous, 2.5 × 6 × 1.25').toBeCloseTo(18.75, 10);
    expect(poor, 'tax 3: Poor, 1.5 × 6 × 1.25').toBeCloseTo(11.25, 10);
    expect(prosperousToo, 'tax 6: Prosperous').toBeCloseTo(18.75, 10);
    expect(rivals, "tax 7, realm 1's: 3.5 × 6 × 1.25 × 1.25").toBeCloseTo(32.8125, 10);
    expect(walkedOn, 'two neutral defenders on ground walked on: 2 × 6 × 1.25').toBeCloseTo(15, 10);
  });
});

describe('the guess at neutral ground asks neutralDefBand, which the world deals its neutral defenders by', () => {
  test('at every tax from 0 to 20 the bots guess the middle of the tax\u2019s band, of strength 6, times the defender\u2019s edge', () => {
    const b = aBotBoard(SEED);
    b.own(b.X, 0);
    const ground = b.must(b.ring1[0], 'a province of no owner');
    const G: GameState = b.state();
    for (let tax = 0; tax <= 20; tax++) {
      ground.tax = tax;
      const [fewest, most] = neutralDefBand(tax);
      expect(botGuessDefence(G, 0, G.world.provinces[ground.id]), `tax ${String(tax)}`).toBeCloseTo(
        ((fewest + most) / 2) * 6 * BOT_DEF_BONUS,
        10,
      );
    }
  });
});

describe('botMarginFor: the margin an attack wants, by the weights', () => {
  /** The margin a king (or a hero) of a realm `stall` turns without land wants, leading `units` units, at the base
   *  margin given. */
  const theMargin = (isKing: boolean, base: number, stall: number, units: number) =>
    botMarginFor(
      { players: [{ _botStall: stall }] } as unknown as Pick<GameState, 'players'>,
      0,
      { isKing, armies: Array.from({ length: units }, () => ({ type: 'Men-at-Arms', quality: 'Regular' })) } as never,
      { kingAttackMargin: base, heroAttackMargin: base },
    );

  test('eased 0.08 a turn to at least 0.6 of it, never below the floor, and 0.02 a unit past 5, at most 0.1', () => {
    expect(theMargin(true, 1.5, 0, 5), 'a king at once, 5 units').toBeCloseTo(1.5, 10);
    expect(theMargin(true, 1.5, 2, 8), 'a king 2 turns without land, 8 units: 1.5 × 0.84 + 0.06').toBeCloseTo(1.32, 10);
    expect(theMargin(true, 1.5, 4, 12), 'a king 4 turns: 1.02, at his floor 1.15, + 0.1 (the most)').toBeCloseTo(
      1.25,
      10,
    );
    expect(theMargin(false, 1.3, 10, 6), 'a hero 10 turns: 0.78, at his floor 1.0, + 0.02').toBeCloseTo(1.02, 10);
    expect(theMargin(true, 2.5, 6, 0), 'a king 6 turns: eased to 0.6 of 2.5').toBeCloseTo(1.5, 10);
  });
});

describe("a Druid shortfall's step: the rule's row, which the bots read back", () => {
  test('a unit keeps 1 less 0.2 a level short, never below 0.1', () => {
    const theShares = [1, 4, 5, 6].map(strengthLeftByADruidShortfall);
    expect(theShares[0], '1 level short').toBeCloseTo(0.8, 10);
    expect(theShares[1], '4 levels short').toBeCloseTo(0.2, 10);
    expect(theShares[2], '5 levels short: the least').toBeCloseTo(0.1, 10);
    expect(theShares[3], '6 levels short: the least').toBeCloseTo(0.1, 10);
  });

  test('botDruidShortfall: a Human commander of Druid 0 is short a beast of level 4 by 4, a dragon by 5', () => {
    const G = aNeutralHumanRealm();
    const theShortfall = (type: string) =>
      botDruidShortfall(G, aHumanCommander({ druid: 0 }), [{ type, quality: 'Regular', race: 'Primal' }]);
    expect(theShortfall('Great Bears'), 'Great Bears (Druid 4)').toBe(4);
    expect(theShortfall('Elder Dragons'), 'Elder Dragons (Druid 5)').toBe(5);
    expect(theShortfall('Whale Cohort'), 'Whale Cohort (Druid 3)').toBe(3);
  });
});
