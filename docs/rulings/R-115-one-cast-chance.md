# R-115: One cast chance for everyone, and what raises it

- **Decided:** 2026-10-15, Toby
- **Status:** Confirmed
- **Source:** PR #89 item 9 (decision D7 on a player's rulebook review, and a follow-up answer on cast chance)
- **Enforced by:** [`guard-cast-chance`](../../tests/guard-cast-chance.test.js), [`rulebook-review-words`](../../tests/rulebook-review-words.test.js)

Every cast succeeds at 30% plus 10% per level in the school, at most 95%: 40% at level 1, 80% at level 5. A
hero guarding a neutral province casts at the same odds as a player's hero (it was 30% + 15% a level, at most
90%). Trained levels past 5 do not raise the chance; a magic item that adds levels in the school does, 10% a
level up to 95%, and mastery brings casting bonuses of its own, found in play. The rulebooks say what the game
does.
