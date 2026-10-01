// Unit tests for the review gate's decision (.github/scripts/review-gate.js), with no GitHub involved.
// The gate: a PR that changes a gated path, or has the label needs-theo, needs an approval on its latest
// commit from crumblingworld; or from Nestalawe when crumblingworld opened the PR. Anything else passes.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'), path=require('path');
const {decide,parsePaths,isGated}=require('../.github/scripts/review-gate.js');

const GLOBS=['supabase/**','.github/**','site/vendor/**'];
const HEAD='a'.repeat(40), OLD='b'.repeat(40);
const file=(filename,previous_filename)=>previous_filename?{filename,previous_filename,status:'renamed'}:{filename};
const review=(login,state,commit_id=HEAD)=>({user:{login},state,commit_id});
const pr=over=>decide({author:'Nestalawe',labels:[],headSha:HEAD,files:[file('site/index.html')],reviews:[],globs:GLOBS,...over});

test('ungated: a site-only PR passes with no review',()=>{
  const r=pr({});
  assert.equal(r.pass,true);
  assert.equal(r.gated,false);
});

test('gated path: a PR touching supabase/ fails without an approval',()=>{
  const r=pr({files:[file('site/index.html'),file('supabase/migrations/0001_baseline.sql')]});
  assert.equal(r.pass,false);
  assert.match(r.reason,/supabase\/migrations\/0001_baseline\.sql/);
  assert.match(r.reason,/crumblingworld/);
});

test('gated path: .github/ and site/vendor/ are gated too',()=>{
  assert.equal(pr({files:[file('.github/workflows/ci.yml')]}).pass,false);
  assert.equal(pr({files:[file('site/vendor/supabase-js-2.0.0.min.js')]}).pass,false);
});

test('label: needs-theo gates a PR with no gated files',()=>{
  const r=pr({labels:['staging','needs-theo']});
  assert.equal(r.pass,false);
  assert.match(r.reason,/needs-theo/);
});

test('Theo approved the latest commit: passes',()=>{
  const r=pr({files:[file('supabase/x.sql')],labels:['needs-theo'],reviews:[review('crumblingworld','APPROVED')]});
  assert.equal(r.pass,true);
  assert.equal(r.gated,true);
});

test('Theo-authored, Toby approved the latest commit: passes',()=>{
  const r=pr({author:'crumblingworld',files:[file('.github/workflows/ci.yml')],reviews:[review('Nestalawe','APPROVED')]});
  assert.equal(r.pass,true);
});

test('Theo-authored: an approval from anyone but Toby does not count',()=>{
  const r=pr({author:'crumblingworld',labels:['needs-theo'],
    reviews:[review('crumblingworld','APPROVED'),review('someone-else','APPROVED')]});
  assert.equal(r.pass,false);
  assert.match(r.reason,/Nestalawe/);
});

test('Toby-authored: an approval from someone other than Theo does not count',()=>{
  assert.equal(pr({labels:['needs-theo'],reviews:[review('someone-else','APPROVED')]}).pass,false);
});

test('an approval of an earlier commit does not count',()=>{
  const r=pr({labels:['needs-theo'],reviews:[review('crumblingworld','APPROVED',OLD)]});
  assert.equal(r.pass,false);
  assert.match(r.reason,/earlier commit/);
});

test('the latest decision counts: approval, then changes requested, fails',()=>{
  const r=pr({labels:['needs-theo'],reviews:[review('crumblingworld','APPROVED'),review('crumblingworld','CHANGES_REQUESTED')]});
  assert.equal(r.pass,false);
});

test('the latest decision counts: changes requested, then approval, passes',()=>{
  const r=pr({labels:['needs-theo'],reviews:[review('crumblingworld','CHANGES_REQUESTED'),review('crumblingworld','APPROVED')]});
  assert.equal(r.pass,true);
});

test('a comment after an approval does not cancel it',()=>{
  const r=pr({labels:['needs-theo'],reviews:[review('crumblingworld','APPROVED'),review('crumblingworld','COMMENTED')]});
  assert.equal(r.pass,true);
});

test('a dismissed approval does not count',()=>{
  assert.equal(pr({labels:['needs-theo'],reviews:[review('crumblingworld','DISMISSED')]}).pass,false);
});

test('logins are compared ignoring case',()=>{
  assert.equal(pr({labels:['needs-theo'],reviews:[review('CrumblingWorld','APPROVED')]}).pass,true);
  assert.equal(pr({author:'CRUMBLINGWORLD',labels:['needs-theo'],reviews:[review('nestalawe','APPROVED')]}).pass,true);
});

test('a file moved out of a gated folder is still gated',()=>{
  assert.equal(pr({files:[file('tools/x.sql','supabase/x.sql')]}).pass,false);
});

test('globs: ** spans folders, * stays within one, and the folder name must match exactly',()=>{
  assert.equal(isGated('.github/workflows/ci.yml',GLOBS),true);
  assert.equal(isGated('site/vendor/a/b/c.js',GLOBS),true);
  assert.equal(isGated('.githubx/ci.yml',GLOBS),false);
  assert.equal(isGated('site/vendorx.js',GLOBS),false);
  assert.equal(isGated('docs/supabase/notes.md',GLOBS),false);
  assert.equal(isGated('site/kc-safe.js',['site/*.js']),true);
  assert.equal(isGated('site/x/kc-safe.js',['site/*.js']),false);
  assert.equal(isGated('package.json',['package.json']),true);
  assert.equal(isGated('site/package.json',['package.json']),false);
});

test('paths file: one glob per line; comments and blank lines are skipped',()=>{
  assert.deepEqual(parsePaths('# heading\n\nsupabase/**\n  .github/**  \n# package.json\n'),['supabase/**','.github/**']);
});

test('the real paths file gates supabase/, .github/ and site/vendor/',()=>{
  const globs=parsePaths(fs.readFileSync(path.join(__dirname,'..','.github','review-gate-paths'),'utf8'));
  for(const g of GLOBS) assert.ok(globs.includes(g),g);
  assert.equal(isGated('site/index.html',globs),false);
});
