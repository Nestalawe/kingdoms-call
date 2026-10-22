# Trying a change on staging

**Staging** is a copy of the game for trying changes before players see them:
<https://kingdoms-call-staging.github.io/>. It has its own database with made-up accounts and games and no
real players. Nothing done there touches the live game.

Staging is used **when a change needs it**: the agent decides for each pull request, from the risk, and says
in one line of the pull request "Staging: needed / not needed, because …". Toby can always ask for it.

## When a change needs staging

Staging is needed when the change involves any of these:
1. **A migration** whose effect on existing rows, or on what a page can read, isn't fully covered by the
   access-rule tests and the stand-in database (`tests/lib/stub-db.js`): a new rule over data already there, a
   contract step.
2. **Sign-in or account flows:** sign-up, the Overlord, Game Master offers, suspension.
3. **What only a real browser shows:** layout, the map, printing, reload and caching after a deploy.
4. **Several accounts acting together:** a GM and players, invitations, dispatches, two GM tabs.
5. **A screen Toby will judge by eye**, where the question is "is this what I meant?".
6. **A change to how games are saved,** run on realistic saves, or the first deploy of a change to how the site
   is built.

It's not needed for rules and numbers the tests cover, wording, docs or tests. Before skipping it, list the risks
staging would close and move each into a test or a proof in the pull request (for example, a comparison of the
pages before and after the change). If Toby finds a problem on staging, that's a missing test: add it.

## Trying a pull request

1. Add the label **`staging`** to the pull request.
2. Wait for the comment **"🧪 On staging"** on the pull request (a few minutes: it waits for the pull request's
   CI checks to pass, then staging's database is rebuilt for it). If CI fails, nothing goes on staging: the
   staging check turns red and says which CI job failed.
   Every page's footer on staging then says **"Staging · PR #N · abc1234"**: check it names this pull request.
   The GM portal, the player portal, the Hall of Fame and the Overlord page also show their build line, e.g.
   "build 3f2a9c1 · 22 Oct 2026, 10:15". On staging it names the commit actually built, GitHub's merge of the pull
   request into its base, so its seven letters and digits differ from the staging line's. The "On staging" comment
   names both: the pull request's commit (the staging line) and the commit built (the build line).
3. Open the staging site, sign in with a test account (below), and follow the pull request's **"What to try
   on staging"** checklist.
4. Works → talk it through if needed, then merge. Doesn't → say what went wrong on the pull request; new
   commits go up to staging by themselves while the label is on. A page left open while a new commit goes up shows
   the bar "A new version of Kingdoms Call is ready" 10 to 15 minutes later, if that commit changed the page.

**What "rebuilt for it" means.** Each time a pull request goes on staging, staging's database is emptied
(games and accounts too) and built again: first exactly as the live database is meant to be (`main`'s
database changes), then with this pull request's own database changes on top, then the made-up games and
test accounts. So a database change is tried on a database that already holds games, as the live one will
be, before anyone has merged anything. If it fails, the run stops before the site goes up, and the pull
request is fixed. Nothing on `main` needs undoing.

**After merging a database change,** the **Deploy** run (Actions tab) stops at **migrate-production** and
waits; GitHub notifies Toby. He opens the run, clicks **Review deployments** → ticks **production** →
**Approve and deploy**, once the conditions in the pull request's "What Toby is approving" are met. The run's
summary says what each migration does to the data already there; only one marked ⚠️ **changes or removes data**
needs a copy of the database first ([supabase/README.md](../supabase/README.md#how-a-migration-goes-live)). The
live database changes, then the site deploys.
Approve it promptly: while this run waits, every other update to the site waits behind it. Rejecting it
leaves the live database untouched and the site not deployed.

Nobody changes either database by hand, and nobody pastes SQL into Supabase.

## A change that needs both

Two pull requests ([why](../supabase/README.md#database-and-site-changes-go-separately)):
1. the database change, on its own branch from `main`;
2. the site change, on a branch made **from the database change's branch** ("stacked"). It contains both,
   so labelling it puts both on staging: Toby tries the whole feature before either is merged.

Merge the database change first, then the site change. Until the database change is merged, the site
change merges into the database change's branch, not `main`, and its `merges-into-main` check is red.
Merging the database change deletes its branch, and GitHub moves the site change onto `main` (the check
turns green). **Never merge a pull request whose `merges-into-main` check is red:** its change would land
on another branch and never go live.

## Things to know

- **One pull request is on staging at a time:** the last one labelled (or updated while labelled). The
  pull request it replaced gets a "replaced" comment. Label it again to put it back.
- **Staging starts afresh each time** a pull request goes on it: games, accounts and sign-ins are wiped,
  and the made-up games come back. Don't keep anything there you want to keep.
- **Merging changes nothing on staging.** It keeps the last pull request put on it. To try the newest
  `main` there, label any open pull request (or push to a labelled one): it's rebuilt from the new `main`.
- **Test accounts:** `overlord@kingdoms-call.test`, `gm@kingdoms-call.test`,
  `player1@kingdoms-call.test`, `player2@kingdoms-call.test` and `player3@kingdoms-call.test`, all with
  one password, kept in Toby's password manager as "Kingdoms Call staging test accounts" (it's the staging
  environment's `STAGING_TEST_PASSWORD` secret). `overlord@` is staging's Overlord (the account above
  all others, P0-32a; nothing on the site uses that yet). The GM runs two made-up games: **Two Realms** (players 1
  and 2 have joined; Turn 0 can be run straight away) and **Open Game** (nobody yet; player 3 can join).
  You can also sign up on staging with any email (no confirmation email is sent), until the next rebuild.
- **Staging stops answering** after a quiet week: the free Supabase project pauses, and putting a pull
  request on staging fails with a connection error that says so. Restore it from the Supabase dashboard
  (the staging project), then add the label again.
- **"Missing from the database" on the GM portal's game list** means the site on staging is ahead of
  staging's database: usually a site change labelled without the database change it needs. Stack it on
  that pull request (above).
- How it works underneath: `.github/workflows/staging.yml`, `.github/scripts/migrations.js` (`reset
  staging`), `supabase/seeds/staging.sql` (the made-up games), and, for the live database,
  `.github/workflows/deploy.yml` ([supabase/README.md](../supabase/README.md#how-a-migration-goes-live)).
