// Loaded into every test file first. Times each of the file's hooks where it runs, with the limit Vitest holds for it,
// for the reporter's "near its limit" lines (tests/setup/reporter.ts). Vitest's reporter API says when a suite's hooks
// start and end (onHookStart, onHookEnd: all of a suite's beforeAll hooks as one, sent in batches every 100 ms) but not
// how long each took, nor its limit. So before the file's own hooks run, each is wrapped in one that times it; the
// longest each took (a beforeEach runs once a test) goes in the file's meta, which Vitest hands the reporter.
// The limit is the one Vitest set on the hook as it was registered, its own or the default: Vitest 5's runner keeps it
// on the hook under Symbol.for('VITEST_CLEANUP_TIMEOUT'), and reads it from there. A hook without it isn't timed.
// It only measures, never fails a test; if Vitest's hooks aren't where it looks, it times nothing, and
// tests/unit/the-reporter-names-each-test-or-hook-past-half-its-time-limit.test.ts fails.
import { beforeAll, TestRunner, type RunnerTestFile, type RunnerTestSuite } from 'vitest';
import type { HookTime } from './reporter.ts';

const LIMIT = Symbol.for('VITEST_CLEANUP_TIMEOUT');

/** Each hook of `list` wrapped, in place, in one that keeps its longest time in a new entry of `times`. */
function timeEach(
  list: ((...args: never[]) => unknown)[],
  where: Omit<HookTime, 'index' | 'of' | 'ms' | 'limit'>,
  times: HookTime[],
): void {
  list.forEach((hook, i) => {
    const limit: unknown = Reflect.get(hook, LIMIT);
    if (typeof limit !== 'number') return;
    const time: HookTime = { ...where, index: i + 1, of: list.length, ms: 0, limit };
    times.push(time);
    const timed = (...args: never[]): unknown => {
      const start = performance.now();
      const done = () => {
        time.ms = Math.max(time.ms, performance.now() - start);
      };
      const result = hook(...args);
      if (result instanceof Promise) result.then(done, done);
      else done();
      return result;
    };
    // The hook's own keys (its limit among them) stay on it: the runner reads them.
    list[i] = Object.assign(timed, hook);
  });
}

const file = TestRunner.getCurrentSuite().file;

beforeAll(() => {
  const times: HookTime[] = [];
  file.meta.hookTimes = times;
  const timeTheHooksOf = (suite: RunnerTestSuite | RunnerTestFile, names: string[]) => {
    const hooks = TestRunner.getSuiteHooks(suite);
    const suiteName = names.join(' › ');
    timeEach(hooks.beforeAll, { suite: suiteName, hook: 'beforeAll' }, times);
    timeEach(hooks.afterAll, { suite: suiteName, hook: 'afterAll' }, times);
    timeEach(hooks.beforeEach, { suite: suiteName, hook: 'beforeEach' }, times);
    timeEach(hooks.afterEach, { suite: suiteName, hook: 'afterEach' }, times);
    for (const task of suite.tasks) if (task.type === 'suite') timeTheHooksOf(task, [...names, task.name]);
  };
  timeTheHooksOf(file, []);
});
