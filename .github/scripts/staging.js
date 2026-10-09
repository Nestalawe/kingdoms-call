// The staging deploy's logic (P0-13), run by .github/workflows/staging.yml.
//   node .github/scripts/staging.js config            writes the staging kc-config.js to stdout
//   node .github/scripts/staging.js comment <prev>    posts "on staging" on this PR, and marks the PR that
//                                                     was on staging before (<prev>, may be empty) as replaced
// configFile(), onStagingBody() and replacedBody() are pure and unit-tested in tests/staging.test.js.
const MARKER='<!-- staging -->';
const SITE='https://kingdoms-call-staging.github.io/';
const LIVE_REF='yymsnsrpggpgmzgcfrys';   // the live project: staging must never point at it

function configFile({url,key}){
  if(!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url||'')) throw new Error(`STAGING_SUPABASE_URL isn't a Supabase project address: ${url}`);
  if(url.includes(LIVE_REF)) throw new Error('STAGING_SUPABASE_URL names the live database; staging must use its own');
  if(!/^[A-Za-z0-9._-]+$/.test(key||'')) throw new Error('STAGING_SUPABASE_KEY: the key is missing or has unexpected characters');
  return `// Kingdoms Call: which database this copy of the site talks to. STAGING: written by
// .github/workflows/staging.yml for the staging site; the live site's own copy is site/kc-config.js.
const KC_CONFIG=Object.freeze({
  env:'staging',
  supabaseUrl:'${url}',
  supabaseKey:'${key}',
});
`;
}

function onStagingBody({pr,sha,site=SITE}){
  return `${MARKER}\n🧪 **On staging:** this pull request (commit \`${String(sha).slice(0,7)}\`) is live on ${site}, `
    +`talking to the staging database (no real players). Only one pull request is on staging at a time; `
    +`this comment changes if another one replaces it.`;
}

function replacedBody({by}){
  return `${MARKER}\n🧪 ~~On staging~~: replaced by #${by}. Add the \`staging\` label again (or push a commit) to put this one back.`;
}

async function api(url,token,init={}){
  const res=await fetch(url,{...init,headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',
    Authorization:`Bearer ${token}`,...(init.body?{'Content-Type':'application/json'}:{})}});
  if(!res.ok) throw new Error(`GitHub API ${res.status} for ${init.method||'GET'} ${url}`);
  return res.json();
}
async function upsert(root,token,number,body){
  const comments=await api(`${root}/issues/${number}/comments?per_page=100`,token);
  const mine=comments.find(c=>typeof c.body==='string'&&c.body.startsWith(MARKER));
  if(mine) await api(`${root}/issues/comments/${mine.id}`,token,{method:'PATCH',body:JSON.stringify({body})});
  else await api(`${root}/issues/${number}/comments`,token,{method:'POST',body:JSON.stringify({body})});
}

async function main(){
  const [cmd,prev]=process.argv.slice(2);
  if(cmd==='config'){ process.stdout.write(configFile({url:process.env.STAGING_SUPABASE_URL,key:process.env.STAGING_SUPABASE_KEY})); return; }
  if(cmd==='comment'){
    const {GITHUB_TOKEN:token,GITHUB_REPOSITORY:repo,PR_NUMBER:pr,PR_SHA:sha}=process.env;
    const root=`${process.env.GITHUB_API_URL||'https://api.github.com'}/repos/${repo}`;
    await upsert(root,token,pr,onStagingBody({pr,sha}));
    if(prev&&String(prev)!==String(pr)) await upsert(root,token,prev,replacedBody({by:pr}));
    return;
  }
  throw new Error('usage: staging.js config | comment <previous-pr>');
}

if(require.main===module) main().catch(e=>{ console.error(`::error title=staging::${e.message}`); process.exitCode=1; });

module.exports={MARKER,SITE,configFile,onStagingBody,replacedBody};
