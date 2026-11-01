// The rule registry of the guardian perks (plan P1-19's guardian perks, Decisions 2 and 3). A kind of perk is one row in
// src/content/ (the kind as MONSTERS_P writes it, its value at each grade, its words and its row in the rulebook's
// table: guardian-perks-their-kinds-numbers-and-words.ts) and one entry here, keyed by the same slug, naming its effect
// at each stage of a hook point. The hook points and their stages are the content effects' (one union, in
// the-registry-of-content-effects.ts); each stage's order is THE_ORDER_OF_EACH_STAGE_OF_THE_GUARDIAN_PERKS.
//
// A held guardian carries his own copy of his perks (`passives`, or an older save's one `passive`: guardianPassives
// finds them), and each effect reads that copy's numbers, as a held item's are read. Fourteen kinds are the items' too:
// what a perk of one of them wears and does in a fight is the items' effect its row names (pcApplyFx, one applier), so
// its entry here holds only a guardian's own stages. The three kinds no item carries (the stun ward, the lingering-harm
// ward and the ward against one school) hold what he wears and what they do in the fight (plan P1-19aj).
import {
  GUARDIAN_PERKS_THE_REGISTRY_HOLDS as ROWS,
  type GuardianPerkSlug,
  type HowAGuardianCarriesAPerk,
} from '../../content/guardian-perks-their-kinds-numbers-and-words.ts';
import {
  A_GUARDIANS_GRADES_CAP_BESIDE_HIS_OWN,
  A_GUARDIANS_PERKS_TURN_AN_APPROACH_ON_HIS_CARD,
} from './guardian-perks/a-guardians-perks-on-his-card-and-in-his-build.ts';
import {
  A_GUARDIANS_LINGERING_HARM_WARD_AS_A_HARM_BITES,
  A_GUARDIANS_STUN_WARD_AS_A_STUN_TAKES_HOLD,
  A_GUARDIANS_WARD_AGAINST_A_SPELLS_SCHOOL_AS_IT_IS_CAST,
  WHAT_A_GUARDIAN_WEARS_A_WARD_OF_HIS_OWN,
  WHAT_A_GUARDIANS_PERKS_DO_AS_A_ROUND_STARTS,
} from './guardian-perks/a-guardians-own-wards-what-he-wears-and-what-they-turn.ts';
import type {
  ACastAsAGuardiansWardAgainstItsSchoolMeetsIt,
  AFightersWardsAsAGuardiansPerksMeetARound,
  AGuardiansGradesCapAndTheWardsHisPerksGaveHim,
  AGuardiansLingeringHarmWard,
  AGuardiansStunWard,
  APerkAsAGuardiansCardReadsIt,
  AWardAsTheMergeReadsIt,
  HookPointName,
  TheApproachesAGuardiansPerksTurn,
  TheStagesOfEachHookPoint,
  TheWardsAFighterWears,
  TheWardsAsTheirEffectsReadThem,
  WhatAGuardiansGradesCapDoes,
  WhatAGuardiansPerksDoAsARoundStarts,
  WhatAWardAgainstASchoolDoesToACast,
  WhatAWardSets,
} from './the-registry-of-content-effects.ts';

/** An entry: the kind's effect at each stage it acts in. */
export type GuardianPerkEntry = { readonly [H in HookPointName]?: Partial<TheStagesOfEachHookPoint[H]> };

/** One entry for each content row, and no other (a row with no entry fails to compile, TS1360; an entry with no row,
 *  TS2353). An entry with no stage is a kind whose wear and fight are the items' effect its row names. */
export const THE_REGISTRY_OF_GUARDIAN_PERKS = {
  'a-ward-against-one-school': {
    personalCombat: {
      "a guardian's perks: what he wears: a ward of his own":
        WHAT_A_GUARDIAN_WEARS_A_WARD_OF_HIS_OWN['a-ward-against-one-school'],
      "a guardian's perks: a combat spell's chance: a ward against its school":
        A_GUARDIANS_WARD_AGAINST_A_SPELLS_SCHOOL_AS_IT_IS_CAST['a-ward-against-one-school'],
    },
  },
  'spell-resistance': {
    personalCombat: {
      "a guardian's perks: what his card turns": A_GUARDIANS_PERKS_TURN_AN_APPROACH_ON_HIS_CARD['spell-resistance'],
    },
  },
  'a-stun-ward': {
    personalCombat: {
      "a guardian's perks: what he wears: a ward of his own": WHAT_A_GUARDIAN_WEARS_A_WARD_OF_HIS_OWN['a-stun-ward'],
      "a guardian's perks: a stun takes hold": A_GUARDIANS_STUN_WARD_AS_A_STUN_TAKES_HOLD['a-stun-ward'],
      "a guardian's perks: a round starts": WHAT_A_GUARDIANS_PERKS_DO_AS_A_ROUND_STARTS['a-stun-ward'],
    },
  },
  'a-lingering-harm-ward': {
    personalCombat: {
      "a guardian's perks: what he wears: a ward of his own":
        WHAT_A_GUARDIAN_WEARS_A_WARD_OF_HIS_OWN['a-lingering-harm-ward'],
      "a guardian's perks: a round starts": WHAT_A_GUARDIANS_PERKS_DO_AS_A_ROUND_STARTS['a-lingering-harm-ward'],
      "a guardian's perks: a lingering harm bites":
        A_GUARDIANS_LINGERING_HARM_WARD_AS_A_HARM_BITES['a-lingering-harm-ward'],
    },
  },
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
    // the order pcArmourMerge's switch asked them in (each sets its own field, so the order changes nothing)
    "a guardian's perks: what he wears: a ward of his own": [
      'a-stun-ward',
      'a-lingering-harm-ward',
      'a-ward-against-one-school',
    ],
    "a guardian's perks: a stun takes hold": ['a-stun-ward'],
    // the order pcRoundStart asked them in (each sets its own field)
    "a guardian's perks: a round starts": ['a-stun-ward', 'a-lingering-harm-ward'],
    "a guardian's perks: a lingering harm bites": ['a-lingering-harm-ward'],
    "a guardian's perks: a combat spell's chance: a ward against its school": ['a-ward-against-one-school'],
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

/** The runner of "personalCombat: a guardian's perks: what he wears: a ward of his own" (pcArmourMerge, once the items'
 *  registry finds no effect of the ward's kind): what the effect of the ward's own kind sets in the wards he wears,
 *  from the wards so far, or nothing (no kind of the stage's order is carried as that ward). */
export function whatAGuardiansOwnWardSetsInTheWardsHeWears(
  theWard: AWardAsTheMergeReadsIt,
  theWardsSoFar: Readonly<TheWardsAFighterWears>,
): WhatAWardSets | null {
  for (const slug of PERSONAL_COMBAT["a guardian's perks: what he wears: a ward of his own"]) {
    const theKind: HowAGuardianCarriesAPerk = ROWS[slug].carriedAs;
    if (!('ward' in theKind) || theKind.ward !== theWard.ward) continue;
    const effect = ENTRIES[slug].personalCombat?.["a guardian's perks: what he wears: a ward of his own"];
    if (effect) return effect(theWard, theWardsSoFar);
  }
  return null;
}

// The three stages below hold one effect each: the runner asks the first kind of the stage's order, typed from the
// registry itself, so an order naming a kind with no effect at the stage fails to compile.

/** The runner of "personalCombat: a guardian's perks: a stun takes hold" (pcStunWard, pcStunTurned's line): the chance
 *  his perks turn a stun as it lands (none worn: 0), and the ward the line names. */
export function theStunWardAGuardiansPerksGiveHim(
  theWards: TheWardsAsTheirEffectsReadThem | null | undefined,
): AGuardiansStunWard {
  const [theKind] = PERSONAL_COMBAT["a guardian's perks: a stun takes hold"];
  return THE_REGISTRY_OF_GUARDIAN_PERKS[theKind].personalCombat["a guardian's perks: a stun takes hold"](theWards);
}

/** The runner of "personalCombat: a guardian's perks: a lingering harm bites" (pcRoundStart, each tick): the share of
 *  each tick his perks turn (none worn: 0), and the ward the line names. */
export function theLingeringHarmWardAGuardiansPerksGiveHim(
  theWards: TheWardsAsTheirEffectsReadThem | null | undefined,
): AGuardiansLingeringHarmWard {
  const [theKind] = PERSONAL_COMBAT["a guardian's perks: a lingering harm bites"];
  return THE_REGISTRY_OF_GUARDIAN_PERKS[theKind].personalCombat["a guardian's perks: a lingering harm bites"](theWards);
}

/** The runner of "personalCombat: a guardian's perks: a combat spell's chance: a ward against its school"
 *  (pcCastCombatSpell): what the target's ward against the spell's school does to its cast. */
export function whatAGuardiansWardAgainstASchoolDoesToACast(
  facts: ACastAsAGuardiansWardAgainstItsSchoolMeetsIt,
): WhatAWardAgainstASchoolDoesToACast {
  const [theKind] = PERSONAL_COMBAT["a guardian's perks: a combat spell's chance: a ward against its school"];
  return THE_REGISTRY_OF_GUARDIAN_PERKS[theKind].personalCombat[
    "a guardian's perks: a combat spell's chance: a ward against its school"
  ](facts);
}

/** The runner of "personalCombat: a guardian's perks: a round starts" (pcRoundStart, when he wears wards): what his
 *  perks do as the round starts, each effect's fields in the stage's order. */
export function whatAGuardiansPerksDoAsARoundStarts(
  facts: AFightersWardsAsAGuardiansPerksMeetARound,
): WhatAGuardiansPerksDoAsARoundStarts {
  let done: WhatAGuardiansPerksDoAsARoundStarts = {};
  for (const slug of PERSONAL_COMBAT["a guardian's perks: a round starts"]) {
    const effect = ENTRIES[slug].personalCombat?.["a guardian's perks: a round starts"];
    if (effect) done = { ...done, ...effect(facts) };
  }
  return done;
}
