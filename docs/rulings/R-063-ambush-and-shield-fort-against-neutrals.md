# R-063: Ambush and Shield Fort work against neutral defenders

- **Decided:** 2026-09-27, Toby
- **Status:** Confirmed
- **Source:** DEV_LOG v2026.09.27-1719 §262–263
- **Enforced by:** [`npc-parity`](../../tests/npc-parity.test.js)

Unit abilities work against neutral province defenders exactly as against another player. Forest Wardens' Ambush silences the other side's volley whichever side attacks. A beaten Guard-heavy force keeps good order against neutrals too. (Shield Fort's condition was later redefined: [R-095](R-095-unit-abilities.md).)
