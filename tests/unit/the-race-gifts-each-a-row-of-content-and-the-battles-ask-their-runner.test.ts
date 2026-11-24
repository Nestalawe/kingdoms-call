// The race gifts in a battle (B-06ae): each gift is a row of content (src/content/the-race-gifts-their-keys-races-and-
// numbers.ts) and the battles ask the race gifts' runners (src/engine/rules/the-registry-of-the-race-gifts.ts):
// - the runners give, for every pair of a realm's race and a company's or a province's race (the four peoples, the
//   wild's, none), every ground and every side, what the engine's own tests gave before B-06ae: Woodland Mastery's ×1.5
//   for an Elven company of an Elven realm in forest or jungle, the Bulwark's ×1.5 for a Dwarven company of a Dwarven
//   realm defending, Raiders' Muster's flag for an Orcish realm's win in an Orcish province, the War-spoils for an
//   Orcish company of an Orcish realm;
// - armStr's figure for a company of each gift (each one rounded step: an Elven realm's Stag Riders in the woods 15 to
//   23, in the jungle 14 to 21; a Dwarven realm's Ironhoof Rams defending the plain 14 to 21), and none for a company
//   of another realm, on other ground or attacking, with the ladder's reason for each step;
// - markOrcAttackWin stamps an Orcish realm's Orcish companies (not a phantom, not another race's), tells the field's
//   plunder by their count, and stamps nothing for a realm of another race.
// Level 1 (unit): pure functions called directly on the engine's modules, with no turn played; none draws a die. Each
// figure is the one the file gave before B-06ae (the battle's own tests, inline). The races are written out here, as
// the old code wrote them: the test holds the rows to them.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { armStr } from '../../src/engine/battle/terrain-and-unit-strength.ts';
import { markOrcAttackWin } from '../../src/engine/units/drill-and-spoils.ts';
import {
  doesACompanyTakeItsRealmsSpoilsOfABattleWonAttacking,
  doesARealmsRaceTakeTheSpoilsOfABattleWonAttacking,
  doesTheWinnersRaceFlagTheProvinceItWonABattleIn,
  theStepsTheGiftsOfItsRealmsRaceMakeOnACompany,
} from '../../src/engine/rules/the-registry-of-the-race-gifts.ts';
import type { ArmyInABattle } from '../../src/engine/army-tables.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';
import type { Army, GameState } from '../../src/schemas/saved-game-state.ts';
import type { AModifierOfAUnitInTheLadder } from '../../src/engine/battle/the-facts-a-battles-lines-record.ts';
import { RealmIndexSchema } from '../../src/schemas/ids-of-provinces-heroes-and-realms.ts';

const RACES = ['Human', 'Elven', 'Dwarven', 'Orcish', 'Primal:Wolf', '', null, undefined] as const;
const TERRAINS = ['forest', 'jungle', 'plain', 'mountain', 'sea', null, undefined] as const;
const SIDES = ['defending', 'attacking', null] as const;

describe("the runners give what the engine's own tests gave", () => {
  test('Woodland Mastery and the Bulwark: one step each, at ×1.5', () => {
    for (const realm of RACES)
      for (const company of RACES)
        for (const terrain of TERRAINS)
          for (const side of SIDES) {
            const before = [
              ...(company === 'Elven' && realm === 'Elven' && (terrain === 'forest' || terrain === 'jungle')
                ? [{ theGift: 'woodland-mastery', theFactor: 1.5 }]
                : []),
              ...(company === 'Dwarven' && realm === 'Dwarven' && side === 'defending'
                ? [{ theGift: 'bulwark', theFactor: 1.5 }]
                : []),
            ];
            expect(
              theStepsTheGiftsOfItsRealmsRaceMakeOnACompany(realm, {
                theCompanysRace: company,
                theTerrain: terrain,
                itsSide: side,
              }),
              `a ${String(company)} company of a ${String(realm)} realm, ${String(terrain)}, ${String(side)}`,
            ).toEqual(before);
          }
  });

  test("Raiders' Muster's flag: an Orcish realm's win in an Orcish province", () => {
    for (const winner of RACES)
      for (const province of RACES)
        expect(
          doesTheWinnersRaceFlagTheProvinceItWonABattleIn(winner, { theProvincesRace: province }),
          `a ${String(winner)} realm wins in a ${String(province)} province`,
        ).toBe(province === 'Orcish' && winner === 'Orcish');
  });

  test('the War-spoils: an Orcish company of an Orcish realm', () => {
    for (const realm of RACES) {
      expect(doesARealmsRaceTakeTheSpoilsOfABattleWonAttacking(realm), `a ${String(realm)} realm`).toBe(
        realm === 'Orcish',
      );
      for (const company of RACES)
        expect(
          doesACompanyTakeItsRealmsSpoilsOfABattleWonAttacking(realm, { theCompanysRace: company }),
          `a ${String(company)} company of a ${String(realm)} realm`,
        ).toBe(realm === 'Orcish' && company === 'Orcish');
    }
  });
});

describe("armStr's figure for a company of each gift", () => {
  const turn = {
    G: { players: [{ alignment: 'Neutral', race: 'Human', discoveries: [] }], characters: [] },
  } as unknown as TurnContext;
  /** armStr's figure and its ladder's reasons for an Average company of `type` and `race`, unled, of a realm of
   *  `realm`, on `terrain`, on the side given. */
  const strength = (
    type: string,
    race: string,
    realm: string,
    terrain: string,
    isAttacker: boolean | null,
  ): [number, string[]] => {
    const trace: AModifierOfAUnitInTheLadder[] = [];
    const company: ArmyInABattle = { type, quality: 'Average', race, unitName: `the Test ${type}` };
    const figure = armStr(turn, company, null, null, terrain, { ownerRace: realm, isAttacker, force: [], trace });
    return [figure, trace.map((step) => step.reason.kind)];
  };

  test.for([
    ['Stag Riders', 'Elven', 'Elven', 'forest', true, 23, ['its kin', 'the ground', 'elven woodland mastery']],
    ['Stag Riders', 'Elven', 'Elven', 'forest', false, 23, ['its kin', 'the ground', 'elven woodland mastery']],
    ['Stag Riders', 'Elven', 'Elven', 'jungle', null, 21, ['its kin', 'elven woodland mastery']],
    ['Stag Riders', 'Elven', 'Elven', 'plain', true, 15, ['its kin', 'the ground']],
    ['Stag Riders', 'Elven', 'Human', 'forest', true, 13, ['the ground']],
    ['Ironhoof Rams', 'Dwarven', 'Dwarven', 'plain', false, 21, ['its kin', 'the dwarven bulwark']],
    ['Ironhoof Rams', 'Dwarven', 'Dwarven', 'plain', true, 14, ['its kin']],
    ['Ironhoof Rams', 'Dwarven', 'Dwarven', 'plain', null, 14, ['its kin']],
    ['Ironhoof Rams', 'Dwarven', 'Human', 'plain', false, 12, []],
    ['Dwarven Guard', 'Dwarven', 'Dwarven', 'plain', false, 18, ['its kin', 'the ground', 'the dwarven bulwark']],
  ] as const)(
    '%s (%s) of a realm of %s, %s, attacking %s: %i',
    ([type, race, realm, terrain, isAttacker, figure, reasons]) => {
      expect(strength(type, race, realm, terrain, isAttacker)).toEqual([figure, reasons]);
    },
  );
});

describe("markOrcAttackWin: the War-spoils' stamp", () => {
  const company = (name: string, race: string, extra: Partial<Army> = {}): Army => ({
    type: 'Orc Berserkers',
    quality: 'Average',
    race,
    unitName: name,
    ...extra,
  });

  test("an Orcish realm's Orcish companies are stamped with the turn, and the field's plunder is told by their count", () => {
    const companies = [
      company('Gutrend', 'Orcish'),
      company('Lowfield Levy', 'Human'),
      company('Phantom Host', 'Orcish', { _phantom: true }),
      company('Skullcleft', 'Orcish'),
    ];
    const battle = { narrative: [] };
    const players = [{ race: 'Orcish' }];
    expect(
      markOrcAttackWin(
        { player: RealmIndexSchema.parse(0), name: 'Warlord Grosh', armies: companies },
        { players, turn: 7 } as unknown as Pick<GameState, 'players' | 'turn'>,
        battle,
      ),
    ).toBe(2);
    expect(companies.map((c) => c._orcAtkWinTurn)).toEqual([7, undefined, undefined, 7]);
    expect(battle.narrative).toEqual([
      { kind: 'Orcish units plunder the field of a battle won attacking', heroName: 'Warlord Grosh', units: 2 },
    ]);
  });

  test("a realm of another race's Orcish companies are not stamped", () => {
    const companies = [company('Gutrend', 'Orcish')];
    const battle = { narrative: [] };
    const players = [{ race: 'Human' }];
    expect(
      markOrcAttackWin(
        { player: RealmIndexSchema.parse(0), name: 'Lord Aldric', armies: companies },
        { players, turn: 7 } as unknown as Pick<GameState, 'players' | 'turn'>,
        battle,
      ),
    ).toBe(0);
    expect(companies[0]?._orcAtkWinTurn).toBeUndefined();
    expect(battle.narrative).toEqual([]);
  });
});
