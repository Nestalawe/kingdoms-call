// The action spells the Cast Spell order works, by slug (plan P1-19z).
// resolveCastSpellOrder finds a spell's work here by the spell's slug: its row in src/content/spell-effects-their-names-
// numbers-and-words.ts, or its place in the table beside the rows of the spells the registry holds no effect for (the
// spell's `fn` is what the order holds), where its chain of `fn === '…'` branches stood.
import {
  ACTION_SPELLS_THE_REGISTRY_HOLDS_NO_EFFECT_FOR,
  SPELL_EFFECTS_THE_REGISTRY_HOLDS,
  type SpellSlug,
} from '../../../content/spell-effects-their-names-numbers-and-words.ts';
import {
  workBlessProvince,
  workDivineJudgment,
  workHolySymbol,
  workPartSea,
  workResurrect,
  workSanctuary,
} from './white-magic-spells-the-cast-spell-order-works.ts';
import {
  whenCharmFizzles,
  workCharm,
  workClairvoyance,
  workDominate,
  workMassConfusion,
  workOratory,
  workPsychicBlast,
  workTelekineticStorm,
} from './psychic-spells-the-cast-spell-order-works-and-the-charms-backlash.ts';
import {
  workHideLairs,
  workIllusoryTerrain,
  workInvisibility,
  workPhantasmalArmies,
  workPhantomHost,
  workVeil,
} from './illusory-spells-the-cast-spell-order-works.ts';
import {
  workCataclysm,
  workChainLightning,
  workEarthquake,
  workElementalSummon,
  workFlood,
} from './elemental-spells-the-cast-spell-order-works.ts';
import {
  workControlUndead,
  workCurse,
  workDeathsDominion,
  workPlague,
  workRaiseWraiths,
  workSkeletalArmies,
} from './necromancy-spells-the-cast-spell-order-works.ts';
import type { AnActionSpellsWork } from './what-an-action-spell-of-the-cast-spell-order-is-handed.ts';

/** The spells the Cast Spell order works (the ones whose SPELL_DEFS_P row is an action): 30, 18 with a row of the
 *  registry's and 12 with none yet. */
export type ActionSpellSlug = Extract<
  SpellSlug | keyof typeof ACTION_SPELLS_THE_REGISTRY_HOLDS_NO_EFFECT_FOR,
  | 'resurrect'
  | 'part-sea'
  | 'holy-symbol'
  | 'bless-province'
  | 'charm'
  | 'oratory'
  | 'clairvoyance'
  | 'psychic-blast'
  | 'telekinetic-storm'
  | 'illusory-terrain'
  | 'phantasmal-armies'
  | 'hide-lairs'
  | 'earthquake'
  | 'flood'
  | 'elemental-summon'
  | 'control-undead'
  | 'skeletal-armies'
  | 'curse'
  | 'plague'
  | 'sanctuary'
  | 'divine-judgment'
  | 'mass-confusion'
  | 'dominate'
  | 'phantom-host'
  | 'invisibility'
  | 'veil'
  | 'chain-lightning'
  | 'cataclysm'
  | 'raise-wraiths'
  | 'deaths-dominion'
>;

/** One work for each action spell, and no other (a spell with none fails to compile, TS1360; a work with no spell,
 *  TS2353). */
export const THE_ACTION_SPELLS_THE_CAST_SPELL_ORDER_WORKS = {
  resurrect: { worked: workResurrect },
  'part-sea': { worked: workPartSea },
  'holy-symbol': { worked: workHolySymbol },
  'bless-province': { worked: workBlessProvince },
  charm: { worked: workCharm, whenItFizzles: whenCharmFizzles },
  oratory: { worked: workOratory },
  clairvoyance: { worked: workClairvoyance },
  'psychic-blast': { worked: workPsychicBlast },
  'telekinetic-storm': { worked: workTelekineticStorm },
  'illusory-terrain': { worked: workIllusoryTerrain },
  'phantasmal-armies': { worked: workPhantasmalArmies },
  'hide-lairs': { worked: workHideLairs },
  earthquake: { worked: workEarthquake },
  flood: { worked: workFlood },
  'elemental-summon': { worked: workElementalSummon },
  'control-undead': { worked: workControlUndead },
  'skeletal-armies': { worked: workSkeletalArmies },
  curse: { worked: workCurse },
  plague: { worked: workPlague },
  sanctuary: { worked: workSanctuary },
  'divine-judgment': { worked: workDivineJudgment },
  'mass-confusion': { worked: workMassConfusion },
  dominate: { worked: workDominate },
  'phantom-host': { worked: workPhantomHost },
  invisibility: { worked: workInvisibility },
  veil: { worked: workVeil },
  'chain-lightning': { worked: workChainLightning },
  cataclysm: { worked: workCataclysm },
  'raise-wraiths': { worked: workRaiseWraiths },
  'deaths-dominion': { worked: workDeathsDominion },
} satisfies Record<ActionSpellSlug, AnActionSpellsWork>;

const isAnActionSpellsSlug = (slug: string): slug is ActionSpellSlug =>
  Object.hasOwn(THE_ACTION_SPELLS_THE_CAST_SPELL_ORDER_WORKS, slug);
const THE_WORK_OF_EACH_FN = new Map<string, AnActionSpellsWork>();
const THE_ROWS_OF_THE_ACTION_SPELLS: readonly Readonly<Record<string, { readonly fn: string }>>[] = [
  SPELL_EFFECTS_THE_REGISTRY_HOLDS,
  ACTION_SPELLS_THE_REGISTRY_HOLDS_NO_EFFECT_FOR,
];
for (const rows of THE_ROWS_OF_THE_ACTION_SPELLS)
  for (const [slug, row] of Object.entries(rows))
    if (isAnActionSpellsSlug(slug)) THE_WORK_OF_EACH_FN.set(row.fn, THE_ACTION_SPELLS_THE_CAST_SPELL_ORDER_WORKS[slug]);

/** The work of the action spell whose `fn` is given (SPELL_DEFS_P's key of it), or none for an `fn` no action spell
 *  has. */
export function theWorkOfTheActionSpell(fn: string): AnActionSpellsWork | undefined {
  return THE_WORK_OF_EACH_FN.get(fn);
}
