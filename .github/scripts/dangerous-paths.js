// The dangerous-paths warning (decision D-07, amended 2026-10-09), run by
// .github/workflows/dangerous-paths.yml.
//
// A pull request that changes a path listed in .github/dangerous-paths (a renamed file counts by its old
// name too) gets one comment asking to talk the change through with Theo before merging. Later runs update
// that comment in place; when nothing dangerous is left, it says so. It never blocks a merge: any problem
// is logged as a warning and the job still succeeds.
//
// match() and commentBody() are pure and unit-tested in tests/dangerous-paths.test.js. main() only reads
// the PR through the REST API and writes the one comment; it never fetches or runs the PR's code.
//
// Local dry run (read-only, prints instead of commenting):
//   GITHUB_TOKEN=$(gh auth token) GITHUB_REPOSITORY=Nestalawe/kingdoms-call PR_NUMBER=1 DRY_RUN=1 \
//   node .github/scripts/dangerous-paths.js
const fs=require('fs'), path=require('path');

const MARKER='<!-- dangerous-paths -->';
const MAX_FILES=3000; // the most changed files the API lists for one PR
const MAX_LISTED=20;  // files named in the comment; the rest are counted

// One glob per line. "#" starts a comment line; blank lines are skipped.
function parsePaths(text){
  return text.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#'));
}

// "**" matches across folders, "*" within one folder, "?" one character. Everything else is literal.
// Case is ignored: on a Mac or Windows checkout "Supabase/" and "supabase/" are the same folder.
function globToRegExp(glob){
  let re='';
  for(let i=0;i<glob.length;i++){
    const c=glob[i];
    if(c==='*'&&glob[i+1]==='*'){ re+='.*'; i++; }
    else if(c==='*') re+='[^/]*';
    else if(c==='?') re+='[^/]';
    else re+=c.replace(/[.+^${}()|[\]\\]/g,'\\$&');
  }
  return new RegExp('^'+re+'$','i');
}

function isDangerous(filename,globs){
  return globs.some(g=>globToRegExp(g).test(filename));
}

// files are shaped as the REST API returns them. Returns the dangerous names, each once, in order.
function match(files,globs){
  return [...new Set(files.flatMap(f=>[f.filename,f.previous_filename]).filter(n=>n&&isDangerous(n,globs)))];
}

function commentBody(matched){
  if(!matched.length)
    return `${MARKER}\n**Dangerous paths:** this pull request no longer changes any of them.`;
  const shown=matched.slice(0,MAX_LISTED).map(n=>`- \`${n}\``).join('\n');
  const more=matched.length>MAX_LISTED?`\n- …and ${matched.length-MAX_LISTED} more`:'';
  return `${MARKER}\n**⚠️ Dangerous paths.** This pull request changes database, workflow or third-party code, `
    +`so talk it through with Theo before merging:\n${shown}${more}\n\n`
    +`_This is a warning, not a check: it doesn't block the merge. The list is in \`.github/dangerous-paths\`._`;
}

async function api(url,token,init={}){
  const res=await fetch(url,{...init,headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',
    ...(token?{Authorization:`Bearer ${token}`}:{}),...(init.body?{'Content-Type':'application/json'}:{})}});
  if(!res.ok) throw new Error(`GitHub API ${res.status} for ${init.method||'GET'} ${url}`);
  return res.json();
}

async function apiAll(url,token){
  const all=[];
  for(let page=1;;page++){
    const batch=await api(`${url}?per_page=100&page=${page}`,token);
    all.push(...batch);
    if(batch.length<100) return all;
  }
}

async function main(){
  const {GITHUB_TOKEN:token,GITHUB_REPOSITORY:repo,PR_NUMBER:number,DRY_RUN:dry}=process.env;
  if(!repo||!number) throw new Error('GITHUB_REPOSITORY and PR_NUMBER must be set');
  const root=`${process.env.GITHUB_API_URL||'https://api.github.com'}/repos/${repo}`;
  const globs=parsePaths(fs.readFileSync(path.join(__dirname,'..','dangerous-paths'),'utf8'));

  const pr=await api(`${root}/pulls/${number}`,token);
  let matched;
  if(pr.changed_files>MAX_FILES) matched=[`(more than ${MAX_FILES} files changed: too many to check, so treat it as dangerous)`];
  else matched=match(await apiAll(`${root}/pulls/${number}/files`,token),globs);

  const comments=await apiAll(`${root}/issues/${number}/comments`,token);
  const mine=comments.find(c=>typeof c.body==='string'&&c.body.startsWith(MARKER));
  console.log(matched.length?`Dangerous paths changed: ${matched.join(', ')}`:'No dangerous paths changed.');

  if(!matched.length&&!mine) return;                    // nothing to say, and nothing said before
  const body=commentBody(matched);
  if(mine&&mine.body===body) return;                    // already up to date
  if(dry){ console.log(`DRY_RUN: would ${mine?'update':'post'} this comment:\n${body}`); return; }
  if(mine) await api(`${root}/issues/comments/${mine.id}`,token,{method:'PATCH',body:JSON.stringify({body})});
  else await api(`${root}/issues/${number}/comments`,token,{method:'POST',body:JSON.stringify({body})});
  console.log(mine?'Updated the warning comment.':'Posted the warning comment.');
}

if(require.main===module)
  main().catch(e=>{ console.log(`::warning title=dangerous-paths::Couldn't post the warning (it never blocks the merge): ${e.message}`); });

module.exports={MARKER,match,commentBody,parsePaths,isDangerous,globToRegExp};
