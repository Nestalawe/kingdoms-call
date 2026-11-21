// The staging deploy's logic (P0-13), run by .github/workflows/staging.yml.
//   node .github/scripts/staging.ts config            writes the staging kc-config.js to stdout, saying which
//                                                     pull request and commit it is (PR_NUMBER, PR_SHA)
//   node .github/scripts/staging.ts comment <prev>    posts "on staging" on this PR (naming its last commit,
//                                                     PR_SHA, and the commit built, BUILT_SHA), and marks the PR
//                                                     that was on staging before (<prev>, may be empty) as replaced
// configFile(), onStagingBody() and replacedBody() are pure, and signUpTestAccounts() takes its fetch as an
// argument; all are unit-tested in
// tests/unit/the-staging-deploy-writes-a-config-only-for-staging-signs-up-made-up-accounts-and-waits-for-ci.test.ts.
// migrations.ts (`reset staging`) signs the test accounts up after rebuilding the staging database.
//
// Plain Node runs it, with nothing installed (the workflows run no `npm ci`): erasable TypeScript only, and only
// node: imports. The answers of GitHub's API and of the staging project's sign-up are read through the guards below.
export const MARKER = '<!-- staging -->';
export const SITE = 'https://kingdoms-call-staging.github.io/';
export const LIVE_REF = 'yymsnsrpggpgmzgcfrys'; // the live project: staging must never point at it

/** A value, or the fallback when it is missing or empty (as `value || fallback` reads a string). */
export function orWhenEmpty(value: string | undefined, fallback: string): string {
  return value === undefined || value === '' ? fallback : value;
}

/** A field of a JSON answer, read as JavaScript reads `answer.name` (undefined when there is none). */
export function fieldOf(answer: unknown, name: string): unknown {
  return typeof answer === 'object' && answer !== null ? Reflect.get(answer, name) : undefined;
}

/** The first of the values that is truthy, else the last (as `a || b || c` reads them). */
export function firstTruthy(...values: unknown[]): unknown {
  return values.find((v) => Boolean(v)) ?? values.at(-1);
}

/** What a thrown value says. */
export function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// The staging project's address (variable STAGING_SUPABASE_URL), checked. Returns its project ref.
export function stagingRef(url: string | undefined): string {
  const ref = /^https:\/\/([a-z0-9]{20})\.supabase\.co$/.exec(url ?? '')?.[1];
  if (ref === undefined) throw new Error(`STAGING_SUPABASE_URL isn't a Supabase project address: ${String(url)}`);
  if (ref === LIVE_REF) throw new Error('STAGING_SUPABASE_URL names the live database; staging must use its own');
  return ref;
}

/** Which pull request and commit a staging deploy is, as the environment gives them. */
export interface ADeployed {
  pr?: string | number | undefined;
  sha?: string | undefined;
}

export function configFile({
  url,
  key,
  deployed = {},
}: {
  url: string | undefined;
  key: string | undefined;
  deployed?: ADeployed;
}): string {
  stagingRef(url);
  if (!/^[A-Za-z0-9._-]+$/.test(key ?? ''))
    throw new Error('STAGING_SUPABASE_KEY: the key is missing or has unexpected characters');
  const pr = String(deployed.pr ?? ''),
    sha = deployed.sha ?? '';
  if (!/^[1-9][0-9]{0,9}$/.test(pr)) throw new Error(`PR_NUMBER isn't a pull request number: ${pr}`);
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`PR_SHA isn't a full commit id: ${sha}`);
  return `// Kingdoms Call: which database this copy of the site talks to. STAGING: written by
// .github/workflows/staging.yml for the staging site; the live site's own copy is site/kc-config.js.
const KC_CONFIG=Object.freeze({
  env:'staging',
  supabaseUrl:'${String(url)}',
  supabaseKey:'${String(key)}',
  deployed:Object.freeze({pr:${pr},sha:'${sha}'}),
});
`;
}

// sha: the pull request's last commit, which each page's staging line names ("Staging · PR #21 · abcdef1"). built:
// the commit the build job built, GitHub's test merge of the pull request into its base (staging.yml runs on
// pull_request), which the build line of the GM portal, the player portal, the Hall of Fame and the Overlord page names.
export function onStagingBody({
  sha,
  built,
  site = SITE,
}: {
  pr?: string | number | undefined;
  sha: string | undefined;
  built: string | undefined;
  site?: string;
}): string {
  const short = (c: string | undefined) => `\`${String(c).slice(0, 7)}\``;
  return (
    `${MARKER}\n🧪 **On staging:** this pull request (commit ${short(sha)}) is live on ${site}, ` +
    `built as GitHub's merge of it into its base branch, commit ${short(built)}: each page's staging line names ` +
    `${short(sha)}, and the build line names ${short(built)}. It talks ` +
    `to the staging database (no real players), rebuilt for it: \`main\`'s migrations, then this pull ` +
    `request's own, with made-up games and the test accounts. Only one pull request is on staging at a time; ` +
    `this comment changes if another one replaces it (and staging's games and accounts start afresh).`
  );
}

export function replacedBody({ by }: { by: string | number | undefined }): string {
  return `${MARKER}\n🧪 ~~On staging~~: replaced by #${String(by)}. Add the \`staging\` label again (or push a commit) to put this one back.`;
}

/** A test account: its address and its display name. */
export interface ATestAccount {
  readonly email: string;
  readonly name: string;
}

// Staging's test accounts (P0-33): made up, on a reserved domain. Every staging deploy rebuilds the database,
// which empties its accounts, then signs these up again through the site's own sign-up (so the sign-up trigger
// gives them profiles), all with one password: the staging environment's STAGING_TEST_PASSWORD secret, never
// committed (an Overlord account will be able to delete accounts). supabase/seeds/staging.sql finds them by
// email to give them games.
export const TEST_ACCOUNTS: readonly ATestAccount[] = Object.freeze(
  [
    { email: 'overlord@kingdoms-call.test', name: 'Test Overlord' },
    { email: 'gm@kingdoms-call.test', name: 'Test GM' },
    { email: 'player1@kingdoms-call.test', name: 'Test Player 1' },
    { email: 'player2@kingdoms-call.test', name: 'Test Player 2' },
    { email: 'player3@kingdoms-call.test', name: 'Test Player 3' },
  ].map((a) => Object.freeze(a)),
);

/** The fetch signUpTestAccounts() calls: the global one, or a test's stand-in. */
export type AFetch = (url: string, init: RequestInit) => Promise<Response>;

// Signs each account up (one that already exists is skipped), then checks it signs in. Returns
// [{email, status:'created'|'existed'}]. Any other answer stops the deploy; messages never carry the password.
export async function signUpTestAccounts({
  url,
  key,
  password,
  accounts = TEST_ACCOUNTS,
  fetchFn = fetch,
}: {
  url: string | undefined;
  key: string | undefined;
  password: string | undefined;
  accounts?: readonly ATestAccount[];
  fetchFn?: AFetch;
}): Promise<{ email: string; status: 'created' | 'existed' }[]> {
  stagingRef(url);
  if (!password)
    throw new Error("The staging environment has no STAGING_TEST_PASSWORD secret, so the test accounts can't be made.");
  const post = async (p: string, body: unknown) => {
    const res = await fetchFn(`${String(url)}/auth/v1/${p}`, {
      method: 'POST',
      headers: { apikey: String(key), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let json: unknown = {};
    try {
      json = await res.json();
    } catch {
      // not JSON: the answer's status alone tells
    }
    return {
      status: res.status,
      ok: res.ok,
      code: firstTruthy(fieldOf(json, 'error_code'), fieldOf(json, 'code'), ''),
      msg: firstTruthy(fieldOf(json, 'msg'), fieldOf(json, 'message'), ''),
    };
  };
  const done: { email: string; status: 'created' | 'existed' }[] = [];
  for (const { email, name } of accounts) {
    const up = await post('signup', { email, password, data: { display_name: name } });
    let status: 'created' | 'existed' = 'created';
    if (up.status === 422 && up.code === 'user_already_exists') status = 'existed';
    else if (!up.ok)
      throw new Error(
        `Signing up the test account ${email} failed: HTTP ${String(up.status)} ${String(up.code)} ${String(up.msg)}`.trim(),
      );
    const inn = await post('token?grant_type=password', { email, password });
    if (!inn.ok)
      throw new Error(
        `The test account ${email} can't sign in (HTTP ${String(inn.status)} ${String(inn.code)}). If it existed before, its password isn't STAGING_TEST_PASSWORD; if "Confirm email" is on for staging, new accounts can't sign in until it's off.`,
      );
    done.push({ email, status });
  }
  return done;
}

async function api(url: string, token: string | undefined, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${String(token)}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${String(res.status)} for ${orWhenEmpty(init.method, 'GET')} ${url}`);
  return res.json();
}

/** A list in a JSON answer, or a stop naming what isn't one. */
function aListIn(answer: unknown, what: string): unknown[] {
  if (!Array.isArray(answer)) throw new Error(`GitHub API: ${what} isn't a list`);
  return answer;
}

/** A list in a JSON answer, none when it has none (as `list || []` reads it), or a stop naming what isn't one. */
function aListOrNoneIn(answer: unknown, what: string): unknown[] {
  return answer === undefined || answer === null ? [] : aListIn(answer, what);
}

async function upsert(root: string, token: string | undefined, number: string | undefined, body: string) {
  const comments = aListIn(await api(`${root}/issues/${String(number)}/comments?per_page=100`, token), 'the comments');
  const mine = comments.find((c) => {
    const text = fieldOf(c, 'body');
    return typeof text === 'string' && text.startsWith(MARKER);
  });
  if (mine)
    await api(`${root}/issues/comments/${String(fieldOf(mine, 'id'))}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    });
  else
    await api(`${root}/issues/${String(number)}/comments`, token, { method: 'POST', body: JSON.stringify({ body }) });
}

// ── Staging publishes only a commit CI has passed ──────────────────────────────────────────────
// The staging job doesn't run the tests itself (CI's ci and db jobs already run them on the same commit, at the
// same time); it waits for their verdict. ciVerdict reads the jobs of CI's newest run on the commit
// (newestRunsJobs): 'wait' until both have started and finished, 'go' when they passed (a skipped job counts as
// passed), 'fail' otherwise. The newest of each job decides, so a re-run counts.
const CI_JOBS = ['ci', 'db'] as const;
type ACiJobName = (typeof CI_JOBS)[number];
const isACiJobName = (name: string): name is ACiJobName => CI_JOBS.some((n) => n === name);
const PASSED: readonly (string | null)[] = ['success', 'skipped', 'neutral'];

/** A job of a CI run, as GitHub's API lists it. */
export interface AJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
}

/** ciVerdict's answer: whether staging waits, goes or stops, and why. */
export interface AVerdict {
  state: 'wait' | 'go' | 'fail';
  why: string;
}

export function ciVerdict(checkRuns: readonly (AJob | null | undefined)[] | undefined): AVerdict {
  const latest: Partial<Record<ACiJobName, AJob>> = {};
  for (const r of checkRuns ?? []) {
    if (!r || !isACiJobName(r.name)) continue;
    const before = latest[r.name];
    if (!before || r.id > before.id) latest[r.name] = r;
  }
  if (!latest.ci) return { state: 'wait', why: "CI hasn't started on this commit yet" };
  const pending = CI_JOBS.filter((n) => {
    const job = latest[n];
    return job !== undefined && job.status !== 'completed';
  });
  if (pending.length)
    return {
      state: 'wait',
      why: `waiting for CI's ${pending.join(' and ')} job${pending.length > 1 ? 's' : ''}`,
    };
  for (const n of CI_JOBS) {
    const job = latest[n];
    if (job !== undefined && !PASSED.includes(job.conclusion))
      return {
        state: 'fail',
        why: `CI's ${n} job ended "${String(job.conclusion)}" on this commit, so nothing goes on staging`,
      };
  }
  return { state: 'go', why: 'CI passed on this commit' };
}
// The jobs of CI's newest run on the commit (the highest run id), or none before CI has started. CI keeps one run
// per pull request (ci.yml's concurrency group): a new event on the pull request, such as a label added (the
// "staging" label too), cancels the run still going, whose ci job then fails. Read across every run on the commit,
// that failed ci would be the newest job named ci until the newer run's own ci starts, minutes later, and staging
// would stop on it; so only the newest run counts. A re-run keeps its run's id: jobsOf gives its newest attempt's jobs.
export async function newestRunsJobs({
  runs,
  jobsOf,
}: {
  runs: readonly ({ id: number } | null | undefined)[] | undefined;
  jobsOf: (id: number) => Promise<AJob[]>;
}): Promise<AJob[]> {
  let newest: { id: number } | null = null;
  for (const r of runs ?? []) if (r && (!newest || r.id > newest.id)) newest = r;
  return newest ? jobsOf(newest.id) : [];
}
// Polls ciVerdict until CI has passed (returns), failed (throws), or the time limit runs out (throws).
export async function waitForCi({
  fetchRuns,
  sleep = (ms: number) =>
    new Promise<void>((r) => {
      setTimeout(r, ms);
    }),
  now = () => Date.now(),
  timeoutMs = 20 * 60 * 1000,
  everyMs = 15000,
  log = (line: string) => {
    console.log(line);
  },
}: {
  fetchRuns: () => Promise<readonly (AJob | null | undefined)[] | undefined>;
  sleep?: (ms: number) => Promise<unknown>;
  now?: () => number;
  timeoutMs?: number;
  everyMs?: number;
  log?: (line: string) => unknown;
}): Promise<AVerdict> {
  const t0 = now();
  let last: string | null = null;
  for (;;) {
    const v = ciVerdict(await fetchRuns());
    if (v.why !== last) {
      log(v.why);
      last = v.why;
    }
    if (v.state === 'go') return v;
    if (v.state === 'fail') throw new Error(v.why);
    if (now() - t0 >= timeoutMs)
      throw new Error(
        `CI hasn't finished on this commit in ${String(Math.round(timeoutMs / 60000))} minutes, so nothing goes on staging; re-run the staging job once it has`,
      );
    await sleep(everyMs);
  }
}

/** A job as GitHub's API lists it, or a stop naming what isn't one. */
function aJobIn(answer: unknown): AJob {
  const id = fieldOf(answer, 'id'),
    name = fieldOf(answer, 'name'),
    status = fieldOf(answer, 'status'),
    conclusion = fieldOf(answer, 'conclusion');
  if (
    typeof id !== 'number' ||
    typeof name !== 'string' ||
    typeof status !== 'string' ||
    (typeof conclusion !== 'string' && conclusion !== null)
  )
    throw new Error(`GitHub API: a job without an id, a name, a status and a conclusion: ${JSON.stringify(answer)}`);
  return { id, name, status, conclusion };
}

/** A run as GitHub's API lists it (its id), or a stop naming what isn't one. */
function aRunIn(answer: unknown): { id: number } {
  const id = fieldOf(answer, 'id');
  if (typeof id !== 'number') throw new Error(`GitHub API: a run without an id: ${JSON.stringify(answer)}`);
  return { id };
}

async function main() {
  const [cmd, prev] = process.argv.slice(2);
  const env = process.env;
  if (cmd === 'config') {
    const { STAGING_SUPABASE_URL: url, STAGING_SUPABASE_KEY: key, PR_NUMBER: pr, PR_SHA: sha } = env;
    process.stdout.write(configFile({ url, key, deployed: { pr, sha } }));
    return;
  }
  if (cmd === 'comment') {
    const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, PR_NUMBER: pr, PR_SHA: sha, BUILT_SHA: built } = env;
    for (const [name, c] of [
      ['PR_SHA', sha],
      ['BUILT_SHA', built],
    ] as const)
      if (!/^[0-9a-f]{40}$/.test(c ?? '')) throw new Error(`comment needs ${name}, a full commit id`);
    const root = `${orWhenEmpty(env['GITHUB_API_URL'], 'https://api.github.com')}/repos/${String(repo)}`;
    await upsert(root, token, pr, onStagingBody({ pr, sha, built }));
    if (prev && prev !== String(pr)) await upsert(root, token, prev, replacedBody({ by: pr }));
    return;
  }
  if (cmd === 'wait-ci') {
    const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, PR_SHA: sha } = env;
    if (!/^[0-9a-f]{40}$/.test(sha ?? '')) throw new Error("wait-ci needs PR_SHA, the commit's full hash");
    const root = `${orWhenEmpty(env['GITHUB_API_URL'], 'https://api.github.com')}/repos/${String(repo)}`;
    await waitForCi({
      fetchRuns: async () =>
        newestRunsJobs({
          runs: aListOrNoneIn(
            fieldOf(
              await api(
                `${root}/actions/workflows/ci.yml/runs?head_sha=${String(sha)}&event=pull_request&per_page=100`,
                token,
              ),
              'workflow_runs',
            ),
            'the workflow runs',
          ).map(aRunIn),
          jobsOf: async (id) =>
            aListOrNoneIn(
              fieldOf(await api(`${root}/actions/runs/${String(id)}/jobs?per_page=100`, token), 'jobs'),
              'the jobs',
            ).map(aJobIn),
        }),
    });
    return;
  }
  throw new Error('usage: staging.ts config | comment <previous-pr> | wait-ci');
}

if (import.meta.main)
  main().catch((e: unknown) => {
    console.error(`::error title=staging::${messageOf(e)}`);
    process.exitCode = 1;
  });
