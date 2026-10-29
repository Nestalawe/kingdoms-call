// ── THE WORDS OF DIPLOMACY'S AND VICTORY'S LINES (plan P1-12d16: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The views write the words of each fact the lines of diplomacy and victory record (src/engine/turn/the-facts-diplomacy-
// and-victorys-lines-record.ts), in the same words the engine wrote before (turn/diplomacy-resolution-and-victory-the-
// reckoning-elimination-concession-and-the-announcement.ts): a realm with no name by its seat ("Realm 2"), or "A king",
// "the claimant", "the enemy" where the line said so; a share of the world and a bar rounded for reading (dispFloor);
// the allies and a realm's titles joined with commas (a title by its name, else its key); and the plurals from the
// counts. The game's end's words (the Reckoning called as the rivals concede, the game decided, the standings) are read
// by the player page from the stored log: they stay exactly as they were. A kind with no words here is a compile error
// (the `never` below).
import type {
  ARealmAsDiplomacyOrVictoryNamesIt,
  TheFactOfADiplomacyOrVictoryLine,
} from '../../engine/turn/the-facts-diplomacy-and-victorys-lines-record.ts';
import { dispFloor } from '../../engine/rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { _TITLE_LABEL } from '../../engine/titles/reckoning.ts';

/** A realm's name, else "Realm N" by its seat. */
function theRealmsNameOrItsNumber(realm: ARealmAsDiplomacyOrVictoryNamesIt): string {
  return realm.realmName ?? 'Realm ' + String(realm.seat + 1);
}

/** A share of the world, as the line shows it: a percentage rounded down (dispFloor). */
function aShareShown(fraction: number): string {
  return String(dispFloor(fraction * 100));
}

/** The words of one fact of diplomacy's and victory's lines. */
export function theWordsOfADiplomacyOrVictoryLine(fact: TheFactOfADiplomacyOrVictoryLine): string {
  switch (fact.kind) {
    case 'a realm is sent an overture': {
      const from = theRealmsNameOrItsNumber(fact.from);
      return `🕊 ${from} has sent you an overture of ${fact.ofPeace ? 'peace' : 'an alliance'}.${fact.answeredInKind ? ' You answered in kind.' : ` Declare a Treat toward ${from} with next turn's orders to answer it.`}`;
    }
    case 'two realms both seek an alliance so few kings may not forge':
      return `${theRealmsNameOrItsNumber(fact.realm)} and ${theRealmsNameOrItsNumber(fact.otherRealm)} both sought an alliance, but no alliances may be forged in a realm of so few kings — the pact cannot be sealed.`;
    case "a realm's overture goes unanswered":
      return `${theRealmsNameOrItsNumber(fact.realm)}'s overture of ${fact.ofPeace ? 'peace' : 'alliance'} to ${theRealmsNameOrItsNumber(fact.otherRealm)} went unanswered this year — relations are unchanged.`;
    case 'war now stands between two realms':
      return `⚔ War now stands between ${theRealmsNameOrItsNumber(fact.first)} and ${theRealmsNameOrItsNumber(fact.second)}. Their armies may cross the frontier and give battle.`;
    case 'two realms are now allied':
      return `🤝 ${theRealmsNameOrItsNumber(fact.first)} and ${theRealmsNameOrItsNumber(fact.second)} are now ALLIED — your armies may pass freely through one another's lands and will never come to blows.`;
    case 'an alliance is broken and two realms are neutral once more': {
      const first = theRealmsNameOrItsNumber(fact.first);
      const second = theRealmsNameOrItsNumber(fact.second);
      const both = fact.brokenByFirst && fact.brokenBySecond;
      const breaker = both ? `${first} and ${second}` : fact.brokenByFirst ? first : second;
      return `💔 ${breaker} ${both ? 'have' : 'has'} broken the alliance between ${first} and ${second} — the two realms are NEUTRAL once more. Neither may march an army across the other's border; a further declaration of war would open hostilities.`;
    }
    case 'two realms make peace and are neutral':
      return `🕊 ${theRealmsNameOrItsNumber(fact.first)} and ${theRealmsNameOrItsNumber(fact.second)} have made peace and are now NEUTRAL — neither may march an army across the other's border.`;
    case "a host stands on a new foe's war front": {
      const foe = fact.foeRealmName ?? 'the enemy';
      return `⚠ War front: ${fact.heroName}'s host (${String(fact.unitCount)} unit${fact.unitCount !== 1 ? 's' : ''}) stands in ${fact.provinceName}, ${fact.onTheFoesLand ? `land of ${foe}` : `face to face with a host of ${foe}`}. If it is still there at the end of next Spring it will give battle for the province — march it out in Spring to avoid the fight, or reinforce it.`;
    }
    case "a new foe's host stands on the realm's war front":
      return `⚠ War front: ${fact.heroName} (${fact.realmName ?? 'the enemy'}) holds a host of ${String(fact.unitCount)} unit${fact.unitCount !== 1 ? 's' : ''} ${fact.onTheRealmsLand ? `inside your province of ${fact.provinceName}` : `beside your host in ${fact.provinceName}`}. Unless it withdraws, it will attack at the end of next Spring — reinforce ${fact.provinceName}, or keep a general on Defend next door to ride in.`;
    case 'a realm calls the Reckoning before the throne may be claimed':
      return `${fact.realmName ?? 'A king'} calls for the Reckoning, but the throne cannot be claimed before Turn ${String(fact.firstTurn)} — the realms are barely settled and the world will not yet be judged. The claim may be lodged again from that turn.`;
    case 'a realm with no living king calls the Reckoning':
      return `Only a king may call the Reckoning.`;
    case 'the Reckoning is called': {
      const claimant = theRealmsNameOrItsNumber(fact.claimant);
      const allies = fact.allyNames;
      const bloc = allies.length ? ` and their allies (${allies.join(', ')})` : '';
      return `👑 THE RECKONING IS CALLED. ${claimant}${bloc} lay claim to the vacant Imperial throne, commanding ${aShareShown(fact.share)}% of the world${allies.length ? ` — a bar of ${aShareShown(fact.bar)}%, raised by ${String(allies.length)} all${allies.length === 1 ? 'y' : 'ies'} standing with the claim` : ''}. The realms have TWO turns to contest it — drive ${claimant}'s bloc below ${aShareShown(fact.bar)}% and the claim collapses. Otherwise the world is judged at the end of Turn ${String(fact.judgedAtTurn)}.`;
    }
    case "a realm calls the Reckoning on its alliance's strength but holds too little itself":
      return `${fact.realmName ?? 'A king'} calls for the Reckoning on the strength of their alliance, but their OWN realm commands only ${aShareShown(fact.ownShare)}% of the world — a claimant must personally hold at least ${aShareShown(fact.callerMinimum)}% (half the ${aShareShown(fact.bar)}% bar) to press the claim. The throne is not won by riding a stronger ally's coat-tails; let the bloc's greatest realm lodge it.`;
    case 'a realm calls the Reckoning but commands too little of the world':
      return `${fact.realmName ?? 'A king'} calls for the Reckoning, but commands only ${aShareShown(fact.share)}% of the world — short of the ${aShareShown(fact.bar)}% needed to press the claim.`;
    case "the claim to the throne collapses as the claimant's bloc falls below the bar":
      return `The claim to the throne collapses — ${fact.claimantName ?? 'the claimant'}'s bloc no longer commands the world (${aShareShown(fact.share)}% < ${aShareShown(fact.bar)}%). The Reckoning is called off; the war goes on.`;
    case 'the claim to the throne collapses as the claimant falls below his own floor':
      return `The claim to the throne collapses — ${fact.claimantName ?? 'the claimant'} has been cut down to ${aShareShown(fact.ownShare)}% of the world in their own right, beneath the ${aShareShown(fact.ownMinimum)}% a claimant must personally hold. Their allies still stand, but the claim was theirs to carry and they can no longer carry it. The Reckoning is called off; the war goes on.`;
    case "the Reckoning's bar falls as the world grows weary":
      return `⏳ The world grows weary of the long war. No throne has been claimed, and the crown's price falls: a realm standing alone now needs only ${String(fact.barNow)}% of the world's tax base to Call the Reckoning — down from ${String(fact.barBefore)}%. (A claim carried by allies still costs ${String(fact.allyStep)} points more for every ally standing with it.)${fact.fallsNoFurther ? ' It will fall no further.' : ` It will fall another ${String(fact.nextFall)}% at the end of next turn.`}`;
    case 'the Reckoning is called at once as the rivals concede':
      return `👑 THE RECKONING IS CALLED — ${String(fact.concededCount)} realm${fact.concededCount !== 1 ? 's have' : ' has'} conceded and ${fact.oneCrownLeft ? 'only one crown still contests the world' : 'the last crowns standing are sworn to one another'}. The throne is settled here and now; the Legacy of every realm, titles and relics counted, is set down below.`;
    case 'the game is decided': {
      const winner = fact.winner === null ? 'No-one' : theRealmsNameOrItsNumber(fact.winner);
      const how = fact.byElimination
        ? 'the last realm standing in a world of ruins'
        : fact.byConcession
          ? 'the last crown still contesting the world — every rival has conceded'
          : 'judged supreme at the Reckoning';
      return `🏆 THE GAME IS DECIDED — ${winner} is ${how}!`;
    }
    case "a realm's place in the final Legacy standings": {
      // a title by its name, else its key (as the engine's `_TITLE_LABEL[k] || k`: every name in the table has words, so
      // `??` falls back exactly where `||` did)
      const labelOfATitle: Readonly<Record<string, string | undefined>> = _TITLE_LABEL; // read by any title's key
      const titlesHeld = fact.titleKeys.map((k) => labelOfATitle[k] ?? k).join(', ');
      const relics = fact.relics
        ? `${fact.titleKeys.length ? ', ' : ''}${String(fact.relics)} relic${fact.relics !== 1 ? 's' : ''}`
        : '';
      return `   ${String(fact.place)}. ${fact.realmName} — ${String(fact.score)} Legacy${titlesHeld || relics ? ` (${titlesHeld}${relics})` : ''}`;
    }
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`diplomacy's and victory's lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
