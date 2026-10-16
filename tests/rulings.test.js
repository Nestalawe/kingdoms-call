// Rulings check: docs/rulings/ is where Toby's rulings live (CLAUDE.md says so), and it stays in step with itself.
// Static (nothing runs):
//   - files are R-NNN-short-name.md, numbered 1…N with no gaps or repeats, each titled "# R-NNN: …";
//   - each gives Decided (a date), Status (Confirmed, To confirm or Superseded), Source and Enforced by;
//     a Superseded ruling names the ruling that replaced it;
//   - Enforced by is "no test yet" or links, and every linked test exists and runs in npm test (tests/suite.ts), or is
//     an access-rule test file in supabase/tests/database/;
//   - the index in docs/rulings/README.md lists every ruling once, with the file's status, flagged "(open question)"
//     exactly when the file has an Open point;
//   - CLAUDE.md points at docs/rulings/.
// Links themselves are checked by docs.test.js.
const fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
const DIR=path.join(ROOT,'docs','rulings');

let fails=0;
const fail=m=>{ fails++; console.log('FAIL '+m); };

const readme=path.join(DIR,'README.md');
if(!fs.existsSync(readme)){ fail('docs/rulings/README.md is missing'); console.log(`${fails} problem(s)`); process.exit(1); }
const index=fs.readFileSync(readme,'utf8');
const suite=fs.readFileSync(path.join(ROOT,'tests','suite.ts'),'utf8');
const STATUSES=['Confirmed','To confirm','Superseded'];

const files=fs.readdirSync(DIR).filter(f=>f!=='README.md'&&f.endsWith('.md')).sort();
const nums=[];
for(const f of files){
  const m=/^R-(\d{3})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.exec(f);
  if(!m){ fail(`${f}: not named R-NNN-short-name.md`); continue; }
  const n=Number(m[1]), id=`R-${m[1]}`; nums.push(n);
  const text=fs.readFileSync(path.join(DIR,f),'utf8');
  const field=k=>{ const x=new RegExp(`^- \\*\\*${k}:\\*\\* (.+)$`,'m').exec(text); return x?x[1].trim():null; };
  if(!text.startsWith(`# ${id}: `)) fail(`${f}: the first line should be "# ${id}: <title>"`);
  const decided=field('Decided'), status=field('Status'), source=field('Source'), enforced=field('Enforced by');
  if(!decided||!/^\d{4}-\d{2}-\d{2}\b/.test(decided)) fail(`${f}: Decided should start with a date (YYYY-MM-DD)`);
  if(!STATUSES.includes(status)) fail(`${f}: Status is "${status}", not one of ${STATUSES.join(', ')}`);
  if(!source) fail(`${f}: no Source`);
  if(status==='Superseded'&&!/R-\d{3}/.test(text.split('\n').slice(1).join('\n'))) fail(`${f}: Superseded, but names no ruling that replaced it`);
  if(!enforced) fail(`${f}: no Enforced by`);
  else if(enforced!=='no test yet'){
    const links=[...enforced.matchAll(/\[`([^`]+)`\]\(([^)]+)\)/g)];
    if(!links.length) fail(`${f}: Enforced by is neither "no test yet" nor a list of linked tests`);
    for(const [,name,href] of links){
      if(/\.sql$/.test(name)){
        if(!fs.existsSync(path.join(ROOT,'supabase','tests','database',name))) fail(`${f}: no access-rule test ${name}`);
      }else if(!suite.includes(`'tests/${name}.test.js'`)) fail(`${f}: ${name} is not a test npm test runs (tests/suite.ts)`);
      if(!href.endsWith(/\.sql$/.test(name)?name:`tests/${name}.test.js`)) fail(`${f}: the link for ${name} points at ${href}`);
    }
  }
  const rows=index.split('\n').filter(l=>l.startsWith(`| [${id}](${f}) |`));
  if(rows.length!==1){ fail(`${f}: listed ${rows.length} times in the README index (should be once)`); continue; }
  const cells=rows[0].split('|').map(c=>c.trim());
  const open=/^\*\*Open:\*\*/m.test(text);
  const want=status+(open?' (open question)':'');
  if(cells[4]!==want) fail(`${f}: the index says "${cells[4]}", the file says "${want}"`);
}
nums.forEach((n,i)=>{ if(n!==i+1) fail(`numbering: expected R-${String(i+1).padStart(3,'0')}, found R-${String(n).padStart(3,'0')}`); });
const listed=(index.match(/^\| \[R-\d{3}\]/gm)||[]).length;
if(listed!==files.length) fail(`the README index lists ${listed} rulings; there are ${files.length} files`);
if(!fs.readFileSync(path.join(ROOT,'CLAUDE.md'),'utf8').includes('docs/rulings/')) fail('CLAUDE.md does not point at docs/rulings/');

console.log(`${files.length} rulings checked · ${fails} problem(s)`);
process.exit(fails?1:0);
