// A battle called directly (plan P1-14d, Decision 5): a world the engine makes from a seed, the turn's context as
// resolveTurn makes it before the first phase, an attacker staged on a field beside the ground he marched from, and
// the battle's lines in words. No turn is played: combatVsNPC (against a province's defenders, led by a guard made by
// the test) or combatVsChar (against a rival realm's hero) is called as the Move order calls it, and what it writes is
// read through the views' theWordsOf, as the turn's log reads it.
//
//   const G = aWorld(SEED);                                      // two bot realms on a 10×6 map, a tenth of it sea
//   const tc = theTurnsContext(G);                               // Spring (phase 0)
//   const { field, from } = aFieldAndTheGroundBesideIt(G, { terrain: 'plain' });
//   const guard = aGuardMadeByTheTest(G, field, companies('Militia', 2, 'Green'));
//   attackFrom(G, hero, from, field);
//   const { words } = aBattleAgainstTheProvince(tc, hero, field, guard);
//
// The dice are the engine's, seeded by aWorld: the world is made from them, and the battle draws on from there. A test
// that reads KC_SEED stages its battle so its outcome is the rule's, not the dice's (the odds overwhelming, or one
// target), and a sweep of seeds shows it (a diagnostic, not in CI). The engine's modules are imported once for the
// file (tests/lib/the-whole-engine.ts first): a world made after another in the same file is made from the same seed
// but the engine's name pools have moved on, so the staging never relies on a name or a place the world deals.
import './the-whole-engine.ts';
import { vi } from 'vitest';
import { KC_SEASONS } from '../../src/content/kingdoms-call-data.ts';
import { kcRng } from '../../src/engine/rng.ts';
import { generateBotSetups, isBotRow } from '../../src/engine/bots/setup.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { createTurnContext } from '../../src/engine/turn/context.ts';
import { getNeighborsP } from '../../src/engine/world/map-helpers.ts';
import { combatVsNPC } from '../../src/engine/battle/battles-against-province-defenders.ts';
import { combatVsChar } from '../../src/engine/battle/battles-between-heroes.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import { theWordsOf } from '../../src/views/prose/the-words-of-each-line.ts';
import { addTheFieldsResolveTurnAdds, type TurnContext } from './the-fields-resolve-turn-adds-to-the-turns-context.ts';

/** A company as the old scripts staged it: a type, a quality and a name, its race only where they gave one (the engine
 *  reads a company with none as of its commander's race). */
export interface Company {
  type: string;
  quality: string;
  unitName: string;
  race?: string;
  [key: string]: unknown;
}
export interface Character {
  id: number;
  name: string;
  player: number | null;
  isKing?: boolean;
  alive: boolean;
  location: number;
  locationName?: string;
  armies?: Company[];
  skills?: Record<string, number>;
  items?: unknown[];
  encounterPlan?: { tactics: string[]; duelStance?: string };
  [key: string]: unknown;
}
export interface Province {
  id: number;
  name: string;
  terrain: string;
  owner: number | null;
  row: number;
  col: number;
  characters?: number[];
  neutralDefenders?: Company[];
  garrisonArmies?: Company[];
  [key: string]: unknown;
}
export interface World {
  turn: number;
  relations: Record<string, string>;
  characters: Character[];
  players: { name: string; race?: string; alignment?: string; provinces: number[]; [key: string]: unknown }[];
  world: { cols: number; rows: number; provinces: Province[] };
}

/** The console quiet while `body` runs (the GM's log echoes each line the battle writes, and world-making warns). */
function quietly<T>(body: () => T): T {
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    return body();
  } finally {
    log.mockRestore();
    warn.mockRestore();
  }
}

/** A world of two bot realms, made by the engine on a 10×6 map, a tenth of it sea, the dice seeded `seed` first. */
export function aWorld(seed: number): World {
  kcRng.seed(seed);
  const setups = (generateBotSetups([], 2, 0) as Record<string, unknown>[]).map((b) => ({
    ...b,
    gamePlayerId: 'gp' + String(b['id']),
    name: b['kingdomName'],
  }));
  const G = JSON.parse(
    JSON.stringify(quietly(() => generateNewGame(setups, { cols: 10, rows: 6 }, 999, { seaPct: 10 }))),
  ) as World;
  G.relations = { ...G.relations };
  return G;
}

/** The turn's context on `G`, with the fields resolveTurn adds before the first phase, in the phase given. */
export function theTurnsContext(G: World, phase = 0): TurnContext {
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
  tc._currentPhase = phase;
  tc._logCtx.phase = phase;
  return tc;
}

/** `n` companies of the type and quality given, named "<type> 1", "<type> 2", … (as the old scripts named them). */
export const companies = (type: string, n: number, quality: string, race?: string): Company[] =>
  Array.from({ length: n }, (_, i) => ({
    type,
    quality,
    ...(race ? { race } : {}),
    unitName: `${type} ${String(i + 1)}`,
  }));

const neighbours = (G: World, p: Province) =>
  (getNeighborsP(p, G.world.cols, G.world.rows, G.world.provinces) as (Province | null)[]).filter(
    (q): q is Province => q != null && q.id !== p.id,
  );

/** The field and the ground beside it: the first province of no realm's (a sea province for `atSea`, else land) where
 *  no realm's hero stands, beside a land province of no realm's where none stands either. Everyone else in the two is
 *  taken off the map; the field is cleared of defenders, garrison and features and given the terrain asked for. */
export function aFieldAndTheGroundBesideIt(
  G: World,
  { terrain, atSea = false }: { terrain?: string; atSea?: boolean } = {},
): { field: Province; from: Province } {
  const aRealmsHeroIn = (p: Province) => G.characters.some((c) => c.player != null && c.location === p.id);
  const free = (p: Province) => p.owner == null && !aRealmsHeroIn(p);
  const fromOf = (p: Province) => neighbours(G, p).find((q) => q.terrain !== 'sea' && free(q));
  const field = G.world.provinces.find((p) => (p.terrain === 'sea') === atSea && free(p) && fromOf(p) !== undefined);
  const from = field && fromOf(field);
  if (!field || !from) throw new Error(`could not stage: no free ${atSea ? 'sea' : 'land'} province beside free land`);
  G.characters = G.characters.filter((c) => c.player != null || (c.location !== field.id && c.location !== from.id));
  for (const p of [field, from])
    p.characters = (p.characters ?? []).filter((id) => G.characters.some((c) => c.id === id));
  Object.assign(field, { neutralDefenders: [], npcArmies: 0, features: [], garrisonArmies: [] });
  if (terrain) field.terrain = terrain;
  return { field, from };
}

/** Gives the province to realm `pi` (or to nobody), as the old scripts' `own` did: off every realm's list, onto its
 *  own, its defenders, garrison and features cleared. */
export function own(G: World, p: Province, pi: number | null): void {
  G.players.forEach((pl) => {
    pl.provinces = pl.provinces.filter((id) => id !== p.id);
  });
  p.owner = pi;
  if (pi != null) G.players[pi]?.provinces.push(p.id);
  Object.assign(p, { neutralDefenders: [], npcArmies: 0, features: [], garrisonArmies: [] });
}

/** Puts `c` in province `p`, off every other province's list. */
export function place(G: World, c: Character, p: Province): void {
  G.world.provinces.forEach((q) => {
    q.characters = (q.characters ?? []).filter((id) => id !== c.id);
  });
  p.characters = [...(p.characters ?? []), c.id];
  c.location = p.id;
  c.locationName = p.name;
}

/** `c` attacks `field` from `from`, as the Move order sends him: on the field, the ground he came from noted for his
 *  retreat (`_attackedFrom`). */
export function attackFrom(G: World, c: Character, from: Province, field: Province): void {
  place(G, c, field);
  c['_attackedFrom'] = from.id;
}

/** A guard made by the test (a neutral chieftain, `_isNeutralGuard`) holding `field` with the companies given, no skill
 *  and no item unless `more` gives them; the field's defenders are his companies, as the Move order hands them over. */
export function aGuardMadeByTheTest(
  G: World,
  field: Province,
  armies: Company[],
  more: Partial<Character> = {},
): Character {
  const guard: Character = {
    id: Math.max(...G.characters.map((c) => c.id)) + 1,
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
    location: field.id,
    locationName: field.name,
    _isNeutralGuard: true,
    armies,
    ...more,
  };
  G.characters.push(guard);
  field.characters = [...(field.characters ?? []), guard.id];
  field.neutralDefenders = [...armies];
  field['npcArmies'] = armies.length;
  return guard;
}

/** What a battle wrote: its lines, and each in words. */
export interface WhatTheBattleWrote {
  readonly narrative: readonly NarrativeLine[];
  readonly words: readonly string[];
  /** The words, one line after another. */
  readonly text: string;
  /** Whether the attacker won (the battles' `won`). */
  readonly won: boolean;
}

const wrote = (battle: unknown): WhatTheBattleWrote => {
  const { narrative, won } = battle as { narrative: NarrativeLine[]; won: boolean };
  const words = narrative.map((l) => theWordsOf(l));
  return { narrative, words, text: words.join('\n'), won };
};

/** The battle against the province's defenders (combatVsNPC), `guard` leading them (or none). */
export function aBattleAgainstTheProvince(
  tc: TurnContext,
  atk: Character,
  field: Province,
  guard: Character | null,
): WhatTheBattleWrote {
  return wrote(quietly(() => combatVsNPC(...([tc, atk, field, guard] as unknown as Parameters<typeof combatVsNPC>))));
}

/** The battle between two heroes' hosts on `field` (combatVsChar), `atk` attacking `def`. */
export function aBattleBetweenHeroes(
  tc: TurnContext,
  atk: Character,
  def: Character,
  field: Province,
): WhatTheBattleWrote {
  return wrote(quietly(() => combatVsChar(...([tc, atk, def, field] as unknown as Parameters<typeof combatVsChar>))));
}

/** A plan that fights in melee every round and refuses every duel, so no duel or spell comes before the battle. */
export const MELEE_AND_NO_DUEL = (): { tactics: string[]; duelStance: string } => ({
  tactics: ['ME', 'ME', 'ME', 'ME', 'ME'],
  duelStance: 'refuse',
});
