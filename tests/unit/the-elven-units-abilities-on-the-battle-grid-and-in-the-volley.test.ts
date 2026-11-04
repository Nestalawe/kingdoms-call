// The Elven units' abilities on the battle grid, and in the volley before the battle (2026-10-11, Toby, the unit
// abilities, R-095; plan P1-14l, the old `abilities-elven` script): each a matchup and one more.
//   Forest Wardens   Woodland Skirmish (×1.15 in forest and jungle, facing anyone) · Ambush (unchanged, but see Eyes of
//                    the Forest)
//   Elven Bowmen     Volley at the Charge (×1.25 shooting cavalry from the second line) · Woodland Volley (unchanged)
//   Shadow Archers   Marksmen (×1.25 shooting archers, and they pick the best target along the enemy front) · Loosed
//                    From Cover (unchanged)
//   Stag Riders      Through the Trees (the one cavalry that takes a flank in forest and jungle) · Forest Runners (the
//                    terrain table, tests/roster)
//   Eagle Riders     Stoop on the Horses (may hold a flank slot on open ground; ×1.25 facing cavalry) · Eyes of the
//                    Forest (while they fly with the shooters, an enemy Ambush is spoiled and Shadow Archers can be
//                    shot at) — Skyward Retreat is gone (tests/static/skyward-retreat-and-dread-are-gone-…)
//   Elven Garrison   Thorn Hedge (cavalry facing it in the woods ×0.85) · Tree Watch (in forest or jungle it shoots
//                    like an archer)
// Grids placed and faced from rows made by the test (tests/lib/hand-made-battle-lines.ts), each side's strengths the
// old script's table; each unit's facing in words through the prose (theWordsOfWhyAUnitFacesAsItDoes, since P1-12d4).
// The volley's helpers (abilityMissileUnits, archeryBlockedBy, missileTargetPool) are called on units made by the
// test, each with a quality, a race and a name where the old gave its type alone (the types ask; none of the three
// reads them but a target's quality, which the old gave). The old script booted the GM portal to call these as its
// globals; "the GM portal boots" is the imports now, and any page error is this file throwing (an unexpected
// console.error fails it: tests/setup/each.ts). Each scene also asks how many of a type it faced, where the old asked
// only that every one it found was so (a scene that faced none passed).
// Level 1 (unit): the grid, the facing and the volley's helpers are pure functions, called on the engine's modules.
// Not static: they compute the figures. Not a scenario: nothing here needs a battle's dice.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The six elven units' abilities (R-095; `battleGrid`, `battleFacing`, `abilityMissileUnits`, `archeryBlockedBy`,
// `missileTargetPool`, on hand-made rows and units): Woodland Skirmish ×1.15 in forest and jungle; Volley at the
// Charge ×1.25 shooting cavalry from the second line; Marksmen ×1.25 shooting archers, and the best target along the
// enemy front; Through the Trees (Stag Riders take the one flank in forest and jungle); Stoop on the Horses (an Eagle
// unit holds an open flank no rider fills, ×1.25 v cavalry); Thorn Hedge ×0.85 for cavalry in the woods; Tree Watch
// (the Elven Garrison shoots in forest and jungle); Eyes of the Forest spoils an Ambush and shows Shadow Archers
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { abilityMissileUnits, archeryBlockedBy, missileTargetPool } from '../../src/engine/battle/strength.ts';
import type { ArmyInABattle } from '../../src/engine/army-tables.ts';
import { theWordsOfWhyAUnitFacesAsItDoes } from '../../src/views/prose/the-words-of-a-battles-lines.ts';
import { fight as fightOnTheHandMadeTable, type AFacedGrid, type ASidesUnits } from '../lib/hand-made-battle-lines.ts';

/** The units' final strengths in these scenes (the old script's table; a type it doesn't name is 8). */
const BASE: Readonly<Record<string, number | undefined>> = {
  'Forest Wardens': 8,
  'Elven Bowmen': 10,
  'Shadow Archers': 14,
  'Stag Riders': 12,
  'Eagle Riders': 12,
  'Elven Garrison': 4,
  'Shieldwall Levies': 8,
  'Yeoman Longbows': 8,
  'Free Lances': 10,
  'Warg Riders': 10,
  'Orc Berserkers': 12,
  'Goblin Horde': 6,
};
/** So many units of each type, at their strengths in BASE. */
type ASpec = readonly (readonly [type: string, count: number])[];
const withTheirStrengths = (spec: ASpec): ASidesUnits => spec.map(([t, n]) => [t, n, BASE[t] ?? 8] as const);

/** Both sides placed and faced: `me` attacks, `them` defends (Tactical as given, else 0). */
const fight = (mine: ASpec, theirs: ASpec, W: number, terrain: string, tacMe = 0) =>
  fightOnTheHandMadeTable(withTheirStrengths(mine), withTheirStrengths(theirs), W, terrain, tacMe);

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

describe('Woodland Skirmish: Wardens ×1.15 in forest and jungle, facing anyone', () => {
  test('in forest, facing Berserkers', () => {
    const r = fight([['Forest Wardens', 2]], [['Orc Berserkers', 2]], 2, 'forest');
    expect(faced(r.me, 'Forest Wardens')).toHaveLength(2);
    for (const u of faced(r.me, 'Forest Wardens')) expect(near(u.m, 1.15)).toBe(true);
    expect(whyOf(r.me, 'Forest Wardens')).toMatch(/Woodland Skirmish/);
  });

  test('…in jungle it stacks with infantry v cavalry: ×1.3225', () => {
    const r = fight([['Forest Wardens', 2]], [['Free Lances', 2]], 2, 'jungle');
    expect(faced(r.me, 'Forest Wardens')).toHaveLength(2);
    for (const u of faced(r.me, 'Forest Wardens')) expect(near(u.m, 1.15 * 1.15)).toBe(true);
  });

  test('…and nothing on the plain', () => {
    const r = fight([['Forest Wardens', 2]], [['Orc Berserkers', 2]], 2, 'plain');
    expect(faced(r.me, 'Forest Wardens')).toHaveLength(2);
    for (const u of faced(r.me, 'Forest Wardens')) expect(near(u.m, 1)).toBe(true);
  });
});

describe('Volley at the Charge: Bowmen shooting cavalry from the second line ×1.25', () => {
  test('shooting Wargs from the second line', () => {
    const r = fight(
      [
        ['Forest Wardens', 2],
        ['Elven Bowmen', 2],
      ],
      [['Warg Riders', 2]],
      2,
      'forest',
    );
    expect(faced(r.me, 'Elven Bowmen')).toHaveLength(2);
    for (const u of faced(r.me, 'Elven Bowmen')) {
      expect(u.place).toBe('second');
      expect(near(u.m, 1.25)).toBe(true);
      expect(why(u)).toMatch(/Volley at the Charge/);
    }
  });

  test('shooting infantry they keep the ordinary ×1.25', () => {
    const r = fight(
      [
        ['Forest Wardens', 2],
        ['Elven Bowmen', 2],
      ],
      [['Orc Berserkers', 2]],
      2,
      'forest',
    );
    expect(faced(r.me, 'Elven Bowmen')).toHaveLength(2);
    for (const u of faced(r.me, 'Elven Bowmen')) {
      expect(near(u.m, 1.25)).toBe(true);
      expect(why(u)).not.toMatch(/Volley at the Charge/);
    }
  });
});

describe('Marksmen: Shadow Archers shooting archers ×1.25, and the best target along the enemy front', () => {
  test('against Longbows caught in the front', () => {
    const r = fight(
      [
        ['Forest Wardens', 2],
        ['Shadow Archers', 2],
      ],
      [['Yeoman Longbows', 2]],
      2,
      'plain',
    );
    expect(faced(r.me, 'Shadow Archers')).toHaveLength(2);
    for (const u of faced(r.me, 'Shadow Archers')) {
      expect(near(u.m, 1.25)).toBe(true);
      expect(why(u)).toMatch(/Marksmen/);
    }
  });

  // The three enemy front units: Berserkers 12 (foot ×1.25 = 15), Free Lances 10 (cav ×0.75 = 7.5), Goblins 6 (foot
  // ×1.25 × Arrow Fodder ×0.75 = 5.6): the Berserkers are the best shot.
  const theEnemysFront: ASpec = [
    ['Goblin Horde', 1],
    ['Orc Berserkers', 1],
    ['Free Lances', 1],
  ];

  test('the Shadow Archers pick the Berserkers (the best target along the line), not whoever stands opposite', () => {
    const r = fight(
      [
        ['Forest Wardens', 3],
        ['Shadow Archers', 1],
      ],
      theEnemysFront,
      3,
      'forest',
    );
    const [sa] = faced(r.me, 'Shadow Archers');
    expect(sa?.vs?.a?.type).toBe('Orc Berserkers');
    expect(near(sa?.m ?? Number.NaN, 1.25)).toBe(true);
  });

  test('…while Bowmen still shoot whoever stands opposite', () => {
    const r = fight(
      [
        ['Forest Wardens', 3],
        ['Elven Bowmen', 1],
      ],
      theEnemysFront,
      3,
      'forest',
    );
    const [eb] = faced(r.me, 'Elven Bowmen');
    const c = r.me.second.findIndex((x) => x?.r.a?.type === 'Elven Bowmen');
    const opposite = r.them.front[c]?.r;
    expect(eb).toBeDefined();
    expect(opposite).toBeDefined();
    expect(eb?.vs).toBe(opposite);
  });
});

describe("Through the Trees: Stag Riders take the one flank slot rough ground allows; Wargs can't", () => {
  const r = fight(
    [
      ['Forest Wardens', 3],
      ['Stag Riders', 2],
    ],
    [
      ['Orc Berserkers', 3],
      ['Warg Riders', 2],
    ],
    3,
    'forest',
  );

  test('in forest one Stag unit takes the flank and the Wargs stand in the line', () => {
    expect(r.me.flanks).toHaveLength(1);
    expect(r.me.flanks[0]?.r.a?.type).toBe('Stag Riders');
    expect(r.them.flanks).toHaveLength(0);
  });

  test('the Stag rider rides free at ×1.3 (no enemy rider to duel)', () => {
    expect(r.me.face.free).toBe(1);
    expect(faced(r.me, 'Stag Riders').some((u) => u.kind === 'free' && near(u.m, 1.3))).toBe(true);
  });

  test('…but on rough ground it turns no line', () => {
    expect(r.them.face.turned).toBe(false);
  });

  test("in the mountains the Stag Riders stand in the line (that ground is the Rams')", () => {
    const s = fight(
      [
        ['Forest Wardens', 3],
        ['Stag Riders', 2],
      ],
      [['Orc Berserkers', 3]],
      3,
      'mountain',
    );
    expect(s.me.flanks).toHaveLength(0);
  });

  test('on the plain they flank like any cavalry (Tactical 1: two slots)', () => {
    const s = fight(
      [
        ['Forest Wardens', 3],
        ['Stag Riders', 2],
      ],
      [['Orc Berserkers', 3]],
      3,
      'plain',
      1,
    );
    expect(s.me.flanks).toHaveLength(2);
  });
});

describe('Stoop on the Horses: on open ground Eagle Riders hold a flank slot no rider fills, and fight cavalry ×1.25', () => {
  test('with no rider of its own, the Eagle unit leaves the air for the flank', () => {
    const r = fight(
      [
        ['Forest Wardens', 3],
        ['Eagle Riders', 1],
      ],
      [
        ['Orc Berserkers', 3],
        ['Warg Riders', 1],
      ],
      3,
      'plain',
    );
    expect(r.me.flanks).toHaveLength(1);
    expect(r.me.flanks[0]?.r.a?.type).toBe('Eagle Riders');
    expect(r.me.fly).toHaveLength(0);
  });

  test('it duels the Warg at ×1.25', () => {
    const r = fight(
      [
        ['Forest Wardens', 3],
        ['Eagle Riders', 1],
      ],
      [
        ['Orc Berserkers', 3],
        ['Warg Riders', 1],
      ],
      3,
      'plain',
    );
    expect(r.me.face.duels).toBe(1);
    expect(faced(r.me, 'Eagle Riders')).toHaveLength(1);
    for (const u of faced(r.me, 'Eagle Riders')) {
      expect(u.kind).toBe('duel');
      expect(near(u.m, 1.25)).toBe(true);
      expect(why(u)).toMatch(/Stoop on the Horses/);
    }
  });

  test('a rider fills the slot first; the Eagles stay in the air', () => {
    const r = fight(
      [
        ['Forest Wardens', 3],
        ['Stag Riders', 1],
        ['Eagle Riders', 1],
      ],
      [['Orc Berserkers', 3]],
      3,
      'plain',
    );
    expect(r.me.flanks).toHaveLength(1);
    expect(r.me.flanks[0]?.r.a?.type).toBe('Stag Riders');
    expect(r.me.fly).toHaveLength(1);
  });

  test('in forest the Eagles stay in the air (no open flank to hold)', () => {
    const r = fight(
      [
        ['Forest Wardens', 3],
        ['Eagle Riders', 1],
      ],
      [['Orc Berserkers', 3]],
      3,
      'forest',
    );
    expect(r.me.flanks).toHaveLength(0);
    expect(r.me.fly).toHaveLength(1);
  });
});

describe('Thorn Hedge: cavalry facing an Elven Garrison in the woods ×0.85', () => {
  test('on top of cavalry v infantry: ×0.7225', () => {
    const r = fight([['Free Lances', 2]], [['Elven Garrison', 2]], 2, 'forest');
    expect(faced(r.me, 'Free Lances')).toHaveLength(2);
    for (const u of faced(r.me, 'Free Lances')) expect(near(u.m, 0.85 * 0.85)).toBe(true);
    expect(whyOf(r.me, 'Free Lances')).toMatch(/Thorn Hedge/);
  });

  test('…and nothing on the plain', () => {
    const r = fight([['Free Lances', 2]], [['Elven Garrison', 2]], 2, 'plain');
    expect(faced(r.me, 'Free Lances')).toHaveLength(2);
    for (const u of faced(r.me, 'Free Lances')) expect(near(u.m, 0.85)).toBe(true);
  });
});

describe('Tree Watch: in forest or jungle the Elven Garrison shoots in the archery step', () => {
  const eg = aUnit('Elven Garrison'),
    ward = aUnit('Forest Wardens');

  test('the Elven Garrison looses in forest and jungle', () => {
    expect(abilityMissileUnits([eg, ward], 'forest')).toContain(eg);
    expect(abilityMissileUnits([eg, ward], 'jungle')).toContain(eg);
  });

  test('…and not elsewhere', () => {
    expect(abilityMissileUnits([eg, ward], 'plain')).not.toContain(eg);
    expect(abilityMissileUnits([eg, ward], 'mountain')).not.toContain(eg);
  });
});

describe('Eyes of the Forest: Eagle Riders with the shooters spoil an Ambush and reveal Shadow Archers', () => {
  const wardens = [aUnit('Forest Wardens')],
    eagles = [aUnit('Eagle Riders'), aUnit('Yeoman Longbows')],
    bows = [aUnit('Yeoman Longbows')];

  test('Wardens in forest still ambush archers who fly no Eagles', () => {
    expect(archeryBlockedBy(wardens, 'forest', bows)).toBe(true);
  });

  test('…but not archers whose force has Eagle Riders', () => {
    expect(archeryBlockedBy(wardens, 'forest', eagles)).toBe(false);
  });

  test('(the call without the shooters still reads as before)', () => {
    expect(archeryBlockedBy(wardens, 'forest', undefined)).toBe(true);
  });

  const enemy = [aUnit('Shadow Archers'), aUnit('Forest Wardens')];

  test('Shadow Archers are not in the target pool while something else is visible (the Wardens are)', () => {
    expect(missileTargetPool(enemy, 0, bows[0], bows).map((a) => a.type)).toEqual(['Forest Wardens']);
  });

  test('…unless Eagle Riders fly with the shooters', () => {
    expect(missileTargetPool(enemy, 0, eagles[1], eagles).some((a) => a.type === 'Shadow Archers')).toBe(true);
  });
});
