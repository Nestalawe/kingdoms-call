// Every read of profiles names its columns, and none of them is email (P0-31). Static (nothing runs): once the
// email column's privilege is taken away, a select of '*' fails even for your own row, and an email is never
// shown to another player (D-08). Reads site/ (or $KC_SITE).
const fs=require('fs'), path=require('path');
const {SITE}=require('./lib/boot');

let fails=0;
const fail=m=>{ fails++; console.log('FAIL '+m); };

let n=0;
for(const name of fs.readdirSync(SITE).filter(f=>f.endsWith('.html')).sort()){
  const src=fs.readFileSync(path.join(SITE,name),'utf8');
  const re=/\.from\(\s*['"]profiles['"]\s*\)\s*\.select\(\s*(?:(['"`])([^'"`]*)\1)?\s*\)/g;
  let m;
  while((m=re.exec(src))){
    n++;
    const line=src.slice(0,m.index).split('\n').length, cols=(m[2]||'').trim();
    if(!cols||cols.includes('*')) fail(`${name}:${line}: profiles read of ${cols?"'"+cols+"'":'every column'}: name the columns`);
    else if(/\bemail\b/.test(cols)) fail(`${name}:${line}: profiles read names email`);
    else console.log(`ok   ${name}:${line}: profiles.select('${cols}')`);
  }
}
if(!n) fail('no profiles reads found: has the pattern changed?');
process.exit(fails?1:0);
