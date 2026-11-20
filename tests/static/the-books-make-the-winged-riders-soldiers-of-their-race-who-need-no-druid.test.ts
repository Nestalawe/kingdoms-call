// The winged riders are soldiers of their race (the maintainer's decision of 2026-10-11): the rulebook's roster gives
// the Noble Griffons, Eagle Riders and Wyvern Riders their race and no Druid; its Druid ladder and the Druidic creed's
// Creature list name no rider; the mastery example no longer uses Eagle Riders; the strike sentence says the riders'
// strikes land one time in two; and the player portal's Druidic text, its Creature key and the Griffon and Wyvern
// blurbs agree.
//
// Level 0 (static): the rulebook as built (site/, or $KC_SITE's) read as text; the player portal from src/ by its
// syntax tree (tests/lib/source.ts): its words as the strings it holds, its blurbs as entries of UNIT_ABILITIES. Words
// in a book need no lower level, and no page needs to run.
//
// Moved from the old script tests/flyers-soldiers-words.test.js (P1-14z): each check kept; where one check joined
// several conditions, each is its own expect now.
import fs from 'node:fs';
import { expect, test } from 'vitest';
import { sitePath } from '../lib/boot.ts';
import { entriesOf, fileDeclaring, pageText } from '../lib/source.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const PP = 'kingdoms-call-player-portal.html';
const rules = fs.readFileSync(sitePath('kingdoms-call-rules.html'), 'utf8');
const blurbs = new Map(entriesOf(fileDeclaring(PP, 'UNIT_ABILITIES'), 'UNIT_ABILITIES').map((e) => [e.key, e.value]));

/** A rider's roster row in the rulebook: its race, its Druid cell and the rest of the row; or null. */
function rosterRow(unit: string): { race: string; druid: string; rest: string } | null {
  const m = new RegExp(
    `<tr><td><strong>${unit}</strong></td><td>([^<]*)</td><td>([^<]*)</td>((?:<td[^>]*>[^<]*</td>){4})([\\s\\S]*?)</tr>`,
  ).exec(rules);
  if (!m) return null;
  const cells = [...(m[3] ?? '').matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((x) => (x[1] ?? '').trim());
  return { race: (m[1] ?? '').trim(), druid: cells[3] ?? '', rest: m[4] ?? '' };
}

test.each([
  ['Noble Griffons', 'Human'],
  ['Eagle Riders', 'Elven'],
  ['Wyvern Riders', 'Orcish'],
])("the rulebook's roster: %s are %s and need no Druid", (unit, race) => {
  const row = rosterRow(unit);
  expect(row, `the roster has a ${unit} row`).not.toBeNull();
  expect(row?.race, `${unit} are ${race} in the roster`).toBe(race);
  expect(row?.druid, `${unit} need no Druid in the roster (Druid cell "—")`).toBe('—');
  expect(row?.rest, `the ${unit} row no longer says "needs Druid 3"`).not.toMatch(/Druid 3|tamed creature/i);
});

// The Shark Shoals share Druid 3 with the Whale Cohort (2026-10-13, Creatures and Monsters III); no winged rider does.
test('the Druid ladder puts the winged riders at Druid 1, lists no Gyrocopters at 2 and leaves Druid 3 to the sea-beasts', () => {
  const at = rules.indexOf('<strong>Druid 1</strong> —');
  const ladder = at < 0 ? '' : rules.slice(at, rules.indexOf('</li>', at));
  expect(ladder, 'the winged riders at Druid 1').toMatch(/Druid 1<\/strong> — [^<]*winged riders/);
  expect(ladder, 'no Gnomish Gyrocopters at Druid 2').not.toMatch(/Druid 2<\/strong> — Gnomish/);
  expect(ladder, 'the Whale Cohort first at Druid 3').toMatch(/Druid 3<\/strong> — Whale Cohort/);
  expect(ladder, 'no rider at Druid 3').not.toMatch(/Druid 3<\/strong> — [^<]*(Riders|Griffons|Gyrocopters)/);
});

test('the mastery example no longer uses Eagle Riders', () => {
  expect(rules).not.toMatch(/Eagle Riders \(Druid 3\)/);
});

test("the rulebook says the riders' strikes land one time in two", () => {
  expect(rules).toMatch(/land one time in two whatever your Druid/);
});

test("the Druidic creed's Creature list names no rider", () => {
  const at = rules.indexOf('ALL <strong>Creature</strong> armies');
  const creed = at < 0 ? '' : rules.slice(at, at + 300);
  expect(creed.length, 'the Druidic creed was found').toBeGreaterThan(10);
  expect(creed).not.toMatch(/Griffons|Eagle Riders/);
});

test(
  'Awaken the Wild no longer offers Eagle Riders or Noble Griffons, in either place',
  timeLimitForTheWork({ everyFileReads: 1 }),
  () => {
    expect(rules, 'the rulebook').not.toMatch(/Eagle Riders at Druid 1|Noble Griffons at Druid 2/);
    expect(pageText(PP), 'the player portal').not.toMatch(/Eagle Riders at Druid 1|Noble Griffons at Druid 2/);
  },
);

test(
  "the player portal's Druidic text and key name no rider among the Creatures",
  timeLimitForTheWork({ everyFileReads: 1 }),
  () => {
    const pp = pageText(PP);
    expect(pp, 'the Druidic text').not.toMatch(/all Creature armies — [^—]*(Griffons|Eagle Riders)[^—]*—/);
    expect(pp, 'the Creature key').not.toMatch(/\[C\] Creatures:<\/span>[^<]*(Griffons|Eagle Riders)/);
  },
);

test('the Griffon and Wyvern blurbs say their strikes land one chance in two', () => {
  expect(blurbs.size, 'the player portal declares UNIT_ABILITIES').toBeGreaterThan(0);
  expect(blurbs.get('Noble Griffons') ?? '', 'the Noble Griffons blurb').toMatch(/[Oo]ne chance in two/);
  expect(blurbs.get('Wyvern Riders') ?? '', 'the Wyvern Riders blurb').toMatch(/[Oo]ne chance in two/);
});
