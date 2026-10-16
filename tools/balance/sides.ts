// Playing on two builds: the worker processes that play side by side, and a copy of the base branch's site to play.
// The matrix (run.ts), the report's replays (report-run.ts) and the named scenarios (scenario-run.ts) all use them.
import { execFileSync, fork, type Serializable } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Sends each job to one of `n` worker processes running `worker` (a .ts file, forked with tsx), one job at a time
 *  each, in the order given, and returns the replies as they came. `site` plays another copy of the site: the
 *  workers get it as KC_SITE (tests/lib/boot.js reads it as it loads). */
export async function forkPool<R>(
  worker: string,
  jobs: readonly Serializable[],
  n: number,
  site?: string,
): Promise<R[]> {
  const queue = [...jobs];
  const replies: R[] = [];
  const env = site ? { ...process.env, KC_SITE: site } : process.env;
  await Promise.all(
    Array.from(
      { length: Math.max(1, Math.min(n, jobs.length)) },
      () =>
        new Promise<void>((resolve, reject) => {
          const child = fork(worker, {
            execArgv: ['--import', 'tsx'],
            env,
            stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
          });
          const next = () => {
            const job = queue.shift();
            if (job != null) child.send(job);
            else child.disconnect();
          };
          child.on('message', (r: R) => {
            replies.push(r);
            next();
          });
          child.on('exit', (code) => {
            if (code) reject(new Error(`a balance worker stopped (exit ${String(code)})`));
            else resolve();
          });
          next();
        }),
    ),
  );
  return replies;
}

/** Runs `fn` with a copy of `ref`'s site/ (git archive into a temporary folder), and removes the copy after. */
export async function withSiteAt<T>(ref: string, fn: (site: string) => Promise<T>): Promise<T> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-balance-base-'));
  try {
    const tar = path.join(dir, 'site.tar');
    execFileSync('git', ['archive', '--format=tar', '-o', tar, ref, 'site']);
    execFileSync('tar', ['-xf', tar, '-C', dir]);
    return await fn(path.join(dir, 'site'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
