// The registry of the hero orders' resolvers (B-06, T7, the rules pulled out: Run 3b's hero orders, row B-06ao). A kind
// of order is one row in src/content/ (THE_HERO_ORDERS: its key, the names the turn reads it by, its tier and the
// fields the checks before it read) and one entry here, keyed by the row's key, naming the function that carries it out
// (src/engine/orders/, rows j1 to j8) with what processOrder hands it. processOrder
// (order-dispatch-the-checks-before-a-hero-order-and-the-switch.ts) runs the checks before an order, then hands the
// order to its kind's entry, as its switch did: each entry is the switch's case as it was, the same function with the
// same arguments in the same order. Every kind has its entry but Forced March's, which processOrder makes a Move
// before it hands the order on: a row with no entry fails to compile (TS1360), and so does an entry with no row
// (TS2353), and a Forced March handed on as itself (TS7053)
// (tests/static/an-order-kind-with-no-resolver-in-the-hero-orders-registry-fails-to-compile.test.ts). The entries
// call the resolvers when the order runs, so a test that stands one in on its module reaches it.
import { THE_HERO_ORDERS } from '../../content/the-hero-orders-their-keys-the-names-the-turn-reads-them-by-and-their-tiers.ts';
import type { OrderKind } from '../rules-on-plain-values/the-kind-of-order-each-name-of-an-order-reads-as.ts';
import { resolveMoveOrder } from './move-order-marches-voyages-and-battles-on-arrival.ts';
import {
  resolveChartTheUnknownOrder,
  resolveDiscoverLostRuinOrder,
  resolveExploreOrder,
  resolveHuntingRumoursOrder,
  resolveSearchLairOrder,
} from './explore-and-search-orders-maps-lairs-rites-and-rumours.ts';
import {
  resolveHireHeroOrder,
  resolveRecruitArmiesOrder,
} from './recruit-and-hire-orders-companies-mercenaries-and-heroes.ts';
import {
  resolveAwakenGroveOrder,
  resolveGrandDesignOrder,
  resolveRemovedAwakenTheWildAndCallFromThePitOrders,
  resolveWildCallingOrder,
} from './realm-works-orders-consecration-muster-broker-the-wild-and-grand-design.ts';
import { resolveConsecrateOrder } from './alignment/consecrate-a-divine-kings-order-to-sanctify-a-province-of-his-realm.ts';
import { resolveCallToArmsOrder } from './alignment/call-to-arms-a-good-kings-order-to-muster-a-company-from-his-folk.ts';
import { resolveBrokerOrder } from './alignment/broker-a-neutral-kings-order-to-hire-a-hero-or-buy-word-from-afar.ts';
import { resolveHarvestTheFieldOrder } from './alignment/harvest-the-field-an-undead-realms-order-to-raise-a-grave-as-a-skeletal-company.ts';
import { resolvePerformRiteOrder } from './alignment/perform-rite-a-pagan-heros-rite-of-the-wild-hunt-or-blood-offering.ts';
import {
  resolvePracticeSkillOrder,
  resolveResearchBreakthroughOrder,
  resolveResearchOrder,
  resolveRestOrder,
} from './research-and-practice-orders-discoveries-skill-drills-and-rest.ts';
import {
  resolveEquipItemsOrder,
  resolveSendItemOrder,
  resolveUseItemOrder,
} from './item-orders-equip-use-and-send-magic-items.ts';
import {
  resolveDisbandArmyOrder,
  resolveLeaveOrTransferArmyOrder,
  resolvePickUpArmyOrder,
  resolveReleaseHeroOrder,
} from './army-orders-hand-over-garrison-disband-and-pick-up-companies-and-release-a-hero.ts';
import {
  resolveAssassinateOrder,
  resolveGrandHeistOrder,
  resolveSabotageOrder,
  resolveSpyOrder,
  resolveStealOrder,
  resolveVanishOrder,
} from './espionage-orders-spy-steal-sabotage-grand-heist-assassinate-and-vanish.ts';
import { resolveCastSpellOrder } from './cast-spell-order-white-psychic-illusory-elemental-and-necromancy-spells.ts';
import {
  resolveDefendOrder,
  resolveEncounterCharacterOrder,
} from './encounter-and-defend-orders-chasing-a-hero-down-and-keeping-watch.ts';
import {
  resolveBlockadeOrder,
  resolveChallengeOrder,
  resolveFeignedRetreatOrder,
  resolveGrandStratagemOrder,
  resolveLightningAdvanceOrder,
  resolveRaidTheCoastOrder,
  resolveRainOfArrowsOrder,
  resolveRampageOrder,
  resolveSnipersMarkOrder,
} from './war-mastery-orders-challenge-rampage-volleys-tactics-blockade-and-coast-raids.ts';
import type { Character, Province, Realm } from '../../schemas/saved-game-state.ts';
import type { TurnContext, TurnOrder } from '../turn/context.ts';

/** A hero's order as the dispatch reads it: the turn's order, with the marks the engine and a bot's plan write on it
 *  (the hero whose battle he joined, a bot's least share of his hit points for a Search, the rumour's band a bot's
 *  Search waits for, and the lower band he takes at full health). */
export type AnOrderAsTheDispatchReadsIt = TurnOrder & {
  readonly _unifiedWith?: number | null | undefined;
  readonly _botMinHp?: number | undefined;
  readonly _botIfRumour?: number | undefined;
  readonly _botIfRumourLow?: number | undefined;
  readonly _botIfRumourLowHp?: number | undefined;
};

/** The kinds of order the registry holds a resolver for: every kind but Forced March's, a Move by the time an order is
 *  handed on (processOrder's remap, which keeps the mastery's once-a-turn charge). */
export type AKindOfOrderTheRegistryResolves = Exclude<OrderKind, typeof THE_HERO_ORDERS.forced_march.key>;

/** What processOrder hands an order's resolver, as its switch's cases read them: the turn's context, the hero, his
 *  order, the phase, a Forced March's slip, the order's target and extra (empty for none), the province he stands in,
 *  his realm (a wanderer's: none), a spell item's cast (or none) and the kind the order is resolved as. */
export interface WhatProcessOrderHandsAnOrdersResolver {
  readonly turnContext: TurnContext;
  readonly c: Character;
  readonly o: AnOrderAsTheDispatchReadsIt;
  readonly ph: number;
  readonly _fmSlip: boolean;
  readonly target: string;
  readonly extra: string;
  readonly prov: Province | undefined;
  readonly player: Realm | undefined;
  readonly _itemCast: { item: string; spell: string | undefined } | null;
  readonly action: AKindOfOrderTheRegistryResolves;
}

/** An order's resolver: it carries the order out with what processOrder hands it. */
export type AnOrdersResolver = (handed: WhatProcessOrderHandsAnOrdersResolver) => void;

/** The province a hero stands in, as the orders' typed functions take it: every living hero stands in a province of
 *  the map (the matrix's invariant "armies in real provinces"), so there is always one; for none, a TypeError, as the
 *  first read of it there would throw. */
function theProvinceAnOrderTakes(prov: Province | undefined): Province {
  if (!prov) throw new TypeError("Cannot read properties of undefined (reading 'id')");
  return prov;
}

/** Awaken the Wild's and Call from the Pit's resolver: one, as the switch's two cases shared one body. */
const theRemovedAwakenTheWildAndCallFromThePitOrders: AnOrdersResolver = ({ turnContext, c, action }) => {
  resolveRemovedAwakenTheWildAndCallFromThePitOrders(turnContext, c, action);
};

/** One entry for each kind of order but Forced March's, in the order of the switch's cases it was (a row with no entry
 *  fails to compile, TS1360; an entry with no row, TS2353). */
export const THE_REGISTRY_OF_THE_HERO_ORDERS_RESOLVERS = {
  move: ({ turnContext, c, ph, _fmSlip, target, prov, player }) => {
    resolveMoveOrder(turnContext, c, ph, _fmSlip, target, prov, player);
  },
  explore: ({ turnContext, c, prov }) => {
    resolveExploreOrder(turnContext, c, prov);
  },
  rite: ({ turnContext, c, ph, target, extra, prov, player }) => {
    resolvePerformRiteOrder(turnContext, c, ph, target, extra, prov, player);
  },
  hunt_rumours: ({ turnContext, c, target, prov, player }) => {
    resolveHuntingRumoursOrder(turnContext, c, target, prov, player);
  },

  search: ({ turnContext, c, ph, target, prov, player }) => {
    resolveSearchLairOrder(turnContext, c, ph, target, prov, player);
  },
  recruit: ({ turnContext, c, ph, target, extra, prov, player }) => {
    resolveRecruitArmiesOrder(turnContext, c, ph, target, extra, prov, player);
  },
  hire: ({ turnContext, c, ph, target, prov, player }) => {
    resolveHireHeroOrder(turnContext, c, ph, target, prov, player);
  },
  spy: ({ turnContext, c, target, prov }) => {
    resolveSpyOrder(turnContext, c, target, prov);
  },
  consecrate: ({ turnContext, c, prov, player }) => {
    resolveConsecrateOrder(turnContext, c, prov, player);
  },
  call_to_arms: ({ turnContext, c, target, player }) => {
    resolveCallToArmsOrder(turnContext, c, target, player);
  },
  broker: ({ turnContext, c, ph, target, player }) => {
    resolveBrokerOrder(turnContext, c, ph, target, player);
  },
  awaken_wild: theRemovedAwakenTheWildAndCallFromThePitOrders,
  call_pit: theRemovedAwakenTheWildAndCallFromThePitOrders,
  harvest_field: ({ turnContext, c, ph, prov, player }) => {
    resolveHarvestTheFieldOrder(turnContext, c, ph, prov, player);
  },
  research: ({ turnContext, c, ph, target, player }) => {
    resolveResearchOrder(turnContext, c, ph, target, player);
  },
  practice: ({ turnContext, c, ph, target }) => {
    resolvePracticeSkillOrder(turnContext, c, ph, target);
  },
  equip_items: ({ turnContext, c, target }) => {
    resolveEquipItemsOrder(turnContext, c, target);
  },
  use_item: ({ turnContext, c, target, prov }) => {
    resolveUseItemOrder(turnContext, c, target, prov);
  },
  rest: ({ turnContext, c, prov }) => {
    resolveRestOrder(turnContext, c, prov);
  },
  give_item: ({ turnContext, c, ph, target, extra }) => {
    resolveSendItemOrder(turnContext, c, ph, target, extra);
  },
  leave_army: ({ turnContext, c, ph, target, extra, prov }) => {
    resolveLeaveOrTransferArmyOrder(turnContext, c, ph, target, extra, prov);
  },
  release: ({ turnContext, c, ph, prov, player }) => {
    resolveReleaseHeroOrder(turnContext, c, ph, prov, player);
  },
  disband_army: ({ turnContext, c, target, prov }) => {
    resolveDisbandArmyOrder(turnContext, c, target, prov);
  },

  pickup_army: ({ turnContext, c, target, prov }) => {
    resolvePickUpArmyOrder(turnContext, c, target, prov);
  },
  encounter: ({ turnContext, c, ph, target, prov }) => {
    resolveEncounterCharacterOrder(turnContext, c, ph, target, theProvinceAnOrderTakes(prov));
  },

  steal: ({ turnContext, c, target, prov, player }) => {
    resolveStealOrder(turnContext, c, target, prov, player);
  },

  defend: ({ turnContext, c, o, ph, prov }) => {
    resolveDefendOrder(turnContext, c, o, ph, theProvinceAnOrderTakes(prov));
  },

  // Pursue has no entry: it is folded into Encounter Character (the encounter's entry above), and the turn reads any
  // saved Pursue order as an Encounter (its row's readsAs), so in-flight games resolve cleanly.

  cast_spell: ({ turnContext, c, o, ph, target, extra, prov, player, _itemCast }) => {
    resolveCastSpellOrder(turnContext, c, o, ph, target, extra, theProvinceAnOrderTakes(prov), player, _itemCast);
  },

  // ══ L7/L9 MASTERY ORDERS (batch 2a) ════
  sabotage: ({ turnContext, c, target }) => {
    resolveSabotageOrder(turnContext, c, target);
  },
  grand_heist: ({ turnContext, c, ph, prov }) => {
    resolveGrandHeistOrder(turnContext, c, ph, prov);
  },
  awaken_grove: ({ turnContext, c, ph, prov }) => {
    resolveAwakenGroveOrder(turnContext, c, ph, prov);
  },
  chart_unknown: ({ turnContext, c, target, prov }) => {
    resolveChartTheUnknownOrder(turnContext, c, target, prov);
  },
  discover_ruin: ({ turnContext, c, target, prov }) => {
    resolveDiscoverLostRuinOrder(turnContext, c, target, prov);
  },

  // ══ L7/L9 MASTERY ORDERS (batch 2b) ════
  blockade: ({ turnContext, c, target }) => {
    resolveBlockadeOrder(turnContext, c, target);
  },
  research_breakthrough: ({ turnContext, c }) => {
    resolveResearchBreakthroughOrder(turnContext, c);
  },
  assassinate: ({ turnContext, c, target, prov }) => {
    resolveAssassinateOrder(turnContext, c, target, prov);
  },
  vanish: ({ turnContext, c, prov }) => {
    resolveVanishOrder(turnContext, c, prov);
  },

  // ══ L7/L9 MASTERY ORDERS (batch 2c-i — immediate strikes) ════
  challenge: ({ turnContext, c, target, prov }) => {
    resolveChallengeOrder(turnContext, c, target, theProvinceAnOrderTakes(prov));
  },
  rampage: ({ turnContext, c, target, prov }) => {
    resolveRampageOrder(turnContext, c, target, theProvinceAnOrderTakes(prov));
  },
  rain_of_arrows: ({ turnContext, c, target, prov }) => {
    resolveRainOfArrowsOrder(turnContext, c, target, theProvinceAnOrderTakes(prov));
  },
  snipers_mark: ({ turnContext, c, target, prov }) => {
    resolveSnipersMarkOrder(turnContext, c, target, theProvinceAnOrderTakes(prov));
  },

  // ══ L7/L9 MASTERY ORDERS (batch 2c-ii — battle-strength flags) ════
  feigned_retreat: ({ turnContext, c, prov }) => {
    resolveFeignedRetreatOrder(turnContext, c, theProvinceAnOrderTakes(prov));
  },
  grand_stratagem: ({ turnContext, c, prov }) => {
    resolveGrandStratagemOrder(turnContext, c, theProvinceAnOrderTakes(prov));
  },
  lightning_advance: ({ turnContext, c, prov }) => {
    resolveLightningAdvanceOrder(turnContext, c, theProvinceAnOrderTakes(prov));
  },
  raid_coast: ({ turnContext, c, prov }) => {
    resolveRaidTheCoastOrder(turnContext, c, theProvinceAnOrderTakes(prov));
  },
  // ══ L7/L9 MASTERY ORDERS (batch 2c-iii — specials) ════
  wild_calling: ({ turnContext, c, ph, prov }) => {
    resolveWildCallingOrder(turnContext, c, ph, prov);
  },
  grand_design: ({ turnContext, c, prov }) => {
    resolveGrandDesignOrder(turnContext, c, prov);
  },
} satisfies Record<AKindOfOrderTheRegistryResolves, AnOrdersResolver>;
