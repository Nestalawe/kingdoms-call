// ── THE WORDS OF THE LINES AFTER THE PHASES (plan P1-12d16: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The views write the words of each fact the lines after the phases record (src/engine/turn/the-facts-the-lines-after-
// the-phases-record.ts), in the same words the engine wrote before (turn/after-the-phases-stand-offs-the-dead-graves-
// couriers-mass-healing-cowards-and-location-names.ts): the companies that crumbled joined with semicolons, a parcel's
// items and the Elven companies joined with commas, a realm with no name "the realm", a province with none "safety", the
// healer's own wounds "them" and "their", and the plurals from the counts. A neutral hero's lesson and a parcel's equip
// note are written as they were handed in. A kind with no words here is a compile error (the `never` below).
import type {
  SkeletalCompaniesThatCrumbled,
  TheFactOfALineAfterThePhases,
} from '../../engine/turn/the-facts-the-lines-after-the-phases-record.ts';

/** Skeletal companies that crumbled, as the line tells them: "2 skeletal units under Aldric in Highmoor — …". */
function theCompaniesThatCrumbled(crumbled: SkeletalCompaniesThatCrumbled): string {
  const units = `${String(crumbled.unitCount)} skeletal unit${crumbled.unitCount !== 1 ? 's' : ''}`;
  switch (crumbled.kind) {
    case 'skeletal companies crumble under a hero with no Necromancy':
      return `${units} under ${crumbled.heroName}${crumbled.provinceName !== null ? ` in ${crumbled.provinceName}` : ''} — ${crumbled.heroName} has no Necromancy to hold them together`;
    case 'skeletal companies left to garrison a province crumble':
      return `${units} left to garrison ${crumbled.provinceName} — no one was left to command them`;
    default: {
      const aKindWithNoWords: never = crumbled;
      throw new Error(`the crumbled companies have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}

/** The words of one fact of the lines after the phases. */
export function theWordsOfALineAfterThePhases(fact: TheFactOfALineAfterThePhases): string {
  switch (fact.kind) {
    case 'skeletal companies crumble with no necromancer to hold them':
      return `\u{1F480} The dead will not stand alone. ${fact.crumbled.map(theCompaniesThatCrumbled).join('; ')}. ${fact.crumbled.length === 1 ? 'It crumbles' : 'They crumble'} to dust — a skeletal host holds together only while a character of at least Necromancy 1 leads it.`;
    case 'a necromancer senses graves underfoot':
      return `💀 ${fact.heroName} feels the dead of ${fact.provinceName} stirring underfoot — battlefield graves lie in this province, though nothing tells how many or what they hold.`;
    case 'a neutral hero learns a skill':
      return fact.words;
    case 'a consecration is broken as its province passes from the realm':
      return `✨ The consecration of ${fact.provinceName} is broken — it has passed from ${fact.realmName}'s hands, and the hallowed light departs. The crown may sanctify new ground in its place.`;
    case "a courier's parcel finds no one left to receive it":
      return `📦 A courier bearing ${fact.itemNames.join(', ')}${fact.senderName !== null ? ` from ${fact.senderName}` : ''} finds no one left to receive it — the parcel is lost.`;
    case "a courier's parcel reaches its hero as the season closes":
      return `📦 A courier reaches ${fact.heroName} with ${fact.itemNames.join(', ')}${fact.senderName !== null ? ` from ${fact.senderName}` : ''} — delivered as the season closes, ready to use next turn.`;
    case "a hero a courier's parcel reaches notes how he carries it":
      return fact.gainedItemNote;
    case 'Elven companies that slipped a battle scatter with no land to return to':
      return `🍃 ${String(fact.unitCount)} Elven unit${fact.unitCount !== 1 ? 's' : ''} broke free of battle and made for home — but ${fact.realmName ?? 'the realm'} holds no land left to return to, and they scatter into the wild, lost.`;
    case 'Elven companies that slipped a battle find their way home':
      return `🍃 ${fact.unitNames.join(', ')} (${String(fact.unitNames.length)} unit${fact.unitNames.length !== 1 ? 's' : ''}) slipped away from battle and have found their way home to ${fact.provinceName}, rejoining the garrison there.`;
    case "a master's Mass Healing mends a friend's wounds":
      return `✨ ${fact.healerName}'s Mass Healing washes over ${fact.healsHimself ? 'them' : fact.healedName} — ${fact.healsHimself ? 'their' : fact.healedName + "'s"} wounds close (+${String(fact.hpGained)} HP → ${String(fact.hp)}/${String(fact.maxHp)}${fact.hp >= fact.maxHp ? ', fully restored' : ''}).`;
    case "a hero's maximum hit points are now earned in battle":
      return `📜 A new reckoning of vigour: ${fact.heroName}'s maximum HP is now earned in battle rather than set by skill — ${String(fact.oldMaxHp)} becomes ${String(fact.newMaxHp)}. Victories over lair guardians and enemy commanders will raise it from here.`;
    case 'a coward spared on the field makes his way home':
      return `🏳 ${fact.heroName}, spared on the field, makes their way back to ${fact.provinceName ?? 'safety'}.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`the lines after the phases have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
