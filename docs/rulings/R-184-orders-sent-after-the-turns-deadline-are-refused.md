# R-184: Orders sent after the turn's deadline are refused

- **Decided:** 2026-10-31, a maintainer
- **Status:** Confirmed
- **Source:** Question 5: may a realm send its orders after the turn's deadline, before the GM's tab runs the turn? Answer: option 1, orders sent after the deadline are refused, with a clear message. Question 80 (found 2026-11-15, on the late drafts; R-164's question 80 is another): after the turn's deadline, may a realm still save a draft or revise its orders? Answer: option 1, refused too, with the same message; the maintainers' answer of 28 November.
- **Enforced by:** [`23_saving_orders.test.sql`](../../supabase/tests/database/23_saving_orders.test.sql), [`the-player-portals-game-lists-save-and-submit-on-the-values-handed-them`](../../tests/page/the-player-portals-game-lists-save-and-submit-on-the-values-handed-them.test.ts)

In a game whose turns run at a deadline, a realm's orders are in by the deadline or not at all. Orders sent after it
are refused, and the order form says why: "This turn's deadline has passed: orders can no longer be sent or changed."
A game in manual or automatic mode has no deadline. Example: the deadline is 20:00. Bram sends his orders at 20:10,
and the GM's tab runs the turn at 21:00. Bram's orders are refused at 20:10, and the turn runs on what his realm had
saved by 20:00. Saving a draft, changing the order of the heroes and Revise are refused after the deadline too,
with the same message: at 20:10 Bram can't save a draft with a new march for Sir Aldric either.

**Note:** Built in P2-05. The database's function for saving orders refuses them, and the order form saves every
draft, hero order, Revise and Submit through it, for the turn the form shows, and shows the function's words. The
access layer's test `tests/db/the-orders-change-only-the-realm-they-write-as-each-role.test.ts` checks the same
refusals against the local database (it runs in `npm run test:db`, not in `npm test`).

In the maintainer's words: "refuse orders after the deadline, with a clear message"
