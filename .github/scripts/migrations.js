// The migration pipeline's logic (P0-17), run by .github/workflows/deploy.yml and ci.yml.
//   node .github/scripts/migrations.js plan             which migrations this deploy brings: those added since the
//                                                       commit that's live on the site. Writes the outputs `changed`
//                                                       and `expected`, and the job summary (each migration's SQL and
//                                                       its pull request) that Toby reads before approving production
//   node .github/scripts/migrations.js apply production brings the production database (DB_URL) up to date,
//                                                       refusing any migration that isn't in EXPECTED
//   node .github/scripts/migrations.js reset staging    on a pull request labelled `staging` (staging.yml, P0-33): empties
//                                                       the staging database (DB_URL), rebuilds it from main's migrations
//                                                       (MAIN_DIR, a checkout of main), signs up the test accounts, seeds
//                                                       it, then applies this pull request's own migrations and seeds again
//   node .github/scripts/migrations.js pr-check         on a pull request (HEAD is GitHub's merge commit): no merged
//                                                       migration is changed, new ones are named and ordered, and
//                                                       the database and the site aren't changed together
//
// The site never deploys before the migrations it needs: "plan" compares with the commit that's live, not with
// the previous push, so a migration whose production run was rejected is still pending on the next push.
//
// Everything except main() is pure and unit-tested in tests/migrations.test.js. main() runs git, the GitHub API
// (read-only) and the Supabase CLI (SUPABASE_CLI, default "supabase"), whose JSON output it reads.
const fs=require('fs'), path=require('path'), {execFileSync,spawnSync}=require('child_process');
const {LIVE_REF,stagingRef,signUpTestAccounts}=require('./staging.js');

const DIR='supabase/migrations';
const NAME=/^(\d{14})_([a-z0-9_]+)\.sql$/;
const MAX_SQL_LINES=400; // per migration, in the job summary

// What a migration does to the data already there, for Toby's summary: 'rules' (policies, grants, functions,
// indexes: nothing is lost, and the pull request's rollback undoes it), 'adds' (inserts rows), or 'changes'
// (updates, deletes, truncates, drops a table or column, or changes a column's type: only a copy taken before it
// ran can undo it). Comments, strings and quoted names are ignored, and so are function bodies (they run when the
// function is called, not when the migration is applied); a DO block runs, so it counts.
const CHANGES=[['update',/\bupdate\s+[\w.]+\s+set\b/],['delete from',/\bdelete\s+from\b/],['truncate',/(^|;)\s*truncate\b/],
  ['drop table',/\bdrop\s+table\b/],['drop column',/\bdrop\s+column\b/],['alter column type',/\balter\s+column\s+[\w.]+\s+(set\s+data\s+)?type\b/]];
function migrationKind(sql){
  let t=String(sql).replace(/\/\*[\s\S]*?\*\//g,' ').replace(/--[^\n]*/g,' ');
  // dollar-quoted bodies: kept after DO, dropped otherwise (a function's body)
  t=t.replace(/(\bdo\s*)?(\$[A-Za-z_]*\$)([\s\S]*?)\2/gi,(all,isDo,tag,body)=>isDo?' '+body+' ':' ');
  t=t.replace(/'(?:[^']|'')*'/g,"''").replace(/"(?:[^"]|"")*"/g,'ident').toLowerCase();
  const reasons=CHANGES.filter(([,re])=>re.test(t)).map(([name])=>name);
  if(reasons.length) return {kind:'changes',reasons};
  return /\binsert\s+into\b/.test(t)?{kind:'adds',reasons:['insert into']}:{kind:'rules',reasons:[]};
}
const KIND_TEXT={
  rules:'**rules only** (access rules, permissions, functions or indexes; no data changes)',
  adds:'**adds rows**, changing none',
  changes:'⚠️ **changes or removes data**',
};

const version=file=>(NAME.exec(path.basename(file))||[])[1];

// `git diff --name-status -M` output → [{status:'A'|'M'|'D'|'R'|…, file, from}]
function parseNameStatus(text){
  return text.split('\n').filter(Boolean).map(line=>{
    const [s,a,b]=line.split('\t');
    return b?{status:s[0],from:a,file:b}:{status:s[0],file:a};
  });
}

// What a change to supabase/migrations/ does. A migration that's merged may already be applied somewhere, so
// editing or renaming one is refused; a new one must be named <14-digit version>_<name>.sql, and sort after
// every migration already there (the CLI won't apply one that sorts before the newest applied).
// Deleting one is refused too, except on a pull request (allowDelete): withdrawing a migration that production
// rejected is legitimate, and if it was applied after all, the deploy refuses that database (decide()).
function classify(changes,existing=[],{allowDelete=false}={}){
  const added=[], removed=[], problems=[];
  const newest=existing.map(version).filter(Boolean).sort().pop()||'';
  const seen=new Set(existing.map(version).filter(Boolean));
  for(const c of changes){
    if(c.status==='D'&&allowDelete){ removed.push(c.file); continue; }
    if(c.status!=='A'){
      problems.push(`${c.from||c.file}: a migration that's merged must never change (${c.status==='D'?'deleted':c.status==='R'?'renamed':'edited'}). Write a new migration instead.`);
      continue;
    }
    const v=version(c.file);
    if(!v){ problems.push(`${c.file}: name it <14-digit timestamp>_<lowercase_name>.sql (as \`supabase migration new\` does).`); continue; }
    if(seen.has(v)) problems.push(`${c.file}: version ${v} is already used.`);
    else if(v<=newest) problems.push(`${c.file}: sorts before ${newest}, the newest migration already merged. Give it a newer timestamp.`);
    seen.add(v);
    added.push(c.file);
  }
  return {added:added.sort(),removed,problems};
}

// A pull request changes the database or the site, never both. They go live at different moments (the
// database when Toby approves it, the site straight after), and players keep old pages open, so each must
// work without the other; separate pull requests make that the shape of the work. The why, for Toby:
// supabase/README.md, "Database and site changes go separately". The site's files are under src/ (built into site/,
// which isn't in git, since P1-05).
const WHY='https://github.com/Nestalawe/kingdoms-call/blob/main/supabase/README.md#database-and-site-changes-go-separately';
function mixedChange(files){
  const db=files.filter(f=>f.startsWith(`${DIR}/`)), site=files.filter(f=>f.startsWith('src/'));
  if(!db.length||!site.length) return null;
  return `This pull request changes both the database (${db.length} migration file${db.length>1?'s':''}) and the site `
    +`(${site.length} file${site.length>1?'s':''}). Split it in two: first the database change, which must work with `
    +`the site that's live now; then the site change, which must cope until the database change is there. Why: ${WHY}`;
}

// What to do to one database. `list` is `supabase migration list --output-format json`'s migrations;
// `expected` the versions Toby was shown; `hasGames` whether the game's tables exist (asked only when the
// database has no migration history at all).
//   refuse     stop, change nothing (reason says why)
//   bootstrap  the database predates the pipeline: record the first migration (the baseline, P0-15) as applied,
//              without running it, then decide again
//   nothing    already up to date
//   apply      push `pending`
function decide({list,expected,hasGames,bootstrapped=false}){
  const local=list.filter(m=>m.local).map(m=>m.local);
  const remote=list.filter(m=>m.remote).map(m=>m.remote);
  const unknown=list.filter(m=>m.remote&&!m.local).map(m=>m.remote);
  if(unknown.length)
    return {action:'refuse',reason:`the database has migrations the repo doesn't: ${unknown.join(', ')}. Someone applied them by hand. Repair its history before deploying.`};
  if(!remote.length){
    if(bootstrapped) return {action:'refuse',reason:'recording the baseline as applied didn\'t show up in the migration history.'};
    if(hasGames!==true) return {action:'refuse',reason:'the database has no migration history and no game tables. The pipeline never builds a database from nothing; set it up by hand (supabase/README.md).'};
    return {action:'bootstrap',version:[...local].sort()[0]};
  }
  const pending=list.filter(m=>m.local&&!m.remote).map(m=>m.local).sort();
  const want=new Set(expected);
  const surprise=pending.filter(v=>!want.has(v));
  if(surprise.length)
    return {action:'refuse',reason:`these migrations are pending here but weren't in the list shown before approval: ${surprise.join(', ')}. The database is out of step with the live site.`};
  return pending.length?{action:'apply',pending}:{action:'nothing'};
}

function planSummary({migrations,live,head}){
  const lines=['## Database changes in this deploy',''];
  if(!live) lines.push('_The commit live on the site couldn\'t be found, so every migration counts as new; the jobs below apply only those each database is missing._','');
  else lines.push(`Compared with the commit live on the site, \`${live.slice(0,7)}\`, this deploy (\`${head.slice(0,7)}\`) brings:`,'');
  if(!migrations.length){ lines.push('No database changes. The site deploys straight after the tests.'); return lines.join('\n')+'\n'; }
  const kinds=migrations.map(m=>migrationKind(m.sql));
  if(kinds.some(k=>k.kind==='changes'))
    lines.push('> ⚠️ **A migration here changes or removes data** (marked below). Nothing undoes that but a copy of the '
      +'database taken before it runs: **take a copy of the database first**, or approve just after a daily backup.','');
  else lines.push('No migration here changes or removes data: approve once the conditions in its pull request are met '
    +'(they\'re in "What Toby is approving").','');
  migrations.forEach((m,i)=>lines.push(`- \`${path.basename(m.file)}\`${m.pr?` from #${m.pr}`:''}: ${KIND_TEXT[kinds[i].kind]}`
    +`${kinds[i].reasons.length&&kinds[i].kind==='changes'?` (\`${kinds[i].reasons.join('`, `')}\`)`:''}.`
    +`${m.pr?' What it changes, in plain words, and its rollback are in that pull request.':''}`));
  lines.push('','**Order:** production once Toby approves it, then the site. If production is rejected, the site '
    +'doesn\'t deploy, and the next push to `main` asks again. (Staging doesn\'t change on a merge: each pull request '
    +'is tried there before it\'s merged.)','');
  for(const m of migrations){
    const sql=m.sql.replace(/\n$/,'').split('\n');
    const shown=sql.slice(0,MAX_SQL_LINES).join('\n').replace(/```/g,'` ` `');
    lines.push(`<details><summary><code>${path.basename(m.file)}</code> (${sql.length} lines)</summary>`,'','```sql',shown,
      sql.length>MAX_SQL_LINES?`-- … ${sql.length-MAX_SQL_LINES} more lines: see the file in the repo`:'','```','</details>','');
  }
  return lines.join('\n')+'\n';
}

function applySummary({target,decision,applied=[],bootstrapped}){
  const lines=[`## ${target[0].toUpperCase()+target.slice(1)} database`,''];
  if(bootstrapped) lines.push(`First run on this database: its structure predates the pipeline and is the baseline (P0-15), so \`${bootstrapped}\` was recorded as applied, not run.`,'');
  if(decision.action==='refuse') lines.push(`❌ **Nothing applied:** ${decision.reason}`);
  else if(decision.action==='nothing') lines.push('Already up to date: nothing to apply.');
  else lines.push('✅ Applied:','',...applied.map(v=>`- \`${v}\``));
  if(decision.action==='refuse'&&applied.length) lines.push('','Applied before it stopped:','',...applied.map(v=>`- \`${v}\``));
  return lines.join('\n')+'\n';
}

// ---- Staging follows the pull request (P0-33) ----

// Before `reset staging` empties a database: the target is staging and nothing else; the database address
// (the staging environment's STAGING_DB_URL secret, which no other environment holds) names the staging project
// (STAGING_SUPABASE_URL) in its user (session pooler, postgres.<ref>) or its host (db.<ref>.supabase.co), and
// never the live one. Returns the staging project's ref. Messages never carry the address.
function resetGuard({target,dbUrl,stagingUrl}){
  if(target!=='staging') throw new Error(`A reset only ever rebuilds staging, never ${target||'(no target)'}.`);
  if(!stagingUrl) throw new Error('No STAGING_SUPABASE_URL: a reset runs only in the staging environment.');
  const ref=stagingRef(stagingUrl);
  if(!dbUrl) throw new Error('No database address: the staging environment\'s STAGING_DB_URL secret is missing (a reset runs only in the staging environment).');
  if(dbUrl.includes(LIVE_REF)) throw new Error('The database address names the live database: a reset never touches it.');
  let user='', host='';
  try{ const u=new URL(dbUrl); user=decodeURIComponent(u.username); host=u.hostname; }catch{}
  if(user!==`postgres.${ref}`&&host!==`db.${ref}.supabase.co`)
    throw new Error(`STAGING_DB_URL isn't the staging project (${ref}): its user or its host must name it.`);
  return ref;
}

// The free staging project pauses after a quiet week; then every connection fails. Say so.
function connectHint(message){
  if(!/failed to connect|connection refused|i\/o timeout|timed out|no such host|tenant or user not found/i.test(message)) return message;
  return `${message} The staging project may have paused after a quiet week (free plan): restore it from the `
    +'Supabase dashboard, then add the `staging` label again (or push a commit).';
}

function resetSummary({base,added,accounts,seeds}){
  const lines=['## Staging database','',
    `Rebuilt for this pull request: emptied (games and accounts too), then \`main\`'s migrations up to \`${base.slice(0,7)}\`, `
    +'the test accounts, and the made-up games (`supabase/seeds/staging.sql`).',''];
  if(added.length) lines.push('Then this pull request\'s own migrations, on top:','',...added.map(v=>`- \`${v}\``),'');
  else lines.push('This pull request adds no migrations.','');
  lines.push(`Seed runs: ${seeds} (main's, then this pull request's).`,'',
    'Test accounts (password: the staging environment\'s `STAGING_TEST_PASSWORD` secret):','',...accounts.map(e=>`- ${e}`));
  return lines.join('\n')+'\n';
}

// ---- I/O ----

const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const summary=text=>process.env.GITHUB_STEP_SUMMARY?fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,text):process.stdout.write(text);
const output=(k,v)=>process.env.GITHUB_OUTPUT?fs.appendFileSync(process.env.GITHUB_OUTPUT,`${k}=${v}\n`):console.log(`${k}=${v}`);

async function api(url,token){
  const res=await fetch(url,{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',
    ...(token?{Authorization:`Bearer ${token}`}:{})}});
  if(!res.ok) throw new Error(`GitHub API ${res.status} for GET ${url}`);
  return res.json();
}

// The commit the live site was last deployed from: the newest github-pages deployment whose latest status
// is "success". Null if there's none, or it isn't in this checkout's history.
async function liveCommit(root,token){
  const deployments=await api(`${root}/deployments?environment=github-pages&per_page=30`,token);
  for(const d of deployments){
    const [latest]=await api(`${root}/deployments/${d.id}/statuses?per_page=1`,token);
    if(latest&&latest.state==='success'){
      try{ git('cat-file','-e',`${d.sha}^{commit}`); return d.sha; }catch{ return null; }
    }
  }
  return null;
}

async function plan(){
  const {GITHUB_TOKEN:token,GITHUB_REPOSITORY:repo}=process.env;
  if(!repo) throw new Error('GITHUB_REPOSITORY must be set');
  const root=`${process.env.GITHUB_API_URL||'https://api.github.com'}/repos/${repo}`;
  const head=git('rev-parse','HEAD');
  const live=await liveCommit(root,token);
  let added, problems=[];
  if(live){
    const existing=git('ls-tree','--name-only',`${live}:${DIR}`).split('\n').filter(Boolean);
    ({added,problems}=classify(parseNameStatus(git('diff','--name-status','-M',live,head,'--',DIR)),existing));
  }else added=fs.readdirSync(DIR).filter(f=>f.endsWith('.sql')).map(f=>`${DIR}/${f}`).sort();
  if(problems.length){
    for(const p of problems) console.log(`::error title=migrations::${p}`);
    summary(`## Database changes in this deploy\n\n❌ Refused, nothing deployed:\n\n${problems.map(p=>`- ${p}`).join('\n')}\n`);
    process.exit(1);
  }
  const migrations=[];
  for(const file of added){
    const sha=git('log','--diff-filter=A','--format=%H','-1','--',file);
    let pr=null;
    try{ pr=sha&&(await api(`${root}/commits/${sha}/pulls`,token)).map(p=>p.number).sort((a,b)=>a-b)[0]||null; }catch{}
    migrations.push({file,pr,sql:fs.readFileSync(file,'utf8')});
  }
  summary(planSummary({migrations,live,head}));
  output('changed',migrations.length?'true':'false');
  output('expected',migrations.map(m=>version(m.file)).join(' '));
  console.log(migrations.length?`Migrations to apply: ${added.join(', ')}`:'No database changes.');
}

// The connection string is an argument, so a failure is reported by the subcommand's name only: never the
// command line, which would print the database password. Most subcommands answer in JSON; `db query` on a
// file that's one DO block (the staging seed) answers only with the command tag, `DO`: pass {json:false}.
function cli(args,{json=true}={}){
  const bin=process.env.SUPABASE_CLI||'supabase';
  const r=spawnSync(bin,[...args,'--db-url',process.env.DB_URL,'--agent','no','--output-format','json'],
    {encoding:'utf8',stdio:['ignore','pipe','inherit']});
  if(r.error||r.status!==0)
    throw new Error(`supabase ${args.slice(0,2).join(' ')} failed (exit ${r.status}): ${scrub(cliError(r.stdout),process.env.DB_URL)}`);
  return json?JSON.parse(r.stdout):r.stdout;
}
// The CLI reports an error as JSON on stdout: {"_tag":"Error","error":{"message":…}}.
function cliError(stdout){
  try{ const e=JSON.parse(stdout).error||{}; return [e.message,e.suggestion].filter(Boolean).join(' ').trim()||'no message'; }
  catch{ return 'no message'; }
}
// Removes a connection string, and its password on its own, from a message.
function scrub(text,url){
  let pw='';
  try{ pw=decodeURIComponent(new URL(url).password); }catch{}
  for(const s of [url,pw,pw&&encodeURIComponent(pw)]) if(s) text=text.split(s).join('***');
  return text;
}
const migrationList=()=>cli(['migration','list']).migrations||[];

function apply(target){
  // Staging isn't migrated on a merge (P0-33): it's rebuilt for each pull request put on it (`reset staging`).
  if(target!=='production') throw new Error('apply needs the target production (staging is rebuilt by `reset staging`)');
  if(!process.env.DB_URL) throw new Error(`No database address: the ${target} environment's secret is missing.`);
  const expected=(process.env.EXPECTED||'').split(/\s+/).filter(Boolean);
  let list=migrationList(), bootstrapped=null;
  let hasGames=list.some(m=>m.remote)?undefined
    :cli(['db','query',"select to_regclass('public.games') is not null as has_games"])[0]?.has_games;
  let d=decide({list,expected,hasGames});
  if(d.action==='bootstrap'){
    cli(['migration','repair',d.version,'--status','applied']);
    bootstrapped=d.version;
    list=migrationList();
    d=decide({list,expected,hasGames,bootstrapped:true});
  }
  let applied=[];
  if(d.action==='apply'){
    const dry=cli(['db','push','--dry-run']).migrations.map(version);
    if(dry.join(' ')!==d.pending.join(' '))
      d={action:'refuse',reason:`the CLI would push ${dry.join(', ')||'nothing'}, not ${d.pending.join(', ')}.`};
    else{
      cli(['db','push','--yes']);
      const left=migrationList().filter(m=>m.local&&!m.remote).map(m=>m.local);
      applied=d.pending.filter(v=>!left.includes(v));
      if(left.length) d={action:'refuse',reason:`after the push, still pending: ${left.join(', ')}.`};
    }
  }
  summary(applySummary({target,decision:d,applied,bootstrapped}));
  if(d.action==='refuse'){ console.log(`::error title=migrations (${target})::${d.reason}`); process.exit(1); }
  console.log(d.action==='nothing'?`${target}: already up to date.`:`${target}: applied ${applied.join(', ')}.`);
}

async function reset(target){
  const {DB_URL:dbUrl,STAGING_SUPABASE_URL:stagingUrl,STAGING_SUPABASE_KEY:key,STAGING_TEST_PASSWORD:password,MAIN_DIR:mainDir}=process.env;
  resetGuard({target,dbUrl,stagingUrl});
  if(!mainDir||!fs.existsSync(path.join(mainDir,DIR))) throw new Error('MAIN_DIR must be a checkout of main, with supabase/migrations.');
  const run=(args,opts)=>{ try{ return cli(args,opts); }catch(e){ throw new Error(connectHint(e.message)); } };
  const base=execFileSync('git',['-C',mainDir,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  let seeds=0;
  const seed=dir=>{
    const file=path.resolve(dir,'supabase/seeds/staging.sql');
    if(fs.existsSync(file)){ run(['db','query','--file',file],{json:false}); seeds++; }
  };

  console.log(`1. Emptying staging and rebuilding it from main's migrations (${base.slice(0,7)})`);
  run(['db','reset','--no-seed','--yes','--workdir',path.resolve(mainDir)]);
  console.log('2. Signing up the test accounts');
  const accounts=await signUpTestAccounts({url:stagingUrl,key,password});
  console.log('3. Seeding (main\'s seed)');
  seed(mainDir);
  console.log('4. Applying this pull request\'s own migrations');
  const added=run(['db','push','--dry-run']).migrations.map(version);
  if(added.length) run(['db','push','--yes']);
  const list=migrationList();
  const left=list.filter(m=>m.local&&!m.remote).map(m=>m.local), extra=list.filter(m=>m.remote&&!m.local).map(m=>m.remote);
  if(left.length||extra.length)
    throw new Error(`after the push, staging and this pull request differ: still pending ${left.join(', ')||'none'}; not in this pull request ${extra.join(', ')||'none'}. If main has a migration this branch lacks, bring the branch up to date with main.`);
  console.log('5. Seeding (this pull request\'s seed)');
  seed('.');
  summary(resetSummary({base,added,accounts:accounts.map(a=>a.email),seeds}));
  console.log(`staging: rebuilt from main ${base.slice(0,7)}${added.length?`, plus ${added.join(', ')}`:''}.`);
}

function prCheck(){
  // On a pull request, actions/checkout gives GitHub's merge commit: its first parent is the base branch.
  const base='HEAD^1';
  const existing=git('ls-tree','--name-only',`${base}:${DIR}`).split('\n').filter(Boolean);
  const {added,removed,problems}=classify(parseNameStatus(git('diff','--name-status','-M',base,'HEAD','--',DIR)),existing,{allowDelete:true});
  for(const f of removed) console.log(`::warning title=migrations::${f} is deleted. Only for a migration that never reached production: if it did, the deploy will refuse until it's back.`);
  const mixed=mixedChange(git('diff','--name-only','--no-renames',base,'HEAD').split('\n').filter(Boolean));
  if(mixed) problems.push(mixed);
  for(const p of problems) console.log(`::error title=migrations::${p}`);
  if(problems.length) process.exit(1);
  console.log(added.length?`New migrations: ${added.join(', ')}`:'No new migrations.');
}

if(require.main===module){
  const [cmd,arg]=process.argv.slice(2);
  const run={plan,apply:()=>apply(arg),reset:()=>reset(arg),'pr-check':prCheck}[cmd];
  if(!run){ console.error('usage: migrations.js plan | apply production | reset staging | pr-check'); process.exit(2); }
  Promise.resolve().then(run).catch(e=>{
    console.log(`::error title=migrations::${e.message}`);
    summary(`\n❌ **Stopped:** ${e.message}\n`);
    process.exit(1);
  });
}

module.exports={parseNameStatus,classify,mixedChange,decide,planSummary,applySummary,cliError,scrub,version,migrationKind,
  resetGuard,connectHint,resetSummary,reset};
