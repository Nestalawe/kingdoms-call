// Loaded into every test file. The property tests (fast-check, P1-04d) take their seed from KC_SEED, like the rest of
// the run, so the same seed generates the same inputs and a failure repeats; the nightly run gives a random KC_SEED.
// A property tries 100 inputs, or 1000 in npm run test:full; a slow one sets fewer in its own parameters.
// A counterexample found is pinned in that property's `examples`, so every later run tries it first.
import fc from 'fast-check';

// As tests/lib/boot.js reads it: a whole number, never 0.
const seed = Number(process.env['KC_SEED']) >>> 0 || 1;

fc.configureGlobal({ seed, numRuns: process.env['KC_FULL'] === '1' ? 1000 : 100 });
