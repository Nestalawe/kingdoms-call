// Config check: the database address and public key live in one place, site/kc-config.js (P0-13), so a
// staging copy of the site can swap that one file. Static (nothing runs):
//   - kc-config.js defines KC_CONFIG with supabaseUrl and supabaseKey;
//   - no page types in a Supabase project address or key;
//   - every page that creates the database client loads kc-config.js before the script that uses it.
// Reads site/ (or $KC_SITE).
const fs=require('fs'), path=require('path'), vm=require('vm');
const {SITE}=require('./lib/boot');

let fails=0;
const fail=m=>{ fails++; console.log('FAIL '+m); };
const ok=m=>console.log('ok   '+m);

const cfgPath=path.join(SITE,'kc-config.js');
if(!fs.existsSync(cfgPath)) fail('site/kc-config.js is missing');
else {
  const ctx={}; vm.createContext(ctx);
  try{ vm.runInContext(fs.readFileSync(cfgPath,'utf8')+'\n;globalThis.__cfg=KC_CONFIG;',ctx); }catch(e){ fail('kc-config.js: '+e.message); }
  const c=ctx.__cfg;
  if(c){
    if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(c.supabaseUrl||'')) fail(`kc-config.js: supabaseUrl isn't a Supabase project address (${c.supabaseUrl})`);
    else if(!(c.supabaseKey||'').length) fail('kc-config.js: supabaseKey is empty');
    else ok(`kc-config.js: KC_CONFIG names ${c.supabaseUrl} (${c.env||'no env'})`);
  }
}

const ADDRESS=/https:\/\/[a-z0-9]{20}\.supabase\.co/;
const KEY=/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|\bsb_(publishable|secret)_[A-Za-z0-9_-]{10,}/;
for(const name of fs.readdirSync(SITE).filter(f=>f.endsWith('.html')).sort()){
  const src=fs.readFileSync(path.join(SITE,name),'utf8');
  if(ADDRESS.test(src)) fail(`${name}: types in a Supabase project address; read KC_CONFIG.supabaseUrl instead`);
  if(KEY.test(src)) fail(`${name}: types in a Supabase key; read KC_CONFIG.supabaseKey instead`);
  const use=src.search(/\bcreateClient\s*\(/);
  if(use<0) continue;
  const load=src.indexOf('<script src="kc-config.js"></script>');
  if(load<0) fail(`${name}: creates the database client but never loads kc-config.js`);
  else if(load>use) fail(`${name}: loads kc-config.js after the script that creates the database client`);
  else ok(`${name}: loads kc-config.js before creating the database client`);
}
console.log(`${fails} config problem(s)`);
process.exit(fails?1:0);
