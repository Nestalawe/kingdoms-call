// 2026-10-13 (item 7): every skill a turn report names is written with a capital: "Skills: Melee 2", "(Necromancy 3)",
// "casts Charm (Psychic Magic)", "drills Naval theory", "no commanding Druid". This half plays whole games, some realms
// human-held on random orders and the rest bots, and reads every line of every turn's log: none writes a skill in lower
// case before its level, in a skill list, as a school in brackets, in the theory and drills lines or as "no commanding
// druid". The code's patterns, for lines a short game may never reach, are
// static/the-engine-never-writes-a-raw-skill-key-where-the-skills-name-belongs.test.ts.
//
// Level 3 (simulation): whole games, on the engine's modules (tests/lib/a-staged-turn-on-the-engines-modules.ts's
// play, the shell's turn: resolveTurn, the Spy stealth and the views' buildReports), from KC_SEED; the lines it reads
// are whatever the games happen to write, so no staged turn would do.
//
// Until plan P1-14i this was the simulation half of tests/skill-names-capitalised.test.js, which played the games
// through the booted GM portal's runTurn on the stand-in database. Its three checks are kept: the games ran clean (a
// world or a turn that throws, or anything logged with console.error, fails the test: tests/setup/each.ts), enough
// lines to read, and no line writing a skill in lower case; two lower-case forms are added (stricter: plan P1-14's
// Decision 2), "no psychic skill" and "psychic spell limit", which the old patterns let through. What only the shell
// did is the GM page's, and tests/page/turn-shell.test.ts holds it: the orders cleared and never put back after a saved
// turn (the old "submitted-flag leak"), the game's summary saved with it (buildGameMeta). The games are the old ones:
// 4 maps in turn (9×7 to 15×7, 3 to 6 realms), the sea from 20% to 80%, 1 to all but one realm human-held, random
// races and orders, the bots hard, every other game hostile; 4 games of 8 turns (KC_FULL: 8 of 16).
import { expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
const full = process.env['KC_FULL'] === '1';
const GAMES = full ? 8 : 4;
const TURNS = full ? 16 : 8;

const DIRS = ['NW', 'NE', 'W', 'E', 'SW', 'SE'];
const ACTIONS = ['defend', 'defend', 'rest', 'practice', 'recruit', 'move', 'move', 'research', 'search', 'explore'];
const RACES = ['Human', 'Elven', 'Dwarven', 'Orcish'];
const ALIGNS = ['Divine', 'Good', 'Druidic', 'Neutral', 'Pagan', 'Evil', 'Undead'];
const MAPS = [
  { cols: 9, rows: 7, n: 4 },
  { cols: 12, rows: 7, n: 5 },
  { cols: 15, rows: 7, n: 6 },
  { cols: 8, rows: 7, n: 3 },
];
const SK =
  'melee|archery|tactical|naval|sage|spy|thief|druid|explorer|necromancy|psychic|illusory|elemental|white|march';
const SCHOOLS = 'white|psychic|illusory|elemental|necromancy';
/** A skill in lower case: before its level, opening a skill list, a school in brackets, the theory and drills lines,
 *  "no commanding druid" (the old script's five); and (stricter) "no psychic skill" and "psychic spell limit". */
const BAD = [
  new RegExp(`\\b(${SK}) [0-9]`),
  /Skills: [a-z]/,
  new RegExp(`\\((${SCHOOLS})( [0-9]+)?\\)`),
  /(naval|tactical) (theory|drills)/,
  /commanding druid/,
  new RegExp(`no (${SCHOOLS}) skill`),
  new RegExp(`(${SCHOOLS}) spell limit`),
];

interface Character {
  id: number;
  alive?: boolean;
  player?: number | null;
}
type World = Record<string, unknown> & { turn: number; gameOver?: unknown; characters?: Character[] };

// Each game is smaller than one of the balance matrix's (30 turns at most): a matrix game's allowance each.
test(
  'no line of whole games, some realms on random orders, writes a skill in lower case',
  timeLimitForTheWork({ matrixGamesPlayed: GAMES }),
  async () => {
    const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
    const { generateNewGame } = await import('../../src/engine/world/generate.ts');
    const { kcRngStream } = await import('../../src/engine/rng.ts');
    // the test's own choices (realms, races, orders) from a stream of their own, from another seed than the engine's
    // dice, so they draw nothing from those
    const choice = kcRngStream((SEED ^ 0x9e3779b9) >>> 0);
    const ri = (n: number) => Math.floor(choice() * n);
    const pick = <T>(list: readonly T[]): T => list[ri(list.length)] as T;
    const lines: string[] = [];
    for (let gi = 0; gi < GAMES; gi++) {
      const M = MAPS[gi % MAPS.length] ?? { cols: 9, rows: 7, n: 4 };
      const seaPct = [20, 35, 50, 65, 80][gi % 5];
      const humans = Math.max(1, Math.min(M.n - 1, 1 + ri(M.n - 1)));
      const setups = Array.from({ length: M.n }, (_, i) => ({
        id: i,
        gamePlayerId: 'gp' + String(i),
        isBot: i >= humans,
        name: 'Realm' + String(i),
        kingName: 'King' + String(i),
        kingdomName: 'Realm' + String(i),
        race: pick(RACES),
        alignment: ALIGNS[i % 7],
        temper: 'Brave',
        skills: { melee: 1, tactical: 1, march: 1, white: 1, naval: i % 3 === 0 ? 1 : 0, sage: 1, explorer: 1 },
      }));
      const G = generateNewGame(setups as Parameters<typeof generateNewGame>[0], { cols: M.cols, rows: M.rows }, 0, {
        seaPct,
      }) as World;
      G['turnMode'] = { mode: 'manual', time: '20:00', everyDays: 1, nextDeadlineAt: null, turnRanAt: null };
      G['botDifficulty'] = 'hard';
      G['botDiplomacy'] = gi % 2 ? 'hostile' : 'normal';
      let state = JSON.stringify(G);
      for (let t = 1; t <= TURNS; t++) {
        const live = JSON.parse(state) as World;
        if (live.gameOver) break;
        // random orders for each human realm, from the world as it stands
        const rows = setups.map((sp) => {
          const human = sp.id < humans;
          const orders = Object.fromEntries(
            (live.characters ?? [])
              .filter((c) => c.alive && c.player === sp.id)
              .map((c) => [
                c.id,
                [0, 1, 2, 3, 4].map(() => {
                  const a = pick(ACTIONS);
                  if (a === 'move') return { action: 'move', target: 'dir:' + pick(DIRS), extra: '', desc: '' };
                  if (a === 'practice')
                    return {
                      action: 'practice',
                      target: pick(['melee', 'archery', 'tactical', 'march', 'sage']),
                      extra: '',
                      desc: '',
                    };
                  return { action: a, target: '', extra: '', desc: '' };
                }),
              ]),
          );
          return {
            id: 'G' + String(gi) + 'gp' + String(sp.id),
            game_id: 'G' + String(gi),
            user_id: human ? 'u' + String(sp.id) : null,
            player_index: sp.id,
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
                  forTurn: live.turn,
                })
              : null,
            turn_report: JSON.stringify(human ? {} : { isBot: true, playerSetup: {} }),
          };
        });
        // the turn as the shell plays it; a throw, or a console.error, fails the test
        const r = sc.play(state, rows);
        // the GM's full log, as the shell saves it to turn_logs
        for (const e of r.log) if (e.text) lines.push(e.text);
        state = JSON.stringify(r.S2);
      }
    }
    expect(lines.length, `the games wrote enough lines to read (${String(lines.length)})`).toBeGreaterThan(2000);
    const bad = [...new Set(lines.filter((t) => BAD.some((re) => re.test(t))).map((t) => t.replace(/[0-9]+/g, 'N')))];
    expect(bad, 'no line writes a skill in lower case').toEqual([]);
  },
);
