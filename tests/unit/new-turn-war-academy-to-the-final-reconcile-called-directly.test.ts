// The new turn's second part (plan P1-08k5b: src/engine/turn/, a stage lifted out of resolveTurn's own body), called
// directly in the bare vm on the middle of a bot world (lib/middle-of-a-bot-world.ts). First the cases
// scenario/new-turn-war-academy-to-the-final-reconcile-in-a-whole-turn plays through a whole turn
// (lib/new-turn-war-academy-to-the-final-reconcile-cases.ts), here played through the stage alone, as resolveTurn
// calls it once the new turn's first part has moved the counter on (no phase current, every line filed after the
// phases), but for those only a whole turn can stage; then, with the helpers it calls stood in (each replaced in the vm
// by a recorder for the test's length), what it hands them and when; then what the whole turn can't stage: the dice
// of each company, grave, band and wanderer in turn, a fallen hero at home, heroes with no maximum or no HP, a body
// whose record is gone or whose grave has no place, a Divine king with nowhere to return, a living hero with a stale
// grave of the turn before, the save's repair counts, provinces and heroes the map doesn't place, provinces' lists
// wrong or missing. Properties (fast-check): the War Academy drills exactly the companies at home it may and whose die
// falls under 7%; the gardens mend each wounded hero of the realm by what it knows, to his maximum; graves rot exactly
// when their die is at or under their ground's rate; each band retires (told) or moves on to a province around it of
// its own kind; each wanderer stays or drifts to land around him; a Divine hero rises only when due, on holy ground
// his realm held, spending it; every province ends listing exactly the heroes standing in it.
// Level 1: one function, called with the context resolveTurn hands it.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// `newTurnWarAcademyInformantsDivineResurrectionGravesMercenariesWanderersAndTheFinalReconcile` (P1-08k5b), called
// directly, the turn moved on first as the first part leaves it: the whole-turn cases through the stage alone (but
// those only a whole turn stages: the save's repairs counted at the turn's start, a maximum raised by Royal Physicians,
// an heir crowned, a summons gone, the titles); then, with its helpers stood in by recorders in the `vm`, what each is
// handed: each realm's Academy, gardens, informants and Observatory in turn, then the reconcile and the stranded
// guards; the Academy's chance asked once per realm with companies to drill; the gardens summed per wounded hero, the
// king's effects for the king; the Embalmers asked only on held ground; the holy ground measured from the body (or the
// hero) and spent from the realm's list. Then what a whole turn can't stage: each company's, grave's, band's and
// wanderer's die in turn; a nameless company; a fallen hero at home; heroes with no maximum or no HP, or past it; a
// captain standing nowhere; a province no realm mapped or of no terrain, its list of visitors kept; no graveyard, a
// grave whose hero is gone or that records no turn, a hero of 1 HP; a body measured from its grave; a king with no
// ground left, or no longer marked king; a living hero with a stale grave of the turn before ("raised": Parked); graves
// on a missing realm's ground, a grave-keeping effect with no rate; bands and wanderers standing nowhere, no mercenary
// list; the repair counts (the retired discoveries' on the turn's context, as the save's upgrade found them, since
// P1-15a); graves with no place; provinces with no list; guards bare, on a realm's land, holding, fallen. Properties
// (fast-check): the Academy drills exactly the companies at home that may rise and whose die is under 7%, each told, or
// says none rose; the gardens mend each wounded hero by what his realm knows, to his maximum; graves rot exactly at or
// under their ground's rate; each band retires (told once) or moves on to its own kind of ground around it; each
// wanderer stays or drifts to land around him, listed only there; a Divine hero rises only when due, on holy ground his
// realm held, spending it, each ground once; every province ends listing exactly the heroes standing in it. Planted
// faults: in the PR (P1-08k5b)
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { withCaseDice } from '../lib/espionage-order-cases.ts';
import {
  LANDS,
  NEW_TURN_SECOND_PART_CASES,
  around,
  band,
  discoveriesRetired,
  drilled,
  fallenHero,
  ghostGrave,
  graves,
  guard,
  home,
  knit,
  landAround,
  noDrill,
  notReturn,
  renamed,
  reports,
  retires,
  risesIn,
  staleGrave,
  stageCase,
  standing,
  wounded,
  charts,
  type NewTurnCase,
  type Outcome,
} from '../lib/new-turn-war-academy-to-the-final-reconcile-cases.ts';
import {
  NO_TITLE_SKILLS,
  consecrated,
  creed,
  holdsOnly,
  kingFalls,
  kingOf,
  marks,
  seatOf,
  summoned,
  unit,
  wanderer,
} from '../lib/new-turn-succession-and-summons-cases.ts';
import { board, must, withDice, type Board, type Character, type Province } from '../lib/middle-of-a-bot-world.ts';
import { knows, leads, realm, ring1, ring2 } from '../lib/cast-spell-order-cases.ts';
import type { WhatTheSavesUpgradeFound } from '../../src/engine/saves/upgrade-a-saved-game-and-check-it.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
type Fn = (...a: unknown[]) => unknown;
type Raw = Record<string, unknown>;
const STAGE = 'newTurnWarAcademyInformantsDivineResurrectionGravesMercenariesWanderersAndTheFinalReconcile';
const secondPart = engineFn(engine, STAGE) as Fn;
const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

const tc = (b: Board) => b.tc as unknown as Raw & Board['tc'];
const G = (b: Board) => b.G as unknown as Raw & Board['G'];
/** What the save's upgrade found as the turn began, on the turn's context (plan P1-15a): the stage tells it. */
const found = (b: Board) => tc(b)['whatTheSavesUpgradeFound'] as WhatTheSavesUpgradeFound;
/** The stage, as resolveTurn calls it once the new turn's first part is done: the counter moved on, no phase current,
 *  every line filed after the phases, the log's context cleared. Gives back the turn that was played. */
const settle = (b: Board) => {
  const turn = b.G.turn;
  b.G.turn = turn + 1;
  tc(b)._currentPhase = null;
  tc(b)['_afterPhases'] = true;
  b.tc._logCtx = { charId: null, phase: null };
  secondPart(b.tc);
  return turn;
};
const outcome = (b: Board, turn: number): Outcome => ({ world: b.G, all: b.lines(), turn });
/** A board staged as every case is (`stageCase`): plain realms, each holding only its seat with a living king there. */
const fresh = () => {
  const b = board(engine, world, 4);
  stageCase(b, { name: 'nothing staged', stage: () => ({ orders: [] }), check: () => ({ got: {}, want: {} }) });
  return b;
};
/** The stage on `b` with every die at `die` and every percentile roll at 1. */
const after = (b: Board, die = LANDS.die) => {
  let turn = 0;
  withCaseDice(engine, { roll: 1, die }, () => {
    turn = settle(b);
  });
  return outcome(b, turn);
};
/** The stage on `b` with the dice drawn in turn from `dice`. */
const rolled = (b: Board, dice: number[]) => {
  let turn = 0;
  withDice(engine, dice, () => {
    turn = settle(b);
  });
  return outcome(b, turn);
};
const texts = (b: Board) => b.lines().map((l) => l.text);
const graveyard = (b: Board) => (G(b)['heroGraveyard'] as Raw[] | undefined) ?? [];
const graveOf = (b: Board, c: Character) => graveyard(b).find((g) => g['id'] === c.id);
const gravesIn = (p: Province) => ((p['battleGraves'] as unknown[] | undefined) ?? []).length;
const grades = (c: Character) => c.armies.map((u) => `${u.unitName} (${u.quality})`);

const DIRECT = NEW_TURN_SECOND_PART_CASES.map(
  ([part, cases]) => [part, cases.filter((c) => !c.wholeTurnOnly)] as const,
).filter(([, cases]) => cases.length > 0);
describe.each(DIRECT)('%s, through the stage called directly', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c: NewTurnCase) => {
    const b = board(engine, world, 4);
    const s = stageCase(b, c);
    let turn = 0;
    withCaseDice(engine, c.dice ?? LANDS, () => {
      turn = settle(b);
    });
    const { got, want } = c.check(outcome(b, turn), s);
    expect(got).toEqual(want);
  });
});

// ── What the stage hands the helpers it calls ────────────────────────────────────────────────────────────────────
interface Call {
  fn: string;
  args: unknown[];
  /** The lines written before the call. */
  before: number;
}
/** Runs `body` with each of `names` replaced by a recorder (in the vm, for the body's length); `returns` gives what a
 *  recorder does, by name (by default it calls the helper it stands in for). */
function standIn(b: Board, names: string[], body: () => void, returns: Record<string, Fn> = {}): Call[] {
  const g = engine as unknown as Record<string, unknown>;
  const was = names.map((f) => [f, g[f]] as const);
  const calls: Call[] = [];
  for (const [f, w] of was)
    g[f] = (...args: unknown[]) => {
      calls.push({ fn: f, args, before: b.lines().length });
      const r = returns[f];
      return r ? r(...args) : (w as Fn)(...args);
    };
  try {
    body();
  } finally {
    for (const [f, w] of was) g[f] = w;
  }
  return calls;
}
const HELPERS = [
  'hasDisc',
  'discParam',
  'discEff',
  'discSum',
  'nearestConsecratedProv',
  'consecratedIds',
  'reconcileProvinceCharacters',
  'normaliseStrandedGuards',
];
/** Each call as `<helper> <its arguments but the context and the save>`. */
const shown = (b: Board, calls: Call[]) =>
  calls.map((c) =>
    [c.fn, ...c.args.filter((a) => a !== b.tc && a !== b.G).map((a) => (typeof a === 'function' ? 'fn' : a))].join(' '),
  );

describe('The new turn’s second part: what it calls', () => {
  test('with nothing to do, in order: each realm’s War Academy, its gardens, its informants, its Observatory; then the reconcile and the stranded guards, each handed the context or the save', () => {
    const b = fresh();
    const calls = standIn(b, HELPERS, () => after(b));
    expect(shown(b, calls)).toEqual([
      'hasDisc 0 sd08',
      'hasDisc 1 sd08',
      'hasDisc 2 sd08',
      'discEff 0 regen',
      'discEff 1 regen',
      'discEff 2 regen',
      'hasDisc 0 sd22',
      'hasDisc 1 sd22',
      'hasDisc 2 sd22',
      'hasDisc 0 sd39',
      'hasDisc 1 sd39',
      'hasDisc 2 sd39',
      'reconcileProvinceCharacters',
      'normaliseStrandedGuards',
    ]);
    const last = calls.slice(-2);
    expect(last.map((c) => c.args)).toEqual([[b.tc], [b.G]]);
  });

  test('the War Academy asks its 7% once for each realm with companies it may drill at home, with 50% where the table has none', () => {
    const b = fresh();
    knows(b, 0, 'sd08');
    knows(b, 1, 'sd08');
    leads(kingOf(b, 0), [unit('A', 'Men-at-Arms'), unit('B', 'Men-at-Arms')]);
    const calls = standIn(b, ['discParam'], () => after(b));
    expect(calls.map((c) => c.args)).toEqual([['sd08', 'pct', 0.5]]);
  });

  test('the War Academy drills at the chance its table gives: with 50% in its place, a die of 0.4 drills', () => {
    const b = fresh();
    knows(b, 0, 'sd08');
    const k = leads(kingOf(b, 0), [unit('A', 'Men-at-Arms')]);
    standIn(b, ['discParam'], () => after(b, 0.4), { discParam: () => 0.5 });
    expect(grades(k)).toEqual(['A (Veteran)']);
  });

  test('the gardens are summed for each wounded hero of a realm that has any, only the king’s own effects for the king', () => {
    const b = fresh();
    knows(b, 0, 'sd65', 'sd72');
    const k = wounded(kingOf(b, 0), 10);
    const h = wounded(standing(b, 0, b.X), 10);
    standing(b, 0, ring1(b, 0));
    const calls = standIn(b, ['discSum'], () => after(b));
    expect(calls.map((c) => [c.args[1], c.args[2], c.args[3]])).toEqual([
      [0, 'regen', 'hp'],
      [0, 'regen', 'hp'],
    ]);
    const [forKing, forHero] = calls.map((c) => c.args[4] as (e: Raw) => boolean);
    expect([forKing?.({ king: true }), forKing?.({}), forHero?.({ king: true }), forHero?.({})]).toEqual([
      true,
      true,
      false,
      true,
    ]);
    expect([k.hp, h.hp]).toEqual([17, 13]);
  });

  test('graves ask after the Embalmers only where a realm holds the ground', () => {
    const b = fresh();
    graves(home(b), 2);
    graves(ring1(b, 3), 2);
    const calls = standIn(b, ['discEff'], () => after(b));
    expect(calls.filter((c) => c.args[2] === 'graveDecay').map((c) => c.args[1])).toEqual([0]);
  });

  test('a Divine return looks for the holy ground nearest the body, or the hero if the grave has no place (reading the realm’s list), then spends it from the list', () => {
    const b = fresh();
    b.G.turn = 3;
    const d1 = fallenHero(b, 0, ring1(b, 3));
    const d2 = fallenHero(b, 0, ring1(b, 4));
    must(graveOf(b, d2), 'the grave')['location'] = null;
    d2.location = ring2(b, 7).id;
    holdsOnly(b, 0, [home(b), 10], [ring2(b, 7), 5]);
    consecrated(b, 0, home(b), ring2(b, 7));
    const calls = standIn(b, ['nearestConsecratedProv', 'consecratedIds'], () => after(b));
    expect(calls.map((c) => [c.fn, ...c.args.slice(1)])).toEqual([
      ['nearestConsecratedProv', 0, ring1(b, 3).id],
      ['consecratedIds'],
      ['consecratedIds'],
      ['nearestConsecratedProv', 0, ring2(b, 7).id],
      ['consecratedIds'],
      ['consecratedIds'],
    ]);
    expect(calls.filter((c) => c.fn === 'consecratedIds').map((c) => c.args[0])).toEqual(
      Array.from({ length: 4 }, () => realm(b, 0)),
    );
    expect([d1.location, d2.location]).toEqual([ring2(b, 7).id, home(b).id]);
  });

  test('the reconcile and the stranded guards come after everything said, and after the wanderers drift', () => {
    const b = fresh();
    knows(b, 0, 'sd22');
    const w = wanderer(b, NO_TITLE_SKILLS);
    let at = -1;
    const calls = standIn(b, ['reconcileProvinceCharacters', 'normaliseStrandedGuards'], () => after(b, 0), {
      reconcileProvinceCharacters: () => {
        at = w.location;
      },
    });
    expect(calls.map((c) => [c.fn, c.before])).toEqual([
      ['reconcileProvinceCharacters', b.lines().length],
      ['normaliseStrandedGuards', b.lines().length],
    ]);
    expect(at).toBe(must(landAround(b, b.X)[0], 'the first').id);
  });
});

// ── What the whole turn can't stage ─────────────────────────────────────────────────────────────────────────────
describe('The new turn’s second part: what only a direct call can stage', () => {
  test('the War Academy rolls for each company in turn: under 7% it trains, at 7% or over it doesn’t', () => {
    const b = fresh();
    knows(b, 0, 'sd08');
    const k = leads(kingOf(b, 0), [unit('A', 'Men-at-Arms'), unit('B', 'Men-at-Arms'), unit('C', 'Men-at-Arms')]);
    rolled(b, [0.0699, 0.07, 0.01]);
    expect(grades(k)).toEqual(['A (Veteran)', 'B (Average)', 'C (Veteran)']);
    expect(texts(b)).toEqual([
      drilled(unit('A', 'Men-at-Arms'), home(b), 'Veteran'),
      drilled(unit('C', 'Men-at-Arms'), home(b), 'Veteran'),
    ]);
  });

  test('a company with no name is told as “a <kind>”; a Crack company trains to Elite', () => {
    const b = fresh();
    knows(b, 0, 'sd08');
    const nameless = { type: 'Men-at-Arms', quality: 'Crack', race: 'Human' };
    const k = leads(kingOf(b, 0), [nameless as never]);
    after(b, 0);
    expect(k.armies[0]?.quality).toBe('Elite');
    expect(texts(b)).toEqual(['War Academy: a Men-at-Arms in ' + home(b).name + ' trains to Elite!']);
  });

  test('a fallen hero’s companies at home don’t train', () => {
    const b = fresh();
    knows(b, 0, 'sd08');
    const h = leads(standing(b, 0, home(b)), [unit('A', 'Men-at-Arms')]);
    h.alive = false;
    after(b, 0);
    expect([grades(h), texts(b)]).toEqual([['A (Average)'], []]);
  });

  test('two realms, each its own home and its own dice, in realm order; one whose drills all fail is told so', () => {
    const b = fresh();
    knows(b, 0, 'sd08');
    knows(b, 1, 'sd08');
    leads(kingOf(b, 0), [unit('A', 'Men-at-Arms')]);
    leads(kingOf(b, 1), [unit('B', 'Men-at-Arms')]);
    rolled(b, [0.5, 0]);
    expect(texts(b)).toEqual([noDrill(seatOf(b, 0)), drilled(unit('B', 'Men-at-Arms'), seatOf(b, 1), 'Veteran')]);
  });

  test('the gardens mend a hero with no maximum as one of 20; never a hero with no HP, a fallen one, nor one at or past his maximum', () => {
    const b = fresh();
    knows(b, 0, 'sd65');
    const noMax = wounded(standing(b, 0, b.X), 10);
    delete (noMax as Partial<Character>).maxHp;
    const noHp = standing(b, 0, b.X);
    delete (noHp as Partial<Character>).hp;
    const dead = wounded(standing(b, 0, b.X), 5);
    dead.alive = false;
    const over = standing(b, 0, b.X);
    over.hp = 25;
    after(b);
    expect([noMax.hp, noHp.hp, dead.hp, over.hp]).toEqual([13, undefined, 5, 25]);
    expect(texts(b)).toEqual([knit(noMax, 3, 13, 20)]);
  });

  test('a realm with only the king’s mending and no wounded king: nobody mended, nothing said', () => {
    const b = fresh();
    knows(b, 0, 'sd72');
    const h = wounded(standing(b, 0, b.X), 10);
    after(b);
    expect([h.hp, texts(b)]).toEqual([10, []]);
  });

  test('the informants pick among the unseen by each die in turn: of three, a die of 0.5 names the second', () => {
    const b = fresh();
    knows(b, 0, 'sd22');
    standing(b, 1, ring1(b, 3));
    const e2 = standing(b, 1, ring1(b, 4));
    standing(b, 1, ring1(b, 5));
    after(b, 0.5);
    expect(texts(b)).toEqual([reports(e2, realm(b, 1).name, ring1(b, 4))]);
  });

  test('a captain standing nowhere on the map was last in “unknown”', () => {
    const b = fresh();
    knows(b, 0, 'sd22');
    const e = standing(b, 1, ring1(b, 3));
    e.location = 999;
    after(b);
    expect(texts(b)).toEqual([reports(e, realm(b, 1).name, 'unknown')]);
  });

  test('the Observatory counts a province no realm has mapped as unmapped, charts one of no known terrain as such, and starts its list of visitors', () => {
    const b = fresh();
    knows(b, 0, 'sd39');
    const all = b.G.world.provinces;
    all.forEach((p) => {
      p['exploredBy'] = { 0: 100 };
    });
    const p = ring1(b, 3);
    delete p['exploredBy'];
    delete (p as Partial<Province>).terrain;
    delete p.visitedBy;
    after(b);
    expect([(p['exploredBy'] as Raw)['0'], p['explored'], p.visitedBy]).toEqual([100, 100, []]);
    expect(texts(b)).toEqual([charts(p, 'unknown terrain')]);
  });

  test('the Observatory leaves a list of visitors as it is', () => {
    const b = fresh();
    knows(b, 0, 'sd39');
    b.G.world.provinces.forEach((p) => {
      p['exploredBy'] = { 0: 100 };
    });
    const p = ring1(b, 3);
    p['exploredBy'] = { 0: 10 };
    const visits = [1, 2];
    p.visitedBy = visits;
    after(b);
    expect(p.visitedBy).toBe(visits);
    expect(visits).toEqual([1, 2]);
  });

  test('a save with no graveyard gets an empty one; a grave whose hero has no record is left as it is', () => {
    const b = fresh();
    delete G(b)['heroGraveyard'];
    after(b);
    expect(G(b)['heroGraveyard']).toEqual([]);
    const b2 = fresh();
    b2.G.turn = 3;
    const d = fallenHero(b2, 0, b2.X);
    consecrated(b2, 0, home(b2));
    b2.G.characters = b2.G.characters.filter((c) => c !== d);
    after(b2);
    expect([graveyard(b2).map((g) => g['id']), texts(b2)]).toEqual([[d.id], []]);
  });

  test('a grave that records no turn of death counts as turn 0: due once the turn is 2', () => {
    const b = fresh();
    b.G.turn = 1;
    const d = fallenHero(b, 0, b.X);
    delete must(graveOf(b, d), 'the grave')['killedOnTurn'];
    consecrated(b, 0, home(b));
    after(b);
    expect(d.alive).toBe(true);
  });

  test('a hero of 1 HP at most rises with 8; a grave’s realm missing from the list is no Divine realm’s', () => {
    const b = fresh();
    b.G.turn = 3;
    const d = fallenHero(b, 0, b.X, { maxHp: 1 });
    consecrated(b, 0, home(b));
    const lost = fallenHero(b, 0, b.X);
    must(graveOf(b, lost), 'the grave')['player'] = 7;
    after(b);
    expect([d.alive, d.hp, lost.alive]).toEqual([true, 8, false]);
    expect(texts(b)).toEqual([risesIn(d, home(b), 8)]);
  });

  test('the body is measured from where the grave lies, not where the hero’s record last stood', () => {
    const b = fresh();
    b.G.turn = 3;
    const near = ring2(b, 7);
    holdsOnly(b, 0, [home(b), 10], [near, 5]);
    consecrated(b, 0, home(b), near);
    const d = fallenHero(b, 0, ring1(b, 3));
    d.location = ring2(b, 1).id;
    after(b);
    expect(d.location).toBe(near.id);
  });

  test('a risen hero is no longer marked killed this turn', () => {
    const b = fresh();
    b.G.turn = 3;
    const d = fallenHero(b, 0, b.X);
    d['killedThisTurn'] = true;
    consecrated(b, 0, home(b));
    after(b);
    expect([d.alive, d['killedThisTurn']]).toEqual([true, false]);
  });

  test('a king the divine promised rises crowned, even if his record was no longer marked king', () => {
    const b = fresh();
    b.G.turn = 3;
    const k = kingFalls(b, 0, { awaitsReturn: true, killedOnTurn: 2 });
    k.isKing = false;
    consecrated(b, 0, home(b));
    after(b);
    expect([k.alive, k.isKing]).toEqual([true, true]);
  });

  test('a Divine king promised his return with no consecrated ground left loses the promise with the grace', () => {
    const b = fresh();
    b.G.turn = 3;
    const k = kingFalls(b, 0, { awaitsReturn: true, killedOnTurn: 2 });
    after(b);
    expect([k.alive, marks(k, ['_divineReturn']), graveOf(b, k)?.['_divineLost']]).toEqual([false, [], true]);
    expect(texts(b)).toEqual([notReturn(k)]);
  });

  test('a king who rises keeps his realm’s other marks; a realm with no hold on his body is left as it is', () => {
    const b = fresh();
    b.G.turn = 3;
    const k = kingFalls(b, 0, { awaitsReturn: true, killedOnTurn: 2 });
    consecrated(b, 0, home(b));
    after(b);
    expect([k.isKing, k.alive, '_resurrectableMonarchId' in realm(b, 0)]).toEqual([true, true, false]);
    expect(texts(b)).toEqual([risesIn(k, home(b), 10, true)]);
  });

  test('a living Divine hero with a grave of the turn before is “raised” all the same: stripped, moved, the ground spent (today’s rule; Parked)', () => {
    const b = fresh();
    b.G.turn = 3;
    const h = leads(standing(b, 0, b.X), [unit('A', 'Men-at-Arms')]);
    ghostGrave(b, h, 2);
    consecrated(b, 0, home(b));
    after(b);
    expect([h.alive, h.hp, h.armies.length, h.location, realm(b, 0)['consecratedProvIds']]).toEqual([
      true,
      10,
      0,
      home(b).id,
      [],
    ]);
    expect(texts(b)).toEqual([risesIn(h, home(b), 10)]);
  });

  test('graves roll one die each, in turn: each rots at or under its ground’s rate', () => {
    const b = fresh();
    const p = ring1(b, 3);
    graves(p, 3);
    rolled(b, [0.1, 0.5, 0.05]);
    expect((p['battleGraves'] as Raw[]).map((g) => g['unitName'])).toEqual(['Grave 1']);
  });

  test('a grave-keeping effect that names no rate keeps the ground’s own: 10%', () => {
    const b = fresh();
    graves(home(b), 2);
    standIn(b, ['discEff'], () => after(b, 0.07), {
      discEff: (...a) => (a[2] === 'graveDecay' ? [{ kind: 'graveDecay' }] : []),
    });
    expect(gravesIn(home(b))).toBe(0);
  });

  test('a wanderer with no maximum HP keeps the HP he has', () => {
    const b = fresh();
    const w = wounded(wanderer(b, NO_TITLE_SKILLS), 7);
    delete (w as Partial<Character>).maxHp;
    after(b);
    expect(w.hp).toBe(7);
  });

  test('a province with no graves, or an empty list, rolls nothing', () => {
    const b = fresh();
    const p = ring1(b, 3);
    p['battleGraves'] = [];
    knows(b, 0, 'sd08');
    leads(kingOf(b, 0), [unit('A', 'Men-at-Arms')]);
    rolled(b, [0.5, 0]);
    expect([gravesIn(p), texts(b)]).toEqual([0, [noDrill(home(b))]]);
  });

  test('graves on ground a realm missing from the list holds rot as on ordinary ground', () => {
    const b = fresh();
    const p = ring1(b, 3);
    graves(p, 2);
    p.owner = 7;
    after(b, 0.07);
    expect(gravesIn(p)).toBe(0);
  });

  test('each band rolls to retire, then, staying, for where it goes: in turn', () => {
    const b = fresh();
    const p = ring1(b, 3);
    band(b, p, 'One');
    band(b, p, 'Two');
    band(b, p, 'Three');
    rolled(b, [0.1, 0.3, 0, 0.9, 0.99999]);
    const ring = landAround(b, p);
    expect((b.G.mercenaries ?? []).map((m) => [m['unitName'], m.location])).toEqual([
      ['Two', must(ring[0], 'the first').id],
      ['Three', must(ring.at(-1), 'the last').id],
    ]);
    expect(texts(b)).toEqual([retires('One', p)]);
  });

  test('a band standing nowhere on the map stays where it is, and one retiring there was in “unknown”', () => {
    const b = fresh();
    band(b, ring1(b, 3), 'Lost', { location: 999 });
    band(b, ring1(b, 3), 'Gone', { location: 998 });
    rolled(b, [0.5, 0.1]);
    expect((b.G.mercenaries ?? []).map((m) => [m['unitName'], m.location])).toEqual([['Lost', 999]]);
    expect(texts(b)).toEqual([retires('Gone', 'unknown')]);
  });

  test('a save with no mercenary list, or an empty one, rolls nothing for them', () => {
    const b = fresh();
    delete (b.G as Partial<Board['G']>).mercenaries;
    const w = wanderer(b, NO_TITLE_SKILLS);
    rolled(b, [0.3, 0]);
    expect(w.location).toBe(must(landAround(b, b.X)[0], 'the first').id);
  });

  test('the repairs told: 2 heroes renamed and 1 discovery retired, from the counts the turn’s start leaves; none at 0', () => {
    const b = fresh();
    G(b)['_nameRepairs'] = 2;
    found(b).retiredSageDiscoveriesRemoved = 1;
    after(b);
    expect(texts(b)).toEqual([renamed(2), discoveriesRetired(1)]);
    expect([G(b)['_nameRepairs'], '_retiredDiscoveries' in G(b)]).toEqual([0, false]);
    const b2 = fresh();
    G(b2)['_nameRepairs'] = 1;
    found(b2).retiredSageDiscoveriesRemoved = 0;
    after(b2);
    expect([texts(b2), '_retiredDiscoveries' in G(b2)]).toEqual([[renamed(1)], false]);
    const b3 = fresh();
    found(b3).retiredSageDiscoveriesRemoved = 2;
    after(b3);
    expect(texts(b3)).toEqual([discoveriesRetired(2)]);
  });

  test('each realm notes the graves it sees once, whatever their order; a grave with no place, or a king’s, is never noted', () => {
    const b = fresh();
    const d1 = fallenHero(b, 1, home(b), { killedOnTurn: b.G.turn });
    const d2 = fallenHero(b, 1, home(b), { killedOnTurn: b.G.turn });
    const nowhere = fallenHero(b, 1, home(b), { killedOnTurn: b.G.turn });
    must(graveOf(b, nowhere), 'the grave')['location'] = null;
    const k = kingFalls(b, 2);
    must(graveOf(b, k), 'the grave')['location'] = home(b).id;
    realm(b, 0)['knownDeadHeroIds'] = [d2.id];
    after(b);
    expect(realm(b, 0)['knownDeadHeroIds']).toEqual([d2.id, d1.id]);
  });

  test('a hero with no place on the map gives his realm no sight; a stale grave of a hero purged leaves the others', () => {
    const b = fresh();
    const d = fallenHero(b, 1, ring1(b, 3), { killedOnTurn: b.G.turn });
    const h = standing(b, 0, ring1(b, 3));
    h.location = null as never;
    const w = wanderer(b, NO_TITLE_SKILLS);
    ghostGrave(b, w);
    after(b);
    expect([realm(b, 0)['knownDeadHeroIds'], graveyard(b).map((g) => g['id'])]).toEqual([[], [d.id]]);
    expect(texts(b)).toEqual([staleGrave(w.name)]);
  });

  test('wanderers roll to drift, then where to, each in turn; one standing nowhere on the map stays', () => {
    const b = fresh();
    const w1 = wanderer(b, NO_TITLE_SKILLS);
    const w2 = wanderer(b, NO_TITLE_SKILLS, { at: ring1(b, 1) });
    const w3 = wanderer(b, NO_TITLE_SKILLS, { at: ring1(b, 3) });
    const w4 = wanderer(b, NO_TITLE_SKILLS, { at: ring1(b, 4) });
    w4.location = 999;
    rolled(b, [0.35, 0.99999, 0.36, 0.1, 0, 0.2]);
    expect([w1.location, w2.location, w3.location, w4.location]).toEqual([
      must(landAround(b, b.X).at(-1), 'the last').id,
      ring1(b, 1).id,
      must(landAround(b, ring1(b, 3))[0], 'the first').id,
      999,
    ]);
  });

  test('a wanderer drifts out of a province with no list and into one with none', () => {
    const b = fresh();
    const w = wanderer(b, NO_TITLE_SKILLS);
    delete (b.X as Partial<Province>).characters;
    const to = must(landAround(b, b.X)[0], 'the first');
    delete (to as Partial<Province>).characters;
    const calls = standIn(b, ['reconcileProvinceCharacters'], () => rolled(b, [0.3, 0]), {
      reconcileProvinceCharacters: () => undefined,
    });
    expect([calls.length, b.X.characters, to.characters, w['locationName']]).toEqual([1, [], [w.id], to.name]);
  });

  test('every province’s list is rebuilt from where each hero stands, the fallen kept where they fell', () => {
    const b = fresh();
    const h = standing(b, 0, b.X);
    const d = fallenHero(b, 1, ring1(b, 3), { killedOnTurn: b.G.turn });
    b.X.characters = [];
    ring1(b, 3).characters = [h.id, h.id];
    after(b);
    expect([b.X.characters, ring1(b, 3).characters]).toEqual([[h.id], [d.id]]);
  });

  test('a neutral guard with no companies, or standing in a realm’s land, is a wanderer; one holding unowned ground with his companies, or fallen, keeps his post', () => {
    const b = fresh();
    const bare = guard(b, ring1(b, 3), []);
    const inLand = guard(b, home(b), [unit('W', 'Men-at-Arms')]);
    const holding = guard(b, ring1(b, 4), [unit('W', 'Men-at-Arms')]);
    const dead = guard(b, ring1(b, 5), []);
    dead.alive = false;
    after(b);
    expect([bare, inLand, holding, dead].map((g) => [g._isNeutralGuard, g.name.endsWith(' (wandering)')])).toEqual([
      [false, true],
      [false, true],
      [true, false],
      [true, false],
    ]);
  });

  test('a summoned company still with a guard keeps him at his post: the summons leave in the first part', () => {
    const b = fresh();
    const g = guard(b, ring1(b, 3), [summoned('Blaze')]);
    after(b);
    expect(g._isNeutralGuard).toBe(true);
  });
});

// ── Properties ───────────────────────────────────────────────────────────────────────────────────────────────────
const GRADES = ['Green', 'Average', 'Veteran', 'Crack', 'Elite'];
describe('The new turn’s second part: properties', () => {
  test('the War Academy drills exactly the companies at home that may rise and whose die falls under 7%, each a grade, each told; or says none rose', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            grade: fc.integer({ min: 0, max: 4 }),
            skeletal: fc.boolean(),
            home: fc.boolean(),
            die: fc.constantFrom(0, 0.03, 0.0699, 0.07, 0.5),
          }),
          { maxLength: 6 },
        ),
        (spec) => {
          const b = fresh();
          knows(b, 0, 'sd08');
          const at = spec.map((x, i) =>
            leads(standing(b, 0, x.home ? home(b) : b.X), [
              unit(
                `U${String(i)}`,
                'Men-at-Arms',
                must(GRADES[x.grade], 'grade'),
                'Human',
                x.skeletal ? { _isSkeletal: true } : {},
              ),
            ]),
          );
          const may = spec.map((x, i) => [x, i] as const).filter(([x]) => x.home && !x.skeletal && x.grade < 4);
          rolled(b, [...may.map(([x]) => x.die), 0.5]);
          const rose = new Set(may.filter(([x]) => x.die < 0.07).map(([, i]) => i));
          expect(at.map((h) => h.armies[0]?.quality)).toEqual(
            spec.map((x, i) => GRADES[x.grade + (rose.has(i) ? 1 : 0)]),
          );
          const drills = may
            .filter(([, i]) => rose.has(i))
            .map(([x, i]) =>
              drilled(unit(`U${String(i)}`, 'Men-at-Arms'), home(b), must(GRADES[x.grade + 1], 'grade')),
            );
          expect(texts(b).filter((t) => t.startsWith('War Academy'))).toEqual(
            may.length > 0 && rose.size === 0 ? [noDrill(home(b))] : drills,
          );
        },
      ),
      { seed: SEED, numRuns: 150 },
    );
  });

  test('each wounded living hero of a realm with gardens is mended by what it knows, the king’s mending for the king only, never past his maximum; nobody else', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            realm: fc.integer({ min: 0, max: 2 }),
            king: fc.boolean(),
            hp: fc.integer({ min: 0, max: 22 }),
            alive: fc.boolean(),
          }),
          { maxLength: 6 },
        ),
        fc.array(fc.subarray(['sd65', 'sd72']), { minLength: 3, maxLength: 3 }),
        (spec, discs) => {
          const b = fresh();
          discs.forEach((ds, pi) => {
            knows(b, pi, ...ds);
          });
          b.G.characters = b.G.characters.filter((c) => !c.isKing);
          const hs = spec.map((x) => {
            const h = standing(b, x.realm, b.X);
            Object.assign(h, { isKing: x.king, hp: x.hp, alive: x.alive });
            return h;
          });
          after(b);
          expect(hs.map((h) => h.hp)).toEqual(
            spec.map((x) => {
              const ds = must(discs[x.realm], 'discoveries');
              const sum = (ds.includes('sd65') ? 3 : 0) + (ds.includes('sd72') && x.king ? 4 : 0);
              return x.alive && x.hp < 20 ? Math.min(20, x.hp + sum) : x.hp;
            }),
          );
        },
      ),
      { seed: SEED, numRuns: 150 },
    );
  });

  test('graves rot exactly when their die is at or under their ground’s rate: 10%, 5% on an Undead realm’s, none under the Embalmers on its own', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            ground: fc.constantFrom('open', 'undead', 'embalmed'),
            die: fc.constantFrom(0.01, 0.05, 0.07, 0.1, 0.2),
          }),
          { minLength: 1, maxLength: 8 },
        ),
        (spec) => {
          const b = fresh();
          creed(b, 1, 'Undead');
          creed(b, 2, 'Undead');
          knows(b, 2, 'az08');
          const ps = { open: ring1(b, 3), undead: seatOf(b, 1), embalmed: seatOf(b, 2) };
          Object.values(ps).forEach((p) => {
            p['battleGraves'] = [];
          });
          spec.forEach((x, i) => {
            (ps[x.ground]['battleGraves'] as Raw[]).push({ unitName: `G${String(i)}` });
          });
          const order = b.G.world.provinces.flatMap((p) =>
            ((p['battleGraves'] as Raw[] | undefined) ?? []).map((g) => g['unitName']),
          );
          const byName = new Map(spec.map((x, i) => [`G${String(i)}`, x]));
          rolled(
            b,
            order.map((n) => must(byName.get(String(n)), 'grave').die),
          );
          const rate = { open: 0.1, undead: 0.05, embalmed: 0 };
          const left = Object.values(ps).flatMap((p) => (p['battleGraves'] as Raw[]).map((g) => g['unitName']));
          expect(left.sort()).toEqual(
            spec
              .map((x, i) => [x, `G${String(i)}`] as const)
              .filter(([x]) => x.die > rate[x.ground])
              .map(([, n]) => n)
              .sort(),
          );
        },
      ),
      { seed: SEED, numRuns: 150 },
    );
  });

  test('each band retires (told, once) or moves on to a province around it of its own kind, or stays with none; each wanderer stays or drifts to land around him, listed only there', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ sea: fc.boolean(), at: fc.integer({ min: 0, max: 5 }) }), { maxLength: 4 }),
        fc.array(fc.integer({ min: 0, max: 5 }), { maxLength: 3 }),
        fc.array(fc.boolean(), { minLength: 6, maxLength: 6 }),
        fc.array(fc.double({ min: 0, max: 0.99999, noNaN: true }), { minLength: 20, maxLength: 20 }),
        (bs, ws, seaRing, dice) => {
          const b = fresh();
          b.ring1.forEach((p, i) => {
            p.terrain = seaRing[i] ? 'sea' : 'plain';
          });
          const ms = bs.map((x, i) =>
            band(b, b.X, `B${String(i)}`, { isSea: x.sea, location: must(b.ring1[x.at], 'p').id }),
          );
          const was = ms.map((m) => m.location);
          const wd = ws.map((i) => wanderer(b, NO_TITLE_SKILLS, { at: must(b.ring1[i], 'p') }));
          const from = wd.map((w) => w.location);
          rolled(b, dice);
          const left = new Map((b.G.mercenaries ?? []).map((m) => [m['unitName'], m]));
          const fates = ms.map((m, i) => {
            const name = `B${String(i)}`;
            const p = must(b.G.world.provinces[must(was[i], 'was')], 'p');
            const kin = around(b, p).filter((q) => ((m as Raw)['isSea'] ? q.terrain === 'sea' : q.terrain !== 'sea'));
            const now = left.get(name);
            const toldOf = texts(b).filter((t) => t === retires(name, p)).length;
            return now
              ? ['moved on', toldOf, (kin.length ? kin.map((q) => q.id) : [p.id]).includes(now.location)]
              : ['retired', toldOf];
          });
          expect(fates).toEqual(fates.map((f) => (f[0] === 'retired' ? ['retired', 1] : ['moved on', 0, true])));
          expect(
            wd.map((w, i) => {
              const p = must(b.G.world.provinces[must(from[i], 'from')], 'p');
              return [
                [p.id, ...landAround(b, p).map((q) => q.id)].includes(w.location),
                b.G.world.provinces.filter((q) => q.characters.includes(w.id)).map((q) => q.id),
              ];
            }),
          ).toEqual(wd.map((w) => [true, [w.location]]));
        },
      ),
      { seed: SEED, numRuns: 150 },
    );
  });

  test('a Divine hero rises only when due, on holy ground his realm held, spending it, each ground once; every other stays in his grave', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            realm: fc.integer({ min: 0, max: 2 }),
            ago: fc.integer({ min: 0, max: 2 }),
            at: fc.integer({ min: 0, max: 5 }),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        fc.array(fc.subarray([0, 1, 2, 3]), { minLength: 3, maxLength: 3 }),
        fc.array(fc.constantFrom('Divine', 'Pagan'), { minLength: 3, maxLength: 3 }),
        (spec, holy, creeds) => {
          const b = fresh();
          b.G.turn = 5;
          const lands = (pi: number) => [0, 1, 2, 3].map((k) => must(b.ring2[pi * 4 + k], 'p'));
          creeds.forEach((cr, pi) => {
            creed(b, pi, cr);
            holdsOnly(b, pi, ...lands(pi).map((p) => [p, 5] as [Province, number]));
            consecrated(b, pi, ...must(holy[pi], 'holy').map((k) => must(lands(pi)[k], 'p')));
          });
          const before = creeds.map((_, pi) => [...(realm(b, pi)['consecratedProvIds'] as number[])]);
          const ds = spec.map((x) => fallenHero(b, x.realm, must(b.ring1[x.at], 'p'), { killedOnTurn: 5 - x.ago }));
          after(b);
          creeds.forEach((cr, pi) => {
            const risen = ds.filter((d, i) => d.alive && spec[i]?.realm === pi);
            const due = spec.filter((x) => x.realm === pi && x.ago >= 1).length;
            const left = realm(b, pi)['consecratedProvIds'] as number[];
            expect(risen.length).toBe(cr === 'Divine' ? Math.min(due, must(before[pi], 'b').length) : 0);
            expect(left.length).toBe(must(before[pi], 'b').length - risen.length);
            expect(new Set(risen.map((d) => d.location)).size).toBe(risen.length);
            risen.forEach((d) => {
              expect(must(before[pi], 'b')).toContain(d.location);
              expect(left).not.toContain(d.location);
            });
          });
          expect(ds.map((d) => [d.alive, !!graveOf(b, d)])).toEqual(ds.map((d) => [d.alive, !d.alive]));
          expect(ds.filter((d, i) => d.alive && must(spec[i], 's').ago < 1)).toEqual([]);
        },
      ),
      { seed: SEED, numRuns: 150 },
    );
  });

  test('every province ends listing exactly the heroes standing in it, however its list began', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ at: fc.integer({ min: 0, max: 5 }), alive: fc.boolean() }), { maxLength: 6 }),
        fc.array(fc.array(fc.integer({ min: 0, max: 9 }), { maxLength: 4 }), { minLength: 6, maxLength: 6 }),
        (spec, junk) => {
          const b = fresh();
          const hs = spec.map((x) => {
            const h = standing(b, 0, must(b.ring1[x.at], 'p'));
            h.alive = x.alive;
            return h;
          });
          b.ring1.forEach((p, i) => {
            p.characters = must(junk[i], 'junk').map((k) => hs[k]?.id ?? 4000 + k);
          });
          after(b);
          b.G.world.provinces.forEach((p) => {
            expect(p.characters).toEqual(b.G.characters.filter((c) => c.location === p.id).map((c) => c.id));
          });
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });
});
