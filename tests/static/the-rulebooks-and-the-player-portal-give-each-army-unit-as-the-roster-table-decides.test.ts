// The rulebooks say what the army roster as decided says (tests/lib/roster-decided.ts, the maintainer's decision of
// 2026-10-11): the comprehensive rulebook's roster rows (race, type, cost, base strength, move, terrain), its
// home-roster and move-rate tables, its kinds-of-unit examples, the light-foot list, the March example and the
// recruit-cap sentences in both rulebooks; the player portal names the new units; and no page still carries a retired
// rule (the goblins' spears, the Berserkers' Outnumbered and Uncaring).
//
// Level 0 (static): the rulebooks as built (site/, or $KC_SITE's) and the portals' files under src/ as written
// (tests/lib/source.ts), read, not run. Words in a book need no lower level, and no page needs to run.
//
// Moved from the old script tests/roster-words.test.js (P1-14z): each check kept, with a guard that each table was
// read; the game's own tables are checked against the same roster by
// tests/unit/the-engines-tables-give-each-army-unit-as-the-roster-table-decides.test.ts.
import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import { sitePath } from '../lib/boot.ts';
import { NEW_UNITS, RACES, ROSTER, SEA_LAND_PENALTY, isLand, unitsOf } from '../lib/roster-decided.ts';
import { pageSource } from '../lib/source.ts';

const read = (f: string) => fs.readFileSync(sitePath(f), 'utf8');
const rules = read('kingdoms-call-rules.html');
const intro = read('kingdoms-call-rules-intro.html');
const gm = pageSource('kingdoms-call-gm-portal.html');
const pp = pageSource('kingdoms-call-player-portal.html');

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const strip = (s: string) => {
  let t = s;
  for (;;) {
    const u = t.replace(/<[^>]*>/g, '');
    if (u === t) return u;
    t = u;
  }
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** The first group `re` matches in `text`, or ''. */
const firstGroup = (re: RegExp, text: string) => re.exec(text)?.[1] ?? '';

// ── The complete roster table: one row per unit ──
interface RosterRow {
  race: string;
  type: string;
  cost: string;
  str: string;
  move: string;
  druid: string;
  terr: string;
  ability: string;
}
const ROW =
  /<tr><td><strong>([^<]+)<\/strong><\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td><td class="terr"[^>]*>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><\/tr>/g;
const rows: Record<string, RosterRow> = {};
for (const m of rules.matchAll(ROW)) {
  const [, name = '', race = '', type = '', cost = '', str = '', move = '', druid = '', terr = '', ability = ''] = m;
  rows[name.trim()] = {
    race: race.trim(),
    type: type.trim(),
    cost: cost.trim(),
    str: str.trim(),
    move: move.trim(),
    druid: druid.trim(),
    terr,
    ability: strip(ability),
  };
}
// "Plain ×1.1 · Forest ×0.9 · Sea ×0.75 <span>(+ notes)</span>" → {plain:1.1, forest:0.9, sea:0.75}; "None — …" → {}
const terrOf = (cell: string) => {
  const t = strip(cell.replace(/<span[\s\S]*?<\/span>/g, '')).trim();
  const out: Record<string, number> = {};
  if (t.startsWith('None')) return out;
  for (const part of t.split('·')) {
    const mm = /^\s*([A-Za-z]+)\s*×\s*([\d.]+)\s*$/.exec(part);
    if (mm?.[1] && mm[2]) out[mm[1].toLowerCase()] = parseFloat(mm[2]);
    else out['?' + part.trim()] = NaN;
  }
  return out;
};

describe("the comprehensive rulebook's roster table", () => {
  test('the table was read', () => {
    expect(Object.keys(rows).length).toBeGreaterThan(0);
  });

  test.each(Object.keys(ROSTER).filter((u) => ROSTER[u]?.retired))('%s (retired) has no row', (u) => {
    expect(rows[u], `the rulebook's roster has no row for ${u} (retired)`).toBeUndefined();
  });

  test.each(Object.keys(ROSTER).filter((u) => !ROSTER[u]?.retired))('%s: its row says what the table says', (u) => {
    const d = ROSTER[u];
    if (!d) throw new Error(`no ${u} in the roster`);
    const r = rows[u];
    if (!r) throw new Error(`the rulebook's roster has a row for ${u}`);
    expect({
      race: r.race,
      type: r.type,
      cost: r.cost,
      str: r.str,
      move: r.move,
      druid: r.druid,
    }).toEqual({
      race: d.race,
      type: d.garrison ? 'Infantry (garrison)' : cap(d.type),
      cost: String(d.cost),
      str: String(d.str),
      move: String(d.speed),
      druid: '—', // no Druid needed by a leader of its own race
    });
    const want: Record<string, number> = { ...d.terr };
    if (isLand(d)) want['sea'] = SEA_LAND_PENALTY;
    const got = terrOf(r.terr);
    const keys = [...new Set([...Object.keys(want), ...Object.keys(got)])];
    const bad = keys
      .filter((k) => !near(want[k] ?? 1, got[k] ?? 1))
      .map((k) => `${k}: book ×${String(got[k] ?? 1)}, table ×${String(want[k] ?? 1)}`);
    expect(bad, `${u}: the row's terrain cell matches the table`).toEqual([]);
  });

  test("the Goblin Horde row no longer promises thrown spears in the archery step, nor the Orc Berserkers' Outnumbered", () => {
    expect(rows['Goblin Horde']?.ability ?? '').not.toMatch(/spear|archery step/i);
    expect(rows['Orc Berserkers']?.ability ?? '').not.toMatch(/Outnumbered/);
  });
});

describe('the home-rosters table: "Unit (base strength)" per race', () => {
  const homeTable = /<caption>Home rosters[\s\S]*?<\/table>/.exec(rules)?.[0] ?? '';
  test('the rulebook has the home-rosters table', () => {
    expect(homeTable.length).toBeGreaterThan(0);
  });
  test.each(RACES)('%s: each unit named has its base strength, and every land unit of the race is named', (race) => {
    const row = firstGroup(new RegExp(`<tr><td><strong>${race}</strong></td>([\\s\\S]*?)</tr>`), homeTable);
    const found: Record<string, number> = {};
    for (const mm of strip(row).matchAll(/([A-Z][A-Za-z' -]+?) \((\d+)\)/g))
      found[(mm[1] ?? '').trim()] = Number(mm[2]);
    for (const [name, str] of Object.entries(found))
      expect(
        ROSTER[name]?.str ?? 'no such unit',
        `home roster, ${race}: "${name} (${String(str)})" matches the table`,
      ).toBe(str);
    const missing = unitsOf(race, (d) => d.type !== 'naval').filter((u) => !(u in found));
    expect(missing, `home roster, ${race}: names every land unit of the race`).toEqual([]);
  });
});

test('the move-rate table: a unit named in a row has that move, and each new unit is in one row', () => {
  const moveTable = /<caption>Representative base land move rates[\s\S]*?<\/table>/.exec(rules)?.[0] ?? '';
  expect(moveTable.length, 'the rulebook has the move-rate table').toBeGreaterThan(0);
  const moveRows = [...moveTable.matchAll(/<tr><td class="num">(\d)<\/td><td>([\s\S]*?)<\/td><\/tr>/g)].map((m) => ({
    n: Number(m[1]),
    text: strip(m[2] ?? ''),
  }));
  for (const [u, d] of Object.entries(ROSTER))
    for (const r of moveRows.filter((row) => row.text.includes(u)))
      expect(d.speed, `move table: ${u} is listed under ${String(r.n)}`).toBe(r.n);
  const rowsOfEachNewUnit = Object.fromEntries(
    NEW_UNITS.map((u) => [u, moveRows.filter((r) => r.text.includes(u)).map((r) => r.n)]),
  );
  const notInOneRow = Object.entries(rowsOfEachNewUnit).filter(([, ns]) => ns.length !== 1);
  expect(notInOneRow, 'move table: each new unit appears in one row').toEqual([]);
});

test("the kinds-of-unit table gives each new unit as an example of its type, and the intro's cavalry line names the new cavalry", () => {
  const kindRow = (kind: string) =>
    strip(firstGroup(new RegExp(`<tr><td><strong>${kind}</strong></td><td>([\\s\\S]*?)</td></tr>`), rules));
  for (const u of NEW_UNITS) {
    const kind = cap(ROSTER[u]?.type ?? '');
    expect(kindRow(kind), `the kinds-of-unit table's ${kind} row names ${u}`).toContain(u);
  }
  const cavalry = strip(firstGroup(/<li><strong>Cavalry<\/strong>([\s\S]*?)<\/li>/, intro));
  // the cavalry that keeps its footing on rough ground
  expect(cavalry).toMatch(/Stag Riders/);
  expect(cavalry).toMatch(/Ironhoof Rams/);
});

test('the light-foot list (half a hull) names the new foot, not the new horse', () => {
  const lightFoot = strip(firstGroup(/<li><strong>Light foot<\/strong>([\s\S]*?)<\/li>/, rules));
  expect(lightFoot).toMatch(/Men-at-Arms/);
  expect(lightFoot).toMatch(/Black Arrows/);
  expect(lightFoot).not.toMatch(/Stag Riders|Ironhoof Rams/);
});

test("the March example uses the Levies' move, and its March-5 figure follows the ladder", () => {
  const levies = ROSTER['Shieldwall Levies']?.speed;
  const march = /leading base-(\d) levies, at <strong>(\d)<\/strong>/.exec(rules);
  expect(march, 'the rulebook has the March example').not.toBeNull();
  expect(Number(march?.[1]), `the March example calls levies base-${String(levies)}`).toBe(levies);
  // +3 at March 5, one rate for every unit since 2026-10-13
  expect(Number(march?.[2])).toBe((levies ?? NaN) + 3);
});

test('two a turn: both rulebooks name the Goblin Horde among the exceptions', () => {
  const raisePara = strip(firstGroup(/<h3[^>]*>How many you may raise in a turn<\/h3>\s*<p>([\s\S]*?)<\/p>/, rules));
  expect(raisePara).toMatch(/Goblin Horde/);
  expect(raisePara).toMatch(/two/);
  // no longer "one of only two things" you can raise two of
  expect(rules).not.toMatch(/only two things/);
  const recruitRow = strip(
    firstGroup(/<tr><td><strong>Recruit Armies<\/strong><\/td><td>([\s\S]*?)<\/td><\/tr>/, intro),
  );
  expect(recruitRow).toMatch(/Goblin Horde/);
});

test('retired rules are gone from every page, and the player portal names the new units', () => {
  expect(
    strip(rules).replace(/\s+/g, ' '),
    'the rulebook no longer counts Goblin Hordes among what shoots in the archery step',
  ).not.toMatch(/Goblin Hordes?\b[^.]*archery|archery[^.]*Goblin Hordes?\b/i);
  for (const [name, src] of [
    ['GM portal', gm],
    ['player portal', pp],
    ['rulebook', rules],
    ['intro', intro],
  ] as const)
    expect(src, `the ${name} no longer mentions Outnumbered and Uncaring`).not.toMatch(/Outnumbered and Uncaring/);
  for (const u of NEW_UNITS) expect(pp, `the player portal names ${u}`).toContain(u);
});
