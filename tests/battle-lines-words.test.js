// 2026-10-11 (Toby, battle lines I: rows and columns) — the front the ground allows is written in three
// places: the engine's BATTLE_FRONT_RANGE table and the two rulebooks. Level 0 (static): reads site/
// text; nothing runs. In every rulebook sentence about the front, each width claimed for a terrain must
// be that terrain's range in the engine's table ("6–8 on plains or desert"), every terrain must be
// claimed somewhere, and the old fixed-width wording (6 / 4 / 3, "four lines", flyers "always ... from
// the front") must be gone. Battle lines II: every facing multiplier in BATTLE_FACING must appear in the
// rulebook's "Who faces whom" step. A rule written twice must change twice (docs/traps.md).
const fs=require('fs'), vm=require('vm');
const {sitePath}=require('./lib/boot');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const read=n=>fs.readFileSync(sitePath(n),'utf8');

// The engine's table, read off the GM portal's source.
const gm=read('kingdoms-call-gm-portal.html');
const m=/const BATTLE_FRONT_RANGE=(\{[^}]*\});/.exec(gm);
ok(!!m,'the GM portal declares BATTLE_FRONT_RANGE');
const RANGE=m?vm.runInNewContext('('+m[1]+')',{}):{};
const TERRAINS=['plain','desert','forest','jungle','mountain','sea'];
ok(TERRAINS.every(t=>Array.isArray(RANGE[t])&&RANGE[t].length===2&&RANGE[t][0]<=RANGE[t][1]),'the table gives every terrain a low–high range');
const want=t=>RANGE[t]?`${RANGE[t][0]}–${RANGE[t][1]}`:null;

// Width claims: "6–8 on plains or desert", "4–6 in forest or jungle", "2–4 in mountains", "8–10 at sea",
// read only from sentences that speak of the front. The look-behind keeps "×1.15 in forest" out of it.
const TERR={plains:'plain',plain:'plain',desert:'desert',forest:'forest',jungle:'jungle',mountains:'mountain',mountain:'mountain',sea:'sea'};
const WORD='(?:plains?|desert|forest|jungle|mountains?|sea)';
const CLAIM=new RegExp(`(?<![\\d.×x+−-])(\\d+(?:–\\d+)?) (?:units? )?(?:on|in|at) ((?:(?:the )?${WORD}(?:, | or |, or )?)+)`,'g');
const strip=h=>h.replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/\s+/g,' ');
const sentences=text=>text.split(/(?<=[.!?])\s+/).filter(s=>/\bfront\b/i.test(s));

for(const [name,file] of [['rulebook','kingdoms-call-rules.html'],['intro','kingdoms-call-rules-intro.html']]){
  const text=strip(read(file));
  const claims=[];
  for(const s of sentences(text)) for(const c of s.matchAll(CLAIM)) claims.push({width:c[1],terrains:[...c[2].matchAll(new RegExp(WORD,'g'))].map(x=>TERR[x[0]])});
  const seen=new Set(), wrong=new Set();
  for(const c of claims) for(const t of c.terrains){ seen.add(t); if(want(t)&&c.width!==want(t)) wrong.add(`${c.width} for ${t} (engine: ${want(t)})`); }
  ok(claims.length>0,`the ${name} says what front the ground allows`);
  ok(wrong.size===0,`every width the ${name} claims is the engine's range`+(wrong.size?' — not: '+[...wrong].join('; '):''));
  const missing=TERRAINS.filter(t=>!seen.has(t));
  ok(missing.length===0,`the ${name} names a front for every terrain`+(missing.length?' — missing: '+missing.join(', '):''));
  const old=/four lines|always fight from the front|never take a line slot|rear-line reduction|always take the front line|front line, terrain-proof/.exec(text);
  ok(!old,`the ${name} has dropped the old fixed-width wording`+(old?` — still says "${old[0]}"`:''));
}
const rules=read('kingdoms-call-rules.html');
ok(/<li><strong>The battle lines\.<\/strong>/.test(rules),'the rulebook\'s "How a battle is fought" has its "The battle lines" step');

// Battle lines II: the facing multipliers are written in the engine's BATTLE_FACING and in the
// rulebook's "Who faces whom" step; every multiplier must appear there as ×n.
const fm=/const BATTLE_FACING=(\{[\s\S]*?\n\});/.exec(gm);
ok(!!fm,'the GM portal declares BATTLE_FACING');
const FACING=fm?vm.runInNewContext('('+fm[1]+')',{}):null;
const stepAt=rules.indexOf('<li><strong>Who faces whom.</strong>'), step=stepAt<0?'':rules.slice(stepAt,rules.indexOf('</li>',stepAt));
ok(stepAt>=0,'the rulebook\'s "How a battle is fought" has its "Who faces whom" step');
if(FACING){
  const nums=[FACING.front.cav.arc,FACING.front.cav.foot,FACING.front.foot.cav,FACING.front.foot.arc,FACING.back.foot,FACING.back.cav,FACING.wrap,FACING.sideHit,FACING.freeFlank,FACING.turned];
  const missing=[...new Set(nums)].filter(n=>!step.includes('×'+n));
  ok(nums.every(n=>typeof n==='number')&&missing.length===0,'every facing multiplier appears in that step'+(missing.length?' — missing: '+missing.map(n=>'×'+n).join(', '):''));
}
ok(/\bopposite\b/.test(strip(read('kingdoms-call-rules-intro.html'))),'the intro says each unit fights the enemy opposite it');

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
