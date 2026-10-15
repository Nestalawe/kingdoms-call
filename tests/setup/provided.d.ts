// What vitest.config.ts gives each project's tests through inject().
import type { Level } from '../suite.ts';

declare module 'vitest' {
  interface ProvidedContext {
    // Which test scripts tests/legacy.test.ts runs: one level's, or the quarantined ones.
    level: Level | 'quarantine';
    // Every level that has a project.
    levels: string[];
  }
}
