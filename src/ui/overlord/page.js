// The Overlord page's entry (plan P1-09d): it imports the page's files in the order the page ran them as classic
// scripts until P1-09d (the site's files its template loaded by tag, then its main list), globals.js last. Each file imports
// what it reads; this list keeps the order of everything else the files do as they load.
import '../shared/kc-safe.js';
import '../../db/kc-db-guard.js';
import './main.js';
import './globals.js';
