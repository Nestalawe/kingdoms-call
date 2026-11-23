# R-189: The GM page names each creed order as its row does

- **Decided:** 2026-11-22, a maintainer
- **Status:** Confirmed
- **Source:** Question 93: the GM page's statistics name two creed orders in words of their own ("Harvest Field", "Rite"); should they read the orders' names from their rows? Answer (2026-11-22): yes, the GM page reads the creed orders' names from their rows ("Harvest the Field", "Perform Rite").
- **Enforced by:** [`the-gms-statistics-tab-shows-and-exports-the-statistics-on-the-values-handed-it`](../../tests/unit/the-gms-statistics-tab-shows-and-exports-the-statistics-on-the-values-handed-it.test.ts), [`each-alignment-orders-name-creed-and-numbers-are-in-the-books-as-its-row-says`](../../tests/static/each-alignment-orders-name-creed-and-numbers-are-in-the-books-as-its-row-says.test.ts)

The GM page names each creed order as its row does: Harvest the Field, Perform Rite. Each of the five creed orders
(Consecrate, Call to Arms, the Broker, Harvest the Field, Perform Rite) has one name, written once, in its row of
`src/content/alignment-abilities-their-keys-names-numbers-and-words.ts`; the order form, the books and the GM's
Statistics tab all read it there. Example: a Pagan hero harvests the field; the bar for that order on the "What
players order" card says "Harvest the Field", as the hero's order form does. The two removed orders, Awaken the Wild
and Call from the Pit, have no row, so the tab keeps its own words for the turns that recorded them. The statistics'
exports keep each order's key (`harvest_field`, `rite`), not its name.

**Note:** Built in P1-19ba2: `STATS_ACTION_LABEL` in `src/ui/gm/stats-tab.ts` reads the two names from the rows, as it
already read the other three. A name longer than its bar's 110 px label column is cut with an ellipsis, and its hover
text gives it whole.
