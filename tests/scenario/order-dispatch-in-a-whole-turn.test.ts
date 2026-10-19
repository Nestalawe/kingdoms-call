// The checks processOrder makes before any hero's order, in a whole turn (plan P1-08j9, processOrder lifted out of
// resolveTurn): a hero who joined another's assault superseded; the order's name as the order form or an old save
// writes it; a bot's Practice on a skill at 5 and a bot's Search (too hurt, talk not heard, written for another
// province); the battle lock on a Move or an Encounter; a charmed enemy hero's refusals; a mastery once a turn; the
// Forced March; a spell item's Use Item. Each case of lib/order-dispatch-cases.ts staged on the middle of a bot world,
// from plain realms (`stageCase`), and played through resolveTurn, every realm human-held but the bots a case names
// (their heroes' orders written in as the bots' own), every hero without orders Resting, with the case's dice fixed for
// the whole turn. Level 2 (scenario): the phase loop makes what most checks read (an assault a friend joins, a battle
// joined earlier in the season, a skill risen in an earlier one, a mastery already spent), and the bots plan inside the
// turn, so only a whole turn plays them as the game does.
// unit/order-dispatch-called-directly.test.ts calls processOrder itself on the same cases, one phase at a time.
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { recordExperienceRolls } from '../lib/espionage-order-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';
import { ORDER_DISPATCH_CASES, asTheBotsPlan, playCase, stageCase } from '../lib/order-dispatch-cases.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
const recording = recordExperienceRolls(engine);
const bots = asTheBotsPlan(engine);

describe.each(ORDER_DISPATCH_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s, bots, recording), s);
    expect(got).toEqual(want);
  });
});
