// ── THE FACTS THE LINES OF WHAT A SPY LEARNS RECORD (plan P1-12d17: P1-12's Decisions of 2026-10-30, Decision 2) ──
// The lines a successful spy's report writes (espionage/what-a-spy-learns.ts, applySpySuccess, for the Spy order and
// the Neutral Broker's paid intelligence alike): who holds the province, its tax and its defenders; on a king's home,
// the crown's tax income and its heroes, the roll to lift a discovery from its archives and the secret copied; and the
// owner's warning that a rival's agents were prying. Each kind holds plain values: a hero's, a realm's, a province's
// or a discovery's name as the world holds it (null where the line falls back: the prose writes "no-one", "an unknown
// power"), the tax, counts, the chance and the roll, and the defenders, each a copy of its quality and type as the line
// is told. The prose writes every word (src/views/prose/the-words-of-what-a-spy-learns-lines.ts). Each is filed on its
// own, with the audience its event names (its event's): no audience changes.
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';

/** A province's defender, as the spy's report names it: its quality and its type, copied as the line is told. */
export interface ADefenderAsTheSpyNamesIt {
  readonly quality: string;
  readonly type: string;
}

/** What a line of what a spy learns records. */
export type TheFactOfWhatASpyLearnsLine =
  | {
      readonly kind: 'a spy learns who holds a province, its tax and its defenders';
      readonly heroName: string;
      readonly provinceName: string;
      /** The realm that holds it (null: no realm holds it, and the prose writes "no-one"). */
      readonly ownerRealmName: string | null;
      readonly tax: number;
      /** Its neutral defenders, in order (none: the prose writes "none"). */
      readonly defenders: readonly ADefenderAsTheSpyNamesIt[];
    }
  | {
      readonly kind: "a spy learns a king's home's tax income and heroes";
      readonly realmName: string;
      readonly taxIncome: number;
      /** The crown's heroes beyond the king. */
      readonly heroes: number;
    }
  | {
      readonly kind: "a spy rifles a king's archives for a discovery";
      readonly heroName: string;
      readonly spyLevel: number;
      readonly realmName: string;
      readonly chance: number;
      readonly roll: number;
    }
  | {
      readonly kind: "a spy copies a secret from a king's archives";
      readonly heroName: string;
      readonly discoveryName: string;
      readonly realmName: string;
    }
  | {
      readonly kind: "a province's watch catches a rival's agents prying";
      readonly provinceName: string;
      /** The prying realm's name (null where it has none: the prose writes "an unknown power", or "unknown agents"
       *  for a spy who serves no realm). */
      readonly pryingRealmName: string | null;
      readonly theSpyServesARealm: boolean;
    };

/** The defenders of a province, as the spy's report names them, copied as the line is told. */
export function theDefendersAsTheSpyNamesThem(
  defenders: readonly ADefenderAsTheSpyNamesIt[],
): ADefenderAsTheSpyNamesIt[] {
  return defenders.map((d) => ({ quality: d.quality, type: d.type }));
}

/** Each kind's audience: its event's (each is filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_WHAT_A_SPY_LEARNS_LINE: Readonly<
  Record<TheFactOfWhatASpyLearnsLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'a spy learns who holds a province, its tax and its defenders': "its event's",
  "a spy learns a king's home's tax income and heroes": "its event's",
  "a spy rifles a king's archives for a discovery": "its event's",
  "a spy copies a secret from a king's archives": "its event's",
  "a province's watch catches a rival's agents prying": "its event's",
};
