// tests/legacy.test.ts: runs the test scripts (tests/suite.ts) as Vitest tests, one test per script, each in its
// own Node process with the same arguments and environment as tests/run.js gave them (KC_SEED, KC_SITE, KC_FULL
// pass through). Every project in vitest.config.ts includes this file and runs its own level's scripts; the
// quarantine project runs tests/quarantine/. A script passes when it exits 0. On a failure the error shows the end
// of the script's output and the command that repeats it. The scripts become real Vitest tests over P1-14.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { inject, test } from 'vitest';
import { LEVELS, suite, type Script } from './suite.ts';
import { reproduceCommand } from './setup/repro.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const level = inject('level');
const full = process.env['KC_FULL'] === '1';
// vitest.config.ts sets KC_SEED (the fixed default, or the one given).
const seed = process.env['KC_SEED'] ?? '';
// The old runner's limit for one script.
const LIMIT_MS = 15 * 60 * 1000;

type Run = Omit<Script, 'level'>;

function quarantined(): Run[] {
  return fs
    .readdirSync(path.join(ROOT, 'tests', 'quarantine'))
    .filter((f) => f.endsWith('.test.js'))
    .sort()
    .map((f) => ({ name: f.replace('.test.js', ''), file: `tests/quarantine/${f}`, args: [], env: {} }));
}

const scripts: Run[] = level === 'quarantine' ? quarantined() : suite(full).filter((s) => s.level === level);

interface Result {
  status: number | null;
  signal: NodeJS.Signals | null;
  error: Error | null;
  out: string;
}

function run(script: Run): Promise<Result> {
  return new Promise((resolve) => {
    let out = '';
    let settled = false;
    const child = spawn(process.execPath, [script.file, ...script.args], {
      cwd: ROOT,
      env: { ...process.env, KC_SEED: seed, ...script.env },
    });
    child.stdout.on('data', (d: Buffer) => {
      out += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      out += d.toString();
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), LIMIT_MS);
    const done = (status: number | null, signal: NodeJS.Signals | null, error: Error | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ status, signal, error, out });
    };
    child.on('error', (e) => {
      done(null, null, e);
    });
    child.on('close', (code, signal) => {
      done(code, signal, null);
    });
  });
}

// The script's exit status, with the end of its output and the command that repeats it when it isn't 0.
function failure(script: Run, r: Result): string {
  if (r.status === 0) return '';
  const why = r.error ? r.error.message : r.signal ? `killed: ${r.signal}` : `exit ${String(r.status)}`;
  const tail = r.out
    .trimEnd()
    .split('\n')
    .slice(-40)
    .map((l) => '     | ' + l.slice(0, 300))
    .join('\n');
  return `${script.file} failed (${why})\n${tail}\nRepeat it:  ${reproduceCommand(script.name)}\n`;
}

// The config's projects are the suite's levels, so every script has a project that runs it.
if (level === 'static') {
  test('every level in tests/suite.ts has a project in vitest.config.mts', ({ expect }) => {
    expect([...inject('levels')].sort()).toEqual([...LEVELS].sort());
  });
}

test.concurrent.for(scripts)('$name', { timeout: LIMIT_MS + 60_000 }, async (script, { expect }) => {
  const r = await run(script);
  expect(r.status, failure(script, r)).toBe(0);
});
