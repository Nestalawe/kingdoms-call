// tests/run.js: runs the suite. Each test is its own Node process; it passes when it exits 0.
//
//   npm test                      syntax check, page boot check, small turn fuzz, every kept harness
//   npm run test:full             the same with bigger fuzz runs
//   npm run test:quarantine       the quarantined harnesses (expected to fail; see tests/README.md)
//   npm test -- --seed 123        a different fixed seed (default below); printed at the start
//   npm test -- --only fuzz       only tests whose name contains "fuzz"
//   npm test -- --jobs 1          one test at a time (default: as many at once as the machine has cores)
//
// Tests run side by side, each in its own process with the same seed, so the results don't depend on the order or
// on how many run at once; the output is printed in the suite's order.
const {spawn}=require('child_process');
const fs=require('fs'), path=require('path'), os=require('os');

const args=process.argv.slice(2);
const flag=f=>args.includes(f);
const opt=(f,d)=>{ const i=args.indexOf(f); return i>=0&&args[i+1]!=null?args[i+1]:d; };
const FULL=flag('--full'), QUARANTINE=flag('--quarantine');
const SEED=String(opt('--seed',process.env.KC_SEED||'20261001'));
const ONLY=opt('--only',null);
const JOBS=Math.max(1,Number(opt('--jobs',process.env.KC_JOBS||(os.availableParallelism?os.availableParallelism():os.cpus().length)))||1);
const ROOT=path.resolve(__dirname,'..');
const GM='kingdoms-call-gm-portal.html';

// [name, file, args, env]. Sizes are the harnesses' own command-line arguments.
const SUITE=[
  ['syntax',               'tests/syntax.test.js'],
  ['docs',                 'tests/docs.test.js'],
  ['stamps',               'tests/stamps.test.js'],
  ['config',               'tests/config.test.js'],
  ['vendor-supabase',      'tests/vendor-supabase.test.js'],
  ['db-min',               'tests/db-min.test.js'],
  ['workflow-api-auth',    'tests/workflow-api-auth.test.js'],
  ['sql-banners',          'tests/sql-banners.test.js'],
  ['gm-portal-no-signup',  'tests/gm-portal-no-signup.test.js'],
  ['profiles-columns',     'tests/profiles-columns.test.js'],
  ['sort-comparators',     'tests/sort-comparators.test.js'],
  ['dangerous-paths',      'tests/dangerous-paths.test.js'],
  ['staging',              'tests/staging.test.js'],
  ['staging-footer',       'tests/staging-footer.test.js'],
  ['migrations',           'tests/migrations.test.js'],
  ['landing-footer',       'tests/landing-footer.test.js'],
  ['flyers-soldiers-words','tests/flyers-soldiers-words.test.js'],
  ['unit-type-words',      'tests/unit-type-words.test.js'],
  ['volley-thirty-words',  'tests/volley-thirty-words.test.js'],
  ['battle-lines-words',   'tests/battle-lines-words.test.js'],
  ['roster-words',         'tests/roster-words.test.js'],
  ['abilities-words',      'tests/abilities-words.test.js'],
  ['primal-words',         'tests/primal-words.test.js'],
  ['boot-pages',           'tests/boot-pages.test.js'],
  ['db-guard',             'tests/db-guard.test.js'],
  ['gm-offer-and-gate',    'tests/gm-offer-and-gate.test.js'],
  ['other-realms-slots',   'tests/other-realms-slots.test.js'],
  ['dispatch-limits',      'tests/dispatch-limits.test.js'],
  ['report-dispatch',      'tests/report-dispatch.test.js'],
  ['profiles-no-email',    'tests/profiles-no-email.test.js'],
  ['hall-of-fame-controls','tests/hall-of-fame-controls.test.js'],
  ['stats-forget-deleted', 'tests/stats-forget-deleted.test.js'],
  ['meta-missing-turn',    'tests/meta-missing-turn.test.js'],
  ['turn-fuzz',            'tests/turn-fuzz.test.js',            FULL?['16','12']:['4','6']],
  ['home-placement',       'tests/home-placement.test.js',       [], {RUNS:FULL?'1000':'200'}],
  ['druid-and-war-spoils', 'tests/druid-and-war-spoils.test.js'],
  ['flyers-soldiers',      'tests/flyers-soldiers.test.js'],
  ['unit-types',           'tests/unit-types.test.js'],
  ['volley-thirty',        'tests/volley-thirty.test.js'],
  ['battle-grid',          'tests/battle-grid.test.js'],
  ['battle-facing',        'tests/battle-facing.test.js'],
  ['battle-scout',         'tests/battle-scout.test.js'],
  ['battle-faced-lines',   'tests/battle-faced-lines.test.js'],
  ['battle-faced-turn',    'tests/battle-faced-turn.test.js'],
  ['roster',               'tests/roster.test.js'],
  ['goblins-two-a-turn',   'tests/goblins-two-a-turn.test.js'],
  ['abilities-human',      'tests/abilities-human.test.js'],
  ['abilities-elven',      'tests/abilities-elven.test.js'],
  ['abilities-dwarven',    'tests/abilities-dwarven.test.js'],
  ['abilities-orcish',     'tests/abilities-orcish.test.js'],
  ['abilities-turn',       'tests/abilities-turn.test.js'],
  ['primal-roster',        'tests/primal-roster.test.js'],
  ['primal-renames',       'tests/primal-renames.test.js'],
  ['two-crowns',           'tests/two-crowns.test.js'],
  ['shark-waters',         'tests/shark-waters.test.js'],
  ['new-creatures',        'tests/new-creatures.test.js'],
  ['abilities-beasts',     'tests/abilities-beasts.test.js'],
  ['abilities-beasts-turn','tests/abilities-beasts-turn.test.js'],
  ['battle-tweaks',        'tests/battle-tweaks.test.js'],
  ['hp-gain-private',      'tests/hp-gain-private.test.js'],
  ['battle-fronts-meet',   'tests/battle-fronts-meet.test.js'],
  ['beast-calls-gone',     'tests/beast-calls-gone.test.js'],
  ['terror-visible',       'tests/terror-visible.test.js'],
  ['beast-command',        'tests/beast-command.test.js'],
  ['primal-abilities-words','tests/primal-abilities-words.test.js'],
  ['island-back',          'tests/island-back.test.js'],
  ['leaderboard-records',  'tests/leaderboard-records.test.js', [], {N:FULL?'3000':'100'}],
  ['leaderboard-golden',   'tests/leaderboard-golden.test.js'],
  ['leaderboard-render',   'tests/leaderboard-render.test.js'],
  ['leaderboard-events-paging','tests/leaderboard-events-paging.test.js'],
  ['leaderboard-realm-bests','tests/leaderboard-realm-bests.test.js'],
  ['battle-spells-recorded','tests/battle-spells-recorded.test.js'],
  ['concede',              'tests/concede.test.js'],
  ['monarch-grave',        'tests/monarch-grave.test.js'],
  ['guardian-melee',       'tests/guardian-melee.test.js'],
  ['guardian-traits',      'tests/guardian-traits.test.js'],
  ['hit-cap',              'tests/hit-cap.test.js'],
  ['unit-fates',           'tests/unit-fates.test.js'],
  ['move-points',          'tests/move-points.test.js'],
  ['overtures',            'tests/overtures.test.js'],
  ['orders-group-by-location','tests/orders-group-by-location.test.js'],
  ['duel-refuse-default',  'tests/duel-refuse-default.test.js'],
  ['cast-practice-projection','tests/cast-practice-projection.test.js'],
  ['lair-province-unique', 'tests/lair-province-unique.test.js'],
  ['lair-effects-spread',  'tests/lair-effects-spread.test.js'],
  ['duel-skill-rise',      'tests/duel-skill-rise.test.js'],
  ['skill-names-capitalised','tests/skill-names-capitalised.test.js'],
  ['item-equip-note',      'tests/item-equip-note.test.js'],
  ['march-one-rate',       'tests/march-one-rate.test.js'],
  ['encounter-seventy',    'tests/encounter-seventy.test.js'],
  ['crown-wild-near',      'tests/crown-wild-near.test.js',      FULL?['12']:['4']],
  ['neutral-best-mix',     'tests/neutral-best-mix.test.js'],
  ['cast-practice-assumed','tests/cast-practice-assumed.test.js'],
  ['research-persevere',   'tests/research-persevere.test.js'],
  ['surgery-lines',        'tests/surgery-lines.test.js'],
  ['bolt-damage',          'tests/bolt-damage.test.js'],
  ['arrow-damage',         'tests/arrow-damage.test.js'],
  ['every-round-acts',    'tests/every-round-acts.test.js'], // batch 2026-10-14
  ['guardian-holds-melee','tests/guardian-holds-melee.test.js'], // batch 2026-10-14
  ['province-pools',       'tests/province-pools.test.js',       FULL?['10']:['4']],
  ['pursuit-one-battle',   'tests/pursuit-one-battle.test.js'],
  ['warg-run-down',        'tests/warg-run-down.test.js'],
  ['battle-lines-report',  'tests/battle-lines-report.test.js'],
  ['retreat-dry-ground',   'tests/retreat-dry-ground.test.js'],
  ['hire-price',           'tests/hire-price.test.js'],
  ['defend-naval-overland','tests/defend-naval-overland.test.js'],
  ['defend-once',          'tests/defend-once.test.js'],
  ['hp-wound-gain',        'tests/hp-wound-gain.test.js'],
  ['hero-every-phase',     'tests/hero-every-phase.test.js'],
  ['naval-retreat',        'tests/naval-retreat.test.js'],
  ['npc-parity',           'tests/npc-parity.test.js'],
  ['report-privacy',       'tests/report-privacy.test.js',       FULL?[GM,'6','20','6']:[GM,'3','10','5']],
  ['fuzz-wages-combat',    'tests/fuzz-wages-combat.test.js',    FULL?[GM,'6','20','6','20000']:[GM,'3','10','5','4000']],
  ['fuzz-advance-masking', 'tests/fuzz-advance-masking.test.js', FULL?[GM,'6','20','6','20000']:[GM,'3','10','5','4000']],
  ['chromium-boot',        'tests/chromium-boot.test.js'],
  ['third-party-requests', 'tests/third-party-requests.test.js'],
  ['orders-buttons-visible','tests/orders-buttons-visible.test.js'],
  ['map-fits-panel',       'tests/map-fits-panel.test.js'],
  ['dispatches-badge',     'tests/dispatches-badge.test.js'],
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

console.log(`Kingdoms Call tests · ${QUARANTINE?'quarantine':FULL?'full':'standard'} run · seed ${SEED} · Node ${process.versions.node} · ${JOBS} at a time\n`);

// One test in its own process; resolves with its result and output (never rejects).
function runOne([name,file,argv=[],env={}]){
  return new Promise(resolve=>{
    const t=Date.now(); let out='', settled=false;
    const child=spawn(process.execPath,[file,...argv],{cwd:ROOT,env:{...process.env,KC_SEED:SEED,...env}});
    child.stdout.on('data',d=>{ out+=d; }); child.stderr.on('data',d=>{ out+=d; });
    const timer=setTimeout(()=>child.kill('SIGKILL'),15*60*1000);
    const done=(status,signal,error)=>{ if(settled) return; settled=true; clearTimeout(timer);
      resolve({name,ok:status===0,secs:((Date.now()-t)/1000).toFixed(1),status,signal,error,out}); };
    child.on('error',e=>done(null,null,e));
    child.on('close',(code,signal)=>done(code,signal,null));
  });
}

(async()=>{
  const t0=Date.now(), results=new Array(list.length);
  let next=0, printed=0;
  // Print each result once it and every test before it in the suite have finished, so the order never changes.
  const flush=()=>{
    while(printed<list.length&&results[printed]){
      const r=results[printed++];
      console.log(`${r.ok?'ok  ':'FAIL'} ${r.name.padEnd(24)} ${r.secs.padStart(6)}s`);
      if(!r.ok){
        const why=r.error?`  (${r.error.code||r.error.message})`:r.signal?`  (killed: ${r.signal})`:`  (exit ${r.status})`;
        console.log(why); r.out.trimEnd().split('\n').slice(-40).forEach(l=>console.log('     | '+l.slice(0,300)));
      }
    }
  };
  const worker=async()=>{ while(next<list.length){ const i=next++; results[i]=await runOne(list[i]); flush(); } };
  await Promise.all(Array.from({length:Math.min(JOBS,list.length)},worker));
  const failed=results.filter(r=>!r.ok);
  console.log(`\n${results.length-failed.length} passed · ${failed.length} failed · ${((Date.now()-t0)/1000).toFixed(0)}s`);
  if(failed.length) console.log(`Failed: ${failed.map(r=>r.name).join(', ')}\nRe-run with the same seed:  npm test -- --seed ${SEED}${FULL?' --full':''}`);
  process.exit(failed.length?1:0);
})();
