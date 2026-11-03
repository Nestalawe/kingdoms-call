// 2026-10-13 (item 6): a hero who raises a skill in the single combat before a battle is told so in plain words,
// straight after that battle's report: "📈 …'s Melee rises to level 4 through hard-won experience in single combat with
// <the general> before the Battle for <province>." The duel itself is folded inside the battle's full report, so the
// short account alone never said why. The line stays the owner's own news.
//
// Level 2 (scenario): the duel, the skill-rise draw and the end-of-phase report all live inside the turn, played on the
// engine's modules (tests/lib/a-staged-turn-on-the-engines-modules.ts), on a world made from KC_SEED. The rise is made
// certain, and every other one impossible, by a stand-in on the experience roll (trySkillGain, a vi.spyOn on
// engine/heroes/experience-skill-rises-and-earned-hp.ts, which the duel calls from another file): the hero's Melee
// rolls at an endless multiplier (a chance of 1), and nobody else rolls at all. The stand-in is shown reached by the
// rise itself (without it no rise is certain) and by its own record of the hero's roll. The chieftain is chosen and
// set by the staging, on every world: a neutral guard made by the test (no skill, Brave) alone in a free land province
// beside a land province, where the hero is put with Melee 3, a Challenge stance, three Elite companies and some 200
// earned hit points, which the chieftain can't take from him in a duel's 20 rounds (the engine gives the chieftain the
// hit points his race starts with, whatever the staging sets: 15 for a man); so the hero wins the duel and lives, and
// the outcome does not depend on the dice. (The old script set the chieftain's hit points to 2, which the engine raised
// to 15; on seed 12 of 1 to 100 the hero fell in the duel, and his rise was told where he fell, before the battle.)
//
// Until plan P1-14c this was tests/duel-skill-rise.test.js, the same turn in the engine's bare vm (seed 1 only), the
// roll stood in there; and it chose a chieftain the world had.
import { expect, test, vi } from 'vitest';
import { aStagedTurnOnTheEnginesModules, order, plan, type Line } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface Province {
  id: number;
  row: number;
  col: number;
  name: string;
  terrain: string;
  owner?: number | null;
  characters?: number[];
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
  armies?: { type: string; quality: string; unitName: string }[];
  encounterPlan?: { tactics: string[]; duelStance: string };
  [key: string]: unknown;
}
interface World {
  characters: Character[];
  world: { cols: number; rows: number; provinces: Province[] };
}

test('a Melee risen in the duel before a battle is told straight after the battle, to the owner alone', async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const experience = await import('../../src/engine/heroes/experience-skill-rises-and-earned-hp.ts');
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  // The hero's Melee rises for certain; nobody else's (a chieftain duel allows one advance).
  const tryOne = experience.trySkillGain;
  const theHerosRolls: string[] = [];
  vi.spyOn(experience, 'trySkillGain').mockImplementation(
    (...[turnContext, char, skill, base, narr]: Parameters<typeof tryOne>) => {
      const c = char as Character | null | undefined;
      if (skill !== 'melee' || c?.player !== 0) return;
      theHerosRolls.push(c.name);
      tryOne(turnContext, char, skill, base, narr, Infinity);
    },
  );

  const land = (p: Province | null | undefined): p is Province => p != null && p.terrain !== 'sea';
  const place = (S: World, c: Character, p: Province) => {
    S.world.provinces.forEach((q) => {
      q.characters = (q.characters ?? []).filter((id) => id !== c.id);
    });
    p.characters = [...(p.characters ?? []), c.id];
    c.location = p.id;
    c.locationName = p.name;
  };
  const r = sc.turn<World, { H: Character; N: Province; g: Character }>({
    cols: 10,
    rows: 6,
    seaPct: 10,
    prepare(S) {
      const H = S.characters.find((c) => c.alive && c.player === 0 && !c.isKing);
      // The chieftain's province: a free land province (no realm's) beside a land province, the first such; the hero
      // is put beside it. Everyone else in either is taken off the map.
      const N = S.world.provinces.find(
        (q) =>
          land(q) &&
          q.owner == null &&
          (getNeighborsP(q, S.world.cols, S.world.rows, S.world.provinces) as (Province | null)[]).some(
            (y) => land(y) && y.id !== q.id,
          ),
      );
      const P =
        N &&
        (getNeighborsP(N, S.world.cols, S.world.rows, S.world.provinces) as (Province | null)[]).find(
          (y): y is Province => land(y) && y.id !== N.id,
        );
      if (!H || !N || !P) throw new Error('could not stage: no hero, or no free land province beside land');
      S.characters = S.characters.filter((c) => c.player != null || (c.location !== N.id && c.location !== P.id));
      [N, P].forEach((p) => {
        p.characters = (p.characters ?? []).filter((id) => S.characters.some((c) => c.id === id));
      });
      Object.assign(N, { neutralDefenders: [], npcArmies: 0, features: [], garrisonArmies: [] });
      const id = Math.max(...S.characters.map((c) => c.id)) + 1;
      const g: Character = {
        id,
        name: 'Warden Testcairn',
        isKing: false,
        player: null,
        race: 'Human',
        alignment: 'Neutral',
        temper: 'Brave',
        hp: 15,
        maxHp: 15,
        hpEarned: 0,
        skills: { melee: 0, archery: 0 },
        aptitude: {},
        items: [],
        alive: true,
        merits: 0,
        taxBonus: 0,
        spellsUsedThisTurn: [],
        location: N.id,
        locationName: N.name,
        _isNeutralGuard: true,
        armies: [{ type: 'Militia', quality: 'Green', unitName: 'Testcairn Levy' }],
      };
      S.characters.push(g);
      N.characters = [...(N.characters ?? []), id];
      N['neutralDefenders'] = [...(g.armies ?? [])];
      N['npcArmies'] = 1;
      place(S, H, P);
      H.items = [];
      H.skills = { ...H.skills, melee: 3, archery: 0 };
      // Far more hit points than the chieftain can take from him in a duel's 20 rounds (the engine brings them in line
      // with what he has earned, so they are set as earned): a hero who fell would have his rise told where he fell.
      H['hpEarned'] = 200;
      H['hp'] = H['maxHp'] = 999;
      H.encounterPlan = { tactics: ['ME', 'ME', 'ME', 'ME', 'ME'], duelStance: 'challenge' };
      H.armies = ['the Red Hand', 'the Grey Company', 'the Oak Shields'].map((unitName) => ({
        type: 'Men-at-Arms',
        quality: 'Elite',
        unitName,
      }));
      return { H, N, g };
    },
    orders: (_S, c) => ({ [c.H.id]: plan(order('move', c.N.id)) }),
  });
  const H = r.extra.H;
  const N = (r.S2['world'] as World['world']).provinces[r.extra.N.id];
  const foe = r.extra.g.name.replace(/\s*\(wandering\)/i, '');
  const L: Line[] = r.log;
  const textOf = (e: Line) => e.text ?? '';
  expect(
    L.some((e) => textOf(e).includes('Personal duel:') && textOf(e).includes(H.name)),
    'the hero fights the chieftain in single combat before the battle',
  ).toBe(true);
  expect(theHerosRolls, "the stand-in is reached: the hero's Melee is rolled").toContain(H.name);
  const i = L.findIndex((e) => /^📈 .+'s Melee rises to level 4/.test(textOf(e)) && e.charId === H.id);
  expect(i, "the hero's Melee rises (the roll is made certain)").toBeGreaterThanOrEqual(0);
  const line = L[i] ?? { text: '' };
  expect(textOf(line), 'the line says why').toContain(
    `in single combat with ${foe} before the Battle for ${N?.name ?? '?'}`,
  );
  const lastBattle = L.reduce(
    (a, e, j) => (e['battleId'] != null && e['provinceId'] === N?.id && e.phase === 0 ? j : a),
    -1,
  );
  expect(lastBattle, "the battle's report is in the log").toBeGreaterThanOrEqual(0);
  expect(i, `it comes straight after the battle's report (battle ends at ${String(lastBattle)})`).toBe(lastBattle + 1);
  expect(line['targets'], "it is the owner's news alone").toEqual([H.player]);
  expect(line['public'], '…and not public').toBeFalsy();
  const rep = ((r.reports[H.player ?? -1]?.['lastTurnLog'] ?? []) as Line[]).map(textOf);
  expect(rep, "the line reaches the owner's turn report").toContain(textOf(line));
  expect(
    L.some((e) => textOf(e).includes('rises to level') && /undefined|NaN/.test(textOf(e))),
    'no undefined / NaN in the rise lines',
  ).toBe(false);
});
