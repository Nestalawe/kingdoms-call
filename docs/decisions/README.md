# The decisions

The decisions in force about the site and about how the work runs, one line each, with its date and where it applies.
Rules of the game are not here: they are Toby's [rulings](../rulings/README.md). Where a ruling or `CLAUDE.md` already
states a decision, its line links there and doesn't restate it.

## Toby's decisions, D-01 to D-13

Toby answered D-01 to D-07 on 2026-09-29, and D-08 to D-13 on 2026-10-11.

- **D-01:** a game's GM doesn't read players' private dispatches; a player can report one:
  [R-073](../rulings/R-073-private-dispatches.md).
- **D-02:** a realm that is out sends no private dispatches until the game is over, and the GM can also block its
  public ones: [R-075](../rulings/R-075-eliminated-realms-dispatches.md).
- **D-03:** the live database is on Supabase's paid plan, which takes a backup every day. Staging has its own free
  Supabase project ([staging](../staging.md)). When a backup matters: [how a migration goes
  live](../../supabase/README.md#how-a-migration-goes-live).
- **D-04:** 30 days after a game ends, its bulky turn logs are trimmed, keeping each player's reports, the final map,
  the Hall of Fame and the statistics. Before trimming starts, each player can download their chronicle (print, then
  save as PDF). Decided, not yet built (plan steps P2-11 and P2-12).
- **D-05:** a dispatch is at most 500 characters, and each player sends at most 10 a minute and 300 a day in each game:
  [R-074](../rulings/R-074-dispatch-limits.md).
- **D-06:** one pull request a batch, one commit an item: [CLAUDE.md](../../CLAUDE.md#how-work-arrives).
- **D-07:** security, database and cutover changes are talked through with Theo before they merge. Since Theo's
  amendment of 2026-10-09, nothing on GitHub enforces it: a pull request that changes a dangerous path gets a warning
  comment, which never blocks the merge ([CLAUDE.md](../../CLAUDE.md#dangerous-paths-talk-it-through-with-theo)).
- **D-08:** a GM finds players by name, never by email: [R-098](../rulings/R-098-players-found-by-name.md).
- **D-09:** a GM sees their own games' statistics, and the Overlord every game's:
  [R-099](../rulings/R-099-statistics-and-hall-of-fame-editing.md).
- **D-10:** a running or finished game is read only by its GM, its players and the Overlord. A game in setup is read by
  any signed-in account if it is public, or by the accounts it invites if it is private. It has no ruling file; where
  it is enforced: [another game reads as
  nothing](../architecture/the-database-and-what-it-holds.md#another-game-reads-as-nothing).
- **D-11:** only the Overlord renames a player on the Hall of Fame:
  [R-099](../rulings/R-099-statistics-and-hall-of-fame-editing.md).
- **D-12:** superseded by D-13 the same day. Players don't ask to become GMs; the Overlord offers it.
- **D-13 (a to h, and its four follow-ups):** the Overlord and the Game Masters:
  [R-097](../rulings/R-097-game-masters-and-the-overlord.md). Who reads private dispatches, and where a report goes
  when the GM plays (D-13g, follow-up 1): [R-073](../rulings/R-073-private-dispatches.md). Decided, its detail still
  Toby's to rule, and not yet built: a GM sees less of their own games, on screen (D-13d; plan step P2-15).

## Theo's decisions on how the work runs

- **Refactor first** (2026-11-01): first the refactor, then what Toby has ruled, then his batches. A refactor changes
  nothing in play. A row that can't be done without changing play, on a rule Toby hasn't given, stops and becomes a
  question for him ([the kinds](../architecture/making-a-change-the-six-kinds-and-the-plans-format.md#telling-the-kinds-apart)).
- **An inconsistency is asked, then fixed, never carried** (2026-11-01). Two places that state one rule and disagree
  are ours to find. Toby is asked, with both directions as options; his answer is fixed in its own pull request. Until
  then that part stays as it is: no switch, parameter or second path carries both
  ([traps.md](../traps.md#a-rule-written-twice-must-change-twice)).
- **One lane** (2026-10-16; from 19 November, 2026-11-13): one piece of work at a time on `main`. Batches come first,
  by day, each from `main`. Refactor runs go overnight only when no batch's pull request is open, and merge before the
  next batch starts. A batch never waits for a run.
- **Batch-ready** (2026-10-30): Toby's batches resume once the code is batch-ready, not at the end of Phase 1
  ([what it means, and where the work is](../the-goal-and-the-road.md#batch-ready)).
- **Live bugs first** (2026-10-16, again 2026-11-01): a bug Toby reports from live play is fixed in its own pull
  request from `main`, ahead of the next planned step, test first
  ([CLAUDE.md](../../CLAUDE.md#rules), "When something slips through").
- **Questions stored, asked in one sitting** (2026-10-21): every question for Toby that an agent finds is stored, with
  the fix it unlocks, in [the questions waiting for him](../questions-for-toby.md), so that he answers them together.
  Each fix is its own pull request after his answer. How a question is written: [CLAUDE.md](../../CLAUDE.md#rules),
  "Design forks go to Toby".
- **Type the whole codebase** (2026-11-08): every file is typed before Toby's redesign starts, so that its refactors
  are checked by the compiler. No new `@ts-nocheck` ([CLAUDE.md](../../CLAUDE.md#commands)); the files still marked
  are freed ([how](../architecture/freeing-a-file-of-its-ts-nocheck-line.md)).
- **Every rule into the registry, with a bot valuation hook** (2026-11-08): every rule that can live in the
  [rule registry](../architecture/the-rule-registry-and-the-one-source-for-shared-rules.md) moves there, its numbers in
  data and its effects named in rows. Each kind of effect gets a hook that tells the bots what it is worth, so that
  the bots follow a content change without new bot code. The hook is not yet built.
- **The regression matrix stays** (2026-11-08): the [balance matrix](../architecture/the-balance-matrix.md) stays as
  it is. It proves that a refactor changed nothing.
- **A separate design matrix** (2026-11-08): large and statistical, outside CI, it plays the engine alone for each
  option of a rule, and scores each against Toby's targets (Toby's document). Its size comes from a cost model,
  measured first. Not yet built.
- **The rulebooks rendered from content** (2026-11-08): the game as it is becomes a page rendered from the content
  and the registry, and the rulebooks' numbers are rendered from content, with no numbers written in prose. This
  supersedes the earlier choice of words tests over templates. Not yet built: until then, the words tests check the
  books' numbers.
- **Stacks** (2026-10-21; merged as one group, 2026-11-07): work too big for one pull request is a tranche, built as a
  stack with an agent a row, and merged as one group from its top
  ([a tranche](../architecture/making-a-change-the-six-kinds-and-the-plans-format.md#a-tranche-a-stack-of-pull-requests)).
  This supersedes the earlier rule of one pull request at a time, each from `main`.
- **Toby or Theo merges; agents never** (2026-11-14): [CLAUDE.md](../../CLAUDE.md#rules), "Never" 1.
- **Break-glass, the one exception** (kept 2026-11-14): when the live site is broken and the pipeline is too slow, Toby
  may run a pull request's rollback himself ([break-glass](../../supabase/README.md#break-glass-the-one-exception)).
