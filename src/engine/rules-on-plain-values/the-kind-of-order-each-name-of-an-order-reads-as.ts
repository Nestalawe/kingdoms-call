// ── The kind of order each name of an order reads as (plan P1-11e20) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). The turn reads each order's action (a spelling the order form or a bot wrote) as one kind of
// order: processOrder and the phase pipeline (turn/phase-intents-and-dependency-ordering.ts) read it so; the
// order form reads its own orders so to put a season's heroes in the turn's order (moved as they were, P1-11e20).
import {
  THE_HERO_ORDERS,
  THE_KIND_A_BLANK_OR_UNKNOWN_ORDER_READS_AS,
  type AHeroOrder,
} from '../../content/the-hero-orders-their-keys-the-names-the-turn-reads-them-by-and-their-tiers.ts';

/** A row of the hero orders (content). */
type AHeroOrdersRow = (typeof THE_HERO_ORDERS)[keyof typeof THE_HERO_ORDERS];

// The kinds of order (plan P1-10a2): the hero orders' rows' keys (THE_HERO_ORDERS, src/content/the-hero-orders-…), but
// Pursue's, a saved name that reads as an Encounter: what an order's action reads as. A phase order's own type is
// PhaseOrder (src/schemas/orders-a-realm-submits.ts), whose action is a spelling the form or a bot wrote. Every kind has
// its resolver in the hero orders' registry (src/engine/orders/the-registry-of-the-hero-orders-…, B-06ao) but
// forced_march, which processOrder makes a Move before it: a row added with no resolver there fails to compile
// (P1-10z). A row's readsAs that is no kind fails to compile too (the map's `satisfies`).
export type OrderKind = Exclude<AHeroOrdersRow, { readonly readsAs: string }>['key'];

/** The kind a row's names read as: its own key, or the kind it reads as (Pursue's). */
function theKindARowsNamesReadAs(row: AHeroOrdersRow): OrderKind {
  return 'readsAs' in row ? row.readsAs : row.key;
}

// Canonical order-name → internal action-key map. Shared by processOrder and the phase pipeline
// (buildPhaseIntents / phaseDependencies) so both always agree on what a character is doing. Built from the hero
// orders' rows, in their order: each name a row reads, to its kind (B-06al).
export const PHASE_ACTION_MAP = Object.fromEntries(
  Object.values(THE_HERO_ORDERS).flatMap((row) =>
    row.theNamesTheTurnReads.map((name) => [name, theKindARowsNamesReadAs(row)]),
  ),
) satisfies Record<string, OrderKind>;

// (a key Object's prototype holds, such as `constructor`, gives its value: no order's action is one)
export function normaliseAction(order: { readonly action?: string | null | undefined } | null | undefined): string {
  const raw = ((order?.action ?? '') || THE_KIND_A_BLANK_OR_UNKNOWN_ORDER_READS_AS).toLowerCase().trim();
  const theKindByName: Readonly<Partial<Record<string, string>>> = PHASE_ACTION_MAP;
  return (theKindByName[raw] ?? '') || THE_KIND_A_BLANK_OR_UNKNOWN_ORDER_READS_AS;
}

/** Each kind's hero order's row, by the row's key (Pursue's among them: a saved name, which no order's kind is). */
const THE_ROW_OF_EACH_KIND_OF_ORDER: ReadonlyMap<string, AHeroOrder> = new Map(
  Object.values(THE_HERO_ORDERS).map((row): [key: string, row: AHeroOrder] => [row.key, row]),
);
/** The hero order's row of a kind of order (B-06an: the checks before an order read its fields). Every kind is a row's
 *  key (OrderKind is the rows' keys), so there is always one; for none, a row with no field, as the checks read it. */
export function theHeroOrdersRowOfAKind(kind: OrderKind): AHeroOrder {
  return THE_ROW_OF_EACH_KIND_OF_ORDER.get(kind) ?? { key: kind, theNamesTheTurnReads: [], tier: 0 };
}
