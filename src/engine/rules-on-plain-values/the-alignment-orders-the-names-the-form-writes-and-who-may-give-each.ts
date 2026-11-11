// ── The alignment orders: the names the order form writes, and who may give each (plan P1-11d7) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). An alignment order's row (src/content/alignment-orders-their-keys-names-creeds-numbers-and-
// words.ts) says its name, its creed and whether the king alone gives it. Two checks read them, here and nowhere else:
// a realm of the order's creed alone may give it, and a hero who isn't the king may not give one the king alone gives.
// The turn's five resolvers ask each (and refuse with their own line), and the order form's list (actionsFor, through
// src/shared/) asks both before it offers one; the form's list and its table of the orders read the names from here.
//
// The table is made when it is asked for, a new one each time, and this file runs nothing as it loads.
import {
  THE_ALIGNMENT_ORDERS,
  type AnAlignmentOrder,
} from '../../content/alignment-orders-their-keys-names-creeds-numbers-and-words.ts';

/** The slug of an alignment order: the name of its row (`consecrate`, `harvest-the-field`). */
type TheSlugOfAnAlignmentOrder = keyof typeof THE_ALIGNMENT_ORDERS;

/** Whether a realm of the creed `creed` (none: a realm whose creed isn't known) may give the order: its row's creed
 *  alone may. */
export function aRealmOfThisCreedMayGiveTheAlignmentOrder(
  order: Pick<AnAlignmentOrder, 'creed'>,
  // (null where the order form's report gives the realm's creed as none: compared only)
  creed: string | null | undefined,
): boolean {
  return creed === order.creed;
}

/** Whether a hero, the king or not (`isKing`; none: not the king), may give the order: any hero may, unless its row
 *  marks it the king's alone. */
export function aHeroMayGiveTheAlignmentOrderAsKingOrNot(
  order: Pick<AnAlignmentOrder, 'theKingAlone'>,
  isKing: boolean | null | undefined,
): boolean {
  return !order.theKingAlone || (isKing ?? false);
}

/** The name the order form writes for the alignment order of the slug `slug`. */
export function theNameTheFormWritesOfTheAlignmentOrder(slug: TheSlugOfAnAlignmentOrder): string {
  return THE_ALIGNMENT_ORDERS[slug].name;
}

/** The alignment orders by the name the order form writes, each its row, in the rows' order. */
export function theAlignmentOrdersByTheNameTheFormWrites(): Record<string, AnAlignmentOrder> {
  return Object.fromEntries(Object.values(THE_ALIGNMENT_ORDERS).map((order) => [order.name, order]));
}
