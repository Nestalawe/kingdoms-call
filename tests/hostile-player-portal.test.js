// Hostile names on the player portal (P0-19). Page level: it takes the portal's own rendering, from the stored games,
// slots, profiles and Game Master offer to the screen; no lower level sees what reaches the screen. Every string a player
// or a GM can store is a payload (lib/hostile.js), and so is every database error a screen shows. This pull request's
// screens are the lobby: signing in and registering, a page that can't start, My Games (the orders tally, the deadline,
// unread dispatches, archived games), the Game Master offer, open games and invites, the join form (the skill picker
// and its descriptions, every refusal, joined, joining twice), the display name and the password (tour:
// lib/screens.js). The report, orders, map and Dispatches add theirs in later pull requests. Nothing may become markup
// or code, every handler still parses, and each name appears as typed. Then the same in Chromium, where a broken image
// really fires its onerror.
require('./lib/hostile').hostileTest('playerPortal');
