// The bots' valuation of each alignment ability, keyed by the ability (B-17p; BOT-V5, the requirements' answer A12):
// one entry for each of the 51 rows of ALIGNMENT_ABILITIES (src/content/alignment-abilities-their-keys-names-numbers-
// and-words.ts), and no other. A new ability with no entry fails to compile (`satisfies Record<AlignmentAbilitySlug,
// …>`). The content holds the rules only; what an ability is worth to a bot lives here.
//
// The table holds what today's bots do, and no more. Each entry is one of four kinds:
// - asked of the rule's runner: the bots ask the registry's runner (src/engine/rules/the-registry-of-alignment-
//   abilities.ts) and weigh the answer by its kind. The places that ask it read the runner from this table.
// - chosen by a pass of the plan: a pass of the bots' plan decides by its own judgement (the functions named), reading
//   the rule where it says so. Its code stays where it is.
// - nothing to choose: the ability acts at the world's making, or the turn applies it by itself.
// - not valued yet: no choice of the bots weighs it today. These are the bots' gaps, for later rows; none is built here.
import type { AlignmentAbilitySlug } from '../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import {
  theConquestDoctrineOfARealmsAlignment,
  theFactorARealmsAlignmentStrengthensItsDefenceOfItsOwnGroundBy,
  theFervourOfASide,
  theGoldARealmsAlignmentClaimsForEachFoeDestroyed,
  theReturnARealmsAlignmentGivesItsFallen,
  theYieldOfABlessARealmsAlignmentGives,
  whatARealmsAlignmentAddsToConvergingColumnsChanceToUnite,
  whatARealmsAlignmentAddsToResearch,
} from '../rules/the-registry-of-alignment-abilities.ts';

/** How the bots value one alignment ability today. */
export type TheBotsValuationOfAnAlignmentAbility =
  | {
      readonly how: "asked of the rule's runner, weighed by its kind";
      /** The registry's runner the bots ask. */
      readonly theRunner: (...theFacts: never[]) => unknown;
      /** The bots' functions that ask it, and what they weigh its answer for. */
      readonly whereTheBotsWeighIt: string;
    }
  | {
      readonly how: 'chosen by a pass of the plan';
      /** The bots' functions that decide its use, and the rule they read, where they read one. */
      readonly thePass: string;
    }
  | { readonly how: 'nothing to choose'; readonly why: 'it acts at the set-up' | 'the turn applies it by itself' }
  | { readonly how: 'not valued yet' };

const AT_THE_SET_UP = { how: 'nothing to choose', why: 'it acts at the set-up' } as const;
const THE_TURN_APPLIES_IT = { how: 'nothing to choose', why: 'the turn applies it by itself' } as const;
const NOT_VALUED_YET = { how: 'not valued yet' } as const;
const THE_SIGNATURE_ORDER = "botSignaturePre (missions.ts): the realm's signature order, by the bot's own conditions";

/** Each alignment ability's valuation by the bots, by its slug. */
export const THE_BOTS_VALUATION_OF_EACH_ALIGNMENT_ABILITY = {
  'neutral-trade': THE_TURN_APPLIES_IT,
  'consecrated-ground-tax': THE_TURN_APPLIES_IT,
  'zeal-of-a-divine-realm': NOT_VALUED_YET,
  'zeal-of-a-good-realm': NOT_VALUED_YET,
  'zeal-of-a-druidic-realm': NOT_VALUED_YET,
  'zeal-of-a-neutral-realm': NOT_VALUED_YET,
  'zeal-of-a-pagan-realm': NOT_VALUED_YET,
  'zeal-of-an-evil-realm': NOT_VALUED_YET,
  'zeal-of-an-undead-realm': NOT_VALUED_YET,
  'consecrated-ground-doubles-a-defenders-zeal': NOT_VALUED_YET,
  'savage-fury': {
    how: "asked of the rule's runner, weighed by its kind",
    theRunner: theFervourOfASide,
    whereTheBotsWeighIt:
      "botFervourMult (intel.ts): a host's strength in the estimates; botRecruitableTypes (strategy.ts): a recruit's worth",
  },
  'skeletal-fervour': {
    how: "asked of the rule's runner, weighed by its kind",
    theRunner: theFervourOfASide,
    whereTheBotsWeighIt:
      "botFervourMult (intel.ts): a host's strength in the estimates, the strongest fervour counting",
  },
  'consecrated-ground-weakens-an-unholy-attacker': NOT_VALUED_YET,
  'righteous-defence': {
    how: "asked of the rule's runner, weighed by its kind",
    theRunner: theFactorARealmsAlignmentStrengthensItsDefenceOfItsOwnGroundBy,
    whereTheBotsWeighIt: "botFervourMult (intel.ts): a defending host's strength in the estimates",
  },
  'banner-of-fellowship': {
    how: "asked of the rule's runner, weighed by its kind",
    theRunner: whatARealmsAlignmentAddsToConvergingColumnsChanceToUnite,
    whereTheBotsWeighIt: "botTuning (intel.ts): the realm's overlay, a lower margin to assault",
  },
  'home-of-the-wild': NOT_VALUED_YET,
  'reign-of-fear': NOT_VALUED_YET,
  'the-deathless-march': NOT_VALUED_YET,
  'the-neutral-mercenary-discount': NOT_VALUED_YET,
  'the-divine-blessing': {
    how: "asked of the rule's runner, weighed by its kind",
    theRunner: theYieldOfABlessARealmsAlignmentGives,
    whereTheBotsWeighIt: 'botCastPlan (spellcraft.ts): a hero leaves the Bless to his king where the king raises it',
  },
  'creatures-follow-without-a-druid': {
    how: 'chosen by a pass of the plan',
    thePass:
      "botEffForce, botBattleForce and botDruidShortfall (intel.ts) and botRecruitableTypes (strategy.ts): the beasts a host leads, by the battles' Druid check (druIdPenaltyMult)",
  },
  'monsters-follow-without-a-druid': {
    how: 'chosen by a pass of the plan',
    thePass:
      "botEffForce, botBattleForce and botDruidShortfall (intel.ts) and botRecruitableTypes (strategy.ts): the beasts a host leads, by the battles' Druid check (druIdPenaltyMult)",
  },
  'neutral-scholars': {
    how: "asked of the rule's runner, weighed by its kind",
    theRunner: whatARealmsAlignmentAddsToResearch,
    whereTheBotsWeighIt:
      "doesARealmOfThisAlignmentAddToResearch (specialists.ts): the Sage level from which a realm's scholar researches",
  },
  'divine-grace': {
    how: "asked of the rule's runner, weighed by its kind",
    theRunner: theReturnARealmsAlignmentGivesItsFallen,
    whereTheBotsWeighIt: "botTuning (intel.ts): the realm's overlay, a lower margin for the king to attack",
  },
  'the-divine-rest': NOT_VALUED_YET,
  'a-pagan-victors-blood-harvest': {
    how: "asked of the rule's runner, weighed by its kind",
    theRunner: theGoldARealmsAlignmentClaimsForEachFoeDestroyed,
    whereTheBotsWeighIt: "botTuning (intel.ts): the realm's overlay, a stronger lean against its rival",
  },
  'plunder-or-enslave': {
    how: "asked of the rule's runner, weighed by its kind",
    theRunner: theConquestDoctrineOfARealmsAlignment,
    whereTheBotsWeighIt:
      "botTuning (intel.ts): the realm's overlay, a province's tax weighed more and a stronger lean against its rival",
  },
  'graves-keep-on-undead-land': THE_TURN_APPLIES_IT,
  'war-without-warning-of-an-evil-realm': {
    how: 'chosen by a pass of the plan',
    thePass: 'botWarAssess (war.ts): a lower bar to declare war, by doesAnAlignmentDeclareWarWithoutWarning',
  },
  'war-without-warning-of-an-undead-realm': {
    how: 'chosen by a pass of the plan',
    thePass: 'botWarAssess (war.ts): a lower bar to declare war, by doesAnAlignmentDeclareWarWithoutWarning',
  },
  'a-broken-alliance-means-war-for-an-evil-realm': NOT_VALUED_YET,
  'a-broken-alliance-means-war-for-an-undead-realm': NOT_VALUED_YET,
  'the-risen-dead-follow-only-the-undead': {
    how: 'chosen by a pass of the plan',
    thePass:
      'runBotOrderHygiene (economy.ts): a hand-over keeps the risen dead from a hero they would not follow, by theRisenDeadFollowAHandOverTo',
  },
  'an-undead-hero-is-undead-in-personal-combat': NOT_VALUED_YET,
  'a-divine-king-starts-with-white-magic': AT_THE_SET_UP,
  'a-druidic-king-starts-with-druid': AT_THE_SET_UP,
  'an-evil-king-starts-with-druid': AT_THE_SET_UP,
  'a-pagan-king-starts-with-explorer': AT_THE_SET_UP,
  'an-undead-king-starts-with-necromancy': AT_THE_SET_UP,
  'an-undead-king-starts-with-a-skeletal-company': AT_THE_SET_UP,
  'a-pagan-capital-opens-beside-the-ritual-stones': AT_THE_SET_UP,
  'a-druidic-capital-opens-beside-creatures': AT_THE_SET_UP,
  'an-evil-capital-opens-beside-monsters': AT_THE_SET_UP,
  'a-druidic-wanderer-knows-the-druids-craft': AT_THE_SET_UP,
  'one-divine-realm-a-game': AT_THE_SET_UP,
  'one-undead-realm-a-game': AT_THE_SET_UP,
  consecrate: {
    how: 'chosen by a pass of the plan',
    thePass: `${THE_SIGNATURE_ORDER} (botConsecrateOK), and runBotMovement (movement.ts): a Divine king walks to the province botConsecrateTarget picks`,
  },
  'call-to-arms': { how: 'chosen by a pass of the plan', thePass: THE_SIGNATURE_ORDER },
  broker: { how: 'chosen by a pass of the plan', thePass: THE_SIGNATURE_ORDER },
  'harvest-the-field': { how: 'chosen by a pass of the plan', thePass: THE_SIGNATURE_ORDER },
  'perform-rite': { how: 'chosen by a pass of the plan', thePass: 'botRitePre (missions.ts)' },
} as const satisfies Record<AlignmentAbilitySlug, TheBotsValuationOfAnAlignmentAbility>;
