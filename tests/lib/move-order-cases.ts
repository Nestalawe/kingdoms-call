// The Move order's cases (plan P1-08j1), staged on the middle of a bot world (lib/middle-of-a-bot-world.ts), each with
// what must be true after it in game terms. scenario/move-orders-in-a-whole-turn.test.ts plays each through a whole turn
// (resolveTurn); unit/move-order-called-directly.test.ts calls the order's own function on each, one phase at a time.
// A case stages its world and the mover's five orders; after them, it reads what it needs from the world and the log
// (`got`) beside what must be so (`want`), and the test compares the two. Every outcome is certain: no case leans on
// the dice (a battle is overwhelming, and a beaten defender has a province of his own to fall back to).
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
  mover: Character;
  orders: Order[];
  /** The province the order aims at. */
  to: Province;
  /** Another province the case needs (a defender's home, a far target). */
  other?: Province;
  defender?: Character;
  /** Where the mover stood before the orders. */
  from: Province;
}
export interface Outcome {
  world: World;
  /** The mover's own lines in the log. */
  lines: Line[];
}
export interface MoveOrderCase {
  name: string;
  /** Plays only in a whole turn: the order is turned into a Move, or refused, before the Move's own function runs. */
  wholeTurnOnly?: boolean;
  stage(b: Board): Staged;
  /** What the case found after the orders, and what it should have found: the same keys. */
  check(o: Outcome, s: Staged): { got: Record<string, unknown>; want: Record<string, unknown> };
}

const units = (n: number, type: string, quality = 'Regular'): Unit[] =>
  Array.from({ length: n }, (_, k) => ({ type, quality, race: 'Human', unitName: `${type} m${String(k)}` }));
const text = (o: Outcome) => o.lines.map((l) => l.text).join('\n');
const province = (o: Outcome, p: Province) => must(o.world.world.provinces[p.id], 'province ' + p.name);
const char = (o: Outcome, c: Character) =>
  must(
    o.world.characters.find((x) => x.id === c.id),
    'hero ' + c.name,
  );
/** Where the hero stands, by both accounts: his own, and the provinces' lists that name him. */
const whereIs = (o: Outcome, c: Character) => ({
  location: char(o, c).location,
  listedIn: o.world.world.provinces.filter((q) => q.characters.includes(c.id)).map((q) => q.id),
});
const standing = (p: Province) => ({ location: p.id, listedIn: [p.id] });
/** Who holds the province, by both accounts: its owner, and the realms that list it. */
const holderOf = (o: Outcome, p: Province) => ({
  owner: province(o, p).owner,
  listedBy: o.world.players.flatMap((pl, i) => (pl.provinces.includes(p.id) ? [i] : [])),
});
const held = (realm: number | null) => ({ owner: realm, listedBy: realm == null ? [] : [realm] });
/** Whether the mover's lines say `what` (a string, or a pattern). */
const says = (o: Outcome, what: string | RegExp) =>
  typeof what === 'string' ? text(o).includes(what) : what.test(text(o));
/** A province next to `p` outside the board's middle province and its ring. */
const beyond = (b: Board, p: Province) =>
  must(
    b.nbrs(p).find((q) => q !== b.X && !b.ring1.includes(q)),
    'a province beyond ' + p.name,
  );
/** An overwhelming column for realm `player`: eight Veteran Heavy Infantry. */
const column = (b: Board, player: number, at: Province) =>
  hero(b, { player, at, troops: 8, type: 'Heavy Infantry', quality: 'Veteran' });
const ring1 = (b: Board, i: number) => must(b.ring1[i], 'a neighbour of the middle');

export const MOVE_ORDER_CASES: MoveOrderCase[] = [
  {
    name: 'a column marches into an empty, unowned neighbour named by its id (as the bots write it) and claims it',
    stage(b) {
      const to = ring1(b, 0);
      const mover = hero(b, { player: 0, at: b.X, troops: 3 });
      return { mover, to, from: b.X, orders: plan(order('move', to.id)) };
    },
    check(o, { mover, to }) {
      const p = province(o, to);
      return {
        got: {
          where: whereIs(o, mover),
          holder: holderOf(o, to),
          claims: says(o, `claims ${to.name} for `),
          visited: p.visitedBy?.includes(0),
          explored: ((p['exploredBy'] as Record<number, number> | undefined)?.[0] ?? 0) > 0,
        },
        want: { where: standing(to), holder: held(0), claims: true, visited: true, explored: true },
      };
    },
  },
  {
    name: 'an unarmed hero goes in to explore, and takes nothing',
    stage(b) {
      const to = ring1(b, 0);
      to['exploredBy'] = {};
      const mover = hero(b, { player: 0, at: b.X });
      return { mover, to, from: b.X, orders: plan(order('move', to.id)) };
    },
    check(o, { mover, to }) {
      return {
        got: {
          where: whereIs(o, mover),
          holder: holderOf(o, to),
          explores: says(o, new RegExp(`ventures into ${to.name} to explore .* Exploration of ${to.name} rises`)),
        },
        want: { where: standing(to), holder: held(null), explores: true },
      };
    },
  },
  {
    name: 'a slow column under March 5 marches four times a turn: the fifth march finds no movement left',
    stage(b) {
      const to = ring1(b, 0);
      // garrison troops march at pace 1, and March 5 adds 3, its most: no rise in March this turn can add more
      const mover = hero(b, {
        player: 0,
        at: b.X,
        troops: 2,
        type: 'Human Garrison',
        skills: { melee: 2, tactical: 2, march: 5, spy: 0 },
      });
      const there = order('move', to.id);
      const back = order('move', b.X.id);
      return { mover, to, from: b.X, orders: [there, back, there, back, there] };
    },
    check(o, { mover, from }) {
      const refused = o.lines.filter((l) => l.text === `${mover.name} has no movement points remaining this turn.`);
      return {
        got: { where: whereIs(o, mover), refusedIn: refused.map((l) => l.phase) },
        want: { where: standing(from), refusedIn: [4] },
      };
    },
  },
  {
    name: "the portal's form, prov:<id>, marches straight into a neighbour",
    stage(b) {
      const to = ring1(b, 2);
      const mover = hero(b, { player: 0, at: b.X, troops: 2 });
      return { mover, to, from: b.X, orders: plan(order('move', 'prov:' + String(to.id))) };
    },
    check(o, { mover, to }) {
      return {
        got: { where: whereIs(o, mover), holder: holderOf(o, to), turned: says(o, 'turns toward it') },
        want: { where: standing(to), holder: held(0), turned: false },
      };
    },
  },
  {
    name: 'prov:<id> two provinces away: one step along the road this season, and on in the next',
    stage(b) {
      const to = must(b.ring2[0], 'a province two away');
      const mover = hero(b, { player: 0, at: b.X, troops: 2 });
      const there = order('move', 'prov:' + String(to.id));
      return { mover, to, from: b.X, orders: plan(there, there) };
    },
    check(o, { mover, to }) {
      return {
        got: {
          where: whereIs(o, mover),
          turned: says(
            o,
            new RegExp(
              `intended to march to ${to.name}, but .* no longer lies adjacent — the column turns toward it by way of`,
            ),
          ),
        },
        want: { where: standing(to), turned: true },
      };
    },
  },
  {
    name: 'a compass direction (dir:E) marches into the neighbour that way',
    stage(b) {
      const to = must(
        b.ring1.find((p) => p.row === b.X.row && p.col === b.X.col + 1),
        'the province east',
      );
      const mover = hero(b, { player: 0, at: b.X });
      return { mover, to, from: b.X, orders: plan(order('move', 'dir:E')) };
    },
    check(o, { mover, to }) {
      return { got: { where: whereIs(o, mover) }, want: { where: standing(to) } };
    },
  },
  {
    name: 'north off the top of the map: the icy wastes bar the way',
    stage(b) {
      const from = must(
        b.G.world.provinces.find((p) => p.row === 0),
        'a province on the top row',
      );
      from.characters = [];
      const mover = hero(b, { player: 0, at: from });
      return { mover, to: from, from, orders: plan(order('move', 'dir:NW')) };
    },
    check(o, { mover, from }) {
      return {
        got: {
          where: whereIs(o, mover),
          barred: says(o, 'marches NW to the edge of the world, but the impassable icy wastelands bar the way'),
        },
        want: { where: standing(from), barred: true },
      };
    },
  },
  {
    name: 'a column is turned back at the border of a realm its own is neutral with',
    stage(b) {
      b.G.relations['1-2'] = 'neutral';
      const to = ring1(b, 0);
      b.own(to, 2);
      const mover = column(b, 1, b.X);
      return { mover, to, from: b.X, orders: plan(order('move', to.id)) };
    },
    check(o, { mover, to, from }) {
      return {
        got: {
          where: whereIs(o, mover),
          holder: holderOf(o, to),
          turnedBack: says(o, `${mover.name}'s column is turned back at the border of ${to.name}`),
        },
        want: { where: standing(from), holder: held(2), turnedBack: true },
      };
    },
  },
  {
    name: 'an unarmed hero crosses the border of a neutral realm freely',
    stage(b) {
      b.G.relations['1-2'] = 'neutral';
      const to = ring1(b, 0);
      b.own(to, 2);
      const mover = hero(b, { player: 1, at: b.X });
      return { mover, to, from: b.X, orders: plan(order('move', to.id)) };
    },
    check(o, { mover, to }) {
      return {
        got: { where: whereIs(o, mover), holder: holderOf(o, to), turnedBack: says(o, 'turned back') },
        want: { where: standing(to), holder: held(2), turnedBack: false },
      };
    },
  },
  {
    name: "a column walks into an ally's province: no battle, and the province stays the ally's",
    stage(b) {
      const to = ring1(b, 0);
      b.own(to, 2);
      const mover = column(b, 0, b.X);
      return { mover, to, from: b.X, orders: plan(order('move', to.id)) };
    },
    check(o, { mover, to }) {
      return {
        got: {
          where: whereIs(o, mover),
          holder: holderOf(o, to),
          moves: says(o, `${mover.name} moves to ${to.name}.`),
          battle: says(o, 'Battle for'),
        },
        want: { where: standing(to), holder: held(2), moves: true, battle: false },
      };
    },
  },
  {
    name: 'an enemy province with nobody to hold it is seized',
    stage(b) {
      const to = ring1(b, 0);
      b.own(to, 1);
      const mover = hero(b, { player: 0, at: b.X, troops: 2 });
      return { mover, to, from: b.X, orders: plan(order('move', to.id)) };
    },
    check(o, { mover, to }) {
      return {
        got: {
          where: whereIs(o, mover),
          holder: holderOf(o, to),
          seizes: says(o, `seizes the undefended province of ${to.name} from `),
        },
        want: { where: standing(to), holder: held(0), seizes: true },
      };
    },
  },
  {
    name: 'an enemy garrison with no commander is broken: the province falls, and no survivor stays in it',
    stage(b) {
      const to = ring1(b, 0);
      const other = beyond(b, to);
      b.own(to, 1);
      b.own(other, 1);
      to.garrisonArmies = units(1, 'Men-at-Arms', 'Green');
      const mover = column(b, 0, b.X);
      return { mover, to, other, from: b.X, orders: plan(order('move', to.id)) };
    },
    check(o, { mover, to }) {
      return {
        got: {
          where: whereIs(o, mover),
          holder: holderOf(o, to),
          // the beaten companies (a win can add a new one by the turn's end: an orc realm's Raiders' Muster)
          beatenLeft: province(o, to).garrisonArmies.filter((u) => u.unitName === 'Men-at-Arms m0'),
          takes: says(
            o,
            new RegExp(
              `(takes ${to.name} as its garrison withdraws|breaks through the last of the garrison and seizes ${to.name})`,
            ),
          ),
        },
        want: { where: standing(to), holder: held(0), beatenLeft: [], takes: true },
      };
    },
  },
  {
    name: 'an enemy hero holding the province is beaten: he falls back to his own province next door, and it is taken',
    stage(b) {
      const to = ring1(b, 0);
      const other = beyond(b, to);
      b.own(to, 1);
      b.own(other, 1);
      const defender = hero(b, { player: 1, at: to, troops: 1, quality: 'Green' });
      const mover = column(b, 0, b.X);
      return { mover, to, other, defender, from: b.X, orders: plan(order('move', to.id)) };
    },
    check(o, { mover, to, defender }) {
      return {
        got: {
          where: whereIs(o, mover),
          holder: holderOf(o, to),
          defenderGone: char(o, must(defender, 'the defender')).location !== to.id,
          battle: says(o, `Battle for ${to.name}`),
          claims: says(o, `claims ${to.name} for `),
        },
        want: { where: standing(to), holder: held(0), defenderGone: true, battle: true, claims: true },
      };
    },
  },
  {
    // Whether the guard's last company lives through the rout is the dice's (even at fifteen to one), so this case
    // checks that the two outcomes hold together; unit/move-order-called-directly.test.ts fixes the dice for each.
    name: 'a neutral guard is beaten: he flees and the province is claimed with its merit, or he rallies and it is contested',
    stage(b) {
      const to = ring1(b, 0);
      to['tax'] = 3;
      const defender = hero(b, { player: null, at: to, troops: 1, quality: 'Green' });
      defender._isNeutralGuard = true;
      const mover = column(b, 0, b.X);
      return { mover, to, defender, from: b.X, orders: plan(order('move', to.id)) };
    },
    check(o, { mover, to }) {
      const first = { ...o, lines: o.lines.filter((l) => l.phase === 0) };
      const claimed = says(first, `claims ${to.name} for `) && says(first, '(+3 merit)');
      const rallied = says(first, new RegExp(`rallies 1 surviving unit — they will contest ${to.name} again`));
      return {
        got: {
          where: whereIs(o, mover),
          battle: says(first, `Battle for ${to.name}`),
          oneOutcome: claimed !== rallied,
          meritIfClaimed: claimed ? char(o, mover)['merits'] : 3,
        },
        want: { where: standing(to), battle: true, oneOutcome: true, meritIfClaimed: 3 },
      };
    },
  },
  {
    name: 'a fleet sails from the coast out to sea',
    stage(b) {
      const to = ring1(b, 1);
      to.terrain = 'sea';
      const mover = hero(b, { player: 0, at: b.X });
      mover.armies = units(2, 'Galleon Fleet');
      return { mover, to, from: b.X, orders: plan(order('move', to.id)) };
    },
    check(o, { mover, to }) {
      return {
        got: { where: whereIs(o, mover), sails: says(o, `${mover.name} moves across sea to ${to.name}.`) },
        want: { where: standing(to), sails: true },
      };
    },
  },
  {
    name: 'land troops with no ships cannot put to sea',
    stage(b) {
      const to = ring1(b, 1);
      to.terrain = 'sea';
      const mover = hero(b, { player: 0, at: b.X, troops: 2 });
      return { mover, to, from: b.X, orders: plan(order('move', to.id)) };
    },
    check(o, { mover, from }) {
      return {
        got: {
          where: whereIs(o, mover),
          blocked: says(
            o,
            new RegExp(
              `${mover.name} cannot put to sea: 2 land armies \\(Men-at-Arms, Men-at-Arms\\) need 1 hull .* Move blocked\\.`,
            ),
          ),
        },
        want: { where: standing(from), blocked: true },
      };
    },
  },
  {
    name: 'a fleet carrying troops lands them on the coast, and the landing is remembered',
    stage(b) {
      b.X.terrain = 'sea';
      const to = ring1(b, 0);
      const mover = hero(b, { player: 0, at: b.X });
      mover.armies = [...units(2, 'Galleon Fleet'), ...units(2, 'Men-at-Arms')];
      return { mover, to, from: b.X, orders: plan(order('move', to.id)) };
    },
    check(o, { mover, to }) {
      const landing = char(o, mover)['_seaLandingAt'] as { prov?: number } | undefined;
      return {
        got: {
          where: whereIs(o, mover),
          holder: holderOf(o, to),
          lands: says(o, `${mover.name} makes a coastal landing in ${to.name}.`),
          landedAt: landing?.prov,
        },
        want: { where: standing(to), holder: held(0), lands: true, landedAt: to.id },
      };
    },
  },
  {
    name: 'a column that still leads ships cannot march overland',
    stage(b) {
      const to = ring1(b, 0);
      const mover = hero(b, { player: 0, at: b.X });
      mover.armies = [...units(2, 'Galleon Fleet'), ...units(2, 'Men-at-Arms')];
      return { mover, to, from: b.X, orders: plan(order('move', to.id)) };
    },
    check(o, { mover, from }) {
      return {
        got: {
          where: whereIs(o, mover),
          refused: says(
            o,
            `${mover.name} cannot march overland while leading naval units (Galleon Fleet, Galleon Fleet)`,
          ),
        },
        want: { where: standing(from), refused: true },
      };
    },
  },
  {
    name: "lairs are spotted on the way in as the realm's map of the province passes their marks, told after the march",
    stage(b) {
      const to = ring1(b, 0);
      to['features'] = [
        { name: 'Old Barrow', monster: { name: 'Barrow Wight' } },
        { name: 'Sunken Shrine', monster: { name: 'Wyrm' } },
      ];
      to['exploredBy'] = { 0: 95 };
      const mover = hero(b, { player: 0, at: b.X, troops: 1 });
      return { mover, to, from: b.X, orders: plan(order('move', to.id)) };
    },
    check(o, { mover, to }) {
      const t = text(o);
      const features = province(o, to)['features'] as { discoveredBy?: number[] }[];
      return {
        got: {
          discovers: t.includes(
            `Moving into ${to.name}, ${mover.name} discovers the Old Barrow (guarded by a Barrow Wight) and the Sunken Shrine (guarded by a Wyrm).`,
          ),
          afterTheMarch: t.indexOf(`claims ${to.name}`) < t.indexOf('discovers the Old Barrow'),
          known: features.map((f) => f.discoveredBy),
        },
        want: { discovers: true, afterTheMarch: true, known: [[0], [0]] },
      };
    },
  },
  {
    name: 'Forced March (March 7) marches as a Move, once a turn',
    wholeTurnOnly: true,
    stage(b) {
      const to = ring1(b, 0);
      const mover = hero(b, { player: 0, at: b.X, troops: 2, skills: { melee: 2, tactical: 2, march: 7, spy: 0 } });
      return {
        mover,
        to,
        from: b.X,
        orders: plan(order('forced_march', to.id), order('Forced March', b.X.id)),
      };
    },
    check(o, { mover, to }) {
      return {
        got: {
          where: whereIs(o, mover),
          holder: holderOf(o, to),
          once: says(o, `${mover.name} has already used their Forced March mastery this turn`),
        },
        want: { where: standing(to), holder: held(0), once: true },
      };
    },
  },
  {
    name: 'Forced March without March 7 is refused',
    wholeTurnOnly: true,
    stage(b) {
      const to = ring1(b, 0);
      const mover = hero(b, { player: 0, at: b.X, troops: 2, skills: { melee: 2, tactical: 2, march: 6, spy: 0 } });
      return { mover, to, from: b.X, orders: plan(order('forced_march', to.id)) };
    },
    check(o, { mover, from, to }) {
      return {
        got: {
          where: whereIs(o, mover),
          holder: holderOf(o, to),
          refused: says(o, `${mover.name} lacks the March mastery (7) for a Forced March.`),
        },
        want: { where: standing(from), holder: held(null), refused: true },
      };
    },
  },
];
