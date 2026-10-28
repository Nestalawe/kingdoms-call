# The pages, how a portal boots, and how a page builds HTML

## The pages (`site/`)

Built from `src/` and `public/` ([above](the-build-from-src-to-site.md#the-build-src-becomes-site)).

| File | Size | What it is |
|---|---|---|
| `index.html` | small | Landing page; links the player portal and both rulebooks. A stylesheet, no script of its own |
| `kingdoms-call-gm-portal.html` | ~300 lines; its bundle ~58,600 lines, ~2.0 MB | GM UI, world generation, the whole turn engine (`resolveTurn`, and its shell `runTurn`), bot AI, turn reports, telemetry, Stats tab, Hall-of-Fame builder, "missing from the database" messages |
| `kingdoms-call-player-portal.html` | ~450 lines; its bundle ~10,800 lines, ~560 KB (since P1-06c: without the start-up guard, it holds only the tables it reads) | Sign-in, My Games, order entry, the turn report and Chronicle, the map, Dispatches (player messaging). Calls the engine's rules of a hero, an army, an item or a number through `src/shared/` (it loads no other engine file); still holds client-side projections that mirror engine rules (see [traps.md](../traps.md#a-rule-written-twice-must-change-twice)) |
| `kingdoms-call-leaderboard.html` | ~120 lines; its bundle ~1,200 | Hall of Fame: leaderboard and achievement records over finished games |
| `kingdoms-call-overlord.html` | ~110 lines; its bundle ~460 | The Overlord page (P0-32f): accounts (offer, withdraw and revoke GM; suspend, lift and delete: P0-32h), handing games to another GM, every game, every game's reported dispatches. For the Overlord only; not linked from any page. Its sign-in is kept apart from the portals' (its own `storageKey`). No data file |
| `kingdoms-call-rules.html`, `kingdoms-call-rules-intro.html` | | The comprehensive and introductory rulebooks (prose); their script opens and closes the table of contents |
| `assets/<page>-<hash>.js`, `assets/<page>-<hash>.css` | | Each page's bundle and stylesheet, named by a hash of its content (P1-06b). The data file (`src/content/kingdoms-call-data.ts`), `kc-safe.ts` and `kc-db-guard.ts` are inside the bundles of the pages that use them, no longer files of their own. Older ones, which a cached page may still name, are kept for 24 hours after they stop being live ([above](the-build-from-src-to-site.md#the-build-src-becomes-site)) |
| `kc-config.js`, `kc-staging-footer.js` | small | Copied as they are from `public/`: which database this copy talks to (staging writes its own), and staging's footer |
| `vendor/supabase-js-<version>.min.js` | ~210 KB | The Supabase library, a copy served with the site ([below](#supabase-js-a-copy-served-with-the-site)) |
| `version.json` | small | Written by the build: the commit and each page's fingerprint, which open pages read ([below](the-database-and-what-it-holds.md#versions)) |
| `published-files.json` | small | Written by the deploy, not the build: every file of the site and when it stopped being live (`null` while it is). The next deploy reads it to know what to keep: never rename it |

All pages sit in one folder and link each other relatively. Only `site/` is published, so URLs are the
same as before the cutover and the build. No page loads a script from another site; the only outside requests are
Google Fonts.

### supabase-js: a copy served with the site

The pages load supabase-js from `vendor/` beside them (source: `public/vendor/`, copied as it is), not from a CDN
(P0-18), so no outside party can change the code that holds players' logins, and a CDN outage can't stop the portals
loading.

- **Version:** 2.117.3, the package's browser build (`dist/umd/supabase.js`) copied unchanged to
  `public/vendor/supabase-js-2.117.3.min.js`, with its licence beside it (`supabase-js-LICENSE.txt`).
- **SHA-256:** `d6a5c4414a5d4ce646d9c1de223aa7067d3ff664c15394ffeb7fcffc763354a3`. `npm test`'s
  `vendor-supabase` check fails if the file and this line disagree.
- **Nothing watches it for updates** (Dependabot can't see a copied file). When you touch this area, check
  `npm view @supabase/supabase-js@2 version` and upgrade if it's newer. P1-17 replaces the copy with a pinned
  npm dependency.

**To upgrade**, in its own PR (it changes `public/vendor/**`, so it's a dangerous path: talk it through with
Theo):
1. In an empty folder: `npm pack @supabase/supabase-js@<version>` (npm checks the download against the
   registry's checksum), then unpack it with `tar -xzf`.
2. Copy `package/dist/umd/supabase.js` to `public/vendor/supabase-js-<version>.min.js` and `package/LICENSE` to
   `public/vendor/supabase-js-LICENSE.txt`; delete the old copy.
3. Point the `<script src="vendor/…">` tags (in the page templates, `src/*.html`) and their boot-failure hints
   at the new file name, and update the version and SHA-256 above (`shasum -a 256 <file>`).
4. Read the release notes between the two versions for anything the pages use (sign-in, `rpc`, realtime).
5. `npm test`, then try sign-in, orders and Dispatches on staging.

## How a portal boots

Order inside each portal's page, and why it matters:

1. **Boot-failure reporter**: a small inline script, first in `<head>` (in the template itself). While the loading
   spinner is still showing, the first `error` or `unhandledrejection` replaces it with the message, a hint and a
   Reload button. Without it, any throw as the page starts looks like "Loading…" for ever. It puts the message and
   hint in as text, since it runs before the HTML helpers exist.
2. **supabase-js v2**, from the site itself (`vendor/supabase-js-<version>.min.js`, [above](#supabase-js-a-copy-served-with-the-site)).
3. **`kc-config.js`**, at the end of `<body>`: `KC_CONFIG`, which database this copy of the site talks to (address and
   public key). Every page that uses the database loads it; a staging copy of the site replaces only this file.
4. **`kc-staging-footer.js`**, last in `<body>` (every page). On staging it adds "Staging · PR #N · abc1234" to the
   footer, plus "database <version>" on pages that use the database; on the live site, whose `kc-config.js` has no
   `deployed`, it does nothing.
5. **The page's bundle** (`assets/<page>-<hash>.js`). A module script runs once the whole page is parsed, after the classic
   scripts above, in strict mode, wherever its tag is (Vite puts it in `<head>`). Its files run in its entry's order,
   each after the files it imports: `kc-safe.ts` first (the HTML helpers, [below](#how-a-page-builds-html)), then
   `kc-db-guard.ts` (`kcDbGuard`, the database version guard,
   [traps.md](../traps.md#a-site-change-that-needs-a-database-change)), the data file (both portals), then the page's own
   code. The start-up file creates the Supabase client, then
   `kcDbGuard(sb, KC_DB_MIN)`: only if the database is at least `KC_DB_MIN` does it call `init()` (the leaderboard:
   `loadAll()`), which hides the spinner. Otherwise the guard raises "The game is being updated" through the
   boot-failure reporter, and nothing is read or written. In the GM portal, a signed-in account is then checked
   (`gmPortalAllowed`: `is_game_master()` or `is_site_admin()`, P0-32c); anyone else, or a check that fails, sees only
   "You're not a Game Master" and nothing else loads. The Overlord gets **Master GM mode** (`_kcOverlord`, P0-32g):
   every game, grouped by GM, with no New Game and no automatic watcher; **Run turn now** on any active game, orders
   in or not; `?game=<id>` (the Overlord page's link) opens a game.

**Nothing is on `window` but what `globals.ts` puts there.** A module's top-level names are its own, so an inline
`on…="…"` handler or a browser spec's `page.evaluate` can't reach them. Each script page's entry ends with
`ui/<page>/globals.ts` (P1-09b): two `Object.assign(window, { … })` lists, the names the page's inline handlers call
and the names its tests reach. A variable the page's files or its tests share is a declared global instead,
`globalThis.<name> = <value>;` where it is declared (a list's copy of a variable goes stale). `npm test`'s
`page-globals` keeps the lists exact ([traps.md](../traps.md#nothing-is-on-window-but-globalsts)). The classic scripts
(`kc-config.js`, the footer, the reporter) still share the browser's one global scope: `KC_CONFIG` is read by name.

## How a page builds HTML

Every name and message on screen was typed by someone, so a page treats every value as text (P0-19).
`kc-safe.ts` (`src/ui/shared/kc-safe.ts`) gives each page four helpers:

- **`kcHtml`**, a tagged template: in ``kcHtml`<td>${realm}</td>` `` every value is escaped, unless it is itself
  `kcHtml` or `kcRaw`. A list is its items, one after another. It returns a marked value that goes into
  `innerHTML` as markup.
- **`kcEsc(v)`**: `v` as text, for the rare place that needs a plain escaped string.
- **`kcArg(v)`**: a value inside an `on…="…"` handler, e.g. ``kcHtml`<tr onclick="toggleGame(${kcArg(id)})">` ``. The
  browser unescapes an attribute before running it, so escaping alone isn't enough there.
- **`kcRaw(s)`**: markup passed through unchanged. Only for markup no player can have written; each use says why.

Engine narrative is escaped where it's shown, not where it's written: the report stores `**bold**`, and the page
turns it into `<strong>` after escaping. The player portal's Chronicle also tints each name it knows: it splits the
line's text at every bold run and every name, and wraps only those pieces in `kcHtml`, so the rest stays text. A
list of `kcHtml` pieces with a separator between them goes in through the player portal's `kcJoinP(list, sep)`. A
page whose content is mostly fixed builds elements instead (the Overlord page's `el()`), which is just as safe.

Every page builds its HTML this way. The lint rule `kc/html-is-built-only-through-kc-html` (`tools/eslint-rules/`,
P1-13d) refuses HTML built any other way, in the editor, in `npm run lint` and in CI, and each page that builds HTML
from data has a hostile-name test. Its reviewed exceptions are `HTML_EXCEPTIONS` in `eslint.config.js`, each with its
reason; one that matches nothing is itself a finding. Mistakes to avoid: [traps.md](../traps.md#html-is-built-only-through-kchtml).
