// The rule registry of the guardian perks (plan P1-19's guardian perks, Decisions 2 and 3). A kind of perk is one row in
// src/content/ (the kind as MONSTERS_P writes it, its value at each grade, its words and its row in the rulebook's
// table: guardian-perks-their-kinds-numbers-and-words.ts) and one entry here, keyed by the same slug, naming its effect
// at each stage of a hook point. The hook points and their stages are the content effects' (one union, in
// the-registry-of-content-effects.ts); each stage's order is THE_ORDER_OF_EACH_STAGE_OF_THE_GUARDIAN_PERKS.
//
// A held guardian carries his own copy of his perks (`passives`, or an older save's one `passive`: guardianPassives
// finds them), and each effect reads that copy's numbers, as a held item's are read. Fourteen kinds are the items' too:
// what a perk of one of them wears and does in a fight is the items' effect its row names (pcApplyFx, one applier), so
// its entry here holds only a guardian's own stages. The kinds whose effect is still read inline (the stun ward, the
// lingering-harm ward and the ward against one school: pcArmourMerge, pcStunWard, pcRoundStart, pcCastCombatSpell)
// hold none yet: tests/unit/the-rule-registry-holds-each-effect-once-in-the-order-of-its-stage.test.ts lists them.
import type { GuardianPerkSlug } from '../../content/guardian-perks-their-kinds-numbers-and-words.ts';
import {
  A_GUARDIANS_GRADES_CAP_BESIDE_HIS_OWN,
  A_GUARDIANS_PERKS_TURN_AN_APPROACH_ON_HIS_CARD,
} from './guardian-perks/a-guardians-perks-on-his-card-and-in-his-build.ts';
import type {
  AGuardiansGradesCapAndTheWardsHisPerksGaveHim,
  APerkAsAGuardiansCardReadsIt,
  HookPointName,
  TheApproachesAGuardiansPerksTurn,
  TheStagesOfEachHookPoint,
  WhatAGuardiansGradesCapDoes,
} from './the-registry-of-content-effects.ts';

/** An entry: the kind's effect at each stage it acts in. */
export type GuardianPerkEntry = { readonly [H in HookPointName]?: Partial<TheStagesOfEachHookPoint[H]> };

/** One entry for each content row, and no other (a row with no entry fails to compile, TS1360; an entry with no row,
 *  TS2353). An entry with no stage is a kind whose wear and fight are the items' effect its row names, or a kind still
 *  read inline. */
export const THE_REGISTRY_OF_GUARDIAN_PERKS = {
  'a-ward-against-one-school': {},
  'spell-resistance': {
    personalCombat: {
      "a guardian's perks: what his card turns": A_GUARDIANS_PERKS_TURN_AN_APPROACH_ON_HIS_CARD['spell-resistance'],
    },
  },
  'a-stun-ward': {},
  'a-lingering-harm-ward': {},
  'a-tough-hide': {
    personalCombat: {
      "a guardian's perks: what his card turns": A_GUARDIANS_PERKS_TURN_AN_APPROACH_ON_HIS_CARD['a-tough-hide'],
    },
  },
  'arrow-proof': {
    personalCombat: {
      "a guardian's perks: what his card turns": A_GUARDIANS_PERKS_TURN_AN_APPROACH_ON_HIS_CARD['arrow-proof'],
    },
  },
  'hard-to-hit': {},
  'a-dread-aura': {},
  'a-keen-eye': {},
  'brute-strength': {},
  thorns: {},
  'a-fire-or-frost-aura': {},
  regeneration: {},
  'life-drain': {},
  'a-second-wind': {},
  'desperate-defence': {},
  'a-hit-cap': {
    personalCombat: {
      "a guardian's perks: his grade's cap beside his own": A_GUARDIANS_GRADES_CAP_BESIDE_HIS_OWN['a-hit-cap'],
    },
  },
} satisfies Record<GuardianPerkSlug, GuardianPerkEntry>;

/** Each stage's order: the entries with an effect at the stage, each once. */
export const THE_ORDER_OF_EACH_STAGE_OF_THE_GUARDIAN_PERKS = {
  personalCombat: {
    // the order monsterTraits asked them in (each keeps its own approach at 1 or below, so the order changes nothing)
    "a guardian's perks: what his card turns": ['a-tough-hide', 'arrow-proof', 'spell-resistance'],
    "a guardian's perks: his grade's cap beside his own": ['a-hit-cap'],
  },
} as const satisfies {
  readonly [H in HookPointName]?: {
    readonly [S in keyof TheStagesOfEachHookPoint[H]]?: readonly GuardianPerkSlug[];
  };
};

const ENTRIES: Readonly<Record<GuardianPerkSlug, GuardianPerkEntry>> = THE_REGISTRY_OF_GUARDIAN_PERKS;
const PERSONAL_COMBAT = THE_ORDER_OF_EACH_STAGE_OF_THE_GUARDIAN_PERKS.personalCombat;

/** The runner of "personalCombat: a guardian's perks: what his card turns" (monsterTraits): the approaches his perks
 *  turn, each stage's effect asked of each perk (a perk with no effect, none). */
export function theApproachesAGuardiansPerksTurn(
  thePerks: readonly (APerkAsAGuardiansCardReadsIt | null | undefined)[],
): TheApproachesAGuardiansPerksTurn {
  const turned = { melee: false, archery: false, spell: false };
  for (const slug of PERSONAL_COMBAT["a guardian's perks: what his card turns"]) {
    const effect = ENTRIES[slug].personalCombat?.["a guardian's perks: what his card turns"];
    if (!effect) continue;
    for (const thePerk of thePerks) {
      const theApproach = thePerk ? effect(thePerk) : null;
      if (theApproach !== null) turned[theApproach] = true;
    }
  }
  return turned;
}

/** The runner of "personalCombat: a guardian's perks: his grade's cap beside his own" (pcMonsterCombatant, once his
 *  perks are on him): what the first effect of the stage's order gives, or nothing (his grade gives no cap). */
export function whatAGuardiansGradesCapDoesBesideHisOwn(
  facts: AGuardiansGradesCapAndTheWardsHisPerksGaveHim,
): WhatAGuardiansGradesCapDoes | null {
  for (const slug of PERSONAL_COMBAT["a guardian's perks: his grade's cap beside his own"]) {
    const done = ENTRIES[slug].personalCombat?.["a guardian's perks: his grade's cap beside his own"]?.(facts) ?? null;
    if (done !== null) return done;
  }
  return null;
}
