// ── THE WORDS OF EARLY WINTER'S LINES (plan P1-12d16: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The views write the words of each fact Early Winter's lines record (src/engine/turn/the-facts-early-winters-lines-
// record.ts), in the same words the engine wrote before (turn/early-winter-charms-fade-taxes-wages-raiders-muster-and-
// garrison-drill.ts): the taxes with each bonus that adds gold, the wages with each discount after them, a company by its
// name and type or "A Green Spearmen", the companies drilled joined with semicolons, and the plurals from the counts. A
// kind with no words here is a compile error (the `never` below).
import type {
  ACompanyAsTheWagesNameIt,
  AGarrisonCompanyDrilledAGrade,
  ATitlesPerkOfGold,
  TheFactOfAnEarlyWintersLine,
} from '../../engine/turn/the-facts-early-winters-lines-record.ts';

/** A title's perk of gold, as the tax line notes it: " (+2g the Cutpurse)". */
function aTitlesPerkOfGold(perk: ATitlesPerkOfGold): string {
  switch (perk.kind) {
    case "the Cutpurse's two gold":
      return ` (+2g the Cutpurse)`;
    case "the Champion of the People's two gold":
      return ` (+2g Champion of the People)`;
    case "the Castellan's gold for every five provinces":
      return ` (+${String(perk.gold)}g the Castellan)`;
    default: {
      const aKindWithNoWords: never = perk;
      throw new Error(`the tax line has no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}

/** A company disbanded, as the wages' line names it: "Iron Wall (Spearmen)", or "A Green Spearmen". */
function aCompanyDisbanded(company: ACompanyAsTheWagesNameIt): string {
  return company.unitName !== null
    ? company.unitName + ' (' + company.unitType + ')'
    : 'A ' + company.quality + ' ' + company.unitType;
}

/** A garrison's company drilled, as the drill's line names it: "Iron Wall (Spearmen) Green → **Average**". */
function aCompanyDrilled(company: AGarrisonCompanyDrilledAGrade): string {
  return `${company.unitName !== null ? `${company.unitName} (${company.unitType})` : `a ${company.unitType}`} ${company.from} → **${company.to}**`;
}

/** The words of one fact of Early Winter's lines. */
export function theWordsOfAnEarlyWintersLine(fact: TheFactOfAnEarlyWintersLine): string {
  switch (fact.kind) {
    case "a hero's enchantment fades and he returns to his own lord":
      return `As the season turns, the enchantment on ${fact.heroName} fades and they return to their own lord.`;
    case 'the tax collection begins':
      return '═ Tax collection ═';
    case "a realm's treasury before the taxes":
      return `${fact.realmName} has ${String(fact.gold)}g in the treasury.`;
    case 'a realm collects its taxes':
      return `${fact.realmName} collects ${String(fact.collected)}g in taxes${fact.taxationRecords > 0 ? ` (+${String(fact.taxationRecords)}g Taxation Records)` : ''}${fact.merchantsLedger > 0 ? ` (+${String(fact.merchantsLedger)}g Merchant's Ledger)` : ''}${fact.neutralTrade > 0 ? ` (+${String(fact.neutralTrade)}g Neutral trade bonus)` : ''}${fact.guildsInterest > 0 ? ` (+${String(fact.guildsInterest)}g Merchant Guilds interest)` : ''}${fact.consecratedGround > 0 ? ` (+${String(fact.consecratedGround)}g from consecrated ground)` : ''}${fact.titlePerks.map(aTitlesPerkOfGold).join('')}${fact.thiefNetwork > 0 ? ` (+${String(fact.thiefNetwork)}g Thief network)` : ''}.`;
    case 'the wages are reckoned':
      return '═ Army wages & hero wages ═';
    case 'a realm has no wages to pay':
      return `${fact.realmName}: no wages to pay.`;
    case 'a realm owes its wages': {
      const notes = [
        fact.hostLeader > 0 ? `−${String(fact.hostLeader)}g the Host-Leader` : '',
        fact.orcishWarSpoils > 0 ? `−${String(fact.orcishWarSpoils)}g Orcish war-spoils` : '',
        fact.heroWageDiscounts > 0 ? `−${String(fact.heroWageDiscounts)}g hero wage discounts` : '',
        fact.armyUpkeepDiscoveries > 0 ? `−${String(fact.armyUpkeepDiscoveries)}g army upkeep discoveries` : '',
      ].filter(Boolean);
      return `${fact.realmName} owes ${String(fact.wages)}g wages (armies: ${String(fact.armyWages)}g, heroes: ${String(fact.heroWages)}g)${notes.length ? ` — after ${notes.join(', ')}` : ''}.`;
    }
    case 'a realm pays its wages':
      return `${fact.realmName} pays ${String(fact.wages)}g in wages. Treasury: ${String(fact.treasury)}g remaining.`;
    case 'a realm cannot pay its wages':
      return `⚠ ${fact.realmName} cannot pay ${String(fact.wages)}g wages! Only ${String(fact.available)}g available. The rawest troops melt away first — the greenest companies anywhere in the realm, garrison or field alike — then better men as the shortfall bites. The skeletal dead ask for nothing and are the last to go. Heroes may desert.`;
    case 'a ship disbands unpaid once the troops it carried are gone':
      return `${aCompanyDisbanded(fact)} disbands — ${fact.realmName} could not pay their wages, and with the troops aboard gone the ship is no longer needed to carry them.`;
    case 'a company disbands unpaid':
      return `${aCompanyDisbanded(fact)} disbands — ${fact.realmName} could not pay their wages.`;
    case 'ships carrying troops at sea are kept at the oars unpaid': {
      const many = fact.shipCount !== 1;
      return `⚓ ${String(fact.shipCount)} ship${many ? 's' : ''} carrying troops at sea ${many ? 'are' : 'is'} kept at the oars unpaid — disbanding ${many ? 'them' : 'it'} would leave the men aboard stranded.`;
    }
    case "a hero abandons a realm's service unpaid":
      return `${fact.heroName} abandons ${fact.realmName}'s service, unpaid and disillusioned.`;
    case "a victory draws a company to a province's garrison at Raiders' Muster":
      return `🥁 Raiders' Muster — word of the victory at ${fact.provinceName} draws ${fact.unitName} (${fact.unitType}, ${fact.quality}) to its garrison for nothing.`;
    case "a province's garrison drills":
      return `🎖 Garrison drills in ${fact.provinceName}: ${fact.drilled.map(aCompanyDrilled).join('; ')}.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`Early Winter's lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
