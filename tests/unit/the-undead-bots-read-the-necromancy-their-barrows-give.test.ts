// Under the Undead kit every barrow the realm holds lifts each of its heroes' Necromancy by one, even a hero who never
// trained it, and its own skill lifts a hero who has it by one more (protoSkillLift, src/engine/alignment-prototypes.ts).
// The engine casts at that lifted level; the bots read the raw skill, so a hero the barrows had made a necromancer never
// raised the dead, and the order clean-up struck out casts the rules allowed (bot improvements, step 6). Now the bots
// read the lifted level for a spell, for the barrow march and for the per-turn casting limit:
//   • a hero with no Necromancy of his own, on a held barrow with graves, raises them (Skeletal Armies);
//   • such a hero walks to a held barrow with graves to raise them;
//   • a king of Necromancy 2 holding two barrows (5 in all) keeps three casts of Skeletal Armies a turn;
//   • with no kit on, a hero with no Necromancy casts nothing, as before.
// Level 1 (unit): the bots' cast plan, barrow march and order clean-up called directly in the bare vm
// (tests/lib/engine.ts) on the middle of a bot world (tests/lib/middle-of-a-bot-world.ts). A lower level can't hold
// the realm, its barrows and the heroes standing on them.
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { board, hero, type Board, type Character, type Province } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
interface Order {
  action: string;
  target: string;
  extra: string;
  desc: string;
}
const castPlan = engineFn(engine, 'botCastPlan') as (
  G: unknown,
  pi: number,
  c: Character,
  P: Province,
  opts: Record<string, unknown>,
) => Order[];
const barrowPlan = engineFn(engine, 'botBarrowPlan') as (
  G: unknown,
  pi: number,
  c: Character,
  P: Province,
  L: unknown,
  maxHops: number,
) => { X: Province } | null;
const hygiene = engineFn(engine, 'runBotOrderHygiene') as (G: unknown, bots: Set<number>) => void;

const grave = (k: number) => ({
  type: 'Men-at-Arms',
  quality: 'Average',
  race: 'Human',
  unitName: `Grave ${String(k)}`,
});
const barrow = (name: string) => ({ ritualSite: true, siteKind: 'barrow', name, discoveredBy: [0] });

/** Realm 0 (Undead) holds the middle province (its capital) and two barrows beside it, each with three graves. With
 *  `kit`, the Undead kit and its bot tactics are on. */
function stage(kit: boolean): Board & { barrows: Province[] } {
  const b = board(engine, world, 0);
  const G = b.G as unknown as Record<string, unknown> & { players: Record<string, unknown>[] };
  G['turn'] = 10;
  G['alignmentPrototypes'] = kit ? ['Undead'] : [];
  G['alignmentPrototypeTactics'] = kit;
  const me = G.players[0];
  if (!me) throw new Error('no realm 0');
  Object.assign(me, { alignment: 'Undead', race: 'Human', gold: 40, homeProvinceId: b.X.id });
  b.own(b.X, 0);
  const barrows = [b.ring1[0], b.ring1[3]].filter((p): p is Province => !!p);
  barrows.forEach((p, i) => {
    b.own(p, 0);
    Object.assign(p, { race: 'Human', features: [barrow(`Barrow ${String(i)}`)], battleGraves: [1, 2, 3].map(grave) });
  });
  return Object.assign(b, { barrows });
}
const raises = (o: Order[]) => o.filter((x) => x.action === 'cast_spell' && x.target === 'Skeletal Armies').length;

describe('an Undead realm holding two barrows', () => {
  test('a hero with no Necromancy of his own, on a barrow with graves, raises them', () => {
    const b = stage(true);
    const at = b.barrows[0];
    if (!at) throw new Error('no barrow');
    const h = hero(b, { player: 0, at, skills: { melee: 2, necromancy: 0 } });
    expect(raises(castPlan(b.G, 0, h, at, { max: 3 }))).toBeGreaterThan(0);
  });
  test('such a hero in the capital walks to a barrow with graves to raise them', () => {
    const b = stage(true);
    const h = hero(b, { player: 0, at: b.X, skills: { melee: 2, necromancy: 0 } });
    const plan = barrowPlan(b.G, 0, h, b.X, {}, 3);
    expect(b.barrows.map((p) => p.id)).toContain(plan?.X.id);
  });
  test('a king of Necromancy 2 keeps three casts of Skeletal Armies a turn', () => {
    const b = stage(true);
    const at = b.barrows[0];
    if (!at) throw new Error('no barrow');
    const k = hero(b, { player: 0, at, king: true, skills: { necromancy: 2, melee: 1 } });
    const cast: Order = { action: 'cast_spell', target: 'Skeletal Armies', extra: '', desc: 'Raise the dead' };
    const G = b.G as unknown as { turnOrders: Record<string, Order[]> };
    G.turnOrders[String(k.id)] = [cast, cast, cast, { ...cast, action: 'rest' }, { ...cast, action: 'rest' }].map(
      (x) => ({ ...x }),
    );
    hygiene(b.G, new Set([0]));
    expect(raises(G.turnOrders[String(k.id)] ?? [])).toBe(3);
  });
});

describe('with no kit on, as before', () => {
  test('a hero with no Necromancy, on graves, raises nothing', () => {
    const b = stage(false);
    const at = b.barrows[0];
    if (!at) throw new Error('no barrow');
    const h = hero(b, { player: 0, at, skills: { melee: 2, necromancy: 0 } });
    expect(raises(castPlan(b.G, 0, h, at, { max: 3 }))).toBe(0);
  });
});
