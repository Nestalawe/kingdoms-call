// ── RAID THE COAST AND LANDING PARTIES (plan P1-08c: lifted out of resolveTurn) ────
// Whether a commander's Raid the Coast bonus applies to this battle, and the flags a landing party carries whoever
// commands it. Both take the turn's context first (src/engine/turn/context.ts).
import type { Character, Province } from '../../schemas/saved-game-state.ts';
import type { TurnContext } from '../turn/context.ts';
// NAVAL L9 Raid the Coast (2026-09-23e, Toby): the +25% applies only to a battle for the land
// province this commander came ashore in, from the sea, THIS turn (_seaLandingAt, set by the
// coastal-landing move) — was: any battle this turn in any province that merely bordered the sea,
// so a raider who marched overland to a coast still got it. Inside runTurn so G is the live turn.
// Pooled landings (2026-09-23f, Toby — as for Reaver Crews): when the raider lands with others
// and another hero takes command, the pooled host carries the raid as `_raidCarriedAt` rather than
// the raider's own order flag — syncLeaderCopy writes the copy's keys back onto the real commander,
// and he must never look as though HE gave the Naval-9 order (the move-time plunder reads it).
export function raidLandedHere(
  turnContext: TurnContext,
  ch: Character | null | undefined,
  prov: Province | null | undefined,
) {
  const { G } = turnContext;
  if (!ch || !prov || prov.terrain === 'sea') return false;
  const k = ch._raidCarriedAt;
  if (k && k.turn === G.turn && k.prov === prov.id) return true;
  if (ch._raidCoastTurn !== G.turn) return false;
  const l = ch._seaLandingAt;
  return !!l && l.turn === G.turn && l.prov === prov.id;
}
// The pooled-host fields a landing party carries whoever commands it.
export function landingPartyFlags(
  turnContext: TurnContext,
  party: Character[] | null | undefined,
  prov: Province | null | undefined,
) {
  const { G } = turnContext;
  const o: { _amphibiousAssault: boolean; _raidCarriedAt?: { turn: number; prov: number } } = {
    _amphibiousAssault: (party || []).some((m) => m && m._amphibiousAssault),
  }; // Reaver Crews (2026-09-23e)
  if (prov && (party || []).some((m) => raidLandedHere(turnContext, m, prov)))
    o._raidCarriedAt = { turn: G.turn, prov: prov.id }; // Raid the Coast (2026-09-23f)
  return o;
}
