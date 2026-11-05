// The lines of the engine's other folders that plan P1-12d17 made facts (espionage/, realms/, magic/, world/, bots/
// and run-turn.ts: their words now written by the views, src/views/prose/), where no game of the balance matrix
// reaches the line or one of its fallbacks: a spy who serves no realm, or a realm of no name, caught prying; a province
// with no list of defenders; a Bless ward against a caster not named; the Plague on a unit of no name; a capture with
// no conqueror and no realm named; and an Evil conqueror's enslavement of the folk, and of a province with no humanoid
// folk. The matrix proves the rest (the GM's log byte-identical in all 120 games); each of these is proved here on the
// words the engine wrote before, whole, as the GM's log stores them (theTurnsLinesInWords). Since plan P1-10b36 freed
// the spy's learning, the Plague and the lair items of their ts-nocheck line, it also holds, each on the value it had
// before: a spy on a king's home in a world with no roll of heroes or a gap in it, the owner's warning of a spy of no
// realm, of a realm of no name or of none at his index, and a spy of no realm who lifts a secret (a TypeError); a Bless
// ward of no realm, your own, or of no chance; the Plague of no level, with no heroes, host or garrison listed, on a
// unit of an empty name, and spreading over no provinces or past a ward of no chance; and the lairs' stocking on what a
// staged world lacks (a state, realms, a map's width, a guardian, features), the kinds already handed out, a second
// round of legendaries, and the repair of two neighbouring lairs left with one effect.
// Level 1 (unit): each is a plain function on a staged world, called directly on the engine's modules (plan P1-14a);
// a static check can't run them, and no game reaches these lines. The staged values carry only the fields each reads,
// so their type is given by assertion (`as never`) where the function's own type asks for more. The dice are fixed with kcRng.use where a line draws them.
import '../lib/the-whole-engine.ts';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { kcRng } from '../../src/engine/rng.ts';
import { createTurnContext, type TurnContext } from '../../src/engine/turn/context.ts';
import { theTurnsLinesInWords } from '../../src/views/prose/the-words-of-each-line.ts';
import { applySpySuccess } from '../../src/engine/espionage/what-a-spy-learns.ts';
import { applyEvilConquest, setProvinceOwner } from '../../src/engine/realms/relations-and-captures.ts';
import { applyPlague, blessWardNegates, spreadPlagues } from '../../src/engine/magic/plague-and-bless-ward.ts';
import {
  ensureAllLairHoards,
  lairRegionOf,
  noteItemFound,
  rollMagicItemFor,
} from '../../src/engine/items/lair-items.ts';
import { rollMagicItem } from '../../src/engine/items/equipment.ts';
import { awardedEffectSet, itemEffectKey, itemHoardCategory } from '../../src/engine/items/tiers-and-hoards.ts';
import { shuffleP } from '../../src/engine/battle/fortune.ts';
import { DISC_BY_ID } from '../../src/engine/discoveries.ts';
import { ALL_MAGIC_ITEMS_P } from '../../src/content/kingdoms-call-data.ts';
import { isLegendaryItem } from '../../src/engine/rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';

type Obj = Record<string, unknown>;

// The GM's log echoes each line on the console: quiet while the test writes lines.
const consoleLog = console.log;
beforeAll(() => {
  console.log = () => undefined;
});
afterAll(() => {
  console.log = consoleLog;
});

/** A turn's context on a staged state, with what emit reads. */
function aTurn(G: Obj): TurnContext {
  const tc = createTurnContext(G, [], 3) as unknown as TurnContext;
  Object.assign(tc, {
    _logCtx: { charId: null, phase: null },
    _currentPhase: 1,
    _afterPhases: false,
    _tel: { pre: {}, orders: {}, factsInTheTurnsOrder: [] },
  });
  return tc;
}
/** The words of the turn's lines, as the GM's log stores them. */
function wordsOf(tc: TurnContext): (string | null | undefined)[] {
  return theTurnsLinesInWords(tc.turnLog).gmLog.map((l) => l.text);
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

describe("the other folders' lines no matrix game reaches keep their words", () => {
  describe('what a spy learns', () => {
    // Esterhold holds Wendmeadow, which keeps no list of defenders; the spy is a master (Spy 9: he learns nothing
    // more), and no realm's home is there.
    const spy = (player: number | null, players: Obj[]) => {
      const G = {
        turn: 4,
        players,
        characters: [],
        world: { provinces: [] },
      };
      const tc = aTurn(G);
      const sprov = { id: 2, name: 'Wendmeadow', owner: 0, tax: 3, features: [] };
      withDice(0.99, () => {
        applySpySuccess(tc, { id: 7, name: 'Thorn', player, alive: true, skills: { spy: 9 } } as never, sprov);
      });
      return wordsOf(tc);
    };
    test('a spy who serves no realm: no defenders listed, and "unknown agents" caught prying', () => {
      expect(spy(null, [{ name: 'Esterhold', homeProvinceId: 99 }])).toEqual([
        'Thorn spies on Wendmeadow: controlled by Esterhold, tax 3g, defenders: none.',
        "[Intelligence] 🕵 Counter-intelligence: your watch in Wendmeadow caught unknown agents's agents prying this turn.",
      ]);
    });
    test('a spy of a realm with no name: "an unknown power" caught prying', () => {
      const words = spy(1, [
        { name: 'Esterhold', homeProvinceId: 99 },
        { name: '', homeProvinceId: 98 },
      ]);
      expect(words[1]).toBe(
        "[Intelligence] 🕵 Counter-intelligence: your watch in Wendmeadow caught an unknown power's agents prying this turn.",
      );
    });
  });

  describe('the Plague and the Bless ward', () => {
    test('a Bless ward against a caster not named: "a hostile mage"', () => {
      const tc = aTurn({ turn: 4, players: [], characters: [] });
      const prov = { id: 2, name: 'Wendmeadow', _blessWardTurn: 4, _blessWardBy: 0, _blessWardPct: 100 };
      expect(withDice(0, () => blessWardNegates(tc, prov, null, 'Flood'))).toBe(true);
      expect(wordsOf(tc)).toEqual([
        "✨ A blessing lies over Wendmeadow — a hostile mage's Flood washes over the sacred ground and does no harm.",
      ]);
    });
    test('the Plague on a garrison unit of no name: its type names it', () => {
      const tc = aTurn({ turn: 4, players: [{ name: 'Esterhold' }], characters: [] });
      const prov = {
        id: 2,
        name: 'Wendmeadow',
        owner: 0,
        garrisonArmies: [{ type: 'Shieldwall Levies', quality: 'Veteran', race: 'Human' }],
      };
      expect(withDice(0, () => applyPlague(tc, prov, 1, 2))).toEqual({ tested: 1, affected: 1 });
      expect(wordsOf(tc)).toEqual([
        '☠ Plague sickens the garrison of Wendmeadow: Shieldwall Levies (now Average) lose an experience level.',
      ]);
    });
  });

  describe('a province taken', () => {
    test('no conqueror and no realm named: "an unknown commander", "an enemy realm", and no units', () => {
      const G = {
        turn: 3,
        players: [{ name: 'Esterhold' }],
        world: { provinces: [{ id: 0, name: 'Wendmeadow', owner: 0, terrain: 'plain' }] },
        characters: [],
      };
      const tc = aTurn(G);
      setProvinceOwner(tc, G.world.provinces[0], 5, null);
      expect(wordsOf(tc)).toEqual([
        '🏴 Wendmeadow has been captured from you by an unknown commander (an enemy realm).',
      ]);
    });
  });

  describe("an Evil hero's conquest", () => {
    const conquer = (prov: Obj) => {
      const realm = { name: 'Varn', alignment: 'Evil', gold: 10 };
      const tc = aTurn({ turn: 6, players: [realm], characters: [] });
      const p: Obj = { id: 2, name: 'Wendmeadow', terrain: 'plain', tax: 4, ...prov };
      withDice(0, () => {
        applyEvilConquest(tc, { name: 'Thorn', player: 0, encounterPlan: { evilMode: 'enslave' } }, p as never, realm);
      });
      return wordsOf(tc);
    };
    test('the beaten folk pressed into the garrison in chains', () => {
      expect(conquer({ race: 'Human', armyTypes: ['Free Lances'] })).toEqual([
        '⛓ Enslavement: Thorn presses the beaten folk of Wendmeadow into service — a Green Free Lances joins the garrison in chains, but the province seethes (−1 tax for 3 turns).',
      ]);
    });
    test('no humanoid folk to press: the forces plunder instead', () => {
      expect(conquer({ race: 'Primal Beasts' })).toEqual([
        '⛓ Thorn would enslave Wendmeadow, but there are no humanoid folk here to press — the forces plunder instead.',
        "⚔ Evil looting: Thorn's forces plunder Wendmeadow — 2g seized immediately!",
      ]);
    });
  });
  // Since plan P1-10b36 freed the three files of their ts-nocheck line: the lines of the spy's learning, the Plague,
  // the Bless ward and the lairs' stocking that no game reaches, each on the value it had before.
  describe("what a spy learns, on a king's home and in the owner's warning", () => {
    /** Thorn, a master spy (Spy 9), of the realm `player`, spies on Wendmeadow (no list of defenders or features),
     *  Esterhold's home; Varn's home is elsewhere. */
    const spyOnAHome = (player: number | null, G: Obj, dice = 0.99) => {
      const tc = aTurn(G);
      const thorn = { id: 7, name: 'Thorn', player, alive: true, skills: { spy: 9 }, items: [] };
      withDice(dice, () => {
        applySpySuccess(tc, thorn as never, { id: 2, name: 'Wendmeadow', owner: 0, tax: 3 });
      });
      return wordsOf(tc);
    };
    const twoRealms = (): Obj[] => [
      { name: 'Esterhold', homeProvinceId: 2 },
      { name: 'Varn', homeProvinceId: 5 },
    ];
    test('a world with no roll of heroes: the crown commands none beyond the king', () => {
      const players = twoRealms();
      const G = {
        turn: 4,
        players,
        world: {
          provinces: [
            { owner: 0, tax: 3 },
            { owner: 0, tax: 2 },
          ],
        },
      };
      expect(spyOnAHome(1, G)).toEqual([
        'Thorn spies on Wendmeadow: controlled by Esterhold, tax 3g, defenders: none.',
        '[Intelligence] Home-capital intelligence on Esterhold: the crown draws ~5g in tax income each turn and commands 0 heroes beyond the king.',
        "[Intelligence] 🕵 Counter-intelligence: your watch in Wendmeadow caught Varn's agents prying this turn.",
      ]);
      expect(players[0]?.['_spiedOnThisTurn']).toEqual([
        { provId: 2, provName: 'Wendmeadow', byPlayer: 1, byName: 'Varn', turn: 4 },
      ]);
      expect(players[1]?.['_spiedProvincesThisTurn']).toEqual([2]);
    });
    test('a gap in the roll of heroes is passed over; a spy of no realm marks no realm and is "unknown agents"', () => {
      const players = twoRealms();
      const G = {
        turn: 4,
        players,
        characters: [{ alive: true, player: 0, isKing: false }, null],
        world: { provinces: [] },
      };
      expect(spyOnAHome(null, G)[1]).toBe(
        '[Intelligence] Home-capital intelligence on Esterhold: the crown draws ~0g in tax income each turn and commands 1 hero beyond the king.',
      );
      expect(players[0]?.['_spiedOnThisTurn']).toEqual([
        { provId: 2, provName: 'Wendmeadow', byPlayer: null, byName: 'unknown agents', turn: 4 },
      ]);
      expect(players[0]?.['_spiedProvincesThisTurn']).toBeUndefined();
      expect(players[1]?.['_spiedProvincesThisTurn']).toBeUndefined();
    });
    test('a spy of a realm of no name, or of an index no realm holds: "an unknown power", in the warning too', () => {
      const unnamed = [
        { name: 'Esterhold', homeProvinceId: 2 },
        { name: '', homeProvinceId: 5 },
      ];
      expect(spyOnAHome(1, { turn: 4, players: unnamed, characters: [], world: { provinces: [] } })[2]).toBe(
        "[Intelligence] 🕵 Counter-intelligence: your watch in Wendmeadow caught an unknown power's agents prying this turn.",
      );
      expect(unnamed[0]).toMatchObject({ _spiedOnThisTurn: [{ byPlayer: 1, byName: 'an unknown power' }] });
      const players = twoRealms();
      expect(spyOnAHome(5, { turn: 4, players, characters: [], world: { provinces: [] } })[2]).toBe(
        "[Intelligence] 🕵 Counter-intelligence: your watch in Wendmeadow caught an unknown power's agents prying this turn.",
      );
      expect(players[0]).toMatchObject({ _spiedOnThisTurn: [{ byPlayer: 5, byName: 'an unknown power' }] });
    });
    test("a spy of no realm who lifts a secret from a king's archives: the TypeError the old read threw", () => {
      const secret = Object.values(DISC_BY_ID).find((d) => !d.race && !d.alignment);
      const players = [
        {
          name: 'Esterhold',
          homeProvinceId: 2,
          discoveries: [
            { id: secret?.id, name: secret?.name, category: secret?.category, desc: '', turnDiscovered: 1 },
          ],
        },
      ];
      expect(() => spyOnAHome(null, { turn: 4, players, characters: [], world: { provinces: [] } }, 0.5)).toThrow(
        TypeError,
      );
    });
  });

  describe('the Bless ward and the Plague, on what a staged world lacks', () => {
    const wendmeadow = (ward: Obj) => ({ id: 2, name: 'Wendmeadow', _blessWardTurn: 4, ...ward });
    const morwen = { player: 1, name: 'Morwen' };
    test('a ward of no realm, your own ward, or a ward of no chance turns nothing aside', () => {
      const tc = aTurn({ turn: 4, players: [], characters: [] });
      expect(withDice(0, () => blessWardNegates(tc, wendmeadow({ _blessWardPct: 100 }), morwen, 'Flood'))).toBe(false);
      expect(
        withDice(0, () => blessWardNegates(tc, wendmeadow({ _blessWardBy: 1, _blessWardPct: 100 }), morwen, 'Flood')),
      ).toBe(false);
      expect(withDice(0, () => blessWardNegates(tc, wendmeadow({ _blessWardBy: 0 }), morwen, 'Flood'))).toBe(false);
      expect(wordsOf(tc)).toEqual([]);
    });
    const levies = (unitName?: string) => ({
      type: 'Shieldwall Levies',
      quality: 'Veteran',
      race: 'Human',
      ...(unitName === undefined ? {} : { unitName }),
    });
    test('a Plague of no level: the 10% chance (a roll of 12 spares the unit)', () => {
      const tc = aTurn({ turn: 4, players: [{ name: 'Esterhold' }], characters: [] });
      const prov = { id: 2, name: 'Wendmeadow', owner: 0, garrisonArmies: [levies()] };
      expect(withDice(0.12, () => applyPlague(tc, prov, undefined, 2))).toEqual({ tested: 1, affected: 0 });
    });
    test('no roll of heroes, a hero there with no host, no garrison list: nothing to sicken', () => {
      const tc = aTurn({ turn: 4, players: [{ name: 'Esterhold' }] });
      expect(withDice(0, () => applyPlague(tc, { id: 2, name: 'Wendmeadow', owner: 0 }, 1, 2))).toEqual({
        tested: 0,
        affected: 0,
      });
      const withAHero = aTurn({
        turn: 4,
        players: [{ name: 'Esterhold' }],
        characters: [{ id: 3, alive: true, location: 2, player: 0 }],
      });
      expect(withDice(0, () => applyPlague(withAHero, { id: 2, name: 'Wendmeadow', owner: 0 }, 1, 2))).toEqual({
        tested: 0,
        affected: 0,
      });
    });
    test('the Plague on a garrison unit whose name is empty: its type names it', () => {
      const tc = aTurn({ turn: 4, players: [{ name: 'Esterhold' }], characters: [] });
      const prov = { id: 2, name: 'Wendmeadow', owner: 0, garrisonArmies: [levies('')] };
      expect(withDice(0, () => applyPlague(tc, prov, 1, 2))).toEqual({ tested: 1, affected: 1 });
      expect(wordsOf(tc)).toEqual([
        '☠ Plague sickens the garrison of Wendmeadow: Shieldwall Levies (now Average) lose an experience level.',
      ]);
    });
    test('the Plague spreads over a map with no list of provinces (none), and past a ward of no chance', () => {
      expect(() => {
        spreadPlagues(aTurn({ turn: 4, players: [], characters: [], world: { cols: 2, rows: 1 } }), 2);
      }).not.toThrow();
      // Ashfell, plagued this turn by Varn with no level on record, beside Wendmeadow, blessed by Esterhold this turn
      // with no chance on record
      const ashfell = { id: 0, row: 0, col: 0, name: 'Ashfell', _plaguedTurn: 4, _plagueCaster: 1 };
      const wend = { id: 1, row: 0, col: 1, name: 'Wendmeadow', owner: 0, _blessWardTurn: 4, _blessWardBy: 0 };
      const tc = aTurn({
        turn: 4,
        players: [{ name: 'Esterhold' }, { name: 'Varn' }],
        characters: [],
        world: { provinces: [ashfell, wend], cols: 2, rows: 1 },
      });
      withDice(0, () => {
        spreadPlagues(tc, 2);
      });
      expect(wend).toMatchObject({ _plaguedTurn: 4, _plagueLevel: 0, _plagueCaster: 1 });
    });
  });

  describe("the lairs' stocking and a realm's finds, on what a staged world lacks", () => {
    const names = (items: unknown) => (items as { name: string }[]).map((it) => it.name);
    const everyNameBut = (kept: ReadonlySet<string>) =>
      ALL_MAGIC_ITEMS_P.map((it) => it.name).filter((n) => !kept.has(n));
    const aLair = (name: string, power: string | null = 'Weak'): Obj => ({
      name,
      monster: power === null ? null : { power },
      cleared: false,
      discovered: false,
      treasure: 0,
    });
    /** A map one row high, `cols` wide; each province's features as `features` gives them (none: an empty list). */
    const aRow = (cols: number, features: (i: number) => unknown[] | undefined) =>
      Array.from({ length: cols }, (_, i) => ({ id: i, row: 0, col: i, tax: 1, features: features(i) }));
    const tierOne = ALL_MAGIC_ITEMS_P.filter((it) => it.tier === 1 && !isLegendaryItem(it));
    /** The first tier-1 design held under three names or more (its first three), and another item of its kind. */
    const aDesignUnderThreeNamesAndAnother = () => {
      const byDesign = new Map<string, typeof tierOne>();
      tierOne.forEach((it) => {
        const k = `${itemHoardCategory(it)}|${itemEffectKey(it)}`;
        byDesign.set(k, [...(byDesign.get(k) ?? []), it]);
      });
      const thrice = ([...byDesign.values()].find((l) => l.length >= 3) ?? []).slice(0, 3);
      const [first] = thrice;
      const other = tierOne.find(
        (it) => itemHoardCategory(it) === itemHoardCategory(first) && itemEffectKey(it) !== itemEffectKey(first),
      );
      return [thrice, other] as const;
    };

    test("a lair's region with no state, no realms, no map, or a map of no width (no wrap round)", () => {
      expect(lairRegionOf(null, { row: 0, col: 0 })).toBe(0);
      expect(lairRegionOf({}, { row: 0, col: 0 })).toBe(0);
      expect(lairRegionOf({ players: [{ homeProvinceId: 3 }] }, { row: 0, col: 0 })).toBe(0);
      // Esterhold's home at column 9, Varn's at column 3: with no width the map doesn't wrap, so Varn's is nearer
      const G = { players: [{ homeProvinceId: 9 }, { homeProvinceId: 3 }], world: { provinces: aRow(10, () => []) } };
      expect(lairRegionOf(G as never, { row: 0, col: 0 })).toBe(1);
    });
    test('a find noted in a world with no realms: nothing to tally', () => {
      expect(() => {
        noteItemFound({}, 0, tierOne[0]);
      }).not.toThrow();
    });
    test("a realm's draw with no names taken, no realm there, no realms, or nothing left in the treasury", () => {
      const G = { players: [{ name: 'Esterhold' }], _awardedItems: [] } as never;
      expect(withDice(0.3, () => rollMagicItemFor(G, 0, 'Weak', null))).toMatchObject({ tier: 1 });
      const plain = withDice(0.3, () => rollMagicItem('Weak', new Set(), awardedEffectSet(G)));
      expect(withDice(0.3, () => rollMagicItemFor(G, null, 'Weak', new Set()))).toBe(plain);
      expect(withDice(0.3, () => rollMagicItemFor({ _awardedItems: [] }, 0, 'Weak', new Set()))).toBe(plain);
      expect(withDice(0.3, () => rollMagicItemFor(G, 0, 'Weak', new Set(everyNameBut(new Set()))))).toBeNull();
    });
    test('no state, or no map: nothing to stock', () => {
      expect(() => {
        ensureAllLairHoards(null);
        ensureAllLairHoards({});
      }).not.toThrow();
    });
    test('a lair with no guardian is stocked as a Weak one; a province with no features, a gap, a guardian of no power stocked, a province whose id names no place', () => {
      const legendaries = new Set(ALL_MAGIC_ITEMS_P.filter((it) => isLegendaryItem(it)).map((it) => it.name));
      const barrow = aLair('Old Barrow', null);
      const mythic = { ...aLair('Sunken Vault', 'Mythic') };
      // a single province, its id 5: no place 5 in the list
      const provinces = [
        { id: 5, row: 0, col: 0, tax: 1, features: [null, barrow, mythic] },
        { id: 1, row: 0, col: 1, tax: 1 },
      ];
      const G: Obj = { players: [], world: { provinces, cols: 2, rows: 1 }, _awardedItems: [...legendaries] };
      withDice(0, () => {
        ensureAllLairHoards(G);
      });
      expect(barrow['hoardItems']).toMatchObject([{ tier: 1, id: 0 }]);
      expect(G['nextItemId']).toBe(1);
      expect(mythic).not.toHaveProperty('hoardItems');
    });
    test("the kinds already handed out steer the stocking: the rings are spent, so the lair's item is the weapon", () => {
      const ring = tierOne.find((it) => itemHoardCategory(it) === 'ring');
      const weapon = tierOne.find(
        (it) => itemHoardCategory(it) === 'weapon' && itemEffectKey(it) !== itemEffectKey(ring),
      );
      const kept = new Set([String(ring?.name), String(weapon?.name)]);
      const anotherRing = ALL_MAGIC_ITEMS_P.find((it) => itemHoardCategory(it) === 'ring' && !kept.has(it.name));
      const lair = aLair('Hollow Hill');
      const G: Obj = {
        players: [],
        world: { provinces: aRow(1, () => [lair]), cols: 1, rows: 1 },
        _awardedItems: [...everyNameBut(kept), ...Array.from({ length: 1000 }, () => String(anotherRing?.name))],
      };
      withDice(0, () => {
        ensureAllLairHoards(G);
      });
      expect(names(lair['hoardItems'])).toEqual([weapon?.name]);
    });
    test('more legendaries than lairs: a second round deals the rest, last of the shuffle first', () => {
      const left = ALL_MAGIC_ITEMS_P.filter((it) => isLegendaryItem(it)).slice(0, 3);
      const lair = aLair('Dragon Hoard', 'Legendary');
      const G: Obj = {
        players: [],
        world: { provinces: aRow(1, () => [lair]), cols: 1, rows: 1 },
        _awardedItems: everyNameBut(new Set(left.map((it) => it.name))),
      };
      withDice(0, () => {
        ensureAllLairHoards(G);
      });
      expect(names(lair['hoardItems'])).toEqual(names(shuffleP(left, () => 0).reverse()));
    });
    test.each([
      ['ten provinces wide', 10],
      ['of no width (it does not wrap round)', undefined],
    ])(
      "two neighbouring lairs left with one effect, on a map %s: the repair swaps one's item with a far lair's",
      (_, cols) => {
        // the treasury holds two designs: one under two names, and one other of the same kind and tier
        const byDesign = new Map<string, typeof tierOne>();
        tierOne.forEach((it) => {
          const k = `${itemHoardCategory(it)}|${itemEffectKey(it)}`;
          byDesign.set(k, [...(byDesign.get(k) ?? []), it]);
        });
        const twice = [...byDesign.values()].find((l) => l.length >= 2) ?? [];
        const [first, second] = twice;
        const other = tierOne.find(
          (it) => itemHoardCategory(it) === itemHoardCategory(first) && itemEffectKey(it) !== itemEffectKey(first),
        );
        const kept = new Set([String(first?.name), String(second?.name), String(other?.name)]);
        // Ashfell (column 0) and Wendmeadow (1) side by side, Thornwood (6) four provinces away round the map
        const [ash, wend, thorn] = [aLair('Ashfell Barrow'), aLair('Wendmeadow Den'), aLair('Thornwood Lair')];
        const lairs = new Map<number, Obj>([
          [0, ash],
          [1, wend],
          [6, thorn],
        ]);
        const G: Obj = {
          players: [],
          world: { provinces: aRow(10, (i) => [lairs.get(i)].filter(Boolean)), cols, rows: 1 },
          _awardedItems: everyNameBut(kept),
        };
        withDice(0, () => {
          ensureAllLairHoards(G);
        });
        // Wendmeadow's lair was stocked first (the first design), then Thornwood's (the other: unspent), then Ashfell's
        // (the first design again, nothing else left); the repair gives Wendmeadow Thornwood's item and Thornwood its own
        expect([ash, wend, thorn].map((l) => names(l['hoardItems']))).toEqual([
          [second?.name],
          [other?.name],
          [first?.name],
        ]);
        expect([ash, wend, thorn].map((l) => (l['hoardItems'] as { id: number }[])[0]?.id)).toEqual([2, 1, 0]);
      },
    );
    test('the lairs holding an effect, kept after a swap for the next lair the repair weighs', () => {
      // one design under three names and one other of its kind, for four lairs at columns 0, 2, 7 and 8
      const [thrice, other] = aDesignUnderThreeNamesAndAnother();
      const kept = new Set([...thrice.map((it) => it.name), String(other?.name)]);
      const lairs = new Map([0, 2, 7, 8].map((c) => [c, aLair(`Lair ${String(c)}`)]));
      const G: Obj = {
        players: [],
        world: { provinces: aRow(14, (i) => [lairs.get(i)].filter(Boolean)), cols: 14, rows: 1 },
        _awardedItems: everyNameBut(kept),
      };
      withDice(0.6, () => {
        ensureAllLairHoards(G);
      });
      expect([...lairs.values()].map((l) => names(l['hoardItems']))).toEqual([
        [thrice[1]?.name],
        [thrice[2]?.name],
        [thrice[0]?.name],
        [other?.name],
      ]);
    });
    test('a lair with no guardian is dealt after a Moderate one: the one legendary left goes to the Moderate den', () => {
      const [theOneLeft] = ALL_MAGIC_ITEMS_P.filter((it) => isLegendaryItem(it));
      const barrow = aLair('Old Barrow', null);
      const den = aLair('Wolf Den', 'Moderate');
      const G: Obj = {
        players: [],
        world: { provinces: aRow(2, (i) => [i === 0 ? barrow : den]), cols: 2, rows: 1 },
        // every legendary handed out but one
        _awardedItems: ALL_MAGIC_ITEMS_P.filter((it) => isLegendaryItem(it) && it.name !== theOneLeft?.name).map(
          (it) => it.name,
        ),
      };
      withDice(0, () => {
        ensureAllLairHoards(G);
      });
      expect(names(den['hoardItems'])).toEqual([theOneLeft?.name]);
      expect(barrow['hoardItems']).toMatchObject([{ tier: 1 }]);
    });
    test('two lairs in a province whose id names no place in the list: both stocked, the bar passing over it', () => {
      const legendaries = ALL_MAGIC_ITEMS_P.filter((it) => isLegendaryItem(it)).map((it) => it.name);
      const provinces = [{ id: 5, row: 0, col: 0, tax: 1, features: [aLair('Old Barrow'), aLair('Wolf Den')] }];
      const G: Obj = { players: [], world: { provinces, cols: 1, rows: 1 }, _awardedItems: legendaries };
      withDice(0, () => {
        ensureAllLairHoards(G);
      });
      expect(G['nextItemId']).toBe(2);
    });
  });
});
