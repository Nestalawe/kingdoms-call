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
// And the battle's Druid check (druIdPenaltyMult, through armStr and the side's shortfall line) on the Druid every rule
// counts (R-120, R-121): beside his king wearing the Crown of Command (in no matrix game), a Druid 3 commander's Cave
// Trolls fight at full strength; with the Crown elsewhere, or its wearer gone by the battle's phase (Toby's proviso: a
// cast then counts without it too), a level short; under a Curse spell (his Druid 4 halved to 2), two levels short,
// ×0.6; and the corner plan question 50 keeps: a battle's Curse halves a Druid 8 commander's Druid after the check
// stops it at 5, his Titan Warbeasts ×0.4.
// Level 1 (unit): armStr called directly on the engine's modules (plan P1-14a), with no turn played; no die is drawn.
// The matrix meets none of the five, so no lower level and no game sees them (P1-19's scoping: the Standard +3 and the
// Spyglass +1 planted change 0 of 60 games). The items are the content's copies, after the engine's load-time pass.
// A hero is staged with the fields armStr reads, so his type is given by assertion, as in the unit-strength cases.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { ALL_MAGIC_ITEMS_P } from '../../src/content/kingdoms-call-data.ts';
import { armStr } from '../../src/engine/battle/terrain-and-unit-strength.ts';
import { druidShortfallLine } from '../../src/engine/battle/battle-report-lines-and-force-markers.ts';
import { effStat } from '../../src/engine/heroes/effective-skills-and-hidden-heroes.ts';
import { getDruidLevel } from '../../src/engine/rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';
import type { AModifierOfAUnitInTheLadder } from '../../src/engine/battle/the-facts-a-battles-lines-record.ts';
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

// ── The battle's Druid check counts a commander's Druid as every rule does (R-120, R-121) ──
// A commander of realm 0 (Elves; Neutral), standing in province 5, beside his realm's other heroes as the state holds
// them. His Druid is the level the mastery, the army card and a cast count (effStat): a Crown of Command worn by a hero
// of his realm in his province adds 1, a Curse spell on him takes off what it halved; still counted to 5 for the check.
// The Crown is read where its wearer stands when the battle is fought (Toby's proviso to question 13).
/** A hero of realm 0, an Elf (no unit here is of his race), in province 5, of Druid `druid`. */
const commander = (druid: number, more: object = {}): HeroInABattle =>
  ({
    id: 1,
    name: 'Testcommander',
    player: 0,
    alive: true,
    location: 5,
    race: 'Elven',
    alignment: 'Neutral',
    skills: { druid },
    items: [],
    ...more,
  }) as unknown as HeroInABattle;
/** His realm's king, wearing the Crown of Command, in province `location`. */
const theCrownsWearer = (location: number): HeroInABattle =>
  ({
    id: 2,
    name: 'Testking',
    player: 0,
    alive: true,
    location,
    race: 'Elven',
    alignment: 'Neutral',
    skills: {},
    items: [worn('Crown of Command')],
  }) as unknown as HeroInABattle;
/** The turn's context: realm 0 and the heroes given. */
const aTurnWith = (characters: readonly HeroInABattle[]) =>
  ({ G: { players: [{ race: 'Elven', alignment: 'Neutral' }], characters } }) as unknown as TurnContext;
/** The multiplier the battle's Druid check puts on a unit of `type` he leads (1: none), as the strength ladder records
 *  it. */
function theDruidMultiplier(turnContext: TurnContext, c: HeroInABattle, type: string): number {
  const trace: AModifierOfAUnitInTheLadder[] = [];
  armStr(turnContext, unit(type), c, 'Neutral', null, { trace });
  const short = trace.find((t) => t.reason.kind === "its commander's Druid falls short");
  return short && 'multiplier' in short.reason ? short.reason.multiplier : 1;
}

describe("the battle's Druid check counts a commander's Druid as every rule does (R-120, R-121)", () => {
  test('Cave Trolls need Druid 4, Titan Warbeasts 5', () => {
    expect(getDruidLevel('Cave Trolls')).toBe(4);
    expect(getDruidLevel('Titan Warbeasts')).toBe(5);
  });
  test("beside his king wearing the Crown of Command, a Druid 3 commander's Cave Trolls fight at full strength (R-120)", () => {
    const c = commander(3);
    expect(theDruidMultiplier(aTurnWith([c, theCrownsWearer(5)]), c, 'Cave Trolls')).toBe(1);
  });
  test('the Crown worn in another province: his Cave Trolls fight a level short, ×0.8', () => {
    const c = commander(3);
    expect(theDruidMultiplier(aTurnWith([c, theCrownsWearer(6)]), c, 'Cave Trolls')).toBeCloseTo(0.8, 9);
  });
  test("the wearer gone by the battle's phase: the battle and a cast then count his Druid without the Crown", () => {
    // Both stand in province 5 at the turn's start; the king marches out in Spring, before the Summer battle and cast.
    const c = commander(3, { skills: { druid: 3, white: 2 } });
    const king = theCrownsWearer(5);
    const turn = aTurnWith([c, king]);
    expect(theDruidMultiplier(turn, c, 'Cave Trolls')).toBe(1);
    expect(effStat(turn, c, 'white')).toBe(3);
    (king as { location: number }).location = 6;
    expect(theDruidMultiplier(turn, c, 'Cave Trolls')).toBeCloseTo(0.8, 9);
    expect(effStat(turn, c, 'white')).toBe(2);
  });
  test('a Curse spell on a Druid 4 commander (his Druid halved to 2): his Cave Trolls fight two levels short, ×0.6 (R-121)', () => {
    const cursed = commander(4, { _curses: { druid: 2 } });
    const turn = aTurnWith([cursed]);
    expect(theDruidMultiplier(turn, cursed, 'Cave Trolls')).toBeCloseTo(0.6, 9);
    expect(theDruidMultiplier(turn, commander(4), 'Cave Trolls')).toBe(1);
    // the side's Druid shortfall line names them at that multiplier
    const line = druidShortfallLine(
      turn,
      { kind: "a hero's host in the battle", heroName: 'Testcommander' },
      cursed,
      [unit('Cave Trolls')],
      'Neutral',
    );
    expect(line?.shortfalls.map((s) => s.unitType)).toEqual(['Cave Trolls']);
    expect(line?.shortfalls[0]?.penalty).toBeCloseTo(0.6, 9);
  });
  test("a battle's Curse on a Druid 8 commander's Druid: counted to 5, then halved to 2, his Titan Warbeasts ×0.4 (plan question 50 keeps it)", () => {
    // The mastery halves his whole Druid (8 to 4); the check stops it at 5 first. Toby hasn't ruled on the corner, so
    // the check keeps today's figure.
    const c = commander(8, { _curseHalveStat: 'druid' });
    expect(theDruidMultiplier(aTurnWith([c]), c, 'Titan Warbeasts')).toBeCloseTo(0.4, 9);
  });
});
