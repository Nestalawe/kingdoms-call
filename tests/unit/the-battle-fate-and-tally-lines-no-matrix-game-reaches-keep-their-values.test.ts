// The lines of src/engine/battle/fates.ts that plan P1-10b3 changed to type them (statements that keep every value:
// P1-10b's Decision 2 and Choice 1) and that no game of the balance matrix reaches. The matrix proves the others (both
// sets, every realm's report identical); these are proved here, each on the value it had before (worked out by the
// file as it was, with its ts-nocheck line):
// - battleMarginBand past its last band (P1-12d34 moved battleLineTiers' case, a line that is missing, to
//   tests/unit/the-views-write-each-lines-words.test.ts: the tiers are read from the lines' kinds there; P1-12d35 moved
//   battleTallyLine's cases to tests/unit/a-battles-losses-tally-is-written-from-the-facts-of-its-lines.test.ts: the
//   tally is written from the battle's facts there).
// Level 1 (unit): pure functions called directly on the engine's modules (plan P1-14a), with no turn played.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { battleMarginBand } from '../../src/engine/battle/fates.ts';

describe('battleMarginBand', () => {
  test('a margin past the last band, or none, takes the last band, or the first', () => {
    expect(battleMarginBand(10)?.slug).toBe('annihilating');
    expect(battleMarginBand(Infinity)?.slug).toBe('annihilating');
    expect(battleMarginBand(NaN)?.slug).toBe('pyrrhic');
  });
});
