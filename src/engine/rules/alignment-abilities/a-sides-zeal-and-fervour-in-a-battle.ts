// A side's zeal and fervour in a battle (plan P1-19's alignment abilities family, row P1-19au1): each creed's chance of
// fanatical zeal ("strength: a realm's alignment gives a side its chance of zeal"), the doubling on consecrated ground
// ("strength: consecrated ground stirs a defender's zeal") and the fervours that need no roll, savage fury and skeletal
// fervour ("strength: a realm's alignment stirs a side's fervour"). Each reads its numbers from its row
// (src/content/alignment-abilities-their-keys-names-numbers-and-words.ts); the runners
// (the-registry-of-alignment-abilities.ts) ask those the side's realm's alignment holds. No effect draws a die: the
// chance is returned, and both battles draw the roll where they drew it before.
import {
  ALIGNMENT_ABILITIES,
  type AlignmentAbilitySlug,
} from '../../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { MONSTER_ARMIES } from '../../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheStrengthsStages = TheStagesOfEachHookPoint['strength'];

/** A creed's chance of zeal, its row's percentage as a share: 50 / 100 is exactly 0.5, as each of the seven is the
 *  number it was written as before (0.4, 0.25, 0.2, 0.15, 0.1, 0). */
const theChanceOfZealOf = (slug: TheSlugsOfTheZeals): number =>
  ALIGNMENT_ABILITIES[slug].theNumbers.theChanceOfZeal.value / 100;

type TheSlugsOfTheZeals =
  | 'zeal-of-a-divine-realm'
  | 'zeal-of-a-good-realm'
  | 'zeal-of-a-druidic-realm'
  | 'zeal-of-a-neutral-realm'
  | 'zeal-of-a-pagan-realm'
  | 'zeal-of-an-evil-realm'
  | 'zeal-of-an-undead-realm';

/** "strength: a realm's alignment gives a side its chance of zeal": each creed's chance, before its discoveries'. */
export const A_REALMS_ALIGNMENT_GIVES_A_SIDE_ITS_CHANCE_OF_ZEAL = {
  'zeal-of-a-divine-realm': () => theChanceOfZealOf('zeal-of-a-divine-realm'),
  'zeal-of-a-good-realm': () => theChanceOfZealOf('zeal-of-a-good-realm'),
  'zeal-of-a-druidic-realm': () => theChanceOfZealOf('zeal-of-a-druidic-realm'),
  'zeal-of-a-neutral-realm': () => theChanceOfZealOf('zeal-of-a-neutral-realm'),
  'zeal-of-a-pagan-realm': () => theChanceOfZealOf('zeal-of-a-pagan-realm'),
  'zeal-of-an-evil-realm': () => theChanceOfZealOf('zeal-of-an-evil-realm'),
  'zeal-of-an-undead-realm': () => theChanceOfZealOf('zeal-of-an-undead-realm'),
} satisfies Partial<
  Record<AlignmentAbilitySlug, TheStrengthsStages["a realm's alignment gives a side its chance of zeal"]>
>;

/** "strength: consecrated ground stirs a defender's zeal": the chance so far (after the discoveries') times the row's
 *  multiple, at most 1, as `Math.min(1, chance * 2)` was. */
export const CONSECRATED_GROUND_STIRS_A_DEFENDERS_ZEAL = {
  'consecrated-ground-doubles-a-defenders-zeal': (facts) =>
    Math.min(
      1,
      facts.theChance *
        ALIGNMENT_ABILITIES['consecrated-ground-doubles-a-defenders-zeal'].theNumbers.theTimesTheChance.value,
    ),
} satisfies Partial<Record<AlignmentAbilitySlug, TheStrengthsStages["consecrated ground stirs a defender's zeal"]>>;

/** "strength: a realm's alignment stirs a side's fervour": an Undead host with any skeletal unit in it, at its row's
 *  factor under the king in person and the other under any other commander; an Evil host with any Monster in it, at
 *  its row's factor. Neither rolls. */
export const A_REALMS_ALIGNMENT_STIRS_A_SIDES_FERVOUR = {
  'skeletal-fervour': (facts) => {
    if (!facts.theForce.some((a) => a._isSkeletal)) return null;
    const { underTheKing, underAnyOtherCommander } = ALIGNMENT_ABILITIES['skeletal-fervour'].theNumbers;
    return facts.isItLedByTheKing ? underTheKing.value : underAnyOtherCommander.value;
  },
  'savage-fury': (facts) =>
    facts.theForce.some((a) => MONSTER_ARMIES.has(a.type))
      ? ALIGNMENT_ABILITIES['savage-fury'].theNumbers.theStrengthOfTheHost.value
      : null,
} satisfies Partial<Record<AlignmentAbilitySlug, TheStrengthsStages["a realm's alignment stirs a side's fervour"]>>;
