// Each hero-wage discovery's cut or ceiling and its room left under its cap, and a wage after each of them (plan
// P1-11e30): the discoveries' registry's runner `theCutsAndCeilingsARealmsHeroWageDiscoveriesMakeAndTheirRoom`, which a
// realm's turn report names (`theHeroWageDiscoveriesCutsAndTheirRoom`, `theHeroWageDiscoveriesCeilingsAndTheirRoom`)
// for the treasury ledger; and the plain rules both the turn and the ledger take a wage through (`aWageAfterEachCut`,
// `aWageUnderEachCeiling`, `aHerosWageAfterTheCutsAndTheCeilings`). Each effect the realm holds, in each stage's order:
// its discovery's id, its gold on a hero of each alignment it reaches (or its ceiling), and its room left: the ceiling
// handed (else its row's own `max`) less what the account says it has saved, as Early Winter's (discHeroWage) leaves it.
//
// Level 1 (unit): the rules' values on staged realms, and the room against the turn's own wages on the same account.
// Not lower: a static test can't run them. The parity test's ledger cases compare the ledger with the turn, but a fault
// planted in a shared rule moves both sides, so these cases pin its values.
import { describe, expect, test } from 'vitest';
import { theCutsAndCeilingsARealmsHeroWageDiscoveriesMakeAndTheirRoom } from '../../src/engine/rules/the-registry-of-discovery-effects.ts';
import { discHeroWage } from '../../src/engine/discoveries.ts';
import {
  aHerosWageAfterTheCutsAndTheCeilings,
  aWageAfterEachCut,
  aWageUnderEachCeiling,
} from '../../src/engine/rules-on-plain-values/a-wage-after-each-cut-and-ceiling-a-realms-discoveries-make.ts';

/** Granaries (every hero, -1g), Loyal Retainers (Good and Divine heroes, -1g), Inspiring Leadership (no hero above 3g,
 *  its own max 2g). */
const realm = { discoveries: [{ id: 'sd17' }, { id: 'ag03' }, { id: 'sd38' }] };
const ALIGNMENTS = ['Divine', 'Good', 'Neutral', 'Undead'];

describe("each hero-wage discovery's cut or ceiling and its room left under its cap", () => {
  test('each cut in turn, its gold on each alignment it reaches; each ceiling; the cap whole on an empty account', () => {
    expect(theCutsAndCeilingsARealmsHeroWageDiscoveriesMakeAndTheirRoom(realm, ALIGNMENTS, new Map(), 4)).toEqual({
      theCuts: [
        {
          theDiscovery: 'sd17',
          theGoldItCutsFromAHeroOfEachAlignment: { Divine: 1, Good: 1, Neutral: 1, Undead: 1 },
          theRoomLeftUnderItsCap: 4,
        },
        {
          theDiscovery: 'ag03',
          theGoldItCutsFromAHeroOfEachAlignment: { Divine: 1, Good: 1 },
          theRoomLeftUnderItsCap: 4,
        },
      ],
      theCeilings: [{ theDiscovery: 'sd38', theWagesCeiling: 3, theRoomLeftUnderItsCap: 4 }],
    });
  });

  test("its room once the turn's wages have drawn on the account; with no ceiling handed, its row's own max", () => {
    const account = new Map();
    // a Good hero of 7g: Granaries 1g, Loyal Retainers 1g, then Inspiring Leadership takes him from 5g to 3g
    expect(discHeroWage(realm, { alignment: 'Good' }, 7, account, 4)).toBe(3);
    // a Neutral hero of 3g: Granaries 1g; Loyal Retainers doesn't reach him; 2g is under the ceiling
    expect(discHeroWage(realm, { alignment: 'Neutral' }, 3, account, 4)).toBe(2);
    const after = theCutsAndCeilingsARealmsHeroWageDiscoveriesMakeAndTheirRoom(realm, ALIGNMENTS, account, 4);
    expect([...after.theCuts, ...after.theCeilings].map((c) => c.theRoomLeftUnderItsCap)).toEqual([2, 3, 2]);
    const own = theCutsAndCeilingsARealmsHeroWageDiscoveriesMakeAndTheirRoom(realm, ALIGNMENTS, new Map(), null);
    expect([...own.theCuts, ...own.theCeilings].map((c) => c.theRoomLeftUnderItsCap)).toEqual([1, 1, 2]);
    expect(theCutsAndCeilingsARealmsHeroWageDiscoveriesMakeAndTheirRoom(undefined, ALIGNMENTS, new Map(), 4)).toEqual({
      theCuts: [],
      theCeilings: [],
    });
  });
});

describe('a wage after each cut and each ceiling, under what each may save', () => {
  test('a cut never takes a wage below 1g, and stops at its ceiling: the caller’s, else its own; null reaches nothing', () => {
    const a = { theGold: 2, itsOwnCeiling: 3 };
    const b = { theGold: 1, itsOwnCeiling: undefined };
    const account = new Map<string, number>();
    expect(aWageAfterEachCut([['a', a]], 2, account, null)).toBe(1);
    expect(aWageAfterEachCut([['a', a]], 5, account, null)).toBe(3);
    expect(aWageAfterEachCut([['a', a]], 5, account, null)).toBe(5);
    expect(account.get('a')).toBe(3);
    expect(aWageAfterEachCut([['a', a]], 5, new Map(), 1)).toBe(4);
    expect(
      aWageAfterEachCut(
        [
          ['b', b],
          ['n', null],
        ],
        4,
        account,
        null,
      ),
    ).toBe(3);
    expect(account.has('b')).toBe(false);
  });

  test('a ceiling cuts a wage above it down to it, never below 1g, and stops at its ceiling; then the floor of 1g', () => {
    const c = { theWagesCeiling: 3, itsOwnCeiling: 2 };
    const account = new Map<string, number>();
    expect(aWageUnderEachCeiling([['c', c]], 3, account, null)).toBe(3);
    expect(aWageUnderEachCeiling([['c', c]], 4, account, null)).toBe(3);
    expect(aWageUnderEachCeiling([['c', c]], 6, account, null)).toBe(5);
    expect(aWageUnderEachCeiling([['c', c]], 6, account, null)).toBe(6);
    expect(aWageUnderEachCeiling([['z', { theWagesCeiling: 0, itsOwnCeiling: undefined }]], 6, new Map(), null)).toBe(
      1,
    );
    const halve = (w: number) => w / 2;
    expect(aHerosWageAfterTheCutsAndTheCeilings(halve, (w) => w - 1, 8)).toBe(3);
    expect(aHerosWageAfterTheCutsAndTheCeilings(halve, (w) => w - 5, 4)).toBe(1);
  });
});
