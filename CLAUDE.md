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

Rulings (`docs/rulings/`) and session history (`docs/history/`) arrive with plan step P0-12. Until
then, a rule's background is in the code comments near it.

## File map

| Path | What |
|---|---|
| `site/` | The deployable site, published exactly as it is (no build step): `index.html`, `kingdoms-call-gm-portal.html`, `kingdoms-call-player-portal.html`, `kingdoms-call-leaderboard.html`, both rulebooks, `kingdoms-call-data.js`, `kc-config.js` (which database the site talks to) |
| `supabase/` | The database: `config.toml` (for a local copy in Docker). The schema files (`schemas/`) and migrations (`migrations/`) arrive with plan step P0-15; `.github/workflows/schema-pull.yml` reads the live structure for them |
| `tests/` | `run.js` (the runner), `*.test.js`, `lib/boot.js` (the one way to load a page), `lib/stub-db.js` (in-memory Supabase stand-in), `quarantine/` (kept, not run) |
| `tools/legacy/` | Older content-export tools, kept for reference; not run by the tests |
| `.github/workflows/` | `ci.yml` (`npm test` on every PR; `deploy.yml` calls it), `deploy.yml` (on `main`: test, then publish `site/` to Pages), `dangerous-paths.yml` (warns on a PR that changes a dangerous path) |
| `.github/dangerous-paths`, `.github/scripts/dangerous-paths.js` | The dangerous-paths list and the warning's logic (see below) |
| `.github/pull_request_template.md` | The PR template. Fill in every section |
| `docs/` | Architecture, traps and, later, rulings and history |

## Commands

Node 24 (`.nvmrc`).

```sh
npm ci && npx playwright install chromium   # once
npm test                                    # the standard run (about a minute); CI runs the same
npm run test:full                           # bigger fuzz runs
npm run test:quarantine                     # quarantined harnesses (expected to fail)
npm test -- --only fuzz                     # tests whose name contains "fuzz"
npm test -- --seed 123                      # another fixed seed; a failing run prints its seed
npm test -- --only turn-fuzz --seed 123     # reproduce one failure: same test, same seed, same sizes
node tests/<name>.test.js                   # one test on its own: unseeded, its own default sizes
KC_SITE=/tmp/broken-site npm test           # run against another copy of the site (fail-first proofs)
```

Run `npm test` before every push. It must be green.

## How work arrives

- **Toby's batches:** numbered items in game terms, sometimes with pasted battle reports. **One PR per
  batch, one commit per item** (decision D-06). Commit message `Item N: <short title>`; PR title
  `Batch YYYY-MM-DD: <a few items>`; branch `batch/YYYY-MM-DD` (the date you open it). If one item
  isn't ready, split it out rather than holding the batch.
- **Plan steps:** PR title `[P0-13] Per-environment config`, branch `p0-13-per-environment-config`. Open draft
  PRs whose titles start with `[P` are the live view of work in progress. Plan steps are grouped in
  phases; a **unit** is a set of steps done together in one sitting (e.g. the cutover).
- Open a **draft PR early**, and fill in the template as you go.

**Staging** is a separate test site with its own database and no real players. Until it receives
deploys (plan step P0-13), "What to try on staging" says what Toby will try once it can.

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
  `tests/quarantine/`, take it out of `SUITE` in `tests/run.js`, and give the one-line reason as the
  file's first line and in `tests/README.md`. It comes back, in its own PR, only once the reason no
  longer applies (e.g. Toby confirms the behaviour the test should expect); updating it to that
  confirmed behaviour is fine, loosening it until it passes is not.
- Tests use synthetic, seeded data only. No test, fixture or CI job may read the live database.

**Changes**
- **One concern per PR.** Never mix a refactor with a behaviour change. A bug found while refactoring
  becomes its own PR (or its own item in a batch).
- **Design forks go to Toby:** numbered options, a recommendation, and a short example from inside the
  game. Don't invent rules. When he rules, record the ruling in the PR (and, from P0-12, as
  `docs/rulings/R-NNN-name.md`) and name the test that enforces it.
- **Mirror rule changes everywhere a rule is restated** (engine, player-portal projections,
  rulebooks, blurbs): [traps.md](docs/traps.md#a-rule-written-twice-must-change-twice).
- **Data file changes bump the stamps:** [traps.md](docs/traps.md#the-data-file-stamp-guard).
- Don't silence errors, lint or types to get green.
- Update `docs/ARCHITECTURE.md` and `docs/traps.md` when your change makes them wrong, and this file
  when the workflow changes.

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

The schema isn't in this repo yet (it arrives with plan steps P0-15 to P0-17); for now, schema changes
are SQL the GM portal shows in a set-up banner. Any PR that changes the database must:
- make the code work both before and after the SQL has run
  ([traps.md](docs/traps.md#a-new-column-must-be-optional-at-the-write-site));
- include the exact SQL, its rollback SQL, and a plain-words description of what Toby is approving;
- expand before contract: add first, remove only in a later PR.

Once migrations exist: forward-only, never edit an applied one, every migration has pgTAP tests.

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

Labels: `staging` (ready for Toby to try: it puts the PR on the staging site, with its own database, and comments with the link; `.github/workflows/staging.yml`), `refactor-only`.

## Opening the PR for review

Use the template in `.github/pull_request_template.md`. Write the top half for Toby, in game terms;
keep engineering detail in the lower sections for Theo. "What to try on staging" is a numbered
checklist he can follow without reading code.

**Playtester notes, every time.** Any PR that changes something players can notice starts its
description with a `## For playtesters` section: one short, friendly paragraph per change, written for
players (what's new or fixed and how it affects their game, with no code, numbers only where they help)
and ready for Toby to paste. Once the change is merged and deployed, give Toby the same notes in the
session.

## Talking to Toby

Write in game terms. Offer options with a recommendation. Use short examples from inside the game
world. Keep engineering detail for the PR's lower sections.
