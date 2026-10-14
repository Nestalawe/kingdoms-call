# R-052: Nearby lairs do not repeat an item's effect

- **Decided:** 2026-09-26, Toby
- **Status:** Confirmed
- **Source:** DEV_LOG v2026.09.26-1647 §243 (Toby's report); PR #76 item 5 (2026-10-13)
- **Enforced by:** [`lair-effects-spread`](../../tests/lair-effects-spread.test.js)

Two items count as the same when they do the same thing, whatever their name, slot or tier. When a world is stocked, no province holds two items with the same effect, and lairs within 3 provinces of each other get different effects while the treasury has anything else to give.
