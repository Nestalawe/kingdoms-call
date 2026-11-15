# R-182: What a realm learns of another realm's heroes follows the map's sight rule

- **Decided:** 2026-11-15, a maintainer
- **Status:** Decided, not built
- **Source:** Question 58: a realm's Clairvoyance list, the realms it has met and its warnings learn of heroes its map never showed: should they follow the map's sight rule? Answer: option 1, they follow the map's sight rule.
- **Enforced by:** no test yet

A realm learns of another realm's hero only as its map shows him ([R-110](R-110-heroes-sharing-a-province.md):
Invisibility hides him, and so does a missed spotting roll for a lone lurker). Three records follow that rule: the
heroes the realm has seen (the list its Clairvoyance offers), the realms it has met, and the warnings of heroes in its
land. Example: Wystan, under Invisibility, stands in Lady Wren's capital. Her map shows no one, so next turn her
Clairvoyance list doesn't offer him, and her realm hasn't met his. When Bresk lurks alone in her Wendmeadow, beside a
province she spied this turn, her map shows him, and she is warned of him. Today the list and the meeting count every
living hero who stood in a province she holds or stands in, with his race and creed, and the warning waits for the
spotting roll.

**Note:** Decided, not yet built. Left: `updateProvinceMemory` (`world/province-bookkeeping-…`) records a hero, and
marks his realm met, only when the map shows him; the warnings follow the map; a unit case each first.

The question was: (a) an invisible hero, or a lurker the spotting roll missed, enters a realm's Clairvoyance list and
its record of realms met; (b) a lurker the map shows is warned of only if the spotting roll finds him. Option 1: "the
Clairvoyance record, the meeting and the warnings follow the map's sight rule", as R-110 says Invisibility hides.

In the maintainer's words: "(1)"
