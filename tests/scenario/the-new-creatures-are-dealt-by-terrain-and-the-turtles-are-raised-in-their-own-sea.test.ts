// 2026-10-13 (the maintainers, Creatures and Monsters IV): the four new Creatures, Great Bears, Unicorn Herd, Mammoth
// Host and Great Turtles, in the world and in a turn.
//   - three worlds: every Creature province's beast is in its terrain's pool; every prosperous sea holds Sea Giants,
//     Eldritch Kraken or Great Turtles with its beast's race, tax 4–6 and its own defenders, and the turtles do appear;
//     no sea holds a land Creature;
//   - a turn: a Neutral king at Druid 4 recruits a Great Turtles company in his own prosperous sea, with a company name,
//     and is not stranded.
// (Awaken the Wild was removed on 2026-10-12, item 22: tests/scenario/call-from-the-pit-and-awaken-the-wild-given-in-a-
// turn-….) The pools as written, the classes and Whale Lore are
// tests/unit/the-engines-tables-give-each-beast-as-the-wild-roster-table-decides.test.ts.
//
// Level 2 (scenario): the wild pools' deal and the sea pass live inside generateNewGame, and the recruit path inside
// resolveTurn, so only worlds and a turn reach them. Played on the engine's modules
// (tests/lib/a-staged-turn-on-the-engines-modules.ts) on worlds made from KC_SEED; the turn's scene is staged whatever
// the world. Two checks count what three worlds dealt, as the old script did: that the turtles appear in the prosperous
// seas (about twenty prosperous seas over three worlds, a third of them turtles: the odds of none are below one in a
// thousand) and that at least ten Creature provinces were dealt, a guard that the checks read something.
//
// Until plan P1-14z this was tests/new-creatures.test.js, on the GM page (lib/scenario.ts); each check is kept as it
// was, the three worlds' checks each one test over the three, and its page-errors check went with the page. The values
// its turn staged and never checked (two companies' costs) went.
import { beforeAll, describe, expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules, order, plan } from '../lib/a-staged-turn-on-the-engines-modules.ts';
import { THE_WILD_CREATURES_BY_TERRAIN } from '../../src/content/the-worlds-making-its-name-pools-sea-features-wild-beasts-fleets-skill-pools-and-the-bots-realms.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
const RICH = new Set(['Sea Giants', 'Eldritch Kraken', 'Great Turtles']);

interface Unit {
  type: string;
  race?: string;
  unitName?: string;
}
interface Province {
  id: number;
  row: number;
  col: number;
  terrain: string;
  race?: string;
  tax: number;
  owner?: number | null;
  armyTypes?: string[];
  neutralDefenders?: Unit[];
  npcArmies?: number;
  _awakenTurn?: number;
}
interface Character {
  id: number;
  name?: string;
  isKing?: boolean;
  player: number | null;
  location?: number;
  skills?: Record<string, number>;
  armies?: Unit[];
  items?: unknown[];
}
interface World {
  players: { provinces?: number[]; gold?: number; homeProvinceId: number }[];
  characters: Character[];
  world: { cols: number; rows: number; provinces: (Province | null)[] };
}

const worlds: { land: Province[]; seas: Province[]; seaWithALandBeast: boolean; seasRaceIsTheirBeasts: boolean }[] = [];
/** The Creature pool, by terrain (content's). */
const POOL: Readonly<Record<string, readonly string[] | undefined>> = THE_WILD_CREATURES_BY_TERRAIN;
let turtles: Unit[] = [];
let kingsLines = '';

beforeAll(async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  const { KC_UNIT_CLASS, PRIMAL_ARMY_DEFS_P } = await import('../../src/content/kingdoms-call-data.ts');
  const DEFS: Readonly<Record<string, { readonly race: string } | undefined>> = PRIMAL_ARMY_DEFS_P;
  const king = (S: World, pi: number) => S.characters.find((c) => c.isKing === true && c.player === pi);
  const nbrs = (S: World, p: Province) =>
    (getNeighborsP(p, S.world.cols, S.world.rows, S.world.provinces) as (Province | null | undefined)[]).filter(
      (q): q is Province => q != null,
    );
  const beastOf = (p: Province) => (p.armyTypes ?? [])[0] ?? '';

  // ── Three worlds ──
  for (let k = 0; k < 3; k++) {
    // `as`: the engine's world, as the checks read it
    const S = sc.world({ realms: 3, cols: 14, rows: 8, seaPct: 30, alignments: ['Druidic', 'Neutral', 'Neutral'] })
      .S as unknown as World;
    const wild = S.world.provinces.filter(
      (p): p is Province => p != null && (p.race ?? '').startsWith('Primal:') && (p.armyTypes ?? []).length > 0,
    );
    const seas = wild.filter((p) => p.terrain === 'sea' && RICH.has(beastOf(p)));
    worlds.push({
      land: wild.filter((p) => p.terrain !== 'sea' && KC_UNIT_CLASS.creature.includes(beastOf(p))),
      seas,
      seasRaceIsTheirBeasts: seas.every(
        (p) =>
          p.race === 'Primal:' + String(DEFS[beastOf(p)]?.race) &&
          p.tax >= 4 &&
          p.tax <= 6 &&
          (p.neutralDefenders ?? []).every((d) => d.type === beastOf(p) && d.race === 'Primal'),
      ),
      seaWithALandBeast: wild.some(
        (p) => p.terrain === 'sea' && ['Great Bears', 'Unicorn Herd', 'Mammoth Host'].includes(beastOf(p)),
      ),
    });
  }

  // ── A turn: the turtles' waters ──
  const r = sc.turn<World, { nk: number }>({
    realms: 2,
    alignments: ['Druidic', 'Neutral'],
    prepare(S) {
      const dk = king(S, 0);
      const nk = king(S, 1);
      const [mine, theirs] = S.players;
      const H = S.world.provinces[mine?.homeProvinceId ?? -1];
      if (!dk || !nk || !mine || !theirs || !H) throw new Error('a realm has no king or no home');
      dk.skills = { ...dk.skills, druid: 3 };
      nk.skills = { ...nk.skills, druid: 4 };
      // The king in an owned forest beside home; the heir in an owned wild province; a Druid-1 hero in another.
      const take = (p: Province | undefined, race: string | null, types: string[] | null): Province => {
        if (!p) throw new Error('the home has too few land neighbours');
        S.players.forEach((pl) => {
          pl.provinces = (pl.provinces ?? []).filter((x) => x !== p.id);
        });
        p.owner = 0;
        (mine.provinces ??= []).push(p.id);
        p.neutralDefenders = [];
        p.npcArmies = 0;
        if (race !== null && types !== null) {
          p.race = race;
          p.armyTypes = types;
        }
        return p;
      };
      const around = nbrs(S, H).filter((p) => p.terrain !== 'sea');
      const forest = take(around[0], null, null);
      forest.terrain = 'forest';
      delete forest._awakenTurn;
      const wild1 = take(around[1], 'Primal:Stone Giant', ['Stone Giants']);
      const wild2 = take(around[2], 'Primal:Forest Ent', ['Forest Ents']);
      // (each a hero as a save holds one, a number for his id)
      const clone = (from: Character, name: string, druid: number, loc: number) => {
        const id = Math.max(...S.characters.map((c) => c.id)) + 1;
        // `as`: a copy of a hero, as the save holds him
        const c = {
          ...(JSON.parse(JSON.stringify(from)) as Character),
          id,
          name,
          isKing: false,
          armies: [],
          items: [],
          location: loc,
          skills: { druid, melee: 1 },
        };
        S.characters.push(c);
        return c;
      };
      clone(dk, 'Rowan of the Deep Wood', 3, wild1.id);
      clone(dk, 'Tamsin Greenhand', 1, wild2.id);
      dk.location = forest.id;
      mine.gold = 60;
      // The Neutral king stands in his own prosperous sea, the turtles' waters, with no hull under him.
      const sea = S.world.provinces.find(
        (p): p is Province => p?.terrain === 'sea' && nbrs(S, p).every((n) => n.owner !== 0),
      );
      if (!sea) throw new Error('no sea away from realm 0');
      S.players.forEach((pl) => {
        pl.provinces = (pl.provinces ?? []).filter((x) => x !== sea.id);
      });
      sea.owner = 1;
      (theirs.provinces ??= []).push(sea.id);
      sea.race = 'Primal:Great Turtle';
      sea.armyTypes = ['Great Turtles'];
      sea.neutralDefenders = [];
      sea.npcArmies = 0;
      sea.tax = 5;
      nk.location = sea.id;
      nk.armies = [];
      theirs.gold = 40;
      return { nk: nk.id };
    },
    orders: (_S, x) => ({ [x.nk]: plan(order('recruit', 'Great Turtles|1')) }),
  });
  // `as`: the world after the turn, as the checks read it
  const after = r.S2 as unknown as World;
  turtles = (after.characters.find((c) => c.id === r.extra.nk)?.armies ?? []).filter((a) => a.type === 'Great Turtles');
  kingsLines = r.text(r.extra.nk);
});

describe('three worlds', () => {
  test("every Creature province's beast is in its terrain's pool", () => {
    for (const w of worlds)
      expect(w.land.filter((p) => !(POOL[p.terrain] ?? []).includes((p.armyTypes ?? [])[0] ?? ''))).toEqual([]);
  });
  test("the prosperous seas carry their beast's race, tax 4–6 and its own defenders", () => {
    for (const w of worlds) expect(w.seasRaceIsTheirBeasts).toBe(true);
  });
  test('no sea holds a land Creature', () => {
    for (const w of worlds) expect(w.seaWithALandBeast).toBe(false);
  });
  test('the Great Turtles appear in the prosperous seas', () => {
    expect(
      worlds.reduce((n, w) => n + w.seas.filter((p) => (p.armyTypes ?? [])[0] === 'Great Turtles').length, 0),
    ).toBeGreaterThanOrEqual(1);
  });
  test('the three worlds dealt enough Creature provinces to mean something', () => {
    expect(worlds.reduce((n, w) => n + w.land.length, 0)).toBeGreaterThanOrEqual(10);
  });
});

describe("a turn: the turtles' waters", () => {
  test('the Neutral king recruits one company of Great Turtles in his own waters', () => {
    expect(
      turtles.length,
      kingsLines
        .split('\n')
        .filter((l) => /Turtle|recruit/i.test(l))
        .slice(0, 2)
        .join(' | '),
    ).toBe(1);
  });
  test('the turtles swim beside their king: nothing is stranded', () => {
    expect(kingsLines).not.toMatch(/too few hulls|left holding/);
  });
  test('the turtles have a company name', () => {
    expect(turtles.length).toBeGreaterThan(0);
    expect(turtles.every((a) => typeof a.unitName === 'string' && a.unitName.startsWith('the '))).toBe(true);
  });
});
