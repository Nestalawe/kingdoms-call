// The item and army orders in a whole turn (plan P1-08j5, the fifth family of processOrder's orders taken out of it):
// Equip Items, Use Item, Send Item, Leave/Transfer Army, Release Hero, Disband Army and Pick Up Army. Each case of
// lib/item-and-army-order-cases.ts staged on the middle of a bot world, from plain realms (`stageCase`), and played
// through resolveTurn, every realm human-held, every other hero Resting. Level 2 (scenario): the order is read and
// checked inside resolveTurn (a hero held by an enchantment won't disband), a courier's parcel arrives at the turn's
// end, and the turn's end crumbles the dead left with no one to command them and moves bands of mercenaries on, so
// only a whole turn plays it as a realm gives it.
// unit/item-and-army-orders-called-directly.test.ts calls each order's own function on the same cases, one phase at a
// time.
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { ITEM_AND_ARMY_ORDER_CASES, stageCase } from '../lib/item-and-army-order-cases.ts';
import { board, playTurn } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(ITEM_AND_ARMY_ORDER_CASES)('the %s order, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { after, lines } = playTurn(b, Object.fromEntries(s.orders.map(([h, os]) => [h.id, os])));
    const { got, want } = c.check(
      { world: after, lines: lines.filter((l) => l.charId === s.hero.id), all: lines, turn: b.G.turn },
      s,
    );
    expect(got).toEqual(want);
  });
});
