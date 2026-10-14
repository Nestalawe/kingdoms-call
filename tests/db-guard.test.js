// Database version guard (P0-34): each page that uses the database (both portals, the Hall of Fame and the Overlord page) asks
// the database its version, rpc('kc_db_version'), before anything else, and starts only if it's at least the
// page's KC_DB_MIN. Each page is booted in jsdom against a stand-in database answering:
//   - up to date (the newest migration in the repo): it boots;
//   - older than KC_DB_MIN, or no kc_db_version at all (a database from before P0-34): it stops, showing
//     "The game is being updated" and a Reload button, having made no other database call;
//   - no answer twice (network): it stops the same way, after asking twice;
//   - no answer once, then up to date: it boots (one retry).
// Reads site/ (or $KC_SITE).
const {readPage,bootJsdom,DB_VERSION}=require('./lib/boot'); const {nullStub}=require('./lib/stub-db');

const PAGES=['kingdoms-call-gm-portal.html','kingdoms-call-player-portal.html','kingdoms-call-leaderboard.html','kingdoms-call-overlord.html'];
const OLDER='20261010000000';   // older than any KC_DB_MIN (the first is P0-34's own migration)

let fails=0;
const fail=m=>{ fails++; console.log('FAIL '+m); };
const ok=m=>console.log('ok   '+m);

async function boot(name,dbVersion){
  const calls=[];
  const dom=bootJsdom(readPage(name),{supabase:{createClient:()=>nullStub()},url:'https://example.org/'+name,dbVersion,dbCalls:calls,
    setup(w){ w.console.warn=()=>{}; w.console.log=()=>{}; w.console.error=()=>{}; }});
  await new Promise(r=>setTimeout(r,300));
  const sp=dom.window.document.getElementById('spinner');
  const state={booted:!!sp&&sp.style.display==='none',
    stopped:!!sp&&sp.style.display!=='none'&&/being updated/.test(sp.textContent)&&[...sp.querySelectorAll('button')].some(b=>/Reload/.test(b.textContent)),
    calls, text:sp?sp.textContent.replace(/\s+/g,' ').trim().slice(0,160):'(no spinner)'};
  dom.window.close();
  return state;
}

(async()=>{
  console.log(`stand-in database version when up to date: ${DB_VERSION}`);
  for(const name of PAGES){
    const cases=[
      ['up to date',DB_VERSION,s=>s.booted&&s.calls[0]==='rpc:kc_db_version'],
      ['older than KC_DB_MIN',OLDER,s=>s.stopped&&s.calls.join()==='rpc:kc_db_version'],
      ['no kc_db_version (before P0-34)',null,s=>s.stopped&&s.calls.join()==='rpc:kc_db_version'],
      ['no answer twice','offline',s=>s.stopped&&s.calls.join()==='rpc:kc_db_version,rpc:kc_db_version'],
      ['no answer once, then up to date',['offline',DB_VERSION],s=>s.booted&&s.calls.slice(0,2).join()==='rpc:kc_db_version,rpc:kc_db_version'],
    ];
    for(const [label,answer,good] of cases){
      const s=await boot(name,answer);
      if(good(s)) ok(`${name}, ${label}: ${s.booted?'boots':'stops'}`);
      else fail(`${name}, ${label}: booted=${s.booted} stopped=${s.stopped} calls=[${s.calls.slice(0,4).join(', ')}${s.calls.length>4?', …':''}] spinner="${s.text}"`);
    }
  }
  console.log(`${fails} db-guard problem(s)`);
  process.exit(fails?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
