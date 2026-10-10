# The database

The live game's database structure, under version control since plan step P0-15 (baseline taken
2026-10-10 from the live project, Postgres 17).

| Path | What |
|---|---|
| `schemas/` | **The source of truth:** the desired structure, one file per table, function or sequence. A table's file holds its columns, its row-level security and its policies together. |
| `migrations/` | The changes that build it, in order. Generated from `schemas/`, then reviewed. Never edit one that has been applied. |
| `config.toml` | Settings for a local copy in Docker (`supabase start`). `major_version` must match the live Postgres major version. |
| `tests/` | The access-rule tests (pgTAP): `database/` has one file per table, `lib/world.psql` the made-up world they share. |

## Changing the structure

1. Edit the file in `schemas/` (or add one).
2. With a local copy running (`npx supabase@2.120.0 start`), generate the migration:
   `npx supabase@2.120.0 db schema declarative sync --name <what-changed> --no-apply --experimental`.
3. Review the generated SQL by hand. The generator never writes, so add a hand-written migration for:
   - data changes (`insert`, `update`, `delete`);
   - a trigger whose function lives in `auth` or `storage`;
   - view ownership, security-invoker settings and column-level privileges, which aren't always kept;
   - casts, operators and similar rarely-used object types.
4. `npx supabase@2.120.0 db reset --local` rebuilds the local copy from the migrations; check it.
5. The PR states the rollback, and what Toby is approving, in plain words (see `CLAUDE.md`).

The migrations are applied to staging, then (with Toby's approval) to the live database. Until plan step
P0-17 automates that, staging is updated by hand and the live database is never touched from a laptop.

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
