# R-052: Nearby lairs do not repeat an item's effect

- **Decided:** 2026-09-26, a maintainer
- **Status:** Confirmed
- **Source:** DEV_LOG v2026.09.26-1647 §243 (a maintainer's report); PR #76 item 5 (2026-10-13)
- **Enforced by:** [`no-two-lairs-near-each-other-hold-an-item-with-the-same-effect-on-any-map-size`](../../tests/simulation/no-two-lairs-near-each-other-hold-an-item-with-the-same-effect-on-any-map-size.test.ts), [`the-gm-pages-own-lair-names-item-effects-province-units-and-neutral-armies-keep-their-rules`](../../tests/page/the-gm-pages-own-lair-names-item-effects-province-units-and-neutral-armies-keep-their-rules.test.ts)

Two items count as the same when they do the same thing, whatever their name, slot or tier. When a world is stocked, no province holds two items with the same effect, and lairs within 3 provinces of each other get different effects while the treasury has anything else to give.
