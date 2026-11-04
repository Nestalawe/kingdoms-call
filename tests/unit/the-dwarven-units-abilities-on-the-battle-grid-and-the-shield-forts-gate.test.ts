// The Dwarven units' abilities on the battle grid, and the Shield Fort's gate (2026-10-11, Toby, the unit abilities,
// R-095; plan P1-14l, the old `abilities-dwarven` script): each a matchup and one more.
//   Dwarven Guard        Unbreakable (foot facing them ×0.85; never hit from the side) · Shield Fort (now when at
//                        least half the FRONT LINE is Guard, a Dwarf Garrison counting: shieldFortHolds)
//   Ironwood Crossbows   Armour-Piercing (×1.25 shooting a unit of base strength 6 or more) · Punch Through (unchanged)
//   Mountain Guns        Bombard (×1.15 from the second line, whatever they shoot) · Bombardment (unchanged)
//   Ironhoof Rams        Battering Horns (a Ram riding free turns the flank even of an anchored line) · Crag Charge
//                        (the one cavalry that takes a flank in the mountains)
//   Gnomish Gyrocopters  Flak Gunners (×1.25 when the enemy has flyers) · Flak Screen (unchanged)
//   Dwarf Garrison       Stone Halls (foot facing it in the mountains ×0.9) · Deep Halls (counts as Guard for Shield
//                        Fort)
// Grids placed and faced from rows made by the test (tests/lib/hand-made-battle-lines.ts), each side's strengths the
// old script's table; each unit's facing in words through the prose (theWordsOfWhyAUnitFacesAsItDoes, since P1-12d4).
// The Shield Fort's gate (shieldFortHolds) is called on front lines and forces made by the test, and on placed grids.
// The old script booted the GM portal to call these as its globals; "the GM portal boots" and "shieldFortHolds() is
// declared at module level" are the imports now, and any page error is this file throwing (an unexpected
// console.error fails it: tests/setup/each.ts). Each scene also asks how many of a type it faced, where the old asked
// only that every one it found was so (a scene that faced none passed).
// Level 1 (unit): the grid, the facing and the gate are pure functions, called on the engine's modules. Not static:
// they compute the figures. Not a scenario: nothing here needs a battle's dice.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The six dwarven units' (R-095; `battleGrid`, `battleFacing`, `shieldFortHolds`, on hand-made rows): Unbreakable
// (foot facing Guard ×0.85, no side hit on Guard); Shield Fort's gate reads the front line, not the force (half the
// occupied front cells Guard, a Dwarf Garrison counting; a Guard reserve behind a goblin front is no fort);
// Armour-Piercing ×1.25 shooting base strength 6+; Bombard ×1.15 from the second line; Crag Charge (Rams take the one
// mountain flank); Battering Horns (a free Ram turns an anchored line on open ground); Flak Gunners ×1.25 against
// flyers in the air or on a flank; Stone Halls ×0.9 for foot facing a Dwarf Garrison in the mountains
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { battleGrid, type GridCell } from '../../src/engine/battle/lines.ts';
import { shieldFortHolds } from '../../src/engine/units/movement.ts';
import type { ArmyInABattle } from '../../src/engine/army-tables.ts';
import { theWordsOfWhyAUnitFacesAsItDoes } from '../../src/views/prose/the-words-of-a-battles-lines.ts';
import {
  fight as fightOnTheHandMadeTable,
  rows,
  type AFacedGrid,
  type ASidesUnits,
} from '../lib/hand-made-battle-lines.ts';

/** The units' final strengths in these scenes (the old script's table; a type it doesn't name is 8). */
const BASE: Readonly<Record<string, number | undefined>> = {
  'Dwarven Guard': 12,
  'Ironwood Crossbows': 8,
  'Mountain Guns': 14,
  'Ironhoof Rams': 12,
  'Gnomish Gyrocopters': 10,
  'Dwarf Garrison': 4,
  'Shieldwall Levies': 8,
  'Yeoman Longbows': 8,
  'Free Lances': 10,
  'Warg Riders': 10,
  'Orc Berserkers': 12,
  'Goblin Horde': 6,
  'Eagle Riders': 12,
  'Men-at-Arms': 12,
};
/** So many units of each type, at their strengths in BASE. */
type ASpec = readonly (readonly [type: string, count: number])[];
const withTheirStrengths = (spec: ASpec): ASidesUnits => spec.map(([t, n]) => [t, n, BASE[t] ?? 8] as const);

/** Both sides placed and faced: `me` attacks, `them` defends. */
const fight = (mine: ASpec, theirs: ASpec, W: number, terrain: string) =>
  fightOnTheHandMadeTable(withTheirStrengths(mine), withTheirStrengths(theirs), W, terrain);

/** A grid's faced units of a type. */
const faced = (g: AFacedGrid, type: string) => g.face.units.filter((u) => u.row.a?.type === type);
/** Why a faced unit faces as it does, in words. */
const why = (u: AFacedGrid['face']['units'][number]) => theWordsOfWhyAUnitFacesAsItDoes(u.why);
/** Why each faced unit of a type faces as it does, in words, joined. */
const whyOf = (g: AFacedGrid, type: string) => faced(g, type).map(why).join(' | ');
/** A unit of a type as a force lists it. */
const aUnit = (type: string): ArmyInABattle => ({ type, quality: 'Average', race: '', unitName: type });
/** Within the old script's 1e-6. */
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

describe('Unbreakable: foot facing Guard ×0.85; the Guard are never hit from the side', () => {
  test('Levies facing Guard ×0.85', () => {
    const r = fight([['Shieldwall Levies', 2]], [['Dwarven Guard', 2]], 2, 'plain');
    expect(faced(r.me, 'Shieldwall Levies')).toHaveLength(2);
    for (const u of faced(r.me, 'Shieldwall Levies')) expect(near(u.m, 0.85)).toBe(true);
    expect(whyOf(r.me, 'Shieldwall Levies')).toMatch(/Unbreakable/);
  });

  test('…Berserkers bring their Frenzy against it: ×0.9775', () => {
    const r = fight([['Orc Berserkers', 2]], [['Dwarven Guard', 2]], 2, 'plain');
    expect(faced(r.me, 'Orc Berserkers')).toHaveLength(2);
    for (const u of faced(r.me, 'Orc Berserkers')) {
      expect(near(u.m, 1.15 * 0.85)).toBe(true);
      expect(why(u)).toMatch(/Frenzy, Unbreakable/);
    }
  });

  test("cavalry facing Guard keep cavalry's own ×0.85 only", () => {
    const r = fight([['Free Lances', 2]], [['Dwarven Guard', 2]], 2, 'forest');
    expect(faced(r.me, 'Free Lances')).toHaveLength(2);
    for (const u of faced(r.me, 'Free Lances')) {
      expect(near(u.m, 0.85)).toBe(true);
      expect(why(u)).not.toMatch(/Unbreakable/);
    }
  });

  test('a wrapped Guard line is not hit from the side', () => {
    const r = fight([['Orc Berserkers', 5]], [['Dwarven Guard', 3]], 5, 'plain');
    expect(faced(r.them, 'Dwarven Guard')).toHaveLength(3);
    for (const u of faced(r.them, 'Dwarven Guard')) expect(why(u)).not.toMatch(/hit from the side/);
    expect(whyOf(r.them, 'Dwarven Guard')).toMatch(/Unbreakable/);
  });

  test('…attacking or defending', () => {
    const r = fight([['Dwarven Guard', 3]], [['Orc Berserkers', 5]], 5, 'plain');
    expect(faced(r.me, 'Dwarven Guard')).toHaveLength(3);
    for (const u of faced(r.me, 'Dwarven Guard')) expect(why(u)).not.toMatch(/hit from the side/);
  });
});

describe("Shield Fort's gate: half the front line", () => {
  /** A front line of these types (null an empty cell), as a placed grid gives it. */
  const cells = (types: readonly (string | null)[]): { front: (GridCell | null)[] } => ({
    front: types.map((t) => (t ? { r: { a: aUnit(t) }, role: 'foot', s: 1 } : null)),
  });

  test('two Guard in a front of four hold the fort', () => {
    expect(shieldFortHolds([], cells(['Dwarven Guard', 'Dwarven Guard', 'Orc Berserkers', 'Goblin Horde']))).toBe(true);
  });

  test('one Guard in four does not', () => {
    expect(shieldFortHolds([], cells(['Dwarven Guard', 'Orc Berserkers', 'Goblin Horde', 'Goblin Horde']))).toBe(false);
  });

  test('Deep Halls: a Dwarf Garrison counts as Guard', () => {
    expect(shieldFortHolds([], cells(['Dwarven Guard', 'Dwarf Garrison', 'Goblin Horde', 'Goblin Horde']))).toBe(true);
  });

  test('empty cells are not counted', () => {
    expect(shieldFortHolds([], cells(['Dwarf Garrison', 'Goblin Horde']))).toBe(true);
    expect(shieldFortHolds([], cells([null, 'Goblin Horde', 'Dwarven Guard', null]))).toBe(true);
  });

  test('no Guard in the front, no fort', () => {
    expect(shieldFortHolds([], cells(['Goblin Horde', 'Goblin Horde']))).toBe(false);
    expect(shieldFortHolds([], cells([]))).toBe(false);
  });

  test('without a grid (an estimate) it reads half the force, as before', () => {
    const force = (types: readonly string[]) => types.map(aUnit);
    expect(shieldFortHolds(force(['Dwarven Guard', 'Dwarven Guard', 'Goblin Horde']), null)).toBe(true);
    expect(shieldFortHolds(force(['Dwarven Guard', 'Goblin Horde', 'Goblin Horde']), null)).toBe(false);
  });

  // …and a reserve of Guard behind a goblin front is no fort: the gate reads the front, not the force.
  test('four Guard and four Goblins: the Guard, being stronger, hold the front → fort', () => {
    const g = battleGrid(
      rows(
        withTheirStrengths([
          ['Goblin Horde', 4],
          ['Dwarven Guard', 4],
        ]),
      ),
      4,
      'plain',
      { tac: 0 },
    );
    expect(shieldFortHolds([], g)).toBe(true);
  });

  test('two Guard behind four stronger Berserkers: no Guard in the front → no fort', () => {
    const g = battleGrid(
      rows(
        withTheirStrengths([
          ['Orc Berserkers', 4],
          ['Dwarven Guard', 2],
        ]),
      ),
      4,
      'plain',
      { tac: 0 },
    );
    expect(shieldFortHolds([], g)).toBe(false);
  });
});

describe('Armour-Piercing: Crossbows shooting a unit of base strength 6 or more ×1.25 (on top of the matchup)', () => {
  test('against Berserkers (base 6): ×1.5625', () => {
    const r = fight(
      [
        ['Dwarven Guard', 2],
        ['Ironwood Crossbows', 2],
      ],
      [['Orc Berserkers', 2]],
      2,
      'plain',
    );
    expect(faced(r.me, 'Ironwood Crossbows')).toHaveLength(2);
    for (const u of faced(r.me, 'Ironwood Crossbows')) {
      expect(near(u.m, 1.25 * 1.25)).toBe(true);
      expect(why(u)).toMatch(/Armour-Piercing/);
    }
  });

  test('…not against Goblins (base 3), who are Arrow Fodder instead: ×0.9375', () => {
    const r = fight(
      [
        ['Dwarven Guard', 2],
        ['Ironwood Crossbows', 2],
      ],
      [['Goblin Horde', 2]],
      2,
      'plain',
    );
    expect(faced(r.me, 'Ironwood Crossbows')).toHaveLength(2);
    for (const u of faced(r.me, 'Ironwood Crossbows')) {
      expect(near(u.m, 1.25 * 0.75)).toBe(true);
      expect(why(u)).not.toMatch(/Armour-Piercing/);
    }
  });
});

test('Bombard: Guns ×1.15 from the second line on top of shooting cavalry ×0.75', () => {
  const r = fight(
    [
      ['Dwarven Guard', 2],
      ['Mountain Guns', 2],
    ],
    [['Free Lances', 2]],
    2,
    'forest',
  );
  expect(faced(r.me, 'Mountain Guns')).toHaveLength(2);
  for (const u of faced(r.me, 'Mountain Guns')) {
    expect(near(u.m, 0.75 * 1.15)).toBe(true);
    expect(why(u)).toMatch(/Bombard/);
  }
});

describe('Crag Charge (Rams take the one flank in the mountains) and Battering Horns (a free Ram turns an anchored line)', () => {
  test('in the mountains the Ram takes the flank and the Warg stands in the line', () => {
    const r = fight(
      [
        ['Dwarven Guard', 3],
        ['Ironhoof Rams', 1],
      ],
      [
        ['Orc Berserkers', 3],
        ['Warg Riders', 1],
      ],
      3,
      'mountain',
    );
    expect(r.me.flanks).toHaveLength(1);
    expect(r.me.flanks[0]?.r.a?.type).toBe('Ironhoof Rams');
    expect(r.them.flanks).toHaveLength(0);
  });

  test("in forest the Rams stand in the line (that ground is the Stags')", () => {
    const r = fight(
      [
        ['Dwarven Guard', 3],
        ['Ironhoof Rams', 1],
      ],
      [['Orc Berserkers', 3]],
      3,
      'forest',
    );
    expect(r.me.flanks).toHaveLength(0);
  });

  const anchored: ASpec = [
    ['Shieldwall Levies', 3],
    ['Yeoman Longbows', 3],
  ];

  test('Battering Horns: a Ram riding free turns a line that infantry anchor at both ends', () => {
    const r = fight(
      [
        ['Dwarven Guard', 3],
        ['Ironhoof Rams', 1],
      ],
      anchored,
      3,
      'plain',
    );
    expect(r.them.face.anchored).toBe(true);
    expect(r.them.face.turned).toBe(true);
    expect(r.me.face.free).toBe(1);
  });

  test('the Longbows behind it shoot at ×0.75', () => {
    const r = fight(
      [
        ['Dwarven Guard', 3],
        ['Ironhoof Rams', 1],
      ],
      anchored,
      3,
      'plain',
    );
    expect(faced(r.them, 'Yeoman Longbows')).toHaveLength(3);
    for (const u of faced(r.them, 'Yeoman Longbows')) {
      expect(why(u)).toMatch(/flank turned \(Battering Horns\)/);
      expect(near(u.m, 1.25 * 0.75)).toBe(true);
    }
  });

  test('…a free Free Lance does not', () => {
    const r = fight(
      [
        ['Dwarven Guard', 3],
        ['Free Lances', 1],
      ],
      anchored,
      3,
      'plain',
    );
    expect(r.them.face.anchored).toBe(true);
    expect(r.them.face.turned).toBe(false);
    expect(r.me.face.free).toBe(1);
  });
});

describe('Flak Gunners: Gyrocopters ×1.25 when the enemy has flyers (in the air or on a flank)', () => {
  test('against Eagles', () => {
    const r = fight(
      [
        ['Dwarven Guard', 2],
        ['Gnomish Gyrocopters', 1],
      ],
      [
        ['Orc Berserkers', 2],
        ['Eagle Riders', 1],
      ],
      2,
      'forest',
    );
    expect(faced(r.me, 'Gnomish Gyrocopters')).toHaveLength(1);
    for (const u of faced(r.me, 'Gnomish Gyrocopters')) {
      expect(near(u.m, 1.25)).toBe(true);
      expect(why(u)).toMatch(/Flak Gunners/);
    }
  });

  test('…and ×1 against an enemy with no flyers', () => {
    const r = fight(
      [
        ['Dwarven Guard', 2],
        ['Gnomish Gyrocopters', 1],
      ],
      [['Orc Berserkers', 2]],
      2,
      'forest',
    );
    expect(faced(r.me, 'Gnomish Gyrocopters')).toHaveLength(1);
    for (const u of faced(r.me, 'Gnomish Gyrocopters')) expect(near(u.m, 1)).toBe(true);
  });
});

describe('Stone Halls: foot facing a Dwarf Garrison in the mountains ×0.9', () => {
  test("under the Berserkers' Frenzy: ×1.035", () => {
    const r = fight([['Orc Berserkers', 2]], [['Dwarf Garrison', 2]], 2, 'mountain');
    expect(faced(r.me, 'Orc Berserkers')).toHaveLength(2);
    for (const u of faced(r.me, 'Orc Berserkers')) expect(near(u.m, 1.15 * 0.9)).toBe(true);
    expect(whyOf(r.me, 'Orc Berserkers')).toMatch(/Stone Halls/);
  });

  test('…and nothing on the plain', () => {
    const r = fight([['Orc Berserkers', 2]], [['Dwarf Garrison', 2]], 2, 'plain');
    expect(faced(r.me, 'Orc Berserkers')).toHaveLength(2);
    for (const u of faced(r.me, 'Orc Berserkers')) expect(near(u.m, 1.15)).toBe(true);
  });
});
