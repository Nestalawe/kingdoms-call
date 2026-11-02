// The mastery orders (plan P1-11's Decisions of 2026-11-02, choice 4): the 20 orders a hero gives at level 7 or 9 of a
// skill, one row each, keyed by the key the turn dispatches it by, in the order of MASTERY_ORDER_KEYS
// (src/engine/army-tables.ts): its key, its name as the order form and the turn's lines write it, the skill it needs
// and the level of that skill. The level is the hero's trained level (past 5 comes from experience only). The engine's
// set of the masteries' keys and their labels (MASTERY_ORDER_KEYS, MASTERY_ORDER_LABEL) are built from these rows, and
// so are the player page's (L79_ORDERS, src/ui/player/l79-orders.ts: each order's name, skill and level; the form's
// target and hint are its own). The engine checks each row's key is a kind of order (army-tables.ts). Each resolver
// still writes its own level (P1-11d11 reads it here); tests/lib/player-portal-copies.ts holds the form's table
// against the turn's, a hero one level below each and one at it.
import type { KC_SKILLS } from './kingdoms-call-data.ts';

/** A row: the key, name, skill and level of one mastery order. */
interface AMasteryOrder {
  /** The key the turn dispatches the order by (an order's `action`, as the bots write it). */
  readonly key: string;
  /** Its name as the order form and the turn's lines write it. */
  readonly name: string;
  /** The skill it needs. */
  readonly skill: (typeof KC_SKILLS)[number];
  /** The hero's trained level of that skill it needs. */
  readonly level: number;
}

/** The mastery orders, by key, in the order of MASTERY_ORDER_KEYS. */
export const THE_MASTERY_ORDERS = {
  challenge: { key: 'challenge', name: 'Challenge', skill: 'melee', level: 7 },
  rampage: { key: 'rampage', name: 'Rampage', skill: 'melee', level: 9 },
  rain_of_arrows: { key: 'rain_of_arrows', name: 'Rain of Arrows', skill: 'archery', level: 7 },
  snipers_mark: { key: 'snipers_mark', name: "Sniper's Mark", skill: 'archery', level: 9 },
  feigned_retreat: { key: 'feigned_retreat', name: 'Feigned Retreat', skill: 'tactical', level: 7 },
  grand_stratagem: { key: 'grand_stratagem', name: 'Grand Stratagem', skill: 'tactical', level: 9 },
  forced_march: { key: 'forced_march', name: 'Forced March', skill: 'march', level: 7 },
  lightning_advance: { key: 'lightning_advance', name: 'Lightning Advance', skill: 'march', level: 9 },
  blockade: { key: 'blockade', name: 'Blockade', skill: 'naval', level: 7 },
  raid_coast: { key: 'raid_coast', name: 'Raid the Coast', skill: 'naval', level: 9 },
  research_breakthrough: { key: 'research_breakthrough', name: 'Research Breakthrough', skill: 'sage', level: 7 },
  grand_design: { key: 'grand_design', name: 'Grand Design', skill: 'sage', level: 9 },
  sabotage: { key: 'sabotage', name: 'Sabotage', skill: 'spy', level: 7 },
  assassinate: { key: 'assassinate', name: 'Assassinate', skill: 'spy', level: 9 },
  grand_heist: { key: 'grand_heist', name: 'Grand Heist', skill: 'thief', level: 7 },
  vanish: { key: 'vanish', name: 'Vanish', skill: 'thief', level: 9 },
  awaken_grove: { key: 'awaken_grove', name: 'Awaken Grove', skill: 'druid', level: 7 },
  wild_calling: { key: 'wild_calling', name: 'Wild Calling', skill: 'druid', level: 9 },
  chart_unknown: { key: 'chart_unknown', name: 'Chart the Unknown', skill: 'explorer', level: 7 },
  discover_ruin: { key: 'discover_ruin', name: 'Discover Lost Ruin', skill: 'explorer', level: 9 },
} as const satisfies Readonly<Record<string, AMasteryOrder>>;
