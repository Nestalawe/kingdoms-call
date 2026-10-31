// ── Whether a spell's mark must stand in the caster's province (plan P1-11c2) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). This is the one check of the Cast Spell order the order form makes too (its target field lists a
// mark from the caster's province only), read from the spell's row in the content
// (src/content/spell-effects-their-names-numbers-and-words.ts). The spells' registry asks it (src/engine/rules/spells/
// the-checks-the-cast-spell-order-makes-of-a-spell.ts); src/shared/ hands it to the form from P1-11c4, the row in which
// the form asks it (until then the player page would load the rows' file and use none of it). The tables the form
// offers are beside it (spells-the-order-form-offers-each-school-aim-and-mastery-level.ts).
import {
  SPELL_EFFECTS_THE_REGISTRY_HOLDS,
  type ASpellAsItsTextsWriteIt,
} from '../../content/spell-effects-their-names-numbers-and-words.ts';

/** Whether the hero the spell named is aimed at must stand in the caster's own province, as its row in the content
 *  says (`asAnOrder.itsMarkMustStandInTheProvince`): one who has left is refused before the cast roll. A spell aimed at
 *  a province, Resurrect (its body's own rule), Clairvoyance (a scry from afar) and a name with no row need none. */
export function theMarkOfThisSpellMustStandInTheCastersProvince(theSpellsName: string): boolean {
  const everyRow: readonly ASpellAsItsTextsWriteIt[] = Object.values(SPELL_EFFECTS_THE_REGISTRY_HOLDS);
  const row = everyRow.find((r) => r.name === theSpellsName);
  return row?.asAnOrder?.itsMarkMustStandInTheProvince === true;
}
