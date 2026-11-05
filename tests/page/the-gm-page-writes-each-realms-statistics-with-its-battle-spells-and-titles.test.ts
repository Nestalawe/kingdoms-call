// 2026-10-09 (Toby item 5): the statistics row the GM page writes for each realm at the end of a turn (turn_events,
// which the Hall of Fame's records read) carries the spells its heroes worked in a battle, and the Imperial Titles the
// realm holds, every turn. Only the Cast order logged a cast, so pre-battle and duel magic never counted; the Hall of
// Fame kept only the holders at the end of the game. The battle's record in the turn's statistics, and a hero fallen
// this turn in his realm's snapshot, are tests/unit/a-battle-spell-and-a-hero-fallen-this-turn-reach-the-turns-
// statistics.test.ts.
//
// Level 4 (page): the rows are written by the GM page's own code (db/telemetry.ts's writeTurnTelemetry, called by the
// turn's shell once the page has found the statistics tables), so only the booted page writes them: lib/scenario.js
// boots it in jsdom on the stand-in database, with bootScenario({ telemetry: true }), and plays one real turn there
// (its page's dice from KC_SEED). The turn: realm 0's king, an Elemental master (Elemental 5) whose battle plan opens
// with a cast of his school, at the head of two Elite companies, marches on a guard made by the test (no skill, two
// Green companies) alone in a free land province beside a land province of realm 0's, where the king is put. The titles
// a realm holds are the engine's standings on the world the turn saved (computeStandings, imported from its module).
//
// Until plan P1-14c this was the second half of tests/battle-spells-recorded.test.js, which cut the writer out of
// db/telemetry.ts by its syntax tree (tests/lib/source.ts) and ran it in the engine's bare vm, on a stand-in database
// of its own, for a world after a turn played there (seed 1 only).
import '../lib/the-whole-engine.ts';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { computeStandings } from '../../src/engine/titles/reckoning.ts';
import { bootScenario, order, plan, type Scenario, type Turn } from '../lib/scenario.js';

interface Province {
  id: number;
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
  items?: unknown[];
  skills?: Record<string, number>;
  armies?: { type: string; quality: string; unitName: string }[];
  encounterPlan?: { tactics: string[] };
  [key: string]: unknown;
}
interface World {
  players: { provinces: number[] }[];
  characters: Character[];
  world: { cols: number; rows: number; provinces: Province[] };
}
/** One realm's row of turn_events, as the page writes it (the parts read here). */
interface StatisticsRow {
  player_index: number;
  post: { titles?: { key: string; merit: number }[] } | null;
  outcomes: { spells: { list: { ctx?: string; spell: unknown; chance: unknown; ok: unknown }[] } };
}

let sc: Scenario;
let r: Turn<World, { king: Character; N: number }>;
beforeAll(async () => {
  sc = await bootScenario({ telemetry: true });
  const W = sc.W;
  const land = (p: Province | null | undefined): p is Province => p != null && p.terrain !== 'sea';
  const neighbours = (S: World, p: Province) =>
    (W.getNeighborsP(p, S.world.cols, S.world.rows, S.world.provinces) as (Province | null)[]).filter(land);
  r = await sc.turn<World, { king: Character; N: number }>({
    realms: 2,
    cols: 10,
    rows: 6,
    seaPct: 10,
    prepare(S) {
      const king = S.characters.find((c) => c.alive && c.player === 0 && c.isKing);
      // N: a free land province (no realm's) beside a land province P, the first such; P made realm 0's, the king put
      // there. Everyone else in either is taken off the map.
      const N = S.world.provinces.find(
        (q) => land(q) && q.owner == null && neighbours(S, q).some((y) => y.id !== q.id),
      );
      const P = N && neighbours(S, N).find((y) => y.id !== N.id);
      if (!king || !N || !P) throw new Error('could not stage: no king, or no free land province beside land');
      S.characters = S.characters.filter((c) => c.player != null || (c.location !== N.id && c.location !== P.id));
      [N, P].forEach((p) => {
        p.characters = (p.characters ?? []).filter((id) => S.characters.some((c) => c.id === id));
      });
      S.players.forEach((pl) => {
        pl.provinces = pl.provinces.filter((id) => id !== P.id);
      });
      P.owner = 0;
      S.players[0]?.provinces.push(P.id);
      Object.assign(P, { neutralDefenders: [], npcArmies: 0, features: [], garrisonArmies: [] });
      Object.assign(N, { neutralDefenders: [], npcArmies: 0, features: [], garrisonArmies: [] });
      S.world.provinces.forEach((q) => {
        q.characters = (q.characters ?? []).filter((id) => id !== king.id);
      });
      P.characters = [...(P.characters ?? []), king.id];
      king.location = P.id;
      king.locationName = P.name;
      const id = Math.max(...S.characters.map((c) => c.id)) + 1;
      S.characters.push({
        id,
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
        armies: [
          { type: 'Militia', quality: 'Green', unitName: 'Testcairn Levy' },
          { type: 'Militia', quality: 'Green', unitName: 'Testcairn Levy II' },
        ],
      });
      N.characters = [...(N.characters ?? []), id];
      // An Elemental master with a battle plan that opens with a cast of his school.
      king.skills = { ...king.skills, elemental: 5 };
      king.encounterPlan = { tactics: ['CS:elemental', 'ME', 'ME', 'ME', 'ME'] };
      king.items = [];
      king.armies = ['the Red Hand', 'the Grey Company'].map((unitName) => ({
        type: 'Men-at-Arms',
        quality: 'Elite',
        unitName,
      }));
      return { king, N: N.id };
    },
    orders: (_S, x) => ({ [x.king.id]: plan(order('move', x.N)) }),
  });
});
afterAll(() => {
  sc.W.close();
});

test('the page writes a statistics row for each realm, with no page error', () => {
  expect(r.S2, 'the turn resolved and saved').toBeTruthy();
  expect(r.text(), 'the king worked battle magic before the fight (staging check)').toMatch(/Pre-battle Magic/);
  expect((r.events as StatisticsRow[]).map((x) => x.player_index).sort(), 'a statistics row for each realm').toEqual([
    0, 1,
  ]);
  expect(sc.errs, 'no page error').toEqual([]);
});

test("the battle cast is in its realm's row, with its spell, chance and outcome", () => {
  const row = (r.events as StatisticsRow[]).find((x) => x.player_index === 0);
  const casts = (row?.outcomes.spells.list ?? []).filter((s) => s.ctx === 'battle');
  expect(casts.length, "the battle cast is in realm 0's row").toBeGreaterThan(0);
  for (const s of casts) {
    expect(typeof s.spell, '…with its spell').toBe('string');
    expect(Number.isFinite(s.chance), '…its chance').toBe(true);
    expect(typeof s.ok, '…and its outcome').toBe('boolean');
  }
});

test("each Imperial Title held is in its holder's row this turn", () => {
  const standings = computeStandings(r.S2 as Parameters<typeof computeStandings>[0]) as {
    titles?: Record<string, { playerIndex?: number | null; merit: number } | null>;
  };
  const held = Object.entries(standings.titles ?? {}).filter(
    (e): e is [string, { playerIndex: number; merit: number }] => e[1]?.playerIndex != null && e[1].merit > 0,
  );
  expect(held.length, 'some title has a holder in the staged world (staging check)').toBeGreaterThan(0);
  for (const [key, h] of held) {
    const row = (r.events as StatisticsRow[]).find((x) => x.player_index === h.playerIndex);
    expect(
      (row?.post?.titles ?? []).some((t) => t.key === key && t.merit > 0),
      `the ${key} title is in its holder's row this turn`,
    ).toBe(true);
  }
});
