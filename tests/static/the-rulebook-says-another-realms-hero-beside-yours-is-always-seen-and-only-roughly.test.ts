// 2026-10-15 (Toby, D1; R-110): the rulebook says that another realm's hero beside yours is always seen, however good
// their Spy; that you learn their name, their realm and a rough sense of their force; that Invisibility is the one
// exception; that wanderers keep a stated chance to slip by; and no Spy-level accuracy ladder remains. The player
// portal reads whether a target leads troops, not their count (the report sends no count). What each realm's turn
// data says is tests/unit/another-realms-hero-beside-yours-is-always-seen-by-name-realm-and-rough-size-only.test.ts.
//
// Level 0 (static): the rulebook as built (site/), its tags stripped and its white space made single; the player
// portal's code in one layout, from src/ (tests/lib/source.ts). Nothing runs. Kept a read of the code (plan P1-14's
// Decision 3): the portal's order form is declared inside its modules, which call supabase.createClient as they load.
//
// Until plan P1-14g these were the last six checks of tests/sight-shared-province.test.js, kept as they were.
import { expect, test } from 'vitest';
import { readPage } from '../lib/boot.js';
import { compactPage } from '../lib/source.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const stripTags = (s: string) => {
  let t = s;
  for (;;) {
    const u = t.replace(/<[^>]*>/g, '');
    if (u === t) return u;
    t = u;
  }
};
const R = stripTags(readPage('kingdoms-call-rules.html')).replace(/\s+/g, ' ');

test("the rulebook: another realm's hero beside yours is always seen, and what you learn of them", () => {
  expect(R, "the rulebook: another realm's hero beside yours is always seen").toMatch(
    /every other realm's hero there is always seen, however good their Spy/,
  );
  expect(R, '…and what you learn of them').toMatch(
    /You see their name, the realm they serve and a rough sense of how large a force they lead/,
  );
  expect(R, '…Invisibility still hides').toMatch(/Invisibility is the one exception to both/);
  expect(R, '…wanderers keep a stated chance to slip by').toMatch(/5% chance per Spy level \(up to 25%\)/);
  expect(R, '…with no older concealment rule').not.toMatch(/older concealment rule/);
  expect(R, '…and no Spy-level accuracy ladder remains').not.toMatch(/Accuracy of what you learn scales separately/);
});

test(
  'the player portal reads whether a target leads troops, not their count',
  timeLimitForTheWork({ everyFileReads: 1 }),
  () => {
    const pp = compactPage('kingdoms-call-player-portal.html');
    expect(pp).not.toMatch(/\(x\.armies\|\|0\)/);
    expect(pp).not.toMatch(/\(tgt\.armies\|\|0\)/);
  },
);
