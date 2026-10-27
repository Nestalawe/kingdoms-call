// The wanderer's escape (plan P1-12d5, P1-12's Decisions of 2026-10-26, Decision 4): the engine draws which of its five
// sentences a line tells, with one die where the line is told (_garrethEscapeLine, src/engine/names.ts), and the fact
// holds the index; the prose writes the words (src/views/prose/the-words-of-the-wanderers-escape.ts), the same words
// the engine wrote before, for each index. The matrix reaches the line 17 times in its 120 games; this proves every
// index and both fallbacks of the name on a staged fact.
// Level 1 (unit): pure functions called directly on the engine's and the views' modules, with the dice pinned; a lower
// level can't run them.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { _garrethEscapeLine } from '../../src/engine/names.ts';
import { kcRng } from '../../src/engine/rng.ts';
import { THE_NUMBER_OF_WAYS_THE_WANDERER_ESCAPES } from '../../src/engine/the-facts-the-wanderers-escape-line-records.ts';
import { theWordsOfTheWanderersEscape } from '../../src/views/prose/the-words-of-the-wanderers-escape.ts';

/** The five sentences, after his name, as the engine wrote them before the row (names.ts, _GARRETH_ESCAPES). */
const THE_SENTENCES_AS_THE_ENGINE_WROTE_THEM = [
  ' somehow slips the final blow and is gone before the dust settles.',
  ' takes what should be a mortal stroke — and walks out of it without a scratch.',
  ' should by all rights have fallen, yet somehow escapes the final blow.',
  ' reels from a killing hit, staggers into the smoke, and simply isn’t there when it clears.',
  ' is run through — or seems to be — but slips free, whole and unbothered.',
];

/** Runs `body` with the dice pinned, in turn, to `dice`; counts the dice drawn. */
function withDice<T>(dice: readonly number[], body: () => T): { result: T; drawn: number } {
  let drawn = 0;
  const was = kcRng.use(() => dice[drawn++] ?? 0);
  try {
    return { result: body(), drawn };
  } finally {
    kcRng.use(was);
  }
}

describe("the wanderer's escape", () => {
  test('the prose writes each sentence for its index, after his name', () => {
    expect(THE_NUMBER_OF_WAYS_THE_WANDERER_ESCAPES).toBe(THE_SENTENCES_AS_THE_ENGINE_WROTE_THEM.length);
    THE_SENTENCES_AS_THE_ENGINE_WROTE_THEM.forEach((sentence, whichSentence) => {
      expect(
        theWordsOfTheWanderersEscape({ kind: 'the wanderer slips a killing blow', heroName: 'Garreth', whichSentence }),
      ).toBe(`\u{1F340} Garreth${sentence}`);
    });
  });

  test("with no name he is 'The wanderer'", () => {
    expect(
      theWordsOfTheWanderersEscape({ kind: 'the wanderer slips a killing blow', heroName: '', whichSentence: 2 }),
    ).toBe(`\u{1F340} The wanderer${String(THE_SENTENCES_AS_THE_ENGINE_WROTE_THEM[2])}`);
  });

  test('the engine draws one die for the line and holds which sentence it picks', () => {
    const dice = [0, 0.2, 0.39, 0.6, 0.8, 0.999];
    const { result, drawn } = withDice(dice, () =>
      dice.map(() => _garrethEscapeLine({ name: 'Garreth' }).whichSentence),
    );
    expect(result).toEqual([0, 1, 1, 3, 4, 4]);
    expect(drawn).toBe(dice.length);
    expect(withDice([0.5], () => _garrethEscapeLine(null)).result).toEqual({
      kind: 'the wanderer slips a killing blow',
      heroName: '',
      whichSentence: 2,
    });
  });
});
