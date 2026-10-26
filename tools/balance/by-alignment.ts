// npx tsx tools/balance/by-alignment.ts BASE.json RUN.json [RUN2.json …] [--noise NOISE_B.json] [--slice race]
// (--slice race: the race slices, Human / Elven / Dwarven / Orcish, instead of the alignment ones)
// The alignment slices of the balance matrix (ideas round 1): for each run, how each alignment's realms fared against the
// base run, paired by seed (paired.ts), with the base's set-A-against-set-B difference as the noise band. Reads run files
// written by `npm run balance -- --out FILE`. Prints a Markdown table a turn report of the ideas can carry.
import fs from 'node:fs';
import path from 'node:path';
import { compareRuns, type Change } from './paired.ts';
import type { Stats } from './stats.ts';

interface RunFile {
  statNames: string[];
  games: { id: string; stats: ([number, number] | null)[] }[];
}
function readRun(file: string): Record<string, Stats> {
  const run = JSON.parse(fs.readFileSync(file, 'utf8')) as RunFile;
  const out: Record<string, Stats> = {};
  for (const g of run.games) {
    const s: Stats = {};
    run.statNames.forEach((k, i) => {
      const v = g.stats[i];
      if (v) s[k] = v;
    });
    out[g.id] = s;
  }
  return out;
}
const SLICE = process.argv.includes('--slice')
  ? (process.argv[process.argv.indexOf('--slice') + 1] ?? 'alignment')
  : 'alignment';
const ALIGNMENTS =
  SLICE === 'race'
    ? ['Human', 'Elven', 'Dwarven', 'Orcish']
    : ['Divine', 'Good', 'Druidic', 'Neutral', 'Pagan', 'Evil', 'Undead'];
const FIGURES: [string, string][] = [
  ['game: won', 'won the game'],
  ['game: realm alive at the end', 'alive at the end'],
  ['realms: provinces at turn 10', 'provinces, turn 10'],
  ['realms: provinces at the end', 'provinces, end'],
  ['realms: gold at turn 10', 'gold, turn 10'],
  ['realms: gold at the end', 'gold, end'],
  ['realms: army strength at turn 10', 'army strength, turn 10'],
  ['realms: army strength at the end', 'army strength, end'],
  ['realms: creature companies recruited', 'creature companies recruited'],
  ['realms: monster companies recruited', 'monster companies recruited'],
  ['realms: lairs cleared', 'lairs cleared'],
  ['realms: lairs cleared a turn from turn 3', 'lairs cleared a turn, from turn 3'],
];
const isShare = (base: string) => base.startsWith('game: ');
const fmt = (base: string, v: number) => (isShare(base) ? `${(100 * v).toFixed(0)}%` : v.toFixed(1));
const fmtDiff = (base: string, v: number) =>
  (v >= 0 ? '+' : '−') + (isShare(base) ? (100 * Math.abs(v)).toFixed(0) : Math.abs(v).toFixed(1));

const args = process.argv.slice(2);
const noiseAt = args.indexOf('--noise');
const noiseFile = noiseAt >= 0 ? args[noiseAt + 1] : null;
const sliceAt = args.indexOf('--slice');
const files = args.filter(
  (a, i) =>
    a !== '--noise' && a !== '--slice' && (noiseAt < 0 || i !== noiseAt + 1) && (sliceAt < 0 || i !== sliceAt + 1),
);
const [baseFile, ...runFiles] = files;
if (!baseFile || !runFiles.length) {
  console.error('usage: by-alignment.ts BASE.json RUN.json [RUN2.json …] [--noise NOISE_B.json]');
  process.exit(2);
}
const base = readRun(baseFile);
const ids = Object.keys(base).filter((id) => id.startsWith('bots-')); // the 48 all-bot games
const basePaired = ids.map((id) => base[id] ?? {});

/** The change of `key` between two paired runs. */
const changeOf = (changes: Change[], key: string) => changes.find((c) => c.key === key);

// The noise band: set A against set B of the base rules, by alignment (the games pair by id across the two sets).
let noise: Change[] | null = null;
if (noiseFile) {
  const nb = readRun(noiseFile);
  noise = compareRuns(
    basePaired,
    ids.map((id) => nb[id] ?? {}),
  );
}

for (const file of runFiles) {
  const run = readRun(file);
  const changes = compareRuns(
    basePaired,
    ids.map((id) => run[id] ?? {}),
  );
  console.log(
    `\n## ${path.basename(file, '.json')} against ${path.basename(baseFile, '.json')} (48 bot games, paired by seed)\n`,
  );
  console.log(`| Figure | ${ALIGNMENTS.join(' | ')} |`);
  console.log(`|---|${ALIGNMENTS.map(() => '---').join('|')}|`);
  for (const [baseKey, label] of FIGURES) {
    const cells = ALIGNMENTS.map((al) => {
      const key = `${baseKey} | by ${SLICE}: ${al}`;
      const c = changeOf(changes, key);
      if (!c || Number.isNaN(c.base) || Number.isNaN(c.head)) return '–';
      const n = noise ? changeOf(noise, key) : null;
      const noisy = n ? Math.abs(c.diff) <= Math.abs(n.diff) * 1.5 : false;
      const mark = c.verdict === 'clear change' ? ' **' : c.verdict === 'possible change' ? ' *' : '';
      return `${fmt(baseKey, c.base)} → ${fmt(baseKey, c.head)} (${fmtDiff(baseKey, c.diff)})${noisy ? '' : mark}`;
    });
    console.log(`| ${label} | ${cells.join(' | ')} |`);
  }
  // The whole-game figures the report judges by.
  const headline = changes.filter((c) => !c.key.includes(' | ') && c.verdict !== 'too few to tell');
  const strong = headline.filter((c) => c.verdict === 'clear change' || c.verdict === 'possible change');
  if (strong.length) {
    console.log('\nWhole-game figures beyond the noise:');
    for (const c of strong) console.log(`- ${c.key}: ${fmt(c.key, c.base)} → ${fmt(c.key, c.head)} (${c.verdict})`);
  }
}
if (noise) {
  console.log(`\n## Noise: ${path.basename(baseFile, '.json')} set A against set B, today's rules\n`);
  console.log(`| Figure | ${ALIGNMENTS.join(' | ')} |`);
  console.log(`|---|${ALIGNMENTS.map(() => '---').join('|')}|`);
  for (const [baseKey, label] of FIGURES) {
    const cells = ALIGNMENTS.map((al) => {
      const c = changeOf(noise, `${baseKey} | by ${SLICE}: ${al}`);
      return c && !Number.isNaN(c.diff) ? fmtDiff(baseKey, c.diff) : '–';
    });
    console.log(`| ${label} | ${cells.join(' | ')} |`);
  }
}
