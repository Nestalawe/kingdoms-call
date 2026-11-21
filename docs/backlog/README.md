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
change. Its order: first the foundations (the economy, B-06b to B-06h; the Reckoning and the titles, B-06i to B-06r;
world generation, B-06s to B-06ab, which Run 2 scopes again once Run 1 merges), then the alignments (P1-19ba1 to
P1-19bb9), then the rest (the races, the tempers, the hero orders, the battle pipeline, diplomacy, sight), scoped later.
Each row is one `refactor-only` pull request that keeps the game exactly the same, unless it says otherwise. The
tranche's plan, its counts and its risks: #711.

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR | Why here |
|---|---|---|---|---|---|---|---|---|
| B-06a | The ratchet's three counts of Run 1 (the economy's numbers in the engine and in the bots, the titles the engine names) and their static tests; these rows; the defects the scoping found; B-20; the bots' worth hook in the decisions | The maintainers: each row's progress is counted, and a number moved out of sight fails a test | The ground for the redesign | Small | – | 🟦 | #711 | First: the counts the other rows lower |
| B-06b | The economy's prices in content: the price table, the fallback 2g, the skeleton's 1g; one price rule and one wage rule on plain values, which the report's forecast, the ledger and the bots read | The maintainers: a company's price or wage is one content change | The ground for the redesign | Medium | – | 🟦 | #712 | The prices first: the economy's other rows read them |
| B-06c | The tax's stages in Early Winter: Bless, the earthquake, sabotage, Enslave, the Wonder, the titles' and the Thief's gold; the forecast asks the same runner | The maintainers: a change to a realm's tax is one row | The ground for the redesign | Medium | – | 🟦 | #714 | After B-06b |
| B-06d | The wages' stages: a company's (the skeleton, war spoils, the Druid, the Host-Leader) and the hero's wage formula, its three copies | The maintainers: a wage rule is one row | The ground for the redesign | Medium | – | 🟦 | #715 | After B-06c |
| B-06e | Not paying: the disband order, hulls at sea, desertion's 0.4, in a row (the dice untouched) | The maintainers: what an unpaid realm loses is one row | The ground for the redesign | Small | – | 🟦 | #716 | After B-06d, which it reads |
| B-06f | The orders' prices: the mercenary floor, the Wild Hunt's 6, the Grand Heist's 7 (the Druid's half went with B-06d, #715) | The maintainers: an order's price is one content change | The ground for the redesign | Small | – | 🟦 | #717 | After B-06b's price rule |
| B-06g | Gold found and taken: the lairs' bands, the Sage's +5, a raid's loot (the spies' gold stays with espionage) | The maintainers: a lair's or a raid's gold is one content change | The ground for the redesign | Small | – | ⬜ | | The economy's last engine row |
| B-06h | The bots' worth of gold, the hook's first family: the bot asks the rule what an effect does, and its version's weights file says what a gold is worth ([the decision](../decisions/README.md#the-decisions-on-how-the-work-runs)); the bots' upkeep and tax ask B-06c's and B-06d's runners where they agree today | The maintainers: the bots follow a change to the economy without new bot code | The ground for the redesign | Medium | – | ⬜ | | After B-06c and B-06d, whose runners it asks |
| B-06i | The minor titles' rows in content, and their registry | The maintainers: a minor title is one content row | The ground for the redesign | Medium | – | ⬜ | | The titles' first row: the others read the registry |
| B-06j | Personal combat: a hero's titles add to his skills, from their rows | The maintainers: a title's duel perk is one row | The ground for the redesign | Small | – | ⬜ | | After B-06i |
| B-06k | A host's strength: a hero's titles add to his Tactical; the commander's titles | The maintainers: a title's battle perk is one row | The ground for the redesign | Small | – | ⬜ | | After B-06i |
| B-06l | Movement and orders: the Swift, the Sea-Wolf, the Shadow, the Loreseeker, the Trailblazer, the Colossus, the Warlock | The maintainers: a title's order perk is one row | The ground for the redesign | Small | – | ⬜ | | After B-06i |
| B-06m | Early Winter: the titles' tax and wage cuts, and the report's copy (R-172 is not built here) | The maintainers: a title's gold is one row | The ground for the redesign | Small | – | ⬜ | | After B-06c and B-06i |
| B-06n | The Imperial Titles' measures as row fields (the metric, the skill, the deed, the divisor, the dead's ×0.75); a hook point for a standing | The maintainers: an Imperial Title's measure is one row | The ground for the redesign | Medium | – | ⬜ | | After B-06i |
| B-06o | The title intelligence as an effect a row, 1 of 2: the realms' boards, each block moved exactly as it is | The maintainers: a title's report is one row | The ground for the redesign | Medium | ✓ | ⬜ | | After B-06n; what a realm can see |
| B-06p | The title intelligence, 2 of 2: the heroes', the graves' and the ledger's, each block moved exactly as it is | The maintainers: a title's report is one row | The ground for the redesign | Medium | ✓ | ⬜ | | After B-06o; what a realm can see |
| B-06q | The Reckoning's numbers in a row, which the portal reads; a test holds the books' bar table to them | The maintainers: the Reckoning's bar is one row | The ground for the redesign | Small | – | ⬜ | | After B-06n |
| B-06r | The bots' worth of a title, the hook's second family; the bots' knobs no code reads go | The maintainers: the bots follow a change to a title without new bot code | The ground for the redesign | Small | – | ⬜ | | Run 1's last row: after B-06h's hook |
| B-06s | The world's making's proof: each seed in a fresh worker, a hash of the world and of the dice drawn by stage, over seeds, map sizes, sea shares and realm mixes; baselines from `main`. Run 2 scopes it again | The maintainers: a move in the world's making is proved to change no world | The ground for the redesign | Medium | – | ⬜ | | Run 2's first: the proof its rows give |
| B-06t | The making's lists to content, word for word and in order (the name pools, the sea features, the beast banks merged, the fleets, the skill pools, the bots' skill builds) | The maintainers: a name pool or a bank is a content change | The ground for the redesign | Medium | – | ⬜ | | After B-06s |
| B-06u | The making's numbers to parameter rows | The maintainers: a world's shape is a content change | The ground for the redesign | Medium | – | ⬜ | | After B-06t |
| B-06v | The world's making split by stage, 1 of 6: stages 0 to 2 | The maintainers: each stage of the making is a file of its own | The ground for the redesign | Medium | – | ⬜ | | After B-06u |
| B-06w | The making split, 2 of 6: stage 3 | The maintainers: as B-06v | The ground for the redesign | Medium | – | ⬜ | | After B-06v |
| B-06x | The making split, 3 of 6: stages 4 to 8 | The maintainers: as B-06v | The ground for the redesign | Medium | – | ⬜ | | After B-06w |
| B-06y | The making split, 4 of 6: stage 9 | The maintainers: as B-06v | The ground for the redesign | Medium | – | ⬜ | | After B-06x |
| B-06z | The making split, 5 of 6: stages 10 to 15 | The maintainers: as B-06v | The ground for the redesign | Medium | – | ⬜ | | After B-06y |
| B-06aa | The making split, 6 of 6: stages 16 and 17 | The maintainers: as B-06v | The ground for the redesign | Medium | – | ⬜ | | After B-06z |
| B-06ab | The making's stages as one list, in order, typed | The maintainers: a new stage is one entry | The ground for the redesign | Small | – | ⬜ | | The foundations' last row |
| P1-19ba1 | The alignment orders' portal half: the order list's `ACTION_DISPLAY_ORDER` and the target field's "VETERAN" read from the alignment abilities' rows (the Wild Hunt's grade a row number), not written by hand ([traps.md](../traps.md#a-realms-alignments-rule-is-a-row-of-its-abilities)). `refactor-only` | Maintainers: a new creed order shows in the form without editing these lists | Phase 1 | Small | – | ⬜ | | The alignments' first: before the new alignment abilities land |
| P1-19ba2 | The GM page reads the creed orders' names from their rows ("Harvest the Field", "Perform Rite", where it writes "Harvest Field" and "Rite"; answer 93, its ruling in this row's pull request). A change the GM sees | The GM: the creed orders' labels match their names | Phase 1 | Small | – | ⬜ | | After P1-19ba1 |
| P1-19bb1 | The engine's "a realm of none reads as Neutral": one content constant | Maintainers: an alignment's rule lives in one place before its new abilities land | Phase 1 | Small | – | ⬜ | | The alignments' checks by name that are left, the ratchet counting them |
| P1-19bb2 | The risen dead's race, and a guardian kind's label, from their rows | Maintainers: as P1-19bb1 | Phase 1 | Small | – | ⬜ | | After P1-19bb1 |
| P1-19bb3 | The Wonders by row (each Grand Design its row and its alignment), 1 of 2: the battles and the orders | Maintainers: a Wonder is one row | Phase 1 | Medium | – | ⬜ | | After P1-19bb2 |
| P1-19bb4 | The Wonders by row, 2 of 2: the turn | Maintainers: as P1-19bb3 | Phase 1 | Medium | – | ⬜ | | After P1-19bb3 |
| P1-19bb5 | The engine's words of the alignments, and Garreth's set-up | Maintainers: as P1-19bb1 | Phase 1 | Small | – | ⬜ | | After P1-19bb4 |
| P1-19bb6 | The bots, 1 of 4: a realm of none | Maintainers: the bots read an alignment's rows | Phase 1 | Small | – | ⬜ | | After P1-19bb1 |
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
