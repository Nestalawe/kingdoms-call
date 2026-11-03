// 2026-10-12 (Toby's batch, item 23; R-102): the player portal's Terror note (terrorNoteP) writes an Evil realm's
// reading of a province ("💀 Terror 20% — 2 stacks, your own …"), and nothing where no Terror grips it. What the turn
// data carries is tests/unit/an-evil-realms-report-reads-the-terror-gripping-each-province.test.ts; that the map popup
// and the Your Provinces list write the note is
// static/the-player-portals-map-popup-and-provinces-list-write-the-terror-note.test.ts.
//
// Level 4 (page): terrorNoteP is the portal's own code (src/ui/player/map-symbols.ts), in a module that loads the
// portal's start-up (which calls supabase.createClient as it loads), so only the booted page reaches it: the portal
// booted in jsdom (tests/lib/boot.js) on the stand-in database (tests/lib/stub-db.js's nullStub), the note's words
// parsed by the page's own DOM (an inert <template>), not by a pattern.
//
// Until plan P1-14g this was the note's part of tests/terror-visible.test.js, the same boot and the same calls. Its
// five checks are kept: "the player portal boots" and "terrorNoteP is declared at module level" as the function found
// on the booted page with no page error.
import { afterAll, beforeAll, expect, test } from 'vitest';
import { bootJsdom, readPage, type PageWindow } from '../lib/boot.js';
import { nullStub } from '../lib/stub-db.js';

const errs: string[] = [];
let P: PageWindow;
beforeAll(async () => {
  P = bootJsdom(readPage('kingdoms-call-player-portal.html'), {
    supabase: { createClient: () => nullStub() },
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

test("the Terror note reads the Terror and its stacks, says when it is the realm's own, and is empty with none", () => {
  expect(errs, 'the player portal boots').toEqual([]);
  expect(typeof P['terrorNoteP'], 'terrorNoteP is declared at module level').toBe('function');
  const note = P['terrorNoteP'] as (pd: unknown) => unknown;
  const doc = P['document'] as Document;
  const box = doc.createElement('template');
  box.innerHTML = String(note({ terror: { pct: 20, stacks: 2, byYou: true } }));
  const t = box.content.textContent;
  expect(t, 'the note reads the Terror').toMatch(/💀 Terror 20%/);
  expect(t, '…and its stacks').toMatch(/2 stacks/);
  expect(t, "…and says when it is the realm's own").toMatch(/your own/i);
  expect([note({}), note({ terror: null })], 'no Terror, no note').toEqual(['', '']);
  expect(errs, 'no page error').toEqual([]);
});
