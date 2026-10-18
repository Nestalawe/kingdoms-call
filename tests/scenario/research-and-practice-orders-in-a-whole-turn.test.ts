// The research and practice orders in a whole turn (plan P1-08j4, the fourth family of processOrder's orders taken
// out of it): Research, Practice Skill, Rest and Research Breakthrough. Each case of
// lib/research-and-practice-order-cases.ts staged on the middle of a bot world, from plain realms (`stageCase`), and
// played through resolveTurn, every realm human-held, every other hero Resting. Level 2 (scenario): the order is read,
// checked (a mastery once a turn) and carried out inside resolveTurn, Practice compares each hero with the skills
// every comrade had at the start of the phase, and the turn's end tells a hero who did nothing where he stands, so
// only a whole turn plays it as a realm gives it.
// unit/research-and-practice-orders-called-directly.test.ts calls each order's own function on the same cases, and
// on the ones the dice decide.
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { board, playTurn } from '../lib/middle-of-a-bot-world.ts';
import { RESEARCH_AND_PRACTICE_ORDER_CASES, stageCase } from '../lib/research-and-practice-order-cases.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(RESEARCH_AND_PRACTICE_ORDER_CASES)('the %s order, in a whole turn', (_, cases) => {
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
