// Early Winter (plan P1-08k2, a stage of resolveTurn's phase loop lifted out): what the realms settle once the last
// season's orders are done, staged on the middle of a bot world (lib/middle-of-a-bot-world.ts), from plain realms, each
// with what must be true after it in game terms. A hero an enemy Charm seized goes home to his own lord, before anyone
// pays him. Each realm is told its treasury and collects its taxes: each province's tax with its marks (an earthquake,
// sabotage, a blessing, holy ground, enslavement, earthquake damage), the province-tax discoveries and the Free City
// Charter, the heroes' tax gold, interest, Taxation Records, neutral trade, the Thief network and the minor titles. It
// owes and pays its wages (every company in the field and in garrison, every hero but the king), after the discounts;
// a realm that can't pay loses its rawest companies first, garrison or field alike, the dead last, a ship carrying
// troops at sea kept, then its heroes may desert. Raiders' Muster draws a Goblin Horde to an orcish province an orc
// realm won. Every unled garrison company may rise a grade.
// scenario/early-winter-in-a-whole-turn.test.ts plays each through a whole turn (resolveTurn);
// unit/early-winter-called-directly.test.ts calls the stage directly on the staged world. A case stages its world and
// the heroes' orders; after them, it reads what it needs from the world and the log (`got`) beside what must be so
// (`want`), and the test compares the two. Every outcome is certain: every case fixes the dice for the whole turn
// (default LANDS: every percentile roll lands, every other die at its highest, so no garrison company rises and every
// unpaid hero deserts), so the outcome holds however many dice the turn draws before it. Realm 0's lands are only the
// provinces a case gives it (`holdsOnly`), so its taxes and wages are exactly the case's.
import {
  must,
  playTurn,
  type Board,
  type Character,
  type Line,
  type Order,
  type Province,
  type Unit,
  type World,
} from './middle-of-a-bot-world.ts';
import { companies, item, skeletal } from './item-and-army-order-cases.ts';
import { withCaseDice, type Dice } from './espionage-order-cases.ts';
import { at, holding, knows, leads, realm, ring1 } from './cast-spell-order-cases.ts';
import { plainRealms } from './recruit-hire-and-realm-works-order-cases.ts';
import { LANDS } from './war-order-cases.ts';

export { LANDS };
export interface Staged {
  /** Every hero given orders, with them (none: every hero Rests). */
  orders: [Character, Order[]][];
  /** The hero the case is about, if one. */
  hero?: Character;
  /** Other heroes the case needs. */
  others?: Character[];
  /** The province the case is about. */
  there?: Province;
  /** Other provinces the case needs. */
  places?: Province[];
}
export interface Outcome {
  world: World;
  /** Every line in the log. */
  all: Line[];
  /** The turn the orders were played in. */
  turn: number;
}
export interface EarlyWinterCase {
  name: string;
  /** The dice for the whole turn (default LANDS). */
  dice?: Dice;
  stage(b: Board): Staged;
  /** What the case found after the turn, and what it should have found: the same keys. */
  check(o: Outcome, s: Staged): { got: Record<string, unknown>; want: Record<string, unknown> };
}

/** Plays `c`, staged as `s` on `b`, through a whole turn, with the case's dice. */
export const playCase = (b: Board, c: EarlyWinterCase, s: Staged): Outcome => {
  const result = withCaseDice(b.engine, c.dice ?? LANDS, () =>
    playTurn(b, Object.fromEntries(s.orders.map(([h, os]) => [h.id, os]))),
  );
  return { world: result.after, all: result.lines, turn: b.G.turn };
};

// ── Staging ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** Realm `pi` holds only `held` (each at its tax), in order; every province it held before is left to nobody, its
 *  garrison gone. */
export const holdsOnly = (b: Board, pi: number, ...held: [Province, number][]) => {
  b.G.world.provinces.forEach((p) => {
    if (p.owner === pi) {
      p.owner = null;
      p.garrisonArmies = [];
    }
  });
  realm(b, pi).provinces = [];
  held.forEach(([p, tax]) => {
    b.own(p, pi);
    p['tax'] = tax;
  });
};
/** Realm `pi`'s treasury as the turn begins. */
export const gold = (b: Board, pi: number, g: number) => {
  realm(b, pi)['gold'] = g;
};
/** A hero of realm 0 (or `player`) in the middle, paid `pay` a turn, leading `armies`. */
export const paid = (b: Board, pay: number, armies: Unit[] = [], extra: Parameters<typeof at>[2] = {}) => {
  const h = leads(at(b, {}, extra), armies);
  h['pay'] = pay;
  return h;
};
/** Realm 0's king, in the middle, paid `pay` (a king draws no wage), leading `armies`. */
export const king = (b: Board, armies: Unit[] = [], pay = 5) => paid(b, pay, armies, { king: true });
/** A company of `type`, `quality`, `race`, named `name`, with `marks` (`_temporary`, `_isSkeletal`, …). */
export const unit = (
  name: string,
  type: string,
  quality = 'Average',
  race = 'Human',
  marks: Record<string, unknown> = {},
) => ({ type, quality, race, unitName: name, ...marks }) as Unit;
const grandDesign = (b: Board, pi: number, alignment: string, ...also: string[]) => {
  realm(b, pi)['alignment'] = alignment;
  knows(b, pi, 'gd', ...also);
};
const place = (s: Staged, i: number) => must(s.places?.[i], 'place ' + String(i));
const hero = (s: Staged) => must(s.hero, 'the hero');
const other = (s: Staged, i: number) => must(s.others?.[i], 'hero ' + String(i));
const there = (s: Staged) => must(s.there, 'the province');

// ── Reading the outcome ──────────────────────────────────────────────────────────────────────────────────────────
export const TAX_HEADER = '═ Tax collection ═';
export const WAGES_HEADER = '═ Army wages & hero wages ═';
/** The lines of Early Winter's accounts: from the tax header to the end of the season. */
export const accountLines = (o: Outcome) => {
  const i = o.all.findIndex((l) => l.text === TAX_HEADER);
  if (i < 0) return [];
  const rest = o.all.slice(i);
  const j = rest.findIndex((l) => l.phase !== 4);
  return j < 0 ? rest : rest.slice(0, j);
};
/** What realm `pi` is told in Early Winter's accounts, in order. */
export const accounts = (o: Outcome, pi = 0) =>
  accountLines(o)
    .filter((l) => l.actor === pi)
    .map((l) => l.text);
export const realmOf = (o: Outcome, pi = 0) => must(o.world.players[pi], 'realm ' + String(pi));
export const goldOf = (o: Outcome, pi = 0) => realmOf(o, pi)['gold'];
export const char = (o: Outcome, c: Character) =>
  must(
    o.world.characters.find((x) => x.id === c.id),
    'hero ' + c.name,
  );
export const province = (o: Outcome, p: Province) => must(o.world.world.provinces[p.id], 'province ' + p.name);
/** The first line of the turn saying `what`: its kind, the realms told, its province, whether it is public, its phase
 *  (null if no line says it). */
export const told = (o: Outcome, what: string) => {
  const l = o.all.find((x) => x.text.includes(what));
  return l
    ? { type: l.type, targets: l.targets ?? null, provinceId: l.provinceId, public: !!l['public'], phase: l.phase }
    : null;
};
export const has = (n: string, g: number) => `${n} has ${String(g)}g in the treasury.`;
export const collects = (n: string, g: number, notes = '') => `${n} collects ${String(g)}g in taxes${notes}.`;
export const owes = (n: string, w: number, armies: number, heroes: number, notes: string[] = []) =>
  `${n} owes ${String(w)}g wages (armies: ${String(armies)}g, heroes: ${String(heroes)}g)${notes.length ? ` — after ${notes.join(', ')}` : ''}.`;
export const pays = (n: string, w: number, left: number) =>
  `${n} pays ${String(w)}g in wages. Treasury: ${String(left)}g remaining.`;
export const noWages = (n: string) => `${n}: no wages to pay.`;
export const cannotPay = (n: string, w: number, g: number) =>
  `⚠ ${n} cannot pay ${String(w)}g wages! Only ${String(g)}g available. The rawest troops melt away first — the greenest companies anywhere in the realm, garrison or field alike — then better men as the shortfall bites. The skeletal dead ask for nothing and are the last to go. Heroes may desert.`;
const label = (u: Unit) => (u.unitName ? `${u.unitName} (${u.type})` : `A ${u.quality} ${u.type}`);
export const disbands = (u: Unit, n: string) => `${label(u)} disbands — ${n} could not pay their wages.`;
export const shipFreed = (u: Unit, n: string) =>
  `${label(u)} disbands — ${n} could not pay their wages, and with the troops aboard gone the ship is no longer needed to carry them.`;
export const shipsKept = (k: number) =>
  `⚓ ${String(k)} ship${k !== 1 ? 's' : ''} carrying troops at sea ${k !== 1 ? 'are' : 'is'} kept at the oars unpaid — disbanding ${k !== 1 ? 'them' : 'it'} would leave the men aboard stranded.`;
export const deserts = (c: Character, n: string) =>
  `${c.name.replace(' (wandering)', '')} (wandering) abandons ${n}'s service, unpaid and disillusioned.`;
export const fades = (c: Character) =>
  `As the season turns, the enchantment on ${c.name} fades and they return to their own lord.`;
export const drills = (p: Province, ...rises: string[]) => `🎖 Garrison drills in ${p.name}: ${rises.join('; ')}.`;
export const muster = (p: Province, name: string) =>
  `🥁 Raiders' Muster — word of the victory at ${p.name} draws ${name} (Goblin Horde, Average) to its garrison for nothing.`;
/** The companies `p`'s garrison holds after the turn, as "<name> (<quality>)". */
export const garrison = (o: Outcome, p: Province) =>
  province(o, p).garrisonArmies.map((u) => `${u.unitName} (${u.quality})`);
/** A hero's companies after the turn, as "<name> (<quality>)". */
export const column = (o: Outcome, c: Character) => char(o, c).armies.map((u) => `${u.unitName} (${u.quality})`);
const CHARM_MARKS = [
  '_charmTempControl',
  '_charmControlFrom',
  '_charmedByPlayer',
  '_charmedForPhase',
  '_charmOriginalPlayer',
] as const;
/** The Charm's marks a hero still carries after the turn. */
const charmMarks = (o: Outcome, c: Character) => CHARM_MARKS.filter((k) => char(o, c)[k] !== undefined);
/** Seizes `c` for realm `by` this turn, as a Charm cast in Spring leaves him: his own lord `from`. */
const charmed = (c: Character, by: number, from: number | null) => {
  Object.assign(c, {
    player: by,
    _charmTempControl: true,
    _charmControlFrom: 0,
    _charmedByPlayer: by,
    _charmedForPhase: 0,
    _charmOriginalPlayer: from,
  });
  return c;
};
/** The turn the minor titles are first held (TITLES_PUBLIC_FROM_TURN). */
const titlesHeld = (b: Board) => {
  b.G.turn = 5;
};

// ── A charmed hero goes home ─────────────────────────────────────────────────────────────────────────────────────
export const CHARM_FADES_CASES: EarlyWinterCase[] = [
  {
    name: "a hero an enemy Charm seized goes home to his own lord as the accounts open, told to his lord, the Charm's marks gone",
    stage(b) {
      holdsOnly(b, 0, [b.X, 0]);
      const h = charmed(paid(b, 0), 1, 0);
      return { hero: h, orders: [] };
    },
    check(o, s) {
      const all = o.all.map((l) => l.text);
      return {
        got: {
          lord: char(o, hero(s)).player,
          marks: charmMarks(o, hero(s)),
          told: told(o, fades(hero(s))),
          to: o.all.find((l) => l.text === fades(hero(s)))?.actor,
          beforeTaxes: all.indexOf(fades(hero(s))) < all.indexOf(TAX_HEADER),
          once: all.filter((t) => t === fades(hero(s))).length,
        },
        want: {
          lord: 0,
          marks: [],
          told: { type: 'system', targets: [0], provinceId: null, public: false, phase: 4 },
          to: 0,
          beforeTaxes: true,
          once: 1,
        },
      };
    },
  },
  {
    name: 'his own lord pays his wages, not the realm that charmed him',
    stage(b) {
      holdsOnly(b, 0, [b.X, 0]);
      holdsOnly(b, 1, [ring1(b, 0), 0]);
      const h = charmed(paid(b, 4), 1, 0);
      return { hero: h, orders: [] };
    },
    check(o) {
      return {
        got: { lord: accounts(o, 0).filter((t) => t.includes(' wages')), charmer: accounts(o, 1) },
        want: {
          lord: [owes(realmOf(o, 0).name, 4, 0, 4), pays(realmOf(o, 0).name, 4, 16)],
          charmer: [has(realmOf(o, 1).name, 20)],
        },
      };
    },
  },
  {
    name: "a charmed hero already back with his own lord: the Charm's marks go, and his lord is told",
    stage(b) {
      holdsOnly(b, 0, [b.X, 0]);
      const h = charmed(paid(b, 0), 0, 0);
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return {
        got: { lord: char(o, hero(s)).player, marks: charmMarks(o, hero(s)), told: told(o, fades(hero(s)))?.targets },
        want: { lord: 0, marks: [], told: [0] },
      };
    },
  },
  {
    name: "a charmed hero who has fallen goes back to his own lord's roll, the Charm's marks gone, and nobody is told",
    stage(b) {
      holdsOnly(b, 0, [b.X, 0]);
      const h = charmed(paid(b, 0), 1, 0);
      h.alive = false;
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return {
        got: {
          lord: char(o, hero(s)).player,
          marks: charmMarks(o, hero(s)),
          told: o.all.some((l) => l.text.includes('the enchantment on')),
        },
        want: { lord: 0, marks: [], told: false },
      };
    },
  },
  {
    name: 'a hero held with no lord of his own on record stays where the Charm left him, its marks kept',
    stage(b) {
      holdsOnly(b, 0, [b.X, 0]);
      const h = charmed(paid(b, 0), 1, null);
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return {
        got: {
          lord: char(o, hero(s)).player,
          seized: char(o, hero(s))['_charmTempControl'],
          told: o.all.some((l) => l.text.includes('the enchantment on')),
        },
        want: { lord: 1, seized: true, told: false },
      };
    },
  },
];

// ── Taxes ───────────────────────────────────────────────────────────────────────────────────────────────────────
export const TAX_CASES: EarlyWinterCase[] = [
  {
    name: "each realm is told its treasury, then collects its provinces' tax, under the tax header, before the wages",
    stage(b) {
      holdsOnly(b, 0, [b.X, 10], [ring1(b, 0), 6]);
      return { orders: [], there: b.X };
    },
    check(o) {
      const n = realmOf(o).name;
      const all = o.all.map((l) => l.text);
      return {
        got: {
          accounts: accounts(o),
          gold: goldOf(o),
          order: [all.indexOf(TAX_HEADER), all.indexOf(has(n, 20)), all.indexOf(WAGES_HEADER)].map((i, k, a) =>
            k ? i > (a[k - 1] ?? 0) : i >= 0,
          ),
          treasury: told(o, has(n, 20)),
          collected: told(o, collects(n, 16)),
          header: told(o, TAX_HEADER),
          noWages: told(o, noWages(n)),
        },
        want: {
          accounts: [has(n, 20), collects(n, 16)],
          gold: 36,
          order: [true, true, true],
          treasury: { type: 'system', targets: [0], provinceId: null, public: false, phase: 4 },
          collected: { type: 'system', targets: [0], provinceId: null, public: false, phase: 4 },
          header: { type: 'system', targets: [], provinceId: null, public: false, phase: 4 },
          noWages: { type: 'system', targets: [], provinceId: null, public: false, phase: 4 },
        },
      };
    },
  },
  {
    name: 'a realm with no land, no living hero and an empty treasury is told nothing of its treasury or taxes',
    stage(b) {
      holdsOnly(b, 0);
      gold(b, 0, 0);
      const h = paid(b, 0);
      h.alive = false;
      return { orders: [] };
    },
    check(o) {
      return {
        got: { accounts: accounts(o), noWages: o.all.filter((l) => l.text === noWages(realmOf(o).name)).length },
        want: { accounts: [], noWages: 1 },
      };
    },
  },
  {
    name: 'a realm with no land and no hero, but gold in its treasury, is told its treasury',
    stage(b) {
      holdsOnly(b, 0);
      gold(b, 0, 7);
      return { orders: [] };
    },
    check(o) {
      return {
        got: { accounts: accounts(o), gold: goldOf(o) },
        want: { accounts: [has(realmOf(o).name, 7)], gold: 7 },
      };
    },
  },
  {
    name: 'a realm with no land but a living hero is told its treasury, though it is empty',
    stage(b) {
      holdsOnly(b, 0);
      gold(b, 0, 0);
      king(b);
      return { orders: [] };
    },
    check(o) {
      return { got: { accounts: accounts(o) }, want: { accounts: [has(realmOf(o).name, 0)] } };
    },
  },
  {
    name: "a province shaken by an earthquake or wrecked by sabotage this turn yields no tax; last turn's marks count for nothing",
    stage(b) {
      const [a, c] = [ring1(b, 0), ring1(b, 1)];
      holdsOnly(b, 0, [b.X, 10], [a, 6], [c, 5]);
      b.X['_earthquakeNoTax'] = b.G.turn;
      a['_sabotagedForTurn'] = b.G.turn;
      Object.assign(c, { _earthquakeNoTax: b.G.turn - 1, _sabotagedForTurn: b.G.turn - 1 });
      return { orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o), gold: goldOf(o) },
        want: { accounts: [has(n, 20), collects(n, 5)], gold: 25 },
      };
    },
  },
  {
    name: "Bless Province: a blessed province yields 60% more this turn (rounded), or the blessing's own measure; last turn's counts for nothing",
    stage(b) {
      const [a, c] = [ring1(b, 0), ring1(b, 1)];
      holdsOnly(b, 0, [b.X, 7], [a, 5], [c, 4]);
      b.X['_blessedTurn'] = b.G.turn;
      Object.assign(a, { _blessedTurn: b.G.turn, _blessedMult: 2 });
      c['_blessedTurn'] = b.G.turn - 1;
      return { orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return { got: { accounts: accounts(o) }, want: { accounts: [has(n, 20), collects(n, 25)] } };
    },
  },
  {
    name: 'consecrated ground yields half as much again, rounded, the share told in the collection',
    stage(b) {
      holdsOnly(b, 0, [b.X, 7], [ring1(b, 0), 6]);
      realm(b, 0)['consecratedProvIds'] = [b.X.id];
      return { orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o), gold: goldOf(o) },
        want: { accounts: [has(n, 20), collects(n, 17, ' (+4g from consecrated ground)')], gold: 37 },
      };
    },
  },
  {
    name: 'blessed and consecrated: the blessing first, then half as much again of that, the whole uplift told',
    stage(b) {
      holdsOnly(b, 0, [b.X, 10]);
      b.X['_blessedTurn'] = b.G.turn;
      realm(b, 0)['consecratedProvIds'] = [b.X.id];
      return { orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o) },
        want: { accounts: [has(n, 20), collects(n, 24, ' (+8g from consecrated ground)')] },
      };
    },
  },
  {
    name: 'an enslaved province yields 1 less while the resentment lasts (to this turn), never below nothing; a spent one in full',
    stage(b) {
      const [a, c] = [ring1(b, 0), ring1(b, 1)];
      holdsOnly(b, 0, [b.X, 6], [a, 0], [c, 4]);
      b.X['_enslavedUntil'] = b.G.turn;
      a['_enslavedUntil'] = b.G.turn + 2;
      c['_enslavedUntil'] = b.G.turn - 1;
      return { orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return { got: { accounts: accounts(o) }, want: { accounts: [has(n, 20), collects(n, 9)] } };
    },
  },
  {
    name: "an earthquake's lasting damage comes off the province's tax, never below nothing",
    stage(b) {
      const a = ring1(b, 0);
      holdsOnly(b, 0, [b.X, 6], [a, 1]);
      b.X['_earthquakeTax'] = 2;
      a['_earthquakeTax'] = 3;
      return { orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return { got: { accounts: accounts(o) }, want: { accounts: [has(n, 20), collects(n, 4)] } };
    },
  },
  {
    name: "a province-tax discovery (Aqueducts, +1 on plain) pays on each province it fits, up to 5% of the realm's base tax",
    stage(b) {
      const a = ring1(b, 0);
      const c = ring1(b, 1);
      holdsOnly(b, 0, [b.X, 20], [a, 10], [c, 10]);
      knows(b, 0, 'sd18');
      return { orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o), gold: goldOf(o) },
        want: { accounts: [has(n, 20), collects(n, 42)], gold: 62 },
      };
    },
  },
  {
    name: "the Free City Charter (Good's Grand Design): +2 on every province held with a garrison",
    stage(b) {
      holdsOnly(b, 0, [b.X, 5], [ring1(b, 0), 5]);
      grandDesign(b, 0, 'Good');
      b.X.garrisonArmies = [unit('Town Watch', 'Human Garrison')];
      return { orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o) },
        want: { accounts: [has(n, 20), collects(n, 12), owes(n, 1, 1, 0), pays(n, 1, 31)] },
      };
    },
  },
  {
    name: "the heroes' tax gold, their own and their items', is held to 5% of the base tax, the Merchant's Ledger filling what is left",
    stage(b) {
      holdsOnly(b, 0, [b.X, 60], [ring1(b, 0), 40]);
      const h = holding(king(b), item(b, 'Tally-Sticks of the Reeve'), item(b, "Merchant's Ledger"));
      h['taxBonus'] = 1;
      return { hero: h, orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o), gold: goldOf(o) },
        want: { accounts: [has(n, 20), collects(n, 105, " (+1g Merchant's Ledger)")], gold: 125 },
      };
    },
  },
  {
    name: "the Merchant's Ledger pays 1 for each province held, while the heroes' tax gold is under its ceiling",
    stage(b) {
      holdsOnly(b, 0, [b.X, 60], [ring1(b, 0), 30], [ring1(b, 1), 10]);
      const h = holding(king(b), item(b, "Merchant's Ledger"));
      return { hero: h, orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o) },
        want: { accounts: [has(n, 20), collects(n, 103, " (+3g Merchant's Ledger)")] },
      };
    },
  },
  {
    name: 'Merchant Guilds: interest on the treasury carried into the collection, up to 5% of the base tax',
    stage(b) {
      holdsOnly(b, 0, [b.X, 20], [ring1(b, 0), 20]);
      gold(b, 0, 100);
      knows(b, 0, 'sd12');
      return { orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o), gold: goldOf(o) },
        want: { accounts: [has(n, 100), collects(n, 42, ' (+2g Merchant Guilds interest)')], gold: 142 },
      };
    },
  },
  {
    name: 'Merchant Guilds with no province to tax: the interest is paid, but no collection is told',
    stage(b) {
      holdsOnly(b, 0);
      gold(b, 0, 100);
      knows(b, 0, 'sd12');
      return { orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return { got: { accounts: accounts(o), gold: goldOf(o) }, want: { accounts: [has(n, 100)], gold: 101 } };
    },
  },
  {
    name: 'Taxation Records: 5% more of the province income, rounded down, under its ceiling',
    stage(b) {
      holdsOnly(b, 0, [b.X, 30], [ring1(b, 0), 30]);
      b.X['_earthquakeTax'] = 30;
      knows(b, 0, 'sd14');
      return { orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o) },
        want: { accounts: [has(n, 20), collects(n, 31, ' (+1g Taxation Records)')] },
      };
    },
  },
  {
    name: "Taxation Records: held to 5% of the realm's base tax, though a blessing raised the income above it",
    stage(b) {
      holdsOnly(b, 0, [b.X, 20], [ring1(b, 0), 20]);
      b.X['_blessedTurn'] = b.G.turn;
      realm(b, 0)['consecratedProvIds'] = [b.X.id];
      knows(b, 0, 'sd14');
      return { orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o) },
        want: {
          accounts: [has(n, 20), collects(n, 70, ' (+2g Taxation Records) (+16g from consecrated ground)')],
        },
      };
    },
  },
  {
    name: 'a Neutral realm gains a fifth of its province income in trade, rounded down',
    stage(b) {
      holdsOnly(b, 0, [b.X, 9], [ring1(b, 0), 5]);
      realm(b, 0)['alignment'] = 'Neutral';
      return { orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o) },
        want: { accounts: [has(n, 20), collects(n, 16, ' (+2g Neutral trade bonus)')] },
      };
    },
  },
  {
    name: 'the Thief network: 5 for each hero of Thief 6, told in a collection of its own though the realm holds no land',
    stage(b) {
      holdsOnly(b, 0);
      const h = paid(b, 1, [], { skills: { thief: 6 } });
      paid(b, 0, [], { king: true, skills: { thief: 5 } });
      return { hero: h, orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o), gold: goldOf(o) },
        want: {
          accounts: [has(n, 20), collects(n, 5, ' (+5g Thief network)'), owes(n, 1, 0, 1), pays(n, 1, 24)],
          gold: 24,
        },
      };
    },
  },
  {
    name: 'the minor titles: the Castellan 1 for every 5 provinces his realm holds, the Cutpurse and the Champion of the People 2 each',
    stage(b) {
      titlesHeld(b);
      holdsOnly(b, 0, ...[b.X, ...b.ring1, ...b.ring2.slice(0, 3)].map((p): [Province, number] => [p, 1]));
      const k = king(b);
      const cut = paid(b, 1, [], { skills: { thief: 2 } });
      const champ = paid(b, 1);
      champ['merits'] = 4;
      return { hero: k, others: [cut, champ], orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o) },
        want: {
          accounts: [
            has(n, 20),
            collects(n, 16, ' (+2g the Castellan) (+2g the Cutpurse) (+2g Champion of the People)'),
            owes(n, 2, 0, 2),
            pays(n, 2, 34),
          ],
        },
      };
    },
  },
];

// ── Wages ───────────────────────────────────────────────────────────────────────────────────────────────────────
export const WAGE_CASES: EarlyWinterCase[] = [
  {
    name: 'every company in the field and in garrison draws its wage, every hero but the king his pay; the realm is told, pays, and the figures are kept for its report',
    stage(b) {
      holdsOnly(b, 0, [b.X, 10]);
      holdsOnly(b, 1, [ring1(b, 0), 0]);
      ring1(b, 0).garrisonArmies = companies(1, 'Men-at-Arms', 'Average', 'Their Watch');
      const k = king(b, companies(2, 'Men-at-Arms', 'Average', 'Guard'), 5);
      const h = paid(b, 2, companies(1, 'Free Lances', 'Average', 'Lances'));
      const fallen = paid(b, 7);
      fallen.alive = false;
      b.X.garrisonArmies = [unit('Town Watch', 'Human Garrison')];
      return { hero: h, others: [k], orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o), gold: goldOf(o), stamped: realmOf(o)['_lastWages'] },
        want: {
          accounts: [has(n, 20), collects(n, 10), owes(n, 12, 10, 2), pays(n, 12, 18)],
          gold: 18,
          stamped: {
            turn: o.turn,
            armyWages: 10,
            heroWages: 2,
            hostLeaderG: 0,
            heroWageDisc: 0,
            orcSpoilsG: 0,
            discUpkeepG: 0,
          },
        },
      };
    },
  },
  {
    name: 'summoned companies and the Wild Hunt draw no wage, the risen dead 1, a company of a kind with no price 2',
    stage(b) {
      holdsOnly(b, 0, [b.X, 0]);
      king(b, [
        unit('Summoned', 'Men-at-Arms', 'Average', 'Human', { _temporary: true }),
        unit('Hunt', 'Great Bears', 'Average', 'Human', { _wildHuntUntilTurn: b.G.turn + 1 }),
        skeletal('Bones'),
        unit('Odd Band', 'Wandering Minstrels'),
      ]);
      return { orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return { got: { accounts: accounts(o) }, want: { accounts: [has(n, 20), owes(n, 3, 3, 0), pays(n, 3, 17)] } };
    },
  },
  {
    name: "Orcish war-spoils: an Orcish realm's Orcish companies that won attacking this turn pay half, the halves carried so the host pays half in all, 1 at the least",
    stage(b) {
      holdsOnly(b, 0, [b.X, 0]);
      realm(b, 0)['race'] = 'Orcish';
      const won = { _orcAtkWinTurn: b.G.turn };
      king(b, [
        unit('W1', 'Warg Riders', 'Average', 'Orcish', won),
        unit('W2', 'Warg Riders', 'Average', 'Orcish', won),
        unit('Gate', 'Orc Garrison', 'Average', 'Orcish', won),
        unit('W3', 'Warg Riders', 'Average', 'Orcish', won),
        unit('W4', 'Warg Riders', 'Average', 'Orcish', won),
        unit('Wy', 'Wyvern Riders', 'Average', 'Orcish', won),
        unit('Last Year', 'Warg Riders', 'Average', 'Orcish', { _orcAtkWinTurn: b.G.turn - 1 }),
        unit('Hireling', 'Men-at-Arms', 'Average', 'Human', won),
      ]);
      return { orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o), spoils: (realmOf(o)['_lastWages'] as { orcSpoilsG?: number }).orcSpoilsG },
        want: {
          accounts: [has(n, 20), owes(n, 15, 15, 0, ['−8g Orcish war-spoils']), pays(n, 15, 5)],
          spoils: 8,
        },
      };
    },
  },
  {
    name: "a hero of Druid 6 pays half for the creatures and monsters he leads (1 at the least); his men, and another hero's beasts, in full",
    stage(b) {
      holdsOnly(b, 0, [b.X, 0]);
      gold(b, 0, 30);
      paid(
        b,
        0,
        [
          unit('Bears', 'Great Bears'),
          unit('Trolls', 'Cave Trolls'),
          unit('Giants', 'Stone Giants'),
          unit('Men', 'Men-at-Arms'),
        ],
        { king: true, skills: { druid: 6 } },
      );
      paid(b, 1, [unit('Other Bears', 'Great Bears')]);
      return { orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return { got: { accounts: accounts(o) }, want: { accounts: [has(n, 30), owes(n, 14, 13, 1), pays(n, 14, 16)] } };
    },
  },
  {
    name: "the Druidic Grand Design: every hero's creatures and monsters pay half",
    stage(b) {
      holdsOnly(b, 0, [b.X, 0]);
      grandDesign(b, 0, 'Druidic');
      king(b, [unit('Bears', 'Great Bears'), unit('Men', 'Men-at-Arms')]);
      paid(b, 1, [unit('Ents', 'Forest Ents')]);
      return { orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return { got: { accounts: accounts(o) }, want: { accounts: [has(n, 20), owes(n, 8, 7, 1), pays(n, 8, 12)] } };
    },
  },
  {
    name: 'an upkeep discovery (Supply Depots, 1 off each company) saves at most 5% of the base tax; the dead are never cut',
    stage(b) {
      holdsOnly(b, 0, [b.X, 20], [ring1(b, 0), 20]);
      knows(b, 0, 'sd55');
      king(b, [skeletal('Bones'), ...companies(3)]);
      return { orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o), saved: (realmOf(o)['_lastWages'] as { discUpkeepG?: number }).discUpkeepG },
        want: {
          accounts: [has(n, 20), collects(n, 40), owes(n, 8, 8, 0, ['−2g army upkeep discoveries']), pays(n, 8, 52)],
          saved: 2,
        },
      };
    },
  },
  {
    name: 'the Host-Leader pays 1 less for each company he leads (summoned ones and the Wild Hunt not counted)',
    stage(b) {
      titlesHeld(b);
      holdsOnly(b, 0, [b.X, 0]);
      const h = king(b, [
        ...companies(3, 'Men-at-Arms', 'Average', 'Host'),
        unit('Summoned', 'Men-at-Arms', 'Average', 'Human', { _temporary: true }),
      ]);
      paid(b, 1, companies(1, 'Men-at-Arms', 'Average', 'Other'));
      return { hero: h, orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o), led: (realmOf(o)['_lastWages'] as { hostLeaderG?: number }).hostLeaderG },
        want: { accounts: [has(n, 20), owes(n, 10, 9, 1, ['−3g the Host-Leader']), pays(n, 10, 10)], led: 3 },
      };
    },
  },
  {
    name: "hero wage discoveries (Granaries, then Inspiring Leadership's cap of 3) each save at most 5% of the base tax",
    stage(b) {
      holdsOnly(b, 0, [b.X, 20], [ring1(b, 0), 20]);
      knows(b, 0, 'sd17', 'sd38');
      paid(b, 5);
      paid(b, 5);
      paid(b, 5);
      return { orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o), saved: (realmOf(o)['_lastWages'] as { heroWageDisc?: number }).heroWageDisc },
        want: {
          accounts: [has(n, 20), collects(n, 40), owes(n, 11, 0, 11, ['−4g hero wage discounts']), pays(n, 11, 49)],
          saved: 4,
        },
      };
    },
  },
  {
    name: 'a realm whose only hero is its king, with no companies, owes nothing: it is told so, and its figures are kept',
    stage(b) {
      holdsOnly(b, 0, [b.X, 3]);
      king(b, [], 5);
      return { orders: [] };
    },
    check(o) {
      const n = realmOf(o).name;
      return {
        got: {
          accounts: accounts(o),
          noWages: o.all.filter((l) => l.text === noWages(n)).length,
          stamped: realmOf(o)['_lastWages'],
        },
        want: {
          accounts: [has(n, 20), collects(n, 3)],
          noWages: 1,
          stamped: {
            turn: o.turn,
            armyWages: 0,
            heroWages: 0,
            hostLeaderG: 0,
            heroWageDisc: 0,
            orcSpoilsG: 0,
            discUpkeepG: 0,
          },
        },
      };
    },
  },
];

// ── A realm that can't pay ───────────────────────────────────────────────────────────────────────────────────────
const VET = () => unit('Old Hands', 'Men-at-Arms', 'Veteran');
export const UNPAID_CASES: EarlyWinterCase[] = [
  {
    name: "a realm that can't pay is warned, its treasury emptied; its rawest companies go first, garrison or field alike, until the debt is met",
    stage(b) {
      holdsOnly(b, 0, [b.X, 0]);
      gold(b, 0, 5);
      const k = king(b, [VET(), unit('Field Levy', 'Men-at-Arms', 'Green')]);
      b.X.garrisonArmies = [
        unit('Town Watch', 'Human Garrison', 'Average'),
        unit('Gate Levy', 'Men-at-Arms', 'Green'),
        { ...skeletal('Bones'), quality: 'Green' },
      ];
      return { hero: k, there: b.X, orders: [] };
    },
    check(o, s) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o), gold: goldOf(o), field: column(o, hero(s)), garrison: garrison(o, there(s)) },
        want: {
          accounts: [
            has(n, 5),
            owes(n, 11, 11, 0),
            cannotPay(n, 11, 5),
            disbands(unit('Field Levy', 'Men-at-Arms', 'Green'), n),
            disbands(unit('Gate Levy', 'Men-at-Arms', 'Green'), n),
          ],
          gold: 0,
          field: ['Old Hands (Veteran)'],
          garrison: ['Town Watch (Average)'],
        },
      };
    },
  },
  {
    name: 'the dead are the last to go: a skeleton only once every living company has gone, a company with no name told by its grade',
    stage(b) {
      holdsOnly(b, 0, [b.X, 0]);
      gold(b, 0, 0);
      const k = king(b, [
        { ...skeletal('Bones'), quality: 'Green' },
        { type: 'Men-at-Arms', quality: 'Elite', race: 'Human', unitName: '' },
      ]);
      return { hero: k, orders: [] };
    },
    check(o, s) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o), field: column(o, hero(s)) },
        want: {
          accounts: [
            has(n, 0),
            owes(n, 4, 4, 0),
            cannotPay(n, 4, 0),
            `A Elite Men-at-Arms disbands — ${n} could not pay their wages.`,
            `Bones (Shieldwall Levies) disbands — ${n} could not pay their wages.`,
          ],
          field: [],
        },
      };
    },
  },
  {
    name: 'never disbanded for want of pay: summoned companies, the Wild Hunt, and the dead of a Deathless Legion; the king never deserts',
    stage(b) {
      holdsOnly(b, 0, [b.X, 0]);
      gold(b, 0, 0);
      grandDesign(b, 0, 'Undead');
      const k = paid(
        b,
        0,
        [
          { ...skeletal('Bones'), quality: 'Green' },
          unit('Summoned', 'Men-at-Arms', 'Green', 'Human', { _temporary: true }),
          unit('Hunt', 'Great Bears', 'Green', 'Human', { _wildHuntUntilTurn: b.G.turn + 1 }),
        ],
        { king: true, skills: { necromancy: 1 } },
      );
      return { hero: k, orders: [] };
    },
    check(o, s) {
      const n = realmOf(o).name;
      return {
        got: {
          accounts: accounts(o),
          field: column(o, hero(s)).filter((u) => u !== 'Summoned (Green)'),
          lord: char(o, hero(s)).player,
        },
        want: {
          accounts: [has(n, 0), owes(n, 1, 1, 0), cannotPay(n, 1, 0)],
          field: ['Bones (Green)', 'Hunt (Green)'],
          lord: 0,
        },
      };
    },
  },
  {
    name: 'a ship carrying troops at sea is passed over; once the troops aboard have gone, it goes next',
    stage(b) {
      const sea = ring1(b, 0);
      sea.terrain = 'sea';
      holdsOnly(b, 0, [b.X, 0]);
      gold(b, 0, 0);
      const h = hero0AtSea(b, sea, [
        unit('Galleon', 'Galleon Fleet', 'Green'),
        unit('Marines', 'Men-at-Arms', 'Average'),
      ]);
      return { hero: h, there: sea, orders: [] };
    },
    check(o, s) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o), field: column(o, hero(s)) },
        want: {
          accounts: [
            has(n, 0),
            owes(n, 6, 6, 0),
            cannotPay(n, 6, 0),
            disbands(unit('Marines', 'Men-at-Arms'), n),
            shipFreed(unit('Galleon', 'Galleon Fleet'), n),
          ],
          field: [],
        },
      };
    },
  },
  {
    name: 'a ship still carrying troops at sea when the debt is met is kept at the oars unpaid, and the realm is told',
    stage(b) {
      const sea = ring1(b, 0);
      sea.terrain = 'sea';
      holdsOnly(b, 0, [b.X, 0]);
      gold(b, 0, 6);
      const h = hero0AtSea(b, sea, [
        unit('Galleon', 'Galleon Fleet', 'Green'),
        unit('Marines', 'Men-at-Arms', 'Elite'),
      ]);
      b.X.garrisonArmies = companies(2, 'Men-at-Arms', 'Average', 'Watch');
      return { hero: h, there: b.X, orders: [] };
    },
    check(o, s) {
      const n = realmOf(o).name;
      return {
        got: {
          accounts: accounts(o),
          field: column(o, hero(s)),
          garrison: garrison(o, there(s)),
          kept: told(o, shipsKept(1)),
        },
        want: {
          accounts: [
            has(n, 6),
            owes(n, 12, 12, 0),
            cannotPay(n, 12, 6),
            disbands(unit('Watch c0', 'Men-at-Arms'), n),
            disbands(unit('Watch c1', 'Men-at-Arms'), n),
            shipsKept(1),
          ],
          field: ['Galleon (Green)', 'Marines (Elite)'],
          garrison: [],
          kept: { type: 'system', targets: [0], provinceId: null, public: false, phase: 4 },
        },
      };
    },
  },
  {
    name: 'still short with no company left that may go: heroes desert, the best paid first, until the debt is met',
    stage(b) {
      holdsOnly(b, 0, [b.X, 0]);
      gold(b, 0, 2);
      const a = paid(b, 1);
      const big = paid(b, 5);
      const mid = paid(b, 4);
      return { hero: big, others: [mid, a], orders: [] };
    },
    check(o, s) {
      const n = realmOf(o).name;
      const [big, mid, a] = [hero(s), other(s, 0), other(s, 1)];
      return {
        got: {
          accounts: accounts(o),
          lords: [big, mid, a].map((h) => char(o, h).player),
          names: [big, mid].map((h) => char(o, h).name),
          served: [big, mid].map((h) => char(o, h)['_servedRealms']),
          roll: realmOf(o)['heroes'],
          told: told(o, deserts(big, n)),
        },
        want: {
          accounts: [has(n, 2), owes(n, 10, 0, 10), cannotPay(n, 10, 2), deserts(big, n), deserts(mid, n)],
          lords: [null, null, 0],
          names: [`${big.name} (wandering)`, `${mid.name} (wandering)`],
          served: [[0], [0]],
          roll: [a.id],
          told: { type: 'hire', targets: [0], provinceId: null, public: false, phase: 4 },
        },
      };
    },
  },
  {
    name: 'an unpaid hero whose loyalty holds (the die no higher than 0.4) stays',
    dice: { roll: 1, die: 0.4 },
    stage(b) {
      holdsOnly(b, 0, [b.X, 0]);
      gold(b, 0, 0);
      const h = paid(b, 5);
      return { hero: h, orders: [] };
    },
    check(o, s) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o), lord: char(o, hero(s)).player },
        want: { accounts: [has(n, 0), owes(n, 5, 0, 5), cannotPay(n, 5, 0)], lord: 0 },
      };
    },
  },
];
/** Realm 0's king at sea in `sea`, leading `armies`, as a column that sailed there. */
function hero0AtSea(b: Board, sea: Province, armies: Unit[]) {
  return paid(b, 0, armies, { at: sea, king: true });
}

// ── Raiders' Muster ──────────────────────────────────────────────────────────────────────────────────────────────
const orcish = (b: Board, pi: number, ...ps: Province[]) => {
  realm(b, pi)['race'] = 'Orcish';
  ps.forEach((p) => {
    p['race'] = 'Orcish';
  });
};
export const MUSTER_CASES: EarlyWinterCase[] = [
  {
    name: "Raiders' Muster: an orcish province an orc realm won this turn draws a Goblin Horde to its garrison for nothing, and the realm is told",
    stage(b) {
      holdsOnly(b, 0, [b.X, 0]);
      orcish(b, 0, b.X);
      b.X['_raidersMuster'] = b.G.turn;
      return { there: b.X, orders: [] };
    },
    check(o, s) {
      const p = province(o, there(s));
      const g = p.garrisonArmies[0];
      const n = realmOf(o).name;
      return {
        got: {
          horde: p.garrisonArmies.map((u) => [u.type, u.quality, u.race]),
          told: g ? told(o, muster(there(s), g.unitName)) : null,
          mark: p['_raidersMuster'],
          accounts: accounts(o).filter((t) => !t.includes('🥁')),
        },
        want: {
          horde: [['Goblin Horde', 'Average', 'Orcish']],
          told: { type: 'hire', targets: [0], provinceId: there(s).id, public: false, phase: 4 },
          mark: undefined,
          accounts: [has(n, 20)],
        },
      };
    },
  },
  {
    name: "an earlier turn's muster mark is cleared and draws nothing",
    stage(b) {
      holdsOnly(b, 0, [b.X, 0]);
      orcish(b, 0, b.X);
      b.X['_raidersMuster'] = b.G.turn - 1;
      return { there: b.X, orders: [] };
    },
    check(o, s) {
      return {
        got: { garrison: garrison(o, there(s)), mark: province(o, there(s))['_raidersMuster'] },
        want: { garrison: [], mark: undefined },
      };
    },
  },
  {
    name: "no muster where the folk aren't orcish, the realm isn't, or nobody holds the province; each mark cleared",
    stage(b) {
      const [human, theirs, nobody] = [ring1(b, 0), ring1(b, 1), ring1(b, 2)];
      holdsOnly(b, 0, [b.X, 0], [human, 0]);
      holdsOnly(b, 1, [theirs, 0]);
      orcish(b, 0);
      human['race'] = 'Human';
      theirs['race'] = 'Orcish';
      nobody['race'] = 'Orcish';
      [human, theirs, nobody].forEach((p) => {
        p['_raidersMuster'] = b.G.turn;
      });
      return { places: [human, theirs, nobody], orders: [] };
    },
    check(o, s) {
      const ps = [place(s, 0), place(s, 1), place(s, 2)];
      return {
        got: {
          garrisons: ps.map((p) => garrison(o, p)),
          marks: ps.map((p) => province(o, p)['_raidersMuster']),
          told: o.all.some((l) => l.text.includes("Raiders' Muster")),
        },
        want: { garrisons: [[], [], []], marks: [undefined, undefined, undefined], told: false },
      };
    },
  },
];

// ── Garrison drill ───────────────────────────────────────────────────────────────────────────────────────────────
export const DRILL_CASES: EarlyWinterCase[] = [
  {
    name: "garrison drill: each unled company of a realm's garrison may rise a grade at the drill's chance, a Human company of a Human realm twice as readily; one line a province",
    dice: { roll: 1, die: 0.06 },
    stage(b) {
      const a = ring1(b, 0);
      holdsOnly(b, 0, [b.X, 10], [a, 0]);
      b.X.garrisonArmies = [
        unit('Raw', 'Human Garrison', 'Green'),
        unit('Elves', 'Elven Garrison', 'Green', 'Elven'),
        { type: 'Human Garrison', quality: 'Green', race: 'Human', unitName: '' },
        unit('Steady', 'Human Garrison', 'Average'),
        unit('Old Hands', 'Human Garrison', 'Veteran'),
        unit('Best', 'Human Garrison', 'Elite'),
      ];
      a.garrisonArmies = [unit('Sharp', 'Human Garrison', 'Crack')];
      return { there: b.X, places: [a], orders: [] };
    },
    check(o, s) {
      return {
        got: {
          lines: accountLines(o)
            .filter((l) => l.text.startsWith('🎖'))
            .map((l) => l.text),
          told: told(o, '🎖 Garrison drills in'),
          garrison: garrison(o, there(s)),
          other: garrison(o, place(s, 0)),
        },
        want: {
          lines: [
            drills(
              there(s),
              'Raw (Human Garrison) Green → **Average**',
              'a Human Garrison Green → **Average**',
              'Steady (Human Garrison) Average → **Veteran**',
            ),
          ],
          told: { type: 'hire', targets: [0], provinceId: there(s).id, public: false, phase: 4 },
          garrison: [
            'Raw (Average)',
            'Elves (Green)',
            ' (Average)',
            'Steady (Veteran)',
            'Old Hands (Veteran)',
            'Best (Elite)',
          ],
          other: ['Sharp (Crack)'],
        },
      };
    },
  },
  {
    name: 'never drilled: the risen dead, the Wild Hunt, a company of no known grade, nor a garrison nobody holds',
    dice: { roll: 1, die: 0 },
    stage(b) {
      const a = ring1(b, 0);
      holdsOnly(b, 0, [b.X, 10]);
      b.X.garrisonArmies = [
        { ...skeletal('Bones'), quality: 'Green' },
        unit('Hunt', 'Great Bears', 'Green', 'Human', { _wildHuntUntilTurn: b.G.turn + 1 }),
        unit('Odd', 'Human Garrison', 'Regular'),
      ];
      a.garrisonArmies = [unit('Nobody', 'Human Garrison', 'Green')];
      return { there: b.X, places: [a], orders: [] };
    },
    check(o, s) {
      return {
        got: {
          told: o.all.some((l) => l.text.includes('Garrison drills in')),
          garrison: garrison(o, there(s)),
          other: garrison(o, place(s, 0)),
        },
        want: { told: false, garrison: ['Hunt (Green)', 'Odd (Regular)'], other: ['Nobody (Green)'] },
      };
    },
  },
  {
    name: 'the drill comes after the wages: a company disbanded for want of pay never trains',
    dice: { roll: 1, die: 0 },
    stage(b) {
      holdsOnly(b, 0, [b.X, 0]);
      gold(b, 0, 3);
      b.X.garrisonArmies = [unit('Raw', 'Men-at-Arms', 'Green'), unit('Steady', 'Men-at-Arms', 'Average')];
      return { there: b.X, orders: [] };
    },
    check(o, s) {
      const n = realmOf(o).name;
      return {
        got: { accounts: accounts(o), garrison: garrison(o, there(s)) },
        want: {
          accounts: [
            has(n, 3),
            owes(n, 6, 6, 0),
            cannotPay(n, 6, 3),
            disbands(unit('Raw', 'Men-at-Arms'), n),
            drills(there(s), 'Steady (Men-at-Arms) Average → **Veteran**'),
          ],
          garrison: ['Steady (Veteran)'],
        },
      };
    },
  },
];

/** Stages `c` on `b`, from plain realms with no heroes on their rolls. */
export const stageCase = (b: Board, c: EarlyWinterCase): Staged => {
  plainRealms(b);
  b.G.players.forEach((pl) => {
    pl['heroes'] = [];
  });
  return c.stage(b);
};

/** Every case, by part of the season's accounts. */
export const EARLY_WINTER_CASES: [string, EarlyWinterCase[]][] = [
  ['a charmed hero goes home', CHARM_FADES_CASES],
  ['taxes', TAX_CASES],
  ['wages', WAGE_CASES],
  ["a realm that can't pay", UNPAID_CASES],
  ["Raiders' Muster", MUSTER_CASES],
  ['garrison drill', DRILL_CASES],
];
