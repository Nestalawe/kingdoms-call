// ── The kind of order each name of an order reads as (plan P1-11e20) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). The turn reads each order's action (a spelling the order form or a bot wrote) as one kind of
// order: processOrder's switch and the phase pipeline (turn/phase-intents-and-dependency-ordering.ts) read it so; the
// order form reads its own orders so to put a season's heroes in the turn's order (moved as they were, P1-11e20).
import { THE_ALIGNMENT_ORDERS } from '../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';

// The kinds of order (plan P1-10a2): PHASE_ACTION_MAP's values, what an order's action reads as. A phase order's own
// type is PhaseOrder (src/schemas/orders-a-realm-submits.ts), whose action is a spelling the form or a bot wrote. Every
// kind is a case of processOrder's switch but forced_march, which is handled before it. The map's `satisfies` checks
// nothing until this file loses its ts-nocheck line (P1-10b): then a value that is no kind fails to compile.
export type OrderKind =
  | 'move'
  | 'explore'
  | 'search'
  | 'hunt_rumours'
  | 'recruit'
  | 'hire'
  | 'release'
  | 'leave_army'
  | 'disband_army'
  | 'pickup_army'
  | 'give_item'
  | 'cast_spell'
  | 'spy'
  | 'practice'
  | 'research'
  | 'defend'
  | 'rest'
  | 'consecrate'
  | 'call_to_arms'
  | 'broker'
  | 'awaken_wild'
  | 'call_pit'
  | 'harvest_field'
  | 'encounter'
  | 'steal'
  | 'use_item'
  | 'equip_items'
  | 'rite'
  | 'sabotage'
  | 'forced_march'
  | 'grand_heist'
  | 'awaken_grove'
  | 'chart_unknown'
  | 'discover_ruin'
  | 'blockade'
  | 'research_breakthrough'
  | 'assassinate'
  | 'vanish'
  | 'challenge'
  | 'rampage'
  | 'rain_of_arrows'
  | 'snipers_mark'
  | 'feigned_retreat'
  | 'grand_stratagem'
  | 'lightning_advance'
  | 'raid_coast'
  | 'wild_calling'
  | 'grand_design';

// Canonical order-name → internal action-key map. Shared by processOrder and the phase pipeline
// (buildPhaseIntents / phaseDependencies) so both always agree on what a character is doing.
export const PHASE_ACTION_MAP = {
  move: 'move',
  explore: 'explore',
  'explore province': 'explore',
  search: 'search',
  'search lair': 'search',
  'search feature': 'search', // 'search feature' kept as a backward-compat alias for orders written before the Lair rename
  'hunting rumours': 'hunt_rumours',
  'hunt rumours': 'hunt_rumours',
  hunt_rumours: 'hunt_rumours', // 2026-09-17 (late)
  recruit: 'recruit',
  'recruit armies': 'recruit',
  hire: 'hire',
  'hire hero': 'hire',
  release: 'release',
  'release hero': 'release',
  'dismiss hero': 'release',
  leave_army: 'leave_army',
  'leave/transfer army': 'leave_army',
  'leave army': 'leave_army',
  'transfer army': 'leave_army',
  disband_army: 'disband_army',
  'disband army': 'disband_army',
  disband: 'disband_army',
  pickup_army: 'pickup_army',
  'pick up army': 'pickup_army',
  pick_up_army: 'pickup_army',
  give_item: 'give_item',
  'give item': 'give_item',
  'give magic item': 'give_item',
  send_item: 'give_item',
  'send item': 'give_item',
  'send magic item': 'give_item', // Give Item renamed Send Item (old label kept for back-compat)
  cast_spell: 'cast_spell',
  'cast spell': 'cast_spell',
  spy: 'spy',
  practice: 'practice',
  'practice skill': 'practice',
  'practice ability': 'practice',
  research: 'research',
  'research discovery': 'research',
  defend: 'defend',
  rest: 'rest',
  'rest & heal': 'rest',
  'rest and heal': 'rest',
  // the alignment orders: each row's key, its name as the form writes it (in lower case) and the other names the turn
  // reads, to its key (plan P1-19's alignment orders, Decision 3; the rows: src/content/alignment-orders-…)
  ...Object.fromEntries(
    Object.values(THE_ALIGNMENT_ORDERS).flatMap((order) =>
      [order.key, order.name.toLowerCase(), ...order.theOtherNamesTheTurnReads].map((name) => [name, order.key]),
    ),
  ),
  'awaken the wild': 'awaken_wild',
  awaken_wild: 'awaken_wild',
  'call from the pit': 'call_pit',
  call_pit: 'call_pit',
  encounter: 'encounter',
  'encounter character': 'encounter',
  steal: 'steal',
  'steal item': 'steal',
  'steal from character': 'steal',
  use_item: 'use_item',
  'use item': 'use_item',
  'use magic item': 'use_item',
  equip_items: 'equip_items',
  'equip items': 'equip_items',
  equip: 'equip_items',
  'equip item': 'equip_items',
  pursue: 'encounter',
  'pursue character': 'encounter', // Pursue is folded into Encounter
  sabotage: 'sabotage',
  'forced march': 'forced_march',
  forced_march: 'forced_march',
  'grand heist': 'grand_heist',
  grand_heist: 'grand_heist',
  'awaken grove': 'awaken_grove',
  awaken_grove: 'awaken_grove',
  'chart the unknown': 'chart_unknown',
  chart_unknown: 'chart_unknown',
  'discover lost ruin': 'discover_ruin',
  discover_ruin: 'discover_ruin',
  blockade: 'blockade',
  'research breakthrough': 'research_breakthrough',
  research_breakthrough: 'research_breakthrough',
  assassinate: 'assassinate',
  vanish: 'vanish',
  challenge: 'challenge',
  rampage: 'rampage',
  'rain of arrows': 'rain_of_arrows',
  rain_of_arrows: 'rain_of_arrows',
  "sniper's mark": 'snipers_mark',
  'snipers mark': 'snipers_mark',
  snipers_mark: 'snipers_mark',
  'feigned retreat': 'feigned_retreat',
  feigned_retreat: 'feigned_retreat',
  'grand stratagem': 'grand_stratagem',
  grand_stratagem: 'grand_stratagem',
  'lightning advance': 'lightning_advance',
  lightning_advance: 'lightning_advance',
  'raid the coast': 'raid_coast',
  raid_coast: 'raid_coast',
  'wild calling': 'wild_calling',
  wild_calling: 'wild_calling',
  'grand design': 'grand_design',
  grand_design: 'grand_design',
} satisfies Record<string, OrderKind>;

// (a key Object's prototype holds, such as `constructor`, gives its value: no order's action is one)
export function normaliseAction(order: { readonly action?: string | null | undefined } | null | undefined): string {
  const raw = ((order?.action ?? '') || 'defend').toLowerCase().trim();
  const theKindByName: Readonly<Partial<Record<string, string>>> = PHASE_ACTION_MAP;
  return (theKindByName[raw] ?? '') || 'defend';
}
