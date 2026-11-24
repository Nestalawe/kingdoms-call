// The risen dead's race and the label a player reads each guardian's kind by (plan P1-19bb2), on the content's values
// and the label's reader called directly. The race (THE_RACE_THE_RISEN_DEAD_ARE_MADE_AS, beside the alignment
// abilities' rows) is 'Undead', as each raising wrote it before: Harvest the Field, Skeletal Armies, Raise Wraiths,
// Death's Dominion, the Iron Throne's rises, an Undead king's skeletal company, and Control Undead's search. The labels
// (the content's MONSTER_CAT_LABELS, read by monsterCatLabel in src/engine/rules-on-plain-values/a-guardians-kind-and-
// the-label-a-player-reads-it-by.ts) are each kind's word as before: a guardian of kind undead reads 'Undead', by its
// kind or by its name. They are two facts that share a word, so each is held on its own. The label's file imports only
// the content, so the test imports it as it is, with no engine loaded.
// Level 1 (unit): a value and one function of a value; a static read can't run the reader.
import { expect, test } from 'vitest';
import { THE_RACE_THE_RISEN_DEAD_ARE_MADE_AS } from '../../src/content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { MONSTER_CAT_LABELS } from '../../src/content/kingdoms-call-data.ts';
import { monsterCatLabel } from '../../src/engine/rules-on-plain-values/a-guardians-kind-and-the-label-a-player-reads-it-by.ts';

test('the risen dead are made of the race Undead', () => {
  expect(THE_RACE_THE_RISEN_DEAD_ARE_MADE_AS, "the content's race").toBe('Undead');
});

test("a guardian of kind undead reads 'Undead', by its kind or by its name", () => {
  expect(monsterCatLabel({ cat: 'undead' }), 'by its kind').toBe('Undead');
  expect(monsterCatLabel({ name: 'Barrow Wight' }), 'by its name').toBe('Undead');
});

test("each guardian's kind reads its label as before", () => {
  expect(MONSTER_CAT_LABELS).toEqual({
    humanoid: 'Humanoid',
    undead: 'Undead',
    beast: 'Beast',
    vermin: 'Vermin',
    giant: 'Giant',
    dragon: 'Dragon',
    fiend: 'Fiend',
    fey: 'Fey',
    aberration: 'Aberration',
    elemental: 'Elemental',
    construct: 'Construct',
  });
  expect(
    Object.keys(MONSTER_CAT_LABELS).map((kind) => monsterCatLabel({ cat: kind })),
    'each kind through the reader',
  ).toEqual(Object.values(MONSTER_CAT_LABELS));
});
