// R-174: a fleet ordered to a far coast lands as it would next door. An admiral who leads ships alone (two Galleon
// Fleets, no foot) is ordered from one sea to a coast two seas away. In Spring he sails to the sea beside the coast;
// in Early Summer, the coast next door, he lands. Before R-174 the road to a far province asked the ground the column
// could stand on, and ships alone may stand on no land, so the turn found no route and he stayed put all turn.
//
// The scene, staged on every world: L, a province of realm 0's, made plain; T, a neighbour of L's, made sea; F, a
// neighbour of T's that is neither L nor beside it, made sea; every other neighbour of F's made plain, so T is his only
// way. F, T and L are emptied of every other character, their guards and features cleared. The admiral, a hero of
// realm 0's, stands at sea in F; every other character Rests. No die decides the voyage: a Move order spends a point
// and steps, and nothing at sea or on L (his own ground, unguarded) stops him.
//
// Level 2 (scenario): the far march's road is asked inside the Move order of each phase, with the column's pools and
// the turn's map; played on the engine's modules (tests/lib/a-staged-turn-on-the-engines-modules.ts) on a world made
// from KC_SEED. The road's rule itself (the landing on the target, on made-up maps) is the unit case in
// tests/unit/the-first-step-of-a-shortest-route-a-column-may-take.test.ts; this one shows the turn lands him.
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
  players: { provinces: number[] }[];
  characters: Character[];
  world: { cols: number; rows: number; provinces: Province[] };
}
interface Scene {
  F: Province;
  T: Province;
  L: Province;
  A: Character;
}

const army = (type: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({ type, quality: 'Regular', unitName: `${type} ${String(i + 1)}` }));

test('an admiral leading ships alone, ordered to a coast two seas away, sails beside it and lands', async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  const r = sc.turn<World, Scene>({
    cols: 10,
    rows: 6,
    seaPct: 35,
    prepare(S) {
      const nb = (p: Province) =>
        (getNeighborsP(p, S.world.cols, S.world.rows, S.world.provinces) as (Province | null)[]).filter(
          (q): q is Province => q != null,
        );
      const A = S.characters.find((c) => c.alive && c.player === 0 && !c.isKing);
      if (!A) throw new Error('could not stage: no hero of realm 0');
      let pick: Omit<Scene, 'A'> | null = null;
      for (const L of S.world.provinces.filter((p) => p.owner === 0)) {
        for (const T of nb(L)) {
          const F = nb(T).find((m) => m.id !== L.id && !nb(L).some((x) => x.id === m.id));
          if (F) {
            pick = { F, T, L };
            break;
          }
        }
        if (pick) break;
      }
      if (!pick) throw new Error('could not stage: no province of realm 0 with a hex two steps off');
      const { F, T, L } = pick;
      const ids = [F.id, T.id, L.id];
      S.characters = S.characters.filter((c) => c.id === A.id || !ids.includes(c.location));
      const clear = (p: Province, terrain: string, owner: number | null) => {
        S.players.forEach((pl) => {
          pl.provinces = pl.provinces.filter((id) => id !== p.id);
        });
        p.owner = owner;
        if (owner != null) S.players[owner]?.provinces.push(p.id);
        p.characters = (p.characters ?? []).filter((id) => S.characters.some((c) => c.id === id));
        Object.assign(p, { terrain, neutralDefenders: [], npcArmies: 0, features: [], garrisonArmies: [] });
      };
      clear(L, 'plain', 0);
      clear(T, 'sea', null);
      clear(F, 'sea', null);
      // T is his only way: every other neighbour of F's is land, where ships alone may not go.
      nb(F)
        .filter((p) => p.id !== T.id)
        .forEach((p) => {
          p.terrain = 'plain';
        });
      S.world.provinces.forEach((q) => {
        q.characters = (q.characters ?? []).filter((id) => id !== A.id);
      });
      F.characters = [...(F.characters ?? []), A.id];
      A.location = F.id;
      A.locationName = F.name;
      A.armies = army('Galleon Fleet', 2);
      return { F, T, L, A };
    },
    orders: (_S, s) => ({ [s.A.id]: plan(order('move', s.L.id), order('move', s.L.id)) }),
  });
  const { T, L, A } = r.extra;
  const a2 = (r.S2['characters'] as Character[]).find((c) => c.id === A.id);
  expect(
    r.log.filter((e) => e.charId === A.id && e.phase === 0).map((e) => e.text),
    `in Spring he sails toward ${L.name} by ${T.name}`,
  ).toEqual(expect.arrayContaining([expect.stringContaining(T.name)]));
  expect(
    r.log.some((e) => e.charId === A.id && e.phase === 1 && (e.text ?? '').includes('coastal landing')),
    `in Early Summer he lands on ${L.name}`,
  ).toBe(true);
  expect(a2?.location, `he ends the turn on ${L.name}, his fleets with him`).toBe(L.id);
  expect(a2?.armies?.map((u) => u.type)).toEqual(['Galleon Fleet', 'Galleon Fleet']);
});
