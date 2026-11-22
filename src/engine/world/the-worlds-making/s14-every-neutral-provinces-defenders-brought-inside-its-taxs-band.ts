// S14 of the world's making (generateNewGame, src/engine/world/generate.ts; the stages: docs/architecture/
// the-worlds-making-its-stages-their-files-and-how-a-stage-is-moved-into-one.md): the defender band audit. Every
// neutral land province's defenders brought inside the band its final tax asks for, in place on the provinces' list.
import { resyncNeutralDefenders } from '../../units/drill-and-spoils.ts';
import type { AProvinceAsTheWorldIsMadeIt } from './what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';

/** What the defender band audit reads: the provinces' list. */
export interface WhatTheDefenderBandAuditReads {
  readonly provinces: AProvinceAsTheWorldIsMadeIt[];
}

/** S14, the defender band audit: each neutral land province's defenders resynced to its tax, in place. It returns
 *  nothing: the later stages read it from the provinces' list. */
export function everyNeutralProvincesDefendersBroughtInsideItsTaxsBand({ provinces }: WhatTheDefenderBandAuditReads) {
  // ── NEUTRAL DEFENDER BAND AUDIT ────
  // Every defender pass rolls its count from the province's tax AT THE TIME, but three passes above
  // change a province's tax AFTERWARDS and do not rebuild the garrison:
  // • the home poor-neighbour force (`poorNbr.tax=rP(2,3)`) — a Rich/Prosperous province keeps
  // its 3-4 or 2-3 defenders while displaying as Poor;
  // • the home prosperous-neighbour force (`prospNbr.tax=rP(4,6)`) — a POOR province is promoted to
  // Prosperous and keeps its 1-2 defenders. This is the reported bug: a province the player is
  // shown as "Prosperous" defended by a single army.
  // • `_reRaceProvince` rebuilds correctly, but only fires when a pair member is non-humanoid or
  // has to be re-raced to the king's race, so it cannot be relied on to clean up after the above.
  // Rather than patch each mutation site (and have the next one reintroduce it), this single sweep
  // is the authority: after ALL world-gen tailoring and BEFORE the neutral-guard heroes take
  // command of these arrays, every neutral land province is brought inside the band its FINAL tax
  // demands. Rich (tax>=7) 3-4 · Prosperous (tax 4-6) 2-3 · Poor (tax 2-3) 1-2 — the same
  // thresholds as the player-facing wealth label. Provinces already in band are left exactly as
  // generated.
  provinces.forEach((p) => {
    if (p.owner === null && p.terrain !== 'sea') resyncNeutralDefenders(p);
  });
}
