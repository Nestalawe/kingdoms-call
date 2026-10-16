// The balance report's comment (tools/github/balance-comment.ts, P1-03a): which pull request, what it says with and
// without a report, and the "What changes in play" warning. The script runs in plain Node with nothing installed, so it
// is also run that way here, against a stand-in for GitHub's API on this machine (no network). Level 1 (unit): pure
// functions, and the script run on its own; no lower level runs it.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  classOf,
  MARKER,
  MAX_REPORT,
  needsWarning,
  readReport,
  reportBody,
  WARNING_BODY,
  WARNING_MARKER,
  whatChangesInPlay,
} from '../../tools/github/balance-comment.ts';

const SCRIPT = path.resolve(import.meta.dirname, '..', '..', 'tools', 'github', 'balance-comment.ts');
const RUN = { sha: 'abcdef1234567890', url: 'https://example.invalid/run/1', conclusion: 'success' };

describe('the description\'s "What changes in play" section', () => {
  test('missing, a comment only, or "None": empty', () => {
    expect(whatChangesInPlay(null)).toBe('');
    expect(whatChangesInPlay('## What changed\n\nStuff.')).toBe('');
    expect(whatChangesInPlay('## What changes in play\n\n<!-- Predict first. -->\n\n## Rulings\n\nNone.')).toBe('');
    expect(whatChangesInPlay('## What changes in play\n\nNone.\n\n## Rulings')).toBe('');
  });

  test('written: its text, up to the next section, with its "Not expected" part', () => {
    const body =
      '## What changed\r\n\r\nX.\r\n\r\n## What changes in play\r\n\r\n<!-- hint -->\r\nArchers win more often in ' +
      'the hills.\r\n\r\n### Not expected\r\n\r\nNothing.\r\n\r\n## Rulings\r\n\r\nNone.';
    expect(whatChangesInPlay(body)).toBe('Archers win more often in the hills.\n\n### Not expected\n\nNothing.');
    expect(whatChangesInPlay('## What changes in play\nFewer lairs fall.\n---\n## Tests')).toBe('Fewer lairs fall.');
  });

  test('the warning: for any report but "no change", while the section is missing or empty', () => {
    const written = '## What changes in play\n\nFewer lairs fall.';
    expect(needsWarning('rule change', '')).toBe(true);
    expect(needsWarning('reshape', '')).toBe(true);
    expect(needsWarning('wording only', '')).toBe(true);
    expect(needsWarning('rule change', written)).toBe(false);
    expect(needsWarning('no change', '')).toBe(false);
    expect(needsWarning(null, '')).toBe(false);
    expect(WARNING_BODY.startsWith(WARNING_MARKER)).toBe(true);
  });
});

describe('the report comment', () => {
  test('the report file: only the right shape is read', () => {
    expect(readReport(JSON.stringify({ version: 1, class: 'rule change', verdict: 'v', markdown: 'm' }))).toEqual({
      class: 'rule change',
      markdown: 'm',
    });
    for (const bad of [
      '{',
      '[]',
      '{"version":2,"class":"rule change","markdown":"m"}',
      '{"version":1,"class":"x","markdown":"m"}',
    ]) {
      expect(readReport(bad), bad).toBeNull();
    }
  });

  test("its class is kept in the comment, and the report's text can't fake a marker", () => {
    const body = reportBody({ class: 'reshape', markdown: `## Balance report\n${WARNING_MARKER}${MARKER}x` }, RUN);
    expect(body.startsWith(MARKER + '\n<!-- balance-class: reshape -->\n')).toBe(true);
    expect(body.split(MARKER)).toHaveLength(2);
    expect(body).not.toContain(WARNING_MARKER);
    expect(body).toContain('commit abcdef1 ([CI run](https://example.invalid/run/1))');
    expect(classOf(body)).toBe('reshape');
    expect(classOf('<!-- balance-class: anything -->')).toBeNull();
  });

  test("a long report is cut short under GitHub's limit", () => {
    const body = reportBody({ class: 'rule change', markdown: 'x'.repeat(100_000) }, RUN);
    expect(body.length).toBeLessThan(MAX_REPORT + 500);
    expect(body).toContain('cut short');
  });

  test('no report: why, from how the CI run ended', () => {
    expect(reportBody(null, RUN)).toContain('no engine path changed since the base branch');
    expect(reportBody(null, { ...RUN, conclusion: 'failure' })).toContain("CI's balance job stopped before the report");
    expect(classOf(reportBody(null, RUN))).toBeNull();
  });
});

// A stand-in for GitHub's API: one open pull request (#7, head "abc…" on owner:branch) and its comments.
interface Call {
  method: string;
  url: string;
  body?: { body?: string };
}
const BOT = { login: 'github-actions[bot]' };
let comments: { id: number; body: string; user: { login: string } }[] = [];
let description = '';
let calls: Call[] = [];
const server = http.createServer((req, res) => {
  let data = '';
  req.on('data', (c: Buffer) => (data += c.toString()));
  req.on('end', () => {
    const url = req.url ?? '';
    const call: Call = { method: req.method ?? '', url };
    if (data) call.body = JSON.parse(data) as { body?: string };
    calls.push(call);
    const [status, value] = answer(call);
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(value === undefined ? '' : JSON.stringify(value));
  });
});
function answer(call: Call): [number, unknown] {
  const { method, url } = call;
  const pr = { number: 7, body: description, head: { sha: 'abc' } };
  if (url.startsWith('/repos/o/r/pulls?')) return [200, url.includes('head=owner%3Abranch') ? [pr] : []];
  if (url === '/repos/o/r/pulls/7') return [200, pr];
  if (url.startsWith('/repos/o/r/issues/7/comments?')) return [200, comments];
  if (method === 'POST' && url === '/repos/o/r/issues/7/comments') {
    comments.push({ id: comments.length + 100, body: call.body?.body ?? '', user: BOT });
    return [201, {}];
  }
  const id = Number(/\/issues\/comments\/(\d+)$/.exec(url)?.[1]);
  if (method === 'PATCH') {
    const c = comments.find((x) => x.id === id);
    if (c) c.body = call.body?.body ?? '';
    return [200, {}];
  }
  if (method === 'DELETE') {
    comments = comments.filter((x) => x.id !== id);
    return [204, undefined];
  }
  return [404, { message: 'not found' }];
}
let api = '';
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  api = `http://127.0.0.1:${String(typeof addr === 'object' && addr ? addr.port : 0)}`;
});
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-balance-comment-'));
afterAll(() => {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

const report = (cls: string) => {
  const f = path.join(tmp, 'report.json');
  fs.writeFileSync(
    f,
    JSON.stringify({ version: 1, class: cls, verdict: 'v', markdown: `## Balance report\n\n${cls}\n` }),
  );
  return f;
};
// Plain Node: no tsx, nothing from NODE_OPTIONS.
const run = async (mode: string, env: Record<string, string>) => {
  const r = await promisify(execFile)(process.execPath, [SCRIPT, mode], {
    env: { PATH: process.env['PATH'] ?? '', GITHUB_API_URL: api, GITHUB_REPOSITORY: 'o/r', GITHUB_TOKEN: 't', ...env },
  });
  return r.stdout + r.stderr;
};
const post = (env: Record<string, string>) =>
  run('post', {
    HEAD_SHA: 'abc',
    HEAD_OWNER: 'owner',
    HEAD_BRANCH: 'branch',
    CONCLUSION: 'success',
    RUN_URL: 'https://example.invalid/run/2',
    REPORT_FILE: path.join(tmp, 'none.json'),
    ...env,
  });
const writes = () => calls.filter((c) => c.method !== 'GET').map((c) => c.method);
const reset = (body = '', existing: typeof comments = []) => {
  calls = [];
  description = body;
  comments = existing;
};

describe('the script, in plain Node', () => {
  test('it imports nothing but Node itself', () => {
    const text = fs.readFileSync(SCRIPT, 'utf8');
    const from = [...text.matchAll(/\b(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(from.filter((m) => !m?.startsWith('node:'))).toEqual([]);
  });

  test('a rule change: posts the report and the warning; a second run changes nothing', async () => {
    reset();
    await post({ REPORT_FILE: report('rule change') });
    expect(writes()).toEqual(['POST', 'POST']);
    expect(comments.map((c) => c.body.split('\n')[0])).toEqual([MARKER, WARNING_MARKER]);
    calls = [];
    await post({ REPORT_FILE: report('rule change') });
    expect(writes()).toEqual([]);
  });

  test('the section written: the next edit of the description deletes the warning', async () => {
    reset('', []);
    await post({ REPORT_FILE: report('rule change') });
    description = '## What changes in play\n\nFewer lairs fall.';
    calls = [];
    await run('warn', { PR_NUMBER: '7' });
    expect(writes()).toEqual(['DELETE']);
    expect(comments.map((c) => c.body.split('\n')[0])).toEqual([MARKER]);
  });

  test('no change: the report, no warning', async () => {
    reset();
    await post({ REPORT_FILE: report('no change') });
    expect(comments.map((c) => c.body.split('\n')[0])).toEqual([MARKER]);
  });

  test("no report: says so in an earlier report's comment, and posts nothing on a pull request that never had one", async () => {
    reset();
    const out = await post({});
    expect(out).toContain('nothing to say');
    expect(writes()).toEqual([]);
    reset('', [{ id: 1, body: `${MARKER}\nold`, user: BOT }]);
    await post({ CONCLUSION: 'failure' });
    expect(writes()).toEqual(['PATCH']);
    expect(comments[0]?.body).toContain("CI's balance job stopped before the report");
  });

  test("another head commit (pushed again since), a cancelled run, someone else's comment: left alone", async () => {
    reset();
    expect(await post({ HEAD_SHA: 'old', REPORT_FILE: report('rule change') })).toContain('nothing to post');
    expect(await post({ CONCLUSION: 'cancelled', REPORT_FILE: report('rule change') })).toContain(
      'a later run reports',
    );
    expect(writes()).toEqual([]);
    reset('', [{ id: 1, body: `${MARKER}\nby a person`, user: { login: 'someone' } }]);
    await post({ REPORT_FILE: report('no change') });
    expect(writes()).toEqual(['POST']);
    expect(comments[0]?.body).toBe(`${MARKER}\nby a person`);
  });

  test('a file that is not a report: treated as none, with a warning in the log', async () => {
    reset();
    const f = path.join(tmp, 'bad.json');
    fs.writeFileSync(f, '{"version":1,"class":"everything is fine","markdown":"x"}');
    expect(await post({ REPORT_FILE: f })).toContain("isn't a balance report");
    expect(writes()).toEqual([]);
  });

  test('an API failure is a warning in the log, never a failed job', async () => {
    reset();
    const out = await run('warn', { PR_NUMBER: '99' });
    expect(out).toContain('::warning title=balance-report::');
  });
});
