// The guardian perks' effects for a guardian's own wards, the three no item carries (plan P1-19aj; Toby, 2026-10-14,
// batch item 7): the stun ward, the lingering-harm ward and the ward against one school of magic. What each sets in
// the wards he wears (pcArmourMerge: the best of his perks' wards of the kind; a school's ward for its school alone),
// and what each does in the fight: the stun ward's chance to turn a stun as it lands (pcStunWard, beside his items'
// refusal), a stun he is under cleared as a round starts when his wards turn every stun, every lingering harm sloughed
// off by a whole ward (pcRoundStart, beside his items'), each tick's share turned (pcRoundStart), and the points a ward
// against a spell's school takes off its cast (pcCastCombatSpell: never below 5, and none against the school he is
// weak to). Each reads the perk's ward as its row writes it, and gives the ward the line names, so the lines' finders
// are handed no kind of perk. The guardian perks' runners (the-registry-of-guardian-perks.ts) find and apply them.
// Until P1-19aj they were written inline in pcArmourMerge (src/engine/personal-combat/helpers.ts), pcStunWard,
// pcStunTurned and pcRoundStart (src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts) and pcCastCombatSpell
// (src/engine/personal-combat/combat-spells-and-guardian-abilities.ts).
import {
  GUARDIAN_PERKS_THE_REGISTRY_HOLDS as ROWS,
  THE_NUMBERS_THE_CODE_WRITES_FOR_A_GUARDIANS_PERKS as THE_CODES_NUMBERS,
  type GuardianPerkSlug,
} from '../../../content/guardian-perks-their-kinds-numbers-and-words.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type AGuardiansPerks = TheStagesOfEachHookPoint['personalCombat'];

export const WHAT_A_GUARDIAN_WEARS_A_WARD_OF_HIS_OWN = {
  // % of stuns turned as they land (100: never stunned): the best of his perks'
  'a-stun-ward': (theWard, theWardsSoFar) => ({
    stunWard: Math.max(Number(theWardsSoFar.stunWard) || 0, theWard.pct ?? 0),
  }),
  // % off every tick of lingering harm (100: immune): the best of his perks'
  'a-lingering-harm-ward': (theWard, theWardsSoFar) => ({
    dotWard: Math.max(Number(theWardsSoFar.dotWard) || 0, theWard.pct ?? 0),
  }),
  // −N to that school's cast chance, the best of his perks' for each school (a ward that names no school sets nothing)
  'a-ward-against-one-school': (theWard, theWardsSoFar) => {
    if (!theWard.school) return {};
    const schoolWard: Partial<Record<string, number>> = { ...(theWardsSoFar.schoolWard ?? {}) };
    schoolWard[theWard.school] = Math.max(Number(schoolWard[theWard.school]) || 0, theWard.pct ?? 0);
    return { schoolWard };
  },
} satisfies Partial<Record<GuardianPerkSlug, AGuardiansPerks["a guardian's perks: what he wears: a ward of his own"]>>;

export const A_GUARDIANS_STUN_WARD_AS_A_STUN_TAKES_HOLD = {
  // his chance to shrug off a stun as it lands, 0 to a full ward
  'a-stun-ward': (theWards) => ({
    theChance: Math.max(0, Math.min(THE_CODES_NUMBERS.aFullWard.value, Number(theWards?.stunWard) || 0)),
    theWardTheLineNames: ROWS['a-stun-ward'].carriedAs.ward,
  }),
} satisfies Partial<Record<GuardianPerkSlug, AGuardiansPerks["a guardian's perks: a stun takes hold"]>>;

export const WHAT_A_GUARDIANS_PERKS_DO_AS_A_ROUND_STARTS = {
  // wards that turn every stun (his items' refusal, or a full stun ward) clear a stun he is under
  'a-stun-ward': ({ theChanceHisWardsTurnAStun }) =>
    theChanceHisWardsTurnAStun >= THE_CODES_NUMBERS.aFullWard.value
      ? { theStunHeIsUnderIsCleared: { theWardTheLineNames: ROWS['a-stun-ward'].carriedAs.ward } }
      : {},
  // every lingering harm sloughs off, beside his items' (Ashen Plate), at a whole lingering-harm ward
  'a-lingering-harm-ward': ({ theWards, hisItemsSloughOffEveryLingeringHarm }) =>
    hisItemsSloughOffEveryLingeringHarm || (Number(theWards.dotWard) || 0) >= THE_CODES_NUMBERS.aFullWard.value
      ? { everyLingeringHarmSloughsOff: { theWardTheLineNames: ROWS['a-lingering-harm-ward'].carriedAs.ward } }
      : {},
} satisfies Partial<Record<GuardianPerkSlug, AGuardiansPerks["a guardian's perks: a round starts"]>>;

export const A_GUARDIANS_LINGERING_HARM_WARD_AS_A_HARM_BITES = {
  // its share off every tick, up to a full ward
  'a-lingering-harm-ward': (theWards) => ({
    theShareItTurns: Math.min(THE_CODES_NUMBERS.aFullWard.value, Number(theWards?.dotWard) || 0),
    theWardTheLineNames: ROWS['a-lingering-harm-ward'].carriedAs.ward,
  }),
} satisfies Partial<Record<GuardianPerkSlug, AGuardiansPerks["a guardian's perks: a lingering harm bites"]>>;

export const A_GUARDIANS_WARD_AGAINST_A_SPELLS_SCHOOL_AS_IT_IS_CAST = {
  // his ward against the spell's school takes its points off the (already capped) cast chance, never below 5; a
  // guardian is never warded against the school he is weak to
  'a-ward-against-one-school': ({ theTargetsWards, theSchool, heIsWeakToTheSchool, theChanceSoFar }) => {
    const thePointsOff = (heIsWeakToTheSchool ? 0 : (theTargetsWards?.schoolWard?.[theSchool] ?? 0)) || 0;
    return {
      thePointsOff,
      theChanceAfter: thePointsOff > 0 ? Math.max(5, theChanceSoFar - thePointsOff) : theChanceSoFar,
      theWardTheLineNames: ROWS['a-ward-against-one-school'].carriedAs.ward,
    };
  },
} satisfies Partial<
  Record<GuardianPerkSlug, AGuardiansPerks["a guardian's perks: a combat spell's chance: a ward against its school"]>
>;
