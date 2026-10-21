// ── kcRng: the game's dice (P1-07) ────
// Every random number the site's own code draws comes from kcRng(): dice, shuffles, bot choices, the world map,
// id suffixes. Nothing calls Math.random (tests/static/dice-and-clock.test.ts). One generator per page: sfc32,
// seeded through splitmix32 so nearby seeds give unrelated streams. It is exactly the generator and seeding of
// seededRandom in tests/lib/boot.js, so a seed plays the sequence the tests have always played.
// It is seeded once, as the page loads: from KC_RNG_SEED when the page was given one before its scripts ran (the
// tests' bootJsdom sets it), or else from crypto.getRandomValues (the live site). Each turn plays from its own seed
// (P1-18e): the turn's shell (src/ui/gm/turn-shell.ts) draws it from these dice and hands it to resolveTurn, which lends
// itself kcRngStream(seed) with kcRng.use and gives the page its own dice back (P1-08m, src/engine/run-turn.ts).
//   kcRng()         the next number in [0, 1)
//   kcRng.seed(n)   starts again from seed n (any number; read as an unsigned 32-bit integer, 0 as 1)
//   kcRng.use(fn)   draws from fn from now on (a turn's dice, a test's fixed dice) and returns what it drew from before:
//                   const was=kcRng.use(()=>0.5); try{ … } finally{ kcRng.use(was); }
export function kcRngStream(seed: number | undefined) {
  let s = Number(seed) >>> 0 || 1;
  const mix = () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
  let a = mix(),
    b = mix(),
    c = mix(),
    d = mix();
  return function () {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
// The generator in use is a property of an object, not a top-level let: with a let, V8 (Node 24.22) sometimes keeps
// the value an optimised kcRng was compiled with, so after kcRng.seed or kcRng.use the dice can quietly go back to the
// old stream (docs/traps.md, "Dice come from kcRng()").
export const _kcRng = {
  next: kcRngStream(typeof KC_RNG_SEED !== 'undefined' ? KC_RNG_SEED : crypto.getRandomValues(new Uint32Array(1))[0]),
};
export function kcRng() {
  return _kcRng.next();
}
kcRng.seed = function (seed: number) {
  _kcRng.next = kcRngStream(seed);
};
kcRng.use = function (fn: () => number) {
  const was = _kcRng.next;
  _kcRng.next = fn;
  return was;
};
