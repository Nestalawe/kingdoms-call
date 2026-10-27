// ── THE WORDS OF THE WAR MASTERY ORDERS' LINES (plan P1-12d7: P1-12's Decisions of 2026-10-26, Decisions 6 and 7) ──
// The views write the words of each fact the war mastery orders' lines record (src/engine/orders/the-facts-the-war-
// mastery-orders-lines-record.ts), in the same words the engine wrote before (orders/war-mastery-orders-challenge-
// rampage-volleys-tactics-blockade-and-coast-raids.ts). A kind with no words here is a compile error (the `never`
// below).
import type { TheFactOfTheWarMasteryOrdersLine } from '../../engine/orders/the-facts-the-war-mastery-orders-lines-record.ts';

/** The words of one fact of the war mastery orders' lines. */
export function theWordsOfTheWarMasteryOrdersLine(fact: TheFactOfTheWarMasteryOrdersLine): string {
  switch (fact.kind) {
    case 'a hero lacks the Naval mastery to raise a Blockade':
      return `${fact.heroName} lacks the Naval mastery (7) to raise a Blockade.`;
    case 'a Blockade must target a sea province':
      return `${fact.heroName}: Blockade must target a sea province.`;
    case 'a Blockade must seal a sea the hero is in or beside':
      return `${fact.heroName}: Blockade must seal a sea province you are in or adjacent to.`;
    case 'a Blockade must be thrown by a fleet':
      return `${fact.heroName}: a Blockade must be thrown by a fleet — you lead no naval units or sea creatures.`;
    case 'a hero throws a Blockade across a sea':
      return `⚓ ${fact.heroName} throws a Blockade across ${fact.provinceName} — enemy fleets may not cross these waters this turn.`;
    case 'the fleet cannot close the waters in time':
      return `⚓ ${fact.heroName} tries to blockade ${fact.provinceName}, but the fleet cannot close the waters in time — no blockade forms this turn.`;
    case 'a hero lacks the Melee mastery to issue a Challenge':
      return `${fact.heroName} lacks the Melee mastery (7) to issue a Challenge.`;
    case 'a hero finds no enemy hero to challenge':
      return `${fact.heroName} finds no enemy hero to challenge in ${fact.provinceName} this phase.`;
    case 'a Challenge of a hero whose crown is not at war is refused':
      return `${fact.heroName}: you are not at war with ${fact.foeName}'s crown — a Challenge would be an act of war. Declare war first.`;
    case 'a hero at the head of an army will not answer a Challenge':
      return `${fact.foeName} is at the head of an army and will not break off to answer ${fact.heroName}'s Challenge.`;
    case 'a hero calls another to single combat':
      return `⚔ ${fact.heroName} calls ${fact.foeName} to single combat! ${fact.winnerName} has the better of it — ${fact.loserName} takes ${String(fact.wounds)} wounds.`;
    case 'a hero lacks the Melee mastery to Rampage':
      return `${fact.heroName} lacks the Melee mastery (9) to Rampage.`;
    case 'a hero finds no enemy force to fall upon':
      return `${fact.heroName} finds no enemy force to fall upon in ${fact.provinceName} this phase.`;
    case 'a Rampage on a host whose crown is not at war is refused':
      return `${fact.heroName}: you are not at war with ${fact.foeName}'s crown — a Rampage would be an act of war. Declare war first.`;
    case "a hero goes on a Rampage through a host's ranks":
      return `🗡 ${fact.heroName} goes on a Rampage through ${fact.foeName}'s ranks — ${String(fact.kills)} unit${fact.kills !== 1 ? 's' : ''} cut down and their commander bloodied!`;
    case 'a hero lacks the Archery mastery for a Rain of Arrows':
      return `${fact.heroName} lacks the Archery mastery (7) for a Rain of Arrows.`;
    case 'a hero finds no enemy force to volley':
      return `${fact.heroName} finds no enemy force to volley in ${fact.provinceName} this phase.`;
    case 'a Rain of Arrows on a host whose crown is not at war is refused':
      return `${fact.heroName}: you are not at war with ${fact.foeName}'s crown — a Rain of Arrows would be an act of war. Declare war first.`;
    case 'a hero looses a Rain of Arrows on a host':
      return `🏹 ${fact.heroName} looses a Rain of Arrows on ${fact.foeName}'s host — ${String(fact.kills)} unit${fact.kills !== 1 ? 's' : ''} fall to the volley.`;
    case "a hero lacks the Archery mastery for a Sniper's Mark":
      return `${fact.heroName} lacks the Archery mastery (9) for a Sniper's Mark.`;
    case 'a hero finds no enemy commander to mark':
      return `${fact.heroName} finds no enemy commander to mark in ${fact.provinceName} this phase.`;
    case "a Sniper's Mark on a hero whose crown is not at war is refused":
      return `${fact.heroName}: you are not at war with ${fact.foeName}'s crown — a Sniper's Mark would be an act of war. Declare war first.`;
    case "a hero takes a Sniper's Mark on an enemy hero":
      return `🎯 ${fact.heroName} takes a Sniper's Mark on ${fact.foeName} — ${String(fact.wounds)} wounds${fact.theWoundsFellHim ? '' : ` (${String(fact.killChance)}% to slay, roll ${String(fact.roll)})`}.`;
    case 'a hero lacks the Tactical mastery for a Feigned Retreat':
      return `${fact.heroName} lacks the Tactical mastery (7) for a Feigned Retreat.`;
    case 'a hero lays a Feigned Retreat':
      return `🏳 ${fact.heroName} lays a Feigned Retreat — should the enemy take the bait and attack, the counter will strike at +25% strength this turn.`;
    case 'a hero lacks the Tactical mastery for a Grand Stratagem':
      return `${fact.heroName} lacks the Tactical mastery (9) for a Grand Stratagem.`;
    case 'a hero sets a Grand Stratagem in motion':
      return `📜 ${fact.heroName} sets a Grand Stratagem in motion — their next battle this turn is fought at +20% strength.`;
    case 'a hero lacks the March mastery for a Lightning Advance':
      return `${fact.heroName} lacks the March mastery (9) for a Lightning Advance.`;
    case 'a hero orders a Lightning Advance':
      return `⚡ ${fact.heroName} orders a Lightning Advance — any enemy they attack this turn is caught unready (−20% on the defence).`;
    case 'a hero lacks the Naval mastery to Raid the Coast':
      return `${fact.heroName} lacks the Naval mastery (9) to Raid the Coast.`;
    case 'a Raid the Coast must be led by a fleet':
      return `${fact.heroName}: a Raid the Coast must be led by a fleet — you lead no naval units or sea creatures.`;
    case 'a hero readies a Raid the Coast':
      return `⚓ ${fact.heroName} readies a Raid the Coast — an amphibious assault launched from the sea against a coastal province this turn strikes at +25% strength, and plunders the province treasury if it falls.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`the war mastery orders' lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
