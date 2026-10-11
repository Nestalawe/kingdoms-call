// Unit tests for the migration pipeline's logic (.github/scripts/migrations.js), with no database or GitHub
// involved: which changes to supabase/migrations/ are allowed, what each database gets, and what Toby is shown
// before approving production.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseNameStatus,classify,mixedChange,decide,planSummary,applySummary,cliError,scrub,BACKUP_NOTE,resetGuard,connectHint,resetSummary}=require('../.github/scripts/migrations.js');

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

test('Toby\'s summary lists each migration, its pull request, the order, the backup timing and the SQL',()=>{
  const s=planSummary({live:'a'.repeat(40),head:'b'.repeat(40),migrations:[
    {file:`${D}${NEXT}_tighten.sql`,pr:31,sql:'revoke all on public.x from anon;\n-- ```fence```'},
  ]});
  assert.match(s,new RegExp(`${NEXT}_tighten\\.sql\` from #31`));
  assert.match(s,/production once Toby approves it, then the site/);
  assert.doesNotMatch(s,/staging first/,'staging is no longer migrated on merge (P0-33)');
  assert.ok(s.includes(BACKUP_NOTE));
  assert.match(s,/revoke all on public\.x from anon;/);
  assert.equal(s.match(/```/g).length,2,'the SQL can\'t close its own code block');
});

test('with no migrations, the summary says the site deploys straight away',()=>{
  const s=planSummary({live:'a'.repeat(40),head:'b'.repeat(40),migrations:[]});
  assert.match(s,/No database changes/);
  assert.ok(!s.includes(BACKUP_NOTE));
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
  assert.equal(mixedChange(['site/kingdoms-call-gm-portal.html','tests/gm-messaging-boot.test.js']),null);
  assert.equal(mixedChange(['supabase/README.md','site/kingdoms-call-gm-portal.html']),null,'docs about the database are fine');
  const msg=mixedChange([mig,'site/kingdoms-call-gm-portal.html','site/kingdoms-call-player-portal.html']);
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
