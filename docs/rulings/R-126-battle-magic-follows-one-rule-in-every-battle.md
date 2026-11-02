# R-126: Battle magic follows one rule in every battle, as between two heroes

- **Decided:** 2026-11-02, Toby
- **Status:** Confirmed
- **Source:** Plan question 27, built in PR #372
- **Enforced by:** [`the-battle-magic-lines-no-matrix-game-reaches-keep-their-values`](../../tests/unit/the-battle-magic-lines-no-matrix-game-reaches-keep-their-values.test.ts), [`the-battle-spells-each-copy-casts-keep-their-values`](../../tests/unit/the-battle-spells-each-copy-casts-keep-their-values.test.ts)

Battle magic before an army battle works the same way in a battle between two heroes' hosts, in a hero's battle
against a province's neutral guards, and for the guards' commander casting at him:
1. **Lightning Bolt** strikes as many enemy units as the caster's level, counted to 5 (at least one). Example: a
   neutral warlord at Elemental 7 (5 and an Orb of the Storm) casts it at Lady Wren's eight companies: 5 lose a fifth
   of their strength, as 5 of his would had she cast it.
2. **Telekinetic Storm** halves the enemy commander's Tactical bonus (R-031) only when he has some Tactical and the
   battle is on land. At sea, or at a commander with no Tactical, it marks him (no second storm is chosen against him)
   and its line says it finds no tactical command to disrupt. It never weakened anyone there: there is no Tactical
   bonus at sea, and a ×1 bonus halved is still ×1.

Each kind of battle keeps its own words for the lines. The question was: against guards, the warlord's Lightning Bolt
counted his level past 5, and a Telekinetic Storm said it scattered a commander's formations at sea and at a commander
with no Tactical. Option 1: "one rule everywhere, as between heroes: the level counted to 5, and no storm at sea".

In Toby's words: "(1)"
