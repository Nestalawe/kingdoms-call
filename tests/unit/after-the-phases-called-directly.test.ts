// After the phases (plan P1-08k3: src/engine/turn/, the first stage lifted out of resolveTurn's own body), called
// directly in the bare vm on the middle of a bot world (lib/middle-of-a-bot-world.ts). First the cases
// scenario/after-the-phases-in-a-whole-turn plays through a whole turn (lib/after-the-phases-cases.ts), here played
// through the stage alone, as resolveTurn calls it once the phase loop is over (no phase current, every later line
// filed after the phases), but for those only a whole turn can stage; then, with the helpers it calls stood in (each
// replaced in the vm by a recorder for the test's length), what it hands them and when; then what the whole turn can't
// stage: a stand-off still standing at the end, a fallen commander's host still in the field, the lines of skill rises
// left waiting, the Elven escape queue as battles leave it, an old save's note for a hero who is gone, a hero standing
// nowhere. Properties (fast-check): no skeletal company is left under a hero with no Necromancy or in a garrison, and
// no living company is lost; Mass Healing mends each wounded friend of a White master once, by half his maximum, to his
// maximum, and nobody else; a realm keeps the consecration of exactly the provinces it still holds; every hero standing
// in a province bears its name.
// Level 1: one function, called with the context resolveTurn hands it.
import vm from 'node:vm';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { withCaseDice } from '../lib/espionage-order-cases.ts';
import {
  AFTER_THE_PHASES_CASES,
  LANDS,
  crumble,
  feels,
  goesHome,
  holdsOnly,
  mends,
  parcel,
  reckoning,
  seat,
  spared,
  stageCase,
  under,
  unblessed,
  unit,
  wounded,
  type AfterThePhasesCase,
  type Outcome,
} from '../lib/after-the-phases-cases.ts';
import { board, must, type Board, type Character, type Province, type Unit } from '../lib/middle-of-a-bot-world.ts';
import { plainRealms } from '../lib/recruit-hire-and-realm-works-order-cases.ts';
import { at, leads, rival, wanderer } from '../lib/cast-spell-order-cases.ts';
import { companies, item, skeletal } from '../lib/item-and-army-order-cases.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
type Fn = (...a: unknown[]) => unknown;
const fn = (name: string) => engineFn(engine, name) as Fn;
const STAGE = 'afterThePhasesStandOffsTheDeadGravesCouriersMassHealingCowardsAndLocationNames';
const afterThePhases = fn(STAGE);
const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

const tc = (b: Board) => b.tc as unknown as Record<string, unknown> & Board['tc'];
const G = (b: Board) => b.G as unknown as Record<string, unknown> & Board['G'];
/** The stage, as resolveTurn calls it once the phase loop is over: no phase current, every later line filed after the
 *  phases, the log's context cleared. */
const settle = (b: Board) => {
  tc(b)._currentPhase = null;
  tc(b)['_afterPhases'] = true;
  b.tc._logCtx = { charId: null, phase: null };
  afterThePhases(b.tc);
};
const outcome = (b: Board): Outcome => ({ world: b.G, all: b.lines(), turn: b.G.turn });
const fresh = () => {
  const b = board(engine, world, 4);
  plainRealms(b);
  b.G.players.forEach((pl) => {
    pl['heroes'] = [];
  });
  return b;
};
/** The stage on `b` with every die at `die` and every percentile roll at 1. */
const after = (b: Board, die = LANDS.die) => {
  withCaseDice(engine, { roll: 1, die }, () => {
    settle(b);
  });
  return outcome(b);
};
const ring1 = (b: Board, i: number) => must(b.ring1[i], 'a neighbour of the middle');
const realm = (b: Board, pi = 0) => must(b.G.players[pi], 'realm ' + String(pi));
const texts = (b: Board) => b.lines().map((l) => l.text);

const DIRECT = AFTER_THE_PHASES_CASES.map(
  ([part, cases]) => [part, cases.filter((c) => !c.wholeTurnOnly)] as const,
).filter(([, cases]) => cases.length > 0);
describe.each(DIRECT)('%s, through the stage called directly', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c: AfterThePhasesCase) => {
    const b = board(engine, world, 4);
    const s = stageCase(b, c);
    withCaseDice(engine, c.dice ?? LANDS, () => {
      settle(b);
    });
    const { got, want } = c.check(outcome(b), s);
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
 *  recorder does, by name (by default nothing). */
function standIn(b: Board, names: string[], body: () => void, returns: Record<string, Fn> = {}): Call[] {
  const g = engine as unknown as Record<string, unknown>;
  const was = names.map((f) => [f, g[f]] as const);
  const calls: Call[] = [];
  for (const f of names)
    g[f] = (...args: unknown[]) => {
      calls.push({ fn: f, args, before: b.lines().length });
      return returns[f]?.(...args);
    };
  try {
    body();
  } finally {
    for (const [f, w] of was) g[f] = w;
  }
  return calls;
}
const HELPERS = [
  'flagEnemyStandoffs',
  'senseGravesUnderfoot',
  'progressNeutralHeroes',
  'consecratedIds',
  'resolveAllPendingSkillGains',
  'writeDeferredSkillLines',
  'disperseDeadCharArmies',
  'flushIntrusionNotifications',
  'healFeatureMonsters',
  'syncAllMaxHp',
  'monarchRestProvId',
  'abandonHostOnFlight',
  'reconcileProvinceCharacters',
];
/** A world with something for every helper: a hero of realm 0 at home, a fallen commander with his host, a coward of
 *  realm 0 away from home, a skill rise's line waiting. */
const everything = () => {
  const b = fresh();
  holdsOnly(b, 0, [b.X, 0]);
  seat(b, 0, b.X);
  const h = at(b);
  const fallen = leads(at(b, {}, { at: ring1(b, 1) }), companies(1));
  Object.assign(fallen, { alive: false, hp: 0, _slainBy: 'Some Rival', _leaderlessHost: true });
  const away = ring1(b, 0);
  const coward = spared(at(b, {}, { at: away }), b.G.turn);
  const fallenAlone = at(b, {}, { at: ring1(b, 2) });
  Object.assign(fallenAlone, { alive: false, hp: 0 });
  tc(b)['_deferredSkillLogs'] = [
    ['📈 A rise told late.', { audience: { actor: 0, realms: [0] }, hero: h.id, phase: 4 }],
  ];
  return { b, h, fallen, coward, away };
};

describe('After the phases: what it calls', () => {
  test('in order: stand-offs, graves, neutral heroes, consecrations, the waiting rises, fallen hosts, intrusions, guardians, maximum HP, cowards, the provinces rebuilt', () => {
    const { b, h, fallen, coward } = everything();
    const waiting = tc(b)['_deferredSkillLogs'];
    const calls = standIn(b, HELPERS, () => after(b), {
      consecratedIds: () => [],
      monarchRestProvId: () => b.X.id,
    });
    const order = calls.map((c) => c.fn).filter((f, i, a) => a.indexOf(f) === i);
    expect(order).toEqual([
      'flagEnemyStandoffs',
      'senseGravesUnderfoot',
      'progressNeutralHeroes',
      'consecratedIds',
      'resolveAllPendingSkillGains',
      'writeDeferredSkillLines',
      'disperseDeadCharArmies',
      'flushIntrusionNotifications',
      'healFeatureMonsters',
      'syncAllMaxHp',
      'monarchRestProvId',
      'abandonHostOnFlight',
      'reconcileProvinceCharacters',
    ]);
    const of = (f: string) => calls.filter((c) => c.fn === f).map((c) => c.args);
    expect(of('flagEnemyStandoffs')).toEqual([[b.tc]]);
    expect(of('senseGravesUnderfoot').map((a) => [a[0], a[1], a[2]])).toEqual([
      [b.G, h, b.X],
      [b.G, coward, ring1(b, 0)],
    ]);
    expect(of('progressNeutralHeroes').map((a) => a[0])).toEqual([b.G]);
    expect(of('progressNeutralHeroes')[0]?.length).toBe(2);
    expect(of('consecratedIds')).toEqual(b.G.players.map((pl) => [pl]));
    expect(of('resolveAllPendingSkillGains')).toEqual([[b.tc]]);
    expect(of('writeDeferredSkillLines')).toEqual([[b.tc, waiting]]);
    expect(tc(b)['_deferredSkillLogs']).toEqual([]);
    expect(tc(b)['_deferredSkillLogs']).not.toBe(waiting);
    expect(of('disperseDeadCharArmies')).toEqual([[b.tc, fallen]]);
    expect(of('flushIntrusionNotifications')).toEqual([[b.tc]]);
    expect(of('healFeatureMonsters')).toEqual([[b.tc]]);
    expect(of('syncAllMaxHp')).toEqual([[b.tc]]);
    expect(of('monarchRestProvId')).toEqual([[b.G, 0]]);
    expect(of('abandonHostOnFlight')).toEqual([[b.tc, coward]]);
    expect(of('reconcileProvinceCharacters')).toEqual([[b.tc]]);
    expect(calls.filter((c) => c.fn === 'reconcileProvinceCharacters')[0]?.before).toBe(b.lines().length);
  });

  test("a fallen commander's host is dispersed knowing who slew him, with no leaderless-host mark; the note goes after", () => {
    const { b, fallen } = everything();
    let seen: unknown[] = [];
    standIn(b, ['disperseDeadCharArmies'], () => after(b), {
      disperseDeadCharArmies: (_t, d) => {
        const x = d as Character;
        seen = [x['_slainBy'], '_leaderlessHost' in x];
      },
    });
    expect(seen).toEqual(['Some Rival', false]);
    expect('_slainBy' in fallen).toBe(false);
  });

  test("the emitter handed to the graves: the line told to the hero's realm, for the province sensed", () => {
    const b = fresh();
    const h = at(b, { necromancy: 1 });
    const calls = standIn(b, ['senseGravesUnderfoot'], () => after(b));
    const emit = must(calls[0]?.args[3] as Fn | undefined, 'the emitter');
    const before = b.lines().length;
    emit(ring1(b, 0));
    const l = must(b.lines()[before], 'the line');
    expect([l.text, l.type, l.actor, l.targets, l.provinceId, l.phase]).toEqual([
      feels(h, ring1(b, 0)),
      'explore',
      0,
      [0],
      ring1(b, 0).id,
      99,
    ]);
  });

  test("the emitter handed to the neutral heroes' learning: a line nobody is sent, for its province or none", () => {
    const b = fresh();
    const calls = standIn(b, ['progressNeutralHeroes'], () => after(b));
    const emit = must(calls[0]?.args[1] as Fn | undefined, 'the emitter');
    const before = b.lines().length;
    emit('📜 Someone hones their craft.', b.X);
    emit('📜 Someone else hones theirs.', null);
    const ls = b.lines().slice(before);
    expect(
      ls.map((l) => [l.text, l.type, l.actor, l.targets, l.provinceId, l['system'], l['public'], l.phase]),
    ).toEqual([
      ['📜 Someone hones their craft.', 'system', null, [], b.X.id, true, false, 99],
      ['📜 Someone else hones theirs.', 'system', null, [], null, true, false, 99],
    ]);
  });

  test('no waiting rise: the lines are not written, and the list is left as it is', () => {
    const b = fresh();
    const list = tc(b)['_deferredSkillLogs'];
    const calls = standIn(b, ['writeDeferredSkillLines'], () => after(b));
    expect(calls).toEqual([]);
    expect(tc(b)['_deferredSkillLogs']).toBe(list);
  });

  test('the waiting rises are resolved before their lines are written', () => {
    const b = fresh();
    const h = at(b);
    const calls = standIn(b, ['resolveAllPendingSkillGains', 'writeDeferredSkillLines'], () => after(b), {
      resolveAllPendingSkillGains: () => {
        (tc(b)['_deferredSkillLogs'] as unknown[]).push([
          '📈 Risen.',
          { audience: { actor: 0, realms: [0] }, hero: h.id },
        ]);
      },
    });
    expect(calls.map((c) => c.fn)).toEqual(['resolveAllPendingSkillGains', 'writeDeferredSkillLines']);
  });

  test('the maximum HP is resynced after the earned-HP notes are told, with the realms the stage set for every helper', () => {
    const b = fresh();
    const h = at(b);
    G(b)['_maxHpMigration'] = [{ charId: h.id, player: 0, old: 80, nu: 60 }];
    const players = vm.runInContext('()=>maxHpPlayers.players', engine) as () => unknown;
    let seen: unknown = null;
    vm.runInContext('maxHpPlayers.players=null', engine);
    const calls = standIn(b, ['syncAllMaxHp'], () => after(b), {
      syncAllMaxHp: () => {
        seen = players();
      },
    });
    expect(seen).toBe(b.G.players);
    expect(
      texts(b)
        .slice(0, calls[0]?.before ?? 0)
        .includes(reckoning(h, 80, 60)),
    ).toBe(true);
  });

  test("a coward's host is left where he fled before he moves, and only when he moves", () => {
    const { b, coward, away } = everything();
    const home = spared(at(b, {}, { troops: 1 }), b.G.turn);
    let from: unknown = null;
    const calls = standIn(b, ['abandonHostOnFlight'], () => after(b), {
      abandonHostOnFlight: (_t, c) => {
        from = (c as Character).location;
      },
    });
    expect(calls.map((c) => c.args[1])).toEqual([coward]);
    expect(from).toBe(away.id);
    expect(home.location).toBe(b.X.id);
    expect(texts(b).includes(goesHome(coward, b.X))).toBe(true);
  });

  test('the provinces are rebuilt after the cowards have gone home, and the names follow', () => {
    const { b, coward } = everything();
    let atThen: unknown = null;
    standIn(b, ['reconcileProvinceCharacters'], () => after(b), {
      reconcileProvinceCharacters: () => {
        atThen = coward.location;
      },
    });
    expect(atThen).toBe(b.X.id);
    expect(coward['locationName']).toBe(b.X.name);
  });
});

// ── What the whole turn can't stage ─────────────────────────────────────────────────────────────────────────────
describe('After the phases: what only a direct call can stage', () => {
  test('a stand-off still standing when the phases end is flagged, a fresh war front of the turn too', () => {
    const b = fresh();
    leads(at(b), companies(1));
    leads(rival(b), companies(1));
    (tc(b)['_warFrontProvs'] as Set<number>).add(b.X.id);
    after(b);
    expect(b.X._battleUnresolved).toBe(true);
  });

  test("a fallen hero's skeletal companies crumble too, before his host is dispersed", () => {
    const b = fresh();
    const d = leads(at(b), [skeletal('Bones'), ...companies(1)]);
    Object.assign(d, { alive: false, hp: 0 });
    let host: string[] = [];
    standIn(b, ['disperseDeadCharArmies'], () => after(b), {
      disperseDeadCharArmies: (_t, x) => {
        host = (x as Character).armies.map((u) => u.unitName);
      },
    });
    expect(texts(b)).toContain(crumble([under(1, d, b.X)]));
    expect(host).toEqual(['Men-at-Arms c0']);
  });

  test("a fallen commander's host still in the field takes the garrison of his realm's ground", () => {
    const b = fresh();
    holdsOnly(b, 0, [b.X, 0]);
    const d = leads(at(b), companies(2));
    Object.assign(d, { alive: false, hp: 0, _slainBy: 'Some Rival' });
    after(b);
    expect(d.armies).toEqual([]);
    expect(b.X.garrisonArmies.map((u) => u.unitName)).toEqual(['Men-at-Arms c0', 'Men-at-Arms c1']);
    expect(texts(b).some((t) => t.includes('after their commander fell to Some Rival'))).toBe(true);
    expect('_slainBy' in d).toBe(false);
  });

  test('the lines of skill rises left waiting are written, each with its own phase, and the list emptied', () => {
    const b = fresh();
    const h = at(b);
    tc(b)['_deferredSkillLogs'] = [
      ['📈 First rise.', { audience: { actor: 0, realms: [0] }, hero: h.id, phase: 3 }],
      ['📈 Second rise.', { audience: { actor: 0, realms: [0] }, hero: h.id }],
    ];
    after(b);
    const ls = b.lines().filter((l) => l.text.startsWith('📈 '));
    expect(ls.map((l) => [l.text, l.charId, l.phase])).toEqual([
      ['📈 First rise.', h.id, 3],
      ['📈 Second rise.', h.id, 99],
    ]);
    expect(tc(b)['_deferredSkillLogs']).toEqual([]);
  });

  test('the Elven escape queue: each realm told once with its own, a nameless company by its kind, the queue emptied in place', () => {
    const b = fresh();
    const home0 = ring1(b, 0);
    const home2 = ring1(b, 1);
    holdsOnly(b, 0, [home0, 1]);
    holdsOnly(b, 2, [home2, 1]);
    seat(b, 0, home0);
    seat(b, 2, home2);
    const queue = tc(b)['_elvenEscapeQueue'] as unknown[];
    const elf = (name: string) => ({ ...unit(name, 'Elven Archers', 'Average', 'Elven') });
    queue.push(
      { player: 2, unit: elf('Far Bows') },
      { player: 0, unit: elf('Near Bows') },
      { player: 0, unit: { type: 'Elven Archers', quality: 'Green', race: 'Elven' } },
    );
    after(b);
    expect(
      b
        .lines()
        .filter((l) => l.text.startsWith('🍃 '))
        .map((l) => [l.text, l.targets]),
    ).toEqual([
      [
        `🍃 Near Bows, Elven Archers (2 units) slipped away from battle and have found their way home to ${home0.name}, rejoining the garrison there.`,
        [0],
      ],
      [
        `🍃 Far Bows (1 unit) slipped away from battle and have found their way home to ${home2.name}, rejoining the garrison there.`,
        [2],
      ],
    ]);
    expect(home0.garrisonArmies.length).toBe(2);
    expect(queue).toBe(tc(b)['_elvenEscapeQueue']);
    expect(queue).toEqual([]);
  });

  test('an escape for a realm the world has no record of scatters, told as "the realm"', () => {
    const b = fresh();
    (tc(b)['_elvenEscapeQueue'] as unknown[]).push({
      player: 7,
      unit: unit('Lost', 'Elven Archers', 'Average', 'Elven'),
    });
    after(b);
    expect(texts(b)).toContain(
      '🍃 1 Elven unit broke free of battle and made for home — but the realm holds no land left to return to, and they scatter into the wild, lost.',
    );
  });

  test('a consecrated province the map has no record of is dropped from the list, untold', () => {
    const b = fresh();
    holdsOnly(b, 0, [b.X, 0]);
    realm(b)['consecratedProvIds'] = [b.X.id, 9999];
    after(b);
    expect(realm(b)['consecratedProvIds']).toEqual([b.X.id]);
    expect(texts(b).some((t) => t.includes('The consecration of'))).toBe(false);
  });

  test("an old save's note for a hero no longer in the world is skipped; the notes are dropped once read", () => {
    const b = fresh();
    const h = at(b);
    G(b)['_maxHpMigration'] = [
      { charId: 8999, player: 0, old: 80, nu: 60 },
      { charId: h.id, player: 0, old: 70, nu: 60 },
    ];
    after(b);
    expect(texts(b).filter((t) => t.startsWith('📜 A new reckoning'))).toEqual([reckoning(h, 70, 60)]);
    expect('_maxHpMigration' in b.G).toBe(false);
  });

  test('Mass Healing reads an unknown HP as whole, and an unknown maximum as 20', () => {
    const b = fresh();
    const healer = at(b, { white: 6 });
    const whole = at(b);
    (whole as Record<string, unknown>)['hp'] = null;
    const noMax = wounded(at(b), 4);
    (noMax as Record<string, unknown>)['maxHp'] = undefined;
    standIn(b, ['syncAllMaxHp'], () => after(b));
    expect(texts(b).filter((t) => t.includes('Mass Healing'))).toEqual([mends(healer, noMax, 10, 14, 20)]);
    expect(whole.hp).toBe(null);
  });

  test('a hero standing nowhere keeps his location name; a skeleton he leads crumbles, told without a place', () => {
    const b = fresh();
    const h = leads(at(b), [skeletal('Bones')]);
    Object.assign(h, { location: 9999, locationName: 'Old Name' });
    b.X.characters = [];
    after(b);
    expect(h['locationName']).toBe('Old Name');
    expect(texts(b)).toContain(
      crumble([`1 skeletal unit under ${h.name} — ${h.name} has no Necromancy to hold them together`]),
    );
  });

  test('a parcel for a fallen hero whose king has fallen too is lost', () => {
    const b = fresh();
    const k = at(b, {}, { king: true });
    const h = at(b);
    k.alive = false;
    h.alive = false;
    parcel(b, h.id, [item(b, 'Iron Heart Talisman')]);
    after(b);
    expect(texts(b).some((t) => t.includes('finds no one left to receive it'))).toBe(true);
    expect(k.items).toEqual([]);
  });

  test('neither a wandering necromancer, a fallen one, nor one standing nowhere is handed to the graves', () => {
    const b = fresh();
    wanderer(b, { necromancy: 1 });
    const d = at(b, { necromancy: 1 });
    d.alive = false;
    const lost = at(b, { necromancy: 1 });
    lost.location = 9999;
    const calls = standIn(b, ['senseGravesUnderfoot'], () => after(b));
    expect(calls).toEqual([]);
  });

  test('a wanderer who begged for mercy has no realm to go home to: he stays', () => {
    const b = fresh();
    holdsOnly(b, 0, [b.X, 0]);
    seat(b, 0, b.X);
    const rover = spared(wanderer(b, {}, { at: ring1(b, 0) }), b.G.turn);
    after(b);
    expect(rover.location).toBe(ring1(b, 0).id);
  });
});

// ── Properties ──────────────────────────────────────────────────────────────────────────────────────────────────
describe('After the phases: properties', () => {
  test('no skeletal company is left under a hero with no Necromancy or in a garrison, a wanderer keeps his, and no living company is lost', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            who: fc.constantFrom(0, 2, null),
            necro: fc.boolean(),
            dead: fc.nat({ max: 2 }),
            living: fc.nat({ max: 2 }),
            at: fc.nat({ max: 2 }),
          }),
          { maxLength: 5 },
        ),
        fc.array(fc.record({ held: fc.boolean(), dead: fc.nat({ max: 2 }), living: fc.nat({ max: 2 }) }), {
          maxLength: 3,
        }),
        (heroes, garrisons) => {
          const b = fresh();
          const ps = [b.X, ring1(b, 0), ring1(b, 1)];
          holdsOnly(
            b,
            0,
            ...garrisons.flatMap((g, i) => (g.held ? [[must(ps[i], 'p'), 0] as [Province, number]] : [])),
          );
          garrisons.forEach((g, i) => {
            must(ps[i], 'p').garrisonArmies = [
              ...Array.from({ length: g.dead }, (_, k) => skeletal(`G${String(i)}d${String(k)}`)),
              ...companies(g.living, 'Men-at-Arms', 'Average', `G${String(i)}l`),
            ];
          });
          const hs = heroes.map((x, i) => {
            const spec = { at: must(ps[x.at], 'p') };
            const h = x.who === null ? wanderer(b, {}, spec) : at(b, {}, { ...spec, player: x.who });
            if (x.necro) h.skills['necromancy'] = 1;
            return leads(h, [
              ...Array.from({ length: x.dead }, (_, k) => skeletal(`H${String(i)}d${String(k)}`)),
              ...companies(x.living, 'Men-at-Arms', 'Average', `H${String(i)}l`),
            ]);
          });
          const living = (us: Unit[]) => us.filter((u) => !u['_isSkeletal']).length;
          const before = hs.map((h) => living(h.armies)).concat(ps.map((p) => living(p.garrisonArmies)));
          standIn(b, ['abandonHostOnFlight', 'disperseDeadCharArmies'], () => after(b));
          hs.forEach((h, i) => {
            const x = must(heroes[i], 'spec');
            const dead = h.armies.filter((u) => u['_isSkeletal']).length;
            expect(dead).toBe(x.who === null || x.necro ? x.dead : 0);
          });
          ps.forEach((p) => {
            expect(p.garrisonArmies.filter((u) => u['_isSkeletal']).length).toBe(0);
          });
          expect(hs.map((h) => living(h.armies)).concat(ps.map((p) => living(p.garrisonArmies)))).toEqual(before);
          const lost = new Set([
            ...heroes.filter((x) => x.who !== null && !x.necro && x.dead > 0).map((x) => x.who),
            ...garrisons.filter((g) => g.held && g.dead > 0).map(() => 0),
          ]);
          expect(
            b
              .lines()
              .filter((l) => l.text.startsWith('💀 The dead'))
              .map((l) => l.actor),
          ).toEqual([...lost].sort());
        },
      ),
      { seed: SEED, numRuns: 150 },
    );
  });

  test('Mass Healing mends each wounded friend of a White master once, by half his maximum, to his maximum, and nobody else', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            who: fc.constantFrom(0, 1, 2, null),
            master: fc.boolean(),
            hp: fc.integer({ min: 1, max: 20 }),
            at: fc.nat({ max: 1 }),
          }),
          { minLength: 1, maxLength: 6 },
        ),
        (spec) => {
          const b = fresh();
          const ps = [b.X, ring1(b, 0)];
          const hs = spec.map((x) => {
            const extra = { at: must(ps[x.at], 'p') };
            const skills = x.master ? { white: 6 } : {};
            const h = x.who === null ? wanderer(b, skills, extra) : at(b, skills, { ...extra, player: x.who });
            return wounded(h, x.hp);
          });
          const friends = (a: number | null, c: number | null) =>
            a !== null && c !== null && (a === c || (a !== 1 && c !== 1 && a !== c));
          const want = spec.map((x) => {
            const healed = spec.some((y) => y.master && y.at === x.at && friends(y.who, x.who));
            return healed ? Math.min(20, x.hp + 10) : x.hp;
          });
          standIn(b, ['syncAllMaxHp', 'abandonHostOnFlight'], () => after(b));
          expect(hs.map((h) => h.hp)).toEqual(want);
          expect(b.lines().filter((l) => l.text.includes('Mass Healing')).length).toBe(
            spec.filter((x, i) => x.hp < 20 && want[i] !== x.hp).length,
          );
        },
      ),
      { seed: SEED, numRuns: 150 },
    );
  });

  test('a realm keeps the consecration of exactly the provinces it still holds, in order, told once of each lost', () => {
    fc.assert(
      fc.property(fc.array(fc.record({ p: fc.nat({ max: 5 }), held: fc.boolean() }), { maxLength: 6 }), (spec) => {
        const b = fresh();
        const ps = [b.X, ...b.ring1].slice(0, 6);
        const list = [...new Map(spec.map((x) => [x.p, x])).values()];
        holdsOnly(b, 0, ...list.filter((x) => x.held).map((x) => [must(ps[x.p], 'p'), 0] as [Province, number]));
        realm(b)['consecratedProvIds'] = list.map((x) => must(ps[x.p], 'p').id);
        after(b);
        expect(realm(b)['consecratedProvIds']).toEqual(list.filter((x) => x.held).map((x) => must(ps[x.p], 'p').id));
        expect(texts(b).filter((t) => t.startsWith('✨ The consecration of'))).toEqual(
          list.filter((x) => !x.held).map((x) => unblessed(must(ps[x.p], 'p'), realm(b).name)),
        );
      }),
      { seed: SEED, numRuns: 150 },
    );
  });

  test('every hero standing in a province bears its name afterwards', () => {
    fc.assert(
      fc.property(fc.array(fc.record({ at: fc.nat({ max: 6 }), alive: fc.boolean() }), { maxLength: 6 }), (spec) => {
        const b = fresh();
        const ps = [b.X, ...b.ring1];
        const hs = spec.map((x) => {
          const h = at(b, {}, { at: must(ps[x.at], 'p') });
          Object.assign(h, { alive: x.alive, locationName: 'Stale' });
          return h;
        });
        after(b);
        expect(hs.map((h) => h['locationName'])).toEqual(spec.map((x) => must(ps[x.at], 'p').name));
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
