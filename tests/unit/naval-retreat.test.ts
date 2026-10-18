// The naval retreat split (2026-09-27, item 3; ruling R-058), staged and fuzzed on the engine: a beaten force with ships
// on a coastal shore sails what its hulls can carry to friendly water, and the rest falls back overland to the realm's
// own ground, holds the province, or scatters on a hostile shore; with no friendly water the hero and the troops march
// inland and the ships stay. 4,000 fuzzed coastal retreats: no crash, no malformed line, and every unit ends up
// somewhere.
// Level 1 (unit): navalSplitRetreat (src/engine/units/sea-lift-stranding-and-retreats.js, plan P1-08b) is called
// directly on a world the engine makes in the bare vm (tests/lib/engine.ts). It was tests/naval-retreat.test.js,
// which ran one turn on the GM portal for the anchor hook to hand the function back; the checks are the same.
import { afterAll, describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog, turnContext, type TurnContext } from '../lib/engine.ts';

interface Unit {
  type: string;
  quality: string;
  race: string;
  unitName?: string | null;
  [k: string]: unknown;
}
interface Province {
  id: number;
  name: string;
  terrain: string;
  owner: number | null;
  garrisonArmies?: unknown[];
  characters?: unknown[];
  neutralDefenders?: unknown[];
  _battleUnresolved?: unknown;
  _flood?: unknown;
  [k: string]: unknown;
}
interface Hero {
  id: number;
  location: number;
  armies: Unit[];
  [k: string]: unknown;
}
interface World {
  world: { cols: number; rows: number; provinces: Province[] };
  characters: Hero[];
  mercenaries: unknown[];
}

const engine = loadEngine({ seed: 1 });
const restoreLog = quietEngineLog(engine);
afterAll(restoreLog);
const tc: TurnContext = turnContext(engine, botWorld(engine, 3, { cols: 12, rows: 7 }, { seaPct: 45 }));
const G = tc.G as unknown as World;
type SplitRetreat = (
  tc: TurnContext,
  ch: Hero,
  prov: Province,
  live: Unit[],
  narrative: string[],
  cName: string,
  noSea?: boolean,
) => string;
const navalSplitRetreat = engineFn(engine, 'navalSplitRetreat') as SplitRetreat;
const seaLiftShortfall = engineFn(engine, 'seaLiftShortfall') as (armies: Unit[], leadChar: Hero) => number;
const getNeighborsP = engineFn(engine, 'getNeighborsP') as (
  p: Province,
  cols: number,
  rows: number,
  provinces: Province[],
) => (Province | null)[];
const neigh = (p: Province) =>
  getNeighborsP(p, G.world.cols, G.world.rows, G.world.provinces).filter((n): n is Province => !!n);
const unit = (type: string, quality = 'Average'): Unit => ({ type, quality, race: 'Human', unitName: null });

// A coastal LAND province with at least one sea neighbour and one other land neighbour.
const site = G.world.provinces.find(
  (p) => p.terrain !== 'sea' && neigh(p).some((n) => n.terrain === 'sea') && neigh(p).some((n) => n.terrain !== 'sea'),
);
if (!site) throw new Error('no coastal test site on this map');
const seaN = neigh(site).find((n) => n.terrain === 'sea');
const landN = neigh(site).find((n) => n.terrain !== 'sea');
if (!seaN || !landN) throw new Error('the site has no sea or no land neighbour');
const PI = 0;

const clear = (p: Province) => {
  p.owner = null;
  p.garrisonArmies = [];
  p.characters = [];
  p.neutralDefenders = [];
  delete p._battleUnresolved;
  delete p._flood;
};
const reset = (opts: { siteOwned: boolean; friendlySea: boolean; friendlyLand: boolean; armies: Unit[] }): Hero => {
  // a clean slate: nobody owns anything near the site except as the case says
  neigh(site).concat([site]).forEach(clear);
  site.owner = opts.siteOwned ? PI : null;
  if (opts.friendlySea) seaN.owner = PI;
  if (opts.friendlyLand) landN.owner = PI;
  G.mercenaries = [];
  const ch: Hero = {
    id: 9001,
    name: 'Admiral Test',
    player: PI,
    alive: true,
    hp: 20,
    maxHp: 20,
    race: 'Human',
    temper: 'Brave',
    skills: {},
    items: [],
    armies: opts.armies.slice(),
    location: site.id,
    _attackedFrom: null,
  };
  G.characters = G.characters.filter((c) => c.id !== 9001);
  G.characters.push(ch);
  site.characters = [ch.id];
  return ch;
};
const liveUnits = (ch: Hero) => ({
  inArmy: ch.armies.length,
  siteGar: (site.garrisonArmies ?? []).length,
  landGar: (landN.garrisonArmies ?? []).length,
  mercs: G.mercenaries.length,
});
const retreat = (ch: Hero, noSea?: boolean) => {
  const narr: string[] = [];
  const r = navalSplitRetreat(tc, ch, site, ch.armies, narr, 'Admiral Test', noSea);
  return { r, narr };
};

describe('the staged cases', () => {
  test('A: hulls carry everything, friendly sea alongside: the whole force sails', () => {
    const ch = reset({
      siteOwned: true,
      friendlySea: true,
      friendlyLand: true,
      armies: [unit('Galleon Fleet'), unit('Galleon Fleet'), unit('Shieldwall Levies')],
    });
    expect(retreat(ch).r).toBe('left');
    expect(ch.location, 'the hero is at sea').toBe(seaN.id);
    expect(ch.armies, 'nothing left behind').toHaveLength(3);
    expect(site._battleUnresolved, 'the province is not left contested').toBeFalsy();
  });

  test('B: too much foot for the hulls, friendly sea and own land: the fleet sails and the rest falls back overland', () => {
    const ch = reset({
      siteOwned: true,
      friendlySea: true,
      friendlyLand: true,
      armies: [
        unit('Galleon Fleet'),
        unit('Gilded Lances'),
        unit('Gilded Lances'),
        unit('Gilded Lances'),
        unit('Gilded Lances'),
      ],
    });
    expect(retreat(ch).r).toBe('left');
    const st = liveUnits(ch);
    expect(ch.location, 'the hero sails with the fleet').toBe(seaN.id);
    expect(st.landGar, "the units that would not fit joined the land neighbour's garrison").toBeGreaterThan(0);
    expect(st.inArmy + st.landGar, 'no unit lost').toBe(5);
    expect(seaLiftShortfall(ch.armies, ch), 'what sailed can actually be carried').toBe(0);
  });

  test('C: too much foot, friendly sea, no friendly land: the rest holds the ground', () => {
    const ch = reset({
      siteOwned: true,
      friendlySea: true,
      friendlyLand: false,
      armies: [
        unit('Galleon Fleet'),
        unit('Gilded Lances'),
        unit('Gilded Lances'),
        unit('Gilded Lances'),
        unit('Gilded Lances'),
      ],
    });
    expect(retreat(ch).r, 'some stay and fight again').toBe('stay');
    const st = liveUnits(ch);
    expect(ch.location, 'the hero still sails').toBe(seaN.id);
    expect(st.siteGar, 'the leftovers hold the site').toBeGreaterThan(0);
    expect(site._battleUnresolved, 'the province is still contested').toBeTruthy();
    expect(st.inArmy + st.siteGar, 'no unit lost').toBe(5);
  });

  test('D: no friendly water, friendly land: the hero and the foot march, the ships stay', () => {
    const ch = reset({
      siteOwned: true,
      friendlySea: false,
      friendlyLand: true,
      armies: [unit('Galleon Fleet'), unit('Shieldwall Levies'), unit('Yeoman Longbows')],
    });
    expect(retreat(ch).r, 'the ships stay to keep fighting').toBe('stay');
    const st = liveUnits(ch);
    expect(ch.location, 'the hero and the land units retreat overland').toBe(landN.id);
    expect(
      ch.armies.length === 2 && !ch.armies.some((a) => a.type === 'Galleon Fleet'),
      'the hulls did not march inland',
    ).toBe(true);
    expect(st.siteGar, 'the hulls hold the coast').toBe(1);
    expect(site._battleUnresolved, 'the province is still contested').toBeTruthy();
  });

  test('E: a fleet alone with nowhere to sail stays and fights', () => {
    const ch = reset({
      siteOwned: true,
      friendlySea: false,
      friendlyLand: true,
      armies: [unit('Galleon Fleet'), unit('Galleon Fleet')],
    });
    expect(retreat(ch).r).toBe('stay');
    expect(ch.location, 'the hero stays with his fleet').toBe(site.id);
    expect(ch.armies, 'the fleet is intact').toHaveLength(2);
    expect(site._battleUnresolved, 'the province is still contested').toBeTruthy();
  });

  test('F: a force with no ships is left to the ordinary retreat', () => {
    const ch = reset({
      siteOwned: true,
      friendlySea: true,
      friendlyLand: true,
      armies: [unit('Shieldwall Levies'), unit('Gilded Lances')],
    });
    const before = JSON.stringify({ loc: ch.location, n: ch.armies.length });
    const { r, narr } = retreat(ch);
    expect(r).toBe('');
    expect(JSON.stringify({ loc: ch.location, n: ch.armies.length }), 'nothing was moved').toBe(before);
    expect(narr, 'nothing was reported').toHaveLength(0);
  });

  test('G: ships and foot with nowhere friendly at all: the ordinary rules decide', () => {
    const ch = reset({
      siteOwned: true,
      friendlySea: false,
      friendlyLand: false,
      armies: [unit('Galleon Fleet'), unit('Shieldwall Levies')],
    });
    const before = JSON.stringify({ loc: ch.location, n: ch.armies.length });
    expect(retreat(ch).r).toBe('');
    expect(JSON.stringify({ loc: ch.location, n: ch.armies.length }), 'nothing was moved').toBe(before);
  });

  test('H: thrown back off an enemy coast: the hero sails, the leaderless rest scatter as mercenaries', () => {
    const ch = reset({
      siteOwned: false,
      friendlySea: true,
      friendlyLand: false,
      armies: [unit('Orcish Longships'), unit('Gilded Lances'), unit('Gilded Lances'), unit('Gilded Lances')],
    });
    site.owner = 1;
    retreat(ch);
    const st = liveUnits(ch);
    expect(ch.location, 'the hero gets away to sea').toBe(seaN.id);
    expect(st.siteGar, 'nothing was handed to the enemy garrison').toBe(0);
    expect(st.mercs, 'the men left on a hostile shore scatter as mercenaries').toBeGreaterThan(0);
    expect(st.inArmy + st.mercs, 'no unit vanished').toBe(4);
  });

  test('Cut the Line closes the water: the column goes overland and the ships are left behind', () => {
    const ch = reset({
      siteOwned: true,
      friendlySea: true,
      friendlyLand: true,
      armies: [unit('Galleon Fleet'), unit('Shieldwall Levies')],
    });
    expect(retreat(ch, true).r).toBe('stay');
    expect(ch.location).toBe(landN.id);
  });
});

test('fuzz: 4,000 coastal retreats, no crash, no malformed line, every unit ends up somewhere', () => {
  const TYPES = [
    'Galleon Fleet',
    'Corsair Fleet',
    'Elven Galleys',
    'Dwarf Ironclads',
    'Orcish Longships',
    'Whale Cohort',
    'Eldritch Kraken',
    'Shieldwall Levies',
    'Yeoman Longbows',
    'Gilded Lances',
    'Free Lances',
    'Dwarven Guard',
    'Mountain Guns',
    'Eagle Riders',
    'Wyvern Riders',
    'Forest Ents',
    'Stone Giants',
  ];
  const Q = ['Green', 'Average', 'Veteran', 'Crack', 'Elite'];
  const sites = G.world.provinces.filter((p) => p.terrain !== 'sea' && neigh(p).some((n) => n.terrain === 'sea'));
  const problems: string[] = [];
  for (let i = 0; i < 4000; i++) {
    const sp = sites[i % sites.length];
    if (!sp) throw new Error('no coastal sites');
    const nb = neigh(sp);
    const sN = nb.filter((n) => n.terrain === 'sea'),
      lN = nb.filter((n) => n.terrain !== 'sea');
    nb.concat([sp]).forEach(clear);
    if (i % 3 === 0) sp.owner = PI;
    else if (i % 3 === 1) sp.owner = 1;
    const seaPick = sN[i % (sN.length || 1)];
    if (i % 2 === 0 && seaPick) seaPick.owner = PI;
    const landPick = lN[i % (lN.length || 1)];
    if (i % 5 < 2 && landPick) landPick.owner = PI;
    G.mercenaries = [];
    const n = 1 + (i % 6);
    const armies: Unit[] = [];
    for (let k = 0; k < n; k++)
      armies.push({ type: TYPES[(i * 7 + k * 3) % TYPES.length] ?? '', quality: Q[(i + k) % 5] ?? '', race: 'Human' });
    const ch: Hero = {
      id: 9002,
      name: 'Fz',
      player: PI,
      alive: true,
      hp: 20,
      maxHp: 20,
      race: 'Human',
      temper: 'Brave',
      skills: {},
      items: [],
      armies: armies.slice(),
      location: sp.id,
      _attackedFrom: i % 4 === 0 && sN[0] ? sN[0].id : null,
    };
    G.characters = G.characters.filter((c) => c.id !== 9002);
    G.characters.push(ch);
    sp.characters = [ch.id];
    try {
      const narr: string[] = [];
      navalSplitRetreat(tc, ch, sp, ch.armies, narr, 'Fz', i % 7 === 0);
      const after =
        ch.armies.length +
        nb.reduce((s, p) => s + (p.garrisonArmies ?? []).length, 0) +
        (sp.garrisonArmies ?? []).length +
        G.mercenaries.length;
      if (after !== n)
        problems.push(`retreat ${String(i)}: started with ${String(n)} units, ended with ${String(after)}`);
      const bad = narr.find((l) => /undefined|NaN/.test(l));
      if (bad) problems.push(`retreat ${String(i)}: a bad line: ${bad}`);
    } catch (e) {
      problems.push(`retreat ${String(i)} threw: ${String(e instanceof Error ? e.stack : e)}`);
    }
  }
  expect(problems.slice(0, 5)).toEqual([]);
});
