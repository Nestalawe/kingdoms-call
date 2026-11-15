# The backlog

Every open item, in one list: what it delivers, its impact, the outcome it serves, its size, who must look at it, and
where it is. What comes next is the top of the list ([the decision](../decisions/README.md#the-decisions-on-how-the-work-runs));
each outcome is in [the goal and the road](../the-goal-and-the-road.md). The list runs in four parts:
1. [**The top, in order**](#the-top-in-order): the next rows, in strict order.
2. [**Next**](#next): rows to place in the top soon, with [the rulings to build](the-rulings-decided-not-built.md).
3. [**Later**](the-later-group-what-serves-a-later-outcome-or-waits.md): rows that serve a later outcome, or wait.
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

## The top, in order

Ordered by A16's pass: empty until the first ordering pass places about twenty rows here, each with one line of
reasoning.

## Next

Placed here on one assumption: the row serves Phase 1, which the road works on now, or changes what players see in
running games, or is already in progress. The rulings to build are in [their own file](the-rulings-decided-not-built.md).

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR |
|---|---|---|---|---|---|---|---|
| P1-10z | P1-10's rest: an exhaustive `switch` over the order kinds (with `assertNever`), coverage thresholds, and a content completeness test | Maintainers: an order kind left out fails to compile, and lost coverage fails CI; closes a Phase 1 criterion | Phase 1 | Medium | – | ⬜ | |
| P1-11z | P1-11's rest: the differences the copies test still pins go as the maintainers rule on them; the alignment orders' portal half (with P1-19) | Players: the order form says what the turn does in the cases still pinned; closes P1-11 | Phase 1 | Medium | – | ⬜ | |
| P1-12z | P1-12's "done when" checked on `main`, and the step closed | Maintainers: one Phase 1 criterion confirmed with evidence | Phase 1 | Small | ✓ | ⬜ | |
| P1-13z | P1-13's rest: the one known import-rule finding, the prose's import of the item lore lines from the engine | Maintainers: the known-findings list empties, so every import is checked | Phase 1 | Small | ✓ | ⬜ | |
| P1-14z | P1-14's rest: the old test files in JavaScript, the tests on the engine's vm loader, and `tests/legacy.test.ts` | Maintainers: every test is TypeScript on the engine's modules; closes a Phase 1 criterion | Phase 1 | Large | – | ⬜ | |
| P1-16 | Strict TypeScript for the UI and the tools: no `@ts-nocheck` left. Its rows follow; [the decisions in force](#p1-16-the-ui-typed) | Maintainers: the compiler checks every page; closes a Phase 1 criterion | Phase 1 | Large | – | 🟦 | #524–#567, its rows |
| P1-16o2 | `report.ts` freed, on a maintainer's answer of 14 November: a type predicate at the one read, which checks only that the report is an object | Maintainers: the whole player page is typed | Phase 1 | Large | – | ⬜ | |
| P1-16q | The Hall of Fame's file freed. After P1-16o2 | Maintainers: one more page typed | Phase 1 | Large | – | ⬜ | |
| P1-16r | `stats-tab` freed. After P1-16q | Maintainers: one more page typed | Phase 1 | Large | – | ⬜ | |
| P1-16s | `game-list`, `turn-log` and `game-detail` freed. After P1-16r | Maintainers: three more pages typed | Phase 1 | Medium | – | ⬜ | |
| P1-16t | `turn-shell`, `auto-turn` and `turn-zero` freed: every page typed, no `@ts-nocheck` line left in the UI. After P1-16s | Maintainers: every page typed; unblocks P1-16u | Phase 1 | Medium | – | ⬜ | |
| P1-16u | The 16 reads of every column in `src/db/` name their columns, and the compiler proves each page reads only those. After P1-16t | Maintainers: each page's reads are typed column by column | Phase 1 | Small | – | ⬜ | |
| P1-16v | Lint refuses `@ts-nocheck` everywhere; the ratchet's two counts of it retire. After P1-16u | Maintainers: no file can opt out of the compiler again | Phase 1 | Small | ✓ | ⬜ | |
| P1-17 | The database access layer (`src/db/`), tested against the local Supabase as each role; `stub-db` retires. Its rows follow; [the decisions in force](#p1-17-the-database-access-layer) | Maintainers: the page tests check the real queries; closes a Phase 1 criterion | Phase 1 | Large | ✓ | 🟦 | #518–#569, its rows |
| P1-17q3 | `tests/page/turn-shell.test.ts` onto the typed fake: its expected values become `Db` functions' names | Maintainers: one more page test on the fake | Phase 1 | Small | – | ⬜ | |
| P1-17r | The tests of several pages onto the fake. After P1-17q3 | Maintainers: the page tests stop reading `stub-db` | Phase 1 | Medium | – | ⬜ | |
| P1-17s1 | The balance matrix plays on the fake, its `writes` column recorded at `Db`'s calls. After P1-17r | Maintainers: the matrix records what reaches the database; unblocks P1-17s2 | Phase 1 | Medium | ✓ | ⬜ | |
| P1-17s2 | `stub-db` deleted, each rule it copied named beside the access-layer test that covers it. After P1-17s1 | Maintainers: one fake of the database instead of two | Phase 1 | Small | – | ⬜ | |
| P1-19 | The rule registry for content effects, one family at a time. Every content family is in it; left: the alignments' checks by name (the bots' and the words'), and the alignment orders' portal half (with P1-11) | Maintainers: an alignment's rule lives in one place before its new abilities land | Phase 1 | Large | – | 🟦 | #229–#587, its rows |
| P1-21 | Mutation sessions: faults made on purpose, scored by a script, after each big series. Recurring | Maintainers: finds what the tests miss after each series | Phase 1 | Medium | ✓ | 🟦 | #192–#588, its rows |
| P1-22 | What the balance matrix reaches. Its code coverage and the proof tools are built (`tools/proof/`); its content coverage is still to plan | Maintainers: shows which content no matrix game plays | Phase 1 | Medium | ✓ | 🟦 | #287 |
| P2-16 | A running game and its logs are read only by its GM, its players and the Overlord (D-10). Live since 16 October; waiting for the owner's check on the live site | The owner: one check on the live site closes it | Phase 2 | Small | ✓ 🔑 | 🟦 | #106 |
| B-01 | The rulings audit: each ruling checked against the code (built, not built or broken), its status set, and each defect a `KD-` row | Players and maintainers: a ruling marked Confirmed that the game breaks is found and queued | Phase 1 | Large | – | ⬜ | |
| B-02 | The batch rehearsal: the docs a batch agent reads checked against `main`, `/making-a-change` tried on made-up changes, the open items in the first areas; its fixes in one pull request | The maintainers: the first real batches run on docs that were tried; checks a Phase 1 criterion | Phase 1 | Medium | – | ⬜ | |
| B-04 | Sacred Oaths and Blood Runes once zeal is gone: both only raise the chance of fanatical zeal, which the new abilities remove. Asked before Divine's and Pagan's batches: each gets a new effect in its creed's new abilities (an agent's assessment), or both are retired; then built with those batches | Players: a realm that researched one, or holds one in a running game, gets something for it | The ground for the redesign | Small | – | ⬜ | |

## Not yet assessed

Rows whose impact no one has described yet. The known defects start here, as `KD-` rows, in one file an area. Each
joins the ordered list (Next or Later) once its impact is assessed. A new defect gets a `KD-` row here, in its area's
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

## The decisions in force

Each series was planned by a run, which builds on its own recommendations; a maintainer may veto any of them. Each row
checks its figures again on its base. P1-23's are with [the rulings to build](the-rulings-decided-not-built.md#p1-23-the-rulings-tranche).

### P1-16: the UI typed

Planned on 10 November.
- **The order:** o2, then q to t, callee before caller, then u (the reads named), then v (the ban).
- **The forms:** [freeing a file of its `@ts-nocheck` line](../architecture/freeing-a-file-of-its-ts-nocheck-line.md)
  and its forms files: no `!` or `as`, every typed finding fixed and none suppressed, and `||` becomes `??` only
  where the type rules out `''`, `0` and `false`.
- **The proof:** `refactor-only`. Every tour screen is the same on the base and the row. Each changed line no tour
  reaches (`tools/proof/the-changed-lines-no-tour-reaches.ts`) gets a case that fails on a planted fault, or is named.
  On a GM page's row, both balance sets are identical, `writes` included. Staging is not needed.
- **Copies that disagree stay as they are**, each typed in place
  ([the decision](../decisions/README.md#the-decisions-on-how-the-work-runs)).
- **Not in this series:** the engine side's lint suppressions, `.github/scripts/` in TypeScript (a later slice, one
  row a script, Maintainer ✓, tried on staging), and the JavaScript tests (P1-14z).

### P1-17: the database access layer

Planned on 10 November.
- **No row changes who can read or change what:** each sends the same queries as before.
- **The proof:** `refactor-only`. Every database call the page tests and the tours make is recorded, and is the same
  on the base and the row; both balance sets are identical.
- **P1-17q3** (a maintainer, 14 November): the test records at `Db`'s functions, so its expected values become the
  functions' names; the access-layer tests prove the query text.
- **P1-17s1:** the matrix plays on the fake. Its `writes` column is recorded at `Db`'s calls, so the column changes
  form once and the balance report says "writes only"; every other column stays identical.
- **P1-17s2:** `stub-db` goes last. The quarantined tests that use it go first, each in its own pull request: the two
  one-off proofs (`one-source`, `one-source-chromium`) are deleted, and `dispatches-e2e` comes back on today's three
  tabs (a maintainer's choice).
