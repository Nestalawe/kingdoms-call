// ── The skills in their order, and a hero's fame in words (plan P1-11a3) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a).
import { KC_SKILLS } from '../../content/kingdoms-call-data.ts';

/** A hero as topSkillOf reads him: his skills, by name. */
export interface HeroWithSkills {
  readonly skills?: Readonly<Record<string, number>> | null | undefined;
}

export const ALL_SKILLS: string[] = KC_SKILLS.slice();

// ── HERO FAME ── a wandering hero's reputation is described, never numbered: the Hire and Broker
// dropdowns quote the same words the Intelligence report uses. Module level; buildPlayerReport's
// own copies delegate here so the two can never drift apart.
export function skillFameLabelM(level: number | null | undefined): string {
  const l = level || 0;
  return l >= 7 ? 'has a heroic level of' : l >= 4 ? 'legendary for' : 'renowned for';
}
export function topSkillOf(char: HeroWithSkills | null | undefined): { skill: string; level: number } | null {
  const skills = Object.entries((char && char.skills) || {}).filter(([, v]) => v > 0);
  if (!skills.length) return null;
  const maxLevel = Math.max(...skills.map(([, v]) => v));
  const tied = skills.filter(([, v]) => v === maxLevel);
  // Deterministic tie-break by canonical skill order, so the same hero reads the same everywhere.
  tied.sort((a, b) => ALL_SKILLS.indexOf(a[0]) - ALL_SKILLS.indexOf(b[0]));
  const [sk, lv] = tied[0] as [string, number];
  return { skill: sk, level: lv };
}
