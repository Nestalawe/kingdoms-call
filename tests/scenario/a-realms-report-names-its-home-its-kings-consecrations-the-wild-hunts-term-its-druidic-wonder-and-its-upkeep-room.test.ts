// A realm's turn report names facts of its own in its `kingdom` (plan P1-11e24; the hero-wage ones P1-11e30), each as
// the turn counts it, for the order form's creed notes and treasury ledger to read (P1-11e25, e26, e29, e30, e34):
// - `homeProvinceId`: its home province (homeProvinceIdFor: its founding capital, held or lost);
// - `theConsecrationsItsKingMayHold`: the consecrations its living king may hold at once (his White, and Holy Sites');
// - `theTurnsAWildHuntServesBeyondThisOne`: the turns a Wild Hunt's beasts serve beyond the turn (and The Long Hunt's);
// - `itsDruidicWonderHalvesItsBeastsWages`: whether its Druidic Wonder stands (gdActiveFor), halving its beasts' wages;
// - `theUpkeepDiscoveriesCutsAndTheirRoom`: each upkeep discovery's cut on a unit of each type, and its room left under
//   its cap once the roster's wages have drawn on it (the cuts share the realm's 5%-of-base-tax cap, one at a time);
// - `theHeroWageDiscoveriesCutsAndTheirRoom` and `theHeroWageDiscoveriesCeilingsAndTheirRoom`: each hero-wage
//   discovery's cut on a hero of each alignment, or its ceiling, and its room left once the heroes' wages have drawn on it.
// Who sees what doesn't change (P1-11's Decision 6): each is the realm's own, in its own report alone.
//
// Level 2 (scenario): the report is built from a world after a turn, and each field is checked against the turn's own
// rule on the world the turn left; played on the engine's modules (tests/lib/a-staged-turn-on-the-engines-modules.ts)
// on a world made from KC_SEED. Not lower: the fields are the report's, built from what a realm may see of the world.
//
// Staged: realm 0 (Druidic) has lost its founding capital (now no realm's), holds a province beside it where its
// heroes stand, has built its Druidic Wonder there, and holds The Long Hunt, Quartermasters (infantry's wage, -1g),
// Supply Depots (every unit's wage, -1g), Granaries (every hero's, -1g) and Inspiring Leadership (no hero above 3g); its king, White 0, leads one company of Shieldwall Levies (2g: Quartermasters
// cuts it to 1g, so Supply Depots finds nothing left to cut); the province it holds is taxed 60, so the cap they share
// (5% of its base tax) is above each row's own 1g. Realm 1 (Divine) holds Holy Sites and no other
// discovery; its king is White 3 (Holy Sites' 1 more needs White 3). Every hero Rests. One case restages realm 1: its
// king White 1, and a hero of its who is not the king, White 3, placed before him in the world's list of characters.
import { expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
const FIELDS = [
  'homeProvinceId',
  'theConsecrationsItsKingMayHold',
  'theTurnsAWildHuntServesBeyondThisOne',
  'itsDruidicWonderHalvesItsBeastsWages',
  'theUpkeepDiscoveriesCutsAndTheirRoom',
  'theHeroWageDiscoveriesCutsAndTheirRoom',
  'theHeroWageDiscoveriesCeilingsAndTheirRoom',
] as const;

interface Province {
  id: number;
  row: number;
  col: number;
  name: string;
  terrain: string;
  tax: number;
  owner: number | null;
  characters?: number[];
  garrisonArmies?: unknown[];
  [key: string]: unknown;
}
interface Army {
  type: string;
  [key: string]: unknown;
}
interface Character {
  id: number;
  player: number | null;
  alive?: boolean;
  isKing: boolean;
  location: number;
  locationName?: string;
  armies?: Army[];
  skills?: Record<string, number>;
  [key: string]: unknown;
}
interface Realm {
  provinces: number[];
  alignment?: string;
  homeProvinceId?: number;
  gdProvinceId?: number;
  discoveries?: { id: string; [key: string]: unknown }[];
  [key: string]: unknown;
}
interface World {
  players: Realm[];
  characters: Character[];
  world: { cols: number; rows: number; provinces: Province[] };
}
interface Scene {
  home: Province;
  held: Province;
}
interface AnUpkeepCut {
  theDiscovery: string | null;
  theGoldItCutsFromAUnitOfEachType: Partial<Record<string, number>>;
  theRoomLeftUnderItsCap: number | null;
}
type Kingdom = Record<string, unknown>;

async function theTurn(restage?: (S: World) => void) {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  const r = sc.turn<World, Scene>({
    realms: 2,
    alignments: ['Druidic', 'Divine'],
    prepare(S) {
      const realm0 = S.players[0];
      const realm1 = S.players[1];
      if (!realm0 || !realm1) throw new Error('could not stage: two realms');
      const home = S.world.provinces[realm0.provinces[0] ?? -1];
      if (!home) throw new Error('could not stage: realm 0 has no capital');
      // a land province beside it where no realm's hero stands (realm 0's own, or made so)
      const empty = (p: Province) =>
        p.terrain !== 'sea' && !S.characters.some((c) => c.alive && c.player != null && c.location === p.id);
      const held = (getNeighborsP(home, S.world.cols, S.world.rows, S.world.provinces) as (Province | null)[]).find(
        (q): q is Province => q != null && empty(q),
      );
      if (!held) throw new Error('could not stage: no land beside realm 0 capital without a hero');
      // (the province beside it no other realm's, and empty of troops)
      S.players.forEach((pl) => {
        pl.provinces = pl.provinces.filter((id) => id !== held.id);
      });
      Object.assign(held, { neutralDefenders: [], npcArmies: 0, garrisonArmies: [], tax: 60 });
      // its founding capital, as a saved game holds it, now lost to no realm; the province beside it its own
      realm0.homeProvinceId = home.id;
      realm0.provinces = realm0.provinces.filter((id) => id !== home.id);
      home.owner = null;
      home.garrisonArmies = [];
      held.owner = 0;
      realm0.provinces.push(held.id);
      for (const c of S.characters.filter((x) => x.player === 0 && x.alive)) {
        S.world.provinces.forEach((q) => {
          q.characters = (q.characters ?? []).filter((id) => id !== c.id);
        });
        held.characters = [...(held.characters ?? []), c.id];
        c.location = held.id;
        c.locationName = held.name;
        c.armies = [];
        if (!c.isKing) c['pay'] = 6; // (each hero of 6g: Granaries' 1g and Inspiring Leadership's 2g draw on their room)
      }
      // (no wanderer or chieftain in the lost capital or the province beside it)
      S.characters = S.characters.filter((c) => c.player != null || (c.location !== home.id && c.location !== held.id));
      for (const p of [home, held])
        p.characters = (p.characters ?? []).filter((id) => S.characters.some((c) => c.id === id));
      realm0.gdProvinceId = held.id;
      realm0.discoveries = [
        { id: 'gd' },
        { id: 'ap08' },
        { id: 'sd45' },
        { id: 'sd55' },
        { id: 'sd17' },
        { id: 'sd38' },
      ];
      realm1.discoveries = [{ id: 'ad03' }];
      const king0 = S.characters.find((c) => c.alive && c.player === 0 && c.isKing);
      const king1 = S.characters.find((c) => c.alive && c.player === 1 && c.isKing);
      if (!king0 || !king1) throw new Error('could not stage: a king of each realm');
      king0.skills = { ...(king0.skills ?? {}), white: 0 };
      king0.armies = [{ type: 'Shieldwall Levies', quality: 'Average', id: 72_001 }];
      king1.skills = { ...(king1.skills ?? {}), white: 3 };
      restage?.(S);
      return { home, held };
    },
  });
  const kingdom = (realm: number): Kingdom => {
    const report = r.reports[realm];
    if (!report) throw new Error(`no report for realm ${String(realm)}`);
    return report['kingdom'] as Kingdom;
  };
  const S2 = r.S2 as unknown as World;
  return { r, S2, kingdom, ...r.extra };
}

test('its home province: the founding capital it has lost, as the turn reads it, which its map no longer names', async () => {
  const { S2, kingdom, home, held, r } = await theTurn();
  const { homeProvinceIdFor } = await import('../../src/engine/grand-design.ts');
  expect(kingdom(0)['homeProvinceId'], "realm 0's lost capital").toBe(home.id);
  expect(homeProvinceIdFor(S2, 0), "the turn's home for realm 0").toBe(home.id);
  expect(S2.world.provinces[home.id]?.owner, 'still lost after the turn (staging)').toBeNull();
  const itsMap = r.reports[0]?.['provinces'] as Record<string, unknown>[] | undefined;
  const onItsMap = itsMap?.find((p) => p['id'] === home.id);
  expect(onItsMap?.['isHomeCapitalOfOwner'], 'its map names no capital there').not.toBe(true);
  expect(kingdom(0)['homeProvinceId'], 'not the province it holds now').not.toBe(held.id);
  expect(kingdom(1)['homeProvinceId'], "realm 1's home, its capital still held").toBe(homeProvinceIdFor(S2, 1));
});

test("its king's consecrations and a Wild Hunt's term: his White and Holy Sites', the turns and The Long Hunt's", async () => {
  const { S2, kingdom } = await theTurn();
  const { theConsecrationsAKingMayHold } = await import('../../src/engine/heroes/fame-and-consecration.ts');
  const { theTurnsAWildHuntServesBeyondThisOne } = await import('../../src/engine/items/tiers-and-hoards.ts');
  const kingOf = (realm: number) => S2.characters.find((c) => c.alive && c.player === realm && c.isKing);
  expect(kingdom(1)['theConsecrationsItsKingMayHold'], 'White 3, and Holy Sites: 4').toBe(4);
  expect(kingdom(0)['theConsecrationsItsKingMayHold'], 'White 0: none').toBe(0);
  for (const realm of [0, 1]) {
    const king = kingOf(realm);
    if (!king) throw new Error(`realm ${String(realm)} lost its king (staging)`);
    expect(kingdom(realm)['theConsecrationsItsKingMayHold'], `realm ${String(realm)}: the turn's limit`).toBe(
      theConsecrationsAKingMayHold(king, S2.players[realm]),
    );
    expect(kingdom(realm)['theTurnsAWildHuntServesBeyondThisOne'], `realm ${String(realm)}: the turn's term`).toBe(
      theTurnsAWildHuntServesBeyondThisOne(S2.players[realm]),
    );
  }
  expect(kingdom(0)['theTurnsAWildHuntServesBeyondThisOne'], 'The Long Hunt: 1 more').toBe(2);
  expect(kingdom(1)['theTurnsAWildHuntServesBeyondThisOne'], 'the rite alone').toBe(1);
});

test("its king's consecrations are read off its king, not the first hero of its list: his White 1, not the hero's 3", async () => {
  const { S2, kingdom } = await theTurn((S) => {
    const king = S.characters.find((c) => c.alive && c.player === 1 && c.isKing);
    const hero = S.characters.find((c) => c.alive && c.player === 1 && !c.isKing);
    if (!king || !hero) throw new Error('could not stage: realm 1 a king and a hero who is not');
    king.skills = { ...(king.skills ?? {}), white: 1 };
    hero.skills = { ...(hero.skills ?? {}), white: 3 };
    S.characters = [hero, ...S.characters.filter((c) => c !== hero)];
  });
  const { theConsecrationsAKingMayHold } = await import('../../src/engine/heroes/fame-and-consecration.ts');
  const itsHeroes = S2.characters.filter((c) => c.alive && c.player === 1);
  const [first] = itsHeroes;
  const king = itsHeroes.find((c) => c.isKing);
  if (!first || !king) throw new Error('realm 1 lost its heroes or its king (staging)');
  expect(first.isKing, 'the first of its heroes is not its king (staging)').toBe(false);
  expect(theConsecrationsAKingMayHold(first, S2.players[1]), "the hero's: White 3, and Holy Sites: 4 (staging)").toBe(
    4,
  );
  expect(kingdom(1)['theConsecrationsItsKingMayHold'], "the king's: White 1, and Holy Sites needs White 3: 1").toBe(1);
  expect(kingdom(1)['theConsecrationsItsKingMayHold'], "the turn's limit for its king").toBe(
    theConsecrationsAKingMayHold(king, S2.players[1]),
  );
});

test('its Druidic Wonder: it halves its beasts’ wages while it stands, as the turn counts it', async () => {
  const { S2, kingdom } = await theTurn();
  const { gdActiveFor } = await import('../../src/engine/grand-design.ts');
  expect(kingdom(0)['itsDruidicWonderHalvesItsBeastsWages'], 'built and held').toBe(true);
  expect(kingdom(1)['itsDruidicWonderHalvesItsBeastsWages'], 'none built').toBe(false);
  for (const realm of [0, 1])
    expect(kingdom(realm)['itsDruidicWonderHalvesItsBeastsWages'], `realm ${String(realm)}: the turn's`).toBe(
      gdActiveFor(S2, realm, 'Druidic'),
    );
});

test('its upkeep discoveries: each one’s cut on a unit of each type, and its room left under the cap they share', async () => {
  const { S2, kingdom } = await theTurn();
  const { discUpkeepWage } = await import('../../src/engine/discoveries.ts');
  const { DISC_BY_ID } = await import('../../src/engine/rules/the-registry-of-discovery-effects.ts');
  const { ARMY_COST_MASTER } = await import('../../src/engine/army-tables.ts');
  const cuts = kingdom(0)['theUpkeepDiscoveriesCutsAndTheirRoom'] as AnUpkeepCut[];
  const cap = Number(kingdom(0)['taxBonusCapG']);
  expect(cap, "the cap above each row's own 1g (staging: its province's tax 60)").toBeGreaterThan(1);
  expect(
    cuts.map((c) => c.theDiscovery),
    'Quartermasters, then Supply Depots',
  ).toEqual(['sd45', 'sd55']);
  const [quartermasters, depots] = cuts;
  if (!quartermasters || !depots) throw new Error('two cuts');
  expect(quartermasters.theGoldItCutsFromAUnitOfEachType['Shieldwall Levies'], 'infantry: 1g').toBe(1);
  expect(quartermasters.theGoldItCutsFromAUnitOfEachType['Free Lances'], 'cavalry: none').toBeUndefined();
  expect(Object.keys(depots.theGoldItCutsFromAUnitOfEachType), 'Supply Depots: every unit').toEqual(
    Object.keys(ARMY_COST_MASTER),
  );
  expect(quartermasters.theRoomLeftUnderItsCap, 'its 1g on the Levies taken from the cap').toBe(cap - 1);
  expect(depots.theRoomLeftUnderItsCap, 'nothing left to cut on the Levies: the cap whole').toBe(cap);
  // against the turn's rule: Early Winter's cuts on the realm's companies, one account, its cap
  const account = new Map<unknown, number>();
  const companies = S2.characters.filter((c) => c.alive && c.player === 0).flatMap((c) => c.armies ?? []);
  expect(
    companies.map((a) => a.type),
    'its roster (staging)',
  ).toEqual(['Shieldwall Levies']);
  companies.forEach((a) => discUpkeepWage(S2.players[0], a, ARMY_COST_MASTER[a.type] ?? 2, account, cap));
  for (const c of cuts) {
    const row = DISC_BY_ID[String(c.theDiscovery)];
    expect(c.theRoomLeftUnderItsCap, `${String(c.theDiscovery)}: the turn's room`).toBe(
      cap - (account.get(row?.effect) ?? 0),
    );
  }
  expect(kingdom(1)['theUpkeepDiscoveriesCutsAndTheirRoom'], 'realm 1 holds none').toEqual([]);
});

test('its hero-wage discoveries: each one’s cut on a hero of each alignment, or its ceiling, and its room left under the cap', async () => {
  const { S2, kingdom } = await theTurn();
  const { discHeroWage } = await import('../../src/engine/discoveries.ts');
  const { DISC_BY_ID } = await import('../../src/engine/rules/the-registry-of-discovery-effects.ts');
  const { KC_ALIGNMENTS } = await import('../../src/content/kingdoms-call-data.ts');
  const cuts = kingdom(0)['theHeroWageDiscoveriesCutsAndTheirRoom'] as {
    theDiscovery: string | null;
    theGoldItCutsFromAHeroOfEachAlignment: Partial<Record<string, number>>;
    theRoomLeftUnderItsCap: number | null;
  }[];
  const ceilings = kingdom(0)['theHeroWageDiscoveriesCeilingsAndTheirRoom'] as {
    theDiscovery: string | null;
    theWagesCeiling: number;
    theRoomLeftUnderItsCap: number | null;
  }[];
  const cap = Number(kingdom(0)['taxBonusCapG']);
  expect(
    cuts.map((c) => [c.theDiscovery, c.theGoldItCutsFromAHeroOfEachAlignment]),
    'Granaries: 1g off every hero',
  ).toEqual([['sd17', Object.fromEntries(KC_ALIGNMENTS.map((a) => [a, 1]))]]);
  expect(
    ceilings.map((c) => [c.theDiscovery, c.theWagesCeiling]),
    'Inspiring Leadership: no hero above 3g',
  ).toEqual([['sd38', 3]]);
  // against the turn's rule: Early Winter's hero wages, the king's aside, on one account, its cap
  const account = new Map<unknown, number>();
  const heroes = S2.characters.filter((c) => c.alive && c.player === 0 && !c.isKing);
  expect(heroes.length, 'realm 0 has heroes who draw on the room (staging)').toBeGreaterThan(0);
  heroes.forEach((h) =>
    discHeroWage(S2.players[0], { alignment: String(h['alignment']) }, Number(h['pay']) || 0, account, cap),
  );
  for (const c of [...cuts, ...ceilings]) {
    const row = DISC_BY_ID[String(c.theDiscovery)];
    expect(c.theRoomLeftUnderItsCap, `${String(c.theDiscovery)}: the turn's room`).toBe(
      cap - (account.get(row?.effect) ?? 0),
    );
  }
  expect(
    [...cuts, ...ceilings].map((c) => Number(c.theRoomLeftUnderItsCap) < cap),
    'each room drawn on by its heroes',
  ).toEqual([true, true]);
  expect(kingdom(1)['theHeroWageDiscoveriesCutsAndTheirRoom'], 'realm 1 holds none').toEqual([]);
  expect(kingdom(1)['theHeroWageDiscoveriesCeilingsAndTheirRoom'], 'realm 1 holds none').toEqual([]);
});

test("each fact is the realm's own, in its own report's kingdom alone: no realm reads another's", async () => {
  const { r, kingdom } = await theTurn();
  for (const realm of [0, 1]) {
    const report = r.reports[realm];
    for (const field of FIELDS) {
      const holders: unknown[] = [];
      const walk = (v: unknown): void => {
        if (Array.isArray(v)) v.forEach(walk);
        else if (typeof v === 'object' && v !== null) {
          if (field in v) holders.push(v);
          Object.values(v).forEach(walk);
        }
      };
      walk(report);
      expect(holders, `realm ${String(realm)}: ${field} in its kingdom alone`).toEqual([kingdom(realm)]);
    }
  }
  // each realm's figures are its own: the staged realms differ in every fact
  for (const field of FIELDS) expect(kingdom(0)[field], field).not.toEqual(kingdom(1)[field]);
});
