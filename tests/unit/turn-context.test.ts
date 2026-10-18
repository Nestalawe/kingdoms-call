// The turn's context and the helpers lifted out of resolveTurn with it (plan P1-08a), called directly in the bare vm
// (tests/lib/engine.ts).
// - createTurnContext holds the turn's state, slot rows and turn, and an empty log; log() files a line under the hero
//   and the phase the context names as it is when the line is written, not as it was when the context was made.
// - The title lookups the balance matrix never runs (charHoldsTitle, playerHoldsTitle: nothing calls them today), and
//   charMinor beside them: true for the holder only.
// - Relations (property, fast-check): whatever G.relations holds, two realms stand to each other as they stand the
//   other way round, are never both at war and allied, a realm is itself, and a missing realm is neutral.
// Level 1 (unit): each function is called on a context made in the test; nothing else of the turn runs.
import vm from 'node:vm';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { engineFn, loadEngine, turnContext, type TurnContext } from '../lib/engine.ts';

const engine = loadEngine({ seed: 1 });
// log() echoes each line to the console: quiet it while a test writes lines.
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

  test('log() files a line under the hero and the phase the context names when it is written', () => {
    const tc = turnContext(engine, { turn: 1, players: [] });
    const restore = quiet();
    const line = (meta?: Record<string, unknown>) => {
      tc.log('combat', 'a line', meta);
      return tc.turnLog[tc.turnLog.length - 1];
    };
    try {
      expect(line()).toMatchObject({ type: 'combat', text: 'a line', charId: null, phase: null, public: false });
      tc._logCtx = { charId: 7, phase: 2 };
      expect(line()).toMatchObject({ charId: 7, phase: 2 });
      expect(line({ charId: 9, phase: 4 })).toMatchObject({ charId: 9, phase: 4 });
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

  test('two realms stand to each other as they do the other way round, never both at war and allied', () => {
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
  });

  test('a missing realm is neutral to everyone', () => {
    const tc = turnContext(engine, { relations: { '0-1': 'enemy' } });
    expect(relationBetween(tc, null, 1)).toBe('neutral');
    expect(relationBetween(tc, 0, null)).toBe('neutral');
  });
});
