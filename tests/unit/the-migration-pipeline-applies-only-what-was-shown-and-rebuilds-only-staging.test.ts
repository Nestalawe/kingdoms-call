// The migration pipeline's logic (.github/scripts/migrations.ts), with no database or GitHub involved: which changes to
// supabase/migrations/ are allowed, what each database gets, what is shown before production is approved, and the
// staging rebuild. Moved from the old script tests/migrations.test.js (P1-14z), check for check.
// Level 1 (unit): the script's pure functions on made-up lists, and its staging rebuild run against a stand-in Supabase
// CLI in a temporary folder (a made-up database address; nothing is reached). Static can't: it runs code.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The migration pipeline's logic: a merged migration never changes and new ones are named and ordered; a pull request
// never changes both the database and the site (the database's generated types go with it); each database gets only the
// migrations the approving maintainer was shown (anything else is refused); a database that predates the pipeline has its
// baseline recorded, never run; an empty one is refused; the summary the maintainer reads (production, then the site: staging
// isn't migrated on a merge); a failed CLI call never prints the database password; a staging rebuild (`reset staging`)
// refuses any target but staging, the live project however it's named, and any database that isn't the staging project;
// a connection failure says the free project may have paused; its summary; and the whole rebuild run against a stand-in
// CLI giving the real CLI's answers (JSON, except `DO` for the seed), every step in order
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import * as migrations from '../../.github/scripts/migrations.ts';

const { parseNameStatus, classify, mixedChange, planSummary, cliError, resetGuard, connectHint, resetSummary, reset } =
  migrations;
// The test names some functions' arguments and answers here (`as`: the function is the script's own, called as the
// script's callers call it). The script's own types would do (KD-421).
const decide = migrations.decide as (arg: {
  list: { local: string; remote: string; time: string }[];
  expected: string[];
  hasGames?: boolean | undefined;
  bootstrapped?: boolean;
}) => ADecision;
const applySummary = migrations.applySummary as (arg: {
  target: string;
  decision: ADecision;
  applied?: string[];
  bootstrapped?: string;
}) => string;
const scrub = migrations.scrub as (text: string, url: string) => string;
const migrationKind = migrations.migrationKind as (sql: string) => { kind: string; reasons: string[] };

interface ADecision {
  action: string;
  pending?: string[];
  version?: string;
  reason?: string;
}

const D = 'supabase/migrations/';
const BASE = '20261010054853';
const NEXT = '20261012000000';
const LATER = '20261013000000';
const existing = [`${D}${BASE}_baseline.sql`];
/** One line of `supabase migration list`: the version here, and the version the database has. */
const m = (local: string, remote: string) => ({ local, remote, time: '' });

interface WhatAChangeDoes {
  added: string[];
  removed: string[];
  problems: string[];
}
/** classify's answer: the migrations added and removed, and the problems found. */
const whatTheChangesDo = (...args: Parameters<typeof classify>): WhatAChangeDoes => classify(...args);

describe('which changes to supabase/migrations/ a pull request may make', () => {
  test('the name-status list from git is read, renames included', () => {
    expect(parseNameStatus(`A\t${D}${NEXT}_x.sql\nM\t${D}${BASE}_baseline.sql\nR100\t${D}a.sql\t${D}b.sql\n`)).toEqual([
      { status: 'A', file: `${D}${NEXT}_x.sql` },
      { status: 'M', file: `${D}${BASE}_baseline.sql` },
      { status: 'R', from: `${D}a.sql`, file: `${D}b.sql` },
    ]);
  });

  test('a new, well-named, newer migration is accepted', () => {
    const r = whatTheChangesDo(
      [
        { status: 'A', file: `${D}${LATER}_b.sql` },
        { status: 'A', file: `${D}${NEXT}_a.sql` },
      ],
      existing,
    );
    expect(r.problems).toEqual([]);
    expect(r.added).toEqual([`${D}${NEXT}_a.sql`, `${D}${LATER}_b.sql`]);
  });

  test('a merged migration can never be edited, deleted or renamed', () => {
    for (const status of ['M', 'D', 'R']) {
      const r = whatTheChangesDo(
        [{ status, file: `${D}${BASE}_baseline.sql`, from: status === 'R' ? `${D}${BASE}_baseline.sql` : undefined }],
        existing,
      );
      expect(r.problems.length, status).toBe(1);
      expect(r.problems[0]).toMatch(/never change/);
    }
  });

  test('on a pull request, deleting a merged migration is allowed (one production rejected), but editing is not', () => {
    const del = whatTheChangesDo([{ status: 'D', file: `${D}${BASE}_baseline.sql` }], existing, { allowDelete: true });
    expect([del.problems, del.removed]).toEqual([[], [`${D}${BASE}_baseline.sql`]]);
    expect(
      whatTheChangesDo([{ status: 'M', file: `${D}${BASE}_baseline.sql` }], existing, { allowDelete: true }).problems
        .length,
    ).toBe(1);
  });

  test('a new migration must be named <timestamp>_<name>.sql', () => {
    for (const name of ['fix.sql', '2026101200_short.sql', `${NEXT}_Has-Caps.sql`, `${NEXT}_x.txt`])
      expect(whatTheChangesDo([{ status: 'A', file: D + name }], existing).problems[0] ?? '', name).toMatch(/name it/);
  });

  test('a new migration must sort after every merged one, and not reuse a version', () => {
    expect(whatTheChangesDo([{ status: 'A', file: `${D}20261001000000_old.sql` }], existing).problems[0]).toMatch(
      /sorts before/,
    );
    expect(whatTheChangesDo([{ status: 'A', file: `${D}${BASE}_again.sql` }], existing).problems[0]).toMatch(
      /already used/,
    );
    expect(
      whatTheChangesDo(
        [
          { status: 'A', file: `${D}${NEXT}_a.sql` },
          { status: 'A', file: `${D}${NEXT}_b.sql` },
        ],
        existing,
      ).problems[0],
    ).toMatch(/already used/);
  });

  test('a pull request changes the database or the site, never both', () => {
    const mig = `${D}${NEXT}_banners.sql`;
    expect(
      mixedChange([mig, 'supabase/schemas/public/tables/games.sql', 'supabase/tests/database/01_games.test.sql']),
    ).toBe(null);
    expect(mixedChange(['src/engine/run-turn.ts', 'tests/gm-messaging-boot.test.js'])).toBe(null);
    expect(mixedChange(['supabase/README.md', 'src/engine/run-turn.ts']), 'docs about the database are fine').toBe(
      null,
    );
    const msg = mixedChange([mig, 'src/engine/run-turn.ts', 'src/ui/player/map.ts']);
    expect(msg).toMatch(/1 migration file\) and the site \(2 files\)/);
    expect(msg).toMatch(/Split it in two: first the database change/);
    expect(msg).toMatch(/supabase\/README\.md#database-and-site-changes-go-separately/);
  });

  test('a database pull request may carry the types generated from it, and no other site file', () => {
    const mig = `${D}${NEXT}_banners.sql`;
    expect(mixedChange([mig, 'src/db/database.types.ts'])).toBe(null);
    const msg = mixedChange([mig, 'src/db/database.types.ts', 'src/engine/run-turn.ts']);
    expect(msg).toMatch(/1 migration file\) and the site \(1 file\)/);
    expect(mixedChange([mig, 'src/db/other.types.ts']), 'only that one file, by its exact path').toMatch(
      /the site \(1 file\)/,
    );
  });
});

describe('what each database gets', () => {
  test('pending migrations the maintainer was shown are applied', () => {
    expect(decide({ list: [m(BASE, BASE), m(NEXT, '')], expected: [NEXT] })).toEqual({
      action: 'apply',
      pending: [NEXT],
    });
  });

  test('an up-to-date database gets nothing (e.g. staging after a pull request was tried on it)', () => {
    expect(decide({ list: [m(BASE, BASE), m(NEXT, NEXT)], expected: [NEXT] })).toEqual({ action: 'nothing' });
  });

  test('a pending migration the maintainer was not shown is refused, so nothing unseen is applied', () => {
    const d = decide({ list: [m(BASE, BASE), m(NEXT, ''), m(LATER, '')], expected: [LATER] });
    expect(d.action).toBe('refuse');
    expect(d.reason).toMatch(new RegExp(NEXT));
  });

  test('a database with migrations the repo lacks is refused', () => {
    const d = decide({ list: [m(BASE, BASE), m('', NEXT)], expected: [] });
    expect(d.action).toBe('refuse');
    expect(d.reason).toMatch(/by hand/);
  });

  test('a database that predates the pipeline has its baseline recorded, never run', () => {
    // Production today: the game's tables exist, but there's no migration history.
    const d = decide({ list: [m(BASE, ''), m(NEXT, '')], expected: [BASE, NEXT], hasGames: true });
    expect(d).toEqual({ action: 'bootstrap', version: BASE });
    // Even when every migration counts as new (the live commit couldn't be found), the baseline isn't applied.
    expect(decide({ list: [m(BASE, ''), m(NEXT, '')], expected: [BASE, NEXT], hasGames: true }).action).not.toBe(
      'apply',
    );
  });

  test("an empty database, or a bootstrap that didn't take, is refused", () => {
    for (const hasGames of [false, undefined])
      expect(decide({ list: [m(BASE, '')], expected: [BASE], hasGames }).action).toBe('refuse');
    expect(decide({ list: [m(BASE, '')], expected: [BASE], hasGames: true, bootstrapped: true }).action).toBe('refuse');
  });
});

describe('what the approving maintainer is shown, and what each database reports', () => {
  test("the maintainer's summary lists each migration, its pull request, its kind, the order and the SQL", () => {
    const s: string = planSummary({
      live: 'a'.repeat(40),
      head: 'b'.repeat(40),
      migrations: [
        { file: `${D}${NEXT}_tighten.sql`, pr: 31, sql: 'revoke all on public.x from anon;\n-- ```fence```' },
      ],
    });
    expect(s).toMatch(new RegExp(`${NEXT}_tighten\\.sql\` from #31`));
    expect(s).toMatch(/production once Toby approves it, then the site/);
    expect(s, 'staging is no longer migrated on merge (P0-33)').not.toMatch(/staging first/);
    expect(s).toMatch(/rules only/);
    expect(s).toMatch(/No migration here changes or removes data/);
    expect(s).not.toMatch(/daily backup|copy of the database first/);
    expect(s).toMatch(/revoke all on public\.x from anon;/);
    expect(s.match(/```/g)?.length, "the SQL can't close its own code block").toBe(2);
  });

  test("a migration that changes or removes data is flagged at the top of the maintainer's summary, and named", () => {
    const s: string = planSummary({
      live: 'a'.repeat(40),
      head: 'b'.repeat(40),
      migrations: [
        { file: `${D}${NEXT}_tighten.sql`, pr: 31, sql: 'revoke all on public.x from anon;' },
        { file: `${D}${LATER}_tidy.sql`, pr: 32, sql: 'alter table public.games drop column old_meta;' },
      ],
    });
    const warn = s.indexOf('changes or removes data');
    const first = s.indexOf(`${NEXT}_tighten`);
    expect(warn >= 0 && warn < first, 'the warning comes before the list').toBe(true);
    expect(s).toMatch(new RegExp(`${LATER}_tidy\\.sql\` from #32[^\\n]*changes or removes data[^\\n]*drop column`));
    expect(s).toMatch(/copy of the database first/);
  });

  test('with no migrations, the summary says the site deploys straight away', () => {
    const s: string = planSummary({ live: 'a'.repeat(40), head: 'b'.repeat(40), migrations: [] });
    expect(s).toMatch(/No database changes/);
    expect(s).not.toMatch(/rules only|changes or removes data/);
  });

  test("each migration's kind: rules only, adds rows, or changes or removes data", () => {
    const k = (sql: string): string => migrationKind(sql).kind;
    // rules only: policies, grants, functions, indexes, comments; words in names, comments and strings don't count
    expect(
      k(`create policy "p" on public.x for delete to authenticated using (true);
    grant delete, insert, update on table public.x to authenticated;
    alter table public.x add constraint x_fk foreign key (a) references public.y(id) on delete cascade;
    create unique index x_one on public.x using btree (a, b);
    comment on table public.x is 'delete from here? update x set nothing; insert into';
    -- delete from public.x; drop table public.x
    create policy "insert into, update set: just a name" on public.x for insert with check (true);`),
    ).toBe('rules');
    // a function's body doesn't run when the migration does
    expect(
      k(`create or replace function public.f() returns void language plpgsql as $function$
    begin delete from public.game_masters where user_id = auth.uid(); update public.x set a = 1; end
    $function$;`),
    ).toBe('rules');
    // a DO block does
    expect(k(`do $$ begin if exists (select 1 from public.x) then raise exception 'stop'; end if; end $$;`)).toBe(
      'rules',
    );
    expect(k(`do $$ begin delete from public.x where a is null; end $$;`)).toBe('changes');
    expect(
      k(`insert into public.game_masters (user_id) select gm_user_id from public.games on conflict do nothing;`),
    ).toBe('adds');
    for (const sql of [
      'update public.games set meta = null;',
      'UPDATE "public"."games" SET "meta" = NULL;',
      'delete from public.turn_logs where turn < 3;',
      'truncate public.turn_events;',
      'drop table public.old_things;',
      'alter table public.games drop column meta;',
      'alter table "public"."games" alter column "turn" type bigint;',
    ])
      expect(k(sql), sql).toBe('changes');
    expect(migrationKind('alter table public.games drop column meta; delete from public.x;').reasons).toEqual([
      'delete from',
      'drop column',
    ]);
    expect(
      k(
        'grant delete, insert, maintain, references, select, trigger, truncate, update on table public.x to service_role;',
      ),
      "truncate as a privilege isn't a truncate",
    ).toBe('rules');
  });

  test('every migration in the repo is sorted as expected', () => {
    const dir = path.resolve(import.meta.dirname, '..', '..', 'supabase', 'migrations');
    const kinds = Object.fromEntries(
      fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.sql'))
        .map((f) => [
          f.replace(/^\d{14}_|\.sql$/g, ''),
          migrationKind(fs.readFileSync(path.join(dir, f), 'utf8')).kind,
        ]),
    );
    expect(Object.keys(kinds).length, 'the migrations were read').toBeGreaterThan(0);
    expect(kinds['game_masters_backfill'], 'the Game Master data step adds rows').toBe('adds');
    expect(kinds['game_masters'], 'functions that delete and update, but only when called').toBe('rules');
    const theRest = Object.entries(kinds).filter(([name]) => !['baseline', 'game_masters_backfill'].includes(name));
    for (const [name, kind] of theRest) expect(kind, name).toBe('rules');
  });

  test("each database's summary says what happened", () => {
    expect(
      applySummary({ target: 'production', decision: { action: 'apply', pending: [NEXT] }, applied: [NEXT] }),
    ).toMatch(new RegExp(`Production database[\\s\\S]*Applied[\\s\\S]*${NEXT}`));
    expect(applySummary({ target: 'staging', decision: { action: 'nothing' } })).toMatch(/up to date/);
    expect(
      applySummary({ target: 'production', decision: { action: 'refuse', reason: 'because' }, bootstrapped: BASE }),
    ).toMatch(new RegExp(`${BASE}\` was recorded[\\s\\S]*Nothing applied:\\*\\* because`));
  });

  test('a failed CLI call is reported by its own message, never with the database password', () => {
    const url = 'postgresql://postgres.abc:p%40ss%2Fword@aws-0-eu.pooler.supabase.com:5432/postgres';
    const out = JSON.stringify({
      _tag: 'Error',
      error: { message: `failed to connect to ${url} (password p@ss/word, p%40ss%2Fword)` },
    });
    const msg: string = scrub(cliError(out), url);
    expect(msg).toMatch(/failed to connect/);
    expect(msg).not.toMatch(/p@ss|p%40ss|pooler/);
    expect(cliError('not json')).toBe('no message');
  });
});

// ---- Staging follows the pull request (P0-33): `reset staging` rebuilds the staging database ----

const STAGING_REF = 'yquaxxzdepqquitlgxkh';
const LIVE = 'yymsnsrpggpgmzgcfrys';
const STAGING_URL = `https://${STAGING_REF}.supabase.co`;
const pooler = (ref: string) => `postgresql://postgres.${ref}:pw@aws-0-eu-west-2.pooler.supabase.com:5432/postgres`;
const direct = (ref: string) => `postgresql://postgres:pw@db.${ref}.supabase.co:5432/postgres`;

describe('a staging rebuild (`reset staging`)', () => {
  test('rebuilds only the staging database, named by its own address', () => {
    expect(resetGuard({ target: 'staging', dbUrl: pooler(STAGING_REF), stagingUrl: STAGING_URL })).toBe(STAGING_REF);
    expect(resetGuard({ target: 'staging', dbUrl: direct(STAGING_REF), stagingUrl: STAGING_URL })).toBe(STAGING_REF);
  });

  test('refuses any target but staging', () => {
    for (const target of ['production', 'live', '', undefined])
      expect(() => resetGuard({ target, dbUrl: pooler(STAGING_REF), stagingUrl: STAGING_URL }), String(target)).toThrow(
        /only.*staging/,
      );
  });

  test('refuses the live database, however it is named', () => {
    expect(() => resetGuard({ target: 'staging', dbUrl: pooler(LIVE), stagingUrl: STAGING_URL })).toThrow(/live/);
    expect(() => resetGuard({ target: 'staging', dbUrl: direct(LIVE), stagingUrl: STAGING_URL })).toThrow(/live/);
    expect(() =>
      resetGuard({ target: 'staging', dbUrl: pooler(LIVE), stagingUrl: `https://${LIVE}.supabase.co` }),
    ).toThrow(/live/);
  });

  test("refuses a database that isn't the staging project, or no address at all", () => {
    expect(() =>
      resetGuard({ target: 'staging', dbUrl: pooler('abcdefghijklmnopqrst'), stagingUrl: STAGING_URL }),
    ).toThrow(/isn't the staging project/);
    expect(() =>
      resetGuard({
        target: 'staging',
        dbUrl: `postgresql://postgres:pw@localhost:5432/postgres?x=${STAGING_REF}`,
        stagingUrl: STAGING_URL,
      }),
    ).toThrow(/isn't the staging project/);
    expect(() => resetGuard({ target: 'staging', dbUrl: '', stagingUrl: STAGING_URL })).toThrow(/STAGING_DB_URL/);
    expect(() => resetGuard({ target: 'staging', dbUrl: pooler(STAGING_REF), stagingUrl: '' })).toThrow(
      /STAGING_SUPABASE_URL/,
    );
  });

  test('a connection failure says the free staging project may have paused', () => {
    for (const msg of [
      'failed to connect to postgres: dial tcp: i/o timeout',
      'FATAL: Tenant or user not found',
      'connection refused',
    ])
      expect(connectHint(msg), msg).toMatch(/paused/);
    expect(connectHint('syntax error at or near "x"')).toBe('syntax error at or near "x"');
  });

  test("its summary names the base, the pull request's migrations and the test accounts", () => {
    const s: string = resetSummary({
      base: 'c'.repeat(40),
      added: [NEXT],
      accounts: ['gm@kingdoms-call.test', 'player1@kingdoms-call.test'],
      seeds: 2,
    });
    expect(s).toMatch(/Staging database/);
    expect(s).toMatch(/`ccccccc`/);
    expect(s).toMatch(new RegExp(`- \`${NEXT}\``));
    expect(s).toMatch(/gm@kingdoms-call\.test/);
    expect(s).toMatch(/STAGING_TEST_PASSWORD/);
    expect(resetSummary({ base: 'c'.repeat(40), added: [], accounts: [], seeds: 1 })).toMatch(/adds no migrations/);
  });

  // `reset staging` end to end, against a stand-in Supabase CLI (SUPABASE_CLI) that answers as CLI 2.120.0 did on
  // staging: JSON for reset, push and migration list, but only the command tag (`DO`) for the seed, which is one
  // DO block. On 2026-10-11 the first real run stopped at the seed: every CLI answer was parsed as JSON.
  test("runs every step, in order, with the CLI's real answers", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-reset-'));
    try {
      const log = path.join(tmp, 'calls.log');
      const cliPath = path.join(tmp, 'supabase');
      fs.writeFileSync(
        cliPath,
        `#!/usr/bin/env node
const a=process.argv.slice(2), fs=require('fs');
fs.appendFileSync(${JSON.stringify(log)},a.filter(x=>!/^postgresql:/.test(x)).join(' ')+'\\n');
const has=w=>a.join(' ').startsWith(w);
if(has('db reset')) console.log(JSON.stringify({target:'remote',version:'',message:'Reset remote database.'}));
else if(has('db query')) console.log('DO');
else if(has('db push --dry-run')) console.log(JSON.stringify({upToDate:false,dryRun:true,migrations:['${NEXT}_x.sql'],seeds:[],roles:[]}));
else if(has('db push')) console.log(JSON.stringify({upToDate:false,dryRun:false,migrations:['${NEXT}_x.sql'],seeds:[],roles:[]}));
else if(has('migration list')) console.log(JSON.stringify({migrations:[{local:'${BASE}',remote:'${BASE}'},{local:'${NEXT}',remote:'${NEXT}'}]}));
else process.exit(9);
`,
        { mode: 0o755 },
      );
      const main = path.join(tmp, 'main');
      fs.mkdirSync(path.join(main, 'supabase', 'migrations'), { recursive: true });
      fs.mkdirSync(path.join(main, 'supabase', 'seeds'));
      fs.writeFileSync(path.join(main, 'supabase', 'seeds', 'staging.sql'), 'DO $$ BEGIN END $$;\n');
      execFileSync('git', ['init', '-q', main]);
      execFileSync('git', [
        '-C',
        main,
        '-c',
        'user.name=t',
        '-c',
        'user.email=t@t',
        'commit',
        '-q',
        '--allow-empty',
        '-m',
        'main',
      ]);
      for (const [name, value] of Object.entries({
        SUPABASE_CLI: cliPath,
        MAIN_DIR: main,
        DB_URL: pooler(STAGING_REF),
        STAGING_SUPABASE_URL: STAGING_URL,
        STAGING_SUPABASE_KEY: 'sb_publishable_example_key_1234567890',
        STAGING_TEST_PASSWORD: 'a-long-shared-password',
        GITHUB_STEP_SUMMARY: path.join(tmp, 'summary.md'),
      }))
        vi.stubEnv(name, value);
      vi.stubGlobal('fetch', () => Promise.resolve(new Response('{}', { status: 200 })));
      vi.spyOn(console, 'log').mockImplementation(() => undefined);
      try {
        await reset('staging');
      } finally {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
      }
      const calls = fs
        .readFileSync(log, 'utf8')
        .trim()
        .split('\n')
        .map((l) => l.split(' ').slice(0, 2).join(' '));
      expect(calls).toEqual(['db reset', 'db query', 'db push', 'db push', 'migration list', 'db query']);
      expect(fs.readFileSync(path.join(tmp, 'summary.md'), 'utf8')).toMatch(
        new RegExp(`Staging database[\\s\\S]*${NEXT}[\\s\\S]*Seed runs: 2`),
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
