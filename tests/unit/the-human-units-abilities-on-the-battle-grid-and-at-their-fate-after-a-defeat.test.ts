// The Human units' abilities on the battle grid, and at their fate after a defeat (2026-10-11, Toby, the unit
// abilities, R-095; plan P1-14k, the old `abilities-human` script): each a matchup and one more.
//   Shieldwall Levies   Spear Hedge (cavalry facing them fights at most ×0.75) · Shieldwall (×1.25 with an archer in
//                       the second line behind them; the old "two Levies in the force" is gone)
//   Men-at-Arms         Halberds (×1.25 facing cavalry) · Sergeants (Levies beside them in the front ×1.1)
//   Yeoman Longbows     Bodkin Points (no ×0.75 shooting cavalry from the second line) · Prepared Ground (defending,
//                       two pre-battle volleys: not here, tests/unit/prepared-ground-and-eyes-of-the-forest-…) —
//                       Massed Volley is gone
//   Free Lances         Harriers (×1.15 in a flank duel) · Ride Them Down (unchanged)
//   Gilded Lances       Lance Charge (×1.15 facing foot, where cavalry was ×0.85) · Knightly Example (Levies and
//                       Men-at-Arms never lose a tier in defeat while a Gilded unit is in the army) — Shock of the
//                       Charge (+40% attacking) is gone
//   Noble Griffons      Dive on the Bowmen (one enemy second-line archer, the strongest, ×0.75) · Screech Dive (unchanged)
//   Human Garrison      Hold the Gate (defending, never hit from the side) · Town Watch (counts as Levies for
//                       Shieldwall and anchoring)
// Grids placed and faced from rows made by the test (tests/lib/hand-made-battle-lines.ts), each side's strengths the
// old script's table; each unit's facing in words through the prose (theWordsOfWhyAUnitFacesAsItDoes, since P1-12d4),
// and the fate lines through theWordsOf (facts since P1-12c6). The old script booted the GM portal to call these as
// its globals; "the GM portal boots" is the imports now, and any page error is this file throwing (an unexpected
// console.error fails it: tests/setup/each.ts). Each scene also asks how many of a type it faced, where the old
// asked only that every one it found was so (a scene that faced none passed).
// Level 1 (unit): the grid, the facing, the force's strength and the fate rolls are pure functions, called on the
// engine's modules. Not static: they compute the figures. Not a scenario: nothing here needs a battle's dice.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The seven human units' abilities (R-095; `battleGrid`, `battleFacing`, `unitAbilityMult`, `missileDamageMult`,
// `rollUnitFates`, on hand-made rows): Spear Hedge caps cavalry facing Levies at ×0.75 (a Lance Charge too);
// Shieldwall ×1.25 only with an archer behind in the column; Town Watch counts a Human Garrison as Levies; Halberds
// ×1.25 v cavalry; Sergeants ×1.1 for Levies beside Men-at-Arms; Bodkin Points shoot cavalry at ×1; Harriers ×1.15 in a
// flank duel; Lance Charge ×1.15 v foot; Dive on the Bowmen ×0.75 on the strongest second-line archer; Hold the Gate
// spares a defending garrison the side hit; Knightly Example keeps Levies and Men-at-Arms from losing a tier; Massed
// Volley and Shock of the Charge gone. Level 1: pure functions; nothing needs a battle's dice
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { missileDamageMult, unitAbilityMult } from '../../src/engine/battle/strength.ts';
import { rollUnitFates } from '../../src/engine/battle/fates.ts';
import type { ArmyInABattle } from '../../src/engine/army-tables.ts';
import { theWordsOfWhyAUnitFacesAsItDoes } from '../../src/views/prose/the-words-of-a-battles-lines.ts';
import { theWordsOf } from '../../src/views/prose/the-words-of-each-line.ts';
import { fight as fightOnTheHandMadeTable, type AFacedGrid, type ASidesUnits } from '../lib/hand-made-battle-lines.ts';

/** The units' final strengths in these scenes (the old script's table; a type it doesn't name is 8). */
const BASE: Readonly<Record<string, number | undefined>> = {
  'Shieldwall Levies': 8,
  'Yeoman Longbows': 8,
  'Free Lances': 10,
  'Gilded Lances': 12,
  'Men-at-Arms': 12,
  'Human Garrison': 4,
  'Noble Griffons': 12,
  'Warg Riders': 10,
  'Orc Berserkers': 12,
  'Elven Bowmen': 10,
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
/** A unit of a type as a force lists it (the old script gave its type alone; nothing here reads the rest). */
const aUnit = (type: string): ArmyInABattle => ({ type, quality: 'Average', race: '', unitName: type });
/** Within the old script's 1e-6. */
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

describe('Spear Hedge and Lance Charge', () => {
  test('Spear Hedge: Free Lances facing Levies ×0.75 (it was ×0.85 as cavalry v infantry)', () => {
    const r = fight([['Free Lances', 2]], [['Shieldwall Levies', 2]], 2, 'forest');
    expect(faced(r.me, 'Free Lances')).toHaveLength(2);
    for (const u of faced(r.me, 'Free Lances')) expect(near(u.m, 0.75)).toBe(true);
    expect(whyOf(r.me, 'Free Lances')).toMatch(/Spear Hedge/);
  });

  test('the Levies still fight cavalry at ×1.15', () => {
    const r = fight([['Free Lances', 2]], [['Shieldwall Levies', 2]], 2, 'forest');
    expect(faced(r.them, 'Shieldwall Levies')).toHaveLength(2);
    for (const u of faced(r.them, 'Shieldwall Levies')) expect(near(u.m, 1.15)).toBe(true);
  });

  test("Spear Hedge caps the Gilded Lances' charge at ×0.75", () => {
    const r = fight([['Gilded Lances', 2]], [['Shieldwall Levies', 2]], 2, 'forest');
    expect(faced(r.me, 'Gilded Lances')).toHaveLength(2);
    for (const u of faced(r.me, 'Gilded Lances')) expect(near(u.m, 0.75)).toBe(true);
    expect(whyOf(r.me, 'Gilded Lances')).toMatch(/Spear Hedge/);
  });

  test('Lance Charge: Gilded Lances facing Berserkers ×1.15', () => {
    const r = fight([['Gilded Lances', 2]], [['Orc Berserkers', 2]], 2, 'forest');
    expect(faced(r.me, 'Gilded Lances')).toHaveLength(2);
    for (const u of faced(r.me, 'Gilded Lances')) expect(near(u.m, 1.15)).toBe(true);
    expect(whyOf(r.me, 'Gilded Lances')).toMatch(/Lance Charge/);
  });

  test("Free Lances facing Berserkers keep cavalry's ×0.85 (no charge of their own)", () => {
    const r = fight([['Free Lances', 2]], [['Orc Berserkers', 2]], 2, 'forest');
    expect(faced(r.me, 'Free Lances')).toHaveLength(2);
    for (const u of faced(r.me, 'Free Lances')) expect(near(u.m, 0.85)).toBe(true);
  });
});

describe('Shieldwall and Town Watch', () => {
  test('Shieldwall: Levies with Longbows behind them ×1.25', () => {
    const r = fight(
      [
        ['Shieldwall Levies', 2],
        ['Yeoman Longbows', 2],
      ],
      [['Orc Berserkers', 2]],
      2,
      'plain',
    );
    expect(faced(r.me, 'Shieldwall Levies')).toHaveLength(2);
    for (const u of faced(r.me, 'Shieldwall Levies')) expect(near(u.m, 1.25)).toBe(true);
    expect(whyOf(r.me, 'Shieldwall Levies')).toMatch(/Shieldwall/);
  });

  test('four Levies with nobody behind them get no Shieldwall', () => {
    const r = fight([['Shieldwall Levies', 4]], [['Orc Berserkers', 2]], 4, 'plain');
    expect(faced(r.me, 'Shieldwall Levies')).toHaveLength(4);
    for (const u of faced(r.me, 'Shieldwall Levies')) expect(why(u)).not.toMatch(/Shieldwall/);
  });

  test('one Longbow company behind two Levies shields the one it stands behind', () => {
    const r = fight(
      [
        ['Shieldwall Levies', 2],
        ['Yeoman Longbows', 1],
      ],
      [['Orc Berserkers', 2]],
      2,
      'plain',
    );
    expect(faced(r.me, 'Shieldwall Levies').filter((u) => why(u).includes('Shieldwall'))).toHaveLength(1);
  });

  test('unitAbilityMult no longer lifts Levies for standing together (Shieldwall moved to the grid)', () => {
    const levies = aUnit('Shieldwall Levies');
    expect(near(unitAbilityMult(levies, { force: [levies, levies, levies], enemyForce: [] }, 'plain'), 1)).toBe(true);
  });

  test('Town Watch: a garrison with Longbows behind it locks shields ×1.25', () => {
    const r = fight(
      [
        ['Human Garrison', 2],
        ['Yeoman Longbows', 2],
      ],
      [['Orc Berserkers', 2]],
      2,
      'plain',
    );
    expect(faced(r.me, 'Human Garrison')).toHaveLength(2);
    for (const u of faced(r.me, 'Human Garrison')) {
      expect(near(u.m, 1.25)).toBe(true);
      expect(why(u)).toMatch(/Shieldwall/);
    }
  });
});

describe('Halberds and Sergeants', () => {
  test('Halberds: Men-at-Arms facing Wargs ×1.25', () => {
    const r = fight([['Men-at-Arms', 2]], [['Warg Riders', 2]], 2, 'forest');
    expect(faced(r.me, 'Men-at-Arms')).toHaveLength(2);
    for (const u of faced(r.me, 'Men-at-Arms')) expect(near(u.m, 1.25)).toBe(true);
    expect(whyOf(r.me, 'Men-at-Arms')).toMatch(/Halberds/);
  });

  test('Men-at-Arms facing foot fight even', () => {
    const r = fight([['Men-at-Arms', 2]], [['Orc Berserkers', 2]], 2, 'forest');
    expect(faced(r.me, 'Men-at-Arms')).toHaveLength(2);
    for (const u of faced(r.me, 'Men-at-Arms')) expect(near(u.m, 1)).toBe(true);
  });

  test('Sergeants: the Men-at-Arms hold the centre, and both Levies beside them fight ×1.1', () => {
    const r = fight(
      [
        ['Men-at-Arms', 1],
        ['Shieldwall Levies', 2],
      ],
      [['Orc Berserkers', 3]],
      3,
      'plain',
    );
    expect(r.me.front.findIndex((x) => x?.r.a?.type === 'Men-at-Arms')).toBe(1);
    const lev = faced(r.me, 'Shieldwall Levies');
    expect(lev).toHaveLength(2);
    for (const u of lev) {
      expect(near(u.m, 1.1)).toBe(true);
      expect(why(u)).toMatch(/Sergeants/);
    }
  });

  test('Shieldwall and Sergeants stack (an archer behind every column): ×1.25 × ×1.1 = ×1.375', () => {
    const r = fight(
      [
        ['Men-at-Arms', 1],
        ['Shieldwall Levies', 2],
        ['Yeoman Longbows', 3],
      ],
      [['Orc Berserkers', 3]],
      3,
      'plain',
    );
    expect(faced(r.me, 'Shieldwall Levies')).toHaveLength(2);
    for (const u of faced(r.me, 'Shieldwall Levies')) expect(near(u.m, 1.375)).toBe(true);
  });
});

describe('Bodkin Points, and Massed Volley gone', () => {
  test('Bodkin Points: Longbows shoot the Wargs opposite at ×1', () => {
    const r = fight(
      [
        ['Shieldwall Levies', 2],
        ['Yeoman Longbows', 2],
      ],
      [['Warg Riders', 2]],
      2,
      'forest',
    );
    expect(faced(r.me, 'Yeoman Longbows')).toHaveLength(2);
    for (const u of faced(r.me, 'Yeoman Longbows')) {
      expect(u.place).toBe('second');
      expect(near(u.m, 1)).toBe(true);
      expect(why(u)).toMatch(/Bodkin/);
    }
  });

  test('…Bowmen have no Bodkin Points (their own ability is Volley at the Charge)', () => {
    const r = fight(
      [
        ['Shieldwall Levies', 2],
        ['Elven Bowmen', 2],
      ],
      [['Warg Riders', 2]],
      2,
      'forest',
    );
    expect(faced(r.me, 'Elven Bowmen')).toHaveLength(2);
    for (const u of faced(r.me, 'Elven Bowmen')) {
      expect(u.place).toBe('second');
      expect(why(u)).not.toMatch(/Bodkin/);
    }
  });

  test('Massed Volley is gone: three Longbow companies together volley at ×1', () => {
    const bows = aUnit('Yeoman Longbows');
    expect(near(missileDamageMult(bows, [bows, bows, bows], 'plain', aUnit('Orc Berserkers'), true), 1)).toBe(true);
  });
});

describe('Harriers', () => {
  const r = fight(
    [
      ['Shieldwall Levies', 2],
      ['Free Lances', 1],
    ],
    [
      ['Shieldwall Levies', 2],
      ['Warg Riders', 1],
    ],
    2,
    'plain',
  );

  test('one flank duel', () => {
    expect(r.me.face.duels).toBe(1);
  });

  test('Harriers: the Free Lance duels at ×1.15', () => {
    expect(faced(r.me, 'Free Lances')).toHaveLength(1);
    for (const u of faced(r.me, 'Free Lances')) {
      expect(u.kind).toBe('duel');
      expect(why(u)).toMatch(/Harriers/);
    }
  });

  test('…the Warg answers with Wolves Panic Horses ×1.25', () => {
    const [fl] = faced(r.me, 'Free Lances'),
      [wg] = faced(r.them, 'Warg Riders');
    expect(fl && near(fl.m, 1.15)).toBe(true);
    expect(wg && near(wg.m, 1.25)).toBe(true);
  });

  test('a Free Lance with no duel (it guards an end or rides free) gets no Harriers', () => {
    const s = fight(
      [
        ['Shieldwall Levies', 2],
        ['Free Lances', 1],
      ],
      [['Shieldwall Levies', 3]],
      3,
      'plain',
    );
    expect(faced(s.me, 'Free Lances')).toHaveLength(1);
    for (const u of faced(s.me, 'Free Lances')) {
      expect(u.kind).not.toBe('duel');
      expect(why(u)).not.toMatch(/Harriers/);
    }
  });
});

test('Shock of the Charge is gone: unitAbilityMult no longer gives Gilded Lances +40% attacking', () => {
  const ctx = { force: [aUnit('Gilded Lances')], enemyForce: [aUnit('Orc Berserkers')], isAttacker: true };
  expect(near(unitAbilityMult(aUnit('Gilded Lances'), ctx, 'plain'), 1)).toBe(true);
});

describe('Dive on the Bowmen', () => {
  test("with Noble Griffons overhead, the enemy's strongest second-line archer (Bowmen 10 over Longbows 8) fights ×0.75 on top of its matchup", () => {
    const r = fight(
      [
        ['Shieldwall Levies', 2],
        ['Noble Griffons', 1],
      ],
      [
        ['Orc Berserkers', 2],
        ['Yeoman Longbows', 1],
        ['Elven Bowmen', 1],
      ],
      2,
      'plain',
    );
    const dived = r.them.face.units.filter((u) => why(u).includes('Griffon'));
    expect(dived).toHaveLength(1);
    expect(dived[0]?.row.a?.type).toBe('Elven Bowmen');
    expect(near(dived[0]?.m ?? Number.NaN, 0.75 * 1.25)).toBe(true);
  });

  test('no Griffons, no dive', () => {
    const r = fight(
      [['Shieldwall Levies', 2]],
      [
        ['Orc Berserkers', 2],
        ['Yeoman Longbows', 2],
      ],
      2,
      'plain',
    );
    expect(r.them.face.units.length).toBeGreaterThan(0);
    for (const u of r.them.face.units) expect(why(u)).not.toMatch(/Griffon/);
  });
});

describe('Hold the Gate', () => {
  test("a defending Human Garrison's end units are not hit from the side", () => {
    const r = fight([['Orc Berserkers', 5]], [['Human Garrison', 3]], 5, 'plain');
    expect(faced(r.them, 'Human Garrison')).toHaveLength(3);
    for (const u of faced(r.them, 'Human Garrison')) expect(why(u)).not.toMatch(/hit from the side/);
    expect(whyOf(r.them, 'Human Garrison')).toMatch(/Hold the Gate/);
  });

  test('…but a garrison that attacks is hit from the side like anyone', () => {
    const r = fight([['Human Garrison', 3]], [['Orc Berserkers', 5]], 5, 'plain');
    expect(faced(r.me, 'Human Garrison').filter((u) => why(u).includes('hit from the side'))).toHaveLength(2);
  });

  test('defending Levies are still hit from the side', () => {
    const r = fight([['Orc Berserkers', 5]], [['Shieldwall Levies', 3]], 5, 'plain');
    expect(faced(r.them, 'Shieldwall Levies').filter((u) => why(u).includes('hit from the side'))).toHaveLength(2);
  });
});

describe('the Knightly Example: Levies and Men-at-Arms never lose a tier in defeat while a Gilded Lances unit is in the army', () => {
  const mk = (type: string): ArmyInABattle => ({ type, quality: 'Veteran', race: '', unitName: type });
  const said: string[] = [];
  const force = [mk('Shieldwall Levies'), mk('Men-at-Arms'), mk('Yeoman Longbows'), mk('Gilded Lances')];
  const res = rollUnitFates(force, {
    owner: { heroName: 'Test', leaderless: false },
    won: false,
    dieAt: () => 0,
    demoteAt: () => 1,
    promoteTo: () => 0,
    rng: () => 0.5,
    say: (s) => said.push(theWordsOf(s)),
  });

  test('the Levies and the Men-at-Arms keep Veteran though the roll said demote', () => {
    expect(force[0]?.quality).toBe('Veteran');
    expect(force[1]?.quality).toBe('Veteran');
  });

  test('the Longbows and the Gilded Lances themselves still lose a tier', () => {
    expect(force[2]?.quality).toBe('Average');
    expect(force[3]?.quality).toBe('Average');
  });

  test('two held, two demoted', () => {
    expect(res.held).toBe(2);
    expect(res.demoted).toBe(2);
  });

  test('two lines name the Knightly Example', () => {
    expect(said.filter((s) => s.includes('Knightly Example'))).toHaveLength(2);
  });

  test('without a Gilded unit they lose a tier as before', () => {
    const force2 = [mk('Shieldwall Levies'), mk('Men-at-Arms')];
    rollUnitFates(force2, {
      owner: { heroName: 'Test', leaderless: false },
      won: false,
      dieAt: () => 0,
      demoteAt: () => 1,
      promoteTo: () => 0,
      rng: () => 0.5,
    });
    for (const a of force2) expect(a.quality).toBe('Average');
  });
});
