// ── THE FACTS THE LINES OF RELATIONS AND CAPTURES RECORD (plan P1-12d17: P1-12's Decisions of 2026-10-30, Decision 2) ─
// The lines a province changing hands writes (realms/relations-and-captures.ts): its consecration broken, the altars
// cast down by the conquering column (and the units that rise a level for it), the realm that lost it told who took
// it, and an Evil conqueror's doctrine: the beaten folk enslaved, an enslavement with no humanoid folk to press, and
// the plunder. Each kind holds plain values: a hero's, a realm's, a province's or a unit's name as the world holds it
// (null where the line falls back: the prose writes "an unknown commander", "an enemy realm"), a unit's type and
// quality as the world holds them, counts and gold, the units that rose (each a copy of its name and its new quality,
// as the line is told), and a flag for the clause the line chooses. The prose writes every word
// (src/views/prose/the-words-of-relations-and-captures-lines.ts). Each is filed on its own, with the audience its
// event names (its event's): no audience changes.
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';

/** A unit that rose a level, as the line names it: its name and its new quality, copied as the line is told. */
export interface AUnitThatRoseAsTheLineNamesIt {
  readonly unitName: string;
  readonly quality: string;
}

/** What a line of relations and captures records. */
export type TheFactOfARelationsAndCapturesLine =
  | {
      readonly kind: 'a consecration is broken as its province is captured';
      readonly provinceName: string;
      readonly realmName: string;
    }
  | {
      readonly kind: "a conquering column casts down a province's altars";
      readonly heroName: string;
      readonly provinceName: string;
      /** The units that rose a level for it, in order (none: the line says whether they might have). */
      readonly unitsThatRose: readonly AUnitThatRoseAsTheLineNamesIt[];
      /** Whether the conqueror's realm takes pride in the sacrilege (a chance for its units to rise). */
      readonly theTroopsMayRise: boolean;
    }
  | {
      readonly kind: 'a realm is told a province has been captured from it';
      readonly provinceName: string;
      /** The conqueror (null: none is named, and the prose writes "an unknown commander"). */
      readonly conquerorName: string | null;
      /** The conqueror's realm (null where the world has none: the prose writes "an enemy realm"). */
      readonly realmName: string | null;
      /** The units the conqueror led (null when none is named: the line says nothing of units). */
      readonly unitsLed: number | null;
    }
  | {
      readonly kind: 'an Evil conqueror presses the beaten folk into the garrison in chains';
      readonly heroName: string;
      readonly provinceName: string;
      /** The type of the unit pressed, as the garrison holds it. */
      readonly unitType: string;
    }
  | {
      readonly kind: 'an Evil conqueror finds no humanoid folk to enslave';
      readonly heroName: string;
      readonly provinceName: string;
    }
  | {
      readonly kind: "an Evil conqueror's forces plunder a province";
      readonly heroName: string;
      readonly provinceName: string;
      readonly loot: number;
    };

/** Each kind's audience: its event's (each is filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_RELATIONS_AND_CAPTURES_LINE: Readonly<
  Record<TheFactOfARelationsAndCapturesLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'a consecration is broken as its province is captured': "its event's",
  "a conquering column casts down a province's altars": "its event's",
  'a realm is told a province has been captured from it': "its event's",
  'an Evil conqueror presses the beaten folk into the garrison in chains': "its event's",
  'an Evil conqueror finds no humanoid folk to enslave': "its event's",
  "an Evil conqueror's forces plunder a province": "its event's",
};

// ── A PROVINCE CHANGING HANDS, FOR THE STATISTICS (plan P1-12d33: P1-12d's last slice, Decision 1) ──
// Not a line: the record the turn's statistics keep of each province that changes hands (db/telemetry.ts writes it
// into turn_events). setProvinceOwner files it through recordForTheStatistics (turn/events-and-their-audiences.ts),
// never into the GM's log.

/** A province changing hands, as the statistics record it: its phase; the province, its ground and its tax (0 where it
 *  has none); its owner before and after (none for no realm); the hero who took it (none for no hero). */
export interface AProvinceChangingHandsAsTheStatisticsRecordIt {
  ph: number | null;
  prov: number;
  terrain: string | undefined;
  tax: number;
  from: number | null;
  to: number | null;
  charId: number | null;
}

/** A province changing hands, for the statistics: the record, as it was kept before it was a fact. */
export interface TheFactOfAProvinceChangingHandsForTheStatistics {
  kind: 'a province changing hands, for the statistics';
  record: AProvinceChangingHandsAsTheStatisticsRecordIt;
}
