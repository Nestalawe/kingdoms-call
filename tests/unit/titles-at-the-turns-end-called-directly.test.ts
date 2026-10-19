// The titles at the turn's end (plan P1-08k6: src/engine/titles/, the last two stages lifted out of resolveTurn's own
// body), called directly in the bare vm on the middle of a bot world (lib/middle-of-a-bot-world.ts). First the cases
// scenario/titles-at-the-turns-end-in-a-whole-turn plays through a whole turn (lib/titles-at-the-turns-end-cases.ts),
// here played through the two stages alone, as resolveTurn calls them once the new turn is done (the counter moved on,
// no phase current, every line filed after the phases), but for those only a whole turn can stage (the treasuries
// after the turn's taxes and wages, espionage worked by an order); then, with the helpers they call stood in (each
// replaced in the vm by a recorder for the test's length), what they hand them and when, and where resolveTurn calls
// them; then what the whole turn can't stage: the standings failing, a save with no turn, realms with no name or no
// record of whom they have met, heroes and provinces the map doesn't place, the dice of the Loremaster's copy in turn,
// the dead a realm saw fall this turn, every act the Spymaster's ledger can hold, titles held by nobody's hero. Properties
// (fast-check): the Throne tells its holder its own share and exactly each realm it has met, and how many it hasn't;
// the Loremaster copies exactly one fresh discovery a met realm holds and the holder lacks, or none; the Archmage names
// the foremost mage of each school it may; a title is won only by its holder's realm and lost only by the realm that
// held it, never both, and on the first public turn nothing is lost.
// Level 1: two functions, called with the context resolveTurn hands them.
import vm from 'node:vm';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { withCaseDice } from '../lib/espionage-order-cases.ts';
import {
  LANDS,
  MAJOR_KEYS,
  MINOR_KEYS,
  TITLE_CASES,
  allMet,
  deeds,
  firstPublic,
  gains,
  holders,
  intel,
  lastTurn,
  losses,
  meets,
  said,
  snapshot,
  stageCase,
  titled,
  titlesTold,
  unmetLine,
  type Outcome,
  type TitleCase,
} from '../lib/titles-at-the-turns-end-cases.ts';
import { kingOf, seatOf } from '../lib/new-turn-succession-and-summons-cases.ts';
import { fallenHero } from '../lib/new-turn-war-academy-to-the-final-reconcile-cases.ts';
import { taxes } from '../lib/diplomacy-and-victory-cases.ts';
import { realm, ring1, ring2, wanderer } from '../lib/cast-spell-order-cases.ts';
import { board, must, playTurn, withDice, type Board, type Character } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
type Fn = (...a: unknown[]) => unknown;
type Raw = Record<string, unknown>;
const INTEL = 'imperialTitleIntelEachHoldersReportOnRivalRealmsAndTheLoremastersCopy';
const CHANGES = 'titleChangesTheTitlesEachRealmWonAndLostSinceLastTurn';
const titleIntel = engineFn(engine, INTEL) as Fn;
const titleChanges = engineFn(engine, CHANGES) as Fn;
const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

const tc = (b: Board) => b.tc as unknown as Raw & Board['tc'];
const G = (b: Board) => b.G as unknown as Raw & Board['G'];
/** The two stages, as resolveTurn calls them once the new turn is done: the counter moved on, no phase current, every
 *  line filed after the phases, the log's context cleared; the intel, then the changes. Gives back the turn played. */
const settle = (b: Board) => {
  const turn = b.G.turn;
  b.G.turn = turn + 1;
  tc(b)._currentPhase = null;
  tc(b)['_afterPhases'] = true;
  b.tc._logCtx = { charId: null, phase: null };
  titleIntel(b.tc);
  titleChanges(b.tc);
  return turn;
};
const outcome = (b: Board, turn: number): Outcome => ({ world: b.G, all: b.lines(), turn });
/** A board staged as every case is (`stageCase`): plain realms, each holding only its seat with a living king there. */
const fresh = () => {
  const b = board(engine, world, 4);
  stageCase(b, { name: 'nothing staged', stage: () => ({ orders: [] }), check: () => ({ got: {}, want: {} }) });
  return b;
};
/** The stages on `b` with every die at `die` and every percentile roll at 1. */
const after = (b: Board, die = LANDS.die) => {
  let turn = 0;
  withCaseDice(engine, { roll: 1, die }, () => {
    turn = settle(b);
  });
  return outcome(b, turn);
};
/** The stages on `b` with the dice drawn in turn from `dice`. */
const rolled = (b: Board, dice: number[]) => {
  let turn = 0;
  withDice(engine, dice, () => {
    turn = settle(b);
  });
  return outcome(b, turn);
};
/** The name of realm `pi` on `b`. */
const nameOf = (b: Board, pi: number) => must(b.G.players[pi], 'realm ' + String(pi)).name;
const label = (k: string) =>
  (JSON.parse(vm.runInContext('JSON.stringify(SKILL_LABELS)', engine) as string) as Record<string, string>)[k];

const DIRECT = TITLE_CASES.map(([part, cases]) => [part, cases.filter((c) => !c.wholeTurnOnly)] as const).filter(
  ([, cases]) => cases.length > 0,
);
describe.each(DIRECT)('%s, through the stages called directly', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c: TitleCase) => {
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

// ── What the stages hand the helpers they call ───────────────────────────────────────────────────────────────────
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
const throws = () => {
  throw new Error('the standings fail');
};

describe('The titles at the turn’s end: what they call', () => {
  test('the intel works out the standings once, from the save, and only once titles are public; the changes work out both kinds of title once each', () => {
    const b = fresh();
    const calls = standIn(b, ['computeStandings', 'computeMinorTitles'], () => after(b));
    expect(calls.map((c) => [c.fn, c.args.length, c.args[0] === b.G])).toEqual([
      ['computeStandings', 1, true],
      ['computeMinorTitles', 1, true],
    ]);
    const p = fresh();
    firstPublic(p);
    const publicCalls = standIn(p, ['computeStandings', 'computeMinorTitles'], () => after(p));
    expect(publicCalls.map((c) => [c.fn, c.args[0] === p.G])).toEqual([
      ['computeStandings', true],
      ['computeStandings', true],
      ['computeMinorTitles', true],
    ]);
  });

  test('the Throne’s own share is rounded down by dispFloor from the exact share; the rivals’ are rounded', () => {
    const b = fresh();
    firstPublic(b);
    taxes(b, 10, 5, 2);
    meets(b, 0, 1, 2);
    const calls = standIn(b, ['dispFloor'], () => after(b));
    expect(calls.map((c) => c.args)).toEqual([[(100 * 10) / 17]]);
  });

  test('the Grand Marshal and the Sea Lord measure each company by its base strength', () => {
    const b = fresh();
    firstPublic(b);
    const m = titled(b, 0, seatOf(b, 0), { tactical: 1 }, [
      { type: 'Men-at-Arms', quality: 'Average', race: 'Human', unitName: 'A' },
    ]);
    const calls = standIn(b, ['unitBaseStrength'], () => after(b), { unitBaseStrength: () => 7 });
    expect(calls.length > 0 && calls.every((c) => (c.args[0] as Raw)['unitName'] === 'A')).toBe(true);
    expect(intel(outcome(b, 4), 'The Grand Marshal')[0]?.[1]).toBe(
      `[The Grand Marshal] Your realm: strongest land army led by ${m.name} in ${seatOf(b, 0).name} (strength 7).`,
    );
  });

  test('Grave-sight files each find with the holder’s realm, the province, the new turn, only the crack and elite dead, as partial', () => {
    const b = fresh();
    firstPublic(b);
    titled(b, 0, seatOf(b, 0), { necromancy: 1 });
    const p = ring1(b, 2);
    const crack = { type: 'Men-at-Arms', quality: 'Crack', race: 'Human', unitName: 'C' };
    const elite = { type: 'Men-at-Arms', quality: 'Elite', race: 'Human', unitName: 'E' };
    p['battleGraves'] = [crack, { type: 'Men-at-Arms', quality: 'Veteran', race: 'Human', unitName: 'V' }, elite];
    const calls = standIn(b, ['noteGraveIntel'], () => after(b));
    expect(calls.map((c) => [c.args[0] === realm(b, 0), c.args[1], c.args[2], c.args[3], c.args[4]])).toEqual([
      [true, p.id, 5, [crack, elite], { partial: true }],
    ]);
    expect(calls[0]?.before).toBe(b.lines().findIndex((l) => l.text.startsWith('[The Deathpriest] Grave-sight:')));
  });

  test('resolveTurn calls the intel, then the changes, once each, with its context, after the new turn is done', () => {
    const b = fresh();
    firstPublic(b);
    const order: string[] = [];
    const g = engine as unknown as Record<string, unknown>;
    const names = [
      'newTurnWarAcademyInformantsDivineResurrectionGravesMercenariesWanderersAndTheFinalReconcile',
      INTEL,
      CHANGES,
    ];
    const was = names.map((f) => [f, g[f] as Fn] as const);
    const handed: unknown[] = [];
    for (const [f, w] of was)
      g[f] = (...a: unknown[]) => {
        order.push(f);
        handed.push(a);
        return w(...a);
      };
    let played;
    try {
      played = withCaseDice(engine, LANDS, () => playTurn(b, {}));
    } finally {
      for (const [f, w] of was) g[f] = w;
    }
    expect(order).toEqual(names);
    expect(handed.map((a) => (a as unknown[]).length)).toEqual([1, 1, 1]);
    const [first, intelArgs, changesArgs] = handed as unknown[][];
    expect([intelArgs?.[0] === first?.[0], changesArgs?.[0] === first?.[0]]).toEqual([true, true]);
    expect((played.after as unknown as Raw)['_titlesSnapshot']).toBeDefined();
  });
});

// ── What only a direct call can stage ────────────────────────────────────────────────────────────────────────────
describe('The titles at the turn’s end: what only a direct call can stage', () => {
  test('if the standings fail, no title tells anything, and the snapshot keeps no holder', () => {
    const b = fresh();
    firstPublic(b);
    let o: Outcome | undefined;
    standIn(
      b,
      ['computeStandings'],
      () => {
        o = after(b);
      },
      { computeStandings: throws },
    );
    const out = must(o, 'the outcome');
    expect([said(out), gains(out), losses(out), snapshot(out)]).toEqual([
      [],
      {},
      {},
      { major: {}, minor: {}, wasPublic: true },
    ]);
  });

  test('if only the minor titles fail, the snapshot keeps no holder of either kind: nothing is won', () => {
    const b = fresh();
    firstPublic(b);
    let o: Outcome | undefined;
    standIn(
      b,
      ['computeMinorTitles'],
      () => {
        o = after(b);
      },
      { computeMinorTitles: throws },
    );
    const out = must(o, 'the outcome');
    expect([titlesTold(out).length, gains(out), snapshot(out)]).toEqual([
      2,
      {},
      { major: {}, minor: {}, wasPublic: true },
    ]);
  });

  test('a save with no turn counts as turn 1 once moved on: not yet public', () => {
    const b = fresh();
    tc(b)._currentPhase = null;
    tc(b)['_afterPhases'] = true;
    b.tc._logCtx = { charId: null, phase: null };
    (b.G as unknown as Raw)['turn'] = null;
    titleIntel(b.tc);
    titleChanges(b.tc);
    expect([said(outcome(b, 0)), holders(outcome(b, 0)).wasPublic]).toEqual([[], false]);
  });

  test('turn 4 is not yet public and turn 5 is, as the stages see the turn', () => {
    const at4 = fresh();
    G(at4)['turn'] = 3;
    const at5 = fresh();
    G(at5)['turn'] = 4;
    expect([said(after(at4)).length, said(after(at5)).length]).toEqual([0, 4]);
  });

  test('a realm with no name is told as “Player <n>”; a realm with no record of whom it has met has met nobody', () => {
    const b = fresh();
    firstPublic(b);
    taxes(b, 10, 5, 2);
    meets(b, 0, 1, 2);
    must(b.G.players[1], 'realm 1').name = '';
    delete realm(b, 2)['_encountered'];
    meets(b, 0, 1, 2);
    const o = after(b);
    expect(intel(o, 'The Throne').map(([, t]) => t)).toEqual([
      '[The Throne] Your realm: 58% of the world tax base.',
      '[The Throne] Player 2: 29% of the world tax base.',
      `[The Throne] ${nameOf(b, 2)}: 12% of the world tax base.`,
    ]);
    const c = fresh();
    firstPublic(c);
    delete realm(c, 0)['_encountered'];
    expect(intel(after(c), 'The Throne').at(-1)?.[1]).toBe(unmetLine('The Throne', 2));
  });

  test('a gap in the list of realms is no realm unmet, and a realm with no treasury is told 0g', () => {
    const b = fresh();
    firstPublic(b);
    taxes(b, 10, 5, 2);
    delete realm(b, 1)['gold'];
    meets(b, 0, 1);
    (b.G.players as unknown as (Raw | null)[]).push(null);
    const o = after(b);
    (b.G.players as unknown as (Raw | null)[]).pop();
    expect(intel(o, 'The Vaultkeeper')).toEqual([
      [[0], '[The Vaultkeeper] Your realm: 30g in treasury.'],
      [[0], `[The Vaultkeeper] ${nameOf(b, 1)}: 0g in treasury.`],
      [[0], unmetLine('The Vaultkeeper', 1)],
    ]);
    const c = fresh();
    firstPublic(c);
    delete realm(c, 0)['gold'];
    expect(intel(withStandings(c, { vault: 1 }), 'The Vaultkeeper')[0]?.[1]).toBe(
      '[The Vaultkeeper] Your realm: 0g in treasury.',
    );
  });

  test('a commander standing nowhere on the map is in “unknown”; a hero with no list of companies leads none', () => {
    const b = fresh();
    firstPublic(b);
    const m = titled(b, 0, seatOf(b, 0), { tactical: 1 }, [
      { type: 'Men-at-Arms', quality: 'Average', race: 'Human', unitName: 'A' },
    ]);
    m.location = 9999;
    const k = kingOf(b, 0) as unknown as Raw;
    delete k['armies'];
    const o = after(b);
    expect(intel(o, 'The Grand Marshal')[0]?.[1]).toMatch(
      new RegExp(
        `^\\[The Grand Marshal\\] Your realm: strongest land army led by ${m.name} in unknown \\(strength \\d+\\)\\.$`,
      ),
    );
  });

  test('the Monster-Bane with no living slayer of its own (the standings say it holds it) says so', () => {
    const b = fresh();
    firstPublic(b);
    const o = withStandings(b, { monster: 0 });
    expect(intel(o, 'The Monster-Bane')[0]?.[1]).toBe(
      '[The Monster-Bane] Your champion: no hero of yours has drawn monster-blood.',
    );
  });

  test('the Loremaster’s copy: of three fresh discoveries, the die picks in turn, 0 the first, 0.5 the second', () => {
    const pick = (die: number) => {
      const b = fresh();
      firstPublic(b);
      allMet(b);
      titled(b, 0, seatOf(b, 0), { sage: 1 });
      realm(b, 1)['discoveries'] = [disc('sd04', 4), disc('sd05', 4)];
      realm(b, 2)['discoveries'] = [disc('sd06', 4)];
      delete realm(b, 0)['discoveries'];
      rolled(b, [die]);
      return (realm(b, 0)['discoveries'] as Raw[]).map((d) => [d['id'], d['turnDiscovered']]);
    };
    expect([pick(0), pick(0.5), pick(0.99)]).toEqual([[['sd04', 5]], [['sd05', 5]], [['sd06', 5]]]);
  });

  test('the Loremaster rolls no die with nothing to copy', () => {
    const b = fresh();
    firstPublic(b);
    allMet(b);
    titled(b, 0, seatOf(b, 0), { sage: 1 });
    let n = 0;
    const kcRng = vm.runInContext('kcRng', engine) as { use(next: () => number): () => number };
    const was = kcRng.use(() => {
      n++;
      return 0.5;
    });
    try {
      settle(b);
    } finally {
      kcRng.use(was);
    }
    expect(n).toBe(0);
  });

  test('the Archmage: a mage with no skills record is no mage; a mage standing nowhere on the map', () => {
    const b = fresh();
    firstPublic(b);
    allMet(b);
    titled(b, 0, seatOf(b, 0), { psychic: 3 });
    const r = titled(b, 1, seatOf(b, 1), { white: 2 });
    r.location = 9999;
    const bare = titled(b, 2, seatOf(b, 2), {});
    delete (bare as unknown as Raw)['skills'];
    expect(intel(after(b), 'The Archmage')[0]?.[1]).toBe(
      `[The Archmage] White: ${r.name} (Level 2) of ${nameOf(b, 1)} in unknown.`,
    );
  });

  test('the Hierophant also reads the dead the realm saw fall this turn, wherever they lie; a grave with no place only if its own', () => {
    const b = fresh();
    firstPublic(b);
    titled(b, 0, seatOf(b, 0), { white: 1 });
    const t = b.G.turn;
    const seen = fallenHero(b, 1, seatOf(b, 1), { killedOnTurn: t });
    const lost = fallenHero(b, 1, ring2(b, 4), { killedOnTurn: t });
    const own = fallenHero(b, 0, ring2(b, 5), { killedOnTurn: t });
    const graves = G(b)['heroGraveyard'] as Raw[];
    graves.forEach((g) => {
      if (g['id'] === lost.id || g['id'] === own.id) g['location'] = null;
    });
    graves.push(null as unknown as Raw);
    realm(b, 0)['seenDeadHeroIds'] = [seen.id];
    const o = after(b);
    expect(intel(o, 'The Hierophant').map(([, x]) => x)).toEqual([
      `[The Hierophant] The dead speak: ${seen.name} of ${nameOf(b, 1)} lying in ${seatOf(b, 1).name} — no skills the grave remembers.`,
      `[The Hierophant] The dead speak: ${own.name} of ${nameOf(b, 0)} lying in unknown — no skills the grave remembers.`,
    ]);
  });

  test('the Hierophant: the realm’s heroes standing nowhere give it no eyes; a skill with no label is named by its key; equal skills keep their order', () => {
    const b = fresh();
    firstPublic(b);
    holdsOnly0(b);
    titled(b, 0, b.X, { white: 1 });
    const off = titled(b, 0, b.X, {});
    (off as unknown as Raw)['location'] = null;
    const d = fallenHero(b, null, b.X, { killedOnTurn: b.G.turn });
    fallenHero(b, null, ring2(b, 2), { killedOnTurn: b.G.turn });
    (G(b)['heroGraveyard'] as Raw[]).forEach((g) => {
      if (g['id'] === d.id) g['skills'] = { melee: 2, sage: 2, mystery: 3, white: 0 };
    });
    expect(intel(after(b), 'The Hierophant').map(([, x]) => x)).toEqual([
      `[The Hierophant] The dead speak: ${d.name} lying in ${b.X.name} — mystery 3, ${String(label('melee'))} 2, ${String(label('sage'))} 2.`,
    ]);
  });

  test('Grave-sight skips a province with no graves list, an empty grave and a missing province', () => {
    const b = fresh();
    firstPublic(b);
    titled(b, 0, seatOf(b, 0), { necromancy: 1 });
    const p = ring1(b, 2);
    p['battleGraves'] = [null, { type: 'Men-at-Arms', quality: 'Elite', race: 'Human', unitName: 'E' }];
    const ps = b.G.world.provinces as unknown as (Raw | null)[];
    ps.push(null);
    const o = after(b);
    expect(intel(o, 'The Deathpriest').map(([, x]) => x)).toEqual([
      `[The Deathpriest] Grave-sight: ${p.name} holds 1 crack/elite dead. (Filed under Graveyards Known.)`,
    ]);
    ps.pop();
  });

  test('the Spymaster’s ledger: each act against its land, in order; a king marked; an agent with no name or no realm; the roll by count, most first', () => {
    const b = fresh();
    firstPublic(b);
    deeds(titled(b, 0, seatOf(b, 0), { spy: 9 }), { spyActions: 5 });
    const s0 = seatOf(b, 0).id;
    const elsewhere = seatOf(b, 1).id;
    G(b)['_espionageLedger'] = [
      { byPi: 1, charId: 1, charName: 'Ash', isKing: false, provId: s0, kind: 'spied out the province' },
      null,
      { byPi: 2, charId: 2, charName: 'Birch', isKing: true, provId: s0, kind: 'sabotaged the works' },
      { byPi: 1, charId: 1, charName: 'Ash', isKing: false, provId: s0, kind: 'stole from the treasury' },
      { byPi: null, charId: 3, isKing: false, provId: s0, kind: 'pried' },
      { byPi: 1, charId: 4, charName: 'Cedar', isKing: false, provId: elsewhere, kind: 'spied out the province' },
      { byPi: 0, charId: 5, charName: 'Own', isKing: false, provId: s0, kind: 'spied out the province' },
      { byPi: 1, charId: 6, charName: 'Nowhere', isKing: false, provId: 9999, kind: 'spied out the province' },
    ];
    const s = seatOf(b, 0).name;
    const [n1, n2] = [nameOf(b, 1), nameOf(b, 2)];
    expect(intel(after(b), 'The Spymaster').map(([, x]) => x)).toEqual([
      `[The Spymaster] Ash of ${n1} spied out the province in ${s}.`,
      `[The Spymaster] ♛ Birch of ${n2} sabotaged the works in ${s}.`,
      `[The Spymaster] Ash of ${n1} stole from the treasury in ${s}.`,
      `[The Spymaster] an unknown agent, unsworn to any crown pried in ${s}.`,
      `[The Spymaster] 4 intrusions into your lands this turn by 3 heroes: Ash (${n1}) ×2, Birch (${n2}), ?.`,
    ]);
  });

  test('the Spymaster with one intrusion by one hero: singular', () => {
    const b = fresh();
    firstPublic(b);
    deeds(titled(b, 0, seatOf(b, 0), { spy: 9 }), { spyActions: 5 });
    G(b)['_espionageLedger'] = [
      { byPi: 1, charId: 1, charName: 'Ash', isKing: false, provId: seatOf(b, 0).id, kind: 'pried' },
    ];
    expect(intel(after(b), 'The Spymaster').at(-1)?.[1]).toBe(
      `[The Spymaster] 1 intrusion into your lands this turn by 1 hero: Ash (${nameOf(b, 1)}).`,
    );
  });

  test('the Cartographer counts a province with no record of who mapped it as unmapped, and skips a missing one', () => {
    const b = fresh();
    firstPublic(b);
    titled(b, 0, seatOf(b, 0), { explorer: 1 });
    b.G.world.provinces.forEach((p) => {
      delete p['exploredBy'];
    });
    const half = b.G.world.provinces.slice(0, 40);
    half.forEach((p, k) => {
      p['exploredBy'] = { 0: k === 0 ? 100 : 99 };
    });
    const ps = b.G.world.provinces as unknown as (Raw | null)[];
    ps.push(null);
    const n = ps.length - 1;
    const o = after(b);
    ps.pop();
    expect(intel(o, 'The Cartographer')[0]?.[1]).toBe(
      `[The Cartographer] Your atlas: 1 province fully charted, ${String(Math.round(3961 / n))}% of the world mapped.`,
    );
    expect(Math.round(3961 / n)).not.toBe(Math.round(3961 / (n + 1)));
  });

  test('the Beastlord’s census skips a fallen hero, a gap in the companies, ground another realm holds, and a hero with no companies list', () => {
    const b = fresh();
    firstPublic(b);
    const c = deeds(titled(b, 0, seatOf(b, 0), {}, [null as unknown as never, troll('A')]), { monsterHost: 1 });
    const d = titled(b, 0, seatOf(b, 0), {}, [troll('B'), troll('C')]);
    d.alive = false;
    delete (titled(b, 0, seatOf(b, 0), {}) as unknown as Raw)['armies'];
    seatOf(b, 0).garrisonArmies = [null as unknown as never, troll('G')];
    seatOf(b, 1).garrisonArmies = [troll('H')];
    expect(intel(after(b), 'The Beastlord')[0]?.[1]).toBe(
      `[The Beastlord] Your realm: 2 monster units under arms, the largest host — 1 — with ${c.name} in ${seatOf(b, 0).name}.`,
    );
  });

  test('the Spymaster’s roll names each hero once, however many share a name or a realm, the most acts first', () => {
    const b = fresh();
    firstPublic(b);
    deeds(titled(b, 0, seatOf(b, 0), { spy: 9 }), { spyActions: 5 });
    const s0 = seatOf(b, 0).id;
    const act = (charId: number, charName: string, byPi: number) => ({
      byPi,
      charId,
      charName,
      isKing: false,
      provId: s0,
      kind: 'pried',
    });
    G(b)['_espionageLedger'] = [act(2, 'Birch', 2), act(1, 'Ash', 1), act(7, 'Ash', 1), act(1, 'Ash', 1)];
    const [n1, n2] = [nameOf(b, 1), nameOf(b, 2)];
    expect(intel(after(b), 'The Spymaster').at(-1)?.[1]).toBe(
      `[The Spymaster] 4 intrusions into your lands this turn by 3 heroes: Ash (${n1}) ×2, Birch (${n2}), Ash (${n1}).`,
    );
  });

  test('the Hierophant: a fallen hero of the realm gives it no eyes where he lies; a hero standing nowhere sees no grave without a place', () => {
    const b = fresh();
    firstPublic(b);
    titled(b, 0, seatOf(b, 0), { white: 1 });
    const own = fallenHero(b, 0, ring2(b, 4), { killedOnTurn: b.G.turn });
    G(b)['heroGraveyard'] = (G(b)['heroGraveyard'] as Raw[]).filter((g) => g['id'] !== own.id);
    fallenHero(b, 1, ring2(b, 4), { killedOnTurn: b.G.turn });
    const nowhere = fallenHero(b, 1, ring2(b, 5), { killedOnTurn: b.G.turn });
    (G(b)['heroGraveyard'] as Raw[]).forEach((g) => {
      if (g['id'] === nowhere.id) g['location'] = null;
    });
    (titled(b, 0, seatOf(b, 0), {}) as unknown as Raw)['location'] = null;
    expect(intel(after(b), 'The Hierophant').map(([, x]) => x)).toEqual([
      '[The Hierophant] No fallen hero lies where your priests can read them this turn.',
    ]);
  });

  test('the Wildwarden’s census skips a fallen hero’s creatures', () => {
    const b = fresh();
    firstPublic(b);
    const c = deeds(titled(b, 0, seatOf(b, 0), {}, [bear('A')]), { wildHost: 1 });
    titled(b, 0, seatOf(b, 0), {}, [bear('B'), bear('C')]).alive = false;
    expect(intel(after(b), 'The Wildwarden')[0]?.[1]).toBe(
      `[The Wildwarden] Your realm: 1 creature unit in the field, the greatest host — 1 — with ${c.name} in ${seatOf(b, 0).name}.`,
    );
  });

  test('a hero’s title a save records held by a realm but no hero is not lost by that realm when another realm’s hero takes it', () => {
    const b = fresh();
    G(b)['turn'] = 6;
    const k0 = kingOf(b, 0).id;
    const m = titled(b, 0, seatOf(b, 0), { tactical: 1 });
    lastTurn(
      b,
      true,
      { throne: [k0, 0], vault: [k0, 0], marshal: [null, 1] },
      { colossus: [k0, 0], castellan: [k0, 0], strategist: [m.id, 0] },
    );
    const o = after(b);
    expect([((gains(o) as Record<string, Raw[]>)[0] ?? []).map((g) => g['key']), losses(o)]).toEqual([['marshal'], {}]);
  });

  test('a hero who holds his title as he changes realms: neither realm wins or loses it (today’s rule)', () => {
    const b = fresh();
    G(b)['turn'] = 6;
    const k0 = kingOf(b, 0).id;
    const m = titled(b, 0, seatOf(b, 0), { tactical: 1 });
    lastTurn(
      b,
      true,
      { throne: [k0, 0], vault: [k0, 0], marshal: [m.id, 1] },
      { colossus: [k0, 0], castellan: [k0, 0], strategist: [m.id, 1] },
    );
    const o = after(b);
    expect([gains(o), losses(o)]).toEqual([{}, {}]);
  });

  test('a realm’s title taken by a realm with no living king: lost to that realm, not vacant, and no hero named', () => {
    const b = fresh();
    G(b)['turn'] = 6;
    kingOf(b, 0).alive = false;
    const k1 = kingOf(b, 1).id;
    taxes(b, 10, 5, 5);
    lastTurn(b, true, { throne: [k1, 1], vault: [k1, 1] }, {});
    const o = after(b);
    const lost = ((losses(o) as Record<string, Raw[]>)[1] ?? []).find((l) => l['key'] === 'throne');
    expect(lost && [lost['vacant'], lost['newHolderIndex'], lost['newCharName']]).toEqual([false, 0, null]);
  });

  test('the first public turn announces a realm’s title held by a realm with no living king', () => {
    const b = fresh();
    firstPublic(b);
    kingOf(b, 0).alive = false;
    const o = after(b);
    expect(((gains(o) as Record<string, Raw[]>)[0] ?? []).map((g) => [g['key'], g['charName']])).toEqual([
      ['throne', null],
      ['vault', null],
    ]);
  });

  test('if the standings fail after a public turn, every title held last turn is lost to nobody', () => {
    const b = fresh();
    G(b)['turn'] = 6;
    const k1 = kingOf(b, 1).id;
    lastTurn(b, true, { throne: [k1, 1] }, { colossus: [k1, 1] });
    let o: Outcome | undefined;
    standIn(
      b,
      ['computeStandings'],
      () => {
        o = after(b);
      },
      { computeStandings: throws },
    );
    const out = must(o, 'the outcome');
    expect(
      ((losses(out) as Record<string, Raw[]>)[1] ?? []).map((l) => [
        l['key'],
        l['vacant'],
        l['newHolderIndex'],
        l['newHolderName'],
      ]),
    ).toEqual([
      ['throne', true, null, null],
      ['colossus', true, null, null],
    ]);
  });

  test('a title held by a realm’s hero the roll of heroes no longer has: won with no hero’s name; a realm missing from the list has no name', () => {
    const b = fresh();
    firstPublic(b);
    const o = withMinor(b, { swift: { charId: 4242, playerIndex: 1 } });
    expect(
      ((gains(o) as Record<string, Raw[]>)[1] ?? []).map((g) => [g['key'], g['charName'], g['kingdomName']]),
    ).toEqual([['swift', null, nameOf(b, 1)]]);
    const c = fresh();
    firstPublic(c);
    const o2 = withMinor(c, { swift: { charId: kingOf(c, 1).id, playerIndex: 7 } });
    expect(
      ((gains(o2) as Record<string, Raw[]>)[7] ?? []).map((g) => [g['key'], g['charName'], g['kingdomName']]),
    ).toEqual([['swift', kingOf(c, 1).name, null]]);
  });

  test('a hero’s title held last turn by a hero of no realm is lost by nobody; a hero of no realm wins nothing', () => {
    const b = fresh();
    G(b)['turn'] = 6;
    const k0 = kingOf(b, 0).id;
    lastTurn(
      b,
      true,
      { throne: [k0, 0], vault: [k0, 0], marshal: [77, null] },
      { colossus: [k0, 0], castellan: [k0, 0] },
    );
    const o = withMinor(b, { swift: { charId: 99, playerIndex: null } });
    expect([gains(o), losses(o)]).toEqual([{}, {}]);
  });
});

// ── Properties ───────────────────────────────────────────────────────────────────────────────────────────────────
const SCHOOLS: [string, string][] = [
  ['white', 'White'],
  ['psychic', 'Psychic'],
  ['illusory', 'Illusory'],
  ['elemental', 'Elemental'],
  ['necromancy', 'Necromancy'],
];
const others = (pi: number) => [0, 1, 2].filter((i) => i !== pi);
describe('The titles at the turn’s end: properties', () => {
  test('the Throne goes to the first realm of the largest tax base, which is told its own share rounded down, each realm it has met rounded, and how many it hasn’t (none conceded)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 20 }), { minLength: 3, maxLength: 3 }),
        fc.array(fc.boolean(), { minLength: 3, maxLength: 3 }),
        fc.array(fc.boolean(), { minLength: 3, maxLength: 3 }),
        (tax, met, conceded) => {
          const b = fresh();
          firstPublic(b);
          taxes(b, ...tax);
          const world = tax.reduce((s, x) => s + x, 0);
          const top = Math.max(...tax);
          const pi = tax.indexOf(top);
          b.G.players.forEach((pl, i) => {
            meets(b, i, ...others(i).filter((x) => met[x]));
            if (conceded[i] && i !== pi) Object.assign(pl, { conceded: true, concededTurn: b.G.turn - 1 });
          });
          const o = after(b);
          const share = (x: number) => (100 * x) / world;
          const unseen = others(pi).filter((i) => !met[i] && !(conceded[i] ?? false)).length;
          const want =
            top === 0
              ? []
              : [
                  [
                    [pi],
                    `[The Throne] Your realm: ${String(Math.floor(share(must(tax[pi], 'tax')) + 1e-9))}% of the world tax base.`,
                  ],
                  ...others(pi)
                    .filter((i) => met[i])
                    .map((i) => [
                      [pi],
                      `[The Throne] ${nameOf(b, i)}: ${String(Math.round(share(must(tax[i], 'tax'))))}% of the world tax base.`,
                    ]),
                  ...(unseen > 0 ? [[[pi], unmetLine('The Throne', unseen)]] : []),
                ];
          expect(intel(o, 'The Throne')).toEqual(want);
        },
      ),
      { seed: SEED, numRuns: 150 },
    );
  });

  test('the Loremaster copies exactly the discovery the die picks of those made on the turn just played, held by realms it has met, that it lacks; or none', () => {
    const IDS = ['sd03', 'sd04', 'sd05', 'sd06', 'sd19'];
    const held = fc.array(fc.record({ id: fc.constantFrom(...IDS), fresh: fc.boolean() }), { maxLength: 4 });
    fc.assert(
      fc.property(
        held,
        held,
        fc.uniqueArray(fc.constantFrom(...IDS), { maxLength: 3 }),
        fc.array(fc.boolean(), { minLength: 3, maxLength: 3 }),
        fc.double({ min: 0, max: 0.999, noNaN: true }),
        (r1, r2, own, met, die) => {
          const b = fresh();
          firstPublic(b);
          titled(b, 0, seatOf(b, 0), { sage: 1 });
          meets(b, 0, ...[1, 2].filter((i) => met[i]));
          realm(b, 0)['discoveries'] = own.map((id) => disc(id, 2));
          realm(b, 1)['discoveries'] = r1.map((d) => disc(d.id, d.fresh ? 4 : 3));
          realm(b, 2)['discoveries'] = r2.map((d) => disc(d.id, d.fresh ? 4 : 3));
          const learn = [...(met[1] ? r1 : []), ...(met[2] ? r2 : [])].filter((d) => d.fresh && !own.includes(d.id));
          rolled(b, [die]);
          const pick = learn[Math.floor(die * learn.length)];
          expect((realm(b, 0)['discoveries'] as Raw[]).map((d) => [d['id'], d['turnDiscovered']])).toEqual([
            ...own.map((id) => [id, 2]),
            ...(pick ? [[pick.id, 5]] : []),
          ]);
          expect(
            intel(outcome(b, 4), 'The Loremaster').filter(([, x]) => x.includes('Your scholars copy')).length,
          ).toBe(pick ? 1 : 0);
        },
      ),
      { seed: SEED, numRuns: 150 },
    );
  });

  test('the Archmage names, for each school, the living mage of the highest level outside its realm, of a realm it has met or of none, the most skilled of equals, the first of those; or no mage', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            realm: fc.constantFrom(0, 1, 2, null),
            school: fc.constantFrom(...SCHOOLS.map(([k]) => k)),
            level: fc.integer({ min: 0, max: 3 }),
            melee: fc.integer({ min: 0, max: 2 }),
            alive: fc.boolean(),
          }),
          { maxLength: 6 },
        ),
        fc.array(fc.boolean(), { minLength: 3, maxLength: 3 }),
        (mages, met) => {
          const b = fresh();
          firstPublic(b);
          titled(b, 0, seatOf(b, 0), { white: 4, psychic: 4, illusory: 4, elemental: 4, necromancy: 4 });
          meets(b, 0, ...[1, 2].filter((i) => met[i]));
          const placed = mages.map((m) => {
            const h =
              m.realm === null
                ? wanderer(b, { melee: m.melee, tactical: 0, march: 0, [m.school]: m.level })
                : titled(b, m.realm, seatOf(b, m.realm), { melee: m.melee, [m.school]: m.level });
            if (!m.alive) h.alive = false;
            return [m, h] as const;
          });
          const o = after(b);
          const want = SCHOOLS.map(([k, lab]) => {
            let best: Character | null = null;
            let bl = -1;
            let bt = -1;
            for (const [m, h] of placed) {
              if (!m.alive || m.realm === 0 || (m.realm !== null && !met[m.realm])) continue;
              const l = m.school === k ? m.level : 0;
              const tot = m.melee + m.level;
              if (l > bl || (l === bl && tot > bt)) [best, bl, bt] = [h, l, tot];
            }
            if (best === null || bl <= 0) return `[The Archmage] ${lab}: no mage of note outside your own realm.`;
            const c: Character = best;
            return c.player == null
              ? `[The Archmage] ${lab}: ${c.name} (Level ${String(bl)}), an independent hero guarding ${b.X.name}.`
              : `[The Archmage] ${lab}: ${c.name} (Level ${String(bl)}) of ${nameOf(b, c.player)} in ${seatOf(b, c.player).name}.`;
          });
          expect(
            intel(o, 'The Archmage')
              .map(([, x]) => x)
              .filter((x) => !x.includes('not yet met')),
          ).toEqual(want);
        },
      ),
      { seed: SEED, numRuns: 150 },
    );
  });

  test('a title is won only by the realm now holding it, when it changed hands (by realm for a realm’s title, by hero for a hero’s) or titles are first public, and lost only by the realm that held it to another or to nobody; never both; nothing lost the first public turn', () => {
    // Six heroes, two to a realm: hero h serves realm (h - 1) % 3.
    const holder = fc.option(fc.integer({ min: 1, max: 6 }), { nil: null });
    const holding = (keys: string[]) => fc.dictionary(fc.constantFrom(...keys), holder, { maxKeys: 4 });
    fc.assert(
      fc.property(
        holding(MAJOR_KEYS),
        holding(MINOR_KEYS),
        holding(MAJOR_KEYS),
        holding(MINOR_KEYS),
        fc.boolean(),
        fc.boolean(),
        (curMajor, curMinor, wasMajor, wasMinor, wasPublic, snap) => {
          const b = fresh();
          G(b)['turn'] = 6;
          const rOf = (h: number | null | undefined) => (h == null ? null : (h - 1) % 3);
          const pair = (h: number | null | undefined): [number | null, number | null] => [h ?? null, rOf(h)];
          if (snap)
            lastTurn(
              b,
              wasPublic,
              Object.fromEntries(Object.entries(wasMajor).map(([k, h]) => [k, pair(h)])),
              Object.fromEntries(Object.entries(wasMinor).map(([k, h]) => [k, pair(h)])),
            );
          else delete G(b)['_titlesSnapshot'];
          const names = Object.fromEntries([1, 2, 3, 4, 5, 6].map((h) => [h, `Mage ${String(h)}`]));
          b.G.characters.push(
            ...[1, 2, 3, 4, 5, 6].map((h) => ({ ...kingOf(b, 0), id: h, name: names[h] ?? '', isKing: false })),
          );
          let o: Outcome | undefined;
          standIn(
            b,
            ['computeStandings', 'computeMinorTitles'],
            () => {
              b.G.turn += 1;
              titleChanges(b.tc);
              o = outcome(b, 6);
            },
            {
              computeStandings: () => ({
                titles: Object.fromEntries(
                  MAJOR_KEYS.map((k) => [k, { charId: curMajor[k] ?? null, playerIndex: rOf(curMajor[k]) }]),
                ),
              }),
              computeMinorTitles: () =>
                Object.fromEntries(
                  Object.entries(curMinor)
                    .filter(([, h]) => h != null)
                    .map(([k, h]) => [k, { charId: h, playerIndex: rOf(h) }]),
                ),
            },
          );
          const out = must(o, 'the outcome');
          const first = !(snap && wasPublic);
          const kingdom = new Set(['throne', 'vault']);
          const won: Record<number, string[]> = {};
          const lost: Record<number, [string, number | null][]> = {};
          const judge = (keys: string[], cur: Record<string, number | null>, was: Record<string, number | null>) => {
            for (const k of keys) {
              const [c, w] = [cur[k] ?? null, snap ? (was[k] ?? null) : null];
              const moved = kingdom.has(k) ? rOf(c) !== rOf(w) : c !== w;
              if (c !== null && (first || moved)) (won[must(rOf(c), 'realm')] ??= []).push(k);
              if (!first && w !== null && moved && rOf(w) !== rOf(c))
                (lost[must(rOf(w), 'realm')] ??= []).push([k, rOf(c)]);
            }
          };
          judge(MAJOR_KEYS, curMajor, wasMajor);
          judge(MINOR_KEYS, curMinor, wasMinor);
          const gotWon = Object.fromEntries(
            Object.entries(gains(out) as Record<string, Raw[]>).map(([pi, gs]) => [pi, gs.map((g) => g['key'])]),
          );
          const gotLost = Object.fromEntries(
            Object.entries(losses(out) as Record<string, Raw[]>).map(([pi, ls]) => [
              pi,
              ls.map((l) => [l['key'], l['newHolderIndex']]),
            ]),
          );
          expect([gotWon, gotLost]).toEqual([won, lost]);
          for (const [pi, ks] of Object.entries(gotLost))
            for (const [k] of ks as [string][]) expect(gotWon[pi] ?? []).not.toContain(k);
          expect(first ? gotLost : {}).toEqual({});
        },
      ),
      { seed: SEED, numRuns: 300 },
    );
  });
});

// ── Helpers for what only a direct call stages ───────────────────────────────────────────────────────────────────
const troll = (n: string) => ({ type: 'Cave Trolls', quality: 'Average', race: 'Human', unitName: n });
const bear = (n: string) => ({ type: 'Great Bears', quality: 'Average', race: 'Human', unitName: n });
const holdsOnly0 = (b: Board) => {
  b.own(b.X, 0);
};
const disc = (id: string, turn: number) => {
  const d = JSON.parse(
    vm.runInContext(`JSON.stringify(SAGE_DISCOVERIES_P.find(d=>d.id===${JSON.stringify(id)}))`, engine) as string,
  ) as Raw;
  return { id, name: d['name'], category: d['category'], desc: d['desc'], turnDiscovered: turn };
};
/** The stages on `b` with the standings saying realm 0 holds each title of `merit` (key → its merit), every other
 *  title vacant. */
const withStandings = (b: Board, held: Record<string, number>) => {
  const real = engine['computeStandings'] as Fn;
  let o: Outcome | undefined;
  standIn(
    b,
    ['computeStandings'],
    () => {
      o = after(b);
    },
    {
      computeStandings: (st: unknown) => {
        const s = real(st) as Raw;
        const titles = Object.fromEntries(
          MAJOR_KEYS.map((k) => [
            k,
            k in held
              ? { playerIndex: 0, charId: null, merit: held[k] }
              : { playerIndex: null, charId: null, merit: 0 },
          ]),
        );
        return { ...s, titles };
      },
    },
  );
  return must(o, 'the outcome');
};
/** The stages on `b` with the minor titles as the real ones, and `extra` added. */
const withMinor = (b: Board, extra: Record<string, { charId: number; playerIndex: number | null }>) => {
  const real = engine['computeMinorTitles'] as Fn;
  let o: Outcome | undefined;
  standIn(
    b,
    ['computeMinorTitles'],
    () => {
      o = after(b);
    },
    { computeMinorTitles: (st: unknown) => ({ ...(real(st) as Raw), ...extra }) },
  );
  return must(o, 'the outcome');
};
