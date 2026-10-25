// The unit abilities at the four stages of a unit meeting another or shooting over its line (plan P1-19b): what a unit
// does to the unit it meets and what the unit it meets does to it (abilityFront: a unit facing, met by, duelling or
// guarding another), what a shooter in the second line does to its target and what the target does to the shooter
// (abilityBack). Each is handed the two units and the battle's facts, and the multiplier so far (the role matchup, then
// each ability before it), and returns the new multiplier and its words in the ladder, or nothing; its numbers come from
// the content's row. The runners (the-registry-of-content-effects.ts) run them in their stages' order. Until P1-19b they
// were written inline in abilityFront and abilityBack (src/engine/battle/lines.ts), in this order.
//
// 2026-10-11 (Toby, the unit abilities): every humanoid unit has a matchup ability, read when a unit meets another
// (faces, is met by, duels, guards) or shoots over its fighter. Some set the multiplier (Halberds: ×1.25 facing cavalry,
// where foot is usually ×1.15), the rest multiply it.
import { UNIT_ABILITIES_THE_REGISTRY_HOLDS as ROWS } from '../../../content/unit-abilities-their-names-numbers-and-words.ts';
import type { UnitAbilitySlug } from '../../../content/unit-abilities-their-names-numbers-and-words.ts';
import type {
  AMultiplierAndItsWords,
  AUnitInTheLine,
  TheStagesOfEachHookPoint,
} from '../the-registry-of-content-effects.ts';

type TheStrengthStages = TheStagesOfEachHookPoint['strength'];

/** The ability's multiplier, worded by its name. */
const named = (slug: UnitAbilitySlug, multiplier: number): AMultiplierAndItsWords => ({
  multiplier,
  words: ROWS[slug].name,
});
/** Whether a unit has the ability: its type is the ability's row's unit (another ability is asked by its slug). */
const has = (unit: AUnitInTheLine, slug: UnitAbilitySlug) => ROWS[slug].unit === unit.unitType;
/** Whether the battle's ground is one the ability acts on. */
const onItsGround = (slug: 'woodland-skirmish' | 'stone-halls' | 'thorn-hedge', ground: string | null) =>
  ground !== null && ROWS[slug].onTheGround.some((g) => g === ground);

export const WHAT_A_UNIT_DOES_TO_THE_UNIT_IT_MEETS = {
  halberds: (facts) =>
    facts.theUnitItMeets.role === 'cav' ? named('halberds', ROWS.halberds.numbers.facingCavalry.value) : null,
  'lance-charge': (facts) =>
    facts.theUnitItMeets.role === 'foot' ? named('lance-charge', ROWS['lance-charge'].numbers.facingFoot.value) : null,
  frenzy: (facts, m) =>
    facts.theUnitItMeets.role === 'foot' ? named('frenzy', m * ROWS.frenzy.numbers.facingFoot.value) : null,
  'wolves-panic-horses': (facts) =>
    facts.theUnitItMeets.role === 'cav'
      ? named('wolves-panic-horses', ROWS['wolves-panic-horses'].numbers.facingCavalry.value)
      : null,
  'stoop-on-the-horses': (facts) =>
    facts.theUnitItMeets.role === 'cav'
      ? named('stoop-on-the-horses', ROWS['stoop-on-the-horses'].numbers.facingCavalry.value)
      : null,
  harriers: (facts, m) =>
    facts.where === 'duel' ? named('harriers', m * ROWS.harriers.numbers.inAFlankDuel.value) : null,
  'woodland-skirmish': (facts, m) =>
    onItsGround('woodland-skirmish', facts.ground)
      ? named('woodland-skirmish', m * ROWS['woodland-skirmish'].numbers.inTheWoods.value)
      : null,
  bloodthirsty: (facts, m) =>
    !facts.theUnitsSideAttacks && facts.theUnitItMeets.role === 'foot'
      ? named('bloodthirsty', m * ROWS.bloodthirsty.numbers.defendingFacingFoot.value)
      : null,
  // The beasts (2026-10-13, Creatures and Monsters V): the walking beasts' matchups, and the unicorns' Purity.
  maul: (facts, m) =>
    facts.theUnitItMeets.role === 'foot' ? named('maul', m * ROWS.maul.numbers.facingFoot.value) : null,
  trample: (facts, m) =>
    facts.theUnitItMeets.role === 'foot' ? named('trample', m * ROWS.trample.numbers.facingFoot.value) : null,
  'many-heads': (facts, m) =>
    facts.theUnitItMeets.role === 'foot' ? named('many-heads', m * ROWS['many-heads'].numbers.facingFoot.value) : null,
  purity: (facts, m) =>
    facts.theUnitItMeetsIsAMonsterOrSkeletal
      ? named('purity', m * ROWS.purity.numbers.facingMonstersAndSkeletons.value)
      : null,
} satisfies Partial<Record<UnitAbilitySlug, TheStrengthStages['what a unit does to the unit it meets']>>;

// 2026-10-12 (Toby): Purity breaks a Spear Hedge or a Boulder Wall — the Unicorn Herd is never held to their ×0.75 cap.
/** A cap on the cavalry facing the unit, which Purity breaks: the multiplier held to the cap, or Purity's words. */
const aCapOnTheCavalryFacingIt = (
  slug: 'spear-hedge' | 'boulder-wall',
  unit: AUnitInTheLine,
  m: number,
): AMultiplierAndItsWords | null => {
  const cap = ROWS[slug].numbers.cavalryFacingThemAtMost.value;
  if (!(unit.role === 'cav' && m > cap)) return null;
  if (has(unit, 'purity')) return { multiplier: m, words: ROWS[slug].wordsInTheLadder.whenPurityBreaksIt };
  return named(slug, cap);
};

export const WHAT_THE_UNIT_IT_MEETS_DOES_TO_IT = {
  'spear-hedge': (facts, m) => aCapOnTheCavalryFacingIt('spear-hedge', facts.theUnit, m),
  'boulder-wall': (facts, m) => aCapOnTheCavalryFacingIt('boulder-wall', facts.theUnit, m),
  unbreakable: (facts, m) =>
    facts.theUnit.role === 'foot' ? named('unbreakable', m * ROWS.unbreakable.numbers.footFacingThem.value) : null,
  'stone-halls': (facts, m) =>
    facts.theUnit.role === 'foot' && onItsGround('stone-halls', facts.ground)
      ? named('stone-halls', m * ROWS['stone-halls'].numbers.footFacingItInTheMountains.value)
      : null,
  'thorn-hedge': (facts, m) =>
    facts.theUnit.role === 'cav' && onItsGround('thorn-hedge', facts.ground)
      ? named('thorn-hedge', m * ROWS['thorn-hedge'].numbers.cavalryFacingItInTheWoods.value)
      : null,
} satisfies Partial<Record<UnitAbilitySlug, TheStrengthStages['what the unit it meets does to it']>>;

export const WHAT_A_SHOOTER_DOES_TO_ITS_TARGET = {
  'bodkin-points': (facts) =>
    facts.theTarget.role === 'cav' ? named('bodkin-points', ROWS['bodkin-points'].numbers.shootingCavalry.value) : null,
  'volley-at-the-charge': (facts) =>
    facts.theTarget.role === 'cav'
      ? named('volley-at-the-charge', ROWS['volley-at-the-charge'].numbers.shootingCavalry.value)
      : null,
  marksmen: (facts) =>
    facts.theTarget.role === 'arc' ? named('marksmen', ROWS.marksmen.numbers.shootingArchers.value) : null,
  'armour-piercing': (facts, m) => {
    const { shootingAStrongUnit, aStrongUnitsBaseStrengthAtLeast } = ROWS['armour-piercing'].numbers;
    return facts.theTargetsBaseStrength >= aStrongUnitsBaseStrengthAtLeast.value
      ? named('armour-piercing', m * shootingAStrongUnit.value)
      : null;
  },
  bombard: (_facts, m) => named('bombard', m * ROWS.bombard.numbers.whateverTheyShoot.value),
} satisfies Partial<Record<UnitAbilitySlug, TheStrengthStages['what a shooter does to its target']>>;

export const WHAT_THE_TARGET_DOES_TO_THE_SHOOTER = {
  'arrow-fodder': (_facts, m) => named('arrow-fodder', m * ROWS['arrow-fodder'].numbers.archersShootingThem.value),
} satisfies Partial<Record<UnitAbilitySlug, TheStrengthStages['what the target does to the shooter']>>;
