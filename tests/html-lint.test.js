// HTML is built only through kcHtml / kcEsc (P0-19; docs/traps.md, "HTML is built only through kcHtml"). Static level:
// nothing runs. Every inline <script> of every page in site/, and every site/*.js (not vendor/), is parsed (acorn) and
// these are refused:
//   template      an untagged `…` with markup and a ${value} in it: tag it kcHtml;
//   concat        markup in quotes joined with + to a value that isn't escaped: '<td>'+name+'</td>' (use kcHtml);
//   sink          innerHTML / outerHTML / insertAdjacentHTML / document.write given a property read (e.message, g.name)
//                 or an untagged template, rather than a literal, kcHtml, a variable or a call;
//   plus          kcHtml joined with + or +=, or a list of kcHtml joined with .join(): both make a plain string, which
//                 the next kcHtml escapes again. Interpolate the kcHtml, or the list, instead;
//   twice         kcEsc (or an older escaper) inside kcHtml: kcHtml escapes values itself, so the text is escaped twice;
//   handler       a value inside an on…="…" attribute that isn't kcArg(…) or a constant;
//   load          a page that builds HTML doesn't load kc-safe.js as its first <script src>.
// Every file must have none (P0-19 converted the pages one pull request at a time; since its last, the check is strict).
// ALLOWED: reviewed exceptions, each with a reason; an entry that matches nothing fails, so the list can't go stale.
const fs=require('fs'); const path=require('path');
const acorn=require('acorn');
const {SITE}=require('./lib/boot');
const {JSDOM}=require('jsdom');

// {file, rule, line: a piece of the source line, reason}
const ALLOWED=[
  {file:'kingdoms-call-player-portal.html',rule:'concat',line:"_provNameRe=names.length?new RegExp('(?<!",
    reason:"a RegExp's source, not HTML: '(?<!' is a lookbehind (the report's province names become map links as DOM nodes)"},
];

const MARKUP=/<[a-zA-Z!\/]/;
const ESCAPERS=new Set(['kcEsc','esc','_esc','escapeHtml','_msgEsc','_rdEsc']);
const SINK_PROPS=new Set(['innerHTML','outerHTML']);
const isKcTag=n=>n&&n.type==='TaggedTemplateExpression'&&n.tag.type==='Identifier'&&n.tag.name==='kcHtml';
const callee=n=>n&&n.type==='CallExpression'?(n.callee.type==='Identifier'?n.callee.name:(n.callee.type==='MemberExpression'&&!n.callee.computed?n.callee.property.name:null)):null;
const isCallTo=(n,names)=>n&&n.type==='CallExpression'&&n.callee.type==='Identifier'&&names.includes(n.callee.name);
const isKcValue=n=>isKcTag(n)||isCallTo(n,['kcHtml','kcRaw','kcArg']);
const strOf=n=>n.type==='Literal'&&typeof n.value==='string'?n.value
  :n.type==='TemplateLiteral'&&!n.expressions.length?n.quasis[0].value.cooked:null;
const hasMarkup=n=>{ const s=strOf(n); return s!=null&&MARKUP.test(s); };

// The leaves of a + chain (a+b+c is ((a+b)+c)).
function plusLeaves(n,out=[]){
  if(n.type==='BinaryExpression'&&n.operator==='+'){ plusLeaves(n.left,out); plusLeaves(n.right,out); }
  else out.push(n);
  return out;
}
// A piece that may sit next to markup in a + chain: a constant, an escaped value, or a choice between those.
function safePiece(n){
  if(n.type==='Literal') return typeof n.value==='string'||typeof n.value==='number';
  if(n.type==='TemplateLiteral') return !n.expressions.length;
  if(isCallTo(n,['kcEsc'])) return true;
  if(n.type==='ConditionalExpression') return safePiece(n.consequent)&&safePiece(n.alternate);
  if(n.type==='BinaryExpression'&&n.operator==='+') return plusLeaves(n).every(safePiece);
  return false;
}
// What a sink may be given: a constant, kcHtml, a variable or a call (whose own building is checked where it happens).
function safeSink(n){
  if(n.type==='Literal'||n.type==='Identifier'||n.type==='CallExpression'||isKcTag(n)) return true;
  if(n.type==='TemplateLiteral') return !n.expressions.length;
  if(n.type==='ConditionalExpression') return safeSink(n.consequent)&&safeSink(n.alternate);
  if(n.type==='LogicalExpression') return safeSink(n.left)&&safeSink(n.right);
  if(n.type==='BinaryExpression'&&n.operator==='+') return plusLeaves(n).every(x=>safeSink(x)&&!isKcValue(x));
  return false;
}
// A value inside a handler attribute may be kcArg(…), a number, or a choice between constants.
function safeHandlerValue(n){
  if(isCallTo(n,['kcArg'])) return true;
  if(n.type==='Literal') return typeof n.value==='number'||(typeof n.value==='string'&&/^[\w.]*$/.test(n.value));
  if(n.type==='ConditionalExpression') return safeHandlerValue(n.consequent)&&safeHandlerValue(n.alternate);
  return false;
}
const HANDLER_OPEN=/\son[a-z]+\s*=\s*("[^"]*|'[^']*)$/i;

function* walk(n,parent){
  if(!n||typeof n.type!=='string') return;
  yield [n,parent];
  for(const k of Object.keys(n)){
    if(k==='loc'||k==='start'||k==='end') continue;
    const v=n[k];
    if(Array.isArray(v)) for(const c of v){ if(c&&typeof c.type==='string') yield* walk(c,n); }
    else if(v&&typeof v.type==='string') yield* walk(v,n);
  }
}
// The calls to escapers inside a kcHtml value, not counting nested kcHtml (checked on their own).
function escaperCalls(n,out=[]){
  if(!n||typeof n.type!=='string'||isKcTag(n)) return out;
  if(n.type==='CallExpression'&&n.callee.type==='Identifier'&&ESCAPERS.has(n.callee.name)) out.push(n);
  for(const k of Object.keys(n)){
    if(k==='loc') continue;
    const v=n[k];
    if(Array.isArray(v)) v.forEach(c=>escaperCalls(c,out)); else if(v&&typeof v.type==='string') escaperCalls(v,out);
  }
  return out;
}
const containsKc=n=>{ for(const [x] of walk(n)) if(isKcValue(x)) return true; return false; };

function check(code){
  const found=[];
  const ast=acorn.parse(code,{ecmaVersion:'latest',sourceType:'script',locations:true,allowHashBang:true});
  const add=(rule,n)=>found.push({rule,line:n.loc.start.line});
  for(const [n,parent] of walk(ast,null)){
    if(n.type==='TemplateLiteral'&&n.expressions.length&&!(isKcTag(parent)&&parent.quasi===n)
      &&MARKUP.test(n.quasis.map(q=>q.value.cooked).join('')) ) add('template',n);
    if(isKcTag(n)){
      let text='';
      n.quasi.expressions.forEach((e,i)=>{
        text+=n.quasi.quasis[i].value.cooked;
        if(HANDLER_OPEN.test(text)&&!safeHandlerValue(e)) add('handler',e);
        if(escaperCalls(e).length) add('twice',e);
        text+='0';
      });
    }
    if(n.type==='BinaryExpression'&&n.operator==='+'&&!(parent&&parent.type==='BinaryExpression'&&parent.operator==='+')){
      const leaves=plusLeaves(n);
      if(leaves.some(hasMarkup)&&!leaves.every(safePiece)&&!leaves.some(isKcValue)) add('concat',n);
      if(leaves.some(isKcValue)) add('plus',n);
    }
    if(n.type==='AssignmentExpression'&&n.operator==='+='){
      const leaves=plusLeaves(n.right);
      if(leaves.some(hasMarkup)&&!leaves.every(safePiece)&&!leaves.some(isKcValue)) add('concat',n);
      if(leaves.some(isKcValue)) add('plus',n);
    }
    if(callee(n)==='join'&&n.callee.object&&callee(n.callee.object)==='map'&&containsKc(n.callee.object)) add('plus',n);
    const sinkValue=
      n.type==='AssignmentExpression'&&n.left.type==='MemberExpression'&&!n.left.computed&&SINK_PROPS.has(n.left.property.name)?n.right
      :callee(n)==='insertAdjacentHTML'?n.arguments[1]
      :(callee(n)==='write'||callee(n)==='writeln')&&n.callee.object&&n.callee.object.name==='document'?n.arguments[0]:null;
    if(sinkValue&&!safeSink(sinkValue)) add('sink',n);
  }
  return found;
}

// Every file's scripts, with the line each starts on, and a page's first <script src>. A page is read by jsdom's HTML
// parser (nothing runs), so its scripts are found exactly as a browser finds them.
function scriptsOf(file){
  const src=fs.readFileSync(file,'utf8');
  if(file.endsWith('.js')) return {src,parts:[{code:src,line:1}]};
  const dom=new JSDOM(src,{includeNodeLocations:true});
  const scripts=[...dom.window.document.querySelectorAll('script')];
  const parts=scripts.filter(e=>!e.hasAttribute('src')).map(e=>({code:e.textContent,line:dom.nodeLocation(e).startTag.endLine}));
  const first=scripts.find(e=>e.hasAttribute('src'));
  return {src,parts,firstSrc:first?first.getAttribute('src'):undefined};
}

let fails=0;
const fail=m=>{ fails++; console.log('FAIL '+m); };
const ok=m=>console.log('ok   '+m);
const usedAllowed=new Set();
const files=fs.readdirSync(SITE).filter(f=>/\.(html|js)$/.test(f)).sort();
for(const f of files){
  const {src,parts,firstSrc}=scriptsOf(path.join(SITE,f));
  const lines=src.split('\n');
  let findings=[];
  for(const p of parts){
    try{ findings.push(...check(p.code).map(x=>({...x,line:x.line+p.line-1}))); }
    catch(e){ fail(`${f}: a script that starts on line ${p.line} doesn't parse: ${e.message}`); }
  }
  findings=findings.filter(x=>{
    const text=lines[x.line-1]||'';
    const i=ALLOWED.findIndex(a=>a.file===f&&a.rule===x.rule&&text.includes(a.line));
    if(i<0) return true;
    usedAllowed.add(i); return false;
  });
  if(findings.length){
    fail(`${f}: ${findings.length} place(s) build HTML without kcHtml/kcEsc:`);
    findings.slice(0,200).forEach(x=>console.log(`       ${f}:${x.line} ${x.rule}: ${(lines[x.line-1]||'').trim().slice(0,150)}`));
  } else ok(`${f}: every piece of HTML goes through kcHtml / kcEsc`);

  // load: kc-safe.js first, on every page that uses the helpers or builds HTML
  if(f.endsWith('.html')){
    const scripts=parts.map(p=>p.code).join('\n');
    const usesHelpers=/\bkc(Html|Esc|Raw|Arg)\b/.test(scripts);
    const buildsHtml=/\.(innerHTML|outerHTML)\s*\+?=|insertAdjacentHTML|document\.write/.test(scripts);
    if((usesHelpers||buildsHtml)&&firstSrc!=='kc-safe.js')
      fail(`${f}: builds HTML but its first <script src> is ${firstSrc?'"'+firstSrc+'"':'missing'}, not "kc-safe.js" (load it straight after the boot-failure reporter)`);
    else if(usesHelpers||buildsHtml) ok(`${f}: loads kc-safe.js first`);
  }
}
ALLOWED.forEach((a,i)=>{ if(!usedAllowed.has(i)) fail(`ALLOWED entry ${i} (${a.file}, ${a.rule}, "${a.line}") matches nothing: take it out`); });
console.log(fails?`\nFAILURES: ${fails}`:'\n0 failures');
process.exit(fails?1:0);
