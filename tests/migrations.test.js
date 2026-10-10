// Unit tests for the migration pipeline's logic (.github/scripts/migrations.js), with no database or GitHub
// involved: which changes to supabase/migrations/ are allowed, what each database gets, and what Toby is shown
// before approving production.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseNameStatus,classify,decide,planSummary,applySummary,cliError,scrub,BACKUP_NOTE}=require('../.github/scripts/migrations.js');

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
  assert.match(s,/staging first, then production/);
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
