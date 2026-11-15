# Who does what: the roles, the review by kind, who merges, and the owner's keys

## The roles

This table is the one place the docs name the people. Everywhere else they say "a maintainer", "the maintainers", or
"the owner" where only the owner holds the rights ([the owner's keys](#the-owners-keys-)).

| Role | Who | In one line |
|---|---|---|
| **A maintainer, and the owner** | Toby (GitHub `Nestalawe`) | Designs the game, is its GM and sends most batches; owns the GitHub repository, the Supabase account and every setting; approves every production database change |
| **A maintainer** | Theo (GitHub `crumblingworld`) | Reviews security, database, CI and deploy changes; runs the backlog's steps with agents |
| **Agents** | Claude Code sessions, in a maintainer's account | Do the engineering: code, tests, docs, pull requests |
| **CI** | GitHub Actions | Runs every check, deploys staging and the live site, applies a migration once the owner approves it |

The repository is on the owner's personal GitHub account. Collaborators can push branches and review, but only the
owner can change its settings: GitHub gives no admin rights to collaborators on a personal account's repository, and
moving it to an organisation would change the live site's address.

**The maintainers share the work.** Either decides, answers, reviews and merges, and either can do any step or start
an agent on it, except the owner's keys (below). Both streams use the same CI, the same staging site (the `staging`
label says whose pull request is on it) and the same rules in [CLAUDE.md](../../CLAUDE.md).

| Stream | Started by | Pull request title | Branch | Commits |
|---|---|---|---|---|
| The batches | A maintainer | `Batch 2026-10-03: naval retreat, wages, contrast…` | `batch/2026-10-03` (the day it opens) | One an item: `Item 3: <short title>`; an item that isn't ready is split out, so the batch isn't held |
| [The backlog](../backlog/README.md)'s steps | A maintainer | `[P0-13] Per-environment config` | `p0-13-per-environment-config` | As the step needs |

A draft pull request titled `[P` is a step in progress.

## Who merges

**A maintainer merges; agents never** ([the decisions](../decisions/README.md#the-decisions-on-how-the-work-runs)).
An agent opens the pull request as a draft, says what it needs, and stops. A stack merges as one group, from its top
([a tranche](../architecture/making-a-change-the-six-kinds-and-the-plans-format.md#building-a-tranche-as-a-stack)).
If something is wrong after a release, **Revert** on the pull request puts the previous version back; an agent prepares
the revert when it isn't one click.

## The review, by kind of pull request

Every pull request is reviewed by the skill `the-review-before-a-batchs-pull-request` before it opens, whatever its
kind. Then:

| Kind | Who looks | What they read |
|---|---|---|
| **A batch, or a fix players notice** | A maintainer | The top half in game terms, the playtester notes, the balance report; staging when the pull request says it is needed |
| **A refactor, or a row of a stack** | A maintainer | The Staging section, CI on the head commit, the open code-scanning alerts. The lower half is a short record; for intent and impact they ask for [an explanation](explaining-a-pull-request-its-intent-and-its-impact.md) |
| **Maintainer ✓: security, the database, CI and deploy, the harness, who can see or change data** | The maintainers talk it through before the merge (D-07) | The whole change. A dangerous path gets a warning comment that never blocks the merge; the list is read from the pull request's base branch, so an edit to it affects later pull requests only ([CLAUDE.md](../../CLAUDE.md), "Dangerous paths") |
| **A database change** | A maintainer reviews it; the owner approves it going live | The migration and its rollback; it is tried on staging first ([how a migration goes live](../../supabase/README.md#how-a-migration-goes-live)) |
| **An update of dependencies** | A maintainer | `package.json`, the lock file and `.github/` are dangerous paths |

A security fix has a neutral title and description ([CLAUDE.md](../../CLAUDE.md#rules), "Never" 5).

## The owner's keys (🔑)

Only the owner can:
- change the repository's settings: Pages, the branch rules, the environments and their secrets, the security
  features;
- approve a production deployment or migration;
- touch the live Supabase project;
- change the owner's claude.ai Project.

A step, or part of one, that needs one of these is marked 🔑 in [the backlog](../backlog/README.md#how-to-read-a-row).
Whoever runs it, the agent does three things:
1. **Writes the owner a click-list:** short numbered steps in plain words, each saying where to click and what to
   see after it ([CLAUDE.md](../../CLAUDE.md#rules), "Never" 3).
2. **Checks the result** once the owner has clicked: through GitHub's API where the agent's access allows (`gh api`, read
   only), and from a screenshot the owner sends where it doesn't (an admin-only setting).
3. **Records what was checked, and how**, in the pull request or the step's row. A 🔑 step is done only once it is
   checked.
