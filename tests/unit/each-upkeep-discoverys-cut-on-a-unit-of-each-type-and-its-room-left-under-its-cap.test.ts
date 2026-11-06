// Each upkeep discovery's cut on a unit of each type and its room left under its cap (plan P1-11e24): the discoveries'
// registry's runner `theCutsARealmsUpkeepDiscoveriesMakeAndTheirRoom`, which a realm's turn report names
// (`theUpkeepDiscoveriesCutsAndTheirRoom`) for the treasury ledger. Each effect the realm holds, in the stage's order:
// its discovery's id (an effect its row writes second too), its gold on each type it reaches and none on a type it
// doesn't, and its room left: the ceiling handed (else its row's own `max`; null with neither) less what the account
// says it has saved, as Early Winter's cuts (discUpkeepWage) leave the account.
//
// Level 1 (unit): the runner's values on staged realms, against the turn's own cuts on the same account. Not lower: a
// static test can't run the runner. The rows the content doesn't write (an upkeep effect written second, one with no
// `max`) are planted in the table of the discoveries by id for their case, and taken out after.
import { describe, expect, test } from 'vitest';
import {
  DISC_BY_ID,
  theCutsARealmsUpkeepDiscoveriesMakeAndTheirRoom,
} from '../../src/engine/rules/the-registry-of-discovery-effects.ts';
import { discUpkeepWage } from '../../src/engine/discoveries.ts';

/** Quartermasters (infantry, -1g, its own max 1g) and Supply Depots (every unit, -1g, its own max 1g); a garrison
 *  isn't infantry. */
const realm = { discoveries: [{ id: 'sd45' }, { id: 'sd55' }] };
const TYPES = ['Shieldwall Levies', 'Free Lances', 'Human Garrison'];

function withPlantedRows<T>(rows: Record<string, object>, fn: (realm: { discoveries: { id: string }[] }) => T): T {
  const ids = Object.keys(rows).map((k) => `test-${k}`);
  Object.entries(rows).forEach(([k, row]) => {
    Reflect.set(DISC_BY_ID, `test-${k}`, { id: `test-${k}`, name: k, category: 'Test', desc: '', ...row });
  });
  try {
    return fn({ discoveries: ids.map((id) => ({ id })) });
  } finally {
    ids.forEach((id) => Reflect.deleteProperty(DISC_BY_ID, id));
  }
}

describe("each upkeep discovery's cut and its room left under its cap", () => {
  test('each in turn, its gold on each type it reaches; the cap whole on an empty account', () => {
    expect(theCutsARealmsUpkeepDiscoveriesMakeAndTheirRoom(realm, TYPES, new Map(), 3)).toEqual([
      {
        theDiscovery: 'sd45',
        theGoldItCutsFromAUnitOfEachType: { 'Shieldwall Levies': 1 },
        theRoomLeftUnderItsCap: 3,
      },
      {
        theDiscovery: 'sd55',
        theGoldItCutsFromAUnitOfEachType: { 'Shieldwall Levies': 1, 'Free Lances': 1, 'Human Garrison': 1 },
        theRoomLeftUnderItsCap: 3,
      },
    ]);
  });

  test("its room once the turn's cuts have drawn on the account: each effect's own", () => {
    const account = new Map();
    // two Levies (2g each): Quartermasters takes 1g off each; Supply Depots finds each at 1g already
    discUpkeepWage(realm, { type: 'Shieldwall Levies' }, 2, account, 3);
    discUpkeepWage(realm, { type: 'Shieldwall Levies' }, 2, account, 3);
    // a Free Lance (3g): Quartermasters doesn't reach him; Supply Depots takes 1g
    discUpkeepWage(realm, { type: 'Free Lances' }, 3, account, 3);
    expect(
      theCutsARealmsUpkeepDiscoveriesMakeAndTheirRoom(realm, TYPES, account, 3).map((c) => c.theRoomLeftUnderItsCap),
    ).toEqual([1, 2]);
    // Quartermasters past its cap with the first more, so Supply Depots takes the second's 1g
    discUpkeepWage(realm, { type: 'Shieldwall Levies' }, 2, account, 3);
    discUpkeepWage(realm, { type: 'Shieldwall Levies' }, 2, account, 3);
    expect(
      theCutsARealmsUpkeepDiscoveriesMakeAndTheirRoom(realm, TYPES, account, 3).map((c) => c.theRoomLeftUnderItsCap),
    ).toEqual([0, 1]);
  });

  test("with no ceiling handed, its row's own max; with neither, null", () => {
    expect(
      theCutsARealmsUpkeepDiscoveriesMakeAndTheirRoom(realm, TYPES, new Map(), null).map(
        (c) => c.theRoomLeftUnderItsCap,
      ),
    ).toEqual([1, 1]);
    const cuts = withPlantedRows({ open: { effect: { kind: 'upkeep', delta: -2 } } }, (planted) =>
      theCutsARealmsUpkeepDiscoveriesMakeAndTheirRoom(planted, TYPES, new Map(), undefined),
    );
    expect(cuts).toEqual([
      {
        theDiscovery: 'test-open',
        theGoldItCutsFromAUnitOfEachType: { 'Shieldwall Levies': 2, 'Free Lances': 2, 'Human Garrison': 2 },
        theRoomLeftUnderItsCap: null,
      },
    ]);
  });

  test("an upkeep effect its row writes second is named by its row's id; a realm with none, an empty list", () => {
    const cuts = withPlantedRows(
      { second: { effect: { kind: 'tax', delta: 1 }, effect2: { kind: 'upkeep', delta: -1, types: ['Free Lances'] } } },
      (planted) => theCutsARealmsUpkeepDiscoveriesMakeAndTheirRoom(planted, TYPES, new Map(), 2),
    );
    expect(cuts).toEqual([
      {
        theDiscovery: 'test-second',
        theGoldItCutsFromAUnitOfEachType: { 'Free Lances': 1 },
        theRoomLeftUnderItsCap: 2,
      },
    ]);
    expect(theCutsARealmsUpkeepDiscoveriesMakeAndTheirRoom({ discoveries: [] }, TYPES, new Map(), 2)).toEqual([]);
    expect(theCutsARealmsUpkeepDiscoveriesMakeAndTheirRoom(undefined, TYPES, new Map(), 2)).toEqual([]);
  });
});
