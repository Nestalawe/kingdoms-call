# R-192: Orders saved for an earlier turn and sent late keep only their order of heroes

- **Decided:** 2026-11-15, a maintainer
- **Status:** Confirmed
- **Source:** A maintainer's answer, recorded as P1-23f's row of [the rulings to build](../backlog/the-rulings-decided-not-built.md) on 2026-11-15 (#594, #603, #611): orders saved for an earlier turn and sent late keep only their order of heroes; the turn refuses the rest of them, as it already refuses their research choices. Built in P1-23f's pull request. Question 172 (2026-11-28): do orders stamped for a later turn also keep only their order of heroes? Answer: option 1, refused the same way, as built; the maintainers' answer of 28 November.
- **Enforced by:** [`set-up-and-order-merge-called-directly`](../../tests/unit/set-up-and-order-merge-called-directly.test.ts), [`set-up-and-order-merge-in-a-whole-turn`](../../tests/scenario/set-up-and-order-merge-in-a-whole-turn.test.ts)

Orders carry the turn they were saved for. When a realm's orders saved for an earlier turn reach a later one, the
turn keeps only the order the realm keeps its heroes in on its orders column. It refuses everything else in them,
as it refuses their heroes' orders and research choices: no declaration (of war or a Treat), no call for the
Reckoning, no message, no concession. The GM is told the orders were refused. Example: the realm of Varrow saved
its orders on Turn 8, with a declaration of war on Esk, a message to Esk and its heroes reordered, and they arrive
on Turn 9. On Turn 9 its heroes stand in the new order, war is not declared, no message reaches Esk, and every hero
of Varrow Defends.

Orders stamped for a later turn are refused the same way. The GM's run of Turn 8 fails and the game stays on Turn 8,
but Varrow's form already shows Turn 9 and sends a concession: the turn refuses it.
