// The db project's own setup (vitest.config.mts; plan P1-17, Decision 6): before the access layer's tests, it finds
// the local Supabase (`npx supabase@2.120.0 status`, the CLI pinned as everywhere else) and hands its address and keys
// to the tests (inject('theLocalSupabase')). It refuses any address but this machine's: no test reaches the live or the
// staging database, and no production key is ever read. The local keys are the CLI's own, the same on every machine.
import { execFileSync } from 'node:child_process';
import type { TestProject } from 'vitest/node';

const THE_PINNED_CLI = '2.120.0';

/** The local Supabase's address and keys, from its status; throws, with the reason, when it isn't running or the
 *  address is another machine's. */
export function theLocalSupabasesAddressAndKeys(status: Record<string, unknown>): {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
} {
  const url = status['API_URL'];
  const anonKey = status['ANON_KEY'];
  const serviceRoleKey = status['SERVICE_ROLE_KEY'];
  if (typeof url !== 'string' || typeof anonKey !== 'string' || typeof serviceRoleKey !== 'string')
    throw new Error('supabase status gave no API_URL, ANON_KEY or SERVICE_ROLE_KEY: is the local Supabase running?');
  const host = new URL(url).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost')
    throw new Error(`The access layer's tests run only against the local Supabase; this address is ${host}'s.`);
  return { url, anonKey, serviceRoleKey };
}

export default function setup(project: TestProject): void {
  let text: string;
  try {
    text = execFileSync('npx', ['--yes', `supabase@${THE_PINNED_CLI}`, 'status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    throw new Error(
      `The access layer's tests need the local Supabase running (npx supabase@${THE_PINNED_CLI} start; ` +
        `supabase/README.md): supabase status failed (${String(e)})`,
      { cause: e },
    );
  }
  const status: unknown = JSON.parse(text);
  if (typeof status !== 'object' || status === null) throw new Error('supabase status gave no object: ' + text);
  project.provide('theLocalSupabase', theLocalSupabasesAddressAndKeys({ ...status }));
}
