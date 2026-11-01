// The name of a spell, by its slug (plan P1-19an). The bots name a spell to cast it, to look for the cast in an order,
// or to put it in a list; they read its name here, from its row in the content (src/content/spell-effects-their-names-
// numbers-and-words.ts), instead of writing it. A slug the content doesn't hold throws, so a spell renamed or dropped
// from the content stops the bots at their first turn (the bots' files are untyped, so the compiler can't check it).
// tests/static/the-bots-name-no-spell.test.ts holds the bots' files to no spell's name.
import {
  ACTION_SPELLS_THE_REGISTRY_HOLDS_NO_EFFECT_FOR,
  SPELL_EFFECTS_THE_REGISTRY_HOLDS,
  type SpellSlug,
} from '../../content/spell-effects-their-names-numbers-and-words.ts';

/** A spell the content holds a row for, by its slug: the registry's rows and the action spells beside them. */
export type ASpellsSlugInTheContent = SpellSlug | keyof typeof ACTION_SPELLS_THE_REGISTRY_HOLDS_NO_EFFECT_FOR;

const THE_NAME_OF_EACH_SLUG = new Map<string, string>(
  [
    ...Object.entries(SPELL_EFFECTS_THE_REGISTRY_HOLDS),
    ...Object.entries(ACTION_SPELLS_THE_REGISTRY_HOLDS_NO_EFFECT_FOR),
  ].map(([slug, row]) => [slug, row.name]),
);

/** The name SPELL_DEFS_P keys the spell by (the name an order's `target` and a save hold), for the slug the content
 *  gives it. Throws for a slug the content doesn't hold. */
export function theNameOfTheSpell(slug: ASpellsSlugInTheContent): string {
  const name = THE_NAME_OF_EACH_SLUG.get(slug);
  if (name === undefined) throw new Error(`The content holds no spell with the slug "${slug}".`);
  return name;
}
