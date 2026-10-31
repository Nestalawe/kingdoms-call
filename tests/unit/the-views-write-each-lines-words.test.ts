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
// force too; since P1-12d20 its verb written from its values, and empty for a force with none; since P1-12d29 its name
// written from the force's record in every form, the leaderless check's copy of those words the same, and a fallen
// commander's host named "<his name>'s leaderless host" as the check finds him), and the place of a battle's tally has no words of its own; `theTurnsLinesInWords` gives a battle's lines
// the tiers their words give and puts its losses tally where its casualty lists begin, every line with the fight's
// audience, hero and place; a battle with nothing to tally has no tally line, one whose lines are all for one realm
// alone files no tally place, two battles side by side keep their own; the GM's log in words has the 17 keys in their
// order, no fact and no tier left to work out, and a line that holds its words already is stored as it is. Red on the
// plants of the row's PR (a force's words without `guard`, the tally always last, every tier `'k'`). Level 1:
// `forceMarker`, `emitBattle` and the words pass on a context made in the test
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createTurnContext, type TurnContext } from '../../src/engine/turn/context.ts';
import {
  emitBattle,
  forceMarker,
  theNameAForcesHeaderIsCheckedBy,
} from '../../src/engine/battle/battle-report-lines-and-force-markers.ts';
import type {
  AForceDrawnUpForBattle,
  TheForceABattlesHeaderNames,
} from '../../src/engine/battle/the-facts-a-battles-lines-record.ts';
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
import { theNameOfAPlayersRealm } from '../../src/engine/turn/log-line-helpers.ts';
import type { Army, Character, Province } from '../../src/schemas/saved-game-state.ts';

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

/** The forces the headers name (P1-12d29: records; the prose writes the names): Aldric of Red, Brann of Blue, and the
 *  chieftain who guards Greyford. */
const ALDRIC_OF_RED = {
  kind: 'a hero, with the realm he serves',
  heroName: 'Aldric',
  servesARealm: true,
  realmName: 'Red',
} as const;
const BRANN_OF_BLUE = {
  kind: 'a hero, with the realm he serves',
  heroName: 'Brann',
  servesARealm: true,
  realmName: 'Blue',
} as const;
const THE_CHIEFTAIN_OF_GREYFORD = {
  kind: "a province's guard at the head of its force",
  guardName: 'The Chieftain of Greyford',
} as const;

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
  narrate(narrative, forceMarker(tc, ALDRIC_OF_RED, 0, 'attacker', [company('Shieldwall')], ATTACKS_GREYFORD));
  narrate(narrative, forceMarker(tc, BRANN_OF_BLUE, 1, 'defender', [company('Ford Watch')], HOLDS_GREYFORD));
  narrate(narrative, { kind: 'the battle for a province begins', provName: 'Greyford' });
  narrate(narrative, {
    kind: "the defender's feigned retreat springs shut",
    defName: { heroName: 'Brann', leaderless: false },
  });
  if (!noLosses) {
    narrate(narrative, { kind: "the attacker's casualties begin", atkName: { heroName: 'Aldric', leaderless: false } });
    narrate(narrative, { kind: "a side's other forces survive the engagement", someUnitsFateIsToldAbove: false });
    narrate(narrative, { kind: "the defender's casualties begin", defName: { heroName: 'Brann', leaderless: false } });
    narrate(narrative, {
      kind: "a unit's fate in the battle",
      itsSideWon: false,
      fate: 'is cut down with no escape',
      inTheRout: false,
      theUnit: {
        kind: 'a unit named without its quality',
        owner: { heroName: 'Brann', leaderless: false },
        unitName: 'Ford Watch',
        type: 'Men-at-Arms',
        quality: 'Veteran',
      },
    });
  }
  return narrative;
}
/** The battle's summary for the onlookers: Aldric's forces take Greyford from Brann. */
const THE_SUMMARY = {
  kind: 'a battle is decided',
  battle: 'between two hosts',
  winnersRole: 'the attacker',
  whatBecomesOfTheProvince: 'seized',
  severity: 'decisive',
  winVerbIndex: 0,
  attackersSide: { heroName: 'Aldric', leaderless: false },
  defendersSide: { heroName: 'Brann', leaderless: false },
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
    const fact = forceMarker(tc, ALDRIC_OF_RED, 0, 'attacker', [company('Shieldwall')], ATTACKS_GREYFORD, {
      guard: false,
    });
    expect(theWordsOf(fact)).toBe(
      '⚑FORCE⚑{"name":"Aldric (Red)","color":"#c33","neutral":false,"guard":false,"role":"attacker",' +
        '"verb":"attacks Greyford under Tactical 2 command — army strength 12, with",' +
        '"armies":[{"type":"Men-at-Arms","quality":"Veteran","unitName":"Shieldwall","race":"Human",' +
        '"phantom":false,"skeletal":false,"wildHunt":false,"wildHuntUntil":null}]}',
    );
    const guard = forceMarker(tc, THE_CHIEFTAIN_OF_GREYFORD, null, 'defender', [], THE_CHIEFTAIN_GUARDS_GREYFORD, {
      guard: true,
    });
    expect(theWordsOf(guard)).toBe(
      '⚑FORCE⚑{"name":"The Chieftain of Greyford","color":null,"neutral":true,"guard":true,"role":"defender",' +
        '"verb":"guards Greyford — army strength 0, with","armies":[]}',
    );
  });

  test("a force drawn up with no verb: the header's verb is empty", () => {
    // No battle draws up a force without one (the matrix never reaches it); the header still has its verb key.
    const fact = forceMarker(newContext(), BRANN_OF_BLUE, 1, 'defender', []);
    expect(theWordsOf(fact)).toBe(
      '⚑FORCE⚑{"name":"Brann (Blue)","color":"#33c","neutral":false,"guard":false,"role":"defender","verb":"",' +
        '"armies":[]}',
    );
  });

  // P1-12d29: the force a header names is a record, and the prose writes its name; forceMarker's leaderless check reads
  // a copy of those words (theNameAForcesHeaderIsCheckedBy), pinned here to the prose's over every form.
  const theNameInTheHeader = (fact: AForceDrawnUpForBattle): unknown =>
    (JSON.parse(theWordsOf(fact).slice('⚑FORCE⚑'.length)) as { name: unknown }).name;

  test('each force a header names: the name the battles composed, and the check reads the same words', () => {
    const tc = newContext();
    const forms: [TheForceABattlesHeaderNames, string][] = [
      [ALDRIC_OF_RED, 'Aldric (Red)'],
      // a hero who serves no realm: no brackets (P1-23a), and " (wandering)" cut
      [
        {
          kind: 'a hero, with the realm he serves',
          heroName: 'Garreth (wandering)',
          servesARealm: false,
          realmName: '',
        },
        'Garreth',
      ],
      [THE_CHIEFTAIN_OF_GREYFORD, 'The Chieftain of Greyford'],
      [
        { kind: "a realm's garrison at a province", ownerName: 'Blue', provName: 'Greyford' },
        "Blue's garrison at Greyford",
      ],
      [
        { kind: "a province's own defenders with no one to lead them", provName: 'Greyford' },
        'The defenders of Greyford',
      ],
    ];
    for (const [force, name] of forms) {
      const fact = forceMarker(tc, force, null, 'defender', []);
      expect(fact.fallenCommandersName).toBeNull();
      expect(theNameInTheHeader(fact)).toBe(name);
      expect(theNameAForcesHeaderIsCheckedBy(force)).toBe(name);
    }
  });

  test("a host whose commander fell: its header names his leaderless host, as the check finds him in the header's words", () => {
    const tc = newContext();
    // three heroes who fell: two whose hosts fight on leaderless, and one whose host does not
    tc.G.characters.push(
      ...([
        { id: 9, name: 'Garreth (wandering)', player: null, alive: false, _leaderlessHost: true },
        { id: 10, name: 'Bran', player: 1, alive: false, _leaderlessHost: true },
        { id: 11, name: 'Osric', player: 1, alive: false },
      ] as unknown as Character[]),
    );
    const aHeroOf = (heroName: string, realmName: string | null): TheForceABattlesHeaderNames => ({
      kind: 'a hero, with the realm he serves',
      heroName,
      servesARealm: realmName !== null,
      realmName: realmName ?? undefined,
    });
    const header = (force: TheForceABattlesHeaderNames) => forceMarker(tc, force, null, 'attacker', []);
    // " (wandering)" cut on both sides
    const garreth = header(aHeroOf('Garreth (wandering)', null));
    expect(garreth.fallenCommandersName).toBe('Garreth');
    expect(theNameInTheHeader(garreth)).toBe("Garreth's leaderless host");
    // a realm's hero: the realm's brackets stay after the rename
    expect(theNameInTheHeader(header(aHeroOf('Bran', 'Blue')))).toBe("Bran's leaderless host (Blue)");
    // the check finds the fallen by the start of the header's name (Parked: a living Brannoc is renamed as today)
    expect(theNameInTheHeader(header(aHeroOf('Brannoc', 'Blue')))).toBe("Bran's leaderless hostnoc (Blue)");
    // a name that says "leaderless" already is left as it is, and a hero who fell with no leaderless host renames none
    expect(header(aHeroOf('Bran the Leaderless', 'Blue')).fallenCommandersName).toBeNull();
    expect(header(aHeroOf('Osric', 'Blue')).fallenCommandersName).toBeNull();
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

describe('a label no game writes, as the engine wrote it (plan P1-12d25: the labels as records)', () => {
  test('a unit of no name a line names alone is named by its type', () => {
    const unit = { owner: null, unitName: '', type: 'Men-at-Arms', quality: 'Veteran' };
    expect(
      theWordsOf({
        kind: "a unit's fate in the battle",
        itsSideWon: false,
        fate: 'is cut down with no escape',
        inTheRout: false,
        theUnit: { kind: 'a unit named by its name or type alone', ...unit },
      }),
    ).toBe('— Men-at-Arms are cut down with no escape!');
  });
  test("a hero of no realm has no realm's name to tag him with", () => {
    const tc = { G: { players: [{ name: 'Westmarch' }] } };
    expect([theNameOfAPlayersRealm(tc, 0), theNameOfAPlayersRealm(tc, 1), theNameOfAPlayersRealm(tc, null)]).toEqual([
      'Westmarch',
      null,
      null,
    ]);
  });
});
