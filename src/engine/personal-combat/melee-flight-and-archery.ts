import { kcRng } from '../rng.ts';
import { temperOf } from '../world/tables.ts';
import { PC_MAX_LINGER_ROUNDS, pcPushDot } from './helpers.ts';
import { d100, rng } from '../dice-and-army-names.ts';
import { dispFloor } from '../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { discDuelVs, discSum } from '../discoveries.ts';
import { SKILLGAIN_STD, trySkillGain } from '../heroes/experience-skill-rises-and-earned-hp.ts';
import { pcHasRanged, pcRangeStep, pcSpeedOf } from './speed-encounter-plans-and-combatants.ts';
import {
  PC_HIT_MAX,
  PC_HIT_MIN,
  asItsGuardReadsIt,
  pcHitChance,
  pcHitSkill,
  pcMeleeDamage,
  pcSkillHitPct,
  pcSustainMult,
  pcTakeHit,
} from './to-hit-wounds-stuns-and-courage.ts';
import { narrate } from '../turn/events-and-their-audiences.ts';
import {
  aFightersPerkNameAsTheLineTellsIt,
  aFightersSkillAsTheLineTellsIt,
  aFightersWardAsTheLineTellsIt,
} from './the-facts-a-personal-combats-lines-record.ts';
import {
  whatAFightersWardsBiteBackWith,
  whatAFightersWardsTakeOffAChanceToHitHim,
} from '../rules/the-registry-of-magic-item-effects.ts';
import type { TurnContext } from '../turn/context.ts';
import type { NarrativeLine } from '../turn/events-and-their-audiences.ts';
import type { AFighterInAPersonalCombat } from './helpers.ts';

// Its types (plan P1-10b12): each parameter typed as wide as the body's guards (plan P1-10's Decision 2), so each guard
// stays; a fighter is AFighterInAPersonalCombat (helpers.ts). A fighter's status, a foe or the state's range that the
// code guards here but reads unguarded elsewhere is read through asItsGuardReadsIt (to-hit-wounds-stuns-and-courage.ts).
/** A hero as his experience is rolled (pcCombatXP): the skill rises waiting to be drawn this phase, which a guardian
 *  has none of (the save holds none: they are drawn before it is written). */
type AHeroAsHisPendingRisesAreRead = object & {
  readonly _sgPending?:
    | { readonly list?: readonly ({ readonly skill?: string | undefined } | null | undefined)[] | null | undefined }
    | null
    | undefined;
};
/** A fighter as his experience is rolled: his hero may be missing (the code guards it). */
interface AFighterAsHisExperienceIsRolled {
  readonly kind: AFighterInAPersonalCombat['kind'];
  readonly ref?: AHeroAsHisPendingRisesAreRead | null | undefined;
  _xpGained?: boolean | undefined;
}
/** A rule's switch (ARCHERY_PARTING_SHOT): on or off, not the one value it holds today. */
type ASwitchTurnedOnOrOff = boolean;
/** The fight's state as flight reads and writes it: who fled. */
interface TheFightAsFlightReadsIt {
  fledBy?: AFighterInAPersonalCombat | null | undefined;
}
/** The fight's state as an advance reads and writes it: the range the fighters stand at. */
interface TheFightAsAnAdvanceReadsIt {
  range: string;
}

// ── PERSONAL COMBAT: MELEE, FLIGHT AND ARCHERY (plan P1-08e: lifted out of resolveTurn) ────
// Experience from a hit, the riposte, a melee blow, flight and the free strike a failed flight gives, closing in, and
// archery (volleys, arrow damage and to-hit, the parting shot). pcCombatXP, pcTryCounter, pcMeleeStrike, pcFreeStrike,
// pcAttemptFlee, pcAdvanceOrStrike, pcFireShot, pcArrowHitChance and pcFireOne take the turn's context first
// (src/engine/turn/context.ts); the rest read no turn state.
// --- Shared attack routines -------------------------------------------------- MELEE L8
// (Counterattack): when a foe MISSES this hero, a 50% chance to riposte with a free melee blow.
// 2026-09-12b: a CAUTIOUS fighter ripostes too — 30% on a missed MELEE attack. Arrows cannot be
// riposted — there is nobody within reach to answer — but the Melee L8 perk keeps its old
// behaviour on both channels so nothing regresses. The two do not stack: the better chance is
// used.
// ── COMBAT EXPERIENCE (2026-09-29, Toby) ────
// A character rolls for experience on EVERY successful hit (melee blow, riposte, free strike,
// arrow) and every successful spell cast, as it happens — not once at the end for the victor. The
// first roll that succeeds ends it: no further experience rolls for that combatant in this fight.
// (The success becomes a phase candidate in trySkillGain; the one-rise-per-phase draw and every
// other guard there still apply.)
export function pcCombatXP(
  turnContext: TurnContext,
  cbt: AFighterAsHisExperienceIsRolled | null | undefined,
  skill: string,
  narrative: NarrativeLine[],
) {
  if (cbt?.kind !== 'character' || !cbt.ref || cbt._xpGained) return;
  const _had = !!(cbt.ref._sgPending && (cbt.ref._sgPending.list ?? []).some((e) => e?.skill === skill));
  trySkillGain(turnContext, cbt.ref, skill, SKILLGAIN_STD, narrative);
  const _p = cbt.ref._sgPending;
  if (!_had && _p && (_p.list ?? []).some((e) => e?.skill === skill)) cbt._xpGained = true;
}
export function pcTryCounter(
  turnContext: TurnContext,
  hero: AFighterInAPersonalCombat | null | undefined,
  foe: AFighterInAPersonalCombat | null | undefined,
  narrative: NarrativeLine[],
  chan: string,
) {
  if (!hero || !foe || hero.hp <= 0 || foe.hp <= 0) return;
  const _perk = hero.perkCounter ? 0.5 : 0;
  const _temper = chan === 'melee' ? temperOf(hero.temper).riposte || 0 : 0;
  const _chance = Math.max(_perk, _temper);
  if (_chance <= 0) return;
  if ((asItsGuardReadsIt(hero.status)?.stun ?? 0) > 0) return; // no riposte while stunned
  if (kcRng() >= _chance) return;
  const _ofItsTemper = _temper >= _perk && _temper > 0;
  const hit = pcHitChance(turnContext, hero, foe),
    roll = kcRng() * 100;
  if (roll < hit) {
    hero._didMelee = true;
    pcCombatXP(turnContext, hero, 'melee', narrative);
    const dmg = pcMeleeDamage(hero, foe);
    // 2026-09-23 (Toby item 8): announce the riposte BEFORE the blow is resolved. pcTakeHit
    // writes any ward / armour / parry line as it computes the damage, so with the announcement
    // coming after it, "🜏 Dracolich's Bone Plate turns aside 4 of the blow." sat directly under
    // "Dracolich's shot flies wide." — reading as if the armour had stopped a missed arrow — and
    // only then did the counterattack appear. Now: announce → armour → damage, the same order as
    // an ordinary strike ("attacks … ✓" → armour → "strikes … for N").
    narrate(narrative, {
      kind: 'the hero seizes the opening and counterattacks',
      heroName: hero.name,
      aRiposteOfItsTemper: _ofItsTemper,
      heroTemper: hero.temper,
    });
    const dealt = pcTakeHit(turnContext, foe, dmg, narrative, hero.name, 'counterattack');
    if (dealt)
      narrate(narrative, {
        kind: 'the counterstroke strikes the foe',
        foeName: foe.name,
        dealt,
        foeName2: foe.name,
        foeHp: Math.max(0, Math.round(foe.hp)),
      });
  } else {
    narrate(narrative, {
      kind: 'the hero lunges to counterattack but the foe recovers',
      heroName: hero.name,
      foeName: foe.name,
      aRiposteOfItsTemper: _ofItsTemper,
      heroTemper: hero.temper,
    });
  }
}
export function pcMeleeStrike(
  turnContext: TurnContext,
  actor: AFighterInAPersonalCombat,
  foe: AFighterInAPersonalCombat,
  narrative: NarrativeLine[],
) {
  // ARCHERY L8 (Trueshot) aftermath: a foe struck in a vital point sees their very next attack
  // fail.
  const _actorsStatus = asItsGuardReadsIt(actor.status);
  if (_actorsStatus && _actorsStatus.nextAttackFails > 0) {
    _actorsStatus.nextAttackFails--;
    narrate(narrative, {
      kind: "a fighter's attack fails, still reeling from a crippling wound",
      actorName: actor.name,
    });
    return;
  }
  const hit = pcHitChance(turnContext, actor, foe);
  // Roll-display fix (Sept 2026): the shown target and the shown roll are BOTH the integers the
  // engine actually compares (roll 1-100 <= rounded chance) — a displayed 82 vs target 82
  // succeeds.
  const hitI = dispFloor(hit),
    roll = d100();
  narrate(narrative, {
    kind: 'a fighter attacks with a roll to hit',
    actorName: actor.name,
    actorMelee: aFightersSkillAsTheLineTellsIt(actor, 'melee'),
    hitI,
    roll,
  });
  if (roll <= hitI) {
    actor._didMelee = true;
    pcCombatXP(turnContext, actor, 'melee', narrative);
    const dmg = pcMeleeDamage(actor, foe);
    const dealt = pcTakeHit(turnContext, foe, dmg, narrative, actor.name, 'blow');
    if (dealt)
      narrate(narrative, {
        kind: 'a fighter strikes the foe',
        actorName: actor.name,
        foeName: foe.name,
        dealt,
        foeHp: Math.max(0, Math.round(foe.hp)),
      });
    // guardian passive (Undying Thirst, Sanguine Feeding…) 2026-09-15: the thirst fades with the
    // fight, exactly as regeneration does — see pcSustainMult. A vampire drinks deep early and
    // runs dry if the duel is drawn out.
    if (dealt && actor.drain !== undefined && actor.drain > 0 && actor.hp < (actor.maxHp || 20)) {
      const _sm = pcSustainMult(actor),
        _dr = Math.min(Math.round(dealt * actor.drain * _sm), (actor.maxHp || 20) - actor.hp);
      if (_dr > 0) {
        actor.hp += _dr;
        narrate(narrative, {
          kind: 'a fighter drinks the wound',
          actorName: actor.name,
          dr: _dr,
          sm: _sm,
          actorDrainPerk: aFightersPerkNameAsTheLineTellsIt(actor, 'drain'),
          actorHp: dispFloor(actor.hp),
        });
      }
    }
    // Brimstone-style shields bite back at whoever lands a blow.
    if (dealt && foe.status.reflect > 0) {
      actor.hp -= foe.status.reflect;
      narrate(narrative, {
        kind: "the foe's shield lashes back",
        foeName: foe.name,
        foeStatusReflect: foe.status.reflect,
        actorName: actor.name,
        actorHp: Math.max(0, Math.round(actor.hp)),
      });
    }
    const _bite = dealt ? whatAFightersWardsBiteBackWith(foe.arm) : null; // each ward's effect in the items' registry (plan P1-19r)
    if (_bite) {
      // Thornwood Cuirass
      actor.hp -= _bite.theHarm;
      narrate(narrative, {
        kind: "the foe's thorns bite a fighter",
        foeIsAGuardian: foe.kind === 'monster',
        foesThornsWard: aFightersWardAsTheLineTellsIt(foe, _bite.theWardTheLineNames),
        foeName: foe.name,
        actorName: actor.name,
        foeArmThorns: _bite.theHarm,
        actorName2: actor.name,
        actorHp: Math.max(0, Math.round(actor.hp)),
      });
    }
  } else {
    narrate(narrative, { kind: "a fighter's blow is turned aside", actorName: actor.name });
    pcTryCounter(turnContext, foe, actor, narrative, 'melee');
  }
}
// ── FLEE: ONE routine for both flight paths ────
// Both now call pcAttemptFlee.
// base 30% · vs a SLOW monster +25 / vs a FAST one −15 · + temper fleeMod ·
// + fleeBonus (Invisibility, Smoke Bomb, Potion of Fleetness) − fleePenalty (Undertow Curse) ·
// Charm doubles · clamped 5–95.
// A FAILED escape turns the runner's back: the foe takes a bonus free melee attack. Only one flee
// attempt per combatant per round — an action-phase attempt suppresses the end-of-round
// break-off, so nobody eats two free strikes in one round.
export function pcFleeChance(actor: AFighterInAPersonalCombat, foe: AFighterInAPersonalCombat) {
  const spd = foe.kind === 'monster' ? pcSpeedOf(foe) : 2;
  let chance =
    30 +
    (spd === 1 ? 25 : spd === 3 ? -15 : 0) +
    temperOf(actor.temper).fleeMod +
    (actor.status.fleeBonus || 0) -
    (actor.status.fleePenalty || 0);
  if (actor.status.fleeDoubled) chance *= 2; // Charm combat effect
  return Math.max(5, Math.min(95, dispFloor(chance)));
}
export function pcFreeStrike(
  turnContext: TurnContext,
  actor: AFighterInAPersonalCombat | null | undefined,
  foe: AFighterInAPersonalCombat | null | undefined,
  narrative: NarrativeLine[],
) {
  // A bonus melee attack outside the normal exchange. No riposte on a miss (the target is
  // running).
  if (!actor || !foe || actor.hp <= 0 || foe.hp <= 0) return;
  const _actorsStatus = asItsGuardReadsIt(actor.status);
  if (_actorsStatus && _actorsStatus.stun > 0) {
    narrate(narrative, { kind: 'but a fighter is too dazed to punish it', actorName: actor.name });
    return;
  }
  if (_actorsStatus && _actorsStatus.nextAttackFails > 0) {
    _actorsStatus.nextAttackFails--;
    narrate(narrative, { kind: 'but a fighter is still reeling and the chance is lost', actorName: actor.name });
    return;
  }
  const hitI = dispFloor(pcHitChance(turnContext, actor, foe)),
    roll = d100();
  narrate(narrative, {
    kind: "a fighter takes a free strike at the foe's back",
    actorName: actor.name,
    foeName: foe.name,
    actorMelee: aFightersSkillAsTheLineTellsIt(actor, 'melee'),
    hitI,
    roll,
  });
  if (roll <= hitI) {
    actor._didMelee = true;
    pcCombatXP(turnContext, actor, 'melee', narrative);
    const dealt = pcTakeHit(turnContext, foe, pcMeleeDamage(actor, foe), narrative, actor.name, 'free strike');
    if (dealt)
      narrate(narrative, {
        kind: 'a fighter lands the free strike',
        actorName: actor.name,
        dealt,
        foeName: foe.name,
        foeHp: Math.max(0, Math.round(foe.hp)),
      });
    if (foe.hp <= 0 && foe._rebirth) {
      foe._rebirth = false;
      foe.hp = Math.max(5, Math.round(foe.maxHp * 0.4));
      narrate(narrative, {
        kind: 'the foe bursts into ash then blazes back to life',
        foeName: foe.name,
        foeHp: foe.hp,
      });
    }
  } else narrate(narrative, { kind: 'the free strike misses' });
}
export function pcAttemptFlee(
  turnContext: TurnContext,
  actor: AFighterInAPersonalCombat,
  foe: AFighterInAPersonalCombat,
  narrative: NarrativeLine[],
  state: TheFightAsFlightReadsIt,
  how?: string,
) {
  if (actor.neverFlees) return false;
  actor._fleeAttempted = true;
  const chance = pcFleeChance(actor, foe),
    roll = d100();
  narrate(narrative, {
    kind: 'a fighter tries to flee',
    itsTemperBreaksItOff: how === 'temper',
    actorName: actor.name,
    actorTemper: actor.temper,
    chance,
    roll,
  });
  if (roll <= chance) {
    state.fledBy = actor;
    narrate(narrative, { kind: 'a fighter escapes the fight', actorName: actor.name });
    return true;
  }
  narrate(narrative, { kind: 'a fighter fails to get clear', actorName: actor.name });
  pcFreeStrike(turnContext, foe, actor, narrative);
  return false;
}
export function pcAdvanceOrStrike(
  turnContext: TurnContext,
  actor: AFighterInAPersonalCombat,
  foe: AFighterInAPersonalCombat,
  narrative: NarrativeLine[],
  state: TheFightAsAnAdvanceReadsIt,
) {
  if (state.range !== 'melee') {
    //a FAST guardian closes two range slots in one advance (spell → melee at once);
    // everyone else, slow guardians included, closes one — slowness is no penalty to advancing.
    const _steps = actor.kind === 'monster' && pcSpeedOf(actor) >= 3 ? 2 : 1;
    const _from = state.range;
    const _to = pcRangeStep(state.range, _steps);
    if (_to === undefined) return; // (made sure: pcRangeStep keeps its index within the three ranges)
    state.range = _to;
    narrate(narrative, {
      kind: 'a fighter advances and the combatants close',
      actorName: actor.name,
      steps: _steps,
      stateRange: state.range,
    });
    // PARTING SHOT — an archer at bow range looses one arrow as the foe comes on into melee. Only
    // a CHARACTER with a bow, only when the step actually ends in melee, and never while stunned
    // or bound by Spiritwrack. A surge from spell range straight to melee still grants it: the
    // arrow is loosed at the charge, whatever ground it started from.
    if (
      ARCHERY_PARTING_SHOT &&
      state.range === 'melee' &&
      _from !== 'melee' &&
      asItsGuardReadsIt(foe) &&
      foe.kind === 'character' &&
      pcHasRanged(foe) &&
      !((asItsGuardReadsIt(foe.status)?.stun ?? 0) > 0) &&
      !((asItsGuardReadsIt(foe.status)?.silenceRounds ?? 0) > 0) &&
      foe.hp > 0
    ) {
      narrate(narrative, {
        kind: 'the foe looses a parting shot as a fighter comes on',
        foeName: foe.name,
        actorName: actor.name,
      });
      pcFireOne(turnContext, foe, actor, narrative);
      if (actor.hp <= 0) return;
    }
    // ── ADVANCE AND STRIKE (2026-09-27, Toby item 7) ────────────────────────────────────────────
    // Closing the distance is no longer the whole action. Once the step is taken, the attacker
    // attacks if the new range allows it: a charge that ends in melee lands its blow, and a
    // charge that ends at bow range looses a single snap shot if the attacker carries a bow.
    // (Spells and monster specials were never range-gated, so they never lost a round to moving;
    // only the melee closer did, and a fight that opens at spell range cost a plain fighter TWO
    // rounds of standing still before they could swing. Both sides gain this alike.)
    // A shot or a blow is still refused to anyone stunned this round or bound by Spiritwrack, and
    // a foe already down is not struck again.
    if (!asItsGuardReadsIt(foe) || foe.hp <= 0 || actor.hp <= 0) return;
    if ((asItsGuardReadsIt(actor.status)?.stun ?? 0) > 0) return;
    if (state.range === 'melee') {
      pcMeleeStrike(turnContext, actor, foe, narrative);
      return;
    }
    if (state.range === 'bow' && pcHasRanged(actor) && !((asItsGuardReadsIt(actor.status)?.silenceRounds ?? 0) > 0)) {
      narrate(narrative, { kind: 'a fighter draws as they come and looses a snap shot', actorName: actor.name });
      pcFireOne(turnContext, actor, foe, narrative);
    }
    return;
  }
  pcMeleeStrike(turnContext, actor, foe, narrative);
}
// ── Archery ────
// Skill buys accuracy, weight of fire AND penetration. A trained archer (Archery 3+) looses two
// arrows per Fire action, and every third level of skill adds a point of damage. Without the last
// two, archery damage stayed a flat 1d6 at every level while melee damage scaled with skill
// advantage — which made raising Archery actively worse than spending the
// same points on Melee (measured: equal-level archer duel win rate fell 8.5% → 0.3% across
// levels 1–5). Archers also pay a positioning tax melee never does: a failed advance or a failed
// withdrawal consumes the whole Fire action.
export const ARCHERY_VOLLEY_AT = 3; // arrows per Fire action becomes 2 at this skill level
// ARCHERY FIELDCRAFT and the PARTING SHOT. Measured, the bow's whole problem was positioning, not
// damage — every fight opens at spell range, closing to bow range is a 60% roll and breaking out
// of a melee a 40% one, and a failed roll eats the entire action. A fully-trained Bow got 4 shots
// a fight against a Stone Golem and 1.4 against a Sea Wyrm. Two rules fix it without touching
// anyone who does not carry a bow:
// · FIELDCRAFT — a character adds ARCHERY_FIELDCRAFT_PCT × their RAW Archery to BOTH range checks
// (advancing to firing range, breaking out of melee). Archery 6 turns the break-away from 40% to 70%.
// · PARTING SHOT — when a foe steps from bow range INTO melee, a character standing at bow range with a
// bow looses one arrow first (the mirror of the free strike a fleeing enemy eats). Characters only:
// it is a perk of the skill, not a property of every creature that can spit.
// Bow vs Stone Golem 85% → 99%, vs Sea Wyrm 81% → 100%; Blade / Sword & bow / Archmage figures unchanged.
export const ARCHERY_PARTING_SHOT: ASwitchTurnedOnOrOff = true; // typed a switch, so its test still reads it when it is off
export function pcVolleySize(cbt: Pick<AFighterInAPersonalCombat, 'archery'>) {
  return (cbt.archery || 0) >= ARCHERY_VOLLEY_AT ? 2 : 1;
}
export function pcArrowDamage(cbt: Pick<AFighterInAPersonalCombat, 'archery' | 'archeryRaw'>) {
  const _ask = cbt.archeryRaw ?? (cbt.archery || 0);
  return rng(1, 3) + Math.ceil(_ask / 2);
} // Sept 2026 redesign: was floor(Archery/3); raw skill (1–9) for characters · 2026-10-14 (Toby item 20): base 1–3, was 2–5
export function pcFireShot(
  turnContext: TurnContext,
  actor: AFighterInAPersonalCombat,
  foe: AFighterInAPersonalCombat,
  narrative: NarrativeLine[],
) {
  // ARCHERY L8 (Trueshot) aftermath: a crippled foe's whole volley goes to nothing.
  const _actorsStatus = asItsGuardReadsIt(actor.status);
  if (_actorsStatus && _actorsStatus.nextAttackFails > 0) {
    _actorsStatus.nextAttackFails--;
    narrate(narrative, { kind: "a fighter's shot fails, still reeling from a crippling wound", actorName: actor.name });
    return;
  }
  const volley = pcVolleySize(actor);
  if (volley > 1)
    narrate(narrative, {
      kind: 'a fighter draws and looses a volley',
      actorName: actor.name,
      volley,
      actorArchery: aFightersSkillAsTheLineTellsIt(actor, 'archery'),
    });
  for (let v = 0; v < volley && foe.hp > 0; v++) pcFireOne(turnContext, actor, foe, narrative);
}
// ONE archery to-hit, the mirror of pcHitChance.
// (a) ignored the target's Invisibility-type reduction (Invisibility, Potion of Invisibility, Grey Cloak Draught,
// Potion of Fleetness…), so arrows went straight through "foe −25% to hit you"; (b) applied the
// dodge multiplier AFTER the 5–95 clamp; and (c) rolled a hidden float, showing the chance only
// on a miss. The defender's temper GUARD does not turn arrows — guard is a melee trait.
// 2026-09-12: archery follows melee exactly — +5%/level past 5, modifiers off the real figure,
// hard 80% ceiling.
export function pcArrowHitChance(
  turnContext: Pick<TurnContext, 'G'>,
  actor: AFighterInAPersonalCombat,
  foe: AFighterInAPersonalCombat,
) {
  let chance = pcSkillHitPct(pcHitSkill(actor, 'archery'));
  chance += temperOf(actor.temper).archeryHit;
  chance -=
    (actor.status.hitPenalty || 0) + (actor.status.hitPenaltyFixed || 0) + (Number(actor.status.auraPenalty) || 0);
  chance += Number(actor.status.hitBonus) || 0;
  chance -= Number(foe.status.toHitReduce) || 0;
  chance -= whatAFightersWardsTakeOffAChanceToHitHim(foe.arm);
  if (actor.player != null) chance += discSum(turnContext, actor.player, 'duelHit', 'pct', (e) => discDuelVs(e, foe)); // duelHit discoveries
  chance = chance * (foe.status.dodge || 1);
  return Math.max(PC_HIT_MIN, Math.min(PC_HIT_MAX, dispFloor(chance)));
}
export function pcFireOne(
  turnContext: TurnContext,
  actor: AFighterInAPersonalCombat,
  foe: AFighterInAPersonalCombat,
  narrative: NarrativeLine[],
) {
  const hit = pcArrowHitChance(turnContext, actor, foe),
    roll = d100();
  narrate(narrative, {
    kind: 'a fighter shoots with a roll to hit',
    actorName: actor.name,
    actorArchery: aFightersSkillAsTheLineTellsIt(actor, 'archery'),
    hit,
    roll,
  });
  if (roll <= hit) {
    actor._didArchery = true;
    pcCombatXP(turnContext, actor, 'archery', narrative);
    const d = pcArrowDamage(actor);
    const dealt = pcTakeHit(turnContext, foe, d, narrative, actor.name, 'arrow');
    if (dealt)
      narrate(narrative, {
        kind: "a fighter's shot hits the foe",
        actorName: actor.name,
        foeName: foe.name,
        dealt,
        foeHp: Math.max(0, Math.round(foe.hp)),
      });
    // ARCHERY L6 (Impalement): 50% chance a hit lodges, bleeding the foe 1-3 each round — capped
    // at three rounds.
    if (dealt && actor.perkImpale && foe.hp > 0 && kcRng() < 0.5) {
      const _imp = pcPushDot(foe, rng(1, 3), PC_MAX_LINGER_ROUNDS, {
        kind: "an archer's impaling arrow",
        archerName: actor.name,
      });
      // (pcPushDot gives none only for a foe of no status, whose line below threw before: it throws here)
      if (!_imp) throw new TypeError("Cannot read properties of null (reading 'dmg')");
      narrate(narrative, {
        kind: "a fighter's arrow impales the foe",
        actorName: actor.name,
        foeName: foe.name,
        impDmg: _imp.dmg,
        impRounds: _imp.rounds,
      });
    }
    // ARCHERY L8 (Trueshot): 50% chance the shot finds a vital — the foe's next attack
    // automatically fails.
    if (dealt && actor.perkTrueshot && foe.hp > 0 && kcRng() < 0.5) {
      foe.status.nextAttackFails = (foe.status.nextAttackFails || 0) + 1;
      narrate(narrative, { kind: "a fighter's shot strikes a vital point", actorName: actor.name, foeName: foe.name });
    }
  } else {
    narrate(narrative, { kind: "a fighter's shot flies wide", actorName: actor.name });
    pcTryCounter(turnContext, foe, actor, narrative, 'archery');
  }
}
