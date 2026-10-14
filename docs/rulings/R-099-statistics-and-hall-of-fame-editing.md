# R-099: Who sees statistics and edits the Hall of Fame

- **Decided:** 2026-10-11, Toby
- **Status:** Confirmed
- **Source:** Toby's answers of 2026-10-11 (plan decisions D-09 and D-11); PRs #63, #64
- **Enforced by:** [`hall-of-fame-controls`](../../tests/hall-of-fame-controls.test.js), [`stats-forget-deleted`](../../tests/stats-forget-deleted.test.js), [`04_telemetry.test.sql`](../../supabase/tests/database/04_telemetry.test.sql), [`05_game_records.test.sql`](../../supabase/tests/database/05_game_records.test.sql)

A GM sees and edits the statistics and Hall of Fame entries of their own games; the Overlord sees and edits every game's. Only the Overlord renames a player on the Hall of Fame.
