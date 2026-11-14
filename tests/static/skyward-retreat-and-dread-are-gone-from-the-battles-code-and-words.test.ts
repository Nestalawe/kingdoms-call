// Skyward Retreat and Dread are gone from the battles' code and words (2026-10-11, Toby, the unit abilities, R-095;
// plan P1-14l, the retired rules' checks of the old `abilities-elven` and `abilities-orcish` scripts).
//   Skyward Retreat  the Eagle Riders climbed out of any trap untouched, where every other trapped unit rolled to be cut
//                    down with no escape: now the Eagles roll like anyone
//   Dread            Wyvern Riders on one side cut the other side's fanaticism by 15% (and, against a province's
//                    guards, the defenders' bonus by 10%): Terror From Above, in the battle grid, took its place
// Neither rule has a function left to call, so their absence is read from the code by its syntax tree
// (tests/lib/source.ts: one canonical layout, comments left out). The old scripts' four patterns are kept as they
// were; two of them could match no code written today (Parked: "Eleven checks in the old battle, order and report
// scripts can't fail"): `a.type==='Eagle Riders'){narr.push` (a battle's lines are facts written with narrate now,
// not strings pushed) and `_wyvAtk?0.15` / `_wyvDef?0.15` (one spelling of one variable). So each rule gets checks
// that see it however it came back: the two battle files' code names neither unit (a unit's rule is the registry's,
// src/engine/rules/), every no-escape roll draws its die first for every trapped unit, and each side's fanaticism
// reads its own force once and the other side's not at all.
// Level 0 (static): the code read by its syntax tree; nothing runs. A retired rule has no function a unit test could
// call, and a battle that happened to trap no Eagles, or field no Wyverns, would pass whatever the code said.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Skyward Retreat and Dread are gone (R-095): no line on the GM page says Eagle Riders "climb away over the encircling
// lines" or troops fight "with one eye on the sky"; neither battle file's code names the Eagle Riders or the Wyvern
// Riders; each of the three no-escape rolls draws its die first, for every trapped unit; each side's fanaticism chance
// reads its own force once and the other side's never; the old scripts' two code patterns are absent too
import { describe, expect, test } from 'vitest';
import { compactCode, compactOf, compactPage, statementsBetween } from '../lib/source.ts';

const GM_PAGE = 'kingdoms-call-gm-portal.html';
const AGAINST_A_PROVINCE = 'engine/battle/battles-against-province-defenders.ts';
const BETWEEN_HEROES = 'engine/battle/battles-between-heroes.ts';
const THE_BATTLE_FILES = [AGAINST_A_PROVINCE, BETWEEN_HEROES];

/** The GM page's code (its scripts and the prose its lines are written in), in one canonical layout. */
const page = compactPage(GM_PAGE);

/** Each no-escape roll of a battle file: the body of a unit's arrow, up to the fate it says (cut down with no
 *  escape). */
function theNoEscapeRollsOf(file: string): string[] {
  const code = compactOf(file);
  return [...code.matchAll(/forEach\(a=>\{((?:(?!forEach\().)*?)fate:'is cut down with no escape'/g)].map(
    (m) => m[1] ?? '',
  );
}

describe('Skyward Retreat is gone: Eagle Riders no longer climb out of a trap', () => {
  test('no line says the Eagle Riders climb away over the encircling lines', () => {
    expect(page).not.toMatch(/climb away over the encircling lines/);
  });

  test("no code spares the Eagle Riders with a line of its own (the old script's pattern)", () => {
    expect(page).not.toMatch(/a\.type==='Eagle Riders'\)\{\s*narr(ative)?\.push/);
  });

  test.each(THE_BATTLE_FILES)("%s's code names no Eagle Riders", (file) => {
    expect(compactOf(file)).not.toMatch(/Eagle Riders/);
  });

  test('each of the three no-escape rolls draws its die first, for every trapped unit', () => {
    const rolls = THE_BATTLE_FILES.flatMap(theNoEscapeRollsOf);
    expect(rolls).toHaveLength(3);
    for (const roll of rolls) expect(roll).toMatch(/^if\(kcRng\(\)<0\.15\)\{/);
  });
});

describe("Dread is gone: Wyverns overhead no longer cut the other side's fanaticism", () => {
  test('no line says the troops fight with one eye on the sky', () => {
    expect(page).not.toMatch(/one eye on the sky/);
  });

  test("no fanaticism is cut for Wyverns overhead (the old script's patterns)", () => {
    expect(page).not.toMatch(/_wyvAtk\?0\.15/);
    expect(page).not.toMatch(/_wyvDef\?0\.15/);
  });

  test.each(THE_BATTLE_FILES)("%s's code names no Wyvern Riders", (file) => {
    expect(compactOf(file)).not.toMatch(/Wyvern Riders/);
  });

  test("each side's fanaticism chance reads its own force once, and the other side's not at all", () => {
    const fanaticism = compactCode(statementsBetween(BETWEEN_HEROES, 'combatVsChar', '_atkFanPct', 'defFanatic'));
    const reads = (name: string) => fanaticism.match(new RegExp(`\\b${name}\\b`, 'g'))?.length ?? 0;
    expect(reads('atkArmies')).toBe(1);
    expect(reads('defArmies')).toBe(1);
    expect(fanaticism).toMatch(/const _atkFanPct=[^;]*theForce:atkArmies/);
    expect(fanaticism).toMatch(/let _defFanPct=[^;]*theForce:defArmies/);
  });
});
