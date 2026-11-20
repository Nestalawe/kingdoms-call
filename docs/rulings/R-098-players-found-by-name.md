# R-098: GMs find players by name, never by email

- **Decided:** 2026-10-11, a maintainer
- **Status:** Confirmed
- **Source:** Decision D-08 (2026-10-11): how does a GM find the players to invite? Answer: by name, never by email. PRs #59, #61.
- **Enforced by:** [`no-screen-shows-another-players-email-with-the-email-column-there-or-taken-away`](../../tests/page/no-screen-shows-another-players-email-with-the-email-column-there-or-taken-away.test.ts), [`eslint-rule-big-tables-and-profiles-are-read-by-named-columns`](../../tests/unit/eslint-rule-big-tables-and-profiles-are-read-by-named-columns.test.ts), [`06_profiles.test.sql`](../../supabase/tests/database/06_profiles.test.sql)

A GM inviting players finds them by name; where two share a name, the month each joined is shown. A player's email is readable only by its owner.
