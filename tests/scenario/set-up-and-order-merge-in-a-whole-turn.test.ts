// The set-up in a whole turn (plan P1-08k7, the first two stages of resolveTurn's own body lifted out): once the save is
// read and the bots' flags stamped, the turn's start repairs (a wandering hero's beast race, a stranded guard, a
// stranded hull's marker, a "(wandering)" tag on a realm's hero, last turn's orders and scratch lists, the realm each
// hero serves), then the merge of the realms' orders (which rows are read and in what form; the heroes' order in the
// column; orders for another turn; declarations and Safe Start; research choices; the Reckoning; messages;
// concession; orders and plans held for a hero to come; encounter plans; a new heir's choices). Each case of
// lib/set-up-and-order-merge-cases.ts staged on the middle of a bot world, from plain realms each holding only its seat
// with a living king there, and played through resolveTurn with the slot rows the case sends, the case's dice fixed
// for the whole turn; what the set-up leaves is read as the first phase begins, and what follows from it after the
// turn. Level 2 (scenario): the stages are what the turn does first, and what they set is read by every stage after
// them, so only a whole turn plays them as the game does.
// unit/set-up-and-order-merge-called-directly.test.ts calls the two stages directly.
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { SET_UP_CASES, playCase, stageCase } from '../lib/set-up-and-order-merge-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(SET_UP_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});
