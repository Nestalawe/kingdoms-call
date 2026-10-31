// ── The spells the order form offers: each school's, their aim and their mastery levels (plan P1-11c2) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). These are the Cast Spell order's tables as the order form reads them, made from the content's
// spells (SPELL_DEFS_P, src/content/kingdoms-call-data.ts): each school's spells, each spell's school, the mastery
// spells' levels, the action spells, the combat spells by school and what each action spell is aimed at. Every table
// keeps the content's order but the combat spells' (below). The form (src/ui/player/) makes its tables from these
// (P1-11c3). The one check of the order the form makes too, where a spell's mark must stand, is beside this file
// (whether-a-spells-mark-must-stand-in-the-casters-province.ts).
//
// Each table is made when it is asked for, a new one each time (the caller may keep it, or change its copy), and this
// file runs nothing as it loads: so a page that loads src/shared/ but asks for none of them loads none of the content's
// spells.
import { SPELL_DEFS_P } from '../../content/kingdoms-call-data.ts';

/** A spell as the content's table writes what the order form reads of it: its school, what it is aimed at (`province`,
 *  `character` or `none`), whether it is a combat spell (`encounter`) or an action spell (`phase`), and the raw level in
 *  its school a mastery spell needs (7 or 9; none for the others). */
interface ASpellAsTheOrderFormReadsIt {
  readonly school: string;
  readonly target: string;
  readonly encounter: boolean;
  readonly phase: boolean;
  readonly reqLevel?: number;
}

/** Every spell, by its name, in the content's order. */
function everySpell(): readonly (readonly [string, ASpellAsTheOrderFormReadsIt])[] {
  return Object.entries(SPELL_DEFS_P);
}

/** The names of the spells the content writes as `keep` says, in its order. */
function theSpellsThat(keep: (spell: ASpellAsTheOrderFormReadsIt) => boolean): string[] {
  return everySpell()
    .filter(([, spell]) => keep(spell))
    .map(([name]) => name);
}

/** The spells named, by school: each school in the order its first spell comes, its spells in the order named. */
function bySchool(names: readonly string[]): Record<string, string[]> {
  const spells = everySpell();
  const schools: Record<string, string[]> = {};
  for (const name of names) {
    const school = spells.find(([n]) => n === name)?.[1].school;
    if (school !== undefined) (schools[school] ??= []).push(name);
  }
  return schools;
}

/** Every spell by school (white, psychic, illusory, elemental, necromancy), each school's in the content's order. */
export function everySpellBySchool(): Record<string, string[]> {
  return bySchool(theSpellsThat(() => true));
}

/** The school of each spell, by its name, school by school as everySpellBySchool lists them. */
export function theSchoolOfEachSpell(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(everySpellBySchool()).flatMap(([school, spells]) => spells.map((name) => [name, school])),
  );
}

/** The raw level in its school each mastery spell needs (7 or 9), by its name: past level 5 comes from experience
 *  only. A spell not here needs none. */
export function theLevelEachMasterySpellNeeds(): Record<string, number> {
  return Object.fromEntries(everySpell().flatMap(([name, spell]) => (spell.reqLevel ? [[name, spell.reqLevel]] : [])));
}

/** The action spells (a Cast Spell order may name them), in the content's order. */
export function theActionSpells(): Set<string> {
  return new Set(theSpellsThat((spell) => spell.phase));
}

/** The action spells no mastery level gates, in the content's order: the ones the form offers a hero whose levels his
 *  realm can't see (hired, raised or charmed this turn). */
export function theActionSpellsNoMasteryLevelGates(): Set<string> {
  return new Set(theSpellsThat((spell) => spell.phase && !spell.reqLevel));
}

/** The order an Encounter plan lists the combat spells in. It is the content's but in three schools (Psychic Blast and
 *  Telekinetic Storm before Charm, Mirror Image before Invisibility, Curse and Hand of Death before Control Undead), and
 *  the content writes no other, so it is written here, once. Which spells are combat spells is the content's to say
 *  (`encounter`); each is named here (tests/unit/spells-the-order-form-offers-and-where-their-marks-must-stand.test.ts
 *  lists them). */
const THE_ORDER_AN_ENCOUNTER_PLAN_LISTS_THE_COMBAT_SPELLS: readonly string[] = [
  'Holy Symbol',
  'Spiritwrack',
  'Psychic Blast',
  'Telekinetic Storm',
  'Charm',
  'Mirror Image',
  'Invisibility',
  'Lightning Bolt',
  'Fireball',
  'Curse',
  'Hand of Death',
  'Control Undead',
];

/** The combat spells (an Encounter plan may name them) by school, as an Encounter plan lists them. */
export function theCombatSpellsBySchool(): Record<string, string[]> {
  return bySchool(
    theSpellsThat((spell) => spell.encounter).sort(
      (a, b) =>
        THE_ORDER_AN_ENCOUNTER_PLAN_LISTS_THE_COMBAT_SPELLS.indexOf(a) -
        THE_ORDER_AN_ENCOUNTER_PLAN_LISTS_THE_COMBAT_SPELLS.indexOf(b),
    ),
  );
}

/** The action spells aimed at a province (the order names the province), in the content's order. */
export function theActionSpellsAimedAtAProvince(): Set<string> {
  return new Set(theSpellsThat((spell) => spell.phase && spell.target === 'province'));
}

/** The action spells aimed at a hero (the order names the hero), in the content's order. */
export function theActionSpellsAimedAtAHero(): Set<string> {
  return new Set(theSpellsThat((spell) => spell.phase && spell.target === 'character'));
}
