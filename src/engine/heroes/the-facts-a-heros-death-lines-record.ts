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
// Since P1-12d11 (P1-12's Decisions of 2026-10-29, Choices 1 and 2): a hero slain outside a battle is one kind, the way
// he fell a value (`how`, one for each caller of reportHeroFall, in orders/, heroes/ and units/), told where its caller
// tells it (its event's); and who slew a hero is a record, not words (TheOneWhoSlewAHero: handleHeroDeath keeps it on
// the dead hero as `_slainBy`, and his host's lines hold it), so a lair's guardian is its name and its province.
// Since P1-12d12: the note of how a hero carries a fallen foe's possessions he takes is a kind too, holding
// gainedItemNote's words (the items' area: a later slice), listed by the static test.
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

/** Who slew a hero, as his host's lines name him: the killer's name, or a lair's guardian (its name; null: it has none)
 *  and the province of its lair. handleHeroDeath keeps it on the dead hero (`_slainBy`) until his host is told. */
export type TheOneWhoSlewAHero =
  { readonly killerName: string } | { readonly guardianName: string | null; readonly provinceName: string };

/** How a hero is slain outside a battle: one way for each caller of reportHeroFall (a slug the prose reads). */
export type HowAHeroIsSlainOutsideABattle =
  | 'at the end of the chase'
  | 'run down in the chase'
  | 'in the ambush he laid'
  | 'in the ambush'
  | "a thief's end"
  | 'by the cornered thief'
  | "by an assassin's blade"
  | 'by the enchanter he turned on'
  | 'by his failed Charm'
  | 'in the duel'
  | 'by the shot'
  | "by a lair's guardian";

/** A hero slain outside a battle (reportHeroFall's line when he really dies), told where its caller tells it. */
export interface AHeroIsSlainOutsideABattle {
  readonly kind: 'a hero is slain outside a battle';
  readonly heroName: string;
  readonly how: HowAHeroIsSlainOutsideABattle;
  /** The assassin's name, or the lair guardian's (null: it has none, the prose says "creature"); null where the line
   *  names no killer. */
  readonly killerName: string | null;
}

/** What a line of a hero's death records. */
export type TheFactOfAHerosDeathsLine =
  | AHeroIsSlainOutsideABattle
  | TheSurgeonsReachAFallenHeroTooLate
  | {
      kind: "the binding of a fallen hero's summoned units fails";
      heroName: string;
      units: AUnitAsDescribeArmyNamesIt[];
    }
  | {
      kind: "a fallen hero's armies scatter as mercenaries";
      heroName: string;
      /** Who slew him, as the death recorded it (a killer's name, or a lair's guardian); null: not known. */
      slainBy: TheOneWhoSlewAHero | null;
      provinceName: string;
    }
  | {
      kind: "a fallen hero's armies garrison his realm's province";
      heroName: string;
      provinceName: string;
      slainBy: TheOneWhoSlewAHero | null;
    }
  | {
      kind: "a fallen hero's armies hold the open sea and claim it for his realm";
      heroName: string;
      provinceName: string;
      slainBy: TheOneWhoSlewAHero | null;
      /** The realm the water is claimed for, as the world names it; null: none (the prose says "the realm"). */
      realmName: string | null;
    }
  | {
      kind: "a fallen hero's leaderless armies retreat to his realm's ground";
      heroName: string;
      provinceName: string;
      slainBy: TheOneWhoSlewAHero | null;
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
  | {
      kind: "a hero notes how he carries a fallen foe's possessions";
      /** gainedItemNote's words (the items' area: a later slice). */
      gainedItemNote: string;
    }
  | { kind: "a fallen hero's possessions are lost with no heir"; heroName: string }
  | { kind: 'a fallen Divine monarch will rise again on holy ground'; heroName: string }
  | { kind: 'a fallen Divine monarch has no holy ground to return to'; heroName: string };

/** Each kind's audience: its event's (a kind filed on its own; in a fight's narrative, the fight's). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_HEROS_DEATHS_LINE: Readonly<
  Record<TheFactOfAHerosDeathsLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'the surgeons reach a fallen hero too late': "its event's",
  'a hero is slain outside a battle': "its event's",
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
  "a hero notes how he carries a fallen foe's possessions": "its event's",
  "a fallen hero's possessions are lost with no heir": "its event's",
  'a fallen Divine monarch will rise again on holy ground': "its event's",
  'a fallen Divine monarch has no holy ground to return to': "its event's",
};
