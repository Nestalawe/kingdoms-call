// The bots' tuning and their war bar ask the alignment abilities' rows, not the creeds' names (plan P1-19bb9), each
// with the bot's own numbers as they were: botTuning's overlays (Divine grace's: a king attacks at 0.9 of his margin
// while the realm holds consecrated ground; the Banner of Fellowship's: an assault at 0.9 of its margin; the conquest
// doctrine's: the tax weighs 1.5 times and the rival bias rises by 3; the Blood Harvest's: the rival bias rises by 3),
// and botWarAssess's dark bonus (war without warning's rows: an Evil or an Undead realm's bar is 0.15 lower). By creed,
// and for a realm of none (its alignment empty), which the tuning reads as it is and the war bar as Neutral. No matrix
// game shows which creed reads which overlay: the balance games hold the bots' plans only as a whole.
//
// Level 1 (unit): the bots' functions called directly with small synthetic states. Not lower: a static test can't run
// them, and the weights and the bar are what they hand on.
import { describe, expect, test } from 'vitest';
import { botTuning } from '../../src/engine/bots/intel.ts';
import { botWarAssess } from '../../src/engine/bots/war.ts';
import type { GameState } from '../../src/schemas/saved-game-state.ts';

/** The seven creeds, in the ladder's order, and a realm of none's empty alignment. */
const CREEDS = ['Divine', 'Good', 'Druidic', 'Neutral', 'Pagan', 'Evil', 'Undead', ''] as const;

/** What each creed answers, one line a creed (a realm of none's as "none"). */
const byCreed = (answer: (alignment: string) => string) =>
  CREEDS.map((creed) => `${creed || 'none'}: ${answer(creed)}`).join('; ');

/** A number to four places, as the weights are compared. */
const four = (n: number) => String(Math.round(n * 10000) / 10000);

describe("botTuning: each creed's overlay, by the ability its row gives", () => {
  /** The weights of a Human realm of the alignment given (a Human: no race's overlay), holding consecrated ground or
   *  none: the king's and the assault's margins, the tax's weight and the rival bias. */
  const theWeights = (alignment: string, consecratedProvIds: number[]) => {
    // `as`: a realm made of the few fields botTuning reads, as it reads them
    const G = {
      botDifficulty: 'hard',
      players: [{ alignment, race: 'Human', consecratedProvIds }],
    } as unknown as GameState;
    const T = botTuning(G, 0);
    return [T.kingAttackMargin, T.assaultMargin, T.taxScoreWeight, T.rivalBias].map(four).join(' ');
  };
  test("with consecrated ground: the Divine king's margin, the Good assault's, the Evil tax and bias, the Pagan bias", () => {
    expect(byCreed((creed) => theWeights(creed, [3]))).toBe(
      'Divine: 1.1178 1.26 10 12; Good: 1.242 1.134 10 12; Druidic: 1.242 1.26 10 12; Neutral: 1.242 1.26 10 12; ' +
        'Pagan: 1.242 1.26 10 15; Evil: 1.242 1.26 15 15; Undead: 1.242 1.26 10 12; none: 1.242 1.26 10 12',
    );
  });
  test("with no consecrated ground: a Divine realm's king keeps his margin, and no other overlay falls to it", () => {
    expect(byCreed((creed) => theWeights(creed, []))).toBe(
      'Divine: 1.242 1.26 10 12; Good: 1.242 1.134 10 12; Druidic: 1.242 1.26 10 12; Neutral: 1.242 1.26 10 12; ' +
        'Pagan: 1.242 1.26 10 15; Evil: 1.242 1.26 15 15; Undead: 1.242 1.26 10 12; none: 1.242 1.26 10 12',
    );
  });
});

describe("botWarAssess: the dark creeds' lower bar, by war without warning's rows", () => {
  /** The bar a realm of the alignment given weighs a war on a rival of the same creed by (no distance between them):
   *  its king Cowardly (+0.3), its name empty (a lean of −0.10), one province and no host, so the bar stands above its
   *  floor (0.75) and only the dark bonus moves it. */
  const theBar = (alignment: string) => {
    // `as`: a world made of the few fields botWarAssess reads, as it reads them
    const G = {
      turn: 3,
      players: [
        { alignment, name: '' },
        { alignment, name: '' },
      ],
      characters: [{ id: 1, alive: true, isKing: true, player: 0, temper: 'Cowardly', location: 0, armies: [] }],
      world: { cols: 2, rows: 1, provinces: [{ id: 0, row: 0, col: 0, owner: 0, terrain: 'plains', name: 'Ashford' }] },
    } as unknown as GameState;
    return four(botWarAssess(G, 0, 1, null).thr);
  };
  test('an Evil and an Undead realm weigh a war at 0.15 below the others; a realm of none at the Neutral bar', () => {
    expect(byCreed(theBar)).toBe(
      'Divine: 1; Good: 1; Druidic: 1; Neutral: 1; Pagan: 1; Evil: 0.85; Undead: 0.85; none: 1',
    );
  });
});
