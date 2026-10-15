# R-097: Game Masters and the Overlord

- **Decided:** 2026-10-11, Toby
- **Status:** Confirmed
- **Source:** Toby's answers of 2026-10-11 (plan decision D-13 and its follow-ups); PRs #37, #47, #51, #52
- **Enforced by:** [`gm-offer-and-gate`](../../tests/gm-offer-and-gate.test.js), [`gm-portal-no-signup`](../../tests/gm-portal-no-signup.test.js), [`12_site_admins.test.sql`](../../supabase/tests/database/12_site_admins.test.sql), [`13_game_masters.test.sql`](../../supabase/tests/database/13_game_masters.test.sql), [`14_only_game_masters.test.sql`](../../supabase/tests/database/14_only_game_masters.test.sql), [`19_overlord_master_gm.test.sql`](../../supabase/tests/database/19_overlord_master_gm.test.sql), [`20_accounts.test.sql`](../../supabase/tests/database/20_accounts.test.sql), [`21_revoked_gms.test.sql`](../../supabase/tests/database/21_revoked_gms.test.sql), [`overlord-suspend-delete`](../../tests/overlord-suspend-delete.test.js), [`overlord-page`](../../tests/overlord-page.test.js), [`master-gm-mode`](../../tests/master-gm-mode.test.js)

Anyone can register and play. The Overlord (one account, separate from Toby's own player and GM login) offers the Game Master role to players, who accept it at the top of their player portal. Only Game Masters create games, and the GM portal opens only for Game Masters and the Overlord. Game Masters may play in games they create. The Overlord cannot play or create games, but can do every GM action on any game, revoke a Game Master (handing their unfinished games to another GM first), and suspend or delete accounts (deletion waits until the account's games finish). Existing GMs became Game Masters automatically. The rulebooks say that a game's GM can see the whole game.

**Note:** Built across plan steps P0-32a to P0-32i. A revoked Game Master keeps no right to change their finished games (P0-32i).
