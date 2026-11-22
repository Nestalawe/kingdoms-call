// ── THE FACTS THE TITLE INTELLIGENCE LINES RECORD (plan P1-12d13: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The lines the title intelligence writes at the turn's end (titles/title-intel-for-each-holder-and-the-titles-won-
// and-lost-this-turn.ts, imperialTitleIntelEachHoldersReportOnRivalRealmsAndTheLoremastersCopy): what each title tells
// the realm holding it of itself and of the realms it has met (the Throne's tax shares, the Vaultkeeper's treasuries,
// the Grand Marshal's armies, the Sea Lord's fleets, the Monster-Bane's champions, the Loremaster's libraries and his
// copy, the Archmage's mages, the Hierophant's dead, the Deathpriest's Grave-sight, the Spymaster's ledger, the
// Cartographer's atlases, the Beastlord's and the Wildwarden's hosts), and the line for the realms it hasn't met. Each
// kind holds plain values: a hero's, a province's or a discovery's name as the world holds it (null where the world has
// none: the prose writes "unknown", "?" or "an unknown agent"), a realm as the line names it (its name, or null, and its
// seat: the prose writes "Player 3"; null for the holder's own realm where the line says "Your realm"), a count, a
// figure, a flag, a title's key and a school's slug (the prose writes the title's and the school's words), and the lists
// a line names (copied as the line is told). One field holds words still: what an agent did, as the Spymaster's ledger
// stores it (turnContext's G._espionageLedger, written by noteEspionage, titles/perks.ts: the saved game's words, a
// later slice). The prose writes every other word, the title's bracketed name first, which the player page groups the
// lines by (src/views/prose/the-words-of-the-title-intelligence-lines.ts). Each is filed on its own, with the audience
// its event names (its event's: the holder's realm alone): no audience changes.
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';
import type {
  ARealmATitlesLineNames,
  TheFactOfALineOfABoardOfRivalRealms,
} from '../rules/the-imperial-titles/the-boards-of-the-titles-that-read-each-rival-realm-and-the-facts-their-lines-record.ts';

export type { ARealmATitlesLineNames };

/** A title whose holder is told of the realms his crown has not met, by its key in the standings. */
export type ATitleThatCountsTheRealmsNotMet =
  'throne' | 'vault' | 'marshal' | 'sea' | 'monster' | 'lore' | 'arch' | 'carto' | 'beast' | 'wild';

/** A magic school the Archmage reads, by its slug. */
export type ASchoolTheArchmageReads = 'white' | 'psychic' | 'illusory' | 'elemental' | 'necromancy';

/** A realm's strongest army or fleet: its commander, where he stands (null: nowhere the world names), its strength. */
export interface AStrongestForceATitlesLineNames {
  commanderName: string;
  provinceName: string | null;
  strength: number;
}

/** A realm's foremost monster-slayer, where he stands (null: nowhere the world names), and his tally. */
export interface AChampionATitlesLineNames {
  heroName: string;
  provinceName: string | null;
  monsterBlood: number;
}

/** What a line of the title intelligence records (the boards of the titles that read each rival realm as a whole, the
 *  Throne's, the Vaultkeeper's, the Cartographer's, the Beastlord's and the Wildwarden's, record the kinds their
 *  effects' file declares: B-06o). */
export type TheFactOfATitleIntelligenceLine =
  | TheFactOfALineOfABoardOfRivalRealms
  | {
      kind: "a title's holder learns how many realms his crown has not met";
      title: ATitleThatCountsTheRealmsNotMet;
      count: number;
    }
  | {
      kind: "the Grand Marshal's holder learns his realm's strongest land army";
      /** Null: no land army in the field. */
      army: AStrongestForceATitlesLineNames | null;
    }
  | {
      kind: "the Grand Marshal's holder learns a rival's strongest land army";
      realm: ARealmATitlesLineNames;
      army: AStrongestForceATitlesLineNames;
    }
  | { kind: "the Grand Marshal's holder learns no rival fields a land army" }
  | {
      kind: "the Sea Lord's holder learns his realm's strongest fleet";
      /** Null: no fleet at sea. */
      fleet: AStrongestForceATitlesLineNames | null;
    }
  | {
      kind: "the Sea Lord's holder learns a rival's strongest fleet";
      realm: ARealmATitlesLineNames;
      fleet: AStrongestForceATitlesLineNames;
    }
  | { kind: "the Sea Lord's holder learns no rival fields a fleet" }
  | {
      kind: "the Monster-Bane's holder learns his realm's champion";
      /** Null: no hero of his has drawn monster-blood. */
      champion: AChampionATitlesLineNames | null;
    }
  | {
      kind: "the Monster-Bane's holder learns a rival's champion";
      realm: ARealmATitlesLineNames;
      champion: AChampionATitlesLineNames;
    }
  | { kind: "the Monster-Bane's holder learns no rival's hero has drawn monster-blood" }
  | {
      kind: "the Loremaster's holder learns a rival's discoveries";
      realm: ARealmATitlesLineNames;
      /** Each discovery's name as the world holds it, in the rival's order (at least one). */
      discoveries: readonly string[];
    }
  | { kind: "the Loremaster's holder learns a rival holds no discoveries"; realm: ARealmATitlesLineNames }
  | { kind: "the Loremaster's holder learns no rival has learned anything worth copying" }
  | { kind: "the Loremaster's scholars copy a rival's fresh discovery"; discoveryName: string }
  | {
      kind: "the Archmage's holder learns a school's foremost mage outside his realm";
      school: ASchoolTheArchmageReads;
      heroName: string;
      level: number;
      /** Null: a hero who serves no realm (the prose says he guards his province). */
      realm: ARealmATitlesLineNames | null;
      provinceName: string | null;
    }
  | { kind: "the Archmage's holder learns of no mage of a school outside his realm"; school: ASchoolTheArchmageReads }
  | {
      kind: "the Hierophant's holder hears what a fallen hero knew";
      heroName: string;
      /** Null: a hero who served no realm. */
      realm: ARealmATitlesLineNames | null;
      isKing: boolean;
      provinceName: string | null;
      /** Each skill he carried (above 0), highest first, by its slug, with its level. */
      skills: readonly { skill: string; level: number }[];
    }
  | { kind: "the Hierophant's holder finds no fallen hero to read" }
  | {
      kind: "the Deathpriest's Grave-sight finds crack and elite dead in a province";
      provinceName: string | null;
      count: number;
    }
  | { kind: "the Deathpriest's Grave-sight finds no crack or elite dead" }
  | {
      kind: "the Spymaster's holder learns of an act of espionage against his lands";
      agentIsKing: boolean;
      /** Null: the ledger names none (the prose writes "an unknown agent"). */
      agentName: string | null;
      /** Null: an agent sworn to no crown. */
      agentsRealm: ARealmATitlesLineNames | null;
      /** What the agent did, as the Spymaster's ledger stores it ("spied out the province"): the saved game's words. */
      whatTheAgentDid: string;
      provinceName: string | null;
    }
  | {
      kind: "the Spymaster's holder learns who intruded into his lands this turn";
      intrusions: number;
      /** Each hero who intruded, most acts first: his name (null: none the ledger names), his realm, how often. */
      heroes: readonly { heroName: string | null; realm: ARealmATitlesLineNames | null; times: number }[];
    }
  | { kind: "the Spymaster's holder learns no hand was raised against his lands" };

/** Each kind's audience: its event's (each is filed on its own, for the holder's realm). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_TITLE_INTELLIGENCE_LINE: Readonly<
  Record<TheFactOfATitleIntelligenceLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  "a title's holder learns how many realms his crown has not met": "its event's",
  "the Throne's holder learns his realm's share of the world tax base": "its event's",
  "the Throne's holder learns a rival's share of the world tax base": "its event's",
  "the Vaultkeeper's holder learns his realm's treasury": "its event's",
  "the Vaultkeeper's holder learns a rival's treasury": "its event's",
  "the Grand Marshal's holder learns his realm's strongest land army": "its event's",
  "the Grand Marshal's holder learns a rival's strongest land army": "its event's",
  "the Grand Marshal's holder learns no rival fields a land army": "its event's",
  "the Sea Lord's holder learns his realm's strongest fleet": "its event's",
  "the Sea Lord's holder learns a rival's strongest fleet": "its event's",
  "the Sea Lord's holder learns no rival fields a fleet": "its event's",
  "the Monster-Bane's holder learns his realm's champion": "its event's",
  "the Monster-Bane's holder learns a rival's champion": "its event's",
  "the Monster-Bane's holder learns no rival's hero has drawn monster-blood": "its event's",
  "the Loremaster's holder learns a rival's discoveries": "its event's",
  "the Loremaster's holder learns a rival holds no discoveries": "its event's",
  "the Loremaster's holder learns no rival has learned anything worth copying": "its event's",
  "the Loremaster's scholars copy a rival's fresh discovery": "its event's",
  "the Archmage's holder learns a school's foremost mage outside his realm": "its event's",
  "the Archmage's holder learns of no mage of a school outside his realm": "its event's",
  "the Hierophant's holder hears what a fallen hero knew": "its event's",
  "the Hierophant's holder finds no fallen hero to read": "its event's",
  "the Deathpriest's Grave-sight finds crack and elite dead in a province": "its event's",
  "the Deathpriest's Grave-sight finds no crack or elite dead": "its event's",
  "the Spymaster's holder learns of an act of espionage against his lands": "its event's",
  "the Spymaster's holder learns who intruded into his lands this turn": "its event's",
  "the Spymaster's holder learns no hand was raised against his lands": "its event's",
  "the Cartographer's holder learns his realm's atlas": "its event's",
  "the Cartographer's holder learns a rival's atlas": "its event's",
  "the Cartographer's holder finds no rival realm to survey": "its event's",
  "the Beastlord's holder learns a realm has no monsters under arms": "its event's",
  "the Beastlord's holder learns a realm's monsters under arms": "its event's",
  "the Beastlord's holder finds no rival realm to reckon": "its event's",
  "the Wildwarden's holder learns the wild answers to no one in a realm": "its event's",
  "the Wildwarden's holder learns a realm's creatures in the field": "its event's",
  "the Wildwarden's holder finds no rival realm to reckon": "its event's",
};
