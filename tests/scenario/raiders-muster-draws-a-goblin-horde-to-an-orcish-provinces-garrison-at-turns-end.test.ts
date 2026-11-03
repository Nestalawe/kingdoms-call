// 2026-10-11 (Toby, the unit abilities; R-095): Raiders' Muster. An orcish province that saw an orc realm win there
// gains a Goblin Horde in its garrison at the turn's end, for nothing, and the realm is told (🥁); the battle's flag is
// cleared once read; a human realm's win in the same province musters nothing. Here realm 0's first hero (not its
// king; six Elite Orc Berserkers, or six Elite Men-at-Arms for a human realm) marches in Spring on an orcish plain held
// by a guard made by the test (one Green Goblin Horde), from his realm's province beside it; the win is not luck.
// The horde musters at Average; the end-of-turn garrison drill (a die roll, after the muster) may then raise it one
// level, and says so: either way exactly one named horde stands there, and a level above Average is allowed only with
// the drill's own line for it. Prepared Ground and Eyes of the Forest, the old script's other two abilities, are
// tests/unit/prepared-ground-and-eyes-of-the-forest-in-a-battle-against-a-province.test.ts.
//
// Level 2 (scenario): the battle sets the flag and Early Winter's pass at the turn's end reads it, so only a whole turn
// shows it; played on the engine's modules (tests/lib/a-staged-turn-on-the-engines-modules.ts) on a world made from
// KC_SEED. The scene is set by the staging on every world: the first free land province beside free land, both
// cleared of every other character.
//
// Until plan P1-14d this was the second half of tests/abilities-turn.test.js, turns on the GM page (lib/scenario.js)
// that searched the map for a guard the world had and fought on whatever ground it stood; its five checks are kept as
// they were, and "no page errors" is "throws nothing" (an unexpected console.error fails the test: setup/each.ts).
import { expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules, order, plan } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface Company {
  type: string;
  quality: string;
  unitName: string;
}
interface Province {
  id: number;
  row: number;
  col: number;
  name: string;
  terrain: string;
  owner: number | null;
  race?: string;
  characters?: number[];
  garrisonArmies?: Company[];
  _raidersMuster?: number;
  [key: string]: unknown;
}
interface Character {
  id: number;
  name: string;
  player: number | null;
  alive?: boolean;
  isKing?: boolean;
  location: number;
  locationName?: string;
  items?: unknown[];
  skills?: Record<string, number>;
  armies?: Company[];
  [key: string]: unknown;
}
interface World {
  players: { race?: string; provinces: number[] }[];
  characters: Character[];
  world: { cols: number; rows: number; provinces: Province[] };
}

/** Realm 0 (of `race`) wins an orcish plain from a guard made by the test with `host`; the world after the turn and
 *  every line of the turn. */
async function aWinOnAnOrcishPlain(race: string, host: Company[]) {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  const r = sc.turn<World, { H: Character; N: Province }>({
    cols: 10,
    rows: 6,
    seaPct: 10,
    prepare(S) {
      const H = S.characters.find((c) => c.alive && c.player === 0 && !c.isKing);
      const aRealmsHeroIn = (p: Province) => S.characters.some((c) => c.player != null && c.location === p.id);
      const free = (p: Province | null | undefined): p is Province =>
        p != null && p.terrain !== 'sea' && p.owner == null && !aRealmsHeroIn(p);
      const beside = (p: Province) =>
        (getNeighborsP(p, S.world.cols, S.world.rows, S.world.provinces) as (Province | null)[]).find(
          (q): q is Province => free(q) && q.id !== p.id,
        );
      const N = S.world.provinces.find((p) => free(p) && beside(p) !== undefined);
      const P = N && beside(N);
      if (!H || !N || !P) throw new Error('could not stage: no hero, or no free land province beside free land');
      S.characters = S.characters.filter((c) => c.player != null || (c.location !== N.id && c.location !== P.id));
      for (const p of [N, P]) {
        p.characters = (p.characters ?? []).filter((id) => S.characters.some((c) => c.id === id));
        Object.assign(p, { neutralDefenders: [], npcArmies: 0, features: [], garrisonArmies: [] });
      }
      S.players.forEach((pl) => {
        pl.provinces = pl.provinces.filter((id) => id !== P.id);
      });
      P.owner = 0;
      S.players[0]?.provinces.push(P.id);
      N.terrain = 'plain';
      N.race = 'Orcish';
      const realm0 = S.players[0];
      if (realm0) realm0.race = race;
      const guard: Character = {
        id: Math.max(...S.characters.map((c) => c.id)) + 1,
        name: 'Warden Testcairn',
        isKing: false,
        player: null,
        race: 'Human',
        alignment: 'Neutral',
        hp: 15,
        maxHp: 15,
        hpEarned: 0,
        skills: {},
        aptitude: {},
        items: [],
        alive: true,
        merits: 0,
        taxBonus: 0,
        spellsUsedThisTurn: [],
        location: N.id,
        locationName: N.name,
        _isNeutralGuard: true,
        armies: [{ type: 'Goblin Horde', quality: 'Green', unitName: 'Goblin Horde 1' }],
      };
      S.characters.push(guard);
      N.characters = [...(N.characters ?? []), guard.id];
      Object.assign(N, { neutralDefenders: [...(guard.armies ?? [])], npcArmies: 1 });
      S.world.provinces.forEach((q) => {
        q.characters = (q.characters ?? []).filter((id) => id !== H.id);
      });
      P.characters = [...(P.characters ?? []), H.id];
      H.location = P.id;
      H.locationName = P.name;
      H.items = [];
      H.skills = { ...H.skills, archery: 0 };
      H.armies = host;
      return { H, N };
    },
    orders: (_S, c) => ({ [c.H.id]: plan(order('move', c.N.id)) }),
  });
  const N2 = (r.S2['world'] as World['world']).provinces[r.extra.N.id];
  return { N2, all: r.log.map((e) => e.text).join('\n') };
}

const six = (type: string): Company[] =>
  Array.from({ length: 6 }, (_, i) => ({ type, quality: 'Elite', unitName: `${type} ${String(i + 1)}` }));
const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test("an orc realm's win in an orcish province draws a Goblin Horde to its garrison at the turn's end", async () => {
  const { N2, all } = await aWinOnAnOrcishPlain('Orcish', six('Orc Berserkers'));
  expect(N2?.owner, 'the orcs take the province').toBe(0);
  const garrison = N2?.garrisonArmies ?? [];
  const gob = garrison.filter((a) => a.type === 'Goblin Horde' && a.unitName.startsWith('the '));
  const drilled = (g: Company) =>
    new RegExp(
      '🎖 Garrison drills in [^\\n]*' +
        escaped(g.unitName) +
        ' \\(Goblin Horde\\) Average → \\*\\*' +
        g.quality +
        '\\*\\*',
    ).test(all);
  expect(
    gob.length === 1 && (gob[0]?.quality === 'Average' || (gob[0] !== undefined && drilled(gob[0]))),
    `one named Goblin Horde, mustered at Average, stands in its garrison at turn's end (got ${String(gob.length)}; garrison: ${
      garrison.map((a) => `${a.unitName} ${a.quality}`).join(', ') || 'empty'
    })`,
  ).toBe(true);
  expect(all, 'the realm is told of the muster').toMatch(
    /🥁 Raiders' Muster — word of the victory at .* draws the .* \(Goblin Horde, Average\) to its garrison for nothing\./,
  );
  expect(N2?._raidersMuster, "the battle's flag is cleared").toBeUndefined();
});

test('a human realm’s win in the same province musters nothing', async () => {
  const { N2, all } = await aWinOnAnOrcishPlain('Human', six('Men-at-Arms'));
  expect(
    N2?.owner === 0 &&
      !(N2.garrisonArmies ?? []).some((a) => a.type === 'Goblin Horde' && a.quality === 'Average') &&
      !all.includes("Raiders' Muster"),
    'no muster for a human victor',
  ).toBe(true);
});
