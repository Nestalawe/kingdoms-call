// Syntax check: every inline <script> in every page in site/, and every .js file in site/, must parse.
// Nothing is run. A failure names the file and the line, counted from the top of the file.
const fs=require('fs'), path=require('path'), vm=require('vm');
const {JSDOM}=require('jsdom');
const {SITE}=require('./lib/boot');

let checked=0, fails=0;
function parse(code,file,lineOffset){
  checked++;
  try{ new vm.Script(code,{filename:file,lineOffset}); }
  catch(e){
    fails++;
    const at=(e.stack||'').split('\n')[0];
    console.log(`FAIL ${at}\n     ${e.message}`);
  }
}

for(const name of fs.readdirSync(SITE).sort()){
  const file=path.join(SITE,name), src=fs.readFileSync(file,'utf8');
  if(name.endsWith('.js')){ parse(src,name,0); continue; }
  if(!name.endsWith('.html')) continue;
  // Parse the page as a browser would (no scripts run), then find each inline block in the source.
  const scripts=[...new JSDOM(src).window.document.querySelectorAll('script')].filter(s=>!s.src);
  let from=0;
  for(const s of scripts){
    const type=(s.getAttribute('type')||'').toLowerCase();
    if(type&&!/^(text|application)\/(javascript|ecmascript)$/.test(type)) continue;
    const code=s.textContent, at=src.indexOf(code,from);
    const line=at<0?0:src.slice(0,at).split('\n').length-1;
    if(at>=0) from=at+code.length;
    parse(code,name,line);
  }
}
console.log(`${checked} scripts checked · ${fails} syntax error(s)`);
process.exit(fails?1:0);
