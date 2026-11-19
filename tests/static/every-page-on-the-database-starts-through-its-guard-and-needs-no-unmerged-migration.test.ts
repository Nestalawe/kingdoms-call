// Every page on the database starts through its guard and needs no unmerged migration (P0-34). Moved from the old
// script tests/db-min.test.js (P1-14z), check for check.
// Level 0 (static): it reads each page's modules in src/ (tools/pages.ts) and supabase/migrations/; nothing runs. The
// guard's own answers are page tests (db-guard); this one reads what each page declares.
// - Every page whose own code makes its database client (makeThePagesDatabase, src/db/the-pages-database-client.ts)
//   declares KC_DB_MIN (the oldest database version it works with), imports kc-db-guard.ts, and starts through
//   kcDbGuard(thePagesDb, KC_DB_MIN).then(…). A page's own code is its modules but src/db/'s: the guard's comment
//   shows the call, and the client function's file names itself.
// - No KC_DB_MIN is newer than the newest migration in supabase/migrations/: a site change can't need a database
//   change that isn't merged, or in the pull request it's stacked on.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { pageModules, pageNames, SRC } from '../../tools/pages.ts';
import { DB_VERSION } from '../lib/boot.ts';

/** A page's own code: its modules but src/db/'s. */
const theOwnCodeOf = (name: string): string =>
  pageModules(name)
    .filter((f) => !f.startsWith('db/'))
    .map((f) => fs.readFileSync(path.join(SRC, f), 'utf8'))
    .join('\n');

const THE_PAGES_ON_THE_DATABASE = pageNames().filter((name) => /\bmakeThePagesDatabase\s*\(/.test(theOwnCodeOf(name)));

/** What is wrong with one page on the database: no KC_DB_MIN, no guard, or a minimum no migration here meets. */
function whatIsWrongWithAPage(name: string): string[] {
  const src = theOwnCodeOf(name);
  const min = /\bconst KC_DB_MIN\s*=\s*['"](\d{14})['"]/.exec(src)?.[1];
  if (min === undefined) return [`${name}: uses the database but declares no KC_DB_MIN='<14-digit migration version>'`];
  if (!pageModules(name).includes('db/kc-db-guard.ts')) return [`${name}: doesn't import kc-db-guard.ts`];
  if (!/kcDbGuard\(thePagesDb,\s*KC_DB_MIN\)\.then\(/.test(src))
    return [`${name}: doesn't start through kcDbGuard(thePagesDb, KC_DB_MIN).then(…)`];
  if (min > DB_VERSION)
    return [
      `${name}: KC_DB_MIN ${min} is newer than the newest migration here (${DB_VERSION}); merge the database change first, or stack this branch on it`,
    ];
  return [];
}

describe('every page on the database starts through its guard and needs no unmerged migration', () => {
  test('each declares KC_DB_MIN, imports the guard, starts through it, and needs a migration that is here', () => {
    expect(THE_PAGES_ON_THE_DATABASE.flatMap(whatIsWrongWithAPage)).toEqual([]);
    // The pages are read: today four make their database client.
    expect(THE_PAGES_ON_THE_DATABASE.length).toBeGreaterThan(0);
  });
});
