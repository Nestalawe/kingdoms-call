// tests/suite.ts: the test scripts npm test runs, each with its level (tests/every-test-its-level-and-what-it-checks.md says what each checks).
// tests/legacy.test.ts runs each one in its own Node process, with these arguments and environment; it passes when
// the script exits 0. A script that checks at more than one level sits at its highest. Sizes are the scripts' own
// command-line arguments. No script is left: each has become a Vitest test (plan P1-14z). Moved here from tests/run.js (P1-01a);
// the scripts become Vitest tests over P1-14.

export const LEVELS = ['static', 'unit', 'scenario', 'simulation', 'page'] as const;
export type Level = (typeof LEVELS)[number];

export interface Script {
  level: Level;
  name: string;
  file: string;
  args: string[];
  env: Record<string, string>;
}

export function suite(): Script[] {
  // [level, name, file, args, env]
  const rows: [Level, string, string, string[]?, Record<string, string>?][] = [];
  return rows.map(([level, name, file, args = [], env = {}]) => ({ level, name, file, args, env }));
}
