// ── THE FACTS THE RECRUIT AND HIRE ORDERS' LINES RECORD (plan P1-12d6: P1-12's Decisions of 2026-10-26, Decisions 2,
// 6 and 7) ──
// The lines the Recruit Armies and Hire Hero orders write (orders/recruit-and-hire-orders-companies-mercenaries-and-
// heroes.ts): the companies raised (where they muster, and why any were not raised), the mercenary bands hired or
// refused, a beast that a full column cannot take, a hero sworn (or why not), and the orders his hirer laid down for
// him. Each kind holds plain values: a name as the world or the content holds it, a count, a cost, a flag, why a
// company was not raised and where companies muster as records of their values, the companies raised and a hero's
// skills copied as the line is told, and a commander's beast command as its line tells it (copied:
// theBeastCommandAsALineTellsIt, world/tables.ts); the prose writes every word (src/views/prose/the-words-of-the-
// recruit-and-hire-orders-lines.ts). Each is filed on its own, with the audience its event names (Decision 6: its
// event's).
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';
import type { ABeastCommandAsALineTellsIt } from '../world/tables.ts';

/** Companies raised of one type, as the line counts them. */
export interface CompaniesRaisedAsTheLineCountsThem {
  readonly count: number;
  readonly type: string;
}

/** Why a company the order named was not raised. */
export type WhyACompanyWasNotRaised =
  | { kind: 'a sea beast can be summoned only in a sea province'; type: string }
  | { kind: 'the province does not raise the unit'; type: string; provinceName: string }
  | { kind: 'the unit was already recruited this turn'; type: string }
  | {
      kind: 'the treasury cannot pay for the unit';
      type: string;
      /** The gold its companies would cost. */
      cost: number;
    };

/** Where the companies raised muster, when the order named somewhere other than the recruiter's own column. */
export type WhereTheCompaniesMuster =
  | { kind: 'the companies muster straight into the garrison'; provinceName: string }
  | { kind: "the garrison is not the realm's to muster into" }
  | { kind: "the companies muster under a comrade's banner"; heroName: string }
  | { kind: 'the comrade named to receive the companies is not here' };

/** What a line of the recruit and hire orders records. */
export type TheFactOfTheRecruitAndHireOrdersLine =
  | {
      kind: 'a hired hero takes up the orders his hirer laid down';
      heroName: string;
      realmName: string;
      /** The phases of this turn still to be acted on. */
      phasesLeft: number;
    }
  | {
      kind: 'a beast a full column cannot take musters into the garrison';
      beastCommand: ABeastCommandAsALineTellsIt;
      /** The unit's name (null: none; the prose names its type). */
      unitName: string | null;
      unitType: string;
      provinceName: string;
    }
  | {
      kind: 'mercenary beasts are not hired into a full column';
      beastCommand: ABeastCommandAsALineTellsIt;
      /** The band's name (null: none; the prose names its type). */
      mercenaryName: string | null;
      mercenaryType: string;
    }
  | {
      kind: 'a hero cannot afford a mercenary band';
      heroName: string;
      mercenaryName: string | null;
      mercenaryType: string;
      cost: number;
    }
  | {
      kind: 'a hero hires a mercenary band';
      heroName: string;
      mercenaryName: string | null;
      mercenaryType: string;
      quality: string;
      /** What he paid, and what the band costs before a Neutral realm's discount. */
      cost: number;
      baseCost: number;
    }
  | { kind: 'a hero cannot recruit in a province his realm does not hold'; heroName: string; provinceName: string }
  | {
      kind: 'a hero recruits companies';
      heroName: string;
      recruited: CompaniesRaisedAsTheLineCountsThem[];
      provinceName: string;
      /** Where they muster (null: his own column). */
      destination: WhereTheCompaniesMuster | null;
      /** The garrison units that mustered straight into the garrison rather than a column. */
      autoGarrisoned: number;
      cost: number;
      /** The realm's gold after it is paid. */
      treasury: number;
      blocked: WhyACompanyWasNotRaised[];
    }
  | {
      kind: "companies muster to a comrade's banner";
      recruited: CompaniesRaisedAsTheLineCountsThem[];
      recipientName: string;
      provinceName: string;
      heroName: string;
    }
  | {
      kind: "a hero's recruitment is entirely blocked";
      heroName: string;
      provinceName: string;
      blocked: WhyACompanyWasNotRaised[];
    }
  | { kind: 'no hero of that description is to be hired here'; heroName: string; provinceName: string }
  | { kind: "a neutral province's guardian cannot be hired away"; guardianName: string; provinceName: string }
  | { kind: 'a hero driven from his home refuses to be hired this turn'; heroName: string }
  | { kind: 'a hero just released from service hears no offers this turn'; heroName: string }
  | {
      kind: 'a hero recoils from a hire across the gulf between Divine and Undead';
      heroName: string;
      alignment: string;
      hirerName: string;
      /** The hiring realm is Divine (else Undead). */
      realmIsDivine: boolean;
    }
  | {
      kind: 'a hero cannot afford to hire another';
      heroName: string;
      hiredName: string;
      wage: number;
      treasury: number;
    }
  | {
      kind: 'a hero agrees to serve the realm';
      heroName: string;
      race: string;
      alignment: string;
      realmName: string;
      wage: number;
      /** The steps between his alignment and the realm's. */
      alignmentSteps: number;
      /** His skills above 0, each its slug and level, copied as the line is told. */
      skills: [skill: string, level: number][];
      /** The season he may act from, as the turn names it (null: none this turn; the prose says "next turn"). */
      seasonTheyMayActFrom: string | null;
    };

/** Each kind's audience: its event's (a kind filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_THE_RECRUIT_AND_HIRE_ORDERS_LINE: Readonly<
  Record<TheFactOfTheRecruitAndHireOrdersLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'a hired hero takes up the orders his hirer laid down': "its event's",
  'a beast a full column cannot take musters into the garrison': "its event's",
  'mercenary beasts are not hired into a full column': "its event's",
  'a hero cannot afford a mercenary band': "its event's",
  'a hero hires a mercenary band': "its event's",
  'a hero cannot recruit in a province his realm does not hold': "its event's",
  'a hero recruits companies': "its event's",
  "companies muster to a comrade's banner": "its event's",
  "a hero's recruitment is entirely blocked": "its event's",
  'no hero of that description is to be hired here': "its event's",
  "a neutral province's guardian cannot be hired away": "its event's",
  'a hero driven from his home refuses to be hired this turn': "its event's",
  'a hero just released from service hears no offers this turn': "its event's",
  'a hero recoils from a hire across the gulf between Divine and Undead': "its event's",
  'a hero cannot afford to hire another': "its event's",
  'a hero agrees to serve the realm': "its event's",
};
