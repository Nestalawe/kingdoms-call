// Game Masters by offer, on the pages (P0-32c). Page level (jsdom, the in-memory database of lib/stub-db.js,
// which mirrors the P0-32b functions):
//   - player portal: the "offered to make you a Game Master" banner shows only with an open offer; Accept calls
//     gm_accept_offer and then links to the GM portal; No thanks calls gm_decline_offer and the banner goes;
//   - GM portal: after sign-in, an account that is neither a Game Master nor the Overlord sees only "You're not
//     a Game Master", and nothing else loads (no game list, no watcher, no probes); so does one whose offer is
//     still open, and one whose check fails; a Game Master, and the Overlord, see their games.
const {readPage,bootJsdom}=require('./lib/boot'); const {makeStub}=require('./lib/stub-db');

let fails=0;
const check=(c,m)=>{ if(!c){ fails++; console.log('FAIL '+m); } else console.log('ok   '+m); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const OFFERED={offered_at:'2026-10-11T00:00:00Z',offered_by:'ov1',accepted_at:null};
const ACCEPTED={offered_at:'2026-10-11T00:00:00Z',offered_by:'ov1',accepted_at:'2026-10-11T01:00:00Z'};

async function boot(page,user,stage){
  const S=makeStub();
  S.DB.profiles.push({id:'p1',name:'Test Player One'},{id:'p3',name:'Test Player Three'},{id:'ov1',name:'Test Overlord'});
  S.DB.site_admins.push({user_id:'ov1'});
  S.setUser(user);
  if(stage) stage(S);
  const errs=[], dbCalls=[];
  const dom=bootJsdom(readPage(page),{supabase:S.supabase,dbCalls,setup(w){
    w.addEventListener('error',e=>errs.push(e.error&&e.error.stack||e.message));
    w.onunhandledrejection=e=>errs.push(String(e.reason&&e.reason.stack||e.reason));
    w.console.error=(...a)=>errs.push('console.error: '+a.map(String).join(' '));
    w.console.warn=()=>{}; w.console.log=()=>{};
  }});
  await wait(900);
  return {S,W:dom.window,doc:dom.window.document,errs,dbCalls};
}
const shown=el=>{ if(!el) return false; for(let e=el;e&&e.style;e=e.parentElement) if(e.style.display==='none'||e.hidden) return false; return true; };
const active=(doc,id)=>!!doc.getElementById(id)&&doc.getElementById(id).classList.contains('section-active');
const noErrors=(errs,who)=>check(!errs.length,`${who}: no page errors`+(errs.length?': '+errs[0].split('\n')[0]:''));

(async()=>{
  const PP='kingdoms-call-player-portal.html', GM='kingdoms-call-gm-portal.html';

  // ── Player portal: the offer banner ──
  {
    const {S,doc,W,errs}=await boot(PP,'p3',S=>S.DB.game_masters.push({user_id:'p3',...OFFERED}));
    const b=doc.getElementById('gm-offer-banner');
    check(shown(b)&&/The Overlord has offered to make you a Game Master/.test(b.textContent),'open offer: the banner shows on My Games');
    check(!!b&&!!b.closest('#sec-games'),'and it sits in My Games');
    const accept=doc.getElementById('gm-offer-accept');
    check(!!accept,'it has an Accept button');
    if(accept){
      accept.click(); await wait(100);
      check(S.CALLS.includes('rpc.gm_accept_offer'),'Accept calls gm_accept_offer');
      check(S.DB.game_masters.find(r=>r.user_id==='p3').accepted_at!=null,'and the offer is accepted');
      const link=b.querySelector('a[href="kingdoms-call-gm-portal.html"]');
      check(shown(b)&&!!link,'then the banner links to the GM portal');
      check(!shown(doc.getElementById('gm-offer-accept')),'and Accept is gone');
    }
    noErrors(errs,'accept');
    W.close();
  }
  {
    const {S,doc,W,errs}=await boot(PP,'p3',S=>S.DB.game_masters.push({user_id:'p3',...OFFERED}));
    const decline=doc.getElementById('gm-offer-decline');
    check(!!decline&&/No thanks/.test(decline.textContent),'the banner has a No thanks button');
    if(decline){
      decline.click(); await wait(100);
      check(S.CALLS.includes('rpc.gm_decline_offer'),'No thanks calls gm_decline_offer');
      check(!S.DB.game_masters.some(r=>r.user_id==='p3'),'and the offer is gone');
      check(!shown(doc.getElementById('gm-offer-banner')),'and so is the banner');
      check(!S.CALLS.includes('rpc.gm_accept_offer'),'and nothing was accepted');
    }
    noErrors(errs,'decline');
    W.close();
  }
  {
    const {S,doc,W,errs}=await boot(PP,'p1');
    check(S.CALLS.includes('game_masters.select'),'no offer: the portal asks');
    check(!shown(doc.getElementById('gm-offer-banner')),'and shows no banner');
    noErrors(errs,'no offer');
    W.close();
  }
  {
    const {doc,W,errs}=await boot(PP,'p1',S=>S.DB.game_masters.push({user_id:'p1',...ACCEPTED}));
    check(!shown(doc.getElementById('gm-offer-banner')),'already a Game Master: no banner');
    noErrors(errs,'accepted');
    W.close();
  }

  // ── GM portal: the gate ──
  const game=user=>({id:'G-'+user,name:'Vale of '+user,gm_user_id:user,status:'active',turn:3,max_players:3,max_turns:0,
    created_at:'2026-10-11T00:00:00Z',meta:null,game_state:'{}'});
  const gated=async(label,user,stage)=>{
    const {doc,W,errs,dbCalls}=await boot(GM,user,S=>{ S.DB.games.push(game(user)); if(stage) stage(S); });
    const g=doc.getElementById('sec-not-gm');
    check(active(doc,'sec-not-gm'),`${label}: the "not a Game Master" page shows`);
    check(!!g&&/You're not a Game Master\. Game Masters are chosen by the Overlord\./.test(g.textContent),`${label}: it says why`);
    check(!!g&&!!g.querySelector('a[href="kingdoms-call-player-portal.html"]'),`${label}: it links to the player portal`);
    check(!active(doc,'sec-games'),`${label}: the game list stays hidden`);
    const other=dbCalls.filter(c=>!['rpc:kc_db_version','rpc:is_game_master','rpc:is_site_admin'].includes(c));
    check(!other.length,`${label}: nothing else is read`+(other.length?` (${other.join(', ')})`:''));
    check(W.eval('_autoWatcherTimer')==null,`${label}: no turn watcher`);
    noErrors(errs,label);
    return {doc,W};
  };
  (await gated('a player','p1')).W.close();
  (await gated('an open offer','p3',S=>S.DB.game_masters.push({user_id:'p3',...OFFERED}))).W.close();

  // A failed check stops the page too, but says so instead of "not a Game Master".
  {
    const {doc,W,errs,dbCalls}=await boot(GM,'gm1',S=>{ S.DB.games.push(game('gm1')); S.RPC_ERRORS.add('is_game_master'); });
    check(active(doc,'sec-not-gm')&&/Couldn't check/.test(doc.getElementById('sec-not-gm').textContent),'a failed check: the page stops and says it couldn\'t check');
    check(!active(doc,'sec-games')&&!dbCalls.some(c=>c.startsWith('from:')),'and nothing else loads');
    noErrors(errs,'failed check');
    W.close();
  }

  // The Overlord runs no games of their own (P0-32d); in Master GM mode (P0-32g) they see every game (none here), and
  // the turn watcher never runs for them.
  for(const [label,user,listed,watcher] of [['a Game Master','gm1',/Vale of gm1/,true],['the Overlord','ov1',/No games yet/,false]]){
    const {doc,W,errs}=await boot(GM,user,S=>{ if(user==='gm1') S.DB.games.push(game(user)); });
    check(active(doc,'sec-games'),`${label}: the game list shows`);
    check(!active(doc,'sec-not-gm'),`${label}: no "not a Game Master" page`);
    check(listed.test(doc.getElementById('games-list').textContent),`${label}: the list is loaded (${listed.source})`);
    check((W.eval('_autoWatcherTimer')!=null)===watcher,`${label}: the turn watcher ${watcher?'runs':'doesn\'t run'}`);
    noErrors(errs,label);
    W.close();
  }

  process.exit(fails?1:0);
})().catch(e=>{ console.error('HARNESS',e); process.exit(2); });
