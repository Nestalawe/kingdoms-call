// The world each creed is made in: its wild country, its first skills and one realm a game (plan P1-19's alignment
// abilities family, row P1-19ay1). Each reads its abilities' rows, the sites' table or the ladder
// (src/content/alignment-abilities-their-keys-names-numbers-and-words.ts), not the registry's runner: world creation
// asks them once, at no stage of a turn, and the player portal shares the last (src/shared/: the join form), and this
// folder may import only src/content. Their registry entries have no stage (the registry's unit test lists them).
import {
  ALIGNMENT_ABILITIES,
  THE_LADDER_OF_THE_ALIGNMENTS,
  THE_SITES_OF_THE_WORLD,
  type AlignmentAbilitySlug,
} from '../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import type { KC_SKILLS } from '../../content/kingdoms-call-data.ts';

/** The rows of the list of the alignment (as the old checks' `===`: an alignment no row holds, or none, holds none). */
const theAbilitiesOfTheListOf = <S extends AlignmentAbilitySlug>(theList: readonly S[], theAlignment: unknown): S[] =>
  theList.filter((slug) => ALIGNMENT_ABILITIES[slug].alignment === theAlignment);

/** Whether a realm of the alignment in the game lets world creation place the ritual stones (with none, no die is
 *  drawn for them). */
export const doTheRitualStonesStandWithARealmOf = (theAlignment: unknown): boolean =>
  THE_SITES_OF_THE_WORLD['the-ritual-stones'].theAlignmentThatMustBeInTheGame === theAlignment;

/** Whether a capital of the alignment opens beside a primal forest or jungle with ritual stones. */
export const doesACapitalOfTheAlignmentOpenBesideTheRitualStones = (theAlignment: unknown): boolean =>
  theAbilitiesOfTheListOf(['a-pagan-capital-opens-beside-the-ritual-stones'], theAlignment).length > 0;

/** Whether a capital of the alignment opens beside Creatures (and has them within two provinces). */
export const doesACapitalOfTheAlignmentOpenBesideCreatures = (theAlignment: unknown): boolean =>
  theAbilitiesOfTheListOf(['a-druidic-capital-opens-beside-creatures'], theAlignment).length > 0;

/** Whether a capital of the alignment opens beside Monsters (and has them within two provinces). */
export const doesACapitalOfTheAlignmentOpenBesideMonsters = (theAlignment: unknown): boolean =>
  theAbilitiesOfTheListOf(['an-evil-capital-opens-beside-monsters'], theAlignment).length > 0;

/** A skill a king starts with, a level more: its key and the levels. */
export interface ASkillAKingStartsWith {
  readonly theSkill: (typeof KC_SKILLS)[number];
  readonly theLevelsMore: number;
}

/** The skill a king of the alignment, or an heir crowned later, starts with a level more, or none (a realm of no
 *  creed, or of one that gives none). */
export function theSkillAKingOfTheAlignmentStartsWith(theAlignment: unknown): ASkillAKingStartsWith | undefined {
  const [slug] = theAbilitiesOfTheListOf(
    [
      'a-divine-king-starts-with-white-magic',
      'a-druidic-king-starts-with-druid',
      'an-evil-king-starts-with-druid',
      'a-pagan-king-starts-with-explorer',
      'an-undead-king-starts-with-necromancy',
    ],
    theAlignment,
  );
  if (slug === undefined) return undefined;
  const row = ALIGNMENT_ABILITIES[slug];
  return { theSkill: row.theSkillItGives, theLevelsMore: row.theNumbers.theLevelsMore.value };
}

/** Whether a king of the alignment starts with a skeletal company besides his realm's own. */
export const doesAKingOfTheAlignmentStartWithASkeletalCompany = (theAlignment: unknown): boolean =>
  theAbilitiesOfTheListOf(['an-undead-king-starts-with-a-skeletal-company'], theAlignment).length > 0;

/** The skill a wandering hero of the alignment is dealt if his deal didn't give it him, or none. */
export function theSkillAWandererOfTheAlignmentIsSureOf(theAlignment: unknown): string | undefined {
  const [slug] = theAbilitiesOfTheListOf(['a-druidic-wanderer-knows-the-druids-craft'], theAlignment);
  return slug === undefined ? undefined : ALIGNMENT_ABILITIES[slug].theSkillItGives;
}

/** The wandering heroes' deck of alignments: each rung's cards, in the ladder's order (the deal draws by it). */
export const theWanderingHeroesDeckOfAlignments = (): string[] =>
  THE_LADDER_OF_THE_ALIGNMENTS.theRungs.flatMap((rung) =>
    Array<string>(rung.theWanderersCardsInTheDeck.value).fill(rung.alignment),
  );

/** The alignments only one realm a game may hold, in their rows' order (Divine, then Undead). */
export const theAlignmentsOnlyOneRealmAGameMayHold = (): string[] =>
  (['one-divine-realm-a-game', 'one-undead-realm-a-game'] as const).map((slug) => ALIGNMENT_ABILITIES[slug].alignment);
