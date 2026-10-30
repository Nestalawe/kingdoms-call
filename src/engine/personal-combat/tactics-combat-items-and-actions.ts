import { kcRng } from '../rng.ts';
import { NPC_SCHOOL_SPELL, STEAL_TIER_PEN } from '../army-tables.ts';
import { encounterClearGold, ensureLairHoard, temperOf } from '../world/tables.ts';
import { activeItems, type AHeroAsHisItemsAreRead, type AnItemAsTheSlotsReadIt } from '../items/equipment.ts';
import {
  aFighterReachesForTheCombatItemNow,
  theChanceAThiefsItemsAddToHisSteal,
  theMultiplierOfACombatItemsBlowAgainst,
  theUsesOfTheCombatItemsInTheOrderAFighterReachesForThem,
  whatACombatItemDoesWhenUsed,
} from '../rules/the-registry-of-magic-item-effects.ts';
import { guardianPassives } from '../heroes/skills-and-hp.ts';
import { PARLEY_ENABLED, SCOUT_ENABLED, pcDeferEffect, pcLearnWeakness, pcPushDot } from './helpers.ts';
import { pcFoeCat } from '../titles/perks.ts';
import { d100, rng } from '../dice-and-army-names.ts';
import { dispFloor } from '../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { SKILLGAIN_COMMON, trySkillGain } from '../heroes/experience-skill-rises-and-earned-hp.ts';
import { pcHasRanged, pcMoveCheck } from './speed-encounter-plans-and-combatants.ts';
import { pcHitSkill, pcLandStun, pcStunTurned, pcTakeHit } from './to-hit-wounds-stuns-and-courage.ts';
import { pcCastCombatSpell, pcMonsterSpecial } from './combat-spells-and-guardian-abilities.ts';
import { theChanceAThiefsSpellsAddToHisSteal } from '../rules/the-registry-of-spell-effects.ts';
import type { AMirrorImageInAFight } from './combat-spells-and-guardian-abilities.ts';
import { pcAdvanceOrStrike, pcAttemptFlee, pcFireShot, pcMeleeStrike } from './melee-flight-and-archery.ts';
import { narrate } from '../turn/events-and-their-audiences.ts';
import {
  aListAsTheLineTellsIt,
  theItemsAsTheLineNamesThem,
  theNamesAndDescriptionsAsTheLineTellsThem,
  theNamesAsTheLineTellsThem,
} from './the-facts-a-personal-combats-lines-record.ts';
import { asItsGuardReadsIt } from './to-hit-wounds-stuns-and-courage.ts';
import type { TurnContext } from '../turn/context.ts';
import type { NarrativeLine } from '../turn/events-and-their-audiences.ts';
import type { Item } from '../../schemas/saved-game-state.ts';
import type {
  AFighterInAPersonalCombat,
  AFightersSchools,
  AFightersStatus,
  AGuardiansPerk,
  AGuardiansSpecial,
} from './helpers.ts';

// Its types (plan P1-10b13): each parameter typed as wide as the body's guards (plan P1-10's Decision 2), so each guard
// stays; a fighter is AFighterInAPersonalCombat (helpers.ts). A fighter's hero or guardian, his foe or a field of his
// that the code guards here but reads unguarded elsewhere is read through asItsGuardReadsIt
// (to-hit-wounds-stuns-and-courage.ts).
/** A combat item as these read it: its name, its words, and its effect (the saved item's), which the code guards. */
interface ACombatItemAsItIsUsed {
  readonly name: string;
  readonly desc?: string | undefined;
  readonly effect?: Item['effect'] | null | undefined;
}
/** A combat item's effect as these read it: the saved item's, or none (`{}`). */
type ACombatItemsEffect = Partial<Item['effect']>;
/** A fighter as his items are weighed and used: his hero or guardian may be missing (the code guards it). */
type AFighterAsHisItemsAreUsed = Omit<AFighterInAPersonalCombat, 'ref'> & {
  readonly ref?: AFighterInAPersonalCombat['ref'] | null | undefined;
};
/** A fighter as an item's moment is weighed: his status may be missing too (the code guards it). */
type AFighterAsHisItemsMomentIsWeighed = Omit<AFighterAsHisItemsAreUsed, 'status'> & {
  readonly status?: AFightersStatus | null | undefined;
};
/** The foe as an item's moment is weighed against him: his specials and schools may be missing (the code guards
 *  them). */
type AFoeAsAnItemsMomentIsWeighed = Omit<AFighterInAPersonalCombat, 'specials' | 'school'> & {
  readonly specials?: readonly unknown[] | null | undefined;
  readonly school?: Partial<AFightersSchools> | null | undefined;
};
/** A lair as the Scout reads it: its name, its hoard and what thieves took from it. */
interface ALairAsTheScoutReadsIt {
  readonly name: string;
  readonly hoardItems?: Item[] | null | undefined;
  readonly _stolenItems?: string[] | null | undefined;
  scouted?: boolean | undefined;
}
/** The fight's state as an action reads and writes it: the range, who fled, stole or talked the guardian down, and the
 *  lair (none in a duel). */
interface TheFightAsAnActionReadsIt {
  range: string;
  fledBy?: AFighterInAPersonalCombat | null | undefined;
  stoleBy?: AFighterInAPersonalCombat | null | undefined;
  parley?: boolean | undefined;
  readonly feature?: ALairAsTheScoutReadsIt | null | undefined;
  /** The Mirror Image a spell conjures (pcCastCombatSpell), none until one is cast. */
  mirror?: AMirrorImageInAFight | null | undefined;
}
/** A fighter's hero or guardian as the theft and the Scout read a guardian's fields (a hero has none of them). */
type AGuardianAsTheTheftAndTheScoutReadHim = object & {
  readonly power?: string | undefined;
  readonly hp?: number | undefined;
  readonly _hpFull?: number | null | undefined;
  readonly spells?: readonly AGuardiansSpecial[] | null | undefined;
  readonly desc?: string | undefined;
  readonly passives?: (AGuardiansPerk | null | undefined)[] | null | undefined;
  readonly passive?: AGuardiansPerk | null | undefined;
};

/** A damage range as the dice read it (`dmg[0]`, `dmg[1]`): an element missing is NaN to the dice, as `undefined` was;
 *  an item of no range threw there, and still does, the same TypeError. */
function aDamageRangeAsTheDiceReadIt(range: readonly number[] | null | undefined): [low: number, high: number] {
  if (!range) throw new TypeError(`Cannot read properties of ${String(range)} (reading '0')`);
  return [Number(range[0]), Number(range[1])];
}

// ── PERSONAL COMBAT: TACTICS, COMBAT ITEMS AND EACH ACTION (plan P1-08e: lifted out of resolveTurn) ────
// What a combatant does once their plan is spent (Temper), the potions, scrolls and devices carried into a fight, and
// one combatant's action against the foe (pcAct). pcTryCombatItem, pcUseCombatItem and pcAct take the turn's context
// first (src/engine/turn/context.ts); the rest read no turn state.
// --- Tactic selection -------------------------------------------------------- Once a plan is
// spent, Temper takes over: fight on, or look for a way out. Monsters never flee — they fight to
// the last.
export function pcTemperFallback(actor: AFighterInAPersonalCombat, foe: AFighterInAPersonalCombat) {
  const tt = temperOf(actor.temper);
  const ratio = actor.hp / (actor.maxHp || 20);
  // once a character's chosen encounter actions are spent, they DEFAULT to attacking with melee
  // every round. Above their temper's flee threshold they simply fight on…
  if (ratio >= tt.fleeAt) return 'ME';
  // …a Brave-type only entertains flight when actually behind on HP, otherwise fights on…
  if (tt.losingOnly && actor.hp >= foe.hp) return 'ME';
  // …and below the threshold they STILL default to melee, but their temper's fleeUrge is the
  // per-round chance they break off and try to flee instead (Cowardly bolts often, Berserk
  // rarely). fleeUrge 0 (e.g. a monster/None temper) means they never flee — they just keep
  // swinging.
  if ((tt.fleeUrge || 0) > 0 && kcRng() < tt.fleeUrge) return 'FL';
  return 'ME';
}
export function pcNextTactic(actor: AFighterInAPersonalCombat, foe: AFighterInAPersonalCombat) {
  if (actor.tacIdx < actor.tactics.length) {
    const t = actor.tactics[actor.tacIdx];
    actor.tacIdx++;
    return (t ?? '') || 'ME';
  }
  if (!actor.planExhausted) {
    actor.planExhausted = true;
  }
  if (actor.neverFlees) return 'ME';
  return pcTemperFallback(actor, foe);
}

// --- Combat-use items ------------------------------------- Potions, scrolls and devices carried
// into a personal fight. Each fires ONCE per fight (never consumed), costs the user's action, and
// only when it makes sense — the trigger table below. Characters bring their equipped/active
// combatUse items; a guardian brings the lair's items its category lets it wield.
export const _CI_PRIORITY = theUsesOfTheCombatItemsInTheOrderAFighterReachesForThem(); // the items' registry's order (plan P1-19s)
export function pcCombatItemWanted(
  actor: AFighterAsHisItemsMomentIsWeighed,
  foe: AFoeAsAnItemsMomentIsWeighed,
  it: ACombatItemAsItIsUsed,
  state: unknown,
) {
  const e: ACombatItemsEffect = it.effect ?? {};
  const ratio = actor.hp / (actor.maxHp || 20);
  const st: Partial<AFightersStatus> = actor.status ?? {};
  // whether the item's moment has come: its use's effect in the items' registry (plan P1-19s)
  return aFighterReachesForTheCombatItemNow(e, {
    theShareOfHisHpLeft: ratio,
    hisHp: actor.hp,
    hisMaximumHp: actor.maxHp || 20,
    hisStatus: st,
    heNeverFlees: actor.neverFlees,
    theFoesKind: () => pcFoeCat(foe),
    theFoeHasPowers: () => (foe.specials ?? []).length > 0 || Object.values(foe.school ?? {}).some((v) => (v || 0) > 0),
  });
}
export function pcTryCombatItem(
  turnContext: TurnContext,
  actor: AFighterAsHisItemsAreUsed,
  foe: AFighterInAPersonalCombat,
  narrative: NarrativeLine[],
  state: TheFightAsAnActionReadsIt,
) {
  const list: readonly (ACombatItemAsItIsUsed | null | undefined)[] = actor.combatItems ?? [];
  if (!list.length) return false;
  const itemsUsed = (actor._itemsUsed ??= new Set());
  let pick: ACombatItemAsItIsUsed | null | undefined = null;
  for (const use of _CI_PRIORITY) {
    pick = list.find(
      (it) => it?.effect?.use === use && !itemsUsed.has(it.name) && pcCombatItemWanted(actor, foe, it, state),
    );
    if (pick) break;
  }
  if (!pick) return false;
  itemsUsed.add(pick.name);
  pcUseCombatItem(turnContext, actor, foe, pick, narrative, state);
  if (actor.kind === 'character' && actor.ref)
    trySkillGain(turnContext, actor.ref, 'sage', SKILLGAIN_COMMON, narrative); // 2026-09-21: using a magic item may teach Sage (small chance)
  return true;
}
export function pcUseCombatItem(
  turnContext: Pick<TurnContext, 'G'>,
  actor: AFighterAsHisItemsAreUsed,
  foe: AFighterInAPersonalCombat,
  it: ACombatItemAsItIsUsed,
  narrative: NarrativeLine[],
  state: TheFightAsAnActionReadsIt,
) {
  const e: ACombatItemsEffect = it.effect ?? {};
  const nm = it.name;
  const st = actor.status;
  const fs = foe.status;
  const who = actor.kind === 'monster' ? `The ${actor.name}` : actor.name;
  const hurt = (d: number, label?: string) => {
    const dealt = pcTakeHit(turnContext, foe, d, narrative, actor.name, (label ?? '') || nm);
    if (dealt)
      narrate(narrative, {
        kind: 'a combat item strikes the foe',
        nm,
        foeName: foe.name,
        dealt,
        foeHp: Math.max(0, Math.round(foe.hp)),
      });
    return dealt;
  };
  narrate(narrative, { kind: 'a fighter uses a combat item', who, nm });
  // what the item's use does: its effect in the items' registry (plan P1-19s); the fight applies it, draws its dice
  // where it drew them and tells its lines
  const does = whatACombatItemDoesWhenUsed({ desc: it.desc, effect: e });
  if (!does) {
    narrate(narrative, { kind: 'but nothing happens' });
    return;
  }
  switch (does.does) {
    case 'restores his hit points': {
      const h = Math.min(does.theHp, Math.max(0, (actor.maxHp || 20) - actor.hp));
      actor.hp += h;
      narrate(narrative, { kind: 'a fighter recovers hit points', who, healed: h, actorHp: dispFloor(actor.hp) });
      break;
    }
    case 'warms him each round': {
      st.hot = { amt: does.theHp, rounds: does.theRounds, label: nm };
      narrate(narrative, {
        kind: 'warmth spreads through a fighter each round',
        actorName: actor.name,
        eAmt: e.amt,
        eRounds: e.rounds,
      });
      break;
    }
    case 'restores his hit points and lifts every lingering harm': {
      const h = Math.min(does.theHp, Math.max(0, (actor.maxHp || 20) - actor.hp));
      actor.hp += h;
      st.dot = [];
      st.hitPenalty = 0;
      st.hitPenaltyFixed = 0;
      narrate(narrative, {
        kind: 'a fighter recovers hit points and every lingering affliction lifts',
        who,
        healed: h,
        actorHp: dispFloor(actor.hp),
      });
      break;
    }
    case 'strikes the foe': {
      const times = does.theTimes;
      for (let i = 0; i < times && foe.hp > 0; i++) {
        let d = rng(...aDamageRangeAsTheDiceReadIt(does.theDamageRange));
        const _twice = theMultiplierOfACombatItemsBlowAgainst(e, pcFoeCat(foe)); // bane's double (the items' registry)
        if (_twice !== null) {
          d *= _twice;
          narrate(narrative, { kind: 'a combat item blazes twice as bright against the foe', nm, foeName: foe.name });
        }
        hurt(d);
      }
      const lingering = does.theLingeringHarm;
      if (lingering && foe.hp > 0) {
        const _de = pcPushDot(foe, lingering[0], lingering[1], nm);
        if (_de)
          narrate(narrative, {
            kind: 'a combat item keeps burning on the foe',
            nm,
            foeName: foe.name,
            deDmg: _de.dmg,
            deRounds: _de.rounds,
          });
      }
      // these ride on the damage the item just dealt, so they grip from the NEXT round. (A
      // pure-penalty or pure-stun item — 'holds the foe' / 'blinds the foe' below — still bites now.)
      const hitPen = does.thePenaltyFromTheNextRound; // read once, for the riders below (no fight writes an item's effect)
      const stun = does.theDazeFromTheNextRound;
      if (hitPen && foe.hp > 0) {
        pcDeferEffect(foe, () => {
          fs.hitPenalty = (fs.hitPenalty || 0) + hitPen;
        });
        narrate(narrative, { kind: 'the foe is thrown off from the next round', foeName: foe.name, eHitPen: hitPen });
      }
      if (stun && foe.hp > 0) {
        if (pcStunTurned(foe, narrative, `the ${nm}'s daze`)) {
          /* turned (batch item 3) */
        } else {
          pcDeferEffect(foe, () => {
            fs.stun = (fs.stun || 0) + stun;
          });
          narrate(narrative, {
            kind: 'the foe reels losing actions from the next round',
            foeName: foe.name,
            eStun: stun,
          });
        }
      }
      break;
    }
    case 'drains the foe': {
      const d = rng(...aDamageRangeAsTheDiceReadIt(does.theDamageRange));
      const dealt = hurt(d);
      const h = Math.min(dealt, Math.max(0, (actor.maxHp || 20) - actor.hp));
      actor.hp += h;
      if (h > 0)
        narrate(narrative, {
          kind: 'a fighter drinks the stolen vigour',
          who,
          healed: h,
          actorHp: dispFloor(actor.hp),
        });
      break;
    }
    case 'holds the foe': {
      if (pcLandStun(foe, does.theRounds, narrative, `the ${nm}`))
        narrate(narrative, {
          kind: 'the foe is held fast, losing actions',
          foeName: foe.name,
          eStun: does.theRounds,
        });
      break;
    }
    case 'blinds the foe': {
      // an item that says "for the rest of the fight" no longer fades 5% a round
      if (does.forTheRestOfTheFight) {
        fs.hitPenaltyFixed = (fs.hitPenaltyFixed || 0) + does.thePenalty;
        narrate(narrative, {
          kind: 'the foe can barely see to strike',
          foeName: foe.name,
          eHitPen: does.thePenalty,
        });
      } else {
        fs.hitPenalty = (fs.hitPenalty || 0) + does.thePenalty;
        narrate(narrative, {
          kind: 'the foe can barely see to strike for now',
          foeName: foe.name,
          eHitPen: does.thePenalty,
        });
      }
      break;
    }
    // 2026-10-08 (item 2): a character's to-hit and damage read the RAW skill (meleeRaw /
    // archeryRaw), so sap those too — lowering only `melee` did nothing to a hero.
    case 'saps the foe': {
      const { theMelee, theArchery } = does;
      if (theMelee) {
        foe.melee = Math.max(0, (foe.melee || 0) - theMelee);
        if (foe.meleeRaw != null) foe.meleeRaw = Math.max(0, foe.meleeRaw - theMelee);
      }
      if (theArchery) {
        foe.archery = Math.max(0, (foe.archery || 0) - theArchery);
        if (foe.archeryRaw != null) foe.archeryRaw = Math.max(0, foe.archeryRaw - theArchery);
      }
      narrate(narrative, {
        kind: 'the foe is sapped for the rest of the fight',
        foeName: foe.name,
        foeMelee: pcHitSkill(foe, 'melee'),
        eArchery: theArchery,
        foeArchery: pcHitSkill(foe, 'archery'),
      });
      break;
    }
    case 'may send the foe fleeing': {
      if (!foe.neverFlees && kcRng() < does.theChanceTheFoeFlees) {
        state.fledBy = foe;
        narrate(narrative, { kind: 'the foe is overcome with dread and flees', foeName: foe.name });
      } else {
        fs.hitPenalty = (fs.hitPenalty || 0) + does.thePenaltyIfHeHolds;
        narrate(narrative, {
          kind: 'the foe holds their ground badly shaken',
          foeName: foe.name,
          eHitPen: does.thePenaltyIfHeHolds,
        });
      }
      break;
    }
    case "binds the foe's powers": {
      fs.silenceRounds = (fs.silenceRounds || 0) + does.theRounds;
      narrate(narrative, {
        kind: "the foe's magic and powers are bound",
        foeName: foe.name,
        eRounds: does.theRounds,
      });
      break;
    }
    case 'strengthens him': {
      if (does.theMelee) actor.melee = (actor.melee || 0) + does.theMelee;
      if (does.theArchery) actor.archery = (actor.archery || 0) + does.theArchery;
      narrate(narrative, {
        kind: 'a fighter surges with strength',
        who,
        actorMelee: actor.melee,
        eArchery: does.theArchery,
        actorArchery: actor.archery,
      });
      break;
    }
    case 'sharpens his eye': {
      st.hitBonus = (Number(st.hitBonus) || 0) + does.theBonus;
      narrate(narrative, { kind: "a fighter's eye sharpens", who, eHitBonus: does.theBonus });
      break;
    }
    case 'wards him': {
      st.absorb = (st.absorb || 0) + does.theWard;
      if (does.theReflect) {
        st.reflect = (st.reflect || 0) + does.theReflect;
      }
      narrate(narrative, {
        kind: 'a ward settles over a fighter',
        actorName: actor.name,
        stAbsorb: st.absorb,
        eReflect: does.theReflect,
        stReflect: st.reflect,
      });
      break;
    }
    case 'sends his images out': {
      st.mirrorImages = (st.mirrorImages || 0) + does.theImages;
      narrate(narrative, {
        kind: 'shimmering doubles step out of a fighter',
        eImages: does.theImages,
        actorName: actor.name,
      });
      break;
    }
    case 'readies him to break away': {
      st.fleeBonus = (st.fleeBonus || 0) + does.theFleeBonus;
      if (does.theUnseen) st.toHitReduce = (Number(st.toHitReduce) || 0) + does.theUnseen;
      narrate(narrative, {
        kind: 'a fighter is ready to break away',
        who,
        eFleeBonus: does.theFleeBonus,
        eToHitReduce: does.theUnseen,
      });
      break;
    }
    case 'hides him': {
      st.toHitReduce = (Number(st.toHitReduce) || 0) + does.theUnseen;
      narrate(narrative, {
        kind: 'a fighter fades from sight the foe',
        who,
        foeName: foe.name,
        eToHitReduce: does.theUnseen,
      });
      break;
    }
    case 'lifts every lingering harm': {
      st.dot = [];
      st.hitPenalty = 0;
      st.hitPenaltyFixed = 0;
      narrate(narrative, { kind: 'every poison burn and blinding on a fighter lifts', actorName: actor.name });
      break;
    }
  }
}

// --- One combatant performs their next action against the foe --------------- Actions alternate
// strictly, one per combatant per round, in initiative order.
export function pcAct(
  turnContext: TurnContext,
  actor: AFighterInAPersonalCombat,
  foe: AFighterInAPersonalCombat,
  narrative: NarrativeLine[],
  state: TheFightAsAnActionReadsIt,
) {
  const { G } = turnContext;
  if (actor.status.stun > 0) {
    narrate(narrative, {
      kind: 'a fighter is stunned and cannot act',
      actorName: actor.name,
      actorStatusStun: actor.status.stun,
    });
    actor.status.stun--;
    return;
  }
  // a once-per-fight potion/scroll, used when the moment is right, IS the round's action.
  if (pcTryCombatItem(turnContext, actor, foe, narrative, state)) return;
  const tactic = pcNextTactic(actor, foe);
  const colon = tactic.indexOf(':');
  const code = (colon >= 0 ? tactic.slice(0, colon) : tactic).toUpperCase();
  const arg = colon >= 0 ? tactic.slice(colon + 1) : null;

  switch (code) {
    case 'ME':
    case 'MELEE': {
      // Three ranges: spell → bow → melee. A Melee action at longer range CLOSES the distance
      // one step; only at melee range does it actually strike.
      pcAdvanceOrStrike(turnContext, actor, foe, narrative, state);
      break;
    }
    case 'FI':
    case 'FIRE':
    case 'ARROW': {
      if (actor.status.silenceRounds > 0) {
        narrate(narrative, {
          kind: 'a fighter bound by spiritwrack cannot shoot and closes in',
          actorName: actor.name,
        });
        pcAdvanceOrStrike(turnContext, actor, foe, narrative, state);
        break;
      }
      if (!pcHasRanged(actor)) {
        narrate(narrative, { kind: 'a fighter has no ranged attack and presses forward', actorName: actor.name });
        pcAdvanceOrStrike(turnContext, actor, foe, narrative, state);
        break;
      }
      // A Fire action means: get to firing range, then shoot. Speed decides whether the move
      // succeeds — closing the gap, or breaking back out of a melee the foe is holding.
      if (state.range === 'spell') {
        // 2026-09-12b: a COWARDLY fighter's whole identity is the bow, and it was worth little
        // because they still had to win a move check to reach firing range at all. Their FIRST
        // move up to bow range in a fight simply succeeds — they were never going to close
        // anyway.
        if (temperOf(actor.temper).openingShot && !actor._openingShotUsed) {
          actor._openingShotUsed = true;
          state.range = 'bow';
          narrate(narrative, {
            kind: 'a fighter gives ground and gets to firing range first',
            actorName: actor.name,
            actorTemper: actor.temper,
          });
          pcFireShot(turnContext, actor, foe, narrative);
          break;
        }
        const ch = dispFloor(pcMoveCheck(actor, foe, 'advance')),
          roll = d100();
        narrate(narrative, {
          kind: 'a fighter moves up to firing range',
          actorName: actor.name,
          rangeChance: ch,
          roll,
        });
        if (roll > ch) {
          narrate(narrative, { kind: 'a fighter cannot close the distance in time', actorName: actor.name });
          break;
        }
        state.range = 'bow';
      } else if (state.range === 'melee' && actor.kind === 'monster') {
        // 2026-10-14 (batch item 2): a GUARDIAN never tries to back out of a melee to shoot — at
        // sword's length its Fire action is a blow (no break-away roll, so no round lost to one).
        pcMeleeStrike(turnContext, actor, foe, narrative);
        break;
      } else if (state.range === 'melee') {
        const ch = dispFloor(pcMoveCheck(actor, foe, 'withdraw')),
          roll = d100();
        narrate(narrative, {
          kind: 'a fighter tries to break away to firing range',
          actorName: actor.name,
          rangeChance: ch,
          roll,
        });
        if (roll > ch) {
          narrate(narrative, {
            kind: 'the foe stays right on top of a fighter',
            foeName: foe.name,
            actorName: actor.name,
          });
          break;
        }
        state.range = 'bow';
        narrate(narrative, { kind: 'a fighter disengages to bow range', actorName: actor.name });
      }
      pcFireShot(turnContext, actor, foe, narrative);
      break;
    }
    case 'MS': {
      // monster special ability — the creature's equivalent of Cast
      const specials: readonly (AGuardiansSpecial | null | undefined)[] = asItsGuardReadsIt(actor.specials) ?? [];
      const sp = specials.find((s) => s?.name === arg);
      if (!sp) {
        pcAdvanceOrStrike(turnContext, actor, foe, narrative, state);
        break;
      }
      // 2026-10-14 (batch item 1): a bound or fumbled special no longer COSTS the round — the
      // guardian makes an ordinary attack instead, exactly as a hero whose spell fails does (no
      // side ever stands idle for a failed power; only a stun does that). It is still ONE action:
      // the special did nothing, so the attack is all the guardian does this round.
      if (actor.status.silenceRounds > 0) {
        narrate(narrative, {
          kind: "a fighter's power is bound and it attacks with tooth and claw",
          actorName: actor.name,
          foeName: foe.name,
        });
        pcAdvanceOrStrike(turnContext, actor, foe, narrative, state);
        break;
      }
      const cc = sp.castChance ?? 50;
      if (kcRng() * 100 >= cc) {
        narrate(narrative, {
          kind: 'a fighter gathers itself for a power but the moment slips away',
          actorName: actor.name,
          spName: sp.name,
          castChancePct: cc,
        });
        pcAdvanceOrStrike(turnContext, actor, foe, narrative, state);
        break;
      }
      pcMonsterSpecial(turnContext, actor, foe, sp, narrative, state);
      break;
    }
    case 'CA':
    case 'SPELL': {
      // 2026-10-14 (batch item 1): a spell that cannot be cast (silenced, no skill, already cast,
      // the school's limit reached) or that fizzles becomes an ordinary attack — the round is not lost.
      if (actor.status.silenceRounds > 0) {
        narrate(narrative, { kind: 'a fighter is silenced and cannot cast', actorName: actor.name });
        pcAdvanceOrStrike(turnContext, actor, foe, narrative, state);
        break;
      }
      // Choose the spell: explicit CA:Name, else best available combat spell.
      let name: string | null | undefined = arg;
      if (!name) {
        // the schools and the spell of each read by any school's name
        const levelIn: Readonly<Partial<Record<string, number>>> = { ...actor.school };
        const spellOf: Readonly<Partial<Record<string, string>>> = NPC_SCHOOL_SPELL;
        const best = ['elemental', 'necromancy', 'white', 'psychic', 'illusory'].reduce(
          (b, s) => ((Number(levelIn[s]) || 0) > (Number(levelIn[b]) || 0) ? s : b),
          'elemental',
        );
        name = spellOf[best];
      } // tie-break ORDER — deliberately not KC_MAGIC_SCHOOLS
      if (!pcCastCombatSpell(turnContext, actor, foe, name, narrative, state))
        pcAdvanceOrStrike(turnContext, actor, foe, narrative, state);
      break;
    }
    case 'FL':
    case 'FLEE': {
      if (actor.neverFlees) {
        narrate(narrative, { kind: 'a fighter knows nothing of retreat', actorName: actor.name });
        pcAdvanceOrStrike(turnContext, actor, foe, narrative, state);
        break;
      }
      pcAttemptFlee(turnContext, actor, foe, narrative, state, 'plan'); // items 3–5: shared flee routine
      break;
    }
    case 'TA':
    case 'TALK': {
      // "take the Parley/Talk tactic out of the game for now. I may add it in again later." The
      // mechanic below is intact and correct — it is simply switched off, the same way
      // pcCourageChance was left in place at 109.1 when no guardian used it any more. A saved
      // encounter plan from a live game may still carry 'TA', so this must not silently keep
      // working: with the flag off the tactic falls through to an ordinary attack, exactly as an
      // unusable tactic does. To restore: set PARLEY_ENABLED to true and drop `retired` from
      // ENCOUNTER_TACTICS in BOTH portals, restore the Scout report's "a Druid could talk it
      // down" clause, and put the Druid bullet and the Monster-Bane half-credit clause back in
      // the rulebook.
      if (!PARLEY_ENABLED) {
        pcAdvanceOrStrike(turnContext, actor, foe, narrative, state);
        break;
      }
      if (foe.kind === 'monster') {
        const dr = actor.kind === 'character' ? effStat(turnContext, actor.ref, 'druid') : 0;
        const chance = foe.pacifiable === false ? 0 : 20 + dr * 15;
        const roll = d100();
        narrate(narrative, {
          kind: "a fighter calls for parley with a druid's roll",
          actorName: actor.name,
          dr,
          chance,
          roll,
        });
        if (chance > 0 && roll <= chance) {
          state.parley = true;
          narrate(narrative, { kind: 'the foe lowers its guard and stands aside', foeName: foe.name });
        } else narrate(narrative, { kind: 'the foe answers with a roar', foeName: foe.name });
      } else
        narrate(narrative, { kind: 'a fighter calls for parley but blades are already drawn', actorName: actor.name });
      break;
    }
    case 'ST':
    case 'STEAL': {
      const th = actor.kind === 'character' ? effStat(turnContext, actor.ref, 'thief') : 0;
      if (th < 1) {
        narrate(narrative, { kind: 'a fighter has no thief skill and cannot steal', actorName: actor.name });
        pcAdvanceOrStrike(turnContext, actor, foe, narrative, state);
        break;
      }
      let bonus = temperOf(actor.temper).stealMod;
      bonus += theChanceAThiefsSpellsAddToHisSteal(actor.castSpells); // Invisibility: +15% (the spells' registry, plan P1-19x)
      const actorsHero: (object & AHeroAsHisItemsAreRead<AnItemAsTheSlotsReadIt>) | null | undefined =
        asItsGuardReadsIt(actor.ref);
      if (actorsHero) bonus += theChanceAThiefsItemsAddToHisSteal(activeItems(actorsHero)); // Lock-Pick of Legends: +20% steal chance (the items' registry, plan P1-19s)
      // Tougher guardians watch their hoard more closely — a flat penalty by tier. A master thief
      // can still rob a Legendary beast, but a novice has little hope of it.
      const STEAL_TIER_PENALTY: Readonly<Partial<Record<string, number>>> = { ...STEAL_TIER_PEN };
      const foesGuardian: AGuardianAsTheTheftAndTheScoutReadHim | null | undefined = asItsGuardReadsIt(
        asItsGuardReadsIt(foe)?.ref,
      );
      const _tier = (foesGuardian?.power ?? '') || 'Weak';
      const tierPen = STEAL_TIER_PENALTY[_tier] ?? 0; // the table holds no NaN
      const chance = Math.max(5, Math.min(95, 50 + 10 * Math.min(th, 5) + bonus - tierPen));
      if (kcRng() * 100 < chance) {
        state.stoleBy = actor;
        narrate(narrative, {
          kind: 'a fighter slips past the guardian and seizes the prize',
          actorName: actor.name,
          tier: _tier,
          chance,
          tierPen,
        });
      } else
        narrate(narrative, {
          kind: "a fighter's theft is noticed",
          actorName: actor.name,
          chance,
          tierPen,
          tier: _tier,
        });
      break;
    }
    case 'SC':
    case 'SCOUT': {
      // "Remove the Scout tactic from the game for now, I may add it back in later." Switched
      // off, not deleted — as with Parley. A saved encounter plan in a live game may still carry
      // 'SC', so it must fall through to an ordinary attack rather than keep working invisibly.
      // To restore: set SCOUT_ENABLED true, drop `retired` from the SC entry in ENCOUNTER_TACTICS
      // in BOTH portals, and put the Explorer bullet back in the rulebook.
      if (!SCOUT_ENABLED) {
        pcAdvanceOrStrike(turnContext, actor, foe, narrative, state);
        break;
      }
      const ex = actor.kind === 'character' ? effStat(turnContext, actor.ref, 'explorer') : 0;
      const b = ex * 5;
      // Scout is no longer a no-op — it reveals what the guardian is worth. It reports the
      // guardian's identity/power and remaining HP, the gold hoard behind it, and the magic-item
      // outlook for clearing it (mirroring the clear-reward ladder by tier). Reading the ground
      // also still steadies the hand for the current exchange (Explorer × 5% off the hit
      // penalty).
      const feat = state.feature;
      if (feat && asItsGuardReadsIt(foe)?.kind === 'monster') {
        const foesGuardian: AGuardianAsTheTheftAndTheScoutReadHim | null | undefined = asItsGuardReadsIt(foe.ref);
        const power = foesGuardian?.power ?? ''; // a grade '' or none: '', as before
        const curHp = Math.max(0, Math.round(asItsGuardReadsIt(foe.hp) ?? (Number(foesGuardian?.hp) || 0)));
        const fullHp = Math.round(foesGuardian?._hpFull ?? ((foesGuardian?.hp ?? 0) || curHp));
        // report the EXACT gold a clearer will take (rolled and locked now), plus only the
        // magic-item outlook — no more double gold statement (a "hoard of about Xg" AND a "~3-8g"
        // range).
        ensureLairHoard(feat, G);
        const clearGold = encounterClearGold(feat);
        // the hoard is fixed at world gen, so Scout names the ACTUAL items — and notes any a
        // thief has already lifted, and which the guardian has turned against challengers.
        const _hi = feat.hoardItems ?? [],
          _st = feat._stolenItems ?? [];
        const _wielded = foe.wielded ?? [];
        // Abilities — the guardian's special powers (its spell list).
        const spells = foesGuardian?.spells ?? [];
        // Weaknesses / resistances — read the guardian's damage-type vulnerabilities (0.4-1.8; >1
        // means it takes MORE from that type, <1 means it shrugs it off).
        const v = foe.vuln ?? { melee: 1, archery: 1, spell: 1 };
        // the one thing worth scouting for — the guardian's exploitable weakness. Reading it here
        // teaches the realm for good, so the flaw is on the order form next turn.
        if (foe.weak) {
          if (actor.player != null) pcLearnWeakness(G, actor.player, foe.name);
        }
        // the Scout report no longer offers to talk a beast down — the Talk tactic is withdrawn
        // (PARLEY_ENABLED). The `pacifiable` trait itself is left on the creature data so nothing
        // has to be re-derived when it comes back.
        narrate(narrative, {
          kind: 'a fighter scouts the feature and its guardian',
          actorName: actor.name,
          featName: feat.name,
          foeName: foe.name,
          power,
          curHp,
          fullHp,
          foeDesc: foesGuardian === null ? null : foesGuardian?.desc, // a hero or guardian of none: none, as before
          spellNames: theNamesAsTheLineTellsThem(spells.slice(0, 4)),
          passives: theNamesAndDescriptionsAsTheLineTellsThem(guardianPassives(foesGuardian)), // passives are scouted too
          vulnerabilities: { melee: v.melee, archery: v.archery, spell: v.spell },
          weakness: foe.weak ? { name: foe.weak.name, desc: foe.weak.desc } : null,
          aDruidCouldTalkItDown: PARLEY_ENABLED && foe.pacifiable,
          clearGold,
          hoardItems: theItemsAsTheLineNamesThem(_hi),
          stolenItemNames: aListAsTheLineTellsIt(_st),
          wieldedItemNames: theNamesAsTheLineTellsThem(_wielded),
        });
        feat.scouted = true;
      } else {
        narrate(narrative, {
          kind: 'a fighter scouts the ground but there is nothing to guard',
          actorName: actor.name,
        });
      }
      // Scout only ever CANCELLED fading to-hit penalties (it never added a bonus) — the line now
      // says so.
      if (b > 0) {
        const _had = actor.status.hitPenalty || 0,
          _cut = Math.min(_had, b);
        actor.status.hitPenalty = _had - _cut;
        if (_cut > 0)
          narrate(narrative, {
            kind: 'a fighter reads the ground and steadies their aim',
            actorName: actor.name,
            cut: _cut,
            ex,
          });
      }
      break;
    }
    // a 'CS' tactic is a battle-magic-phase school choice — it has NO place in personal combat
    // (vs guardians/other characters). The personal-combat plan-filter already drops CS:, so this
    // is only a safety net; if one slips through it now falls through to a normal strike instead
    // of printing a meaningless "holds their battle-magic ready" line.
    case 'CS':
    default:
      pcAdvanceOrStrike(turnContext, actor, foe, narrative, state);
  }
}
