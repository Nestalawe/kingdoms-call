# A row of a stack: from its branch to its report, and the proof it gives

Each row of a tranche is one pull request, built by its own agent on the row before
([building a tranche as a stack](../architecture/making-a-change-the-six-kinds-and-the-plans-format.md#building-a-tranche-as-a-stack)).
The agent goes through steps 3 to 10 of the skill `making-a-change` as its row's kind, from the brief the conductor
gives it: the row's line of the plan, its base, and the row before's report. This file adds what a row does beyond the
skill. The rules themselves are in [CLAUDE.md](../../CLAUDE.md#rules).

## Starting

1. `git fetch origin`, then `git switch -c <branch> origin/<base>`. The base is the stack's top branch, named in the
   brief; if it isn't the top open pull request of the stack, stop.
2. Read in [CLAUDE.md](../../CLAUDE.md#read-in-this-order)'s order, then the row's line and the row before's pull
   request (follow its pattern).
3. **A brief's figures go stale within a run** (the bytes left in a budget, a ratchet count): the row before's report
   gives today's. Recount them on your base.

## Building

- **Do what the row's line says, and only that.** A `refactor-only` row moves and doesn't improve: the same statements,
  the same order, the same random draws, and both balance sets identical, their writes too. It changes no saved shape
  ([traps.md](../traps.md#a-change-to-the-saves-shape-needs-its-version)).
- **Two copies of a rule that disagree:** that part stays as it is, and the question goes to the maintainers
  ([scoping](scoping-a-tranche-and-deciding-a-fork-in-a-run.md#scoping-measure-before-deciding), point 6).
- **Before writing a second copy of a check to get round an import cycle,** find a home both files can import
  ([traps.md](../traps.md#a-constant-read-at-load-time-must-live-in-a-leaf-module)).
- **Keep every count another step owns as it is on the base.** A count that falls by itself is lowered in the same
  pull request (CLAUDE.md) and named first under `CHOICES MADE WITHOUT A MAINTAINER`.
- **A bug found on the way is its own pull request.** Give it its backlog row in the same sitting (a `KD-` row in
  [Not yet assessed](../backlog/README.md#not-yet-assessed)), and leave the
  code as it is.
- **Read `.github/dangerous-paths` itself** and name every path of it the pull request touches: it lists more than
  `supabase/` and `.github/` (the harness's tests, `tools/balance/`, `.claude/`, the configs).
- **Edits under `.claude/` are refused** in an agent's session. A row that would rename or delete a path searches
  `.claude/` first; text meant for a skill goes into the pull request for a maintainer to place. **A refused edit is reported,
  never made another way.**

## The proof a row gives

A refactor row's risk is a quiet change to a rule or a report line, and it hides in code no matrix game reaches. The
matrix and the leak checks are cheap and strong on the code they reach; a row's own proof earns its keep with the unit
cases it leaves on code they don't. So each row gives the tier its change needs.

| Tier | When | The proof |
|---|---|---|
| **0** | Every row | CI green (the compiler, lint, `npm test`, the browser specs); for `refactor-only`, both balance sets and every realm's report identical; the balance comment on the head commit |
| **1** | A value can change: a statement rewritten (`??` for `\|\|`, a narrowed read, a guard dropped, a rule moved into the registry, a draw moved) | Tier 0, and **a unit case for each changed line no matrix game reaches**, red on a planted fault in that line, or listed by name as made sure by the code. Annotations, a moved type or an import need no tier 1: the compiler is their proof |
| **2** | A line's words, kind, fact or audience changes, or anything players or the maintainers read | Tier 1, and the GM log byte for byte the same in every matrix game, and a comparison of the two engines (or a construction check) over the kinds no game reaches, none differing |

**Planting, for tier 1:** make one throwaway copy of the row's tree, with `node_modules` linked in, never the row's own
tree. For each fault: plant it, run only the tests that guard that line (`npx vitest run <files>`), note red or green,
and put the copy back. Don't replay the balance matrix for a plant. A plant that stays green is never left silent
([tests/README.md](../../tests/README.md#proving-it-fails-first)). Plants in code the matrix reaches are covered by
the stack's [mutation session](a-mutation-session-faults-made-on-purpose-and-the-tests-they-leave.md), not by the row.

## What goes first under `CHOICES MADE WITHOUT A MAINTAINER`

Each with why no value changes:
- a guard that changes when a call is made, not only its type; a call moved earlier or made more often; a pure read, or
  a pass on no matrix state;
- a new throw in code every game reaches;
- a count that fell by itself;
- a file beyond the row's own: a config (`eslint.config.js`, `knip.ts`), `tests/ratchet.json`,
  `eslint-suppressions.json`, a dangerous path the row's line doesn't name;
- a proof read another way than the row's line words it.

## The pull request

- **A draft**, titled as the row's line says, using the template, every section. Its first line, unless its base is
  `main`: "**Stacked on #N** (`<base>`): merge #N first. `merges-into-main` stays red until #N merges."
- **A `refactor-only` row's top half is one line:** "code reorganised; the game is exactly the same".
- **The lower half is a record, not a read:** each section a line or a short list of facts (what changed by hand and
  what was generated; the proof, its tier and its figures; each test moved, retired or added, with its level and
  whether it fails without the change; the ratchet counts). No figure twice.
- **A figure goes in only once the run that measures it has finished.** Until then, write "(running)".
- **The Staging section stays full.** On a row that needs staging, the numbered list has each realm give real orders
  (each hero an order, an encounter plan with a duel stance), never an empty turn.
- **Open it without labels, and add them after:** a label is a run of its own, and a pull request opened with one gets
  two runs on one commit, the first cancelled.

## Before it finishes

1. **Each check once.** While working, run the tests being changed. Once the row is done, `npm run check`; then
   **`npx eslint .` over the whole tree**, which the check doesn't do
   ([tests/README.md](../../tests/README.md#the-quick-check-the-ratchet-and-ci)); then what the check didn't run
   (`npm test`, `npx playwright test`, both balance sets, the access-rule tests if `supabase/` changed).
2. **CI counts on the head commit:** every run on it completed and successful (a run cancelled by a newer one aside),
   all but `merges-into-main` on a stacked row. **The balance comment can post a minute after CI is green**: read the
   comments again before saying there is none. A row whose files are on no engine path gets no comment: read CI's
   balance jobs and the row's own run of both sets. A stack whose base has just moved to `main` needs one more look
   ([traps.md](../traps.md#a-stacked-pull-request-merges-into-its-base-branch-not-main)).
3. **Leave nothing running** (a watch, a monitor, a background test): it dies with the session. Wait for it, or say
   that it wasn't run.
4. **Shell habits:** a check piped into `tail` hides its exit code (run it on its own, or read `PIPESTATUS`); zsh reads
   `$B:t…` as a modifier, so write `"${B}:tests/…"`; `node_modules` is what was installed for the branch it was
   installed on, so a branch beside the stack with another lock file needs its own `npm ci` (CI installs from each
   branch's own lock).

## The report

The row's last message is this report and nothing else:

```
ROW: <id>
RESULT: done | stopped
PR: #<n> (branch <branch>, base <base>)
BALANCE: set A <…>; set B <…>
CI: <green but merges-into-main | what failed>; balance report <its verdict, or "none posted">; staging <link, or "not this row">
TESTS: <totals>; browser <n passed>; moved <n>, retired <n>, new <n>
PROOF: <the proof, its figure and its tier>
CAUGHT BEFORE THE PR: <what the proof caught in the row's own change, or nothing>
RATCHET: <counts changed and why>
DECIDED BY THE RUN: <each fork decided by the check, or none>
CHOICES MADE WITHOUT A MAINTAINER: <each, or none; the kinds above first>
QUESTIONS FOR THE MAINTAINERS: <each, or none>
STOP REASON: <only if stopped>
DEFECTS FOUND: <titles, or none>
FOR THE NEXT ROW: <one or two lines, or none>
```

`CAUGHT BEFORE THE PR` tells, over a few tranches, which layers earn their keep. A row stops, rather than guess, when
the matrix isn't identical on a `refactor-only` row and an hour doesn't find why (the baseline is never updated there),
or when it can't pass without a change its line doesn't name and [the fork check](scoping-a-tranche-and-deciding-a-fork-in-a-run.md#deciding-a-fork-in-a-run-instead-of-stopping)
doesn't allow one.
