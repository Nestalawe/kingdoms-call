// The relations between two realms (B-06, T7, the rules pulled out: Run 3b's diplomacy): the three states a pair of
// realms stands in, as a save's relations write them (keyed by the pair, the lower realm's index first), and the Treat
// a realm declares to another to step their relation up. A pair with no entry, or a blank one, stands Neutral. The
// engine reads how two realms stand through one reader (relKeyOf and theStateThePairsEntryHolds,
// src/engine/rules-on-plain-values/how-two-realms-stand-the-key-of-the-pair-and-the-state-its-entry-holds.ts, and
// relationBetween, areEnemies and areAllied beside the captures, src/engine/realms/relations-and-captures.ts), and
// names a state through these constants. The ratchet's count of the relations the engine names
// (relationChecksInEngine, tools/ratchet.ts) reads its words from here. The player portal names a state through them
// too: the map's popup (its name for each state, below) and the Diplomacy card (src/ui/player/map-symbols.ts).

/** The three states two realms stand in, as a save's relations write them. */
export const THE_STATES_TWO_REALMS_STAND_IN = {
  /** At war. */
  atWar: 'enemy',
  /** Allied. */
  allied: 'allied',
  /** Neutral: also a pair with no entry, or a blank one. */
  neutral: 'neutral',
} as const;

/** A state two realms stand in. */
export type AStateTwoRealmsStandIn =
  (typeof THE_STATES_TWO_REALMS_STAND_IN)[keyof typeof THE_STATES_TWO_REALMS_STAND_IN];

/** The state a pair of realms with no entry in the relations, or a blank one, stands in: Neutral. */
export const THE_STATE_A_PAIR_WITH_NO_ENTRY_STANDS_IN: AStateTwoRealmsStandIn = THE_STATES_TWO_REALMS_STAND_IN.neutral;

/** The Treat: the declaration a realm makes to another to step their relation up (a war is declared as `atWar`). */
export const THE_TREAT_DECLARATION = 'treat';

/** Each state's name as the player portal's map writes it after the realm that owns a province, in the province's
 *  popup: "Owned by Velmar (Allied)". */
export const THE_NAME_THE_MAP_GIVES_EACH_STATE_TWO_REALMS_STAND_IN: Readonly<Record<AStateTwoRealmsStandIn, string>> = {
  neutral: 'Neutral',
  allied: 'Allied',
  enemy: 'Enemy',
};
