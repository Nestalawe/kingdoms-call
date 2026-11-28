# R-043: Bots know only what a player in their seat could know

- **Decided:** 2026-09-24, a maintainer
- **Status:** Confirmed
- **Source:** DEV_LOG v2026.09.24-1126 §103 (a maintainer / bot review A5), v2026.09.24-0731 §84–85
- **Enforced by:** [`the-bots-plan-the-same-orders-whatever-their-realm-cannot-see-r-043-in-whole-bot-games`](../../tests/simulation/the-bots-plan-the-same-orders-whatever-their-realm-cannot-see-r-043-in-whole-bot-games.test.ts)

A bot plans from what a human in its seat would know: what its characters see, what it remembers seeing (six turns), a rival's skills only from spying (eight turns) or else an assumed ordinary profile, and lair odds from the same rumour bands a player reads. It never reads hidden state.

**Note:** Enforced in part. The test's known list names the rows (B-17g to k) whose fixes make it hold in full; each row empties its entry.
