# R-073: Private dispatches are private; players report

- **Decided:** 2026-09-29, a maintainer
- **Status:** Confirmed
- **Source:** Decisions D-01, D-13g and D-13 follow-up 1 (2026-09-29 and 2026-10-11): does a game's GM read players' private dispatches, and who hears of a dispatch a player reports? Answer: only the realms in the conversation and the Overlord read one; a report goes to the GM, or to the Overlord when the GM plays a realm in that game. PRs #72, #77, #78.
- **Enforced by:** [`a-dispatch-reported-is-kept-as-the-players-realms-and-the-gm-portal-lists-it-as-text-and-deletes-it`](../../tests/page/a-dispatch-reported-is-kept-as-the-players-realms-and-the-gm-portal-lists-it-as-text-and-deletes-it.test.ts), [`17_message_reports.test.sql`](../../supabase/tests/database/17_message_reports.test.sql), [`18_private_dispatches.test.sql`](../../supabase/tests/database/18_private_dispatches.test.sql)

A private dispatch is read only by the realms in the conversation and the site's Overlord. The game's GM does not read private dispatches. A player can Report a dispatch they received, with an optional reason; the report goes to the game's GM, or to the Overlord when the GM plays a realm in that game. The GM can delete a reported dispatch. The sender is not told.
