// ── What a march's order names: a compass step, or a province ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other. A Move or a Forced March names
// where it goes in one of three forms: `dir:<compass>` (a bot's march), `prov:<id>` (the order form's Move) or the
// province's bare number (the order form's Forced March, a bot's joint assault). The Move order's own function
// (src/engine/orders/move-order-marches-voyages-and-battles-on-arrival.ts) and the phase's intents
// (src/engine/turn/phase-intents-and-dependency-ordering.ts) both read the target here, so a province named either way is
// reached the same way: straight in when it lies next door, one step along the road when it doesn't.

/** What a march's order names: a compass step from where the hero stands, or a province by its number (NaN when the
 *  words name none). */
export type WhatAMarchsOrderNames =
  { readonly by: 'compass'; readonly direction: string } | { readonly by: 'province'; readonly provinceId: number };

/** What a Move's or a Forced March's target names: `dir:<compass>` a compass step; `prov:<id>` and the bare number a
 *  province, read alike (`parseInt`, so NaN for words that name none). */
export function whatAMarchsOrderNames(target: string): WhatAMarchsOrderNames {
  if (target.startsWith('dir:')) return { by: 'compass', direction: target.slice(4) };
  return { by: 'province', provinceId: parseInt(target.startsWith('prov:') ? target.slice(5) : target) };
}
