// A province taken from a realm (setProvinceOwner, src/engine/realms/relations-and-captures.ts) tells the realm that
// lost it, and, if it was consecrated, that its consecration is broken. Both lines went straight into the GM's log
// before emit (plan P1-12a2): they keep that form, the 14 keys with no battle fields, to that realm alone, with no hero
// (a real null, not the hero whose order is resolving) and, after the phases with no phase given, no phase (a real
// null, not the End of Turn's 99 that log() would give). Passes on p1-12a1 and on P1-12a2 (nothing stored changes).
// Level 1 (unit): setProvinceOwner is called on a context made in the test; nothing else of the turn runs. Whole games
// rarely take a consecrated province, and never after the phases with no phase given.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createTurnContext, type TurnContext } from '../../src/engine/turn/context.ts';
import { setProvinceOwner } from '../../src/engine/realms/relations-and-captures.ts';
import { theTurnsLinesInWords } from '../../src/views/prose/the-words-of-each-line.ts';

// The GM's log echoes each line on the console: quiet while the test writes lines.
const consoleLog = console.log;
beforeAll(() => {
  console.log = () => undefined;
});
afterAll(() => {
  console.log = consoleLog;
});

describe('the lines a capture writes', () => {
  // Two realms; realm 0 holds province 0, consecrated; realm 1 takes it, after the phases, with no phase given.
  const capture = () => {
    const G = {
      turn: 3,
      players: [
        { name: 'Esterhold', consecratedProvIds: [0] },
        { name: 'Varn', consecratedProvIds: [] },
      ],
      world: { provinces: [{ id: 0, name: 'Wendmeadow', owner: 0 }] },
      characters: [],
    };
    const tc = createTurnContext(G, [], 3) as unknown as TurnContext;
    tc._logCtx = { charId: 7, phase: null };
    tc._currentPhase = null;
    tc._afterPhases = true;
    tc._tel = {
      pre: {},
      orders: {},
      battles: [],
      encounters: [],
      captures: [],
      deaths: [],
      spells: [],
      hires: [],
      recruits: [],
    };
    setProvinceOwner(tc, G.world.provinces[0], 1, null, undefined);
    // the lines as the GM's log stores them, in words (since P1-12d17 they are facts, written by the views)
    return theTurnsLinesInWords(tc.turnLog).gmLog;
  };

  test("are the bare form, to the realm that lost it, with no hero and no phase (not the End of Turn's 99)", () => {
    const lines = capture();
    expect(lines.map((l) => l.text)).toEqual([
      expect.stringContaining('The consecration of Wendmeadow is broken'),
      expect.stringContaining('Wendmeadow has been captured from you by an unknown commander (Varn)'),
    ]);
    for (const line of lines) {
      expect(Object.keys(line)).toHaveLength(14);
      expect(line).toMatchObject({
        type: 'system',
        targets: [0],
        actor: null,
        charId: null,
        phase: null,
        public: false,
      });
    }
  });
});
