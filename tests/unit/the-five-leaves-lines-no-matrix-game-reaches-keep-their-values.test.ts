// The lines of the five files plan P1-10b9 freed of the ts-nocheck line (src/engine/heroes/fame-and-consecration.ts,
// items/tiers-and-hoards.ts, turn/intrusion-warnings.ts, realms/relations-and-captures.ts and
// battle/blood-harvest-and-iron-throne.ts), changed by statements that keep every value (P1-10b's Decision 2 and
// Choice 1), that no game of the balance matrix reaches. The matrix proves the others (both sets, every realm's report
// identical); these are proved here, each on the value it had before (worked out by the files as they were, with their
// ts-nocheck line):
// - a value the code guards, missing: no list (of items, realms, heroes, provinces, armies, rises, types or relations),
//   a gap in a list, no realm, no hero, no name, no skills, no tax, no race, no plan, no tally, no province;
// - an empty value a `||` turned into its fallback, which `??` would keep: an empty lore, relation, doctrine, race or
//   type;
// - a key no table holds: a monster's category with no label or use, a unit type of no price (or of a price of 0), a
//   lair's power of no tier, an item of no name the lore table knows;
// - a phase the warnings hold no name or force for (a sighting staged with none), the phase a capture takes from the
//   hero's order or the stage, a column's units left out or of no name, and the rises of the Iron Throne;
// - since the mutation session of 2026-10-31, the altars cast down by a Good or a Neutral column, whose troops can't
//   rise: the line says they take no pride in it.
// Level 1 (unit): each is a plain function on staged values, called directly on the engine's modules (plan P1-14a); a
// static check can't run them, and no game reaches these lines. The staged values carry only the fields each reads, so
// their type is given by assertion (`as never`), as the views' unit cases give a staged world's. The dice are fixed
// with kcRng.use where a line draws them.
import '../lib/the-whole-engine.ts';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { kcRng } from '../../src/engine/rng.ts';
import { ARMY_COST_MASTER } from '../../src/engine/army-tables.ts';
import { ARMY_UNIT_NAMES } from '../../src/content/kingdoms-call-data.ts';
import { createTurnContext, type TurnContext } from '../../src/engine/turn/context.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import { theTurnsLinesInWords } from '../../src/views/prose/the-words-of-each-line.ts';
import {
  MITHRIL_ARMOUR,
  claimWandererName,
  consecCaptureXpPct,
  demoteGuardToWanderer,
  detRoll,
  itemNameList,
  nearestConsecratedProv,
  normaliseOwnedNames,
  normaliseStrandedGuards,
  ownedConsecratedProvs,
  provinceConsecrated,
  relOfReport,
  spotEnemyInOwnedProvince,
} from '../../src/engine/heroes/fame-and-consecration.ts';
import {
  ITEM_LORE_BY_NAME,
  guardianCanUseItem,
  itemLore,
  itemLoreLines,
  lairItemTier,
  migrateHoardTally,
  monsterCatLabel,
  preferFreshEffects,
  wildHuntPrice,
} from '../../src/engine/items/tiers-and-hoards.ts';
import {
  flushIntrusionNotifications,
  generateIntrusionNotifications,
} from '../../src/engine/turn/intrusion-warnings.ts';
import {
  applyEvilConquest,
  breakConsecrationOnCapture,
  realmHasMet,
  relationBetween,
  setProvinceOwner,
} from '../../src/engine/realms/relations-and-captures.ts';
import { bloodHarvest, ironThroneRaise } from '../../src/engine/battle/blood-harvest-and-iron-throne.ts';

type Obj = Record<string, unknown>;

// The GM's log echoes each line on the console: quiet while the test writes lines.
const consoleLog = console.log;
beforeAll(() => {
  console.log = () => undefined;
});
afterAll(() => {
  console.log = consoleLog;
});

/** A turn's context on a staged state, with what emit and the warnings read. */
function aTurn(G: Obj, more: Obj = {}): TurnContext {
  const tc = createTurnContext(G, [], 3) as unknown as TurnContext;
  Object.assign(tc, {
    _logCtx: { charId: null, phase: null },
    _currentPhase: null,
    _afterPhases: false,
    _tel: {
      pre: {},
      orders: {},
      battles: [],
      encounters: [],
      captures: [],
      deaths: [],
      spells: [],
      hires: [],
      recruits: [],
    },
    SEASONS: ['Spring', 'Summer', 'Autumn', 'Late Autumn', 'Winter'],
    _intrusionAcc: new Map(),
    ...more,
  });
  return tc;
}
/** Runs `fn` with the dice fixed at `value`. */
function withDice<T>(value: number, fn: () => T): T {
  const was = kcRng.use(() => value);
  try {
    return fn();
  } finally {
    kcRng.use(was);
  }
}
/** The first turn whose spotting roll (viewer 0, the lurker 5, province 0) falls in [lo, hi) per cent: worked out, not
 *  drawn. */
function aTurnWhoseRollFallsIn(lo: number, hi: number): number {
  for (let t = 1; t < 10_000; t++) {
    const pct = detRoll(t, 0, 5, 0) * 100;
    if (pct >= lo && pct < hi) return t;
  }
  throw new Error(`no turn rolls in [${String(lo)}, ${String(hi)})`);
}

describe("the five leaves' lines no matrix game reaches keep their values", () => {
  test("names and the altars' experience: no list of items, no realm", () => {
    expect(itemNameList(null)).toBe('');
    expect(itemNameList(undefined)).toBe('');
    expect(consecCaptureXpPct(null)).toBe(0);
    expect(consecCaptureXpPct(undefined)).toBe(0);
    expect(consecCaptureXpPct({ alignment: 'Good' })).toBe(0);
  });

  test('the consecrated provinces a realm owns: no list of realms, a province not on the map, one held by another', () => {
    expect(ownedConsecratedProvs({ world: { provinces: [] } } as never, 0)).toEqual([]);
    const provinces = [
      { id: 0, owner: 0, tax: 2, row: 0, col: 0 },
      { id: 1, owner: 1, tax: 2, row: 0, col: 1 },
    ];
    const state = { players: [{ consecratedProvIds: [9, 1, 0] }], world: { cols: 8, rows: 8, provinces } };
    expect(ownedConsecratedProvs(state as never, 0)).toEqual([provinces[0]]);
  });

  test('the nearest consecrated province: a tie at the same distance goes to the richer, a province of no tax as 0', () => {
    const at = (id: number, col: number, tax: unknown) => ({ id, owner: 0, tax, row: 2, col });
    const state = (provinces: Obj[]) => ({
      players: [{ consecratedProvIds: provinces.map((p) => p['id']) }],
      world: { cols: 20, rows: 20, provinces: [at(0, 4, 0), ...provinces] },
    });
    // both one step from province 0: the first of no tax, the second of 3 (the richer wins the tie)
    expect(nearestConsecratedProv(state([at(1, 3, undefined), at(2, 5, 3)]) as never, 0, 0)?.id).toBe(2);
    // the first of no tax, the second of 0: no richer, the first stays
    expect(nearestConsecratedProv(state([at(1, 3, undefined), at(2, 5, 0)]) as never, 0, 0)?.id).toBe(1);
    // the first of tax 2, the second of no tax: the first stays
    expect(nearestConsecratedProv(state([at(1, 3, 2), at(2, 5, undefined)]) as never, 0, 0)?.id).toBe(1);
  });

  test('a guard demoted, a wanderer claimed: a hero of no name', () => {
    const guard: Obj = { _isNeutralGuard: true };
    demoteGuardToWanderer(guard as never);
    expect(guard).toEqual({ _isNeutralGuard: false, name: ' (wandering)' });
    const nulled: Obj = { name: null };
    demoteGuardToWanderer(nulled as never);
    expect(nulled['name']).toBe(' (wandering)');
    const nameless: Obj = {};
    claimWandererName(nameless);
    expect(nameless).toEqual({ name: '' });
    const nulledToo: Obj = { name: null };
    claimWandererName(nulledToo);
    expect(nulledToo).toEqual({ name: '' });
    expect(() => {
      demoteGuardToWanderer(null);
      claimWandererName(undefined);
    }).not.toThrow();
  });

  test("the names' safety net: no list, a gap, a hero of no realm or no name, a wanderer who serves a crown", () => {
    expect(normaliseOwnedNames({})).toBe(0);
    const heroes: Obj[] = [
      { name: 'Ash (wandering)' }, // no realm at all (undefined): skipped
      { player: null, name: 'Birch (wandering)' },
      { player: 0 }, // no name
      { player: 1, name: 'Cedar (Wandering) ' },
    ];
    expect(normaliseOwnedNames({ characters: [null, ...heroes] } as never)).toBe(1);
    expect(heroes.map((h) => h['name'])).toEqual(['Ash (wandering)', 'Birch (wandering)', undefined, 'Cedar']);
  });

  test("the stranded guards' safety net: no list, a gap, a hero of no realm, no world, no province, no armies list", () => {
    expect(normaliseStrandedGuards({})).toBe(0);
    const guard = (more: Obj): Obj => ({ name: 'Gorse', alive: true, _isNeutralGuard: true, location: 3, ...more });
    const unit = { type: 'Shieldwall Levies' };
    // a hero whose realm is undefined (not null) is no guard of the wild: skipped
    const notNull = guard({ armies: [] });
    expect(normaliseStrandedGuards({ characters: [null, notNull] } as never)).toBe(0);
    expect(notNull['_isNeutralGuard']).toBe(true);
    // leading troops, with no world, no list of provinces or no province: not demoted
    for (const world of [undefined, null, {}, { provinces: null }, { provinces: [] }]) {
      const g = guard({ player: null, armies: [unit] });
      expect(normaliseStrandedGuards({ characters: [g], world } as never)).toBe(0);
      expect(g['name']).toBe('Gorse');
    }
    // no armies list: leads no troops, demoted
    const bare = guard({ player: null });
    expect(normaliseStrandedGuards({ characters: [bare], world: {} } as never)).toBe(1);
    expect(bare['name']).toBe('Gorse (wandering)');
  });

  test("a province's consecration, as the map shows it: no province, no state, no list of realms, no owner there", () => {
    const prov = { id: 4, owner: 0 };
    expect(provinceConsecrated({ players: [{ consecratedProvIds: [4] }] }, null)).toBe(false);
    expect(provinceConsecrated({ players: [{ consecratedProvIds: [4] }] }, undefined)).toBe(false);
    expect(provinceConsecrated(null, prov)).toBe(false);
    expect(provinceConsecrated(undefined, prov)).toBe(false);
    expect(provinceConsecrated({}, prov)).toBe(false);
    expect(provinceConsecrated({ players: [] }, prov)).toBe(false);
    expect(provinceConsecrated({ players: [{ consecratedProvIds: [4] }] }, prov)).toBe(true);
  });

  test('the relation between two realms: no relations, a pair with none, an empty one', () => {
    expect(relOfReport({}, 0, 1)).toBe('neutral');
    expect(relOfReport({ relations: { '0-1': '' } }, 1, 0)).toBe('neutral');
    expect(relOfReport({ relations: { '0-1': 'allied' } }, 1, 0)).toBe('allied');
    const tc = (relations: Obj) => ({ G: { relations } }) as never;
    expect(relationBetween(tc({}), 0, 2)).toBe('neutral');
    expect(relationBetween(tc({ '0-2': '' }), 2, 0)).toBe('neutral');
    expect(relationBetween(tc({ '0-2': 'enemy' }), 2, 0)).toBe('enemy');
  });

  test('a realm has met another: no list of realms, no realm, no record', () => {
    expect(realmHasMet({ G: {} }, 0, 1)).toBe(false);
    expect(realmHasMet({ G: { players: [] } }, 0, 1)).toBe(false);
    expect(realmHasMet({ G: { players: [null] } }, 0, 1)).toBe(false);
    expect(realmHasMet({ G: { players: [{}] } }, 0, 1)).toBe(false);
    expect(realmHasMet({ G: { players: [{ _encountered: [1] }] } }, 0, 1)).toBe(true);
  });

  describe('a lurker spotted in your land', () => {
    const world = { cols: 8, rows: 8, provinces: [{ id: 0, row: 0, col: 0, terrain: 'plain', tax: 2 }] };
    const spot = (gs: Obj, prov: Obj, lurker: Obj, turn: number) =>
      spotEnemyInOwnedProvince(
        { players: [{}], characters: [], turn: 1, world, ...gs },
        0,
        { id: 0, row: 0, col: 0, terrain: 'plain', tax: 2, characters: [], ...prov },
        { id: 5, ...lurker },
        turn,
      );
    test('a lurker of no skills has no Spy (95%, not 75%), with no list of realms or of heroes', () => {
      const t = aTurnWhoseRollFallsIn(75, 95);
      expect(spot({}, {}, {}, t)).toBe(true);
      expect(spot({}, {}, { skills: {} }, t)).toBe(true);
      expect(spot({}, {}, { skills: { spy: 1 } }, t)).toBe(false);
      expect(spot({ players: undefined }, { characters: undefined }, {}, t)).toBe(true);
      expect(spot({}, {}, {}, aTurnWhoseRollFallsIn(95, 100))).toBe(false);
    });
    test('a watcher of no skills adds no Spy (80%, not 90%)', () => {
      const t = aTurnWhoseRollFallsIn(80, 90);
      const watcher = { id: 1, player: 0, alive: true, isKing: false, location: 0 };
      const gs = { characters: [{ id: 0, player: 1, alive: true, isKing: false, location: 3 }, watcher] };
      expect(spot(gs, { characters: [1] }, { skills: { spy: 1 } }, t)).toBe(false);
      expect(
        spot(
          { characters: [gs.characters[0], { ...watcher, skills: { spy: 1 } }] },
          { characters: [1] },
          { skills: { spy: 1 } },
          t,
        ),
      ).toBe(true);
    });
  });

  test("a guardian's category: one with no label, one with no use of its hoard", () => {
    expect(monsterCatLabel({ cat: 'mystery' })).toBe('');
    expect(guardianCanUseItem({ cat: 'mystery' }, { name: 'Ring of Testing', slot: 'ring' })).toBe(false);
  });

  test('the Wild Hunt: a type of no price, or of a price of 0, costs the fallback', () => {
    expect(wildHuntPrice('No Such Beast')).toBe(6);
    ARMY_COST_MASTER['Test Free Beast'] = 0;
    try {
      expect(wildHuntPrice('Test Free Beast')).toBe(6);
    } finally {
      Reflect.deleteProperty(ARMY_COST_MASTER, 'Test Free Beast');
    }
  });

  test("an item's lore: none of its own (or empty), by its name, Mithril's, its words, nothing", () => {
    const [known, lore] = Object.entries(ITEM_LORE_BY_NAME)[0] ?? ['', ''];
    expect(lore).toBeTruthy();
    expect(itemLore({ name: known })).toBe(lore);
    expect(itemLore({ name: known, lore: '' })).toBe(lore);
    expect(itemLore({ name: 'No Such Item', effect: { stat: 'mithrilArmour' } })).toBe(MITHRIL_ARMOUR.lore);
    expect(itemLore({ name: 'No Such Item', lore: '', effect: null, desc: 'Plain words' })).toBe('Plain words');
    expect(itemLore({ name: 'No Such Item', effect: { stat: 'melee' } })).toBe('');
    expect(itemLore({ name: 'No Such Item', desc: '' })).toBe('');
    expect(itemLoreLines(null)).toBe('');
    expect(itemLoreLines([null, { name: 'No Such Item', desc: 'Plain words' }, undefined])).toBe(
      '📜 The No Such Item — Plain words',
    );
  });

  test('the fresh effects: no set, an empty set, no pool, an empty pool', () => {
    const pool = [{ name: 'A', effect: { stat: 'melee', bonus: 1 } }];
    const taken = new Set([JSON.stringify({ stat: 'melee', bonus: 1 })]);
    expect(preferFreshEffects(pool, null)).toBe(pool);
    expect(preferFreshEffects(pool, new Set())).toBe(pool);
    expect(preferFreshEffects(null, taken)).toBe(null);
    expect(preferFreshEffects(undefined, taken)).toBe(undefined);
    const empty: Obj[] = [];
    expect(preferFreshEffects(empty as never, taken)).toBe(empty);
    expect(preferFreshEffects(pool, taken)).toBe(pool); // every effect spent: the pool untouched
  });

  test("a lair's power of no tier holds a Weak item", () => {
    expect(lairItemTier('Mythic')).toBe(1);
  });

  test("the hoard's old tally: no realm, no tally, an old count with and without a combat count", () => {
    expect(() => {
      migrateHoardTally(null);
      migrateHoardTally({});
    }).not.toThrow();
    const alone = { _itemsFoundByCat: { consumable: 2 } };
    migrateHoardTally(alone);
    expect(alone._itemsFoundByCat).toEqual({ combat: 2 });
    const beside = { _itemsFoundByCat: { combat: 3, consumable: 2 } };
    migrateHoardTally(beside);
    expect(beside._itemsFoundByCat).toEqual({ combat: 5 });
  });

  describe('the intrusion warnings', () => {
    test('a realm with no list of provinces, a hero with no armies list, no heroes at all', () => {
      const G = {
        turn: 4,
        relations: {},
        players: [{ name: 'Esterhold' }, { name: 'Varn', provinces: [] }],
        characters: [
          { id: 0, name: 'Wren', player: 0, alive: true, location: 2, armies: [] },
          { id: 1, name: 'Thorn', player: 1, alive: true, location: 2 },
        ],
        world: { provinces: [null, null, { id: 2, name: 'Wendmeadow' }] },
      };
      const tc = aTurn(G);
      generateIntrusionNotifications(tc, 1);
      expect([...tc._intrusionAcc.values()]).toEqual([
        {
          targetPi: 0,
          branch: 'known',
          actingName: 'Varn',
          acName: 'Thorn',
          provName: 'Wendmeadow',
          provId: 2,
          phases: [1],
          forceByPhase: { 1: 'no armies' },
        },
        {
          targetPi: 1,
          branch: 'known',
          actingName: 'Esterhold',
          acName: 'Wren',
          provName: 'Wendmeadow',
          provId: 2,
          phases: [1],
          forceByPhase: { 1: 'no armies' },
        },
      ]);
      const none = aTurn({ ...G, characters: undefined });
      generateIntrusionNotifications(none, 1);
      expect(none._intrusionAcc.size).toBe(0);
    });

    test('a lurker of no armies list in your land, with none of yours there and no war: seen', () => {
      const G = {
        turn: 4,
        relations: {},
        players: [{ name: 'Esterhold', provinces: [2] }, { name: 'Varn' }],
        characters: [{ id: 1, name: 'Thorn', player: 1, alive: true, location: 2 }],
        world: { provinces: [null, null, { id: 2, name: 'Wendmeadow' }] },
      };
      const tc = aTurn(G);
      generateIntrusionNotifications(tc, 0);
      expect([...tc._intrusionAcc.values()].map((r) => [r.targetPi, r.branch, r.forceByPhase])).toEqual([
        [0, 'own', { 0: 'no armies' }],
      ]);
    });

    test('a sighting with no phase, a phase of no name, a phase with no force recorded', () => {
      const sighting = (branch: string, phases: number[], forceByPhase: Record<number, string>) => ({
        targetPi: 0,
        branch,
        actingName: 'Varn',
        acName: 'Thorn',
        provName: 'Wendmeadow',
        provId: 2,
        phases,
        forceByPhase,
      });
      const tc = aTurn({ turn: 4, characters: [] });
      tc._intrusionAcc.set('a', sighting('own', [], {}));
      tc._intrusionAcc.set('b', sighting('known', [7], {}));
      tc._intrusionAcc.set('c', sighting('own', [3, 1], { 1: 'a modest band' }));
      flushIntrusionNotifications(tc);
      // the lines in words, as the views write them and the GM's log stores them (since P1-12d15 they are facts)
      expect(theTurnsLinesInWords(tc.turnLog).gmLog.map((l) => l.text)).toEqual([
        '[Intelligence] Thorn of Varn was spotted in your province of Wendmeadow during . Their strength shifted — most recently (undefined) leading undefined.',
        '[Intelligence] A hero of Varn (Thorn) shared Wendmeadow with your forces during undefined. They appear to be leading undefined.',
        '[Intelligence] Thorn of Varn was spotted in your province of Wendmeadow during Summer, Late Autumn. Their strength shifted — most recently (Late Autumn) leading undefined.',
      ]);
    });
  });

  describe('a province taken', () => {
    const G = () => ({
      turn: 3,
      relations: {},
      players: [
        { name: 'Esterhold', alignment: 'Good', consecratedProvIds: [0] },
        { name: 'Varn', alignment: 'Undead', consecratedProvIds: [] },
      ],
      world: { provinces: [{ id: 0, name: 'Wendmeadow', owner: 0, terrain: 'plain' }] },
      characters: [],
    });
    test("the phase from the hero's order, then the stage's; no tax; a taker not there; a hero of no armies list", () => {
      const g = G();
      const tc = aTurn(g, { _logCtx: { charId: null, phase: 2 }, _currentPhase: 4 });
      const prov = g.world.provinces[0];
      setProvinceOwner(tc, prov, 5, { id: 9, name: 'Thorn' });
      expect(tc._tel.captures).toEqual([{ ph: 2, prov: 0, terrain: 'plain', tax: 0, from: 0, to: 5, charId: 9 }]);
      // the lines in words, as the views write them and the GM's log stores them (since P1-12d17 they are facts)
      expect(theTurnsLinesInWords(tc.turnLog).gmLog.map((l) => [l.phase, l.text])).toEqual([
        [2, expect.stringContaining('The consecration of Wendmeadow is broken')],
        [2, '🏴 Wendmeadow has been captured from you by Thorn (an enemy realm), leading no units.'],
      ]);
      const g2 = G();
      const tc2 = aTurn(g2, { _currentPhase: 4 });
      setProvinceOwner(tc2, g2.world.provinces[0], 1, null);
      expect(tc2._tel.captures).toEqual([{ ph: 4, prov: 0, terrain: 'plain', tax: 0, from: 0, to: 1, charId: null }]);
      expect(tc2.turnLog.map((l) => l.phase)).toEqual([4, 4]);
    });

    test('the altars cast down: no armies list, a gap and a unit left out of the column, a unit of no name', () => {
      const bare = aTurn(G());
      breakConsecrationOnCapture(bare, { id: 0, name: 'Wendmeadow' }, 0, 1, { id: 9, name: 'Thorn' }, 2);
      expect(bare.turnLog).toHaveLength(1);
      const column = [
        null,
        { type: 'Shieldwall Levies', quality: 'Green', unitName: 'the Old Guard', _died: true },
        { type: 'Shieldwall Levies', quality: 'Green', unitName: '' },
      ];
      const tc = aTurn(G());
      withDice(0, () => {
        breakConsecrationOnCapture(
          tc,
          { id: 0, name: 'Wendmeadow' },
          0,
          1,
          { id: 9, name: 'Thorn', armies: column } as never,
          2,
        );
      });
      expect(column[1]).toMatchObject({ quality: 'Green' });
      expect(column[2]).toMatchObject({ quality: 'Average', unitName: '' });
      const pool: readonly string[] = ARMY_UNIT_NAMES['Shieldwall Levies'];
      const text = theTurnsLinesInWords(tc.turnLog).gmLog[1]?.text ?? '';
      const named = /Flushed with the deed, (.+) \(now Average\) gains an experience level\./.exec(text)?.[1] ?? '';
      expect(pool.some((name) => named.startsWith(name))).toBe(true);
    });

    test("the altars cast down by a Good or Neutral column: its troops can't rise, so they take no pride in it", () => {
      for (const alignment of ['Good', 'Neutral']) {
        const g = G();
        const tc = aTurn({
          ...g,
          players: [...g.players.slice(0, 1), { name: 'Varn', alignment, consecratedProvIds: [] }],
        });
        const column = [{ type: 'Shieldwall Levies', quality: 'Green', unitName: 'the Old Guard' }];
        breakConsecrationOnCapture(
          tc,
          { id: 0, name: 'Wendmeadow' },
          0,
          1,
          { id: 9, name: 'Thorn', armies: column } as never,
          2,
        );
        expect([column[0]?.quality, theTurnsLinesInWords(tc.turnLog).gmLog[1]?.text]).toEqual([
          'Green',
          "✨ Thorn's column casts down the altars of Wendmeadow — the ground is holy no longer. The troops take no pride in the sacrilege.",
        ]);
      }
    });
  });

  describe("an Evil hero's conquest", () => {
    const conquer = (cc: Obj, prov: Obj) => {
      const realm = { name: 'Varn', alignment: 'Evil', gold: 10 };
      const tc = aTurn({ turn: 6, players: [realm], characters: [] });
      const p: Obj = { id: 2, name: 'Wendmeadow', terrain: 'plain', ...prov };
      withDice(0, () => {
        applyEvilConquest(tc, { name: 'Thorn', player: 0, ...cc }, p as never, realm);
      });
      return { realm, tc, p };
    };
    test('no plan, or an empty doctrine: plunder; no tax: nothing taken', () => {
      expect(conquer({}, { tax: 5 }).realm.gold).toBe(12);
      expect(conquer({ encounterPlan: { evilMode: '' } }, { tax: 5 }).realm.gold).toBe(12);
      const { realm, tc } = conquer({}, {});
      expect(realm.gold).toBe(10);
      expect(tc.turnLog).toHaveLength(0);
    });
    test('enslaving: no list of types, an empty one, an empty type, no garrison list, folk of no race', () => {
      for (const prov of [{}, { armyTypes: [] }, { armyTypes: [''] }, { race: '' }, { race: null }]) {
        const { p } = conquer({ encounterPlan: { evilMode: 'enslave' } }, prov);
        const garrison = p['garrisonArmies'] as Obj[];
        expect(garrison).toHaveLength(1);
        expect(garrison[0]).toMatchObject({ type: 'Shieldwall Levies', quality: 'Green', race: 'Human' });
        expect(p['_enslavedUntil']).toBe(9);
      }
    });
  });

  describe('a victory: the blood harvest and the Iron Throne', () => {
    const world = () => ({
      turn: 2,
      players: [{ name: 'Varn', alignment: 'Evil', gold: 0, discoveries: [{ id: 'gd' }] }],
      characters: [],
    });
    test('no winner, a winner of no realm or no id: nothing', () => {
      const G: Obj = world();
      const narrative: NarrativeLine[] = [];
      for (const winner of [null, undefined, {}, { player: null, id: 1 }]) {
        bloodHarvest({ G } as never, winner, 3, narrative);
        ironThroneRaise({ G } as never, winner, [{ type: 'Shieldwall Levies' }] as never, narrative);
      }
      withDice(0, () => {
        ironThroneRaise({ G } as never, { player: 0 }, [{ type: 'Shieldwall Levies' }] as never, narrative);
      });
      expect(narrative).toEqual([]);
      expect(G['_pendingRises']).toBeUndefined();
    });
    test("the Iron Throne's rises: no list of rises yet, a unit of no name", () => {
      const G: Obj = world();
      const narrative: NarrativeLine[] = [];
      const dead = [
        { type: 'Shieldwall Levies', quality: 'Veteran', unitName: 'the Old Guard' },
        { type: 'Shieldwall Levies', quality: 'Green', unitName: '' },
        null,
        { type: 'Shieldwall Levies', quality: 'Green', unitName: 'Bones', _isSkeletal: true },
      ];
      withDice(0, () => {
        ironThroneRaise({ G } as never, { player: 0, id: 4 }, dead as never, narrative);
      });
      const rises = G['_pendingRises'] as { charId: number; unit: Obj }[];
      expect(rises.map((r) => [r.charId, r.unit['quality'], r.unit['race'], r.unit['_isSkeletal']])).toEqual([
        [4, 'Veteran', 'Undead', true],
        [4, 'Green', 'Undead', true],
      ]);
      expect(rises[0]?.unit['unitName']).toBe('the Old Guard (Skeletal)');
      expect(rises[1]?.unit['unitName']).toMatch(/^\S.* \(Skeletal\)$/);
      expect(narrative).toEqual([
        { kind: "the iron throne of skulls raises the enemy's fallen as skeletons", raisedCount: 2 },
      ]);
    });
  });
});
