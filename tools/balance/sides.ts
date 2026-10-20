// Playing on two builds: the worker processes that play side by side, this side's site built from src/, and a copy of
// the base branch's site to play.
// The matrix (run.ts), the report's replays (report-run.ts) and the named scenarios (scenario-run.ts) all use them.
import { execFileSync, fork, type Serializable } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build, ROOT } from '../build.ts';

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

/** Runs `fn` with `ref`'s site, in a temporary folder removed after (git archive of what it is built from):
 *  - its committed site/ (before P1-05);
 *  - or its src/, built by its own tools/build.ts: in plain Node until P1-09d (src/manifest.ts's stitch); since then by
 *    Vite (the ref has public/), with this checkout's node_modules linked in when the ref's package-lock.json is this
 *    one's, or else installed there by npm ci. */
export async function withSiteAt<T>(ref: string, fn: (site: string) => Promise<T>): Promise<T> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-balance-base-'));
  try {
    const committed = inTree(ref, 'site');
    const vite = !committed && inTree(ref, 'public');
    const wanted = committed
      ? ['site']
      : ['src', 'tools/build.ts', ...(vite ? ['public', 'package.json', 'package-lock.json'] : [])];
    const tar = path.join(dir, 'site.tar');
    execFileSync('git', ['archive', '--format=tar', '-o', tar, ref, ...wanted.filter((f) => inTree(ref, f))]);
    execFileSync('tar', ['-xf', tar, '-C', dir]);
    if (vite) {
      const lock = (root: string) => fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8');
      const same = fs.existsSync(path.join(dir, 'package-lock.json')) && lock(dir) === lock(ROOT);
      if (same) fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
      else execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'] });
    }
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
