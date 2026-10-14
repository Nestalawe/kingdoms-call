# R-074: Dispatch limits

- **Decided:** 2026-09-29, Toby
- **Status:** Confirmed
- **Source:** Toby's answer of 2026-09-29 (plan decision D-05); PRs #66, #67
- **Enforced by:** [`dispatch-limits`](../../tests/dispatch-limits.test.js), [`16_dispatch_limits.test.sql`](../../supabase/tests/database/16_dispatch_limits.test.sql)

A dispatch is at most 500 characters (longer ones already sent stay readable). Each player may send 10 a minute and 300 a day in each game.
