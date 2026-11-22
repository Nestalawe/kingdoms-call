# The minor titles' registry: its hook points, and how to add a perk

The rule registry is described in [the rule registry and the one source for shared rules](the-rule-registry-and-the-one-source-for-shared-rules.md).
This file is its part for the minor titles: the twenty honorary titles that count for no victory, each giving its
holder a small perk (B-06, T7, the rules pulled out: its Reckoning and titles family, from B-06i), the
Imperial Titles' measures (B-06n) and [the Imperial Titles' effects](#the-imperial-titles-effects) (from B-06o).

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

## The Imperial Titles' measures

The thirteen Imperial Titles count for victory; each is a row of `TITLE_DEFS` (`src/content/kingdoms-call-data.ts`,
its key `_titleHolders`' saved key), whose `howTheHolderIsFound` says who holds it. **A title of the realm**
(`kingdomLevel`) goes to the realm highest by its figure, its tax base or its treasury (the lowest seat on a tie, its
king named). **A hero's title** goes to the living hero of a realm highest by his merit (the first found on a tie):
his level of a skill (raised by his items, to 9) plus a count of his deeds (`tm`), the Cartographer's in tens (rounded
down); his deeds alone; or the Archmage's levels in the five schools plus each item he uses that raises one. A figure
or a merit of 0 leaves it vacant. The Grand Marshal's and the Sea Lord's rows name the battles their deeds count, on
land or at sea, which `creditBattle` credits; a fallen hero keeps content's
`KC_THE_SHARE_OF_HIS_TITLE_MERIT_A_FALLEN_HERO_KEEPS` of each count, rounded. The standings (`computeStandings`), the
title race (`titleRaceFor`) and `_charTitleMerit` read the rows on plain values
(`rules-on-plain-values/the-merit-a-hero-or-the-figure-a-realm-holds-an-imperial-title-by-as-its-row-measures-it.ts`).
The measures are no hook point: each is the row's data, read by one function, as a minor title's measure is; no title's
measure is an effect of its own.

## The Imperial Titles' effects

An Imperial Title's effect is an entry in `src/engine/rules/the-registry-of-the-imperial-titles-effects.ts`, keyed by
its row's key: `AnImperialTitlesSlug`, the type of each key of `TITLE_DEFS`, beside the rows. The registry ends
`satisfies Record<AnImperialTitlesSlug, TheEffectsOfAnImperialTitleAtEachHookPoint>`, both ways (the compile test),
and its order test holds the entries to the rows and each stage's order to the rows' order.

- `turnEnd`, four stages, **an Imperial Title's board**: what the title intelligence tells the realm holding a title
  each turn, once titles are public (`imperialTitleIntelEachHoldersReportOnRivalRealmsAndTheLoremastersCopy`,
  `src/engine/titles/`). Every title is in one stage, and the stages run in this order, each in TITLE_DEFS' order:
  **the board an Imperial Title of the realm shows its holder** (the Throne, the Vaultkeeper); **the board a hero's
  Imperial Title shows of each realm's heroes and lore** (the Grand Marshal, the Sea Lord, the Monster-Bane, the
  Loremaster, the Archmage); **the board a hero's Imperial Title shows of the fallen and of the spies in his lands**
  (the Hierophant, the Deathpriest, the Spymaster); **the board a hero's Imperial Title shows his realm** (the
  Cartographer, the Beastlord, the Wildwarden). The boards are a turn's-end stage, not `visibility`'s: they are
  written once a turn, after the final reconcile, where `visibility`'s stages say whether one thing is seen when it is
  asked.
- **An effect** is handed the holder's seat, the world as its board reads it, the standings and whether he has met a
  realm. It returns its board (`TheBoardOfAnImperialTitle`): its lines' facts, in its block's old order; for the
  Loremaster, the fresh discoveries his scholars may copy; for the Deathpriest, what his Grave-sight files before each
  line. It draws no die and writes nothing. Each file of effects declares its lines' kinds
  (`src/engine/rules/the-imperial-titles/`).
- **The runner** (`theBoardsOfTheImperialTitlesAtAStage`) asks who holds each title of the stage, in its order, and
  hands each held title's board to the title intelligence before it asks the next. The title intelligence writes each
  line for the holder's realm alone, filing each Grave-sight find just before its line. Then it draws the Loremaster's
  copy, the one die of the title intelligence, and adds it to his realm. Last, it writes the line for the realms the
  holder hasn't met, at every stage but the fallen's and the spies'.

## The hook points

An entry acts only at the hook points `TheHookPointsAMinorTitlesPerkActsAt` names, each filled by a row of the
family, every title's perk at its stage. The runner of a stage asks its caller who holds a title (a function, asked
only of a title that acts), by the holders worked out at the turn's start (`charMinor` and its kin) or the report's own. The stages are
the shared hook points' (`TheStagesOfEachHookPoint`), as the rule registry's guide has them: a title's strength in a
battle is a stage of `strength`, beside the commander's items.

- `personalCombat`, **a hero's titles add to his skills**: the Duelist (Melee), the Marksman (Archery), the
  Widowmaker and the Relic-Hunter (both) add their levels to his Melee and his Archery in a personal combat, their raw
  levels too, after his items and before his realm's discoveries, under the ceiling of 9 (`pcCharCombatant`, through
  `theLevelsAHerosTitlesAddToHisSkillInAPersonalCombat`). Each effect reads its levels from its title's rows of
  `SKILL_EXTRA_MINORS` of scope `'combat'`, which the hero's card (`extraSkillBonuses`) reads too
  (`src/engine/rules/the-minor-titles/a-heros-titles-add-to-his-skills-in-a-personal-combat.ts`).
- `strength`, two stages (`src/engine/rules/the-minor-titles/a-heros-titles-add-to-his-tactical-and-lift-the-units-he-leads-in-a-battle.ts`).
  **A hero's titles add to his Tactical**: the Strategist adds his levels from his title's rows of `SKILL_EXTRA_MINORS`
  of scope `'battle'`, wherever a battle reads a commander's Tactical (`commandScore`, both sides of both battles),
  before a curse halves it (`theLevelsAHerosTitlesAddToHisTacticalInABattle`). **The commander's minor titles**: the
  Naturalist, the Beastmaster, the Cavalier and the Ironclad lift the companies of their kind he leads, each by its
  row's `theCompaniesItsHolderLeadsFightStronger` (the kind, ×1.05, the perk), each step rounded before the next, a
  perk two titles give (the Naturalist's and the Beastmaster's) once (armStr, after his Druid mastery, through
  `theStrengthOfAUnitOnceItsCommandersMinorTitlesLiftIt`). The step and its product are on plain values
  (`rules-on-plain-values/the-quality-a-commanders-druid-8-or-necromancy-6-lifts-a-unit-to-and-the-minor-titles-army-perks.ts`),
  which the army card reads too; the stage's order is content's `THE_ORDER_THE_MINOR_TITLES_ARMY_PERKS_LIFT_A_UNIT_IN`,
  beside the rows, which both read (a title given the perk in its row joins it).
- `movementCost`, `orderValidity` and `orderOutcome`, a stage each perk
  (`src/engine/rules/the-minor-titles/a-heros-titles-on-a-march-and-on-an-order.ts`). **A hero's titles add to his
  move points** (movementCost): the Swift adds his levels to the land pool, the Sea-Wolf to the sea pool, each only
  where the pool exists, from their rows of `SKILL_EXTRA_MINORS` of scope `'move'` (March, Naval)
  (`computeMovePoolMax`, through `theMovePointsAHerosTitlesAddToHisPool`). **A hero's titles add to the casts he may
  make in his best school** (orderValidity): the Warlock's row's
  `theSpellsMoreItsHolderMayCastInHisBestSchoolEachTurn` (`resolveCastSpellOrder`, through
  `theCastsAHerosTitlesAddInHisBestSchool`). Four of orderOutcome: **keep his spying unseen**, the Shadow (no roll to
  catch him spying on a hero, a false face on a province: `resolveSpyOrder`, `aHerosTitlesKeepHisSpyingUnseen`);
  **add to his Sage in research**, the Loreseeker's level from his rows of scope `'order'`, worth a Sage level's 5
  (`resolveResearchOrder`); **add to a rest's heal**, the Colossus's row's
  `theHitPointsItsHolderRecoversMoreWhenResting` (`resolveRestOrder`, before the discoveries'); **multiply the share
  of a province he maps**, the Trailblazer's row's `theShareOfAProvinceItsHolderMapsIsMultipliedBy`, before the
  discoveries' factor and the rounding down (`resolveExploreOrder`). The casting limit and the share mapped stay rules
  on plain values: the order hands them what the registry gives
  (`actionSpellsAHeroMayCastInASchoolEachTurnWithTheCastsHisTitlesAdd`,
  `theShareOfAProvinceAnExploreOrderMapsByHisTitlesFactor`); the bots and the order form still say whether he holds
  the Warlock or the Trailblazer, and the rule reads the one row that names the number.
- `turnEnd`, two stages, each entry naming the rule of the
  [economy's registry](the-economys-registry-its-stages-and-how-to-add-a-rule-of-the-economy.md) whose gold or cut its
  title gives; the numbers and the runs are that registry's
  (`src/engine/rules/the-minor-titles/a-heros-titles-at-the-turns-end-his-realms-gold-and-its-company-wages.ts`).
  **A hero's titles give his realm gold beyond its tax**: the Cutpurse, the Champion of the People and the Castellan,
  each its own rule's gold; the economy's runner asks, for each of its rules, whether he holds the title that gives it
  (`heHoldsAMinorTitleThatGivesHisRealmTheGold`). **A hero's titles cut his realm's company wages**: the Host-Leader,
  the hero whose companies the economy's cut counts (`aHerosTitlesCutHisRealmsCompanyWages`). Early Winter asks both
  with the turn-start holders, and the report's forecast with its own (the end-of-turn holders, once titles are
  public).

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
