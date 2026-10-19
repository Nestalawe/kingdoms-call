// The new turn's first part in a whole turn (plan P1-08k5a, a stage of resolveTurn's own body lifted out): once
// diplomacy and victory are settled, the turn counter moves on; a Divine king awaiting his return loses it if his realm
// holds no consecrated ground; a realm whose king has fallen crowns an heir in its wealthiest province, or, with no land
// left, its dynasty ends; what was summoned for the turn leaves, a hero hired this turn acts from every phase, and the
// one-turn spell marks end (Illusory Terrain and hidden lairs may fade, Part Sea and Flood give the land back); then the
// Iron Throne's risen skeletons join their winners and the Grand Library gives a Neutral realm one Sage discovery. Each
// case of lib/new-turn-succession-and-summons-cases.ts staged on the middle of a bot world, from plain realms each
// holding only its seat with a living king there (`stageCase`), and played through resolveTurn, every realm
// human-held, every hero Resting unless the case says otherwise, with the case's dice fixed for the whole turn. Level 2
// (scenario): the stage is what the turn does once diplomacy and victory are settled, before the rest of the turn's
// end, so only a whole turn plays it as the game does. unit/new-turn-succession-and-summons-called-directly.test.ts
// calls the stage directly.
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { NEW_TURN_CASES, playCase, stageCase } from '../lib/new-turn-succession-and-summons-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(NEW_TURN_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});
