# R-125: Three forecasts follow the turn: the Loremaster's Explore, a spare Traveller's Cloak and a Naval 8 hero's ships

- **Decided:** 2026-10-31, Toby
- **Status:** Confirmed
- **Source:** Plan question 15, built in PR #371
- **Enforced by:** [`the-player-portals-copies-agree-with-the-engine`](../../tests/unit/the-player-portals-copies-agree-with-the-engine.test.ts)

The order form and the army card forecast what the turn does, in three places where they did not:
1. **Explore.** The Loremaster title adds nothing to exploring. Example: Lady Wren holds the Loremaster; her Explore
   order in desert at Explorer 2 is forecast at 75%, the share the turn maps (it said 78%).
2. **Marching in.** Only a worn Traveller's Cloak adds its 20% to the share of a province a hero maps as he marches in.
   Example: Bram wears a Shadowcloak and carries a spare Traveller's Cloak in his pack; his march-in is forecast at 10%
   (Explorer 0), as the turn maps it (it said 30%).
3. **Ships.** A hero of Naval 8 or more needs half the hulls, as the turn counts it from his trained Naval. Example:
   Varn has Naval 8 and leads a Galleon Fleet and two Free Lances; his army card says the column can put to sea (it
   said "needs 2 hulls, has 1").

The turn is unchanged. The question was: three forecasts didn't follow the turn. Option 1: "each forecast follows the
turn".

In Toby's words: "(1)"
