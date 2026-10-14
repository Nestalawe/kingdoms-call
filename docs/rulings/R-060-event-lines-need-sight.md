# R-060: Province events are seen only by those who can see the province

- **Decided:** 2026-09-27, Toby
- **Status:** Confirmed
- **Source:** DEV_LOG v2026.09.27-1719 §251 (item 6)
- **Enforced by:** [`report-privacy`](../../tests/report-privacy.test.js)

A public event in a province reaches a realm only if it owns the province, has a character there at that phase, or has spied it. Having once passed through is not enough. A realm's own business (Call to Arms, Resurrect, a regent stepping down, Phantasmal Armies, Phantom Host) is never public.
