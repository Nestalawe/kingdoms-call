// Claude Code hook, when the agent is about to finish (.claude/settings.json, Stop): runs npm run check
// (tools/check.ts). If it fails, the hook exits 2 and Claude Code gives the failures back to the agent, which carries
// on. To avoid an endless loop it blocks at most STOP_LIMIT times in a row; then it lets the agent stop and tells the
// person running the session: "npm run check still fails: tell Theo". CI stays the hard gate.
//
// The count is kept per session (a git-ignored file keyed by the session id). It starts again when the check passes,
// and at each new turn (a stop that isn't the agent carrying on after a block). A check that passed is not run again
// until the files change.
//
// It checks only a session that edited a file of this repository with an edit tool (Edit, Write, MultiEdit or
// NotebookEdit, read from its transcript). A session that edited none (a conductor whose rows' agents do the work, a
// session that only reads) stops without the check: the changes in the tree are another session's, and the whole
// check would slow that session's own tests. A session whose transcript can't be read is checked. An edit made only
// through a shell command isn't seen, as the edit hook doesn't see it: the tests before a push, and CI, still run.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
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

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const anEntry = z.object({ message: z.object({ content: z.array(z.unknown()) }) });
const aToolUse = z.object({
  type: z.literal('tool_use'),
  name: z.string(),
  input: z.object({ file_path: z.string().optional(), notebook_path: z.string().optional() }),
});

/** The JSON in a line, or null when it isn't JSON. */
function parsedOrNull(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

/** Whether a session's transcript (Claude Code's, one JSON entry a line) shows an edit tool used on a file inside
 *  `root`. A line that isn't JSON, or an entry of another shape, is passed over. */
export function theSessionEditedTheRepository(transcript: string, root: string): boolean {
  const inside = (file: string | undefined) => {
    if (!file) return false;
    const rel = path.relative(root, path.resolve(root, file));
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  };
  return transcript.split('\n').some((line) => {
    if (!line.includes('"tool_use"')) return false;
    const entry = anEntry.safeParse(parsedOrNull(line));
    if (!entry.success) return false;
    return entry.data.message.content.some((block) => {
      const use = aToolUse.safeParse(block);
      if (!use.success || !EDIT_TOOLS.has(use.data.name)) return false;
      return inside(use.data.input.file_path) || inside(use.data.input.notebook_path);
    });
  });
}

/** Whether this stop runs the check: unless the session's transcript is read and shows no edit of the repository. */
export function checksThisSession(transcriptPath: string | undefined, root: string): boolean {
  if (!transcriptPath) return true;
  let text: string;
  try {
    text = fs.readFileSync(transcriptPath, 'utf8');
  } catch {
    return true;
  }
  return theSessionEditedTheRepository(text, root);
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
  if (!checksThisSession(input.transcript_path, ROOT)) return 0;
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
