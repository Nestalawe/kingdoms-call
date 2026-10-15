// Suspending and deleting accounts on the Overlord page (P0-32h, ruling R-097, D-13 follow-up 2). Page level (jsdom, the
// in-memory database of lib/stub-db.js, which mirrors account_suspend, account_unsuspend and account_delete):
//   - the page says a session already open lasts until it expires, up to an hour;
//   - each account but the Overlord's own has Suspend (for a day, a week, until lifted) and Delete…; a suspended one
//     says until when, and has Lift suspension instead of Suspend;
//   - Suspend calls account_suspend with the end chosen (none for "until lifted"); Lift calls account_unsuspend;
//   - Delete… says what goes and what stays, and deletes only once the account's email is typed; then the account
//     leaves the list and its finished game keeps its realm with no account;
//   - a deletion the database refuses (the account plays in a running game) shows why, and the account stays; one who
//     runs an unfinished game is told to hand it over first;
//   - what people wrote is shown as text.
const {readPage,bootJsdom}=require('./lib/boot'); const {makeStub}=require('./lib/stub-db');

let fails=0;
const check=(c,m)=>{ if(!c){ fails++; console.log('FAIL '+m); } else console.log('ok   '+m); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const PAGE='kingdoms-call-overlord.html';
const HOSTILE='<img id="kc-injected" src="x">';
const DAY=864e5;

function world(S){
  S.DB.profiles.length=0;
  S.DB.profiles.push({id:'ov1',name:'Test Overlord'},{id:'gm1',name:'Warden Oake'},{id:'p1',name:'Ada Thorn'},
    {id:'p2',name:'Bram Vey'},{id:'p5',name:HOSTILE});
  S.DB.accounts={ov1:{email:'overlord@example.test'},gm1:{email:'gm1@example.test'},p1:{email:'p1@example.test'},
    p2:{email:'p2@example.test',banned_until:new Date(Date.now()+3*DAY).toISOString()},p5:{email:'p5@example.test'}};
  S.DB.site_admins.push({user_id:'ov1'});
  S.DB.games.push({id:'G1',name:'Marchwood',gm_user_id:'gm1',status:'active',turn:3,created_at:'2026-10-01T00:00:00Z',meta:{v:1,turnMode:{mode:'manual'}}},
    {id:'G2',name:'Ashen Reach',gm_user_id:'gm1',status:'complete',turn:9,created_at:'2026-09-01T00:00:00Z',meta:{v:1}});
  S.DB.game_players.push({id:'s1',game_id:'G1',user_id:'p1',player_index:0,display_name:'Thornmere'},
    {id:'s2',game_id:'G2',user_id:'p5',player_index:0,display_name:'Wrenholt'});
}
async function boot(){
  const S=makeStub(); world(S); S.setUser('ov1');
  const errs=[];
  const dom=bootJsdom(readPage(PAGE),{supabase:S.supabase,url:'https://example.org/'+PAGE,setup(w){
    w.addEventListener('error',e=>errs.push(e.error&&e.error.stack||e.message));
    w.onunhandledrejection=e=>errs.push(String(e.reason&&e.reason.stack||e.reason));
    w.console.error=(...a)=>errs.push('console.error: '+a.map(String).join(' '));
    w.console.warn=()=>{}; w.console.log=()=>{};
  }});
  await wait(400);
  return {S,W:dom.window,doc:dom.window.document,errs};
}
const row=(doc,id)=>doc.querySelector(`#accounts tr[data-user="${id}"]`);
const btn=(scope,act)=>scope&&scope.querySelector(`[data-act="${act}"]`);
const press=e=>{ if(e) e.click(); };
const setVal=(e,v)=>{ if(e) e.value=v; };
const txt=e=>e?e.textContent:'';
const near=(iso,ms)=>!!iso&&Math.abs(new Date(iso).getTime()-(Date.now()+ms))<5*60e3;
const noErrors=(errs,who)=>check(!errs.length,`${who}: no page errors`+(errs.length?': '+String(errs[0]).split('\n')[0]:''));

(async()=>{
  // ── what each account offers ──
  {
    const {doc,W,errs}=await boot();
    check(/session lasts until it expires, up to an hour/.test(doc.getElementById('sec-main').textContent),'the page says an open session lasts up to an hour');
    const p1=row(doc,'p1'), p2=row(doc,'p2'), ov=row(doc,'ov1');
    check(!!btn(p1,'suspend')&&!!btn(p1,'suspend-for')&&!!btn(p1,'delete'),'an account has Suspend and Delete…');
    check([...((btn(p1,'suspend-for')||{}).options||[])].map(o=>o.textContent).join('|')==='For a day|For a week|Until lifted','Suspend: for a day, a week, or until lifted');
    check(/Suspended until \d{4}-\d{2}-\d{2}/.test(txt(p2))&&!!btn(p2,'unsuspend')&&!btn(p2,'suspend'),'a suspended account says until when, and has Lift suspension');
    check(!btn(ov,'suspend')&&!btn(ov,'unsuspend')&&!btn(ov,'delete'),'the Overlord\'s own account has neither');
    noErrors(errs,'the list'); W.close();
  }

  // ── suspending and lifting ──
  {
    const {S,doc,W,errs}=await boot();
    press(btn(row(doc,'p1'),'suspend')); await wait(100);
    check(S.CALLS.includes('rpc.account_suspend')&&near(S.DB.accounts.p1.banned_until,DAY),'Suspend for a day calls account_suspend, ending a day from now');
    check(/Suspended until/.test(txt(row(doc,'p1')))&&!!btn(row(doc,'p1'),'unsuspend'),'and the account shows Suspended');
    press(btn(row(doc,'p1'),'unsuspend')); await wait(100);
    check(S.CALLS.includes('rpc.account_unsuspend')&&S.DB.accounts.p1.banned_until==null,'Lift suspension calls account_unsuspend');
    check(!/Suspended/.test(txt(row(doc,'p1')))&&!!btn(row(doc,'p1'),'suspend'),'and the account can be suspended again');
    setVal(btn(row(doc,'p1'),'suspend-for'),'week'); press(btn(row(doc,'p1'),'suspend')); await wait(100);
    check(near(S.DB.accounts.p1.banned_until,7*DAY),'for a week ends a week from now');
    press(btn(row(doc,'p1'),'unsuspend')); await wait(100);
    setVal(btn(row(doc,'p1'),'suspend-for'),'lifted'); press(btn(row(doc,'p1'),'suspend')); await wait(100);
    check(new Date(S.DB.accounts.p1.banned_until).getTime()>Date.now()+90*365*DAY,'until lifted passes no end (the database stores a hundred years)');
    check(/Suspended until lifted/.test(txt(row(doc,'p1'))),'and shows as Suspended until lifted');
    noErrors(errs,'suspend'); W.close();
  }

  // ── deleting ──
  {
    const {S,doc,W,errs}=await boot();
    press(btn(row(doc,'p5'),'delete')); await wait(50);
    const panel=doc.getElementById('delete-panel');
    check(!!panel&&/can't be undone/.test(panel.textContent),'Delete… opens a panel that says it can\'t be undone');
    check(!!panel&&/Goes: their sign-in, their profile/.test(panel.textContent)&&/Stays: their finished games/.test(panel.textContent),'and says what goes and what stays');
    const typed=doc.getElementById('delete-typed')||doc.createElement('input'), go=doc.getElementById('delete-confirm')||doc.createElement('button');
    check(!!doc.getElementById('delete-confirm')&&go.disabled,'Delete is disabled until the email is typed');
    typed.value='p1@example.test'; typed.dispatchEvent(new W.Event('input'));
    check(go.disabled,'another email doesn\'t enable it');
    go.click(); await wait(50);
    check(!S.CALLS.includes('rpc.account_delete'),'and clicking it does nothing');
    typed.value='  P5@Example.test '; typed.dispatchEvent(new W.Event('input'));
    check(!go.disabled,'the account\'s own email enables it');
    go.click(); await wait(100);
    check(S.CALLS.includes('rpc.account_delete')&&!S.DB.profiles.some(p=>p.id==='p5'),'Delete calls account_delete');
    check(!row(doc,'p5')&&/account is deleted/.test(doc.getElementById('msg').textContent),'the account leaves the list, and the page says so');
    check(S.DB.game_players.find(x=>x.id==='s2').user_id==null,'its finished game keeps its realm, with no account');
    check(!doc.getElementById('kc-injected'),'what people wrote is shown as text');
    noErrors(errs,'delete'); W.close();
  }
  {
    const {S,doc,W,errs}=await boot();
    press(btn(row(doc,'p1'),'delete')); await wait(50);
    const typed=doc.getElementById('delete-typed')||doc.createElement('input');
    typed.value='p1@example.test'; typed.dispatchEvent(new W.Event('input'));
    press(doc.getElementById('delete-confirm')); await wait(100);
    check(/plays in an unfinished game: suspend it instead/.test(doc.getElementById('msg').textContent),'a refused deletion shows why (playing in a running game)');
    check(S.DB.profiles.some(p=>p.id==='p1')&&!!row(doc,'p1'),'and the account stays');
    press(btn(row(doc,'gm1'),'delete')); await wait(50);
    check(/run 1 unfinished game: hand it over first/.test(txt(doc.getElementById('delete-panel'))),'a GM with an unfinished game is told to hand it over first');
    check(!doc.getElementById('revoke-panel'),'one panel at a time');
    noErrors(errs,'refused'); W.close();
  }

  process.exit(fails?1:0);
})().catch(e=>{ console.error('HARNESS',e); process.exit(2); });
