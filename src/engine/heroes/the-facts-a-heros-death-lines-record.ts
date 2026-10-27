// ── THE FACTS A HERO'S DEATH LINES RECORD (plan P1-12d5: P1-12's Decisions of 2026-10-26, Decisions 2 and 6) ──
// The lines a hero's death writes (heroes/hero-death-and-leaderless-hosts.ts): the blow that misses a vanished hero,
// the surgeons who save a fallen one or come too late, a host fighting on under its senior captain, the dead hero's
// possessions passing on or lost, a Divine monarch's return or succession, the dead commander's host garrisoning,
// holding the sea, falling back or scattering, and the host a spared coward leaves behind (reportHeroFall,
// handleHeroDeath, disperseDeadCharArmies, abandonHostOnFlight). Each kind holds plain values: a name as the world holds
// it, a count, a flag, a roll and its chance, and the units or items a line names copied as it is told; the prose writes
// every word (src/views/prose/the-words-of-a-heros-deaths-lines.ts). The wanderer who slips the blow has his own kind
// (src/engine/the-facts-the-wanderers-escape-line-records.ts).
// Each is filed on its own, with the audience its event names (Decision 6: its event's); the surgeons' two lines are
// told inside a duel's narrative too (battle/pre-battle-duels.ts), where the saved one is the fight's and the late one
// is personal combat's kind for the fallen duellist's realm alone, which holds the same values.
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';
import type { AUnitAsDescribeArmyNamesIt } from '../dice-and-army-names.ts';

/** The surgeons' line when they come too late (the duel before a battle tells it to the fallen duellist's realm alone,
 *  as personal combat's kind for his realm alone, with the same values). */
export interface TheSurgeonsReachAFallenHeroTooLate {
  readonly kind: 'the surgeons reach a fallen hero too late';
  readonly heroName: string;
  /** Battlefield Surgery's chance, in percent, and the roll against it. */
  readonly chance: number;
  readonly roll: number;
}

/** What a line of a hero's death records. */
export type TheFactOfAHerosDeathsLine =
  | TheSurgeonsReachAFallenHeroTooLate
  | {
      kind: "the binding of a fallen hero's summoned units fails";
      heroName: string;
      units: AUnitAsDescribeArmyNamesIt[];
    }
  | {
      kind: "a fallen hero's armies scatter as mercenaries";
      heroName: string;
      /** Who slew him, as the death recorded it (a killer's name, or the cause a caller gave); null: not known. */
      slainBy: string | null;
      provinceName: string;
    }
  | {
      kind: "a fallen hero's armies garrison his realm's province";
      heroName: string;
      provinceName: string;
      slainBy: string | null;
    }
  | {
      kind: "a fallen hero's armies hold the open sea and claim it for his realm";
      heroName: string;
      provinceName: string;
      slainBy: string | null;
      /** The realm the water is claimed for, as the world names it; null: none (the prose says "the realm"). */
      realmName: string | null;
    }
  | {
      kind: "a fallen hero's leaderless armies retreat to his realm's ground";
      heroName: string;
      provinceName: string;
      slainBy: string | null;
    }
  | {
      kind: "a spared coward's host falls in under another commander";
      heroName: string;
      unitCount: number;
      provinceName: string;
      heirName: string;
    }
  | {
      kind: "a spared coward's host takes its place in the province's garrison";
      heroName: string;
      unitCount: number;
      provinceName: string;
    }
  | {
      kind: 'a spared coward slips away and leaves his host leaderless';
      heroName: string;
      unitCount: number;
      provinceName: string;
    }
  | { kind: "a hero is struck down at death's door but not slain"; heroName: string }
  | { kind: 'the blow meant for a vanished hero passes through shadow'; heroName: string }
  | {
      kind: 'Battlefield Surgery saves a fallen hero';
      heroName: string;
      isKing: boolean;
      /** Battlefield Surgery's chance, in percent, and the roll against it. */
      chance: number;
      roll: number;
    }
  | { kind: "a fallen commander's host fights on under its senior captain"; heroName: string; provinceName: string }
  | { kind: "a fallen hero's possessions pass on"; heroName: string; itemNames: string[]; recipientName: string }
  | { kind: "a hero takes a fallen foe's possessions"; recipientName: string; heroName: string; itemNames: string[] }
  | { kind: "a fallen hero's possessions are lost with no heir"; heroName: string }
  | { kind: 'a fallen Divine monarch will rise again on holy ground'; heroName: string }
  | { kind: 'a fallen Divine monarch has no holy ground to return to'; heroName: string };

/** Each kind's audience: its event's (a kind filed on its own; in a fight's narrative, the fight's). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_HEROS_DEATHS_LINE: Readonly<
  Record<TheFactOfAHerosDeathsLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'the surgeons reach a fallen hero too late': "its event's",
  "the binding of a fallen hero's summoned units fails": "its event's",
  "a fallen hero's armies scatter as mercenaries": "its event's",
  "a fallen hero's armies garrison his realm's province": "its event's",
  "a fallen hero's armies hold the open sea and claim it for his realm": "its event's",
  "a fallen hero's leaderless armies retreat to his realm's ground": "its event's",
  "a spared coward's host falls in under another commander": "its event's",
  "a spared coward's host takes its place in the province's garrison": "its event's",
  'a spared coward slips away and leaves his host leaderless': "its event's",
  "a hero is struck down at death's door but not slain": "its event's",
  'the blow meant for a vanished hero passes through shadow': "its event's",
  'Battlefield Surgery saves a fallen hero': "its event's",
  "a fallen commander's host fights on under its senior captain": "its event's",
  "a fallen hero's possessions pass on": "its event's",
  "a hero takes a fallen foe's possessions": "its event's",
  "a fallen hero's possessions are lost with no heir": "its event's",
  'a fallen Divine monarch will rise again on holy ground': "its event's",
  'a fallen Divine monarch has no holy ground to return to': "its event's",
};
