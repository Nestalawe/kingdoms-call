// The footer under Vitest's own report: the seed the run used, and for each failed test the command that
// repeats it (tests/setup/repro.ts). Then each test or hook that used more than half its time limit, the nearest first,
// or a line saying none did, so one creeping towards its limit on a slow runner is seen before it fails. It never fails
// a run. A test's time and limit are Vitest's own (its diagnostic's duration, which counts its beforeEach and afterEach
// hooks too, and its own limit or the default); a hook's are timed where it runs (tests/setup/hook-times.ts).
import path from 'node:path';
import type { Reporter, TestCase, TestModule, Vitest } from 'vitest/node';
import { reproduceCommand } from './repro.ts';

/** A hook's longest time in a run, and its limit, in milliseconds (tests/setup/hook-times.ts): the `index`th of the
 *  `of` hooks of its kind in its suite (its describe blocks' names from the file down; '' for the file's own). */
export interface HookTime {
  suite: string;
  hook: 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach';
  index: number;
  of: number;
  ms: number;
  limit: number;
}

declare module 'vitest' {
  interface TaskMeta {
    /** The file's hooks' times (tests/setup/hook-times.ts). */
    hookTimes?: HookTime[];
  }
}

/** A test or a hook, its time and its time limit in milliseconds (0: none). */
export interface ATimedPart {
  where: string;
  ms: number;
  limit: number;
}

const seconds = (ms: number) => `${String(Number((ms / 1000).toFixed(1)))} s`;

/** The footer's lines for `parts`: one for each that used more than half its limit, the nearest first; or one line
 *  saying none did. */
export function theLinesNearTheirLimits(parts: readonly ATimedPart[]): string[] {
  const near = parts.filter((p) => p.limit > 0 && p.ms > p.limit / 2).sort((a, b) => b.ms / b.limit - a.ms / a.limit);
  if (!near.length) return ['No test or hook used more than half its time limit.'];
  return near.map((p) => `Near its limit: ${p.where}, ${seconds(p.ms)} of ${seconds(p.limit)}`);
}

/** Every test and hook of `modules` that ran, with its time and its limit. */
function theTimedParts(modules: readonly TestModule[], root: string): ATimedPart[] {
  return modules.flatMap((m) => {
    const file = `[${m.project.name}] ${path.relative(root, m.moduleId)}`;
    const tests = [...m.children.allTests()].flatMap((t) => {
      const ran = t.diagnostic();
      return ran ? [{ where: `${file} › ${t.fullName}`, ms: ran.duration, limit: t.options.timeout ?? 0 }] : [];
    });
    const hooks = (m.meta().hookTimes ?? [])
      .filter((h) => h.ms > 0)
      .map((h) => ({
        where: [file, h.suite, h.of > 1 ? `${h.hook} ${String(h.index)} of ${String(h.of)}` : h.hook]
          .filter(Boolean)
          .join(' › '),
        ms: h.ms,
        limit: h.limit,
      }));
    return [...tests, ...hooks];
  });
}

export default class ReproFooter implements Reporter {
  private vitest: Vitest | undefined;

  onInit(vitest: Vitest): void {
    this.vitest = vitest;
  }

  onTestRunEnd(testModules: readonly TestModule[]): void {
    const log = (s: string) => {
      this.vitest?.logger.log(s);
    };
    const failed: TestCase[] = testModules.flatMap((m) => [...m.children.allTests('failed')]);
    log(`Seed ${process.env['KC_SEED'] ?? ''} · Node ${process.version}`);
    try {
      for (const line of theLinesNearTheirLimits(theTimedParts(testModules, this.vitest?.config.root ?? process.cwd())))
        log(line);
    } catch (e) {
      log(`The times near their limits couldn't be read: ${String(e)}`);
    }
    if (!failed.length) return;
    log(`Repeat a failure with the same seed:`);
    for (const t of failed) log(`  ${reproduceCommand(t.fullName)}`);
  }
}
