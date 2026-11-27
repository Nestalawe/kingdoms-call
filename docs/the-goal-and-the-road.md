# The goal and the road

The road is the outcomes the work aims at, in order: what each achieves, why it comes before the next, and whether it
is met. A maintainer checks an outcome with evidence, and the result is recorded here. The road gives no dates and no
order of items: what comes next is the top of [the backlog](backlog/README.md), each item placed by its impact
([the decisions](decisions/README.md#the-decisions-on-how-the-work-runs)). The phases' step ids (`P1-16`, …) stay as
names, because the code and the pull requests cite them.

## The outcomes

| Outcome | Met? |
|---|---|
| [Phase 0: the foundation](#phase-0-the-foundation) | Met |
| [Batch-ready](#batch-ready) | Met |
| [The parts batches touch, finished](#the-parts-batches-touch-finished) | Met |
| [Phase 1: the engine rebuilt on a standard TypeScript stack](#phase-1-the-engine-rebuilt-on-a-standard-typescript-stack) | Not yet met |
| [Phase 2: the database decides, and turns are kept](#phase-2-the-database-decides-and-turns-are-kept) | Not yet met |
| [Phase 3: one home for each number](#phase-3-one-home-for-each-number) | Not yet met |
| [The ground for the redesign](#the-ground-for-the-redesign) | Not yet met |
| [Phase 4: turns run by a server](#phase-4-turns-run-by-a-server) | Not yet met: deferred |

Phases 2 and 3 and the ground for the redesign each rest on Phase 1, not on each other: the backlog orders their work.

## Phase 0: the foundation

**Met.** A maintainer checked each criterion below, with evidence.

**What it achieves.** Every change goes through git, tests and staging. The database is under version control and
tested. The first security steps are done. The owner no longer uploads files or pastes SQL. The criteria:
- Every production deploy since the cutover came from a merged pull request with green CI.
- A maintainer released at least three batches through a pull request, staging and the merge.
- `npm test` is green on `main`, and every pull request proves its tests fail first (amended: no CI check for it).
- `supabase/migrations/` holds the baseline and every change since, and production matches it.
- Phase 0's security steps are done.
- The hostile-name tests and the HTML checks are green.
- No page loads a script from another site.
- `docs/` has the architecture, the traps and the rulings; the old development log isn't in the repo.

**Why it comes first.** Every later outcome changes the code of a game that real players are playing. With this
one, each change is reviewed, tested and tried before it reaches them.

## Batch-ready

**Met.** Batch-ready is the part of Phase 1 a batch needs to change a rule safely. It holds four things:
1. **Every content family is in the [rule registry](architecture/the-rule-registry-and-the-one-source-for-shared-rules.md)**:
   unit abilities, items, spells, discoveries, guardian perks and the alignment orders. Met: no check by name of any
   of them is left outside it (the ratchet counts them).
2. **Every report line is a fact with an audience**, and each realm's report is built only from what that realm
   sees ([a line of the turn](architecture/a-line-of-the-turn-emit-its-facts-and-the-reports.md)). Met.
3. **No known breach** of the invariants or the leak checks: `KNOWN_BREACHES` is empty (`tests/lib/invariants.ts`).
   Met.
4. **The save is versioned** and checked before a turn runs
   ([a saved game](architecture/a-saved-game-its-version-its-upgrade-its-check.md)). Met.

**Why it comes before the next.** A batch changes a rule in running games. With these four, the rule is in one
place, each realm's report shows only what that realm sees, the matrix fails on a breach, and an older save still
loads.

## The parts batches touch, finished

**Met.** Every piece is on `main`:
- the player portal on the engine's functions: its copies of the rules gone, each disagreement ruled by a maintainer;
- the content families' leftovers in the registry;
- strict types in the battles, the orders and the views, and their old test scripts as Vitest tests;
- the import rules of the views and the prose;
- the docs and skills a batch agent uses.

**Why it comes before the next.** It keeps a batch item small: the code a batch touches is typed and tested, and an
agent reads only the module it changes. The rest of Phase 1 is code that batches touch less.

## Phase 1: the engine rebuilt on a standard TypeScript stack

**Not yet met.** Batch-ready and the parts batches touch are its parts that are met.

**What it achieves.** The turn engine is rebuilt in small, typed modules: a pure, seeded turn function; every event
recorded as a fact before any player reads of it; one place that decides what each realm sees; one home for each
content effect; and a player portal that uses the engine's own functions. The whole codebase uses the standard
TypeScript tools ([the toolchain](architecture/the-toolchain-the-checks-and-the-harness.md)), and an agent reads only
the module it changes.

| Criterion | State on `main` |
|---|---|
| `resolveTurn` is pure; `runTurn` is a thin shell; the rules live in `src/engine/` | Not yet met: `resolveTurn` reads no database, screen or clock, but it still lends the turn's dice through the shared `kcRng` |
| The toolset is in place (TypeScript, Vite, Vitest, Playwright, ESLint, Prettier, Zod, Dependabot); the old runner and the stitch build are gone | Met |
| The balance matrix and the invariants run on every engine pull request; the nightly run exists; `KNOWN_BREACHES` is empty | Met |
| Every report line goes through `emit` and the perception pass; `playerView` exists | Met |
| No content effect is checked by name outside the registry | Met for every content family; the alignments' checks by name (the ratchet counts them) move with "every rule into the registry" |
| No copy of a rule is left in the player portal; a maintainer ruled each disagreement | Met: the pins that stay are forecast limits the rulings accept (R-128, R-134); the used Stone waits on KD-507; the known defects KD-140, KD-142, KD-151, KD-153 and KD-420 are fixes to come |
| All code is TypeScript; the engine side is strict; database access is typed | Met: `src/`, every test (P1-14z), the tools and the CI scripts in `.github/scripts/` (B-16) are TypeScript, strict everywhere, and lint refuses `@ts-nocheck` in every TypeScript file; database access goes through the typed access layer and the generated types (P1-17). JavaScript stays only where it is config or copied as it is: `eslint.config.js` (a maintainer's choice), and `public/`'s two classic scripts, `kc-config.js` and the staging footer (the ratchet counts them, so no other joins them) |
| No known import-rule violation and no unused code; no ESLint suppression on the engine side | Not yet met: the ratchet still counts known violations and unused code, and `src/engine/` and `src/views/` still hold suppressions |
| No hand-typed stamps; hashed assets; the version banner works | Met |
| The harness is enforced: hooks, the Node pin, ratchets, coverage thresholds and the harness test, in CI | Met |
| Pages reach the database only through the access layer, tested per role against the local Supabase; `stub-db` deleted; property tests with fixed seeds; two mutation sessions or more | Met |
| The architecture checks run in CI: the layers and cycles, knip, the purity test, the registry and content completeness tests; the module map is generated | Met (the content completeness test lists the gaps it found when it came in, each a known defect) |
| No test injects code into a page's source; every test is TypeScript; saves are versioned and checked; items have ids | Not yet met: the saves part is met, and every test is TypeScript (P1-14z); items have no ids yet (P1-20) |
| Names say what the code does: the glossary's renames (P1-24) | Not yet met |
| A typical batch item needs only `CLAUDE.md`, the architecture overview and one to three modules (checked on three batches) | Not yet met: not yet checked on a batch |

How many of each are left: the ratchet's counts
([the toolchain](architecture/the-toolchain-the-checks-and-the-harness.md)).

**Why it comes before the next.** The outcomes after it change the database's rules, the content and the rules
themselves. They rest on what Phase 1 builds: a pure turn, typed code checked by the compiler, and one access layer
to the database ([the decision](decisions/README.md#the-decisions-on-how-the-work-runs), "Type the whole codebase").

## Phase 2: the database decides, and turns are kept

**Not yet met.**

**What it achieves.** The database decides who may read and write what, and when a turn may run; the GM's page still
runs the turn. Every turn is kept and can be restored. A live bug can be reproduced as a made-up test, with no player
data in git or CI. Players can download their own chronicle. The criteria:
- Every turn is recorded and reproduces from its seed; "Restore turn" works, tried once on staging.
- The turn lock and its breaker are live.
- The database's own tests (pgTAP) prove what each role may read and write, the messaging rules included.
- The chronicle download works on a desktop and a phone; old logs are trimmed, after a reviewed trial run
  ([D-04](decisions/README.md#the-sites-decisions-d-01-to-d-13)).
- Strict TypeScript everywhere: no `@ts-nocheck` and no JavaScript outside the root's config files.
- The plan's public parts are in `docs/`.

## Phase 3: one home for each number

**Not yet met.**

**What it achieves.** Every number and description has one home, in the content (`src/content/`). Whatever restates it
is rendered from it or checked against it. The criteria:
- The content is checked against its schemas when the site is built.
- Every number in the rulebooks is rendered from the content
  ([the decision](decisions/README.md#the-decisions-on-how-the-work-runs), "The rulebooks rendered from content").
  Until then, the words tests check them.
- The changelog and "What's new" are generated.

## The ground for the redesign

**Not yet met.**

**What it achieves.** A redesign item becomes a content change that can be tried before it lands. A maintainer's
direction sets this road. Most of its points are decisions: [type the whole codebase, every rule into the registry,
the regression matrix stays, a separate design matrix, and the rulebooks rendered from
content](decisions/README.md#the-decisions-on-how-the-work-runs). The rest of it, and what goes with it:
- **The rules pulled out:** each family of rules counted and moved into the content, each with its bot valuation hook.
- **The bots get a feedback loop:** what they do measured, each change judged old bot against new, their judgement as
  weights in data, tuned against the bots' aims (competent with every alignment first), and their choices compared
  with players' orders, as totals
  ([the requirements](explorations/the-bots-improvement-machinery-its-intent-its-outcome-and-its-requirements.md)).
  A redesign's balance verdict from bot games holds only as far as the bots play every alignment well.
- **The instruments, in `tools/` only:** the design matrix and its scorecard (the cost of a game measured first), the
  tool that reads players' games as totals only, and the page that shows the game as it is. The tool that reads
  players' games changes who can see data, so a maintainer reviews it, and its database pull request comes first.
- **A long-lived playtest site**, with its own database, where players try a rule's options (a maintainer's answer).
  Its running cost is checked first. It is a step still to be planned, with a database part.

How the redesign runs once its ground is laid:
- **No rulesets.** A rule change reaches every running game, so no game keeps the rules it started with
  ([R-177](rulings/R-177-rule-changes-reach-running-games.md)).
- **Experiments stay off `main`**, as content overlays or branches tried through the design matrix. Only the chosen
  design takes the full pull-request routine. Each design item names the rulings it replaces.
- **The redesign will rewrite some code:** the renames (P1-24), the state reshapes (P1-20) and the rest of the
  duplication work. The backlog weighs their impact with that in mind.

**Why it comes before the next.** Phase 4 waits for the design phases ([below](#phase-4-turns-run-by-a-server)).

## Phase 4: turns run by a server

**Not yet met: deferred.** Turns run by themselves only after the design phases (a maintainer's answer). Until then, a GM's page
runs each turn: the turn runs on time only when a GM's page is open, the GM is the game's referee, and the engine is
part of the page, as in any browser game. Only Game Masters the Overlord invites create games
([R-097](rulings/R-097-game-masters-and-the-overlord.md)).

The maintainers talk about starting sooner if any of these becomes a real, repeated problem:
1. **Missed deadlines:** turns run late because no GM's page was open.
2. **Strangers running games:** public games run by GMs the maintainers don't know, where a GM's fairness matters.
3. **Fairness disputes:** players doubt a GM's fairness, or want proof.
4. **A rule that needs a server:** one that must act on hidden state at the moment it happens, which the GM's page
   can't publish as a fact.

## The new alignment abilities and the design documents

**The new alignment abilities** arrive as one batch an alignment (a maintainer's answer), and each batch's pull
request says what it changes. They are backlog items. Two rulings set how they reach the game: each reaches every
running game as it goes live ([R-177](rulings/R-177-rule-changes-reach-running-games.md)), and they are built as the
test games played them
([R-178](rulings/R-178-the-new-alignment-abilities-are-built-as-the-test-games-played-them.md)). The questions still
open are in [the questions file](questions-for-the-maintainers.md).

**The design documents** are both the owner's own. They are named here and not copied, until the owner agrees to it.
- **The design document** sets out the game the owner is aiming for: the design targets, and the phases in which the
  game is redesigned, item by item. The design matrix will score each option of a rule against those targets.
- **The sheet of the new alignment abilities** says what each ability does. Each batch of the new abilities builds
  from it, with the lines [R-178](rulings/R-178-the-new-alignment-abilities-are-built-as-the-test-games-played-them.md)
  adds.
