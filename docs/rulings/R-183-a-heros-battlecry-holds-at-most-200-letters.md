# R-183: A hero's battlecry holds at most 200 letters

- **Decided:** 2026-10-31, a maintainer
- **Status:** Confirmed
- **Source:** Question 7: how long may a hero's battlecry be? Answer: option 1, at most 200 letters, cut by the turn and limited on the order form, as a new heir's name is limited to 40.
- **Enforced by:** [`set-up-and-order-merge-called-directly`](../../tests/unit/set-up-and-order-merge-called-directly.test.ts), [`set-up-and-order-merge-in-a-whole-turn`](../../tests/scenario/set-up-and-order-merge-in-a-whole-turn.test.ts), [`the-order-forms-battlecry-fields-hold-at-most-200-letters`](../../tests/page/the-order-forms-battlecry-fields-hold-at-most-200-letters.test.ts)

A hero's battlecry, part of his encounter plan, holds at most 200 letters. Every battlecry field of the order forms
(each hero's, and the card of a hero to be raised, charmed or hired) stops at 200, and the turn keeps only the first
200 letters of a longer one, as it keeps only the first 40 letters of a new heir's name. A battlecry already saved
stays as it is until the realm sends its plan again. Example: Sir Aldric's battlecry, "For the realm, the river and
the old king's oath!", is shouted whole at the foe as a fight begins; a battlecry of 250 letters is shouted as its
first 200.

In the maintainer's words: "(1)"
