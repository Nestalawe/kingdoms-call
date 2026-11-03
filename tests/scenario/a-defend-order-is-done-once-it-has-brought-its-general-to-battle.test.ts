// 2026-10-08 (item 15): a Defend order is done once it has brought its general to battle. A general on Defend (Spring
// only; Rest after) rides out and wins in Spring. In Early Summer a second enemy column marches into another province
// beside him: he must not ride out again, because no Defend order was given for any season after his battle. And the
// Spring Defend order, which resolves after the Spring battle, must not set the watch again. A second turn checks that
// a Defend order given for a later season does set a new watch.
//
// The scene, five provinces of open plain, each emptied of every other character, its lairs and its garrison: C, the
// general's start (realm 0's); L1 beside it, where the first enemy column comes (realm 0's); L2, beside L1 (where the
// general stands after riding out) and not C, where the second comes (realm 0's); E1 beside L1 and neither C nor L2,
// and E2 beside L2 and neither L1 nor C, the enemy columns' starts (realm 1's, at war with realm 0). The general leads
// six Elite Heavy Infantry; each enemy column one Green company of Shieldwall Levies.
//
// Level 2 (scenario): the watch is set by one season's order, met in battle in that season, and read again in the
// next, so only the turn's order of seasons shows it; played on the engine's modules
// (tests/lib/a-staged-turn-on-the-engines-modules.ts) on a world made from KC_SEED. The scene is found by the map's
// shape alone and its ground made plain, so it is set on every world (the old script searched for five free land
// provinces of that shape, and stopped on a world with none).
//
// Until plan P1-14e this was tests/defend-once.test.js, two turns on the GM page (lib/scenario.js). Its five checks
// are kept as they were, and "no page errors" is "throws nothing" (an unexpected console.error fails the test:
// setup/each.ts). R-085 (blank seasons count as Defend) is not this test's: every season here has an order.
import { expect, test } from 'vitest';
import {
  aStagedTurnOnTheEnginesModules,
  order,
  plan,
  type Line,
  type Order,
} from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface Province {
  id: number;
  row: number;
  col: number;
  name: string;
  terrain: string;
  owner: number | null;
  characters?: number[];
  [key: string]: unknown;
}
interface Character {
  id: number;
  name: string;
  player: number | null;
  alive?: boolean;
  isKing?: boolean;
  location: number;
  locationName?: string;
  armies?: { type: string; quality: string; unitName: string }[];
  [key: string]: unknown;
}
interface World {
  relations?: Record<string, string>;
  players: { provinces: number[] }[];
  characters: Character[];
  world: { cols: number; rows: number; provinces: Province[] };
}
interface Scene {
  C: Province;
  L1: Province;
  L2: Province;
  E1: Province;
  E2: Province;
  D: Character;
  K1: Character;
  K2: Character;
}

const army = (type: string, n: number, quality: string) =>
  Array.from({ length: n }, (_, i) => ({ type, quality, unitName: `${type} ${String(i + 1)}` }));

/** Plays one turn on the staged scene: the general's five orders given, the first column marching in Spring, the second
 *  in Early Summer. */
async function aTurnOnTheScene(generalsOrders: Order[]) {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  const r = sc.turn<World, Scene>({
    cols: 10,
    rows: 7,
    seaPct: 10,
    prepare(S) {
      S.relations = { ...(S.relations ?? {}), '0-1': 'enemy' };
      const nb = (p: Province) =>
        (getNeighborsP(p, S.world.cols, S.world.rows, S.world.provinces) as (Province | null)[]).filter(
          (q): q is Province => q != null,
        );
      const touches = (p: Province, q: Province) => nb(p).some((x) => x.id === q.id);
      // none of the five may hold another realm's hero: one left standing in a province handed to the enemy would be
      // on enemy ground and fight a war-front battle in Spring (2026-10-13: a world where that happened stripped the
      // second column of its troops before it marched)
      const free = (p: Province) => !S.characters.some((c) => c.alive && c.player != null && c.location === p.id);
      let pick: Omit<Scene, 'D' | 'K1' | 'K2'> | null = null;
      for (const L1 of S.world.provinces.filter(free)) {
        const n = nb(L1).filter(free);
        for (const C of n) {
          for (const L2 of n) {
            if (L2.id === C.id) continue;
            const E1 = n.find((x) => x.id !== C.id && x.id !== L2.id && !touches(C, x) && !touches(L2, x));
            const E2 = nb(L2)
              .filter(free)
              .find((x) => x.id !== L1.id && x.id !== C.id && x.id !== E1?.id && !touches(L1, x) && !touches(C, x));
            if (E1 && E2) {
              pick = { C, L1, L2, E1, E2 };
              break;
            }
          }
          if (pick) break;
        }
        if (pick) break;
      }
      if (!pick) throw new Error('could not stage: no five provinces of the shape');
      const { C, L1, L2, E1, E2 } = pick;
      const ids = [C, L1, L2, E1, E2].map((p) => p.id);
      S.characters = S.characters.filter((c) => c.player != null || !ids.includes(c.location));
      const own = (p: Province, pi: number) => {
        S.players.forEach((pl) => {
          pl.provinces = pl.provinces.filter((id) => id !== p.id);
        });
        p.owner = pi;
        S.players[pi]?.provinces.push(p.id);
        p.characters = (p.characters ?? []).filter((id) => S.characters.some((c) => c.id === id));
        Object.assign(p, { terrain: 'plain', neutralDefenders: [], npcArmies: 0, features: [], garrisonArmies: [] });
      };
      own(C, 0);
      own(L1, 0);
      own(L2, 0);
      own(E1, 1);
      own(E2, 1);
      const place = (c: Character, p: Province) => {
        S.world.provinces.forEach((q) => {
          q.characters = (q.characters ?? []).filter((id) => id !== c.id);
        });
        p.characters = [...(p.characters ?? []), c.id];
        c.location = p.id;
        c.locationName = p.name;
      };
      const D = S.characters.find((c) => c.alive && c.player === 0 && !c.isKing);
      const K1 = S.characters.find((c) => c.alive && c.player === 1 && c.isKing);
      const K2 = S.characters.find((c) => c.alive && c.player === 1 && !c.isKing);
      if (!D || !K1 || !K2) throw new Error('could not stage: no hero of realm 0, or no king and hero of realm 1');
      place(D, C);
      D.armies = army('Heavy Infantry', 6, 'Elite');
      place(K1, E1);
      K1.armies = army('Shieldwall Levies', 1, 'Green');
      place(K2, E2);
      K2.armies = army('Shieldwall Levies', 1, 'Green');
      return { ...pick, D, K1, K2 };
    },
    orders: (_S, c) => ({
      [c.D.id]: generalsOrders,
      [c.K1.id]: plan(order('move', c.L1.id)),
      [c.K2.id]: plan(order('rest'), order('move', c.L2.id)),
    }),
  });
  /** The lines of `id` (his own, or naming him among others) in phase `ph`, in words. */
  const lines = (id: number, ph: number) =>
    r.log
      .filter((e: Line) => e.phase === ph && (e.charId === id || (e.charIds ?? []).includes(id)))
      .map((e) => e.text ?? '')
      .join('\n');
  const phaseText = (ph: number) =>
    r.log
      .filter((e) => e.phase === ph)
      .map((e) => e.text ?? '')
      .join('\n');
  return { ...r.extra, lines, phaseText };
}

test("a Defend order given for Spring alone is done once its general has fought: he doesn't ride out again in Early Summer", async () => {
  const { D, L1, L2, lines, phaseText } = await aTurnOnTheScene(
    plan(order('defend'), order('rest'), order('rest'), order('rest'), order('rest')),
  );
  const p0 = lines(D.id, 0);
  const p1 = lines(D.id, 1);
  expect(
    p0.includes('march to meet the threat') && phaseText(0).includes('Battle for '),
    `the general rides out to ${L1.name} and fights in Spring (staging)`,
  ).toBe(true);
  expect(p0, 'his report says the Defend order is fulfilled by the battle').toMatch(/Defend order is fulfilled/);
  expect(
    p0.split(/Defend order is fulfilled/)[1] ?? '',
    'the Spring Defend order does not set the watch again after the battle',
  ).not.toMatch(/makes camp .* sets a watch|keeps the watch/);
  expect(p1, `in Early Summer he does not ride out again to ${L2.name}`).not.toMatch(
    /march to meet the threat|break camp/,
  );
});

test('a fresh Defend order for Early Summer sets a new watch: he rides out again', async () => {
  const { D, L2, lines } = await aTurnOnTheScene(
    plan(order('defend'), order('defend'), order('rest'), order('rest'), order('rest')),
  );
  expect(lines(D.id, 1), `with a fresh Defend order for Early Summer he rides out to ${L2.name}`).toMatch(
    /march to meet the threat|break camp/,
  );
});
