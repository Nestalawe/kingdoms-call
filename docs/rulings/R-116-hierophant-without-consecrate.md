# R-116: Consecrate does not count toward the Hierophant

- **Decided:** 2026-10-15, Toby
- **Status:** Confirmed
- **Source:** PR #89 item 10 (decision D8 on a player's rulebook review)
- **Enforced by:** [`hierophant-no-consecrate`](../../tests/hierophant-no-consecrate.test.js)

The Hierophant counts the highest White skill plus Bless Province, Holy Symbol and Resurrect casts.
Consecrate no longer counts: only a Divine king can consecrate, so it was a route to a title that only one
creed had. This keeps R-002 (every alignment competes for every title on the same terms).
