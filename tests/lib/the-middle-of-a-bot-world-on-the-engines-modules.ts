// The middle of a bot world (tests/lib/middle-of-a-bot-world.ts's stage), made on the engine's modules, imported
// directly, with no vm: for unit tests of the bots' passes and judgements, which take the world (G) and nothing else.
// Three bot realms on a 10×8 map the engine makes from a seed; the province at row 4, column 5 (X), its six
// neighbours (ring1) and theirs (ring2) are open plain, unowned, with no garrison, guard or lair; nobody stands
// anywhere and nobody has orders. Realms 0 and 1 are at war, 0 and 2 allied, 1 and 2 at peace.
//
//   const b = aBotBoard(SEED);
//   b.own(b.X, 0);
//   const king = b.hero({ player: 0, at: b.X, king: true, troops: 3 });
//   botDuelStance(b.G, 0, king, forecast);
//
// The bots read the world through their own caches, keyed by the world object, so every board is a fresh world.
import './the-whole-engine.ts';
import { vi } from 'vitest';
import { kcRng } from '../../src/engine/rng.ts';
import { generateBotSetups } from '../../src/engine/bots/setup.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { getNeighborsP } from '../../src/engine/world/map-helpers.ts';
import type { GameState } from '../../src/schemas/saved-game-state.ts';

export interface Unit {
  type: string;
  quality: string;
  race: string;
  unitName: string;
  [key: string]: unknown;
}
export interface Province {
  id: number;
  row: number;
  col: number;
  name: string;
  terrain: string;
  owner: number | null;
  tax: number;
  characters: number[];
  garrisonArmies: Unit[];
  neutralDefenders: Unit[];
  [key: string]: unknown;
}
export interface Character {
  id: number;
  name: string;
  player: number | null;
  isKing: boolean;
  alive: boolean;
  location: number;
  armies: Unit[];
  skills: Record<string, number>;
  hp: number;
  maxHp: number;
  [key: string]: unknown;
}
export interface World {
  turn: number;
  relations: Record<string, string>;
  players: { name: string; provinces: number[]; [key: string]: unknown }[];
  characters: Character[];
  turnOrders: Record<string, unknown[]>;
  world: { cols: number; rows: number; provinces: Province[] };
  [key: string]: unknown;
}
export interface HeroSpec {
  player: number | null;
  at: Province;
  /** Companies of Men-at-Arms, Regular, Human. */
  troops?: number;
  king?: boolean;
  skills?: Record<string, number>;
  hp?: number;
}

const quietly = <T>(body: () => T): T => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    return body();
  } finally {
    log.mockRestore();
    warn.mockRestore();
  }
};
const must = <T>(v: T | null | undefined, what: string): T => {
  if (v == null) throw new Error('could not stage: no ' + what);
  return v;
};
let nextId = 9000;

export function aBotBoard(seed: number) {
  kcRng.seed(seed);
  const setups = generateBotSetups([], 3, 0).map((s) => ({
    ...s,
    gamePlayerId: 'gp' + String(s.id),
    name: s.kingdomName,
  }));
  const made: unknown = JSON.parse(
    JSON.stringify(quietly(() => generateNewGame(setups, { cols: 10, rows: 8 }, 999, {}))),
  );
  const G = made as World;
  G.relations = { '0-1': 'enemy', '0-2': 'allied', '1-2': 'peace' };
  G.characters = [];
  G.turnOrders = {};
  G['mercenaries'] = [];
  const ps = G.world.provinces;
  ps.forEach((p) => {
    p.characters = [];
  });
  const nbrs = (p: Province): Province[] =>
    (getNeighborsP(p, G.world.cols, G.world.rows, ps) as (Province | null)[]).filter(
      (q): q is Province => q != null && q.id !== p.id,
    );
  const X = must(
    ps.find((p) => p.row === 4 && p.col === 5),
    'middle province',
  );
  const ring1 = nbrs(X);
  const ring2 = [...new Set(ring1.flatMap(nbrs))].filter((p) => p !== X && !ring1.includes(p));
  const near = [X, ...ring1, ...ring2];
  near.forEach((p) =>
    Object.assign(p, {
      terrain: 'plain',
      owner: null,
      features: [],
      garrisonArmies: [],
      neutralDefenders: [],
      npcArmies: 0,
    }),
  );
  G.players.forEach((pl) => {
    pl.provinces = pl.provinces.filter((id) => !near.some((p) => p.id === id));
  });
  /** Gives `p` to realm `pi` (or to nobody). */
  const own = (p: Province, pi: number | null): void => {
    G.players.forEach((pl) => {
      pl.provinces = pl.provinces.filter((id) => id !== p.id);
    });
    p.owner = pi;
    if (pi != null) must(G.players[pi], 'realm ' + String(pi)).provinces.push(p.id);
  };
  /** Stands a new hero of `player` in `at`, leading `troops` companies of Men-at-Arms. */
  const hero = (s: HeroSpec): Character => {
    const id = ++nextId;
    const c: Character = {
      id,
      name: `Hero ${String(id)}`,
      isKing: !!s.king,
      player: s.player,
      race: 'Human',
      alignment: 'Neutral',
      temper: 'Cautious',
      hp: s.hp ?? 20,
      maxHp: s.hp ?? 20,
      skills: s.skills ?? { melee: 2, tactical: 2, march: 1, spy: 0 },
      aptitude: {},
      armies: Array.from({ length: s.troops ?? 0 }, (_, k) => ({
        type: 'Men-at-Arms',
        quality: 'Regular',
        race: 'Human',
        unitName: `Men-at-Arms #${String(id)}.${String(k)}`,
      })),
      items: [],
      location: s.at.id,
      locationName: s.at.name,
      alive: true,
      merits: 0,
      spellsUsedThisTurn: [],
    };
    G.characters.push(c);
    s.at.characters.push(id);
    return c;
  };
  /** The world as the engine's functions take it. */
  const state = (): GameState => made as GameState;
  return { G, state, X, ring1, ring2, nbrs, own, hero, must };
}
export type BotBoard = ReturnType<typeof aBotBoard>;
