// The bots' plan in a whole turn (plan P1-08l2, lifted out of resolveTurn): the eight passes in which the bot realms
// decide their turn, in order, with what each is handed (the turn's world, the bot realms, the log, the muster's and
// the Spring orders' words, the realms' Reckoning calls), the movement pass's two hooks (the duel forecast for its
// hunters and each company's strength on each terrain), the forecast as the movement pass is handed it, what the passes
// do in game terms (a landless bot concedes, a bot's heroes are given orders, a dominant bot king calls the Reckoning),
// and the merge's collectors reaching the stages that read them. Each case of lib/the-bots-plan-cases.ts staged on the
// middle of a bot world, from plain realms each holding only its seat with a living king there, and played through
// resolveTurn with the slot rows the case sends (the realms it makes bots' with no player), every die fixed for the
// whole turn; each pass is wrapped by a recorder that still calls it. Level 2 (scenario): the plan runs between
// stages before the first phase, on what the merge and those stages made, and only a whole turn makes all of it as the
// game does. unit/the-bots-plan-called-directly.test.ts calls the plan and the forecast directly.
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { BOTS_PLAN_CASES, playCase, stageCase } from '../lib/the-bots-plan-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(BOTS_PLAN_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});
