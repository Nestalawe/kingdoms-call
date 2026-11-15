# The ways of working

How the people and the agents on Kingdoms Call work together: who decides, who reviews and merges, what never
changes, and the routines a run of agents follows. [CLAUDE.md](../../CLAUDE.md) holds the rules every session follows;
this folder holds what sits around them. Where `CLAUDE.md`, a ruling or a topic file already says something, these files
link to it.

## The files

- [Who does what: the roles, the review by kind, who merges, and Toby's keys](who-does-what-the-roles-the-review-by-kind-and-tobys-keys.md)
- [Private data: what is private, and how each kind is handled](private-data-what-is-private-and-how-each-kind-is-handled.md)
- [Scoping a tranche, and deciding a fork in a run](scoping-a-tranche-and-deciding-a-fork-in-a-run.md)
- [A row of a stack: from its branch to its report, and the proof it gives](a-row-of-a-stack-from-its-branch-to-its-report-and-the-proof-it-gives.md)
- [A mutation session: faults made on purpose, and the tests they leave](a-mutation-session-faults-made-on-purpose-and-the-tests-they-leave.md)
- [Explaining a pull request: its intent and its impact](explaining-a-pull-request-its-intent-and-its-impact.md)

Elsewhere: [the decisions](../decisions/README.md), [the rulings](../rulings/README.md),
[the questions waiting for Toby](../questions-for-toby.md), [the goal and the road](../the-goal-and-the-road.md),
[the backlog](../backlog/README.md), and how any change starts:
[making a change](../architecture/making-a-change-the-six-kinds-and-the-plans-format.md).

## What never changes

1. **Toby decides what the game is**, in plain language. A design fork goes to him as numbered options; his answer
   becomes a [ruling](../rulings/README.md).
2. **Nothing reaches live players without a merge by Toby or Theo**, and a database change also waits for Toby's
   approval ([how a migration goes live](../../supabase/README.md#how-a-migration-goes-live)). Agents never merge.
3. **Live games are never interrupted** by the work on the code.
4. **The same addresses, and the same two services:** static pages on GitHub Pages and a Supabase database. No new
   vendor.
5. **A GM's page runs each turn.** A server that runs them is deferred, with the reasons to start it sooner:
   [Phase 4](../the-goal-and-the-road.md#phase-4-turns-run-by-a-server).
6. **A test counts only once it has failed on the old build** ([CLAUDE.md](../../CLAUDE.md#rules), "Fail first").

## The standing reminders

- **No change to the live database by hand.** Every change goes through the pipeline. The one exception:
  [break-glass](../../supabase/README.md#break-glass-the-one-exception).
- **Approve a waiting migration promptly:** it holds every later deploy, site fixes included
  ([traps.md](../traps.md#a-migration-waiting-for-approval-holds-every-deploy)).
- **"Success" on a Deploy run doesn't mean it published.** After a merge, check that the `deploy` job succeeded and,
  10 minutes later, that the live `version.json` names the merged commit
  ([traps.md](../traps.md#a-job-after-a-skipped-job-is-skipped-unless-its-if-says-otherwise)).
- **A red nightly run blocks nothing.** Repeat it with its seed, then add a test
  ([tests/README.md](../../tests/README.md#what-each-level-is-for-and-what-the-tests-dont-do)).
- **One lane, and stacks for big work:** [the decisions](../decisions/README.md#theos-decisions-on-how-the-work-runs).
- Database and site changes in separate pull requests, and each ruling in the pull request that builds it:
  [CLAUDE.md](../../CLAUDE.md).
