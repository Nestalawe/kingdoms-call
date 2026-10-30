// ── THE FACTS THE LINES OF THE PLAGUE AND THE BLESS WARD RECORD (plan P1-12d17: P1-12's Decisions of 2026-10-30,
// Decision 2) ──
// The lines magic/plague-and-bless-ward.ts writes: a Bless ward turning an enemy spell aside, the Plague sickening a
// realm's troops in a province (its garrison, or the troops a hero leads there), and the Plague spreading into a
// neighbouring province. Each kind holds plain values: a hero's, a province's or a unit's name as the world holds it
// (null where the line falls back: the prose writes "a hostile mage"), the spell's name as its caller names it, the
// units sickened (each a copy of its name and its new quality, as the line is told), the counts, and a flag for the
// clause the line chooses. The prose writes every word (src/views/prose/the-words-of-plague-and-bless-ward-lines.ts).
// Each is filed on its own, with the audience its event names (its event's): no audience changes.
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';

/** A unit the Plague sickened, as the line names it: its name (else its type) and its new quality, copied as the line
 *  is told. */
export interface AUnitThePlagueSickenedAsTheLineNamesIt {
  readonly unitName: string;
  readonly quality: string;
}

/** What a line of the Plague or the Bless ward records. */
export type TheFactOfAPlagueOrBlessWardLine =
  | {
      readonly kind: "a Bless ward turns an enemy's spell aside";
      readonly provinceName: string;
      /** The caster (null: none is named, and the prose writes "a hostile mage"). */
      readonly casterName: string | null;
      /** The spell's name, as its caller names it ('Flood', 'Plague', …). */
      readonly spellName: string;
    }
  | {
      readonly kind: "the Plague sickens a realm's troops in a province";
      /** Whether it sickens the province's garrison (else the troops a hero leads there). */
      readonly theGarrison: boolean;
      readonly provinceName: string;
      /** The units sickened, in order. */
      readonly units: readonly AUnitThePlagueSickenedAsTheLineNamesIt[];
    }
  | {
      readonly kind: 'the Plague spreads into a province';
      readonly provinceName: string;
      readonly affected: number;
      readonly tested: number;
    };

/** Each kind's audience: its event's (each is filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_PLAGUE_OR_BLESS_WARD_LINE: Readonly<
  Record<TheFactOfAPlagueOrBlessWardLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  "a Bless ward turns an enemy's spell aside": "its event's",
  "the Plague sickens a realm's troops in a province": "its event's",
  'the Plague spreads into a province': "its event's",
};
