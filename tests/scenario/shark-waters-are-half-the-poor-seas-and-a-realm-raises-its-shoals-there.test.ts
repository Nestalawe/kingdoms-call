// 2026-10-13 (the maintainers, Creatures and Monsters III): Shark Shoals, the weak sea Monster, and the half-and-half
// seas.
//   - three worlds: every poor sea is whale waters or shark waters, and the two are dealt in equal shares (they differ
//     by at most two in a world: the home coastal guarantee may open one guarded sea); shark waters carry the pool
//     ['Shark Shoals'], the race 'Primal:Shark', Shark Shoals defenders of the Primal race and the poor tax (2–3), and a
//     name; whale waters are as they were; the prosperous primal seas are untouched (tax 4–6);
//   - a turn: an Evil king standing in his own shark waters recruits a Shark Shoals company, of the Primal race
//     whatever his realm's race, with a company name, and nothing is stranded.
// The tables (the shoals' classes, the sea names' pool, the Druid shortfall on the shoals, their cost) are
// tests/unit/the-engines-tables-give-each-beast-as-the-wild-roster-table-decides.test.ts.
//
// Level 2 (scenario): the sea pass lives inside generateNewGame and the recruit path inside resolveTurn, so only worlds
// and a turn reach them. Played on the engine's modules (tests/lib/a-staged-turn-on-the-engines-modules.ts) on worlds
// made from KC_SEED; the turn's waters are staged whatever the world. The worlds' checks hold on any world by the sea
// pass's construction (the poor seas dealt turn about), but for one: that the three worlds dealt at least six poor seas,
// a guard that the checks read something (at 40% sea on 14×8, about 18 poor seas are dealt).
//
// Until plan P1-14z this was tests/shark-waters.test.js, on the GM page (lib/scenario.ts); each check is kept as it
// was, the three worlds' checks each one test over the three, and its page-errors check went with the page.
import { beforeAll, describe, expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules, order, plan } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface Unit {
  type: string;
  race?: string;
  unitName?: string;
}
interface Province {
  id: number;
  name?: string;
  terrain: string;
  race?: string;
  tax: number;
  owner?: number | null;
  armyTypes?: string[];
  neutralDefenders?: Unit[];
  npcArmies?: number;
}
interface Character {
  id: number;
  isKing?: boolean;
  player: number | null;
  location?: number;
  armies?: Unit[];
}
interface World {
  players: { provinces?: number[]; gold?: number }[];
  characters: Character[];
  world: { provinces: (Province | null)[] };
}

/** Each world's seas, as the checks read them. */
const worlds: { poor: Province[]; whales: Province[]; sharks: Province[]; primal: Province[] }[] = [];
let shoals: Unit[] = [];
let kingsLines = '';

beforeAll(async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { KC_UNIT_CLASS } = await import('../../src/content/kingdoms-call-data.ts');
  // the prosperous seas' beasts (Sea Giants, Eldritch Kraken and, from Creatures and Monsters IV, Great Turtles); a
  // poor sea holds whales or sharks
  const RICH = new Set(KC_UNIT_CLASS.primalSea.filter((t) => t !== 'Shark Shoals'));
  const king = (S: World, pi: number) => S.characters.find((c) => c.isKing === true && c.player === pi);

  for (let k = 0; k < 3; k++) {
    // One realm: the sea pass deals the poor seas turn about (exactly half each), and afterwards the home coastal
    // guarantee may open ONE guarded sea beside each home into open water, whale or shark.
    // `as`: the engine's world, as the checks read it
    const S = sc.world({ realms: 1, cols: 14, rows: 8, seaPct: 40 }).S as unknown as World;
    const seas = S.world.provinces.filter((p): p is Province => p?.terrain === 'sea');
    const beastOf = (p: Province) => (p.armyTypes ?? [])[0] ?? '';
    const poor = seas.filter((p) => (p.armyTypes ?? []).length > 0 && !RICH.has(beastOf(p)));
    worlds.push({
      poor,
      whales: poor.filter((p) => beastOf(p) === 'Whale Cohort'),
      sharks: poor.filter((p) => beastOf(p) === 'Shark Shoals'),
      primal: seas.filter((p) => (p.armyTypes ?? []).length > 0 && RICH.has(beastOf(p))),
    });
  }

  // ── Recruiting in one's own shark waters ──
  const r = sc.turn<World, { ek: number }>({
    realms: 2,
    alignments: ['Evil', 'Neutral'],
    prepare(S) {
      const ek = king(S, 0);
      // Stage the waters directly: the realm's own shark waters, the king standing in them with a full purse.
      const sea = S.world.provinces.find((p): p is Province => p?.terrain === 'sea');
      const realm = S.players[0];
      if (!ek || !sea || !realm) throw new Error('the world has no sea or no king');
      S.players.forEach((pl) => {
        pl.provinces = (pl.provinces ?? []).filter((x) => x !== sea.id);
      });
      sea.owner = 0;
      sea.race = 'Primal:Shark';
      sea.armyTypes = ['Shark Shoals'];
      sea.neutralDefenders = [];
      sea.npcArmies = 0;
      sea.tax = 2;
      (realm.provinces ??= []).push(sea.id);
      ek.location = sea.id;
      realm.gold = 40;
      ek.armies = []; // he puts out alone: his starting foot would need hulls, and the point is that the shoal needs none
      return { ek: ek.id };
    },
    orders: (_S, x) => ({ [x.ek]: plan(order('recruit', 'Shark Shoals|1')) }),
  });
  // `as`: the world after the turn, as the checks read it
  const after = r.S2 as unknown as World;
  shoals = (after.characters.find((c) => c.id === r.extra.ek)?.armies ?? []).filter((a) => a.type === 'Shark Shoals');
  kingsLines = r.text(r.extra.ek);
});

describe('the seas of three worlds', () => {
  test('every poor sea is whale waters or shark waters', () => {
    for (const w of worlds) expect(w.poor.length).toBe(w.whales.length + w.sharks.length);
  });
  test('the poor seas are dealt half and half, less the one sea the home coastal guarantee may open', () => {
    for (const w of worlds)
      expect(
        Math.abs(w.whales.length - w.sharks.length),
        `${String(w.whales.length)} whale, ${String(w.sharks.length)} shark`,
      ).toBeLessThanOrEqual(2);
  });
  test('shark waters carry the race Primal:Shark and the pool [Shark Shoals] only', () => {
    for (const w of worlds)
      expect(w.sharks.every((p) => p.race === 'Primal:Shark' && (p.armyTypes ?? []).length === 1)).toBe(true);
  });
  test('shark waters are poor (tax 2–3)', () => {
    for (const w of worlds) expect(w.sharks.every((p) => p.tax >= 2 && p.tax <= 3)).toBe(true);
  });
  test('shark waters are guarded by Shark Shoals of the Primal race', () => {
    for (const w of worlds)
      expect(
        w.sharks.every(
          (p) =>
            (p.neutralDefenders ?? []).length >= 1 &&
            (p.neutralDefenders ?? []).every((d) => d.type === 'Shark Shoals' && d.race === 'Primal'),
        ),
      ).toBe(true);
  });
  test('whale waters are as they were', () => {
    for (const w of worlds)
      expect(
        w.whales.every(
          (p) =>
            p.race === 'Primal:Whale' &&
            p.tax >= 2 &&
            p.tax <= 3 &&
            (p.neutralDefenders ?? []).every((d) => d.type === 'Whale Cohort'),
        ),
      ).toBe(true);
  });
  test('the prosperous primal seas are untouched', () => {
    for (const w of worlds)
      expect(w.primal.every((p) => p.tax >= 4 && p.tax <= 6 && !/Shark|Whale/.test(p.race ?? ''))).toBe(true);
  });
  test('every shark sea has a name', () => {
    for (const w of worlds) expect(w.sharks.every((p) => typeof p.name === 'string' && p.name.length > 0)).toBe(true);
  });
  test('the three worlds dealt enough poor seas to mean something', () => {
    expect(worlds.reduce((n, w) => n + w.whales.length + w.sharks.length, 0)).toBeGreaterThanOrEqual(6);
  });
});

describe('a turn: an Evil king recruits in his own shark waters', () => {
  test('the king leads one Shark Shoals company after the turn', () => {
    expect(
      shoals.length,
      kingsLines
        .split('\n')
        .filter((l) => /Shark|recruit/i.test(l))
        .slice(0, 2)
        .join(' | '),
    ).toBe(1);
  });
  test('the shoal swims beside its king: nothing is stranded or left as a garrison', () => {
    expect(kingsLines).not.toMatch(/too few hulls|left holding/);
  });
  test('the shoal is of the Primal race, whoever raises it', () => {
    expect(shoals.length).toBeGreaterThan(0);
    expect(shoals.every((a) => a.race === 'Primal')).toBe(true);
  });
  test('the shoal has a company name', () => {
    expect(shoals.length).toBeGreaterThan(0);
    expect(shoals.every((a) => typeof a.unitName === 'string' && a.unitName.startsWith('the '))).toBe(true);
  });
});
