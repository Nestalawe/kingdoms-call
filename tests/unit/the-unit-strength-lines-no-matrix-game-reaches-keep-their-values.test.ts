// The lines of src/engine/battle/terrain-and-unit-strength.ts that plan P1-10b6 changed to free it of the ts-nocheck
// line (statements that keep every value: P1-10b's Decision 2 and Choice 1) and that no game of the balance matrix
// reaches. The matrix proves the others (both sets, every realm's report identical); these are proved here, each on the
// value it had before (worked out by the file as it was, with its ts-nocheck line):
// - a ground that is missing (terrainMod), a volley with no damage multiplier or no options, arrows at an armoured hull
//   or a shell (no matrix game shoots at Dwarf Ironclads or Great Turtles);
// - a force carried over the sea by its flyers, and one with a hull among it (the sea penalty each unit then takes);
// - a force or a leader that is missing, a gap in a force, or a leader whose race is '' (the airborne test, kinship's
//   line, a coastal province, a hero's kinship);
// - a unit of a quality the tables don't hold (no step up, the multiplier's fallback), the Standing Stones of a Pagan
//   Wonder defending in the woods, Phantasmal Armies' bonus (set by nothing today), a hero with no list of items or an
//   item with no effect, and the Kraken Figurehead's step up a tier for the fleets its bearer leads;
// - a ladder row with no command multipliers, a gap among them or one of ×1, and a side with no force multipliers, no
//   options or no ground.
// Level 1 (unit): pure functions called directly on the engine's modules (plan P1-14a), with no turn played. None of
// them draws a die. A hero is staged with the fields these read, so his type is given by assertion (as the views' unit
// cases give a staged world's), and the turn's context holds only its state.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import {
  applyMissileHit,
  armStr,
  finishSide,
  isAirborneAtSea,
  kinNarrative,
  ladderRow,
  missileShotDamage,
  provIsCoastal,
  terrainMod,
} from '../../src/engine/battle/terrain-and-unit-strength.ts';
import { battleGrid } from '../../src/engine/battle/lines.ts';
import { theWordsOf } from '../../src/views/prose/the-words-of-each-line.ts';
import { ladderFm } from '../../src/engine/battle/a-multiplier-written-as-the-strength-ladder-shows-it.ts';
import { UNIT_BASE_STR, UNIT_Q_MULT } from '../../src/engine/rules-on-plain-values/unit-types-and-base-strength.ts';
import type { ArmyInABattle, HeroInABattle } from '../../src/engine/army-tables.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';
import type { Character, Province } from '../../src/schemas/saved-game-state.ts';

/** A unit of no race (so no kinship), of quality `quality`. */
const unit = (type: string, quality = 'Average', extra: Partial<ArmyInABattle> = {}): ArmyInABattle => ({
  type,
  quality,
  race: '',
  unitName: `the Test ${type}`,
  ...extra,
});
/** A hero with the fields armStr reads: of no realm unless given, an Elf (no unit here is of his race). */
const hero = (extra: Record<string, unknown> = {}): HeroInABattle =>
  ({
    id: 1,
    name: 'Testhero',
    player: null,
    race: 'Elven',
    alignment: 'Neutral',
    skills: {},
    items: [],
    ...extra,
  }) as unknown as HeroInABattle;
/** Realm 0: Pagan, with its Grand Design raised before the Wonders were sited (so always on). */
const G = { players: [{ alignment: 'Pagan', race: 'Human', discoveries: [{ id: 'gd' }] }], characters: [] };
const turn = { G } as unknown as TurnContext;
/** The base strength of `type` at `quality`, as the tables give it. */
const base = (type: string, quality = 'Average') => Number(UNIT_BASE_STR[type]) * Number(UNIT_Q_MULT[quality]);
/** The labels armStr names on its ladder for `a`. */
const labels = (a: ArmyInABattle, h: HeroInABattle | null, terrain: string | null, ctx: Record<string, unknown>) => {
  const trace: { label: string }[] = [];
  armStr(turn, a, h, h ? 'Pagan' : 'Neutral', terrain, { enemyForce: [], ...ctx, trace });
  return trace.map((t) => t.label);
};

describe('the ground and the volleys', () => {
  test('a missing ground changes no unit (×1)', () => {
    expect(terrainMod('Men-at-Arms', null)).toBe(1);
    expect(terrainMod('Men-at-Arms', undefined)).toBe(1);
    expect(terrainMod('Eagle Riders', null)).toBe(1);
  });
  test('a volley with no damage multiplier, or one of 0, hits as one of ×1', () => {
    const firer = unit('Yeoman Longbows');
    const one = missileShotDamage(firer, 2, 1);
    expect(missileShotDamage(firer, 2, null)).toBe(one);
    expect(missileShotDamage(firer, 2, undefined)).toBe(one);
    expect(missileShotDamage(firer, 2, 0)).toBe(one);
  });
  test('a volley with no options hits as one with none set', () => {
    const firer = unit('Yeoman Longbows');
    const without = unit('Men-at-Arms');
    const withNone = unit('Men-at-Arms');
    expect(applyMissileHit(without, 2, firer)).toEqual(applyMissileHit(withNone, 2, firer, {}));
    expect(without).toEqual(withNone);
    expect(without._archeryRed).toBeGreaterThan(0);
  });
  test('arrows do not tell against an armoured hull or a shell, and leave no mark', () => {
    const firer = unit('Yeoman Longbows');
    const hull = unit('Dwarf Ironclads');
    const shell = unit('Great Turtles');
    expect(applyMissileHit(hull, 3, firer)).toEqual({
      dmg: 0,
      isFly: false,
      capped: false,
      immune: true,
      why: 'armoured hull',
    });
    expect(applyMissileHit(shell, 3, firer)).toEqual({
      dmg: 0,
      isFly: false,
      capped: false,
      immune: true,
      why: 'shell',
    });
    expect(hull).toEqual(unit('Dwarf Ironclads'));
    expect(shell).toEqual(unit('Great Turtles'));
  });
});

describe('a force carried over the sea by its flyers', () => {
  test('no force, or an empty one, is not airborne; a gap in a force is passed over', () => {
    expect(isAirborneAtSea(null)).toBe(false);
    expect(isAirborneAtSea(undefined)).toBe(false);
    expect(isAirborneAtSea([])).toBe(false);
    expect(isAirborneAtSea([null, unit('Eagle Riders'), undefined, unit('Men-at-Arms')])).toBe(true);
    expect(isAirborneAtSea([null, unit('Eagle Riders')])).toBe(false);
  });
  test('with no hull among it, the foot it carries fight at ×0.25 and the riders carrying them at ×0.5', () => {
    const force = [unit('Eagle Riders'), unit('Men-at-Arms')];
    expect(labels(unit('Men-at-Arms'), null, 'sea', { force })).toContain(`sea terrain ${ladderFm(0.25)}`);
    expect(labels(unit('Eagle Riders'), null, 'sea', { force })).toContain(`sea terrain ${ladderFm(0.5)}`);
  });
  test('with a hull among it, the foot fight at the usual ×0.75 and the riders at full strength', () => {
    const force = [unit('Galleon Fleet'), unit('Men-at-Arms'), unit('Eagle Riders')];
    expect(labels(unit('Men-at-Arms'), null, 'sea', { force })).toContain(`sea terrain ${ladderFm(0.75)}`);
    expect(labels(unit('Eagle Riders'), null, 'sea', { force }).filter((l) => l.startsWith('sea terrain'))).toEqual([]);
  });
});

describe('a force, a leader or a world that is missing', () => {
  test("kinship's line: no force gives none; a gap in a force is passed over", () => {
    expect(kinNarrative(null, null, 'Human', 'the attackers')).toBeNull();
    expect(kinNarrative(undefined, null, 'Human', 'the attackers')).toBeNull();
    // its fact holds the counts, and the views write its words (plan P1-12d3): the kind and the whole line's words
    const line = kinNarrative(
      [null, unit('Men-at-Arms', 'Average', { race: 'Human' })],
      null,
      'Human',
      'the attackers',
    );
    expect(line?.kind).toBe("a side's units fight beside their own kin");
    expect(line && theWordsOf(line)).toBe("🤝 Kinship — the attackers: 1 unit of the king's race (+20%).");
  });
  test("kinship's line: a leader whose race is '' is of no race", () => {
    const humans = [unit('Men-at-Arms', 'Average', { race: 'Human' })];
    expect(kinNarrative(humans, hero({ race: '' }), 'Elven', 'the attackers')).toBeNull();
  });
  test('a province is not coastal when the state, its world or the province is missing', () => {
    const prov = { id: 0, row: 0, col: 0, terrain: 'plain' } as unknown as Province;
    expect(provIsCoastal(null, prov)).toBe(false);
    expect(provIsCoastal(undefined, prov)).toBe(false);
    expect(provIsCoastal({}, prov)).toBe(false);
    expect(provIsCoastal({ world: null }, prov)).toBe(false);
    expect(provIsCoastal({ world: { cols: 1, rows: 1, provinces: [], seaPct: 0 } }, null)).toBe(false);
  });
});

describe("a unit's strength in the lines the matrix doesn't feed", () => {
  test('a quality the tables do not hold: no step up (Oratory, Tactical mastery), and the multiplier ×2', () => {
    const odd = unit('Men-at-Arms', 'Legendary');
    const expected = base('Men-at-Arms', 'Average');
    expect(armStr(turn, odd, null, 'Neutral', null, undefined)).toBe(expected);
    expect(armStr(turn, odd, hero({ _oratoryBoost: 1 }), 'Neutral', null, undefined)).toBe(
      armStr(turn, odd, hero(), 'Neutral', null, undefined),
    );
    expect(armStr(turn, unit('Men-at-Arms', 'Legendary', { _tacUp: true }), null, 'Neutral', null, undefined)).toBe(
      expected,
    );
  });
  test("a Pagan Wonder's Standing Stones: ×1.25 to its realm's units defending in the woods, and only defending", () => {
    const pagan = hero({ player: 0, alignment: 'Pagan' });
    const stones = 'Standing Stones ×1.25';
    expect(labels(unit('Men-at-Arms'), pagan, 'forest', { force: [], isAttacker: false })).toContain(stones);
    expect(labels(unit('Men-at-Arms'), pagan, 'forest', { force: [], isAttacker: true })).not.toContain(stones);
    expect(labels(unit('Men-at-Arms'), pagan, 'forest', { force: [] })).not.toContain(stones);
  });
  test("Phantasmal Armies' bonus raises the units its hero leads by it", () => {
    const without = armStr(turn, unit('Men-at-Arms'), hero(), 'Neutral', null, undefined);
    const withIt = armStr(turn, unit('Men-at-Arms'), hero({ _phantasmalBonus: 0.2 }), 'Neutral', null, undefined);
    expect(withIt).toBe(Math.round(without * 1.2));
    expect(labels(unit('Men-at-Arms'), hero({ _phantasmalBonus: 0.2 }), null, { force: [] })).toContain(
      `Phantasmal Armies ${ladderFm(1.2)}`,
    );
  });
  test("a hero whose race is '' gives no unit his kinship", () => {
    const human = unit('Men-at-Arms', 'Average', { race: 'Human' });
    expect(labels(human, hero({ race: '' }), null, { force: [] }).filter((l) => l.startsWith('kinship'))).toEqual([]);
    expect(labels(human, hero({ race: 'Human' }), null, { force: [] })).toContain('kinship ×1.2');
  });
  test('a hero with no list of items, or an item with no effect, leads as one with none', () => {
    const none = armStr(turn, unit('Men-at-Arms'), hero(), 'Neutral', null, undefined);
    const noList = hero();
    delete (noList as Partial<Character>).items;
    expect(armStr(turn, unit('Men-at-Arms'), noList, 'Neutral', null, undefined)).toBe(none);
    expect(
      armStr(turn, unit('Men-at-Arms'), hero({ items: [{ name: 'An Odd Trinket' }] }), 'Neutral', null, undefined),
    ).toBe(none);
  });
  test("the Kraken Figurehead: the fleets its bearer leads fight one tier higher (an Elite fleet can't rise)", () => {
    const kraken = { name: 'Kraken Figurehead', effect: { stat: 'navalBonus', bonus: 1 }, tier: 3, equipped: true };
    const fleet = (q: string) =>
      armStr(turn, unit('Galleon Fleet', q), hero({ items: [{ ...kraken }] }), 'Neutral', null, undefined);
    const plain = (q: string) => armStr(turn, unit('Galleon Fleet', q), hero(), 'Neutral', null, undefined);
    expect(fleet('Average')).toBe(Math.round((plain('Average') * Number(UNIT_Q_MULT['Veteran'])) / 2));
    expect(fleet('Green')).toBe(Math.round(plain('Green') * 2));
    expect(fleet('Elite')).toBe(plain('Elite'));
    expect(armStr(turn, unit('Men-at-Arms'), hero({ items: [{ ...kraken }] }), 'Neutral', null, undefined)).toBe(
      armStr(turn, unit('Men-at-Arms'), hero(), 'Neutral', null, undefined),
    );
  });
});

describe('the ladder rows and a side', () => {
  const row = () => ladderRow(turn, unit('Men-at-Arms'), null, 'Neutral', null, undefined, null);
  test('a row with no command multipliers keeps its strength; a gap or one of ×1 is left out', () => {
    const r = row();
    expect(r._cmd).toEqual([]);
    expect(r.s).toBe(r._u);
    const withGaps = ladderRow(turn, unit('Men-at-Arms'), null, 'Neutral', null, undefined, [
      null,
      { label: 'a banner', m: 1.2 },
      undefined,
      { label: 'nothing', m: 1 },
    ]);
    expect(withGaps._cmd).toEqual([{ label: 'a banner', m: 1.2 }]);
    expect(withGaps.s).toBe(withGaps._u * 1.2);
  });
  test('a side with no force multipliers, or no options, totals as one with none', () => {
    const total = finishSide([row(), row()], 3, false, [], {});
    expect(finishSide([row(), row()], 3, false, null, {})).toBe(total);
    expect(finishSide([row(), row()], 3, false, undefined)).toBe(total);
    expect(finishSide([row(), row()], 3, false, [null, { m: 1 }], null)).toBe(total);
  });
  test("a side with no ground, or a ground of '', is placed as on none (a rider flanks only on open ground)", () => {
    const rows = () => [ladderRow(turn, unit('Free Lances'), null, 'Neutral', null, undefined, null), row(), row()];
    const asOnNone = battleGrid(rows(), 3, null, { flank: false });
    for (const terrain of ['', null, undefined]) {
      const out: { grid?: ReturnType<typeof battleGrid> } = {};
      finishSide(rows(), 3, false, [], terrain === undefined ? { out } : { terrain, out });
      expect(out.grid?.flanks.length, String(terrain)).toBe(asOnNone.flanks.length);
      expect(out.grid?.total).toBe(asOnNone.total);
    }
    expect(asOnNone.flanks).toEqual([]);
    expect(battleGrid(rows(), 3, 'plain', { flank: false, tac: 0 }).flanks).toHaveLength(1);
  });
});
