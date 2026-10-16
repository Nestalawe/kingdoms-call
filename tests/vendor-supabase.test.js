// Vendored supabase-js (P0-18): the pages load the Supabase library from the site itself, never from a CDN, so no
// outside party can change the code that holds players' logins. Static (nothing runs):
//   - site/vendor/ holds exactly one supabase-js-<version>.min.js;
//   - no page loads a script from another site, or writes one in with document.write;
//   - every page that creates the database client loads that file, before the script that uses it;
//   - docs/ARCHITECTURE.md names the same version and the file's SHA-256, so an edited or swapped copy is caught.
// The real-browser side (which requests a page makes) is tests/browser/third-party-requests.spec.ts. Reads site/
// (or $KC_SITE).
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const {SITE}=require('./lib/boot');

let fails=0;
const fail=m=>{ fails++; console.log('FAIL '+m); };
const ok=m=>console.log('ok   '+m);

const VENDOR=path.join(SITE,'vendor');
const libs=fs.existsSync(VENDOR)?fs.readdirSync(VENDOR).filter(f=>/^supabase-js-.*\.js$/.test(f)):[];
const lib=libs.length===1&&/^supabase-js-(\d+\.\d+\.\d+)\.min\.js$/.test(libs[0])?libs[0]:null;
if(!lib) fail(`site/vendor/ should hold exactly one supabase-js-<version>.min.js; found ${libs.length?libs.join(', '):'none'}`);
else ok(`site/vendor/${lib}`);

for(const name of fs.readdirSync(SITE).filter(f=>f.endsWith('.html')).sort()){
  const src=fs.readFileSync(path.join(SITE,name),'utf8');
  const outside=[...src.matchAll(/<script[^>]*\bsrc="((?:https?:)?\/\/[^"]*)"/g)].map(m=>m[1]);
  if(outside.length) fail(`${name}: loads a script from another site: ${outside.join(', ')}`);
  if(/document\.write\s*\(/.test(src)) fail(`${name}: uses document.write`);
  if(/jsdelivr|unpkg/i.test(src)) fail(`${name}: still names a CDN (jsdelivr or unpkg)`);
  const use=src.search(/\bcreateClient\s*\(/);
  if(use<0||!lib) continue;
  const load=src.indexOf(`<script src="vendor/${lib}"></script>`);
  if(load<0) fail(`${name}: creates the database client but doesn't load vendor/${lib}`);
  else if(load>use) fail(`${name}: loads vendor/${lib} after the script that creates the database client`);
  else ok(`${name}: loads vendor/${lib} before creating the database client`);
}

if(lib){
  const doc=fs.readFileSync(path.join(__dirname,'..','docs','ARCHITECTURE.md'),'utf8');
  const sha=crypto.createHash('sha256').update(fs.readFileSync(path.join(VENDOR,lib))).digest('hex');
  if(!doc.includes(`site/vendor/${lib}`)) fail(`docs/ARCHITECTURE.md doesn't name site/vendor/${lib}`);
  else if(!doc.includes(sha)) fail(`docs/ARCHITECTURE.md doesn't give ${lib}'s SHA-256 (${sha}): the file changed, or the doc wasn't updated with it`);
  else ok(`docs/ARCHITECTURE.md names ${lib} and its SHA-256`);
}

console.log(`${fails} problem(s)`);
process.exit(fails?1:0);
