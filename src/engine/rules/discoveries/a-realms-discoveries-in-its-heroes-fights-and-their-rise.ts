// A realm's discoveries in its heroes' fights and their rise (plan P1-19's discoveries family, row P1-19ac): the
// effects of the kinds that steady a fighter's aim, add to his Melee and his Archery, and strengthen his Mithril (the
// stages of "personalCombat"), and that add to a skill's chance to rise and harden the king (the stages of
// "experience"). A caster's chance, the third stage this row asks, is P1-19aa's (a-realms-discoveries-in-its-armys-
// strength.ts). Each is handed one effect the realm holds (its row's numbers and filters, in SAGE_DISCOVERIES_P) and
// the facts of its stage; the runners (the-registry-of-discovery-effects.ts) find the realm's effects of the kind and
// add or ask them, as the readers of src/engine/discoveries.ts and the resolvers did. No effect draws a die: the
// resolver rolls where it rolled before.
import {
  DISCOVERY_EFFECTS_THE_REGISTRY_HOLDS,
  type DiscoveryEffectSlug,
  type TheEffectOfADiscovery,
} from '../../../content/discovery-effects-their-kinds-numbers-and-words.ts';
import type {
  AFoeARealmsDiscoveriesSteadyAFightersAimAt,
  TheStagesOfEachHookPoint,
} from '../the-registry-of-content-effects.ts';

type TheFightersStages = TheStagesOfEachHookPoint['personalCombat'];
type TheExperienceStages = TheStagesOfEachHookPoint['experience'];

/** Whether an aim effect reaches the foe: every foe, or the foe it names (`vs`: a monster, a character, or an undead
 *  foe, the foe's kind asked only here). discDuelVs's rule, moved as it was (its callers always hand a foe). */
function doesItReachTheFoe(e: TheEffectOfADiscovery, facts: AFoeARealmsDiscoveriesSteadyAFightersAimAt): boolean {
  if (!e.vs) return true;
  if (e.vs === 'monster') return facts.whatTheFoeIs === 'monster';
  if (e.vs === 'character') return facts.whatTheFoeIs === 'character';
  if (e.vs === 'undead') return facts.theFoesKind() === 'undead';
  return false;
}

/** "personalCombat: a realm's discoveries steady a fighter's aim" (`duelHit`): its `pct`, if it reaches the foe. */
export const A_REALMS_DISCOVERIES_STEADY_A_FIGHTERS_AIM = {
  'a-fighters-aim': (e, facts) => (doesItReachTheFoe(e, facts) ? (e.pct ?? 0) : null),
} satisfies Partial<Record<DiscoveryEffectSlug, TheFightersStages["a realm's discoveries steady a fighter's aim"]>>;

/** "personalCombat: a realm's discoveries add to a fighter's skills" (Veteran Training, `skillBonusCombat`): the kind's
 *  levels added (+1), to his Melee and his Archery. */
export const A_REALMS_DISCOVERIES_ADD_TO_A_FIGHTERS_SKILLS = {
  'veteran-training': () => DISCOVERY_EFFECTS_THE_REGISTRY_HOLDS['veteran-training'].numbers.theLevelsAdded.value,
} satisfies Partial<Record<DiscoveryEffectSlug, TheFightersStages["a realm's discoveries add to a fighter's skills"]>>;

/** "personalCombat: a realm's discoveries strengthen his Mithril" (`mithril`): its `extra`. */
export const A_REALMS_DISCOVERIES_STRENGTHEN_HIS_MITHRIL = {
  'mithril-craft': (e) => e.extra ?? 0,
} satisfies Partial<Record<DiscoveryEffectSlug, TheFightersStages["a realm's discoveries strengthen his Mithril"]>>;

/** "experience: a realm's discoveries add to a skill's rise" (`skillGain`): its `pct`, for every skill or the skills
 *  it lists. */
export const A_REALMS_DISCOVERIES_ADD_TO_A_SKILLS_RISE = {
  'a-skills-rise': (e, facts) => (!e.skills || e.skills.includes(facts.theSkill) ? (e.pct ?? 0) : null),
} satisfies Partial<Record<DiscoveryEffectSlug, TheExperienceStages["a realm's discoveries add to a skill's rise"]>>;

/** "experience: a realm's discoveries harden the king" (Order of the Golden Shield, `kingKillHpX2`): the kind's factor
 *  (×2). */
export const A_REALMS_DISCOVERIES_HARDEN_THE_KING = {
  'golden-shield': () => DISCOVERY_EFFECTS_THE_REGISTRY_HOLDS['golden-shield'].numbers.theFactor.value,
} satisfies Partial<Record<DiscoveryEffectSlug, TheExperienceStages["a realm's discoveries harden the king"]>>;
