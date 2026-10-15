# R-075: Eliminated realms and dispatches

- **Decided:** 2026-09-29, Toby
- **Status:** Confirmed
- **Source:** Toby's answer of 2026-09-29 (plan decision D-02)
- **Enforced by:** [`22_block_eliminated_msgs.test.sql`](../../supabase/tests/database/22_block_eliminated_msgs.test.sql) (the switch; the screen comes in P0-25's site part)

A realm that is eliminated or has conceded sends no private dispatches until the game is over. It may still write in the public channel, unless the GM turns on "Block eliminated realms from sending dispatches" for that game.

**Note:** Decided; being built (plan step P0-25: the switch in the database, then the screens).

**Open:** Read as a per-game switch. Say if it was meant per player.
