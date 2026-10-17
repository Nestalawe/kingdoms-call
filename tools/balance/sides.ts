// Playing on two builds: the worker processes that play side by side, this side's site built from src/, and a copy of
// the base branch's site to play.
// The matrix (run.ts), the report's replays (report-run.ts) and the named scenarios (scenario-run.ts) all use them.
import { execFileSync, fork, type Serializable } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from '../build.ts';

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

/** Builds site/ from src/ (tools/build.ts), so this side plays the pages as they are now; unless KC_SITE names another
 *  copy of the site to play, as it is. */
export function buildSite(): void {
  if (!process.env['KC_SITE']) build();
}

const inTree = (ref: string, file: string) => {
  try {
    execFileSync('git', ['cat-file', '-e', `${ref}:${file}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

/** Runs `fn` with `ref`'s site, in a temporary folder removed after: its committed site/ (before P1-05), or its src/
 *  built by its own tools/build.ts (git archive of both). P1-09's Vite build will need this to change. */
export async function withSiteAt<T>(ref: string, fn: (site: string) => Promise<T>): Promise<T> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-balance-base-'));
  try {
    const committed = inTree(ref, 'site');
    const tar = path.join(dir, 'site.tar');
    execFileSync('git', [
      'archive',
      '--format=tar',
      '-o',
      tar,
      ref,
      ...(committed ? ['site'] : ['src', 'tools/build.ts']),
    ]);
    execFileSync('tar', ['-xf', tar, '-C', dir]);
    if (!committed) {
      execFileSync(
        process.execPath,
        ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', path.join(dir, 'tools', 'build.ts')],
        { stdio: ['ignore', 'ignore', 'inherit'] },
      );
    }
    return await fn(path.join(dir, 'site'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
