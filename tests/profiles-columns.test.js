// Every read of profiles names its columns, and none of them is email (P0-31). Static (nothing runs): once the
// email column's privilege is taken away, a select of '*' fails even for your own row, and an email is never
// shown to another player (D-08). Reads each page's modules in src/ (until plan P1-09d, its scripts in site/).
const fs=require('fs'), path=require('path');
const {SRC}=require('./lib/source.ts'); const {pageModules,pageNames}=require('../tools/pages.ts');

let fails=0;
const fail=m=>{ fails++; console.log('FAIL '+m); };

let n=0;
for(const name of pageNames()) for(const file of pageModules(name)){
  const src=fs.readFileSync(path.join(SRC,file),'utf8');
  const re=/\.from\(\s*['"]profiles['"]\s*\)\s*\.select\(\s*(?:(['"`])([^'"`]*)\1)?\s*\)/g;
  let m;
  while((m=re.exec(src))){
    n++;
    const line=src.slice(0,m.index).split('\n').length, cols=(m[2]||'').trim(), where=`${name}, ${file}:${line}`;
    if(!cols||cols.includes('*')) fail(`${where}: profiles read of ${cols?"'"+cols+"'":'every column'}: name the columns`);
    else if(/\bemail\b/.test(cols)) fail(`${where}: profiles read names email`);
    else console.log(`ok   ${where}: profiles.select('${cols}')`);
  }
}
if(!n) fail('no profiles reads found: has the pattern changed?');
process.exit(fails?1:0);
