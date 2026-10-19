// The new turn, second part (plan P1-08k5b, a stage of resolveTurn's own body lifted out): once the turn counter has
// moved on, heirs are crowned and the turn's summons and spells have ended (P1-08k5a's stage), the rest of the new
// turn. Staged on the middle of a bot world (lib/middle-of-a-bot-world.ts), from plain realms each holding only its
// seat with a living king there (P1-08k5a's `stageCase`), each case with what must be true after it in game terms.
// The War Academy may drill each company a realm's heroes keep in its home province up a grade; Physick Gardens and
// Royal Physicians mend the wounded; the Informant Network names one enemy captain the realm can't see and the Arcane
// Observatory charts one province it hasn't mapped; a Divine realm's hero fallen a full turn ago rises on the nearest
// consecrated ground it holds (spending it), or, with none, never returns; graves on the battlefields rot (less on an
// Undead realm's ground, never under the Embalmers); the mercenary bands retire or move on; the turn's flags are
// cleared, the save's repairs are told, stale graves of the living are purged, each realm remembers the graves it can
// see; wandering heroes recover and may drift; the turn's orders are cleared; every province's list of heroes is
// rebuilt, and a neutral guard left with no companies, or standing in a realm's land, becomes a wanderer.
// scenario/new-turn-war-academy-to-the-final-reconcile-in-a-whole-turn.test.ts plays each through a whole turn
// (resolveTurn); unit/new-turn-war-academy-to-the-final-reconcile-called-directly.test.ts calls the stage directly on
// the staged world. A case stages its world and the heroes' orders; after them, it reads what it needs from the world
// and the log (`got`) beside what must be so (`want`), and the test compares the two. Every outcome is certain: every
// case fixes the dice for the whole turn (default LANDS: every percentile roll lands, every other die at its highest),
// so the outcome holds however many dice the turn draws before it. By default each realm holds only its seat (tax 10)
// with a living king there, realms 0 and 1 are at war, 0 and 2 allied, 1 and 2 at peace (the board's relations), every
// realm is Divine and Human, and the turn is turn 1.
import {
  LANDS,
  NO_TITLE_SKILLS,
  at,
  char,
  consecrated,
  count,
  creed,
  holdsOnly,
  kingFalls,
  kingOf,
  knows,
  leads,
  lineTo,
  marks,
  province,
  realmOf,
  ring1,
  ring2,
  saying,
  seatOf,
  summoned,
  told,
  turnIs,
  unit,
  wanderer,
  type NewTurnCase,
  type Outcome,
  type Staged,
} from './new-turn-succession-and-summons-cases.ts';
import { must, order, type Board, type Character, type Province, type Unit } from './middle-of-a-bot-world.ts';
import { realm } from './cast-spell-order-cases.ts';
import type { Dice } from './espionage-order-cases.ts';

export { LANDS };
type Raw = Record<string, unknown>;
const raw = (b: Board) => b.G as unknown as Raw;
const rawOf = (o: Outcome) => o.world as unknown as Raw;
const nothing = (): Staged => ({ orders: [] });
const hero = (s: Staged) => must(s.hero, 'the hero');
const other = (s: Staged, i: number) => must(s.others?.[i], 'hero ' + String(i));
const there = (s: Staged) => must(s.there, 'the province');
const place = (s: Staged, i: number) => must(s.places?.[i], 'place ' + String(i));

// ── The dice ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** Every roll lands; every other die just under the War Academy's 7% (each company it may drill trains). */
export const DRILLS: Dice = { roll: 1, die: 0.0699 };
/** Every roll lands; every other die at the War Academy's 7% exactly (no company trains). */
export const NO_DRILL: Dice = { roll: 1, die: 0.07 };
/** The roll a case fixes at `die` for every other die. */
export const dieAt = (die: number): Dice => ({ roll: 1, die });

// ── Staging ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** A hero of realm `pi` (or none) standing in `p`, leading `us`, with no skill a title counts. */
export const standing = (b: Board, pi: number | null, p: Province, us: Unit[] = []) =>
  leads(at(b, NO_TITLE_SKILLS, { player: pi, at: p }), us);
/** Holds every phase on Defend, so the hero rests nowhere and keeps his wounds through the turn. */
export const holds = (c: Character): [Character, ReturnType<typeof order>[]] => [
  c,
  Array.from({ length: 5 }, () => order('defend')),
];
/** Wounds `c` to `hp`. */
export const wounded = (c: Character, hp: number) => {
  c.hp = hp;
  return c;
};
/** Realm `pi` has mapped every province in full but `ps`, each to the share given. */
export const mappedAllBut = (b: Board, pi: number, ...ps: [Province, number][]) => {
  b.G.world.provinces.forEach((p) => {
    const e = (p['exploredBy'] as Record<number, number> | undefined) ?? {};
    e[pi] = 100;
    p['exploredBy'] = e;
  });
  ps.forEach(([p, share]) => {
    (p['exploredBy'] as Record<number, number>)[pi] = share;
  });
};
/** `n` graves of the battle dead lying in `p`. */
export const graves = (p: Province, n: number) => {
  p['battleGraves'] = Array.from({ length: n }, (_, k) => ({
    type: 'Men-at-Arms',
    quality: 'Average',
    race: 'Human',
    unitName: `Grave ${String(k)}`,
  }));
};
/** A mercenary band standing in `p` (by default on land; `name` null: a band with no name). */
export const band = (b: Board, p: Province, name: string | null = 'The Red Lances', extra: Raw = {}) => {
  const m = {
    id: `merc_${String(p.id)}_${String(b.G.mercenaries?.length ?? 0)}`,
    type: 'Free Lances',
    quality: 'Veteran',
    location: p.id,
    ...(name === null ? {} : { unitName: name }),
    ...extra,
  };
  (b.G.mercenaries ??= []).push(m);
  return m;
};
/** The provinces around `p`, in the order the turn's end reads them: on an even row north-west, north, west, east,
 *  south-west, south; on an odd row north, north-east, west, east, south, south-east (the map wraps east to west; no
 *  row beyond the top or the bottom). */
export const around = (b: Board, p: Province) => {
  const { cols, rows, provinces } = b.G.world;
  const steps =
    p.row % 2 === 0
      ? [
          [-1, -1],
          [-1, 0],
          [0, -1],
          [0, 1],
          [1, -1],
          [1, 0],
        ]
      : [
          [-1, 0],
          [-1, 1],
          [0, -1],
          [0, 1],
          [1, 0],
          [1, 1],
        ];
  return steps.flatMap(([dr = 0, dc = 0]) => {
    const r = p.row + dr;
    if (r < 0 || r >= rows) return [];
    const q = provinces[r * cols + ((((p.col + dc) % cols) + cols) % cols)];
    return q ? [q] : [];
  });
};
/** The land provinces around `p`, in that order. */
export const landAround = (b: Board, p: Province) => around(b, p).filter((q) => q.terrain !== 'sea');
/** A hero of realm `pi` fallen in `where` (default the middle) on turn `killedOnTurn` (default the turn before: a
 *  Divine hero is due to rise this turn): dead, gone from the province, his grave in the graveyard with his companies
 *  and items still on him. */
export const fallenHero = (
  b: Board,
  pi: number | null,
  where: Province = b.X,
  { killedOnTurn = b.G.turn - 1, maxHp = 20 }: { killedOnTurn?: number; maxHp?: number } = {},
) => {
  const d = at(b, NO_TITLE_SKILLS, { player: pi, at: where, troops: 2, hp: maxHp });
  d.items = [{ name: 'Iron Ring', slot: 'ring' }];
  d.alive = false;
  d.hp = 0;
  where.characters = where.characters.filter((id) => id !== d.id);
  const gs = (raw(b)['heroGraveyard'] as Raw[] | undefined) ?? [];
  raw(b)['heroGraveyard'] = [...gs, graveOf(d, killedOnTurn, where)];
  return d;
};
/** The graveyard's record of `d`, fallen in `where` on turn `killedOnTurn`. */
export const graveOf = (d: Character, killedOnTurn: number, where: Province | null): Raw => ({
  id: d.id,
  name: d.name,
  player: d.player,
  race: d['race'],
  alignment: d['alignment'],
  temper: d['temper'],
  skills: { ...d.skills },
  maxHp: d.maxHp,
  isKing: d.isKing,
  killedOnTurn,
  location: where === null ? null : where.id,
  served: d.player == null ? [] : [d.player],
  _releasedBy: null,
});
/** A grave in the graveyard for `c`, though he lives (a stale record a save may carry). */
export const ghostGrave = (b: Board, c: Character, killedOnTurn = b.G.turn) => {
  const gs = (raw(b)['heroGraveyard'] as Raw[] | undefined) ?? [];
  raw(b)['heroGraveyard'] = [...gs, graveOf(c, killedOnTurn, must(b.G.world.provinces[c.location], 'his province'))];
};
/** A neutral guard standing in `p`, leading `us`. */
export const guard = (b: Board, p: Province, us: Unit[]) => {
  const g = standing(b, null, p, us);
  g._isNeutralGuard = true;
  g.name = 'Warden ' + String(g.id);
  return g;
};

// ── Reading the outcome ──────────────────────────────────────────────────────────────────────────────────────────
export const graveyard = (o: Outcome) => (rawOf(o)['heroGraveyard'] as Raw[] | undefined) ?? [];
export const graveFor = (o: Outcome, c: Character) => graveyard(o).find((g) => g['id'] === c.id);
/** The grades of `c`'s companies after the turn, as "<name> (<grade>)". */
export const grades = (o: Outcome, c: Character) => char(o, c).armies.map((u) => `${u.unitName} (${u.quality})`);
/** The graves left in `p`. */
export const gravesIn = (o: Outcome, p: Province) =>
  ((province(o, p)['battleGraves'] as unknown[] | undefined) ?? []).length;
/** Where each mercenary band stands after the turn, by name. */
export const bands = (o: Outcome) => (o.world.mercenaries ?? []).map((m) => [m['unitName'] ?? m.type, m.location]);
/** The heroes each province lists, for the provinces given. */
export const listed = (o: Outcome, ...ps: Province[]) => ps.map((p) => province(o, p).characters.slice().sort());
export const known = (o: Outcome, pi: number) => (realmOf(o, pi)['knownDeadHeroIds'] as number[] | undefined) ?? null;
const STAGE_LINE =
  /^(War Academy: |🌿 .*physick gardens|\[Intelligence\] (Informant Network reports|Your informants surface)|🔭 Arcane Observatory|✨ \*\*Divine Resurrection\*\*|✨ .* does not return\.|The mercenary band .* has retired|\[Integrity\] )/;
const KINDS: [RegExp, string][] = [
  [/^War Academy: the drills/, 'no drill'],
  [/^War Academy: /, 'a company drilled'],
  [/physick gardens/, 'wounds knit'],
  [/^\[Intelligence\] Your informants surface nothing/, 'nothing new'],
  [/^\[Intelligence\] /, 'an informant’s report'],
  [/^🔭 Arcane Observatory: your astronomers find no/, 'all charted'],
  [/^🔭 /, 'a province charted'],
  [/Divine Resurrection/, 'a hero rises'],
  [/does not return/, 'the grace lost'],
  [/mercenary band/, 'a band retires'],
  [/bore the/, 'names repaired'],
  [/retired Sage discover/, 'discoveries retired'],
  [/listed in the graveyard while alive/, 'a stale grave purged'],
];
/** Every line this stage wrote, in order: whom it is told to, and what it says. */
export const said = (o: Outcome) =>
  o.all.filter((l) => l.phase === 99 && STAGE_LINE.test(l.text)).map((l) => [l.targets ?? null, l.text] as const);
/** Every line this stage wrote, in order: whom it is told to, and what kind of line it is. */
export const kinds = (o: Outcome) =>
  said(o).map(([to, t]) => [to, KINDS.find(([re]) => re.test(t))?.[1] ?? t] as const);

// ── The stage's lines ────────────────────────────────────────────────────────────────────────────────────────────
export const drilled = (u: Unit, p: Province, to: string) =>
  `War Academy: ${u.unitName ? `${u.unitName} (${u.type})` : `a ${u.type}`} in ${p.name} trains to ${to}!`;
export const noDrill = (p: Province) => `War Academy: the drills in ${p.name} produced no promotions this turn.`;
export const knit = (c: Character, h: number, hp: number, mx: number) =>
  `🌿 ${c.name}'s wounds knit in the physick gardens: +${String(h)} HP (${String(hp)}/${String(mx)}).`;
export const NOTHING_NEW =
  '[Intelligence] Your informants surface nothing new — every enemy captain they could name is already within your sight.';
export const reports = (c: Character, realmName: string, p: Province | string) =>
  `[Intelligence] Informant Network reports: ${c.name} of ${realmName} — unseen by your own eyes — was last in ${typeof p === 'string' ? p : p.name}.`;
export const ALL_CHARTED =
  '🔭 Arcane Observatory: your astronomers find no uncharted province left to study — the whole known world is already mapped in full.';
export const charts = (p: Province, terrain = p.terrain) =>
  `🔭 Arcane Observatory: your astronomers chart **${p.name}** (${terrain}) in full from afar — the province is now 100% explored.`;
export const notReturn = (c: Character) =>
  `✨ ${c.name} does not return. The divine restore the fallen only upon consecrated ground, and the realm holds none — the grace is lost. (The body remains where it lies; a Resurrect spell may yet reach it.)`;
export const risesIn = (c: Character, p: Province, hp: number, king = false) =>
  `✨ **Divine Resurrection**: ${c.name}${king ? ', your monarch,' : ''} returns to life by the grace of the divine! They appear in ${p.name}, the nearest consecrated ground, with ${String(hp)} HP — no armies or items, but their spirit and skills endure. The miracle spends the province's consecration: ${p.name} is holy ground no longer, and the crown may sanctify new ground in its place.${king ? ' The crown is worn once more.' : ''}`;
export const retires = (name: string, p: Province | string) =>
  `The mercenary band ${name} in ${typeof p === 'string' ? p : p.name} has retired and dispersed.`;
export const renamed = (n: number) =>
  `[Integrity] ${String(n)} hero${n !== 1 ? 'es' : ''} in a realm's service still bore the “(wandering)” tag — the name has been corrected.`;
export const discoveriesRetired = (n: number) =>
  `[Integrity] ${String(n)} retired Sage discover${n !== 1 ? 'ies were' : 'y was'} removed from realm records.`;
export const staleGrave = (name: string) =>
  `[Integrity] ${name} was listed in the graveyard while alive — the stale grave has been removed.`;

// ── The War Academy ──────────────────────────────────────────────────────────────────────────────────────────────
const home = (b: Board) => seatOf(b, 0);
export const WAR_ACADEMY_CASES: NewTurnCase[] = [
  {
    name: 'a realm with the War Academy: at a die under 7% each company its heroes keep in its home province trains up a grade, each told to the realm alone, hero by hero',
    dice: DRILLS,
    stage(b) {
      knows(b, 0, 'sd08');
      const k = leads(kingOf(b, 0), [
        unit('Lances', 'Free Lances', 'Average'),
        unit('Guard', 'Men-at-Arms', 'Veteran'),
      ]);
      const h = standing(b, 0, home(b), [unit('Bows', 'Yeoman Longbows', 'Green')]);
      return { hero: k, others: [h], there: home(b), orders: [] };
    },
    check(o, s) {
      const p = there(s);
      return {
        got: {
          king: grades(o, hero(s)),
          hero: grades(o, other(s, 0)),
          told: told(o, drilled(unit('Lances', 'Free Lances'), p, 'Veteran')),
          said: said(o),
        },
        want: {
          king: ['Lances (Veteran)', 'Guard (Crack)'],
          hero: ['Bows (Average)'],
          told: lineTo(0),
          said: [
            [[0], drilled(unit('Lances', 'Free Lances'), p, 'Veteran')],
            [[0], drilled(unit('Guard', 'Men-at-Arms'), p, 'Crack')],
            [[0], drilled(unit('Bows', 'Yeoman Longbows'), p, 'Average')],
          ],
        },
      };
    },
  },
  {
    name: 'at a die of 7% no company trains: the realm is told its drills produced no promotions',
    dice: NO_DRILL,
    stage(b) {
      knows(b, 0, 'sd08');
      const k = leads(kingOf(b, 0), [unit('Lances', 'Free Lances', 'Average')]);
      return { hero: k, there: home(b), orders: [] };
    },
    check(o, s) {
      return {
        got: { king: grades(o, hero(s)), told: told(o, noDrill(there(s))), said: said(o) },
        want: { king: ['Lances (Average)'], told: lineTo(0), said: [[[0], noDrill(there(s))]] },
      };
    },
  },
  {
    name: 'an Elite company has no grade left to reach and the risen dead never learn: with only those at home, nothing is said',
    dice: DRILLS,
    stage(b) {
      knows(b, 0, 'sd08');
      const k = leads(kingOf(b, 0), [
        unit('Old Guard', 'Men-at-Arms', 'Elite'),
        unit('Bones', 'Shieldwall Levies', 'Average', 'Human', { _isSkeletal: true }),
      ]);
      k.skills['necromancy'] = 1;
      return { hero: k, orders: [] };
    },
    check(o, s) {
      return {
        got: { king: grades(o, hero(s)), said: said(o) },
        want: { king: ['Old Guard (Elite)', 'Bones (Average)'], said: [] },
      };
    },
  },
  {
    name: 'an Elite company stays Elite while the company beside it trains',
    dice: DRILLS,
    stage(b) {
      knows(b, 0, 'sd08');
      const k = leads(kingOf(b, 0), [
        unit('Old Guard', 'Men-at-Arms', 'Elite'),
        unit('Recruits', 'Men-at-Arms', 'Green'),
      ]);
      return { hero: k, there: home(b), orders: [] };
    },
    check(o, s) {
      return {
        got: { king: grades(o, hero(s)), said: said(o) },
        want: {
          king: ['Old Guard (Elite)', 'Recruits (Average)'],
          said: [[[0], drilled(unit('Recruits', 'Men-at-Arms'), there(s), 'Average')]],
        },
      };
    },
  },
  {
    name: 'only companies at home train: not a hero’s companies a province away, nor an allied realm’s hero’s standing in the home',
    dice: DRILLS,
    stage(b) {
      knows(b, 0, 'sd08');
      const k = leads(kingOf(b, 0), [unit('Home', 'Men-at-Arms')]);
      const away = standing(b, 0, ring2(b, 1), [unit('Away', 'Men-at-Arms')]);
      const guest = standing(b, 2, home(b), [unit('Guest', 'Men-at-Arms')]);
      return { hero: k, others: [away, guest], there: home(b), orders: [] };
    },
    check(o, s) {
      return {
        got: { home: grades(o, hero(s)), away: grades(o, other(s, 0)), guest: grades(o, other(s, 1)), said: said(o) },
        want: {
          home: ['Home (Veteran)'],
          away: ['Away (Average)'],
          guest: ['Guest (Average)'],
          said: [[[0], drilled(unit('Home', 'Men-at-Arms'), there(s), 'Veteran')]],
        },
      };
    },
  },
  {
    name: 'the home is the first province the realm holds, in the map’s order, with a tax of 10 or more: not its seat at a tax of 5, nor a richer one further on',
    dice: DRILLS,
    stage(b) {
      knows(b, 0, 'sd08');
      const first = ring2(b, 1);
      const richer = ring2(b, 2);
      holdsOnly(b, 0, [home(b), 5], [first, 10], [richer, 12]);
      leads(kingOf(b, 0), [unit('Seat', 'Men-at-Arms')]);
      const a = standing(b, 0, first, [unit('First', 'Men-at-Arms')]);
      const c = standing(b, 0, richer, [unit('Richer', 'Men-at-Arms')]);
      return { hero: kingOf(b, 0), others: [a, c], there: first, orders: [] };
    },
    check(o, s) {
      return {
        got: { seat: grades(o, hero(s)), first: grades(o, other(s, 0)), richer: grades(o, other(s, 1)), said: said(o) },
        want: {
          seat: ['Seat (Average)'],
          first: ['First (Veteran)'],
          richer: ['Richer (Average)'],
          said: [[[0], drilled(unit('First', 'Men-at-Arms'), there(s), 'Veteran')]],
        },
      };
    },
  },
  {
    name: 'a realm holding no province with a tax of 10 or more has no home to drill in: nothing is said',
    dice: DRILLS,
    stage(b) {
      knows(b, 0, 'sd08');
      holdsOnly(b, 0, [home(b), 9]);
      const k = leads(kingOf(b, 0), [unit('Lances', 'Free Lances')]);
      return { hero: k, orders: [] };
    },
    check(o, s) {
      return { got: { king: grades(o, hero(s)), said: said(o) }, want: { king: ['Lances (Average)'], said: [] } };
    },
  },
  {
    name: 'a realm without the War Academy drills nobody',
    dice: DRILLS,
    stage(b) {
      const k = leads(kingOf(b, 0), [unit('Lances', 'Free Lances')]);
      return { hero: k, orders: [] };
    },
    check(o, s) {
      return { got: { king: grades(o, hero(s)), said: said(o) }, want: { king: ['Lances (Average)'], said: [] } };
    },
  },
  {
    name: 'heroes at home with no companies: nothing to drill, nothing said',
    dice: DRILLS,
    stage(b) {
      knows(b, 0, 'sd08');
      standing(b, 0, home(b));
      return nothing();
    },
    check(o) {
      return { got: { said: said(o) }, want: { said: [] } };
    },
  },
  {
    name: 'two realms with the War Academy each drill their own home, each told only of its own',
    dice: DRILLS,
    stage(b) {
      knows(b, 0, 'sd08');
      knows(b, 2, 'sd08');
      leads(kingOf(b, 0), [unit('North', 'Men-at-Arms')]);
      leads(kingOf(b, 1), [unit('East', 'Men-at-Arms')]);
      leads(kingOf(b, 2), [unit('South', 'Men-at-Arms')]);
      return { places: [seatOf(b, 0), seatOf(b, 2)], others: [kingOf(b, 1)], orders: [] };
    },
    check(o, s) {
      return {
        got: { east: grades(o, other(s, 0)), said: said(o) },
        want: {
          east: ['East (Average)'],
          said: [
            [[0], drilled(unit('North', 'Men-at-Arms'), place(s, 0), 'Veteran')],
            [[2], drilled(unit('South', 'Men-at-Arms'), place(s, 1), 'Veteran')],
          ],
        },
      };
    },
  },
];

// ── The wounded mend ─────────────────────────────────────────────────────────────────────────────────────────────
export const MENDING_CASES: NewTurnCase[] = [
  {
    name: 'Physick Gardens: each wounded hero of the realm recovers 3 HP at the turn’s end, told to the realm with the hero named; a hero at full health hears nothing',
    stage(b) {
      knows(b, 0, 'sd65');
      const h = wounded(standing(b, 0, b.X), 10);
      return { hero: h, orders: [holds(h)] };
    },
    check(o, s) {
      return {
        got: { hp: char(o, hero(s)).hp, told: told(o, knit(hero(s), 3, 13, 20)), said: said(o) },
        want: { hp: 13, told: lineTo(0, { charId: hero(s).id }), said: [[[0], knit(hero(s), 3, 13, 20)]] },
      };
    },
  },
  {
    name: 'never past his maximum: a hero 1 HP short recovers 1',
    stage(b) {
      knows(b, 0, 'sd65');
      const h = wounded(standing(b, 0, b.X), 19);
      return { hero: h, orders: [holds(h)] };
    },
    check(o, s) {
      return {
        got: { hp: char(o, hero(s)).hp, said: said(o) },
        want: { hp: 20, said: [[[0], knit(hero(s), 1, 20, 20)]] },
      };
    },
  },
  {
    name: 'Royal Physicians mend only the king, with Physick Gardens 3 and 4 HP (his maximum is 8 higher with them: 28, so wounded to 10 he stands at 18 by then), a hero 3',
    wholeTurnOnly: true,
    stage(b) {
      knows(b, 0, 'sd65', 'sd72');
      const k = wounded(kingOf(b, 0), 10);
      const h = wounded(standing(b, 0, b.X), 10);
      return { hero: k, others: [h], orders: [holds(k), holds(h)] };
    },
    check(o, s) {
      return {
        got: { hp: [char(o, hero(s)).hp, char(o, other(s, 0)).hp], said: said(o) },
        want: {
          hp: [25, 13],
          said: [
            [[0], knit(hero(s), 7, 25, 28)],
            [[0], knit(other(s, 0), 3, 13, 20)],
          ],
        },
      };
    },
  },
  {
    name: 'Royal Physicians alone: the wounded king recovers 4, a wounded hero nothing',
    wholeTurnOnly: true,
    stage(b) {
      knows(b, 0, 'sd72');
      const k = wounded(kingOf(b, 0), 10);
      const h = wounded(standing(b, 0, b.X), 10);
      return { hero: k, others: [h], orders: [holds(k), holds(h)] };
    },
    check(o, s) {
      return {
        got: { hp: [char(o, hero(s)).hp, char(o, other(s, 0)).hp], said: said(o) },
        want: { hp: [22, 10], said: [[[0], knit(hero(s), 4, 22, 28)]] },
      };
    },
  },
  {
    name: 'another realm’s gardens mend none of this realm’s wounded, and a realm without them mends nobody',
    stage(b) {
      knows(b, 1, 'sd65');
      const h = wounded(standing(b, 0, b.X), 10);
      return { hero: h, orders: [holds(h)] };
    },
    check(o, s) {
      return { got: { hp: char(o, hero(s)).hp, said: said(o) }, want: { hp: 10, said: [] } };
    },
  },
];

// ── The informants and the Observatory ──────────────────────────────────────────────────────────────────────────
const nameOf = (o: Outcome, pi: number) => realmOf(o, pi).name;
export const INFORMANT_CASES: NewTurnCase[] = [
  {
    name: 'the Informant Network names an enemy captain the realm can’t see, and where he was last, told to the realm alone',
    stage(b) {
      knows(b, 0, 'sd22');
      const e = standing(b, 1, ring1(b, 3));
      return { hero: e, there: ring1(b, 3), orders: [] };
    },
    check(o, s) {
      const line = reports(hero(s), nameOf(o, 1), there(s));
      return { got: { told: told(o, line), said: said(o) }, want: { told: lineTo(0), said: [[[0], line]] } };
    },
  },
  {
    name: 'captains standing in a province the realm holds, or beside one of its heroes, are in its sight: nothing new',
    stage(b) {
      knows(b, 0, 'sd22');
      standing(b, 0, ring1(b, 3));
      standing(b, 2, ring1(b, 3));
      standing(b, 2, home(b));
      return nothing();
    },
    check(o) {
      return {
        got: { told: told(o, NOTHING_NEW), said: said(o) },
        want: { told: lineTo(0), said: [[[0], NOTHING_NEW]] },
      };
    },
  },
  {
    name: 'a captain in a province the realm holds with none of its heroes there is in its sight: nothing new',
    stage(b) {
      knows(b, 0, 'sd22');
      holdsOnly(b, 0, [home(b), 10], [ring1(b, 3), 5]);
      standing(b, 2, ring1(b, 3));
      return nothing();
    },
    check(o) {
      return { got: { said: said(o) }, want: { said: [[[0], NOTHING_NEW]] } };
    },
  },
  {
    name: 'a captain on his own realm’s land, where the realm has no eyes, is named: another realm’s land gives it no sight',
    stage(b) {
      knows(b, 0, 'sd22');
      const e = standing(b, 1, seatOf(b, 1));
      return { hero: e, there: seatOf(b, 1), orders: [] };
    },
    check(o, s) {
      return { got: { said: said(o) }, want: { said: [[[0], reports(hero(s), nameOf(o, 1), there(s))]] } };
    },
  },
  {
    name: 'a fallen hero of the realm gives it no eyes where he lies: a captain standing there is named',
    stage(b) {
      knows(b, 0, 'sd22');
      fallenHero(b, 0, ring1(b, 3), { killedOnTurn: b.G.turn });
      creed(b, 0, 'Pagan');
      const e = standing(b, 2, ring1(b, 3));
      return { hero: e, there: ring1(b, 3), orders: [] };
    },
    check(o, s) {
      return { got: { said: said(o) }, want: { said: [[[0], reports(hero(s), nameOf(o, 2), there(s))]] } };
    },
  },
  {
    name: 'kings are never named, nor wandering heroes, nor the fallen: nothing new',
    stage(b) {
      knows(b, 0, 'sd22');
      wanderer(b, NO_TITLE_SKILLS, { at: ring1(b, 3) });
      fallenHero(b, 1, ring1(b, 4), { killedOnTurn: b.G.turn });
      return nothing();
    },
    check(o) {
      return { got: { said: said(o) }, want: { said: [[[0], NOTHING_NEW]] } };
    },
  },
  {
    name: 'an allied realm’s captain the realm can’t see is named too: the network counts every other realm’s captains',
    stage(b) {
      knows(b, 0, 'sd22');
      const e = standing(b, 2, ring1(b, 3));
      return { hero: e, there: ring1(b, 3), orders: [] };
    },
    check(o, s) {
      return { got: { said: said(o) }, want: { said: [[[0], reports(hero(s), nameOf(o, 2), there(s))]] } };
    },
  },
  {
    name: 'of several unseen captains, the highest die names the last in the roll of heroes',
    stage(b) {
      knows(b, 0, 'sd22');
      const e1 = standing(b, 1, ring1(b, 3));
      const e2 = standing(b, 1, ring1(b, 4));
      return { hero: e1, others: [e2], places: [ring1(b, 4)], orders: [] };
    },
    check(o, s) {
      return { got: { said: said(o) }, want: { said: [[[0], reports(other(s, 0), nameOf(o, 1), place(s, 0))]] } };
    },
  },
  {
    name: 'of several unseen captains, the lowest die names the first in the roll of heroes',
    dice: dieAt(0),
    stage(b) {
      knows(b, 0, 'sd22');
      const e1 = standing(b, 1, ring1(b, 3));
      const e2 = standing(b, 1, ring1(b, 4));
      return { hero: e1, others: [e2], places: [ring1(b, 3)], orders: [] };
    },
    check(o, s) {
      return { got: { said: said(o) }, want: { said: [[[0], reports(hero(s), nameOf(o, 1), place(s, 0))]] } };
    },
  },
  {
    name: 'a realm without the network learns nothing of an unseen captain',
    stage(b) {
      standing(b, 1, ring1(b, 3));
      return nothing();
    },
    check(o) {
      return { got: { said: said(o) }, want: { said: [] } };
    },
  },
  {
    name: 'two realms with the network, each told of a captain it can’t see',
    stage(b) {
      knows(b, 0, 'sd22');
      knows(b, 1, 'sd22');
      const e1 = standing(b, 1, ring1(b, 3));
      const e0 = standing(b, 0, ring1(b, 4));
      return { hero: e1, others: [e0], places: [ring1(b, 3), ring1(b, 4)], orders: [] };
    },
    check(o, s) {
      return {
        got: { said: said(o) },
        want: {
          said: [
            [[0], reports(hero(s), nameOf(o, 1), place(s, 0))],
            [[1], reports(other(s, 0), nameOf(o, 0), place(s, 1))],
          ],
        },
      };
    },
  },
];
export const OBSERVATORY_CASES: NewTurnCase[] = [
  {
    name: 'the Arcane Observatory charts in full one province the realm hasn’t mapped, told to the realm alone with the province named',
    stage(b) {
      knows(b, 0, 'sd39');
      mappedAllBut(b, 0, [ring1(b, 3), 40]);
      return { there: ring1(b, 3), orders: [] };
    },
    check(o, s) {
      const p = province(o, there(s));
      return {
        got: {
          mapped: (p['exploredBy'] as Record<string, number>)['0'],
          explored: p['explored'],
          visits: Array.isArray(p.visitedBy),
          told: told(o, charts(there(s))),
          said: said(o),
        },
        want: {
          mapped: 100,
          explored: 100,
          visits: true,
          told: lineTo(0, { type: 'explore', provinceId: there(s).id }),
          said: [[[0], charts(there(s))]],
        },
      };
    },
  },
  {
    name: 'a province mapped to 99% is not yet mapped: of two, the highest die charts the last in the map’s order',
    stage(b) {
      knows(b, 0, 'sd39');
      mappedAllBut(b, 0, [ring1(b, 0), 99], [ring1(b, 3), 0]);
      return { places: [ring1(b, 0), ring1(b, 3)], orders: [] };
    },
    check(o, s) {
      return {
        got: { first: mappedBy(o, place(s, 0), 0), said: said(o) },
        want: { first: 99, said: [[[0], charts(place(s, 1))]] },
      };
    },
  },
  {
    name: 'of two unmapped provinces, the lowest die charts the first in the map’s order',
    dice: dieAt(0),
    stage(b) {
      knows(b, 0, 'sd39');
      mappedAllBut(b, 0, [ring1(b, 0), 99], [ring1(b, 3), 0]);
      return { places: [ring1(b, 0), ring1(b, 3)], orders: [] };
    },
    check(o, s) {
      return {
        got: { last: mappedBy(o, place(s, 1), 0), said: said(o) },
        want: { last: 0, said: [[[0], charts(place(s, 0))]] },
      };
    },
  },
  {
    name: 'with the whole world mapped, the astronomers say there is nothing left to chart',
    stage(b) {
      knows(b, 0, 'sd39');
      mappedAllBut(b, 0);
      return nothing();
    },
    check(o) {
      return {
        got: { told: told(o, ALL_CHARTED), said: said(o) },
        want: { told: lineTo(0, { type: 'explore' }), said: [[[0], ALL_CHARTED]] },
      };
    },
  },
  {
    name: 'the Observatory charts whether or not the informants have anything to say: after them',
    stage(b) {
      knows(b, 0, 'sd22', 'sd39');
      mappedAllBut(b, 0, [ring1(b, 3), 0]);
      return { there: ring1(b, 3), orders: [] };
    },
    check(o, s) {
      return {
        got: { said: said(o) },
        want: {
          said: [
            [[0], NOTHING_NEW],
            [[0], charts(there(s))],
          ],
        },
      };
    },
  },
  {
    name: 'a realm without the Observatory charts nothing',
    stage(b) {
      mappedAllBut(b, 0, [ring1(b, 3), 0]);
      return { there: ring1(b, 3), orders: [] };
    },
    check(o, s) {
      return { got: { mapped: mappedBy(o, there(s), 0), said: said(o) }, want: { mapped: 0, said: [] } };
    },
  },
  {
    name: 'two realms with the Observatory each chart their own',
    stage(b) {
      knows(b, 0, 'sd39');
      knows(b, 1, 'sd39');
      mappedAllBut(b, 0, [ring1(b, 3), 0]);
      mappedAllBut(b, 1, [ring1(b, 4), 0]);
      return { places: [ring1(b, 3), ring1(b, 4)], orders: [] };
    },
    check(o, s) {
      return {
        got: { said: said(o), mapped: [mappedBy(o, place(s, 0), 0), mappedBy(o, place(s, 1), 1)] },
        want: {
          said: [
            [[0], charts(place(s, 0))],
            [[1], charts(place(s, 1))],
          ],
          mapped: [100, 100],
        },
      };
    },
  },
];
/** How much of `p` realm `pi` has mapped after the turn. */
export const mappedBy = (o: Outcome, p: Province, pi: number) =>
  (province(o, p)['exploredBy'] as Record<string, number> | undefined)?.[String(pi)] ?? 0;

// ── The Divine return ────────────────────────────────────────────────────────────────────────────────────────────
const holyLeft = (o: Outcome, pi = 0) => realmOf(o, pi)['consecratedProvIds'];
/** What a hero risen in `p` with `hp` is: alive, with no companies or items, standing there. */
const risenAs = (o: Outcome, c: Character) => {
  const h = char(o, c);
  return { alive: h.alive, hp: h.hp, armies: h.armies.length, items: h.items.length, at: h.location };
};
export const DIVINE_RETURN_CASES: NewTurnCase[] = [
  {
    name: 'a Divine realm’s hero fallen on the turn before rises on the consecrated ground his realm holds: half his HP, no companies or items, standing and listed there, his grave gone, the ground’s consecration spent; told to the realm alone',
    stage(b) {
      turnIs(b, 3);
      const d = fallenHero(b, 0, b.X);
      consecrated(b, 0, home(b));
      return { hero: d, there: home(b), orders: [] };
    },
    check(o, s) {
      const line = risesIn(hero(s), there(s), 10);
      return {
        got: {
          risen: risenAs(o, hero(s)),
          listed: province(o, there(s)).characters.filter((id) => id === hero(s).id).length,
          grave: graveFor(o, hero(s)) ?? null,
          holy: holyLeft(o),
          told: told(o, line),
          said: said(o),
        },
        want: {
          risen: { alive: true, hp: 10, armies: 0, items: 0, at: there(s).id },
          listed: 1,
          grave: null,
          holy: [],
          told: lineTo(0, { type: 'explore', provinceId: there(s).id }),
          said: [[[0], line]],
        },
      };
    },
  },
  {
    name: 'half his HP rounded down: a hero of 15 rises with 7, one of 25 with 12',
    stage(b) {
      turnIs(b, 3);
      holdsOnly(b, 0, [home(b), 10], [ring2(b, 1), 5]);
      const d1 = fallenHero(b, 0, home(b), { maxHp: 15 });
      const d2 = fallenHero(b, 0, ring2(b, 1), { maxHp: 25 });
      consecrated(b, 0, home(b), ring2(b, 1));
      return { hero: d1, others: [d2], orders: [] };
    },
    check(o, s) {
      return {
        got: { hp: [char(o, hero(s)).hp, char(o, other(s, 0)).hp] },
        want: { hp: [7, 12] },
      };
    },
  },
  {
    name: 'a hero fallen this turn is not yet due: he stays in his grave, and the ground keeps its consecration',
    stage(b) {
      turnIs(b, 3);
      const d = fallenHero(b, 0, b.X, { killedOnTurn: 3 });
      consecrated(b, 0, home(b));
      return { hero: d, there: home(b), orders: [] };
    },
    check(o, s) {
      return {
        got: { alive: char(o, hero(s)).alive, grave: !!graveFor(o, hero(s)), holy: holyLeft(o), said: said(o) },
        want: { alive: false, grave: true, holy: [there(s).id], said: [] },
      };
    },
  },
  {
    name: 'with no consecrated ground, the grace is lost: told to the realm, the body left in its grave, marked never to be tried again',
    stage(b) {
      turnIs(b, 3);
      const d = fallenHero(b, 0, b.X);
      return { hero: d, orders: [] };
    },
    check(o, s) {
      return {
        got: {
          alive: char(o, hero(s)).alive,
          lost: graveFor(o, hero(s))?.['_divineLost'] ?? null,
          told: told(o, notReturn(hero(s))),
          said: said(o),
        },
        want: {
          alive: false,
          lost: true,
          told: lineTo(0, { type: 'explore' }),
          said: [[[0], notReturn(hero(s))]],
        },
      };
    },
  },
  {
    name: 'a grace already lost is never tried again, even once the realm holds consecrated ground: nothing said',
    stage(b) {
      turnIs(b, 3);
      const d = fallenHero(b, 0, b.X);
      const g = must(
        (raw(b)['heroGraveyard'] as Raw[]).find((x) => x['id'] === d.id),
        'the grave',
      );
      g['_divineLost'] = true;
      consecrated(b, 0, home(b));
      return { hero: d, there: home(b), orders: [] };
    },
    check(o, s) {
      return {
        got: { alive: char(o, hero(s)).alive, holy: holyLeft(o), said: said(o) },
        want: { alive: false, holy: [there(s).id], said: [] },
      };
    },
  },
  {
    name: 'of two consecrated provinces, he rises on the nearer to where his body lies, and the other keeps its consecration',
    stage(b) {
      turnIs(b, 3);
      const near = ring2(b, 7);
      holdsOnly(b, 0, [home(b), 10], [near, 5]);
      const d = fallenHero(b, 0, ring1(b, 3));
      consecrated(b, 0, home(b), near);
      return { hero: d, there: near, places: [home(b)], orders: [] };
    },
    check(o, s) {
      return {
        got: { at: char(o, hero(s)).location, holy: holyLeft(o) },
        want: { at: there(s).id, holy: [place(s, 0).id] },
      };
    },
  },
  {
    name: 'of two consecrated provinces as near as each other, he rises on the richer',
    stage(b) {
      turnIs(b, 3);
      const poor = ring1(b, 2);
      const rich = ring1(b, 3);
      holdsOnly(b, 0, [home(b), 10], [poor, 3], [rich, 8]);
      const d = fallenHero(b, 0, b.X);
      consecrated(b, 0, poor, rich);
      return { hero: d, there: rich, orders: [] };
    },
    check(o, s) {
      return { got: { at: char(o, hero(s)).location }, want: { at: there(s).id } };
    },
  },
  {
    name: 'consecrated ground another realm has taken is no ground to rise on: the grace is lost',
    stage(b) {
      turnIs(b, 3);
      const taken = ring1(b, 3);
      b.own(taken, 1);
      const d = fallenHero(b, 0, b.X);
      consecrated(b, 0, taken);
      return { hero: d, orders: [] };
    },
    check(o, s) {
      return {
        got: { alive: char(o, hero(s)).alive, said: said(o) },
        want: { alive: false, said: [[[0], notReturn(hero(s))]] },
      };
    },
  },
  {
    name: 'a fallen hero of another creed stays in his grave, consecrated ground or not',
    stage(b) {
      turnIs(b, 3);
      creed(b, 0, 'Pagan');
      const d = fallenHero(b, 0, b.X);
      consecrated(b, 0, home(b));
      return { hero: d, orders: [] };
    },
    check(o, s) {
      return {
        got: { alive: char(o, hero(s)).alive, grave: !!graveFor(o, hero(s)), said: said(o) },
        want: { alive: false, grave: true, said: [] },
      };
    },
  },
  {
    name: 'a wandering hero’s grave is no realm’s: he stays in it',
    stage(b) {
      turnIs(b, 3);
      const d = fallenHero(b, null, b.X);
      consecrated(b, 0, home(b));
      return { hero: d, orders: [] };
    },
    check(o, s) {
      return { got: { alive: char(o, hero(s)).alive, said: said(o) }, want: { alive: false, said: [] } };
    },
  },
  {
    name: 'a Divine king the divine promised a return rises as king: the crown worn once more, the realm no longer holding his body for a Resurrect, no heir crowned',
    stage(b) {
      turnIs(b, 3);
      const k = kingFalls(b, 0, { awaitsReturn: true, killedOnTurn: 2 });
      consecrated(b, 0, home(b));
      realm(b, 0)['_resurrectableMonarchId'] = k.id;
      return { hero: k, there: home(b), orders: [] };
    },
    check(o, s) {
      const k = char(o, hero(s));
      const line = risesIn(hero(s), there(s), 10, true);
      return {
        got: {
          risen: risenAs(o, hero(s)),
          king: k.isKing,
          mark: marks(k, ['_divineReturn']),
          held: '_resurrectableMonarchId' in realmOf(o, 0),
          heirs: o.world.characters.filter((c) => c['_isHeir'] === true).length,
          told: told(o, line),
        },
        want: {
          risen: { alive: true, hp: 10, armies: 0, items: 0, at: there(s).id },
          king: true,
          mark: [],
          held: false,
          heirs: 0,
          told: lineTo(0, { type: 'explore', provinceId: there(s).id }),
        },
      };
    },
  },
  {
    name: 'a fallen Divine king the divine made no promise to stays in his grave, and an heir is crowned',
    wholeTurnOnly: true,
    stage(b) {
      turnIs(b, 3);
      const k = kingFalls(b, 0, { killedOnTurn: 2 });
      consecrated(b, 0, home(b));
      return { hero: k, orders: [] };
    },
    check(o, s) {
      return {
        got: {
          alive: char(o, hero(s)).alive,
          heirs: o.world.characters.filter((c) => c['_isHeir'] === true && c.player === 0).length,
          rises: saying(o, 'Divine Resurrection'),
        },
        want: { alive: false, heirs: 1, rises: 0 },
      };
    },
  },
  {
    name: 'only the king the divine promised rises: another realm’s fallen king, with holy ground of its own, stays in his grave',
    wholeTurnOnly: true,
    stage(b) {
      turnIs(b, 3);
      const k0 = kingFalls(b, 0, { awaitsReturn: true, killedOnTurn: 2 });
      const k1 = kingFalls(b, 1, { killedOnTurn: 2 });
      consecrated(b, 0, seatOf(b, 0));
      consecrated(b, 1, seatOf(b, 1));
      return { hero: k0, others: [k1], orders: [] };
    },
    check(o, s) {
      return {
        got: { alive: [char(o, hero(s)).alive, char(o, other(s, 0)).alive], rises: saying(o, 'Divine Resurrection') },
        want: { alive: [true, false], rises: 1 },
      };
    },
  },
  {
    name: 'two heroes fallen on the turn before each rise on the consecrated province nearer him, spending both',
    stage(b) {
      turnIs(b, 3);
      const far = ring2(b, 7);
      holdsOnly(b, 0, [home(b), 10], [far, 5]);
      const d1 = fallenHero(b, 0, ring2(b, 1));
      const d2 = fallenHero(b, 0, ring1(b, 3));
      consecrated(b, 0, home(b), far);
      return { hero: d1, others: [d2], places: [home(b), far], orders: [] };
    },
    check(o, s) {
      return {
        got: { at: [char(o, hero(s)).location, char(o, other(s, 0)).location], holy: holyLeft(o) },
        want: { at: [place(s, 0).id, place(s, 1).id], holy: [] },
      };
    },
  },
  {
    name: 'one consecrated province for two heroes: the first in the graveyard rises on it, and the second’s grace is lost',
    stage(b) {
      turnIs(b, 3);
      const d1 = fallenHero(b, 0, ring1(b, 3));
      const d2 = fallenHero(b, 0, ring1(b, 4));
      consecrated(b, 0, home(b));
      return { hero: d1, others: [d2], there: home(b), orders: [] };
    },
    check(o, s) {
      return {
        got: {
          alive: [char(o, hero(s)).alive, char(o, other(s, 0)).alive],
          said: said(o),
        },
        want: {
          alive: [true, false],
          said: [
            [[0], risesIn(hero(s), there(s), 10)],
            [[0], notReturn(other(s, 0))],
          ],
        },
      };
    },
  },
  {
    name: 'each realm’s fallen rise on its own ground, each told only of its own',
    stage(b) {
      turnIs(b, 3);
      const d0 = fallenHero(b, 0, ring1(b, 3));
      const d1 = fallenHero(b, 1, ring1(b, 4));
      consecrated(b, 0, seatOf(b, 0));
      consecrated(b, 1, seatOf(b, 1));
      return { hero: d0, others: [d1], places: [seatOf(b, 0), seatOf(b, 1)], orders: [] };
    },
    check(o, s) {
      return {
        got: { said: said(o) },
        want: {
          said: [
            [[0], risesIn(hero(s), place(s, 0), 10)],
            [[1], risesIn(other(s, 0), place(s, 1), 10)],
          ],
        },
      };
    },
  },
];

// ── Graves rot ───────────────────────────────────────────────────────────────────────────────────────────────────
export const GRAVES_CASES: NewTurnCase[] = [
  {
    name: 'at a die over 10% every grave on the battlefields stays',
    dice: dieAt(0.10001),
    stage(b) {
      graves(ring1(b, 3), 3);
      graves(home(b), 2);
      return { places: [ring1(b, 3), home(b)], orders: [] };
    },
    check(o, s) {
      return { got: { graves: [gravesIn(o, place(s, 0)), gravesIn(o, place(s, 1))] }, want: { graves: [3, 2] } };
    },
  },
  {
    name: 'at a die of 10% every grave on ordinary ground rots, held or not',
    dice: dieAt(0.1),
    stage(b) {
      graves(ring1(b, 3), 3);
      graves(home(b), 2);
      return { places: [ring1(b, 3), home(b)], orders: [] };
    },
    check(o, s) {
      return { got: { graves: [gravesIn(o, place(s, 0)), gravesIn(o, place(s, 1))] }, want: { graves: [0, 0] } };
    },
  },
  {
    name: 'on an Undead realm’s ground graves rot only at a die of 5% or less: at 7% they stay there, while those on other ground rot',
    dice: dieAt(0.07),
    stage(b) {
      creed(b, 0, 'Undead');
      graves(ring1(b, 3), 3);
      graves(home(b), 2);
      graves(seatOf(b, 1), 2);
      return { places: [ring1(b, 3), home(b), seatOf(b, 1)], orders: [] };
    },
    check(o, s) {
      return {
        got: { graves: [gravesIn(o, place(s, 0)), gravesIn(o, place(s, 1)), gravesIn(o, place(s, 2))] },
        want: { graves: [0, 2, 0] },
      };
    },
  },
  {
    name: 'on an Undead realm’s ground at a die of 5% they rot too',
    dice: dieAt(0.05),
    stage(b) {
      creed(b, 0, 'Undead');
      graves(home(b), 2);
      return { there: home(b), orders: [] };
    },
    check(o, s) {
      return { got: { graves: gravesIn(o, there(s)) }, want: { graves: 0 } };
    },
  },
  {
    name: 'under the Embalmers the graves on the realm’s own ground never rot, at the lowest die but none; on other ground they do',
    dice: dieAt(0.00001),
    stage(b) {
      creed(b, 0, 'Undead');
      knows(b, 0, 'az08');
      graves(home(b), 2);
      graves(ring1(b, 3), 3);
      return { places: [home(b), ring1(b, 3)], orders: [] };
    },
    check(o, s) {
      return { got: { graves: [gravesIn(o, place(s, 0)), gravesIn(o, place(s, 1))] }, want: { graves: [2, 0] } };
    },
  },
];

// ── The mercenary bands ──────────────────────────────────────────────────────────────────────────────────────────
export const MERCENARY_CASES: NewTurnCase[] = [
  {
    name: 'at a die under 25% a mercenary band retires: told to nobody, gone from the world',
    dice: dieAt(0.2499),
    stage(b) {
      band(b, ring1(b, 3));
      return { there: ring1(b, 3), orders: [] };
    },
    check(o, s) {
      const line = retires('The Red Lances', there(s));
      return {
        got: { bands: bands(o), told: told(o, line), said: said(o) },
        want: { bands: [], told: lineTo(null), said: [[[], line]] },
      };
    },
  },
  {
    name: 'a band with no name is told by its kind',
    dice: dieAt(0.2499),
    stage(b) {
      band(b, ring1(b, 3), null);
      return { there: ring1(b, 3), orders: [] };
    },
    check(o, s) {
      return { got: { said: said(o) }, want: { said: [[[], retires('Free Lances', there(s))]] } };
    },
  },
  {
    name: 'at the highest die a band stays in service and moves on to the last province around it, nothing said',
    stage(b) {
      band(b, ring1(b, 3));
      return { places: landAround(b, ring1(b, 3)), orders: [] };
    },
    check(o, s) {
      return {
        got: { bands: bands(o), said: said(o) },
        want: { bands: [['The Red Lances', must(s.places?.at(-1), 'the last').id]], said: [] },
      };
    },
  },
  {
    name: 'at a die of 25% exactly it stays in service, moving on to the second of the six around it (an even row)',
    dice: dieAt(0.25),
    stage(b) {
      band(b, ring1(b, 3));
      return { places: landAround(b, ring1(b, 3)), orders: [] };
    },
    check(o, s) {
      return { got: { bands: bands(o) }, want: { bands: [['The Red Lances', place(s, 1).id]] } };
    },
  },
  {
    name: 'at a die of 50% it moves on to the fourth of the six around it: east (an even row)',
    dice: dieAt(0.5),
    stage(b) {
      band(b, ring1(b, 3));
      return { there: ring1(b, 3), places: landAround(b, ring1(b, 3)), orders: [] };
    },
    check(o, s) {
      return {
        got: { step: [place(s, 3).row - there(s).row, place(s, 3).col - there(s).col], bands: bands(o) },
        want: { step: [0, 1], bands: [['The Red Lances', place(s, 3).id]] },
      };
    },
  },
  {
    name: 'on an odd row, at the highest die: the last of the six around it',
    stage(b) {
      band(b, ring1(b, 1), 'High');
      return { places: landAround(b, ring1(b, 1)), orders: [] };
    },
    check(o, s) {
      return { got: { bands: bands(o) }, want: { bands: [['High', must(s.places?.at(-1), 'the last').id]] } };
    },
  },
  {
    name: 'on an odd row at 25%: the second of the six around it',
    dice: dieAt(0.25),
    stage(b) {
      band(b, ring1(b, 1), 'Low');
      return { places: landAround(b, ring1(b, 1)), orders: [] };
    },
    check(o, s) {
      return { got: { bands: bands(o) }, want: { bands: [['Low', place(s, 1).id]] } };
    },
  },
  {
    name: 'a band on land moves only to land, a band at sea only to sea',
    stage(b) {
      const p = ring1(b, 3);
      const ring = landAround(b, p);
      must(ring[0], 'a neighbour').terrain = 'sea';
      must(ring[1], 'a neighbour').terrain = 'sea';
      band(b, p, 'Riders');
      band(b, p, 'Sea Wolves', { isSea: true });
      return { places: ring, orders: [] };
    },
    check(o, s) {
      return {
        got: { bands: bands(o) },
        want: {
          bands: [
            ['Riders', place(s, 5).id],
            ['Sea Wolves', place(s, 1).id],
          ],
        },
      };
    },
  },
  {
    name: 'a band with only sea around it stays where it is',
    stage(b) {
      const p = ring1(b, 3);
      landAround(b, p).forEach((q) => {
        q.terrain = 'sea';
      });
      band(b, p, 'Stranded');
      return { there: p, orders: [] };
    },
    check(o, s) {
      return { got: { bands: bands(o) }, want: { bands: [['Stranded', there(s).id]] } };
    },
  },
  {
    name: 'at the top of the map none lie beyond it, and the map wraps west to east: the corner’s band moves to the last of four around it',
    stage(b) {
      const corner = must(b.G.world.provinces[0], 'the north-west corner');
      corner.terrain = 'plain';
      around(b, corner).forEach((q) => {
        q.terrain = 'plain';
      });
      band(b, corner, 'Corner');
      return { places: around(b, corner), orders: [] };
    },
    check(o, s) {
      return {
        got: { around: s.places?.length, bands: bands(o) },
        want: { around: 4, bands: [['Corner', must(s.places?.at(-1), 'the last').id]] },
      };
    },
  },
  {
    name: '… and at a die of 50%, to the third of those four: across the map’s western edge',
    dice: dieAt(0.5),
    stage(b) {
      const corner = must(b.G.world.provinces[0], 'the north-west corner');
      corner.terrain = 'plain';
      around(b, corner).forEach((q) => {
        q.terrain = 'plain';
      });
      band(b, corner, 'Corner');
      return { places: around(b, corner), orders: [] };
    },
    check(o, s) {
      return {
        got: { col: place(s, 2).col, bands: bands(o) },
        want: { col: o.world.world.cols - 1, bands: [['Corner', place(s, 2).id]] },
      };
    },
  },
];

// ── The clean-up and the save's repairs ─────────────────────────────────────────────────────────────────────────
const graveIds = (o: Outcome) => graveyard(o).map((g) => g['id']);
export const CLEAN_UP_CASES: NewTurnCase[] = [
  {
    name: 'the mark of a hero driven from his home this turn is cleared at its end, from a wanderer and a realm’s hero alike',
    stage(b) {
      const w = wanderer(b, NO_TITLE_SKILLS, { at: ring1(b, 3) });
      w['_justDefeated'] = true;
      const h = standing(b, 0, b.X);
      h['_justDefeated'] = true;
      return { hero: w, others: [h], orders: [] };
    },
    check(o, s) {
      return {
        got: { marks: [marks(char(o, hero(s)), ['_justDefeated']), marks(char(o, other(s, 0)), ['_justDefeated'])] },
        want: { marks: [[], []] },
      };
    },
  },
  {
    name: 'a wandering hero recovers to full health at the turn’s end; a neutral guard and a realm’s hero don’t',
    stage(b) {
      const w = wounded(wanderer(b, NO_TITLE_SKILLS, { at: ring1(b, 3), hp: 80 }), 1);
      w['hpEarned'] = 65;
      const g = wounded(guard(b, ring1(b, 4), [unit('Wardens', 'Men-at-Arms')]), 5);
      const h = wounded(standing(b, 0, b.X), 5);
      const d = fallenHero(b, null, ring1(b, 5));
      return { hero: w, others: [g, h, d], orders: [holds(h)] };
    },
    check(o, s) {
      return {
        got: {
          hp: [char(o, hero(s)).hp, char(o, other(s, 0)).hp < 20, char(o, other(s, 1)).hp, char(o, other(s, 2)).hp],
        },
        want: { hp: [80, true, 5, 0] },
      };
    },
  },
  {
    name: 'a hero of a realm’s service whose name bore “(wandering)” as the turn began: told to the GM alone that one was corrected; the save keeps no count',
    wholeTurnOnly: true,
    stage(b) {
      const h = standing(b, 0, b.X);
      h.name = `${h.name} (wandering)`;
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return {
        got: {
          name: char(o, hero(s)).name,
          told: told(o, renamed(1)),
          said: said(o),
          count: rawOf(o)['_nameRepairs'],
        },
        want: {
          name: hero(s).name.replace(' (wandering)', ''),
          told: lineTo(null),
          said: [[[], renamed(1)]],
          count: 0,
        },
      };
    },
  },
  {
    name: 'two such heroes: “2 heroes”',
    wholeTurnOnly: true,
    stage(b) {
      const h1 = standing(b, 0, b.X);
      h1.name = `${h1.name} (wandering)`;
      const h2 = standing(b, 1, ring2(b, 4));
      h2.name = `${h2.name} (Wandering)`;
      return nothing();
    },
    check(o) {
      return { got: { said: said(o) }, want: { said: [[[], renamed(2)]] } };
    },
  },
  {
    name: 'with nothing to repair, nothing is said, and the save’s count is 0',
    stage: nothing,
    check(o) {
      return { got: { said: said(o), count: rawOf(o)['_nameRepairs'] }, want: { said: [], count: 0 } };
    },
  },
  {
    name: 'a realm still holding a retired Sage discovery: told to the GM alone that one was removed; the save keeps no count',
    wholeTurnOnly: true,
    stage(b) {
      knows(b, 0, 'sd34', 'sd08');
      return nothing();
    },
    check(o) {
      return {
        got: {
          told: told(o, discoveriesRetired(1)),
          said: said(o),
          count: '_retiredDiscoveries' in rawOf(o),
          kept: ((realmOf(o, 0)['discoveries'] as Raw[] | undefined) ?? []).map((d) => d['id']),
        },
        want: { told: lineTo(null), said: [[[], discoveriesRetired(1)]], count: false, kept: ['sd08'] },
      };
    },
  },
  {
    name: 'two realms holding it: “2 retired Sage discoveries were removed”',
    wholeTurnOnly: true,
    stage(b) {
      knows(b, 0, 'sd34');
      knows(b, 2, 'sd34');
      return nothing();
    },
    check(o) {
      return { got: { said: said(o) }, want: { said: [[[], discoveriesRetired(2)]] } };
    },
  },
  {
    name: 'a grave in the graveyard of a hero who lives is purged, told to the GM alone; a realm holding that body for a Resurrect holds none, another realm’s hold stays',
    stage(b) {
      const h = standing(b, 0, b.X);
      ghostGrave(b, h);
      fallenHero(b, 1, ring1(b, 3), { killedOnTurn: b.G.turn });
      realm(b, 0)['_resurrectableMonarchId'] = h.id;
      realm(b, 1)['_resurrectableMonarchId'] = 4242;
      return { hero: h, orders: [] };
    },
    check(o, s) {
      return {
        got: {
          alive: char(o, hero(s)).alive,
          graves: graveIds(o).filter((id) => id === hero(s).id).length,
          left: graveIds(o).length,
          told: told(o, staleGrave(hero(s).name)),
          held: [realmOf(o, 0)['_resurrectableMonarchId'], realmOf(o, 1)['_resurrectableMonarchId']],
        },
        want: { alive: true, graves: 0, left: 1, told: lineTo(null), held: [null, 4242] },
      };
    },
  },
  {
    name: 'two stale graves: each told, in the graveyard’s order',
    stage(b) {
      const h1 = standing(b, 0, b.X);
      const h2 = wanderer(b, NO_TITLE_SKILLS, { at: ring1(b, 3) });
      ghostGrave(b, h2);
      ghostGrave(b, h1);
      return { hero: h1, others: [h2], orders: [] };
    },
    check(o, s) {
      return {
        got: { said: said(o) },
        want: {
          said: [
            [[], staleGrave(other(s, 0).name)],
            [[], staleGrave(hero(s).name)],
          ],
        },
      };
    },
  },
  {
    name: 'each realm takes note of the graves it can see: in a province it holds, or where one of its heroes stands; not elsewhere, nor where only its fallen lie, nor a fallen king’s',
    stage(b) {
      holdsOnly(b, 0, [home(b), 10], [ring2(b, 1), 5]);
      const inHeld = fallenHero(b, 1, ring2(b, 1), { killedOnTurn: b.G.turn });
      standing(b, 0, ring1(b, 3));
      const beside = fallenHero(b, 1, ring1(b, 3), { killedOnTurn: b.G.turn });
      const away = fallenHero(b, 1, ring1(b, 4), { killedOnTurn: b.G.turn });
      fallenHero(b, 0, ring1(b, 5), { killedOnTurn: b.G.turn });
      const byOurDead = fallenHero(b, 1, ring1(b, 5), { killedOnTurn: b.G.turn });
      const k = kingFalls(b, 2);
      standing(b, 0, seatOf(b, 2));
      return { hero: inHeld, others: [beside, away, k, byOurDead], orders: [] };
    },
    check(o, s) {
      return {
        got: { known: known(o, 0)?.slice().sort() },
        want: { known: [hero(s).id, other(s, 0).id].sort() },
      };
    },
  },
  {
    name: 'a grave a realm already knows of is not listed twice, and a realm with no record gets one',
    stage(b) {
      const d = fallenHero(b, 1, home(b), { killedOnTurn: b.G.turn });
      realm(b, 0)['knownDeadHeroIds'] = [d.id];
      delete realm(b, 2)['knownDeadHeroIds'];
      return { hero: d, orders: [] };
    },
    check(o, s) {
      return { got: { known: [known(o, 0), known(o, 2)] }, want: { known: [[hero(s).id], []] } };
    },
  },
  {
    name: 'each realm’s list of the dead it saw fall this turn is cleared at its end',
    stage(b) {
      realm(b, 0)['seenDeadHeroIds'] = [4242];
      realm(b, 1)['seenDeadHeroIds'] = [4243];
      return nothing();
    },
    check(o) {
      return {
        got: { seen: o.world.players.map((p) => p['seenDeadHeroIds']) },
        want: { seen: [[], [], []] },
      };
    },
  },
  {
    name: 'the turn’s orders are cleared from the save, and its scratch lists of resurrections, charms, hires and plans with them',
    stage(b) {
      const h = standing(b, 0, b.X);
      b.G.turnOrders = { [h.id]: [{ action: 'defend' }, null, null, null, null] };
      for (const k of [
        '_resurrectedThisTurn',
        '_pendingResurrectOrders',
        '_pendingCharmOrders',
        '_pendingHireOrders',
        '_pendingSynthPlans',
      ])
        raw(b)[k] = [];
      return { hero: h, orders: [holds(h)] };
    },
    check(o) {
      const w = rawOf(o);
      return {
        got: {
          orders: w['turnOrders'],
          scratch: [
            '_resurrectedThisTurn',
            '_pendingResurrectOrders',
            '_pendingCharmOrders',
            '_pendingHireOrders',
            '_pendingSynthPlans',
          ].filter((k) => k in w),
        },
        want: { orders: {}, scratch: [] },
      };
    },
  },
];

// ── Wandering heroes drift ───────────────────────────────────────────────────────────────────────────────────────
export const WANDERER_CASES: NewTurnCase[] = [
  {
    name: 'at a die over 35% a wandering hero stays where he is',
    dice: dieAt(0.35001),
    stage(b) {
      const w = wanderer(b, NO_TITLE_SKILLS);
      return { hero: w, there: b.X, orders: [] };
    },
    check(o, s) {
      return { got: { at: char(o, hero(s)).location }, want: { at: there(s).id } };
    },
  },
  {
    name: 'at a die of 35% he drifts to the third of the six provinces around him (an even row), listed there and no longer where he was',
    dice: dieAt(0.35),
    stage(b) {
      const w = wanderer(b, NO_TITLE_SKILLS);
      return { hero: w, there: b.X, places: landAround(b, b.X), orders: [] };
    },
    check(o, s) {
      const to = place(s, 2);
      return {
        got: {
          at: char(o, hero(s)).location,
          name: char(o, hero(s))['locationName'],
          lists: listed(o, there(s), to).map((ids) => ids.includes(hero(s).id)),
        },
        want: { at: to.id, name: to.name, lists: [false, true] },
      };
    },
  },
  {
    name: 'at the lowest die he drifts to the first of them',
    dice: dieAt(0),
    stage(b) {
      const w = wanderer(b, NO_TITLE_SKILLS, { at: ring1(b, 1) });
      return { hero: w, places: landAround(b, ring1(b, 1)), orders: [] };
    },
    check(o, s) {
      return { got: { at: char(o, hero(s)).location }, want: { at: place(s, 0).id } };
    },
  },
  {
    name: 'he never drifts to sea: with one land province around him he goes there, with none he stays',
    dice: dieAt(0.35),
    stage(b) {
      const ring = landAround(b, b.X);
      ring.slice(0, 5).forEach((q) => {
        q.terrain = 'sea';
      });
      const w = wanderer(b, NO_TITLE_SKILLS);
      const p = ring2(b, 9);
      landAround(b, p).forEach((q) => {
        q.terrain = 'sea';
      });
      const v = wanderer(b, NO_TITLE_SKILLS, { at: p });
      return { hero: w, others: [v], places: [must(ring[5], 'the last'), p], orders: [] };
    },
    check(o, s) {
      return {
        got: { at: [char(o, hero(s)).location, char(o, other(s, 0)).location] },
        want: { at: [place(s, 0).id, place(s, 1).id] },
      };
    },
  },
  {
    name: 'a neutral guard, a realm’s hero and a fallen wanderer never drift',
    dice: dieAt(0.35),
    stage(b) {
      const g = guard(b, ring1(b, 3), [unit('Wardens', 'Men-at-Arms')]);
      const h = standing(b, 0, b.X);
      const d = fallenHero(b, null, ring1(b, 5));
      return { hero: g, others: [h, d], places: [ring1(b, 3), b.X, ring1(b, 5)], orders: [holds(h)] };
    },
    check(o, s) {
      return {
        got: { at: [char(o, hero(s)).location, char(o, other(s, 0)).location, char(o, other(s, 1)).location] },
        want: { at: [place(s, 0).id, place(s, 1).id, place(s, 2).id] },
      };
    },
  },
  {
    name: 'a wounded wanderer who drifts is hale where he arrives',
    dice: dieAt(0.35),
    stage(b) {
      const w = wounded(wanderer(b, NO_TITLE_SKILLS, { hp: 80 }), 1);
      w['hpEarned'] = 65;
      return { hero: w, places: landAround(b, b.X), orders: [] };
    },
    check(o, s) {
      return {
        got: { at: char(o, hero(s)).location, hp: char(o, hero(s)).hp },
        want: { at: place(s, 2).id, hp: 80 },
      };
    },
  },
];

// ── The final reconcile and the stranded guards ─────────────────────────────────────────────────────────────────
export const RECONCILE_CASES: NewTurnCase[] = [
  {
    name: 'a neutral guard whose last company was summoned for the turn is a wanderer once it leaves: no longer a guard, “(wandering)” in his name; too late to recover or drift this turn',
    wholeTurnOnly: true,
    dice: dieAt(0.35),
    stage(b) {
      const g = wounded(guard(b, ring1(b, 3), [summoned('Blaze')]), 5);
      return { hero: g, orders: [] };
    },
    check(o, s) {
      const g = char(o, hero(s));
      return {
        got: { guard: g._isNeutralGuard, name: g.name, at: g.location, hp: g.hp < 20 },
        want: { guard: false, name: `${hero(s).name} (wandering)`, at: hero(s).location, hp: true },
      };
    },
  },
  {
    name: 'a neutral guard who keeps a company keeps his post',
    stage(b) {
      const g = guard(b, ring1(b, 3), [summoned('Blaze'), unit('Wardens', 'Men-at-Arms')]);
      return { hero: g, orders: [] };
    },
    check(o, s) {
      const g = char(o, hero(s));
      return {
        got: { guard: g._isNeutralGuard, name: g.name },
        want: { guard: true, name: `Warden ${String(hero(s).id)}` },
      };
    },
  },
  {
    name: 'every province lists exactly the heroes standing in it, the fallen where they fell',
    dice: dieAt(0.35),
    stage(b) {
      const w = wanderer(b, NO_TITLE_SKILLS);
      const d = fallenHero(b, 1, ring1(b, 4), { killedOnTurn: b.G.turn });
      return { hero: w, others: [d], places: [b.X, ...landAround(b, b.X), ring1(b, 4)], orders: [] };
    },
    check(o, s) {
      const ps = must(s.places, 'the places');
      return {
        got: { lists: ps.map((p) => province(o, p).characters) },
        want: {
          lists: ps.map((p) => o.world.characters.filter((c) => c.location === p.id).map((c) => c.id)),
        },
      };
    },
  },
];

// ── The order of it all ──────────────────────────────────────────────────────────────────────────────────────────
export const ORDER_CASES: NewTurnCase[] = [
  {
    name: 'everything the stage says in one turn, in its order: the War Academy, the gardens, the informants, the Observatory, the Divine return, a band retiring, then the save’s repairs',
    wholeTurnOnly: true,
    dice: DRILLS,
    stage(b) {
      turnIs(b, 3);
      knows(b, 0, 'sd08', 'sd65', 'sd22', 'sd39', 'sd34');
      leads(kingOf(b, 0), [unit('Lances', 'Free Lances')]);
      const h = wounded(standing(b, 0, b.X), 10);
      h.name = `${h.name} (wandering)`;
      standing(b, 1, ring1(b, 3));
      mappedAllBut(b, 0, [ring1(b, 4), 0]);
      leads(fallenHero(b, 0, ring1(b, 2)), []);
      consecrated(b, 0, home(b));
      band(b, ring2(b, 4));
      const w = wanderer(b, NO_TITLE_SKILLS, { at: ring2(b, 5) });
      ghostGrave(b, w);
      return { orders: [holds(h)] };
    },
    check(o) {
      return {
        got: { said: kinds(o) },
        want: {
          said: [
            [[0], 'a company drilled'],
            [[0], 'wounds knit'],
            [[0], 'an informant’s report'],
            [[0], 'a province charted'],
            [[0], 'a hero rises'],
            [[], 'a band retires'],
            [[], 'names repaired'],
            [[], 'discoveries retired'],
            [[], 'a stale grave purged'],
          ],
        },
      };
    },
  },
  {
    name: 'the titles are judged after the War Academy drills: the Grand Marshal reports the strength the drills gave',
    wholeTurnOnly: true,
    dice: DRILLS,
    stage(b) {
      turnIs(b, 5);
      knows(b, 0, 'sd08');
      const k = leads(kingOf(b, 0), [unit('Lances', 'Free Lances', 'Green'), unit('Guard', 'Men-at-Arms', 'Green')]);
      k.skills['tactical'] = 1;
      return { hero: k, there: home(b), orders: [] };
    },
    check(o, s) {
      const line = o.all.find((l) => l.text.startsWith('[The Grand Marshal] Your realm:'))?.text ?? '';
      const strength = must(s.board, 'the board').engine['unitBaseStrength'] as (u: unknown) => number;
      const now = char(o, hero(s)).armies.reduce((n, u) => n + strength(u), 0);
      return {
        got: { grades: grades(o, hero(s)), line },
        want: {
          grades: ['Lances (Average)', 'Guard (Average)'],
          line: `[The Grand Marshal] Your realm: strongest land army led by ${hero(s).name} in ${there(s).name} (strength ${String(now)}).`,
        },
      };
    },
  },
  {
    name: 'the informants report only the living: a hero who rises later in the turn is not yet among them',
    stage(b) {
      turnIs(b, 3);
      knows(b, 0, 'sd22');
      const d = fallenHero(b, 1, ring1(b, 3));
      consecrated(b, 1, seatOf(b, 1));
      return { hero: d, orders: [] };
    },
    check(o, s) {
      return {
        got: { alive: char(o, hero(s)).alive, said: kinds(o) },
        want: {
          alive: true,
          said: [
            [[0], 'nothing new'],
            [[1], 'a hero rises'],
          ],
        },
      };
    },
  },
  {
    name: 'the gardens mend before the dead rise: a hero raised this turn is not mended',
    stage(b) {
      turnIs(b, 3);
      knows(b, 0, 'sd65');
      const d = fallenHero(b, 0, ring1(b, 3));
      consecrated(b, 0, home(b));
      return { hero: d, orders: [] };
    },
    check(o, s) {
      return {
        got: { hp: char(o, hero(s)).hp, knit: saying(o, 'physick gardens') },
        want: { hp: 10, knit: 0 },
      };
    },
  },
  {
    name: 'a stale grave is purged before the realms take note of the graves they see: none remembers it',
    stage(b) {
      const w = wanderer(b, NO_TITLE_SKILLS, { at: home(b) });
      ghostGrave(b, w);
      return { hero: w, orders: [] };
    },
    check(o) {
      return { got: { known: known(o, 0) }, want: { known: [] } };
    },
  },
  {
    name: 'a hero raised on holy ground has left his grave before the realms take note: his body is remembered by none',
    stage(b) {
      turnIs(b, 3);
      const d = fallenHero(b, 0, home(b));
      consecrated(b, 0, home(b));
      return { hero: d, orders: [] };
    },
    check(o, s) {
      return { got: { alive: char(o, hero(s)).alive, known: known(o, 0) }, want: { alive: true, known: [] } };
    },
  },
  {
    name: 'a grace lost leaves the body in its grave, which the realm then takes note of where it sees it',
    stage(b) {
      turnIs(b, 3);
      const d = fallenHero(b, 0, home(b));
      return { hero: d, orders: [] };
    },
    check(o, s) {
      return {
        got: { lost: count(o, notReturn(hero(s))), known: known(o, 0) },
        want: { lost: 1, known: [hero(s).id] },
      };
    },
  },
];

// ── Every case ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Every case, by part of the stage. */
export const NEW_TURN_SECOND_PART_CASES: [string, NewTurnCase[]][] = [
  ['the War Academy', WAR_ACADEMY_CASES],
  ['the wounded mend', MENDING_CASES],
  ['the Informant Network', INFORMANT_CASES],
  ['the Arcane Observatory', OBSERVATORY_CASES],
  ['the Divine return', DIVINE_RETURN_CASES],
  ['graves rot', GRAVES_CASES],
  ['the mercenary bands', MERCENARY_CASES],
  ['the clean-up and the save’s repairs', CLEAN_UP_CASES],
  ['wandering heroes drift', WANDERER_CASES],
  ['the final reconcile', RECONCILE_CASES],
  ['the order of it all', ORDER_CASES],
];
export { stageCase, playCase } from './new-turn-succession-and-summons-cases.ts';
export { hero, other, there, place, home, raw, rawOf };
export type { NewTurnCase, Outcome, Staged };
