import { $, doSignIn, doSignOut, loadAll, renderAccounts, sb } from './main.ts';

// ── The Overlord page's deliberate globals (plan P1-09b; P1-09's Decision 7) ────
// The page's scripts are ES modules (P1-09d), so a top-level name belongs to its own file: an inline on…="…" handler, a
// test's W.eval or a browser spec's page.evaluate can't reach it. This file, the last one its entry (page.js) imports,
// puts on window the names they need, in two lists: first the names the page's inline handlers call (in its template
// and in its kcHtml strings), then the names its tests reach. Each name says the file that declares it.
// tests/static/page-globals.test.ts keeps both lists exact: a name a handler or a test needs that is missing fails it,
// and so does a name nothing needs. Only functions and constants go on a list, because a list copies each value once
// and a variable that changes later would go stale here. Those are declared globals instead (none on this page):
// `globalThis.<name> = <value>;` where they are declared, read and written by their bare names.
// The names its inline handlers call.
Object.assign(window, {
  doSignIn, // ui/overlord/main.js
  doSignOut, // ui/overlord/main.js
  loadAll, // ui/overlord/main.js
  renderAccounts, // ui/overlord/main.js
});
// The names its tests reach.
Object.assign(window, {
  $, // ui/overlord/main.js
  sb, // ui/overlord/main.js
});
