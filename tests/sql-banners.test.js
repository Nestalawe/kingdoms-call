// SQL banners check: since P0-17 the database changes only through migrations (supabase/), applied by the
// deploy pipeline, so the GM portal no longer carries SQL for the GM to paste into Supabase. Static
// (nothing runs): the GM portal holds no KC_*_SQL string, no "SQL Editor" instruction and no paste box.
// A missing table is still reported, as a plain error message (checked in tests/browser/gm-messaging-boot.spec.ts).
// Reads the page's template and its modules in src/ (its code is in its bundle since P1-09d; until then the built
// page, in site/).
const fs=require('fs'), path=require('path');
const {SRC}=require('./lib/source.ts'); const {pageFiles}=require('../tools/pages.ts');

const found=pageFiles('kingdoms-call-gm-portal.html').flatMap(file=>{
  const src=fs.readFileSync(path.join(SRC,file),'utf8');
  const lineOf=i=>src.slice(0,i).split('\n').length;
  return [
    [/\bKC_[A-Z]+_SQL\b/g,'a KC_*_SQL string'],
    [/SQL Editor|SQL editor/g,'an instruction to use the SQL Editor'],
    [/<textarea readonly onclick="this\.select\(\)"/g,'a SQL paste box'],
  ].flatMap(([re,what])=>[...src.matchAll(re)].map(m=>`${file}:${lineOf(m.index)}: ${what} (${m[0]})`));
});

for(const f of found) console.log('FAIL GM portal, '+f);
if(!found.length) console.log('ok   the GM portal carries no SQL set-up banners');
process.exit(found.length?1:0);
