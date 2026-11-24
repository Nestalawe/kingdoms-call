// The diplomacy ladder (B-06, T7, the rules pulled out: Run 3b's diplomacy, B-06ar): how the realms' declarations move
// a pair of realms when diplomacy resolves at the turn's end. A war declared from either side puts the pair at war,
// whatever the other sends; a war declared on an ally breaks the alliance, and the pair goes Neutral (R-044), unless
// the crown that breaks it is one whose creed breaks an alliance into war (its row in the creeds, read by
// src/engine/rules-on-plain-values/the-creeds-that-war-without-warning-break-an-alliance-into-war-and-conquer-by-a-doctrine.ts):
// then it goes the war's step. A Treat sent by both moves the pair one step up the ladder: from war to Neutral, from
// Neutral to an alliance. A Treat sent by one is an overture: of peace to a realm at war, of an alliance to any other,
// and the realm it is sent to has met its sender (R-078). In a small game no alliance can be forged: a Treat between
// two Neutral realms is dropped, and allies who both send one stay as they are. The three states are the relations'
// content (src/content/the-relations-between-two-realms-the-three-states-a-pair-stands-in-and-the-treat-declaration.ts).
// Read by diplomacy's resolution, the war without warning, the merge of the realms' declarations and the report's
// Diplomacy card (whether alliances are allowed).
import { THE_STATES_TWO_REALMS_STAND_IN } from './the-relations-between-two-realms-the-three-states-a-pair-stands-in-and-the-treat-declaration.ts';

const { atWar, allied, neutral } = THE_STATES_TWO_REALMS_STAND_IN;

/** The diplomacy ladder: the declaration of war, the state each declaration moves a pair to, the overture's kind and
 *  the small game's alliance limit. */
export const THE_DIPLOMACY_LADDER = {
  /** The declaration of war: a realm declares war on another as the state it puts the pair in (a Treat is
   *  `THE_TREAT_DECLARATION`). */
  aWarIsDeclaredAs: atWar,
  /** The state a war declared from either side moves the pair to, whatever the other sends (an alliance broken by a
   *  crown whose creed doesn't break it into war aside, below). */
  aWarMovesThePairTo: atWar,
  /** The state an alliance broken by a war declared on an ally moves the pair to (R-044). */
  anAllianceBrokenMovesThePairTo: neutral,
  /** The state a Treat sent by both moves the pair to: one step up the ladder, from war, from Neutral, and from an
   *  alliance (the top) or any other word. */
  aMutualTreatMovesThePair: { fromWar: neutral, fromNeutral: allied, fromAnAllianceOrAnyOther: allied },
  /** The state of the pair in which an overture is one of peace; in any other, it is one of an alliance. */
  anOvertureIsOfPeaceWhenThePairIs: atWar,
  /** The small game: in a game of this many realms or fewer, no alliance can be forged. */
  theMostRealmsInAGameThatForgesNoAlliance: 3,
} as const;
