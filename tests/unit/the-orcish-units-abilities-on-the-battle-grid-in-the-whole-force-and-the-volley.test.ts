// The Orcish units' abilities on the battle grid, in the whole force's strength and in the volley (2026-10-11, Toby,
// the unit abilities, R-095; plan P1-14l, the old `abilities-orcish` script): each a matchup and one more.
//   Goblin Horde     Arrow Fodder (second-line archers shooting them ×0.75) · Sheer Numbers (+10% per other orc foot
//                    unit in the force — Goblin Hordes, Berserkers, the Orc Garrison — to +30%; it counted Goblins
//                    only)
//   Orc Berserkers   Frenzy (×1.15 facing foot) · Driven Before Them (+10% per Goblin Horde beside them in the front)
//   Black Arrows     Brawling Archers (full strength in the front line, where other archers fight ×0.75) · Raiders'
//                    Volley (their pre-battle volley ×1.5 when attacking)
//   Warg Riders      Wolves Panic Horses (×1.25 facing cavalry) · Run Them Down (unchanged)
//   Wyvern Riders    Terror From Above (the enemy's strongest front-line unit fights ×0.85) · Acid Spit (unchanged) —
//                    Dread, the −15% to enemy fanaticism, is gone (tests/static/skyward-retreat-and-dread-are-gone-…)
//   Orc Garrison     Bloodthirsty (×1.15 facing foot when defending) · Raiders' Muster (tests/scenario/raiders-muster-…)
// Grids placed and faced from rows made by the test (tests/lib/hand-made-battle-lines.ts), each side's strengths the
// old script's table; each unit's facing and place in words through the prose (theWordsOfWhyAUnitFacesAsItDoes and
// theWordsOfWhyAUnitStandsWhereItDoes, since P1-12d4). unitAbilityMult and missileDamageMult are called on units made
// by the test, each with a quality, a race and a name where the old gave its type alone (the types ask; neither reads
// them). The old script booted the GM portal to call these as its globals; "the GM portal boots" is the imports now,
// and any page error is this file throwing (an unexpected console.error fails it: tests/setup/each.ts). Each scene
// also asks how many of a type it faced or placed, where the old asked only that every one it found was so (a scene
// that faced none passed).
// Level 1 (unit): the grid, the facing and the force's strength are pure functions, called on the engine's modules.
// Not static: they compute the figures. Not a scenario: nothing here needs a battle's dice.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The six orcish units' (R-095; `battleGrid`, `battleFacing`, `unitAbilityMult`, `missileDamageMult`, on hand-made
// rows and units): Arrow Fodder (archers shoot Goblins at ×0.75); Sheer Numbers counts every other orc foot unit, to
// +30%; Frenzy ×1.15 v foot; Driven Before Them +10% per adjacent Goblin Horde; Brawling Archers (Black Arrows fight
// the front at ×1); Raiders' Volley ×1.5 attacking; Wolves Panic Horses ×1.25 v cavalry; Terror From Above (the
// strongest enemy front unit ×0.85); Bloodthirsty ×1.15 v foot in defence
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { missileDamageMult, unitAbilityMult } from '../../src/engine/battle/strength.ts';
import type { ArmyInABattle } from '../../src/engine/army-tables.ts';
import {
  theWordsOfWhyAUnitFacesAsItDoes,
  theWordsOfWhyAUnitStandsWhereItDoes,
} from '../../src/views/prose/the-words-of-a-battles-lines.ts';
import { fight as fightOnTheHandMadeTable, type AFacedGrid, type ASidesUnits } from '../lib/hand-made-battle-lines.ts';

/** The units' final strengths in these scenes (the old script's table; a type it doesn't name is 8). */
const BASE: Readonly<Record<string, number | undefined>> = {
  'Goblin Horde': 6,
  'Orc Berserkers': 12,
  'Black Arrows': 8,
  'Warg Riders': 10,
  'Wyvern Riders': 12,
  'Orc Garrison': 4,
  'Shieldwall Levies': 8,
  'Yeoman Longbows': 8,
  'Free Lances': 10,
  'Men-at-Arms': 12,
  'Dwarven Guard': 12,
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
/** Why a placed unit stands where it does, in words. */
const whereWhy = (u: AFacedGrid['units'][number]) => theWordsOfWhyAUnitStandsWhereItDoes(u.why);
/** A unit of a type as a force lists it. */
const aUnit = (type: string): ArmyInABattle => ({ type, quality: 'Average', race: '', unitName: type });
/** Within the old script's 1e-6. */
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

test('Arrow Fodder: Longbows shooting Goblins from the second line ×0.9375', () => {
  const r = fight(
    [
      ['Shieldwall Levies', 2],
      ['Yeoman Longbows', 2],
    ],
    [['Goblin Horde', 2]],
    2,
    'plain',
  );
  expect(faced(r.me, 'Yeoman Longbows')).toHaveLength(2);
  for (const u of faced(r.me, 'Yeoman Longbows')) {
    expect(near(u.m, 1.25 * 0.75)).toBe(true);
    expect(why(u)).toMatch(/Arrow Fodder/);
  }
});

describe('Sheer Numbers counts every other orc foot unit', () => {
  const gob = aUnit('Goblin Horde'),
    bers = aUnit('Orc Berserkers'),
    garr = aUnit('Orc Garrison'),
    warg = aUnit('Warg Riders'),
    arrows = aUnit('Black Arrows');
  const sheerNumbers = (force: readonly ArmyInABattle[]) => unitAbilityMult(gob, { force, enemyForce: [] }, 'plain');

  test('a lone Goblin Horde fights at ×1', () => {
    expect(near(sheerNumbers([gob]), 1)).toBe(true);
  });

  test('two Hordes: ×1.1', () => {
    expect(near(sheerNumbers([gob, gob]), 1.1)).toBe(true);
  });

  test('a Horde with Berserkers and the Orc Garrison: ×1.2 (other orc foot count)', () => {
    expect(near(sheerNumbers([gob, bers, garr]), 1.2)).toBe(true);
  });

  test('…riders and archers do not count', () => {
    expect(near(sheerNumbers([gob, warg, arrows]), 1)).toBe(true);
  });

  test('…and it stops at +30%', () => {
    expect(near(sheerNumbers([gob, gob, gob, bers, bers]), 1.3)).toBe(true);
  });
});

describe('Frenzy: Berserkers facing foot ×1.15; Driven Before Them: +10% per Goblin Horde beside them in the front', () => {
  test('Frenzy against Levies', () => {
    const r = fight([['Orc Berserkers', 2]], [['Shieldwall Levies', 2]], 2, 'plain');
    expect(faced(r.me, 'Orc Berserkers')).toHaveLength(2);
    for (const u of faced(r.me, 'Orc Berserkers')) {
      expect(near(u.m, 1.15)).toBe(true);
      expect(why(u)).toMatch(/Frenzy/);
    }
  });

  test("facing cavalry they have infantry's ×1.15 and no Frenzy", () => {
    const r = fight([['Orc Berserkers', 2]], [['Free Lances', 2]], 2, 'forest');
    expect(faced(r.me, 'Orc Berserkers')).toHaveLength(2);
    for (const u of faced(r.me, 'Orc Berserkers')) {
      expect(near(u.m, 1.15)).toBe(true);
      expect(why(u)).not.toMatch(/Frenzy/);
    }
  });

  describe('the Berserkers with two Hordes', () => {
    const r = fight(
      [
        ['Orc Berserkers', 1],
        ['Goblin Horde', 2],
      ],
      [['Shieldwall Levies', 3]],
      3,
      'plain',
    );

    test('the Berserkers, strongest, hold the centre with a Horde on each side', () => {
      expect(r.me.front[1]?.r.a?.type).toBe('Orc Berserkers');
    });

    test('Driven Before Them: two Hordes beside them, +20%, on top of Frenzy', () => {
      const [b] = faced(r.me, 'Orc Berserkers');
      expect(near(b?.m ?? Number.NaN, 1.15 * 1.2)).toBe(true);
      expect(b && why(b)).toMatch(/Driven Before Them ×1\.2/);
    });
  });

  test('one Horde beside them: +10%', () => {
    const r = fight(
      [
        ['Orc Berserkers', 1],
        ['Goblin Horde', 1],
        ['Black Arrows', 1],
      ],
      [['Shieldwall Levies', 3]],
      3,
      'plain',
    );
    const [b] = faced(r.me, 'Orc Berserkers');
    expect(b && why(b)).toMatch(/Driven Before Them ×1\.1/);
  });
});

describe('Brawling Archers: Black Arrows forced into the front fight at ×1, other archers ×0.75', () => {
  test('Black Arrows hold the front at ×1', () => {
    const r = fight([['Black Arrows', 2]], [['Shieldwall Levies', 2]], 2, 'plain');
    const front = r.me.units.filter((u) => u.place === 'front');
    expect(front).toHaveLength(2);
    for (const u of front) {
      expect(near(u.mult, 1)).toBe(true);
      expect(whereWhy(u)).toMatch(/Brawling Archers/);
    }
  });

  test('Longbows in the front still fight at ×0.75', () => {
    const r = fight([['Yeoman Longbows', 2]], [['Shieldwall Levies', 2]], 2, 'plain');
    const front = r.me.units.filter((u) => u.place === 'front');
    expect(front).toHaveLength(2);
    for (const u of front) expect(near(u.mult, 0.75)).toBe(true);
  });
});

describe("Raiders' Volley: the Black Arrows' pre-battle volley ×1.5 attacking, ×1 defending", () => {
  const arrows = aUnit('Black Arrows');

  test('×1.5 on the attack', () => {
    expect(near(missileDamageMult(arrows, [arrows], 'plain', aUnit('Shieldwall Levies'), true), 1.5)).toBe(true);
  });

  test('…and ×1 in defence', () => {
    expect(near(missileDamageMult(arrows, [arrows], 'plain', aUnit('Shieldwall Levies'), false), 1)).toBe(true);
  });
});

describe('Wolves Panic Horses: Wargs facing cavalry ×1.25', () => {
  const r = fight([['Warg Riders', 2]], [['Free Lances', 2]], 2, 'forest');

  test('the Wargs ×1.25', () => {
    expect(faced(r.me, 'Warg Riders')).toHaveLength(2);
    for (const u of faced(r.me, 'Warg Riders')) {
      expect(near(u.m, 1.25)).toBe(true);
      expect(why(u)).toMatch(/Wolves Panic Horses/);
    }
  });

  test('the Free Lances answer at ×1 (Harriers is for flank duels)', () => {
    expect(faced(r.them, 'Free Lances')).toHaveLength(2);
    for (const u of faced(r.them, 'Free Lances')) expect(near(u.m, 1)).toBe(true);
  });
});

describe("Terror From Above: with Wyverns on the other side, the enemy's strongest front unit fights ×0.85", () => {
  const theirs: ASpec = [
    ['Shieldwall Levies', 1],
    ['Men-at-Arms', 1],
  ];

  test('one unit, the strongest in the front (the Men-at-Arms), fights ×0.85', () => {
    const r = fight(
      [
        ['Goblin Horde', 2],
        ['Wyvern Riders', 1],
      ],
      theirs,
      2,
      'plain',
    );
    const t = r.them.face.units.filter((u) => why(u).includes('Terror From Above'));
    expect(t).toHaveLength(1);
    expect(t[0]?.row.a?.type).toBe('Men-at-Arms');
    expect(near(t[0]?.m ?? Number.NaN, 0.85)).toBe(true);
  });

  test('no Wyverns, no terror', () => {
    const r = fight([['Goblin Horde', 2]], theirs, 2, 'plain');
    expect(r.them.face.units).toHaveLength(2);
    for (const u of r.them.face.units) expect(why(u)).not.toMatch(/Terror/);
  });
});

describe('Bloodthirsty: a defending Orc Garrison facing foot ×1.15; attacking, nothing', () => {
  test('in defence', () => {
    const r = fight([['Shieldwall Levies', 2]], [['Orc Garrison', 2]], 2, 'plain');
    expect(faced(r.them, 'Orc Garrison')).toHaveLength(2);
    for (const u of faced(r.them, 'Orc Garrison')) {
      expect(near(u.m, 1.15)).toBe(true);
      expect(why(u)).toMatch(/Bloodthirsty/);
    }
  });

  test('…and ×1 on the attack', () => {
    const r = fight([['Orc Garrison', 2]], [['Shieldwall Levies', 2]], 2, 'plain');
    expect(faced(r.me, 'Orc Garrison')).toHaveLength(2);
    for (const u of faced(r.me, 'Orc Garrison')) expect(near(u.m, 1)).toBe(true);
  });

  test("facing cavalry it has infantry's ×1.15 only", () => {
    const r = fight([['Free Lances', 2]], [['Orc Garrison', 2]], 2, 'forest');
    expect(faced(r.them, 'Orc Garrison')).toHaveLength(2);
    for (const u of faced(r.them, 'Orc Garrison')) {
      expect(near(u.m, 1.15)).toBe(true);
      expect(why(u)).not.toMatch(/Bloodthirsty/);
    }
  });
});
