import { homeFounderOf } from '../grand-design.ts';
import { twoATurn } from '../world/tables.ts';
import type { Province } from '../../schemas/saved-game-state.ts';
import type { TurnContext } from '../turn/context.ts';

// ── RECRUIT LIMITS (plan P1-08b: lifted out of resolveTurn) ────
// How many of a unit a province may raise this turn, and the count raised so far (resolveTurn's recruitedThisTurn,
// which joins the turn's context by reference). Each takes the turn's context first (src/engine/turn/context.ts).
export function getRecruitLimit(
  turnContext: TurnContext,
  armyType: string,
  prov: Province,
  playerIndex: number | null,
) {
  const { G } = turnContext;
  if (twoATurn(armyType)) return 2; // garrisons; a shipyard's two hulls a season; Goblin Hordes (2026-10-11)
  // 2026-09-24 (Toby item 10): two a season only in the realm's ORIGINAL home province, and only
  // while its founder still holds it — a captured rival capital (or any other tax-10 seat) is 1.
  return prov.owner === playerIndex && homeFounderOf(G, prov.id) === playerIndex ? 2 : 1;
}
export function canRecruit(
  turnContext: TurnContext,
  armyType: string,
  provId: number,
  prov: Province,
  playerIndex: number | null,
) {
  const { recruitedThisTurn } = turnContext;
  return (recruitedThisTurn[`${provId}:${armyType}`] || 0) < getRecruitLimit(turnContext, armyType, prov, playerIndex);
}
export function recordRecruit(turnContext: TurnContext, armyType: string, provId: number, qty?: number | null) {
  const { recruitedThisTurn } = turnContext;
  const key = `${provId}:${armyType}`;
  recruitedThisTurn[key] = (recruitedThisTurn[key] || 0) + (qty != null ? qty : 1);
}
