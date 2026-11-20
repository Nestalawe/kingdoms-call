// Two fuzzes of whole all-bot games (2026-09-27). In each, no turn may throw or write to the error console. In the
// first, one realm of each game is Orcish, so the wage pass's war-spoils discount is taken: after every turn each
// realm's army wages and its Orcish discount (the wages the turn charged, `_lastWages`) are whole numbers, never below
// nothing. In the second, after every turn each realm's report is built from what it may see, and its titles name no
// realm it hasn't met and no hero of one (the ruling R-046; the check is
// tests/lib/the-names-of-unmet-realms-and-their-heroes-a-realms-titles-show.ts).
//
// Level 3 (simulation): it plays whole seeded games, as the shell plays them (resolveTurn, then the reports), on the
// engine's modules imported directly (tests/lib/a-staged-turn-on-the-engines-modules.ts's play), and the faults it looks
// for are in whatever the bots happen to do: no staged turn shows them. A property of every game, so it plays on any
// seed: the engine's dice are seeded from KC_SEED.
//
// Until plan P1-14z these were tests/fuzz-wages-combat.test.js and tests/fuzz-advance-masking.test.js, which ran the
// same games through the GM page's runTurn on the fake database, waiting 10 ms after each turn; here there is no wait.
// Their checks are kept; the masking script's archive round-trip is a unit test now
// (unit/the-gm-pages-start-up-sign-in-and-turn-mode-on-the-values-handed-them.test.ts), and their personal-combat
// halves have been unit/fuzz-personal-combat.test.ts since plan P1-08f. 3 games of 10 turns with 5 realms each
// (KC_FULL: 6 of 20 with 6).
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { aStagedTurnOnTheEnginesModules, type World } from '../lib/a-staged-turn-on-the-engines-modules.ts';
import {
  theTitlesAreShownMasked,
  theUnmetNamesTheTitlesShow,
  type ARealmAsTheTitlesCheckReadsIt,
  type ARealmsTitles,
  type TheWorldAsTheTitlesCheckReadsIt,
} from '../lib/the-names-of-unmet-realms-and-their-heroes-a-realms-titles-show.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';
import type { GameState } from '../../src/schemas/saved-game-state.ts';

const full = process.env['KC_FULL'] === '1';
const GAMES = full ? 6 : 3;
const TURNS = full ? 20 : 10;
const REALMS = full ? 6 : 5;
const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
/** Console errors the scripts let pass: the page's own about what it could not load. */
const NOT_THE_TURNS = /Could not load|stub|fetch/i;

interface Realm extends ARealmAsTheTitlesCheckReadsIt {
  race?: string;
  _lastWages?: { armyWages?: unknown; orcSpoilsG?: unknown };
}
type Saved = World & TheWorldAsTheTitlesCheckReadsIt & { players: Realm[] };

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

/** Plays GAMES whole all-bot games on fresh modules, as the scripts did, and hands `afterEachTurn` each world the turns
 *  leave. What goes wrong in a run goes into `runs`. */
async function playTheGames(
  { oneRealmOrcish }: { oneRealmOrcish: boolean },
  runs: string[],
  afterEachTurn: (S2: Saved, where: string) => void,
) {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { generateBotSetups } = await import('../../src/engine/bots/setup.ts');
  const { generateNewGame } = await import('../../src/engine/world/generate.ts');
  const errors: string[] = [];
  const consoleError = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
    const text = a.map(String).join(' ');
    if (!NOT_THE_TURNS.test(text)) errors.push(text);
  });
  try {
    for (let g = 0; g < GAMES; g++) {
      const setup = generateBotSetups([], REALMS, 0).map((b) => ({
        ...b,
        gamePlayerId: 'gp' + String(b.id),
        name: b.kingdomName,
      }));
      const first = setup[0];
      // one Orcish realm a game, so the war-spoils discount is taken
      if (oneRealmOrcish && first) first.race = 'Orcish';
      const made = quietly(() =>
        generateNewGame(setup, { cols: 12, rows: 7 }, 999, { seaPct: 35 + 10 * g }),
      ) as unknown as World;
      made['botDifficulty'] = 'hard';
      made['botDiplomacy'] = g % 2 ? 'hostile' : 'normal';
      made['turnMode'] = { mode: 'manual', time: '20:00', everyDays: 1, nextDeadlineAt: null, turnRanAt: null };
      const rows = setup.map((sp) => ({
        id: sp.gamePlayerId,
        user_id: null,
        player_index: sp.id,
        display_name: sp.name,
        orders: null,
        orders_submitted: false,
        turn_report: JSON.stringify({ isBot: true }),
      }));
      let state = JSON.stringify(made);
      for (let t = 1; t <= TURNS; t++) {
        const where = `game ${String(g)} turn ${String(t)}`;
        errors.length = 0;
        let S2: Saved;
        try {
          S2 = sc.play(state, rows).S2 as Saved;
        } catch (e) {
          runs.push(`${where}: the turn threw: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
          break;
        }
        for (const error of errors) runs.push(`${where}: on the error console: ${error.split('\n')[0] ?? ''}`);
        afterEachTurn(S2, where);
        state = JSON.stringify(S2);
      }
    }
  } finally {
    consoleError.mockRestore();
  }
}

describe(`the wages of ${String(GAMES)} whole all-bot games of ${String(TURNS)} turns, one realm Orcish in each`, () => {
  const runs: string[] = [];
  const badWages: string[] = [];
  let orcishRealmTurns = 0;
  beforeAll(
    async () => {
      await playTheGames({ oneRealmOrcish: true }, runs, (S2, where) => {
        for (const p of S2.players) {
          const wages = p._lastWages;
          if (!wages) continue;
          if (p.race === 'Orcish') orcishRealmTurns++;
          const army = wages.armyWages;
          const spoils: unknown = wages.orcSpoilsG ?? 0;
          if (!Number.isInteger(army) || Number(army) < 0)
            badWages.push(`${where}: ${String(p.name)}'s army wages are ${String(army)}`);
          if (!Number.isInteger(spoils) || Number(spoils) < 0)
            badWages.push(`${where}: ${String(p.name)}'s Orcish discount is ${String(spoils)}`);
        }
      });
    },
    timeLimitForTheWork({ matrixGamesPlayed: GAMES }).timeout,
  );

  test('no turn throws or writes to the error console', () => {
    expect(runs.join('\n')).toBe('');
  });
  test("every realm's army wages and Orcish war-spoils discount are whole numbers, never below nothing", () => {
    expect(badWages.join('\n')).toBe('');
    expect(orcishRealmTurns, 'an Orcish realm paid its wages').toBeGreaterThan(0);
  });
});

describe(`the titles of ${String(GAMES)} whole all-bot games of ${String(TURNS)} turns`, () => {
  const runs: string[] = [];
  const leaks: string[] = [];
  let reportsChecked = 0;
  beforeAll(
    async () => {
      const { playerView } = await import('../../src/views/what-each-realm-may-see-of-the-world.ts');
      const { buildTurnReport } = await import('../../src/views/turn-report.ts');
      await playTheGames({ oneRealmOrcish: false }, runs, (S2, where) => {
        S2.players.forEach((_, pi) => {
          let titles: ARealmsTitles | undefined;
          try {
            const report = buildTurnReport(playerView(S2 as unknown as GameState, pi)) as { titles?: ARealmsTitles };
            titles = report.titles;
          } catch (e) {
            runs.push(`${where}: realm ${String(pi)}'s report threw: ${e instanceof Error ? e.message : String(e)}`);
            return;
          }
          if (!theTitlesAreShownMasked(titles)) return;
          reportsChecked++;
          for (const leak of theUnmetNamesTheTitlesShow(S2, pi, titles)) leaks.push(`${where}: ${leak}`);
        });
      });
    },
    timeLimitForTheWork({ matrixGamesPlayed: GAMES }).timeout,
  );

  test("no turn throws or writes to the error console, and every realm's report is built", () => {
    expect(runs.join('\n')).toBe('');
  });
  test("no realm's titles name a realm it hasn't met, or a hero of one", () => {
    expect(leaks.join('\n')).toBe('');
    expect(reportsChecked, 'the titles were public in some report').toBeGreaterThan(0);
  });
});
