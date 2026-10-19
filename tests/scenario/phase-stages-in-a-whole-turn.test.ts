// The four stages of a phase, in a whole turn (plan P1-08k1, the phase loop's stages lifted out of resolveTurn): the
// start of the phase (each season's line, Herbal Lore, a season's marks cleared, a hero hired that season told he
// waits); intents and reactions (a column held in a battle left unresolved, or fought again; a general held by an
// invader at the gates; a Defend on watch from the season's start; a column ordered home arriving first); the orders in
// two tiers (a host raised in a watch given battle at the Defend step, companies handed over before it, a chase, a
// coward, a fallen hero, a war front at the end of Spring); the end of the phase (a watch ended by next season's march,
// a fallen commander's host dispersed). Each case of lib/phase-stage-cases.ts staged on the middle of a bot world, from
// plain realms (`stageCase`), and played through resolveTurn, every realm human-held, every hero without orders
// Resting, with the case's dice fixed for the whole turn. Level 2 (scenario): the stages are what the turn does between
// the orders, so only a whole turn plays them as the game does.
// unit/phase-stages-called-directly.test.ts plays the same cases through the four stages called one phase at a time.
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { recordExperienceRolls } from '../lib/espionage-order-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';
import { PHASE_STAGE_CASES, playCase, stageCase } from '../lib/phase-stage-cases.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
const recording = recordExperienceRolls(engine);

describe.each(PHASE_STAGE_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s, recording), s);
    expect(got).toEqual(want);
  });
});
