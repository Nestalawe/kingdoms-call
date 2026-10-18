// The item and army orders' cases (plan P1-08j5): Equip Items, Use Item, Send Item, Leave/Transfer Army, Release Hero,
// Disband Army and Pick Up Army, staged on the middle of a bot world (lib/middle-of-a-bot-world.ts), from plain realms,
// each with what must be true after it in game terms. scenario/item-and-army-orders-in-a-whole-turn.test.ts plays each
// through a whole turn (resolveTurn); unit/item-and-army-orders-called-directly.test.ts calls each order's own function
// on them, one phase at a time. A case stages its world and the heroes' orders; after them, it reads what it needs from
// the world and the log (`got`) beside what must be so (`want`), and the test compares the two. Every outcome is
// certain: none of these orders rolls a die but the Philosopher's Stone's Sage lesson, which no case reads. A company
// left in a garrison is checked by name, not grade (the turn's end may drill a garrison a grade up), and a band of
// mercenaries by kind and grade, not place (the turn's end may move a band on): the tests called directly check both.
import vm from 'node:vm';
import {
  hero,
  must,
  order,
  plan,
  type Board,
  type Character,
  type HeroSpec,
  type Line,
  type Order,
  type Province,
  type Unit,
  type World,
} from './middle-of-a-bot-world.ts';
import { plainRealms } from './recruit-hire-and-realm-works-order-cases.ts';

export interface Staged {
  /** The hero whose orders the case is about. */
  hero: Character;
  /** Every hero given orders, with them (the hero's own first). */
  orders: [Character, Order[]][];
  /** Another hero the case needs (the one sent an item or handed troops, a comrade). */
  other?: Character;
  /** A province the case needs besides the middle. */
  there?: Province;
  /** A hero of another realm the case needs. */
  rival?: Character;
}
export interface Outcome {
  world: World;
  /** The hero's own lines in the log. */
  lines: Line[];
  /** Every line in the log. */
  all: Line[];
  /** The turn the orders were played in. */
  turn: number;
}
export interface ItemAndArmyOrderCase {
  name: string;
  /** Plays only in a whole turn: processOrder refuses the order before the order's own function runs (a hero held by
   *  an enchantment), or the turn's end tells it (a courier's parcel arriving). */
  wholeTurnOnly?: boolean;
  stage(b: Board): Staged;
  /** What the case found after the orders, and what it should have found: the same keys. */
  check(o: Outcome, s: Staged): { got: Record<string, unknown>; want: Record<string, unknown> };
}

export type Item = Record<string, unknown> & { name: string };
let nextItemId = 7100;
/** A fresh copy of the game's item `name` (a lair's, a legendary relic, or the Mithril Armour), with an id of its own. */
export const item = (b: Board, name: string): Item => {
  const json = vm.runInContext(
    `JSON.stringify([...ALL_MAGIC_ITEMS_P, ...LEGENDARY_ITEMS_P, MITHRIL_ARMOUR].find(i=>i.name===${JSON.stringify(name)}))`,
    b.engine,
  ) as string | undefined;
  return { ...(JSON.parse(must(json, 'the item ' + name)) as Item), id: ++nextItemId };
};
/** `n` companies of `type` of `quality` (a real tier: Green, Average, Veteran, Crack, Elite), named `<label> c<k>`. */
export const companies = (n: number, type = 'Men-at-Arms', quality = 'Average', label = type): Unit[] =>
  Array.from({ length: n }, (_, k) => ({ type, quality, race: 'Human', unitName: `${label} c${String(k)}` }));
/** A company of the risen dead. */
export const skeletal = (name = 'Bone Levy'): Unit => ({
  type: 'Shieldwall Levies',
  quality: 'Average',
  race: 'Human',
  unitName: name,
  _isSkeletal: true,
});
export const STONE = "Philosopher's Stone";

const text = (ls: Line[]) => ls.map((l) => l.text).join('\n');
/** Whether the hero's lines say `what` (a string, or a pattern). */
const says = (o: Outcome, what: string | RegExp) =>
  typeof what === 'string' ? text(o.lines).includes(what) : what.test(text(o.lines));
/** Whether `c`'s own lines say `what`. */
const saysOf = (o: Outcome, c: Character, what: string | RegExp) => {
  const t = text(o.all.filter((l) => l.charId === c.id));
  return typeof what === 'string' ? t.includes(what) : what.test(t);
};
/** Whether any line of the turn says `what`. */
const anySays = (o: Outcome, what: string) => o.all.some((l) => l.text.includes(what));
const province = (o: Outcome, p: Province) => must(o.world.world.provinces[p.id], 'province ' + p.name);
const char = (o: Outcome, c: Character) =>
  must(
    o.world.characters.find((x) => x.id === c.id),
    'hero ' + c.name,
  );
const names = (us: { unitName?: unknown }[] | undefined) => (us ?? []).map((u) => String(u.unitName));
/** The companies `c` leads after the orders, by name. */
const led = (o: Outcome, c: Character) => names(char(o, c).armies);
/** The companies in `p`'s garrison, by name: not their grades (the turn's end may drill a garrison a grade up). */
const garrison = (o: Outcome, p: Province) => names(province(o, p).garrisonArmies);
const pack = (o: Outcome, c: Character) => char(o, c).items.map((i) => String(i['name']));
const worn = (o: Outcome, c: Character) =>
  char(o, c)
    .items.filter((i) => i['equipped'] === true)
    .map((i) => String(i['name']));
const ring1 = (b: Board, i: number) => must(b.ring1[i], 'a neighbour of the middle');
const realm = (b: Board, i = 0) => must(b.G.players[i], 'realm ' + String(i));
/** A hero of realm 0 standing in the middle (or `at`), at full health. His maximum HP is the turn's own reckoning of
 *  it (15 to start, and what he has earned), so the turn keeps it as staged. */
const at = (b: Board, extra: Partial<HeroSpec> = {}) => {
  const h = hero(b, { player: 0, at: b.X, ...extra });
  h['hpEarned'] = Math.max(0, h.maxHp - 15);
  const heroes = (realm(b, h.player ?? 0)['heroes'] as number[] | undefined) ?? [];
  if (h.player != null) realm(b, h.player)['heroes'] = [...heroes, h.id];
  return h;
};
/** The king of realm 0, in the middle, holding the middle. */
const king = (b: Board, extra: Partial<HeroSpec> = {}) => {
  b.own(b.X, 0);
  return at(b, { king: true, ...extra });
};
/** A hero of realm 0 beside the king (not a king), in the middle unless `at` says otherwise. */
const comrade = (b: Board, extra: Partial<HeroSpec> = {}) => at(b, extra);
const leads = (h: Character, us: Unit[]) => {
  h.armies = us;
  return h;
};
const holding = (h: Character, ...items: Item[]) => {
  h.items = items;
  return h;
};
const druid = (n: number) => ({ melee: 2, tactical: 2, march: 1, spy: 0, druid: n });
const one = (c: Character, ...os: Order[]): [Character, Order[]] => [c, plan(...os)];
/** A sea province beside the middle, open water, held by nobody. */
const openSea = (b: Board) => {
  const p = ring1(b, 0);
  p.terrain = 'sea';
  return p;
};
/** `c`'s place in the list of heroes: Leave/Transfer Army's recipient and Pick Up Army's old "from a comrade" form name
 *  a hero by it (the order form sends his id; in a game they are the same, on this board they differ). */
const place = (b: Board, c: Character) => String(b.G.characters.indexOf(c));
/** A synthetic id for `c`, as the order form writes it for a hero on a hire card. */
const hiredRef = (c: Character, by: Character) => `hired_${String(c.id)}_via_${String(by.id)}_ph0`;

// ── Equip Items ─────────────────────────────────────────────────────────────────────────────────────────────────
export const EQUIP_ITEMS_ORDER_CASES: ItemAndArmyOrderCase[] = [
  {
    name: 'Equip Items: a hero with nothing to wear or wield is told so',
    stage(b) {
      const h = holding(king(b), item(b, 'Tome of Tactics'));
      return { hero: h, orders: [one(h, order('equip_items', 'Tome of Tactics'))] };
    },
    check(o, { hero: h }) {
      return {
        got: { told: says(o, 'carries nothing that can be worn or wielded.'), pack: pack(o, h) },
        want: { told: true, pack: ['Tome of Tactics'] },
      };
    },
  },
  {
    name: 'Equip Items: the named items are worn, the rest taken off, and a slot left with room filled again',
    stage(b) {
      const sword = { ...item(b, 'Sundered Greatsword'), equipped: true };
      const ring = { ...item(b, 'Ring of the Explorer'), equipped: true };
      const h = holding(king(b), sword, item(b, 'Kingsteel Longsword'), ring, item(b, "Death's Finger Ring"));
      return { hero: h, orders: [one(h, order('equip_items', "Kingsteel Longsword,Death's Finger Ring"))] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          worn: worn(o, h),
          told: says(
            o,
            "now wearing: Kingsteel Longsword [weapon], Ring of the Explorer [ring], Death's Finger Ring [ring].",
          ),
        },
        want: { worn: ['Kingsteel Longsword', 'Ring of the Explorer', "Death's Finger Ring"], told: true },
      };
    },
  },
  {
    name: 'Equip Items: the line names each item worn with its slot',
    stage(b) {
      const h = holding(king(b), item(b, 'Kingsteel Longsword'), item(b, 'Bronze Buckler'));
      return { hero: h, orders: [one(h, order('equip_items', 'Kingsteel Longsword,Bronze Buckler'))] };
    },
    check(o) {
      return {
        got: {
          told: says(
            o,
            /arms and dresses for the season — now wearing: Kingsteel Longsword \[weapon\], Bronze Buckler \[shield\]\.$/m,
          ),
        },
        want: { told: true },
      };
    },
  },
  {
    name: 'Equip Items: of two weapons named, the first is worn and the second refused (one weapon slot)',
    stage(b) {
      const h = holding(king(b), item(b, 'Sundered Greatsword'), item(b, 'Kingsteel Longsword'));
      return { hero: h, orders: [one(h, order('equip_items', 'Kingsteel Longsword,Sundered Greatsword'))] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          worn: worn(o, h),
          refused: says(o, 'Could not also wear Sundered Greatsword (slot already filled).'),
        },
        want: { worn: ['Kingsteel Longsword'], refused: true },
      };
    },
  },
  {
    name: 'Equip Items: two combat items fill both combat slots and a third is refused',
    stage(b) {
      const h = holding(
        king(b),
        item(b, 'Potion of Healing'),
        item(b, 'Elixir of Vigour'),
        item(b, 'Draught of the Phoenix'),
      );
      return {
        hero: h,
        orders: [one(h, order('equip_items', 'Draught of the Phoenix,Elixir of Vigour,Potion of Healing'))],
      };
    },
    check(o, { hero: h }) {
      return {
        got: { worn: worn(o, h), refused: says(o, 'Could not also wear Potion of Healing (slot already filled).') },
        want: { worn: ['Elixir of Vigour', 'Draught of the Phoenix'], refused: true },
      };
    },
  },
  {
    name: 'Equip Items: an item may be named by its id',
    stage(b) {
      const second = item(b, 'Kingsteel Longsword');
      const h = holding(king(b), { ...item(b, 'Sundered Greatsword'), equipped: true }, second);
      return { hero: h, orders: [one(h, order('equip_items', String(second['id'])))] };
    },
    check(o, { hero: h }) {
      return { got: { worn: worn(o, h) }, want: { worn: ['Kingsteel Longsword'] } };
    },
  },
  {
    name: 'Equip Items: naming nothing takes everything off, then the first item of each slot goes back on',
    stage(b) {
      const h = holding(
        king(b),
        item(b, 'Sundered Greatsword'),
        { ...item(b, 'Kingsteel Longsword'), equipped: true },
        item(b, 'Bronze Buckler'),
      );
      return { hero: h, orders: [one(h, order('equip_items', ''))] };
    },
    check(o, { hero: h }) {
      return { got: { worn: worn(o, h) }, want: { worn: ['Sundered Greatsword', 'Bronze Buckler'] } };
    },
  },
  {
    name: 'Equip Items: a name the hero does not carry is passed over',
    stage(b) {
      const h = holding(king(b), item(b, 'Sundered Greatsword'), item(b, 'Kingsteel Longsword'));
      return { hero: h, orders: [one(h, order('equip_items', 'Blade of Nothing,Kingsteel Longsword'))] };
    },
    check(o, { hero: h }) {
      return {
        got: { worn: worn(o, h), refused: says(o, 'Could not also wear') },
        want: { worn: ['Kingsteel Longsword'], refused: false },
      };
    },
  },
  {
    name: 'Equip Items: an item of another folk is never worn, even when named',
    stage(b) {
      const h = holding(king(b), item(b, 'Moonsilver Bow'), item(b, 'Kingsteel Longsword'));
      return { hero: h, orders: [one(h, order('equip_items', 'Moonsilver Bow'))] };
    },
    check(o, { hero: h }) {
      return {
        got: { worn: worn(o, h), told: says(o, 'now wearing: Kingsteel Longsword [weapon].') },
        want: { worn: ['Kingsteel Longsword'], told: true },
      };
    },
  },
];

// ── Use Item ────────────────────────────────────────────────────────────────────────────────────────────────────
/** The Philosopher's Stone as an older save holds it, with the effect Use Item works (`massPromote`). The relic a lair
 *  yields today reads `promoteAll`, which nothing works: Use Item calls it a passive item (STATUS, Parked). */
export const oldStone = (b: Board): Item => ({ ...item(b, STONE), effect: { stat: 'massPromote', bonus: 1 } });
/** Realm 0's king carrying an older save's Philosopher's Stone, and leading `troops`. */
const stoneBearer = (b: Board, troops: Unit[] = []) => leads(holding(king(b), oldStone(b)), troops);
const qualities = (us: Unit[] | undefined) => (us ?? []).map((u) => `${u.quality} ${u.unitName}`);
export const USE_ITEM_ORDER_CASES: ItemAndArmyOrderCase[] = [
  {
    name: 'Use Item: a hero held by a Charm this turn spends nothing he carries',
    stage(b) {
      const h = stoneBearer(b, companies(2, 'Men-at-Arms', 'Green'));
      h['_charmedTurn'] = b.G.turn;
      return { hero: h, orders: [one(h, order('use_item', STONE))] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          told: says(o, "will not spend what they carry at another's bidding"),
          pack: pack(o, h),
          led: qualities(char(o, h).armies),
        },
        want: { told: true, pack: [STONE], led: ['Green Men-at-Arms c0', 'Green Men-at-Arms c1'] },
      };
    },
  },
  {
    name: 'Use Item: an item the hero does not carry',
    stage(b) {
      const h = holding(king(b), item(b, 'Ring of the Explorer'));
      return { hero: h, orders: [one(h, order('use_item', STONE))] };
    },
    check(o) {
      return { got: { told: says(o, ': no such item to use.') }, want: { told: true } };
    },
  },
  {
    name: 'Use Item: an item already used',
    stage(b) {
      const h = stoneBearer(b, companies(1, 'Men-at-Arms', 'Green'));
      const stone = must(h.items[0], 'the Stone');
      stone['_spent'] = true;
      return { hero: h, orders: [one(h, order('use_item', STONE))] };
    },
    check(o, { hero: h }) {
      return {
        got: { told: says(o, `The ${STONE} has already been used.`), led: qualities(char(o, h).armies) },
        want: { told: true, led: ['Green Men-at-Arms c0'] },
      };
    },
  },
  {
    name: 'Use Item: a passive item needs no using',
    stage(b) {
      const h = holding(king(b), item(b, 'Ring of the Explorer'));
      return { hero: h, orders: [one(h, order('use_item', 'Ring of the Explorer'))] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          told: says(o, 'The Ring of the Explorer is a passive item and does not need to be used'),
          pack: pack(o, h),
        },
        want: { told: true, pack: ['Ring of the Explorer'] },
      };
    },
  },
  {
    name: 'Use Item: the Philosopher’s Stone a lair yields today is called a passive item, and nothing happens',
    stage(b) {
      const h = leads(holding(king(b), item(b, STONE)), companies(1, 'Men-at-Arms', 'Green'));
      return { hero: h, orders: [one(h, order('use_item', STONE))] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          told: says(o, `The ${STONE} is a passive item and does not need to be used`),
          pack: pack(o, h),
          led: qualities(char(o, h).armies),
        },
        want: { told: true, pack: [STONE], led: ['Green Men-at-Arms c0'] },
      };
    },
  },
  {
    name: 'Use Item: an item may be named by its id',
    stage(b) {
      const h = holding(king(b), item(b, 'Ring of the Explorer'));
      return { hero: h, orders: [one(h, order('use_item', String(must(h.items[0], 'the ring')['id'])))] };
    },
    check(o) {
      return { got: { told: says(o, 'is a passive item') }, want: { told: true } };
    },
  },
  {
    name: 'Use Item: the Philosopher’s Stone with no company in the realm is not spent',
    stage(b) {
      const h = stoneBearer(b);
      return { hero: h, orders: [one(h, order('use_item', STONE))] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          told: says(o, 'your realm has no armies in the field or in garrison. The Stone is NOT spent'),
          pack: pack(o, h),
        },
        want: { told: true, pack: [STONE] },
      };
    },
  },
  {
    name: 'Use Item: the Philosopher’s Stone over a realm all Elite is not spent',
    stage(b) {
      const h = stoneBearer(b, companies(2, 'Men-at-Arms', 'Elite'));
      return { hero: h, orders: [one(h, order('use_item', STONE))] };
    },
    check(o, { hero: h }) {
      return {
        got: { told: says(o, 'every unit you command is already Elite. The Stone is NOT spent'), pack: pack(o, h) },
        want: { told: true, pack: [STONE] },
      };
    },
  },
  {
    name: 'Use Item: the Philosopher’s Stone raises every company the realm leads one grade, and is gone',
    stage(b) {
      const h = stoneBearer(b, [...companies(2, 'Men-at-Arms', 'Green'), ...companies(1, 'Free Lances', 'Elite')]);
      const far = leads(comrade(b, { at: ring1(b, 2) }), companies(1, 'Yeoman Longbows', 'Veteran'));
      const foe = leads(hero(b, { player: 1, at: ring1(b, 4) }), companies(1, 'Men-at-Arms', 'Green', 'Foe'));
      return { hero: h, orders: [one(h, order('use_item', STONE))], other: far, rival: foe };
    },
    check(o, s) {
      const foe = must(s.rival, 'the foe');
      return {
        got: {
          led: qualities(char(o, s.hero).armies),
          far: qualities(char(o, must(s.other, 'the comrade')).armies),
          foe: qualities(char(o, foe).armies),
          pack: pack(o, s.hero),
          told: says(
            o,
            `invokes the ${STONE} — a wave of power sweeps the realm and 3 army units advance one quality tier (3 marching under your commanders; 1 already Elite and unchanged).`,
          ),
          gone: says(o, 'The Stone crumbles to grey dust'),
        },
        want: {
          led: ['Average Men-at-Arms c0', 'Average Men-at-Arms c1', 'Elite Free Lances c0'],
          far: ['Crack Yeoman Longbows c0'],
          foe: ['Green Foe c0'],
          pack: [],
          told: true,
          gone: true,
        },
      };
    },
  },
  {
    name: 'Use Item: the Philosopher’s Stone raises the realm’s garrisons too, and counts them apart',
    stage(b) {
      const h = stoneBearer(b, companies(1, 'Men-at-Arms', 'Green'));
      const keep = ring1(b, 1);
      b.own(keep, 0);
      keep.garrisonArmies = companies(2, 'Shieldwall Levies', 'Green', 'Keep');
      const foreign = ring1(b, 3);
      b.own(foreign, 1);
      foreign.garrisonArmies = companies(1, 'Shieldwall Levies', 'Green', 'Foreign');
      return { hero: h, orders: [one(h, order('use_item', STONE))], there: keep };
    },
    check(o) {
      return {
        got: {
          told: says(
            o,
            'and 3 army units advance one quality tier (1 marching under your commanders, 2 in your garrisons)',
          ),
        },
        want: { told: true },
      };
    },
  },
  {
    name: 'Use Item: the Philosopher’s Stone leaves the dead as they were',
    stage(b) {
      const h = stoneBearer(b, [...companies(1, 'Men-at-Arms', 'Green'), { ...skeletal(), quality: 'Green' }]);
      return { hero: h, orders: [one(h, order('use_item', STONE))] };
    },
    check(o) {
      return {
        got: { told: says(o, 'and 1 army unit advance one quality tier (1 marching under your commanders).') },
        want: { told: true },
      };
    },
  },
  {
    name: 'Use Item: once the Philosopher’s Stone is worked, every realm is told and none can find another',
    stage(b) {
      const h = stoneBearer(b, companies(1, 'Men-at-Arms', 'Green'));
      // the bot world may have dealt a Stone to a lair of its own: none but the one staged here
      b.G.world.provinces.forEach((p) => {
        ((p['features'] ?? []) as { hoardItems?: Item[] }[]).forEach((f) => {
          if (f.hoardItems) f.hoardItems = f.hoardItems.filter((i) => i.name !== STONE);
        });
      });
      const ledger = b.G as unknown as Record<string, string[] | undefined>;
      ledger['_awardedItems'] = (ledger['_awardedItems'] ?? []).filter((n) => n !== STONE);
      // a lair already stocked (`_hoardV2`): the turn's start deals a fresh hoard to one that isn't
      const hoard = ring1(b, 5);
      hoard['features'] = [
        { type: 'lair', name: 'Test Barrow', cleared: false, _hoardV2: true, hoardItems: [item(b, STONE)] },
      ];
      return { hero: h, orders: [one(h, order('use_item', STONE))], there: hoard };
    },
    check(o, s) {
      const feats = (province(o, must(s.there, 'the barrow'))['features'] ?? []) as { hoardItems?: Item[] }[];
      const told = (i: number) =>
        o.all.some(
          (l) =>
            (l.targets ?? []).length === 1 &&
            l.targets?.[0] === i &&
            l.text.startsWith('🌍 A light passes over the world'),
        );
      return {
        got: {
          realms: [told(0), told(1), told(2)],
          ledger: (o.world as unknown as Record<string, string[]>)['_awardedItems']?.includes(STONE),
          destroyed: ((o.world as unknown as Record<string, { name: string }[]>)['_destroyedItems'] ?? []).map(
            (d) => d.name,
          ),
          hoard: (feats[0]?.hoardItems ?? []).some((i) => i.name === STONE),
          gmNote: anySays(o, `(GM note: 1 undiscovered ${STONE} was struck from the world's lair hoards`),
        },
        want: { realms: [true, true, true], ledger: true, destroyed: [STONE], hoard: false, gmNote: true },
      };
    },
  },
];

// ── Send Item ───────────────────────────────────────────────────────────────────────────────────────────────────
/** The king carrying `items` in the middle, and a comrade beside him (or in `at`) carrying nothing. */
const giverAndTaker = (b: Board, items: string[], extra: Partial<HeroSpec> = {}) => {
  const h = holding(king(b), ...items.map((n) => item(b, n)));
  const r = holding(comrade(b, extra));
  return { h, r };
};
/** The king of a Dwarven realm, a Dwarf, wearing his Mithril Armour (the turn strips a suit from anyone else at its
 *  start), carrying `items` too, and a comrade beside him, a Human, carrying nothing. */
const dwarfAndTaker = (b: Board, items: string[]) => {
  realm(b)['race'] = 'Dwarven';
  const { h, r } = giverAndTaker(b, ['Mithril Armour', ...items]);
  h['race'] = 'Dwarven';
  return { h, r };
};
const send = (h: Character, target: string, r: Character | string) =>
  one(h, order('give_item', target, typeof r === 'string' ? r : String(r.id)));
export const SEND_ITEM_ORDER_CASES: ItemAndArmyOrderCase[] = [
  {
    name: 'Send Item: a hero held by a Charm this turn parts with nothing',
    stage(b) {
      const { h, r } = giverAndTaker(b, ['Ring of the Explorer']);
      h['_charmedTurn'] = b.G.turn;
      return { hero: h, orders: [send(h, '0', r)], other: r };
    },
    check(o, { hero: h, other: r }) {
      return {
        got: {
          told: says(o, 'will part with nothing — a mind held by enchantment guards its own possessions'),
          kept: pack(o, h),
          got: pack(o, must(r, 'the comrade')),
        },
        want: { told: true, kept: ['Ring of the Explorer'], got: [] },
      };
    },
  },
  {
    name: 'Send Item: no such recipient',
    stage(b) {
      const h = holding(king(b), item(b, 'Ring of the Explorer'));
      return { hero: h, orders: [send(h, '0', '987654')] };
    },
    check(o, { hero: h }) {
      return {
        got: { told: says(o, ': cannot send item — no such recipient.'), kept: pack(o, h) },
        want: { told: true, kept: ['Ring of the Explorer'] },
      };
    },
  },
  {
    name: 'Send Item: a recipient held by a Charm is trusted with nothing',
    stage(b) {
      const { h, r } = giverAndTaker(b, ['Ring of the Explorer']);
      r['_charmedTurn'] = b.G.turn;
      return { hero: h, orders: [send(h, '0', r)], other: r };
    },
    check(o, { hero: h, other: r }) {
      return {
        got: {
          told: says(o, `keeps the items — ${must(r, 'the comrade').name} is held by a Charm`),
          kept: pack(o, h),
        },
        want: { told: true, kept: ['Ring of the Explorer'] },
      };
    },
  },
  {
    name: 'Send Item: a hero on a hire card who is not in the realm’s service is sent nothing',
    stage(b) {
      const h = holding(king(b), item(b, 'Ring of the Explorer'));
      const w = hero(b, { player: null, at: b.X });
      w.name = `Wanderer ${String(w.id)}`;
      return { hero: h, orders: [send(h, '0', hiredRef(w, h))], other: w };
    },
    check(o, { hero: h, other: w }) {
      return {
        got: {
          told: says(o, `keeps the items — ${must(w, 'the wanderer').name} is not in your service: the hire`),
          kept: pack(o, h),
        },
        want: { told: true, kept: ['Ring of the Explorer'] },
      };
    },
  },
  {
    name: 'Send Item: a hero on a hire card who is in the realm’s service is sent the items',
    stage(b) {
      const { h, r } = giverAndTaker(b, ['Ring of the Explorer']);
      return { hero: h, orders: [send(h, '0', hiredRef(r, h))], other: r };
    },
    check(o, { hero: h, other: r }) {
      return {
        got: { kept: pack(o, h), got: pack(o, must(r, 'the comrade')) },
        want: { kept: [], got: ['Ring of the Explorer'] },
      };
    },
  },
  {
    name: 'Send Item: sent in a later phase, both heroes are told in that phase',
    stage(b) {
      const { h, r } = giverAndTaker(b, ['Ring of the Explorer']);
      return {
        hero: h,
        orders: [one(h, order('rest'), order('rest'), order('give_item', '0', String(r.id)))],
        other: r,
      };
    },
    check(o, { other: r }) {
      const c = must(r, 'the comrade');
      return {
        got: {
          sent: o.lines.find((l) => l.text.includes(' hands Ring of the Explorer to '))?.phase,
          heard: o.all.find((l) => l.charId === c.id && l.text.startsWith('📦'))?.phase,
        },
        want: { sent: 2, heard: 2 },
      };
    },
  },
  {
    name: 'Send Item: only to one of the realm’s own living heroes (not an ally’s)',
    stage(b) {
      const h = holding(king(b), item(b, 'Ring of the Explorer'));
      const ally = hero(b, { player: 2, at: b.X });
      return { hero: h, orders: [send(h, '0', ally)], other: ally };
    },
    check(o, { hero: h }) {
      return {
        got: { told: says(o, ': items can only be sent to one of your own living characters.'), kept: pack(o, h) },
        want: { told: true, kept: ['Ring of the Explorer'] },
      };
    },
  },
  {
    name: 'Send Item: only to one of the realm’s own living heroes (not a fallen one)',
    stage(b) {
      const { h, r } = giverAndTaker(b, ['Ring of the Explorer']);
      r.alive = false;
      return { hero: h, orders: [send(h, '0', r)], other: r };
    },
    check(o, { hero: h }) {
      return {
        got: { told: says(o, ': items can only be sent to one of your own living characters.'), kept: pack(o, h) },
        want: { told: true, kept: ['Ring of the Explorer'] },
      };
    },
  },
  {
    name: 'Send Item: not to himself',
    stage(b) {
      const h = holding(king(b), item(b, 'Ring of the Explorer'));
      return { hero: h, orders: [send(h, '0', h)] };
    },
    check(o, { hero: h }) {
      return {
        got: { told: says(o, ': cannot send items to themselves.'), kept: pack(o, h) },
        want: { told: true, kept: ['Ring of the Explorer'] },
      };
    },
  },
  {
    name: 'Send Item: “all” hands everything to a comrade in the same province, who is told in his own section',
    stage(b) {
      const { h, r } = giverAndTaker(b, ['Ring of the Explorer', 'Tome of Tactics']);
      return { hero: h, orders: [send(h, 'all', r)], other: r };
    },
    check(o, s) {
      const r = must(s.other, 'the comrade');
      return {
        got: {
          kept: pack(o, s.hero),
          got: pack(o, r),
          // taken from the pack from the last place down, so told last-first
          told: says(o, `hands Tome of Tactics, Ring of the Explorer to ${r.name}.`),
          heard: saysOf(o, r, `📦 ${r.name} receives Tome of Tactics, Ring of the Explorer from ${s.hero.name}.`),
          note: saysOf(o, r, new RegExp(`^🎒 .*${r.name} equips the Ring of the Explorer at once\\.`, 'm')),
        },
        want: { kept: [], got: ['Tome of Tactics', 'Ring of the Explorer'], told: true, heard: true, note: true },
      };
    },
  },
  {
    name: 'Send Item: items named by their places in the pack',
    stage(b) {
      const { h, r } = giverAndTaker(b, ['Ring of the Explorer', 'Tome of Tactics', 'Bronze Buckler']);
      return { hero: h, orders: [send(h, '0,2', r)], other: r };
    },
    check(o, { hero: h, other: r }) {
      return {
        got: { kept: pack(o, h), got: pack(o, must(r, 'the comrade')).sort() },
        want: { kept: ['Tome of Tactics'], got: ['Bronze Buckler', 'Ring of the Explorer'] },
      };
    },
  },
  {
    name: 'Send Item: items named by id or by name',
    stage(b) {
      const { h, r } = giverAndTaker(b, ['Ring of the Explorer', 'Tome of Tactics', 'Bronze Buckler']);
      const id = String(must(h.items[2], 'the buckler')['id']);
      return { hero: h, orders: [send(h, `Tome of Tactics,${id}`, r)], other: r };
    },
    check(o, { hero: h, other: r }) {
      return {
        got: { kept: pack(o, h), got: pack(o, must(r, 'the comrade')).sort() },
        want: { kept: ['Ring of the Explorer'], got: ['Bronze Buckler', 'Tome of Tactics'] },
      };
    },
  },
  {
    name: 'Send Item: the same item named twice is sent once',
    stage(b) {
      // taken twice from the first place, the second would be the item behind it
      const { h, r } = giverAndTaker(b, ['Ring of the Explorer', 'Tome of Tactics', 'Bronze Buckler']);
      return { hero: h, orders: [send(h, '0,0,Ring of the Explorer', r)], other: r };
    },
    check(o, { hero: h, other: r }) {
      return {
        got: { kept: pack(o, h), got: pack(o, must(r, 'the comrade')) },
        want: { kept: ['Tome of Tactics', 'Bronze Buckler'], got: ['Ring of the Explorer'] },
      };
    },
  },
  {
    name: 'Send Item: nothing that matches is nothing sent',
    stage(b) {
      const { h, r } = giverAndTaker(b, ['Ring of the Explorer']);
      return { hero: h, orders: [send(h, '5,Blade of Nothing', r)], other: r };
    },
    check(o, { hero: h }) {
      return {
        got: { told: says(o, /: cannot send item\.$/m), kept: pack(o, h) },
        want: { told: true, kept: ['Ring of the Explorer'] },
      };
    },
  },
  {
    name: 'Send Item: Mithril Armour stays with its wearer and the rest is sent',
    stage(b) {
      const { h, r } = dwarfAndTaker(b, ['Ring of the Explorer']);
      return { hero: h, orders: [send(h, 'all', r)], other: r };
    },
    check(o, { hero: h, other: r }) {
      return {
        got: {
          told: says(o, ': Mithril Armour is forged to its wearer and cannot be sent — it stays in their pack.'),
          kept: pack(o, h),
          got: pack(o, must(r, 'the comrade')),
        },
        want: { told: true, kept: ['Mithril Armour'], got: ['Ring of the Explorer'] },
      };
    },
  },
  {
    name: 'Send Item: Mithril Armour alone is nothing sent',
    stage(b) {
      const { h, r } = dwarfAndTaker(b, []);
      return { hero: h, orders: [send(h, '0', r)], other: r };
    },
    check(o, { hero: h }) {
      return {
        got: {
          stays: says(o, 'Mithril Armour is forged to its wearer'),
          none: says(o, /: cannot send item\.$/m),
          kept: pack(o, h),
        },
        want: { stays: true, none: true, kept: ['Mithril Armour'] },
      };
    },
  },
  {
    name: 'Send Item: to a comrade in another province the items go by courier and arrive by the turn’s end',
    wholeTurnOnly: true,
    stage(b) {
      const { h, r } = giverAndTaker(b, ['Ring of the Explorer'], { at: ring1(b, 2) });
      return { hero: h, orders: [send(h, '0', r)], other: r, there: ring1(b, 2) };
    },
    check(o, s) {
      const r = must(s.other, 'the comrade');
      return {
        got: {
          told: says(
            o,
            `dispatches Ring of the Explorer by courier to ${r.name} in ${must(s.there, 'there').name} — it will arrive by turn's end.`,
          ),
          kept: pack(o, s.hero),
          got: pack(o, r),
          arrived: saysOf(o, r, 'A courier reaches'),
        },
        want: { told: true, kept: [], got: ['Ring of the Explorer'], arrived: true },
      };
    },
  },
];

// ── Leave/Transfer Army ─────────────────────────────────────────────────────────────────────────────────────────
const leave = (h: Character, target: string, to = '') => one(h, order('leave_army', target, to));
export const LEAVE_ARMY_ORDER_CASES: ItemAndArmyOrderCase[] = [
  {
    name: 'Leave/Transfer Army: a hero with no companies has none to hand over',
    stage(b) {
      const h = king(b);
      const r = comrade(b);
      return { hero: h, orders: [leave(h, 'all', place(b, r))], other: r };
    },
    check(o) {
      return { got: { told: says(o, ': no armies to transfer.') }, want: { told: true } };
    },
  },
  {
    name: 'Leave/Transfer Army: “all” to a comrade beside him, who is told in his own section',
    stage(b) {
      const h = leads(king(b), companies(2));
      const r = comrade(b);
      return { hero: h, orders: [leave(h, 'all', place(b, r))], other: r };
    },
    check(o, s) {
      const r = must(s.other, 'the comrade');
      return {
        got: {
          led: led(o, s.hero),
          took: led(o, r),
          told: says(o, `transfers Men-at-Arms c0, Men-at-Arms c1 to ${r.name}.`),
          heard: saysOf(
            o,
            r,
            `⚔ ${r.name} takes command of Men-at-Arms c0, Men-at-Arms c1, handed over by ${s.hero.name} in ${o.world.world.provinces[s.hero.location]?.name ?? '?'}.`,
          ),
        },
        want: { led: [], took: ['Men-at-Arms c0', 'Men-at-Arms c1'], told: true, heard: true },
      };
    },
  },
  {
    name: 'Leave/Transfer Army: companies named by kind or by name, one each',
    stage(b) {
      const h = leads(king(b), [
        ...companies(2, 'Yeoman Longbows'),
        ...companies(2),
        ...companies(1, 'Free Lances', 'Average', 'Lances'),
      ]);
      const r = comrade(b);
      return { hero: h, orders: [leave(h, 'Yeoman Longbows,Lances c0', place(b, r))], other: r };
    },
    check(o, { hero: h, other: r }) {
      return {
        got: { led: led(o, h), took: led(o, must(r, 'the comrade')) },
        want: {
          led: ['Yeoman Longbows c1', 'Men-at-Arms c0', 'Men-at-Arms c1'],
          took: ['Yeoman Longbows c0', 'Lances c0'],
        },
      };
    },
  },
  {
    name: 'Leave/Transfer Army: nothing that matches is nothing handed over',
    stage(b) {
      const h = leads(king(b), companies(2));
      const r = comrade(b);
      return { hero: h, orders: [leave(h, 'Free Lances', place(b, r))], other: r };
    },
    check(o, { hero: h, other: r }) {
      return {
        got: {
          told: says(o, ': could not find specified armies to transfer.'),
          led: led(o, h),
          took: led(o, must(r, 'the comrade')),
        },
        want: { told: true, led: ['Men-at-Arms c0', 'Men-at-Arms c1'], took: [] },
      };
    },
  },
  {
    name: 'Leave/Transfer Army: a comrade who has marched on is named with where he went',
    stage(b) {
      const h = leads(king(b), companies(2));
      const r = comrade(b, { at: ring1(b, 1) });
      return { hero: h, orders: [leave(h, 'all', place(b, r))], other: r, there: ring1(b, 1) };
    },
    check(o, s) {
      const r = must(s.other, 'the comrade');
      return {
        got: {
          told: says(
            o,
            `cannot hand the troops to ${r.name} — they had already marched on to ${must(s.there, 'there').name}`,
          ),
          led: led(o, s.hero),
        },
        want: { told: true, led: ['Men-at-Arms c0', 'Men-at-Arms c1'] },
      };
    },
  },
  {
    name: 'Leave/Transfer Army: never to a fallen comrade',
    stage(b) {
      const h = leads(king(b), companies(1));
      const r = comrade(b);
      r.alive = false;
      return { hero: h, orders: [leave(h, 'all', place(b, r))], other: r };
    },
    check(o, { hero: h, other: r }) {
      return {
        got: {
          told: says(
            o,
            `cannot transfer armies — the recipient must be one of your own characters standing in ${b0(o, h).name}.`,
          ),
          led: led(o, h),
          took: led(o, must(r, 'the comrade')),
        },
        want: { told: true, led: ['Men-at-Arms c0'], took: [] },
      };
    },
  },
  {
    name: 'Leave/Transfer Army: never to another realm’s hero, even an ally’s',
    stage(b) {
      const h = leads(king(b), companies(1));
      const ally = hero(b, { player: 2, at: b.X });
      return { hero: h, orders: [leave(h, 'all', place(b, ally))], other: ally };
    },
    check(o, { hero: h, other: ally }) {
      return {
        got: {
          told: says(
            o,
            `cannot transfer armies — the recipient must be one of your own characters standing in ${b0(o, h).name}.`,
          ),
          led: led(o, h),
          took: led(o, must(ally, 'the ally')),
        },
        want: { told: true, led: ['Men-at-Arms c0'], took: [] },
      };
    },
  },
  {
    name: 'Leave/Transfer Army: a hero on a hire card in the realm’s service may be handed troops',
    stage(b) {
      const h = leads(king(b), companies(1));
      const r = comrade(b);
      return { hero: h, orders: [leave(h, 'all', hiredRef(r, h))], other: r };
    },
    check(o, { hero: h, other: r }) {
      return {
        got: { led: led(o, h), took: led(o, must(r, 'the comrade')) },
        want: { led: [], took: ['Men-at-Arms c0'] },
      };
    },
  },
  {
    name: 'Leave/Transfer Army: left in the garrison of a province the realm holds; with all left he travels light',
    stage(b) {
      const h = leads(king(b), companies(2));
      return { hero: h, orders: [leave(h, 'all')] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          led: led(o, h),
          garrison: garrison(o, b0(o, h)),
          told: says(o, `garrisons Men-at-Arms, Men-at-Arms in ${b0(o, h).name}.`),
          light: says(o, /left all armies behind in .* — now travelling light \(land \d+, sea \d+ move points\)\./),
        },
        want: { led: [], garrison: ['Men-at-Arms c0', 'Men-at-Arms c1'], told: true, light: true },
      };
    },
  },
  {
    name: 'Leave/Transfer Army: “-1” leaves them in the garrison too, and with some kept there is no travelling light',
    stage(b) {
      const h = leads(king(b), [...companies(1, 'Yeoman Longbows'), ...companies(1)]);
      return { hero: h, orders: [leave(h, 'Yeoman Longbows', '-1')] };
    },
    check(o, { hero: h }) {
      return {
        got: { led: led(o, h), garrison: garrison(o, b0(o, h)), light: says(o, 'travelling light') },
        want: { led: ['Men-at-Arms c0'], garrison: ['Yeoman Longbows c0'], light: false },
      };
    },
  },
  {
    name: 'Leave/Transfer Army: no garrison in a province the realm does not hold',
    stage(b) {
      const h = leads(king(b), companies(1));
      b.own(b.X, null);
      return { hero: h, orders: [leave(h, 'all')] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          told: says(o, `cannot garrison armies in ${b0(o, h).name} — you do not control this province`),
          led: led(o, h),
          garrison: garrison(o, b0(o, h)),
        },
        want: { told: true, led: ['Men-at-Arms c0'], garrison: [] },
      };
    },
  },
  {
    name: 'Leave/Transfer Army: the risen dead will not follow a living commander, and are lost',
    stage(b) {
      const h = leads(king(b), [skeletal(), ...companies(1)]);
      const r = comrade(b);
      return { hero: h, orders: [leave(h, 'all', place(b, r))], other: r };
    },
    check(o, { hero: h, other: r }) {
      return {
        got: {
          told: says(
            o,
            '💀 Bone Levy refuse to follow a non-Undead commander — they dig their own graves and go to sleep.',
          ),
          led: led(o, h),
          took: led(o, must(r, 'the comrade')),
        },
        want: { told: true, led: [], took: ['Men-at-Arms c0'] },
      };
    },
  },
  {
    name: 'Leave/Transfer Army: the risen dead follow an Undead commander',
    stage(b) {
      realm(b)['alignment'] = 'Undead';
      const h = leads(king(b), [skeletal()]);
      // Necromancy holds the dead together at the turn's end
      const r = comrade(b, { skills: { melee: 2, tactical: 2, march: 1, spy: 0, necromancy: 1 } });
      return { hero: h, orders: [leave(h, 'all', place(b, r))], other: r };
    },
    check(o, { hero: h, other: r }) {
      return { got: { led: led(o, h), took: led(o, must(r, 'the comrade')) }, want: { led: [], took: ['Bone Levy'] } };
    },
  },
  {
    name: 'Leave/Transfer Army: the risen dead may be left in a garrison',
    stage(b) {
      const h = leads(king(b), [skeletal()]);
      return { hero: h, orders: [leave(h, 'all')] };
    },
    check(o, { hero: h }) {
      // a garrison of the dead, with no one to command them, crumbles at the turn's end
      const stands = garrison(o, b0(o, h)).includes('Bone Levy');
      const crumbled = anySays(
        o,
        `1 skeletal unit left to garrison ${b0(o, h).name} — no one was left to command them`,
      );
      return {
        got: {
          led: led(o, h),
          left: says(o, `garrisons Shieldwall Levies in ${b0(o, h).name}.`),
          told: stands !== crumbled,
        },
        want: { led: [], left: true, told: true },
      };
    },
  },
  {
    name: 'Leave/Transfer Army: beasts beyond the comrade’s Druid stay with the giver',
    stage(b) {
      const h = leads(king(b, { skills: druid(3) }), [...companies(3, 'Great Bears'), ...companies(1)]);
      const r = comrade(b, { skills: druid(1) });
      return { hero: h, orders: [leave(h, 'all', place(b, r))], other: r };
    },
    check(o, { hero: h, other: r }) {
      const c = must(r, 'the comrade');
      return {
        got: {
          led: led(o, h),
          took: led(o, c),
          told: says(
            o,
            `🐾 ${c.name} can lead only 1 Creature or Monster unit (Druid 1): Great Bears c1, Great Bears c2 stay with ${h.name}.`,
          ),
        },
        want: { led: ['Great Bears c1', 'Great Bears c2'], took: ['Great Bears c0', 'Men-at-Arms c0'], told: true },
      };
    },
  },
  {
    name: 'Leave/Transfer Army: with no room for any beast, nothing is handed over',
    stage(b) {
      const h = leads(king(b, { skills: druid(1) }), companies(1, 'Great Bears'));
      const r = comrade(b);
      return { hero: h, orders: [leave(h, 'all', place(b, r))], other: r };
    },
    check(o, { hero: h, other: r }) {
      return {
        got: { led: led(o, h), took: led(o, must(r, 'the comrade')), transfer: says(o, ' transfers ') },
        want: { led: ['Great Bears c0'], took: [], transfer: false },
      };
    },
  },
  {
    name: 'Leave/Transfer Army: on open water, not if the ships that stay could not carry the rest',
    stage(b) {
      const sea = openSea(b);
      const h = leads(king(b, { at: sea }), [...companies(1, 'Galleon Fleet'), ...companies(1)]);
      const r = comrade(b, { at: sea });
      return { hero: h, orders: [leave(h, 'Galleon Fleet', place(b, r))], other: r, there: sea };
    },
    check(o, { hero: h, other: r }) {
      return {
        got: {
          told: says(
            o,
            `out on open water — the ships that stay would be too few to carry the rest of ${h.name}'s column`,
          ),
          led: led(o, h),
          took: led(o, must(r, 'the comrade')),
        },
        want: { told: true, led: ['Galleon Fleet c0', 'Men-at-Arms c0'], took: [] },
      };
    },
  },
  {
    name: 'Leave/Transfer Army: on open water, not if the comrade’s ships could not carry them',
    stage(b) {
      const sea = openSea(b);
      const h = leads(king(b, { at: sea }), [...companies(2, 'Galleon Fleet'), ...companies(1)]);
      const r = comrade(b, { at: sea });
      return { hero: h, orders: [leave(h, 'Men-at-Arms', place(b, r))], other: r, there: sea };
    },
    check(o, { hero: h, other: r }) {
      const c = must(r, 'the comrade');
      return {
        got: {
          told: says(o, `out on open water — ${c.name}'s ships could not carry them`),
          took: led(o, c),
          led: led(o, h).length,
        },
        want: { told: true, took: [], led: 3 },
      };
    },
  },
  {
    name: 'Leave/Transfer Army: on open water, a ship and what it carries may be handed over together',
    stage(b) {
      const sea = openSea(b);
      const h = leads(king(b, { at: sea }), [...companies(2, 'Galleon Fleet'), ...companies(2)]);
      const r = comrade(b, { at: sea });
      return { hero: h, orders: [leave(h, 'Galleon Fleet,Men-at-Arms', place(b, r))], other: r, there: sea };
    },
    check(o, { hero: h, other: r }) {
      return {
        got: { led: led(o, h), took: led(o, must(r, 'the comrade')) },
        want: { led: ['Galleon Fleet c1', 'Men-at-Arms c1'], took: ['Galleon Fleet c0', 'Men-at-Arms c0'] },
      };
    },
  },
];
/** The province `c` stood in when the orders began (none of these orders moves him). */
const b0 = (o: Outcome, c: Character) => province(o, { id: c.location } as Province);

// ── Release Hero ────────────────────────────────────────────────────────────────────────────────────────────────
export const RELEASE_ORDER_CASES: ItemAndArmyOrderCase[] = [
  {
    name: 'Release Hero: a king cannot release himself',
    stage(b) {
      const h = king(b);
      return { hero: h, orders: [one(h, order('release'))] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          told: says(o, 'wears the crown — a king cannot release himself from his own service.'),
          realm: char(o, h).player,
        },
        want: { told: true, realm: 0 },
      };
    },
  },
  {
    name: 'Release Hero: not while he leads companies',
    stage(b) {
      king(b);
      const h = leads(comrade(b), companies(2));
      return { hero: h, orders: [one(h, order('release'))] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          told: says(o, 'cannot be released while leading 2 units — transfer, garrison or disband the troops first.'),
          realm: char(o, h).player,
        },
        want: { told: true, realm: 0 },
      };
    },
  },
  {
    name: 'Release Hero: he leaves the realm’s service a wanderer, with what he carries, and his later orders are dropped',
    stage(b) {
      king(b);
      const h = holding(comrade(b), item(b, 'Ring of the Explorer'));
      return { hero: h, orders: [one(h, order('rest'), order('release'), order('explore'))] };
    },
    check(o, { hero: h }) {
      const c = char(o, h);
      const pl = must(o.world.players[0], 'realm 0');
      return {
        got: {
          realm: c.player,
          guard: c._isNeutralGuard,
          heroes: ((pl['heroes'] as number[] | undefined) ?? []).includes(h.id),
          pack: pack(o, h),
          releasedBy: c['_releasedBy'],
          releasedTurn: c['_releasedTurn'],
          served: c['_servedRealms'],
          told: says(
            o,
            /🕊 .* is released from .*'s service in .* and takes up the wanderer's life\. They take Ring of the Explorer with them\. They may be hired again from next turn\./,
          ),
          explored: says(o, 'explore'),
          // told in the phase he was released (Early Spring's is the second)
          phase: o.lines.find((l) => l.text.startsWith('🕊'))?.phase,
        },
        want: {
          realm: null,
          guard: false,
          heroes: false,
          pack: ['Ring of the Explorer'],
          releasedBy: 0,
          releasedTurn: o.turn,
          served: [0],
          told: true,
          explored: false,
          phase: 1,
        },
      };
    },
  },
  {
    name: 'Release Hero: his asking price is a wanderer’s, one gold and his skills’ worth',
    stage(b) {
      king(b);
      const h = comrade(b, { skills: { melee: 5, tactical: 5, march: 5, spy: 5, sage: 4 } });
      h['pay'] = 9;
      h['_hireAlignWage'] = 3;
      return { hero: h, orders: [one(h, order('release'))] };
    },
    check(o, { hero: h }) {
      const c = char(o, h);
      return { got: { pay: c['pay'], alignWage: c['_hireAlignWage'] }, want: { pay: 6, alignWage: undefined } };
    },
  },
];

// ── Disband Army ────────────────────────────────────────────────────────────────────────────────────────────────
interface Band {
  type: string;
  quality: string;
  unitName: string;
  isSea: boolean;
  id: string;
  location: number;
}
/** The bands of mercenaries after the turn, each as "<grade> <name> (<kind>)", " at sea" for a fleet. A band may
 *  retire at the turn's end (one in four, a die): a band named in `expected` that the turn's end told retired is
 *  listed as expected, so the list is the same whichever way the die fell. */
const bands = (o: Outcome, expected: string[] = []) => {
  const standing = ((o.world.mercenaries ?? []) as unknown as Band[]).map(
    (m) => `${m.quality} ${m.unitName} (${m.type})${m.isSea ? ' at sea' : ''}`,
  );
  const retired = expected.filter(
    (e) =>
      !standing.includes(e) &&
      o.all.some(
        (l) =>
          l.text.startsWith(
            `The mercenary band ${e
              .split(' ')
              .slice(1)
              .join(' ')
              .replace(/ \(.*$/, '')} in `,
          ) && l.text.endsWith(' has retired and dispersed.'),
      ),
  );
  return [...standing, ...retired].sort();
};
export const DISBAND_ARMY_ORDER_CASES: ItemAndArmyOrderCase[] = [
  {
    name: 'Disband Army: a hero with no companies has none to disband',
    stage(b) {
      const h = king(b);
      return { hero: h, orders: [one(h, order('disband_army', 'all'))] };
    },
    check(o) {
      return { got: { told: says(o, ': no armies to disband.') }, want: { told: true } };
    },
  },
  {
    name: 'Disband Army: “all” makes each company a band of mercenaries of its kind and grade, and he travels light',
    stage(b) {
      const h = leads(king(b), [
        ...companies(1, 'Men-at-Arms', 'Veteran'),
        ...companies(1, 'Free Lances', 'Green', 'Lances'),
      ]);
      return { hero: h, orders: [one(h, order('disband_army', 'all'))] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          led: led(o, h),
          bands: bands(o, ['Green Lances c0 (Free Lances)', 'Veteran Men-at-Arms c0 (Men-at-Arms)']),
          told: [
            says(o, `disbands Men-at-Arms c0 (Veteran) — they become a mercenary band in ${b0(o, h).name}.`),
            says(o, `disbands Lances c0 (Green) — they become a mercenary band in ${b0(o, h).name}.`),
          ],
          light: says(o, /has disbanded all armies — now travelling light \(land \d+, sea \d+ move points\)\./),
        },
        want: {
          led: [],
          bands: ['Green Lances c0 (Free Lances)', 'Veteran Men-at-Arms c0 (Men-at-Arms)'],
          told: [true, true],
          light: true,
        },
      };
    },
  },
  {
    name: 'Disband Army: companies named by kind or name, one each; with some kept there is no travelling light',
    stage(b) {
      const h = leads(king(b), [...companies(2, 'Yeoman Longbows'), ...companies(2)]);
      return { hero: h, orders: [one(h, order('disband_army', 'Yeoman Longbows,Men-at-Arms c1'))] };
    },
    check(o, { hero: h }) {
      const gone = ['Average Men-at-Arms c1 (Men-at-Arms)', 'Average Yeoman Longbows c0 (Yeoman Longbows)'];
      return {
        got: { led: led(o, h), bands: bands(o, gone), light: says(o, 'travelling light') },
        want: {
          led: ['Yeoman Longbows c1', 'Men-at-Arms c0'],
          bands: gone,
          light: false,
        },
      };
    },
  },
  {
    name: 'Disband Army: nothing that matches is nothing disbanded',
    stage(b) {
      const h = leads(king(b), companies(1));
      return { hero: h, orders: [one(h, order('disband_army', 'Free Lances'))] };
    },
    check(o, { hero: h }) {
      return {
        got: { told: says(o, ': could not find specified armies to disband.'), led: led(o, h), bands: bands(o) },
        want: { told: true, led: ['Men-at-Arms c0'], bands: [] },
      };
    },
  },
  {
    name: 'Disband Army: the risen dead return to their graves, no band',
    stage(b) {
      const h = leads(king(b), [skeletal(), ...companies(1)]);
      return { hero: h, orders: [one(h, order('disband_army', 'all'))] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          told: says(
            o,
            '💀 Bone Levy cannot be disbanded as mercenaries — skeletal armies return to their graves and crumble to dust.',
          ),
          led: led(o, h),
          bands: bands(o, ['Average Men-at-Arms c0 (Men-at-Arms)']),
        },
        want: { told: true, led: [], bands: ['Average Men-at-Arms c0 (Men-at-Arms)'] },
      };
    },
  },
  {
    name: 'Disband Army: a fleet becomes a band at sea',
    stage(b) {
      const h = leads(king(b), companies(1, 'Galleon Fleet'));
      return { hero: h, orders: [one(h, order('disband_army', 'all'))] };
    },
    check(o) {
      const fleet = 'Average Galleon Fleet c0 (Galleon Fleet) at sea';
      return { got: { bands: bands(o, [fleet]) }, want: { bands: [fleet] } };
    },
  },
  {
    name: 'Disband Army: a hero held by an enchantment will not break up companies not his own',
    wholeTurnOnly: true,
    stage(b) {
      const h = leads(king(b), companies(1));
      h['_charmTempControl'] = true;
      return { hero: h, orders: [one(h, order('disband_army', 'all'))] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          told: says(o, 'will not break up companies that are not theirs to disband'),
          led: led(o, h),
          bands: bands(o),
        },
        want: { told: true, led: ['Men-at-Arms c0'], bands: [] },
      };
    },
  },
];

// ── Pick Up Army ────────────────────────────────────────────────────────────────────────────────────────────────
const pickUp = (h: Character, target: string) => one(h, order('pickup_army', target));
/** The king in the middle (held by realm 0), with `units` in its garrison. */
const besideGarrison = (b: Board, units: Unit[], extra: Partial<HeroSpec> = {}) => {
  const h = king(b, extra);
  b.X.garrisonArmies = units;
  return h;
};
const leadsLine = (o: Outcome, n: number) =>
  says(o, new RegExp(`now leads ${String(n)} arm${n !== 1 ? 'ies' : 'y'}\\. Land MPs: \\d+, Sea MPs: \\d+\\.`));
export const PICKUP_ARMY_ORDER_CASES: ItemAndArmyOrderCase[] = [
  {
    name: 'Pick Up Army: “all” takes command of every company of the garrison',
    stage(b) {
      const h = leads(besideGarrison(b, companies(2, 'Shieldwall Levies', 'Average', 'Keep')), companies(1));
      return { hero: h, orders: [pickUp(h, 'all')] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          led: led(o, h).sort(),
          garrison: garrison(o, b0(o, h)),
          told: says(o, `takes command of all 2 garrisoned units in ${b0(o, h).name}.`),
          leads: leadsLine(o, 3),
        },
        want: { led: ['Keep c0', 'Keep c1', 'Men-at-Arms c0'], garrison: [], told: true, leads: true },
      };
    },
  },
  {
    name: 'Pick Up Army: “all” with no garrison finds none',
    stage(b) {
      const h = besideGarrison(b, []);
      return { hero: h, orders: [pickUp(h, 'all')] };
    },
    check(o, { hero: h }) {
      return {
        got: { told: says(o, `finds no garrison armies in ${b0(o, h).name} to pick up.`), leads: says(o, 'now leads') },
        want: { told: true, leads: false },
      };
    },
  },
  {
    name: 'Pick Up Army: a band of mercenaries is hired by Recruit Armies, not picked up',
    stage(b) {
      const h = besideGarrison(b, companies(1, 'Shieldwall Levies', 'Average', 'Keep'));
      return { hero: h, orders: [pickUp(h, 'merc:merc_1')] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          told: says(
            o,
            'cannot simply take up a mercenary band with a Pick Up order — mercenaries are hired through Recruit Armies.',
          ),
          led: led(o, h),
        },
        want: { told: true, led: [] },
      };
    },
  },
  {
    name: 'Pick Up Army: companies of the garrison chosen by their places',
    stage(b) {
      const h = besideGarrison(b, companies(3, 'Shieldwall Levies', 'Average', 'Keep'));
      // the first place named twice: taken twice, the second would be the company behind it
      return { hero: h, orders: [pickUp(h, 'g:0,g:2,g:0')] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          led: led(o, h),
          garrison: garrison(o, b0(o, h)),
          told: says(
            o,
            `takes command of Keep c2 (Average Shieldwall Levies), Keep c0 (Average Shieldwall Levies) from the garrison in ${b0(o, h).name}.`,
          ),
          leads: leadsLine(o, 2),
        },
        want: { led: ['Keep c2', 'Keep c0'], garrison: ['Keep c1'], told: true, leads: true },
      };
    },
  },
  {
    name: 'Pick Up Army: places the garrison does not have find nothing',
    stage(b) {
      const h = besideGarrison(b, companies(1, 'Shieldwall Levies', 'Average', 'Keep'));
      return { hero: h, orders: [pickUp(h, 'g:4')] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          told: says(o, `finds no matching garrison armies in ${b0(o, h).name} to pick up.`),
          garrison: garrison(o, b0(o, h)),
        },
        want: { told: true, garrison: ['Keep c0'] },
      };
    },
  },
  {
    name: 'Pick Up Army: from a comrade beside him (an old order), his last company',
    stage(b) {
      const h = king(b);
      const r = leads(comrade(b), companies(2));
      return { hero: h, orders: [pickUp(h, place(b, r))], other: r };
    },
    check(o, { hero: h, other: r }) {
      const c = must(r, 'the comrade');
      return {
        got: {
          led: led(o, h),
          left: led(o, c),
          told: says(o, `takes command of Men-at-Arms c1 (Average Men-at-Arms) from ${c.name}.`),
        },
        want: { led: ['Men-at-Arms c1'], left: ['Men-at-Arms c0'], told: true },
      };
    },
  },
  {
    name: 'Pick Up Army: not from a comrade elsewhere, a fallen one or another realm’s hero',
    stage(b) {
      const h = king(b);
      const far = leads(comrade(b, { at: ring1(b, 1) }), companies(1));
      return { hero: h, orders: [one(h, order('pickup_army', place(b, far)))], other: far };
    },
    check(o, { hero: h, other: r }) {
      return {
        got: { told: says(o, /: cannot pick up army\.$/m), led: led(o, h), left: led(o, must(r, 'the comrade')) },
        want: { told: true, led: [], left: ['Men-at-Arms c0'] },
      };
    },
  },
  {
    name: 'Pick Up Army: “-1” (an old order) takes the garrison’s last company',
    stage(b) {
      const h = besideGarrison(b, companies(2, 'Shieldwall Levies', 'Average', 'Keep'));
      return { hero: h, orders: [pickUp(h, '-1')] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          led: led(o, h),
          garrison: garrison(o, b0(o, h)),
          told: says(o, `picks up Keep c1 (Average Shieldwall Levies) from the garrison in ${b0(o, h).name}.`),
        },
        want: { led: ['Keep c1'], garrison: ['Keep c0'], told: true },
      };
    },
  },
  {
    name: 'Pick Up Army: “-1” with no garrison finds none',
    stage(b) {
      const h = besideGarrison(b, []);
      return { hero: h, orders: [pickUp(h, '-1')] };
    },
    check(o, { hero: h }) {
      return {
        got: { told: says(o, `finds no garrison armies in ${b0(o, h).name} to pick up.`), leads: says(o, 'now leads') },
        want: { told: true, leads: false },
      };
    },
  },
  {
    name: 'Pick Up Army: beasts beyond his Druid go back to the garrison',
    stage(b) {
      const h = besideGarrison(b, [...companies(1), ...companies(3, 'Great Bears')], { skills: druid(2) });
      leads(h, companies(1, 'Great Bears', 'Average', 'Own Bears'));
      return { hero: h, orders: [pickUp(h, 'all')] };
    },
    check(o, { hero: h }) {
      return {
        got: {
          led: led(o, h).sort(),
          garrison: garrison(o, b0(o, h)).sort(),
          told: says(
            o,
            `🐾 ${h.name} can lead only 2 Creature or Monster units (Druid 2): Great Bears c1, Great Bears c0 stay in the garrison of ${b0(o, h).name}.`,
          ),
        },
        want: {
          led: ['Great Bears c2', 'Men-at-Arms c0', 'Own Bears c0'],
          garrison: ['Great Bears c0', 'Great Bears c1'],
          told: true,
        },
      };
    },
  },
  {
    name: 'Pick Up Army: a beast beyond his Druid goes back to the comrade it came from',
    stage(b) {
      const h = king(b);
      const r = leads(comrade(b, { skills: druid(1) }), companies(1, 'Great Bears'));
      return { hero: h, orders: [pickUp(h, place(b, r))], other: r };
    },
    check(o, { hero: h, other: r }) {
      const c = must(r, 'the comrade');
      return {
        got: {
          led: led(o, h),
          left: led(o, c),
          told: says(
            o,
            `🐾 ${h.name} can lead only 0 Creature or Monster units (Druid 0): Great Bears c0 stays with ${c.name}.`,
          ),
        },
        want: { led: [], left: ['Great Bears c0'], told: true },
      };
    },
  },
  {
    name: 'Pick Up Army: on open water he takes aboard only what his ships can carry',
    stage(b) {
      const sea = openSea(b);
      b.own(sea, 0);
      const h = leads(king(b, { at: sea }), companies(1, 'Galleon Fleet'));
      b.own(b.X, null);
      // Men-at-Arms are light foot: a ship carries two
      sea.garrisonArmies = companies(3, 'Men-at-Arms', 'Average', 'Marines');
      return { hero: h, orders: [pickUp(h, 'all')], there: sea };
    },
    check(o, { hero: h, there }) {
      const sea = must(there, 'the sea');
      return {
        got: {
          led: led(o, h).sort(),
          garrison: garrison(o, sea),
          told: says(
            o,
            `⚓ Marines c0 (Average Men-at-Arms) cannot be taken aboard — ${h.name}'s ships have no room for them on open water, so it stays in the garrison of ${sea.name}.`,
          ),
        },
        want: { led: ['Galleon Fleet c0', 'Marines c1', 'Marines c2'], garrison: ['Marines c0'], told: true },
      };
    },
  },
];

/** Stages `c` on `b`, from plain realms. */
export const stageCase = (b: Board, c: ItemAndArmyOrderCase): Staged => {
  plainRealms(b);
  b.G.players.forEach((pl) => {
    pl['heroes'] = [];
  });
  return c.stage(b);
};

/** Every case, by order. */
export const ITEM_AND_ARMY_ORDER_CASES: [string, ItemAndArmyOrderCase[]][] = [
  ['equip_items', EQUIP_ITEMS_ORDER_CASES],
  ['use_item', USE_ITEM_ORDER_CASES],
  ['give_item', SEND_ITEM_ORDER_CASES],
  ['leave_army', LEAVE_ARMY_ORDER_CASES],
  ['release', RELEASE_ORDER_CASES],
  ['disband_army', DISBAND_ARMY_ORDER_CASES],
  ['pickup_army', PICKUP_ARMY_ORDER_CASES],
];
