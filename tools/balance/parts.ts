// The balance matrix played in parts side by side, then joined (CI's balance-part jobs, then its balance job): npm run
// balance -- --shard 2/3 --out FILE plays part 2 of 3 of the set's games, on the page and in the vm for every realm's
// report (part 1 also plays the required named scenarios), and writes what it played to FILE, judging nothing; npm run
// balance -- --join DIR reads every part in DIR and judges the whole as one run does (run.ts): the scripted cases, the
// baseline, every realm's report, the vm's states against the page's, and --out. The parts play, the join judges, so a
// joined run passes or fails as one unsplit run would, and its --out files are byte for byte the same
// (tests/unit/the-balance-matrix-in-parts-joins-into-one-run.test.ts).
import fs from 'node:fs';
import path from 'node:path';
import type { ReportsResult } from './baseline.ts';
import type { GameSpec, SeedSet } from './matrix.ts';
import type { GameResult } from './play.ts';

/** Part `part` of `of`: `--shard 2/3`. */
export interface Shard {
  part: number;
  of: number;
}

/** `--shard`'s value read: "2/3". */
export function parseShard(text: string): Shard {
  const m = /^(\d+)\/(\d+)$/.exec(text);
  const part = Number(m?.[1]);
  const of = Number(m?.[2]);
  if (!m || part < 1 || of < 1 || part > of) throw new Error(`--shard takes a part of a whole, as 2/3: not "${text}"`);
  return { part, of };
}

/** The games part `part` of `of` plays, in `games`' order: dealt out by size, the most realms first, in a snake (to
 *  part 1, 2, 3, then 3, 2, 1, …), so each part has its share of the long games and the parts' sizes differ by one at
 *  most. Every game is in one part. */
export function theShare(games: readonly GameSpec[], { part, of }: Shard): GameSpec[] {
  const bySize = games.map((g, i) => ({ g, i })).sort((a, b) => b.g.realms - a.g.realms || a.i - b.i);
  const mine = new Set(
    bySize.filter((_, k) => (Math.floor(k / of) % 2 === 0 ? k % of : of - 1 - (k % of)) === part - 1).map((x) => x.g),
  );
  return games.filter((g) => mine.has(g));
}

/** The required named scenarios' lines, as run.ts prints them, and whether one missed (part 1 plays them). */
export interface RequiredScenarios {
  lines: string[];
  failed: boolean;
}

const KIND = 'a part of the balance matrix';

/** What a part played: its games on the page, and in the vm for every realm's report (null: not played, KC_SITE). */
export interface Part {
  kind: typeof KIND;
  set: SeedSet;
  part: number;
  of: number;
  ids: string[];
  required: RequiredScenarios | null;
  page: { results: GameResult[]; errors: string[]; secs: number; jobs: number };
  vm: { results: ReportsResult[]; errors: string[]; secs: number } | null;
}

export function writePart(file: string, part: Part): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(part));
}

/** Every part in `dir` (its .json files); it throws on a file that isn't one. */
export function readParts(dir: string): Part[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const read: unknown = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (typeof read !== 'object' || read === null || !('kind' in read) || read.kind !== KIND)
        throw new Error(`${path.join(dir, f)} is not a part of the balance matrix`);
      return read as Part;
    });
}

/** The parts joined into one run of `games` (set `set`), in `games`' order, as one unsplit run plays them; or what
 *  keeps them from making that run: a part missing or there twice, of another set or another split, the required
 *  scenarios played by another part than the first or by none, or a game played in none of them or in two. */
export function joinParts(
  parts: readonly Part[],
  set: SeedSet,
  games: readonly GameSpec[],
): { problems: string[] } | { problems: []; joined: Omit<Part, 'kind' | 'set' | 'part' | 'of' | 'ids'> } {
  if (!parts.length) return { problems: ['no part to join'] };
  const problems: string[] = [];
  const of = parts[0]?.of ?? 0;
  for (const p of parts) {
    if (p.set !== set) problems.push(`part ${String(p.part)} is of set ${p.set}, not ${set}`);
    if (p.of !== of) problems.push(`part ${String(p.part)} is of ${String(p.of)} parts, the first of ${String(of)}`);
  }
  for (let i = 1; i <= of; i++) {
    const n = parts.filter((p) => p.part === i).length;
    if (n !== 1) problems.push(`part ${String(i)} of ${String(of)} is ${n ? `there ${String(n)} times` : 'missing'}`);
  }
  for (const p of parts)
    if ((p.part === 1) !== (p.required !== null))
      problems.push(`part ${String(p.part)} ${p.part === 1 ? "didn't play" : 'played'} the required scenarios`);
  const played = parts.flatMap((p) => p.ids);
  for (const g of games) {
    const n = played.filter((id) => id === g.id).length;
    if (n !== 1) problems.push(`${g.id} is played in ${String(n)} parts`);
  }
  for (const id of played) if (!games.some((g) => g.id === id)) problems.push(`${id} is not a game of set ${set}`);
  if (new Set(parts.map((p) => p.vm === null)).size > 1)
    problems.push("some parts played every realm's report, some not");
  if (problems.length) return { problems };

  const inOrder = <T extends { id: string }>(all: T[]) => {
    const byId = new Map(all.map((r) => [r.id, r]));
    return games.flatMap((g) => byId.get(g.id) ?? []);
  };
  const sorted = [...parts].sort((a, b) => a.part - b.part);
  const vms = sorted.flatMap((p) => (p.vm ? [p.vm] : []));
  return {
    problems: [],
    joined: {
      required: sorted.find((p) => p.required)?.required ?? null,
      page: {
        results: inOrder(sorted.flatMap((p) => p.page.results)),
        errors: sorted.flatMap((p) => p.page.errors),
        secs: Math.max(...sorted.map((p) => p.page.secs)),
        jobs: Math.max(...sorted.map((p) => p.page.jobs)),
      },
      vm: vms.length
        ? {
            results: inOrder(vms.flatMap((v) => v.results)),
            errors: vms.flatMap((v) => v.errors),
            secs: Math.max(...vms.map((v) => v.secs)),
          }
        : null,
    },
  };
}
