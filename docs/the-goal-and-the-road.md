# The goal and the road

Where the work is, what comes next, and the goal it serves: each phase's goal and exit criteria, each marked met or
not yet met. The dates are New Zealand dates. A maintainer checks a phase's exit criteria with evidence, and the result is
recorded here.

## Where we are (15 November 2026)

- **Batches can start.** `main` has been [batch-ready](#batch-ready) since 10 November. The changes start on
  Thursday 19 November ([below](#the-changes-from-thursday-19-november)).
- **The alignment abilities family** (the registry the new alignment abilities are built in) merged on 15 November
  ([its registry](architecture/the-alignment-abilities-registry-its-stages-and-how-to-add-an-ability.md)).
- **The types are nearly finished.** Every engine file is typed. Nine of the UI's files still start with
  `@ts-nocheck`, and 19 test files still use the old database stub (`stub-db`). Their last rows are in
  [the backlog](backlog/README.md).
- **Phase 0 is passed; Phase 1 is under way** (its batch-ready part met); Phases 2 and 3 have steps waiting; Phase 4
  waits for the design phases.

## What comes next

1. **16 and 17 November:** the plan's public parts move into `docs/` (this file is one of them).
2. **18 November:** the batch rehearsal: the docs a batch agent reads are checked against `main`, `/making-a-change`
   is tried on made-up changes, and the open items in the first areas are listed. Its fixes are one pull request.
3. **From 19 November:** the top of [the backlog](backlog/README.md), one piece of work at a time, each positioned by
   its impact ([the decisions](decisions/README.md#the-decisions-on-how-the-work-runs)). The batches of the new
   alignment abilities ([below](#the-changes-from-thursday-19-november)) are backlog items too; so are the rules pulled
   out and the design matrix ([after Thursday](#the-road-after-thursday)).

## The changes from Thursday 19 November

The first changes are **the new alignment abilities**. They arrive as **one batch an alignment** (a maintainer's answer of 15
November), and each batch's pull request says what it changes. Two rulings set how they reach the game: each reaches
every running game as it goes live ([R-177](rulings/R-177-rule-changes-reach-running-games.md)), and they are built as
the test games played them
([R-178](rulings/R-178-the-new-alignment-abilities-are-built-as-the-test-games-played-them.md)). Each batch builds from
the abilities sheet (below). The questions still open are in [the questions
file](questions-for-the-maintainers.md).

## The design documents

Both are the owner's own. They are named here and not copied, until the owner agrees to it.
- **The design document** sets out the game the owner is aiming for: the design targets, and the phases in which the
  game is redesigned, item by item. The design matrix will score each option of a rule against those targets.
- **The sheet of the new alignment abilities** says what each ability does. Each batch of Thursday's changes builds
  from it, with the lines [R-178](rulings/R-178-the-new-alignment-abilities-are-built-as-the-test-games-played-them.md)
  adds.

## Batch-ready

**Batch-ready** is the point at which the batches can start (a maintainer, 30 October), before the end of Phase 1. The code
is batch-ready when all four of these hold:
1. **Every content family is in the [rule registry](architecture/the-rule-registry-and-the-one-source-for-shared-rules.md)**:
   unit abilities, items, spells, discoveries, guardian perks and the alignment orders. Met: the ratchet counts 0
   checks by name for each.
2. **Every report line is a fact with an audience**, and each realm's report is built only from what that realm
   sees ([a line of the turn](architecture/a-line-of-the-turn-emit-its-facts-and-the-reports.md)). Met.
3. **No known breach** of the invariants or the leak checks: `KNOWN_BREACHES` is empty (`tests/lib/invariants.ts`).
   Met.
4. **The save is versioned** and checked before a turn runs
   ([a saved game](architecture/a-saved-game-its-version-its-upgrade-its-check.md)). Met on 10 November.

The rest of Phase 1 is in [the backlog](backlog/README.md).

## The levels

The road to batches was planned on 1 November in levels:
- **Level 2 is batch-ready** (above). Met on 10 November.
- **Level 3 is batch-ready plus the parts batches touch, finished:** the player portal on the engine's functions (its
  copies of the rules gone, each disagreement ruled by a maintainer), the content families' leftovers in the registry, strict
  types in the battles, the orders and the views, their old test scripts as Vitest tests, the import rules of the
  views and the prose, and the docs and skills a batch agent uses. **This was the target** (a maintainer, 1 November). Every
  piece is on `main`: the last, the player portal's copies file, was retired on 12 November.
- **Level 4 is the rest of Phase 1**, in the backlog. Part of it: the whole codebase is typed
  ([the decision](decisions/README.md#the-decisions-on-how-the-work-runs), "Type the whole codebase").

## The road after Thursday

A maintainer's direction of 8 November sets the road to the redesign. Five of its six points are decisions: [type the
whole codebase, every rule into the registry, the regression matrix stays, a separate design matrix, and the rulebooks
rendered from content](decisions/README.md#the-decisions-on-how-the-work-runs). The sixth: **the bots get a feedback
loop** (their strategy as weights in data, tuned by playing themselves, and their choices compared with players'
orders), and **a tool reads players' games as totals only**. That tool changes who can see data, so a maintainer reviews it,
and its database pull request comes first.

The order, each a tranche of about 15 to 30 rows, a run, and a merge as one group:

| Tranche | What it delivers | Where it is |
|---|---|---|
| T5: the saves | Batch-ready: every save versioned and checked before a turn runs; the engine's turn files typed | Done, 10 November |
| T6: the types finished | No `@ts-nocheck` left; `stub-db` deleted; the pages reach the database only through `src/db/` (done) | The last rows after 19 November |
| T7: the rules pulled out | A redesign item becomes a content change: a count for each family first, then the families in the order of the design phases, each with its bot valuation hook | Next, if a maintainer chooses it |
| The instruments, in `tools/` only | The design matrix and its scorecard (the cost a game measured first), then the tool that reads players' games, then the page that shows the game as it is | If a maintainer chooses it |

Also on the road:
- **A long-lived playtest site**, with its own database, where players try a rule's options (a maintainer's answer of
  15 November). Its running cost is checked first. It is a step still to be planned, with a database
  part.
- **No rulesets.** A rule change reaches every running game, so no game keeps the rules it started with
  ([R-177](rulings/R-177-rule-changes-reach-running-games.md)).
- **Experiments stay off `main`**, as content overlays or branches tried through the design matrix. Only the chosen
  design takes the full pull-request routine. Each design item names the rulings it replaces.
- **Can wait, where the redesign will rewrite the code:** the renames (P1-24), the state reshapes (P1-20), and the
  rest of the duplication work.

## The phases

### Phase 0: the foundation. Passed on 16 October

**Goal.** Every change goes through git, tests and staging. The database is under version control and tested. The
first security steps are done. The owner no longer uploads files or pastes SQL.

**Exit criteria**, all met (a maintainer checked each, with evidence, on 16 October):
- Every production deploy since the cutover (8 October) came from a merged pull request with green CI.
- A maintainer released at least three batches through a pull request, staging and the merge.
- `npm test` is green on `main`, and every pull request proves its tests fail first (amended: no CI check for it).
- `supabase/migrations/` holds the baseline and every change since, and production matches it.
- Phase 0's security steps are done.
- The hostile-name tests and the HTML checks are green.
- No page loads a script from another site.
- `docs/` has the architecture, the traps and the rulings; the old development log isn't in the repo.

### Phase 1: the engine rebuilt on a standard TypeScript stack

**Goal.** The turn engine is rebuilt in small, typed modules: a pure, seeded turn function; every event recorded as a
fact before any player reads of it; one place that decides what each realm sees; one home for each content effect;
and a player portal that uses the engine's own functions. The whole codebase uses the standard TypeScript tools
([the toolchain](architecture/the-toolchain-the-checks-and-the-harness.md)), and an agent reads only the module it
changes.

| Exit criterion | State on `main` |
|---|---|
| `resolveTurn` is pure; `runTurn` is a thin shell; the rules live in `src/engine/` | Not yet met: `resolveTurn` reads no database, screen or clock, but it still lends the turn's dice through the shared `kcRng` |
| The toolset is in place (TypeScript, Vite, Vitest, Playwright, ESLint, Prettier, Zod, Dependabot); the old runner and the stitch build are gone | Met |
| The balance matrix and the invariants run on every engine pull request; the nightly run exists; `KNOWN_BREACHES` is empty | Met |
| Every report line goes through `emit` and the perception pass; `playerView` exists | Met |
| No content effect is checked by name outside the registry | Met for every content family; the alignments' 70 checks by name move with "every rule into the registry" |
| No copy of a rule is left in the player portal; a maintainer ruled each disagreement | Met as far as the checks find: the copies file was retired on 12 November; the step (P1-11) is still open |
| All code is TypeScript; the engine side is strict; database access is typed | Not yet met: 9 UI files with `@ts-nocheck`, 81 old test files in JavaScript |
| No known import-rule violation and no unused code; no ESLint suppression on the engine side | Not yet met: 1 known violation, 16 unused, 216 suppressions in `src/engine/` and `src/views/` |
| No hand-typed stamps; hashed assets; the version banner works | Met |
| The harness is enforced: hooks, the Node pin, ratchets, coverage thresholds and the harness test, in CI | Met |
| Pages reach the database only through the access layer, tested per role against the local Supabase; `stub-db` deleted; property tests with fixed seeds; two mutation sessions or more | Not yet met: 19 test files still use `stub-db` |
| The architecture checks run in CI: the layers and cycles, knip, the purity test, the registry and content completeness tests; the module map is generated | Not yet met: the content completeness test isn't written |
| No test injects code into a page's source; every test is TypeScript; saves are versioned and checked; items have ids | Not yet met: the saves part is met; 81 old JavaScript tests are left; items have no ids yet (P1-20) |
| Names say what the code does: the glossary's renames (P1-24) | Not yet met |
| A typical batch item needs only `CLAUDE.md`, the architecture overview and one to three modules (checked on three batches) | Not yet met: no batch since |

### Phase 2: the database decides, and turns are kept

**Goal.** The database decides who may read and write what, and when a turn may run; the GM's page still runs the
turn. Every turn is kept and can be restored. A live bug can be reproduced as a made-up test, with no player data in
git or CI. Players can download their own chronicle.

**Exit criteria**, none met yet:
- Every turn is recorded and reproduces from its seed; "Restore turn" works, tried once on staging.
- The turn lock and its breaker are live.
- The database's own tests (pgTAP) prove what each role may read and write, the messaging rules included.
- The chronicle download works on a desktop and a phone; old logs are trimmed, after a reviewed trial run
  ([D-04](decisions/README.md#the-sites-decisions-d-01-to-d-13)).
- Strict TypeScript everywhere: no `@ts-nocheck` and no JavaScript outside the root's config files.
- The plan's public parts are in `docs/`.

### Phase 3: one home for each number

**Goal.** Every number and description has one home, in the content (`src/content/`). Whatever restates it is
rendered from it or checked against it.

**Exit criteria**, none met yet:
- The content is checked against its schemas when the site is built.
- Every number in the rulebooks is rendered from the content
  ([the decision](decisions/README.md#the-decisions-on-how-the-work-runs), "The rulebooks rendered from content").
  Until then, the words tests check them.
- The changelog and "What's new" are generated.

### Phase 4: turns run by a server

**Deferred.** Turns run by themselves only after the design phases (a maintainer's answer of 15 November).
Until then, a GM's page runs each turn: the turn runs on time only when a GM's page is open, the GM is the game's
referee, and the engine is part of the page, as in any browser game. Only Game Masters the Overlord invites create games
([R-097](rulings/R-097-game-masters-and-the-overlord.md)).

The maintainers talk about starting sooner if any of these becomes a real, repeated problem:
1. **Missed deadlines:** turns run late because no GM's page was open.
2. **Strangers running games:** public games run by GMs the maintainers don't know, where a GM's fairness matters.
3. **Fairness disputes:** players doubt a GM's fairness, or want proof.
4. **A rule that needs a server:** one that must act on hidden state at the moment it happens, which the GM's page
   can't publish as a fact.
