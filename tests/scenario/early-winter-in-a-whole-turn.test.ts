// Early Winter in a whole turn (plan P1-08k2, a stage of resolveTurn's phase loop lifted out): once the last season's
// orders are done, a hero an enemy Charm seized goes home to his own lord; each realm is told its treasury and collects
// its taxes (each province's marks, the discoveries, the heroes' tax gold, interest, trade, the Thief network, the
// minor titles); it owes and pays its wages after the discounts, or, short, loses its rawest companies first (the dead
// last, a ship carrying troops at sea kept), then heroes may desert; Raiders' Muster draws a Goblin Horde to an orcish
// province an orc realm won; and the unled garrison companies drill. Each case of lib/early-winter-cases.ts staged on
// the middle of a bot world, from plain realms (`stageCase`), and played through resolveTurn, every realm human-held,
// every hero Resting, with the case's dice fixed for the whole turn. Level 2 (scenario): Early Winter is what the turn
// does after its last season, so only a whole turn plays it as the game does.
// unit/early-winter-called-directly.test.ts calls the stage directly on the same cases.
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { EARLY_WINTER_CASES, playCase, stageCase } from '../lib/early-winter-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(EARLY_WINTER_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});
