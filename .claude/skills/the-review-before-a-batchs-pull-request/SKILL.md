---
name: the-review-before-a-batchs-pull-request
description: Use before opening a batch's pull request, or marking one ready, on its diff and its description. Checks them against CLAUDE.md's rules, the code's guardrails, the traps of the areas touched, the dangerous paths, the ratchet, the save's shape, the tests and the template. Gives findings, each with the doc that says so.
---

# The review before a batch's pull request

Read the whole diff against its base and the PR's description. Look at each point below; each slip is a finding.

## The diff

1. [CLAUDE.md's Rules and Never](../../../CLAUDE.md#rules), one by one.
2. [The code's guardrails](../../../docs/ARCHITECTURE.md#the-codes-guardrails).
3. The traps of each area the diff touches, by title: read those entries of [docs/traps.md](../../../docs/traps.md).
4. Every place the rule is written changed with it: search the old numbers and words
   ([A rule written twice must change twice](../../../docs/traps.md#a-rule-written-twice-must-change-twice)).
5. Read `.github/dangerous-paths` itself, not a list from memory: every path of it the diff touches is named in the
   PR's first lines ([Dangerous paths](../../../CLAUDE.md#dangerous-paths-talk-it-through-with-theo)).
6. `tests/ratchet.json` and the lists it counts ([CLAUDE.md](../../../CLAUDE.md#rules)).
7. What a saved game holds, against its schema
   ([A change to the save's shape needs its version](../../../docs/traps.md#a-change-to-the-saves-shape-needs-its-version)).
8. Each new or changed test: its level, its fail-first proof, and
   [the same answer every time](../../../tests/README.md#the-same-answer-every-time).

## The description

9. [The template](../../../.github/pull_request_template.md): every section, "What changes in play" predicted, the
   staging line.
10. The playtesters' notes, in plain words ([Opening the PR](../../../CLAUDE.md#opening-the-pr-for-review);
    [plain language](../../../CLAUDE.md#plain-language-iso-24495-12023)).
11. Private data and security ([CLAUDE.md](../../../CLAUDE.md#rules), "Never" 4 and 5), in the commits too.

## Output

Numbered findings, most serious first. Each: the file and line (or the PR's section), what is wrong in one sentence,
and the doc that says so, linked. Then what you could not settle. Don't fix while you review.
