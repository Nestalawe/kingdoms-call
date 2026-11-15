# The backlog: Later

The Later group of [the backlog](README.md), in the same columns ([how to read a row](README.md#how-to-read-a-row)).
Placed here on one assumption: the row serves an outcome after Phase 1 (Phase 2, Phase 3, the ground for the
redesign), or waits for several Phase 1 rows first, or is deferred (⏸). A row moves up once it is assessed against
its neighbours.

## Phase 1's later rows

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR |
|---|---|---|---|---|---|---|---|
| P1-20 | State reshapes that earn their place: items get ids first | Maintainers: an item can be named in a rule or a test by its id; closes a Phase 1 criterion | Phase 1 | Medium | – | ⬜ | |
| P1-24 | Long, descriptive names: a glossary a maintainer agrees, then the renames, one area a pull request (saved-state, content and database names left out). After P1-10z, P1-14z and P1-19 | Maintainers: names say what the code does; closes a Phase 1 criterion | Phase 1 | Large | – | ⬜ | |
| B-03 | The people's names in code and config comments and messages: `.github/scripts/*.js` (the dangerous-paths warning and the migrations summary's label, pinned by `tests/dangerous-paths.test.js` and `tests/migrations.test.js`), `.github/workflows/*.yml`, `.github/dependabot.yml`, `.github/dangerous-paths`, the root `README.md`, `tests/README.md`, the header of `tests/rulings.test.js`, and comments in `src/` and `tests/`: roles instead, and the names test extended to them | Maintainers: the warnings and comments say "a maintainer", as the docs do | Phase 1 | Small | ✓ | ⬜ | |

## Phase 2: the database decides, and turns are kept

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR |
|---|---|---|---|---|---|---|---|
| P2-01 | Every turn kept: the state before it, its orders and its seed | GMs: any turn can be looked at again; unblocks P2-02, P2-06 and P2-08 | Phase 2 | Medium | ✓ | ⬜ | |
| P2-02 | "Restore turn N": the GM puts a game back to a kept turn. After P2-01 | GMs: a turn that went wrong can be undone | Phase 2 | Medium | ✓ | ⬜ | |
| P2-03 | A turn lock and a breaker: one turn runs at a time, and a game whose turn keeps failing pauses | GMs and players: no turn runs twice, and a failing game stops safely | Phase 2 | Medium | ✓ | ⬜ | |
| P2-04 | The database keeps the published facts (which realms have met, which are out) and the dispatch rules (D-02) | Players: who may write to whom rests on the database's facts | Phase 2 | Medium | ✓ | ⬜ | |
| P2-05 | Orders are sent through one database function that checks them (expand, then contract) | Maintainers: orders reach the database through one function; unblocks P2-14 | Phase 2 | Medium | ✓ 🔑 | ⬜ | |
| P2-06 | The player page reads its realm's own view of the game (expand; Unit C). After P2-01 | Maintainers: the player page reads one view a realm, built by the database; unblocks P2-07 and P2-11 | Phase 2 | Large | ✓ | ⬜ | |
| P2-07 | The database's access rules follow P2-06 (contract; Unit C). After P2-06 and a wait | Maintainers: closes Unit C | Phase 2 | Small | ✓ 🔑 | ⬜ | |
| P2-08 | A turn exported with the names removed, for tests. After P2-01 | Maintainers: a live problem can be studied with no player data | Phase 2 | Medium | ✓ | ⏸ | |
| P2-09 | Live turns replayed as a test level; deferred with Phase 4 | Maintainers: each live turn becomes a test | Phase 2 | – | – | ⏸ | |
| P2-10 | Staging fed from exported turns. After P2-08 | Maintainers: staging plays like a real game | Phase 2 | Small | – | ⏸ | |
| P2-11 | "Download my chronicle" (D-04). After P2-06 | Players: each keeps their own game's story; unblocks P2-12 | Phase 2 | Medium | – | ⬜ | |
| P2-12 | Turn logs trimmed 30 days after a game ends (D-04). After P2-11 | Players: old logs don't stay for ever | Phase 2 | Medium | ✓ 🔑 | ⬜ | |
| P2-13 | A way to reproduce a live bug. Deferred: a live bug becomes a made-up test from a maintainer's description. After P2-08 | Maintainers: a live bug is replayed, not retold | Phase 2 | Small | – | ⏸ | |
| P2-15 | A GM sees less of their own games, on screen (D-13d). After P0-32g and a maintainer's ruling on the detail | Players: a GM who also plays sees no more than a player | Phase 2 | Medium | – | ⬜ | |
| P2-14 | Players told what Phase 2 changed. The maintainers do it. After P2-05, P2-07 and P2-16 | Players: they know what changed and why | Phase 2 | Small | ✓ 🔑 | ⬜ | |

D-02, D-04, D-10 and D-13: [the decisions](../decisions/README.md#the-sites-decisions-d-01-to-d-13).

## Phase 3: one home for each number

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR |
|---|---|---|---|---|---|---|---|
| P3-01 | The content checked against its schemas | Maintainers: a content row that breaks its shape fails the build; unblocks P3-02 | Phase 3 | Medium | – | ⬜ | |
| P3-02 | The rulebooks' numbers checked against the content: one words-test helper, a check for every number. After P3-01 | Players: every number in the books is the game's | Phase 3 | Medium | – | ⬜ | |
| P3-03 | A content spreadsheet: exported from the content, read back with checks. Deferred until a maintainer wants it | The maintainers: the content edited as a sheet | Phase 3 | Medium | – | ⏸ | |
| P3-04 | Blurbs and tooltips from the content. Deferred: P3-02's checks cover them | Players: each blurb's numbers come from the content | Phase 3 | Small | – | ⏸ | |
| P3-05 | The changelog and "What's new" written from the pull requests | Players and maintainers: "What's new" is never forgotten | Phase 3 | Small | ✓ | ⬜ | |

## The ground for the redesign

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR |
|---|---|---|---|---|---|---|---|
| B-06 | The rules pulled out: each family of rules counted and moved into the content, each with its bot valuation hook | The maintainers: a redesign item becomes a content change | The ground for the redesign | Large | – | ⬜ | |
| B-07 | The instruments, in `tools/` only: the design matrix and its scorecard (the cost of a game measured first), the tool that reads players' games as totals only, and the page that shows the game as it is. The tool that reads players' games has its database pull request first | The maintainers: each option of a rule scored before it lands | The ground for the redesign | Large | ✓ | ⬜ | |
| B-08 | A long-lived playtest site, with its own database, where players try a rule's options; its running cost checked first. A step still to plan, with a database part | Players and the maintainers: options tried in play before one is chosen | The ground for the redesign | Large | ✓ 🔑 | ⬜ | |

## Phase 4: turns run by a server

Deferred, with no rows yet: [Phase 4](../the-goal-and-the-road.md#phase-4-turns-run-by-a-server) says when it starts.
