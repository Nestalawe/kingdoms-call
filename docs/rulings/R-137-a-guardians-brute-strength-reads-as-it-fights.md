# R-137: A guardian's brute strength reads as it fights

- **Decided:** 2026-11-05, Toby
- **Status:** Confirmed
- **Source:** Plan question 34, built in the pull request of P1-11e1 (the perk's words, and running games' guardians
  re-stamped), stacked on PR #493
- **Enforced by:** [`each-guardian-perks-number-is-in-its-words-and-the-rulebooks-table`](../../tests/static/each-guardian-perks-number-is-in-its-words-and-the-rulebooks-table.test.ts),
  [`a-saved-games-old-shapes-are-mended-before-the-turn`](../../tests/unit/a-saved-games-old-shapes-are-mended-before-the-turn.test.ts)

A guardian's brute-strength perk adds its number to the damage of every blow. A special attack is the guardian's blow
multiplied by the special's weight, so the special's weight multiplies the bonus too. The perk's words say so: "+N
damage on every blow; a special's weight multiplies it". The rulebook already read this way. The fight is not changed.

Eleven guardians hold the perk (+1 to +4). In a running game, the save's upgrade gives each saved guardian's
brute-strength perk the new words at its next turn; nothing else about the guardian changes.

Example: Sir Aldric searches the Elder Titan's lair. The Titan's card says "Titan's Strength: +4 damage on every blow;
a special's weight multiplies it". Its World-Shaker has a weight of 2, so it hits him 8 harder, as it always did. The
card had said "+4 damage on every blow and special".

The question was: the perk's words said a flat bonus on a special, and the fight multiplies it. Option 1: the words
follow the game. Option 2 (not taken): the game follows the words (a special adds a flat +N after its weight).

In Toby's words: "(1)"
