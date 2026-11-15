# R-184: Orders sent after the turn's deadline are refused

- **Decided:** 2026-10-31, a maintainer
- **Status:** Decided, not built
- **Source:** Question 5: may a realm send its orders after the turn's deadline, before the GM's tab runs the turn? Answer: option 1, orders sent after the deadline are refused, with a clear message.
- **Enforced by:** [`23_saving_orders.test.sql`](../../supabase/tests/database/23_saving_orders.test.sql)

In a game whose turns run at a deadline, a realm's orders are in by the deadline or not at all. Orders sent after it
are refused, and the order form says why: "This turn's deadline has passed: orders can no longer be sent or changed."
A game in manual or automatic mode has no deadline. Example: the deadline is 20:00. Bram sends his orders at 20:10,
and the GM's tab runs the turn at 21:00. Bram's orders are refused at 20:10, and the turn runs on what his realm had
saved by 20:00.

**Note:** Decided, not yet built. The database's function for saving orders refuses them (P2-05's first pull
request); the order form sends its orders through it in P2-05's second.

**Open:** whether saving a draft, the order of the heroes and Revise follow the same rule:
[question 80](../questions-for-the-maintainers.md#80-after-the-turns-deadline-may-a-realm-still-save-a-draft-or-revise-its-orders).
Until a maintainer rules, they do.

In the maintainer's words: "refuse orders after the deadline, with a clear message"
