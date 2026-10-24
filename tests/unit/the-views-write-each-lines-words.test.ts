// The views write each line's words (plan P1-12c3: P1-12's Decisions of 2026-10-24, Decisions 2 and 3). A typed line
// records a fact (src/engine/battle/the-facts-a-battles-lines-record.ts: a force drawn up for battle, the place of a
// battle's losses tally), and theTurnsLinesInWords (src/views/prose/the-words-of-each-line.ts) writes the turn's lines
// in words: a fact's words as the engine wrote them before, a battle's lines with the tiers their words give ('k' key,
// 'd' detail), its losses tally where its casualty lists begin, and every line in the form the GM's log is stored in,
// key for key, with no fact left in it.
// Level 1 (unit): forceMarker, emitBattle and the words pass are called on a context made in the test; nothing else of
// the turn runs, and every case is a staged battle the test writes. Whole games (the balance matrix and every realm's
// report, both sets) prove the same words and the same stored log in play.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createTurnContext, type TurnContext } from '../../src/engine/turn/context.ts';
import { emitBattle, forceMarker } from '../../src/engine/battle/battle-report-lines-and-force-markers.ts';
import { battleTallyLine } from '../../src/engine/battle/fates.ts';
import {
  emit,
  narrate,
  narrateTo,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  type EventButItsWords,
  type NarrativeLine,
} from '../../src/engine/turn/events-and-their-audiences.ts';
import { theTurnsLinesInWords, theWordsOf } from '../../src/views/prose/the-words-of-each-line.ts';
import type { Army, Province } from '../../src/schemas/saved-game-state.ts';

// emit echoes each line on the console: quiet while the tests write lines.
const consoleLog = console.log;
beforeAll(() => {
  console.log = () => undefined;
});
afterAll(() => {
  console.log = consoleLog;
});

/** Two realms (0 Red, 1 Blue) and their heroes Aldric (7) and Brann (8), in the middle of Summer (phase 1). */
function newContext(): TurnContext {
  const tc = createTurnContext(
    {
      turn: 3,
      players: [
        { name: 'Red', color: '#c33' },
        { name: 'Blue', color: '#33c' },
      ],
      characters: [
        { id: 7, name: 'Aldric', player: 0, alive: true },
        { id: 8, name: 'Brann', player: 1, alive: true },
      ],
      world: { provinces: [] },
    },
    [],
    3,
  ) as unknown as TurnContext;
  tc._logCtx = { charId: 7, phase: 1 };
  tc._currentPhase = 1;
  tc._afterPhases = false;
  tc._battleSeq = 0;
  return tc;
}

const company = (unitName: string): Army => ({ type: 'Men-at-Arms', quality: 'Veteran', race: 'Human', unitName });
const FORD = { id: 4, name: 'Greyford' } as unknown as Province;

/** Aldric's attack on Brann at Greyford: both forces drawn up, the blows, and (unless `noLosses`) both casualty lists. */
function aBattle(tc: TurnContext, noLosses = false): NarrativeLine[] {
  const narrative: NarrativeLine[] = [];
  narrate(narrative, forceMarker(tc, 'Aldric (Red)', 0, 'attacker', [company('Shieldwall')], 'attacks Greyford with'));
  narrate(narrative, forceMarker(tc, 'Brann (Blue)', 1, 'defender', [company('Ford Watch')], 'holds Greyford with'));
  narrate(narrative, 'The hosts meet at the ford.');
  narrate(narrative, '  Shieldwall strikes Ford Watch for 6.');
  if (!noLosses) {
    narrate(narrative, "⚔ **Aldric's forces** (attacker):");
    narrate(narrative, "— Aldric's Shieldwall (Men-at-Arms) hold the bank.");
    narrate(narrative, "🛡 **Brann's forces** (defender):");
    narrate(narrative, "— Brann's Ford Watch (Men-at-Arms) were annihilated.");
  }
  return narrative;
}
const fileTheBattle = (tc: TurnContext, narrative: NarrativeLine[]) => {
  emitBattle(tc, { narrative, summaryText: "Aldric's forces defeat Brann at Greyford." }, FORD, 1, [0, 1], {
    actor: 0,
    charIds: [7, 8],
  });
};

describe("a fact's words are the engine's words before P1-12c3", () => {
  test("a force drawn up for battle: the header's machine form, its keys in their order", () => {
    const tc = newContext();
    const fact = forceMarker(tc, 'Aldric (Red)', 0, 'attacker', [company('Shieldwall')], 'attacks Greyford with', {
      guard: false,
    });
    expect(theWordsOf(fact)).toBe(
      '⚑FORCE⚑{"name":"Aldric (Red)","color":"#c33","neutral":false,"guard":false,"role":"attacker",' +
        '"verb":"attacks Greyford with","armies":[{"type":"Men-at-Arms","quality":"Veteran","unitName":"Shieldwall",' +
        '"race":"Human","phantom":false,"skeletal":false,"wildHunt":false,"wildHuntUntil":null}]}',
    );
    const guard = forceMarker(tc, 'The Chieftain of Greyford', null, 'defender', [], 'guards Greyford with', {
      guard: true,
    });
    expect(theWordsOf(guard)).toBe(
      '⚑FORCE⚑{"name":"The Chieftain of Greyford","color":null,"neutral":true,"guard":true,"role":"defender",' +
        '"verb":"guards Greyford with","armies":[]}',
    );
  });

  test("the place of a battle's tally has no words of its own", () => {
    expect(() => theWordsOf({ kind: "a battle's losses, tallied from its lines" })).toThrow(/tally/);
  });
});

describe("a battle's lines in words", () => {
  test('each takes the tier its words give, and the losses tally goes where the casualty lists begin', () => {
    const tc = newContext();
    const narrative = aBattle(tc);
    fileTheBattle(tc, narrative);
    const { gmLog } = theTurnsLinesInWords(tc.turnLog);
    const words = narrative.map((line) => (typeof line === 'string' ? line : theWordsOf(line as never)));
    const tally = battleTallyLine(words);
    expect(tally).toContain('Men-at-Arms');
    expect(gmLog.map((l) => [l.bTier, l.text])).toEqual([
      ['k', words[0]],
      ['k', words[1]],
      ['k', 'The hosts meet at the ford.'],
      ['d', '  Shieldwall strikes Ford Watch for 6.'],
      ['t', tally],
      ['d', "⚔ **Aldric's forces** (attacker):"],
      ['d', "— Aldric's Shieldwall (Men-at-Arms) hold the bank."],
      ['d', "🛡 **Brann's forces** (defender):"],
      ['d', "— Brann's Ford Watch (Men-at-Arms) were annihilated."],
      ['s', "Aldric's forces defeat Brann at Greyford."],
    ]);
    // every line of it with the fight's audience, hero and place, the tally too
    for (const l of gmLog)
      expect(l).toMatchObject({ battleId: 1, targets: [0, 1], actor: 0, provinceId: 4, phase: 1, charIds: [7, 8] });
  });

  test('a battle with nothing to tally has no tally line, and its tally place is no line', () => {
    const tc = newContext();
    fileTheBattle(tc, aBattle(tc, true));
    const { gmLog, wordsOfEachLine } = theTurnsLinesInWords(tc.turnLog);
    expect(gmLog.map((l) => l.bTier)).toEqual(['k', 'k', 'k', 'd', 's']);
    expect(tc.turnLog.map((l) => l.bTier)).toContain('t');
    expect(wordsOfEachLine[tc.turnLog.findIndex((l) => l.bTier === 't')]).toBeNull();
  });

  test('a battle whose lines are all for one realm alone files no tally place', () => {
    const tc = newContext();
    const narrative: NarrativeLine[] = [];
    narrateTo(narrative, 0, 7, "📈 Aldric's Tactics rises to level 3.");
    fileTheBattle(tc, narrative);
    expect(tc.turnLog.map((l) => l.bTier)).toEqual(["worked out from the words of the battle's lines", 's']);
    expect(theTurnsLinesInWords(tc.turnLog).gmLog.map((l) => [l.bTier, l.targets])).toEqual([
      ['k', [0]],
      ['s', [0, 1]],
    ]);
  });

  test('two battles side by side each take their own tiers and tally', () => {
    const tc = newContext();
    fileTheBattle(tc, aBattle(tc));
    fileTheBattle(tc, aBattle(tc, true));
    const { gmLog } = theTurnsLinesInWords(tc.turnLog);
    expect(gmLog.map((l) => `${String(l.battleId)}${String(l.bTier)}`)).toEqual([
      ...['1k', '1k', '1k', '1d', '1t', '1d', '1d', '1d', '1d', '1s'],
      ...['2k', '2k', '2k', '2d', '2s'],
    ]);
  });
});

describe("the GM's log in words is stored in the form it had", () => {
  const FULL = [
    'type',
    'text',
    'actor',
    'targets',
    'provinceId',
    'public',
    'spy',
    'system',
    'armyEstimate',
    'charId',
    'charIds',
    'phase',
    'pinNotice',
    'env',
    'battleId',
    'bTier',
    'gameEnd',
  ];

  test('every line has its 17 keys in their order, with no fact and no tier left to work out', () => {
    const tc = newContext();
    fileTheBattle(tc, aBattle(tc));
    const { gmLog } = theTurnsLinesInWords(tc.turnLog);
    for (const l of gmLog) {
      expect(Object.keys(l)).toEqual(FULL);
      expect(typeof l.text).toBe('string');
      expect(['k', 'd', 't', 's']).toContain(l.bTier);
    }
    expect(gmLog.filter((l) => l.text?.startsWith('⚑FORCE⚑'))).toHaveLength(2);
  });

  test('a line filed with its words is stored as it was filed, in its place among the rest', () => {
    const tc = newContext();
    const told: EventButItsWords = { audience: { realms: [0] }, hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING };
    emit(tc, { type: 'system', text: 'The levy marches out.', ...told });
    fileTheBattle(tc, aBattle(tc));
    emit(tc, { type: 'system', text: 'The levy comes home.', ...told, form: 'bare' });
    const { gmLog } = theTurnsLinesInWords(tc.turnLog);
    expect(gmLog[0]).toBe(tc.turnLog[0]);
    expect(gmLog.at(-1)).toBe(tc.turnLog.at(-1));
    expect(gmLog).toHaveLength(tc.turnLog.length);
  });
});
