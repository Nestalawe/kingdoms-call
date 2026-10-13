// Third-party requests (P0-18): every page in site/, served from one folder as deployed and opened in Chromium with
// the real vendored supabase-js (not a stub), asks no other site for anything except Google Fonts. On the pages that
// use the database, the library has loaded (window.supabase.createClient) from the site's own vendor/ folder.
// No database is reached: kc-config.js is answered with an address on the test's own server, which has no database
// there, and every request to another site is refused and recorded. Level 4: only a real browser shows which
// requests a page makes. The static side (the tags in the pages) is vendor-supabase.test.js.
const fs=require('fs');
const {chromium}=require('playwright');
const {SITE,serve}=require('./lib/boot');

const FONTS=/^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

(async()=>{
  const srv=await serve();
  const browser=await chromium.launch();
  let fails=0;
  const fail=m=>{ fails++; console.log('FAIL '+m); };
  for(const name of fs.readdirSync(SITE).filter(f=>f.endsWith('.html')).sort()){
    const ctx=await browser.newContext();
    const outside=[], vendor=[];
    await ctx.route('**/*',r=>{
      const url=r.request().url();
      if(url.startsWith(srv.url+'/')){
        if(url===srv.url+'/kc-config.js') return r.fulfill({status:200,contentType:'application/javascript',
          body:`const KC_CONFIG=Object.freeze({env:'test',supabaseUrl:${JSON.stringify(srv.url+'/no-database')},supabaseKey:'test-key'});`});
        return r.continue();
      }
      if(FONTS.test(url)) return r.fulfill({status:200,contentType:/googleapis/.test(url)?'text/css':'font/woff2',body:''});
      outside.push(r.request().resourceType()+' '+url);
      return r.abort();
    });
    const p=await ctx.newPage();
    p.on('response',res=>{ if(res.url().startsWith(srv.url+'/vendor/')) vendor.push(res.status()+' '+res.url().slice(srv.url.length)); });
    await p.goto(srv.url+'/'+name,{waitUntil:'load'});
    await p.waitForTimeout(500);
    const usesDb=/\bcreateClient\s*\(/.test(fs.readFileSync(SITE+'/'+name,'utf8'));
    const before=fails;
    const lib=await p.evaluate(()=>typeof (window.supabase&&window.supabase.createClient));
    if(outside.length) fail(`${name}: ${outside.length} request(s) to another site: ${outside.slice(0,3).join(' | ')}`);
    if(usesDb&&lib!=='function') fail(`${name}: supabase-js didn't load (window.supabase.createClient is ${lib})`);
    if(usesDb&&!vendor.some(v=>/^200 \/vendor\/supabase-js-[\d.]+\.min\.js$/.test(v))) fail(`${name}: supabase-js wasn't served from vendor/ (${vendor.join(', ')||'no vendor/ request'})`);
    if(fails===before) console.log(`ok   ${name}: no request to another site but Google Fonts${usesDb?'; supabase-js from '+vendor.join(', '):''}`);
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(`${fails} problem(s)`);
  process.exit(fails?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
