// The balance matrix in parts (tools/balance/parts.ts: CI plays it in three jobs side by side, then joins them): each
// game is in one part, the parts share the long games, and the join hands run.ts one run's games in the matrix's order,
// or refuses parts that don't make one run, so no game is judged twice or left out, and the required scenarios are
// judged once. That a joined run judges and writes as one unsplit run does is shown on the real games in the pull
// request (the joined played.json byte for byte the unsplit one's; a planted baseline change and a planted missed
// scripted case failing both).
// Level 1 (unit): pure functions on the matrix's specs and made-up results; no game is played.
import { describe, expect, test } from 'vitest';
import type { ReportsResult } from '../../tools/balance/baseline.ts';
import { matrix } from '../../tools/balance/matrix.ts';
import { joinParts, parseShard, theShare, type Part } from '../../tools/balance/parts.ts';
import type { GameResult } from '../../tools/balance/play.ts';

const GAMES = matrix('A');
const ids = (games: { id: string }[]) => games.map((g) => g.id);

describe('the share', () => {
  test.for([1, 2, 3, 7])(
    'in %i parts: each game in one part, in the matrix order, the sizes one apart at most',
    (of) => {
      const shares = Array.from({ length: of }, (_, i) => theShare(GAMES, { part: i + 1, of }));
      expect(shares.flatMap(ids).sort()).toEqual(ids(GAMES).sort());
      for (const share of shares) expect(ids(share)).toEqual(ids(GAMES).filter((id) => ids(share).includes(id)));
      const sizes = shares.map((s) => s.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    },
  );

  test('in three parts, each has a third of the realms to play, give or take the largest game', () => {
    const realms = [1, 2, 3].map((part) => theShare(GAMES, { part, of: 3 }).reduce((n, g) => n + g.realms, 0));
    const largest = Math.max(...GAMES.map((g) => g.realms));
    expect(Math.max(...realms) - Math.min(...realms)).toBeLessThanOrEqual(largest);
  });

  test('--shard reads a part of a whole', () => {
    expect(parseShard('2/3')).toEqual({ part: 2, of: 3 });
    for (const bad of ['0/3', '4/3', '3', 'a/b', '1/0']) expect(() => parseShard(bad), bad).toThrow(/--shard/);
  });
});

/** A made-up game on the page and in the vm. */
const page = (id: string): GameResult => ({ id, turns: [`${id} turn`], results: id, stats: {}, ms: 1 });
const vm = (id: string): ReportsResult => ({ id, turns: [], sections: {}, states: [], reports: 1, leaks: [], ms: 1 });
/** Part `part` of `of` as --shard writes it, its games those of `games` (the share by default). */
function partOf(part: number, of: number, games = theShare(GAMES, { part, of })): Part {
  return {
    kind: 'a part of the balance matrix',
    set: 'A',
    part,
    of,
    ids: ids(games),
    required: part === 1 ? { lines: ['Required scenario "x": every requirement met'], failed: false } : null,
    page: { results: ids(games).map(page), errors: part === 2 ? ['bots-01: planted'] : [], secs: part, jobs: 4 },
    vm: { results: ids(games).map(vm), errors: [], secs: 10 * part },
  };
}

describe('the join', () => {
  test("three parts, in any order: one run's games in the matrix's order, the first part's required scenarios", () => {
    const join = joinParts([partOf(3, 3), partOf(1, 3), partOf(2, 3)], 'A', GAMES);
    expect(join.problems).toEqual([]);
    if (!('joined' in join)) throw new Error('not joined');
    expect(ids(join.joined.page.results)).toEqual(ids(GAMES));
    expect(ids(join.joined.vm?.results ?? [])).toEqual(ids(GAMES));
    expect(join.joined.page.errors).toEqual(['bots-01: planted']);
    expect(join.joined.page.secs).toBe(3);
    expect(join.joined.required?.lines).toEqual(['Required scenario "x": every requirement met']);
  });

  test('parts that make no run are refused, each problem named', () => {
    const [one, two, three] = [partOf(1, 3), partOf(2, 3), partOf(3, 3)];
    const problems = (parts: Part[]) => joinParts(parts, 'A', GAMES).problems;
    expect(problems([])).toEqual(['no part to join']);
    expect(problems([one, two])).toEqual([
      'part 3 of 3 is missing',
      ...ids(theShare(GAMES, { part: 3, of: 3 })).map((id) => `${id} is played in 0 parts`),
    ]);
    expect(problems([one, two, three, two])).toEqual([
      'part 2 of 3 is there 2 times',
      ...ids(theShare(GAMES, { part: 2, of: 3 })).map((id) => `${id} is played in 2 parts`),
    ]);
    expect(problems([one, two, { ...three, set: 'B' }])).toEqual(['part 3 is of set B, not A']);
    expect(problems([one, two, { ...three, of: 4 }])).toEqual(['part 3 is of 4 parts, the first of 3']);
    expect(problems([{ ...one, required: null }, two, three])).toEqual(["part 1 didn't play the required scenarios"]);
    expect(problems([one, { ...two, required: one.required }, three])).toEqual([
      'part 2 played the required scenarios',
    ]);
    const moved = GAMES.find((g) => !two.ids.includes(g.id))?.id ?? '';
    expect(problems([one, { ...two, ids: [...two.ids, moved] }, three])).toEqual([`${moved} is played in 2 parts`]);
    expect(problems([one, { ...two, ids: [...two.ids, 'bots-99'] }, three])).toEqual([
      'bots-99 is not a game of set A',
    ]);
    expect(problems([one, { ...two, vm: null }, three])).toEqual(["some parts played every realm's report, some not"]);
  });
});
