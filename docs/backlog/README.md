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
change. Its order: first the foundations, then the alignments (P1-19ba1 to P1-19bb9), then the rest (the races, the
tempers, the hero orders, the battle pipeline, diplomacy, sight), scoped later. The foundations are done: the economy,
the Reckoning and the titles, and world generation (B-06a to B-06ab, in [the finished list](finished-steps-the-new-items-b-nn.md#b-06-t7-the-rules-pulled-out)).
The alignments come next, then the rest.
Each row is one `refactor-only` pull request that keeps the game exactly the same, unless it says otherwise. The
tranche's plan, its counts and its risks: #711.

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR | Why here |
|---|---|---|---|---|---|---|---|---|
| P1-19ba1 | The alignment orders' portal half: the order list's `ACTION_DISPLAY_ORDER` names its five creed orders by their rows, and the Wild Hunt's grade is a number of the rite's row, which the target field ("VETERAN"), its forecast and the turn read ([traps.md](../traps.md#a-realms-alignments-rule-is-a-row-of-its-abilities)). `refactor-only` | Maintainers: a creed order's name and the Wild Hunt's grade are each written once, in their rows | Phase 1 | Small | – | 🟦 | #744 | The alignments' first: before the new alignment abilities land |
| P1-19ba2 | The GM's Statistics tab names the five creed orders by their rows' names: "Harvest the Field" and "Perform Rite" for its own "Harvest Field" and "Rite" ([R-189](../rulings/R-189-the-gm-page-names-each-creed-order-as-its-row-does.md), from answer 93). A change the GM sees | The GM: the creed orders' labels match their names | Phase 1 | Small | – | 🟦 | #746 | After P1-19ba1 |
| P1-19bb1 | The engine's "a realm of none reads as Neutral" is one content constant, `THE_ALIGNMENT_A_REALM_OF_NONE_READS_AS`, which its ten readers and a name's fallback ask through one helper ([the guide](../architecture/the-alignment-abilities-registry-its-stages-and-how-to-add-an-ability.md#outside-the-family)). `refactor-only` | Maintainers: an alignment's rule lives in one place before its new abilities land | Phase 1 | Small | – | 🟦 | #747 | The alignments' checks by name that are left, the ratchet counting them |
| P1-19bb2 | The risen dead's race is one content constant, `THE_RACE_THE_RISEN_DEAD_ARE_MADE_AS`, which every raising and Control Undead read; a guardian kind's labels are the content's `MONSTER_CAT_LABELS`, a word for players kept apart from the race ([the guide](../architecture/the-alignment-abilities-registry-its-stages-and-how-to-add-an-ability.md#outside-the-family)). `refactor-only` | Maintainers: as P1-19bb1 | Phase 1 | Small | – | 🟦 | #748 | After P1-19bb1 |
| P1-19bb3 | The Wonders by row, 1 of 2: each Grand Design is a row of `THE_WONDERS` with the alignment it serves, and the battles' and the orders' seven Wonders ask `theWonderServesTheRealm` by its slug ([the guide](../architecture/the-alignment-abilities-registry-its-stages-and-how-to-add-an-ability.md#outside-the-family)). `refactor-only` | Maintainers: a Wonder is one row | Phase 1 | Medium | – | 🟦 | #749 | After P1-19bb2 |
| P1-19bb4 | The Wonders by row, 2 of 2: the turn's five Wonders (the Grand Cathedral's ward, the Free City Charter's tax, the World-Tree Grove's wages, the Deathless Legion's unpaid, the Grand Library) ask `theWonderServesTheRealm` by their slugs, so no rule asks `gdActive` by a creed's name ([the guide](../architecture/the-alignment-abilities-registry-its-stages-and-how-to-add-an-ability.md#outside-the-family)). `refactor-only` | Maintainers: as P1-19bb3 | Phase 1 | Medium | – | 🟦 | #750 | After P1-19bb3 |
| P1-19bb5 | The facts the reports' words read, and Garreth's creed, from the rows: war without warning's dead by the Undead's row, the gulf's Divine crown by the ladder's first rung, a ritual site's Pagan by Perform Rite's creed, Garreth's creed a content constant ([the guide](../architecture/the-alignment-abilities-registry-its-stages-and-how-to-add-an-ability.md#outside-the-family)). `refactor-only` | Maintainers: as P1-19bb1 | Phase 1 | Small | – | 🟦 | #751 | After P1-19bb4 |
| P1-19bb6 | The bots, 1 of 4: a realm of none reads as the content's constant: their estimates, their hires, `botAlignOf`, a bot's alignment with none left to take and the first skills of an alignment with none of its own ([the guide](../architecture/the-alignment-abilities-registry-its-stages-and-how-to-add-an-ability.md#outside-the-family)). `refactor-only` | Maintainers: the bots read an alignment's rows | Phase 1 | Small | – | 🟦 | #752 | After P1-19bb5 |
| P1-19bb7 | The bots, 2 of 4: their orders and their shared rules, exact copies | Maintainers: as P1-19bb6 | Phase 1 | Medium | – | ⬜ | | After P1-19bb6 |
| P1-19bb8 | The bots, 3 of 4: their worth of the alignments' rows, the hook's third family | Maintainers: the bots follow a change to an alignment without new bot code | Phase 1 | Medium | – | ⬜ | | After P1-19bb7 and B-06h's hook |
| P1-19bb9 | The bots, 4 of 4: their tuning keyed by ability, exact copies | Maintainers: as P1-19bb6 | Phase 1 | Medium | – | ⬜ | | The alignments' last row |

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
