// The lines of src/engine/army-tables.ts, src/engine/units/movement.ts and src/engine/battle/strength.ts that plan
// P1-10b2 changed to type them (statements that keep every value: P1-10b's Decision 2 and Choice 1) and that no game
// of the balance matrix reaches. The matrix proves the others (both sets, every realm's report identical); these are
// proved here, each on the value it had before:
// - ownedUnitName for a unit whose name doesn't start with "the" (every unit a matrix battle names this way does), a
//   unit with no name, and none at all;
// - migrateLegacyUnitNames on an older save (no matrix game holds a legacy unit or race name): every place it renames,
//   the holes and missing fields its guards skip, the count it logs, and a second run that changes nothing.
// Level 1 (unit): pure functions called directly on the engine's modules (plan P1-14a), with no turn played. The
// renames are also proved on the booted GM page by tests/primal-renames.test.js (level 1, a whole fixture game).
import '../lib/the-whole-engine.ts';
import { describe, expect, test, vi } from 'vitest';
import { migrateLegacyUnitNames, ownedUnitName } from '../../src/engine/army-tables.ts';
import { CharacterIdSchema, ProvinceIdSchema } from '../../src/schemas/ids-of-provinces-heroes-and-realms.ts';

describe("ownedUnitName: an owner and a unit's name or type", () => {
  test('a unit named "the …" reads "the Red Hand (Atk\'s Eagle Riders)"', () => {
    expect(ownedUnitName('Atk', { type: 'Eagle Riders', unitName: 'the Red Hand' })).toBe(
      "the Red Hand (Atk's Eagle Riders)",
    );
  });
  test('a unit with another name reads the owner, then the name', () => {
    expect(ownedUnitName('Atk', { type: 'Warg Riders', unitName: 'Grimtusk Riders' })).toBe("Atk's Grimtusk Riders");
    expect(ownedUnitName(null, { type: 'Warg Riders', unitName: 'Grimtusk Riders' })).toBe('Grimtusk Riders');
  });
  test('a unit with no name reads its type', () => {
    expect(ownedUnitName('Atk', { type: 'Warg Riders', unitName: '' })).toBe("Atk's Warg Riders");
  });
  test('a unit with neither name nor type, or no unit at all, reads "unit"', () => {
    expect(ownedUnitName('Atk', { type: '', unitName: '' })).toBe("Atk's unit");
    expect(ownedUnitName('Atk', null)).toBe("Atk's unit");
    expect(ownedUnitName(undefined, undefined)).toBe('unit');
  });
});

/** An older save: every place migrateLegacyUnitNames renames holds an old name, beside holes its guards skip. */
const anOlderSave = () => ({
  characters: [
    { armies: [{ type: 'Infantry', race: 'Human' }, null, { type: 'Giant Eagles', race: 'Primal:Giant Eagle' }] },
    { armies: null },
    {},
  ],
  world: {
    provinces: [
      {
        race: 'Primal:Leviathan',
        garrisonArmies: [{ type: 'Knights', race: 'Human' }],
        neutralDefenders: [{ type: 'Leviathan Pods', race: 'Primal:Leviathan' }, undefined],
        armyTypes: ['Cavalry', 'Shieldwall Levies', 'Kraken Tentacles'],
        battleGraves: [{ type: 'Crossbowmen' }, null, { type: null }],
      },
      null,
      { race: 'Human', armyTypes: null },
    ],
  },
  heroGraveyard: [
    {
      id: CharacterIdSchema.parse(1),
      name: 'Sir Testwin',
      player: null,
      race: 'Human',
      alignment: 'Good',
      temper: 'Bold',
      skills: {},
      maxHp: 15,
      isKing: false,
      killedOnTurn: 3,
      location: ProvinceIdSchema.parse(4),
      served: [],
      _releasedBy: null,
      armies: [{ type: 'Longbowmen', race: 'Human' }],
    },
    null,
  ],
});

describe('migrateLegacyUnitNames on an older save', () => {
  test("renames every old unit and race name: heroes' companies, a province's race, garrison, defenders, recruit pool and graves, and a fallen hero's companies", () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const s = migrateLegacyUnitNames(anOlderSave());
    expect(log.mock.calls).toEqual([['[migration] renamed 11 legacy unit reference(s) to the current names.']]);
    expect(s).toEqual({
      characters: [
        {
          armies: [
            { type: 'Shieldwall Levies', race: 'Human' },
            null,
            { type: 'Thunderbirds', race: 'Primal:Thunderbird' },
          ],
        },
        { armies: null },
        {},
      ],
      world: {
        provinces: [
          {
            race: 'Primal:Kraken',
            garrisonArmies: [{ type: 'Gilded Lances', race: 'Human' }],
            neutralDefenders: [{ type: 'Eldritch Kraken', race: 'Primal:Kraken' }, undefined],
            armyTypes: ['Free Lances', 'Shieldwall Levies', 'Eldritch Kraken'],
            battleGraves: [{ type: 'Ironwood Crossbows' }, null, { type: null }],
          },
          null,
          { race: 'Human', armyTypes: null },
        ],
      },
      heroGraveyard: [expect.objectContaining({ armies: [{ type: 'Yeoman Longbows', race: 'Human' }] }), null],
    });
  });
  test('a second run changes nothing', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const once = migrateLegacyUnitNames(anOlderSave());
    const copy = structuredClone(once);
    log.mockClear();
    expect(migrateLegacyUnitNames(once)).toEqual(copy);
    expect(log).not.toHaveBeenCalled();
  });
  test('a save with no world, no heroes and no graves, or no save at all, comes back as it was', () => {
    expect(migrateLegacyUnitNames({})).toEqual({});
    expect(migrateLegacyUnitNames({ world: null, characters: null, heroGraveyard: null })).toEqual({
      world: null,
      characters: null,
      heroGraveyard: null,
    });
    expect(migrateLegacyUnitNames({ world: {} })).toEqual({ world: {} });
    expect(migrateLegacyUnitNames(null)).toBeNull();
    expect(migrateLegacyUnitNames(undefined)).toBeUndefined();
  });
});
