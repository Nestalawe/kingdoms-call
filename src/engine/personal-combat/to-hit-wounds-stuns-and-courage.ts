import { kcRng } from '../rng.ts';
import { temperOf } from '../world/tables.ts';
import { GUARDIAN_MELEE_BASE, PC_HIT_CAP_FRAC } from '../names.ts';
import { THE_NUMBERS_THE_CODE_WRITES_FOR_A_GUARDIANS_PERKS } from '../../content/guardian-perks-their-kinds-numbers-and-words.ts';
import { activeItems, type AHeroAsHisItemsAreRead, type AnItemAsTheSlotsReadIt } from '../items/equipment.ts';
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
import { d100, rng } from '../dice-and-army-names.ts';
import { dispFloor } from '../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { whatARealmsDiscoveriesAddToAFightersAim } from '../rules/the-registry-of-discovery-effects.ts';
import { pcFoeCat } from '../titles/perks.ts';
import { narrate } from '../turn/events-and-their-audiences.ts';
import {
  aFightersPerkNameAsTheLineTellsIt,
  aFightersWardAsTheLineTellsIt,
  aListAsTheLineTellsIt,
} from './the-facts-a-personal-combats-lines-record.ts';
import {
  aFightersWardsRefuseAStunOrATerror,
  theDamageAStrikersItemsAddToHisBlow,
  theCapAFightersWardsPutOnAHit,
  theHpAFightersWardsGiveBackAfterAHit,
  whatAFightersWardsDoAsARoundStarts,
  whatAFightersWardsDoToAHitBeforeAllElse,
  whatAFightersWardsLeaveOfAHit,
  whatAFightersWardsTakeOffAChanceToHitHim,
} from '../rules/the-registry-of-magic-item-effects.ts';
import type { TurnContext } from '../turn/context.ts';
import type { NarrativeLine } from '../turn/events-and-their-audiences.ts';
import type {
  AFighterInAPersonalCombat,
  AFightersSchools,
  AFightersStatus,
  ALingeringHarm,
  TheSourceOfADaze,
  TheWardsAFighterWears,
} from './helpers.ts';

// Its types (plan P1-10b12): each parameter typed as wide as the body's guards (plan P1-10's Decision 2), so each guard
// stays; a fighter is AFighterInAPersonalCombat (helpers.ts), and a table read by any name is read through a typed local
// inside its function.
/** A fighter as his skill for the to-hit and his blow are read: his status and his hero may be missing (the code
 *  guards them). */
type AFighterAsHisBlowIsRead = Omit<AFighterInAPersonalCombat, 'status' | 'ref'> & {
  readonly status?: Pick<AFightersStatus, 'meleeDown' | 'meleeHalvedRounds'> | null | undefined;
  readonly ref?: (object & AHeroAsHisItemsAreRead<AnItemAsTheSlotsReadIt>) | null | undefined;
};
/** The wards as a stun's door reads them: their names may be missing (the code guards them). */
type TheWardsAsAStunsDoorReadsThem = Omit<TheWardsAFighterWears, 'names'> & {
  readonly names?: readonly string[] | null | undefined;
};
/** A fighter as the stun's ward reads him: none, or one with no wards. */
type AFighterAsHisStunWardIsRead =
  { readonly arm?: TheWardsAsAStunsDoorReadsThem | null | undefined } | null | undefined;
/** A fighter as a stun lands on him: his status and his wards' names may be missing (the code guards them). */
type AFighterAsAStunLandsOnHim = Omit<AFighterInAPersonalCombat, 'status' | 'arm'> & {
  readonly status?: AFightersStatus | null | undefined;
  readonly arm?: TheWardsAsAStunsDoorReadsThem | null | undefined;
};
/** A fighter as the courage test reads him: his schools may be missing (the code guards them). */
type AFighterAsTheCourageTestReadsHim = Pick<
  AFighterInAPersonalCombat,
  'meleeRaw' | 'melee' | 'archeryRaw' | 'archery' | 'temper'
> & {
  readonly school?: Partial<AFightersSchools> | null | undefined;
};
/** A fighter as the courage test reads his foe: his hero or guardian may be missing, and so may a grade (a hero has
 *  none). */
interface AFighterAsTheCourageTestReadsHisFoe {
  readonly ref?: (object & { readonly power?: string | undefined }) | null | undefined;
}
/** A fighter as a hit reads him: his status may be missing (the code guards every read of it). */
type AFighterAsAHitReadsHim = Omit<AFighterInAPersonalCombat, 'status'> & {
  readonly status?: AFightersStatus | null | undefined;
};
/** The striker as a guardian's weakness reads him: his hero's race (a guardian has none, and the code guards the hero)
 *  and his realm. */
interface AStrikerAsTheWeaknessReadsHim {
  readonly name: string;
  readonly player: AFighterInAPersonalCombat['player'];
  readonly ref?: (object & { readonly race?: string | null | undefined }) | null | undefined;
}
/** A fighter as his round starts: his lingering harms may be missing (the code guards them). */
type AFighterAsHisRoundStarts = Omit<AFighterInAPersonalCombat, 'status'> & {
  readonly status: Omit<AFightersStatus, 'dot'> & { dot?: ALingeringHarm[] | null | undefined };
};
/** A value where the code guards it as if it may be missing (a narrative, a foe or a status no caller leaves out
 *  today), read as it is: the guard stays, and the value keeps its type where the code reads it unguarded. */
export function asItsGuardReadsIt<Value>(value: Value): Value | null | undefined {
  return value;
}

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
export function pcHitSkill(cbt: AFighterAsHisBlowIsRead, which: string) {
  const raw = which === 'archery' ? cbt.archeryRaw : cbt.meleeRaw;
  const base = which === 'archery' ? cbt.archery || 0 : cbt.melee || 0;
  const down = which === 'archery' ? 0 : Number(cbt.status?.meleeDown) || 0; // "−1 melee for next round"
  return Math.max(0, Math.max(raw ?? 0, base) - down);
}
export function pcSkillHitPct(lvl: number) {
  return (
    PC_MELEE_HIT_BASE +
    PC_MELEE_HIT_PER_LVL * Math.min(PC_HIT_SKILL_CAP, lvl) +
    PC_HIT_PER_LVL_ABOVE * Math.max(0, lvl - PC_HIT_SKILL_CAP)
  );
}
export function pcHitChance(
  turnContext: Pick<TurnContext, 'G'>,
  attacker: AFighterInAPersonalCombat,
  defender: AFighterInAPersonalCombat,
) {
  let chance = pcSkillHitPct(pcHitSkill(attacker, 'melee'));
  // ── AK §2.4 Tempers ── the attacker's aggression against the defender's guard. A Berserk has a
  // negative `defence`: they attack wide open and are easier to hit.
  chance += temperOf(attacker.temper).meleeHit;
  chance -= temperOf(defender.temper).defence;
  chance -= attacker.status.hitPenalty || 0;
  chance -= attacker.status.hitPenaltyFixed || 0; // "for the rest of the fight" penalties (Flash Powder, Clinging Pitch)
  chance -= Number(attacker.status.auraPenalty) || 0; // a guardian's passive aura (Dread / Petrifying…) — never decays
  chance += Number(attacker.status.hitBonus) || 0; // Elixir of Focus and kin
  chance -= Number(defender.status.toHitReduce) || 0; // Invisibility: flat \u221225 to hit (floored at 40 below)
  chance -= whatAFightersWardsTakeOffAChanceToHitHim(defender.arm); // Quicksilver Mail: −10% to be hit
  if (attacker.player != null)
    // the discoveries' registry's since plan P1-19ac: "personalCombat: a realm's discoveries steady a fighter's aim"
    chance += whatARealmsDiscoveriesAddToAFightersAim(turnContext.G.players[attacker.player], {
      whatTheFoeIs: defender.kind,
      theFoesKind: () => pcFoeCat(defender),
    }); // duelHit discoveries (Duelling Code …)
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
export function pcMeleeDamage(attacker: AFighterAsHisBlowIsRead, defender: unknown) {
  // Sept 2026 redesign: blows scale with the striker's OWN skill (+ceil(Melee/2)).
  // 2026-09-26: base roll cut from 2–5 to 1–3 and the skill-gap bonus (+max(0, yourMelee − theirMelee))
  // removed — out-skilling a foe now shows up only in hit chance, not in damage per blow.
  // For characters the bonus reads the RAW skill level (1–9, `meleeRaw`) — combat hit-chance
  // stays on the 0–5 scale, but mastery past 5 lands heavier blows. Guardians use their melee
  // stat.
  const baseOfGrade: Readonly<Partial<Record<string, readonly number[]>>> = GUARDIAN_MELEE_BASE;
  const _dsk = Math.max(0, (attacker.meleeRaw ?? (attacker.melee || 0)) - (Number(attacker.status?.meleeDown) || 0));
  const _gd = attacker.kind === 'monster';
  const _base = (_gd ? baseOfGrade[String(attacker.power)] : undefined) ?? [1, 3]; // a guardian's base grows with its tier (each row a list: never falsy)
  // 2026-10-14 (Toby, item 20): a guardian adds +1 for every level of its Melee; a hero still adds ⌈Melee ÷ 2⌉.
  let dmg = Math.max(
    1,
    rng(Number(_base[0]), Number(_base[1])) +
      (_gd ? _dsk : Math.ceil(_dsk / 2)) +
      temperOf(attacker.temper).meleeDamage,
  );
  if ((attacker.status?.meleeHalvedRounds ?? 0) > 0) dmg = Math.max(1, Math.floor(dmg / 2));
  // 2026-09-12b: the defender's temper soak MOVED to pcTakeHit. It is a reduction like any other
  // ward, and applying it here put it outside the half-damage floor — a Cautious hero in Mithril
  // was still taking 1-damage hits because the guard had already scraped the blow down before
  // pcTakeHit ever saw its "original" value. Every reduction now lives in one place.
  dmg += theDamageAStrikersItemsAddToHisBlow(
    attacker.ref ? activeItems(attacker.ref) : [],
    attacker.gauntlets === true,
  ); // Warbringer Gauntlets: +2 damage per successful melee attack (a guardian wielding them too; the items' registry, plan P1-19s)
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
// ── STUNS LAND THROUGH ONE DOOR (2026-10-14, batch item 3) ────
// "Cannot be stunned" used to be honoured only at the start of the NEXT round, so a stun cast by a
// fighter holding the initiative still cost the "unstunnable" one that round's action, and a stun
// riding on a blow (promoted after the round-start check) cost one more. Every stun now arrives
// through pcLandStun, which asks the target's ward first. pcStunWard is the chance (0–100) that a
// stun is shrugged off as it lands; 100 means it never takes hold.
export function pcStunWard(t: AFighterAsHisStunWardIsRead) {
  const a = t?.arm;
  if (!a) return 0;
  return aFightersWardsRefuseAStunOrATerror(a) ? 100 : Math.max(0, Math.min(100, Number(a.stunWard) || 0));
}
// pcStunTurned rolls the ward once and says so when it turns the stun, naming what the daze comes from (its source, a
// record: plan P1-12d19).
export function pcStunTurned(
  target: AFighterAsAStunLandsOnHim,
  narrative: NarrativeLine[] | null | undefined,
  what: TheSourceOfADaze,
) {
  const w = pcStunWard(target);
  if (!(w >= 100 || (w > 0 && d100() <= w))) return false;
  if (narrative)
    narrate(narrative, {
      kind: 'the target cannot be held',
      targetIsAGuardian: target.kind === 'monster',
      targetName: target.name,
      targetStunPerk: aFightersPerkNameAsTheLineTellsIt(target, 'stunWard'),
      targetArmourNames: target.arm?.names ? aListAsTheLineTellsIt(target.arm.names) : null,
      w,
      what,
    });
  return true;
}
// Returns true if the stun takes hold (and adds it), false if the ward turns it.
export function pcLandStun(
  target: AFighterAsAStunLandsOnHim | null | undefined,
  n: number,
  narrative: NarrativeLine[] | null | undefined,
  what: TheSourceOfADaze,
) {
  if (!target?.status || !(n > 0)) return false;
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
export function pcCourageChance(
  foe: AFighterAsTheCourageTestReadsHim,
  actor: AFighterAsTheCourageTestReadsHisFoe | null | undefined,
) {
  const terrorOfPower: Readonly<Partial<Record<string, number>>> = PC_TERROR_BY_POWER;
  const terrorOfTemper: Readonly<Partial<Record<string, number>>> = PC_TERROR_TEMPER;
  const nerve = Math.max(foe.meleeRaw ?? (foe.melee || 0), foe.archeryRaw ?? (foe.archery || 0));
  const faith = 5 * Math.min(2, Number(foe.school?.white) || 0);
  const stature = terrorOfPower[actor?.ref?.power ?? ''] ?? 0; // the table holds no NaN; a grade '' is the key '' as before
  const c = PC_TERROR_BASE + stature - PC_TERROR_PER_LVL * nerve - faith + (terrorOfTemper[foe.temper] ?? 0);
  return Math.max(PC_TERROR_MIN, Math.min(PC_TERROR_MAX, Math.round(c)));
}
// ── SELF-SUSTAIN FADE ────
// (Measured: Marsh Hydra went from a 21% win rate to 90% across three rungs of hero.) The sustain
// now fades as the fight runs long — full for four rounds, half to eight, nothing after — so
// grinding one down is a race against the clock and the curve is a slope instead of a cliff.
// Deliberately NOT applied to characters: a hero's Troll-Hide, Carapace or Ninefold Band is worn
// equipment the player paid for, and this is a fix for guardian pacing, not an item nerf.
// Their figures are the guardian perks' content (plan P1-19ai).
export const PC_SUSTAIN_FULL_ROUNDS =
    THE_NUMBERS_THE_CODE_WRITES_FOR_A_GUARDIANS_PERKS.theSustainsFade.theRoundsAtFullStrength,
  PC_SUSTAIN_HALF_ROUNDS = THE_NUMBERS_THE_CODE_WRITES_FOR_A_GUARDIANS_PERKS.theSustainsFade.theRoundsAtHalfStrength;
export function pcSustainMult(cbt: Pick<AFighterInAPersonalCombat, 'kind' | '_roundNo'> | null | undefined) {
  if (cbt?.kind !== 'monster') return 1;
  const r = Number(cbt._roundNo) || 1;
  return r <= PC_SUSTAIN_FULL_ROUNDS ? 1 : r <= PC_SUSTAIN_HALF_ROUNDS ? 0.5 : 0;
}
export function pcTakeHit(
  turnContext: Pick<TurnContext, 'G'>,
  target: AFighterAsAHitReadsHim,
  dmg: number,
  narrative: NarrativeLine[],
  srcName: string,
  kind: string,
) {
  const { G } = turnContext;
  const channelOf: Readonly<Partial<Record<string, string>>> = PC_CHANNEL;
  const schoolOfSpell: Readonly<Partial<Record<string, string>>> = PC_SPELL_SCHOOL_MAP;
  const kindsChannel = channelOf[kind]; // PC_CHANNEL[kind], read once
  // Beg-for-Mercy narration (2026-09-21): remember WHERE in the narrative a character's fatal blow
  // began, so a Cowardly plea can be told just before that blow lands (see resolvePersonalCombat).
  const _mkHpIn = target.hp, // (a missing target throws on its status below, as before)
    _mkIdx = asItsGuardReadsIt(narrative)?.length ?? 0;
  // Mirror images soak a hit first.
  if (target.status && target.status.mirrorImages > 0) {
    target.status.mirrorImages--;
    narrate(narrative, {
      kind: "a fighter's harm strikes a mirror image",
      srcName,
      harmKind: kind,
      targetName: target.name,
      targetStatusMirrorImages: target.status.mirrorImages,
    });
    return 0;
  }
  let d = dmg;
  // ── ARMOUR ── outright negations first: the Blood-Bound Cuirass takes the first landed hit of
  // the fight in full; the Tower Shield blocks one melee blow or arrow in five.
  const _arm = target.arm ?? null,
    _chan = (kindsChannel ?? '') || 'spell';
  // each ward's effect in the items' registry, in its stage's order (plan P1-19r): the shields' chances are rolled here,
  // where they were, and only when the ward and the channel hold
  for (const _done of whatAFightersWardsDoToAHitBeforeAllElse({
    theWards: _arm,
    theChannel: _chan,
    theDamageSoFar: d,
    theFirstHitHasBeenDrunk: target._armFirstHitUsed,
    theRoundWardLeft: target._roundWardLeft,
    heFightsInMithril: target.mithril,
    theDamageHisMithrilTurnsAside: target.mithrilDR,
  })) {
    if (_done.does === 'drinks the first hit of the fight' && _arm) {
      target._armFirstHitUsed = true;
      narrate(narrative, {
        kind: 'the first harm to reach the target is drunk by their armour',
        channel: _chan,
        targetName: target.name,
        armourNames: aListAsTheLineTellsIt(_arm.names),
      });
      return 0;
    }
    if (_done.does === 'may turn it aside whole') {
      if (!(d100() <= _done.theChance)) continue;
      if (_done.against === 'a blow or an arrow')
        narrate(narrative, {
          kind: "the target's shield takes the blow square on",
          targetName: target.name,
          channel: _chan,
          armBlock: _done.theChance,
        });
      else if (_done.against === 'an arrow')
        narrate(narrative, {
          kind: "the arrow glances off the target's shield",
          targetName: target.name,
          armArrowBlock: _done.theChance,
        });
      else
        narrate(narrative, {
          kind: "the target's shield turns the harm away",
          targetName: target.name,
          harmKind: kind,
          armSpellBlock: _done.theChance,
        });
      return 0;
    }
    if (_done.does === "soaks some with this round's ward") {
      const _rw = _done.theSoak;
      target._roundWardLeft = (target._roundWardLeft ?? 0) - _rw;
      d -= _rw;
      narrate(narrative, {
        kind: "the ward on the target's shield soaks some of the harm",
        targetName: target.name,
        rw: _rw,
      });
      if (d <= 0) return 0;
      continue;
    }
    // Mithril Armour turns aside 2 points of any MELEE or ARROW blow that lands
    // (a magic sword-arm or spell still ignores it), never below 1 damage — and it announces itself
    // each time it saves the wearer harm.
    if (_done.does === 'turns aside some of a blow or an arrow') {
      const _b = d;
      d = _done.theDamageAfter;
      if (d < _b)
        narrate(narrative, {
          kind: "the target's mithril armour turns aside some of the harm",
          targetName: target.name,
          damageTurnedAside: _b - d,
          channel: _chan, // a blow's or an arrow's: the suit turns aside no other
        });
    }
  }
  // Monster nature: armoured hides turn blades, bone shrugs off arrows, magic ignores plate.
  if (target.vuln) {
    const vulnOf: Readonly<Partial<Record<string, number>>> = target.vuln;
    const ch = (kindsChannel ?? '') || 'spell';
    d = Math.max(1, Math.round(d * ((vulnOf[ch] ?? 0) || 1)));
  }
  // ── WEAKNESS ── the guardian's one exploitable flaw. Doubles the damage of the attack it is
  // open to; percentage-of-max-HP spells are exempt (they get a doubled take-hold chance
  // instead). The first time it bites, the striker's realm learns the flaw for the rest of the
  // game.
  if (target.kind === 'monster' && target.weak && d > 0 && !PC_WEAK_NO_DMG_DOUBLE.has(kind)) {
    const _wsrc: AStrikerAsTheWeaknessReadsHim | null = target._foe ?? null;
    const _wsrcRealm = _wsrc?.player != null ? G.players[_wsrc.player] : undefined; // read once, as it was tested
    const _wapp = pcWeaknessApplies(target.weak, {
      chan: _chan,
      school: (schoolOfSpell[kind] ?? '') || null,
      race: _wsrc?.ref ? (_wsrc.ref.race ?? '') || null : null,
      align: _wsrcRealm ? _wsrcRealm.alignment || null : null,
    });
    if (_wapp) {
      const _wb = d;
      d = Math.max(1, Math.round(d * PC_WEAK_MULT));
      narrate(narrative, {
        kind: "the hunter finds the target's weakness",
        channel: _chan,
        targetName: target.name,
        targetWeakName: target.weak.name,
        wb: _wb,
        damage: d,
      });
      if (_wsrc?.player != null && pcLearnWeakness(G, _wsrc.player, target.name))
        narrate(narrative, {
          kind: "the hunter sees the target's weakness plainly now",
          wsrcName: _wsrc.name,
          targetWeakDesc: target.weak.desc,
          targetName: target.name,
        });
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
      narrate(narrative, {
        kind: "the target reads the beast's every move",
        targetName: target.name,
        damageTurnedAside: _bw - d,
        channel: kindsChannel,
        targetDruidBeastWard: target.druidBeastWard,
      });
  }
  if (target.status && target.status.incomingDmgBonus > 0) d += target.status.incomingDmgBonus; // Melt Armour
  // ── Temper: Rage ── A Berserk shrugs off a fifth of every blow and arrow that lands. Spells
  // bypass it entirely (rage is a tolerance for pain, not a ward), and it can never reduce a
  // landed hit below 1. ── Temper: a guarded stance ── Cautious rolls with the blow rather than
  // taking it square on. Melee only: a guard turns a blade, not an arrow or a spell.
  const _tSoak = temperOf(target.temper).damageSoak || 0;
  if (_tSoak > 0 && kindsChannel === 'melee' && d > 1) {
    const _tb = d;
    d = Math.max(1, d - _tSoak);
    if (d < _tb)
      narrate(narrative, {
        kind: 'the target rolls with the blow and takes less',
        targetName: target.name,
        damageRolledWith: _tb - d,
        targetTemper: target.temper,
      });
  }
  const _soakPct = temperOf(target.temper).hitSoakPct || 0;
  if (_soakPct > 0 && (kindsChannel === 'melee' || kindsChannel === 'archery')) {
    const _before = d;
    d = Math.max(1, Math.round(d * (1 - _soakPct)));
    if (d < _before)
      narrate(narrative, {
        kind: 'the target takes the harm on raw fury',
        targetName: target.name,
        harmKind: kind,
        damageShruggedOff: _before - d,
        soakPct: dispFloor(_soakPct * 100),
      });
  }
  if (target.status && target.status.absorb > 0) {
    const soak = Math.min(target.status.absorb, d);
    target.status.absorb -= soak;
    d -= soak;
    narrate(narrative, { kind: 'a ward around the target drinks some of the blow', targetName: target.name, soak });
    if (d <= 0) return 0;
  }
  // MELEE L6 (Parry): a master swordsman turns part of a melee blow aside — 50% chance to shave
  // 1..⌊melee/2⌋ off a landed melee/free/counter strike, never below 1.
  if (target.perkParry && kindsChannel === 'melee' && d > 1 && kcRng() < 0.5) {
    const _cut = rng(1, Math.max(1, Math.floor((Number(target.meleeRaw) || 0) / 2)));
    const _b = d;
    d = Math.max(1, d - _cut);
    if (d < _b)
      narrate(narrative, {
        kind: 'the target parries turning aside some of the blow',
        targetName: target.name,
        damageTurnedAside: _b - d,
      });
  }
  // ELEMENTAL L6 (Elemental Armour): a ward of the elements bleeds 1-3 off EVERY attack that
  // lands.
  if (target.perkElemArmour && d > 1) {
    const _cut2 = rng(1, 3);
    const _b2 = d;
    d = Math.max(1, d - _cut2);
    if (d < _b2)
      narrate(narrative, {
        kind: "the target's elemental armour absorbs some of the harm",
        targetName: target.name,
        damageAbsorbed: _b2 - d,
        harmKind: kind,
      });
  }
  // ── ARMOUR ── worn wards, applied last: flat reductions by channel / by the striker's nature,
  // a percentage off spells, a percentage off everything while badly hurt, then the hard cap.
  if (_arm && d > 0) {
    const _b3 = d;
    const _src = (target._foeCat ?? '') || null;
    const _cut = whatAFightersWardsLeaveOfAHit({
      theWards: _arm,
      theChannel: _chan,
      theStrikersKind: _src,
      hisHp: target.hp,
      hisMaximumHp: target.maxHp || 20,
      theHitsHisOpenGuardHasTaken: Number(target._openGuardUsed) || 0,
      theDamageSoFar: d,
    });
    if (_cut.hisOpenGuardTookIt) target._openGuardUsed = (Number(target._openGuardUsed) || 0) + 1;
    d = _cut.theDamageAfter;
    if (d < _b3)
      narrate(narrative, {
        kind: "the target's armour turns aside some of the harm",
        targetIsAGuardian: target.kind === 'monster',
        targetsWard: aFightersWardAsTheLineTellsIt(target, _cut.theWardTheLineNames),
        damageTurnedAside: _b3 - d,
        channel: _chan,
        armourNames: aListAsTheLineTellsIt(_arm.names),
      });
  }
  // ── DAMAGE FLOOR ── every reduction above is now collectively limited: a landed attack keeps
  // at least HALF of what it came in at. Outright negations (mirror image, first-hit cuirass,
  // shield block, a ward that drinks the whole blow) returned long before this and are untouched
  // — this floors REDUCTION, never PREVENTION.
  if (d > 0) {
    const _floor = Math.max(1, Math.ceil(dmg * PC_DMG_FLOOR_FRACTION));
    if (d < _floor) {
      narrate(narrative, {
        kind: 'the target turns aside all they can but the harm still lands',
        targetName: target.name,
        channel: _chan,
        floor: _floor,
      });
      d = _floor;
    }
  }
  // The hard CAP ward (Abyssal Bulk and kin) is the last word — it is a ceiling on any single hit
  // rather than a reduction, so the floor is never allowed to lift a blow back over it.
  const _capped = theCapAFightersWardsPutOnAHit({
    theWards: _arm,
    hisMaximumHp: target.maxHp || 20,
    theDamageSoFar: d,
  });
  if (_capped) {
    const _capAt = _capped.theDamageAfter;
    d = _capAt;
    narrate(narrative, {
      kind: "the target's armour will not let any single hit bite deeper",
      targetIsAGuardian: target.kind === 'monster',
      targetsWard: aFightersWardAsTheLineTellsIt(target, _capped.theWardTheLineNames),
      capAt: _capAt,
    });
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
  if (_mkHpIn > 0 && target.hp <= 0 && target.kind === 'character' && asItsGuardReadsIt(narrative))
    target._fatalMark = {
      arr: narrative,
      idx: _mkIdx,
      blow: srcName && srcName !== target.name ? srcName : null,
      kind: kind || '',
    };
  // Last-Stand Plate: once per fight, the first time the wearer drops below 30% they recover 25%
  // of max.
  const _wind = theHpAFightersWardsGiveBackAfterAHit({
    theWards: _arm,
    hisSecondWindHasBeenUsed: target._armSecondWindUsed,
    hisHp: target.hp,
    hisMaximumHp: target.maxHp || 20,
  });
  if (_wind) {
    target._armSecondWindUsed = true;
    const _back = _wind.theHp;
    target.hp = Math.min(target.maxHp || 20, target.hp + _back);
    narrate(narrative, {
      kind: 'the target will not go down and restores hit points',
      targetIsAGuardian: target.kind === 'monster',
      targetName: target.name,
      targetSecondWindPerk: aFightersPerkNameAsTheLineTellsIt(target, _wind.theWardTheLineNames),
      back: _back,
      targetHp: dispFloor(target.hp),
    });
  }
  return d;
}
export function pcRoundStart(cbt: AFighterAsHisRoundStarts, narrative: NarrativeLine[]) {
  // ── ARMOUR ── Ashen Plate: lingering harm never takes hold; Troll-Hide: regenerate; Steadfast
  // Harness: aim penalties fade twice as fast and half of all stuns are shrugged off.
  cbt._roundNo = (Number(cbt._roundNo) || 0) + 1;
  if (cbt.arm) {
    const _wards = whatAFightersWardsDoAsARoundStarts(cbt.arm); // each ward's effect in the items' registry (plan P1-19r)
    if (_wards.theFreshWardThisRound !== undefined) cbt._roundWardLeft = _wards.theFreshWardThisRound; // Shield of the Ward-Saints: a fresh ward each round
    if (pcStunWard(cbt) >= 100 && cbt.status.stun > 0) {
      cbt.status.stun = 0;
      narrate(narrative, {
        kind: 'a fighter ignores the daze',
        cbtIsAGuardian: cbt.kind === 'monster',
        cbtName: cbt.name,
        cbtStunPerk: aFightersPerkNameAsTheLineTellsIt(cbt, 'stunWard'),
      });
    }
    if (
      (_wards.everyLingeringHarmSloughsOff || (Number(cbt.arm.dotWard) || 0) >= 100) &&
      (cbt.status.dot ?? []).length
    ) {
      cbt.status.dot = [];
      narrate(narrative, {
        kind: "a fighter's armour sloughs off every burn poison and bleeding",
        cbtIsAGuardian: cbt.kind === 'monster',
        cbtsWard: aFightersWardAsTheLineTellsIt(cbt, 'dotWard'),
      });
    }
    // a GUARDIAN's regeneration fades as the fight runs long (pcSustainMult); a character's worn
    // regeneration is untouched and returns a multiplier of 1.
    if (_wards.heRegenerates && cbt.hp > 0 && cbt.hp < (cbt.maxHp || 20)) {
      const _sm = pcSustainMult(cbt),
        _rg = Math.round(_wards.heRegenerates.theHp * _sm);
      if (_rg > 0) {
        const h = Math.min(_rg, (cbt.maxHp || 20) - cbt.hp);
        cbt.hp += h;
        narrate(narrative, {
          kind: "a guardian's regeneration knits its flesh",
          cbtIsAGuardian: cbt.kind === 'monster',
          cbtsWard: aFightersWardAsTheLineTellsIt(cbt, _wards.heRegenerates.theWardTheLineNames),
          healed: h,
          sm: _sm,
          cbtHp: dispFloor(cbt.hp),
        });
      } else if (cbt.kind === 'monster' && !cbt._sustainSpent) {
        cbt._sustainSpent = true;
        narrate(narrative, { kind: 'a fighter has nothing left to knit', cbtName: cbt.name });
      }
    }
    if (_wards.heHoldsSteady) {
      if (cbt.status.hitPenalty > 0)
        cbt.status.hitPenalty = Math.max(0, cbt.status.hitPenalty - pcPenaltyFade(cbt.status.hitPenalty)); // Steadfast Harness: a second helping of the same fade
      if (cbt.status.stun > 0 && kcRng() < _wards.heHoldsSteady.theChanceToShrugOffADaze) {
        cbt.status.stun = 0;
        narrate(narrative, { kind: 'a fighter shrugs off the daze, held steady by their armour', cbtName: cbt.name });
      }
    }
  }
  // Damage-over-time
  // a guardian's lingering-harm ward (dotWard, batch item 7) takes its share off every tick
  const _dw = Math.min(100, Number(cbt.arm?.dotWard) || 0);
  (cbt.status.dot ?? []).forEach((d) => {
    if (d.rounds > 0) {
      const _t = _dw > 0 ? Math.round(d.dmg * (1 - _dw / 100)) : d.dmg;
      cbt.hp -= _t;
      d.rounds--;
      narrate(narrative, {
        kind: 'a lingering harm afflicts a fighter',
        harmSource: d.source,
        cbtName: cbt.name,
        harmDealt: _t,
        dotWard: _dw,
        cbtsWard: aFightersWardAsTheLineTellsIt(cbt, 'dotWard'),
        cbtHp: Math.max(0, Math.round(cbt.hp)),
      });
    }
  });
  cbt.status.dot = (cbt.status.dot ?? []).filter((d) => d.rounds > 0);
  // Heal-over-time (Potion of Regeneration and kin)
  if (cbt.status.hot && cbt.status.hot.rounds > 0) {
    const h = Math.min(cbt.status.hot.amt, Math.max(0, (cbt.maxHp || 20) - cbt.hp));
    cbt.hp += h;
    cbt.status.hot.rounds--;
    if (h > 0)
      narrate(narrative, {
        kind: 'a healing knits a fighter',
        healingLabel: cbt.status.hot.label,
        cbtName: cbt.name,
        healed: h,
        cbtHp: dispFloor(cbt.hp),
      });
  }
  // Decay to-hit penalty — at least a third of it a round (minimum 5), so nothing blinds a
  // fighter for more than three rounds however deep the penalty was stacked.
  if (cbt.status.hitPenalty > 0)
    cbt.status.hitPenalty = Math.max(0, cbt.status.hitPenalty - pcPenaltyFade(cbt.status.hitPenalty));
  if (cbt.status.meleeHalvedRounds > 0) cbt.status.meleeHalvedRounds--;
  if (cbt.status.meleeDownRounds !== undefined && cbt.status.meleeDownRounds > 0 && --cbt.status.meleeDownRounds === 0)
    cbt.status.meleeDown = 0; // a chill lasts one round
  if (cbt.status.silenceRounds > 0) cbt.status.silenceRounds--;
  // 2026-09-26 (Toby item 3): a Powerful / Legendary guardian bound by Spiritwrack rolls to throw
  // the binding off at the start of every round after the first in which it held.
  if (cbt.status._swShrugPct !== undefined && cbt.status._swShrugPct > 0) {
    if (cbt.status.silenceRounds > 0) {
      const _r = d100(),
        _pct = cbt.status._swShrugPct;
      if (_r <= _pct) {
        cbt.status.silenceRounds = 0;
        cbt.status.meleeHalvedRounds = 0;
        cbt.status._swShrugPct = 0;
        narrate(narrative, {
          kind: 'a fighter tears free of the spiritwrack',
          cbtName: cbt.name,
          shrugPct: _pct,
          roll: _r,
        });
      }
    } else cbt.status._swShrugPct = 0;
  }
  // riders hung on this combatant LAST round take hold now — after the fades and decrements
  // above, so each arrives with its full duration intact.
  pcPromotePending(cbt);
}
