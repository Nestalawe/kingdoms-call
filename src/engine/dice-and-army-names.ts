import { ARMY_UNIT_NAMES, PRIMAL_UNIT_NAMES } from '../content/kingdoms-call-data.ts';
import { kcRng } from './rng.ts';
import { dispFloor } from './rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import type { GameState } from '../schemas/saved-game-state.ts';

// ── Percentage dice ────
// d100() returns an integer 1–100. A percentage check SUCCEEDS when the rolled number is LESS THAN
// OR EQUAL TO the chance, so a roll exactly equal to the % of success is a success (e.g. rolling 30
// against a 30% chance succeeds). This gives exactly `chance` winning faces out of 100 and makes
// the displayed integer roll honest (no float rounding artefact where a shown "30" was really 30.4
// and missed).
export function d100() {
  return Math.floor(kcRng() * 100) + 1;
}
// 2026-09-10 item 1: pctRoll(chance) — the ONE way to make a displayed percentage check. Rounds the
// chance to an integer first so the shown "N%" and the pass/fail test agree exactly; a roll equal
// to the chance succeeds. The roll is shown by fmtRoll (src/views/prose/the-words-of-a-roll-a-host-and-a-skill-shown.ts).
export function pctRoll(chance: number) {
  const c = Math.max(0, Math.min(100, dispFloor(chance)));
  const roll = d100();
  return { chance: c, roll, ok: roll <= c };
}

// Track all army unit names in use across the game to ensure uniqueness
export const _usedArmyUnitNames = new Set();

export const _NAME_EPITHETS = [
  'the Reformed',
  'the Second',
  'the Third',
  'the New',
  'the Elder',
  'the Younger',
  'the Lost',
  'the Returned',
  'the Grim',
  'the Bold',
  'the Far',
  'the Sworn',
  'the Undying',
  'the Wandering',
  'the Broken',
  'the Reborn',
  'the Hidden',
  'the Last',
  'the Steadfast',
  'the Vengeful',
];
export const _NAME_TAILS = [
  'of the Reserve',
  'of the Old Guard',
  'of the New Levy',
  'of the Far Marches',
  'of the Rearguard',
  'of the Second Muster',
  'of the Long March',
  'of the Last Stand',
];
/** A company's name, drawn from its type's pool of names: any unit's type, as a save holds it (the schema's is any
 *  words); a type with no pool draws the Guard's. */
export function armyUnitName(type: string) {
  // the pools by any type (none for a type with no pool)
  const pools: Readonly<Partial<Record<string, readonly string[]>>> = { ...ARMY_UNIT_NAMES, ...PRIMAL_UNIT_NAMES };
  const pool = pools[type] ?? ['the Guard'];
  // Try to find a unique name from the (generously sized) pool.
  let name;
  let attempts = 0;
  do {
    name = pool[Math.floor(kcRng() * pool.length)];
    attempts++;
    if (attempts > pool.length * 3) {
      // Pool exhausted — compose a further DESCRIPTIVE name rather than appending a bare number.
      // With the large pools this is rarely reached; the composition space is enormous.
      const base = pool[Math.floor(kcRng() * pool.length)];
      let composed = null;
      for (const e of _NAME_EPITHETS) {
        const cand = `${base}, ${e}`;
        if (!_usedArmyUnitNames.has(cand)) {
          composed = cand;
          break;
        }
      }
      if (!composed)
        for (const t of _NAME_TAILS) {
          const cand = `${base} ${t}`;
          if (!_usedArmyUnitNames.has(cand)) {
            composed = cand;
            break;
          }
        }
      if (!composed)
        for (const e of _NAME_EPITHETS) {
          for (const t of _NAME_TAILS) {
            const cand = `${base}, ${e} ${t}`;
            if (!_usedArmyUnitNames.has(cand)) {
              composed = cand;
              break;
            }
          }
          if (composed) break;
        }
      name = composed || `${base} of the ${Math.floor(kcRng() * 9000 + 1000)}th Muster`;
      break;
    }
  } while (_usedArmyUnitNames.has(name));
  _usedArmyUnitNames.add(name);
  return name;
}

// Seed _usedArmyUnitNames from an existing game state (called after loading)
export function seedUsedArmyNames(gameState: GameState) {
  _usedArmyUnitNames.clear();
  (gameState.characters || []).forEach((c) => {
    (c.armies || []).forEach((a) => {
      if (a.unitName) _usedArmyUnitNames.add(a.unitName.replace(/ \(Skeletal\)$/, ''));
    });
  });
  (gameState.world?.provinces || []).forEach((p) => {
    (p.neutralDefenders || []).forEach((a) => {
      if (a.unitName) _usedArmyUnitNames.add(a.unitName);
    });
    (p.garrisonArmies || []).forEach((a) => {
      if (a.unitName) _usedArmyUnitNames.add(a.unitName);
    });
  });
  (gameState.mercenaries || []).forEach((m) => {
    if (m.unitName) _usedArmyUnitNames.add(m.unitName);
  });
}

// ── LIFTED OUT OF resolveTurn (plan P1-08a) ── a random whole number from a to b. It reads no turn state. (Its random
// pick went with its last caller, P1-12d20: an attack's verb is drawn by its index.) The host described for a battle
// line is describeArmy's, in the prose (src/views/prose/the-words-of-a-roll-a-host-and-a-skill-shown.ts).
export function rng(a: number, b: number) {
  return Math.floor(kcRng() * (b - a + 1)) + a;
}

/** A unit as describeArmy names it: an army, or a copy of one that a battle's line holds (theUnitsAsTheLineNamesThem). */
export interface AUnitAsDescribeArmyNamesIt {
  readonly unitName: string;
  readonly type: string;
  readonly quality: string;
  readonly _phantom?: boolean | undefined;
}
