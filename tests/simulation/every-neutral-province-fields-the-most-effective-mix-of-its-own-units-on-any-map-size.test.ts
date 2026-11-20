// 2026-10-13 (item 13): a neutral province's starting army is the most effective mix of the units it offers, with the
// number of units its wealth band gives (Poor 1–2, Prosperous 2–3, Rich 3–4), never a garrison or a ship, and its
// neutral guard leads exactly those units. "Most effective" is the battle estimate the bots use for a neutral province
// (botBattleForce: base strength and quality on the battle grid of the province's terrain); the test works the best
// score out on its own, over every mix of the province's land units, and compares. Checked over five worlds from 2
// realms on 8×5 to the largest size, 10 realms on 20×12. The GM page test
// (tests/page/the-gm-pages-own-lair-names-item-effects-province-units-and-neutral-armies-keep-their-rules.test.ts)
// runs the same checks on one world the page made, with the page's own functions.
//
// Level 3 (simulation): world generation is one long function (generateNewGame, src/engine/world/generate.ts), and the
// property is over whole worlds; the worlds are made on the engine's modules
// (tests/lib/a-staged-turn-on-the-engines-modules.ts's world) from KC_SEED, and read with the modules' botBattleForce
// and neutralDefBand (tests/lib/the-lair-items-and-the-neutral-armies-a-new-world-deals.ts). The four checks of each
// province hold on any world, by the deal's construction. Two guards count what the dice deal, and world generation
// guarantees neither (KD-413): at least 150 provinces with a choice were scored, and some field more than one type.
//
// Until plan P1-14z this was tests/neutral-best-mix.test.js, on the booted GM page; each check is kept as it was. The
// count of provinces that field more than one type, which the script printed, is the last test's message.
import { beforeAll, expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';
import { theNeutralArmies, type ANewWorld } from '../lib/the-lair-items-and-the-neutral-armies-a-new-world-deals.ts';
import { timeLimitGivenAsANumber } from '../lib/time-limits.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
/** Realms, columns and rows: a world each. */
const SIZES: readonly (readonly [realms: number, cols: number, rows: number])[] = [
  [2, 8, 5],
  [3, 8, 7],
  [4, 9, 7],
  [6, 16, 10],
  [10, 20, 12],
];

let checked = 0;
let mixed = 0;
const weak: string[] = [];
const band: string[] = [];
const foreign: string[] = [];
const guard: string[] = [];

// The five worlds and their scoring took about 1.5 s on a laptop; 30 s leaves room for a slow runner.
beforeAll(async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { KC_UNIT_CLASS } = await import('../../src/content/kingdoms-call-data.ts');
  const { botBattleForce } = await import('../../src/engine/bots/intel.ts');
  const { neutralDefBand } = await import('../../src/engine/units/drill-and-spoils.ts');
  for (const [realms, cols, rows] of SIZES) {
    // `as`: the engine's world, as the checks read it
    const S = sc.world({ realms, cols, rows, seaPct: 25 }).S as unknown as ANewWorld;
    const w = theNeutralArmies(S, { seaUnits: KC_UNIT_CLASS.sea, neutralDefBand, botBattleForce });
    checked += w.checked;
    mixed += w.mixed;
    weak.push(...w.weak);
    band.push(...w.band);
    foreign.push(...w.foreign);
    guard.push(...w.guard);
  }
}, timeLimitGivenAsANumber(30_000).timeout);

test('enough neutral provinces with a choice were checked', () => {
  expect(checked).toBeGreaterThanOrEqual(150);
});
test('every neutral province fields its most effective mix', () => {
  expect(weak).toEqual([]);
});
test("every neutral province keeps its wealth band's number of units", () => {
  expect(band).toEqual([]);
});
test('every unit is one the province itself offers, never a garrison or a ship', () => {
  expect(foreign).toEqual([]);
});
test("each neutral guard leads exactly the province's units", () => {
  expect(guard).toEqual([]);
});
test('some provinces field a genuine mix of unit types', () => {
  expect(mixed, `${String(mixed)} of ${String(checked)} provinces field more than one type`).toBeGreaterThan(0);
});
