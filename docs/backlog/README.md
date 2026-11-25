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
[the finished list](finished-steps-p1-13-to-p1-25.md). The tranches "Phase 1's rest" and "The reports' audience in one
place" are done too: P1-11z, B-16, B-18 and B-19 are in the finished lists.

### 1. T7, the rules pulled out

B-06 is a group, not a row ([how to read a row](#how-to-read-a-row)): the rules pulled out. Each family of rules is
counted by the ratchet and moved into content's rows, each with its bot valuation hook
([the decision](../decisions/README.md#the-decisions-on-how-the-work-runs)), so that a redesign item becomes a content
change. The foundations, the alignments, the races, the tempers, the hero orders, diplomacy, the battles' rules and
personal combat are done, all but the bots' battle estimate: the economy, the Reckoning and the titles, world
generation (B-06a to B-06ab), the alignments (P1-19ba1 to P1-19bb9), the races and the tempers (B-06ac to B-06ak), the
hero orders and diplomacy (B-06al to B-06av), and the battles and personal combat (B-06aw to B-06bp), in
[the finished list](finished-steps-the-new-items-b-nn.md#b-06-t7-the-rules-pulled-out).
The rest is Run 3e, a stack of its own:
- the player portal's alignment rules (B-06br to B-06bu, below), then the bots' battle estimate (B-06bq, below);
- then sight's rows (B-06bv to B-06by, below), their own part, last, every row Maintainer ✓, with their count
  (`sightNumbersInEngine`).

Each row is one `refactor-only` pull request that keeps the game exactly the same, unless it says otherwise. The
tranche's plan, its counts and its risks: #711; Run 3's: #756.

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR | Why here |
|---|---|---|---|---|---|---|---|---|
| B-06br | A realm of none reads as Neutral in the player portal and the reports' views from the content's constant, as it does in the engine: the turn-zero page, the join form's fallback, the order form's targets (twice), the charm's and the resurrection's pre-orders, the report's view, the ledger's hire wage, a fallen hero in the turn report and the views' two hire wages ask the alignments' helper (`theAlignmentARealmReadsAs`, P1-19bb1's) in `runTurn0`, `showJoinGame`, `buildTargetField`, `injectResurrectOrders`, `injectCharmOrders`, `renderReportView`, `heroHireWageOfP`, `buildTurnReport`, `otherHeroAsSeen` and `provinceAsSeen`; a unit case for a realm of none; the portal's count of creed checks falls by each. `refactor-only` | Maintainers: a realm of none is Neutral in one place, the portal too | Phase 1 | Small | – | 🟦 | #805 | Run 3e's portal rows' first, after B-06bp |
| B-06bs | The Research forecast's Neutral double and the beasts' guide ask the rows: the forecast's extra research reads Neutral's research ability, and the guide's Creatures, Monsters, ×1.5 and ×1.25 read the Druidic and Evil battle abilities (`buildTargetField`, `renderReportView`). The parts the forecast leaves out have their `KD-` row (KD-476), not fixed; the portal's count of creed checks falls by each, 11 to 5. `refactor-only` | Maintainers: as B-06br | Phase 1 | Small | – | 🟦 | #807 | After B-06br |
| B-06bt | The words that restate an alignment rule read the rows' names and numbers, byte for byte the same: Bless's and Consecrate's hints, the consecrated tooltip, the Diplomacy card's war text, the kings' first skills, one Divine and one Undead realm a game (the join form; the page's options and note held to the rows), the battle lines' words and the realm works' words; a static test anchors each place, and each number written as a word, to its rows. No count (prose). `refactor-only` | Maintainers: a change to an alignment's row changes the words players read about it | Phase 1 | Medium | – | 🟦 | #808 | After B-06bs |
| B-06bu | The map's relation names (Neutral, Allied, Enemy, in `_ownerLineP`: their names a row of their own beside the states) and the Diplomacy card's badge and buttons read content's relation rows (`THE_STATES_TWO_REALMS_STAND_IN`, `THE_TREAT_DECLARATION`), the words the same; the relation's 'Neutral', the one word the portal's count of creed checks listed as not an alignment, leaves its list (the count stays 5). `refactor-only` | Maintainers: how two realms stand is named in one place, the portal too | Phase 1 | Small | – | 🟦 | #809 | After B-06bt; the portal rows' last, before B-06bq |
| B-06bq | The bots' battle estimate asks the battle's rows (and a Druid shortfall's new row, which the rule reads too); its tuning is the bots' first version's weights of a new kind, `battleStrength`, the bot's figures kept (KD-477). Maintainer ✓: the bots' estimate of a defence. `refactor-only` | Maintainers: the bots follow a change to a battle without new bot code | Phase 1 | Medium | ✓ | 🟦 | #810 | After B-06bu; T7's battles' last, it reads every battle row |
| B-06bv | The turn's sight rules read their numbers from content's rows (`armySizeBand`, `spotEnemyInOwnedProvince`, `applySpySuccess`); sight's count falls to 0. Maintainer ✓: the turn's reports. `refactor-only` | Maintainers: a change to a sight rule's number is a change to its row | Phase 1 | Small | ✓ | ⬜ | – | Sight's rows' first, after B-06bq |
| B-06bw | The turn's report and the bots read one sight rule, each copy kept exactly as it is, with a unit test on a staged world that holds each copy. May split in two: the report's copy; the bots' copy. Maintainer ✓: the turn's reports. `refactor-only` | Maintainers: the report's and the bots' sight rule in one place, held by a test | Phase 1 | Medium | ✓ | ⬜ | – | After B-06bv |
| B-06bx | The views' last creed checks ask the alignments' rows; the portal's count of creed checks falls to 0. Maintainer ✓: the turn's reports. `refactor-only` | Maintainers: as B-06br | Phase 1 | Small | ✓ | ⬜ | – | After B-06bw |
| B-06by | The views' own hex neighbours ask the engine's neighbour rule, a test first that both agree on the map's wrapped edge. Maintainer ✓: the turn's reports. `refactor-only` | Maintainers: one rule for which provinces are neighbours, the views too | Phase 1 | Small | ✓ | ⬜ | – | After B-06bx; sight's rows' last |

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
