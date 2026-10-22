// 2026-10-11 (Toby, the army roster work; R-088) — the five type words are the ones players read: infantry, ranged,
// cavalry, flyer, naval.
//   1. Rulebook roster table: every unit's Type cell is Infantry, Ranged, Cavalry, Flyer or Naval (garrisons:
//      "Infantry (garrison)"), and the table has a row for every unit in KC_UNIT_BASE_STR except the five summoned
//      elementals (not recruitable).
//   2. Four rulebook slips corrected the same day: Gilded Lances have no ride-down (only Free Lances pursue); Gnomish
//      Gyrocopters need no Druid; the Shieldwall Levies row names Shieldwall; Forest Wardens are infantry (they never
//      shoot).
//   3. The rulebook's roles table and the intro's kinds-of-unit list use the five words as headings.
//   4. The player portal's unit blurbs, the GM portal's archery-phase report lines and the Hall of Fame's "Storm of
//      arrows" label say ranged, not missile.
//
// Level 0 (static): the rulebooks as built (site/); the portals and the Hall of Fame from src/ by their syntax tree
// (tests/lib/source.ts); the data file's table from its module, imported with the whole engine loaded
// (tests/lib/the-whole-engine.ts); nothing runs. Until plan P1-14b this was tests/unit-type-words.test.js, which read
// the table in the engine's bare vm.
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import { KC_UNIT_BASE_STR } from '../../src/content/kingdoms-call-data.ts';
import { readPage } from '../lib/boot.js';
import { compactPage, entriesOf, fileDeclaring, pageStrings, pageText } from '../lib/source.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const rules = readPage('kingdoms-call-rules.html'),
  intro = readPage('kingdoms-call-rules-intro.html');
const LB = 'kingdoms-call-leaderboard.html',
  PP = 'kingdoms-call-player-portal.html';
const TYPE_CELL = /^(Infantry|Ranged|Cavalry|Flyer|Naval)( \(garrison\))?$/;

// 1. The roster table.
interface Row {
  race: string;
  type: string;
  cost?: string | undefined;
  str?: string | undefined;
  move?: string | undefined;
  druid?: string | undefined;
  rest: string;
}
const cap = rules.indexOf('<caption>Every army unit');
const table = cap > 0 ? rules.slice(cap, rules.indexOf('</table>', cap)) : '';
const rows: Record<string, Row> = {};
const rowRe =
  /<tr><td><strong>([^<]+)<\/strong><\/td><td>([^<]*)<\/td><td>([^<]*)<\/td>((?:<td[^>]*>[^<]*<\/td>){4})([\s\S]*?)<\/tr>/g;
let m;
while ((m = rowRe.exec(table))) {
  const cells = [...(m[4] ?? '').matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((x) => (x[1] ?? '').trim());
  rows[(m[1] ?? '').trim()] = {
    race: (m[2] ?? '').trim(),
    type: (m[3] ?? '').trim(),
    cost: cells[0],
    str: cells[1],
    move: cells[2],
    druid: cells[3],
    rest: m[5] ?? '',
  };
}

test('1. the roster table: one of the five words in every Type cell, a row for every recruitable unit', () => {
  expect(cap > 0, 'the rulebook has the "Every army unit" roster table').toBe(true);
  expect(Object.keys(rows).length >= 30, `the roster table parses (${String(Object.keys(rows).length)} rows)`).toBe(
    true,
  );
  const badType = Object.entries(rows)
    .filter(([, r]) => !TYPE_CELL.test(r.type))
    .map(([u, r]) => `${u}: "${r.type}"`);
  expect(
    badType.length === 0,
    'every Type cell is one of the five words' + (badType.length ? ' — not: ' + badType.join('; ') : ''),
  ).toBe(true);
  // R-109: the retired Corsairs keep their strength for companies already raised, but have no row.
  const want = Object.keys(KC_UNIT_BASE_STR as Record<string, unknown>).filter(
    (u) => !u.endsWith(' Elemental') && u !== 'Corsair Fleet',
  );
  const missingRow = want.filter((u) => !rows[u]);
  expect(
    want.length > 20 && missingRow.length === 0,
    'the roster has a row for every recruitable unit' +
      (missingRow.length ? ' — missing: ' + missingRow.join(', ') : ''),
  ).toBe(true);
  const garrisons = Object.keys(rows).filter((u) => u.endsWith('Garrison'));
  const gBad = garrisons.filter((u) => rows[u]?.type !== 'Infantry (garrison)');
  expect(
    garrisons.length === 4 && gBad.length === 0,
    'the four garrisons are "Infantry (garrison)"' + (gBad.length ? ' — not: ' + gBad.join(', ') : ''),
  ).toBe(true);
});

test('2. the four corrections', () => {
  const row = (u: string): Row => rows[u] ?? { race: '', type: '', druid: '', rest: '' };
  expect(
    !/ride[- ]down|Ride Them Down/i.test(row('Gilded Lances').rest),
    "the Gilded Lances row no longer claims a ride-down pursuit (that is Free Lances' alone)",
  ).toBe(true);
  expect(
    row('Gnomish Gyrocopters').druid === '—' && !/Druid \d/.test(row('Gnomish Gyrocopters').rest),
    'Gnomish Gyrocopters need no Druid in the roster (Druid cell "—", no "Druid 2" in the text)',
  ).toBe(true);
  expect(
    row('Shieldwall Levies').rest.includes('Shieldwall:'),
    'the Shieldwall Levies row names their Shieldwall ability',
  ).toBe(true);
  expect(
    row('Forest Wardens').type === 'Infantry',
    'Forest Wardens are Infantry (they never loose in the archery step)',
  ).toBe(true);
});

test('3. the five words are the headings', () => {
  const roles = (() => {
    const i = rules.indexOf('<h3>The kinds of unit</h3>');
    return i < 0 ? '' : rules.slice(i, rules.indexOf('</table>', i));
  })();
  for (const w of ['Infantry', 'Ranged', 'Cavalry', 'Flyers', 'Naval'])
    expect(roles.includes(`<strong>${w}</strong>`), `the rulebook roles table has a "${w}" row`).toBe(true);
  expect(
    !/Archers &amp; missile|<strong>Foot<\/strong>|<strong>Fleets<\/strong>/.test(roles),
    'the roles table has dropped "Foot", "Archers &amp; missile" and "Fleets" as headings',
  ).toBe(true);
  const kinds = (() => {
    const i = intro.indexOf('<h3>The kinds of unit</h3>');
    return i < 0 ? '' : intro.slice(i, intro.indexOf('</ul>', i));
  })();
  for (const w of ['Infantry', 'Ranged', 'Cavalry', 'Flyers', 'Naval'])
    expect(kinds.includes(`<strong>${w}</strong>`), `the intro's kinds-of-unit list has "${w}"`).toBe(true);
  expect(
    !/<strong>Foot<\/strong>|<strong>Archers<\/strong>|<strong>Fleets<\/strong>/.test(kinds),
    'the intro list has dropped "Foot", "Archers" and "Fleets"',
  ).toBe(true);
});

// 4. Portals and the Hall of Fame.
test('4. the portals and the Hall of Fame say ranged, not missile', timeLimitForTheWork({ everyFileReads: 1 }), () => {
  // Only the quoted blurbs are player-facing; a code comment beside one is not.
  const blurbText = entriesOf(fileDeclaring(PP, 'UNIT_ABILITIES'), 'UNIT_ABILITIES')
    .map((e) => e.value)
    .join('\n');
  expect(blurbText.length > 500, "the player portal's UNIT_ABILITIES block was found").toBe(true);
  expect(
    blurbText.length > 500 && !/missile/i.test(blurbText),
    'no unit blurb in the player portal says "missile"',
  ).toBe(true);
  const archeryLines = pageStrings('kingdoms-call-gm-portal.html').filter((l) => l.includes('Archery Phase**'));
  expect(
    archeryLines.length === 2 && archeryLines.every((l) => l.includes('ranged unit') && !l.includes('missile unit')),
    'both archery-phase report lines count "ranged units", not "missile units"',
  ).toBe(true);
  expect(
    /arrow_storm:\{[^}]*Strongest ranged host/.test(compactPage(LB)) &&
      !pageText(LB).includes('Strongest missile host'),
    'the Hall of Fame\'s "Storm of arrows" record says "ranged host"',
  ).toBe(true);
});
