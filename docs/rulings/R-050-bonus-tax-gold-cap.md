# R-050: Bonus tax gold is capped at 5% of base tax

- **Decided:** 2026-09-24, Toby
- **Status:** Confirmed
- **Source:** DEV_LOG v2026.09.24-1615 §1
- **Enforced by:** no test yet

Base tax is the bare tax of the provinces a realm holds. Each tax-paying discovery, and Taxation Records, pays at most 5% of base tax a turn (rounded down, at least 1 gold). All tax-paying magic items share one such cap between them.

**Open:** The cap is per discovery, so a realm with many economy discoveries gains a lot. A single shared cap is a one-line change if that is too much.
