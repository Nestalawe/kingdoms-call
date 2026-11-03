// 2026-10-09 (Toby item 1): every hero has at least one line in every season of his realm's report. A hero who
// marched in Fall with a friendly hero and was pulled into that hero's assault on a neutral-guarded province
// (Contingent unify) had no Fall line at all: the unify and the battle were filed under the hero who led the march,
// and the "order superseded" note fell into Realm Events. Here realm 0's king and a second hero of his (made by the
// test), both March 5 and standing in one province of their realm, march in Fall onto the free land province beside
// it, held by a guard made by the test with one Green company: they are sure to unify (March 5 from the same start).
// Every living hero of realm 0 has a line in each of the five seasons of the realm's report, and the joining hero's
// Fall line says he marched with the other hero's host.
//
// Level 2 (scenario): the unify, the superseded order and the report's filing are all inside the turn, and the check
// spans its five seasons; played on the engine's modules (tests/lib/a-staged-turn-on-the-engines-modules.ts) on a world
// made from KC_SEED. The scene is set by the staging on every world: the first free land province beside free land,
// both cleared of every other character; the king and his hero each lead six Elite Men-at-Arms (in the old script, a
// copy of whatever the king was dealt), so both win and live whatever the dice.
//
// Until plan P1-14e this was tests/hero-every-phase.test.js, a turn on the GM page (lib/scenario.js) beside the
// king's capital. Its checks are kept as they were; its two staging checks (a free land province beside the capital,
// the king leads an army) are the staging's own throw, and "no page errors" is "throws nothing" (an unexpected
// console.error fails the test: setup/each.ts).
import { expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules, order, plan, type Line } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
const SEASONS = ['Spring', 'Early Summer', 'Late Summer', 'Fall', 'Early Winter'];

interface Province {
  id: number;
  row: number;
  col: number;
  name: string;
  terrain: string;
  owner: number | null;
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
  skills?: Record<string, number>;
  armies?: { type: string; quality: string; unitName: string }[];
  [key: string]: unknown;
}
interface World {
  players: { provinces: number[] }[];
  characters: Character[];
  world: { cols: number; rows: number; provinces: Province[] };
}

const six = (name: string) =>
  Array.from({ length: 6 }, (_, i) => ({
    type: 'Men-at-Arms',
    quality: 'Elite',
    unitName: `${name} ${String(i + 1)}`,
  }));

test("a hero pulled into a friend's Fall assault has a Fall line of his own, and every hero a line in every season", async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  const r = sc.turn<World, { king: Character; ally: Character; N: Province }>({
    realms: 2,
    cols: 10,
    rows: 6,
    prepare(S) {
      const king = S.characters.find((c) => c.alive && c.player === 0 && c.isKing);
      const aRealmsHeroIn = (p: Province) => S.characters.some((c) => c.player != null && c.location === p.id);
      const free = (p: Province | null | undefined): p is Province =>
        p != null && p.terrain !== 'sea' && p.owner == null && !aRealmsHeroIn(p);
      const beside = (p: Province) =>
        (getNeighborsP(p, S.world.cols, S.world.rows, S.world.provinces) as (Province | null)[]).find(
          (q): q is Province => free(q) && q.id !== p.id,
        );
      const N = S.world.provinces.find((p) => free(p) && beside(p) !== undefined);
      const P = N && beside(N);
      if (!king || !N || !P) throw new Error('could not stage: no king, or no free land province beside free land');
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
      // N: one made-up guard with a small band.
      const nextId = Math.max(...S.characters.map((c) => c.id)) + 1;
      const guard: Character = {
        id: nextId,
        name: 'Warden Testcairn',
        isKing: false,
        player: null,
        race: 'Human',
        alignment: 'Neutral',
        hp: 10,
        maxHp: 10,
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
        armies: [{ type: 'Militia', quality: 'Green', unitName: 'Testcairn Levy' }],
      };
      S.characters.push(guard);
      N.characters = [...(N.characters ?? []), guard.id];
      // A second hero of realm 0 stands with the king; both are sure to unify (March 5, same start).
      const ally = JSON.parse(JSON.stringify(king)) as Character;
      Object.assign(ally, { id: nextId + 1, name: 'Sir Testwick', isKing: false });
      S.characters.push(ally);
      for (const c of [king, ally]) {
        S.world.provinces.forEach((q) => {
          q.characters = (q.characters ?? []).filter((id) => id !== c.id);
        });
        P.characters = [...(P.characters ?? []), c.id];
        c.location = P.id;
        c.locationName = P.name;
        c.skills = { ...(c.skills ?? {}), march: 5 };
      }
      king.armies = six('King Company');
      ally.armies = six('Tester Company');
      return { king, ally, N };
    },
    orders(_S, x) {
      const mv = order('move', x.N.id);
      return {
        [x.king.id]: plan(order('rest'), order('rest'), order('rest'), mv),
        [x.ally.id]: plan(order('rest'), order('rest'), order('rest'), mv),
      };
    },
  });
  expect(r.S2, 'the turn resolved and saved').toBeTruthy();
  expect(r.text(), 'the two heroes unified for the Fall assault (staging check)').toMatch(/Contingent unify/);

  const lines = (r.reports[0]?.['lastTurnLog'] ?? []) as Line[];
  expect(lines.length, 'realm 0 received a report').toBeGreaterThan(0);
  const heroes = (r.S2['characters'] as Character[]).filter((c) => c.player === 0 && c.alive);
  expect(heroes.length, "both of realm 0's heroes are alive and in the report").toBeGreaterThanOrEqual(2);
  expect(
    heroes.map((h) => h.id),
    'the king and the joining hero are among them',
  ).toEqual(expect.arrayContaining([r.extra.king.id, r.extra.ally.id]));
  for (const h of heroes)
    SEASONS.forEach((season, ph) => {
      const n = lines.filter((e) => e.charId === h.id && e.phase === ph).length;
      expect(n, `${h.name} has a line in ${season} (got ${String(n)})`).toBeGreaterThan(0);
    });
  const allyFall = lines
    .filter((e) => e.charId === r.extra.ally.id && e.phase === 3)
    .map((e) => e.text)
    .join('\n');
  expect(allyFall, "the joining hero's Fall says he marched with the other hero's host").toMatch(/host|joins|unif/i);
});
