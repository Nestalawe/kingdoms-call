// 2026-10-15 (Toby, D2 and D9; R-111): the rulebook says that a Spy on a province reveals no one's skills but shows
// the characters in every province around it, and that a Spy on a hero reveals every skill level, magic item and
// army unit, for a wandering hero or a local chieftain too. What the turn does is
// scenario/a-spy-order-shows-a-provinces-heroes-and-their-armies-and-a-spied-heros-skills-items-and-army.test.ts.
//
// Level 0 (static): the rulebook as built (site/), its tags stripped and its white space made single. Nothing runs.
//
// Until plan P1-14h these were the last four checks of tests/spy-reveals.test.js, kept as they were.
import { expect, test } from 'vitest';
import { readPage } from '../lib/boot.js';

const stripTags = (s: string) => {
  let t = s;
  for (;;) {
    const u = t.replace(/<[^>]*>/g, '');
    if (u === t) return u;
    t = u;
  }
};
const R = stripTags(readPage('kingdoms-call-rules.html')).replace(/\s+/g, ' ');

test('the rulebook: what a Spy on a province and a Spy on a hero reveal', () => {
  expect(R, 'the rulebook: a province spy reveals no skills').toMatch(/It does not reveal anyone's skills/);
  expect(R, '…but shows the characters around it').toMatch(/the characters in every province around it/);
  expect(R, '…and a hero spy reveals skills, items and army').toMatch(/Spy on a hero/);
  expect(R, '…and a hero spy reveals skills, items and army').toMatch(
    /every skill level, every magic item they carry and every army unit they lead/,
  );
  expect(R, '…for wanderers and chieftains too').toMatch(/wandering hero or a local chieftain/);
});
