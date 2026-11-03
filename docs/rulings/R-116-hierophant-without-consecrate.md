# R-116: Consecrate does not count toward the Hierophant

- **Decided:** 2026-10-15, Toby
- **Status:** Confirmed
- **Source:** PR #89 item 10 (decision D8 on a player's rulebook review)
- **Enforced by:** [`recruit-hire-and-realm-works-orders-in-a-whole-turn`](../../tests/scenario/recruit-hire-and-realm-works-orders-in-a-whole-turn.test.ts) (no merit for it), [`the-books-say-consecrate-does-not-count-toward-the-hierophant`](../../tests/static/the-books-say-consecrate-does-not-count-toward-the-hierophant.test.ts)

The Hierophant counts the highest White skill plus Bless Province, Holy Symbol and Resurrect casts.
Consecrate no longer counts: only a Divine king can consecrate, so it was a route to a title that only one
creed had. This keeps R-002 (every alignment competes for every title on the same terms).
