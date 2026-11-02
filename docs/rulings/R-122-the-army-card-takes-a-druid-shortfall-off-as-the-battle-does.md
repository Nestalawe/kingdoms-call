# R-122: The army card takes a Druid shortfall off as the battle does

- **Decided:** 2026-11-02, Toby
- **Status:** Confirmed
- **Source:** Plan question 28 (b), built in PR #367
- **Enforced by:** [`the-player-portals-copies-agree-with-the-engine`](../../tests/unit/the-player-portals-copies-agree-with-the-engine.test.ts)

The army card on a player's report shows each unit's strength as the battle counts it. Where the unit's commander
lacks the Druid to lead it, the card takes the shortfall (20% a level short) off the unit's base strength first and
rounds down, then counts its kin and a rival kin's leader, then the Druid mastery: the battle's order. Example: a
Human realm's Veteran Shieldwall Levies (12), raised in an Elven province and led by a Human hero with no Druid, are
one level short: they fight at 9 in battle, and the card now shows 9, not 10.

The question was: the card counted kin first, then took the shortfall off rounded to the nearest and never below 1,
so it could show one more than the battle. Option 1: "each forecast follows the turn".

In Toby's words: "(1)"
