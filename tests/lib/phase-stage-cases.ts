// The four stages of a phase (plan P1-08k1, the phase loop's stages lifted out of resolveTurn), staged on the middle of
// a bot world (lib/middle-of-a-bot-world.ts), from plain realms, each with what must be true after it in game terms.
// The start of the phase: each season opens with its line; Herbal Lore dresses the wounds of last season's fight;
// the marks of a season gone (a fight joined, a stalled battle fought, a hunt met) are cleared; a hero a save carries
// as hired this season is told he waits. Intents and reactions: a column still in a battle left unresolved can't march
// away, nor one that has fought again this season; a general whose province is invaded before he leaves is held; a
// Defend given this season keeps watch from its start; a column ordered home to meet an invader arrives first, and
// marches no further. The orders in two tiers: what doesn't move resolves before the Defend step, the Defend step
// before any march, and a host raised in a watch is settled there; a hero on a chase does nothing else; a coward who
// begged for mercy does nothing more; a fallen hero's orders go unanswered, told once. The end of the phase: a Move
// next season ends a watch; a fallen commander's host is dispersed once its battle is over, and kept while it isn't.
// scenario/phase-stages-in-a-whole-turn.test.ts plays each through a whole turn (resolveTurn);
// unit/phase-stages-called-directly.test.ts plays them through the four stages called one phase at a time. A case
// stages its world and the heroes' orders; after them, it reads what it needs from the world and the log (`got`)
// beside what must be so (`want`), and the test compares the two. Every outcome is certain: every case fixes the dice
// for the whole turn (default LANDS), every percentile roll at one number and every other die at one value, so the
// outcome holds however many dice the turn draws before it. Realms 0 and 1 are at war, 0 and 2 allied, 1 and 2 at
// peace (the board's relations).
import {
  must,
  order,
  playTurn,
  type Board,
  type Character,
  type Line,
  type Order,
  type Province,
} from './middle-of-a-bot-world.ts';
import { companies } from './item-and-army-order-cases.ts';
import { withCaseDice, type Dice, type ExperienceRoll } from './espionage-order-cases.ts';
import {
  anySays,
  at,
  char,
  countSaying,
  knows,
  leads,
  one,
  province,
  ring1,
  rival,
  wanderer,
  type Outcome,
  type Staged,
} from './cast-spell-order-cases.ts';
import { plainRealms } from './recruit-hire-and-realm-works-order-cases.ts';
import { EVEN, LANDS, hunt, mark, phasesSaying, there, told, watch } from './war-order-cases.ts';

export type { Outcome, Staged };
export { LANDS };
export interface PhaseStageCase {
  name: string;
  /** Plays only in a whole turn: the turn's set-up or its end makes or shows what the case is about. */
  wholeTurnOnly?: boolean;
  /** The dice for the whole turn (default LANDS). */
  dice?: Dice;
  stage(b: Board): Staged;
  /** What the case found after the orders, and what it should have found: the same keys. */
  check(o: Outcome, s: Staged): { got: Record<string, unknown>; want: Record<string, unknown> };
}

/** Plays `c`, staged as `s` on `b`, through a whole turn, with the case's dice. `recording` records the experience
 *  rolls (recordExperienceRolls). */
export const playCase = (
  b: Board,
  c: PhaseStageCase,
  s: Staged,
  recording: <T>(body: () => T) => { result: T; xp: ExperienceRoll[] },
): Outcome => {
  const { result, xp } = recording(() =>
    withCaseDice(b.engine, c.dice ?? LANDS, () =>
      playTurn(b, Object.fromEntries(s.orders.map(([h, os]) => [h.id, os])), s.written ?? {}),
    ),
  );
  return {
    world: result.after,
    lines: result.lines.filter((l) => l.charId === s.hero.id),
    all: result.lines,
    turn: b.G.turn,
    xp,
  };
};

const defend = () => order('defend');
const rest = () => order('rest');
/** Five orders, as given (a hero given fewer than five Rests for the rest of the turn: plan()). */
const five = (...os: Order[]): Order[] => [...os, ...Array.from({ length: 5 - os.length }, () => rest())];
/** The texts of a hero's own lines in phase `ph`. */
export const linesIn = (o: Outcome, c: Character, ph: number) =>
  o.all.filter((l: Line) => l.charId === c.id && l.phase === ph).map((l) => l.text);
/** The phases in which a hero has a line of his own saying `what`. */
const phasesHeSays = (o: Outcome, c: Character, what: string) =>
  o.all.filter((l) => l.charId === c.id && l.text.includes(what)).map((l) => l.phase);
const other = (s: Staged) => must(s.other, 'the other hero');
const place = (s: Staged, i: number) => must(s.places?.[i], 'place ' + String(i));

// ── The start of the phase ───────────────────────────────────────────────────────────────────────────────────────
export const SEASONS = ['Spring', 'Early Summer', 'Late Summer', 'Fall', 'Early Winter'];
/** The line Herbal Lore writes for `c`: the damage of his last fight, what is mended, his HP after, of his maximum. */
export const herbalLore = (c: Character, damage: number, healed: number, hp: number, max: number) =>
  `🌿 Herbal Lore: ${c.name}'s wounds from the previous season are dressed with healing herbs — 40% of the ${String(damage)} damage taken is mended. +${String(healed)} HP (${String(hp)}/${String(max)}).`;
/** A hero of realm 0 (or `player`) in the middle, holding watch all turn (so no Rest heals him), with `hp` of `max`, as
 *  the save left him: `atStart` is his HP as the last season of the last turn began. */
const wounded = (b: Board, hp: number, max: number, atStart: number | null, player: number | null = 0) => {
  const h = player == null ? wanderer(b, {}, { hp: max }) : at(b, {}, { hp: max, player });
  h.hp = hp;
  h['_hpAtPhaseStart'] = atStart;
  return h;
};
const herbalist = (b: Board) => {
  knows(b, 0, 'sd29');
};
export const PHASE_START_CASES: PhaseStageCase[] = [
  {
    name: "each season opens with its own line, filed in that season, in the seasons' order",
    stage(b) {
      const h = at(b);
      return { hero: h, orders: [one(h)] };
    },
    check(o) {
      const opens = o.all.filter((l) => /^— .+ —$/.test(l.text));
      return {
        got: { opens: opens.map((l) => [l.text, l.type, l.phase, l.charId]) },
        want: { opens: SEASONS.map((n, ph) => [`— ${n} —`, 'system', ph, null]) },
      };
    },
  },
  {
    name: "Herbal Lore: a hero wounded in last turn's last season has the wounds dressed as Spring opens, told under his name",
    stage(b) {
      herbalist(b);
      const h = wounded(b, 10, 20, 20);
      return { hero: h, orders: [[h, five(defend(), defend(), defend(), defend(), defend())]], there: b.X };
    },
    check(o, s) {
      const line = herbalLore(s.hero, 10, 6, 16, 20);
      const l = o.all.find((x) => x.text === line);
      return {
        got: {
          told: told(o, line),
          his: l ? l.charId : null,
          dressed: phasesHeSays(o, s.hero, '🌿 Herbal Lore'),
          atLastSeason: char(o, s.hero)['_hpAtPhaseStart'],
        },
        want: {
          told: { type: 'system', targets: [0], provinceId: there(s).id, public: false, phase: 0 },
          his: s.hero.id,
          dressed: [0],
          atLastSeason: 16,
        },
      };
    },
  },
  {
    name: 'Herbal Lore mends at least 1 HP of a scratch',
    stage(b) {
      herbalist(b);
      const h = wounded(b, 19, 20, 20);
      return { hero: h, orders: [[h, five(defend(), defend(), defend(), defend(), defend())]] };
    },
    check(o, s) {
      return {
        got: { told: anySays(o, herbalLore(s.hero, 1, 1, 20, 20)) },
        want: { told: true },
      };
    },
  },
  {
    name: 'Herbal Lore never mends past his maximum HP',
    stage(b) {
      herbalist(b);
      const h = wounded(b, 18, 20, 30);
      return { hero: h, orders: [[h, five(defend(), defend(), defend(), defend(), defend())]] };
    },
    check(o, s) {
      return {
        got: { told: anySays(o, herbalLore(s.hero, 12, 2, 20, 20)) },
        want: { told: true },
      };
    },
  },
  {
    name: 'Herbal Lore: nothing for a realm that has not learnt it',
    stage(b) {
      const h = wounded(b, 10, 20, 20);
      return { hero: h, orders: [[h, five(defend(), defend(), defend(), defend(), defend())]] };
    },
    check(o, s) {
      return {
        got: { dressed: phasesHeSays(o, s.hero, '🌿 Herbal Lore'), atLastSeason: char(o, s.hero)['_hpAtPhaseStart'] },
        want: { dressed: [], atLastSeason: 10 },
      };
    },
  },
  {
    name: "Herbal Lore: nothing for another realm's wounded hero, though his foe's realm has learnt it",
    stage(b) {
      herbalist(b);
      const h = wounded(b, 10, 20, 20, 1);
      return { hero: h, orders: [[h, five(defend(), defend(), defend(), defend(), defend())]] };
    },
    check(o, s) {
      return { got: { dressed: phasesHeSays(o, s.hero, '🌿 Herbal Lore') }, want: { dressed: [] } };
    },
  },
  {
    name: 'Herbal Lore: nothing for a hero at his maximum, though he was stronger as last season began',
    stage(b) {
      herbalist(b);
      const h = wounded(b, 20, 20, 25);
      return { hero: h, orders: [[h, five(defend(), defend(), defend(), defend(), defend())]] };
    },
    check(o, s) {
      return { got: { dressed: phasesHeSays(o, s.hero, '🌿 Herbal Lore') }, want: { dressed: [] } };
    },
  },
  {
    name: 'Herbal Lore: nothing for a hero no weaker than as last season began',
    stage(b) {
      herbalist(b);
      const h = wounded(b, 12, 20, 12);
      return { hero: h, orders: [[h, five(defend(), defend(), defend(), defend(), defend())]] };
    },
    check(o, s) {
      return {
        got: { dressed: phasesHeSays(o, s.hero, '🌿 Herbal Lore'), atLastSeason: char(o, s.hero)['_hpAtPhaseStart'] },
        want: { dressed: [], atLastSeason: 12 },
      };
    },
  },
  {
    name: 'Herbal Lore: nothing for a hero the save has no HP for as last season began (new to the realm)',
    stage(b) {
      herbalist(b);
      const h = wounded(b, 10, 20, null);
      return { hero: h, orders: [[h, five(defend(), defend(), defend(), defend(), defend())]] };
    },
    check(o, s) {
      return {
        got: { dressed: phasesHeSays(o, s.hero, '🌿 Herbal Lore'), atLastSeason: char(o, s.hero)['_hpAtPhaseStart'] },
        want: { dressed: [], atLastSeason: 10 },
      };
    },
  },
  {
    name: 'a stale "fought a stalled battle in Spring" mark from the save does not hold his column in Spring',
    stage(b) {
      const h = leads(at(b, { march: 0 }), companies(2));
      h['_foughtStalledBattlePhase'] = 0;
      return { hero: h, orders: [one(h, order('move', ring1(b, 0).id))], there: ring1(b, 0) };
    },
    check(o, s) {
      return {
        got: {
          held: anySays(o, `${s.hero.name} has already fought a battle this phase`),
          where: char(o, s.hero).location,
        },
        want: { held: false, where: there(s).id },
      };
    },
  },
  {
    name: 'a stale "met him this season" mark from the save does not stop a hunt in Spring',
    stage(b) {
      const q = rival(b, { at: ring1(b, 0) });
      const h = at(b, { spy: 3 });
      h['_encounteredThisPhase'] = q.id;
      return { hero: h, mark: q, orders: [one(h, hunt(q))] };
    },
    check(o, s) {
      return {
        got: { setOut: anySays(o, `${s.hero.name} sets out to run down ${mark(s).name}`) },
        want: { setOut: true },
      };
    },
  },
  {
    name: 'a hero the save carries as hired in Late Summer (an old save) is told as it opens that he waits, and acts only after it',
    stage(b) {
      const h = at(b);
      h['hiredInPhase'] = 2;
      return { hero: h, orders: [[h, five(rest(), rest(), rest(), order('explore'), rest())]], there: b.X };
    },
    check(o, s) {
      const line = `${s.hero.name} was hired this phase and will be ready to act from the next phase.`;
      return {
        got: { told: told(o, line), times: countSaying(o, line), explored: phasesHeSays(o, s.hero, 'explore') },
        want: {
          told: { type: 'hire', targets: [0], provinceId: null, public: false, phase: 2 },
          times: 1,
          explored: [3],
        },
      };
    },
  },
];

// ── Intents and reactions ────────────────────────────────────────────────────────────────────────────────────────
/** The line a column still in last season's unresolved battle is held by, as the season opens. */
export const stillLocked = (c: Character, p: Province) =>
  `${c.name} is still locked in the unresolved battle for ${p.name} and cannot march away — the fight must be seen through before they can move on.`;
/** The line a column that has fought again as the season opened is held by. */
export const foughtAlready = (c: Character) =>
  `${c.name} has already fought a battle this phase and cannot march on to start another — one battle per phase.`;
const CONTESTED = 'the province remains contested';
/** The line the movement interlocks hold a general by, when an enemy enters his province before he leaves. */
const pinned = (c: Character, to: string, p: Province) =>
  `${c.name} is under orders to march on ${to}, but an enemy force enters ${p.name} before the column can clear the gates. ${c.name} stays to defend.`;
const ring1Name = (s: Staged) => place(s, 0).name;
const b0 = (o: Outcome, s: Staged) => must(o.world.world.provinces[must(s.other, 'h').location], 'his province');
/** A column of realm 0 in the middle (its own ground), slow (Tactical 1, March 0), and an enemy column next door,
 *  quicker, that marches in in Spring: their battle is left unresolved (every die at its highest). */
const lockedIn = (b: Board, n = 3) => {
  b.own(b.X, 0);
  const h = leads(at(b, { tactical: 1, march: 0 }), companies(n));
  const e = leads(rival(b, { at: ring1(b, 0) }, { tactical: 5, march: 3 }), companies(3));
  return { h, e };
};
export const INTENTS_AND_REACTIONS_CASES: PhaseStageCase[] = [
  {
    name: "a column still in last season's unresolved battle can't march away as the next opens: told, and he stays",
    stage(b) {
      const { h, e } = lockedIn(b);
      return {
        hero: h,
        other: e,
        there: b.X,
        orders: [one(h, defend(), order('move', ring1(b, 3).id)), one(e, order('move', b.X.id))],
      };
    },
    check(o, s) {
      const l = o.all.find((x) => x.text === stillLocked(s.hero, there(s)));
      return {
        got: {
          contested: phasesSaying(o, CONTESTED).includes(0),
          told: told(o, stillLocked(s.hero, there(s))),
          notice: l ? [l.charId, l.actor, l['pinNotice']] : null,
          where: char(o, s.hero).location,
        },
        want: {
          contested: true,
          told: { type: 'combat', targets: [0], provinceId: there(s).id, public: false, phase: 1 },
          notice: [s.hero.id, 0, true],
          where: there(s).id,
        },
      };
    },
  },
  {
    name: 'a column that fought again as the season opened, and won, cannot march on to start another battle that season',
    stage(b) {
      b.own(b.X, 1);
      const e = leads(rival(b, {}, { tactical: 0 }), companies(1, 'Men-at-Arms', 'Green'));
      const h = leads(at(b, { tactical: 5, march: 3 }, { at: ring1(b, 0) }), companies(4));
      return {
        hero: h,
        other: e,
        there: b.X,
        // Spring: he attacks, and the survivors, with nowhere to go, don't yield; Early Summer: fought again, still
        // held; Late Summer: fought again as the season opens, and taken
        orders: [
          one(h, order('move', b.X.id), defend(), order('move', ring1(b, 3).id)),
          one(e, defend(), defend(), defend()),
        ],
      };
    },
    check(o, s) {
      return {
        got: {
          taken: phasesSaying(o, `${s.hero.name} secures ${there(s).name}!`),
          told: told(o, foughtAlready(s.hero)),
          where: char(o, s.hero).location,
        },
        want: {
          taken: phasesSaying(o, `${s.hero.name} secures ${there(s).name}!`),
          told: { type: 'combat', targets: [0], provinceId: there(s).id, public: false, phase: 2 },
          where: there(s).id,
        },
      };
    },
  },
  {
    name: "an Encounter out of last season's unresolved battle is held the same",
    stage(b) {
      const { h, e } = lockedIn(b);
      const q = rival(b, { at: ring1(b, 3) });
      return {
        hero: h,
        other: e,
        mark: q,
        there: b.X,
        orders: [one(h, defend(), hunt(q)), one(e, order('move', b.X.id))],
      };
    },
    check(o, s) {
      return {
        got: {
          told: phasesHeSays(o, s.hero, stillLocked(s.hero, there(s))),
          setOut: anySays(o, `${s.hero.name} sets out to run down`),
        },
        want: { told: [1], setOut: false },
      };
    },
  },
  {
    name: "a Rest in last season's unresolved battle is not held: it isn't a march",
    stage(b) {
      const { h, e } = lockedIn(b);
      return { hero: h, other: e, there: b.X, orders: [one(h, defend(), rest()), one(e, order('move', b.X.id))] };
    },
    check(o, s) {
      return {
        got: { held: anySays(o, `${s.hero.name} is still locked`), contested: phasesSaying(o, CONTESTED).includes(0) },
        want: { held: false, contested: true },
      };
    },
  },
  {
    name: "a hero of the same realm with no companies, in last season's unresolved battle, is not held: he marches",
    stage(b) {
      const { h, e } = lockedIn(b);
      const lone = at(b, { march: 0 });
      return {
        hero: lone,
        other: h,
        there: ring1(b, 3),
        orders: [
          one(lone, rest(), order('move', ring1(b, 3).id)),
          one(h, defend(), defend()),
          one(e, order('move', b.X.id)),
        ],
      };
    },
    check(o, s) {
      return {
        got: {
          held: anySays(o, `${s.hero.name} is still locked`),
          heldToo: phasesHeSays(o, other(s), stillLocked(other(s), b0(o, s))),
          where: char(o, s.hero).location,
        },
        want: { held: false, heldToo: [], where: there(s).id },
      };
    },
  },
  {
    name: 'a general whose province is invaded before he leaves is held there: his Move becomes a watch kept in silence, and he fights at home',
    stage(b) {
      const { h, e } = lockedIn(b);
      return {
        hero: h,
        other: e,
        there: b.X,
        places: [ring1(b, 3)],
        orders: [one(h, order('move', ring1(b, 3).id)), one(e, order('move', b.X.id))],
      };
    },
    check(o, s) {
      return {
        got: {
          pinned: told(o, pinned(s.hero, ring1Name(s), there(s))),
          // his order comes to nothing more: no march, no watch set, no line of his own that season
          lines: linesIn(o, s.hero, 0),
          where: char(o, s.hero).location,
          fought: anySays(o, `moves into ${there(s).name}, held by`),
        },
        want: {
          pinned: { type: 'move', targets: [0], provinceId: there(s).id, public: false, phase: 0 },
          lines: [],
          where: there(s).id,
          fought: true,
        },
      };
    },
  },
  {
    name: "a Defend given this season keeps watch from the season's start: he rides out against a column crossing into his realm next door that same season",
    dice: EVEN,
    stage(b) {
      const next = ring1(b, 0);
      const from = must(
        b.ring2.find((p) => b.nbrs(p).includes(next)),
        'a province two away beside the neighbour',
      );
      b.own(b.X, 0);
      b.own(next, 0);
      b.own(from, 1); // a beaten foe falls back home, so the battle ends
      const h = leads(at(b), companies(4));
      const foe = leads(rival(b, { at: from }), companies(1));
      return {
        hero: h,
        mark: foe,
        there: b.X,
        places: [next],
        orders: [one(h, defend(), defend(), defend()), one(foe, order('move', next.id))],
      };
    },
    check(o, s) {
      return {
        got: {
          rodeOut: phasesSaying(
            o,
            `🛡 ${s.hero.name} is standing watch — word reaches them that ${mark(s).name} is crossing into ${place(s, 0).name}.`,
          ),
          watchLines: phasesHeSays(o, s.hero, 'makes camp in'),
        },
        want: { rodeOut: [0], watchLines: [1] },
      };
    },
  },
  {
    name: 'a column ordered home ahead of an invader arrives first, and his Move is done: he holds the line there that season',
    stage(b) {
      const home = ring1(b, 0);
      const from = must(
        b.ring2.find((p) => b.nbrs(p).includes(home)),
        'a province two away beside it',
      );
      b.own(home, 0);
      const h = leads(at(b, { tactical: 0, march: 0 }), companies(3));
      const foe = leads(rival(b, { at: from }, { tactical: 5, march: 3 }), companies(1));
      return {
        hero: h,
        mark: foe,
        there: home,
        orders: [one(h, order('move', home.id)), one(foe, order('move', home.id))],
      };
    },
    check(o, s) {
      return {
        got: {
          arrived: told(o, `${s.hero.name} force-marches into ${there(s).name} ahead of the enemy`),
          lines: linesIn(o, s.hero, 0)
            .filter((t) => !t.startsWith('⚑') && !t.startsWith('📊'))
            .slice(0, 3),
          where: char(o, s.hero).location,
        },
        want: {
          arrived: { type: 'move', targets: [0], provinceId: there(s).id, public: false, phase: 0 },
          lines: [],
          where: there(s).id,
        },
      };
    },
  },
];

// ── The orders in two tiers ──────────────────────────────────────────────────────────────────────────────────────
/** A mercenary band of Free Lances (Veteran) roaming `where`, for a Recruit to hire (`merc:merc_test`). */
const band = (b: Board, where: Province) => {
  const m = {
    id: 'merc_test',
    type: 'Free Lances',
    quality: 'Veteran',
    race: 'Human',
    unitName: 'Test Company',
    location: where.id,
  };
  must(b.G.mercenaries, 'the mercenaries').push(m);
  return m;
};
/** A general of realm 0 in the middle (its ground), leading `n` companies, and next door a province of his realm where
 *  an enemy hero with no companies stands beside a mercenary band. */
const watchNextDoor = (b: Board, n: number) => {
  const next = ring1(b, 0);
  b.own(b.X, 0);
  b.own(next, 0);
  band(b, next);
  const h = leads(at(b), companies(n));
  const raiser = rival(b, { at: next });
  return { next, h, raiser };
};
const hires = order('recruit', 'merc:merc_test');
const realmOf = (o: Outcome, i: number) => must(o.world.players[i], 'realm ' + String(i)).name;
/** The line of a host raised in a province a general watches: it waits for the Defend step. */
const formingUp = (c: Character, p: Province) =>
  `${c.name}'s new host is still forming up in ${p.name} — whether the province can be taken will be settled before the season's marches begin.`;
/** The line of a general riding in to a host raised in his watch. */
const ridesIn = (c: Character) => `🛡 ${c.name} is standing watch — word reaches them that`;
export const ORDERS_IN_TWO_TIERS_CASES: PhaseStageCase[] = [
  {
    name: "a host raised in a general's watch waits for the Defend step, where the general rides in and gives it battle, that season",
    stage(b) {
      const { next, h, raiser } = watchNextDoor(b, 4);
      return {
        hero: h,
        mark: raiser,
        there: b.X,
        places: [next],
        orders: [one(h, defend(), defend()), one(raiser, hires)],
      };
    },
    check(o, s) {
      return {
        got: {
          forming: phasesSaying(o, formingUp(mark(s), place(s, 0))),
          ridesIn: phasesHeSays(o, s.hero, ridesIn(s.hero)),
          battle: phasesSaying(o, `⚔ **Battle for ${place(s, 0).name}**`).slice(0, 1),
        },
        want: { forming: [0], ridesIn: [0], battle: [0] },
      };
    },
  },
  {
    name: 'with nobody marching or on Defend that season, the Defend step still comes, after the orders: the host raised is given battle',
    stage(b) {
      const { next, h, raiser } = watchNextDoor(b, 4);
      return {
        hero: h,
        mark: raiser,
        there: b.X,
        places: [next],
        // his watch, set in Spring, is kept over a Rest; the band is hired in Early Summer
        orders: [one(h, defend(), rest()), one(raiser, rest(), hires)],
      };
    },
    check(o, s) {
      return {
        got: {
          forming: phasesSaying(o, formingUp(mark(s), place(s, 0))),
          ridesIn: phasesHeSays(o, s.hero, ridesIn(s.hero)),
          battle: phasesSaying(o, `⚔ **Battle for ${place(s, 0).name}**`).slice(0, 1),
        },
        want: { forming: [1], ridesIn: [1], battle: [1] },
      };
    },
  },
  {
    name: 'a live chase suspends his other orders: no Explore while he keeps the trail',
    dice: { roll: 100, die: 0.99999 },
    stage(b) {
      const q = rival(b, { at: ring1(b, 0) });
      const h = at(b, { spy: 3 });
      return { hero: h, mark: q, there: b.X, orders: [one(h, hunt(q), order('explore'), order('explore')), one(q)] };
    },
    check(o, s) {
      return {
        got: {
          explored: phasesHeSays(o, s.hero, 'explor'),
          kept: phasesSaying(o, `${s.hero.name} keeps the trail but cannot close`),
        },
        want: { explored: [], kept: [0, 1, 2, 3, 4] },
      };
    },
  },
  {
    name: 'a coward who begged for mercy this turn does nothing more: the season leaves him where he stands',
    stage(b) {
      const h = at(b);
      h['_mercyFledTurn'] = b.G.turn;
      return { hero: h, there: b.X, orders: [[h, five(order('explore'), order('explore'))]] };
    },
    check(o, s) {
      return {
        got: { spring: linesIn(o, s.hero, 0), explored: phasesHeSays(o, s.hero, 'xplor') },
        want: { spring: [`${s.hero.name} remains in ${there(s).name} this season.`], explored: [] },
      };
    },
  },
  {
    name: 'a hero slain in Spring before his turn to act: his orders go unanswered, told once, then and not after',
    stage(b) {
      const m = rival(b);
      const h = at(b, { spy: 9 });
      return {
        hero: m,
        other: h,
        there: b.X,
        orders: [one(h, order('assassinate', m.id)), [m, five(rest(), order('explore'), order('explore'))]],
      };
    },
    check(o, s) {
      const line = `${s.hero.name} has fallen — their remaining orders for this turn go unanswered.`;
      const l = o.all.find((x) => x.text === line);
      return {
        got: {
          slain: char(o, s.hero).alive,
          told: told(o, line),
          his: l ? l.charId : null,
          times: countSaying(o, line),
          explored: phasesHeSays(o, s.hero, 'xplor'),
        },
        want: {
          slain: false,
          told: { type: 'system', targets: [1], provinceId: null, public: false, phase: 0 },
          his: s.hero.id,
          times: 1,
          explored: [],
        },
      };
    },
  },
  {
    name: 'hosts at war that began the turn on the same ground fight as a war front at the end of Spring, after its orders, not as it opens',
    stage(b) {
      const h = leads(at(b), companies(3));
      const e = leads(rival(b), companies(3));
      return { hero: h, other: e, there: b.X, orders: [one(h, defend(), defend()), one(e, defend(), defend())] };
    },
    check(o, s) {
      const spring = o.all.filter((l) => l.phase === 0).map((l) => l.text);
      const firstBattle = spring.findIndex((t) => t.startsWith('⚔ **Battle for'));
      const camps = spring.findIndex((t) => t.startsWith(`${s.hero.name} makes camp in`));
      return {
        got: {
          front: phasesSaying(
            o,
            `${s.hero.name} (${realmOf(o, 0)}) has held 3 units in ${there(s).name} since the season opened`,
          ),
          afterOrders: camps >= 0 && firstBattle > camps,
        },
        want: { front: [0], afterOrders: true },
      };
    },
  },
  {
    name: 'what does not march resolves before the Defend step: companies handed to a general on watch ride out with him',
    dice: EVEN,
    stage(b) {
      const next = ring1(b, 0);
      const from = must(
        b.ring2.find((p) => b.nbrs(p).includes(next)),
        'a province two away beside the neighbour',
      );
      b.own(b.X, 0);
      b.own(next, 0);
      b.own(from, 1);
      const h = leads(at(b, { tactical: 0, march: 0 }), companies(1));
      const g = leads(at(b, { tactical: 0, march: 0 }), companies(3, 'Men-at-Arms', 'Average', 'Handed'));
      const foe = leads(rival(b, { at: from }), companies(1));
      return {
        hero: h,
        other: g,
        mark: foe,
        there: b.X,
        places: [next],
        orders: [
          one(h, defend()),
          one(g, order('leave_army', 'all', String(b.G.characters.indexOf(h)))),
          one(foe, order('move', next.id)),
        ],
      };
    },
    check(o, s) {
      return {
        got: {
          rodeOut: phasesHeSays(o, s.hero, ridesIn(s.hero)),
          withThem: anySays(o, `Defender (${s.hero.name}): 4 units`),
        },
        want: { rodeOut: [0], withThem: true },
      };
    },
  },
];

/** A general of realm 0 in the middle (its ground), leading 4 companies, and an enemy column two away that can cross
 *  into his realm's province next door, from its own (a beaten foe falls back home, so a battle ends). */
const watchAndCrossing = (b: Board) => {
  const next = ring1(b, 0);
  const from = must(
    b.ring2.find((p) => b.nbrs(p).includes(next)),
    'a province two away beside the neighbour',
  );
  b.own(b.X, 0);
  b.own(next, 0);
  b.own(from, 1);
  const h = leads(at(b), companies(4));
  const foe = leads(rival(b, { at: from }), companies(1));
  return { h, foe, next };
};
// ── The end of the phase ─────────────────────────────────────────────────────────────────────────────────────────
export const PHASE_END_CASES: PhaseStageCase[] = [
  {
    name: "a fallen commander's host, its battle over, is dispersed as the season ends: it garrisons his realm's province",
    stage(b) {
      b.own(b.X, 0);
      const d = leads(at(b), companies(2));
      d.alive = false;
      const h = at(b, {}, { at: ring1(b, 0) });
      return { hero: d, other: h, there: b.X, orders: [one(h)] };
    },
    check(o, s) {
      return {
        got: {
          told: told(o, `${s.hero.name}'s armies garrison in ${there(s).name} after their fall.`),
          garrison: province(o, there(s)).garrisonArmies.map((u) => u.unitName),
          led: char(o, s.hero).armies.length,
        },
        want: {
          told: { type: 'system', targets: [0], provinceId: there(s).id, public: false, phase: 0 },
          garrison: ['Men-at-Arms c0', 'Men-at-Arms c1'],
          led: 0,
        },
      };
    },
  },
  {
    name: 'a Move ordered for next season ends a standing watch as this one ends: he marches, and no ride-out holds him back',
    dice: EVEN,
    stage(b) {
      const { h, foe, next } = watchAndCrossing(b);
      return {
        hero: h,
        mark: foe,
        there: ring1(b, 3),
        places: [next],
        orders: [one(h, defend(), order('move', ring1(b, 3).id)), one(foe, rest(), order('move', next.id))],
      };
    },
    check(o, s) {
      return {
        got: {
          rodeOut: phasesHeSays(o, s.hero, ridesIn(s.hero)),
          seized: phasesSaying(o, `${mark(s).name} seizes the undefended province of ${place(s, 0).name}`),
          where: char(o, s.hero).location,
        },
        want: { rodeOut: [], seized: [1], where: there(s).id },
      };
    },
  },
  {
    name: 'an Encounter ordered for next season ends it the same: he sets out on the hunt, and no ride-out holds him back',
    dice: { roll: 100, die: 0.99999 },
    stage(b) {
      const { h, foe, next } = watchAndCrossing(b);
      const q = rival(b, { at: ring1(b, 3) });
      return {
        hero: h,
        mark: foe,
        other: q,
        there: b.X,
        places: [next],
        orders: [one(h, defend(), hunt(q)), one(foe, rest(), order('move', next.id)), one(q)],
      };
    },
    check(o, s) {
      return {
        got: {
          rodeOut: phasesHeSays(o, s.hero, ridesIn(s.hero)),
          setOut: phasesHeSays(o, s.hero, `${s.hero.name} sets out to run down ${other(s).name}`),
        },
        want: { rodeOut: [], setOut: [1] },
      };
    },
  },
];

/** Stages `c` on `b`, from plain realms, each with no heroes on its list. */
export const stageCase = (b: Board, c: PhaseStageCase): Staged => {
  plainRealms(b);
  b.G.players.forEach((pl) => {
    pl['heroes'] = [];
  });
  return c.stage(b);
};

/** Every case, by stage (named as a player meets it). */
export const PHASE_STAGE_CASES: [string, PhaseStageCase[]][] = [
  ['The start of the phase', PHASE_START_CASES],
  ['Intents and reactions', INTENTS_AND_REACTIONS_CASES],
  ['The orders in two tiers', ORDERS_IN_TWO_TIERS_CASES],
  ['The end of the phase', PHASE_END_CASES],
];
export { EVEN, phasesSaying, place, other, province, watch };
