import { kcRng } from '../rng.js';
import { NPC_SCHOOL_SPELL, STEAL_TIER_PEN } from '../army-tables.js';
import { encounterClearGold, temperOf } from '../world/tables.js';
import { ensureLairHoard } from '../items/tiers-and-hoards.js';
import { itemNameList } from '../heroes/fame-and-consecration.js';
import { hasItemBase } from '../items/equipment.js';
import { guardianPassives } from '../heroes/skills-and-hp.js';
import { PARLEY_ENABLED, SCOUT_ENABLED, pcDeferEffect, pcFoeCat, pcLearnWeakness, pcPushDot } from './helpers.js';
import { d100, dispFloor, rng } from '../dice-and-army-names.js';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.js';
import { SKILLGAIN_COMMON, trySkillGain } from '../heroes/experience-skill-rises-and-earned-hp.js';
import { pcHasRanged, pcMoveCheck } from './speed-encounter-plans-and-combatants.js';
import { pcHitSkill, pcLandStun, pcStunTurned, pcTakeHit } from './to-hit-wounds-stuns-and-courage.js';
import { pcCastCombatSpell, pcMonsterSpecial } from './combat-spells-and-guardian-abilities.js';
import { pcAdvanceOrStrike, pcAttemptFlee, pcFireShot, pcMeleeStrike } from './melee-flight-and-archery.js';

// ── PERSONAL COMBAT: TACTICS, COMBAT ITEMS AND EACH ACTION (plan P1-08e: lifted out of resolveTurn) ────
// What a combatant does once their plan is spent (Temper), the potions, scrolls and devices carried into a fight, and
// one combatant's action against the foe (pcAct). pcTryCombatItem, pcUseCombatItem and pcAct take the turn's context
// first (src/engine/turn/context.js); the rest read no turn state.
// --- Tactic selection -------------------------------------------------------- Once a plan is
// spent, Temper takes over: fight on, or look for a way out. Monsters never flee — they fight to
// the last.
export function pcTemperFallback(actor, foe) {
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
export function pcNextTactic(actor, foe) {
  if (actor.tacIdx < actor.tactics.length) {
    const t = actor.tactics[actor.tacIdx];
    actor.tacIdx++;
    return t || 'ME';
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
export const _CI_PRIORITY = [
  'heal',
  'secondwind',
  'hot',
  'absorb',
  'invis',
  'mirror',
  'flee',
  'dispel',
  'bane',
  'banestun',
  'buff',
  'focus',
  'silence',
  'stun',
  'pen',
  'weak',
  'terror',
  'dmg',
  'drain',
];
export function pcCombatItemWanted(actor, foe, it, state) {
  const e = it.effect || {};
  const ratio = actor.hp / (actor.maxHp || 20);
  const st = actor.status || {};
  switch (e.use) {
    case 'heal':
      return ratio < (e.below || 0.5);
    case 'hot':
      return ratio < (e.below || 0.7) && !(st.hot && st.hot.rounds > 0);
    case 'secondwind':
      return ratio < (e.below || 0.6) && ((st.dot || []).length > 0 || (st.hitPenalty || 0) >= 10 || ratio < 0.4);
    case 'absorb':
      return actor.hp < (actor.maxHp || 20) && !(st.absorb > 0);
    case 'invis':
      return ratio < (e.below || 0.5) && !(st.toHitReduce > 0);
    case 'mirror':
      return ratio < (e.below || 0.7) && !(st.mirrorImages > 0);
    case 'flee':
      return ratio < (e.below || 0.35) && !actor.neverFlees;
    case 'dispel':
      return (st.dot || []).length > 0 || (st.hitPenalty || 0) >= 15;
    case 'bane':
    case 'banestun':
      return (e.vs || []).includes(pcFoeCat(foe));
    case 'silence':
      return (foe.specials || []).length > 0 || Object.values(foe.school || {}).some((v) => (v || 0) > 0);
    case 'drain':
      return ratio < (e.below || 0.75);
    case 'buff':
    case 'focus':
    case 'stun':
    case 'pen':
    case 'weak':
    case 'terror':
    case 'dmg':
      return true;
  }
  return false;
}
export function pcTryCombatItem(turnContext, actor, foe, narrative, state) {
  const list = actor.combatItems || [];
  if (!list.length) return false;
  actor._itemsUsed = actor._itemsUsed || new Set();
  let pick = null;
  for (const use of _CI_PRIORITY) {
    pick = list.find(
      (it) =>
        it &&
        it.effect &&
        it.effect.use === use &&
        !actor._itemsUsed.has(it.name) &&
        pcCombatItemWanted(actor, foe, it, state),
    );
    if (pick) break;
  }
  if (!pick) return false;
  actor._itemsUsed.add(pick.name);
  pcUseCombatItem(turnContext, actor, foe, pick, narrative, state);
  if (actor.kind === 'character' && actor.ref)
    trySkillGain(turnContext, actor.ref, 'sage', SKILLGAIN_COMMON, narrative); // 2026-09-21: using a magic item may teach Sage (small chance)
  return true;
}
export function pcUseCombatItem(turnContext, actor, foe, it, narrative, state) {
  const e = it.effect || {};
  const nm = it.name;
  const st = actor.status;
  const fs = foe.status;
  const who = actor.kind === 'monster' ? `The ${actor.name}` : actor.name;
  const hurt = (d, label) => {
    const dealt = pcTakeHit(turnContext, foe, d, narrative, actor.name, label || nm);
    if (dealt)
      narrative.push(`  ${nm} strikes ${foe.name} for ${dealt} damage. (HP ${Math.max(0, Math.round(foe.hp))})`);
    return dealt;
  };
  narrative.push(`  🧪 ${who} uses the ${nm}!`);
  switch (e.use) {
    case 'heal': {
      const h = Math.min(e.amt || 5, Math.max(0, (actor.maxHp || 20) - actor.hp));
      actor.hp += h;
      narrative.push(`  ${who} recovers ${h} HP. (HP ${dispFloor(actor.hp)})`);
      break;
    }
    case 'hot': {
      st.hot = { amt: e.amt || 3, rounds: e.rounds || 3, label: nm };
      narrative.push(`  Warmth spreads through ${actor.name} — ${e.amt} HP a round for ${e.rounds} rounds.`);
      break;
    }
    case 'secondwind': {
      const h = Math.min(e.amt || 10, Math.max(0, (actor.maxHp || 20) - actor.hp));
      actor.hp += h;
      st.dot = [];
      st.hitPenalty = 0;
      st.hitPenaltyFixed = 0;
      narrative.push(`  ${who} recovers ${h} HP and every lingering affliction lifts. (HP ${dispFloor(actor.hp)})`);
      break;
    }
    case 'dmg':
    case 'bane': {
      const times = e.times || 1;
      for (let i = 0; i < times && foe.hp > 0; i++) {
        let d = rng(e.dmg[0], e.dmg[1]);
        if ((e.doubleVs || []).includes(pcFoeCat(foe))) {
          d *= 2;
          narrative.push(`  The ${nm} blazes twice as bright against ${foe.name}!`);
        }
        hurt(d);
      }
      if (e.dot && foe.hp > 0) {
        const _de = pcPushDot(foe, e.dot[0], e.dot[1], nm);
        if (_de)
          narrative.push(
            `  ${nm} keeps burning on ${foe.name} — ${_de.dmg} a round for ${_de.rounds} round${_de.rounds !== 1 ? 's' : ''}.`,
          );
      }
      // these ride on the damage the item just dealt, so they grip from the NEXT round. (A
      // pure-penalty or pure-stun item — case 'pen' / 'stun' below — still bites now.)
      if (e.hitPen && foe.hp > 0) {
        pcDeferEffect(foe, () => {
          fs.hitPenalty = (fs.hitPenalty || 0) + e.hitPen;
        });
        narrative.push(`  ${foe.name} is thrown off (−${e.hitPen}% to hit from the next round).`);
      }
      if (e.stun && foe.hp > 0) {
        if (pcStunTurned(foe, narrative, `the ${nm}'s daze`)) {
          /* turned (batch item 3) */
        } else {
          pcDeferEffect(foe, () => {
            fs.stun = (fs.stun || 0) + e.stun;
          });
          narrative.push(`  ${foe.name} reels — ${e.stun} action${e.stun !== 1 ? 's' : ''} lost from the next round.`);
        }
      }
      break;
    }
    case 'drain': {
      const d = rng(e.dmg[0], e.dmg[1]);
      const dealt = hurt(d);
      const h = Math.min(dealt, Math.max(0, (actor.maxHp || 20) - actor.hp));
      actor.hp += h;
      if (h > 0) narrative.push(`  ${who} drinks the stolen vigour — +${h} HP. (HP ${dispFloor(actor.hp)})`);
      break;
    }
    case 'stun':
    case 'banestun': {
      if (pcLandStun(foe, e.stun || 1, narrative, `the ${nm}`))
        narrative.push(`  ${foe.name} is held fast — ${e.stun || 1} action${(e.stun || 1) !== 1 ? 's' : ''} lost.`);
      break;
    }
    case 'pen': {
      // an item that says "for the rest of the fight" no longer fades 5% a round
      if (/rest of the fight/i.test(it.desc || '')) {
        fs.hitPenaltyFixed = (fs.hitPenaltyFixed || 0) + (e.hitPen || 15);
        narrative.push(
          `  ${foe.name} can barely see to strike (−${e.hitPen || 15}% to hit for the rest of the fight).`,
        );
      } else {
        fs.hitPenalty = (fs.hitPenalty || 0) + (e.hitPen || 15);
        narrative.push(`  ${foe.name} can barely see to strike (−${e.hitPen || 15}% to hit).`);
      }
      break;
    }
    // 2026-10-08 (item 2): a character's to-hit and damage read the RAW skill (meleeRaw /
    // archeryRaw), so sap those too — lowering only `melee` did nothing to a hero.
    case 'weak': {
      if (e.melee) {
        foe.melee = Math.max(0, (foe.melee || 0) - e.melee);
        if (foe.meleeRaw != null) foe.meleeRaw = Math.max(0, foe.meleeRaw - e.melee);
      }
      if (e.archery) {
        foe.archery = Math.max(0, (foe.archery || 0) - e.archery);
        if (foe.archeryRaw != null) foe.archeryRaw = Math.max(0, foe.archeryRaw - e.archery);
      }
      narrative.push(
        `  ${foe.name} is sapped — Melee ${pcHitSkill(foe, 'melee')}${e.archery ? `, Archery ${pcHitSkill(foe, 'archery')}` : ''} for the rest of the fight.`,
      );
      break;
    }
    case 'terror': {
      if (!foe.neverFlees && kcRng() < 0.5) {
        state.fledBy = foe;
        narrative.push(`  ${foe.name} is overcome with dread and flees!`);
      } else {
        fs.hitPenalty = (fs.hitPenalty || 0) + (e.hitPen || 15);
        narrative.push(`  ${foe.name} holds their ground, badly shaken (−${e.hitPen || 15}% to hit).`);
      }
      break;
    }
    case 'silence': {
      fs.silenceRounds = (fs.silenceRounds || 0) + (e.rounds || 3);
      narrative.push(`  ${foe.name}'s magic and powers are bound for ${e.rounds || 3} rounds.`);
      break;
    }
    case 'buff': {
      if (e.melee) actor.melee = (actor.melee || 0) + e.melee;
      if (e.archery) actor.archery = (actor.archery || 0) + e.archery;
      narrative.push(
        `  ${who} surges with strength — Melee ${actor.melee}${e.archery ? `, Archery ${actor.archery}` : ''}.`,
      );
      break;
    }
    case 'focus': {
      st.hitBonus = (st.hitBonus || 0) + (e.hitBonus || 10);
      narrative.push(`  ${who}'s eye sharpens (+${e.hitBonus || 10}% to hit).`);
      break;
    }
    case 'absorb': {
      st.absorb = (st.absorb || 0) + (e.absorb || 10);
      if (e.reflect) {
        st.reflect = (st.reflect || 0) + e.reflect;
      }
      narrative.push(
        `  A ward settles over ${actor.name}, ready to drink ${st.absorb} damage${e.reflect ? ` and bite back for ${st.reflect}` : ''}.`,
      );
      break;
    }
    case 'mirror': {
      st.mirrorImages = (st.mirrorImages || 0) + (e.images || 2);
      narrative.push(`  ${e.images || 2} shimmering doubles step out of ${actor.name}.`);
      break;
    }
    case 'flee': {
      st.fleeBonus = (st.fleeBonus || 0) + (e.fleeBonus || 25);
      if (e.toHitReduce) st.toHitReduce = (st.toHitReduce || 0) + e.toHitReduce;
      narrative.push(
        `  ${who} is ready to break away (+${e.fleeBonus || 25}% to flee${e.toHitReduce ? `, foe −${e.toHitReduce}% to hit` : ''}).`,
      );
      break;
    }
    case 'invis': {
      st.toHitReduce = (st.toHitReduce || 0) + (e.toHitReduce || 25);
      narrative.push(`  ${who} fades from sight — ${foe.name} strikes at shadows (−${e.toHitReduce || 25}% to hit).`);
      break;
    }
    case 'dispel': {
      st.dot = [];
      st.hitPenalty = 0;
      st.hitPenaltyFixed = 0;
      narrative.push(`  Every poison, burn and blinding on ${actor.name} lifts.`);
      break;
    }
    default:
      narrative.push(`  …but nothing happens.`);
  }
}

// --- One combatant performs their next action against the foe --------------- Actions alternate
// strictly, one per combatant per round, in initiative order.
export function pcAct(turnContext, actor, foe, narrative, state) {
  const { G } = turnContext;
  if (actor.status.stun > 0) {
    narrative.push(`  ${actor.name} is stunned and cannot act. (${actor.status.stun} left)`);
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
        narrative.push(`  ${actor.name} cannot shoot (bound by Spiritwrack) — they close in instead.`);
        pcAdvanceOrStrike(turnContext, actor, foe, narrative, state);
        break;
      }
      if (!pcHasRanged(actor)) {
        narrative.push(`  ${actor.name} has no ranged attack — they press forward instead.`);
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
          narrative.push(
            `  ${actor.name} gives ground and gets to firing range before anything can reach them. (${actor.temper} — opening shot)`,
          );
          pcFireShot(turnContext, actor, foe, narrative);
          break;
        }
        const ch = dispFloor(pcMoveCheck(actor, foe, 'advance')),
          roll = d100();
        narrative.push(`  ${actor.name} moves up to firing range (${ch}% [roll ${roll}]${roll <= ch ? ' ✓' : ' ✗'})`);
        if (roll > ch) {
          narrative.push(`  ${actor.name} cannot close the distance in time — no shot.`);
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
        narrative.push(
          `  ${actor.name} tries to break away to firing range (${ch}% [roll ${roll}]${roll <= ch ? ' ✓' : ' ✗'})`,
        );
        if (roll > ch) {
          narrative.push(`  ${foe.name} stays right on top of ${actor.name} — no room to draw.`);
          break;
        }
        state.range = 'bow';
        narrative.push(`  ${actor.name} disengages to bow range.`);
      }
      pcFireShot(turnContext, actor, foe, narrative);
      break;
    }
    case 'MS': {
      // monster special ability — the creature's equivalent of Cast
      const sp = (actor.specials || []).find((s) => s && s.name === arg);
      if (!sp) {
        pcAdvanceOrStrike(turnContext, actor, foe, narrative, state);
        break;
      }
      // 2026-10-14 (batch item 1): a bound or fumbled special no longer COSTS the round — the
      // guardian makes an ordinary attack instead, exactly as a hero whose spell fails does (no
      // side ever stands idle for a failed power; only a stun does that). It is still ONE action:
      // the special did nothing, so the attack is all the guardian does this round.
      if (actor.status.silenceRounds > 0) {
        narrative.push(
          `  ${actor.name}'s power is bound and will not answer — it falls on ${foe.name} with tooth and claw instead.`,
        );
        pcAdvanceOrStrike(turnContext, actor, foe, narrative, state);
        break;
      }
      const cc = sp.castChance != null ? sp.castChance : 50;
      if (kcRng() * 100 >= cc) {
        narrative.push(
          `  ${actor.name} gathers itself for ${sp.name} but the moment slips away — it attacks instead. [${cc}%]`,
        );
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
        narrative.push(`  ${actor.name} is silenced and cannot cast — they attack instead.`);
        pcAdvanceOrStrike(turnContext, actor, foe, narrative, state);
        break;
      }
      // Choose the spell: explicit CA:Name, else best available combat spell.
      let name = arg;
      if (!name) {
        const best = ['elemental', 'necromancy', 'white', 'psychic', 'illusory'].reduce(
          (b, s) => ((actor.school[s] || 0) > (actor.school[b] || 0) ? s : b),
          'elemental',
        );
        name = NPC_SCHOOL_SPELL[best];
      } // tie-break ORDER — deliberately not KC_MAGIC_SCHOOLS
      if (!pcCastCombatSpell(turnContext, actor, foe, name, narrative, state))
        pcAdvanceOrStrike(turnContext, actor, foe, narrative, state);
      break;
    }
    case 'FL':
    case 'FLEE': {
      if (actor.neverFlees) {
        narrative.push(`  ${actor.name} knows nothing of retreat.`);
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
        narrative.push(
          `  ${actor.name} calls for parley (Druid ${dr}, ${chance}%${chance ? ` [roll ${roll}]${roll <= chance ? ' ✓' : ' ✗'}` : ' — it cannot be reasoned with'})`,
        );
        if (chance > 0 && roll <= chance) {
          state.parley = true;
          narrative.push(`  ${foe.name} lowers its guard and stands aside.`);
        } else narrative.push(`  ${foe.name} answers with a roar.`);
      } else narrative.push(`  ${actor.name} calls for parley, but blades are already drawn.`);
      break;
    }
    case 'ST':
    case 'STEAL': {
      const th = actor.kind === 'character' ? effStat(turnContext, actor.ref, 'thief') : 0;
      if (th < 1) {
        narrative.push(`  ${actor.name} has no Thief skill and cannot attempt a steal — they press forward instead.`);
        pcAdvanceOrStrike(turnContext, actor, foe, narrative, state);
        break;
      }
      let bonus = temperOf(actor.temper).stealMod;
      if (actor.castSpells.includes('Invisibility')) bonus += 15;
      if (actor.ref && hasItemBase(actor.ref, 'Lock-Pick of Legends')) bonus += 20; // Lock-Pick of Legends: +20% steal chance
      // Tougher guardians watch their hoard more closely — a flat penalty by tier. A master thief
      // can still rob a Legendary beast, but a novice has little hope of it.
      const STEAL_TIER_PENALTY = { ...STEAL_TIER_PEN };
      const _tier = (foe && foe.ref && foe.ref.power) || 'Weak';
      const tierPen = STEAL_TIER_PENALTY[_tier] || 0;
      const chance = Math.max(5, Math.min(95, 50 + 10 * Math.min(th, 5) + bonus - tierPen));
      if (kcRng() * 100 < chance) {
        state.stoleBy = actor;
        narrative.push(
          `  ${actor.name} slips past the ${_tier.toLowerCase()} guardian and seizes the prize! [${chance}%${tierPen ? `, −${tierPen}% ${_tier}` : ''}]`,
        );
      } else
        narrative.push(`  ${actor.name}'s theft is noticed. [${chance}%${tierPen ? `, −${tierPen}% ${_tier}` : ''}]`);
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
      if (feat && foe && foe.kind === 'monster') {
        const power = (foe.ref && foe.ref.power) || '';
        const curHp = Math.max(0, Math.round(foe.hp != null ? foe.hp : (foe.ref && foe.ref.hp) || 0));
        const fullHp = Math.round(
          foe.ref && foe.ref._hpFull != null ? foe.ref._hpFull : (foe.ref && foe.ref.hp) || curHp,
        );
        // report the EXACT gold a clearer will take (rolled and locked now), plus only the
        // magic-item outlook — no more double gold statement (a "hoard of about Xg" AND a "~3-8g"
        // range).
        ensureLairHoard(feat, G);
        const clearGold = encounterClearGold(feat);
        // the hoard is fixed at world gen, so Scout names the ACTUAL items — and notes any a
        // thief has already lifted, and which the guardian has turned against challengers.
        const _hi = feat.hoardItems || [],
          _st = feat._stolenItems || [];
        let itemOut = _hi.length ? ` and ${itemNameList(_hi)}` : '';
        if (!_hi.length)
          itemOut = _st.length
            ? ` — the hoard's magic (${_st.join(', ')}) has already been lifted by a thief`
            : ' — no magic lies here';
        else if (_st.length) itemOut += ` (a thief has already made off with ${_st.join(', ')})`;
        const _wielded = foe.wielded || [];
        if (_wielded.length)
          itemOut += `. Beware: it wields ${_wielded.map((x) => x.name).join(', ')} against all comers`;
        // Abilities — the guardian's special powers (its spell list).
        const spells = (foe.ref && foe.ref.spells) || [];
        const abilityClause =
          (spells.length
            ? ` It can call on ${spells
                .slice(0, 4)
                .map((s) => s.name)
                .join(', ')}.`
            : ' It has no special powers — it fights with tooth, claw and steel alone.') +
          guardianPassives(foe.ref)
            .map((p) => ` ${p.name}: ${p.desc}.`)
            .join(''); // passives are scouted too
        // Weaknesses / resistances — read the guardian's damage-type vulnerabilities (0.4-1.8; >1
        // means it takes MORE from that type, <1 means it shrugs it off).
        const v = foe.vuln || { melee: 1, archery: 1, spell: 1 };
        const LABEL = { melee: 'blades', archery: 'arrows', spell: 'magic' };
        const weak = [],
          tough = [];
        ['melee', 'archery', 'spell'].forEach((k) => {
          if (v[k] > 1.15) weak.push(LABEL[k]);
          else if (v[k] < 0.85) tough.push(LABEL[k]);
        });
        let vulnClause = '';
        if (weak.length) vulnClause += ` It is vulnerable to ${weak.join(' and ')}`;
        if (tough.length) vulnClause += `${weak.length ? ', but' : ' It is'} resistant to ${tough.join(' and ')}`;
        if (vulnClause) vulnClause += '.';
        // the one thing worth scouting for — the guardian's exploitable weakness. Reading it here
        // teaches the realm for good, so the flaw is on the order form next turn.
        if (foe.weak) {
          vulnClause += ` Its weakness: ${foe.weak.name} — ${foe.weak.desc}.`;
          if (actor.player != null) pcLearnWeakness(G, actor.player, foe.name);
        }
        // the Scout report no longer offers to talk a beast down — the Talk tactic is withdrawn
        // (PARLEY_ENABLED). The `pacifiable` trait itself is left on the creature data so nothing
        // has to be re-derived when it comes back.
        if (PARLEY_ENABLED && foe.pacifiable) vulnClause += ' A Druid could talk it down rather than fight it.';
        const descClause = foe.ref && foe.ref.desc ? ` ${foe.ref.desc}` : '';
        narrative.push(
          `  🔍 ${actor.name} scouts the ${feat.name}: ${foe.name}${power ? ` (${power})` : ''} stands guard at ${curHp}/${fullHp} HP.${descClause}${abilityClause}${vulnClause} Defeating it will yield exactly ${clearGold}g${itemOut}.`,
        );
        feat.scouted = true;
      } else {
        narrative.push(`  ${actor.name} scouts the ground, but there is nothing here to guard.`);
      }
      // Scout only ever CANCELLED fading to-hit penalties (it never added a bonus) — the line now
      // says so.
      if (b > 0) {
        const _had = actor.status.hitPenalty || 0,
          _cut = Math.min(_had, b);
        actor.status.hitPenalty = _had - _cut;
        if (_cut > 0)
          narrative.push(
            `  ${actor.name} reads the ground and steadies — ${_cut}% of their to-hit penalty is shaken off (Explorer ${ex}).`,
          );
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
