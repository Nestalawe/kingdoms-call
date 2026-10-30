// The lines of src/engine/battle/fates.ts that plan P1-10b3 changed to type them (statements that keep every value:
// P1-10b's Decision 2 and Choice 1) and that no game of the balance matrix reaches. The matrix proves the others (both
// sets, every realm's report identical); these are proved here, each on the value it had before (worked out by the
// file as it was, with its ts-nocheck line):
// - battleTallyLine on force rows the engine never writes (forceMarker writes each row): a row with no list of
//   units, or one that isn't a list; a side named in a list, or by a name every object has; a row that isn't an
//   object; units that aren't objects, a unit with no type, types and names that aren't strings. Each is read as
//   JavaScript reads any value (fieldAsJavaScriptReadsIt), so each tally is the one it was, and a row that threw still
//   throws;
// - battleTallyLine's lines the matrix's battles don't hold: a whale cohort's breach, a company named only by its
//   name, two types or names at the same place in a line, a fate before any side's casualty list;
// - battleLineTiers on a line that is missing, and battleMarginBand past its last band.
// Level 1 (unit): pure functions called directly on the engine's modules (plan P1-14a), with no turn played.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { battleLineTiers, battleMarginBand, battleTallyLine } from '../../src/engine/battle/fates.ts';

const FORCE = '⚑FORCE⚑';
/** A force's row, as its line's words hold it. */
const row = (value: unknown) => FORCE + JSON.stringify(value);
const attackersRow = (armies: unknown, extra: object = {}) =>
  row({ name: 'Aldric', role: 'attacker', armies, ...extra });
const defendersRow = (armies: unknown) => row({ name: 'Gorbash', role: 'defender', armies });
const unit = (type: unknown, unitName: unknown = '', phantom = false) => ({ type, unitName, phantom });
const attackersHead = "⚔ **Aldric's forces** (attacker):";
const defendersHead = "🛡 **Gorbash's forces** (defender):";
const aLevyDies = "— Aldric's Shieldwall Levies (Shieldwall Levies, Average) were destroyed in the fighting.";
const aLanceDies = "— Aldric's Free Lances (Free Lances, Green) were destroyed in the fighting.";

describe('battleTallyLine: force rows the engine never writes, read as they always were', () => {
  test('a row with no list of units, or 0, counts none; a row whose units are a string or an object is skipped', () => {
    expect(battleTallyLine([row({ name: 'Aldric', role: 'attacker' }), attackersHead, aLevyDies])).toBe(
      '⚰ Losses — **Aldric**: 1 unit lost (unit).',
    );
    expect(battleTallyLine([attackersRow(0), attackersHead, aLevyDies])).toBe(
      '⚰ Losses — **Aldric**: 1 unit lost (unit).',
    );
    expect(
      battleTallyLine([
        attackersRow('Shieldwall Levies'),
        attackersRow([unit('Shieldwall Levies')]),
        attackersHead,
        aLevyDies,
      ]),
    ).toBe('⚰ Losses — **Aldric**: 1 of 1 unit lost (Shieldwall Levies).');
    expect(battleTallyLine([attackersRow({ filter: 1 }), attackersHead, aLevyDies])).toBe(
      '⚰ Losses — **Aldric**: 1 unit lost (unit).',
    );
  });
  test('a side named in a list counts; one named by a name every object has, or a row that is not an object, is skipped', () => {
    expect(
      battleTallyLine([
        row({ name: 'Aldric', role: ['attacker'], armies: [unit('Shieldwall Levies'), unit('Free Lances')] }),
        attackersHead,
        aLanceDies,
      ]),
    ).toBe('⚰ Losses — **Aldric**: 1 of 2 units lost (Free Lances).');
    expect(
      battleTallyLine([
        row({ role: 'constructor', armies: [unit('Free Lances')] }),
        row({ role: '__proto__', armies: [unit('Free Lances')] }),
        row({ role: 'toString', armies: [] }),
        attackersHead,
        aLanceDies,
      ]),
    ).toBe('⚰ Losses — **Aldric**: 1 unit lost (unit).');
    expect(
      battleTallyLine([
        FORCE + 'null',
        FORCE + '5',
        FORCE + '"attacker"',
        FORCE + 'true',
        FORCE + '[1,2]',
        FORCE + '{not json',
        attackersHead,
        aLanceDies,
      ]),
    ).toBe('⚰ Losses — **Aldric**: 1 unit lost (unit).');
  });
  test('units that are not objects count, but a phantom, 0, null and an empty name do not', () => {
    expect(
      battleTallyLine([
        attackersRow([1, 'Levies', true, [], unit('Eagle Riders', '', true), unit('Shieldwall Levies'), 0, null, '']),
        attackersHead,
        aLevyDies,
        "— Aldric's Shieldwall Levies (Shieldwall Levies, Average) have had enough — the survivors slip away.",
      ]),
    ).toBe('⚰ Losses — **Aldric**: 1 of 5 units lost (Shieldwall Levies), 1 disbanded (Shieldwall Levies).');
  });
  test('a unit with no type is found by the word "undefined", and throws when tied with another type there', () => {
    expect(
      battleTallyLine([attackersRow([{ unitName: 'x' }]), attackersHead, "— Aldric's undefined were destroyed."]),
    ).toBe('⚰ Losses — **Aldric**: 1 of 1 unit lost (unit).');
    expect(() =>
      battleTallyLine([
        attackersRow([{ unitName: 'x' }, unit('undefined Riders')]),
        attackersHead,
        "— Aldric's undefined Riders were destroyed in the fighting.",
      ]),
    ).toThrow(TypeError);
  });
  test('types that are not strings are found by their words; an empty type reads "unit"', () => {
    expect(
      battleTallyLine([
        attackersRow([unit(5), unit(['Warg', 'Riders']), unit({ length: '3' })]),
        attackersHead,
        '— Aldric lost 5 were destroyed',
        "— Aldric's Warg,Riders were cut down",
        '— Aldric [object Object] slain',
      ]),
    ).toBe('⚰ Losses — **Aldric**: 3 of 3 units lost (5, Warg,Riders, [object Object]).');
    expect(
      battleTallyLine([
        attackersRow([unit(''), unit('Free Lances')]),
        attackersHead,
        "— Aldric's Free Lances were destroyed in the fighting.",
      ]),
    ).toBe('⚰ Losses — **Aldric**: 1 of 2 units lost (unit).');
  });
});

describe("battleTallyLine: lines the matrix's battles don't hold", () => {
  test('two types at the same place in a line: the longer is the one lost', () => {
    expect(
      battleTallyLine([
        attackersRow([unit('Eagle'), unit('Eagle Riders')]),
        attackersHead,
        "— Aldric's Eagle Riders (Eagle Riders, Crack) were destroyed in the fighting.",
      ]),
    ).toBe('⚰ Losses — **Aldric**: 1 of 2 units lost (Eagle Riders).');
  });
  test('a company named only by its name is found on its side, the longer name first; a name not a string too', () => {
    expect(
      battleTallyLine([
        attackersRow([
          unit('Eagle Riders', 'the Red Hand'),
          unit('Warg Riders', 'the Red'),
          unit('Free Lances', 'Free Lances'),
        ]),
        attackersHead,
        '— the Red Hand are cut down.',
        '— the Red are cut down.',
        '— nobody we know are cut down.',
      ]),
    ).toBe('⚰ Losses — **Aldric**: 3 of 3 units lost (Eagle Riders, Warg Riders, unit).');
    expect(
      battleTallyLine([
        attackersRow([unit('Eagle Riders', 5), unit('Warg Riders', ['Fang']), unit('Free Lances', 0)]),
        attackersHead,
        '— 5 are cut down.',
        '— Fang are cut down.',
        '— 0 are cut down.',
      ]),
    ).toBe('⚰ Losses — **Aldric**: 3 of 3 units lost (Eagle Riders, Warg Riders, unit).');
  });
  test("a whale cohort's breach is a loss for the side it doesn't name", () => {
    const breach = (cohort: string) => `🌊 A ${cohort}whale cohort breaches beneath the Galleon Fleet!`;
    expect(
      battleTallyLine([
        attackersRow([unit('Galleon Fleet')]),
        defendersRow([unit('Leviathan Pods')]),
        breach('Gorbash '),
        attackersHead,
      ]),
    ).toBe('⚰ Losses — **Aldric**: 1 of 1 unit lost (Galleon Fleet).');
    expect(
      battleTallyLine([
        attackersRow([unit('Galleon Fleet')]),
        defendersRow([unit('Leviathan Pods')]),
        breach('Aldric '),
        attackersHead,
      ]),
    ).toBe('⚰ Losses — **Aldric**: no units lost · **defender**: 1 of 1 unit lost (unit).');
    expect(
      battleTallyLine([
        attackersRow([unit('Galleon Fleet')]),
        defendersRow([unit('Galleon Fleet')]),
        breach(''),
        attackersHead,
      ]),
    ).toBe('⚰ Losses — **Aldric**: no units lost · **defender**: 1 of 1 unit lost (Galleon Fleet).');
  });
  test("a breach when the attacker's row has no name, or isn't an object, is the defender's; a name not a string throws", () => {
    const breach = '🌊 A Gorbash whale cohort breaches beneath the Galleon Fleet!';
    const theDefendersLoss = '⚰ Losses — **Aldric**: no units lost · **defender**: 1 unit lost (unit).';
    expect(battleTallyLine([attackersRow([unit('Galleon Fleet')], { name: null }), breach, attackersHead])).toBe(
      theDefendersLoss,
    );
    expect(battleTallyLine([FORCE + JSON.stringify('"role":"attacker"'), breach, attackersHead])).toBe(
      theDefendersLoss,
    );
    expect(battleTallyLine([FORCE + 'null "role":"attacker"', breach, attackersHead])).toBe(theDefendersLoss);
    expect(() => battleTallyLine([attackersRow([unit('Galleon Fleet')], { name: 5 }), breach, attackersHead])).toThrow(
      TypeError,
    );
  });
  test("a fate before any side's casualty list is not counted; one after both is credited to the side it names", () => {
    expect(
      battleTallyLine([
        "— Aldric's Goblin Horde were destroyed.",
        defendersHead,
        "— Aldric's Goblin Horde were destroyed.",
      ]),
    ).toBe('⚰ Losses — **Gorbash**: 1 unit lost (unit).');
  });
  test('no lines, or none with a casualty list, give no tally; a missing line is read as empty', () => {
    expect(battleTallyLine(null)).toBeNull();
    expect(battleTallyLine(['📊 nothing here'])).toBeNull();
    expect(
      battleTallyLine([
        null,
        undefined,
        attackersRow([unit('Goblin Horde')]),
        attackersHead,
        null,
        "— Aldric's Goblin Horde were destroyed.",
      ]),
    ).toBe('⚰ Losses — **Aldric**: 1 of 1 unit lost (Goblin Horde).');
  });
});

describe('battleLineTiers and battleMarginBand', () => {
  test('a missing line is read as empty, in the short account; no lines give no tiers', () => {
    expect(battleLineTiers([null, undefined, '', attackersHead, aLevyDies])).toEqual({
      t: ['k', 'k', 'k', 'd', 'd'],
      casIdx: 3,
    });
    expect(battleLineTiers(null)).toEqual({ t: [], casIdx: -1 });
  });
  test('a margin past the last band, or none, takes the last band, or the first', () => {
    expect(battleMarginBand(10)?.slug).toBe('annihilating');
    expect(battleMarginBand(Infinity)?.slug).toBe('annihilating');
    expect(battleMarginBand(NaN)?.slug).toBe('pyrrhic');
  });
});
