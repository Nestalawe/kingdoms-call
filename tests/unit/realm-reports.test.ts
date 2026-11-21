// playerEvents (src/views/every-realms-report-and-the-lines-each-realm-reads.ts, plan P1-12b3: the lines a realm reads,
// taken out of buildReports, which P1-08d lifted out of resolveTurn), called directly on the engine's modules (since
// P1-14m; the bare vm before). The balance matrix runs it every turn, for every realm; this test pins the rule at its
// heart on its own.
// - Property (fast-check): from any turn's log, each realm reads exactly the lines the rule allows, in the log's
//   order. A line written for everyone but some realms (notFor) never reaches them. Otherwise a realm reads a
//   line sent to it, one its own realm did, one about its own hero (filed under that hero), and a public line with no
//   province (the world is told) or in one of its own provinces. Nothing else: no other realm's private business, and
//   no public line from a province it has no eyes on (no hero stood there and no spy saw it, as on this context).
// - Its Clairvoyance feed (P1-21b): a realm watching another realm's hero by Clairvoyance reads every line about him
//   from the phase the watch began (the phase it was cast), not before, each once, and where he stands as the turn
//   ends (no such line once he has fallen). No other test and no game of the balance matrix builds a report with a
//   Clairvoyance watch.
// - Its spy feed (R-118, P1-23d): a realm that spied a province reads, from the next phase on, what another realm's
//   heroes do there (a line with a deed) or anyone there could see (a public line, a battle's included), never their
//   realm's own news (a line told to it with no deed: a hit-point rise, a curse felt), a line with no reader, or a line
//   that excepts it. No game of the matrix writes a line that excepts a spying realm in its feed.
// - Both feeds pass over a line by its kind, as the words pass hands it beside each stored line (P1-12d36): a force
//   drawn up for battle, and in the Clairvoyance feed the roll lines too; any other kind is read, whatever its words
//   open with. Every other line here is staged with no kind (null), as a line with no fact. Each line is staged with
//   its whole audience beside it too, the one emit stores so (the gate reads it: B-18f).
// - A force drawn up for battle carries its kind into the realm's chronicle, and no other line does, whatever its words
//   open with and whatever lines the realm can't read come before it: the pages draw a force's rows by it alone.
// - One realm's report (buildTurnReport, src/views/turn-report.ts, P1-10b30) on its view (playerView) of a world
//   staged for it, which no game of the matrix builds: a Good realm's Wonder's tax, Enslave's gold off the tax, the
//   minor titles' gold and the Thief network (B-06c), a skeleton's wage, a Wonder's realm
//   wherever the map shows it, and the hero it watches by Clairvoyance and the heroes beside a province it spied, each
//   in a province it has never seen.
// Level 1 (unit): each function is called on a world (and a turn's sight) made in the test; nothing else of the turn
// runs.
// The property describes the game as it is; a fault planted in a copy of the function turns it red (the PR shows it).
// Over whole turns, the balance matrix's every-realm half and the tests (simulation/every-realms-report-…, concede) cover it.
import '../lib/the-whole-engine.ts';
import fc from 'fast-check';
import { afterAll, describe, expect, test } from 'vitest';
import {
  aFreshTurnsContextOnTheWorld,
  botWorld,
  loadTheEngineOnItsModules,
  quietEngineLog,
  type TurnContext,
} from '../lib/the-middle-of-a-bot-world-in-a-turn-on-the-engines-modules.ts';
import { timeLimitForPropertyRuns } from '../lib/time-limits.ts';
import type { LineAudience } from '../../src/engine/turn/events-and-their-audiences.ts';

const engine = await loadTheEngineOnItsModules({ seed: 1 });
const restoreLog = quietEngineLog(engine);
afterAll(restoreLog);
// (the engine's own modules, fresh with it)
const { playerEvents: playerEventsAsItsModuleExportsIt } =
  await import('../../src/views/every-realms-report-and-the-lines-each-realm-reads.ts');
const { playerView: playerViewAsItsModuleExportsIt } =
  await import('../../src/views/what-each-realm-may-see-of-the-world.ts');
const { buildTurnReport: buildTurnReportAsItsModuleExportsIt } = await import('../../src/views/turn-report.ts');
const { TITLES_PUBLIC_FROM_TURN } = await import('../../src/engine/titles/perks.ts');
const REALMS = 3;
const freshPlayers = Array.from({ length: REALMS }, (_, i) => ({
  id: `gp${String(i)}`,
  user_id: `u${String(i)}`,
  player_index: i,
}));
const tc = aFreshTurnsContextOnTheWorld(engine, botWorld(engine, REALMS, { cols: 12, rows: 7 }), { freshPlayers });
const G = tc.G as {
  world: { provinces: { name: string }[] };
  players: { provinces?: number[] }[];
  characters: { id: number; player: number | null; name: string; location: number; alive: boolean }[];
};
const playerEvents = playerEventsAsItsModuleExportsIt as unknown as (
  events: Entry[],
  state: TurnContext['G'],
  realm: number,
  sight: { presenceByPhase: unknown; battleCommanders: unknown; clairWatch: unknown },
  theKindOfEachLine: (string | null)[],
  theAudienceOfEachLine: LineAudience[],
) => { lastTurnLog: Line[]; spyActivity: { provId: number; lines: { phase: number; text: string }[] }[] };
/** The turn's sight, as the context starts it: nobody has stood anywhere in a phase, fought or watched yet. */
const sight = {
  presenceByPhase: tc['presenceByPhase'],
  battleCommanders: tc['battleCommanders'],
  clairWatch: tc['clairWatch'],
};
/** Each staged line's kind, beside the log as the words pass hands it: none (null), as a line with no fact. */
const noKinds = (log: readonly Entry[]) => log.map(() => null);
/** Each staged line's whole audience, beside the log as the words pass hands it: the one emit stores so (the realms it
 *  is told to, its actor and the realms it excepts; a public line seen by the world with no province, in the battle as
 *  a combat line, else there). */
const theirAudiences = (log: readonly Entry[]) =>
  log.map((e): LineAudience => ({
    realms: e.targets,
    actor: e.actor,
    ...(e.public ? { seen: e.provinceId == null ? 'world' : e.type === 'combat' ? 'battle' : 'there' } : {}),
    ...(e.notFor ? { except: e.notFor } : {}),
  }));

interface Line {
  text: string;
  charId: unknown;
  phase: unknown;
  kind?: unknown;
}
interface Entry {
  type: string;
  text: string;
  actor: number | null;
  targets: number[];
  notFor?: number[];
  public: boolean;
  provinceId: number | null;
  charId: number | null;
  charIds: null;
  phase: number | null;
  spy?: boolean;
}

// fast-check's run count for every property (tests/setup/fast-check.ts): 100, or 1,000 under KC_FULL. The test's time
// limit is 50 ms an input, so npm test's 100 keep Vitest's 5 s and KC_FULL's 1,000 get 50 s. A log takes 1 ms to read
// on a laptop and took 6.2 ms on the nightly run (1,000 in 6.2 s, timing out at 5 s: tests/lib/time-limits.ts).
const RUNS = fc.readConfigureGlobal().numRuns ?? 100;
const LIMIT = timeLimitForPropertyRuns(RUNS, 50);

const realm = fc.integer({ min: 0, max: REALMS - 1 });
const realms = fc.uniqueArray(realm, { maxLength: REALMS });
const owned = G.players.flatMap((p) => p.provinces ?? []);
const heroIds = G.characters.map((c) => c.id);
if (!owned.length || !heroIds.length) throw new Error('the world has no owned province or no hero');
const entry = fc.record(
  {
    type: fc.constantFrom('system', 'movement', 'diplomacy'),
    actor: fc.option(realm),
    targets: realms,
    notFor: realms,
    public: fc.boolean(),
    provinceId: fc.option(
      fc.oneof(fc.constantFrom(...owned), fc.integer({ min: 0, max: G.world.provinces.length - 1 })),
    ),
    charId: fc.option(fc.oneof(fc.constantFrom(...heroIds), fc.constant(987654))),
    phase: fc.option(fc.integer({ min: 0, max: 4 })),
  },
  { requiredKeys: ['type', 'actor', 'targets', 'public', 'provinceId', 'charId', 'phase'] },
);

test('each realm reads exactly the lines the visibility rule allows, in the log’s order', LIMIT, () => {
  fc.assert(
    fc.property(fc.array(entry, { maxLength: 30 }), (drawn) => {
      const log: Entry[] = drawn.map((e, i) => ({ ...e, text: `[line ${String(i)}]`, charIds: null }));
      for (const { player_index: pi } of freshPlayers) {
        const read = playerEvents(
          log.map((e) => ({ ...e })),
          tc.G,
          pi,
          sight,
          noKinds(log),
          theirAudiences(log),
        );
        const ownHeroes = new Set(G.characters.filter((c) => c.player === pi).map((c) => c.id));
        const ownProvinces = new Set(G.players[pi]?.provinces ?? []);
        const ownHero = (e: Entry) => e.charId != null && ownHeroes.has(e.charId);
        const shown = (e: Entry) =>
          !(e.notFor ?? []).includes(pi) &&
          (e.targets.includes(pi) ||
            e.actor === pi ||
            ownHero(e) ||
            (e.public && (e.provinceId == null || ownProvinces.has(e.provinceId))));
        const expected = log
          .filter(shown)
          .map((e) => ({ text: e.text, charId: ownHero(e) ? e.charId : null, phase: e.phase }));
        const seen = read.lastTurnLog
          .filter((l) => l.text.startsWith('[line '))
          .map((l) => ({ text: l.text, charId: l.charId, phase: l.phase }));
        expect(seen).toEqual(expected);
      }
    }),
    {
      numRuns: RUNS,
      examples: [
        [
          [
            {
              type: 'system',
              actor: 0,
              targets: [],
              notFor: [1],
              public: true,
              provinceId: null,
              charId: null,
              phase: 2,
            },
          ],
        ],
      ],
    },
  );
});

describe('the Clairvoyance feed', () => {
  // Realm 0 watches realm 1's hero from phase 2 (the phase it cast the spell). The lines about him are written for his
  // own realm only (it is their actor), so realm 0 reads them through the watch alone; one is told to realm 0 as well.
  const watched = G.characters.find((c) => c.player === 1 && c.alive);
  if (!watched) throw new Error('realm 1 has no living hero');
  const FROM = 2;
  const about = (n: number, phase: number | null, extra: Partial<Entry> = {}): Entry => ({
    type: 'movement',
    text: `[about him ${String(n)}]`,
    actor: 1,
    targets: [],
    public: false,
    provinceId: null,
    charId: watched.id,
    charIds: null,
    phase,
    ...extra,
  });
  const log: Entry[] = [
    about(0, 0),
    about(1, 1),
    about(2, FROM),
    about(3, 3, { targets: [0] }), // told to realm 0 as well: read once, as told
    about(4, 4),
    about(5, null), // a line with no phase: not part of the feed
    { ...about(6, 3), charId: null, text: '[about someone else]' },
  ];
  const watching = { ...sight, clairWatch: { 0: { charId: watched.id, fromPhase: FROM } } };
  const read = () =>
    playerEvents(
      log.map((e) => ({ ...e })),
      tc.G,
      0,
      watching,
      noKinds(log),
      theirAudiences(log),
    ).lastTurnLog.map((l) => ({ text: l.text, phase: l.phase }));
  const where = G.world.provinces[watched.location]?.name;

  test('a realm reads every line about the hero it watches from the phase the watch began, each once', () => {
    expect(read().filter((l) => l.text.includes('[about'))).toEqual([
      { text: '[about him 3]', phase: 3 },
      { text: '🔮 Clairvoyance — [about him 2]', phase: 2 },
      { text: '🔮 Clairvoyance — [about him 4]', phase: 4 },
    ]);
  });
  test('and where he stands as the turn ends', () => {
    expect(read().filter((l) => l.phase === null)).toEqual([
      {
        text: `🔮 Clairvoyance — as the turn ends, ${watched.name} stands in ${String(where)}. They are marked on your map.`,
        phase: null,
      },
    ]);
  });
  test('and nowhere once he has fallen: no line says where he stands', () => {
    const heFell = {
      ...tc.G,
      characters: G.characters.map((c) => (c.id === watched.id ? { ...c, alive: false } : c)),
    };
    const read = playerEvents(
      log.map((e) => ({ ...e })),
      heFell,
      0,
      watching,
      noKinds(log),
      theirAudiences(log),
    ).lastTurnLog;
    expect(read.filter((l) => l.text.includes('🔮 Clairvoyance — [about'))).toHaveLength(2);
    expect(read.filter((l) => l.phase === null)).toEqual([]);
  });
  test('a realm watching no hero reads none of those lines', () => {
    const lines = playerEvents(
      log.map((e) => ({ ...e })),
      tc.G,
      2,
      watching,
      noKinds(log),
      theirAudiences(log),
    ).lastTurnLog.filter((l) => l.text.includes('Clairvoyance') || l.text.includes('[about'));
    expect(lines).toEqual([]);
  });
  test('it passes over a line by its kind: a force drawn up for battle and the roll lines; any other kind is read, whatever its words open with', () => {
    const staged: [Entry, string][] = [
      [about(7, 3, { text: '[a force drawn up]' }), 'a force drawn up for battle'],
      [about(8, 3, { text: '[a spell rolled]' }), "a spell's cast is rolled"],
      [about(9, 3, { text: '[a battle’s outcome]' }), "the battle's outcome and its margin"],
      [about(10, 3, { text: '[an ambush’s odds]' }), "the odds of a lone defender's ambush"],
      [about(11, 3, { text: '📊 [a spell fizzles]' }), 'a spell fizzles without effect'],
      [about(12, 3, { text: '⚑FORCE⚑ [a battle decided]' }), 'a battle is decided'],
    ];
    const scried = playerEvents(
      staged.map(([e]) => ({ ...e })),
      tc.G,
      0,
      watching,
      staged.map(([, kind]) => kind),
      theirAudiences(staged.map(([e]) => e)),
    ).lastTurnLog.filter((l) => l.phase !== null);
    expect(scried.map((l) => l.text)).toEqual([
      '🔮 Clairvoyance — 📊 [a spell fizzles]',
      '🔮 Clairvoyance — ⚑FORCE⚑ [a battle decided]',
    ]);
  });
});

test("a force drawn up for battle carries its kind into the realm's chronicle; every other line carries none, whatever its words open with", () => {
  // Realm 0's king fights; each line is about him, so realm 0 reads all three.
  const king = G.characters.find((c) => c.player === 0 && c.alive);
  if (!king) throw new Error('realm 0 has no living hero');
  const his = (text: string): Entry => ({
    type: 'combat',
    text,
    actor: 0,
    targets: [0],
    public: false,
    provinceId: null,
    charId: king.id,
    charIds: null,
    phase: 1,
  });
  const staged: [Entry, string | null][] = [
    [his('⚑FORCE⚑{"name":"Aldric"}'), 'a force drawn up for battle'],
    [his('⚑FORCE⚑ [a battle decided]'), 'a battle is decided'],
    [his('⚑FORCE⚑ [a line with no fact]'), null],
  ];
  const read = playerEvents(
    staged.map(([e]) => ({ ...e })),
    tc.G,
    0,
    sight,
    staged.map(([, kind]) => kind),
    theirAudiences(staged.map(([e]) => e)),
  ).lastTurnLog.map((l): [string, unknown] => [l.text, l.kind]);
  expect(read).toEqual([
    ['⚑FORCE⚑{"name":"Aldric"}', 'a force drawn up for battle'],
    ['⚑FORCE⚑ [a battle decided]', undefined],
    ['⚑FORCE⚑ [a line with no fact]', undefined],
  ]);
});

test("a line the realm can't read, before a force's row: the kind sits on the force's row alone", () => {
  // Realm 0 reads its king's lines, not a line realm 1 alone is told (staged first, with no kind).
  const king = G.characters.find((c) => c.player === 0 && c.alive);
  const rival = G.characters.find((c) => c.player === 1 && c.alive);
  if (!king || !rival) throw new Error('realm 0 or realm 1 has no living hero');
  const about = (hero: { id: number }, realm: number, text: string): Entry => ({
    type: 'combat',
    text,
    actor: realm,
    targets: [realm],
    public: false,
    provinceId: null,
    charId: hero.id,
    charIds: null,
    phase: 1,
  });
  const staged: [Entry, string | null][] = [
    [about(rival, 1, '[told to realm 1 alone]'), null],
    [about(king, 0, '⚑FORCE⚑{"name":"Aldric"}'), 'a force drawn up for battle'],
    [about(king, 0, '⚑FORCE⚑ [a battle decided]'), 'a battle is decided'],
  ];
  const read = playerEvents(
    staged.map(([e]) => ({ ...e })),
    tc.G,
    0,
    sight,
    staged.map(([, kind]) => kind),
    theirAudiences(staged.map(([e]) => e)),
  ).lastTurnLog.map((l): [string, unknown] => [l.text, l.kind]);
  expect(read).toEqual([
    ['⚑FORCE⚑{"name":"Aldric"}', 'a force drawn up for battle'],
    ['⚑FORCE⚑ [a battle decided]', undefined],
  ]);
});

describe("the spy feed: what rival heroes do there, never their realm's news (R-118)", () => {
  // Realm 0's spy looks over a province of realm 1's in phase 1; realm 1's hero is there. From phase 2 on, realm 0's
  // feed reads his deeds and what anyone there could see, and nothing told to his realm alone.
  const rival = G.characters.find((c) => c.player === 1 && c.alive);
  const where = G.players[1]?.provinces?.[0];
  if (!rival || where == null) throw new Error('realm 1 has no living hero or no province');
  const there = (text: string, extra: Partial<Entry>): Entry => ({
    type: 'system',
    text,
    actor: null,
    targets: [],
    public: false,
    provinceId: where,
    charId: rival.id,
    charIds: null,
    phase: 2,
    ...extra,
  });
  const theSpyLooks: Entry = {
    ...there('[the spy looks]', { actor: 0, targets: [0], spy: true, phase: 1 }),
    charId: null,
  };
  const log: Entry[] = [
    theSpyLooks,
    there('[his deed]', { actor: 1, targets: [1] }),
    there('[his deed, told to others too]', { actor: 1, targets: [1, 2] }),
    there('[seen there]', { public: true }),
    there('[a battle line]', { type: 'combat', public: true, targets: [1] }),
    there('[told to his realm, no deed]', { targets: [1] }),
    there('[hardened, as told now]', { type: 'combat', targets: [1] }),
    there('[the GM alone]', {}),
    there('[seen there, but not by realm 0]', { public: true, notFor: [0] }),
    there('[his deed in the spy’s own phase]', { actor: 1, targets: [1], phase: 1 }),
  ];
  const feed = () =>
    playerEvents(
      log.map((e) => ({ ...e })),
      tc.G,
      0,
      sight,
      noKinds(log),
      theirAudiences(log),
    ).spyActivity.flatMap((s) => s.lines.map((l) => l.text));

  test('it reads his deeds and what anyone there could see after the spy came; never his realm’s news, a line with no reader, or one that excepts it', () => {
    expect(feed()).toEqual(['[his deed]', '[his deed, told to others too]', '[seen there]', '[a battle line]']);
  });
  test('it passes over a force drawn up for battle by its kind; any other kind is read, whatever its words open with', () => {
    const staged: [Entry, string][] = [
      [theSpyLooks, "a spy's roll to spy out a province"],
      [there('[a force drawn up]', { type: 'combat', public: true, targets: [1] }), 'a force drawn up for battle'],
      [there('⚑FORCE⚑ [a battle decided]', { type: 'combat', public: true, targets: [1] }), 'a battle is decided'],
      [there('📊 [a spell rolled]', { actor: 1, targets: [1] }), "a spell's cast is rolled"],
    ];
    expect(
      playerEvents(
        staged.map(([e]) => ({ ...e })),
        tc.G,
        0,
        sight,
        staged.map(([, kind]) => kind),
        theirAudiences(staged.map(([e]) => e)),
      ).spyActivity.flatMap((s) => s.lines.map((l) => l.text)),
    ).toEqual(['⚑FORCE⚑ [a battle decided]', '📊 [a spell rolled]']);
  });
});

// One realm's report (buildTurnReport, src/views/turn-report.ts) on its view of a world staged for it (playerView): what
// no game of the matrix builds. Each case stages a fresh world of three bot realms and reads realm 0's report.
describe("one realm's report on a world staged for it", () => {
  interface Unit {
    type: string;
    quality: string;
    _isSkeletal?: boolean;
  }
  interface Hero {
    id: number;
    player: number | null;
    location: number;
    alive: boolean;
    isKing: boolean;
    armies: Unit[];
  }
  interface Wonder {
    owner: number;
    name: string;
    alignment: string;
    builtTurn: number;
  }
  interface Province {
    id: number;
    owner: number | null;
    tax: number;
    armyTypes: string[];
    characters: number[];
    garrisonArmies?: Unit[];
    grandDesign?: Wonder;
  }
  interface Realm {
    name: string;
    alignment: string;
    provinces: number[];
    discoveries?: { id: string; name: string; category: string; desc: string; turnDiscovered: number }[];
    _spiedProvincesThisTurn?: number[];
    _clairCharThisTurn?: number | null;
    _lastWages?: unknown;
    heroOrder?: string[];
  }
  interface World {
    players: Realm[];
    characters: Hero[];
    world: { provinces: Province[] };
  }
  interface Seen {
    owned: boolean;
    visited: boolean;
    nextToOwnedOrVisited: boolean;
    heroThere: boolean;
    spied: boolean;
    nextToSpied: boolean;
    nextToOwned: boolean;
    watchedHeroThere: boolean;
  }
  interface View {
    provinces: { id: number; seen: Seen; neighbours: number[]; remembered: unknown }[];
  }
  interface OnTheMap {
    id: number;
    tier: string;
    wealth?: string;
    armyTypes?: string[];
    grandDesign?: { ownerName: string | null } | null;
    characters?: { id: number; ownerName: string | null }[];
  }
  interface Report {
    kingdom: { sdGrand: number; baseTaxIncome: number; armyWages: number };
    characters: { id: number }[];
    ownedProvinces: { id: number; grandDesign: { ownerName: string | null } | null }[];
    worldMeta: { provinces: OnTheMap[] };
  }
  const playerView = playerViewAsItsModuleExportsIt as unknown as (state: World, realm: number) => View;
  const buildTurnReport = buildTurnReportAsItsModuleExportsIt as unknown as (view: View) => Report;
  const world = () => JSON.parse(botWorld(engine, REALMS, { cols: 12, rows: 7 })) as World;
  const realmOf = (S: World, i: number) => {
    const r = S.players[i];
    if (!r) throw new Error(`no realm ${String(i)} (staging)`);
    return r;
  };
  const provinceOf = (S: World, id: number) => {
    const p = S.world.provinces[id];
    if (!p) throw new Error(`no province ${String(id)} (staging)`);
    return p;
  };
  const kingOf = (S: World, i: number) => {
    const k = S.characters.find((c) => c.isKing && c.player === i);
    if (!k) throw new Error(`realm ${String(i)} has no king (staging)`);
    return k;
  };
  const moveTo = (S: World, c: Hero, id: number) => {
    const from = provinceOf(S, c.location);
    from.characters = from.characters.filter((x) => x !== c.id);
    provinceOf(S, id).characters.push(c.id);
    c.location = id;
  };
  const onTheMap = (rep: Report, id: number) => {
    const p = rep.worldMeta.provinces.find((x) => x.id === id);
    if (!p) throw new Error(`no province ${String(id)} on the map`);
    return p;
  };
  /** A province realm 0 has never seen, owned or stood beside, far from every rival hero (and at least `away` from
   *  `not`), and its neighbours on the map. */
  const aProvinceNeverSeen = (S: World, not: readonly number[] = []) => {
    const view = playerView(S, 0);
    const unseen = (p: View['provinces'][number]) =>
      !Object.values(p.seen).some(Boolean) && p.remembered === null && !not.includes(p.id);
    const p = view.provinces.find((q) => unseen(q) && q.neighbours.every((n) => !not.includes(n)));
    if (!p) throw new Error('realm 0 has seen every province (staging)');
    return p;
  };
  const wealthOf = (tax: number) => (tax >= 7 ? 'Rich' : tax >= 4 ? 'Prosperous' : 'Poor');
  const aWonder = (owner: number, name: string): Wonder => ({ owner, name, alignment: 'Good', builtTurn: 1 });

  test("a Good realm's Wonder adds 2 gold to the tax of each province it holds with a garrison, while it stands", () => {
    const S = world();
    const me = realmOf(S, 0);
    me.alignment = 'Good';
    delete me._lastWages;
    // a second province of its own, with no garrison: the Wonder adds nothing there
    const another = S.world.provinces.find((p) => p.owner === null);
    if (!another) throw new Error('every province is held (staging)');
    another.owner = 0;
    me.provinces.push(another.id);
    me.provinces.forEach((id, i) => {
      provinceOf(S, id).garrisonArmies = i === 0 ? [{ type: 'Shieldwall Levies', quality: 'Average' }] : [];
    });
    const without = buildTurnReport(playerView(S, 0)).kingdom;
    // (a Wonder raised before Wonders were sited, no province named: it stands always, gdActiveFor)
    me.discoveries = [
      ...(me.discoveries ?? []),
      { id: 'gd', name: 'A Wonder', category: 'Special', desc: '', turnDiscovered: 1 },
    ];
    const withIt = buildTurnReport(playerView(S, 0)).kingdom;
    expect([withIt.sdGrand - without.sdGrand, withIt.baseTaxIncome - without.baseTaxIncome]).toEqual([2, 2]);
  });

  // B-06c: the forecast asks the collector's runners for Enslave, the minor titles' gold and the Thief network, lines
  // no matrix game may reach (the Wonder's is the case above)
  test("an enslaved province's resentment comes off the forecast, a gold while it lasts, never below nothing", () => {
    const S = world();
    const me = realmOf(S, 0);
    delete me._lastWages;
    const theTurn = (S as unknown as { turn: number }).turn;
    const theirs = S.world.provinces.filter((p) => p.owner === null).slice(0, 3);
    for (const p of theirs) {
      p.owner = 0;
      me.provinces.push(p.id);
    }
    const [resents, atNothing, spent] = theirs.map((p) => p as Province & { _enslavedUntil?: number });
    if (!resents || !atNothing || !spent) throw new Error('too few free provinces (staging)');
    resents.tax = 5;
    atNothing.tax = 0;
    spent.tax = 4;
    const without = buildTurnReport(playerView(S, 0)).kingdom as Report['kingdom'] & { enslaveReduction: number };
    resents._enslavedUntil = theTurn;
    atNothing._enslavedUntil = theTurn + 2;
    spent._enslavedUntil = theTurn - 1;
    const withIt = buildTurnReport(playerView(S, 0)).kingdom as Report['kingdom'] & { enslaveReduction: number };
    expect([withIt.enslaveReduction - without.enslaveReduction, withIt.baseTaxIncome - without.baseTaxIncome]).toEqual([
      1, -1,
    ]);
  });

  /** The forecast's minor titles' gold and its Thief network, on a report whose titles are public and held as given. */
  const theGoldBeyondTheTax = (
    held: Readonly<Record<string, number>>,
    provinces: number,
    titlesPublic = true,
    stage: (S: World) => void = () => undefined,
  ) => {
    const S = world();
    stage(S);
    const theWorld = S as unknown as { turn: number };
    theWorld.turn = titlesPublic ? Math.max(theWorld.turn, TITLES_PUBLIC_FROM_TURN) : TITLES_PUBLIC_FROM_TURN - 1;
    const view = playerView(S, 0) as View & {
      titles: { public: boolean; minor: Record<string, { charId: number }> | null };
      books: { provincesItHoldsByTheirRecord: number };
    };
    expect(view.titles.public, 'the titles are public (staging)').toBe(titlesPublic);
    if (titlesPublic)
      view.titles.minor = Object.fromEntries(Object.entries(held).map(([key, charId]) => [key, { charId }]));
    view.books.provincesItHoldsByTheirRecord = provinces;
    const k = buildTurnReport(view).kingdom as Report['kingdom'] & Record<string, number>;
    return [k['cutpurseG'], k['championG'], k['castellanG'], k['thiefStipend']];
  };
  test("the minor titles' gold in the forecast: the Cutpurse's 2, the Champion of the People's 2, the Castellan's 1 for every 5 provinces (rounded down), for a title its hero holds once titles are public", () => {
    const S = world();
    const mine = kingOf(S, 0).id;
    const theirs = kingOf(S, 1).id;
    expect(theGoldBeyondTheTax({ cutpurse: mine, champion: mine, castellan: mine }, 14)).toEqual([2, 2, 2, 0]);
    expect(theGoldBeyondTheTax({ cutpurse: mine }, 14)).toEqual([2, 0, 0, 0]);
    expect(theGoldBeyondTheTax({ champion: mine }, 14)).toEqual([0, 2, 0, 0]);
    expect(theGoldBeyondTheTax({ castellan: mine }, 4)).toEqual([0, 0, 0, 0]);
    expect(theGoldBeyondTheTax({ castellan: mine }, 5)).toEqual([0, 0, 1, 0]);
    expect(theGoldBeyondTheTax({ cutpurse: theirs, champion: theirs, castellan: theirs }, 14)).toEqual([0, 0, 0, 0]);
    expect(theGoldBeyondTheTax({ cutpurse: mine, champion: mine, castellan: mine }, 14, false)).toEqual([0, 0, 0, 0]);
  });
  test('the Thief network in the forecast: 5 gold for each hero of the realm at Thief 6 or above, none below', () => {
    const atThief = (levels: readonly number[]) => (S: World) => {
      const ours = S.characters.filter((c) => c.player === 0 && c.alive);
      if (ours.length < levels.length) throw new Error('realm 0 has too few heroes (staging)');
      ours.forEach((c, i) => {
        const h = c as Hero & { skills: Record<string, number> };
        h.skills = { ...h.skills, thief: levels[i] ?? 0 };
      });
    };
    expect(theGoldBeyondTheTax({}, 0, true, atThief([6]))[3]).toBe(5);
    expect(theGoldBeyondTheTax({}, 0, true, atThief([5]))[3]).toBe(0);
    expect(theGoldBeyondTheTax({}, 0, false, atThief([9]))[3]).toBe(5);
  });

  test("the realm's heroes are in its own order, the ones it hasn't placed after them in the world's order", () => {
    const S = world();
    const ours = S.characters.filter((c) => c.player === 0).map((c) => c.id);
    const [first, ...rest] = ours;
    if (first === undefined || rest.length === 0) throw new Error('realm 0 has fewer than two heroes (staging)');
    realmOf(S, 0).heroOrder = [String(rest[rest.length - 1])];
    const order = buildTurnReport(playerView(S, 0)).characters.map((c) => c.id);
    expect(order).toEqual([rest[rest.length - 1], first, ...rest.slice(0, -1)]);
  });

  test('a skeleton is paid 1 gold, whatever his kind would cost', () => {
    const S = world();
    delete realmOf(S, 0)._lastWages;
    const king = kingOf(S, 0);
    king.armies = [{ type: 'Gilded Lances', quality: 'Average' }];
    const alive = buildTurnReport(playerView(S, 0)).kingdom.armyWages;
    king.armies = [{ type: 'Gilded Lances', quality: 'Average', _isSkeletal: true }];
    const risen = buildTurnReport(playerView(S, 0)).kingdom.armyWages;
    expect(alive - risen).toBe(4 - 1);
  });

  test("a Wonder's realm is named on the map wherever the realm sees it: its own land, where its hero stands, its borders", () => {
    const S = world();
    const home = realmOf(S, 0).provinces[0];
    if (home === undefined) throw new Error('realm 0 holds no province (staging)');
    const view = playerView(S, 0);
    const border = view.provinces.find((p) => p.seen.nextToOwned && !p.seen.owned && !p.seen.heroThere);
    const far = aProvinceNeverSeen(S);
    if (!border) throw new Error('realm 0 has no border (staging)');
    const ourHero = S.characters.find((c) => c.player === 0 && c.alive && !c.isKing) ?? kingOf(S, 0);
    moveTo(S, ourHero, far.id);
    provinceOf(S, home).grandDesign = aWonder(0, 'The Home Wonder');
    provinceOf(S, far.id).grandDesign = aWonder(1, 'The Far Wonder');
    provinceOf(S, border.id).grandDesign = aWonder(2, 'The Border Wonder');
    const rep = buildTurnReport(playerView(S, 0));
    const names = S.players.map((r) => r.name);
    expect([
      rep.ownedProvinces.find((p) => p.id === home)?.grandDesign?.ownerName,
      onTheMap(rep, home).tier,
      onTheMap(rep, home).grandDesign?.ownerName,
      onTheMap(rep, far.id).tier,
      onTheMap(rep, far.id).grandDesign?.ownerName,
      onTheMap(rep, border.id).tier,
      onTheMap(rep, border.id).grandDesign?.ownerName,
    ]).toEqual([names[0], 'owned', names[0], 'live', names[1], 'border', names[2]]);
  });

  test('the hero a realm watches by Clairvoyance is drawn, by his realm, in a province it has never seen, with its wealth and its units', () => {
    const S = world();
    const far = aProvinceNeverSeen(S);
    const watched = kingOf(S, 1);
    moveTo(S, watched, far.id);
    realmOf(S, 0)._clairCharThisTurn = watched.id;
    const p = provinceOf(S, far.id);
    p.tax = 8;
    p.armyTypes = ['Shieldwall Levies', 'Free Lances'];
    const hex = onTheMap(buildTurnReport(playerView(S, 0)), far.id);
    expect([hex.tier, hex.wealth, hex.armyTypes, hex.characters?.map((c) => [c.id, c.ownerName])]).toEqual([
      'remembered',
      wealthOf(8),
      p.armyTypes,
      [[watched.id, realmOf(S, 1).name]],
    ]);
  });

  test('a province it has never seen beside one it spied shows the heroes there, by their realm, with its wealth and its units', () => {
    const S = world();
    const spied = aProvinceNeverSeen(S);
    const view = playerView(S, 0);
    const beside = view.provinces.find(
      (q) => spied.neighbours.includes(q.id) && !Object.values(q.seen).some(Boolean) && q.remembered === null,
    );
    if (!beside) throw new Error('no province beside the spied one that realm 0 has never seen (staging)');
    realmOf(S, 0)._spiedProvincesThisTurn = [spied.id];
    const theirs = kingOf(S, 1);
    moveTo(S, theirs, beside.id);
    const p = provinceOf(S, beside.id);
    p.tax = 5;
    p.armyTypes = ['Yeoman Longbows'];
    const hex = onTheMap(buildTurnReport(playerView(S, 0)), beside.id);
    expect([hex.tier, hex.wealth, hex.armyTypes, hex.characters?.find((c) => c.id === theirs.id)?.ownerName]).toEqual([
      'remembered',
      wealthOf(5),
      p.armyTypes,
      realmOf(S, 1).name,
    ]);
  });
});
