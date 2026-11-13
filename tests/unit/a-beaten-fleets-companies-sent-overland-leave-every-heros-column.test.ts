// A beaten force with ships sails what its hulls can carry, and the companies they can't carry fall back overland to a
// garrison of the realm's (navalSplitRetreat, src/engine/units/sea-lift-stranding-and-retreats.ts). A battle fights on a
// pooled COPY of the beaten side's column (the defender and the heroes who stood beside him), and the split took the
// companies it sent overland off the copy only: the real heroes still led the very same companies. In one balance game
// a company so sent was in a garrison and in a hero's column at once; it died with the garrison in the next phase, and
// the hero's ships later put the same, dead, record ashore in another garrison, which the save's check refused. Now a
// company the split garrisons overland leaves every hero's column, as the ships it leaves ashore already do; a company
// that rallied into the battle from a garrison or a leaderless host loses the marks it carried there; and the split hands
// the companies it sent overland back to its caller (the turn's _companiesSentOverland), which takes them off the
// garrison and the leaderless hosts it keeps in lists of its own (that part: tests/scenario/a-beaten-fleets-left-over-
// garrison-and-leaderless-companies-are-in-one-place.test.ts).
// Level 1 (unit): navalSplitRetreat called directly on the engine's modules, on a world the engine makes (no turn is
// played). Not lower: the split reads the map around the beaten side. The copy is made as the battle makes it.
import '../lib/the-whole-engine.ts';
import { expect, test, vi } from 'vitest';
import { KC_SEASONS } from '../../src/content/kingdoms-call-data.ts';
import { kcRng } from '../../src/engine/rng.ts';
import { generateBotSetups, isBotRow } from '../../src/engine/bots/setup.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { getNeighborsP } from '../../src/engine/world/map-helpers.ts';
import { createTurnContext } from '../../src/engine/turn/context.ts';
import { navalSplitRetreat } from '../../src/engine/units/sea-lift-stranding-and-retreats.ts';
import { addTheFieldsResolveTurnAdds } from '../lib/the-fields-resolve-turn-adds-to-the-turns-context.ts';

interface Army {
  type: string;
  quality: string;
  race: string;
  unitName: string;
  [key: string]: unknown;
}
interface Character {
  id: number;
  name: string;
  player: number | null;
  isKing: boolean;
  alive: boolean;
  armies: Army[];
  location: number;
  locationName: string;
  [key: string]: unknown;
}
interface Province {
  id: number;
  name: string;
  row: number;
  col: number;
  terrain: string;
  owner: number | null;
  garrisonArmies: Army[];
  characters: number[];
  [key: string]: unknown;
}
interface World {
  world: { cols: number; rows: number; provinces: Province[] };
  characters: Character[];
  [key: string]: unknown;
}
const quietly = <T>(body: () => T): T => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    return body();
  } finally {
    log.mockRestore();
    warn.mockRestore();
  }
};
function must<T>(v: T | null | undefined, what: string): T {
  if (v == null) throw new Error('could not stage: no ' + what);
  return v;
}

test('a company the beaten fleet sends overland to a garrison is led by no hero any more', () => {
  kcRng.seed(Number(process.env['KC_SEED']) >>> 0 || 1);
  const setups = generateBotSetups([], 2, 0).map((b) => ({
    ...b,
    gamePlayerId: 'gp' + String(b.id),
    name: b.kingdomName,
  }));
  const made: unknown = JSON.parse(
    JSON.stringify(quietly(() => generateNewGame(setups, { cols: 12, rows: 7 }, 999, { seaPct: 45 }))),
  );
  const G = made as World;
  const ps = G.world.provinces;
  const near = (p: Province) =>
    (getNeighborsP(p, G.world.cols, G.world.rows, ps) as (Province | null)[]).filter(
      (q): q is Province => q != null && q.id !== p.id,
    );
  // a coastal land province with a sea and a land neighbour: the battle's ground, the water and the shore to fall to
  const site = must(
    ps.find(
      (p) =>
        p.terrain !== 'sea' && near(p).some((n) => n.terrain === 'sea') && near(p).some((n) => n.terrain !== 'sea'),
    ),
    'coastal province',
  );
  const sea = must(
    near(site).find((n) => n.terrain === 'sea'),
    'sea neighbour',
  );
  const shore = must(
    near(site).find((n) => n.terrain !== 'sea'),
    'land neighbour',
  );
  [site, ...near(site)].forEach((p) => {
    Object.assign(p, { owner: null, garrisonArmies: [], characters: [], neutralDefenders: [] });
  });
  [site, sea, shore].forEach((p) => {
    p.owner = 0;
  });
  const company = (type: string, k: number): Army => ({
    type,
    quality: 'Average',
    race: 'Human',
    unitName: `${type} ${String(k)}`,
  });
  const lead = (id: number, armies: Army[]): Character => {
    const proto = must(
      G.characters.find((c) => c.player === 0),
      'hero of realm 0',
    );
    const c: Character = {
      ...proto,
      id,
      name: `Hero ${String(id)}`,
      isKing: false,
      alive: true,
      armies,
      location: site.id,
      locationName: site.name,
    };
    G.characters.push(c);
    site.characters.push(id);
    return c;
  };
  // the defender leads one hull and two companies of horse; the hero beside him two more
  const defender = lead(9101, [company('Galleon Fleet', 1), company('Gilded Lances', 1), company('Gilded Lances', 2)]);
  const ally = lead(9102, [company('Gilded Lances', 3), company('Gilded Lances', 4)]);
  // the companies that rallied into the battle, from the garrison and from a fallen hero's leaderless host, with the
  // marks the Move order gives them; Green, so the weakest, the first the hull leaves behind
  const fromTheGarrison: Army = {
    ...company('Shieldwall Levies', 1),
    quality: 'Green',
    _fromGarrison: true,
    _garrisonOf: site.id,
  };
  const fromAHost: Army = { ...company('Shieldwall Levies', 2), quality: 'Green', _fromLeaderless: 9103 };
  // the battle's pooled copy of the beaten side, as the Move order makes it: the same company records
  const pooled: Character = { ...defender, armies: [...defender.armies, ...ally.armies, fromTheGarrison, fromAHost] };
  const tc = addTheFieldsResolveTurnAdds(
    createTurnContext(...([G, [], 3] as unknown as Parameters<typeof createTurnContext>)),
    { KC_SEASONS, isBotRow },
  );
  const narrative: never[] = [];
  const side = { heroName: pooled.name, leaderless: false };
  const r = navalSplitRetreat(
    ...([tc, pooled, site, pooled.armies, narrative, side] as unknown as Parameters<typeof navalSplitRetreat>),
  );
  expect(r, 'the fleet sails').toBe('left');
  const ashore = shore.garrisonArmies;
  expect(ashore.length, 'some companies fell back overland').toBeGreaterThan(0);
  const stillLed = [defender, ally].flatMap((h) =>
    h.armies.filter((a) => ashore.includes(a)).map((a) => `${h.name}: ${a.unitName}`),
  );
  expect(stillLed, 'no hero still leads a company now in the garrison').toEqual([]);
  expect(ashore, 'the rallied companies, the weakest, are among those sent overland').toEqual(
    expect.arrayContaining([fromTheGarrison, fromAHost]),
  );
  const marked = ashore.filter((a) => ['_fromGarrison', '_garrisonOf', '_fromLeaderless'].some((k) => k in a));
  expect(
    marked.map((a) => a.unitName),
    'no company in the garrison keeps a rally mark',
  ).toEqual([]);
  const tcSent = (tc as unknown as { _companiesSentOverland: Army[] })._companiesSentOverland;
  expect(tcSent, 'the split hands back exactly the companies it sent overland').toEqual(ashore);
});
