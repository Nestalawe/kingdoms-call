// Hostile names on the Hall of Fame (P0-19). Page level: it takes the page's own rendering, from the stored records to
// the screen, with every mode a reader can be in; no lower level sees what reaches the screen. Every value a player
// or a GM can store in a recorded game is a payload (lib/hostile.js); the public board, GM mode, the Overlord, failing
// saves and an unreadable table are each shown, every tab, every game opened and edited, and a player renamed
// (tour: lib/screens.js). Nothing may become markup or code, every handler still parses, and each name appears as typed.
// Then the same in Chromium, where a broken image really fires its onerror.
require('./lib/hostile').hostileTest('leaderboard');
