// 2026-10-15 (Toby, D1; R-110): the player portal's map popup gives your own hero's exact count of companies and
// another realm's hero's rough size (the report sends no exact count for him: what each realm's turn data says is
// tests/unit/another-realms-hero-beside-yours-is-always-seen-by-name-realm-and-rough-size-only.test.ts).
//
// Level 4 (page): popupKnownChars is the portal's own code (src/ui/player/map-symbols.ts), in a module that loads the
// portal's start-up (which calls supabase.createClient as it loads), so only the booted page reaches it: the portal
// booted in jsdom (tests/lib/boot.js) on the fake database (tests/lib/fake-db.ts's makeAFakeDb), the popup's words
// parsed by the page's own DOM (an inert <template>), not by a pattern.
//
// Until plan P1-14g this was the map popup's part of tests/sight-shared-province.test.js, the same boot and the same
// call. Its four checks are kept: "the player portal boots" and "popupKnownChars is declared at module level" as the
// function found on the booted page with no page error.
import { afterAll, beforeAll, expect, test } from 'vitest';
import { bootJsdom, DB_VERSION, readPage, type PageWindow } from '../lib/boot.js';
import { makeAFakeDb } from '../lib/fake-db.ts';

const errs: string[] = [];
let P: PageWindow;
beforeAll(async () => {
  P = bootJsdom(readPage('kingdoms-call-player-portal.html'), {
    supabase: { createClient: () => ({}) },
    db: makeAFakeDb([DB_VERSION]).db,
    url: 'https://example.org/p',
    setup(w) {
      w.addEventListener('error', (e) => errs.push(e.error?.stack ?? e.message));
      w.console.error = () => undefined;
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  }).window;
  await new Promise((resolve) => setTimeout(resolve, 1200));
});
afterAll(() => {
  P.close();
});

test("the map popup gives your own hero's exact count and another realm's hero's rough size", () => {
  expect(errs, 'the player portal boots').toEqual([]);
  expect(typeof P['popupKnownChars'], 'popupKnownChars is declared at module level').toBe('function');
  const pop = P['popupKnownChars'] as (pd: unknown, dead: unknown[]) => unknown;
  const doc = P['document'] as Document;
  const box = doc.createElement('template');
  box.innerHTML = String(
    pop(
      {
        id: 1,
        characters: [
          { id: 1, name: 'Own Hero', isOwn: true, armyCount: 3 },
          { id: 2, name: 'Their Hero', isOwn: false, ownerName: 'Red Realm', armyBand: 'a modest band' },
        ],
      },
      [],
    ),
  );
  const t = box.content.textContent;
  expect(t, "the popup gives your own hero's exact count").toMatch(/Own Hero \(3 units\)/);
  expect(t, "…and another realm's hero's rough size").toMatch(/Their Hero of Red Realm \(a modest band\)/);
  expect(errs, 'no page error').toEqual([]);
});
