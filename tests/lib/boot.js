// tests/lib/boot.js: the one way tests load the pages in site/.
//
//   SITE, sitePath(name)        where the deployable files live (site/, or $KC_SITE)
//   readPage(nameOrPath)        page HTML ready for jsdom, which runs no module script and loads no stylesheet: its
//                               bundle (assets/<page>-<hash>.js, P1-09d, P1-06b) as a classic script at the end of the body, strict as
//                               a module is; its stylesheet inline where its <link> was; its local classic scripts
//                               (kc-config.js, kc-staging-footer.js) inlined; the supabase-js <script> removed
//   pageFiles(nameOrPath)       the files readPage reads for that page: the page, then each file it inlines
//   bootJsdom(html, opts)       a jsdom with the page's scripts running and a Supabase stub installed
//   serve(dir, port)            a static file server for Chromium (as the pages are deployed: one folder)
//   routeExternal(target, cdn)  answers supabase-js with a stub and fonts with nothing (Playwright page/context)
//   DB_VERSION                  the newest migration in supabase/migrations/: the database version every
//                               stand-in database reports through rpc('kc_db_version') (P0-34), unless a test
//                               says otherwise (bootJsdom's opts.dbVersion)
//
// Fixed seed: when KC_SEED is set (npm test sets it), this Node process's Math.random is replaced by a seeded sfc32
// generator (for a harness's own random orders), and every page booted with bootJsdom is given a seed: its dice,
// kcRng() (src/engine/rng.ts, P1-07), are the same sfc32 generator seeded the same way. Same seed, same random
// sequence. bootJsdom's opts.seed and opts.now pin one page completely: its dice and its clock (P1-01a). A page given
// no seed seeds its dice from crypto.getRandomValues, as on the live site.
const fs=require('fs'), path=require('path'), http=require('http');

// KC_SITE points the tests at another copy of the site (e.g. a deliberately broken one).
const SITE=path.resolve(process.env.KC_SITE||path.join(__dirname,'..','..','site'));
const sitePath=name=>path.join(SITE,name);

// A <script src="…"> naming a plain file beside the page (no "/" or ":"), e.g. kc-config.js.
const LOCAL_TAG=/<script src="([A-Za-z0-9._-]+\.js)"><\/script>/g;
// The page's bundle and its stylesheet, as Vite writes their tags (tools/build.ts, P1-09d).
const BUNDLE_TAG=/[ \t]*<script type="module" crossorigin src="\.\/(assets\/[A-Za-z0-9._-]+\.js)"><\/script>\n?/g;
const STYLE_TAG=/<link rel="stylesheet" crossorigin href="\.\/(assets\/[A-Za-z0-9._-]+\.css)">/g;
// supabase-js: site/vendor/supabase-js-<version>.min.js since P0-18; a CDN before (still removed, so KC_SITE can point
// at an older copy of the site). Tests install a stand-in instead.
const SUPABASE_TAG=/<script src="(?:vendor\/supabase-js-[^"]*|https:\/\/cdn\.jsdelivr[^"]*)"><\/script>/g;

// A name ('kingdoms-call-gm-portal.html') is looked up in site/; a path is used as given. Local scripts are
// the ones beside the page, as when deployed (jsdom doesn't fetch them itself).
const pageFile=nameOrPath=>/[\\/]/.test(nameOrPath)?nameOrPath:sitePath(nameOrPath);
function readPage(nameOrPath){
  const file=pageFile(nameOrPath);
  const beside=src=>path.join(path.dirname(file),src);
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(LOCAL_TAG,(tag,src)=>{
    const local=beside(src);
    return fs.existsSync(local)?'<script>'+fs.readFileSync(local,'utf8')+'</script>':tag;
  });
  html=html.replace(STYLE_TAG,(tag,href)=>'<style>\n'+fs.readFileSync(beside(href),'utf8')+'</style>');
  // A module script runs once the document is parsed, after the classic scripts, in strict mode: its classic stand-in
  // goes last in the body, "use strict" first.
  const bundles=[];
  html=html.replace(BUNDLE_TAG,(tag,src)=>{ bundles.push(fs.readFileSync(beside(src),'utf8')); return ''; });
  if(bundles.length){
    const end=html.lastIndexOf('</body>');
    if(end<0) throw new Error(file+': no </body> to put its bundle before');
    html=html.slice(0,end)+bundles.map(b=>'<script>"use strict";\n'+b+'</script>\n').join('')+html.slice(end);
  }
  return html.replace(SUPABASE_TAG,'');
}

// The files readPage reads for a page, as full paths: the page, then each file it inlines (its stylesheet, its local
// scripts, its bundle). The balance runner checks the GM page's sources are all engine paths
// (tools/balance/engine-paths.ts), so CI plays the matrix when one changes.
function pageFiles(nameOrPath){
  const file=pageFile(nameOrPath);
  const html=fs.readFileSync(file,'utf8');
  const named=[STYLE_TAG,LOCAL_TAG,BUNDLE_TAG].flatMap(re=>[...html.matchAll(re)].map(m=>path.join(path.dirname(file),m[1])));
  return [file,...named.filter(f=>fs.existsSync(f))];
}

// sfc32, seeded through splitmix32 so nearby seeds give unrelated streams. The page's kcRng (src/engine/rng.ts) is the
// same generator, seeded the same way (tests/unit/rng.test.ts).
function seededRandom(seed){
  let s=(Number(seed)>>>0)||1;
  const mix=()=>{ s=(s+0x9e3779b9)>>>0; let z=s; z=Math.imul(z^(z>>>16),0x85ebca6b); z=Math.imul(z^(z>>>13),0xc2b2ae35); return (z^(z>>>16))>>>0; };
  let a=mix(), b=mix(), c=mix(), d=mix();
  return function(){
    a>>>=0; b>>>=0; c>>>=0; d>>>=0;
    const t=(a+b|0)+d|0; d=d+1|0;
    a=b^(b>>>9); b=c+(c<<3)|0; c=(c<<21)|(c>>>11); c=c+t|0;
    return (t>>>0)/4294967296;
  };
}
// The pages check the database's version before their first read (src/db/kc-db-guard.ts, bundled into each page).
// Every stand-in database answers it as an up-to-date database would: the newest migration in the repo.
const DB_VERSION=fs.readdirSync(path.join(__dirname,'..','..','supabase','migrations'))
  .map(f=>(/^(\d{14})_/.exec(f)||[])[1]).filter(Boolean).sort().pop();

// Wraps a stand-in `supabase` so its clients answer rpc('kc_db_version'). `answers`: a version, null (no such
// function: a database from before P0-34), 'offline' (no answer at all), or a list of those, used in order (the
// last one repeats). `calls` (optional) records every from()/rpc() the page makes, by name.
function withDbVersion(supabase,answers=DB_VERSION,calls){
  if(!supabase||typeof supabase.createClient!=='function') return supabase;
  const list=Array.isArray(answers)?answers.slice():[answers];
  const next=()=>list.length>1?list.shift():list[0];
  return {...supabase,createClient(...args){
    const c=supabase.createClient(...args), rpc=c.rpc, from=c.from;
    c.rpc=(fn,...a)=>{
      if(calls) calls.push('rpc:'+fn);
      if(fn!=='kc_db_version') return rpc.call(c,fn,...a);
      const v=next();
      if(v==='offline') return Promise.resolve({data:null,error:{message:'TypeError: Failed to fetch'},status:0});
      if(v===null) return Promise.resolve({data:null,status:404,error:{code:'PGRST202',message:'Could not find the function public.kc_db_version without parameters in the schema cache'}});
      return Promise.resolve({data:v,error:null,status:200});
    };
    if(calls&&typeof from==='function') c.from=(t,...a)=>{ calls.push('from:'+t); return from.call(c,t,...a); };
    return c;
  }};
}

// A Date that starts at `now` and moves on 1 ms at every reading (new Date(), Date.now(), Date()), so a page's
// clock is the same on every run and two readings never tie. Dates built from a value are ordinary. The engine's
// kcClock() (src/engine/clock.ts, P1-07) reads it.
function pinnedDate(RealDate,now){
  let t=typeof now==='number'?now:RealDate.parse(now);
  if(!Number.isFinite(t)) throw new Error('bootJsdom: opts.now is not a time: '+now);
  const tick=()=>t++;
  function PinnedDate(...args){
    if(!new.target) return new RealDate(tick()).toString();
    return args.length?new RealDate(...args):new RealDate(tick());
  }
  PinnedDate.prototype=RealDate.prototype;
  PinnedDate.now=tick; PinnedDate.parse=RealDate.parse; PinnedDate.UTC=RealDate.UTC;
  return PinnedDate;
}

const SEED=process.env.KC_SEED;
let bootCount=0;
if(SEED!=null&&SEED!=='') Math.random=seededRandom(SEED);

// opts.supabase   the object installed as window.supabase (e.g. {createClient:()=>nullStub()})
// opts.setup(w)   the harness's own beforeParse lines (error capture, console handling, overrides)
// opts.url, opts.pretendToBeVisual   jsdom options; defaults match the original harnesses
// opts.dbVersion, opts.dbCalls         what rpc('kc_db_version') answers, and a list recording the page's
//                                      database calls (withDbVersion above); by default an up-to-date database
// opts.seed       the seed of the page's dice, kcRng (by default each page booted gets its own stream from KC_SEED). The
//                 page's Math.random gets the same seed, for any code outside src/. A test fixes dice in a page that
//                 has booted through kcRng.seed(n) or kcRng.use(fn) (docs/traps.md, "Dice come from kcRng()")
// opts.now        pins the page's clock: Date and Date.now start at this time (ms since 1970, or a date
//                 string) and move on 1 ms each time the page reads it (pinnedDate below)
function bootJsdom(html,opts={}){
  const {JSDOM}=require('jsdom');
  const n=bootCount++;
  return new JSDOM(html,{runScripts:'dangerously',
    pretendToBeVisual:opts.pretendToBeVisual!==undefined?opts.pretendToBeVisual:true,
    url:opts.url||'https://example.org/',
    beforeParse(w){
      const seed=opts.seed!=null?opts.seed:SEED!=null&&SEED!==''?(Number(SEED)>>>0)+0x10000*(n+1):null;
      if(seed!=null){ w.KC_RNG_SEED=seed; w.Math.random=seededRandom(seed); }
      if(opts.now!=null) w.Date=pinnedDate(w.Date,opts.now);
      if(opts.supabase) w.supabase=opts.supabase;
      w.confirm=()=>true; w.alert=()=>{};
      if(opts.setup) opts.setup(w);
      w.supabase=withDbVersion(w.supabase,'dbVersion' in opts?opts.dbVersion:DB_VERSION,opts.dbCalls);
    }});
}

const MIME={'.html':'text/html','.js':'application/javascript','.css':'text/css','.csv':'text/csv'};
function serve(dir=SITE,port=0){
  const root=path.resolve(dir);
  const server=http.createServer((req,res)=>{
    const f=path.join(root,decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''));
    if(!f.startsWith(root)||!fs.existsSync(f)||!fs.statSync(f).isFile()){ res.writeHead(404); return res.end('no'); }
    res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});
    res.end(fs.readFileSync(f));
  });
  return new Promise(r=>server.listen(port,'127.0.0.1',()=>{ server.url=`http://127.0.0.1:${server.address().port}`; r(server); }));
}

// The stub's clients answer rpc('kc_db_version') with DB_VERSION, as withDbVersion does in jsdom.
const dbVersionPatch=v=>`;(function(){var s=window.supabase;if(!s||!s.createClient)return;var mk=s.createClient;`
  +`window.supabase=Object.assign({},s,{createClient:function(){var c=mk.apply(s,arguments),rpc=c.rpc;`
  +`c.rpc=function(fn){return fn==='kc_db_version'?Promise.resolve({data:${JSON.stringify(v)},error:null,status:200}):rpc.apply(c,arguments);};return c;}});})();`;
async function routeExternal(target,stubBody){
  const stub=r=>r.fulfill({status:200,contentType:'application/javascript',body:stubBody+dbVersionPatch(DB_VERSION)});
  await target.route('**/vendor/supabase-js-*.js',stub);
  await target.route('**cdn.jsdelivr.net/**',stub);
  await target.route('**unpkg.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await target.route('**fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await target.route('**fonts.gstatic.com/**',r=>r.fulfill({status:200,body:''}));
}

module.exports={SITE,sitePath,readPage,pageFiles,bootJsdom,seededRandom,pinnedDate,serve,routeExternal,withDbVersion,DB_VERSION};
