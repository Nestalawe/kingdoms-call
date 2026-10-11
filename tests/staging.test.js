// Unit tests for the staging deploy's logic (.github/scripts/staging.js), with no GitHub involved:
// the kc-config.js it writes for the staging site, and the comments it posts on pull requests.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('vm');
const {configFile,onStagingBody,replacedBody,MARKER}=require('../.github/scripts/staging.js');

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
});

test('the "replaced" comment says which pull request took its place',()=>{
  const body=replacedBody({by:22});
  assert.ok(body.startsWith(MARKER));
  assert.match(body,/#22/);
  assert.doesNotMatch(body,/https:\/\/kingdoms-call-staging/);
});
