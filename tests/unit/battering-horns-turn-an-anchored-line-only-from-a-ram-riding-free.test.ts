// Battering Horns (R-095: the Ironhoof Rams' ability; R-090: a line anchored by infantry at both ends can't be turned):
// a Ram riding free turns even an anchored line, so the archers behind it shoot at ×0.75. Only a Ram riding free: a
// Ram tied in a flank duel, or guarding an end the enemy's wider front leaves open, turns nothing, and the other rider
// riding free beside it is an ordinary rider, which an anchored line holds. A whole game seldom stages that (both sides
// with riders, the Ram the strongest of them, an anchored line on open ground), so the balance matrix never meets it:
// the second mutation session's survivor (P1-21c).
// Level 1 (unit): `battleGrid` and `battleFacing` called directly on the engine's module (`src/engine/battle/lines.ts`,
// as `the-battle-grid-lines-no-matrix-game-reaches-keep-their-values` calls them). Not static: it runs the facing. Not a
// scenario: who faces whom is a pure function of the two placed grids and the terrain, and a battle would only add its
// dice on top.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Battering Horns (R-095; R-090, a line anchored by infantry at both ends can't be turned; P1-21c: the second mutation
// session's survivor): `battleGrid` and `battleFacing` (`src/engine/battle/lines.ts`) called directly on the engine's
// module, on open ground, three battles against Levies anchoring both ends with Longbows behind: a Ram riding free
// turns the line (the Longbows ×0.75, named "flank turned (Battering Horns)"); a Ram tied in a flank duel, or guarding
// an end of the enemy's wider front, while a Free Lance rides free beside it, turns nothing (the line anchored, not
// turned, the Longbows at their full figure). A whole game seldom stages that, and the balance matrix never does. Level
// 1: who faces whom is a pure function of the two grids and the terrain; a battle would add only its dice
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { battleFacing, battleGrid, type AFacedSide, type BattleGrid } from '../../src/engine/battle/lines.ts';
import { theWordsOfWhyAUnitFacesAsItDoes } from '../../src/views/prose/the-words-of-a-battles-lines.ts';

// The units' base strengths, as `abilities-dwarven` gives them: the Ram (12) is stronger than a Free Lance (10), so it
// takes the first flank slot, which is the one that duels, then the one that guards an end.
const BASE = {
  'Dwarven Guard': 12,
  'Ironhoof Rams': 12,
  'Free Lances': 10,
  'Shieldwall Levies': 8,
  'Yeoman Longbows': 8,
} as const;
type Spec = [type: keyof typeof BASE, count: number][];
const rows = (spec: Spec) =>
  spec.flatMap(([type, n]) =>
    Array.from({ length: n }, () => ({ a: { type, quality: 'Average', race: '', unitName: type }, base: BASE[type] })),
  );
/** The Rams' side attacks with Tactical `tac` (Tactical + 1 flank slots on open ground); the anchored line defends. */
const fight = (rams: Spec, line: Spec, width: number, tac: number) => {
  const me = battleGrid(rows(rams), width, 'plain', { tac, enemy: rows(line), enemyTac: 0 });
  const them = battleGrid(rows(line), width, 'plain', { tac: 0, enemy: rows(rams), enemyTac: tac });
  battleFacing(me, them, 'plain');
  return { rams: faceOf(me), line: faceOf(them), ramsFlanks: me.flanks.map((x) => x.r.a?.type) };
};
const faceOf = (g: BattleGrid): AFacedSide => {
  if (!g.face) throw new Error('battleFacing faced no grid');
  return g.face;
};
const faced = (face: AFacedSide, type: keyof typeof BASE) => face.units.filter((u) => u.row.a?.type === type);

describe('Battering Horns turn an anchored line only from a Ram riding free', () => {
  test('a Ram riding free turns a line that Levies anchor at both ends: the Longbows behind shoot at ×0.75', () => {
    const r = fight(
      [
        ['Dwarven Guard', 3],
        ['Ironhoof Rams', 1],
      ],
      [
        ['Shieldwall Levies', 3],
        ['Yeoman Longbows', 3],
      ],
      3,
      0,
    );
    expect(r.rams.free).toBe(1);
    expect(r.line.anchored).toBe(true);
    expect(r.line.turned).toBe(true);
    const bows = faced(r.line, 'Yeoman Longbows');
    expect(bows).toHaveLength(3);
    for (const u of bows) {
      expect(theWordsOfWhyAUnitFacesAsItDoes(u.why)).toMatch(/flank turned \(Battering Horns\)/);
      expect(u.m).toBeCloseTo(1.25 * 0.75, 9);
    }
  });

  test('a Ram in a flank duel, with a Free Lance riding free beside it: the anchored line holds', () => {
    const r = fight(
      [
        ['Dwarven Guard', 3],
        ['Ironhoof Rams', 1],
        ['Free Lances', 1],
      ],
      [
        ['Shieldwall Levies', 3],
        ['Yeoman Longbows', 3],
        ['Free Lances', 1],
      ],
      3,
      1,
    );
    // The staging: the Ram duels the enemy's one rider, and the Free Lance rides free.
    expect(r.ramsFlanks[0]).toBe('Ironhoof Rams');
    expect(r.ramsFlanks[1]).toBe('Free Lances');
    expect(faced(r.rams, 'Ironhoof Rams').map((u) => u.kind)).toEqual(['duel']);
    expect(faced(r.rams, 'Free Lances').map((u) => u.kind)).toEqual(['free']);
    expect([r.rams.duels, r.rams.guarding, r.rams.free]).toEqual([1, 0, 1]);
    // The line: anchored, not turned, and the Longbows shoot at their full ×1.25 into the Guard.
    expect(r.line.anchored).toBe(true);
    expect(r.line.turned).toBe(false);
    const bows = faced(r.line, 'Yeoman Longbows');
    expect(bows).toHaveLength(3);
    for (const u of bows) {
      expect(theWordsOfWhyAUnitFacesAsItDoes(u.why)).not.toMatch(/flank turned/);
      expect(u.m).toBeCloseTo(1.25, 9);
    }
  });

  test("a Ram guarding an end of the enemy's wider front, with a Free Lance riding free: the anchored line holds", () => {
    const r = fight(
      [
        ['Dwarven Guard', 3],
        ['Ironhoof Rams', 1],
        ['Free Lances', 2],
      ],
      [
        ['Shieldwall Levies', 5],
        ['Yeoman Longbows', 5],
      ],
      5,
      2,
    );
    // The staging: the Levies' front of five overlaps the Guard's three at both ends; the Ram guards one end, a Free
    // Lance the other, and the second Free Lance rides free.
    expect(r.ramsFlanks[0]).toBe('Ironhoof Rams');
    expect(faced(r.rams, 'Ironhoof Rams').map((u) => u.kind)).toEqual(['guards']);
    expect(
      faced(r.rams, 'Free Lances')
        .map((u) => u.kind)
        .sort(),
    ).toEqual(['free', 'guards']);
    expect([r.rams.duels, r.rams.guarding, r.rams.free]).toEqual([0, 2, 1]);
    // The line: anchored, not turned; three Longbows shoot the Guard at their full ×1.25, and the two at the ends, over
    // a column the Guard leave empty, at ×1.
    expect(r.line.anchored).toBe(true);
    expect(r.line.turned).toBe(false);
    const bows = faced(r.line, 'Yeoman Longbows');
    expect(bows.map((u) => u.kind).sort()).toEqual(['even', 'even', 'shoots', 'shoots', 'shoots']);
    for (const u of bows) {
      expect(theWordsOfWhyAUnitFacesAsItDoes(u.why)).not.toMatch(/flank turned/);
      expect(u.m).toBeCloseTo(u.kind === 'shoots' ? 1.25 : 1, 9);
    }
  });
});
