// The beasts' battle-line abilities (2026-10-13, Toby, Creatures and Monsters V, R-106; plan P1-14l, the old
// `abilities-beasts` script), as the decided table gave them (the humanoid units got theirs on 2026-10-11):
//   the flying beasts  (Thunderbirds, Manticore Pride, Crimson Rocs, Elder Dragons) fight from the air like the winged
//                      riders: no place in the line, full strength up to the enemy's line plus its flyers, half beyond
//   Thunderbirds       Storm Wings (every enemy unit in the air fights ×0.85) · Lightning Strike (unchanged)
//   Forest Ents        Rooted (never hit from the side when the enemy wraps their end) · Choking Spores (unchanged)
//   Great Bears        Maul (×1.15 facing foot) · Thick Hide (pre-battle volleys against them do half)
//   Stone Giants       Boulder Wall (cavalry facing them fights at no better than ×0.75) · Boulder Barrage (unchanged)
//   Unicorn Herd       Purity (×1.25 facing Monsters and skeletons; breaks a Spear Hedge or Boulder Wall, 2026-10-12)
//                      · Through the Glades (the one cavalry, with the Stag Riders, that takes the flank in forest and
//                      jungle)
//   Mammoth Host       Trample (×1.15 facing foot) · Stampede (unchanged)
//   Great Turtles      Shell Wall (immune to pre-battle volleys, as the Ironclads)
//   Cave Trolls        Regenerating Hide (a 30% chance to shrug off a death roll after a lost battle) · Hurled Rubble
//                      (its boundary: tests/unit/regenerating-hide-saves-a-beaten-troll-below-its-chance-and-not-at-it)
//   Titan Warbeasts    Colossal Bulk (fights from the second line at full strength) · World-Shaking Charge
//   Dread Hydras       Many Heads (×1.25 facing foot) · Venom Breath (unchanged)
//   Shark Shoals       Shoal Swarm (+10% per other Shark Shoals in the force, to +30%) · Feeding Frenzy
//                      (tests/unit/the-manticores-and-the-sharks-run-a-beaten-host-down-in-the-rout)
//   Manticore Pride    Relentless Hunt (unchanged) · the pursuit of a broken foe (the same)
// Grids placed and faced from rows made by the test (tests/lib/hand-made-battle-lines.ts), each side's strengths the
// old script's table; each unit's facing and place in words through the prose (theWordsOfWhyAUnitFacesAsItDoes and
// theWordsOfWhyAUnitStandsWhereItDoes, since P1-12d4), and the fate lines through theWordsOf (facts since P1-12c6).
// The old script ran these as the top-level functions of the engine's bundle in its bare vm (tests/lib/engine.ts);
// they are the modules' now. The volley's shot (applyMissileHit) and the fates (rollUnitFates) are called on units
// made by the test, each with a race where the old gave none (the types ask; neither reads it). Each scene also asks
// how many of a type it faced or placed, where the old asked only that every one it found was so (a scene that faced
// none passed).
// Level 1 (unit): the grid, the facing, the force's strength, the shot and the fate rolls are pure functions, called on
// the engine's modules. Not static: they compute the figures. Not a scenario: nothing here needs a battle's dice (the
// fate rolls are planned, and the shot's die pinned).
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The beasts' battle-line abilities (R-106; on hand-made rows and units): the flying beasts fight from the air; Storm
// Wings, Rooted, Boulder Wall, Maul, Trample, Many Heads, Purity, Through the Glades and Colossal Bulk on the faced
// grid; Shoal Swarm in `unitAbilityMult`; Shell Wall and Thick Hide in `applyMissileHit`; Regenerating Hide in
// `rollUnitFates` (planned rolls), its lines read through `theWordsOf`
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { battleFacing, battleGrid, type BattleRow } from '../../src/engine/battle/lines.ts';
import { missileCapReached, unitAbilityMult } from '../../src/engine/battle/strength.ts';
import { applyMissileHit } from '../../src/engine/battle/terrain-and-unit-strength.ts';
import { rollUnitFates } from '../../src/engine/battle/fates.ts';
import type { ArmyInABattle } from '../../src/engine/army-tables.ts';
import {
  theWordsOfWhyAUnitFacesAsItDoes,
  theWordsOfWhyAUnitStandsWhereItDoes,
} from '../../src/views/prose/the-words-of-a-battles-lines.ts';
import { theWordsOf } from '../../src/views/prose/the-words-of-each-line.ts';
import {
  aRow,
  faced as theFacedGrid,
  plannedDice,
  withTheDice,
  type AFacedGrid,
} from '../lib/hand-made-battle-lines.ts';

/** The units' final strengths in these scenes (the old script's table; a type it doesn't name is 8). */
const BASE: Readonly<Record<string, number | undefined>> = {
  'Shieldwall Levies': 8,
  'Yeoman Longbows': 8,
  'Free Lances': 10,
  'Gilded Lances': 12,
  'Orc Berserkers': 12,
  'Noble Griffons': 12,
  'Eagle Riders': 12,
  Thunderbirds: 22,
  'Forest Ents': 22,
  'Great Bears': 22,
  'Stone Giants': 26,
  'Unicorn Herd': 26,
  'Mammoth Host': 26,
  'Crimson Rocs': 30,
  'Cave Trolls': 22,
  'Manticore Pride': 26,
  'Titan Warbeasts': 36,
  'Elder Dragons': 38,
  'Dread Hydras': 38,
  'Shark Shoals': 10,
  'Great Turtles': 26,
};
/** So many units of each type, at their strengths in BASE; skeletal where the spec says so. */
type ASpec = readonly (readonly [type: string, count: number, skeletal?: boolean])[];
function rows(spec: ASpec): BattleRow[] {
  return spec.flatMap(([type, n, skeletal]) =>
    Array.from({ length: n }, () => {
      const row = aRow(type, BASE[type] ?? 8);
      if (skeletal && row.a) row.a._isSkeletal = true;
      return row;
    }),
  );
}

/** Both sides placed, each with the other as its enemy, and faced: `me` attacks, `them` defends. */
function fight(mine: ASpec, theirs: ASpec, W: number, terrain: string) {
  const me = battleGrid(rows(mine), W, terrain, { tac: 0, enemy: rows(theirs), enemyTac: 0 });
  const them = battleGrid(rows(theirs), W, terrain, { tac: 0, enemy: rows(mine), enemyTac: 0 });
  battleFacing(me, them, terrain);
  return { me: theFacedGrid(me), them: theFacedGrid(them) };
}

/** A grid's faced units of a type. */
const faced = (g: AFacedGrid, type: string) => g.face.units.filter((u) => u.row.a?.type === type);
/** A grid's placed units of a type. */
const placed = (g: AFacedGrid, type: string) => g.units.filter((u) => u.row.a?.type === type);
/** Why a faced unit faces as it does, in words. */
const why = (u: AFacedGrid['face']['units'][number]) => theWordsOfWhyAUnitFacesAsItDoes(u.why);
/** Why each faced unit of a type faces as it does, in words, joined. */
const whyOf = (g: AFacedGrid, type: string) => faced(g, type).map(why).join(' | ');
/** Why a placed unit stands where it does, in words. */
const whereWhy = (u: AFacedGrid['units'][number]) => theWordsOfWhyAUnitStandsWhereItDoes(u.why);
/** A unit of a type as a force lists it, at a quality. */
const aUnit = (type: string, quality = 'Average'): ArmyInABattle => ({ type, quality, race: '', unitName: type });
/** Within the old script's 1e-6. */
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

describe('the flying beasts fight from the air', () => {
  const r = fight(
    [
      ['Thunderbirds', 1],
      ['Manticore Pride', 1],
      ['Crimson Rocs', 1],
      ['Elder Dragons', 1],
      ['Forest Ents', 2],
    ],
    [
      ['Shieldwall Levies', 4],
      ['Eagle Riders', 1],
    ],
    4,
    'plain',
  );

  test.each(['Thunderbirds', 'Manticore Pride', 'Crimson Rocs', 'Elder Dragons'])(
    '%s fight from the air at full strength',
    (t) => {
      expect(placed(r.me, t)).toHaveLength(1);
      for (const u of placed(r.me, t)) {
        expect(u.place).toBe('air');
        expect(near(u.mult, 1)).toBe(true);
      }
    },
  );

  test('the walking beasts still hold the front', () => {
    expect(placed(r.me, 'Forest Ents')).toHaveLength(2);
    for (const u of placed(r.me, 'Forest Ents')) expect(u.place).toBe('front');
  });

  test('four flying beasts take no place in a front of four: the two Ents hold it alone', () => {
    expect(r.me.front.filter(Boolean)).toHaveLength(2);
  });

  test('four Dragons over one Levy company: two at full strength (the cap never falls below two), two at half beyond the line', () => {
    const s = fight([['Elder Dragons', 4]], [['Shieldwall Levies', 1]], 1, 'plain');
    const dragons = placed(s.me, 'Elder Dragons');
    expect(dragons.filter((u) => near(u.mult, 1))).toHaveLength(2);
    expect(dragons.filter((u) => near(u.mult, 0.5))).toHaveLength(2);
  });
});

// Noble Griffons, not Eagle Riders: on open ground an Eagle leaves the air for an empty flank slot (Stoop on the
// Horses).
describe('Storm Wings: with Thunderbirds on the other side, every enemy unit in the air fights ×0.85', () => {
  const r = fight(
    [
      ['Shieldwall Levies', 2],
      ['Thunderbirds', 1],
    ],
    [
      ['Shieldwall Levies', 2],
      ['Noble Griffons', 1],
      ['Crimson Rocs', 1],
    ],
    2,
    'plain',
  );

  test('the Griffons and the Rocs in the air fight ×0.85', () => {
    for (const t of ['Noble Griffons', 'Crimson Rocs']) {
      expect(faced(r.them, t)).toHaveLength(1);
      for (const u of faced(r.them, t)) {
        expect(near(u.m, 0.85)).toBe(true);
        expect(why(u)).toMatch(/Storm Wings/);
      }
    }
  });

  test('…the Levies on the ground are not touched', () => {
    expect(faced(r.them, 'Shieldwall Levies')).toHaveLength(2);
    for (const u of faced(r.them, 'Shieldwall Levies')) expect(why(u)).not.toMatch(/Storm Wings/);
  });

  test('the Thunderbirds themselves fight even in the air', () => {
    expect(faced(r.me, 'Thunderbirds')).toHaveLength(1);
    for (const u of faced(r.me, 'Thunderbirds')) expect(near(u.m, 1)).toBe(true);
  });

  test('no Thunderbirds, no Storm Wings', () => {
    const s = fight(
      [
        ['Shieldwall Levies', 2],
        ['Crimson Rocs', 1],
      ],
      [
        ['Shieldwall Levies', 2],
        ['Noble Griffons', 1],
      ],
      2,
      'plain',
    );
    expect(faced(s.them, 'Noble Griffons')).toHaveLength(1);
    for (const u of faced(s.them, 'Noble Griffons')) {
      expect(near(u.m, 1)).toBe(true);
      expect(why(u)).not.toMatch(/Storm Wings/);
    }
  });

  test('Flak Gunners and Storm Wings stack on a Gyrocopter facing enemy flyers under Thunderbirds: ×1.25 × ×0.85', () => {
    const s = fight(
      [
        ['Shieldwall Levies', 2],
        ['Thunderbirds', 1],
      ],
      [
        ['Shieldwall Levies', 2],
        ['Gnomish Gyrocopters', 1],
      ],
      2,
      'plain',
    );
    expect(faced(s.them, 'Gnomish Gyrocopters')).toHaveLength(1);
    for (const u of faced(s.them, 'Gnomish Gyrocopters')) {
      expect(near(u.m, 1.25 * 0.85)).toBe(true);
      expect(why(u)).toMatch(/Flak Gunners/);
      expect(why(u)).toMatch(/Storm Wings/);
    }
  });
});

describe('Rooted: a Forest Ents company at a wrapped end is never hit from the side', () => {
  test('both end Ents stand unshaken by the wrap', () => {
    const r = fight([['Orc Berserkers', 5]], [['Forest Ents', 3]], 5, 'plain');
    expect(faced(r.them, 'Forest Ents')).toHaveLength(3);
    for (const u of faced(r.them, 'Forest Ents')) expect(why(u)).not.toMatch(/hit from the side/);
    expect(faced(r.them, 'Forest Ents').filter((u) => why(u).includes('Rooted'))).toHaveLength(2);
  });

  test('…attacking too: roots hold either way', () => {
    const r = fight([['Forest Ents', 3]], [['Orc Berserkers', 5]], 5, 'plain');
    expect(faced(r.me, 'Forest Ents').filter((u) => why(u).includes('Rooted'))).toHaveLength(2);
  });

  test('Stone Giants at the ends are hit from the side like anyone', () => {
    const r = fight([['Orc Berserkers', 5]], [['Stone Giants', 3]], 5, 'plain');
    expect(faced(r.them, 'Stone Giants').filter((u) => why(u).includes('hit from the side'))).toHaveLength(2);
  });
});

describe('Boulder Wall: cavalry facing Stone Giants fights at no better than ×0.75', () => {
  test('Free Lances facing Giants ×0.75', () => {
    const r = fight([['Free Lances', 2]], [['Stone Giants', 2]], 2, 'forest');
    expect(faced(r.me, 'Free Lances')).toHaveLength(2);
    for (const u of faced(r.me, 'Free Lances')) {
      expect(near(u.m, 0.75)).toBe(true);
      expect(why(u)).toMatch(/Boulder Wall/);
    }
  });

  test('…and it caps a Lance Charge', () => {
    const r = fight([['Gilded Lances', 2]], [['Stone Giants', 2]], 2, 'forest');
    expect(faced(r.me, 'Gilded Lances')).toHaveLength(2);
    for (const u of faced(r.me, 'Gilded Lances')) {
      expect(near(u.m, 0.75)).toBe(true);
      expect(why(u)).toMatch(/Boulder Wall/);
    }
  });

  describe('facing Ents', () => {
    const r = fight([['Free Lances', 2]], [['Forest Ents', 2]], 2, 'forest');

    test("cavalry keep cavalry's ×0.85 (no wall of boulders)", () => {
      expect(faced(r.me, 'Free Lances')).toHaveLength(2);
      for (const u of faced(r.me, 'Free Lances')) {
        expect(near(u.m, 0.85)).toBe(true);
        expect(why(u)).not.toMatch(/Boulder Wall/);
      }
    });

    test('the Ents fight the horse at ×1.15 as infantry does', () => {
      expect(faced(r.them, 'Forest Ents')).toHaveLength(2);
      for (const u of faced(r.them, 'Forest Ents')) expect(near(u.m, 1.15)).toBe(true);
    });
  });
});

describe('Maul, Trample, Many Heads: ×1.15, ×1.15 and ×1.25 facing foot; nothing facing horse', () => {
  const theThree: ASpec = [
    ['Great Bears', 1],
    ['Mammoth Host', 1],
    ['Dread Hydras', 1],
  ];

  describe('facing Berserkers', () => {
    const r = fight(theThree, [['Orc Berserkers', 3]], 3, 'forest');

    test.each([
      ['Great Bears', 1.15, /Maul/],
      ['Mammoth Host', 1.15, /Trample/],
      ['Dread Hydras', 1.25, /Many Heads/],
    ] as const)('%s ×%s', (t, m, ability) => {
      expect(faced(r.me, t)).toHaveLength(1);
      for (const u of faced(r.me, t)) {
        expect(near(u.m, m)).toBe(true);
        expect(why(u)).toMatch(ability);
      }
      expect(whyOf(r.me, t)).toMatch(ability);
    });
  });

  test("facing horse the three fight at infantry's ×1.15 with no ability of their own", () => {
    const r = fight(theThree, [['Free Lances', 3]], 3, 'forest');
    for (const t of ['Great Bears', 'Mammoth Host', 'Dread Hydras']) {
      expect(faced(r.me, t)).toHaveLength(1);
      for (const u of faced(r.me, t)) {
        expect(near(u.m, 1.15)).toBe(true);
        expect(why(u)).not.toMatch(/Maul|Trample|Many Heads/);
      }
    }
  });

  test("facing archers caught in the front they fight at infantry's ×1.25, no more", () => {
    const r = fight(theThree, [['Yeoman Longbows', 3]], 3, 'forest');
    for (const t of ['Great Bears', 'Mammoth Host', 'Dread Hydras']) {
      expect(faced(r.me, t)).toHaveLength(1);
      for (const u of faced(r.me, t)) {
        expect(near(u.m, 1.25)).toBe(true);
        expect(why(u)).not.toMatch(/Maul|Trample|Many Heads/);
      }
    }
  });
});

describe('Purity: the Unicorn Herd facing a Monster or skeletons ×1.25 on top of the matchup', () => {
  test('unicorns facing Cave Trolls ×0.85 × ×1.25', () => {
    const r = fight([['Unicorn Herd', 2]], [['Cave Trolls', 2]], 2, 'forest');
    expect(faced(r.me, 'Unicorn Herd')).toHaveLength(2);
    for (const u of faced(r.me, 'Unicorn Herd')) {
      expect(near(u.m, 0.85 * 1.25)).toBe(true);
      expect(why(u)).toMatch(/Purity/);
    }
  });

  test('…and facing skeletal Levies Purity breaks the Spear Hedge (Toby, 2026-10-12): ×0.85 × ×1.25', () => {
    const r = fight([['Unicorn Herd', 2]], [['Shieldwall Levies', 2, true]], 2, 'forest');
    expect(faced(r.me, 'Unicorn Herd')).toHaveLength(2);
    for (const u of faced(r.me, 'Unicorn Herd')) {
      expect(near(u.m, 0.85 * 1.25)).toBe(true);
      expect(why(u)).toMatch(/Purity breaks the Spear Hedge/);
    }
  });

  test('facing living orcs the herd is plain cavalry', () => {
    const r = fight([['Unicorn Herd', 2]], [['Orc Berserkers', 2]], 2, 'forest');
    expect(faced(r.me, 'Unicorn Herd')).toHaveLength(2);
    for (const u of faced(r.me, 'Unicorn Herd')) {
      expect(near(u.m, 0.85)).toBe(true);
      expect(why(u)).not.toMatch(/Purity/);
    }
  });
});

describe('Through the Glades: in forest and jungle the Unicorn Herd takes the one flank slot, as the Stag Riders do', () => {
  test('the herd takes the forest flank', () => {
    const r = fight(
      [
        ['Shieldwall Levies', 2],
        ['Unicorn Herd', 1],
      ],
      [['Shieldwall Levies', 3]],
      3,
      'forest',
    );
    expect(r.me.flanks.map((x) => x.r.a?.type)).toEqual(['Unicorn Herd']);
  });

  test('Free Lances find no flank in the forest', () => {
    const r = fight(
      [
        ['Shieldwall Levies', 2],
        ['Free Lances', 1],
      ],
      [['Shieldwall Levies', 3]],
      3,
      'forest',
    );
    expect(r.me.flanks).toHaveLength(0);
  });

  test("…and the herd none in the mountains (that is the Rams' Crag Charge)", () => {
    const r = fight(
      [
        ['Shieldwall Levies', 2],
        ['Unicorn Herd', 1],
      ],
      [['Shieldwall Levies', 3]],
      3,
      'mountain',
    );
    expect(r.me.flanks).toHaveLength(0);
  });
});

describe('Colossal Bulk: a Titan Warbeasts company in the second line fights at full strength', () => {
  test('the second Titan fights from the second line at ×1', () => {
    const r = fight([['Titan Warbeasts', 2]], [['Shieldwall Levies', 1]], 1, 'plain');
    const t = placed(r.me, 'Titan Warbeasts');
    expect(t).toHaveLength(2);
    expect(t.some((u) => u.place === 'front')).toBe(true);
    expect(t.some((u) => u.place === 'second' && near(u.mult, 1) && whereWhy(u).includes('Colossal Bulk'))).toBe(true);
  });

  test('a second Giant behind the first fights at ×0.5, as foot in the second line does', () => {
    const r = fight([['Stone Giants', 2]], [['Shieldwall Levies', 1]], 1, 'plain');
    expect(placed(r.me, 'Stone Giants').some((u) => u.place === 'second' && near(u.mult, 0.5))).toBe(true);
  });
});

describe('Shoal Swarm: +10% per other Shark Shoals in the force, to +30%', () => {
  const swarm = (n: number) =>
    unitAbilityMult(
      aUnit('Shark Shoals'),
      { force: Array.from({ length: n }, () => aUnit('Shark Shoals')), enemyForce: [aUnit('Galleon Fleet')] },
      'sea',
    );

  test.each([
    [1, 1],
    [2, 1.1],
    [3, 1.2],
    [4, 1.3],
    [6, 1.3],
  ])('%s shoals: ×%s', (n, m) => {
    expect(near(swarm(n), m)).toBe(true);
  });

  test('whales and hulls do not swell the shoal', () => {
    const force = [aUnit('Shark Shoals'), aUnit('Whale Cohort'), aUnit('Galleon Fleet')];
    expect(near(unitAbilityMult(aUnit('Shark Shoals'), { force, enemyForce: [] }, 'sea'), 1)).toBe(true);
  });
});

describe('Shell Wall and Thick Hide: the pre-battle volley', () => {
  /** A Longbow company's shot at a unit of `type`, the shooter's Archery 2: the hit and the unit after it. */
  const shot = (type: string) => {
    const t = aUnit(type);
    const h = applyMissileHit(t, 2, aUnit('Yeoman Longbows'), {});
    return { h, t };
  };

  test('Shell Wall: a volley at the Great Turtles does nothing (immune, as the Ironclads)', () => {
    const turtle = shot('Great Turtles');
    expect(turtle.h.immune).toBe(true);
    expect(turtle.h.dmg).toBe(0);
    expect(turtle.t._tempStrReduction ?? 0).toBe(0);
  });

  test('…and archers never waste a shot on them (the target pool skips them)', () => {
    expect(missileCapReached(aUnit('Great Turtles'), aUnit('Yeoman Longbows'))).toBe(true);
  });

  test('Thick Hide: the shot that takes N from Levies takes half, rounded up, from Great Bears', () => {
    // The roll is pinned, so the two shots are the same shot.
    const { levy, bear } = withTheDice(
      () => 0.5,
      () => ({ levy: shot('Shieldwall Levies'), bear: shot('Great Bears') }),
    );
    expect(levy.h.dmg).toBeGreaterThanOrEqual(2);
    expect(bear.h.dmg).toBe(Math.ceil(levy.h.dmg / 2));
    expect(bear.h.thickHide).toBe(true);
  });
});

describe('Regenerating Hide: a troll that fails its death roll after a lost battle shrugs it off three times in ten', () => {
  const owner = { heroName: 'Test', leaderless: false };

  test('one troll regenerates and one is destroyed, and one line names the Regenerating Hide', () => {
    const force = [aUnit('Cave Trolls', 'Veteran'), aUnit('Cave Trolls', 'Veteran')];
    const said: string[] = [];
    // Troll 1 dies on its first roll (0 < dieAt 1) and regenerates on 0.1 (< 0.30); troll 2 dies and fails on 0.5.
    const res = rollUnitFates(force, {
      owner,
      won: false,
      dieAt: () => 1,
      demoteAt: () => 0,
      promoteTo: () => 0,
      rng: plannedDice([0, 0.1, 0, 0.5]),
      say: (s) => said.push(theWordsOf(s)),
    });
    expect(force[0]?._died).not.toBe(true);
    expect(force[1]?._died).toBe(true);
    expect(res.died).toBe(1);
    expect(res.survived).toBe(1);
    expect(said.filter((s) => s.includes('Regenerating Hide'))).toHaveLength(1);
  });

  test('a troll destroyed in a victory gets no regeneration roll (the hide knits in flight, not in the press of the win)', () => {
    const won = [aUnit('Cave Trolls', 'Veteran')];
    rollUnitFates(won, { owner, won: true, dieAt: () => 1, promoteTo: () => 0, rng: plannedDice([0, 0.1]) });
    expect(won[0]?._died).toBe(true);
  });

  test('a Giant gets no such roll', () => {
    const other = [aUnit('Stone Giants', 'Veteran')];
    rollUnitFates(other, {
      owner,
      won: false,
      dieAt: () => 1,
      demoteAt: () => 0,
      promoteTo: () => 0,
      rng: plannedDice([0, 0.1]),
    });
    expect(other[0]?._died).toBe(true);
  });
});
