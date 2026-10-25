// The player portal page's entry (plan P1-09d): it imports the page's files in the order the page ran them as classic
// scripts until P1-09d (the site's files its template loaded by tag, then its main list), globals.ts last. Each file imports
// what it reads; this list keeps the order of everything else the files do as they load.
import '../shared/kc-safe.ts';
import '../../db/kc-db-guard.ts';
import '../../content/kingdoms-call-data.ts';
// The units' ability blurbs (UNIT_ABILITIES, plan P1-19e), which briefing-and-submit.ts reads: listed here so that the
// words tests, which read the files this list names, still read them as the page's.
import '../../content/unit-abilities-their-names-numbers-and-words.ts';
import './startup.ts';
import './l79-orders.ts';
import './items-and-heroes.ts';
import './init.ts';
import './layout.ts';
import './sign-in.ts';
import './game-lists.ts';
import './join-and-chronicle.ts';
import './report.ts';
import './titles.ts';
import './order-chances.ts';
import './move-analysis.ts';
import './orders-form.ts';
import './pre-orders.ts';
import './briefing-and-submit.ts';
import './skills-and-projections.ts';
import './order-targets.ts';
import './map-symbols.ts';
import './map.ts';
import './dispatches.ts';
import './start.ts';
import '../shared/the-reload-banner.ts';
import './globals.ts';
