// The staging deploy's logic (.github/scripts/staging.js), with no GitHub involved: the kc-config.js it writes for the
// staging site, the comments it posts on pull requests, the test accounts it signs up, and its wait for CI. Moved from
// the old script tests/staging.test.js (P1-14z), check for check.
// Level 1 (unit): the script's pure functions, and its sign-up and wait on stand-ins for the network and the clock;
// the config it writes is run in an empty vm to read its value. Static can't: it runs code.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The staging deploy's logic: the `kc-config.js` it writes (staging address only, never the live one, no stray
// characters; the pull request number and full commit it deploys, refused unless they're exactly that), its "on
// staging" / "replaced by" comments, and the test accounts (made up, on a reserved domain; signed up then signed in
// with the shared password; one that exists is skipped; a failure stops the deploy without printing the password; the
// staging seed uses only their addresses); staging goes only once CI's ci and db jobs have passed on the commit (other
// checks don't count, the newest run of a job decides, a failure stops it, the time limit gives up with a message).
// `unit/staging-waits-for-the-newest-ci-run-on-the-commit.test.ts` checks which run's jobs are read, and that no job
// yet means wait (the old script's check of that is not repeated here).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, test } from 'vitest';
import staging from '../../.github/scripts/staging.js';

const { configFile, onStagingBody, replacedBody, MARKER, TEST_ACCOUNTS, signUpTestAccounts, ciVerdict, waitForCi } =
  staging;

const STAGING_ADDRESS = 'https://yquaxxzdepqquitlgxkh.supabase.co';
const KEY = 'sb_publishable_example_key_1234567890';
const DEPLOYED = { pr: 21, sha: 'abcdef1234567890abcdef1234567890abcdef12' };
const PASSWORD = 'a-long-shared-password';

/** Whether a value is an object whose fields can be read by name. */
function isAnObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The KC_CONFIG a written kc-config.js defines, run as a page would run it, in an empty context. */
function theConfigItDefines(source: string): Record<string, unknown> {
  const context: { theConfig?: unknown } = {};
  vm.createContext(context);
  vm.runInContext(`${source}\n;globalThis.theConfig=KC_CONFIG;`, context);
  const config = context.theConfig;
  if (!isAnObject(config)) throw new Error('kc-config.js defines no KC_CONFIG object');
  return config;
}

describe('the kc-config.js written for the staging site', () => {
  test('names the staging database and says it is staging', () => {
    const config = theConfigItDefines(configFile({ url: STAGING_ADDRESS, key: KEY, deployed: DEPLOYED }));
    expect(config['env']).toBe('staging');
    expect(config['supabaseUrl']).toBe(STAGING_ADDRESS);
    expect(config['supabaseKey']).toBe(KEY);
    expect(Object.isFrozen(config)).toBe(true);
  });

  test('says which pull request and commit are deployed (P0-33)', () => {
    const config = theConfigItDefines(
      configFile({ url: STAGING_ADDRESS, key: KEY, deployed: { pr: '21', sha: DEPLOYED.sha } }),
    );
    const deployed = config['deployed'];
    if (!isAnObject(deployed)) throw new Error('KC_CONFIG.deployed is not an object');
    expect({ ...deployed }).toStrictEqual({ pr: 21, sha: DEPLOYED.sha });
    expect(Object.isFrozen(deployed)).toBe(true);
  });

  test("refuses a pull request number or commit it can't vouch for", () => {
    for (const pr of [undefined, '', 0, -3, '21a', '2.5', "21,sha:'x'"])
      expect(
        () => configFile({ url: STAGING_ADDRESS, key: KEY, deployed: { pr, sha: DEPLOYED.sha } }),
        `pr ${String(pr)}`,
      ).toThrow(/PR_NUMBER/);
    for (const sha of [undefined, '', 'abcdef1', DEPLOYED.sha.toUpperCase(), DEPLOYED.sha + '0', "abc'; alert(1); '"])
      expect(
        () => configFile({ url: STAGING_ADDRESS, key: KEY, deployed: { pr: 21, sha } }),
        `sha ${String(sha)}`,
      ).toThrow(/PR_SHA/);
    expect(() => configFile({ url: STAGING_ADDRESS, key: KEY })).toThrow(/PR_NUMBER/);
  });

  test('refuses anything that is not a Supabase project address', () => {
    expect(() => configFile({ url: 'http://yquaxxzdepqquitlgxkh.supabase.co', key: KEY, deployed: DEPLOYED })).toThrow(
      /address/,
    );
    expect(() => configFile({ url: 'https://evil.example.com', key: KEY, deployed: DEPLOYED })).toThrow(/address/);
    expect(() => configFile({ url: '', key: KEY, deployed: DEPLOYED })).toThrow(/address/);
  });

  test('refuses a missing key, or one that would break out of the string', () => {
    expect(() => configFile({ url: STAGING_ADDRESS, key: '', deployed: DEPLOYED })).toThrow(/key/);
    expect(() => configFile({ url: STAGING_ADDRESS, key: "abc'; alert(1); '", deployed: DEPLOYED })).toThrow(/key/);
  });

  test('never carries the live database', () => {
    expect(() => configFile({ url: 'https://yymsnsrpggpgmzgcfrys.supabase.co', key: KEY, deployed: DEPLOYED })).toThrow(
      /live/,
    );
  });
});

describe("staging's comments on a pull request", () => {
  test('the "on staging" comment links the site, names the commits and carries the marker', () => {
    const body: string = onStagingBody({
      pr: 21,
      sha: 'abcdef1234567',
      built: '1234567abcdef',
      site: 'https://kingdoms-call-staging.github.io/',
    });
    expect(body.startsWith(MARKER)).toBe(true);
    expect(body).toMatch(/https:\/\/kingdoms-call-staging\.github\.io\//);
    expect(body).toMatch(/abcdef1/);
    expect(body).toMatch(/1234567/);
    expect(body).toMatch(/staging database/);
    expect(body).toMatch(/rebuilt for it/);
    expect(body).toMatch(/test accounts/);
  });

  test('the "replaced" comment says which pull request took its place', () => {
    const body: string = replacedBody({ by: 22 });
    expect(body.startsWith(MARKER)).toBe(true);
    expect(body).toMatch(/#22/);
    expect(body).not.toMatch(/https:\/\/kingdoms-call-staging/);
  });
});

// ---- The test accounts (P0-33): signed up through the site's own sign-up, then signed in ----

interface ACallToTheStandInAuth {
  url: string;
  body: { email: string; password: string; data?: { display_name: string } };
  headers: Headers;
}

/** A stand-in for the staging project's sign-up: `existing` accounts answer "already exists". */
function aStandInAuth({
  existing = [],
  signInFails = [],
  signUpStatus,
}: { existing?: string[]; signInFails?: string[]; signUpStatus?: number } = {}) {
  const calls: ACallToTheStandInAuth[] = [];
  const fetchFn = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    // `as`: the body is the JSON the script itself wrote, of this shape.
    const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as ACallToTheStandInAuth['body'];
    calls.push({ url, body, headers: new Headers(init?.headers) });
    const reply = (status: number, answer: unknown): Promise<Response> =>
      Promise.resolve(new Response(JSON.stringify(answer), { status }));
    if (url.endsWith('/auth/v1/signup')) {
      if (signUpStatus !== undefined) return reply(signUpStatus, { error_code: 'unexpected_failure', msg: 'boom' });
      return existing.includes(body.email)
        ? reply(422, { error_code: 'user_already_exists', msg: 'User already registered' })
        : reply(200, { user: { id: 'u' } });
    }
    if (url.endsWith('/auth/v1/token?grant_type=password'))
      return signInFails.includes(body.email)
        ? reply(400, { error_code: 'email_not_confirmed' })
        : reply(200, { access_token: 't' });
    return reply(404, {});
  };
  return { fetchFn, calls };
}

/** The script's test accounts, each read as an address and a name. */
function theTestAccounts(): { email: string; name: string }[] {
  return TEST_ACCOUNTS.map((a: unknown) => {
    if (!isAnObject(a) || typeof a['email'] !== 'string' || typeof a['name'] !== 'string')
      throw new Error(`a test account without an address and a name: ${JSON.stringify(a)}`);
    return { email: a['email'], name: a['name'] };
  });
}

/** The test accounts' addresses. */
const theTestAccountsEmails = (): string[] => theTestAccounts().map((a) => a.email);

describe("staging's test accounts", () => {
  test('are made up: a reserved domain, and an Overlord-to-be, a GM and players', () => {
    expect(TEST_ACCOUNTS.length).toBeGreaterThanOrEqual(4);
    for (const email of theTestAccountsEmails()) expect(email).toMatch(/^[a-z0-9]+@kingdoms-call\.test$/);
    for (const who of ['overlord', 'gm', 'player1'])
      expect(
        theTestAccountsEmails().some((e) => e.startsWith(who + '@')),
        who,
      ).toBe(true);
  });

  test('each is signed up with the shared password and its name, then signed in', async () => {
    const { fetchFn, calls } = aStandInAuth();
    const done: { email: string; status: string }[] = await signUpTestAccounts({
      url: STAGING_ADDRESS,
      key: KEY,
      password: PASSWORD,
      fetchFn,
    });
    expect(done.map((a) => a.email)).toEqual(theTestAccountsEmails());
    expect(done.every((a) => a.status === 'created')).toBe(true);
    const ups = calls.filter((c) => c.url === `${STAGING_ADDRESS}/auth/v1/signup`);
    expect(ups.length).toBe(TEST_ACCOUNTS.length);
    expect(ups[0]?.headers.get('apikey')).toBe(KEY);
    expect(ups[0]?.body.password).toBe(PASSWORD);
    expect(ups[0]?.body.data?.display_name).toBe(theTestAccounts()[0]?.name);
    expect(calls.filter((c) => c.url.endsWith('grant_type=password')).length).toBe(TEST_ACCOUNTS.length);
  });

  test('an account that already exists is skipped, not an error', async () => {
    const { fetchFn } = aStandInAuth({ existing: ['gm@kingdoms-call.test'] });
    const done: { email: string; status: string }[] = await signUpTestAccounts({
      url: STAGING_ADDRESS,
      key: KEY,
      password: PASSWORD,
      fetchFn,
    });
    expect(done.find((a) => a.email === 'gm@kingdoms-call.test')?.status).toBe('existed');
  });

  test('a sign-up or sign-in that fails stops the deploy, naming the account but never the password', async () => {
    const failed = await signUpTestAccounts({
      url: STAGING_ADDRESS,
      key: KEY,
      password: PASSWORD,
      fetchFn: aStandInAuth({ signUpStatus: 500 }).fetchFn,
    }).then(
      () => new Error('the sign-up went through'),
      (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
    );
    expect(failed.message).toMatch(/overlord@kingdoms-call\.test/);
    expect(failed.message).not.toContain(PASSWORD);
    await expect(
      signUpTestAccounts({
        url: STAGING_ADDRESS,
        key: KEY,
        password: PASSWORD,
        fetchFn: aStandInAuth({ signInFails: ['player1@kingdoms-call.test'] }).fetchFn,
      }),
    ).rejects.toThrow(/player1@kingdoms-call\.test.*sign in/);
  });

  test('need the password secret, and never go to the live project', async () => {
    await expect(
      signUpTestAccounts({ url: STAGING_ADDRESS, key: KEY, password: '', fetchFn: aStandInAuth().fetchFn }),
    ).rejects.toThrow(/STAGING_TEST_PASSWORD/);
    await expect(
      signUpTestAccounts({
        url: 'https://yymsnsrpggpgmzgcfrys.supabase.co',
        key: KEY,
        password: PASSWORD,
        fetchFn: aStandInAuth().fetchFn,
      }),
    ).rejects.toThrow(/live/);
  });

  test('the staging seed finds the test accounts it uses by their real addresses', () => {
    const seed = fs.readFileSync(
      path.resolve(import.meta.dirname, '..', '..', 'supabase', 'seeds', 'staging.sql'),
      'utf8',
    );
    const used = [...seed.matchAll(/'([a-z0-9]+@kingdoms-call\.test)'/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const e of used)
      expect(theTestAccountsEmails().includes(String(e)), `${String(e)} is in the seed but not a test account`).toBe(
        true,
      );
  });
});

// ── staging publishes only a commit CI has passed ───────────────────────────────────────────

interface AJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
}
const aJob = (name: string, status: string, conclusion: string | null, id = 1): AJob => ({
  id,
  name,
  status,
  conclusion,
});
/** ciVerdict's answer for these jobs: its state, and why. */
const theVerdictOn = (jobs: AJob[]): { state: string; why: string } => ciVerdict(jobs);

describe('staging goes only once CI has passed on the commit', () => {
  test('staging waits until CI has started and finished on the commit', () => {
    // No job at all (CI not started) waiting is checked in staging-waits-for-the-newest-ci-run-on-the-commit.
    expect(
      theVerdictOn([aJob('Analyze (javascript-typescript)', 'completed', 'success')]).state,
      "other checks don't count",
    ).toBe('wait');
    expect(theVerdictOn([aJob('ci', 'in_progress', null), aJob('db', 'completed', 'success')]).state).toBe('wait');
    expect(theVerdictOn([aJob('ci', 'completed', 'success'), aJob('db', 'queued', null)]).state).toBe('wait');
  });

  test("staging goes once CI's ci and db jobs have both passed (a skipped db counts as passed)", () => {
    expect(theVerdictOn([aJob('ci', 'completed', 'success'), aJob('db', 'completed', 'success')]).state).toBe('go');
    expect(theVerdictOn([aJob('ci', 'completed', 'success'), aJob('db', 'completed', 'skipped')]).state).toBe('go');
    expect(theVerdictOn([aJob('ci', 'completed', 'success')]).state, 'a CI without a db job').toBe('go');
  });

  test('staging stops when CI failed, was cancelled or timed out, and says which job', () => {
    for (const c of ['failure', 'cancelled', 'timed_out', 'action_required']) {
      const v = theVerdictOn([aJob('ci', 'completed', 'success'), aJob('db', 'completed', c)]);
      expect(v.state, c).toBe('fail');
      expect(v.why).toMatch(new RegExp('db.*' + c));
    }
  });

  test('a re-run counts: the newest run of each job decides', () => {
    expect(theVerdictOn([aJob('ci', 'completed', 'failure', 1), aJob('ci', 'completed', 'success', 2)]).state).toBe(
      'go',
    );
    expect(theVerdictOn([aJob('ci', 'completed', 'success', 3), aJob('ci', 'in_progress', null, 4)]).state).toBe(
      'wait',
    );
  });

  test('waiting polls until CI passes, and gives up with a clear message after the time limit', async () => {
    const seq: AJob[][] = [
      [],
      [aJob('ci', 'in_progress', null)],
      [aJob('ci', 'completed', 'success'), aJob('db', 'completed', 'success')],
    ];
    let t = 0;
    let calls = 0;
    const log: string[] = [];
    await waitForCi({
      fetchRuns: () => Promise.resolve(seq[Math.min(calls++, seq.length - 1)] ?? []),
      sleep: (ms: number) => {
        t += ms;
        return Promise.resolve();
      },
      now: () => t,
      everyMs: 15000,
      log: (m: string) => log.push(m),
    });
    expect(calls).toBe(3);
    expect(log.some((m) => /passed/i.test(m))).toBe(true);
    await expect(
      waitForCi({
        fetchRuns: () => Promise.resolve([aJob('ci', 'completed', 'failure')]),
        sleep: () => Promise.resolve(),
        now: () => 0,
        log: () => undefined,
      }),
    ).rejects.toThrow(/ci.*failure/);
    t = 0;
    await expect(
      waitForCi({
        fetchRuns: () => Promise.resolve([]),
        sleep: (ms: number) => {
          t += ms;
          return Promise.resolve();
        },
        now: () => t,
        timeoutMs: 60000,
        everyMs: 15000,
        log: () => undefined,
      }),
    ).rejects.toThrow(/hasn't finished/);
  });
});
