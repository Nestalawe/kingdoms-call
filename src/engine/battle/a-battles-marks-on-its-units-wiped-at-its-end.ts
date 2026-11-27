// ── A BATTLE'S MARKS ON ITS UNITS, WIPED AT ITS END ────
// A battle writes marks on its units that last for that battle only (army-tables.ts says which): the strength its
// arrows and spells took (`_archeryRed`, `_tempStrReduction`), Terror's (`_terrorMult`), the random tier-ups (`_tacUp`,
// `_drumUp`), Lightning Advance's ambush (`_laNoTerrain`) and Flak Screen's (`_flakTargeted`). Both battles' ends wipe
// them from every unit still on a side. A company that leaves the side before the end has them wiped where it leaves:
// the companies a beaten fleet sends overland to a garrison (navalSplitRetreat), which otherwise kept the battle's
// cuts into their next fight. One path the end doesn't reach keeps them on purpose (R-067): the ships a beaten force
// leaves on its own shore (_navalLeaveBehind) hold the ground, and a stalled battle can resume against them the same
// turn with their cuts, as the same battle. The new turn wipes the marks from every garrison (new-turn-counter-….ts).
import type { ArmyInABattle } from '../army-tables.ts';

/** Wipe a battle's marks from each unit of `units`: the battle is over for them. */
export function wipeABattlesMarksFromItsUnits(units: readonly (ArmyInABattle | null | undefined)[]): void {
  units.forEach((a) => {
    if (!a) return;
    delete a._tempStrReduction;
    delete a._terrorMult;
    delete a._archeryRed;
    delete a._tacUp;
    delete a._drumUp;
    delete a._laNoTerrain;
    delete a._flakTargeted;
  });
}
