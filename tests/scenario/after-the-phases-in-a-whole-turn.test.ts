// After the phases in a whole turn (plan P1-08k3, the first stage of resolveTurn's own body lifted out): once the five
// seasons are played, a stand-off struck in the last one is flagged; skeletal companies with no necromancer to lead
// them crumble, their realm told; a necromancer who never moved senses the graves where he stands; a wandering hero may
// learn a skill; a consecrated province that changed hands loses its blessing; couriers deliver their parcels; Elven
// companies that slipped a lost battle reach home; a fallen commander's host is settled; intrusions are told once;
// lair guardians recover; Mass Healing mends a White master's friends; maximum HP is resynced, with an old save's note;
// a coward spared on the field goes home, his host left behind; and every location name is brought up to date. Each
// case of lib/after-the-phases-cases.ts staged on the middle of a bot world, from plain realms (`stageCase`), and
// played through resolveTurn, every realm human-held, every hero Resting unless the case says otherwise, with the
// case's dice fixed for the whole turn. Level 2 (scenario): the stage is what the turn does after its phases, so only
// a whole turn plays it as the game does. unit/after-the-phases-called-directly.test.ts calls the stage directly.
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { AFTER_THE_PHASES_CASES, playCase, stageCase } from '../lib/after-the-phases-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(AFTER_THE_PHASES_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});
