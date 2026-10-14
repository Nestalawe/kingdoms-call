// The Overlord page (P0-32f, ruling R-097). Page level (jsdom, the in-memory database of lib/stub-db.js, which
// mirrors the Overlord's functions):
//   - signed out: the sign-in form, and nothing is read; signed in as anyone but the Overlord: "This page is for
//     the Overlord", and nothing is read but that check; a check that fails says so;
//   - the Overlord: every account, searchable; Offer GM calls gm_offer, Withdraw offer gm_withdraw_offer;
//   - Revoke GM lists the account's unfinished games, each with Hand over to… (Game Masters only, not the
//     account itself); Revoke stays disabled until none are left; handing over calls reassign_game; then Revoke
//     calls gm_revoke;
//   - every game, with its GM, status, turn mode, Hand over to… and a link to it in the GM portal;
//   - the reported dispatches of every game, with realm names; Delete removes the dispatch;
//   - everything people wrote (names, emails, game names, dispatches, reasons) is shown as text, never markup.
const {readPage,bootJsdom}=require('./lib/boot'); const {makeStub}=require('./lib/stub-db');

let fails=0;
const check=(c,m)=>{ if(!c){ fails++; console.log('FAIL '+m); } else console.log('ok   '+m); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const PAGE='kingdoms-call-overlord.html';
const HOSTILE='<img id="kc-injected" src="x">';

function world(S){
  S.DB.profiles.length=0;
  S.DB.profiles.push({id:'ov1',name:'Test Overlord'},{id:'gm1',name:'Warden Oake'},{id:'gm2',name:'Warden Pell'},
    {id:'p1',name:'Ada Thorn'},{id:'p2',name:'Bram Vey'},{id:'p3',name:HOSTILE});
  S.DB.accounts={ov1:{email:'overlord@example.test'},gm1:{email:'gm1@example.test',joined:'2026-09-01T00:00:00Z',last_sign_in:'2026-10-13T00:00:00Z'},
    gm2:{email:'gm2@example.test'},p1:{email:'p1@example.test'},p2:{email:'p2@example.test'},p3:{email:'p3@example.test'}};
  S.DB.site_admins.push({user_id:'ov1'});
  S.DB.game_masters.push({user_id:'gm2',offered_at:'2026-10-01T00:00:00Z',offered_by:'ov1',accepted_at:'2026-10-01T00:00:00Z'},
    {user_id:'p2',offered_at:'2026-10-12T00:00:00Z',offered_by:'ov1',accepted_at:null});
  const g=(id,name,gm,status,turn,mode,extra)=>({id,name,gm_user_id:gm,status,turn,max_turns:12,created_at:'2026-10-0'+id.slice(-1)+'T00:00:00Z',
    meta:{v:1,turnMode:{mode},...(extra||{})},game_state:'{"world":"hidden"}'});
  S.DB.games.push(g('G1','Marchwood','gm1','active',3,'auto'),g('G2','Open Vale','gm1','setup',0,'manual'),
    g('G3','Ashen Reach','gm1','complete',9,'manual'),g('G4','Fenmoor','gm2','active',2,'deadline',{archived:true}),
    g('G5',HOSTILE,'gm2','active',1,'manual'));
  S.DB.game_players.push({id:'s1',game_id:'G1',user_id:'p1',player_index:0,display_name:'Thornmere'},
    {id:'s2',game_id:'G1',user_id:'p3',player_index:1,display_name:HOSTILE});
  S.DB.game_messages.push({id:7,game_id:'G1',turn:3,from_index:1,to_indexes:[0],scope:'private',body:'Yield the ford. '+HOSTILE});
  S.DB.message_reports.push({id:1,message_id:7,game_id:'G1',reporter_index:0,reason:'Threats '+HOSTILE,created_at:'2026-10-13T00:00:00Z'});
}
async function boot(user,stage){
  const S=makeStub(); world(S); S.setUser(user);
  if(stage) stage(S);
  const errs=[], dbCalls=[];
  const dom=bootJsdom(readPage(PAGE),{supabase:S.supabase,dbCalls,url:'https://example.org/'+PAGE,setup(w){
    w.addEventListener('error',e=>errs.push(e.error&&e.error.stack||e.message));
    w.onunhandledrejection=e=>errs.push(String(e.reason&&e.reason.stack||e.reason));
    w.console.error=(...a)=>errs.push('console.error: '+a.map(String).join(' '));
    w.console.warn=()=>{}; w.console.log=()=>{};
  }});
  await wait(400);
  return {S,W:dom.window,doc:dom.window.document,errs,dbCalls};
}
const on=(doc,id)=>!!doc.getElementById(id)&&doc.getElementById(id).classList.contains('on');
const row=(doc,box,attr,key)=>doc.querySelector(`#${box} tr[${attr}="${key}"]`);
const btn=(scope,act)=>scope&&scope.querySelector(`[data-act="${act}"]`);
const noErrors=(errs,who)=>check(!errs.length,`${who}: no page errors`+(errs.length?': '+String(errs[0]).split('\n')[0]:''));
const noInjection=(doc,who)=>check(!doc.getElementById('kc-injected'),`${who}: what people wrote is shown as text, not markup`);

(async()=>{
  // ── who may use it ──
  {
    const {doc,W,errs,dbCalls}=await boot(null);
    check(on(doc,'sec-auth')&&!!doc.getElementById('si-email')&&!!doc.getElementById('si-password'),'signed out: the sign-in form shows');
    check(dbCalls.join()==='rpc:kc_db_version','signed out: nothing is read'+(dbCalls.length>1?` (${dbCalls.join(', ')})`:''));
    noErrors(errs,'signed out'); W.close();
  }
  for(const [label,user] of [['a player','p1'],['a Game Master','gm1']]){
    const {doc,W,errs,dbCalls}=await boot(user);
    check(on(doc,'sec-denied')&&/This page is for the Overlord\./.test(doc.getElementById('sec-denied').textContent),`${label}: "This page is for the Overlord"`);
    check(!on(doc,'sec-main'),`${label}: nothing else shows`);
    check(dbCalls.join()==='rpc:kc_db_version,rpc:is_site_admin',`${label}: nothing is read but the check`+(dbCalls.length>2?` (${dbCalls.join(', ')})`:''));
    noErrors(errs,label); W.close();
  }
  {
    const {doc,W,errs,dbCalls}=await boot('ov1',S=>S.RPC_ERRORS.add('is_site_admin'));
    check(on(doc,'sec-denied')&&/Couldn't check/.test(doc.getElementById('denied-msg').textContent),'a failed check: the page stops and says it couldn\'t check');
    check(!dbCalls.some(c=>c.startsWith('from:')||c==='rpc:overlord_accounts'),'and nothing else loads');
    noErrors(errs,'failed check'); W.close();
  }

  // ── the Overlord: accounts ──
  {
    const {S,doc,W,errs}=await boot('ov1');
    check(on(doc,'sec-main'),'the Overlord: the page shows');
    const acc=doc.getElementById('accounts');
    check(doc.querySelectorAll('#accounts tbody tr[data-user]').length===6,'every account is listed');
    const gm1=row(doc,'accounts','data-user','gm1');
    check(!!gm1&&/Warden Oake/.test(gm1.textContent)&&/gm1@example\.test/.test(gm1.textContent)&&/2026-09-01/.test(gm1.textContent)&&/2026-10-13/.test(gm1.textContent),
      'with name, email, joined and last sign-in');
    const cells=[...gm1.cells].map(c=>c.textContent.trim());
    check(cells[4]==='Game Master'&&cells[5]==='3'&&cells[6]==='0',`and GM status, games run and played (${cells.slice(4,7).join(' | ')})`);
    check(!btn(row(doc,'accounts','data-user','ov1'),'offer')&&!btn(row(doc,'accounts','data-user','ov1'),'revoke'),'the Overlord\'s own account has no actions');
    check(/Offered/.test(row(doc,'accounts','data-user','p2').textContent)&&!!btn(row(doc,'accounts','data-user','p2'),'withdraw'),'an open offer shows Withdraw offer');

    const q=doc.getElementById('acct-q'); q.value='THORN'; q.dispatchEvent(new W.Event('input'));
    check(doc.querySelectorAll('#accounts tbody tr[data-user]').length===1&&!!row(doc,'accounts','data-user','p1'),'search by name narrows the list');
    q.value='gm2@'; q.dispatchEvent(new W.Event('input'));
    check(doc.querySelectorAll('#accounts tbody tr[data-user]').length===1&&!!row(doc,'accounts','data-user','gm2'),'search by email too');
    q.value=''; q.dispatchEvent(new W.Event('input'));

    btn(row(doc,'accounts','data-user','p1'),'offer').click(); await wait(100);
    check(S.CALLS.includes('rpc.gm_offer')&&S.DB.game_masters.some(r=>r.user_id==='p1'&&r.accepted_at==null),'Offer GM calls gm_offer');
    check(/Offered/.test(row(doc,'accounts','data-user','p1').textContent),'and the account now shows Offered');
    btn(row(doc,'accounts','data-user','p2'),'withdraw').click(); await wait(100);
    check(S.CALLS.includes('rpc.gm_withdraw_offer')&&!S.DB.game_masters.some(r=>r.user_id==='p2'),'Withdraw offer calls gm_withdraw_offer');
    check(!!btn(row(doc,'accounts','data-user','p2'),'offer'),'and the account can be offered again');
    noInjection(doc,'accounts'); noErrors(errs,'accounts');
    W.close();
  }

  // ── revoking a GM: hand their unfinished games over first ──
  {
    const {S,doc,W,errs}=await boot('ov1');
    btn(row(doc,'accounts','data-user','gm1'),'revoke').click(); await wait(50);
    const panel=()=>doc.getElementById('revoke-panel');
    const listed=()=>[...panel().querySelectorAll('tr[data-game]')].map(r=>r.getAttribute('data-game')).sort().join();
    check(!!panel()&&listed()==='G1,G2','Revoke GM lists the account\'s unfinished games (not the finished one)');
    check(doc.getElementById('revoke-confirm').disabled,'Revoke is disabled while any is left');
    const pickFor=gid=>panel().querySelector(`tr[data-game="${gid}"] [data-act="pick"]`);
    const choices=[...pickFor('G1').options].map(o=>o.value).filter(Boolean);
    check(choices.join()==='gm2','Hand over to… offers Game Masters only, not the account itself');
    doc.getElementById('revoke-confirm').click(); await wait(50);
    check(!S.CALLS.includes('rpc.gm_revoke'),'clicking the disabled Revoke does nothing');
    for(const gid of ['G1','G2']){
      pickFor(gid).value='gm2';
      panel().querySelector(`tr[data-game="${gid}"] [data-act="handover"]`).click(); await wait(100);
    }
    check(S.CALLS.filter(c=>c==='rpc.reassign_game').length===2&&S.DB.games.filter(g=>g.gm_user_id==='gm2').length===4,'Hand over calls reassign_game for each');
    check(!!panel()&&listed()===''&&/no unfinished game/.test(panel().textContent),'then none is left');
    check(!doc.getElementById('revoke-confirm').disabled,'and Revoke is enabled');
    doc.getElementById('revoke-confirm').click(); await wait(100);
    check(S.CALLS.includes('rpc.gm_revoke')&&!S.DB.game_masters.some(r=>r.user_id==='gm1'),'Revoke calls gm_revoke');
    check(/Player/.test(row(doc,'accounts','data-user','gm1').textContent),'and the account is no longer a Game Master');
    check(S.DB.games.find(g=>g.id==='G3').gm_user_id==='gm1','the finished game stays theirs');
    noErrors(errs,'revoke');
    W.close();
  }

  // ── every game ──
  {
    const {S,doc,W,errs}=await boot('ov1');
    const ids=[...doc.querySelectorAll('#games tr[data-game]')].map(r=>r.getAttribute('data-game')).sort().join();
    check(ids==='G1,G2,G3,G4,G5','every game is listed, whoever runs it');
    const g4=row(doc,'games','data-game','G4');
    check(/Warden Pell/.test(g4.textContent)&&/active/.test(g4.textContent)&&/Archived/.test(g4.textContent)&&/deadline/i.test(g4.textContent),
      'with its GM, status (archived too) and turn mode');
    const open=g4.querySelector('a');
    check(!!open&&open.getAttribute('href')==='kingdoms-call-gm-portal.html?game=G4'&&/Open in the GM portal/.test(open.textContent),'and a link to it in the GM portal');
    const pick=g4.querySelector('[data-act="pick"]');
    check([...pick.options].map(o=>o.value).filter(Boolean).join()==='gm1','Hand over to… offers the other Game Masters');
    pick.value='gm1'; g4.querySelector('[data-act="handover"]').click(); await wait(100);
    check(S.DB.games.find(g=>g.id==='G4').gm_user_id==='gm1','Hand over gives the game to the chosen GM');
    check(/Warden Oake/.test(row(doc,'games','data-game','G4').textContent),'and the list shows its new GM');
    noInjection(doc,'games'); noErrors(errs,'games');
    W.close();
  }
  // The list reads light columns only, never the world.
  {
    const S=makeStub(); world(S); S.setUser('ov1');
    let sel=null;
    const sb=S.supabase.createClient();
    const orig=sb.from; sb.from=t=>{ const q=orig(t); if(t==='games'){ const s=q.select; q.select=c=>{ sel=c; return s(c); }; } return q; };
    const dom=bootJsdom(readPage(PAGE),{supabase:{createClient:()=>sb},url:'https://example.org/'+PAGE,setup(w){ w.console.warn=()=>{}; w.console.log=()=>{}; }});
    await wait(400);
    check(!!sel&&!/game_state|\*/.test(sel),`the game list reads light columns (${sel})`);
    dom.window.close();
  }

  // ── reported dispatches ──
  {
    const {S,doc,W,errs}=await boot('ov1');
    const r=doc.querySelector('#reports [data-message="7"]');
    check(!!r&&/Marchwood/.test(r.textContent)&&/Turn 3/.test(r.textContent),'a reported dispatch shows with its game and turn');
    check(!!r&&/from .*<img id="kc-injected" src="x">.* to Thornmere/.test(r.textContent)&&/reported by Thornmere/.test(r.textContent),'with sender, recipient and reporter by realm name');
    check(!!r&&/Threats/.test(r.textContent)&&/Yield the ford\./.test(r.textContent),'with the reason and the text');
    btn(r,'delete-dispatch').click(); await wait(100);
    check(!S.DB.game_messages.some(m=>m.id===7),'Delete removes the dispatch');
    check(/No dispatches reported/.test(doc.getElementById('reports').textContent),'and the list empties');
    noInjection(doc,'reports'); noErrors(errs,'reports');
    W.close();
  }

  // ── a refusal shows the database's reason ──
  {
    const {doc,W,errs}=await boot('ov1');
    // the database refuses the hand-over (e.g. the chosen GM was revoked in another tab since the list loaded)
    doc.querySelector('#games tr[data-game="G5"] [data-act="pick"]').value='gm1';
    W.eval("sb.rpc=(fn,a)=>Promise.resolve(fn==='reassign_game'?{data:null,error:{message:'That account isn\\'t a Game Master.'}}:{data:[],error:null})");
    doc.querySelector('#games tr[data-game="G5"] [data-act="handover"]').click(); await wait(100);
    check(/That account isn't a Game Master\./.test(doc.getElementById('msg').textContent),'a refused hand-over shows why');
    noErrors(errs,'refusal'); W.close();
  }

  process.exit(fails?1:0);
})().catch(e=>{ console.error('HARNESS',e); process.exit(2); });
