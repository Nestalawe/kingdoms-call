// The steps a commander's items make on the strength of a unit he leads, and the strength after them, on plain values
// so the army card can share them (plan P1-11e37, for P1-11e38): the effects of the items' stage "strength: the
// commander's items", moved as they were from rules/magic-items/the-commanders-items-in-a-battle.ts (the items'
// registry's entries name them), with the facts they are handed and their step, and the runner's loop over them
// (rules/the-registry-of-magic-item-effects.ts, which finds the effects his active items carry and hands them in, in
// the stage's order). Until P1-19m they were written inline in armStr (src/engine/battle/terrain-and-unit-strength.ts),
// in this order, each rounded as it went.
import { KC_QUALITY_UP } from '../../content/kingdoms-call-data.ts';
import {
  MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS as ROWS,
  type AMagicItemEffectAsItsTextsWriteIt,
  type MagicItemEffectSlug,
} from '../../content/magic-item-effects-their-names-numbers-and-words.ts';
import { UNIT_Q_MULT } from './unit-types-and-base-strength.ts';

/** What the stage "strength: the commander's items" hands an effect (armStr, after the unit's own modifiers and before
 *  its factors from its force): the unit he leads and his realm's alignment. Which effects his items carry, the items'
 *  runner reads from his active items, once a call (rules/the-registry-of-magic-item-effects.ts). */
export interface AUnitLedByACommander {
  readonly unitType: string;
  /** The unit's own quality (not the tier Oratory lifts it to). */
  readonly quality: string | undefined;
  /** Whether the unit is skeletal (the mark a raising of the dead writes on it). */
  readonly isSkeletal: boolean;
  /** The alignment of the realm he leads it for, if any. */
  readonly theRealmsAlignment: string | null | undefined;
}

/** A step of the commander's items on a unit's strength: strength added, or a multiplier (with, for a step up a quality
 *  tier, the tier's own multiplier it is divided by), the result rounded. */
export type AStepOfTheCommandersItems =
  { readonly adds: number } | { readonly multipliesBy: number; readonly dividedBy?: number };

/** Each quality's next tier up (Elite's is its own), read by any quality's name. */
const ONE_TIER_UP: Readonly<Partial<Record<string, string>>> = KC_QUALITY_UP;

/** Whether the row's effect reaches the unit: the units it names, the skeletal units, or (none named) every unit. */
function reaches(slug: MagicItemEffectSlug, facts: AUnitLedByACommander): boolean {
  const row: AMagicItemEffectAsItsTextsWriteIt = ROWS[slug];
  if (row.reaches === undefined) return true;
  if (row.reaches === 'the skeletal units') return facts.isSkeletal;
  return row.reaches.includes(facts.unitType);
}

export const THE_COMMANDERS_ITEMS = {
  // Battle Standard: every army he leads, +2.
  'army-bonus': () => ({ adds: ROWS['army-bonus'].numbers.strengthAdded.value }),
  // Golden Spur: the cavalry he leads, ×1.25.
  'cavalry-bonus': (facts) =>
    reaches('cavalry-bonus', facts) ? { multipliesBy: ROWS['cavalry-bonus'].numbers.multiplier.value } : null,
  // Legionnaire's Mark: the infantry he leads, ×1.2.
  'infantry-bonus': (facts) =>
    reaches('infantry-bonus', facts) ? { multipliesBy: ROWS['infantry-bonus'].numbers.multiplier.value } : null,
  // Eagle-Eye Pendant: the archers he leads, ×1.3.
  'archer-bonus': (facts) =>
    reaches('archer-bonus', facts) ? { multipliesBy: ROWS['archer-bonus'].numbers.multiplier.value } : null,
  // Engineer's Blueprint: the heavy engines he leads, +4.
  'heavy-bonus': (facts) =>
    reaches('heavy-bonus', facts) ? { adds: ROWS['heavy-bonus'].numbers.strengthAdded.value } : null,
  // Kraken Figurehead: the fleets he leads fight one quality tier higher (none past Elite): the strength times the
  // next tier's multiplier, over its own tier's.
  'naval-bonus': (facts) => {
    if (!reaches('naval-bonus', facts)) return null;
    const own = facts.quality;
    if (own === undefined) return null;
    const up = ONE_TIER_UP[own];
    if (!up || up === own) return null;
    return { multipliesBy: Number(UNIT_Q_MULT[up]), dividedBy: Number(UNIT_Q_MULT[own]) };
  },
  // Sea Chart of the Deep: the fleets he leads, +1.
  'fleet-strength': (facts) =>
    reaches('fleet-strength', facts) ? { adds: ROWS['fleet-strength'].numbers.strengthAdded.value } : null,
  // Admiral's Spyglass: the fleets he leads, +2.
  'admirals-spyglass': (facts) =>
    reaches('admirals-spyglass', facts) ? { adds: ROWS['admirals-spyglass'].numbers.strengthAdded.value } : null,
  // Chalice of Dawn: a Divine realm's armies he leads, ×1.15.
  'chalice-of-dawn': (facts) =>
    facts.theRealmsAlignment === ROWS['chalice-of-dawn'].forARealmThatIs
      ? { multipliesBy: ROWS['chalice-of-dawn'].numbers.multiplier.value }
      : null,
  // Black Sceptre: the skeletal units he leads, +4.
  'undead-bonus': (facts) =>
    reaches('undead-bonus', facts) ? { adds: ROWS['undead-bonus'].numbers.strengthAdded.value } : null,
} satisfies Partial<Record<MagicItemEffectSlug, (facts: AUnitLedByACommander) => AStepOfTheCommandersItems | null>>;

/** An effect of the commander's items: one with a step at the stage "strength: the commander's items". */
export type AnEffectOfTheCommandersItems = keyof typeof THE_COMMANDERS_ITEMS;

/** The strength of a unit a commander leads after the steps of the effects his items carry, handed in the stage's
 *  order, each rounded as it goes (strength added is not rounded). */
export function theStrengthAUnitHasAfterTheStepsOfItsCommandersItems(
  theEffectsHisItemsCarry: readonly AnEffectOfTheCommandersItems[],
  facts: AUnitLedByACommander,
  theStrengthSoFar: number,
): number {
  let str = theStrengthSoFar;
  for (const slug of theEffectsHisItemsCarry) {
    const step: AStepOfTheCommandersItems | null = THE_COMMANDERS_ITEMS[slug](facts);
    if (!step) continue;
    if ('adds' in step) str += step.adds;
    else if (step.dividedBy === undefined) str = Math.round(str * step.multipliesBy);
    else str = Math.round((str * step.multipliesBy) / step.dividedBy);
  }
  return str;
}
