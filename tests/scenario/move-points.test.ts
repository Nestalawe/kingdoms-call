// What movement points a march costs (2026-10-08, item 6; moved down from the page test move-points.test.js in plan
// P1-08k8, which hooked the point pools at their declaration inside resolveTurn: they are made by the stage before the
// first phase now, and joined to the turn's context, which this reads):
//   (A) Marching into an UNDEFENDED enemy province costs 1 point, like any other step (was 2).
//   (B) A battle against neutral defenders that carries on into the next phase costs 1 point a phase if the attacker
//       has one left, the same as a carry-on battle against another realm (was free). It is fought anyway when none
//       are left.
// Each case plays one real turn (resolveTurn, in the bare vm) on a world of two realms the engine makes, both
// players', every other order Rest, the dice fixed for the whole turn (every roll lands, every other die at its
// highest). Level 2 (scenario): the cost is charged by the Move order and the stalled-battle sweep over a whole turn.
import vm from 'node:vm';
import { expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { withCaseDice } from '../lib/espionage-order-cases.ts';
import { LANDS } from '../lib/war-order-cases.ts';
import { must, type Character, type Province, type World } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 2, { cols: 10, rows: 6 }, { seaPct: 20 });
type Raw = Record<string, unknown>;
type Order = { action: string; target: string; extra: string; desc: string };
const rest = (): Order => ({ action: 'rest', target: '', extra: '', desc: '' });
const getNeighborsP = engineFn(engine, 'getNeighborsP') as (
  p: Province,
  cols: number,
  rows: number,
  ps: Province[],
) => (Province | undefined)[];
const FIRST_PHASE = 'startPhaseHealingSnapshotsAndStalledBattles';

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
  const g: Raw = engine;
  const was = g[FIRST_PHASE] as (tc: Raw, ph: number) => unknown;
  let tc: Raw | null = null;
  g[FIRST_PHASE] = (t: Raw, ph: number) => {
    tc ??= t;
    return was(t, ph);
  };
  try {
    const resolveTurn = engineFn(engine, 'resolveTurn') as (s: string, r: unknown, t: number) => { state: string };
    const inVm = vm.runInContext('(j)=>JSON.parse(j)', engine) as (j: string) => unknown;
    const r = withCaseDice(engine, LANDS, () => resolveTurn(JSON.stringify(S), inVm(JSON.stringify(rows)), S.turn));
    const ctx = must(tc as Raw | null, 'the turn’s context');
    const max = must((ctx['moveMax'] as Record<number, number>)[king.id], 'the king’s pool');
    const left = must((ctx['movePoints'] as Record<number, number>)[king.id], 'the king’s points left');
    return { after: JSON.parse(r.state) as World, king, N, used: max - left, max };
  } finally {
    g[FIRST_PHASE] = was;
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
