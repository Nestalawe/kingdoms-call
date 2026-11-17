# The backlog: Next

The Next group of [the backlog](README.md), in the same columns ([how to read a row](README.md#how-to-read-a-row)):
the rebuild's other rows, to place in [the top](README.md#the-top-in-order) soon. Placed here on one assumption: the
row serves Phase 1, which the road works on now, or is already in progress, or is the last task of a merged tranche. The rulings to build and the known
defects placed so far come after the rebuild, in [Later](the-later-group-what-serves-a-later-outcome-or-waits.md).

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR | Why here |
|---|---|---|---|---|---|---|---|---|
| P1-19 | The rule registry for content effects, one family at a time. Every content family is in it; left: the alignments' checks by name (the bots' and the words'), and the alignment orders' portal half (with P1-11) | Maintainers: an alignment's rule lives in one place before its new abilities land | Phase 1 | Large | – | 🟦 | #229–#587, its rows | |
| P1-21 | Mutation sessions: faults made on purpose, scored by a script, after each big series. Recurring | Maintainers: finds what the tests miss after each series | Phase 1 | Medium | ✓ | 🟦 | #192–#628, its rows | |
| P1-22 | What the balance matrix reaches. Its code coverage and the proof tools are built (`tools/proof/`); its content coverage is still to plan | Maintainers: shows which content no matrix game plays | Phase 1 | Medium | ✓ | 🟦 | #287 | |
| P2-16 | A running game and its logs are read only by its GM, its players and the Overlord (D-10). Live since 16 October; waiting for a maintainer's check on the live site: a running game opened as its GM and as a player, and the Hall of Fame, each reads as before | The maintainers: one check on the live site closes it | Phase 2 | Small | ✓ 🔑 | 🟦 | #106 | |
| B-01 | The rulings audit: each ruling checked against the code (built, not built or broken), its status set, and each defect a `KD-` row | Players and maintainers: a ruling marked Confirmed that the game breaks is found and queued | Phase 1 | Large | – | ⬜ | | |
| B-10 | The playtesters told what two merged tranches changed: a maintainer gives them the `## For playtesters` sections of #366 to #372, and of #494 and #504 | Players: they learn what changed in their games | Phase 1 | Small | – | ⬜ | | |
| B-12 | The fixes kept private until they merge; a maintainer holds the list | The maintainers: the private fixes keep their place in the one order of work | – | – | ✓ | ⬜ | | |

## The groups

A step that is only the sum of its rows is a group, not a row ([how to read a row](README.md#how-to-read-a-row)). Its
rows are in [the top](README.md#the-top-in-order) (T6), its finished rows in
[the finished list](finished-steps-p1-13-to-p1-25.md). Each series was planned by a run, which builds on its own
recommendations; a maintainer may veto any of them. Each row checks its figures again on its base. P1-23 is a group of
[the rulings to build](the-rulings-decided-not-built.md#p1-23-the-rulings-tranche).

### P1-17: the database access layer

The database access layer (`src/db/`), tested against the local Supabase as each role; `stub-db` retires. Impact: the
page tests check the real queries; it closes a Phase 1 criterion. Maintainer ✓. Planned on 10 November; its decisions
in force:
- **No row changes who can read or change what:** each sends the same queries as before.
- **The proof:** `refactor-only`. Every database call the page tests and the tours make is recorded, and is the same
  on the base and the row; both balance sets are identical.
- **P1-17s1:** the matrix plays on the fake. Its `writes` column is recorded at `Db`'s calls, so the column changes
  form once. `results` changes only in the key order of each Hall of Fame entry's `records` (the fake reads turn
  records in the database's order); every other column stays identical. The balance report calls this a reshape,
  and the PR has no `refactor-only` label, because it changes the baseline.
- **P1-17s2:** `stub-db` goes last. The quarantined tests that use it go first, each in its own pull request: the two
  one-off proofs of the September refactor are deleted, and `dispatches-e2e` comes back on today's three
  tabs (a maintainer's choice).
