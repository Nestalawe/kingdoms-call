// 2026-10-08 (item 12): the price of hiring a wandering hero is the price the hire really charges. A hero who has grown
// while wandering asks a premium for skill on top of the alignment rate: the report's hero sightings quote it, and the
// hire data the order form reads (provinceOrderData's availableHeroes, hireWage) carries the same figure. That the
// player portal's Hire Hero dropdown, Broker list and order ledger quote it too is
// page/the-player-portals-hire-dropdown-broker-list-and-ledger-quote-the-reports-hire-price.test.ts.
//
// Level 1 (unit): buildTurnReport (src/views/turn-report.ts) called on what realm 0 may see (playerView) of a world the
// engine makes on its modules (tests/lib/a-staged-turn-on-the-engines-modules.ts) from KC_SEED, with a seasoned
// wanderer of the realm's own alignment staged by the test in its capital, beside its king. Not lower: the price is
// computed from the hero and the realm.
//
// Until plan P1-14g this was the report's part of tests/hire-price.test.js, which read the report one real turn on the
// booted GM page wrote. Its checks are kept as they were.
import { expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface World {
  players: { alignment: string }[];
  characters: {
    id: number;
    player: number | null;
    alive: boolean;
    isKing?: boolean;
    location: number;
    [key: string]: unknown;
  }[];
  world: { provinces: { id: number; name: string; characters?: number[] }[] };
}
interface Report {
  heroSightings?: { name: string; pay?: number }[];
  provinceOrderData?: Record<string, { availableHeroes?: { id: number; hireWage?: number }[] }>;
}

test("a seasoned wanderer's price in the report is the alignment rate and his skill's premium, in the hire data too", async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { playerView } = await import('../../src/views/what-each-realm-may-see-of-the-world.ts');
  const { buildTurnReport } = await import('../../src/views/turn-report.ts');
  const { S } = sc.world({ realms: 2 });
  const G = S as unknown as World;
  const king = G.characters.find((c) => c.alive && c.player === 0 && c.isKing);
  const home = king && G.world.provinces[king.location];
  if (!king || !home) throw new Error('could not stage: a king in a province');
  // A seasoned wanderer of the realm's own alignment, standing in the capital: alignment rate 2g, and 15 skill levels
  // → a 3g premium.
  const id = Math.max(...G.characters.map((c) => c.id)) + 1;
  G.characters.push({
    id,
    name: 'Wenna the Seasoned (wandering)',
    player: null,
    alive: true,
    race: 'Human',
    alignment: G.players[0]?.alignment,
    temper: 'Brave',
    hp: 20,
    maxHp: 20,
    skills: { melee: 6, tactical: 5, march: 4 },
    items: [],
    armies: [],
    location: home.id,
    locationName: home.name,
    pay: 1,
  });
  home.characters = [...(home.characters ?? []), id];
  const rep = buildTurnReport(playerView(S as never, 0)) as Report;
  const seen = (rep.heroSightings ?? []).find((s) => s.name.includes('Wenna'));
  const avail = Object.values(rep.provinceOrderData ?? {})
    .flatMap((pd) => pd.availableHeroes ?? [])
    .find((h) => h.id === id);
  expect(seen, 'the wanderer is in the report').toBeDefined();
  expect(avail, '…and offered for hire').toBeDefined();
  expect(seen?.pay, 'the report quotes the full price: 2g alignment rate + 3g for skill = 5g').toBe(5);
  expect(avail?.hireWage, 'the hire data carries the same price').toBe(seen?.pay);
});
