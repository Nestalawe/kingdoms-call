# Trying a change on staging

**Staging** is a copy of the game for trying changes before players see them:
<https://kingdoms-call-staging.github.io/>. It has its own database with made-up accounts and games and no
real players. Nothing done there touches the live game.

Every pull request that changes something players or the GM can notice is tried on staging before it goes
live. How depends on what the pull request changes. A pull request changes **the site** or **the
database**, never both ([why](../supabase/README.md#database-and-site-changes-go-separately)).

## A site change (pages, rules, screens)

Tried **before** merging.

1. Add the label **`staging`** to the pull request.
2. Wait for the comment **"🧪 On staging"** on the pull request (a few minutes: the tests run first).
   Every page's footer on staging then says **"Staging · PR #N · abc1234"**: check it names this pull request.
3. Open the staging site and follow the pull request's **"What to try on staging"** checklist.
4. Works → talk it through if needed, then merge. Doesn't → say what went wrong on the pull request; new
   commits go up to staging by themselves while the label is on.

## A database change (tables, columns, access rules)

Tried **after** merging, **before** the live database changes. Merging changes the staging database only;
the live one waits for Toby's approval, and that wait is when it's tried.

1. **Before merging,** add the label **`staging`**, so the staging site runs the current site (a database
   pull request changes no site files, so this puts today's site on staging).
2. **Merge it.** The **Deploy** run (Actions tab) changes the **staging** database, then stops at
   **migrate-production** and waits. GitHub notifies Toby.
3. **Try it on staging now**, following the pull request's "What to try on staging". Do it promptly:
   while this run waits, every other update to the site waits behind it.
4. **Works →** Toby opens the run, clicks **Review deployments** → ticks **production** → **Approve and
   deploy**, soon after the daily backup (about 19:35 UTC, 08:35 in New Zealand, once today's backup is
   listed in Supabase → Database → Backups). The live database changes, then the site deploys.
5. **Doesn't work →** Toby clicks **Reject**. The live database is untouched. The fix is a new pull request
   whose database change undoes this one; it goes through the same steps, and the live database gets both,
   in order, ending up unchanged.

Nobody changes either database by hand, and nobody pastes SQL into Supabase.

## A change that needs both

Two pull requests, in this order ([why](../supabase/README.md#database-and-site-changes-go-separately)):
1. the database change, tried as above (nothing uses it yet, so there's usually little to see);
2. the site change that uses it, tried as a site change: staging's database already has what it needs.

## Things to know

- **One pull request is on staging at a time:** the last one labelled (or updated while labelled). The
  pull request it replaced gets a "replaced" comment. Label it again to put it back.
- **Accounts:** sign up on staging with any email; no confirmation email is sent. Accounts made before the
  staging database was rebuilt have no profile: make a new one.
- **Staging stops answering** after a quiet week: the free Supabase project pauses. Restore it from the
  Supabase dashboard (the staging project), and try again.
- **"Missing from the database" on the GM portal's game list** means the site on staging is ahead of
  staging's database: usually a site change whose database change isn't merged yet.
- How it works underneath: `.github/workflows/staging.yml` (site) and `.github/workflows/deploy.yml`
  ([supabase/README.md](../supabase/README.md#how-a-migration-goes-live), database).
