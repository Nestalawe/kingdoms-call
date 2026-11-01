// The explore and search orders' cases (plan P1-08j2): Explore, Perform Rite, Hunting Rumours, Search Lair, Chart the
// Unknown (Explorer 7) and Discover Lost Ruin (Explorer 9), staged on the middle of a bot world
// (lib/middle-of-a-bot-world.ts), each with what must be true after it in game terms.
// scenario/explore-and-search-orders-in-a-whole-turn.test.ts plays each through a whole turn (resolveTurn);
// unit/explore-and-search-orders-called-directly.test.ts calls each order's own function on them, one phase at a time.
// A case stages its world and the hero's five orders; after them, it reads what it needs from the world and the log
// (`got`) beside what must be so (`want`), and the test compares the two. Every outcome is certain: no case leans on
// the dice (a hero who fights a guardian is overwhelming, or overwhelmed; an Explore's share is fixed by the terrain and
// the hero's Explorer skill, and only one Explore is played, so a skill rise from it can't change the next).
import vm from 'node:vm';
import {
  hero,
  must,
  order,
  plan,
  type Board,
  type Character,
  type Line,
  type Order,
  type Province,
  type Unit,
  type World,
} from './middle-of-a-bot-world.ts';

export interface Staged {
  /** The hero whose orders are played. */
  hero: Character;
  orders: Order[];
  /** Where the hero stands. */
  here: Province;
  /** Another province the case needs (a neighbour charted, a lair next door). */
  there?: Province;
  /** A province out of reach (two away). */
  far?: Province;
  /** The provinces bordering `here`, as the board found them. */
  around?: Province[];
}
export interface Outcome {
  world: World;
  /** The hero's own lines in the log. */
  lines: Line[];
  /** The turn the orders were played in. */
  turn: number;
}
export interface ExploreAndSearchOrderCase {
  name: string;
  /** Plays only in a whole turn: processOrder refuses or changes the order before the order's own function runs. */
  wholeTurnOnly?: boolean;
  stage(b: Board): Staged;
  /** What the case found after the orders, and what it should have found: the same keys. */
  check(o: Outcome, s: Staged): { got: Record<string, unknown>; want: Record<string, unknown> };
}

/** A lair's guardian, made up for the tests. */
export interface Guardian {
  name: string;
  cat: string;
  desc: string;
  hp: number;
  power: string;
  melee: number;
  archery: number;
  speed: string;
  minG: number;
  maxG: number;
  spells: unknown[];
  passives: unknown[];
  weak?: { kind: string; key: string; name: string; desc: string };
  [key: string]: unknown;
}
/** A lair (or a ritual site) in a province's `features`. */
export interface Feature {
  name: string;
  tier?: string;
  monster: Guardian | null;
  ritualSite?: boolean;
  discovered: boolean;
  discoveredBy?: number[];
  cleared: boolean;
  treasure: number;
  hoardItems?: Record<string, unknown>[];
  _hidden?: boolean;
  _hiddenBy?: number;
  [key: string]: unknown;
}

/** A guardian of `power`: a feeble one (1 HP, no blows worth the name) unless `strong`, then a giant no hero
 *  survives. Its weakness is Fire. */
export const guardian = (power: string, { strong = false } = {}): Guardian => ({
  name: strong ? 'Barrow Colossus' : 'Marsh Rat',
  cat: strong ? 'giant' : 'vermin',
  desc: 'made up for the tests',
  hp: strong ? 400 : 1,
  power,
  melee: strong ? 9 : 0,
  archery: 0,
  speed: 'slow',
  minG: strong ? 9 : 1,
  maxG: strong ? 12 : 1,
  spells: [],
  passives: [],
  weak: { kind: 'school', key: 'elemental', name: 'Fears the Flame', desc: 'fire drives it off' },
});
/** A lair of `power` holding exactly `gold` and the given magic, its hoard already settled (no die decides it). */
export const lair = (
  name: string,
  power: string,
  { gold = 6, items = [] as Record<string, unknown>[], strong = false } = {},
): Feature => ({
  name,
  tier: power,
  monster: guardian(power, { strong }),
  discovered: false,
  cleared: false,
  treasure: gold,
  _hoardV2: true,
  _hoardGoldOrig: gold,
  hoardItems: items,
});
/** A ritual site of the old gods. */
export const ritualSite = (name = 'Circle of Test Stones'): Feature => ({
  name,
  ritualSite: true,
  monster: null,
  discovered: false,
  cleared: false,
  treasure: 0,
});
/** A real magic item of the game's (or the Mithril Armour), by name, as a hoard holds it. */
export const magicItem = (b: Board, name: string): Record<string, unknown> => {
  const json = vm.runInContext(
    `JSON.stringify([...ALL_MAGIC_ITEMS_P, MITHRIL_ARMOUR].find(i=>i.name===${JSON.stringify(name)}))`,
    b.engine,
  ) as string | undefined;
  return { ...(JSON.parse(must(json, 'the item ' + name)) as Record<string, unknown>), id: 7000 };
};
/** `n` companies of `type` of `quality` (a real tier: Green, Average, Veteran, Crack, Elite). */
export const companies = (n: number, quality = 'Average', type = 'Men-at-Arms'): Unit[] =>
  Array.from({ length: n }, (_, k) => ({ type, quality, race: 'Human', unitName: `${type} c${String(k)}` }));

const text = (o: Outcome) => o.lines.map((l) => l.text).join('\n');
/** Whether the hero's lines say `what` (a string, or a pattern). */
const says = (o: Outcome, what: string | RegExp) =>
  typeof what === 'string' ? text(o).includes(what) : what.test(text(o));
const province = (o: Outcome, p: Province) => must(o.world.world.provinces[p.id], 'province ' + p.name);
const char = (o: Outcome, c: Character) =>
  must(
    o.world.characters.find((x) => x.id === c.id),
    'hero ' + c.name,
  );
const features = (o: Outcome, p: Province) => (province(o, p)['features'] ?? []) as Feature[];
const feature = (o: Outcome, p: Province, i: number) => must(features(o, p)[i], `feature ${String(i)} of ${p.name}`);
/** How much of `p` realm 0 has mapped. */
const mapped = (o: Outcome, p: Province) =>
  ((province(o, p)['exploredBy'] ?? {}) as Record<string, number | undefined>)['0'] ?? 0;
/** Whether realm 0 knows of the feature. */
const known = (f: Feature) => (f.discoveredBy ?? []).includes(0);
const realm = (o: Outcome, i: number) => must(o.world.players[i], 'realm ' + String(i));
const ring1 = (b: Board, i: number) => must(b.ring1[i], 'a neighbour of the middle');
const ring2 = (b: Board, i: number) => must(b.ring2[i], 'a province two away');
/** Lairs and sites in `p`, and nothing of `p` mapped yet by anyone. */
const withFeatures = (p: Province, ...fs: Feature[]) => {
  p['features'] = fs;
  p['exploredBy'] = {};
  p['explored'] = 0;
};
const skilled = (skills: Record<string, number>) => ({ melee: 2, tactical: 2, march: 1, spy: 0, ...skills });
/** A hero of realm 0 standing in the middle, at full health. His maximum HP is the turn's own reckoning of it (15 to
 *  start, and what he has earned), so the turn keeps it as staged. */
const at = (b: Board, extra: Partial<Parameters<typeof hero>[1]> = {}) => {
  const h = hero(b, { player: 0, at: b.X, ...extra });
  h['hpEarned'] = Math.max(0, h.maxHp - 15);
  return h;
};
/** Realm 0 keeps the old faith (Pagan), and holds the middle province. */
const paganHolding = (b: Board) => {
  must(b.G.players[0], 'realm 0')['alignment'] = 'Pagan';
  b.own(b.X, 0);
};
const qualities = (c: Character) => c.armies.map((a) => a.quality);
const unitNames = (c: Character) => c.armies.map((a) => a.unitName);

export const EXPLORE_ORDER_CASES: ExploreAndSearchOrderCase[] = [
  {
    name: 'Explore: a hero with no Explorer skill maps 35% of open plain, the plain rate',
    stage(b) {
      withFeatures(b.X);
      return { hero: at(b), here: b.X, orders: plan(order('explore')) };
    },
    check(o, { here }) {
      return {
        got: {
          mapped: mapped(o, here),
          told: says(o, `explores ${here.name} (+35%, now 35% mapped). The province is becoming well-known.`),
        },
        want: { mapped: 35, told: true },
      };
    },
  },
  {
    name: "Explore: lairs come to light in turn as the map fills: at 70% of two, only the first (Explorer 1, twice the plain's rate)",
    stage(b) {
      withFeatures(b.X, lair('Drowned Mill', 'Weak'), lair('Old Sluice', 'Weak'));
      return { hero: at(b, { skills: skilled({ explorer: 1 }) }), here: b.X, orders: plan(order('explore')) };
    },
    check(o, { here }) {
      return {
        got: {
          mapped: mapped(o, here),
          known: features(o, here).map(known),
          told: says(
            o,
            `explores ${here.name} (+70%, now 70% mapped) and discovers the Drowned Mill! Legend says it is guarded by a Marsh Rat.`,
          ),
        },
        want: { mapped: 70, known: [true, false], told: true },
      };
    },
  },
  {
    name: 'Explore: a master Explorer (5) maps all of it at once, and finds a lair and a ritual site together',
    stage(b) {
      withFeatures(b.X, lair('Drowned Mill', 'Weak'), ritualSite());
      return { hero: at(b, { skills: skilled({ explorer: 5 }) }), here: b.X, orders: plan(order('explore')) };
    },
    check(o, { here, hero: h }) {
      return {
        got: {
          mapped: mapped(o, here),
          known: features(o, here).map(known),
          merits: (char(o, h)['merits'] as number) >= 2,
          told: says(
            o,
            `explores ${here.name} (+100%, now 100% mapped) and uncovers 2 sites: the Drowned Mill (guarded by a Marsh Rat) and the Circle of Test Stones (a ritual site).`,
          ),
        },
        want: { mapped: 100, known: [true, true], merits: true, told: true },
      };
    },
  },
  {
    name: "Explore: a rival's veiling illusion keeps its lair hidden, and the hero is told something clouds the search",
    stage(b) {
      const veiled = { ...lair('Drowned Mill', 'Weak'), _hidden: true, _hiddenBy: 1 };
      withFeatures(b.X, veiled);
      return { hero: at(b, { skills: skilled({ explorer: 5 }) }), here: b.X, orders: plan(order('explore')) };
    },
    check(o, { here }) {
      return {
        got: {
          mapped: mapped(o, here),
          known: features(o, here).map(known),
          clouded: says(o, `Something clouds `),
          told: says(o, `explores ${here.name} (+100%, now 100% mapped). The province is thoroughly explored.`),
        },
        want: { mapped: 100, known: [false], clouded: true, told: true },
      };
    },
  },
];

export const RITE_ORDER_CASES: ExploreAndSearchOrderCase[] = [
  {
    name: 'Perform Rite: a realm that does not keep the old faith may not',
    stage(b) {
      must(b.G.players[0], 'realm 0')['alignment'] = 'Divine';
      b.own(b.X, 0);
      withFeatures(b.X, ritualSite());
      const h = at(b);
      h.armies = companies(3);
      return { hero: h, here: b.X, orders: plan(order('rite', '', 'S:0|E:1')) };
    },
    check(o, { hero: h }) {
      return {
        got: { qualities: qualities(char(o, h)), refused: says(o, 'only Pagan realms may perform rites') },
        want: { qualities: ['Average', 'Average', 'Average'], refused: true },
      };
    },
  },
  {
    name: 'Perform Rite: stones in a province not your own must be found first',
    stage(b) {
      must(b.G.players[0], 'realm 0')['alignment'] = 'Pagan';
      withFeatures(b.X, ritualSite());
      const h = at(b);
      h.armies = companies(3);
      return { hero: h, here: b.X, orders: plan(order('rite', '', 'S:0|E:1')) };
    },
    check(o, { hero: h, here }) {
      return {
        got: {
          qualities: qualities(char(o, h)),
          refused: says(o, `finds no ritual site in ${here.name}`),
        },
        want: { qualities: ['Average', 'Average', 'Average'], refused: true },
      };
    },
  },
  {
    name: 'Perform Rite: stones found in a province not your own will answer',
    stage(b) {
      must(b.G.players[0], 'realm 0')['alignment'] = 'Pagan';
      withFeatures(b.X, { ...ritualSite(), discovered: true, discoveredBy: [0] });
      const h = at(b);
      h.armies = companies(3);
      return { hero: h, here: b.X, orders: plan(order('rite', '', 'S:0|E:1')) };
    },
    check(o, { hero: h }) {
      return {
        got: {
          qualities: qualities(char(o, h)),
          offered: says(o, 'makes a Blood Offering at the Circle of Test Stones'),
        },
        want: { qualities: ['Crack', 'Average'], offered: true },
      };
    },
  },
  {
    name: 'Blood Offering as named: the companies given are gone and leave graves, and as many others rise two tiers',
    stage(b) {
      paganHolding(b);
      withFeatures(b.X, ritualSite());
      const h = at(b);
      h.armies = companies(4);
      return { hero: h, here: b.X, orders: plan(order('rite', 'blood', 'S:0,1|E:3,2')) };
    },
    check(o, { hero: h, here }) {
      const c = char(o, h);
      // a grave can rot at the turn's end (one in ten a turn): those left are the companies given
      const graves = (province(o, here)['battleGraves'] ?? []) as { unitName: string }[];
      return {
        got: {
          left: unitNames(c),
          qualities: qualities(c),
          graves: graves.every((g) => ['Men-at-Arms c0', 'Men-at-Arms c1'].includes(g.unitName)),
          stonesSpent: province(o, here)['_riteTurn'] === o.turn,
          told: says(
            o,
            'Men-at-Arms c0, Men-at-Arms c1 (2 units) are given to the old gods, and their strength passes to Men-at-Arms c3 (rise to Crack), Men-at-Arms c2 (rise to Crack)',
          ),
        },
        want: {
          left: ['Men-at-Arms c2', 'Men-at-Arms c3'],
          qualities: ['Crack', 'Crack'],
          graves: true,
          stonesSpent: true,
          told: true,
        },
      };
    },
  },
  {
    name: 'Blood Offering with nothing named: the first company is given and the second rises, no higher than Elite',
    stage(b) {
      paganHolding(b);
      withFeatures(b.X, ritualSite());
      const h = at(b);
      h.armies = [...companies(1, 'Green'), ...companies(1, 'Crack').map((u) => ({ ...u, unitName: 'Old Guard' }))];
      return { hero: h, here: b.X, orders: plan(order('rite')) };
    },
    check(o, { hero: h }) {
      const c = char(o, h);
      return {
        got: { left: unitNames(c), qualities: qualities(c) },
        want: { left: ['Old Guard'], qualities: ['Elite'] },
      };
    },
  },
  {
    name: "Blood Offering needs two of the hero's own companies: a beast bound by the Wild Hunt doesn't count",
    stage(b) {
      paganHolding(b);
      withFeatures(b.X, ritualSite());
      const h = at(b);
      const bound = { ...must(companies(1)[0], 'a company'), unitName: 'Bound', _wildHuntUntilTurn: 99 };
      h.armies = [...companies(1), bound];
      return { hero: h, here: b.X, orders: plan(order('rite', '', 'S:0|E:1')) };
    },
    check(o, { hero: h }) {
      return {
        got: { left: unitNames(char(o, h)), refused: says(o, 'makes no Blood Offering') },
        want: { left: ['Men-at-Arms c0', 'Bound'], refused: true },
      };
    },
  },
  {
    name: 'the stones answer once a turn: a second rite in the same province is refused',
    stage(b) {
      paganHolding(b);
      withFeatures(b.X, ritualSite());
      const h = at(b);
      h.armies = companies(4);
      return { hero: h, here: b.X, orders: plan(order('rite', '', 'S:0|E:1'), order('rite', '', 'S:2|E:3')) };
    },
    check(o, { hero: h }) {
      return {
        got: {
          qualities: qualities(char(o, h)),
          refused: says(o, 'the stones have already answered once this turn'),
        },
        want: { qualities: ['Crack', 'Average', 'Average'], refused: true },
      };
    },
  },
  {
    name: "the Wild Hunt binds two Veteran beasts of the province's own kind, until the end of next turn, for one beast's price",
    stage(b) {
      paganHolding(b);
      withFeatures(b.X, ritualSite());
      b.X['armyTypes'] = ['Mammoth Host'];
      b.X['race'] = 'Primal:Mammoth';
      must(b.G.players[0], 'realm 0')['gold'] = 40;
      const h = at(b);
      h.armies = companies(1);
      return { hero: h, here: b.X, orders: plan(order('rite', 'wild')) };
    },
    check(o, { hero: h, here }) {
      const bound = char(o, h).armies.filter((a) => a.type === 'Mammoth Host');
      return {
        got: {
          bound: bound.map((a) => [a.quality, a['_wildHuntUntilTurn']]),
          stonesSpent: province(o, here)['_riteTurn'] === o.turn,
          told: says(o, /performs the Rite of the Wild Hunt at the Circle of Test Stones \(5g /),
        },
        want: {
          bound: [
            ['Veteran', o.turn + 1],
            ['Veteran', o.turn + 1],
          ],
          stonesSpent: true,
          told: true,
        },
      };
    },
  },
  {
    // no game of the balance matrix meets The Long Hunt (plan P1-19ad: its effect in the discoveries' registry)
    name: "The Long Hunt keeps the Wild Hunt's beasts a turn longer",
    stage(b) {
      paganHolding(b);
      withFeatures(b.X, ritualSite());
      b.X['armyTypes'] = ['Mammoth Host'];
      b.X['race'] = 'Primal:Mammoth';
      const realm = must(b.G.players[0], 'realm 0');
      realm['gold'] = 40;
      realm['discoveries'] = [{ id: 'ap08' }];
      const h = at(b);
      h.armies = companies(1);
      return { hero: h, here: b.X, orders: plan(order('rite', 'wild')) };
    },
    check(o, { hero: h }) {
      const bound = char(o, h).armies.filter((a) => a.type === 'Mammoth Host');
      return {
        got: { bound: bound.map((a) => a['_wildHuntUntilTurn']) },
        want: { bound: [o.turn + 2, o.turn + 2] },
      };
    },
  },
  {
    name: 'the Wild Hunt needs wild creatures: where none roam, nothing answers',
    stage(b) {
      paganHolding(b);
      withFeatures(b.X, ritualSite());
      b.X['armyTypes'] = ['Men-at-Arms'];
      must(b.G.players[0], 'realm 0')['gold'] = 40;
      const h = at(b);
      h.armies = companies(1);
      return { hero: h, here: b.X, orders: plan(order('rite', 'wild')) };
    },
    check(o, { hero: h }) {
      return {
        got: { left: unitNames(char(o, h)), refused: says(o, 'but nothing wild answers') },
        want: { left: ['Men-at-Arms c0'], refused: true },
      };
    },
  },
];

export const HUNT_RUMOURS_ORDER_CASES: ExploreAndSearchOrderCase[] = [
  {
    name: 'Hunting Rumours: with no lair known here, nobody has anything to tell',
    stage(b) {
      withFeatures(b.X, lair('Drowned Mill', 'Weak'));
      return { hero: at(b), here: b.X, orders: plan(order('hunt_rumours', '0')) };
    },
    check(o) {
      return {
        got: { told: says(o, 'no one has anything to tell'), paid: says(o, 'buys the talk') },
        want: { told: true, paid: false },
      };
    },
  },
  {
    name: 'Hunting Rumours on a known lair: its weakness learned for good, its hoard remembered, the hero told his chances',
    stage(b) {
      const f = {
        ...lair('Drowned Mill', 'Weak', { gold: 7, items: [magicItem(b, 'Boots of the Wind')] }),
        discoveredBy: [0],
      };
      withFeatures(b.X, f);
      must(b.G.players[0], 'realm 0')['gold'] = 40;
      return {
        hero: at(b, { skills: skilled({ melee: 5 }), hp: 40 }),
        here: b.X,
        orders: plan(order('hunt_rumours', '0')),
      };
    },
    check(o, { hero: h, here }) {
      const r = realm(o, 0);
      const rumour = ((r['_lairRumours'] ?? {}) as Record<string, { gold: number; items: string[] } | undefined>)[
        `${String(here.id)}:0`
      ];
      const odds = ((feature(o, here, 0)['_rumourOdds'] ?? {}) as Record<string, { charId: number } | undefined>)['0'];
      return {
        got: {
          weakness: ((r['_knownWeak'] ?? {}) as Record<string, boolean>)['Marsh Rat'],
          hoard: rumour && { gold: rumour.gold, items: rumour.items },
          oddsFor: odds?.charId,
          paid: says(o, '1g buys the talk of the Drowned Mill — Marsh Rat (Vermin), a weak guardian.'),
          weakTold: says(o, 'Its weakness: Fears the Flame — fire drives it off. Your realm marks every Marsh Rat'),
          hoardTold: says(o, 'Its hoard: the Marsh Rat sits on exactly 7g, and '),
          chances: says(o, 'Your chances: as you stand today, '),
        },
        want: {
          weakness: true,
          hoard: { gold: 7, items: ['Boots of the Wind'] },
          oddsFor: h.id,
          paid: true,
          weakTold: true,
          hoardTold: true,
          chances: true,
        },
      };
    },
  },
  {
    name: 'Hunting Rumours: a lair the realm has mapped enough of to see on its map counts as known',
    stage(b) {
      withFeatures(b.X, lair('Drowned Mill', 'Weak'), lair('Old Sluice', 'Moderate'));
      b.X['exploredBy'] = { 0: 50 };
      must(b.G.players[0], 'realm 0')['gold'] = 40;
      return { hero: at(b), here: b.X, orders: plan(order('hunt_rumours', '0,1')) };
    },
    check(o) {
      return {
        got: {
          hunts: says(o, 'hunting rumours of 1 lair.'),
          first: says(o, 'buys the talk of the Drowned Mill'),
          second: says(o, 'the Old Sluice'),
        },
        want: { hunts: true, first: true, second: false },
      };
    },
  },
  {
    name: 'Hunting Rumours: a ritual site and a cleared lair have no rumours to buy',
    stage(b) {
      withFeatures(
        b.X,
        { ...ritualSite(), discoveredBy: [0] },
        { ...lair('Drowned Mill', 'Weak'), discoveredBy: [0], cleared: true },
      );
      must(b.G.players[0], 'realm 0')['gold'] = 40;
      return { hero: at(b), here: b.X, orders: plan(order('hunt_rumours', '0,1')) };
    },
    check(o) {
      return {
        got: { told: says(o, 'no one has anything to tell') },
        want: { told: true },
      };
    },
  },
];

export const SEARCH_ORDER_CASES: ExploreAndSearchOrderCase[] = [
  {
    name: 'Search Lair: a province with no lairs holds nothing of note',
    stage(b) {
      withFeatures(b.X);
      return { hero: at(b), here: b.X, orders: plan(order('search', '0')) };
    },
    check(o, { here }) {
      return {
        got: { told: says(o, `searches ${here.name} but finds nothing of note.`) },
        want: { told: true },
      };
    },
  },
  {
    name: "Search Lair: a lair named that isn't here: the hero goes into no other",
    stage(b) {
      withFeatures(b.X, lair('Drowned Mill', 'Weak'));
      return { hero: at(b), here: b.X, orders: plan(order('search', '3')) };
    },
    check(o, { here }) {
      return {
        got: { told: says(o, 'but it is not here.'), mill: feature(o, here, 0).cleared },
        want: { told: true, mill: false },
      };
    },
  },
  {
    name: 'Search Lair: a ritual site holds nothing to fight; the stones hum, and a Pagan is told he may perform rites',
    stage(b) {
      must(b.G.players[0], 'realm 0')['alignment'] = 'Pagan';
      withFeatures(b.X, ritualSite());
      return { hero: at(b), here: b.X, orders: plan(order('search', '0')) };
    },
    check(o) {
      return {
        got: { told: says(o, 'The old stones hum with something older than realms — a Pagan may Perform Rites here') },
        want: { told: true },
      };
    },
  },
  {
    name: 'Search Lair: a lair already cleared is only revisited',
    stage(b) {
      withFeatures(b.X, { ...lair('Drowned Mill', 'Weak'), cleared: true });
      return { hero: at(b), here: b.X, orders: plan(order('search', '0')) };
    },
    check(o, { here }) {
      return {
        got: { told: says(o, `revisits the cleared Drowned Mill in ${here.name}.`) },
        want: { told: true },
      };
    },
  },
  {
    name: 'Search Lair: an overwhelming hero clears a lair: it is cleared and known, and its gold and magic are his',
    stage(b) {
      withFeatures(b.X, lair('Drowned Mill', 'Weak', { gold: 7, items: [magicItem(b, 'Boots of the Wind')] }));
      const h = at(b, { skills: skilled({ melee: 9 }), hp: 60 });
      return { hero: h, here: b.X, orders: plan(order('search', '0')) };
    },
    check(o, { hero: h, here }) {
      const f = feature(o, here, 0);
      return {
        got: {
          cleared: f.cleared,
          known: known(f),
          hoardLeft: [f.treasure, f.hoardItems?.length],
          items: char(o, h).items.map((i) => i['name']),
          told: says(o, 'Victory! Hero ' + String(h.id) + ' claims 7g from the Drowned Mill and hauls out'),
        },
        want: { cleared: true, known: true, hoardLeft: [0, 0], items: ['Boots of the Wind'], told: true },
      };
    },
  },
  {
    name: 'Search Lair: a hero slain by the guardian leaves his magic in its hoard',
    stage(b) {
      withFeatures(b.X, lair('Drowned Mill', 'Legendary', { gold: 40, strong: true }));
      // A blow from a guardian takes at most half a hero's maximum HP, and the giant's always takes that much: from
      // full health (16), a Brave hero, who wards off nothing, falls to the second blow, and after the first he is not
      // hurt enough to break off or find a second wind.
      const h = at(b, { skills: skilled({ melee: 0 }), hp: 16 });
      h['temper'] = 'Brave';
      h.items = [{ ...magicItem(b, 'Boots of the Wind'), equipped: true }];
      // his king, to whom a fallen hero's possessions would pass if they weren't the guardian's
      hero(b, { player: 0, at: ring2(b, 0), king: true });
      return { hero: h, here: b.X, orders: plan(order('search', '0')) };
    },
    check(o, { hero: h, here }) {
      const f = feature(o, here, 0);
      return {
        got: {
          alive: char(o, h).alive,
          hoard: (f.hoardItems ?? []).map((i) => i['name']),
          carriedByAnyone: o.world.characters.flatMap((c) => c.items).filter((i) => i['name'] === 'Boots of the Wind')
            .length,
          cleared: f.cleared,
          slain: says(o, 'has been slain by the Barrow Colossus!'),
        },
        want: { alive: false, hoard: ['Boots of the Wind'], carriedByAnyone: 0, cleared: false, slain: true },
      };
    },
  },
  {
    name: 'Search Lair: a hero slain by the guardian leaves his magic in its hoard, but not his Mithril Armour (a granted suit)',
    stage(b) {
      withFeatures(b.X, lair('Drowned Mill', 'Legendary', { gold: 40, strong: true }));
      // as the case above, with a Mithril suit among his things (in the pack: a worn suit would turn some of the giant's blows)
      const h = at(b, { skills: skilled({ melee: 0 }), hp: 16 });
      h['temper'] = 'Brave';
      h.items = [{ ...magicItem(b, 'Boots of the Wind'), equipped: true }, magicItem(b, 'Mithril Armour')];
      hero(b, { player: 0, at: ring2(b, 0), king: true });
      return { hero: h, here: b.X, orders: plan(order('search', '0')) };
    },
    check(o, { hero: h, here }) {
      const f = feature(o, here, 0);
      return {
        got: {
          alive: char(o, h).alive,
          hoard: (f.hoardItems ?? []).map((i) => i['name']),
          suitsInTheWorld: o.world.characters.flatMap((c) => c.items).filter((i) => i['name'] === 'Mithril Armour')
            .length,
          told: says(o, ' — Boots of the Wind now lie among the bones, waiting for a stronger hand.'),
        },
        want: { alive: false, hoard: ['Boots of the Wind'], suitsInTheWorld: 0, told: true },
      };
    },
  },
  {
    name: 'Search Lair: a search written for another province is abandoned, and the hero rests instead',
    wholeTurnOnly: true,
    stage(b) {
      withFeatures(b.X, lair('Drowned Mill', 'Weak'));
      const there = ring1(b, 0);
      return {
        hero: at(b),
        here: b.X,
        there,
        orders: plan({ ...order('search', '0'), prov: String(there.id) } as Order),
      };
    },
    check(o, { here }) {
      return {
        got: {
          abandoned: says(o, 'the search is abandoned and they rest instead.'),
          mill: feature(o, here, 0).cleared,
        },
        want: { abandoned: true, mill: false },
      };
    },
  },
];

export const CHART_THE_UNKNOWN_ORDER_CASES: ExploreAndSearchOrderCase[] = [
  {
    name: 'Chart the Unknown: refused without the Explorer mastery (7)',
    stage(b) {
      withFeatures(b.X, lair('Drowned Mill', 'Weak'));
      return { hero: at(b, { skills: skilled({ explorer: 6 }) }), here: b.X, orders: plan(order('chart_unknown')) };
    },
    check(o, { here }) {
      return {
        got: { mapped: mapped(o, here), refused: says(o, 'lacks the Explorer mastery (7) to Chart the Unknown.') },
        want: { mapped: 0, refused: true },
      };
    },
  },
  {
    name: 'Chart the Unknown: the ground he stands on is mapped in full, every lair found, and each neighbour glimpsed',
    stage(b) {
      withFeatures(b.X, lair('Drowned Mill', 'Weak'), ritualSite());
      b.ring1.forEach((p) => {
        withFeatures(p);
      });
      ring1(b, 0)['exploredBy'] = { 0: 60 };
      return {
        hero: at(b, { skills: skilled({ explorer: 7 }) }),
        here: b.X,
        around: b.ring1,
        orders: plan(order('chart_unknown')),
      };
    },
    check(o, { here, around }) {
      const nbrs = must(around, 'the neighbours');
      return {
        got: {
          mapped: mapped(o, here),
          known: features(o, here).map(known),
          neighbours: nbrs.map((p) => mapped(o, p)),
          told: says(o, `charts ${here.name} in full and scouts its 6 neighbours (5 newly glimpsed).`),
        },
        want: { mapped: 100, known: [true, true], neighbours: nbrs.map((p, i) => (i === 0 ? 60 : 25)), told: true },
      };
    },
  },
  {
    name: 'Chart the Unknown: a bordering province charted from across the border',
    stage(b) {
      withFeatures(b.X);
      const there = ring1(b, 2);
      withFeatures(there, lair('Drowned Mill', 'Weak'));
      return {
        hero: at(b, { skills: skilled({ explorer: 7 }) }),
        here: b.X,
        there,
        orders: plan(order('chart_unknown', there.id)),
      };
    },
    check(o, { here, there }) {
      const t = must(there, 'there');
      return {
        got: {
          mapped: [mapped(o, here), mapped(o, t)],
          known: features(o, t).map(known),
          told: says(o, `charts ${t.name} from across the border in ${here.name} in full`),
        },
        want: { mapped: [25, 100], known: [true], told: true },
      };
    },
  },
  {
    name: 'Chart the Unknown: a province beyond the border is out of reach',
    stage(b) {
      withFeatures(b.X);
      const far = ring2(b, 0);
      withFeatures(far);
      return {
        hero: at(b, { skills: skilled({ explorer: 7 }) }),
        here: b.X,
        far,
        orders: plan(order('chart_unknown', far.id)),
      };
    },
    check(o, { here, far }) {
      return {
        got: {
          mapped: [mapped(o, here), mapped(o, must(far, 'far'))],
          refused: says(o, `cannot chart that ground from ${here.name}`),
        },
        want: { mapped: [0, 0], refused: true },
      };
    },
  },
  {
    name: 'Chart the Unknown is a mastery: once a turn, and a second is refused',
    wholeTurnOnly: true,
    stage(b) {
      withFeatures(b.X);
      const there = ring1(b, 2);
      withFeatures(there);
      return {
        hero: at(b, { skills: skilled({ explorer: 7 }) }),
        here: b.X,
        there,
        orders: plan(order('chart_unknown'), order('chart_unknown', there.id)),
      };
    },
    check(o, { here, there }) {
      return {
        got: {
          mapped: [mapped(o, here), mapped(o, must(there, 'there'))],
          refused: says(o, 'mastery this turn'),
        },
        want: { mapped: [100, 25], refused: true },
      };
    },
  },
];

export const DISCOVER_RUIN_ORDER_CASES: ExploreAndSearchOrderCase[] = [
  {
    name: 'Discover Lost Ruin: refused without the Explorer mastery (9)',
    stage(b) {
      withFeatures(b.X, lair('Drowned Mill', 'Weak'));
      return {
        hero: at(b, { skills: skilled({ explorer: 8 }) }),
        here: b.X,
        orders: plan(order('discover_ruin', 'Weak')),
      };
    },
    check(o, { here }) {
      return {
        got: { known: features(o, here).map(known), refused: says(o, 'lacks the Explorer mastery (9)') },
        want: { known: [false], refused: true },
      };
    },
  },
  {
    name: 'Discover Lost Ruin: every lair of the class named, here and next door, is laid bare, and no other',
    stage(b) {
      withFeatures(b.X, lair('Drowned Mill', 'Moderate'), lair('Old Sluice', 'Weak'));
      const there = ring1(b, 1);
      withFeatures(there, lair('Reed Barrow', 'Moderate'));
      const far = ring2(b, 0);
      withFeatures(far, lair('Far Barrow', 'Moderate'));
      return {
        hero: at(b, { skills: skilled({ explorer: 9 }) }),
        here: b.X,
        there,
        far,
        orders: plan(order('discover_ruin', 'moderate')),
      };
    },
    check(o, { here, there, far }) {
      return {
        got: {
          here: features(o, here).map(known),
          there: features(o, must(there, 'there')).map(known),
          far: features(o, must(far, 'far')).map(known),
          told: says(o, 'reads the land for moderate lairs and lays bare 2 sites across 2 provinces'),
        },
        want: { here: [true, false], there: [true], far: [false], told: true },
      };
    },
  },
  {
    name: 'Discover Lost Ruin: "Ritual" finds the old stones',
    stage(b) {
      withFeatures(b.X, lair('Drowned Mill', 'Weak'));
      const there = ring1(b, 3);
      withFeatures(there, ritualSite());
      return {
        hero: at(b, { skills: skilled({ explorer: 9 }) }),
        here: b.X,
        there,
        orders: plan(order('discover_ruin', 'Ritual')),
      };
    },
    check(o, { here, there }) {
      return {
        got: {
          here: features(o, here).map(known),
          there: features(o, must(there, 'there')).map(known),
          told: says(o, 'reads the land for the old stones and lays bare 1 site across 1 province'),
        },
        want: { here: [false], there: [true], told: true },
      };
    },
  },
  {
    name: "Discover Lost Ruin: a rival's glamour holds, and with nothing else to find the hero is told so",
    stage(b) {
      withFeatures(b.X, { ...lair('Drowned Mill', 'Weak'), _hidden: true, _hiddenBy: 1 });
      return {
        hero: at(b, { skills: skilled({ explorer: 9 }) }),
        here: b.X,
        orders: plan(order('discover_ruin', 'Weak')),
      };
    },
    check(o, { here }) {
      return {
        got: {
          known: features(o, here).map(known),
          told: says(o, 'but every such secret hereabouts is already laid bare.'),
        },
        want: { known: [false], told: true },
      };
    },
  },
  {
    name: 'Discover Lost Ruin: a class it does not know reads as Weak',
    stage(b) {
      withFeatures(b.X, lair('Drowned Mill', 'Weak'), lair('Old Sluice', 'Powerful'));
      return {
        hero: at(b, { skills: skilled({ explorer: 9 }) }),
        here: b.X,
        orders: plan(order('discover_ruin', 'shiny')),
      };
    },
    check(o, { here }) {
      return {
        got: { known: features(o, here).map(known) },
        want: { known: [true, false] },
      };
    },
  },
];

/** Every case, by order. */
export const EXPLORE_AND_SEARCH_ORDER_CASES: [string, ExploreAndSearchOrderCase[]][] = [
  ['explore', EXPLORE_ORDER_CASES],
  ['rite', RITE_ORDER_CASES],
  ['hunt_rumours', HUNT_RUMOURS_ORDER_CASES],
  ['search', SEARCH_ORDER_CASES],
  ['chart_unknown', CHART_THE_UNKNOWN_ORDER_CASES],
  ['discover_ruin', DISCOVER_RUIN_ORDER_CASES],
];
