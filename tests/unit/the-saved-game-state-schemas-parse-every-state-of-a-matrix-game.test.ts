// The schemas of src/schemas/ against a real game (plan P1-10a1): the balance matrix's game scripted-05, played with
// the engine's modules imported directly (no vm), its new game and the state after each of its 20 turns, and the orders
// its scripted realm sent each turn, each parsed strictly (tests/lib/strict-schema.ts: an unnamed key fails too). Then
// three planted faults in a staged copy of a state (a field of the wrong kind, an unnamed key, a missing field) and
// two in a payload, each refused where it was planted. Level 1 (unit): one game's states parsed, about 1 s; a static
// test can't play a game, and a whole-game simulation isn't needed to read 21 states. The same parse over every game
// of both matrix sets (2,687 states) is the proof in P1-10a1's PR.
//
// The types are checked too (by the compiler, which type-checks the tests): the branded ids keep a hero's id from
// being passed as a province's.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The schemas of `src/schemas/` (P1-10a1) against a real game: the balance matrix's `scripted-05`, played with the
// engine's modules imported directly (no `vm`), its new game and the state after each of its 20 turns, and the orders
// its scripted realm sent each turn, each parsed strictly (`lib/strict-schema.ts`: every object `z.strictObject`, so a
// key the schemas don't name fails too), and a payload with every field the merge reads, as the player portal writes
// it. Planted faults in staged copies are refused where they are: a field of the wrong kind (the name repairs as text,
// in every state), an unnamed key deep in a state (and the schema the code uses drops it: only the strict version
// refuses), a missing field, and in a payload the turn as text and a phase order with an unnamed key. The branded ids
// are checked by the compiler (`expectTypeOf`): a hero's id is not a province's. Fails on its base (no `src/schemas/`);
// planted in the engine (a field of the wrong kind, an unnamed key, a missing field), each turns every turn's state
// red. Level 1: one game's states parsed, about 1 s; a static test can't play a game. TypeScript, in `unit/`
import { describe, expect, expectTypeOf, test } from 'vitest';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { resolveTurn } from '../../src/engine/run-turn.ts';
import { kcRng } from '../../src/engine/rng.ts';
import {
  CharacterIdSchema,
  type CharacterId,
  type ProvinceId,
  type RealmIndex,
} from '../../src/schemas/ids-of-provinces-heroes-and-realms.ts';
import { GameStateSchema, type Character, type Province } from '../../src/schemas/saved-game-state.ts';
import { OrdersARealmSubmitsSchema } from '../../src/schemas/orders-a-realm-submits.ts';
import { MAP_SIZES, MAX_TURNS, SCRIPTED_REALM } from '../../tools/balance/matrix.ts';
import { GAME, SETUPS, slotRowsJson } from '../lib/matrix-game.ts';
import { strictIssues } from '../lib/strict-schema.ts';

type Obj = Record<string, unknown>;
const copyOf = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** scripted-05 as the matrix plays it: the new game, then the state after each turn (as saved) and the orders the
 *  scripted realm sent for it. */
function playScripted05(): { states: Obj[]; orders: unknown[] } {
  kcRng.seed(GAME.seed);
  const g = generateNewGame(copyOf(SETUPS), copyOf(MAP_SIZES[GAME.realms]), 0, { seaPct: GAME.seaPct }) as Obj;
  g['turnMode'] = { mode: 'manual', time: '20:00', everyDays: 1, nextDeadlineAt: null, turnRanAt: null };
  g['botDifficulty'] = 'hard';
  g['botDiplomacy'] = GAME.diplomacy;
  let state = JSON.stringify(g);
  const states = [JSON.parse(state) as Obj];
  const orders: unknown[] = [];
  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    if ((JSON.parse(state) as Obj)['gameOver']) break;
    const rows = JSON.parse(slotRowsJson(state, turn)) as { player_index: number; orders: string | null }[];
    const sent = rows.find((r) => r.player_index === SCRIPTED_REALM)?.orders;
    if (sent) orders.push(JSON.parse(sent));
    const result = resolveTurn(state, rows, turn, Math.floor(kcRng() * 2 ** 32) || 1) as { state: string };
    state = result.state;
    states.push(JSON.parse(state) as Obj);
  }
  return { states, orders };
}

const played = playScripted05();
const last = (): Obj => copyOf(played.states[played.states.length - 1] ?? {});

describe("scripted-05's saved states and orders parse strictly", () => {
  test('the game is the new world and each of its turns', () => {
    expect(played.states.length).toBeGreaterThan(MAX_TURNS / 2);
    expect(played.orders.length).toBe(played.states.length - 1);
  });

  test.for(played.states.map((s, i) => [i, s] as const))(
    'the saved state after turn %i (0: the new game)',
    ([, state]) => {
      expect(strictIssues(GameStateSchema, state)).toEqual([]);
    },
  );

  test.for(played.orders.map((o, i) => [i + 1, o] as const))(
    'the orders the scripted realm sent for turn %i',
    ([, o]) => {
      expect(strictIssues(OrdersARealmSubmitsSchema, o)).toEqual([]);
    },
  );

  test('a payload with every field the merge reads, as the player portal writes it', () => {
    const payload = {
      orders: {
        '12': [
          { action: 'Move', target: '7', extra: '', desc: 'Move — 7' },
          { action: 'Search Lair', target: '0', extra: '', desc: 'Search Lair — 0', prov: 7 },
        ],
        hired_40_via_12_ph1: [{ action: 'Defend', target: '', extra: '', desc: '' }],
      },
      encounterPlans: {
        '12': { tactics: ['ME', 'CS:white'], notes: 'hold the ford', duelStance: 'refuse', evilMode: 'enslave' },
      },
      kingSkills: {
        '15': { skills: { melee: 3, sage: 2 }, pending: 0, name: 'Aldric', temper: 'Brave', base: { melee: 1 } },
      },
      diplomacy: { '1': 'treat', '2': 'enemy' },
      discoveryChoices: { 'r3-12': 'astronomical-tables' },
      callReckoning: false,
      concede: false,
      messages: [
        { to: [1, 2], text: 'Peace on the river.' },
        { to: 'all', text: 'Hear us.' },
      ],
      heroOrder: ['15', '12'],
      forTurn: 4,
    };
    expect(strictIssues(OrdersARealmSubmitsSchema, payload)).toEqual([]);
  });
});

describe('planted faults are refused, where they are', () => {
  test('a field of the wrong kind: the name repairs counted as text, in every state', () => {
    const refused = played.states.filter((s) => strictIssues(GameStateSchema, { ...s, _nameRepairs: '0' }).length);
    expect(refused.length).toBe(played.states.length);
    expect(strictIssues(GameStateSchema, { ...last(), _nameRepairs: '0' })).toEqual([
      expect.stringMatching(/^_nameRepairs: invalid_type /),
    ]);
  });

  test('an unnamed key, deep in the state: a company in a hero’s column with a field no schema names', () => {
    const s = last();
    const hero = (s['characters'] as Obj[]).find((c) => (c['armies'] as unknown[]).length);
    if (!hero) throw new Error('no hero with a company in the last state');
    const at = (s['characters'] as Obj[]).indexOf(hero);
    ((hero['armies'] as Obj[])[0] ?? {})['_veteranOf'] = 3;
    expect(strictIssues(GameStateSchema, s)).toEqual([
      expect.stringMatching(new RegExp(`^characters\\.${String(at)}\\.armies\\.0: unrecognized_keys .*_veteranOf`)),
    ]);
    // The schema as the code will use it drops the key; only the strict version refuses it.
    expect(GameStateSchema.safeParse(s).success).toBe(true);
  });

  test('a missing field: a province without its terrain', () => {
    const s = last();
    delete ((s['world'] as Obj)['provinces'] as Obj[])[3]?.['terrain'];
    expect(strictIssues(GameStateSchema, s)).toEqual([
      expect.stringMatching(/^world\.provinces\.3\.terrain: invalid_type /),
    ]);
  });

  test('in a payload: the turn written as text, and a phase order with a field no schema names', () => {
    const sent = copyOf(played.orders[0]) as Obj;
    expect(strictIssues(OrdersARealmSubmitsSchema, { ...sent, forTurn: '2' })).toEqual([
      expect.stringMatching(/^forTurn: invalid_type /),
    ]);
    const [hero, phases] = Object.entries(sent['orders'] as Record<string, Obj[]>)[0] ?? [];
    if (!hero || !phases?.[0]) throw new Error('the scripted realm sent no phase order');
    phases[0]['priority'] = 1;
    expect(strictIssues(OrdersARealmSubmitsSchema, sent)).toEqual([
      expect.stringMatching(new RegExp(`^orders\\.${hero}\\.0: unrecognized_keys .*priority`)),
    ]);
  });
});

test("the ids are branded: a hero's id is not a province's, but each is a number", () => {
  expectTypeOf<Character['id']>().toEqualTypeOf<CharacterId>();
  expectTypeOf<Character['location']>().toEqualTypeOf<ProvinceId>();
  expectTypeOf<Character['player']>().toEqualTypeOf<RealmIndex | null>();
  expectTypeOf<Province['owner']>().toEqualTypeOf<RealmIndex | null>();
  expectTypeOf<CharacterId>().not.toEqualTypeOf<ProvinceId>();
  expectTypeOf<CharacterId>().toExtend<number>();
  expectTypeOf<number>().not.toExtend<ProvinceId>();
  // (checked by the compiler; at run time, a hero's id parses as a number)
  expect(CharacterIdSchema.parse(12)).toBe(12);
});
