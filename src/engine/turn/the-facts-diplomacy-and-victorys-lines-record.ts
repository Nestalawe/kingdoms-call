// ── THE FACTS DIPLOMACY'S AND VICTORY'S LINES RECORD (plan P1-12d16: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The lines of the turn's diplomacy and of victory (turn/diplomacy-resolution-and-victory-the-reckoning-elimination-
// concession-and-the-announcement.ts): an overture sent, unanswered or of an alliance so few kings may not forge; war,
// an alliance, its breaking or peace between two realms; the war-front warnings to both sides of a new war; the
// Reckoning called too early, by no king, short of the bar, or lodged; a claim collapsing; the bar falling as the world
// grows weary; and the game's end (the Reckoning called at once as the rivals concede, the winner announced, and each
// realm's place in the final Legacy standings). Each kind holds plain values: a realm's or a hero's name as the world
// holds it (null where the line falls back, with a realm's seat where it falls back to its number: the prose writes
// "Realm 2", "A king", "the claimant", "the enemy"), a share of the world and a bar as fractions (the prose rounds them
// for reading: dispFloor), the bar's percentages, counts and turns, a title's key (the prose writes its name), and a
// flag for each clause the line chooses. The prose writes every word (src/views/prose/the-words-of-diplomacy-and-
// victorys-lines.ts); the game's end's words stay exactly as they were, since the player page reads them from the stored
// log (its banner and standings). Each is filed on its own, with the audience its event names (its event's): no
// audience changes.
import type { TheAudienceOfAKindOfLine } from './events-and-their-audiences.ts';

/** A realm as a line of diplomacy or victory names it: its name as the world holds it (null where the line falls back),
 *  and its seat (counted from 0: the prose writes "Realm 2" from it). */
export interface ARealmAsDiplomacyOrVictoryNamesIt {
  realmName: string | null;
  seat: number;
}

/** Two realms, as a line of a pair's relation names them: the realm told first. */
interface TwoRealmsAsTheLineNamesThem {
  first: ARealmAsDiplomacyOrVictoryNamesIt;
  second: ARealmAsDiplomacyOrVictoryNamesIt;
}

/** What a line of diplomacy or victory records. */
export type TheFactOfADiplomacyOrVictoryLine =
  | {
      kind: 'a realm is sent an overture';
      from: ARealmAsDiplomacyOrVictoryNamesIt;
      /** The overture is of peace (the pair are enemies), else of an alliance. */
      ofPeace: boolean;
      /** The realm told sent a Treat of its own ("You answered in kind"). */
      answeredInKind: boolean;
    }
  | {
      kind: 'two realms both seek an alliance so few kings may not forge';
      /** The realm told, and the other. */
      realm: ARealmAsDiplomacyOrVictoryNamesIt;
      otherRealm: ARealmAsDiplomacyOrVictoryNamesIt;
    }
  | {
      kind: "a realm's overture goes unanswered";
      realm: ARealmAsDiplomacyOrVictoryNamesIt;
      otherRealm: ARealmAsDiplomacyOrVictoryNamesIt;
      ofPeace: boolean;
    }
  | ({ kind: 'war now stands between two realms' } & TwoRealmsAsTheLineNamesThem)
  | ({ kind: 'two realms are now allied' } & TwoRealmsAsTheLineNamesThem)
  | ({
      kind: 'an alliance is broken and two realms are neutral once more';
      /** Which of the two declared war on the other (one or both). */
      brokenByFirst: boolean;
      brokenBySecond: boolean;
    } & TwoRealmsAsTheLineNamesThem)
  | ({ kind: 'two realms make peace and are neutral' } & TwoRealmsAsTheLineNamesThem)
  | {
      kind: "a host stands on a new foe's war front";
      heroName: string;
      unitCount: number;
      provinceName: string;
      /** The province is the foe's land (else the host stands beside the foe's host). */
      onTheFoesLand: boolean;
      /** The foe (null where it has no name: the prose writes "the enemy"). */
      foeRealmName: string | null;
    }
  | {
      kind: "a new foe's host stands on the realm's war front";
      heroName: string;
      /** The hero's realm (null where it has no name: the prose writes "the enemy"). */
      realmName: string | null;
      unitCount: number;
      provinceName: string;
      /** The province is the realm's own (else the host stands beside the realm's host). */
      onTheRealmsLand: boolean;
    }
  | {
      kind: 'a realm calls the Reckoning before the throne may be claimed';
      /** The realm (null where it has no name: the prose writes "A king"). */
      realmName: string | null;
      firstTurn: number;
    }
  | {
      kind: 'a realm with no living king calls the Reckoning';
    }
  | {
      kind: 'the Reckoning is called';
      claimant: ARealmAsDiplomacyOrVictoryNamesIt;
      /** The names of the claimant's allies standing with the claim (the prose joins them). */
      allyNames: string[];
      /** The bloc's share of the world and the claimant's bar, as fractions. */
      share: number;
      bar: number;
      judgedAtTurn: number;
    }
  | {
      kind: "a realm calls the Reckoning on its alliance's strength but holds too little itself";
      realmName: string | null;
      /** The realm's own share of the world, the least a claimant must hold, and the bar, as fractions. */
      ownShare: number;
      callerMinimum: number;
      bar: number;
    }
  | {
      kind: 'a realm calls the Reckoning but commands too little of the world';
      realmName: string | null;
      share: number;
      bar: number;
    }
  | {
      kind: "the claim to the throne collapses as the claimant's bloc falls below the bar";
      /** The claimant (null where it has no name: the prose writes "the claimant"). */
      claimantName: string | null;
      share: number;
      bar: number;
    }
  | {
      kind: 'the claim to the throne collapses as the claimant falls below his own floor';
      claimantName: string | null;
      ownShare: number;
      ownMinimum: number;
    }
  | {
      kind: "the Reckoning's bar falls as the world grows weary";
      /** The bar of a realm standing alone, in percent, before and now; what each ally adds; the next step. */
      barBefore: number;
      barNow: number;
      allyStep: number;
      /** The bar has reached its floor (else it falls by nextFall at the end of next turn). */
      fallsNoFurther: boolean;
      nextFall: number;
    }
  | {
      kind: 'the Reckoning is called at once as the rivals concede';
      concededCount: number;
      /** Only one crown still contests the world (else the last crowns standing are sworn to one another). */
      oneCrownLeft: boolean;
    }
  | {
      kind: 'the game is decided';
      /** The winner (null where none is named: "No-one"). */
      winner: ARealmAsDiplomacyOrVictoryNamesIt | null;
      byElimination: boolean;
      byConcession: boolean;
    }
  | {
      kind: "a realm's place in the final Legacy standings";
      place: number;
      realmName: string;
      score: number;
      /** The titles it holds, by key (the prose names them), and its relics. */
      titleKeys: string[];
      relics: number | undefined;
    };

/** Each kind's audience: its event's (each is filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_DIPLOMACY_OR_VICTORY_LINE: Readonly<
  Record<TheFactOfADiplomacyOrVictoryLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'a realm is sent an overture': "its event's",
  'two realms both seek an alliance so few kings may not forge': "its event's",
  "a realm's overture goes unanswered": "its event's",
  'war now stands between two realms': "its event's",
  'two realms are now allied': "its event's",
  'an alliance is broken and two realms are neutral once more': "its event's",
  'two realms make peace and are neutral': "its event's",
  "a host stands on a new foe's war front": "its event's",
  "a new foe's host stands on the realm's war front": "its event's",
  'a realm calls the Reckoning before the throne may be claimed': "its event's",
  'a realm with no living king calls the Reckoning': "its event's",
  'the Reckoning is called': "its event's",
  "a realm calls the Reckoning on its alliance's strength but holds too little itself": "its event's",
  'a realm calls the Reckoning but commands too little of the world': "its event's",
  "the claim to the throne collapses as the claimant's bloc falls below the bar": "its event's",
  'the claim to the throne collapses as the claimant falls below his own floor': "its event's",
  "the Reckoning's bar falls as the world grows weary": "its event's",
  'the Reckoning is called at once as the rivals concede': "its event's",
  'the game is decided': "its event's",
  "a realm's place in the final Legacy standings": "its event's",
};
