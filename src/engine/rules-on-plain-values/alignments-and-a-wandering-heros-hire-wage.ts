// ── The alignments, the distance between two, and a wandering hero's hire wage (plan P1-11a3) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a).
import { KC_ALIGNMENTS } from '../../content/kingdoms-call-data.ts';

/** A hero as heroSkillTotal reads him: his skills, by name. */
export interface HeroOfSkills {
  readonly skills?: Readonly<Record<string, number | undefined>> | null | undefined;
}

export const ALIGNMENTS_P: string[] = KC_ALIGNMENTS.slice();
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
  const d = alignDistP(kingdomAlign, heroAlign);
  if (d >= 6 && !waiveBan) return null; // Divine <-> Undead: will never serve
  return 2 + Math.floor(Math.min(d, 6) / 2) + (hero ? heroSkillWage(hero) : 0);
}
