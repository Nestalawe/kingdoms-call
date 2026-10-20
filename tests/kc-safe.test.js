// kc-safe.ts, the one way a page builds HTML from data (P0-19). Unit level: the file runs on its own in a fresh context,
// as a page loads it, and each helper is checked on its own:
//   - kcEsc: the five characters that matter in HTML text and quoted attributes, and nothing else; null and undefined are '';
//   - kcHtml: every value is escaped, unless it is kcHtml or kcRaw; lists are their items in order; nesting never escapes
//     twice; the result goes into innerHTML as markup and a value with markup in it comes out as text (checked in jsdom);
//   - kcRaw: passes markup through, and only that;
//   - kcArg: a value inside an on…="…" handler reaches the handler exactly as given, quotes and all (checked by running it);
//   - only the four helpers (and the class behind them) are added to the page's scope.
// The file is read from src/ (src/ui/shared/kc-safe.ts) as a classic script, as a page runs it: tests/lib/source.ts's
// scriptOf takes any `export` and types out once it is a module. (Until plan P1-09a it was read from site/.)
const fs=require('fs'); const vm=require('vm');
const {scriptOf}=require('./lib/source.ts');
const {JSDOM}=require('jsdom');

let fails=0;
const check=(c,m)=>{ if(!c){ fails++; console.log('FAIL '+m); } else console.log('ok   '+m); };
const eq=(a,b,m)=>check(a===b,m+(a===b?'':`: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`));

let src;
try{ src=scriptOf('ui/shared/kc-safe.ts'); }
catch(e){ console.log('FAIL src/ui/shared/kc-safe.ts is missing or does not parse: '+e.message); process.exit(1); }

const ctx={}; vm.createContext(ctx);
const before=new Set(Object.getOwnPropertyNames(ctx));
vm.runInContext(src,ctx);
const {kcEsc,kcHtml,kcRaw,kcArg}=vm.runInContext('({kcEsc,kcHtml,kcRaw,kcArg})',ctx);
const added=Object.getOwnPropertyNames(ctx).filter(n=>!before.has(n)).sort();
eq(added.join(','),'kcArg,kcEsc,kcHtml,kcRaw','the file adds only kcArg, kcEsc, kcHtml and kcRaw as properties of the page');
const lexical=vm.runInContext('typeof KcSafeHtml',ctx);
eq(lexical,'function','the marked-value class is a top-level name of its own (KcSafeHtml)');

// ── kcEsc ──
eq(kcEsc(`<a href="x" title='y'>Tom & Jerry</a>`),'&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;Tom &amp; Jerry&lt;/a&gt;','kcEsc escapes < > & " and \'');
eq(kcEsc('Ser Brann’s Keep · Élodie of Vær — `tick` ${x}'),'Ser Brann’s Keep · Élodie of Vær — `tick` ${x}','kcEsc leaves everything else alone (curly quotes, accents, backticks, ${})');
eq(kcEsc('&amp;'),'&amp;amp;','kcEsc escapes an & that already looks like an entity (a name is text, not markup)');
eq(kcEsc(null),'','kcEsc(null) is empty');
eq(kcEsc(undefined),'','kcEsc(undefined) is empty');
eq(kcEsc(0),'0','kcEsc(0) is "0"');
eq(kcEsc(false),'false','kcEsc(false) is "false", as String() would give');
eq(typeof kcEsc('x'),'string','kcEsc returns a plain string');

// ── kcHtml ──
const name='"><img src=x onerror="window.__kcPwned=1">';
eq(String(kcHtml`<td title="${name}">${name}</td>`),
  '<td title="&quot;&gt;&lt;img src=x onerror=&quot;window.__kcPwned=1&quot;&gt;">&quot;&gt;&lt;img src=x onerror=&quot;window.__kcPwned=1&quot;&gt;</td>',
  'kcHtml escapes every value, in text and in attributes');
eq(String(kcHtml`<b>${'<b>'}</b>`),'<b>&lt;b&gt;</b>','kcHtml keeps its own markup and escapes the value\'s');
eq(String(kcHtml`<i>${null}${undefined}</i>`),'<i></i>','null and undefined show as nothing, as kcEsc');
eq(String(kcHtml`<i>${3}·${0}</i>`),'<i>3·0</i>','numbers show as themselves');
eq(String(kcHtml`no values`),'no values','a template with no values is itself');
const inner=kcHtml`<span class="pill">${'A & B'}</span>`;
eq(String(kcHtml`<td>${inner}</td>`),'<td><span class="pill">A &amp; B</span></td>','a nested kcHtml is markup, not escaped again');
eq(String(kcHtml`<ul>${['<x>','y'].map(v=>kcHtml`<li>${v}</li>`)}</ul>`),'<ul><li>&lt;x&gt;</li><li>y</li></ul>','a list of kcHtml is its items, in order, with no commas');
eq(String(kcHtml`<p>${['<a>',kcHtml`<br>`,[kcRaw('<hr>'),'&']]}</p>`),'<p>&lt;a&gt;<br><hr>&amp;</p>','a list may mix text, kcHtml, kcRaw and lists: text is escaped, the rest is markup');
eq(String(kcHtml`<p>${[]}</p>`),'<p></p>','an empty list shows as nothing');
eq(String(kcHtml`<p>${'<b>x</b>'.toString()}</p>`),'<p>&lt;b&gt;x&lt;/b&gt;</p>','a plain string that looks like markup is still text');
eq(typeof kcHtml`a`,'object','kcHtml returns a marked value, not a plain string');
eq(typeof (kcHtml`a`+''),'string','+ turns it into a plain string (why pages never join kcHtml with +)');
eq(String(kcHtml`<i>${kcHtml`${kcHtml`${'<'}`}`}</i>`),'<i>&lt;</i>','nesting three deep escapes the value exactly once');

// ── kcRaw ──
eq(String(kcHtml`<td>${kcRaw('<strong>bold</strong>')}</td>`),'<td><strong>bold</strong></td>','kcRaw passes reviewed markup through');
eq(String(kcRaw(null)),'','kcRaw(null) is empty');

// ── in a page: innerHTML, attributes and handlers ──
const dom=new JSDOM('<!DOCTYPE html><body><div id="box"></div></body>',{runScripts:'dangerously'});
const w=dom.window; w.eval(src);
const box=w.document.getElementById('box');
w.__got=[];
w.take=(...a)=>w.__got.push(a);
const tricky=['O\'Rourke "the Bold" & <Sons>','\');window.__kcPwned=1;//','`${window.__kcPwned=1}`','\\" onmouseover=x ','</script><script>window.__kcPwned=1</script>','line\nbreak',' trailing  spaces '];
box.innerHTML=w.eval('kcHtml')`<div id="t" title="${tricky[0]}">${tricky[0]}</div>${tricky.map((v,i)=>w.eval('kcHtml')`<button id="b${i}" onclick="take(${w.eval('kcArg')(v)},${w.eval('kcArg')(i)})">go</button>`)}`;
const t=w.document.getElementById('t');
eq(t.textContent,tricky[0],'in a page, a value put in with kcHtml reads back exactly as given');
eq(t.getAttribute('title'),tricky[0],'and so does a value in an attribute');
eq(w.document.querySelectorAll('img,script').length,0,'no element is made from a value');
tricky.forEach((v,i)=>w.document.getElementById('b'+i).click());
eq(JSON.stringify(w.__got),JSON.stringify(tricky.map((v,i)=>[v,i])),'a handler given kcArg values receives each one exactly, quotes, backslashes and newlines included');
check(!w.__kcPwned,'no value ran as code');
box.innerHTML=w.eval('kcHtml')`<button id="n" onclick="take(${w.eval('kcArg')(undefined)},${w.eval('kcArg')(null)},${w.eval('kcArg')({a:[1,'x']})},${w.eval('kcArg')(true)})">go</button>`;
w.__got=[]; w.document.getElementById('n').click();
eq(JSON.stringify(w.__got),'[[null,null,{"a":[1,"x"]},true]]','kcArg keeps a value\'s type: numbers, booleans, objects; undefined becomes null');
dom.window.close();

console.log(fails?`\nFAILURES: ${fails}`:'\n0 failures');
process.exit(fails?1:0);
