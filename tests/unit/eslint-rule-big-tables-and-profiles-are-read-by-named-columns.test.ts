// kc/big-tables-and-profiles-are-read-by-named-columns (tools/eslint-rules/; plan P1-13, Decision 8), the rule that
// replaced tests/profiles-columns.test.js: games, game_players, turn_logs and profiles are read by named columns, never
// `*` or a bare `.select()` (every column), and profiles never with email (P0-31, ruling D-08). For each table: a `*`, a
// bare `.select()` after an insert and a `*` inside an embedded resource are refused; profiles' email too, read or
// embedded. Reads of other tables, of named columns, and of a table or columns held in a variable pass. Where the rule
// runs (src/, public/, the templates' scripts) is tests/static/harness.test.ts's and the templates' test's.
// Level 1 (unit): ESLint's RuleTester runs the rule's code on snippets, which a static test, running nothing, can't.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// `kc/big-tables-and-profiles-are-read-by-named-columns` (`tools/eslint-rules/`, P1-13c), the rule that replaced
// `profiles-columns`, run by ESLint's RuleTester: for each of `games`, `game_players`, `turn_logs` and `profiles`,
// `select('*')` (also as a template), `.select()` with no list after an insert or an upsert, and a `*` in an embedded
// resource (`games(*)`, `x:games!inner(*)`) are refused, one finding a read naming each table; `profiles`' `email` too,
// read, renamed, cast or embedded (P0-31, D-08); named columns, `email_verified_at`, other tables, and a table or
// columns held in a variable pass. Red with embedded resources not read. Level 1: the rule's code runs on snippets,
// which a static test, running nothing, can't. TypeScript, in `unit/`
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, test } from 'vitest';
import rule from '../../tools/eslint-rules/big-tables-and-profiles-are-read-by-named-columns.ts';

RuleTester.describe = describe;
RuleTester.it = test;

const tester = new RuleTester({ languageOptions: { ecmaVersion: 'latest', sourceType: 'module' } });
const TABLES = ['games', 'game_players', 'turn_logs', 'profiles'];

tester.run('kc/big-tables-and-profiles-are-read-by-named-columns', rule, {
  valid: [
    "sb.from('games').select('id, name, status').eq('id', id);",
    "sb.from('game_players').select('id,user_id,realm_name').eq('game_id', id);",
    "sb.from('turn_logs').select('turn, player_index, report').eq('game_id', id);",
    "sb.from('profiles').select('id, name, created_at');",
    "sb.from('profiles').select('id, email_verified_at');",
    "sb.from('games').select('id, game_players(id, user_id)');",
    "sb.from('games').select('id', { count: 'exact', head: true });",
    // not one of the four
    "sb.from('game_results').select('*');",
    "sb.from('game_records').insert(row).select();",
    // a table or a list of columns held in a variable isn't read
    "sb.from('games').select(GAME_COLS);",
    "sb.from(TABLE).select('*');",
    // a select that isn't a read of a table
    'input.select();',
    "sb.from('games').update({ a: 1 }).eq('id', id);",
    {
      code: "const r: unknown = await sb.from('games').select('id, name');",
      languageOptions: { parser: tseslint.parser },
    },
  ],
  invalid: [
    ...TABLES.flatMap((table) => [
      { code: `sb.from('${table}').select('*').eq('id', id);`, errors: [{ messageId: 'star' }] },
      { code: `sb.from('${table}').select(\`*\`);`, errors: [{ messageId: 'star' }] },
      { code: `sb.from('${table}').insert(row).select().single();`, errors: [{ messageId: 'bare' }] },
      { code: `sb.from('${table}').upsert(row).select();`, errors: [{ messageId: 'bare' }] },
      { code: `sb.from('game_records').select('id, ${table}(*)');`, errors: [{ messageId: 'star' }] },
      { code: `sb.from('game_records').select('id, x:${table}!inner(*)');`, errors: [{ messageId: 'star' }] },
    ]),
    // one finding a read, naming each table it reads every column of
    {
      code: "sb.from('games').select('*, game_players(*)').eq('id', id).single();",
      errors: [{ message: /every column of games and game_players/ }],
    },
    { code: "sb.from('games').select('id,name,game_state,game_players(*)');", errors: [{ messageId: 'star' }] },
    { code: "sb.from('profiles').select('id, name, email');", errors: [{ messageId: 'email' }] },
    { code: "sb.from('profiles').select('id, contact:email');", errors: [{ messageId: 'email' }] },
    { code: "sb.from('profiles').select('email::text');", errors: [{ messageId: 'email' }] },
    { code: "sb.from('game_players').select('id, profiles(name, email)');", errors: [{ messageId: 'email' }] },
    {
      code: "const r: unknown = await sb.from('turn_logs').select('*');",
      languageOptions: { parser: tseslint.parser },
      errors: [{ messageId: 'star' }],
    },
  ],
});
