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
// that stay put (answer 133: its fix comes with KD-065's after T7). theTierAnOrderActsIn reads each row's tier
// (src/engine/rules-on-plain-values/the-order-the-heroes-act-in-a-phase-and-who-must-act-first.ts), and the phase's
// stages read it through that file (src/engine/turn/phase-stages-…).
// The checks before an order runs read a row's fields (B-06an: processOrder, src/engine/orders/order-dispatch-…): a
// mastery order (charged once a turn, and refused to a hero who joined the realm this turn, R-048), a Cast Spell (of a
// mastery spell, a mastery), what a hero seized by a charm refuses, and the battle lock's orders.
import { THE_ALIGNMENT_ORDERS } from './alignment-abilities-their-keys-names-numbers-and-words.ts';
import { THE_MASTERY_ORDERS } from './mastery-orders-their-keys-names-skills-and-levels.ts';

/** A row: one kind of order, the names the turn reads it by, the tier it acts in, and the checks before it runs. */
export interface AHeroOrder {
  /** The kind the turn reads the order as (an order's action, as the bots write it). */
  readonly key: string;
  /** Every name the turn reads the order by, in lower case, in the order the turn's names for the orders hold them. */
  readonly theNamesTheTurnReads: readonly string[];
  /** The tier it acts in within a phase: 0 it stays put, 1 a Move or an Encounter, 2 a Defend. */
  readonly tier: 0 | 1 | 2;
  /** The kind a saved name reads as, where it is no kind of its own (Pursue's row only). */
  readonly readsAs?: string;
  /** A mastery order (THE_MASTERY_ORDERS' rows): given at most once a turn, and by no hero who joined the realm this
   *  turn (R-048) or is seized by a charm. */
  readonly aMasteryOrder?: true;
  /** A Cast Spell: a cast of a mastery spell is a mastery, refused as one to a hero who joined the realm this turn or
   *  is seized by a charm (not charged once a turn here: the cast's own rule). */
  readonly aCastOfAMasterySpellIsAMastery?: true;
  /** What a hero seized by a charm from an enemy refuses: Disband Army, a creed's order and a mastery order. */
  readonly aSeizedHeroRefusesIt?: true;
  /** Pinned by the battle lock: a Move or an Encounter out of a province whose battle is unresolved, while an armed
   *  foe stands there (a Pursue reads as an Encounter first; a Forced March becomes a Move only after the lock). */
  readonly pinnedByTheBattleLock?: true;
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
    aSeizedHeroRefusesIt: true,
  } as const;
}

/** A mastery order's row, joined to its mastery row by key: the names the turn reads it by; it stays put (tier 0, a
 *  Forced March too: answer 133), it is a mastery order, and a hero seized by a charm refuses it. */
function theRowOfAMasteryOrder<const Key extends string, const Names extends readonly string[]>(
  order: { readonly key: Key },
  theNamesTheTurnReads: Names,
) {
  return { key: order.key, theNamesTheTurnReads, tier: 0, aMasteryOrder: true, aSeizedHeroRefusesIt: true } as const;
}

/** The hero orders, by kind, in the order the turn's names for the orders run. */
export const THE_HERO_ORDERS = {
  move: { key: 'move', theNamesTheTurnReads: ['move'], tier: 1, pinnedByTheBattleLock: true },
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
  disband_army: {
    key: 'disband_army',
    theNamesTheTurnReads: ['disband_army', 'disband army', 'disband'],
    tier: 0,
    aSeizedHeroRefusesIt: true,
  },
  pickup_army: { key: 'pickup_army', theNamesTheTurnReads: ['pickup_army', 'pick up army', 'pick_up_army'], tier: 0 },
  // Give Item is renamed Send Item: the old names stay read
  give_item: {
    key: 'give_item',
    theNamesTheTurnReads: ['give_item', 'give item', 'give magic item', 'send_item', 'send item', 'send magic item'],
    tier: 0,
  },
  cast_spell: {
    key: 'cast_spell',
    theNamesTheTurnReads: ['cast_spell', 'cast spell'],
    tier: 0,
    aCastOfAMasterySpellIsAMastery: true,
  },
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
  encounter: {
    key: 'encounter',
    theNamesTheTurnReads: ['encounter', 'encounter character'],
    tier: 1,
    pinnedByTheBattleLock: true,
  },
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
  sabotage: theRowOfAMasteryOrder(THE_MASTERY_ORDERS.sabotage, ['sabotage']),
  // a Forced March acts at tier 0, with the orders that stay put, though it marches (answer 133)
  forced_march: theRowOfAMasteryOrder(THE_MASTERY_ORDERS.forced_march, ['forced march', 'forced_march']),
  grand_heist: theRowOfAMasteryOrder(THE_MASTERY_ORDERS.grand_heist, ['grand heist', 'grand_heist']),
  awaken_grove: theRowOfAMasteryOrder(THE_MASTERY_ORDERS.awaken_grove, ['awaken grove', 'awaken_grove']),
  chart_unknown: theRowOfAMasteryOrder(THE_MASTERY_ORDERS.chart_unknown, ['chart the unknown', 'chart_unknown']),
  discover_ruin: theRowOfAMasteryOrder(THE_MASTERY_ORDERS.discover_ruin, ['discover lost ruin', 'discover_ruin']),
  blockade: theRowOfAMasteryOrder(THE_MASTERY_ORDERS.blockade, ['blockade']),
  research_breakthrough: theRowOfAMasteryOrder(THE_MASTERY_ORDERS.research_breakthrough, [
    'research breakthrough',
    'research_breakthrough',
  ]),
  assassinate: theRowOfAMasteryOrder(THE_MASTERY_ORDERS.assassinate, ['assassinate']),
  vanish: theRowOfAMasteryOrder(THE_MASTERY_ORDERS.vanish, ['vanish']),
  challenge: theRowOfAMasteryOrder(THE_MASTERY_ORDERS.challenge, ['challenge']),
  rampage: theRowOfAMasteryOrder(THE_MASTERY_ORDERS.rampage, ['rampage']),
  rain_of_arrows: theRowOfAMasteryOrder(THE_MASTERY_ORDERS.rain_of_arrows, ['rain of arrows', 'rain_of_arrows']),
  snipers_mark: theRowOfAMasteryOrder(THE_MASTERY_ORDERS.snipers_mark, [
    "sniper's mark",
    'snipers mark',
    'snipers_mark',
  ]),
  feigned_retreat: theRowOfAMasteryOrder(THE_MASTERY_ORDERS.feigned_retreat, ['feigned retreat', 'feigned_retreat']),
  grand_stratagem: theRowOfAMasteryOrder(THE_MASTERY_ORDERS.grand_stratagem, ['grand stratagem', 'grand_stratagem']),
  lightning_advance: theRowOfAMasteryOrder(THE_MASTERY_ORDERS.lightning_advance, [
    'lightning advance',
    'lightning_advance',
  ]),
  raid_coast: theRowOfAMasteryOrder(THE_MASTERY_ORDERS.raid_coast, ['raid the coast', 'raid_coast']),
  wild_calling: theRowOfAMasteryOrder(THE_MASTERY_ORDERS.wild_calling, ['wild calling', 'wild_calling']),
  grand_design: theRowOfAMasteryOrder(THE_MASTERY_ORDERS.grand_design, ['grand design', 'grand_design']),
} as const satisfies Readonly<Record<string, AHeroOrder>>;

/** The kind a blank order, or one the turn has no name for, reads as: a Defend. */
export const THE_KIND_A_BLANK_OR_UNKNOWN_ORDER_READS_AS = THE_HERO_ORDERS.defend.key;
