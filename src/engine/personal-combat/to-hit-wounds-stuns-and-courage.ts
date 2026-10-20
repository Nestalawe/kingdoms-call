import { kcRng } from '../rng.ts';
import { temperOf } from '../world/tables.ts';
import { GUARDIAN_MELEE_BASE, PC_HIT_CAP_FRAC } from '../names.ts';
import { hasItemBase } from '../items/equipment.ts';
import {
  PC_DMG_FLOOR_FRACTION,
  PC_SPELL_SCHOOL_MAP,
  PC_WEAK_MULT,
  PC_WEAK_NO_DMG_DOUBLE,
  pcLearnWeakness,
  pcPenaltyFade,
  pcPromotePending,
  pcWeaknessApplies,
} from './helpers.ts';
import { d100, dispFloor, fmtRoll, rng } from '../dice-and-army-names.ts';
import { discDuelVs, discSum } from '../discoveries.ts';

// ── PERSONAL COMBAT: TO-HIT, WOUNDS, STUNS AND COURAGE (plan P1-08e: lifted out of resolveTurn) ────
// The melee to-hit and damage, how a ward or a guardian's passive is named, the one door every stun lands through,
// the courage test against terror, the fading self-sustain of a long fight, a hit taken (pcTakeHit) and the start of
// each round (pcRoundStart). pcHitChance and pcTakeHit take the turn's context first (src/engine/turn/context.ts); the rest read no turn
// state.
// --- Small helpers ---------------------------------------------------------- 2026-09-10: MELEE
// to-hit is base 30% + 10% per point of the striker's OWN Melee (counted to 5), with NO deduction
// for the defender's skill. Tempers, penalties, wards and items apply on top as before; the same
// formula serves characters and guardians alike. Skill above 5 still lands heavier blows
// (pcMeleeDamage) but does not raise the hit chance.
// mastery past level 5 is no longer thrown away. The RAW to-hit runs 30% + 10%/level to level 5,
// then +5%/level beyond it (L5 80, L6 85, L7 90, L8 95, L9 100), and every temper bonus, penalty,
// aura and ward is applied to THAT real figure. Only the FINAL result is clamped, to a hard 80% —
// so a Melee 6 hero meeting a −15% guardian hits at 75%, not 65%, while a Melee 5 hero meeting
// the same guardian hits at 65%. No melee or arrow ever exceeds 80%, temper bonuses included.
export const PC_MELEE_HIT_BASE = 30,
  PC_MELEE_HIT_PER_LVL = 10,
  PC_HIT_SKILL_CAP = 5,
  PC_HIT_PER_LVL_ABOVE = 5,
  PC_HIT_MAX = 80,
  PC_HIT_MIN = 5;
// Skill counted for to-hit: the character's RAW level (1–9) where known, else the combatant's
// stat
// (guardians carry their melee/archery straight). effStat caps at 5, so meleeRaw is what carries
// mastery into the hit chance now that levels past 5 are worth something.
export function pcHitSkill(cbt, which) {
  const raw = which === 'archery' ? cbt.archeryRaw : cbt.meleeRaw;
  const base = which === 'archery' ? cbt.archery || 0 : cbt.melee || 0;
  const down = which === 'archery' ? 0 : (cbt.status && cbt.status.meleeDown) || 0; // "−1 melee for next round"
  return Math.max(0, Math.max(raw != null ? raw : 0, base) - down);
}
export function pcSkillHitPct(lvl) {
  return (
    PC_MELEE_HIT_BASE +
    PC_MELEE_HIT_PER_LVL * Math.min(PC_HIT_SKILL_CAP, lvl) +
    PC_HIT_PER_LVL_ABOVE * Math.max(0, lvl - PC_HIT_SKILL_CAP)
  );
}
export function pcHitChance(turnContext, attacker, defender) {
  let chance = pcSkillHitPct(pcHitSkill(attacker, 'melee'));
  // ── AK §2.4 Tempers ── the attacker's aggression against the defender's guard. A Berserk has a
  // negative `defence`: they attack wide open and are easier to hit.
  chance += temperOf(attacker.temper).meleeHit;
  chance -= temperOf(defender.temper).defence;
  chance -= attacker.status.hitPenalty || 0;
  chance -= attacker.status.hitPenaltyFixed || 0; // "for the rest of the fight" penalties (Flash Powder, Clinging Pitch)
  chance -= attacker.status.auraPenalty || 0; // a guardian's passive aura (Dread / Petrifying…) — never decays
  chance += attacker.status.hitBonus || 0; // Elixir of Focus and kin
  chance -= defender.status.toHitReduce || 0; // Invisibility: flat \u221225 to hit (floored at 40 below)
  chance -= (defender.arm && defender.arm.dodge) || 0; // Quicksilver Mail: −10% to be hit
  if (attacker.player != null)
    chance += discSum(turnContext, attacker.player, 'duelHit', 'pct', (e) => discDuelVs(e, defender)); // duelHit discoveries (sd33 Duelling Code …)
  chance = chance * (defender.status.dodge || 1); // (no effect currently sets status.dodge — kept as a hook)
  // ── The defender's STANCE lowers the ceiling itself ────
  // Testing found the +14 Cautious guard was doing nothing above about Melee 4: a Melee 6 Berserk
  // raws 85+18=103, and subtracting 14 still leaves 89, which the 80% cap flattens anyway. The
  // signature stat of the defensive temper was inert against exactly the opponents it exists to
  // survive. A temper's GUARD now also lowers the hard ceiling for anyone swinging at them, so
  // the maximum melee hit chance is 80% against a Berserk, 76% against a Brave, 74% against a
  // Cowardly and 66% against a Cautious — a defensive stance is worth something no matter how
  // good the attacker is. This is deliberately NOT extended to a guardian's dodge passive or to
  // Invisibility: Toby's rule is that those come off the REAL figure, so mastery beats them. A
  // trained stance is a different thing from being hard to see, and only the stance moves the
  // cap.
  const _guardCap = Math.max(0, temperOf(defender.temper).defence || 0);
  return Math.max(PC_HIT_MIN, Math.min(PC_HIT_MAX - _guardCap, dispFloor(chance))); // hard ceiling, applied AFTER every modifier
}
export function pcMeleeDamage(attacker, defender) {
  // Sept 2026 redesign: blows scale with the striker's OWN skill (+ceil(Melee/2)).
  // 2026-09-26: base roll cut from 2–5 to 1–3 and the skill-gap bonus (+max(0, yourMelee − theirMelee))
  // removed — out-skilling a foe now shows up only in hit chance, not in damage per blow.
  // For characters the bonus reads the RAW skill level (1–9, `meleeRaw`) — combat hit-chance
  // stays on the 0–5 scale, but mastery past 5 lands heavier blows. Guardians use their melee
  // stat.
  const _dsk = Math.max(
    0,
    (attacker.meleeRaw != null ? attacker.meleeRaw : attacker.melee || 0) -
      ((attacker.status && attacker.status.meleeDown) || 0),
  );
  const _gd = attacker.kind === 'monster';
  const _base = (_gd && GUARDIAN_MELEE_BASE[attacker.power]) || [1, 3]; // a guardian's base grows with its tier
  // 2026-10-14 (Toby, item 20): a guardian adds +1 for every level of its Melee; a hero still adds ⌈Melee ÷ 2⌉.
  let dmg = Math.max(
    1,
    rng(_base[0], _base[1]) + (_gd ? _dsk : Math.ceil(_dsk / 2)) + temperOf(attacker.temper).meleeDamage,
  );
  if (attacker.status && attacker.status.meleeHalvedRounds > 0) dmg = Math.max(1, Math.floor(dmg / 2));
  // 2026-09-12b: the defender's temper soak MOVED to pcTakeHit. It is a reduction like any other
  // ward, and applying it here put it outside the half-damage floor — a Cautious hero in Mithril
  // was still taking 1-damage hits because the guard had already scraped the blow down before
  // pcTakeHit ever saw its "original" value. Every reduction now lives in one place.
  if ((attacker.ref && hasItemBase(attacker.ref, 'Warbringer Gauntlets')) || attacker.gauntlets) dmg += 2; // Warbringer Gauntlets: +2 damage per successful melee attack (a guardian wielding them too)
  if (attacker.dmgBonus) dmg += attacker.dmgBonus; // guardian passive (Brute Strength, Savage Jaws…)
  return dmg;
}
// Which damage channel a hit belongs to, so a monster's vulnerabilities/resistances
// (monsterTraits) scale it: blades, arrows or magic.
export const PC_CHANNEL = {
  blow: 'melee',
  'free strike': 'melee',
  'parting blow': 'melee',
  counterattack: 'melee',
  arrow: 'archery',
};
// a guardian's ward comes from its PASSIVE, not worn armour — name it so ("the Stone Troll's
// Troll Regeneration knits flesh…" rather than "…armour knits flesh…"). Characters keep the
// armour/shield wording.
// `key` names the effect (regen, meleeDR, …) so a guardian with several perks names the right one.
export function pcWardWord(t, word, key) {
  if (t && t.kind === 'monster') {
    const nm = (key && t._perkName && t._perkName[key]) || ((t.perks || []).length <= 1 ? t.passiveName : null);
    if (nm) return `${t.name}'s ${nm}`;
    return `${t.name}'s ${word === 'armour' ? 'hide' : word}`;
  }
  return `${t.name}'s ${word}`;
}
export function pcPerkWord(t, key, dflt) {
  return (t && t._perkName && t._perkName[key]) || (t && t.passiveName) || dflt;
}
export function pcWardIcon(t) {
  return t && t.kind === 'monster' ? '🜏' : '🛡';
}
// ── STUNS LAND THROUGH ONE DOOR (2026-10-14, batch item 3) ────
// "Cannot be stunned" used to be honoured only at the start of the NEXT round, so a stun cast by a
// fighter holding the initiative still cost the "unstunnable" one that round's action, and a stun
// riding on a blow (promoted after the round-start check) cost one more. Every stun now arrives
// through pcLandStun, which asks the target's ward first. pcStunWard is the chance (0–100) that a
// stun is shrugged off as it lands; 100 means it never takes hold.
export function pcStunWard(t) {
  const a = t && t.arm;
  if (!a) return 0;
  return a.stunImmune ? 100 : Math.max(0, Math.min(100, a.stunWard || 0));
}
// pcStunTurned rolls the ward once and says so when it turns the stun.
export function pcStunTurned(target, narrative, what) {
  const w = pcStunWard(target);
  if (!(w >= 100 || (w > 0 && d100() <= w))) return false;
  const _why =
    target.kind === 'monster'
      ? pcPerkWord(target, 'stunWard', 'its nature')
      : (target.arm && target.arm.names && target.arm.names.join(', ')) || 'their armour';
  if (narrative)
    narrative.push(
      `  ${pcWardIcon(target)} ${target.name} cannot be held (${_why}${w < 100 ? `, ${w}%` : ''}) — ${what || 'the daze'} finds no hold.`,
    );
  return true;
}
// Returns true if the stun takes hold (and adds it), false if the ward turns it.
export function pcLandStun(target, n, narrative, what) {
  if (!target || !target.status || !(n > 0)) return false;
  if (pcStunTurned(target, narrative, what)) return false;
  target.status.stun = (target.status.stun || 0) + n;
  return true;
}
// ── COURAGE ────
// A terror ability ("hero must pass courage test or flee") is now a contest, not a coin flip.
// NERVE comes from three places a player can actually build:
// · martial mastery — the better of the hero's RAW Melee / Archery (1–9), 5 points a level;
// · temper — a Berserk barely notices, a Coward is half gone before the roll;
// · faith — White Magic steadies the mind, counted to 2 levels so it is a hedge, not an answer.
// The creature's own stature presses back, so a Legendary terror still bites a veteran. An item
// warding stun/hold (the Signet of the Sleepless Crown) refuses the grip outright — handled by
// the caller. The band is 10–70%: nobody is ever immune by statistics alone, and nobody is ever
// helpless. A Melee 1 novice of Brave temper breaks on 40%; a Melee 9 master with White 2 on 10%.
export const PC_TERROR_BASE = 55,
  PC_TERROR_PER_LVL = 5,
  PC_TERROR_MIN = 10,
  PC_TERROR_MAX = 70;
export const PC_TERROR_TEMPER = { Berserk: -15, Brave: -10, Cautious: -5, Cowardly: 10 };
export const PC_TERROR_BY_POWER = { Weak: 0, Moderate: 0, Powerful: 5, Legendary: 15 };
export function pcCourageChance(foe, actor) {
  const nerve = Math.max(
    foe.meleeRaw != null ? foe.meleeRaw : foe.melee || 0,
    foe.archeryRaw != null ? foe.archeryRaw : foe.archery || 0,
  );
  const faith = 5 * Math.min(2, (foe.school && foe.school.white) || 0);
  const stature = PC_TERROR_BY_POWER[(actor && actor.ref && actor.ref.power) || ''] || 0;
  const c = PC_TERROR_BASE + stature - PC_TERROR_PER_LVL * nerve - faith + (PC_TERROR_TEMPER[foe.temper] || 0);
  return Math.max(PC_TERROR_MIN, Math.min(PC_TERROR_MAX, Math.round(c)));
}
// ── SELF-SUSTAIN FADE ────
// (Measured: Marsh Hydra went from a 21% win rate to 90% across three rungs of hero.) The sustain
// now fades as the fight runs long — full for four rounds, half to eight, nothing after — so
// grinding one down is a race against the clock and the curve is a slope instead of a cliff.
// Deliberately NOT applied to characters: a hero's Troll-Hide, Carapace or Ninefold Band is worn
// equipment the player paid for, and this is a fix for guardian pacing, not an item nerf.
export const PC_SUSTAIN_FULL_ROUNDS = 4,
  PC_SUSTAIN_HALF_ROUNDS = 8;
export function pcSustainMult(cbt) {
  if (!cbt || cbt.kind !== 'monster') return 1;
  const r = cbt._roundNo || 1;
  return r <= PC_SUSTAIN_FULL_ROUNDS ? 1 : r <= PC_SUSTAIN_HALF_ROUNDS ? 0.5 : 0;
}
export function pcTakeHit(turnContext, target, dmg, narrative, srcName, kind) {
  const { G } = turnContext;
  // Beg-for-Mercy narration (2026-09-21): remember WHERE in the narrative a character's fatal blow
  // began, so a Cowardly plea can be told just before that blow lands (see resolvePersonalCombat).
  const _mkHpIn = target ? target.hp : 0,
    _mkIdx = (narrative && narrative.length) || 0;
  // Mirror images soak a hit first.
  if (target.status && target.status.mirrorImages > 0) {
    target.status.mirrorImages--;
    narrative.push(
      `  ${srcName}'s ${kind} strikes a Mirror Image of ${target.name}! (${target.status.mirrorImages} image${target.status.mirrorImages !== 1 ? 's' : ''} left)`,
    );
    return 0;
  }
  let d = dmg;
  // ── ARMOUR ── outright negations first: the Blood-Bound Cuirass takes the first landed hit of
  // the fight in full; the Tower Shield blocks one melee blow or arrow in five.
  const _arm = target.arm || null,
    _chan = PC_CHANNEL[kind] || 'spell';
  if (_arm && _arm.firstHit && !target._armFirstHitUsed) {
    target._armFirstHitUsed = true;
    narrative.push(
      `  🛡 The first ${_chan === 'spell' ? 'harm' : _chan === 'archery' ? 'arrow' : 'blow'} to reach ${target.name} is drunk by their armour — no damage. (${_arm.names.join(', ')})`,
    );
    return 0;
  }
  if (_arm && _arm.block > 0 && (_chan === 'melee' || _chan === 'archery') && d100() <= _arm.block) {
    narrative.push(
      `  🛡 ${target.name}'s shield takes the ${_chan === 'archery' ? 'arrow' : 'blow'} square on — blocked outright. (${_arm.block}%)`,
    );
    return 0;
  }
  if (_arm && _arm.arrowBlock > 0 && _chan === 'archery' && d100() <= _arm.arrowBlock) {
    narrative.push(`  🛡 The arrow glances off ${target.name}'s shield. (${_arm.arrowBlock}%)`);
    return 0;
  }
  if (_arm && _arm.spellBlock > 0 && _chan === 'spell' && d100() <= _arm.spellBlock) {
    narrative.push(`  🛡 ${target.name}'s shield turns the ${kind} away harmlessly. (${_arm.spellBlock}%)`);
    return 0;
  }
  if (_arm && _arm.roundWard > 0 && (target._roundWardLeft || 0) > 0 && d > 0) {
    const _rw = Math.min(target._roundWardLeft, d);
    target._roundWardLeft -= _rw;
    d -= _rw;
    narrative.push(`  🛡 The ward on ${target.name}'s shield soaks ${_rw}.`);
    if (d <= 0) return 0;
  }
  // Mithril Armour turns aside 2 points of any MELEE or ARROW blow that lands
  // (a magic sword-arm or spell still ignores it), never below 1 damage — and it announces itself
  // each time it saves the wearer harm.
  if (target.mithril && (PC_CHANNEL[kind] === 'melee' || PC_CHANNEL[kind] === 'archery') && d > 1) {
    const _b = d;
    d = Math.max(1, d - (target.mithrilDR || 2));
    if (d < _b)
      narrative.push(
        `  🛡 ${target.name}'s Mithril Armour turns aside ${_b - d} of the ${PC_CHANNEL[kind] === 'archery' ? 'arrow' : 'blow'}.`,
      );
  }
  // Monster nature: armoured hides turn blades, bone shrugs off arrows, magic ignores plate.
  if (target.vuln) {
    const ch = PC_CHANNEL[kind] || 'spell';
    d = Math.max(1, Math.round(d * (target.vuln[ch] || 1)));
  }
  // ── WEAKNESS ── the guardian's one exploitable flaw. Doubles the damage of the attack it is
  // open to; percentage-of-max-HP spells are exempt (they get a doubled take-hold chance
  // instead). The first time it bites, the striker's realm learns the flaw for the rest of the
  // game.
  if (target.kind === 'monster' && target.weak && d > 0 && !PC_WEAK_NO_DMG_DOUBLE.has(kind)) {
    const _wsrc = target._foe || null;
    const _wapp = pcWeaknessApplies(target.weak, {
      chan: _chan,
      school: PC_SPELL_SCHOOL_MAP[kind] || null,
      race: _wsrc && _wsrc.ref ? _wsrc.ref.race || null : null,
      align:
        _wsrc && _wsrc.player != null && G.players[_wsrc.player] ? G.players[_wsrc.player].alignment || null : null,
    });
    if (_wapp) {
      const _wb = d;
      d = Math.max(1, Math.round(d * PC_WEAK_MULT));
      const _wword = _chan === 'spell' ? 'spell' : _chan === 'archery' ? 'arrow' : 'blow';
      narrative.push(`  💥 The ${_wword} finds ${target.name}'s weakness — ${target.weak.name}: ${_wb} becomes ${d}.`);
      if (_wsrc && _wsrc.player != null && pcLearnWeakness(G, _wsrc.player, target.name))
        narrative.push(
          `  📖 ${_wsrc.name} sees it plainly now: ${target.weak.desc}. Your realm will remember this of every ${target.name}.`,
        );
    }
  }
  // ── DRUID 3+ ── a druid of standing reads a beast's every move: damage dealt TO them BY a
  // natural creature (beast / vermin category) in a personal encounter is HALVED, never below 1.
  // It does not blunt undead, fiends, constructs, dragons or anything wielding a spell against
  // them.
  if (target.druidBeastWard && d > 1) {
    const _bw = d;
    d = Math.max(1, Math.round(d / 2));
    if (d < _bw)
      narrative.push(
        `  🍃 ${target.name} reads the beast's every move — ${_bw - d} of the ${PC_CHANNEL[kind] === 'archery' ? 'strike' : 'blow'} turned aside (Druid ${target.druidBeastWard}).`,
      );
  }
  if (target.status && target.status.incomingDmgBonus > 0) d += target.status.incomingDmgBonus; // Melt Armour
  // ── Temper: Rage ── A Berserk shrugs off a fifth of every blow and arrow that lands. Spells
  // bypass it entirely (rage is a tolerance for pain, not a ward), and it can never reduce a
  // landed hit below 1. ── Temper: a guarded stance ── Cautious rolls with the blow rather than
  // taking it square on. Melee only: a guard turns a blade, not an arrow or a spell.
  const _tSoak = temperOf(target.temper).damageSoak || 0;
  if (_tSoak > 0 && PC_CHANNEL[kind] === 'melee' && d > 1) {
    const _tb = d;
    d = Math.max(1, d - _tSoak);
    if (d < _tb)
      narrative.push(`  ${target.name} rolls with the blow and takes ${_tb - d} less. (${target.temper} guard)`);
  }
  const _soakPct = temperOf(target.temper).hitSoakPct || 0;
  if (_soakPct > 0 && (PC_CHANNEL[kind] === 'melee' || PC_CHANNEL[kind] === 'archery')) {
    const _before = d;
    d = Math.max(1, Math.round(d * (1 - _soakPct)));
    if (d < _before)
      narrative.push(
        `  ${target.name} takes the ${kind} on raw fury and shrugs off ${_before - d} of it. (Rage −${dispFloor(_soakPct * 100)}%)`,
      );
  }
  if (target.status && target.status.absorb > 0) {
    const soak = Math.min(target.status.absorb, d);
    target.status.absorb -= soak;
    d -= soak;
    narrative.push(`  A ward around ${target.name} drinks ${soak} of the blow.`);
    if (d <= 0) return 0;
  }
  // MELEE L6 (Parry): a master swordsman turns part of a melee blow aside — 50% chance to shave
  // 1..⌊melee/2⌋ off a landed melee/free/counter strike, never below 1.
  if (target.perkParry && PC_CHANNEL[kind] === 'melee' && d > 1 && kcRng() < 0.5) {
    const _cut = rng(1, Math.max(1, Math.floor((target.meleeRaw || 0) / 2)));
    const _b = d;
    d = Math.max(1, d - _cut);
    if (d < _b) narrative.push(`  ⚔ ${target.name} parries, turning aside ${_b - d} of the blow. (Parry)`);
  }
  // ELEMENTAL L6 (Elemental Armour): a ward of the elements bleeds 1-3 off EVERY attack that
  // lands.
  if (target.perkElemArmour && d > 1) {
    const _cut2 = rng(1, 3);
    const _b2 = d;
    d = Math.max(1, d - _cut2);
    if (d < _b2)
      narrative.push(`  🜂 ${target.name}'s Elemental Armour absorbs ${_b2 - d} of the ${kind}. (Elemental Armour)`);
  }
  // ── ARMOUR ── worn wards, applied last: flat reductions by channel / by the striker's nature,
  // a percentage off spells, a percentage off everything while badly hurt, then the hard cap.
  if (_arm && d > 0) {
    const _b3 = d;
    const _src = target._foeCat || null;
    if (_chan === 'melee' && _arm.meleeDR) d = Math.max(1, d - _arm.meleeDR);
    if (_chan === 'archery' && _arm.arrowDR) d = Math.max(1, d - _arm.arrowDR);
    if (_arm.natureDR && (_src === 'beast' || _src === 'vermin' || _src === 'dragon'))
      d = Math.max(1, d - _arm.natureDR);
    if (_arm.darkDR && (_src === 'undead' || _src === 'fiend')) d = Math.max(1, d - _arm.darkDR);
    if (_chan === 'spell' && _arm.spellPct) d = Math.max(1, Math.round(d * (1 - _arm.spellPct / 100)));
    if (_arm.lowHp && target.hp < (target.maxHp || 20) * 0.5) d = Math.max(1, Math.round(d * (1 - _arm.lowHp / 100)));
    if (_arm.openGuardHits && (target._openGuardUsed || 0) < _arm.openGuardHits) {
      target._openGuardUsed = (target._openGuardUsed || 0) + 1;
      d = Math.max(1, Math.round(d * (1 - (_arm.openGuardPct || 50) / 100)));
    }
    if (d < _b3)
      narrative.push(
        `  ${pcWardIcon(target)} ${pcWardWord(target, 'armour', _chan === 'melee' ? 'meleeDR' : _chan === 'archery' ? 'arrowDR' : 'spellPct')} turns aside ${_b3 - d} of the ${_chan === 'spell' ? 'harm' : _chan === 'archery' ? 'arrow' : 'blow'}.${target.kind === 'monster' ? '' : ` (${_arm.names.join(', ')})`}`,
      );
  }
  // ── DAMAGE FLOOR ── every reduction above is now collectively limited: a landed attack keeps
  // at least HALF of what it came in at. Outright negations (mirror image, first-hit cuirass,
  // shield block, a ward that drinks the whole blow) returned long before this and are untouched
  // — this floors REDUCTION, never PREVENTION.
  if (d > 0) {
    const _floor = Math.max(1, Math.ceil(dmg * PC_DMG_FLOOR_FRACTION));
    if (d < _floor) {
      narrative.push(
        `  ${target.name} turns aside all they can, but the ${_chan === 'spell' ? 'harm' : _chan === 'archery' ? 'arrow' : 'blow'} still lands for ${_floor}. (no ward may take a hit below half)`,
      );
      d = _floor;
    }
  }
  // The hard CAP ward (Abyssal Bulk and kin) is the last word — it is a ceiling on any single hit
  // rather than a reduction, so the floor is never allowed to lift a blow back over it.
  if (_arm && _arm.cap && d > 0) {
    const _capAt = Math.max(1, Math.round(((target.maxHp || 20) * _arm.cap) / 100));
    if (d > _capAt) {
      d = _capAt;
      narrative.push(
        `  ${pcWardIcon(target)} ${pcWardWord(target, 'armour', 'cap')} will not let any single hit bite deeper than ${_capAt}.`,
      );
    }
  }
  // ── DAMAGE CEILING ────
  // 2026-10-08 (Toby item 4a): no single blow, arrow, special or spell in personal combat may take
  // more than HALF of the target's maximum HP, whoever strikes whom (PC_HIT_CAP_FRAC).
  // History: until then it was a third, and only a LAIR GUARDIAN's attack on a character was
  // capped. A hero can still be worn down and killed over a fight, but cannot be
  // deleted by one unlucky roll from a Legendary beast — which is what made sending a hero into a
  // high-tier lair a coin-flip rather than a calculated risk.
  //
  // DELIBERATELY SILENT, as asked: no narrative line is pushed, so the reduced figure is simply
  // the damage the player sees.
  if (d > 0) {
    const _gCap = Math.max(1, Math.floor((target.maxHp || 20) * PC_HIT_CAP_FRAC));
    if (d > _gCap) d = _gCap;
  }
  target.hp -= d;
  if (_mkHpIn > 0 && target.hp <= 0 && target.kind === 'character' && narrative)
    target._fatalMark = {
      arr: narrative,
      idx: _mkIdx,
      blow: srcName && srcName !== target.name ? srcName : null,
      kind: kind || '',
    };
  // Last-Stand Plate: once per fight, the first time the wearer drops below 30% they recover 25%
  // of max.
  if (
    _arm &&
    _arm.secondWind &&
    !target._armSecondWindUsed &&
    target.hp > 0 &&
    target.hp < (target.maxHp || 20) * 0.3
  ) {
    target._armSecondWindUsed = true;
    const _back = Math.max(1, Math.round(((target.maxHp || 20) * _arm.secondWind) / 100));
    target.hp = Math.min(target.maxHp || 20, target.hp + _back);
    narrative.push(
      `  ${pcWardIcon(target)} ${target.name} will not go down — ${target.kind === 'monster' ? pcPerkWord(target, 'secondWind', 'its nature') : "their armour's blessing"} restores ${_back} HP. (HP ${dispFloor(target.hp)})`,
    );
  }
  return d;
}
export function pcRoundStart(cbt, narrative) {
  // ── ARMOUR ── Ashen Plate: lingering harm never takes hold; Troll-Hide: regenerate; Steadfast
  // Harness: aim penalties fade twice as fast and half of all stuns are shrugged off.
  cbt._roundNo = (cbt._roundNo || 0) + 1;
  if (cbt.arm) {
    if (cbt.arm.roundWard > 0) cbt._roundWardLeft = cbt.arm.roundWard; // Shield of the Ward-Saints: a fresh ward each round
    if (pcStunWard(cbt) >= 100 && cbt.status.stun > 0) {
      cbt.status.stun = 0;
      narrative.push(
        `  ${pcWardIcon(cbt)} ${cbt.kind === 'monster' ? `${cbt.name} cannot be held (${pcPerkWord(cbt, 'stunWard', 'its nature')})` : `${cbt.name}'s shield arm never wavers`} — the daze is ignored.`,
      );
    }
    if ((cbt.arm.dotImmune || (cbt.arm.dotWard || 0) >= 100) && (cbt.status.dot || []).length) {
      cbt.status.dot = [];
      narrative.push(
        `  ${pcWardIcon(cbt)} ${pcWardWord(cbt, 'armour', 'dotWard')} sloughs off every burn, poison and bleeding.`,
      );
    }
    // a GUARDIAN's regeneration fades as the fight runs long (pcSustainMult); a character's worn
    // regeneration is untouched and returns a multiplier of 1.
    if (cbt.arm.regen > 0 && cbt.hp > 0 && cbt.hp < (cbt.maxHp || 20)) {
      const _sm = pcSustainMult(cbt),
        _rg = Math.round(cbt.arm.regen * _sm);
      if (_rg > 0) {
        const h = Math.min(_rg, (cbt.maxHp || 20) - cbt.hp);
        cbt.hp += h;
        narrative.push(
          `  ${pcWardIcon(cbt)} ${pcWardWord(cbt, 'armour', 'regen')} knits flesh for ${h}${_sm < 1 ? ' — the flesh is slower to close now' : ''}. (HP ${dispFloor(cbt.hp)})`,
        );
      } else if (cbt.kind === 'monster' && !cbt._sustainSpent) {
        cbt._sustainSpent = true;
        narrative.push(`  🜏 ${cbt.name} has nothing left to knit with — its wounds stay open.`);
      }
    }
    if (cbt.arm.resist) {
      if (cbt.status.hitPenalty > 0)
        cbt.status.hitPenalty = Math.max(0, cbt.status.hitPenalty - pcPenaltyFade(cbt.status.hitPenalty)); // Steadfast Harness: a second helping of the same fade
      if (cbt.status.stun > 0 && kcRng() < 0.5) {
        cbt.status.stun = 0;
        narrative.push(`  🛡 ${cbt.name} shrugs off the daze — their armour holds them steady.`);
      }
    }
  }
  // Damage-over-time
  // a guardian's lingering-harm ward (dotWard, batch item 7) takes its share off every tick
  const _dw = Math.min(100, (cbt.arm && cbt.arm.dotWard) || 0);
  (cbt.status.dot || []).forEach((d) => {
    if (d.rounds > 0) {
      const _t = _dw > 0 ? Math.round(d.dmg * (1 - _dw / 100)) : d.dmg;
      cbt.hp -= _t;
      d.rounds--;
      narrative.push(
        `  ${d.label || 'Lingering harm'} afflicts ${cbt.name} for ${_t} damage${_dw > 0 ? ` (${pcWardWord(cbt, 'hide', 'dotWard')} turns ${_dw}% of it)` : ''}. (HP ${Math.max(0, Math.round(cbt.hp))})`,
      );
    }
  });
  cbt.status.dot = (cbt.status.dot || []).filter((d) => d.rounds > 0);
  // Heal-over-time (Potion of Regeneration and kin)
  if (cbt.status.hot && cbt.status.hot.rounds > 0) {
    const h = Math.min(cbt.status.hot.amt, Math.max(0, (cbt.maxHp || 20) - cbt.hp));
    cbt.hp += h;
    cbt.status.hot.rounds--;
    if (h > 0)
      narrative.push(
        `  ${cbt.status.hot.label || 'Regeneration'} knits ${cbt.name} for ${h}. (HP ${dispFloor(cbt.hp)})`,
      );
  }
  // Decay to-hit penalty — at least a third of it a round (minimum 5), so nothing blinds a
  // fighter for more than three rounds however deep the penalty was stacked.
  if (cbt.status.hitPenalty > 0)
    cbt.status.hitPenalty = Math.max(0, cbt.status.hitPenalty - pcPenaltyFade(cbt.status.hitPenalty));
  if (cbt.status.meleeHalvedRounds > 0) cbt.status.meleeHalvedRounds--;
  if (cbt.status.meleeDownRounds > 0 && --cbt.status.meleeDownRounds === 0) cbt.status.meleeDown = 0; // a chill lasts one round
  if (cbt.status.silenceRounds > 0) cbt.status.silenceRounds--;
  // 2026-09-26 (Toby item 3): a Powerful / Legendary guardian bound by Spiritwrack rolls to throw
  // the binding off at the start of every round after the first in which it held.
  if (cbt.status._swShrugPct > 0) {
    if (cbt.status.silenceRounds > 0) {
      const _r = d100(),
        _pct = cbt.status._swShrugPct;
      if (_r <= _pct) {
        cbt.status.silenceRounds = 0;
        cbt.status.meleeHalvedRounds = 0;
        cbt.status._swShrugPct = 0;
        narrative.push(`  ⛓ ${cbt.name} tears free of the Spiritwrack binding! (${fmtRoll(_pct, _r)} to shrug it off)`);
      }
    } else cbt.status._swShrugPct = 0;
  }
  // riders hung on this combatant LAST round take hold now — after the fades and decrements
  // above, so each arrives with its full duration intact.
  pcPromotePending(cbt);
}
