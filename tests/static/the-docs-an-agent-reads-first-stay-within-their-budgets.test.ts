// The docs an agent reads first stay within their budgets (tests/the-docs-budgets.json), so a new session can start
// from CLAUDE.md and about 50 KB of docs, then read only the part its work touches. Without a check the docs grow back:
// on main at 5e60c38, before this test, CLAUDE.md was 22 KB, docs/ARCHITECTURE.md 129 KB, docs/traps.md 108 KB and
// tests/README.md 358 KB.
// Level 0 (static): it reads files and nothing runs.
// - Each file named in the budgets stays within its bytes, and so do the files read first, together.
// - Each topic file under docs/architecture/ stays within its bytes.
// - Each entry of docs/traps.md (a "## " heading and the text under it) stays within its bytes.
// - CLAUDE.md has no line over its cap outside its tables (the file map is one table row a path).
// - The list of tests has no line over its cap, names every test file, and every file it names exists.
// The budgets are in a file on .github/dangerous-paths, so raising one is seen in review.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

interface TheDocsBudgets {
  files: Record<string, number>;
  readFirst: { files: string[]; maxBytesTogether: number };
  topicFiles: { folder: string; maxBytesEach: number };
  trapEntries: { file: string; maxBytesEach: number };
  claudeMdLines: { file: string; maxCharactersALineOutsideItsTables: number };
  testList: { file: string; maxCharactersALine: number };
}

const BUDGETS: TheDocsBudgets = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'tests', 'the-docs-budgets.json'), 'utf8'),
) as TheDocsBudgets;

const bytesOf = (file: string): number => fs.statSync(path.join(ROOT, file)).size;
const exists = (file: string): boolean => fs.existsSync(path.join(ROOT, file));
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');
const charactersIn = (line: string): number => Array.from(line).length;

/** The sections of a Markdown file that start at a "## " heading (outside code fences), each with its bytes. */
function entriesOf(text: string): { heading: string; bytes: number }[] {
  const entries: { heading: string; bytes: number }[] = [];
  let fence = false;
  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) fence = !fence;
    if (!fence && line.startsWith('## ')) entries.push({ heading: line.slice(3), bytes: 0 });
    const current = entries.at(-1);
    if (current) current.bytes += Buffer.byteLength(line, 'utf8') + 1;
  }
  return entries;
}

/** Every test file: the test scripts, the Vitest tests of each level, the browser specs and the quarantined ones. */
function everyTestFile(): string[] {
  const under = (folder: string, pattern: RegExp): string[] =>
    exists(folder)
      ? fs
          .readdirSync(path.join(ROOT, folder), { recursive: true, encoding: 'utf8' })
          .filter((f) => pattern.test(f))
          .map((f) => `${folder}/${f.split(path.sep).join('/')}`)
      : [];
  const scripts = fs
    .readdirSync(path.join(ROOT, 'tests'))
    .filter((f) => f.endsWith('.test.js'))
    .map((f) => `tests/${f}`);
  return [
    ...scripts,
    ...['static', 'unit', 'scenario', 'simulation', 'page'].flatMap((level) => under(`tests/${level}`, /\.test\.ts$/)),
    ...under('tests/browser', /\.spec\.ts$/),
    ...under('tests/quarantine', /\.test\.js$/),
  ].sort();
}

describe('the docs an agent reads first', () => {
  test('each file stays within its budget', () => {
    const over = Object.entries(BUDGETS.files)
      .filter(([file, max]) => !exists(file) || bytesOf(file) > max)
      .map(
        ([file, max]) =>
          `${file}: ${exists(file) ? `${String(bytesOf(file))} bytes` : 'missing'}, budget ${String(max)}`,
      );
    expect(over, 'Cut it to what is true now, or move detail to a topic file').toEqual([]);
  });

  test('the files read first stay within their budget together', () => {
    const together = BUDGETS.readFirst.files.reduce((sum, file) => sum + bytesOf(file), 0);
    expect(together, `${BUDGETS.readFirst.files.join(', ')} together, in bytes`).toBeLessThanOrEqual(
      BUDGETS.readFirst.maxBytesTogether,
    );
  });

  test('each topic file stays within its budget', () => {
    const { folder, maxBytesEach } = BUDGETS.topicFiles;
    const files = exists(folder) ? fs.readdirSync(path.join(ROOT, folder)).filter((f) => f.endsWith('.md')) : [];
    const over = files
      .map((f) => `${folder}/${f}`)
      .filter((file) => bytesOf(file) > maxBytesEach)
      .map((file) => `${file}: ${String(bytesOf(file))} bytes, budget ${String(maxBytesEach)}`);
    expect(over, 'Split the topic in two, or cut it to what is true now').toEqual([]);
  });

  test('each trap stays within its budget', () => {
    const { file, maxBytesEach } = BUDGETS.trapEntries;
    const over = entriesOf(read(file))
      .filter((entry) => entry.bytes > maxBytesEach)
      .map((entry) => `"${entry.heading}": ${String(entry.bytes)} bytes, budget ${String(maxBytesEach)}`);
    expect(over, `${file}: a trap is its rule in one sentence, one example and what checks it`).toEqual([]);
  });

  test('CLAUDE.md has no long line outside its tables', () => {
    const { file, maxCharactersALineOutsideItsTables: max } = BUDGETS.claudeMdLines;
    const long = read(file)
      .split('\n')
      .map((line, i) => ({ line, number: i + 1 }))
      .filter(({ line }) => !line.trimStart().startsWith('|') && charactersIn(line) > max)
      .map(({ line, number }) => `line ${String(number)}: ${String(charactersIn(line))} characters`);
    expect(long, `${file}: wrap each line at ${String(max)} characters`).toEqual([]);
  });

  test('the list of tests has one short line a test, for every test file', () => {
    const { file, maxCharactersALine: max } = BUDGETS.testList;
    expect(exists(file), `${file} is missing`).toBe(true);
    const text = read(file);
    const long = text
      .split('\n')
      .map((line, i) => ({ line, number: i + 1 }))
      .filter(({ line }) => charactersIn(line) > max)
      .map(({ line, number }) => `line ${String(number)}: ${String(charactersIn(line))} characters`);
    expect(
      long,
      `${file}: one line a test, at most ${String(max)} characters; the rest goes in the test's own header`,
    ).toEqual([]);
    const named = new Set(
      [...text.matchAll(/`(tests\/[^`\s]+\.(?:test|spec)\.(?:js|ts))`/g)].flatMap((m) =>
        m[1] === undefined ? [] : [m[1]],
      ),
    );
    const missing = everyTestFile().filter((f) => !named.has(f));
    expect(missing, `${file}: give each of these tests its line`).toEqual([]);
    const gone = [...named].filter((f) => !exists(f));
    expect(gone, `${file} names test files that are not there`).toEqual([]);
  });
});
