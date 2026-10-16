# Kingdoms Call: guide for agents

Kingdoms Call is a turn-based strategy game played in the browser, live at
<https://nestalawe.github.io/kingdoms-call/> with real players in running games. **Toby** (GitHub
`Nestalawe`) is the designer, GM and owner. He isn't an engineer. **Theo** (`crumblingworld`) reviews
security, database, CI and deploy changes. Most code is written by Claude.

This repo is **public**. Everything you commit, and every PR title, description and comment, is
published.

## Read in this order

1. This file.
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the site, the turn engine and the database fit
   together.
3. [docs/traps.md](docs/traps.md): standing gotchas. Read it before changing a portal or a test.
4. [tests/README.md](tests/README.md): every test, its level, quarantine, and the code-anchor hooks.
5. Only then the code you need. **The portals are huge (the GM portal is ~27,600 lines): search, don't
   read them whole.** Read line ranges and edit with unique anchors.

**Toby's rulings are in [docs/rulings/](docs/rulings/README.md)**, one file each, with an index. Before
changing a rule, read its ruling; never "fix" what a ruling says is deliberate without a fresh one.

## File map

| Path | What |
|---|---|
| `site/` | The deployable site, published exactly as it is (no build step): `index.html`, `kingdoms-call-gm-portal.html`, `kingdoms-call-player-portal.html`, `kingdoms-call-leaderboard.html`, both rulebooks, `kingdoms-call-data.js`, `kc-config.js` (which database the site talks to), `kc-db-guard.js` (the database version guard), `kc-safe.js` (`kcHtml`/`kcEsc`, the one way a page builds HTML: [ARCHITECTURE.md](docs/ARCHITECTURE.md#how-a-page-builds-html)), `kc-staging-footer.js` (on staging, the footer names the PR), `vendor/` (supabase-js, served with the site: [ARCHITECTURE.md](docs/ARCHITECTURE.md#supabase-js-a-copy-served-with-the-site)) |
| `supabase/` | The database: `schemas/` (the desired structure, one file per table with its access rules), `migrations/` (generated from it, then reviewed), `config.toml`, `tests/` (the access-rule tests, pgTAP). How to change it: `supabase/README.md`. `.github/workflows/schema-pull.yml` reads the live structure |
| `tests/` | `suite.ts` (every test script, with its level), `legacy.test.ts` (runs them in Vitest), `*.test.js` (the test scripts), `<level>/*.test.ts` (new tests: TypeScript, Vitest), `setup/` (the run's checks and footer), `lib/boot.js` (the one way to load a page), `lib/stub-db.js` (in-memory Supabase stand-in), `quarantine/` (kept, not run) |
| `vitest.config.mts`, `tsconfig.json`, `eslint.config.js`, `.prettierrc.json`, `.nvmrc`, `.npmrc` | The toolchain: tests by level, strict TypeScript, lint, formatting, the exact Node version |
| `tools/legacy/` | Older content-export tools, kept for reference; not run by the tests |
| `.github/workflows/` | `ci.yml` (`npm test` and the access-rule tests on every PR; `deploy.yml` calls it), `deploy.yml` (on `main`: test, migrate production once Toby approves, then publish `site/` to Pages), `dangerous-paths.yml` (warns on a PR that changes a dangerous path), `merges-into-main.yml` (red on a PR that would merge into a branch other than `main`, e.g. a stacked PR whose base hasn't merged yet), `overlord.yml` (sets the Overlord account on the live database; run by hand, Toby approves) |
| `.github/dangerous-paths`, `.github/scripts/dangerous-paths.js` | The dangerous-paths list and the warning's logic (see below) |
| `.github/pull_request_template.md` | The PR template. Fill in every section |
| `docs/` | Architecture, traps, how to try a change on staging (`staging.md`), Toby's rulings (`rulings/`) |

## Commands

Node exactly as in `.nvmrc` (24.22.0): `npm ci` and `npm test` refuse any other.

```sh
npm ci && npx playwright install chromium   # once
npm test                                    # Vitest: every test, by level, side by side (about a minute); CI runs the same
npm run typecheck && npm run lint && npm run format:check   # the static checks; CI runs them too
npm run test:full                           # bigger fuzz runs
npm run test:quarantine                     # quarantined harnesses (expected to fail)
npm test -- -t fuzz                         # tests whose name matches "fuzz"; --project unit runs one level
KC_SEED=123 npm test                        # another seed; the footer prints the seed and how to repeat each failure
KC_JOBS=1 npm test                          # one test at a time
node tests/<name>.test.js                   # one test script on its own: unseeded, its own default sizes
KC_SITE=/tmp/broken-site npm test           # run against another copy of the site (fail-first proofs)
npx supabase@2.120.0 test db --local supabase/tests   # the access-rule tests (local copy running; supabase/README.md)
```

Run `npm test` and the static checks before every push, and the access-rule tests too when `supabase/` changes. All
must be green. New tests are TypeScript Vitest tests in `tests/<level>/` ([tests/README.md](tests/README.md)).

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
  [tests/README.md](tests/README.md#the-tests)). Until the engine is split into modules, "the function
  is nested inside `runTurn`" is a valid reason.
- **Fail first.** Show that the new test fails without your change (on `main`, or on a copy via
  `KC_SITE`) and passes with it. A test that can't fail proves nothing. For a pure refactor, label the
  PR `refactor-only`; then new tests must pass both before and after.
- **When something slips through** to a simulation, staging or live play: first add a test at the
  lowest level that would have caught it, show it fails, then fix.
- **A test's outcome must not depend on luck.** A fixed seed doesn't fix the world: any change that
  adds or removes a random draw shifts every draw after it. If a test passes only on some seeds,
  restructure it into clear determinism (stage the state directly, or make the odds overwhelming).
  Never fix it with retries, loops, re-runs, re-seeding or a seed that happens to pass.
- **Never "fix" a test to make it pass**, and never edit a quarantined test to pass. If a test fails
  on the current build for a reason outside your change, quarantine it in its own commit: move it to
  `tests/quarantine/`, take its line out of `tests/suite.ts`, and give the one-line reason as the
  file's first line and in `tests/README.md`. It comes back, in its own PR, only once the reason no
  longer applies (e.g. Toby confirms the behaviour the test should expect); updating it to that
  confirmed behaviour is fine, loosening it until it passes is not.
- Tests use synthetic, seeded data only. No test, fixture or CI job may read the live database.

**Changes**
- **One concern per PR.** Never mix a refactor with a behaviour change. A bug found while refactoring
  becomes its own PR (or its own item in a batch).
- **Design forks go to Toby:** numbered options, a recommendation, and a short example from inside the
  game. Don't invent rules. When he rules, add the ruling in the same PR as
  `docs/rulings/R-NNN-name.md` plus its index row ([how](docs/rulings/README.md#adding-a-ruling)), and
  name the test that enforces it. Rulings go there and nowhere else.
- **Mirror rule changes everywhere a rule is restated** (engine, player-portal projections,
  rulebooks, blurbs): [traps.md](docs/traps.md#a-rule-written-twice-must-change-twice).
- **Data file changes bump the stamps:** [traps.md](docs/traps.md#the-data-file-stamp-guard).
- Don't silence errors, lint or types to get green.
- Update `docs/ARCHITECTURE.md` and `docs/traps.md` when your change makes them wrong, and this file
  when the workflow changes.
- Write in plain language: [ISO 24495-1:2023](#plain-language-iso-24495-12023).

**Never**
1. **Never merge.** Toby merges. Never push to `main`, never force-push a shared branch, never run
   `gh pr merge`.
2. **Never touch production.** Don't deploy, migrate or write to the live database. Don't run
   `supabase link`, `db push` or `db reset --linked` against it. Never ask for, hold or use production
   credentials.
3. **Never change repository, Pages or Supabase settings.** Those are Toby's. Write him a short
   numbered click-list instead.
4. **Never commit private data.** That means:
   - player, king or realm names from live games;
   - pasted report or dispatch text;
   - account ids or emails;
   - database dumps or secrets (`.env*`, `*.dump` and `*.sql.gz` are git-ignored).

   Toby's pasted reports stay in the session. Tests and PRs use made-up names.
5. **Never describe security weaknesses in public.** Security-fix PRs get neutral titles and
   descriptions that don't say what was wrong or how it could be used. If you find a weakness, say so
   to the person running your session, for Theo; don't write it into an issue, PR, commit, comment or
   doc.
6. **Never copy from the private plan.** If your clone has a `plan/` folder, it's the private plan repo
   (git-excluded). Follow `plan/24-agent-brief.md` for updating its STATUS, and never add its files,
   or text from them, to this repo.

## Database changes

The structure is in `supabase/` ([supabase/README.md](supabase/README.md)): edit `supabase/schemas/`,
generate the migration, review it. Merging applies it: staging, then production once Toby approves, then
the site ([supabase/README.md](supabase/README.md#how-a-migration-goes-live)). Never apply one to the live
database yourself, and never ask Toby to paste SQL.

**Database and site changes go in separate PRs**, and each must work without the other: they go live at
different moments, and old pages stay open
([why, with an example](supabase/README.md#database-and-site-changes-go-separately)). CI's `db` check refuses
a PR that changes both. Database first, then site, then any removal (expand, then contract).
- **A migration PR** works with the site that's live now: it never loosens or removes an access-rule test
  of what the game needs. It includes the exact SQL, its rollback SQL, and a plain-words description of
  what Toby is approving.
- **A site PR** that uses a new table or column either **copes** while it's missing (probe and fall back:
  [traps.md](docs/traps.md#a-new-column-must-be-optional-at-the-write-site)), with a test that hides it
  (`MISSING` / `MISSING_COLS` in `tests/lib/stub-db.js`; example: `tests/meta-missing-turn.test.js`), or
  **declares** it by raising the page's `KC_DB_MIN` to the migration's version, so an older database stops
  the page with a clear message ([traps.md](docs/traps.md#a-site-change-that-needs-a-database-change)).
  Cope for an optional extra; declare when the page can't work without it. Say which in the PR.

Migrations are forward-only (a rollback is a new migration); a merged one is never edited (CI's `db` check
refuses it); every migration has pgTAP tests.

## Dangerous paths: talk it through with Theo

Some changes get Theo's eye before Toby merges them (decision D-07). Toby and Theo talk them through;
nothing on GitHub enforces it.
- **Paths:** any PR that changes a path in `.github/dangerous-paths` (today `supabase/**`, `.github/**`
  and `site/vendor/**`) gets a warning comment from `.github/workflows/dangerous-paths.yml`. It never
  blocks the merge. The list is read from the PR's base branch, so editing it affects later PRs, not
  the current one.
- **Everything else that needs Theo:** a change to who can see or change data, a plan step whose
  STATUS row has ✓ in the Theo column, or any step of a unit (e.g. the cutover). Say so in the first
  line of the PR description. If unsure, say so.

Labels: `staging` (when the PR needs staging and is ready to try: it puts the PR on the staging site, with its own database, and comments with the link; `.github/workflows/staging.yml`), `refactor-only`.

## Opening the PR for review

Use the template in `.github/pull_request_template.md`. Write the top half for Toby, in game terms;
keep engineering detail in the lower sections for Theo. "Staging" says whether it's needed and why; if it is,
a numbered checklist he can follow without reading code.

**Playtester notes, every time.** Any PR that changes something players can notice starts its
description with a `## For playtesters` section: one short, friendly paragraph per change, written for
players (what's new or fixed and how it affects their game, with no code, numbers only where they help)
and ready for Toby to paste. Once the change is merged and deployed, give Toby the same notes in the
session.

## Plain language (ISO 24495-1:2023)

Write everything people read (messages to Toby, PRs, commits, playtester notes, rulings, docs,
rulebooks, in-game text) to [ISO 24495-1:2023](https://www.iso.org/standard/78907.html): **relevant**
(what readers need, nothing more), **findable** (most important first, clear headings),
**understandable** (common words, short sentences, active voice, terms explained) and **usable**
(numbered steps, the next action clear). Keep engineering detail accurate: explain it, don't drop it.

## Talking to Toby

Write in game terms. Offer options with a recommendation. Use short examples from inside the game
world. Keep engineering detail for the PR's lower sections.
