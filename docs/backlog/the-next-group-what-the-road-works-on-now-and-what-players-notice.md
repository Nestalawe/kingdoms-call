# The backlog: Next

The Next group of [the backlog](README.md), in the same columns ([how to read a row](README.md#how-to-read-a-row)):
rows to place in [the top](README.md#the-top-in-order) soon. Placed here on one assumption: the row serves Phase 1,
which the road works on now, or changes what players see in running games, or is already in progress. The rulings to
build are in [their own file](the-rulings-decided-not-built.md).

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
| KD-050 | **A sea parted and then flooded in the same turn stays dry land for good** (found 2026-10-19 in P1-08j7, Cast Spell; live, players can notice it). Part Sea sets `_partSea={orig:'sea'}` and the terrain to `'plains'`; a Flood the same turn deletes `_partSea` and records `_flood={orig:'plains'}`, which the turn's end restores, so the sea is `'plains'` for good (no fleet can sail it). E.g. a mage parts the Narrow Strait in spring and floods it in summer. Fix: a Flood on a parted province keeps the parting's own `orig`. Its own PR, with a balance report and playtester notes; with the next item. P1-08j7's case "Flood on a sea parted earlier this turn …" pins today's behaviour. | Players: a sea parted, then flooded, becomes sea again | Phase 1 | Small | – | ⬜ | |
| KD-051 | **A parted sea is a terrain the game doesn't know** (found 2026-10-19 in P1-08j7, Part Sea; live, small): Part Sea sets the terrain to `'plains'`, but land is `'plain'` everywhere else, so `terrainMod` finds no row for a battle on the seabed that turn (every unit ×1.0, where a plain gives human line foot and longbows ×1.1) and the explore table has none. Fix: `'plain'`. With KD-050, in one PR. | Players: a battle on a parted sea's bed counts as a plain, as land does; one fix with KD-050 | Phase 1 | Small | – | ⬜ | |
| KD-063 | **A sea province parted and then flooded ends the turn as plains for good** (found 2026-11-02 scoping P1-11's second tranche, by trial; live, rare). Part Sea sets the terrain `'plains'`, a key no terrain table has (`'plain'`), and deletes `_flooded`, which nothing sets (Flood sets `_flood`); Flood in a later phase records `orig` as `'plains'` and deletes `_partSea`, so the sea never returns. Fix: its own PR from `main`, a unit case first, a balance report. | Players: the same fault as KD-050, seen by trial; one fix closes both | Phase 1 | Small | – | ⬜ | |
| KD-141 | **A hero of unseen levels gets no target field for a Cast Spell order** (found 2026-10-31 scoping P1-11c, by reading, not run; live, players can notice). For a hero hired, raised or charmed this turn (`skillsUnseenP`), the Cast Spell field (`ui/player/order-targets.ts`) lists the spells and returns without `spellSecondaryHtml`, so a Psychic Blast or a Bless Province can't be aimed, though the turn needs a mark. Fix: its own PR, a page case first (the seized hero's spells then filter his lord's heroes, `orderValidity`'s charmed-hero check). | Players: a hero hired, raised or charmed this turn can aim a spell that needs a mark | Phase 1 | Small | – | ⬜ | |

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
