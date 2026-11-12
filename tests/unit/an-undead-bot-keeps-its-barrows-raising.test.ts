// An Undead realm's barrow refills its graves every turn, and the dead in them rise only to Skeletal Armies cast where
// they lie. A player keeps a necromancer on each barrow, raising every turn; the bots sent one only when an unarmed
// hero had nothing else to do, and in the watched games an Undead realm holding barrows from turn 6 raised the dead
// five times in sixteen turns. Now the movement pass (runBotMovement, src/engine/bots/movement.ts) first gives every
// held barrow with graves a keeper (bot improvements, step 6): the nearest hero who counts Necromancy 1 or more (a
// barrow held lifts every hero of the realm) and is not the realm's main general, within three marches. He walks
// there, raises as often as his Necromancy allows, and leaves the risen in the barrow's garrison, where they stand
// without a master, until it holds four. A hero who already leads three companies of the dead takes them to the host
// instead.
// Level 1 (unit): runBotMovement called directly in the bare vm (tests/lib/engine.ts) on the middle of a bot world
// (tests/lib/middle-of-a-bot-world.ts). A lower level can't hold the realm, its barrow and its heroes.
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { board, hero, type Character, type Province } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
const movement = engineFn(engine, 'runBotMovement') as (G: unknown, bots: Set<number>, hooks: unknown) => void;
interface Order {
  action: string;
  target: string;
  extra: string;
  desc: string;
}
const grave = (k: number) => ({
  type: 'Men-at-Arms',
  quality: 'Average',
  race: 'Human',
  unitName: `Grave ${String(k)}`,
});
const skeleton = (k: number) => ({ ...grave(k), _isSkeletal: true, unitName: `Bones ${String(k)}` });

/** Realm 0 (Undead, its kit and bot tactics on) holds the middle province (its capital, where the king leads five
 *  companies) and a barrow beside it with three graves. A hero with no Necromancy of his own stands in the capital,
 *  leading `bones` companies of the dead. Returns the hero's orders and the barrow. */
function stage(bones: number): { orders: Order[]; barrow: Province; keeper: Character } {
  const b = board(engine, world, 0);
  const G = b.G as unknown as Record<string, unknown> & {
    players: Record<string, unknown>[];
    turnOrders: Record<string, (Order | null)[]>;
  };
  G['turn'] = 10;
  G['alignmentPrototypes'] = ['Undead'];
  G['alignmentPrototypeTactics'] = true;
  G.players.forEach((p, i) => Object.assign(p, { race: 'Human', alignment: i === 0 ? 'Undead' : 'Good', gold: 30 }));
  const me = G.players[0];
  if (!me) throw new Error('no realm 0');
  me['homeProvinceId'] = b.X.id;
  const barrow = b.ring1[0];
  if (!barrow) throw new Error('no neighbour');
  b.own(b.X, 0);
  b.own(barrow, 0);
  Object.assign(barrow, {
    race: 'Human',
    features: [{ ritualSite: true, siteKind: 'barrow', name: 'Barrow of the Nameless', discoveredBy: [0] }],
    battleGraves: [1, 2, 3].map(grave),
  });
  const king = hero(b, { player: 0, at: b.X, king: true, troops: 5, skills: { melee: 3, tactical: 3, necromancy: 2 } });
  const keeper = hero(b, { player: 0, at: b.X, skills: { melee: 2, necromancy: 0 } });
  keeper.armies = Array.from({ length: bones }, (_, k) => skeleton(k));
  [king, keeper].forEach((c) => {
    G.turnOrders[String(c.id)] = [null, null, null, null, null];
  });
  movement(b.G, new Set([0]), {});
  const orders = (G.turnOrders[String(keeper.id)] ?? []).map(
    (x) => x ?? { action: 'none', target: '', extra: '', desc: '' },
  );
  return { orders, barrow, keeper };
}
const raises = (o: Order[]) => o.filter((x) => x.action === 'cast_spell' && x.target === 'Skeletal Armies').length;

describe("an Undead realm's barrow with graves", () => {
  test('gets a keeper: he walks there, raises the dead, and leaves them in its garrison', () => {
    const { orders } = stage(0);
    const cast = orders.findIndex((x) => x.action === 'cast_spell' && x.target === 'Skeletal Armies');
    expect(orders[0]?.action).toBe('move');
    expect(raises(orders)).toBeGreaterThan(0);
    expect(orders.findIndex((x) => x.action === 'leave_army' && x.extra === '-1')).toBeGreaterThan(cast);
  });
  test('is not kept by a hero who already leads three companies of the dead', () => {
    expect(raises(stage(3).orders)).toBe(0);
  });
});
