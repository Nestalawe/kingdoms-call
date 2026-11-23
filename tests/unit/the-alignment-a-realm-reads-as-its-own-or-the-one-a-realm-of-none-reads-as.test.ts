// The alignment a realm reads as (plan P1-19bb1: src/engine/rules-on-plain-values/the-alignment-a-realm-reads-as-its-
// own-or-the-one-a-realm-of-none-reads-as.ts), called directly on plain values. A realm of none (its alignment empty,
// or not given) reads as Neutral, the content's THE_ALIGNMENT_A_REALM_OF_NONE_READS_AS, as each reader's
// `|| 'Neutral'` gave before (the battles, a commander's score, the Broker's and the Charm's wage, a hero's hire, the
// Wonder and the heir); a realm of a creed reads as its own, any string as it is. No game, fixture or other test holds
// a realm of none but the heir's case (tests/unit/new-turn-succession-and-summons-called-directly.test.ts), so a wrong
// constant is seen here. The file imports only the content, so the test imports it as it is, with no engine loaded.
// Level 1 (unit): one function of a value.
import { expect, test } from 'vitest';
import { KC_ALIGNMENTS } from '../../src/content/kingdoms-call-data.ts';
import { THE_ALIGNMENT_A_REALM_OF_NONE_READS_AS } from '../../src/content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { theAlignmentARealmReadsAs } from '../../src/engine/rules-on-plain-values/the-alignment-a-realm-reads-as-its-own-or-the-one-a-realm-of-none-reads-as.ts';

test('a realm of none reads as Neutral: its alignment empty, not given, or null', () => {
  expect(THE_ALIGNMENT_A_REALM_OF_NONE_READS_AS, 'the content constant').toBe('Neutral');
  expect(theAlignmentARealmReadsAs(''), "alignment ''").toBe('Neutral');
  expect(theAlignmentARealmReadsAs(undefined), 'no alignment given').toBe('Neutral');
  expect(theAlignmentARealmReadsAs(null), 'alignment null').toBe('Neutral');
});

test('a realm of a creed reads as its own, and any other string as it is', () => {
  expect(KC_ALIGNMENTS.map((creed) => theAlignmentARealmReadsAs(creed))).toEqual([...KC_ALIGNMENTS]);
  expect(theAlignmentARealmReadsAs('Unknown'), 'a word that is no creed').toBe('Unknown');
  expect(theAlignmentARealmReadsAs(' '), 'a space').toBe(' ');
});
