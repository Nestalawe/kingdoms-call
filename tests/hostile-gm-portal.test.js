// Hostile names on the GM portal (P0-19). Page level: it takes the portal's own rendering, from the stored games, slots,
// saved turn logs, reported dispatches and statistics to the screen; no lower level sees what reaches the screen. Every
// string a player or a GM can store is a payload (lib/hostile.js), and so is every database error a screen shows: the game
// list (live and archived), a new game and its invites, a game in setup with its Turn 0 roster, an active game with its
// orders, turn log, reported dispatches and settings, the auto-turn watcher, removing a player, archiving, the Stats tab
// and its banners, changing the password, signing in and a page that can't start, as a GM and as the Overlord (tour:
// lib/screens.js). Nothing may become markup or code, every handler still parses, and each name appears as typed. Then
// the same in Chromium, where a broken image really fires its onerror.
require('./lib/hostile').hostileTest('gmPortal');
