# The backlog

Every open step of the plan, a row each: what it delivers, its size, who must look at it, what it waits for, and
where it is. Finished steps are listed, with their pull requests, in three files:
[Phase 0, and P1-01 to P1-10](finished-steps-phase-0-and-p1-01-to-p1-10.md),
[P1-11 and P1-12](finished-steps-p1-11-and-p1-12.md) and [P1-13 to P1-25](finished-steps-p1-13-to-p1-25.md). What
comes next is the top of the backlog, by impact ([the decision](../decisions/README.md#the-decisions-on-how-the-work-runs));
each phase's goal: [the goal and the road](../the-goal-and-the-road.md).

## How to read a row

- **Id:** `P<phase>-<nn>`, for example `P1-16`. A step built in several pull requests gets lettered rows (`P1-16q`),
  and a row split in two gets a number (`P1-16o1`, `P1-16o2`). An id is never reused or renumbered: a dropped step
  keeps its id, and the finished list names it as dropped.
- **Size:** Small is one small pull request; Medium is one larger pull request, or two or three small ones; Large is
  a series, often in lettered rows. Sizes compare steps; they are not times.
- **Maintainer ✓:** talk it through with a maintainer before it merges
  ([D-07](../decisions/README.md#the-sites-decisions-d-01-to-d-13)). It touches security, the database, CI and deploy, or
  the harness.
- **🔑:** part of the step needs the owner's admin access: the repository's settings, a production approval, Supabase's
  live project, or the owner's claude.ai Project. Either maintainer can pick up any other step, or start an agent on it.
- **Who:** an agent does each step unless the row says otherwise.
- **Unit:** a set of steps that go together, in a fixed order (expand, wait, then contract), because doing only part of
  it would break the live site. Unit A, the cutover (P0-07 to P0-11), and Unit B (P0-20, then P0-21) are done. Unit C
  is P2-06, then a wait, then P2-07.
- **Status:** ⬜ not started · 🟦 in progress · 👀 in review · ⛔ blocked (the row says why) · ⏸ deferred.
  A step that is done (✅) or dropped (✖) leaves the backlog for the finished list.
- **PR:** the pull requests so far. A step with lettered rows lists its open rows below it; its finished rows are in
  the finished list.

## Phase 1: the engine rebuilt on a standard TypeScript stack

| Id | What | Size | Maintainer ✓ | 🔑 | Depends on | Status | PR |
|---|---|---|---|---|---|---|---|
| P1-10 | Strict types for the engine, views, shared code and content. Left of its "done when": an exhaustive `switch` over the order kinds (with `assertNever`), coverage thresholds, and a content completeness test | Large | – | – | P1-09 | ⬜ | #177–#520, its rows |
| P1-11 | The player portal uses the engine's functions, not copies of them. The copies file is gone; the differences the copies test still pins go as the maintainers rule on them, and the alignment orders' portal half is left (with P1-19) | Medium | – | – | P1-09 | ⬜ | #173–#507, its rows |
| P1-12 | Events, perception and prose: every report line a fact through `emit`, each realm's report built from what it sees. Every row is built; the step closes once its "done when" is checked | Large | ✓ | – | P1-09, P1-04 | ⬜ | #195–#501, its rows |
| P1-12d | Typed events, prose after, for the rest of the engine. Rows d1 to d40 are merged | Large | ✓ | – | P1-12c, P1-19l | 🟦 | #257–#501, its rows |
| P1-13 | The architecture rules as checks (dependency-cruiser, knip, ESLint). Left: one known import-rule finding, the lore lines' import of the prose, with no row yet | Medium | ✓ | – | P1-09, P1-10a | ⬜ | #180–#543, its rows |
| P1-14 | Tests moved down a level and into TypeScript Vitest tests. Left: the old test files in JavaScript, the tests on the engine's vm loader (the ratchet counts both), and `tests/legacy.test.ts` | Large | – | – | P1-01, P1-08a | ⬜ | #193–#406, its rows |
| P1-16 | Strict TypeScript for the UI and the tools: no `@ts-nocheck` left. Its rows below; [the decisions in force](#p1-16-the-ui-typed) | Large | – | – | P1-10, P1-17c | ⬜ | #524–#567, its rows |
| P1-16o | `report.ts` and the player's `sign-in` freed, so the whole player page is typed. Split: o1 is done; o2 is left | Large | – | – | P1-16n | ⬜ | #557 (o1) |
| P1-16o2 | `report.ts` freed, on a maintainer's answer of 14 November: a type predicate at the one read, which checks only that the report is an object | Large | – | – | P1-16o1 | ⬜ | |
| P1-16q | The Hall of Fame's file freed | Large | – | – | P1-16p | ⬜ | |
| P1-16r | `stats-tab` freed | Large | – | – | P1-16q | ⬜ | |
| P1-16s | `game-list`, `turn-log` and `game-detail` freed | Medium | – | – | P1-16r | ⬜ | |
| P1-16t | `turn-shell`, `auto-turn` and `turn-zero` freed: every page typed, no `@ts-nocheck` line left in the UI | Medium | – | – | P1-16s | ⬜ | |
| P1-16u | The 17 reads of every column in `src/db/` name their columns, and the compiler proves each page reads only those | Small | – | – | P1-16t | ⬜ | |
| P1-16v | Lint refuses `@ts-nocheck` everywhere; the ratchet's two counts of it retire | Small | ✓ | – | P1-16u | ⬜ | |
| P1-17 | The database access layer (`src/db/`), tested against the local Supabase as each role; `stub-db` retires. Its rows below; [the decisions in force](#p1-17-the-database-access-layer) | Large | ✓ | – | P1-09, P0-16, P1-02c | ⬜ | #518–#569, its rows |
| P1-17q3 | `tests/page/turn-shell.test.ts` onto the typed fake: its expected values become `Db` functions' names | Small | – | – | P1-17q2 | ⬜ | |
| P1-17r | The tests of several pages onto the fake | Medium | – | – | P1-17q2 | ⬜ | |
| P1-17s1 | The balance matrix plays on the fake, its `writes` column recorded at `Db`'s calls | Medium | ✓ | – | P1-17r | ⬜ | |
| P1-17s2 | `stub-db` deleted, each rule it copied named beside the access-layer test that covers it | Small | – | – | P1-17s1 | ⬜ | |
| P1-19 | The rule registry for content effects, one family at a time. Every content family is in it; left: the alignments' checks by name (the bots' and the words'), and the alignment orders' portal half (with P1-11) | Large | – | – | P1-10, P1-08 | 🟦 | #229–#587, its rows |
| P1-20 | State reshapes that earn their place: items get ids first | Medium | – | – | P1-15 | ⬜ | |
| P1-21 | Mutation sessions: faults made on purpose, scored by a script, after each big series. Recurring | Medium | ✓ | – | P1-08a, P1-02 | ⬜ | #192–#588, its rows |
| P1-22 | What the balance matrix reaches. Its code coverage and the proof tools are built (`tools/proof/`); its content coverage is still to plan | Medium | ✓ | – | P1-19, P1-02 | 🟦 | #287 |
| P1-23 | Fix what the checks found, then what the maintainers have ruled. `KNOWN_BREACHES` is empty; the rulings tranche's rows are below; [the decisions in force](#p1-23-the-rulings-tranche) | Medium | ✓ | – | P1-12, P1-19 | 🟦 | #205–#372, its rows |
| P1-23f | One of the maintainers' answers, built; its pull request says what it changes, and adds its ruling | Small | ✓ | – | – | ⬜ | |
| P1-23g | One of the maintainers' answers, built; its pull request says what it changes, and adds its ruling | Small | ✓ | – | P1-23f | ⬜ | |
| P1-23h | [R-138](../rulings/R-138-an-onlooker-with-a-hero-there-reads-a-battles-one-line-summary.md): an onlooker with a hero there reads a battle's one-line summary | Small | ✓ | – | P1-23g | ⬜ | |
| P1-23i | [R-141](../rulings/R-141-illusory-terrain-fools-the-intelligence-report-and-the-order-forms-too.md): Illusory Terrain fools the intelligence report and the order forms too | Small | ✓ | – | P1-23h | ⬜ | |
| P1-23j | [R-142](../rulings/R-142-a-declaration-of-war-meets-the-realm-that-declared-it.md): a declaration of war meets the realm that declared it | Small | ✓ | – | P1-23i | ⬜ | |
| P1-23k | [R-140](../rulings/R-140-messenger-birds-is-retired.md): Messenger Birds is retired | Medium | ✓ | – | P1-23j | ⬜ | |
| P1-23l | [R-145](../rulings/R-145-new-games-keep-the-guardian-tables-hp-and-running-games-keep-theirs.md): new games' guardians have the table's HP; running games keep theirs | Small | ✓ | – | P1-23k | ⬜ | |
| P1-23m | [R-144](../rulings/R-144-only-the-human-garrison-holds-the-gate.md): only the Human Garrison holds the gate | Small | ✓ | – | P1-23l | ⬜ | |
| P1-23n | [R-146](../rulings/R-146-flak-screen-engages-every-flyer.md): Flak Screen engages every flyer | Small | ✓ | – | P1-23m | ⬜ | |
| P1-23o | [R-147](../rulings/R-147-old-corsair-companies-fight-as-plain-fleets.md): old Corsair companies fight as plain fleets | Medium | ✓ | – | P1-23n | ⬜ | |
| P1-23p | [R-148](../rulings/R-148-each-banner-gives-its-own-number.md): each banner gives its own number, the stronger of two | Small | ✓ | – | P1-23o | ⬜ | |
| P1-23u | [R-143](../rulings/R-143-the-crown-of-commands-text-says-it-helps-your-realms-characters.md): the Crown of Command's texts say your realm; running games' copies of them re-stamped | Medium | ✓ | – | P1-23t | ⬜ | |
| P1-23v | [R-153](../rulings/R-153-two-second-wind-items-shrug-off-a-killing-blow-and-four-say-the-30-percent.md): the Ring and the Helm shrug off a killing blow; four texts state the 30% | Large | ✓ | – | P1-23u | ⬜ | |
| P1-23w | [R-149](../rulings/R-149-the-lancers-the-legions-and-the-bowmans-items-name-the-units-the-battle-lifts.md): thirty item texts name the units the battle lifts | Medium | ✓ | – | P1-23v | ⬜ | |
| P1-23x | [R-150](../rulings/R-150-the-home-defence-items-say-what-the-battle-does.md): the home-defence items' texts | Small | ✓ | – | P1-23w | ⬜ | |
| P1-23y | [R-151](../rulings/R-151-the-shield-wall-runes-text-says-what-the-battle-does.md): the Shield-Wall Rune's texts | Small | ✓ | – | P1-23x | ⬜ | |
| P1-23z | [R-152](../rulings/R-152-the-plus-three-tax-items-say-three-gold-each-tax-season.md): the four tax items' texts | Small | ✓ | – | P1-23y | ⬜ | |
| P1-23aa | [R-154](../rulings/R-154-the-terror-items-say-the-foe-flees-half-the-time.md): the terror items' texts | Small | ✓ | – | P1-23z | ⬜ | |
| P1-23ab | [R-139](../rulings/R-139-the-rulebooks-footers-say-when-their-rules-last-changed.md): each rulebook's footer says when its rules last changed, from the history; touches `.github/` and needs staging | Medium | ✓ | – | P1-23aa | ⬜ | |
| P1-24 | Long, descriptive names: a glossary a maintainer agrees, then the renames, one area a pull request (saved-state, content and database names left out) | Large | – | – | P1-10, P1-14, P1-19 | ⬜ | |

The maintainers' answers of 2 to 15 November, R-155 to R-176, are decided and not yet built, and have no row yet.
Each is a backlog item of its own, positioned by its impact
([the decision](../decisions/README.md#the-decisions-on-how-the-work-runs)).

## The decisions in force

Each series was planned by a run, which builds on its own recommendations; a maintainer may veto any of them. Each row
checks its figures again on its base.

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
  row a script, Maintainer ✓, tried on staging), and the JavaScript tests (P1-14).

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

### P1-23: the rulings tranche

Planned on 1 November, its rulings numbered on 15 November.
- **One row a ruling**, stacked in the order above. Each is test first and fails first, carries its balance report
  with "What changes in play" and a `## For playtesters` section, and is not `refactor-only`.
- **Each row's pull request updates its ruling:** the "not yet built" note goes, the source names the pull request,
  and "Enforced by" names its tests.
- **The text rows (u to aa) reach running games:** each re-stamps its own items' saved descriptions from the
  catalogue in the save's upgrade, where the saved item's effect is the catalogue's. Row u adds the helper. The
  save's shape doesn't change, so there is no version step.
- **P1-23ab:** the build writes each footer from the history. Deploy's and staging's build jobs fetch the whole
  history; CI's stay shallow. Without git, the footer reads "Rules last changed: unknown".

## Phase 2: the database decides, and turns are kept

Each row says what the step delivers.

| Id | What it delivers | Size | Maintainer ✓ | 🔑 | Depends on | Status | PR |
|---|---|---|---|---|---|---|---|
| P2-16 | A running game and its logs are read only by its GM, its players and the Overlord (D-10). Live since 16 October; waiting for the owner's check on the live site | Small | ✓ | ✓ | P0-21, P0-19 | 🟦 | #106 |
| P2-01 | Every turn kept: the state before it, its orders and its seed | Medium | ✓ | – | P0-17, P1-18, P1-15 | ⬜ | |
| P2-02 | "Restore turn N": the GM puts a game back to a kept turn | Medium | ✓ | – | P2-01 | ⬜ | |
| P2-03 | A turn lock and a breaker: one turn runs at a time, and a game whose turn keeps failing pauses | Medium | ✓ | – | P0-17, P1-18 | ⬜ | |
| P2-04 | The database keeps the published facts (which realms have met, which are out) and the dispatch rules (D-02) | Medium | ✓ | – | P0-25, P1-12 | ⬜ | |
| P2-05 | Orders are sent through one database function that checks them (expand, then contract) | Medium | ✓ | ✓ | P0-21 | ⬜ | |
| P2-06 | The player page reads its realm's own view of the game (expand; Unit C) | Large | ✓ | – | P2-01, P1-12, P1-06 | ⬜ | |
| P2-07 | The database's access rules follow P2-06 (contract; Unit C) | Small | ✓ | ✓ | P2-06 and a wait | ⬜ | |
| P2-08 | A turn exported with the names removed, for tests | Medium | ✓ | – | P2-01 | ⏸ | |
| P2-09 | Live turns replayed as a test level; deferred with Phase 4 | – | – | – | – | ⏸ | |
| P2-10 | Staging fed from exported turns | Small | – | – | P2-08 | ⏸ | |
| P2-11 | "Download my chronicle" (D-04) | Medium | – | – | P2-06 | ⬜ | |
| P2-12 | Turn logs trimmed 30 days after a game ends (D-04) | Medium | ✓ | ✓ | P2-11 | ⬜ | |
| P2-13 | A way to reproduce a live bug. Deferred: a live bug becomes a made-up test from a maintainer's description | Small | – | – | P2-08 | ⏸ | |
| P2-15 | A GM sees less of their own games, on screen (D-13d), once a maintainer rules on the detail | Medium | – | – | P0-32g, a maintainer's ruling | ⬜ | |
| P2-14 | Players told what Phase 2 changed. The maintainers do it | Small | ✓ | ✓ | P2-05, P2-07, P2-16 | ⬜ | |

D-02, D-04, D-10 and D-13: [the decisions](../decisions/README.md#the-sites-decisions-d-01-to-d-13).

## Phase 3: one home for each number

| Id | What it delivers | Size | Maintainer ✓ | 🔑 | Depends on | Status | PR |
|---|---|---|---|---|---|---|---|
| P3-01 | The content checked against its schemas | Medium | – | – | P1-10 | ⬜ | |
| P3-02 | The rulebooks' numbers checked against the content: one words-test helper, a check for every number | Medium | – | – | P3-01, P1-19 | ⬜ | |
| P3-03 | A content spreadsheet: exported from the content, read back with checks. Deferred until a maintainer wants it | Medium | – | – | P3-01 | ⏸ | |
| P3-04 | Blurbs and tooltips from the content. Deferred: P3-02's checks cover them | Small | – | – | P3-01 | ⏸ | |
| P3-05 | The changelog and "What's new" written from the pull requests | Small | ✓ | – | P0-11 | ⬜ | |

## Phase 4: turns run by a server

Deferred, with no steps yet: [Phase 4](../the-goal-and-the-road.md#phase-4-turns-run-by-a-server) says when it starts.
