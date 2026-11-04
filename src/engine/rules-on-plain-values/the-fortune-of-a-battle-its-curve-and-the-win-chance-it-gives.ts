// ── The fortune of a battle: its curve, and the win chance it gives (plan P1-13i) ────
// The engine's dice step (battleFortune, src/engine/battle/fortune.ts) draws from this curve, and the GM page's statistics
// and the battle's line (src/views/prose/the-words-of-a-battles-lines.ts) read it back, so it lives here, on plain values
// (src/engine/rules-on-plain-values/).
// ── FORTUNE OF BATTLE ── the dice step of every army battle. Instead of two additive rolls off the
// stronger side's strength, ONE swing S is drawn from a fixed, symmetric fortune curve and applied
// as a pair of luck multipliers: attacker × e^(S/2), defender × e^(-S/2). Only the RATIO of the two
// luck factors decides the fight, so luck is proportional to each side's own strength. The curve is
// anchored: a swing that overturns a 2× advantage happens 20% of the time, one that overturns 3×
// happens 10%, and none ever overturns 4× — straight-line interpolation between anchors (in
// log-ratio space). Win chances by ratio: 1.1× 54%, 1.3× 61%, 1.5× 68%, 2× 80%, 3× 90%, 4× 100%.
export const FORTUNE_CURVE = [
  [-Math.log(4), 0],
  [-Math.log(3), 0.1],
  [-Math.log(2), 0.2],
  [0, 0.5],
  [Math.log(2), 0.8],
  [Math.log(3), 0.9],
  [Math.log(4), 1],
] as const satisfies readonly (readonly [number, number])[];
// The curve read back: the chance of a swing at most x, and the attacker's win chance for a strength ratio. The words
// that tell a battle's fortune (fortuneNarrative) are the views' (src/views/prose/the-words-of-a-battles-lines.ts,
// plan P1-12d3); the fortune's line holds the values they are written from.
export function fortuneCdf(x: number) {
  const C = FORTUNE_CURVE;
  if (x <= C[0][0]) return 0;
  for (let i = 1; i < C.length; i++) {
    const below = C[i - 1],
      above = C[i];
    if (!below || !above) continue; // never met: i runs inside the curve
    const [a, fa] = below,
      [b, fb] = above;
    if (x <= b) return fa + (fb - fa) * ((x - a) / (b - a));
  }
  return 1;
}
// Attacker's win chance for a strength ratio r = atk/def: P(S > -ln r).
export function fortuneWinChance(r: number) {
  if (!(r > 0)) return 0;
  if (!isFinite(r)) return 1;
  return 1 - fortuneCdf(-Math.log(r));
}
