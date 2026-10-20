// Vendored supabase-js (P0-18): the pages load the Supabase library from the site itself, never from a CDN, so no
// outside party can change the code that holds players' logins. Static (nothing runs):
//   - site/vendor/ holds exactly one supabase-js-<version>.min.js;
//   - no page loads a script from another site, or writes one in with document.write;
//   - every page that creates the database client loads that file, before the script that uses it: a classic
//     <script src> in its template, which runs before the page's module script (P1-09d);
//   - docs/ARCHITECTURE.md names the same version (as public/vendor/<file>, its source) and the file's SHA-256, so an
//     edited or swapped copy is caught.
// The real-browser side (which requests a page makes) is tests/browser/third-party-requests.spec.ts. Reads site/vendor/
// (or $KC_SITE's), and each page's template and modules in src/ (tools/pages.ts; until P1-09d, the built pages).
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const {SITE}=require('./lib/boot');
const {SRC}=require('./lib/source.ts'); const {pageModules,pageNames}=require('../tools/pages.ts');

let fails=0;
const fail=m=>{ fails++; console.log('FAIL '+m); };
const ok=m=>console.log('ok   '+m);

const VENDOR=path.join(SITE,'vendor');
const libs=fs.existsSync(VENDOR)?fs.readdirSync(VENDOR).filter(f=>/^supabase-js-.*\.js$/.test(f)):[];
const lib=libs.length===1&&/^supabase-js-(\d+\.\d+\.\d+)\.min\.js$/.test(libs[0])?libs[0]:null;
if(!lib) fail(`site/vendor/ should hold exactly one supabase-js-<version>.min.js; found ${libs.length?libs.join(', '):'none'}`);
else ok(`site/vendor/${lib}`);

for(const name of pageNames()){
  const html=fs.readFileSync(path.join(SRC,name),'utf8');
  const code=pageModules(name).map(f=>fs.readFileSync(path.join(SRC,f),'utf8')).join('\n');
  const outside=[...html.matchAll(/<script[^>]*\bsrc="((?:https?:)?\/\/[^"]*)"/g)].map(m=>m[1]);
  if(outside.length) fail(`${name}: loads a script from another site: ${outside.join(', ')}`);
  if(/document\.write\s*\(/.test(html+code)) fail(`${name}: uses document.write`);
  if(/jsdelivr|unpkg/i.test(html+code)) fail(`${name}: still names a CDN (jsdelivr or unpkg)`);
  if(!/\bcreateClient\s*\(/.test(code)||!lib) continue;
  if(!html.includes(`<script src="vendor/${lib}"></script>`)) fail(`${name}: creates the database client but doesn't load vendor/${lib}`);
  else ok(`${name}: loads vendor/${lib} before creating the database client (in its modules)`);
}

if(lib){
  const doc=fs.readFileSync(path.join(__dirname,'..','docs','ARCHITECTURE.md'),'utf8');
  const sha=crypto.createHash('sha256').update(fs.readFileSync(path.join(VENDOR,lib))).digest('hex');
  // The doc names the copy's source, public/vendor/ (copied as it is since P1-09d; src/vendor/ from P1-05).
  if(!doc.includes(`public/vendor/${lib}`)) fail(`docs/ARCHITECTURE.md doesn't name public/vendor/${lib}`);
  else if(!doc.includes(sha)) fail(`docs/ARCHITECTURE.md doesn't give ${lib}'s SHA-256 (${sha}): the file changed, or the doc wasn't updated with it`);
  else ok(`docs/ARCHITECTURE.md names ${lib} and its SHA-256`);
}

console.log(`${fails} problem(s)`);
process.exit(fails?1:0);
