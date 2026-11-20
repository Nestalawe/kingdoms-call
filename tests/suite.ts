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
    ['scenario', 'meta-missing-turn', 'tests/meta-missing-turn.test.js'],
    ['simulation', 'turn-fuzz', 'tests/turn-fuzz.test.js', full ? ['16', '12'] : ['4', '6']],
    ['scenario', 'two-crowns', 'tests/two-crowns.test.js'],
    ['scenario', 'shark-waters', 'tests/shark-waters.test.js'],
    ['scenario', 'new-creatures', 'tests/new-creatures.test.js'],
    ['simulation', 'lair-province-unique', 'tests/lair-province-unique.test.js'],
    ['simulation', 'lair-effects-spread', 'tests/lair-effects-spread.test.js'],
    ['simulation', 'neutral-best-mix', 'tests/neutral-best-mix.test.js'],
    ['page', 'cast-practice-assumed', 'tests/cast-practice-assumed.test.js'],
    ['unit', 'guardian-special-odds', 'tests/guardian-special-odds.test.js'], // batch 2026-10-14
    ['simulation', 'province-pools', 'tests/province-pools.test.js', full ? ['10'] : ['4']],
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
