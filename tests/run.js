// tests/run.js: runs the suite. Each test is its own Node process; it passes when it exits 0.
//
//   npm test                      syntax check, page boot check, small turn fuzz, every kept harness
//   npm run test:full             the same with bigger fuzz runs
//   npm run test:quarantine       the quarantined harnesses (expected to fail; see tests/README.md)
//   npm test -- --seed 123        a different fixed seed (default below); printed at the start
//   npm test -- --only fuzz       only tests whose name contains "fuzz"
const {spawnSync}=require('child_process');
const fs=require('fs'), path=require('path');

const args=process.argv.slice(2);
const flag=f=>args.includes(f);
const opt=(f,d)=>{ const i=args.indexOf(f); return i>=0&&args[i+1]!=null?args[i+1]:d; };
const FULL=flag('--full'), QUARANTINE=flag('--quarantine');
const SEED=String(opt('--seed',process.env.KC_SEED||'20261001'));
const ONLY=opt('--only',null);
const ROOT=path.resolve(__dirname,'..');
const GM='kingdoms-call-gm-portal.html';

// [name, file, args, env]. Sizes are the harnesses' own command-line arguments.
const SUITE=[
  ['syntax',               'tests/syntax.test.js'],
  ['docs',                 'tests/docs.test.js'],
  ['review-gate',          'tests/review-gate.test.js'],
  ['landing-footer',       'tests/landing-footer.test.js'],
  ['boot-pages',           'tests/boot-pages.test.js'],
  ['turn-fuzz',            'tests/turn-fuzz.test.js',            FULL?['16','12']:['4','6']],
  ['home-placement',       'tests/home-placement.test.js',       [], {RUNS:FULL?'1000':'200'}],
  ['druid-and-war-spoils', 'tests/druid-and-war-spoils.test.js'],
  ['leaderboard-records',  'tests/leaderboard-records.test.js'],
  ['leaderboard-render',   'tests/leaderboard-render.test.js'],
  ['concede',              'tests/concede.test.js'],
  ['monarch-grave',        'tests/monarch-grave.test.js'],
  ['guardian-melee',       'tests/guardian-melee.test.js'],
  ['guardian-traits',      'tests/guardian-traits.test.js'],
  ['hit-cap',              'tests/hit-cap.test.js'],
  ['overtures',            'tests/overtures.test.js'],
  ['orders-group-by-location','tests/orders-group-by-location.test.js'],
  ['naval-retreat',        'tests/naval-retreat.test.js'],
  ['npc-parity',           'tests/npc-parity.test.js'],
  ['report-privacy',       'tests/report-privacy.test.js',       FULL?[GM,'6','20','6']:[GM,'3','10','5']],
  ['fuzz-wages-combat',    'tests/fuzz-wages-combat.test.js',    FULL?[GM,'6','20','6','20000']:[GM,'3','10','5','4000']],
  ['fuzz-advance-masking', 'tests/fuzz-advance-masking.test.js', FULL?[GM,'6','20','6','20000']:[GM,'3','10','5','4000']],
  ['chromium-boot',        'tests/chromium-boot.test.js'],
  ['gm-messaging-boot',    'tests/gm-messaging-boot.test.js'],
];
const QUARANTINED=fs.readdirSync(path.join(__dirname,'quarantine')).filter(f=>f.endsWith('.test.js')).sort()
  .map(f=>[f.replace('.test.js',''),'tests/quarantine/'+f]);

let list=QUARANTINE?QUARANTINED:SUITE;
if(ONLY) list=list.filter(([n])=>n.includes(ONLY));

// Chromium is downloaded separately from npm install; say so plainly rather than fail obscurely.
try{
  const exe=require('playwright').chromium.executablePath();
  if(!fs.existsSync(exe)) throw new Error('missing');
}catch(e){
  console.log('Chromium for Playwright is not installed. Run:  npx playwright install chromium');
  process.exit(1);
}

console.log(`Kingdoms Call tests · ${QUARANTINE?'quarantine':FULL?'full':'standard'} run · seed ${SEED} · Node ${process.versions.node}\n`);
const results=[]; const t0=Date.now();
for(const [name,file,argv=[],env={}] of list){
  const t=Date.now();
  const r=spawnSync(process.execPath,[file,...argv],{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024,
    timeout:15*60*1000,env:{...process.env,KC_SEED:SEED,...env}});
  const secs=((Date.now()-t)/1000).toFixed(1);
  const ok=r.status===0;
  results.push({name,ok,secs});
  console.log(`${ok?'ok  ':'FAIL'} ${name.padEnd(24)} ${secs.padStart(6)}s`);
  if(!ok){
    const out=((r.stdout||'')+(r.stderr||'')).trimEnd().split('\n');
    const why=r.error?`  (${r.error.code||r.error.message})`:r.signal?`  (killed: ${r.signal})`:`  (exit ${r.status})`;
    console.log(why); out.slice(-40).forEach(l=>console.log('     | '+l.slice(0,300)));
  }
}
const failed=results.filter(r=>!r.ok);
console.log(`\n${results.length-failed.length} passed · ${failed.length} failed · ${((Date.now()-t0)/1000).toFixed(0)}s`);
if(failed.length) console.log(`Failed: ${failed.map(r=>r.name).join(', ')}\nRe-run with the same seed:  npm test -- --seed ${SEED}${FULL?' --full':''}`);
process.exit(failed.length?1:0);
