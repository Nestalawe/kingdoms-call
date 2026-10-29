// ── THE FACTS THE WAR MASTERY ORDERS' LINES RECORD (plan P1-12d7: P1-12's Decisions of 2026-10-26, Decisions 2, 6
// and 7) ──
// The lines the masteries of a war skill write (orders/war-mastery-orders-challenge-rampage-volleys-tactics-blockade-
// and-coast-raids.ts): Blockade, Challenge, Rampage, Rain of Arrows, Sniper's Mark, Feigned Retreat, Grand Stratagem,
// Lightning Advance and Raid the Coast, each refused (no mastery, no target, no fleet, no war) or carried out. Each
// kind holds plain values: a hero's or a province's name as the world holds it, a count, the wounds dealt, a chance
// and its roll, and a flag for a clause chosen by it; the prose writes every word (src/views/prose/the-words-of-the-
// war-mastery-orders-lines.ts). Each is filed on its own, with the audience its event names (Decision 6: its event's).
// A hero who falls to a Challenge or a Sniper's Mark is told by reportHeroFall (heroes/), as a hero's death's kind "a
// hero is slain outside a battle", the way he fell a value (P1-12d11).
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';

/** What a line of the war mastery orders records. */
export type TheFactOfTheWarMasteryOrdersLine =
  | { kind: 'a hero lacks the Naval mastery to raise a Blockade'; heroName: string }
  | { kind: 'a Blockade must target a sea province'; heroName: string }
  | { kind: 'a Blockade must seal a sea the hero is in or beside'; heroName: string }
  | { kind: 'a Blockade must be thrown by a fleet'; heroName: string }
  | { kind: 'a hero throws a Blockade across a sea'; heroName: string; provinceName: string }
  | { kind: 'the fleet cannot close the waters in time'; heroName: string; provinceName: string }
  | { kind: 'a hero lacks the Melee mastery to issue a Challenge'; heroName: string }
  | { kind: 'a hero finds no enemy hero to challenge'; heroName: string; provinceName: string }
  | { kind: 'a Challenge of a hero whose crown is not at war is refused'; heroName: string; foeName: string }
  | { kind: 'a hero at the head of an army will not answer a Challenge'; foeName: string; heroName: string }
  | {
      kind: 'a hero calls another to single combat';
      heroName: string;
      foeName: string;
      winnerName: string;
      loserName: string;
      wounds: number;
    }
  | { kind: 'a hero lacks the Melee mastery to Rampage'; heroName: string }
  | { kind: 'a hero finds no enemy force to fall upon'; heroName: string; provinceName: string }
  | { kind: 'a Rampage on a host whose crown is not at war is refused'; heroName: string; foeName: string }
  | { kind: "a hero goes on a Rampage through a host's ranks"; heroName: string; foeName: string; kills: number }
  | { kind: 'a hero lacks the Archery mastery for a Rain of Arrows'; heroName: string }
  | { kind: 'a hero finds no enemy force to volley'; heroName: string; provinceName: string }
  | { kind: 'a Rain of Arrows on a host whose crown is not at war is refused'; heroName: string; foeName: string }
  | { kind: 'a hero looses a Rain of Arrows on a host'; heroName: string; foeName: string; kills: number }
  | { kind: "a hero lacks the Archery mastery for a Sniper's Mark"; heroName: string }
  | { kind: 'a hero finds no enemy commander to mark'; heroName: string; provinceName: string }
  | { kind: "a Sniper's Mark on a hero whose crown is not at war is refused"; heroName: string; foeName: string }
  | {
      kind: "a hero takes a Sniper's Mark on an enemy hero";
      heroName: string;
      foeName: string;
      wounds: number;
      /** The wounds alone fell him (no chance to slay is told). */
      theWoundsFellHim: boolean;
      /** The chance to slay him, in percent, and its roll. */
      killChance: number;
      roll: number;
    }
  | { kind: 'a hero lacks the Tactical mastery for a Feigned Retreat'; heroName: string }
  | { kind: 'a hero lays a Feigned Retreat'; heroName: string }
  | { kind: 'a hero lacks the Tactical mastery for a Grand Stratagem'; heroName: string }
  | { kind: 'a hero sets a Grand Stratagem in motion'; heroName: string }
  | { kind: 'a hero lacks the March mastery for a Lightning Advance'; heroName: string }
  | { kind: 'a hero orders a Lightning Advance'; heroName: string }
  | { kind: 'a hero lacks the Naval mastery to Raid the Coast'; heroName: string }
  | { kind: 'a Raid the Coast must be led by a fleet'; heroName: string }
  | { kind: 'a hero readies a Raid the Coast'; heroName: string };

/** Each kind's audience: its event's (a kind filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_THE_WAR_MASTERY_ORDERS_LINE: Readonly<
  Record<TheFactOfTheWarMasteryOrdersLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'a hero lacks the Naval mastery to raise a Blockade': "its event's",
  'a Blockade must target a sea province': "its event's",
  'a Blockade must seal a sea the hero is in or beside': "its event's",
  'a Blockade must be thrown by a fleet': "its event's",
  'a hero throws a Blockade across a sea': "its event's",
  'the fleet cannot close the waters in time': "its event's",
  'a hero lacks the Melee mastery to issue a Challenge': "its event's",
  'a hero finds no enemy hero to challenge': "its event's",
  'a Challenge of a hero whose crown is not at war is refused': "its event's",
  'a hero at the head of an army will not answer a Challenge': "its event's",
  'a hero calls another to single combat': "its event's",
  'a hero lacks the Melee mastery to Rampage': "its event's",
  'a hero finds no enemy force to fall upon': "its event's",
  'a Rampage on a host whose crown is not at war is refused': "its event's",
  "a hero goes on a Rampage through a host's ranks": "its event's",
  'a hero lacks the Archery mastery for a Rain of Arrows': "its event's",
  'a hero finds no enemy force to volley': "its event's",
  'a Rain of Arrows on a host whose crown is not at war is refused': "its event's",
  'a hero looses a Rain of Arrows on a host': "its event's",
  "a hero lacks the Archery mastery for a Sniper's Mark": "its event's",
  'a hero finds no enemy commander to mark': "its event's",
  "a Sniper's Mark on a hero whose crown is not at war is refused": "its event's",
  "a hero takes a Sniper's Mark on an enemy hero": "its event's",
  'a hero lacks the Tactical mastery for a Feigned Retreat': "its event's",
  'a hero lays a Feigned Retreat': "its event's",
  'a hero lacks the Tactical mastery for a Grand Stratagem': "its event's",
  'a hero sets a Grand Stratagem in motion': "its event's",
  'a hero lacks the March mastery for a Lightning Advance': "its event's",
  'a hero orders a Lightning Advance': "its event's",
  'a hero lacks the Naval mastery to Raid the Coast': "its event's",
  'a Raid the Coast must be led by a fleet': "its event's",
  'a hero readies a Raid the Coast': "its event's",
};
