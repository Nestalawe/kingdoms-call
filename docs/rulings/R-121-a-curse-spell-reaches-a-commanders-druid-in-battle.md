# R-121: A Curse spell halves a commander's Druid in battle too, as it does his Druid mastery

- **Decided:** 2026-11-02, a maintainer
- **Status:** Confirmed
- **Source:** Question 32: does a Curse halve a commander's Druid in battle, as it does his Druid mastery? Answer: option 1, the battle counts the Curse too. Built in PR #366.
- **Enforced by:** [`the-commanders-items-no-matrix-game-carries-keep-their-values`](../../tests/unit/the-commanders-items-no-matrix-game-carries-keep-their-values.test.ts)

A Curse spell halves every skill of the hero it strikes for the rest of the turn. In a battle that turn, the Druid
check counts his Druid as the Curse left it, as his Druid mastery already did: units that need more Druid than he has
left fight weaker, 20% for each level short. Example: a commander of Druid 4 leading Cave Trolls (which need Druid 4)
is cursed in Spring; his Druid is 2, so in a Summer battle his trolls fight at 60% strength.

A Curse cast on the commander during the battle itself: [R-159](R-159-a-curse-in-battle-halves-a-master-druids-whole-druid.md).

The question was: a cursed commander's beasts fought at full strength, though the turn's Druid mastery counted his
Druid halved. Option 1: "the battle counts the Curse too, as the mastery does".

In the maintainer's words: "(1)"
