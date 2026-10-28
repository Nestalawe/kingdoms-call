// The commander's items no game of the balance matrix carries keep their values (plan P1-19m, the items family's first
// row): armStr's magic items went into the rule registry's "strength: the commander's items" (the items' registry,
// src/engine/rules/the-registry-of-magic-item-effects.ts), and the matrix proves those its games meet (the Golden Spur,
// the Legionnaire's Mark, the Eagle-Eye Pendant, the Engineer's Blueprint, the Black Sceptre, the Tide-Caller's Horn:
// both sets, every realm's report identical). These five it meets in no game, so they are proved here, each on the
// value it had before: the Battle Standard's +2 (a relic that says +4: plan NEXT.md question 20 keeps today's +2), the
// Sea Chart of the Deep's +1 and the Admiral's Spyglass' +2 for the fleets the bearer leads (and none for a unit that
// isn't a fleet; a second name of the Spyglass counts as it), the Chalice of Dawn's ×1.15 for a Divine realm's armies
// (and ×1 for another realm's); and, since a step is rounded as it goes, the stage's order: the Standard's +2 before
// the Spur's ×1.25. The Kraken Figurehead's step up a tier stays in
// tests/unit/the-unit-strength-lines-no-matrix-game-reaches-keep-their-values.test.ts.
// Level 1 (unit): armStr called directly on the engine's modules (plan P1-14a), with no turn played; no die is drawn.
// The matrix meets none of the five, so no lower level and no game sees them (P1-19's scoping: the Standard +3 and the
// Spyglass +1 planted change 0 of 60 games). The items are the content's copies, after the engine's load-time pass.
// A hero is staged with the fields armStr reads, so his type is given by assertion, as in the unit-strength cases.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { ALL_MAGIC_ITEMS_P } from '../../src/content/kingdoms-call-data.ts';
import { armStr } from '../../src/engine/battle/terrain-and-unit-strength.ts';
import type { ArmyInABattle, HeroInABattle } from '../../src/engine/army-tables.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';

/** A unit of no race (so no kinship), of quality `quality`. */
const unit = (type: string, quality = 'Average'): ArmyInABattle => ({
  type,
  quality,
  race: '',
  unitName: `the Test ${type}`,
});
/** A hero of no realm, an Elf (no unit here is of his race), wearing the items given. */
const hero = (items: readonly unknown[] = []): HeroInABattle =>
  ({
    id: 1,
    name: 'Testhero',
    player: null,
    race: 'Elven',
    alignment: 'Neutral',
    skills: {},
    items,
  }) as unknown as HeroInABattle;
const turn = { G: { players: [], characters: [] } } as unknown as TurnContext;
/** A worn copy of the content's item named. */
function worn(name: string) {
  const item = ALL_MAGIC_ITEMS_P.find((it) => it.name === name);
  if (!item) throw new Error(`no item in play is named ${name}`);
  return { ...item, equipped: true };
}
/** A unit's strength led by a hero wearing the items named, for a realm of the alignment given. */
const led = (type: string, names: readonly string[], alignment = 'Neutral') =>
  armStr(turn, unit(type), hero(names.map(worn)), alignment, null, undefined);

describe("the commander's items no matrix game carries", () => {
  test('the Battle Standard: every army its bearer leads, +2 (its text says +4)', () => {
    expect(worn('Battle Standard').effect).toEqual({ stat: 'armyBonus', bonus: 4 });
    expect(led('Men-at-Arms', ['Battle Standard'])).toBe(led('Men-at-Arms', []) + 2);
    expect(led('Galleon Fleet', ['Battle Standard'])).toBe(led('Galleon Fleet', []) + 2);
  });
  test('the Sea Chart of the Deep: the fleets its bearer leads, +1; no other unit', () => {
    expect(led('Galleon Fleet', ['Sea Chart of the Deep'])).toBe(led('Galleon Fleet', []) + 1);
    expect(led('Dwarf Ironclads', ['Sea Chart of the Deep'])).toBe(led('Dwarf Ironclads', []) + 1);
    expect(led('Men-at-Arms', ['Sea Chart of the Deep'])).toBe(led('Men-at-Arms', []));
  });
  test("the Admiral's Spyglass, and a second name of it: the fleets its bearer leads, +2; no other unit", () => {
    expect(led('Galleon Fleet', ["Admiral's Spyglass"])).toBe(led('Galleon Fleet', []) + 2);
    expect(led('Galleon Fleet', ["Tide-Lord's Glass"])).toBe(led('Galleon Fleet', []) + 2);
    expect(led('Men-at-Arms', ["Admiral's Spyglass"])).toBe(led('Men-at-Arms', []));
    // both fleet items: +1, then +2
    expect(led('Galleon Fleet', ['Sea Chart of the Deep', "Admiral's Spyglass"])).toBe(led('Galleon Fleet', []) + 3);
  });
  test("the Chalice of Dawn: a Divine realm's armies its bearer leads, ×1.15; another realm's, ×1", () => {
    const plain = led('Men-at-Arms', [], 'Divine');
    expect(led('Men-at-Arms', ['Chalice of Dawn'], 'Divine')).toBe(Math.round(plain * 1.15));
    expect(led('Men-at-Arms', ['Chalice of Dawn'], 'Neutral')).toBe(led('Men-at-Arms', [], 'Neutral'));
    expect(led('Men-at-Arms', ['Cup of the Morning'], 'Divine')).toBe(Math.round(plain * 1.15));
  });
  test("the stage's order: the Standard's +2, then the Spur's ×1.25, each rounded as it goes", () => {
    const plain = led('Free Lances', []);
    expect(led('Free Lances', ['Golden Spur', 'Battle Standard'])).toBe(Math.round((plain + 2) * 1.25));
    expect(led('Free Lances', ['Battle Standard', 'Golden Spur'])).toBe(Math.round((plain + 2) * 1.25));
  });
});
