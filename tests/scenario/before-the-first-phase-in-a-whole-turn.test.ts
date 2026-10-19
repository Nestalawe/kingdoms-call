// Before the first phase in a whole turn (plan P1-08k8, four stages of resolveTurn's own body lifted out): once the
// realms' orders are merged, the relations made ready and last turn's research choices settled (the bots picking for
// themselves); war without warning, the titles held going into the turn, the Safe Start's and the stale orders' lines,
// the realms the GM removed, the realms' messages; the move pools, the turn's trackers, what lasts a turn cleared and
// the save's sweeps; and, once the bots have planned, the default to Defend, the turn's record of orders and the war
// fronts at the start. Each case of lib/before-the-first-phase-cases.ts staged on the middle of a bot world, from plain
// realms each holding only its seat with a living king there, and played through resolveTurn with the slot rows the
// case sends, the case's dice fixed for the whole turn; the world and the turn's context are read as the first phase
// begins. Level 2 (scenario): the stages are what the turn does between the merge and the first phase, around the
// bots' passes, and every phase reads what they set, so only a whole turn plays them as the game does.
// unit/before-the-first-phase-called-directly.test.ts calls the four stages directly.
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { BEFORE_CASES, playCase, stageCase } from '../lib/before-the-first-phase-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(BEFORE_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});
