// The Move order in a whole turn (plan P1-08j1, the first of processOrder's orders taken out of it): each case of
// lib/move-order-cases.ts staged on the middle of a bot world and played through resolveTurn, every realm human-held,
// every other hero Resting. Level 2 (scenario): the order is read, turned into a Move (or refused) and carried out
// inside resolveTurn, so only a whole turn plays it as a realm gives it. unit/move-order-called-directly.test.ts calls
// the Move's own function on the same cases, and on the ones the dice decide.
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { board, playTurn } from '../lib/middle-of-a-bot-world.ts';
import { MOVE_ORDER_CASES } from '../lib/move-order-cases.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe('the Move order, in a whole turn', () => {
  test.each(MOVE_ORDER_CASES.map((c) => [c.name, c] as const))('%s', (_, c) => {
    const b = board(engine, world, 0);
    const s = c.stage(b);
    const { after, lines } = playTurn(b, { [s.mover.id]: s.orders });
    const { got, want } = c.check({ world: after, lines: lines.filter((l) => l.charId === s.mover.id) }, s);
    expect(got).toEqual(want);
  });
});
