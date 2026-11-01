// The turn's context and the helpers lifted out of resolveTurn with it (plan P1-08a), called directly in the bare vm
// (tests/lib/engine.ts).
// - createTurnContext holds the turn's state, slot rows and turn, and an empty log; emit files a line under the hero
//   and the phase the context names as it is when the line is written, not as it was when the context was made. It
//   is a plain object: a value nothing has set reads as undefined, as resolveTurn's code expects, and never throws.
// - The title lookups the balance matrix never runs (charHoldsTitle, playerHoldsTitle: nothing calls them today), and
//   charMinor beside them: true for the holder only.
// - Relations (property, fast-check): whatever G.relations holds, two realms stand to each other as they stand the
//   other way round, are never both at war and allied, a realm is itself, and a missing realm is neutral.
// Level 1 (unit): each function is called on a context made in the test; nothing else of the turn runs.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The turn's context and the helpers lifted with it (P1-08a), called directly through `lib/engine.ts` (`engineFn`,
// `turnContext`): `createTurnContext` holds the state, the slot rows, the turn and an empty log, and is a plain object
// (a value nothing has set reads as undefined; it failed while a debugging check that threw on such a read was left in,
// #136); `emit` files a line under the hero and phase the context names when the line is written (a hero's own, then
// the phase being resolved, then End of Turn once the phases are over); the title lookups the balance matrix never runs
// (`charHoldsTitle`, `playerHoldsTitle`: nothing calls them today) and `charMinor` are true for the holder only; and,
// as a property (fast-check), two realms stand to each other as they do the other way round, are never both at war and
// allied, a realm is itself and a missing realm is neutral, whatever `G.relations` holds. Each check fails on a planted
// fault: `log` ignoring the phase, `charHoldsTitle` comparing the realm, `playerHoldsTitle` without its guard,
// `relationBetween` keying a pair one way only. Level 1: each function is called on a context made in the test; nothing
// else of the turn runs
import { types } from 'node:util';
import vm from 'node:vm';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { THE_HERO_WHOSE_ORDER_IS_RESOLVING } from '../../src/engine/turn/events-and-their-audiences.ts';
import { engineFn, loadEngine, turnContext, type TurnContext } from '../lib/engine.ts';
import { timeLimitForPropertyRuns } from '../lib/time-limits.ts';

// fast-check's run count (tests/setup/fast-check.ts): 100, or 1,000 under KC_FULL. Each property's time limit is 50
// ms an input, so npm test's 100 keep Vitest's 5 s and KC_FULL's 1,000 get 50 s (tests/lib/time-limits.ts).
const RUNS = fc.readConfigureGlobal().numRuns ?? 100;

const engine = loadEngine({ seed: 1 });
// emit echoes each line to the console: quiet it while a test writes lines.
const quiet = () => {
  const engineConsole = vm.runInContext('console', engine) as Console;
  const was = engineConsole.log;
  engineConsole.log = () => undefined;
  return () => {
    engineConsole.log = was;
  };
};

describe('createTurnContext', () => {
  test("holds the turn's state, slot rows and turn, and an empty log", () => {
    const tc = turnContext(engine, { turn: 4, players: [] }, { freshPlayers: [{ player_index: 0 }], turn: 4 });
    expect(tc.G['turn']).toBe(4);
    expect(tc.freshPlayers).toEqual([{ player_index: 0 }]);
    expect(tc.expectedTurnToRun).toBe(4);
    expect(tc.turnLog).toEqual([]);
  });

  test('is a plain object: a value nothing has set yet reads as undefined', () => {
    const tc = vm.runInContext('createTurnContext({turn:1},[],1)', engine) as Record<string, unknown>;
    expect(types.isProxy(tc)).toBe(false);
    expect(Object.getPrototypeOf(Object.getPrototypeOf(tc))).toBeNull(); // the vm's Object.prototype
    expect(() => tc['notSetYet']).not.toThrow();
    expect(tc['notSetYet']).toBeUndefined();
  });

  test('emit files a line under the hero and the phase the context names when it is written', () => {
    // A world holds its heroes (every saved state has `characters`): emit looks up the realm of the hero whose order is
    // resolving (P1-12c1). Hero 7 isn't among them, so he serves no realm and keeps his lines.
    const tc = turnContext(engine, { turn: 1, players: [], characters: [] });
    const restore = quiet();
    const emit = engineFn(engine, 'emit') as (tc: TurnContext, event: Record<string, unknown>) => void;
    // A line is a fact (P1-12d18): one of a kind that holds no values.
    const A_LINE = { kind: "a battle's losses, tallied from its lines" };
    const line = (place?: Record<string, unknown>) => {
      emit(tc, { type: 'combat', fact: A_LINE, audience: {}, hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING, ...place });
      return tc.turnLog[tc.turnLog.length - 1];
    };
    try {
      expect(line()).toMatchObject({ type: 'combat', fact: A_LINE, charId: null, phase: null, public: false });
      tc._logCtx = { charId: 7, phase: 2 };
      expect(line()).toMatchObject({ charId: 7, phase: 2 });
      expect(line({ hero: 9, phase: 4 })).toMatchObject({ charId: 9, phase: 4 });
      tc._logCtx = { charId: null, phase: null };
      tc._currentPhase = 3;
      expect(line()).toMatchObject({ charId: null, phase: 3 });
      tc._currentPhase = null;
      tc._afterPhases = true;
      expect(line()).toMatchObject({ phase: 99 });
      expect(tc.turnLog).toHaveLength(5);
    } finally {
      restore();
    }
  });
});

describe('the title lookups', () => {
  type Lookup = (tc: TurnContext, who: unknown, key: string) => boolean;
  const charHoldsTitle = engineFn(engine, 'charHoldsTitle') as Lookup;
  const playerHoldsTitle = engineFn(engine, 'playerHoldsTitle') as Lookup;
  const charMinor = engineFn(engine, 'charMinor') as Lookup;
  const holders = {
    _titleHolders: { marshal: { charId: 11, playerIndex: 1 }, sea: { charId: null, playerIndex: 2 } },
    _minorHolders: { naturalist: { charId: 12 } },
  };
  const tc = turnContext(engine, { turn: 9, ...holders });
  const bare = turnContext(engine, { turn: 9 });

  test('charHoldsTitle: the holder only', () => {
    expect(charHoldsTitle(tc, { id: 11 }, 'marshal')).toBe(true);
    expect(charHoldsTitle(tc, { id: 12 }, 'marshal')).toBe(false);
    expect(charHoldsTitle(tc, { id: 11 }, 'monster')).toBe(false);
    expect(charHoldsTitle(tc, null, 'marshal')).toBe(false);
    expect(charHoldsTitle(tc, { id: null }, 'sea')).toBe(false); // a title held by a realm, not a hero
    expect(charHoldsTitle(bare, { id: 11 }, 'marshal')).toBe(false);
  });

  test("playerHoldsTitle: the holder's realm only", () => {
    expect(playerHoldsTitle(tc, 1, 'marshal')).toBe(true);
    expect(playerHoldsTitle(tc, 2, 'sea')).toBe(true);
    expect(playerHoldsTitle(tc, 0, 'marshal')).toBe(false);
    expect(playerHoldsTitle(tc, 1, 'monster')).toBe(false);
    expect(playerHoldsTitle(bare, 1, 'marshal')).toBe(false);
  });

  test('charMinor: the holder only', () => {
    expect(charMinor(tc, { id: 12 }, 'naturalist')).toBe(true);
    expect(charMinor(tc, { id: 11 }, 'naturalist')).toBe(false);
    expect(charMinor(tc, null, 'naturalist')).toBe(false);
    expect(charMinor(bare, { id: 12 }, 'naturalist')).toBe(false);
  });
});

describe('relations', () => {
  type Pair = (tc: TurnContext, a: number | null, b: number | null) => unknown;
  const relationBetween = engineFn(engine, 'relationBetween') as Pair;
  const areEnemies = engineFn(engine, 'areEnemies') as Pair;
  const areAllied = engineFn(engine, 'areAllied') as Pair;
  const REALMS = 6;
  const realm = fc.integer({ min: 0, max: REALMS - 1 });
  // G.relations as the engine keeps it: "min-max" → 'enemy' | 'allied'; a pair with no entry is neutral.
  const relations = fc.dictionary(
    fc.tuple(realm, realm).map(([a, b]) => `${String(Math.min(a, b))}-${String(Math.max(a, b))}`),
    fc.constantFrom('enemy', 'allied'),
  );

  test(
    'two realms stand to each other as they do the other way round, never both at war and allied',
    timeLimitForPropertyRuns(RUNS, 50),
    () => {
      fc.assert(
        fc.property(relations, realm, realm, (rel, a, b) => {
          const tc = turnContext(engine, { relations: rel });
          const r = relationBetween(tc, a, b);
          expect(relationBetween(tc, b, a)).toBe(r);
          expect(r).toBe(a === b ? 'self' : (rel[`${String(Math.min(a, b))}-${String(Math.max(a, b))}`] ?? 'neutral'));
          expect(areEnemies(tc, a, b) && areAllied(tc, a, b)).toBe(false);
          expect(areEnemies(tc, a, b)).toBe(r === 'enemy');
          expect(areAllied(tc, a, b)).toBe(r === 'allied');
        }),
        { examples: [[{ '1-2': 'enemy' }, 2, 1]] },
      );
    },
  );

  test('a missing realm is neutral to everyone', () => {
    const tc = turnContext(engine, { relations: { '0-1': 'enemy' } });
    expect(relationBetween(tc, null, 1)).toBe('neutral');
    expect(relationBetween(tc, 0, null)).toBe('neutral');
  });
});
