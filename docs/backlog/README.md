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
change. The foundations and the alignments are done: the economy, the Reckoning and the titles, world generation
(B-06a to B-06ab) and the alignments (P1-19ba1 to P1-19bb9), in [the finished list](finished-steps-the-new-items-b-nn.md#b-06-t7-the-rules-pulled-out).
The rest is in five runs, each a stack of its own, whose rows join this table with its first pull request:
- Run 3a: the races and the tempers (B-06ac to B-06ak, below);
- Run 3b: the hero orders and diplomacy;
- Runs 3c and 3d: the battles;
- Run 3e: the player portal's alignment rules and the last rows.

Each row is one `refactor-only` pull request that keeps the game exactly the same, unless it says otherwise. The
tranche's plan, its counts and its risks: #711; Run 3's: #756.

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR | Why here |
|---|---|---|---|---|---|---|---|---|
| B-06ac | A company or province of no race reads as Human, and the wild's race (`Primal`, or a `Primal:` sub-race): each one content constant, the wild's race with one helper, which their readers in the engine ask: the graves, the Call to Arms company, the conquest, an heir's race, the defenders' resync, a recruit, the disband, the Wild Hunt, Awaken Grove and the sea beasts. `refactor-only` | Maintainers: a race's fallback and the wild's race are each written once | Phase 1 | Small | – | 🟦 | #757 | Run 3a's first: B-06ad, B-06ag, B-06ah and B-06ak read its constants |
| B-06ad | The world's making's race words ask B-06ac's constants and two helpers of the wild's sub-races: its stages' race checks, each race's heartland (a content table), the fleet a home of each race offers (read from content's fleets) and a name's fallback race; the same seed makes the same world, byte for byte. `refactor-only` | Maintainers: the races' rules for the world live in content | Phase 1 | Medium | – | 🟦 | #759 | After B-06ac; alone in the world's making |
| B-06ae | The race gifts in battle, 1 of 2: each gift a row of content (its race, its factor, its ground or side) and an entry in the race gifts' registry, whose runners a host's strength (Woodland Mastery, the Bulwark), Raiders' Muster's flag and the War-spoils mark and its Early Winter test ask; Home of the Wild stays as it is (question 79). `refactor-only` | Maintainers: a race's gift in battle is one row | Phase 1 | Medium | – | 🟦 | #760 | After B-06ad |
| B-06af | The race gifts on heroes and companies, 2 of 2: Quick learners (in the field and at practice), Drillmasters, Iron constitution (its hit points in its row), Mithril Armour (at the start, on a hire and by the Broker) and Homeward Flight (its chances in its row) are rows of the race gifts, whose runners the engine asks; the same world, byte for byte. `refactor-only` | Maintainers: as B-06ae | Phase 1 | Medium | – | 🟦 | #761 | After B-06ae |
| B-06ag | The race tables in content: the race of each unit type a discovery reaches, copied as it is; the Plague's peoples read from content's list of humanoid races; the company each race musters at a Call to Arms; an old save's race renames and beast words. `refactor-only` | Maintainers: each race table is written once, in content | Phase 1 | Small | – | 🟦 | #762 | After B-06af |
| B-06ah | The bots' races: their fallbacks and their checks of the wild ask B-06ac's constants, their ground factor asks the gifts' rows and the kin rule, and their race margins are the bots' first version's weights of a race's gift (the hook's fourth kind, `raceGift`), the bot's figures kept (a `KD-` row each where a bot's copy differs). `refactor-only` | Maintainers: the bots follow a change to a race without new bot code | Phase 1 | Medium | – | 🟦 | #763 | After B-06ag; the engine then names no race outside its rules |
| B-06ai | The tempers on their rows: a hero of no temper fights as Brave (one content constant), and the automatic duel plan's ways, a commander's answer to a duel and terror's test of courage, each by temper, are fields of the tempers' rows. `refactor-only` | Maintainers: a temper's rules are its row | Phase 1 | Small | – | 🟦 | #764 | After B-06ah |
| B-06aj | The bots' tempers: their duel rating and the king's temper on their war bar are the bots' first version's weights (the hook's fifth kind, `temper`), the bot's figures kept (KD-467). `refactor-only` | Maintainers: as B-06ah, for the tempers | Phase 1 | Small | – | 🟦 | #765 | After B-06ai; the engine then names no temper outside its rules |
| B-06ak | The player portal's races and tempers: a sub-race's class from content, which the race's label and tags read; the practice note asks the Quick learners rule; the Call to Arms target asks B-06ac's helper; the four Brave defaults read B-06ai's constant; a static test holds the briefing's temper figures to the tempers' rows. `refactor-only` | Players later: the portal says what the races and tempers do, from their rows | Phase 1 | Small | – | 🟦 | #766 | Run 3a's last: it reads every constant before it |

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
