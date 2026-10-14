# R-073: Private dispatches are private; players report

- **Decided:** 2026-09-29, Toby
- **Status:** Confirmed
- **Source:** Toby's answers of 2026-09-29 and 2026-10-11 (plan decisions D-01, D-13g and D-13 follow-up 1); PRs #72, #77, #78
- **Enforced by:** [`report-dispatch`](../../tests/report-dispatch.test.js), [`17_message_reports.test.sql`](../../supabase/tests/database/17_message_reports.test.sql), [`18_private_dispatches.test.sql`](../../supabase/tests/database/18_private_dispatches.test.sql)

A private dispatch is read only by the realms in the conversation and the site's Overlord. The game's GM does not read private dispatches. A player can Report a dispatch they received, with an optional reason; the report goes to the game's GM, or to the Overlord when the GM plays a realm in that game. The GM can delete a reported dispatch. The sender is not told.
