// The new turn, first part (plan P1-08k5a, a stage of resolveTurn's own body lifted out): once diplomacy and victory
// are settled, the turn counter moves on and the new turn begins. Staged on the middle of a bot world
// (lib/middle-of-a-bot-world.ts), from plain realms, each case with what must be true after it in game terms.
// A Divine king awaiting his return loses it when his realm holds no consecrated ground. A realm whose king has fallen
// crowns an heir in its wealthiest province, with the skills of its creed and his own to allocate, or, with no
// province left, its dynasty ends; a Divine king still awaiting his return is not replaced. What was summoned for the
// turn leaves (temporary companies on heroes, in garrisons and among the mercenaries; Wild Hunt bindings past their
// last turn), a hero hired this turn acts from every phase, and the one-turn spell marks on heroes, companies and
// provinces end: Illusory Terrain and hidden lairs may fade, Part Sea and Flood give the land back. Then the Grand
// Designs: the Iron Throne's skeleton rises join their winners, and the Grand Library gives a Neutral realm one Sage
// discovery.
// scenario/new-turn-succession-and-summons-in-a-whole-turn.test.ts plays each through a whole turn (resolveTurn);
// unit/new-turn-succession-and-summons-called-directly.test.ts calls the stage directly on the staged world. A case
// stages its world and the heroes' orders; after them, it reads what it needs from the world and the log (`got`)
// beside what must be so (`want`), and the test compares the two. Every outcome is certain: every case fixes the dice
// for the whole turn (default LANDS: every percentile roll lands, every other die at its highest), so the outcome holds
// however many dice the turn draws before it. By default each realm holds only its seat (tax 10) with a living king
// there, realms 0 and 1 are at war, 0 and 2 allied, 1 and 2 at peace (the board's relations), and the turn is turn 1.
import vm from 'node:vm';
import {
  must,
  order,
  playTurn,
  type Board,
  type Character,
  type Line,
  type Order,
  type Province,
  type RealmSends,
  type Unit,
  type World,
} from './middle-of-a-bot-world.ts';
import { companies } from './item-and-army-order-cases.ts';
import { withCaseDice, type Dice } from './espionage-order-cases.ts';
import { at, knows, leads, realm, ring1, ring2, wanderer } from './cast-spell-order-cases.ts';
import { plainRealms } from './recruit-hire-and-realm-works-order-cases.ts';
import { holdsOnly, unit } from './early-winter-cases.ts';
import { seatOf, taxes, tooEarly, turnIs } from './diplomacy-and-victory-cases.ts';
import { LANDS } from './war-order-cases.ts';

export { LANDS, holdsOnly, seatOf, turnIs, unit };
export interface Staged {
  /** Every hero given orders, with them (none: every hero Rests). */
  orders: [Character, Order[]][];
  /** What each realm sends beside its orders (none: nothing). */
  sends?: Record<number, RealmSends>;
  /** The hero the case is about, if one. */
  hero?: Character;
  /** Other heroes the case needs. */
  others?: Character[];
  /** The province the case is about. */
  there?: Province;
  /** Other provinces the case needs. */
  places?: Province[];
  /** The board the case was staged on (`stageCase` sets it): what a check reads of the game's own tables. */
  board?: Board;
}
export interface Outcome {
  world: World;
  /** Every line in the log. */
  all: Line[];
  /** The turn the orders were played in (the stage moves the counter on from it). */
  turn: number;
}
export interface NewTurnCase {
  name: string;
  /** Plays only in a whole turn: what the turn does around this stage makes what the case is about (a Reckoning
   *  call before it, the War Academy and the Divine resurrection after it). */
  wholeTurnOnly?: boolean;
  /** The dice for the whole turn (default LANDS). */
  dice?: Dice;
  stage(b: Board): Staged;
  /** What the case found after the turn, and what it should have found: the same keys. */
  check(o: Outcome, s: Staged): { got: Record<string, unknown>; want: Record<string, unknown> };
}

/** Plays `c`, staged as `s` on `b`, through a whole turn, with the case's dice. */
export const playCase = (b: Board, c: NewTurnCase, s: Staged): Outcome => {
  const result = withCaseDice(b.engine, c.dice ?? LANDS, () =>
    playTurn(b, Object.fromEntries(s.orders.map(([h, os]) => [h.id, os])), {}, [], s.sends ?? {}),
  );
  return { world: result.after, all: result.lines, turn: b.G.turn };
};

// ── Staging ──────────────────────────────────────────────────────────────────────────────────────────────────────
type Raw = Record<string, unknown>;
const raw = (b: Board) => b.G as unknown as Raw;
/** Realm `pi`'s king, as staged in its seat (`stageCase`). */
export const kingOf = (b: Board, pi = 0) =>
  must(
    b.G.characters.find((c) => c.isKing && c.player === pi),
    'the king of realm ' + String(pi),
  );
/** Realm `pi`'s king falls, as the turn leaves a fallen monarch: dead, gone from his province, his grave in the
 *  graveyard (a monarch's), on turn `killedOnTurn` (default this one: a Divine king is not yet due to return). With
 *  `awaitsReturn`, the divine have promised his return; with `grave: false`, no grave records him. */
export const kingFalls = (
  b: Board,
  pi = 0,
  {
    awaitsReturn = false,
    killedOnTurn = b.G.turn,
    grave = true,
  }: { awaitsReturn?: boolean; killedOnTurn?: number; grave?: boolean } = {},
) => {
  const k = kingOf(b, pi);
  k.alive = false;
  k.hp = 0;
  const p = must(b.G.world.provinces[k.location], 'the king’s province');
  p.characters = p.characters.filter((id) => id !== k.id);
  if (awaitsReturn) k['_divineReturn'] = true;
  if (grave) {
    const graves = (raw(b)['heroGraveyard'] as Raw[] | undefined) ?? [];
    raw(b)['heroGraveyard'] = [
      ...graves,
      {
        id: k.id,
        name: k.name,
        player: pi,
        race: k['race'],
        alignment: k['alignment'],
        temper: k['temper'],
        skills: { ...k.skills },
        maxHp: k.maxHp,
        isKing: true,
        _monarch: true,
        killedOnTurn,
        location: k.location,
        served: [pi],
        _releasedBy: null,
      },
    ];
  }
  return k;
};
/** Realm `pi`'s creed. */
export const creed = (b: Board, pi: number, alignment: string) => {
  realm(b, pi)['alignment'] = alignment;
};
/** Realm `pi`'s consecrated provinces. */
export const consecrated = (b: Board, pi: number, ...ps: Province[]) => {
  realm(b, pi)['consecratedProvIds'] = ps.map((p) => p.id);
};
/** A company summoned for the turn (an elemental, by default). */
export const summoned = (name: string | undefined, type = 'Fire Elemental') =>
  ({
    type,
    quality: 'Veteran',
    race: 'Elemental',
    ...(name === undefined ? {} : { unitName: name }),
    _temporary: true,
  }) as Unit;
/** A company of beasts bound by the Wild Hunt, serving through turn `until`. */
export const bound = (name: string | undefined, until: number, type = 'Dire Wolves') =>
  ({
    type,
    quality: 'Veteran',
    race: 'Beast',
    ...(name === undefined ? {} : { unitName: name }),
    _wildHuntUntilTurn: until,
  }) as Unit;
/** The game's Sage discoveries, in their order. */
export const sage = (b: Board) =>
  JSON.parse(vm.runInContext('JSON.stringify(SAGE_DISCOVERIES_P)', b.engine) as string) as {
    id: string;
    name: string;
    category: string;
    desc: string;
    race?: string;
    alignment?: string;
  }[];
/** The Sage discoveries a realm of `race` and `alignment` may learn, in their order. */
export const eligible = (b: Board, race: string, alignment: string) =>
  sage(b).filter((d) => (!d.race || d.race === race) && (!d.alignment || d.alignment === alignment));
/** Realm `pi` is Neutral and has raised the Grand Library (`at`: the province it stands in; none: an old save's
 *  Wonder, raised before Wonders had a place), knowing `also` besides. */
export const library = (b: Board, pi: number, where?: Province, ...also: string[]) => {
  creed(b, pi, 'Neutral');
  knows(b, pi, 'gd', ...also);
  if (where) realm(b, pi)['gdProvinceId'] = where.id;
};
/** The Iron Throne's skeleton rises waiting for their winners: `[hero id, company]`. */
export const rises = (b: Board, ...rs: [number, Unit][]) => {
  raw(b)['_pendingRises'] = rs.map(([charId, u]) => ({ charId, unit: u }));
};
/** A risen skeleton, as the Iron Throne makes one. */
export const risen = (name: string) => unit(name, 'Shieldwall Levies', 'Average', 'Undead', { _isSkeletal: true });
const nothing = (): Staged => ({ orders: [] });
const hero = (s: Staged) => must(s.hero, 'the hero');
const other = (s: Staged, i: number) => must(s.others?.[i], 'hero ' + String(i));
const there = (s: Staged) => must(s.there, 'the province');
const place = (s: Staged, i: number) => must(s.places?.[i], 'place ' + String(i));

// ── Reading the outcome ──────────────────────────────────────────────────────────────────────────────────────────
export const char = (o: Outcome, c: Character) =>
  must(
    o.world.characters.find((x) => x.id === c.id),
    'hero ' + c.name,
  );
export const province = (o: Outcome, p: Province) => must(o.world.world.provinces[p.id], 'province ' + p.name);
export const realmOf = (o: Outcome, pi = 0) => must(o.world.players[pi], 'realm ' + String(pi));
const rawOf = (o: Outcome) => o.world as unknown as Raw;
/** The heroes crowned this turn as heirs of realm `pi`. */
export const heirs = (o: Outcome, pi = 0) => o.world.characters.filter((c) => c.player === pi && c['_isHeir'] === true);
export const heir = (o: Outcome, pi = 0) => must(heirs(o, pi)[0], 'an heir for realm ' + String(pi));
/** Everything an heir is crowned with, but his name (drawn from the names no hero bears yet). */
export const crownedWith = (_o: Outcome, h: Character) => {
  const rest: Raw = { ...h };
  delete rest['name'];
  return rest;
};
/** What a newly crowned heir of realm `pi` is: the realm's creed and folk, 15 HP, the creed's skills, an aptitude of 4
 *  in every skill and the last Temper (every die at its highest), crowned on turn `crowned` in `p`, his id his place in
 *  the list of heroes. */
export const crownedAs = (
  b: Board,
  o: Outcome,
  pi: number,
  p: Province,
  skills: Record<string, number>,
  { race = 'Human', alignment = 'Divine' }: { race?: string; alignment?: string } = {},
) => ({
  id: o.world.characters.indexOf(heir(o, pi)),
  isKing: true,
  player: pi,
  race,
  alignment,
  temper: 'Cowardly',
  hp: 15,
  maxHp: 15,
  skills,
  aptitude: Object.fromEntries(
    (JSON.parse(vm.runInContext('JSON.stringify(KC_SKILLS)', b.engine) as string) as string[]).map((k) => [k, 4]),
  ),
  armies: [],
  items: [],
  location: p.id,
  alive: true,
  merits: 0,
  taxBonus: 0,
  pay: 0,
  spellsUsedThisTurn: [],
  locationName: p.name,
  _isHeir: true,
  _crownedTurn: o.turn + 1,
  _pendingSkillAllocation: 4,
});
/** The first line of the turn saying exactly `text`, as the reports read it: its kind, who acts and who is told, its
 *  province and hero, whether it is public or a system line, its phase (null if no line says it). */
export const told = (o: Outcome, text: string) => {
  const l = o.all.find((x) => x.text === text);
  return l
    ? {
        type: l.type,
        actor: l.actor ?? null,
        targets: l.targets ?? null,
        provinceId: l.provinceId ?? null,
        charId: l.charId ?? null,
        public: !!l['public'],
        system: !!l['system'],
        phase: l.phase,
      }
    : null;
};
/** What a line of this stage looks like (`told`): told to realm `pi` (actor and target), after the phases, with what
 *  isn't given as the line writes it. */
export const lineTo = (pi: number | null, x: Partial<NonNullable<ReturnType<typeof told>>> = {}) => ({
  type: 'system',
  actor: pi,
  targets: pi === null ? [] : [pi],
  provinceId: null,
  charId: null,
  public: false,
  system: false,
  phase: 99,
  ...x,
});
/** How many lines of the turn say exactly `text`. */
export const count = (o: Outcome, text: string) => o.all.filter((l) => l.text === text).length;
/** How many lines of the turn say `part` somewhere. */
export const saying = (o: Outcome, part: string) => o.all.filter((l) => l.text.includes(part)).length;
/** A hero's companies, as "<name> (<type>)". */
export const column = (o: Outcome, c: Character) => char(o, c).armies.map((u) => `${u.unitName} (${u.type})`);
/** The keys of `keys` that `x` still carries. */
export const marks = (x: Raw | undefined, keys: string[]) => keys.filter((k) => x != null && k in x);
const STAGE_LINE =
  /^(✨ The realm's last consecrated|👑 With the old king fallen|⚠ .*dynasty is extinguished|✨ As the season turns|🐾 The Wild Hunt is done|📚 Grand Library)/;
const KINDS: [RegExp, string][] = [
  [/^✨ The realm's last consecrated/, 'the way back lost'],
  [/^👑 With the old king fallen/, 'an heir crowned'],
  [/dynasty is extinguished/, 'a dynasty ends'],
  [/^✨ As the season turns/, 'a summons leaves'],
  [/^🐾 The Wild Hunt is done/, 'the Wild Hunt done'],
  [/^📚 Grand Library/, 'the Grand Library'],
];
/** Every line this stage wrote, in order: whom it is told to, and what kind of line it is. */
export const kinds = (o: Outcome) =>
  said(o).map(([to, t]) => [to, KINDS.find(([re]) => re.test(t))?.[1] ?? t] as const);
/** Every line this stage wrote, in order: whom it is told to, and what it says. */
export const said = (o: Outcome) =>
  o.all.filter((l) => l.phase === 99 && STAGE_LINE.test(l.text)).map((l) => [l.targets ?? null, l.text] as const);

// ── The stage's lines ────────────────────────────────────────────────────────────────────────────────────────────
export const wayBackLost = (k: Character) =>
  `✨ The realm's last consecrated ground is gone, and with it the way back for ${k.name}: the divine cannot restore a monarch where no holy ground remains. An heir takes the crown.`;
export const crowned = (name: string, p: Province) =>
  `👑 With the old king fallen, ${name} is crowned in ${p.name}. Name them, choose their Temper and allocate their 4 remaining skill points before submitting orders.`;
export const extinguished = (realmName: string) =>
  `⚠ ${realmName}'s king has fallen and no lands remain — their dynasty is extinguished.`;
export const released = (names: string, n: number, c: Character) =>
  `✨ As the season turns, ${names} ${n === 1 ? 'is' : 'are'} released from ${n === 1 ? 'its' : 'their'} bonds and ${n === 1 ? 'returns' : 'return'} to the Elemental Realm, leaving ${c.name}'s host.`;
export const huntDone = (names: string, c: Character) =>
  `🐾 The Wild Hunt is done — ${names} slip the binding and melt back into the wilds, leaving ${c.name}'s host.`;
export const LIBRARY_DONE = '📚 Grand Library: your scholars have already unlocked every known discovery.';
export const uncovers = (d: { name: string; category: string; desc: string }) =>
  `📚 Grand Library: this turn your scholars uncover — **${d.name}** (${d.category}). ${d.desc}`;
/** What the Grand Library adds to a realm's discoveries. */
export const learned = (d: { id: string; name: string; category: string; desc: string }, turn: number) => ({
  id: d.id,
  name: d.name,
  category: d.category,
  desc: d.desc,
  turnDiscovered: turn,
});
const NO_TITLE_SKILLS = { melee: 0, tactical: 0, march: 0 };

// ── The turn counter ─────────────────────────────────────────────────────────────────────────────────────────────
export const TURN_CASES: NewTurnCase[] = [
  {
    name: 'the turn moves on by one',
    stage(b) {
      turnIs(b, 3);
      return nothing();
    },
    check(o) {
      return { got: { turn: o.world.turn }, want: { turn: 4 } };
    },
  },
  {
    name: 'the turn moves on from the one the save records, the first turn too',
    stage: nothing,
    check(o) {
      return { got: { played: o.turn, turn: o.world.turn }, want: { played: 1, turn: 2 } };
    },
  },
];

// ── A Divine king's way back ─────────────────────────────────────────────────────────────────────────────────────
export const DIVINE_RETURN_CASES: NewTurnCase[] = [
  {
    name: 'a Divine king awaiting his return, his realm holding no consecrated ground: the way back is lost, told to his realm alone, and an heir crowned the same turn',
    stage(b) {
      const k = kingFalls(b, 0, { awaitsReturn: true });
      return { hero: k, there: seatOf(b, 0), orders: [] };
    },
    check(o, s) {
      return {
        got: {
          told: told(o, wayBackLost(hero(s))),
          mark: marks(char(o, hero(s)), ['_divineReturn']),
          stillKing: char(o, hero(s)).isKing,
          heirs: heirs(o).map((h) => [h.location, count(o, crowned(h.name, there(s)))]),
          said: said(o),
        },
        want: {
          told: lineTo(0),
          mark: [],
          stillKing: false,
          heirs: [[there(s).id, 1]],
          said: [
            [[0], wayBackLost(hero(s))],
            [[0], crowned(heir(o).name, there(s))],
          ],
        },
      };
    },
  },
  {
    name: 'a Divine king awaiting his return while his realm holds consecrated ground: nothing is said, no heir is crowned, he stays the realm’s king, and the realm is no longer waiting for an heir',
    stage(b) {
      const k = kingFalls(b, 0, { awaitsReturn: true });
      consecrated(b, 0, seatOf(b, 0));
      realm(b, 0)['heirPending'] = true;
      return { hero: k, orders: [] };
    },
    check(o, s) {
      return {
        got: {
          lost: count(o, wayBackLost(hero(s))),
          mark: marks(char(o, hero(s)), ['_divineReturn']),
          stillKing: char(o, hero(s)).isKing,
          heirs: heirs(o).length,
          said: said(o),
          pending: realmOf(o, 0)['heirPending'],
        },
        want: { lost: 0, mark: ['_divineReturn'], stillKing: true, heirs: 0, said: [], pending: false },
      };
    },
  },
  {
    name: 'consecrated ground another realm has taken is no ground to return to: the way back is lost',
    stage(b) {
      const k = kingFalls(b, 0, { awaitsReturn: true });
      const lost = ring1(b, 0);
      b.own(lost, 1);
      consecrated(b, 0, lost);
      return { hero: k, there: seatOf(b, 0), orders: [] };
    },
    check(o, s) {
      return {
        got: {
          told: told(o, wayBackLost(hero(s))),
          mark: marks(char(o, hero(s)), ['_divineReturn']),
          heirs: heirs(o).length,
        },
        want: { told: lineTo(0), mark: [], heirs: 1 },
      };
    },
  },
  {
    name: 'an old save’s one consecrated province still counts as holy ground: the king keeps his way back',
    stage(b) {
      const k = kingFalls(b, 0, { awaitsReturn: true });
      realm(b, 0)['consecratedProvId'] = seatOf(b, 0).id;
      return { hero: k, orders: [] };
    },
    check(o, s) {
      return {
        got: {
          lost: count(o, wayBackLost(hero(s))),
          mark: marks(char(o, hero(s)), ['_divineReturn']),
          heirs: heirs(o).length,
        },
        want: { lost: 0, mark: ['_divineReturn'], heirs: 0 },
      };
    },
  },
  {
    name: 'a realm that is not Divine: a fallen king carrying the mark of return is not mourned for it, and an heir is crowned',
    stage(b) {
      creed(b, 0, 'Pagan');
      const k = kingFalls(b, 0, { awaitsReturn: true });
      return { hero: k, orders: [] };
    },
    check(o, s) {
      return {
        got: {
          lost: count(o, wayBackLost(hero(s))),
          mark: marks(char(o, hero(s)), ['_divineReturn']),
          heirs: heirs(o).length,
        },
        want: { lost: 0, mark: ['_divineReturn'], heirs: 1 },
      };
    },
  },
  {
    name: 'a fallen hero of a Divine realm who is not its king keeps any mark of return: only a king loses his way back here',
    stage(b) {
      const h = at(b, NO_TITLE_SKILLS);
      Object.assign(h, { alive: false, hp: 0, _divineReturn: true });
      b.X.characters = [];
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return {
        got: {
          lost: count(o, wayBackLost(hero(s))),
          mark: marks(char(o, hero(s)), ['_divineReturn']),
          heirs: heirs(o).length,
        },
        want: { lost: 0, mark: ['_divineReturn'], heirs: 0 },
      };
    },
  },
  {
    name: 'two Divine realms with no holy ground: each is told only of its own king',
    stage(b) {
      const k0 = kingFalls(b, 0, { awaitsReturn: true });
      const k2 = kingFalls(b, 2, { awaitsReturn: true });
      return { hero: k0, others: [k2], orders: [] };
    },
    check(o, s) {
      return {
        got: { first: told(o, wayBackLost(hero(s))), second: told(o, wayBackLost(other(s, 0))) },
        want: { first: lineTo(0), second: lineTo(2) },
      };
    },
  },
  {
    name: 'a Divine king awaiting his return whose grave is gone: the crown passes to an heir, though his realm keeps holy ground and he his mark',
    stage(b) {
      const k = kingFalls(b, 0, { awaitsReturn: true, grave: false });
      consecrated(b, 0, seatOf(b, 0));
      return { hero: k, orders: [] };
    },
    check(o, s) {
      return {
        got: {
          lost: count(o, wayBackLost(hero(s))),
          mark: marks(char(o, hero(s)), ['_divineReturn']),
          stillKing: char(o, hero(s)).isKing,
          heirs: heirs(o).length,
        },
        want: { lost: 0, mark: ['_divineReturn'], stillKing: false, heirs: 1 },
      };
    },
  },
  {
    name: 'a Divine king awaiting his return in a realm with no land left: the way back is lost and the dynasty ends',
    stage(b) {
      const k = kingFalls(b, 0, { awaitsReturn: true });
      consecrated(b, 0, seatOf(b, 0));
      holdsOnly(b, 0);
      return { hero: k, orders: [] };
    },
    check(o, s) {
      return {
        got: { said: said(o), heirs: heirs(o).length },
        want: {
          said: [
            [[0], wayBackLost(hero(s))],
            [[0], extinguished(realmOf(o, 0).name)],
          ],
          heirs: 0,
        },
      };
    },
  },
];

// ── Succession ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Realm `pi` holds its seat at tax 10 and `more` (each at its tax), in that order. */
const lands = (b: Board, pi: number, ...more: [Province, number][]) => {
  holdsOnly(b, pi, [seatOf(b, pi), 10], ...more);
};
/** A case: realm 0 of `alignment` (and `race`) loses its king; its heir has `skills`. */
const creedCase = (alignment: string, skills: Record<string, number>, race = 'Human'): NewTurnCase => ({
  name: `a ${race === 'Human' ? '' : race + ' '}${alignment} realm’s heir: ${Object.entries(skills)
    .map(([k, n]) => `${k} ${String(n)}`)
    .join(', ')}`,
  stage(b) {
    creed(b, 0, alignment);
    realm(b, 0)['race'] = race;
    const k = kingFalls(b, 0);
    return { hero: k, there: seatOf(b, 0), orders: [] };
  },
  check(o, s) {
    return {
      got: { heir: crownedWith(o, heir(o)) },
      want: { heir: crownedAs(boardOf(s), o, 0, there(s), skills, { race, alignment }) },
    };
  },
});
/** The board a case was staged on. */
const boardOf = (s: Staged) => must(s.board, 'the board');
export const SUCCESSION_CASES: NewTurnCase[] = [
  {
    name: 'a realm whose king has fallen crowns an heir in its wealthiest province, told to the realm alone: a new king of 15 HP with 4 skill points to allocate; the fallen king is king no more',
    stage(b) {
      const rich = ring1(b, 0);
      lands(b, 0, [ring1(b, 1), 20], [rich, 30]);
      realm(b, 0)['heirPending'] = true;
      const k = kingFalls(b, 0);
      return { hero: k, there: rich, orders: [] };
    },
    check(o, s) {
      const h = heir(o);
      return {
        got: {
          pending: realmOf(o, 0)['heirPending'],
          heir: crownedWith(o, h),
          told: told(o, crowned(h.name, there(s))),
          old: [char(o, hero(s)).isKing, char(o, hero(s)).alive],
          heirs: heirs(o).length,
          others: [heirs(o, 1).length, heirs(o, 2).length],
          kings: o.world.characters.filter((c) => c.player === 0 && c.isKing).length,
        },
        want: {
          pending: false,
          heir: crownedAs(boardOf(s), o, 0, there(s), { melee: 2, archery: 1, sage: 1, white: 1 }),
          told: lineTo(0, { provinceId: there(s).id }),
          old: [false, false],
          heirs: 1,
          others: [0, 0],
          kings: 1,
        },
      };
    },
  },
  {
    name: 'two provinces equally rich: the heir is crowned in the first of them in the realm’s list',
    stage(b) {
      const first = ring1(b, 2);
      holdsOnly(b, 0, [seatOf(b, 0), 10], [first, 30], [ring1(b, 0), 30]);
      kingFalls(b, 0);
      return { there: first, orders: [] };
    },
    check(o, s) {
      return { got: { at: heir(o).location }, want: { at: there(s).id } };
    },
  },
  {
    name: 'the richest province first in the list: a poorer one after it doesn’t take the crown',
    stage(b) {
      const rich = ring1(b, 2);
      holdsOnly(b, 0, [rich, 30], [seatOf(b, 0), 10], [ring1(b, 0), 20]);
      kingFalls(b, 0);
      return { there: rich, orders: [] };
    },
    check(o, s) {
      return { got: { at: heir(o).location }, want: { at: there(s).id } };
    },
  },
  creedCase('Divine', { melee: 2, archery: 1, sage: 1, white: 1 }),
  creedCase('Druidic', { melee: 2, archery: 1, sage: 1, druid: 1 }),
  creedCase('Evil', { melee: 2, archery: 1, sage: 1, druid: 1 }),
  creedCase('Pagan', { melee: 2, archery: 1, sage: 1, explorer: 1 }),
  creedCase('Undead', { melee: 2, archery: 1, sage: 1, necromancy: 1 }),
  creedCase('Neutral', { melee: 2, archery: 1, sage: 1 }),
  creedCase('Druidic', { melee: 2, archery: 1, sage: 1, druid: 1 }, 'Elf'),
  {
    name: 'a realm whose king has fallen while its heroes live on crowns an heir all the same',
    stage(b) {
      const h = at(b, NO_TITLE_SKILLS);
      kingFalls(b, 0);
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return {
        got: { heirs: heirs(o).length, hero: [char(o, hero(s)).isKing, char(o, hero(s)).alive] },
        want: { heirs: 1, hero: [false, true] },
      };
    },
  },
  {
    name: 'a Divine realm whose fallen hero (not its king) is promised his return still crowns an heir for its fallen king',
    stage(b) {
      consecrated(b, 0, seatOf(b, 0));
      const h = at(b, NO_TITLE_SKILLS);
      Object.assign(h, { alive: false, hp: 0, _divineReturn: true });
      b.X.characters = [];
      (b.G as unknown as Raw)['heroGraveyard'] = [
        { id: h.id, name: h.name, player: 0, killedOnTurn: b.G.turn, location: b.X.id, skills: {}, maxHp: 20 },
      ];
      kingFalls(b, 0);
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return {
        got: { heirs: heirs(o).length, mark: marks(char(o, hero(s)), ['_divineReturn']) },
        want: { heirs: 1, mark: ['_divineReturn'] },
      };
    },
  },
  {
    name: 'a realm with a living king crowns no heir, and is no longer waiting for one',
    stage(b) {
      realm(b, 0)['heirPending'] = true;
      return nothing();
    },
    check(o) {
      return {
        got: { heirs: heirs(o).length, pending: realmOf(o, 0)['heirPending'], said: said(o) },
        want: { heirs: 0, pending: false, said: [] },
      };
    },
  },
  {
    name: 'a realm whose king has fallen with no land left: its dynasty is extinguished, told to it alone, on the new turn; no heir',
    stage(b) {
      holdsOnly(b, 0);
      realm(b, 0)['heirPending'] = true;
      const k = kingFalls(b, 0);
      return { hero: k, orders: [] };
    },
    check(o, s) {
      return {
        got: {
          told: told(o, extinguished(realmOf(o, 0).name)),
          out: [realmOf(o, 0)['_eliminated'], realmOf(o, 0)['_eliminatedTurn']],
          pending: realmOf(o, 0)['heirPending'],
          heirs: heirs(o).length,
          old: char(o, hero(s)).isKing,
        },
        want: { told: lineTo(0), out: [true, o.turn + 1], pending: true, heirs: 0, old: true },
      };
    },
  },
  {
    name: 'a dynasty already extinguished is not told so again, and keeps the turn it ended',
    stage(b) {
      turnIs(b, 3);
      holdsOnly(b, 0);
      Object.assign(realm(b, 0), { _eliminated: true, _eliminatedTurn: 2 });
      kingFalls(b, 0);
      return nothing();
    },
    check(o) {
      return {
        got: {
          told: count(o, extinguished(realmOf(o, 0).name)),
          out: realmOf(o, 0)['_eliminatedTurn'],
          heirs: heirs(o).length,
        },
        want: { told: 0, out: 2, heirs: 0 },
      };
    },
  },
  {
    name: 'two realms lose their kings: each crowns its own heir in its own land, in realm order, each told only its own',
    stage(b) {
      kingFalls(b, 0);
      kingFalls(b, 2);
      return { places: [seatOf(b, 0), seatOf(b, 2)], orders: [] };
    },
    check(o, s) {
      const h0 = heir(o, 0);
      const h2 = heir(o, 2);
      return {
        got: {
          at: [h0.location, h2.location],
          ids: [h0.id, h2.id],
          told: [told(o, crowned(h0.name, place(s, 0)))?.targets, told(o, crowned(h2.name, place(s, 1)))?.targets],
          names: h0.name !== h2.name,
        },
        want: {
          at: [place(s, 0).id, place(s, 1).id],
          ids: [o.world.characters.length - 2, o.world.characters.length - 1],
          told: [[0], [2]],
          names: true,
        },
      };
    },
  },
  {
    name: 'an heir starts with no companies and no items, whatever the fallen king led',
    stage(b) {
      const k = kingOf(b, 0);
      leads(k, companies(2));
      k.items = [{ name: 'Old Crown Ring' }];
      kingFalls(b, 0);
      return { hero: k, orders: [] };
    },
    check(o) {
      return {
        got: { heir: [heir(o).armies, heir(o).items] },
        want: { heir: [[], []] },
      };
    },
  },
];

// ── What was summoned for the turn ───────────────────────────────────────────────────────────────────────────────
export const SUMMONS_CASES: NewTurnCase[] = [
  {
    name: 'an elemental summoned for the turn leaves its summoner’s host as the turn ends, told to his realm where he stands; his other companies stay',
    stage(b) {
      const h = leads(at(b, NO_TITLE_SKILLS), [summoned('Blaze'), ...companies(1)]);
      return { hero: h, there: b.X, orders: [] };
    },
    check(o, s) {
      const t = released('Blaze (Fire Elemental)', 1, hero(s));
      return {
        got: { column: column(o, hero(s)), told: told(o, t), said: said(o) },
        want: {
          column: ['Men-at-Arms c0 (Men-at-Arms)'],
          told: lineTo(0, { type: 'explore', provinceId: there(s).id }),
          said: [[[0], t]],
        },
      };
    },
  },
  {
    name: 'two summoned companies leave together, in one line: "are released from their bonds and return"',
    stage(b) {
      const h = leads(at(b, NO_TITLE_SKILLS), [summoned('Blaze'), summoned('Gale', 'Air Elemental')]);
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return {
        got: { column: column(o, hero(s)), said: said(o) },
        want: { column: [], said: [[[0], released('Blaze (Fire Elemental), Gale (Air Elemental)', 2, hero(s))]] },
      };
    },
  },
  {
    name: 'a summoned company with no name of its own is told by its kind',
    stage(b) {
      const h = leads(at(b, NO_TITLE_SKILLS), [summoned(undefined, 'Earth Elemental')]);
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return { got: { said: said(o) }, want: { said: [[[0], released('Earth Elemental', 1, hero(s))]] } };
    },
  },
  {
    name: 'a wandering hero’s elemental leaves too, told to nobody',
    stage(b) {
      const h = leads(wanderer(b, NO_TITLE_SKILLS), [summoned('Blaze')]);
      return { hero: h, there: b.X, orders: [] };
    },
    check(o, s) {
      return {
        got: { column: column(o, hero(s)), told: told(o, released('Blaze (Fire Elemental)', 1, hero(s))) },
        want: { column: [], told: lineTo(null, { type: 'explore', provinceId: there(s).id }) },
      };
    },
  },
  {
    name: 'summoned companies folded into a garrison vanish silently; the garrison’s own stay',
    stage(b) {
      holdsOnly(b, 0, [seatOf(b, 0), 10], [b.X, 0]);
      b.X.garrisonArmies = [summoned('Lost Blaze'), ...companies(1, 'Men-at-Arms', 'Average', 'Guard')];
      return { there: b.X, orders: [] };
    },
    check(o, s) {
      return {
        got: { garrison: province(o, there(s)).garrisonArmies.map((u) => u.unitName), said: said(o) },
        want: { garrison: ['Guard c0'], said: [] },
      };
    },
  },
  {
    name: 'a summoned company among the mercenary bands vanishes silently; the bands stay',
    stage(b) {
      const G = b.G;
      G.mercenaries = [
        { id: 'm-temp', type: 'Fire Elemental', quality: 'Veteran', location: ring2(b, 1).id, _temporary: true },
        { id: 'm-band', type: 'Men-at-Arms', quality: 'Average', location: ring2(b, 1).id },
      ];
      return nothing();
    },
    check(o) {
      return {
        got: { bands: (o.world.mercenaries ?? []).map((m) => m.id), said: said(o) },
        want: { bands: ['m-band'], said: [] },
      };
    },
  },
  {
    name: 'beasts bound by the Wild Hunt to serve through this turn slip the binding as it ends, told to the realm',
    stage(b) {
      const h = leads(at(b, NO_TITLE_SKILLS), [bound('Pack', b.G.turn), ...companies(1)]);
      return { hero: h, there: b.X, orders: [] };
    },
    check(o, s) {
      const t = huntDone('Pack (Dire Wolves)', hero(s));
      return {
        got: { column: column(o, hero(s)), told: told(o, t) },
        want: {
          column: ['Men-at-Arms c0 (Men-at-Arms)'],
          told: lineTo(0, { type: 'explore', provinceId: there(s).id }),
        },
      };
    },
  },
  {
    name: 'beasts bound to serve through next turn are still serving',
    stage(b) {
      const h = leads(at(b, NO_TITLE_SKILLS), [bound('Pack', b.G.turn + 1)]);
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return { got: { column: column(o, hero(s)), said: said(o) }, want: { column: ['Pack (Dire Wolves)'], said: [] } };
    },
  },
  {
    name: 'two packs of the Wild Hunt leave in one line; one with no name of its own is told by its kind',
    stage(b) {
      turnIs(b, 4);
      const h = leads(at(b, NO_TITLE_SKILLS), [bound('Pack', 2), bound(undefined, 4, 'Great Bears')]);
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return {
        got: { column: column(o, hero(s)), said: said(o) },
        want: { column: [], said: [[[0], huntDone('Pack (Dire Wolves), Great Bears (Great Bears)', hero(s))]] },
      };
    },
  },
  {
    name: 'an elemental and a Wild Hunt pack on one hero: the elemental’s line first, then the pack’s',
    stage(b) {
      const h = leads(at(b, NO_TITLE_SKILLS), [bound('Pack', b.G.turn), summoned('Blaze'), ...companies(1)]);
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return {
        got: { column: column(o, hero(s)), said: said(o) },
        want: {
          column: ['Men-at-Arms c0 (Men-at-Arms)'],
          said: [
            [[0], released('Blaze (Fire Elemental)', 1, hero(s))],
            [[0], huntDone('Pack (Dire Wolves)', hero(s))],
          ],
        },
      };
    },
  },
  {
    name: 'a hero hired partway through the turn acts from every phase next turn; one hired before, or never, stays as he was',
    stage(b) {
      const late = at(b, NO_TITLE_SKILLS);
      late['hiredInPhase'] = 2;
      const first = at(b, NO_TITLE_SKILLS);
      first['hiredInPhase'] = 0;
      const before = at(b, NO_TITLE_SKILLS);
      before['hiredInPhase'] = -1;
      const never = at(b, NO_TITLE_SKILLS);
      return { hero: late, others: [first, before, never], orders: [] };
    },
    check(o, s) {
      return {
        got: {
          late: char(o, hero(s))['hiredInPhase'],
          first: char(o, other(s, 0))['hiredInPhase'],
          before: char(o, other(s, 1))['hiredInPhase'],
          never: 'hiredInPhase' in char(o, other(s, 2)),
        },
        want: { late: -1, first: -1, before: -1, never: false },
      };
    },
  },
];

// ── One-turn spells end ──────────────────────────────────────────────────────────────────────────────────────────
/** The one-turn marks a hero may carry that end with the turn (the charm's three aside: a whole turn's Early Winter
 *  sends a charmed hero home first). */
export const HERO_MARKS = [
  '_partSeaThisPhase',
  '_elementalSummonedThisTurn',
  '_curses',
  '_mirrorImages',
  '_invisible',
  '_oratoryBoost',
  '_clairvoyantBy',
  '_druidNegated',
  '_tacticalNegated',
  '_tacticalHalved',
  '_tacticalMult',
  '_phantasmalBonus',
  '_curseHalveStat',
  '_necroAutoUsed',
];
export const CHARM_MARKS = ['_charmedByPlayer', '_charmedForPhase', '_charmOriginalPlayer'];
/** The battle marks a company may carry that end with the turn. */
export const COMPANY_MARKS = [
  '_tempStrReduction',
  '_terrorMult',
  '_turnStrReduction',
  '_archeryRed',
  '_tacUp',
  '_drumUp',
  '_laNoTerrain',
  '_flakTargeted',
];
/** The one-turn marks a province may carry that end with the turn. */
export const PROVINCE_MARKS = [
  '_blessBonus',
  '_phantomArmies',
  '_featuresHidden',
  '_earthquakeTax',
  '_earthquakeSpeed',
  '_flooded',
  '_holyBonus',
  '_oratoryBonus',
  '_tempStrReduction',
  '_turnStrReduction',
];
/** A value for each mark, as the spells leave them. */
export const markedWith = (keys: string[]): Raw =>
  Object.fromEntries(
    keys.map((k) => [
      k,
      k === '_curses' ? [{ stat: 'melee', by: 1 }] : k === '_terrorMult' ? 0.8 : k === '_tacticalMult' ? 2 : 1,
    ]),
  );
/** A company carrying every battle mark. */
export const markedCompany = (name: string) => ({ ...unit(name, 'Men-at-Arms'), ...markedWith(COMPANY_MARKS) });
const ILLUSION = { caster: 0, terrain: 'mountains' };
export const SPELLS_END_CASES: NewTurnCase[] = [
  {
    name: 'a hero’s one-turn spell marks end with the turn; the Charm’s immunity, which names next turn, stays',
    stage(b) {
      const h = at(b, NO_TITLE_SKILLS);
      Object.assign(h, markedWith(HERO_MARKS), { _charmImmuneTurn: b.G.turn + 1 });
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return {
        got: { marks: marks(char(o, hero(s)), HERO_MARKS), immune: char(o, hero(s))['_charmImmuneTurn'] },
        want: { marks: [], immune: o.turn + 1 },
      };
    },
  },
  {
    name: 'phantom companies fade as the turn ends',
    stage(b) {
      const h = at(b, NO_TITLE_SKILLS);
      h['_phantoms'] = [{ type: 'Men-at-Arms', unitName: 'Mirage' }];
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return { got: { phantoms: char(o, hero(s))['_phantoms'] }, want: { phantoms: [] } };
    },
  },
  {
    name: 'a hero’s companies recover from every battle mark between turns',
    stage(b) {
      const h = leads(at(b, NO_TITLE_SKILLS), [markedCompany('Worn'), markedCompany('Tired')]);
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return {
        got: { marks: char(o, hero(s)).armies.map((u) => marks(u, COMPANY_MARKS)) },
        want: { marks: [[], []] },
      };
    },
  },
  {
    name: 'a province’s neutral defenders recover from every battle mark between turns',
    stage(b) {
      const p = ring2(b, 4);
      p.neutralDefenders = [markedCompany('Watch')];
      p.npcArmies = 1;
      return { there: p, orders: [] };
    },
    check(o, s) {
      return {
        got: { marks: province(o, there(s)).neutralDefenders.map((u) => marks(u, COMPANY_MARKS)) },
        want: { marks: [[]] },
      };
    },
  },
  {
    name: 'a garrison loses only its Terror between turns; its other battle marks stay',
    stage(b) {
      holdsOnly(b, 0, [seatOf(b, 0), 10], [b.X, 0]);
      b.X.garrisonArmies = [markedCompany('Guard')];
      return { there: b.X, orders: [] };
    },
    check(o, s) {
      return {
        got: { marks: province(o, there(s)).garrisonArmies.map((u) => marks(u, COMPANY_MARKS)) },
        want: { marks: [COMPANY_MARKS.filter((k) => k !== '_terrorMult')] },
      };
    },
  },
  {
    name: 'a province’s one-turn marks end with the turn',
    stage(b) {
      const p = ring2(b, 4);
      Object.assign(p, markedWith(PROVINCE_MARKS));
      return { there: p, orders: [] };
    },
    check(o, s) {
      return { got: { marks: marks(province(o, there(s)), PROVINCE_MARKS) }, want: { marks: [] } };
    },
  },
  {
    name: 'a parted sea is sea again',
    stage(b) {
      const p = ring2(b, 4);
      Object.assign(p, { terrain: 'plains', _partSea: { orig: 'sea', turn: b.G.turn, blockFleetsFromPhase: 1 } });
      return { there: p, orders: [] };
    },
    check(o, s) {
      return {
        got: { terrain: province(o, there(s)).terrain, marks: marks(province(o, there(s)), ['_partSea']) },
        want: { terrain: 'sea', marks: [] },
      };
    },
  },
  {
    name: 'a flooded province is land again',
    stage(b) {
      const p = ring2(b, 4);
      Object.assign(p, { terrain: 'sea', _flood: { orig: 'forest', turn: b.G.turn } });
      return { there: p, orders: [] };
    },
    check(o, s) {
      return {
        got: { terrain: province(o, there(s)).terrain, marks: marks(province(o, there(s)), ['_flood']) },
        want: { terrain: 'forest', marks: [] },
      };
    },
  },
  {
    name: 'a province both parted and flooded: the sea comes back first, then the Flood gives back what it found',
    stage(b) {
      const p = ring2(b, 4);
      Object.assign(p, {
        terrain: 'sea',
        _partSea: { orig: 'sea', turn: b.G.turn, blockFleetsFromPhase: 1 },
        _flood: { orig: 'plains', turn: b.G.turn },
      });
      return { there: p, orders: [] };
    },
    check(o, s) {
      return {
        got: { terrain: province(o, there(s)).terrain, marks: marks(province(o, there(s)), ['_partSea', '_flood']) },
        want: { terrain: 'plains', marks: [] },
      };
    },
  },
  {
    name: 'Illusory Terrain an enemy hero walked into is dispelled at the turn’s end, whatever the dice',
    stage(b) {
      const p = ring2(b, 4);
      p['_illusoryTerrain'] = { ...ILLUSION, _enteredByEnemy: true };
      return { there: p, orders: [] };
    },
    check(o, s) {
      return { got: { marks: marks(province(o, there(s)), ['_illusoryTerrain']) }, want: { marks: [] } };
    },
  },
  {
    name: 'Illusory Terrain no enemy entered holds while the die shows 20% or more',
    dice: { roll: 1, die: 0.2 },
    stage(b) {
      const p = ring2(b, 4);
      p['_illusoryTerrain'] = { ...ILLUSION };
      return { there: p, orders: [] };
    },
    check(o, s) {
      return {
        got: { illusion: province(o, there(s))['_illusoryTerrain'] },
        want: { illusion: ILLUSION },
      };
    },
  },
  {
    name: 'Illusory Terrain no enemy entered fades on a die under 20%',
    dice: { roll: 1, die: 0.19999 },
    stage(b) {
      const p = ring2(b, 4);
      p['_illusoryTerrain'] = { ...ILLUSION };
      return { there: p, orders: [] };
    },
    check(o, s) {
      return { got: { marks: marks(province(o, there(s)), ['_illusoryTerrain']) }, want: { marks: [] } };
    },
  },
  {
    name: 'a hidden lair stays hidden while the die shows 20% or more',
    dice: { roll: 1, die: 0.2 },
    stage(b) {
      const p = ring2(b, 4);
      p['features'] = [{ type: 'lair', name: 'Old Den', _hidden: true, _hiddenBy: 0 }];
      return { there: p, orders: [] };
    },
    check(o, s) {
      return {
        got: { features: (province(o, there(s))['features'] as Raw[]).map((f) => marks(f, ['_hidden', '_hiddenBy'])) },
        want: { features: [['_hidden', '_hiddenBy']] },
      };
    },
  },
  {
    name: 'a hidden lair is seen again on a die under 20%',
    dice: { roll: 1, die: 0.19999 },
    stage(b) {
      const p = ring2(b, 4);
      p['features'] = [{ type: 'lair', name: 'Old Den', _hidden: true, _hiddenBy: 0 }];
      return { there: p, orders: [] };
    },
    check(o, s) {
      return {
        got: { features: (province(o, there(s))['features'] as Raw[]).map((f) => marks(f, ['_hidden', '_hiddenBy'])) },
        want: { features: [[]] },
      };
    },
  },
];

// ── The Grand Designs ────────────────────────────────────────────────────────────────────────────────────────────
export const GRAND_DESIGN_CASES: NewTurnCase[] = [
  {
    name: 'the Iron Throne’s risen skeletons join the living hero who won them; none are left waiting',
    stage(b) {
      const h = leads(at(b, NO_TITLE_SKILLS), companies(1));
      rises(b, [h.id, risen('Risen A')], [h.id, risen('Risen B')]);
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return {
        got: { column: column(o, hero(s)), waiting: rawOf(o)['_pendingRises'] },
        want: {
          column: ['Men-at-Arms c0 (Men-at-Arms)', 'Risen A (Shieldwall Levies)', 'Risen B (Shieldwall Levies)'],
          waiting: [],
        },
      };
    },
  },
  {
    name: 'a rise owed to a hero who has since fallen, or to one the world no longer has, is lost',
    stage(b) {
      const dead = at(b, NO_TITLE_SKILLS, { at: ring1(b, 3) });
      Object.assign(dead, { alive: false, hp: 0 });
      ring1(b, 3).characters = [];
      const h = at(b, NO_TITLE_SKILLS);
      rises(b, [dead.id, risen('Risen A')], [123456, risen('Risen B')], [h.id, risen('Risen C')]);
      return { hero: h, others: [dead], orders: [] };
    },
    check(o, s) {
      return {
        got: { dead: column(o, other(s, 0)), living: column(o, hero(s)), waiting: rawOf(o)['_pendingRises'] },
        want: { dead: [], living: ['Risen C (Shieldwall Levies)'], waiting: [] },
      };
    },
  },
  {
    name: 'no rises waiting: an empty list is kept',
    stage: nothing,
    check(o) {
      return { got: { waiting: rawOf(o)['_pendingRises'] }, want: { waiting: [] } };
    },
  },
  {
    name: 'the Grand Library gives a Neutral realm one Sage discovery on the new turn, told to it alone (every die at its highest: the last it may learn)',
    stage(b) {
      library(b, 0, seatOf(b, 0));
      return nothing();
    },
    check(o, s) {
      const d = must(eligible(boardOf(s), 'Human', 'Neutral').at(-1), 'a discovery');
      return {
        got: { known: realmOf(o, 0)['discoveries'], told: told(o, uncovers(d)), said: said(o) },
        want: {
          known: [{ id: 'gd' }, learned(d, o.turn + 1)],
          told: lineTo(0, { type: 'explore' }),
          said: [[[0], uncovers(d)]],
        },
      };
    },
  },
  {
    name: 'the Grand Library on the lowest die: the first discovery the realm may learn',
    dice: { roll: 1, die: 0 },
    stage(b) {
      library(b, 0, seatOf(b, 0));
      return nothing();
    },
    check(o, s) {
      const d = must(eligible(boardOf(s), 'Human', 'Neutral')[0], 'a discovery');
      return {
        got: { known: (realmOf(o, 0)['discoveries'] as Raw[]).map((x) => x['id']) },
        want: { known: ['gd', d.id] },
      };
    },
  },
  {
    name: 'an old save’s Grand Library, raised before Wonders had a place, works wherever the realm stands',
    stage(b) {
      library(b, 0);
      return nothing();
    },
    check(o) {
      return { got: { known: (realmOf(o, 0)['discoveries'] as Raw[]).length }, want: { known: 2 } };
    },
  },
  {
    name: 'a Grand Library whose province another realm holds gives nothing, and says nothing',
    stage(b) {
      const p = ring1(b, 0);
      b.own(p, 1);
      library(b, 0, p);
      return nothing();
    },
    check(o) {
      return { got: { known: realmOf(o, 0)['discoveries'], said: said(o) }, want: { known: [{ id: 'gd' }], said: [] } };
    },
  },
  {
    name: 'a realm that is not Neutral gains nothing from a Wonder here',
    stage(b) {
      knows(b, 0, 'gd');
      return nothing();
    },
    check(o) {
      return { got: { known: realmOf(o, 0)['discoveries'], said: said(o) }, want: { known: [{ id: 'gd' }], said: [] } };
    },
  },
  {
    name: 'a realm that knows every discovery it may learn is told so',
    stage(b) {
      library(b, 0, seatOf(b, 0), ...eligible(b, 'Human', 'Neutral').map((d) => d.id));
      return nothing();
    },
    check(o, s) {
      return {
        got: { told: told(o, LIBRARY_DONE), count: (realmOf(o, 0)['discoveries'] as Raw[]).length },
        want: { told: lineTo(0), count: eligible(boardOf(s), 'Human', 'Neutral').length + 1 },
      };
    },
  },
  {
    name: 'the one discovery left unknown is given, whatever the die',
    dice: { roll: 1, die: 0 },
    stage(b) {
      const all = eligible(b, 'Human', 'Neutral').map((d) => d.id);
      library(b, 0, seatOf(b, 0), ...all.filter((id) => id !== 'sd02'));
      return nothing();
    },
    check(o) {
      return { got: { last: (realmOf(o, 0)['discoveries'] as Raw[]).at(-1)?.['id'] }, want: { last: 'sd02' } };
    },
  },
  {
    name: 'a discovery the realm forgot is never given again: with only that one left, the realm is told it knows all',
    stage(b) {
      const all = eligible(b, 'Human', 'Neutral').map((d) => d.id);
      library(b, 0, seatOf(b, 0), ...all.filter((id) => id !== 'sd02'));
      realm(b, 0)['forgottenDiscoveries'] = ['sd02'];
      return nothing();
    },
    check(o) {
      return { got: { told: count(o, LIBRARY_DONE) }, want: { told: 1 } };
    },
  },
  {
    name: 'a discovery awaiting the realm’s choice is never given: with only that one left, the realm is told it knows all',
    stage(b) {
      const all = eligible(b, 'Human', 'Neutral').map((d) => d.id);
      library(b, 0, seatOf(b, 0), ...all.filter((id) => id !== 'sd02'));
      realm(b, 0)['pendingDiscoveryChoices'] = [{ key: 'k', turn: b.G.turn, options: ['sd02', 'sd01'] }];
      return nothing();
    },
    check(o) {
      return { got: { told: count(o, LIBRARY_DONE) }, want: { told: 1 } };
    },
  },
  {
    name: 'a discovery of another folk or another creed is never given: with only those left, the realm is told it knows all',
    stage(b) {
      const all = eligible(b, 'Human', 'Neutral').map((d) => d.id);
      library(b, 0, seatOf(b, 0), ...all);
      return nothing();
    },
    check(o) {
      return {
        got: {
          told: count(o, LIBRARY_DONE),
          elven: (realmOf(o, 0)['discoveries'] as Raw[]).some((d) => /^(re|ad)/.test(String(d['id']))),
        },
        want: { told: 1, elven: false },
      };
    },
  },
  {
    name: 'two Neutral realms with the Grand Library: each gains one, told only its own',
    stage(b) {
      library(b, 0, seatOf(b, 0));
      library(b, 2, seatOf(b, 2));
      return nothing();
    },
    check(o, s) {
      const d = must(eligible(boardOf(s), 'Human', 'Neutral').at(-1), 'a discovery');
      return {
        got: { said: said(o) },
        want: {
          said: [
            [[0], uncovers(d)],
            [[2], uncovers(d)],
          ],
        },
      };
    },
  },
];

// ── The order of it all ──────────────────────────────────────────────────────────────────────────────────────────
export const ORDER_CASES: NewTurnCase[] = [
  {
    name: 'everything the stage does in one turn, in its order: the way back lost, an heir crowned, a summons and a pack leaving, the Grand Library',
    stage(b) {
      kingFalls(b, 0, { awaitsReturn: true });
      library(b, 2, seatOf(b, 2));
      const h = leads(at(b, NO_TITLE_SKILLS, { player: 2 }), [bound('Pack', b.G.turn), summoned('Blaze')]);
      return { hero: h, orders: [] };
    },
    check(o) {
      return {
        got: { said: kinds(o) },
        want: {
          said: [
            [[0], 'the way back lost'],
            [[0], 'an heir crowned'],
            [[2], 'a summons leaves'],
            [[2], 'the Wild Hunt done'],
            [[2], 'the Grand Library'],
          ],
        },
      };
    },
  },
  {
    name: 'the turn moves on before anything else: an heir is crowned, a dynasty ends and a discovery is made on the new turn',
    stage(b) {
      turnIs(b, 3);
      kingFalls(b, 0);
      holdsOnly(b, 1);
      kingFalls(b, 1);
      library(b, 2, seatOf(b, 2));
      return nothing();
    },
    check(o) {
      return {
        got: {
          crowned: heir(o, 0)['_crownedTurn'],
          ended: realmOf(o, 1)['_eliminatedTurn'],
          discovered: (realmOf(o, 2)['discoveries'] as Raw[]).at(-1)?.['turnDiscovered'],
        },
        want: { crowned: 4, ended: 4, discovered: 4 },
      };
    },
  },
  {
    name: 'the Reckoning is judged on the turn played, before the turn moves on: a call on turn 9 is too early',
    wholeTurnOnly: true,
    stage(b) {
      turnIs(b, 9);
      taxes(b, 40, 5, 5);
      return { orders: [], sends: { 0: { callReckoning: true } } };
    },
    check(o) {
      return { got: { early: count(o, tooEarly(realmOf(o, 0).name)) }, want: { early: 1 } };
    },
  },
  {
    name: 'a king whose way back is lost is not tried again by the Divine resurrection later in the turn: no "does not return"',
    wholeTurnOnly: true,
    stage(b) {
      const k = kingFalls(b, 0, { awaitsReturn: true, killedOnTurn: b.G.turn - 1 });
      return { hero: k, orders: [] };
    },
    check(o, s) {
      return {
        got: { lost: count(o, wayBackLost(hero(s))), notReturn: saying(o, `${hero(s).name} does not return`) },
        want: { lost: 1, notReturn: 0 },
      };
    },
  },
  {
    name: 'a summoned elemental leaves before the War Academy drills its realm’s home: no drill for it',
    wholeTurnOnly: true,
    stage(b) {
      knows(b, 0, 'sd08');
      const h = leads(at(b, NO_TITLE_SKILLS, { at: seatOf(b, 0) }), [summoned('Blaze')]);
      return { hero: h, orders: [] };
    },
    check(o) {
      return { got: { academy: saying(o, 'War Academy') }, want: { academy: 0 } };
    },
  },
];

// ── Every case ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Stages `c` on `b`, from plain realms with no heroes on their rolls, each realm holding only its seat (tax 10) with
 *  a living king there. */
export const stageCase = (b: Board, c: NewTurnCase): Staged => {
  plainRealms(b);
  taxes(b, ...b.G.players.map(() => 10));
  b.G.players.forEach((pl, pi) => {
    pl['heroes'] = [];
    at(b, NO_TITLE_SKILLS, { player: pi, king: true, at: seatOf(b, pi) });
  });
  raw(b)['_guardianHpV2'] = true;
  return { ...c.stage(b), board: b };
};

/** Every case, by part of the stage. */
export const NEW_TURN_CASES: [string, NewTurnCase[]][] = [
  ['the turn counter', TURN_CASES],
  ["a Divine king's way back", DIVINE_RETURN_CASES],
  ['succession', SUCCESSION_CASES],
  ['what was summoned for the turn', SUMMONS_CASES],
  ['one-turn spells end', SPELLS_END_CASES],
  ['the Grand Designs', GRAND_DESIGN_CASES],
  ['the order of it all', ORDER_CASES],
];
export { order, hero, other, there, place, ring1, ring2, at, leads, companies, knows, wanderer, NO_TITLE_SKILLS };
