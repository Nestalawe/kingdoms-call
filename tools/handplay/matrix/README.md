# Comparison runs for the alignment kits

Three small scripts that turn the balance matrix (`npm run balance`, [tools/balance/](../../balance/)) into a
comparison of the alignment kits. The method is written up in [../METHOD.md](../METHOD.md).

| Script | What it does |
|---|---|
| `run-kits.sh` | Plays the matrix with a kit set-up on one seed set: today's rules (`base`), one alignment's kit alone, or all seven (`all`). |
| `compare.py` | Pools the runs over the seed sets and prints each alignment's figures (today, kit alone, all seven) with a 95% range, and who beats whom in battle. |
| `count-uses.py` | Counts how often each ability fired, from the GM logs the matrix writes with `KC_DUMP_LOG`. |

## A full comparison, step by step

1. `npm ci`, then `npm run build` once (the matrix plays the built engine).
2. Play the runs (a few minutes each; run several shells side by side):
   ```sh
   OUT=/tmp/kits TAG=r28 tools/handplay/matrix/run-kits.sh "base-A base-B base-C base-D base-E"
   OUT=/tmp/kits TAG=r28 tools/handplay/matrix/run-kits.sh "all-A all-B all-C all-D all-E"
   OUT=/tmp/kits TAG=r28 tools/handplay/matrix/run-kits.sh "Undead-A Undead-B Undead-C Undead-D Undead-E"
   ```
3. Compare: `python3 -I tools/handplay/matrix/compare.py /tmp/kits r28`.
4. For ability use, add `KC_DUMP_LOG=/tmp/kits/logs-all-A` in front of a run, then
   `python3 -I tools/handplay/matrix/count-uses.py /tmp/kits/logs-all-A`.

The base runs need replaying only when the engine changes outside the kits. With every kit switch off, the matrix
must match `tests/balance/baseline/` exactly ("60 of 60 games identical"): that is the check that the kits change
nothing in today's game.
