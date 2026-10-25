// The resolvers the rule registry has taken name no unit type (plan P1-19, Decision 7 and Choice 3): each function the
// registry's rows have taken holds no string naming a unit type of KC_UNIT_TYPE that it compares, looks up by or passes
// to has, get, includes or indexOf; its effects ask their content rows, by slug, in src/engine/rules/. Each row of
// P1-19 adds the functions it takes. Counted by syntax tree with the ratchet's helper (tools/ratchet.ts's
// unitNameChecksByFunction), which also counts the engine's checks outside the registry (unitNameChecksInEngine), so
// that count only falls.
//
// Red on each row's base by design (unitAbilityMult held 9 on P1-19a's base; abilityFront 19 and abilityBack 6 on
// P1-19b's; battleFaceSide 11 on P1-19c's; rollUnitFates 4 on P1-19d's), as P1-11a4's static test was: the one
// exception to refactor-only's rule that new tests pass before and after (Theo, 2026-10-25).
// Level 0 (static): the files' syntax trees; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import { unitNameChecksByFunction } from '../../tools/ratchet.ts';

/** Each function the registry has taken, by its file, from the row that took it. */
const TAKEN: readonly (readonly [file: string, fn: string, row: string])[] = [
  ['src/engine/battle/strength.ts', 'unitAbilityMult', 'P1-19a, the whole force'],
  ['src/engine/battle/lines.ts', 'abilityFront', 'P1-19b, facing'],
  ['src/engine/battle/lines.ts', 'abilityBack', 'P1-19b, facing'],
  ['src/engine/battle/lines.ts', 'battleFaceSide', 'P1-19c, the whole line'],
  ['src/engine/battle/fates.ts', 'rollUnitFates', 'P1-19d, fates'],
];

test.for(TAKEN)('%s: %s names no unit type (%s)', ([file, fn]) => {
  const counts = unitNameChecksByFunction(file, fs.readFileSync(path.join(ROOT, file), 'utf8'));
  expect(counts.has(fn), `${file} declares ${fn}`).toBe(true);
  expect(counts.get(fn)).toBe(0);
});

// The helper finds what it counts: every way of naming a unit planted in one function (an arrow with no name inside
// it counts for it, a named one for itself), and none of the strings that aren't a check or aren't a unit type's name.
test('the helper counts each check of a unit by its name, and nothing else', () => {
  const planted = `
    export function planted(a, t, table, set) {
      if (a.type === 'Goblin Horde' || 'Men-at-Arms' !== t || t == 'Cave Trolls' || t != 'Elder Dragons') return 1;
      switch (t) { case 'Shark Shoals': return 2; }
      const x = table['Sea Giants'] + set.has('Crimson Rocs') + set.get('Basilisk Brood');
      const y = ['Stone Giants'].includes(t) + [t].indexOf('Unicorn Herd');
      const inside = [t].some((u) => u === 'Titan Warbeasts'), nested = () => t === 'Great Bears';
      const notChecks = ['Orc Berserkers', 'Warg Riders'], label = 'Thunderbirds', notAUnit = t === 'Garrison';
      return x + y + inside + nested() + notChecks.length + label.length + notAUnit;
    }
    const nestedNamed = function named() { return 'Dread Hydras' === t; };`;
  const counts = unitNameChecksByFunction('planted.ts', planted);
  expect(Object.fromEntries(counts)).toEqual({ planted: 10, nested: 1, nestedNamed: 1 });
});
