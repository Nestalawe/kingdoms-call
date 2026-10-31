import { kcRng } from '../rng.ts';
import { combatSpellsAllowedPerSchoolEachFight } from '../rules-on-plain-values/spells-each-school-allows-a-turn-and-a-fight.ts';
import { SKILL_LABELS } from '../army-tables.ts';
import { activeItems, hasItemBase } from '../items/equipment.ts';
import { PC_SPELL_SCHOOL_MAP, PC_WEAK_MULT, pcDeferEffect, pcLearnWeakness, pcPushDot } from './helpers.ts';
import { d100, rng } from '../dice-and-army-names.ts';
import { dispFloor } from '../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { pcFoeCat, skillLevel } from '../titles/perks.ts';
import { SPELL_CAST_BASE, magicL8CastBonus } from '../chances-and-lair-grades.ts';
import { whatARealmsDiscoveriesAddToACastersChance } from '../rules/the-registry-of-discovery-effects.ts';
import { telSpell } from '../turn/log-line-helpers.ts';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { pcNewStatus } from './speed-encounter-plans-and-combatants.ts';
import {
  asItsGuardReadsIt,
  pcCourageChance,
  pcHitSkill,
  pcLandStun,
  pcMeleeDamage,
  pcStunTurned,
  pcTakeHit,
} from './to-hit-wounds-stuns-and-courage.ts';
import { pcCombatXP } from './melee-flight-and-archery.ts';
import { narrate } from '../turn/events-and-their-audiences.ts';
import { aFightersWardAsTheLineTellsIt } from './the-facts-a-personal-combats-lines-record.ts';
import {
  aFightersWardsRefuseAStunOrATerror,
  theShareAFightersWardsCutASpellsBurnBy,
  whatAHerosItemsChangeInHisCombatSpells,
} from '../rules/the-registry-of-magic-item-effects.ts';
import { whatACombatSpellDoesAsItTakesHold } from '../rules/the-registry-of-spell-effects.ts';
import type {
  AStepOfACombatSpell,
  TheLineOfACombatSpell,
  TheLineOfACombatSpellsHit,
} from '../rules/the-registry-of-content-effects.ts';
import type { Character } from '../../schemas/saved-game-state.ts';
import type { TurnContext } from '../turn/context.ts';
import type { NarrativeLine } from '../turn/events-and-their-audiences.ts';
import type { AFighterInAPersonalCombat, AFightersSchools, AGuardiansSpecial } from './helpers.ts';

// Its types (plan P1-10b16): each parameter typed as wide as the body's guards (plan P1-10's Decision 2), so each guard
// stays; a fighter is AFighterInAPersonalCombat (helpers.ts), and a value the code guards here but reads unguarded
// elsewhere is read through asItsGuardReadsIt (to-hit-wounds-stuns-and-courage.ts).
/** A Mirror Image in a fight: who cast it, on whom, the phantom that fights the victim and the rounds it has left. */
export interface AMirrorImageInAFight {
  readonly caster: AFighterInAPersonalCombat;
  readonly victim: AFighterInAPersonalCombat;
  readonly phantasm: AFighterInAPersonalCombat;
  life: number;
}
/** The fight's state as a spell reads and writes it: the Mirror Image (none in a forecast's bare cast). */
interface TheFightAsASpellReadsIt {
  mirror?: AMirrorImageInAFight | null | undefined;
}
/** The fight's state as a guardian's special writes it: who fled. */
interface TheFightAsASpecialWritesIt {
  fledBy?: AFighterInAPersonalCombat | null | undefined;
}
/** A guardian's special as it is used: an older save's creature may still carry a damage range (`dmg`) instead of a
 *  weight. */
type AGuardiansSpecialAsItIsUsed = AGuardiansSpecial & { readonly dmg?: readonly number[] | null | undefined };
/** A fighter's hero as a Charm reads him: whether he is a king, the turn he was last charmed, his will against it. */
type AHeroAsACharmReadsHim = object & Partial<Pick<Character, 'isKing' | '_charmImmuneTurn' | '_charmResist'>>;
/** A fighter's hero or guardian as his skills and items are asked about (a guardian has neither). */
type AHeroOrGuardianAsHisSkillsAndItemsAreAsked = object &
  NonNullable<Parameters<typeof skillLevel>[0]> &
  NonNullable<Parameters<typeof hasItemBase>[0]>;
/** A damage range as the dice read it (`dmg[0]`, `dmg[1]`): an element missing is NaN to the dice, as `undefined` was
 *  (as tactics-combat-items-and-actions.ts reads an item's). */
function aDamageRangeAsTheDiceReadIt(range: readonly number[] | null | undefined): [low: number, high: number] {
  if (!range) throw new TypeError(`Cannot read properties of ${String(range)} (reading '0')`);
  return [Number(range[0]), Number(range[1])];
}

// ── PERSONAL COMBAT: COMBAT SPELLS AND GUARDIAN ABILITIES (plan P1-08e: lifted out of resolveTurn) ────
// A spell cast in a personal fight (pcCastCombatSpell, with the spell-balance figures above it) and a guardian's
// special ability (pcMonsterSpecial). Both take the turn's context first (src/engine/turn/context.ts).
// --- Combat spell dispatch (per-school CSV effects slot in here) ------------- Returns true if
// the spell resolved (successfully cast), false if it fizzled/was invalid.
// NOTE: school-by-school CSV combat effects will be implemented here. For now it reproduces the
// previous encounter behaviour so nothing regresses while schools are migrated.
// ── PERSONAL-COMBAT SPELL BALANCE ────
// Measured across the whole bestiary at hero level 6, the five schools were not close: Elemental
// 80%, Necromancy 78%, Illusory 74%, Psychic 72%, White 66% — against 72% for a plain Blade with
// no magic at all, which is to say White was worse than carrying nothing. Two faults ran through
// the set. First, the best spells did not read the caster: Fireball, Psychic Blast, Telekinetic
// Storm and Invisibility were identical at school level 1 and level 5, so a dabbler got a
// master's spell. Second, White had no way to convert an action into an advantage at all. Each
// spell keeps what it does; the numbers are what changed. Each spell's numbers, and what it does once it takes hold,
// are the spells' registry's (plans P1-19w and P1-19x: src/content/spell-effects-their-names-numbers-and-words.ts and
// src/engine/rules/spells/, the spells that harm and the others).
export const PC_CAST_BASE = SPELL_CAST_BASE; // personal-combat casting is 30 + school level × 10 · 2026-09-11: every path now shares SPELL_CAST_BASE
export function pcCastCombatSpell(
  turnContext: TurnContext,
  caster: AFighterInAPersonalCombat,
  target: AFighterInAPersonalCombat,
  spellName: string | null | undefined,
  narrative: NarrativeLine[],
  state: TheFightAsASpellReadsIt | null | undefined,
): boolean {
  const { G } = turnContext;
  // one shared table (pcTakeHit reads it too), read by any spell's name
  const SPELL_SCHOOL: Readonly<Partial<Record<string, keyof AFightersSchools>>> = PC_SPELL_SCHOOL_MAP;
  // a spell of no name has no school: the table read it as the key "null" or "undefined", which it doesn't hold
  if (spellName == null) return false;
  const school = SPELL_SCHOOL[spellName];
  if (!school) {
    return false;
  }
  const lvl = caster.school[school] || 0;
  const lvlEff = Math.min(lvl, 5); // every EFFECT scales with caster level capped at 5 (cast chance still uses the full level)
  if (lvl < 1) {
    narrate(narrative, {
      kind: 'the caster cannot cast a spell without its skill',
      casterName: caster.name,
      spellName,
      schoolLabel: SKILL_LABELS[school] || school,
    });
    return false;
  }
  // Per-combat spell limits: same spell once; per school 1 at Lv1, 2 at Lv2+.
  const limit = combatSpellsAllowedPerSchoolEachFight(lvl);
  if (caster.castSpells.includes(spellName)) {
    narrate(narrative, { kind: "the caster's spell already cast this combat", casterName: caster.name, spellName });
    return false;
  }
  if ((caster.castSchool[school] ?? 0) >= limit) {
    narrate(narrative, {
      kind: "the caster's spell limit reached this combat",
      casterName: caster.name,
      schoolLabel: SKILL_LABELS[school] || school,
    });
    return false;
  }
  // ── WEAKNESS ── a guardian open to this school cannot shrug the weave off: the cast always
  // takes hold (95%), and `wx` doubles every NON-damaging effect below. Damage itself is doubled
  // once, in pcTakeHit — never here, or it would double twice.
  const targetAsGuarded = asItsGuardReadsIt(target);
  const theWeaknessOpenToTheSchool =
    targetAsGuarded?.kind === 'monster' &&
    targetAsGuarded.weak?.kind === 'school' &&
    targetAsGuarded.weak.key === school
      ? targetAsGuarded.weak
      : null;
  const _wkSch = theWeaknessOpenToTheSchool !== null;
  // the caster's hero or guardian as his skills and items are asked about (a guardian has neither): the same object
  const theCastersHeroOrGuardian: AHeroOrGuardianAsHisSkillsAndItemsAreAsked = caster.ref;
  const theCastersHeroOrGuardianAsGuarded = asItsGuardReadsIt(theCastersHeroOrGuardian);
  const wx = _wkSch ? PC_WEAK_MULT : 1;
  const _castBase = _wkSch
    ? 95
    : Math.min(
        95,
        PC_CAST_BASE +
          lvl * 10 +
          magicL8CastBonus(theCastersHeroOrGuardian) +
          (caster.player != null
            ? whatARealmsDiscoveriesAddToACastersChance(G.players[caster.player], {
                theSchool: school,
                whereHeCasts: 'duel',
              })
            : 0),
      ); // sd27 Arcane Codex + cast discoveries now apply in personal combat too (were pre-battle/action-phase only) · item 2: base 30 in PERSONAL combat (action/battle phases stay 20)
  // ── SCHOOL WARD (2026-10-14, batch item 7) ── a guardian's ward against this school takes its
  // points off the (already capped) cast chance; never below 5. A guardian is never warded against
  // the school it is weak to.
  const _sw = (_wkSch ? 0 : (targetAsGuarded?.arm?.schoolWard?.[school] ?? 0)) || 0;
  const castChance = _sw > 0 ? Math.max(5, _castBase - _sw) : _castBase;
  // narrate the cast as a deliberate ATTEMPT, so both outcomes read clearly — the reader sees the
  // character reach for the spell, then whether the weave holds or collapses.
  // show the roll alongside the chance, and say what the chance IS (a cast, not a "hold").
  // 2026-09-10 item 1: use the canonical d100 (1–100, success on roll<=chance) so a roll equal to
  // the chance succeeds, matching every other percentage check in the engine.
  const _castRoll = d100();
  telSpell(turnContext, caster.ref, spellName, school, lvl, castChance, _castRoll, 'duel');
  narrate(narrative, {
    kind: "the caster calls on a school's arts, weaving a spell",
    casterName: caster.name,
    school,
    spellName,
    castChance,
    schoolWard: _sw,
    targetsWard: aFightersWardAsTheLineTellsIt(target, 'schoolWard'),
    castRoll: _castRoll,
  });
  if (_castRoll > castChance) {
    narrate(narrative, { kind: 'but the spell guts and fizzles' });
    return false;
  }
  caster.castSpells.push(spellName);
  caster.castSchool[school] = (caster.castSchool[school] ?? 0) + 1;
  if (_wkSch) {
    narrate(narrative, {
      kind: "the target is open to the school's arts",
      targetName: target.name,
      school,
      targetWeakName: theWeaknessOpenToTheSchool.name,
    });
    if (caster.player != null && pcLearnWeakness(G, caster.player, target.name))
      narrate(narrative, {
        kind: "the caster marks the target's weakness well",
        casterName: caster.name,
        targetWeakDesc: theWeaknessOpenToTheSchool.desc,
        targetName: target.name,
      });
  }

  // ----- effects: the spells' registry's (plans P1-19w and P1-19x) -----
  // the target's hero as a Charm reads him (a guardian has none of these): the same object, guarded as before
  const theTargetsHero = targetAsGuarded ? asItsGuardReadsIt<AHeroAsACharmReadsHim>(targetAsGuarded.ref) : null;
  const theTargetIsAHero = targetAsGuarded?.kind === 'character';
  const theSteps = whatACombatSpellDoesAsItTakesHold(spellName, {
    theLevelCountedTo5: lvlEff,
    theWeaknessFactor: wx,
    theTargetIsWeakToTheSchool: _wkSch,
    theCastersMaximumHp: caster.maxHp || 20,
    theTarget: {
      maxHp: target.maxHp,
      isUndeadOrAFiend: target.isUndead || pcFoeCat(target) === 'fiend',
      theGuardiansGrade: target.kind === 'monster' ? String(target.power) : null,
      theShareHisWardsCutABurnBy: theShareAFightersWardsCutASpellsBurnBy(target.arm), // the ward's effect in the items' registry (plan P1-19r)
      hp: target.hp,
      isUndead: target.isUndead,
      melee: target.melee,
      archery: target.archery,
      hisSchools: target.school,
      hisPlan: asItsGuardReadsIt(target.tactics),
      asACharmReadsHim: {
        isACrownedHero: theTargetIsAHero && !!theTargetsHero?.isKing,
        wasSwayedThisTurn: theTargetIsAHero && theTargetsHero?._charmImmuneTurn === G.turn,
        hisWill: (theTargetIsAHero ? theTargetsHero?._charmResist : undefined) ?? 0,
      },
    },
    theFightsMirrorImage: !state ? 'there is no fight' : state.mirror ? 'an image fights' : 'no image fights',
    // the items' registry (plan P1-19w): a guardian's hoard or a hero's active items, as hasItemBase read them
    whatTheCastersItemsChange: () =>
      whatAHerosItemsChangeInHisCombatSpells(activeItems(theCastersHeroOrGuardianAsGuarded)),
  });
  if (theSteps) applyTheStepsOfACombatSpell(turnContext, caster, target, spellName, theSteps, narrative, state);
  else narrate(narrative, { kind: 'the caster casts a spell', casterName: caster.name, spellName });
  // small skill-up chance — pass narrative so the "X rises to level N" line appears at the end of
  // the encounter report, not emitted ahead of it at the top of the phase.
  if (caster.kind === 'character' && theCastersHeroOrGuardianAsGuarded) {
    // 2026-09-21 (found with Toby's "Illusory 3 … rises to level 1"): after the roll this used to
    // write the RAW trained level back into the fighter's school — `ref.skills[school]||…` — so a
    // mage casting on item bonuses (Illusory 0 + a +3 diadem) dropped to Illusory 1 for the rest of
    // the fight the moment the skill rose, and a trained 6+ mage jumped past the level-5 cap. The
    // level in play is re-read exactly as pcCharCombatant built it, and only when it actually rose.
    const _lvB = skillLevel(theCastersHeroOrGuardianAsGuarded, school);
    pcCombatXP(turnContext, caster, school, narrative); // 2026-09-29: per successful cast, until the first success
    if (skillLevel(theCastersHeroOrGuardianAsGuarded, school) > _lvB)
      caster.school[school] = Math.max(caster.school[school] || 0, effStat(turnContext, caster.ref, school));
  }
  return true;
}

/** What a combat spell does, step by step, as the spells' registry returns it (plans P1-19w and P1-19x): each step
 *  applied with the function the spell's case called, in order, and its line written with the facts its kind records
 *  (each line's fields in the order the case wrote them). A chance, or a will against a Charm, is rolled here, where
 *  the case rolled it. */
function applyTheStepsOfACombatSpell(
  turnContext: TurnContext,
  caster: AFighterInAPersonalCombat,
  target: AFighterInAPersonalCombat,
  spellName: string,
  theSteps: readonly AStepOfACombatSpell[],
  narrative: NarrativeLine[],
  state: TheFightAsASpellReadsIt | null | undefined,
): void {
  for (const step of theSteps) {
    switch (step.kind) {
      case 'a hit': {
        let d = 0;
        if (typeof step.theDamage === 'number') d = step.theDamage;
        else for (let i = 0; i < step.theDamage.theDice; i++) d += rng(step.theDamage.eachFrom, step.theDamage.eachTo);
        const dealt = pcTakeHit(turnContext, target, d, narrative, caster.name, spellName);
        if (step.theCastersRecoil !== null) caster.hp -= step.theCastersRecoil;
        if (dealt) writeTheLineOfACombatSpellsHit(caster, target, step.theLine, dealt, narrative);
        break;
      }
      case 'a burn': {
        const theBurn = pcPushDot(target, step.theDamage, step.theRounds, step.theSource);
        narrate(narrative, {
          kind: step.theLine,
          targetName: target.name,
          fbPct: dispFloor(step.theShareOfMaximumHp),
          burnRounds: theBurn ? theBurn.rounds : step.theRounds,
          fbWard: step.theWardsCut,
        });
        break;
      }
      case 'a stun':
        if (
          pcLandStun(
            target,
            step.theRounds,
            narrative,
            step.theSource.kind === "a caster's grip"
              ? { kind: "a caster's grip", casterName: caster.name }
              : step.theSource,
          )
        ) {
          if (step.theLine === 'the caster seizes the undead target')
            narrate(narrative, {
              kind: step.theLine,
              casterName: caster.name,
              targetName: target.name,
              cuR: step.theRounds,
            });
          else narrate(narrative, { kind: step.theLine, targetName: target.name, stunN: step.theRounds });
        }
        break;
      case 'a silence':
        target.status.silenceRounds = Math.max(target.status.silenceRounds, step.theRounds);
        target.status.meleeHalvedRounds = Math.max(target.status.meleeHalvedRounds, step.theRounds);
        target.status._swShrugPct = step.theChanceItIsShruggedOff;
        narrate(narrative, {
          kind: 'the caster binds the target with spiritwrack',
          casterName: caster.name,
          targetName: target.name,
          swR: step.theRounds,
          shr: step.theChanceItIsShruggedOff,
          targetPower: target.power,
        });
        break;
      case "a cut to the target's aim":
        target.status.hitPenalty = (target.status.hitPenalty || 0) + step.theCut;
        narrate(narrative, {
          kind: 'the caster raises a holy symbol',
          casterName: caster.name,
          targetName: target.name,
          pen: step.theCut,
          againstTheUnclean: step.againstTheUnclean,
        });
        break;
      case "the caster's heal":
        if (caster.hp < step.theCastersMaximumHp) {
          const _h = Math.min(step.theHp, step.theCastersMaximumHp - caster.hp);
          caster.hp += _h;
          narrate(narrative, {
            kind: "the light closes the caster's hurts",
            casterName: caster.name,
            healed: _h,
            casterHp: dispFloor(caster.hp),
          });
        }
        break;
      case 'a chance':
        if (kcRng() * 100 < step.theChance)
          applyTheStepsOfACombatSpell(turnContext, caster, target, spellName, step.ifItHolds(), narrative, state);
        else
          narrate(narrative, {
            kind: step.theLineIfItFails,
            casterName: caster.name,
            handOfDeathChancePct: step.theChance,
          });
        break;
      case "a cut to the foes' aim at the caster":
        caster.status.toHitReduce = Math.max(Number(caster.status.toHitReduce) || 0, step.theCut);
        break;
      case 'a flight bonus':
        caster.status.fleeBonus = (caster.status.fleeBonus || 0) + step.theShareAdded;
        break;
      case "the caster's flight doubled":
        caster.status.fleeDoubled = true;
        break;
      case 'a skill halved':
        if (step.theSkill === 'melee') target.melee = step.theLevelLeft;
        else if (step.theSkill === 'archery') target.archery = step.theLevelLeft;
        else target.school[step.theSchool] = step.theLevelLeft;
        break;
      case 'an image conjured':
        // Conjure a phantom duplicate of the OPPONENT, with their characteristics at this moment: a FULL clone of the
        // mirrored combatant so it fights back exactly as they would, running the plan the spell gives it. It gets its
        // own fresh status, spell-limit trackers and plan pointer (tacIdx 0) so nothing bleeds back into the real
        // character. (A step the spell gives only in a fight.)
        if (state)
          state.mirror = {
            caster,
            victim: target,
            phantasm: {
              ...target,
              kind: 'phantasm',
              name: target.name + "'s mirror image",
              ref: target.ref,
              hp: step.theImagesHp,
              maxHp: step.theImagesHp,
              school: { ...target.school }, // a spread of none is no field, as a spread of {} was
              specials: (asItsGuardReadsIt(target.specials) ?? []).slice(),
              tactics: [...step.theImagesPlan],
              tacIdx: 0,
              planExhausted: false,
              neverFlees: true, // an illusion never runs
              castSpells: [],
              castSchool: {},
              status: pcNewStatus(),
            },
            life: step.theRounds,
          };
        break;
      case 'the images vanish':
        if (state) state.mirror = null; // a step the spell gives only while an image fights
        break;
      case 'a will that may throw it off':
        if (d100() <= step.theWill)
          narrate(narrative, {
            kind: "the caster's charm breaks against the target's will",
            casterName: caster.name,
            targetName: target.name,
            targetRefCharmResist: step.theWill,
          });
        else applyTheStepsOfACombatSpell(turnContext, caster, target, spellName, step.ifItDoesNot, narrative, state);
        break;
      case 'a line':
        writeTheLineOfACombatSpell(caster, target, step.theLine, narrative);
        break;
    }
  }
}

/** The line of a combat spell that has no other step to write it (plan P1-19x), its fields in the order the spell's case
 *  wrote them. */
function writeTheLineOfACombatSpell(
  caster: AFighterInAPersonalCombat,
  target: AFighterInAPersonalCombat,
  theLine: TheLineOfACombatSpell,
  narrative: NarrativeLine[],
): void {
  switch (theLine.kind) {
    case 'the caster conjures a mirror image':
    case 'the caster weaves a second mirror image':
      narrate(narrative, { kind: theLine.kind, casterName: caster.name });
      break;
    case 'the caster conjures a phantom of the target':
      narrate(narrative, {
        kind: theLine.kind,
        casterName: caster.name,
        targetName: target.name,
        targetName2: target.name,
        casterName2: caster.name,
      });
      break;
    case 'the caster fades from sight':
      narrate(narrative, { kind: theLine.kind, casterName: caster.name, invPct: theLine.invPct });
      break;
    case "the caster's curse withers the target":
      narrate(narrative, {
        kind: theLine.kind,
        casterName: caster.name,
        targetName: target.name,
        bestKey: theLine.bestKey,
        bestSchool: theLine.bestSchool,
        bestAbilityLevel: theLine.bestAbilityLevel,
      });
      break;
    case "the caster's curse finds no ability":
    case "the caster's charm washes over a crowned will":
    case "the caster's charm slides off a mind lately swayed":
    case "the caster charms the target's wits":
      narrate(narrative, { kind: theLine.kind, casterName: caster.name, targetName: target.name });
      break;
    case 'control undead has no hold over the living':
      narrate(narrative, { kind: theLine.kind, targetName: target.name });
      break;
  }
}

/** The line a combat spell's hit writes once it deals damage, its fields in the order the spell's case wrote them. */
function writeTheLineOfACombatSpellsHit(
  caster: AFighterInAPersonalCombat,
  target: AFighterInAPersonalCombat,
  theLine: TheLineOfACombatSpellsHit,
  dealt: number,
  narrative: NarrativeLine[],
): void {
  const targetHp = Math.max(0, Math.round(target.hp));
  switch (theLine.kind) {
    case "the caster's lightning bolt arcs into the target":
      narrate(narrative, { kind: theLine.kind, casterName: caster.name, targetName: target.name, dealt, targetHp });
      break;
    case "the holy light's damage":
      narrate(narrative, {
        kind: theLine.kind,
        againstTheUnclean: theLine.againstTheUnclean,
        targetName: target.name,
        dealt,
        targetHp,
      });
      break;
    case 'a telekinetic storm rips the target':
      narrate(narrative, {
        kind: theLine.kind,
        targetName: target.name,
        dealt,
        casterName: caster.name,
        self: theLine.self,
        targetHp,
      });
      break;
    case "the hand of death claims part of the target's health":
      narrate(narrative, {
        kind: theLine.kind,
        handOfDeathBitePct: theLine.handOfDeathBitePct,
        targetName: target.name,
        dealt,
        targetHp,
      });
      break;
  }
}

// --- Monster special abilities ---------------------------------------------- A monster's
// special is its equivalent of a Cast action: it appears in the creature's action plan as
// MS:<name> and resolves here. Effects are parsed from the ability's `effect` text so new
// monsters can be added as data without touching the engine.
export function pcMonsterSpecial(
  turnContext: TurnContext,
  actor: AFighterInAPersonalCombat,
  foe: AFighterInAPersonalCombat,
  sp: AGuardiansSpecialAsItIsUsed,
  narrative: NarrativeLine[],
  state: TheFightAsASpecialWritesIt,
): void {
  narrate(narrative, {
    kind: 'a fighter uses a power',
    actorName: actor.name,
    spName: sp.name,
    spFlavour: sp.flavour,
  });
  const eff = sp.effect ?? ''; // the saved schema's words, or none
  let dealt = 0;
  // a special's damage is the guardian's own MELEE-FORMULA blow (pcMeleeDamage — its tier's base + ⌈melee/2⌉)
  // × the special's weight: 1.0 light, 1.5 heavy, 2.0 breath. Legacy saved creatures
  // still carrying a dmg:[lo,hi] range roll that range instead.
  const _w = sp.dmgW ?? (sp.dmg && (Number(sp.dmg[0]) > 0 || Number(sp.dmg[1]) > 0) ? null : 0);
  if (_w !== 0) {
    let d =
      _w != null
        ? Math.max(1, Math.round(pcMeleeDamage(actor, foe) * _w))
        : rng(...aDamageRangeAsTheDiceReadIt(sp.dmg));
    if (/hits twice/i.test(eff)) d *= 2;
    dealt = pcTakeHit(turnContext, foe, d, narrative, actor.name, sp.name);
    if (dealt)
      narrate(narrative, {
        kind: 'a power tears into the foe',
        spName: sp.name,
        foeName: foe.name,
        dealt,
        foeHp: Math.max(0, Math.round(foe.hp)),
      });
  }
  // ── Self-healing ──
  let heal = 0;
  if (/heals half/i.test(eff)) heal = Math.ceil(dealt / 2);
  else {
    const hm = /(?:regains|gains)\s*\+?(\d+)\s*HP/i.exec(eff);
    if (hm) heal = parseInt(String(hm[1]));
    else if (/heal|regenerat/i.test(eff)) heal = rng(3, 8);
  }
  // a guardian may mend itself ONCE in the whole combat, whichever ability does it and however
  // many healing abilities it has. The plan already appends each heal once and only at the tail,
  // so this is the belt-and-braces half of the rule — it also covers the stalled-fight and
  // resumed-encounter paths, where a plan can be walked more than once.
  if (heal > 0 && actor._selfHealUsed) {
    heal = 0;
    if (dealt === 0)
      narrate(narrative, {
        kind: 'the guardian reaches for its own wounds again but the well is dry',
        actorName: actor.name,
      });
  }
  if (heal > 0) {
    actor._selfHealUsed = true;
    actor.hp = Math.min(actor.maxHp, actor.hp + heal);
    narrate(narrative, {
      kind: 'the guardian knits its wounds',
      actorName: actor.name,
      heal,
      actorHp: dispFloor(actor.hp),
    });
  }
  // ── Lost actions ──
  let stun = 0;
  if (/loses 3 rounds/i.test(eff)) stun = 3;
  else if (/loses 2 (?:attack )?rounds/i.test(eff)) stun = 2;
  else if (/loses (?:one|1|next) attack|loses next attack|knocked back|entranced|loses all Archery/i.test(eff))
    stun = 1;
  if (stun > 0) {
    // if the special ALSO struck a blow, the daze is a rider on that blow and grips from the next
    // round. A special that does nothing but daze still takes hold at once.
    // the target's stun ward is asked as the daze LANDS — a deferred rider that a ward turns is
    // never queued at all (batch item 3).
    if (pcStunTurned(foe, narrative, { kind: "a guardian's special's daze", specialName: sp.name })) {
      /* turned */
    } else if (
      dealt > 0 &&
      pcDeferEffect(foe, () => {
        foe.status.stun = (foe.status.stun || 0) + stun;
      })
    )
      narrate(narrative, {
        kind: 'the foe reels from the blow, losing actions',
        foeName: foe.name,
        stun,
      });
    else {
      foe.status.stun = (foe.status.stun || 0) + stun;
      narrate(narrative, {
        kind: 'the foe is caught helpless, losing actions',
        foeName: foe.name,
        stun,
      });
    }
  }
  // ── To-hit penalties ──
  const pm = /[-−](\d+)%/.exec(eff);
  if (pm) {
    const pen = parseInt(String(pm[1]));
    // a rider on a landed blow — it starts biting from the next round.
    if (
      dealt > 0 &&
      pcDeferEffect(foe, () => {
        foe.status.hitPenalty = (foe.status.hitPenalty || 0) + pen;
      })
    )
      narrate(narrative, { kind: 'the foe is thrown off balance from the next round', foeName: foe.name, pen });
    else {
      foe.status.hitPenalty = (foe.status.hitPenalty || 0) + pen;
      narrate(narrative, { kind: 'the foe is thrown off balance', foeName: foe.name, pen });
    }
  }
  // ── Stat swings ──
  // 2026-10-08 (Toby item 2): "hero −1 melee for next round" used to lower `melee`, which neither
  // to-hit (pcHitSkill) nor damage (meleeRaw) reads for a hero, so it did nothing. It is now a
  // status both read, lasting one round: a rider on a landed blow bites from the next round.
  if (/hero\s*[-−]1 melee/i.test(eff)) {
    const _chill = () => {
      foe.status.meleeDown = 1;
      foe.status.meleeDownRounds = 1;
    };
    const _now = Math.max(0, pcHitSkill(foe, 'melee') - 1);
    if (dealt > 0 && pcDeferEffect(foe, _chill))
      narrate(narrative, { kind: "the foe's guard is beaten down next round", foeName: foe.name, now: _now });
    else {
      _chill();
      narrate(narrative, { kind: "the foe's guard is beaten down now", foeName: foe.name, now: _now });
    }
  }
  const bm = /gains \+(\d+) melee/i.exec(eff);
  if (bm) {
    actor.melee = (actor.melee || 0) + parseInt(String(bm[1]));
    narrate(narrative, { kind: "the guardian's melee surges", actorName: actor.name, actorMelee: actor.melee });
  }
  // ── Lingering harm ──
  const dm = /takes (\d+) dmg at start of each round for (\d+) rounds/i.exec(eff);
  if (dm) {
    const _e = pcPushDot(foe, parseInt(String(dm[1])), parseInt(String(dm[2])), {
      kind: "a guardian's special",
      specialName: sp.name,
    });
    if (_e)
      narrate(narrative, {
        kind: 'a power festers on the foe',
        spName: sp.name,
        foeName: foe.name,
        eDmg: _e.dmg,
        eRounds: _e.rounds,
      });
  }
  // ── Wards and shields ──
  const rf = /reflects (\d+) dmg/i.exec(eff);
  if (rf) {
    actor.status.reflect = (actor.status.reflect || 0) + parseInt(String(rf[1]));
    narrate(narrative, {
      kind: 'every blow against the guardian will bite back',
      actorName: actor.name,
      actorStatusReflect: actor.status.reflect,
    });
  }
  const ab = /absorbs next (\d+) dmg/i.exec(eff);
  if (ab) {
    actor.status.absorb = (actor.status.absorb || 0) + parseInt(String(ab[1]));
    narrate(narrative, {
      kind: 'a ward shrouds the guardian',
      actorName: actor.name,
      actorStatusAbsorb: actor.status.absorb,
    });
  }
  if (/ignores all armour/i.test(eff)) foe.status.incomingDmgBonus = (foe.status.incomingDmgBonus || 0) + 3;
  // ── Halving (Sept 2026: replaced Finger of Death's 10% instant kill) — a chance to cut the
  // foe's CURRENT HP in half.
  const hv = /(\d+)% halves current hp/i.exec(eff);
  if (hv && foe.hp > 1 && kcRng() * 100 < parseInt(String(hv[1]))) {
    const _cut = Math.floor(foe.hp / 2);
    foe.hp -= _cut;
    narrate(narrative, {
      kind: "death's touch tears the foe's strength in half",
      foeName: foe.name,
      cut: _cut,
      foeHp: Math.max(0, Math.round(foe.hp)),
    });
  }
  // ── Instant kill ──
  const ik = /(\d+)% instant kill/i.exec(eff);
  if (ik && kcRng() * 100 < parseInt(String(ik[1]))) {
    foe.hp = 0;
    narrate(narrative, { kind: 'the foe is struck down where they stand', foeName: foe.name });
  }
  // A demigod was still routed by a Banshee a quarter of the time. It is now a real contest (see
  // pcCourageChance): nerve comes from martial mastery, temper and faith, and the creature's own
  // stature sets how hard it presses.
  if (/courage test or flee/i.test(eff) && !foe.neverFlees) {
    if (aFightersWardsRefuseAStunOrATerror(foe.arm)) {
      narrate(narrative, { kind: 'the foe cannot be gripped by it', foeName: foe.name });
    } else {
      const _tc = pcCourageChance(foe, actor),
        _tr = d100();
      narrate(narrative, {
        kind: 'the foe must hold their nerve',
        foeName: foe.name,
        tc: _tc,
        tr: _tr,
      });
      if (_tr <= _tc) {
        state.fledBy = foe;
        narrate(narrative, { kind: 'the foe is overcome with sheer terror', foeName: foe.name });
      } else narrate(narrative, { kind: 'the foe steels their nerve', foeName: foe.name });
    }
  }
  if (/flee chance/i.test(eff)) {
    foe.status.fleePenalty = (foe.status.fleePenalty || 0) + 30;
    narrate(narrative, { kind: 'the foe feels dragged towards the creature', foeName: foe.name });
  }
  // ── Rebirth (Phoenix) — banked, spent if the creature is felled ──
  if (/rebirth/i.test(sp.name || '')) actor._rebirth = true;
}
