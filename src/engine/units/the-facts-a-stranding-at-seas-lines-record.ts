// ── THE FACTS A STRANDING AT SEA'S LINES RECORD (plan P1-12d14: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The lines a column on open water writes when its hulls can no longer carry all it leads (units/sea-lift-stranding-
// and-retreats.ts, settleStrandedAtSea): the bound units that dissolve, and the units put ashore to join a garrison of
// the realm's, left holding the sea province (claiming it when it is unowned and undefended), or lost at sea. Each kind
// holds plain values: a hero's, a province's or a realm's name as the world holds it (null where the line falls back:
// the prose writes "the realm" or "another realm"), the units a line names (copied as the line is told:
// theUnitsAsTheLineNamesThem, a battle's; the prose names each as strandLabel does). One field holds words still: why
// the column is short, as a caller hands them in (the safety net after the wages, in Early Winter, hands "too few hulls
// left to carry the whole column"; every other call none, and the prose writes "too few hulls left afloat …"): words
// handed in through a parameter, which the static test can't see, a later row's (Early Winter's). The prose writes
// every other word (src/views/prose/the-words-of-a-stranding-at-seas-lines.ts). Each is filed on its own, with the
// audience its event names (its event's: the column's realm alone): no audience changes.
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';
import type { AUnitAsDescribeArmyNamesIt } from '../dice-and-army-names.ts';

/** Whose the sea province is, where units are lost at sea: a realm's (its name as the world holds it; null: none, the
 *  prose says "another realm"), else null: its neutral defenders hold it. */
export interface WhoseWatersTheUnitsAreLostIn {
  realmName: string | null;
}

/** What a line of a stranding at sea records. */
export type TheFactOfAStrandingAtSeasLine =
  | {
      kind: 'bound units a column cannot carry over open water dissolve';
      heroName: string;
      units: AUnitAsDescribeArmyNamesIt[];
    }
  | {
      kind: 'units a column cannot carry are put ashore and join a garrison';
      heroName: string;
      /** Why the column is short, in the words its caller hands in (the safety net after the wages: "too few hulls left
       *  to carry the whole column"); null: none handed in (the prose says "too few hulls left afloat to carry …"). */
      why: string | null;
      units: AUnitAsDescribeArmyNamesIt[];
      shoreName: string;
    }
  | {
      kind: "units a column cannot carry hold the realm's sea province";
      heroName: string;
      why: string | null;
      units: AUnitAsDescribeArmyNamesIt[];
      provinceName: string;
    }
  | {
      kind: 'units a column cannot carry hold and claim an unowned sea province';
      heroName: string;
      why: string | null;
      units: AUnitAsDescribeArmyNamesIt[];
      provinceName: string;
      /** The realm they claim it for, as the world names it; null: none found (the prose says "the realm"). */
      realmName: string | null;
    }
  | {
      kind: 'units a column cannot carry are lost at sea';
      heroName: string;
      why: string | null;
      units: AUnitAsDescribeArmyNamesIt[];
      provinceName: string;
      waters: WhoseWatersTheUnitsAreLostIn | null;
    };

/** Each kind's audience: its event's (each is filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_STRANDING_AT_SEAS_LINE: Readonly<
  Record<TheFactOfAStrandingAtSeasLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'bound units a column cannot carry over open water dissolve': "its event's",
  'units a column cannot carry are put ashore and join a garrison': "its event's",
  "units a column cannot carry hold the realm's sea province": "its event's",
  'units a column cannot carry hold and claim an unowned sea province': "its event's",
  'units a column cannot carry are lost at sea': "its event's",
};
