# R-157: A lair beast talked down by parley counts as pacified, not slain

- **Decided:** 2026-11-05, a maintainer
- **Status:** Confirmed
- **Source:** Question 38: a lair beast talked down by parley counts as a kill in play, and as half the merit in the code's notes: which is right? Answer: option 1, a parley pacifies the beast: half the merit, no hit points. Question 169 (2026-11-28): once Talk returns, does a hero who talks a lair's guardian down still roll for his wounds? Answer: option 1, he rolls for his wounds, as any wounded hero does; the maintainers' answer of 28 November.
- **Enforced by:** [`explore-and-search-orders-called-directly`](../../tests/unit/explore-and-search-orders-called-directly.test.ts)

A lair beast won over by parley counts as pacified: half the Monster-Bane merit, and no earned hit points.
Example: Sir Aldric searches the Drowned Mill and talks its Marsh Rat down; he gains half the merit of slaying it,
and his maximum hit points don't rise. The Talk tactic that makes a parley is switched off in the game today, so the
rule holds for each parley once it is switched on again.

"No earned hit points" is the win's award only: a hero wounded before he talks the beast down still rolls for his
wounds, as any wounded hero who isn't a fight's winner does. Sir Tomas, wounded in the first round, talks the wyvern
down and rolls for his wounds.

The question was: the code's notes say a parley gives half the merit; in play it counts as a kill. Option 1: "a
parley counts as pacifying the beast: half the merit, no hit points".

In the maintainer's words: "(1)"
