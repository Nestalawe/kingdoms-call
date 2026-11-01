// ── THE FACTS A PERSONAL COMBAT'S LINES RECORD (plan P1-12c4: P1-12's Decisions of 2026-10-24, Decisions 5 and 6) ────
// Every line of a personal combat (a duel, an Encounter, a lair's guardian, a thief's attempt: src/engine/personal-
// combat/) records a fact, and the views write its words after perception (src/views/prose/the-words-of-a-personal-
// combats-lines.ts): the engine no longer writes those words itself. One kind per sentence, one field per value the
// sentence was written with, worked out where the line is told and in the sentence's order, so the words are the same
// by construction. Since P1-12d2 (P1-12's Decisions of 2026-10-26, Decision 2) a field holds a value, never words: a
// plural, a mark, a clause chosen by a flag, a joined list are written in the prose from the count, the roll and the
// chance, the flag, the list (copied as the line is told: below). The fighters' labels (`who`, `foeWho`: "The Barrow
// Wight") are records since P1-12d25 (AFighterOfAPersonalCombat); how a hero carries an item he gained is a record since P1-12d21
// (TheItemsAHeroGained, src/engine/items/equipment.ts). What a daze or a lingering harm comes from, which a caller
// hands in through a parameter, is a record of its names since P1-12d19 (TheSourceOfADaze, TheSourceOfALingeringHarm:
// src/engine/rules/the-registry-of-content-effects.ts, beside the combat spells' steps that name one). P1-12d's next
// slice merges the kinds into facts by sense.
//
// Each kind's audience is written once, by its type (THE_AUDIENCE_OF_EACH_KIND_OF_A_PERSONAL_COMBATS_LINE): the
// fight's (whoever the fight's lines are written for: emitNarrLine files them with the fight's event), or its hero's
// realm alone. Two kinds are for one realm alone, inside any fight's narrative: a hero's hit-point rise
// (heroes/experience-skill-rises-and-earned-hp.ts) and the surgeons' line for a fallen duellist's own realm
// (battle/pre-battle-duels.ts); each names its realm. The rise names its hero, his name and a copy of the rise (its
// words: hpGainLine, in the prose); the surgeons' line holds the values a hero's death records for it (P1-12d5).
import type { TheAudienceOfAKindOfLine, TheTierOfAKindOfABattlesLine } from '../turn/events-and-their-audiences.ts';
import type { TheItemsAHeroGained } from '../items/equipment.ts';
import type { TheSourceOfADaze, TheSourceOfALingeringHarm } from '../rules/the-registry-of-content-effects.ts';
export type { TheSourceOfADaze, TheSourceOfALingeringHarm } from '../rules/the-registry-of-content-effects.ts';

/** A fighter as a line names him (plan P1-12d25: the battle slice's Decision 6): his name as the fight holds it, and
 *  whether he is a guardian, whom a line names "the <name>" ("The <name>" where the sentence begins with him). The
 *  prose writes the label (theLabelOfAFighter). */
export interface AFighterOfAPersonalCombat {
  readonly name: string;
  readonly isAGuardian: boolean;
}

/** A value a line's words are written with: a name, a number, or words themselves. */
export type AValueInALinesWords = string | number | boolean | null;

// ── WHAT A LINE'S WORDS READ, COPIED AS THE LINE IS TOLD (plan P1-12d2: P1-12's Decisions of 2026-10-26, Decision 2) ──
// A fact holds plain values only, never a part of the world and never words the engine composed: the views write the
// words (src/views/prose/the-words-of-a-personal-combats-lines.ts) after the turn, when the fighters and their items
// may have changed. So what a line's words read of a fighter, an item list or a hit-point rise is copied here, as the
// line is told, by the functions below; the words come from those copies alone.

/** A fighter as these copies read it (a combatant of personal combat, a guardian, a hero). */
interface AFighterAsTheseCopiesReadIt {
  readonly kind?: string | undefined;
  readonly name?: string | undefined;
  readonly melee?: number | undefined;
  readonly meleeBase?: number | null | undefined;
  readonly archery?: number | undefined;
  readonly archeryBase?: number | null | undefined;
  readonly _perkName?: Readonly<Partial<Record<string, string>>> | null | undefined;
  readonly perks?: readonly unknown[] | null | undefined;
  readonly passiveName?: string | null | undefined;
}

/** A fighter's melee or archery as a line names it: the level it fights at, and its level before a bonus raised it. */
export interface AFightersSkillAsTheLineTellsIt {
  readonly level: number;
  readonly levelBeforeItsBonus: number | null | undefined;
}

/** A fighter's melee or archery, copied as the line is told. */
export function aFightersSkillAsTheLineTellsIt(
  fighter: AFighterAsTheseCopiesReadIt | null | undefined,
  stat: 'melee' | 'archery',
): AFightersSkillAsTheLineTellsIt {
  return {
    level: Number(fighter?.[stat]) || 0,
    levelBeforeItsBonus: stat === 'melee' ? fighter?.meleeBase : fighter?.archeryBase,
  };
}

/** A fighter's ward as a line names it: the fighter, whether it is a guardian, and the name of the guardian's perk that
 *  works it (the perk named for the ward's effect, else its one passive's), if it has one. */
export interface AFightersWardAsTheLineTellsIt {
  readonly fighterName: string | undefined;
  readonly isAGuardian: boolean;
  readonly itsPerksName: string | null | undefined;
}

/** A fighter's ward for the effect named (`key`: regen, meleeDR, …), copied as the line is told. */
export function aFightersWardAsTheLineTellsIt(
  fighter: AFighterAsTheseCopiesReadIt,
  key: string,
): AFightersWardAsTheLineTellsIt {
  return {
    fighterName: fighter.name,
    isAGuardian: fighter.kind === 'monster',
    itsPerksName: theNameOfTheGuardiansPerkForAWard(fighter, key),
  };
}

/** A guardian's perk for the effect named, else its passive when it has one perk or none: null for a hero. */
function theNameOfTheGuardiansPerkForAWard(
  fighter: AFighterAsTheseCopiesReadIt,
  key: string,
): string | null | undefined {
  if (fighter.kind !== 'monster') return null;
  const named = fighter._perkName?.[key];
  if (named) return named;
  return (fighter.perks ? fighter.perks.length : 0) <= 1 ? fighter.passiveName : null;
}

/** The name of a guardian's perk for the effect named (`key`: burn, drain, …), else of its passive, else null: copied
 *  as the line is told. */
export function aFightersPerkNameAsTheLineTellsIt(
  fighter: AFighterAsTheseCopiesReadIt | null | undefined,
  key: string,
): string | null {
  const named = fighter?._perkName?.[key];
  if (named) return named;
  const passive = fighter?.passiveName;
  if (passive) return passive;
  return null;
}

/** A guardian as its kind's label reads it (monsterCatLabel): its kind, if the bestiary names one, and its name. */
export interface AGuardianAsItsKindIsRead {
  readonly cat?: string | null | undefined;
  readonly name?: string | undefined;
}

/** A guardian as its kind's label reads it, copied as the line is told. */
export function aGuardianAsItsKindIsRead(guardian: AGuardianAsItsKindIsRead): AGuardianAsItsKindIsRead {
  return { cat: guardian.cat, name: guardian.name };
}

/** A hero's maximum hit points rising after a fight, as its line tells it (hpGainLine's second argument). */
export interface AHitPointRiseAsTheLineTellsIt {
  readonly gain: number;
  readonly maxHp: number;
  readonly wound?: boolean | undefined;
  readonly winBonus?: number | undefined;
  readonly sd35?: boolean | undefined;
}

/** A hero's hit-point rise, copied as the line is told. */
export function aHitPointRiseAsTheLineTellsIt(rise: AHitPointRiseAsTheLineTellsIt): AHitPointRiseAsTheLineTellsIt {
  return { gain: rise.gain, maxHp: rise.maxHp, wound: rise.wound, winBonus: rise.winBonus, sd35: rise.sd35 };
}

/** The odds of mercy a plea shows: the chance, the roll shown, and whether mercy was granted. */
export interface TheOddsOfMercy {
  readonly mercy: number;
  readonly shown: number;
  readonly granted: boolean;
}

/** A list of names (or of any plain values), copied as the line is told. */
export function aListAsTheLineTellsIt<Value extends string | number>(list: readonly Value[]): Value[] {
  return [...list];
}

/** The names of a list of things (items, spells), copied as the line is told. */
export function theNamesAsTheLineTellsThem(list: readonly { readonly name: string }[]): string[] {
  return list.map((x) => x.name);
}

/** The names and descriptions of a list of things (a guardian's passive perks), copied as the line is told. */
export function theNamesAndDescriptionsAsTheLineTellsThem(
  list: readonly { readonly name: string; readonly desc?: string | undefined }[],
): { name: string; desc: string | undefined }[] {
  return list.map((x) => ({ name: x.name, desc: x.desc }));
}

/** An item as a line names it: its name, its description and its tier (a legendary item is named so). */
export interface AnItemAsTheLineNamesIt {
  readonly name: string;
  readonly desc?: string;
  readonly tier?: number;
}

/** A list of items, each as a line names it, copied as the line is told. */
export function theItemsAsTheLineNamesThem(
  items: readonly { readonly name: string; readonly desc?: string | undefined; readonly tier?: number | undefined }[],
): AnItemAsTheLineNamesIt[] {
  return items.map((it) => {
    const copy: { name: string; desc?: string; tier?: number } = { name: it.name };
    if (it.desc !== undefined) copy.desc = it.desc;
    if (it.tier !== undefined) copy.tier = it.tier;
    return copy;
  });
}

/** The facts a personal combat's lines record, each with its kind: one kind per sentence, one field per value it was
 *  written with. */
export type TheFactOfAPersonalCombatsLine =
  | {
      kind: 'the caster cannot cast a spell without its skill';
      casterName: string;
      spellName: string;
      schoolLabel: string;
    }
  | {
      kind: "the caster's spell already cast this combat";
      casterName: AValueInALinesWords;
      spellName: AValueInALinesWords;
    }
  | {
      kind: "the caster's spell limit reached this combat";
      casterName: AValueInALinesWords;
      schoolLabel: AValueInALinesWords;
    }
  | {
      kind: "the caster calls on a school's arts, weaving a spell";
      casterName: string;
      school: string;
      spellName: string;
      castChance: number;
      schoolWard: number;
      targetsWard: AFightersWardAsTheLineTellsIt;
      castRoll: number;
    }
  | { kind: 'but the spell guts and fizzles' }
  | { kind: "the target is open to the school's arts"; targetName: string; school: string; targetWeakName: string }
  | {
      kind: "the caster marks the target's weakness well";
      casterName: string;
      targetWeakDesc: string;
      targetName: string;
    }
  | {
      kind: "the caster's lightning bolt arcs into the target";
      casterName: string;
      targetName: string;
      dealt: number;
      targetHp: number;
    }
  | {
      kind: 'a fireball engulfs the target and will burn';
      targetName: AValueInALinesWords;
      fbPct: AValueInALinesWords;
      burnRounds: AValueInALinesWords;
      fbWard: number;
    }
  | {
      kind: 'the caster raises a holy symbol';
      casterName: string;
      targetName: string;
      pen: number;
      againstTheUnclean: boolean;
    }
  | { kind: "the light closes the caster's hurts"; casterName: string; healed: number; casterHp: number }
  | { kind: "the holy light's damage"; againstTheUnclean: boolean; targetName: string; dealt: number; targetHp: number }
  | {
      kind: 'the caster binds the target with spiritwrack';
      casterName: AValueInALinesWords;
      targetName: AValueInALinesWords;
      swR: number;
      shr: number;
      targetPower: string | undefined;
    }
  | { kind: "psychic blast sears the target's mind"; targetName: string; stunN: number }
  | {
      kind: 'a telekinetic storm rips the target';
      targetName: AValueInALinesWords;
      dealt: AValueInALinesWords;
      casterName: AValueInALinesWords;
      self: AValueInALinesWords;
      targetHp: AValueInALinesWords;
    }
  | { kind: 'the caster conjures a mirror image'; casterName: AValueInALinesWords }
  | { kind: 'the caster weaves a second mirror image'; casterName: AValueInALinesWords }
  | {
      kind: 'the caster conjures a phantom of the target';
      casterName: string;
      targetName: string;
      targetName2: string;
      casterName2: string;
    }
  | { kind: 'the caster fades from sight'; casterName: AValueInALinesWords; invPct: AValueInALinesWords }
  | {
      kind: "the hand of death claims part of the target's health";
      handOfDeathBitePct: number;
      targetName: string;
      dealt: number;
      targetHp: number;
    }
  | { kind: "the caster's hand of death fails"; casterName: string; handOfDeathChancePct: number }
  | {
      kind: "the caster's curse withers the target";
      casterName: AValueInALinesWords;
      targetName: AValueInALinesWords;
      bestKey: string;
      bestSchool: string;
      bestAbilityLevel: AValueInALinesWords;
    }
  | { kind: "the caster's curse finds no ability"; casterName: AValueInALinesWords; targetName: AValueInALinesWords }
  | {
      kind: 'the caster seizes the undead target';
      casterName: AValueInALinesWords;
      targetName: AValueInALinesWords;
      cuR: AValueInALinesWords;
    }
  | { kind: 'control undead has no hold over the living'; targetName: AValueInALinesWords }
  | {
      kind: "the caster's charm washes over a crowned will";
      casterName: AValueInALinesWords;
      targetName: AValueInALinesWords;
    }
  | {
      kind: "the caster's charm slides off a mind lately swayed";
      casterName: AValueInALinesWords;
      targetName: AValueInALinesWords;
    }
  | {
      kind: "the caster's charm breaks against the target's will";
      casterName: AValueInALinesWords;
      targetName: AValueInALinesWords;
      targetRefCharmResist: AValueInALinesWords;
    }
  | { kind: "the caster charms the target's wits"; casterName: AValueInALinesWords; targetName: AValueInALinesWords }
  | { kind: 'the caster casts a spell'; casterName: AValueInALinesWords; spellName: AValueInALinesWords }
  | { kind: 'a fighter uses a power'; actorName: string; spName: string; spFlavour: string | undefined }
  | { kind: 'a power tears into the foe'; spName: string; foeName: string; dealt: number; foeHp: number }
  | { kind: 'the guardian reaches for its own wounds again but the well is dry'; actorName: AValueInALinesWords }
  | {
      kind: 'the guardian knits its wounds';
      actorName: AValueInALinesWords;
      heal: AValueInALinesWords;
      actorHp: AValueInALinesWords;
    }
  | { kind: 'the foe reels from the blow, losing actions'; foeName: string; stun: number }
  | { kind: 'the foe is caught helpless, losing actions'; foeName: string; stun: number }
  | { kind: 'the foe is thrown off balance from the next round'; foeName: string; pen: number }
  | { kind: 'the foe is thrown off balance'; foeName: AValueInALinesWords; pen: AValueInALinesWords }
  | { kind: "the foe's guard is beaten down next round"; foeName: string; now: number }
  | { kind: "the foe's guard is beaten down now"; foeName: AValueInALinesWords; now: AValueInALinesWords }
  | { kind: "the guardian's melee surges"; actorName: AValueInALinesWords; actorMelee: AValueInALinesWords }
  | { kind: 'a power festers on the foe'; spName: string; foeName: string; eDmg: number; eRounds: number }
  | {
      kind: 'every blow against the guardian will bite back';
      actorName: AValueInALinesWords;
      actorStatusReflect: AValueInALinesWords;
    }
  | { kind: 'a ward shrouds the guardian'; actorName: string; actorStatusAbsorb: number }
  | {
      kind: "death's touch tears the foe's strength in half";
      foeName: AValueInALinesWords;
      cut: AValueInALinesWords;
      foeHp: AValueInALinesWords;
    }
  | { kind: 'the foe is struck down where they stand'; foeName: AValueInALinesWords }
  | { kind: 'the foe cannot be gripped by it'; foeName: AValueInALinesWords }
  | { kind: 'the foe must hold their nerve'; foeName: AValueInALinesWords; tc: number; tr: number }
  | { kind: 'the foe is overcome with sheer terror'; foeName: AValueInALinesWords }
  | { kind: 'the foe steels their nerve'; foeName: AValueInALinesWords }
  | { kind: 'the foe feels dragged towards the creature'; foeName: AValueInALinesWords }
  | { kind: 'a hero bears magic items into the fight'; chName: string; items: readonly AnItemAsTheLineNamesIt[] }
  | {
      kind: 'the runner scrambles clear with a chance of dropping something';
      runnerName: string;
      chance: number;
      roll: number;
    }
  | {
      kind: 'in the rout the runner drops an item the one who stays claims';
      runnerName: string;
      itName: string;
      itIsLegendary: boolean;
      stayerName: string;
    }
  | { kind: 'a gained item noted'; theItemsHeGained: TheItemsAHeroGained }
  | { kind: 'the runner breaks off the duel and slips away'; runnerName: string; stayerName: string }
  | {
      kind: 'the attacker meets the defender in a personal encounter';
      atkName: string;
      atkRace: string;
      atkTemper: string;
      defName: string;
      defRace: string;
      defRealm: number | null;
      defRealmName: string | undefined;
    }
  | {
      kind: "the attacker goes for the defender's purse and comes away with nothing";
      atkName: AValueInALinesWords;
      defName: AValueInALinesWords;
    }
  | {
      kind: "the attacker lifts gold from the defender's purse";
      atkName: AValueInALinesWords;
      stolen: AValueInALinesWords;
      defName: AValueInALinesWords;
    }
  | {
      kind: "the attacker finds the defender's purse empty";
      atkName: AValueInALinesWords;
      defName: AValueInALinesWords;
    }
  | { kind: 'the one who flees breaks away and escapes'; resFledByName: string }
  | { kind: 'the attacker is overwhelmed'; atkName: string }
  | { kind: 'the defender is overcome'; defName: string }
  | {
      kind: "the guardian has turned the hoard's magic to its own use";
      mName: string;
      wieldedItemNames: readonly string[];
    }
  | { kind: 'the hero enters the feature'; cName: string; featureName: string; provName: string }
  | {
      kind: 'within lurks the guardian blocking the path';
      mPower: string | undefined;
      mName: string;
      mKind: AGuardianAsItsKindIsRead;
      monsterPower: string;
    }
  | {
      kind: 'the guardian is already wounded by someone before';
      cName: AValueInALinesWords;
      monHp: number;
      monFullHp: number;
    }
  | {
      kind: "the guardian's speed and plan";
      mName: string;
      monSpeedName: string;
      monFightsAtRange: boolean;
      guardianTactics: readonly string[];
    }
  | { kind: 'after tense negotiations the guardian agrees'; mName: AValueInALinesWords }
  | { kind: 'the hero slips away with the prize'; cName: string; mName: string }
  | { kind: 'the hero turns and flees from the guardian'; cName: string; mName: string }
  | {
      kind: 'in the rout the hero drops an item into the hoard';
      cName: string;
      itName: string;
      itIsLegendary: boolean;
      mName: string;
      theGuardianCanUseIt: boolean;
    }
  | { kind: 'with a final effort the guardian is defeated'; aDecisiveBlow: number; mName: string }
  | { kind: 'the hero falls to their knees overwhelmed'; cName: string; mName: string }
  | {
      kind: 'neither the hero nor the guardian gains the upper hand';
      cName: AValueInALinesWords;
      mName: AValueInALinesWords;
      cName2: AValueInALinesWords;
    }
  | { kind: 'the guardian draws back into its lair'; mName: string }
  | {
      kind: 'the hero seizes the opening and counterattacks';
      heroName: string;
      aRiposteOfItsTemper: boolean;
      heroTemper: string;
    }
  | { kind: 'the counterstroke strikes the foe'; foeName: string; dealt: number; foeName2: string; foeHp: number }
  | {
      kind: 'the hero lunges to counterattack but the foe recovers';
      heroName: string;
      foeName: string;
      aRiposteOfItsTemper: boolean;
      heroTemper: string;
    }
  | { kind: "a fighter's attack fails, still reeling from a crippling wound"; actorName: string }
  | {
      kind: 'a fighter attacks with a roll to hit';
      actorName: string;
      actorMelee: AFightersSkillAsTheLineTellsIt;
      hitI: number;
      roll: number;
    }
  | { kind: 'a fighter strikes the foe'; actorName: string; foeName: string; dealt: number; foeHp: number }
  | {
      kind: 'a fighter drinks the wound';
      actorName: string;
      dr: number;
      sm: number;
      actorDrainPerk: string | null;
      actorHp: number;
    }
  | {
      kind: "the foe's shield lashes back";
      foeName: AValueInALinesWords;
      foeStatusReflect: AValueInALinesWords;
      actorName: AValueInALinesWords;
      actorHp: AValueInALinesWords;
    }
  | {
      kind: "the foe's thorns bite a fighter";
      foeIsAGuardian: boolean;
      foesThornsWard: AFightersWardAsTheLineTellsIt;
      foeName: string;
      actorName: string;
      foeArmThorns: number;
      actorName2: string;
      actorHp: number;
    }
  | { kind: "a fighter's blow is turned aside"; actorName: string }
  | { kind: 'but a fighter is too dazed to punish it'; actorName: string }
  | { kind: 'but a fighter is still reeling and the chance is lost'; actorName: AValueInALinesWords }
  | {
      kind: "a fighter takes a free strike at the foe's back";
      actorName: string;
      foeName: string;
      actorMelee: AFightersSkillAsTheLineTellsIt;
      hitI: number;
      roll: number;
    }
  | { kind: 'a fighter lands the free strike'; actorName: string; dealt: number; foeName: string; foeHp: number }
  | {
      kind: 'the foe bursts into ash then blazes back to life';
      foeName: AValueInALinesWords;
      foeHp: AValueInALinesWords;
    }
  | { kind: 'the free strike misses' }
  | {
      kind: 'a fighter tries to flee';
      itsTemperBreaksItOff: boolean;
      actorName: string;
      actorTemper: string;
      chance: number;
      roll: number;
    }
  | { kind: 'a fighter escapes the fight'; actorName: string }
  | { kind: 'a fighter fails to get clear'; actorName: string }
  | { kind: 'a fighter advances and the combatants close'; actorName: string; steps: number; stateRange: string }
  | { kind: 'the foe looses a parting shot as a fighter comes on'; foeName: string; actorName: string }
  | { kind: 'a fighter draws as they come and looses a snap shot'; actorName: string }
  | { kind: "a fighter's shot fails, still reeling from a crippling wound"; actorName: string }
  | {
      kind: 'a fighter draws and looses a volley';
      actorName: string;
      volley: number;
      actorArchery: AFightersSkillAsTheLineTellsIt;
    }
  | {
      kind: 'a fighter shoots with a roll to hit';
      actorName: string;
      actorArchery: AFightersSkillAsTheLineTellsIt;
      hit: number;
      roll: number;
    }
  | { kind: "a fighter's shot hits the foe"; actorName: string; foeName: string; dealt: number; foeHp: number }
  | { kind: "a fighter's arrow impales the foe"; actorName: string; foeName: string; impDmg: number; impRounds: number }
  | { kind: "a fighter's shot strikes a vital point"; actorName: string; foeName: string }
  | { kind: "a fighter's shot flies wide"; actorName: string }
  | { kind: "a guardian's perk is named"; meName: string; pName: string; pDesc: string | undefined }
  | { kind: 'a druid has hunted this kind of beast before'; aName: string; aDruidBeastWard: number }
  | { kind: 'one fighter has the initiative'; firstName: string }
  | { kind: 'the victim fights their own mirror image'; victimName: string; casterName: string }
  | { kind: "but there is no escaping one's own reflection"; victimName: string }
  | { kind: 'but an illusion cast upon an illusion' }
  | { kind: 'the victim shatters the phantom'; victimName: string }
  | { kind: 'the phantom of the victim thins to nothing'; victimName: string }
  | { kind: 'the victim is struck down by their own mirror image'; victimName: string }
  | {
      kind: "a guardian's aura sears the foe";
      meBurnPerk: string | null;
      foeName: string;
      meBurn: number;
      foeHp: number;
    }
  | { kind: 'the victim sees through the illusion'; victimName: string; disbelief: number }
  | { kind: 'a fighter takes a free strike at the foe'; actorName: AValueInALinesWords; foeName: AValueInALinesWords }
  | {
      kind: "a fighter's free strike lands";
      actorName: AValueInALinesWords;
      dealt: AValueInALinesWords;
      foeName: AValueInALinesWords;
      foeHp: AValueInALinesWords;
    }
  | {
      kind: 'a fighter finds their second wind and fights on';
      cbtName: string;
      cbtTemper: string;
      back: number;
      cbtHp: number;
    }
  | {
      kind: 'as their strength fails a fighter begs the foe for mercy';
      who: string;
      foeWho: AFighterOfAPersonalCombat;
      odds: TheOddsOfMercy;
    }
  | {
      kind: 'as the foe draws for the killing shot a fighter begs for their life';
      foeWho: AFighterOfAPersonalCombat;
      who: string;
      odds: TheOddsOfMercy;
    }
  | { kind: 'pinned and bleeding a fighter cries out for mercy'; who: string; odds: TheOddsOfMercy }
  | {
      kind: 'as the foe readies a power for the killing stroke a fighter begs';
      foeWho: AFighterOfAPersonalCombat;
      strikeKind: string;
      strikeClass: string;
      who: string;
      odds: TheOddsOfMercy;
    }
  | {
      kind: 'beaten and bleeding a fighter sees the killing blow coming';
      who: string;
      foeWho: AFighterOfAPersonalCombat;
      odds: TheOddsOfMercy;
    }
  | {
      kind: 'as the foe closes for the kill a fighter cries out for mercy';
      foeWho: AFighterOfAPersonalCombat;
      who: string;
      odds: TheOddsOfMercy;
    }
  | { kind: 'a fighter drops to their knees before the final stroke'; who: string; odds: TheOddsOfMercy }
  | {
      kind: 'the guardian pauses over its prey and lets a fighter crawl away';
      foeWho: AFighterOfAPersonalCombat;
      who: string;
      who2: string;
    }
  | { kind: 'the foe lets a fighter go'; foeWho: AFighterOfAPersonalCombat; who: AValueInALinesWords }
  | { kind: 'the foe lowers their bow and lets a fighter go'; foeWho: AFighterOfAPersonalCombat; who: string }
  | {
      kind: 'the foe lets a power die unspent';
      foeWho: AFighterOfAPersonalCombat;
      strikeKind: string;
      strikeClass: string;
      who: string;
      who2: string;
    }
  | { kind: 'the foe stays the blow and lets a fighter go'; foeWho: AFighterOfAPersonalCombat; who: string }
  | {
      kind: 'the foe lowers their weapon in disgust and lets a fighter go';
      foeWho: AFighterOfAPersonalCombat;
      who: string;
      who2: string;
    }
  | { kind: 'the stroke never falls and the foe spares a fighter'; foeWho: AFighterOfAPersonalCombat; who: string }
  | {
      kind: 'a fighter surrenders an item to the foe as the price of mercy';
      cbtName: string;
      lostName: string;
      foeName: string;
    }
  | {
      kind: 'the foe knows nothing of mercy';
      foeWho: AFighterOfAPersonalCombat;
      aBlowFalls: boolean;
      strikeKind: string;
      strikeClass: string;
    }
  | {
      kind: 'the foe laughs at the plea';
      foeWho: AFighterOfAPersonalCombat;
      aBlowFalls: boolean;
      strikeKind: string;
      strikeClass: string;
    }
  | {
      kind: 'the foe is deaf to the plea';
      foeWho: AFighterOfAPersonalCombat;
      aBlowFalls: boolean;
      strikeKind: string;
      strikeClass: string;
    }
  | {
      kind: 'there is no pity in the foe';
      foeWho: AFighterOfAPersonalCombat;
      aBlowFalls: boolean;
      strikeKind: string;
      strikeClass: string;
    }
  | { kind: 'a combat item strikes the foe'; nm: string; foeName: string; dealt: number; foeHp: number }
  | { kind: 'a fighter uses a combat item'; who: AFighterOfAPersonalCombat; nm: string }
  | {
      kind: 'a fighter recovers hit points';
      who: AFighterOfAPersonalCombat;
      healed: AValueInALinesWords;
      actorHp: AValueInALinesWords;
    }
  | {
      kind: 'warmth spreads through a fighter each round';
      actorName: AValueInALinesWords;
      eAmt: AValueInALinesWords | undefined;
      eRounds: AValueInALinesWords | undefined;
    }
  | {
      kind: 'a fighter recovers hit points and every lingering affliction lifts';
      who: AFighterOfAPersonalCombat;
      healed: AValueInALinesWords;
      actorHp: AValueInALinesWords;
    }
  | {
      kind: 'a combat item blazes twice as bright against the foe';
      nm: AValueInALinesWords;
      foeName: AValueInALinesWords;
    }
  | {
      kind: 'a combat item keeps burning on the foe';
      nm: AValueInALinesWords;
      foeName: AValueInALinesWords;
      deDmg: AValueInALinesWords;
      deRounds: number;
    }
  | { kind: 'the foe is thrown off from the next round'; foeName: string; eHitPen: number }
  | { kind: 'the foe reels losing actions from the next round'; foeName: AValueInALinesWords; eStun: number }
  | {
      kind: 'a fighter drinks the stolen vigour';
      who: AFighterOfAPersonalCombat;
      healed: AValueInALinesWords;
      actorHp: AValueInALinesWords;
    }
  | { kind: 'the foe is held fast, losing actions'; foeName: string; eStun: number }
  | { kind: 'the foe can barely see to strike'; foeName: string; eHitPen: number }
  | { kind: 'the foe can barely see to strike for now'; foeName: string; eHitPen: number }
  | {
      kind: 'the foe is sapped for the rest of the fight';
      foeName: AValueInALinesWords;
      foeMelee: AValueInALinesWords;
      eArchery: number | undefined;
      foeArchery: number;
    }
  | { kind: 'the foe is overcome with dread and flees'; foeName: AValueInALinesWords }
  | { kind: 'the foe holds their ground badly shaken'; foeName: AValueInALinesWords; eHitPen: AValueInALinesWords }
  | { kind: "the foe's magic and powers are bound"; foeName: AValueInALinesWords; eRounds: AValueInALinesWords }
  | {
      kind: 'a fighter surges with strength';
      who: AFighterOfAPersonalCombat;
      actorMelee: number;
      eArchery: number | undefined;
      actorArchery: number;
    }
  | { kind: "a fighter's eye sharpens"; who: AFighterOfAPersonalCombat; eHitBonus: AValueInALinesWords }
  | {
      kind: 'a ward settles over a fighter';
      actorName: string;
      stAbsorb: number;
      eReflect: number | undefined;
      stReflect: number;
    }
  | { kind: 'shimmering doubles step out of a fighter'; eImages: AValueInALinesWords; actorName: AValueInALinesWords }
  | {
      kind: 'a fighter is ready to break away';
      who: AFighterOfAPersonalCombat;
      eFleeBonus: AValueInALinesWords;
      eToHitReduce: number | undefined;
    }
  | {
      kind: 'a fighter fades from sight the foe';
      who: AFighterOfAPersonalCombat;
      foeName: string;
      eToHitReduce: number;
    }
  | { kind: 'every poison burn and blinding on a fighter lifts'; actorName: string }
  | { kind: 'but nothing happens' }
  | { kind: 'a fighter is stunned and cannot act'; actorName: string; actorStatusStun: number }
  | { kind: 'a fighter bound by spiritwrack cannot shoot and closes in'; actorName: AValueInALinesWords }
  | { kind: 'a fighter has no ranged attack and presses forward'; actorName: string }
  | { kind: 'a fighter gives ground and gets to firing range first'; actorName: string; actorTemper: string }
  | { kind: 'a fighter moves up to firing range'; actorName: string; rangeChance: number; roll: number }
  | { kind: 'a fighter cannot close the distance in time'; actorName: string }
  | { kind: 'a fighter tries to break away to firing range'; actorName: string; rangeChance: number; roll: number }
  | { kind: 'the foe stays right on top of a fighter'; foeName: string; actorName: string }
  | { kind: 'a fighter disengages to bow range'; actorName: string }
  | {
      kind: "a fighter's power is bound and it attacks with tooth and claw";
      actorName: AValueInALinesWords;
      foeName: AValueInALinesWords;
    }
  | {
      kind: 'a fighter gathers itself for a power but the moment slips away';
      actorName: string;
      spName: string;
      castChancePct: number;
    }
  | { kind: 'a fighter is silenced and cannot cast'; actorName: AValueInALinesWords }
  | { kind: 'a fighter knows nothing of retreat'; actorName: string }
  | {
      kind: "a fighter calls for parley with a druid's roll";
      actorName: AValueInALinesWords;
      dr: AValueInALinesWords;
      chance: number;
      roll: number;
    }
  | { kind: 'the foe lowers its guard and stands aside'; foeName: AValueInALinesWords }
  | { kind: 'the foe answers with a roar'; foeName: AValueInALinesWords }
  | { kind: 'a fighter calls for parley but blades are already drawn'; actorName: AValueInALinesWords }
  | { kind: 'a fighter has no thief skill and cannot steal'; actorName: AValueInALinesWords }
  | {
      kind: 'a fighter slips past the guardian and seizes the prize';
      actorName: string;
      tier: string;
      chance: number;
      tierPen: number;
    }
  | { kind: "a fighter's theft is noticed"; actorName: string; chance: number; tierPen: number; tier: string }
  | {
      kind: 'a fighter scouts the feature and its guardian';
      actorName: AValueInALinesWords;
      featName: AValueInALinesWords;
      foeName: AValueInALinesWords;
      power: string;
      curHp: AValueInALinesWords;
      fullHp: AValueInALinesWords;
      foeDesc: string | null | undefined;
      spellNames: readonly string[];
      passives: readonly { readonly name: string; readonly desc: string | undefined }[];
      vulnerabilities: { readonly melee: number; readonly archery: number; readonly spell: number };
      weakness: { readonly name: string; readonly desc: string } | null;
      aDruidCouldTalkItDown: boolean | undefined;
      clearGold: AValueInALinesWords;
      hoardItems: readonly AnItemAsTheLineNamesIt[];
      stolenItemNames: readonly string[];
      wieldedItemNames: readonly string[];
    }
  | { kind: 'a fighter scouts the ground but there is nothing to guard'; actorName: AValueInALinesWords }
  | {
      kind: 'a fighter reads the ground and steadies their aim';
      actorName: AValueInALinesWords;
      cut: AValueInALinesWords;
      ex: AValueInALinesWords;
    }
  | {
      kind: 'the target cannot be held';
      targetIsAGuardian: boolean;
      targetName: string;
      targetStunPerk: string | null;
      targetArmourNames: readonly string[] | null;
      w: number;
      what: TheSourceOfADaze;
    }
  | {
      kind: "a fighter's harm strikes a mirror image";
      srcName: AValueInALinesWords;
      harmKind: AValueInALinesWords;
      targetName: AValueInALinesWords;
      targetStatusMirrorImages: number;
    }
  | {
      kind: 'the first harm to reach the target is drunk by their armour';
      channel: string;
      targetName: AValueInALinesWords;
      armourNames: readonly string[];
    }
  | {
      kind: "the target's shield takes the blow square on";
      targetName: AValueInALinesWords;
      channel: string;
      armBlock: AValueInALinesWords;
    }
  | { kind: "the arrow glances off the target's shield"; targetName: string; armArrowBlock: number }
  | { kind: "the target's shield turns the harm away"; targetName: string; harmKind: string; armSpellBlock: number }
  | { kind: "the ward on the target's shield soaks some of the harm"; targetName: string; rw: number }
  | {
      kind: "the target's mithril armour turns aside some of the harm";
      targetName: string;
      damageTurnedAside: number;
      channel: string;
    }
  | {
      kind: "the hunter finds the target's weakness";
      channel: string;
      targetName: string;
      targetWeakName: string;
      wb: number;
      damage: number;
    }
  | {
      kind: "the hunter sees the target's weakness plainly now";
      wsrcName: string;
      targetWeakDesc: string;
      targetName: string;
    }
  | {
      kind: "the target reads the beast's every move";
      targetName: string;
      damageTurnedAside: number;
      /** The blow's channel: none for a guardian's special (PC_CHANNEL names the blows and the arrow only). */
      channel: string | undefined;
      targetDruidBeastWard: number;
    }
  | {
      kind: 'the target rolls with the blow and takes less';
      targetName: string;
      damageRolledWith: number;
      targetTemper: string;
    }
  | {
      kind: 'the target takes the harm on raw fury';
      targetName: string;
      harmKind: string;
      damageShruggedOff: number;
      soakPct: number;
    }
  | { kind: 'a ward around the target drinks some of the blow'; targetName: string; soak: number }
  | { kind: 'the target parries turning aside some of the blow'; targetName: string; damageTurnedAside: number }
  | {
      kind: "the target's elemental armour absorbs some of the harm";
      targetName: string;
      damageAbsorbed: number;
      harmKind: string;
    }
  | {
      kind: "the target's armour turns aside some of the harm";
      targetIsAGuardian: boolean;
      targetsWard: AFightersWardAsTheLineTellsIt;
      damageTurnedAside: number;
      channel: string;
      armourNames: readonly string[];
    }
  | {
      kind: 'the target turns aside all they can but the harm still lands';
      targetName: string;
      channel: string;
      floor: number;
    }
  | {
      kind: "the target's armour will not let any single hit bite deeper";
      targetIsAGuardian: boolean;
      targetsWard: AFightersWardAsTheLineTellsIt;
      capAt: number;
    }
  | {
      kind: 'the target will not go down and restores hit points';
      targetIsAGuardian: boolean;
      targetName: string;
      targetSecondWindPerk: string | null;
      back: number;
      targetHp: number;
    }
  | { kind: 'a fighter ignores the daze'; cbtIsAGuardian: boolean; cbtName: string; cbtStunPerk: string | null }
  | {
      kind: "a fighter's armour sloughs off every burn poison and bleeding";
      cbtIsAGuardian: boolean;
      cbtsWard: AFightersWardAsTheLineTellsIt;
    }
  | {
      kind: "a guardian's regeneration knits its flesh";
      cbtIsAGuardian: boolean;
      cbtsWard: AFightersWardAsTheLineTellsIt;
      healed: number;
      sm: number;
      cbtHp: number;
    }
  | { kind: 'a fighter has nothing left to knit'; cbtName: string }
  | { kind: 'a fighter shrugs off the daze, held steady by their armour'; cbtName: AValueInALinesWords }
  | {
      kind: 'a lingering harm afflicts a fighter';
      harmSource: TheSourceOfALingeringHarm | null;
      cbtName: string;
      harmDealt: number;
      dotWard: number;
      cbtsWard: AFightersWardAsTheLineTellsIt;
      cbtHp: number;
    }
  | {
      kind: 'a healing knits a fighter';
      healingLabel: string | undefined;
      cbtName: AValueInALinesWords;
      healed: AValueInALinesWords;
      cbtHp: AValueInALinesWords;
    }
  | { kind: 'a fighter tears free of the spiritwrack'; cbtName: AValueInALinesWords; shrugPct: number; roll: number }
  | {
      kind: "a hero's hit points rise in a fight, for his realm alone";
      realm: number;
      hero?: number | null | undefined;
      heroName: string;
      rise: AHitPointRiseAsTheLineTellsIt;
    }
  | {
      kind: 'the surgeons reach a fallen duellist too late, for his realm alone';
      realm: number;
      /** The surgeons' line's values, as a hero's death records them (heroes/the-facts-a-heros-death-lines-record.ts:
       *  the fallen duellist's name, Battlefield Surgery's chance and the roll against it). */
      heroName: string;
      chance: number;
      roll: number;
    };

/** The kinds of a fight's line whose audience is its hero's realm alone. */
type TheKindsForItsHerosRealmAlone =
  | "a hero's hit points rise in a fight, for his realm alone"
  | 'the surgeons reach a fallen duellist too late, for his realm alone';

/** A fight's line for its hero's realm alone. */
export type TheFactOfAFightsLineForItsHerosRealmAlone = Extract<
  TheFactOfAPersonalCombatsLine,
  { kind: TheKindsForItsHerosRealmAlone }
>;

/** Each kind's audience: its hero's realm alone for the two kinds above, the fight's for every other (its type says
 *  which, so a kind given another is a compile error). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_PERSONAL_COMBATS_LINE: {
  readonly [Kind in TheFactOfAPersonalCombatsLine['kind']]: Kind extends TheKindsForItsHerosRealmAlone
    ? Extract<TheAudienceOfAKindOfLine, "its hero's realm alone">
    : Extract<TheAudienceOfAKindOfLine, "the fight's">;
} = {
  'the caster cannot cast a spell without its skill': "the fight's",
  "the caster's spell already cast this combat": "the fight's",
  "the caster's spell limit reached this combat": "the fight's",
  "the caster calls on a school's arts, weaving a spell": "the fight's",
  'but the spell guts and fizzles': "the fight's",
  "the target is open to the school's arts": "the fight's",
  "the caster marks the target's weakness well": "the fight's",
  "the caster's lightning bolt arcs into the target": "the fight's",
  'a fireball engulfs the target and will burn': "the fight's",
  'the caster raises a holy symbol': "the fight's",
  "the light closes the caster's hurts": "the fight's",
  "the holy light's damage": "the fight's",
  'the caster binds the target with spiritwrack': "the fight's",
  "psychic blast sears the target's mind": "the fight's",
  'a telekinetic storm rips the target': "the fight's",
  'the caster conjures a mirror image': "the fight's",
  'the caster weaves a second mirror image': "the fight's",
  'the caster conjures a phantom of the target': "the fight's",
  'the caster fades from sight': "the fight's",
  "the hand of death claims part of the target's health": "the fight's",
  "the caster's hand of death fails": "the fight's",
  "the caster's curse withers the target": "the fight's",
  "the caster's curse finds no ability": "the fight's",
  'the caster seizes the undead target': "the fight's",
  'control undead has no hold over the living': "the fight's",
  "the caster's charm washes over a crowned will": "the fight's",
  "the caster's charm slides off a mind lately swayed": "the fight's",
  "the caster's charm breaks against the target's will": "the fight's",
  "the caster charms the target's wits": "the fight's",
  'the caster casts a spell': "the fight's",
  'a fighter uses a power': "the fight's",
  'a power tears into the foe': "the fight's",
  'the guardian reaches for its own wounds again but the well is dry': "the fight's",
  'the guardian knits its wounds': "the fight's",
  'the foe reels from the blow, losing actions': "the fight's",
  'the foe is caught helpless, losing actions': "the fight's",
  'the foe is thrown off balance from the next round': "the fight's",
  'the foe is thrown off balance': "the fight's",
  "the foe's guard is beaten down next round": "the fight's",
  "the foe's guard is beaten down now": "the fight's",
  "the guardian's melee surges": "the fight's",
  'a power festers on the foe': "the fight's",
  'every blow against the guardian will bite back': "the fight's",
  'a ward shrouds the guardian': "the fight's",
  "death's touch tears the foe's strength in half": "the fight's",
  'the foe is struck down where they stand': "the fight's",
  'the foe cannot be gripped by it': "the fight's",
  'the foe must hold their nerve': "the fight's",
  'the foe is overcome with sheer terror': "the fight's",
  'the foe steels their nerve': "the fight's",
  'the foe feels dragged towards the creature': "the fight's",
  'a hero bears magic items into the fight': "the fight's",
  'the runner scrambles clear with a chance of dropping something': "the fight's",
  'in the rout the runner drops an item the one who stays claims': "the fight's",
  'a gained item noted': "the fight's",
  'the runner breaks off the duel and slips away': "the fight's",
  'the attacker meets the defender in a personal encounter': "the fight's",
  "the attacker goes for the defender's purse and comes away with nothing": "the fight's",
  "the attacker lifts gold from the defender's purse": "the fight's",
  "the attacker finds the defender's purse empty": "the fight's",
  'the one who flees breaks away and escapes': "the fight's",
  'the attacker is overwhelmed': "the fight's",
  'the defender is overcome': "the fight's",
  "the guardian has turned the hoard's magic to its own use": "the fight's",
  'the hero enters the feature': "the fight's",
  'within lurks the guardian blocking the path': "the fight's",
  'the guardian is already wounded by someone before': "the fight's",
  "the guardian's speed and plan": "the fight's",
  'after tense negotiations the guardian agrees': "the fight's",
  'the hero slips away with the prize': "the fight's",
  'the hero turns and flees from the guardian': "the fight's",
  'in the rout the hero drops an item into the hoard': "the fight's",
  'with a final effort the guardian is defeated': "the fight's",
  'the hero falls to their knees overwhelmed': "the fight's",
  'neither the hero nor the guardian gains the upper hand': "the fight's",
  'the guardian draws back into its lair': "the fight's",
  'the hero seizes the opening and counterattacks': "the fight's",
  'the counterstroke strikes the foe': "the fight's",
  'the hero lunges to counterattack but the foe recovers': "the fight's",
  "a fighter's attack fails, still reeling from a crippling wound": "the fight's",
  'a fighter attacks with a roll to hit': "the fight's",
  'a fighter strikes the foe': "the fight's",
  'a fighter drinks the wound': "the fight's",
  "the foe's shield lashes back": "the fight's",
  "the foe's thorns bite a fighter": "the fight's",
  "a fighter's blow is turned aside": "the fight's",
  'but a fighter is too dazed to punish it': "the fight's",
  'but a fighter is still reeling and the chance is lost': "the fight's",
  "a fighter takes a free strike at the foe's back": "the fight's",
  'a fighter lands the free strike': "the fight's",
  'the foe bursts into ash then blazes back to life': "the fight's",
  'the free strike misses': "the fight's",
  'a fighter tries to flee': "the fight's",
  'a fighter escapes the fight': "the fight's",
  'a fighter fails to get clear': "the fight's",
  'a fighter advances and the combatants close': "the fight's",
  'the foe looses a parting shot as a fighter comes on': "the fight's",
  'a fighter draws as they come and looses a snap shot': "the fight's",
  "a fighter's shot fails, still reeling from a crippling wound": "the fight's",
  'a fighter draws and looses a volley': "the fight's",
  'a fighter shoots with a roll to hit': "the fight's",
  "a fighter's shot hits the foe": "the fight's",
  "a fighter's arrow impales the foe": "the fight's",
  "a fighter's shot strikes a vital point": "the fight's",
  "a fighter's shot flies wide": "the fight's",
  "a guardian's perk is named": "the fight's",
  'a druid has hunted this kind of beast before': "the fight's",
  'one fighter has the initiative': "the fight's",
  'the victim fights their own mirror image': "the fight's",
  "but there is no escaping one's own reflection": "the fight's",
  'but an illusion cast upon an illusion': "the fight's",
  'the victim shatters the phantom': "the fight's",
  'the phantom of the victim thins to nothing': "the fight's",
  'the victim is struck down by their own mirror image': "the fight's",
  "a guardian's aura sears the foe": "the fight's",
  'the victim sees through the illusion': "the fight's",
  'a fighter takes a free strike at the foe': "the fight's",
  "a fighter's free strike lands": "the fight's",
  'a fighter finds their second wind and fights on': "the fight's",
  'as their strength fails a fighter begs the foe for mercy': "the fight's",
  'as the foe draws for the killing shot a fighter begs for their life': "the fight's",
  'pinned and bleeding a fighter cries out for mercy': "the fight's",
  'as the foe readies a power for the killing stroke a fighter begs': "the fight's",
  'beaten and bleeding a fighter sees the killing blow coming': "the fight's",
  'as the foe closes for the kill a fighter cries out for mercy': "the fight's",
  'a fighter drops to their knees before the final stroke': "the fight's",
  'the guardian pauses over its prey and lets a fighter crawl away': "the fight's",
  'the foe lets a fighter go': "the fight's",
  'the foe lowers their bow and lets a fighter go': "the fight's",
  'the foe lets a power die unspent': "the fight's",
  'the foe stays the blow and lets a fighter go': "the fight's",
  'the foe lowers their weapon in disgust and lets a fighter go': "the fight's",
  'the stroke never falls and the foe spares a fighter': "the fight's",
  'a fighter surrenders an item to the foe as the price of mercy': "the fight's",
  'the foe knows nothing of mercy': "the fight's",
  'the foe laughs at the plea': "the fight's",
  'the foe is deaf to the plea': "the fight's",
  'there is no pity in the foe': "the fight's",
  'a combat item strikes the foe': "the fight's",
  'a fighter uses a combat item': "the fight's",
  'a fighter recovers hit points': "the fight's",
  'warmth spreads through a fighter each round': "the fight's",
  'a fighter recovers hit points and every lingering affliction lifts': "the fight's",
  'a combat item blazes twice as bright against the foe': "the fight's",
  'a combat item keeps burning on the foe': "the fight's",
  'the foe is thrown off from the next round': "the fight's",
  'the foe reels losing actions from the next round': "the fight's",
  'a fighter drinks the stolen vigour': "the fight's",
  'the foe is held fast, losing actions': "the fight's",
  'the foe can barely see to strike': "the fight's",
  'the foe can barely see to strike for now': "the fight's",
  'the foe is sapped for the rest of the fight': "the fight's",
  'the foe is overcome with dread and flees': "the fight's",
  'the foe holds their ground badly shaken': "the fight's",
  "the foe's magic and powers are bound": "the fight's",
  'a fighter surges with strength': "the fight's",
  "a fighter's eye sharpens": "the fight's",
  'a ward settles over a fighter': "the fight's",
  'shimmering doubles step out of a fighter': "the fight's",
  'a fighter is ready to break away': "the fight's",
  'a fighter fades from sight the foe': "the fight's",
  'every poison burn and blinding on a fighter lifts': "the fight's",
  'but nothing happens': "the fight's",
  'a fighter is stunned and cannot act': "the fight's",
  'a fighter bound by spiritwrack cannot shoot and closes in': "the fight's",
  'a fighter has no ranged attack and presses forward': "the fight's",
  'a fighter gives ground and gets to firing range first': "the fight's",
  'a fighter moves up to firing range': "the fight's",
  'a fighter cannot close the distance in time': "the fight's",
  'a fighter tries to break away to firing range': "the fight's",
  'the foe stays right on top of a fighter': "the fight's",
  'a fighter disengages to bow range': "the fight's",
  "a fighter's power is bound and it attacks with tooth and claw": "the fight's",
  'a fighter gathers itself for a power but the moment slips away': "the fight's",
  'a fighter is silenced and cannot cast': "the fight's",
  'a fighter knows nothing of retreat': "the fight's",
  "a fighter calls for parley with a druid's roll": "the fight's",
  'the foe lowers its guard and stands aside': "the fight's",
  'the foe answers with a roar': "the fight's",
  'a fighter calls for parley but blades are already drawn': "the fight's",
  'a fighter has no thief skill and cannot steal': "the fight's",
  'a fighter slips past the guardian and seizes the prize': "the fight's",
  "a fighter's theft is noticed": "the fight's",
  'a fighter scouts the feature and its guardian': "the fight's",
  'a fighter scouts the ground but there is nothing to guard': "the fight's",
  'a fighter reads the ground and steadies their aim': "the fight's",
  'the target cannot be held': "the fight's",
  "a fighter's harm strikes a mirror image": "the fight's",
  'the first harm to reach the target is drunk by their armour': "the fight's",
  "the target's shield takes the blow square on": "the fight's",
  "the arrow glances off the target's shield": "the fight's",
  "the target's shield turns the harm away": "the fight's",
  "the ward on the target's shield soaks some of the harm": "the fight's",
  "the target's mithril armour turns aside some of the harm": "the fight's",
  "the hunter finds the target's weakness": "the fight's",
  "the hunter sees the target's weakness plainly now": "the fight's",
  "the target reads the beast's every move": "the fight's",
  'the target rolls with the blow and takes less': "the fight's",
  'the target takes the harm on raw fury': "the fight's",
  'a ward around the target drinks some of the blow': "the fight's",
  'the target parries turning aside some of the blow': "the fight's",
  "the target's elemental armour absorbs some of the harm": "the fight's",
  "the target's armour turns aside some of the harm": "the fight's",
  'the target turns aside all they can but the harm still lands': "the fight's",
  "the target's armour will not let any single hit bite deeper": "the fight's",
  'the target will not go down and restores hit points': "the fight's",
  'a fighter ignores the daze': "the fight's",
  "a fighter's armour sloughs off every burn poison and bleeding": "the fight's",
  "a guardian's regeneration knits its flesh": "the fight's",
  'a fighter has nothing left to knit': "the fight's",
  'a fighter shrugs off the daze, held steady by their armour': "the fight's",
  'a lingering harm afflicts a fighter': "the fight's",
  'a healing knits a fighter': "the fight's",
  'a fighter tears free of the spiritwrack': "the fight's",
  "a hero's hit points rise in a fight, for his realm alone": "its hero's realm alone",
  'the surgeons reach a fallen duellist too late, for his realm alone': "its hero's realm alone",
};

/** Each kind's tier when it is told in a battle's lines (a duel before the battle, a chase fought as one; plan
 *  P1-12d34): what each kind's words gave when the views read the tiers from them, for the names a game writes. */
export const THE_TIER_OF_EACH_KIND_OF_A_PERSONAL_COMBATS_LINE: Readonly<
  Record<TheFactOfAPersonalCombatsLine['kind'], Extract<TheTierOfAKindOfABattlesLine, 'k' | 'd'>>
> = {
  'the caster cannot cast a spell without its skill': 'd',
  "the caster's spell already cast this combat": 'd',
  "the caster's spell limit reached this combat": 'd',
  "the caster calls on a school's arts, weaving a spell": 'd',
  'but the spell guts and fizzles': 'd',
  "the target is open to the school's arts": 'd',
  "the caster marks the target's weakness well": 'd',
  "the caster's lightning bolt arcs into the target": 'd',
  'a fireball engulfs the target and will burn': 'd',
  'the caster raises a holy symbol': 'd',
  "the light closes the caster's hurts": 'd',
  "the holy light's damage": 'd',
  'the caster binds the target with spiritwrack': 'd',
  "psychic blast sears the target's mind": 'd',
  'a telekinetic storm rips the target': 'd',
  'the caster conjures a mirror image': 'd',
  'the caster weaves a second mirror image': 'd',
  'the caster conjures a phantom of the target': 'd',
  'the caster fades from sight': 'd',
  "the hand of death claims part of the target's health": 'd',
  "the caster's hand of death fails": 'd',
  "the caster's curse withers the target": 'd',
  "the caster's curse finds no ability": 'd',
  'the caster seizes the undead target': 'd',
  'control undead has no hold over the living': 'd',
  "the caster's charm washes over a crowned will": 'd',
  "the caster's charm slides off a mind lately swayed": 'd',
  "the caster's charm breaks against the target's will": 'd',
  "the caster charms the target's wits": 'd',
  'the caster casts a spell': 'd',
  'a fighter uses a power': 'd',
  'a power tears into the foe': 'd',
  'the guardian reaches for its own wounds again but the well is dry': 'd',
  'the guardian knits its wounds': 'd',
  'the foe reels from the blow, losing actions': 'd',
  'the foe is caught helpless, losing actions': 'd',
  'the foe is thrown off balance from the next round': 'd',
  'the foe is thrown off balance': 'd',
  "the foe's guard is beaten down next round": 'd',
  "the foe's guard is beaten down now": 'd',
  "the guardian's melee surges": 'd',
  'a power festers on the foe': 'd',
  'every blow against the guardian will bite back': 'd',
  'a ward shrouds the guardian': 'd',
  "death's touch tears the foe's strength in half": 'd',
  'the foe is struck down where they stand': 'd',
  'the foe cannot be gripped by it': 'd',
  'the foe must hold their nerve': 'd',
  'the foe is overcome with sheer terror': 'd',
  'the foe steels their nerve': 'd',
  'the foe feels dragged towards the creature': 'd',
  'a hero bears magic items into the fight': 'd',
  'the runner scrambles clear with a chance of dropping something': 'd',
  'in the rout the runner drops an item the one who stays claims': 'd',
  'a gained item noted': 'd',
  'the runner breaks off the duel and slips away': 'k',
  'the attacker meets the defender in a personal encounter': 'k',
  "the attacker goes for the defender's purse and comes away with nothing": 'k',
  "the attacker lifts gold from the defender's purse": 'k',
  "the attacker finds the defender's purse empty": 'k',
  'the one who flees breaks away and escapes': 'k',
  'the attacker is overwhelmed': 'k',
  'the defender is overcome': 'k',
  "the guardian has turned the hoard's magic to its own use": 'k',
  'the hero enters the feature': 'k',
  'within lurks the guardian blocking the path': 'k',
  'the guardian is already wounded by someone before': 'k',
  "the guardian's speed and plan": 'k',
  'after tense negotiations the guardian agrees': 'k',
  'the hero slips away with the prize': 'k',
  'the hero turns and flees from the guardian': 'k',
  'in the rout the hero drops an item into the hoard': 'd',
  'with a final effort the guardian is defeated': 'k',
  'the hero falls to their knees overwhelmed': 'k',
  'neither the hero nor the guardian gains the upper hand': 'k',
  'the guardian draws back into its lair': 'k',
  'the hero seizes the opening and counterattacks': 'd',
  'the counterstroke strikes the foe': 'd',
  'the hero lunges to counterattack but the foe recovers': 'd',
  "a fighter's attack fails, still reeling from a crippling wound": 'd',
  'a fighter attacks with a roll to hit': 'd',
  'a fighter strikes the foe': 'd',
  'a fighter drinks the wound': 'd',
  "the foe's shield lashes back": 'd',
  "the foe's thorns bite a fighter": 'd',
  "a fighter's blow is turned aside": 'd',
  'but a fighter is too dazed to punish it': 'd',
  'but a fighter is still reeling and the chance is lost': 'd',
  "a fighter takes a free strike at the foe's back": 'd',
  'a fighter lands the free strike': 'd',
  'the foe bursts into ash then blazes back to life': 'd',
  'the free strike misses': 'd',
  'a fighter tries to flee': 'd',
  'a fighter escapes the fight': 'd',
  'a fighter fails to get clear': 'd',
  'a fighter advances and the combatants close': 'd',
  'the foe looses a parting shot as a fighter comes on': 'd',
  'a fighter draws as they come and looses a snap shot': 'd',
  "a fighter's shot fails, still reeling from a crippling wound": 'd',
  'a fighter draws and looses a volley': 'd',
  'a fighter shoots with a roll to hit': 'd',
  "a fighter's shot hits the foe": 'd',
  "a fighter's arrow impales the foe": 'd',
  "a fighter's shot strikes a vital point": 'd',
  "a fighter's shot flies wide": 'd',
  "a guardian's perk is named": 'd',
  'a druid has hunted this kind of beast before': 'd',
  'one fighter has the initiative': 'd',
  'the victim fights their own mirror image': 'd',
  "but there is no escaping one's own reflection": 'd',
  'but an illusion cast upon an illusion': 'd',
  'the victim shatters the phantom': 'd',
  'the phantom of the victim thins to nothing': 'd',
  'the victim is struck down by their own mirror image': 'd',
  "a guardian's aura sears the foe": 'd',
  'the victim sees through the illusion': 'd',
  'a fighter takes a free strike at the foe': 'd',
  "a fighter's free strike lands": 'd',
  'a fighter finds their second wind and fights on': 'd',
  'as their strength fails a fighter begs the foe for mercy': 'd',
  'as the foe draws for the killing shot a fighter begs for their life': 'd',
  'pinned and bleeding a fighter cries out for mercy': 'd',
  'as the foe readies a power for the killing stroke a fighter begs': 'd',
  'beaten and bleeding a fighter sees the killing blow coming': 'd',
  'as the foe closes for the kill a fighter cries out for mercy': 'd',
  'a fighter drops to their knees before the final stroke': 'd',
  'the guardian pauses over its prey and lets a fighter crawl away': 'd',
  'the foe lets a fighter go': 'd',
  'the foe lowers their bow and lets a fighter go': 'd',
  'the foe lets a power die unspent': 'd',
  'the foe stays the blow and lets a fighter go': 'd',
  'the foe lowers their weapon in disgust and lets a fighter go': 'd',
  'the stroke never falls and the foe spares a fighter': 'd',
  'a fighter surrenders an item to the foe as the price of mercy': 'd',
  'the foe knows nothing of mercy': 'd',
  'the foe laughs at the plea': 'd',
  'the foe is deaf to the plea': 'd',
  'there is no pity in the foe': 'd',
  'a combat item strikes the foe': 'd',
  'a fighter uses a combat item': 'd',
  'a fighter recovers hit points': 'd',
  'warmth spreads through a fighter each round': 'd',
  'a fighter recovers hit points and every lingering affliction lifts': 'd',
  'a combat item blazes twice as bright against the foe': 'd',
  'a combat item keeps burning on the foe': 'd',
  'the foe is thrown off from the next round': 'd',
  'the foe reels losing actions from the next round': 'd',
  'a fighter drinks the stolen vigour': 'd',
  'the foe is held fast, losing actions': 'd',
  'the foe can barely see to strike': 'd',
  'the foe can barely see to strike for now': 'd',
  'the foe is sapped for the rest of the fight': 'd',
  'the foe is overcome with dread and flees': 'd',
  'the foe holds their ground badly shaken': 'd',
  "the foe's magic and powers are bound": 'd',
  'a fighter surges with strength': 'd',
  "a fighter's eye sharpens": 'd',
  'a ward settles over a fighter': 'd',
  'shimmering doubles step out of a fighter': 'd',
  'a fighter is ready to break away': 'd',
  'a fighter fades from sight the foe': 'd',
  'every poison burn and blinding on a fighter lifts': 'd',
  'but nothing happens': 'd',
  'a fighter is stunned and cannot act': 'd',
  'a fighter bound by spiritwrack cannot shoot and closes in': 'd',
  'a fighter has no ranged attack and presses forward': 'd',
  'a fighter gives ground and gets to firing range first': 'd',
  'a fighter moves up to firing range': 'd',
  'a fighter cannot close the distance in time': 'd',
  'a fighter tries to break away to firing range': 'd',
  'the foe stays right on top of a fighter': 'd',
  'a fighter disengages to bow range': 'd',
  "a fighter's power is bound and it attacks with tooth and claw": 'd',
  'a fighter gathers itself for a power but the moment slips away': 'd',
  'a fighter is silenced and cannot cast': 'd',
  'a fighter knows nothing of retreat': 'd',
  "a fighter calls for parley with a druid's roll": 'd',
  'the foe lowers its guard and stands aside': 'd',
  'the foe answers with a roar': 'd',
  'a fighter calls for parley but blades are already drawn': 'd',
  'a fighter has no thief skill and cannot steal': 'd',
  'a fighter slips past the guardian and seizes the prize': 'd',
  "a fighter's theft is noticed": 'd',
  'a fighter scouts the feature and its guardian': 'd',
  'a fighter scouts the ground but there is nothing to guard': 'd',
  'a fighter reads the ground and steadies their aim': 'd',
  'the target cannot be held': 'd',
  "a fighter's harm strikes a mirror image": 'd',
  'the first harm to reach the target is drunk by their armour': 'd',
  "the target's shield takes the blow square on": 'd',
  "the arrow glances off the target's shield": 'd',
  "the target's shield turns the harm away": 'd',
  "the ward on the target's shield soaks some of the harm": 'd',
  "the target's mithril armour turns aside some of the harm": 'd',
  "the hunter finds the target's weakness": 'd',
  "the hunter sees the target's weakness plainly now": 'd',
  "the target reads the beast's every move": 'd',
  'the target rolls with the blow and takes less': 'd',
  'the target takes the harm on raw fury': 'd',
  'a ward around the target drinks some of the blow': 'd',
  'the target parries turning aside some of the blow': 'd',
  "the target's elemental armour absorbs some of the harm": 'd',
  "the target's armour turns aside some of the harm": 'd',
  'the target turns aside all they can but the harm still lands': 'd',
  "the target's armour will not let any single hit bite deeper": 'd',
  'the target will not go down and restores hit points': 'd',
  'a fighter ignores the daze': 'd',
  "a fighter's armour sloughs off every burn poison and bleeding": 'd',
  "a guardian's regeneration knits its flesh": 'd',
  'a fighter has nothing left to knit': 'd',
  'a fighter shrugs off the daze, held steady by their armour': 'd',
  'a lingering harm afflicts a fighter': 'd',
  'a healing knits a fighter': 'd',
  'a fighter tears free of the spiritwrack': 'd',
  "a hero's hit points rise in a fight, for his realm alone": 'k',
  'the surgeons reach a fallen duellist too late, for his realm alone': 'k',
};

/** Whether a fact is one of a personal combat's lines (or of the two kinds for one realm alone). */
export function isAPersonalCombatsLine(fact: { kind: string }): fact is TheFactOfAPersonalCombatsLine {
  return Object.hasOwn(THE_AUDIENCE_OF_EACH_KIND_OF_A_PERSONAL_COMBATS_LINE, fact.kind);
}
