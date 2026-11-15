# Explaining a pull request: its intent and its impact

Theo reads a pull request's Staging section and nothing else of its text; when he wants more, he asks a fresh session
to explain it. The explanation reads the change itself, not the description, and says what it means. **The session is
read only:** it doesn't edit, commit, push, comment, label or message anyone.

Start it with the pull request's number (or several, or "the open stack"): "Explain pull request #N to me, for its
intent and its impact, following `docs/ways-of-working/explaining-a-pull-request-its-intent-and-its-impact.md`."

## Read first

1. `CLAUDE.md`, then `gh pr view <N>` (its description, labels and base) and `gh pr diff <N>`. **The diff is the
   truth:** where the description and the diff differ, the diff wins, and say so.
2. What it rests on: its step's row in [the backlog](../backlog/README.md) (a ✓ in the Theo column), the decisions in
   force for it, or the batch's item; the rulings it meets; the known defects that name it.
3. Every CI run on the head commit (`gh api "repos/Nestalawe/kingdoms-call/actions/runs?head_sha=<sha>"`), the balance
   comment, the pull request's comments and its open code-scanning alerts.
4. Enough of the code around each changed part to judge what it touches, and the [traps](../traps.md) it meets.

## What to say, most important first

1. **In one paragraph:** what it does and why now, in plain words.
2. **Intent:** the problem it solves or the step it moves forward; the decision it rests on (Theo's, Toby's ruling, a
   run's proposal); what it deliberately leaves out.
3. **Impact**, a short paragraph each, "none" where there is none, with an example where there is one:
   - **players and Toby:** what anyone in a game can notice (rules, words, reports, pages), and what stays the same;
   - **live games:** the saves, a turn in progress, old pages still open when it deploys;
   - **data and who can see it:** the database, the access rules, what a realm may see of another. This is Theo's
     area: be exact;
   - **the code and later work:** what it makes easier or harder, what depends on it, what it costs to undo.
4. **How we know it is right:** each proof in plain words (what it would catch, and what it can't see), its result,
   and whether CI agrees. Say plainly where the proof rests on the agent's reasoning rather than a check.
5. **Risks:** what could go wrong if it is wrong, how likely that is, and how we would find out.
6. **What it asks of Theo:** the merge order and what it is stacked on; staging steps; the dangerous paths it touches;
   decisions it took without him; anything to veto.
7. **Anything that looks wrong:** a claim the diff or the runs don't bear out, a check weakened, a figure that doesn't
   add up. If none, say so.

For several pull requests: the stack's intent and the merge order first, then a section each, shorter where one is
routine. Write in plain language ([CLAUDE.md](../../CLAUDE.md#plain-language-iso-24495-12023)): detail where it carries
meaning, no retelling of the description. **A weakness found is told to Theo in the session, and nowhere public.** End
with what you would look at more closely if asked, a line each.
