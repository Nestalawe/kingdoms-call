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
change. The foundations, the alignments, the races and the tempers are done: the economy, the Reckoning and the
titles, world generation (B-06a to B-06ab), the alignments (P1-19ba1 to P1-19bb9), and the races and the tempers
(B-06ac to B-06ak), in [the finished list](finished-steps-the-new-items-b-nn.md#b-06-t7-the-rules-pulled-out).
The rest is in four runs, each a stack of its own, whose rows join this table with its first pull request:
- Run 3b: the hero orders and diplomacy (B-06al to B-06av, below);
- Runs 3c and 3d: the battles (B-06aw to B-06bq, below);
- Run 3e: the player portal's alignment rules and the last rows.

Each row is one `refactor-only` pull request that keeps the game exactly the same, unless it says otherwise. The
tranche's plan, its counts and its risks: #711; Run 3's: #756.

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR | Why here |
|---|---|---|---|---|---|---|---|---|
| B-06al | The hero orders' rows: each order is a row of content (its key, the names the turn reads, its tier; Pursue a row of its own, read as an Encounter), the mastery orders' rows joined by key and the creed orders' built from theirs; the kind of an order is read from the rows' keys, and the turn's names for the orders and the reading of a blank or unknown one are built from them (`THE_HERO_ORDERS` in content; `OrderKind`, `PHASE_ACTION_MAP` and `normaliseAction` from it). `refactor-only` | Maintainers: an order's names and tier are its row | Phase 1 | Medium | – | 🟦 | #768 | Run 3b's first: every order row after reads its rows |
| B-06am | The phase's order by row: which step of a phase an order acts in, the phase's stages and the intents read it from the order's row; a Forced March acts with the orders that stay put, exactly as now (answer 133: KD-065's fix moves it, after T7); the player portal's forecast follows, as it shares the code (`theTierAnOrderActsIn`, the phase stages' flushes, the intents). `refactor-only` | Maintainers: as B-06al | Phase 1 | Small | – | 🟦 | #770 | After B-06al |
| B-06an | The checks before an order as fields of its row: what a seized hero refuses (a mastery spell too), a mastery once a turn, no mastery from a hero who joined this turn (R-048, moved as it is), the orders a battle pins, Forced March's remap, Use Item's cast, the bots' Practice and Search rewrites (`processOrder`, above its switch). `refactor-only` | Maintainers: an order's limits are its row | Phase 1 | Medium | – | 🟦 | #771 | After B-06am; edits the dispatch above the switch |
| B-06ao | The dispatch as a registry: each order's resolver keyed by its row, every order kind but Forced March's (a Move by then) given one (`satisfies Record<…>`, a compile test of its own: the registry imports the engine), `processOrder`'s switch gone; the resolvers unchanged. `refactor-only` | Maintainers: a new order is a row and its resolver | Phase 1 | Medium | – | 🟦 | #772 | After B-06an; the switch itself |
| B-06ap | The rest of the orders' names in the engine: the move order, ride-outs, pursuits, the charm's and resurrection's default Defend, the hire pre-orders, a line's helper and the removed orders read the rows. `refactor-only` | Maintainers: as B-06al | Phase 1 | Small | – | 🟦 | #773 | After B-06ao; the engine, but its bots and rules, then names no order's kind |
| B-06aq | The relation's one reader: the engine's copies of how two realms stand ask its reader; the relation states are content constants, and the key of a pair of realms is written once more in the engine, not four times (`relKeyOf` and `relationBetween` asked). `refactor-only` | Maintainers: how two realms stand is read one way | Phase 1 | Small | – | ⬜ | – | After B-06ap |
| B-06ar | The diplomacy ladder in a row: a mutual Treat's step, a war's step and the overture's kind, and the small game's limit (no alliance at 3 realms or fewer) one content number its three readers ask (`validDecl`, the resolution and the report). `refactor-only` | Maintainers: diplomacy's steps and limit are one row | Phase 1 | Small | – | ⬜ | – | After B-06aq; the engine outside the bots then names no relation |
| B-06as | The bots' orders, 1 of 2: their first phase's urgency, attacks and filler read the orders' rows (tier, a march, a mastery), each bot's set copied exactly (a `KD-` row where a bot's set differs). `refactor-only` | Maintainers: the bots follow a change to an order without new bot code | Phase 1 | Medium | – | ⬜ | – | After B-06ar; reads B-06al's rows |
| B-06at | The bots' orders, 2 of 2: their economy, spellcraft, strategy, missions, movement and specialists read the orders' rows. `refactor-only` | Maintainers: as B-06as | Phase 1 | Medium | – | ⬜ | – | After B-06as; the bots then name no order |
| B-06au | The bots' relations, 1 of 2: their strategy, war, diplomacy and intel ask the relation's readers (`areEnemies`, `areAllied`, `relationBetween`). `refactor-only` | Maintainers: the bots read relations as the engine does | Phase 1 | Small | – | ⬜ | – | After B-06at |
| B-06av | The bots' relations, 2 of 2: their missions, specialists, spellcraft, movement and first phase ask the relation's readers. `refactor-only` | Maintainers: as B-06au | Phase 1 | Small | – | ⬜ | – | Run 3b's last; the bots then name no relation |
| B-06aw | The battle-by-battle proof: the same battle, the same lines and the same dice by stage, against the base (`npm run proof:battles`), on a grid of cases the balance games miss (sea battles, landings, leaderless garrisons, the rare rout paths); the battle lines the matrix misses listed. `refactor-only` | Maintainers: each battle row after is proved battle by battle | Phase 1 | Medium | – | ⬜ | – | Run 3c's first: every battle row after runs it |
| B-06ax | The ground's table (each unit's factor on each terrain, `TERRAIN_MODS`) moves to content verbatim. `refactor-only` | Maintainers: the ground's factors are one table in content | Phase 1 | Small | – | ⬜ | – | After B-06aw |
| B-06ay | The margin bands, carry-on, the battle grid's tables and the single constants become parameter rows; a static test holds the rulebook's bands table and carry-on to them (may split in two). `refactor-only` | Maintainers: a battle's bands and grid are rows | Phase 1 | Medium | – | ⬜ | – | After B-06ax |
| B-06az to B-06bd | The battle against a province's defenders (`combatVsNPC`) split by stage into a folder of its own under the battles' (the-battle-against-the-defenders), a pull request each: set-up to the sides; the attacker's pre-battle phases; the defenders' pre-battle phases; the lines and fortune to the result; the casualties, the rout and the end. B-06az designs the battle's state the stages share. `refactor-only` | Maintainers: a stage of the battle is found and changed alone | Phase 1 | Medium | – | ⬜ | – | After B-06ay; one file, consecutive rows |
| B-06be | The defenders' battle's numbers become parameter rows: the shared ones (the defender's edge, home, Tactical and Naval, the experience multipliers) read by both battles later. `refactor-only` | Maintainers: a battle's numbers are rows | Phase 1 | Medium | – | ⬜ | – | Run 3c's last |
| B-06bf to B-06bj | The battle between heroes (`combatVsChar`) split by stage into a folder of its own (the-battle-between-heroes), the same five cuts, on B-06az's battle state. `refactor-only` | Maintainers: as B-06az | Phase 1 | Medium | – | ⬜ | – | Run 3d's first; one file, consecutive rows |
| B-06bk | The battle between heroes' numbers, and its pre-battle phases', read B-06be's rows. `refactor-only` | Maintainers: as B-06be | Phase 1 | Medium | – | ⬜ | – | After B-06bj |
| B-06bl | Each battle's stages as one typed list, in the order they run. `refactor-only` | Maintainers: a battle's stages read in order | Phase 1 | Small | – | ⬜ | – | After B-06bk |
| B-06bm | A host's strength, the best commander, the ladder, stalled battles, ride-outs and sea-lift retreats: their numbers become rows. `refactor-only` | Maintainers: as B-06be | Phase 1 | Medium | – | ⬜ | – | After B-06bl; the engine's battles then hold no number |
| B-06bn to B-06bp | Personal combat's numbers become rows, in three: to-hit and courage; speed, plans and melee; lair guardians, spells and resolve. `refactor-only` | Maintainers: a duel's numbers are rows | Phase 1 | Medium | – | ⬜ | – | After B-06bm |
| B-06bq | The bots' battle estimate asks the battle's rows; its tuning the bots' first version's weights of a new kind, `battleStrength`, the bot's figures kept. Maintainer ✓: the bots' estimate of a defence. `refactor-only` | Maintainers: the bots follow a change to a battle without new bot code | Phase 1 | Medium | ✓ | ⬜ | – | T7's battles' last; it reads every battle row |

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
