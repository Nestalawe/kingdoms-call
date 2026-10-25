// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { protoSkillLift } from '../alignment-prototypes.ts';
import { SKILL_LABELS } from '../army-tables.ts';
import { heroSkillWage } from '../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import { activeItems } from '../items/equipment.ts';
import { effSkillOf, skillBonusBreakdown } from './skills-and-hp.ts';
import { fmtRoll } from '../dice-and-army-names.ts';
import { dispFloor } from '../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { botKnownSkills } from '../bots/intel.ts';
import { skillLevel } from '../titles/perks.ts';

// ── A HERO'S SKILLS IN PLAY, WHAT OTHERS MAY KNOW, AND WHO IS HIDDEN (plan P1-08a: lifted out of resolveTurn) ────
// A hero's skill as it counts this turn, the notes a roll line may show another realm, a hero's wage, and the Veil and
// Vanish tests. Each takes the turn's context first (src/engine/turn/context.ts), but totalInit and recalcHeroPay,
// which read none.
export function totalInit(c) {
  const s = c.skills || {};
  return (
    (s.melee || 0) +
    (s.archery || 0) +
    (s.tactical || 0) +
    (s.march || 0) * 3 +
    (s.naval || 0) +
    (s.sage || 0) +
    (s.spy || 0) +
    (s.thief || 0) +
    (s.druid || 0) +
    (s.explorer || 0) +
    (s.white || 0) +
    (s.psychic || 0) +
    (s.illusory || 0) +
    (s.elemental || 0) +
    (s.necromancy || 0)
  );
}
// Delegates to the module-level implementation (see skillBonusBreakdown) so the engine and the
// player report cannot disagree about what a character's skills actually are. Equipped items only
//, minus any Curse, plus the Crown of Command aura; capped 0..5.
export function effStat(turnContext, c, stat) {
  const { G } = turnContext;
  const base = effSkillOf(c, stat, G.characters || []);
  // PROTOTYPE (alignment ideas round 1): a kit may lift a skill (Neutral's guilds, Evil's poisoners, Divine Power,
  // the barrows an Undead realm holds), never past 9.
  const lift = protoSkillLift(G, c, stat, base);
  return lift > 0 ? Math.min(9, base + lift) : base;
}
// ── WHAT A VIEWER MAY BE TOLD ABOUT SOMEONE ELSE'S HERO (2026-09-26, Toby) ────────────────
// Roll lines used to print BOTH sides' skill levels — "Pursuit — Merek (Spy 0) closing on
// Astrigg (Spy 0)" handed the pursuer's owner a rival hero's Spy level for free, which is
// exactly what Spy missions and Clairvoyance are supposed to buy. `botKnownSkills` is already
// the game's single test of whether a realm has earned that knowledge (own hero, a wanderer —
// hired on sight of their skills — or a hero spied within the last eight turns), so these two
// helpers route every roll line through it. A viewer who has not earned it simply sees a name.
export function skillsKnownTo(turnContext, pi, ch) {
  const { G } = turnContext;
  return pi != null && botKnownSkills(G, pi, ch) !== null;
}
// " (Spy 3)" when this viewer may know it, "" when they may not.
export function statNote(turnContext, pi, ch, stat, label) {
  if (!ch || !skillsKnownTo(turnContext, pi, ch)) return '';
  return ` (${label || SKILL_LABELS[stat] || stat} ${effStat(turnContext, ch, stat)})`;
}
// An OPPOSED roll's percentage is itself a disclosure: pursuit is 50 +5×(my Spy) −5×(their Spy),
// so a player who knows their own level can read the rival's straight off the number. Hiding the
// "(Spy N)" label alone would change nothing. When the viewer has not earned the knowledge the
// exact odds are replaced by a band — they still learn how the attempt felt and whether it landed,
// but cannot solve for the hidden level. Known rival (own hero, wanderer, spied within 8 turns) →
// the full working, unchanged.
// 2026-09-27 (Toby item 5): the descriptive BAND is gone too. "even odds" narrowed the rival's
// hidden Spy level to a five-point window — a player who knows their own level could read the
// other off the phrasing almost as well as off the number, which is exactly the guessing this
// block exists to prevent. A viewer who has not earned the knowledge now learns only whether the
// attempt landed; a known rival (own hero, wanderer, spied within 8 turns) still gets the full
// working, unchanged.
export function oddsNote(turnContext, pi, ch, chance, roll) {
  if (!ch || skillsKnownTo(turnContext, pi, ch)) return fmtRoll(chance, roll);
  return `[${dispFloor(roll) <= Math.max(0, Math.min(100, dispFloor(chance))) ? '✓' : '✗'}]`;
}
// 2026-09-21 (Toby: "Illusory 3 … rises to level 1"): every skill-rise line quoted the character's
// own TRAINED level, while the cast line one row above quoted the level IN PLAY (training + items
// + aura). A hero with Illusory 0 and a +3 diadem cast "(Illusory 3)" and then "rose to level 1",
// which reads as a bug. Rise lines now add what the skill stands at in play whenever items / aura
// lift it above the trained level. `skillInPlayNote` returns '' when the two agree.
export function skillInPlayNote(turnContext, ch, skill) {
  const { G } = turnContext;
  if (!ch) return '';
  const b = skillBonusBreakdown(ch, skill, G.characters || []);
  const raw = skillLevel(ch, skill);
  if (!(b.total > raw)) return '';
  const src = (b.sources || [])
    .filter((s) => s && s.delta > 0)
    .map((s) => `${s.label} +${s.delta}`)
    .join(', ');
  return ` (${SKILL_LABELS[skill] || skill} ${b.total} in play${src ? `, with ${src}` : ''})`;
}

// Cloak of Many Faces: this hero cannot be targeted by Spy, Psychic Blast, Curse or Encounter
// Character. ILLUSORY L9 Veil — active only during the cast phase and the phase after it (two
// phases).
export function isVeiled(turnContext, ch) {
  const { G } = turnContext;
  return !!(
    ch &&
    ch._veilTurn === G.turn &&
    turnContext._currentPhase != null &&
    ch._veilCastPhase != null &&
    turnContext._currentPhase >= ch._veilCastPhase &&
    turnContext._currentPhase <= ch._veilCastPhase + 1
  );
}
export function isHiddenChar(turnContext, ch) {
  return !!(
    ch &&
    (isVeiled(turnContext, ch) || activeItems(ch).some((it) => it.effect && it.effect.stat === 'hidden'))
  );
}
// THIEF L9 Vanish: a vanished character is untouchable for the REST OF THE TURN — nothing may
// bring them to bay and nothing may harm them. Distinct from Veil, which is phase-scoped and
// shields the whole host: Vanish protects the man alone, and lasts the season.
export function isVanished(turnContext, ch) {
  const { G } = turnContext;
  return !!(ch && ch._vanishTurn === G.turn);
}

// A hero's wage is a function of their skills, so it must be recomputed EVERYWHERE skills
// change — not just in the Practice order. Experience-driven gains (trySkillGain) previously left
// `pay` frozen at its hiring value, so a hero who learned in the field never got dearer.
// The two founding heroes were the most visible case (3 starting points → ceil(3/4) = 1g, and
// it stayed 1g forever), but it applied to every hero in the game. Kings draw no wage.
export function recalcHeroPay(c) {
  if (!c || c.isKing) return;
  // base = what the crown agreed to pay for this hero's ALLEGIANCE (the alignment part of the
  // hire bargain, 1g for a founding hero who was never hired), plus the skill premium as it
  // stands now. Same formula the hire desk quotes, so a wage never jumps when a hero changes
  // hands and the alignment premium survives every later rise.
  c.pay = Math.max(1, (c._hireAlignWage != null ? c._hireAlignWage : 1) + heroSkillWage(c));
}
