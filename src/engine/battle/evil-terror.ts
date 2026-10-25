import { dispFloor } from '../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { getNeighborsP } from '../world/map-helpers.ts';
import { discSum } from '../discoveries.ts';
import type { Army, Province } from '../../schemas/saved-game-state.ts';
import type { TurnContext } from '../turn/context.ts';
import type { NarrativeLine } from '../turn/events-and-their-audiences.ts';
import { narrate } from '../turn/events-and-their-audiences.ts';

// ── EVIL TERROR (plan P1-08c: lifted out of resolveTurn) ────
// Terror after an Evil victory: whether it grips a province for its realm (reignOfFearHere), its spread to the battle
// province and its neighbours (spreadTerror), and its toll on the next defenders there (consumeTerror). spreadTerror
// takes the turn's context first (src/engine/turn/context.ts); the other two read no turn state.
// ── EVIL TERROR EFFECT ────
// A decisive Evil victory terrorises the battle province AND every adjacent province. Terror
// lingers until the next battle fought there, demoralising whoever defends
// (−10% strength per stack, at most 3 stacks: −30%; 2026-10-12, Toby item 21 — it was 5, −50%). Repeated terror
// events stack up to that cap; a save already holding more is read as 3. The two constants below are read by
// buildTurnReport too (terrorReadingOf), which shows Evil realms the reading: one copy of the figures (moved here from
// src/views/turn-report.ts in plan P1-12b1, so the engine imports no view). Reign of Terror sets a province's own share.
export const TERROR_PCT_PER_STACK = 0.1,
  TERROR_MAX_STACKS = 3;
export function reignOfFearHere(prov: Province | null | undefined, playerIdx: number | null | undefined) {
  return !!(prov && playerIdx != null && (prov._terrorStacks || 0) > 0 && prov._terrorisedBy === playerIdx);
}
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
    tp._terrorStacks = Math.min(TERROR_MAX_STACKS, (tp._terrorStacks || 0) + 1);
    tp._terrorTurn = G.turn;
    tp._terrorisedBy = byPlayer;
    tp._terrorPct = TERROR_PCT_PER_STACK + discSum(turnContext, byPlayer, 'terror', 'pct'); // ae03 Reign of Terror
  });
  if (narrative) {
    const adjNames = getNeighborsP(battleProv, G.world.cols, G.world.rows, G.world.provinces)
      .map((n) => n.name)
      .filter(Boolean);
    narrate(narrative, {
      kind: 'terror radiates from a province after an evil victory',
      provName: battleProv.name,
      wordsIfTheSurroundingLands: adjNames.length ? ` into the surrounding lands (${adjNames.join(', ')})` : '',
      terrorPctPerStack: dispFloor((TERROR_PCT_PER_STACK + discSum(turnContext, byPlayer, 'terror', 'pct')) * 100),
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
  if (!prov._terrorStacks || prov._terrorTurn === undefined) return false;
  // Terror never demoralises the forces of the very Evil player who caused it: if that player now
  // controls this province, their own defenders are unshaken by the fear they themselves spread.
  // Clear the lingering terror without effect (it has no one left to terrify here).
  if (prov._terrorisedBy !== undefined && prov._terrorisedBy !== null && prov.owner === prov._terrorisedBy) {
    delete prov._terrorStacks;
    delete prov._terrorTurn;
    delete prov._terrorisedBy;
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
      terrorStacksPlural: stacks !== 1 ? 's' : '',
    });
  delete prov._terrorStacks;
  delete prov._terrorTurn;
  delete prov._terrorisedBy;
  delete prov._terrorPct;
  return true;
}
