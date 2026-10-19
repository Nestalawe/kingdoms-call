// The new turn's second part in a whole turn (plan P1-08k5b, a stage of resolveTurn's own body lifted out): once the
// turn counter has moved on and the new turn's first part is done (P1-08k5a's stage), the War Academy may drill each
// company a realm's heroes keep at home up a grade; Physick Gardens and Royal Physicians mend the wounded; the
// Informant Network names an enemy captain the realm can't see and the Arcane Observatory charts a province it hasn't
// mapped; a Divine realm's hero fallen a full turn ago rises on the nearest consecrated ground it holds, or never
// returns; graves rot; the mercenary bands retire or move on; the turn's flags are cleared, the save's repairs told,
// stale graves of the living purged, each realm remembers the graves it can see; wandering heroes recover and may
// drift; the turn's orders are cleared; every province's list of heroes is rebuilt, and a neutral guard left with no
// companies becomes a wanderer. Each case of lib/new-turn-war-academy-to-the-final-reconcile-cases.ts staged on the
// middle of a bot world, from plain realms each holding only its seat with a living king there (`stageCase`), and
// played through resolveTurn, every realm human-held, every hero Resting unless the case says otherwise, with the
// case's dice fixed for the whole turn. Level 2 (scenario): the stage is what the turn does after its first part,
// before the titles, so only a whole turn plays it as the game does.
// unit/new-turn-war-academy-to-the-final-reconcile-called-directly.test.ts calls the stage directly.
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import {
  NEW_TURN_SECOND_PART_CASES,
  playCase,
  stageCase,
} from '../lib/new-turn-war-academy-to-the-final-reconcile-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(NEW_TURN_SECOND_PART_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});
