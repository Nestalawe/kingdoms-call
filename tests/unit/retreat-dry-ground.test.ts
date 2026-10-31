// A beaten force never falls back into a Flooded province, and onto sea laid dry by Part Sea only when no ordinary land
// is open to it (2026-10-08, item 10; ruling R-084): foot, flyers, and the naval split's march inland.
// Level 1 (unit): retreatOptions, bestRetreat and navalSplitRetreat (src/engine/units/sea-lift-stranding-and-retreats.ts,
// plan P1-08b) are called directly on a world the engine makes in the bare vm (tests/lib/engine.ts), each case staged
// on it. It was tests/retreat-dry-ground.test.js, which ran one turn on the GM portal for the anchor hook to hand the
// functions back; the checks are the same.
import { afterAll, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog, turnContext } from '../lib/engine.ts';
import type { ASideOfABattle } from '../../src/engine/battle/the-facts-a-battles-lines-record.ts';

interface Province {
  id: number;
  terrain: string;
  owner: number | null;
  tax?: number;
  characters?: unknown[];
  garrisonArmies?: unknown[];
  neutralDefenders?: unknown[];
  _flood?: { orig: string; turn: number };
  _partSea?: { orig: string; turn: number; blockFleetsFromPhase: number };
  _battleUnresolved?: unknown;
}
interface Hero {
  id: number;
  location: number;
  armies: unknown[];
  [k: string]: unknown;
}
interface World {
  turn: number;
  world: { cols: number; rows: number; provinces: Province[] };
  characters: Hero[];
}

const engine = loadEngine({ seed: 1 });
const restoreLog = quietEngineLog(engine);
afterAll(restoreLog);
const tc = turnContext(engine, botWorld(engine, 2, { cols: 12, rows: 7 }, { seaPct: 40 }));
const G = tc.G as unknown as World;
const retreatOptions = engineFn(engine, 'retreatOptions') as (
  t: typeof tc,
  ch: Hero,
  prov: Province,
  force: unknown[],
) => Province[];
const bestRetreat = engineFn(engine, 'bestRetreat') as (t: typeof tc, ch: Hero, list: Province[]) => Province | null;
const navalSplitRetreat = engineFn(engine, 'navalSplitRetreat') as (
  t: typeof tc,
  ch: Hero,
  prov: Province,
  live: unknown[],
  narrative: string[],
  cName: ASideOfABattle,
) => string;
const getNeighborsP = engineFn(engine, 'getNeighborsP') as (
  p: Province,
  cols: number,
  rows: number,
  provinces: Province[],
) => (Province | null)[];
const nb = (p: Province) =>
  getNeighborsP(p, G.world.cols, G.world.rows, G.world.provinces).filter((n): n is Province => !!n);

// A land province with at least two land neighbours: the battlefield, and two places to fall back to.
const site = G.world.provinces.find((p) => p.terrain !== 'sea' && nb(p).filter((n) => n.terrain !== 'sea').length >= 2);
if (!site) throw new Error('no land province with two land neighbours on this map');
const [P1, P2] = nb(site).filter((n) => n.terrain !== 'sea');
if (!P1 || !P2) throw new Error('the site has fewer than two land neighbours');
const unit = (type: string) => ({ type, quality: 'Average', race: 'Human', unitName: type });
const stage = (armies: unknown[]): Hero => {
  nb(site)
    .concat([site])
    .forEach((p) => {
      p.owner = null;
      p.characters = [];
      p.garrisonArmies = [];
      p.neutralDefenders = [];
      delete p._flood;
      delete p._partSea;
      delete p._battleUnresolved;
    });
  [site, P1, P2].forEach((p) => {
    p.owner = 0;
  });
  P1.tax = 1;
  P2.tax = 6; // the magic ground is the richer one, so the value rule alone would pick it
  const ch: Hero = {
    id: 9101,
    name: 'Captain Test',
    player: 0,
    alive: true,
    hp: 20,
    maxHp: 20,
    race: 'Human',
    temper: 'Brave',
    skills: {},
    items: [],
    armies,
    location: site.id,
    _attackedFrom: null,
  };
  G.characters = G.characters.filter((c) => c.id !== 9101);
  G.characters.push(ch);
  site.characters = [ch.id];
  return ch;
};
const pick = (ch: Hero) => {
  const o = retreatOptions(tc, ch, site, ch.armies);
  return { o, best: bestRetreat(tc, ch, o) };
};
const ids = (list: Province[]) => list.map((p) => p.id);
const flood = (p: Province) => {
  p._flood = { orig: p.terrain, turn: G.turn };
  p.terrain = 'sea';
};
const unflood = (p: Province) => {
  const f = p._flood;
  if (f) {
    p.terrain = f.orig;
    delete p._flood;
  }
};
const part = (p: Province) => {
  p._partSea = { orig: 'sea', turn: G.turn, blockFleetsFromPhase: 0 };
  p.terrain = 'plains';
};

test('(1) a foot column falls back to ordinary land, not to sea laid dry by Part Sea', () => {
  const ch = stage([unit('Shieldwall Levies'), unit('Shieldwall Levies')]);
  part(P2);
  const { o, best } = pick(ch);
  expect(ids(o), 'ordinary land is a retreat option').toContain(P1.id);
  expect(ids(o), 'parted sea is not, while ordinary land is open').not.toContain(P2.id);
  expect(best?.id, 'the column falls back to ordinary land').toBe(P1.id);
});

test('(2) a flying host does not fall back into a Flooded province while ordinary land is open', () => {
  const ch = stage([unit('Noble Griffons'), unit('Noble Griffons')]);
  P2.terrain = P2.terrain === 'sea' ? 'plains' : P2.terrain;
  flood(P2);
  const { o, best } = pick(ch);
  expect(ids(o)).not.toContain(P2.id);
  expect(best?.id, 'the flyers fall back to ordinary land').toBe(P1.id);
  unflood(P2);
});

test('(3) with no ordinary land open, parted sea is still a way out', () => {
  const ch = stage([unit('Shieldwall Levies')]);
  P1.owner = null;
  part(P2);
  expect(ids(pick(ch).o)).toContain(P2.id);
});

test('(3b) a Flooded province is never a way out, even with nothing else open (flyers can cross water)', () => {
  const ch = stage([unit('Noble Griffons')]);
  P1.owner = null;
  flood(P2);
  expect(ids(pick(ch).o)).not.toContain(P2.id);
  unflood(P2);
});

test('(4) the naval split: ships with no friendly water march their troops inland, to ordinary land', () => {
  const ch = stage([unit('Galleon Fleet'), unit('Shieldwall Levies')]);
  part(P2);
  nb(site)
    .filter((n) => n.terrain === 'sea')
    .forEach((n) => {
      n.owner = null;
    });
  navalSplitRetreat(tc, ch, site, ch.armies, [], { heroName: 'Captain Test', leaderless: false });
  expect(ch.location).toBe(P1.id);
});
