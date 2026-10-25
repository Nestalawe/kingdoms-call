// The unit abilities at the six stages of the whole line (plan P1-19c), in battleFaceSide (src/engine/battle/lines.ts):
// held when hit from the side, beside and behind a unit in the front line, marked by the enemy's line, a shooter picking
// its target, free riders turning an anchored line, and what a flyer does. Each is handed what its stage hands it (the
// registry's stage types) and returns a value: its words, a new multiplier and its words, a mark on my line, or the
// target it picks, or nothing; its numbers come from the content's row. The runners
// (the-registry-of-content-effects.ts) run them in their stages' order. Until P1-19c they were written inline in
// battleFaceSide, in this order.
//
// 2026-10-11 (Toby, the unit abilities): a unit's second ability, where it needs the whole line (Shieldwall, Sergeants,
// Driven Before Them, Terror From Above, Dive on the Bowmen, Flak Gunners, Battering Horns, Marksmen's choice, the side
// hits a unit is spared); 2026-10-13 (the beast abilities): Rooted, Storm Wings.
import { UNIT_ABILITIES_THE_REGISTRY_HOLDS as ROWS } from '../../../content/unit-abilities-their-names-numbers-and-words.ts';
import type { UnitAbilitySlug } from '../../../content/unit-abilities-their-names-numbers-and-words.ts';
import type {
  AMultiplierAndItsWords,
  AUnitInTheLine,
  AUnitPlacedInALine,
  TheStagesOfEachHookPoint,
} from '../the-registry-of-content-effects.ts';

type TheStrengthStages = TheStagesOfEachHookPoint['strength'];

/** The ability's multiplier, worded by its name. */
const named = (slug: UnitAbilitySlug, multiplier: number): AMultiplierAndItsWords => ({
  multiplier,
  words: ROWS[slug].name,
});
/** Whether a unit has the ability: its type is the ability's row's unit. */
const has = (unit: AUnitInTheLine | null, slug: UnitAbilitySlug) => unit !== null && ROWS[slug].unit === unit.unitType;

// Held when hit from the side (each runs only for its row's unit, or the units it reaches). Never hit from the side
// (Rooted: the Ents, 2026-10-13).
export const HELD_WHEN_HIT_FROM_THE_SIDE = {
  unbreakable: () => ROWS.unbreakable.name,
  rooted: () => ROWS.rooted.name,
  // Every garrison, defending (its row's reach; the books give it to the Human Garrison: a question for Toby).
  'hold-the-gate': (facts) => (facts.theUnitsSideAttacks ? null : ROWS['hold-the-gate'].name),
} satisfies Partial<Record<UnitAbilitySlug, TheStrengthStages['held when hit from the side']>>;

/** Shieldwall: ×1.25 with an archer in the second line behind the unit. */
const shieldwall: TheStrengthStages['beside and behind it in the front line'] = (facts, m) =>
  facts.theUnitBehind?.role === 'arc'
    ? named('shieldwall', m * ROWS.shieldwall.numbers.withAnArcherBehind.value)
    : null;

export const BESIDE_AND_BEHIND_IT_IN_THE_FRONT_LINE = {
  shieldwall,
  // Town Watch: a Human Garrison counts as Levies (its row's countsAs) for Shieldwall, and is worded as Shieldwall.
  'town-watch': (facts, m) => shieldwall(facts, m),
  // Sergeants: Levies (its row's reach) with a Men-at-Arms beside them in the front line.
  sergeants: (facts, m) =>
    facts.theUnitsEitherSide.some((u) => has(u, 'sergeants'))
      ? named('sergeants', m * ROWS.sergeants.numbers.leviesBesideThem.value)
      : null,
  // Driven Before Them: Berserkers gain for each Goblin Horde (the units its row counts) beside them.
  'driven-before-them': (facts, m) => {
    const { name, numbers, counts } = ROWS['driven-before-them'];
    const n = facts.theUnitsEitherSide.filter((u) => u !== null && counts.some((t) => t === u.unitType)).length;
    if (!n) return null;
    const g = 1 + Math.min(numbers.atMost.value, numbers.perGoblinHordeBeside.value * n);
    return { multiplier: m * g, words: `${name} ×${g.toFixed(1)}` };
  },
} satisfies Partial<Record<UnitAbilitySlug, TheStrengthStages['beside and behind it in the front line']>>;

/** The strongest of the units given that `may` allows, the first of two as strong; or none. */
function theStrongest<U extends AUnitPlacedInALine>(
  units: readonly (U | null | undefined)[],
  may: (unit: U, place: number) => boolean,
): U | null {
  let strongest: U | null = null;
  for (const [place, u] of units.entries()) if (u && may(u, place) && (!strongest || u.s > strongest.s)) strongest = u;
  return strongest;
}

// Marked by the enemy's line: each runs only when the enemy's line holds its row's unit.
export const MARKED_BY_THE_ENEMY_LINE = {
  // Terror From Above: with Wyvern Riders on the other side, my strongest front unit fights ×0.85.
  'terror-from-above': (myLine) => {
    const strongest = theStrongest(myLine.theFront, () => true);
    const { name, numbers } = ROWS['terror-from-above'];
    return strongest ? { theUnitsMarked: [strongest], factor: numbers.theStrongestFrontUnit.value, words: name } : null;
  },
  // Dive on the Bowmen: with Noble Griffons on the other side, my strongest shooting archer (one standing behind a
  // fighter that isn't an archer) fights ×0.75.
  'dive-on-the-bowmen': (myLine) => {
    const strongest = theStrongest(myLine.theSecondLine, (x, column) => {
      const f = myLine.theFront[column];
      return x.role === 'arc' && !!f && f.role !== 'arc';
    });
    const { numbers, wordsInTheLadder } = ROWS['dive-on-the-bowmen'];
    return strongest
      ? {
          theUnitsMarked: [strongest],
          factor: numbers.theStrongestSecondLineArcher.value,
          words: wordsInTheLadder.onTheArcherTheyDiveOn,
        }
      : null;
  },
  // Storm Wings (2026-10-13, the beast abilities): with Thunderbirds on the other side, every unit of mine in the air
  // fights ×0.85.
  'storm-wings': (myLine) => ({
    theUnitsMarked: myLine.theAir,
    factor: ROWS['storm-wings'].numbers.everyUnitInTheAir.value,
    words: ROWS['storm-wings'].name,
  }),
} satisfies Partial<Record<UnitAbilitySlug, TheStrengthStages['marked by the enemy line']>>;

export const A_SHOOTER_PICKS_ITS_TARGET = {
  // Marksmen: they pick the best target along the line (the first of two as good), if the enemy front holds any.
  marksmen: (facts) => {
    const worth = facts.theWorthOfAShotAtEachUnitOfTheEnemyFront;
    return worth.length ? worth.reduce((best, w, i) => (w > (worth[best] ?? w) ? i : best), 0) : null;
  },
} satisfies Partial<Record<UnitAbilitySlug, TheStrengthStages['a shooter picks its target']>>;

export const TURNS_AN_ANCHORED_LINE = {
  // Battering Horns: a free Ram turns even an anchored line.
  'battering-horns': (facts) =>
    facts.theFreeEnemyRiders.some((u) => has(u, 'battering-horns')) ? ROWS['battering-horns'].name : null,
} satisfies Partial<Record<UnitAbilitySlug, TheStrengthStages['turns an anchored line']>>;

export const WHAT_A_FLYER_DOES = {
  'flak-gunners': (facts, m) =>
    facts.theEnemyHasFlyers
      ? named('flak-gunners', m * ROWS['flak-gunners'].numbers.whenTheEnemyHasFlyers.value)
      : null,
} satisfies Partial<Record<UnitAbilitySlug, TheStrengthStages['what a flyer does']>>;
