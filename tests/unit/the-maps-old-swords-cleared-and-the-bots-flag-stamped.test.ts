// The last two lines of set-up rules in resolveTurn, named (plan P1-08n), in the set-up's file
// (src/engine/turn/set-up-the-turns-start-repairs-and-the-merge-of-the-realms-orders.ts):
// - lastTurnsBattleAndDuelSwordsClearedFromTheMap(G): as the save is read, every province loses the red crossed swords
//   (a battle) and the purple ones (a duel) the save still holds from last turn, so the map and the reports show only
//   this turn's fights;
// - everyRealmStampedBotOrHumanFromTheBotSlotRows(turnContext): once the context is made, every realm is stamped a bot's
//   or a human's from the slot rows (_isBot), whatever the save held, so the bots' passes tell them apart.
// First through a whole turn of the balance matrix's scripted-05 (lib/matrix-game.ts: realm 0 a player's, the other
// three bots), on a turn seed of its own: a save holding last turn's swords, or the wrong bot flags, plays exactly the
// turn the clean save plays, and the world after it has the slot rows' flags. These pass on the code before P1-08n too.
// Then each function called directly: what it changes and what it leaves, a save or a realm list with gaps, and where
// resolveTurn calls it (each stood in, in the vm, for the test's length). Beside them, the lines of resolveTurn's read
// of the save no game reaches (P1-10b51): what a failing read threw, in its words and as the cause; a save that parses
// into no game in play, refused first; a save handed as an object, changed in place; each bot realm's rivals at the
// start, a copy, none for a realm with none or no realm. Properties (fast-check): the swords cleared take off exactly
// the two marks and nothing else; the stamp sets exactly the slot rows' seats and nothing else.
// Level 1 (unit): resolveTurn and the two functions in the bare vm (lib/engine.ts); the whole turn reads only the save
// and the slot rows, so no lower level holds it, and no page is needed.
import { isDeepStrictEqual } from 'node:util';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { GAME, newWorld, slotRows } from '../lib/matrix-game.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
const TURN_SEED = 0x5eed0002;
const SWORDS = 'lastTurnsBattleAndDuelSwordsClearedFromTheMap';
const STAMP = 'everyRealmStampedBotOrHumanFromTheBotSlotRows';

const engine = loadEngine({ seed: SEED });
quietEngineLog(engine);

type Raw = Record<string, unknown>;
interface Province extends Raw {
  id: number;
  _hadBattleThisTurn?: boolean;
  _combatPlayersThisTurn?: number[];
}
interface Realm extends Raw {
  _isBot?: boolean;
}
interface World {
  world: { provinces: (Province | null)[] };
  players: (Realm | null)[];
}

/** scripted-05's world before its first turn, made by the engine (JSON). */
const WORLD = newWorld(loadEngine({ seed: GAME.seed }));
/** The seats the slot rows make bots': every realm but the scripted player's. */
const BOT_FLAGS = Array.from({ length: GAME.realms }, (_, i) => i !== 0);

/** A copy of the world, changed by `change`, as JSON. */
function staged(change: (w: World) => void): string {
  const w = JSON.parse(WORLD) as World;
  change(w);
  return JSON.stringify(w);
}

interface Played {
  state: string;
  reports: string;
}
/** One turn of `state` through resolveTurn, on the turn's own dice, and its reports, as JSON. */
function play(state: string): Played {
  const resolveTurn = engineFn(engine, 'resolveTurn') as (...a: unknown[]) => {
    state: string;
    spyStealthAndInvisibilityStampedForTheReports(): void;
    whatTheReportsRead(): unknown;
  };
  const buildReports = engineFn(engine, 'buildReports') as (whatTheReportsRead: unknown) => {
    reports: { gp: { player_index: unknown }; report: unknown }[];
  };
  const r = resolveTurn(state, slotRows(engine, WORLD, 1), 1, TURN_SEED);
  r.spyStealthAndInvisibilityStampedForTheReports();
  const { reports } = buildReports(r.whatTheReportsRead());
  return { state: r.state, reports: JSON.stringify(reports.map(({ gp, report }) => [gp.player_index, report])) };
}
const CLEAN = play(WORLD);
/** The same world, whatever order a realm's or a province's fields are in (a field deleted and set again goes last). */
const sameWorld = (a: string, b: string) => isDeepStrictEqual(JSON.parse(a), JSON.parse(b));
const flagsOf = (state: string) => (JSON.parse(state) as World).players.map((p) => p?._isBot);

/** Replaces the engine's top-level function `name` by `fn` for `body`'s length; returns what `body` returns. */
function standIn<T>(
  name: string,
  fn: (was: (...a: unknown[]) => unknown) => (...a: unknown[]) => unknown,
  body: () => T,
): T {
  const g = engine as Record<string, unknown>;
  const was = g[name] as (...a: unknown[]) => unknown;
  if (typeof was !== 'function') throw new Error(`the engine has no function ${name}`);
  g[name] = fn(was);
  try {
    return body();
  } finally {
    g[name] = was;
  }
}

describe('a whole turn: last turn’s swords', () => {
  test('the clean save holds no swords, so the turns below compare with a turn that starts with none', () => {
    const w = JSON.parse(WORLD) as World;
    expect(w.world.provinces.filter((p) => p && ('_hadBattleThisTurn' in p || '_combatPlayersThisTurn' in p))).toEqual(
      [],
    );
  });
  test.each([
    ['red and purple swords on every province', { red: true, purple: true }],
    ['only red swords (a battle) on every province', { red: true, purple: false }],
    ['only purple swords (a duel) on every province', { red: false, purple: true }],
  ])(
    'a save holding %s plays the clean save’s turn: the same world after it and the same reports',
    (_, { red, purple }) => {
      const stale = staged((w) => {
        for (const p of w.world.provinces) {
          if (!p) continue;
          if (red) p._hadBattleThisTurn = true;
          if (purple) p._combatPlayersThisTurn = [0, 1, 2, 3];
        }
      });
      const got = play(stale);
      expect(sameWorld(got.state, CLEAN.state), 'the world after the turn').toBe(true);
      expect(got.reports === CLEAN.reports, 'every report').toBe(true);
    },
  );
  test('the swords are gone by the time the turn’s context is made', () => {
    const stale = staged((w) => {
      for (const p of w.world.provinces)
        if (p) Object.assign(p, { _hadBattleThisTurn: true, _combatPlayersThisTurn: [1] });
    });
    const seen: unknown[] = [];
    standIn(
      'createTurnContext',
      (was) =>
        (...a) => {
          const G = a[0] as World;
          seen.push(
            G.world.provinces.filter((p) => p && ('_hadBattleThisTurn' in p || '_combatPlayersThisTurn' in p)).length,
          );
          return was(...a);
        },
      () => play(stale),
    );
    expect(seen).toEqual([0]);
  });
});

describe('a whole turn: the bots’ flags', () => {
  test('the clean turn leaves each realm the slot rows’ flag', () => {
    expect(flagsOf(CLEAN.state)).toEqual(BOT_FLAGS);
  });
  test.each([
    ['the player’s realm flagged a bot’s and a bot’s flagged a human’s', { 0: true, 2: false }],
    ['every realm flagged a bot’s', { 0: true, 1: true, 2: true, 3: true }],
    ['no realm flagged a bot’s', { 0: false, 1: false, 2: false, 3: false }],
    ['every flag missing', { 0: undefined, 1: undefined, 2: undefined, 3: undefined }],
  ])('a save with %s plays the clean save’s turn, each realm ending with the slot rows’ flag', (_, flags) => {
    const wrong = staged((w) => {
      for (const [i, f] of Object.entries(flags)) {
        const p = w.players[Number(i)];
        if (!p) continue;
        if (f === undefined) delete p._isBot;
        else p._isBot = f;
      }
    });
    const got = play(wrong);
    expect(flagsOf(got.state)).toEqual(BOT_FLAGS);
    expect(sameWorld(got.state, CLEAN.state), 'the world after the turn').toBe(true);
    expect(got.reports === CLEAN.reports, 'every report').toBe(true);
  });
});

describe('the swords cleared, called directly', () => {
  const clear = (G: unknown) => (engineFn(engine, SWORDS) as (G: unknown) => unknown)(G);

  test('every province loses both marks; every other mark, and a gap in the list, stays', () => {
    const G = {
      world: {
        provinces: [
          { id: 0, _hadBattleThisTurn: true, _combatPlayersThisTurn: [0, 2], _battleUnresolved: true, owner: 1 },
          null,
          { id: 2, _hadBattleThisTurn: false },
          { id: 3, _combatPlayersThisTurn: [] },
          { id: 4, name: 'Quiet Vale' },
        ],
      },
      players: [{ _isBot: true }],
    };
    expect(clear(G)).toBeUndefined();
    expect(G).toEqual({
      world: {
        provinces: [
          { id: 0, _battleUnresolved: true, owner: 1 },
          null,
          { id: 2 },
          { id: 3 },
          { id: 4, name: 'Quiet Vale' },
        ],
      },
      players: [{ _isBot: true }],
    });
  });
  test.each([
    ['no map', {}],
    ['a map with no provinces', { world: {} }],
    ['an empty province list', { world: { provinces: [] } }],
  ])('a save with %s is left as it was', (_, G) => {
    const before = JSON.stringify(G);
    clear(G);
    expect(JSON.stringify(G)).toBe(before);
  });
  test('resolveTurn calls it once, with the save it read, after the save’s upgrades and before the context is made', () => {
    const order: string[] = [];
    let handed: unknown;
    const note =
      (name: string) =>
      (was: (...a: unknown[]) => unknown) =>
      (...a: unknown[]) => {
        order.push(name);
        if (name === SWORDS) handed = a;
        return was(...a);
      };
    standIn(SWORDS, note(SWORDS), () =>
      standIn('snapshotHeldItems', note('snapshotHeldItems'), () =>
        standIn(
          'createTurnContext',
          (was) =>
            (...a) => {
              order.push('createTurnContext');
              expect(a[0]).toBe((handed as unknown[])[0]);
              return was(...a);
            },
          () => play(WORLD),
        ),
      ),
    );
    expect(order).toEqual(['snapshotHeldItems', SWORDS, 'createTurnContext']);
    expect((handed as unknown[]).length).toBe(1);
  });
  test('a failure in it is a save that can’t be read', () => {
    expect(() =>
      standIn(
        SWORDS,
        () => () => {
          throw new Error('the map is torn');
        },
        () => play(WORLD),
      ),
    ).toThrow('Could not read the saved game: the map is torn');
  });
  // What a read of the save throws, in the words the base wrote it with (`${(e && e.message) || e}`, plan P1-10b51):
  // its message, else itself; what was thrown is the new error's cause.
  const thrownBy = (thrown: unknown): unknown => {
    try {
      standIn(
        SWORDS,
        () => () => {
          throw thrown;
        },
        () => play(WORLD),
      );
    } catch (e) {
      return e;
    }
    throw new Error('the turn ran');
  };
  const torn = { message: 'the map is torn', at: 3 };
  test.each([
    ['an error of no message: its name', new Error(''), 'Error'],
    ['words', 'the map is torn', 'the map is torn'],
    ['an object with a message: the message', torn, 'the map is torn'],
    ['an object with none: the object', { at: 3 }, '[object Object]'],
    ['an object whose message is empty: the object', { message: '' }, '[object Object]'],
    ['nothing', null, 'null'],
    ['a 0', 0, '0'],
  ])('a read that throws %s, as the save that can’t be read', (_, thrown, words) => {
    expect(String(thrownBy(thrown))).toBe(`Error: Could not read the saved game: ${words}`);
  });
  test('what the read threw is the cause of the save that can’t be read', () => {
    expect((thrownBy(torn) as { cause?: unknown }).cause).toBe(torn);
  });
  test.each([
    ['nothing (null)', 'null'],
    ['a number', '5'],
    ['an empty object', '{}'],
    ['a list', '[]'],
  ])('a save that parses into %s holds no game in play: refused before anything is read', (_, save) => {
    expect(() => play(save)).toThrow(
      "Could not read the saved game: This game's save holds no game in play (no provinces, realms or list of " +
        'heroes), so no turn can run on it. Nothing was changed.',
    );
  });
  test('a save handed as an object, not words, is the turn’s working copy: the turn changes it in place', () => {
    const resolveTurn = engineFn(engine, 'resolveTurn') as (...a: unknown[]) => { state: string };
    const save = JSON.parse(WORLD) as World;
    const played = resolveTurn(save, slotRows(engine, WORLD, 1), 1, TURN_SEED);
    expect(JSON.stringify(save)).toBe(played.state);
    expect(played.state).not.toBe(WORLD);
  });
  test('property: exactly the two marks go, from every province, and nothing else changes', () => {
    const province = fc.option(
      fc.record(
        {
          id: fc.nat(99),
          _hadBattleThisTurn: fc.boolean(),
          _combatPlayersThisTurn: fc.array(fc.nat(7), { maxLength: 4 }),
          _battleUnresolved: fc.boolean(),
          owner: fc.option(fc.nat(7), { nil: null }),
        },
        { requiredKeys: ['id'] },
      ),
      { nil: null },
    );
    fc.assert(
      fc.property(fc.array(province, { maxLength: 12 }), (provinces) => {
        const G = { world: { provinces: structuredClone(provinces) } };
        clear(G);
        const want = provinces.map((p) => {
          if (!p) return p;
          const rest: Raw = { ...p };
          delete rest['_hadBattleThisTurn'];
          delete rest['_combatPlayersThisTurn'];
          return rest;
        });
        expect(G.world.provinces).toEqual(want);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });
});

describe('the bots’ flag stamped, called directly', () => {
  const stamp = (tc: unknown) => (engineFn(engine, STAMP) as (tc: unknown) => unknown)(tc);

  test('each realm is a bot’s exactly when the slot rows say so; a gap in the realms stays a gap', () => {
    const G = {
      players: [
        { _isBot: true, name: 'A' },
        null,
        { name: 'C' },
        { _isBot: false, isBot: true, name: 'D' },
        { _isBot: true },
      ],
    };
    expect(stamp({ G, _botPlayerIdx: new Set([1, 3, 9]) })).toBeUndefined();
    expect(G.players).toEqual([
      { _isBot: false, name: 'A' },
      null,
      { _isBot: false, name: 'C' },
      { _isBot: true, isBot: true, name: 'D' },
      { _isBot: false },
    ]);
  });
  test('a save with no realms is left as it was', () => {
    const G = {};
    stamp({ G, _botPlayerIdx: new Set([0]) });
    expect(G).toEqual({});
  });
  test('resolveTurn calls it once, with its context once the bots’ seats are on it, after the telemetry’s snapshot and before the set-up’s repairs', () => {
    const order: string[] = [];
    let handed: unknown[] = [];
    let seats: unknown;
    const note =
      (name: string) =>
      (was: (...a: unknown[]) => unknown) =>
      (...a: unknown[]) => {
        if (order.at(-1) !== name) order.push(name);
        if (name === STAMP) {
          handed = a;
          seats = [...((a[0] as Raw)['_botPlayerIdx'] as Set<number>)];
        }
        return was(...a);
      };
    let context: unknown;
    standIn(STAMP, note(STAMP), () =>
      standIn('telRealmSnapshot', note('telRealmSnapshot'), () =>
        standIn(
          'turnStartRepairsAndAFreshSlateOfOrdersForEveryHero',
          (was) =>
            (...a) => {
              order.push('repairs');
              context = a[0];
              return was(...a);
            },
          () => play(WORLD),
        ),
      ),
    );
    expect(order).toEqual(['telRealmSnapshot', STAMP, 'repairs']);
    expect(handed.length).toBe(1);
    expect(handed[0]).toBe(context);
    expect(seats).toEqual([1, 2, 3]);
  });
  test('each bot realm’s rivals as the turn began are a copy of its own: none for a realm with none or no realm', () => {
    const state = staged((w) => {
      const [, one, two] = w.players;
      if (!one || !two) throw new Error('scripted-05 has four realms');
      one['_encountered'] = [0, 2];
      delete two['_encountered'];
    });
    const rows = slotRows(engine, state, 1) as unknown[];
    rows.push({ player_index: 9 }); // a bot's seat no realm holds
    let atStart: Record<number, unknown> = {};
    let held: unknown;
    const STOP = 'the repairs reached';
    expect(() =>
      standIn(
        'turnStartRepairsAndAFreshSlateOfOrdersForEveryHero',
        () =>
          (...a) => {
            const tc = a[0] as Raw;
            atStart = tc['_botEncounteredAtStart'] as Record<number, unknown>;
            held = (tc['G'] as World).players[1]?.['_encountered'];
            throw new Error(STOP);
          },
        () => (engineFn(engine, 'resolveTurn') as (...a: unknown[]) => unknown)(state, rows, 1, TURN_SEED),
      ),
    ).toThrow(STOP);
    expect(Object.keys(atStart).sort()).toEqual(['1', '2', '3', '9']);
    expect(atStart[1]).toEqual([0, 2]);
    expect(atStart[1]).not.toBe(held);
    expect(atStart[2]).toEqual([]);
    expect(atStart[9]).toEqual([]);
  });
  test('property: every realm is stamped from the seats, and nothing else of it changes', () => {
    const realm = fc.option(
      fc.record({ _isBot: fc.boolean(), isBot: fc.boolean(), name: fc.string({ maxLength: 4 }) }, { requiredKeys: [] }),
      { nil: null },
    );
    fc.assert(
      fc.property(fc.array(realm, { maxLength: 8 }), fc.uniqueArray(fc.nat(10), { maxLength: 6 }), (players, bots) => {
        const G = { players: structuredClone(players) };
        stamp({ G, _botPlayerIdx: new Set(bots) });
        expect(G.players).toEqual(players.map((p, i) => (p ? { ...p, _isBot: bots.includes(i) } : p)));
      }),
      { seed: SEED, numRuns: 200 },
    );
  });
});
