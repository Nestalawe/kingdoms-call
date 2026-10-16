// Loaded into every test file. A test fails if it is set to be retried or repeated (a retry hides a test that
// passes only on a lucky run: make it deterministic instead), or if it logs an error with console.error, or leaves
// a promise rejected with nobody handling it, unless it says it expects that. A test that expects console.error
// spies on it (vi.spyOn(console, 'error')); what the spy receives is the test's to check.
import { afterEach, beforeEach, vi } from 'vitest';

const problems: string[] = [];
const original = console.error.bind(console);

console.error = (...args: unknown[]) => {
  // Called through a test's own spy: expected, and the test checks it.
  if (!vi.isMockFunction(console.error)) problems.push('console.error: ' + args.map(String).join(' '));
  original(...args);
};

process.on('unhandledRejection', (reason) => {
  problems.push('unhandled rejection: ' + String(reason instanceof Error ? reason.stack : reason));
});

beforeEach(({ task }) => {
  problems.length = 0;
  const retry = typeof task.retry === 'number' ? task.retry : (task.retry?.count ?? 0);
  const repeats = task.repeats ?? 0;
  if (retry > 0 || repeats > 0) {
    throw new Error(
      `This test is set to be retried (${String(retry)}) or repeated (${String(repeats)}). A test must pass first ` +
        'time: restructure it so its outcome does not depend on luck (tests/README.md).',
    );
  }
});

afterEach(() => {
  if (!problems.length) return;
  const found = problems.splice(0).join('\n');
  throw new Error(`${found}\nA test that expects this says so: vi.spyOn(console, 'error'), or handles the rejection.`);
});
