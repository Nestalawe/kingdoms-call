# R-162: Battle magic takes effect at one moment in both kinds of battle

- **Decided:** 2026-11-15, a maintainer
- **Status:** Confirmed
- **Source:** Question 53: battle magic takes effect at different moments in the two kinds of battle: which is right? Answer: option 1, one order in both: each spell takes effect before the skills and strikes it changes are counted. Built in P1-23an (#840 and #842). Question 162 (2026-11-27): does a commander whose skill is cut (cursed, blasted, or slain in the duel) keep his mastery tiers' gifts? Answer: option 1, they stay, as built. Question 164 (2026-11-27): against guards, do the hero's beasts strike before or after his archers? Answer: option 1, after them, kept as built. Both a maintainer's answer, 27 November.
- **Enforced by:** [`battle-magic-takes-effect-at-one-moment-in-both-kinds-of-battle`](../../tests/unit/battle-magic-takes-effect-at-one-moment-in-both-kinds-of-battle.test.ts)

Battle magic follows one order in every battle, against heroes or a province's guards: each spell takes effect
before the skills and strikes it changes are counted. So a Curse on Tactical or Naval changes the battle; a spell that
cancels Druid comes before the beasts' strikes. Lightning Advance stops all the defenders' magic (a hero's spell, a guard
leader's and the guards' Flak Screen), and Mass Confusion works on a guard leader too.
[R-126](R-126-battle-magic-follows-one-rule-in-every-battle.md) set the first such rules.

A commander whose skill a spell cuts keeps his mastery tiers' gifts: a Curse on Tactical doesn't take Tactical 6's
tier-up from a commander it leaves below 6. Against guards, the hero's beasts strike after his archery; between
heroes' hosts, they strike before any archers.

The question was: battle magic takes effect at different moments in the two battles. Option 1: "one order in both:
each spell takes effect before the skills and strikes it changes are counted".

In the maintainer's words: "(1)"
