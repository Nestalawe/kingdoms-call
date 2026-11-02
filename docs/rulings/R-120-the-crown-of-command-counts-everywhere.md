# R-120: The Crown of Command counts everywhere, while its wearer stands beside the hero

- **Decided:** 2026-10-31, Toby
- **Status:** Confirmed
- **Source:** Plan question 13, built in PRs #366 and #368
- **Enforced by:** [`the-commanders-items-no-matrix-game-carries-keep-their-values`](../../tests/unit/the-commanders-items-no-matrix-game-carries-keep-their-values.test.ts), [`the-player-portals-copies-agree-with-the-engine`](../../tests/unit/the-player-portals-copies-agree-with-the-engine.test.ts)

The Crown of Command raises every skill of its wearer's realm's heroes in his province by 1, and every rule counts
it: the battle's Druid check (how well a commander leads beasts and other races' troops), his Druid mastery, his army
card, and the spells he may cast. A hero beside the wearer leads his units as if his Druid were a level higher, as his
army card already showed. The Crown is counted where its wearer stands when each thing happens: if the wearer has left
the province before the battle or the cast, the hero gets no benefit from it then, extra casts included. The battle's
Druid check reads a commander's Druid as every rule counts it, still counted to 5 there.

The question was: a hero beside the Crown's wearer has his Druid mastery and army card counting the Crown, but in
battle his beasts fought as if it weren't there, and the order form offered fewer casts than the turn allowed. Option
1: "the Crown counts everywhere: the battle's Druid check counts it, and the order form offers spells at the level
with it".

In Toby's words: "(1) but if the hero loses the skill advantage during the actual running of the turn, they lose any
benefit, including being able to cast extra spells etc"
