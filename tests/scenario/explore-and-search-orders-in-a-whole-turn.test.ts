// The explore and search orders in a whole turn (plan P1-08j2, the second family of processOrder's orders taken out of
// it): Explore, Perform Rite, Hunting Rumours, Search Lair, Chart the Unknown and Discover Lost Ruin. Each case of
// lib/explore-and-search-order-cases.ts staged on the middle of a bot world and played through resolveTurn, every realm
// human-held, every other hero Resting. Level 2 (scenario): the order is read, checked (a mastery once a turn, a search
// written for another province) and carried out inside resolveTurn, so only a whole turn plays it as a realm gives it.
// unit/explore-and-search-orders-called-directly.test.ts calls each order's own function on the same cases, and on the
// ones the dice decide.
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { EXPLORE_AND_SEARCH_ORDER_CASES } from '../lib/explore-and-search-order-cases.ts';
import { board, playTurn } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(EXPLORE_AND_SEARCH_ORDER_CASES)('the %s order, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = c.stage(b);
    const { after, lines } = playTurn(b, { [s.hero.id]: s.orders });
    const { got, want } = c.check(
      { world: after, lines: lines.filter((l) => l.charId === s.hero.id), turn: b.G.turn },
      s,
    );
    expect(got).toEqual(want);
  });
});
