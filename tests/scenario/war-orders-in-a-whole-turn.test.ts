// The war orders in a whole turn (plan P1-08j8, the eighth family of processOrder's orders taken out of it): Encounter
// Character (the quarry checked, the chase set, then carried on in every later phase until the catch), Defend (the
// watch set, kept phase after phase, ridden out, answered in battle), and the war masteries: Blockade, Challenge,
// Rampage, Rain of Arrows, Sniper's Mark, and the flags a later battle of the turn reads (Feigned Retreat, Grand
// Stratagem, Lightning Advance, Raid the Coast). Each case of lib/war-order-cases.ts staged on the middle of a bot
// world, from plain realms (`stageCase`), and played through resolveTurn, every realm human-held, every hero without
// orders Resting, with the case's dice fixed for the whole turn. Level 2 (scenario): the phase loop carries a chase on
// and sets a watch at the top of the phase, a mastery is checked (once a turn, never for a charmed hero) before its
// order is read, and a mastery's flag shows only in a battle later in the turn, so only a whole turn plays them as a
// realm gives them.
// unit/war-orders-called-directly.test.ts calls each order's own function on the same cases, one phase at a time.
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { recordExperienceRolls, withCaseDice } from '../lib/espionage-order-cases.ts';
import { board, playTurn } from '../lib/middle-of-a-bot-world.ts';
import { LANDS, WAR_ORDER_CASES, stageCase } from '../lib/war-order-cases.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
const recording = recordExperienceRolls(engine);

describe.each(WAR_ORDER_CASES)('the %s order, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { result, xp } = recording(() =>
      withCaseDice(engine, c.dice ?? LANDS, () =>
        playTurn(b, Object.fromEntries(s.orders.map(([h, os]) => [h.id, os])), s.written ?? {}),
      ),
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
