// One game of the balance matrix, scripted-05, set up for the engine in its bare vm (tests/lib/engine.ts) as
// tools/balance/play.ts sets a game up on the page: realm 0 is a player's, on the matrix's scripted orders, and the
// other three are bots. tests/unit/engine-purity.test.ts plays it whole in the vm; tests/page/turn-shell.test.ts plays
// one turn of it on the page and in the vm, from the same seed, and compares the two (P1-18e).
import vm from 'node:vm';
import { MAP_SIZES, matrix, SCRIPTED_REALM } from '../../tools/balance/matrix.ts';
import { scriptedOrders, type State } from '../../tools/balance/scripted.ts';

const found = matrix('A').find((g) => g.id === 'scripted-05');
if (!found) throw new Error('the balance matrix has no game scripted-05');
export const GAME = found;

// The realms as tools/balance/play.ts sets them up: realm 0 the scripted player's, the others bots.
const SETUPS = Array.from({ length: GAME.realms }, (_, i) => ({
  id: i,
  gamePlayerId: 'gp' + String(i),
  isBot: i !== SCRIPTED_REALM,
  name: 'Realm' + String(i),
  kingName: 'King' + String(i),
  kingdomName: 'Realm' + String(i),
  race: GAME.races[i % GAME.races.length],
  alignment: GAME.alignments[i % GAME.alignments.length],
  temper: 'Brave',
  skills: { melee: 1, tactical: 1, march: 1, white: 1, naval: i % 3 === 0 ? 1 : 0, sage: 1, explorer: 1 },
}));

/** A new world for the game, made by the engine itself (in `engine`, a context from tests/lib/engine.ts), as the
 *  shell's caller saves it (JSON). */
export function newWorld(engine: vm.Context): string {
  const make = vm.runInContext(
    `(setups,size,opts,diplomacy)=>{ const g=generateNewGame(JSON.parse(setups),JSON.parse(size),0,JSON.parse(opts));
      g.turnMode={mode:'manual',time:'20:00',everyDays:1,nextDeadlineAt:null,turnRanAt:null};
      g.botDifficulty='hard'; g.botDiplomacy=diplomacy; return JSON.stringify(g); }`,
    engine,
  ) as (...a: string[]) => string;
  return make(
    JSON.stringify(SETUPS),
    JSON.stringify(MAP_SIZES[GAME.realms]),
    JSON.stringify({ seaPct: GAME.seaPct }),
    GAME.diplomacy,
  );
}

/** The game's slot rows for a turn, as the shell loads them, as JSON: realm 0 with the scripted orders it sent, the
 *  others bots. JSON, so that a page and a vm each make their own objects from it. */
export function slotRowsJson(state: string, turn: number): string {
  const orders = JSON.stringify(scriptedOrders(JSON.parse(state) as State, SCRIPTED_REALM, turn).orders);
  return JSON.stringify(
    SETUPS.map((s) => ({
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

/** The slot rows (slotRowsJson), made in the vm, so they are its own objects, as the shell's are the page's. */
export function slotRows(engine: vm.Context, state: string, turn: number): unknown {
  return (vm.runInContext('(j)=>JSON.parse(j)', engine) as (j: string) => unknown)(slotRowsJson(state, turn));
}
