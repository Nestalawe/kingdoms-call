// Who faces whom (R-090, battle lines II; plan P1-14j, the old `battle-facing` script): the facing pass on two grids
// placed from rows made by the test (tests/lib/hand-made-battle-lines.ts).
//   • a front unit against the enemy unit opposite: cavalry v ranged ×1.25, cavalry v infantry ×0.85, infantry v
//     cavalry ×1.15, infantry v a ranged unit in the front ×1.25, anything else ×1;
//   • a second-line ranged unit shooting over its fighter: infantry opposite ×1.25, cavalry ×0.75;
//   • a wider front wraps the enemy's ends (×1.2) and the end units it wraps are hit from the side (×0.9);
//   • flank riders duel; a spare one guards a threatened end (the wrapping unit is "met" instead); one with nothing to
//     do rides free (×1.3) and, on open ground, turns a line that infantry do not anchor at both ends (its second-line
//     ranged units ×0.75); rough ground has no riders to turn anything;
//   • an enemy with no front (all winged riders) faces nobody; at sea the same rules place the hulls;
//   • every row is stamped `_faced`, its army is not; the ladder's stage groups the matchups that moved a figure.
// 2026-10-11 (Toby, the unit abilities, R-095): the units these scenes use bring their abilities to the same figures:
// Spear Hedge (cavalry facing Levies at most ×0.75), Shieldwall (Levies with an archer behind ×1.25), Bodkin Points
// (Longbows shoot cavalry at ×1), Harriers (Free Lances duel at ×1.15), Wolves Panic Horses (Wargs facing cavalry
// ×1.25) and Stoop on the Horses (an Eagle holds an open flank slot no rider fills). Each expectation names the plain
// matchup and the ability on top; the plain figures are kept on units that carry no ability there (Goblins, Black
// Arrows). The old script booted the GM portal to call these as its globals; "the GM portal boots", "X() is declared
// at module level" and "BATTLE_FACING is declared" are the imports now, and "no page errors" is this file throwing
// nothing (an unexpected console.error fails it: tests/setup/each.ts).
// Level 1 (unit): what faces what is a pure function of the two placed grids and the ground, called on the engine's
// modules. Not static: it runs the facing. Not a scenario: a battle would only add its dice on top.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Who faces whom (R-090; `battleFacing`, `src/engine/battle/lines.ts`, on hand-made rows): a front unit against the
// enemy opposite by role (cavalry v ranged ×1.25, cavalry v infantry ×0.85, infantry v cavalry ×1.15, infantry v
// ranged-in-front ×1.25); a second-line ranged unit shoots the unit opposite (infantry ×1.25, cavalry ×0.75); a wider
// front wraps the ends ×1.2 and the wrapped ends are hit from the side ×0.9; flank duels, a spare rider guarding an
// end, a free rider ×1.3 turning an unanchored line on open ground (second-line ranged ×0.75); no front to face; the
// sea; the `_faced` stamps and the ladder stage. Level 1: pure functions of the two grids; a battle would only add dice
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { BATTLE_FACING } from '../../src/engine/battle/lines.ts';
import {
  battleFacingStage,
  theWordsOfWhyAUnitFacesAsItDoes,
} from '../../src/views/prose/the-words-of-a-battles-lines.ts';
import { fight, type AFacedGrid } from '../lib/hand-made-battle-lines.ts';

const frontUnits = (g: AFacedGrid) => g.face.units.filter((u) => u.place === 'front');
/** The front cell of a column: there, or the test fails. */
const frontAt = (g: AFacedGrid, c: number) => {
  const x = g.front[c];
  if (!x) throw new Error(`nobody in the front's column ${String(c)}`);
  return x;
};
const whyAt = (g: AFacedGrid, c: number) => {
  const why = frontAt(g, c).r._faced?.why;
  if (!why) throw new Error(`the front's column ${String(c)} is not faced`);
  return theWordsOfWhyAUnitFacesAsItDoes(why);
};

test("the facing's table holds the plain figures above (the old script asked only that it was declared)", () => {
  expect(BATTLE_FACING).toEqual({
    front: { cav: { arc: 1.25, foot: 0.85 }, foot: { cav: 1.15, arc: 1.25 } },
    back: { foot: 1.25, cav: 0.75 },
    wrap: 1.2,
    sideHit: 0.9,
    freeFlank: 1.3,
    turned: 0.75,
  });
});

describe('the front: matchups by role (forest, so the cavalry stand in the line)', () => {
  test('three Levies each face a Free Lance at ×1.15 → 27.6; each Lance faces them at ×0.75 (×0.85, capped by Spear Hedge) → 22.5', () => {
    const r = fight([['Shieldwall Levies', 3]], [['Free Lances', 3]], 4, 'forest');
    expect(r.me.face.total).toBeCloseTo(27.6, 6);
    expect(r.them.face.total).toBeCloseTo(22.5, 6);
    const levies = frontUnits(r.me);
    expect(levies).toHaveLength(3);
    for (const u of levies) {
      expect(u.kind, 'each Levy is stamped as facing a Free Lance').toBe('faces');
      expect(u.vs?.a?.type).toBe('Free Lances');
    }
    r.me.front.forEach((x, c) => {
      if (!x) return;
      expect(x.r._faced?.vs, 'the stamp names the enemy row in the same column').toBe(frontAt(r.them, c).r);
    });
  });

  test('…against foot with no Spear Hedge (Goblins) the Lances keep cavalry v infantry ×0.85 → 25.5', () => {
    expect(fight([['Goblin Horde', 3]], [['Free Lances', 3]], 4, 'forest').them.face.total).toBeCloseTo(25.5, 6);
  });

  test('Levies against Longbows caught in the front: ×1.25 for the Levies (20); the Longbows keep ×0.75 and face at ×1 (12)', () => {
    const r = fight([['Shieldwall Levies', 2]], [['Yeoman Longbows', 2]], 2, 'plain');
    expect(r.me.face.total).toBeCloseTo(20, 6);
    expect(r.them.face.total).toBeCloseTo(12, 6);
  });
});

describe('the second line: shooting the unit opposite', () => {
  test('Longbows behind Levies shoot the infantry opposite at ×1.25, and the Levies fight at ×1.25 (Shieldwall): 40', () => {
    const r = fight(
      [
        ['Shieldwall Levies', 2],
        ['Yeoman Longbows', 2],
      ],
      [['Shieldwall Levies', 2]],
      2,
      'plain',
    );
    expect(r.me.face.total).toBeCloseTo(40, 6);
    const bows = r.me.face.units.filter((u) => u.place === 'second');
    expect(bows).toHaveLength(2);
    for (const u of bows) {
      expect(u.kind, 'each Longbow is stamped as shooting the Levy opposite').toBe('shoots');
      expect(u.vs?.a?.type).toBe('Shieldwall Levies');
    }
  });

  test('…against cavalry (in forest): 23 + 16 = 39 (Bodkin Points) v 15 (Spear Hedge)', () => {
    const r = fight(
      [
        ['Shieldwall Levies', 2],
        ['Yeoman Longbows', 2],
      ],
      [['Free Lances', 2]],
      2,
      'forest',
    );
    expect(r.me.face.total).toBeCloseTo(39, 6);
    expect(r.them.face.total).toBeCloseTo(15, 6);
  });

  test('…the plain figures on units with no ability here (Goblins, Black Arrows): 18.4 + 12 = 30.4 v 17', () => {
    const r = fight(
      [
        ['Goblin Horde', 2],
        ['Black Arrows', 2],
      ],
      [['Free Lances', 2]],
      2,
      'forest',
    );
    expect(r.me.face.total).toBeCloseTo(30.4, 6);
    expect(r.them.face.total).toBeCloseTo(17, 6);
  });
});

describe('a wider front wraps the ends', () => {
  const fiveAgainstThree = () => fight([['Shieldwall Levies', 5]], [['Shieldwall Levies', 3]], 5, 'plain');

  test('the two with nobody opposite wrap the ends at ×1.2 → 43.2; the three’s end units are hit from the side at ×0.9 → 22.4', () => {
    const r = fiveAgainstThree();
    expect(r.me.face.total).toBeCloseTo(43.2, 6);
    expect(r.them.face.total).toBeCloseTo(22.4, 6);
  });

  test('the wrapping units are stamped with the end unit they wrap; only the end units are hit from the side', () => {
    const r = fiveAgainstThree();
    expect(frontAt(r.me, 0).r._faced?.kind).toBe('wraps');
    expect(frontAt(r.me, 0).r._faced?.vs).toBe(frontAt(r.them, 1).r);
    expect(frontAt(r.me, 4).r._faced?.kind).toBe('wraps');
    expect(frontAt(r.me, 4).r._faced?.vs).toBe(frontAt(r.them, 3).r);
    expect(whyAt(r.them, 1)).toMatch(/hit from the side/);
    expect(whyAt(r.them, 3)).toMatch(/hit from the side/);
    expect(whyAt(r.them, 2)).not.toMatch(/hit from the side/);
  });

  test('the stage groups the matchups that moved a figure and counts the even ones; no facing, no stage', () => {
    const r = fiveAgainstThree();
    expect(battleFacingStage(r.me)).toMatch(/Levy wraps the end ×1\.2 \(2 units\)/);
    expect(battleFacingStage(r.me)).toMatch(/3 even/);
    expect(battleFacingStage(r.them)).toMatch(/Levy v Levy, hit from the side ×0\.9 \(2 units\)/);
    expect(battleFacingStage({})).toBe('');
    expect(battleFacingStage(null)).toBe('');
  });
});

describe('a spare flank rider guards a threatened end', () => {
  const guarded = () =>
    fight(
      [['Shieldwall Levies', 5]],
      [
        ['Shieldwall Levies', 3],
        ['Free Lances', 1],
      ],
      5,
      'plain',
    );

  test("the three Levies' one Free Lance has no duel, so it guards a threatened end", () => {
    const r = guarded();
    expect(r.them.flanks).toHaveLength(1);
    expect(r.them.face.guarding).toBe(1);
    expect(r.them.face.free).toBe(0);
  });

  test('the wrapping Levy it meets fights it at ×1.15, the other still wraps ×1.2 → 42.8; the guarded side → 30.7', () => {
    const r = guarded();
    expect(r.me.face.total).toBeCloseTo(42.8, 6);
    expect(r.them.face.total).toBeCloseTo(30.7, 6);
  });

  test('the met unit is stamped with the rider that met it; the rider as guarding the end against it', () => {
    const r = guarded();
    const rider = r.them.flanks[0]?.r;
    expect(rider).toBeTruthy();
    expect(frontAt(r.me, 0).r._faced?.kind).toBe('met');
    expect(frontAt(r.me, 0).r._faced?.vs).toBe(rider);
    expect(rider?._faced?.kind).toBe('guards');
    expect(rider?._faced?.vs).toBe(frontAt(r.me, 0).r);
  });
});

describe('duels, a free rider, an anchored line', () => {
  const anchored = () =>
    fight(
      [
        ['Shieldwall Levies', 2],
        ['Free Lances', 1],
        ['Yeoman Longbows', 2],
      ],
      [
        ['Shieldwall Levies', 3],
        ['Warg Riders', 2],
      ],
      3,
      'plain',
      0,
      1,
    );

  test('one flank duel; the second Warg rides free', () => {
    const r = anchored();
    expect(r.me.face.duels).toBe(1);
    expect(r.them.face.duels).toBe(1);
    expect(r.them.face.free).toBe(1);
  });

  test('the free rider ×1.3, the duelling Warg ×1.25 (Wolves Panic Horses), the third Levy wraps: 51.1', () => {
    expect(anchored().them.face.total).toBeCloseTo(51.1, 6);
  });

  test('Levies at both ends anchor the line, so the free rider does not turn it: 9 + 10 + 20 + 11.5 = 50.5', () => {
    const r = anchored();
    expect(r.me.face.total).toBeCloseTo(50.5, 6);
    expect(r.me.face.anchored).toBe(true);
    expect(r.me.face.turned).toBe(false);
  });

  test('the duellists are stamped with each other; the free rider as free', () => {
    const r = anchored();
    expect(r.me.flanks[0]?.r._faced?.kind).toBe('duel');
    expect(r.me.flanks[0]?.r._faced?.vs).toBe(r.them.flanks[0]?.r);
    expect(r.them.flanks[0]?.r).toBeTruthy();
    expect(r.them.flanks[1]?.r._faced?.kind).toBe('free');
  });
});

describe('a turned flank', () => {
  const turned = (ground: string) =>
    fight(
      [
        ['Shieldwall Levies', 1],
        ['Free Lances', 2],
        ['Yeoman Longbows', 2],
      ],
      [
        ['Shieldwall Levies', 3],
        ['Warg Riders', 2],
      ],
      3,
      ground,
      0,
      1,
    );

  test('with a Free Lance holding one end the line is not anchored, and the free rider turns it', () => {
    const r = turned('plain');
    expect(r.me.face.anchored).toBe(false);
    expect(r.me.face.turned).toBe(true);
  });

  test("a turned line's Longbows shoot at ×0.75 on top of their matchup: 43.25; each is stamped “flank turned”", () => {
    const r = turned('plain');
    expect(r.me.face.total).toBeCloseTo(43.25, 6);
    const bows = r.me.second.filter((x) => x != null);
    expect(bows).toHaveLength(2);
    for (const x of bows) {
      const why = x.r._faced?.why;
      expect(why && theWordsOfWhyAUnitFacesAsItDoes(why)).toMatch(/flank turned/);
    }
  });

  test('in forest there are no flank riders, so no line is ever turned', () => {
    const r = turned('forest');
    expect(r.them.flanks).toHaveLength(0);
    expect(r.me.face.turned).toBe(false);
    expect(r.them.face.free).toBe(0);
  });
});

describe('no front to face; the sea', () => {
  test('against an enemy with no front (all winged riders) nobody faces anybody; the Eagles: 15.6 + 12 = 27.6', () => {
    const r = fight([['Shieldwall Levies', 3]], [['Eagle Riders', 2]], 3, 'plain');
    expect(r.me.face.total).toBeCloseTo(24, 6);
    expect(r.me.face.units).toHaveLength(3);
    for (const u of r.me.face.units) expect(u.kind).toBe('even');
    // One Eagle holds the open flank slot no rider fills (Stoop on the Horses) and, with nobody to duel or guard
    // against, rides free at ×1.3; the other fights from the air at ×1.
    expect(r.them.face.total).toBeCloseTo(27.6, 6);
  });

  test('at sea the hulls hold the centre and the carried Levy wraps an end: 9 + 9 + 9.6 v 7.2 + 8; the army carries no stamp', () => {
    const r = fight(
      [
        ['Galleon Fleet', 2],
        ['Shieldwall Levies', 1],
      ],
      [['Shieldwall Levies', 2]],
      8,
      'sea',
    );
    expect(r.me.face.total).toBeCloseTo(27.6, 6);
    expect(r.them.face.total).toBeCloseTo(15.2, 6);
    expect(r.me.units).toHaveLength(3);
    for (const u of r.me.units) expect(u.row.a && '_faced' in u.row.a, 'the army carries no _faced').toBe(false);
  });
});
