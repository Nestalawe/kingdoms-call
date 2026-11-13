// A bot king with no host, beside an enemy host stronger than his capital's defence, leaves in Spring (the phase-one
// pass's evacuation, runBotPhaseOne, src/engine/bots/phase-one.ts). He used to leave the capital with nothing more in
// it than its garrison, and an enemy host that walks into a lightly held capital takes it. Now he first raises its
// garrison in Spring (orders that don't move resolve before anyone marches), with the emergency levy past the wage
// ceiling, and leaves in the second phase. Away from his capital or rich land, he leaves in Spring as before. With the
// enemy host already in his capital he leaves in Spring too, with no levy first: that is the danger the evacuation is
// for, and a phase spent raising companies is a phase in a province the enemy holds (Theo's review, the option he
// recommended).
// Level 1 (unit): runBotPhaseOne called directly on the engine's modules, on the middle of a bot world
// (tests/lib/the-middle-of-a-bot-world-on-the-engines-modules.ts). A lower level can't hold the realm, its treasury
// and the enemy host.
import { describe, expect, test } from 'vitest';
import { aBotBoard } from '../lib/the-middle-of-a-bot-world-on-the-engines-modules.ts';
import { runBotPhaseOne } from '../../src/engine/bots/phase-one.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
interface Order {
  action: string;
  target: string;
}

/** Realm 0 (Human, 60g) holds the middle province and two beside it (one to fall back to); the king stands unarmed in
 *  the middle province, its capital or not; an enemy host of eight companies (realm 1, at war) stands next door, or
 *  already in the middle province with him (`inside`). */
function stage(o: { capital: boolean; inside?: boolean }): Order[] {
  const b = aBotBoard(SEED);
  const G = b.G;
  G.turn = 10;
  const me = b.must(G.players[0], 'realm 0');
  Object.assign(me, { alignment: 'Pagan', race: 'Human', gold: 60 });
  const next = b.must(b.ring1[0], 'neighbour');
  const refuge = b.must(b.ring1[3], 'refuge');
  const home = b.must(o.capital ? b.X : b.ring2[0], 'home');
  me['homeProvinceId'] = home.id;
  b.own(home, 0);
  b.own(b.X, 0);
  b.own(next, 0);
  b.own(refuge, 0);
  Object.assign(b.X, { race: 'Human', tax: 5, armyTypes: ['Men-at-Arms', 'Human Garrison'] });
  const king = b.hero({ player: 0, at: b.X, king: true, skills: { melee: 2, tactical: 1 } });
  b.hero({ player: 1, at: o.inside ? b.X : next, troops: 8 });
  G.turnOrders[String(king.id)] = [null, null, null, null, null];
  runBotPhaseOne(b.state(), new Set([0]), 'muster');
  return (G.turnOrders[String(king.id)] ?? []).map((x) => {
    const r = (x ?? {}) as Partial<Order>;
    return { action: r.action ?? 'none', target: r.target ?? '' };
  });
}

describe('an unarmed bot king beside a stronger enemy host', () => {
  test('in his capital raises its garrison in Spring, then leaves', () => {
    const o = stage({ capital: true });
    expect(o[0]?.action).toBe('recruit');
    expect(o[0]?.target).toMatch(/,to:garrison$/);
    expect(o[1]?.action).toBe('move');
  });
  test('already in his capital with him leaves in Spring, with no levy first', () => {
    const o = stage({ capital: true, inside: true });
    expect(o[0]?.action).toBe('move');
    expect(o.filter((x) => x.action === 'recruit')).toEqual([]);
  });
  test('in a poor province that is not his capital leaves in Spring, as before', () => {
    const o = stage({ capital: false });
    expect(o[0]?.action).toBe('move');
    expect(o.filter((x) => x.action === 'recruit')).toEqual([]);
  });
});
