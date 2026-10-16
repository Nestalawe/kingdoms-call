// Claude Code hook, when the agent is about to finish (.claude/settings.json, Stop): runs npm run check
// (tools/check.ts). If it fails, the hook exits 2 and Claude Code gives the failures back to the agent, which carries
// on. To avoid an endless loop it blocks at most STOP_LIMIT times in a row; then it lets the agent stop and tells the
// person running the session: "npm run check still fails: tell Theo". CI stays the hard gate.
//
// The count is kept per session (a git-ignored file keyed by the session id). It starts again when the check passes,
// and at each new turn (a stop that isn't the agent carrying on after a block). A check that passed is not run again
// until the files change.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CACHE, report, ROOT, runCheck } from '../check.ts';
import { readInput } from './input.ts';

export const STOP_LIMIT = 3;
export const GIVE_UP = '`npm run check` still fails: tell Theo';

// After a check: whether to block this stop, and the new count of blocks in a row.
export function decide(blocked: number, ok: boolean): { block: boolean; blocked: number } {
  if (ok) return { block: false, blocked: 0 };
  if (blocked < STOP_LIMIT) return { block: true, blocked: blocked + 1 };
  return { block: false, blocked: 0 };
}

// The state of the files: the commit, uncommitted changes and new files. Unchanged since a check passed: no rerun.
function fingerprint(): string {
  const git = (...args: string[]) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 1 << 30 });
  const hash = createHash('sha256').update(process.version).update(git('rev-parse', 'HEAD'));
  hash.update(git('diff', 'HEAD', '--binary'));
  const added = git('ls-files', '-z', '--others', '--exclude-standard').toString().split('\0').filter(Boolean);
  for (const f of added) {
    hash.update(f);
    if (fs.existsSync(path.join(ROOT, f))) hash.update(fs.readFileSync(path.join(ROOT, f)));
  }
  return hash.digest('hex');
}

const say = (json: object) => {
  process.stdout.write(JSON.stringify(json) + '\n');
};

async function main(): Promise<number> {
  const input = await readInput();
  const pinned = 'v' + fs.readFileSync(path.join(ROOT, '.nvmrc'), 'utf8').trim();
  if (process.version !== pinned) {
    // Not the agent's to fix: tell the person, and let the agent stop.
    say({
      systemMessage: `npm run check didn't run: Claude Code started with Node ${process.version}, and the checks need ${pinned} (.nvmrc). Start Claude Code with Node ${pinned} first on PATH.`,
    });
    return 0;
  }
  const dir = path.join(CACHE, 'stops');
  fs.mkdirSync(dir, { recursive: true });
  const countFile = path.join(dir, (input.session_id ?? 'none').replace(/[^\w-]/g, '_'));
  const passedFile = path.join(CACHE, 'check-passed');
  const now = fingerprint();
  if (fs.existsSync(passedFile) && fs.readFileSync(passedFile, 'utf8') === now) return 0;

  const steps = await runCheck();
  const ok = steps.every((s) => s.ok);
  if (ok) fs.writeFileSync(passedFile, now);
  const before = input.stop_hook_active && fs.existsSync(countFile) ? Number(fs.readFileSync(countFile, 'utf8')) : 0;
  const { block, blocked } = decide(before, ok);
  fs.writeFileSync(countFile, String(blocked));
  if (ok) return 0;
  const failed = steps.filter((s) => !s.ok).map((s) => s.name);
  if (!block) {
    say({ systemMessage: `${GIVE_UP} (failing: ${failed.join(', ')}).` });
    return 0;
  }
  const last =
    blocked === STOP_LIMIT
      ? `\nThis is the last time this hook stops you. If you can't fix it, end your reply with: "${GIVE_UP}", and say what fails.`
      : '';
  process.stderr.write(
    `npm run check failed (${String(blocked)} of ${String(STOP_LIMIT)}). Fix it before you finish.\n`,
  );
  process.stderr.write(`${report(steps)}\n${last}\n`);
  return 2;
}

if (path.resolve(process.argv[1] ?? '') === import.meta.filename) {
  void main().then((code) => {
    process.exitCode = code;
  });
}
