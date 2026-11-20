// Hostile names on the player portal (P0-19). Every string a player or a GM can store (display names, game names,
// realm, king and hero names, unit names, dispatches, battle cries and parting words, title holders) and the turn
// number a card shows are payloads (lib/hostile.ts), and so are the engine's strings in the saved report and every
// database error a screen shows. The screens (tour: lib/screens.ts):
// - signing in and registering, a page that can't start, My Games (the orders tally, the deadline, an unread dispatch,
//   a game it can't read, archived games), the Game Master offer, open games (public and invited), the join form (from
//   a game's card: the skill picker and its descriptions, every refusal, joined, joining twice), the display name and
//   the password;
// - the turn report (the realm, characters, provinces, intelligence, other forces, lairs, discoveries, diplomacy with
//   and without its controls, titles and the Reckoning in each state, the game decided) with its Chronicle (bold,
//   tinted names, folded battles, dispatches, intelligence, title reports, the game-end lines), a past turn's older
//   saved report and a past turn with none;
// - the orders (a saved draft with its hire, raise and charm cards, every order each hero and each card can be given
//   with its target field, each realm's own order, spell targets, the encounter plan's pickers, the heir's panel, the
//   research choice, submitting in each outcome, the orders as submitted, a draft from an older turn; order Details are
//   payloads too);
// - the map (its icon buttons, and the popup of every kind of province: three of the player's own, a rival's seen now,
//   one remembered, one on the border, one whose tier the popup doesn't name, and one in full screen);
// - Dispatches (every conversation, a new one, earlier dispatches, a report or a dispatch refused, a realm that has
//   conceded or is blocked, the table missing, no one to write to; the turn a dispatch was sent in is a payload too).
// Nothing may become markup or code, every handler still parses, and each name appears as typed. A test a screen, a
// test a mode (no page error), and one for the staged names
// (lib/each-screen-of-a-pages-tour-shows-hostile-names-as-text-in-jsdom.ts). Until plan P1-14z the script
// hostile-player-portal. The same in Chromium, where a broken image really fires its onerror:
// tests/browser/hostile-names.spec.ts.
// Level 4 (page): it takes the portal's own rendering, from the stored games, slots, profiles, Game Master offer and
// saved turn reports to the screen; no lower level sees what reaches the screen.
import { testThatEachScreenOfThePagesTourShowsHostileNamesAsText } from '../lib/each-screen-of-a-pages-tour-shows-hostile-names-as-text-in-jsdom.ts';

testThatEachScreenOfThePagesTourShowsHostileNamesAsText('playerPortal');
