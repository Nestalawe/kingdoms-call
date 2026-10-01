// Theo's review gate (decision D-07), run by .github/workflows/review-gate.yml.
//
// A PR is gated if it changes a path listed in .github/review-gate-paths (a renamed file counts by its
// old name too), or if it has the label needs-theo. A gated PR passes only when crumblingworld's latest
// decision is an approval of the PR's latest commit. When crumblingworld opened the PR, Nestalawe's
// approval counts instead, since nobody can approve their own PR. Any other PR passes.
//
// decide() is pure and unit-tested in tests/review-gate.test.js. main() only reads the PR through the
// REST API; it never fetches or runs the PR's code. It fails closed on any error.
//
// Local dry run (read-only):  GITHUB_TOKEN=$(gh auth token) GITHUB_REPOSITORY=Nestalawe/kingdoms-call \
//                             PR_NUMBER=1 node .github/scripts/review-gate.js
const fs=require('fs'), path=require('path');

const THEO='crumblingworld', TOBY='Nestalawe', LABEL='needs-theo';
const DECISIONS=new Set(['APPROVED','CHANGES_REQUESTED','DISMISSED']); // COMMENTED doesn't change a decision
const MAX_FILES=3000; // the most changed files the API lists for one PR

// One glob per line. "#" starts a comment line; blank lines are skipped.
function parsePaths(text){
  return text.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#'));
}

// "**" matches across folders, "*" within one folder, "?" one character. Everything else is literal.
function globToRegExp(glob){
  let re='';
  for(let i=0;i<glob.length;i++){
    const c=glob[i];
    if(c==='*'&&glob[i+1]==='*'){ re+='.*'; i++; }
    else if(c==='*') re+='[^/]*';
    else if(c==='?') re+='[^/]';
    else re+=c.replace(/[.+^${}()|[\]\\]/g,'\\$&');
  }
  return new RegExp('^'+re+'$');
}

function isGated(filename,globs){
  return globs.some(g=>globToRegExp(g).test(filename));
}

const same=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase();

// files and reviews are shaped as the REST API returns them; reviews are in the API's (oldest-first) order.
function decide({author,labels,headSha,files,reviews,globs}){
  const gatedFiles=[...new Set(files.flatMap(f=>[f.filename,f.previous_filename]).filter(n=>n&&isGated(n,globs)))];
  const labelled=labels.includes(LABEL);
  if(!gatedFiles.length&&!labelled)
    return {pass:true,gated:false,reason:`Not gated: no gated paths changed and no ${LABEL} label.`};

  const why=[];
  if(gatedFiles.length) why.push(`changes ${gatedFiles.slice(0,5).join(', ')}${gatedFiles.length>5?` and ${gatedFiles.length-5} more`:''}`);
  if(labelled) why.push(`has the label ${LABEL}`);
  const reviewer=same(author,THEO)?TOBY:THEO;
  const latest=reviews.filter(r=>r.user&&same(r.user.login,reviewer)&&DECISIONS.has(r.state)).pop();
  const head=String(headSha).slice(0,7);

  if(latest&&latest.state==='APPROVED'&&latest.commit_id===headSha)
    return {pass:true,gated:true,reason:`Gated (${why.join('; ')}). Approved by ${reviewer} on the latest commit ${head}.`};

  const status=!latest?'no approval yet'
    :latest.state!=='APPROVED'?`latest decision: ${latest.state.toLowerCase().replace('_',' ')}`
    :`approved an earlier commit (${String(latest.commit_id).slice(0,7)})`;
  return {pass:false,gated:true,
    reason:`Gated (${why.join('; ')}). Needs an approval from ${reviewer} on the latest commit ${head}: ${status}.`};
}

async function api(url,token){
  const res=await fetch(url,{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',
    ...(token?{Authorization:`Bearer ${token}`}:{})}});
  if(!res.ok) throw new Error(`GitHub API ${res.status} for ${url}`);
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
  const {GITHUB_TOKEN:token,GITHUB_REPOSITORY:repo,PR_NUMBER:number}=process.env;
  const base=`${process.env.GITHUB_API_URL||'https://api.github.com'}/repos/${repo}/pulls/${number}`;
  if(!repo||!number) throw new Error('GITHUB_REPOSITORY and PR_NUMBER must be set');
  const globs=parsePaths(fs.readFileSync(path.join(__dirname,'..','review-gate-paths'),'utf8'));

  const pr=await api(base,token);
  if(pr.changed_files>MAX_FILES) throw new Error(`the PR changes ${pr.changed_files} files; the API lists at most ${MAX_FILES}`);
  const files=await apiAll(`${base}/files`,token);
  if(files.length<pr.changed_files) throw new Error(`listed ${files.length} of ${pr.changed_files} changed files`);
  const reviews=await apiAll(`${base}/reviews`,token);

  const r=decide({author:pr.user.login,labels:pr.labels.map(l=>l.name),headSha:pr.head.sha,files,reviews,globs});
  console.log(r.reason);
  if(!r.pass){ console.log(`::error title=review-gate::${r.reason}`); process.exitCode=1; }
}

if(require.main===module)
  main().catch(e=>{ console.log(`::error title=review-gate::Couldn't check this PR, so it fails: ${e.message}`); process.exitCode=1; });

module.exports={decide,parsePaths,isGated,globToRegExp};
