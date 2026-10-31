import { KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import { ARMY_SPEED_MASTER } from '../army-tables.ts';
import { typeOfX } from '../battle/lines.ts';
import type { GridCell } from '../battle/lines.ts';
import { activeItems } from '../items/equipment.ts';
import { discEffectsOf } from '../discoveries.ts';
import { discUnitMatch } from '../rules-on-plain-values/units-a-discoverys-effect-reaches-by-type-class-race-and-quality.ts';
import type { HeroInABattle } from '../army-tables.ts';
import type { Army, Character, Realm } from '../../schemas/saved-game-state.ts';
import { theBeatenForceHolds, thePursuitsOfTheBeaten } from '../rules/the-registry-of-content-effects.ts';
import type { APursuitOfTheBeaten, TheBattleARoutFollows } from '../rules/the-registry-of-content-effects.ts';
import { theCommandersItemsLetHisRidersRunTheBeatenDownOnAnyGround } from '../rules/the-registry-of-magic-item-effects.ts';

/** A unit in a force as the battle code passes it: an army, or a hole the guards skip. */
type ForceUnit = Pick<Army, 'type'> | null | undefined;

// ── MARCH AND NAVAL SPEED BONUS ────
// 2026-10-13 (Toby, item 14): one rate of advance. Every unit a hero leads gains the same bonus
// from March (on land) or Naval (at sea), whatever its base move: +0/+0/+1/+1/+2/+3 at levels 0–5
// (the old "slow column" ladder; the "fast column" ladder +0/+1/+1/+2/+2/+2 is gone). Flyers gain
// nothing from March. Kept at module top level so the engine, the turn report and the bots all
// read the same table.
export const MARCH_NAVAL_BONUS = [0, 0, 1, 1, 2, 3];
export function marchSpeedBonus(marchLevel: number | null | undefined): number | undefined {
  return MARCH_NAVAL_BONUS[Math.max(0, Math.min(5, Number(marchLevel) || 0))];
}
// Report helper (2026-09-23, item 7): the movement rate of an UNLED (garrison) unit — base speed,
// plus the realm's Road / race `move` discoveries for a speed-1/2 land unit, as computeMovePoolMax
// adds them. No commander, so no March / Naval / title bonus.
export const GARRISON_SEA_TYPES_R = new Set(KC_UNIT_CLASS.sea);
export const GARRISON_AIR_TYPES_R = new Set(KC_UNIT_CLASS.aerial);
export const GARRISON_FLY_TYPES_R = new Set(KC_UNIT_CLASS.flying);
export function garrisonMoveRate(
  a: Army | null | undefined,
  pl: Realm | null | undefined,
): { moveRate?: number; moveKind?: 'sea' | 'air' | 'land' } {
  if (!a) return {};
  const base = ARMY_SPEED_MASTER[a.type] ?? 3;
  const sea = GARRISON_SEA_TYPES_R.has(a.type);
  let road = 0;
  if (!sea && !GARRISON_FLY_TYPES_R.has(a.type) && base <= 2 && pl && typeof discEffectsOf === 'function')
    discEffectsOf(pl, 'move').forEach((e: { readonly extra?: number }) => {
      if (discUnitMatch(e, a)) road += e.extra ?? 0;
    });
  return { moveRate: base + road, moveKind: sea ? 'sea' : GARRISON_AIR_TYPES_R.has(a.type) ? 'air' : 'land' };
}
export function navalSpeedBonus(baseSpeed: number, navalLevel: number | null | undefined): number | undefined {
  // baseSpeed is no longer used (item 14: one rate)
  return MARCH_NAVAL_BONUS[Math.max(0, Math.min(5, Number(navalLevel) || 0))];
}

// ── THE ROUT ── The pursuits a winning force makes of the beaten: the rule registry's "fate: the winner runs the
// beaten down" (plan P1-19j: Ride Them Down, Run Them Down, the Manticores' pursuit and Feeding Frenzy, in that order),
// handed whether the commander carries the War-Horn of the Plains (asked only for a force with Free Lances, as before:
// reading a commander's items tidies them), as the items' registry's "fate: the commander's riders run the beaten down
// on any ground" answers it (plan P1-19n). The battles add the fractions to each beaten unit's death roll, unless a
// Shield Fort holds, and write each pursuit's line.
export function pursuitsOfTheBeaten(
  force: readonly ForceUnit[] | null | undefined,
  terrain: string | null | undefined,
  cmdr: Character | null | undefined,
  battle: TheBattleARoutFollows,
): readonly APursuitOfTheBeaten[] {
  return thePursuitsOfTheBeaten({
    theWinningForce: force ?? [],
    ground: terrain,
    itsCommanderCarriesTheWarHornOfThePlains: () =>
      !!cmdr && theCommandersItemsLetHisRidersRunTheBeatenDownOnAnyGround(activeItems(cmdr)),
    theBattle: battle,
  });
}
/** The fraction the pursuits add to each beaten unit's death roll, summed in their order (from 0, as the battle code
 *  added them). */
export function theFractionThePursuitsAdd(pursuits: readonly APursuitOfTheBeaten[]): number {
  return pursuits.reduce((sum, p) => sum + p.theFractionAddedToEachBeatenUnitsDeathRoll, 0);
}
/** The factor the pursuits put on each of the winner's own death rolls (Run Them Down's half against neutral guards). */
export function theFactorThePursuitsPutOnTheWinnersOwnDeathRolls(pursuits: readonly APursuitOfTheBeaten[]): number {
  return pursuits.reduce((factor, p) => factor * p.theFactorOnTheWinnersOwnDeathRolls, 1);
}
// HUMAN — Ride Them Down's share alone: +6% per Free Lances company in the winning force to each beaten unit's
// destruction roll, to +18%, in open country only (the commander's War-Horn of the Plains: +18% on any ground). Its
// effect is the registry's; the battles read it among the pursuits above.
export function rideThemDownBonus(
  force: readonly ForceUnit[] | null | undefined,
  terrain: string,
  cmdr: Character | null | undefined,
): number {
  return theFractionThePursuitsAdd(
    pursuitsOfTheBeaten(force, terrain, cmdr, 'between heroes').filter(
      (p) => p.line === 'the free lances ride the beaten down',
    ),
  );
}
// Telekinetic Storm (battle magic) HALVES the effectiveness of a commander's Tactical bonus for the
// battle (it no longer negates it). `_tacticalMult` defaults to 1; the spell sets it to 0.5. We
// halve
// only the bonus ABOVE 1 so the result is always a bonus (never a penalty): ×1.6 → ×1.3, etc.
export function tacMulted(bonus: number, cmdr: HeroInABattle | null | undefined): number {
  const m = cmdr?._tacticalMult ?? 1;
  return 1 + (bonus - 1) * m;
}
// DWARF — Shield Fort's gate (2026-10-11, Toby, the unit abilities): the rule registry's "fate: the beaten force holds"
// (plan P1-19j): at least half the FRONT LINE is Dwarven Guard, a Dwarf Garrison counting as Guard (Deep Halls). Without
// a placed grid (an estimate) it reads half the force, as it did before.
export function shieldFortHolds(
  force: readonly ForceUnit[] | null | undefined,
  grid: { readonly front?: (GridCell | null | undefined)[] } | null | undefined,
): boolean {
  return theBeatenForceHolds({
    theForce: force ?? [],
    theFrontLine: grid && Array.isArray(grid.front) ? grid.front.filter(Boolean).map((x) => typeOfX(x)) : null,
  });
}
