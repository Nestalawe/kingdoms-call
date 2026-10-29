// ── THE FACTS EARLY WINTER'S LINES RECORD (plan P1-12d16: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The lines of Early Winter's accounts (turn/early-winter-charms-fade-taxes-wages-raiders-muster-and-garrison-drill.ts):
// a Charm fading, the tax collection's heading, each realm's treasury and the taxes it collects (with each bonus), the
// wages' heading, the wages owed (with each discount), paid or not, a company or a ship disbanded unpaid, ships kept for
// the troops aboard, a hero deserting, Raiders' Muster, and a garrison's companies drilled a grade. Each kind holds plain
// values: a realm's, a hero's, a province's or a company's name as the world holds it (a company's null where it has
// none: the prose writes "A Green Spearmen"), a company's type and quality, sums of gold, counts, the title perks that
// add gold (each a record: the Cutpurse's, the Champion's, the Castellan's) and the companies drilled (each a record of
// its grade before and after). The prose writes every word (src/views/prose/the-words-of-early-winters-lines.ts). Each is
// filed on its own, with the audience its event names (its event's): no audience changes. Early Winter's safety net
// after the wages still hands a stranding at sea why the column is short as words (a stranding's facts: Parked).
import type { TheAudienceOfAKindOfLine } from './events-and-their-audiences.ts';

/** A title's perk that adds gold to a realm's taxes, as the tax line names it. */
export type ATitlesPerkOfGold =
  | { kind: "the Cutpurse's two gold" }
  | { kind: "the Champion of the People's two gold" }
  | { kind: "the Castellan's gold for every five provinces"; gold: number };

/** A garrison's company drilled a grade, as the drill's line names it. */
export interface AGarrisonCompanyDrilledAGrade {
  kind: 'a garrison company rises a grade';
  /** Its name as the world holds it (null for none: the prose writes "a Spearmen"), and its type. */
  unitName: string | null;
  unitType: string;
  /** Its quality before and after. */
  from: string;
  to: string;
}

/** A company as a line of the wages names it: its name (null for none), its type and its quality. */
export interface ACompanyAsTheWagesNameIt {
  unitName: string | null;
  unitType: string;
  quality: string;
}

/** What a line of Early Winter records. */
export type TheFactOfAnEarlyWintersLine =
  | {
      kind: "a hero's enchantment fades and he returns to his own lord";
      heroName: string;
    }
  | {
      kind: 'the tax collection begins';
    }
  | {
      kind: "a realm's treasury before the taxes";
      realmName: string;
      gold: number;
    }
  | {
      kind: 'a realm collects its taxes';
      realmName: string;
      /** Every gold collected, then each bonus the line names (none: no note). */
      collected: number;
      taxationRecords: number;
      merchantsLedger: number;
      neutralTrade: number;
      guildsInterest: number;
      consecratedGround: number;
      /** The title perks that add gold, in the order the realm's heroes hold them. */
      titlePerks: ATitlesPerkOfGold[];
      thiefNetwork: number;
    }
  | {
      kind: 'the wages are reckoned';
    }
  | {
      kind: 'a realm has no wages to pay';
      realmName: string;
    }
  | {
      kind: 'a realm owes its wages';
      realmName: string;
      wages: number;
      armyWages: number;
      heroWages: number;
      /** Each discount the line names (none: no note). */
      hostLeader: number;
      orcishWarSpoils: number;
      heroWageDiscounts: number;
      armyUpkeepDiscoveries: number;
    }
  | {
      kind: 'a realm pays its wages';
      realmName: string;
      wages: number;
      treasury: number;
    }
  | {
      kind: 'a realm cannot pay its wages';
      realmName: string;
      wages: number;
      available: number;
    }
  | ({
      kind: 'a ship disbands unpaid once the troops it carried are gone';
      realmName: string;
    } & ACompanyAsTheWagesNameIt)
  | ({
      kind: 'a company disbands unpaid';
      realmName: string;
    } & ACompanyAsTheWagesNameIt)
  | {
      kind: 'ships carrying troops at sea are kept at the oars unpaid';
      shipCount: number;
    }
  | {
      kind: "a hero abandons a realm's service unpaid";
      heroName: string;
      realmName: string;
    }
  | {
      kind: "a victory draws a company to a province's garrison at Raiders' Muster";
      provinceName: string;
      unitName: string;
      unitType: string;
      quality: string;
    }
  | {
      kind: "a province's garrison drills";
      provinceName: string;
      /** Each company that rose a grade, in the garrison's order. */
      drilled: AGarrisonCompanyDrilledAGrade[];
    };

/** Each kind's audience: its event's (each is filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_AN_EARLY_WINTERS_LINE: Readonly<
  Record<TheFactOfAnEarlyWintersLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  "a hero's enchantment fades and he returns to his own lord": "its event's",
  'the tax collection begins': "its event's",
  "a realm's treasury before the taxes": "its event's",
  'a realm collects its taxes': "its event's",
  'the wages are reckoned': "its event's",
  'a realm has no wages to pay': "its event's",
  'a realm owes its wages': "its event's",
  'a realm pays its wages': "its event's",
  'a realm cannot pay its wages': "its event's",
  'a ship disbands unpaid once the troops it carried are gone': "its event's",
  'a company disbands unpaid': "its event's",
  'ships carrying troops at sea are kept at the oars unpaid': "its event's",
  "a hero abandons a realm's service unpaid": "its event's",
  "a victory draws a company to a province's garrison at Raiders' Muster": "its event's",
  "a province's garrison drills": "its event's",
};
