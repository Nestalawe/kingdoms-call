# Kingdoms Call

A turn-based strategy game played in the browser: a GM portal that runs the turns, a player portal,
a Hall of Fame and two rulebooks. Live at <https://nestalawe.github.io/kingdoms-call/>.

## How this repo works

| Folder | What's in it |
|---|---|
| `src/` | The site's source: the pages' templates (`src/*.html`) and their code, ES modules (each page's entry is `src/ui/<page>/page.ts`), and `kingdoms-call-data.ts`. |
| `public/` | What is published as it is: `kc-config.js` (which database the site talks to), the staging footer, and `vendor/` (supabase-js). |
| `site/` | The site as it is published, built from `src/` and `public/` by Vite (`npm run build`). Not in git: never edit it. |
| `tests/` | The automated checks. [tests/README.md](tests/README.md) lists them. |
| `tools/` | The build (`tools/build.ts`) and the dev server (`tools/dev.ts`, `npm run dev`), the checks an agent runs, the balance matrix. `tools/legacy/`: older content tools, kept for reference. |

Only `site/` is published, so page addresses don't change. Before you open a page locally, run `npm run build`
(`npm test` builds first), or serve `src/` with `npm run dev`, which only ever talks to a local Supabase
([docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#the-build-src-becomes-site)).

Every pull request runs `npm test`, the browser specs and the database's checks in GitHub Actions
(`.github/workflows/ci.yml`). Merging to `main` runs the tests again and, if they pass, builds `site/` and publishes it to
GitHub Pages (`.github/workflows/deploy.yml`). If the merge brings a database change, it's applied to the
live database once Toby approves, before the site is published
([supabase/README.md](supabase/README.md#how-a-migration-goes-live)). It was already tried on staging, on a
database rebuilt for its pull request, before merging.

**Trying a change before players see it:** [docs/staging.md](docs/staging.md).

A PR that changes the database, the workflows, the build or third-party code (the paths in `.github/dangerous-paths`)
gets a warning comment asking to talk it through with Theo before merging
(`.github/workflows/dangerous-paths.yml`). It never blocks the merge.

Working on the code, or an agent starting a session? Read [CLAUDE.md](CLAUDE.md) first, then
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/traps.md](docs/traps.md).

## Running the tests

You need exactly the Node version in `.nvmrc` (Node 24); `npm ci` and `npm test` refuse any other.

```sh
npm ci                              # install the test tools (exact versions, from package-lock.json)
npm run build                       # build the site from src/ into site/ with Vite (npm test does it first)
npx playwright install chromium     # once per machine: the headless browser the browser specs use
npm test                            # the standard run, about 30 s
npx playwright test                 # the browser specs, in Chromium, about 20 s
npm run test:full                   # bigger fuzz runs
```

`npm test` (Vitest) checks that every script in every page parses, that every page starts without errors,
plays a few short all-bot games with a fixed seed, and runs every kept test. It prints the seed, and for
each failed test the command that repeats it. `npx playwright test` (Playwright Test) opens the pages in a
real browser for what only a browser shows: layout, the requests a page makes, and names that must never
run as code.

The tests use made-up games and an in-memory stand-in for the database. They never connect to the
live game.
