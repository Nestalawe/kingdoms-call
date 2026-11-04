// ── Hunting Rumours: the bands a hero's odds are read in, and the key a lair is remembered by (plan P1-13i) ────
// The order that resolves Hunting Rumours (src/engine/orders/explore-and-search-orders-maps-lairs-rites-and-rumours.ts)
// and the words it is told in (src/views/prose/the-words-of-the-explore-and-search-orders-lines.ts) read the same
// bands, and the engine's lair memory (noteLairRumour, personal-combat/helpers.ts) and the report's Known Lairs card
// (src/views/turn-report.ts) the same key, so both live here, on plain values (src/engine/rules-on-plain-values/).
// The odds themselves are measured (simulateLairOdds, personal-combat/lair-guardians-and-the-odds.ts): the kill rate is
// banded into one of five narrative lines.
export const RUMOUR_ODDS_BANDS = [
  // upper bound of the band (kill %), and the line read to the player
  {
    max: 20,
    text: (g: string) =>
      `the talk is grim: you would have no real chance against the ${g} — it would leave you in the dust with the rest`,
  },
  {
    max: 40,
    text: (g: string) =>
      `the odds are against you: the ${g} would most likely be the end of you, though a lucky hand might yet see it done`,
  },
  {
    max: 60,
    text: (g: string) =>
      `it could go either way: you and the ${g} are evenly matched, and the dice will decide who walks out`,
  },
  {
    max: 80,
    text: (g: string) => `the odds favour you: you would likely bring the ${g} down, but not without real danger`,
  },
  {
    max: 90,
    text: (g: string) => `the talk is confident: you should bring the ${g} down, though it could still cost you dearly`,
  }, // Sept 2026: the 80–90 band split out so a 90%+ reading exists
  {
    max: 101,
    text: (g: string) =>
      `the talk is certain: you are all but sure to defeat the ${g} — only ill fortune could turn it`,
  },
];
export function rumourOddsBand(pct: number) {
  return RUMOUR_ODDS_BANDS.find((b) => pct < b.max) ?? RUMOUR_ODDS_BANDS[RUMOUR_ODDS_BANDS.length - 1];
}
// ── LAIR RUMOURS REMEMBERED ── what Hunting Rumours learned about a lair's HOARD, keyed
// `<provinceId>:<featureIndex>` (the same idx the order forms and the search handler use), so the
// Known Lairs card can show it every turn after. Only the hoard is kept; a weakness goes to
// _knownWeak and the odds are never stored.
export function lairRumourKey(provId: number, idx: number) {
  return String(provId) + ':' + String(idx);
}
