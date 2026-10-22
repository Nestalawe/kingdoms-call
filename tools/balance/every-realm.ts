// Every realm's report (plan P1-12a1; P1-12's Decision 1): the second half of npm run balance. The matrix hashes only
// the scripted realm's report, in 12 of its 60 games: a bot realm gets none. Here each game of the set is played again,
// in the engine's bare vm (tests/lib/engine.ts) instead of on the page, with a report for every realm every turn, bots'
// too, and each realm's report is hashed, play and words apart (hash.ts), against its own committed baseline,
// tests/balance/baseline/reports.json (both sets). The leak checks (tests/lib/report-leaks.ts) run on every realm's
// report after every turn, the audience check among them (P1-12b3: every line a realm reads comes from an event whose
// audience admits it; the turn's events are recorded as they are emitted, scenarioInTheVm's recordTheEvents): a breach
// fails the run, as on the page, but the game plays on, so a fault shows in every game it reaches.
//
// It is the matrix's own game: the set-up, the seed, the scripted realm on its scripted orders, and the shell's work
// around each turn (tests/lib/matrix-game.ts, as tests/unit/engine-purity.test.ts plays scripted-05). The bots' reports
// are built from copies of their slot rows (scenarioInTheVm's reportEveryRealm), after the turn is saved, so the turns
// are untouched: run.ts checks that each turn's saved state hashes as the page's did.
//
// Kept per game: one line per turn, each realm's report as `realm:play/words`; and each report section's hashes over
// the game and every realm, [play, words], so a difference names the game, the first turn, the realms and the sections.
import { checkLeaks, describeBreaches, type SavedState } from '../../tests/lib/invariants.ts';
import {
  newWorldOf,
  PAGE_DRAWS_AS_IT_LOADS,
  slotRowsJsonOf,
  stampedAsTheShellSaves,
} from '../../tests/lib/matrix-game.ts';
import type { RealmReport } from '../../tests/lib/report-leaks.ts';
import { scenarioInTheVm } from '../../tests/lib/scenario-in-the-vm.ts';
import type { ReportsResult } from './baseline.ts';
import { h, playHash, proseHash, reportSectionHashes, withoutStamps } from './hash.ts';
import { MAX_TURNS, type GameSpec } from './matrix.ts';

/** Plays `spec` in the engine's vm (from `src`, by default this checkout's src/) with every realm's report, and
 *  returns its hashes and what the leak checks found. */
export function playEveryRealm(spec: GameSpec, src?: string): ReportsResult {
  const t0 = performance.now();
  const sc = scenarioInTheVm({ seed: spec.seed, ...(src ? { src } : {}) });
  sc.reportEveryRealm();
  sc.recordTheEvents();
  for (let i = 0; i < PAGE_DRAWS_AS_IT_LOADS; i++) sc.W.eval('kcRng()');
  let state = newWorldOf(sc.engine, spec);
  const turns: string[] = [];
  const states: string[] = [];
  const sections = new Map<string, string[]>();
  let reports = 0;
  const leaks: string[] = [];
  for (let t = 1; t <= MAX_TURNS; t++) {
    const before = JSON.parse(state) as SavedState & { turn: number };
    if (before.gameOver) break;
    const played = sc.play(state, JSON.parse(slotRowsJsonOf(spec, state, before.turn)) as unknown[]);
    state = stampedAsTheShellSaves(JSON.stringify(played.S2));
    const after = JSON.parse(state) as SavedState;
    const realms = Object.keys(played.reports)
      .map(Number)
      .sort((a, b) => a - b);
    const each: RealmReport[] = realms.map((realm) => ({ realm, report: played.reports[realm] ?? {} }));
    const breaches = checkLeaks({
      before,
      after,
      gmLog: played.log,
      telemetry: [],
      players: [],
      reports: each,
      ...(played.perception ? { perception: played.perception } : {}),
    });
    if (breaches.length) leaks.push(describeBreaches(`turn ${String(t)}`, breaches));
    turns.push(
      each
        .map(({ realm, report }) => {
          const r = withoutStamps(report);
          return `${String(realm)}:${playHash(r)}/${proseHash(r)}`;
        })
        .join(' '),
    );
    for (const { realm, report } of each)
      for (const [k, [p, w]] of Object.entries(reportSectionHashes(report)))
        (sections.get(k) ?? sections.set(k, []).get(k))?.push(`${String(t)}.${String(realm)}:${p}/${w}`);
    states.push(playHash(after));
    reports += each.length;
  }
  const part = (list: string[], i: number) => h(list.map((x) => x.split(':')[1]?.split('/')[i] ?? '-').join(' '));
  return {
    id: spec.id,
    turns,
    sections: Object.fromEntries(
      [...sections].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, list]) => [k, [part(list, 0), part(list, 1)]]),
    ),
    states,
    reports,
    leaks,
    ms: Math.round(performance.now() - t0),
  };
}
