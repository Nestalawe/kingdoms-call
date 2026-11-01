// The guardian perks' effects at the two stages of a guardian's nature and build (plan P1-19ai): the approach a perk
// turns on his card (monsterTraits: a perk that turns blows, arrows or spells keeps the hidden multiplier of that
// approach at 1 or below, so a guardian never resists and is weak to the same thing: Toby, 2026-10-08, item 4), and
// his grade's cap beside his own (pcMonsterCombatant: the grade's cap merged after his perks, the merge keeping the
// looser, then a tighter cap of his own kept). Each reads the perk's ward as its row writes it. The guardian perks'
// runners (the-registry-of-guardian-perks.ts) find and apply them. Until P1-19ai they were written inline in
// monsterTraits (src/engine/personal-combat/lair-guardians-and-the-odds.ts) and pcMonsterCombatant
// (src/engine/personal-combat/speed-encounter-plans-and-combatants.ts).
import {
  GUARDIAN_PERKS_THE_REGISTRY_HOLDS as ROWS,
  type GuardianPerkSlug,
} from '../../../content/guardian-perks-their-kinds-numbers-and-words.ts';
import type { APerkAsAGuardiansCardReadsIt, TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type AGuardiansPerks = TheStagesOfEachHookPoint['personalCombat'];

/** Whether a perk carries a ward the card's rule reads: its `ward`, or a field of the ward's own name set. */
function aPerkCarriesTheWard(
  thePerk: APerkAsAGuardiansCardReadsIt,
  theWard: 'meleeDR' | 'arrowDR' | 'spellPct',
): boolean {
  return thePerk.ward === theWard || !!thePerk[theWard];
}

export const A_GUARDIANS_PERKS_TURN_AN_APPROACH_ON_HIS_CARD = {
  // his hide turns blows
  'a-tough-hide': (thePerk) => (aPerkCarriesTheWard(thePerk, ROWS['a-tough-hide'].carriedAs.ward) ? 'melee' : null),
  // he shrugs off arrows
  'arrow-proof': (thePerk) => (aPerkCarriesTheWard(thePerk, ROWS['arrow-proof'].carriedAs.ward) ? 'archery' : null),
  // he shrugs off spells
  'spell-resistance': (thePerk) =>
    aPerkCarriesTheWard(thePerk, ROWS['spell-resistance'].carriedAs.ward) ? 'spell' : null,
} satisfies Partial<Record<GuardianPerkSlug, AGuardiansPerks["a guardian's perks: what his card turns"]>>;

export const A_GUARDIANS_GRADES_CAP_BESIDE_HIS_OWN = {
  // His grade's cap merged after his perks (the merge keeps the looser of two caps: the grade's figure is a floor on
  // his toughness, not a ceiling on it), then a perk's tighter cap (Elder Titan, Kraken: 15%) kept, never loosened by
  // the grade's. His own is read before the merge.
  'a-hit-cap': ({ theCapOfHisGrade, theWardsHisPerksGaveHim }) => {
    const hisOwnCap = Number(theWardsHisPerksGaveHim?.cap) || 0;
    if (!(theCapOfHisGrade > 0)) return null;
    return {
      theWardHisGradeAdds: { ward: ROWS['a-hit-cap'].carriedAs.ward, pct: theCapOfHisGrade },
      whatHisOwnTighterCapKeeps: hisOwnCap > 0 && hisOwnCap < theCapOfHisGrade ? { cap: hisOwnCap } : null,
    };
  },
} satisfies Partial<Record<GuardianPerkSlug, AGuardiansPerks["a guardian's perks: his grade's cap beside his own"]>>;
