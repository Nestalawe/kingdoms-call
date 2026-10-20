// The player portal page's entry (plan P1-09d): it imports the page's files in the order the page ran them as classic
// scripts until P1-09d (the site's files its template loaded by tag, then its main list), globals.js last. Each file imports
// what it reads; this list keeps the order of everything else the files do as they load.
import '../shared/kc-safe.js';
import '../../db/kc-db-guard.js';
import '../../content/kingdoms-call-data.js';
import './startup.js';
import './l79-orders.js';
import './items-and-heroes.js';
import './init.js';
import './layout.js';
import './sign-in.js';
import './game-lists.js';
import './join-and-chronicle.js';
import './report.js';
import './titles.js';
import './order-chances.js';
import './move-analysis.js';
import './orders-form.js';
import './pre-orders.js';
import './briefing-and-submit.js';
import './skills-and-projections.js';
import './order-targets.js';
import './map-symbols.js';
import './map.js';
import './dispatches.js';
import './start.js';
import './globals.js';
