# R-069: A fighter who steps into range strikes in the same action

- **Decided:** 2026-09-27, Toby
- **Status:** Confirmed
- **Source:** DEV_LOG v2026.09.27-2339 §319 (item 7)
- **Enforced by:** [`fuzz-advance-masking`](../../tests/fuzz-advance-masking.test.js)

In personal combat, a fighter who advances (from spell range towards melee) attacks in the same action if the new range allows: a melee blow, or a snap shot at bow range. Guardians gain it as characters do.
