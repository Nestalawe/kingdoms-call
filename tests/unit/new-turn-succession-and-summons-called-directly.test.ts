// The new turn's first part (plan P1-08k5a: src/engine/turn/, a stage lifted out of resolveTurn's own body), called
// directly in the bare vm on the middle of a bot world (lib/middle-of-a-bot-world.ts). First the cases
// scenario/new-turn-succession-and-summons-in-a-whole-turn plays through a whole turn
// (lib/new-turn-succession-and-summons-cases.ts), here played through the stage alone, as resolveTurn calls it once
// diplomacy and victory are settled (no phase current, every line filed after the phases), but for those only a whole
// turn can stage; then, with the helpers it calls stood in (each replaced in the vm by a recorder for the test's
// length), what it hands them and when; then what the whole turn can't stage: a save with no turn, a fallen hero's
// summons and marks, the Charm's marks, a realm with no creed or folk, the heir's own dice, the dice of fading
// illusions and lairs in turn, provinces and realms missing what a save may lack. Properties (fast-check): every
// company summoned for the turn or bound past its last turn leaves, every other stays; a realm with land and no king,
// none awaiting his return, crowns exactly one heir in its richest province, one with none ends its dynasty; the Grand
// Library gives one discovery the realm may learn and doesn't know, or says there is none; the turn moves on by one.
// Level 1: one function, called with the context resolveTurn hands it.
import vm from 'node:vm';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { withCaseDice } from '../lib/espionage-order-cases.ts';
import {
  CHARM_MARKS,
  COMPANY_MARKS,
  HERO_MARKS,
  LANDS,
  NEW_TURN_CASES,
  bound,
  consecrated,
  creed,
  crowned,
  eligible,
  extinguished,
  holdsOnly,
  kingFalls,
  kingOf,
  library,
  markedCompany,
  markedWith,
  marks,
  released,
  rises,
  risen,
  seatOf,
  stageCase,
  summoned,
  unit,
  uncovers,
  wayBackLost,
  LIBRARY_DONE,
  NO_TITLE_SKILLS,
  type NewTurnCase,
  type Outcome,
} from '../lib/new-turn-succession-and-summons-cases.ts';
import {
  board,
  must,
  withDice,
  type Board,
  type Character,
  type Province,
  type Unit,
} from '../lib/middle-of-a-bot-world.ts';
import { at, leads, realm, ring1, ring2, wanderer } from '../lib/cast-spell-order-cases.ts';
import { companies } from '../lib/item-and-army-order-cases.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
type Fn = (...a: unknown[]) => unknown;
type Raw = Record<string, unknown>;
const fn = (name: string) => engineFn(engine, name) as Fn;
const STAGE = 'newTurnCounterKingSuccessionSummonsAndSpellsEndAndTheGrandDesigns';
const newTurn = fn(STAGE);
const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

const tc = (b: Board) => b.tc as unknown as Raw & Board['tc'];
const G = (b: Board) => b.G as unknown as Raw & Board['G'];
/** The stage, as resolveTurn calls it once diplomacy and victory are settled: no phase current, every line filed after
 *  the phases, the log's context cleared. Gives back the turn it was called on. */
const settle = (b: Board) => {
  const turn = b.G.turn;
  tc(b)._currentPhase = null;
  tc(b)['_afterPhases'] = true;
  b.tc._logCtx = { charId: null, phase: null };
  newTurn(b.tc);
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
const texts = (b: Board) => b.lines().map((l) => l.text);
const heirsOf = (b: Board, pi = 0) => b.G.characters.filter((c) => c.player === pi && c['_isHeir'] === true);

const DIRECT = NEW_TURN_CASES.map(([part, cases]) => [part, cases.filter((c) => !c.wholeTurnOnly)] as const).filter(
  ([, cases]) => cases.length > 0,
);
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
const HELPERS = ['ownedConsecratedProvs', 'nextHeroName', 'gdActive', 'discBlockedIds', 'discEligible'];

describe('The new turn: what it calls', () => {
  test('in order: the holy ground of a king awaiting his return, the heir’s name, then each realm’s Grand Library, its blocked and eligible discoveries', () => {
    const b = fresh();
    const k = kingFalls(b, 0, { awaitsReturn: true });
    library(b, 2, seatOf(b, 2));
    const calls = standIn(b, HELPERS, () => after(b));
    const order = calls.map((c) => c.fn).filter((f, i, a) => a.indexOf(f) === i);
    expect(order).toEqual(HELPERS);
    const of = (f: string) => calls.filter((c) => c.fn === f).map((c) => c.args);
    expect(of('ownedConsecratedProvs')).toEqual([[b.G, 0]]);
    expect(of('nextHeroName')).toEqual([['Divine']]);
    expect(of('gdActive')).toEqual([
      [b.tc, 0, 'Neutral'],
      [b.tc, 1, 'Neutral'],
      [b.tc, 2, 'Neutral'],
    ]);
    expect(of('discBlockedIds')).toEqual([[realm(b, 2)]]);
    const ds = JSON.parse(vm.runInContext('JSON.stringify(SAGE_DISCOVERIES_P)', engine) as string) as { id: string }[];
    expect(of('discEligible').map((a) => [(a[0] as { id: string }).id, a[1]])).toEqual(
      ds.filter((d) => d.id !== 'gd').map((d) => [d.id, realm(b, 2)]),
    );
    expect(k.isKing).toBe(false);
  });

  test('only a fallen Divine king carrying the mark has his holy ground looked for; a living king, a hero, another creed’s king are not', () => {
    const b = fresh();
    const h = at(b, NO_TITLE_SKILLS);
    Object.assign(h, { alive: false, _divineReturn: true });
    kingOf(b, 0)['_divineReturn'] = true;
    creed(b, 1, 'Pagan');
    kingFalls(b, 1, { awaitsReturn: true });
    kingFalls(b, 2);
    const calls = standIn(b, ['ownedConsecratedProvs'], () => after(b));
    expect(calls).toEqual([]);
  });

  test('the heir’s name is asked of the realm’s creed, or Neutral when the realm has none', () => {
    const b = fresh();
    creed(b, 1, 'Undead');
    kingFalls(b, 1);
    delete realm(b, 2)['alignment'];
    delete realm(b, 2)['race'];
    kingFalls(b, 2);
    const calls = standIn(b, ['nextHeroName'], () => after(b), { nextHeroName: (a) => `Heir ${String(a)}` });
    expect(calls.map((c) => c.args)).toEqual([['Undead'], ['Neutral']]);
    expect(heirsOf(b, 1).map((h) => h.name)).toEqual(['Heir Undead']);
    expect(heirsOf(b, 2).map((h) => [h.name, h['alignment'], h['race']])).toEqual([
      ['Heir Neutral', 'Neutral', 'Human'],
    ]);
  });

  test('with no name-giver, an heir is named for the king he follows, or "The New Monarch" when there was none', () => {
    const b = fresh();
    const k = kingFalls(b, 0);
    const k1 = kingOf(b, 1);
    b.G.characters = b.G.characters.filter((c) => c !== k1);
    const was = vm.runInContext('nextHeroName', engine) as unknown;
    vm.runInContext('nextHeroName=undefined', engine);
    try {
      after(b);
    } finally {
      engine['nextHeroName'] = was;
    }
    expect(heirsOf(b, 0).map((h) => h.name)).toEqual(['Heir of ' + k.name]);
    expect(heirsOf(b, 1).map((h) => h.name)).toEqual(['The New Monarch']);
  });

  test('a realm whose Wonder stands lets the Library look past what it knows; one whose Wonder is lost asks nothing more', () => {
    const b = fresh();
    library(b, 0, ring1(b, 0));
    b.own(ring1(b, 0), 1);
    const calls = standIn(b, ['discBlockedIds', 'discEligible'], () => after(b));
    expect(calls).toEqual([]);
  });
});

// ── What the whole turn can't stage ─────────────────────────────────────────────────────────────────────────────
describe('The new turn: what only a direct call can stage', () => {
  test('a save that records no turn, or turn 0, moves on to turn 2', () => {
    const b = fresh();
    const save: { turn?: number } = b.G;
    delete save.turn;
    after(b);
    expect(b.G.turn).toBe(2);
    const b0 = fresh();
    b0.G.turn = 0;
    after(b0);
    expect(b0.G.turn).toBe(2);
  });

  test('a fallen hero’s summoned company leaves too, and his realm is told; his companies recover from their battle marks', () => {
    const b = fresh();
    const h = leads(at(b, NO_TITLE_SKILLS), [summoned('Blaze'), markedCompany('Cold')]);
    Object.assign(h, { alive: false, hp: 0 });
    after(b);
    expect(h.armies.map((u) => [u.unitName, marks(u, COMPANY_MARKS)])).toEqual([['Cold', []]]);
    expect(texts(b)).toContain(released('Blaze (Fire Elemental)', 1, h));
  });

  test('the Charm’s three marks end with the turn', () => {
    const b = fresh();
    const h = at(b, NO_TITLE_SKILLS);
    Object.assign(h, { _charmedByPlayer: 1, _charmedForPhase: 3, _charmOriginalPlayer: 0 });
    after(b);
    expect(marks(h, CHARM_MARKS)).toEqual([]);
  });

  test('every one-turn mark ends on a hero, his companies, a province’s defenders; a garrison keeps all but its Terror', () => {
    const b = fresh();
    const h = leads(at(b, NO_TITLE_SKILLS), [markedCompany('Worn')]);
    Object.assign(h, markedWith(HERO_MARKS), markedWith(CHARM_MARKS), { _phantoms: [{ unitName: 'Mirage' }] });
    const p = ring2(b, 4);
    p.neutralDefenders = [markedCompany('Watch')];
    p.garrisonArmies = [markedCompany('Guard')];
    after(b);
    expect(marks(h, [...HERO_MARKS, ...CHARM_MARKS])).toEqual([]);
    expect(h['_phantoms']).toEqual([]);
    expect(h.armies.map((u) => marks(u, COMPANY_MARKS))).toEqual([[]]);
    expect(p.neutralDefenders.map((u) => marks(u, COMPANY_MARKS))).toEqual([[]]);
    expect(p.garrisonArmies.map((u) => marks(u, COMPANY_MARKS))).toEqual([
      COMPANY_MARKS.filter((k) => k !== '_terrorMult'),
    ]);
  });

  test('a reduction of nothing is kept as nothing, but a Terror of nothing is cleared; an empty phantom list is left as it is', () => {
    const b = fresh();
    const zero = { ...companies(1)[0], ...Object.fromEntries(COMPANY_MARKS.map((k) => [k, 0])) } as Unit;
    const phantoms: unknown[] = [];
    const h = leads(at(b, NO_TITLE_SKILLS), [zero]);
    h['_phantoms'] = phantoms;
    after(b);
    expect(marks(zero, COMPANY_MARKS)).toEqual(COMPANY_MARKS.filter((k) => k !== '_terrorMult'));
    expect(h['_phantoms']).toBe(phantoms);
  });

  test('a hero hired in any phase acts from every phase next turn; one given a phase before the turn (-1), or none, is left as he is', () => {
    const b = fresh();
    const hs = [0, 1, 2, 3, 4, -1, null, undefined].map((ph) => {
      const h = at(b, NO_TITLE_SKILLS);
      if (ph !== undefined) h['hiredInPhase'] = ph;
      return h;
    });
    after(b);
    expect(hs.map((h) => h['hiredInPhase'])).toEqual([-1, -1, -1, -1, -1, -1, null, undefined]);
  });

  test('the heir’s Temper is drawn first, then an aptitude for each skill in the game’s order, each die in turn', () => {
    const b = fresh();
    kingFalls(b, 0);
    const skills = JSON.parse(vm.runInContext('JSON.stringify(KC_SKILLS)', engine) as string) as string[];
    const dice = [0.3, ...skills.map((_, i) => [0, 0.1, 0.3, 0.6, 0.9][i % 5] ?? 0)];
    standIn(
      b,
      ['nextHeroName'],
      () => {
        withDice(engine, dice, () => {
          settle(b);
        });
      },
      { nextHeroName: () => 'Test Heir' },
    );
    const h = must(heirsOf(b)[0], 'the heir');
    expect(h['temper']).toBe('Brave');
    expect(h['aptitude']).toEqual(Object.fromEntries(skills.map((k, i) => [k, [0, 1, 2, 3, 4][i % 5]])));
  });

  test('the heir is listed in the province he is crowned in, once', () => {
    const b = fresh();
    kingFalls(b, 0);
    const seat = seatOf(b, 0);
    const id = b.G.characters.length;
    seat.characters = [id];
    after(b);
    expect(seat.characters).toEqual([id]);
    const b2 = fresh();
    kingFalls(b2, 0);
    after(b2);
    expect(seatOf(b2, 0).characters).toEqual([must(heirsOf(b2)[0], 'the heir').id]);
  });

  test('a realm that never had a king crowns an heir all the same; nobody is demoted', () => {
    const b = fresh();
    const k = kingOf(b, 0);
    b.G.characters = b.G.characters.filter((c) => c !== k);
    after(b);
    expect(heirsOf(b).length).toBe(1);
    expect(b.G.characters.filter((c) => c.player === 0 && c.isKing).length).toBe(1);
  });

  test('a fallen king who isn’t the realm’s first in the list: the first fallen king is the one demoted', () => {
    const b = fresh();
    const k = kingFalls(b, 0);
    const old = at(b, NO_TITLE_SKILLS, { king: true, at: ring2(b, 5) });
    Object.assign(old, { alive: false, hp: 0 });
    b.G.characters = [old, ...b.G.characters.filter((c) => c !== old)];
    after(b);
    expect([old.isKing, k.isKing]).toEqual([false, true]);
  });

  test('provinces the map doesn’t have: passed over for any real one with tax, and with none, the dynasty ends', () => {
    const b = fresh();
    kingFalls(b, 0);
    realm(b, 0).provinces = [9999, seatOf(b, 0).id];
    after(b);
    expect(heirsOf(b).map((h) => h.location)).toEqual([seatOf(b, 0).id]);
    const b1 = fresh();
    kingFalls(b1, 0);
    realm(b1, 0).provinces = [seatOf(b1, 0).id, 9999];
    after(b1);
    expect(heirsOf(b1).map((h) => h.location)).toEqual([seatOf(b1, 0).id]);
    const b2 = fresh();
    kingFalls(b2, 0);
    realm(b2, 0).provinces = [9999];
    after(b2);
    expect([heirsOf(b2).length, texts(b2).includes(extinguished(realm(b2, 0).name))]).toEqual([0, true]);
  });

  test('a province with no tax recorded is passed over for one with any; alone, it is where the heir is crowned', () => {
    const b = fresh();
    kingFalls(b, 0);
    const p = ring1(b, 0);
    holdsOnly(b, 0, [p, 0], [seatOf(b, 0), 5]);
    delete p['tax'];
    after(b);
    expect(heirsOf(b).map((h) => h.location)).toEqual([seatOf(b, 0).id]);
    const b2 = fresh();
    kingFalls(b2, 0);
    const p2 = ring1(b2, 0);
    holdsOnly(b2, 0, [p2, 0]);
    delete p2['tax'];
    after(b2);
    expect(heirsOf(b2).map((h) => h.location)).toEqual([p2.id]);
  });

  test('a Divine realm whose fallen king awaits his return but holds no land: his way back is looked for, lost, and the dynasty ends', () => {
    const b = fresh();
    const k = kingFalls(b, 0, { awaitsReturn: true });
    realm(b, 0).provinces = [];
    consecrated(b, 0, seatOf(b, 0));
    after(b);
    expect(texts(b).filter((t) => t === wayBackLost(k) || t === extinguished(realm(b, 0).name))).toEqual([
      extinguished(realm(b, 0).name),
    ]);
  });

  test('the dice of fading illusions and lairs, province by province: each illusion’s die, then each hidden lair’s; none for one an enemy walked into, or a lair in plain sight', () => {
    const b = fresh();
    const [p, q, r] = [ring2(b, 4), ring2(b, 5), ring2(b, 6)] as Province[];
    const lair = (name: string, hidden: boolean): Raw => (hidden ? { name, _hidden: true, _hiddenBy: 0 } : { name });
    const ill = { caster: 0, terrain: 'swamp' };
    Object.assign(must(p, 'p'), {
      _illusoryTerrain: { ...ill },
      features: [lair('A', true), lair('B', false), lair('C', true)],
    });
    Object.assign(must(q, 'q'), { _illusoryTerrain: { ...ill, _enteredByEnemy: true }, features: [lair('D', true)] });
    Object.assign(must(r, 'r'), { _illusoryTerrain: { ...ill } });
    const ps = [p, q, r].sort((x, y) => must(x, 'x').id - must(y, 'y').id) as Province[];
    const draws = ps.flatMap((x) => [
      ...(x['_illusoryTerrain'] && !(x['_illusoryTerrain'] as Raw)['_enteredByEnemy'] ? ['illusion ' + x.name] : []),
      ...((x['features'] as Raw[] | undefined) ?? [])
        .filter((f) => f['_hidden'])
        .map((f) => 'lair ' + String(f['name'])),
    ]);
    const dice = draws.map((_, i) => (i % 2 === 0 ? 0.1 : 0.5));
    withDice(engine, [...dice, 0.99999], () => {
      settle(b);
    });
    const fadedNow = ps.flatMap((x) => [
      ...(x['_illusoryTerrain'] ? [] : ['illusion ' + x.name]),
      ...((x['features'] as Raw[] | undefined) ?? [])
        .filter((f) => !f['_hidden'] && f['name'] !== 'B')
        .map((f) => 'lair ' + String(f['name'])),
    ]);
    const want = [...draws.filter((_, i) => i % 2 === 0), 'illusion ' + must(q, 'q').name].sort();
    expect(fadedNow.sort()).toEqual(want);
  });

  test('every province is swept, the first and the last of the map; their dice are drawn in the map’s order', () => {
    const b = fresh();
    const ps = b.G.world.provinces;
    const first = must(ps[0], 'the first province');
    const last = must(ps[ps.length - 1], 'the last province');
    const ill = { caster: 0, terrain: 'swamp' };
    [first, last].forEach((p) =>
      Object.assign(p, markedWith(['_blessBonus', '_holyBonus']), { _illusoryTerrain: { ...ill } }),
    );
    withDice(engine, [0.1, 0.5], () => {
      settle(b);
    });
    expect([first, last].map((p) => marks(p, ['_blessBonus', '_holyBonus', '_illusoryTerrain']))).toEqual([
      [],
      ['_illusoryTerrain'],
    ]);
  });

  test('provinces, realms and the save missing what a save may lack: nothing fails, and nothing is added but the list of rises', () => {
    const b = fresh();
    const p = ring2(b, 4);
    delete (p as Raw)['garrisonArmies'];
    delete (p as Raw)['neutralDefenders'];
    delete p['features'];
    delete G(b)['mercenaries'];
    delete realm(b, 2)['discoveries'];
    const h = at(b, NO_TITLE_SKILLS);
    delete (h as Raw)['armies'];
    after(b);
    expect([(p as Raw)['garrisonArmies'], (p as Raw)['neutralDefenders'], p['features']]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect([G(b)['mercenaries'], realm(b, 2)['discoveries'], (h as Raw)['armies']]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(G(b)['_pendingRises']).toEqual([]);
  });

  test('a rise owed to a hero with no companies list makes him one', () => {
    const b = fresh();
    const h = at(b, NO_TITLE_SKILLS);
    delete (h as Raw)['armies'];
    rises(b, [h.id, risen('Risen A')]);
    after(b);
    expect(h.armies.map((u) => u.unitName)).toEqual(['Risen A']);
  });

  test('the Grand Library draws one die for each realm it serves; a realm with no list of discoveries has no Wonder to serve it', () => {
    const b = fresh();
    library(b, 0, seatOf(b, 0));
    library(b, 2, seatOf(b, 2));
    realm(b, 0)['discoveries'] = undefined;
    const list = eligible(b, 'Human', 'Neutral');
    withDice(engine, [0, 0.99999], () => {
      settle(b);
    });
    expect(realm(b, 0)['discoveries']).toBeUndefined();
    const two = realm(b, 2)['discoveries'] as Raw[];
    expect(two.map((d) => d['id'])).toEqual(['gd', must(list[0], 'first').id]);
    expect(texts(b).filter((t) => t.startsWith('📚'))).toEqual([uncovers(must(list[0], 'first'))]);
  });

  test('a lost way back is told before the heir it makes is crowned, both after the turn moved on', () => {
    const b = fresh();
    const k = kingFalls(b, 0, { awaitsReturn: true });
    const o = after(b);
    const h = must(heirsOf(b)[0], 'the heir');
    expect(texts(b).filter((t) => t === wayBackLost(k) || t === crowned(h.name, seatOf(b, 0)))).toEqual([
      wayBackLost(k),
      crowned(h.name, seatOf(b, 0)),
    ]);
    expect(h['_crownedTurn']).toBe(o.turn + 1);
  });
});

// ── Properties ───────────────────────────────────────────────────────────────────────────────────────────────────
describe('The new turn: properties', () => {
  test('every company summoned for the turn, or bound past its last turn, leaves; every other stays, in order; one line of each kind a hero', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        fc.array(
          fc.record({
            who: fc.constantFrom(0, 1, 2, null),
            alive: fc.boolean(),
            units: fc.array(fc.oneof(fc.constant('plain'), fc.constant('summoned'), fc.integer({ min: -2, max: 2 })), {
              maxLength: 5,
            }),
          }),
          { maxLength: 5 },
        ),
        (turn, spec) => {
          const b = fresh();
          b.G.turn = turn;
          const hs = spec.map((x, i) => {
            const h = x.who === null ? wanderer(b, NO_TITLE_SKILLS) : at(b, NO_TITLE_SKILLS, { player: x.who });
            h.alive = x.alive;
            return leads(
              h,
              x.units.map((u, k) => {
                const name = `U${String(i)}.${String(k)}`;
                if (u === 'plain') return unit(name, 'Men-at-Arms');
                if (u === 'summoned') return summoned(name);
                return bound(name, turn + u);
              }),
            );
          });
          after(b);
          hs.forEach((h, i) => {
            const x = must(spec[i], 'spec');
            const kept = x.units
              .map((u, k) => [u, `U${String(i)}.${String(k)}`] as const)
              .filter(([u]) => u === 'plain' || (typeof u === 'number' && turn + 1 <= turn + u))
              .map(([, n]) => n);
            expect(h.armies.map((u) => u.unitName)).toEqual(kept);
            const lines = b.lines().filter((l) => l.text.endsWith(`leaving ${h.name}'s host.`));
            const kinds = lines.map((l) => (l.text.startsWith('✨') ? 'summons' : 'hunt'));
            expect(kinds).toEqual([
              ...(x.units.includes('summoned') ? ['summons'] : []),
              ...(x.units.some((u) => typeof u === 'number' && u < 1) ? ['hunt'] : []),
            ]);
            expect(
              lines.every((l) => JSON.stringify(l.targets) === JSON.stringify(x.who === null ? [] : [x.who])),
            ).toBe(true);
          });
        },
      ),
      { seed: SEED, numRuns: 150 },
    );
  });

  test('a realm with land and no living king, none awaiting his return, crowns exactly one heir in its richest province (the first of equals); one with none ends its dynasty; one with a king crowns nobody', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            lands: fc.array(fc.integer({ min: 0, max: 3 }), { maxLength: 4 }),
            king: fc.constantFrom('alive', 'fallen', 'awaits', 'none'),
            holy: fc.boolean(),
          }),
          { minLength: 3, maxLength: 3 },
        ),
        (spec) => {
          const b = fresh();
          const pool = [b.X, ...b.ring1, ...b.ring2.slice(0, 5)];
          spec.forEach((x, pi) => {
            const ps = x.lands.map((t, k) => [must(pool[pi * 4 + k], 'p'), t * 10] as [Province, number]);
            holdsOnly(b, pi, ...ps);
            if (x.holy && ps[0]) consecrated(b, pi, ps[0][0]);
            if (x.king === 'fallen') kingFalls(b, pi);
            if (x.king === 'awaits') kingFalls(b, pi, { awaitsReturn: true });
            if (x.king === 'none') b.G.characters = b.G.characters.filter((c) => !(c.isKing && c.player === pi));
          });
          after(b);
          const got = spec.map((_, pi) => ({
            heirs: heirsOf(b, pi).map((h) => h.location),
            ended: realm(b, pi)['_eliminated'] === true,
            kings: b.G.characters.filter((c) => c.player === pi && c.isKing && c.alive).length,
          }));
          const want = spec.map((x, pi) => {
            const waits = x.king === 'awaits' && x.holy && x.lands.length > 0;
            if (x.king === 'alive') return { heirs: [], ended: false, kings: 1 };
            if (waits) return { heirs: [], ended: false, kings: 0 };
            if (x.lands.length === 0) return { heirs: [], ended: true, kings: 0 };
            const k = x.lands.indexOf(Math.max(...x.lands));
            return { heirs: [must(pool[pi * 4 + k], 'p').id], ended: false, kings: 1 };
          });
          expect(got).toEqual(want);
        },
      ),
      { seed: SEED, numRuns: 150 },
    );
  });

  test('the Grand Library gives one discovery the realm may learn and doesn’t know, never one forgotten or awaiting a choice, or says there is none', () => {
    const all = eligible(fresh(), 'Human', 'Neutral').map((d) => d.id);
    fc.assert(
      fc.property(
        fc.subarray(all),
        fc.subarray(all, { maxLength: 4 }),
        fc.subarray(all, { maxLength: 4 }),
        (known, forgotten, awaiting) => {
          const b = fresh();
          library(b, 0, seatOf(b, 0), ...known);
          realm(b, 0)['forgottenDiscoveries'] = forgotten;
          realm(b, 0)['pendingDiscoveryChoices'] = awaiting.length ? [{ key: 'k', turn: 1, options: awaiting }] : [];
          const left = all.filter((id) => !known.includes(id) && !forgotten.includes(id) && !awaiting.includes(id));
          after(b);
          const now = (realm(b, 0)['discoveries'] as Raw[]).map((d) => String(d['id']));
          const none = left.length === 0;
          expect({
            count: now.length,
            told: texts(b).filter((t) => t === LIBRARY_DONE).length,
            fresh: none || left.includes(String(now.at(-1))),
          }).toEqual({ count: known.length + (none ? 1 : 2), told: none ? 1 : 0, fresh: true });
        },
      ),
      { seed: SEED, numRuns: 150 },
    );
  });

  test('the turn moves on by exactly one, whatever turn the save records', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200 }), (turn) => {
        const b = fresh();
        b.G.turn = turn;
        after(b);
        expect(b.G.turn).toBe(turn + 1);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
});
export type { Character };
