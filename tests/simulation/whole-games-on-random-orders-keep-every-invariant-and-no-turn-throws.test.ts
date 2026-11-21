// The engine's fuzz (2026-09-27): whole games played turn by turn, with random orders for the human-held realms and
// the bots playing the rest. No turn may throw or write to the error console, and every turn keeps the invariants
// (tests/lib/invariants.ts, plan P1-04b) and passes the report-leak check (tests/lib/report-leaks.ts) on the human
// realms' reports, its audience check among them (the turn's events recorded, B-18b).
//
// Level 3 (simulation): it plays whole seeded games, as the shell plays them (resolveTurn, then the reports), on the
// engine's modules imported directly (tests/lib/a-staged-turn-on-the-engines-modules.ts's play), and the faults it looks
// for are in whatever random orders and the bots happen to do: no staged turn shows them. A property of every game, so
// it plays on any seed: the engine's dice and the orders' own dice are both seeded from KC_SEED.
//
// Until plan P1-14z this was tests/turn-fuzz.test.js, which ran the same games through the GM page's runTurn on the fake
// database. Its checks are kept: a run that throws or fails (the shell turns a throw into a failed run), an error on
// the console, and every invariant. One is the shell's, not the engine's: "orders_submitted cleared" (the runaway-turn
// guard), the shell clearing every realm's orders before it saves; tests/page/turn-shell.test.ts's "a turn's writes"
// holds it, so here the slot rows are left out of the check. A small-world twin of the leak check, on any orders
// fast-check makes up, is tests/scenario/turn-properties.test.ts. 4 games of 6 turns (KC_FULL: 16 of 12).
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { aStagedTurnOnTheEnginesModules, type Order, type World } from '../lib/a-staged-turn-on-the-engines-modules.ts';
import { checkTurn, describeBreaches, type SavedState } from '../lib/invariants.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const full = process.env['KC_FULL'] === '1';
const GAMES = full ? 16 : 4;
const TURNS = full ? 12 : 6;
const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

const DIRECTIONS = ['NW', 'NE', 'W', 'E', 'SW', 'SE'];
/** The orders a human-held hero may be given, as often as the script gave them (defend and move twice). */
const ACTIONS = ['defend', 'defend', 'rest', 'practice', 'recruit', 'move', 'move', 'research', 'search', 'explore'];
const PRACTISED = ['melee', 'archery', 'tactical', 'march', 'sage'];
const RACES = ['Human', 'Elven', 'Dwarven', 'Orcish'];
const ALIGNMENTS = ['Divine', 'Good', 'Druidic', 'Neutral', 'Pagan', 'Evil', 'Undead'];
/** The maps, in turn: 3 to 6 realms. */
const MAPS = [
  { cols: 9, rows: 7, realms: 4 },
  { cols: 12, rows: 7, realms: 5 },
  { cols: 15, rows: 7, realms: 6 },
  { cols: 8, rows: 7, realms: 3 },
];
const SEA_SHARES = [20, 35, 50, 65, 80];

interface Hero {
  id: number;
  alive?: boolean;
  player?: number | null;
}

/** What `make` returns, with the console's warnings quiet while it runs (the world's own: a sea share it can't reach,
 *  say), as on the page. */
function quietly<T>(make: () => T): T {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    return make();
  } finally {
    warn.mockRestore();
  }
}

/** What each turn of each game found: what went wrong in the run, and what the invariants found. */
const runs: string[] = [];
const breaches: string[] = [];
let turnsPlayed = 0;
let ordersGiven = 0;

beforeAll(
  async () => {
    const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
    // each turn's events with their audiences, so the leak check's audience check runs (played.perception)
    sc.recordTheEvents();
    // the same fresh modules the turns play on
    const { generateNewGame } = await import('../../src/engine/world/generate.ts');
    const { kcRngStream } = await import('../../src/engine/rng.ts');
    // the orders' own dice, apart from the engine's, so a change to the orders never moves the world
    const dice = kcRngStream(SEED ^ 0x5eed);
    const pick = (n: number) => Math.floor(dice() * n);
    const anOrder = (): Order => {
      const action = ACTIONS[pick(ACTIONS.length)] ?? 'rest';
      const target =
        action === 'move'
          ? 'dir:' + (DIRECTIONS[pick(DIRECTIONS.length)] ?? 'E')
          : action === 'practice'
            ? (PRACTISED[pick(PRACTISED.length)] ?? 'melee')
            : '';
      return { action, target, extra: '', desc: '' };
    };
    const errors: string[] = [];
    // the world's warnings quiet, as on the page (a sea share it can't reach, say)
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
      errors.push(a.map(String).join(' '));
    });
    try {
      for (let g = 0; g < GAMES; g++) {
        const map = MAPS[g % MAPS.length] ?? { cols: 9, rows: 7, realms: 4 };
        const humans = Math.max(1, Math.min(map.realms - 1, 1 + pick(map.realms - 1)));
        const setups = Array.from({ length: map.realms }, (_, i) => ({
          id: i,
          gamePlayerId: 'gp' + String(i),
          isBot: i >= humans,
          name: 'Realm' + String(i),
          kingName: 'King' + String(i),
          kingdomName: 'Realm' + String(i),
          race: RACES[pick(RACES.length)] ?? 'Human',
          alignment: ALIGNMENTS[i % ALIGNMENTS.length] ?? 'Neutral',
          temper: 'Brave',
          skills: { melee: 1, tactical: 1, march: 1, white: 1, naval: i % 3 === 0 ? 1 : 0, sage: 1, explorer: 1 },
        }));
        let state: string;
        try {
          const made = quietly(() =>
            generateNewGame(setups, { cols: map.cols, rows: map.rows }, 0, {
              seaPct: SEA_SHARES[g % SEA_SHARES.length],
            }),
          ) as unknown as World;
          made['turnMode'] = { mode: 'manual', time: '20:00', everyDays: 1, nextDeadlineAt: null, turnRanAt: null };
          made['botDifficulty'] = 'hard';
          made['botDiplomacy'] = g % 2 ? 'hostile' : 'normal';
          state = JSON.stringify(made);
        } catch (e) {
          runs.push(`game ${String(g)}: the world could not be made: ${e instanceof Error ? e.message : String(e)}`);
          continue;
        }
        for (let t = 1; t <= TURNS; t++) {
          const before = JSON.parse(state) as World;
          if (before['gameOver']) break;
          const heroes = before['characters'] as Hero[];
          const rows = setups.map((sp, i) => {
            const human = i < humans;
            const orders = Object.fromEntries(
              heroes
                .filter((c) => c.alive && c.player === i)
                .map((c) => [c.id, [0, 1, 2, 3, 4].map(() => anOrder())] as const),
            );
            if (human) ordersGiven += Object.keys(orders).length;
            return {
              id: 'G' + String(g) + 'gp' + String(i),
              game_id: 'G' + String(g),
              user_id: human ? 'u' + String(i) : null,
              player_index: i,
              display_name: sp.name,
              orders_submitted: human,
              orders: human
                ? JSON.stringify({
                    orders,
                    encounterPlans: {},
                    kingSkills: {},
                    diplomacy: {},
                    discoveryChoices: {},
                    callReckoning: false,
                    concede: false,
                    messages: [],
                    heroOrder: [],
                    forTurn: before.turn,
                  })
                : null,
              turn_report: JSON.stringify(human ? {} : { isBot: true, playerSetup: {} }),
            };
          });
          const where = `game ${String(g)} turn ${String(before.turn)}`;
          errors.length = 0;
          let played: ReturnType<typeof sc.play>;
          try {
            played = sc.play(state, rows);
          } catch (e) {
            runs.push(`${where}: the turn threw: ${e instanceof Error ? e.message : String(e)}`);
            break;
          } finally {
            turnsPlayed++;
          }
          for (const error of errors) runs.push(`${where}: on the error console: ${error.split('\n')[0] ?? ''}`);
          const broke = checkTurn({
            before: before as unknown as SavedState,
            after: played.S2 as unknown as SavedState,
            gmLog: played.log,
            // the turn's deaths, as the telemetry rows hold them
            telemetry: [{ outcomes: { deaths: { list: (played.collected['deaths'] ?? []) as [] } } }],
            // the shell's (see the header)
            players: [],
            reports: Object.entries(played.reports).map(([realm, report]) => ({ realm: Number(realm), report })),
            ...(played.perception ? { perception: played.perception } : {}),
          });
          if (broke.length) breaches.push(describeBreaches(where, broke));
          state = JSON.stringify(played.S2);
        }
      }
    } finally {
      consoleError.mockRestore();
      consoleWarn.mockRestore();
    }
  },
  timeLimitForTheWork({ matrixGamesPlayed: GAMES }).timeout,
);

describe(`${String(GAMES)} whole games of ${String(TURNS)} turns on random orders`, () => {
  test('no turn throws or writes to the error console', () => {
    expect(runs.join('\n')).toBe('');
    expect(turnsPlayed, 'turns were played').toBeGreaterThan(0);
  });
  test('every turn keeps every invariant and passes the leak check', () => {
    expect(breaches.join('\n')).toBe('');
    expect(ordersGiven, 'the human-held heroes were given orders').toBeGreaterThan(0);
  });
});
