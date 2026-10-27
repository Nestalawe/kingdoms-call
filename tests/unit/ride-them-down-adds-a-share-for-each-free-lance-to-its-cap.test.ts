// Ride Them Down adds a share for each Free Lances company to its cap (plan P1-19's second slice, row P1-19j): a
// winning force's Free Lances add +6% each to every beaten unit's death roll, to +18%, in open country only (plain and
// desert, as both books write it); on rough ground they find no room and add nothing, unless the commander carries the
// War-Horn of the Plains, which gives the full +18% on any ground. Other units, and the holes the battle code leaves in
// a force, add nothing. rideThemDownBonus keeps its name and signature, so this passes on the code before the registry
// took it, as after.
// Why: no race test checks the share (planted at +5% a company, every race and beast script stays green), and the
// balance matrix sees it only as hashes that changed (39 games of 60 on plan P1-19's scoping).
// Level 1 (unit): the engine's function called directly (plan P1-14a) on plain values; nothing else runs. Not lower: the
// share is a value the code works out, which a syntax tree can't evaluate.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { ALL_MAGIC_ITEMS_P } from '../../src/content/kingdoms-call-data.ts';
import { hasItemBase } from '../../src/engine/items/equipment.ts';
import { rideThemDownBonus } from '../../src/engine/units/movement.ts';
import { CharacterSchema, type Character } from '../../src/schemas/saved-game-state.ts';

/** Ride Them Down's numbers as both books write them: +6% a company, to +18%. */
const A_COMPANY = 0.06;
const THE_CAP = 0.18;

const lances = (n: number) => Array.from({ length: n }, () => ({ type: 'Free Lances' }));

/** A commander carrying the items given, every other field as a hero's at birth (parsed by the saved game's schema). */
function aCommander(name: string, items: readonly object[]): Character {
  const noSkill = { melee: 0, archery: 0, tactical: 0, march: 0, naval: 0, sage: 0, spy: 0, thief: 0, druid: 0 };
  const noMagic = { explorer: 0, white: 0, psychic: 0, illusory: 0, elemental: 0, necromancy: 0 };
  return CharacterSchema.parse({
    id: 1,
    name,
    isKing: false,
    player: 0,
    race: 'Human',
    alignment: 'Good',
    temper: 'Bold',
    hp: 10,
    maxHp: 10,
    skills: {},
    aptitude: { ...noSkill, ...noMagic },
    armies: [],
    items,
    location: 0,
    alive: true,
    merits: 0,
    taxBonus: 0,
    pay: 0,
    spellsUsedThisTurn: [],
    locationName: 'Thornmere',
  });
}
/** A commander carrying the War-Horn of the Plains (the content's item, equipped). */
function aCommanderWithTheWarHorn(): Character {
  const horn = ALL_MAGIC_ITEMS_P.find((it) => it.name === 'War-Horn of the Plains');
  if (!horn) throw new Error('the content holds the War-Horn of the Plains');
  return aCommander('Captain Orrin', [{ ...horn, id: 7, equipped: true }]);
}
/** A commander carrying nothing. */
const aCommanderWithNoItems = (): Character => aCommander('Captain Bede', []);

describe('Ride Them Down: a share for each Free Lances company, to its cap', () => {
  test.for([
    ['plain', 1, A_COMPANY],
    ['plain', 2, 2 * A_COMPANY],
    ['plain', 3, THE_CAP],
    ['plain', 4, THE_CAP],
    ['desert', 1, A_COMPANY],
    ['desert', 2, 2 * A_COMPANY],
    ['desert', 5, THE_CAP],
  ] as const)('in open country (%s), %i companies add %s', ([ground, companies, share]) => {
    expect(rideThemDownBonus(lances(companies), ground, aCommanderWithNoItems())).toBeCloseTo(share, 12);
    expect(rideThemDownBonus(lances(companies), ground, null)).toBeCloseTo(share, 12);
  });

  test('only the Free Lances count: other units and the holes in a force add nothing', () => {
    const force = [{ type: 'Free Lances' }, { type: 'Men-at-Arms' }, null, { type: 'Free Lances' }, undefined];
    expect(rideThemDownBonus(force, 'plain', null)).toBeCloseTo(2 * A_COMPANY, 12);
    expect(rideThemDownBonus([{ type: 'Men-at-Arms' }, { type: 'Gilded Lances' }], 'plain', null)).toBe(0);
    expect(rideThemDownBonus([], 'plain', null)).toBe(0);
    expect(rideThemDownBonus(null, 'plain', null)).toBe(0);
  });

  test.for(['forest', 'jungle', 'mountain', 'sea'])('on rough ground (%s) they find no room: nothing', (ground) => {
    expect(rideThemDownBonus(lances(3), ground, aCommanderWithNoItems())).toBe(0);
    expect(rideThemDownBonus(lances(1), ground, null)).toBe(0);
  });

  test('the War-Horn of the Plains: the full share on any ground, with a single company; nothing with none', () => {
    const commander = aCommanderWithTheWarHorn();
    expect(hasItemBase(commander, 'War-Horn of the Plains'), 'the commander carries the War-Horn').toBe(true);
    for (const ground of ['plain', 'desert', 'forest', 'jungle', 'mountain', 'sea'])
      expect(rideThemDownBonus(lances(1), ground, commander), `one company on ${ground}`).toBeCloseTo(THE_CAP, 12);
    expect(rideThemDownBonus(lances(4), 'mountain', commander)).toBeCloseTo(THE_CAP, 12);
    expect(rideThemDownBonus([{ type: 'Men-at-Arms' }], 'plain', commander)).toBe(0);
  });
});
