// A beaten defender with ships sails what its hulls can carry, and the companies they can't carry fall back overland to
// a garrison of the realm's (navalSplitRetreat). Besides the companies the defender led, the province's own garrison and
// any leaderless host there rally into the battle's pooled copy of his column (the Move order's `_garrisonHere` and
// `_leaderlessHosts`). The caller kept those in its own lists and put them back after the battle: into the battle
// province's garrison, or, when the defender's fleet had sailed, into the garrison of the sea he sailed to. So a
// garrison or leaderless company the fleet sent overland was in two garrisons at once (Theo's review of #554). Now the
// split hands the companies it sent overland back to its caller, which takes them off those lists, as it already takes
// off the ships left ashore.
// The scene: C, a coastal province of realm 0's beside a sea province of its own (friendly water) and a land province
// of its own, L (the shore to fall back to); E, beside C, realm 1's (at war). In C: realm 0's hero leading one Galleon
// Fleet and two Gilded Lances, C's garrison of one Shieldwall Levies (Green), and a fallen hero's leaderless host of one
// Shieldwall Levies (Green), the weakest, so the first the hull can't carry. Realm 1's king marches from E on C in
// Spring with twelve Elite Gilded Lances. Every company's fate roll is made to spare it (a stand-in hands the real roll
// dice that never fall under a threshold), so the outcome is the rule's, not the dice's.
// Level 2 (scenario): the garrison and the leaderless host rally inside the Move order, and the caller puts them back
// after the battle, so only a played turn holds all of it; on the engine's modules (tests/lib/a-staged-turn-on-the-
// engines-modules.ts). The split retreat's own part is tests/unit/a-beaten-fleets-companies-sent-overland-leave-every-
// heros-column.test.ts.
import { expect, test, vi } from 'vitest';
import { aStagedTurnOnTheEnginesModules, order, plan } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface Unit {
  type: string;
  quality: string;
  unitName: string;
}
interface Province {
  id: number;
  row: number;
  col: number;
  name: string;
  terrain: string;
  owner: number | null;
  characters?: number[];
  garrisonArmies?: Unit[];
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
  armies?: Unit[];
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
  K: Character;
}

const company = (type: string, quality: string, name: string): Unit => ({ type, quality, unitName: name });

test("a garrison or leaderless company a beaten fleet sends overland is in the shore's garrison alone", async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  const fates = await import('../../src/engine/battle/fates.ts');
  const realRoll = fates.rollUnitFates;
  const spared = vi
    .spyOn(fates, 'rollUnitFates')
    .mockImplementation((force, o) => realRoll(force, { ...o, rng: () => 0.999 }));
  const r = sc.turn<World, Scene>({
    cols: 10,
    rows: 6,
    seaPct: 35,
    prepare(S) {
      S.relations = { ...(S.relations ?? {}), '0-1': 'enemy' };
      const nb = (p: Province) =>
        (getNeighborsP(p, S.world.cols, S.world.rows, S.world.provinces) as (Province | null)[]).filter(
          (q): q is Province => q != null && q.id !== p.id,
        );
      const land = (p: Province) => p.terrain !== 'sea';
      let pick: { C: Province; W: Province; L: Province; E: Province } | null = null;
      for (const C of S.world.provinces.filter((p) => land(p))) {
        const W = nb(C).find((n) => !land(n));
        const lands = nb(C).filter(land);
        const L = lands[0];
        const E = lands[1];
        if (W && L && E) {
          pick = { C, W, L, E };
          break;
        }
      }
      if (!pick) throw new Error('could not stage: no coastal province with two land neighbours');
      const { C, W, L, E } = pick;
      const near = new Set([C, W, L, E, ...nb(C), ...nb(L), ...nb(E)].map((p) => p.id));
      S.characters = S.characters.filter((c) => !(c.alive !== false && near.has(c.location) && c.player == null));
      const own = (p: Province, pi: number) => {
        S.players.forEach((pl) => {
          pl.provinces = pl.provinces.filter((id) => id !== p.id);
        });
        p.owner = pi;
        S.players[pi]?.provinces.push(p.id);
        Object.assign(p, { neutralDefenders: [], npcArmies: 0, features: [], garrisonArmies: [], characters: [] });
        if (land(p)) p.terrain = 'plain';
      };
      own(C, 0);
      own(W, 0);
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
      const mine = S.characters.filter((c) => c.alive && c.player === 0 && !c.isKing);
      const D = mine[0];
      const fallen = mine[1];
      const K = S.characters.find((c) => c.alive && c.player === 1 && c.isKing);
      if (!D || !fallen || !K) throw new Error('could not stage: two heroes of realm 0 and a king of realm 1');
      // everyone else of the two realms is taken well away from the scene
      S.characters
        .filter((c) => c.player != null && ![D.id, fallen.id, K.id].includes(c.id) && near.has(c.location))
        .forEach((c) => {
          const away = S.world.provinces.find((p) => land(p) && !near.has(p.id));
          if (away) place(c, away);
        });
      place(D, C);
      D.armies = [
        company('Galleon Fleet', 'Regular', 'the Grey Hull'),
        company('Gilded Lances', 'Regular', 'the First Lances'),
        company('Gilded Lances', 'Regular', 'the Second Lances'),
      ];
      C.garrisonArmies = [company('Shieldwall Levies', 'Green', 'the Gate Levies')];
      place(fallen, C);
      Object.assign(fallen, {
        alive: false,
        _leaderlessHost: true,
        armies: [company('Shieldwall Levies', 'Green', 'the Orphaned Levies')],
      });
      place(K, E);
      K.armies = Array.from({ length: 12 }, (_, i) =>
        company('Gilded Lances', 'Elite', `Crown Lances ${String(i + 1)}`),
      );
      return { C, L, K };
    },
    orders: (_S, s) => ({ [s.K.id]: plan(order('move', s.C.id)) }),
  });
  spared.mockRestore();
  const S2 = r.S2 as unknown as World;
  const text = r.log.map((l) => l.text ?? '').join('\n');
  expect(text, 'the defender lost, his fleet sailed and companies fell back overland').toMatch(
    /cannot be carried and fall back overland/,
  );
  const places = (name: string) => [
    ...S2.characters.filter((c) => (c.armies ?? []).some((a) => a.unitName === name)).map((c) => `led by ${c.name}`),
    ...S2.world.provinces
      .filter((p) => (p.garrisonArmies ?? []).some((a) => a.unitName === name))
      .map((p) => `garrison of ${p.name}`),
  ];
  const shore = `garrison of ${r.extra.L.name}`;
  expect(places('the Gate Levies'), "the garrison's company is in the shore's garrison alone").toEqual([shore]);
  expect(places('the Orphaned Levies'), "the leaderless host's company is in the shore's garrison alone").toEqual([
    shore,
  ]);
});
