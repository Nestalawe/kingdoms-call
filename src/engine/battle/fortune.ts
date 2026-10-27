import { KC_SKILLS } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';

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
// The dice's swing, and the two luck multipliers it gives.
interface FortuneOfABattle {
  S: number;
  atk: number;
  def: number;
}
export function battleFortune(): FortuneOfABattle {
  const u = kcRng();
  for (let i = 1; i < FORTUNE_CURVE.length; i++) {
    const below = FORTUNE_CURVE[i - 1],
      above = FORTUNE_CURVE[i];
    if (!below || !above) continue; // never met: i runs inside the curve
    const [a, fa] = below,
      [b, fb] = above;
    if (u <= fb) {
      const S = a + (b - a) * ((u - fa) / (fb - fa));
      return { S, atk: Math.exp(S / 2), def: Math.exp(-S / 2) };
    }
  }
  return { S: 0, atk: 1, def: 1 };
}
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
// unbiased Fisher-Yates shuffle (returns a NEW array; rnd defaults to kcRng). Every former
// `.sort(()=>Math.random()-0.5)` now goes through here — that comparator is not a fair shuffle
// (engine-dependent, and it leaves elements near their original positions far more often than
// chance), which skewed "pick n at random" draws toward the front of the list.
export function shuffleP<T>(arr: Iterable<T>, rnd: () => number = kcRng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const ai = a[i],
      aj = a[j];
    // never met: i and j are places in the copy, so what was read there is one of its elements (even undefined)
    if (!isAPlaceIn(a, i, ai) || !isAPlaceIn(a, j, aj)) continue;
    [a[i], a[j]] = [aj, ai];
  }
  return a;
}
// Whether `read` is the element at place `k` of `list` (so one of its elements, even an undefined one).
function isAPlaceIn<T>(list: readonly T[], k: number, read: T | undefined): read is T {
  return k in list && Object.is(list[k], read);
}
export const ABILITIES_P = KC_SKILLS.slice();
