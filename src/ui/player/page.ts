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
// The spells' hints (SPELL_HINTS, moved out of order-chances.ts by plan P1-11d13), which titles.ts reads: listed here so
// that the tests that read the page's files still read them as the page's.
import './the-hints-the-order-form-shows-below-each-spell.ts';
import './move-analysis.ts';
import './orders-form.ts';
import './pre-orders.ts';
import './briefing-and-submit.ts';
// The order form's forecasts (plan P1-11e3), which the page's files read: listed here so that the tests that read the page's
// files still read them as the page's.
import './the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts';
// The page's side of those forecasts (plan P1-11e41): the report and the orders its form holds, handed to each.
import './the-orders-the-form-holds-handed-to-its-forecasts.ts';
// Its ledger, chance notes, order list and magic levels, with the tables they read (plan P1-11e42), on the orders handed
// to them.
import './the-order-forms-ledger-practice-note-order-list-and-magic-levels-on-the-orders-handed-them.ts';
import './skills-and-projections.ts';
import './order-targets.ts';
import './map-symbols.ts';
import './map.ts';
import './dispatches.ts';
import './start.ts';
import '../shared/the-reload-banner.ts';
import './globals.ts';
