// The espionage orders in a whole turn (plan P1-08j6, the sixth family of processOrder's orders taken out of it): Spy
// (on a province or on a hero), Steal, Sabotage, Grand Heist, Assassinate and Vanish. Each case of
// lib/espionage-order-cases.ts staged on the middle of a bot world, from plain realms (`stageCase`), and played through
// resolveTurn, every realm human-held, every other hero Resting, with the case's dice fixed for the whole turn. Level 2
// (scenario): the order is read and checked inside resolveTurn (a mastery order once a turn), a hero who vanished or a
// parcel sent earlier in the turn changes what a later order finds, and the turn's end tells the realms, so only a whole
// turn plays it as a realm gives it. It moved the Spy and Steal parts of xp-small-chances down (the small chance to
// learn after a miss): those fixed the rolls through a hook on a line of these orders.
// unit/espionage-orders-called-directly.test.ts calls each order's own function on the same cases, one phase at a time.
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { ESPIONAGE_ORDER_CASES, recordExperienceRolls, stageCase, withCaseDice } from '../lib/espionage-order-cases.ts';
import { board, playTurn } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
const recording = recordExperienceRolls(engine);

describe.each(ESPIONAGE_ORDER_CASES)('the %s order, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { result, xp } = recording(() =>
      withCaseDice(engine, c.dice, () => playTurn(b, Object.fromEntries(s.orders.map(([h, os]) => [h.id, os])))),
    );
    const { got, want } = c.check(
      {
        world: result.after,
        lines: result.lines.filter((l) => l.charId === s.hero.id),
        all: result.lines,
        turn: b.G.turn,
        xp,
      },
      s,
    );
    expect(got).toEqual(want);
  });
});
