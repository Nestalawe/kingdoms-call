# R-043: Bots know only what a player in their seat could know

- **Decided:** 2026-09-24, Toby
- **Status:** Confirmed
- **Source:** DEV_LOG v2026.09.24-1126 §103 (Toby / bot review A5), v2026.09.24-0731 §84–85
- **Enforced by:** no test yet

A bot plans from what a human in its seat would know: what its characters see, what it remembers seeing (six turns), a rival's skills only from spying (eight turns) or else an assumed ordinary profile, and lair odds from the same rumour bands a player reads. It never reads hidden state.
