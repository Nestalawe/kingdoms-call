// The hero orders (B-06, T7, the rules pulled out: Run 3b's hero orders): one row a kind of order a hero is given,
// keyed by the kind the turn reads his order as, in the order the turn's names for the orders run: its key, the names
// the turn reads it by (an order's action in lower case, as the order form or a bot writes it) and the tier it acts in
// within a phase. One more row, Pursue, is a name a saved order holds that reads as another kind (Encounter). The
// engine's kinds of order (OrderKind) are these rows' keys, Pursue's aside, and the turn's names for the orders
// (PHASE_ACTION_MAP) and its reading of a blank or unknown order (normaliseAction) are built from them
// (src/engine/rules-on-plain-values/the-kind-of-order-each-name-of-an-order-reads-as.ts). The five creed orders' rows
// are built from their own (THE_ALIGNMENT_ORDERS: their key, name in lower case and other names); the mastery orders'
// rows (THE_MASTERY_ORDERS, src/content/mastery-orders-their-keys-names-skills-and-levels.ts) join these by key: each
// mastery's row here reads its key there, and the engine checks each of theirs is a kind of order (MASTERY_ORDER_KEYS,
// src/engine/army-tables.ts).
// The tier: 0 an order that stays put, which settles first, while every hero is where the phase found him; 1 a Move
// or an Encounter (a chase), and the battles they start; 2 a Defend, last. A Forced March acts at 0, with the orders
// that stay put (answer 133: its fix comes with KD-065's after T7). The tiers are written here only, for now:
// theTierAnOrderActsIn (src/engine/rules-on-plain-values/the-order-the-heroes-act-in-a-phase-and-who-must-act-first.ts)
// gives the same until it reads them.
import { THE_ALIGNMENT_ORDERS } from './alignment-abilities-their-keys-names-numbers-and-words.ts';
import { THE_MASTERY_ORDERS } from './mastery-orders-their-keys-names-skills-and-levels.ts';

/** A row: one kind of order, the names the turn reads it by and the tier it acts in. */
interface AHeroOrder {
  /** The kind the turn reads the order as (an order's action, as the bots write it). */
  readonly key: string;
  /** Every name the turn reads the order by, in lower case, in the order the turn's names for the orders hold them. */
  readonly theNamesTheTurnReads: readonly string[];
  /** The tier it acts in within a phase: 0 it stays put, 1 a Move or an Encounter, 2 a Defend. */
  readonly tier: 0 | 1 | 2;
  /** The kind a saved name reads as, where it is no kind of its own (Pursue's row only). */
  readonly readsAs?: string;
}

/** A creed order's row, built from its alignment row: its key, then its name in lower case and its other names. */
function theRowOfACreedOrder<const Key extends string>(order: {
  readonly key: Key;
  readonly name: string;
  readonly theOtherNamesTheTurnReads: readonly string[];
}) {
  return {
    key: order.key,
    theNamesTheTurnReads: [order.key, order.name.toLowerCase(), ...order.theOtherNamesTheTurnReads],
    tier: 0,
  } as const;
}

/** The hero orders, by kind, in the order the turn's names for the orders run. */
export const THE_HERO_ORDERS = {
  move: { key: 'move', theNamesTheTurnReads: ['move'], tier: 1 },
  explore: { key: 'explore', theNamesTheTurnReads: ['explore', 'explore province'], tier: 0 },
  // 'search feature': the name orders written before the Lair's rename hold
  search: { key: 'search', theNamesTheTurnReads: ['search', 'search lair', 'search feature'], tier: 0 },
  // 'hunt_rumours': the key, read since 2026-09-17
  hunt_rumours: {
    key: 'hunt_rumours',
    theNamesTheTurnReads: ['hunting rumours', 'hunt rumours', 'hunt_rumours'],
    tier: 0,
  },
  recruit: { key: 'recruit', theNamesTheTurnReads: ['recruit', 'recruit armies'], tier: 0 },
  hire: { key: 'hire', theNamesTheTurnReads: ['hire', 'hire hero'], tier: 0 },
  release: { key: 'release', theNamesTheTurnReads: ['release', 'release hero', 'dismiss hero'], tier: 0 },
  leave_army: {
    key: 'leave_army',
    theNamesTheTurnReads: ['leave_army', 'leave/transfer army', 'leave army', 'transfer army'],
    tier: 0,
  },
  disband_army: { key: 'disband_army', theNamesTheTurnReads: ['disband_army', 'disband army', 'disband'], tier: 0 },
  pickup_army: { key: 'pickup_army', theNamesTheTurnReads: ['pickup_army', 'pick up army', 'pick_up_army'], tier: 0 },
  // Give Item is renamed Send Item: the old names stay read
  give_item: {
    key: 'give_item',
    theNamesTheTurnReads: ['give_item', 'give item', 'give magic item', 'send_item', 'send item', 'send magic item'],
    tier: 0,
  },
  cast_spell: { key: 'cast_spell', theNamesTheTurnReads: ['cast_spell', 'cast spell'], tier: 0 },
  spy: { key: 'spy', theNamesTheTurnReads: ['spy'], tier: 0 },
  practice: { key: 'practice', theNamesTheTurnReads: ['practice', 'practice skill', 'practice ability'], tier: 0 },
  research: { key: 'research', theNamesTheTurnReads: ['research', 'research discovery'], tier: 0 },
  defend: { key: 'defend', theNamesTheTurnReads: ['defend'], tier: 2 },
  rest: { key: 'rest', theNamesTheTurnReads: ['rest', 'rest & heal', 'rest and heal'], tier: 0 },
  consecrate: theRowOfACreedOrder(THE_ALIGNMENT_ORDERS.consecrate),
  call_to_arms: theRowOfACreedOrder(THE_ALIGNMENT_ORDERS['call-to-arms']),
  broker: theRowOfACreedOrder(THE_ALIGNMENT_ORDERS.broker),
  harvest_field: theRowOfACreedOrder(THE_ALIGNMENT_ORDERS['harvest-the-field']),
  rite: theRowOfACreedOrder(THE_ALIGNMENT_ORDERS['perform-rite']),
  // Awaken the Wild and Call from the Pit: removed orders (2026-10-12) whose names the turn still reads
  awaken_wild: { key: 'awaken_wild', theNamesTheTurnReads: ['awaken the wild', 'awaken_wild'], tier: 0 },
  call_pit: { key: 'call_pit', theNamesTheTurnReads: ['call from the pit', 'call_pit'], tier: 0 },
  encounter: { key: 'encounter', theNamesTheTurnReads: ['encounter', 'encounter character'], tier: 1 },
  steal: { key: 'steal', theNamesTheTurnReads: ['steal', 'steal item', 'steal from character'], tier: 0 },
  use_item: { key: 'use_item', theNamesTheTurnReads: ['use_item', 'use item', 'use magic item'], tier: 0 },
  equip_items: {
    key: 'equip_items',
    theNamesTheTurnReads: ['equip_items', 'equip items', 'equip', 'equip item'],
    tier: 0,
  },
  // Pursue is folded into Encounter: a saved name the turn still reads, as an Encounter (its tier is the one
  // theTierAnOrderActsIn gives 'pursue', which no order's kind is: KD-406)
  pursue: { key: 'pursue', theNamesTheTurnReads: ['pursue', 'pursue character'], tier: 1, readsAs: 'encounter' },
  // the mastery orders: each row's key is its mastery row's (THE_MASTERY_ORDERS: its name, skill and level)
  sabotage: { key: THE_MASTERY_ORDERS.sabotage.key, theNamesTheTurnReads: ['sabotage'], tier: 0 },
  // a Forced March acts at tier 0, with the orders that stay put, though it marches (answer 133)
  forced_march: {
    key: THE_MASTERY_ORDERS.forced_march.key,
    theNamesTheTurnReads: ['forced march', 'forced_march'],
    tier: 0,
  },
  grand_heist: {
    key: THE_MASTERY_ORDERS.grand_heist.key,
    theNamesTheTurnReads: ['grand heist', 'grand_heist'],
    tier: 0,
  },
  awaken_grove: {
    key: THE_MASTERY_ORDERS.awaken_grove.key,
    theNamesTheTurnReads: ['awaken grove', 'awaken_grove'],
    tier: 0,
  },
  chart_unknown: {
    key: THE_MASTERY_ORDERS.chart_unknown.key,
    theNamesTheTurnReads: ['chart the unknown', 'chart_unknown'],
    tier: 0,
  },
  discover_ruin: {
    key: THE_MASTERY_ORDERS.discover_ruin.key,
    theNamesTheTurnReads: ['discover lost ruin', 'discover_ruin'],
    tier: 0,
  },
  blockade: { key: THE_MASTERY_ORDERS.blockade.key, theNamesTheTurnReads: ['blockade'], tier: 0 },
  research_breakthrough: {
    key: THE_MASTERY_ORDERS.research_breakthrough.key,
    theNamesTheTurnReads: ['research breakthrough', 'research_breakthrough'],
    tier: 0,
  },
  assassinate: { key: THE_MASTERY_ORDERS.assassinate.key, theNamesTheTurnReads: ['assassinate'], tier: 0 },
  vanish: { key: THE_MASTERY_ORDERS.vanish.key, theNamesTheTurnReads: ['vanish'], tier: 0 },
  challenge: { key: THE_MASTERY_ORDERS.challenge.key, theNamesTheTurnReads: ['challenge'], tier: 0 },
  rampage: { key: THE_MASTERY_ORDERS.rampage.key, theNamesTheTurnReads: ['rampage'], tier: 0 },
  rain_of_arrows: {
    key: THE_MASTERY_ORDERS.rain_of_arrows.key,
    theNamesTheTurnReads: ['rain of arrows', 'rain_of_arrows'],
    tier: 0,
  },
  snipers_mark: {
    key: THE_MASTERY_ORDERS.snipers_mark.key,
    theNamesTheTurnReads: ["sniper's mark", 'snipers mark', 'snipers_mark'],
    tier: 0,
  },
  feigned_retreat: {
    key: THE_MASTERY_ORDERS.feigned_retreat.key,
    theNamesTheTurnReads: ['feigned retreat', 'feigned_retreat'],
    tier: 0,
  },
  grand_stratagem: {
    key: THE_MASTERY_ORDERS.grand_stratagem.key,
    theNamesTheTurnReads: ['grand stratagem', 'grand_stratagem'],
    tier: 0,
  },
  lightning_advance: {
    key: THE_MASTERY_ORDERS.lightning_advance.key,
    theNamesTheTurnReads: ['lightning advance', 'lightning_advance'],
    tier: 0,
  },
  raid_coast: {
    key: THE_MASTERY_ORDERS.raid_coast.key,
    theNamesTheTurnReads: ['raid the coast', 'raid_coast'],
    tier: 0,
  },
  wild_calling: {
    key: THE_MASTERY_ORDERS.wild_calling.key,
    theNamesTheTurnReads: ['wild calling', 'wild_calling'],
    tier: 0,
  },
  grand_design: {
    key: THE_MASTERY_ORDERS.grand_design.key,
    theNamesTheTurnReads: ['grand design', 'grand_design'],
    tier: 0,
  },
} as const satisfies Readonly<Record<string, AHeroOrder>>;

/** The kind a blank order, or one the turn has no name for, reads as: a Defend. */
export const THE_KIND_A_BLANK_OR_UNKNOWN_ORDER_READS_AS = THE_HERO_ORDERS.defend.key;
