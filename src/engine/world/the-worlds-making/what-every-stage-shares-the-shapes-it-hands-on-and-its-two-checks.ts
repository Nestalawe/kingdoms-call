// What every stage of the world's making shares (src/engine/world/the-worlds-making/, B-06v): the shapes the stages hand
// on to each other (a realm as the setup hands it, a cell of the grid, a terrain, a ring cell's tailoring, a province as
// the world is made), and the two checks of an element the code has just filled or made sure of. Moved out of
// src/engine/world/generate.ts as they were, so each stage's file and generateNewGame import them from one place.
import type { Province } from '../../../schemas/saved-game-state.ts';

/** A realm as the setup hands it to the world's making (the GM's Turn 0, the bots' setup, the tests): its seat and its
 *  row's id (read by nothing here), its king's and its kingdom's names, its race, alignment and temper, a bot's mark, and the skills its king opens with by any name. */
export interface ARealmAsTheSetUpHandsIt {
  readonly id?: number | undefined;
  readonly gamePlayerId?: string | undefined;
  readonly name?: string | undefined;
  readonly kingName?: string | undefined;
  readonly kingdomName?: string | undefined;
  readonly race: string;
  readonly alignment: string;
  readonly temper?: string | undefined;
  readonly isBot?: boolean | undefined;
  readonly skills?: Readonly<Partial<Record<string, number>>> | null | undefined;
}
/** A cell of the map's grid: its row, its column and its id (`row * cols + col`). */
export interface ACellOfTheGrid {
  readonly r: number;
  readonly c: number;
  readonly id: number;
}
/** A terrain the world's making deals a cell (the five lands and the sea). */
export type ATerrainOfTheMaking = 'plain' | 'forest' | 'mountain' | 'desert' | 'jungle' | 'sea';
/** What Phase 2 decides for a cell of a home's ring: its terrain, its band of tax, and whether it is the home. */
export interface ACellsTailoring {
  readonly terrain: ATerrainOfTheMaking;
  readonly taxBand: 'poor' | 'prosperous' | null;
  readonly isHome?: boolean | undefined;
}
/** A province as the world's making builds it: the saved province, its id and owner plain numbers, its name `null`
 *  until the naming pass, and the
 *  alignment pass's mark of the primal neighbour it placed (taken off before the next home). */
export type AProvinceAsTheWorldIsMadeIt = Omit<Province, 'id' | 'name' | 'owner'> & {
  readonly id: number;
  name: string | null;
  owner: number | null;
  _alignPrimalId?: number | undefined;
};
/** A deal from a deck the code has just filled (its cards are never none); for none, a TypeError. */
export function theCardDealt<Card>(card: Card | undefined): Card {
  if (card === undefined) throw new TypeError('a deal from an empty deck');
  return card;
}
// an element the code has made sure of (a cell or layout, a ring cell before its count; none: a TypeError, as its read threw)
export function theOneMadeSure<Placed>(placed: Placed | undefined): Placed {
  if (placed === undefined) throw new TypeError('an element made sure of is missing');
  return placed;
}
