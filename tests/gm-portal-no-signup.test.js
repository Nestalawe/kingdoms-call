// The GM portal makes no accounts (P0-32c). Static (nothing runs): Game Masters are chosen by the Overlord
// from accounts that already exist, so the GM portal has no sign-up form, tab or call; its sign-in sends
// newcomers to the player portal instead. Reads site/ (or $KC_SITE).
const fs=require('fs');
const {sitePath}=require('./lib/boot');

let fails=0;
const check=(c,m)=>{ if(!c){ fails++; console.log('FAIL '+m); } else console.log('ok   '+m); };

const src=fs.readFileSync(sitePath('kingdoms-call-gm-portal.html'),'utf8');
check(!/\bauth\.signUp\s*\(/.test(src),'no auth.signUp( call');
check(!/\bdoSignUp\b/.test(src),'no doSignUp');
check(!/id="(tab-signup|auth-signup|su-email|su-password2?)"/.test(src),'no sign-up tab or form fields');
check(!/Create GM Account/i.test(src),'no "Create GM Account"');
const auth=(/<section id="sec-auth">([\s\S]*?)<\/section>/.exec(src)||[])[1]||'';
check(!!auth,'the sign-in section is there');
check(/New here\?[\s\S]{0,200}<a href="kingdoms-call-player-portal\.html"[^>]*>Register on the player portal<\/a>/.test(auth),
  'it says "New here? Register on the player portal", linking to the player portal');

process.exit(fails?1:0);
