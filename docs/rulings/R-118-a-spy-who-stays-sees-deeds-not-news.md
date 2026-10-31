# R-118: A spy who stays in a province sees what rival heroes do there, never their realm's news

- **Decided:** 2026-10-31, Toby
- **Status:** Confirmed
- **Source:** Plan question 8, built in PR #PRNUMBER
- **Enforced by:** [`realm-reports`](../../tests/unit/realm-reports.test.ts), [`report-leaks`](../../tests/unit/report-leaks.test.ts), [`hp-gain-private`](../../tests/unit/hp-gain-private.test.ts)

After a hero spies on a province, his realm's report shows, under Spy Activity, what other realms' heroes do there
in the phases after it for the rest of the turn: their deeds (moves, watches, spells cast and their rolls, lairs,
fights) and anything anyone standing there could see, battles included. It never shows the news meant for their
own realm alone: a line told to that realm with no deed of its own (a hit-point rise after a fight, a curse or a mind
blast felt, the plague's toll on its troops, a hero ensorcelled by an enemy Charm), or a line written for everyone
but the spying realm. This extends R-111 (what spying shows) and keeps R-101 and R-117 (a hero's hit-point rises are
his own realm's) true for spies too. What a spy sees of a hero after he vanished is not decided here (plan question
29).

The question was: Sir Aldric spies on Wendmeadow in Spring and stays. Should his realm read everything rival heroes
do there all turn, their private news too? Option 1, "Everything they do there, but never their private news".

In Toby's words: "(1)"
