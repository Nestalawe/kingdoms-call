// The db project's setup (tests/setup/the-local-supabase.ts; plan P1-17, Decision 6) reads the local Supabase's
// address and keys from `supabase status`, and refuses any address but this machine's (127.0.0.1, localhost), so the
// access layer's tests can never reach the live or the staging database; and a status without its address or keys
// (the local Supabase not running) stops the run with the reason.
// Level 1 (unit): a function of the status it is handed; the db project runs it on the real one.
import { describe, expect, test } from 'vitest';
import { theLocalSupabasesAddressAndKeys } from '../setup/the-local-supabase.ts';

const KEYS = { ANON_KEY: 'a-local-anon-key', SERVICE_ROLE_KEY: 'a-local-service-key' };

describe("the access layer's tests take only the local Supabase's address", () => {
  test.for(['http://127.0.0.1:54321', 'http://localhost:54321'])('%s is taken, with its keys', (url) => {
    expect(theLocalSupabasesAddressAndKeys({ API_URL: url, ...KEYS })).toEqual({
      url,
      anonKey: 'a-local-anon-key',
      serviceRoleKey: 'a-local-service-key',
    });
  });

  test.for(['https://abcdefghijklmnop.supabase.co', 'http://127.0.0.2:54321', 'http://localhost.example.test:54321'])(
    '%s is refused',
    (url) => {
      expect(() => theLocalSupabasesAddressAndKeys({ API_URL: url, ...KEYS })).toThrow(
        /run only against the local Supabase/,
      );
    },
  );

  test('a status without its address or a key stops the run, saying the local Supabase may not be running', () => {
    for (const status of [KEYS, { API_URL: 'http://127.0.0.1:54321', ANON_KEY: 'a' }, {}])
      expect(() => theLocalSupabasesAddressAndKeys(status)).toThrow(/is the local Supabase running\?/);
  });
});
