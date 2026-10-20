// HTML is built only through kcHtml / kcEsc (P0-19; docs/traps.md, "HTML is built only through kcHtml"). Static level:
// nothing runs. Every module under src/ (since P1-09d the pages' code is ES modules, bundled by Vite), every inline
// <script> of every page (src/*.html), and every public/*.js (not vendor/) is parsed (acorn) and these are refused:
//   template      an untagged `…` with markup and a ${value} in it: tag it kcHtml;
//   concat        markup in quotes joined with + to a value that isn't escaped: '<td>'+name+'</td>' (use kcHtml);
//   sink          innerHTML / outerHTML / insertAdjacentHTML / document.write given a property read (e.message, g.name)
//                 or an untagged template, rather than a literal, kcHtml, a variable or a call;
//   plus          kcHtml joined with + or +=, or a list of kcHtml joined with .join(): both make a plain string, which
//                 the next kcHtml escapes again. Interpolate the kcHtml, or the list, instead;
//   twice         kcEsc (or an older escaper) inside kcHtml: kcHtml escapes values itself, so the text is escaped twice;
//   handler       a value inside an on…="…" attribute that isn't kcArg(…) or a constant;
//   load          a page that builds HTML doesn't import kc-safe.js first: its entry (ui/<page>/page.js) must, so the
//                 helpers exist before any of its code runs (each file that uses one imports it too: ESLint's no-undef).
// Every file must have none (P0-19 converted the pages one pull request at a time; since its last, the check is strict).
// ALLOWED: reviewed exceptions, each with a reason; an entry that matches nothing fails, so the list can't go stale.
// An entry is found by a piece of the statement it is in, in one layout whatever the file's (tests/lib/source.ts's
// compactCode, plan P1-09a: until then by a piece of the source line, which a reformat moves).
const fs=require('fs'); const path=require('path');
const acorn=require('acorn');
const {compactCode}=require('./lib/source.ts');
const {filesUnder,ROOT}=require('../tools/build.ts'); const {importsOf,pageEntries,pageModules,pageNames}=require('../tools/pages.ts');
const {JSDOM}=require('jsdom');
const SRC=path.join(ROOT,'src'), PUBLIC=path.join(ROOT,'public');

// {file, rule, line: a piece of the statement it is in, in compactCode's layout, reason}
const ALLOWED=[
  {file:'src/ui/player/map.js',rule:'concat',line:"_provNameRe=names.length?new RegExp('(?<!",
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

function check(code,sourceType){
  const found=[];
  const ast=acorn.parse(code,{ecmaVersion:'latest',sourceType,locations:true,allowHashBang:true});
  // the innermost statement (or declaration) holding a node, as code in one layout
  const statements=[]; for(const [x] of walk(ast,null)) if(/(Statement|Declaration)$/.test(x.type)&&x.type!=='BlockStatement') statements.push(x);
  const statementOf=n=>{ let best=null; for(const st of statements) if(st.start<=n.start&&n.end<=st.end&&(!best||st.end-st.start<best.end-best.start)) best=st; return best?compactCode(code.slice(best.start,best.end)):''; };
  const add=(rule,n)=>found.push({rule,line:n.loc.start.line,statement:statementOf(n)});
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

// Every file's scripts, with the line each starts on and how each parses. A page is read by jsdom's HTML parser
// (nothing runs), so its inline scripts are found exactly as a browser finds them; a module script (src=) is a file of
// its own, read below.
function scriptsOf(file){
  const src=fs.readFileSync(file,'utf8');
  if(file.endsWith('.js')) return {src,parts:[{code:src,line:1,sourceType:file.startsWith(SRC)?'module':'script'}]};
  const dom=new JSDOM(src,{includeNodeLocations:true});
  const scripts=[...dom.window.document.querySelectorAll('script')];
  const parts=scripts.filter(e=>!e.hasAttribute('src')).map(e=>({code:e.textContent,line:dom.nodeLocation(e).startTag.endLine,sourceType:'script'}));
  return {src,parts};
}

let fails=0;
const fail=m=>{ fails++; console.log('FAIL '+m); };
const ok=m=>console.log('ok   '+m);
const usedAllowed=new Set();
const files=[
  ...filesUnder(SRC).filter(f=>/\.js$/.test(f)||/^[^/]+\.html$/.test(f)).map(f=>'src/'+f),
  ...filesUnder(PUBLIC).filter(f=>/^[^/]+\.js$/.test(f)).map(f=>'public/'+f),
];
for(const f of files){
  const {src,parts}=scriptsOf(path.join(ROOT,f));
  const lines=src.split('\n');
  let findings=[];
  for(const p of parts){
    try{ findings.push(...check(p.code,p.sourceType).map(x=>({...x,line:x.line+p.line-1}))); }
    catch(e){ fail(`${f}: a script that starts on line ${p.line} doesn't parse: ${e.message}`); }
  }
  findings=findings.filter(x=>{
    const i=ALLOWED.findIndex(a=>a.file===f&&a.rule===x.rule&&x.statement.includes(a.line));
    if(i<0) return true;
    usedAllowed.add(i); return false;
  });
  if(findings.length){
    fail(`${f}: ${findings.length} place(s) build HTML without kcHtml/kcEsc:`);
    findings.slice(0,200).forEach(x=>console.log(`       ${f}:${x.line} ${x.rule}: ${(lines[x.line-1]||'').trim().slice(0,150)}`));
  } else ok(`${f}: every piece of HTML goes through kcHtml / kcEsc`);

}
// load: kc-safe.js first, on every page whose code uses the helpers or builds HTML
for(const page of pageNames()){
  const modules=pageEntries(page).modules;
  const code=pageModules(page).map(f=>fs.readFileSync(path.join(SRC,f),'utf8')).join('\n');
  const usesHelpers=/\bkc(Html|Esc|Raw|Arg)\b/.test(code);
  const buildsHtml=/\.(innerHTML|outerHTML)\s*\+?=|insertAdjacentHTML|document\.write/.test(code);
  if(!usesHelpers&&!buildsHtml) continue;
  const first=modules.length===1?importsOf(modules[0])[0]:undefined;
  if(first!=='ui/shared/kc-safe.js')
    fail(`${page}: builds HTML but its entry's first import is ${first?'"'+first+'"':'missing'}, not "ui/shared/kc-safe.js"`);
  else ok(`${page}: imports kc-safe.js first`);
}
ALLOWED.forEach((a,i)=>{ if(!usedAllowed.has(i)) fail(`ALLOWED entry ${i} (${a.file}, ${a.rule}, "${a.line}") matches nothing: take it out`); });
console.log(fails?`\nFAILURES: ${fails}`:'\n0 failures');
process.exit(fails?1:0);
