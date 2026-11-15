# Private data: what is private, and how each kind is handled

**The rule in one line:** private data lives only in Supabase and in GitHub's own private settings. Git holds only
made-up data. The repository stays public, which keeps GitHub's free secret scanning, code scanning, branch rules,
environment reviewers and Actions minutes, with no other vendor and no extra cost. The rules agents follow are in
[CLAUDE.md](../../CLAUDE.md#rules) ("Never" 2, 4 and 5); this file says what each kind of data is, and why.

## What is private

| Kind | Example | Lives in | Private? | Why |
|---|---|---|---|---|
| **Secrets** | The Supabase access token, the database password, the `service_role` key, a deploy key | GitHub's environment secrets; the owner's Supabase dashboard | **Yes: never in any repository** | Each gives full control of the database or the site. The `anon` key is public by design and is not a secret |
| **Personal data** | Emails, account ids, profile and display names | Supabase | **Yes** | It identifies people (New Zealand's Privacy Act 2020) |
| **Private dispatches** | The bodies of private messages between realms | Supabase | **Yes: the most sensitive** | Private talk between people: read only by the realms in it and the site's Overlord, not the GM ([R-073](../rulings/R-073-private-dispatches.md)) |
| **A running game's hidden state** | The state, orders and reports of a game in play | Supabase | **Yes, while the game runs** | Leaking it breaks the game |
| **What players wrote** | King and realm names; the text of a pasted battle report | Supabase | **Keep out of git** | Chosen by real people; it ties a person to a game |
| **Weaknesses not yet fixed** | How one works | Outside this repository | **Yes, until fixed** | Otherwise a public how-to |
| The structure and the access rules | `supabase/schemas/`, `supabase/migrations/`, the pgTAP tests | Git | **No: published** | Security must not rest on hidden rules; public rules get reviewed |
| The engine, the content, the docs, the tests | `src/`, `tests/`, `docs/` | Git | No | The engine is downloaded by every player's browser anyway |
| Totals | The Hall of Fame, statistics | Supabase, the docs | No | A total identifies nobody |

## How each kind is handled

1. **Secrets** live in GitHub's `staging` and `production` environments. Local work uses a git-ignored `.env.local`
   (`.gitignore` ignores `.env*`), and push protection stops a secret being pushed by mistake. Agents never ask for,
   hold or use production credentials.
2. **Personal data, dispatches and running games** stay in Supabase, the one store. The access rules say who reads
   what, and the pgTAP tests prove it ([the database](../architecture/the-database-and-what-it-holds.md)). Nothing
   copies them elsewhere.
3. **Tests use made-up, seeded data only.** Every check runs on seeded bot games and hand-built scenarios; no test,
   fixture or CI job reads the live database. A save fixture is made from a seeded bot game
   (`tools/saves/make-a-save-fixture-from-a-seeded-bot-game.ts`), never from a live game.
4. **Live data never reaches git.** A turn exported with its names removed is deferred
   ([P2-08](../backlog/the-later-group-what-serves-a-later-outcome-or-waits.md#phase-2-the-database-decides-and-turns-are-kept)): a live bug becomes a made-up test
   from a maintainer's description ([tests/README.md](../../tests/README.md#what-each-level-is-for-and-what-the-tests-dont-do)).
5. **A bug report:** the text a maintainer pastes stays in the Claude Code session. The test and the pull request use made-up
   names.
6. **Staging** holds made-up games and test accounts only ([staging](../staging.md)).
7. **A weakness:** kept outside this repository until it is fixed; its fix has a neutral title and description, and an
   agent who finds one tells the person running the session, for a maintainer.
8. **Backups** are Supabase's own daily backups ([D-03](../decisions/README.md#the-sites-decisions-d-01-to-d-13)). A dump
   made by hand stays on the owner's computer: never in git, never in a CI artifact (`.gitignore` ignores `*.dump` and
   `*.sql.gz`).
9. **The old development log** never enters the repository. Rulings drawn from it are written afresh in
   `docs/rulings/`, with no names from live games and no detail of a weakness.
