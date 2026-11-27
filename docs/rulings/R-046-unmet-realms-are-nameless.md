# R-046: Realms you have not met are nameless

- **Decided:** 2026-09-24, a maintainer
- **Status:** Confirmed
- **Source:** DEV_LOG v2026.09.24-1319 §137 (item 5), v2026.09.27-2339 §315 (item 3)
- **Enforced by:** [`whole-all-bot-games-pay-whole-wages-and-no-realms-titles-name-a-realm-it-has-not-met`](../../tests/simulation/whole-all-bot-games-pay-whole-wages-and-no-realms-titles-name-a-realm-it-has-not-met.test.ts), [`what-each-realm-may-see-of-the-world`](../../tests/unit/what-each-realm-may-see-of-the-world.test.ts), [`realm-reports`](../../tests/unit/realm-reports.test.ts)

Until you meet a realm, nothing names it to you: title intelligence skips it, the Titles & Victory card shows "an unknown realm" / "an unknown champion" (scores and titles held are still shown), and broadcast lines you are not party to say "an unknown realm". Everything is revealed when the game is over. Dispatches are unaffected (a maintainer's wish).
