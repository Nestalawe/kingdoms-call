// Each banner gives the strength its own text says, and of two banners the stronger counts (R-148, question 20): every
// army its bearer leads fights at the strength its copy's effect carries, so the two relic standards give more than an
// ordinary banner (the Battle Standard +4, the Standard of the Nine Legions +6, the Torc of the Warband +2), and a
// bearer of two banners gets the stronger's number, never the two added.
// Level 1 (unit): armStr called directly on the engine's modules, with no turn played and no die drawn. armStr is the
// strength both kinds of battle read for each company a commander leads (the battle between heroes and the battle
// against the defenders call it alike), and the army card shares its items' steps (its own unit case compares the two),
// so a lower level can't run it and a staged battle would add only dice around the same figure. The items are the
// content's copies, after the engine's load-time pass. A hero is staged with the fields armStr reads, so his type is
// given by assertion, as in the unit-strength cases.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { ALL_MAGIC_ITEMS_P } from '../../src/content/kingdoms-call-data.ts';
import { armStr } from '../../src/engine/battle/terrain-and-unit-strength.ts';
import type { ArmyInABattle, HeroInABattle } from '../../src/engine/army-tables.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';

/** A company of Average Men-at-Arms of no race (so no kinship). */
const aCompany = (): ArmyInABattle => ({
  type: 'Men-at-Arms',
  quality: 'Average',
  race: '',
  unitName: 'the Test Shields',
});
/** A hero of no realm, an Elf (no unit here is of his race), wearing the items named, the content's copies. */
const aHeroWearing = (names: readonly string[]): HeroInABattle =>
  ({
    id: 1,
    name: 'Testhero',
    player: null,
    race: 'Elven',
    alignment: 'Neutral',
    skills: {},
    items: names.map((name) => {
      const item = ALL_MAGIC_ITEMS_P.find((it) => it.name === name);
      if (!item) throw new Error(`no item in play is named ${name}`);
      return { ...structuredClone(item), id: 1, equipped: true };
    }),
  }) as unknown as HeroInABattle;
const turn = { G: { players: [], characters: [] } } as unknown as TurnContext;
/** What the items named add to a company of Men-at-Arms their wearer leads. */
const theStrengthAdded = (names: readonly string[]) =>
  armStr(turn, aCompany(), aHeroWearing(names), 'Neutral', null, undefined) -
  armStr(turn, aCompany(), aHeroWearing([]), 'Neutral', null, undefined);

describe('each banner gives the strength its own text says', () => {
  test('the Battle Standard: +4, as its text says', () => {
    expect(theStrengthAdded(['Battle Standard'])).toBe(4);
  });
  test('the Standard of the Nine Legions: +6, as its text says', () => {
    expect(theStrengthAdded(['Standard of the Nine Legions'])).toBe(6);
  });
  test('an ordinary banner, the Torc of the Warband: +2, as its text says', () => {
    expect(theStrengthAdded(['Torc of the Warband'])).toBe(2);
  });
});

describe('of two banners, the stronger counts', () => {
  test('the Battle Standard and the Standard of the Nine Legions: +6, not +10', () => {
    expect(theStrengthAdded(['Battle Standard', 'Standard of the Nine Legions'])).toBe(6);
    expect(theStrengthAdded(['Standard of the Nine Legions', 'Battle Standard'])).toBe(6);
  });
  test('the Torc of the Warband and the Battle Standard: +4, not +6', () => {
    expect(theStrengthAdded(['Torc of the Warband', 'Battle Standard'])).toBe(4);
  });
  test("two ordinary banners, the Torc and Marshal's Mantle: +2, not +4", () => {
    expect(theStrengthAdded(['Torc of the Warband', "Marshal's Mantle"])).toBe(2);
  });
});
