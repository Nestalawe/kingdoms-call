// Boot check: every page in site/ starts under jsdom (data file inlined, Supabase stubbed with an
// empty database) without an uncaught error, an unhandled rejection or a console.error.
// The real-browser boot of the three portal pages is chromium-boot.test.js.
const fs=require('fs');
const {SITE,readPage,bootJsdom}=require('./lib/boot'); const {nullStub}=require('./lib/stub-db');

(async()=>{
  let fails=0;
  const pages=fs.readdirSync(SITE).filter(f=>f.endsWith('.html')).sort();
  for(const name of pages){
    const errors=[];
    const dom=bootJsdom(readPage(name),{supabase:{createClient:()=>nullStub()},url:'https://example.org/'+name,
      setup(w){
        w.addEventListener('error',e=>errors.push(String(e.error&&e.error.stack||e.message)));
        w.onunhandledrejection=e=>errors.push('unhandled rejection: '+String(e.reason&&e.reason.stack||e.reason));
        w.console.error=(...a)=>errors.push('console.error: '+a.map(String).join(' '));
        w.console.warn=()=>{}; w.console.log=()=>{};
      }});
    await new Promise(r=>setTimeout(r,1000));
    if(errors.length){ fails++; console.log(`FAIL ${name}: ${errors.length} error(s)\n     `+errors.slice(0,3).map(e=>e.split('\n').slice(0,2).join(' | ')).join('\n     ')); }
    else console.log(`ok   ${name}`);
    dom.window.close();
  }
  console.log(`${pages.length} pages booted · ${fails} with errors`);
  process.exit(fails?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
