// The bots' diplomacy in a whole turn (plan P1-08l1, lifted out of resolveTurn): each bot realm's Treat or war on each
// rival it had met when the turn began, by the grudge, Safe Start, the Aggressive setting, a claim to the throne, the
// grudge's truce, alignment and the war assessment, made before the first phase and again just before diplomacy is
// resolved. Each case of lib/bot-diplomacy-cases.ts staged on the middle of a bot world, from plain realms each holding
// only its seat with a living king there, and played through resolveTurn with the slot rows the case sends (the realms
// it makes bots' with no player), every die fixed for the whole turn; the realms' declarations are read once the bots
// have declared before the first phase and again just before diplomacy is resolved. Level 2 (scenario): the bots
// declare twice in a turn, around the phases, and only a whole turn plays both as the game does.
// unit/bot-diplomacy-called-directly.test.ts calls the function directly.
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { BOT_DIPLOMACY_CASES, playCase, stageCase } from '../lib/bot-diplomacy-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(BOT_DIPLOMACY_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});
