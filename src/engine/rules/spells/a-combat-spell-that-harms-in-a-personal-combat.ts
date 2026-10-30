// The combat spells that harm, at the stage "personalCombat: a combat spell takes hold" (plan P1-19's spells family, row
// P1-19w): what Lightning Bolt, Fireball, Holy Symbol, Spiritwrack, Psychic Blast, Telekinetic Storm and Hand of Death do
// once a fighter's cast takes hold, each with its numbers from the content's row (src/content/spell-effects-their-
// names-numbers-and-words.ts). Each returns its steps, in order; the resolver (pcCastCombatSpell, src/engine/personal-
// combat/combat-spells-and-guardian-abilities.ts) draws where it drew (Lightning Bolt's damage, Hand of Death's chance),
// applies each step with the functions it called (pcTakeHit, pcPushDot, pcLandStun) and writes its line. Until P1-19w
// they were cases of pcCastCombatSpell's switch over the spell's name, with their numbers in constants above it.
import {
  SPELL_EFFECTS_THE_REGISTRY_HOLDS as ROWS,
  type SpellSlug,
} from '../../../content/spell-effects-their-names-numbers-and-words.ts';
import type { AStepOfACombatSpell, TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type ACombatSpellTakesHold = TheStagesOfEachHookPoint['personalCombat']['a combat spell takes hold'];

const LIGHTNING_BOLTS_IN_COMBAT = ROWS['lightning-bolt'].combat;
const FIREBALLS_IN_COMBAT = ROWS.fireball.combat;
const HOLY_SYMBOLS_IN_COMBAT = ROWS['holy-symbol'].combat;
const SPIRITWRACKS_IN_COMBAT = ROWS.spiritwrack.combat;
const PSYCHIC_BLASTS_IN_COMBAT = ROWS['psychic-blast'].combat;
const TELEKINETIC_STORMS_IN_COMBAT = ROWS['telekinetic-storm'].combat;
const HANDS_OF_DEATH_IN_COMBAT = ROWS['hand-of-death'].combat;
/** The chance a guardian shrugs Spiritwrack off a round after the first, by its grade (read by any grade's name: a
 *  grade not here never does). */
const SPIRITWRACK_IS_SHRUGGED_OFF_BY_GRADE: Readonly<Partial<Record<string, number>>> = {
  Powerful: SPIRITWRACKS_IN_COMBAT.theChanceAPowerfulGuardianShrugsItOff.value,
  Legendary: SPIRITWRACKS_IN_COMBAT.theChanceALegendaryGuardianShrugsItOff.value,
};

export const A_COMBAT_SPELL_THAT_HARMS_TAKES_HOLD = {
  // 1–3 damage a level (2026-10-14, Toby item 9; was 2–4), each level's drawn: at least one level.
  'lightning-bolt': (facts): readonly AStepOfACombatSpell[] => [
    {
      kind: 'a hit',
      theDamage: {
        theDice: Math.max(1, facts.theLevelCountedTo5),
        eachFrom: LIGHTNING_BOLTS_IN_COMBAT.theLeastDamageALevel.value,
        eachTo: LIGHTNING_BOLTS_IN_COMBAT.theMostDamageALevel.value,
      },
      theCastersRecoil: null,
      theLine: { kind: "the caster's lightning bolt arcs into the target" },
    },
  ],
  // The burn reads the caster (2026-09-15; 2026-10-14, batch item 6: 10% + 2% a level, 12% at Elemental 1, 20% at 5).
  // A spell ward cuts the burn as it cuts any spell's harm: the burn ticks outside pcTakeHit, so the ward is applied here.
  fireball: (facts): readonly AStepOfACombatSpell[] => {
    const theShare =
      (FIREBALLS_IN_COMBAT.theShareOfMaximumHpItBurnsARound.value +
        FIREBALLS_IN_COMBAT.theShareMoreALevel.value * facts.theLevelCountedTo5) *
      facts.theWeaknessFactor *
      (1 - facts.theTarget.theShareHisWardsCutABurnBy / 100);
    return [
      {
        kind: 'a burn',
        theDamage: Math.max(1, Math.round((facts.theTarget.maxHp * theShare) / 100)),
        theRounds: FIREBALLS_IN_COMBAT.theRoundsItBurns.value,
        theLabel: 'Fireball burns',
        theShareOfMaximumHp: theShare,
        theWardsCut: facts.theTarget.theShareHisWardsCutABurnBy,
        theLine: 'a fireball engulfs the target and will burn',
      },
    ];
  },
  // A ward, not a weapon (2026-09-15), that sustains the one who raises it and burns as well as blinds; the unclean are
  // told by their kind, every undead and every fiend, and bitten ×1.5 (2026-10-14, batch item 5). The cut to the aim is
  // doubled against a guardian weak to White; the burn is a harm, doubled once, in pcTakeHit.
  'holy-symbol': (facts): readonly AStepOfACombatSpell[] => {
    const againstTheUnclean = facts.theTarget.isUndeadOrAFiend;
    const theMultiplier = againstTheUnclean ? HOLY_SYMBOLS_IN_COMBAT.theMultiplierAgainstTheUndeadAndFiends.value : 1;
    return [
      {
        kind: "a cut to the target's aim",
        theCut: Math.round(
          facts.theLevelCountedTo5 *
            HOLY_SYMBOLS_IN_COMBAT.theCutToTheTargetsAimALevel.value *
            theMultiplier *
            facts.theWeaknessFactor,
        ),
        againstTheUnclean,
      },
      {
        kind: "the caster's heal",
        theHp: Math.max(
          1,
          Math.round(
            (facts.theCastersMaximumHp * HOLY_SYMBOLS_IN_COMBAT.theShareOfHisOwnMaximumHpTheCasterRecovers.value) / 100,
          ),
        ),
        theCastersMaximumHp: facts.theCastersMaximumHp,
      },
      {
        kind: 'a hit',
        theDamage: Math.max(
          1,
          Math.round(
            (facts.theTarget.maxHp * HOLY_SYMBOLS_IN_COMBAT.theShareOfMaximumHpItSears.value * theMultiplier) / 100,
          ),
        ),
        theCastersRecoil: null,
        theLine: { kind: "the holy light's damage", againstTheUnclean },
      },
    ];
  },
  // Silenced, and his melee halved, for 1 round and 1 more for every two levels (2026-09-26, Toby item 3), the level
  // counted to 5 (2026-10-15, Toby, D5), so at most 3; against a guardian weak to White the cast already takes hold at
  // 95 and the binding runs one round longer, up to 4, instead of doubling. A Powerful or Legendary guardian may shrug
  // it off at the start of each round after the first in which it held.
  spiritwrack: (facts): readonly AStepOfACombatSpell[] => {
    let theRounds = Math.min(
      SPIRITWRACKS_IN_COMBAT.theMostRounds.value,
      SPIRITWRACKS_IN_COMBAT.theRoundsItSilences.value +
        Math.floor(Math.max(1, facts.theLevelCountedTo5) / SPIRITWRACKS_IN_COMBAT.theLevelsForEachRoundMore.value),
    );
    const longer = SPIRITWRACKS_IN_COMBAT.theRoundsLongerAgainstAGuardianWeakToWhite.value;
    if (facts.theTargetIsWeakToTheSchool)
      theRounds = Math.min(SPIRITWRACKS_IN_COMBAT.theMostRounds.value + longer, theRounds + longer);
    const grade = facts.theTarget.theGuardiansGrade;
    return [
      {
        kind: 'a silence',
        theRounds,
        theChanceItIsShruggedOff: grade === null ? 0 : (SPIRITWRACK_IS_SHRUGGED_OFF_BY_GRADE[grade] ?? 0) || 0,
      },
    ];
  },
  // Helpless for 1 round and 1 more for every two levels (1 at Psychic 1, 3 at Psychic 5), doubled against a guardian
  // weak to Psychic; the Dreamstone's round comes after the doubling (2026-10-15, Toby, D4: the items' registry).
  'psychic-blast': (facts): readonly AStepOfACombatSpell[] => [
    {
      kind: 'a stun',
      theRounds:
        (PSYCHIC_BLASTS_IN_COMBAT.theRoundsItStuns.value +
          Math.floor(facts.theLevelCountedTo5 / PSYCHIC_BLASTS_IN_COMBAT.theLevelsForEachRoundMore.value)) *
          facts.theWeaknessFactor +
        facts.whatTheCastersItemsChange().theRoundsHisPsychicBlastStunsLonger,
      what: 'the blast',
      theLine: "psychic blast sears the target's mind",
    },
  ],
  // 12% of the target's maximum HP and 3% a level (27% at Psychic 5, half that from an apprentice); the caster takes a
  // quarter of it back as it lands.
  'telekinetic-storm': (facts): readonly AStepOfACombatSpell[] => {
    const theDamage = Math.max(
      1,
      Math.round(
        (facts.theTarget.maxHp *
          (TELEKINETIC_STORMS_IN_COMBAT.theShareOfMaximumHpItDeals.value +
            TELEKINETIC_STORMS_IN_COMBAT.theShareMoreALevel.value * facts.theLevelCountedTo5)) /
          100,
      ),
    );
    const self = Math.max(0, Math.round(theDamage * TELEKINETIC_STORMS_IN_COMBAT.theShareTheCasterTakesBack.value));
    return [
      {
        kind: 'a hit',
        theDamage,
        theCastersRecoil: self,
        theLine: { kind: 'a telekinetic storm rips the target', self },
      },
    ];
  },
  // A grip of 10 in 100 a level, at most 60 so that no item can push it to a near certainty, to bite for 40% of the
  // target's maximum HP (a Death's Finger Ring's ×1.1, read once it holds: the items' registry).
  'hand-of-death': (facts): readonly AStepOfACombatSpell[] => [
    {
      kind: 'a chance',
      theChance: Math.min(
        HANDS_OF_DEATH_IN_COMBAT.theMostChance.value,
        facts.theLevelCountedTo5 * HANDS_OF_DEATH_IN_COMBAT.theChanceALevel.value * facts.theWeaknessFactor,
      ),
      ifItHolds: () => [
        {
          kind: 'a hit',
          theDamage: Math.max(
            1,
            Math.round(
              ((facts.theTarget.maxHp * HANDS_OF_DEATH_IN_COMBAT.theShareOfMaximumHpItStrikesFor.value) / 100) *
                facts.whatTheCastersItemsChange().theMultiplierOfHisHandOfDeathsBite,
            ),
          ),
          theCastersRecoil: null,
          theLine: {
            kind: "the hand of death claims part of the target's health",
            handOfDeathBitePct: HANDS_OF_DEATH_IN_COMBAT.theShareOfMaximumHpItStrikesFor.value,
          },
        },
      ],
      theLineIfItFails: "the caster's hand of death fails",
    },
  ],
} satisfies Partial<Record<SpellSlug, ACombatSpellTakesHold>>;
