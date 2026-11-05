// The world's making (src/engine/world/generate.ts) on the inputs no game of the balance matrix gives it: a sea share
// in words or none, a map too small for its realms or for its share of sea, a sea so wide its names run out, a setup
// whose king or kingdom has no name of its own, a king's skills in the join form's own words, a race the land tables
// don't hold, and an eleventh realm, past the ten colours. Each case reads what the world records: the share, the
// warnings to the GM, the provinces' names, the realms' and kings' names, the king's skills and home roster, a realm's
// colour. And (plan P1-21i, the mutation session of 2026-11-05) the crowded maps again on a planted copy of src/ in
// which no home finds a prosperous neighbour, so each forces one: never a cell an earlier king was promised.
//
// Level 1 (unit): generateNewGame called directly on the engine's modules, the dice seeded (kcRng), no turn played.
// Not lower: each value is made inside the one function, from the dice and the passes before it. The guarantees a
// world keeps around its homes are tests/unit/the-two-crowns-have-wild-country-within-two-provinces.test.ts, and the
// spacing of the homes tests/home-placement.test.js.
// The wide sea's case leaves out the lair stocking (items/lair-items.ts' ensureAllLairHoards, a spy that runs the real
// one in every other case): it runs after the provinces are named, so their names are the same without it, and on the
// 60 by 40 world it took nine tenths of the case's time (1.9 s of the case's 2.2 s locally; past 5 s on CI).
import path from 'node:path';
import { importTheWholeEngineFrom } from '../lib/the-whole-engine.ts';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { plantedSrc, replaceInitializer } from '../lib/source.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';
import { ensureAllLairHoards } from '../../src/engine/items/lair-items.ts';
import { kcRng } from '../../src/engine/rng.ts';
import { REALM_COLOURS, REALM_COLOUR_FALLBACK } from '../../src/engine/bots/intel.ts';
import { SEA_PCT_DEFAULT, generateNewGame, normSeaPct } from '../../src/engine/world/generate.ts';
import { getNeighborsP } from '../../src/engine/world/map-helpers.ts';

vi.mock('../../src/engine/items/lair-items.ts', { spy: true });

type TheSetUps = Parameters<typeof generateNewGame>[0];
type TheWorld = ReturnType<typeof generateNewGame>;

let warnings: string[] = [];
beforeEach(() => {
  warnings = [];
  vi.spyOn(console, 'warn').mockImplementation((...words: unknown[]) => {
    warnings.push(words.map(String).join(' '));
  });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** `n` realms, each Human and Good unless `each` says otherwise, named Realm i, King i. */
function realms(n: number, each: (i: number) => Partial<TheSetUps[number]> = () => ({})): TheSetUps {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    gamePlayerId: 'gp' + String(i),
    name: 'Realm' + String(i),
    kingName: 'King' + String(i),
    kingdomName: 'Kingdom' + String(i),
    race: 'Human',
    alignment: 'Good',
    temper: 'Brave',
    skills: { melee: 1 },
    ...each(i),
  }));
}
/** The world made from `setUps` on a `cols` by `rows` map with `seaPct` of sea, on the dice of `seed`. */
function aWorld(setUps: TheSetUps, cols: number, rows: number, seaPct: unknown, seed = 7): TheWorld {
  kcRng.seed(seed);
  return generateNewGame(setUps, { cols, rows }, 0, { seaPct });
}

test('a sea share in words, or none, is the default share; a number is held between 20% and 80%', () => {
  expect([normSeaPct('lots'), normSeaPct(undefined), normSeaPct(null)]).toEqual([35, 35, 35]);
  expect(SEA_PCT_DEFAULT).toBe(35);
  expect([normSeaPct(5), normSeaPct('47'), normSeaPct(95)]).toEqual([20, 47, 80]);
  expect(aWorld(realms(2), 8, 5, 'lots').world.seaPct).toBe(35);
});

test('a map too small for its realms warns the GM with the best spacing it found, and the realms still get homes', () => {
  const w = aWorld(realms(5), 8, 5, 20);
  const warning = warnings.find((x) => x.startsWith('World gen: no home layout'));
  expect(warning).toMatch(
    /^World gen: no home layout on a 8x5 map keeps 4 hexes between all 5 capitals \(best [0-3]\) — the map is too small for this many realms\.$/,
  );
  expect(new Set(w.players.map((p) => p.homeProvinceId)).size).toBe(5);
});

test('a sea share the homes leave out of reach warns the GM with the nearest share it reached', () => {
  aWorld(realms(5), 8, 5, 80);
  const warning = warnings.find((x) => x.startsWith('World gen: sea share'));
  expect(warning).toMatch(
    /^World gen: sea share 80% asked for 32 sea provinces on 8x5; the home neighbourhoods fix \d+ cells, so \d+ was the nearest reachable\.$/,
  );
});

test('a sea so wide that its names run out numbers them, in Roman numerals to XII and in figures after', () => {
  vi.mocked(ensureAllLairHoards).mockImplementationOnce(() => undefined);
  const w = aWorld(realms(2), 60, 40, 80);
  expect(ensureAllLairHoards).toHaveBeenCalledTimes(1);
  const names = w.world.provinces.map((p) => p.name ?? '');
  expect(new Set(names).size).toBe(names.length);
  expect(names.some((n) => n.endsWith(' II'))).toBe(true);
  expect(names.some((n) => n.endsWith(' XII'))).toBe(true);
  expect(names.some((n) => / 1[3-9]$/.test(n))).toBe(true);
});

test("a king or a kingdom with no name of its own takes the setup's name", () => {
  const w = aWorld(
    realms(2, (i) => (i === 0 ? { kingName: '', kingdomName: '' } : { kingName: undefined, kingdomName: undefined })),
    8,
    5,
    20,
  );
  expect(w.players.map((p) => [p.name, p.kingName])).toEqual([
    ['Realm0', 'Realm0'],
    ['Realm1', 'Realm1'],
  ]);
  expect(w.players.map((p) => w.characters.find((c) => c.id === p.king)?.name)).toEqual(['Realm0', 'Realm1']);
});

test("a king's skills in the join form's words are the engine's, added to his own; a Naval king's home builds ships", () => {
  const w = aWorld(
    realms(2, () => ({ skills: { Naval: 1, 'White Magic': 2, Melee: 1, Sage: 0 } })),
    8,
    5,
    20,
  );
  const king = w.characters.find((c) => c.id === w.players[0]?.king);
  expect(king?.skills).toEqual({ melee: 3, archery: 1, sage: 1, naval: 1, white: 2 });
  const home = w.world.provinces[w.players[0]?.homeProvinceId ?? -1];
  expect(home?.armyTypes).toContain('Galleon Fleet');
});

test("a race the land tables don't hold opens with the levies, a galleon for a Naval king, and no racial fleet", () => {
  const w = aWorld(
    realms(2, (i) => (i === 0 ? { race: 'Gnomish', skills: { naval: 1 } } : {})),
    8,
    5,
    20,
  );
  const king = w.characters.find((c) => c.id === w.players[0]?.king);
  expect(king?.armies.map((a) => [a.type, a.race])).toEqual([
    ['Shieldwall Levies', 'Gnomish'],
    ['Shieldwall Levies', 'Gnomish'],
  ]);
  const home = w.world.provinces[w.players[0]?.homeProvinceId ?? -1];
  expect(home?.race).toBe('Gnomish');
  expect(home?.armyTypes).toEqual(['Shieldwall Levies', 'Galleon Fleet']);
});

test('an eleventh realm, past the ten colours, takes the fallback colour', () => {
  const w = aWorld(realms(11), 20, 12, 20);
  const colours = w.players.map((p) => p.color);
  expect(new Set(colours.slice(0, 10))).toEqual(new Set(REALM_COLOURS));
  expect(colours[10]).toBe(REALM_COLOUR_FALLBACK);
});

/** The modules a world is made with: this checkout's, or a planted copy's. */
interface TheMaking {
  generateNewGame: typeof generateNewGame;
  kcRng: typeof kcRng;
  getNeighborsP: typeof getNeighborsP;
}
/** On five maps crowded with realms, made by `m`: every home keeps its ring's promises (a poor and a prosperous
 *  humanoid neighbour, and its own people beside it). */
function everyHomeKeepsItsRingsPromises(m: TheMaking) {
  for (const [n, cols, rows, seed] of [
    [5, 8, 5, 7],
    [5, 8, 5, 8],
    [6, 9, 6, 7],
    [6, 9, 6, 9],
    [4, 7, 5, 7],
  ] as const) {
    m.kcRng.seed(seed);
    const w = m.generateNewGame(
      realms(n, (i) => ({ race: ['Human', 'Elven', 'Dwarven', 'Orcish'][i % 4] ?? 'Human' })),
      { cols, rows },
      0,
      { seaPct: 35 },
    );
    const at = (id: number) => w.world.provinces[id];
    for (const pl of w.players) {
      const home = at(pl.homeProvinceId);
      const ring = m
        .getNeighborsP(home ?? { row: -9, col: -9 }, cols, rows, w.world.provinces)
        .filter((q) => q.terrain !== 'sea' && q.owner == null);
      const humanoid = ring.filter((q) => !(q.race ?? '').startsWith('Primal'));
      const where = `realm ${String(pl.id)} of ${String(n)} on ${String(cols)}x${String(rows)}, seed ${String(seed)}`;
      expect(
        humanoid.some((q) => q.tax >= 2 && q.tax <= 3),
        where + ': a poor neighbour',
      ).toBe(true);
      expect(
        humanoid.some((q) => q.tax >= 4 && q.tax <= 6),
        where + ': a prosperous neighbour',
      ).toBe(true);
      expect(
        ring.some((q) => q.race === pl.race),
        where + ': its own people beside it',
      ).toBe(true);
    }
  }
}

test("on maps crowded with realms, every home keeps its ring's promises: a poor and a prosperous neighbour, its own people near", () => {
  everyHomeKeepsItsRingsPromises({ generateNewGame, kcRng, getNeighborsP });
});

describe('a crowded home with no prosperous neighbour (a planted copy of src/ in which no home finds one)', () => {
  let planted: ReturnType<typeof plantedSrc> | undefined, made: TheMaking | undefined;
  afterAll(() => {
    planted?.remove();
  });
  // the copy made and its engine imported: every file of src/ twice
  beforeAll(
    async () => {
      planted = plantedSrc({
        'engine/world/generate.ts': (code, file) =>
          replaceInitializer(code, file, 'generateNewGame', 'prospNbr', 'null'),
      });
      await importTheWholeEngineFrom(planted.dir);
      const from = async <M>(file: string) => (await import(path.join(planted?.dir ?? '', file))) as M;
      made = {
        generateNewGame: (await from<typeof import('../../src/engine/world/generate.ts')>('engine/world/generate.ts'))
          .generateNewGame,
        kcRng: (await from<typeof import('../../src/engine/rng.ts')>('engine/rng.ts')).kcRng,
        getNeighborsP: (
          await from<typeof import('../../src/engine/world/map-helpers.ts')>('engine/world/map-helpers.ts')
        ).getNeighborsP,
      };
    },
    timeLimitForTheWork({ everyFileReads: 2 }).timeout,
  );

  test("forcing one never takes an earlier king's promised neighbour: every home keeps its ring's promises", () => {
    if (!made) throw new Error("the planted copy's engine was not imported");
    everyHomeKeepsItsRingsPromises(made);
  });
});
