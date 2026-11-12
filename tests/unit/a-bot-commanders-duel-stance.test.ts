// A bot commander's duel stance (botDuelStance, src/engine/bots/missions.ts): whether he challenges, answers a
// challenge or refuses one before a battle. A challenger rides out only when he expects to win, so answering one
// unforecast is a gamble, and a king who loses it loses the crown. The rule:
//   • a king answers only when the forecast gives him 60% or more to win and 10% or less to fall against every enemy
//     general he can see within two hexes; seeing none, he refuses below a duelling skill of 4;
//   • a hero answers only at 50% or more against those generals; seeing none, he answers from a duelling skill of 2;
//   • a king challenges only when, besides a hero's terms (skill 4+, 80% health, 65%+ against each), he risks 10% or
//     less of falling.
// The forecast is handed in, so each case says exactly what it forecasts: no dice decide the outcome.
// Level 1 (unit): botDuelStance called directly in the bare vm (tests/lib/engine.ts) on the middle of a bot world
// (tests/lib/middle-of-a-bot-world.ts). A lower level can't hold a world for the enemy general to stand in.
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { board, hero, type Board, type Character } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
interface Forecast {
  win: number;
  felled: number;
}
const stanceOf = engineFn(engine, 'botDuelStance') as (
  G: unknown,
  pi: number,
  c: Character,
  duelSim: (a: Character, b: Character, n: number) => Forecast,
) => string;

/** Realm 0's commander in the middle province, and an enemy general (realm 1, at war) with `enemy` companies, or
 *  none, in the province next door: both realm 0's, so the general is in sight with no kit on. Every forecast asked returns `f`; the enemies it was asked about are kept. */
function stage(who: { king: boolean; skills: Record<string, number>; hp?: number }, enemy: number | null, f: Forecast) {
  const b: Board = board(engine, world, 0);
  b.own(b.X, 0);
  const c = hero(b, { player: 0, at: b.X, king: who.king, skills: who.skills, troops: 3, hp: 20 });
  if (who.hp != null) c.hp = who.hp;
  const next = b.ring1[0];
  if (!next) throw new Error('no neighbour');
  b.own(next, 0);
  const foe = enemy == null ? null : hero(b, { player: 1, at: next, troops: enemy, skills: { melee: 4 } });
  const asked: number[] = [];
  const stance = stanceOf(b.G, 0, c, (_a, e) => {
    asked.push(e.id);
    return f;
  });
  return { stance, asked, foe };
}
const STRONG = { win: 0.8, felled: 0.05 };
const EVEN = { win: 0.55, felled: 0.15 };
const WEAK = { win: 0.3, felled: 0.4 };

describe('a bot king', () => {
  test('with Melee 3 refuses an enemy general next door he is forecast to lose to', () => {
    const r = stage({ king: true, skills: { melee: 3 } }, 4, WEAK);
    expect(r.stance).toBe('refuse');
    expect(r.asked).toEqual([r.foe?.id]);
  });
  test('refuses an even fight: a king risks no more than one fall in ten', () => {
    expect(stage({ king: true, skills: { melee: 3 } }, 4, EVEN).stance).toBe('refuse');
  });
  test('answers a challenge he is forecast to win', () => {
    expect(stage({ king: true, skills: { melee: 3 } }, 4, STRONG).stance).toBe('accept');
  });
  test('with Melee 3 and no enemy general in sight refuses', () => {
    expect(stage({ king: true, skills: { melee: 3 } }, null, STRONG).stance).toBe('refuse');
  });
  test('with Melee 5 and no enemy general in sight answers, but does not ride out', () => {
    expect(stage({ king: true, skills: { melee: 5 } }, null, STRONG).stance).toBe('accept');
  });
  test('with Melee 5 challenges an enemy general he is forecast to beat safely', () => {
    expect(stage({ king: true, skills: { melee: 5 } }, 4, STRONG).stance).toBe('challenge');
  });
  test('with Melee 5 does not challenge where he would risk a fall in five', () => {
    expect(stage({ king: true, skills: { melee: 5 } }, 4, { win: 0.7, felled: 0.2 }).stance).toBe('refuse');
  });
});

describe('a bot hero', () => {
  test('with Melee 3 refuses an enemy general next door he is forecast to lose to', () => {
    expect(stage({ king: false, skills: { melee: 3 } }, 4, WEAK).stance).toBe('refuse');
  });
  test('answers an even fight', () => {
    expect(stage({ king: false, skills: { melee: 3 } }, 4, EVEN).stance).toBe('accept');
  });
  test('with Melee 3 and no enemy general in sight answers, as before', () => {
    expect(stage({ king: false, skills: { melee: 3 } }, null, WEAK).stance).toBe('accept');
  });
  test('with Melee 1 refuses whatever the forecast, as before', () => {
    expect(stage({ king: false, skills: { melee: 1 } }, 4, STRONG).stance).toBe('refuse');
  });
  test('with Melee 5 challenges a general he is forecast to beat, even at some risk, as before', () => {
    expect(stage({ king: false, skills: { melee: 5 } }, 4, { win: 0.7, felled: 0.2 }).stance).toBe('challenge');
  });
});
