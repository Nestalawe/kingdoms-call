// The footer under Vitest's own report: the seed the run used, and for each failed test the command that
// repeats it (tests/setup/repro.ts).
import type { Reporter, TestCase, TestModule, Vitest } from 'vitest/node';
import { reproduceCommand } from './repro.ts';

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
    if (!failed.length) return;
    log(`Repeat a failure with the same seed:`);
    for (const t of failed) log(`  ${reproduceCommand(t.fullName)}`);
  }
}
