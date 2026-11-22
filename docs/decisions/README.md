# The decisions

The decisions in force about the site and about how the work runs, one line each, with its date and where it applies.
Rules of the game are not here: they are the [rulings](../rulings/README.md). Where a ruling or `CLAUDE.md` already
states a decision, its line links there and doesn't restate it.

## The site's decisions, D-01 to D-13

A maintainer answered D-01 to D-07 on 2026-09-29, and D-08 to D-13 on 2026-10-11.

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
- **D-06:** one pull request a batch, one commit an item: [CLAUDE.md](../../CLAUDE.md#how-work-arrives). A batch's
  items go into the backlog too, each with its impact and its position, like any other work.
- **D-07:** security, database and cutover changes are talked through with a maintainer before they merge. Nothing
  on GitHub enforces it: a pull request that changes a dangerous path gets a warning
  comment, which never blocks the merge ([CLAUDE.md](../../CLAUDE.md), "Dangerous paths").
- **D-08:** a GM finds players by name, never by email: [R-098](../rulings/R-098-players-found-by-name.md).
- **D-09:** a GM sees their own games' statistics, and the Overlord every game's:
  [R-099](../rulings/R-099-statistics-and-hall-of-fame-editing.md).
- **D-10:** a running or finished game is read only by its GM, its players and the Overlord. A game in setup is read by
  any signed-in account if it is public, or by the accounts it invites if it is private. It has no ruling file; where
  it is enforced: [another game reads as
  nothing](../architecture/the-database-and-what-it-holds.md#another-game-reads-as-nothing).
- **D-11:** only the Overlord renames a player on the Hall of Fame:
  [R-099](../rulings/R-099-statistics-and-hall-of-fame-editing.md).
- **D-13 (a to h, and its four follow-ups):** the Overlord and the Game Masters:
  [R-097](../rulings/R-097-game-masters-and-the-overlord.md). Who reads private dispatches, and where a report goes
  when the GM plays (D-13g, follow-up 1): [R-073](../rulings/R-073-private-dispatches.md). Decided, its detail still
  for a maintainer to rule, and not yet built: a GM sees less of their own games, on screen (D-13d; plan step P2-15).

## The decisions on how the work runs

- **One lane** (2026-11-15): one piece of work open against `main` at a time. A stack is one piece.
- **What comes next is the top of [the backlog](../backlog/README.md)** (2026-11-15). An item's position comes from
  its impact (who notices, what changes in play or for the maintainers, what it unblocks, the risk of waiting),
  assessed against the rows around it, and a maintainer validates it. A batch's items and each ruling not yet built
  are backlog items too.
- **An inconsistency is asked, then fixed, never carried** (2026-11-01). Two places that state one rule and disagree
  are ours to find. The maintainers are asked, with both directions as options; the answer is fixed in its own pull request. Until
  then that part stays as it is: no switch, parameter or second path carries both
  ([traps.md](../traps.md#a-rule-written-twice-must-change-twice)).
- **Questions stored, asked in one sitting** (2026-10-21): every question for the maintainers that an agent finds is stored, with
  the fix it unlocks, in [the questions waiting for them](../questions-for-the-maintainers.md), so that they are answered together.
  Each fix is its own pull request after its answer. How a question is written: [CLAUDE.md](../../CLAUDE.md#rules),
  "Design forks go to the maintainers".
- **Type the whole codebase** (2026-11-08): every file is typed, so that the redesign's refactors are checked by
  the compiler. No `@ts-nocheck` ([CLAUDE.md](../../CLAUDE.md#commands)): lint refuses it in every TypeScript file
  ([why, and how code is typed](../architecture/freeing-a-file-of-its-ts-nocheck-line.md)).
- **Every rule into the registry, with a bot valuation hook** (2026-11-08): every rule that can live in the
  [rule registry](../architecture/the-rule-registry-and-the-one-source-for-shared-rules.md) moves there, its numbers in
  data and its effects named in rows. Each kind of effect gets a hook that tells the bots what it is worth, so that
  the bots follow a content change without new bot code.
- **The rule says what, the bot says how much** (2026-11-22): the bot asks the rule what an effect does, in a what-if
  (Bless Province: +6 gold this turn). A weights file for each bot version says what one unit of each kind of result is
  worth (a gold, a point of a host's strength, a skill point), keyed by the kind of result, not by the effect, and
  checked by the compiler (`satisfies Record<…>`), so a kind with no weight doesn't compile. Content holds rules only.
  T7 copies today's numbers exactly, the spells' fixed order included; weights by kind come after T7, the old bot
  played against the new. B-06h builds it for the economy, B-06r for the titles, P1-19bb8 for the alignments.
- **The regression matrix stays** (2026-11-08): the [balance matrix](../architecture/the-balance-matrix.md) stays as
  it is. It proves that a refactor changed nothing.
- **A separate design matrix** (2026-11-08): large and statistical, outside CI, it plays the engine alone for each
  option of a rule, and scores each against the design targets (the design document). Its size comes from a cost model,
  measured first. Not yet built.
- **The rulebooks rendered from content** (2026-11-08): the game as it is becomes a page rendered from the content
  and the registry, and the rulebooks' numbers are rendered from content, with no numbers written in prose. Not yet
  built: until then, the words tests check the books' numbers.
- **Stacks** (2026-10-21; merged as one group, 2026-11-07): work too big for one pull request is a tranche, built as a
  stack with an agent a row, and merged as one group from its top
  ([a tranche](../architecture/making-a-change-the-six-kinds-and-the-plans-format.md#a-tranche-a-stack-of-pull-requests)).
- **A maintainer merges; agents never** (2026-11-14): [CLAUDE.md](../../CLAUDE.md#rules), "Never" 1.
- **Break-glass, the one exception** (kept 2026-11-14): when the live site is broken and the pipeline is too slow, the owner
  may run a pull request's rollback himself ([break-glass](../../supabase/README.md#break-glass-the-one-exception)).

Batch-ready is not a decision: it is an outcome, and [the road](../the-goal-and-the-road.md#batch-ready) says it is met.
