# R-075: Eliminated realms and dispatches

- **Decided:** 2026-09-29, Toby; details 2026-10-15
- **Status:** Confirmed
- **Source:** Toby's answer of 2026-09-29 (plan decision D-02); his answers of 2026-10-15 in PR #95
- **Enforced by:** [`22_block_eliminated_msgs.test.sql`](../../supabase/tests/database/22_block_eliminated_msgs.test.sql) (the switch), [`eliminated-dispatches`](../../tests/eliminated-dispatches.test.js) (the screens), [`eliminated-report`](../../tests/eliminated-report.test.js) (the report tells a realm it is extinguished)

A realm that is eliminated or has conceded sends no private dispatches until the game is over. It may still write in the public channel, unless the GM turns on "Block eliminated realms from sending dispatches" for that game.

Toby's answers of 2026-10-15:
- **"Eliminated" means extinguished:** the realm's king has fallen and it holds no land (the Diplomacy card's ☠ Extinguished), even if another of its heroes still lives.
- **Reading doesn't change:** a realm that is out still reads the public channel and every private conversation it is in.
- **Once the game is over, private sending reopens both ways:** every realm may write privately to any realm it has met, whether that realm is out or not.

**Note:** Built (plan step P0-25: the switch in the database, #94; the screens, #95). It is enforced on screen only: P2-04 moves it into the database.

**Open:** Read as a per-game switch. Say if it was meant per player.
