// The other combat spells, at the stages of "personalCombat" (plan P1-19's spells family, row P1-19x): what Mirror
// Image, Invisibility, Curse, Control Undead and Charm do once a fighter's cast takes hold ("a combat spell takes
// hold"), what Invisibility adds to a thief's steal ("a fighter's spell adds to his steal") and the chance a Mirror
// Image is seen through ("a mirror image is disbelieved"), each with its numbers from the content's row
// (src/content/spell-effects-their-names-numbers-and-words.ts). Each returns its steps, in order, or its chance; the
// resolvers (pcCastCombatSpell, pcAct, resolvePersonalCombat, in src/engine/personal-combat/) draw where they drew (a
// will against a Charm, a victim seeing through the image), apply each step and write its line. Until P1-19x they were
// cases of pcCastCombatSpell's switch over the spell's name, a check of Invisibility by name in pcAct, and the disbelief
// written in resolvePersonalCombat, with their numbers in constants and in the code.
import { KC_MAGIC_SCHOOLS } from '../../../content/kingdoms-call-data.ts';
import {
  SPELL_EFFECTS_THE_REGISTRY_HOLDS as ROWS,
  type SpellSlug,
} from '../../../content/spell-effects-their-names-numbers-and-words.ts';
import type {
  AMagicSchool,
  AStepOfACombatSpell,
  TheStagesOfEachHookPoint,
} from '../the-registry-of-content-effects.ts';

type TheStages = TheStagesOfEachHookPoint['personalCombat'];

const MIRROR_IMAGES_IN_COMBAT = ROWS['mirror-image'].combat;
const INVISIBILITYS_IN_COMBAT = ROWS.invisibility.combat;
const CURSES_IN_COMBAT = ROWS.curse.combat;

export const A_COMBAT_SPELL_THAT_HINDERS_TAKES_HOLD = {
  // MIRROR IMAGE, REBUILT. Measured, it was the worst thing a hero could do with an action: a fully trained Illusory
  // adept beat a Lich Acolyte 100% of the time casting nothing at all, and 94.3% casting this. Two faults. The phantom
  // was a FULL-strength copy of the victim, so shattering it took as long as winning the real fight; and the caster
  // "concentrated", meaning they stood still for every round the illusion lasted. An illusion now carries a share of the
  // victim's health, fades of its own accord after a few rounds, and — the change that matters — the caster is free to
  // act while the victim's attention is on it. Casting it again while an illusion fights dissipates both images.
  'mirror-image': (facts): readonly AStepOfACombatSpell[] => {
    if (facts.theFightsMirrorImage === 'there is no fight')
      return [{ kind: 'a line', theLine: { kind: 'the caster conjures a mirror image' } }];
    if (facts.theFightsMirrorImage === 'an image fights')
      return [
        { kind: 'a line', theLine: { kind: 'the caster weaves a second mirror image' } },
        { kind: 'the images vanish' },
      ];
    // The phantom fights by the OPPONENT's own plan from the very start (spells, archery and tactics, not just melee),
    // with its own Mirror Image casts stripped from it (an illusion casting illusions is meaningless and would only end
    // its own duel).
    let theImagesPlan = (facts.theTarget.hisPlan ?? ['ME']).slice().filter((t) => !/mirror\s*image/i.test(t));
    if (!theImagesPlan.length) theImagesPlan = ['ME'];
    return [
      {
        kind: 'an image conjured',
        theImagesHp: Math.max(
          1,
          Math.round((facts.theTarget.hp * MIRROR_IMAGES_IN_COMBAT.theShareOfHisHealthTheImageCarries.value) / 100),
        ),
        theImagesPlan,
        theRounds: MIRROR_IMAGES_IN_COMBAT.theRoundsItLasts.value,
      },
      { kind: 'a line', theLine: { kind: 'the caster conjures a phantom of the target' } },
    ];
  },
  // 10% + 4% a level (14% at Illusory 1, 30% at Illusory 5) instead of a flat 25 at every level. 2026-09-16: the line
  // printed a hard-coded "−25%" — the flat figure this spell had BEFORE the 2026-09-15 rebalance — while the code
  // applied 10 + 4/level. A player reading their own report was told the wrong number at every level. Quote the figure
  // actually applied.
  invisibility: (facts): readonly AStepOfACombatSpell[] => {
    const invPct =
      INVISIBILITYS_IN_COMBAT.theCutToHisFoesAim.value +
      INVISIBILITYS_IN_COMBAT.theCutMoreALevel.value * facts.theLevelCountedTo5;
    return [
      { kind: "a cut to the foes' aim at the caster", theCut: invPct },
      { kind: 'a flight bonus', theShareAdded: INVISIBILITYS_IN_COMBAT.theFlightAdded.value },
      { kind: 'a line', theLine: { kind: 'the caster fades from sight', invPct } },
    ];
  },
  // Halve (round down) the target's best combat ability for the duration of the fight.
  curse: (facts): readonly AStepOfACombatSpell[] => {
    const target = facts.theTarget;
    const bestSchool = KC_MAGIC_SCHOOLS.reduce<AMagicSchool>(
      (b, s) => ((target.hisSchools[s] || 0) > (target.hisSchools[b] || 0) ? s : b),
      'white',
    );
    const cands: [key: 'melee' | 'archery' | 'magic', level: number][] = [
      ['melee', target.melee],
      ['archery', target.archery],
      ['magic', target.hisSchools[bestSchool] || 0],
    ];
    cands.sort((a, b) => b[1] - a[1]);
    const theBest = cands[0]; // one of three, made sure above
    if (theBest === undefined) throw new TypeError('undefined is not iterable');
    const [bestKey, bestVal] = theBest;
    if (!(bestVal > 0)) return [{ kind: 'a line', theLine: { kind: "the caster's curse finds no ability" } }];
    const divisor = CURSES_IN_COMBAT.theDivisorOfHisBestSkill.value;
    const theLevelLeft =
      bestKey === 'melee'
        ? Math.floor(target.melee / divisor)
        : bestKey === 'archery'
          ? Math.floor(target.archery / divisor)
          : Math.floor(target.hisSchools[bestSchool] / divisor);
    return [
      { kind: 'a skill halved', theSkill: bestKey, theSchool: bestSchool, theLevelLeft },
      {
        kind: 'a line',
        theLine: { kind: "the caster's curse withers the target", bestKey, bestSchool, bestAbilityLevel: theLevelLeft },
      },
    ];
  },
  // An undead foe is gripped for a round a level, the level counted to 5 (the line printed the RAW level while the grip
  // applied the capped one: a Necromancy 8 caster was told "8 rounds" and got 5).
  'control-undead': (facts): readonly AStepOfACombatSpell[] =>
    facts.theTarget.isUndead
      ? [
          {
            kind: 'a stun',
            theRounds: Math.max(1, facts.theLevelCountedTo5),
            what: "the caster's grip",
            theLine: 'the caster seizes the undead target',
          },
        ]
      : [{ kind: 'a line', theLine: { kind: 'control undead has no hold over the living' } }],
  // A king's will is beyond a Charm — no effect whatsoever (matches the action-phase rule) — and so is a mind swayed
  // only last season (the same immunity the action-phase Charm honours); a mind swayed before resists any later Charm,
  // combat casts included (30% per past charm, cumulative). Else the caster's next flight is at double the chance.
  charm: (facts): readonly AStepOfACombatSpell[] => {
    const theTarget = facts.theTarget.asACharmReadsHim;
    if (theTarget.isACrownedHero)
      return [{ kind: 'a line', theLine: { kind: "the caster's charm washes over a crowned will" } }];
    if (theTarget.wasSwayedThisTurn)
      return [{ kind: 'a line', theLine: { kind: "the caster's charm slides off a mind lately swayed" } }];
    const charmed: readonly AStepOfACombatSpell[] = [
      { kind: "the caster's flight doubled" },
      { kind: 'a line', theLine: { kind: "the caster charms the target's wits" } },
    ];
    return theTarget.hisWill > 0
      ? [{ kind: 'a will that may throw it off', theWill: theTarget.hisWill, ifItDoesNot: charmed }]
      : charmed;
  },
} satisfies Partial<Record<SpellSlug, TheStages['a combat spell takes hold']>>;

/** Invisibility's +15% to a thief's steal in the fight he cast it in. */
export const A_FIGHTERS_SPELL_ADDS_TO_HIS_STEAL = {
  invisibility: () => INVISIBILITYS_IN_COMBAT.theStealAdded.value,
} satisfies Partial<Record<SpellSlug, TheStages["a fighter's spell adds to his steal"]>>;

/** The chance a Mirror Image's victim sees through it: a hero 4% for each of his skill levels together; a guardian,
 *  tougher, 5% and 3% for each level of his Melee; harder against a caster with a Mirror Shard (the items' registry);
 *  never below 2% nor above 90%. */
export const A_MIRROR_IMAGE_IS_DISBELIEVED = {
  'mirror-image': (facts) => {
    let disbelief: number;
    if (facts.theVictimsSkillLevels !== null) {
      disbelief =
        MIRROR_IMAGES_IN_COMBAT.theChanceAHeroSeesThroughItForEachSkillLevel.value *
        facts.theVictimsSkillLevels.reduce<number>((s, v) => s + ((v ?? 0) || 0), 0);
    } else {
      disbelief =
        MIRROR_IMAGES_IN_COMBAT.theChanceAGuardianSeesThroughIt.value +
        MIRROR_IMAGES_IN_COMBAT.theChanceMoreForEachLevelOfAGuardiansMelee.value * (facts.theVictimsMelee || 0);
    }
    disbelief *= facts.whatTheCastersItemsChange().theMultiplierOfTheChanceHisMirrorImageIsSeenThrough;
    return Math.max(
      MIRROR_IMAGES_IN_COMBAT.theLeastChanceItIsSeenThrough.value,
      Math.min(MIRROR_IMAGES_IN_COMBAT.theMostChanceItIsSeenThrough.value, disbelief),
    );
  },
} satisfies Partial<Record<SpellSlug, TheStages['a mirror image is disbelieved']>>;
