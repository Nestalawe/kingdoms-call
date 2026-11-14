// A realm's alignment at the turn's end (plan P1-19's alignment abilities family, row P1-19at1): the abilities that add
// to a realm's tax ("turnEnd: a realm's alignment adds to its tax"). Each is handed the facts of its stage and reads its
// numbers from its row (src/content/alignment-abilities-their-keys-names-numbers-and-words.ts); the runner
// (the-registry-of-alignment-abilities.ts) asks those the realm's alignment holds. No effect draws a die.
import {
  ALIGNMENT_ABILITIES,
  type AlignmentAbilitySlug,
} from '../../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheTurnsEndsStages = TheStagesOfEachHookPoint['turnEnd'];

/** "turnEnd: a realm's alignment adds to its tax": the Neutral trade, its row's share of the provinces' income, rounded
 *  down. The share is a percentage, so the income is divided by 100 / 20 = 5 exactly: integer division, so Early
 *  Winter's collection and the report's forecast never part by a floating-point hair (`income * 0.2` would). */
export const A_REALMS_ALIGNMENT_ADDS_TO_ITS_TAX = {
  'neutral-trade': (facts) =>
    Math.floor(
      (Number(facts.theIncome) || 0) /
        (100 / ALIGNMENT_ABILITIES['neutral-trade'].theNumbers.theShareOfTheProvincesIncome.value),
    ),
} satisfies Partial<Record<AlignmentAbilitySlug, TheTurnsEndsStages["a realm's alignment adds to its tax"]>>;
