// Before the first phase (plan P1-08k8: src/engine/turn/, four stages lifted out of resolveTurn's own body), called
// directly in the bare vm on the middle of a bot world (lib/middle-of-a-bot-world.ts). First the cases
// scenario/before-the-first-phase-in-a-whole-turn plays through a whole turn (lib/before-the-first-phase-cases.ts), here
// played through the four stages alone, after the merge, as resolveTurn calls them (the bots' passes between the third
// and the fourth aside); then, with the helpers they call stood in (each replaced in the vm by a recorder for the
// test's length), what they hand them and when, and where resolveTurn calls them; then what the whole turn can't stage:
// a bot's pick already made, a retired lead the game still lists, the die's every value, a gap in the realms' list,
// realms with no name, a message from a seat the save doesn't have, the log's hero kept through the messages, standings
// that fail, a Cathedral's home off the map, a record that fails. Properties (fast-check): a research choice settles on
// the lead picked, or the die's among those the realm may still find, forgetting the rest, or is dropped; a message
// reaches exactly the realms it may, once each, with one copy; an Evil or Undead realm's war on a realm it has met
// stands at once, every other waits; every empty phase sent is Defend, and only those; every guardian is 5 HP frailer,
// never below 5.
// Level 1: four functions, called with the context resolveTurn hands them.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// `relationsReadyAndLastTurnsResearchChoicesSettledWithTheBotsOwnPicks`,
// `warWithoutWarningTitlesHeldSafeStartAndStaleOrderLinesGmRemovalsAndMessages`,
// `movePoolsPerTurnTrackersEspionageResetsAndTheSaveSweepsBeforeTheBotsPlan` and
// `missingOrdersDefaultToDefendTheOrdersRecordAndTheWarFrontsAtTheStart` (P1-08k8), called directly after P1-08k7's two
// stages, the context's values the four make afresh left stale first: the whole-turn cases through the four stages
// alone (but those about the bots' own passes); then, with their helpers stood in by recorders in the `vm`, what each
// is handed: each bot realm's earlier choice with leads and no pick handed to the bots' pick, which the realm pursues;
// one die per choice the scholars settle, each value of it; a retired lead the game still lists never pursued; the
// war's key asked of the declarer first; names by number; the standings and minor titles once each from turn 5, failing
// or empty leaving none; Safe Start's and the stale lines in their order, public only for a concession; removals by
// name past gaps; the log's hero kept through the messages, the copy carrying it; "all" read from the rows; a message
// from a seat the save lacks; each living realm hero handed to the move pool with the turn's new pools; the mithril
// once, the lairs' renaming only for an old world and told as it counts; each realm asked for its Cathedral, the home
// looked up only when it has no province; a home off the map; gaps among provinces and features; a gap in the realms'
// list stopping the espionage reset (Parked); a hero with no orders at all; the record's reckoning handed what each
// realm sent, a concession dated by the turn run, a failing record warned and set aside, gaps; the war fronts as the
// threats name them, not on ground fought over, not under a veil; and `resolveTurn` calling the merge, the first two
// around the bots' declarations, the third after the turn's start values, the bots' passes, the fourth, then the first
// phase, each once with its context. Properties (fast-check): a research choice settles on the pick or the die's open
// lead, forgetting the rest, or is dropped; a message reaches exactly the realms it may, once each, with one copy; an
// Evil or Undead realm's war on a realm met stands at once, every other waits; every empty phase sent is Defend, only
// those; every guardian 5 HP frailer, never below 5. Planted faults: in the PR (P1-08k8)
import vm from 'node:vm';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { withCaseDice } from '../lib/espionage-order-cases.ts';
import {
  BEFORE_CASES,
  LANDS,
  STAGES,
  choices,
  creed,
  host,
  lair,
  onlyLairs,
  outcomeOf,
  prepare,
  pursuit,
  realm,
  realmHero,
  rows,
  seatOf,
  stageCase,
  stagesCase,
  starting,
  told,
  warNow,
  withdrawn,
  type BeforeCase,
  type Staged,
} from '../lib/before-the-first-phase-cases.ts';
import { dispatch, ordersOf, sentTo } from '../lib/set-up-and-order-merge-cases.ts';
import { board, must, order, type Board, type Character, type Line } from '../lib/middle-of-a-bot-world.ts';
import { relate, unmet } from '../lib/diplomacy-and-victory-cases.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
type Fn = (...a: unknown[]) => unknown;
type Raw = Record<string, unknown>;
const [RESEARCH, WAR_AND_MESSAGES, POOLS_AND_SWEEPS, DEFAULT_DEFEND] = STAGES;
const FIRST_PHASE = 'startPhaseHealingSnapshotsAndStalledBattles';
const MERGE = 'mergeTheRealmsSubmittedOrdersDeclarationsMessagesAndEncounterPlans';
const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
const inVm = vm.runInContext('(j)=>JSON.parse(j)', engine) as (j: string) => unknown;
const stage = (name: string) => engineFn(engine, name) as (tc: unknown) => void;

const NOTHING: BeforeCase = { name: 'nothing staged', stage: () => ({}), check: () => ({ got: {}, want: {} }) };
/** A board staged as every case is (`stageCase`), staged further by `more`, and readied for the four stages. */
const fresh = (more: (b: Board) => Staged = () => ({})) => {
  const b = board(engine, world, 0);
  let s: Staged = {};
  stageCase(b, { ...NOTHING, stage: (bb) => (s = more(bb)) });
  const tc = prepare(b, s);
  return { b, tc, s };
};
const G = (b: Board) => b.G as unknown as Raw & Board['G'];
/** Runs the stages named, in turn, on `tc`, with every die at its highest unless `dice` says otherwise. */
const run = (tc: Raw, names: readonly string[], dice = LANDS) => {
  withCaseDice(engine, dice, () => {
    for (const f of names) stage(f)(tc);
  });
};
const lines = (b: Board) => (b.tc as unknown as Raw)['turnLog'] as Line[];

/** The cases a direct call can stage, by part (those about the bots' own passes need a whole turn). */
const DIRECT_CASES = BEFORE_CASES.map(([part, cases]) => [part, cases.filter((c) => !c.wholeTurnOnly)] as const).filter(
  ([, cases]) => cases.length > 0,
);
describe.each(DIRECT_CASES)('%s, the four stages called directly', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(stagesCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});

// ── What they call, and where resolveTurn calls them ─────────────────────────────────────────────────────────────
interface Call {
  fn: string;
  args: unknown[];
}
/** Runs `body` with each of `names` replaced by a recorder (in the vm, for the body's length) that calls `instead` for
 *  it if given, or the helper it stands in for. */
function standIn(names: string[], body: () => void, instead: Record<string, Fn> = {}): Call[] {
  const g = engine;
  const was = names.map((f) => [f, g[f] as Fn] as const);
  const calls: Call[] = [];
  for (const [f, w] of was)
    g[f] = (...args: unknown[]) => {
      calls.push({ fn: f, args });
      return (instead[f] ?? w)(...args);
    };
  try {
    body();
  } finally {
    for (const [f, w] of was) g[f] = w;
  }
  return calls;
}
const CHOICE = ['sd03', 'sd04'];

describe('The research choices: what the first stage calls', () => {
  test('each bot realm’s choice of an earlier turn, with leads and no pick yet, is handed to the bots’ pick; a human’s, this turn’s, a choice without leads and one picked already are not', () => {
    const { b, tc } = fresh((bb) => {
      choices(bb, 2, ['a', CHOICE], ['b', CHOICE, bb.G.turn], ['c', null], ['d', ['sd05']]);
      choices(bb, 1, ['e', CHOICE]);
      return { bots: [2] };
    });
    (tc['discoveryChoicePicks'] as Raw)['2'] = { d: 'sd05' };
    const calls = standIn(
      ['botResearchPick'],
      () => {
        run(tc, [RESEARCH]);
      },
      { botResearchPick: () => 'sd03' },
    );
    expect(calls.map((c) => [c.args[0] === b.G, c.args[1], c.args[2]])).toEqual([[true, 2, CHOICE]]);
    expect(JSON.parse(JSON.stringify((tc['discoveryChoicePicks'] as Raw)['2']))).toEqual({ d: 'sd05', a: 'sd03' });
    expect(starting(outcomeOf(b), `💡 ${realm(b, 2).name} pursues`)).toHaveLength(2);
  });

  test('a bot realm’s pick is what its scholars favour: the realm pursues it', () => {
    const { b, tc } = fresh((bb) => {
      choices(bb, 0, ['a', CHOICE]);
      return { bots: [0] };
    });
    standIn(
      ['botResearchPick'],
      () => {
        run(tc, [RESEARCH]);
      },
      { botResearchPick: () => 'sd03' },
    );
    expect(told(outcomeOf(b), pursuit(b, 0, 'sd03', true, ['sd04'])).length).toBe(1);
  });

  test('a bot realm with no pending choices list, or a gap in it, is passed over', () => {
    const { b, tc } = fresh((bb) => {
      delete realm(bb, 1)['pendingDiscoveryChoices'];
      realm(bb, 2)['pendingDiscoveryChoices'] = [null, { key: 'k', options: ['sd03'], turn: bb.G.turn - 1 }];
      return { bots: [1, 2] };
    });
    const calls = standIn(['botResearchPick'], () => {
      run(tc, [RESEARCH]);
    });
    expect(calls.map((c) => c.args[1])).toEqual([2]);
    expect((realm(b, 2)['discoveries'] as Raw[]).map((d) => d['id'])).toEqual(['sd03']);
  });

  test('the scholars draw one die for each choice they settle, none for one picked', () => {
    const { tc } = fresh((bb) => {
      choices(bb, 0, ['a', CHOICE]);
      choices(bb, 1, ['b', CHOICE]);
      return { sends: { 1: { discoveryChoices: { b: 'sd03' } } } };
    });
    const kcRng = vm.runInContext('kcRng', engine) as { use(next: () => number): () => number };
    let draws = 0;
    const was = kcRng.use(() => {
      draws++;
      return 0.5;
    });
    try {
      stage(RESEARCH)(tc);
    } finally {
      kcRng.use(was);
    }
    expect(draws).toBe(1);
  });

  test.each([
    [0, 'sd03'],
    [0.33, 'sd03'],
    [0.34, 'sd04'],
    [0.66, 'sd04'],
    [0.67, 'sd05'],
    [0.99999, 'sd05'],
  ])('with three leads and the die at %s, the scholars pursue %s', (die, want) => {
    const { b, tc } = fresh((bb) => {
      choices(bb, 0, ['a', ['sd03', 'sd04', 'sd05']]);
      return {};
    });
    run(tc, [RESEARCH], { roll: 1, die });
    expect((realm(b, 0)['discoveries'] as Raw[]).map((d) => d['id'])).toEqual([want]);
  });

  test('a retired lead the game still lists is never pursued, even picked: the scholars choose another, and it is forgotten', () => {
    const { b, tc } = fresh((bb) => {
      choices(bb, 0, ['a', ['sd34', 'sd03']]);
      return { sends: { 0: { discoveryChoices: { a: 'sd34' } } } };
    });
    vm.runInContext(`DISC_BY_ID.sd34={id:'sd34',name:'Old Lore',category:'Scholarship',desc:'Retired.'}`, engine);
    try {
      run(tc, [RESEARCH]);
      expect((realm(b, 0)['discoveries'] as Raw[]).map((d) => d['id'])).toEqual(['sd03']);
      expect(realm(b, 0)['forgottenDiscoveries']).toEqual(['sd34']);
      expect(told(outcomeOf(b), pursuit(b, 0, 'sd03', false, ['sd34'])).length).toBe(1);
    } finally {
      vm.runInContext('delete DISC_BY_ID.sd34', engine);
    }
  });

  test('a lead the realm knows only by a gap in its list is still a lead to pursue', () => {
    const { b, tc } = fresh((bb) => {
      realm(bb, 0)['discoveries'] = [null];
      choices(bb, 0, ['a', ['sd03']]);
      return {};
    });
    run(tc, [RESEARCH]);
    expect((realm(b, 0)['discoveries'] as (Raw | null)[]).map((d) => d?.['id'] ?? null)).toEqual([null, 'sd03']);
  });

  test('a gap among the pending choices is dropped; a gap in the realms’ list is passed over', () => {
    const { b, tc } = fresh((bb) => {
      realm(bb, 0)['pendingDiscoveryChoices'] = [null, { key: 'k', options: ['sd03'], turn: bb.G.turn - 1 }];
      choices(bb, 2, ['k', ['sd04']]);
      return {};
    });
    G(b).players[1] = null as unknown as Board['G']['players'][number];
    run(tc, [RESEARCH]);
    expect(realm(b, 0)['pendingDiscoveryChoices']).toEqual([]);
    expect(starting(outcomeOf(b), '💡 ')).toHaveLength(2);
  });

  test('relations already made are left as they are, the same table', () => {
    const { b, tc } = fresh();
    const rel = b.G.relations;
    run(tc, [RESEARCH]);
    expect(b.G.relations).toBe(rel);
  });
});

describe('War without warning, the titles, the lines and the messages: what the second stage calls', () => {
  test('the war is set under the key the relations use for the pair, asked of the declarer first', () => {
    const { b, tc } = fresh((bb) => {
      creed(bb, 2, 'Evil');
      return { sends: { 2: { diplomacy: { 1: 'enemy' } } } };
    });
    const calls = standIn(['relKeyOf'], () => {
      run(tc, [WAR_AND_MESSAGES]);
    });
    expect(calls.map((c) => c.args)).toEqual([[2, 1]]);
    expect(b.G.relations['1-2']).toBe('enemy');
  });

  test('a realm with no name is named by its number in the war’s line, on both sides', () => {
    const { b, tc } = fresh((bb) => {
      creed(bb, 2, 'Undead');
      return { sends: { 2: { diplomacy: { 1: 'enemy' } } } };
    });
    realm(b, 2).name = '';
    realm(b, 1).name = '';
    run(tc, [WAR_AND_MESSAGES]);
    expect(told(outcomeOf(b), warNow('Realm 3', 'Realm 2', true)).length).toBe(1);
  });

  test('a declaration on a realm the game doesn’t have, and a gap in the realms’ list, change nothing', () => {
    const { b, tc } = fresh((bb) => {
      creed(bb, 0, 'Evil');
      return { sends: { 0: { diplomacy: { 7: 'enemy', 2: 'enemy' } } } };
    });
    G(b).players[1] = null as unknown as Board['G']['players'][number];
    run(tc, [WAR_AND_MESSAGES]);
    expect(b.G.relations).toEqual({ '0-1': 'enemy', '0-2': 'enemy' });
    expect(starting(outcomeOf(b), '⚔ ')).toHaveLength(1);
  });

  test('a declaration with no realm under it changes nothing; a declarer missing from the declarations declares nothing', () => {
    const { b, tc } = fresh((bb) => {
      creed(bb, 1, 'Evil');
      creed(bb, 2, 'Evil');
      return {};
    });
    tc['diploDeclarations'] = { 1: null };
    run(tc, [WAR_AND_MESSAGES]);
    expect(b.G.relations).toEqual({ '0-1': 'enemy', '0-2': 'allied' });
  });

  test('from turn 5 the standings and the minor titles are each worked out once, from the save; before it, neither', () => {
    const early = fresh((bb) => {
      bb.G.turn = 4;
      return {};
    });
    expect(
      standIn(['computeStandings', 'computeMinorTitles'], () => {
        run(early.tc, [WAR_AND_MESSAGES]);
      }),
    ).toEqual([]);
    const late = fresh((bb) => {
      bb.G.turn = 5;
      return {};
    });
    const calls = standIn(['computeStandings', 'computeMinorTitles'], () => {
      run(late.tc, [WAR_AND_MESSAGES]);
    });
    expect(calls.map((c) => [c.fn, c.args.length, c.args[0] === late.b.G])).toEqual([
      ['computeStandings', 1, true],
      ['computeMinorTitles', 1, true],
    ]);
  });

  test('standings that fail leave no title held, the minor titles still worked out; minor titles that fail leave none of those', () => {
    const a = fresh((bb) => {
      bb.G.turn = 6;
      return {};
    });
    standIn(
      ['computeStandings'],
      () => {
        run(a.tc, [WAR_AND_MESSAGES]);
      },
      {
        computeStandings: () => {
          throw new Error('no standings');
        },
      },
    );
    expect(JSON.parse(JSON.stringify(G(a.b)['_titleHolders']))).toEqual({});
    expect(Object.keys(G(a.b)['_minorHolders'] as Raw).length).toBeGreaterThan(0);
    const c = fresh((bb) => {
      bb.G.turn = 6;
      return {};
    });
    standIn(
      ['computeMinorTitles'],
      () => {
        run(c.tc, [WAR_AND_MESSAGES]);
      },
      {
        computeMinorTitles: () => {
          throw new Error('no minor titles');
        },
      },
    );
    expect(JSON.parse(JSON.stringify(G(c.b)['_minorHolders']))).toEqual({});
    expect((G(c.b)['_titleHolders'] as Record<string, Raw>)['throne']?.['playerIndex']).toBe(0);
  });

  test('standings with no titles in them leave none held', () => {
    const { b, tc } = fresh((bb) => {
      bb.G.turn = 9;
      return {};
    });
    standIn(
      ['computeStandings'],
      () => {
        run(tc, [WAR_AND_MESSAGES]);
      },
      { computeStandings: () => ({ standings: [] }) },
    );
    expect(JSON.parse(JSON.stringify(G(b)['_titleHolders']))).toEqual({});
  });

  test('a save with no turn is read as turn 1: no title held', () => {
    const { b, tc } = fresh();
    Reflect.deleteProperty(G(b), 'turn');
    const calls = standIn(['computeStandings', 'computeMinorTitles'], () => {
      run(tc, [WAR_AND_MESSAGES]);
    });
    expect([calls.length, JSON.parse(JSON.stringify(G(b)['_titleHolders']))]).toEqual([0, {}]);
  });

  test('each realm the merge set aside for Safe Start is told, in the merge’s order; each stale warning in its order, public only when it tells of a concession', () => {
    const { b, tc } = fresh();
    tc['safeStartRefused'] = [2, 0, 2];
    tc['staleOrderWarnings'] = ['first warning', '\u{1F3F3} a concession', 'last warning'];
    run(tc, [WAR_AND_MESSAGES]);
    const ls = lines(b).filter((l) => l.type === 'system');
    expect(ls.map((l) => [l.targets, l['public'], l.actor])).toEqual([
      [[2], false, null],
      [[0], false, null],
      [[2], false, null],
      [[], false, -1],
      [[], true, -1],
      [[], false, -1],
    ]);
    expect(ls.slice(3).map((l) => l.text)).toEqual(['first warning', '\u{1F3F3} a concession', 'last warning']);
  });

  test('a removed realm is told by the name it has; a gap in the list of realms is passed over', () => {
    const { b, tc } = fresh();
    G(b)['_gmRemovedRealms'] = [0, 1, 2];
    G(b).players[1] = null as unknown as Board['G']['players'][number];
    run(tc, [WAR_AND_MESSAGES]);
    expect(starting(outcomeOf(b), '\u{1F3F3} ')).toEqual([withdrawn(realm(b, 0).name), withdrawn(realm(b, 2).name)]);
  });

  test('the dispatch carries no hero of the log’s; the sender’s copy carries the hero the log had; the log keeps its hero after', () => {
    const { b, tc } = fresh();
    tc['playerMessages'] = { 0: [{ to: [1], text: 'Hold.' }] };
    (tc['_logCtx'] as Raw)['charId'] = 42;
    run(tc, [WAR_AND_MESSAGES]);
    const ms = lines(b).filter((l) => l.type === 'message');
    expect(ms.map((l) => l.charId)).toEqual([null, 42]);
    expect((tc['_logCtx'] as Raw)['charId']).toBe(42);
  });

  test('a message to all goes to the realms whose slot rows a player holds, read from the rows', () => {
    const { b, tc } = fresh();
    tc['freshPlayers'] = inVm(
      JSON.stringify([
        { player_index: 0, user_id: 'u0' },
        { player_index: 2, user_id: 'u2' },
      ]),
    );
    tc['playerMessages'] = { 0: [{ to: 'all', text: 'Rise.' }] };
    run(tc, [WAR_AND_MESSAGES]);
    expect(
      lines(b)
        .filter((l) => l.type === 'message')
        .map((l) => l.targets),
    ).toEqual([[2], [0]]);
  });

  test('realms with no name are named by their number in a message and its copy', () => {
    const { b, tc } = fresh();
    realm(b, 0).name = '';
    realm(b, 2).name = '';
    tc['playerMessages'] = { 0: [{ to: [2], text: 'Who?' }] };
    run(tc, [WAR_AND_MESSAGES]);
    expect(
      lines(b)
        .filter((l) => l.type === 'message')
        .map((l) => l.text),
    ).toEqual([dispatch('Player 1', 'Who?'), sentTo(['Player 3'], 'Who?')]);
  });

  test('a message from a seat the save doesn’t have is delivered from “Player <n>”, with a copy to that seat', () => {
    const { b, tc } = fresh();
    tc['playerMessages'] = { 7: [{ to: [1], text: 'From afar.' }] };
    run(tc, [WAR_AND_MESSAGES]);
    expect(
      lines(b)
        .filter((l) => l.type === 'message')
        .map((l) => [l.targets, l.text]),
    ).toEqual([
      [[1], dispatch('Player 8', 'From afar.')],
      [[7], sentTo([realm(b, 1).name], 'From afar.')],
    ]);
  });

  test('a sender with no list of messages sends nothing', () => {
    const { b, tc } = fresh();
    tc['playerMessages'] = { 1: null };
    run(tc, [WAR_AND_MESSAGES]);
    expect(lines(b).filter((l) => l.type === 'message')).toEqual([]);
  });

  test('a message to every realm by number, to a realm at the end of the list, is sent', () => {
    const { b, tc } = fresh();
    tc['playerMessages'] = { 0: [{ to: [3, 2, 1.5], text: 'Edge.' }] };
    run(tc, [WAR_AND_MESSAGES]);
    expect(
      lines(b)
        .filter((l) => l.type === 'message')
        .map((l) => l.targets),
    ).toEqual([[2], [1], [0]]);
  });
});

describe('The move pools, the trackers and the sweeps: what the third stage calls', () => {
  test('each living hero of a realm is handed to the move pool, in the roster’s order, with the turn’s new pools in the context', () => {
    const { b, tc } = fresh((bb) => ({ others: [realmHero(bb, 1), realmHero(bb, 0, { alive: false })] }));
    const fresh_: boolean[] = [];
    const calls = standIn(
      ['setMovePool'],
      () => {
        run(tc, [POOLS_AND_SWEEPS]);
      },
      {
        setMovePool: (t: unknown, c: unknown) => {
          fresh_.push(!('1' in ((t as Raw)['movePoints'] as Raw)));
          (engine['__setMovePool'] as Fn | undefined)?.(t, c);
        },
      },
    );
    expect(calls.map((c) => [c.args[0] === tc, (c.args[1] as Character).id])).toEqual(
      b.G.characters.filter((c) => c.alive && c.player !== null).map((c) => [true, c.id]),
    );
    expect(fresh_.every(Boolean)).toBe(true);
  });

  test('the Dwarves’ mithril is handed the save once; the lairs’ names only for a world not yet renamed', () => {
    const a = fresh();
    expect(
      standIn(['grantMithrilToDwarves', 'renameLairsThematicP'], () => {
        run(a.tc, [POOLS_AND_SWEEPS]);
      }).map((c) => [c.fn, c.args.length === 1 && c.args[0] === a.b.G]),
    ).toEqual([['grantMithrilToDwarves', true]]);
    const c = fresh((bb) => {
      Reflect.deleteProperty(bb.G, '_lairNamesV3');
      return {};
    });
    expect(
      standIn(['grantMithrilToDwarves', 'renameLairsThematicP'], () => {
        run(c.tc, [POOLS_AND_SWEEPS]);
      }).map((x) => [x.fn, x.args[0] === c.b.G]),
    ).toEqual([
      ['grantMithrilToDwarves', true],
      ['renameLairsThematicP', true],
    ]);
  });

  test.each([
    [0, []],
    [1, [`\u{1F5FA} The chronicles are corrected: 1 lair is now recorded under a name befitting what dwells there.`]],
    [3, [`\u{1F5FA} The chronicles are corrected: 3 lairs are now recorded under a name befitting what dwells there.`]],
  ])('the lairs renamed are told as many as the renaming says: %i', (n, want) => {
    const { b, tc } = fresh((bb) => {
      Reflect.deleteProperty(bb.G, '_lairNamesV3');
      return {};
    });
    standIn(
      ['renameLairsThematicP'],
      () => {
        run(tc, [POOLS_AND_SWEEPS]);
      },
      { renameLairsThematicP: () => n },
    );
    expect(starting(outcomeOf(b), '\u{1F5FA} ')).toEqual(want);
  });

  test('each realm is asked whether its Grand Cathedral stands, as a Divine realm’s; its home is looked up only for a Cathedral with no province', () => {
    const { b, tc } = fresh((bb) => {
      realm(bb, 1)['gdProvinceId'] = seatOf(bb, 1).id;
      delete realm(bb, 2)['gdProvinceId'];
      return {};
    });
    const calls = standIn(
      ['gdActive', 'homeProvinceIdFor'],
      () => {
        run(tc, [POOLS_AND_SWEEPS]);
      },
      {
        gdActive: (_t: unknown, pi: unknown) => pi !== 0,
      },
    );
    expect(
      calls.map((c) => (c.fn === 'gdActive' ? [c.fn, c.args[0] === tc, c.args[1], c.args[2]] : [c.fn, c.args[1]])),
    ).toEqual([
      ['gdActive', true, 0, 'Divine'],
      ['gdActive', true, 1, 'Divine'],
      ['gdActive', true, 2, 'Divine'],
      ['homeProvinceIdFor', 2],
    ]);
    expect([seatOf(b, 1), seatOf(b, 2)].map((p) => p['_blessWardBy'])).toEqual([1, 2]);
  });

  test('the ward is for the save’s turn; a Cathedral whose province is off the map wards nothing and stops nothing', () => {
    const { b, tc } = fresh((bb) => {
      bb.G.turn = 7;
      realm(bb, 0)['gdProvinceId'] = seatOf(bb, 0).id;
      realm(bb, 1)['gdProvinceId'] = 9999;
      return {};
    });
    standIn(
      ['gdActive'],
      () => {
        run(tc, [POOLS_AND_SWEEPS]);
      },
      { gdActive: (_t: unknown, pi: unknown) => pi !== 2 },
    );
    expect([seatOf(b, 0)['_blessWardTurn'], seatOf(b, 0)['_blessWardPct']]).toEqual([7, 100]);
    expect(seatOf(b, 1)['_blessWardBy']).toBeUndefined();
  });

  test('the guardians’ sweep passes over gaps among the provinces and the features, and marks the world done with none to re-measure', () => {
    const { b, tc } = fresh((bb) => {
      Reflect.deleteProperty(bb.G, '_guardianHpV2');
      onlyLairs(bb);
      bb.X['features'] = [null, { ritualSite: false, monster: null }];
      return {};
    });
    const ps = b.G.world.provinces as unknown as (Raw | null)[];
    const at_ = ps.findIndex((p) => p && !(p['features'] as unknown[] | undefined)?.length);
    const keep = ps[at_] ?? null;
    ps[at_] = null;
    try {
      expect(() => {
        standIn(
          ['setMovePool', 'gdActive', 'grantMithrilToDwarves'],
          () => {
            run(tc, [POOLS_AND_SWEEPS]);
          },
          {
            setMovePool: () => undefined,
            gdActive: () => false,
            grantMithrilToDwarves: () => undefined,
          },
        );
      }).not.toThrow();
    } finally {
      ps[at_] = keep;
    }
    expect([G(b)['_guardianHpV2'], starting(outcomeOf(b), '\u{1F489} ')]).toEqual([true, []]);
  });

  test('a gap in the realms’ list stops the stage at the espionage reset (no realm is ever a gap in play: Parked)', () => {
    const { b, tc } = fresh();
    G(b).players[1] = null as unknown as Board['G']['players'][number];
    expect(() => {
      run(tc, [POOLS_AND_SWEEPS]);
    }).toThrow(/reading '_spiedProvincesThisTurn'/);
  });

  test('a realm with no list of discoveries keeps none', () => {
    const { b, tc } = fresh((bb) => {
      realm(bb, 1)['discoveries'] = null;
      return {};
    });
    run(tc, [POOLS_AND_SWEEPS]);
    expect(realm(b, 1)['discoveries']).toBeNull();
  });

  test('the seasons are a new copy each turn: a stage that changes them leaves the game’s list as it was', () => {
    const { tc } = fresh();
    run(tc, [POOLS_AND_SWEEPS]);
    (tc['SEASONS'] as string[]).push('Extra');
    expect(vm.runInContext('KC_SEASONS.length', engine)).toBe(5);
  });
});

describe('The default to Defend, the record and the war fronts: what the fourth stage calls', () => {
  test('a living realm hero with no orders kept at all is given five Defends', () => {
    const { b, tc } = fresh((bb) => ({ hero: realmHero(bb, 2) }));
    const h = must(
      b.G.characters.find((c) => c.player === 2 && !c.isKing),
      'the hero',
    );
    Reflect.deleteProperty(b.G.turnOrders, h.id);
    run(tc, [DEFAULT_DEFEND]);
    expect(ordersOf(b.G, h)).toEqual(Array.from({ length: 5 }, () => 'defend: Defend'));
  });

  test('each realm’s orders are recorded by the record’s own reckoning, handed the save, the realm and what it sent beside them', () => {
    const { b, tc } = fresh((bb) => {
      const h = realmHero(bb, 1);
      h['encounterPlan'] = { tactics: ['ME', 'DE'] };
      return { hero: h, sends: { 1: { diplomacy: { 2: 'enemy' }, callReckoning: true, concede: true } } };
    });
    const h = must(
      b.G.characters.find((c) => c.player === 1 && !c.isKing),
      'the hero',
    );
    const calls = standIn(['telOrdersFor'], () => {
      run(tc, [DEFAULT_DEFEND]);
    });
    expect(calls.map((c) => [c.args[0] === b.G, c.args[1]])).toEqual([
      [true, 0],
      [true, 1],
      [true, 2],
    ]);
    expect(JSON.parse(JSON.stringify(calls[1]?.args[2]))).toEqual({
      diplomacy: { 2: 'enemy' },
      callReckoning: true,
      concede: true,
      plans: { [h.id]: ['ME', 'DE'] },
    });
    expect(JSON.parse(JSON.stringify(calls[0]?.args[2]))).toEqual({ diplomacy: {}, plans: {} });
  });

  test('a concession is recorded when it was dated by the turn run, not the save’s turn', () => {
    const { b, tc } = fresh((bb) => {
      Object.assign(realm(bb, 2), { conceded: true, concededTurn: 9 });
      return {};
    });
    tc['expectedTurnToRun'] = 9;
    run(tc, [DEFAULT_DEFEND]);
    expect(((tc['_tel'] as Raw)['orders'] as Record<string, Raw>)['2']?.['concede']).toBe(true);
    expect(b.G.turn).not.toBe(9);
  });

  test('a record that fails is set aside with a warning: the war fronts are still worked out', () => {
    const { tc } = fresh((bb) => ({ others: [host(bb, 0, bb.X), host(bb, 1, bb.X)] }));
    const warned: unknown[] = [];
    const cons = vm.runInContext('console', engine) as Console;
    const was = cons.warn;
    cons.warn = (...a: unknown[]) => warned.push(a[0]);
    try {
      standIn(
        ['telOrdersFor'],
        () => {
          run(tc, [DEFAULT_DEFEND]);
        },
        {
          telOrdersFor: (_g: unknown, pi: unknown) => {
            if (pi === 1) throw new Error('no record');
            return { chars: {} };
          },
        },
      );
    } finally {
      cons.warn = was;
    }
    expect(warned).toEqual(['telemetry orders:']);
    expect(Object.keys((tc['_tel'] as Raw)['orders'] as Raw)).toEqual(['0']);
    expect((tc['_warFrontAtStart'] as Map<number, number>).size).toBe(2);
  });

  test('a gap in the realms’ list has no record', () => {
    const { b, tc } = fresh();
    G(b).players[1] = null as unknown as Board['G']['players'][number];
    run(tc, [DEFAULT_DEFEND]);
    expect(Object.keys((tc['_tel'] as Raw)['orders'] as Raw)).toEqual(['0', '2']);
  });

  test('the war fronts are those the threats name, handed the context once, but for ground already fought over', () => {
    const { b, tc } = fresh();
    const p = b.X;
    const q = must(b.ring1[0], 'a neighbour');
    q._battleUnresolved = true;
    const calls = standIn(
      ['warFrontThreats'],
      () => {
        run(tc, [DEFAULT_DEFEND]);
      },
      {
        warFrontThreats: () => [
          { c: { id: 1 }, prov: p },
          { c: { id: 2 }, prov: q },
          { c: { id: 3 }, prov: p },
        ],
      },
    );
    expect(calls.map((c) => c.args.length === 1 && c.args[0] === tc)).toEqual([true]);
    expect([...(tc['_warFrontAtStart'] as Map<number, number>)]).toEqual([
      [1, p.id],
      [3, p.id],
    ]);
    expect([...(tc['_warFrontProvs'] as Set<number>)]).toEqual([p.id]);
  });

  test('a host under a veil stands on no war front', () => {
    const { tc } = fresh((bb) => {
      const a = host(bb, 0, bb.X);
      a['_veiledTurn'] = bb.G.turn;
      a['_veil'] = true;
      return { others: [a, host(bb, 1, bb.X)] };
    });
    const isVeiled = engine['isVeiled'] as Fn;
    const was = isVeiled;
    engine['isVeiled'] = (t: unknown, c: Character) => c.player === 0 || (was(t, c) as boolean);
    try {
      run(tc, [DEFAULT_DEFEND]);
    } finally {
      engine['isVeiled'] = was;
    }
    expect([...(tc['_warFrontAtStart'] as Map<number, number>)]).toEqual([]);
  });
});

describe('Where resolveTurn calls them', () => {
  test('after the merge: the first two around the bots’ declarations, the third after the turn’s start values, then the bots’ passes, the fourth, and the first phase, once each, with its context', () => {
    const b = board(engine, world, 0);
    const s = stageCase(b, {
      ...NOTHING,
      stage: (bb) => {
        creed(bb, 1, 'Evil');
        return { bots: [1] };
      },
    });
    const BOTS = [
      'runBotConcessions',
      'runBotMovement',
      'runBotPhaseOne',
      'runBotEconomy',
      'runBotActions',
      'runBotOrderHygiene',
      'runBotReckoning',
    ];
    const names = [MERGE, ...STAGES, FIRST_PHASE, ...BOTS];
    const g = engine;
    const was = names.map((f) => [f, g[f] as Fn] as const);
    const seen: { fn: string; tc: unknown; declared?: unknown; deferred?: boolean; botOrders?: boolean }[] = [];
    const botHero = must(
      b.G.characters.find((c) => c.player === 1),
      'a bot hero',
    );
    for (const [f, w] of was)
      g[f] = (...a: unknown[]) => {
        if (!seen.some((x) => x.fn === FIRST_PHASE)) {
          const t = (BOTS.includes(f) ? null : (a[0] ?? null)) as Raw | null;
          const G_ = (t?.['G'] ?? a[0]) as Board['G'];
          seen.push({
            fn: f,
            tc: t,
            ...(f === STAGES[0] || f === STAGES[1]
              ? { declared: JSON.parse(JSON.stringify((t?.['diploDeclarations'] as Raw)['1'] ?? null)) }
              : {}),
            ...(f === STAGES[1] || f === STAGES[2] ? { deferred: Array.isArray(t?.['_deferredSkillLogs']) } : {}),
            ...(f === STAGES[3] ? { botOrders: (G_.turnOrders[botHero.id] ?? []).every((o) => o != null) } : {}),
          });
        }
        return w(...a);
      };
    const resolveTurn = engineFn(engine, 'resolveTurn') as (s: string, r: unknown, t: number) => unknown;
    try {
      withCaseDice(engine, LANDS, () => resolveTurn(JSON.stringify(b.G), inVm(rows(b, s)), b.G.turn));
    } finally {
      for (const [f, w] of was) g[f] = w;
    }
    const order_ = seen.map((x) => x.fn).filter((f, i, a) => f !== a[i - 1]);
    expect(order_).toEqual([
      MERGE,
      STAGES[0],
      STAGES[1],
      STAGES[2],
      ...BOTS.slice(0, 2),
      'runBotPhaseOne',
      'runBotEconomy',
      'runBotActions',
      'runBotPhaseOne',
      'runBotOrderHygiene',
      'runBotReckoning',
      STAGES[3],
      FIRST_PHASE,
    ]);
    const stages = seen.filter(
      (x) => (STAGES as readonly string[]).includes(x.fn) || x.fn === MERGE || x.fn === FIRST_PHASE,
    );
    expect(stages.map((x) => x.fn)).toEqual([MERGE, ...STAGES, FIRST_PHASE]);
    expect(stages.every((x) => x.tc === stages[0]?.tc)).toBe(true);
    expect(seen.find((x) => x.fn === STAGES[0])?.declared).toBeNull();
    expect(seen.find((x) => x.fn === STAGES[1])?.declared).toEqual({ 2: 'enemy' });
    expect(seen.filter((x) => 'deferred' in x).map((x) => x.deferred)).toEqual([false, true]);
    expect(seen.find((x) => x.fn === STAGES[3])?.botOrders).toBe(true);
  });

  test('the bots plan with the pools, the seasons and the sweeps done: the third stage has run when the first bot pass is called', () => {
    const b = board(engine, world, 0);
    const s = stageCase(b, { ...NOTHING, stage: () => ({ bots: [2] }) });
    const g = engine;
    const was = g['runBotConcessions'] as Fn;
    let pools: unknown = null;
    const tcs: Raw[] = [];
    const wasA = g[STAGES[2]] as Fn;
    g[STAGES[2]] = (t: Raw) => {
      tcs.push(t);
      return wasA(t);
    };
    g['runBotConcessions'] = (...a: unknown[]) => {
      pools = Object.keys((tcs[0]?.['moveMax'] as Raw | undefined) ?? {}).length;
      return was(...a);
    };
    const resolveTurn = engineFn(engine, 'resolveTurn') as (s: string, r: unknown, t: number) => unknown;
    try {
      withCaseDice(engine, LANDS, () => resolveTurn(JSON.stringify(b.G), inVm(rows(b, s)), b.G.turn));
    } finally {
      g['runBotConcessions'] = was;
      g[STAGES[2]] = wasA;
    }
    expect(pools).toBe(b.G.characters.filter((c) => c.alive && c.player != null).length);
  });
});

// ── Properties ───────────────────────────────────────────────────────────────────────────────────────────────────
describe('Properties of the four stages', () => {
  const POOL = ['sd03', 'sd04', 'sd05', 'sd06', 'sd99'];
  test('a research choice settles on the lead picked, or the die’s among those the realm may still find, forgetting the rest; with none it is dropped', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom(...POOL), { minLength: 1, maxLength: 4 }),
        fc.uniqueArray(fc.constantFrom('sd03', 'sd04', 'sd05', 'sd06'), { maxLength: 3 }),
        fc.option(fc.constantFrom(...POOL), { nil: undefined }),
        fc.double({ min: 0, max: 0.99999, noNaN: true }),
        (options, known, pick, die) => {
          const { b, tc } = fresh((bb) => {
            realm(bb, 0)['discoveries'] = known.map((id: string) => ({ id }));
            choices(bb, 0, ['k', options]);
            return pick ? { sends: { 0: { discoveryChoices: { k: pick } } } } : {};
          });
          run(tc, [RESEARCH], { roll: 1, die });
          const open = options.filter((id) => id !== 'sd99' && !(known as string[]).includes(id));
          const ids = (realm(b, 0)['discoveries'] as Raw[]).map((d) => d['id']);
          const ls = starting(outcomeOf(b), '💡 ');
          expect(realm(b, 0)['pendingDiscoveryChoices']).toEqual([]);
          const chosen = open.length
            ? pick && open.includes(pick)
              ? pick
              : open[Math.floor(die * open.length)]
            : null;
          const lost = options.filter((id) => id !== chosen);
          expect({ ids, ls, forgotten: realm(b, 0)['forgottenDiscoveries'] ?? null }).toEqual(
            chosen
              ? {
                  ids: [...known, chosen],
                  ls: [pursuit(b, 0, chosen, !!pick && open.includes(pick), lost)],
                  forgotten: lost,
                }
              : { ids: known, ls: [], forgotten: null },
          );
        },
      ),
      { seed: SEED, numRuns: 150 },
    );
  });

  test('a message reaches exactly the realms it may, once each, with one copy to the sender naming them', () => {
    const target = fc.oneof(fc.integer({ min: -1, max: 4 }), fc.constant('all'), fc.constantFrom('0', '2'));
    fc.assert(
      fc.property(
        fc.constantFrom(0, 1, 2),
        fc.oneof(fc.array(target, { maxLength: 5 }), fc.constant('all'), fc.constant(1)),
        fc.oneof(fc.constant('  hi  '), fc.constant(''), fc.string({ maxLength: 8 })),
        (from, to, text) => {
          const { b, tc } = fresh();
          tc['playerMessages'] = { [from]: [{ to, text }] };
          run(tc, [WAR_AND_MESSAGES]);
          const t = text.trim().slice(0, 1000);
          const all = to === 'all' || (Array.isArray(to) && to.includes('all'));
          const named = Array.isArray(to)
            ? to.map((x) => parseInt(String(x))).filter((i) => Number.isInteger(i) && i >= 0 && i < 3)
            : [];
          const rc = t ? [...new Set((all ? [0, 1, 2] : named).filter((i) => i !== from))] : [];
          const ms = lines(b).filter((l) => l.type === 'message');
          expect(ms.map((l) => [l.targets, l.text])).toEqual(
            rc.length
              ? [
                  ...rc.map((i) => [[i], dispatch(realm(b, from).name, t)]),
                  [
                    [from],
                    sentTo(
                      rc.map((i) => realm(b, i).name),
                      t,
                    ),
                  ],
                ]
              : [],
          );
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
  });

  test('an Evil or Undead realm’s war on a realm it has met stands at once, told once; every other declaration waits', () => {
    const CREEDS = ['Divine', 'Good', 'Neutral', 'Pagan', 'Evil', 'Undead'];
    const decl = fc.constantFrom('enemy', 'treat', undefined);
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...CREEDS), { minLength: 3, maxLength: 3 }),
        fc.array(fc.array(decl, { minLength: 3, maxLength: 3 }), { minLength: 3, maxLength: 3 }),
        fc.array(fc.boolean(), { minLength: 6, maxLength: 6 }),
        fc.array(fc.constantFrom('enemy', 'allied', 'neutral'), { minLength: 3, maxLength: 3 }),
        (creeds, decls, meets, rel) => {
          const pairs = [
            [0, 1],
            [0, 2],
            [1, 2],
          ] as const;
          const { b, tc } = fresh((bb) => {
            creeds.forEach((c, i) => {
              creed(bb, i, c);
            });
            relate(
              bb,
              Object.fromEntries(
                pairs.flatMap(([x, y], k) => (rel[k] === 'neutral' ? [] : [[`${String(x)}-${String(y)}`, rel[k]]])),
              ) as Record<string, 'enemy' | 'allied'>,
            );
            const met = [
              [0, 1],
              [0, 2],
              [1, 0],
              [1, 2],
              [2, 0],
              [2, 1],
            ] as const;
            met.forEach(([x, y], k) => {
              if (!meets[k]) unmet(bb, x, y);
            });
            return {};
          });
          tc['diploDeclarations'] = Object.fromEntries(
            decls.map((d, a) => [a, Object.fromEntries(d.flatMap((v, x) => (v ? [[x, v]] : [])))]),
          );
          const before = { ...b.G.relations };
          run(tc, [WAR_AND_MESSAGES]);
          const metOf = (a: number, x: number) =>
            ((realm(b, a)['_encountered'] as number[] | undefined) ?? []).includes(x);
          const strikes = (a: number, x: number) =>
            ['Evil', 'Undead'].includes(must(creeds[a], 'creed')) && decls[a]?.[x] === 'enemy' && metOf(a, x);
          let wars = 0;
          for (const [x, y] of pairs) {
            const key = `${String(x)}-${String(y)}`;
            const now = strikes(x, y) || strikes(y, x);
            expect(b.G.relations[key] ?? 'neutral').toBe(now ? 'enemy' : (before[key] ?? 'neutral'));
            if (now && before[key] !== 'enemy') wars++;
          }
          expect(starting(outcomeOf(b), '⚔ ').length).toBe(wars);
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
  });

  test('every empty phase sent is Defend and only those, the phases sent kept, a hero sent nothing Defending all five', () => {
    const phase = fc.oneof(fc.constant(null), fc.constantFrom('rest', 'move', 'explore'));
    fc.assert(
      fc.property(fc.array(phase, { maxLength: 6 }), fc.boolean(), (sent, sendAny) => {
        let h: Character | null = null;
        const { b, tc } = fresh((bb) => {
          h = realmHero(bb, 1);
          return sendAny
            ? { sends: { 1: { orders: { [h.id]: sent.map((a) => (a ? order(a) : null)) } } } }
            : { slots: { 1: { orders: null } } };
        });
        run(tc, [DEFAULT_DEFEND]);
        const want = sendAny
          ? sent.map((a) => (a ? a : 'defend: Defend'))
          : Array.from({ length: 5 }, () => 'defend: Defend');
        expect(ordersOf(b.G, must(h as Character | null, 'the hero'))).toEqual(want);
      }),
      { seed: SEED, numRuns: 150 },
    );
  });

  test('an old world’s guardians are each 5 HP frailer, never below 5, their undamaged HP too; only those with HP counted', () => {
    const hp = fc.option(fc.integer({ min: 0, max: 40 }), { nil: null });
    fc.assert(
      fc.property(fc.array(fc.tuple(hp, hp), { minLength: 1, maxLength: 4 }), (guards) => {
        const { b, tc } = fresh((bb) => {
          Reflect.deleteProperty(bb.G, '_guardianHpV2');
          onlyLairs(bb, ...guards.map(([h, f]) => lair(bb, h, f)));
          return {};
        });
        run(tc, [POOLS_AND_SWEEPS]);
        const ms = ((b.X['features'] as Raw[] | undefined) ?? []).map((f) => f['monster'] as Raw);
        expect(ms.map((m) => [m['hp'] ?? null, m['_hpFull'] ?? null])).toEqual(
          guards.map(([h, f]) => [h == null ? null : Math.max(5, h - 5), f == null ? null : Math.max(5, f - 5)]),
        );
        const n = guards.filter(([h]) => h != null).length;
        expect(starting(outcomeOf(b), '\u{1F489} ')).toEqual(
          n
            ? [
                `\u{1F489} The world's guardians are re-measured: ${String(n)} lair-keeper${n !== 1 ? 's are' : ' is'} 5 hit points frailer than before.`,
              ]
            : [],
        );
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
