// kc-merge (tools/merging/kc-merge.zsh) starts the CodeQL scan a merge needs, and reads the scan's alerts before it
// merges. Merging #512 to #528 as one group, the top pull request already held main, so kc-merge pushed nothing and
// waited for a scan nothing would start; its advice ("close and reopen it") started CI and staging but no scan; and
// CodeQL's check passes with an alert open (#509's, #528's), so the check alone let one through.
// Level 1 (unit): the tool's logic, run in zsh as Theo runs it, against a fake `gh` and `git` first on PATH that record
// each call and answer from a staged state, in a temporary folder (nothing reaches GitHub). Static can't: it runs the
// tool.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// `kc-merge` (`tools/merging/kc-merge.zsh`), run in zsh with a fake `gh` and `git` (each call recorded, each answer
// from a staged state): a pull request it merges (a group's top, or one alone) whose branch holds main and whose head
// has no CodeQL scan gets one empty commit pushed to its branch, with a message saying why, then is merged once its
// checks pass; with the label `staging` it asks first (the answer from stdin), and a "no" pushes nothing; an open
// code-scanning alert after the scan stops it, listing the rule, tool and place, with nothing merged; no CodeQL scan
// started within 10 minutes stops it, saying why; its advice never says to close and reopen. Each case is red on
// main's kc-merge.zsh before 0b. The clock is faked: the tool's wait between polls adds to zsh's SECONDS.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
// KC_MERGE_SCRIPT runs the cases on another copy of the tool (the proof that each is red on main's).
const SCRIPT = process.env['KC_MERGE_SCRIPT'] ?? path.join(ROOT, 'tools', 'merging', 'kc-merge.zsh');

// The fake `gh` and `git`: each call appended to calls.jsonl; each answer from state.json, which a push, an edit or a
// merge changes as GitHub would. `gh -q` filters run through jq, as gh runs its own copy of jq's language.
const FAKE = String.raw`
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const [tool, ...all] = process.argv.slice(2);
// gh's -R <repo> dropped: kc-merge passes it on every call, and every call here is to the one repository.
const args = all.filter((a, i) => a !== '-R' && all[i - 1] !== '-R');
const dir = process.env.KC_FAKE_DIR;
const statePath = dir + '/state.json';
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const save = () => fs.writeFileSync(statePath, JSON.stringify(state));
const record = (known) => fs.appendFileSync(dir + '/calls.jsonl', JSON.stringify({ tool, args, known }) + '\n');
const flag = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const out = (value) => {
  const q = flag('-q');
  if (q === undefined) { process.stdout.write(JSON.stringify(value) + '\n'); return; }
  const jq = spawnSync('jq', ['-r', q], { input: JSON.stringify(value), encoding: 'utf8' });
  process.stdout.write(jq.stdout); process.stderr.write(jq.stderr);
  if (jq.status !== 0) process.exit(jq.status ?? 1);
};
const pushed = (pr, sha) => {
  pr.headRefOid = sha;
  state.behind[sha] = 0;
  state.checks[sha] = state.checksOnPush;
};
const unknown = () => { record(false); process.stderr.write('fake ' + tool + ': no answer staged for ' + args.join(' ') + '\n'); process.exit(1); };
if (tool === 'gh') {
  const [group, verb, number] = args;
  const pr = state.prs[number];
  if (group === 'pr' && pr !== undefined) {
    record(true);
    if (verb === 'view') {
      const whole = { ...pr, statusCheckRollup: state.checks[pr.headRefOid] ?? [] };
      out(Object.fromEntries(flag('--json').split(',').map((f) => [f, whole[f]])));
    } else if (verb === 'edit') {
      if (flag('--base') !== undefined) pr.baseRefName = flag('--base');
      if (flag('--remove-label') !== undefined) pr.labels = pr.labels.filter((l) => l.name !== flag('--remove-label'));
    } else if (verb === 'ready') pr.isDraft = false;
    else if (verb === 'update-branch') {
      if ((state.behind[pr.headRefOid] ?? 0) > 0) pushed(pr, 'b'.repeat(39) + String(state.updates++));
    } else if (verb === 'merge') {
      for (const n of [number, ...(state.mergedWith[number] ?? [])]) state.prs[n].state = 'MERGED';
      pr.mergeCommit = { oid: 'f'.repeat(40) };
    } else if (verb === 'close') pr.state = 'CLOSED';
    else unknown();
    save();
  } else if (group === 'api') {
    const where = args[1];
    const compare = /^repos\/Nestalawe\/kingdoms-call\/compare\/([^.]+)\.\.\.(\w+)$/.exec(where);
    const alerts = /^repos\/Nestalawe\/kingdoms-call\/code-scanning\/alerts\?state=open&ref=refs\/pull\/(\d+)\/head$/.exec(where);
    if (compare !== null) {
      record(true);
      out(compare[1] === 'main'
        ? { behind_by: state.behind[compare[2]] ?? 0, ahead_by: 0, commits: state.commits[compare[2]] ?? [] }
        : { behind_by: 0, ahead_by: 0, commits: [] });
    } else if (alerts !== null) { record(true); out(state.alerts[alerts[1]] ?? []); }
    else unknown();
  } else unknown();
} else if (tool === 'git') {
  const [verb] = args;
  const branchPr = (ref) => Object.values(state.prs).find((p) => 'refs/heads/' + p.headRefName === ref);
  if (verb === 'fetch' && branchPr(args.at(-1)) !== undefined) { record(true); state.fetched = branchPr(args.at(-1)).headRefOid; }
  else if (verb === 'rev-parse' && args[1] === 'FETCH_HEAD') { record(true); process.stdout.write(state.fetched + '\n'); }
  else if (verb === 'commit-tree') {
    record(true);
    const sha = 'e'.repeat(39) + String(state.made.length);
    state.made.push({ sha, tree: args[1], parent: flag('-p'), message: args.filter((a, i) => args[i - 1] === '-m').join('\n\n') });
    process.stdout.write(sha + '\n');
  } else if (verb === 'push') {
    const [sha, ref] = args.at(-1).split(':');
    const made = state.made.find((c) => c.sha === sha);
    const pr = branchPr(ref);
    if (made === undefined || pr === undefined || made.parent !== pr.headRefOid) unknown();
    record(true);
    state.pushes.push({ branch: pr.headRefName, ...made });
    pushed(pr, sha);
  } else unknown();
  save();
} else unknown();
`;

interface Check {
  __typename: 'CheckRun';
  name: string;
  status: 'COMPLETED';
  conclusion: 'SUCCESS';
  startedAt: string;
}
const passed = (...names: string[]): Check[] =>
  names.map((name) => ({
    __typename: 'CheckRun',
    name,
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
    startedAt: '2026-11-11T09:00:00Z',
  }));

interface Alert {
  number: number;
  rule: { id: string };
  tool: { name: string };
  most_recent_instance: { location: { path: string; start_line: number } };
}
const AN_ALERT: Alert = {
  number: 65,
  rule: { id: 'js/bad-tag-filter' },
  tool: { name: 'CodeQL' },
  most_recent_instance: { location: { path: 'tools/proof/a-made-up-tool.ts', start_line: 12 } },
};

const BOTTOM = 'a'.repeat(39) + '1';
const TOP = 'a'.repeat(39) + '2';

/** A stack of two made-up pull requests, #600 on main and #601 on #600's branch: both drafts, ci and db passed on
 *  each, no CodeQL scan on either (a stacked head is never scanned), every branch holding main. */
function aStack() {
  const pr = (number: number, base: string, head: string, sha: string) => ({
    number,
    state: 'OPEN',
    isDraft: true,
    baseRefName: base,
    headRefName: head,
    headRefOid: sha,
    labels: [] as { name: string }[],
    title: `A made-up row ${String(number)}`,
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    mergeCommit: { oid: '' },
  });
  return {
    prs: { '600': pr(600, 'main', 'row-one', BOTTOM), '601': pr(601, 'row-one', 'row-two', TOP) },
    checks: { [BOTTOM]: passed('ci', 'db'), [TOP]: passed('ci', 'db') } as Record<string, Check[]>,
    checksOnPush: passed('ci', 'db', 'CodeQL'),
    behind: { [BOTTOM]: 0, [TOP]: 0 } as Record<string, number>,
    commits: {
      [BOTTOM]: [{ sha: BOTTOM, commit: { message: 'Row one' } }],
      [TOP]: [
        { sha: BOTTOM, commit: { message: 'Row one' } },
        { sha: TOP, commit: { message: 'Row two' } },
      ],
    },
    alerts: {} as Record<string, Alert[]>,
    mergedWith: { '601': ['600'] } as Record<string, string[]>,
    updates: 0,
    made: [] as { sha: string; parent: string; message: string }[],
    pushes: [] as { branch: string; sha: string; parent: string; message: string }[],
    fetched: '',
  };
}
type Staged = ReturnType<typeof aStack>;

const folders: string[] = [];
afterEach(() => {
  for (const f of folders.splice(0)) fs.rmSync(f, { recursive: true, force: true });
});

interface Call {
  tool: string;
  args: string[];
  known: boolean;
}

/** Runs `kc-merge <args>` in zsh on the staged state; stdin holds `answer`. */
function kcMerge(staged: Staged, args: string, answer = '') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-merge-'));
  folders.push(dir);
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(dir, 'fake.mjs'), FAKE);
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(staged));
  fs.writeFileSync(path.join(dir, 'calls.jsonl'), '');
  for (const tool of ['gh', 'git'])
    fs.writeFileSync(
      path.join(bin, tool),
      `#!/bin/sh\nexec "${process.execPath}" "${path.join(dir, 'fake.mjs')}" ${tool} "$@"\n`,
      { mode: 0o755 },
    );
  // No real wait, and nothing reaches the network.
  fs.writeFileSync(path.join(bin, 'sleep'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'curl'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const script = [
    `source ${JSON.stringify(SCRIPT)}`,
    // The fake clock: each wait between polls adds its seconds to SECONDS, which the tool's time limits read.
    '_kc-key-pressed-within() { (( SECONDS += $1 )); return 1 }',
    'kc-wait-deploy() { echo "kc-wait-deploy $1" }',
    `kc-merge ${args}`,
    'echo "kc-merge exited $?"',
  ].join('\n');
  const run = spawnSync('zsh', ['-f', '-c', script], {
    cwd: dir,
    input: answer,
    encoding: 'utf8',
    env: { PATH: `${bin}:/usr/bin:/bin`, HOME: dir, KC_FAKE_DIR: dir, LC_ALL: 'C' },
  });
  if (run.error) throw run.error;
  const after = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8')) as Staged;
  const calls = fs
    .readFileSync(path.join(dir, 'calls.jsonl'), 'utf8')
    .split('\n')
    .filter((l) => l !== '')
    .map((l) => JSON.parse(l) as Call);
  const said = run.stdout + run.stderr;
  return { said, stdout: run.stdout, after, calls, merges: calls.filter((c) => c.args[1] === 'merge') };
}

const LIMIT = timeLimitForTheWork({ toolRuns: 1 });

describe('kc-merge starts the CodeQL scan the merge needs', () => {
  test("a group's top that holds main with no scan gets one empty commit, saying why, then merges", LIMIT, () => {
    const { said, after, calls, merges } = kcMerge(aStack(), '--group 600-601');
    expect(calls.filter((c) => !c.known)).toEqual([]);
    expect(after.pushes.map((p) => [p.branch, p.parent])).toEqual([['row-two', TOP]]);
    const [push] = after.pushes;
    expect(push?.message).toMatch(/^Start CodeQL on #601: an empty commit \(kc-merge\)\n\n.*no CodeQL scan/);
    // An empty commit: the tree of the head it is made on.
    expect(after.made[0]).toMatchObject({ tree: `${TOP}^{tree}`, parent: TOP });
    expect(merges.map((c) => c.args[2])).toEqual(['601']);
    expect(after.prs['600'].state).toBe('MERGED');
    expect(said).toContain('kc-merge exited 0');
  });

  test('one merged alone that holds main with no scan gets one empty commit too, not a close and reopen', LIMIT, () => {
    const staged = aStack();
    const { said, after, merges } = kcMerge(staged, '600');
    expect(after.pushes.map((p) => [p.branch, p.parent])).toEqual([['row-one', BOTTOM]]);
    expect(merges.map((c) => c.args[2])).toEqual(['600']);
    expect(said).toContain('kc-merge exited 0');
  });

  test('with the label staging it asks first, and a no pushes nothing and merges nothing', LIMIT, () => {
    const staged = aStack();
    staged.prs['601'].labels = [{ name: 'staging' }];
    const { stdout, after, merges } = kcMerge(staged, '--group 600-601', 'n');
    expect(stdout).toContain("#601 has the label 'staging'");
    expect(stdout).toContain('Take the label off #601 and push to its branch? [y/N]');
    expect(after.pushes).toEqual([]);
    expect(after.prs['601'].labels).toEqual([{ name: 'staging' }]);
    expect(merges).toEqual([]);
  });

  test('with the label staging, a yes takes the label off before the one empty commit', LIMIT, () => {
    const staged = aStack();
    staged.prs['601'].labels = [{ name: 'staging' }];
    const { stdout, after, calls, merges } = kcMerge(staged, '--group 600-601', 'y');
    expect(stdout).toContain('Take the label off #601 and push to its branch? [y/N]');
    const unlabel = calls.findIndex((c) => c.args.includes('--remove-label'));
    const push = calls.findIndex((c) => c.tool === 'git' && c.args[0] === 'push');
    expect(unlabel).toBeGreaterThanOrEqual(0);
    expect(push).toBeGreaterThan(unlabel);
    expect(after.pushes).toHaveLength(1);
    expect(merges.map((c) => c.args[2])).toEqual(['601']);
  });

  test('no CodeQL scan started within 10 minutes of the push stops it, saying why, with nothing merged', LIMIT, () => {
    const staged = aStack();
    staged.checksOnPush = passed('ci', 'db');
    const { said, after, merges } = kcMerge(staged, '--group 600-601');
    expect(after.pushes).toHaveLength(1);
    expect(said).toMatch(/No CodeQL scan has started on #601's last commit \(e{7}\) in 10 minutes: stopping\./);
    expect(merges).toEqual([]);
    expect(said).toContain('kc-merge exited 1');
  });
});

describe('kc-merge reads the open alerts once the scan has passed', () => {
  test(
    "an open alert on the group's top stops it, listing the rule, the tool and the place; nothing merged",
    LIMIT,
    () => {
      const staged = aStack();
      staged.checks[TOP] = passed('ci', 'db', 'CodeQL');
      staged.alerts['601'] = [AN_ALERT];
      const { said, after, calls, merges } = kcMerge(staged, '--group 600-601');
      expect(
        calls.some(
          (c) => c.args[1] === 'repos/Nestalawe/kingdoms-call/code-scanning/alerts?state=open&ref=refs/pull/601/head',
        ),
      ).toBe(true);
      expect(said).toContain('#601 has 1 open code-scanning alert(s): stopping; nothing merged.');
      expect(said).toContain('alert 65: js/bad-tag-filter (CodeQL) at tools/proof/a-made-up-tool.ts:12');
      expect(after.pushes).toEqual([]);
      expect(merges).toEqual([]);
    },
  );

  test('an open alert on one merged alone stops it too', LIMIT, () => {
    const staged = aStack();
    staged.checks[BOTTOM] = passed('ci', 'db', 'CodeQL');
    staged.alerts['600'] = [AN_ALERT];
    const { said, merges } = kcMerge(staged, '600');
    expect(said).toContain('#600 has 1 open code-scanning alert(s): stopping; nothing merged.');
    expect(merges).toEqual([]);
  });
});

test('its advice says to push an empty commit, never to close and reopen', () => {
  const text = fs.readFileSync(SCRIPT, 'utf8');
  expect(text).not.toMatch(/reopen/i);
  expect(text).toContain('Push an empty commit to it yourself');
});
