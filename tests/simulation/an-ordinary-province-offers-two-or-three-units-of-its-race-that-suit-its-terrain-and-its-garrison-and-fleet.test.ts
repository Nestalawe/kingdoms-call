// 2026-10-14 (item 15): an ordinary (humanoid, non-home) province offers 2 or 3 units of its own race that suit its
// terrain: two three times in four, three one time in four, chosen at random from that race-and-terrain list
// (PROVINCE_ARMIES_P), never from another terrain; plus its race's garrison, and its race's fleet on a coast. A list
// with only two land units always gives both. Checked over 4 worlds of each of four sizes (10 under KC_FULL=1, in npm
// run test:full), from 2 realms on 8×5 to 10 realms on 20×12: well over a thousand provinces. That the rulebook gives
// the rule, and that its table of units by terrain and race is the game's list, is the GM page's test
// (tests/page/the-gm-pages-own-lair-names-item-effects-province-units-and-neutral-armies-keep-their-rules.test.ts).
//
// Level 3 (simulation): world generation is one long function (generateNewGame, src/engine/world/generate.ts), and the
// property is over whole worlds; the worlds are made on the engine's modules
// (tests/lib/a-staged-turn-on-the-engines-modules.ts's world) from KC_SEED. Four checks of each province hold on any
// world, by the deal's construction. Two count what the dice deal, which world generation doesn't guarantee (KD-413):
// at least 1,000 provinces were checked (about 1,050 on the seeds tried: a thin margin), and the share of those that
// could offer three and do lies between 15% and 35% (25% is the rule: on some 950 provinces the bounds are about seven
// standard deviations wide).
//
// Until plan P1-14z this was the world half of tests/province-pools.test.js, on the booted GM page, its size (4, or 10)
// given it by tests/suite.ts; each check is kept as it was.
import { beforeAll, expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';
import type { ANewWorld } from '../lib/the-lair-items-and-the-neutral-armies-a-new-world-deals.ts';
import { timeLimitGivenAsANumber } from '../lib/time-limits.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
/** Worlds of each size. */
const N = process.env['KC_FULL'] === '1' ? 10 : 4;
/** Realms, columns and rows: N worlds each. */
const SIZES: readonly (readonly [realms: number, cols: number, rows: number])[] = [
  [2, 8, 5],
  [4, 9, 7],
  [6, 16, 10],
  [10, 20, 12],
];
const HUMANOID = new Set(['Human', 'Elven', 'Dwarven', 'Orcish']);
/** Each humanoid race's fleet. */
const FLEET: Readonly<Record<string, string>> = {
  Human: 'Galleon Fleet',
  Elven: 'Elven Galleys',
  Dwarven: 'Dwarf Ironclads',
  Orcish: 'Orcish Longships',
};

let n = 0;
let three = 0;
let roomy = 0;
const off: string[] = [];
const badCount: string[] = [];
const noGarrison: string[] = [];
const badFleet: string[] = [];

// The 16 worlds took about 3 s on a laptop (40 under KC_FULL=1, about 8 s); 15 s a size of N worlds leaves room for a
// slow runner.
beforeAll(
  async () => {
    const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
    const { KC_UNIT_CLASS, PROVINCE_ARMIES_P } = await import('../../src/content/kingdoms-call-data.ts');
    const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
    const cells: Readonly<Record<string, Readonly<Record<string, readonly string[]>> | undefined>> = PROVINCE_ARMIES_P;
    const sea = new Set<string>(KC_UNIT_CLASS.sea);
    const land = (t: string, r: string) => (cells[t]?.[r] ?? []).filter((u) => !/garrison/i.test(u) && !sea.has(u));
    for (const [realms, cols, rows] of SIZES)
      for (let k = 0; k < N; k++) {
        // `as`: the engine's world, as the checks read it
        const S = sc.world({ realms, cols, rows, seaPct: 25 }).S as unknown as ANewWorld;
        const P = S.world.provinces;
        for (const p of P) {
          if (!p || p.terrain === 'sea' || !HUMANOID.has(p.race ?? '') || p.owner != null) continue;
          const race = p.race ?? '';
          const types = p.armyTypes ?? [];
          const own = types.filter((u) => !/garrison/i.test(u) && !sea.has(u));
          const cell = land(p.terrain, race);
          n++;
          if (own.some((u) => !cell.includes(u))) off.push(`${p.terrain} ${race}: ${own.join(', ')}`);
          const want = cell.length >= 3 ? [2, 3] : [cell.length];
          if (!want.includes(own.length))
            badCount.push(`${p.terrain} ${race}: ${String(own.length)} of ${String(cell.length)}`);
          if (cell.length >= 3) {
            roomy++;
            if (own.length === 3) three++;
          }
          if (!types.some((u) => /garrison/i.test(u))) noGarrison.push(p.name);
          const coastal = getNeighborsP(p, cols, rows, P).some((q) => q.terrain === 'sea');
          if (coastal && !types.includes(FLEET[race] ?? '')) badFleet.push(p.name);
        }
      }
  },
  timeLimitGivenAsANumber(SIZES.length * N * 3_750).timeout,
);

test('enough provinces were checked', () => {
  expect(n).toBeGreaterThanOrEqual(1000);
});
test("every unit offered suits the province's terrain and race", () => {
  expect(off).toEqual([]);
});
test('every province offers 2 or 3 of its own units, or both of a two-unit list', () => {
  expect(badCount).toEqual([]);
});
test('about one in four provinces that could offer three does', () => {
  const share = roomy ? three / roomy : 0;
  expect(share > 0.15 && share < 0.35, `${(100 * share).toFixed(1)}% of ${String(roomy)}`).toBe(true);
});
test("every province offers its race's garrison", () => {
  expect(noGarrison).toEqual([]);
});
test("every coastal province offers its race's fleet", () => {
  expect(badFleet).toEqual([]);
});
