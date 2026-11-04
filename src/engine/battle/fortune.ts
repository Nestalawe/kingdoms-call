import { KC_SKILLS } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { FORTUNE_CURVE } from '../rules-on-plain-values/the-fortune-of-a-battle-its-curve-and-the-win-chance-it-gives.ts';

// ── FORTUNE OF BATTLE ── the dice step of every army battle: ONE swing S drawn from the fixed fortune curve (its
// anchors and what they mean: src/engine/rules-on-plain-values/the-fortune-of-a-battle-its-curve-and-the-win-chance-it-gives.ts)
// and applied as a pair of luck multipliers, attacker × e^(S/2), defender × e^(-S/2).
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
