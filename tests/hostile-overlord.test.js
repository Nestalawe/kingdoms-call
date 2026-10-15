// Hostile names on the Overlord page (P0-19). Page level: it takes the page's own rendering of accounts, games, realms
// and reported dispatches, which no lower level sees. Every name, email, game name, realm name, dispatch and report
// reason is a payload (lib/hostile.js); the page is shown, searched, and its Revoke and Delete panels opened (tour:
// lib/screens.js). Nothing may become markup or code, and each name appears as typed. Then the same in Chromium.
require('./lib/hostile').hostileTest('overlord');
