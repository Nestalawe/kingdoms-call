// 2026-10-13 (item 12): in a newly generated world every Druidic king has at least one land Creature province within
// two provinces of home, and every Evil king a land Monster province, so each crown reaches its speciality early. The
// guarantees around homes still hold: no home's ring holds more than one wild (Creature or Monster) province, and each
// home still borders a province of its own race. Checked over 4 worlds a size (12 under KC_FULL), from 2 realms to the
// largest size, every realm Druidic or Evil:
//   natural: world generation as it is, the dice seeded from KC_SEED (the alignment pass usually puts the province
//     right beside the home, so these worlds already passed before item 12). A world the nightly finds that breaks the
//     guarantee is an engine defect, repeatable from its seed: never a seed that passes instead;
//   no free neighbour: the alignment pass is made to find no free neighbour (the case its comment allows: "may be
//     empty"), in a planted copy of src/ whose `_freeNbrs` is declared empty, found by its syntax tree
//     (tests/lib/source.ts). Before item 12 these worlds left crowns with no wild country of their own near home. On
//     the fixed worlds of seed 1 only: on other seeds the wild-country pass can still give up (about 1 crown in 10,000,
//     an engine gap parked for its fix, whose pull request moves this case to KC_SEED).
//
// Level 1 (unit): generateNewGame called directly on the engine's modules (plan P1-14a), no turn played. The books'
// promise is tests/static/the-books-promise-the-two-crowns-wild-country-near-home.test.ts. Until plan P1-14a this was
// tests/crown-wild-near.test.js, a simulation-level script whose worlds were made in the engine's vm, on seed 1 only.
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { plantedSrc, replaceInitializer } from '../lib/source.ts';
import { importTheWholeEngineFrom } from '../lib/the-whole-engine.ts';
import { timeLimitForPropertyRuns, timeLimitForTheWork } from '../lib/time-limits.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
const WORLDS_A_SIZE = process.env['KC_FULL'] === '1' ? 12 : 4;
/** Realms, columns and rows: from 2 realms to the largest size. */
const SIZES = [
  [2, 8, 5],
  [3, 8, 7],
  [4, 9, 7],
  [6, 16, 10],
  [10, 20, 12],
] as const;
/** Making one set of worlds: each is one input the guarantees are checked on, as a property test's (a 10-realm world
 *  on a 20×12 map, the slowest, takes under 0.5 s on a laptop), so KC_FULL's three times the worlds get three times
 *  the time. */
const A_LIMIT_FOR_THE_WORLDS = timeLimitForPropertyRuns(SIZES.length * WORLDS_A_SIZE, 750).timeout;

/** What the test calls, from one copy of src/. */
interface TheEngine {
  generateNewGame: (typeof import('../../src/engine/world/generate.ts'))['generateNewGame'];
  generateBotSetups: (typeof import('../../src/engine/bots/setup.ts'))['generateBotSetups'];
  getNeighborsP: (typeof import('../../src/engine/world/map-helpers.ts'))['getNeighborsP'];
  kcRng: (typeof import('../../src/engine/rng.ts'))['kcRng'];
  KC_UNIT_CLASS: (typeof import('../../src/content/kingdoms-call-data.ts'))['KC_UNIT_CLASS'];
}

/** The engine's modules of the copy of src/ in `src`, the whole engine imported first. Fresh: this checkout's after
 *  vi.resetModules(), a planted copy's the first time it is imported. */
async function theEngineIn(src: string): Promise<TheEngine> {
  await importTheWholeEngineFrom(src);
  const from = async <M>(file: string) => (await import(path.join(src, file))) as M;
  const { generateNewGame } =
    await from<typeof import('../../src/engine/world/generate.ts')>('engine/world/generate.ts');
  const { generateBotSetups } = await from<typeof import('../../src/engine/bots/setup.ts')>('engine/bots/setup.ts');
  const { getNeighborsP } =
    await from<typeof import('../../src/engine/world/map-helpers.ts')>('engine/world/map-helpers.ts');
  const { kcRng } = await from<typeof import('../../src/engine/rng.ts')>('engine/rng.ts');
  const { KC_UNIT_CLASS } = await from<typeof import('../../src/content/kingdoms-call-data.ts')>(
    'content/kingdoms-call-data.ts',
  );
  return { generateNewGame, generateBotSetups, getNeighborsP, kcRng, KC_UNIT_CLASS };
}

interface Province {
  id: number;
  row: number;
  col: number;
  name: string;
  terrain: string;
  race?: string;
  owner?: number | null;
  armyTypes?: string[];
}
interface World {
  players: { alignment: string; race: string; homeProvinceId: number }[];
  world: { provinces: Province[] };
}

/** What the worlds made with `seed`'s dice show: the tables read, the crowns checked, and the guarantees broken. */
function worldsOf(m: TheEngine, seed: number) {
  const creatures = new Set(m.KC_UNIT_CLASS.creature);
  const monsters = new Set(m.KC_UNIT_CLASS.monster);
  let crowns = 0;
  const missing: string[] = [],
    capBroken: string[] = [],
    pairBroken: string[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    m.kcRng.seed(seed);
    for (const [realms, cols, rows] of SIZES)
      for (let k = 0; k < WORLDS_A_SIZE; k++) {
        const setup = (m.generateBotSetups([], realms, 0) as Record<string, unknown>[]).map((b, i) => ({
          ...b,
          alignment: (i + k) % 2 ? 'Evil' : 'Druidic',
          gamePlayerId: 'gp' + String(b['id']),
          name: b['kingdomName'],
        }));
        const S = m.generateNewGame(setup, { cols, rows }, 999, { seaPct: 25 }) as unknown as World;
        const P = S.world.provinces;
        const nb = (p: Province) =>
          (m.getNeighborsP(p, cols, rows, P) as (Province | undefined)[]).filter((q): q is Province => q != null);
        const wild = (p: Province | undefined) => !!p && p.terrain !== 'sea' && (p.race ?? '').startsWith('Primal');
        for (const pl of S.players) {
          const home = P[pl.homeProvinceId];
          if (!home) throw new Error(`a realm's home ${String(pl.homeProvinceId)} is not on the map`);
          crowns++;
          const want = pl.alignment === 'Druidic' ? creatures : monsters;
          const near = new Set<Province>();
          nb(home).forEach((n) => {
            near.add(n);
            nb(n).forEach((q) => {
              if (q !== home) near.add(q);
            });
          });
          if (![...near].some((q) => wild(q) && want.has(q.armyTypes?.[0] ?? '')))
            missing.push(`${String(realms)} realms, world ${String(k)}: ${pl.alignment} home ${home.name}`);
          const ringWild = nb(home).filter((n) => wild(n) && n.owner == null);
          if (ringWild.length > 1) capBroken.push(`${home.name}: ${String(ringWild.length)}`);
        }
        // the poor and prosperous neighbours promised to each home: at least one humanoid own-race land neighbour
        for (const pl of S.players) {
          const home = P[pl.homeProvinceId];
          if (home && !nb(home).some((n) => n.terrain !== 'sea' && n.race === pl.race)) pairBroken.push(home.name);
        }
      }
  } finally {
    log.mockRestore();
    warn.mockRestore();
  }
  return { creatures: creatures.size, monsters: monsters.size, crowns, missing, capBroken, pairBroken };
}

/** The checks on one set of worlds (`made` once, before them). */
function theGuarantees(made: () => ReturnType<typeof worldsOf>) {
  test('the Creature and Monster tables were read', () => {
    expect(made().creatures).toBeGreaterThan(5);
    expect(made().monsters).toBeGreaterThan(5);
  });
  test('enough crowns were checked', () => {
    expect(made().crowns).toBeGreaterThanOrEqual(40);
  });
  test('every Druidic home has a land Creature province within two provinces, and every Evil home a Monster one', () => {
    expect(made().missing).toEqual([]);
  });
  test("no home's ring holds more than one wild province", () => {
    expect(made().capBroken).toEqual([]);
  });
  test('every home still borders a province of its own race', () => {
    expect(made().pairBroken).toEqual([]);
  });
}

describe('natural worlds, from KC_SEED', () => {
  let made: ReturnType<typeof worldsOf> | undefined;
  beforeAll(async () => {
    vi.resetModules();
    made = worldsOf(await theEngineIn(path.resolve(import.meta.dirname, '../../src')), SEED);
  }, A_LIMIT_FOR_THE_WORLDS);
  theGuarantees(() => {
    if (!made) throw new Error('the worlds were not made');
    return made;
  });
});

describe('no free neighbour beside a home (a planted copy of src/), on the worlds of seed 1', () => {
  let engine: TheEngine | undefined, made: ReturnType<typeof worldsOf> | undefined;
  let empty: ReturnType<typeof plantedSrc> | undefined;
  afterAll(() => {
    empty?.remove();
  });
  // the copy made and its modules imported: every file of src/ twice
  beforeAll(
    async () => {
      empty = plantedSrc({
        'engine/world/generate.ts': (code, file) =>
          replaceInitializer(code, file, 'generateNewGame', '_freeNbrs', '[]'),
      });
      engine = await theEngineIn(empty.dir);
    },
    timeLimitForTheWork({ everyFileReads: 2 }).timeout,
  );
  beforeAll(() => {
    if (!engine) throw new Error("the planted copy's engine was not imported");
    made = worldsOf(engine, 1);
  }, A_LIMIT_FOR_THE_WORLDS);
  theGuarantees(() => {
    if (!made) throw new Error('the worlds were not made');
    return made;
  });
});
