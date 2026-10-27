# R-095: Every humanoid unit has a matchup and one more ability

- **Decided:** 2026-10-11, Toby
- **Status:** Confirmed
- **Source:** PR #48
- **Enforced by:** [`abilities-human`](../../tests/abilities-human.test.js), [`abilities-elven`](../../tests/abilities-elven.test.js), [`abilities-dwarven`](../../tests/abilities-dwarven.test.js), [`abilities-orcish`](../../tests/abilities-orcish.test.js), [`abilities-turn`](../../tests/abilities-turn.test.js), [`abilities-words`](../../tests/abilities-words.test.js), [`battering-horns-turn-an-anchored-line-only-from-a-ram-riding-free`](../../tests/unit/battering-horns-turn-an-anchored-line-only-from-a-ram-riding-free.test.ts)

Each humanoid land unit has two abilities: a matchup and one other. Massed Volley, Shock of the Charge, Skyward Retreat and Dread are retired. Shield Fort needs at least half the front line to be Dwarven Guard (a Dwarf Garrison counts). The Shieldwall needs an archer behind. The Longbows' second ability is Prepared Ground, the Gilded Lances' the Knightly Example, the Eagle Riders' the Eyes of the Forest.

**Open:** Where the decided table and the run model differed, the agent took: Lance Charge ×1.15; Raiders' Volley ×1.5 on the pre-battle volley when attacking; Driven Before Them +10% per Goblin Horde beside the Berserkers (at most +20%). Not built, as third abilities: the Wargs' Pack Hunt, the Wyverns' Panic, Close Order.
