# R-096: Goblin Hordes muster two a turn

- **Decided:** 2026-10-11, Toby
- **Status:** Confirmed
- **Source:** PR #46
- **Enforced by:** [`recruit-hire-and-realm-works-orders-in-a-whole-turn`](../../tests/scenario/recruit-hire-and-realm-works-orders-in-a-whole-turn.test.ts) (the turn's gate), [`the-order-form-offers-two-goblin-hordes-a-turn-and-one-of-the-orc-berserkers`](../../tests/unit/the-order-form-offers-two-goblin-hordes-a-turn-and-one-of-the-orc-berserkers.test.ts) (the order form)

A province that raises Goblin Hordes turns out two in one turn. Other units, Orc Berserkers included, stay at one.
