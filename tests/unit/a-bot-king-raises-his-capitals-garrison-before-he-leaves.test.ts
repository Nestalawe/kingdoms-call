// A bot king with no host, beside an enemy host stronger than his capital's defence, leaves in Spring (the phase-one
// pass's evacuation, runBotPhaseOne, src/engine/bots/phase-one.ts). Before bot improvements step 4 he left the capital
// empty, and the hand-played games showed an empty capital falls to any host that walks in. Now he first raises its
// garrison in Spring (orders that don't move resolve before anyone marches), with the emergency levy past the wage
// ceiling, and leaves in the second phase. Away from his capital or rich land, he leaves in Spring as before.
// Level 1 (unit): runBotPhaseOne called directly in the bare vm (tests/lib/engine.ts) on the middle of a bot world
// (tests/lib/middle-of-a-bot-world.ts). A lower level can't hold the realm, its treasury and the enemy host.
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { board, hero, type Province } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
const phaseOne = engineFn(engine, 'runBotPhaseOne') as (G: unknown, bots: Set<number>, stage: string) => void;
interface Order {
  action: string;
  target: string;
  desc: string;
}

/** Realm 0 (Human, 60g) holds the middle province and two beside it (one to fall back to); the king stands unarmed in the middle
 *  province, its capital or not; an enemy host of eight companies (realm 1, at war) stands next door. */
function stage(o: { capital: boolean }) {
  const b = board(engine, world, 0);
  const G = b.G as unknown as Record<string, unknown> & {
    players: Record<string, unknown>[];
    turnOrders: Record<string, (Order | null)[]>;
  };
  G['turn'] = 10;
  const me = G.players[0];
  if (!me) throw new Error('no realm 0');
  Object.assign(me, { alignment: 'Pagan', race: 'Human', gold: 60 });
  const next = b.ring1[0];
  const refuge = b.ring1[3];
  const home: Province | undefined = o.capital ? b.X : b.ring2[0];
  if (!next || !refuge || !home) throw new Error('no neighbours');
  me['homeProvinceId'] = home.id;
  b.own(home, 0);
  b.own(b.X, 0);
  b.own(next, 0);
  b.own(refuge, 0);
  Object.assign(b.X, { race: 'Human', tax: 5, armyTypes: ['Men-at-Arms', 'Human Garrison'] });
  const king = hero(b, { player: 0, at: b.X, king: true, skills: { melee: 2, tactical: 1 } });
  hero(b, { player: 1, at: next, troops: 8 });
  G.turnOrders[String(king.id)] = [null, null, null, null, null];
  phaseOne(b.G, new Set([0]), 'muster');
  return (G.turnOrders[String(king.id)] ?? []).map((x) => x ?? { action: 'none', target: '', desc: '' });
}

describe('an unarmed bot king beside a stronger enemy host', () => {
  test('in his capital raises its garrison in Spring, then leaves', () => {
    const o = stage({ capital: true });
    expect(o[0]?.action).toBe('recruit');
    expect(o[0]?.target).toMatch(/,to:garrison$/);
    expect(o[1]?.action).toBe('move');
  });
  test('in a poor province that is not his capital leaves in Spring, as before', () => {
    const o = stage({ capital: false });
    expect(o[0]?.action).toBe('move');
    expect(o.filter((x) => x.action === 'recruit')).toEqual([]);
  });
});
