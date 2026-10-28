// ── THE FACTS THE ENCOUNTER AND DEFEND ORDERS' LINES RECORD (plan P1-12d6: P1-12's Decisions of 2026-10-26, Decisions 2,
// 6 and 7) ──
// The lines the Encounter Character and Defend orders write (orders/encounter-and-defend-orders-chasing-a-hero-down-
// and-keeping-watch.ts): a hunter who finds no quarry or no trail, a quarry he may not hunt, the chase set; a watch
// spent in battle, kept, or set over the province and the country about it. Each kind holds plain values: a hero's or a
// province's name as the world holds it, and a flag for a clause chosen by it; the prose writes every word
// (src/views/prose/the-words-of-the-encounter-and-defend-orders-lines.ts). Each is filed on its own, with the audience
// its event names (Decision 6: its event's).
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';

/** What a line of the Encounter Character and Defend orders records. */
export type TheFactOfAnEncounterOrDefendOrdersLine =
  | { kind: 'a hunter finds no quarry to hunt down'; heroName: string }
  | { kind: 'a hero cannot set out to encounter himself'; heroName: string }
  | { kind: "a charmed hero will not hunt a hero of his true lord's realm"; heroName: string; quarryName: string }
  | { kind: 'a common hero may not run down a rival king'; heroName: string; quarryName: string }
  | { kind: 'a hunter finds no trail of a cloaked quarry'; heroName: string; quarryName: string }
  | { kind: 'a hunter finds no trail of a quarry who has vanished'; heroName: string; quarryName: string }
  | { kind: 'a hunter sets out to run down his quarry'; heroName: string; quarryName: string }
  | { kind: "a defender's watch is spent in this season's battle"; heroName: string }
  | {
      kind: 'a defender keeps the watch he set in an earlier season';
      heroName: string;
      provinceName: string;
      /** No column at his back: he lies in wait rather than keeps a watch. */
      hasNoColumn: boolean;
    }
  | { kind: 'a defender with no column lies in wait to ambush'; heroName: string; provinceName: string }
  | { kind: 'a defender makes camp and sets a watch'; heroName: string; provinceName: string }
  | {
      kind: 'a defender sets a watch over the country around another province';
      heroName: string;
      provinceName: string;
      centreProvinceName: string;
    };

/** Each kind's audience: its event's (a kind filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_AN_ENCOUNTER_OR_DEFEND_ORDERS_LINE: Readonly<
  Record<TheFactOfAnEncounterOrDefendOrdersLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'a hunter finds no quarry to hunt down': "its event's",
  'a hero cannot set out to encounter himself': "its event's",
  "a charmed hero will not hunt a hero of his true lord's realm": "its event's",
  'a common hero may not run down a rival king': "its event's",
  'a hunter finds no trail of a cloaked quarry': "its event's",
  'a hunter finds no trail of a quarry who has vanished': "its event's",
  'a hunter sets out to run down his quarry': "its event's",
  "a defender's watch is spent in this season's battle": "its event's",
  'a defender keeps the watch he set in an earlier season': "its event's",
  'a defender with no column lies in wait to ambush': "its event's",
  'a defender makes camp and sets a watch': "its event's",
  'a defender sets a watch over the country around another province': "its event's",
};
