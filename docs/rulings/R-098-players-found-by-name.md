# R-098: GMs find players by name, never by email

- **Decided:** 2026-10-11, Toby
- **Status:** Confirmed
- **Source:** Toby's answer of 2026-10-11 (plan decision D-08); PRs #59, #61
- **Enforced by:** [`profiles-no-email`](../../tests/profiles-no-email.test.js), [`eslint-rule-big-tables-and-profiles-are-read-by-named-columns`](../../tests/unit/eslint-rule-big-tables-and-profiles-are-read-by-named-columns.test.ts), [`06_profiles.test.sql`](../../supabase/tests/database/06_profiles.test.sql)

A GM inviting players finds them by name; where two share a name, the month each joined is shown. A player's email is readable only by its owner.
