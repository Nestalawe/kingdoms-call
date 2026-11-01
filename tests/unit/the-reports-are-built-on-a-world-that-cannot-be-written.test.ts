// Views never write (plan P1-12b2, P1-12's Decision 9): building the reports reads the world and the GM's log, and
// writes to neither. The two writes the reports used to make, the Spy-stealth rolls and the Invisibility re-stamp, are
// an engine step of their own (spyStealthAndInvisibilityStampedForTheReports, src/engine/turn/realm-reports-and-spy-
// stealth.ts) that the shell calls after the save, before the reports. The battle flags are no longer cleared after
// the reports (the next turn's start clears them), and a hero's items are read without a write (normaliseEquipment
// writes only a flag that changes, and at report time none does). Since P1-12b3 the reports are the views' (buildReports,
// src/views/every-realms-report-and-the-lines-each-realm-reads.ts), built from what the turn hands over for them
// (whatTheReportsRead), and are lent none of the turn's dice: they draw none.
// A whole game of the balance matrix (bots-32, set A: battles, worn items, heroes moving unseen, Invisibility,
// Clairvoyance and spies' lingering sight all reach its reports) is played on the engine's modules, imported directly
// (lib/a-staged-turn-on-the-engines-modules.ts), with a report for every realm every turn, as
// tools/balance/every-realm.ts plays it in the vm, but with buildReports handed a world and a GM's log that refuse
// every write: a write (set, delete or define, on any object reached from them) is noted, then throws, so a write a
// `try` swallows is still seen; and with dice that count each draw.
// - No write, in any turn; and every report hashes as tests/balance/baseline/reports.json holds it, so the guard
//   changed nothing the reports show, and it is the matrix's own game.
// - No draw from the dice, in any turn.
// - The game reaches what the old writes were about, so the test can't pass by not getting there.
// - The reports can't be built before the Spy stealth is rolled.
// Red on the base of P1-12b2 (the reports rolled the stealth, cleared the battle flags and normalised the items), and on
// copies of src/ with each of the three writes put back (the PR shows them).
// Level 1 (unit): the engine alone, over a whole game; the writes are made deep inside the report's helpers, which
// only a game reaches with the world they write to.
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { readReports } from '../../tools/balance/baseline.ts';
import { playHash, proseHash, withoutStamps } from '../../tools/balance/hash.ts';
import { MAP_SIZES, matrix, MAX_TURNS } from '../../tools/balance/matrix.ts';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';
import { PAGE_DRAWS_AS_IT_LOADS, setupsOf, slotRowsJsonOf, stampedAsTheShellSaves } from '../lib/matrix-game.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const GAME_ID = 'bots-32';
const SPEC = matrix('A').find((g) => g.id === GAME_ID);
if (!SPEC) throw new Error(`the balance matrix has no game ${GAME_ID}`);

/** `o`, and every object read from it, refusing every write: each is handed to `note` (what, and where: indexes as
 *  #), then throws. One guard for each object, so the same object read twice is the same guard. */
function refusingEveryWrite<T>(o: T, path: string, note: (write: string) => void): T {
  const guards = new WeakMap<object, unknown>();
  const where = (at: string, key: string | symbol) => `${at}.${/^\d+$/.test(String(key)) ? '#' : String(key)}`;
  const refuse = (write: string): never => {
    note(write);
    throw new TypeError(`the reports wrote to the world: ${write}`);
  };
  const guard = (value: unknown, at: string): unknown => {
    if (value === null || typeof value !== 'object') return value;
    const known = guards.get(value);
    if (known) return known;
    const guarded = new Proxy(value, {
      get: (t, k): unknown => (typeof k === 'string' ? guard(Reflect.get(t, k), where(at, k)) : Reflect.get(t, k)),
      set: (_t, k) => refuse(`set ${where(at, k)}`),
      deleteProperty: (_t, k) => refuse(`delete ${where(at, k)}`),
      defineProperty: (_t, k) => refuse(`define ${where(at, k)}`),
      setPrototypeOf: () => refuse(`the prototype of ${at}`),
      preventExtensions: () => refuse(`no more fields on ${at}`),
    });
    guards.set(value, guarded);
    return guarded;
  };
  return guard(o, path) as T;
}

interface Report {
  worldMeta?: { provinces?: ({ hadBattle?: boolean } | null)[] };
  characters?: { items?: ({ equipped?: boolean } | null)[] }[];
  lastTurnLog?: { text?: string }[];
  spyActivity?: unknown[];
}
interface TurnContext {
  G: unknown;
  turnLog: unknown;
  freshPlayers: { user_id?: unknown }[];
}
interface Resolved {
  spyStealthAndInvisibilityStampedForTheReports(): void;
  whatTheReportsRead(): TurnContext;
}

describe(`a whole game (${GAME_ID}), every report built on a world that refuses every write`, () => {
  const played = {
    turns: [] as string[],
    writes: [] as string[],
    /** Numbers drawn from the dice while the reports were built. */
    draws: 0,
    error: '',
    /** What the game reaches, over every turn and every realm's report. */
    reached: {
      battlesMarked: 0,
      heroesWearingItems: 0,
      movedUnseen: 0,
      invisibleThisTurn: 0,
      clairvoyance: 0,
      spied: 0,
    },
    /** What the turn said when the reports were asked for before the Spy stealth, and after it. */
    beforeTheStealth: '',
    afterTheStealth: '',
  };

  beforeAll(
    async () => {
      const spec = SPEC;
      const sc = await aStagedTurnOnTheEnginesModules({ seed: spec.seed });
      const { kcRng } = await import('../../src/engine/rng.ts');
      const { generateNewGame } = await import('../../src/engine/world/generate.ts');
      const { resolveTurn } = await import('../../src/engine/run-turn.ts');
      const reportsModule = await import('../../src/views/every-realms-report-and-the-lines-each-realm-reads.ts');
      // Every realm's report (as the harness's reportEveryRealm), each built on the guarded world and log, and on dice that
      // count each draw (the ones in use, given back after).
      const build = reportsModule.buildReports;
      vi.spyOn(reportsModule, 'buildReports').mockImplementation((whatTheReportsRead: TurnContext) => {
        const was = kcRng.use(() => {
          played.draws += 1;
          return was();
        });
        try {
          return build({
            ...whatTheReportsRead,
            freshPlayers: whatTheReportsRead.freshPlayers.map((p) => ({ ...p, user_id: p.user_id ?? 'every-realm' })),
            G: refusingEveryWrite(whatTheReportsRead.G, 'G', (w) => played.writes.push(w)),
            turnLog: refusingEveryWrite(whatTheReportsRead.turnLog, 'log', (w) => played.writes.push(w)),
          });
        } finally {
          kcRng.use(was);
        }
      });
      // The matrix's world (tests/lib/matrix-game.ts's newWorldOf, on the modules): the page's draw as it loads first.
      for (let i = 0; i < PAGE_DRAWS_AS_IT_LOADS; i++) kcRng();
      const world = generateNewGame(setupsOf(spec), MAP_SIZES[spec.realms], 0, { seaPct: spec.seaPct }) as Record<
        string,
        unknown
      >;
      world['turnMode'] = { mode: 'manual', time: '20:00', everyDays: 1, nextDeadlineAt: null, turnRanAt: null };
      world['botDifficulty'] = 'hard';
      world['botDiplomacy'] = spec.diplomacy;
      const first = JSON.stringify(world);
      let state = first;
      try {
        for (let t = 1; t <= MAX_TURNS; t++) {
          const before = JSON.parse(state) as { turn: number; gameOver?: unknown };
          if (before.gameOver) break;
          const turn = sc.play(state, JSON.parse(slotRowsJsonOf(spec, state, before.turn)) as unknown[]);
          state = stampedAsTheShellSaves(JSON.stringify(turn.S2));
          const realms = Object.keys(turn.reports)
            .map(Number)
            .sort((a, b) => a - b);
          played.turns.push(
            realms
              .map((realm) => {
                const r = withoutStamps(turn.reports[realm]);
                return `${String(realm)}:${playHash(r)}/${proseHash(r)}`;
              })
              .join(' '),
          );
          const r = played.reached;
          for (const realm of realms) {
            const report = turn.reports[realm] as Report;
            r.battlesMarked += (report.worldMeta?.provinces ?? []).filter((p) => p?.hadBattle).length;
            r.heroesWearingItems += (report.characters ?? []).filter((c) =>
              (c.items ?? []).some((it) => it?.equipped === true),
            ).length;
            r.clairvoyance += (report.lastTurnLog ?? []).filter((e) => (e.text ?? '').includes('Clairvoyance')).length;
            r.spied += (report.spyActivity ?? []).length;
          }
          r.movedUnseen += turn.log.filter((e) => (e.text ?? '').includes('moved unseen this turn')).length;
          const after = turn.S2 as { turn: number; characters?: ({ _invisTurn?: number } | null)[] };
          r.invisibleThisTurn += (after.characters ?? []).filter((c) => c?._invisTurn === after.turn - 1).length;
        }
      } catch (err) {
        played.error = String((err as { message?: unknown }).message ?? err);
      }
      // The order: the game's first turn again, its reports asked for before the stealth, then after it. The engine's
      // console quiet, as the harness has it.
      vi.spyOn(console, 'log').mockImplementation(() => undefined);
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const resolved = resolveTurn(first, JSON.parse(slotRowsJsonOf(spec, first, 1)), 1, null) as Resolved;
      try {
        build(resolved.whatTheReportsRead());
      } catch (err) {
        played.beforeTheStealth = String((err as { message?: unknown }).message);
      }
      try {
        resolved.spyStealthAndInvisibilityStampedForTheReports();
        played.afterTheStealth = typeof build(resolved.whatTheReportsRead());
      } catch (err) {
        played.afterTheStealth = String((err as { message?: unknown }).message);
      }
    },
    timeLimitForTheWork({ matrixGamesPlayed: 1 }).timeout,
  );
  afterAll(() => {
    vi.restoreAllMocks();
  });

  test('the reports write nothing to the world or the GM’s log, in any turn', () => {
    expect([...new Set(played.writes)]).toEqual([]);
    expect(played.error).toBe('');
  });

  test('the reports draw no dice, in any turn', () => {
    expect(played.draws).toBe(0);
  });

  test('every report is the one the balance matrix keeps: the guard changed nothing', () => {
    const kept = readReports('A').find((g) => g.id === GAME_ID);
    expect(kept, `tests/balance/baseline/reports.json has ${GAME_ID}`).toBeDefined();
    expect(played.turns).toEqual(kept?.turns);
  });

  test('the game reaches what the old writes were about', () => {
    const r = played.reached;
    expect(r.battlesMarked, 'a battle marked on a map (the battle flags)').toBeGreaterThan(0);
    expect(r.heroesWearingItems, 'a hero wearing an item (his items read)').toBeGreaterThan(0);
    expect(r.movedUnseen, 'a hero who moved unseen (the Spy stealth)').toBeGreaterThan(0);
    expect(r.invisibleThisTurn, 'a hero made invisible this turn (the re-stamp)').toBeGreaterThan(0);
    expect(r.clairvoyance, 'a Clairvoyance watch').toBeGreaterThan(0);
    expect(r.spied, "a spy's lingering sight").toBeGreaterThan(0);
  });

  test('the reports cannot be built before the Spy stealth is rolled', () => {
    expect(played.beforeTheStealth).toBe('the Spy stealth is rolled before buildReports()');
    expect(played.afterTheStealth).toBe('object');
  });
});
