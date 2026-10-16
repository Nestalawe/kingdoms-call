// Claude Code hook, after every Edit or Write (.claude/settings.json, PostToolUse): the type check (incremental),
// ESLint and Prettier on the edited file. On a failure it exits 2, so Claude Code hands the errors straight back to
// the agent. Under 10 s; most edits take about 1 s. A file outside this repository is left alone.
import fs from 'node:fs';
import path from 'node:path';
import { CACHE, format, lint, report, ROOT, typecheck } from '../check.ts';
import { readInput } from './input.ts';

async function main(): Promise<number> {
  const file = (await readInput()).tool_input?.file_path;
  if (!file) return 0;
  const rel = path.relative(ROOT, path.resolve(ROOT, file));
  if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(path.join(ROOT, rel))) return 0;
  fs.mkdirSync(CACHE, { recursive: true });
  const steps = await Promise.all([typecheck(), lint([rel]), format([rel])]);
  if (steps.every((s) => s.ok)) return 0;
  process.stderr.write(`Checks after editing ${rel}:\n${report(steps)}\n`);
  return 2;
}

void main().then((code) => {
  process.exitCode = code;
});
