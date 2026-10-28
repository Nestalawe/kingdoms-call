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
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The four stages of a phase (P1-08k1, when they left `resolveTurn`'s phase loop), played through a whole turn
// (`playTurn`, from plain realms: `stageCase`): each case of `lib/phase-stage-cases.ts`, in game terms, with its dice
// fixed for the whole turn. The start of the phase: each season's opening line, in order; Herbal Lore dressing the
// wounds of last turn's last season (at least 1 HP, never past the maximum; not for a realm without it, another realm's
// hero, one at his maximum, one no weaker than as the season began, or one the save has no HP for); a stale mark from
// the save (a stalled battle fought, a hunt met) that would hold a column or stop a hunt; a hero a save carries as
// hired in a season told he waits. Intents and reactions: a column still in last season's unresolved battle held (a
// Move or an Encounter, not a Rest, not a lone comrade), or fought again as the season opened; a general whose province
// is invaded before he leaves held at home in silence; a Defend given this season riding out that season; a column
// ordered home ahead of an invader arriving first and going no further, and told where the season leaves him when the
// invader never comes. The orders in two tiers: a host raised in a general's watch given battle at the Defend step that
// season, and after the orders when nobody marches; companies handed to a general before he rides out; a chase
// suspending his other orders; a coward who begged for mercy doing nothing more, told each season where it leaves him;
// a fallen hero's orders unanswered, told once; a war front fought at the end of Spring, after its orders. The end of
// the phase: a fallen commander's host garrisoned once its battle is over; a Move or an Encounter next season ending a
// watch
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
