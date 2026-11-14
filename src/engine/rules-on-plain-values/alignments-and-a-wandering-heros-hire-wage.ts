// ── The alignments, the distance between two, and a wandering hero's hire wage (plan P1-11a3) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a).
import {
  THE_LADDER_OF_THE_ALIGNMENTS,
  type ARungOfTheLadder,
} from '../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';

/** A hero as heroSkillTotal reads him: his skills, by name. */
export interface HeroOfSkills {
  readonly skills?: Readonly<Record<string, number | undefined>> | null | undefined;
}

// The ladder's rungs, in its order (P1-19av2: the table beside the alignment abilities' rows, in content).
export const ALIGNMENTS_P: string[] = THE_LADDER_OF_THE_ALIGNMENTS.theRungs.map((rung) => rung.alignment);
// ── Alignment spectrum & hero hire economics ────
// ALIGNMENTS_P doubles as the moral SPECTRUM: Divine(0) … Neutral(3) … Undead(6). A wandering
// hero's wage is 2g base +1g per 2 steps of distance from the hiring KINGDOM's alignment — Neutral
// kings sit mid-spectrum and hire everyone at 2–3g; Divine and Undead kings pay through the nose
// for the far side. Distance 6 (Divine<->Undead) is an outright refusal: no wage buys that service
// (waived by sd31 Diplomatic Protocols, at the maximum 5g).
export function alignDistP(a: string, b: string): number {
  const i = ALIGNMENTS_P.indexOf(a),
    j = ALIGNMENTS_P.indexOf(b);
  if (i < 0 || j < 0) return 0;
  return Math.abs(i - j);
}
// A hero's SKILL premium on top of the alignment base. Neutral heroes now grow while they wander
// (progressNeutralHeroes + battle experience), so a chieftain who has held his province for twenty
// turns is a far better buy than a fresh wanderer — and used to cost exactly the same, because the
// hire wage was alignment-only. The premium mirrors the in-service wage formula (ceil(total/4))
// with the starting hero's one gold taken off, so a freshly generated 3-point wanderer still hires
// at the old 2–5g and every point earned since shows up in the asking price.
export function heroSkillTotal(ch: HeroOfSkills | null | undefined): number {
  return Object.values((ch && ch.skills) || {}).reduce((s: number, v: number | undefined) => s + (v || 0), 0);
}
export function heroSkillWage(ch: HeroOfSkills | null | undefined): number {
  return Math.max(0, Math.ceil(heroSkillTotal(ch) / 4) - 1);
}
export function heroHireWage(
  kingdomAlign: string,
  heroAlign: string,
  waiveBan?: boolean,
  hero?: HeroOfSkills | null,
): number | null {
  const { theWageOfAHeroAtNoDistance, theStepsForEachGoldMore, theStepsOfTheGulf } =
    THE_LADDER_OF_THE_ALIGNMENTS.theNumbers;
  const d = alignDistP(kingdomAlign, heroAlign);
  if (d >= theStepsOfTheGulf.value && !waiveBan) return null; // Divine <-> Undead: will never serve
  return (
    theWageOfAHeroAtNoDistance.value +
    Math.floor(Math.min(d, theStepsOfTheGulf.value) / theStepsForEachGoldMore.value) +
    (hero ? heroSkillWage(hero) : 0)
  );
}
// ── Mercy, by the foe's own alignment (P1-19av2: a column of the ladder, Decision D) ────
// A felled coward begs his foe for mercy; the foe's own alignment (his, or his temper item's: Decision G) sets the chance
// he spares him, and whether a refusal is his laughter. The resolver draws the dice, where it drew them before.
/** The rung of an alignment, or none (no alignment, or one the ladder doesn't hold). */
function theRungOf(alignment: string): ARungOfTheLadder | undefined {
  return THE_LADDER_OF_THE_ALIGNMENTS.theRungs.find((rung) => rung.alignment === alignment);
}
/** The chance, in percent, a foe of this alignment spares a felled coward's plea; none for an alignment the ladder
 *  doesn't hold (the resolver's own 50% then). */
export function theChanceAFoeOfThisAlignmentSparesAPlea(alignment: string): number | undefined {
  return theRungOf(alignment)?.theChanceAFoeSparesAPlea.value;
}
/** Whether a foe of this alignment refuses a plea with laughter (no die drawn for its words); not one of none. */
export function aFoeOfThisAlignmentLaughsAtAPlea(alignment: string): boolean {
  return theRungOf(alignment)?.aFoesRefusalIsLaughter ?? false;
}
