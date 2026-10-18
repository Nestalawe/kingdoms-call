// buildReports, lifted out of resolveTurn in plan P1-08d, called directly in the bare vm (tests/lib/engine.ts). The
// balance matrix runs it every turn; this test pins the rule at its heart on its own.
// - Property (fast-check): from any turn's log, each realm's report shows exactly the lines the rule allows, in the
//   log's order. A line written for everyone but some realms (notFor) never reaches them. Otherwise a realm reads a
//   line sent to it, one its own realm did, one about its own hero (filed under that hero), and a public line with no
//   province (the world is told) or in one of its own provinces. Nothing else: no other realm's private business, and
//   no public line from a province it has no eyes on (no hero stood there and no spy saw it, as on this context).
// Level 1 (unit): the function is called on a context made in the test; nothing else of the turn runs. The property
// describes the game as it is; a fault planted in a copy of the function turns it red (the PR shows it).
import fc from 'fast-check';
import { afterAll, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog, turnContext, type TurnContext } from '../lib/engine.ts';

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
  world: { provinces: unknown[] };
  players: { provinces?: number[] }[];
  characters: { id: number; player: number | null }[];
};
const buildReports = engineFn(engine, 'buildReports') as (t: TurnContext) => {
  reports: { gp: { player_index: number }; report: { lastTurnLog: Line[] } }[];
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

test("each realm's report shows exactly the lines the visibility rule allows, in the log's order", () => {
  fc.assert(
    fc.property(fc.array(entry, { maxLength: 30 }), (drawn) => {
      const log: Entry[] = drawn.map((e, i) => ({ ...e, text: `[line ${String(i)}]`, charIds: null }));
      tc.turnLog = log.map((e) => ({ ...e }));
      tc['_reports'] = { built: false };
      const { reports } = buildReports(tc);
      expect(reports.map((r) => r.gp.player_index)).toEqual([0, 1, 2]);
      for (const { gp, report } of reports) {
        const pi = gp.player_index;
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
        const seen = report.lastTurnLog
          .filter((l) => l.text.startsWith('[line '))
          .map((l) => ({ text: l.text, charId: l.charId, phase: l.phase }));
        expect(seen).toEqual(expected);
      }
    }),
    {
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
