// ── THE WORDS OF THE ESPIONAGE ORDERS' LINES (plan P1-12d8: P1-12's Decisions of 2026-10-26, Decisions 6 and 7) ──
// The views write the words of each fact the espionage orders' lines record (src/engine/orders/the-facts-the-
// espionage-orders-lines-record.ts), in the same words the engine wrote before (orders/espionage-orders-spy-steal-
// sabotage-grand-heist-assassinate-and-vanish.ts). The skills' names, fmtRoll and describeArmy are the engine's, and
// so are the words of a rival's skill and of the odds as a realm is shown them (theWordsOfAStatShown,
// theWordsOfTheOddsShown, heroes/effective-skills-and-hidden-heroes.ts). A kind with no words here is a compile error
// (the `never` below).
import type {
  TheFactOfTheEspionageOrdersLine,
  TheHaulOfAGrandHeist,
  WhatAThiefWasCaughtAt,
} from '../../engine/orders/the-facts-the-espionage-orders-lines-record.ts';
import { SKILL_LABELS } from '../../engine/army-tables.ts';
import { describeArmy, fmtRoll } from '../../engine/dice-and-army-names.ts';
import {
  theWordsOfAStatShown,
  theWordsOfTheOddsShown,
} from '../../engine/heroes/effective-skills-and-hidden-heroes.ts';
import { theWordsInATableFor } from './the-words-of-the-order-dispatchs-lines.ts';

/** What a thief was caught at: "spying on them", "with a hand in their strongbox", "breaking into the vaults of …". */
function whatAThiefWasCaughtAt(caughtAt: WhatAThiefWasCaughtAt): string {
  switch (caughtAt.kind) {
    case 'caught spying on a hero':
      return 'spying on them';
    case "caught with a hand in a hero's strongbox or pack":
      return `with a hand in their ${caughtAt.forTheGold ? 'strongbox' : 'pack'}`;
    case 'caught breaking into the vaults of a province':
      return `breaking into the vaults of ${caughtAt.provinceName}`;
    default: {
      const unknown: never = caughtAt;
      return unknown;
    }
  }
}

/** A spy's roll: "automatic success (Crystal Orb)", else the chance and the roll. */
function aSpysRoll(fact: {
  theSuccessIsCertain: boolean;
  byTheCrystalOrb: boolean;
  chance: number;
  roll: number;
}): string {
  return fact.theSuccessIsCertain
    ? `automatic success (${fact.byTheCrystalOrb ? 'Crystal Orb' : 'Master Spy'})`
    : fmtRoll(fact.chance, fact.roll);
}

/** A Grand Heist's haul, its parts joined: the gold lifted, and the courier's item or that none was on the road. */
function theHaul(haul: TheHaulOfAGrandHeist): string {
  const parts: string[] = [];
  if (haul.gold > 0) parts.push(`${String(haul.gold)}g lifted from the vaults`);
  if (haul.courierItemName !== null) parts.push(`the ${haul.courierItemName} cut from a courier's satchel on the road`);
  else parts.push(`though no courier of theirs was on the road to waylay`);
  return parts.join(' — and ');
}

/** The words of one fact of the espionage orders' lines. */
export function theWordsOfTheEspionageOrdersLine(fact: TheFactOfTheEspionageOrdersLine): string {
  switch (fact.kind) {
    case 'a thief has already melted into the shadows when the alarm is raised':
      return `${fact.victimName} raises the alarm, but ${fact.thiefName} has already melted into the shadows. (Vanish)`;
    case 'a victim who wants no brawl drives a caught thief off':
      return `${fact.victimName} catches ${fact.thiefName} ${whatAThiefWasCaughtAt(fact.caughtAt)}, but wants no part in a brawl — the thief is driven off empty-handed.`;
    case 'a victim catches a thief and blades are drawn':
      return `⚔ ${fact.victimName} catches ${fact.thiefName} ${whatAThiefWasCaughtAt(fact.caughtAt)} — blades are drawn!`;
    case 'a spy finds no quarry to spy on':
      return `${fact.heroName} looks for ${fact.quarryName ?? 'their quarry'} in ${fact.provinceName}, but they are not to be found here — the spying comes to nothing.`;
    case 'a spy cannot fix on a cloaked face':
      return `${fact.heroName} shadows ${fact.targetName} through ${fact.provinceName}, but can never quite fix on a face — nothing is learned. (Cloak of Many Faces)`;
    case "a spy's roll to read a hero":
      return `📊 Spy on ${fact.targetName} — ${fact.heroName} (Spy ${String(fact.spyLevel)}) in ${fact.provinceName}: ${aSpysRoll(fact)}`;
    case "a spy's report on a hero": {
      const _sk =
        fact.skills.map(([k, v]) => `${theWordsInATableFor(SKILL_LABELS, k) ?? k} ${String(v)}`).join(', ') ||
        'no skills to speak of';
      const _it = fact.itemNames.join(', ') || 'no magic items';
      const _ar = fact.units.length ? describeArmy(fact.units) : 'no armies';
      return `[Intelligence] 🔍 ${fact.heroName}'s report on ${fact.targetName}${fact.targetsRealmName !== null ? ` of ${fact.targetsRealmName}` : ''} (${fact.race ?? '?'}, ${fact.alignment ?? '?'}${fact.isKing ? ', king' : ''}): skills — ${_sk}. Items — ${_it}. Leads — ${_ar}.`;
    }
    case 'a spy learns nothing of a hero':
      return `${fact.heroName} watches ${fact.targetName} closely in ${fact.provinceName}, but learns nothing of use.`;
    case "a hero's chance to notice a spy":
      return `📊 Detection — ${fact.targetName}${theWordsOfAStatShown(fact.targetsSpy)} noticing ${fact.heroName}${fact.inTheirOwnLand ? ' in their own land' : fact.inYourLand ? ' in your land' : ''}: ${theWordsOfTheOddsShown(fact.odds)}`;
    case 'a realm learns a spy was caught on its hero':
      return `[Intelligence] ${fact.spyName}${fact.spysRealmName !== null ? ` (${fact.spysRealmName})` : ''} was caught spying on ${fact.targetName} in ${fact.provinceName}.`;
    case 'a spy slips away unseen as The Shadow':
      return `${fact.heroName} slips away unseen. (The Shadow)`;
    case "a spy's roll to spy out a province":
      return `📊 Spy — ${fact.heroName} (Spy ${String(fact.spyLevel)}) in ${fact.provinceName}: ${aSpysRoll(fact)}`;
    case "a spy's disguise is put to the test":
      return `📊 Disguise Techniques — ${fact.heroName} works under a false face in ${fact.provinceName}: ${fmtRoll(fact.chance, fact.roll)} — ${fact.theDisguiseHolds ? 'the disguise holds; no alarm is raised.' : 'the disguise slips; the province’s watch will report the intrusion.'}`;
    case "a spy's espionage in a province yields little":
      return `${fact.heroName}'s espionage in ${fact.provinceName} yields little — the attempt went undetected but nothing useful was learned.`;
    case 'a hero with no Thief skill cannot steal':
      return `${fact.heroName} has no Thief skill — light fingers take training.`;
    case 'a thief finds no enemy paymaster to rob':
      return `${fact.heroName} finds no enemy paymaster to rob in ${fact.provinceName} — it needs a rival's garrison standing here.`;
    case "a thief's roll to rob a garrison's paymaster":
      return `📊 Steal — ${fact.heroName} (Thief ${String(fact.thiefLevel)}) goes for the garrison paymaster of ${fact.provinceName} (${String(fact.garrisonUnits)} unit${fact.garrisonUnits !== 1 ? 's' : ''}, guarded — halved): ${fmtRoll(fact.chance, fact.roll)}`;
    case "a thief lifts gold from a garrison's paymaster":
      return `💰 ${fact.heroName} lifts ${String(fact.gold)}g from the garrison paymaster's strongbox in ${fact.provinceName}.`;
    case "a realm learns its garrison's paymaster was robbed":
      return `[Intelligence] The garrison paymaster of ${fact.provinceName} was robbed of ${String(fact.gold)}g — ${fact.thiefName} (${fact.thiefsRealmName}) is suspected.`;
    case "a thief is caught and beaten back by a garrison's guards":
      return `${fact.heroName} is caught by the garrison guards of ${fact.provinceName} and beaten back — ${String(fact.damage)} damage taken.`;
    case "a realm learns a thief was caught at its garrison's paymaster":
      return `[Intelligence] ${fact.thiefName} (${fact.thiefsRealmName}) was caught trying to rob the garrison paymaster of ${fact.provinceName}.`;
    case "a thief's attempt on a paymaster fails unnoticed":
      return `${fact.heroName}'s attempt on the paymaster of ${fact.provinceName} fails, but the thief slips away unnoticed.`;
    case 'a thief finds no target to steal from':
      return `${fact.heroName} finds no suitable target to steal from in ${fact.provinceName}.`;
    case 'a thief will not rob a comrade':
      return `${fact.heroName} will not rob a comrade.`;
    case "a thief reaches for a vanished hero's purse":
      return `${fact.heroName} reaches for ${fact.victimName}'s purse and closes on nothing — the man has vanished.`;
    case 'a thief finds nothing worth stealing on a hero':
      return `${fact.heroName} finds ${fact.victimName} carries no purse worth the risk and no magic to lift.`;
    case "a thief's roll to rob a hero":
      return `📊 Steal — ${fact.heroName} (Thief ${String(fact.thiefLevel)}) targets ${fact.victimName} (${fact.forTheGold ? 'gold' : 'a magic item'}): ${fmtRoll(fact.chance, fact.roll)}${fact.theTargetLeadsArmies ? ' (halved — target leads armies)' : ''}`;
    case "a thief picks a hero's empty purse":
      return `${fact.heroName} picks ${fact.victimName}'s purse — and finds it empty.`;
    case "a thief lifts gold from a hero's strongbox":
      return `💰 ${fact.heroName} deftly lifts ${String(fact.gold)}g from ${fact.victimName}'s strongbox (5% of the realm's treasury).`;
    case 'a realm learns a thief stole its gold':
      return `[Intelligence] ${fact.thiefName} (${fact.thiefsRealmName}) has stolen ${String(fact.gold)}g from ${fact.victimName}!`;
    case "a master thief's own pockets cannot be picked":
      return `${fact.heroName}'s fingers find nothing — ${fact.victimName} keeps every trinket sewn tight; a master thief cannot be robbed of their own.`;
    case 'a thief lifts a magic item from a hero':
      return `${fact.heroName} deftly lifts the ${fact.itemName} from ${fact.victimName}!`;
    case 'a thief notes how he carries what he took':
      return fact.gainedItemNote;
    case 'a realm learns a thief stole a magic item':
      return `[Intelligence] ${fact.thiefName} (${fact.thiefsRealmName}) has stolen the ${fact.itemName} from ${fact.victimName}!`;
    case "a thief's attempt on a hero fails unnoticed":
      return `${fact.heroName}'s theft attempt on ${fact.victimName} fails but the thief slips away undetected.`;
    case 'a hero lacks the Spy mastery to attempt Sabotage':
      return `${fact.heroName} lacks the Spy mastery (7) to attempt Sabotage.`;
    case 'Sabotage needs an enemy province the hero has seen':
      return `${fact.heroName}: Sabotage needs a valid enemy province you have seen.`;
    case 'Sabotage of a province whose owner is not at war is refused':
      return `${fact.heroName}: you are not at war with the owner of ${fact.provinceName} — Sabotage would be an act of war. Declare war first.`;
    case "a spy's agents sabotage a province": {
      const u = fact.torchedCompany;
      const disbanded = u ? ` A ${u.quality ?? ''} ${u.type} of its garrison is put to the torch.` : '';
      return `🕵 ${fact.heroName}'s agents sabotage ${fact.provinceName} — its coffers yield nothing this turn.${disbanded}`;
    }
    case 'a hero lacks the Thief mastery for a Grand Heist':
      return `${fact.heroName} lacks the Thief mastery (7) for a Grand Heist.`;
    case 'a thief has already attempted a Grand Heist this turn':
      return `${fact.heroName} has already attempted a Grand Heist this turn — one great job a season is all the nerves will bear.`;
    case 'a Grand Heist needs ground a rival crown holds':
      return `${fact.heroName} looks for vaults to crack in ${fact.provinceName}, but no rival crown holds this ground — a Grand Heist is staged in an enemy's own country.`;
    case 'a Grand Heist on a realm not at war is refused':
      return `${fact.heroName}: you are not at war with ${fact.realmName ?? 'this realm'} — a Grand Heist would be an act of war. Declare war first.`;
    case 'a Grand Heist needs a capital or rich country':
      return `${fact.heroName} casts an eye over ${fact.provinceName} and finds nothing worth the risk — a Grand Heist is staged in an enemy's home capital or in rich country (tax ${String(fact.richTax)}+; this province: ${String(fact.tax)}).`;
    case "a thief's roll to crack the vaults":
      return `📊 Grand Heist — ${fact.heroName} (Thief ${String(fact.thiefLevel)}) cracks the vaults of ${fact.isTheEnemyCapital ? 'the enemy capital of ' : 'the rich province of '}${fact.provinceName} (${fact.realmName ?? 'an enemy realm'}): ${fmtRoll(fact.chance, fact.roll)}${fact.theVaultsAreGuarded ? ' (halved — the vaults are guarded)' : ''}`;
    case "a realm's courier is waylaid on the road":
      return `📦 A courier of ${fact.realmName} is waylaid on the road — ${fact.itemName}${fact.senderName !== null ? `, sent by ${fact.senderName}` : ''}${fact.recipientName !== null ? ` and bound for ${fact.recipientName}` : ''}, never arrives.`;
    case 'a thief pulls off a Grand Heist': {
      const msg = theHaul(fact.haul);
      return `💰 ${fact.heroName} pulls off a Grand Heist in ${fact.provinceName}${msg ? ` — ${msg}!` : ', but finds little worth taking.'}`;
    }
    case 'a realm learns a Grand Heist was staged on it': {
      const msg = theHaul(fact.haul);
      return `[Intelligence] ${fact.thiefName} (${fact.thiefsRealmName}) staged a Grand Heist in ${fact.provinceName}${msg ? `: ${msg}` : ''}.`;
    }
    case 'a Grand Heist comes to nothing unnoticed':
      return `${fact.heroName}'s Grand Heist in ${fact.provinceName} comes to nothing, but the thief slips away undetected.`;
    case 'a thief is caught at the vaults and beaten back':
      return `${fact.heroName} is caught at the vaults of ${fact.provinceName} and beaten back by the guards — ${String(fact.damage)} damage taken.`;
    case 'a realm learns a thief was driven off its vaults':
      return `[Intelligence] A thief — ${fact.thiefName} (${fact.thiefsRealmName}) — was driven off the vaults of ${fact.provinceName}.`;
    case 'a hero lacks the Spy mastery to Assassinate':
      return `${fact.heroName} lacks the Spy mastery (9) to Assassinate.`;
    case 'a hero finds no enemy hero to assassinate':
      return `${fact.heroName} finds no enemy hero to assassinate in ${fact.provinceName} this phase.`;
    case 'an assassin stalks a vanished mark':
      return `${fact.heroName} stalks ${fact.victimName} through ${fact.provinceName} and never once catches sight of them — the mark has vanished.`;
    case 'an assassination of a hero whose crown is not at war is refused':
      return `${fact.heroName}: you are not at war with ${fact.victimName}'s crown — an assassination would be an act of war. Declare war first.`;
    case "an assassin's roll":
      return `📊 Assassination — ${fact.heroName} (Spy ${String(fact.spyLevel)}) stalks ${fact.victimName}: ${String(fact.chance)}% (roll ${String(fact.roll)}${fact.roll <= fact.chance ? ' ✓' : ' ✗'})${fact.theMarkIsAKing ? ' (king — heavily guarded)' : ''}`;
    case "a realm learns an attempt was made on its hero's life":
      return `🗡 An attempt is made on ${fact.victimName}'s life${fact.theMarkIsAKing ? ' — the royal guard close ranks' : ''}.`;
    case "an assassin's attempt fails":
      return `${fact.heroName}'s attempt on ${fact.victimName} fails — the mark slips the knife.`;
    case 'a hero lacks the Thief mastery to Vanish':
      return `${fact.heroName} lacks the Thief mastery (9) to Vanish.`;
    case 'a thief melts into the shadows':
      return `🌫 ${fact.heroName} melts into the shadows — for the rest of the turn nothing can bring them to bay and nothing can harm them: no pursuit, Encounter or ambush, no hostile spell, no blade, no assassin's knife.`;
    default: {
      const unknown: never = fact;
      return unknown;
    }
  }
}
