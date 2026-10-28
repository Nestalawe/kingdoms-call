// The magic items' effects at the stages "strength: the commander's items" and "strength: a land unit at sea, led"
// (plan P1-19m): each item a commander carries makes its step on the strength of a unit he leads, with its numbers and
// the units it reaches from the content's row; the items' runner (the-registry-of-magic-item-effects.ts) finds which
// effects his active items carry and applies their steps, in the stage's order, inside armStr. Until P1-19m they were
// written inline in armStr (src/engine/battle/terrain-and-unit-strength.ts), in this order, each rounded as it went.
import { KC_QUALITY_UP } from '../../../content/kingdoms-call-data.ts';
import {
  MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS as ROWS,
  type AMagicItemEffectAsItsTextsWriteIt,
  type MagicItemEffectSlug,
} from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import { UNIT_Q_MULT } from '../../rules-on-plain-values/unit-types-and-base-strength.ts';
import type { AUnitLedByACommander, TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheCommandersItemsEffect = TheStagesOfEachHookPoint['strength']["the commander's items"];

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
} satisfies Partial<Record<MagicItemEffectSlug, TheCommandersItemsEffect>>;

// A land unit at sea, led (each runs for every land unit at sea whose commander carries it). Tide-Caller's Horn: the
// land units he leads fight at full strength in a sea battle.
export const A_LAND_UNIT_AT_SEA_LED = {
  'land-units-at-full-strength-at-sea': () => true,
} satisfies Partial<Record<MagicItemEffectSlug, TheStagesOfEachHookPoint['strength']['a land unit at sea, led']>>;
