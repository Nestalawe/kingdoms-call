# A saved game: its version, its upgrade, its check

A running game's save (`games.game_state`) holds what older builds wrote: its own copies of content and shapes the code
has moved on from ([traps.md](../traps.md#live-saves-keep-copies)). P1-15 brings every save up to date in one place before
the turn reads it.

- **The upgrade** (P1-15a): `upgradeGameState(save)`, in `src/engine/saves/upgrade-a-saved-game-and-check-it.ts`,
  typed. `resolveTurn` calls it on the save it has just parsed, before the turn's context is made. It runs the six
  passes the turn used to run at its start, in the same order: `migrateMaxHpV2` (which calls
  `migrateLairGuardiansV2`), `backfillHomeRosters`, `retireCorsairPools`, `retireDiscoveries`,
  `migrateLegacyUnitNames` and `migrateItemTiers` (until P1-15a the turn ran it after the merge of the realms' orders;
  nothing between reads an item's tier). Each pass runs on every turn and is safe to repeat; it also mends what the
  turn before wrote (a hero hired last turn gets his earned-HP pool).
- **It draws no dice and writes no line.** What it finds for the GM's log it returns (`WhatTheSavesUpgradeFound`: how
  many retired Sage discoveries it took, and the heroes of a save from before the earned-HP pool it carried over).
  `resolveTurn` keeps that on the turn's context (`whatTheSavesUpgradeFound`), and the stages at the turn's end tell
  it, as before. The save keeps none of it (until P1-15a the two passes kept their counts on the save until the turn's
  end deleted them).
- **Still in the turn** (P1-15's second slice brings them here, each with an old shape staged): the flagged passes
  before the first phase (`_lairNamesV3`, `_guardianHpV2`, the Library's), the turn-start repairs, the reads that write
  an old save's missing field, and the readers of older shapes. `ensureAllLairHoards` stays in the turn: it draws dice
  every turn.
- **What checks it:** `tests/unit/a-saved-games-old-shapes-are-mended-before-the-turn.test.ts` (each old shape staged on
  a new world and mended; the upgrade run twice equals once; a new world changes only by a known list) and
  `corsairs-retired` (the turn passes the loaded world through the upgrade, which calls the pass).
- **What the schema knows** (P1-15b): the saved state's schema (`src/schemas/saved-game-state.ts`) was written from the
  balance matrix's states, so it also names what only live play saves: the hero order the player portal sends with
  every submission (a realm's `heroOrder`), what the GM page writes between turns (`archived`, `archivedAt`,
  `_gmRemovedRealms`, a realm's `_gmRemoved`), and each mark the code keeps in the save (Sanctuary's, Veil's, a hidden
  lair's, …), each optional, with a comment saying what writes it. A mark a battle writes and wipes before the save
  (`_flakTargeted`, `_tacticalMult`, …) stays out, so the check finds one that leaks. What checks it:
  `tests/unit/the-fields-the-portal-and-the-gm-page-save-parse-strictly.test.ts`. The matrix's scripted realm sent no
  encounter plan and gave four kinds of order then, and its bots never give 13 of the engine's 48, so P1-15b2 added what a human realm's orders
  and those orders save: an encounter plan as the portal sends it and the merge keeps it (a duel stance, an Evil hero's
  conquest doctrine, `evilMode`; no bot's `_botStance`), every mastery order's once-a-turn stamp (the schema names
  every key of `MASTERY_ORDER_KEYS`), Release Hero's `_releasedBy`, a spied hero's entry, the Grand Design's fields, a
  win by elimination, a Wild Calling's beasts; and `botDiplomacy` is optional (games begun before 26 September lack
  it). What checks it: `tests/unit/the-fields-a-human-realm-and-the-rare-orders-save-parse-strictly.test.ts`. Since
  P1-15e2 the scripted realm sends what the portal sends (a plan for every hero, in the form's names; the matrix fails
  a game on a `[Save check]` line), so the matrix's games also save a human realm's plans, turn after turn; since
  P1-15e3 its spare heroes also give the form's other orders where they stand (Spy, Hire Hero with its card, Search
  Lair, Research, Practice Skill, Explore, Rest, a mastery at its level, Release Hero once a game), so the games save
  Release Hero's `_releasedBy` and a spied hero's entry too.
- **The version** (P1-15c): a save holds the number of its shape, `schemaVersion`, at its top level; a save without
  one is version 0 (every live save before P1-15c). Version 1 is the shape the six passes leave. The number this build
  writes is in `src/engine/saves/the-saved-games-version-this-build-writes.ts`, a file that imports nothing, so world
  generation writes it on a new world without loading the passes. `upgradeGameState` first refuses a save from a newer
  build, before anything changes (`resolveTurn` throws "Could not read the saved game: This game was saved by a newer
  version of Kingdoms Call (save version 2; this page knows 1). Reload this page.", and the shell puts the orders
  back); then, after the passes, it runs each numbered step (`THE_NUMBERED_STEPS_OF_THE_UPGRADE`, `{ version, upgrade
  }`) whose version is above the save's, and stamps the save with it. Version 1's step is the stamp alone. When to
  bump it: [traps.md](../traps.md#a-change-to-the-saves-shape-needs-its-version).
- **The fixtures** (P1-15c): `tests/fixtures/saves/version-<n>.json`, one per version, each a made-up game of three
  bot realms after its third turn, one line of JSON (about 0.3 MB), made by
  `tools/saves/make-a-save-fixture-from-a-seeded-bot-game.ts` with the build of its day (version 0 by P1-15c's base),
  never edited once merged. What checks them: `tests/unit/every-save-fixture-upgrades-parses-and-plays-a-turn.test.ts`
  (each fixture upgraded to this build's version, parsed strictly, upgraded twice as once, a turn played on it with its
  invariants; one fixture per version; a newer save refused; a new world at this build's version).
- **The check** (P1-15d): last, `upgradeGameState` parses the upgraded save against the saved state's schema made
  strict (`src/schemas/where-a-saved-game-differs-from-this-builds-schema.ts`), so a key the schema doesn't know is
  found, not dropped. It returns each place the save differs (`whereTheSaveDiffersFromThisBuildsSchema`), by its path and
  its kind, never a value: `characters.17.armies.2: a field this build doesn't know, _flakTargeted`; a key that isn't a
  number or a name as code writes one is shown as "(a key)". **The check is not the save**: the turn plays the save as
  upgraded, every key kept, never the parse's output ([traps.md](../traps.md#the-check-is-not-the-save)). How a save that
  differs is met is Theo's Choice 1, "tell now, stop later": the turn runs; its end tells the GM in one line of the GM's
  log, which no realm reads (`[Save check] The saved game holds 1 thing this build of Kingdoms Call doesn't know, …`);
  `resolveTurn` returns the list, and the shell's message says the same (at most ten places, then a count;
  `src/engine/saves/what-the-saves-check-found-in-words.ts`), and shows it again once the page has refreshed the game.
  A save that isn't a game in play (no provinces, no realms, no list of heroes: the new game's settings before Turn 0)
  is refused first, before anything changes, as a newer save is. Once every live game has run two weeks of turns with
  no place reported, a pull request of its own turns a difference into a stop. What checks it:
  `tests/unit/a-save-the-check-refuses-still-plays-and-the-gm-is-told.test.ts` (the version-1 fixture: as it is, with
  a leaked mark, with a field of a later build, each kind, ten then a count, the refusals) and the page test
  `tests/page/turn-shell.test.ts` ("the GM page plays a turn from a version-0 save": the message, after the refresh
  too; Turn 0 then two turns). The balance matrix fails a game on a `[Save check]` line and on the check of its last
  save (P1-15e1, [below](the-toolchain-the-checks-and-the-harness.md#tests)). The GM page's bundle grew by Zod and the schemas: 2,268,926 → 2,479,486 bytes
  (P1-15d).
