// 2026-10-15 (Toby, D8; R-116): Consecrate no longer counts toward the Hierophant. Only a Divine king can consecrate,
// so it was a creed-only route to a title; Bless Province, Holy Symbol and Resurrect still count. The title's
// description (the data file's TITLE_DEFS) and the rulebook's Titles table say so; the rulebook's creed note no longer
// claims nothing leans toward a creed, and says no creed scores a title differently; the Deathpriest row counts the
// undead raised by Necromancy. The rule itself (a king who consecrates earns no merit) is a case of
// lib/recruit-hire-and-realm-works-order-cases.ts ("Consecrate: hallowing a province earns the king no Hierophant
// merit").
//
// Level 0 (static): the rulebook as built (site/), and the title table imported with the whole engine loaded
// (tests/lib/the-whole-engine.ts); nothing runs.
//
// Until plan P1-14f this was part of tests/hierophant-no-consecrate.test.js, which read the title in the engine's bare
// vm. Its five checks of the words are kept as they were.
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import { TITLE_DEFS } from '../../src/content/kingdoms-call-data.ts';
import { readPage } from '../lib/boot.js';

const R = readPage('kingdoms-call-rules.html');

test("the title's description drops Consecrate", () => {
  const hiero = JSON.stringify((TITLE_DEFS as { key: string }[]).find((t) => t.key === 'hiero') ?? '');
  expect(
    hiero.length > 2 && !hiero.includes('Consecrate') && hiero.includes('Bless') && hiero.includes('Resurrect'),
    `the title's description drops Consecrate: ${hiero.slice(0, 140)}`,
  ).toBe(true);
});

test("the rulebook's Titles table drops Consecrate", () => {
  expect(R).toMatch(
    /<tr><td>The Hierophant<\/td><td>Highest White skill, plus Bless Province, Holy Symbol and Resurrect casts\.<\/td>/,
  );
});

test('the creed note no longer claims nothing leans toward a creed, and says no creed is scored differently', () => {
  expect(R).not.toMatch(/Nothing here is weighted toward a creed's natural lane/);
  expect(R).toMatch(/no creed scores a title any differently/);
});

test('the Deathpriest row says the undead counted are those raised by Necromancy', () => {
  expect(R).toMatch(/undead raised by Necromancy/);
});
