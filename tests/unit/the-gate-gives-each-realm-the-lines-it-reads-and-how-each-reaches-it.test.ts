// The gate (src/views/the-gate-that-says-which-lines-of-the-turn-each-realm-reads-and-how-each-reaches-it.ts, B-18a):
// for one realm, each line of the turn it reads and how it reaches it. Its case table, a case for each way and each
// edge, on lines filed through emit with their whole audience, written in words by the words pass (which hands each
// stored line's audience beside it, and stores none) and read as the GM's log stores them, each with its audience:
// - told, its deed (told first when both), its hero (the line's hero, or one of its heroes);
// - the world (a public line with no province); eyes there (seen there: its own ground, a hero of its own standing
//   there that phase, a spy on it that phase or earlier; not a phase before its spy, nor a phase its hero wasn't there);
// - the battle (an onlooker's summary, which no line carries today: read with a hero standing there at its phase, or
//   on its own ground with no phase); a battle's own lines reach only those who fought (told);
// - a line that excepts the realm never reaches it, even told; a line with no grant reaches no realm;
// - a line's sight, whatever its type (the maintainers' answers, B-18f): seen in a battle, only those who fought read it
//   (told; R-185); seen there, whoever has eyes there (R-186); seen there or in a battle with no province, no realm by
//   its sight, and the compiler refuses such an event (R-187), while a caller whose province may be missing is seen
//   there, else by the world (with no province); seen by the world with a province, every realm, as the world, and
//   the compiler refuses such an event (R-188);
// - a spy's lingering sight: in a province it spied, from the next phase on, a rival hero's deed or a public line, not
//   a line told with no deed, one that excepts it, one with no hero or one of its own hero; the first phase it spied;
// - Clairvoyance: every line about the watched hero (his, or among its heroes) from the phase the watch began; none
//   with no watch;
// - only the gate makes a line it lets through (the compiler refuses one made elsewhere).
// Realms, heroes and provinces are made up. The balance matrix's games reach none of the summary, the sights above
// on a line of the other type or with no province, a sight of the world with a province, or the excepted spy line; its
// every-realm reports cover the rest in play.
// Level 1 (unit): emit, the words pass and the gate are called on a context made in the test; nothing else of the turn
// runs.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createTurnContext, type TurnContext } from '../../src/engine/turn/context.ts';
import {
  emit,
  seenThereInItsProvinceElseByTheWorld,
  type ASightAndItsProvince,
  type LineAudience,
  type LogLine,
  type TurnEvent,
} from '../../src/engine/turn/events-and-their-audiences.ts';
import { theTurnsLinesInWords } from '../../src/views/prose/the-words-of-each-line.ts';
import {
  theLinesOfTheTurnTheRealmReads,
  type ALineAsTheGateReadsIt,
  type ALineTheRealmReads,
  type TheTurnsSight,
} from '../../src/views/the-gate-that-says-which-lines-of-the-turn-each-realm-reads-and-how-each-reaches-it.ts';
import type { GameState } from '../../src/schemas/saved-game-state.ts';

// emit echoes each line on the console: quiet while the tests write lines.
const consoleLog = console.log;
beforeAll(() => {
  console.log = () => undefined;
});
afterAll(() => {
  console.log = consoleLog;
});

// Three made-up realms: Aldmoor (0) holds province 1, Brenvale (1) province 2, Corrith (2) province 3. Their heroes:
// Sir Odran (10, Aldmoor's), Dame Wenna (20, Brenvale's), Lord Taveth (30, Corrith's).
const ALDMOOR = 0;
const BRENVALE = 1;
const CORRITH = 2;
const ODRAN = 10;
const WENNA = 20;
const TAVETH = 30;
const REALMS = [ALDMOOR, BRENVALE, CORRITH];

/** The world after the turn, as much of it as the gate reads: each realm's provinces and its heroes. */
function aWorld(): GameState {
  const world = {
    turn: 3,
    players: [{ provinces: [1] }, { provinces: [2] }, { provinces: [3] }],
    characters: [
      { id: ODRAN, player: ALDMOOR, alive: true, location: 1 },
      { id: WENNA, player: BRENVALE, alive: true, location: 2 },
      { id: TAVETH, player: CORRITH, alive: true, location: 3 },
    ],
    world: { provinces: [0, 1, 2, 3, 4, 5, 6].map((id) => ({ id, name: `Province ${String(id)}` })) },
  };
  return world as unknown as GameState;
}

/** The turn's sight: who stood where in each phase, and who watches whom by Clairvoyance. */
function aSight(
  presence: { phase: number; province: number; realms: number[] }[] = [],
  clairWatch: TheTurnsSight['clairWatch'] = {},
): TheTurnsSight {
  const presenceByPhase: Map<number, Set<number>>[] = [];
  for (const { phase, province, realms } of presence) {
    const byProvince = presenceByPhase[phase] ?? new Map<number, Set<number>>();
    byProvince.set(province, new Set(realms));
    presenceByPhase[phase] = byProvince;
  }
  return { presenceByPhase, battleCommanders: {}, clairWatch };
}

/** A line to file: its words (a hired hero's name stands for them), its audience and its province (a sight there or
 *  in a battle names one: R-187), and when. */
type ALineToFile = ASightAndItsProvince & {
  words: string;
  type?: string;
  phase?: number | 'none';
  hero?: number | null;
  heroes?: number[];
  spy?: boolean;
};

/** The turn's lines, filed through emit and written in words by the words pass: the GM's log as it is stored, and
 *  each stored line's audience beside it. */
function theTurnsLines(lines: ALineToFile[]) {
  const tc: TurnContext = createTurnContext(aWorld(), [], 3);
  for (const { words, type, phase, hero, heroes, spy, ...itsSightAndItsProvince } of lines) {
    const event: TurnEvent = {
      type: type ?? 'system',
      fact: { kind: 'a hero hired this phase will act from the next', heroName: words },
      ...itsSightAndItsProvince,
      phase: phase ?? 2,
      hero: hero ?? null,
      heroes,
      spy,
    };
    emit(tc, event);
  }
  return theTurnsLinesInWords(tc.turnLog);
}

/** The words a line is written in, for its hero's name. */
const inWords = (name: string) => `${name} was hired this phase and will be ready to act from the next phase.`;
/** The name a line's words stand for (above). */
const nameOf = ({ line }: ALineTheRealmReads) => String(line.text).split(' was hired this phase')[0];

/** The turn's lines as the gate reads them: the GM's log as it is stored, and each line's audience beside it. */
interface TheStoredLinesAndTheirAudiences {
  gmLog: ALineAsTheGateReadsIt[];
  audiences: (LineAudience | null)[];
}

/** The gate's reading of the turn's lines for a realm. */
const theGatesReading = ({ gmLog, audiences }: TheStoredLinesAndTheirAudiences, realm: number, sight: TheTurnsSight) =>
  theLinesOfTheTurnTheRealmReads(gmLog, aWorld(), realm, sight, audiences);

/** The turn's lines, filed and written in words (theTurnsLines), as the gate reads them. */
function filed(lines: ALineToFile[]): TheStoredLinesAndTheirAudiences {
  const { gmLog, theAudienceOfEachStoredLine } = theTurnsLines(lines);
  return { gmLog, audiences: theAudienceOfEachStoredLine };
}

/** What a realm reads in its chronicle: each line's name and how it reaches the realm, in the log's order. */
function theChronicle(lines: ALineToFile[], realm: number, sight = aSight(), log?: TheStoredLinesAndTheirAudiences) {
  return theGatesReading(log ?? filed(lines), realm, sight).chronicle.map((l) => [nameOf(l), l.reachesItBy]);
}
/** What each realm reads of the lines, in its chronicle. */
const whatEachRealmReads = (lines: ALineToFile[], sight = aSight()) =>
  REALMS.map((realm) => theChronicle(lines, realm, sight));

describe('the words pass hands each stored line its whole audience beside it, and stores none', () => {
  test("each stored line's audience, in its order; no stored line holds one", () => {
    // (each in province 4, so none is seen by the world: R-188)
    const audiences: (LineAudience & { seen?: 'there' })[] = [
      { realms: [BRENVALE] },
      { seen: 'there', except: [ALDMOOR] },
      { actor: 2 },
    ];
    const { gmLog, theAudienceOfEachStoredLine } = theTurnsLines(
      audiences.map((audience, k) => ({ words: `Line ${String(k)}`, audience, province: 4 })),
    );
    expect(theAudienceOfEachStoredLine).toEqual(audiences);
    expect(gmLog.map((l) => Object.keys(l).includes('audience'))).toEqual([false, false, false]);
    expect(gmLog.map((l) => l.text)).toEqual(['Line 0', 'Line 1', 'Line 2'].map(inWords));
  });
});

describe('the chronicle: each way a line reaches a realm', () => {
  test('told: the realms it is told to, and no other', () => {
    expect(whatEachRealmReads([{ words: 'Fenrick', audience: { realms: [BRENVALE] } }])).toEqual([
      [],
      [['Fenrick', 'told']],
      [],
    ]);
  });

  test('its deed: the realm that is its actor; told comes first when both', () => {
    expect(
      whatEachRealmReads([
        { words: 'Ysolde', audience: { actor: CORRITH } },
        { words: 'Harl', audience: { realms: [CORRITH], actor: CORRITH } },
      ]),
    ).toEqual([
      [],
      [],
      [
        ['Ysolde', 'its deed'],
        ['Harl', 'told'],
      ],
    ]);
  });

  test('its hero: a line about a hero the realm owns, his or among its heroes, wherever he stands', () => {
    expect(
      whatEachRealmReads([
        { words: 'Brannoc', audience: {}, hero: WENNA, province: 6 },
        { words: 'Mirelle', audience: {}, heroes: [TAVETH, ODRAN], province: 6 },
      ]),
    ).toEqual([[['Mirelle', 'its hero']], [['Brannoc', 'its hero']], [['Mirelle', 'its hero']]]);
  });

  test('the world: a line seen by the world, with no province, reaches every realm', () => {
    expect(whatEachRealmReads([{ words: 'Oswy', audience: { seen: 'world' } }])).toEqual(
      REALMS.map(() => [['Oswy', 'the world']]),
    );
  });

  test('eyes there: its own ground, whatever its heroes do', () => {
    expect(whatEachRealmReads([{ words: 'Galen', audience: { seen: 'there' }, province: 2 }])).toEqual([
      [],
      [['Galen', 'eyes there']],
      [],
    ]);
  });

  test("eyes there: a hero of its own standing there in the line's phase, and not in another", () => {
    const sight = aSight([{ phase: 2, province: 5, realms: [ALDMOOR] }]);
    expect(
      whatEachRealmReads(
        [
          { words: 'Tamsin', audience: { seen: 'there' }, province: 5, phase: 2 },
          { words: 'Corwen', audience: { seen: 'there' }, province: 5, phase: 3 },
        ],
        sight,
      ),
    ).toEqual([[['Tamsin', 'eyes there']], [], []]);
  });

  test('eyes there: a spy on the province that phase or earlier, and not a phase before; the spy itself its deed', () => {
    const lines: ALineToFile[] = [
      { words: 'Before', audience: { seen: 'there' }, province: 6, phase: 0 },
      { words: 'The spy', audience: { actor: CORRITH }, province: 6, phase: 1, spy: true },
      { words: 'Same phase', audience: { seen: 'there' }, province: 6, phase: 1 },
      { words: 'Later', audience: { seen: 'there' }, province: 6, phase: 3 },
    ];
    expect(whatEachRealmReads(lines)).toEqual([
      [],
      [],
      [
        ['The spy', 'its deed'],
        ['Same phase', 'eyes there'],
        ['Later', 'eyes there'],
      ],
    ]);
  });

  test("the battle: an onlooker's summary, read with a hero standing there at its phase, or on its own ground with no phase", () => {
    const { gmLog, audiences } = filed([
      { words: 'Spied', audience: { actor: CORRITH }, province: 5, phase: 1, spy: true },
      { words: 'Seen fought', audience: { seen: 'battle' }, type: 'combat', province: 5, phase: 2 },
      { words: 'Seen at home', audience: { seen: 'battle' }, type: 'combat', province: 3, phase: 'none' },
    ]);
    // the summary flag, which no line carries today, staged on the battle's two lines
    const log = {
      gmLog: gmLog.map((l, at): ALineAsTheGateReadsIt => (at === 0 ? l : { ...l, summary: true })),
      audiences,
    };
    // Aldmoor's hero stands in the province in the battle's phase; Corrith spied it the phase before, and a spy sees no
    // summary of a battle with a phase
    const sight = aSight([{ phase: 2, province: 5, realms: [ALDMOOR] }]);
    expect(REALMS.map((realm) => theChronicle([], realm, sight, log))).toEqual([
      [['Seen fought', 'the battle']],
      [],
      [
        ['Spied', 'its deed'],
        ['Seen at home', 'the battle'],
      ],
    ]);
  });

  test("a battle's own lines (no summary) reach only those who fought, told, not those with eyes there", () => {
    const sight = aSight([{ phase: 2, province: 5, realms: [ALDMOOR, CORRITH] }]);
    expect(
      whatEachRealmReads(
        [{ words: 'The charge', audience: { realms: [CORRITH], seen: 'battle' }, type: 'combat', province: 5 }],
        sight,
      ),
    ).toEqual([[], [], [['The charge', 'told']]]);
  });

  test('a line that excepts a realm never reaches it, even told; a line with no grant reaches no realm', () => {
    expect(
      whatEachRealmReads([
        { words: 'Public half', audience: { seen: 'world', except: [BRENVALE] } },
        { words: 'Told but excepted', audience: { realms: [BRENVALE, CORRITH], except: [BRENVALE] } },
        { words: "The GM's own", audience: {} },
      ]),
    ).toEqual([
      [['Public half', 'the world']],
      [],
      [
        ['Public half', 'the world'],
        ['Told but excepted', 'told'],
      ],
    ]);
  });
});

describe("the maintainers' answers to the B-18 scoping's questions 81 to 83, and to question 85: a line's sight, whatever its type", () => {
  const sight = aSight([{ phase: 2, province: 5, realms: [ALDMOOR] }]);

  test('R-185: seen in a battle, whatever its type, only those who fought (told) read it, not those with eyes there', () => {
    expect(
      whatEachRealmReads(
        [
          { words: 'Battle aside', audience: { realms: [CORRITH], seen: 'battle' }, type: 'system', province: 5 },
          { words: 'Battle at home', audience: { realms: [CORRITH], seen: 'battle' }, type: 'system', province: 2 },
        ],
        sight,
      ),
    ).toEqual([
      [],
      [],
      [
        ['Battle aside', 'told'],
        ['Battle at home', 'told'],
      ],
    ]);
  });

  test('R-186: seen there, whatever its type, whoever has eyes there reads it: a hero there that phase, its own ground', () => {
    expect(
      whatEachRealmReads(
        [
          { words: 'Combat there', audience: { seen: 'there' }, type: 'combat', province: 5 },
          { words: 'Combat at home', audience: { seen: 'there' }, type: 'combat', province: 2 },
        ],
        sight,
      ),
    ).toEqual([[['Combat there', 'eyes there']], [['Combat at home', 'eyes there']], []]);
  });

  test('R-187: seen there or in a battle with no province, handed anyway, no realm reads it by its sight', () => {
    // The compiler refuses such an event (below): staged as the stored lines it would give (as a line seen by the
    // world gives them), with its audience beside them.
    const { gmLog } = theTurnsLines([
      { words: 'Nowhere there', audience: { seen: 'world' } },
      { words: 'Nowhere battle', audience: { seen: 'world' }, type: 'combat' },
    ]);
    const audiences: LineAudience[] = [{ seen: 'there' }, { seen: 'battle' }];
    expect(REALMS.map((realm) => theChronicle([], realm, aSight(), { gmLog, audiences }))).toEqual([[], [], []]);
  });

  test("R-187: where the province may be missing, seen there in its province, else by the world: today's reading", () => {
    const where = (province: number | null) => seenThereInItsProvinceElseByTheWorld({ realms: [] }, 'there', province);
    const inABattle = (province: number | null) =>
      seenThereInItsProvinceElseByTheWorld({ realms: [CORRITH] }, 'battle', province);
    expect([where(5), where(null), inABattle(5), inABattle(null)]).toEqual([
      { audience: { realms: [], seen: 'there' }, province: 5 },
      { audience: { realms: [], seen: 'world' }, province: null },
      { audience: { realms: [CORRITH], seen: 'battle' }, province: 5 },
      { audience: { realms: [CORRITH], seen: 'world' }, province: null },
    ]);
    expect(
      whatEachRealmReads(
        [
          { words: 'Here', ...where(5) },
          { words: 'Nowhere', ...where(null) },
        ],
        sight,
      ),
    ).toEqual([
      [
        ['Here', 'eyes there'],
        ['Nowhere', 'the world'],
      ],
      [['Nowhere', 'the world']],
      [['Nowhere', 'the world']],
    ]);
  });

  test('R-188: seen by the world with a province, handed anyway, every realm reads it as the world', () => {
    // The compiler refuses such an event (below): staged as the stored lines it would give (as a line seen there gives
    // them), with its audience beside them.
    const { gmLog } = theTurnsLines([
      { words: 'World there', audience: { seen: 'there' }, type: 'system', province: 5 },
      { words: 'World battle', audience: { seen: 'there' }, type: 'combat', province: 5 },
    ]);
    const audiences: LineAudience[] = [{ seen: 'world' }, { seen: 'world' }];
    expect(REALMS.map((realm) => theChronicle([], realm, sight, { gmLog, audiences }))).toEqual(
      REALMS.map(() => [
        ['World there', 'the world'],
        ['World battle', 'the world'],
      ]),
    );
  });
});

/** Whether an event seen there, or in a battle, with no province would compile: never (R-187). */
type AnEventSeenThereWithNoProvinceCompiles = {
  type: 'system';
  fact: { kind: 'a hero hired this phase will act from the next'; heroName: string };
  audience: { seen: 'there' };
  province: null;
  phase: 2;
  hero: null;
} extends TurnEvent
  ? true
  : false;
type AnEventSeenInABattleWithNoProvinceCompiles = {
  type: 'combat';
  fact: { kind: 'a hero hired this phase will act from the next'; heroName: string };
  audience: { seen: 'battle'; realms: [0] };
  phase: 2;
  hero: null;
} extends TurnEvent
  ? true
  : false;
/** Whether an event seen by the world with a province would compile: never (R-188). */
type AnEventSeenByTheWorldInAProvinceCompiles = {
  type: 'system';
  fact: { kind: 'a hero hired this phase will act from the next'; heroName: string };
  audience: { seen: 'world' };
  province: 5;
  phase: 2;
  hero: null;
} extends TurnEvent
  ? true
  : false;
/** Whether an event seen by the world with no province compiles: always. */
type AnEventSeenByTheWorldWithNoProvinceCompiles = {
  type: 'system';
  fact: { kind: 'a hero hired this phase will act from the next'; heroName: string };
  audience: { seen: 'world' };
  province: null;
  phase: 2;
  hero: null;
} extends TurnEvent
  ? true
  : false;
/** Whether an event seen there, with its province, compiles: always. */
type AnEventSeenThereInItsProvinceCompiles = {
  type: 'system';
  fact: { kind: 'a hero hired this phase will act from the next'; heroName: string };
  audience: { seen: 'there' };
  province: 5;
  phase: 2;
  hero: null;
} extends TurnEvent
  ? true
  : false;

test('R-187: a sight there or in a battle names its province: the compiler refuses an event seen there or in a battle with none', () => {
  // compiles only while those events are refused (the first two types are false) and one with its province isn't
  const refused: [AnEventSeenThereWithNoProvinceCompiles, AnEventSeenInABattleWithNoProvinceCompiles] = [false, false];
  const compiles: AnEventSeenThereInItsProvinceCompiles = true;
  expect([refused, compiles]).toEqual([[false, false], true]);
});

test('R-188: a line told to the whole world names no province: the compiler refuses an event seen by the world with one', () => {
  // compiles only while that event is refused (its type is false) and one with no province isn't
  const refused: AnEventSeenByTheWorldInAProvinceCompiles = false;
  const compiles: AnEventSeenByTheWorldWithNoProvinceCompiles = true;
  expect([refused, compiles]).toEqual([false, true]);
});

describe("a spy's lingering sight", () => {
  test("from the phase after its spy, in the province it spied: a rival hero's deed or a public line, and nothing else", () => {
    const log = filed([
      { words: 'First spy', audience: { actor: CORRITH }, province: 6, phase: 1, spy: true, hero: TAVETH },
      { words: 'Second spy', audience: { actor: CORRITH }, province: 6, phase: 3, spy: true, hero: TAVETH },
      { words: 'Same phase deed', audience: { actor: BRENVALE }, province: 6, phase: 1, hero: WENNA },
      { words: 'A deed', audience: { actor: BRENVALE }, province: 6, phase: 2, hero: WENNA },
      { words: 'Seen there', audience: { seen: 'there' }, province: 6, phase: 2, hero: WENNA },
      { words: 'Its news', audience: { realms: [BRENVALE] }, province: 6, phase: 2, hero: WENNA },
      { words: 'Excepts it', audience: { actor: BRENVALE, except: [CORRITH] }, province: 6, phase: 2, hero: WENNA },
      { words: 'No hero', audience: { actor: BRENVALE }, province: 6, phase: 2, hero: null },
      { words: 'Its own hero', audience: { actor: CORRITH }, province: 6, phase: 2, hero: TAVETH },
      { words: 'Elsewhere', audience: { actor: BRENVALE }, province: 4, phase: 2, hero: WENNA },
      { words: 'No phase', audience: { actor: BRENVALE }, province: 6, phase: 'none', hero: WENNA },
    ]);
    const read = theGatesReading(log, CORRITH, aSight());
    expect(read.spiedProvincesAndTheirFirstPhase).toEqual({ 6: 1 });
    expect(
      read.spysLingeringSight.map(({ province, afterPhase, lines }) => ({
        province,
        afterPhase,
        lines: lines.map((l) => [nameOf(l), l.reachesItBy, l.phase]),
      })),
    ).toEqual([
      {
        province: 6,
        afterPhase: 1,
        lines: [
          ['A deed', "a spy's lingering sight", 2],
          ['Seen there', "a spy's lingering sight", 2],
        ],
      },
    ]);
    // a realm that spied nothing has none
    expect(theGatesReading(log, ALDMOOR, aSight()).spysLingeringSight).toEqual([]);
  });
});

describe('Clairvoyance', () => {
  const lines: ALineToFile[] = [
    { words: 'Before the watch', audience: { actor: CORRITH }, phase: 1, hero: TAVETH },
    { words: 'His deed', audience: { actor: CORRITH }, phase: 2, hero: TAVETH },
    { words: 'Among its heroes', audience: { realms: [BRENVALE] }, phase: 3, heroes: [WENNA, TAVETH] },
    { words: 'No phase', audience: { actor: CORRITH }, phase: 'none', hero: TAVETH },
    { words: 'Not about him', audience: { actor: BRENVALE }, phase: 3, hero: WENNA },
  ];

  test('every line about the watched hero, his or among its heroes, from the phase the watch began', () => {
    const log = filed(lines);
    const sight = aSight([], { [ALDMOOR]: { charId: TAVETH, fromPhase: 2 } });
    const read = theGatesReading(log, ALDMOOR, sight);
    expect(read.clairvoyance.map((l) => [nameOf(l), l.reachesItBy, l.phase])).toEqual([
      ['His deed', 'Clairvoyance', 2],
      ['Among its heroes', 'Clairvoyance', 3],
    ]);
    // the chronicle is the realm's own: the watch adds nothing to it
    expect(read.chronicle).toEqual([]);
  });

  test('none, for a realm that watches no hero', () => {
    const log = filed(lines);
    const sight = aSight([], { [ALDMOOR]: { charId: TAVETH, fromPhase: 2 } });
    expect(theGatesReading(log, BRENVALE, sight).clairvoyance).toEqual([]);
  });
});

/** Whether a line, its place and its way, made outside the gate, would pass for one the gate let through: never, for a
 *  line the realm reads carries the gate's own mark, which no other module can write. */
type AForgedLinePasses = { line: LogLine; at: number; reachesItBy: 'told' } extends ALineTheRealmReads ? true : false;

test('only the gate makes a line it lets through: the compiler refuses one made elsewhere', () => {
  // compiles only while a line made elsewhere doesn't pass (the type above is false)
  const aForgedLinePasses: AForgedLinePasses = false;
  expect(aForgedLinePasses).toBe(false);
  const log = filed([{ words: 'Let through', audience: { seen: 'world' } }]);
  const [read] = theGatesReading(log, ALDMOOR, aSight()).chronicle;
  expect(read && Object.getOwnPropertySymbols(read)).toHaveLength(1);
});
