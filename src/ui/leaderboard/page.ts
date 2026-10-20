// The Hall of Fame page's entry (plan P1-09d): it imports the page's files in the order the page ran them as classic
// scripts until P1-09d (the site's files its template loaded by tag, then its main list), globals.js last. Each file imports
// what it reads; this list keeps the order of everything else the files do as they load.
import '../shared/kc-safe.ts';
import '../../db/kc-db-guard.ts';
import './main.ts';
import './globals.ts';
