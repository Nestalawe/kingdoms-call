// Types for the parts of tests/lib/pc-hooks.js that TypeScript tests use. Add to them as tests need more.
import type { PageWindow } from './boot.js';

/** A fighter in a personal combat (pcCharCombatant or pcMonsterCombatant), as far as the tests read it. */
export interface Combatant {
  kind: 'character' | 'monster';
  name: string;
  hp: number;
  maxHp: number;
  /** The character it fights for (a hero's saved record); none for a guardian. */
  ref?: { hp?: number; maxHp?: number; [key: string]: unknown };
  status: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PersonalCombat {
  W: PageWindow;
  /** The nested functions asked for, by name. */
  PC: Record<string, (...args: never[]) => unknown>;
  /** A living character from the saved world, to build heroes from. */
  base: Record<string, unknown>;
  /** The guardian table (MONSTERS_P). */
  MON: Record<string, unknown>[];
  /** Page errors seen so far. */
  errs: string[];
  state: unknown;
}

export function bootPersonalCombat(
  names: string[],
  opts?: { page?: string; inject?: [anchor: string, replacement: string][] },
): Promise<PersonalCombat>;

/** Runs fn with the page's Math.random fixed at r (or a list used in turn, the last repeating). */
export function pinned<T>(W: PageWindow, r: number | number[], fn: () => T): T;
