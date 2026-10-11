# The database

The live game's database structure, under version control since plan step P0-15 (baseline taken
2026-10-10 from the live project, Postgres 17).

| Path | What |
|---|---|
| `schemas/` | **The source of truth:** the desired structure, one file per table, function or sequence. A table's file holds its columns, its row-level security and its policies together. |
| `migrations/` | The changes that build it, in order. Generated from `schemas/`, then reviewed. Never edit one that has been applied. |
| `config.toml` | Settings for a local copy in Docker (`supabase start`). `major_version` must match the live Postgres major version. |
| `tests/` | The access-rule tests (pgTAP): `database/` has `00_privileges` (what each API role may do at all) and one file per table, `lib/world.psql` the made-up world they share. |

## Changing the structure

1. Edit the file in `schemas/` (or add one).
2. With a local copy running (`npx supabase@2.120.0 start`), generate the migration:
   `npx supabase@2.120.0 db schema declarative sync --name <what-changed> --no-apply --experimental`.
3. Review the generated SQL by hand. The generator never writes, so add a hand-written migration for:
   - data changes (`insert`, `update`, `delete`);
   - a trigger whose function lives in `auth` or `storage`;
   - view ownership, security-invoker settings and column-level privileges, which aren't always kept;
   - (privileges are generated, but only if the schema file revokes Supabase's defaults: see step 5);
   - casts, operators and similar rarely-used object types.
4. `npx supabase@2.120.0 db reset --local` rebuilds the local copy from the migrations; check it.
5. Add or change the access-rule tests in `tests/` (every migration has them), in the same pull request.
   **A new table, sequence or function** gets Supabase's default grants: everything, to signed-out visitors
   (`anon`) too. A `grant` line alone doesn't change that, so its file in `schemas/` **revokes the defaults
   first, then grants** what the site uses, as the existing files do:
   `REVOKE ALL … FROM "anon";` and `REVOKE ALL … FROM "authenticated";`, then
   `GRANT DELETE, INSERT, SELECT, UPDATE … TO "authenticated";` (and a `GRANT SELECT … TO "anon"` only if a
   signed-out page reads it). The generator then writes the matching migration; `00_privileges` fails if it's
   missing.
6. The PR states the rollback, and what Toby is approving, in plain words (see `CLAUDE.md`).

**Rules for `migrations/`.** CI's `db` job refuses a pull request that breaks the first two
(`.github/scripts/migrations.js pr-check`):
- **A migration never changes once it's merged:** no edits or renames. It may already be applied. To change
  or undo it, write a new migration. That's also how a rollback is applied: forward. The one exception:
  withdrawing a migration that production rejected, by deleting its file (CI warns; if it was applied after
  all, the deploy refuses until it's back).
- **A new migration sorts after every merged one.** If another one merged first with a later timestamp,
  rename yours with a fresh one before merging.
- A pull request changes the database or the site, never both (next section).

## Database and site changes go separately

**In short:** a change that needs both a database change and a site change is done as two pull requests:
the database change first, then the site change. Each one has to work without the other. CI's `db` check
refuses a pull request that changes both.

**Why.** The database and the site go live at different moments, and old copies of the site stay around:
- the database changes when Toby approves it, which may be hours after the merge (just after the daily
  backup);
- the site changes straight after each merge;
- a player who opened the game yesterday still has yesterday's page in their tab, and a GM's tab keeps
  running turns with the page it loaded;
- a pull request on staging runs against the staging database, which only gets a change once it's merged.

So for a while, new pages meet the old database, or old pages meet the new one. If either needs the other,
something breaks in that window. Usually it's quiet (a list that doesn't load), but it can be a turn that
fails to save.

**An example.** Say Toby wants each realm to fly a **war banner** that the GM sets, kept in a new `banner`
column of `game_players`:
1. **The database pull request** adds the empty column, plus the tests that say who can set it. Nothing on
   the site uses it yet, so it can go live whenever Toby approves, and nobody notices.
2. **The site pull request** shows and sets the banner. It checks the column is there first; if it isn't,
   the banner simply doesn't appear. Because the database change is already merged, staging has the column,
   so Toby tries the real thing there before it's merged.
3. **Removing something** (an old column, an old access rule) goes **last**, in its own pull request, once
   no page in use reads it any more. That's expand, then contract.

**How each side is kept safe:**
- **A migration must work with the site that's live now.** It only adds things, or tightens something the
  site doesn't rely on. The access-rule tests in `tests/` say what the game needs, so a migration that
  takes away something the site uses turns `db` red. A migration's pull request may add to those tests, but
  never loosens or removes one.
- **Site code must cope while its database change is missing.** It checks first and switches the feature
  off quietly ([traps.md](../docs/traps.md#a-new-column-must-be-optional-at-the-write-site)), and its pull
  request has a page test where the stand-in database hides the new table or column (`__DB.hide(...)`, as
  `tests/gm-messaging-boot.test.js` does).

## How a migration goes live

Merging to `main` runs `.github/workflows/deploy.yml`: **test → migrate staging → migrate production →
deploy the site** (plan step P0-17).
1. **`migrations`** lists the migrations added since the commit that's live on the site, with their SQL and
   their pull requests, in the run's summary. With none, the site deploys straight after the tests.
2. **`migrate-staging`** applies them to the staging database.
3. **`migrate-production`** waits for **Toby's approval** (the run page's **Review deployments** button,
   in the `production` environment). **This wait is when the change is tried on staging** (below). He
   approves soon after the daily backup (about 19:35 UTC), once it's listed in Supabase → Database →
   Backups.
4. **`deploy`** publishes the site, only if production was migrated. If Toby rejects it, or anything fails,
   the site doesn't deploy, and the next push to `main` (or a manual run of Deploy) asks again.

Both migrate jobs apply only the migrations listed in step 1, and refuse to touch a database that has
migrations the repo doesn't, or that is missing older ones. Nobody applies a migration from a laptop to the
live database, and nobody pastes SQL into its SQL Editor.

**While a run waits for Toby, every later deploy waits behind it**, including site-only fixes
([traps.md](../docs/traps.md#a-migration-waiting-for-approval-holds-every-deploy)).

**The first run on a database** that predates the pipeline (the live one, which has no migration history)
records the baseline as applied without running it: the live structure is the baseline (P0-15). A database
with no history and no game tables is refused: the pipeline never builds one from nothing.

**Trying a migration on staging** happens in that wait: the staging database already has it, the live one
doesn't yet. The steps, for Toby and agents alike, are in [docs/staging.md](../docs/staging.md#a-database-change-tables-columns-access-rules).
Nobody applies a migration by hand.

## The access-rule tests

Each file in `tests/database/` says, for one table, what the game needs (who reads and writes which
rows) and checks it from every point of view: a player in the game, a rival, a player in another game,
the game's GM, another GM, an account in no game, and a signed-out visitor. They act through the same
roles the site's API uses.

```sh
npx supabase@2.120.0 start                      # once; the local copy, built from migrations/
npx supabase@2.120.0 test db --local supabase/tests
```

Pass the whole `supabase/tests` folder: each file includes `lib/world.psql`, and the CLI only hands the
database the paths it's given. Every file runs in one transaction and rolls back, so the local copy is
left as it was. CI runs the same on every pull request (the `db` job in `.github/workflows/ci.yml`).

A change to an access rule comes with its tests here, in the same pull request.

## Supabase's own defaults are left out on purpose

A fresh export (`db schema declarative generate`, as the Schema pull workflow runs) also writes five files
that only restate defaults every Supabase project has. They are **not** kept in `schemas/`:
- `_cluster/extensions/pgcrypto.sql` and `_cluster/extensions/uuid-ossp.sql` (switched on in every project);
- `public/schema.sql` (the standard permissions on the `public` schema);
- `public/default_privileges.sql` and `public/adp_wipes.sql` (the default rights new tables get).

Leaving them out changes nothing: with them removed, the generator still finds no changes. **So when a
fresh export is compared with `schemas/` (to check the repo still matches the live database), these five
files will show up as "new". That's expected; ignore them.** Anything else that differs is real drift.

## Notes on the baseline

- Two live functions were written with Windows line endings. The export normalised them; to Postgres
  that's only whitespace.
- The generator put `game_messages.from_user_id` last (its default calls `auth.uid()`). The baseline
  migration and `schemas/` keep the live column order, so a rebuilt database matches the live one
  exactly.
