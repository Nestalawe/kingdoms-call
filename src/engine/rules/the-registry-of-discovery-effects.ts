// The rule registry of the discoveries' effects (plan P1-19's discoveries family, Decisions 2 to 4). A kind of effect is
// one row in src/content/ (the kind as SAGE_DISCOVERIES_P names it, and the numbers the code writes for every effect of
// the kind: discovery-effects-their-kinds-numbers-and-words.ts) and one entry here, keyed by the same slug, naming its
// effect at each stage of a hook point. The hook points and their stages are the content effects' (one union, in
// the-registry-of-content-effects.ts); each stage's order is THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES.
//
// A realm holds its discoveries by id (`discoveries`, each `{ id, … }`); each discovery's numbers and filters are its
// row's in SAGE_DISCOVERIES_P (its `effect` and `effect2`). A runner is handed the realm, finds the effects of its
// stage's kinds the realm holds (theEffectsOfAKindARealmHolds, by id, in the order the realm holds its discoveries,
// `effect` before `effect2`), and hands each to the kind's effect, so an old save works as it does.
import { SAGE_DISCOVERIES_P } from '../../content/kingdoms-call-data.ts';
import {
  DISCOVERY_EFFECTS_THE_REGISTRY_HOLDS,
  type ADiscoverysRow,
  type AKindOfDiscoveryEffect,
  type DiscoveryEffectSlug,
  type TheEffectOfADiscovery,
} from '../../content/discovery-effects-their-kinds-numbers-and-words.ts';
import {
  A_REALMS_DISCOVERIES_ADD_TO_A_CASTERS_CHANCE,
  A_REALMS_DISCOVERIES_ADD_TO_A_SIEGE,
  A_REALMS_DISCOVERIES_FORTIFY_ITS_OWN_GROUND,
  A_REALMS_DISCOVERIES_LET_A_BEAST_FOLLOW_WITHOUT_ITS_DRUID,
  A_REALMS_DISCOVERIES_STIR_A_SIDES_FANATICISM,
  A_REALMS_DISCOVERIES_STRENGTHEN_A_UNIT,
} from './discoveries/a-realms-discoveries-in-its-armys-strength.ts';
import {
  A_REALMS_DISCOVERIES_CARRY_A_FALLEN_UNIT_HOME,
  A_REALMS_DISCOVERIES_DRAG_A_HERO_FROM_THE_FIELD,
  A_REALMS_DISCOVERIES_PROMOTE_A_UNIT,
  A_REALMS_DISCOVERIES_SPARE_A_BEATEN_UNIT,
  A_REALMS_DISCOVERIES_WEIGHT_THE_LINES_BEHIND_THE_FRONT,
} from './discoveries/a-realms-discoveries-in-its-lines-and-its-units-fates.ts';
import {
  A_REALMS_DISCOVERIES_ADD_TO_A_FIGHTERS_SKILLS,
  A_REALMS_DISCOVERIES_ADD_TO_A_SKILLS_RISE,
  A_REALMS_DISCOVERIES_HARDEN_THE_KING,
  A_REALMS_DISCOVERIES_STEADY_A_FIGHTERS_AIM,
  A_REALMS_DISCOVERIES_STRENGTHEN_HIS_MITHRIL,
} from './discoveries/a-realms-discoveries-in-its-heroes-fights-and-their-rise.ts';
import {
  A_REALMS_DISCOVERIES_ADD_TO_A_LAIRS_GOLD,
  A_REALMS_DISCOVERIES_ADD_TO_A_LAIRS_ITEM,
  A_REALMS_DISCOVERIES_ADD_TO_A_RESTS_HEAL,
  A_REALMS_DISCOVERIES_ADD_TO_A_SPYS_CHANCE,
  A_REALMS_DISCOVERIES_ADD_TO_CATCHING_A_SPY,
  A_REALMS_DISCOVERIES_ADD_TO_EXPLORING,
  A_REALMS_DISCOVERIES_ADD_TO_PRACTICE,
  A_REALMS_DISCOVERIES_ADD_TO_RESEARCH,
  A_REALMS_DISCOVERIES_ADD_TO_SPYING_ON_A_HERO,
  A_REALMS_DISCOVERIES_CUT_A_RIVAL_SPYS_CHANCE,
  A_REALMS_DISCOVERIES_HEAL_A_RESTING_HERO_IN_FULL,
  A_REALMS_DISCOVERIES_KEEP_A_SPYS_SUCCESS_QUIET,
  A_REALMS_DISCOVERIES_LENGTHEN_THE_WILD_HUNT,
  A_REALMS_DISCOVERIES_MAP_THE_PROVINCES_AROUND_AN_EXPLORER,
  A_REALMS_DISCOVERIES_SPOT_A_HERO_LURKING_IN_ITS_PROVINCE,
} from './discoveries/a-realms-discoveries-in-its-heroes-orders-and-its-sight.ts';
import {
  A_REALMS_DISCOVERIES_ADD_TO_A_BLESS,
  A_REALMS_DISCOVERIES_ADD_TO_THE_CONSECRATIONS_A_CROWN_MAY_HOLD,
  A_REALMS_DISCOVERIES_CUT_A_COMPANYS_PRICE,
  A_REALMS_DISCOVERIES_CUT_A_UNITS_PRICE,
  A_REALMS_DISCOVERIES_CUT_THE_CORPSE_CARTERS_COST,
  A_REALMS_DISCOVERIES_RAISE_A_CALL_TO_ARMS_QUALITY,
  A_REALMS_DISCOVERIES_RAISE_A_RECRUITS_QUALITY,
  A_REALMS_DISCOVERIES_WAIVE_THE_HIRING_BAN,
} from './discoveries/a-realms-discoveries-in-its-recruits-and-its-works.ts';
import {
  A_REALMS_DISCOVERIES_ADD_TO_A_BLOOD_HARVEST,
  A_REALMS_DISCOVERIES_ADD_TO_A_CONQUESTS_PLUNDER,
  A_REALMS_DISCOVERIES_ADD_TO_A_MARCH,
  A_REALMS_DISCOVERIES_ADD_TO_THE_TERROR_A_VICTORY_LEAVES,
  A_REALMS_DISCOVERIES_HELP_CONVERGING_COLUMNS_UNITE,
} from './discoveries/a-realms-discoveries-in-wars-spoils-and-the-march.ts';
import {
  A_REALMS_DISCOVERIES_ADD_TO_A_PROVINCES_TAX,
  A_REALMS_DISCOVERIES_ADD_TO_MAXIMUM_HP,
  A_REALMS_DISCOVERIES_ADD_TO_THE_REALMS_TAX,
  A_REALMS_DISCOVERIES_CAP_A_HEROS_WAGE,
  A_REALMS_DISCOVERIES_CHART_A_PROVINCE,
  A_REALMS_DISCOVERIES_CUT_A_HEROS_WAGE,
  A_REALMS_DISCOVERIES_CUT_A_UNITS_WAGE,
  A_REALMS_DISCOVERIES_DRESS_A_FIGHTERS_WOUNDS,
  A_REALMS_DISCOVERIES_EARN_INTEREST,
  A_REALMS_DISCOVERIES_HEAL_THE_WOUNDED,
  A_REALMS_DISCOVERIES_KEEP_THE_GRAVES,
  A_REALMS_DISCOVERIES_NAME_AN_UNSEEN_CAPTAIN,
  A_REALMS_DISCOVERIES_PROMOTE_THE_CAPITALS_ARMIES,
} from './discoveries/a-realms-discoveries-at-the-turns-end-and-the-new-turn.ts';
import type {
  ABeastACommanderLeads,
  AConsecrationARealmsDiscoveriesMayAllow,
  AQualityACallToArmsMayRaise,
  AUnitARealmRaises,
  AProvinceARealmsDiscoveriesMayPlunder,
  AUnitARealmsDiscoveriesMaySpeed,
  AHeroARealmsDiscoveriesMayHeal,
  AHeroWhoseMaximumHpARealmsDiscoveriesMayRaise,
  AHeroWhoseWageARealmsDiscoveriesMayCut,
  AProvinceARealmsDiscoveriesMayTax,
  ATreasuryARealmsDiscoveriesMayEarnInterestOn,
  AUnitWhoseWageARealmsDiscoveriesMayCut,
  TheIncomeTaxationRecordsAddsTo,
  WhatAnEffectPaysAndItsOwnCeiling,
  WhatEachCappedEffectHasPaid,
  ABeatenUnitARealmsDiscoveriesMaySpare,
  ACastARealmsDiscoveriesMayHelp,
  AFoeARealmsDiscoveriesSteadyAFightersAimAt,
  ALairsHoardARealmsDiscoveriesMayEnrich,
  AProvinceARealmsDiscoveriesWatch,
  AResearchARealmsDiscoveriesMayHelp,
  ASkillARealmsDiscoveriesMayDrill,
  ASkillARealmsDiscoveriesMayRaise,
  ASideAsItsFanaticismIsRolled,
  AUnitARealmsDiscoveriesMayPromote,
  AUnitARealmsDiscoveriesMayStrengthen,
  HookPointName,
  TheAttackersUnitsAtASiege,
  TheGroundAHeroWorks,
  TheGroundARealmDefends,
  TheStagesOfEachHookPoint,
  WhereAHeroRestsAsARealmsDiscoveriesReadIt,
  WhereASpyActsAsARealmsDiscoveriesReadIt,
} from './the-registry-of-content-effects.ts';

/** A realm as the discoveries read it: its race and alignment, its discoveries, the ones it forgot and the pairs
 *  awaiting its choice, each guarded. Its ids are made strings before they are compared, so the lists are typed as
 *  wide. */
export interface ARealmAsTheDiscoveriesReadIt {
  readonly race?: string | undefined;
  readonly alignment?: string | undefined;
  readonly discoveries?: readonly ({ readonly id: string } | null | undefined)[] | null | undefined;
  readonly forgottenDiscoveries?: readonly unknown[] | null | undefined;
  readonly pendingDiscoveryChoices?:
    readonly ({ readonly options?: readonly unknown[] | null | undefined } | null | undefined)[] | null | undefined;
}

// Race/alignment discoveries carry `race` / `alignment`; a realm can only research, breakthrough, Grand-Library or
// steal (spy) a discovery it is eligible for. Their effects are data-driven (`effect.kind`) and found through
// theEffectsOfAKindARealmHolds, below (moved from src/engine/discoveries.ts by plan P1-19aa, as it was).
export const DISC_BY_ID: Record<string, ADiscoverysRow> = {};
SAGE_DISCOVERIES_P.forEach((d) => {
  DISC_BY_ID[d.id] = d;
});

// 2026-09-21 rebalance: a discovery may carry a SECOND, smaller effect (`effect2`) — used by the Espionage and
// exploration discoveries whose single lever was too weak on its own. Both are found the same way, so every effect
// applies to either slot. (discEffectsOf's rule, which src/engine/discoveries.ts asks.)
export function theEffectsOfAKindARealmHolds(pl: ARealmAsTheDiscoveriesReadIt | null | undefined, kind: string) {
  if (!pl) return [];
  const out: TheEffectOfADiscovery[] = [];
  (pl.discoveries ?? []).forEach((d) => {
    const t = d && DISC_BY_ID[d.id];
    if (!t) return;
    [t.effect, t.effect2].forEach((e) => {
      if (e?.kind === kind) out.push(e);
    });
  });
  return out;
}

/** An entry: the kind's effect at each stage it acts in. */
export type DiscoveryEffectEntry = { readonly [H in HookPointName]?: Partial<TheStagesOfEachHookPoint[H]> };

/** One entry for each content row, and no other (a row with no entry fails to compile, TS1360; an entry with no row,
 *  TS2353). */
export const THE_REGISTRY_OF_DISCOVERY_EFFECTS = {
  'unit-strength': {
    strength: { "a realm's discoveries strengthen a unit": A_REALMS_DISCOVERIES_STRENGTHEN_A_UNIT['unit-strength'] },
  },
  siegecraft: { strength: { "a realm's discoveries add to a siege": A_REALMS_DISCOVERIES_ADD_TO_A_SIEGE.siegecraft } },
  'own-ground': {
    strength: {
      "a realm's discoveries fortify its own ground": A_REALMS_DISCOVERIES_FORTIFY_ITS_OWN_GROUND['own-ground'],
    },
  },
  fanaticism: {
    strength: {
      "a realm's discoveries stir a side's fanaticism": A_REALMS_DISCOVERIES_STIR_A_SIDES_FANATICISM.fanaticism,
    },
  },
  casting: {
    aHerosStanding: {
      "a realm's discoveries add to a caster's chance": A_REALMS_DISCOVERIES_ADD_TO_A_CASTERS_CHANCE.casting,
    },
  },
  'dragon-taming': {
    strength: {
      "a realm's discoveries let a beast follow without its Druid":
        A_REALMS_DISCOVERIES_LET_A_BEAST_FOLLOW_WITHOUT_ITS_DRUID['dragon-taming'],
    },
  },
  'flanking-tactics': {
    strength: {
      "a realm's discoveries weight the lines behind the front":
        A_REALMS_DISCOVERIES_WEIGHT_THE_LINES_BEHIND_THE_FRONT['flanking-tactics'],
    },
  },
  'a-beaten-units-death-cut': {
    fate: {
      "a realm's discoveries spare a beaten unit": A_REALMS_DISCOVERIES_SPARE_A_BEATEN_UNIT['a-beaten-units-death-cut'],
    },
  },
  promotion: { fate: { "a realm's discoveries promote a unit": A_REALMS_DISCOVERIES_PROMOTE_A_UNIT.promotion } },
  'homeward-flight': {
    fate: {
      "a realm's discoveries carry a fallen unit home":
        A_REALMS_DISCOVERIES_CARRY_A_FALLEN_UNIT_HOME['homeward-flight'],
    },
  },
  'battlefield-surgery': {
    fate: {
      "a realm's discoveries drag a hero from the field":
        A_REALMS_DISCOVERIES_DRAG_A_HERO_FROM_THE_FIELD['battlefield-surgery'],
    },
  },
  'a-fighters-aim': {
    personalCombat: {
      "a realm's discoveries steady a fighter's aim": A_REALMS_DISCOVERIES_STEADY_A_FIGHTERS_AIM['a-fighters-aim'],
    },
  },
  'veteran-training': {
    personalCombat: {
      "a realm's discoveries add to a fighter's skills":
        A_REALMS_DISCOVERIES_ADD_TO_A_FIGHTERS_SKILLS['veteran-training'],
    },
  },
  'mithril-craft': {
    personalCombat: {
      "a realm's discoveries strengthen his Mithril": A_REALMS_DISCOVERIES_STRENGTHEN_HIS_MITHRIL['mithril-craft'],
    },
  },
  'a-skills-rise': {
    experience: {
      "a realm's discoveries add to a skill's rise": A_REALMS_DISCOVERIES_ADD_TO_A_SKILLS_RISE['a-skills-rise'],
    },
  },
  'golden-shield': {
    experience: { "a realm's discoveries harden the king": A_REALMS_DISCOVERIES_HARDEN_THE_KING['golden-shield'] },
  },
  spying: {
    orderOutcome: { "a realm's discoveries add to a spy's chance": A_REALMS_DISCOVERIES_ADD_TO_A_SPYS_CHANCE.spying },
  },
  'counter-spying': {
    orderOutcome: {
      "a realm's discoveries cut a rival spy's chance": A_REALMS_DISCOVERIES_CUT_A_RIVAL_SPYS_CHANCE['counter-spying'],
    },
  },
  'spying-on-a-hero': {
    orderOutcome: {
      "a realm's discoveries add to spying on a hero": A_REALMS_DISCOVERIES_ADD_TO_SPYING_ON_A_HERO['spying-on-a-hero'],
    },
  },
  'catching-a-spy': {
    orderOutcome: {
      "a realm's discoveries add to catching a spy": A_REALMS_DISCOVERIES_ADD_TO_CATCHING_A_SPY['catching-a-spy'],
    },
  },
  'disguise-techniques': {
    orderOutcome: {
      "a realm's discoveries keep a spy's success quiet":
        A_REALMS_DISCOVERIES_KEEP_A_SPYS_SUCCESS_QUIET['disguise-techniques'],
    },
  },
  exploring: {
    orderOutcome: { "a realm's discoveries add to exploring": A_REALMS_DISCOVERIES_ADD_TO_EXPLORING.exploring },
  },
  'the-long-hunt': {
    orderOutcome: {
      "a realm's discoveries lengthen the wild hunt": A_REALMS_DISCOVERIES_LENGTHEN_THE_WILD_HUNT['the-long-hunt'],
    },
  },
  'lair-gold': {
    orderOutcome: {
      "a realm's discoveries add to a lair's gold": A_REALMS_DISCOVERIES_ADD_TO_A_LAIRS_GOLD['lair-gold'],
    },
  },
  'lair-items': {
    orderOutcome: {
      "a realm's discoveries add to a lair's item": A_REALMS_DISCOVERIES_ADD_TO_A_LAIRS_ITEM['lair-items'],
    },
  },
  research: {
    orderOutcome: { "a realm's discoveries add to research": A_REALMS_DISCOVERIES_ADD_TO_RESEARCH.research },
  },
  practice: {
    orderOutcome: { "a realm's discoveries add to practice": A_REALMS_DISCOVERIES_ADD_TO_PRACTICE.practice },
  },
  resting: {
    orderOutcome: { "a realm's discoveries add to a rest's heal": A_REALMS_DISCOVERIES_ADD_TO_A_RESTS_HEAL.resting },
  },
  'medical-arts': {
    orderOutcome: {
      "a realm's discoveries heal a resting hero in full":
        A_REALMS_DISCOVERIES_HEAL_A_RESTING_HERO_IN_FULL['medical-arts'],
    },
  },
  'watching-for-lurkers': {
    visibility: {
      "a realm's discoveries spot a hero lurking in its province":
        A_REALMS_DISCOVERIES_SPOT_A_HERO_LURKING_IN_ITS_PROVINCE['watching-for-lurkers'],
    },
  },
  'ancient-lore': {
    visibility: {
      "a realm's discoveries map the provinces around an explorer":
        A_REALMS_DISCOVERIES_MAP_THE_PROVINCES_AROUND_AN_EXPLORER['ancient-lore'],
    },
  },
  'diplomatic-protocols': {
    orderValidity: {
      "a realm's discoveries waive the hiring ban": A_REALMS_DISCOVERIES_WAIVE_THE_HIRING_BAN['diplomatic-protocols'],
    },
  },
  consecrations: {
    orderOutcome: {
      "a realm's discoveries add to the consecrations a crown may hold":
        A_REALMS_DISCOVERIES_ADD_TO_THE_CONSECRATIONS_A_CROWN_MAY_HOLD.consecrations,
    },
  },
  'muster-rolls': {
    orderOutcome: {
      "a realm's discoveries raise a call to arms' quality":
        A_REALMS_DISCOVERIES_RAISE_A_CALL_TO_ARMS_QUALITY['muster-rolls'],
    },
  },
  'corpse-carters': {
    orderOutcome: {
      "a realm's discoveries cut the corpse-carters' cost":
        A_REALMS_DISCOVERIES_CUT_THE_CORPSE_CARTERS_COST['corpse-carters'],
    },
  },
  mercenaries: {
    orderOutcome: {
      "a realm's discoveries cut a company's price": A_REALMS_DISCOVERIES_CUT_A_COMPANYS_PRICE.mercenaries,
    },
  },
  'recruit-cost': {
    orderOutcome: {
      "a realm's discoveries cut a unit's price": A_REALMS_DISCOVERIES_CUT_A_UNITS_PRICE['recruit-cost'],
    },
  },
  'recruit-quality': {
    orderOutcome: {
      "a realm's discoveries raise a recruit's quality":
        A_REALMS_DISCOVERIES_RAISE_A_RECRUITS_QUALITY['recruit-quality'],
    },
  },
  'rites-of-plenty': {
    orderOutcome: { "a realm's discoveries add to a Bless": A_REALMS_DISCOVERIES_ADD_TO_A_BLESS['rites-of-plenty'] },
  },
  'blood-harvest': {
    fate: {
      "a realm's discoveries add to a blood harvest": A_REALMS_DISCOVERIES_ADD_TO_A_BLOOD_HARVEST['blood-harvest'],
    },
  },
  'lingering-terror': {
    fate: {
      "a realm's discoveries add to the terror a victory leaves":
        A_REALMS_DISCOVERIES_ADD_TO_THE_TERROR_A_VICTORY_LEAVES['lingering-terror'],
    },
  },
  plunder: {
    fate: {
      "a realm's discoveries add to a conquest's plunder": A_REALMS_DISCOVERIES_ADD_TO_A_CONQUESTS_PLUNDER.plunder,
    },
  },
  marching: {
    movementCost: { "a realm's discoveries add to a march": A_REALMS_DISCOVERIES_ADD_TO_A_MARCH.marching },
  },
  'converging-columns': {
    movementCost: {
      "a realm's discoveries help converging columns unite":
        A_REALMS_DISCOVERIES_HELP_CONVERGING_COLUMNS_UNITE['converging-columns'],
    },
  },
  'province-tax': {
    turnEnd: {
      "a realm's discoveries add to a province's tax": A_REALMS_DISCOVERIES_ADD_TO_A_PROVINCES_TAX['province-tax'],
    },
  },
  'taxation-records': {
    turnEnd: {
      "a realm's discoveries add to the realm's tax": A_REALMS_DISCOVERIES_ADD_TO_THE_REALMS_TAX['taxation-records'],
    },
  },
  interest: { turnEnd: { "a realm's discoveries earn interest": A_REALMS_DISCOVERIES_EARN_INTEREST.interest } },
  'a-units-wage-cut': {
    turnEnd: { "a realm's discoveries cut a unit's wage": A_REALMS_DISCOVERIES_CUT_A_UNITS_WAGE['a-units-wage-cut'] },
  },
  'a-heros-wage-cut': {
    turnEnd: { "a realm's discoveries cut a hero's wage": A_REALMS_DISCOVERIES_CUT_A_HEROS_WAGE['a-heros-wage-cut'] },
  },
  'a-heros-wage-ceiling': {
    turnEnd: {
      "a realm's discoveries cap a hero's wage": A_REALMS_DISCOVERIES_CAP_A_HEROS_WAGE['a-heros-wage-ceiling'],
    },
  },
  'maximum-hp': {
    aHerosStanding: { "a realm's discoveries add to maximum HP": A_REALMS_DISCOVERIES_ADD_TO_MAXIMUM_HP['maximum-hp'] },
  },
  'healing-the-wounded': {
    turnEnd: { "a realm's discoveries heal the wounded": A_REALMS_DISCOVERIES_HEAL_THE_WOUNDED['healing-the-wounded'] },
  },
  'grave-keeping': {
    turnEnd: { "a realm's discoveries keep the graves": A_REALMS_DISCOVERIES_KEEP_THE_GRAVES['grave-keeping'] },
  },
  'war-academy': {
    turnEnd: {
      "a realm's discoveries promote the capital's armies":
        A_REALMS_DISCOVERIES_PROMOTE_THE_CAPITALS_ARMIES['war-academy'],
    },
  },
  'informant-network': {
    visibility: {
      "a realm's discoveries name an unseen captain": A_REALMS_DISCOVERIES_NAME_AN_UNSEEN_CAPTAIN['informant-network'],
    },
  },
  'arcane-observatory': {
    visibility: {
      "a realm's discoveries chart a province": A_REALMS_DISCOVERIES_CHART_A_PROVINCE['arcane-observatory'],
    },
  },
  'herbal-lore': {
    turnStart: {
      "a realm's discoveries dress a fighter's wounds": A_REALMS_DISCOVERIES_DRESS_A_FIGHTERS_WOUNDS['herbal-lore'],
    },
  },
} satisfies Record<DiscoveryEffectSlug, DiscoveryEffectEntry>;

/** Each stage's order: the entries with an effect at the stage, each once. Each stage holds one kind today, so its
 *  order is which kind it reads; within a kind, the effects run in the order the realm holds them. */
export const THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES = {
  strength: {
    "a realm's discoveries strengthen a unit": ['unit-strength'],
    "a realm's discoveries add to a siege": ['siegecraft'],
    "a realm's discoveries fortify its own ground": ['own-ground'],
    "a realm's discoveries stir a side's fanaticism": ['fanaticism'],
    "a realm's discoveries let a beast follow without its Druid": ['dragon-taming'],
    "a realm's discoveries weight the lines behind the front": ['flanking-tactics'],
  },
  aHerosStanding: {
    "a realm's discoveries add to a caster's chance": ['casting'],
    "a realm's discoveries add to maximum HP": ['maximum-hp'],
  },
  fate: {
    "a realm's discoveries spare a beaten unit": ['a-beaten-units-death-cut'],
    "a realm's discoveries promote a unit": ['promotion'],
    "a realm's discoveries carry a fallen unit home": ['homeward-flight'],
    "a realm's discoveries drag a hero from the field": ['battlefield-surgery'],
    "a realm's discoveries add to a blood harvest": ['blood-harvest'],
    "a realm's discoveries add to the terror a victory leaves": ['lingering-terror'],
    "a realm's discoveries add to a conquest's plunder": ['plunder'],
  },
  movementCost: {
    "a realm's discoveries add to a march": ['marching'],
    "a realm's discoveries help converging columns unite": ['converging-columns'],
  },
  personalCombat: {
    "a realm's discoveries steady a fighter's aim": ['a-fighters-aim'],
    "a realm's discoveries add to a fighter's skills": ['veteran-training'],
    "a realm's discoveries strengthen his Mithril": ['mithril-craft'],
  },
  experience: {
    "a realm's discoveries add to a skill's rise": ['a-skills-rise'],
    "a realm's discoveries harden the king": ['golden-shield'],
  },
  orderOutcome: {
    "a realm's discoveries add to a spy's chance": ['spying'],
    "a realm's discoveries cut a rival spy's chance": ['counter-spying'],
    "a realm's discoveries add to spying on a hero": ['spying-on-a-hero'],
    "a realm's discoveries add to catching a spy": ['catching-a-spy'],
    "a realm's discoveries keep a spy's success quiet": ['disguise-techniques'],
    "a realm's discoveries add to exploring": ['exploring'],
    "a realm's discoveries lengthen the wild hunt": ['the-long-hunt'],
    "a realm's discoveries add to a lair's gold": ['lair-gold'],
    "a realm's discoveries add to a lair's item": ['lair-items'],
    "a realm's discoveries add to research": ['research'],
    "a realm's discoveries add to practice": ['practice'],
    "a realm's discoveries add to a rest's heal": ['resting'],
    "a realm's discoveries heal a resting hero in full": ['medical-arts'],
    "a realm's discoveries add to the consecrations a crown may hold": ['consecrations'],
    "a realm's discoveries raise a call to arms' quality": ['muster-rolls'],
    "a realm's discoveries cut the corpse-carters' cost": ['corpse-carters'],
    "a realm's discoveries cut a company's price": ['mercenaries'],
    "a realm's discoveries cut a unit's price": ['recruit-cost'],
    "a realm's discoveries raise a recruit's quality": ['recruit-quality'],
    "a realm's discoveries add to a Bless": ['rites-of-plenty'],
  },
  orderValidity: { "a realm's discoveries waive the hiring ban": ['diplomatic-protocols'] },
  visibility: {
    "a realm's discoveries spot a hero lurking in its province": ['watching-for-lurkers'],
    "a realm's discoveries map the provinces around an explorer": ['ancient-lore'],
    "a realm's discoveries name an unseen captain": ['informant-network'],
    "a realm's discoveries chart a province": ['arcane-observatory'],
  },
  turnStart: { "a realm's discoveries dress a fighter's wounds": ['herbal-lore'] },
  turnEnd: {
    "a realm's discoveries add to a province's tax": ['province-tax'],
    "a realm's discoveries add to the realm's tax": ['taxation-records'],
    "a realm's discoveries earn interest": ['interest'],
    "a realm's discoveries cut a unit's wage": ['a-units-wage-cut'],
    "a realm's discoveries cut a hero's wage": ['a-heros-wage-cut'],
    "a realm's discoveries cap a hero's wage": ['a-heros-wage-ceiling'],
    "a realm's discoveries heal the wounded": ['healing-the-wounded'],
    "a realm's discoveries keep the graves": ['grave-keeping'],
    "a realm's discoveries promote the capital's armies": ['war-academy'],
  },
} as const satisfies {
  readonly [H in HookPointName]?: {
    readonly [S in keyof TheStagesOfEachHookPoint[H]]?: readonly DiscoveryEffectSlug[];
  };
};

const ROWS: Readonly<Record<DiscoveryEffectSlug, AKindOfDiscoveryEffect>> = DISCOVERY_EFFECTS_THE_REGISTRY_HOLDS;
const ENTRIES: Readonly<Record<DiscoveryEffectSlug, DiscoveryEffectEntry>> = THE_REGISTRY_OF_DISCOVERY_EFFECTS;
const STRENGTH = THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES.strength;
const FATE = THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES.fate;
const PERSONAL_COMBAT = THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES.personalCombat;
const EXPERIENCE = THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES.experience;
const ORDER_OUTCOME = THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES.orderOutcome;
const VISIBILITY = THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES.visibility;
const MOVEMENT_COST = THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES.movementCost;
const TURN_END = THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES.turnEnd;

/** The effects of the kind of each entry of a stage's order the realm holds, with the entry's slug. */
function theEffectsOfTheStageARealmHolds(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  theOrder: readonly DiscoveryEffectSlug[],
): (readonly [slug: DiscoveryEffectSlug, theEffect: TheEffectOfADiscovery])[] {
  return theOrder.flatMap((slug) =>
    theEffectsOfAKindARealmHolds(theRealm, ROWS[slug].kind).map((theEffect) => [slug, theEffect] as const),
  );
}

/** The runner of "strength: a realm's discoveries strengthen a unit" (discUnitMult, which armStr asks): the product of
 *  the factors of the realm's effects that reach the unit, capped at the kind's ceiling (×1.30), however many it
 *  stacks (Toby, 2026-09-21). */
export function theFactorARealmsDiscoveriesStrengthenAUnitBy(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: AUnitARealmsDiscoveriesMayStrengthen,
): number {
  let m = 1;
  for (const [slug, e] of theEffectsOfTheStageARealmHolds(
    theRealm,
    STRENGTH["a realm's discoveries strengthen a unit"],
  )) {
    const factor = ENTRIES[slug].strength?.["a realm's discoveries strengthen a unit"]?.(e, facts) ?? null;
    if (factor !== null) m *= factor;
  }
  return Math.min(DISCOVERY_EFFECTS_THE_REGISTRY_HOLDS['unit-strength'].numbers.theCeiling.value, m);
}

/** The runner of "strength: a realm's discoveries add to a siege" (both battles, before the defenders' bonus is worn
 *  down): what the attacker's realm's effects take off it, added. */
export function whatARealmsDiscoveriesAddToASiege(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: TheAttackersUnitsAtASiege,
): number {
  let s = 0;
  for (const [slug, e] of theEffectsOfTheStageARealmHolds(theRealm, STRENGTH["a realm's discoveries add to a siege"])) {
    const added = ENTRIES[slug].strength?.["a realm's discoveries add to a siege"]?.(e, facts) ?? null;
    if (added !== null) s += added;
  }
  return s;
}

/** The runner of "strength: a realm's discoveries fortify its own ground" (both battles, the defending realm's): the
 *  shares its effects add, summed, capped at the kind's ceiling (+30%). */
export function theShareARealmsDiscoveriesFortifyItsOwnGroundBy(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: TheGroundARealmDefends,
): number {
  let s = 0;
  const theStage = STRENGTH["a realm's discoveries fortify its own ground"];
  for (const [slug, e] of theEffectsOfTheStageARealmHolds(theRealm, theStage)) {
    const added = ENTRIES[slug].strength?.["a realm's discoveries fortify its own ground"]?.(e, facts) ?? null;
    if (added !== null) s += added;
  }
  return Math.min(DISCOVERY_EFFECTS_THE_REGISTRY_HOLDS['own-ground'].numbers.theCeiling.value, s);
}

/** The runner of "strength: a realm's discoveries stir a side's fanaticism" (both battles, before each side's
 *  fanaticism roll): the shares the side's realm's effects add to its chance, summed. */
export function whatARealmsDiscoveriesAddToASidesFanaticism(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: ASideAsItsFanaticismIsRolled,
): number {
  let s = 0;
  const theStage = STRENGTH["a realm's discoveries stir a side's fanaticism"];
  for (const [slug, e] of theEffectsOfTheStageARealmHolds(theRealm, theStage)) {
    const added = ENTRIES[slug].strength?.["a realm's discoveries stir a side's fanaticism"]?.(e, facts) ?? null;
    if (added !== null) s += added;
  }
  return s;
}

/** The runner of "strength: a realm's discoveries let a beast follow without its Druid" (dragonTamed): whether any
 *  effect of the commander's realm lets the unit follow him without his Druid. */
export function aRealmsDiscoveriesLetABeastFollowWithoutItsDruid(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: ABeastACommanderLeads,
): boolean {
  const theStage = STRENGTH["a realm's discoveries let a beast follow without its Druid"];
  return theEffectsOfTheStageARealmHolds(theRealm, theStage).some(
    ([slug, e]) =>
      ENTRIES[slug].strength?.["a realm's discoveries let a beast follow without its Druid"]?.(e, facts) ?? false,
  );
}

/** The runner of "strength: a realm's discoveries add to the whole army" (both battles, beside the realm's other
 *  bonuses): what discoveries add to the whole army's strength. No entry holds the stage (sd02 War Drums is now an
 *  ordinary `unitStr` effect, armStr's, under the ×1.30 ceiling), so it adds nothing: discoveryArmyBonus's body, moved
 *  as it was (Parked "Three dead paths in discoveries.ts"). */
export function whatARealmsDiscoveriesAddToTheWholeArmy(): number {
  return 0;
}

/** The runner of "aHerosStanding: a realm's discoveries add to a caster's chance" (applyPreBattleMagic and the hero's
 *  cast in combatVsNPC, P1-19aa; castChanceFor, which the Cast Spell order and the report ask, and pcCastCombatSpell,
 *  P1-19ac): the percentage points the caster's realm's effects add, summed. */
export function whatARealmsDiscoveriesAddToACastersChance(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: ACastARealmsDiscoveriesMayHelp,
): number {
  let s = 0;
  const theStage =
    THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES.aHerosStanding["a realm's discoveries add to a caster's chance"];
  for (const [slug, e] of theEffectsOfTheStageARealmHolds(theRealm, theStage)) {
    const added = ENTRIES[slug].aHerosStanding?.["a realm's discoveries add to a caster's chance"]?.(e, facts) ?? null;
    if (added !== null) s += added;
  }
  return s;
}

/** The runner of "strength: a realm's discoveries weight the lines behind the front", for a side (both battles, and
 *  commandScore): whether the side's realm holds an effect of the stage, so the grid weights its lines behind the front
 *  (flankLineMults: the weights, below). */
export function doARealmsDiscoveriesWeightTheLinesBehindTheFront(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
): boolean {
  return (
    theEffectsOfTheStageARealmHolds(theRealm, STRENGTH["a realm's discoveries weight the lines behind the front"])
      .length > 0
  );
}

/** The runner of "strength: a realm's discoveries weight the lines behind the front", for the weights (flankLineMults,
 *  which the grid asks for a side whose lines are weighted): the weights the first discovery of the content (the table
 *  of the discoveries by id, in its order) with an effect of the stage gives, as its row writes them, or none. */
export function theWeightsADiscoveryGivesTheLinesBehindTheFront(): readonly number[] | undefined {
  for (const slug of STRENGTH["a realm's discoveries weight the lines behind the front"]) {
    for (const d of Object.values(DISC_BY_ID)) {
      const e = [d.effect, d.effect2].find((effect) => effect?.kind === ROWS[slug].kind);
      if (e) return ENTRIES[slug].strength?.["a realm's discoveries weight the lines behind the front"]?.(e);
    }
  }
  return undefined;
}

/** The runner of "fate: a realm's discoveries spare a beaten unit" (discDeathMult, which both battles ask): the
 *  multiplier left on the unit's chance of death, 1 less the shares the realm's effects cut, added, never below the
 *  kind's floor (a quarter). */
export function theMultiplierARealmsDiscoveriesLeaveOnABeatenUnitsDeath(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: ABeatenUnitARealmsDiscoveriesMaySpare,
): number {
  let r = 0;
  for (const [slug, e] of theEffectsOfTheStageARealmHolds(
    theRealm,
    FATE["a realm's discoveries spare a beaten unit"],
  )) {
    const cut = ENTRIES[slug].fate?.["a realm's discoveries spare a beaten unit"]?.(e, facts) ?? null;
    if (cut !== null) r += cut;
  }
  return Math.max(DISCOVERY_EFFECTS_THE_REGISTRY_HOLDS['a-beaten-units-death-cut'].numbers.theFloor.value, 1 - r);
}

/** The runner of "fate: a realm's discoveries promote a unit" (discPromo, which both battles ask): the shares the
 *  realm's effects add to the unit's chance of promotion, added. */
export function whatARealmsDiscoveriesAddToAUnitsPromotion(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: AUnitARealmsDiscoveriesMayPromote,
): number {
  let r = 0;
  for (const [slug, e] of theEffectsOfTheStageARealmHolds(theRealm, FATE["a realm's discoveries promote a unit"])) {
    const added = ENTRIES[slug].fate?.["a realm's discoveries promote a unit"]?.(e, facts) ?? null;
    if (added !== null) r += added;
  }
  return r;
}

/** The runner of "fate: a realm's discoveries carry a fallen unit home" (recordBattleGraves, before it rolls): the
 *  points the realm's effects add to a fallen Elven unit's chance of slipping away home, added. */
export function whatARealmsDiscoveriesAddToAFallenUnitsFlightHome(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
): number {
  let s = 0;
  const theStage = FATE["a realm's discoveries carry a fallen unit home"];
  for (const [slug, e] of theEffectsOfTheStageARealmHolds(theRealm, theStage)) {
    s += ENTRIES[slug].fate?.["a realm's discoveries carry a fallen unit home"]?.(e) ?? 0;
  }
  return s;
}

/** The runner of "fate: a realm's discoveries drag a hero from the field" (handleHeroDeath, before it rolls): the
 *  chance the first of the realm's effects gives a slain hero, as a share, or nothing if the realm holds none. */
export function theChanceARealmsDiscoveriesDragAHeroFromTheField(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
): number | null {
  const theStage = FATE["a realm's discoveries drag a hero from the field"];
  const [first] = theEffectsOfTheStageARealmHolds(theRealm, theStage);
  if (!first) return null;
  const [slug, e] = first;
  return ENTRIES[slug].fate?.["a realm's discoveries drag a hero from the field"]?.(e) ?? null;
}

/** The runner of "personalCombat: a realm's discoveries steady a fighter's aim" (pcHitChance and pcArrowHitChance): the
 *  percentage points the fighter's realm's effects add to his chance to hit the foe, added. */
export function whatARealmsDiscoveriesAddToAFightersAim(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: AFoeARealmsDiscoveriesSteadyAFightersAimAt,
): number {
  let s = 0;
  const theStage = PERSONAL_COMBAT["a realm's discoveries steady a fighter's aim"];
  for (const [slug, e] of theEffectsOfTheStageARealmHolds(theRealm, theStage)) {
    const added = ENTRIES[slug].personalCombat?.["a realm's discoveries steady a fighter's aim"]?.(e, facts) ?? null;
    if (added !== null) s += added;
  }
  return s;
}

/** The runner of "personalCombat: a realm's discoveries add to a fighter's skills" (pcCharCombatant's Melee and
 *  Archery, and extraSkillBonuses for the hero's card): the levels the first of the realm's effects adds, or 0 if the
 *  realm holds none (one such discovery adds its levels once, as the check of its id did). */
export function theLevelsARealmsDiscoveriesAddToAFightersSkills(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
): number {
  const [first] = theEffectsOfTheStageARealmHolds(
    theRealm,
    PERSONAL_COMBAT["a realm's discoveries add to a fighter's skills"],
  );
  if (!first) return 0;
  const [slug, e] = first;
  return ENTRIES[slug].personalCombat?.["a realm's discoveries add to a fighter's skills"]?.(e) ?? 0;
}

/** The runner of "personalCombat: a realm's discoveries strengthen his Mithril" (pcCharCombatant, after the suit's
 *  own): the damage the hero's realm's effects add to what his Mithril turns aside, added. */
export function whatARealmsDiscoveriesAddToAFightersMithril(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
): number {
  let s = 0;
  const theStage = PERSONAL_COMBAT["a realm's discoveries strengthen his Mithril"];
  for (const [slug, e] of theEffectsOfTheStageARealmHolds(theRealm, theStage)) {
    s += ENTRIES[slug].personalCombat?.["a realm's discoveries strengthen his Mithril"]?.(e) ?? 0;
  }
  return s;
}

/** The runner of "experience: a realm's discoveries add to a skill's rise" (trySkillGain, before it rolls): the shares
 *  the hero's realm's effects add to the skill's chance to rise, added. */
export function whatARealmsDiscoveriesAddToASkillsRise(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: ASkillARealmsDiscoveriesMayRaise,
): number {
  let s = 0;
  const theStage = EXPERIENCE["a realm's discoveries add to a skill's rise"];
  for (const [slug, e] of theEffectsOfTheStageARealmHolds(theRealm, theStage)) {
    const added = ENTRIES[slug].experience?.["a realm's discoveries add to a skill's rise"]?.(e, facts) ?? null;
    if (added !== null) s += added;
  }
  return s;
}

/** The runner of "experience: a realm's discoveries harden the king" (awardHpRoll): the factor the first of the king's
 *  realm's effects multiplies his hardening by, or nothing if the realm holds none. */
export function theFactorARealmsDiscoveriesHardenTheKingBy(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
): number | null {
  const [first] = theEffectsOfTheStageARealmHolds(theRealm, EXPERIENCE["a realm's discoveries harden the king"]);
  if (!first) return null;
  const [slug, e] = first;
  return ENTRIES[slug].experience?.["a realm's discoveries harden the king"]?.(e) ?? null;
}

/** The numbers the effects of a stage the realm holds give (nothing where an effect's filters don't hold), added in the
 *  order the effects are found (P1-19ad's runners that add). */
function addTheNumbersOfTheStage(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  theOrder: readonly DiscoveryEffectSlug[],
  theNumberOf: (slug: DiscoveryEffectSlug, theEffect: TheEffectOfADiscovery) => number | null | undefined,
): number {
  let s = 0;
  for (const [slug, e] of theEffectsOfTheStageARealmHolds(theRealm, theOrder)) {
    const added = theNumberOf(slug, e) ?? null;
    if (added !== null) s += added;
  }
  return s;
}

/** The runner of "orderOutcome: a realm's discoveries add to a spy's chance" (resolveSpyOrder, both his rolls; the
 *  report's odds, with THE_REPORTS_ODDS_NAME_NO_PROVINCE): the shares the spy's realm's effects add. */
export function whatARealmsDiscoveriesAddToASpysChance(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: WhereASpyActsAsARealmsDiscoveriesReadIt,
): number {
  const theStage = "a realm's discoveries add to a spy's chance";
  return addTheNumbersOfTheStage(theRealm, ORDER_OUTCOME[theStage], (slug, e) =>
    ENTRIES[slug].orderOutcome?.[theStage]?.(e, facts),
  );
}

/** The runner of "orderOutcome: a realm's discoveries cut a rival spy's chance" (resolveSpyOrder, in a province of
 *  another realm's): the shares the effects of the realm that holds it take off. */
export function whatARealmsDiscoveriesCutARivalSpysChanceBy(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: WhereASpyActsAsARealmsDiscoveriesReadIt,
): number {
  const theStage = "a realm's discoveries cut a rival spy's chance";
  return addTheNumbersOfTheStage(theRealm, ORDER_OUTCOME[theStage], (slug, e) =>
    ENTRIES[slug].orderOutcome?.[theStage]?.(e, facts),
  );
}

/** The runner of "orderOutcome: a realm's discoveries add to spying on a hero" (resolveSpyOrder): the shares the spy's
 *  realm's effects add to his chance to read a hero beside him. */
export function whatARealmsDiscoveriesAddToSpyingOnAHero(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: WhereASpyActsAsARealmsDiscoveriesReadIt,
): number {
  const theStage = "a realm's discoveries add to spying on a hero";
  return addTheNumbersOfTheStage(theRealm, ORDER_OUTCOME[theStage], (slug, e) =>
    ENTRIES[slug].orderOutcome?.[theStage]?.(e, facts),
  );
}

/** The runner of "orderOutcome: a realm's discoveries add to catching a spy" (resolveSpyOrder): the points the effects
 *  of the realm of the hero spied on add to his chance to catch the spy. */
export function whatARealmsDiscoveriesAddToCatchingASpy(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: WhereASpyActsAsARealmsDiscoveriesReadIt,
): number {
  const theStage = "a realm's discoveries add to catching a spy";
  return addTheNumbersOfTheStage(theRealm, ORDER_OUTCOME[theStage], (slug, e) =>
    ENTRIES[slug].orderOutcome?.[theStage]?.(e, facts),
  );
}

/** The runner of "orderOutcome: a realm's discoveries keep a spy's success quiet" (resolveSpyOrder, which rolls): the
 *  first of the spy's realm's effects' chance, or nothing if the realm holds none. */
export function theChanceARealmsDiscoveriesKeepASpysSuccessQuiet(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
): number | null {
  const theStage = "a realm's discoveries keep a spy's success quiet";
  const [first] = theEffectsOfTheStageARealmHolds(theRealm, ORDER_OUTCOME[theStage]);
  if (!first) return null;
  const [slug, e] = first;
  return ENTRIES[slug].orderOutcome?.[theStage]?.(e) ?? null;
}

/** The runner of "orderOutcome: a realm's discoveries add to exploring" (resolveExploreOrder, and discExploreMult, which
 *  the report ships): the product of the factors of the explorer's realm's effects that reach the ground. */
export function theFactorARealmsDiscoveriesMultiplyExploringBy(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: TheGroundAHeroWorks,
): number {
  const theStage = "a realm's discoveries add to exploring";
  let m = 1;
  for (const [slug, e] of theEffectsOfTheStageARealmHolds(theRealm, ORDER_OUTCOME[theStage])) {
    const factor = ENTRIES[slug].orderOutcome?.[theStage]?.(e, facts) ?? null;
    if (factor !== null) m *= factor;
  }
  return m;
}

/** The runner of "orderOutcome: a realm's discoveries lengthen the wild hunt" (resolvePerformRiteOrder): the turns the
 *  hero's realm's effects add to the bound beasts' service. */
export function theTurnsARealmsDiscoveriesLengthenTheWildHuntBy(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
): number {
  const theStage = "a realm's discoveries lengthen the wild hunt";
  return addTheNumbersOfTheStage(theRealm, ORDER_OUTCOME[theStage], (slug, e) =>
    ENTRIES[slug].orderOutcome?.[theStage]?.(e),
  );
}

/** The runner of "orderOutcome: a realm's discoveries add to a lair's gold" (resolveSearchLairOrder): the shares the
 *  hero's realm's effects add to the hoard's gold. */
export function whatARealmsDiscoveriesAddToALairsGold(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: ALairsHoardARealmsDiscoveriesMayEnrich,
): number {
  const theStage = "a realm's discoveries add to a lair's gold";
  return addTheNumbersOfTheStage(theRealm, ORDER_OUTCOME[theStage], (slug, e) =>
    ENTRIES[slug].orderOutcome?.[theStage]?.(e, facts),
  );
}

/** The runner of "orderOutcome: a realm's discoveries add to a lair's item" (resolveSearchLairOrder, which rolls): the
 *  chance of an extra find the hero's realm's effects add. */
export function whatARealmsDiscoveriesAddToALairsItemChance(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: TheGroundAHeroWorks,
): number {
  const theStage = "a realm's discoveries add to a lair's item";
  return addTheNumbersOfTheStage(theRealm, ORDER_OUTCOME[theStage], (slug, e) =>
    ENTRIES[slug].orderOutcome?.[theStage]?.(e, facts),
  );
}

/** The runner of "orderOutcome: a realm's discoveries add to research" (resolveResearchOrder; the report's odds, with
 *  THE_REPORTS_RESEARCH_NAMES_NO_FIELD): the points the scholar's realm's effects add. */
export function whatARealmsDiscoveriesAddToResearch(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: AResearchARealmsDiscoveriesMayHelp,
): number {
  const theStage = "a realm's discoveries add to research";
  return addTheNumbersOfTheStage(theRealm, ORDER_OUTCOME[theStage], (slug, e) =>
    ENTRIES[slug].orderOutcome?.[theStage]?.(e, facts),
  );
}

/** The runner of "orderOutcome: a realm's discoveries add to practice" (resolvePracticeSkillOrder; the report's odds,
 *  with THE_REPORTS_PRACTICE_NAMES_NO_SKILL): the shares the hero's realm's effects add for the skill. */
export function whatARealmsDiscoveriesAddToPractice(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: ASkillARealmsDiscoveriesMayDrill,
): number {
  const theStage = "a realm's discoveries add to practice";
  return addTheNumbersOfTheStage(theRealm, ORDER_OUTCOME[theStage], (slug, e) =>
    ENTRIES[slug].orderOutcome?.[theStage]?.(e, facts),
  );
}

/** The second runner of "orderOutcome: a realm's discoveries add to practice" (the report's odds, skill by skill): for
 *  each of the realm's effects, in the order they are found, each skill it lists with the share it adds for that skill
 *  (an effect for every skill lists none). The report adds them up per skill. */
export function theSharesARealmsDiscoveriesAddToPracticeSkillBySkill(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
): (readonly [theSkill: string, theShare: number])[] {
  const theStage = "a realm's discoveries add to practice";
  const out: (readonly [theSkill: string, theShare: number])[] = [];
  for (const [slug, e] of theEffectsOfTheStageARealmHolds(theRealm, ORDER_OUTCOME[theStage])) {
    for (const theSkill of e.skills ?? []) {
      const added = ENTRIES[slug].orderOutcome?.[theStage]?.(e, { theSkill }) ?? null;
      if (added !== null) out.push([theSkill, added]);
    }
  }
  return out;
}

/** The runner of "orderOutcome: a realm's discoveries add to a rest's heal" (resolveRestOrder, before the items'): the
 *  hit points the resting hero's realm's effects add. */
export function whatARealmsDiscoveriesAddToARestsHeal(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: WhereAHeroRestsAsARealmsDiscoveriesReadIt,
): number {
  const theStage = "a realm's discoveries add to a rest's heal";
  return addTheNumbersOfTheStage(theRealm, ORDER_OUTCOME[theStage], (slug, e) =>
    ENTRIES[slug].orderOutcome?.[theStage]?.(e, facts),
  );
}

/** The runner of "orderOutcome: a realm's discoveries heal a resting hero in full" (resolveRestOrder): whether any of
 *  the resting hero's realm's effects restores every hit point he lacks. */
export function aRealmsDiscoveriesHealARestingHeroInFull(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
): boolean {
  const theStage = "a realm's discoveries heal a resting hero in full";
  return theEffectsOfTheStageARealmHolds(theRealm, ORDER_OUTCOME[theStage]).some(
    ([slug, e]) => ENTRIES[slug].orderOutcome?.[theStage]?.(e) ?? false,
  );
}

/** The runner of "visibility: a realm's discoveries spot a hero lurking in its province" (spotEnemyInOwnedProvince):
 *  the points the watching realm's effects add to its chance. */
export function whatARealmsDiscoveriesAddToSpottingALurker(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: AProvinceARealmsDiscoveriesWatch,
): number {
  const theStage = "a realm's discoveries spot a hero lurking in its province";
  return addTheNumbersOfTheStage(theRealm, VISIBILITY[theStage], (slug, e) =>
    ENTRIES[slug].visibility?.[theStage]?.(e, facts),
  );
}

/** The runner of "visibility: a realm's discoveries map the provinces around an explorer" (resolveExploreOrder): the
 *  share of each province around him the first of the explorer's realm's effects maps, or nothing if the realm holds
 *  none. */
export function theShareARealmsDiscoveriesMapAroundAnExplorer(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
): number | null {
  const theStage = "a realm's discoveries map the provinces around an explorer";
  const [first] = theEffectsOfTheStageARealmHolds(theRealm, VISIBILITY[theStage]);
  if (!first) return null;
  const [slug, e] = first;
  return ENTRIES[slug].visibility?.[theStage]?.(e) ?? null;
}

/** The runner of "orderValidity: a realm's discoveries waive the hiring ban" (resolveHireHeroOrder, resolveBrokerOrder,
 *  the Charm, and playerView's wages for the report): whether any of the hiring realm's effects waives it. */
export function doARealmsDiscoveriesWaiveTheHiringBan(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
): boolean {
  const theStage = "a realm's discoveries waive the hiring ban";
  return theEffectsOfTheStageARealmHolds(
    theRealm,
    THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES.orderValidity[theStage],
  ).some(([slug, e]) => ENTRIES[slug].orderValidity?.[theStage]?.(e) ?? false);
}

/** The runner of "orderOutcome: a realm's discoveries add to the consecrations a crown may hold"
 *  (resolveConsecrateOrder, beside the consecrator's White skill): the provinces the crown's effects add. */
export function whatARealmsDiscoveriesAddToTheConsecrationsACrownMayHold(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: AConsecrationARealmsDiscoveriesMayAllow,
): number {
  const theStage = "a realm's discoveries add to the consecrations a crown may hold";
  return addTheNumbersOfTheStage(theRealm, ORDER_OUTCOME[theStage], (slug, e) =>
    ENTRIES[slug].orderOutcome?.[theStage]?.(e, facts),
  );
}

/** The runner of "orderOutcome: a realm's discoveries raise a call to arms' quality" (resolveCallToArmsOrder, which
 *  rolls each chance in turn): each of the realm's effects' quality and chance, in the order they are found. */
export function theQualitiesARealmsDiscoveriesMayRaiseACallToArmsAt(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
): AQualityACallToArmsMayRaise[] {
  const theStage = "a realm's discoveries raise a call to arms' quality";
  const out: AQualityACallToArmsMayRaise[] = [];
  for (const [slug, e] of theEffectsOfTheStageARealmHolds(theRealm, ORDER_OUTCOME[theStage])) {
    const theQuality = ENTRIES[slug].orderOutcome?.[theStage]?.(e);
    if (theQuality) out.push(theQuality);
  }
  return out;
}

/** The runner of "orderOutcome: a realm's discoveries cut the corpse-carters' cost" (resolveHarvestTheFieldOrder, and
 *  the report's price): the gold the realm's effects add to it, added (a cut is less than 0). */
export function whatARealmsDiscoveriesAddToTheCorpseCartersCost(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
): number {
  const theStage = "a realm's discoveries cut the corpse-carters' cost";
  return addTheNumbersOfTheStage(theRealm, ORDER_OUTCOME[theStage], (slug, e) =>
    ENTRIES[slug].orderOutcome?.[theStage]?.(e),
  );
}

/** The runner of "orderOutcome: a realm's discoveries cut a company's price" (resolveRecruitArmiesOrder's bands, and
 *  the report's price): the gold the hiring realm's effects add to the band's price, added (a cut is less than 0). */
export function whatARealmsDiscoveriesAddToAMercenaryBandsPrice(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: AUnitARealmRaises,
): number {
  const theStage = "a realm's discoveries cut a company's price";
  return addTheNumbersOfTheStage(theRealm, ORDER_OUTCOME[theStage], (slug, e) =>
    ENTRIES[slug].orderOutcome?.[theStage]?.(e, facts),
  );
}

/** The runner of "orderOutcome: a realm's discoveries cut a unit's price" (realmRecruitCost, which the order and the
 *  report's prices ask): the price each of the recruiting realm's effects leaves, from `theBasePrice`, in the order
 *  they are found. */
export function theUnitsPriceARealmsDiscoveriesLeave(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: AUnitARealmRaises,
  theBasePrice: number,
): number {
  const theStage = "a realm's discoveries cut a unit's price";
  let c = theBasePrice;
  for (const [slug, e] of theEffectsOfTheStageARealmHolds(theRealm, ORDER_OUTCOME[theStage])) {
    const after = ENTRIES[slug].orderOutcome?.[theStage]?.(e, { ...facts, thePriceSoFar: c }) ?? null;
    if (after !== null) c = after;
  }
  return c;
}

/** The runner of "orderOutcome: a realm's discoveries raise a recruit's quality" (discRecruitQChance, which
 *  resolveRecruitArmiesOrder asks before it rolls): the shares the recruiting realm's effects add. */
export function whatARealmsDiscoveriesAddToARecruitsChanceOfAHigherGrade(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: AUnitARealmRaises,
): number {
  const theStage = "a realm's discoveries raise a recruit's quality";
  return addTheNumbersOfTheStage(theRealm, ORDER_OUTCOME[theStage], (slug, e) =>
    ENTRIES[slug].orderOutcome?.[theStage]?.(e, facts),
  );
}

/** The runner of "orderOutcome: a realm's discoveries add to a Bless" (workBlessProvince): the shares of the province's
 *  tax the caster's realm's effects add. */
export function whatARealmsDiscoveriesAddToABless(theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined): number {
  const theStage = "a realm's discoveries add to a Bless";
  return addTheNumbersOfTheStage(theRealm, ORDER_OUTCOME[theStage], (slug, e) =>
    ENTRIES[slug].orderOutcome?.[theStage]?.(e),
  );
}

/** The runner of "fate: a realm's discoveries add to a blood harvest" (bloodHarvest): the gold the Pagan victor's
 *  realm's effects add for each enemy unit destroyed, added. */
export function whatARealmsDiscoveriesAddToABloodHarvest(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
): number {
  const theStage = "a realm's discoveries add to a blood harvest";
  return addTheNumbersOfTheStage(theRealm, FATE[theStage], (slug, e) => ENTRIES[slug].fate?.[theStage]?.(e));
}

/** The runner of "fate: a realm's discoveries add to the terror a victory leaves" (spreadTerror, its stacks and its
 *  line): the shares of strength the Evil victor's realm's effects add to each terror stack's toll, added. */
export function whatARealmsDiscoveriesAddToTheTerrorAVictoryLeaves(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
): number {
  const theStage = "a realm's discoveries add to the terror a victory leaves";
  return addTheNumbersOfTheStage(theRealm, FATE[theStage], (slug, e) => ENTRIES[slug].fate?.[theStage]?.(e));
}

/** The runner of "fate: a realm's discoveries add to a conquest's plunder" (applyEvilConquest): the shares of the
 *  province's tax the Evil conqueror's realm's effects add to the plunder, added. */
export function whatARealmsDiscoveriesAddToAConquestsPlunder(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: AProvinceARealmsDiscoveriesMayPlunder,
): number {
  const theStage = "a realm's discoveries add to a conquest's plunder";
  return addTheNumbersOfTheStage(theRealm, FATE[theStage], (slug, e) => ENTRIES[slug].fate?.[theStage]?.(e, facts));
}

/** The runner of "movementCost: a realm's discoveries add to a march" (computeMovePoolMax, garrisonMoveRate and the
 *  report's speeds, each for a land unit of Speed 1–2 after its own guards): the move points the realm's effects add
 *  to the unit, added. */
export function whatARealmsDiscoveriesAddToAMarch(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: AUnitARealmsDiscoveriesMaySpeed,
): number {
  const theStage = "a realm's discoveries add to a march";
  return addTheNumbersOfTheStage(theRealm, MOVEMENT_COST[theStage], (slug, e) =>
    ENTRIES[slug].movementCost?.[theStage]?.(e, facts),
  );
}

/** The runner of "movementCost: a realm's discoveries help converging columns unite" (resolveMoveOrder, both its unify
 *  rolls): the points the hero's realm's effects add to the chance a converging column unites with his force, added. */
export function whatARealmsDiscoveriesAddToConvergingColumnsChanceToUnite(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
): number {
  const theStage = "a realm's discoveries help converging columns unite";
  return addTheNumbersOfTheStage(theRealm, MOVEMENT_COST[theStage], (slug, e) =>
    ENTRIES[slug].movementCost?.[theStage]?.(e),
  );
}

/** The runner of "turnEnd: a realm's discoveries add to a province's tax" (discTaxAdd, which Early Winter's collection
 *  and the views ask): the gold the realm's effects add to the province, each capped at `theCeiling` (5% of the realm's
 *  base tax) and its row's own `max` if it writes one (or, given no ceiling, at its `max` alone), what each has paid so
 *  far kept in `theAccount`. */
export function whatARealmsDiscoveriesAddToAProvincesTax(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: AProvinceARealmsDiscoveriesMayTax,
  theAccount: WhatEachCappedEffectHasPaid,
  theCeiling: number | null | undefined,
): number {
  const theStage = "a realm's discoveries add to a province's tax";
  let add = 0;
  for (const [slug, e] of theEffectsOfTheStageARealmHolds(theRealm, TURN_END[theStage])) {
    const pays = ENTRIES[slug].turnEnd?.[theStage]?.(e, facts) ?? null;
    if (pays === null) continue;
    let b = pays.theGold;
    const lim = theCeiling != null ? Math.min(theCeiling, pays.itsOwnCeiling ?? theCeiling) : pays.itsOwnCeiling;
    if (lim != null) {
      const u = Number(theAccount.get(e)) || 0;
      b = Math.max(0, Math.min(b, lim - u));
      theAccount.set(e, u + b);
    }
    add += b;
  }
  return add;
}

/** The runner of "turnEnd: a realm's discoveries add to the realm's tax", for a realm (Early Winter and the report,
 *  before they ask taxRecordsGold): whether it holds an effect of the stage. */
export function doARealmsDiscoveriesAddToTheRealmsTax(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
): boolean {
  return theEffectsOfTheStageARealmHolds(theRealm, TURN_END["a realm's discoveries add to the realm's tax"]).length > 0;
}

/** The runner of "turnEnd: a realm's discoveries add to the realm's tax", for the gold (taxRecordsGold, which is asked
 *  with no realm): the gold the first discovery of the content (the table of the discoveries by id, in its order) with
 *  an effect of the stage adds; if none has one, what an effect with no numbers adds (its fallbacks, as discParam's
 *  were for a row it couldn't find). */
export function theGoldADiscoveryAddsToTheRealmsTax(facts: TheIncomeTaxationRecordsAddsTo): number {
  const theStage = "a realm's discoveries add to the realm's tax";
  const [slug] = TURN_END[theStage];
  const theEffect: TheEffectOfADiscovery =
    Object.values(DISC_BY_ID)
      .flatMap((d) => [d.effect, d.effect2])
      .find((e) => e?.kind === ROWS[slug].kind) ?? {};
  return ENTRIES[slug].turnEnd?.[theStage]?.(theEffect, facts) ?? 0;
}

/** The runner of "turnEnd: a realm's discoveries earn interest" (Early Winter's collection, and the report's
 *  forecast): the interest the realm's effects earn on its treasury, each under the ceiling, added. */
export function whatARealmsDiscoveriesEarnInInterest(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: ATreasuryARealmsDiscoveriesMayEarnInterestOn,
): number {
  const theStage = "a realm's discoveries earn interest";
  return addTheNumbersOfTheStage(theRealm, TURN_END[theStage], (slug, e) =>
    ENTRIES[slug].turnEnd?.[theStage]?.(e, facts),
  );
}

/** A wage after each cut in turn (the effects of a realm's discoveries that cut a unit's or a hero's wage): a cut never
 *  takes the wage below 1g, and is capped at `theCeiling` (or, given none, its row's own `max`), what each effect has
 *  saved so far kept in `theAccount`. */
function aWageAfterEachCut(
  theCuts: readonly (readonly [theEffect: TheEffectOfADiscovery, theCut: WhatAnEffectPaysAndItsOwnCeiling | null])[],
  theWage: number,
  theAccount: WhatEachCappedEffectHasPaid,
  theCeiling: number | null | undefined,
): number {
  let out = theWage;
  for (const [e, theCut] of theCuts) {
    if (theCut === null) continue;
    let cut = Math.min(theCut.theGold, out - 1);
    if (cut <= 0) continue;
    const lim = theCeiling ?? theCut.itsOwnCeiling;
    if (lim != null) {
      const u = Number(theAccount.get(e)) || 0;
      cut = Math.min(cut, lim - u);
      if (cut <= 0) continue;
      theAccount.set(e, u + cut);
    }
    out -= cut;
  }
  return out;
}

/** The runner of "turnEnd: a realm's discoveries cut a unit's wage" (discUpkeepWage, which Early Winter and the report
 *  ask, after its guards): the wage `theWage` the realm's effects that reach the unit leave, each cut in turn. */
export function theWageARealmsDiscoveriesLeaveAUnit(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: AUnitWhoseWageARealmsDiscoveriesMayCut,
  theWage: number,
  theAccount: WhatEachCappedEffectHasPaid,
  theCeiling: number | null | undefined,
): number {
  const theStage = "a realm's discoveries cut a unit's wage";
  const theCuts = theEffectsOfTheStageARealmHolds(theRealm, TURN_END[theStage]).map(
    ([slug, e]) => [e, ENTRIES[slug].turnEnd?.[theStage]?.(e, facts) ?? null] as const,
  );
  return aWageAfterEachCut(theCuts, theWage, theAccount, theCeiling);
}

/** The runner of "turnEnd: a realm's discoveries cut a hero's wage" (discHeroWage, before the ceilings): the wage
 *  `theWage` the realm's effects for the hero's alignment leave, each cut in turn. */
export function theWageARealmsDiscoveriesCutsLeaveAHero(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: AHeroWhoseWageARealmsDiscoveriesMayCut,
  theWage: number,
  theAccount: WhatEachCappedEffectHasPaid,
  theCeiling: number | null | undefined,
): number {
  const theStage = "a realm's discoveries cut a hero's wage";
  const theCuts = theEffectsOfTheStageARealmHolds(theRealm, TURN_END[theStage]).map(
    ([slug, e]) => [e, ENTRIES[slug].turnEnd?.[theStage]?.(e, facts) ?? null] as const,
  );
  return aWageAfterEachCut(theCuts, theWage, theAccount, theCeiling);
}

/** The runner of "turnEnd: a realm's discoveries cap a hero's wage" (discHeroWage, after the cuts): the wage `theWage`
 *  the realm's ceilings leave, each in turn cutting a wage above it down to it (never below 1g), the cut capped at
 *  `theCeiling` (or, given none, its row's own `max`), what each has saved so far kept in `theAccount`. */
export function theWageARealmsDiscoveriesCeilingsLeaveAHero(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  theWage: number,
  theAccount: WhatEachCappedEffectHasPaid,
  theCeiling: number | null | undefined,
): number {
  const theStage = "a realm's discoveries cap a hero's wage";
  let w = theWage;
  for (const [slug, e] of theEffectsOfTheStageARealmHolds(theRealm, TURN_END[theStage])) {
    const theCap = ENTRIES[slug].turnEnd?.[theStage]?.(e) ?? null;
    if (theCap === null || w <= theCap.theWagesCeiling) continue;
    let cut = w - Math.max(1, theCap.theWagesCeiling);
    const lim = theCeiling ?? theCap.itsOwnCeiling;
    if (lim != null) {
      const u = Number(theAccount.get(e)) || 0;
      cut = Math.min(cut, lim - u);
      if (cut <= 0) continue;
      theAccount.set(e, u + cut);
    }
    w -= cut;
  }
  return w;
}

/** The runner of "aHerosStanding: a realm's discoveries add to maximum HP" (discMaxHpFor, which a hero's maximum
 *  asks): the hit points the hero's realm's effects add, added. */
export function whatARealmsDiscoveriesAddToAHerosMaximumHp(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: AHeroWhoseMaximumHpARealmsDiscoveriesMayRaise,
): number {
  const theStage = "a realm's discoveries add to maximum HP";
  return addTheNumbersOfTheStage(
    theRealm,
    THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES.aHerosStanding[theStage],
    (slug, e) => ENTRIES[slug].aHerosStanding?.[theStage]?.(e, facts),
  );
}

/** The runner of "turnEnd: a realm's discoveries heal the wounded", for a realm (the new turn's gardens, before they
 *  look at its heroes): whether it holds an effect of the stage. */
export function doARealmsDiscoveriesHealTheWounded(theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined): boolean {
  return theEffectsOfTheStageARealmHolds(theRealm, TURN_END["a realm's discoveries heal the wounded"]).length > 0;
}

/** The runner of "turnEnd: a realm's discoveries heal the wounded", for a wounded hero (the new turn's gardens): the hit
 *  points the realm's effects heal him, added. */
export function theHpARealmsDiscoveriesHealAWoundedHeroBy(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  facts: AHeroARealmsDiscoveriesMayHeal,
): number {
  const theStage = "a realm's discoveries heal the wounded";
  return addTheNumbersOfTheStage(theRealm, TURN_END[theStage], (slug, e) =>
    ENTRIES[slug].turnEnd?.[theStage]?.(e, facts),
  );
}

/** The runner of "turnEnd: a realm's discoveries keep the graves" (the new turn's graves, on a province the realm
 *  holds): the lowest of `theRate` (the ground's own) and the rates the realm's effects write. */
export function theRateARealmsDiscoveriesLetTheGravesRotAt(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
  theRate: number,
): number {
  const theStage = "a realm's discoveries keep the graves";
  let r = theRate;
  for (const [slug, e] of theEffectsOfTheStageARealmHolds(theRealm, TURN_END[theStage])) {
    r = Math.min(r, ENTRIES[slug].turnEnd?.[theStage]?.(e) ?? theRate);
  }
  return r;
}

/** The runner of "turnEnd: a realm's discoveries promote the capital's armies" (the new turn's War Academy, which
 *  rolls each company): the first of the realm's effects' chance, or nothing if the realm holds none. */
export function theChanceARealmsDiscoveriesPromoteTheCapitalsArmies(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
): number | null {
  const theStage = "a realm's discoveries promote the capital's armies";
  const [first] = theEffectsOfTheStageARealmHolds(theRealm, TURN_END[theStage]);
  if (!first) return null;
  const [slug, e] = first;
  return ENTRIES[slug].turnEnd?.[theStage]?.(e) ?? null;
}

/** The runner of "turnStart: a realm's discoveries dress a fighter's wounds" (startPhaseHealingSnapshotsAndStalledBattles,
 *  for a hero his last fight wounded): the share of those wounds the first of his realm's effects dresses, or nothing if
 *  the realm holds none. */
export function theShareARealmsDiscoveriesDressAFightersWoundsBy(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
): number | null {
  const theStage = "a realm's discoveries dress a fighter's wounds";
  const [first] = theEffectsOfTheStageARealmHolds(
    theRealm,
    THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES.turnStart[theStage],
  );
  if (!first) return null;
  const [slug, e] = first;
  return ENTRIES[slug].turnStart?.[theStage]?.(e) ?? null;
}

/** The runner of "visibility: a realm's discoveries name an unseen captain" (the new turn's informants): whether any of
 *  the realm's effects does. */
export function doARealmsDiscoveriesNameAnUnseenCaptain(
  theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined,
): boolean {
  const theStage = "a realm's discoveries name an unseen captain";
  return theEffectsOfTheStageARealmHolds(theRealm, VISIBILITY[theStage]).some(
    ([slug, e]) => ENTRIES[slug].visibility?.[theStage]?.(e) ?? false,
  );
}

/** The runner of "visibility: a realm's discoveries chart a province" (the new turn's Observatory): whether any of the
 *  realm's effects does. */
export function doARealmsDiscoveriesChartAProvince(theRealm: ARealmAsTheDiscoveriesReadIt | null | undefined): boolean {
  const theStage = "a realm's discoveries chart a province";
  return theEffectsOfTheStageARealmHolds(theRealm, VISIBILITY[theStage]).some(
    ([slug, e]) => ENTRIES[slug].visibility?.[theStage]?.(e) ?? false,
  );
}
