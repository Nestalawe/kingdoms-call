// 2026-10-12 (Toby's batch, item 23; R-102): an Evil realm sees how much Terror grips each province, on its map and
// under each province of its turn report. What its turn data says (buildTurnReport, src/views/turn-report.ts, on what
// the realm may see: playerView): every province of the map that Terror grips carries {pct, stacks, byYou}; its own
// provinces in the report's list carry it too; a province it has visited but does not hold gets an intel line; a
// province with no Terror carries none; and another crown's report carries no Terror at all. The figure is the stacks
// (at most three) times the stack's share: −10% a stack, or more where Reign of Terror set it. The portal's note is
// page/the-player-portals-terror-note-reads-the-terror-and-its-stacks.test.ts, and where the portal writes it
// static/the-player-portals-map-popup-and-provinces-list-write-the-terror-note.test.ts.
//
// Level 1 (unit): buildTurnReport called on what each realm may see of a world the engine makes on its modules
// (tests/lib/a-staged-turn-on-the-engines-modules.ts) from KC_SEED, an Evil realm and a Good one, the Terror stamped on
// three provinces by the test. Not lower: the readings are computed from the world.
//
// Until plan P1-14g this was the report's part of tests/terror-visible.test.js, which called buildTurnReport on the
// booted GM page. Its checks are kept as they were; "buildTurnReport is declared at module level" is the import.
import { expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface Province {
  id: number;
  row: number;
  col: number;
  name: string;
  terrain: string;
  owner: number | null;
  visitedBy?: number[];
  [key: string]: unknown;
}
interface World {
  turn: number;
  players: { homeProvinceId: number }[];
  world: { cols: number; rows: number; provinces: Province[] };
}
interface Terror {
  pct: number;
  stacks: number;
  byYou: boolean;
}
interface Report {
  worldMeta?: { provinces?: ({ id: number; terror?: Terror } | null)[] };
  ownedProvinces?: { id: number; terror?: Terror }[];
  intel?: unknown[];
}

test("an Evil realm's map, its provinces and its intel read the Terror; a Good realm's report carries none", async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { playerView } = await import('../../src/views/what-each-realm-may-see-of-the-world.ts');
  const { buildTurnReport } = await import('../../src/views/turn-report.ts');
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  const { S } = sc.world({ realms: 2, alignments: ['Evil', 'Good'] });
  const G = S as unknown as World;
  const P = G.world.provinces;
  const mine = P[G.players[0]?.homeProvinceId ?? -1];
  if (!mine) throw new Error('could not stage: no capital');
  const nbrs = getNeighborsP(mine, G.world.cols, G.world.rows, P).filter((p) => p.terrain !== 'sea' && p.owner == null);
  const [near, quiet] = nbrs;
  const far =
    P.find((p) => p.terrain !== 'sea' && p.owner != null && p.owner !== 0) ??
    P.find((p) => p.id !== mine.id && p.id !== near?.id && p.terrain !== 'sea');
  if (!near || !quiet || !far) throw new Error('could not stage: two free land neighbours and a province far away');
  // Two stacks of the Evil realm's own Terror next door (a province it has visited), five of it on its own home (a
  // save may hold more than three), and one stack at Reign of Terror's −25% far away.
  const stamp = (p: Province, n: number, by: number, pct?: number) => {
    p['_terrorStacks'] = n;
    p['_terrorTurn'] = G.turn;
    p['_terrorisedBy'] = by;
    if (pct != null) p['_terrorPct'] = pct;
  };
  stamp(near, 2, 0);
  stamp(mine, 5, 0);
  stamp(far, 1, 0, 0.25);
  near.visitedBy = [...(near.visitedBy ?? []), 0];
  const rep = buildTurnReport(playerView(S as never, 0)) as Report;
  const good = buildTurnReport(playerView(S as never, 1)) as Report;
  const wm = (id: number) => rep.worldMeta?.provinces?.find((r) => r?.id === id);
  expect(wm(near.id)?.terror, `the map's record of ${near.name} carries Terror 20%, 2 stacks`).toMatchObject({
    pct: 20,
    stacks: 2,
  });
  expect(wm(mine.id)?.terror, 'a save holding five stacks reads as three, 30%').toMatchObject({ pct: 30, stacks: 3 });
  expect(wm(far.id)?.terror?.pct, "one stack at Reign of Terror's share reads 25%").toBe(25);
  expect(wm(near.id)?.terror?.byYou, "…and says it is the realm's own Terror").toBe(true);
  expect(wm(quiet.id), 'a province with no Terror is on the map').toBeDefined();
  expect(wm(quiet.id)?.terror, '…and carries none').toBeUndefined();
  const own = (rep.ownedProvinces ?? []).find((p) => p.id === mine.id);
  expect(own?.terror?.pct, "the realm's own province in the report's list carries its Terror").toBe(30);
  expect(
    (rep.intel ?? []).some((l) => typeof l === 'string' && l.includes(near.name) && l.includes('Terror 20%')),
    `a visited province it does not hold gets an intel line (${(rep.intel ?? []).filter((l) => typeof l === 'string' && l.includes('Terror')).join(' | ')})`,
  ).toBe(true);
  const goodHas =
    (good.worldMeta?.provinces ?? []).some((r) => r?.terror) ||
    (good.ownedProvinces ?? []).some((p) => p.terror) ||
    (good.intel ?? []).some((l) => typeof l === 'string' && /Terror \d+%/.test(l));
  expect(goodHas, "a Good realm's report carries no Terror reading").toBe(false);
});
