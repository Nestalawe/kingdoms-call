// No screen shows another player's email (P0-31, ruling D-08). Page level (jsdom, the in-memory database of
// lib/stub-db.js). Every account has an email in its profile. Twice: as today, and with the email column's
// privilege taken away (P0-31's database step: a read of '*' or of email is then refused, even of your own row).
//   - the GM portal's invite picker lists other players by name (with the month they joined, to tell two
//     players of one name apart), never by email, and searches by name;
//   - the player portal still shows your own name.
const {readPage,bootJsdom}=require('./lib/boot'); const {makeStub}=require('./lib/stub-db');

let fails=0;
const check=(c,m)=>{ if(!c){ fails++; console.log('FAIL '+m); } else console.log('ok   '+m); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));

async function boot(page,user,revoked){
  const S=makeStub();
  S.DB.profiles.length=0;
  S.DB.profiles.push(
    {id:'gm1',name:'Test GM',          email:'gm1@example.test', created_at:'2026-09-01T10:00:00Z'},
    {id:'p1', name:'Ada Thorn',        email:'ada@example.test', created_at:'2026-09-14T10:00:00Z'},
    {id:'p2', name:'Ada Thorn',        email:'ada2@example.test',created_at:'2026-10-03T10:00:00Z'},
    {id:'p3', name:'Bram Vey',         email:'bram@example.test',created_at:'2026-10-05T10:00:00Z'});
  if(revoked) S.REVOKED_COLS.add('profiles.email');
  S.setUser(user);
  const errs=[];
  const dom=bootJsdom(readPage(page),{supabase:S.supabase,setup(w){
    w.addEventListener('error',e=>errs.push(e.error&&e.error.stack||e.message));
    w.onunhandledrejection=e=>errs.push(String(e.reason&&e.reason.stack||e.reason));
    w.console.error=(...a)=>errs.push('console.error: '+a.map(String).join(' '));
    w.console.warn=()=>{}; w.console.log=()=>{};
  }});
  await wait(900);
  return {S,W:dom.window,doc:dom.window.document,errs};
}

(async()=>{
  for(const revoked of [false,true]){
    const when=revoked?'email column revoked':'as today';
    {
      const {W,doc,errs}=await boot('kingdoms-call-gm-portal.html','gm1',revoked);
      const priv=doc.querySelector('input[name="new-game-visibility"][value="private"]');
      if(priv) priv.checked=true;
      await W.eval('updateGameVisibility()'); await wait(50);
      const list=doc.getElementById('new-game-invite-list'), txt=list?list.textContent:'';
      check(/Ada Thorn/.test(txt)&&/Bram Vey/.test(txt),`${when}: the invite picker lists the players by name`+(txt?'':' (empty)'));
      check(!/@/.test(txt)&&!/@/.test((doc.getElementById('new-game-invite-count')||{}).textContent||''),`${when}: and shows no email`);
      check(/Sep 2026/.test(txt)&&/Oct 2026/.test(txt),`${when}: it shows the month each joined (two Ada Thorns)`);
      const search=doc.getElementById('new-game-invite-search');
      if(search){ search.value='ada@'; W.eval(`renderInviteCheckboxes('new-game-invite-list','new-game-invite-search',_inviteSelected,'new-game-invite-count')`); }
      check(!/Ada Thorn/.test(list?list.textContent:''),`${when}: searching by an email finds nobody`);
      check(!errs.length,`${when}: GM portal, no page errors`+(errs.length?': '+errs[0].split('\n')[0]:''));
      W.close();
    }
    {
      const {doc,W,errs}=await boot('kingdoms-call-player-portal.html','p3',revoked);
      check((doc.getElementById('player-name-display')||{}).textContent==='Bram Vey',`${when}: the player portal shows your own name`);
      check(!errs.length,`${when}: player portal, no page errors`+(errs.length?': '+errs[0].split('\n')[0]:''));
      W.close();
    }
  }
  process.exit(fails?1:0);
})().catch(e=>{ console.error('HARNESS',e); process.exit(2); });
