// The bots' plan in a whole turn (plan P1-08l2, lifted out of resolveTurn): the eight passes in which the bot realms
// decide their turn, in order, with what each is handed (the turn's world, the bot realms, the context, the muster's and
// the Spring orders' words, the realms' Reckoning calls), the movement pass's two hooks (the duel forecast for its
// hunters and each company's strength on each terrain), the forecast as the movement pass is handed it, what the passes
// do in game terms (a landless bot concedes, a bot's heroes are given orders, a dominant bot king calls the Reckoning),
// and the merge's collectors reaching the stages that read them. Each case of lib/the-bots-plan-cases.ts staged on the
// middle of a bot world, from plain realms each holding only its seat with a living king there, and played through
// resolveTurn with the slot rows the case sends (the realms it makes bots' with no player), every die fixed for the
// whole turn; each pass is wrapped by a recorder that still calls it. Level 2 (scenario): the plan runs between
// stages before the first phase, on what the merge and those stages made, and only a whole turn makes all of it as the
// game does. unit/the-bots-plan-called-directly.test.ts calls the plan and the forecast directly.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The bots' plan (P1-08l2,
// `botRealmsPlanTheTurnConcessionsMovementMusterEconomyActionsSpringOrdersHygieneAndTheReckoning` and the duel forecast
// `botHuntersDuelForecastFoughtOnCopiesOfBothHeroes`, lifted out of `resolveTurn`), played through a whole turn from
// slot rows each case writes (from plain realms each holding only its seat with a living king there, every realm having
// met every other, the realms the case names bots', each case of `lib/the-bots-plan-cases.ts`, in game terms, the dice
// fixed for the whole turn, its lines the GM's log in words: `theTurnsLinesInWords`, since P1-12d6); each pass is
// wrapped by a recorder that still calls it, and the movement pass's recorder asks the forecast it is handed about
// heroes the case stages. The passes: eight, in order (concessions, movement, the muster, the economy, actions, the
// Spring orders, hygiene, the Reckoning), each handed the turn's own world and bot realms (one, two in seat order,
// none, all), beside them the turn's context (whose GM's log the concessions write), the hooks, "muster", nothing,
// nothing, "order", nothing and the realms' calls. The hooks: the forecast and the strength figure, the figure the
// engine's own for every company type on every terrain. The forecast: a champion wins every fight and never falls, a
// weakling falls in each; twenty fights by default and for none, as many as told; the hunter and quarry as they were
// (copies, under ids −1 and −2); experience muted for every fight and given back as it was; no line; the turn's
// context, twenty rounds; a fight that fails gives no forecast; the hunter's plan the engine's own, the quarry's own
// kept when it has tactics, only combat tactics, the plain melee for none. What the passes do: a landless bot concedes,
// told to all (not a human, not a landed bot); a bot's heroes planned for every phase, a conceded bot's not; a human's
// heroes keep what was sent, one sent nothing left for the default to Defend; a dominant bot king calls the Reckoning
// on turn 10 (counted and told), not on turn 9, his call joining a human's. The merge's collectors reaching the stages
// that read them: a war declared, a Safe Start refusal, stale orders, a message, a human's Reckoning call. Level 2: the
// plan runs between stages before the first phase, on what the merge and those stages made
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { BOTS_PLAN_CASES, playCase, stageCase } from '../lib/the-bots-plan-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(BOTS_PLAN_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});
