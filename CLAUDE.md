# Kingdoms Call: guide for agents

Kingdoms Call is a turn-based strategy game played in the browser, live at
<https://nestalawe.github.io/kingdoms-call/> with real players in running games. Two maintainers decide, review and
merge ([who](docs/ways-of-working/who-does-what-the-roles-the-review-by-kind-and-the-owners-keys.md#the-roles)); the
owner designs the game and is its GM, and isn't an engineer. Most code is written by Claude.

This repo is **public**. Everything you commit, and every PR title, description and comment, is
published.

## Read in this order

1. This file.
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): the overview, one line a part, and the code's guardrails.
3. The topic file under `docs/architecture/` for the part your work touches; for a batch, [where a change
   goes](docs/architecture/where-a-change-goes-from-an-item-in-game-terms-to-the-files.md).
4. [docs/traps.md](docs/traps.md): the titles, then the entries your work touches (before changing a portal or a test).
5. When you write a test: [tests/README.md](tests/README.md), and [the list of tests](tests/every-test-its-level-and-what-it-checks.md).
6. Only then the code you need, in `src/`: **edit `src/`, never `site/`** (it's built). Search a long file (the data
   file runs to ~15,000 lines), and edit with unique anchors.

**The rulings are in [docs/rulings/](docs/rulings/README.md)**, one file each, with an index. Before
changing a rule, read its ruling; never "fix" what a ruling says is deliberate without a fresh one. The decisions,
the questions, the goal and the backlog: the table below.

## Where documentation goes

| What | Where |
|---|---|
| The rules and the reading order | `CLAUDE.md` |
| The maintainers' decisions (D-NN, and how the work runs) | `docs/decisions/` |
| The rulings, and their index | `docs/rulings/` |
| The questions waiting for the maintainers | `docs/questions-for-the-maintainers.md` |
| The goal, the outcomes in order | `docs/the-goal-and-the-road.md` |
| The backlog: each open step, then the finished ones | `docs/backlog/` |
| Who does what, review, private data, a run's routines | `docs/ways-of-working/` |
| The overview, one line a part, and the code's guardrails | `docs/ARCHITECTURE.md` |
| One part's detail | `docs/architecture/<topic>.md` |
| A trap: its rule and its check | `docs/traps.md` (its full text and example: the topic file) |
| How to write and prove a test | `tests/README.md` |
| One line a test (its *why*: its header) | `tests/every-test-its-level-and-what-it-checks.md` |

- **One home a fact:** the table above names it. Elsewhere, link to it; never restate it.
- **The PR that changes a fact updates its home** (and any doc it makes wrong): a step's PR its backlog row (a
  finished step leaves for the finished list); a fix's PR deletes its backlog row (a new defect gets a `KD-` row in "Not yet assessed"); a maintainer's answer becomes a
  ruling and leaves the questions file, in one PR.
- **Present tense only:** a doc says what is true now (`docs/explorations/` excepted); history lives in git and the PRs.

Static tests check each file's budget (`tests/the-docs-budgets.json`: change one only with a reason in the PR, never to
make the check pass), that each ruling, decision, question and step named has its home, and that no file points at the plan.

## File map

`src/` (the site's source: edit it; `npm run build` makes `site/`), `public/`, `supabase/` (the database), `tests/`,
`tools/`, `.github/` and the configs at the root:
[the file map](docs/architecture/the-toolchain-the-checks-and-the-harness.md#the-repositorys-files-folder-by-folder).

## Commands

Node exactly as in `.nvmrc` (24.22.0): `npm ci` and `npm test` refuse any other.

Once: `npm ci && npx playwright install chromium`. Then `npm test` (every test, about 60 s; it builds `site/` first),
`npx playwright test` (the browser specs), `npm run check`. The rest (the dev server, the balance, the access-rule
tests): [tests/README.md](tests/README.md#running-the-tests).

**The checks run themselves** (hooks in `.claude/settings.json`): each edit is type-checked, linted and format-checked,
and you can't finish while `npm run check` fails (after three tries, say "`npm run check` still fails: tell a maintainer").
Before every push run `npm test` and `npx playwright test` (and the access-rule tests when `supabase/` changes): all
green. **All new code is TypeScript**, type-checked (no new `@ts-nocheck`; no `as` or `!` in `src/`: lint).

## How work arrives

- **Start all work with the skill `/making-a-change`**: it names the kind of work and writes its plan
  ([the six kinds](docs/architecture/making-a-change-the-six-kinds-and-the-plans-format.md)).
- **Batches** (numbered items in game terms) are changes: **one PR per batch, one commit per item** (D-06).
- **The steps** are in [the backlog](docs/backlog/README.md); its top comes next, in
  [one lane](docs/decisions/README.md). Each stream's titles, branches and commits:
  [who does what](docs/ways-of-working/who-does-what-the-roles-the-review-by-kind-and-the-owners-keys.md#the-roles).

**Staging** is a separate test site with its own database and no real players ([how](docs/staging.md)). **Whether a
PR goes there is your call, from the risk** ([when, and what to do if not](docs/staging.md#when-a-change-needs-staging)):
say in one line of the PR "Staging: needed / not needed, because …". A site PR that needs a database PR is stacked on
its branch ([traps.md](docs/traps.md#a-stacked-pull-request-merges-into-its-base-branch-not-main)). Nothing is applied
by hand, but in [break-glass](supabase/README.md#break-glass-the-one-exception).

## Rules

**Tests**
- **Test first, at the lowest level that can express it** ([the levels](tests/README.md#the-levels)); the PR names each
  new test's level and why a lower one wouldn't do.
- **Fail first.** Show that the new test fails without your change and passes with it; a pure refactor is labelled
  `refactor-only` ([how, and a refactor's proof](tests/README.md#proving-it-fails-first)).
- **When something slips through** to a simulation, staging or live play: first add a test at the
  lowest level that would have caught it, show it fails, then fix.
- **A test's outcome must not depend on luck:** restructure it, never retries, loops, re-runs, re-seeding or a seed
  that happens to pass ([how](tests/README.md#the-same-answer-every-time)).
- **Never "fix" a test to make it pass**, and never edit a quarantined test to pass. A test that fails for a reason
  outside your change is quarantined in its own commit ([how, and when it comes back](tests/README.md#quarantined-tests)).
- Tests use synthetic, seeded data only. No test, fixture or CI job may read the live database.

**Changes**
- **One concern per PR.** Never mix a refactor with a behaviour change. A bug found while refactoring
  becomes its own PR (or its own item in a batch).
- **Design forks go to the maintainers:** numbered options, each with its impact, an assessment, and a short example
  from inside the game. Don't invent rules. The ruling goes into `docs/rulings/` only, in the
  same PR ([how](docs/rulings/README.md#adding-a-ruling)).
- **Mirror rule changes everywhere a rule is restated** (engine, player-portal projections, rulebooks, blurbs):
  [traps.md](docs/traps.md#a-rule-written-twice-must-change-twice).
- **A change to the saved game's shape changes its schema too** (`src/schemas/saved-game-state.ts`); one an older save
  can't meet also bumps its version ([how](docs/traps.md#a-change-to-the-saves-shape-needs-its-version)).
- **Dice come from `kcRng()`** and the engine's time from `kcClock()`: no `Math.random` or `Date` in the engine ([traps.md](docs/traps.md#dice-come-from-kcrng)).
- **An engine change carries its balance report** (CI's comment). Unless it says "no change", the PR's top half has
  "What changes in play", predicted before the matrix runs (how: the PR template).
- Don't silence errors, lint or types to get green, and don't raise a count in `tests/ratchet.json` or add to a list
  it counts (a finding you fix leaves its list in the same PR: [the import
  rules'](docs/architecture/the-layers-of-src-and-the-module-map-generated-from-its-imports.md#the-known-findings),
  [lint's](docs/traps.md#a-fixed-lint-finding-must-leave-the-suppressions)).
- **The code's guardrails** (plain data, dice, `emit`, the registry, iteration order, types):
  [ARCHITECTURE.md](docs/ARCHITECTURE.md#the-codes-guardrails).

**Never**
1. **Never merge.** A maintainer merges; agents never. Never push to `main`, never force-push a shared branch, never
   run `gh pr merge`.
2. **Never touch production.** Don't deploy, migrate or write to the live database. Don't run
   `supabase link`, `db push` or `db reset --linked` against it. Never ask for, hold or use production
   credentials.
3. **Never change repository, Pages or Supabase settings.** Those are the owner's. Write a short
   numbered click-list instead.
4. **Never commit private data**: player, king or realm names from live games; pasted report or dispatch text; account
   ids or emails; database dumps or secrets (`.env*`, `*.dump` and `*.sql.gz` are git-ignored). Reports a maintainer pastes
   stay in the session. Tests and PRs use made-up names.
5. **Never describe security weaknesses in public.** Security-fix PRs get neutral titles and
   descriptions that don't say what was wrong or how it could be used. If you find a weakness, say so
   to the person running your session, for a maintainer; don't write it into an issue, PR, commit, comment or
   doc.
6. **Never copy from the private plan.** If your clone has a `plan/` folder, it's the private plan repo
   (git-excluded): it holds only security work, one machine's run scripts and history. Never add its files, or text
   from them, to this repo; the facts every session needs are in `docs/` (the table above).

## Database changes

Edit `supabase/schemas/`, generate the migration, review it; merging applies it
([how](supabase/README.md#how-a-migration-goes-live)). Never apply one to the live database yourself, and never ask the owner
to paste SQL. **Database and site changes go in separate PRs**, each working without the other
([why](supabase/README.md#database-and-site-changes-go-separately)): database first, then site, then any removal
([their rules](supabase/README.md#the-rules-every-database-change-follows)).

## Dangerous paths: talk it through with Theo

Some changes get a maintainer's eye before they merge (decision D-07); nothing on GitHub enforces it.
- **Paths:** a PR that changes a path in `.github/dangerous-paths` gets a warning comment that never blocks the merge.
- **Also:** a change to who can see or change data, a step with ✓ in
  [the backlog](docs/backlog/README.md#how-to-read-a-row)'s Maintainer column, or any step of a unit (e.g. the cutover). Say
  so in the PR description's first line. If unsure, say so.

## Opening the PR for review

Use the template in `.github/pull_request_template.md`, and fill in every section. Write the top half in game terms;
keep engineering detail in the lower sections.

**Playtester notes, every time.** Any PR that changes something players can notice starts its description with a `## For
playtesters` section ([how to write it](docs/ways-of-working/writing-for-people-plain-language-and-the-playtester-notes.md#the-playtester-notes)).
Once the change is merged and deployed, give a maintainer the same notes in the session.

## Plain language (ISO 24495-1:2023)

Write everything people read (messages, PRs, commits, playtester notes, rulings, docs, rulebooks, in-game text)
to [ISO 24495-1:2023](https://www.iso.org/standard/78907.html): relevant, findable, understandable and usable
([what each asks](docs/ways-of-working/writing-for-people-plain-language-and-the-playtester-notes.md#what-iso-24495-12023-asks)).
Keep engineering detail accurate: explain it, don't drop it. **To the maintainers:** game terms, short
examples from the game world.
