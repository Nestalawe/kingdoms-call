// ── The level a hero's skill counts at, and his items counted each name once (plan P1-11e32) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). Moved as they were from skillBonusBreakdown (src/engine/heroes/skills-and-hp.ts), which effStat
// and the report's effective skills ask, so the order form's effMagicLvl can later ask the turn's own: his items each
// name once, his trained level capped at 5 (9 for Druid), and the bonuses to 9 for the skills whose bonuses stack past 5.
// The numbers were src/engine/army-tables.ts's, which re-exports them.
import { KC_ITEM_UNCAPPED_SKILLS } from '../../content/kingdoms-call-data.ts';

// ── SKILLS ────
// TRAINING gives its benefit up to level 5; levels 6-9 buy mastery perks and mastery orders
// instead. Magic items and the Crown of Command aura stack above that ONLY for melee and archery,
// to the skill ceiling of 9. Those two are special: the engine already gives levels past 5 a real
// meaning there — meleeRaw/archeryRaw drive the damage roll, to-hit climbs +5% per level past 5,
// and perkTier reads the same scale. Every other skill (tactical, naval, sage, druid, spy, thief,
// explorer, march and the five magic schools) has no defined behaviour above 5, and the engine is
// tuned around that cap in a dozen places, so their bonuses still stop at 5.
export const SKILL_BENEFIT_CAP = 5,
  SKILL_MAX = 9;
// the five magic schools JOIN melee and archery as skills whose item and aura bonuses stack on top
// of a trained 5, to the ceiling of 9. What that buys is CAST CHANCE only — +10% a level to the 95%
// ceiling — because every spell EFFECT is computed on `Math.min(lvl,5)`
// (pcCastCombatSpell's `lvlEff`, the action phase's `spellLevelEff`, the Bless ward, Phantasmal
// Armies). The per-turn cast limit already tops out at 3 from level 4, and the per-fight limit at 2
// from level 2, so neither moves either. A relic focus therefore makes a master more RELIABLE,
// never more powerful — which is the distinction Toby asked for.
export const ITEM_UNCAPPED_SKILLS = new Set(KC_ITEM_UNCAPPED_SKILLS);
// Skills whose TRAINED levels 6-9 also count for effect (not just items past 5). 2026-09-24: Druid.
export const FULL_RANGE_SKILLS = new Set(['druid']);

/** A hero's items each name once: the first of each name (an item of no name by its effect), gaps dropped. Two of
 *  one item add their bonus once. */
export function dedupeItemsByName<
  AnItem extends { readonly name?: string | undefined; readonly effect?: object | null | undefined },
>(items: readonly (AnItem | null | undefined)[] | null | undefined) {
  const seen = new Set<string>();
  const out: AnItem[] = [];
  (items ?? []).forEach((it) => {
    if (!it) return;
    const k = (it.name ?? '') || 'fx:' + JSON.stringify(it.effect ?? {});
    if (seen.has(k)) return;
    seen.add(k);
    out.push(it);
  });
  return out;
}

/** The share of a hero's trained level that counts: from 0 to 5, or to 9 for a skill whose trained levels 6 to 9
 *  count (Druid). */
export function theTrainedLevelOfAHerosSkillThatCounts(skill: string, theTrainedLevel: number): number {
  return Math.max(0, Math.min(FULL_RANGE_SKILLS.has(skill) ? SKILL_MAX : SKILL_BENEFIT_CAP, theTrainedLevel));
}

/** The level a hero's skill counts at: the share of his trained level that counts, plus his items' bonus (each name
 *  once), a Crown of Command's aura and a Curse's cut (negative), from 0 to 5, or to 9 for a skill whose bonuses
 *  stack past 5 (melee, archery, the five schools) or whose trained levels count to 9 (Druid). */
export function theLevelAHerosSkillCountsAt(
  skill: string,
  theTrainedLevel: number,
  hisItemsBonus: number,
  theAurasBonus: number,
  theCursesCut: number,
): number {
  // TRAINING tops out at 5 for benefit purposes — levels 6-9 buy mastery perks and mastery ORDERS
  // instead of further scaling, which is the documented rule the engine is tuned around (see the
  // Sage discovery chance, the Druid army bonus, the Thief hoard cut).
  // MELEE and ARCHERY only: item and aura bonuses stack ON TOP of that capped base, to the ceiling of 9.
  // Levels past 5 already mean something for those two (damage, +5%/level to-hit, perkTier), so a
  // Legendary +4 blade is felt in full instead of being worth one level to a Melee 4 hero and nothing
  // at all to a Melee 5 one.
  // EVERY OTHER SKILL: the total still stops at 5, so a +2 Tome cannot make a Tactical 5 hero
  // out-general a trained Tactical 9 in the battle maths.
  // DRUID (2026-09-24, Toby): the whole skill counts — trained levels 6-9 add, and items/aura stack on
  // top, to the ceiling of 9. (Druid mastery, primal strikes, the parley roll and the Curse's choice of
  // skill all read this figure.)
  const _trained = theTrainedLevelOfAHerosSkillThatCounts(skill, theTrainedLevel);
  const _ceiling = ITEM_UNCAPPED_SKILLS.has(skill) || FULL_RANGE_SKILLS.has(skill) ? SKILL_MAX : SKILL_BENEFIT_CAP;
  return Math.max(0, Math.min(_ceiling, _trained + hisItemsBonus + theAurasBonus + theCursesCut));
}
