// ── THE FACTS THE REALM WORKS ORDERS' LINES RECORD (plan P1-12d7: P1-12's Decisions of 2026-10-26, Decisions 2, 6
// and 7) ──
// The lines the orders of a realm's creed (Consecrate, Call to Arms, Broker, Harvest the Field, and the refusal of the
// removed Awaken the Wild and Call from the Pit) and three masteries (Awaken Grove, Wild Calling, Grand Design) write
// (orders/realm-works-orders-consecration-muster-broker-the-wild-and-grand-design.ts): each refusal, the province
// consecrated, the folk mustered, the hero brokered or the word bought, the dead raised, the grove awoken, the wild
// called, the Wonder raised. Each kind holds plain values: a name as the world or the content holds it, a count, a
// cost, a flag for a word chosen by it, the consecrated provinces' names copied as the line is told, and where a Wild
// Calling tore its beasts from as records of their values; the prose writes every word (src/views/prose/the-words-of-
// the-realm-works-orders-lines.ts). A realm named after its hero in a line the province's onlookers read is its name
// as the world holds it (null: none), never its tag's words. Each is filed on its own, with the audience its event
// names (Decision 6: its event's). A Broker's hero just let go by another realm is told in the Hire Hero order's own
// kind (the same rule and the same words: the-facts-the-recruit-and-hire-orders-lines-record.ts).
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';

/** Where a Wild Calling tore beasts from, when they served another: an enemy's garrison, or a hero's host. */
export type WhereAWildCallingToreBeastsFrom =
  { kind: 'the garrison of a province'; provinceName: string } | { kind: "a hero's host"; heroName: string };

/** What a line of the realm works orders records. */
export type TheFactOfTheRealmWorksOrdersLine =
  | { kind: 'only the king can consecrate ground'; heroName: string }
  | { kind: 'the gods answer a consecration only from a Divine crown'; heroName: string }
  | { kind: 'only a province of the realm can be consecrated'; heroName: string }
  | { kind: 'the home marches were anointed at the coronation'; heroName: string }
  | { kind: 'the province is already consecrated'; provinceName: string }
  | {
      kind: 'two consecrated provinces may not lie side by side';
      heroName: string;
      provinceName: string;
      /** The consecrated province it borders (null: its name unknown; the prose says "already-hallowed ground"). */
      neighbourName: string | null;
    }
  | { kind: 'consecration flows from the White arts'; heroName: string }
  | {
      kind: 'the White faith can sustain no more consecrated provinces';
      heroName: string;
      /** How many the White skill sustains, and the names of those consecrated now. */
      limit: number;
      consecratedNames: string[];
      provinceName: string;
    }
  | {
      kind: 'a king consecrates a province';
      heroName: string;
      provinceName: string;
      /** How many are consecrated now, this one with them, and how many the White skill sustains. */
      consecrated: number;
      limit: number;
    }
  | { kind: "only a Good realm's folk answer a Call to Arms"; heroName: string }
  | { kind: "only the king's voice carries the Call to Arms"; heroName: string }
  | { kind: 'the realm has already answered a Call to Arms this turn'; heroName: string }
  | { kind: 'a Call to Arms must name a province of the realm'; heroName: string }
  | { kind: 'only the folk of settled land answer a Call to Arms'; heroName: string; provinceName: string }
  | { kind: 'the folk answer a Call to Arms'; provinceName: string; quality: string; unitType: string }
  | { kind: 'only a Neutral crown keeps brokers'; heroName: string }
  | { kind: "only the king commands the realm's brokers"; heroName: string }
  | { kind: 'the brokers find no such hero within reach'; heroName: string }
  | { kind: 'a hero will not treat with the brokers across the alignment gulf'; heroName: string }
  | { kind: 'a king cannot afford a brokered hero'; heroName: string; wantedName: string; wage: number }
  | {
      kind: "a wandering hero accepts the realm's terms by courier";
      heroName: string;
      race: string;
      alignment: string;
      provinceName: string;
      realmName: string;
      wage: number;
      /** The season he may act from (null: next turn). */
      seasonName: string | null;
    }
  | { kind: 'the brokers reach only provinces the realm has seen'; heroName: string }
  | { kind: 'the treasury cannot pay for brokered word'; heroName: string }
  | { kind: 'the brokers buy word from a province'; heroName: string; provinceName: string }
  | { kind: 'a Broker order names no target'; heroName: string }
  | {
      kind: 'the orders that called beasts are no more';
      heroName: string;
      /** The order was Call from the Pit (else Awaken the Wild). */
      itWasCallFromThePit: boolean;
    }
  | { kind: 'only Undead realms keep corpse-carters'; heroName: string }
  | { kind: 'no battlefield dead lie here to raise'; heroName: string; provinceName: string }
  | { kind: 'the treasury cannot pay the corpse-carters'; heroName: string; cost: number }
  | {
      kind: 'the corpse-carters raise a skeletal company';
      heroName: string;
      provinceName: string;
      unitName: string;
      quality: string;
      cost: number;
    }
  | { kind: 'a raiser with no Necromancy is warned his dead will crumble'; heroName: string; unitName: string }
  | { kind: 'a hero lacks the Druid mastery to Awaken a Grove'; heroName: string }
  | { kind: 'Awaken Grove works only in an owned forest, jungle or wild province'; heroName: string }
  | { kind: 'a druid awakens the grove'; heroName: string; provinceName: string }
  | {
      kind: 'onlookers see a druid awaken the grove';
      heroName: string;
      /** His realm, as the world names it (null: none). */
      realmName: string | null;
      provinceName: string;
    }
  | { kind: 'a hero lacks the Druid mastery to sound a Wild Calling'; heroName: string }
  | {
      kind: "the beasts of a hero's host answer a Wild Calling";
      heroName: string;
      provinceName: string;
      /** How many of his units broke and followed the caller. */
      lost: number;
    }
  | { kind: 'nothing wild stands here to answer a Wild Calling'; heroName: string; provinceName: string }
  | {
      kind: 'not one wild creature breaks for a Wild Calling';
      heroName: string;
      called: number;
      provinceName: string;
    }
  | {
      kind: 'wild creatures answer a Wild Calling';
      heroName: string;
      provinceName: string;
      /** How many answered, of how many wild creatures that heard the call. */
      won: number;
      called: number;
      tornFrom: WhereAWildCallingToreBeastsFrom[];
    }
  | {
      kind: 'onlookers see wild creatures answer a Wild Calling';
      heroName: string;
      /** His realm, as the world names it (null: none). */
      realmName: string | null;
      provinceName: string;
      won: number;
    }
  | { kind: 'a hero lacks the Sage mastery to realise a Grand Design'; heroName: string }
  | { kind: 'the realm has already completed its Grand Design'; realmName: string }
  | {
      kind: "a hero completes the realm's Grand Design";
      heroName: string;
      realmName: string;
      /** The Wonder, as the content (or the world, for an alignment the content lacks) names and describes it. */
      wonderName: string;
      wonderDescription: string;
      provinceName: string;
    };

/** Each kind's audience: its event's (a kind filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_THE_REALM_WORKS_ORDERS_LINE: Readonly<
  Record<TheFactOfTheRealmWorksOrdersLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'only the king can consecrate ground': "its event's",
  'the gods answer a consecration only from a Divine crown': "its event's",
  'only a province of the realm can be consecrated': "its event's",
  'the home marches were anointed at the coronation': "its event's",
  'the province is already consecrated': "its event's",
  'two consecrated provinces may not lie side by side': "its event's",
  'consecration flows from the White arts': "its event's",
  'the White faith can sustain no more consecrated provinces': "its event's",
  'a king consecrates a province': "its event's",
  "only a Good realm's folk answer a Call to Arms": "its event's",
  "only the king's voice carries the Call to Arms": "its event's",
  'the realm has already answered a Call to Arms this turn': "its event's",
  'a Call to Arms must name a province of the realm': "its event's",
  'only the folk of settled land answer a Call to Arms': "its event's",
  'the folk answer a Call to Arms': "its event's",
  'only a Neutral crown keeps brokers': "its event's",
  "only the king commands the realm's brokers": "its event's",
  'the brokers find no such hero within reach': "its event's",
  'a hero will not treat with the brokers across the alignment gulf': "its event's",
  'a king cannot afford a brokered hero': "its event's",
  "a wandering hero accepts the realm's terms by courier": "its event's",
  'the brokers reach only provinces the realm has seen': "its event's",
  'the treasury cannot pay for brokered word': "its event's",
  'the brokers buy word from a province': "its event's",
  'a Broker order names no target': "its event's",
  'the orders that called beasts are no more': "its event's",
  'only Undead realms keep corpse-carters': "its event's",
  'no battlefield dead lie here to raise': "its event's",
  'the treasury cannot pay the corpse-carters': "its event's",
  'the corpse-carters raise a skeletal company': "its event's",
  'a raiser with no Necromancy is warned his dead will crumble': "its event's",
  'a hero lacks the Druid mastery to Awaken a Grove': "its event's",
  'Awaken Grove works only in an owned forest, jungle or wild province': "its event's",
  'a druid awakens the grove': "its event's",
  'onlookers see a druid awaken the grove': "its event's",
  'a hero lacks the Druid mastery to sound a Wild Calling': "its event's",
  "the beasts of a hero's host answer a Wild Calling": "its event's",
  'nothing wild stands here to answer a Wild Calling': "its event's",
  'not one wild creature breaks for a Wild Calling': "its event's",
  'wild creatures answer a Wild Calling': "its event's",
  'onlookers see wild creatures answer a Wild Calling': "its event's",
  'a hero lacks the Sage mastery to realise a Grand Design': "its event's",
  'the realm has already completed its Grand Design': "its event's",
  "a hero completes the realm's Grand Design": "its event's",
};
