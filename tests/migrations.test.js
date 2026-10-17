// Unit tests for the migration pipeline's logic (.github/scripts/migrations.js), with no database or GitHub
// involved: which changes to supabase/migrations/ are allowed, what each database gets, and what Toby is shown
// before approving production.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseNameStatus,classify,mixedChange,decide,planSummary,applySummary,cliError,scrub,migrationKind,resetGuard,connectHint,resetSummary}=require('../.github/scripts/migrations.js');
const fs=require('fs'), path=require('path');

const D='supabase/migrations/';
const BASE='20261010054853', NEXT='20261012000000', LATER='20261013000000';
const existing=[`${D}${BASE}_baseline.sql`];
const m=(local,remote)=>({local,remote,time:''});

test('the name-status list from git is read, renames included',()=>{
  assert.deepEqual(parseNameStatus(`A\t${D}${NEXT}_x.sql\nM\t${D}${BASE}_baseline.sql\nR100\t${D}a.sql\t${D}b.sql\n`),[
    {status:'A',file:`${D}${NEXT}_x.sql`},
    {status:'M',file:`${D}${BASE}_baseline.sql`},
    {status:'R',from:`${D}a.sql`,file:`${D}b.sql`},
  ]);
});

test('a new, well-named, newer migration is accepted',()=>{
  const r=classify([{status:'A',file:`${D}${LATER}_b.sql`},{status:'A',file:`${D}${NEXT}_a.sql`}],existing);
  assert.deepEqual(r.problems,[]);
  assert.deepEqual(r.added,[`${D}${NEXT}_a.sql`,`${D}${LATER}_b.sql`]);
});

test('a merged migration can never be edited, deleted or renamed',()=>{
  for(const status of ['M','D','R']){
    const r=classify([{status,file:`${D}${BASE}_baseline.sql`,from:status==='R'?`${D}${BASE}_baseline.sql`:undefined}],existing);
    assert.equal(r.problems.length,1,status);
    assert.match(r.problems[0],/never change/);
  }
});

test('on a pull request, deleting a merged migration is allowed (one production rejected), but editing is not',()=>{
  const del=classify([{status:'D',file:`${D}${BASE}_baseline.sql`}],existing,{allowDelete:true});
  assert.deepEqual([del.problems,del.removed],[[],[`${D}${BASE}_baseline.sql`]]);
  assert.equal(classify([{status:'M',file:`${D}${BASE}_baseline.sql`}],existing,{allowDelete:true}).problems.length,1);
});

test('a new migration must be named <timestamp>_<name>.sql',()=>{
  for(const name of ['fix.sql','2026101200_short.sql',`${NEXT}_Has-Caps.sql`,`${NEXT}_x.txt`])
    assert.match(classify([{status:'A',file:D+name}],existing).problems[0]||'',/name it/,name);
});

test('a new migration must sort after every merged one, and not reuse a version',()=>{
  assert.match(classify([{status:'A',file:`${D}20261001000000_old.sql`}],existing).problems[0],/sorts before/);
  assert.match(classify([{status:'A',file:`${D}${BASE}_again.sql`}],existing).problems[0],/already used/);
  assert.match(classify([{status:'A',file:`${D}${NEXT}_a.sql`},{status:'A',file:`${D}${NEXT}_b.sql`}],existing).problems[0],/already used/);
});

test('pending migrations Toby was shown are applied',()=>{
  assert.deepEqual(decide({list:[m(BASE,BASE),m(NEXT,'')],expected:[NEXT]}),{action:'apply',pending:[NEXT]});
});

test('an up-to-date database gets nothing (e.g. staging after a pull request was tried on it)',()=>{
  assert.deepEqual(decide({list:[m(BASE,BASE),m(NEXT,NEXT)],expected:[NEXT]}),{action:'nothing'});
});

test('a pending migration Toby was not shown is refused, so nothing he didn\'t see is applied',()=>{
  const d=decide({list:[m(BASE,BASE),m(NEXT,''),m(LATER,'')],expected:[LATER]});
  assert.equal(d.action,'refuse');
  assert.match(d.reason,new RegExp(NEXT));
});

test('a database with migrations the repo lacks is refused',()=>{
  const d=decide({list:[m(BASE,BASE),m('',NEXT)],expected:[]});
  assert.equal(d.action,'refuse');
  assert.match(d.reason,/by hand/);
});

test('a database that predates the pipeline has its baseline recorded, never run',()=>{
  // Production today: the game's tables exist, but there's no migration history.
  const d=decide({list:[m(BASE,''),m(NEXT,'')],expected:[BASE,NEXT],hasGames:true});
  assert.deepEqual(d,{action:'bootstrap',version:BASE});
  // Even when every migration counts as new (the live commit couldn't be found), the baseline isn't applied.
  assert.notEqual(decide({list:[m(BASE,''),m(NEXT,'')],expected:[BASE,NEXT],hasGames:true}).action,'apply');
});

test('an empty database, or a bootstrap that didn\'t take, is refused',()=>{
  for(const hasGames of [false,undefined])
    assert.equal(decide({list:[m(BASE,'')],expected:[BASE],hasGames}).action,'refuse');
  assert.equal(decide({list:[m(BASE,'')],expected:[BASE],hasGames:true,bootstrapped:true}).action,'refuse');
});

test('Toby\'s summary lists each migration, its pull request, its kind, the order and the SQL',()=>{
  const s=planSummary({live:'a'.repeat(40),head:'b'.repeat(40),migrations:[
    {file:`${D}${NEXT}_tighten.sql`,pr:31,sql:'revoke all on public.x from anon;\n-- ```fence```'},
  ]});
  assert.match(s,new RegExp(`${NEXT}_tighten\\.sql\` from #31`));
  assert.match(s,/production once Toby approves it, then the site/);
  assert.doesNotMatch(s,/staging first/,'staging is no longer migrated on merge (P0-33)');
  assert.match(s,/rules only/);
  assert.match(s,/No migration here changes or removes data/);
  assert.doesNotMatch(s,/daily backup|copy of the database first/);
  assert.match(s,/revoke all on public\.x from anon;/);
  assert.equal(s.match(/```/g).length,2,'the SQL can\'t close its own code block');
});

test('a migration that changes or removes data is flagged at the top of Toby\'s summary, and named',()=>{
  const s=planSummary({live:'a'.repeat(40),head:'b'.repeat(40),migrations:[
    {file:`${D}${NEXT}_tighten.sql`,pr:31,sql:'revoke all on public.x from anon;'},
    {file:`${D}${LATER}_tidy.sql`,pr:32,sql:'alter table public.games drop column old_meta;'},
  ]});
  const warn=s.indexOf('changes or removes data'), first=s.indexOf(`${NEXT}_tighten`);
  assert.ok(warn>=0&&warn<first,'the warning comes before the list');
  assert.match(s,new RegExp(`${LATER}_tidy\\.sql\` from #32[^\\n]*changes or removes data[^\\n]*drop column`));
  assert.match(s,/copy of the database first/);
});

test('with no migrations, the summary says the site deploys straight away',()=>{
  const s=planSummary({live:'a'.repeat(40),head:'b'.repeat(40),migrations:[]});
  assert.match(s,/No database changes/);
  assert.doesNotMatch(s,/rules only|changes or removes data/);
});

test('each migration\'s kind: rules only, adds rows, or changes or removes data',()=>{
  const k=sql=>migrationKind(sql).kind;
  // rules only: policies, grants, functions, indexes, comments; words in names, comments and strings don't count
  assert.equal(k(`create policy "p" on public.x for delete to authenticated using (true);
    grant delete, insert, update on table public.x to authenticated;
    alter table public.x add constraint x_fk foreign key (a) references public.y(id) on delete cascade;
    create unique index x_one on public.x using btree (a, b);
    comment on table public.x is 'delete from here? update x set nothing; insert into';
    -- delete from public.x; drop table public.x
    create policy "insert into, update set: just a name" on public.x for insert with check (true);`),'rules');
  // a function's body doesn't run when the migration does
  assert.equal(k(`create or replace function public.f() returns void language plpgsql as $function$
    begin delete from public.game_masters where user_id = auth.uid(); update public.x set a = 1; end
    $function$;`),'rules');
  // a DO block does
  assert.equal(k(`do $$ begin if exists (select 1 from public.x) then raise exception 'stop'; end if; end $$;`),'rules');
  assert.equal(k(`do $$ begin delete from public.x where a is null; end $$;`),'changes');
  assert.equal(k(`insert into public.game_masters (user_id) select gm_user_id from public.games on conflict do nothing;`),'adds');
  for(const sql of ['update public.games set meta = null;','UPDATE "public"."games" SET "meta" = NULL;',
    'delete from public.turn_logs where turn < 3;','truncate public.turn_events;','drop table public.old_things;',
    'alter table public.games drop column meta;','alter table "public"."games" alter column "turn" type bigint;'])
    assert.equal(k(sql),'changes',sql);
  assert.deepEqual(migrationKind('alter table public.games drop column meta; delete from public.x;').reasons,['delete from','drop column']);
  assert.equal(k('grant delete, insert, maintain, references, select, trigger, truncate, update on table public.x to service_role;'),'rules',
    'truncate as a privilege isn\'t a truncate');
});

test('every migration in the repo is sorted as expected',()=>{
  const dir=path.join(__dirname,'..','supabase','migrations');
  const kinds=Object.fromEntries(fs.readdirSync(dir).filter(f=>f.endsWith('.sql'))
    .map(f=>[f.replace(/^\d{14}_|\.sql$/g,''),migrationKind(fs.readFileSync(path.join(dir,f),'utf8')).kind]));
  assert.equal(kinds.game_masters_backfill,'adds','the Game Master data step adds rows');
  assert.equal(kinds.game_masters,'rules','functions that delete and update, but only when called');
  for(const [name,kind] of Object.entries(kinds))
    if(!['baseline','game_masters_backfill'].includes(name)) assert.equal(kind,'rules',name);
});

test('each database\'s summary says what happened',()=>{
  assert.match(applySummary({target:'production',decision:{action:'apply',pending:[NEXT]},applied:[NEXT]}),new RegExp(`Production database[\\s\\S]*Applied[\\s\\S]*${NEXT}`));
  assert.match(applySummary({target:'staging',decision:{action:'nothing'}}),/up to date/);
  assert.match(applySummary({target:'production',decision:{action:'refuse',reason:'because'},bootstrapped:BASE}),new RegExp(`${BASE}\` was recorded[\\s\\S]*Nothing applied:\\*\\* because`));
});

test('a failed CLI call is reported by its own message, never with the database password',()=>{
  const url='postgresql://postgres.abc:p%40ss%2Fword@aws-0-eu.pooler.supabase.com:5432/postgres';
  const out=JSON.stringify({_tag:'Error',error:{message:`failed to connect to ${url} (password p@ss/word, p%40ss%2Fword)`}});
  const msg=scrub(cliError(out),url);
  assert.match(msg,/failed to connect/);
  assert.doesNotMatch(msg,/p@ss|p%40ss|pooler/);
  assert.equal(cliError('not json'),'no message');
});

test('a pull request changes the database or the site, never both',()=>{
  const mig=`${D}${NEXT}_banners.sql`;
  assert.equal(mixedChange([mig,'supabase/schemas/public/tables/games.sql','supabase/tests/database/01_games.test.sql']),null);
  assert.equal(mixedChange(['src/engine/run-turn.js','tests/gm-messaging-boot.test.js']),null);
  assert.equal(mixedChange(['supabase/README.md','src/engine/run-turn.js']),null,'docs about the database are fine');
  const msg=mixedChange([mig,'src/engine/run-turn.js','src/ui/player/map.js']);
  assert.match(msg,/1 migration file\) and the site \(2 files\)/);
  assert.match(msg,/Split it in two: first the database change/);
  assert.match(msg,/supabase\/README\.md#database-and-site-changes-go-separately/);
});

// ---- Staging follows the pull request (P0-33): `reset staging` rebuilds the staging database ----

const STAGING_REF='yquaxxzdepqquitlgxkh', LIVE='yymsnsrpggpgmzgcfrys';
const STAGING_URL=`https://${STAGING_REF}.supabase.co`;
const pooler=ref=>`postgresql://postgres.${ref}:pw@aws-0-eu-west-2.pooler.supabase.com:5432/postgres`;
const direct=ref=>`postgresql://postgres:pw@db.${ref}.supabase.co:5432/postgres`;

test('a reset rebuilds only the staging database, named by its own address',()=>{
  assert.equal(resetGuard({target:'staging',dbUrl:pooler(STAGING_REF),stagingUrl:STAGING_URL}),STAGING_REF);
  assert.equal(resetGuard({target:'staging',dbUrl:direct(STAGING_REF),stagingUrl:STAGING_URL}),STAGING_REF);
});

test('a reset refuses any target but staging',()=>{
  for(const target of ['production','live','',undefined])
    assert.throws(()=>resetGuard({target,dbUrl:pooler(STAGING_REF),stagingUrl:STAGING_URL}),/only.*staging/,String(target));
});

test('a reset refuses the live database, however it is named',()=>{
  assert.throws(()=>resetGuard({target:'staging',dbUrl:pooler(LIVE),stagingUrl:STAGING_URL}),/live/);
  assert.throws(()=>resetGuard({target:'staging',dbUrl:direct(LIVE),stagingUrl:STAGING_URL}),/live/);
  assert.throws(()=>resetGuard({target:'staging',dbUrl:pooler(LIVE),stagingUrl:`https://${LIVE}.supabase.co`}),/live/);
});

test('a reset refuses a database that isn\'t the staging project, or no address at all',()=>{
  assert.throws(()=>resetGuard({target:'staging',dbUrl:pooler('abcdefghijklmnopqrst'),stagingUrl:STAGING_URL}),/isn't the staging project/);
  assert.throws(()=>resetGuard({target:'staging',dbUrl:`postgresql://postgres:pw@localhost:5432/postgres?x=${STAGING_REF}`,stagingUrl:STAGING_URL}),/isn't the staging project/);
  assert.throws(()=>resetGuard({target:'staging',dbUrl:'',stagingUrl:STAGING_URL}),/STAGING_DB_URL/);
  assert.throws(()=>resetGuard({target:'staging',dbUrl:pooler(STAGING_REF),stagingUrl:''}),/STAGING_SUPABASE_URL/);
});

test('a connection failure says the free staging project may have paused',()=>{
  for(const msg of ['failed to connect to postgres: dial tcp: i/o timeout','FATAL: Tenant or user not found','connection refused'])
    assert.match(connectHint(msg),/paused/,msg);
  assert.equal(connectHint('syntax error at or near "x"'),'syntax error at or near "x"');
});

test('the staging rebuild\'s summary names the base, the pull request\'s migrations and the test accounts',()=>{
  const s=resetSummary({base:'c'.repeat(40),added:[NEXT],accounts:['gm@kingdoms-call.test','player1@kingdoms-call.test'],seeds:2});
  assert.match(s,/Staging database/);
  assert.match(s,/`ccccccc`/);
  assert.match(s,new RegExp(`- \`${NEXT}\``));
  assert.match(s,/gm@kingdoms-call\.test/);
  assert.match(s,/STAGING_TEST_PASSWORD/);
  assert.match(resetSummary({base:'c'.repeat(40),added:[],accounts:[],seeds:1}),/adds no migrations/);
});

// `reset staging` end to end, against a stand-in Supabase CLI (SUPABASE_CLI) that answers as CLI 2.120.0 did on
// staging: JSON for reset, push and migration list, but only the command tag (`DO`) for the seed, which is one
// DO block. On 2026-10-11 the first real run stopped at the seed: every CLI answer was parsed as JSON.
test('a staging rebuild runs every step, in order, with the CLI\'s real answers',async()=>{
  const fs=require('fs'), os=require('os'), path=require('path'), {execFileSync}=require('child_process');
  const {reset}=require('../.github/scripts/migrations.js');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kc-reset-'));
  const log=path.join(tmp,'calls.log'), cliPath=path.join(tmp,'supabase');
  fs.writeFileSync(cliPath,`#!/usr/bin/env node
const a=process.argv.slice(2), fs=require('fs');
fs.appendFileSync(${JSON.stringify(log)},a.filter(x=>!/^postgresql:/.test(x)).join(' ')+'\\n');
const has=w=>a.join(' ').startsWith(w);
if(has('db reset')) console.log(JSON.stringify({target:'remote',version:'',message:'Reset remote database.'}));
else if(has('db query')) console.log('DO');
else if(has('db push --dry-run')) console.log(JSON.stringify({upToDate:false,dryRun:true,migrations:['${NEXT}_x.sql'],seeds:[],roles:[]}));
else if(has('db push')) console.log(JSON.stringify({upToDate:false,dryRun:false,migrations:['${NEXT}_x.sql'],seeds:[],roles:[]}));
else if(has('migration list')) console.log(JSON.stringify({migrations:[{local:'${BASE}',remote:'${BASE}'},{local:'${NEXT}',remote:'${NEXT}'}]}));
else process.exit(9);
`,{mode:0o755});
  const main=path.join(tmp,'main');
  fs.mkdirSync(path.join(main,'supabase','migrations'),{recursive:true});
  fs.mkdirSync(path.join(main,'supabase','seeds'));
  fs.writeFileSync(path.join(main,'supabase','seeds','staging.sql'),'DO $$ BEGIN END $$;\n');
  execFileSync('git',['init','-q',main]);
  execFileSync('git',['-C',main,'-c','user.name=t','-c','user.email=t@t','commit','-q','--allow-empty','-m','main']);
  const env={...process.env}, fetch0=globalThis.fetch;
  Object.assign(process.env,{SUPABASE_CLI:cliPath,MAIN_DIR:main,DB_URL:pooler(STAGING_REF),STAGING_SUPABASE_URL:STAGING_URL,
    STAGING_SUPABASE_KEY:'sb_publishable_example_key_1234567890',STAGING_TEST_PASSWORD:'a-long-shared-password',
    GITHUB_STEP_SUMMARY:path.join(tmp,'summary.md')});
  globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({})});
  const out=console.log; console.log=()=>{};
  try{ await reset('staging'); }
  finally{ console.log=out; globalThis.fetch=fetch0; for(const k of Object.keys(process.env)) if(!(k in env)) delete process.env[k]; Object.assign(process.env,env); }
  const calls=fs.readFileSync(log,'utf8').trim().split('\n').map(l=>l.split(' ').slice(0,2).join(' '));
  assert.deepEqual(calls,['db reset','db query','db push','db push','migration list','db query']);
  assert.match(fs.readFileSync(path.join(tmp,'summary.md'),'utf8'),new RegExp(`Staging database[\\s\\S]*${NEXT}[\\s\\S]*Seed runs: 2`));
});
