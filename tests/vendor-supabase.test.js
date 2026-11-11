// supabase-js served with the site (P0-18; from npm since P1-17b): the pages load the Supabase library from the site
// itself, never from another site, so no outside party can change the code that holds players' logins. Static
// (nothing runs):
//   - no page loads a script from another site, or writes one in with document.write;
//   - the version is pinned: package.json names @supabase/supabase-js at one exact version, and the lock and the
//     installed package are that version;
//   - site/assets/ holds exactly one supabase-js-<hash>.js, byte for byte the package's browser build
//     (dist/umd/supabase.js), and its licence beside it, byte for byte the package's, so an edited or swapped copy
//     is caught (npm checks the package itself against the lock's integrity hash when it installs it);
//   - every page that creates the database client loads that file by a classic <script src> before its module
//     script (tools/build.ts writes the tag where the template has <!--kc-supabase-js-->).
// The real-browser side (which requests a page makes) is tests/browser/third-party-requests.spec.ts. Reads site/assets/
// (or $KC_SITE's), each built page, and each page's template and modules in src/ (tools/pages.ts).
const fs=require('fs'), path=require('path');
const {SITE}=require('./lib/boot');
const {SRC}=require('./lib/source.ts'); const {pageModules,pageNames}=require('../tools/pages.ts');

let fails=0;
const fail=m=>{ fails++; console.log('FAIL '+m); };
const ok=m=>console.log('ok   '+m);

const ROOT=path.join(__dirname,'..');
const PACKAGE='@supabase/supabase-js';
const pin=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')).dependencies?.[PACKAGE];
const locked=JSON.parse(fs.readFileSync(path.join(ROOT,'package-lock.json'),'utf8')).packages?.['node_modules/'+PACKAGE]?.version;
const browserBuild=require.resolve(PACKAGE+'/dist/umd/supabase.js');
const packageDir=path.dirname(require.resolve(PACKAGE+'/package.json'));
const installed=JSON.parse(fs.readFileSync(path.join(packageDir,'package.json'),'utf8')).version;
if(typeof pin!=='string'||!/^\d+\.\d+\.\d+$/.test(pin)) fail(`package.json should pin ${PACKAGE} to one exact version in dependencies; it says ${JSON.stringify(pin)}`);
else if(locked!==pin) fail(`package-lock.json has ${PACKAGE} ${String(locked)}, not package.json's ${pin}`);
else if(installed!==pin) fail(`node_modules has ${PACKAGE} ${installed}, not the pinned ${pin}: run npm ci`);
else ok(`${PACKAGE} pinned at ${pin}, in package.json, the lock and node_modules`);

const ASSETS=path.join(SITE,'assets');
const inAssets=re=>fs.existsSync(ASSETS)?fs.readdirSync(ASSETS).filter(f=>re.test(f)):[];
const libs=inAssets(/^supabase-js-(?!LICENSE-).*\.js$/), licences=inAssets(/^supabase-js-LICENSE-.*\.txt$/);
const lib=libs.length===1?libs[0]:null;
if(!lib) fail(`site/assets/ should hold exactly one supabase-js-<hash>.js; found ${libs.length?libs.join(', '):'none'}`);
else if(!fs.readFileSync(path.join(ASSETS,lib)).equals(fs.readFileSync(browserBuild))) fail(`site/assets/${lib} isn't byte for byte ${PACKAGE}'s dist/umd/supabase.js`);
else ok(`site/assets/${lib} is ${PACKAGE}'s browser build, byte for byte`);
if(licences.length!==1) fail(`site/assets/ should hold exactly one supabase-js-LICENSE-<hash>.txt; found ${licences.length?licences.join(', '):'none'}`);
else if(!fs.readFileSync(path.join(ASSETS,licences[0])).equals(fs.readFileSync(path.join(packageDir,'LICENSE')))) fail(`site/assets/${licences[0]} isn't byte for byte ${PACKAGE}'s LICENSE`);
else ok(`site/assets/${licences[0]} is ${PACKAGE}'s licence`);

for(const name of pageNames()){
  const html=fs.readFileSync(path.join(SRC,name),'utf8');
  const code=pageModules(name).map(f=>fs.readFileSync(path.join(SRC,f),'utf8')).join('\n');
  const built=fs.readFileSync(path.join(SITE,name),'utf8');
  const outside=[...(html+built).matchAll(/<script[^>]*\bsrc="((?:https?:)?\/\/[^"]*)"/g)].map(m=>m[1]);
  if(outside.length) fail(`${name}: loads a script from another site: ${outside.join(', ')}`);
  if(/document\.write\s*\(/.test(html+code)) fail(`${name}: uses document.write`);
  if(/jsdelivr|unpkg/i.test(html+code)) fail(`${name}: still names a CDN (jsdelivr or unpkg)`);
  if(!/\bcreateClient\s*\(/.test(code)||!lib) continue;
  const tag=built.indexOf(`<script src="./assets/${lib}"></script>`);
  const module=built.search(/<script type="module"[^>]*\bsrc=/);
  if(tag<0) fail(`${name}: creates the database client but doesn't load assets/${lib}`);
  else if(module>=0&&module<tag) fail(`${name}: loads assets/${lib} after its module script`);
  else ok(`${name}: loads assets/${lib} before creating the database client (in its modules)`);
}

console.log(`${fails} problem(s)`);
process.exit(fails?1:0);
