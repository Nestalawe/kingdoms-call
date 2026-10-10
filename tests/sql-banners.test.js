// SQL banners check: since P0-17 the database changes only through migrations (supabase/), applied by the
// deploy pipeline, so the GM portal no longer carries SQL for the GM to paste into Supabase. Static
// (nothing runs): the GM portal holds no KC_*_SQL string, no "SQL Editor" instruction and no paste box.
// A missing table is still reported, as a plain error message (checked in gm-messaging-boot).
// Reads site/ (or $KC_SITE).
const fs=require('fs'), path=require('path');
const {SITE}=require('./lib/boot');

const src=fs.readFileSync(path.join(SITE,'kingdoms-call-gm-portal.html'),'utf8');
const lineOf=i=>src.slice(0,i).split('\n').length;
const found=[
  [/\bKC_[A-Z]+_SQL\b/g,'a KC_*_SQL string'],
  [/SQL Editor|SQL editor/g,'an instruction to use the SQL Editor'],
  [/<textarea readonly onclick="this\.select\(\)"/g,'a SQL paste box'],
].flatMap(([re,what])=>[...src.matchAll(re)].map(m=>`line ${lineOf(m.index)}: ${what} (${m[0]})`));

for(const f of found) console.log('FAIL GM portal, '+f);
if(!found.length) console.log('ok   the GM portal carries no SQL set-up banners');
process.exit(found.length?1:0);
