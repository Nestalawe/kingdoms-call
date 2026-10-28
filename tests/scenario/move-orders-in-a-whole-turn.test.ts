// The Move order in a whole turn (plan P1-08j1, the first of processOrder's orders taken out of it): each case of
// lib/move-order-cases.ts staged on the middle of a bot world and played through resolveTurn, every realm human-held,
// every other hero Resting. Level 2 (scenario): the order is read, turned into a Move (or refused) and carried out
// inside resolveTurn, so only a whole turn plays it as a realm gives it. unit/move-order-called-directly.test.ts calls
// the Move's own function on the same cases, and on the ones the dice decide.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The Move order (P1-08j1), played through a whole turn (`resolveTurn` in the bare `vm`, `playTurn` in
// `lib/middle-of-a-bot-world.ts`) on the middle of a bot world, every realm human-held: each case of
// `lib/move-order-cases.ts`, in game terms. A column claims an empty neighbour named by id, `prov:<id>` or `dir:`; an
// unarmed hero only explores; a slow column under March 5 marches four times and is refused the fifth; a target two
// away is reached a step a season; the map's edge bars the way; a neutral realm's border turns a column back but lets
// an unarmed hero through; an ally's land is walked into; an enemy province is seized when empty, taken from a broken
// garrison and from a beaten hero (who falls back next door); a beaten neutral guard flees and the province is claimed
// with its merit, or he rallies and it is contested (the dice decide which: both are checked to hold together); a fleet
// sails, land troops without ships can't, a fleet lands its troops, a column with ships can't march overland; lairs
// spotted on the way in are told after the march; Forced March (March 7) is a Move once a turn and refused without
// March 7. Each case is certain (overwhelming battles, a beaten defender's own province next door). Level 2: the order
// is read and turned into a Move inside `resolveTurn`
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
