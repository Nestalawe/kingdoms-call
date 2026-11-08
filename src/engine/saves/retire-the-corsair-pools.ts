import { THE_CORSAIR_FLEET_RETIRED_FROM_THE_POOLS } from '../../content/the-corsair-fleet-retired-from-the-pools-and-the-unit-in-its-place.ts';

// A save as this pass reads it: a world whose provinces may be missing, or hold no pool (an older save, or a test's
// hand-made world). Today's GameState passes.
interface ProvinceAsThisPassReadsIt {
  armyTypes?: string[] | null | undefined;
}
interface SaveAsThisPassReadsIt {
  readonly world?:
    { readonly provinces?: readonly (ProvinceAsThisPassReadsIt | null | undefined)[] | null | undefined } | null | undefined;
}

// 2026-10-15 (Toby, D3): the Corsair Fleet is gone. New worlds stopped offering it on 2026-10-11; a
// province of a game already running whose pool still offers it now offers the Galleon Fleet in its
// place (or simply loses it, if the Galleon is already there). A Corsair company already raised is
// kept and fights as before. Idempotent: runs at the top of every runTurn, in the save's upgrade (the unit and its
// stand-in are a content row).
export function retireCorsairPools(gs: SaveAsThisPassReadsIt | null | undefined) {
  const { retired, inItsPlace } = THE_CORSAIR_FLEET_RETIRED_FROM_THE_POOLS;
  (gs?.world?.provinces ?? []).forEach((p) => {
    if (!p || !Array.isArray(p.armyTypes)) return;
    const i = p.armyTypes.indexOf(retired);
    if (i < 0) return;
    if (p.armyTypes.includes(inItsPlace)) p.armyTypes = p.armyTypes.filter((t) => t !== retired);
    else {
      p.armyTypes[i] = inItsPlace;
      p.armyTypes = p.armyTypes.filter((t) => t !== retired);
    }
  });
}
