// Docs check: the guides an agent starts from must not point at things that aren't there.
//   - every relative link in CLAUDE.md, README.md, docs/**/*.md, tests/README.md and the PR template
//     reaches an existing file, and a #anchor into a Markdown file matches one of its headings;
//   - every `site/…`, `tests/…`, `tools/…` or `.github/…` path written in backticks exists
//     (globs and placeholders such as `**`, `<name>` or `NNN` are skipped);
//   - CLAUDE.md stays under 200 lines, so it's still a short first read.
// Nothing outside the repo is fetched.
const fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
const MAX_CLAUDE_LINES=200;

function mdFiles(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>{
    const p=path.join(dir,d.name);
    return d.isDirectory()?mdFiles(p):d.name.endsWith('.md')?[p]:[];
  });
}
const FILES=['CLAUDE.md','README.md','tests/README.md','.github/pull_request_template.md']
  .map(f=>path.join(ROOT,f)).concat(mdFiles(path.join(ROOT,'docs')));

// GitHub's heading anchors: lower case, punctuation dropped, spaces to hyphens, repeats get -1, -2, …
function anchors(file){
  const seen=new Map(), out=new Set();
  let fence=false;
  for(const line of fs.readFileSync(file,'utf8').split('\n')){
    if(/^\s*```/.test(line)) fence=!fence;
    const m=!fence&&/^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if(!m) continue;
    const base=m[1].toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,'').replace(/\s/g,'-');
    const n=seen.get(base)||0; seen.set(base,n+1);
    out.add(n?`${base}-${n}`:base);
  }
  return out;
}

let checked=0, fails=0;
const fail=(file,msg)=>{ fails++; console.log(`FAIL ${path.relative(ROOT,file)}: ${msg}`); };

for(const file of FILES){
  if(!fs.existsSync(file)){ fail(file,'missing'); continue; }
  const text=fs.readFileSync(file,'utf8').replace(/<!--[\s\S]*?-->/g,'');
  const prose=text.replace(/^\s*```[\s\S]*?^\s*```/gm,'');

  for(const [,target] of prose.matchAll(/\]\(([^)\s]+)\)/g)){
    if(/^[a-z]+:/i.test(target)) continue;              // https:, mailto:
    checked++;
    const [rel,hash]=target.split('#');
    const dest=rel?path.resolve(path.dirname(file),rel):file;
    if(!fs.existsSync(dest)){ fail(file,`link to ${target}: no such file`); continue; }
    if(hash&&dest.endsWith('.md')&&!anchors(dest).has(hash)) fail(file,`link to ${target}: no heading with that anchor`);
  }

  for(const [,p] of prose.matchAll(/`((?:site|tests|tools|\.github)\/[^`\s]*)`/g)){
    if(/[*<>]|NNN/.test(p)) continue;
    checked++;
    if(!fs.existsSync(path.join(ROOT,p))) fail(file,`\`${p}\` doesn't exist`);
  }
}

const claudeLines=fs.readFileSync(path.join(ROOT,'CLAUDE.md'),'utf8').split('\n').length;
checked++;
if(claudeLines>MAX_CLAUDE_LINES) fail(path.join(ROOT,'CLAUDE.md'),`${claudeLines} lines; keep it under ${MAX_CLAUDE_LINES}`);

console.log(`${FILES.length} files · ${checked} links, paths and limits checked · ${fails} problem(s)`);
process.exit(fails?1:0);
