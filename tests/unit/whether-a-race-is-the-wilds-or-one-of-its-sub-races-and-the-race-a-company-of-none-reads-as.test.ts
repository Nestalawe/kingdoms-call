// Whether a race is the wild's, or one of its sub-races (B-06ac: src/engine/rules-on-plain-values/whether-a-race-is-
// the-wilds-or-one-of-its-sub-races.ts), called directly on plain values, and content's two races beside it: the wild's
// (THE_RACE_OF_THE_WILD, Primal) and the one a company or province of no race reads as
// (THE_RACE_A_COMPANY_OR_PROVINCE_OF_NO_RACE_READS_AS, Human). A race that starts with the wild's is the wild's, exactly
// as each reader's `.startsWith('Primal')` gave before (a Call to Arms, Evil's conquest, Awaken Grove): Primal itself,
// a sub-race (`Primal:Wolf`), or any word that starts so; a people's race, a race empty or not given is not. The file
// imports only the content, so the test imports it as it is, with no engine loaded.
// Level 1 (unit): one function of a value.
import { expect, test } from 'vitest';
import {
  KC_HUMANOID_RACES,
  THE_RACE_A_COMPANY_OR_PROVINCE_OF_NO_RACE_READS_AS,
  THE_RACE_OF_THE_WILD,
} from '../../src/content/kingdoms-call-data.ts';
import { isTheRaceTheWildsOrOneOfItsSubRaces } from '../../src/engine/rules-on-plain-values/whether-a-race-is-the-wilds-or-one-of-its-sub-races.ts';

test("content's two races: the wild's is Primal, a company or province of no race reads as Human", () => {
  expect(THE_RACE_OF_THE_WILD, "the wild's race").toBe('Primal');
  expect(THE_RACE_A_COMPANY_OR_PROVINCE_OF_NO_RACE_READS_AS, 'the race of none').toBe('Human');
});

test("the wild's race, its sub-races and any race that starts with it are the wild's", () => {
  expect(
    ['Primal', 'Primal:Wolf', 'Primal:Bear', 'Primal Beasts'].map((race) => isTheRaceTheWildsOrOneOfItsSubRaces(race)),
  ).toEqual([true, true, true, true]);
});

test("a people's race, a race empty, null or not given, and the word in another case are not the wild's", () => {
  expect(
    KC_HUMANOID_RACES.map((race) => isTheRaceTheWildsOrOneOfItsSubRaces(race)),
    "the peoples' races",
  ).toEqual([false, false, false, false]);
  expect(
    ['', null, undefined, 'primal', 'Undead', 'Forest Ent'].map((race) => isTheRaceTheWildsOrOneOfItsSubRaces(race)),
    'none of these',
  ).toEqual([false, false, false, false, false, false]);
});
