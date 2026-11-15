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

Finished items are a record, in three files: [Phase 0, and P1-01 to P1-10](finished-steps-phase-0-and-p1-01-to-p1-10.md),
[P1-11 and P1-12](finished-steps-p1-11-and-p1-12.md) and [P1-13 to P1-25](finished-steps-p1-13-to-p1-25.md).

## How to read a row

- **Id:** a step of the old phases keeps its id, `P<phase>-<nn>` (for example `P1-16`), because code and pull requests
  cite it. A new item gets `B-NN`; a known defect `KD-NNN`. A step built in several pull requests gets lettered rows
  (`P1-16q`), and a row split in two gets a number (`P1-16o1`, `P1-16o2`). An id is never reused or renumbered: a
  dropped item keeps its id, and the finished list names it as dropped.
- **Rescoping:** when a row has delivered part of what it says, the id keeps what was delivered, and goes to the
  finished list; the rest is a new row, with a new id.
- **Impact:** one line: who notices, what changes in play or for the maintainers, and what it unblocks.
- **Outcome:** the outcome of [the road](../the-goal-and-the-road.md#the-outcomes) the row serves.
- **Size:** Small is one small pull request; Medium is one larger pull request, or two or three small ones; Large is
  a series, often in lettered rows. Sizes compare items; they are not times.
- **Maintainer ✓:** talk it through with a maintainer before it merges
  ([D-07](../decisions/README.md#the-sites-decisions-d-01-to-d-13)). It touches security, the database, CI and deploy, or
  the harness. **🔑** in the same column: part of it needs the owner's admin access (the repository's settings, a
  production approval, Supabase's live project, or the owner's claude.ai Project). Either maintainer can pick up any
  other item, or start an agent on it.
- **Who:** an agent does each item unless the row says otherwise.
- **Unit:** a set of steps that go together, in a fixed order (expand, wait, then contract), because doing only part of
  it would break the live site. Unit A, the cutover (P0-07 to P0-11), and Unit B (P0-20, then P0-21) are done. Unit C
  is P2-06, then a wait, then P2-07.
- **Status:** ⬜ not started · 🟦 in progress · 👀 in review · ⛔ blocked (the row says why) · ⏸ deferred. A row whose
  PR column lists a merged pull request is 🟦 at least; once every part is merged, it leaves for the finished list, as
  does a dropped row (✖).
- **PR:** the pull requests so far. A step with lettered rows lists its open rows after it; its finished rows are in
  the finished list.
- **After:** a row that must wait for another says so at the end of its "What".
- **Why here:** in the top and in Later's first group, one line of reasoning for the row's place.

## The top, in order

What comes next is the first row of the first group. The top is grouped by tranche, a heading a group, its rows in
order; inside a group, the rows' "After" decides the order. The order of work is this list's order, and lives only
here: each row is placed by [the default order](../ways-of-working/ordering-the-backlog-by-impact.md#3-compare-it-with-its-neighbours)
of ordering the backlog, and a maintainer validates its place. The rulings and the known defects come after the rebuild: they head
[Later](the-later-group-what-serves-a-later-outcome-or-waits.md#the-rulings-and-the-known-defects-after-the-rebuild).

### 1. T6, the types finished: part 4

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR | Why here |
|---|---|---|---|---|---|---|---|---|
| P1-16o2 | `report.ts` freed, on a maintainer's answer of 14 November: a type predicate at the one read, which checks only that the report is an object | Maintainers: the whole player page is typed | Phase 1 | Large | – | ⬜ | | T6 part 4, the rebuild in progress: `report.ts` freed, so the whole player page is typed; unblocks P1-16q |
| P1-16q | The Hall of Fame's file freed. After P1-16o2 | Maintainers: one more page typed | Phase 1 | Large | – | ⬜ | | T6 part 4: one more page typed; after P1-16o2, unblocks P1-16r |
| P1-17q3 | `tests/page/turn-shell.test.ts` onto the typed fake: its expected values become `Db` functions' names | Maintainers: one more page test on the fake | Phase 1 | Small | – | ⬜ | | T6 part 4: the turn shell's page test on the typed fake; unblocks P1-17r |
| P1-17r | The tests of several pages onto the fake. After P1-17q3 | Maintainers: the page tests stop reading `stub-db` | Phase 1 | Medium | – | ⬜ | | T6 part 4: the page tests off `stub-db` finish part 4; unblocks P1-17s1 |

### 2. T6, the types finished: part 5

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR | Why here |
|---|---|---|---|---|---|---|---|---|
| P1-16r | `stats-tab` freed. After P1-16q | Maintainers: one more page typed | Phase 1 | Large | – | ⬜ | | T6 part 5: one more page typed; after P1-16q, unblocks P1-16s |
| P1-16s | `game-list`, `turn-log` and `game-detail` freed. After P1-16r | Maintainers: three more pages typed | Phase 1 | Medium | – | ⬜ | | T6 part 5: three more pages typed; unblocks P1-16t |
| P1-16t | `turn-shell`, `auto-turn` and `turn-zero` freed: every page typed, no `@ts-nocheck` line left in the UI. After P1-16s | Maintainers: every page typed; unblocks P1-16u | Phase 1 | Medium | – | ⬜ | | T6 part 5: the last pages typed; unblocks P1-16u |
| P1-16u | The 16 reads of every column in `src/db/` name their columns, and the compiler proves each page reads only those. After P1-16t | Maintainers: each page's reads are typed column by column | Phase 1 | Small | – | ⬜ | | T6 part 5: each page's reads typed column by column; unblocks P1-16v |
| P1-16v | Lint refuses `@ts-nocheck` everywhere; the ratchet's two counts of it retire. After P1-16u | Maintainers: no file can opt out of the compiler again | Phase 1 | Small | ✓ | ⬜ | | T6 part 5: the ban on `@ts-nocheck` finishes P1-16 |
| P1-17s1 | The balance matrix plays on the fake, its `writes` column recorded at `Db`'s calls. After P1-17r | Maintainers: the matrix records what reaches the database; unblocks P1-17s2 | Phase 1 | Medium | ✓ | ⬜ | | T6 part 5: the matrix plays on the fake; after P1-17r, unblocks P1-17s2 |
| P1-17s2 | `stub-db` deleted, each rule it copied named beside the access-layer test that covers it. After P1-17s1 | Maintainers: one fake of the database instead of two | Phase 1 | Small | – | ⬜ | | T6 part 5: `stub-db` deleted finishes P1-17, and T6 with it |

### 3. Phase 1's rest

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR | Why here |
|---|---|---|---|---|---|---|---|---|
| P1-10z | P1-10's rest: an exhaustive `switch` over the order kinds (with `assertNever`), coverage thresholds, and a content completeness test | Maintainers: an order kind left out fails to compile, and lost coverage fails CI; closes a Phase 1 criterion | Phase 1 | Medium | – | ⬜ | | Phase 1's rest: closes P1-10, a Phase 1 criterion; unblocks P1-24 |
| P1-14z | P1-14's rest: the old test files in JavaScript, the tests on the engine's vm loader, and `tests/legacy.test.ts` | Maintainers: every test is TypeScript on the engine's modules; closes a Phase 1 criterion | Phase 1 | Large | – | ⬜ | | Phase 1's rest: every test in TypeScript closes P1-14, a Phase 1 criterion; unblocks P1-24 |
| P1-13z | P1-13's rest: the one known import-rule finding, the prose's import of the item lore lines from the engine | Maintainers: the known-findings list empties, so every import is checked | Phase 1 | Small | ✓ | ⬜ | | Phase 1's rest: the known-findings list empties, which closes P1-13 |
| P1-12z | P1-12's "done when" checked on `main`, and the step closed | Maintainers: one Phase 1 criterion confirmed with evidence | Phase 1 | Small | ✓ | ⬜ | | Phase 1's rest: P1-12 confirmed on `main`, and closed |
| P1-11z | P1-11's rest: the differences the copies test still pins go as the maintainers rule on them; the alignment orders' portal half (with P1-19) | Players: the order form says what the turn does in the cases still pinned; closes P1-11 | Phase 1 | Medium | – | ⬜ | | Phase 1's rest: closes P1-11; its portal half goes with P1-19's |

### 4. T7, the rules pulled out

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR | Why here |
|---|---|---|---|---|---|---|---|---|
| B-06 | The rules pulled out: each family of rules counted and moved into the content, each with its bot valuation hook | The maintainers: a redesign item becomes a content change | The ground for the redesign | Large | – | ⬜ | | T7, the next tranche after Phase 1's rest: a redesign item becomes a content change |

## Not yet assessed

Rows whose impact no one has described yet. The known defects start here, as `KD-` rows, in one file an area. Each
joins the top, Next or Later once its impact is assessed. A new defect gets a `KD-` row here, in its area's
file, with the next id not yet used; the pull request that fixes a defect deletes its row.

- [The battles](known-defects-the-battles.md)
- The turn's rules, the orders, the items and the save: [part 1](known-defects-the-rules-of-the-turn-the-orders-and-the-save-part-1.md), [part 2](known-defects-the-rules-of-the-turn-the-orders-and-the-save-part-2.md)
- The words players read: the books, the texts and the lines: [part 1](known-defects-the-words-players-read-part-1.md), [part 2](known-defects-the-words-players-read-part-2.md), [part 3](known-defects-the-words-players-read-part-3.md)
- [The player portal and the GM page](known-defects-the-player-portal-and-the-gm-page.md)
- [The bots](known-defects-the-bots.md)
- Dead code, and conditions that never change a value: [part 1](known-defects-dead-code-and-conditions-that-never-change-a-value-part-1.md), [part 2](known-defects-dead-code-and-conditions-that-never-change-a-value-part-2.md), [part 3](known-defects-dead-code-and-conditions-that-never-change-a-value-part-3.md)
- The tests, and checks that can't fail: [part 1](known-defects-the-tests-and-checks-that-cannot-fail-part-1.md), [part 2](known-defects-the-tests-and-checks-that-cannot-fail-part-2.md)
- The tools, CI and the harness: [part 1](known-defects-the-tools-ci-and-the-harness-part-1.md), [part 2](known-defects-the-tools-ci-and-the-harness-part-2.md), [part 3](known-defects-the-tools-ci-and-the-harness-part-3.md)
- [The docs and the comments in the code](known-defects-the-docs-and-the-comments.md)
