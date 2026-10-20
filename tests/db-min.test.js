// Database minimum check (P0-34). Static (nothing runs):
//   - every page that creates the database client declares KC_DB_MIN (the oldest database version it works
//     with), imports kc-db-guard.js, and starts through kcDbGuard(sb, KC_DB_MIN);
//   - no KC_DB_MIN is newer than the newest migration in supabase/migrations/: a site change can't need a
//     database change that isn't merged, or in the pull request it's stacked on.
// Reads each page's template and modules in src/ (tools/pages.ts; until P1-09d, the built pages in site/) and
// supabase/migrations/. Since P1-09d kc-db-guard.js is a module the page imports, not a <script> of its own.
const fs=require('fs'), path=require('path');
const {DB_VERSION}=require('./lib/boot');
const {SRC}=require('./lib/source.ts'); const {pageModules,pageNames}=require('../tools/pages.ts');

let fails=0;
const fail=m=>{ fails++; console.log('FAIL '+m); };
const ok=m=>console.log('ok   '+m);

for(const name of pageNames()){
  const modules=pageModules(name);
  // the page's own code: not the guard itself, whose comment shows the call
  const src=modules.filter(f=>f!=='db/kc-db-guard.js').map(f=>fs.readFileSync(path.join(SRC,f),'utf8')).join('\n');
  if(!/\bcreateClient\s*\(/.test(src)) continue;
  const min=(/\bconst KC_DB_MIN\s*=\s*['"](\d{14})['"]/.exec(src)||[])[1];
  if(!min){ fail(`${name}: uses the database but declares no KC_DB_MIN='<14-digit migration version>'`); continue; }
  if(!modules.includes('db/kc-db-guard.js')) fail(`${name}: doesn't import kc-db-guard.js`);
  else if(!/kcDbGuard\(sb,\s*KC_DB_MIN\)\.then\(/.test(src)) fail(`${name}: doesn't start through kcDbGuard(sb, KC_DB_MIN).then(…)`);
  else if(min>DB_VERSION) fail(`${name}: KC_DB_MIN ${min} is newer than the newest migration here (${DB_VERSION}); merge the database change first, or stack this branch on it`);
  else ok(`${name}: KC_DB_MIN ${min} (newest migration ${DB_VERSION})`);
}
console.log(`${fails} database-minimum problem(s)`);
process.exit(fails?1:0);
