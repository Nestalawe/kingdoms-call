import { SKILL_LABELS } from '../army-tables.ts';
import { heroSkillWage } from '../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import { activeItems } from '../items/equipment.ts';
import { effSkillOf, skillBonusBreakdown } from './skills-and-hp.ts';
import type { ASourceOfASkillsBonus } from './skills-and-hp.ts';
import { fmtRoll } from '../dice-and-army-names.ts';
import { dispFloor } from '../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { botKnownSkills } from '../bots/intel.ts';
import { skillLevel } from '../titles/perks.ts';
import type { HeroOfSkills } from '../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import type { SkillLevels } from '../../schemas/saved-game-state.ts';

// Its types (plan P1-10b18): each parameter typed as wide as the body's guards (plan P1-10's Decision 2), so each guard
// stays. A table read by any skill's name is read through a typed local inside its function.
/** A hero as his skill's level is read (effSkillOf's hero): his skills, curses and items, where he stands and whose he
 *  is. */
type AHeroAsHisSkillIsRead = NonNullable<Parameters<typeof effSkillOf>[0]>;
/** A hero as the Veil, Vanish and Invisibility tests read him: his skill's hero, and the turn's marks each leaves on
 *  him (each optional: most heroes carry none). */
interface AHeroAsTheHidingTestsReadHim extends AHeroAsHisSkillIsRead {
  readonly _veilTurn?: number | null | undefined;
  readonly _veilCastPhase?: number | null | undefined;
  readonly _vanishTurn?: number | null | undefined;
  readonly _invisTurn?: number | null | undefined;
}
/** The state as these read it: the turn, the heroes (searched for an aura's bearer) and the realms, each list guarded
 *  as if it may be missing. */
interface TheStateAsTheseReadIt {
  readonly turn: number;
  readonly characters?: (AHeroAsHisSkillIsRead | null | undefined)[] | null | undefined;
  readonly players?:
    readonly ({ readonly _clairCharThisTurn?: number | null | undefined } | null | undefined)[] | null | undefined;
}
/** The turn's context as these read it: the state, and the phase being resolved (none before and after the phases). */
interface TheContextAsTheseReadIt {
  readonly G: TheStateAsTheseReadIt;
  readonly _currentPhase?: number | null | undefined;
}

// ── A HERO'S SKILLS IN PLAY, WHAT OTHERS MAY KNOW, AND WHO IS HIDDEN (plan P1-08a: lifted out of resolveTurn) ────
// A hero's skill as it counts this turn, the notes a roll line may show another realm, a hero's wage, and the Veil and
// Vanish tests. Each takes the turn's context first (src/engine/turn/context.ts), but totalInit and recalcHeroPay,
// which read none.
export function totalInit(c: { readonly skills?: Readonly<SkillLevels> | null | undefined }) {
  const s: Readonly<SkillLevels> = c.skills ?? {};
  return (
    (Number(s.melee) || 0) +
    (Number(s.archery) || 0) +
    (Number(s.tactical) || 0) +
    (Number(s.march) || 0) * 3 +
    (Number(s.naval) || 0) +
    (Number(s.sage) || 0) +
    (Number(s.spy) || 0) +
    (Number(s.thief) || 0) +
    (Number(s.druid) || 0) +
    (Number(s.explorer) || 0) +
    (Number(s.white) || 0) +
    (Number(s.psychic) || 0) +
    (Number(s.illusory) || 0) +
    (Number(s.elemental) || 0) +
    (Number(s.necromancy) || 0)
  );
}
// Delegates to the module-level implementation (see skillBonusBreakdown) so the engine and the
// player report cannot disagree about what a character's skills actually are. Equipped items only
//, minus any Curse, plus the Crown of Command aura; capped 0..5.
// Its return type (plan P1-10b6's claim, checked since P1-10b18): a number, for a hero. It takes a hero, never none
// (skillBonusBreakdown counts no total for none), and reads his total through a check that holds it.
export function effStat(
  turnContext: { readonly G: TheStateAsTheseReadIt },
  c: AHeroAsHisSkillIsRead,
  stat: string,
): number {
  const { G } = turnContext;
  return aHerosSkillAsItIsCounted(effSkillOf(c, stat, G.characters ?? []));
}
/** A hero's skill as skillBonusBreakdown counts it: it counts a total for every hero (only for none does it count
 *  none), so this never throws for a hero. */
function aHerosSkillAsItIsCounted(total: number | undefined): number {
  if (total === undefined) throw new TypeError('A skill is counted only for a hero');
  return total;
}
// ── WHAT A VIEWER MAY BE TOLD ABOUT SOMEONE ELSE'S HERO (2026-09-26, Toby) ────────────────
// Roll lines used to print BOTH sides' skill levels — "Pursuit — Merek (Spy 0) closing on
// Astrigg (Spy 0)" handed the pursuer's owner a rival hero's Spy level for free, which is
// exactly what Spy missions and Clairvoyance are supposed to buy. `botKnownSkills` is already
// the game's single test of whether a realm has earned that knowledge (own hero, a wanderer —
// hired on sight of their skills — or a hero spied within the last eight turns), so these two
// helpers route every roll line through it. A viewer who has not earned it simply sees a name.
export function skillsKnownTo(
  turnContext: { readonly G: TheStateAsTheseReadIt },
  pi: number | null | undefined,
  ch: AHeroAsHisSkillIsRead,
) {
  const { G } = turnContext;
  return pi != null && botKnownSkills(G, pi, ch) !== null;
}
// The skill as a line shows it to a viewer (plan P1-12d8): its label as the caller names it (null: the skill's own),
// its slug and the level it counts at, when this viewer may know it; null when they may not, so the fact a Detection
// line records never holds what the viewer has not earned. Its words are theWordsOfAStatShown, " (Spy 3)" or none, on
// these values alone (the prose imports it from here; statNote, its engine caller's helper, went with its last caller
// in P1-12d12).
/** A hero's skill as a line shows it to a viewer who may know it: the label the caller gives (null: the skill's own),
 *  the skill's slug and the level it counts at. */
export interface AStatShownAsALineTellsIt {
  readonly label: string | null;
  readonly stat: string;
  readonly level: number;
}
export function theStatShownAsALineTellsIt(
  turnContext: { readonly G: TheStateAsTheseReadIt },
  pi: number | null | undefined,
  ch: AHeroAsHisSkillIsRead | null | undefined,
  stat: string,
  label: string | null | undefined,
): AStatShownAsALineTellsIt | null {
  if (!ch || !skillsKnownTo(turnContext, pi, ch)) return null;
  return { label: (label ?? '') || null, stat, level: effStat(turnContext, ch, stat) };
}
/** The words of a skill shown, " (Spy 3)", or none. */
export function theWordsOfAStatShown(shown: AStatShownAsALineTellsIt | null): string {
  if (!shown) return '';
  // the labels read by any skill's slug
  const labels: Readonly<Partial<Record<string, string>>> = SKILL_LABELS;
  return ` (${(shown.label ?? '') || (labels[shown.stat] ?? '') || shown.stat} ${String(shown.level)})`;
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
// The odds as a line shows them to a viewer (plan P1-12d8): the chance and the roll, and whether this viewer may know
// the rival's skill (then the full working, else only whether it landed). Its words are theWordsOfTheOddsShown, on these
// values alone (the prose imports it from here; oddsNote went with its last engine caller in P1-12d12).
/** An opposed roll as a line shows it to a viewer: the chance, the roll, and whether the viewer may know the rival's
 *  skill (the full working), else only whether it landed. */
export interface TheOddsShownAsALineTellsIt {
  readonly theRivalsSkillIsKnown: boolean;
  readonly chance: number;
  readonly roll: number;
}
export function theOddsShownAsALineTellsIt(
  turnContext: { readonly G: TheStateAsTheseReadIt },
  pi: number | null | undefined,
  ch: AHeroAsHisSkillIsRead | null | undefined,
  chance: number,
  roll: number,
): TheOddsShownAsALineTellsIt {
  return { theRivalsSkillIsKnown: !ch || skillsKnownTo(turnContext, pi, ch), chance, roll };
}
/** The words of the odds shown: "40% [roll 23 ✓]" with the working, else "[✓]". */
export function theWordsOfTheOddsShown(odds: TheOddsShownAsALineTellsIt): string {
  const { chance, roll } = odds;
  if (odds.theRivalsSkillIsKnown) return fmtRoll(chance, roll);
  return `[${dispFloor(roll) <= Math.max(0, Math.min(100, dispFloor(chance))) ? '✓' : '✗'}]`;
}
// 2026-09-21 (Toby: "Illusory 3 … rises to level 1"): every skill-rise line quoted the character's
// own TRAINED level, while the cast line one row above quoted the level IN PLAY (training + items
// + aura). A hero with Illusory 0 and a +3 diadem cast "(Illusory 3)" and then "rose to level 1",
// which reads as a bug. Rise lines now add what the skill stands at in play whenever items / aura
// lift it above the trained level. The skill in play is null (no words) when the two agree.
// The skill in play, as a line tells it (plan P1-12d6): its slug, the level it counts at, and each source that raises it
// above his own level, copied as the line is told; null when nothing raises it. A Practice line's fact holds it, and
// the views write its words (theWordsOfASkillInPlay, on these values alone: the prose imports it from here;
// skillInPlayNote went with its last engine caller in P1-12d12).
/** A skill raised above a hero's own level, as a line tells it: its slug, the level it counts at, and what raises it. */
export interface ASkillInPlayAsALineTellsIt {
  readonly skill: string;
  readonly total: number;
  readonly sources: readonly { readonly label: string; readonly delta: number }[];
}
export function theSkillInPlayAsALineTellsIt(
  turnContext: { readonly G: TheStateAsTheseReadIt },
  ch: AHeroAsHisSkillIsRead | null | undefined,
  skill: string,
): ASkillInPlayAsALineTellsIt | null {
  const { G } = turnContext;
  if (!ch) return null;
  // the breakdown as this reads it, its sources guarded as if a gap or none may come
  const b: {
    readonly total?: number | undefined;
    readonly sources?: readonly (ASourceOfASkillsBonus | null | undefined)[] | null | undefined;
  } = skillBonusBreakdown(ch, skill, G.characters ?? []);
  const raw = skillLevel(ch, skill);
  const { total } = b;
  if (total === undefined || !(total > raw)) return null;
  return {
    skill,
    total,
    sources: (b.sources ?? [])
      .filter((s): s is ASourceOfASkillsBonus => !!s && s.delta > 0)
      .map((s) => ({ label: s.label, delta: s.delta })),
  };
}
/** The words of a skill in play, " (Melee 6 in play, with Sword of Ages +1)", or none. */
export function theWordsOfASkillInPlay(inPlay: ASkillInPlayAsALineTellsIt | null): string {
  if (!inPlay) return '';
  const { skill } = inPlay;
  const src = inPlay.sources.map((s) => `${s.label} +${String(s.delta)}`).join(', ');
  // the labels read by any skill's slug
  const labels: Readonly<Partial<Record<string, string>>> = SKILL_LABELS;
  return ` (${(labels[skill] ?? '') || skill} ${String(inPlay.total)} in play${src ? `, with ${src}` : ''})`;
}

// Cloak of Many Faces: this hero cannot be targeted by Spy, Psychic Blast, Curse or Encounter
// Character. ILLUSORY L9 Veil — active only during the cast phase and the phase after it (two
// phases).
export function isVeiled(turnContext: TheContextAsTheseReadIt, ch: AHeroAsTheHidingTestsReadHim | null | undefined) {
  const { G } = turnContext;
  return (
    ch?._veilTurn === G.turn &&
    turnContext._currentPhase != null &&
    ch._veilCastPhase != null &&
    turnContext._currentPhase >= ch._veilCastPhase &&
    turnContext._currentPhase <= ch._veilCastPhase + 1
  );
}
export function isHiddenChar(
  turnContext: TheContextAsTheseReadIt,
  ch: AHeroAsTheHidingTestsReadHim | null | undefined,
) {
  return !!(ch && (isVeiled(turnContext, ch) || activeItems(ch).some((it) => it.effect?.stat === 'hidden')));
}
// THIEF L9 Vanish: a vanished character is untouchable for the REST OF THE TURN — nothing may
// bring them to bay and nothing may harm them. Distinct from Veil, which is phase-scoped and
// shields the whole host: Vanish protects the man alone, and lasts the season.
export function isVanished(
  turnContext: { readonly G: TheStateAsTheseReadIt },
  ch: AHeroAsTheHidingTestsReadHim | null | undefined,
) {
  const { G } = turnContext;
  return ch?._vanishTurn === G.turn;
}
// R-119 (Toby, 2026-10-31): from the moment a hero's Invisibility holds until the turn ends, an order or reaction of
// another realm aimed at him finds no one, unless that realm watches him by Clairvoyance (the mind-link pierces it, as
// it does for sight). Each order calls this where it picks its target, so its realm reads the order's own "no one here"
// line. `turn` is the turn being played: G.turn, until the turn's end moves the counter on (the Informant Network,
// which runs after, passes the turn before).
export function isHiddenByInvisibilityFrom(
  turnContext: { readonly G: TheStateAsTheseReadIt },
  ch: (AHeroAsTheHidingTestsReadHim & { readonly id: number }) | null | undefined,
  realm: number | null | undefined,
  turn: number = turnContext.G.turn,
) {
  const { G } = turnContext;
  if (ch?._invisTurn !== turn || ch.player === realm) return false;
  const theWatchersRealm = realm != null ? (G.players ?? [])[realm] : null;
  return !(theWatchersRealm?._clairCharThisTurn === ch.id);
}

// A hero's wage is a function of their skills, so it must be recomputed EVERYWHERE skills
// change — not just in the Practice order. Experience-driven gains (trySkillGain) previously left
// `pay` frozen at its hiring value, so a hero who learned in the field never got dearer.
// The two founding heroes were the most visible case (3 starting points → ceil(3/4) = 1g, and
// it stayed 1g forever), but it applied to every hero in the game. Kings draw no wage.
export function recalcHeroPay(
  c:
    | (HeroOfSkills & {
        readonly isKing?: boolean | undefined;
        readonly _hireAlignWage?: number | null | undefined;
        pay?: number | undefined;
      })
    | null
    | undefined,
) {
  if (!c || c.isKing) return;
  // base = what the crown agreed to pay for this hero's ALLEGIANCE (the alignment part of the
  // hire bargain, 1g for a founding hero who was never hired), plus the skill premium as it
  // stands now. Same formula the hire desk quotes, so a wage never jumps when a hero changes
  // hands and the alignment premium survives every later rise.
  c.pay = Math.max(1, (c._hireAlignWage ?? 1) + heroSkillWage(c));
}
