// The checks the Cast Spell order makes of the spell named, at the five stages of "orderValidity" (plan P1-19's spells
// family, row P1-19y): whether a charmed hero will not turn it on his lord, whether it costs no casting slot (a Grand
// Cathedral's Bless Province), whether its mark must stand in the caster's province, whether a Cloak of Many Faces
// shields a mark from it, and whether a Bless ward may turn it aside. Each holds where the spell's content row says so
// (`asAnOrder`, src/content/spell-effects-their-names-numbers-and-words.ts); the order (resolveCastSpellOrder, in
// src/engine/orders/) asks the spells' registry where it asked by name, and refuses, frees or shields as it did. Until
// P1-19y they were two sets of src/engine/army-tables.ts (CHARMED_NO_TURN_SPELLS, by name, and
// SPELL_FNS_NEED_COLOCATED_TARGET, by `fn`), four names in the order's code, and the four spells that call
// blessWardNegates (src/engine/magic/plague-and-bless-ward.ts), which still call it where they did.
import {
  SPELL_EFFECTS_THE_REGISTRY_HOLDS as ROWS,
  type ASpellAsItsTextsWriteIt,
  type SpellSlug,
  type TheChecksTheCastSpellOrderMakesOfASpell,
} from '../../../content/spell-effects-their-names-numbers-and-words.ts';
import { theMarkOfThisSpellMustStandInTheCastersProvince } from '../../rules-on-plain-values/whether-a-spells-mark-must-stand-in-the-casters-province.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheChecks = TheStagesOfEachHookPoint['orderValidity'];

/** A check that holds where the spell's row says it does. */
const itsRowSays = (slug: SpellSlug, check: keyof TheChecksTheCastSpellOrderMakesOfASpell) => (): boolean => {
  const row: ASpellAsItsTextsWriteIt = ROWS[slug];
  return row.asAnOrder?.[check] === true;
};

// The character-aimed hostile spells: a hero charmed from an enemy realm will not aim them at his own lord's heroes (the
// Encounter order is refused on the same grounds), in the order the set wrote them.
export const A_CHARMED_HERO_WILL_NOT_TURN_IT_ON_HIS_LORD = {
  'psychic-blast': itsRowSays('psychic-blast', 'aCharmedHeroWillNotTurnItOnHisLord'),
  'telekinetic-storm': itsRowSays('telekinetic-storm', 'aCharmedHeroWillNotTurnItOnHisLord'),
  curse: itsRowSays('curse', 'aCharmedHeroWillNotTurnItOnHisLord'),
  charm: itsRowSays('charm', 'aCharmedHeroWillNotTurnItOnHisLord'),
  'control-undead': itsRowSays('control-undead', 'aCharmedHeroWillNotTurnItOnHisLord'),
  dominate: itsRowSays('dominate', 'aCharmedHeroWillNotTurnItOnHisLord'),
} satisfies Partial<Record<SpellSlug, TheChecks['a charmed hero will not turn it on his lord']>>;

// GRAND DESIGN, Divine (the Grand Cathedral): Bless Province uses no casting slot, and is never blocked.
export const A_SPELL_THAT_COSTS_NO_CASTING_SLOT = {
  'bless-province': (facts) =>
    facts.theCastersRealmHasAGrandCathedral && itsRowSays('bless-province', 'aGrandCathedralFreesItsSlot')(),
} satisfies Partial<Record<SpellSlug, TheChecks['a spell that costs no casting slot']>>;

// The spells whose named hero must be standing in the caster's own province, refused before the cast roll (a guard
// after the roll is no guard: a caster whose mark had marched away burned the roll and the slot on a spell never
// worked), in the order the set wrote them. Province-aimed spells and the remote scry (Clairvoyance) are absent. Each
// asks the check the order form shares (src/engine/rules-on-plain-values/, plan P1-11c2), which reads the spell's row.
const theSharedCheckSays = (slug: SpellSlug) => (): boolean =>
  theMarkOfThisSpellMustStandInTheCastersProvince(ROWS[slug].name);
export const A_SPELLS_MARK_MUST_STAND_IN_THE_PROVINCE = {
  charm: theSharedCheckSays('charm'),
  'psychic-blast': theSharedCheckSays('psychic-blast'),
  'telekinetic-storm': theSharedCheckSays('telekinetic-storm'),
  oratory: theSharedCheckSays('oratory'),
  'phantasmal-armies': theSharedCheckSays('phantasmal-armies'),
  'control-undead': theSharedCheckSays('control-undead'),
  curse: theSharedCheckSays('curse'),
  'divine-judgment': theSharedCheckSays('divine-judgment'),
  'mass-confusion': theSharedCheckSays('mass-confusion'),
  dominate: theSharedCheckSays('dominate'),
  'chain-lightning': theSharedCheckSays('chain-lightning'),
} satisfies Partial<Record<SpellSlug, TheChecks["a spell's mark must stand in the province"]>>;

// The Cloak of Many Faces shields its wearer from a hostile Psychic Blast and Curse (its own check, isHiddenChar, waits
// for P1-23's `visibility`).
export const A_CLOAKED_MARK_IS_SHIELDED_FROM_IT = {
  'psychic-blast': itsRowSays('psychic-blast', 'aCloakedMarkIsShieldedFromIt'),
  curse: itsRowSays('curse', 'aCloakedMarkIsShieldedFromIt'),
} satisfies Partial<Record<SpellSlug, TheChecks['a cloaked mark is shielded from it']>>;

// The spells an enemy's Bless ward may turn aside, on its own roll (Q2: Part Sea too).
export const A_BLESS_WARD_MAY_TURN_IT_ASIDE = {
  'part-sea': itsRowSays('part-sea', 'aBlessWardMayTurnItAside'),
  earthquake: itsRowSays('earthquake', 'aBlessWardMayTurnItAside'),
  flood: itsRowSays('flood', 'aBlessWardMayTurnItAside'),
  plague: itsRowSays('plague', 'aBlessWardMayTurnItAside'),
} satisfies Partial<Record<SpellSlug, TheChecks['a Bless ward may turn it aside']>>;
