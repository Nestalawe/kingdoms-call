// ── THE WORDS OF THE LINES BEFORE THE FIRST PHASE (plan P1-12d15: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The views write the words of each fact the lines before the first phase record (src/engine/turn/the-facts-the-lines-
// before-the-first-phase-record.ts), in the same words the engine wrote before (turn/before-the-first-phase-war-without-
// warning-research-choices-messages-move-pools-and-default-defend.ts): a realm with no name by its seat ("Realm 2" in a
// war without warning, "Player 2" in a dispatch), a finder with none "a scholar", the leads set aside joined with
// commas, and the plurals from the counts. A kind with no words here is a compile error (the `never` below).
import type {
  ARealmAsALineBeforeTheFirstPhaseNamesIt,
  TheFactOfALineBeforeTheFirstPhase,
} from '../../engine/turn/the-facts-the-lines-before-the-first-phase-record.ts';

/** A realm's name, else "Realm N" by its seat (a war without warning). */
function theRealmsNameOrItsNumber(realm: ARealmAsALineBeforeTheFirstPhaseNamesIt): string {
  return realm.realmName ?? 'Realm ' + String(realm.seat + 1);
}

/** A realm's name, else "Player N" by its seat (a dispatch). */
function theRealmsNameOrItsPlayer(realm: ARealmAsALineBeforeTheFirstPhaseNamesIt): string {
  return realm.realmName ?? 'Player ' + String(realm.seat + 1);
}

/** The words of one fact of the lines before the first phase. */
export function theWordsOfALineBeforeTheFirstPhase(fact: TheFactOfALineBeforeTheFirstPhase): string {
  switch (fact.kind) {
    case 'a realm pursues one of the leads its scholars found last turn': {
      const lostNames = fact.leadsSetAsideNames.join(', ');
      return `💡 ${fact.chosenByTheRealm ? `${fact.realmName} pursues` : `No choice was sent, so ${fact.realmName}'s scholars choose for themselves and pursue`} **${fact.discoveryName}** (${fact.category}), found by ${fact.finderName ?? 'a scholar'} last turn. ${fact.description}${lostNames ? ` The other lead — ${lostNames} — is set aside and forgotten for good.` : ''}`;
    }
    case 'an Evil or Undead realm declares war without warning':
      return `⚔ ${theRealmsNameOrItsNumber(fact.declarer)} declares war on ${theRealmsNameOrItsNumber(fact.foe)} and marches without warning — ${fact.undead ? 'the dead keep no truce' : 'the wicked keep no faith'}. War stands between the two realms from this very season.`;
    case "a realm's diplomacy is set aside before the Safe Start ends":
      return `🕊 Safe Start: no Treat or declaration of war may be made before the orders for Turn ${String(fact.safeStartTurn)}. Your diplomacy this turn was set aside — relations are unchanged.`;
    case "a line the order merge held until the turn's log was ready":
      return fact.words;
    case 'a realm the GM removed withdraws and concedes':
      return `\u{1F3F3} ${fact.realmName} has withdrawn from the game and CONCEDES. Its heroes lay down their ambitions and will only defend what they hold from now on.`;
    case 'a dispatch reaches a realm':
      return `📨 Dispatch from ${theRealmsNameOrItsPlayer(fact.sender)}: “${fact.message}”`;
    case 'a realm keeps a copy of the dispatch it sent':
      return `📨 You sent to ${fact.recipients.map(theRealmsNameOrItsPlayer).join(', ')}: “${fact.message}”`;
    case 'the chronicles record the lairs under fitting names':
      return `\u{1F5FA} The chronicles are corrected: ${String(fact.lairs)} lair${fact.lairs !== 1 ? 's are' : ' is'} now recorded under a name befitting what dwells there.`;
    case "the world's guardians are re-measured five hit points frailer":
      return `\u{1F489} The world's guardians are re-measured: ${String(fact.guardians)} lair-keeper${fact.guardians !== 1 ? 's are' : ' is'} 5 hit points frailer than before.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`the lines before the first phase have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
