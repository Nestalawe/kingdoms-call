// Hostile names on the Hall of Fame (P0-19). Every value a player or a GM can store in a recorded game is a payload
// (lib/hostile.ts); the public board, GM mode, the Overlord, failing saves and an unreadable table are each shown, every
// tab, every game opened and edited, and a player renamed (tour: lib/screens.ts). Nothing may become markup or code,
// every handler still parses, and each name appears as typed. A test a screen, a test a mode (no page error), and one
// for the staged names (lib/each-screen-of-a-pages-tour-shows-hostile-names-as-text-in-jsdom.ts). Until plan P1-14z the
// script hostile-leaderboard. The same in Chromium, where a broken image really fires its onerror:
// tests/browser/hostile-names.spec.ts.
// Level 4 (page): it takes the page's own rendering, from the stored records to the screen, with every mode a reader
// can be in; no lower level sees what reaches the screen.
import { testThatEachScreenOfThePagesTourShowsHostileNamesAsText } from '../lib/each-screen-of-a-pages-tour-shows-hostile-names-as-text-in-jsdom.ts';

testThatEachScreenOfThePagesTourShowsHostileNamesAsText('leaderboard');
