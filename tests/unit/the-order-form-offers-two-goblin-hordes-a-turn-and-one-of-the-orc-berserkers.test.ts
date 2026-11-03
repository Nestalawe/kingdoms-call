// 2026-10-11 (Toby, the army roster, decision 9; R-096): Goblin Hordes come two a turn wherever a province offers them,
// as garrison companies do, while every other land unit outside the founder's own capital stays at one. The figure the
// player portal's order form shows for each kind (maxPerTurn) comes from buildTurnReport, the views' builder of a
// realm's turn data: two Goblin Hordes, one company of Orc Berserkers, two of the Orc Garrison, in an Orcish province
// of realm 0's that is not its founder's home. The engine's own gate (getRecruitLimit, in a turn) is a case of
// lib/recruit-hire-and-realm-works-order-cases.ts ("Goblin Hordes come two a turn …"): src/engine/world/tables.ts
// gives both one list.
//
// Level 1 (unit): buildTurnReport called on what realm 0 may see (playerView) of a world made by the engine on the
// engine's modules (tests/lib/a-staged-turn-on-the-engines-modules.ts) from KC_SEED, the province chosen by its place
// alone and made plain. Not lower: the figure is computed from the province and the realm.
//
// Until plan P1-14f this was part of tests/goblins-two-a-turn.test.js, which read the figure on the GM page after a
// turn. Its three checks are kept as they were.
import { expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface Province {
  id: number;
  terrain: string;
  owner: number | null;
  [key: string]: unknown;
}
interface World {
  players: { provinces: number[]; homeProvinceId?: number }[];
  characters: { player: number | null; location: number }[];
  world: { provinces: Province[] };
}
interface TheOrderFormsData {
  provinceOrderData: Record<number, { armyTypes?: { type: string; maxPerTurn: number }[] } | undefined>;
}

test('the order form offers two Goblin Hordes a turn there, one Orc Berserkers company, and two garrison units', async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { playerView } = await import('../../src/views/what-each-realm-may-see-of-the-world.ts');
  const { buildTurnReport } = await import('../../src/views/turn-report.ts');
  const { homeProvinceIdFor } = await import('../../src/engine/grand-design.ts');
  const { S } = sc.world({ cols: 10, rows: 6, seaPct: 10 });
  const G = S as unknown as World;
  const home = homeProvinceIdFor(S as never, 0);
  // a land province nobody holds, made realm 0's, its guard gone: Orcish, raising the three kinds
  const A = G.world.provinces.find((p) => p.terrain !== 'sea' && p.id !== home && p.owner == null);
  if (!A) throw new Error('could not stage: no free land province');
  G.characters = G.characters.filter((c) => c.player != null || c.location !== A.id);
  Object.assign(A, {
    owner: 0,
    race: 'Orcish',
    armyTypes: ['Goblin Horde', 'Orc Berserkers', 'Orc Garrison'],
    neutralDefenders: [],
    npcArmies: 0,
    features: [],
    garrisonArmies: [],
  });
  G.players[0]?.provinces.push(A.id);
  const od = (buildTurnReport(playerView(S as never, 0)) as TheOrderFormsData).provinceOrderData[A.id];
  const maxOf = (t: string) => od?.armyTypes?.find((x) => x.type === t)?.maxPerTurn ?? null;
  expect(maxOf('Goblin Horde'), 'the order form offers two Goblin Hordes a turn there').toBe(2);
  expect(maxOf('Orc Berserkers'), '…one Orc Berserkers company').toBe(1);
  expect(maxOf('Orc Garrison'), '…and two garrison units, as before').toBe(2);
});
