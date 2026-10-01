// QUARANTINED 2026-10-01: the good and missing data-file cases pass; the stale case needs the pre-refactor data file in tests/quarantine/before/, which is not kept.
// Headless Chromium smoke for the one-source pass: both portals served from ONE folder over HTTP
// (as deployed), the Supabase CDN answered with a stub, and three data-file situations:
//   good    — the current kingdoms-call-data.js beside the portals  → both boot, 0 page errors
//   missing — no data file                                         → both show their "data file" message
//   stale   — an older data file (the pre-pass build)              → both refuse, naming the stamp
const {chromium}=require('playwright'); const fs=require('fs'); const path=require('path'); const os=require('os');
const {sitePath,serve}=require('../lib/boot'); const {browserSource}=require('../lib/stub-db');
const BEFORE=process.env.KC_BEFORE_DIR||path.join(__dirname,'before');
const STUB=browserSource.null;
(async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'kc-site-'));
  const put=(data)=>{ ['kingdoms-call-gm-portal.html','kingdoms-call-player-portal.html'].forEach(f=>fs.copyFileSync(sitePath(f),path.join(root,f)));
    const d=path.join(root,'kingdoms-call-data.js'); if(fs.existsSync(d)) fs.unlinkSync(d); if(data) fs.copyFileSync(data,d); };
  const server=await serve(root); const port=server.address().port;
  const browser=await chromium.launch();
  let fail=0;
  const visit=async(file)=>{ const ctx=await browser.newContext(); const page=await ctx.newPage(); const errs=[];
    page.on('pageerror',e=>errs.push(e.message));
    await page.route(/cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis/,r=>r.fulfill({status:200,contentType:'text/javascript',body:/fonts/.test(r.request().url())?'':STUB}));
    await page.goto(`http://127.0.0.1:${port}/${file}`); await page.waitForTimeout(900);
    const text=await page.evaluate(()=>document.body.innerText);
    const kc=await page.evaluate(()=>{ try{ return typeof KC_UNIT_CLASS; }catch(e){ return 'unreachable'; } });
    await ctx.close(); return {errs,text,kc}; };
  for(const [label,data] of [['good',sitePath('kingdoms-call-data.js')],['missing',null],['stale',path.join(BEFORE,'kingdoms-call-data.js')]]){
    put(data);
    for(const f of ['kingdoms-call-gm-portal.html','kingdoms-call-player-portal.html']){
      const r=await visit(f); const who=f.includes('gm')?'GM    ':'Player';
      if(label==='good'){
        const pass=r.errs.length===0&&r.kc==='object'&&!/could not start|out of date|missing/i.test(r.text);
        if(!pass) fail++;
        console.log(`${pass?'ok  ':'FAIL'} ${label.padEnd(7)} ${who}: ${r.errs.length} page errors, shared tables ${r.kc}`);
      } else {
        const said=/kingdoms-call-data\.js/.test(r.text);
        if(!said) fail++;
        console.log(`${said?'ok  ':'FAIL'} ${label.padEnd(7)} ${who}: shows its data-file message — "${(r.text.match(/[^\n]*kingdoms-call-data\.js[^\n]*/)||[''])[0].slice(0,110)}"`);
      }
    }
  }
  await browser.close(); server.close();
  console.log(fail?`${fail} FAILURE(S)`:'all Chromium checks passed');
  process.exit(fail?1:0);
})();
