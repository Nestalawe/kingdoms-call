// emit, the one door into the GM's log (src/engine/turn/events-and-their-audiences.ts; plan P1-12, Decisions 2 to 5),
// writes today's stored forms, so nothing stored changes in P1-12a and P1-12b: a line has the 17 keys log() gave it, a
// 'bare' one (the lines once pushed straight into turnLog) the first 14, `except` adds notFor last; an audience grants
// what the line's fields say; every event names its hero (P1-12c2): a hero left out throws, null is no hero, and
// THE_HERO_WHOSE_ORDER_IS_RESOLVING is that hero, but only when the line already reaches his realm (P1-12c1); a phase
// left out or null is the phase of the order resolving (else the phase resolving, else 99 once the phases are over),
// 'none' a real null; narrate adds a line to a fight: for everyone in it, or, a fact of a kind whose audience is its
// hero's realm alone (P1-12c4), one that emitNarrLine files to that realm under its hero.
// (The oracle that checked emit against copies of the code before it, for any input, ran from P1-12a2 to P1-12a4 and
// went with log() in P1-12a4, as Decision 5 planned. The lines a capture writes, which went straight into turnLog
// before: tests/unit/a-capture-tells-the-realm-that-lost-it-with-no-hero-and-no-phase.test.ts.)
// Level 1 (unit): each function is called on a context made in the test; nothing else of the turn runs.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// `emit`, the one door into the GM's log (`src/engine/turn/events-and-their-audiences.ts`, P1-12a2; plan P1-12's
// Decisions 2 to 5), writes today's stored forms: 17 keys, a `'bare'` line's 14, `notFor` last; what each part of an
// audience writes; every event names its hero (P1-12c2): a hero left out throws and writes no line, `null` is no hero
// (even while a hero's order resolves and the line reaches his realm), and `THE_HERO_WHOSE_ORDER_IS_RESOLVING` takes
// the hero of the order resolving; `phase` left out or null takes the phase of the order resolving (else the phase
// resolving, else 99 once the phases are over) and `'none'` is a real null; the hero of the order resolving only when
// the line already reaches his realm (told it, its deed, seen by the world or there; a battle's line only by being
// told), else no hero, and a hero who serves no realm keeps his lines (P1-12c1); `narrate`, and `emitNarrLine` filing a
// fact of a kind for its hero's realm alone to that realm alone under its hero (P1-12c4; before, `narrateTo`'s line);
// an event records its words or its fact (P1-12c3): a fact is filed with no words yet and the fact last, an event with
// both throws and writes no line, and `narrate` and `emitNarrLine` take a fact as they take words. From P1-12a2 to
// P1-12a4 an oracle half (fast-check) checked `emit`, `logSplit`, `notifyProvinceOwner`, `writeDeferredSkillLines`,
// `emitNarrLine` and `emitBattle` against copies of the code before `emit`, for any input; it went in P1-12a4 with
// `log()` and the copies (Decision 5), once every caller was converted. Level 1: each function is called on a context
// made in the test
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createTurnContext, type TurnContext } from '../../src/engine/turn/context.ts';
import {
  emit,
  emitNarrLine,
  type EventButItsWords,
  type FightLine,
  narrate,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  type NarrativeLine,
  type TurnEvent,
} from '../../src/engine/turn/events-and-their-audiences.ts';

// emit echoes each line on the console: quiet while the tests write lines.
const consoleLog = console.log;
beforeAll(() => {
  console.log = () => undefined;
});
afterAll(() => {
  console.log = consoleLog;
});

/** The state of the turn's context a line's fallbacks read. */
interface ContextState {
  charId: number | null;
  phase: number | null;
  currentPhase: number | null;
  afterPhases: boolean;
}

/** A context made by the engine (createTurnContext), in the state given, with these heroes in the world. */
function newContext(state: ContextState, characters: { id: number; player: number | null }[] = []): TurnContext {
  const tc = createTurnContext(
    { turn: 3, players: [], characters, world: { provinces: [] } },
    [],
    3,
  ) as unknown as TurnContext;
  tc._logCtx = { charId: state.charId, phase: state.phase };
  tc._currentPhase = state.currentPhase;
  tc._afterPhases = state.afterPhases;
  tc._battleSeq = 0;
  return tc;
}

describe("emit's forms", () => {
  const state: ContextState = { charId: 7, phase: 2, currentPhase: 2, afterPhases: false };
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

  test("a line has the 17 keys log() gave it; a 'bare' one the first 14; `except` adds notFor last", () => {
    const tc = newContext(state);
    emit(tc, { type: 'system', text: 'a', audience: {}, hero: null });
    emit(tc, { type: 'system', text: 'b', audience: {}, hero: null, form: 'bare' });
    emit(tc, {
      type: 'system',
      text: 'c',
      audience: { seen: 'there', except: [1] },
      hero: null,
      province: 4,
      form: 'bare',
    });
    expect(tc.turnLog.map((l) => Object.keys(l))).toEqual([FULL, FULL.slice(0, 14), [...FULL.slice(0, 14), 'notFor']]);
    expect(tc.turnLog[2]).toMatchObject({ public: true, provinceId: 4, notFor: [1], targets: [], actor: null });
  });

  test("an audience grants what the line's fields say: realms told, the actor, seen by any", () => {
    const tc = newContext(state);
    emit(tc, { type: 'move', text: 'a', audience: { realms: [1, 2], actor: 1 }, hero: null });
    emit(tc, { type: 'move', text: 'b', audience: { seen: 'world' }, hero: null });
    emit(tc, {
      type: 'combat',
      text: 'c',
      audience: { seen: 'battle' },
      hero: null,
      province: 3,
      battle: { id: 2, tier: 'd' },
    });
    expect(tc.turnLog[0]).toMatchObject({ targets: [1, 2], actor: 1, public: false });
    expect(tc.turnLog[1]).toMatchObject({ targets: [], actor: null, public: true, provinceId: null });
    expect(tc.turnLog[2]).toMatchObject({ public: true, provinceId: 3, battleId: 2, bTier: 'd' });
  });

  test("hero, the order resolving's when named so; phase, left out or null, the order resolving's (else the phase's, else 99); 'none', a real null", () => {
    const after: ContextState = { charId: 7, phase: null, currentPhase: null, afterPhases: true };
    const tc = newContext(after);
    emit(tc, { type: 'system', text: 'a', audience: {}, hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING });
    emit(tc, { type: 'system', text: 'b', audience: {}, hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING, phase: null });
    emit(tc, { type: 'system', text: 'c', audience: {}, hero: null, phase: 'none' });
    emit(tc, { type: 'system', text: 'd', audience: {}, hero: 3, phase: 1 });
    expect(tc.turnLog.map((l) => [l.charId, l.phase])).toEqual([
      [7, 99],
      [7, 99],
      [null, null],
      [3, 1],
    ]);
  });

  test("narrate: a line for everyone in the fight, and a fact for its hero's realm alone that emitNarrLine files to that realm", () => {
    const narrative: NarrativeLine[] = [];
    const risen = {
      kind: "a hero's hit points rise in a fight, for his realm alone",
      realm: 1,
      hero: 12,
      heroName: 'Aldric',
      rise: { gain: 3, maxHp: 23, wound: true },
    } as const;
    narrate(narrative, 'The hosts close.');
    narrate(narrative, risen);
    expect(narrative).toEqual(['The hosts close.', risen]);
    const tc = newContext(state);
    const fight: FightLine = {
      type: 'combat',
      audience: { actor: 0, realms: [0, 1], seen: 'battle' },
      province: 5,
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      heroes: [11, 12],
      battle: { id: 1, tier: 'd' },
    };
    narrative.forEach((line) => {
      emitNarrLine(tc, line, fight);
    });
    expect(tc.turnLog[0]).toMatchObject({ targets: [0, 1], actor: 0, public: true, charIds: [11, 12] });
    expect(tc.turnLog[1]).toMatchObject({ targets: [1], actor: null, public: false, charIds: null, charId: 12 });
  });
});

// P1-12c1 (P1-12's Decisions of 2026-10-24, Decision 1): a line that names no hero is filed under the hero whose order
// is resolving only when its audience already reaches his realm, since a realm reads every line filed under one of its
// heroes. Aldric (7) serves realm 0 and his order is resolving; Wenna (9) serves no realm.
describe('the hero whose order is resolving files a line only when it already reaches his realm', () => {
  const resolving: ContextState = { charId: 7, phase: 2, currentPhase: 2, afterPhases: false };
  const heroes = [
    { id: 7, player: 0 },
    { id: 9, player: null },
  ];
  type ItsPlace = Omit<EventButItsWords, 'hero'> & Partial<Pick<TurnEvent, 'hero'>>;
  const filedUnder = (event: ItsPlace, state = resolving) => {
    const tc = newContext(state, heroes);
    emit(tc, { type: 'system', text: 'a line', hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING, ...event });
    return tc.turnLog[0]?.charId;
  };

  test('a line told to realm 1 alone is filed under no hero; one told to realm 0 is filed under Aldric', () => {
    expect(filedUnder({ audience: { realms: [1], actor: null } })).toBeNull();
    expect(filedUnder({ audience: { realms: [0], actor: null } })).toBe(7);
  });

  test('his realm reaches it as its deed, or seen by the world or there; a battle only by being told', () => {
    expect(filedUnder({ audience: { actor: 0 } })).toBe(7);
    expect(filedUnder({ audience: { seen: 'world' } })).toBe(7);
    expect(filedUnder({ audience: { seen: 'there' }, province: 4 })).toBe(7);
    expect(filedUnder({ audience: { actor: 1 } })).toBeNull();
    expect(filedUnder({ audience: { realms: [1], seen: 'battle' }, province: 4 })).toBeNull();
    expect(filedUnder({ audience: { realms: [0, 1], seen: 'battle' }, province: 4 })).toBe(7);
  });

  test('a line for the GM alone is filed under no hero; a hero named is kept', () => {
    expect(filedUnder({ audience: {} })).toBeNull();
    expect(filedUnder({ audience: { realms: [1] }, hero: 3 })).toBe(3);
  });

  test('with no order resolving, or a hero who serves no realm, nothing changes', () => {
    expect(filedUnder({ audience: { realms: [0] } }, { ...resolving, charId: null })).toBeNull();
    expect(filedUnder({ audience: { realms: [1] } }, { ...resolving, charId: 9 })).toBe(9);
  });

  test("a fight's line for one realm alone, written with no hero, is filed under no hero of another realm", () => {
    const narrative: NarrativeLine[] = [];
    narrate(narrative, {
      kind: 'the surgeons reach a fallen duellist too late, for his realm alone',
      realm: 1,
      heroName: 'Aldric',
      chance: 20,
      roll: 55,
    });
    const tc = newContext(resolving, heroes);
    const fight: FightLine = {
      type: 'combat',
      audience: { realms: [0, 1], seen: 'battle' },
      province: 5,
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    };
    narrative.forEach((line) => {
      emitNarrLine(tc, line, fight);
    });
    expect(tc.turnLog[0]).toMatchObject({ targets: [1], charId: null });
  });
});

// P1-12c2 (P1-12's Decisions of 2026-10-24, Decision 1): every event names its hero. Aldric (7) serves realm 0 and his
// order is resolving.
describe('every event names its hero', () => {
  const resolving: ContextState = { charId: 7, phase: 2, currentPhase: 2, afterPhases: false };
  const heroes = [{ id: 7, player: 0 }];

  test('a hero left out throws, and writes no line', () => {
    const tc = newContext(resolving, heroes);
    // An engine file not yet type-checked can hand such an event: the type refuses it, emit throws.
    const leftOut: unknown = { type: 'system', text: 'A line with no hero.', audience: { realms: [0] } };
    expect(() => {
      emit(tc, leftOut as TurnEvent);
    }).toThrow(/names no hero/);
    expect(tc.turnLog).toEqual([]);
  });

  test("null is no hero, even while Aldric's order resolves and the line reaches his realm", () => {
    const tc = newContext(resolving, heroes);
    emit(tc, { type: 'system', text: 'a', audience: { realms: [0], actor: 0 }, hero: null });
    emit(tc, { type: 'system', text: 'b', audience: { seen: 'world' }, hero: null });
    emit(tc, {
      type: 'system',
      text: 'c',
      audience: { realms: [0], actor: 0 },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    expect(tc.turnLog.map((l) => l.charId)).toEqual([null, null, 7]);
  });
});

// P1-12c3 (P1-12's Decisions of 2026-10-24, Decision 2): an event records its words or the fact they are written from,
// and the views write a fact's words (tests/unit/the-views-write-each-lines-words.test.ts).
describe('an event records its words or its fact', () => {
  const state: ContextState = { charId: 7, phase: 2, currentPhase: 2, afterPhases: false };
  const TALLY = { kind: "a battle's losses, tallied from its lines" } as const;

  test('a fact is filed with no words yet, the fact last, and every other key in its place', () => {
    const tc = newContext(state);
    emit(tc, { type: 'combat', fact: TALLY, audience: { realms: [0] }, hero: null, battle: { id: 1, tier: 't' } });
    expect(tc.turnLog[0]).toMatchObject({ type: 'combat', text: null, targets: [0], bTier: 't', fact: TALLY });
    expect(Object.keys(tc.turnLog[0] ?? {}).at(-1)).toBe('fact');
  });

  test('an event with words and a fact as well throws, and writes no line', () => {
    const tc = newContext(state);
    // An engine file not yet type-checked can hand such an event: the type refuses it, emit throws.
    const both: unknown = { type: 'combat', text: 'A tally.', fact: TALLY, audience: {}, hero: null };
    expect(() => {
      emit(tc, both as TurnEvent);
    }).toThrow(/has words as well/);
    expect(tc.turnLog).toEqual([]);
  });

  test("narrate adds a fact for everyone in the fight; emitNarrLine files it with the fight's event", () => {
    const tc = newContext(state);
    const narrative: NarrativeLine[] = [];
    narrate(narrative, TALLY);
    const fight: FightLine = { type: 'combat', audience: { realms: [0, 1], seen: 'battle' }, hero: null, province: 3 };
    narrative.forEach((line) => {
      emitNarrLine(tc, line, fight);
    });
    expect(tc.turnLog[0]).toMatchObject({ text: null, fact: TALLY, targets: [0, 1], public: true, provinceId: 3 });
  });
});
