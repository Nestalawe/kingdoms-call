// Database minimum check (P0-34). Static (nothing runs):
//   - every page that creates the database client declares KC_DB_MIN (the oldest database version it works
//     with), loads kc-db-guard.js, and starts through kcDbGuard(sb, KC_DB_MIN);
//   - no KC_DB_MIN is newer than the newest migration in supabase/migrations/: a site change can't need a
//     database change that isn't merged, or in the pull request it's stacked on.
// Reads site/ (or $KC_SITE) and supabase/migrations/.
const fs=require('fs'), path=require('path');
const {SITE,DB_VERSION}=require('./lib/boot');

let fails=0;
const fail=m=>{ fails++; console.log('FAIL '+m); };
const ok=m=>console.log('ok   '+m);

for(const name of fs.readdirSync(SITE).filter(f=>f.endsWith('.html')).sort()){
  const src=fs.readFileSync(path.join(SITE,name),'utf8');
  if(!/\bcreateClient\s*\(/.test(src)) continue;
  const min=(/\bconst KC_DB_MIN\s*=\s*['"](\d{14})['"]/.exec(src)||[])[1];
  if(!min){ fail(`${name}: uses the database but declares no KC_DB_MIN='<14-digit migration version>'`); continue; }
  if(!src.includes('<script src="kc-db-guard.js"></script>')) fail(`${name}: doesn't load kc-db-guard.js`);
  else if(!/kcDbGuard\(sb,\s*KC_DB_MIN\)\.then\(/.test(src)) fail(`${name}: doesn't start through kcDbGuard(sb, KC_DB_MIN).then(…)`);
  else if(min>DB_VERSION) fail(`${name}: KC_DB_MIN ${min} is newer than the newest migration here (${DB_VERSION}); merge the database change first, or stack this branch on it`);
  else ok(`${name}: KC_DB_MIN ${min} (newest migration ${DB_VERSION})`);
}
console.log(`${fails} database-minimum problem(s)`);
process.exit(fails?1:0);
