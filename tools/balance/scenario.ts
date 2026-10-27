// Named balance scenarios (plan P1-03, "Focused questions"): `npm run balance -- <scenario>` plays one staged scene
// many times on the base branch's site and on this one, and compares a rule's direct effect, figure by figure. The
// matrix measures the knock-on effects in whole games; a scenario answers "how often does X happen?" for one scene.
//
// A scenario is a file in tests/balance/scenarios/ (its name is the file's): a default export `Scenario`, which stages
// its scene through tests/lib/scenario.js (bootScenario: one real turn on a small staged world) and returns that run's
// statistics, named and labelled as the matrix's (stats.ts, labels.ts). Run n plays on a fresh page with seed n and
// the matrix's clock, on both sides, so the runs pair by seed and the noise rule (paired.ts) judges the change as it
// does the matrix's games. A fresh page each run: names drawn in one world survive in the page into the next (play.ts).
// A scenario with `requires` (P1-15e2b) is also played, on this site only, by every `npm run balance`: it stages a
// case the matrix's games meet only by luck, and a requirement it misses fails the run.
//
// The pure parts are here (tests/unit/balance-scenario.test.ts); scenario-run.ts plays the runs and prints the result.
import fs from 'node:fs';
import path from 'node:path';
import type { Scenario as Page, Turn } from '../../tests/lib/scenario.js';
import { label } from './labels.ts';
import { compareRuns, figureRange, type Verdict } from './paired.ts';
import { show, showDiff, showRange } from './report.ts';
import { gameStats, valueOf, type Battle, type Stats, type TelemetryRow } from './stats.ts';

export const SCENARIO_DIR = path.join(import.meta.dirname, '..', '..', 'tests', 'balance', 'scenarios');

export interface Scenario {
  /** The scene, in game terms: the heading of its result. */
  title: string;
  /** How many runs, each on its own page and seed (1 to runs). */
  runs: number;
  /** The figures it reports, in this order: statistic names, each with its label (labels.ts). */
  figures: readonly string[];
  /** Stages the scene on a fresh page and plays its turn: run `run`'s statistics. Throw if it can't be staged. */
  play(sc: Page, run: number): Promise<Stats>;
  /** What `npm run balance` requires of it (P1-15e2b): a scenario with requirements is played on this site with every
   *  run of the matrix, before the games, and a requirement it misses fails the run (run.ts). */
  requires?: readonly ScenarioRequirement[];
}

/** A figure a required scenario must show (a value above 0) in every run, or in some run. */
export interface ScenarioRequirement {
  figure: string;
  in: 'every run' | 'some run';
  /** What the figure shows, in game terms: the line printed when it is missed. */
  what: string;
}

/** What a required scenario's runs missed, one line each: every run that failed (it couldn't be staged, or the page
 *  reported an error), then each requirement missed, with how many runs showed it. [] if it met every requirement.
 *  `runs` holds a run that failed too (scenario-run.ts gives it no statistics). */
export function whatAScenariosRunsMissed(
  scenario: Pick<Scenario, 'requires'>,
  runs: Stats[],
  failedRuns: readonly string[] = [],
): string[] {
  const missed = (scenario.requires ?? []).flatMap((r) => {
    const shown = runs.filter((s) => (s[r.figure]?.[0] ?? 0) > 0).length;
    const met = r.in === 'every run' ? shown === runs.length && runs.length > 0 : shown > 0;
    return met ? [] : [`${r.what}: in ${String(shown)} of ${String(runs.length)} runs (needed in ${r.in})`];
  });
  return [...failedRuns, ...missed];
}

/** A job for scenario-worker.ts, and its reply. */
export interface ScenarioJob {
  name: string;
  run: number;
}
export type ScenarioReply =
  { ok: true; run: number; stats: Stats; ms: number } | { ok: false; run: number; error: string };

export const scenarioFile = (name: string): string => path.join(SCENARIO_DIR, `${name}.ts`);
/** The scenarios there are, by name. */
export const scenarioNames = (): string[] =>
  fs
    .readdirSync(SCENARIO_DIR)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => f.slice(0, -3))
    .sort();

// ── Staging: the parts of the saved world the scenarios touch, and the moves they make on it ──

export interface Unit {
  type: string;
  quality: string;
  unitName: string;
}
export interface Hero {
  id: number;
  name: string;
  player: number | null;
  alive: boolean;
  isKing?: boolean;
  location: number;
  locationName?: string;
  armies?: Unit[];
  items?: unknown[];
  skills?: Record<string, number>;
  hp?: number;
  maxHp?: number;
  encounterPlan?: { tactics: string[]; duelStance: string };
}
export interface Lair {
  monster?: { name: string; power: string };
  cleared?: boolean;
  discovered?: boolean;
}
export interface Province {
  id: number;
  name: string;
  terrain: string;
  owner: number | null;
  characters?: number[];
  features?: Lair[];
  neutralDefenders?: unknown[];
  npcArmies?: number;
  garrisonArmies?: unknown[];
  _battleUnresolved?: boolean;
}
export interface World {
  world: { cols: number; rows: number; provinces: Province[] };
  players: { provinces?: number[]; homeProvinceId?: number }[];
  characters: Hero[];
  relations?: Record<string, string>;
}

/** The first living hero of realm `pi` who isn't its king. */
export function heroOf(S: World, pi: number): Hero {
  const h = S.characters.find((c) => c.alive && c.player === pi && !c.isKing);
  if (!h) throw new Error(`could not stage: realm ${String(pi)} has no hero`);
  return h;
}

/** Moves `c` to `p`. */
export function place(S: World, c: Hero, p: Province): void {
  for (const q of S.world.provinces) q.characters = (q.characters ?? []).filter((id) => id !== c.id);
  p.characters = [...(p.characters ?? []), c.id];
  c.location = p.id;
  c.locationName = p.name;
}

/** Gives `p` to realm `pi`, empty: no neutral defenders, garrison, lairs or characters without a realm. */
export function own(S: World, p: Province, pi: number): void {
  for (const pl of S.players) pl.provinces = (pl.provinces ?? []).filter((id) => id !== p.id);
  p.owner = pi;
  S.players[pi]?.provinces?.push(p.id);
  p.neutralDefenders = [];
  p.npcArmies = 0;
  p.features = [];
  p.garrisonArmies = [];
  S.characters = S.characters.filter((c) => c.player != null || c.location !== p.id);
  p.characters = (p.characters ?? []).filter((id) => S.characters.some((c) => c.id === id));
}

/** `n` companies of one type and quality. */
export const companies = (type: string, quality: string, n: number): Unit[] =>
  Array.from({ length: n }, (_, i) => ({ type, quality, unitName: `${type} ${String(i + 1)}` }));

/** Two realms at war. */
export function atWar(S: World, a: number, b: number): void {
  (S.relations ??= {})[`${String(Math.min(a, b))}-${String(Math.max(a, b))}`] = 'enemy';
}

/** A turn's statistics, as the matrix counts them for a game (stats.ts). `battles` keeps only some battles. */
export function measure(turn: Turn<World>, battles?: (b: Battle) => boolean): Stats {
  const telemetry = turn.events as TelemetryRow[];
  if (battles)
    for (const row of telemetry) row.outcomes.battles.list = row.outcomes.battles.list.filter((b) => battles(b));
  const after = turn.S2 as World | null;
  return gameStats({
    telemetry,
    gmLog: turn.log,
    unresolved: [after?.world.provinces.filter((p) => p._battleUnresolved).length ?? 0],
    gameOver: null,
  });
}

/** Battle `b` is one of the first phase's battles in province `prov` (the same battle is recorded again each season
 *  both sides stay in the field). */
export function firstClashIn(turn: Turn<World>, prov: number): (b: Battle) => boolean {
  const phases = (turn.events as TelemetryRow[]).flatMap((r) =>
    r.outcomes.battles.list.filter((b) => b.prov === prov).map((b) => b.ph),
  );
  const first = Math.min(...phases);
  return (b) => b.prov === prov && b.ph === first;
}

// ── The comparison ──

/** One figure of a scenario on both sides. */
export interface ScenarioRow {
  key: string;
  label: string;
  /** Each side's figure, its own 95% range, and the cases behind it (battles, fights, rolls). */
  base: { value: string; range95: string; cases: number };
  head: { value: string; range95: string; cases: number };
  /** The change, paired by seed, and how sure it is (paired.ts). */
  diff: string;
  range95: string;
  verdict: Verdict;
  /** The runs whose value of it differs. */
  runs: number;
}

export interface ScenarioResult {
  rows: ScenarioRow[];
  /** The runs that played out differently in any figure. */
  changedRuns: number;
  runs: number;
}

const side = (runs: Stats[], key: string) => {
  const f = figureRange(runs, key);
  const [lo, hi] = f.range95;
  return {
    value: Number.isFinite(f.value) ? show(key, f.value) : '–',
    range95: Number.isFinite(lo) ? `${show(key, lo)} to ${show(key, hi)}` : '–',
    cases: f.cases,
  };
};

/** The scenario's figures on both sides: base[i] and head[i] are the same run (same seed). */
export function compareScenario(figures: readonly string[], base: Stats[], head: Stats[]): ScenarioResult {
  const changes = new Map(compareRuns(base, head).map((c) => [c.key, c]));
  const differs = (i: number, key: string) => valueOf(base[i] ?? {}, key).join() !== valueOf(head[i] ?? {}, key).join();
  const rows = figures.map((key): ScenarioRow => {
    const c = changes.get(key);
    return {
      key,
      label: label(key),
      base: side(base, key),
      head: side(head, key),
      diff: c && Number.isFinite(c.diff) ? showDiff(key, c.diff) : '–',
      range95: c && Number.isFinite(c.range95[0]) ? showRange(key, c.range95) : '–',
      verdict: c?.verdict ?? 'too few to tell',
      runs: base.filter((_, i) => differs(i, key)).length,
    };
  });
  const changedRuns = base.filter((_, i) => figures.some((key) => differs(i, key))).length;
  return { rows, changedRuns, runs: base.length };
}

const moved = (r: ScenarioRow) => r.verdict === 'clear change' || r.verdict === 'possible change';

/** The result, in the balance report's words: what moved first, then every figure on both sides. */
export function renderScenario(input: {
  name: string;
  title: string;
  base: string;
  head: string;
  result: ScenarioResult;
}): string {
  const { result } = input;
  const beyond = result.rows.filter(moved);
  const verdict =
    result.changedRuns === 0
      ? `No change: all ${String(result.runs)} runs played out exactly as before.`
      : beyond.length
        ? `${String(result.changedRuns)} of ${String(result.runs)} runs played out differently. Beyond the noise: ${beyond
            .map((r) => `${r.label}: ${r.base.value} → ${r.head.value} (${r.verdict})`)
            .join('; ')}.`
        : `${String(result.changedRuns)} of ${String(result.runs)} runs played out differently, all within the noise.`;
  return [
    `### Scenario "${input.name}": ${input.title}`,
    '',
    `${String(result.runs)} runs on each side, paired by seed. Before: ${input.base}. After: ${input.head}.`,
    '',
    `**${verdict}**`,
    '',
    '| Figure | Before (95% range) | After (95% range) | Change (95% range) | How sure | Runs it changed in |',
    '|---|---|---|---|---|---|',
    ...result.rows.map(
      (r) =>
        `| ${r.label} | ${r.base.value} (${r.base.range95}; ${String(r.base.cases)} cases) | ${r.head.value} (${r.head.range95}; ${String(r.head.cases)} cases) | ${r.diff} (${r.range95}) | ${r.verdict} | ${String(r.runs)} |`,
    ),
    '',
  ].join('\n');
}
