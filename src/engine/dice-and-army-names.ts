import { ARMY_UNIT_NAMES, PRIMAL_UNIT_NAMES } from '../content/kingdoms-call-data.ts';
import { kcRng } from './rng.ts';
import { dispFloor } from './rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import type { UnitType } from '../content/kingdoms-call-data.ts';
import type { Army, GameState } from '../schemas/saved-game-state.ts';

// ── Percentage dice ────
// d100() returns an integer 1–100. A percentage check SUCCEEDS when the rolled number is LESS THAN
// OR EQUAL TO the chance, so a roll exactly equal to the % of success is a success (e.g. rolling 30
// against a 30% chance succeeds). This gives exactly `chance` winning faces out of 100 and makes
// the displayed integer roll honest (no float rounding artefact where a shown "30" was really 30.4
// and missed).
export function d100() {
  return Math.floor(kcRng() * 100) + 1;
}
// ONE canonical way to show a percentage roll in the report — the success CHANCE and the actual
// d100 ROLL, with a ✓/✗. Success is roll<=chance (the d100 convention above). The displayed % is
// clamped to 0–100; the underlying test should use the raw chance. Roll-display contract (Sept
// 2026): callers MUST compare an integer d100 roll against Math.round(chance) — never the raw
// fractional chance — so the tick shown here always matches the outcome. fmtRoll rounds both the
// same way. 2026-09-12: every number a player is shown is ROUNDED DOWN (toward zero), never to
// nearest — a 41.6% share must not read "42% (need 42%)", and a 49.6% chance must not read 50% and
// then miss on a roll of 50. With integer d100 rolls, roll<=floor(chance) is exactly roll<=chance,
// so the shown figure is the true test. A float a hair under an integer (0.29*100 = 28.999…) snaps
// to that integer rather than dropping a point.
export function fmtRoll(chance: number, roll: number) {
  const c = Math.max(0, Math.min(100, dispFloor(chance)));
  const r = dispFloor(roll);
  return `${c}% [roll ${r} ${r <= c ? '✓' : '✗'}]`;
}
// 2026-09-10 item 1: pctRoll(chance) — the ONE way to make a displayed percentage check. Rounds the
// chance to an integer first so the shown "N%" and the pass/fail test agree exactly; a roll equal
// to the chance succeeds.
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
export function armyUnitName(type: UnitType) {
  const pool = { ...ARMY_UNIT_NAMES, ...PRIMAL_UNIT_NAMES }[type] || ['the Guard'];
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

// ── LIFTED OUT OF resolveTurn (plan P1-08a) ── a random whole number from a to b, a random pick, and a host described
// for a battle line. They read no turn state.
export function rng(a: number, b: number) {
  return Math.floor(kcRng() * (b - a + 1)) + a;
}

export const pick = <T>(arr: readonly T[]) => arr[Math.floor(kcRng() * arr.length)];

export function describeArmy(armies: Army[] | null | undefined) {
  if (!armies || armies.length === 0) return 'no armies';
  const named: string[] = [];
  const unnamed: Record<string, number> = {};
  armies.forEach((a) => {
    const hasName = a.unitName && a.unitName !== a.type && !a.unitName.startsWith('undefined');
    if (a._phantom) {
      named.push(`✨ ${a.unitName} (${a.type}, ${a.quality})`);
    } else if (hasName) {
      named.push(`${a.unitName} (${a.type}, ${a.quality})`);
    } else {
      const key = `${a.quality} ${a.type}`;
      unnamed[key] = (unnamed[key] || 0) + 1;
    }
  });
  const unnamedStrs = Object.entries(unnamed).map(([k, n]) => (n > 1 ? `${n}× ${k}` : k));
  return [...named, ...unnamedStrs].join(', ') || 'no armies';
}
