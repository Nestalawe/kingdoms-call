// The order form's spells and where their marks must stand (plan P1-11c2: the two files of src/engine/rules-on-plain-
// values/, spells-the-order-form-offers-each-school-aim-and-mastery-level.ts and whether-a-spells-mark-must-stand-in-
// the-casters-province.ts), called directly: each table the folder makes of the content's spells, in its order, and
// whether a spell's mark must stand in the caster's province, for every spell. The tables written out are the order
// form's own (src/ui/player/: SPELLS_BY_SCHOOL, SPELL_TO_SCHOOL, SPELL_REQ_LEVEL, PHASE_SPELLS, _hsPhase,
// ENCOUNTER_VALID, in their order; NEEDS_PROV and NEEDS_CHAR, which the form only asks `has` of, in the content's), so
// P1-11c3 can swap them in with no screen changed. The files import only the content, so the test imports them as they
// are, with no engine loaded. The whole-turn cases (lib/cast-spell-order-cases.ts, "a mark gone before the spell is
// shaped") show the Cast Spell order asks the mark check.
// Level 1 (unit): functions of the content's tables.
import { describe, expect, test } from 'vitest';
import { SPELL_DEFS_P } from '../../src/content/kingdoms-call-data.ts';
import {
  everySpellBySchool,
  theActionSpells,
  theActionSpellsAimedAtAHero,
  theActionSpellsAimedAtAProvince,
  theActionSpellsNoMasteryLevelGates,
  theCombatSpellsBySchool,
  theLevelEachMasterySpellNeeds,
  theSchoolOfEachSpell,
} from '../../src/engine/rules-on-plain-values/spells-the-order-form-offers-each-school-aim-and-mastery-level.ts';
import { theMarkOfThisSpellMustStandInTheCastersProvince } from '../../src/engine/rules-on-plain-values/whether-a-spells-mark-must-stand-in-the-casters-province.ts';

const WHITE = ['Resurrect', 'Part Sea', 'Bless Province', 'Holy Symbol', 'Spiritwrack', 'Sanctuary', 'Divine Judgment'];
const PSYCHIC = [
  'Charm',
  'Oratory',
  'Clairvoyance',
  'Psychic Blast',
  'Telekinetic Storm',
  'Mass Confusion',
  'Dominate',
];
const ILLUSORY = [
  'Illusory Terrain',
  'Phantasmal Armies',
  'Hide Lairs',
  'Invisibility',
  'Mirror Image',
  'Phantom Host',
  'Veil',
];
const ELEMENTAL = [
  'Lightning Bolt',
  'Fireball',
  'Earthquake',
  'Flood',
  'Elemental Summon',
  'Chain Lightning',
  'Cataclysm',
];
const NECROMANCY = [
  'Control Undead',
  'Skeletal Armies',
  'Curse',
  'Hand of Death',
  'Plague',
  'Raise Wraiths',
  "Death's Dominion",
];
/** The action spells no mastery level gates, in the content's order. */
const THE_BASE_ACTION_SPELLS = [
  'Resurrect',
  'Part Sea',
  'Bless Province',
  'Holy Symbol',
  'Charm',
  'Oratory',
  'Clairvoyance',
  'Psychic Blast',
  'Telekinetic Storm',
  'Illusory Terrain',
  'Phantasmal Armies',
  'Hide Lairs',
  'Invisibility',
  'Earthquake',
  'Flood',
  'Elemental Summon',
  'Control Undead',
  'Skeletal Armies',
  'Curse',
  'Plague',
];
const THE_MASTERY_LEVELS = {
  Sanctuary: 7,
  'Divine Judgment': 9,
  'Mass Confusion': 7,
  Dominate: 9,
  'Phantom Host': 7,
  Veil: 9,
  'Chain Lightning': 7,
  Cataclysm: 9,
  'Raise Wraiths': 7,
  "Death's Dominion": 9,
};
/** The spells whose mark must stand in the caster's province: each hero-aimed action spell but Resurrect and
 *  Clairvoyance (the 11 of plan P1-11c's measurement). */
const THE_MARK_MUST_STAND_HERE = [
  'Charm',
  'Oratory',
  'Psychic Blast',
  'Telekinetic Storm',
  'Phantasmal Armies',
  'Control Undead',
  'Curse',
  'Divine Judgment',
  'Mass Confusion',
  'Dominate',
  'Chain Lightning',
];

describe('the tables the order form offers, made from the content', () => {
  test('every spell by school, in the content order', () => {
    const tables = everySpellBySchool();
    expect(Object.keys(tables)).toEqual(['white', 'psychic', 'illusory', 'elemental', 'necromancy']);
    expect(tables).toEqual({
      white: WHITE,
      psychic: PSYCHIC,
      illusory: ILLUSORY,
      elemental: ELEMENTAL,
      necromancy: NECROMANCY,
    });
  });

  test('the school of each spell, school by school', () => {
    const bySchool = {
      white: WHITE,
      psychic: PSYCHIC,
      illusory: ILLUSORY,
      elemental: ELEMENTAL,
      necromancy: NECROMANCY,
    };
    const expected = Object.entries(bySchool).flatMap(([school, spells]) => spells.map((s) => [s, school]));
    expect(Object.entries(theSchoolOfEachSpell())).toEqual(expected);
  });

  test('the level each mastery spell needs: 7 or 9, ten spells, in the content order', () => {
    expect(Object.entries(theLevelEachMasterySpellNeeds())).toEqual(Object.entries(THE_MASTERY_LEVELS));
  });

  test('the action spells: the 20 base spells, then the ten mastery spells', () => {
    expect([...theActionSpells()]).toEqual([...THE_BASE_ACTION_SPELLS, ...Object.keys(THE_MASTERY_LEVELS)]);
  });

  test('the action spells no mastery level gates: the 20 base spells', () => {
    expect([...theActionSpellsNoMasteryLevelGates()]).toEqual(THE_BASE_ACTION_SPELLS);
  });

  test('the combat spells by school, in the order an Encounter plan lists them', () => {
    const tables = theCombatSpellsBySchool();
    expect(Object.keys(tables)).toEqual(['white', 'psychic', 'illusory', 'elemental', 'necromancy']);
    expect(tables).toEqual({
      white: ['Holy Symbol', 'Spiritwrack'],
      psychic: ['Psychic Blast', 'Telekinetic Storm', 'Charm'],
      illusory: ['Mirror Image', 'Invisibility'],
      elemental: ['Lightning Bolt', 'Fireball'],
      necromancy: ['Curse', 'Hand of Death', 'Control Undead'],
    });
  });

  test('the action spells aimed at a province: nine, in the content order', () => {
    expect([...theActionSpellsAimedAtAProvince()]).toEqual([
      'Part Sea',
      'Bless Province',
      'Illusory Terrain',
      'Hide Lairs',
      'Earthquake',
      'Flood',
      'Plague',
      'Sanctuary',
      'Cataclysm',
    ]);
  });

  test('the action spells aimed at a hero: thirteen, in the content order', () => {
    expect([...theActionSpellsAimedAtAHero()]).toEqual([
      'Resurrect',
      'Charm',
      'Oratory',
      'Clairvoyance',
      'Psychic Blast',
      'Telekinetic Storm',
      'Phantasmal Armies',
      'Control Undead',
      'Curse',
      'Divine Judgment',
      'Mass Confusion',
      'Dominate',
      'Chain Lightning',
    ]);
  });

  test('each table is new each time it is asked for: a caller that changes its copy changes no other', () => {
    const first = everySpellBySchool();
    first['white']?.push('Fire Rain');
    theActionSpells().add('Fire Rain');
    expect(everySpellBySchool()['white']).toEqual(WHITE);
    expect(theActionSpells().has('Fire Rain')).toBe(false);
  });
});

describe("whether a spell's mark must stand in the caster's province", () => {
  test('for every spell: the 11 hero-aimed spells but Resurrect and Clairvoyance', () => {
    const answers = Object.keys(SPELL_DEFS_P).filter((name) => theMarkOfThisSpellMustStandInTheCastersProvince(name));
    expect(answers).toEqual(THE_MARK_MUST_STAND_HERE);
  });

  test('a name with no row needs none', () => {
    expect(theMarkOfThisSpellMustStandInTheCastersProvince('Fire Rain')).toBe(false);
    expect(theMarkOfThisSpellMustStandInTheCastersProvince('')).toBe(false);
  });
});
