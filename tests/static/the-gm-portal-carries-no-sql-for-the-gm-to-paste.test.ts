// The GM portal carries no SQL for the GM to paste: since P0-17 the database changes only through migrations
// (supabase/), applied by the deploy pipeline. Moved from the old script tests/sql-banners.test.js (P1-14z), check
// for check.
// Level 0 (static): it reads the page's template and its modules in src/ (tools/pages.ts); nothing runs.
// - No KC_*_SQL string, no "SQL Editor" instruction and no paste box (a read-only textarea that selects itself).
// A missing table is still reported, as a plain error message (checked in tests/browser/gm-messaging-boot.spec.ts).
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { GM_PAGE, pageFiles, SRC } from '../../tools/pages.ts';

const THE_BANNERS: [RegExp, string][] = [
  [/\bKC_[A-Z]+_SQL\b/g, 'a KC_*_SQL string'],
  [/SQL Editor|SQL editor/g, 'an instruction to use the SQL Editor'],
  [/<textarea readonly onclick="this\.select\(\)"/g, 'a SQL paste box'],
];

test('the GM portal carries no SQL set-up banners', () => {
  const found = pageFiles(GM_PAGE).flatMap((file) => {
    const src = fs.readFileSync(path.join(SRC, file), 'utf8');
    const lineOf = (i: number): number => src.slice(0, i).split('\n').length;
    return THE_BANNERS.flatMap(([re, what]) =>
      [...src.matchAll(re)].map((m) => `GM portal, ${file}:${String(lineOf(m.index))}: ${what} (${m[0]})`),
    );
  });
  expect(found).toEqual([]);
});
