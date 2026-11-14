# Explorations

An exploration works through a proposed change: its impact and its options
([the kinds](../architecture/making-a-change-the-six-kinds-and-the-plans-format.md#exploration)). Its branch is never
merged. Its write-up comes here, in a docs-only pull request, so that the change it leads to starts from `main`, not
from a branch.

Unlike the rest of `docs/`, a file here describes a proposal, not the game as it is. **When its change is built, the
file goes**, in the change's last pull request: from then on the rulings and the code say what is true.

## What a write-up holds

One file a proposal, `docs/explorations/<name>.md`, in this order:

1. **The proposal**, in game terms, and where it came from (made-up names only).
2. **Its state:** open, or decided (and by which ruling).
3. **The questions for Toby**, each with options, a recommendation and an example; his answers, once given.
4. **Every rule it changes against `main`**, each with where it lives today. Rules the proposal doesn't mention
   come too: they were part of what was measured.
5. **How it was measured** (bot games, hand-played games, their seeds and sizes) and the results, each with the rules
   it was measured with.
6. **The options and the recommendation.**
7. **The spec for the change:** one row per item, ready for the plan's rows
   ([the format](../architecture/making-a-change-the-six-kinds-and-the-plans-format.md#the-plans-format)).

No pasted reports or live names ([CLAUDE.md](../../CLAUDE.md#rules), "Never" 4), and nothing about security weaknesses
("Never" 5).
