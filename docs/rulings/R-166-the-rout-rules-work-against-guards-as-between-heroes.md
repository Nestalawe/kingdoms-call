# R-166: The rout rules work against a province's guards as between heroes

- **Decided:** 2026-11-15, a maintainer
- **Status:** Confirmed
- **Source:** Question 57: four rout rules skip a battle against a province's guards: do they work there too? Answer: option 1, each works against guards as between heroes.
- **Enforced by:** [`four-rout-rules-work-against-a-provinces-guards-as-between-heroes`](../../tests/unit/four-rout-rules-work-against-a-provinces-guards-as-between-heroes.test.ts)

Four rules of the rout work in a battle against a province's guards as in one between heroes:
- the winner's Relentless Hunt (Manticores) and Feeding Frenzy (Shark Shoals) add +15% to the beaten guards' losses;
- a guard's own Warg Riders may run a beaten hero down;
- the guards' beaten Cave Trolls roll Regenerating Hide's 30%;
- the guards' beaten Shield Fort, and a Knightly Example, stop a survivor dropping a tier.

Either side's winner: a guard's own Manticores and Shark Shoals hunt a beaten hero too, as between heroes. The guards'
survivors keep their tier when they held a Shield Fort in the battle, or have a Gilded Lances company among them. No
unit's text gives an exception; the Warg Riders' text and the rulebook say a guard's own wargs run a beaten army down.

The question was: four rout rules skip a battle against a province's guards. Option 1: "each ability works against
guards as between heroes".

In the maintainer's words: "(1)"
