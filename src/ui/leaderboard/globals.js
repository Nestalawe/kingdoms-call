import {
  $,
  deleteRecord,
  filtered,
  loadAll,
  renamePlayer,
  render,
  resetFilters,
  saveGame,
  setHidden,
  setTab,
  toggleEdit,
  toggleGame,
} from './main.js';

// ── The Hall of Fame's deliberate globals (plan P1-09b; P1-09's Decision 7) ────
// The page's scripts are ES modules (P1-09d), so a top-level name belongs to its own file: an inline on…="…" handler, a
// test's W.eval or a browser spec's page.evaluate can't reach it. This file, the last one its entry (page.js) imports,
// puts on window the names they need, in two lists: first the names the page's inline handlers call (in its template
// and in its kcHtml strings), then the names its tests reach. Each name says the file that declares it.
// tests/static/page-globals.test.ts keeps both lists exact: a name a handler or a test needs that is missing fails it,
// and so does a name nothing needs. Only functions and constants go on a list, because a list copies each value once
// and a variable that changes later would go stale here. Those are declared globals instead (1 on this page):
// `globalThis.<name> = <value>;` where they are declared, read and written by their bare names.
// The names its inline handlers call.
Object.assign(window, {
  deleteRecord, // ui/leaderboard/main.js
  loadAll, // ui/leaderboard/main.js
  renamePlayer, // ui/leaderboard/main.js
  render, // ui/leaderboard/main.js
  resetFilters, // ui/leaderboard/main.js
  saveGame, // ui/leaderboard/main.js
  setHidden, // ui/leaderboard/main.js
  setTab, // ui/leaderboard/main.js
  toggleEdit, // ui/leaderboard/main.js
  toggleGame, // ui/leaderboard/main.js
});
// The names its tests reach.
Object.assign(window, {
  $, // ui/leaderboard/main.js
  filtered, // ui/leaderboard/main.js
});
