// Hostile names on the player portal (P0-19). Page level: it takes the portal's own rendering, from the stored games,
// slots, profiles, Game Master offer and saved turn reports to the screen; no lower level sees what reaches the screen.
// Every string a player or a GM can store is a payload (lib/hostile.js), and so is every database error a screen shows.
// The screens so far: the lobby (signing in and registering, a page that can't start, My Games, the Game Master offer,
// open games and invites, the join form, the display name and the password) and the turn report with its Chronicle
// (every section, past turns in older shapes, diplomacy, titles and the Reckoning in each state, the game decided), and
// the orders (a saved draft with its hire, raise and charm cards, every order each hero can be given, each realm's own
// order, spell targets, the encounter plan's pickers, the heir, submitting in each outcome, the orders as submitted)
// (tour: lib/screens.js). The map and Dispatches add theirs in a later pull request. Nothing may become markup
// or code, every handler still parses, and each name appears as typed. Then the same in Chromium, where a broken image
// really fires its onerror.
require('./lib/hostile').hostileTest('playerPortal');
