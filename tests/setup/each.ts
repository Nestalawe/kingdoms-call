// Loaded into every test file. A test fails if it logs an error with console.error, or leaves a promise rejected
// with nobody handling it, unless it says it expects that. A test that expects console.error spies on it
// (vi.spyOn(console, 'error')); what the spy receives is the test's to check.
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

beforeEach(() => {
  problems.length = 0;
});

afterEach(() => {
  if (!problems.length) return;
  const found = problems.splice(0).join('\n');
  throw new Error(`${found}\nA test that expects this says so: vi.spyOn(console, 'error'), or handles the rejection.`);
});
