// Turn sequencing (bot improvements, step 7): a player calls the storm down on a province with one order and attacks
// it with the next; the bots chose each order on its own merits, so a general beside a stormed province held. Now the
// Spring pass's order stage (runBotPhaseOne, src/engine/bots/phase-one.ts) reads the king's storm and sends a general
// standing beside the stormed province against it, in the storm's phase or later (an order that does not move
// resolves before any march in a phase), when the companies the storm should cost the defenders bring it within his
// margin. With no storm, or a host too weak even after it, he keeps his plan.
// Level 1 (unit): runBotPhaseOne called directly in the bare vm (tests/lib/engine.ts) on the middle of a bot world
// (tests/lib/middle-of-a-bot-world.ts). A lower level can't hold the hosts, the garrison and the king's orders.
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { board, hero, must } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
const phaseOne = engineFn(engine, 'runBotPhaseOne') as (G: unknown, bots: Set<number>, stage: string) => void;
interface Order {
  action: string;
  target: string;
  extra: string;
  desc: string;
}
const hold = (): Order => ({ action: 'defend', target: '', extra: '', desc: 'Hold' });

/** Realm 0 (Pagan, Human) holds the middle province, where its general stands with `host` companies and no Tactical;
 *  next door, realm 1's province (at war, Human) is held by four garrison companies, which realm 0 spied last turn, so
 *  it reckons with them (about 72 against a host's 17 a company: four companies can't take it, but can once the storm
 *  has cost it about one company and two tiers; three can't even then). The king, in a province of realm
 *  0's two steps away, calls the storm down on it in the second phase when `storm`. Returns the general's orders. */
function stage(o: { host: number; storm: boolean }) {
  const b = board(engine, world, 0);
  const G = b.G as unknown as Record<string, unknown> & {
    players: Record<string, unknown>[];
    turnOrders: Record<string, Order[]>;
  };
  G['turn'] = 10;
  G.players.forEach((p, i) => Object.assign(p, { race: 'Human', alignment: i === 0 ? 'Pagan' : 'Good' }));
  const target = b.ring1[0];
  const seat = b.ring2.find((p) => !b.nbrs(p).includes(target ?? b.X));
  if (!target || !seat) throw new Error('no ground');
  b.own(b.X, 0);
  b.own(seat, 0);
  b.own(target, 1);
  must(G.players[0], 'realm 0')['_spiedProvincesLastTurn'] = [target.id];
  target.garrisonArmies = [1, 2, 3, 4].map((k) => ({
    type: 'Men-at-Arms',
    quality: 'Regular',
    race: 'Human',
    unitName: `Gate ${String(k)}`,
  }));
  const general = hero(b, { player: 0, at: b.X, troops: o.host, skills: { melee: 2, tactical: 0 } });
  const king = hero(b, { player: 0, at: seat, king: true, skills: { melee: 2, tactical: 0 } });
  G.turnOrders[String(general.id)] = [hold(), hold(), hold(), hold(), hold()];
  const storm: Order = { action: 'call_storm', target: 'prov:' + String(target.id), extra: '', desc: 'Storm' };
  G.turnOrders[String(king.id)] = o.storm
    ? [hold(), storm, hold(), hold(), hold()]
    : [hold(), hold(), hold(), hold(), hold()];
  phaseOne(b.G, new Set([0]), 'order');
  const plan = G.turnOrders[String(general.id)] ?? [];
  const into = plan.findIndex((x) => x.action === 'move' && Number(x.target) === target.id);
  return { into };
}

describe('a general beside a province of the enemy held by four companies', () => {
  test('attacks it after the king storms it, when the storm brings it within his margin', () => {
    expect(stage({ host: 4, storm: true }).into).toBeGreaterThanOrEqual(1);
  });
  test('holds when no storm is called', () => {
    expect(stage({ host: 4, storm: false }).into).toBe(-1);
  });
  test('holds when his host is too weak even after the storm', () => {
    expect(stage({ host: 3, storm: true }).into).toBe(-1);
  });
});
