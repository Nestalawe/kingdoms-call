import { kcRng } from '../rng.ts';
import { temperOf } from '../world/tables.ts';
import { PC_MAX_LINGER_ROUNDS, pcPushDot } from './helpers.ts';
import { d100, dispFloor, rng } from '../dice-and-army-names.ts';
import { discDuelVs, discSum } from '../discoveries.ts';
import { SKILLGAIN_STD, trySkillGain } from '../heroes/experience-skill-rises-and-earned-hp.ts';
import { pcHasRanged, pcRangeStep, pcSkillLabel, pcSpeedOf } from './speed-encounter-plans-and-combatants.ts';
import {
  PC_HIT_MAX,
  PC_HIT_MIN,
  pcHitChance,
  pcHitSkill,
  pcMeleeDamage,
  pcPerkWord,
  pcSkillHitPct,
  pcSustainMult,
  pcTakeHit,
  pcWardIcon,
  pcWardWord,
} from './to-hit-wounds-stuns-and-courage.ts';

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
export function pcCombatXP(turnContext, cbt, skill, narrative) {
  if (!cbt || cbt.kind !== 'character' || !cbt.ref || cbt._xpGained) return;
  const _had = !!(cbt.ref._sgPending && (cbt.ref._sgPending.list || []).some((e) => e && e.skill === skill));
  trySkillGain(turnContext, cbt.ref, skill, SKILLGAIN_STD, narrative);
  const _p = cbt.ref._sgPending;
  if (!_had && _p && (_p.list || []).some((e) => e && e.skill === skill)) cbt._xpGained = true;
}
export function pcTryCounter(turnContext, hero, foe, narrative, chan) {
  if (!hero || !foe || hero.hp <= 0 || foe.hp <= 0) return;
  const _perk = hero.perkCounter ? 0.5 : 0;
  const _temper = chan === 'melee' ? temperOf(hero.temper).riposte || 0 : 0;
  const _chance = Math.max(_perk, _temper);
  if (_chance <= 0) return;
  if (hero.status && hero.status.stun > 0) return; // no riposte while stunned
  if (kcRng() >= _chance) return;
  const _src = _temper >= _perk && _temper > 0 ? `${hero.temper} riposte` : 'Counterattack';
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
    narrative.push(`  ↩ ${hero.name} seizes the opening and counterattacks! (${_src})`);
    const dealt = pcTakeHit(turnContext, foe, dmg, narrative, hero.name, 'counterattack');
    if (dealt)
      narrative.push(
        `  ↩ The counterstroke strikes ${foe.name} for ${dealt} damage! (${foe.name} HP ${Math.max(0, Math.round(foe.hp))})`,
      );
  } else {
    narrative.push(`  ↩ ${hero.name} lunges to counterattack, but ${foe.name} recovers in time. (${_src})`);
  }
}
export function pcMeleeStrike(turnContext, actor, foe, narrative) {
  // ARCHERY L8 (Trueshot) aftermath: a foe struck in a vital point sees their very next attack
  // fail.
  if (actor.status && actor.status.nextAttackFails > 0) {
    actor.status.nextAttackFails--;
    narrative.push(`  ${actor.name} is still reeling from a crippling wound — the attack fails. (Trueshot)`);
    return;
  }
  const hit = pcHitChance(turnContext, actor, foe);
  // Roll-display fix (Sept 2026): the shown target and the shown roll are BOTH the integers the
  // engine actually compares (roll 1-100 <= rounded chance) — a displayed 82 vs target 82
  // succeeds.
  const hitI = dispFloor(hit),
    roll = d100();
  narrative.push(
    `  ${actor.name} attacks (${pcSkillLabel(actor, 'melee')}, ${hitI}% to hit [roll ${roll}]${roll <= hitI ? ' ✓' : ' ✗'})`,
  );
  if (roll <= hitI) {
    actor._didMelee = true;
    pcCombatXP(turnContext, actor, 'melee', narrative);
    const dmg = pcMeleeDamage(actor, foe);
    const dealt = pcTakeHit(turnContext, foe, dmg, narrative, actor.name, 'blow');
    if (dealt)
      narrative.push(
        `  ${actor.name} strikes ${foe.name} for ${dealt} damage! (HP ${Math.max(0, Math.round(foe.hp))})`,
      );
    // guardian passive (Undying Thirst, Sanguine Feeding…) 2026-09-15: the thirst fades with the
    // fight, exactly as regeneration does — see pcSustainMult. A vampire drinks deep early and
    // runs dry if the duel is drawn out.
    if (dealt && actor.drain > 0 && actor.hp < (actor.maxHp || 20)) {
      const _sm = pcSustainMult(actor),
        _dr = Math.min(Math.round(dealt * actor.drain * _sm), (actor.maxHp || 20) - actor.hp);
      if (_dr > 0) {
        actor.hp += _dr;
        narrative.push(
          `  ${actor.name} drinks the wound — +${_dr} HP${_sm < 1 ? ' (the thirst is running dry)' : ''}. (${pcPerkWord(actor, 'drain', 'Drain')}, HP ${dispFloor(actor.hp)})`,
        );
      }
    }
    // Brimstone-style shields bite back at whoever lands a blow.
    if (dealt && foe.status.reflect > 0) {
      actor.hp -= foe.status.reflect;
      narrative.push(
        `  ${foe.name}'s shield lashes back for ${foe.status.reflect} damage. (${actor.name} HP ${Math.max(0, Math.round(actor.hp))})`,
      );
    }
    if (dealt && foe.arm && foe.arm.thorns > 0) {
      // Thornwood Cuirass
      actor.hp -= foe.arm.thorns;
      narrative.push(
        `  ${pcWardIcon(foe)} ${foe.kind === 'monster' ? pcWardWord(foe, 'hide', 'thorns') : `${foe.name}'s thorned armour`} bites ${actor.name} for ${foe.arm.thorns}. (${actor.name} HP ${Math.max(0, Math.round(actor.hp))})`,
      );
    }
  } else {
    narrative.push(`  ${actor.name}'s blow is turned aside.`);
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
export function pcFleeChance(actor, foe) {
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
export function pcFreeStrike(turnContext, actor, foe, narrative) {
  // A bonus melee attack outside the normal exchange. No riposte on a miss (the target is
  // running).
  if (!actor || !foe || actor.hp <= 0 || foe.hp <= 0) return;
  if (actor.status && actor.status.stun > 0) {
    narrative.push(`  …but ${actor.name} is too dazed to punish it.`);
    return;
  }
  if (actor.status && actor.status.nextAttackFails > 0) {
    actor.status.nextAttackFails--;
    narrative.push(`  …but ${actor.name} is still reeling and the chance is lost. (Trueshot)`);
    return;
  }
  const hitI = dispFloor(pcHitChance(turnContext, actor, foe)),
    roll = d100();
  narrative.push(
    `  ⚔ ${actor.name} takes a free strike at ${foe.name}'s back (${pcSkillLabel(actor, 'melee')}, ${hitI}% to hit [roll ${roll}]${roll <= hitI ? ' ✓' : ' ✗'})`,
  );
  if (roll <= hitI) {
    actor._didMelee = true;
    pcCombatXP(turnContext, actor, 'melee', narrative);
    const dealt = pcTakeHit(turnContext, foe, pcMeleeDamage(actor, foe), narrative, actor.name, 'free strike');
    if (dealt)
      narrative.push(
        `  ${actor.name} lands it for ${dealt} damage! (${foe.name} HP ${Math.max(0, Math.round(foe.hp))})`,
      );
    if (foe.hp <= 0 && foe._rebirth) {
      foe._rebirth = false;
      foe.hp = Math.max(5, Math.round(foe.maxHp * 0.4));
      narrative.push(`  🔥 ${foe.name} bursts into ash — then blazes back to life! (HP ${foe.hp})`);
    }
  } else narrative.push(`  The free strike misses.`);
}
export function pcAttemptFlee(turnContext, actor, foe, narrative, state, how) {
  if (actor.neverFlees) return false;
  actor._fleeAttempted = true;
  const chance = pcFleeChance(actor, foe),
    roll = d100();
  const lead =
    how === 'temper'
      ? `${actor.name} (${actor.temper}) loses the stomach for the fight and tries to break off`
      : `${actor.name} attempts to flee`;
  narrative.push(`  🏃 ${lead} (${chance}% [roll ${roll}]${roll <= chance ? ' ✓' : ' ✗'})`);
  if (roll <= chance) {
    state.fledBy = actor;
    narrative.push(`  ${actor.name} escapes the fight!`);
    return true;
  }
  narrative.push(`  ${actor.name} fails to get clear.`);
  pcFreeStrike(turnContext, foe, actor, narrative);
  return false;
}
export function pcAdvanceOrStrike(turnContext, actor, foe, narrative, state) {
  if (state.range !== 'melee') {
    //a FAST guardian closes two range slots in one advance (spell → melee at once);
    // everyone else, slow guardians included, closes one — slowness is no penalty to advancing.
    const _steps = actor.kind === 'monster' && pcSpeedOf(actor) >= 3 ? 2 : 1;
    const _from = state.range;
    state.range = pcRangeStep(state.range, +_steps);
    narrative.push(
      `  ${actor.name} ${_steps > 1 ? 'surges forward' : 'advances'} — the combatants close to ${state.range} range.`,
    );
    // PARTING SHOT — an archer at bow range looses one arrow as the foe comes on into melee. Only
    // a CHARACTER with a bow, only when the step actually ends in melee, and never while stunned
    // or bound by Spiritwrack. A surge from spell range straight to melee still grants it: the
    // arrow is loosed at the charge, whatever ground it started from.
    if (
      ARCHERY_PARTING_SHOT &&
      state.range === 'melee' &&
      _from !== 'melee' &&
      foe &&
      foe.kind === 'character' &&
      pcHasRanged(foe) &&
      !(foe.status && foe.status.stun > 0) &&
      !(foe.status && foe.status.silenceRounds > 0) &&
      foe.hp > 0
    ) {
      narrative.push(`  🏹 ${foe.name} looses an arrow as ${actor.name} comes on. (parting shot)`);
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
    if (!foe || foe.hp <= 0 || actor.hp <= 0) return;
    if (actor.status && actor.status.stun > 0) return;
    if (state.range === 'melee') {
      pcMeleeStrike(turnContext, actor, foe, narrative);
      return;
    }
    if (state.range === 'bow' && pcHasRanged(actor) && !(actor.status && actor.status.silenceRounds > 0)) {
      narrative.push(`  ${actor.name} draws as they come and looses a snap shot.`);
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
export const ARCHERY_FIELDCRAFT_PCT = 5;
export const ARCHERY_PARTING_SHOT = true;
export function pcVolleySize(cbt) {
  return (cbt.archery || 0) >= ARCHERY_VOLLEY_AT ? 2 : 1;
}
export function pcArrowDamage(cbt) {
  const _ask = cbt.archeryRaw != null ? cbt.archeryRaw : cbt.archery || 0;
  return rng(1, 3) + Math.ceil(_ask / 2);
} // Sept 2026 redesign: was floor(Archery/3); raw skill (1–9) for characters · 2026-10-14 (Toby item 20): base 1–3, was 2–5
export function pcFireShot(turnContext, actor, foe, narrative) {
  // ARCHERY L8 (Trueshot) aftermath: a crippled foe's whole volley goes to nothing.
  if (actor.status && actor.status.nextAttackFails > 0) {
    actor.status.nextAttackFails--;
    narrative.push(`  ${actor.name} is still reeling from a crippling wound — the shot fails. (Trueshot)`);
    return;
  }
  const volley = pcVolleySize(actor);
  if (volley > 1)
    narrative.push(
      `  ${actor.name} draws and looses a volley of ${volley} arrows (${pcSkillLabel(actor, 'archery')}).`,
    );
  for (let v = 0; v < volley && foe.hp > 0; v++) pcFireOne(turnContext, actor, foe, narrative);
}
// ONE archery to-hit, the mirror of pcHitChance.
// (a) ignored the target's Invisibility-type reduction (Invisibility, Potion of Invisibility, Grey Cloak Draught,
// Potion of Fleetness…), so arrows went straight through "foe −25% to hit you"; (b) applied the
// dodge multiplier AFTER the 5–95 clamp; and (c) rolled a hidden float, showing the chance only
// on a miss. The defender's temper GUARD does not turn arrows — guard is a melee trait.
// 2026-09-12: archery follows melee exactly — +5%/level past 5, modifiers off the real figure,
// hard 80% ceiling.
export function pcArrowHitChance(turnContext, actor, foe) {
  let chance = pcSkillHitPct(pcHitSkill(actor, 'archery'));
  chance += temperOf(actor.temper).archeryHit;
  chance -= (actor.status.hitPenalty || 0) + (actor.status.hitPenaltyFixed || 0) + (actor.status.auraPenalty || 0);
  chance += actor.status.hitBonus || 0;
  chance -= foe.status.toHitReduce || 0;
  chance -= (foe.arm && foe.arm.dodge) || 0;
  if (actor.player != null) chance += discSum(turnContext, actor.player, 'duelHit', 'pct', (e) => discDuelVs(e, foe)); // duelHit discoveries
  chance = chance * (foe.status.dodge || 1);
  return Math.max(PC_HIT_MIN, Math.min(PC_HIT_MAX, dispFloor(chance)));
}
export function pcFireOne(turnContext, actor, foe, narrative) {
  const hit = pcArrowHitChance(turnContext, actor, foe),
    roll = d100();
  narrative.push(
    `  ${actor.name} shoots (${pcSkillLabel(actor, 'archery')}, ${hit}% to hit [roll ${roll}]${roll <= hit ? ' ✓' : ' ✗'})`,
  );
  if (roll <= hit) {
    actor._didArchery = true;
    pcCombatXP(turnContext, actor, 'archery', narrative);
    const d = pcArrowDamage(actor);
    const dealt = pcTakeHit(turnContext, foe, d, narrative, actor.name, 'arrow');
    if (dealt)
      narrative.push(
        `  ${actor.name}'s shot hits ${foe.name} for ${dealt} damage. (HP ${Math.max(0, Math.round(foe.hp))})`,
      );
    // ARCHERY L6 (Impalement): 50% chance a hit lodges, bleeding the foe 1-3 each round — capped
    // at three rounds.
    if (dealt && actor.perkImpale && foe.hp > 0 && kcRng() < 0.5) {
      const _imp = pcPushDot(foe, rng(1, 3), PC_MAX_LINGER_ROUNDS, `${actor.name}'s impaling arrow`);
      narrative.push(
        `  🩸 ${actor.name}'s arrow impales ${foe.name} — it will bleed ${_imp.dmg} a round for ${_imp.rounds} rounds. (Impalement)`,
      );
    }
    // ARCHERY L8 (Trueshot): 50% chance the shot finds a vital — the foe's next attack
    // automatically fails.
    if (dealt && actor.perkTrueshot && foe.hp > 0 && kcRng() < 0.5) {
      foe.status.nextAttackFails = (foe.status.nextAttackFails || 0) + 1;
      narrative.push(
        `  🎯 ${actor.name}'s shot strikes a vital point — ${foe.name}'s next attack will fail. (Trueshot)`,
      );
    }
  } else {
    narrative.push(`  ${actor.name}'s shot flies wide.`);
    pcTryCounter(turnContext, foe, actor, narrative, 'archery');
  }
}
