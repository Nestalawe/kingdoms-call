// Copies of the repository for the proof tools (tools/proof/README.md): the working tree as it is now (tracked files and
// new ones git doesn't ignore, the plan's folder left out), or a commit as git holds it; this checkout's node_modules
// linked into the copy, so it builds and runs without an install; and, for the tests that read git, a git repository of
// its own with one commit. A planted fault is a patch applied to a copy and committed there.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** The folders a copy of the working tree leaves out: the private plan (CLAUDE.md, Never 6) and what is installed. */
export const LEFT_OUT_OF_A_COPY = ['plan/', 'node_modules/'] as const;

const git = (cwd: string, args: string[], input?: string): string =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: [input == null ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    ...(input == null ? {} : { input }),
  });

/** The files a copy of `repo`'s working tree holds: tracked and new ones git doesn't ignore, as git names them, sorted,
 *  without the folders LEFT_OUT_OF_A_COPY names, and without a tracked file deleted from the tree. */
export function theFilesOfTheWorkingTree(repo: string): string[] {
  return git(repo, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
    .split('\0')
    .filter((f) => f && !LEFT_OUT_OF_A_COPY.some((dir) => f.startsWith(dir)))
    .filter((f) => fs.existsSync(path.join(repo, f)))
    .sort();
}

/** A new, empty folder for a copy, in the system's temporary folder: `kc-proof-<what>-…`. */
export const aFolderForACopy = (what: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `kc-proof-${what}-`));

/** Copies `repo`'s working tree into `dest` (made if missing), as it is now, uncommitted changes and all. */
export function copyTheWorkingTree(repo: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const f of theFilesOfTheWorkingTree(repo)) {
    fs.mkdirSync(path.dirname(path.join(dest, f)), { recursive: true });
    fs.copyFileSync(path.join(repo, f), path.join(dest, f));
  }
}

/** Copies the commit `ref` of `repo` into `dest` (made if missing), as `git archive` writes it. */
export function copyACommit(repo: string, ref: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const tar = path.join(dest, '.kc-proof-archive.tar');
  git(repo, ['archive', '--format=tar', '-o', tar, ref]);
  execFileSync('tar', ['-xf', tar, '-C', dest]);
  fs.rmSync(tar);
}

/** Links `repo`'s node_modules into the copy `dest`: the copy runs on this checkout's packages. */
export function linkNodeModules(repo: string, dest: string): void {
  fs.symlinkSync(path.join(repo, 'node_modules'), path.join(dest, 'node_modules'), 'dir');
}

/** Makes the copy `dest` a git repository with everything in it committed once (its node_modules link ignored), so
 *  the tests that read git (the ratchet, the docs' checks) find a clean tree. */
export function commitTheCopy(dest: string): void {
  git(dest, ['init', '-q']);
  git(dest, ['add', '-A']);
  git(dest, [
    '-c',
    'user.email=proof@example.invalid',
    '-c',
    'user.name=proof',
    'commit',
    '-qm',
    'the copy',
    '--no-verify',
  ]);
}

/** Applies the patch `patchFile` (a `git diff`) to the committed copy `dest`, and commits it. Throws when git refuses
 *  the patch, or when it changes nothing. Returns the files it changed. */
export function plantAPatch(dest: string, patchFile: string): string[] {
  git(dest, ['apply', '--whitespace=nowarn', path.resolve(patchFile)]);
  const changed = git(dest, ['status', '--porcelain', '-z'])
    .split('\0')
    .filter(Boolean)
    .map((line) => line.slice(3));
  if (!changed.length) throw new Error(`the patch ${patchFile} changes nothing`);
  git(dest, ['add', '-A']);
  git(dest, [
    '-c',
    'user.email=proof@example.invalid',
    '-c',
    'user.name=proof',
    'commit',
    '-qm',
    'the plant',
    '--no-verify',
  ]);
  return changed.sort();
}

/** Where a ref's copy of the repository starts from: a ref as git names it, or the merge base of `base` and HEAD when
 *  `mergeBase` is set (what a branch changed since it left `base`). */
export function theCommitOf(repo: string, ref: string, { mergeBase = false } = {}): string {
  return (
    mergeBase ? git(repo, ['merge-base', ref, 'HEAD']) : git(repo, ['rev-parse', '--verify', `${ref}^{commit}`])
  ).trim();
}

/** Removes a copy, quietly (a copy is in the system's temporary folder). */
export function removeTheCopy(dest: string): void {
  fs.rmSync(dest, { recursive: true, force: true });
}
