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
change. The foundations, the alignments, the races, the tempers, the hero orders and diplomacy are done, and the
battles' proof, their tables and the first two cuts of the battle against the defenders: the economy, the Reckoning
and the titles, world generation (B-06a to B-06ab), the alignments (P1-19ba1 to P1-19bb9), the races and the tempers
(B-06ac to B-06ak), and the hero orders, diplomacy and the first battle rows (B-06al to B-06ba), in
[the finished list](finished-steps-the-new-items-b-nn.md#b-06-t7-the-rules-pulled-out).
The rest is in these runs, each a stack of its own, whose rows join this table with its first pull request:
- Run 3c's last rows and Run 3d: the battles (B-06bb to B-06bq, below);
- Run 3e, in two: the player portal's alignment rules (B-06br to B-06bu, below), and sight's rows, their own run, last,
  every row Maintainer ✓, which join with that run's row 0, as does their count.

Each row is one `refactor-only` pull request that keeps the game exactly the same, unless it says otherwise. The
tranche's plan, its counts and its risks: #711; Run 3's: #756.

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR | Why here |
|---|---|---|---|---|---|---|---|---|
| B-06bb to B-06bd | The battle against a province's defenders (`combatVsNPC`) split by stage into a folder of its own under the battles' (the-battle-against-the-defenders), its last three cuts, a pull request each: the defenders' pre-battle phases; the lines and fortune to the result; the casualties, the rout and the end. The set-up to the sides and the attacker's pre-battle phases are done (B-06az, B-06ba), with the battle's state the stages share, typed. B-06bb moves the defenders' pre-battle phases; B-06bc the lines and fortune to the result; B-06bd the casualties, the rout and the end, and `combatVsNPC` is its five stages called in order. `refactor-only` | Maintainers: a stage of the battle is found and changed alone | Phase 1 | Medium | – | 🟦 | #788, #790, #791 | Run 3c's next; one file, consecutive rows |
| B-06be | The battle against a province's defenders reads its numbers from content's rows, each named for its rule, not for one battle: the defender's edge and home, Tactical and Naval, a Curse, the tier-up chances, the mastery orders, the cast chance, the experience factors, the decisive margin and the beaten's lessons; the battle between heroes reads the same rows in B-06bk. `refactor-only` | Maintainers: a battle's numbers are rows | Phase 1 | Medium | – | 🟦 | #792 | Run 3c's last |
| B-06bf to B-06bj | The battle between heroes (`combatVsChar`) split by stage into a folder of its own (the-battle-between-heroes), the same five cuts, a pull request each, its pre-battle phases cut as magic, then archery: the set-up, the duel and the sides; the magic and army spells; the archery, Flak and Breach; Sanctuary, the mastery orders, Tactical, the lines, fortune and the result; the casualties, the rout and the end; on B-06az's battle state. B-06bf moves the set-up, the duel and the sides, with the battle's own state, typed; B-06bg the magic and army spells; B-06bh the archery, Flak and Breach; B-06bi Sanctuary, the mastery orders, the lines, fortune and the result; B-06bj the casualties, the rout and the end, and `combatVsChar` is its five stages called in order. `refactor-only` | Maintainers: as B-06az | Phase 1 | Medium | – | 🟦 | #793, #794, #795, #796, #797 | Run 3d's first; one file, consecutive rows |
| B-06bk | The battle between heroes reads its numbers, and its pre-battle phases', from content's rows: B-06be's shared rows, Feigned Retreat beside the mastery orders, its creed's savage fury, and two rows of its own (Sanctuary, a beaten host's chance to stay). `refactor-only` | Maintainers: as B-06be | Phase 1 | Medium | – | 🟦 | #798 | After B-06bj |
| B-06bl | Each battle's stages as one typed list, in the order they run: each battle takes its stage functions from it, and the battle proof reads it. `refactor-only` | Maintainers: a battle's stages read in order | Phase 1 | Small | – | 🟦 | (PR) | After B-06bk |
| B-06bm | A host's strength, the best commander, the ladder, stalled battles, ride-outs and sea-lift retreats: their numbers become rows. `refactor-only` | Maintainers: as B-06be | Phase 1 | Medium | – | ⬜ | – | After B-06bl; the engine's battles then hold no number |
| B-06bn to B-06bp | Personal combat's numbers become rows, in three: to-hit and courage; speed, plans and melee; lair guardians, spells and resolve. `refactor-only` | Maintainers: a duel's numbers are rows | Phase 1 | Medium | – | ⬜ | – | After B-06bm |
| B-06bq | The bots' battle estimate asks the battle's rows; its tuning the bots' first version's weights of a new kind, `battleStrength`, the bot's figures kept. Maintainer ✓: the bots' estimate of a defence. `refactor-only` | Maintainers: the bots follow a change to a battle without new bot code | Phase 1 | Medium | ✓ | ⬜ | – | T7's battles' last; it reads every battle row |
| B-06br | A realm of none reads as Neutral in the player portal and the reports' views from the content's constant, as it does in the engine: the turn-zero page, the join form's fallback, the order form's targets (twice), the charm's and the resurrection's pre-orders, the report's view, the ledger's hire wage, a fallen hero in the turn report and the views' two hire wages ask the alignments' helper (`theAlignmentARealmReadsAs`, P1-19bb1's) in `runTurn0`, `showJoinGame`, `buildTargetField`, `injectResurrectOrders`, `injectCharmOrders`, `renderReportView`, `heroHireWageOfP`, `buildTurnReport`, `otherHeroAsSeen` and `provinceAsSeen`; a unit case for a realm of none; the portal's count of creed checks falls by each. `refactor-only` | Maintainers: a realm of none is Neutral in one place, the portal too | Phase 1 | Small | – | ⬜ | – | Run 3e's portal rows' first, after B-06bp |
| B-06bs | The Research forecast's Neutral double and the beasts' guide ask the rows: the forecast's extra research reads Neutral's research ability, and the guide's Creatures, Monsters, ×1.5 and ×1.25 read the Druidic and Evil battle abilities (`buildTargetField`, `renderReportView`). The parts the forecast leaves out get a `KD-` row, not fixed; the portal's count of creed checks falls by each. `refactor-only` | Maintainers: as B-06br | Phase 1 | Small | – | ⬜ | – | After B-06br |
| B-06bt | The words that restate an alignment rule read the rows' names and numbers, byte for byte the same: Bless's and Consecrate's hints, the consecrated tooltip, the Diplomacy card's war text, the kings' first skills, one Divine and one Undead realm a game (the join form and the page), the battle lines' words and the realm works' words (12 places), a static test anchoring each phrase. No count (prose). May split in two: the hints, tooltip, card and join form; the lines' words. `refactor-only` | Maintainers: a change to an alignment's row changes the words players read about it | Phase 1 | Medium | – | ⬜ | – | After B-06bs |
| B-06bu | The map's relation labels (Neutral, Allied, Enemy, in `_ownerLineP`) and the Diplomacy card's button words read content's relation rows (`THE_STATES_TWO_REALMS_STAND_IN`); the relation's 'Neutral', the one word the portal's count of creed checks lists as not an alignment, leaves its list. `refactor-only` | Maintainers: how two realms stand is named in one place, the portal too | Phase 1 | Small | – | ⬜ | – | Run 3e's portal rows' last |

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
