// Personal combat in the bare vm (plan P1-08e), for the tests that took its functions from the "  // 4. Run all 5
// phases" hook after a turn on the GM portal (tests/lib/pc-hooks.js, retired). The pc* family and
// resolvePersonalCombat are top-level now (src/engine/personal-combat/); those that read the turn's state take its
// context first.
//
//   const pc = personalCombatEngine();
//   const hero = pc.call('pcCharCombatant', { ...clone(pc.base), skills: { melee: 3 } }) as Combatant;
//   pc.pinned(0.01, () => pc.call('pcCastCombatSpell', hero, foe, 'Fireball', [], {}));
//
// call() gives a function that takes the turn's context (its first parameter is `turnContext`) the one context made
// here, on a new world of bot realms; a pure one gets its arguments only. The engine's log is quiet.
import vm from 'node:vm';
import type { KcRng } from './boot.js';
import { botWorld, engineFn, loadEngine, quietEngineLog, turnContext, type TurnContext } from './engine.ts';

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
  engine: vm.Context;
  /** The turn's context the functions that take one are given. */
  turnContext: TurnContext;
  /** Calls the engine's function `name`, with the turn's context first if it takes one. */
  call: (name: string, ...args: unknown[]) => unknown;
  /** A value of the engine, by expression: `value('MONSTERS_P')`. */
  value: (expression: string) => unknown;
  /** A living hero of a realm in the world, to build heroes from (a copy: change it freely). */
  base: Character;
  /** The guardian table (MONSTERS_P). */
  MON: Guardian[];
  /** Runs fn with the engine's dice (kcRng) fixed at r (or a list used in turn, the last repeating). */
  pinned: <T>(r: number | number[], fn: () => T) => T;
}

/** A deep copy, made in this realm. */
export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** The engine loaded with `seed`, and a turn's context on a new world of `realms` bot realms. */
export function personalCombatEngine({
  seed = 1,
  realms = 2,
  size = { cols: 10, rows: 6 },
  opts = { seaPct: 20 },
}: {
  seed?: number;
  realms?: number;
  size?: { cols: number; rows: number };
  opts?: Record<string, unknown>;
} = {}): PersonalCombatEngine {
  const engine = loadEngine({ seed });
  quietEngineLog(engine);
  const tc = turnContext(engine, botWorld(engine, realms, size, opts));
  const bound = new Map<string, (...args: unknown[]) => unknown>();
  const fnOf = (name: string) => {
    let f = bound.get(name);
    if (!f) {
      const fn = engineFn(engine, name) as (...args: unknown[]) => unknown;
      const takesContext = /^function\s*[\w$]*\s*\(\s*turnContext\s*[,)]/.test(Function.prototype.toString.call(fn));
      f = takesContext ? (...args: unknown[]) => fn(tc, ...args) : fn;
      bound.set(name, f);
    }
    return f;
  };
  const value = (expression: string): unknown => vm.runInContext(expression, engine);
  const characters = tc.G['characters'] as Character[];
  const base = characters.find((c) => c.alive && c.player != null);
  if (!base) throw new Error('the world has no living hero of a realm');
  const rng = value('kcRng') as KcRng;
  return {
    engine,
    turnContext: tc,
    call: (name: string, ...args: unknown[]) => fnOf(name)(...args),
    value,
    base: clone(base),
    MON: value('MONSTERS_P') as Guardian[],
    pinned: <T>(r: number | number[], fn: () => T): T => {
      const seq = Array.isArray(r) ? r.slice() : [r];
      const real = rng.use(() => (seq.length > 1 ? (seq.shift() ?? 0) : (seq[0] ?? 0)));
      try {
        return fn();
      } finally {
        rng.use(real);
      }
    },
  };
}
