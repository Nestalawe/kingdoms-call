// The titles at the turn's end in a whole turn (plan P1-08k6, the last two stages of resolveTurn's own body lifted
// out): once the new turn is done, from turn 5 (or once the game is over) the realm holding each Imperial Title is told
// what it shows of the realms it has met — the Throne, the Vaultkeeper, the Grand Marshal, the Sea Lord, the
// Monster-Bane, the Loremaster (who copies one rival's fresh discovery), the Archmage, the Hierophant, the Deathpriest
// (who files what Grave-sight finds), the Spymaster, the Cartographer, the Beastlord and the Wildwarden — with one line
// for the realms it hasn't met; then each realm's titles won and lost since last turn are worked out for its report,
// and this turn's holders kept for the next. Each case of lib/titles-at-the-turns-end-cases.ts staged on the middle of
// a bot world, from plain realms each holding only its seat with a living king there (`stageCase`), and played through
// resolveTurn, every realm human-held, every hero Resting unless the case says otherwise, with the case's dice fixed
// for the whole turn. Level 2 (scenario): the stages are what the turn does last, once the new turn is done, so only a
// whole turn plays them as the game does.
// unit/titles-at-the-turns-end-called-directly.test.ts calls the two stages directly.
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { TITLE_CASES, playCase, stageCase } from '../lib/titles-at-the-turns-end-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(TITLE_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});
