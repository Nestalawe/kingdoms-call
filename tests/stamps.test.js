// Stamps check: the build stamps that are written twice must agree (docs/traps.md, "The data-file stamp
// guard" and "The GM portal's two build stamps").
//   - kingdoms-call-data.js: the `// Data file v…` comment (read by the GM tab's auto-reload) must equal
//     KC_DATA_STAMP (read by both portals' data-file guard).
//   - kingdoms-call-gm-portal.html: the footer (`GM Portal v…` in #kc-build-stamp, read by the auto-reload)
//     must equal KC_BUILD_STAMP (written into telemetry and Hall-of-Fame rows). The auto-reload reads the
//     FIRST `GM Portal v…` in the page, so that one must be the footer's too.
// Nothing is run. Reads site/ (or $KC_SITE).
const fs=require('fs');
const {sitePath}=require('./lib/boot');

const STAMP='(\\d{4}\\.\\d{2}\\.\\d{2}-\\d{4})';
let fails=0;
const fail=msg=>{ fails++; console.log('FAIL '+msg); };
const ok=msg=>console.log('ok   '+msg);
const find=(src,re)=>{ const m=re.exec(src); return m?m[1]:null; };

// Data file: the comment and KC_DATA_STAMP.
{
  const src=fs.readFileSync(sitePath('kingdoms-call-data.js'),'utf8');
  const comment=find(src,new RegExp('^// Data file v'+STAMP,'m'));
  const stamp=find(src,new RegExp("\\bKC_DATA_STAMP\\s*=\\s*['\"]"+STAMP+"['\"]"));
  if(!comment) fail('kingdoms-call-data.js: no `// Data file v…` comment line');
  if(!stamp) fail('kingdoms-call-data.js: no KC_DATA_STAMP');
  if(comment&&stamp){
    if(comment===stamp) ok(`kingdoms-call-data.js: comment and KC_DATA_STAMP are both ${stamp}`);
    else fail(`kingdoms-call-data.js: the \`// Data file v\` comment says ${comment} but KC_DATA_STAMP is ${stamp}; bump both together`);
  }
}

// GM portal: the footer, the first `GM Portal v…` in the page, and KC_BUILD_STAMP.
{
  const src=fs.readFileSync(sitePath('kingdoms-call-gm-portal.html'),'utf8');
  const stamp=find(src,new RegExp("\\bKC_BUILD_STAMP\\s*=\\s*['\"]"+STAMP+"['\"]"));
  const footer=find(src,new RegExp('id="kc-build-stamp"[^>]*>[^<]*GM Portal v'+STAMP));
  const first=find(src,new RegExp('GM Portal v'+STAMP));
  if(!stamp) fail('kingdoms-call-gm-portal.html: no KC_BUILD_STAMP');
  if(!footer) fail('kingdoms-call-gm-portal.html: no `GM Portal v…` footer in #kc-build-stamp');
  if(stamp&&footer){
    if(footer===stamp) ok(`kingdoms-call-gm-portal.html: footer and KC_BUILD_STAMP are both ${stamp}`);
    else fail(`kingdoms-call-gm-portal.html: the footer says ${footer} but KC_BUILD_STAMP is ${stamp}; bump both together`);
  }
  if(footer&&first&&first!==footer)
    fail(`kingdoms-call-gm-portal.html: the first \`GM Portal v\` in the page says ${first}, not the footer's ${footer}; the auto-reload reads the first one, so don't write \`GM Portal v<stamp>\` above the footer`);
}

console.log(`${fails} stamp problem(s)`);
process.exit(fails?1:0);
