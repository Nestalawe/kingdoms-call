// playerEvents (src/views/every-realms-report-and-the-lines-each-realm-reads.ts, plan P1-12b3: the lines a realm reads,
// taken out of buildReports, which P1-08d lifted out of resolveTurn), called directly in the bare vm
// (tests/lib/engine.ts). The balance matrix runs it every turn, for every realm; this test pins the rule at its heart
// on its own.
// - Property (fast-check): from any turn's log, each realm reads exactly the lines the rule allows, in the log's
//   order. A line written for everyone but some realms (notFor) never reaches them. Otherwise a realm reads a
//   line sent to it, one its own realm did, one about its own hero (filed under that hero), and a public line with no
//   province (the world is told) or in one of its own provinces. Nothing else: no other realm's private business, and
//   no public line from a province it has no eyes on (no hero stood there and no spy saw it, as on this context).
// - Its Clairvoyance feed (P1-21b): a realm watching another realm's hero by Clairvoyance reads every line about him
//   from the phase the watch began (the phase it was cast), not before, each once, and where he stands as the turn
//   ends. No other test and no game of the balance matrix builds a report with a Clairvoyance watch.
// Level 1 (unit): the function is called on a world and a turn's sight made in the test; nothing else of the turn runs.
// The property describes the game as it is; a fault planted in a copy of the function turns it red (the PR shows it).
import fc from 'fast-check';
import { afterAll, describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog, turnContext, type TurnContext } from '../lib/engine.ts';
import { timeLimitForPropertyRuns } from '../lib/time-limits.ts';

const engine = loadEngine({ seed: 1 });
const restoreLog = quietEngineLog(engine);
afterAll(restoreLog);
const REALMS = 3;
const freshPlayers = Array.from({ length: REALMS }, (_, i) => ({
  id: `gp${String(i)}`,
  user_id: `u${String(i)}`,
  player_index: i,
}));
const tc = turnContext(engine, botWorld(engine, REALMS, { cols: 12, rows: 7 }), { freshPlayers });
const G = tc.G as {
  world: { provinces: { name: string }[] };
  players: { provinces?: number[] }[];
  characters: { id: number; player: number | null; name: string; location: number; alive: boolean }[];
};
const playerEvents = engineFn(engine, 'playerEvents') as (
  events: Entry[],
  state: TurnContext['G'],
  realm: number,
  sight: { presenceByPhase: unknown; battleCommanders: unknown; clairWatch: unknown },
) => { lastTurnLog: Line[] };
/** The turn's sight, as the context starts it: nobody has stood anywhere in a phase, fought or watched yet. */
const sight = {
  presenceByPhase: tc['presenceByPhase'],
  battleCommanders: tc['battleCommanders'],
  clairWatch: tc['clairWatch'],
};

type Line = { text: string; charId: unknown; phase: unknown };
type Entry = {
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
};

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
  test('a realm watching no hero reads none of those lines', () => {
    const lines = playerEvents(
      log.map((e) => ({ ...e })),
      tc.G,
      2,
      watching,
    ).lastTurnLog.filter((l) => l.text.includes('Clairvoyance') || l.text.includes('[about'));
    expect(lines).toEqual([]);
  });
});
