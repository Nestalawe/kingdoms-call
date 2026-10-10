// Workflow check: every call a workflow makes to GitHub's API is signed in with the job's token. Unsigned
// calls share a small hourly limit with every other job on the same runner address, so they fail at random
// with 403 (the staging deploy did, 2026-10-10). Static (nothing runs): reads .github/workflows/*.yml.
const fs=require('fs'), path=require('path');

const DIR=path.resolve(__dirname,'..','.github','workflows');
let fails=0;
for(const name of fs.readdirSync(DIR).filter(f=>/\.ya?ml$/.test(f)).sort()){
  fs.readFileSync(path.join(DIR,name),'utf8').split('\n').forEach((line,i)=>{
    if(/^\s*#/.test(line)||!/\b(curl|wget)\b/.test(line)||!/api\.github\.com|\$\{?GITHUB_API_URL/.test(line)) return;
    if(/Authorization: (Bearer|token) \$\{?GITHUB_TOKEN\b|Authorization: (Bearer|token) \$\{\{ *github\.token *\}\}/.test(line)) return;
    fails++;
    console.log(`FAIL ${name}:${i+1}: a GitHub API call without the job's token: ${line.trim()}`);
  });
}
if(!fails) console.log('ok   every GitHub API call in the workflows is signed in');
process.exit(fails?1:0);
