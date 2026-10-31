// The war orders' cases (plan P1-08j8): Encounter Character and Defend, then the war masteries (Blockade, Challenge,
// Rampage, Rain of Arrows, Sniper's Mark, Feigned Retreat, Grand Stratagem, Lightning Advance, Raid the Coast), staged
// on the middle of a bot world (lib/middle-of-a-bot-world.ts), from plain realms, each with what must be true after it
// in game terms. scenario/war-orders-in-a-whole-turn.test.ts plays each through a whole turn (resolveTurn);
// unit/war-orders-called-directly.test.ts calls each order's own function on them, one phase at a time. A case stages
// its world and the heroes' orders; after them, it reads what it needs from the world and the log (`got`) beside what
// must be so (`want`), and the test compares the two.
// Encounter and Defend only set up a chase or a watch; the phases after the order carry it out (the chase in each later
// phase, the watch's ride-out), so their cases play those phases too, and a case the order's own call can't show is
// `wholeTurnOnly`. The masteries' battle-strength flags are read by a later battle of the turn, so their cases fight
// one. Every outcome is certain: every case fixes the dice for the whole turn (default LANDS), every percentile roll at
// one number and every other die at one value, so the outcome holds however many dice the turn draws before the order.
// Realms 0 and 1 are at war, 0 and 2 allied, 1 and 2 at peace (the board's relations).
import {
  must,
  order,
  plan,
  type Board,
  type Character,
  type HeroSpec,
  type Line,
  type Order,
  type Province,
} from './middle-of-a-bot-world.ts';
import { companies } from './item-and-army-order-cases.ts';
import { oldCloakOfManyFaces, type Dice } from './espionage-order-cases.ts';
import {
  anySays,
  at,
  char,
  countSaying,
  fallen,
  holding,
  leads,
  names,
  one,
  province,
  realm,
  realmName,
  ring1,
  ring2,
  rival,
  says,
  wanderer,
  xpIn,
  STD,
  type Outcome,
  type Staged,
} from './cast-spell-order-cases.ts';
import { plainRealms } from './recruit-hire-and-realm-works-order-cases.ts';

export type { Outcome, Staged };
export interface WarOrderCase {
  name: string;
  /** Plays only in a whole turn: the turn refuses the order before the order's own function runs (a mastery order
   *  given twice in a turn), or the phases after it carry it out (a chase in a later phase, a watch's ride-out, a
   *  battle that reads a mastery's flag). */
  wholeTurnOnly?: boolean;
  /** The dice for the whole turn (default LANDS). */
  dice?: Dice;
  stage(b: Board): Staged;
  /** What the case found after the orders, and what it should have found: the same keys. */
  check(o: Outcome, s: Staged): { got: Record<string, unknown>; want: Record<string, unknown> };
}

/** Every roll lands (a catch, a Sniper's Mark's kill); every other die at its highest, so no skill rises mid-turn and
 *  no blockade forms. The dice of a case that names none. */
export const LANDS: Dice = { roll: 1, die: 0.99999 };
/** Every roll misses (a quarry slips away, a Sniper's Mark only wounds); every other die at its highest. */
export const MISSES: Dice = { roll: 100, die: 0.99999 };
/** Every roll lands; every other die at its lowest (a blockade forms). */
export const LUCKY: Dice = { roll: 1, die: 0 };
/** Every roll lands; every other die at the middle (a battle's fortune runs with neither side, and the beaten side is
 *  broken, not stalled). */
export const EVEN: Dice = { roll: 1, die: 0.5 };
/** The roll a case fixes, with every other die at its highest. */
export const rollOf = (roll: number): Dice => ({ roll, die: 0.99999 });

/** The first line of the turn saying `what`: its kind, the realms told, its province, whether it is public, its phase
 *  (null if no line says it). */
export const told = (o: Outcome, what: string) => {
  const l = o.all.find((x) => x.text.includes(what));
  return l
    ? { type: l.type, targets: l.targets ?? null, provinceId: l.provinceId, public: !!l['public'], phase: l.phase }
    : null;
};
/** The phases of the lines of the turn saying `what`, in order. */
export const phasesSaying = (o: Outcome, what: string) =>
  o.all.filter((l: Line) => l.text.includes(what)).map((l) => l.phase);
/** The duels a hero has won against another realm's hero (the Widowmaker's count): his kills credited. */
export const duelKills = (o: Outcome, c: Character) =>
  (char(o, c)['tm'] as { duelKills?: number } | undefined)?.duelKills ?? 0;
/** The hero's watch as the turn left it (undefined if he keeps none). */
export const watch = (o: Outcome, c: Character) => char(o, c)['_defend'];
/** The hero's chase as the turn left it (undefined if he set out on none). */
export const chase = (o: Outcome, c: Character) => char(o, c)['_pursuit'];
export const there = (s: Staged) => must(s.there, 'the province');
export const mark = (s: Staged) => must(s.mark, 'the mark');

/** An enemy hero in the middle whose Invisibility holds this turn (R-119: another realm's order aimed at him finds no
 *  one). */
export const unseen = (b: Board) => {
  const q = rival(b);
  q['_invisTurn'] = b.G.turn;
  return q;
};

// ── Encounter Character ─────────────────────────────────────────────────────────────────────────────────────────
/** An Encounter Character order on `q`. */
export const hunt = (q: Character | number) => order('encounter', typeof q === 'number' ? q : q.id);
/** A hunter of realm 0 in the middle, of `skills` (and `extra`), sent after `q` in the first phase. */
const hunter = (
  b: Board,
  q: Character,
  skills: Record<string, number> = {},
  extra: Partial<Character> = {},
): Staged => {
  const h = at(b, skills);
  Object.assign(h, extra);
  return { hero: h, orders: [one(h, hunt(q))], mark: q, there: b.X };
};
/** The line a hunter's order ends with when it sets him on the chase. */
const setsOut = (s: Staged) =>
  `${s.hero.name} sets out to run down ${mark(s).name} and will not turn aside until the matter is settled.`;
/** The line of a catch that brings the two to a duel. */
const corners = (s: Staged, p: Province) => `⚔ ${s.hero.name} finally corners ${mark(s).name} in ${p.name}.`;
/** The line of a catch that misses. */
const slips = (s: Staged, p: Province) =>
  `${mark(s).name} slips away through the country around ${p.name} — ${s.hero.name} keeps the trail but cannot close.`;
/** The catch roll's line, as `📊 Pursuit — <hunter> (Spy n) closing on <quarry>`. */
const catchRoll = (s: Staged) => `📊 Pursuit — ${s.hero.name} (Spy `;
/** What a refused hunt leaves: no chase set, no catch rolled, no duel, the hunter where he stood. */
const nothingHunted = (o: Outcome, s: Staged) => ({
  chase: chase(o, s.hero),
  rolled: anySays(o, catchRoll(s)),
  setOut: anySays(o, setsOut(s)),
  where: char(o, s.hero).location,
});
const NOTHING_HUNTED = (s: Staged) => ({ chase: undefined, rolled: false, setOut: false, where: there(s).id });

export const ENCOUNTER_ORDER_CASES: WarOrderCase[] = [
  {
    name: 'a quarry nobody can find (no hero of that name): no trail, and no chase',
    stage(b) {
      const s = hunter(b, rival(b));
      return { ...s, orders: [one(s.hero, hunt(99999))] };
    },
    check(o, s) {
      const line = `${s.hero.name} casts about for a quarry to hunt down but finds no trail to follow.`;
      return {
        got: { told: told(o, line), ...nothingHunted(o, s) },
        want: {
          told: { type: 'system', targets: [0], provinceId: there(s).id, public: false, phase: 0 },
          ...NOTHING_HUNTED(s),
        },
      };
    },
  },
  {
    name: 'a quarry who has fallen: no trail, and no chase',
    stage(b) {
      return hunter(b, fallen(b, b.X, { player: 1 }));
    },
    check(o, s) {
      return {
        got: { said: says(o, `${s.hero.name} casts about for a quarry to hunt down`), ...nothingHunted(o, s) },
        want: { said: true, ...NOTHING_HUNTED(s) },
      };
    },
  },
  {
    name: 'a hero sent after himself: refused',
    stage(b) {
      const h = at(b);
      return { hero: h, orders: [one(h, hunt(h))], mark: h, there: b.X };
    },
    check(o, s) {
      const line = `${s.hero.name} cannot set out to encounter themself.`;
      return {
        got: { told: told(o, line), chase: chase(o, s.hero), setOut: anySays(o, setsOut(s)) },
        want: {
          told: { type: 'system', targets: [0], provinceId: there(s).id, public: false, phase: 0 },
          chase: undefined,
          setOut: false,
        },
      };
    },
  },
  {
    name: "a charmed enemy hero will not hunt a hero of his own lord's: refused",
    stage(b) {
      const q = rival(b);
      return hunter(b, q, {}, { _charmTempControl: true, _charmOriginalPlayer: 1 });
    },
    check(o, s) {
      const line = `${s.hero.name} will not hunt ${mark(s).name} — the Charm bends their will, but not so far as to turn them on their own lord's people.`;
      return {
        got: { told: told(o, line), ...nothingHunted(o, s) },
        want: {
          told: { type: 'system', targets: [0], provinceId: there(s).id, public: false, phase: 0 },
          ...NOTHING_HUNTED(s),
        },
      };
    },
  },
  {
    name: "a charmed hero hunts another realm's hero as any hero of the realm holding him would",
    stage(b) {
      const q = rival(b);
      return hunter(b, q, {}, { _charmTempControl: true, _charmOriginalPlayer: 2 });
    },
    check(o, s) {
      return {
        got: { setOut: says(o, setsOut(s)), cornered: anySays(o, corners(s, there(s))) },
        want: { setOut: true, cornered: true },
      };
    },
  },
  {
    name: 'a common hero may not run down a rival king: the chase is abandoned',
    stage(b) {
      return hunter(b, rival(b, { king: true }));
    },
    check(o, s) {
      const line = `${s.hero.name} sets out after ${mark(s).name}, but a rival king does not answer to a common hero — only a king may run down another king. The chase is abandoned.`;
      return {
        got: { told: told(o, line), ...nothingHunted(o, s) },
        want: {
          told: { type: 'system', targets: [0], provinceId: there(s).id, public: false, phase: 0 },
          ...NOTHING_HUNTED(s),
        },
      };
    },
  },
  {
    name: 'a king may run down a rival king, and corners him',
    stage(b) {
      const s = hunter(b, rival(b, { king: true }));
      s.hero.isKing = true;
      return s;
    },
    check(o, s) {
      return {
        got: { setOut: says(o, setsOut(s)), cornered: anySays(o, corners(s, there(s))) },
        want: { setOut: true, cornered: true },
      };
    },
  },
  {
    name: "a common hero may seek out his own realm's king: the catch is certain, and they meet",
    stage(b) {
      return hunter(b, at(b, {}, { king: true }));
    },
    check(o, s) {
      return {
        got: {
          setOut: says(o, setsOut(s)),
          rolled: says(o, `closing on ${mark(s).name} (Spy 0): 100% [roll 1 ✓]`),
          met: says(
            o,
            `${s.hero.name} catches up with ${mark(s).name} in ${there(s).name} and the two columns join company.`,
          ),
          cornered: anySays(o, corners(s, there(s))),
        },
        want: { setOut: true, rolled: true, met: true, cornered: false },
      };
    },
  },
  {
    name: 'a cloaked quarry (a Cloak of Many Faces, as an older save holds it) leaves no trail',
    stage(b) {
      const q = rival(b);
      return hunter(b, holding(q, oldCloakOfManyFaces(b)));
    },
    check(o, s) {
      const line = `${s.hero.name} sets out after ${mark(s).name}, but they are cloaked and leave no trail to follow.`;
      return {
        got: { told: told(o, line), ...nothingHunted(o, s) },
        want: {
          told: { type: 'system', targets: [0], provinceId: there(s).id, public: false, phase: 0 },
          ...NOTHING_HUNTED(s),
        },
      };
    },
  },
  {
    name: 'a quarry of another realm whose Invisibility holds leaves no trail at all (R-119): the line names no one, and no chase',
    stage(b) {
      return hunter(b, unseen(b));
    },
    check(o, s) {
      const line = `${s.hero.name} casts about for a quarry to hunt down but finds no trail to follow.`;
      return {
        got: { told: told(o, line), namesHim: says(o, mark(s).name), ...nothingHunted(o, s) },
        want: {
          told: { type: 'system', targets: [0], provinceId: there(s).id, public: false, phase: 0 },
          namesHim: false,
          ...NOTHING_HUNTED(s),
        },
      };
    },
  },
  {
    name: 'a quarry under a Veil cast this phase leaves no trail',
    stage(b) {
      const q = rival(b);
      Object.assign(q, { _veilTurn: b.G.turn, _veilCastPhase: 0 });
      return hunter(b, q);
    },
    check(o, s) {
      return {
        got: { said: says(o, 'but they are cloaked and leave no trail to follow.'), ...nothingHunted(o, s) },
        want: { said: true, ...NOTHING_HUNTED(s) },
      };
    },
  },
  {
    name: 'a hero of his own realm who is cloaked can still be sought out: they meet',
    stage(b) {
      return hunter(b, holding(at(b), oldCloakOfManyFaces(b)));
    },
    check(o, s) {
      return {
        got: {
          cloaked: says(o, 'cloaked'),
          met: says(
            o,
            `${s.hero.name} catches up with ${mark(s).name} in ${there(s).name} and the two columns join company.`,
          ),
        },
        want: { cloaked: false, met: true },
      };
    },
  },
  {
    name: 'a quarry who has vanished into the shadows this turn leaves no trail',
    stage(b) {
      const q = rival(b);
      q['_vanishTurn'] = b.G.turn;
      return hunter(b, q);
    },
    check(o, s) {
      const line = `${s.hero.name} sets out after ${mark(s).name}, but there is no trail to follow — the quarry has vanished into the shadows.`;
      return {
        got: { told: told(o, line), ...nothingHunted(o, s) },
        want: {
          told: { type: 'move', targets: [0], provinceId: there(s).id, public: false, phase: 0 },
          ...NOTHING_HUNTED(s),
        },
      };
    },
  },
  {
    name: 'a hero of his own realm who vanished this turn can still be sought out: they meet',
    stage(b) {
      const q = at(b);
      q['_vanishTurn'] = b.G.turn;
      return hunter(b, q);
    },
    check(o, s) {
      return {
        got: {
          vanished: says(o, 'vanished'),
          met: says(
            o,
            `${s.hero.name} catches up with ${mark(s).name} in ${there(s).name} and the two columns join company.`,
          ),
        },
        want: { vanished: false, met: true },
      };
    },
  },
  {
    name: 'an enemy quarry beside him: he sets out, the catch lands, and they meet in a duel',
    stage(b) {
      return hunter(b, rival(b), { melee: 5 });
    },
    check(o, s) {
      return {
        got: {
          setOut: told(o, setsOut(s)),
          rolled: phasesSaying(o, catchRoll(s)),
          cornered: told(o, corners(s, there(s))),
          chase: chase(o, s.hero),
        },
        want: {
          setOut: { type: 'move', targets: [0], provinceId: there(s).id, public: false, phase: 0 },
          rolled: [0],
          cornered: { type: 'combat', targets: [0, 1], provinceId: there(s).id, public: false, phase: 0 },
          chase: { targetId: mark(s).id, active: false, setPhase: 0 },
        },
      };
    },
  },
  {
    name: 'the catch misses: the quarry slips away, and the chase goes on every phase, his other orders waiting',
    wholeTurnOnly: true,
    dice: MISSES,
    stage(b) {
      return hunter(b, rival(b));
    },
    check(o, s) {
      return {
        got: {
          setOut: phasesSaying(o, setsOut(s)),
          slipped: phasesSaying(o, slips(s, there(s))),
          rested: o.lines.filter((l) => l.phase != null && l.phase > 0 && l.phase < 5 && !l.text.includes(mark(s).name))
            .length,
          chase: chase(o, s.hero),
        },
        want: {
          setOut: [0],
          slipped: [0, 1, 2, 3, 4],
          rested: 0,
          chase: { targetId: mark(s).id, active: true, setPhase: 0 },
        },
      };
    },
  },
  {
    name: 'a quarry two provinces off: the hunter presses on one province, and finds him the next phase',
    wholeTurnOnly: true,
    stage(b) {
      const far = ring2(b, 0);
      const q = rival(b, { at: far });
      return { ...hunter(b, q, { march: 3 }), there: far };
    },
    check(o, s) {
      const q = mark(s);
      return {
        got: {
          setOut: phasesSaying(o, setsOut(s)),
          pressedOn: o.lines
            .filter(
              (l) =>
                l.text.startsWith(`${s.hero.name} presses on into `) &&
                l.text.endsWith(`, hard on the trail of ${q.name}.`),
            )
            .map((l) => l.phase),
          found: phasesSaying(o, `${s.hero.name} rides into ${there(s).name} and finds ${q.name} there.`),
          cornered: phasesSaying(o, corners(s, there(s))),
        },
        want: { setOut: [0], pressedOn: [0], found: [1], cornered: [1] },
      };
    },
  },
  {
    name: 'a pair of enemies each sent after the other meet once, not twice',
    stage(b) {
      const q = rival(b);
      const s = hunter(b, q);
      return { ...s, orders: [...s.orders, one(q, hunt(s.hero))] };
    },
    check(o, s) {
      const q = mark(s);
      return {
        got: {
          meetings: countSaying(o, ' finally corners '),
          setOut:
            countSaying(o, setsOut(s)) +
            countSaying(o, `${q.name} sets out to run down ${s.hero.name} and will not turn aside`),
        },
        want: { meetings: 1, setOut: 1 },
      };
    },
  },
  {
    name: "an allied realm's hero overtaken: the two pass without bloodshed",
    stage(b) {
      return hunter(b, rival(b, { player: 2 }));
    },
    check(o, s) {
      return {
        got: {
          passed: says(
            o,
            `${s.hero.name} overtakes ${mark(s).name} in ${there(s).name}, but ${realmName(o, 2)} is not at war with ${realmName(o, 0)} — the two columns pass without bloodshed.`,
          ),
          cornered: anySays(o, corners(s, there(s))),
        },
        want: { passed: true, cornered: false },
      };
    },
  },
  {
    name: 'a wandering hero may be hunted down like an enemy',
    stage(b) {
      return hunter(b, wanderer(b));
    },
    check(o, s) {
      return {
        got: { setOut: says(o, setsOut(s)), cornered: told(o, corners(s, there(s)))?.targets },
        want: { setOut: true, cornered: [0] },
      };
    },
  },
  {
    name: 'both lead columns: the hunter runs his quarry to ground and forces battle',
    stage(b) {
      const q = leads(rival(b), companies(1));
      const s = hunter(b, q);
      leads(s.hero, companies(6));
      return s;
    },
    check(o, s) {
      return {
        got: {
          forced: told(o, `⚔ ${s.hero.name} runs ${mark(s).name} to ground in ${there(s).name} and forces battle!`),
          duel: anySays(o, ' finally corners '),
        },
        want: {
          forced: { type: 'combat', targets: [0, 1], provinceId: there(s).id, public: true, phase: 0 },
          duel: false,
        },
      };
    },
  },
  {
    name: 'an Encounter given in the third phase: the battle it forces is fought and told in that phase',
    stage(b) {
      const q = leads(rival(b, { at: ring1(b, 0) }), companies(1));
      const s = { ...hunter(b, q), there: ring1(b, 0) };
      leads(s.hero, companies(6));
      return { ...s, orders: [one(s.hero, order('rest'), order('rest'), hunt(q))] };
    },
    check(o, s) {
      return {
        got: {
          forced: phasesSaying(
            o,
            `⚔ ${s.hero.name} runs ${mark(s).name} to ground in ${there(s).name} and forces battle!`,
          ),
          firstBattle: phasesSaying(o, `⚔ **Battle for ${there(s).name}**`)[0],
        },
        want: { forced: [2], firstBattle: 2 },
      };
    },
  },
  {
    name: 'a chase cancels the watch he kept: Defend, then Encounter',
    wholeTurnOnly: true,
    stage(b) {
      const q = rival(b);
      const s = hunter(b, q);
      return { ...s, orders: [one(s.hero, order('defend'), hunt(q))] };
    },
    check(o, s) {
      return {
        got: { setOut: phasesSaying(o, setsOut(s)), watch: watch(o, s.hero) },
        want: { setOut: [1], watch: undefined },
      };
    },
  },
];

// ── Defend ──────────────────────────────────────────────────────────────────────────────────────────────────────
const defend = () => order('defend');
/** What the Defend order says, phase by phase, as `<phase> <what> in <province>`: `camp` (a column makes camp and sets
 *  a watch), `keeps` (it keeps the watch), `lies` (a lone hero lies in wait), `still` (and still does), `spent` (a
 *  watch already answered in battle this phase), in any of `ps`. */
const watchSays = (o: Outcome, c: Character, ...ps: Province[]) => {
  const said = (p: Province): Record<string, string> => ({
    camp: `${c.name} makes camp in ${p.name} and sets a watch — their column will answer any incursion into the lands about them for the rest of the year.`,
    keeps: `🛡 ${c.name} keeps the watch in ${p.name}.`,
    lies: `${c.name} melts into the country around ${p.name} and lies in wait — with no column at their back they cannot bar a road, but they will try to ambush any enemy who ventures into these lands (their Spy craft decides whether they can spring the trap).`,
    still: `🛡 ${c.name} still lies in wait about ${p.name}.`,
  });
  const spent = `🛡 ${c.name} has met this season's threat in battle — their Defend order is done, and they set no new watch until ordered to Defend in a later season.`;
  return o.all.flatMap((l) => {
    if (l.charId !== c.id) return [];
    const at = o.world.world.provinces[l.provinceId ?? -1];
    if (l.text === spent && at && ps.some((p) => p.id === at.id)) return [`${String(l.phase)} spent in ${at.name}`];
    return ps.flatMap((p) =>
      Object.entries(said(p))
        .filter(([, t]) => l.text === t)
        .map(([k]) => `${String(l.phase)} ${k} in ${p.name}`),
    );
  });
};
/** A general of realm 0 in the middle, leading `n` companies, on Defend in each phase `orders` gives. */
const general = (b: Board, n: number, ...orders: Order[]): Staged => {
  const h = leads(at(b), companies(n));
  return { hero: h, orders: [[h, plan(...orders)]], there: b.X };
};
export const DEFEND_ORDER_CASES: WarOrderCase[] = [
  {
    name: 'a general with a column makes camp and sets a watch, then keeps it, phase after phase',
    stage(b) {
      return general(b, 2, defend(), defend(), defend(), defend(), defend());
    },
    check(o, s) {
      return {
        got: {
          says: watchSays(o, s.hero, there(s)),
          told: told(o, `${s.hero.name} makes camp in `),
          watch: watch(o, s.hero),
        },
        want: {
          says: [0, 1, 2, 3, 4].map((ph) => `${String(ph)} ${ph ? 'keeps' : 'camp'} in ${there(s).name}`),
          told: { type: 'move', targets: [0], provinceId: there(s).id, public: false, phase: 0 },
          watch: { centre: there(s).id, active: true, setPhase: 4, carried: true },
        },
      };
    },
  },
  {
    name: 'a hero alone lies in wait, then still lies in wait',
    stage(b) {
      return general(b, 0, defend(), defend(), order('rest'), defend());
    },
    check(o, s) {
      return {
        got: {
          says: watchSays(o, s.hero, there(s)),
          told: told(o, 'still lies in wait about'),
          watch: watch(o, s.hero),
        },
        want: {
          says: [`0 lies in ${there(s).name}`, `1 still in ${there(s).name}`, `3 still in ${there(s).name}`],
          told: { type: 'move', targets: [0], provinceId: there(s).id, public: false, phase: 1 },
          watch: { centre: there(s).id, active: true, setPhase: 3, carried: true },
        },
      };
    },
  },
  {
    name: 'a watch held over a Rest is kept, not set again',
    stage(b) {
      return general(b, 2, defend(), order('rest'), defend());
    },
    check(o, s) {
      return {
        got: { says: watchSays(o, s.hero, there(s)) },
        want: { says: [`0 camp in ${there(s).name}`, `2 keeps in ${there(s).name}`] },
      };
    },
  },
  {
    name: 'a Defend after a march sets the watch where he now stands',
    stage(b) {
      const s = general(b, 2, order('move', ring1(b, 0).id), defend());
      return { ...s, there: ring1(b, 0) };
    },
    check(o, s) {
      return {
        got: { says: watchSays(o, s.hero, there(s)), watch: watch(o, s.hero) },
        want: {
          says: [`1 camp in ${there(s).name}`],
          watch: { centre: there(s).id, active: true, setPhase: 1, carried: false },
        },
      };
    },
  },
  {
    name: "a watch rides out to meet an enemy column entering his realm's province next door; the battle there answers that phase's Defend, and a later one sets a new watch",
    wholeTurnOnly: true,
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
      const s = general(b, 4, defend(), defend(), defend());
      const foe = leads(rival(b, { at: from }), companies(1));
      return {
        ...s,
        mark: foe,
        places: [next],
        orders: [...s.orders, one(foe, order('rest'), order('move', next.id))],
      };
    },
    check(o, s) {
      const next = must(s.places?.[0], 'the neighbour');
      return {
        got: {
          rodeOut: phasesSaying(
            o,
            `🛡 ${s.hero.name} is standing watch — word reaches them that ${mark(s).name} is crossing into ${next.name}.`,
          ),
          says: watchSays(o, s.hero, there(s), next),
        },
        want: {
          rodeOut: [1],
          says: [`0 camp in ${there(s).name}`, `1 spent in ${next.name}`, `2 camp in ${next.name}`],
        },
      };
    },
  },
  {
    name: 'a watch already answered in battle this phase: the Defend order is done, and a later one sets a new watch',
    wholeTurnOnly: true,
    dice: EVEN,
    stage(b) {
      b.own(b.X, 0);
      b.own(ring1(b, 0), 1); // a beaten foe falls back home, so the battle ends
      const s = general(b, 4, defend(), defend());
      const foe = leads(rival(b, { at: ring1(b, 0) }), companies(1));
      return { ...s, mark: foe, orders: [...s.orders, one(foe, order('move', b.X.id))] };
    },
    check(o, s) {
      return {
        got: {
          fulfilled: phasesSaying(o, `🛡 ${s.hero.name}'s Defend order is fulfilled`),
          says: watchSays(o, s.hero, there(s)),
          told: told(o, `🛡 ${s.hero.name} has met this season's threat in battle`),
        },
        want: {
          fulfilled: [0],
          says: [`0 spent in ${there(s).name}`, `1 camp in ${there(s).name}`],
          told: { type: 'move', targets: [0], provinceId: there(s).id, public: false, phase: 0 },
        },
      };
    },
  },
  {
    name: "a battle left unfinished resumes at the top of the next phase: that phase's Defend is answered by it too",
    wholeTurnOnly: true,
    stage(b) {
      b.own(b.X, 0);
      const s = general(b, 4, defend(), defend());
      const foe = leads(rival(b, { at: ring1(b, 0) }), companies(1));
      return { ...s, mark: foe, orders: [...s.orders, one(foe, order('move', b.X.id))] };
    },
    check(o, s) {
      return {
        got: {
          resumed: phasesSaying(o, `⚔ The unfinished battle for ${there(s).name} resumes`).slice(0, 1),
          says: watchSays(o, s.hero, there(s)),
        },
        want: { resumed: [1], says: [`0 spent in ${there(s).name}`, `1 spent in ${there(s).name}`] },
      };
    },
  },
];

// ── The war masteries ───────────────────────────────────────────────────────────────────────────────────────────
/** Five orders: the given ones first, then Defend (a hero on watch doesn't heal, as a Resting one does, so the wounds
 *  a strike leaves stand at the turn's end). */
const holds = (c: Character, ...os: Order[]): [Character, Order[]] => [
  c,
  [...os, ...Array.from({ length: Math.max(0, 5 - os.length) }, () => order('defend'))].slice(0, 5),
];
/** A hero of realm 0 in the middle, of `skills`, giving `orders` (the first phase's first), then holding. */
const master = (b: Board, skills: Record<string, number>, ...orders: Order[]): Staged => {
  const h = at(b, skills);
  return { hero: h, orders: [holds(h, ...orders)], there: b.X };
};
/** A hero of `player` (default realm 1, the enemy) beside him in the middle, leading `n` companies. */
const foeLeading = (b: Board, n: number, player = 1, extra: Partial<HeroSpec> = {}) =>
  leads(rival(b, { player, ...extra }), companies(n));
/** What a refused mastery leaves: no lesson in `skill`, the mark (if any) at full health with every company. */
const unspent = (o: Outcome, s: Staged, skill: string) => ({
  lesson: xpIn(o, s.hero, skill),
  markHp: s.mark ? char(o, mark(s)).hp : null,
  markCompanies: s.mark ? names(char(o, mark(s)).armies) : null,
  merits: Number(char(o, s.hero)['merits'] ?? 0),
});
const UNSPENT = (s: Staged) => ({
  lesson: [],
  markHp: s.mark ? s.mark.hp : null,
  markCompanies: s.mark ? names(s.mark.armies) : null,
  merits: 0,
});
/** The told() of a line to realm 0 alone that names no province (a refusal before the order reads its ground). */
const toRealm0 = (ph = 0, type = 'system') => ({ type, targets: [0], provinceId: null, public: false, phase: ph });
const refused = (
  name: string,
  skill: string,
  line: (s: Staged) => string,
  stage: (b: Board) => Staged,
  type = 'system',
): WarOrderCase => ({
  name,
  stage,
  check(o, s) {
    return {
      got: { told: told(o, line(s)), ...unspent(o, s, skill) },
      want: { told: toRealm0(0, type), ...UNSPENT(s) },
    };
  },
});

/** A hero of realm 0 in the middle, of `skills`, striking `f` with the order `action` in the first phase; both then
 *  hold. */
const withFoe = (b: Board, action: string, f: Character, skills: Record<string, number>): Staged => {
  const s = master(b, skills, order(action, f.id));
  return { ...s, mark: f, orders: [...s.orders, holds(f)] };
};
// ── Blockade (Naval 7) ──
const blockade = (p: Province) => order('blockade', p.id);
/** An admiral of realm 0 in the middle, of Naval `n`, leading two Galleon Fleets, sent to blockade `p`. */
const admiral = (b: Board, n: number, p: Province, fleets = 2): Staged => {
  const s = master(b, { naval: n }, blockade(p));
  leads(s.hero, [...companies(fleets, 'Galleon Fleet'), ...companies(2)]);
  return { ...s, there: p };
};
/** A sea beside the middle. */
const seaBeside = (b: Board, i = 0) => {
  const p = ring1(b, i);
  p.terrain = 'sea';
  return p;
};
const sealed = (s: Staged) =>
  `⚓ ${s.hero.name} throws a Blockade across ${there(s).name} — enemy fleets may not cross these waters this turn.`;
const notClosed = (s: Staged) =>
  `⚓ ${s.hero.name} tries to blockade ${there(s).name}, but the fleet cannot close the waters in time — no blockade forms this turn.`;
/** A fleet of `player` on the coast beside the sea `p` (not the middle), sent onto it in the second phase. */
const fleetBound = (b: Board, p: Province, player: number) => {
  const coast = must(
    b.nbrs(p).find((q) => q !== b.X && q.terrain !== 'sea'),
    'a coast beside the sea',
  );
  const f = leads(rival(b, { player, at: coast }, { naval: 1 }), companies(1, 'Galleon Fleet'));
  return f;
};
const barred = (f: Character, p: Province) =>
  `${f.name} finds the waters of ${p.name} sealed by an enemy blockade — the crossing is barred this turn.`;
export const BLOCKADE_ORDER_CASES: WarOrderCase[] = [
  refused(
    'below Naval 7: refused',
    'naval',
    (s) => `${s.hero.name} lacks the Naval mastery (7) to raise a Blockade.`,
    (b) => admiral(b, 6, seaBeside(b)),
  ),
  refused(
    'a province that is not a sea: refused',
    'naval',
    (s) => `${s.hero.name}: Blockade must target a sea province.`,
    (b) => admiral(b, 7, ring1(b, 0)),
  ),
  refused(
    'no province named: refused',
    'naval',
    (s) => `${s.hero.name}: Blockade must target a sea province.`,
    (b) => {
      const s = admiral(b, 7, seaBeside(b));
      return { ...s, orders: [one(s.hero, order('blockade'))] };
    },
  ),
  refused(
    'a sea two provinces off: refused',
    'naval',
    (s) => `${s.hero.name}: Blockade must seal a sea province you are in or adjacent to.`,
    (b) => {
      const far = ring2(b, 0);
      far.terrain = 'sea';
      return admiral(b, 7, far);
    },
  ),
  refused(
    'no fleet at his back: refused',
    'naval',
    (s) => `${s.hero.name}: a Blockade must be thrown by a fleet — you lead no naval units or sea creatures.`,
    (b) => admiral(b, 7, seaBeside(b), 0),
  ),
  {
    name: 'the blockade forms (a die under one half): the sea is sealed this turn, and an enemy fleet is barred from it',
    wholeTurnOnly: true,
    dice: LUCKY,
    stage(b) {
      const s = admiral(b, 7, seaBeside(b));
      const f = fleetBound(b, there(s), 1);
      return { ...s, mark: f, orders: [...s.orders, one(f, order('rest'), order('move', there(s).id))] };
    },
    check(o, s) {
      return {
        got: {
          told: told(o, sealed(s)),
          sea: [province(o, there(s))['_blockadeTurn'], province(o, there(s))['_blockadeBy']],
          lesson: xpIn(o, s.hero, 'naval'),
          barred: phasesSaying(o, barred(mark(s), there(s))),
          fleetAt: char(o, mark(s)).location,
        },
        want: {
          told: { type: 'move', targets: [0], provinceId: there(s).id, public: true, phase: 0 },
          sea: [o.turn, 0],
          lesson: [STD],
          barred: [1],
          fleetAt: mark(s).location,
        },
      };
    },
  },
  {
    name: 'a blockade bars only an enemy: an allied fleet crosses',
    wholeTurnOnly: true,
    dice: LUCKY,
    stage(b) {
      const s = admiral(b, 7, seaBeside(b));
      const f = fleetBound(b, there(s), 2);
      return { ...s, mark: f, orders: [...s.orders, one(f, order('rest'), order('move', there(s).id))] };
    },
    check(o, s) {
      return {
        got: {
          sealed: says(o, sealed(s)),
          barred: anySays(o, 'sealed by an enemy blockade'),
          fleetAt: char(o, mark(s)).location,
        },
        want: { sealed: true, barred: false, fleetAt: there(s).id },
      };
    },
  },
  {
    name: 'a fleet may seal the sea it lies on',
    dice: LUCKY,
    stage(b) {
      b.X.terrain = 'sea';
      return admiral(b, 7, b.X);
    },
    check(o, s) {
      return {
        got: { sealed: says(o, sealed(s)), sea: province(o, there(s))['_blockadeBy'] },
        want: { sealed: true, sea: 0 },
      };
    },
  },
  {
    name: 'the blockade fails to form (a die of one half or more): the waters stay open, and he still learns',
    wholeTurnOnly: true,
    stage(b) {
      const s = admiral(b, 9, seaBeside(b));
      const f = fleetBound(b, there(s), 1);
      return { ...s, mark: f, orders: [...s.orders, one(f, order('rest'), order('move', there(s).id))] };
    },
    check(o, s) {
      return {
        got: {
          told: told(o, notClosed(s)),
          sea: province(o, there(s))['_blockadeTurn'],
          lesson: xpIn(o, s.hero, 'naval'),
          fleetAt: char(o, mark(s)).location,
        },
        want: {
          told: { type: 'move', targets: [0], provinceId: there(s).id, public: false, phase: 0 },
          sea: undefined,
          lesson: [STD],
          fleetAt: there(s).id,
        },
      };
    },
  },
];

// ── Challenge (Melee 7) ──
const challenge = (f: Character) => order('challenge', f.id);
/** A champion of realm 0 in the middle, of Melee `n` (and `skills`), who challenges `f`. */
const champion = (b: Board, n: number, f: Character, skills: Record<string, number> = {}): Staged =>
  withFoe(b, 'challenge', f, { melee: n, ...skills });
/** The duel's line: `⚔ <hero> calls <foe> to single combat! <winner> has the better of it — <loser> takes <n> wounds.` */
const duelLine = (s: Staged, winner: Character, loser: Character, wounds: number) =>
  `⚔ ${s.hero.name} calls ${mark(s).name} to single combat! ${winner.name} has the better of it — ${loser.name} takes ${String(wounds)} wounds.`;
/** What a duel leaves: each side's HP and whether he lives, the hero's merits, the purple swords on the ground. */
const afterDuel = (o: Outcome, s: Staged) => ({
  hp: [char(o, s.hero).hp, char(o, mark(s)).hp],
  alive: [char(o, s.hero).alive, char(o, mark(s)).alive],
  merits: Number(char(o, s.hero)['merits'] ?? 0),
  swords: province(o, there(s))['_combatPlayersThisTurn'],
  lesson: xpIn(o, s.hero, 'melee'),
});
export const CHALLENGE_ORDER_CASES: WarOrderCase[] = [
  refused(
    'below Melee 7: refused',
    'melee',
    (s) => `${s.hero.name} lacks the Melee mastery (7) to issue a Challenge.`,
    (b) => champion(b, 6, rival(b)),
  ),
  ...(
    [
      ['an enemy hero not beside him', (b: Board) => rival(b, { at: ring1(b, 0) })],
      ['a hero of his own realm', (b: Board) => at(b)],
      ['a hero who has fallen', (b: Board) => fallen(b, b.X, { player: 1, troops: 0 })],
      ['an enemy hero whose Invisibility holds (R-119)', unseen],
    ] as const
  ).map(([who, foe]) =>
    refused(
      `${who}: no enemy hero to challenge`,
      'melee',
      (s) => `${s.hero.name} finds no enemy hero to challenge in ${there(s).name} this phase.`,
      (b) => champion(b, 7, foe(b)),
    ),
  ),
  refused(
    "an allied realm's hero: no Challenge without war",
    'melee',
    (s) =>
      `${s.hero.name}: you are not at war with ${mark(s).name}'s crown — a Challenge would be an act of war. Declare war first.`,
    (b) => champion(b, 7, rival(b, { player: 2 })),
  ),
  {
    name: 'an enemy at the head of an army will not break off to answer',
    stage(b) {
      return champion(b, 7, foeLeading(b, 1));
    },
    check(o, s) {
      const line = `${mark(s).name} is at the head of an army and will not break off to answer ${s.hero.name}'s Challenge.`;
      return {
        got: { told: told(o, line), ...unspent(o, s, 'melee') },
        want: {
          told: { type: 'combat', targets: [0, 1], provinceId: there(s).id, public: false, phase: 0 },
          ...UNSPENT(s),
        },
      };
    },
  },
  {
    name: 'the better fighter wins: wounds of 8 and one for each 6 points of the gap; two merits; a lesson in Melee',
    stage(b) {
      return champion(b, 7, rival(b));
    },
    check(o, s) {
      // Melee 7 counts as 5 (the effective level stops at 5) against 2: (5 − 2) × 3 = 9 points, so 8 + 1 wounds
      return {
        got: { told: told(o, duelLine(s, s.hero, mark(s), 9)), ...afterDuel(o, s) },
        want: {
          told: { type: 'combat', targets: [0, 1], provinceId: there(s).id, public: true, phase: 0 },
          hp: [20, 11],
          alive: [true, true],
          merits: 2,
          swords: [0, 1],
          lesson: [STD],
        },
      };
    },
  },
  {
    name: 'archery counts as much as melee, and the hero at fuller health has the edge',
    stage(b) {
      const f = rival(b, {}, { melee: 2, archery: 3 });
      f.hp = 14;
      return champion(b, 7, f);
    },
    check(o, s) {
      // (5 + 0) × 3 + 20 = 35 against (2 + 3) × 3 + 14 = 29: 6 points, so 8 + 1 wounds
      return {
        got: { said: says(o, duelLine(s, s.hero, mark(s), 9)), hp: afterDuel(o, s).hp },
        want: { said: true, hp: [20, 5] },
      };
    },
  },
  {
    name: 'an even match goes to the challenger: 8 wounds',
    stage(b) {
      return champion(b, 7, rival(b, {}, { melee: 5 }));
    },
    check(o, s) {
      return {
        got: { said: says(o, duelLine(s, s.hero, mark(s), 8)), hp: afterDuel(o, s).hp, merits: afterDuel(o, s).merits },
        want: { said: true, hp: [20, 12], merits: 2 },
      };
    },
  },
  {
    name: 'the challenger loses: he takes the wounds, and wins no merit',
    stage(b) {
      const s = champion(b, 7, rival(b, {}, { melee: 5 }));
      s.hero.hp = 10;
      s.hero['hpEarned'] = 0;
      s.hero.maxHp = 15;
      return s;
    },
    check(o, s) {
      // 35 + 0 against 15 + 20: no, 5 × 3 + 10 = 25 against 5 × 3 + 20 = 35: 10 points, so 8 + 1 wounds to him
      return {
        got: { said: says(o, duelLine(s, mark(s), s.hero, 9)), hp: afterDuel(o, s).hp, merits: afterDuel(o, s).merits },
        want: { said: true, hp: [1, 20], merits: 0 },
      };
    },
  },
  {
    name: 'a foe beaten to nothing falls in the duel',
    stage(b) {
      const f = rival(b);
      f.hp = 9;
      return champion(b, 7, f);
    },
    check(o, s) {
      return {
        got: {
          fell: told(o, `${mark(s).name} falls in the duel!`),
          alive: afterDuel(o, s).alive,
          merits: afterDuel(o, s).merits,
          kills: duelKills(o, s.hero),
        },
        want: {
          fell: { type: 'combat', targets: [0, 1], provinceId: there(s).id, public: true, phase: 0 },
          alive: [true, false],
          merits: 2,
          kills: 1,
        },
      };
    },
  },
  {
    name: 'a challenger beaten to nothing falls in the duel',
    stage(b) {
      const s = champion(b, 7, rival(b, {}, { melee: 5 }));
      s.hero.hp = 9;
      s.hero.maxHp = 15;
      s.hero['hpEarned'] = 0;
      return s;
    },
    check(o, s) {
      return {
        got: {
          fell: says(o, `${s.hero.name} falls in the duel!`),
          alive: afterDuel(o, s).alive,
          kills: duelKills(o, mark(s)),
        },
        want: { fell: true, alive: [false, true], kills: 1 },
      };
    },
  },
  {
    name: 'a foe who cannot be killed escapes at 1 HP',
    stage(b) {
      const f = rival(b);
      f.hp = 9;
      f['_unkillable'] = true;
      return champion(b, 7, f);
    },
    check(o, s) {
      return {
        got: {
          escaped: told(o, `🍀 ${mark(s).name}`),
          fell: anySays(o, 'falls in the duel'),
          alive: afterDuel(o, s).alive,
          hp: afterDuel(o, s).hp,
        },
        want: {
          escaped: { type: 'combat', targets: [0], provinceId: there(s).id, public: true, phase: 0 },
          fell: false,
          alive: [true, true],
          hp: [20, 1],
        },
      };
    },
  },
  {
    name: 'a wandering hero may be challenged: only the challenger’s realm is told',
    stage(b) {
      return champion(b, 7, wanderer(b));
    },
    check(o, s) {
      return {
        got: { told: told(o, duelLine(s, s.hero, mark(s), 9))?.targets, swords: afterDuel(o, s).swords },
        want: { told: [0], swords: [0] },
      };
    },
  },
  {
    name: 'a Challenge is a mastery: the second one in a turn is refused',
    wholeTurnOnly: true,
    stage(b) {
      const f = rival(b);
      return { ...master(b, { melee: 7 }, challenge(f), challenge(f)), mark: f };
    },
    check(o, s) {
      return {
        got: {
          duels: countSaying(o, `⚔ ${s.hero.name} calls ${mark(s).name} to single combat!`),
          refused: told(
            o,
            `${s.hero.name} has already used their Challenge mastery this turn — it may be commanded but once per turn.`,
          ),
        },
        want: { duels: 1, refused: toRealm0(1) },
      };
    },
  },
];

// ── Rampage (Melee 9) and Rain of Arrows (Archery 7) ──
/** The companies a strike left the foe, by name. */
const leftTo = (o: Outcome, s: Staged) => names(char(o, mark(s)).armies);
export const RAMPAGE_ORDER_CASES: WarOrderCase[] = [
  refused(
    'below Melee 9: refused',
    'melee',
    (s) => `${s.hero.name} lacks the Melee mastery (9) to Rampage.`,
    (b) => withFoe(b, 'rampage', foeLeading(b, 3), { melee: 8 }),
  ),
  ...(
    [
      ['an enemy hero with no army', (b: Board) => rival(b)],
      ['an enemy host not beside him', (b: Board) => foeLeading(b, 3, 1, { at: ring1(b, 0) })],
      ['a host of his own realm', (b: Board) => foeLeading(b, 3, 0)],
    ] as const
  ).map(([who, foe]) =>
    refused(
      `${who}: no enemy force to fall upon`,
      'melee',
      (s) => `${s.hero.name} finds no enemy force to fall upon in ${there(s).name} this phase.`,
      (b) => withFoe(b, 'rampage', foe(b), { melee: 9 }),
      'combat',
    ),
  ),
  refused(
    "an allied realm's host: no Rampage without war",
    'melee',
    (s) =>
      `${s.hero.name}: you are not at war with ${mark(s).name}'s crown — a Rampage would be an act of war. Declare war first.`,
    (b) => withFoe(b, 'rampage', foeLeading(b, 3, 2), { melee: 9 }),
  ),
  {
    name: 'six companies cut down of eight (two and one for each two levels), and their commander bloodied by fifteen',
    stage(b) {
      return withFoe(b, 'rampage', foeLeading(b, 8), { melee: 9 });
    },
    check(o, s) {
      return {
        got: {
          told: told(
            o,
            `🗡 ${s.hero.name} goes on a Rampage through ${mark(s).name}'s ranks — 6 units cut down and their commander bloodied!`,
          ),
          left: leftTo(o, s).length,
          markHp: char(o, mark(s)).hp,
          merits: Number(char(o, s.hero)['merits'] ?? 0),
          lesson: xpIn(o, s.hero, 'melee'),
        },
        want: {
          told: { type: 'combat', targets: [0, 1], provinceId: there(s).id, public: true, phase: 0 },
          left: 2,
          markHp: 5,
          merits: 1,
          lesson: [STD],
        },
      };
    },
  },
  {
    name: 'a wandering host may be fallen upon: no war needed',
    stage(b) {
      return withFoe(b, 'rampage', leads(wanderer(b), companies(3)), { melee: 9 });
    },
    check(o, s) {
      return {
        got: { told: told(o, ' goes on a Rampage through ')?.targets, left: leftTo(o, s) },
        want: { told: [0], left: [] },
      };
    },
  },
  {
    name: 'a host of three is cut down whole',
    stage(b) {
      return withFoe(b, 'rampage', foeLeading(b, 3), { melee: 9 });
    },
    check(o, s) {
      return {
        got: { said: says(o, '— 3 units cut down and their commander bloodied!'), left: leftTo(o, s) },
        want: { said: true, left: [] },
      };
    },
  },
  {
    name: 'one company: "1 unit"; a commander already near death is left at 1 HP, never slain',
    stage(b) {
      const f = foeLeading(b, 1);
      f.hp = 6;
      return withFoe(b, 'rampage', f, { melee: 9 });
    },
    check(o, s) {
      return {
        got: {
          said: says(o, '— 1 unit cut down and their commander bloodied!'),
          markHp: char(o, mark(s)).hp,
          alive: char(o, mark(s)).alive,
        },
        want: { said: true, markHp: 1, alive: true },
      };
    },
  },
];
export const RAIN_OF_ARROWS_ORDER_CASES: WarOrderCase[] = [
  refused(
    'below Archery 7: refused',
    'archery',
    (s) => `${s.hero.name} lacks the Archery mastery (7) for a Rain of Arrows.`,
    (b) => withFoe(b, 'rain_of_arrows', foeLeading(b, 3), { archery: 6 }),
  ),
  ...(
    [
      ['an enemy hero with no army', (b: Board) => rival(b)],
      ['an enemy host not beside him', (b: Board) => foeLeading(b, 3, 1, { at: ring1(b, 0) })],
      ['a host of his own realm', (b: Board) => foeLeading(b, 3, 0)],
    ] as const
  ).map(([who, foe]) =>
    refused(
      `${who}: no enemy force to volley`,
      'archery',
      (s) => `${s.hero.name} finds no enemy force to volley in ${there(s).name} this phase.`,
      (b) => withFoe(b, 'rain_of_arrows', foe(b), { archery: 7 }),
      'combat',
    ),
  ),
  refused(
    "an allied realm's host: no Rain of Arrows without war",
    'archery',
    (s) =>
      `${s.hero.name}: you are not at war with ${mark(s).name}'s crown — a Rain of Arrows would be an act of war. Declare war first.`,
    (b) => withFoe(b, 'rain_of_arrows', foeLeading(b, 3, 2), { archery: 7 }),
  ),
  {
    name: 'four companies fall at Archery 7 (one and one for each two levels); the commander is untouched',
    stage(b) {
      return withFoe(b, 'rain_of_arrows', foeLeading(b, 6), { archery: 7 });
    },
    check(o, s) {
      return {
        got: {
          told: told(
            o,
            `🏹 ${s.hero.name} looses a Rain of Arrows on ${mark(s).name}'s host — 4 units fall to the volley.`,
          ),
          left: leftTo(o, s).length,
          markHp: char(o, mark(s)).hp,
          merits: Number(char(o, s.hero)['merits'] ?? 0),
          lesson: xpIn(o, s.hero, 'archery'),
        },
        want: {
          told: { type: 'combat', targets: [0, 1], provinceId: there(s).id, public: true, phase: 0 },
          left: 2,
          markHp: 20,
          merits: 0,
          lesson: [STD],
        },
      };
    },
  },
  {
    name: 'a wandering host may be volleyed: no war needed',
    stage(b) {
      return withFoe(b, 'rain_of_arrows', leads(wanderer(b), companies(3)), { archery: 7 });
    },
    check(o, s) {
      return {
        got: { told: told(o, ' looses a Rain of Arrows on ')?.targets, left: leftTo(o, s) },
        want: { told: [0], left: [] },
      };
    },
  },
  {
    name: 'five fall at Archery 9',
    stage(b) {
      return withFoe(b, 'rain_of_arrows', foeLeading(b, 6), { archery: 9 });
    },
    check(o, s) {
      return {
        got: { said: says(o, `on ${mark(s).name}'s host — 5 units fall to the volley.`), left: leftTo(o, s).length },
        want: { said: true, left: 1 },
      };
    },
  },
  {
    name: 'one company: "1 unit"',
    stage(b) {
      return withFoe(b, 'rain_of_arrows', foeLeading(b, 1), { archery: 9 });
    },
    check(o, s) {
      return {
        got: { said: says(o, `on ${mark(s).name}'s host — 1 unit fall to the volley.`), left: leftTo(o, s).length },
        want: { said: true, left: 0 },
      };
    },
  },
];

// ── Sniper's Mark (Archery 9) ──
const markLine = (s: Staged, rest: string) => `🎯 ${s.hero.name} takes a Sniper's Mark on ${mark(s).name} — ${rest}`;
export const SNIPERS_MARK_ORDER_CASES: WarOrderCase[] = [
  refused(
    'below Archery 9: refused',
    'archery',
    (s) => `${s.hero.name} lacks the Archery mastery (9) for a Sniper's Mark.`,
    (b) => withFoe(b, 'snipers_mark', rival(b), { archery: 8 }),
  ),
  ...(
    [
      ['an enemy hero not beside him', (b: Board) => rival(b, { at: ring1(b, 0) })],
      ['a hero of his own realm', (b: Board) => at(b)],
      ['an enemy hero whose Invisibility holds (R-119)', unseen],
    ] as const
  ).map(([who, foe]) =>
    refused(
      `${who}: no enemy commander to mark`,
      'archery',
      (s) => `${s.hero.name} finds no enemy commander to mark in ${there(s).name} this phase.`,
      (b) => withFoe(b, 'snipers_mark', foe(b), { archery: 9 }),
    ),
  ),
  refused(
    "an allied realm's hero: no Sniper's Mark without war",
    'archery',
    (s) =>
      `${s.hero.name}: you are not at war with ${mark(s).name}'s crown — a Sniper's Mark would be an act of war. Declare war first.`,
    (b) => withFoe(b, 'snipers_mark', rival(b, { player: 2 }), { archery: 9 }),
  ),
  ...[37, 38].map((roll): WarOrderCase => ({
    name: `17 wounds (8 and his level), and a 37% chance to slay: a roll of ${String(roll)} ${roll <= 37 ? 'slays him' : 'leaves him wounded'}`,
    dice: rollOf(roll),
    stage(b) {
      return withFoe(b, 'snipers_mark', foeLeading(b, 2), { archery: 9 });
    },
    check(o, s) {
      const slain = roll <= 37;
      return {
        got: {
          told: told(o, markLine(s, `17 wounds (37% to slay, roll ${String(roll)}).`)),
          felled: told(o, `${mark(s).name} is felled by the shot!`),
          alive: char(o, mark(s)).alive,
          hp: char(o, mark(s)).hp,
          merits: Number(char(o, s.hero)['merits'] ?? 0),
          lesson: xpIn(o, s.hero, 'archery'),
          kills: duelKills(o, s.hero),
        },
        want: {
          told: { type: 'combat', targets: [0, 1], provinceId: there(s).id, public: true, phase: 0 },
          felled: slain ? { type: 'combat', targets: [0, 1], provinceId: there(s).id, public: true, phase: 0 } : null,
          alive: !slain,
          hp: slain ? 0 : 3,
          merits: slain ? 2 : 0,
          lesson: [STD],
          kills: slain ? 1 : 0,
        },
      };
    },
  })),
  ...[22, 23].map((roll): WarOrderCase => ({
    name: `a king is harder to slay: 22%, so a roll of ${String(roll)} ${roll <= 22 ? 'slays him' : 'leaves him wounded'}`,
    dice: rollOf(roll),
    stage(b) {
      return withFoe(b, 'snipers_mark', rival(b, { king: true }), { archery: 9 });
    },
    check(o, s) {
      return {
        got: {
          said: says(o, markLine(s, `17 wounds (22% to slay, roll ${String(roll)}).`)),
          alive: char(o, mark(s)).alive,
        },
        want: { said: true, alive: roll > 22 },
      };
    },
  })),
  {
    name: 'wounds enough to kill: he falls whatever the roll, and the line names no chance',
    dice: rollOf(100),
    stage(b) {
      const f = rival(b);
      f.hp = 17;
      return withFoe(b, 'snipers_mark', f, { archery: 9 });
    },
    check(o, s) {
      return {
        got: {
          said: says(o, markLine(s, '17 wounds.')),
          felled: says(o, 'is felled by the shot!'),
          alive: char(o, mark(s)).alive,
        },
        want: { said: true, felled: true, alive: false },
      };
    },
  },
  {
    name: 'a wandering hero may be marked: no war needed',
    stage(b) {
      return withFoe(b, 'snipers_mark', wanderer(b), { archery: 9 });
    },
    check(o, s) {
      return {
        got: { told: told(o, " takes a Sniper's Mark on ")?.targets, alive: char(o, mark(s)).alive },
        want: { told: [0], alive: false },
      };
    },
  },
  {
    name: 'a foe who cannot be killed, wounded to nothing, escapes at 1 HP',
    stage(b) {
      const f = rival(b);
      f.hp = 10;
      f['_unkillable'] = true;
      return withFoe(b, 'snipers_mark', f, { archery: 9 });
    },
    check(o, s) {
      return {
        got: { said: says(o, markLine(s, '17 wounds.')), hp: char(o, mark(s)).hp, alive: char(o, mark(s)).alive },
        want: { said: true, hp: 1, alive: true },
      };
    },
  },
  {
    name: 'a foe who cannot be killed escapes: wounded, alive, no merit',
    stage(b) {
      const f = rival(b);
      f['_unkillable'] = true;
      return withFoe(b, 'snipers_mark', f, { archery: 9 });
    },
    check(o, s) {
      return {
        got: {
          escaped: told(o, `🍀 ${mark(s).name}`)?.targets,
          felled: anySays(o, 'is felled by the shot!'),
          hp: char(o, mark(s)).hp,
          merits: Number(char(o, s.hero)['merits'] ?? 0),
        },
        want: { escaped: [0], felled: false, hp: 3, merits: 0 },
      };
    },
  },
];

// ── Feigned Retreat, Grand Stratagem (Tactical 7 and 9) and Lightning Advance (March 9) ──
/** A hero of realm 0 in the middle leading four companies, of `skills`, giving the mastery `action` in the first phase,
 *  then (with `fight`) a battle in the second: an enemy column of one company marching in on him (`attacked`), or he
 *  marching on an enemy column of one company beside him. The enemy falls back to a province of its own. */
const flagThenBattle = (
  b: Board,
  action: string,
  skills: Record<string, number>,
  fight?: 'attacked' | 'attacks',
): Staged => {
  const next = ring1(b, 0);
  const behind = must(
    b.ring2.find((p) => b.nbrs(p).includes(next)),
    'a province two away beside the neighbour',
  );
  b.own(b.X, 0);
  b.own(next, 1);
  b.own(behind, 1); // a beaten foe falls back home, so the battle ends
  const h = leads(at(b, skills), companies(4));
  const f = leads(rival(b, { at: next }), companies(1));
  const orders: [Character, Order[]][] =
    fight === 'attacked'
      ? [one(h, order(action), order('defend')), one(f, order('rest'), order('move', b.X.id))]
      : fight === 'attacks'
        ? [one(h, order(action), order('move', next.id))]
        : [one(h, order(action))];
  return { hero: h, mark: f, orders, there: b.X, places: [next] };
};
const flagCases = (
  action: string,
  label: string,
  skill: string,
  level: number,
  set: (s: Staged) => string,
  type: string,
  flag: string,
  fight: 'attacked' | 'attacks',
  inBattle: (s: Staged) => string,
): WarOrderCase[] => [
  refused(
    `below ${label.split(' ')[0] ?? label} ${String(level)}: refused`,
    skill,
    (s) => `${s.hero.name} lacks the ${label} (${String(level)}) for a ${MASTERY[action] ?? action}.`,
    (b) => flagThenBattle(b, action, { [skill]: level - 1 }),
  ),
  {
    name: 'ordered: told, and marked for this turn, with a lesson',
    stage(b) {
      return flagThenBattle(b, action, { [skill]: level });
    },
    check(o, s) {
      return {
        got: { told: told(o, set(s)), flag: char(o, s.hero)[flag], lesson: xpIn(o, s.hero, skill) },
        want: {
          told: { type, targets: [0], provinceId: there(s).id, public: false, phase: 0 },
          flag: o.turn,
          lesson: [STD],
        },
      };
    },
  },
  {
    name: `a battle later in the turn reads it: ${fight === 'attacked' ? 'the enemy marches in on him' : 'he marches on the enemy'}`,
    wholeTurnOnly: true,
    dice: EVEN,
    stage(b) {
      return flagThenBattle(b, action, { [skill]: level }, fight);
    },
    check(o, s) {
      return { got: { read: phasesSaying(o, inBattle(s)) }, want: { read: [1] } };
    },
  },
  {
    name: 'without the order, the same battle has no such line',
    wholeTurnOnly: true,
    dice: EVEN,
    stage(b) {
      const s = flagThenBattle(b, 'rest', { [skill]: level }, fight);
      return s;
    },
    check(o, s) {
      return {
        got: { read: phasesSaying(o, inBattle(s)), fought: anySays(o, '⚔ **Battle for ') },
        want: { read: [], fought: true },
      };
    },
  },
];
const MASTERY: Record<string, string> = {
  feigned_retreat: 'Feigned Retreat',
  grand_stratagem: 'Grand Stratagem',
  lightning_advance: 'Lightning Advance',
};
export const FEIGNED_RETREAT_ORDER_CASES = flagCases(
  'feigned_retreat',
  'Tactical mastery',
  'tactical',
  7,
  (s) =>
    `🏳 ${s.hero.name} lays a Feigned Retreat — should the enemy take the bait and attack, the counter will strike at +25% strength this turn.`,
  'combat',
  '_feignedRetreatTurn',
  'attacked',
  (s) => `🏳 ${s.hero.name}'s Feigned Retreat springs shut — the counter-attack strikes at +25% strength.`,
);
export const GRAND_STRATAGEM_ORDER_CASES = flagCases(
  'grand_stratagem',
  'Tactical mastery',
  'tactical',
  9,
  (s) => `📜 ${s.hero.name} sets a Grand Stratagem in motion — their next battle this turn is fought at +20% strength.`,
  'combat',
  '_grandStratagemTurn',
  'attacks',
  (s) => `📜 ${s.hero.name} unfolds a Grand Stratagem — the attack lands at +20% strength.`,
);
export const LIGHTNING_ADVANCE_ORDER_CASES = flagCases(
  'lightning_advance',
  'March mastery',
  'march',
  9,
  (s) =>
    `⚡ ${s.hero.name} orders a Lightning Advance — any enemy they attack this turn is caught unready (−20% on the defence).`,
  'move',
  '_lightningAdvanceTurn',
  'attacks',
  (s) => `⚡ ${s.hero.name}'s Lightning Advance catches ${mark(s).name} completely unready`,
);

// ── Raid the Coast (Naval 9) ──
/** A raider of realm 0 on a sea in the middle, of Naval `n`, leading two Galleon Fleets and two companies (none with
 *  `fleets` 0), readying a Raid the Coast, then (with `land`) landing on the enemy's coast beside him, taxed 5. */
const raider = (b: Board, n: number, fleets = 2, land = false): Staged => {
  b.X.terrain = 'sea';
  const coast = ring1(b, 0);
  b.own(coast, 1);
  coast['tax'] = 5;
  realm(b, 0)['alignment'] = 'Good'; // an Evil crown loots a conquest too
  const s = master(b, { naval: n }, order('raid_coast'), ...(land ? [order('move', coast.id)] : []));
  leads(s.hero, [...companies(fleets, 'Galleon Fleet'), ...companies(2)]);
  return { ...s, places: [coast] };
};
const readied = (s: Staged) =>
  `⚓ ${s.hero.name} readies a Raid the Coast — an amphibious assault launched from the sea against a coastal province this turn strikes at +25% strength, and plunders the province treasury if it falls.`;
export const RAID_THE_COAST_ORDER_CASES: WarOrderCase[] = [
  refused(
    'below Naval 9: refused',
    'naval',
    (s) => `${s.hero.name} lacks the Naval mastery (9) to Raid the Coast.`,
    (b) => raider(b, 8),
  ),
  refused(
    'no fleet at his back: refused',
    'naval',
    (s) => `${s.hero.name}: a Raid the Coast must be led by a fleet — you lead no naval units or sea creatures.`,
    (b) => raider(b, 9, 0),
  ),
  {
    name: 'readied: told, and marked for this turn, with a lesson',
    stage(b) {
      return raider(b, 9);
    },
    check(o, s) {
      return {
        got: { told: told(o, readied(s)), flag: char(o, s.hero)['_raidCoastTurn'], lesson: xpIn(o, s.hero, 'naval') },
        want: {
          told: { type: 'move', targets: [0], provinceId: there(s).id, public: false, phase: 0 },
          flag: o.turn,
          lesson: [STD],
        },
      };
    },
  },
  {
    name: 'a landing later in the turn that takes the coast plunders its treasury',
    wholeTurnOnly: true,
    stage(b) {
      return raider(b, 9, 2, true);
    },
    check(o, s) {
      const coast = must(s.places?.[0], 'the coast');
      return {
        got: {
          sacked: told(
            o,
            `💰 ${s.hero.name}'s coastal raid sacks ${coast.name} — 5g plundered from ${realmName(o, 1)}.`,
          ),
          owner: province(o, coast).owner,
        },
        want: { sacked: { type: 'move', targets: [0, 1], provinceId: coast.id, public: true, phase: 1 }, owner: 0 },
      };
    },
  },
  {
    name: 'without the order, the same landing plunders nothing',
    wholeTurnOnly: true,
    stage(b) {
      const s = raider(b, 9, 2, true);
      return { ...s, orders: [one(s.hero, order('rest'), order('move', must(s.places?.[0], 'the coast').id))] };
    },
    check(o, s) {
      return {
        got: { sacked: anySays(o, 'coastal raid sacks'), owner: province(o, must(s.places?.[0], 'the coast')).owner },
        want: { sacked: false, owner: 0 },
      };
    },
  },
];

// ── processOrder's checks before every mastery ──
export const MASTERY_CHECK_CASES: WarOrderCase[] = [
  {
    name: 'a mastery given twice in a turn: the second is refused before it is read',
    wholeTurnOnly: true,
    stage(b) {
      return master(b, { tactical: 9 }, order('grand_stratagem'), order('grand_stratagem'));
    },
    check(o, s) {
      return {
        got: {
          set: phasesSaying(o, `📜 ${s.hero.name} sets a Grand Stratagem in motion`),
          refused: told(
            o,
            `${s.hero.name} has already used their Grand Stratagem mastery this turn — it may be commanded but once per turn.`,
          ),
          lessons: xpIn(o, s.hero, 'tactical'),
        },
        want: { set: [0], refused: toRealm0(1), lessons: [STD] },
      };
    },
  },
  {
    name: 'a mastery refused for want of the skill is still spent for the turn',
    wholeTurnOnly: true,
    stage(b) {
      return master(b, { tactical: 8 }, order('grand_stratagem'), order('grand_stratagem'));
    },
    check(o, s) {
      return {
        got: {
          lacks: phasesSaying(o, `${s.hero.name} lacks the Tactical mastery (9) for a Grand Stratagem.`),
          spent: phasesSaying(o, `${s.hero.name} has already used their Grand Stratagem mastery this turn`),
        },
        want: { lacks: [0], spent: [1] },
      };
    },
  },
  {
    name: 'a charmed enemy hero will not spend his mastery for the crown that holds him',
    wholeTurnOnly: true,
    stage(b) {
      const s = master(b, { tactical: 9 }, order('grand_stratagem'));
      Object.assign(s.hero, { _charmTempControl: true, _charmOriginalPlayer: 1 });
      return s;
    },
    check(o, s) {
      return {
        got: {
          refused: says(
            o,
            `${s.hero.name} is held by an enchantment, not an oath — they will not spend their own mastery for a crown that merely holds their mind. The order comes to nothing.`,
          ),
          set: anySays(o, 'sets a Grand Stratagem in motion'),
        },
        want: { refused: true, set: false },
      };
    },
  },
];

/** Stages `c` on `b`, from plain realms. */
export const stageCase = (b: Board, c: WarOrderCase): Staged => {
  plainRealms(b);
  b.G.players.forEach((pl) => {
    pl['heroes'] = [];
  });
  return c.stage(b);
};

/** Every case, by order (named as the order form names it). */
export const WAR_ORDER_CASES: [string, WarOrderCase[]][] = [
  ['Encounter Character', ENCOUNTER_ORDER_CASES],
  ['Defend', DEFEND_ORDER_CASES],
  ['Blockade', BLOCKADE_ORDER_CASES],
  ['Challenge', CHALLENGE_ORDER_CASES],
  ['Rampage', RAMPAGE_ORDER_CASES],
  ['Rain of Arrows', RAIN_OF_ARROWS_ORDER_CASES],
  ["Sniper's Mark", SNIPERS_MARK_ORDER_CASES],
  ['Feigned Retreat', FEIGNED_RETREAT_ORDER_CASES],
  ['Grand Stratagem', GRAND_STRATAGEM_ORDER_CASES],
  ['Lightning Advance', LIGHTNING_ADVANCE_ORDER_CASES],
  ['Raid the Coast', RAID_THE_COAST_ORDER_CASES],
  ['Any war mastery (the checks before it)', MASTERY_CHECK_CASES],
];
