// 2026-10-08 (item 1; R-076): a fallen king's body is borne home at death and then stays there, even when the home
// province is captured later. The map, the Resurrect list, the older list of bodies and the bots' raise planner all
// name that one province. (Before: the map showed the home, while the Resurrect list and the engine looked in the
// realm's wealthiest remaining province, so the body could never be raised.)
//
// Level 1 (unit): buildTurnReport (src/views/turn-report.ts) called on what realm 0 may see (playerView), and the bots'
// raise planner (botRaiseTargets, src/engine/bots/strategy.ts), on a world the engine makes on its modules
// (tests/lib/a-staged-turn-on-the-engines-modules.ts) from KC_SEED, the fall and the capture staged by the test. Not
// lower: where each names the body is computed from the world.
//
// Until plan P1-14g this was tests/monarch-grave.test.js, which called the same functions on the booted GM page. Its
// checks are kept, two of them stricter: the map's record of the body and the older list's were checked only if
// present, so a report that dropped the body passed; both must now hold it, in the home. "page errors 0" is "throws
// nothing": a console.error fails the test (tests/setup/each.ts).
import { expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface Province {
  id: number;
  terrain: string;
  owner: number | null;
  tax?: number;
  [key: string]: unknown;
}
interface Realm {
  provinces: number[];
  [key: string]: unknown;
}
interface World {
  turn: number;
  players: Realm[];
  characters: {
    id: number;
    name: string;
    player: number | null;
    isKing?: boolean;
    alive: boolean;
    location: number;
    skills?: object;
  }[];
  heroGraveyard?: ({ location: number } & Record<string, unknown>)[];
  world: { provinces: Province[] };
}
interface ABody {
  id: number;
  locationId?: number;
  raisable?: boolean;
}
interface Report {
  visibleDeadHeroes?: ABody[];
  knownDeadHeroes?: ABody[];
  deadHeroes?: ABody[];
}

test("a fallen king's body stays in his home after it is captured: the map, the Resurrect list and the bots agree", async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { playerView } = await import('../../src/views/what-each-realm-may-see-of-the-world.ts');
  const { buildTurnReport } = await import('../../src/views/turn-report.ts');
  const { homeProvinceIdFor } = await import('../../src/engine/grand-design.ts');
  const { botRaiseTargets } = await import('../../src/engine/bots/strategy.ts');
  const { S } = sc.world({ realms: 3, cols: 12, rows: 7, seaPct: 30 });
  const G = S as unknown as World;
  // Realm 0's king fell at home; realm 0 still holds a second, RICHER province; realm 1 then took the home.
  const home = homeProvinceIdFor(S as never, 0);
  const king = G.characters.find((c) => c.player === 0 && c.isKing);
  const other = G.world.provinces.find((p) => p.owner == null && p.terrain !== 'sea' && p.id !== home);
  const [realm0, realm1] = G.players;
  if (home == null || !king || !other || !realm0 || !realm1)
    throw new Error('could not stage: a home, a king and a spare province');
  other.owner = 0;
  other.tax = 99;
  realm0.provinces = [home, other.id];
  king.alive = false;
  king.location = home;
  G.heroGraveyard = [
    {
      id: king.id,
      name: king.name,
      player: 0,
      isKing: true,
      _monarch: true,
      killedOnTurn: G.turn,
      location: home,
      skills: { ...(king.skills ?? {}) },
    },
  ];
  realm0['_resurrectableMonarchId'] = king.id;
  realm0['knownDeadHeroIds'] = [king.id];
  // ...and later the same turn the enemy captures the home.
  const homeProvince = G.world.provinces[home];
  if (!homeProvince) throw new Error('could not stage: the home province');
  homeProvince.owner = 1;
  realm0.provinces = [other.id];
  realm1.provinces = [...realm1.provinces, home];

  const rep = buildTurnReport(playerView(S as never, 0)) as Report;
  const listed = (rep.knownDeadHeroes ?? []).find((g) => g.id === king.id);
  expect(listed, 'the fallen king is on the Resurrect list').toBeDefined();
  expect(listed?.locationId, 'the Resurrect list puts the body in the captured home').toBe(home);
  expect(listed?.raisable, 'and it is still raisable by its own realm').toBe(true);
  // stricter: the old script passed when the older list or the map left the body out
  expect((rep.deadHeroes ?? []).find((g) => g.id === king.id)?.locationId, 'the older deadHeroes list agrees').toBe(
    home,
  );
  expect(
    (rep.visibleDeadHeroes ?? []).find((g) => g.id === king.id)?.locationId,
    'the map shows the body in the same place',
  ).toBe(home);
  const bot = (botRaiseTargets(S as never, 0) as { g: { id: number }; loc: number }[]).find((t) => t.g.id === king.id);
  expect(bot?.loc, 'a bot realm would march to the captured home to raise him').toBe(home);
  expect(G.heroGraveyard[0]?.location, 'nothing above moved the stored body').toBe(home);
});
