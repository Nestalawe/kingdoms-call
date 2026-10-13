// Unit tests for the staging deploy's logic (.github/scripts/staging.js), with no GitHub involved:
// the kc-config.js it writes for the staging site, and the comments it posts on pull requests.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('vm');
const {configFile,onStagingBody,replacedBody,MARKER,TEST_ACCOUNTS,signUpTestAccounts}=require('../.github/scripts/staging.js');

const URL='https://yquaxxzdepqquitlgxkh.supabase.co', KEY='sb_publishable_example_key_1234567890';
const DEPLOYED={pr:21,sha:'abcdef1234567890abcdef1234567890abcdef12'};
const run=src=>{ const ctx={}; vm.createContext(ctx); vm.runInContext(src+'\n;globalThis.__cfg=KC_CONFIG;',ctx); return ctx.__cfg; };

test('the staging config names the staging database and says it is staging',()=>{
  const cfg=run(configFile({url:URL,key:KEY,deployed:DEPLOYED}));
  assert.equal(cfg.env,'staging');
  assert.equal(cfg.supabaseUrl,URL);
  assert.equal(cfg.supabaseKey,KEY);
  assert.ok(Object.isFrozen(cfg));
});

test('the staging config says which pull request and commit are deployed (P0-33)',()=>{
  const cfg=run(configFile({url:URL,key:KEY,deployed:{pr:'21',sha:DEPLOYED.sha}}));
  assert.deepEqual({...cfg.deployed},{pr:21,sha:DEPLOYED.sha});
  assert.ok(Object.isFrozen(cfg.deployed));
});

test('the staging config refuses a pull request number or commit it can\'t vouch for',()=>{
  for(const pr of [undefined,'',0,-3,'21a','2.5',"21,sha:'x'"])
    assert.throws(()=>configFile({url:URL,key:KEY,deployed:{pr,sha:DEPLOYED.sha}}),/PR_NUMBER/,`pr ${pr}`);
  for(const sha of [undefined,'','abcdef1',DEPLOYED.sha.toUpperCase(),DEPLOYED.sha+'0',"abc'; alert(1); '"])
    assert.throws(()=>configFile({url:URL,key:KEY,deployed:{pr:21,sha}}),/PR_SHA/,`sha ${sha}`);
  assert.throws(()=>configFile({url:URL,key:KEY}),/PR_NUMBER/);
});

test('the staging config refuses anything that is not a Supabase project address',()=>{
  assert.throws(()=>configFile({url:'http://yquaxxzdepqquitlgxkh.supabase.co',key:KEY,deployed:DEPLOYED}),/address/);
  assert.throws(()=>configFile({url:'https://evil.example.com',key:KEY,deployed:DEPLOYED}),/address/);
  assert.throws(()=>configFile({url:'',key:KEY,deployed:DEPLOYED}),/address/);
});

test('the staging config refuses a missing key, or one that would break out of the string',()=>{
  assert.throws(()=>configFile({url:URL,key:'',deployed:DEPLOYED}),/key/);
  assert.throws(()=>configFile({url:URL,key:"abc'; alert(1); '",deployed:DEPLOYED}),/key/);
});

test('the staging config never carries the live database',()=>{
  assert.throws(()=>configFile({url:'https://yymsnsrpggpgmzgcfrys.supabase.co',key:KEY,deployed:DEPLOYED}),/live/);
});

test('the "on staging" comment links the site, names the commit and carries the marker',()=>{
  const body=onStagingBody({pr:21,sha:'abcdef1234567',site:'https://kingdoms-call-staging.github.io/'});
  assert.ok(body.startsWith(MARKER));
  assert.match(body,/https:\/\/kingdoms-call-staging\.github\.io\//);
  assert.match(body,/abcdef1/);
  assert.match(body,/staging database/);
  assert.match(body,/rebuilt for it/);
  assert.match(body,/test accounts/);
});

test('the "replaced" comment says which pull request took its place',()=>{
  const body=replacedBody({by:22});
  assert.ok(body.startsWith(MARKER));
  assert.match(body,/#22/);
  assert.doesNotMatch(body,/https:\/\/kingdoms-call-staging/);
});

// ---- The test accounts (P0-33): signed up through the site's own sign-up, then signed in ----

// A stand-in for the staging project's sign-up: `existing` accounts answer "already exists".
function fakeAuth({existing=[],signInFails=[],signUpStatus}={}){
  const calls=[];
  const fetchFn=async(url,init)=>{
    const body=JSON.parse(init.body); calls.push({url,body,headers:init.headers});
    const reply=(status,obj)=>({ok:status<300,status,json:async()=>obj});
    if(url.endsWith('/auth/v1/signup')){
      if(signUpStatus) return reply(signUpStatus,{error_code:'unexpected_failure',msg:'boom'});
      return existing.includes(body.email)?reply(422,{error_code:'user_already_exists',msg:'User already registered'}):reply(200,{user:{id:'u'}});
    }
    if(url.endsWith('/auth/v1/token?grant_type=password'))
      return signInFails.includes(body.email)?reply(400,{error_code:'email_not_confirmed'}):reply(200,{access_token:'t'});
    return reply(404,{});
  };
  return {fetchFn,calls};
}

test('the test accounts are made up: a reserved domain, and an Overlord-to-be, a GM and players',()=>{
  assert.ok(TEST_ACCOUNTS.length>=4);
  for(const a of TEST_ACCOUNTS) assert.match(a.email,/^[a-z0-9]+@kingdoms-call\.test$/);
  for(const who of ['overlord','gm','player1']) assert.ok(TEST_ACCOUNTS.some(a=>a.email.startsWith(who+'@')),who);
});

test('each test account is signed up with the shared password and its name, then signed in',async()=>{
  const {fetchFn,calls}=fakeAuth();
  const done=await signUpTestAccounts({url:URL,key:KEY,password:'a-long-shared-password',fetchFn});
  assert.deepEqual(done.map(a=>a.email),TEST_ACCOUNTS.map(a=>a.email));
  assert.ok(done.every(a=>a.status==='created'));
  const ups=calls.filter(c=>c.url===`${URL}/auth/v1/signup`);
  assert.equal(ups.length,TEST_ACCOUNTS.length);
  assert.equal(ups[0].headers.apikey,KEY);
  assert.equal(ups[0].body.password,'a-long-shared-password');
  assert.equal(ups[0].body.data.display_name,TEST_ACCOUNTS[0].name);
  assert.equal(calls.filter(c=>c.url.endsWith('grant_type=password')).length,TEST_ACCOUNTS.length);
});

test('an account that already exists is skipped, not an error',async()=>{
  const {fetchFn}=fakeAuth({existing:['gm@kingdoms-call.test']});
  const done=await signUpTestAccounts({url:URL,key:KEY,password:'a-long-shared-password',fetchFn});
  assert.equal(done.find(a=>a.email==='gm@kingdoms-call.test').status,'existed');
});

test('a sign-up or sign-in that fails stops the deploy, naming the account but never the password',async()=>{
  await assert.rejects(signUpTestAccounts({url:URL,key:KEY,password:'a-long-shared-password',fetchFn:fakeAuth({signUpStatus:500}).fetchFn}),
    e=>/overlord@kingdoms-call\.test/.test(e.message)&&!e.message.includes('a-long-shared-password'));
  await assert.rejects(signUpTestAccounts({url:URL,key:KEY,password:'a-long-shared-password',fetchFn:fakeAuth({signInFails:['player1@kingdoms-call.test']}).fetchFn}),
    /player1@kingdoms-call\.test.*sign in/);
});

test('the test accounts need the password secret, and never go to the live project',async()=>{
  await assert.rejects(signUpTestAccounts({url:URL,key:KEY,password:'',fetchFn:fakeAuth().fetchFn}),/STAGING_TEST_PASSWORD/);
  await assert.rejects(signUpTestAccounts({url:'https://yymsnsrpggpgmzgcfrys.supabase.co',key:KEY,password:'a-long-shared-password',fetchFn:fakeAuth().fetchFn}),/live/);
});

test('the staging seed finds the test accounts it uses by their real addresses',()=>{
  const seed=require('fs').readFileSync(require('path').join(__dirname,'..','supabase','seeds','staging.sql'),'utf8');
  const used=[...seed.matchAll(/'([a-z0-9]+@kingdoms-call\.test)'/g)].map(m=>m[1]);
  assert.ok(used.length>0);
  for(const e of used) assert.ok(TEST_ACCOUNTS.some(a=>a.email===e),`${e} is in the seed but not a test account`);
});

// ── staging publishes only a commit CI has passed ───────────────────────────────────────────
const {ciVerdict,waitForCi}=require('../.github/scripts/staging.js');
const chk=(name,status,conclusion,id=1)=>({id,name,status,conclusion});

test('staging waits until CI has started and finished on the commit',()=>{
  assert.equal(ciVerdict([]).state,'wait');
  assert.equal(ciVerdict([chk('Analyze (javascript-typescript)','completed','success')]).state,'wait','other checks don\'t count');
  assert.equal(ciVerdict([chk('ci','in_progress',null),chk('db','completed','success')]).state,'wait');
  assert.equal(ciVerdict([chk('ci','completed','success'),chk('db','queued',null)]).state,'wait');
});
test('staging goes once CI\'s ci and db jobs have both passed (a skipped db counts as passed)',()=>{
  assert.equal(ciVerdict([chk('ci','completed','success'),chk('db','completed','success')]).state,'go');
  assert.equal(ciVerdict([chk('ci','completed','success'),chk('db','completed','skipped')]).state,'go');
  assert.equal(ciVerdict([chk('ci','completed','success')]).state,'go','a CI without a db job');
});
test('staging stops when CI failed, was cancelled or timed out, and says which job',()=>{
  for(const c of ['failure','cancelled','timed_out','action_required']){
    const v=ciVerdict([chk('ci','completed','success'),chk('db','completed',c)]);
    assert.equal(v.state,'fail',c); assert.match(v.why,new RegExp('db.*'+c));
  }
});
test('a re-run counts: the newest run of each job decides',()=>{
  assert.equal(ciVerdict([chk('ci','completed','failure',1),chk('ci','completed','success',2)]).state,'go');
  assert.equal(ciVerdict([chk('ci','completed','success',3),chk('ci','in_progress',null,4)]).state,'wait');
});
test('waiting polls until CI passes, and gives up with a clear message after the time limit',async()=>{
  const seq=[[],[chk('ci','in_progress',null)],[chk('ci','completed','success'),chk('db','completed','success')]];
  let t=0, calls=0; const log=[];
  await waitForCi({fetchRuns:async()=>seq[Math.min(calls++,seq.length-1)],sleep:async ms=>{t+=ms;},now:()=>t,everyMs:15000,log:m=>log.push(m)});
  assert.equal(calls,3); assert.ok(log.some(m=>/passed/i.test(m)));
  await assert.rejects(waitForCi({fetchRuns:async()=>[chk('ci','completed','failure')],sleep:async()=>{},now:()=>0,log:()=>{}}),/ci.*failure/);
  t=0;
  await assert.rejects(waitForCi({fetchRuns:async()=>[],sleep:async ms=>{t+=ms;},now:()=>t,timeoutMs:60000,everyMs:15000,log:()=>{}}),/hasn't finished/);
});
