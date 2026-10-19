// Diplomacy resolution and victory (plan P1-08k4, two stages of resolveTurn's own body lifted out): what the turn
// settles once its seasons are over and the bots have spoken, staged on the middle of a bot world
// (lib/middle-of-a-bot-world.ts), from plain realms, each with what must be true after it in game terms.
// Diplomacy: the declarations the realms sent with this turn's orders take effect. A realm offered a Treat is told of the
// overture, and has met the realm that sent it; a mutual Treat makes peace between enemies, or an alliance between
// realms at peace (never in a game of three realms or fewer); any declaration of war makes both realms enemies, but
// breaking an alliance leaves them at peace; an overture not answered in kind changes nothing, and its sender is told
// so; a new war warns both realms of every host standing on the foe's ground, or beside his host.
// Victory: a king may call the Reckoning from turn 10 if his bloc holds the bar (raised by every ally) and his own realm
// half of it; a claim stands for two turns, then the world is judged, unless the bloc falls below the bar or the
// claimant below half of it; while no claim stands the bar erodes from turn 15, to a floor. The game also ends when
// only one realm holds land or a living hero (elimination), or when every realm still in the game but one has conceded
// (or those left are all allies); the result is announced once, with the Legacy standings.
// scenario/diplomacy-and-victory-in-a-whole-turn.test.ts plays each through a whole turn (resolveTurn);
// unit/diplomacy-and-victory-called-directly.test.ts calls the stages directly on the staged world. A case stages its
// world, the heroes' orders and what each realm sends beside them; after the turn, it reads what it needs from the
// world and the log (`got`) beside what must be so (`want`), and the test compares the two. Every outcome is certain:
// every case fixes the dice for the whole turn (LANDS), though neither stage rolls any. By default every realm has met
// every other, realms 0 and 1 are at war, 0 and 2 allied, 1 and 2 at peace (and a fourth realm at peace with all), and
// each realm holds one province (its seat) with a tax of 10, every other province none, so a realm's share of the
// world is exactly what the case gives it.
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
  type World,
} from './middle-of-a-bot-world.ts';
import { companies } from './item-and-army-order-cases.ts';
import { withCaseDice, type Dice } from './espionage-order-cases.ts';
import { at, leads, realm } from './cast-spell-order-cases.ts';
import { plainRealms } from './recruit-hire-and-realm-works-order-cases.ts';
import { holdsOnly } from './early-winter-cases.ts';
import { LANDS } from './war-order-cases.ts';

export { LANDS };
export interface Staged {
  /** Every hero given orders, with them (none: every hero Rests). */
  orders: [Character, Order[]][];
  /** What each realm sends beside its orders (none: nothing). */
  sends: Record<number, RealmSends>;
  /** The hero the case is about, if one. */
  hero?: Character;
  /** Other heroes the case needs. */
  others?: Character[];
  /** The province the case is about. */
  there?: Province;
}
export interface Outcome {
  world: World;
  /** Every line in the log. */
  all: Line[];
  /** The turn the orders were played in. */
  turn: number;
}
export interface DiplomacyAndVictoryCase {
  name: string;
  /** How many realms the world has (default 3): an alliance can be made only among four or more. */
  realms?: 3 | 4;
  /** Plays only in a whole turn: what the turn does before the phases makes what the case is about (an Evil realm's
   *  war without warning). */
  wholeTurnOnly?: boolean;
  /** The dice for the whole turn (default LANDS). */
  dice?: Dice;
  stage(b: Board): Staged;
  /** What the case found after the turn, and what it should have found: the same keys. */
  check(o: Outcome, s: Staged): { got: Record<string, unknown>; want: Record<string, unknown> };
}

/** Plays `c`, staged as `s` on `b`, through a whole turn, with the case's dice. */
export const playCase = (b: Board, c: DiplomacyAndVictoryCase, s: Staged): Outcome => {
  const result = withCaseDice(b.engine, c.dice ?? LANDS, () =>
    playTurn(b, Object.fromEntries(s.orders.map(([h, os]) => [h.id, os])), {}, [], s.sends),
  );
  return { world: result.after, all: result.lines, turn: b.G.turn };
};

// ── Staging ──────────────────────────────────────────────────────────────────────────────────────────────────────
type Raw = Record<string, unknown>;
const raw = (b: Board) => b.G as unknown as Raw;
/** Realm `pi`'s seat: the province it holds (two provinces out from the middle, three apart round the ring). */
export const seatOf = (b: Board, pi: number) => must(b.ring2[pi * 3], 'a seat for realm ' + String(pi));
/** Each realm holds only its seat, with the tax given (in realm order; a realm not given one: none); every other
 *  province in the world has none, so a realm's share of the world's tax base is its tax over their sum. */
export const taxes = (b: Board, ...tax: number[]) => {
  b.G.world.provinces.forEach((p) => {
    p['tax'] = 0;
  });
  b.G.players.forEach((pl, pi) => {
    holdsOnly(b, pi, [seatOf(b, pi), tax[pi] ?? 0]);
    pl['homeProvinceId'] = seatOf(b, pi).id;
  });
};
/** Realm `pi` holds no land at all. */
export const landless = (b: Board, pi: number) => {
  holdsOnly(b, pi);
};
/** The relations between the realms: exactly those given, every other pair at peace. */
export const relate = (b: Board, rel: Record<string, 'enemy' | 'allied'>) => {
  b.G.relations = { ...rel };
};
/** Realm `a` has not met realm `x`. */
export const unmet = (b: Board, a: number, x: number) => {
  realm(b, a)['_encountered'] = ((realm(b, a)['_encountered'] as number[] | undefined) ?? []).filter((i) => i !== x);
};
/** The turn being played. */
export const turnIs = (b: Board, t: number) => {
  b.G.turn = t;
};
/** A king of realm `pi` (default 0) in its seat, with no skill a title counts (so no hero holds a title). */
export const king = (b: Board, pi = 0) =>
  at(b, { melee: 0, tactical: 0, march: 0 }, { player: pi, king: true, at: seatOf(b, pi) });
/** A hero of realm `pi` leading `n` companies in `p`, with no skill a title counts. */
export const host = (b: Board, pi: number, p: Province, n: number) =>
  leads(
    at(b, { melee: 0, tactical: 0, march: 0 }, { player: pi, at: p }),
    companies(n, 'Men-at-Arms', 'Average', 'Host ' + String(pi)),
  );
/** A claim to the throne lodged two turns before `judgedAt` by realm `by` and its bloc, judged at the end of turn
 *  `judgedAt`, at the bar `thrPct` (none: an old save's claim, which carries no bar). */
export const claim = (b: Board, by: number, bloc: number[], judgedAt: number, thrPct?: number) => {
  raw(b)['reckoning'] = {
    by,
    bloc,
    calledTurn: judgedAt - 2,
    resolveAtTurn: judgedAt,
    ...(thrPct === undefined ? {} : { thrPct }),
  };
};
/** The bar has eroded `n` steps already. */
export const eroded = (b: Board, n: number) => {
  raw(b)['reckoningDecaySteps'] = n;
};
/** Realm `pi` conceded on an earlier turn. */
export const concededBefore = (b: Board, pi: number) => {
  Object.assign(realm(b, pi), { conceded: true, concededTurn: b.G.turn - 1 });
};
/** A game decided on an earlier turn (announced, or not yet: an older save), with its standings. */
export const decidedBefore = (b: Board, result: Raw) => {
  raw(b)['gameOver'] = { turn: b.G.turn - 1, ...result };
};
/** Nothing staged but what the realms send. */
const sending = (sends: Record<number, RealmSends> = {}): Staged => ({ orders: [], sends });
const hero = (s: Staged) => must(s.hero, 'the hero');
const other = (s: Staged, i: number) => must(s.others?.[i], 'hero ' + String(i));
const there = (s: Staged) => must(s.there, 'the province');
/** Five Defend orders: a hero who stays where he stands. */
const stays = (c: Character): [Character, Order[]] => [c, Array.from({ length: 5 }, () => order('defend'))];

// ── Reading the outcome ──────────────────────────────────────────────────────────────────────────────────────────
const realmOf = (o: Outcome, pi: number) => must(o.world.players[pi], 'realm ' + String(pi));
/** Realm `pi`'s name. */
export const nm = (o: Outcome, pi: number) => realmOf(o, pi).name;
/** The relation between realms `a` and `x` after the turn. */
export const relation = (o: Outcome, a: number, x: number) =>
  o.world.relations[a < x ? `${String(a)}-${String(x)}` : `${String(x)}-${String(a)}`] ?? 'neutral';
/** The overtures realm `pi` was offered this turn and has not answered, as its Diplomacy card reads them. */
export const overturesIn = (o: Outcome, pi: number) => realmOf(o, pi)['_overturesIn'];
/** Whom realm `pi` has met. */
export const met = (o: Outcome, pi: number) =>
  [...((realmOf(o, pi)['_encountered'] as number[] | undefined) ?? [])].sort();
const STAGE_LINE =
  /^(🕊 |⚔ War now stands|🤝 |💔 |⚠ War front: |👑 THE RECKONING|🏆 |⏳ |The claim to the throne collapses|Only a king may call)| calls for the Reckoning|went unanswered this year|both sought an alliance|^ {3}\d+\. .* Legacy/;
/** Every line the two stages wrote, in order: whom it is told to, and what it says. */
export const said = (o: Outcome) =>
  o.all.filter((l) => l.phase === 99 && STAGE_LINE.test(l.text)).map((l) => [l.targets ?? null, l.text] as const);
/** The first line saying exactly `text`, as the reports read it: its kind, who acts and who is told, its province and
 *  hero, whether it is public, a system line or the game's end, its phase (null if no line says it). */
export const meta = (o: Outcome, text: string) => {
  const l = o.all.find((x) => x.text === text);
  return l
    ? {
        type: l.type,
        actor: l.actor ?? null,
        targets: l.targets ?? null,
        provinceId: l.provinceId,
        charId: l.charId,
        public: !!l['public'],
        system: !!l['system'],
        gameEnd: !!l['gameEnd'],
        phase: l.phase,
      }
    : null;
};
/** What a line of these stages looks like (`meta`): a system line told to `targets`, after the phases, with what isn't
 *  given as the line writes it. */
export const systemLine = (targets: number[], x: Partial<NonNullable<ReturnType<typeof meta>>> = {}) => ({
  type: 'system',
  actor: null,
  targets,
  provinceId: null,
  charId: null,
  public: false,
  system: true,
  gameEnd: false,
  phase: 99,
  ...x,
});
/** The claim to the throne after the turn (null: none). */
export const claimAfter = (o: Outcome) => (o.world as unknown as Raw)['reckoning'] ?? null;
/** The game's result after the turn, without its standings (null: the game goes on). */
export const result = (o: Outcome) => {
  const g = (o.world as unknown as Raw)['gameOver'] as Raw | undefined;
  if (!g) return null;
  return Object.fromEntries(Object.entries(g).filter(([k]) => k !== 'standings'));
};
/** The realms of the result's standings, by name, with their Legacy, in realm order. */
export const standings = (o: Outcome) =>
  (((o.world as unknown as Raw)['gameOver'] as Raw | undefined)?.['standings'] as Raw[] | undefined)?.map((st) => [
    st['name'],
    st['score'],
  ]) ?? null;
/** Steps the bar has eroded after the turn. */
export const erosion = (o: Outcome) => ((o.world as unknown as Raw)['reckoningDecaySteps'] ?? 0) as number;

// ── Diplomacy's lines ────────────────────────────────────────────────────────────────────────────────────────────
export const peace = (na: string, nb: string) =>
  `🕊 ${na} and ${nb} have made peace and are now NEUTRAL — neither may march an army across the other's border.`;
export const war = (na: string, nb: string) =>
  `⚔ War now stands between ${na} and ${nb}. Their armies may cross the frontier and give battle.`;
export const allied = (x: string, y: string) =>
  `🤝 ${x} and ${y} are now ALLIED — your armies may pass freely through one another's lands and will never come to blows.`;
export const broken = (breaker: string, both: boolean, na: string, nb: string) =>
  `💔 ${breaker} ${both ? 'have' : 'has'} broken the alliance between ${na} and ${nb} — the two realms are NEUTRAL once more. Neither may march an army across the other's border; a further declaration of war would open hostilities.`;
export const overture = (from: string, word: 'peace' | 'an alliance', answered: boolean) =>
  `🕊 ${from} has sent you an overture of ${word}.${answered ? ' You answered in kind.' : ` Declare a Treat toward ${from} with next turn's orders to answer it.`}`;
export const unanswered = (from: string, kind: 'peace' | 'alliance', to: string) =>
  `${from}'s overture of ${kind} to ${to} went unanswered this year — relations are unchanged.`;
export const blocked = (x: string, y: string) =>
  `${x} and ${y} both sought an alliance, but no alliances may be forged in a realm of so few kings — the pact cannot be sealed.`;
const units = (n: number) => `${String(n)} unit${n !== 1 ? 's' : ''}`;
/** The war-front warning to the host's own realm. */
export const frontOwn = (c: Character, n: number, p: Province, onFoeLand: boolean, foe: string) =>
  `⚠ War front: ${c.name}'s host (${units(n)}) stands in ${p.name}, ${onFoeLand ? `land of ${foe}` : `face to face with a host of ${foe}`}. If it is still there at the end of next Spring it will give battle for the province — march it out in Spring to avoid the fight, or reinforce it.`;
/** The war-front warning to the foe. */
export const frontFoe = (c: Character, own: string, n: number, p: Province, onFoeLand: boolean) =>
  `⚠ War front: ${c.name} (${own}) holds a host of ${units(n)} ${onFoeLand ? `inside your province of ${p.name}` : `beside your host in ${p.name}`}. Unless it withdraws, it will attack at the end of next Spring — reinforce ${p.name}, or keep a general on Defend next door to ride in.`;
/** A line told to each of two realms, in turn. */
const toEach = (a: number, x: number, text: string) => [
  [[a], text],
  [[x], text],
];

// ── Victory's lines ──────────────────────────────────────────────────────────────────────────────────────────────
export const tooEarly = (n: string) =>
  `${n} calls for the Reckoning, but the throne cannot be claimed before Turn 10 — the realms are barely settled and the world will not yet be judged. The claim may be lodged again from that turn.`;
export const ONLY_A_KING = 'Only a king may call the Reckoning.';
export const short = (n: string, share: number, bar: number) =>
  `${n} calls for the Reckoning, but commands only ${String(share)}% of the world — short of the ${String(bar)}% needed to press the claim.`;
export const passenger = (n: string, own: number, least: number, bar: number) =>
  `${n} calls for the Reckoning on the strength of their alliance, but their OWN realm commands only ${String(own)}% of the world — a claimant must personally hold at least ${String(least)}% (half the ${String(bar)}% bar) to press the claim. The throne is not won by riding a stronger ally's coat-tails; let the bloc's greatest realm lodge it.`;
export const called = (n: string, allies: string[], share: number, bar: number, judgedAt: number) =>
  `👑 THE RECKONING IS CALLED. ${n}${allies.length ? ` and their allies (${allies.join(', ')})` : ''} lay claim to the vacant Imperial throne, commanding ${String(share)}% of the world${allies.length ? ` — a bar of ${String(bar)}%, raised by ${String(allies.length)} all${allies.length === 1 ? 'y' : 'ies'} standing with the claim` : ''}. The realms have TWO turns to contest it — drive ${n}'s bloc below ${String(bar)}% and the claim collapses. Otherwise the world is judged at the end of Turn ${String(judgedAt)}.`;
export const collapses = (n: string, share: number, bar: number) =>
  `The claim to the throne collapses — ${n}'s bloc no longer commands the world (${String(share)}% < ${String(bar)}%). The Reckoning is called off; the war goes on.`;
export const cutDown = (n: string, own: number, least: number) =>
  `The claim to the throne collapses — ${n} has been cut down to ${String(own)}% of the world in their own right, beneath the ${String(least)}% a claimant must personally hold. Their allies still stand, but the claim was theirs to carry and they can no longer carry it. The Reckoning is called off; the war goes on.`;
export const weary = (after: number, before: number, step: number) =>
  `⏳ The world grows weary of the long war. No throne has been claimed, and the crown's price falls: a realm standing alone now needs only ${String(after)}% of the world's tax base to Call the Reckoning — down from ${String(before)}%. (A claim carried by allies still costs ${String(step)} points more for every ally standing with it.)${after <= 25 ? ' It will fall no further.' : ' It will fall another 5% at the end of next turn.'}`;
export const byConcession = (out: number, one: boolean) =>
  `👑 THE RECKONING IS CALLED — ${String(out)} realm${out !== 1 ? 's have' : ' has'} conceded and ${one ? 'only one crown still contests the world' : 'the last crowns standing are sworn to one another'}. The throne is settled here and now; the Legacy of every realm, titles and relics counted, is set down below.`;
export const RUINS = 'the last realm standing in a world of ruins';
export const ALL_CONCEDED = 'the last crown still contesting the world — every rival has conceded';
export const JUDGED = 'judged supreme at the Reckoning';
export const decided = (who: string, how: string) => `🏆 THE GAME IS DECIDED — ${who} is ${how}!`;
/** A line of the final standings: place, realm, Legacy, and the titles (as labelled) and relics it holds. */
export const standing = (place: number, n: string, score: number, titles: string[] = [], relics = 0) => {
  const held = titles.join(', ');
  const relicText = relics ? `${titles.length ? ', ' : ''}${String(relics)} relic${relics !== 1 ? 's' : ''}` : '';
  return `   ${String(place)}. ${n} — ${String(score)} Legacy${held || relicText ? ` (${held}${relicText})` : ''}`;
};
/** The announcement, told to every realm: who won and how, then the standings, realm `top` first with the richest seat
 *  (the Throne and the Vaultkeeper, 30 Legacy), every other realm at 0 after it, in realm order. */
export const announced = (o: Outcome, who: string, how: string, top: number) => [
  [[], decided(who, how)],
  [[], standing(1, nm(o, top), 30, ['Throne', 'Vaultkeeper'])],
  ...o.world.players
    .map((_, i) => i)
    .filter((i) => i !== top)
    .map((i, k) => [[], standing(k + 2, nm(o, i), 0)]),
];
/** The standings as the result keeps them: realm `top` 30, the rest 0, in realm order. */
const topOf = (o: Outcome, top: number) => o.world.players.map((p, i) => [p.name, i === top ? 30 : 0]);

// ── Peace and war ────────────────────────────────────────────────────────────────────────────────────────────────
export const PEACE_AND_WAR_CASES: DiplomacyAndVictoryCase[] = [
  {
    name: 'realms at war that both send a Treat make peace, each told, and nobody is told of an overture',
    stage: () => sending({ 0: { diplomacy: { 1: 'treat' } }, 1: { diplomacy: { 0: 'treat' } } }),
    check(o) {
      const t = peace(nm(o, 0), nm(o, 1));
      return {
        got: { relation: relation(o, 0, 1), said: said(o), line: meta(o, t), overtures: overturesIn(o, 1) },
        want: { relation: 'neutral', said: toEach(0, 1, t), line: systemLine([0]), overtures: [] },
      };
    },
  },
  {
    name: 'a war declared on a realm at peace makes both enemies, and each is told',
    stage: () => sending({ 1: { diplomacy: { 2: 'enemy' } } }),
    check(o) {
      const t = war(nm(o, 1), nm(o, 2));
      return {
        got: { relation: relation(o, 1, 2), said: said(o), line: meta(o, t) },
        want: { relation: 'enemy', said: toEach(1, 2, t), line: systemLine([1]) },
      };
    },
  },
  {
    name: 'a war declared by the later realm of a pair is told the same way, the earlier realm named first',
    stage: () => sending({ 2: { diplomacy: { 1: 'enemy' } } }),
    check(o) {
      return {
        got: { relation: relation(o, 1, 2), said: said(o) },
        want: { relation: 'enemy', said: toEach(1, 2, war(nm(o, 1), nm(o, 2))) },
      };
    },
  },
  {
    name: 'war declared by both realms of a pair is one war, told once to each',
    stage: () => sending({ 1: { diplomacy: { 2: 'enemy' } }, 2: { diplomacy: { 1: 'enemy' } } }),
    check(o) {
      return {
        got: { relation: relation(o, 1, 2), said: said(o) },
        want: { relation: 'enemy', said: toEach(1, 2, war(nm(o, 1), nm(o, 2))) },
      };
    },
  },
  {
    name: 'war declared on a realm already at war changes nothing, and nobody is told',
    stage: () => sending({ 0: { diplomacy: { 1: 'enemy' } } }),
    check(o) {
      return { got: { relation: relation(o, 0, 1), said: said(o) }, want: { relation: 'enemy', said: [] } };
    },
  },
  {
    name: 'a Treat sent to an enemy alone: the enemy is told of an overture of peace it may answer next turn, and the sender that it went unanswered',
    stage: () => sending({ 0: { diplomacy: { 1: 'treat' } } }),
    check(o) {
      const offer = overture(nm(o, 0), 'peace', false);
      const back = unanswered(nm(o, 0), 'peace', nm(o, 1));
      return {
        got: {
          relation: relation(o, 0, 1),
          said: said(o),
          offer: meta(o, offer),
          back: meta(o, back),
          overtures: overturesIn(o, 1),
          sender: overturesIn(o, 0),
        },
        want: {
          relation: 'enemy',
          said: [
            [[1], offer],
            [[0], back],
          ],
          offer: systemLine([1]),
          back: systemLine([0]),
          overtures: [{ from: 0, kind: 'peace' }],
          sender: [],
        },
      };
    },
  },
  {
    name: 'a Treat sent by the later realm of a pair alone: the earlier realm is offered peace, the later told it went unanswered',
    stage: () => sending({ 1: { diplomacy: { 0: 'treat' } } }),
    check(o) {
      return {
        got: { relation: relation(o, 0, 1), said: said(o), overtures: overturesIn(o, 0) },
        want: {
          relation: 'enemy',
          said: [
            [[0], overture(nm(o, 1), 'peace', false)],
            [[1], unanswered(nm(o, 1), 'peace', nm(o, 0))],
          ],
          overtures: [{ from: 1, kind: 'peace' }],
        },
      };
    },
  },
  {
    name: 'a Treat answered by war again: the enemy is offered peace, the sender told it went unanswered, and the war goes on',
    stage: () => sending({ 0: { diplomacy: { 1: 'treat' } }, 1: { diplomacy: { 0: 'enemy' } } }),
    check(o) {
      return {
        got: { relation: relation(o, 0, 1), said: said(o), overtures: overturesIn(o, 1) },
        want: {
          relation: 'enemy',
          said: [
            [[1], overture(nm(o, 0), 'peace', false)],
            [[0], unanswered(nm(o, 0), 'peace', nm(o, 1))],
          ],
          overtures: [{ from: 0, kind: 'peace' }],
        },
      };
    },
  },
  {
    name: 'a realm offered peace by a realm it had never met has met it now, and can answer',
    stage(b) {
      unmet(b, 1, 0);
      return sending({ 0: { diplomacy: { 1: 'treat' } } });
    },
    check(o) {
      return {
        got: { met: met(o, 1), overtures: overturesIn(o, 1) },
        want: { met: [0, 2], overtures: [{ from: 0, kind: 'peace' }] },
      };
    },
  },
  {
    name: 'a declaration toward a realm the sender has never met is dropped: no war, no overture, nobody told',
    stage(b) {
      unmet(b, 1, 2);
      unmet(b, 0, 1);
      return sending({ 1: { diplomacy: { 2: 'enemy' } }, 0: { diplomacy: { 1: 'treat' } } });
    },
    check(o) {
      return {
        got: { war: relation(o, 1, 2), peace: relation(o, 0, 1), said: said(o), overtures: overturesIn(o, 1) },
        want: { war: 'neutral', peace: 'enemy', said: [], overtures: [] },
      };
    },
  },
  {
    name: 'a declaration that is neither a Treat nor war is ignored',
    stage: () =>
      sending({
        0: { diplomacy: { 1: 'peace' as 'treat' } },
        1: { diplomacy: { 0: 'neutral' as 'treat', 2: 'war' as 'enemy' } },
      }),
    check(o) {
      return {
        got: { relations: { ...o.world.relations }, said: said(o) },
        want: { relations: { '0-1': 'enemy', '0-2': 'allied' }, said: [] },
      };
    },
  },
  {
    name: 'in a game of three, a Treat to a realm at peace is dropped: no alliance can come of it, and nobody is told',
    stage: () => sending({ 1: { diplomacy: { 2: 'treat' } }, 2: { diplomacy: { 1: 'treat' } } }),
    check(o) {
      return {
        got: { relation: relation(o, 1, 2), said: said(o), overtures: [overturesIn(o, 1), overturesIn(o, 2)] },
        want: { relation: 'neutral', said: [], overtures: [[], []] },
      };
    },
  },
  {
    name: "each pair is settled on its own, the earlier realms' pairs first",
    stage: () => sending({ 0: { diplomacy: { 1: 'treat' } }, 1: { diplomacy: { 0: 'treat', 2: 'enemy' } } }),
    check(o) {
      return {
        got: { relations: { ...o.world.relations }, said: said(o) },
        want: {
          relations: { '0-2': 'allied', '1-2': 'enemy' },
          said: [...toEach(0, 1, peace(nm(o, 0), nm(o, 1))), ...toEach(1, 2, war(nm(o, 1), nm(o, 2)))],
        },
      };
    },
  },
  {
    name: "last turn's overtures are forgotten: a realm's Diplomacy card shows only this turn's",
    stage(b) {
      realm(b, 1)['_overturesIn'] = [{ from: 2, kind: 'alliance' }];
      return sending();
    },
    check(o) {
      return {
        got: { overtures: o.world.players.map((p) => p['_overturesIn']) },
        want: { overtures: [[], [], []] },
      };
    },
  },
];

// ── Alliances ────────────────────────────────────────────────────────────────────────────────────────────────────
export const ALLIANCE_CASES: DiplomacyAndVictoryCase[] = [
  {
    name: 'in a game of four, realms at peace that both send a Treat become allies, each told with its own name first',
    realms: 4,
    stage: () => sending({ 1: { diplomacy: { 3: 'treat' } }, 3: { diplomacy: { 1: 'treat' } } }),
    check(o) {
      const ours = allied(nm(o, 1), nm(o, 3));
      return {
        got: { relation: relation(o, 1, 3), said: said(o), line: meta(o, ours), overtures: overturesIn(o, 3) },
        want: {
          relation: 'allied',
          said: [
            [[1], ours],
            [[3], allied(nm(o, 3), nm(o, 1))],
          ],
          line: systemLine([1]),
          overtures: [],
        },
      };
    },
  },
  {
    name: 'in a game of four, a Treat to a realm at peace alone: it is offered an alliance, and the sender told it went unanswered',
    realms: 4,
    stage: () => sending({ 3: { diplomacy: { 1: 'treat' } } }),
    check(o) {
      return {
        got: { relation: relation(o, 1, 3), said: said(o), overtures: overturesIn(o, 1) },
        want: {
          relation: 'neutral',
          said: [
            [[1], overture(nm(o, 3), 'an alliance', false)],
            [[3], unanswered(nm(o, 3), 'alliance', nm(o, 1))],
          ],
          overtures: [{ from: 3, kind: 'alliance' }],
        },
      };
    },
  },
  {
    name: 'in a game of four, an offer of alliance answered by war: the realm offered is told of it, then war stands between them',
    realms: 4,
    stage: () => sending({ 1: { diplomacy: { 3: 'treat' } }, 3: { diplomacy: { 1: 'enemy' } } }),
    check(o) {
      return {
        got: { relation: relation(o, 1, 3), said: said(o), overtures: overturesIn(o, 3) },
        want: {
          relation: 'enemy',
          said: [[[3], overture(nm(o, 1), 'an alliance', false)], ...toEach(1, 3, war(nm(o, 1), nm(o, 3)))],
          overtures: [{ from: 1, kind: 'alliance' }],
        },
      };
    },
  },
  {
    name: 'in a game of four, allies who both send a Treat (the portal offers none) are told they answered in kind and that it went unanswered; nothing changes',
    realms: 4,
    stage: () => sending({ 0: { diplomacy: { 2: 'treat' } }, 2: { diplomacy: { 0: 'treat' } } }),
    check(o) {
      return {
        got: { relation: relation(o, 0, 2), said: said(o), overtures: [overturesIn(o, 0), overturesIn(o, 2)] },
        want: {
          relation: 'allied',
          said: [
            [[2], overture(nm(o, 0), 'an alliance', true)],
            [[0], overture(nm(o, 2), 'an alliance', true)],
            [[0], unanswered(nm(o, 0), 'alliance', nm(o, 2))],
            [[2], unanswered(nm(o, 2), 'alliance', nm(o, 0))],
          ],
          overtures: [[], []],
        },
      };
    },
  },
  {
    name: 'in a game of three, allies who both send a Treat are told no alliance may be forged among so few kings',
    stage: () => sending({ 0: { diplomacy: { 2: 'treat' } }, 2: { diplomacy: { 0: 'treat' } } }),
    check(o) {
      const ours = blocked(nm(o, 0), nm(o, 2));
      return {
        got: { relation: relation(o, 0, 2), said: said(o), line: meta(o, ours) },
        want: {
          relation: 'allied',
          said: [
            [[2], overture(nm(o, 0), 'an alliance', true)],
            [[0], overture(nm(o, 2), 'an alliance', true)],
            [[0], ours],
            [[2], blocked(nm(o, 2), nm(o, 0))],
          ],
          line: systemLine([0]),
        },
      };
    },
  },
  {
    name: 'an ally that declares war breaks the alliance: the two are at peace again, each told who broke it',
    stage: () => sending({ 0: { diplomacy: { 2: 'enemy' } } }),
    check(o) {
      const t = broken(nm(o, 0), false, nm(o, 0), nm(o, 2));
      return {
        got: { relation: relation(o, 0, 2), kept: '0-2' in o.world.relations, said: said(o), line: meta(o, t) },
        want: { relation: 'neutral', kept: false, said: toEach(0, 2, t), line: systemLine([0]) },
      };
    },
  },
  {
    name: 'the later realm of a pair breaking the alliance is the one named',
    stage: () => sending({ 2: { diplomacy: { 0: 'enemy' } } }),
    check(o) {
      return {
        got: { relation: relation(o, 0, 2), said: said(o) },
        want: { relation: 'neutral', said: toEach(0, 2, broken(nm(o, 2), false, nm(o, 0), nm(o, 2))) },
      };
    },
  },
  {
    name: 'both allies declaring war on each other: "have broken", both named',
    stage: () => sending({ 0: { diplomacy: { 2: 'enemy' } }, 2: { diplomacy: { 0: 'enemy' } } }),
    check(o) {
      const both = `${nm(o, 0)} and ${nm(o, 2)}`;
      return {
        got: { relation: relation(o, 0, 2), said: said(o) },
        want: { relation: 'neutral', said: toEach(0, 2, broken(both, true, nm(o, 0), nm(o, 2))) },
      };
    },
  },
  {
    name: 'an ally that declares war while the other sends a Treat still breaks the alliance, and is told of the offer first',
    stage: () => sending({ 0: { diplomacy: { 2: 'enemy' } }, 2: { diplomacy: { 0: 'treat' } } }),
    check(o) {
      return {
        got: { relation: relation(o, 0, 2), said: said(o), overtures: overturesIn(o, 0) },
        want: {
          relation: 'neutral',
          said: [
            [[0], overture(nm(o, 2), 'an alliance', false)],
            ...toEach(0, 2, broken(nm(o, 0), false, nm(o, 0), nm(o, 2))),
          ],
          overtures: [{ from: 2, kind: 'alliance' }],
        },
      };
    },
  },
  {
    name: 'an Evil realm that breaks an alliance is at war from the first season, and nothing more is said after the phases',
    wholeTurnOnly: true,
    stage(b) {
      realm(b, 0)['alignment'] = 'Evil';
      return sending({ 0: { diplomacy: { 2: 'enemy' } } });
    },
    check(o) {
      return {
        got: {
          relation: relation(o, 0, 2),
          said: said(o),
          early: o.all.filter((l) => l.text.includes('marches without warning')).length,
        },
        want: { relation: 'enemy', said: [], early: 1 },
      };
    },
  },
];

// ── War fronts ───────────────────────────────────────────────────────────────────────────────────────────────────
export const WAR_FRONT_CASES: DiplomacyAndVictoryCase[] = [
  {
    name: "a new war warns both realms of a host standing on the foe's land: its own realm to march it out, the foe of the attack to come",
    stage(b) {
      const h = host(b, 1, seatOf(b, 2), 2);
      return { ...sending({ 1: { diplomacy: { 2: 'enemy' } } }), orders: [stays(h)], hero: h, there: seatOf(b, 2) };
    },
    check(o, s) {
      const own = frontOwn(hero(s), 2, there(s), true, nm(o, 2));
      const foe = frontFoe(hero(s), nm(o, 1), 2, there(s), true);
      return {
        got: { said: said(o), own: meta(o, own), foe: meta(o, foe) },
        want: {
          said: [...toEach(1, 2, war(nm(o, 1), nm(o, 2))), [[1], own], [[2], foe]],
          own: systemLine([1], { provinceId: there(s).id }),
          foe: systemLine([2], { provinceId: there(s).id }),
        },
      };
    },
  },
  {
    name: 'two hosts side by side when war comes: each realm warned of its own and told of the other\'s (one company: "1 unit")',
    stage(b) {
      const p = seatOf(b, 2);
      const theirs = host(b, 1, p, 3);
      const ours = host(b, 2, p, 1);
      return {
        ...sending({ 2: { diplomacy: { 1: 'enemy' } } }),
        orders: [stays(theirs), stays(ours)],
        hero: theirs,
        others: [ours],
        there: p,
      };
    },
    check(o, s) {
      const p = there(s);
      return {
        got: { said: said(o) },
        want: {
          said: [
            ...toEach(1, 2, war(nm(o, 1), nm(o, 2))),
            [[1], frontOwn(hero(s), 3, p, true, nm(o, 2))],
            [[2], frontFoe(hero(s), nm(o, 1), 3, p, true)],
            [[2], frontOwn(other(s, 0), 1, p, false, nm(o, 1))],
            [[1], frontFoe(other(s, 0), nm(o, 2), 1, p, false)],
          ],
        },
      };
    },
  },
  {
    name: 'a host on its own land with no foe beside it is not warned when war comes',
    stage(b) {
      const h = host(b, 1, seatOf(b, 1), 2);
      return { ...sending({ 1: { diplomacy: { 2: 'enemy' } } }), orders: [stays(h)] };
    },
    check(o) {
      return { got: { said: said(o) }, want: { said: toEach(1, 2, war(nm(o, 1), nm(o, 2))) } };
    },
  },
  {
    name: "a host on the foe's land under Invisibility: its own realm is warned, the foe is not told",
    stage(b) {
      const h = host(b, 1, seatOf(b, 2), 2);
      h['_invisTurn'] = b.G.turn;
      return { ...sending({ 1: { diplomacy: { 2: 'enemy' } } }), orders: [stays(h)], hero: h, there: seatOf(b, 2) };
    },
    check(o, s) {
      return {
        got: { said: said(o) },
        want: {
          said: [...toEach(1, 2, war(nm(o, 1), nm(o, 2))), [[1], frontOwn(hero(s), 2, there(s), true, nm(o, 2))]],
        },
      };
    },
  },
  {
    name: "no war-front warning when peace is made or an alliance broken, though hosts stand on each other's ground",
    stage(b) {
      relate(b, { '0-2': 'allied' });
      const h = host(b, 0, seatOf(b, 2), 2);
      return { ...sending({ 2: { diplomacy: { 0: 'enemy' } } }), orders: [stays(h)] };
    },
    check(o) {
      return {
        got: { said: said(o) },
        want: { said: toEach(0, 2, broken(nm(o, 2), false, nm(o, 0), nm(o, 2))) },
      };
    },
  },
];

// ── The Reckoning called ─────────────────────────────────────────────────────────────────────────────────────────
// Three realms: a realm alone needs 50% of the world; each ally raises the bar by 17 points (half of one realm's fair
// share, rounded); the claimant's own realm must hold half the bar. Four realms: 45%, and 13 points an ally.
const callsAlone = (b: Board, t: number, ...tax: number[]) => {
  turnIs(b, t);
  relate(b, { '0-1': 'enemy' });
  taxes(b, ...tax);
  king(b, 0);
  return sending({ 0: { callReckoning: true } });
};
export const RECKONING_CALL_CASES: DiplomacyAndVictoryCase[] = [
  {
    name: 'a king who calls the Reckoning before turn 10 is told the throne cannot be claimed yet',
    stage: (b) => callsAlone(b, 9, 60, 20, 20),
    check(o) {
      const t = tooEarly(nm(o, 0));
      return {
        got: { said: said(o), line: meta(o, t), claim: claimAfter(o) },
        want: { said: [[[0], t]], line: systemLine([0]), claim: null },
      };
    },
  },
  {
    name: 'on turn 10 a king whose realm holds the bar alone lays claim to the throne, told to every realm, and the claim is judged two turns on',
    stage: (b) => callsAlone(b, 10, 60, 20, 20),
    check(o) {
      const t = called(nm(o, 0), [], 60, 50, 12);
      return {
        got: { said: said(o), line: meta(o, t), claim: claimAfter(o), over: result(o) },
        want: {
          said: [[[], t]],
          line: systemLine([], { public: true }),
          claim: { by: 0, bloc: [0], calledTurn: 10, resolveAtTurn: 12, thrPct: 50 },
          over: null,
        },
      };
    },
  },
  {
    name: 'a bloc lays claim: the allies are named, and the bar is raised for each',
    stage(b) {
      turnIs(b, 12);
      taxes(b, 60, 20, 20);
      king(b, 0);
      return sending({ 0: { callReckoning: true } });
    },
    check(o) {
      return {
        got: { said: said(o), claim: claimAfter(o) },
        want: {
          said: [[[], called(nm(o, 0), [nm(o, 2)], 80, 67, 14)]],
          claim: { by: 0, bloc: [0, 2], calledTurn: 12, resolveAtTurn: 14, thrPct: 67 },
        },
      };
    },
  },
  {
    name: 'in a game of four, a bloc of three: "2 allies", the bar raised twice',
    realms: 4,
    stage(b) {
      turnIs(b, 12);
      relate(b, { '0-1': 'enemy', '0-2': 'allied', '0-3': 'allied' });
      taxes(b, 40, 10, 20, 30);
      king(b, 0);
      return sending({ 0: { callReckoning: true } });
    },
    check(o) {
      return {
        got: { said: said(o), claim: claimAfter(o) },
        want: {
          said: [[[], called(nm(o, 0), [nm(o, 2), nm(o, 3)], 90, 71, 14)]],
          claim: { by: 0, bloc: [0, 2, 3], calledTurn: 12, resolveAtTurn: 14, thrPct: 71 },
        },
      };
    },
  },
  {
    name: 'a realm whose king has fallen is told only a king may call the Reckoning',
    stage(b) {
      turnIs(b, 12);
      relate(b, { '0-1': 'enemy' });
      taxes(b, 60, 20, 20);
      return sending({ 0: { callReckoning: true } });
    },
    check(o) {
      return {
        got: { said: said(o), line: meta(o, ONLY_A_KING), claim: claimAfter(o) },
        want: { said: [[[0], ONLY_A_KING]], line: systemLine([0]), claim: null },
      };
    },
  },
  {
    name: 'a realm short of the bar is told its share and the bar',
    stage: (b) => callsAlone(b, 12, 40, 30, 30),
    check(o) {
      const t = short(nm(o, 0), 40, 50);
      return {
        got: { said: said(o), line: meta(o, t), claim: claimAfter(o) },
        want: { said: [[[0], t]], line: systemLine([0]), claim: null },
      };
    },
  },
  {
    name: 'a bloc short of its raised bar: the claimant is told the bar it needed',
    stage(b) {
      turnIs(b, 12);
      taxes(b, 40, 40, 20);
      king(b, 0);
      return sending({ 0: { callReckoning: true } });
    },
    check(o) {
      return {
        got: { said: said(o), claim: claimAfter(o) },
        want: { said: [[[0], short(nm(o, 0), 60, 67)]], claim: null },
      };
    },
  },
  {
    name: 'a lesser ally in a bloc that holds the bar is told a claimant must hold half the bar in its own right',
    stage(b) {
      turnIs(b, 12);
      taxes(b, 70, 10, 20);
      king(b, 2);
      return sending({ 2: { callReckoning: true } });
    },
    check(o) {
      const t = passenger(nm(o, 2), 20, 33, 67);
      return {
        got: { said: said(o), line: meta(o, t), claim: claimAfter(o) },
        want: { said: [[[2], t]], line: systemLine([2]), claim: null },
      };
    },
  },
  {
    name: 'the first realm that can claim the throne takes it, and a later caller is not answered at all',
    stage(b) {
      callsAlone(b, 12, 60, 40, 0);
      king(b, 1);
      return sending({ 0: { callReckoning: true }, 1: { callReckoning: true } });
    },
    check(o) {
      return {
        got: { said: said(o), claim: (claimAfter(o) as Record<string, unknown> | null)?.['by'] },
        want: { said: [[[], called(nm(o, 0), [], 60, 50, 14)]], claim: 0 },
      };
    },
  },
  {
    name: 'an earlier caller short of the bar is told so, and a later caller that holds it lays claim',
    stage(b) {
      callsAlone(b, 12, 30, 60, 10);
      king(b, 1);
      return sending({ 0: { callReckoning: true }, 1: { callReckoning: true } });
    },
    check(o) {
      return {
        got: { said: said(o), claim: (claimAfter(o) as Record<string, unknown> | null)?.['by'] },
        want: {
          said: [
            [[0], short(nm(o, 0), 30, 50)],
            [[], called(nm(o, 1), [], 60, 50, 14)],
          ],
          claim: 1,
        },
      };
    },
  },
  {
    name: 'while a claim stands, another call is not heard',
    stage(b) {
      callsAlone(b, 13, 60, 20, 20);
      claim(b, 0, [0], 14, 50);
      king(b, 1);
      return sending({ 1: { callReckoning: true } });
    },
    check(o) {
      return {
        got: { said: said(o), claim: claimAfter(o) },
        want: { said: [], claim: { by: 0, bloc: [0], calledTurn: 12, resolveAtTurn: 14, thrPct: 50 } },
      };
    },
  },
];

// ── A claim standing ─────────────────────────────────────────────────────────────────────────────────────────────
export const CLAIM_CASES: DiplomacyAndVictoryCase[] = [
  {
    name: 'a claim still holding its bar stands, unspoken, until the turn it is judged',
    stage(b) {
      callsAlone(b, 13, 60, 20, 20);
      claim(b, 0, [0], 14, 50);
      return sending();
    },
    check(o) {
      return {
        got: { said: said(o), claim: claimAfter(o), over: result(o) },
        want: { said: [], claim: { by: 0, bloc: [0], calledTurn: 12, resolveAtTurn: 14, thrPct: 50 }, over: null },
      };
    },
  },
  {
    name: 'a claim that holds its bar to the end of its last turn: the world is judged and the game ends, announced to every realm',
    stage(b) {
      callsAlone(b, 14, 60, 20, 20);
      claim(b, 0, [0], 14, 50);
      return sending();
    },
    check(o) {
      const t = decided(nm(o, 0), JUDGED);
      return {
        got: { said: said(o), line: meta(o, t), claim: claimAfter(o), over: result(o), standings: standings(o) },
        want: {
          said: announced(o, nm(o, 0), JUDGED, 0),
          line: systemLine([], { public: true, gameEnd: true }),
          claim: null,
          over: { winner: 0, byReckoning: true, turn: 14, _announced: true },
          standings: topOf(o, 0),
        },
      };
    },
  },
  {
    name: 'the world judged crowns the realm of the highest Legacy, though an ally lodged the claim',
    stage(b) {
      turnIs(b, 14);
      taxes(b, 35, 5, 60);
      king(b, 0);
      claim(b, 0, [0, 2], 14, 60);
      return sending();
    },
    check(o) {
      return {
        got: { said: said(o), over: result(o) },
        want: {
          said: announced(o, nm(o, 2), JUDGED, 2),
          over: { winner: 2, byReckoning: true, turn: 14, _announced: true },
        },
      };
    },
  },
  {
    name: 'a claim whose bloc has fallen below its bar collapses, told to every realm',
    stage(b) {
      callsAlone(b, 13, 40, 30, 30);
      claim(b, 0, [0], 14, 50);
      return sending();
    },
    check(o) {
      const t = collapses(nm(o, 0), 40, 50);
      return {
        got: { said: said(o), line: meta(o, t), claim: claimAfter(o), over: result(o) },
        want: { said: [[[], t]], line: systemLine([], { public: true }), claim: null, over: null },
      };
    },
  },
  {
    name: 'a claim whose claimant has fallen below half its bar collapses, though the allies still hold it',
    stage(b) {
      turnIs(b, 13);
      taxes(b, 30, 10, 60);
      king(b, 0);
      claim(b, 0, [0, 2], 14, 67);
      return sending();
    },
    check(o) {
      const t = cutDown(nm(o, 0), 30, 33);
      return {
        got: { said: said(o), line: meta(o, t), claim: claimAfter(o) },
        want: { said: [[[], t]], line: systemLine([], { public: true }), claim: null },
      };
    },
  },
  {
    name: "the bar of a claim is the one set when it was lodged: an ally gained since doesn't raise it",
    stage(b) {
      turnIs(b, 13);
      taxes(b, 50, 30, 20);
      king(b, 0);
      claim(b, 0, [0], 14, 50);
      return sending();
    },
    check(o) {
      return {
        got: { said: said(o), claim: claimAfter(o) },
        want: { said: [], claim: { by: 0, bloc: [0], calledTurn: 12, resolveAtTurn: 14, thrPct: 50 } },
      };
    },
  },
  {
    name: "an old save's claim, with no bar recorded, is held to the bar as it stands now",
    stage(b) {
      turnIs(b, 13);
      taxes(b, 50, 40, 10);
      king(b, 0);
      claim(b, 0, [0], 14);
      return sending();
    },
    check(o) {
      return {
        got: { said: said(o), claim: claimAfter(o) },
        want: { said: [[[], collapses(nm(o, 0), 60, 67)]], claim: null },
      };
    },
  },
  {
    name: 'a claim whose claimant has no land and no living hero left collapses',
    stage(b) {
      turnIs(b, 13);
      relate(b, { '0-1': 'enemy' });
      taxes(b, 0, 50, 50);
      landless(b, 0);
      claim(b, 0, [0], 14, 50);
      return sending();
    },
    check(o) {
      return {
        got: { said: said(o), claim: claimAfter(o) },
        want: { said: [[[], collapses(nm(o, 0), 0, 50)]], claim: null },
      };
    },
  },
];

// ── The bar erodes ───────────────────────────────────────────────────────────────────────────────────────────────
const noClaimAt = (b: Board, t: number, steps = 0) => {
  turnIs(b, t);
  eroded(b, steps);
  return sending();
};
export const EROSION_CASES: DiplomacyAndVictoryCase[] = [
  {
    name: 'from the end of turn 15, while no claim stands, the bar falls by 5 points, told to every realm',
    stage: (b) => noClaimAt(b, 15),
    check(o) {
      const t = weary(45, 50, 17);
      return {
        got: { said: said(o), line: meta(o, t), steps: erosion(o) },
        want: { said: [[[], t]], line: systemLine([], { public: true }), steps: 1 },
      };
    },
  },
  {
    name: 'before the end of turn 15 the bar holds',
    stage: (b) => noClaimAt(b, 14),
    check(o) {
      return { got: { said: said(o), steps: erosion(o) }, want: { said: [], steps: 0 } };
    },
  },
  {
    name: 'the bar falls from where it stands, a step a turn',
    stage: (b) => noClaimAt(b, 20, 3),
    check(o) {
      return { got: { said: said(o), steps: erosion(o) }, want: { said: [[[], weary(30, 35, 17)]], steps: 4 } };
    },
  },
  {
    name: 'the step that reaches the floor says it will fall no further',
    stage: (b) => noClaimAt(b, 20, 4),
    check(o) {
      return { got: { said: said(o), steps: erosion(o) }, want: { said: [[[], weary(25, 30, 17)]], steps: 5 } };
    },
  },
  {
    name: 'at the floor the bar stays, and nobody is told',
    stage: (b) => noClaimAt(b, 20, 5),
    check(o) {
      return { got: { said: said(o), steps: erosion(o) }, want: { said: [], steps: 5 } };
    },
  },
  {
    name: 'in a game of four the bar falls from 45, and each ally still costs 13 points',
    realms: 4,
    stage: (b) => noClaimAt(b, 15),
    check(o) {
      return { got: { said: said(o), steps: erosion(o) }, want: { said: [[[], weary(40, 45, 13)]], steps: 1 } };
    },
  },
  {
    name: 'while a claim stands the bar does not fall',
    stage(b) {
      callsAlone(b, 16, 60, 20, 20);
      claim(b, 0, [0], 17, 50);
      return sending();
    },
    check(o) {
      return { got: { said: said(o), steps: erosion(o) }, want: { said: [], steps: 0 } };
    },
  },
  {
    name: 'a claim called this turn stops the bar falling the same turn',
    stage: (b) => callsAlone(b, 16, 60, 20, 20),
    check(o) {
      return {
        got: { said: said(o), steps: erosion(o) },
        want: { said: [[[], called(nm(o, 0), [], 60, 50, 18)]], steps: 0 },
      };
    },
  },
  {
    name: 'a claim that collapses this turn lets the bar fall the same turn, from where it stood',
    stage(b) {
      callsAlone(b, 16, 40, 30, 30);
      eroded(b, 1);
      claim(b, 0, [0], 17, 50);
      return sending();
    },
    check(o) {
      return {
        got: { said: said(o), steps: erosion(o) },
        want: {
          said: [
            [[], collapses(nm(o, 0), 40, 50)],
            [[], weary(40, 45, 17)],
          ],
          steps: 2,
        },
      };
    },
  },
  {
    name: 'the turn the world is judged, the bar does not fall',
    stage(b) {
      callsAlone(b, 16, 60, 20, 20);
      claim(b, 0, [0], 16, 50);
      return sending();
    },
    check(o) {
      return {
        got: { steps: erosion(o), over: result(o)?.['byReckoning'] },
        want: { steps: 0, over: true },
      };
    },
  },
];

// ── Elimination ──────────────────────────────────────────────────────────────────────────────────────────────────
export const ELIMINATION_CASES: DiplomacyAndVictoryCase[] = [
  {
    name: 'when only one realm still holds land or a living hero, it wins, announced to every realm with the standings',
    stage(b) {
      turnIs(b, 3);
      landless(b, 1);
      landless(b, 2);
      return sending();
    },
    check(o) {
      const t = decided(nm(o, 0), RUINS);
      return {
        got: { said: said(o), line: meta(o, t), over: result(o), standings: standings(o) },
        want: {
          said: announced(o, nm(o, 0), RUINS, 0),
          line: systemLine([], { public: true, gameEnd: true }),
          over: { winner: 0, byElimination: true, turn: 3, _announced: true },
          standings: topOf(o, 0),
        },
      };
    },
  },
  {
    name: 'the last realm may hold no land, only a living hero',
    stage(b) {
      turnIs(b, 3);
      landless(b, 0);
      landless(b, 1);
      landless(b, 2);
      const h = host(b, 0, b.X, 1);
      h.isKing = true;
      return { ...sending(), orders: [stays(h)] };
    },
    check(o) {
      return {
        got: { over: result(o)?.['winner'] },
        want: { over: 0 },
      };
    },
  },
  {
    name: 'a realm with no land but a living hero is still in the game',
    stage(b) {
      landless(b, 1);
      landless(b, 2);
      king(b, 0);
      const h = host(b, 2, b.X, 1);
      return { ...sending(), orders: [stays(h)] };
    },
    check(o) {
      return { got: { said: said(o), over: result(o) }, want: { said: [], over: null } };
    },
  },
  {
    name: 'a realm with land but no hero is still in the game',
    stage(b) {
      landless(b, 2);
      return sending();
    },
    check(o) {
      return { got: { said: said(o), over: result(o) }, want: { said: [], over: null } };
    },
  },
  {
    name: 'when no realm is left, nobody wins by elimination',
    stage(b) {
      [0, 1, 2].forEach((pi) => {
        landless(b, pi);
      });
      return sending();
    },
    check(o) {
      return { got: { said: said(o), over: result(o) }, want: { said: [], over: null } };
    },
  },
  {
    name: 'a realm that has conceded but still holds land keeps the game from ending by elimination',
    stage(b) {
      landless(b, 2);
      concededBefore(b, 1);
      relate(b, { '0-1': 'enemy' });
      return sending();
    },
    check(o) {
      return {
        got: { over: result(o), said: said(o)[0] },
        want: {
          over: { winner: 0, byConcession: true, byReckoning: true, turn: 1, _announced: true },
          said: [[], byConcession(1, true)],
        },
      };
    },
  },
  {
    name: 'elimination comes before concession: a conceded realm with nothing left is out, and the last realm wins by elimination',
    stage(b) {
      landless(b, 1);
      landless(b, 2);
      concededBefore(b, 1);
      return sending();
    },
    check(o) {
      return {
        got: { said: said(o), over: result(o) },
        want: {
          said: announced(o, nm(o, 0), RUINS, 0),
          over: { winner: 0, byElimination: true, turn: 1, _announced: true },
        },
      };
    },
  },
  {
    name: 'a game won by elimination on a turn the bar would fall: the bar still falls first',
    stage(b) {
      turnIs(b, 15);
      landless(b, 1);
      landless(b, 2);
      return sending();
    },
    check(o) {
      return {
        got: {
          said: said(o)[0],
          steps: erosion(o),
          over: result(o)?.['byElimination'],
        },
        want: { said: [[], weary(45, 50, 17)], steps: 1, over: true },
      };
    },
  },
];

// ── Concession ───────────────────────────────────────────────────────────────────────────────────────────────────
export const CONCESSION_CASES: DiplomacyAndVictoryCase[] = [
  {
    name: 'when every other realm concedes, the last wins at once: the Reckoning called, the result and the standings announced',
    stage(b) {
      turnIs(b, 6);
      relate(b, { '0-1': 'enemy' });
      return sending({ 1: { concede: true }, 2: { concede: true } });
    },
    check(o) {
      const t = byConcession(2, true);
      return {
        got: { said: said(o), line: meta(o, t), over: result(o), standings: standings(o) },
        want: {
          said: [[[], t], ...announced(o, nm(o, 0), ALL_CONCEDED, 0)],
          line: systemLine([], { public: true, gameEnd: true }),
          over: { winner: 0, byConcession: true, byReckoning: true, turn: 6, _announced: true },
          standings: topOf(o, 0),
        },
      };
    },
  },
  {
    name: 'realms that conceded on earlier turns are out as well',
    stage(b) {
      relate(b, { '0-1': 'enemy' });
      concededBefore(b, 1);
      concededBefore(b, 2);
      return sending();
    },
    check(o) {
      return {
        got: { said: said(o), over: result(o) },
        want: {
          said: [[[], byConcession(2, true)], ...announced(o, nm(o, 0), ALL_CONCEDED, 0)],
          over: { winner: 0, byConcession: true, byReckoning: true, turn: 1, _announced: true },
        },
      };
    },
  },
  {
    name: 'one concession among three realms not allied leaves the game going',
    stage(b) {
      relate(b, { '0-1': 'enemy' });
      return sending({ 1: { concede: true } });
    },
    check(o) {
      return { got: { said: said(o), over: result(o) }, want: { said: [], over: null } };
    },
  },
  {
    name: 'when the realms left are sworn allies, the game ends, and the ally with the highest Legacy wins',
    stage(b) {
      taxes(b, 10, 10, 30);
      return sending({ 1: { concede: true } });
    },
    check(o) {
      return {
        got: { said: said(o), over: result(o) },
        want: {
          said: [[[], byConcession(1, false)], ...announced(o, nm(o, 2), ALL_CONCEDED, 2)],
          over: { winner: 2, byConcession: true, byReckoning: true, turn: 1, _announced: true },
        },
      };
    },
  },
  {
    name: 'in a game of four, three realms left of which two are allied: the game goes on',
    realms: 4,
    stage: () => sending({ 1: { concede: true } }),
    check(o) {
      return { got: { said: said(o), over: result(o) }, want: { said: [], over: null } };
    },
  },
  {
    name: 'a claim in its grace period is overtaken by the concession',
    stage(b) {
      callsAlone(b, 13, 60, 20, 20);
      claim(b, 0, [0], 14, 50);
      return sending({ 1: { concede: true }, 2: { concede: true } });
    },
    check(o) {
      return {
        got: { claim: claimAfter(o), over: result(o) },
        want: { claim: null, over: { winner: 0, byConcession: true, byReckoning: true, turn: 13, _announced: true } },
      };
    },
  },
  {
    name: 'when every realm concedes, no-one wins, and the standings are still told',
    stage: () => sending({ 0: { concede: true }, 1: { concede: true }, 2: { concede: true } }),
    check(o) {
      return {
        got: { said: said(o), over: result(o) },
        want: {
          said: [[[], byConcession(3, true)], ...announced(o, 'No-one', ALL_CONCEDED, 0)],
          over: { winner: null, byConcession: true, byReckoning: true, turn: 1, _announced: true },
        },
      };
    },
  },
];

// ── The result announced ─────────────────────────────────────────────────────────────────────────────────────────
export const ANNOUNCEMENT_CASES: DiplomacyAndVictoryCase[] = [
  {
    name: 'a result already announced is not announced again',
    stage(b) {
      decidedBefore(b, {
        winner: 0,
        byElimination: true,
        _announced: true,
        standings: [{ index: 0, name: 'Anyone', score: 1, titles: [], relics: 0 }],
      });
      return sending();
    },
    check(o) {
      return { got: { said: said(o) }, want: { said: [] } };
    },
  },
  {
    name: "an older save's result not yet announced is announced now, the standings by Legacy with their titles and relics",
    stage(b) {
      decidedBefore(b, {
        winner: 1,
        byReckoning: true,
        standings: [
          { index: 0, name: 'Realm A', score: 10, titles: ['marshal', 'unheard'], relics: 0 },
          { index: 1, name: 'Realm B', score: 21, titles: ['throne'], relics: 1 },
          { index: 2, name: 'Realm C', score: 2, titles: [], relics: 2 },
          { index: 3, name: 'Realm D', score: 0 },
        ],
      });
      return sending();
    },
    check(o) {
      return {
        got: { said: said(o), announced: result(o)?.['_announced'] },
        want: {
          said: [
            [[], decided(nm(o, 1), JUDGED)],
            [[], standing(1, 'Realm B', 21, ['Throne'], 1)],
            [[], standing(2, 'Realm A', 10, ['Grand Marshal', 'unheard'])],
            [[], standing(3, 'Realm C', 2, [], 2)],
            [[], standing(4, 'Realm D', 0)],
          ],
          announced: true,
        },
      };
    },
  },
];

// ── The order of the two ─────────────────────────────────────────────────────────────────────────────────────────
export const ORDER_CASES: DiplomacyAndVictoryCase[] = [
  {
    name: 'an alliance made this turn already widens the bloc of a claim lodged this turn',
    realms: 4,
    stage(b) {
      turnIs(b, 12);
      taxes(b, 10, 40, 10, 40);
      king(b, 1);
      return sending({ 1: { diplomacy: { 3: 'treat' }, callReckoning: true }, 3: { diplomacy: { 1: 'treat' } } });
    },
    check(o) {
      return {
        got: { said: said(o).slice(2), claim: (claimAfter(o) as Record<string, unknown> | null)?.['bloc'] },
        want: { said: [[[], called(nm(o, 1), [nm(o, 3)], 80, 58, 14)]], claim: [1, 3] },
      };
    },
  },
  {
    name: 'an alliance broken this turn already shrinks the bloc of a standing claim',
    stage(b) {
      turnIs(b, 13);
      taxes(b, 30, 10, 60);
      king(b, 0);
      claim(b, 0, [0, 2], 14, 60);
      return sending({ 2: { diplomacy: { 0: 'enemy' } } });
    },
    check(o) {
      return {
        got: { said: said(o), claim: claimAfter(o) },
        want: {
          said: [...toEach(0, 2, broken(nm(o, 2), false, nm(o, 0), nm(o, 2))), [[], collapses(nm(o, 0), 30, 60)]],
          claim: null,
        },
      };
    },
  },
  {
    name: "a peace made this turn doesn't save the last realm: the game ends by concession the same turn",
    stage(b) {
      relate(b, { '0-1': 'enemy' });
      concededBefore(b, 2);
      return sending({ 0: { diplomacy: { 1: 'treat' } }, 1: { diplomacy: { 0: 'treat' }, concede: true } });
    },
    check(o) {
      return {
        got: { said: said(o).slice(0, 3), over: result(o) },
        want: {
          said: [...toEach(0, 1, peace(nm(o, 0), nm(o, 1))), [[], byConcession(2, true)]],
          over: { winner: 0, byConcession: true, byReckoning: true, turn: 1, _announced: true },
        },
      };
    },
  },
];

/** Stages `c` on `b`, from plain realms: every realm has met every other, realms 0 and 1 at war and 0 and 2 allied,
 *  each holding only its seat, with a tax of 10. */
export const stageCase = (b: Board, c: DiplomacyAndVictoryCase): Staged => {
  plainRealms(b);
  b.G.players.forEach((pl, i) => {
    pl['heroes'] = [];
    pl['_encountered'] = b.G.players.map((_, k) => k).filter((k) => k !== i);
  });
  relate(b, { '0-1': 'enemy', '0-2': 'allied' });
  taxes(b, ...b.G.players.map(() => 10));
  raw(b)['_guardianHpV2'] = true;
  return c.stage(b);
};

/** Every case, by part of the two stages. */
export const DIPLOMACY_AND_VICTORY_CASES: [string, DiplomacyAndVictoryCase[]][] = [
  ['peace and war', PEACE_AND_WAR_CASES],
  ['alliances', ALLIANCE_CASES],
  ['war fronts', WAR_FRONT_CASES],
  ['the Reckoning called', RECKONING_CALL_CASES],
  ['a claim standing', CLAIM_CASES],
  ['the bar erodes', EROSION_CASES],
  ['elimination', ELIMINATION_CASES],
  ['concession', CONCESSION_CASES],
  ['the result announced', ANNOUNCEMENT_CASES],
  ['the order of the two', ORDER_CASES],
];
