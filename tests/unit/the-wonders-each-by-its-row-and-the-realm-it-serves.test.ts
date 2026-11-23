// The Wonders, each by its row (plan P1-19bb3): THE_WONDERS, beside the alignment abilities' rows, gives each Grand
// Design its slug and the alignment it serves, one for each of KC_GRAND_DESIGNS's texts; and theWonderServesTheRealm
// (src/engine/discoveries.ts), which the battles' and the orders' Wonders ask by their rows, answers as gdActive did by
// the row's alignment, for a realm of each alignment, with its Wonder raised or not, its province held or lost, or raised
// before the Wonders were sited.
// Level 1 (unit): a table and one function of a plain state, called directly; a static read can't run the function.
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import { THE_WONDERS } from '../../src/content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { KC_ALIGNMENTS, KC_GRAND_DESIGNS } from '../../src/content/kingdoms-call-data.ts';
import { gdActive, theWonderServesTheRealm } from '../../src/engine/discoveries.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';

test('each Wonder by its slug, and the alignment it serves', () => {
  expect(Object.fromEntries(Object.entries(THE_WONDERS).map(([slug, row]) => [slug, row.alignment]))).toEqual({
    'grand-cathedral': 'Divine',
    'free-city-charter': 'Good',
    'grand-library': 'Neutral',
    'standing-stones': 'Pagan',
    'iron-throne-of-skulls': 'Evil',
    'deathless-legion': 'Undead',
    'world-tree-grove': 'Druidic',
  });
});

test("one row for each Wonder's text, by its alignment, and one for each alignment", () => {
  const theRowsAlignments = Object.values(THE_WONDERS).map((row) => row.alignment);
  expect([...theRowsAlignments].sort(), "the rows' alignments").toEqual(Object.keys(KC_GRAND_DESIGNS).sort());
  expect([...theRowsAlignments].sort(), 'the alignments').toEqual([...KC_ALIGNMENTS].sort());
});

/** A realm of the alignment given in a state of two provinces: its Wonder raised or not, and sited in province 1 (held
 *  by the realm, or by another) or raised before the Wonders were sited. */
function aRealm(alignment: string, raised: boolean, sited: 'held' | 'lost' | 'before the Wonders were sited') {
  const G = {
    players: [
      {
        alignment,
        discoveries: raised ? [{ id: 'gd' }] : [],
        gdProvinceId: sited === 'before the Wonders were sited' ? null : 1,
      },
    ],
    world: {
      provinces: [
        { id: 0, tax: 1, owner: 0 },
        { id: 1, tax: 1, owner: sited === 'lost' ? 1 : 0 },
      ],
    },
    characters: [],
  };
  const turnContext: Pick<TurnContext, 'G'> = { G: G as unknown as TurnContext['G'] };
  return turnContext;
}

test.for(Object.keys(THE_WONDERS) as (keyof typeof THE_WONDERS)[])(
  '%s serves a realm exactly as gdActive by its alignment',
  (slug) => {
    let served = 0;
    for (const alignment of KC_ALIGNMENTS) {
      for (const raised of [true, false]) {
        for (const sited of ['held', 'lost', 'before the Wonders were sited'] as const) {
          const turnContext = aRealm(alignment, raised, sited);
          const byTheRow = theWonderServesTheRealm(turnContext, 0, slug);
          const key = `${slug}, a realm ${alignment}, raised ${String(raised)}, ${sited}`;
          expect(byTheRow, key).toBe(gdActive(turnContext, 0, THE_WONDERS[slug].alignment));
          expect(byTheRow, key).toBe(alignment === THE_WONDERS[slug].alignment && raised && sited !== 'lost');
          if (byTheRow) served++;
        }
      }
    }
    expect(served, `${slug} serves its own realm, raised, held or sited before`).toBe(2);
  },
);
