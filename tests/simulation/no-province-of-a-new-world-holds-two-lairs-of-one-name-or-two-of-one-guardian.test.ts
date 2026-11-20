// 2026-10-13 (item 4, the ruling R-108): in a newly made world no province holds two lairs with the same base name
// ("Wolf Den" and "Wolf Den of Karnholt" share one), and no province holds two of the same guardian. Checked over five
// worlds from 2 realms on 8×5 to the largest size, 10 realms on 20×12 (twice), where the name pools run out and the
// place-qualified names appear. The staged call of the name picker, with every name of its element given out, is the
// GM page's test (tests/page/the-gm-pages-own-lair-names-item-effects-province-units-and-neutral-armies-keep-their-rules.test.ts).
//
// Level 3 (simulation): world generation is one long function (generateNewGame, src/engine/world/generate.ts), and the
// property is over whole worlds; the worlds are made on the engine's modules
// (tests/lib/a-staged-turn-on-the-engines-modules.ts's world) from KC_SEED. The two checks of names and guardians hold
// on any world, by the picker's construction. Two guards count what the dice deal, and world generation guarantees
// neither (KD-413): the worlds hold more than 500 lairs, and some name is place-qualified.
//
// Until plan P1-14z this was tests/lair-province-unique.test.js, on the booted GM page; each world check is kept as it
// was.
import { beforeAll, expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';
import type { AFeature, ANewWorld } from '../lib/the-lair-items-and-the-neutral-armies-a-new-world-deals.ts';
import { timeLimitGivenAsANumber } from '../lib/time-limits.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
/** Realms, columns and rows: a world each. */
const SIZES: readonly (readonly [realms: number, cols: number, rows: number])[] = [
  [2, 8, 5],
  [4, 12, 8],
  [6, 16, 10],
  [10, 20, 12],
  [10, 20, 12],
];
/** The connectives a place-qualified lair name puts before its province's name (src/engine/names.ts). */
const CONNECTIVES = [
  'of',
  'beneath',
  'under',
  'below',
  'beyond',
  'within',
  'on the marches of',
  'in the shadow of',
  'at the roots of',
  'hard by',
];
/** A lair name's base: without a numbered suffix and without its place-qualifier. */
const baseOf = (name: string, province: string) => {
  const b = name.replace(/ \(\d+\)$/, '');
  for (const c of CONNECTIVES) {
    const s = ` ${c} ${province}`;
    if (b.endsWith(s)) return b.slice(0, -s.length);
  }
  return b;
};

let lairs = 0;
let qualified = 0;
const nameDup: string[] = [];
const guardDup: string[] = [];

// The five worlds of 2 to 10 realms took about 1.5 s on a laptop; 30 s leaves room for a slow runner.
beforeAll(async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  for (const [realms, cols, rows] of SIZES) {
    // `as`: the engine's world, as the checks read it
    const S = sc.world({ realms, cols, rows, seaPct: 25 }).S as unknown as ANewWorld;
    for (const p of S.world.provinces) {
      if (!p) continue;
      const L = (p.features ?? []).filter(
        (f): f is AFeature => f !== null && f.ritualSite !== true && Boolean(f.monster),
      );
      lairs += L.length;
      const bases = L.map((f) => baseOf(f.name, p.name));
      const guardians = L.map((f) => f.monster?.name);
      qualified += L.filter((f) => baseOf(f.name, p.name) !== f.name).length;
      if (new Set(bases).size !== bases.length) nameDup.push(`${p.name}: ${L.map((f) => f.name).join(' / ')}`);
      if (new Set(guardians).size !== guardians.length) guardDup.push(`${p.name}: ${guardians.join(' / ')}`);
    }
  }
}, timeLimitGivenAsANumber(30_000).timeout);

test('the worlds hold enough lairs to matter', () => {
  expect(lairs).toBeGreaterThan(500);
});
test('the largest worlds run the name pools dry, so place-qualified names appear', () => {
  expect(qualified).toBeGreaterThan(0);
});
test('no province holds two lairs with one base name', () => {
  expect(nameDup).toEqual([]);
});
test('no province holds two of one guardian', () => {
  expect(guardDup).toEqual([]);
});
