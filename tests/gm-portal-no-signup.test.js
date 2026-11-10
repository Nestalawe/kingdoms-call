// The GM portal makes no accounts (P0-32c). Static (nothing runs): Game Masters are chosen by the Overlord
// from accounts that already exist, so the GM portal has no sign-up form, tab or call; its sign-in sends
// newcomers to the player portal instead. Reads the page's template and its modules in src/ (its code is in its
// bundle since P1-09d; until then the built page, in site/).
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The GM portal makes no accounts: no sign-up form, tab or `auth.signUp` call in its template or its own modules (src/db/
// holds every page's sign-in), nor a call of its Db's sign-up; its sign-in says "New here? Register on the player
// portal" (P0-32c)
const fs=require('fs'), path=require('path');
const {SRC}=require('./lib/source.ts'); const {pageFiles}=require('../tools/pages.ts');

let fails=0;
const check=(c,m)=>{ if(!c){ fails++; console.log('FAIL '+m); } else console.log('ok   '+m); };

const files=pageFiles('kingdoms-call-gm-portal.html');
const read=list=>list.map(f=>fs.readFileSync(path.join(SRC,f),'utf8')).join('\n');
const src=read(files);
// src/db/ is every page's database code, the player page's sign-up among it (its Db, P1-17e): the GM page's own
// modules call no sign-up, on the client or through the Db.
const own=read(files.filter(f=>!f.startsWith('db/')));
check(!/\bauth\.signUp\s*\(/.test(own),"no auth.signUp( call in its own modules (src/db/ holds every page's sign-in)");
check(!/\bsignUpWithEmailPasswordAndName\b/.test(own),"no call of its Db's sign-up");
check(!/\bdoSignUp\b/.test(src),'no doSignUp');
check(!/id="(tab-signup|auth-signup|su-email|su-password2?)"/.test(src),'no sign-up tab or form fields');
check(!/Create GM Account/i.test(src),'no "Create GM Account"');
const auth=(/<section id="sec-auth">([\s\S]*?)<\/section>/.exec(src)||[])[1]||'';
check(!!auth,'the sign-in section is there');
check(/New here\?[\s\S]{0,200}<a href="kingdoms-call-player-portal\.html"[^>]*>Register on the player portal<\/a>/.test(auth),
  'it says "New here? Register on the player portal", linking to the player portal');

process.exit(fails?1:0);
