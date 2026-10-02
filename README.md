# Kingdoms Call

A turn-based strategy game played in the browser: a GM portal that runs the turns, a player portal,
a Hall of Fame and two rulebooks. Live at <https://nestalawe.github.io/kingdoms-call/>.

## How this repo works

| Folder | What's in it |
|---|---|
| `site/` | The deployable site, exactly as it is published: the pages and `kingdoms-call-data.js`. There is no build step. |
| `tests/` | The automated checks. [tests/README.md](tests/README.md) lists them. |
| `tools/legacy/` | Older content tools, kept for reference. Not run by the tests. |

Only `site/` is published, so page addresses don't change.

Every pull request runs `npm test` in GitHub Actions (`.github/workflows/ci.yml`). Merging to `main`
runs the tests again and, if they pass, publishes `site/` to GitHub Pages (`.github/workflows/deploy.yml`).

Changes to the database, the workflows or third-party code (the paths in `.github/review-gate-paths`), and
PRs labelled `needs-theo`, need Theo's approval before they can merge (`.github/workflows/review-gate.yml`).

Working on the code, or an agent starting a session? Read [CLAUDE.md](CLAUDE.md) first, then
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/traps.md](docs/traps.md).

## Running the tests

You need Node 24 (see `.nvmrc`).

```sh
npm ci                              # install the test tools (exact versions, from package-lock.json)
npx playwright install chromium     # once per machine: the headless browser some tests use
npm test                            # the standard run, about a minute
npm run test:full                   # bigger fuzz runs
```

`npm test` checks that every script in every page parses, that every page starts without errors,
plays a few short all-bot games with a fixed seed, and runs every kept test. It prints the seed; a
failing run can be repeated with `npm test -- --seed <seed>`.

The tests use made-up games and an in-memory stand-in for the database. They never connect to the
live game.
