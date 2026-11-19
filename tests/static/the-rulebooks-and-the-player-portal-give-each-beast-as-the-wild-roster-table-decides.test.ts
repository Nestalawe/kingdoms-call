// The books say what the wild roster as decided says (tests/lib/primal-decided.ts, the maintainer's decisions of
// 2026-10-13, Creatures and Monsters I to VI): the rulebook's roster rows for every live beast (family, type, cost,
// strength, move, Druid, terrain cell), the move-rate table and the Druid ladder; Wild Ferocity on no page; the Evil
// section's Druid +1, waiver, Monster neighbour, Reign of Fear (attacking only) and Terror's three stacks; the
// kinds-of-unit rows and the intro's table; the player portal's Evil and Druidic texts and its lists of beasts; Wyvern
// Riders named as a Monster nowhere; the renamed beasts' old names on no page; the retired multipliers gone from the
// rows and blurbs. (Call from the Pit and Awaken the Wild were removed on 2026-10-12: their own static test.)
//
// Level 0 (static): the rulebooks as built (site/, or $KC_SITE's) read as text; the player portal from src/ by its
// syntax tree (tests/lib/source.ts): its words as the strings it holds, its blurbs and realm texts as entries of their
// object literals. Words in a book need no lower level, and no page needs to run.
//
// Moved from the old script tests/primal-words.test.js (P1-14z): each check kept, with a guard that each table and
// list was read. The game's own tables are checked against the same roster by
// tests/unit/the-engines-tables-give-each-beast-as-the-wild-roster-table-decides.test.ts.
import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import { sitePath } from '../lib/boot.ts';
import { LIVE, RENAMED, REIGN_OF_FEAR, ROSTER, isLand } from '../lib/primal-decided.ts';
import { entriesOf, fileDeclaring, pageStrings, pageText } from '../lib/source.ts';

const PP = 'kingdoms-call-player-portal.html';
const read = (f: string) => fs.readFileSync(sitePath(f), 'utf8');
const rules = read('kingdoms-call-rules.html');
const intro = read('kingdoms-call-rules-intro.html');
const pp = pageText(PP);

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
const norm = (s: string) => strip(s).replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
/** The first group `re` matches in `text`, or ''. */
const firstGroup = (re: RegExp, text: string) => re.exec(text)?.[1] ?? '';
/** The value of `key` in the object literal `name` of `file` under src/, or ''. */
const entry = (file: string, name: string, key: string) =>
  entriesOf(file, name).find((e) => e.key === key)?.value ?? '';
/** The first of the player portal's strings `re` matches, or null (a match never runs from one string into the next). */
const inOneString = (re: RegExp) => {
  for (const t of pageStrings(PP)) {
    const m = re.exec(t);
    if (m) return m;
  }
  return null;
};
/** The words of the rulebook's two-cell row headed `name`. */
const kindsRow = (name: string) =>
  norm(firstGroup(new RegExp(`<tr><td><strong>${name}</strong></td><td>([\\s\\S]*?)</td></tr>`), rules));
const unit = (u: string) => {
  const d = ROSTER[u];
  if (!d) throw new Error(`no ${u} in the wild roster`);
  return d;
};
const liveOf = (family: string) => LIVE.filter((u) => unit(u).family === family);

// ── The roster rows ──
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
    ability: norm(ability),
  };
}
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

describe("the comprehensive rulebook's roster rows", () => {
  test('the table was read, and the wild roster has live beasts', () => {
    expect(Object.keys(rows).length).toBeGreaterThan(0);
    expect(LIVE.length).toBeGreaterThan(0);
  });

  test.each(LIVE)('%s: its row says what the table says', (u) => {
    const d = unit(u);
    const r = rows[u];
    if (!r) throw new Error(`the rulebook's roster has a row for ${u}`);
    expect({ race: r.race, type: r.type, cost: r.cost, str: r.str, move: r.move, druid: r.druid }).toEqual({
      race: d.family,
      type: cap(d.type),
      cost: String(d.cost),
      str: String(d.str),
      move: String(d.speed),
      druid: String(d.druid),
    });
    const want: Record<string, number> = { ...d.terr };
    if (isLand(d)) want['sea'] = 0.75;
    const got = terrOf(r.terr);
    const keys = [...new Set([...Object.keys(want), ...Object.keys(got)])];
    const bad = keys
      .filter((k) => !near(want[k] ?? 1, got[k] ?? 1))
      .map((k) => `${k}: book ×${String(got[k] ?? 1)}, table ×${String(want[k] ?? 1)}`);
    expect(bad, `${u}: the row's terrain cell matches the table`).toEqual([]);
  });

  test('terrain written once: the rows no longer promise a second multiplier on top of their terrain cell', () => {
    expect(rows['Stone Giants']?.ability ?? '').not.toMatch(/Mountain Bulwark/);
    expect(rows['Stone Giants']?.terr ?? '').not.toMatch(/Bulwark/);
    expect(rows['Forest Ents']?.ability ?? '').not.toMatch(/Rooted Grove/);
    expect(rows['Forest Ents']?.terr ?? '').not.toMatch(/Rooted Grove/);
    expect(rows['Cave Trolls']?.ability ?? '', 'no always-on ×1.2 / ×1.3').not.toMatch(/×1\.2|×1\.3|×1\.56/);
    expect(rows['Titan Warbeasts']?.ability ?? '', 'no always-on ×1.3').not.toMatch(/×1\.3/);
  });
});

test('the renamed beasts (Creatures and Monsters II): the old names on no page', () => {
  const oldNames = Object.keys(RENAMED);
  expect(oldNames.length).toBeGreaterThan(0);
  for (const [page, text] of [
    ['rulebook', rules],
    ['intro', intro],
    ['player portal', pp],
  ] as const)
    for (const old of oldNames)
      expect(text.includes(old), `${page}: no "${old}" (it is ${RENAMED[old] ?? ''} now)`).toBe(false);
  const creatures = kindsRow('Creatures');
  expect(creatures, 'the kinds-of-unit Creatures row names thunderbirds, not eagles').toMatch(/thunderbirds/i);
  expect(creatures).not.toMatch(/eagles/);
  expect(kindsRow('Sea-beasts'), 'the kinds-of-unit Sea-beasts row no longer names leviathans').not.toMatch(
    /leviathans?/i,
  );
});

test('the move-rate table lists each beast at its move', () => {
  const moveTable = /<caption>Representative base land move rates[\s\S]*?<\/table>/.exec(rules)?.[0] ?? '';
  const moveRows = [...moveTable.matchAll(/<tr><td class="num">(\d)<\/td><td>([\s\S]*?)<\/td><\/tr>/g)].map((m) => ({
    n: Number(m[1]),
    text: strip(m[2] ?? ''),
  }));
  const MOVE_ALIASES: Record<string, RegExp> = {
    'Stone Giants': /Stone Giants/,
    'Forest Ents': /Forest Ents/,
    'Cave Trolls': /Cave Trolls/,
    'Basilisk Brood': /Basilisk/,
    'Titan Warbeasts': /Titan/,
    'Manticore Pride': /Manticore/,
    'Elder Dragons': /Elder Dragons/,
    'Crimson Rocs': /Crimson Rocs/,
    Thunderbirds: /Thunderbirds/,
    'Dread Hydras': /Hydras/,
    'Great Bears': /Great Bears/, // 2026-10-13 (Creatures and Monsters IV)
    'Unicorn Herd': /Unicorn/,
    'Mammoth Host': /Mammoth/,
  };
  for (const [u, re] of Object.entries(MOVE_ALIASES)) {
    const inRows = moveRows.filter((r) => re.test(r.text));
    expect(inRows.length, `move table: ${u} is listed`).toBeGreaterThanOrEqual(1);
    for (const r of inRows) expect(unit(u).speed, `move table: ${u} is listed under ${String(r.n)}`).toBe(r.n);
  }
});

test('the Druid ladder names each live beast at its level, and an Evil realm leads Monsters with no Druid', () => {
  const ladder = (lvl: number) =>
    norm(firstGroup(new RegExp(`<strong>Druid ${String(lvl)}</strong> — ([^<]*)`), rules));
  for (const u of LIVE) expect(ladder(unit(u).druid), `the Druid ladder names ${u}`).toContain(u);
  const text = norm(rules);
  expect(
    /Evil realms? lead(s)? every Monster|Evil realm leads every Monster|Evil realms command Monsters/i.test(text) ||
      /Evil realm(s)?[^.]{0,80}Monsters?[^.]{0,80}no Druid/i.test(text),
    'the Druid skill text says an Evil realm leads Monsters with no Druid, beside the Druidic line',
  ).toBe(true);
});

describe('the two crowns', () => {
  const section = (h: string) => {
    const i = rules.indexOf(h);
    if (i < 0) return '';
    const j = rules.indexOf('<h3', i + h.length);
    return norm(rules.slice(i, j < 0 ? undefined : j));
  };
  const dru = section('Druidic <span');
  const evil = section('Evil <span');

  test('the rulebook has the Druidic and Evil alignment sections', () => {
    expect(dru.length).toBeGreaterThan(0);
    expect(evil.length).toBeGreaterThan(0);
  });

  test.each([
    ['rulebook', norm(rules)],
    ['intro', norm(intro)],
    ['player portal', pp.replace(/[’‘]/g, "'")],
  ])('%s: Wild Ferocity is gone, and no Creature host fights ×1.25', (_page, text) => {
    expect(text).not.toMatch(/wild ferocity/i);
    expect(text).not.toMatch(/host with (a|any) Creature( unit)? fights (at )?×1\.25|Creature hosts fight at ×1\.25/i);
  });

  test("the Evil section: Druid +1, Monsters with no Druid, Reign of Fear when attacking, Terror's three stacks, a Monster province beside", () => {
    expect(evil, 'the king starts with Druid +1').toMatch(/Druid \+1/);
    expect(evil, 'Monsters follow with no Druid requirement').toMatch(/no Druid/);
    expect(evil).toMatch(/Monster/);
    expect(evil).toMatch(/Reign of Fear/);
    expect(evil, `Reign of Fear is ×${String(REIGN_OF_FEAR)} in a province under Terror`).toMatch(
      new RegExp(`×${String(REIGN_OF_FEAR)}`),
    );
    expect(evil).toMatch(/Terror/);
    // Terror stacks up to three times (2026-10-12, item 21)
    expect(evil).toMatch(/stacking, up to three times/);
    expect(evil).not.toMatch(/up to five times/);
    // Reign of Fear fires only when attacking (2026-10-12)
    expect(evil).toMatch(/Reign of Fear.{0,80}when they attack/);
    expect(evil).not.toMatch(/attacking or defending/);
    expect(evil, 'the king opens beside a Monster province').toMatch(/Monster province/);
    expect(evil).toMatch(/beside/);
  });

  test.each([
    ['intro', norm(intro)],
    ['player portal', pp],
  ])('%s: Reign of Fear is not promised when defending', (_page, text) => {
    expect(text).not.toMatch(/Terror[^.]{0,40}attacking or defending/);
    expect(text).not.toMatch(/×1\.5 on ground (under )?your Terror/);
  });

  test("the intro's Evil row says Monsters need no Druid", () => {
    expect(norm(/<tr><td>😈 <strong>Evil<\/strong>[\s\S]*?<\/tr>/.exec(intro)?.[0] ?? '')).toMatch(/no Druid/);
  });

  // Wyvern Riders are orcish soldiers, not Monsters (2026-10-11): no Monster list may name them.
  test('Wyvern Riders are named as a Monster nowhere', () => {
    const monsters = kindsRow('Monsters');
    expect(monsters, 'the kinds-of-unit Monsters row no longer names wyverns').not.toMatch(/Wyvern Riders/);
    expect(monsters).not.toMatch(/wyverns/);
    expect(evil, 'the Evil section no longer names Wyvern Riders among the Monsters').not.toMatch(/Wyvern Riders/);
    expect(pp).not.toMatch(/\[M\] Monsters:<\/span>[^<]*Wyvern Riders/);
    expect(pp).not.toMatch(/Monster armies — Wyvern Riders/);
    expect(pp).not.toMatch(/\(trolls, wyverns/);
  });

  // Every live beast is named where its family is listed (2026-10-13, Creatures and Monsters III: the Shark Shoals join
  // the Monsters): the Evil section's savage-fury list and the player portal's Evil texts name every live Monster; the
  // player portal's Creature list names every live Creature; the Sea-beasts row names the swimming Monsters.
  test('every live beast is named where its family is listed', () => {
    const fury = firstGroup(/savage fury[^()]*\(([^)]*)\)/i, evil);
    const ppMon = inOneString(/\[M\] Monsters:<\/span>([^<']*)/)?.[1] ?? '';
    const ppMonSum = firstGroup(
      /Monster armies — ([^—]*) — fight with savage fury/,
      entry('ui/player/report.ts', 'ALIGNMENT_SUMMARIES', 'Evil'),
    );
    const ppCre = inOneString(/\[C\] Creatures:<\/span>([^<']*)/)?.[1] ?? '';
    expect(liveOf('Monster').length).toBeGreaterThan(0);
    expect(liveOf('Creature').length).toBeGreaterThan(0);
    for (const u of liveOf('Monster')) {
      expect(fury, `the Evil section's savage-fury list names ${u}`).toContain(u);
      expect(ppMon, `the player portal's [M] Monsters list names ${u}`).toContain(u);
      expect(ppMonSum, `the player portal's Evil realm text names ${u} among the Monster armies`).toContain(u);
    }
    for (const u of liveOf('Creature')) expect(ppCre, `the player portal's [C] Creatures list names ${u}`).toContain(u);
    const seaBeasts = kindsRow('Sea-beasts');
    for (const u of LIVE.filter((name) => unit(name).type === 'naval' && name !== 'Whale Cohort'))
      expect(
        seaBeasts,
        `the kinds-of-unit Sea-beasts row names the ${u} (every swimming beast that is no hull)`,
      ).toMatch(new RegExp((u.split(' ').pop() ?? '').replace(/s$/, '').toLowerCase() + 's?', 'i'));
    expect(
      (norm(rules).match(/whale and shark waters/g) ?? []).length,
      'the rulebook\'s sea-tax texts say "whale and shark waters" where they said "whale waters"',
    ).toBeGreaterThanOrEqual(2);
  });

  // The four new Creatures (2026-10-13, Creatures and Monsters IV): the Creature lists name them, the Druidic realm
  // text names every live Creature, and no page still offers eagles or griffons to the wild.
  test('the four new Creatures are named in the Creature lists, and no Druidic text offers eagles or griffons', () => {
    const ppDruSummary = entry('ui/player/report.ts', 'ALIGNMENT_SUMMARIES', 'Druidic');
    const ppDruDesc = inOneString(/^🌿 \*\*Druidic:\*\*[\s\S]*/)?.[0] ?? '';
    for (const u of liveOf('Creature'))
      expect(ppDruSummary, `the player portal's Druidic realm text names ${u} among the Creature armies`).toContain(u);
    expect(ppDruDesc, "the player portal's Druidic join-screen blurb no longer names griffons or eagles").not.toMatch(
      /eagles|griffons/i,
    );
    const creaturesRow = kindsRow('Creatures');
    const wildwarden = norm(/<tr><td>The Wildwarden<\/td>[\s\S]*?<\/tr>/.exec(rules)?.[0] ?? '');
    for (const w of ['bears', 'unicorns', 'mammoths', 'turtles']) {
      expect(creaturesRow, `the kinds-of-unit Creatures row names ${w}`).toMatch(new RegExp(w, 'i'));
      expect(wildwarden, `the Wildwarden title names ${w}`).toMatch(new RegExp(w, 'i'));
    }
  });

  test("the player portal's Evil texts name Reign of Fear and give the king Druid +1", () => {
    expect(pp).toMatch(/Reign of Fear/);
    const ppEvilSummary = entry('ui/player/report.ts', 'ALIGNMENT_SUMMARIES', 'Evil');
    const ppEvilDesc = inOneString(/^💀 \*\*Evil:\*\*[\s\S]*/)?.[0] ?? '';
    expect(ppEvilSummary, 'the realm summary').toMatch(/Druid 1 from the outset|Druid \+1/);
    expect(ppEvilDesc, 'the join-screen blurb').toMatch(/Druid \+1/);
  });
});

test("the player portal's blurbs: the retired multipliers are gone", () => {
  const blurb = (u: string) => entry(fileDeclaring(PP, 'UNIT_ABILITIES'), 'UNIT_ABILITIES', u).replace(/[’‘]/g, "'");
  expect(blurb('Stone Giants')).not.toMatch(/Mountain Bulwark/);
  expect(blurb('Forest Ents')).not.toMatch(/Rooted Grove/);
  expect(blurb('Cave Trolls'), 'no always-on multiplier').not.toMatch(/×1\.2|×1\.3/);
  expect(blurb('Titan Warbeasts'), 'no always-on ×1.3').not.toMatch(/×1\.3/);
});
