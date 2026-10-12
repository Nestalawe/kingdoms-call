// Who edits the Hall of Fame (P0-22, rulings D-09 and D-11). Page level (jsdom, a stand-in database serving two
// finished games, one run by gm-1 and one by gm-2), opened in GM mode (?gm=1):
//   - a GM gets edit controls on their own games' entries only (the database refuses the others since P0-22);
//   - only the Overlord renames a player, through rename_player (the name only), and edits every entry;
//   - a signed-in player gets no controls; the page never offers SQL to paste.
const {readPage,bootJsdom}=require('./lib/boot'); const {leaderboardStub}=require('./lib/stub-db');

let fails=0;
const check=(c,m)=>{ if(!c){ fails++; console.log('FAIL '+m); } else console.log('ok   '+m); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));

const entry=(id,name,gm,day)=>({game_id:id,game_name:name,gm_user_id:gm,build:'lb2',hidden:false,
  started_at:`2026-09-${day}T12:00:00Z`,finished_at:`2026-10-${day}T12:00:00Z`,turns:12,winner_realm:'Thornmere',victory:'reckoning',
  setup:{humans:2,bots:0,realms:2,diplomacy:'normal',mapSize:'p2'},records:{},totals:{},
  standings:[{rank:1,realm:'Thornmere',uid:'p-1',bot:false,score:120,winner:true,race:'Human',al:'Good',titles:[]},
             {rank:2,realm:'Veyholt',  uid:'p-2',bot:false,score:80, race:'Elven',al:'Neutral',titles:[]}]});
const ROWS=[entry('g-own','Marchwood','gm-1','10'),entry('g-other','Fenmoor','gm-2','11')];

async function boot(who){
  const calls=[], errs=[];
  const sb=leaderboardStub({rows:()=>ROWS,calls,signedIn:true,me:who.me,isGm:!!who.gm,isOverlord:!!who.overlord});
  const dom=bootJsdom(readPage('kingdoms-call-leaderboard.html'),{pretendToBeVisual:false,
    url:'https://example.test/kingdoms-call-leaderboard.html?gm=1',supabase:{createClient:()=>sb},
    setup(w){ w.addEventListener('error',e=>errs.push(e.message)); w.alert=m=>errs.push('alert: '+m);
      w.prompt=()=>'  Ada of the Ford '; w.console.error=(...a)=>errs.push('console.error: '+a.join(' ')); }});
  await wait(400);
  return {W:dom.window,doc:dom.window.document,calls,errs};
}
const editButtonFor=(doc,id)=>!!doc.querySelector(`[onclick*="toggleEdit('${id}')"]`);
const renameButtons=doc=>doc.querySelectorAll('[onclick^="renamePlayer("]').length;

(async()=>{
  {
    const {W,doc,errs}=await boot({me:'gm-1',gm:true});
    check(/editing on/.test(doc.getElementById('gm-pill').innerHTML),'a GM: editing is on');
    W.setTab('games');
    check(editButtonFor(doc,'g-own'),'a GM: edit controls on their own game\'s entry');
    check(!editButtonFor(doc,'g-other'),'a GM: none on another GM\'s entry');
    W.setTab('champions');
    check(renameButtons(doc)===0,'a GM: no rename buttons');
    check(!/SQL Editor|create policy/i.test(doc.documentElement.outerHTML),'no SQL to paste anywhere on the page');
    check(!errs.length,'a GM: no page errors'+(errs.length?': '+errs[0]:''));
    W.close();
  }
  {
    const {W,doc,calls,errs}=await boot({me:'ov-1',overlord:true});
    check(/editing on/.test(doc.getElementById('gm-pill').innerHTML),'the Overlord: editing is on');
    W.setTab('games');
    check(editButtonFor(doc,'g-own')&&editButtonFor(doc,'g-other'),'the Overlord: edit controls on every entry');
    W.setTab('champions');
    check(renameButtons(doc)===2,`the Overlord: a rename button per player (${renameButtons(doc)})`);
    calls.length=0;
    await W.renamePlayer('p-1'); await wait(30);
    const r=calls.find(c=>c.rpc==='rename_player');
    check(!!r&&r.args&&r.args.p_user==='p-1'&&r.args.p_name==='Ada of the Ford','renaming calls rename_player with the trimmed name'+(r?` (${JSON.stringify(r.args)})`:''));
    check(!calls.some(c=>c.table==='profiles'),'and writes no profile directly');
    check(!errs.length,'the Overlord: no page errors'+(errs.length?': '+errs[0]:''));
    W.close();
  }
  {
    const {W,doc,errs}=await boot({me:'p-1'});
    check(!/editing on/.test(doc.getElementById('gm-pill').innerHTML),'a player with ?gm=1: editing stays off');
    W.setTab('games');
    check(!editButtonFor(doc,'g-own')&&!editButtonFor(doc,'g-other'),'and no edit controls');
    check(!errs.length,'a player: no page errors'+(errs.length?': '+errs[0]:''));
    W.close();
  }
  process.exit(fails?1:0);
})().catch(e=>{ console.error('HARNESS',e); process.exit(2); });
