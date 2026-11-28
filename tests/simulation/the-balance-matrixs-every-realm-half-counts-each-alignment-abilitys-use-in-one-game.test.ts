// The balance matrix's every-realm half counts each alignment ability's use (tools/balance/every-realm.ts, B-17c): over
// one of the matrix's own games, set A's bots-04 (its seed, size and realms pinned by the matrix), the count that rides
// on the game's result is the one the matrix gave when the count was built, key by key. It guards the wiring the unit
// cases can't reach: the turn's lines with their facts, its orders from the telemetry, the states before and after,
// the world's making. bots-04 holds every kind of rule: a line's kind (the blood harvest, skeletal fervour, a Pagan
// realm's zeal), an order (Harvest the Field, Perform Rite), a fact (war without warning), the state (graves kept), a
// stand-in (the risen dead) and the set-up. A change to how the games play changes the figures: the balance matrix
// names it first, and this test's figures change with the baseline in the same pull request.
// Level 3 (simulation): it plays a whole game in the engine's vm, with every realm's report, as the matrix does.
import { expect, test } from 'vitest';
import { playEveryRealm } from '../../tools/balance/every-realm.ts';
import { matrix } from '../../tools/balance/matrix.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

/** bots-04's count, key by key, by realm (the keys it never uses: none). */
const BOTS_04 = {
  'zeal-of-a-pagan-realm': { 0: 5 },
  'skeletal-fervour': { 2: 10 },
  'a-pagan-victors-blood-harvest': { 0: 16 },
  'plunder-or-enslave': { 1: 5 },
  'graves-keep-on-undead-land': { 2: 31 },
  'war-without-warning-of-an-evil-realm': { 1: 1 },
  'war-without-warning-of-an-undead-realm': { 2: 1 },
  'the-risen-dead-follow-only-the-undead': { 2: 10 },
  'an-evil-king-starts-with-druid': { 1: 1 },
  'a-pagan-king-starts-with-explorer': { 0: 1 },
  'an-undead-king-starts-with-necromancy': { 2: 1 },
  'an-undead-king-starts-with-a-skeletal-company': { 2: 1 },
  'a-pagan-capital-opens-beside-the-ritual-stones': { 0: 1 },
  'an-evil-capital-opens-beside-monsters': { 1: 1 },
  'one-undead-realm-a-game': { 2: 1 },
  'harvest-the-field': { 2: 1 },
  'perform-rite': { 0: 1 },
};

test(
  "one matrix game's count of each alignment ability's use, key by key, as the matrix gave it",
  timeLimitForTheWork({ matrixGamesPlayed: 1 }),
  () => {
    const spec = matrix('A').find((g) => g.id === 'bots-04');
    expect(spec, 'bots-04 is a game of set A').toBeDefined();
    if (!spec) return;
    const { abilityUses = {}, leaks } = playEveryRealm(spec);
    expect(leaks, 'the leak checks').toEqual([]);
    const used = Object.fromEntries(Object.entries(abilityUses).filter(([, by]) => Object.keys(by).length > 0));
    expect(used, "bots-04's count").toEqual(BOTS_04);
  },
);
