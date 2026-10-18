// The item and army orders' own functions (plan P1-08j5: src/engine/orders/, the fifth family taken out of
// processOrder), called directly in the bare vm on the middle of a bot world (lib/middle-of-a-bot-world.ts). First the
// cases scenario/item-and-army-orders-in-a-whole-turn.test.ts plays through a whole turn
// (lib/item-and-army-order-cases.ts), here one phase at a time, the orders read from the turn's list as processOrder
// reads them; then what the cases leave to a direct call (the grades in a garrison, a band's place and name, the points
// of movement told, the courier's list) and what the balance matrix never reaches: Use Item (no bot works the
// Philosopher's Stone), Release Hero and Disband Army (no bot gives them), Pick Up Army's "all" and its old forms,
// Leave/Transfer Army's refusals and its hand-overs at sea; and properties of each order.
// Level 1: one function, called with what processOrder hands it.
import vm from 'node:vm';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import {
  ITEM_AND_ARMY_ORDER_CASES,
  STONE,
  companies,
  item,
  oldStone,
  skeletal,
  stageCase,
  type Item,
  type ItemAndArmyOrderCase,
} from '../lib/item-and-army-order-cases.ts';
import {
  board,
  hero,
  must,
  points,
  type Board,
  type Character,
  type HeroSpec,
  type Line,
  type Order,
  type Unit,
} from '../lib/middle-of-a-bot-world.ts';
import { plainRealms } from '../lib/recruit-hire-and-realm-works-order-cases.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
type Fn = (...a: unknown[]) => unknown;
const fn = (name: string) => engineFn(engine, name) as Fn;
const provOf = fn('provOf');

/** One order, as processOrder hands it over in phase `ph`: each function takes the context, then the values it reads
 *  of processOrder's (the hero, the phase, the target, the extra, his province, his realm), in that order. */
const play = (b: Board, c: Character, o: Order, ph = 0) => {
  b.tc._currentPhase = ph;
  b.tc._logCtx = { charId: c.id, phase: ph };
  const prov = provOf(b.tc, c);
  const player = c.player == null ? undefined : b.G.players[c.player];
  const { action, target, extra } = o;
  const call: Record<string, () => unknown> = {
    equip_items: () => fn('resolveEquipItemsOrder')(b.tc, c, target),
    use_item: () => fn('resolveUseItemOrder')(b.tc, c, target, prov),
    give_item: () => fn('resolveSendItemOrder')(b.tc, c, ph, target, extra),
    leave_army: () => fn('resolveLeaveOrTransferArmyOrder')(b.tc, c, ph, target, extra, prov),
    release: () => fn('resolveReleaseHeroOrder')(b.tc, c, ph, prov, player),
    disband_army: () => fn('resolveDisbandArmyOrder')(b.tc, c, target, prov),
    pickup_army: () => fn('resolvePickUpArmyOrder')(b.tc, c, target, prov),
    rest: () => fn('resolveRestOrder')(b.tc, c, prov),
  };
  must(call[action], 'the order ' + action)();
  b.tc._logCtx = { charId: null, phase: null };
};
const linesOf = (b: Board, c: Character) => b.lines().filter((l: Line) => l.charId === c.id);
const textOf = (b: Board, c: Character) =>
  linesOf(b, c)
    .map((l) => l.text)
    .join('\n');
const fresh = () => {
  const b = board(engine, world, 0);
  plainRealms(b);
  b.G.players.forEach((pl) => {
    pl['heroes'] = [];
  });
  b.own(b.X, 0);
  return b;
};
const realm = (b: Board, i = 0) => must(b.G.players[i], 'realm ' + String(i));
const at = (b: Board, s: Partial<HeroSpec> = {}) => {
  const h = hero(b, { player: 0, at: b.X, ...s });
  if (h.player != null) realm(b, h.player)['heroes'] = [...(realm(b, h.player)['heroes'] as number[]), h.id];
  return h;
};
const o = (action: string, target = '', extra = ''): Order => ({ action, target, extra, desc: '' });
const place = (b: Board, c: Character) => String(b.G.characters.indexOf(c));
const ring1 = (b: Board, i: number) => must(b.ring1[i], 'a neighbour of the middle');
const druid = (n: number) => ({ melee: 2, tactical: 2, march: 1, spy: 0, druid: n });
const names = (us: { unitName?: unknown }[] | undefined) => (us ?? []).map((u) => String(u.unitName));
const grades = (us: Unit[] | undefined) => (us ?? []).map((u) => `${u.quality} ${u.unitName}`);
const pack = (c: Character) => c.items.map((i) => String(i['name']));
const G_ = (b: Board) => b.G as unknown as Record<string, unknown>;
/** The points of movement `c`'s force has a turn, as the move pools work them out. */
const pace = (b: Board, c: Character) => {
  const m = fn('computeMovePoolMax')(b.tc, c) as { land: number; sea: number };
  return { land: m.land, sea: m.sea };
};

describe.each(ITEM_AND_ARMY_ORDER_CASES)('the %s order, called directly: the whole-turn cases', (_, cases) => {
  test.each(cases.filter((c) => !c.wholeTurnOnly).map((c) => [c.name, c] as const))(
    '%s',
    (_name, c: ItemAndArmyOrderCase) => {
      const b = board(engine, world, 0);
      const s = stageCase(b, c);
      // the orders as the turn holds them once read: Release Hero drops the ones after it there
      b.G.turnOrders = Object.fromEntries(s.orders.map(([h, os]) => [h.id, os]));
      for (let ph = 0; ph < 5; ph++)
        for (const [h] of s.orders) {
          const next = b.G.turnOrders[h.id]?.[ph];
          if (h.alive && next) play(b, h, next as Order, ph);
        }
      const { got, want } = c.check({ world: b.G, lines: linesOf(b, s.hero), all: b.lines(), turn: b.G.turn }, s);
      expect(got).toEqual(want);
    },
  );
});

// ── Use Item ────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Use Item, called directly: the Philosopher’s Stone (an older save’s copy)', () => {
  type Roll = { id: unknown; skill: string; base: unknown };
  // every experience roll, recorded as it starts by a wrapper around the top-level trySkillGain (plan P1-08c)
  vm.runInContext(
    `{ const tryOne=trySkillGain;
       trySkillGain=function(turnContext, char, skill, base){
         if(globalThis.__xp) globalThis.__xp.push({id:char&&char.id,skill,base});
         return tryOne.apply(this, arguments); }; }`,
    engine,
  );
  const rollsIn = (body: () => void): Roll[] => {
    const rs: Roll[] = [];
    engine['__xp'] = rs;
    try {
      body();
    } finally {
      engine['__xp'] = undefined;
    }
    return rs;
  };
  const common = vm.runInContext('SKILLGAIN_COMMON', engine) as number;
  const bearer = (b: Board, troops: Unit[]) => {
    const h = at(b, { king: true });
    h.items = [oldStone(b)];
    h.armies = troops;
    return h;
  };

  test('working it is a lesson in Sage: one experience roll, at the common chance', () => {
    const b = fresh();
    const h = bearer(b, companies(1, 'Men-at-Arms', 'Green'));
    const rs = rollsIn(() => {
      play(b, h, o('use_item', STONE));
    });
    expect(rs).toEqual([{ id: h.id, skill: 'sage', base: common }]);
  });

  test('a passive item, a spent one or one he lacks is no lesson', () => {
    const b = fresh();
    const h = bearer(b, companies(1, 'Men-at-Arms', 'Green'));
    h.items.push(item(b, 'Ring of the Explorer'));
    const rs = rollsIn(() => {
      play(b, h, o('use_item', 'Ring of the Explorer'));
      play(b, h, o('use_item', 'Blade of Nothing'));
      must(h.items[0], 'the Stone')['_spent'] = true;
      play(b, h, o('use_item', STONE));
    });
    expect(rs).toEqual([]);
  });

  test('it raises the garrisons of the realm’s own provinces a grade, and no other’s', () => {
    const b = fresh();
    const h = bearer(b, []);
    const keep = ring1(b, 1);
    b.own(keep, 0);
    keep.garrisonArmies = [
      ...companies(1, 'Shieldwall Levies', 'Green', 'Keep'),
      ...companies(1, 'Human Garrison', 'Crack', 'Wall'),
    ];
    const foreign = ring1(b, 2);
    b.own(foreign, 1);
    foreign.garrisonArmies = companies(1, 'Shieldwall Levies', 'Green', 'Foreign');
    const wild = ring1(b, 3);
    wild.garrisonArmies = companies(1, 'Shieldwall Levies', 'Green', 'Wild');
    play(b, h, o('use_item', STONE));
    expect({
      keep: grades(keep.garrisonArmies),
      foreign: grades(foreign.garrisonArmies),
      wild: grades(wild.garrisonArmies),
    }).toEqual({ keep: ['Average Keep c0', 'Elite Wall c0'], foreign: ['Green Foreign c0'], wild: ['Green Wild c0'] });
  });

  test('it leaves the dead and the companies of a fallen hero as they were, and counts neither', () => {
    const b = fresh();
    const h = bearer(b, [{ ...skeletal(), quality: 'Green' }, ...companies(1, 'Men-at-Arms', 'Green')]);
    const fallen = at(b, { at: ring1(b, 1) });
    fallen.alive = false;
    fallen.armies = companies(1, 'Yeoman Longbows', 'Green', 'Fallen');
    play(b, h, o('use_item', STONE));
    expect({
      led: grades(h.armies),
      fallen: grades(fallen.armies),
      told: textOf(b, h).includes('and 1 army unit advance one quality tier (1 marching under your commanders).'),
    }).toEqual({ led: ['Green Bone Levy', 'Average Men-at-Arms c0'], fallen: ['Green Fallen c0'], told: true });
  });

  test('over a realm of only the dead it finds nothing to work on, and is not spent', () => {
    const b = fresh();
    const h = bearer(b, [skeletal()]);
    play(b, h, o('use_item', STONE));
    expect({
      told: textOf(b, h).includes('your realm has no armies in the field or in garrison. The Stone is NOT spent'),
      pack: pack(h),
    }).toEqual({ told: true, pack: [STONE] });
  });

  test('the other realms are told the realm’s name, its own realm its own hero’s', () => {
    const b = fresh();
    const h = bearer(b, companies(1, 'Men-at-Arms', 'Green'));
    play(b, h, o('use_item', STONE));
    const told = (i: number) =>
      b
        .lines()
        .filter((l) => l.targets?.length === 1 && l.targets[0] === i && l.text.startsWith('🌍'))
        .map((l) => l.text);
    const name = realm(b).name;
    expect({
      own: told(0).map((t) => t.includes(`your own ${h.name} has worked the ${STONE}`)),
      others: [told(1), told(2)].map((ts) => ts.map((t) => t.includes(`${name} has worked the ${STONE}`))),
      public: b
        .lines()
        .filter((l) => l.text.startsWith('🌍'))
        .every((l) => l['public'] === true),
    }).toEqual({ own: [true], others: [[true], [true]], public: true });
  });

  test('every copy in the world’s hoards is struck off (two told so, to no realm), and the ledgers kept', () => {
    const b = fresh();
    const h = bearer(b, companies(1, 'Men-at-Arms', 'Green'));
    b.G.world.provinces.forEach((p) => {
      ((p['features'] ?? []) as { hoardItems?: Item[] }[]).forEach((f) => {
        if (f.hoardItems) f.hoardItems = f.hoardItems.filter((i) => i.name !== STONE);
      });
    });
    ring1(b, 1)['features'] = [
      { type: 'lair', name: 'Barrow A', hoardItems: [item(b, STONE), item(b, 'Ring of Wealth')] },
    ];
    ring1(b, 2)['features'] = [{ type: 'lair', name: 'Barrow B', hoardItems: [item(b, STONE)] }];
    G_(b)['_awardedItems'] = [STONE];
    G_(b)['_destroyedItems'] = [{ name: 'Old Relic', turn: 0, by: 'Someone', player: 1 }];
    play(b, h, o('use_item', STONE));
    const hoards = [ring1(b, 1), ring1(b, 2)].map((p) =>
      ((p['features'] as { hoardItems: Item[] }[])[0]?.hoardItems ?? []).map((i) => i.name),
    );
    const note = b.lines().find((l) => l.text.startsWith('(GM note:'));
    expect({
      hoards,
      note: note?.text.startsWith(`(GM note: 2 undiscovered ${STONE}s were struck from the world's lair hoards`),
      actor: note?.actor,
      targets: note?.targets,
      awarded: G_(b)['_awardedItems'],
      destroyed: G_(b)['_destroyedItems'],
    }).toEqual({
      hoards: [['Ring of Wealth'], []],
      note: true,
      actor: null,
      targets: [],
      awarded: [STONE],
      destroyed: [
        { name: 'Old Relic', turn: 0, by: 'Someone', player: 1 },
        { name: STONE, turn: b.G.turn, by: h.name, player: 0 },
      ],
    });
  });
});

// ── Send Item ───────────────────────────────────────────────────────────────────────────────────────────────────
describe('Send Item, called directly', () => {
  test('by courier the items leave now and wait on the courier’s list for the turn’s end', () => {
    const b = fresh();
    const h = at(b, { king: true });
    h.items = [item(b, 'Ring of the Explorer'), item(b, 'Tome of Tactics')];
    const r = at(b, { at: ring1(b, 2) });
    play(b, h, o('give_item', 'all', String(r.id)));
    const list = G_(b)['_itemDeliveries'] as { toId: number; items: Item[]; fromName: string }[];
    expect({
      kept: pack(h),
      got: pack(r),
      list: list.map((d) => ({ toId: d.toId, items: d.items.map((i) => i.name), fromName: d.fromName })),
    }).toEqual({
      kept: [],
      got: [],
      list: [{ toId: r.id, items: ['Tome of Tactics', 'Ring of the Explorer'], fromName: h.name }],
    });
  });

  test('a name that begins with a number is a name, not a place in the pack', () => {
    const b = fresh();
    const h = at(b, { king: true });
    h.items = [
      item(b, 'Ring of the Explorer'),
      item(b, 'Tome of Tactics'),
      item(b, 'Bronze Buckler'),
      item(b, 'Kingsteel Longsword'),
      { ...item(b, 'Ring of Wealth'), name: '3 Rings of Dawn' },
    ];
    const r = at(b);
    play(b, h, o('give_item', '3 Rings of Dawn', String(r.id)));
    expect(pack(r)).toEqual(['3 Rings of Dawn']);
  });

  test('a hero on a hire card who has fallen is told so', () => {
    const b = fresh();
    const h = at(b, { king: true });
    h.items = [item(b, 'Ring of the Explorer')];
    const r = at(b);
    r.alive = false;
    play(b, h, o('give_item', '0', `hired_${String(r.id)}_via_${String(h.id)}_ph0`));
    expect({
      told: textOf(b, h).includes(`keeps the items — ${r.name} is not in your service (they have fallen): the hire`),
      kept: pack(h),
    }).toEqual({ told: true, kept: ['Ring of the Explorer'] });
  });

  test('an item of maximum HP takes its HP with it', () => {
    const b = fresh();
    const h = at(b, { king: true });
    h.items = [{ ...item(b, 'Amulet of Fortitude'), equipped: true }];
    const r = at(b);
    const sync = fn('syncMaxHp');
    sync(h);
    sync(r);
    const before = { giver: h.maxHp, taker: r.maxHp };
    play(b, h, o('give_item', '0', String(r.id)));
    expect({ giver: before.giver - h.maxHp, taker: r.maxHp - before.taker }).toEqual({ giver: 8, taker: 8 });
  });

  test('property: the items change hands, none is lost or made, and Mithril Armour never leaves its wearer', () => {
    const NAMES = [
      'Ring of the Explorer',
      'Tome of Tactics',
      'Bronze Buckler',
      'Kingsteel Longsword',
      'Mithril Armour',
    ];
    const token = fc.oneof(
      fc.constant('all'),
      fc.nat(6).map(String),
      fc.constantFrom(...NAMES),
      fc.constant('Nothing'),
    );
    const seen = { here: 0, courier: 0, none: 0 };
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...NAMES), { maxLength: 5 }),
        fc.array(token, { maxLength: 4 }),
        fc.boolean(),
        (held, tokens, far) => {
          const b = fresh();
          realm(b)['race'] = 'Dwarven';
          const h = at(b, { king: true });
          h['race'] = 'Dwarven';
          h.items = held.map((n) => item(b, n));
          const r = at(b, far ? { at: ring1(b, 2) } : {});
          const ids = (is: Record<string, unknown>[]) => is.map((i) => Number(i['id'])).sort();
          const before = ids(h.items);
          const mithril = ids(h.items.filter((i) => i['name'] === 'Mithril Armour'));
          play(b, h, o('give_item', tokens.join(','), String(r.id)));
          const queued = ((G_(b)['_itemDeliveries'] ?? []) as { items: Item[] }[]).flatMap((d) => d.items);
          expect(ids([...h.items, ...r.items, ...queued])).toEqual(before);
          expect(ids(h.items.filter((i) => i['name'] === 'Mithril Armour'))).toEqual(mithril);
          seen[h.items.length === held.length ? 'none' : far ? 'courier' : 'here']++;
        },
      ),
    );
    expect(Object.values(seen).every((n) => n > 0)).toBe(true);
  });
});

// ── Leave/Transfer Army ─────────────────────────────────────────────────────────────────────────────────────────
describe('Leave/Transfer Army, called directly', () => {
  test('with every company left in the garrison, the line tells the points he now has', () => {
    const b = fresh();
    const h = at(b, { king: true, land: 1, troops: 2 });
    play(b, h, o('leave_army', 'all', '-1'));
    const p = points(b, h);
    expect(textOf(b, h)).toContain(`now travelling light (land ${String(p.land)}, sea ${String(p.sea)} move points).`);
    // a hero travelling light, who had marched no further this turn, has a light traveller's pace
    expect(p).toEqual(pace(b, h));
  });

  test('a hand-over works out both heroes’ points afresh', () => {
    const b = fresh();
    const h = at(b, { king: true, troops: 2 });
    const r = at(b);
    const max = b.tc as unknown as Record<string, Record<number, number>>;
    play(b, h, o('leave_army', 'all', place(b, r)));
    expect({ giver: max['moveMax']?.[h.id] != null, taker: max['moveMax']?.[r.id] != null }).toEqual({
      giver: true,
      taker: true,
    });
  });

  test('a hire card naming nobody, or another realm’s hero, is told the recipient must be his own', () => {
    const b = fresh();
    const h = at(b, { king: true, troops: 1 });
    const rival = hero(b, { player: 1, at: b.X });
    play(b, h, o('leave_army', 'all', `hired_987654_via_${String(h.id)}_ph0`));
    play(b, h, o('leave_army', 'all', `hired_${String(rival.id)}_via_${String(h.id)}_ph0`));
    expect({
      told: linesOf(b, h).filter((l) => l.text.includes('the recipient must be one of your own characters standing in'))
        .length,
      led: names(h.armies),
      rival: names(rival.armies),
    }).toEqual({ told: 2, led: ['Men-at-Arms #' + String(h.id) + '.0'], rival: [] });
  });

  test('“all” within a list takes every company', () => {
    const b = fresh();
    const h = at(b, { king: true });
    h.armies = [...companies(1, 'Yeoman Longbows'), ...companies(2)];
    const r = at(b);
    play(b, h, o('leave_army', 'Yeoman Longbows,all', place(b, r)));
    expect({ led: names(h.armies), took: names(r.armies) }).toEqual({
      led: [],
      took: ['Yeoman Longbows c0', 'Men-at-Arms c0', 'Men-at-Arms c1'],
    });
  });

  test('the beasts a comrade already leads count against his Druid', () => {
    const b = fresh();
    const h = at(b, { king: true, skills: druid(3) });
    h.armies = companies(2, 'Great Bears');
    const r = at(b, { skills: druid(2) });
    r.armies = companies(1, 'Great Bears', 'Average', 'His Bears');
    play(b, h, o('leave_army', 'all', place(b, r)));
    expect({ led: names(h.armies), took: names(r.armies) }).toEqual({
      led: ['Great Bears c1'],
      took: ['His Bears c0', 'Great Bears c0'],
    });
  });

  test('a garrison takes beasts and the dead with no Druid or Necromancy asked', () => {
    const b = fresh();
    const h = at(b, { king: true, skills: druid(3) });
    h.armies = [...companies(2, 'Great Bears'), skeletal()];
    play(b, h, o('leave_army', 'all', '-1'));
    expect(names(b.X.garrisonArmies)).toEqual(['Great Bears c0', 'Great Bears c1', 'Bone Levy']);
  });

  test('at sea, a hand-over refused gives every company back, in its order', () => {
    const b = fresh();
    const sea = ring1(b, 0);
    sea.terrain = 'sea';
    const h = at(b, { king: true, at: sea });
    h.armies = [...companies(1), ...companies(1, 'Galleon Fleet'), ...companies(1, 'Free Lances')];
    const r = at(b, { at: sea });
    play(b, h, o('leave_army', 'Galleon Fleet', place(b, r)));
    expect({ led: names(h.armies), took: names(r.armies) }).toEqual({
      led: ['Men-at-Arms c0', 'Galleon Fleet c0', 'Free Lances c0'],
      took: [],
    });
  });

  test('at sea, not left in the garrison if the ships that stay could not carry the rest', () => {
    const b = fresh();
    const sea = ring1(b, 0);
    sea.terrain = 'sea';
    b.own(sea, 0);
    const h = at(b, { king: true, at: sea });
    h.armies = [...companies(1, 'Galleon Fleet'), ...companies(1)];
    play(b, h, o('leave_army', 'Galleon Fleet', '-1'));
    expect({
      told: textOf(b, h).includes(
        `⚓ ${h.name} cannot leave Galleon Fleet c0 in ${sea.name} out on open water — the ships that stay would be too few to carry the rest of ${h.name}'s column.`,
      ),
      led: names(h.armies),
      garrison: names(sea.garrisonArmies),
    }).toEqual({ told: true, led: ['Galleon Fleet c0', 'Men-at-Arms c0'], garrison: [] });
  });

  test('property: every company stays with the giver, goes to the comrade or the garrison, or is one of the dead lost', () => {
    const kind = fc.constantFrom('Men-at-Arms', 'Yeoman Longbows', 'Great Bears', 'dead');
    const seen = { comrade: 0, garrison: 0, lost: 0 };
    fc.assert(
      fc.property(
        fc.array(kind, { minLength: 1, maxLength: 5 }),
        fc.array(fc.constantFrom('all', 'Men-at-Arms', 'Yeoman Longbows', 'Great Bears', 'Shieldwall Levies'), {
          minLength: 1,
          maxLength: 3,
        }),
        fc.nat(3),
        fc.boolean(),
        (kinds, targets, room, toGarrison) => {
          const b = fresh();
          const h = at(b, { king: true, skills: druid(5) });
          h.armies = kinds.map((k, i) =>
            k === 'dead'
              ? skeletal(`Bone ${String(i)}`)
              : must(companies(1, k, 'Average', `${k} ${String(i)}`)[0], 'a company'),
          );
          const r = at(b, { skills: druid(room) });
          const all = names(h.armies).sort();
          play(b, h, o('leave_army', targets.join(','), toGarrison ? '-1' : place(b, r)));
          // the dead handed to a living commander are named in the line that says they are lost
          const lost = (/💀 (.*) refuse to follow a non-Undead commander/.exec(textOf(b, h))?.[1] ?? '')
            .split(', ')
            .filter(Boolean).length;
          const gone = [...names(h.armies), ...names(r.armies), ...names(b.X.garrisonArmies)];
          expect(gone.length + lost).toBe(all.length);
          expect([...new Set(gone)].length).toBe(gone.length);
          expect(r.armies.filter((a) => a.type === 'Great Bears').length).toBeLessThanOrEqual(room);
          if (lost) seen.lost++;
          else if (r.armies.length) seen.comrade++;
          else if (b.X.garrisonArmies.length) seen.garrison++;
        },
      ),
    );
    expect(Object.values(seen).every((n) => n > 0)).toBe(true);
  });
});

// ── Release Hero ────────────────────────────────────────────────────────────────────────────────────────────────
describe('Release Hero, called directly', () => {
  test('a hero of no realm: nothing happens and nothing is said', () => {
    const b = fresh();
    const w = hero(b, { player: null, at: b.X });
    play(b, w, o('release'));
    expect({ lines: linesOf(b, w).length, released: w['_releasedTurn'] }).toEqual({ lines: 0, released: undefined });
  });

  test('only his orders after this one are dropped, and his heir’s mark, hire phase and chase go', () => {
    const b = fresh();
    at(b, { king: true });
    const h = at(b);
    Object.assign(h, { _isHeir: true, hiredInPhase: 1, _pursuit: { active: true, targetId: 1 } });
    b.G.turnOrders = { [h.id]: [o('rest'), o('rest'), o('release'), o('explore'), o('rest')] };
    play(b, h, o('release'), 2);
    expect({
      orders: (b.G.turnOrders[h.id] ?? []).map((x) => x?.action ?? null),
      kept: ['_isHeir', 'hiredInPhase', '_pursuit'].filter((k) => k in h),
      heroes: realm(b)['heroes'],
    }).toEqual({
      orders: ['rest', 'rest', 'release', null, null],
      kept: [],
      heroes: [must(b.G.characters[0], 'the king').id],
    });
  });
});

// ── Disband Army ────────────────────────────────────────────────────────────────────────────────────────────────
describe('Disband Army, called directly', () => {
  test('each band stands where he disbanded, named by the turn’s count, of the company’s folk', () => {
    const b = fresh();
    const h = at(b, { king: true });
    h.armies = [
      { type: 'Men-at-Arms', quality: 'Veteran', race: 'Elven', unitName: 'Elf Guard' },
      { type: 'Galleon Fleet', quality: 'Green' } as Unit,
    ];
    play(b, h, o('disband_army', 'all'));
    expect(b.G.mercenaries).toEqual([
      {
        id: `merc_t${String(b.G.turn)}_1`,
        type: 'Men-at-Arms',
        quality: 'Veteran',
        race: 'Elven',
        unitName: 'Elf Guard',
        location: b.X.id,
        isSea: false,
      },
      {
        id: `merc_t${String(b.G.turn)}_2`,
        type: 'Galleon Fleet',
        quality: 'Green',
        race: 'Human',
        unitName: 'Galleon Fleet',
        location: b.X.id,
        isSea: true,
      },
    ]);
  });

  test('with every company disbanded, the line tells the points he now has', () => {
    const b = fresh();
    const h = at(b, { king: true, land: 1, troops: 1 });
    play(b, h, o('disband_army', 'all'));
    const p = points(b, h);
    expect(textOf(b, h)).toContain(`now travelling light (land ${String(p.land)}, sea ${String(p.sea)} move points).`);
    expect(p).toEqual(pace(b, h));
  });

  test('an “all” within a list means nothing to it (unlike Leave/Transfer Army): only the companies named go', () => {
    const b = fresh();
    const h = at(b, { king: true });
    h.armies = [...companies(1, 'Yeoman Longbows'), ...companies(2)];
    play(b, h, o('disband_army', 'Yeoman Longbows,all'));
    expect({ led: names(h.armies), bands: b.G.mercenaries?.length }).toEqual({
      led: ['Men-at-Arms c0', 'Men-at-Arms c1'],
      bands: 1,
    });
  });

  test('property: each company disbanded is one band, the dead none, and what is not named stays', () => {
    const kind = fc.constantFrom('Men-at-Arms', 'Yeoman Longbows', 'dead');
    fc.assert(
      fc.property(
        fc.array(kind, { minLength: 1, maxLength: 5 }),
        fc.array(fc.constantFrom('all', 'Men-at-Arms', 'Yeoman Longbows', 'Shieldwall Levies'), {
          minLength: 1,
          maxLength: 3,
        }),
        (kinds, targets) => {
          const b = fresh();
          const h = at(b, { king: true });
          h.armies = kinds.map((k, i) =>
            k === 'dead'
              ? skeletal(`Bone ${String(i)}`)
              : must(companies(1, k, 'Average', `${k} ${String(i)}`)[0], 'a company'),
          );
          const before = names(h.armies);
          play(b, h, o('disband_army', targets.join(',')));
          const gone = before.filter((n) => !names(h.armies).includes(n));
          const bands = (b.G.mercenaries ?? []).map((m) => String(m['unitName']));
          expect(bands.sort()).toEqual(gone.filter((n) => !n.startsWith('Bone')).sort());
        },
      ),
    );
  });
});

// ── Pick Up Army ────────────────────────────────────────────────────────────────────────────────────────────────
describe('Pick Up Army, called directly', () => {
  test('“all” takes the garrison’s companies from the last to the first', () => {
    const b = fresh();
    const h = at(b, { king: true });
    b.X.garrisonArmies = companies(3, 'Shieldwall Levies', 'Average', 'Keep');
    play(b, h, o('pickup_army', 'ALL'));
    expect(names(h.armies)).toEqual(['Keep c2', 'Keep c1', 'Keep c0']);
  });

  test('“G:1” is read whatever its case', () => {
    const b = fresh();
    const h = at(b, { king: true });
    b.X.garrisonArmies = companies(3, 'Shieldwall Levies', 'Average', 'Keep');
    play(b, h, o('pickup_army', 'G:1'));
    expect({ led: names(h.armies), left: names(b.X.garrisonArmies) }).toEqual({
      led: ['Keep c1'],
      left: ['Keep c0', 'Keep c2'],
    });
  });

  test('an old “-1:0” order takes the garrison’s last company, whatever the number after it', () => {
    const b = fresh();
    const h = at(b, { king: true });
    b.X.garrisonArmies = companies(3, 'Shieldwall Levies', 'Average', 'Keep');
    play(b, h, o('pickup_army', '-1:0'));
    expect(names(h.armies)).toEqual(['Keep c2']);
  });

  test('not from another realm’s hero, a fallen comrade or one who leads none', () => {
    const b = fresh();
    const h = at(b, { king: true });
    const rival = hero(b, { player: 1, at: b.X, troops: 1 });
    const fallen = at(b, { troops: 1 });
    fallen.alive = false;
    const empty = at(b);
    [rival, fallen, empty].forEach((x) => {
      play(b, h, o('pickup_army', place(b, x)));
    });
    expect({
      told: linesOf(b, h).filter((l) => l.text === `${h.name}: cannot pick up army.`).length,
      led: h.armies.length,
    }).toEqual({ told: 3, led: 0 });
  });

  test('at sea, a company with no room aboard goes back to the comrade it came from', () => {
    const b = fresh();
    const sea = ring1(b, 0);
    sea.terrain = 'sea';
    const h = at(b, { king: true, at: sea });
    h.armies = [...companies(1, 'Galleon Fleet'), ...companies(2)];
    const r = at(b, { at: sea });
    r.armies = [
      ...companies(1, 'Galleon Fleet', 'Average', 'His Fleet'),
      ...companies(1, 'Men-at-Arms', 'Average', 'His Foot'),
    ];
    play(b, h, o('pickup_army', place(b, r)));
    expect({
      led: names(h.armies),
      left: names(r.armies),
      told: textOf(b, h).includes(
        `His Foot c0 (Average Men-at-Arms) cannot be taken aboard — ${h.name}'s ships have no room for them on open water, so it stays with ${r.name}.`,
      ),
    }).toEqual({
      led: ['Galleon Fleet c0', 'Men-at-Arms c0', 'Men-at-Arms c1'],
      left: ['His Fleet c0', 'His Foot c0'],
      told: true,
    });
  });

  test('the line after tells how many companies he leads and the points he now has', () => {
    const b = fresh();
    const h = at(b, { king: true, troops: 1 });
    b.X.garrisonArmies = companies(1, 'Shieldwall Levies', 'Average', 'Keep');
    play(b, h, o('pickup_army', 'all'));
    const p = points(b, h);
    expect(textOf(b, h)).toContain(`now leads 2 armies. Land MPs: ${String(p.land)}, Sea MPs: ${String(p.sea)}.`);
    expect(p).toEqual(pace(b, h));
  });

  test('property: every company stays in the garrison or goes to him, and he takes no beast beyond his Druid', () => {
    const kind = fc.constantFrom('Shieldwall Levies', 'Great Bears');
    const target = fc.oneof(
      fc.constantFrom('all', '-1'),
      fc.array(fc.nat(5), { minLength: 1, maxLength: 3 }).map((is) => is.map((i) => `g:${String(i)}`).join(',')),
    );
    fc.assert(
      fc.property(fc.array(kind, { maxLength: 5 }), target, fc.nat(3), (kinds, t, room) => {
        const b = fresh();
        const h = at(b, { king: true, skills: druid(room) });
        b.X.garrisonArmies = kinds.map((k, i) => must(companies(1, k, 'Average', `${k} ${String(i)}`)[0], 'a company'));
        const before = names(b.X.garrisonArmies).sort();
        play(b, h, o('pickup_army', t));
        expect([...names(h.armies), ...names(b.X.garrisonArmies)].sort()).toEqual(before);
        expect(h.armies.filter((a) => a.type === 'Great Bears').length).toBeLessThanOrEqual(room);
      }),
    );
  });
});

// ── Equip Items ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('Equip Items, called directly', () => {
  test('a hero carrying only what he cannot use is told he wears nothing', () => {
    const b = fresh();
    const h = at(b, { king: true });
    h.items = [item(b, 'Moonsilver Bow')];
    play(b, h, o('equip_items', 'Moonsilver Bow'));
    expect(textOf(b, h)).toContain(`${h.name} arms and dresses for the season — now wearing: nothing.`);
  });

  test('property: no slot holds more than its limit, and the first named of a slot is worn', () => {
    const NAMES = [
      'Sundered Greatsword',
      'Kingsteel Longsword',
      'Ring of the Explorer',
      "Death's Finger Ring",
      "Siege Master's Ring",
      'Bronze Buckler',
      'Potion of Healing',
      'Elixir of Vigour',
      'Draught of the Phoenix',
      'Tome of Tactics',
    ];
    const slotOf = fn('itemSlot');
    const CAP = vm.runInContext('({...ITEM_SLOT_CAP})', engine) as Record<string, number>;
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom(...NAMES), { minLength: 1 }),
        fc.array(fc.constantFrom(...NAMES), { maxLength: 5 }),
        (held, named) => {
          const b = fresh();
          const h = at(b, { king: true });
          h.items = held.map((n) => item(b, n));
          play(b, h, o('equip_items', named.join(',')));
          const wornIn = (sl: string) => h.items.filter((i) => i['equipped'] === true && slotOf(i) === sl);
          for (const [sl, cap] of Object.entries(CAP)) expect(wornIn(sl).length).toBeLessThanOrEqual(cap);
          const first = new Map<string, string>();
          named
            .filter((n) => held.includes(n))
            .forEach((n) => {
              const sl = slotOf(item(b, n)) as string | null;
              if (sl && !first.has(sl)) first.set(sl, n);
            });
          for (const [sl, n] of first) expect(wornIn(sl).map((i) => i['name'])).toContain(n);
        },
      ),
    );
  });
});
