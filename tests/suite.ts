// tests/suite.ts: the test scripts npm test runs, each with its level (tests/every-test-its-level-and-what-it-checks.md says what each checks).
// tests/legacy.test.ts runs each one in its own Node process, with these arguments and environment; it passes when
// the script exits 0. A script that checks at more than one level sits at its highest. Sizes are the scripts' own
// command-line arguments; `full` (npm run test:full) gives the bigger runs. Moved here from tests/run.js (P1-01a);
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

const GM = 'kingdoms-call-gm-portal.html';

export function suite(full: boolean): Script[] {
  // [level, name, file, args, env]
  const rows: [Level, string, string, string[]?, Record<string, string>?][] = [
    ['simulation', 'turn-fuzz', 'tests/turn-fuzz.test.js', full ? ['16', '12'] : ['4', '6']],
    [
      'simulation',
      'fuzz-wages-combat',
      'tests/fuzz-wages-combat.test.js',
      full ? [GM, '6', '20', '6'] : [GM, '3', '10', '5'],
    ],
    [
      'simulation',
      'fuzz-advance-masking',
      'tests/fuzz-advance-masking.test.js',
      full ? [GM, '6', '20', '6'] : [GM, '3', '10', '5'],
    ],
  ];
  return rows.map(([level, name, file, args = [], env = {}]) => ({ level, name, file, args, env }));
}
