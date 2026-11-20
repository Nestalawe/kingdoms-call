# R-074: Dispatch limits

- **Decided:** 2026-09-29, a maintainer
- **Status:** Confirmed
- **Source:** Decision D-05 (2026-09-29): how long may a dispatch be, and how many may a player send? Answer: at most 500 characters, and 10 a minute and 300 a day in each game. PRs #66, #67.
- **Enforced by:** [`the-player-portals-dispatches-desk-and-screens-on-the-values-handed-them`](../../tests/page/the-player-portals-dispatches-desk-and-screens-on-the-values-handed-them.test.ts), [`16_dispatch_limits.test.sql`](../../supabase/tests/database/16_dispatch_limits.test.sql)

A dispatch is at most 500 characters (longer ones already sent stay readable). Each player may send 10 a minute and 300 a day in each game.
