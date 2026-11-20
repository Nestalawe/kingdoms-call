// What movement points a march costs (2026-10-08, item 6; moved down from the page test move-points.test.js in plan
// P1-08k8, which hooked the point pools at their declaration inside resolveTurn: they are made by the stage before the
// first phase now, and joined to the turn's context, which this reads):
//   (A) Marching into an UNDEFENDED enemy province costs 1 point, like any other step (was 2).
//   (B) A battle against neutral defenders that carries on into the next phase costs 1 point a phase if the attacker
//       has one left, the same as a carry-on battle against another realm (was free). It is fought anyway when none
//       are left.
// Each case plays one real turn (resolveTurn, on the engine's modules since P1-14m) on a world of two realms the engine makes, both
// players', every other order Rest, the dice fixed for the whole turn (every roll lands, every other die at its
// highest). Level 2 (scenario): the cost is charged by the Move order and the stalled-battle sweep over a whole turn.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Taking an undefended enemy province costs 1 movement point; pressing on with a battle against neutral defenders costs
// 1 a phase while points remain. TypeScript, in `scenario/`, one whole turn on the engine's modules, the dice fixed for
// the turn (P1-08k8: it was a test script whose code-anchor hook handed back the point pools from their declaration in
// `resolveTurn`; the pools are made by the stage before the first phase now and read from the turn's context)
import { expect, test, vi } from 'vitest';
import {
  botWorld,
  loadTheEngineOnItsModules,
  must,
  quietEngineLog,
  withDice,
  withRolls,
  type Character,
  type Province,
  type World,
} from '../lib/the-middle-of-a-bot-world-in-a-turn-on-the-engines-modules.ts';

const engine = await loadTheEngineOnItsModules({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 2, { cols: 10, rows: 6 }, { seaPct: 20 });
/** The dice for the whole turn: every roll lands, every other die at its highest (lib/war-order-cases.ts's LANDS
 *  too), fixed as lib/espionage-order-cases.ts's withCaseDice fixes a case's. */
const LANDS = { roll: 1, die: 0.99999 };
const withTheTurnsDice = <T>(body: () => T): T =>
  withDice(engine, [LANDS.die], () => withRolls(engine, LANDS.roll, body));
type Raw = Record<string, unknown>;
interface Order {
  action: string;
  target: string;
  extra: string;
  desc: string;
}
const rest = (): Order => ({ action: 'rest', target: '', extra: '', desc: '' });
const getNeighborsP = engine.getNeighborsP as unknown as (
  p: Province,
  cols: number,
  rows: number,
  ps: Province[],
) => (Province | undefined)[];
// The stage before the first phase, which run-turn.ts calls (from another file, so a stand-in on its module reaches it).
const thePhaseStages =
  await import('../../src/engine/turn/phase-stages-start-intents-and-reactions-orders-in-two-tiers-and-end.ts');

/** Plays one turn: realm 0's king, with his army, at home beside a free land province N (its lair and guard gone),
 *  staged further by `prepare`, which may give the king his orders. What the turn's point pools hold for him after it,
 *  and the world as saved. */
function stage(
  prepare: (S: World & Raw, king: Character, home: Province, N: Province | undefined) => Order[] | undefined,
) {
  const S = JSON.parse(world) as World & Raw;
  S['safeStart'] = false;
  const king = must(
    S.characters.find((c) => c.alive && c.player === 0 && c.isKing),
    'the king',
  );
  const home = must(S.world.provinces[king.location], 'his home');
  const N = getNeighborsP(home, 10, 6, S.world.provinces).find((p) => p && p.terrain !== 'sea' && p.owner == null);
  if (N) {
    N['features'] = [];
    const gone = new Set(N.characters);
    S.characters = S.characters.filter((c) => !gone.has(c.id) || c.player != null);
    N.characters = [];
    N.neutralDefenders = [];
    N.npcArmies = 0;
  }
  const kingOrders = prepare(S, king, home, N);
  const orders: Record<number, Order[]> = {};
  S.characters.filter((c) => c.alive).forEach((c) => (orders[c.id] = [0, 1, 2, 3, 4].map(rest)));
  if (kingOrders) orders[king.id] = kingOrders;
  const payload = (pi: number) =>
    JSON.stringify({
      orders: Object.fromEntries(
        S.characters.filter((c) => c.alive && c.player === pi).map((c) => [c.id, orders[c.id]]),
      ),
      encounterPlans: {},
      kingSkills: {},
      diplomacy: {},
      discoveryChoices: {},
      callReckoning: false,
      concede: false,
      messages: [],
      heroOrder: [],
      forTurn: S.turn,
    });
  const rows = S.players.map((_, i) => ({
    id: 'gp' + String(i),
    user_id: 'u' + String(i),
    player_index: i,
    display_name: 'Realm ' + String(i),
    orders: payload(i),
    orders_submitted: true,
    turn_report: '{}',
  }));
  const was = thePhaseStages.startPhaseHealingSnapshotsAndStalledBattles;
  let tc: Raw | null = null;
  const firstPhase = vi
    .spyOn(thePhaseStages, 'startPhaseHealingSnapshotsAndStalledBattles')
    .mockImplementation((t, ph) => {
      tc ??= t as unknown as Raw;
      was(t, ph);
    });
  try {
    const resolveTurn = engine.resolveTurn as unknown as (s: string, r: unknown, t: number) => { state: string };
    const r = withTheTurnsDice(() => resolveTurn(JSON.stringify(S), JSON.parse(JSON.stringify(rows)), S.turn));
    const ctx = must(tc as Raw | null, 'the turn’s context');
    const max = must((ctx['moveMax'] as Record<number, number>)[king.id], 'the king’s pool');
    const left = must((ctx['movePoints'] as Record<number, number>)[king.id], 'the king’s points left');
    return { after: JSON.parse(r.state) as World, king, N, used: max - left, max };
  } finally {
    firstPhase.mockRestore();
  }
}

test('(A) taking an undefended enemy province costs 1 movement point', () => {
  const found: { N: boolean; army: boolean } = { N: false, army: false };
  const r = stage((S, king, _home, N) => {
    found.N = !!N;
    found.army = king.armies.length > 0;
    const p = must(N, 'a free land province beside the capital');
    p.owner = 1;
    must(S.players[1], 'realm 1').provinces.push(p.id);
    p.neutralDefenders = [];
    p.npcArmies = 0;
    p.garrisonArmies = [];
    p['garrison'] = [];
    delete p._leaderlessDefenders;
    S.relations = { ...S.relations, '0-1': 'enemy' };
    return [{ action: 'move', target: String(p.id), extra: '', desc: '' }, rest(), rest(), rest(), rest()];
  });
  expect(found).toEqual({ N: true, army: true });
  expect(r.after.world.provinces[must(r.N, 'N').id]?.owner).toBe(0);
  expect(r.used).toBe(1);
});

test('(B) pressing on against neutral defenders already joined costs a movement point', () => {
  const r = stage((_S, king, home, N) => {
    const p = must(N, 'a free land province beside the capital');
    p.owner = null;
    p._battleUnresolved = true;
    p._leaderlessDefenders = true;
    p.neutralDefenders = [
      { type: 'Heavy Infantry', quality: 'Elite', unitName: 'Old Guard I', race: 'Human' },
      { type: 'Heavy Infantry', quality: 'Elite', unitName: 'Old Guard II', race: 'Human' },
    ];
    p.npcArmies = 2;
    home.characters = home.characters.filter((id) => id !== king.id);
    p.characters = [...p.characters, king.id];
    king.location = p.id;
  });
  expect(r.used).toBeGreaterThanOrEqual(1);
});
