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
} from './main.ts';

// ── The Hall of Fame's deliberate globals (plan P1-09b; P1-09's Decision 7) ────
// The page's scripts are ES modules (P1-09d), so a top-level name belongs to its own file: an inline on…="…" handler, a
// test's W.eval or a browser spec's page.evaluate can't reach it. This file, the last one its entry (page.ts) imports,
// puts on window the names they need, in two lists: first the names the page's inline handlers call (in its template
// and in its kcHtml strings), then the names its tests reach. Each name says the file that declares it.
// tests/static/page-globals.test.ts keeps both lists exact: a name a handler or a test needs that is missing fails it,
// and so does a name nothing needs. Only functions and constants go on a list, because a list copies each value once
// and a variable that changes later would go stale here. Those are declared globals instead (1 on this page):
// `globalThis.<name> = <value>;` where they are declared, read and written by their bare names.
// The names its inline handlers call.
Object.assign(window, {
  deleteRecord, // ui/leaderboard/main.ts
  loadAll, // ui/leaderboard/main.ts
  renamePlayer, // ui/leaderboard/main.ts
  render, // ui/leaderboard/main.ts
  resetFilters, // ui/leaderboard/main.ts
  saveGame, // ui/leaderboard/main.ts
  setHidden, // ui/leaderboard/main.ts
  setTab, // ui/leaderboard/main.ts
  toggleEdit, // ui/leaderboard/main.ts
  toggleGame, // ui/leaderboard/main.ts
});
// The names its tests reach.
Object.assign(window, {
  $, // ui/leaderboard/main.ts
  filtered, // ui/leaderboard/main.ts
});
