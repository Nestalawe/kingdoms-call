// The command that repeats one test exactly: same seed, same sizes, only that test. The reporter footer
// (tests/setup/reporter.ts) prints it for every failure, and a failing test script's error ends with it.
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function reproduceCommand(fullName: string): string {
  const seed = process.env['KC_SEED'] ?? '';
  const run =
    process.env['KC_QUARANTINE'] === '1'
      ? 'npm run test:quarantine'
      : process.env['KC_FULL'] === '1'
        ? 'npm run test:full'
        : 'npm test';
  return `KC_SEED=${seed} ${run} -- -t "^${escape(fullName)}$"`;
}
