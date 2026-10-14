# R-068: Archive a game instead of deleting it

- **Decided:** 2026-09-27, Toby asked; one point is the agent's
- **Status:** To confirm
- **Source:** DEV_LOG v2026.09.27-2339 §313, §321
- **Enforced by:** [`fuzz-advance-masking`](../../tests/fuzz-advance-masking.test.js), [`stats-forget-deleted`](../../tests/stats-forget-deleted.test.js)

A GM can archive a finished game: it leaves the active list, the automatic turn watcher skips it, and players can still open it and read every past turn. Deleting a game deletes all its data, its statistics and Hall of Fame entry included.

**Open:** Archived games stay on the Hall of Fame (hide one with the Stats tab's hide flag). Archiving could also hide it from the board: one line. Toby's call.
