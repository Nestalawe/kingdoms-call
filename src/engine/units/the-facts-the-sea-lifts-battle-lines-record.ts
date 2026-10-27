// ── THE FACTS THE SEA LIFT'S BATTLE LINES RECORD (plan P1-12d5: P1-12's Decisions of 2026-10-26, Decisions 2 and 6) ──
// The lines a beaten force's battle takes from the sea lift (units/sea-lift-stranding-and-retreats.ts): why it cannot
// fall back at sea (seaTrapLine), the hulls left ashore that still hold a province against its claimant
// (navalHoldLine), and the naval split, the fleet's retreat to friendly water with what its hulls can carry and the rest
// left to fall back, hold or scatter (navalSplitRetreat, _navalLeaveBehind). Each kind holds plain values: a name as the
// world holds it, the units a line names copied as it is told (theUnitsAsTheLineNamesThem), and why units were left
// behind as a reason, never its words; the prose writes every word (src/views/prose/the-words-of-the-sea-lifts-battle-
// lines.ts). A side's label stays a field in this slice (Decision 2: the facts-by-sense slice names a side), listed by
// the static test (tests/static/a-lines-facts-hold-values-not-words.test.ts).
// Each is told in a battle's narrative (the fight's audience) or filed on its own by a stalled battle, a host gained in
// a province, a pursuit or a march (its event's): its audience is its event's (Decision 6).
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';
import type { AUnitAsDescribeArmyNamesIt } from '../dice-and-army-names.ts';

/** Why units of a beaten fleet's column are left behind on the shore: no room aboard and no ground of the realm's
 *  beside it (the fleet sails), or no friendly water beside it (the column marches inland). */
export type WhyUnitsAreLeftBehind =
  | 'there is no room aboard and no friendly ground to fall back to'
  | 'no friendly water lies alongside for the ships to sail to';

/** What a line of the sea lift in a battle records. */
export type TheFactOfASeaLiftsBattleLine =
  | {
      kind: 'a beaten force at sea has too few hulls left to fall back';
      sideName: string;
      provinceName: string;
    }
  | {
      kind: 'hulls left ashore still hold a province against its claimant';
      /** The realm whose hulls they are, as the world names it; null: none known (the prose says "the enemy"). */
      holdersRealmName: string | null;
      units: AUnitAsDescribeArmyNamesIt[];
      provinceName: string;
      /** Whose the ground is not while they lie there (a realm's name, or a side's label); null: the hunter's. */
      claimantName: string | null;
    }
  | {
      kind: 'a beaten fleet puts to sea with what its hulls can carry';
      sideName: string;
      provinceName: string;
      destinationName: string;
      /** The units the fleet carries off (none: the hulls alone). */
      units: AUnitAsDescribeArmyNamesIt[];
    }
  | {
      kind: 'bound units the fleet cannot carry dissolve';
      sideName: string;
      units: AUnitAsDescribeArmyNamesIt[];
    }
  | {
      kind: 'units the fleet cannot carry fall back overland and join a garrison';
      sideName: string;
      units: AUnitAsDescribeArmyNamesIt[];
      shoreName: string;
    }
  | {
      kind: 'a beaten force with ships retreats overland and leaves its ships behind';
      sideName: string;
      destinationName: string;
      units: AUnitAsDescribeArmyNamesIt[];
    }
  | {
      kind: 'a beaten fleet with no friendly water holds the province';
      sideName: string;
      provinceName: string;
    }
  | {
      kind: 'bound units left behind on the shore dissolve';
      sideName: string;
      units: AUnitAsDescribeArmyNamesIt[];
      why: WhyUnitsAreLeftBehind;
    }
  | {
      kind: "units left behind on the realm's own ground hold it";
      sideName: string;
      units: AUnitAsDescribeArmyNamesIt[];
      provinceName: string;
      why: WhyUnitsAreLeftBehind;
    }
  | {
      kind: 'units left behind on ground the realm does not hold scatter as mercenaries';
      sideName: string;
      units: AUnitAsDescribeArmyNamesIt[];
      why: WhyUnitsAreLeftBehind;
    };

/** Each kind's audience: its event's (a kind filed on its own; in a fight's narrative, the fight's). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_SEA_LIFTS_BATTLE_LINE: Readonly<
  Record<TheFactOfASeaLiftsBattleLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'a beaten force at sea has too few hulls left to fall back': "its event's",
  'hulls left ashore still hold a province against its claimant': "its event's",
  'a beaten fleet puts to sea with what its hulls can carry': "its event's",
  'bound units the fleet cannot carry dissolve': "its event's",
  'units the fleet cannot carry fall back overland and join a garrison': "its event's",
  'a beaten force with ships retreats overland and leaves its ships behind': "its event's",
  'a beaten fleet with no friendly water holds the province': "its event's",
  'bound units left behind on the shore dissolve': "its event's",
  "units left behind on the realm's own ground hold it": "its event's",
  'units left behind on ground the realm does not hold scatter as mercenaries': "its event's",
};
