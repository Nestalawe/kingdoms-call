// The views write each line's words (plan P1-12c3: P1-12's Decisions of 2026-10-24, Decisions 2 and 3). A typed line
// records a fact (src/engine/battle/the-facts-a-battles-lines-record.ts: a force drawn up for battle, the place of a
// battle's losses tally), and theTurnsLinesInWords (src/views/prose/the-words-of-each-line.ts) writes the turn's lines
// in words: a fact's words as the engine wrote them before, a battle's lines with the tiers their words give ('k' key,
// 'd' detail), its losses tally where its casualty lists begin, and every line in the form the GM's log is stored in,
// key for key, with no fact left in it.
// Level 1 (unit): forceMarker, emitBattle and the words pass are called on a context made in the test; nothing else of
// the turn runs, and every case is a staged battle the test writes. Whole games (the balance matrix and every realm's
// report, both sets) prove the same words and the same stored log in play.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The views write each line's words (P1-12c3; plan P1-12's Decisions of 2026-10-24, 2 and 3): `theWordsOf` a force
// drawn up for battle is the header's machine form the engine wrote before, its keys in their order (a chieftain's
// force too), and the place of a battle's tally has no words of its own; `theTurnsLinesInWords` gives a battle's lines
// the tiers their words give and puts its losses tally where its casualty lists begin, every line with the fight's
// audience, hero and place; a battle with nothing to tally has no tally line, one whose lines are all for one realm
// alone files no tally place, two battles side by side keep their own; the GM's log in words has the 17 keys in their
// order, no fact and no tier left to work out, and a line that holds its words already is stored as it is. Red on the
// plants of the row's PR (a force's words without `guard`, the tally always last, every tier `'k'`). Level 1:
// `forceMarker`, `emitBattle` and the words pass on a context made in the test
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createTurnContext, type TurnContext } from '../../src/engine/turn/context.ts';
import { emitBattle, forceMarker } from '../../src/engine/battle/battle-report-lines-and-force-markers.ts';
import { battleTallyLine } from '../../src/engine/battle/fates.ts';
import {
  emit,
  narrate,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  type EventButItsWords,
  type LogLine,
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

/** How Aldric's host comes on at Greyford, and how Brann's and the chieftain's stand there, as the headers' verbs tell
 *  it (P1-12d20: its values; the prose writes the words). */
const ATTACKS_GREYFORD = {
  itsVerbs: 'an attack',
  verbIndex: 3,
  provName: 'Greyford',
  armyStrength: 12,
  tacticalLevel: 2,
} as const;
const HOLDS_GREYFORD = {
  itsVerbs: 'a defence',
  verbIndex: 0,
  provName: 'Greyford',
  armyStrength: 9,
  tacticalLevel: 0,
} as const;
const THE_CHIEFTAIN_GUARDS_GREYFORD = {
  itsVerbs: 'a defence',
  verbIndex: 4,
  provName: 'Greyford',
  armyStrength: 0,
  tacticalLevel: null,
} as const;

/** Aldric's attack on Brann at Greyford: both forces drawn up, the blows, and (unless `noLosses`) both casualty lists. */
function aBattle(tc: TurnContext, noLosses = false): NarrativeLine[] {
  const narrative: NarrativeLine[] = [];
  narrate(narrative, forceMarker(tc, 'Aldric (Red)', 0, 'attacker', [company('Shieldwall')], ATTACKS_GREYFORD));
  narrate(narrative, forceMarker(tc, 'Brann (Blue)', 1, 'defender', [company('Ford Watch')], HOLDS_GREYFORD));
  narrate(narrative, { kind: 'the battle for a province begins', provName: 'Greyford' });
  narrate(narrative, { kind: "the defender's feigned retreat springs shut", defName: 'Brann' });
  if (!noLosses) {
    narrate(narrative, { kind: "the attacker's casualties begin", atkName: 'Aldric' });
    narrate(narrative, { kind: "a side's other forces survive the engagement", someUnitsFateIsToldAbove: false });
    narrate(narrative, { kind: "the defender's casualties begin", defName: 'Brann' });
    narrate(narrative, { kind: 'a unit is cut down with no escape', unitName: "Brann's Ford Watch (Men-at-Arms)" });
  }
  return narrative;
}
/** The battle's summary for the onlookers: Aldric's forces take Greyford from Brann. */
const THE_SUMMARY = {
  kind: 'the attacker wins the battle and seizes the province',
  severity: 'decisive',
  atkName: 'Aldric',
  winVerbIndex: 0,
  defName: 'Brann',
  provName: 'Greyford',
} as const;
const fileTheBattle = (tc: TurnContext, narrative: NarrativeLine[]) => {
  emitBattle(tc, { narrative, summaryText: THE_SUMMARY }, FORD, 1, [0, 1], {
    actor: 0,
    charIds: [7, 8],
  });
};

describe("a fact's words are the engine's words before P1-12c3", () => {
  test("a force drawn up for battle: the header's machine form, its keys in their order", () => {
    const tc = newContext();
    const fact = forceMarker(tc, 'Aldric (Red)', 0, 'attacker', [company('Shieldwall')], ATTACKS_GREYFORD, {
      guard: false,
    });
    expect(theWordsOf(fact)).toBe(
      '⚑FORCE⚑{"name":"Aldric (Red)","color":"#c33","neutral":false,"guard":false,"role":"attacker",' +
        '"verb":"attacks Greyford under Tactical 2 command — army strength 12, with","armies":[{"type":"Men-at-Arms","quality":"Veteran","unitName":"Shieldwall",' +
        '"race":"Human","phantom":false,"skeletal":false,"wildHunt":false,"wildHuntUntil":null}]}',
    );
    const guard = forceMarker(tc, 'The Chieftain of Greyford', null, 'defender', [], THE_CHIEFTAIN_GUARDS_GREYFORD, {
      guard: true,
    });
    expect(theWordsOf(guard)).toBe(
      '⚑FORCE⚑{"name":"The Chieftain of Greyford","color":null,"neutral":true,"guard":true,"role":"defender",' +
        '"verb":"guards Greyford — army strength 0, with","armies":[]}',
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
    const words = narrative.map((line) => theWordsOf(line));
    const tally = battleTallyLine(words);
    expect(tally).toContain('Men-at-Arms');
    expect(gmLog.map((l) => [l.bTier, l.text])).toEqual([
      ['k', words[0]],
      ['k', words[1]],
      ['k', words[2]],
      ['d', words[3]],
      ['t', tally],
      ['d', words[4]],
      ['d', words[5]],
      ['d', words[6]],
      ['d', words[7]],
      ['s', theWordsOf(THE_SUMMARY)],
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
    narrate(narrative, {
      kind: "a hero's hit points rise in a fight, for his realm alone",
      realm: 0,
      hero: 7,
      heroName: 'Aldric',
      rise: { gain: 3, maxHp: 23, wound: true },
    });
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

  test('a line that holds its words already is stored as it is, in its place among the rest', () => {
    // emit files every line as a fact (P1-12d18); a line holding its words, as the GM's log stores it, is made here
    // from one emit filed.
    const tc = newContext();
    const told: EventButItsWords = { audience: { realms: [0] }, hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING };
    const aLine = { kind: 'the battle for a province begins', provName: 'Greyford' } as const;
    const inWords = (text: string) => {
      const line = tc.turnLog.pop();
      if (line === undefined) throw new Error('no line filed');
      const stored: LogLine = { ...line, text };
      delete stored.fact;
      tc.turnLog.push(stored);
    };
    emit(tc, { type: 'system', fact: aLine, ...told });
    inWords('The levy marches out.');
    fileTheBattle(tc, aBattle(tc));
    emit(tc, { type: 'system', fact: aLine, ...told, form: 'bare' });
    inWords('The levy comes home.');
    const { gmLog } = theTurnsLinesInWords(tc.turnLog);
    expect(gmLog[0]).toBe(tc.turnLog[0]);
    expect(gmLog.at(-1)).toBe(tc.turnLog.at(-1));
    expect(gmLog).toHaveLength(tc.turnLog.length);
  });
});
