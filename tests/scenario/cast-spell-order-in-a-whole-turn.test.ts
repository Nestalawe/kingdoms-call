// The Cast Spell order in a whole turn (plan P1-08j7, the seventh family of processOrder's orders taken out of it): the
// casting itself (the spell named, the casting limits, a mastery spell once a turn, the cast chance and its roll, a
// spell item's cast, the Wailing Phylactery, a mark gone, vanished, veiled or cloaked) and every spell a hero can work
// as a phase order, school by school. Each case of lib/cast-spell-order-cases.ts staged on the middle of a bot world,
// from plain realms (`stageCase`), and played through resolveTurn, every realm human-held, every other hero Resting,
// with the case's dice fixed for the whole turn. Level 2 (scenario): the order is read inside resolveTurn (a spell
// item's Use Item becomes a cast there), the casting limit counts the hero's earlier orders of the turn, a hero raised
// or charmed takes up the orders his realm wrote for him, and the turn's end takes back what lasts only a turn (a
// charmed hero goes home, a summoned elemental dissolves, a flood recedes), so only a whole turn plays it as a realm
// gives it. It moved the Cast Spell part of xp-small-chances down (a fizzle's small chance to learn): that fixed the
// roll through a hook on a line of this order.
// unit/cast-spell-order-called-directly.test.ts calls the order's own function on the same cases, one phase at a time.
import { describe, expect, test } from 'vitest';
import { CAST_SPELL_ORDER_CASES, LANDS, stageCase } from '../lib/cast-spell-order-cases.ts';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { recordExperienceRolls, withCaseDice } from '../lib/espionage-order-cases.ts';
import { board, playTurn } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
const recording = recordExperienceRolls(engine);

describe.each(CAST_SPELL_ORDER_CASES)('Cast Spell (%s), in a whole turn', (_, cases) => {
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
