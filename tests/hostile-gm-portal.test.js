// Hostile names on the GM portal (P0-19). Page level: it takes the portal's own rendering, from the stored games, slots,
// saved turn logs, reported dispatches and statistics to the screen; no lower level sees what reaches the screen. Every
// string a player or a GM can store is a payload (lib/hostile.js), and so is every database error a screen shows: the game
// list (live and archived), a new game and its invites, a game in setup with its Turn 0 roster, an active game with its
// orders, turn log, reported dispatches and settings, the auto-turn watcher, removing a player, archiving, the Stats tab
// and its banners, changing the password, signing in and a page that can't start, as a GM and as the Overlord (tour:
// lib/screens.js). Nothing may become markup or code, every handler still parses, and each name appears as typed. The
// same in Chromium, where a broken image really fires its onerror: tests/browser/hostile-names.spec.ts.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Hostile names on the GM portal (P0-19): every string a player or a GM can store (names, game names, a player's chosen
// king and realm, invite codes, the saved turn log with its battle lines and bold, reported dispatches and reasons, the
// statistics' realms, orders and records) and every database error a screen shows is a payload; the game list, a new
// game and its invites, a game in setup and its Turn 0 roster, an active game (orders, turn log, reported dispatches,
// settings, removing a player, archiving, a failed turn), the auto-turn watcher, the Stats tab and its banners, the
// Hall of Fame rebuild, changing the password, signing in and a page that can't start, as a GM and as the Overlord,
// show them as text, in jsdom (in Chromium: the browser spec `hostile-names`)
require('./lib/hostile').hostileTest('gmPortal');
