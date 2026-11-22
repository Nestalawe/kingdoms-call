// The sea share the GM picks (moved out of src/engine/world/generate.ts as it was, B-06v): its least, its most and its
// default, and the share a game's options give, made a whole number within them. The set-up (S0) reads it, and
// generate.ts hands it on to the GM page's Turn 0 and its game list.
import { THE_SEA_SHARE_THE_GM_PICKS } from '../../../content/the-worlds-making-its-numbers-by-stage-the-sea-the-capitals-the-taxes-the-lairs-the-seas-the-homes-and-the-heroes.ts';

// ── SEA SHARE (2026-09-25, Toby) ── the GM picks what share of the world is water, 20–80%.
// Before this the fill rolled sea at 28% (55% beside water) and the result was whatever came out:
// measured over 20 worlds per rung it averaged ~33% and ranged 18–50% on the same settings. The
// share is now EXACT (rounded to a province): the same clustered fill lays out coherent seas, then
// coasts are grown or shrunk until the count matches. Home cells and their tailored rings are never
// touched, so every home guarantee (≤2 sea neighbours, a poor and a prosperous land, a sea for a
// naval king) holds at any share.
export const SEA_PCT_MIN = THE_SEA_SHARE_THE_GM_PICKS.theLeast,
  SEA_PCT_MAX = THE_SEA_SHARE_THE_GM_PICKS.theMost,
  SEA_PCT_DEFAULT = THE_SEA_SHARE_THE_GM_PICKS.theDefault;
export function normSeaPct(v: unknown) {
  let pct = parseInt(String(v));
  if (!Number.isFinite(pct)) pct = SEA_PCT_DEFAULT;
  return Math.max(SEA_PCT_MIN, Math.min(SEA_PCT_MAX, pct));
}
