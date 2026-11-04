// The two front lines always face each other (R-091; Toby's batch of 2026-10-12, item 18; plan P1-14j, the old
// `battle-fronts-meet` script). A unit in the front may stand with nobody opposite only when every unit of the enemy's
// front already has someone opposite it: the narrower front stands wholly inside the wider one's span (two fronts of
// the same size stand column for column). The line-up may still reorder a line, but never slide it sideways so that
// both ends hang free.
//   • 400 deploys of made-up sides (a fixed generator of their own, not the game's dice): none leaves a front unit
//     unfaced while an enemy front unit is unfaced too (on the build before item 18, 64 of these 400 did), and more
//     than 100 of them still shift a line;
//   • one hand-built deploy that used to slide: five against five on the plains, both lines faced column for column,
//     with either side scouting, at Tactical 0 and 3.
// The old script booted the GM portal to call battleDeploy as its global; "the GM portal boots" is the import now, and
// "no page errors" is this file throwing nothing (an unexpected console.error fails it: tests/setup/each.ts).
// Level 1 (unit): the deploy and the line-up (battleDeploy, battleBestSwap) are pure functions of the two sides, the
// ground and the roll, with no dice, called on the engine's modules. Not a scenario: a battle would only add its dice.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Item 18 (R-091; `battleDeploy`, `src/engine/battle/lines.ts`): the two front lines always face each other. In 400
// made-up deploys (a fixed generator of the test's own) no front unit is left with nobody opposite while an enemy front
// unit has nobody opposite too, and more than 100 still shift a line; a hand-built five against five on the plains
// holds the same columns on both sides, with no front unit wrapping an end or facing nobody. Level 1: pure functions
// of the two sides; a battle would only add its dice
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { BATTLE_FRONT_RANGE, battleDeploy, type BattleGrid, type BattleRow } from '../../src/engine/battle/lines.ts';
import { theWordsOfWhyAUnitFacesAsItDoes } from '../../src/views/prose/the-words-of-a-battles-lines.ts';

/** This scene's strengths (its own: the generator scales each by 0.6 to 1.4). */
const BASE = {
  'Shieldwall Levies': 8,
  'Men-at-Arms': 12,
  'Free Lances': 10,
  'Yeoman Longbows': 8,
  'Orc Berserkers': 12,
  'Goblin Horde': 6,
  'Warg Riders': 12,
  'Black Arrows': 8,
  'Cave Trolls': 22,
  'Stone Giants': 26,
} as const;
type AType = keyof typeof BASE;
const TYPES = Object.keys(BASE) as AType[];
const GROUNDS = ['plain', 'forest', 'mountain', 'desert', 'jungle'] as const;

const aRow = (type: string, base: number): BattleRow => ({
  a: { type, quality: 'Average', race: '', unitName: type },
  base,
});
/** The span of a front: its first and last occupied column, and how many stand in it. */
const span = (g: BattleGrid) => {
  const o = g.front.map(Boolean);
  return { f: o.indexOf(true), l: o.lastIndexOf(true), n: o.filter(Boolean).length };
};
/** The rule: the narrower front stands within the wider front's span (the same size: the same columns). */
const meet = (gA: BattleGrid, gD: BattleGrid) => {
  const a = span(gA),
    d = span(gD);
  if (!a.n || !d.n) return true;
  return a.n <= d.n ? a.f >= d.f && a.l <= d.l : d.f >= a.f && d.l <= a.l;
};
const show = (g: BattleGrid) =>
  g.front.map((x) => (x ? (x.r.a?.type.split(' ')[0] ?? '?').slice(0, 5) : '·')).join('|');

describe('the two fronts meet, whatever the line-up', () => {
  test('400 deploys of made-up sides: none leaves a front unit with nobody opposite while an enemy front unit has nobody opposite too', () => {
    // The old script's generator, as it was: a linear congruential one from seed 7 (not the game's dice, so the 400
    // sides are the same on every seed).
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const pick = <T>(list: readonly T[]): T => {
      const x = list[Math.floor(rnd() * list.length)];
      if (x === undefined) throw new Error('a pick past the list');
      return x;
    };
    const row = (t: AType) => aRow(t, BASE[t] * (0.6 + rnd() * 0.8));
    let bad = 0,
      moved = 0;
    let first: string | null = null;
    for (let k = 0; k < 400; k++) {
      const terrain = GROUNDS[k % 5] ?? 'plain';
      const nA = 1 + Math.floor(rnd() * 9),
        nD = 1 + Math.floor(rnd() * 9);
      const rA = Array.from({ length: nA }, () => row(pick(TYPES)));
      const rD = Array.from({ length: nD }, () => row(pick(TYPES)));
      const [low, high] = BATTLE_FRONT_RANGE[terrain];
      const roll = low + Math.floor(rnd() * (high - low + 1));
      const d = battleDeploy(rA, rD, {
        terrain,
        roll,
        tacA: Math.floor(rnd() * 4),
        tacD: Math.floor(rnd() * 4),
        flankA: false,
        flankD: false,
        scout: rnd() < 0.5 ? 'atk' : 'def',
      });
      if (d.lineup || d.moves.scout || d.moves.other) moved++;
      if (!meet(d.gA, d.gD)) {
        bad++;
        first ??= `${terrain}, front ${String(d.W)}: attacker ${show(d.gA)} · defender ${show(d.gD)}`;
      }
    }
    expect(moved, 'the line-ups still shift lines (deploys that made at least one swap)').toBeGreaterThan(100);
    expect({ bad, first }, 'deploys whose fronts did not meet, and the first').toEqual({ bad: 0, first: null });
  });

  describe('the hand-built deploy that used to slide: five against five on the plains', () => {
    const A = [
      aRow('Stone Giants', 26),
      aRow('Goblin Horde', 6),
      aRow('Cave Trolls', 22),
      aRow('Stone Giants', 24),
      aRow('Cave Trolls', 20),
    ];
    const D = [
      aRow('Stone Giants', 20),
      aRow('Cave Trolls', 22),
      aRow('Men-at-Arms', 12),
      aRow('Shieldwall Levies', 8),
      aRow('Shieldwall Levies', 8),
    ];
    test.each([
      ['atk', 0],
      ['atk', 3],
      ['def', 0],
      ['def', 3],
    ] as const)(
      '%s scouts, Tactical %i: both fronts hold the same columns, so no front unit wraps an end or faces nobody',
      (scout, tac) => {
        const d = battleDeploy(A, D, {
          terrain: 'plain',
          roll: 7,
          tacA: tac,
          tacD: tac,
          flankA: false,
          flankD: false,
          scout,
        });
        const a = span(d.gA),
          b = span(d.gD);
        expect([a.f, a.l], `attacker ${show(d.gA)} · defender ${show(d.gD)}`).toEqual([b.f, b.l]);
        const fronts = [...(d.gA.face?.units ?? []), ...(d.gD.face?.units ?? [])].filter((u) => u.place === 'front');
        expect(fronts.length, 'both sides faced').toBeGreaterThan(0);
        for (const u of fronts) expect(theWordsOfWhyAUnitFacesAsItDoes(u.why)).not.toMatch(/nobody opposite|wraps/);
      },
    );
  });
});
