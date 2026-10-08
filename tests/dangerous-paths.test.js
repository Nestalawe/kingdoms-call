// Unit tests for the dangerous-paths warning (.github/scripts/dangerous-paths.js), with no GitHub involved.
// A pull request that changes a path listed in .github/dangerous-paths gets one warning comment asking to
// talk the change through with Theo before merging. It never blocks. These tests cover which files match
// and what the comment says.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'), path=require('path');
const {match,commentBody,parsePaths,isDangerous,MARKER}=require('../.github/scripts/dangerous-paths.js');

const GLOBS=['supabase/**','.github/**','site/vendor/**'];
const file=(filename,previous_filename)=>previous_filename?{filename,previous_filename,status:'renamed'}:{filename};

test('a site-only change matches nothing',()=>{
  assert.deepEqual(match([file('site/index.html'),file('tests/run.js')],GLOBS),[]);
});

test('supabase/, .github/ and site/vendor/ all match',()=>{
  assert.deepEqual(match([file('supabase/migrations/0001_baseline.sql')],GLOBS),['supabase/migrations/0001_baseline.sql']);
  assert.deepEqual(match([file('.github/workflows/ci.yml')],GLOBS),['.github/workflows/ci.yml']);
  assert.deepEqual(match([file('site/vendor/supabase-js-2.0.0.min.js')],GLOBS),['site/vendor/supabase-js-2.0.0.min.js']);
});

test('only the dangerous files are reported, each once',()=>{
  const files=[file('site/index.html'),file('supabase/a.sql'),file('supabase/a.sql'),file('.github/x.yml')];
  assert.deepEqual(match(files,GLOBS),['supabase/a.sql','.github/x.yml']);
});

test('a file moved out of a dangerous folder still counts, by its old name',()=>{
  assert.deepEqual(match([file('tools/x.sql','supabase/x.sql')],GLOBS),['supabase/x.sql']);
});

test('globs: ** spans folders, * stays within one, and the folder name must match exactly',()=>{
  assert.equal(isDangerous('.github/workflows/ci.yml',GLOBS),true);
  assert.equal(isDangerous('site/vendor/a/b/c.js',GLOBS),true);
  assert.equal(isDangerous('.githubx/ci.yml',GLOBS),false);
  assert.equal(isDangerous('site/vendorx.js',GLOBS),false);
  assert.equal(isDangerous('docs/supabase/notes.md',GLOBS),false);
  assert.equal(isDangerous('site/kc-safe.js',['site/*.js']),true);
  assert.equal(isDangerous('site/x/kc-safe.js',['site/*.js']),false);
  assert.equal(isDangerous('package.json',['package.json']),true);
  assert.equal(isDangerous('site/package.json',['package.json']),false);
});

test('globs ignore case: a dangerous folder spelled with other capitals still counts',()=>{
  assert.equal(isDangerous('Supabase/migrations/x.sql',GLOBS),true);
  assert.equal(isDangerous('.GitHub/workflows/ci.yml',GLOBS),true);
  assert.equal(isDangerous('site/Vendor/x.js',GLOBS),true);
  assert.equal(isDangerous('Site/Vendorx.js',GLOBS),false);
});

test('paths file: one glob per line; comments and blank lines are skipped',()=>{
  assert.deepEqual(parsePaths('# heading\n\nsupabase/**\n  .github/**  \n# package.json\n'),['supabase/**','.github/**']);
});

test('the real paths file covers supabase/, .github/ and site/vendor/, and not the rest of site/',()=>{
  const globs=parsePaths(fs.readFileSync(path.join(__dirname,'..','.github','dangerous-paths'),'utf8'));
  for(const g of GLOBS) assert.ok(globs.includes(g),g);
  assert.equal(isDangerous('site/index.html',globs),false);
  assert.equal(isDangerous('tests/run.js',globs),false);
});

test('the warning names the files, says to talk it through with Theo, and carries the marker',()=>{
  const body=commentBody(['supabase/a.sql','.github/x.yml']);
  assert.ok(body.startsWith(MARKER));
  assert.match(body,/talk it through with Theo before merging/);
  assert.match(body,/`supabase\/a\.sql`/);
  assert.match(body,/`\.github\/x\.yml`/);
});

test('a long list is shortened, so the comment stays readable',()=>{
  const many=Array.from({length:30},(_,i)=>`supabase/m${i}.sql`);
  const body=commentBody(many);
  assert.match(body,/`supabase\/m19\.sql`/);
  assert.doesNotMatch(body,/`supabase\/m20\.sql`/);
  assert.match(body,/and 10 more/);
});

test('once nothing dangerous is left, the comment says so (and keeps the marker)',()=>{
  const body=commentBody([]);
  assert.ok(body.startsWith(MARKER));
  assert.match(body,/no longer changes/);
  assert.doesNotMatch(body,/talk it through/);
});
