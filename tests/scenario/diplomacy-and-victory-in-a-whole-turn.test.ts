// Diplomacy resolution and victory in a whole turn (plan P1-08k4, two stages of resolveTurn's own body lifted out):
// once the seasons are over, the declarations the realms sent with their orders take effect (overtures told, peace
// made, alliances forged or broken, war declared, with war-front warnings for the hosts on the foe's ground); then the
// Reckoning (a claim lodged, standing, collapsing or judged, the bar eroding while none stands), elimination and
// concession decide whether the game is over, and the result is announced once. Each case of
// lib/diplomacy-and-victory-cases.ts staged on the middle of a bot world of three realms (or four, where an alliance is
// needed), from plain realms (`stageCase`), and played through resolveTurn, every realm human-held, every hero Resting
// unless the case says otherwise, with the case's dice fixed for the whole turn. Level 2 (scenario): the stages are
// what the turn does once the bots have spoken, reading what the realms sent with their orders, so only a whole turn
// plays them as the game does. unit/diplomacy-and-victory-called-directly.test.ts calls the stages directly.
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { DIPLOMACY_AND_VICTORY_CASES, playCase, stageCase } from '../lib/diplomacy-and-victory-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const worlds = { 3: botWorld(engine, 3, { cols: 10, rows: 8 }), 4: botWorld(engine, 4, { cols: 10, rows: 8 }) };

describe.each(DIPLOMACY_AND_VICTORY_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, worlds[c.realms ?? 3], 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});
