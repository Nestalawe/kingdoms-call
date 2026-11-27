# R-084: Retreats never into a flood

- **Decided:** 2026-10-09, a maintainer
- **Status:** Decided, not built
- **Source:** PRs #11 and #19. Question 171 (2026-11-28): while a flooded forest lies parted, does the Flood's mark still turn a beaten army away? Answer: option 2, the parting lifts the Flood's effects too; the maintainers' answer of 28 November.
- **Enforced by:** [`retreat-dry-ground`](../../tests/unit/retreat-dry-ground.test.ts)

A retreating army never falls back into a flooded province, and onto parted sea only as a last resort.

While Part Sea lays a flooded province dry, the Flood's effects lift with the water: a beaten army may retreat there,
and the bots see dry land. The turn's end gives the province back as it was. The Elder Wood is flooded in spring and
parted in summer; Lord Bram's host, beaten next door, may fall back into the dry wood.

**Note:** Decided, not yet built: the parting's lift of the Flood's effects. Today the Flood's mark stays until the
turn's end, so no beaten army retreats onto a parted flooded province, and the bots read it as flooded.
