# The backlog

Every open item, in one list: what it delivers, its impact, the outcome it serves, its size, who must look at it, and
where it is. What comes next is the top of the list ([the decision](../decisions/README.md#the-decisions-on-how-the-work-runs));
each outcome is in [the goal and the road](../the-goal-and-the-road.md). The list runs in four parts:
1. [**The top, in order**](#the-top-in-order): the next rows, grouped by tranche, each with why it is there.
2. [**Next**](the-next-group-the-rebuilds-other-rows.md): the rebuild's other rows, to place
   in the top soon.
3. [**Later**](the-later-group-what-serves-a-later-outcome-or-waits.md): first the rulings and the known defects,
   with [the rulings to build](the-rulings-decided-not-built.md); then the rows that serve a later outcome, or wait.
4. [**Not yet assessed**](#not-yet-assessed): rows whose impact no one has described yet.

Finished items are a record, in four files: [Phase 0, and P1-01 to P1-10](finished-steps-phase-0-and-p1-01-to-p1-10.md),
[P1-11 and P1-12](finished-steps-p1-11-and-p1-12.md), [P1-13 to P1-25](finished-steps-p1-13-to-p1-25.md) and
[the new items (B-NN)](finished-steps-the-new-items-b-nn.md).

## How to read a row

The backlog is the one place that tracks the work: no other list, file or note says what is open, or its status. Every
table in it has the same nine columns, in this order: Id, What, Impact, Outcome, Size, Maintainer ✓, Status, PR,
Why here. An item is one row: no id is an open row twice, or both open and in a finished list. A static test checks
this (`tests/static/the-backlog-tracks-each-item-one-way.test.ts`).

- **Id:** a step of the old phases keeps its id, `P<phase>-<nn>` (for example `P1-16`), because code and pull requests
  cite it. A new item gets `B-NN`; a known defect `KD-NNN`. A step built in several pull requests gets lettered rows
  (`P1-16q`), and a row split in two gets a number (`P1-16o1`, `P1-16o2`). An id is never reused or renumbered: a
  dropped item keeps its id, and the finished list names it as dropped.
- **A group, not a row:** a step that is only the sum of its lettered rows (P1-23) has no row of its
  own. Its heading, under "The groups" of its file, says what it delivers and holds its decisions in force; its rows
  sit wherever the order puts them. A step with work of its own beside its rows gives that work a lettered row.
- **Folded in:** a known defect that is the same fault as another row is no row of its own. That row's What names it
  ("Folds in KD-005"), so the id still leads somewhere.
- **Rescoping:** when a row has delivered part of what it says, the id keeps what was delivered, and goes to the
  finished list; the rest is a new row, with a new id.
- **What:** what the row delivers. A row that must wait for another says so at its end ("After P1-16q").
- **Impact:** one line: who notices, what changes in play or for the maintainers, and what it unblocks.
- **Outcome:** the outcome of [the road](../the-goal-and-the-road.md#the-outcomes) the row serves.
- **Size:** Small is one small pull request; Medium is one larger pull request, or two or three small ones; Large is
  a series, often in lettered rows. Sizes compare items; they are not times.
- **Maintainer ✓:** talk it through with a maintainer before it merges
  ([D-07](../decisions/README.md#the-sites-decisions-d-01-to-d-13)). It touches security, the database, CI and deploy, or
  the harness. **🔑** in the same column: part of it needs the owner's admin access (the repository's settings, a
  production approval, Supabase's live project, or the owner's claude.ai Project). Either maintainer can pick up any
  other item, or start an agent on it. An agent does each item unless the row says otherwise.
- **Status:** one of three: ⬜ not started · 🟦 in progress · ⏸ waiting or deferred (the What says for what). A row
  whose PR column lists a merged pull request is 🟦 at least. Once every part is merged, the row leaves for a finished
  list, with its pull requests; a dropped row leaves too, and the finished list names it as dropped.
- **PR:** the pull requests so far; a step's finished rows are in the finished list.
- **Why here:** in the top and in Later's first group, one line of reasoning for the row's place; elsewhere empty.
- **Unit:** a set of steps that go together, in a fixed order (expand, wait, then contract), because doing only part of
  it would break the live site. Unit A, the cutover (P0-07 to P0-11), and Unit B (P0-20, then P0-21) are done. Unit C
  is P2-06, then a wait, then P2-07.

## The top, in order

What comes next is the first row of the first group. The top is grouped by tranche, a heading a group, its rows in
order; inside a group, the rows' "After" decides the order. The order of work is this list's order, and lives only
here: each row is placed by [the default order](../ways-of-working/ordering-the-backlog-by-impact.md#3-compare-it-with-its-neighbours)
of ordering the backlog, and a maintainer validates its place. The rulings and the known defects come after the rebuild: they head
[Later](the-later-group-what-serves-a-later-outcome-or-waits.md#the-rulings-and-the-known-defects-after-the-rebuild).
T6, the types finished, is done: its two groups, P1-16 and P1-17, are in
[the finished list](finished-steps-p1-13-to-p1-25.md). T7, the rules pulled out, is done: its group, B-06, is in
[the finished list](finished-steps-the-new-items-b-nn.md#b-06-t7-the-rules-pulled-out). The tranches "Phase 1's rest"
and "The reports' audience in one place" are done too: P1-11z, B-16, B-18 and B-19 are in the finished lists.

### 1. The check after the rules pulled out

The tests for the mutation session on T7's lines (P1-21x), then the rulings audit. B-01 is a group, not a row
([how to read a row](#how-to-read-a-row)): each ruling checked against the code, its verdict given, and each defect a
`KD-` row, so that a ruling marked Confirmed that the game breaks is found and queued. Its rows each audit a range of
rulings, one method:
1. Read the ruling.
2. Find where the game does it: the engine, the views, the portal, content's rows, the rulebooks.
3. Give one verdict, citing the file and function: built, not built, broken (the code does something else) or can't
   tell (and why).
4. Act on it:
   - Confirmed and built: no change; a test under **Enforced by** that doesn't assert the rule gets a `KD-` row.
   - Confirmed and broken, or not built: a `KD-` row in Not yet assessed, with an example; the status is a maintainer's.
   - Decided, not built, but built: Confirmed, **Enforced by** its test or "no test yet"; its row to build is finished.
   - To confirm: the verdict goes in the pull request only; the status is a maintainer's.
   - Superseded: skipped.
5. No code, no test and no rule changed.

A ruling on what a realm can see or on who can read data is audited, its verdict given to a maintainer, never written
here.

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR | Why here |
|---|---|---|---|---|---|---|---|---|
| P1-21x | Tests for each fault of the session on T7's lines (P1-21's session after a big series) that no test caught, each at the lowest level that catches it, shown red with the fault and green without; tests only; a fault no test can reach is named with its reason. Maintainer ✓: what the faults say about the tests. `refactor-only` | Maintainers: each fault in T7's lines that the tests missed gets its test | Phase 1 | Small | ✓ | 🟦 | #823 | After a big series (T7, #711 to #816), P1-21's session; it joins the stack once its faults are scored |
| B-01a | The rulings audit, R-001 to R-012: each ruling's verdict (built, not built, broken, can't tell) and what follows from it (B-01's method) | Players and maintainers: a ruling marked Confirmed that the game breaks is found and queued | Phase 1 | Small | – | 🟦 | #818 | The audit first: it tells which of Later's rulings are really broken before any is built |
| B-01b | The rulings audit, R-013 to R-025: each ruling's verdict (built, not built, broken, can't tell) and what follows from it (B-01's method) | Players and maintainers: a ruling marked Confirmed that the game breaks is found and queued | Phase 1 | Small | – | 🟦 | #820 | After B-01a |
| B-01c | The rulings audit, R-026 to R-035: each ruling's verdict (built, not built, broken, can't tell) and what follows from it (B-01's method) | Players and maintainers: a ruling marked Confirmed that the game breaks is found and queued | Phase 1 | Small | – | 🟦 | #821 | After B-01b |
| B-01d | The rulings audit, R-036 to R-047: each ruling's verdict (built, not built, broken, can't tell) and what follows from it (B-01's method) | Players and maintainers: a ruling marked Confirmed that the game breaks is found and queued | Phase 1 | Small | – | 🟦 | #822 | After B-01c |
| B-01e | The rulings audit, R-048 to R-062: each ruling's verdict (built, not built, broken, can't tell) and what follows from it (B-01's method) | Players and maintainers: a ruling marked Confirmed that the game breaks is found and queued | Phase 1 | Small | – | ⬜ | | After B-01d |
| B-01f | The rulings audit, R-063 to R-083: each ruling's verdict (built, not built, broken, can't tell) and what follows from it (B-01's method) | Players and maintainers: a ruling marked Confirmed that the game breaks is found and queued | Phase 1 | Small | – | ⬜ | | After B-01e |
| B-01g | The rulings audit, R-084 to R-116: each ruling's verdict (built, not built, broken, can't tell) and what follows from it (B-01's method) | Players and maintainers: a ruling marked Confirmed that the game breaks is found and queued | Phase 1 | Small | – | ⬜ | | After B-01f |
| B-01h | The rulings audit, R-117 to R-145: each ruling's verdict (built, not built, broken, can't tell) and what follows from it (B-01's method) | Players and maintainers: a ruling marked Confirmed that the game breaks is found and queued | Phase 1 | Small | – | ⬜ | | After B-01g |
| B-01i | The rulings audit, R-146 to R-167: each ruling's verdict (built, not built, broken, can't tell) and what follows from it (B-01's method) | Players and maintainers: a ruling marked Confirmed that the game breaks is found and queued | Phase 1 | Small | – | ⬜ | | After B-01h |
| B-01j | The rulings audit, R-168 to R-190: each ruling's verdict (built, not built, broken, can't tell) and what follows from it (B-01's method) | Players and maintainers: a ruling marked Confirmed that the game breaks is found and queued | Phase 1 | Small | – | ⬜ | | After B-01i |

## Not yet assessed

Rows whose impact no one has described yet. The known defects start here, as `KD-` rows, in one file an area. Each
joins the top, Next or Later once its impact is assessed. A new defect gets a `KD-` row here, in its area's
file, with the next id not yet used; the pull request that fixes a defect deletes its row.

- [The battles](known-defects-the-battles.md)
- The turn's rules, the orders, the items and the save: [part 1](known-defects-the-rules-of-the-turn-the-orders-and-the-save-part-1.md), [part 2](known-defects-the-rules-of-the-turn-the-orders-and-the-save-part-2.md)
- The words players read: the books, the texts and the lines: [part 1](known-defects-the-words-players-read-part-1.md), [part 2](known-defects-the-words-players-read-part-2.md), [part 3](known-defects-the-words-players-read-part-3.md)
- [The player portal and the GM page](known-defects-the-player-portal-and-the-gm-page.md)
- The bots: [part 1](known-defects-the-bots.md), [part 2](known-defects-the-bots-part-2.md)
- Dead code, and conditions that never change a value: [part 1](known-defects-dead-code-and-conditions-that-never-change-a-value-part-1.md), [part 2](known-defects-dead-code-and-conditions-that-never-change-a-value-part-2.md), [part 3](known-defects-dead-code-and-conditions-that-never-change-a-value-part-3.md)
- The tests, and checks that can't fail: [part 1](known-defects-the-tests-and-checks-that-cannot-fail-part-1.md), [part 2](known-defects-the-tests-and-checks-that-cannot-fail-part-2.md)
- The tools, CI and the harness: [part 1](known-defects-the-tools-ci-and-the-harness-part-1.md), [part 2](known-defects-the-tools-ci-and-the-harness-part-2.md), [part 3](known-defects-the-tools-ci-and-the-harness-part-3.md)
- [The docs and the comments in the code](known-defects-the-docs-and-the-comments.md)
