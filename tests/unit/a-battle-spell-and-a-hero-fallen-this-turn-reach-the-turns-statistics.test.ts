// 2026-10-09 (Toby item 5): a spell worked in a battle reaches the turn's statistics (and so the Hall of Fame's spell
// records), and a hero who fell this turn is in his realm's end-of-turn snapshot. Only the Cast order logged a cast, so
// pre-battle and duel magic never counted. That each realm's statistics row, as the GM page writes it, carries the
// battle cast and the Imperial Titles it holds is tests/page/the-gm-page-writes-each-realms-statistics-with-its-
// battle-spells-and-titles.test.ts.
//
// Level 1 (unit): combatVsNPC called directly on a world the engine makes from KC_SEED (no turn is played), its record
// read through the views' theStatisticsOfTheTurn, as buildReports reads it for the shell; telRealmSnapshot called on a
// world with a hero staged as fallen this turn. Not lower: the cast is made inside the battle, from its plan and its
// dice. The battle: realm 0's king, an Elemental master (Elemental 5) whose battle plan opens with a cast of his school,
// at the head of two Elite companies, against a guard made by the test (no skill, two Green companies) on a free
// plain; the cast is attempted whatever its roll (the record keeps the roll's outcome). Since P1-21h, the same cast in a
// battle between two heroes' hosts (combatVsChar, tests/lib/a-battle-called-directly.ts) against realm 1's king, every
// die 0.5: the record's chance and outcome are the cast line's (80%, a roll of 51: it works), never swapped.
//
// Until plan P1-14c this was the first half of tests/battle-spells-recorded.test.js, a whole turn in the engine's bare
// vm (seed 1 only), which read the turn's statistics as buildReports handed them on.
import '../lib/the-whole-engine.ts';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { KC_SEASONS } from '../../src/content/kingdoms-call-data.ts';
import { kcRng } from '../../src/engine/rng.ts';
import { generateBotSetups, isBotRow } from '../../src/engine/bots/setup.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { createTurnContext, type TurnTelemetry } from '../../src/engine/turn/context.ts';
import { combatVsNPC } from '../../src/engine/battle/battles-against-province-defenders.ts';
import { telRealmSnapshot } from '../../src/engine/turn/log-line-helpers.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import { theWordsOf } from '../../src/views/prose/the-words-of-each-line.ts';
import { theStatisticsOfTheTurn } from '../../src/views/the-statistics-of-the-turn.ts';
import { addTheFieldsResolveTurnAdds } from '../lib/the-fields-resolve-turn-adds-to-the-turns-context.ts';
import {
  aBattleBetweenHeroes,
  aFieldAndTheGroundBesideIt,
  attackFrom,
  aWorld as aWorldForABattle,
  companies,
  MELEE_AND_NO_DUEL,
  own,
  place,
  theTurnsContext,
} from '../lib/a-battle-called-directly.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

// The GM's log echoes each line on the console: quiet while the battle writes lines.
const consoleLog = console.log;
beforeAll(() => {
  console.log = () => undefined;
});
afterAll(() => {
  console.log = consoleLog;
});

interface Character {
  id: number;
  name: string;
  player: number | null;
  isKing?: boolean;
  alive: boolean;
  killedThisTurn?: boolean;
  location: number;
  armies?: { type: string; quality: string; unitName: string }[];
  skills?: Record<string, number>;
  encounterPlan?: { tactics: string[] };
  [key: string]: unknown;
}
interface Province {
  id: number;
  name: string;
  terrain: string;
  owner: number | null;
  characters: number[];
  [key: string]: unknown;
}
interface World {
  turn: number;
  characters: Character[];
  players: unknown[];
  world: { cols: number; rows: number; provinces: Province[] };
}

/** A world of two bot realms, made by the engine from KC_SEED. */
function aWorld(): World {
  kcRng.seed(SEED);
  const setups = (generateBotSetups([], 2, 0) as Record<string, unknown>[]).map((b) => ({
    ...b,
    gamePlayerId: 'gp' + String(b['id']),
    name: b['kingdomName'],
  }));
  const quiet = console.warn;
  console.warn = () => undefined;
  try {
    return JSON.parse(JSON.stringify(generateNewGame(setups, { cols: 10, rows: 6 }, 999, { seaPct: 10 }))) as World;
  } finally {
    console.warn = quiet;
  }
}

test("a spell worked in a battle is in the turn's spell statistics, with its spell, chance and outcome", () => {
  const G = aWorld();
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
  tc._currentPhase = 0;
  tc._logCtx.phase = 0;
  const king = G.characters.find((c) => c.alive && c.player === 0 && c.isKing);
  const field = G.world.provinces.find((p) => p.terrain !== 'sea' && p.owner === null);
  if (!king || !field) throw new Error('the world has no king in realm 0, or no free land province');
  const from = G.world.provinces[king.location];
  if (from) from.characters = from.characters.filter((id) => id !== king.id);
  G.characters = G.characters.filter((c) => c.player != null || c.location !== field.id);
  Object.assign(field, {
    terrain: 'plain',
    characters: [king.id],
    features: [],
    garrisonArmies: [],
    npcArmies: 0,
    neutralDefenders: [],
  });
  king['_attackedFrom'] = king.location;
  king.location = field.id;
  // An Elemental master with a battle plan that opens with a cast of his school.
  king.skills = { ...king.skills, elemental: 5 };
  king.encounterPlan = { tactics: ['CS:elemental', 'ME', 'ME', 'ME', 'ME'] };
  king.armies = ['the Red Hand', 'the Grey Company'].map((unitName) => ({
    type: 'Men-at-Arms',
    quality: 'Elite',
    unitName,
  }));
  const guard: Character = {
    id: Math.max(...G.characters.map((c) => c.id)) + 1,
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
    location: field.id,
    locationName: field.name,
    _isNeutralGuard: true,
    armies: [
      { type: 'Militia', quality: 'Green', unitName: 'Testcairn Levy' },
      { type: 'Militia', quality: 'Green', unitName: 'Testcairn Levy II' },
    ],
  };
  G.characters.push(guard);
  field.characters.push(guard.id);
  field['neutralDefenders'] = [...(guard.armies ?? [])];
  const { narrative } = combatVsNPC(...([tc, king, field, guard] as unknown as Parameters<typeof combatVsNPC>)) as {
    narrative: NarrativeLine[];
  };
  expect(
    narrative.map((l) => theWordsOf(l)).join('\n'),
    'the king worked battle magic before the fight (staging check)',
  ).toMatch(/Pre-battle Magic/);
  const spells = theStatisticsOfTheTurn(tc['_tel'] as TurnTelemetry).spells.filter(
    (s) => 'ctx' in s && s.ctx === 'battle' && s.pi === 0,
  );
  expect(spells.length, "the battle cast is in the turn's spell statistics").toBeGreaterThan(0);
  for (const s of spells) {
    expect(typeof s.spell, '…with its spell').toBe('string');
    expect(Number.isFinite(s.chance), '…its chance').toBe(true);
    expect(typeof s.ok, '…and its outcome').toBe('boolean');
  }
});

test("a spell worked before a battle against another hero's host is recorded with the cast line's chance and outcome", () => {
  const G = aWorldForABattle(SEED);
  const tc = theTurnsContext(G);
  G.relations['0-1'] = 'enemy';
  const [A, B] = [0, 1].map((pi) => G.characters.find((c) => c.alive && c.isKing && c.player === pi));
  if (!A || !B) throw new Error('the world has no king in realm 0 or 1');
  const { field, from } = aFieldAndTheGroundBesideIt(G, { terrain: 'plain' });
  own(G, field, 1);
  own(G, from, 0);
  for (const c of [A, B]) {
    c.items = [];
    c.armies = companies('Men-at-Arms', 2, 'Average');
    c.encounterPlan = MELEE_AND_NO_DUEL();
  }
  // An Elemental master (80%) with a battle plan that opens with a cast of his school.
  A.skills = { ...A.skills, elemental: 5 };
  A.encounterPlan = { tactics: ['CS:elemental', 'ME', 'ME', 'ME', 'ME'], duelStance: 'refuse' };
  place(G, B, field);
  attackFrom(G, A, from, field);
  const was = kcRng.use(() => 0.5);
  let narrative: readonly NarrativeLine[];
  try {
    ({ narrative } = aBattleBetweenHeroes(tc, A, B, field));
  } finally {
    kcRng.use(was);
  }
  const cast = narrative.find((l) => l.kind === 'the caster casts a spell before the battle');
  expect(cast, 'the king worked battle magic before the fight (staging check)').toMatchObject({
    casterName: A.name,
    castChance: 80,
    castRoll: 51,
  });
  const spells = theStatisticsOfTheTurn(tc['_tel'] as TurnTelemetry).spells.filter(
    (s) => 'ctx' in s && s.ctx === 'battle' && s.pi === 0,
  );
  expect(spells.map((s) => ({ chance: s.chance, ok: s.ok }))).toEqual([{ chance: 80, ok: true }]);
});

test("a hero who fell this turn is in his realm's snapshot, with his skills, and not among the living", () => {
  const gs = aWorld();
  const victim =
    gs.characters.find((c) => c.player === 1 && c.alive && !c.isKing) ??
    gs.characters.find((c) => c.player === 1 && c.alive);
  if (!victim) throw new Error('realm 1 has no hero');
  victim.alive = false;
  victim.killedThisTurn = true;
  victim.skills = { ...victim.skills, melee: 7 };
  const snap = telRealmSnapshot(gs as unknown as Parameters<typeof telRealmSnapshot>[0], 1);
  expect(
    snap?.fallen?.find((c) => c.id === victim.id)?.skills['melee'],
    "a hero who fell this turn is in his realm's snapshot, with his skills",
  ).toBe(7);
  expect(
    snap?.characters.some((c) => c.id === victim.id),
    '…and not among the living',
  ).toBe(false);
});
