// Personal combat on the engine's modules, imported directly (plan P1-14b; until then in the engine's bare vm, plan
// P1-08e), for the tests that took its functions from the "  // 4. Run all 5 phases" hook after a turn on the GM portal
// (tests/lib/pc-hooks.js, retired). The pc* family and resolvePersonalCombat are top-level in src/engine/personal-combat/;
// those that read the turn's state take its context first.
//
//   const pc = await personalCombatEngine();
//   const hero = pc.call('pcCharCombatant', { ...clone(pc.base), skills: { melee: 3 } }) as Combatant;
//   pc.pinned(0.01, () => pc.call('pcCastCombatSpell', hero, foe, 'Fireball', [], {}));
//
// call() gives a function that takes the turn's context (its first parameter is `turnContext`) the one context made
// here, on a new world of bot realms; a pure one gets its arguments only. The console's log is quiet.
//
// Fresh modules (tests/README.md, "How the tests reach the site"): it calls vi.resetModules() and imports the whole
// engine again (tests/lib/the-whole-engine.ts) before it seeds the dice, so the world is the one the bare vm made from
// the same seed, whatever the file made before. A module the test imports after this call (`await import(…)`: a table,
// kcRng, a function to stand in with vi.spyOn) is the same fresh one the functions call() gives use.
import fs from 'node:fs';
import path from 'node:path';
import { vi } from 'vitest';
import { addTheFieldsResolveTurnAdds, type TurnContext } from './the-fields-resolve-turn-adds-to-the-turns-context.ts';

/** A combatant's state in a fight (pcNewStatus), as far as the tests read it. */
export interface CombatStatus {
  stun?: number;
  silenceRounds?: number;
  meleeHalvedRounds?: number;
  hitPenalty?: number;
  hitBonus?: number;
  dot?: { dmg: number; rounds: number; label?: string }[];
  [key: string]: unknown;
}

/** A fighter in a personal combat (pcCharCombatant or pcMonsterCombatant), as far as the tests read it. */
export interface Combatant {
  kind: 'character' | 'monster';
  name: string;
  hp: number;
  maxHp: number;
  /** The character it fights for (a hero's saved record); none for a guardian. */
  ref?: { hp?: number; maxHp?: number; [key: string]: unknown };
  status: CombatStatus;
  tactics: string[];
  tacIdx: number;
  arm: { cap?: number; [key: string]: unknown } | null;
  weak: unknown;
  [key: string]: unknown;
}

/** A character of the world, as far as the tests read it. */
export interface Character {
  id: number | string;
  name: string;
  player: number | null;
  alive: boolean;
  isKing?: boolean;
  skills: Record<string, number>;
  items: Record<string, unknown>[];
  [key: string]: unknown;
}

/** A guardian of the guardian table (MONSTERS_P), as far as the tests read it. */
export interface Guardian {
  name: string;
  power: 'Weak' | 'Moderate' | 'Powerful' | 'Legendary';
  cat?: string;
  hp: number;
  melee?: number;
  archery?: number;
  spells?: { name: string; effect?: string }[];
  weak?: { kind: string; key: string } | null;
  passives?: { name: string; desc: string; fx: Record<string, unknown> }[];
  [key: string]: unknown;
}

/** A fight's outcome (resolvePersonalCombat). */
export interface FightResult {
  winner?: Combatant | null;
  loser?: Combatant | null;
  fledBy?: Combatant | null;
  aHp: number;
  bHp: number;
  narrative: (string | { text: string })[];
}

export interface PersonalCombatEngine {
  /** The turn's context the functions that take one are given. */
  turnContext: TurnContext;
  /** Calls the engine's function `name`, with the turn's context first if it takes one. */
  call: (name: string, ...args: unknown[]) => unknown;
  /** A living hero of a realm in the world, to build heroes from (a copy: change it freely). */
  base: Character;
  /** The guardian table (MONSTERS_P). */
  MON: Guardian[];
  /** Runs fn with the engine's dice (kcRng) fixed at r (or a list used in turn, the last repeating). */
  pinned: <T>(r: number | number[], fn: () => T) => T;
}

/** A deep copy, made in this realm. */
export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const SRC = path.resolve(import.meta.dirname, '..', '..', 'src');
/** Every file of src/engine/ and src/views/, whose exported functions call() finds by name. */
const ENGINE_FILES = ['engine', 'views'].flatMap((dir) =>
  fs
    .readdirSync(path.join(SRC, dir), { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.ts'))
    .sort()
    .map((f) => path.join(SRC, dir, f)),
);

/** The engine's modules, fresh, with the dice seeded `seed`, and a turn's context on a new world of `realms` bot
 *  realms: the world the bare vm made from the same seed. */
export async function personalCombatEngine({
  seed = 1,
  realms = 2,
  size = { cols: 10, rows: 6 },
  opts = { seaPct: 20 },
}: {
  seed?: number;
  realms?: number;
  size?: { cols: number; rows: number };
  opts?: Record<string, unknown>;
} = {}): Promise<PersonalCombatEngine> {
  vi.resetModules();
  await import('./the-whole-engine.ts');
  const { kcRng } = await import('../../src/engine/rng.ts');
  const { KC_SEASONS, MONSTERS_P } = await import('../../src/content/kingdoms-call-data.ts');
  const { generateBotSetups, isBotRow } = await import('../../src/engine/bots/setup.ts');
  const { generateNewGame } = await import('../../src/engine/world/generate.ts');
  const { createTurnContext } = await import('../../src/engine/turn/context.ts');
  const functions = new Map<string, (...args: unknown[]) => unknown>();
  for (const file of ENGINE_FILES)
    for (const [name, value] of Object.entries((await import(file)) as Record<string, unknown>))
      if (typeof value === 'function') functions.set(name, value as (...args: unknown[]) => unknown);
  kcRng.seed(seed);
  // The engine's log echoes each line of the GM's log on the console: quiet, as the vm's was.
  console.log = () => undefined;

  // A new world of bot realms, made by the engine itself, as JSON (tests/lib/engine.ts's botWorld), and the turn's
  // context on it (its turnContext): the fields resolveTurn adds, from the one list both roads use.
  const setup = (generateBotSetups([], realms, 0) as Record<string, unknown>[]).map((b) => ({
    ...b,
    gamePlayerId: 'gp' + String(b['id']),
    name: b['kingdomName'],
  }));
  const state = JSON.stringify(generateNewGame(setup, clone(size), 999, clone(opts)));
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(JSON.parse(state), [], 1), {
    KC_SEASONS,
    isBotRow: isBotRow as (row: unknown) => boolean,
  });

  const bound = new Map<string, (...args: unknown[]) => unknown>();
  const fnOf = (name: string) => {
    let f = bound.get(name);
    if (!f) {
      const fn = functions.get(name);
      if (!fn) throw new Error(`the engine has no function ${name}`);
      const takesContext = /^function\s*[\w$]*\s*\(\s*turnContext\s*[,)]/.test(Function.prototype.toString.call(fn));
      f = takesContext ? (...args: unknown[]) => fn(tc, ...args) : fn;
      bound.set(name, f);
    }
    return f;
  };
  const characters = tc.G['characters'] as Character[];
  const base = characters.find((c) => c.alive && c.player != null);
  if (!base) throw new Error('the world has no living hero of a realm');
  return {
    turnContext: tc,
    call: (name: string, ...args: unknown[]) => fnOf(name)(...args),
    base: clone(base),
    MON: MONSTERS_P as Guardian[],
    pinned: <T>(r: number | number[], fn: () => T): T => {
      const seq = Array.isArray(r) ? r.slice() : [r];
      const real = kcRng.use(() => (seq.length > 1 ? (seq.shift() ?? 0) : (seq[0] ?? 0)));
      try {
        return fn();
      } finally {
        kcRng.use(real);
      }
    },
  };
}
