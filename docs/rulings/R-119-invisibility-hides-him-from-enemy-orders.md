# R-119: Every enemy order and reaction aimed at a hero whose Invisibility holds misses him

- **Decided:** 2026-10-31, Toby
- **Status:** Confirmed
- **Source:** Plan question 6, built in PR #(number to follow)
- **Enforced by:** [`espionage-orders-called-directly`](../../tests/unit/espionage-orders-called-directly.test.ts), [`cast-spell-order-called-directly`](../../tests/unit/cast-spell-order-called-directly.test.ts), [`pursuits-and-the-catch-roll`](../../tests/unit/pursuits-and-the-catch-roll.test.ts), [`war-orders-called-directly`](../../tests/unit/war-orders-called-directly.test.ts), [`defend-watches`](../../tests/unit/defend-watches.test.ts), [`new-turn-war-academy-to-the-final-reconcile-called-directly`](../../tests/unit/new-turn-war-academy-to-the-final-reconcile-called-directly.test.ts), [`report-leaks`](../../tests/unit/report-leaks.test.ts), [`the-spell-texts-say-what-personal-combat-does`](../../tests/static/the-spell-texts-say-what-personal-combat-does.test.ts)

From the moment a hero's Invisibility holds until the turn ends, every order and reaction of another realm aimed at
him finds no one: a lone hero's ambush passes him by, Encounter finds no trail and a chase already under way is
called off, Spy on a hero, Steal, Assassinate, Challenge and Sniper's Mark find no one there, the spells aimed at a
hero (Curse, Psychic Blast, Charm and the others whose mark must stand in the caster's province) are never worked and
cost no casting slot, and the Informant Network passes him over. The acting realm reads only its order's own "no one
here" line, which names no one and doesn't say where he is. A realm that watches him by Clairvoyance still finds him
(R-110: only Clairvoyance sees through Invisibility). Part 2: when he acts on a realm, that realm still learns who he
is, as before. Not decided here, and left as they were (plan question 29): a Clairvoyance cast at him after he turned
invisible, the host he leads (ride-outs, battles, a Rampage or Rain of Arrows on his companies, the duel before a
battle), and what a spy who stays sees of him.

The question was: once a hero's Invisibility holds, does an enemy order or reaction aimed at him still reach him, and
does acting on a realm reveal him to it? Part 1, option 1: "every enemy order and reaction aimed at him misses him
for the rest of the turn (ambushes, Encounter and Pursue, Spy on a hero, Steal, Curse and other spells aimed at
him)". Part 2, option 1: "acting on you reveals him, as now".

In Toby's words: "part 1: (1) … part 2: (1)"
