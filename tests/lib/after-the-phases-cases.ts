// After the phases (plan P1-08k3, the first stage of resolveTurn's own body lifted out): what the turn settles once its
// five seasons are played, staged on the middle of a bot world (lib/middle-of-a-bot-world.ts), from plain realms, each
// with what must be true after it in game terms. A stand-off struck in the last season is flagged. The dead need a
// master: skeletal companies led by a character with no Necromancy, or left in a garrison, crumble, and their realm is
// told. A necromancer who never moved senses the graves where he stands. A wandering hero may learn a skill. A
// consecrated province that has changed hands loses its blessing. Couriers deliver the parcels sent across provinces;
// Elven companies that slipped a lost battle reach home. A fallen commander's host is settled; intrusions are told once;
// wounded lair guardians recover; Mass Healing mends the friends standing with a White master. Every maximum HP is
// resynced (with an old save's one-time note). A coward spared on the field makes his way home, his host left behind.
// Every hero's location name is brought up to date.
// scenario/after-the-phases-in-a-whole-turn.test.ts plays each through a whole turn (resolveTurn);
// unit/after-the-phases-called-directly.test.ts calls the stage directly on the staged world. A case stages its world
// and the heroes' orders; after them, it reads what it needs from the world and the log (`got`) beside what must be so
// (`want`), and the test compares the two. Every outcome is certain: every case fixes the dice for the whole turn
// (default LANDS: every percentile roll lands, every other die at its highest), so the outcome holds however many dice
// the turn draws before it. Realms 0 and 1 are at war, 0 and 2 allied, 1 and 2 at peace (the board's relations).
import {
  must,
  order,
  playTurn,
  type Board,
  type Character,
  type Line,
  type Order,
  type Province,
  type World,
} from './middle-of-a-bot-world.ts';
import { companies, item, skeletal, type Item } from './item-and-army-order-cases.ts';
import { withCaseDice, type Dice } from './espionage-order-cases.ts';
import { at, bury, holding, leads, realm, ring1, ring2, rival, wanderer } from './cast-spell-order-cases.ts';
import { plainRealms } from './recruit-hire-and-realm-works-order-cases.ts';
import { holdsOnly, unit } from './early-winter-cases.ts';
import { LANDS } from './war-order-cases.ts';

export { LANDS, holdsOnly, unit };
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
export interface AfterThePhasesCase {
  name: string;
  /** Plays only in a whole turn: the turn's set-up or its phases make what the case is about (a march, a battle, an
   *  intrusion seen, an old save read). */
  wholeTurnOnly?: boolean;
  /** The dice for the whole turn (default LANDS). */
  dice?: Dice;
  stage(b: Board): Staged;
  /** What the case found after the turn, and what it should have found: the same keys. */
  check(o: Outcome, s: Staged): { got: Record<string, unknown>; want: Record<string, unknown> };
}

/** Plays `c`, staged as `s` on `b`, through a whole turn, with the case's dice. */
export const playCase = (b: Board, c: AfterThePhasesCase, s: Staged): Outcome => {
  const result = withCaseDice(b.engine, c.dice ?? LANDS, () =>
    playTurn(b, Object.fromEntries(s.orders.map(([h, os]) => [h.id, os]))),
  );
  return { world: result.after, all: result.lines, turn: b.G.turn };
};

// ── Staging ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** Five Defend orders: a hero who keeps his wounds (a Rest would mend them) and stays where he is. */
export const stays = (c: Character): [Character, Order[]] => [c, Array.from({ length: 5 }, () => order('defend'))];
/** Wounds `c` to `hp` (of his maximum). */
export const wounded = (c: Character, hp: number) => {
  c.hp = hp;
  return c;
};
/** A realm's seat: where its spared cowards go home to while it holds it. */
export const seat = (b: Board, pi: number, p: Province) => {
  realm(b, pi)['homeProvinceId'] = p.id;
};
/** Marks `c` as a coward who begged for his life this turn (`turn`, default this one), as personal combat leaves him. */
export const spared = (c: Character, turn: number) => {
  c['_mercyFledTurn'] = turn;
  return c;
};
/** A parcel sent across provinces to `to` (an id), carrying `items`, from `from` (a name), arriving at the turn's end. */
export const parcel = (b: Board, to: number, items: Item[], from?: string) => {
  const G = b.G as unknown as Record<string, unknown>;
  const list = (G['_itemDeliveries'] as unknown[] | undefined) ?? [];
  G['_itemDeliveries'] = [...list, { toId: to, items, ...(from === undefined ? {} : { fromName: from }) }];
};
/** Realm `pi`'s consecrated provinces. */
export const consecrated = (b: Board, pi: number, ...ps: Province[]) => {
  realm(b, pi)['consecratedProvIds'] = ps.map((p) => p.id);
};
const place = (s: Staged, i: number) => must(s.places?.[i], 'place ' + String(i));
const hero = (s: Staged) => must(s.hero, 'the hero');
const other = (s: Staged, i: number) => must(s.others?.[i], 'hero ' + String(i));
const there = (s: Staged) => must(s.there, 'the province');

// ── Reading the outcome ──────────────────────────────────────────────────────────────────────────────────────────
export const char = (o: Outcome, c: Character) =>
  must(
    o.world.characters.find((x) => x.id === c.id),
    'hero ' + c.name,
  );
export const province = (o: Outcome, p: Province) => must(o.world.world.provinces[p.id], 'province ' + p.name);
export const realmOf = (o: Outcome, pi = 0) => must(o.world.players[pi], 'realm ' + String(pi));
/** The first line of the turn saying `what`, as the reports read it: its kind, who acts and who is told, its province
 *  and hero, whether it is public, a system line or a province event, its phase (null if no line says it). */
export const told = (o: Outcome, what: string) => {
  const l = o.all.find((x) => x.text.includes(what));
  return l
    ? {
        type: l.type,
        actor: l.actor ?? null,
        targets: l.targets ?? null,
        provinceId: l.provinceId,
        charId: l.charId,
        public: !!l['public'],
        system: !!l['system'],
        env: !!l['env'],
        phase: l.phase,
      }
    : null;
};
/** A realm's graveyard lore: province id → what it knows lies there (null: only that graves lie there). */
export const graveLore = (o: Outcome, i: number) =>
  Object.fromEntries(
    Object.entries(
      (realmOf(o, i)['_graveIntel'] as Record<string, { detail: { k: string; n: number }[] | null }> | undefined) ?? {},
    ).map(([k, v]) => [k, v.detail ? v.detail.map((d) => `${String(d.n)}× ${d.k}`) : null]),
  );
/** How many lines of the turn say `what`. */
export const count = (o: Outcome, what: string) => o.all.filter((l) => l.text.includes(what)).length;
/** The texts of the turn's lines after the phases (phase 99) that say `what`. */
export const afterPhases = (o: Outcome, what = '') =>
  o.all.filter((l) => l.phase === 99 && l.text.includes(what)).map((l) => l.text);
/** A hero's companies, as "<name> (<quality>)". */
export const column = (o: Outcome, c: Character) => char(o, c).armies.map((u) => `${u.unitName} (${u.quality})`);
/** A province's garrison, as "<name> (<quality>)". */
export const garrison = (o: Outcome, p: Province) =>
  province(o, p).garrisonArmies.map((u) => `${u.unitName} (${u.quality})`);
/** What a line told to a realm, a hero or a province looks like (`told`), with what isn't given as a line writes it. */
export const line = (x: Partial<NonNullable<ReturnType<typeof told>>>) => ({
  type: 'system',
  actor: null,
  targets: [],
  provinceId: null,
  charId: null,
  public: false,
  system: false,
  env: false,
  phase: 99,
  ...x,
});

// ── The dead need a master ──────────────────────────────────────────────────────────────────────────────────────
export const DEAD_HOLD = 'a skeletal host holds together only while a character of at least Necromancy 1 leads it.';
export const crumble = (parts: string[]) =>
  `💀 The dead will not stand alone. ${parts.join('; ')}. ${parts.length === 1 ? 'It crumbles' : 'They crumble'} to dust — ${DEAD_HOLD}`;
export const under = (n: number, c: Character, p: Province) =>
  `${String(n)} skeletal unit${n !== 1 ? 's' : ''} under ${c.name} in ${p.name} — ${c.name} has no Necromancy to hold them together`;
export const leftIn = (n: number, p: Province) =>
  `${String(n)} skeletal unit${n !== 1 ? 's' : ''} left to garrison ${p.name} — no one was left to command them`;
const bones = (n: number, label = 'Bones') => Array.from({ length: n }, (_, k) => skeletal(`${label} ${String(k)}`));

export const THE_DEAD_CASES: AfterThePhasesCase[] = [
  {
    name: 'a hero with no Necromancy loses the skeletal companies he leads, keeps the living, and his realm is told by name and place',
    stage(b) {
      const h = leads(at(b), [...bones(1), ...companies(1)]);
      return { hero: h, there: b.X, orders: [] };
    },
    check(o, s) {
      const t = crumble([under(1, hero(s), there(s))]);
      return {
        got: { column: column(o, hero(s)), told: told(o, t), once: count(o, 'The dead will not stand alone') },
        want: {
          column: ['Men-at-Arms c0 (Average)'],
          told: line({ type: 'hire', actor: 0, targets: [0], system: true }),
          once: 1,
        },
      };
    },
  },
  {
    name: 'a necromancer keeps the dead he leads standing',
    stage(b) {
      const h = leads(at(b, { necromancy: 1 }), bones(2));
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return {
        got: { column: column(o, hero(s)), told: count(o, 'The dead will not stand alone') },
        want: { column: ['Bones 0 (Average)', 'Bones 1 (Average)'], told: 0 },
      };
    },
  },
  {
    name: 'Necromancy from an item is Necromancy enough: the dead stay standing',
    stage(b) {
      const h = holding(leads(at(b), bones(1)), item(b, "Death's Finger Ring"));
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return {
        got: { column: column(o, hero(s)), told: count(o, 'The dead will not stand alone') },
        want: { column: ['Bones 0 (Average)'], told: 0 },
      };
    },
  },
  {
    name: "the dead set down in a garrison crumble, the living stay, and the province's lord is told",
    stage(b) {
      holdsOnly(b, 0, [b.X, 0]);
      b.X.garrisonArmies = [...bones(1), ...companies(1)];
      return { there: b.X, orders: [] };
    },
    check(o, s) {
      const t = crumble([leftIn(1, there(s))]);
      return {
        got: { garrison: garrison(o, there(s)), told: told(o, t) },
        want: {
          garrison: ['Men-at-Arms c0 (Average)'],
          told: line({ type: 'hire', actor: 0, targets: [0], system: true }),
        },
      };
    },
  },
  {
    name: 'one line a realm: two skeletal companies under a hero and a garrison of the dead, joined, and "They crumble"',
    stage(b) {
      const p = ring1(b, 0);
      holdsOnly(b, 0, [p, 0]);
      p.garrisonArmies = bones(3, 'Old');
      const h = leads(at(b), bones(2));
      return { hero: h, there: b.X, places: [p], orders: [] };
    },
    check(o, s) {
      return {
        got: {
          lines: afterPhases(o, 'The dead will not stand alone'),
          column: column(o, hero(s)),
          garrison: garrison(o, place(s, 0)),
        },
        want: {
          lines: [crumble([under(2, hero(s), there(s)), leftIn(3, place(s, 0))])],
          column: [],
          garrison: [],
        },
      };
    },
  },
  {
    name: 'two skeletal companies under one hero are one part of the line: "It crumbles"',
    stage(b) {
      const h = leads(at(b), bones(2));
      return { hero: h, there: b.X, orders: [] };
    },
    check(o, s) {
      return {
        got: { lines: afterPhases(o, 'The dead will not stand alone') },
        want: { lines: [crumble([under(2, hero(s), there(s))])] },
      };
    },
  },
  {
    name: 'each realm is told only of its own dead',
    stage(b) {
      const p = ring2(b, 0);
      const mine = leads(at(b), bones(1, 'Mine'));
      const ally = leads(at(b, {}, { player: 2, at: p }), bones(1, 'Theirs'));
      return { hero: mine, others: [ally], there: b.X, places: [p], orders: [] };
    },
    check(o, s) {
      const ours = crumble([under(1, hero(s), there(s))]);
      const theirs = crumble([under(1, other(s, 0), place(s, 0))]);
      return {
        got: {
          ours: told(o, ours)?.targets,
          theirs: told(o, theirs)?.targets,
          both: count(o, 'The dead will not stand alone'),
        },
        want: { ours: [0], theirs: [2], both: 2 },
      };
    },
  },
  {
    name: "a wandering hero's dead are left standing",
    stage(b) {
      const h = leads(wanderer(b), bones(1));
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return {
        got: { column: column(o, hero(s)), told: count(o, 'The dead will not stand alone') },
        want: { column: ['Bones 0 (Average)'], told: 0 },
      };
    },
  },
  {
    name: 'the dead in a garrison nobody holds crumble, and nobody is told',
    stage(b) {
      const p = ring1(b, 0);
      p.garrisonArmies = [...bones(1), ...companies(1)];
      return { there: p, orders: [] };
    },
    check(o, s) {
      return {
        got: { garrison: garrison(o, there(s)), told: count(o, 'The dead will not stand alone') },
        want: { garrison: ['Men-at-Arms c0 (Average)'], told: 0 },
      };
    },
  },
];

// ── Graves underfoot ────────────────────────────────────────────────────────────────────────────────────────────
export const feels = (c: Character, p: Province) =>
  `💀 ${c.name} feels the dead of ${p.name} stirring underfoot — battlefield graves lie in this province, though nothing tells how many or what they hold.`;
const rests = (n: number) => Array.from({ length: n }, () => order('rest'));
export const GRAVES_CASES: AfterThePhasesCase[] = [
  {
    name: 'a necromancer who never moved senses the graves where he stands; his realm learns only that they are there',
    stage(b) {
      bury(b.X, 2);
      const h = at(b, { necromancy: 1 });
      return { hero: h, there: b.X, orders: [] };
    },
    check(o, s) {
      return {
        got: { told: told(o, feels(hero(s), there(s))), lore: graveLore(o, 0), once: count(o, 'stirring underfoot') },
        want: {
          told: line({ type: 'explore', actor: 0, targets: [0], provinceId: there(s).id }),
          lore: { [String(there(s).id)]: null },
          once: 1,
        },
      };
    },
  },
  {
    name: 'on bare ground a necromancer is told nothing, and his realm forgets the graves it thought lay there',
    stage(b) {
      const h = at(b, { necromancy: 1 });
      const elsewhere = ring2(b, 0);
      realm(b, 0)['_graveIntel'] = {
        [String(b.X.id)]: { turn: b.G.turn - 1, detail: null },
        [String(elsewhere.id)]: { turn: b.G.turn - 1, detail: null },
      };
      return { hero: h, there: b.X, places: [elsewhere], orders: [] };
    },
    check(o, s) {
      return {
        got: { told: count(o, 'stirring underfoot'), lore: graveLore(o, 0) },
        want: { told: 0, lore: { [String(place(s, 0).id)]: null } },
      };
    },
  },
  {
    name: 'a hero with no Necromancy senses nothing, and his realm learns nothing',
    stage(b) {
      bury(b.X, 2);
      at(b);
      return { orders: [] };
    },
    check(o) {
      return { got: { told: count(o, 'stirring underfoot'), lore: graveLore(o, 0) }, want: { told: 0, lore: {} } };
    },
  },
  {
    name: 'a necromancer who marched in read the ground as he arrived, and is not told again after the phases',
    wholeTurnOnly: true,
    stage(b) {
      bury(b.X, 1);
      const h = at(b, { necromancy: 1 }, { at: ring1(b, 0) });
      return { hero: h, there: b.X, orders: [[h, [order('move', b.X.id), ...rests(4)]]] };
    },
    check(o, s) {
      return {
        got: {
          onArrival: told(o, `${hero(s).name} crosses into ${there(s).name} and the dead stir underfoot`)?.phase,
          after: count(o, 'stirring underfoot'),
        },
        want: { onArrival: 0, after: 0 },
      };
    },
  },
  {
    name: 'a wandering necromancer senses nothing for any realm',
    stage(b) {
      bury(b.X, 1);
      wanderer(b, { necromancy: 2 });
      return { orders: [] };
    },
    check(o) {
      return { got: { told: count(o, 'stirring underfoot') }, want: { told: 0 } };
    },
  },
];

// ── Neutral heroes learn ───────────────────────────────────────────────────────────────────────────────────────
const NEUTRAL_FROM = 5; // NEUTRAL_PROG_FROM_TURN
export const hones = (c: Character, p: Province, skill: string, to: number) =>
  `📜 ${c.name.replace(' (wandering)', '')} in ${p.name} hones their craft — ${skill} rises to ${String(to)}.`;
export const NEUTRAL_CASES: AfterThePhasesCase[] = [
  {
    name: 'from turn 5 a wandering hero alone may hone his best skill, a line nobody is sent',
    dice: { roll: 1, die: 0 },
    stage(b) {
      b.G.turn = NEUTRAL_FROM;
      const h = wanderer(b, { melee: 3, tactical: 1, march: 0 });
      return { hero: h, there: b.X, orders: [] };
    },
    check(o, s) {
      return {
        got: { melee: char(o, hero(s)).skills['melee'], told: told(o, hones(hero(s), there(s), 'Melee', 4)) },
        want: { melee: 4, told: line({ provinceId: there(s).id, system: true }) },
      };
    },
  },
  {
    name: 'before turn 5 a wandering hero learns nothing',
    dice: { roll: 1, die: 0 },
    stage(b) {
      b.G.turn = NEUTRAL_FROM - 1;
      const h = wanderer(b, { melee: 3, tactical: 1, march: 0 });
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return {
        got: { melee: char(o, hero(s)).skills['melee'], told: count(o, 'hones their craft') },
        want: { melee: 3, told: 0 },
      };
    },
  },
];

// ── Consecrated ground lost ─────────────────────────────────────────────────────────────────────────────────────
export const unblessed = (p: Province, realmName: string) =>
  `✨ The consecration of ${p.name} is broken — it has passed from ${realmName}'s hands, and the hallowed light departs. The crown may sanctify new ground in its place.`;
export const CONSECRATION_CASES: AfterThePhasesCase[] = [
  {
    name: 'a consecrated province an enemy now holds loses its blessing, told to the realm and on the map; the rest keep theirs',
    stage(b) {
      const gone = ring1(b, 0);
      holdsOnly(b, 0, [b.X, 0]);
      b.own(gone, 1);
      consecrated(b, 0, b.X, gone);
      return { there: gone, places: [b.X], orders: [] };
    },
    check(o, s) {
      return {
        got: {
          told: told(o, unblessed(there(s), realmOf(o).name)),
          kept: realmOf(o)['consecratedProvIds'],
          once: count(o, 'The consecration of'),
        },
        want: {
          told: line({ actor: 0, targets: [0], provinceId: there(s).id, public: true, env: true }),
          kept: [place(s, 0).id],
          once: 1,
        },
      };
    },
  },
  {
    name: 'ground nobody holds any more is unblessed too',
    stage(b) {
      const gone = ring1(b, 0);
      holdsOnly(b, 0, [b.X, 0]);
      consecrated(b, 0, gone, b.X);
      return { there: gone, places: [b.X], orders: [] };
    },
    check(o, s) {
      return {
        got: { told: count(o, unblessed(there(s), realmOf(o).name)), kept: realmOf(o)['consecratedProvIds'] },
        want: { told: 1, kept: [place(s, 0).id] },
      };
    },
  },
  {
    name: 'ground the realm still holds keeps its blessing, and nothing is told',
    stage(b) {
      const p = ring1(b, 0);
      holdsOnly(b, 0, [b.X, 0], [p, 0]);
      consecrated(b, 0, b.X, p);
      return { there: p, places: [b.X], orders: [] };
    },
    check(o, s) {
      return {
        got: { told: count(o, 'The consecration of'), kept: realmOf(o)['consecratedProvIds'] },
        want: { told: 0, kept: [place(s, 0).id, there(s).id] },
      };
    },
  },
  {
    name: "an old save's single consecrated province is read as the realm's list, and lost like any other",
    stage(b) {
      const gone = ring1(b, 0);
      holdsOnly(b, 0, [b.X, 0]);
      realm(b, 0)['consecratedProvId'] = gone.id;
      return { there: gone, orders: [] };
    },
    check(o, s) {
      return {
        got: {
          told: count(o, unblessed(there(s), realmOf(o).name)),
          kept: realmOf(o)['consecratedProvIds'],
          old: 'consecratedProvId' in realmOf(o),
        },
        want: { told: 1, kept: [], old: false },
      };
    },
  },
  {
    name: 'two provinces lost: each told, in the order the realm consecrated them',
    stage(b) {
      const a = ring1(b, 0);
      const c = ring1(b, 1);
      holdsOnly(b, 0, [b.X, 0]);
      consecrated(b, 0, c, b.X, a);
      return { places: [c, a], orders: [] };
    },
    check(o, s) {
      return {
        got: { lines: afterPhases(o, 'The consecration of') },
        want: { lines: [unblessed(place(s, 0), realmOf(o).name), unblessed(place(s, 1), realmOf(o).name)] },
      };
    },
  },
  {
    name: 'each realm is told of its own ground in its own name',
    stage(b) {
      const gone = ring1(b, 0);
      holdsOnly(b, 2, [b.X, 0]);
      consecrated(b, 2, gone);
      return { there: gone, orders: [] };
    },
    check(o, s) {
      return {
        got: { told: told(o, unblessed(there(s), realmOf(o, 2).name)), kept: realmOf(o, 2)['consecratedProvIds'] },
        want: { told: line({ actor: 2, targets: [2], provinceId: there(s).id, public: true, env: true }), kept: [] },
      };
    },
  },
];

// ── Couriers ────────────────────────────────────────────────────────────────────────────────────────────────────
export const reaches = (c: Character, what: string, from?: string) =>
  `📦 A courier reaches ${c.name} with ${what}${from ? ` from ${from}` : ''} — delivered as the season closes, ready to use next turn.`;
export const lostParcel = (what: string, from?: string) =>
  `📦 A courier bearing ${what}${from ? ` from ${from}` : ''} finds no one left to receive it — the parcel is lost.`;
export const itemNames = (o: Outcome, c: Character) => char(o, c).items.map((i) => String(i['name']));
const deliveries = (o: Outcome) => (o.world as unknown as Record<string, unknown>)['_itemDeliveries'];
export const COURIER_CASES: AfterThePhasesCase[] = [
  {
    name: 'a parcel reaches a living hero as the season closes: in his pack, told, then how he wears it; his maximum HP rises at once',
    stage(b) {
      const h = at(b);
      parcel(b, h.id, [item(b, 'Amulet of Fortitude'), item(b, 'Iron Heart Talisman')], 'Old Sender');
      return { hero: h, there: b.X, orders: [] };
    },
    check(o, s) {
      const h = hero(s);
      const t = reaches(h, 'Amulet of Fortitude, Iron Heart Talisman', 'Old Sender');
      const lines = o.all.map((l) => l.text);
      return {
        got: {
          told: told(o, t),
          then: lines[lines.indexOf(t) + 1],
          thenTold: told(o, '🎒 '),
          items: itemNames(o, h),
          hp: [char(o, h).hp, char(o, h).maxHp],
          noRise: count(o, 'maximum HP rises'),
          waiting: deliveries(o),
        },
        want: {
          told: line({ type: 'hire', actor: 0, targets: [0], charId: h.id }),
          then: `🎒 ${h.name} equips the Amulet of Fortitude at once. ${h.name} has no room to equip the Iron Heart Talisman: the amulet slot already holds the Amulet of Fortitude, so it goes in the pack (an Equip Items order can swap it in).`,
          thenTold: line({ type: 'hire', actor: 0, targets: [0], charId: h.id }),
          items: ['Amulet of Fortitude', 'Iron Heart Talisman'],
          hp: [28, 28],
          noRise: 0,
          waiting: [],
        },
      };
    },
  },
  {
    name: 'a parcel with no sender named says only what it carries',
    stage(b) {
      const h = at(b);
      parcel(b, h.id, [item(b, 'Iron Heart Talisman')]);
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return { got: { told: count(o, reaches(hero(s), 'Iron Heart Talisman')) }, want: { told: 1 } };
    },
  },
  {
    name: "the recipient fell this turn: the parcel goes to his realm's king, not another of its heroes",
    stage(b) {
      at(b, {}, { at: ring1(b, 1) });
      const k = at(b, {}, { king: true, at: ring1(b, 0) });
      const h = at(b);
      h.alive = false;
      parcel(b, h.id, [item(b, 'Iron Heart Talisman')], 'A Friend');
      return { hero: h, others: [k], orders: [] };
    },
    check(o, s) {
      const k = other(s, 0);
      return {
        got: {
          told: told(o, reaches(k, 'Iron Heart Talisman', 'A Friend')),
          king: itemNames(o, k),
          fallen: itemNames(o, hero(s)),
        },
        want: {
          told: line({ type: 'hire', actor: 0, targets: [0], charId: k.id }),
          king: ['Iron Heart Talisman'],
          fallen: [],
        },
      };
    },
  },
  {
    name: "a fallen hero's parcel goes to his own realm's king, not another realm's",
    stage(b) {
      const theirs = at(b, {}, { king: true, at: ring1(b, 1) });
      const ours = at(b, {}, { king: true, player: 2, at: ring1(b, 0) });
      const h = at(b, {}, { player: 2 });
      h.alive = false;
      parcel(b, h.id, [item(b, 'Iron Heart Talisman')]);
      return { hero: h, others: [ours, theirs], orders: [] };
    },
    check(o, s) {
      return {
        got: { ours: itemNames(o, other(s, 0)), theirs: itemNames(o, other(s, 1)) },
        want: { ours: ['Iron Heart Talisman'], theirs: [] },
      };
    },
  },
  {
    name: 'the recipient fell and his realm has no king left: the parcel is lost, told to nobody',
    stage(b) {
      const h = at(b);
      h.alive = false;
      parcel(b, h.id, [item(b, 'Iron Heart Talisman'), item(b, 'Amulet of Fortitude')], 'A Friend');
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return {
        got: {
          told: told(o, lostParcel('Iron Heart Talisman, Amulet of Fortitude', 'A Friend')),
          fallen: itemNames(o, hero(s)),
        },
        want: { told: line({ type: 'hire' }), fallen: [] },
      };
    },
  },
  {
    name: 'a parcel for a hero the world has no record of is lost',
    stage(b) {
      parcel(b, 8999, [item(b, 'Iron Heart Talisman')]);
      return { orders: [] };
    },
    check(o) {
      return {
        got: { told: count(o, lostParcel('Iron Heart Talisman')), waiting: deliveries(o) },
        want: { told: 1, waiting: [] },
      };
    },
  },
  {
    name: "a fallen wanderer's parcel is lost: he has no king",
    stage(b) {
      const k = at(b, {}, { king: true });
      const h = wanderer(b);
      h.alive = false;
      parcel(b, h.id, [item(b, 'Iron Heart Talisman')]);
      return { others: [k], orders: [] };
    },
    check(o, s) {
      return {
        got: { told: count(o, lostParcel('Iron Heart Talisman')), king: itemNames(o, other(s, 0)) },
        want: { told: 1, king: [] },
      };
    },
  },
  {
    name: 'a parcel emptied on the road (a Grand Heist) is no parcel: nothing told, nothing given',
    stage(b) {
      const h = at(b);
      parcel(b, h.id, []);
      parcel(b, 8999, []);
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return {
        got: { told: count(o, 'A courier'), items: itemNames(o, hero(s)), waiting: deliveries(o) },
        want: { told: 0, items: [], waiting: [] },
      };
    },
  },
  {
    name: 'two parcels to two heroes: each delivered, in the order they were sent',
    stage(b) {
      const a = at(b);
      const c = at(b, {}, { at: ring1(b, 0) });
      parcel(b, c.id, [item(b, 'Iron Heart Talisman')]);
      parcel(b, a.id, [item(b, 'Runic Ale-Horn')]);
      return { hero: a, others: [c], orders: [] };
    },
    check(o, s) {
      return {
        got: { lines: afterPhases(o, 'A courier reaches') },
        want: { lines: [reaches(other(s, 0), 'Iron Heart Talisman'), reaches(hero(s), 'Runic Ale-Horn')] },
      };
    },
  },
];

// ── Elven companies make for home ──────────────────────────────────────────────────────────────────────────────
export const foundHome = (us: string[], p: Province) =>
  `🍃 ${us.join(', ')} (${String(us.length)} unit${us.length !== 1 ? 's' : ''}) slipped away from battle and have found their way home to ${p.name}, rejoining the garrison there.`;
export const nowhereHome = (n: number, realmName: string) =>
  `🍃 ${String(n)} Elven unit${n !== 1 ? 's' : ''} broke free of battle and made for home — but ${realmName} holds no land left to return to, and they scatter into the wild, lost.`;
const elves = (n: number, label = 'Elves') =>
  companies(n, 'Elven Archers', 'Average', label).map((u) => ({ ...u, race: 'Elven' }));
/** Realm 0 is Elven, its host in the middle facing realm 1's at war there from the turn's start: the war front at the
 *  end of Spring, at the lowest die, leaves neither side a company, and every Elven company slips away. */
const elvenBattle = (b: Board) => {
  realm(b, 0)['race'] = 'Elven';
  const h = leads(at(b), elves(2));
  const foe = rival(b, { troops: 2 });
  return { h, foe };
};
export const ELVEN_CASES: AfterThePhasesCase[] = [
  {
    name: 'Elven companies that slipped a lost battle reach home after the phases and join its garrison',
    wholeTurnOnly: true,
    dice: { roll: 1, die: 0 },
    stage(b) {
      const home = ring2(b, 0);
      holdsOnly(b, 0, [home, 3]);
      seat(b, 0, home);
      const { h, foe } = elvenBattle(b);
      return { hero: h, others: [foe], there: home, orders: [stays(h), stays(foe)] };
    },
    check(o, s) {
      const t = foundHome(['Elves c0', 'Elves c1'], there(s));
      return {
        got: { told: told(o, t), garrison: garrison(o, there(s)) },
        want: {
          told: line({ type: 'combat', actor: 0, targets: [0], provinceId: there(s).id }),
          garrison: ['Elves c0 (Average)', 'Elves c1 (Average)'],
        },
      };
    },
  },
  {
    name: 'a realm with no land left: its Elven companies scatter into the wild, and it is told',
    wholeTurnOnly: true,
    dice: { roll: 1, die: 0 },
    stage(b) {
      holdsOnly(b, 0);
      const { h, foe } = elvenBattle(b);
      return { hero: h, others: [foe], orders: [stays(h), stays(foe)] };
    },
    check(o) {
      const t = nowhereHome(2, realmOf(o).name);
      return {
        got: { told: told(o, t), anyHome: count(o, 'have found their way home') },
        want: { told: line({ type: 'combat', targets: [0] }), anyHome: 0 },
      };
    },
  },
  {
    name: "the escape goes to the realm's seat while it holds it, else its richest province",
    wholeTurnOnly: true,
    dice: { roll: 1, die: 0 },
    stage(b) {
      const poor = ring2(b, 0);
      const rich = ring2(b, 1);
      holdsOnly(b, 0, [poor, 1], [rich, 6]);
      seat(b, 0, ring2(b, 2));
      const { h, foe } = elvenBattle(b);
      return { hero: h, others: [foe], there: rich, places: [poor], orders: [stays(h), stays(foe)] };
    },
    check(o, s) {
      return {
        got: { rich: garrison(o, there(s)), poor: garrison(o, place(s, 0)) },
        want: { rich: ['Elves c0 (Average)', 'Elves c1 (Average)'], poor: [] },
      };
    },
  },
];

// ── A fallen commander's host, intrusions, lair guardians ──────────────────────────────────────────────────────
export const LOOSE_ENDS_CASES: AfterThePhasesCase[] = [
  {
    name: 'a living hero carries no leaderless-host mark into the next turn',
    stage(b) {
      const h = leads(at(b), companies(1));
      h._leaderlessHost = true;
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return { got: { mark: '_leaderlessHost' in char(o, hero(s)) }, want: { mark: false } };
    },
  },
  {
    name: 'a commander who fell with no host keeps no note of his killer, nor a leaderless-host mark',
    stage(b) {
      const h = at(b);
      Object.assign(h, { alive: false, hp: 0, _slainBy: { killerName: 'Some Rival' }, _leaderlessHost: true });
      b.X.characters = [];
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return {
        got: { slainBy: '_slainBy' in char(o, hero(s)), mark: '_leaderlessHost' in char(o, hero(s)) },
        want: { slainBy: false, mark: false },
      };
    },
  },
  {
    name: 'an enemy hero in the realm all turn is told once, after the phases, for every season he was seen',
    wholeTurnOnly: true,
    stage(b) {
      holdsOnly(b, 0, [b.X, 0]);
      const foe = rival(b);
      return { hero: foe, there: b.X, orders: [] };
    },
    check(o, s) {
      const t = `[Intelligence] ${hero(s).name} of ${realmOf(o, 1).name} was spotted in your province of ${there(s).name} during Spring–Early Winter. They appear to be leading no armies.`;
      return {
        got: { told: told(o, t), once: count(o, '[Intelligence]') },
        want: { told: line({ type: 'combat', targets: [0], provinceId: there(s).id }), once: 1 },
      };
    },
  },
  {
    name: 'a wounded lair guardian recovers between turns; one with no full measure on record is left as it is',
    stage(b) {
      (b.G as unknown as Record<string, unknown>)['_guardianHpV2'] = true; // no old world's re-measuring this turn
      b.X['features'] = [
        { type: 'lair', name: 'Old Den', monster: { name: 'Old Wolf', hp: 2, _hpFull: 9 } },
        { type: 'lair', name: 'New Den', monster: { name: 'Young Wolf', hp: 3 } },
      ];
      return { there: b.X, orders: [] };
    },
    check(o, s) {
      const fs = province(o, there(s))['features'] as { monster: { hp: number } }[];
      return { got: { hp: fs.map((f) => f.monster.hp) }, want: { hp: [9, 3] } };
    },
  },
];

// ── Mass Healing ────────────────────────────────────────────────────────────────────────────────────────────────
export const mends = (healer: Character, t: Character, gain: number, hp: number, max: number) =>
  `✨ ${healer.name}'s Mass Healing washes over ${t.id === healer.id ? 'them' : t.name} — ${t.id === healer.id ? 'their' : t.name + "'s"} wounds close (+${String(gain)} HP → ${String(hp)}/${String(max)}${hp >= max ? ', fully restored' : ''}).`;
const MASTER = { white: 6 };
const hpOf = (o: Outcome, c: Character) => char(o, c).hp;
export const MASS_HEALING_CASES: AfterThePhasesCase[] = [
  {
    name: 'a White master mends himself and every wounded friend beside him by half their maximum HP, to their maximum',
    stage(b) {
      const healer = wounded(at(b, MASTER), 10);
      const comrade = wounded(at(b), 5);
      const ally = wounded(at(b, {}, { player: 2 }), 18);
      return {
        hero: healer,
        others: [comrade, ally],
        there: b.X,
        orders: [stays(healer), stays(comrade), stays(ally)],
      };
    },
    check(o, s) {
      const [h, c, a] = [hero(s), other(s, 0), other(s, 1)];
      return {
        got: {
          lines: afterPhases(o, 'Mass Healing'),
          told: [told(o, mends(h, h, 10, 20, 20)), told(o, mends(h, c, 10, 15, 20)), told(o, mends(h, a, 2, 20, 20))],
          hp: [hpOf(o, h), hpOf(o, c), hpOf(o, a)],
        },
        want: {
          lines: [mends(h, h, 10, 20, 20), mends(h, c, 10, 15, 20), mends(h, a, 2, 20, 20)],
          told: [
            line({ actor: 0, targets: [0], charId: h.id, provinceId: there(s).id }),
            line({ actor: 0, targets: [0], charId: c.id, provinceId: there(s).id }),
            line({ actor: 2, targets: [2], charId: a.id, provinceId: there(s).id }),
          ],
          hp: [20, 15, 20],
        },
      };
    },
  },
  {
    name: 'not an enemy, a wanderer, a realm at peace with his, nor a friend in another province',
    stage(b) {
      const healer = at(b, MASTER, { player: 2 });
      const foe = wounded(at(b, {}, { player: 1 }), 5);
      const rover = wounded(wanderer(b), 5);
      const away = wounded(at(b, {}, { player: 2, at: ring1(b, 0) }), 5);
      return {
        hero: healer,
        others: [foe, rover, away],
        orders: [stays(healer), stays(foe), stays(away)],
      };
    },
    check(o, s) {
      // the wanderer mends by resting (no realm gives him orders): what matters is that no line names him
      return {
        got: { told: count(o, 'Mass Healing'), hp: [0, 2].map((i) => hpOf(o, other(s, i))) },
        want: { told: 0, hp: [5, 5] },
      };
    },
  },
  {
    name: 'White 5 is not mastery enough: nobody is mended',
    stage(b) {
      const healer = wounded(at(b, { white: 5 }), 10);
      const comrade = wounded(at(b), 5);
      return { hero: healer, others: [comrade], orders: [stays(healer), stays(comrade)] };
    },
    check(o, s) {
      return {
        got: { told: count(o, 'Mass Healing'), hp: [hpOf(o, hero(s)), hpOf(o, other(s, 0))] },
        want: { told: 0, hp: [10, 5] },
      };
    },
  },
  {
    name: 'two masters in one place mend each friend once, the first in the roll of heroes doing it',
    stage(b) {
      const first = at(b, MASTER);
      const second = wounded(at(b, MASTER), 4);
      const comrade = wounded(at(b), 4);
      return { hero: first, others: [second, comrade], orders: [stays(first), stays(second), stays(comrade)] };
    },
    check(o, s) {
      const [f, n, c] = [hero(s), other(s, 0), other(s, 1)];
      return {
        got: { lines: afterPhases(o, 'Mass Healing'), hp: [hpOf(o, n), hpOf(o, c)] },
        want: { lines: [mends(f, n, 10, 14, 20), mends(f, c, 10, 14, 20)], hp: [14, 14] },
      };
    },
  },
  {
    name: 'a wandering master mends nobody, and a friend at full health is told nothing',
    stage(b) {
      const rover = wanderer(b, MASTER);
      const master = at(b, MASTER, { at: ring1(b, 0) });
      const whole = at(b, {}, { at: ring1(b, 0) });
      const hurt = wounded(at(b), 3);
      return { hero: rover, others: [master, whole, hurt], orders: [stays(master), stays(whole), stays(hurt)] };
    },
    check(o, s) {
      return {
        got: { told: count(o, 'Mass Healing'), hp: hpOf(o, other(s, 2)) },
        want: { told: 0, hp: 3 },
      };
    },
  },
  {
    name: 'a fallen master mends nobody',
    stage(b) {
      const master = at(b, MASTER);
      Object.assign(master, { alive: false, hp: 0 });
      b.X.characters = b.X.characters.filter((id) => id !== master.id);
      const hurt = wounded(at(b), 3);
      return { hero: master, others: [hurt], orders: [stays(hurt)] };
    },
    check(o, s) {
      return { got: { told: count(o, 'Mass Healing'), hp: hpOf(o, other(s, 0)) }, want: { told: 0, hp: 3 } };
    },
  },
  {
    name: 'a fallen friend beside a living master is not mended',
    stage(b) {
      const master = at(b, MASTER);
      const d = at(b);
      Object.assign(d, { alive: false, hp: 0 });
      b.X.characters = b.X.characters.filter((id) => id !== d.id);
      return { hero: master, others: [d], orders: [stays(master)] };
    },
    check(o, s) {
      return { got: { told: count(o, 'Mass Healing'), hp: hpOf(o, other(s, 0)) }, want: { told: 0, hp: 0 } };
    },
  },
  {
    name: 'half a maximum is rounded up: a hero of 21 HP is mended by 11',
    stage(b) {
      const healer = at(b, MASTER);
      const big = wounded(at(b, {}, { hp: 21 }), 2);
      return { hero: healer, others: [big], orders: [stays(healer), stays(big)] };
    },
    check(o, s) {
      return {
        got: { line: afterPhases(o, 'Mass Healing'), hp: hpOf(o, other(s, 0)) },
        want: { line: [mends(hero(s), other(s, 0), 11, 13, 21)], hp: 13 },
      };
    },
  },
];

// ── Maximum HP ──────────────────────────────────────────────────────────────────────────────────────────────────
export const reckoning = (c: Character, old: number, nu: number) =>
  `📜 A new reckoning of vigour: ${c.name}'s maximum HP is now earned in battle rather than set by skill — ${String(old)} becomes ${String(nu)}. Victories over lair guardians and enemy commanders will raise it from here.`;
/** A hero of an old save, from before the earned-HP pool: no pool on record, his maximum HP as the old formula set it. */
const oldSave = (c: Character, max: number) => {
  delete c['hpEarned'];
  c.maxHp = max;
  c.hp = max;
  return c;
};
export const MAX_HP_CASES: AfterThePhasesCase[] = [
  {
    name: "an old save's heroes carried over to the earned-HP pool: each realm told of its own once, after the phases, publicly",
    wholeTurnOnly: true,
    stage(b) {
      delete (b.G as unknown as Record<string, unknown>)['_maxHpV3'];
      const mine = oldSave(at(b), 80);
      const ally = oldSave(at(b, {}, { player: 2, at: ring1(b, 0) }), 70);
      const rover = oldSave(wanderer(b, {}, { at: ring2(b, 0) }), 90);
      return { hero: mine, others: [ally, rover], orders: [] };
    },
    check(o, s) {
      const [m, a, r] = [hero(s), other(s, 0), other(s, 1)];
      return {
        got: {
          lines: afterPhases(o, 'A new reckoning of vigour'),
          told: told(o, reckoning(m, 80, 60)),
          max: [m, a, r].map((c) => char(o, c).maxHp),
          kept: '_maxHpMigration' in o.world,
        },
        want: {
          lines: [reckoning(m, 80, 60), reckoning(a, 70, 60)],
          told: line({ actor: 0, targets: [0], charId: m.id, public: true }),
          max: [60, 60, 60],
          kept: false,
        },
      };
    },
  },
];

// ── Cowards go home ─────────────────────────────────────────────────────────────────────────────────────────────
export const goesHome = (c: Character, p: Province) =>
  `🏳 ${c.name}, spared on the field, makes their way back to ${p.name}.`;
export const fallsInUnder = (c: Character, n: number, p: Province, heir: Character) =>
  `🏳 ${c.name} begged for his life and is gone, but his host does not follow him: ${String(n)} unit${n !== 1 ? 's' : ''} hold their ground in ${p.name} and fall in under ${heir.name}.`;
export const joinsGarrison = (c: Character, n: number, p: Province) =>
  `🏳 ${c.name} abandons his command in ${p.name} — with no officer left to lead them, ${String(n)} unit${n !== 1 ? 's' : ''} of his host take their place in the province garrison.`;
export const leftLeaderless = (c: Character, n: number, p: Province) =>
  `🏳 ${c.name} slips away from ${p.name} with his life, leaving ${String(n)} unit${n !== 1 ? 's' : ''} leaderless on ground the realm does not hold.`;
const whereIs = (o: Outcome, c: Character) => {
  const h = char(o, c);
  const here = o.world.world.provinces.filter((p) => p.characters.includes(c.id)).map((p) => p.id);
  return { at: h.location, name: h['locationName'], listed: here };
};
const standsIn = (p: Province) => ({ at: p.id, name: p.name, listed: [p.id] });
/** Realm 0 holds the middle (its seat) and nothing else; a coward of realm 0 who begged for mercy this turn stands at
 *  `where` (a neighbour), leading two companies. */
const coward = (b: Board, where: Province, troops = 2) => {
  holdsOnly(b, 0, [b.X, 0]);
  seat(b, 0, b.X);
  return spared(at(b, {}, { at: where, troops }), b.G.turn);
};
export const COWARD_CASES: AfterThePhasesCase[] = [
  {
    name: 'a coward spared this turn makes his way home after the phases; his host falls in under a comrade where he fled',
    stage(b) {
      const p = ring1(b, 0);
      const c = coward(b, p);
      const comrade = at(b, {}, { at: p, troops: 1 });
      return { hero: c, others: [comrade], there: p, places: [b.X], orders: [] };
    },
    check(o, s) {
      const [c, m, home] = [hero(s), other(s, 0), place(s, 0)];
      return {
        got: {
          told: told(o, goesHome(c, home)),
          host: told(o, fallsInUnder(c, 2, there(s), m)),
          where: whereIs(o, c),
          column: column(o, c),
          comrade: column(o, m).length,
        },
        want: {
          told: line({ actor: 0, targets: [0], charId: c.id, provinceId: home.id }),
          host: line({ actor: 0, targets: [0], charId: m.id, provinceId: there(s).id }),
          where: standsIn(home),
          column: [],
          comrade: 3,
        },
      };
    },
  },
  {
    name: "on ground his realm holds, with no comrade there, a coward's host takes its place in the garrison",
    stage(b) {
      const p = ring1(b, 0);
      const c = coward(b, p);
      b.own(p, 0);
      return { hero: c, there: p, places: [b.X], orders: [] };
    },
    check(o, s) {
      const c = hero(s);
      return {
        got: {
          host: told(o, joinsGarrison(c, 2, there(s))),
          garrison: garrison(o, there(s)).length,
          where: whereIs(o, c),
        },
        want: {
          host: line({ actor: 0, targets: [0], provinceId: there(s).id }),
          garrison: 2,
          where: standsIn(place(s, 0)),
        },
      };
    },
  },
  {
    name: "on ground his realm doesn't hold, with nobody to lead it, a coward's host is left leaderless and falls back to friendly land",
    stage(b) {
      const p = ring1(b, 0);
      const c = coward(b, p);
      b.own(p, 2);
      return { hero: c, there: p, places: [b.X], orders: [] };
    },
    check(o, s) {
      const c = hero(s);
      return {
        got: {
          host: told(o, leftLeaderless(c, 2, there(s))),
          home: garrison(o, place(s, 0)).length + garrison(o, there(s)).length,
          where: whereIs(o, c),
        },
        want: {
          host: line({ actor: 0, targets: [0], provinceId: there(s).id }),
          home: 2,
          where: standsIn(place(s, 0)),
        },
      };
    },
  },
  {
    name: 'a coward already home stays, his host with him, and nothing is told',
    stage(b) {
      const c = coward(b, b.X);
      return { hero: c, there: b.X, orders: [] };
    },
    check(o, s) {
      return {
        got: { told: count(o, '🏳'), column: column(o, hero(s)).length, where: whereIs(o, hero(s)) },
        want: { told: 0, column: 2, where: standsIn(there(s)) },
      };
    },
  },
  {
    name: 'a hero spared on an earlier turn is no coward now: he stays where he is, with his host',
    stage(b) {
      const p = ring1(b, 0);
      const c = spared(coward(b, p), b.G.turn - 1);
      return { hero: c, there: p, orders: [] };
    },
    check(o, s) {
      return {
        got: { told: count(o, '🏳'), column: column(o, hero(s)).length, where: whereIs(o, hero(s)) },
        want: { told: 0, column: 2, where: standsIn(there(s)) },
      };
    },
  },
  {
    name: 'a realm with no land left: its coward stays where he fled, with his host',
    stage(b) {
      const p = ring1(b, 0);
      const c = coward(b, p);
      holdsOnly(b, 0);
      return { hero: c, there: p, orders: [] };
    },
    check(o, s) {
      return {
        got: { told: count(o, '🏳'), column: column(o, hero(s)).length, where: whereIs(o, hero(s)).at },
        want: { told: 0, column: 2, where: there(s).id },
      };
    },
  },
  {
    name: "a coward's home is his realm's seat while it holds it, else its richest province",
    stage(b) {
      const p = ring1(b, 0);
      const c = coward(b, p, 0);
      const poor = ring2(b, 0);
      const rich = ring2(b, 1);
      holdsOnly(b, 0, [poor, 1], [rich, 6]);
      return { hero: c, there: rich, orders: [] };
    },
    check(o, s) {
      return {
        got: { told: count(o, goesHome(hero(s), there(s))), where: whereIs(o, hero(s)) },
        want: { told: 1, where: standsIn(there(s)) },
      };
    },
  },
  {
    name: "an allied realm's coward goes to his own realm's seat, and his own realm is told",
    stage(b) {
      holdsOnly(b, 0, [b.X, 0]);
      seat(b, 0, b.X);
      const home = ring2(b, 0);
      holdsOnly(b, 2, [home, 0]);
      seat(b, 2, home);
      const c = spared(at(b, {}, { player: 2, at: ring1(b, 0) }), b.G.turn);
      return { hero: c, there: home, orders: [] };
    },
    check(o, s) {
      return {
        got: { told: told(o, goesHome(hero(s), there(s))), where: whereIs(o, hero(s)) },
        want: {
          told: line({ actor: 2, targets: [2], charId: hero(s).id, provinceId: there(s).id }),
          where: standsIn(there(s)),
        },
      };
    },
  },
  {
    name: 'a coward who fell stays where he lies',
    stage(b) {
      const p = ring1(b, 0);
      const c = coward(b, p, 0);
      Object.assign(c, { alive: false, hp: 0 });
      p.characters = [];
      return { hero: c, there: p, orders: [] };
    },
    check(o, s) {
      return {
        got: { told: count(o, '🏳'), where: char(o, hero(s)).location },
        want: { told: 0, where: there(s).id },
      };
    },
  },
];

// ── Location names ──────────────────────────────────────────────────────────────────────────────────────────────
export const LOCATION_NAME_CASES: AfterThePhasesCase[] = [
  {
    name: "every hero's location name is the province he stands in, the fallen too",
    stage(b) {
      const h = at(b);
      h['locationName'] = 'Somewhere Old';
      const p = ring1(b, 0);
      const d = at(b, {}, { at: p });
      Object.assign(d, { alive: false, hp: 0, locationName: 'Elsewhere' });
      p.characters = [];
      return { hero: h, others: [d], there: b.X, places: [p], orders: [] };
    },
    check(o, s) {
      return {
        got: { names: [char(o, hero(s))['locationName'], char(o, other(s, 0))['locationName']] },
        want: { names: [there(s).name, place(s, 0).name] },
      };
    },
  },
];

// ── The order of it all ─────────────────────────────────────────────────────────────────────────────────────────
/** The first words of each part's lines, in the order the turn writes them after the phases. */
const PARTS: [string, RegExp][] = [
  ['the dead crumble', /^💀 The dead will not stand alone/],
  ['graves underfoot', /^💀 .* feels the dead of/],
  ['a consecration broken', /^✨ The consecration of/],
  ['a courier', /^📦 A courier/],
  ['what the parcel holds', /^🎒 /],
  ['an intrusion', /^\[Intelligence\]/],
  ['Mass Healing', /^✨ .*'s Mass Healing/],
  ['the earned-HP note', /^📜 A new reckoning of vigour/],
  ["a coward's host", /^🏳 .* (begged for his life|abandons his command|slips away from)/],
  ['a coward goes home', /^🏳 .*, spared on the field/],
];
const partsInOrder = (o: Outcome) =>
  afterPhases(o)
    .map((t) => PARTS.find(([, re]) => re.test(t))?.[0])
    .filter((x): x is string => x !== undefined);
export const ORDER_CASES: AfterThePhasesCase[] = [
  {
    name: 'every part in its turn: the dead, graves, consecration, couriers, intrusions, Mass Healing, the HP note, cowards',
    wholeTurnOnly: true,
    stage(b) {
      delete (b.G as unknown as Record<string, unknown>)['_maxHpV3'];
      const p = ring1(b, 0);
      const q = ring1(b, 1);
      holdsOnly(b, 0, [b.X, 0], [q, 0]);
      seat(b, 0, b.X);
      consecrated(b, 0, ring1(b, 2));
      const c = spared(at(b, {}, { at: p, troops: 1 }), b.G.turn);
      const bonesman = leads(at(b, {}, { at: p }), bones(1));
      bury(q, 1);
      const necro = at(b, { necromancy: 1 }, { at: q });
      parcel(b, necro.id, [item(b, 'Iron Heart Talisman')]);
      const spy = rival(b, { at: q });
      const healer = wounded(at(b, MASTER), 15);
      oldSave(at(b, {}, { at: ring2(b, 0) }), 80);
      return { hero: c, others: [bonesman, necro, spy, healer], orders: [stays(healer)] };
    },
    check(o) {
      return {
        got: { parts: partsInOrder(o) },
        want: {
          parts: [
            'the dead crumble',
            'graves underfoot',
            'a consecration broken',
            'a courier',
            'what the parcel holds',
            'an intrusion',
            'an intrusion',
            'Mass Healing',
            'the earned-HP note',
            "a coward's host",
            'a coward goes home',
          ],
        },
      };
    },
  },
  {
    name: 'the dead crumble before any parcel arrives: a ring of Necromancy delivered after the phases comes too late',
    stage(b) {
      const h = leads(at(b), [...bones(1), ...companies(1)]);
      parcel(b, h.id, [item(b, "Death's Finger Ring")]);
      return { hero: h, there: b.X, orders: [] };
    },
    check(o, s) {
      return {
        got: { column: column(o, hero(s)), ring: itemNames(o, hero(s)) },
        want: { column: ['Men-at-Arms c0 (Average)'], ring: ["Death's Finger Ring"] },
      };
    },
  },
  {
    name: "a parcel arrives before Mass Healing: an amulet's maximum HP is mended by half too",
    stage(b) {
      const h = wounded(at(b), 4);
      parcel(b, h.id, [item(b, 'Amulet of Fortitude')]);
      const healer = at(b, MASTER);
      return { hero: h, others: [healer], orders: [stays(h), stays(healer)] };
    },
    check(o, s) {
      return {
        got: { line: afterPhases(o, 'Mass Healing'), hp: [char(o, hero(s)).hp, char(o, hero(s)).maxHp] },
        want: { line: [mends(other(s, 0), hero(s), 14, 26, 28)], hp: [26, 28] },
      };
    },
  },
  {
    name: 'Mass Healing comes before the cowards go home: a wounded coward beside a White master is mended first',
    stage(b) {
      const p = ring1(b, 0);
      const c = wounded(coward(b, p, 0), 6);
      const healer = at(b, MASTER, { at: p });
      return { hero: c, others: [healer], orders: [stays(healer)] };
    },
    check(o, s) {
      return {
        got: {
          hp: char(o, hero(s)).hp,
          home: count(o, goesHome(hero(s), o.world.world.provinces[char(o, hero(s)).location] as Province)),
        },
        want: { hp: 16, home: 1 },
      };
    },
  },
  {
    name: 'a necromancer coward senses the graves where he fled, before he goes home',
    stage(b) {
      const p = ring1(b, 0);
      bury(p, 1);
      bury(b.X, 1);
      const c = coward(b, p, 0);
      c.skills['necromancy'] = 1;
      return { hero: c, there: p, places: [b.X], orders: [] };
    },
    check(o, s) {
      return {
        got: { fled: count(o, feels(hero(s), there(s))), home: count(o, feels(hero(s), place(s, 0))) },
        want: { fled: 1, home: 0 },
      };
    },
  },
  {
    name: "the dead crumble before a coward's host falls in: only the living follow his comrade",
    stage(b) {
      const p = ring1(b, 0);
      const c = coward(b, p, 0);
      leads(c, [...bones(1), ...companies(1)]);
      const comrade = at(b, {}, { at: p });
      return { hero: c, others: [comrade], there: p, orders: [] };
    },
    check(o, s) {
      return {
        got: {
          dead: afterPhases(o, 'The dead will not stand alone'),
          host: count(o, fallsInUnder(hero(s), 1, there(s), other(s, 0))),
          comrade: column(o, other(s, 0)),
        },
        want: {
          dead: [crumble([under(1, hero(s), there(s))])],
          host: 1,
          comrade: ['Men-at-Arms c0 (Average)'],
        },
      };
    },
  },
];

// ── Every case ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Stages `c` on `b`, from plain realms with no heroes on their rolls. */
export const stageCase = (b: Board, c: AfterThePhasesCase): Staged => {
  plainRealms(b);
  b.G.players.forEach((pl) => {
    pl['heroes'] = [];
  });
  return c.stage(b);
};

/** Every case, by part of what the turn settles after its phases. */
export const AFTER_THE_PHASES_CASES: [string, AfterThePhasesCase[]][] = [
  ['the dead need a master', THE_DEAD_CASES],
  ['graves underfoot', GRAVES_CASES],
  ['neutral heroes learn', NEUTRAL_CASES],
  ['consecrated ground lost', CONSECRATION_CASES],
  ['couriers', COURIER_CASES],
  ['Elven companies make for home', ELVEN_CASES],
  ["a fallen commander's host, intrusions, lair guardians", LOOSE_ENDS_CASES],
  ['Mass Healing', MASS_HEALING_CASES],
  ['maximum HP', MAX_HP_CASES],
  ['cowards go home', COWARD_CASES],
  ['location names', LOCATION_NAME_CASES],
  ['the order of it all', ORDER_CASES],
];
export { bury, holding, item, place, other, ring1, ring2, rival, wanderer, hero, there };
