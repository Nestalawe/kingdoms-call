// ── THE FACTS A CHASE'S LINES RECORD (plan P1-12d12: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The lines a chase writes (heroes/pursuits-and-the-catch-roll.ts, advancePursuit): a hero on a Pursue or Encounter
// Character order following his quarry from province to province (the chase called off, held over, stalled or pressed
// on), the catch roll once they stand together, the quarry slipping away or caught (a friend met, a realm at peace
// passed by, a battle forced, the province claimed or still held), and a lone challenger breaking the ranks of his
// quarry's camp (the roll, the sentries, the King who rides on, the quarry cornered). Each kind holds plain values: a
// hero's, a province's or a realm's name as the world holds it (null where the world has none: the prose writes the
// words for it), a count, a flag for a clause chosen by it, and a rival's skill and the odds as a realm is shown them
// (theStatShownAsALineTellsIt and theOddsShownAsALineTellsIt, heroes/effective-skills-and-hidden-heroes.ts: what a
// realm has not earned is never in the fact); the prose writes every word (src/views/prose/the-words-of-a-chases-
// lines.ts). One field holds words still: a realm's tag after the challenger's name (realmTag, turn/log-line-
// helpers.ts: a label, listed by the static test). Each is filed on its own, with the audience its event names (its
// event's): no audience changes. A hero slain at the end of the chase is told by reportHeroFall, as a hero's death's
// kind "a hero is slain outside a battle" (P1-12d11); the duel's own lines are personal combat's.
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';
import type { AStatShownAsALineTellsIt, TheOddsShownAsALineTellsIt } from './effective-skills-and-hidden-heroes.ts';

/** What a line of a chase records. */
export type TheFactOfAChasesLine =
  | { kind: "a chaser's quarry is beyond catching"; heroName: string }
  | {
      kind: 'a chaser loses the trail of a quarry who leaves no track';
      heroName: string;
      quarryName: string;
      /** Where the trail is lost; null: nowhere the world names (the prose says "the wilds"). */
      provinceName: string | null;
    }
  | { kind: "a chaser's quarry vanishes into the shadows"; heroName: string; quarryName: string }
  | {
      kind: 'a chaser with a battle on his hands holds the chase over';
      heroName: string;
      /** Where his battle is; null: nowhere the world names (the prose says "the field"). */
      provinceName: string | null;
      quarryName: string;
    }
  | { kind: "a chaser's horses can go no further this year"; heroName: string; quarryName: string }
  | { kind: 'a chaser finds no road closer to his quarry'; heroName: string; quarryName: string }
  | { kind: 'a chaser has no ships left to follow his quarry to sea'; heroName: string; quarryName: string }
  | { kind: "a chaser's column is spent"; heroName: string; quarryName: string }
  | {
      kind: "a chaser presses on hard on his quarry's trail";
      heroName: string;
      provinceName: string;
      quarryName: string;
    }
  | { kind: 'a chaser rides in and finds his quarry'; heroName: string; provinceName: string; quarryName: string }
  | {
      kind: 'a chaser rolls to close on his quarry';
      heroName: string;
      /** The chaser's Spy, at the level it counts at. */
      spy: number;
      quarryName: string;
      /** The quarry's Spy as the chaser's realm is shown it; null: not earned. */
      quarrysSpy: AStatShownAsALineTellsIt | null;
      odds: TheOddsShownAsALineTellsIt;
    }
  | { kind: "a chaser's quarry slips away"; quarryName: string; provinceName: string; heroName: string }
  | {
      kind: 'a chaser catches up with a quarry of his own realm and the columns join';
      heroName: string;
      quarryName: string;
      provinceName: string;
    }
  | {
      kind: 'a chaser overtakes a quarry whose realm is not at war with his';
      heroName: string;
      quarryName: string;
      provinceName: string;
      /** The quarry's realm; null: none the world names (the prose says "their realm"). */
      quarrysRealmName: string | null;
      /** The chaser's realm; null: none the world names (the prose says "us"). */
      chasersRealmName: string | null;
    }
  | {
      kind: 'a chaser closes on his quarry on ground already a battlefield';
      heroName: string;
      quarryName: string;
      provinceName: string;
    }
  | {
      kind: 'a chaser runs his quarry to ground and forces battle';
      heroName: string;
      quarryName: string;
      provinceName: string;
    }
  | {
      kind: 'a chaser carries the field but the province is still held';
      heroName: string;
      provinceName: string;
      /** Only the province's garrison holds it (no hostile host, no hulls ashore). */
      onlyItsGarrisonHolds: boolean;
    }
  | {
      kind: 'a chaser claims the province for his realm';
      heroName: string;
      provinceName: string;
      /** His realm; null: none the world names (the prose says "their realm"). */
      realmName: string | null;
    }
  | {
      kind: "a lone challenger rolls to break the ranks of his quarry's camp";
      heroName: string;
      /** The challenger's Spy, at the level it counts at. */
      spy: number;
      quarryName: string;
      /** The units of the quarry's camp. */
      unitCount: number;
      /** The quarry's Tactical as the challenger's realm is shown it; null: not earned. */
      quarrysTactical: AStatShownAsALineTellsIt | null;
      odds: TheOddsShownAsALineTellsIt;
    }
  | {
      kind: 'a lone challenger is turned away by the sentries';
      heroName: string;
      quarryName: string;
      provinceName: string;
    }
  | {
      kind: "a quarry's realm learns a lone challenger came for him";
      heroName: string;
      /** realmTag's words: " (Westmarch)", or none (a label, listed by the static test). */
      realmTag: string;
      quarryName: string;
      provinceName: string;
    }
  | {
      kind: 'a lone challenger slips through the picket lines';
      heroName: string;
      quarryName: string;
      provinceName: string;
    }
  | {
      kind: "a crowned quarry will not answer a commoner's challenge";
      heroName: string;
      quarryName: string;
      provinceName: string;
    }
  | { kind: 'a chaser finally corners his quarry'; heroName: string; quarryName: string; provinceName: string };

/** Each kind's audience: its event's (each is filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_CHASES_LINE: Readonly<
  Record<TheFactOfAChasesLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  "a chaser's quarry is beyond catching": "its event's",
  'a chaser loses the trail of a quarry who leaves no track': "its event's",
  "a chaser's quarry vanishes into the shadows": "its event's",
  'a chaser with a battle on his hands holds the chase over': "its event's",
  "a chaser's horses can go no further this year": "its event's",
  'a chaser finds no road closer to his quarry': "its event's",
  'a chaser has no ships left to follow his quarry to sea': "its event's",
  "a chaser's column is spent": "its event's",
  "a chaser presses on hard on his quarry's trail": "its event's",
  'a chaser rides in and finds his quarry': "its event's",
  'a chaser rolls to close on his quarry': "its event's",
  "a chaser's quarry slips away": "its event's",
  'a chaser catches up with a quarry of his own realm and the columns join': "its event's",
  'a chaser overtakes a quarry whose realm is not at war with his': "its event's",
  'a chaser closes on his quarry on ground already a battlefield': "its event's",
  'a chaser runs his quarry to ground and forces battle': "its event's",
  'a chaser carries the field but the province is still held': "its event's",
  'a chaser claims the province for his realm': "its event's",
  "a lone challenger rolls to break the ranks of his quarry's camp": "its event's",
  'a lone challenger is turned away by the sentries': "its event's",
  "a quarry's realm learns a lone challenger came for him": "its event's",
  'a lone challenger slips through the picket lines': "its event's",
  "a crowned quarry will not answer a commoner's challenge": "its event's",
  'a chaser finally corners his quarry': "its event's",
};
