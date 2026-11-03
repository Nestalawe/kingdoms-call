// 2026-10-08 (item 14): a general on Defend who leads ships never rides overland to a neighbour. From play: a hero on
// Defend in a coastal province, leading both naval and land units, marched to help defend an adjacent land province.
// A Move order refuses that (ships cannot cross land); the Defend ride-outs checked only the ground he would stand on.
// Two turns: (A) an enemy column marches into the neighbouring land province (the ride-out to a column crossing in);
// (B) an enemy column is already standing in it (the end-of-phase "host in the watch" pass). The scene, each province
// emptied of every other character: C, a coastal province of realm 0's, made plain; L, a land neighbour of C's, of
// realm 0's, made plain; E, beside L and neither C nor beside it, realm 1's (at war with realm 0), made plain. The
// admiral leads two Galleon Fleets and two Heavy Infantry; the enemy king two Light Infantry, from E (A) or in L (B).
// The rule they share, canStepBetween (a column that leads ships never steps from land to land), is called directly
// in tests/unit/a-column-that-leads-ships-never-steps-from-one-land-province-to-another.test.ts.
//
// Level 2 (scenario): the ride-outs run between the orders of a phase, and the second at its end, inside the turn;
// played on the engine's modules (tests/lib/a-staged-turn-on-the-engines-modules.ts) on a world made from KC_SEED. The
// scene is set by the staging on every world (the old script took the first coastal province with a land neighbour
// beside land, on whatever ground; none of the three held another realm's hero only by chance).
//
// Until plan P1-14e this was tests/defend-naval-overland.test.js, two turns on the GM page (lib/scenario.js). Its five
// checks are kept as they were, and "no page errors" is "throws nothing" (an unexpected console.error fails the test:
// setup/each.ts).
import { expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules, order, plan } from '../lib/a-staged-turn-on-the-engines-modules.ts';

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
  L: Province;
  E: Province;
  D: Character;
  K: Character;
}

const army = (type: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({ type, quality: 'Regular', unitName: `${type} ${String(i + 1)}` }));

/** One turn on the scene, the enemy king in E (`enemyIn` false) or already in L; the admiral Defends in Spring and
 *  Early Summer, and the king (from E) marches on L in Spring. */
async function aTurnOnTheCoast(enemyIn: boolean) {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  const r = sc.turn<World, Scene>({
    cols: 10,
    rows: 6,
    seaPct: 35,
    prepare(S) {
      S.relations = { ...(S.relations ?? {}), '0-1': 'enemy' };
      const nb = (p: Province) =>
        (getNeighborsP(p, S.world.cols, S.world.rows, S.world.provinces) as (Province | null)[]).filter(
          (q): q is Province => q != null,
        );
      const free = (p: Province) => !S.characters.some((c) => c.alive && c.player != null && c.location === p.id);
      const land = (p: Province) => p.terrain !== 'sea';
      let pick: Omit<Scene, 'D' | 'K'> | null = null;
      for (const C of S.world.provinces.filter((p) => land(p) && free(p) && nb(p).some((n) => !land(n)))) {
        for (const L of nb(C).filter((n) => land(n) && free(n))) {
          const E = nb(L).find((m) => m.id !== C.id && free(m) && !nb(C).some((x) => x.id === m.id));
          if (E) {
            pick = { C, L, E };
            break;
          }
        }
        if (pick) break;
      }
      if (!pick) throw new Error('could not stage: no coastal province with a land neighbour beside a third');
      const { C, L, E } = pick;
      const ids = [C.id, L.id, E.id];
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
      own(L, 0);
      own(E, 1);
      const place = (c: Character, p: Province) => {
        S.world.provinces.forEach((q) => {
          q.characters = (q.characters ?? []).filter((id) => id !== c.id);
        });
        p.characters = [...(p.characters ?? []), c.id];
        c.location = p.id;
        c.locationName = p.name;
      };
      const D = S.characters.find((c) => c.alive && c.player === 0 && !c.isKing);
      const K = S.characters.find((c) => c.alive && c.player === 1 && c.isKing);
      if (!D || !K) throw new Error('could not stage: no hero of realm 0, or no king of realm 1');
      place(D, C);
      D.armies = [...army('Galleon Fleet', 2), ...army('Heavy Infantry', 2)];
      place(K, enemyIn ? L : E);
      K.armies = army('Light Infantry', 2);
      return { C, L, E, D, K };
    },
    orders: (_S, c) => ({
      [c.D.id]: plan(order('defend'), order('defend')),
      ...(enemyIn ? {} : { [c.K.id]: plan(order('move', c.L.id)) }),
    }),
  });
  const { C, L, D, K } = r.extra;
  const d2 = (r.S2['characters'] as Character[]).find((c) => c.id === D.id);
  const L2 = (r.S2['world'] as World['world']).provinces[L.id];
  return { r, C, L, D, K, d2, L2 };
}

test('(A) an enemy column marches into the land province beside him: the admiral does not ride out overland', async () => {
  const { r, C, L, D, K, d2, L2 } = await aTurnOnTheCoast(false);
  expect(
    r.log.some(
      (e) => /moves into|moves to/.test(e.text ?? '') && e.text?.includes(K.name) && e.text.includes(L.name),
    ) || L2?.owner === 1,
    '(A) the enemy marched into the neighbouring land province (staging)',
  ).toBe(true);
  expect(
    r.log
      .filter((e) => e.charId === D.id && /break camp|march to meet|falls upon/.test(e.text ?? ''))
      .map((e) => e.text),
    `(A) the admiral does not ride out overland to ${L.name}`,
  ).toEqual([]);
  expect(d2?.location, `(A) the admiral is still in ${C.name} at the end of the turn`).toBe(C.id);
});

test('(B) an enemy column already stands in the land province beside him: the admiral does not ride out overland', async () => {
  const { r, C, L, D, d2 } = await aTurnOnTheCoast(true);
  expect(
    r.log
      .filter((e) => e.charId === D.id && /break camp|march to meet|falls upon/.test(e.text ?? ''))
      .map((e) => e.text),
    `(B) the admiral does not ride out overland to ${L.name}`,
  ).toEqual([]);
  expect(d2?.location, `(B) the admiral is still in ${C.name} at the end of the turn`).toBe(C.id);
});
