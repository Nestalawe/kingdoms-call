// The recruit, hire and realm's works orders in a whole turn (plan P1-08j3, the third family of processOrder's orders
// taken out of it): Recruit Armies, Hire Hero, Consecrate, Call to Arms, Broker, Harvest the Field, Awaken Grove, Wild
// Calling, Grand Design, and the refusal of the removed Awaken the Wild and Call from the Pit. Each case of
// lib/recruit-hire-and-realm-works-order-cases.ts staged on the middle of a bot world, from plain realms (`stageCase`),
// and played through resolveTurn, every realm human-held, every other hero Resting; the orders a realm writes for a
// hero it means to hire go in as it sends them (`hired_<hero>_via_<hirer>_ph<phase>`). Level 2 (scenario): the order is
// read, checked (a mastery once a turn) and carried out inside resolveTurn, and some of what it does reaches the turn's
// end (the grove's Ents go home), so only a whole turn plays it as a realm gives it.
// unit/recruit-hire-and-realm-works-orders-called-directly.test.ts calls each order's own function on the same cases,
// and on the ones the dice decide.
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { board, playTurn, type Order } from '../lib/middle-of-a-bot-world.ts';
import { RECRUIT_HIRE_AND_WORKS_ORDER_CASES, stageCase } from '../lib/recruit-hire-and-realm-works-order-cases.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(RECRUIT_HIRE_AND_WORKS_ORDER_CASES)('the %s order, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const written: Record<number, Record<string, Order[]>> = {};
    if (s.written && s.other && s.hero.player != null) {
      const ph = s.orders.findIndex((x) => x.action === 'hire');
      written[s.hero.player] = { [`hired_${String(s.other.id)}_via_${String(s.hero.id)}_ph${String(ph)}`]: s.written };
    }
    const { after, lines } = playTurn(b, { [s.hero.id]: s.orders }, written);
    const { got, want } = c.check(
      { world: after, lines: lines.filter((l) => l.charId === s.hero.id), all: lines, turn: b.G.turn },
      s,
    );
    expect(got).toEqual(want);
  });
});
