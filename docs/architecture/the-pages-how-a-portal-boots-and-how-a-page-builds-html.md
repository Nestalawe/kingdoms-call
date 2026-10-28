# The pages, how a portal boots, and how a page builds HTML

## The pages (`site/`)

Built from `src/` and `public/` ([above](the-build-from-src-to-site.md#the-build-src-becomes-site)).

| File | Size | What it is |
|---|---|---|
| `index.html` | small | Landing page; links the player portal and both rulebooks. A stylesheet, no script of its own |
| `kingdoms-call-gm-portal.html` | ~300 lines; its bundle ~58,600 lines, ~2.0 MB | GM UI, world generation, the whole turn engine (`resolveTurn`, and its shell `runTurn`), bot AI, turn reports, telemetry, Stats tab, Hall-of-Fame builder, "missing from the database" messages |
| `kingdoms-call-player-portal.html` | ~450 lines; its bundle ~10,800 lines, ~560 KB (since P1-06c: without the start-up guard, it holds only the tables it reads) | Sign-in, My Games, order entry, the turn report and Chronicle, the map, Dispatches (player messaging). Calls the engine's rules of a hero, an army, an item or a number through `src/shared/` (it loads no other engine file); still holds client-side projections that mirror engine rules (see [traps.md](../traps.md#a-rule-written-twice-must-change-twice)) |
| `kingdoms-call-leaderboard.html` | ~120 lines; its bundle ~1,200 | Hall of Fame: leaderboard and achievement records over finished games |
| `kingdoms-call-overlord.html` | ~110 lines; its bundle ~460 | The Overlord page: accounts (offer, withdraw and revoke GM; suspend, lift and delete: P0-32h), handing games to another GM, every game, every game's reported dispatches. For the Overlord only; not linked from any page. Its sign-in is kept apart from the portals' (its own `storageKey`). No data file |
| `kingdoms-call-rules.html`, `kingdoms-call-rules-intro.html` | | The comprehensive and introductory rulebooks (prose); their script opens and closes the table of contents |
| `assets/<page>-<hash>.js`, `assets/<page>-<hash>.css` | | Each page's bundle and stylesheet, named by a hash of its content. The data file (`src/content/kingdoms-call-data.ts`), `kc-safe.ts` and `kc-db-guard.ts` are inside the bundles of the pages that use them, no longer files of their own. Older ones, which a cached page may still name, are kept for 24 hours after they stop being live ([above](the-build-from-src-to-site.md#the-build-src-becomes-site)) |
| `kc-config.js`, `kc-staging-footer.js` | small | Copied as they are from `public/`: which database this copy talks to (staging writes its own), and staging's footer |
| `vendor/supabase-js-<version>.min.js` | ~210 KB | The Supabase library, a copy served with the site ([below](#supabase-js-a-copy-served-with-the-site)) |
| `version.json` | small | Written by the build: the commit and each page's fingerprint, which open pages read ([below](the-database-and-what-it-holds.md#versions)) |
| `published-files.json` | small | Written by the deploy, not the build: every file of the site and when it stopped being live (`null` while it is). The next deploy reads it to know what to keep: never rename it |

All pages sit in one folder and link each other relatively. Only `site/` is published, so URLs are the
same as before the cutover and the build. No page loads a script from another site; the only outside requests are
Google Fonts.

### supabase-js: a copy served with the site

The pages load supabase-js from `vendor/` beside them (source: `public/vendor/`, copied as it is), not from a CDN, so no outside party can change the code that holds players' logins, and a CDN outage can't stop the portals
loading.

- **Its version and SHA-256** are in [ARCHITECTURE.md](../ARCHITECTURE.md#supabase-js-the-copy-served-with-the-site),
  where `npm test`'s `vendor-supabase` check reads them: it fails if the file and those lines disagree.
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
   at the new file name, and update the version and SHA-256 in `docs/ARCHITECTURE.md` (`shasum -a 256 <file>`).
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
`ui/<page>/globals.ts`: two `Object.assign(window, { … })` lists, the names the page's inline handlers call
and the names its tests reach. A variable the page's files or its tests share is a declared global instead,
`globalThis.<name> = <value>;` where it is declared (a list's copy of a variable goes stale). `npm test`'s
`page-globals` keeps the lists exact ([traps.md](../traps.md#nothing-is-on-window-but-globalsts)). The classic scripts
(`kc-config.js`, the footer, the reporter) still share the browser's one global scope: `KC_CONFIG` is read by name.

## How a page builds HTML

Every name and message on screen was typed by someone, so a page treats every value as text.
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

## Nothing is on `window` but `globals.ts`

The site's code is ES modules: a module's top-level names are its own, so an inline `on…="…"` handler, a
browser spec's `page.evaluate` or a test's `W.eval` reaches only what the page puts on `window`. Each script page does
that in one file, `src/ui/<page>/globals.ts`, the last its entry imports.

- **A function or a constant a handler calls or a test reaches goes on a list** in `globals.ts`, the handlers' or the
  tests', with the file that declares it, and is imported there.
- **A variable a test (or a handler) reads or writes is a declared global**, `globalThis.<name> = <value>;` where it is
  declared: a list copies a value once, and a variable's copy goes stale.
- **Name it as code.** `page-globals` reads the code a test hands a page: `typeof buildGameRecords` is read, a name in a
  string (`['buildGameRecords'].map(n=>eval(n))`) isn't, and the spec then fails only in Chromium.
- **Don't stand a page function in from a test** (`W.f = …`): the page's own calls never see the stand-in, and the test
  passes without testing anything. Stage what the function reads instead (the dice, `kcRng.use(…)`; the browser's
  `fetch` or timers; a declared global's fields), stand it in in the engine's `vm` (`tests/lib/scenario-in-the-vm.ts`),
  or build a page from a planted copy (`plantedSite`, `tests/lib/source.ts`). `npm test`'s `page-globals` fails on a
  name missing from a list, a variable that isn't a declared global, or a page stand-in.
- **jsdom is looser than a browser.** `tests/lib/boot.js` runs the bundle as a classic script, so in jsdom every
  top-level function and `var` of the bundle is on `window`, listed or not: a check that passes in jsdom can fail in
  Chromium. `page-globals` is what keeps the two the same.
- **In the engine's `vm`** (`tests/lib/engine.ts`) the bundle's top-level names are the context's globals, so
  `vm.runInContext('NAME', engine)` reads any of them, and `engine.f = …` stands a top-level function in (not a
  `const`: [A lifted helper takes the turn's context first](../traps.md#a-lifted-helper-takes-the-turns-context-first)). Assert that a table was actually read, i.e. is
  non-empty, before asserting anything about its contents.
- jsdom has no `innerText`; use `textContent`.

## HTML is built only through `kcHtml`

Every name, message and record on screen was typed by someone, so it goes into a page as text (P0-19,
[above](#how-a-page-builds-html)). The lint rule `kc/html-is-built-only-through-kc-html`
(P1-13d; it replaced `html-lint`) catches most mistakes as you write them; these ones it can't, or they cost time:

- **Markup in a value is shown as text.** In ``kcHtml`<td>${won?'<span class="pill">won</span>':''}</td>` `` the pill
  comes out as `<span…` on screen. Make the markup `kcHtml` too: ``${won?kcHtml`<span class="pill">won</span>`:''}``.
  The same goes for a helper that returns a plain string of markup, for a table of fixed text with markup in it (the
  player portal's `SKILL_INFO`: write those entries as ``kcHtml`…` ``), and for an entity written in data (`'Hosts &amp;
  armies'` now shows `&amp;`: write `&`). An attribute put in as a value breaks the same way: in
  ``kcHtml`<div${dim?' style="opacity:.8"':''}>` `` the quotes are escaped, so write ``${dim?kcHtml` style="opacity:.8"`:''}``.
  The lint rule can't see either mistake; `same-dom.js` (below) finds it on the screens a tour visits.
- **Never join `kcHtml` with `+`, `+=` or `.join('')`.** Each makes a plain string, which the next `kcHtml` escapes,
  so the markup shows as text. Collect pieces in an array and put the array in: ``kcHtml`<ul>${rows}</ul>` ``.
  The lint rule sees this only when `kcHtml` is written in the expression: `row(a)+row(b)`, where `row` returns `kcHtml`, and
  `.join(', ')` on a list of `kcHtml` pass it, and so do `.map(…).filter(Boolean).join('')`, `.flatMap(…).join('')`
  and `Array.from(…).join('')`. In the player portal, a list with a separator goes in as `kcJoinP(list, ', ')` (the
  separator is text; write ``kcHtml`<br>` `` for markup).
- **A template with no markup of its own still needs `kcHtml` if a value in it is `kcHtml`.** In
  ``chanceLine(`Success: ${pct(n)}`)``, where `pct` returns `<strong>`, the untagged template makes a plain string and
  the bold shows as text. Tag it: ``chanceLine(kcHtml`Success: ${pct(n)}`)``. The lint rule only looks at templates
  with markup in them.
- **A helper whose result goes straight into `innerHTML` returns `kcHtml` on every path**, even a line with no
  markup: `el.innerHTML=note(c)` reads a plain string as HTML, names and all. The orders' `exploreProjectionNote` is
  one; the lint rule sees the sink, not what the helper returns.
- **Markup read back as a string.** Code that searches the markup it built (the Move field finds the option that
  opens selected with a regular expression) reads ``String(kcHtml`…`)``, which is the markup, escaped values and all.
- **An empty list is still true.** `html||'Nothing yet'` worked while `html` was a string; once it's an array (or
  `kcHtml`, which is always an object), the fallback never shows. The orders were full of it: `opts?select:input`,
  `if(!charOpts)`, `if(mercRows)`. Test `html.length`, and return `''` from a helper
  that has nothing to show.
- **Fixed text with bold that a helper splits.** The player portal's `bulletizeDesc` splits a description into
  sentences, so its tables write bold as `**bold**`, not `<strong>`; it shows the text as text and turns each
  `**…**` into `<strong>`.
- **In `runTurn`, `msg` may be the watcher's banner.** In an automatic run, every message given to `msg.innerHTML` is
  also put inside the watcher's `kcHtml` banner, so each one is `kcHtml`, even a fixed one: a plain string shows its tags
  there as text.
- **No `kcEsc` (or an older escaper) inside `kcHtml`.** The value is escaped twice and `&` shows as `&amp;`.
- **`kcArg` keeps a value's type.** `onclick="f('${id}')"` passed a string; `onclick="f(${kcArg(id)})"` passes `id` as
  it is, so a numeric id now arrives as a number. Write `kcArg(String(id))` where the handler compares strings.
- **`kc-safe.ts`'s four helpers are bundled into each page** (since P1-09d), so a page and its helpers are always the
  same build; since P1-06b the bundle's name follows its content, so a page always gets its own bundle.
- **A test that runs a slice of a page in `vm`** (the Hall of Fame record tests do) must load `kc-safe.ts` into its
  context first if the slice calls the helpers (`scriptOf('ui/shared/kc-safe.ts')`, `tests/lib/source.ts`).
- **Show it looks the same.** Converting a page must not change it for ordinary names: run
  `node tests/tools/same-dom.js <main's site>` and put its output in the pull request.
- **An exception goes in `HTML_EXCEPTIONS` (`eslint.config.js`)** with a one-line reason, for Theo to review: the
  file, the check and a piece of the code it refuses. The rule is strict: no page may build HTML outside `kcHtml` /
  `kcEsc`, and an exception that matches nothing fails, so the list can't go stale. The ratchet counts the list
  (`allowlistEntries`), so it only shrinks.
- **A `?:` followed by `+` adds the tail to one branch only.** In `h.innerHTML=!ok?'Why not.':'Who reads it.'+' 12 left.'`
  the tail belongs to the second branch. Converting it to ``kcHtml`${!ok?…:…} 12 left.` `` adds it to both. Keep each branch
  whole: ``!ok?kcHtml`…`:kcHtml`… 12 left.` ``. `same-dom.js` finds it when a tour reaches both branches (it did, in the player
  portal's Dispatches).
