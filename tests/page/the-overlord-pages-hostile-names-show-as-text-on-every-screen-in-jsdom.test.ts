// Hostile names on the Overlord page (P0-19). Every name, email, game name, realm name, dispatch and report reason is a
// payload (lib/hostile.ts); the page is shown, searched, and its Revoke and Delete panels opened (tour: lib/screens.ts).
// Nothing may become markup or code, and each name appears as typed. A test a screen, a test a mode (no page error),
// and one for the staged names (lib/each-screen-of-a-pages-tour-shows-hostile-names-as-text-in-jsdom.ts). Until plan
// P1-14z the script hostile-overlord. The same in Chromium: tests/browser/hostile-names.spec.ts.
// Level 4 (page): it takes the page's own rendering of accounts, games, realms and reported dispatches, which no lower
// level sees.
import { testThatEachScreenOfThePagesTourShowsHostileNamesAsText } from '../lib/each-screen-of-a-pages-tour-shows-hostile-names-as-text-in-jsdom.ts';

testThatEachScreenOfThePagesTourShowsHostileNamesAsText('overlord');
