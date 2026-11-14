import { dispFloor } from '../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import {
  TERROR_MAX_STACKS,
  TERROR_PCT_PER_STACK,
} from '../rules-on-plain-values/the-terror-an-evil-victory-leaves-its-share-a-stack-and-its-most-stacks.ts';
import { getNeighborsP } from '../world/map-helpers.ts';
import {
  layATerrorStackOnAProvince,
  liftTheTerrorFromAProvinceItsRealmHolds,
  spendTheTerrorOnAProvince,
  terrorLingersOnAProvince,
} from '../world/the-marks-on-a-province-consecrated-ground-terror-and-enslave.ts';
import { whatARealmsDiscoveriesAddToTheTerrorAVictoryLeaves } from '../rules/the-registry-of-discovery-effects.ts';
import type { Army, Province } from '../../schemas/saved-game-state.ts';
import type { TurnContext } from '../turn/context.ts';
import type { NarrativeLine } from '../turn/events-and-their-audiences.ts';
import { narrate } from '../turn/events-and-their-audiences.ts';

// ── EVIL TERROR (plan P1-08c: lifted out of resolveTurn) ────
// Terror after an Evil victory: its spread to the battle province and its neighbours (spreadTerror), and its toll on the
// next defenders there (consumeTerror). spreadTerror takes the turn's context first (src/engine/turn/context.ts);
// consumeTerror reads no turn state. The mark itself (whether it grips a province for its realm, reignOfFearHere; its
// stacks laid, lifted and spent) is the marks' module's (src/engine/world/the-marks-on-a-province-…, plan P1-19ay2).
// ── EVIL TERROR EFFECT ────
// A decisive Evil victory terrorises the battle province AND every adjacent province. Terror
// lingers until the next battle fought there, demoralising whoever defends
// (−10% strength per stack, at most 3 stacks: −30%). Repeated terror events stack up to that cap; a save already
// holding more is read as 3. The two figures, TERROR_PCT_PER_STACK and TERROR_MAX_STACKS, are on plain values
// (src/engine/rules-on-plain-values/the-terror-an-evil-victory-leaves-its-share-a-stack-and-its-most-stacks.ts) because
// buildTurnReport reads them too (terrorReadingOf).
export function spreadTerror(
  turnContext: TurnContext,
  battleProv: Province,
  byPlayer: number,
  narrative: NarrativeLine[] | null | undefined,
) {
  const { G } = turnContext;
  const targets = [battleProv, ...getNeighborsP(battleProv, G.world.cols, G.world.rows, G.world.provinces)];
  const seen = new Set<number>();
  targets.forEach((tp) => {
    if (seen.has(tp.id)) return;
    seen.add(tp.id);
    // the stack laid by the marks' module (plan P1-19ay2); ae03 Reign of Terror (the discoveries' registry's since plan
    // P1-19af: "fate: a realm's discoveries add to the terror a victory leaves", which the line asks too)
    layATerrorStackOnAProvince(
      tp,
      G.turn,
      byPlayer,
      TERROR_PCT_PER_STACK + whatARealmsDiscoveriesAddToTheTerrorAVictoryLeaves(G.players[byPlayer]),
    );
  });
  if (narrative) {
    const adjNames = getNeighborsP(battleProv, G.world.cols, G.world.rows, G.world.provinces)
      .map((n) => n.name)
      .filter(Boolean);
    narrate(narrative, {
      kind: 'terror radiates from a province after an evil victory',
      provName: battleProv.name,
      surroundingLands: adjNames,
      terrorPctPerStack: dispFloor(
        (TERROR_PCT_PER_STACK + whatARealmsDiscoveriesAddToTheTerrorAVictoryLeaves(G.players[byPlayer])) * 100,
      ),
    });
  }
}
// Consume any lingering terror in a province at the start of a battle: returns true if applied.
export function consumeTerror(
  prov: Province,
  defenders: Army[] | null | undefined,
  narrative: NarrativeLine[] | null | undefined,
) {
  // Terror lingers until the NEXT battle fought here — same turn or later. It is safe to consume
  // same-turn because consumeTerror runs at battle START and spreadTerror at battle END, so a
  // battle can never consume the terror it itself created. (Previously gated to
  // _terrorTurn<G.turn, which wrongly denied the demoralise effect to same-turn follow-up
  // attacks.)
  if (!terrorLingersOnAProvince(prov)) return false;
  // Terror never demoralises the forces of the very Evil player who caused it: if that player now
  // controls this province, their own defenders are unshaken by the fear they themselves spread.
  // Clear the lingering terror without effect (it has no one left to terrify here).
  if (prov._terrorisedBy !== undefined && prov._terrorisedBy !== null && prov.owner === prov._terrorisedBy) {
    liftTheTerrorFromAProvinceItsRealmHolds(prov);
    return false;
  }
  const stacks = Math.min(TERROR_MAX_STACKS, prov._terrorStacks);
  const _tp = prov._terrorPct || TERROR_PCT_PER_STACK;
  const frac = Math.min(_tp * stacks, _tp * TERROR_MAX_STACKS);
  (defenders || []).forEach((d) => {
    d._terrorMult = Math.max(0, 1 - frac);
  }); // 2026-09-24: a modifier (armStr), not pre-battle damage
  if (narrative)
    narrate(narrative, {
      kind: 'terror lingers in a province and its defenders fight demoralised',
      provName: prov.name,
      terrorPct: dispFloor(frac * 100),
      terrorStacks: stacks,
    });
  spendTheTerrorOnAProvince(prov);
  return true;
}
