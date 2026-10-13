// The staging deploy's logic (P0-13), run by .github/workflows/staging.yml.
//   node .github/scripts/staging.js config            writes the staging kc-config.js to stdout, saying which
//                                                     pull request and commit it is (PR_NUMBER, PR_SHA)
//   node .github/scripts/staging.js comment <prev>    posts "on staging" on this PR, and marks the PR that
//                                                     was on staging before (<prev>, may be empty) as replaced
// configFile(), onStagingBody() and replacedBody() are pure, and signUpTestAccounts() takes its fetch as an
// argument; all are unit-tested in tests/staging.test.js. migrations.js (`reset staging`) signs the test
// accounts up after rebuilding the staging database.
const MARKER='<!-- staging -->';
const SITE='https://kingdoms-call-staging.github.io/';
const LIVE_REF='yymsnsrpggpgmzgcfrys';   // the live project: staging must never point at it

// The staging project's address (variable STAGING_SUPABASE_URL), checked. Returns its project ref.
function stagingRef(url){
  const m=/^https:\/\/([a-z0-9]{20})\.supabase\.co$/.exec(url||'');
  if(!m) throw new Error(`STAGING_SUPABASE_URL isn't a Supabase project address: ${url}`);
  if(m[1]===LIVE_REF) throw new Error('STAGING_SUPABASE_URL names the live database; staging must use its own');
  return m[1];
}

function configFile({url,key,deployed={}}){
  stagingRef(url);
  if(!/^[A-Za-z0-9._-]+$/.test(key||'')) throw new Error('STAGING_SUPABASE_KEY: the key is missing or has unexpected characters');
  const pr=String(deployed.pr??''), sha=String(deployed.sha??'');
  if(!/^[1-9][0-9]{0,9}$/.test(pr)) throw new Error(`PR_NUMBER isn't a pull request number: ${pr}`);
  if(!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`PR_SHA isn't a full commit id: ${sha}`);
  return `// Kingdoms Call: which database this copy of the site talks to. STAGING: written by
// .github/workflows/staging.yml for the staging site; the live site's own copy is site/kc-config.js.
const KC_CONFIG=Object.freeze({
  env:'staging',
  supabaseUrl:'${url}',
  supabaseKey:'${key}',
  deployed:Object.freeze({pr:${pr},sha:'${sha}'}),
});
`;
}

function onStagingBody({pr,sha,site=SITE}){
  return `${MARKER}\n🧪 **On staging:** this pull request (commit \`${String(sha).slice(0,7)}\`) is live on ${site}, `
    +`talking to the staging database (no real players), rebuilt for it: \`main\`'s migrations, then this pull `
    +`request's own, with made-up games and the test accounts. Only one pull request is on staging at a time; `
    +`this comment changes if another one replaces it (and staging's games and accounts start afresh).`;
}

function replacedBody({by}){
  return `${MARKER}\n🧪 ~~On staging~~: replaced by #${by}. Add the \`staging\` label again (or push a commit) to put this one back.`;
}

// Staging's test accounts (P0-33): made up, on a reserved domain. Every staging deploy rebuilds the database,
// which empties its accounts, then signs these up again through the site's own sign-up (so the sign-up trigger
// gives them profiles), all with one password: the staging environment's STAGING_TEST_PASSWORD secret, never
// committed (an Overlord account will be able to delete accounts). supabase/seeds/staging.sql finds them by
// email to give them games.
const TEST_ACCOUNTS=Object.freeze([
  {email:'overlord@kingdoms-call.test',name:'Test Overlord'},
  {email:'gm@kingdoms-call.test',name:'Test GM'},
  {email:'player1@kingdoms-call.test',name:'Test Player 1'},
  {email:'player2@kingdoms-call.test',name:'Test Player 2'},
  {email:'player3@kingdoms-call.test',name:'Test Player 3'},
].map(Object.freeze));

// Signs each account up (one that already exists is skipped), then checks it signs in. Returns
// [{email, status:'created'|'existed'}]. Any other answer stops the deploy; messages never carry the password.
async function signUpTestAccounts({url,key,password,accounts=TEST_ACCOUNTS,fetchFn=fetch}){
  stagingRef(url);
  if(!password) throw new Error('The staging environment has no STAGING_TEST_PASSWORD secret, so the test accounts can\'t be made.');
  const post=async(p,body)=>{
    const res=await fetchFn(`${url}/auth/v1/${p}`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body)});
    let json={}; try{ json=await res.json(); }catch{}
    return {status:res.status,ok:res.ok,code:json.error_code||json.code||'',msg:json.msg||json.message||''};
  };
  const done=[];
  for(const {email,name} of accounts){
    const up=await post('signup',{email,password,data:{display_name:name}});
    let status='created';
    if(up.status===422&&up.code==='user_already_exists') status='existed';
    else if(!up.ok) throw new Error(`Signing up the test account ${email} failed: HTTP ${up.status} ${up.code} ${up.msg}`.trim());
    const inn=await post('token?grant_type=password',{email,password});
    if(!inn.ok) throw new Error(`The test account ${email} can't sign in (HTTP ${inn.status} ${inn.code}). If it existed before, its password isn't STAGING_TEST_PASSWORD; if "Confirm email" is on for staging, new accounts can't sign in until it's off.`);
    done.push({email,status});
  }
  return done;
}

async function api(url,token,init={}){
  const res=await fetch(url,{...init,headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',
    Authorization:`Bearer ${token}`,...(init.body?{'Content-Type':'application/json'}:{})}});
  if(!res.ok) throw new Error(`GitHub API ${res.status} for ${init.method||'GET'} ${url}`);
  return res.json();
}
async function upsert(root,token,number,body){
  const comments=await api(`${root}/issues/${number}/comments?per_page=100`,token);
  const mine=comments.find(c=>typeof c.body==='string'&&c.body.startsWith(MARKER));
  if(mine) await api(`${root}/issues/comments/${mine.id}`,token,{method:'PATCH',body:JSON.stringify({body})});
  else await api(`${root}/issues/${number}/comments`,token,{method:'POST',body:JSON.stringify({body})});
}

// ── Staging publishes only a commit CI has passed ──────────────────────────────────────────────
// The staging job doesn't run the tests itself (CI's ci and db jobs already run them on the same commit, at the
// same time); it waits for their verdict. ciVerdict reads the commit's check runs: 'wait' until both have
// started and finished, 'go' when they passed (a skipped job counts as passed), 'fail' otherwise. The newest
// run of each job decides, so a re-run counts.
const CI_JOBS=['ci','db'];
function ciVerdict(checkRuns){
  const latest={};
  for(const r of checkRuns||[]) if(r&&CI_JOBS.includes(r.name)&&(!latest[r.name]||r.id>latest[r.name].id)) latest[r.name]=r;
  if(!latest.ci) return {state:'wait',why:'CI hasn\'t started on this commit yet'};
  const pending=CI_JOBS.filter(n=>latest[n]&&latest[n].status!=='completed');
  if(pending.length) return {state:'wait',why:`waiting for CI's ${pending.join(' and ')} job${pending.length>1?'s':''}`};
  const bad=CI_JOBS.find(n=>latest[n]&&!['success','skipped','neutral'].includes(latest[n].conclusion));
  if(bad) return {state:'fail',why:`CI's ${bad} job ended "${latest[bad].conclusion}" on this commit, so nothing goes on staging`};
  return {state:'go',why:'CI passed on this commit'};
}
// Polls ciVerdict until CI has passed (returns), failed (throws), or the time limit runs out (throws).
async function waitForCi({fetchRuns,sleep=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now,timeoutMs=20*60*1000,everyMs=15000,log=console.log}){
  const t0=now(); let last=null;
  for(;;){
    const v=ciVerdict(await fetchRuns());
    if(v.why!==last){ log(v.why); last=v.why; }
    if(v.state==='go') return v;
    if(v.state==='fail') throw new Error(v.why);
    if(now()-t0>=timeoutMs) throw new Error(`CI hasn't finished on this commit in ${Math.round(timeoutMs/60000)} minutes, so nothing goes on staging; re-run the staging job once it has`);
    await sleep(everyMs);
  }
}

async function main(){
  const [cmd,prev]=process.argv.slice(2);
  if(cmd==='config'){
    const {STAGING_SUPABASE_URL:url,STAGING_SUPABASE_KEY:key,PR_NUMBER:pr,PR_SHA:sha}=process.env;
    process.stdout.write(configFile({url,key,deployed:{pr,sha}}));
    return;
  }
  if(cmd==='comment'){
    const {GITHUB_TOKEN:token,GITHUB_REPOSITORY:repo,PR_NUMBER:pr,PR_SHA:sha}=process.env;
    const root=`${process.env.GITHUB_API_URL||'https://api.github.com'}/repos/${repo}`;
    await upsert(root,token,pr,onStagingBody({pr,sha}));
    if(prev&&String(prev)!==String(pr)) await upsert(root,token,prev,replacedBody({by:pr}));
    return;
  }
  if(cmd==='wait-ci'){
    const {GITHUB_TOKEN:token,GITHUB_REPOSITORY:repo,PR_SHA:sha}=process.env;
    if(!/^[0-9a-f]{40}$/.test(String(sha||''))) throw new Error('wait-ci needs PR_SHA, the commit\'s full hash');
    const root=`${process.env.GITHUB_API_URL||'https://api.github.com'}/repos/${repo}`;
    await waitForCi({fetchRuns:async()=>(await api(`${root}/commits/${sha}/check-runs?per_page=100`,token)).check_runs});
    return;
  }
  throw new Error('usage: staging.js config | comment <previous-pr> | wait-ci');
}

if(require.main===module) main().catch(e=>{ console.error(`::error title=staging::${e.message}`); process.exitCode=1; });

module.exports={MARKER,SITE,LIVE_REF,TEST_ACCOUNTS,stagingRef,configFile,onStagingBody,replacedBody,signUpTestAccounts,ciVerdict,waitForCi};
