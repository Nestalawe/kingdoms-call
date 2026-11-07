# R-136: The texts that said otherwise follow the game

- **Decided:** 2026-11-05, Toby
- **Status:** Confirmed
- **Source:** Plan question 46, built in the pull requests of P1-11e39 (the spell hints and their blurbs), stacked on
  PR #485, and P1-11e40 (the Evil and Pagan texts and the Charm row), stacked on PR #486
- **Enforced by:** [`each-spells-numbers-are-in-its-blurb-and-the-rulebooks-table`](../../tests/static/each-spells-numbers-are-in-its-blurb-and-the-rulebooks-table.test.ts),
  [`each-alignment-orders-name-creed-and-numbers-are-in-the-books-as-its-row-says`](../../tests/static/each-alignment-orders-name-creed-and-numbers-are-in-the-books-as-its-row-says.test.ts)

Where a text players read says otherwise than the turn, the words change and the game does not. The order form's hint
below a spell and the spell's blurb say what the turn does:

- **Telekinetic Storm** strikes as many of the target's units as the caster's level, counted to 5. A Green unit is
  destroyed, a skeletal unit shatters outright, and every other unit struck drops one experience level. Its battle
  magic halves the enemy commander's Tactical bonus, on land, and only if he has any.
- **Plague** gives each humanoid unit a chance of 10% and 5% a level, the level counted to 5, to drop an experience
  level. A unit that faced a plague before, hit or not, rolls at half the chance: it is not immune.
- **Lightning Bolt** counts the caster's level to 5, in a fight (1 to 3 damage a level) and in battle (as many enemy
  armies as his level).
- **Hand of Death** counts the caster's Necromancy to 5 (10% a level); its chance is at most 60%.

Every spell's effect counts the caster's level to 5 (the rulebook says so once for every spell); levels 6 to 9 buy cast
chance and the mastery spells.

The report's Evil summary and its bonus line, the rulebook's Evil section, the intro's Evil row, the rulebook's Charm
row and the Pagan texts say what the turn does:

- **An Evil conquest** follows the doctrine set on the conquering hero's orders. *Terror* plunders 50% of the
  province's tax value in gold at once. *Enslave* takes no gold: it presses the beaten folk into a free Green garrison
  unit, and the province pays 1g less tax for 3 turns. Where the folk aren't humanoid, he plunders. The texts no longer
  say every conquest plunders.
- **Charm:** as the Charm takes hold, the charmer's Chronicle lists the hero's skills and the magic items he carries,
  as the order form's hint says. The rulebook said the charmer never sees them.
- **The Wild Hunt** binds two of the province's creatures, as Veterans until the end of the following turn. The
  report and the join form said it binds "a province's creatures".

Example: Mother Ysolde, Psychic 7, storms a host of six companies, one of them skeletons. Five companies are struck,
not seven, and if the skeletons are among them they crumble to dust. The hint said "skeletal units unaffected" and "your skill level"; it now
says what happened.

Example: a Plague swept Wendmeadow last spring, and Sir Bram's spearmen came through it whole. When a second plague
comes, they roll at half the chance. The hint said they were "immunised"; it now says "half the chance".

Example: Lord Thorn, an Evil hero, takes Wendmeadow with Enslave on his orders. His realm gains no gold, a Green
company of the folk joins the garrison in chains, and the province pays 1g less tax for 3 turns. The report had said
every conquest plunders half the tax.

The turn is not changed. The question was: six texts said otherwise than the turn (these four spells' hints, the
report's Evil and Pagan words, the rulebook's Charm row). Option 1: "the words follow the game". Option 2 (not taken):
the game follows the words. The spells' hints and blurbs are P1-11e39's; the Evil and Pagan words and the Charm row are
P1-11e40's.

In Toby's words: "(1)"
