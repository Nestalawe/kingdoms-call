// Staging footer (P0-33): on the staging site, every page's footer says which pull request and commit it
// is ("Staging · PR #21 · abcdef1", linking to the pull request); on the live site, nothing new shows.
// Each page in site/ is booted in jsdom three times:
//   - with site/kc-config.js as it is (the live one: no `deployed`): no staging line;
//   - with the kc-config.js the staging deploy writes (.github/scripts/staging.js): the line, in the page's
//     <footer> where it has one, else in a small fixed stamp;
//   - (two pages) with a hand-made config whose `deployed` isn't a number and a commit: no line, no markup.
// Reads site/ (or $KC_SITE).
const fs=require('fs');
const {SITE,sitePath,readPage,bootJsdom}=require('./lib/boot'); const {nullStub}=require('./lib/stub-db');
const {configFile}=require('../.github/scripts/staging.js');

const SHA='abcdef1234567890abcdef1234567890abcdef12';
const LIVE=fs.readFileSync(sitePath('kc-config.js'),'utf8');
const STAGING=configFile({url:'https://yquaxxzdepqquitlgxkh.supabase.co',key:'sb_publishable_example_key_1234567890',deployed:{pr:21,sha:SHA}});
const HOSTILE=`const KC_CONFIG=Object.freeze({env:'staging',supabaseUrl:'https://yquaxxzdepqquitlgxkh.supabase.co',
  supabaseKey:'k',deployed:{pr:'<img id="kc-injected" src="x">',sha:'<b>${SHA}</b>'}});`;

let fails=0;
const fail=m=>{ fails++; console.log('FAIL '+m); };
const ok=m=>console.log('ok   '+m);
// The page's text as shown: without its scripts' source (kc-staging-footer.js itself says "Staging · PR").
const shown=doc=>{ const b=doc.body.cloneNode(true); b.querySelectorAll('script').forEach(s=>s.remove()); return b.textContent; };

async function boot(name,config){
  const html=readPage(name).split(LIVE).join(config);
  const dom=bootJsdom(html,{supabase:{createClient:()=>nullStub()},url:'https://example.org/'+name,
    setup(w){ w.console.warn=()=>{}; w.console.log=()=>{}; w.console.error=()=>{}; w.onunhandledrejection=()=>{}; }});
  await new Promise(r=>setTimeout(r,100));
  return dom;
}

(async()=>{
  const pages=fs.readdirSync(SITE).filter(f=>f.endsWith('.html')).sort();
  for(const name of pages){
    let dom=await boot(name,LIVE);
    let doc=dom.window.document;
    if(doc.getElementById('kc-staging-footer')||/Staging · PR/.test(shown(doc))) fail(`${name}: shows a staging line with the live config`);
    else ok(`${name}: no staging line with the live config`);
    dom.window.close();

    dom=await boot(name,STAGING); doc=dom.window.document;
    const el=doc.getElementById('kc-staging-footer');
    if(!el) fail(`${name}: no staging line with the staging config (does the page load kc-config.js and kc-staging-footer.js?)`);
    else{
      const text=el.textContent, href=el.getAttribute('href');
      const placed=doc.querySelector('footer')?!!el.closest('footer'):el.style.position==='fixed';
      if(text!=='Staging · PR #21 · abcdef1') fail(`${name}: the staging line reads "${text}"`);
      else if(href!=='https://github.com/Nestalawe/kingdoms-call/pull/21') fail(`${name}: the staging line links to ${href}`);
      else if(!placed) fail(`${name}: the staging line isn't in the page's footer (or, with none, a fixed stamp)`);
      else ok(`${name}: "${text}" → ${href}`);
    }
    dom.window.close();
  }

  for(const name of ['index.html','kingdoms-call-player-portal.html']){
    const dom=await boot(name,HOSTILE), doc=dom.window.document;
    if(doc.getElementById('kc-staging-footer')||doc.getElementById('kc-injected')||/Staging · PR/.test(shown(doc))) fail(`${name}: a malformed \`deployed\` still shows something`);
    else ok(`${name}: a malformed \`deployed\` shows nothing`);
    dom.window.close();
  }
  console.log(`${fails} staging-footer problem(s)`);
  process.exit(fails?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
