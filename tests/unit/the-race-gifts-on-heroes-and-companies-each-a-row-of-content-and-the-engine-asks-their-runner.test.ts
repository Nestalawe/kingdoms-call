// The race gifts on heroes and companies (B-06af): each gift is a row of content (src/content/the-race-gifts-their-
// keys-races-and-numbers.ts) and the engine asks the race gifts' runners (src/engine/rules/the-registry-of-the-race-
// gifts.ts):
// - the runners give, for every pair of a realm's race and a hero's or a company's race (the four peoples, the wild's,
//   none) and every ground, what the engine's own tests gave before B-06af: Quick learners' ×1.5 for a Human hero of a
//   Human realm, Drillmasters' ×2 for a Human company of a Human realm, Iron constitution's 18 and 5 for an Orcish hero
//   of an Orcish realm, Mithril Armour for a Dwarven hero of a Dwarven realm, Homeward Flight's 30 in desert or mountain,
//   60 in forest or jungle and 45 elsewhere for an Elven company of an Elven realm;
// - the functions that ask them give the old figures: humanXPMult, maxHpIsOrc, hpStartOf, hpGainBand on each side of
//   each band, mithrilQualifies (a fallen hero, a wanderer, a realm missing), and the practice's quick learners' share;
// - recordBattleGraves, its one die fed: an Elven realm's fallen Elven company flees home on a roll under its ground's
//   chance and leaves a grave on the roll at it, and no die is drawn for another race's company, another realm's, a
//   realm of none, a company raised for the turn or one already fled.
// Level 1 (unit): pure functions called directly on the engine's modules, with no turn played; only recordBattleGraves
// draws a die, and it is fed. Each figure is the one the file gave before B-06af (the old tests, inline). The races are
// written out here, as the old code wrote them: the test holds the rows to them.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import {
  doesAGiftOfHisRealmsRaceQuickenAHerosLearning,
  doesAGiftOfHisRealmsRaceSuitAHeroInMithril,
  theFactorTheGiftsOfHisRealmsRaceQuickenAHerosLearningBy,
  theFactorTheGiftsOfItsRealmsRaceQuickenACompanysDrillBy,
  theFlightHomeTheGiftsOfItsRealmsRaceGiveAFallenCompany,
  theHitPointsTheGiftsOfHisRealmsRaceGiveAHero,
} from '../../src/engine/rules/the-registry-of-the-race-gifts.ts';
import { humanXPMult } from '../../src/engine/units/drill-and-spoils.ts';
import { hpGainBand, hpStartOf, maxHpIsOrc } from '../../src/engine/heroes/skills-and-hp.ts';
import { mithrilQualifies } from '../../src/engine/personal-combat/helpers.ts';
import { recordBattleGraves } from '../../src/engine/graves.ts';
import { theShareAQuickLearnerPractisesAt } from '../../src/engine/rules-on-plain-values/the-chance-a-practice-alone-raises-a-skill-and-the-price-and-wage-a-druid-or-a-host-leader-cuts.ts';
import type { ElvenEscape } from '../../src/engine/turn/context.ts';
import type { Army } from '../../src/schemas/saved-game-state.ts';
import { plannedDice, withTheDice } from '../lib/hand-made-battle-lines.ts';

const RACES = ['Human', 'Elven', 'Dwarven', 'Orcish', 'Primal:Wolf', '', null, undefined] as const;
const TERRAINS = ['desert', 'mountain', 'forest', 'jungle', 'plain', 'hills', 'sea', null, undefined] as const;
/** A race as the message names it. */
const named = (race: string | null | undefined) => (race === '' ? "''" : String(race));
/** The old chance an Elven company flees home from the ground it fell on (elvenEscapeChance, before B-06af). */
const theOldChanceToFleeHome = (terrain: string | null | undefined) =>
  terrain === 'desert' || terrain === 'mountain' ? 30 : terrain === 'forest' || terrain === 'jungle' ? 60 : 45;

describe("the runners give what the engine's own tests gave", () => {
  test("Quick learners: a Human hero of a Human realm learns at ×1.5, and the practice's share is the row's", () => {
    for (const realm of RACES)
      for (const hero of RACES) {
        const was = hero === 'Human' && realm === 'Human';
        const what = `a ${named(hero)} hero of a ${named(realm)} realm`;
        expect(theFactorTheGiftsOfHisRealmsRaceQuickenAHerosLearningBy(realm, { theHerosRace: hero }), what).toBe(
          was ? 1.5 : 1,
        );
        expect(doesAGiftOfHisRealmsRaceQuickenAHerosLearning(realm, { theHerosRace: hero }), what).toBe(was);
      }
    expect([theShareAQuickLearnerPractisesAt(true), theShareAQuickLearnerPractisesAt(false)]).toEqual([1.5, 1]);
  });

  test('Drillmasters: a Human company of a Human realm drills at ×2, in the runner and in humanXPMult', () => {
    for (const realm of RACES)
      for (const company of RACES) {
        const was = company === 'Human' && realm === 'Human' ? 2 : 1;
        const what = `a ${named(company)} company of a ${named(realm)} realm`;
        expect(theFactorTheGiftsOfItsRealmsRaceQuickenACompanysDrillBy(realm, { theCompanysRace: company }), what).toBe(
          was,
        );
        const theRace = company ?? undefined;
        const players = [{ race: 'Elven' }, { race: realm }];
        expect(humanXPMult({ race: theRace }, 1, { players }), what).toBe(was);
        expect(humanXPMult({ race: theRace }, null, { players }), `${what}, with no owner`).toBe(1);
        expect(humanXPMult({ race: theRace }, 2, { players }), `${what}, his realm missing`).toBe(1);
      }
    expect(humanXPMult(null, 0, { players: [{ race: 'Human' }] }), 'no company').toBe(1);
  });

  test('Iron constitution: an Orcish hero of an Orcish realm starts at 18, each band of his hardening 5 higher', () => {
    for (const realm of RACES)
      for (const hero of RACES) {
        const was = hero === 'Orcish' && realm === 'Orcish';
        const what = `a ${named(hero)} hero of a ${named(realm)} realm`;
        expect(theHitPointsTheGiftsOfHisRealmsRaceGiveAHero(realm, { theHerosRace: hero }), what).toEqual(
          was ? { theHitPointsAtTheStart: 18, theShiftOfTheHardeningsBands: 5 } : null,
        );
        const players = [{ race: 'Human' }, { race: realm ?? undefined }];
        const him = { race: hero ?? undefined, player: 1 };
        expect(maxHpIsOrc(him, players), what).toBe(was);
        expect(hpStartOf(him, players), what).toBe(was ? 18 : 15);
        // the old curve: 1–3 under 40, 1–2 under 50, then 1 (+5 on each band for the Orcish edge), on the earned base
        for (const hpEarned of [0, 21, 22, 24, 25, 26, 27, 31, 32, 34, 35, 36, 37, 40]) {
          const base = (was ? 18 : 15) + hpEarned;
          const shift = was ? 5 : 0;
          const before = base < 40 + shift ? { lo: 1, hi: 3 } : base < 50 + shift ? { lo: 1, hi: 2 } : { lo: 1, hi: 1 };
          expect(hpGainBand({ ...him, hpEarned }, players), `${what}, ${String(hpEarned)} earned`).toEqual(before);
        }
      }
    expect(maxHpIsOrc({ race: 'Orcish', player: null }, [{ race: 'Orcish' }]), 'a wanderer').toBe(false);
    expect(hpStartOf({ race: 'Orcish', player: null }, [{ race: 'Orcish' }]), 'a wanderer').toBe(15);
    expect(hpStartOf(null, [{ race: 'Orcish' }]), 'no hero').toBe(15);
  });

  test('Mithril Armour: a Dwarven hero of a Dwarven realm, alive, in the runner and in mithrilQualifies', () => {
    for (const realm of RACES)
      for (const hero of RACES) {
        const was = hero === 'Dwarven' && realm === 'Dwarven';
        const what = `a ${named(hero)} hero of a ${named(realm)} realm`;
        expect(doesAGiftOfHisRealmsRaceSuitAHeroInMithril(realm, { theHerosRace: hero }), what).toBe(was);
        const players = [{ race: 'Human' }, { race: realm ?? undefined }];
        const him = { race: hero ?? undefined, player: 1 };
        expect(mithrilQualifies(him, { players }), what).toBe(was);
        expect(mithrilQualifies({ ...him, alive: false }, { players }), `${what}, fallen`).toBe(false);
        expect(mithrilQualifies({ ...him, player: null }, { players }), `${what}, wandering`).toBe(false);
        expect(mithrilQualifies({ ...him, player: 2 }, { players }), `${what}, his realm missing`).toBe(false);
      }
  });

  test("Homeward Flight: an Elven company of an Elven realm, at its ground's chance, as the Elves", () => {
    for (const realm of RACES)
      for (const company of RACES)
        for (const terrain of TERRAINS)
          expect(
            theFlightHomeTheGiftsOfItsRealmsRaceGiveAFallenCompany(realm, {
              theCompanysRace: company,
              theTerrain: terrain,
            }),
            `a ${named(company)} company of a ${named(realm)} realm, fallen on ${String(terrain)}`,
          ).toEqual(
            company === 'Elven' && realm === 'Elven'
              ? { thePercent: theOldChanceToFleeHome(terrain), theRace: 'Elven' }
              : null,
          );
  });
});

describe("recordBattleGraves: Homeward Flight's die, fed", () => {
  /** The graves and the flights home a battle leaves for one fallen `company`, on `terrain`, of the realm at `owner`
   *  (the realms: a Human one, then one of `realm`), its dice `dice`. */
  const theFallOf = (
    company: Partial<Army> & { _temporary?: boolean; _elvenEscaped?: boolean },
    terrain: string,
    realm: string,
    owner: number | null,
    dice: readonly number[],
  ) => {
    const queue: ElvenEscape[] = [];
    const prov: { terrain: string; battleGraves?: Army[] } = { terrain };
    const fallen = { type: 'Wood Elf Archers', quality: 'Veteran', race: 'Elven', unitName: 'the Ashgrove Bows' };
    withTheDice(plannedDice(dice), () => {
      recordBattleGraves(
        { G: { players: [{ race: 'Human' }, { race: realm }] }, _elvenEscapeQueue: queue },
        prov,
        [{ ...fallen, ...company }],
        owner,
      );
    });
    return {
      graves: (prov.battleGraves ?? []).map((g) => `${g.race} ${g.type}`),
      home: queue.map((e) => `${String(e.player)}: ${e.unit.race} ${e.unit.type}`),
    };
  };
  const FLED = { graves: [], home: ['1: Elven Wood Elf Archers'] };
  const STAYED = { graves: ['Elven Wood Elf Archers'], home: [] };

  test.for([
    ['desert', 0.29, FLED],
    ['desert', 0.3, STAYED],
    ['mountain', 0.29, FLED],
    ['mountain', 0.3, STAYED],
    ['forest', 0.59, FLED],
    ['forest', 0.6, STAYED],
    ['jungle', 0.59, FLED],
    ['jungle', 0.6, STAYED],
    ['plain', 0.44, FLED],
    ['plain', 0.45, STAYED],
    ['hills', 0.45, STAYED],
  ] as const)("an Elven realm's Elven company fallen on %s, the die %d", ([terrain, die, left]) => {
    expect(theFallOf({}, terrain, 'Elven', 1, [die])).toEqual(left);
  });

  test("no die is drawn for another race's company, another realm's, a realm of none, a company raised for the turn or one already fled", () => {
    const stayed = (race: string) => ({ graves: [`${race} Wood Elf Archers`], home: [] });
    expect(theFallOf({ race: 'Human' }, 'forest', 'Elven', 1, []), 'a Human company of an Elven realm').toEqual(
      stayed('Human'),
    );
    expect(theFallOf({}, 'forest', 'Human', 1, []), 'an Elven company of a Human realm').toEqual(stayed('Elven'));
    expect(theFallOf({}, 'forest', 'Elven', null, []), 'an Elven company of no realm').toEqual(stayed('Elven'));
    expect(theFallOf({ _temporary: true }, 'forest', 'Elven', 1, []), 'raised for the turn').toEqual(stayed('Elven'));
    expect(theFallOf({ _elvenEscaped: true }, 'forest', 'Elven', 1, []), 'already fled').toEqual(stayed('Elven'));
    expect(theFallOf({ _wildHuntUntilTurn: 9 }, 'forest', 'Elven', 1, []), 'of the Wild Hunt').toEqual(stayed('Elven'));
  });
});
