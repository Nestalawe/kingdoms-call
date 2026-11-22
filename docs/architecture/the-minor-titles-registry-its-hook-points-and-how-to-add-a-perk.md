# The minor titles' registry: its hook points, and how to add a perk

The rule registry is described in [the rule registry and the one source for shared rules](the-rule-registry-and-the-one-source-for-shared-rules.md).
This file is its part for the minor titles: the twenty honorary titles that count for no victory, each giving its
holder a small perk (B-06, T7, the rules pulled out: its Reckoning and titles family, from B-06i).

## What a minor title is

A **minor title** is held each turn by the one living hero of a realm who measures highest by it (the first found wins
a tie; a measure of 0 leaves it vacant). It is one row in
`src/content/the-minor-titles-their-keys-names-perks-requirements-and-how-each-holder-is-found.ts` and one entry in
`src/engine/rules/the-registry-of-the-minor-titles-perks.ts`, keyed by the same slug, the title's key (`'duelist'`).

- **A row** (`MINOR_TITLES`, a list) gives the key, the name, the perk and the requirement as players read them, and
  how its holder is found (`howTheHolderIsFound`: a skill's level, his maximum hit points, the companies he leads of a
  kind, and so on). **The list's order is the game's**: the report, the title intelligence and the view of each realm
  go through the titles in it, so their lines print in it. Append; never re-sort.
- **The key is a saved key**: the holders the turn works out (`_minorHolders`, a zod object with fixed keys in
  `src/schemas/saved-game-state.ts`) are saved by it, and each saved holder keeps the perk's name and words. Renaming a
  key changes the save's shape ([traps.md](../traps.md#a-change-to-the-saves-shape-needs-its-version)).
- **The skills a title adds to at their point of use** (`SKILL_EXTRA_MINORS`, beside the rows, in the character
  card's order) are what the card and the orders column show; each names a real engine site.
- **The measure** a hero is held to is the registry's `theMeasureAHeroIsHeldToForAMinorTitle`, which the awarding
  (`computeMinorTitles`, `src/engine/titles/reckoning.ts`) asks for each hero and title.
- **The registry** ends `satisfies Record<AMinorTitlesSlug, TheEffectsOfAMinorTitlesPerkAtEachHookPoint>`, both
  ways, as the other registries do: a title's row with no entry, or an entry with no row, fails to compile
  (`tests/static/the-rule-registry-fails-to-compile-when-an-effect-and-its-content-row-part.test.ts`), at its widened
  view `ENTRIES` too, which its runners read. Its orders are its own list, `THE_ORDER_OF_EACH_STAGE_OF_THE_MINOR_TITLES`.

## The hook points

An entry acts only at the hook points `TheHookPointsAMinorTitlesPerkActsAt` names, each filled by a row of the
family; a perk not yet at its stage is checked where it acts, by the holders worked out at the turn's start (`charMinor`
and its kin). The runner of a stage asks its caller who holds a title (a function, asked only of a title that acts).

- `personalCombat`, **a hero's titles add to his skills**: the Duelist (Melee), the Marksman (Archery), the
  Widowmaker and the Relic-Hunter (both) add their levels to his Melee and his Archery in a personal combat, their raw
  levels too, after his items and before his realm's discoveries, under the ceiling of 9 (`pcCharCombatant`, through
  `theLevelsAHerosTitlesAddToHisSkillInAPersonalCombat`). Each effect reads its levels from its title's rows of
  `SKILL_EXTRA_MINORS` of scope `'combat'`, which the hero's card (`extraSkillBonuses`) reads too
  (`src/engine/rules/the-minor-titles/a-heros-titles-add-to-his-skills-in-a-personal-combat.ts`).
- `strength` (B-06k): the Strategist's Tactical in a battle; the Naturalist, the Cavalier, the Beastmaster and the
  Ironclad lift the units their holder leads.
- `movementCost`, `orderValidity` and `orderOutcome` (B-06l): the Swift and the Sea-Wolf's movement points; the
  Shadow, the Loreseeker, the Trailblazer, the Colossus and the Warlock's orders.
- `turnEnd` (B-06m): the Host-Leader's cut of the wages. The Cutpurse's, the Champion of the People's and the
  Castellan's gold are the [economy's registry's](the-economys-registry-its-stages-and-how-to-add-a-rule-of-the-economy.md).

## What checks it

The compiler, both ways (above); each effect once in its stage's order, each row with its entry and no two rows' key
or name (`tests/unit/the-rule-registry-holds-each-effect-once-in-the-order-of-its-stage.test.ts`); and no title
named in a function the family's rows have taken (`tests/static/the-code-the-titles-rows-have-taken-names-no-title.test.ts`),
with, outside the registry, the ratchet's `titleChecksInEngine`, which only falls. Its vocabulary is every key and
name of `MINOR_TITLES` and `TITLE_DEFS`, read from content.

## How to add a perk

At a stage already written: its effect in the family's folder, `src/engine/rules/the-minor-titles/`, reading its numbers from its row; its stage in the title's entry and its place in the stage's order; and the title's check where it acted
(`charMinor(…, '<key>')`) replaced by the stage's runner. A new stage's signature goes into
`TheStagesOfEachHookPoint`, with its runner in this registry's file. A new title is a row (appended), an entry, and
its holders' key in the saved game's schema.
