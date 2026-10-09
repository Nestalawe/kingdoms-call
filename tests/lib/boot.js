// tests/lib/boot.js: the one way tests load the pages in site/.
//
//   SITE, sitePath(name)        where the deployable files live (site/, or $KC_SITE)
//   readPage(nameOrPath)        page HTML with its local scripts (kingdoms-call-data.js, kc-config.js)
//                               inlined and the Supabase CDN <script> removed, ready for jsdom
//   bootJsdom(html, opts)       a jsdom with the page's scripts running and a Supabase stub installed
//   serve(dir, port)            a static file server for Chromium (as the pages are deployed: one folder)
//   routeExternal(target, cdn)  answers the CDN with a stub and fonts with nothing (Playwright page/context)
//
// Fixed seed: when KC_SEED is set (tests/run.js sets it), Math.random is replaced by a seeded sfc32
// generator, both in this Node process (for a harness's own random orders) and in every page booted
// with bootJsdom. Same seed, same random sequence. Date is not pinned yet (P1-01).
const fs=require('fs'), path=require('path'), http=require('http');

// KC_SITE points the tests at another copy of the site (e.g. a deliberately broken one).
const SITE=path.resolve(process.env.KC_SITE||path.join(__dirname,'..','..','site'));
const sitePath=name=>path.join(SITE,name);

// A <script src="…"> naming a plain file beside the page (no "/" or ":"), e.g. kingdoms-call-data.js or kc-config.js.
const LOCAL_TAG=/<script src="([A-Za-z0-9._-]+\.js)"><\/script>/g;
const CDN_TAG=/<script src="https:\/\/cdn\.jsdelivr[^"]*"><\/script>/g;

// A name ('kingdoms-call-gm-portal.html') is looked up in site/; a path is used as given. Local scripts are
// the ones beside the page, as when deployed (jsdom doesn't fetch them itself).
function readPage(nameOrPath){
  const file=/[\\/]/.test(nameOrPath)?nameOrPath:sitePath(nameOrPath);
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(LOCAL_TAG,(tag,src)=>{
    const local=path.join(path.dirname(file),src);
    return fs.existsSync(local)?'<script>'+fs.readFileSync(local,'utf8')+'</script>':tag;
  });
  return html.replace(CDN_TAG,'');
}

// sfc32, seeded through splitmix32 so nearby seeds give unrelated streams.
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
const SEED=process.env.KC_SEED;
let bootCount=0;
if(SEED!=null&&SEED!=='') Math.random=seededRandom(SEED);

// opts.supabase   the object installed as window.supabase (e.g. {createClient:()=>nullStub()})
// opts.setup(w)   the harness's own beforeParse lines (error capture, console handling, overrides)
// opts.url, opts.pretendToBeVisual   jsdom options; defaults match the original harnesses
function bootJsdom(html,opts={}){
  const {JSDOM}=require('jsdom');
  const n=bootCount++;
  return new JSDOM(html,{runScripts:'dangerously',
    pretendToBeVisual:opts.pretendToBeVisual!==undefined?opts.pretendToBeVisual:true,
    url:opts.url||'https://example.org/',
    beforeParse(w){
      if(SEED!=null&&SEED!=='') w.Math.random=seededRandom((Number(SEED)>>>0)+0x10000*(n+1));
      if(opts.supabase) w.supabase=opts.supabase;
      w.confirm=()=>true; w.alert=()=>{};
      if(opts.setup) opts.setup(w);
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

async function routeExternal(target,cdnBody){
  await target.route('**cdn.jsdelivr.net/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:cdnBody}));
  await target.route('**unpkg.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await target.route('**fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await target.route('**fonts.gstatic.com/**',r=>r.fulfill({status:200,body:''}));
}

module.exports={SITE,sitePath,readPage,bootJsdom,seededRandom,serve,routeExternal};
