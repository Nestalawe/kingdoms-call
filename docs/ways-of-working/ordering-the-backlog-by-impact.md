# Ordering the backlog by impact

What comes next is the top of [the backlog](../backlog/README.md)
([the decision](../decisions/README.md#the-decisions-on-how-the-work-runs)). So every new item gets its place there
before work on it starts: a batch's item, a defect, a ruling to build, or a step found while scoping. A row whose place
is in doubt is placed again the same way. The skill `ordering-the-backlog` takes an agent through it; this file says
how.

## 1. Describe the item's impact

Write the row's **Impact** line ([how to read a row](../backlog/README.md#how-to-read-a-row)). In one line, it
answers four questions:
- **Who notices?** Players in running games, a GM, the maintainers, or no one yet.
- **What changes?** In play, or for the maintainers: time saved, or a check that can now fail.
- **What does it unblock?** The rows that wait for it (each says so in its "After").
- **What is the risk of waiting?** What goes wrong, or costs more, while it waits: a wrong result in a running game,
  or a rule that more work will be built on.

## 2. Find where it would go

Pick the part of the backlog first:
- **The top, in order**, or **Next**: it serves the outcome the road works on now, or players notice it.
- **Later**: it serves a later outcome of [the road](../the-goal-and-the-road.md#the-outcomes), or it waits.
- **Not yet assessed**: no one can describe its impact yet. A new defect starts here, as a `KD-` row.

Then read the rows around the place where it would go.

## 3. Compare it with its neighbours

Compare the item with the row just above that place and the row just below it, impact against impact. When nothing
else decides, the default order is:
1. **Harm in live play:** a running game does something its rules and rulings don't say, and players notice.
2. **What unblocks the most rows.**
3. **The maintainers' time:** a check, a tool or a doc that saves it.
4. **Tidying:** names, dead code, comments.

## 4. Propose a position

Say where the row goes (after which row, and before which) and why, in one line of reasoning. For example: "Above
P1-16q: in running games, a garrison with no hero doesn't roll its realm's zeal yet, as R-164 says it should (harm in
live play); P1-16q types one more page."

## 5. Stop for a maintainer

A maintainer validates the position, or moves the row. Either maintainer may. Work on the item starts only once its
place is validated. In a run, the pull request is the stop: the position waits in it for a maintainer's review.

## 6. Record the position

The pull request that adds the row puts it in its place in the backlog, and its description gives the position and its
line of reasoning. A batch's items get an impact line and a position each; the batch is still delivered as one pull
request, one commit an item ([D-06](../decisions/README.md#the-sites-decisions-d-01-to-d-13)).
