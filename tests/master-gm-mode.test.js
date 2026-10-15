// Master GM mode in the GM portal (P0-32g, ruling R-097). Page level (jsdom, the in-memory database of lib/stub-db.js):
//   - signed in as the Overlord: every game, whoever runs it, grouped by GM and filtered by game or GM name; no New
//     Game; the automatic watcher never starts, and the sign-in backfills (meta, results) touch no one's games;
//   - opening another GM's game with orders still missing shows Run turn now (a GM still waits for every order),
//     and Run turn now resolves that game in the stand-in database;
//   - Stats names every game's turns; ?game=<id> (the Overlord page's link) opens that game for the Overlord only;
//   - a Game Master's portal is as before: their own games, New Game, the watcher, the backfills on their games.
const {readPage,bootJsdom}=require('./lib/boot'); const {makeStub}=require('./lib/stub-db');

let fails=0;
const check=(c,m)=>{ if(!c){ fails++; console.log('FAIL '+m); } else console.log('ok   '+m); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const GM='kingdoms-call-gm-portal.html';
const until=async(cond,ms)=>{ const t=Date.now(); while(Date.now()-t<ms){ if(cond()) return true; await wait(50); } return cond(); };

const game=(id,name,gm,status,turn,extra)=>({id,name,gm_user_id:gm,status,turn,max_players:2,max_turns:999,
  created_at:'2026-10-0'+id.slice(-1)+'T00:00:00Z',meta:{v:1,turnMode:{mode:'manual'}},game_state:'{}',...(extra||{})});
function world(S){
  S.DB.profiles.push({id:'gm2',name:'Warden Pell'},{id:'ov1',name:'Test Overlord'},{id:'p1',name:'Ada Thorn'});
  S.DB.site_admins.push({user_id:'ov1'});
  S.DB.game_masters.push({user_id:'gm2',offered_at:'2026-10-01T00:00:00Z',offered_by:'ov1',accepted_at:'2026-10-01T00:00:00Z'});
  S.DB.games.push(
    game('G1','Marchwood','gm1','active',3),
    game('G2','Fenmoor','gm2','active',2),
    // orders still missing: p1 hasn't sent theirs
    game('G3','Hollow Reach','gm2','active',4),
    // an automatic game with every order in: a watcher would run it
    game('G4','Saltmarsh','gm2','active',5,{meta:{v:1,turnMode:{mode:'auto'}}}),
    // what the sign-in backfills look for: a game without meta, a finished game without results
    game('G5','Old Keep','gm2','active',2,{meta:null,game_state:'{"turnMode":{"mode":"manual"}}'}),
    game('G6','Ashen Fold','gm2','complete',9,{game_state:'{"gameOver":{"winner":0},"players":[{"name":"Morrowgate"}]}'}));
  S.DB.game_players.push(
    {id:'s31',game_id:'G3',user_id:'p1',player_index:0,display_name:'Thornmere',orders_submitted:false},
    {id:'s32',game_id:'G3',user_id:null,player_index:1,display_name:'Grimfast',orders_submitted:false,turn_report:'{"isBot":true}'},
    {id:'s41',game_id:'G4',user_id:'p1',player_index:0,display_name:'Thornmere',orders_submitted:true});
  S.DB.turn_events.push({id:1,game_id:'G2',turn:1,player_index:0,realm:'Morrowgate',orders:'{}',pre:'{}',post:'{}',outcomes:'{}'});
}
async function boot(user,opts={}){
  const S=makeStub(); world(S); S.setUser(user);
  if(opts.stage) opts.stage(S);
  const errs=[];
  const dom=bootJsdom(readPage(GM),{supabase:S.supabase,url:'https://example.org/'+GM+(opts.query||''),setup(w){
    w.addEventListener('error',e=>errs.push(e.error&&e.error.stack||e.message));
    w.onunhandledrejection=e=>errs.push(String(e.reason&&e.reason.stack||e.reason));
    w.console.error=(...a)=>errs.push('console.error: '+a.map(String).join(' '));
    w.console.warn=()=>{}; w.console.log=()=>{};
  }});
  await wait(opts.wait||900);
  return {S,W:dom.window,doc:dom.window.document,errs};
}
const text=(doc,id)=>(doc.getElementById(id)||{}).textContent||'';
const listed=doc=>[...doc.querySelectorAll('#games-list .game-card[data-game]')].map(c=>c.getAttribute('data-game')).sort().join();
const shown=el=>{ if(!el) return false; for(let e=el;e&&e.style;e=e.parentElement) if(e.style.display==='none') return false; return true; };
const writes=(S,re)=>S.CALLS.filter(c=>re.test(c));
const noErrors=(errs,who)=>check(!errs.length,`${who}: no page errors`+(errs.length?': '+String(errs[0]).split('\n')[0]:''));

(async()=>{
  // ── the Overlord's list ──
  {
    const {S,W,doc,errs}=await boot('ov1',{wait:3600});   // past the watcher's first tick (3 s)
    check(listed(doc)==='G1,G2,G3,G4,G5,G6','the Overlord sees every game, whoever runs it'+` (${listed(doc)})`);
    const groups=[...doc.querySelectorAll('#games-list .gm-group')].map(g=>g.getAttribute('data-gm'));
    check(groups.join('|')==='Test GM|Warden Pell','grouped by GM, by name'+` (${groups.join('|')})`);
    check(!shown(doc.getElementById('new-game-btn')),'no New Game');
    check(/Overlord/.test(text(doc,'gm-role-label')),'the header says Overlord');
    const f=doc.getElementById('overlord-filter');
    check(shown(f),'a filter shows');
    const filter=v=>{ if(f){ f.value=v; f.dispatchEvent(new W.Event('input')); } };
    filter('pell'); check(!!f&&listed(doc)==='G2,G3,G4,G5,G6','filtering by GM name');
    filter('MARCH'); check(!!f&&listed(doc)==='G1','filtering by game name');
    filter('');
    check(W.eval('_autoWatcherTimer')==null,'the automatic watcher never starts');
    check(S.DB.games.find(g=>g.id==='G4').turn===5&&!writes(S,/^games\.update$/).length,'and no game is run or saved, an automatic one with every order in included');
    check(!writes(S,/^game_results\.(insert|upsert)$/).length,'the sign-in backfills write nothing to other GMs\' games');
    noErrors(errs,'the Overlord\'s list');
    W.close();
  }
  // ── a Game Master's portal is as before ──
  {
    const {S,W,doc,errs}=await boot('gm2',{wait:1500});
    check(listed(doc)==='G2,G3,G4,G5,G6','a GM sees only their own games');
    check(shown(doc.getElementById('new-game-btn'))&&!shown(doc.getElementById('overlord-filter')),'with New Game and no filter');
    check(W.eval('_autoWatcherTimer')!=null,'and the watcher runs');
    check(S.DB.games.find(g=>g.id==='G5').meta!=null,'and the backfill stamps meta on their own game');
    await W.openGame('G3'); await wait(100);
    check(!shown(doc.getElementById('detail-run-turn-wrap')),'a GM still waits for every order before resolving');
    noErrors(errs,'a GM');
    W.close();
  }

  // ── Run turn now on another GM's game ──
  {
    const {doc,W,errs}=await boot('ov1');
    await W.openGame('G3'); await wait(100);
    check(doc.getElementById('detail-game-name').textContent==='Hollow Reach','the Overlord opens another GM\'s game');
    check(shown(doc.getElementById('detail-run-turn-wrap'))&&/Run turn now/.test(text(doc,'detail-run-turn-btn')),
      'with orders still missing, Run turn now shows');
    check(shown(doc.getElementById('detail-run-now-note')),'and says a realm without orders defends');
    noErrors(errs,'Run turn now shows');
    W.close();
  }
  {
    // a real two-bot world, run by gm2
    const {S,W,doc,errs}=await boot('ov1');
    const setup=W.generateBotSetups([],2,0).map(b=>({...b,gamePlayerId:'gr'+b.id,name:b.kingdomName}));
    const state=await W.generateNewGame(setup,{cols:10,rows:6},999,{seaPct:35}); state.botDifficulty='hard';
    S.DB.games.push(game('G7','Rescue Fen','gm2','active',1,{game_state:JSON.stringify(state)}));
    setup.forEach(sp=>S.DB.game_players.push({id:sp.gamePlayerId,game_id:'G7',user_id:null,player_index:sp.id,display_name:sp.name,
      orders:null,orders_submitted:false,turn_report:JSON.stringify({isBot:true})}));
    await W.openGame('G7'); await wait(100);
    const run=doc.getElementById('detail-run-turn-btn')||doc.querySelector('#detail-run-turn-wrap button');
    if(run&&shown(run)) run.click();
    const done=await until(()=>S.DB.games.find(g=>g.id==='G7').turn===2,30000);
    check(done,'Run turn now resolves another GM\'s game: it advances to Turn 2');
    check(S.DB.games.find(g=>g.id==='G7').gm_user_id==='gm2','and it is still that GM\'s game');
    check(S.DB.turn_logs.some(l=>l.game_id==='G7'&&l.player_index===-1),'and the GM\'s full log is written');
    noErrors(errs,'Run turn now');
    W.close();
  }

  // ── Stats and ?game= ──
  {
    const {doc,W,errs}=await boot('ov1');
    await W.openStats(true); await wait(100);
    const opts=[...doc.querySelectorAll('#stats-game option')].map(o=>o.textContent);
    check(opts.some(t=>/Fenmoor/.test(t)),'Stats names every game\'s turns'+` (${opts.join(' | ')})`);
    noErrors(errs,'Stats'); W.close();
  }
  {
    const {doc,W,errs}=await boot('ov1',{query:'?game=G2'});
    check(doc.getElementById('sec-game-detail').classList.contains('section-active')&&doc.getElementById('detail-game-name').textContent==='Fenmoor',
      '?game=<id> opens that game for the Overlord');
    noErrors(errs,'?game= (Overlord)'); W.close();
  }
  {
    const {doc,W,errs}=await boot('gm1',{query:'?game=G2'});
    check(!doc.getElementById('sec-game-detail').classList.contains('section-active'),'but not for a GM');
    noErrors(errs,'?game= (GM)'); W.close();
  }

  process.exit(fails?1:0);
})().catch(e=>{ console.error('HARNESS',e); process.exit(2); });
