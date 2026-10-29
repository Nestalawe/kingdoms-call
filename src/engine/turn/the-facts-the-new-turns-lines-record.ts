// ── THE FACTS THE NEW TURN'S LINES RECORD (plan P1-12d15: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The lines the new turn writes, in its two parts: the first (turn/new-turn-counter-king-succession-summons-and-spells-
// end-and-the-grand-designs.ts): a Divine king who cannot return, a dynasty extinguished, an heir crowned, the summoned
// elementals and the Wild Hunt's beasts released, the Grand Library's discovery or its end; the second
// (turn/new-turn-war-academy-informants-divine-resurrection-graves-mercenaries-wanderers-and-the-final-reconcile.ts): the
// War Academy's drills, the physick gardens' healing, the Informant Network's and the Arcane Observatory's reports, a
// Divine hero's return or its grace lost, a mercenary band retired, and the GM's lines of the save's repairs and its
// check. Each kind holds plain values: a hero's, a realm's, a province's, a unit's or a discovery's name as the world or
// the content holds it (null where the line falls back: the prose writes "unknown", "unknown terrain"), a company's type
// and quality, a discovery's category and description as the content holds them, the units released (copied as the line
// is told: the prose names and joins them), counts and hit points, a flag for each clause the line chooses, and the
// places where the save differs from this build's schema, each as the save's check names it (its path and kind, never a
// value: engine/saves/). One field is a name the engine gives (an heir's, as the world then holds it: listed by the
// static test). The prose writes every word (src/views/prose/the-words-of-the-new-turns-lines.ts), the save check's
// line beginning "[Save check] ", which the balance matrix reads (tools/balance/a-game-fails-on-the-save-check.ts). Each
// is filed on its own, with the audience its event names (its event's): no audience changes.
import type { TheAudienceOfAKindOfLine } from './events-and-their-audiences.ts';

/** A unit as a line of the new turn names it: its name as the world holds it (null for none), and its type. */
export interface AUnitAsTheNewTurnNamesIt {
  unitName: string | null;
  unitType: string;
}

/** What a line of the new turn records. */
export type TheFactOfANewTurnsLine =
  | {
      kind: 'a Divine king cannot return with no consecrated ground left';
      kingName: string;
    }
  | {
      kind: "a realm's king has fallen with no lands left and the dynasty is extinguished";
      realmName: string;
    }
  | {
      kind: 'an heir is crowned';
      /** The heir's name, as the engine names him and the world then holds it (listed by the static test). */
      heirName: string;
      provinceName: string;
    }
  | {
      kind: 'summoned elementals are released as the season turns';
      /** The units released (the prose names and joins them, and writes the plurals from their count). */
      elementals: AUnitAsTheNewTurnNamesIt[];
      heroName: string;
    }
  | {
      kind: "the Wild Hunt's beasts slip the binding";
      beasts: AUnitAsTheNewTurnNamesIt[];
      heroName: string;
    }
  | {
      kind: 'the Grand Library has no discovery left to unlock';
    }
  | {
      kind: "the Grand Library's scholars uncover a discovery";
      discoveryName: string;
      category: string;
      description: string;
    }
  | {
      kind: 'the War Academy drills a company up a grade';
      unitName: string | null;
      unitType: string;
      provinceName: string;
      /** The grade it trains to. */
      quality: string;
    }
  | {
      kind: "the War Academy's drills produce no promotion";
      provinceName: string;
    }
  | {
      kind: "a hero's wounds knit in the physick gardens";
      heroName: string;
      healed: number;
      hp: number;
      maxHp: number;
    }
  | {
      kind: 'the informants surface no enemy captain unseen';
    }
  | {
      kind: 'the Informant Network names where an unseen enemy captain was last';
      heroName: string;
      /** His realm's name, as the world holds it (the line writes what it is, as it did). */
      realmName: string | undefined;
      /** Null where the line says "unknown". */
      provinceName: string | null;
    }
  | {
      kind: 'the Arcane Observatory finds no uncharted province left';
    }
  | {
      kind: 'the Arcane Observatory charts a province in full';
      provinceName: string;
      /** Null where the line says "unknown terrain". */
      terrain: string | null;
    }
  | {
      kind: 'a Divine hero does not return with no consecrated ground held';
      heroName: string;
    }
  | {
      kind: 'a Divine hero returns to life on the nearest consecrated ground';
      heroName: string;
      /** The hero was the realm's monarch (the line's two clauses). */
      wasKing: boolean;
      provinceName: string;
      hp: number;
    }
  | {
      kind: 'a mercenary band retires and disperses';
      /** The band's name, else its type, as the world holds it. */
      bandName: string;
      /** Null where the line says "unknown". */
      provinceName: string | null;
    }
  | {
      kind: "the heroes' wandering tags are corrected";
      heroes: number;
    }
  | {
      kind: 'retired Sage discoveries are removed from the realms';
      discoveries: number;
    }
  | {
      kind: "the save the turn loaded differs from this build's schema";
      /** Each place, as the save's check names it: its path and kind, never a value (engine/saves/). */
      places: string[];
    }
  | {
      kind: 'a stale grave of a living hero is removed';
      heroName: string;
    };

/** Each kind's audience: its event's (each is filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_NEW_TURNS_LINE: Readonly<
  Record<TheFactOfANewTurnsLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'a Divine king cannot return with no consecrated ground left': "its event's",
  "a realm's king has fallen with no lands left and the dynasty is extinguished": "its event's",
  'an heir is crowned': "its event's",
  'summoned elementals are released as the season turns': "its event's",
  "the Wild Hunt's beasts slip the binding": "its event's",
  'the Grand Library has no discovery left to unlock': "its event's",
  "the Grand Library's scholars uncover a discovery": "its event's",
  'the War Academy drills a company up a grade': "its event's",
  "the War Academy's drills produce no promotion": "its event's",
  "a hero's wounds knit in the physick gardens": "its event's",
  'the informants surface no enemy captain unseen': "its event's",
  'the Informant Network names where an unseen enemy captain was last': "its event's",
  'the Arcane Observatory finds no uncharted province left': "its event's",
  'the Arcane Observatory charts a province in full': "its event's",
  'a Divine hero does not return with no consecrated ground held': "its event's",
  'a Divine hero returns to life on the nearest consecrated ground': "its event's",
  'a mercenary band retires and disperses': "its event's",
  "the heroes' wandering tags are corrected": "its event's",
  'retired Sage discoveries are removed from the realms': "its event's",
  "the save the turn loaded differs from this build's schema": "its event's",
  'a stale grave of a living hero is removed': "its event's",
};
