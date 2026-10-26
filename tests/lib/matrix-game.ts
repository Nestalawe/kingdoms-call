// The games of the balance matrix, set up for the engine in its bare vm (tests/lib/engine.ts) as tools/balance/play.ts
// sets a game up on the page: in a scripted game realm 0 is a player's, on the matrix's scripted orders; every other
// realm is a bot. GAME is scripted-05 (four realms): tests/unit/engine-purity.test.ts plays it whole in the vm;
// tests/page/turn-shell.test.ts plays one turn of it on the page and in the vm, from the same seed, and compares the two
// (P1-18e); tests/lib/player-portal-copies.ts plays it with the engine's modules imported directly, from SETUPS
// (P1-11a2). Every game of a set, with a report for every realm: tools/balance/every-realm.ts (P1-12a1).
import vm from 'node:vm';
import { MAP_SIZES, matrix, SCRIPTED_REALM, START, type GameSpec } from '../../tools/balance/matrix.ts';
import { scriptedOrders, type State } from '../../tools/balance/scripted.ts';

const found = matrix('A').find((g) => g.id === 'scripted-05');
if (!found) throw new Error('the balance matrix has no game scripted-05');
export const GAME = found;

/** Whether realm `i` of `spec` is the scripted player's (the others are bots). */
const scriptedRealm = (spec: GameSpec, i: number) => spec.group === 'scripted' && i === SCRIPTED_REALM;

/** The realms of `spec` as tools/balance/play.ts sets them up. */
export const setupsOf = (spec: GameSpec) =>
  Array.from({ length: spec.realms }, (_, i) => ({
    id: i,
    gamePlayerId: 'gp' + String(i),
    isBot: !scriptedRealm(spec, i),
    name: 'Realm' + String(i),
    kingName: 'King' + String(i),
    kingdomName: 'Realm' + String(i),
    race: process.env['KC_RACE'] ?? spec.races[i % spec.races.length],
    alignment: spec.alignments[i % spec.alignments.length],
    temper: 'Brave',
    skills: { melee: 1, tactical: 1, march: 1, white: 1, naval: i % 3 === 0 ? 1 : 0, sage: 1, explorer: 1 },
  }));

// The realms of GAME: realm 0 the scripted player's, the others bots.
export const SETUPS = setupsOf(GAME);

/** How many numbers the GM page draws from its dice as it loads, before the matrix makes its world: one, its tab's id
 *  (`_tabId`, src/ui/gm/auto-turn.ts). The page and the engine start from the same seed, so the world is the matrix's
 *  only once the engine's dice have moved on as far. */
export const PAGE_DRAWS_AS_IT_LOADS = 1;

/** A new world for `spec`, made by the engine itself (in `engine`, a context from tests/lib/engine.ts), as the shell's
 *  caller saves it (JSON). */
export function newWorldOf(engine: vm.Context, spec: GameSpec): string {
  const make = vm.runInContext(
    `(setups,size,opts,diplomacy)=>{ const g=generateNewGame(JSON.parse(setups),JSON.parse(size),0,JSON.parse(opts));
      g.turnMode={mode:'manual',time:'20:00',everyDays:1,nextDeadlineAt:null,turnRanAt:null};
      g.botDifficulty='hard'; g.botDiplomacy=diplomacy; return JSON.stringify(g); }`,
    engine,
  ) as (...a: string[]) => string;
  return make(
    JSON.stringify(setupsOf(spec)),
    JSON.stringify(MAP_SIZES[spec.realms]),
    JSON.stringify({
      seaPct: spec.seaPct,
      // KC_ALIGN_PROTO: the alignment kits switched on (src/engine/alignment-prototypes.ts), as the page's games have them
      alignmentPrototypes: (process.env['KC_ALIGN_PROTO'] ?? '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      alignmentPrototypeTactics: process.env['KC_ALIGN_TACTICS'] === '1',
      botLairHunting: process.env['KC_BOT_LAIRS'] === '1',
    }),
    spec.diplomacy,
  );
}

/** A new world for GAME (newWorldOf). */
export const newWorld = (engine: vm.Context): string => newWorldOf(engine, GAME);

/** The slot rows of `spec` for a turn, as the shell loads them, as JSON: in a scripted game realm 0 with the scripted
 *  orders it sent, the others bots. JSON, so that a page and a vm each make their own objects from it. */
export function slotRowsJsonOf(spec: GameSpec, state: string, turn: number): string {
  const setups = setupsOf(spec);
  const orders = setups.some((s) => !s.isBot)
    ? JSON.stringify(scriptedOrders(JSON.parse(state) as State, SCRIPTED_REALM, turn).orders)
    : null;
  return JSON.stringify(
    setups.map((s) => ({
      id: 'G1gp' + String(s.id),
      game_id: 'G1',
      user_id: s.isBot ? null : 'u' + String(s.id),
      player_index: s.id,
      display_name: s.name,
      orders_submitted: !s.isBot,
      orders: s.isBot ? null : orders,
      turn_report: JSON.stringify(s.isBot ? { isBot: true, playerSetup: {} } : {}),
    })),
  );
}

/** The slot rows of GAME for a turn (slotRowsJsonOf). */
export const slotRowsJson = (state: string, turn: number): string => slotRowsJsonOf(GAME, state, turn);

/** The slot rows (slotRowsJson), made in the vm, so they are its own objects, as the shell's are the page's. */
export function slotRows(engine: vm.Context, state: string, turn: number): unknown {
  return (vm.runInContext('(j)=>JSON.parse(j)', engine) as (j: string) => unknown)(slotRowsJson(state, turn));
}

/** The world as the shell saves it after a turn (src/ui/gm/turn-shell.ts): the run's time stamped in its turn mode. Any
 *  time will do: the matrix's hashes read every time as the same. */
export function stampedAsTheShellSaves(state: string): string {
  const world = JSON.parse(state) as { turnMode?: Record<string, unknown> };
  if (world.turnMode) world.turnMode['turnRanAt'] = START;
  return JSON.stringify(world);
}
