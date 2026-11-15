# The backlog: Next

The Next group of [the backlog](README.md), in the same columns ([how to read a row](README.md#how-to-read-a-row)):
the rebuild's other rows, to place in [the top](README.md#the-top-in-order) soon. Placed here on one assumption: the
row serves Phase 1, which the road works on now, or is already in progress, or is the last task of a merged tranche. The rulings to build and the known
defects placed so far come after the rebuild, in [Later](the-later-group-what-serves-a-later-outcome-or-waits.md).

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR |
|---|---|---|---|---|---|---|---|
| P1-16 | Strict TypeScript for the UI and the tools: no `@ts-nocheck` left. Its rows are in [the top](README.md#the-top-in-order); [the decisions in force](#p1-16-the-ui-typed) | Maintainers: the compiler checks every page; closes a Phase 1 criterion | Phase 1 | Large | – | 🟦 | #524–#567, its rows |
| P1-17 | The database access layer (`src/db/`), tested against the local Supabase as each role; `stub-db` retires. Its rows are in [the top](README.md#the-top-in-order); [the decisions in force](#p1-17-the-database-access-layer) | Maintainers: the page tests check the real queries; closes a Phase 1 criterion | Phase 1 | Large | ✓ | 🟦 | #518–#569, its rows |
| P1-19 | The rule registry for content effects, one family at a time. Every content family is in it; left: the alignments' checks by name (the bots' and the words'), and the alignment orders' portal half (with P1-11) | Maintainers: an alignment's rule lives in one place before its new abilities land | Phase 1 | Large | – | 🟦 | #229–#587, its rows |
| P1-21 | Mutation sessions: faults made on purpose, scored by a script, after each big series. Recurring | Maintainers: finds what the tests miss after each series | Phase 1 | Medium | ✓ | 🟦 | #192–#588, its rows |
| P1-22 | What the balance matrix reaches. Its code coverage and the proof tools are built (`tools/proof/`); its content coverage is still to plan | Maintainers: shows which content no matrix game plays | Phase 1 | Medium | ✓ | 🟦 | #287 |
| P2-16 | A running game and its logs are read only by its GM, its players and the Overlord (D-10). Live since 16 October; waiting for a maintainer's check on the live site: a running game opened as its GM and as a player, and the Hall of Fame, each reads as before | The maintainers: one check on the live site closes it | Phase 2 | Small | ✓ 🔑 | 🟦 | #106 |
| B-01 | The rulings audit: each ruling checked against the code (built, not built or broken), its status set, and each defect a `KD-` row | Players and maintainers: a ruling marked Confirmed that the game breaks is found and queued | Phase 1 | Large | – | ⬜ | |
| B-10 | The playtesters told what two merged tranches changed: a maintainer gives them the `## For playtesters` sections of #366 to #372, and of #494 and #504 | Players: they learn what changed in their games | Phase 1 | Small | – | ⬜ | |

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
