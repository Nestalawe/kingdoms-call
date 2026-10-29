// ── THE FACTS THE LINES BEFORE THE FIRST PHASE RECORD (plan P1-12d15: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The lines the turn writes before its first phase (turn/before-the-first-phase-war-without-warning-research-choices-
// messages-move-pools-and-default-defend.ts): a realm pursuing one of the leads its scholars found last turn, an Evil or
// Undead realm's war without warning, a realm's diplomacy set aside before the Safe Start ends, a line the order merge
// held until the turn's log was ready, a realm the GM removed told as conceding, a dispatch delivered and the sender's
// copy, and two of the save's sweeps (the lairs renamed, the guardians re-measured). Each kind holds plain values: a
// realm's, a hero's or a discovery's name as the world or the content holds it (a realm's name null where the line
// falls back, with its seat: the prose writes "Realm 2" or "Player 2"), a discovery's category and description as the
// content holds them, the names of the leads set aside (copied as the line is told: the prose joins them), a count, a
// flag for each clause the line chooses, and a dispatch's text as its sender wrote it. One field holds words still: a
// line the order merge held (turn/set-up-the-turns-start-repairs-and-the-merge-of-the-realms-orders.ts writes it into
// staleOrderWarnings, words handed in through the turn's context: making them values changes what the merge's tests
// pin, Parked). The prose writes every other word (src/views/prose/the-words-of-the-lines-before-the-first-phase.ts).
// Each is filed on its own, with the audience its event names (its event's): no audience changes.
import type { TheAudienceOfAKindOfLine } from './events-and-their-audiences.ts';

/** A realm as a line names it: its name as the world holds it (null where the line falls back), and its seat (counted
 *  from 0: the prose writes "Realm 2" or "Player 2" from it). */
export interface ARealmAsALineBeforeTheFirstPhaseNamesIt {
  realmName: string | null;
  seat: number;
}

/** What a line before the first phase records. */
export type TheFactOfALineBeforeTheFirstPhase =
  | {
      kind: 'a realm pursues one of the leads its scholars found last turn';
      realmName: string;
      /** The realm sent its choice (else its scholars chose by the die). */
      chosenByTheRealm: boolean;
      discoveryName: string;
      /** The discovery's category and description, as the content holds them. */
      category: string;
      description: string;
      /** The hero who found the leads (null where the line says "a scholar"). */
      finderName: string | null;
      /** The leads set aside and forgotten (the prose joins them; none: no clause). */
      leadsSetAsideNames: string[];
    }
  | {
      kind: 'an Evil or Undead realm declares war without warning';
      declarer: ARealmAsALineBeforeTheFirstPhaseNamesIt;
      foe: ARealmAsALineBeforeTheFirstPhaseNamesIt;
      /** The declarer is Undead ("the dead keep no truce"), else Evil. */
      undead: boolean;
    }
  | {
      kind: "a realm's diplomacy is set aside before the Safe Start ends";
      /** The turn whose orders may first carry a Treat or a declaration of war. */
      safeStartTurn: number;
    }
  | {
      kind: "a line the order merge held until the turn's log was ready";
      /** The line's words, as the merge wrote them into the turn's context (words handed in: Parked). */
      words: string;
    }
  | {
      kind: 'a realm the GM removed withdraws and concedes';
      realmName: string;
    }
  | {
      kind: 'a dispatch reaches a realm';
      sender: ARealmAsALineBeforeTheFirstPhaseNamesIt;
      /** The dispatch's text, as its sender wrote it (trimmed, at most 1,000 characters). */
      message: string;
    }
  | {
      kind: 'a realm keeps a copy of the dispatch it sent';
      recipients: ARealmAsALineBeforeTheFirstPhaseNamesIt[];
      message: string;
    }
  | {
      kind: 'the chronicles record the lairs under fitting names';
      lairs: number;
    }
  | {
      kind: "the world's guardians are re-measured five hit points frailer";
      guardians: number;
    };

/** Each kind's audience: its event's (each is filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_LINE_BEFORE_THE_FIRST_PHASE: Readonly<
  Record<TheFactOfALineBeforeTheFirstPhase['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'a realm pursues one of the leads its scholars found last turn': "its event's",
  'an Evil or Undead realm declares war without warning': "its event's",
  "a realm's diplomacy is set aside before the Safe Start ends": "its event's",
  "a line the order merge held until the turn's log was ready": "its event's",
  'a realm the GM removed withdraws and concedes': "its event's",
  'a dispatch reaches a realm': "its event's",
  'a realm keeps a copy of the dispatch it sent': "its event's",
  'the chronicles record the lairs under fitting names': "its event's",
  "the world's guardians are re-measured five hit points frailer": "its event's",
};
