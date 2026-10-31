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
import type {
  ABeastACommanderLeads,
  ACastARealmsDiscoveriesMayHelp,
  ASideAsItsFanaticismIsRolled,
  AUnitARealmsDiscoveriesMayStrengthen,
  HookPointName,
  TheAttackersUnitsAtASiege,
  TheGroundARealmDefends,
  TheStagesOfEachHookPoint,
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
  },
  aHerosStanding: { "a realm's discoveries add to a caster's chance": ['casting'] },
} as const satisfies {
  readonly [H in HookPointName]?: {
    readonly [S in keyof TheStagesOfEachHookPoint[H]]?: readonly DiscoveryEffectSlug[];
  };
};

const ROWS: Readonly<Record<DiscoveryEffectSlug, AKindOfDiscoveryEffect>> = DISCOVERY_EFFECTS_THE_REGISTRY_HOLDS;
const ENTRIES: Readonly<Record<DiscoveryEffectSlug, DiscoveryEffectEntry>> = THE_REGISTRY_OF_DISCOVERY_EFFECTS;
const STRENGTH = THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES.strength;

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
 *  cast in combatVsNPC): the percentage points the caster's realm's effects add, summed. */
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
