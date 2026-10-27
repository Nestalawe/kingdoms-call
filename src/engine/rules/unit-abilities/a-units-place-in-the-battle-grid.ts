// The unit abilities at the three stages of a unit's place in the battle grid (plan P1-19h), in battleGrid and
// battleRegrid (src/engine/battle/lines.ts): a rider takes the flank on rough ground (abilityFlanksRough), a flyer takes
// an open flank no rider fills, and its place in the line. Each is handed what its stage hands it (the registry's stage
// types) and returns a value; its numbers come from the content's row. The runners (the-registry-of-content-effects.ts)
// run them in their stages' order, each for its row's unit. Until P1-19h they were written inline in those functions, in
// this order.
//
// 2026-10-11 (Toby, the unit abilities): flank slots. On open ground Tactical + 1 riders; on rough ground one, and only
// for the cavalry bred for it; none at sea. On open ground a slot no rider fills may be held by the Eagle Riders.
import { UNIT_ABILITIES_THE_REGISTRY_HOLDS as ROWS } from '../../../content/unit-abilities-their-names-numbers-and-words.ts';
import type { UnitAbilitySlug } from '../../../content/unit-abilities-their-names-numbers-and-words.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheStrengthStages = TheStagesOfEachHookPoint['strength'];

/** Whether the battle's ground is one the ability acts on. */
const onItsGround = (slug: 'through-the-trees' | 'through-the-glades' | 'crag-charge', ground: string | null) =>
  ROWS[slug].onTheGround.some((g) => g === ground);

// A rider takes the flank on rough ground (each runs only for its row's unit, a rider of the line).
export const A_RIDER_TAKES_THE_FLANK_ON_ROUGH_GROUND = {
  // ELF — Through the Trees: the Stag Riders in forest and jungle.
  'through-the-trees': (facts) => onItsGround('through-the-trees', facts.ground),
  // PRIMAL — Through the Glades (2026-10-13, the beast abilities): the Unicorn Herd joins the Stag Riders in the woods.
  'through-the-glades': (facts) => onItsGround('through-the-glades', facts.ground),
  // DWARF — Crag Charge: the Ironhoof Rams in the mountains.
  'crag-charge': (facts) => onItsGround('crag-charge', facts.ground),
} satisfies Partial<Record<UnitAbilitySlug, TheStrengthStages['a rider takes the flank on rough ground']>>;

// A flyer takes an open flank no rider fills (each runs only for its row's unit, a flyer, and only on open ground).
export const A_FLYER_TAKES_AN_OPEN_FLANK_NO_RIDER_FILLS = {
  // ELF — Stoop on the Horses: the Eagle Riders leave the air for the flank.
  'stoop-on-the-horses': () => true,
} satisfies Partial<Record<UnitAbilitySlug, TheStrengthStages['a flyer takes an open flank no rider fills']>>;

// Its place in the line (each runs only for its row's unit, in the front line or the second line where it doesn't
// shoot over a fighter of its own).
export const ITS_PLACE_IN_THE_LINE = {
  // ORC — Brawling Archers: the orcs' archers fight hand to hand at full strength in the front.
  'brawling-archers': (facts) =>
    facts.itsLine === 'front' && facts.theUnit.role === 'arc'
      ? {
          multiplier: ROWS['brawling-archers'].numbers.inTheFrontLine.value,
          ability: { slug: 'brawling-archers' },
        }
      : null,
  // PRIMAL — Colossal Bulk (2026-10-13, the beast abilities): the Titans reach over the front.
  'colossal-bulk': (facts) =>
    facts.itsLine === 'second'
      ? {
          multiplier: ROWS['colossal-bulk'].numbers.inTheSecondLine.value,
          ability: { slug: 'colossal-bulk' },
        }
      : null,
} satisfies Partial<Record<UnitAbilitySlug, TheStrengthStages['its place in the line']>>;
