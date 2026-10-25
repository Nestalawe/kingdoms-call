// ── A unit's type word and its base strength (plan P1-11a3) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a).
import { KC_UNIT_BASE_STR, KC_UNIT_Q_MULT, KC_UNIT_TYPE } from '../../content/kingdoms-call-data.ts';

/** A unit as these rules read it: its type, and its quality (none reads as Average). */
export interface UnitOfATypeAndQuality {
  readonly type: string;
  readonly quality?: string | null | undefined;
}

// The unit's TYPE word (2026-10-11): infantry, ranged, cavalry, flyer or naval, from the shared
// KC_UNIT_TYPE table. Anything the table has never heard of (an old save, a test fixture) is infantry,
// which is what such a unit already does in battle: it holds a place in the line.
// The table read by any name (a unit type it doesn't list reads undefined, so infantry).
const UNIT_TYPE_WORD_OF: Readonly<Record<string, string>> = KC_UNIT_TYPE;
export function unitTypeOf(armyType: string): string {
  return (typeof KC_UNIT_TYPE !== 'undefined' && UNIT_TYPE_WORD_OF[armyType]) || 'infantry';
}

export const UNIT_BASE_STR: Record<string, number> = { ...KC_UNIT_BASE_STR };
export const UNIT_Q_MULT: Record<string, number> = { ...KC_UNIT_Q_MULT };
export function unitBaseStrength(army: UnitOfATypeAndQuality): number {
  return (UNIT_BASE_STR[army.type] || 4) * (UNIT_Q_MULT[army.quality || 'Average'] || 2);
}
