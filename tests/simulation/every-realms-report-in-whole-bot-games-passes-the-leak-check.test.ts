// 2026-09-27 (item 6; R-060): does another realm's private business turn up in your report? Whole all-bot games, with a
// report for every realm every turn, and on each turn the report-leak check (tests/lib/report-leaks.ts, P1-04c): no
// realm reads another realm's private line, names a realm it hasn't met, sees a hero under Invisibility, reads a line
// whose audience doesn't admit it (the audience check, since P1-21b: the turn's events recorded as they are emitted and
// handed over as `perception`) or reads a line for another realm alone. Every turn hands its events over (or the
// audience check would not run on it), and every realm gets its report each turn (or there would be nothing to check).
// It also counts the lines an onlooker may see (Harvest the Field, Consecrate, Skeletal Armies), and prints them: a
// count, never a check.
//
// Level 3 (simulation): it plays whole seeded games, in the engine's bare vm (tests/lib/scenario-in-the-vm.ts), as the
// shell plays them, and the leaks it looks for are in whatever the bots happen to do: no staged turn shows them. On the
// vm, not the engine's modules: the audience check needs every event as it is emitted, with its audience, and emit is
// called inside its own file (src/engine/turn/events-and-their-audiences.ts), where a vi.spyOn on its module can't
// reach (docs/traps.md); in the vm it is stood in by name. So the games play at seed 1, as since plan P1-09a, not from
// KC_SEED (plan P1-14's Decision 6; Parked "The leak fuzz can't move to the engine's modules").
//
// Until plan P1-14i this was tests/report-privacy.test.js, a script on the same vm. Its checks are kept as they were:
// the leak check on every turn, every turn's events recorded, a report for every realm every turn, and a turn that
// throws fails (here the test, at once). The games are the same: the same seed, sizes, calls and order. 3 games of 10
// turns with 5 realms (KC_FULL: 6 of 20 with 6).
import { expect, test } from 'vitest';
import { quietEngineLog } from '../lib/engine.ts';
import { checkLeaks, describeBreaches, type SavedState } from '../lib/invariants.ts';
import { scenarioInTheVm } from '../lib/scenario-in-the-vm.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const full = process.env['KC_FULL'] === '1';
const GAMES = full ? 6 : 3;
const TURNS = full ? 20 : 10;
const REALMS = full ? 6 : 5;

/** Lines an onlooker standing in the province may see: counted, never failed. A realm's own business is the leak
 *  check's PRIVATE_LINES (tests/lib/report-leaks.ts). */
const WATCHED: [string, RegExp][] = [
  ['Harvest the Field', /💀 Harvest the Field/],
  ['Consecrate', /consecrates /],
  ['Skeletal Armies', /calls forth .* rises from the graves/],
];

interface Setup {
  id: number;
  kingdomName: string;
  [key: string]: unknown;
}
type Game = SavedState & { botDifficulty?: string; botDiplomacy?: string };

// Each game is no bigger than one of the balance matrix's (30 turns at most): a matrix game's allowance each, and one
// build of the engine's bundle for the vm.
test(
  "no realm's report in whole all-bot games reads another realm's private business, and every turn is checked",
  timeLimitForTheWork({ matrixGamesPlayed: GAMES, siteBuilds: 1 }),
  () => {
    const sc = scenarioInTheVm({ seed: 1 });
    const W = sc.W;
    // Reports are built only for the realms people play, so an all-bot game writes none: one for every realm, bots'
    // too, so the visibility filter is measured on real bot activity.
    sc.reportEveryRealm();
    // each turn's events recorded with their audiences, so the leak check's audience check runs (r.perception)
    sc.recordTheEvents();
    const generateBotSetups = W['generateBotSetups'] as (a: unknown[], n: number, k: number) => Setup[];
    const generateNewGame = W['generateNewGame'] as (s: unknown, size: unknown, x: number, o: unknown) => Game;
    const seenBy: Record<string, Set<number>> = {}; // a line's text, by game and turn → the realms shown it
    let turns = 0;
    let reportsSeen = 0;
    let unrecorded = 0;
    const leaks: string[] = [];
    for (let g = 0; g < GAMES; g++) {
      const setup = generateBotSetups([], REALMS, 0).map((b) => ({
        ...b,
        gamePlayerId: 'gp' + String(b.id),
        name: b.kingdomName,
      }));
      const restore = quietEngineLog(sc.engine);
      let S: Game;
      try {
        S = generateNewGame(setup, { cols: 12, rows: 7 }, 999, { seaPct: 35 + 5 * g });
      } finally {
        restore();
      }
      S.botDifficulty = 'hard';
      S.botDiplomacy = 'normal';
      const players = setup.map((sp) => ({
        id: sp.gamePlayerId,
        user_id: null,
        player_index: sp.id,
        display_name: sp.name,
        orders: null,
        orders_submitted: false,
        turn_report: JSON.stringify({ isBot: true }),
      }));
      for (let t = 1; t <= TURNS; t++) {
        // a turn that throws fails the test here, as it failed the script (play saves the world as JSON first)
        const r = sc.play(JSON.stringify(S), players);
        // each realm's report, as the shell writes it to turn_logs with the realm's player_index
        for (const [pi, rep] of Object.entries(r.reports)) {
          reportsSeen++;
          for (const e of (rep['lastTurnLog'] ?? []) as { text?: string }[]) {
            const k = `g${String(g)}t${String(t)}|${String(e.text)}`;
            (seenBy[k] ??= new Set()).add(Number(pi));
          }
        }
        const before = S;
        S = JSON.parse(JSON.stringify(r.S2)) as Game;
        turns++;
        const broke = checkLeaks({
          before,
          after: S,
          gmLog: r.log,
          telemetry: [],
          players: [],
          reports: Object.entries(r.reports).map(([realm, report]) => ({ realm: Number(realm), report })),
          ...(r.perception ? { perception: r.perception } : {}),
        });
        if (!r.perception) unrecorded++;
        if (broke.length) leaks.push(describeBreaches(`game ${String(g)} turn ${String(t)}`, broke));
      }
    }
    const lines = Object.entries(seenBy);
    console.log(
      `realm reports scanned: ${String(reportsSeen)} over ${String(turns)} turns; distinct lines ${String(lines.length)}, ` +
        `shown to more than one realm ${String(lines.filter(([, s]) => s.size > 1).length)}; watched: ` +
        WATCHED.map(([label, re]) => {
          const hits = lines.filter(([k]) => re.test(k));
          return `${label} ${String(hits.length)} (to more than one realm ${String(hits.filter(([, s]) => s.size > 1).length)})`;
        }).join(', '),
    );
    expect(leaks, 'no turn leaked another realm’s business into a report').toEqual([]);
    expect(unrecorded, 'every turn handed over its recorded events, so the audience check ran on it').toBe(0);
    expect(reportsSeen, 'one report a realm a turn, or there is nothing to check').toBe(turns * REALMS);
  },
);
