// Hostile names on the GM portal (P0-19). Every string a player or a GM can store (names, game names, a player's chosen
// king and realm, invite codes, the saved turn log with its battle lines and bold, reported dispatches and reasons, the
// statistics' realms, orders and records) and every database error a screen shows is a payload (lib/hostile.ts). The
// screens (tour: lib/screens.ts): the game list (live and archived), a new game and its invites, a game in setup and its
// Turn 0 roster, an active game (orders, turn log, reported dispatches, settings, removing a player, archiving, a
// failed turn), the auto-turn watcher, the Stats tab and its banners, the Hall of Fame rebuild, changing the password,
// signing in and a page that can't start, as a GM and as the Overlord. Nothing may become markup or code, every handler
// still parses, and each name appears as typed. A test a screen, a test a mode (no page error), and one for the staged
// names (lib/each-screen-of-a-pages-tour-shows-hostile-names-as-text-in-jsdom.ts). Until plan P1-14z the script
// hostile-gm-portal. The same in Chromium, where a broken image really fires its onerror:
// tests/browser/hostile-names.spec.ts.
// Level 4 (page): it takes the portal's own rendering, from the stored games, slots, saved turn logs, reported
// dispatches and statistics to the screen; no lower level sees what reaches the screen.
import { testThatEachScreenOfThePagesTourShowsHostileNamesAsText } from '../lib/each-screen-of-a-pages-tour-shows-hostile-names-as-text-in-jsdom.ts';

testThatEachScreenOfThePagesTourShowsHostileNamesAsText('gmPortal');
