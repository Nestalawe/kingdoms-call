# R-121: A Curse spell halves a commander's Druid in battle too, as it does his Druid mastery

- **Decided:** 2026-11-02, Toby
- **Status:** Confirmed
- **Source:** Plan question 32, built in PR #366
- **Enforced by:** [`the-commanders-items-no-matrix-game-carries-keep-their-values`](../../tests/unit/the-commanders-items-no-matrix-game-carries-keep-their-values.test.ts)

A Curse spell halves every skill of the hero it strikes for the rest of the turn. In a battle that turn, the Druid
check counts his Druid as the Curse left it, as his Druid mastery already did: units that need more Druid than he has
left fight weaker, 20% for each level short. Example: a commander of Druid 4 leading Cave Trolls (which need Druid 4)
is cursed in Spring; his Druid is 2, so in a Summer battle his trolls fight at 60% strength.

**Open:** (plan question 50) a Curse cast on the commander during the battle itself halves his Druid after the
check has counted it to 5, while the mastery halves his whole Druid. A Druid 8 commander's Titan Warbeasts fight at
40% there, not 80%. Today's figure stands until Toby rules.

The question was: a cursed commander's beasts fought at full strength, though the turn's Druid mastery counted his
Druid halved. Option 1: "the battle counts the Curse too, as the mastery does".

In Toby's words: "(1)"
