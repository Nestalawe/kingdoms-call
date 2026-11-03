// 2026-10-12 (Toby's batch, item 22): Evil's Call from the Pit and the Druids' Awaken the Wild are removed: they made
// Creatures and Monsters too easy to come by. A save from before the change may still hold either order, so a turn is
// played with both: an Evil king (Druid 3) in a wild province of his own, beside his capital, gives Call from the Pit
// for Cave Trolls, and a Druidic king (Druid 3) in a forest of his own, beside his, gives Awaken the Wild for Forest
// Ents, each with 60 gold. Nothing rises, nothing is paid, no summoning line is written, and each realm's report reads
// that the order is no more. The words (no page or table still offers them) are
// static/no-page-or-table-still-offers-awaken-the-wild-or-call-from-the-pit.test.ts; the refusal called directly is a
// case of lib/recruit-hire-and-realm-works-order-cases.ts.
//
// Level 2 (scenario): the realm's report is built from the whole turn (the views' buildReports), so only a turn
// shows what each realm reads; played on the engine's modules (tests/lib/a-staged-turn-on-the-engines-modules.ts) on a
// world made from KC_SEED. Each province is a land neighbour of its king's capital, made his and plain (its guard,
// its lairs and its garrison gone), so the scene is set on every world.
//
// Until plan P1-14f this was tests/beast-calls-gone.test.js, a turn on the GM page (lib/scenario.js). Its seven checks
// of the turn are kept as they were, and "the turn runs" is "throws nothing" (an unexpected console.error fails the
// test: setup/each.ts).
import { expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules, order, plan } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface Province {
  id: number;
  row: number;
  col: number;
  terrain: string;
  owner: number | null;
  characters?: number[];
  [key: string]: unknown;
}
interface Character {
  id: number;
  player: number | null;
  alive?: boolean;
  isKing?: boolean;
  location: number;
  skills?: Record<string, number>;
  armies?: { type: string }[];
  [key: string]: unknown;
}
interface World {
  players: { provinces: number[]; homeProvinceId: number; gold: number }[];
  characters: Character[];
  world: { cols: number; rows: number; provinces: Province[] };
}

test('the old orders raise nothing, pay nothing, and each realm reads that its order is no more', async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  const r = sc.turn<World, { ek: number; dk: number }>({
    realms: 2,
    alignments: ['Evil', 'Druidic'],
    prepare(S) {
      const king = (pi: number) => {
        const k = S.characters.find((c) => c.isKing && c.player === pi);
        if (!k) throw new Error('no king of realm ' + String(pi));
        return k;
      };
      const ek = king(0);
      const dk = king(1);
      const taken = new Set<number>();
      /** A land neighbour of realm `pi`'s capital no other realm's hero stands in, made the realm's and plain, with
       *  its king in it. */
      const stage = (pi: number, k: Character, edit: (p: Province) => void) => {
        const home = S.world.provinces[S.players[pi]?.homeProvinceId ?? -1];
        if (!home) throw new Error('no capital for realm ' + String(pi));
        const p = (getNeighborsP(home, S.world.cols, S.world.rows, S.world.provinces) as (Province | null)[]).find(
          (q): q is Province =>
            q != null &&
            q.terrain !== 'sea' &&
            !taken.has(q.id) &&
            !S.characters.some((c) => c.alive && c.player != null && c.player !== pi && c.location === q.id),
        );
        if (!p) throw new Error('could not stage: no land beside the capital of realm ' + String(pi));
        taken.add(p.id);
        S.characters = S.characters.filter((c) => c.player != null || c.location !== p.id);
        S.players.forEach((pl) => {
          pl.provinces = pl.provinces.filter((id) => id !== p.id);
        });
        S.players[pi]?.provinces.push(p.id);
        Object.assign(p, { owner: pi, neutralDefenders: [], npcArmies: 0, features: [], garrisonArmies: [] });
        edit(p);
        S.world.provinces.forEach((q) => {
          q.characters = (q.characters ?? []).filter((id) => id !== k.id);
        });
        p.characters = [...(p.characters ?? []).filter((id) => S.characters.some((c) => c.id === id)), k.id];
        k.location = p.id;
        k.skills = { ...k.skills, druid: 3 };
        const realm = S.players[pi];
        if (realm) realm.gold = 60;
      };
      stage(0, ek, (p) => {
        Object.assign(p, { race: 'Primal:Cave Troll', armyTypes: ['Cave Trolls'] });
      });
      stage(1, dk, (p) => {
        p.terrain = 'forest';
      });
      return { ek: ek.id, dk: dk.id };
    },
    orders: (_S, x) => ({
      [x.ek]: plan(order('call_pit', 'Cave Trolls')),
      [x.dk]: plan(order('awaken_wild', 'Forest Ents')),
    }),
  });
  const S2 = r.S2 as unknown as World;
  const after = (id: number) => S2.characters.find((c) => c.id === id);
  const t = r.text();
  expect(
    (after(r.extra.ek)?.armies ?? []).some((a) => a.type === 'Cave Trolls'),
    'no Cave Trolls crawl up from the pit',
  ).toBe(false);
  expect(
    (after(r.extra.dk)?.armies ?? []).some((a) => a.type === 'Forest Ents'),
    'no Forest Ents rise from the wood',
  ).toBe(false);
  expect(t, 'no summoning line in the log').not.toMatch(/💀 Call from the Pit —|🌿 Awaken the Wild —/);
  expect(t, 'no tribute or offering is paid').not.toMatch(/tribute;|offering;/);
  expect(JSON.stringify(r.reports[0] ?? []), 'the Evil realm reads that Call from the Pit is no more').toMatch(
    /Call from the Pit is no more/,
  );
  expect(JSON.stringify(r.reports[1] ?? []), 'the Druidic realm reads that Awaken the Wild is no more').toMatch(
    /Awaken the Wild is no more/,
  );
});
