# R-117: Spy 8 reads the province a hero stands in, every turn, for nothing

- **Decided:** 2026-10-15, Toby
- **Status:** Confirmed
- **Source:** Batch 2026-10-15 (second batch), item 1: the Spy 8 perk did nothing, since Spy 6 already makes spying certain
- **Enforced by:** [`spy-eight-watch`](../../tests/spy-eight-watch.test.js)

At Spy 8 a hero is Ever Watchful: at the end of every turn they learn what a Spy on the province they stand in would
show (the characters there and the units each leads, in the report's province intel and on the map), without giving
the order. It is the information only: no Spymaster merit, no experience roll, no discovery theft from a capital and
no counter-intelligence alert to the province's owner. A province the realm already spied that turn is left alone.

In Toby's words: "the hero gets information about heroes at the end of each turn as if they had made a Spy Province
order, i.e. they get the info without having to do the order."
