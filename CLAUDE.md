# Kingdoms Call: guide for agents

Kingdoms Call is a turn-based strategy game played in the browser, live at
<https://nestalawe.github.io/kingdoms-call/> with real players in running games. **Toby** (GitHub
`Nestalawe`) is the designer, GM and owner. He isn't an engineer. **Theo** (`crumblingworld`) reviews
security, database, CI and deploy changes. Most code is written by Claude.

This repo is **public**. Everything you commit, and every PR title, description and comment, is
published.

## Read in this order

1. This file.
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): the overview, one short paragraph a part, and the module map.
3. The topic file under [docs/architecture/](docs/architecture/) for the part your work touches.
4. [docs/traps.md](docs/traps.md): the titles, then the entries your work touches (before changing a portal or a test).
5. When you write a test: [tests/README.md](tests/README.md), and [the list of tests](tests/every-test-its-level-and-what-it-checks.md).
6. Only then the code you need, in `src/`: **edit `src/`, never `site/`** (it's built). Files run to a few hundred
   lines, a few to 2,000 (`src/engine/run-turn.ts` ~230): search the long ones, and edit with unique anchors.

**Toby's rulings are in [docs/rulings/](docs/rulings/README.md)**, one file each, with an index. Before
changing a rule, read its ruling; never "fix" what a ruling says is deliberate without a fresh one.

## Where documentation goes

Every doc says what is true now; history lives in git and the PRs. A static test checks the budgets
(`tests/the-docs-budgets.json`): change one only with a reason in the PR, never to make the check pass.

| What | Where | Budget |
|---|---|---|
| The rules and the reading order | `CLAUDE.md` | 15 KB; lines ≤ 300 characters |
| The overview, the module map | `docs/ARCHITECTURE.md` | 15 KB |
| One part's detail | `docs/architecture/<topic>.md` | 30 KB each |
| A trap: its rule, one example, its check | `docs/traps.md` (its full text: the topic file) | 30 KB; 1.5 KB an entry |
| How to write and prove a test | `tests/README.md` | 20 KB |
| One line a test (its *why*: its header) | `tests/every-test-its-level-and-what-it-checks.md` | 300 characters a line |

## File map

| Path | What |
|---|---|
| `src/` | The site's source, TypeScript modules; `npm run build` (Vite) builds `site/` (git-ignored), what is published and every test opens. [Its folders](docs/architecture/the-build-from-src-to-site.md) |
| `public/` | Copied as it is: `kc-config.js` (which database), `kc-staging-footer.js`, `vendor/` (supabase-js) |
| `supabase/` | The database: `schemas/` (the structure and access rules), `migrations/` (generated, then reviewed), `tests/` (pgTAP): `supabase/README.md` |
| `tests/` | The tests (the list and README: above); `fixtures/saves/`, a made-up save of each version |
| `tools/` | The build, dev server, check, hooks, ratchet, lint rules, balance matrix, mutant scorer, the deploy's keep step |
| Config at the root (`vitest.config.mts`, `tsconfig.json`, `eslint.config.js`, `.nvmrc`, …) | [The toolchain](docs/architecture/the-toolchain-the-checks-and-the-harness.md) |
| `.github/` | `workflows/` (`ci.yml` on every PR: `ci` and `db` are the required checks; `deploy.yml` on `main`), `dangerous-paths`, the PR template |

## Commands

Node exactly as in `.nvmrc` (24.22.0): `npm ci` and `npm test` refuse any other.

Once: `npm ci && npx playwright install chromium`. Then `npm test` (every test, about 30 s; it builds `site/` first),
`npx playwright test` (the browser specs), `npm run check`, `npm run dev` (local Supabase only), `npm run balance` and
`npx supabase@2.120.0 test db --local supabase/tests` (the access-rule tests). The rest, with `KC_SITE` for fail-first
proofs: [tests/README.md](tests/README.md#running-the-tests).

**The checks run themselves** (hooks in `.claude/settings.json`): each edit is type-checked, linted and format-checked,
and you can't finish while `npm run check` fails (after three tries, say "`npm run check` still fails: tell Theo").
Before every push run `npm test` and `npx playwright test` (and the access-rule tests when `supabase/` changes): all
green. **All new code is TypeScript** (P1-09e), type-checked (no new `@ts-nocheck`; no `as` or `!` in `src/`: lint); new tests in `tests/<level>/` or `tests/browser/` ([tests/README.md](tests/README.md)).

## How work arrives

- **Toby's batches:** numbered items in game terms, sometimes with pasted battle reports. **One PR per
  batch, one commit per item** (decision D-06). Commit message `Item N: <short title>`; PR title
  `Batch YYYY-MM-DD: <a few items>`; branch `batch/YYYY-MM-DD` (the date you open it). If one item
  isn't ready, split it out rather than holding the batch.
- **Plan steps:** PR title `[P0-13] Per-environment config`, branch `p0-13-per-environment-config`. Open draft
  PRs whose titles start with `[P` are the live view of work in progress. Plan steps are grouped in
  phases; a **unit** is a set of steps done together in one sitting (e.g. the cutover).
- Open a **draft PR early**, and fill in the template as you go.

**Staging** is a separate test site with its own database and no real players (how: **[docs/staging.md](docs/staging.md)**).
**Whether a PR goes there is your call, from the risk** ([when](docs/staging.md#when-a-change-needs-staging)): say in
one line of the PR "Staging: needed / not needed, because …". If not needed, move the risks it would close into tests
or proofs in the PR. Label `staging` rebuilds its database from `main` plus the PR's migrations. A site PR that needs a database PR is stacked on its branch; it merges only after the database PR, once its `merges-into-main` check is green
([traps.md](docs/traps.md#a-stacked-pull-request-merges-into-its-base-branch-not-main)). Nothing is applied by hand.

## Rules

**Tests**
- **Test first, at the lowest level that can express it:** static, then unit, scenario, simulation,
  page. Every new test gets its level, and the reason a lower one wouldn't do, in the PR (levels:
  [tests/README.md](tests/README.md#the-levels)).
- **Fail first.** Show that the new test fails without your change (on `main`, or on a copy via
  `KC_SITE`) and passes with it. A test that can't fail proves nothing. For a pure refactor, label the
  PR `refactor-only`; then new tests must pass both before and after, and CI fails if the balance baseline changes.
- **When something slips through** to a simulation, staging or live play: first add a test at the
  lowest level that would have caught it, show it fails, then fix.
- **A test's outcome must not depend on luck.** A fixed seed doesn't fix the world: any change that
  adds or removes a random draw shifts every draw after it. If a test passes only on some seeds,
  restructure it into clear determinism (stage the state directly, or make the odds overwhelming).
  Never fix it with retries, loops, re-runs, re-seeding or a seed that happens to pass.
- **Never "fix" a test to make it pass**, and never edit a quarantined test to pass. If a test fails on the current
  build for a reason outside your change, quarantine it in its own commit: move it to `tests/quarantine/` (a test
  script's line leaves `tests/suite.ts`) and give the one-line reason as the file's first line and in
  `tests/README.md`. It comes back, in its own PR, only once the reason no longer applies (e.g. Toby confirms what the
  test should expect); updating it to that confirmed behaviour is fine, loosening it until it passes is not.
- Tests use synthetic, seeded data only. No test, fixture or CI job may read the live database.

**Changes**
- **One concern per PR.** Never mix a refactor with a behaviour change. A bug found while refactoring
  becomes its own PR (or its own item in a batch).
- **Design forks go to Toby:** numbered options, a recommendation, and a short example from inside the game. Don't
  invent rules. When he rules, add it in the same PR as `docs/rulings/R-NNN-name.md` plus its index row
  ([how](docs/rulings/README.md#adding-a-ruling)), and name the test that enforces it. Rulings go there only.
- **Mirror rule changes everywhere a rule is restated** (engine, player-portal projections, rulebooks, blurbs):
  [traps.md](docs/traps.md#a-rule-written-twice-must-change-twice). A function the player portal takes through
  `src/shared/` is written once; its copies still left are `tests/lib/player-portal-copies.ts`'s.
- **A change to the saved game's shape changes its schema too** (`src/schemas/saved-game-state.ts`). One an older save
  can't meet as it is (a field renamed, moved, retyped or now required) also bumps the save's version: a numbered step
  in `src/engine/saves/upgrade-a-saved-game-and-check-it.ts`, the number in
  `the-saved-games-version-this-build-writes.ts` beside it, and a fixture of the new version (`npx tsx
  tools/saves/make-a-save-fixture-from-a-seeded-bot-game.ts`; never edited once merged). A new optional field is the
  schema alone. The fixture test fails until a step mends every older fixture
  ([traps.md](docs/traps.md#a-change-to-the-saves-shape-needs-its-version)).
- **Dice come from `kcRng()`** and the engine's time from `kcClock()`: no `Math.random` or `Date` in the engine ([traps.md](docs/traps.md#dice-come-from-kcrng)).
- **An engine change carries its balance report** (CI's comment). Unless it says "no change", the PR's top half has
  "What changes in play" (template): predict before the matrix runs, then write it from the report, with anything
  unpredicted under "Not expected". A reshape says "Expected: no meaningful change", and the report must agree.
- Don't silence errors, lint or types to get green, and don't raise a count in `tests/ratchet.json` or add to a list
  it counts (a finding you fix leaves its list in the same PR: [the import
  rules'](docs/ARCHITECTURE.md#the-layers-and-the-module-map),
  [lint's](docs/traps.md#a-fixed-lint-finding-must-leave-the-suppressions)).
- Update `docs/ARCHITECTURE.md` and `docs/traps.md` when your change makes them wrong, this file when the workflow changes.
- Write in plain language: [ISO 24495-1:2023](#plain-language-iso-24495-12023).
- **The code's guardrails** (plain data, dice, `emit`, the registry, iteration order, types):
  [ARCHITECTURE.md](docs/ARCHITECTURE.md#the-codes-guardrails).

**Never**
1. **Never merge.** Toby merges. Never push to `main`, never force-push a shared branch, never run
   `gh pr merge`.
2. **Never touch production.** Don't deploy, migrate or write to the live database. Don't run
   `supabase link`, `db push` or `db reset --linked` against it. Never ask for, hold or use production
   credentials.
3. **Never change repository, Pages or Supabase settings.** Those are Toby's. Write him a short
   numbered click-list instead.
4. **Never commit private data**: player, king or realm names from live games; pasted report or dispatch text; account
   ids or emails; database dumps or secrets (`.env*`, `*.dump` and `*.sql.gz` are git-ignored). Toby's pasted reports
   stay in the session. Tests and PRs use made-up names.
5. **Never describe security weaknesses in public.** Security-fix PRs get neutral titles and
   descriptions that don't say what was wrong or how it could be used. If you find a weakness, say so
   to the person running your session, for Theo; don't write it into an issue, PR, commit, comment or
   doc.
6. **Never copy from the private plan.** If your clone has a `plan/` folder, it's the private plan repo
   (git-excluded). Follow `plan/24-agent-brief.md` for updating its STATUS, and never add its files,
   or text from them, to this repo.

## Database changes

The structure is in `supabase/` ([supabase/README.md](supabase/README.md)): edit `supabase/schemas/`, generate the
migration, review it. Merging applies it: staging, then production once Toby approves, then the site
([supabase/README.md](supabase/README.md#how-a-migration-goes-live)). Never apply one to the live database yourself, and
never ask Toby to paste SQL.

**Database and site changes go in separate PRs**, and each must work without the other: they go live at different
moments, and old pages stay open ([why, with an example](supabase/README.md#database-and-site-changes-go-separately)).
CI's `db` check refuses a PR that changes both. Database first, then site, then any removal (expand, then contract).
A migration PR's rules, a site PR's that needs one, and forward-only migrations:
[supabase/README.md](supabase/README.md#the-rules-every-database-change-follows).

## Dangerous paths: talk it through with Theo

Some changes get Theo's eye before Toby merges them (decision D-07). Toby and Theo talk them through;
nothing on GitHub enforces it.
- **Paths:** any PR that changes a path in `.github/dangerous-paths` (today `supabase/**`, `.github/**`
  and `public/vendor/**`) gets a warning comment from `.github/workflows/dangerous-paths.yml`. It never
  blocks the merge. The list is read from the PR's base branch, so editing it affects later PRs, not the current one.
- **Everything else that needs Theo:** a change to who can see or change data, a plan step whose STATUS row has ✓ in the
  Theo column, or any step of a unit (e.g. the cutover). Say so in the first line of the PR description. If unsure, say
  so.

Labels: `staging` (when the PR needs staging and is ready to try: it puts the PR on the staging site, with its own
database, and comments with the link: [docs/staging.md](docs/staging.md#trying-a-pull-request)), `refactor-only`.

## Opening the PR for review

Use the template in `.github/pull_request_template.md`. Write the top half for Toby, in game terms; keep engineering
detail in the lower sections for Theo. "Staging" says whether it's needed and why; if it is, a numbered checklist he can
follow without reading code.

**Playtester notes, every time.** Any PR that changes something players can notice starts its description with a `## For
playtesters` section: one short, friendly paragraph per change, written for players (what's new or fixed and how it
affects their game, with no code, numbers only where they help) and ready for Toby to paste. Once the change is merged
and deployed, give Toby the same notes in the session.

## Plain language (ISO 24495-1:2023)

Write everything people read (messages to Toby, PRs, commits, playtester notes, rulings, docs, rulebooks, in-game text)
to [ISO 24495-1:2023](https://www.iso.org/standard/78907.html): **relevant** (what readers need, nothing more),
**findable** (most important first, clear headings), **understandable** (common words, short sentences, active voice,
terms explained) and **usable** (numbered steps, the next action clear). Keep engineering detail accurate: explain it,
don't drop it.

## Talking to Toby

Write in game terms. Offer options with a recommendation. Use short examples from inside the game
world. Keep engineering detail for the PR's lower sections.
