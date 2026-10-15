// Eliminated realms and dispatches, on screen (P0-25, ruling R-075). Page level (jsdom, the in-memory database of
// lib/stub-db.js). The player portal opens the game as it does for a player (openReport: the realm's turn report and
// the game's light row), and the dispatch is written through the composer:
//   - a realm still in the game sends privately and publicly, whatever the GM's switch says;
//   - a realm that has conceded, or whose dynasty is extinguished, can't send privately (the composer says why) but
//     can write to All Realms while the game's switch is off (where it is told too), and can't send at all once it is on;
//   - once the game is over, everyone sends privately again, both ways: to a realm that is out, and from it;
//   - the Dispatches note says so.
// GM portal: the game's screen has the switch "Block eliminated realms from sending dispatches"; it saves
// games.block_eliminated_msgs and shows the saved state when the game is opened again, for the game's GM and for the
// Overlord in Master GM mode.
const {readPage,bootJsdom}=require('./lib/boot'); const {makeStub}=require('./lib/stub-db');

let fails=0;
const check=(c,m)=>{ if(!c){ fails++; console.log('FAIL '+m); } else console.log('ok   '+m); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const PRIV='p:0-1';   // Thornmere (realm 0) and Veyholt (realm 1)

// Thornmere (p1, realm 0), Veyholt (p2, realm 1) and a computer realm, Grimfast (realm 2), in Marchwood.
// me: Thornmere's own state in its report ({conceded} / {eliminated}); them: Veyholt's, as Thornmere's report shows it.
function world({status='active',block=false,me={},them={}}={}){
  const S=makeStub();
  S.DB.profiles.push({id:'p1',name:'Test Player One'},{id:'p2',name:'Test Player Two'},{id:'ov1',name:'Test Overlord'},{id:'gm2',name:'Test GM Two'});
  S.DB.site_admins.push({user_id:'ov1'});
  S.DB.game_masters.push({user_id:'gm2',offered_at:'2026-10-01T00:00:00Z',offered_by:'ov1',accepted_at:'2026-10-01T00:00:00Z'});
  const game=(id,name,gm)=>({id,name,gm_user_id:gm,status,turn:6,max_players:3,max_turns:0,created_at:'2026-10-01T00:00:00Z',
    meta:{v:1,turnMode:{mode:'manual'}},game_state:'{}',block_eliminated_msgs:block});
  S.DB.games.push(game('G1','Marchwood','gm1'),game('G2','Fenmoor','gm2'));
  const report={turn:5,playerName:'Thornmere',kingdom:{conceded:false,eliminated:false,color:'#a33',...me},
    diplomacy:{known:[{index:1,name:'Veyholt',color:'#33a',relation:'neutral',conceded:false,eliminated:false,...them},
                      {index:2,name:'Grimfast',color:'#3a3',relation:'neutral'}]}};
  S.DB.game_players.push(
    {id:'s0',game_id:'G1',user_id:'p1',player_index:0,display_name:'Thornmere',orders_submitted:false,turn_report:JSON.stringify(report)},
    {id:'s1',game_id:'G1',user_id:'p2',player_index:1,display_name:'Veyholt',orders_submitted:false,turn_report:'{}'},
    {id:'s2',game_id:'G1',user_id:null,player_index:2,display_name:'Grimfast',orders_submitted:false,turn_report:'{"isBot":true}'});
  return S;
}
async function boot(S,page,user,url){
  S.setUser(user);
  const errs=[];
  const dom=bootJsdom(readPage(page),{supabase:S.supabase,...(url?{url}:{}),setup(w){
    w.addEventListener('error',e=>errs.push(e.error&&e.error.stack||e.message));
    w.onunhandledrejection=e=>errs.push(String(e.reason&&e.reason.stack||e.reason));
    w.console.warn=()=>{}; w.console.log=()=>{}; w.console.error=(...a)=>errs.push(a.join(' '));
    w.alert=m=>errs.push('alert: '+m);
  }});
  await wait(900);
  return {W:dom.window,doc:dom.window.document,errs};
}
// Thornmere's Dispatches, as the player opens the game.
async function player(opts){
  const S=world(opts);
  const b=await boot(S,'kingdoms-call-player-portal.html','p1');
  await b.W.eval(`openReport('s0')`); await wait(150);
  return {S,...b};
}
// Pick a channel the way the player does, write, send. What the composer showed, and whether the dispatch went.
async function trySend(P,key,body){
  const {W,doc,S}=P;
  const chip=doc.querySelector(`#msg-channels .msg-chan[data-ch="${key}"]`);
  if(chip) chip.click(); else W.eval(`setMsgChannel(${JSON.stringify(key)})`);
  const ta=doc.getElementById('msg-input');
  const shown={inputOff:ta.disabled,hint:doc.getElementById('msg-hint').textContent};
  ta.value=body; W.eval('updateMsgComposer()');
  shown.buttonOff=doc.getElementById('msg-send-btn').disabled;
  await W.eval('sendMessage()'); await wait(30);
  shown.sent=S.DB.game_messages.some(m=>m.body===body&&m.from_index===0);
  return shown;
}
const can=(r,what)=>check(r.sent&&!r.inputOff&&!r.buttonOff,`${what} (${JSON.stringify(r)})`);
const cannot=(r,what,why)=>check(!r.sent&&r.inputOff&&r.buttonOff&&why.test(r.hint),`${what}, and says why (${JSON.stringify(r)})`);
const noErrors=(errs,who)=>check(!errs.length,`${who}: no page errors`+(errs.length?': '+String(errs[0]).split('\n')[0]:''));

(async()=>{
  // ── a realm still in the game ──
  for(const block of [false,true]){
    const P=await player({block});
    const sw=block?'switch on':'switch off';
    const pub=await trySend(P,'public','Grain for iron');
    can(pub,`in the game, ${sw}: sends to All Realms`);
    check(!/private/.test(pub.hint),`in the game, ${sw}: nothing said about private sending (${pub.hint})`);
    can(await trySend(P,PRIV,'Meet at the ford'),`in the game, ${sw}: sends privately`);
    noErrors(P.errs,`in the game, ${sw}`); P.W.close();
  }
  {
    const P=await player();
    const note=P.doc.querySelector('#msg-composer .mc-privacy').textContent;
    check(/conceded/.test(note)&&/extinguished/.test(note)&&/until the game is over/i.test(note)&&/All Realms/.test(note),
      `the Dispatches note gives the rule (${note})`);
    P.W.close();
  }
  // ── a realm that is out, while the game goes on ──
  for(const [how,me,word] of [['conceded',{conceded:true},/conceded/],['extinguished',{eliminated:true},/extinguished/]]){
    {
      const P=await player({me});
      cannot(await trySend(P,PRIV,'Strike Veyholt now'),`${how}, switch off: can't send privately`,new RegExp(word.source+'[^]*private[^]*until the game is over'));
      const pub=await trySend(P,'public','Farewell, all');
      can(pub,`${how}, switch off: still writes to All Realms`);
      check(/no private dispatches until the game is over/.test(pub.hint),`${how}, switch off: and the public channel says private sending is off (${pub.hint})`);
      noErrors(P.errs,`${how}, switch off`); P.W.close();
    }
    {
      const P=await player({me,block:true});
      cannot(await trySend(P,'public','Farewell, all'),`${how}, switch on: can't write to All Realms`,new RegExp(word.source+'[^]*GM has blocked'));
      cannot(await trySend(P,PRIV,'Strike Veyholt now'),`${how}, switch on: can't send privately`,new RegExp(word.source+'[^]*GM has blocked'));
      P.W.close();
    }
  }
  // ── the game is over ──
  for(const me of [{conceded:true},{eliminated:true}]){
    const P=await player({me,block:true,status:'complete'});
    const how=me.conceded?'has conceded':'is extinguished';
    can(await trySend(P,PRIV,'Well played'),`game over: a realm that ${how} sends privately again`);
    can(await trySend(P,'public','Good game, all'),`game over: and to All Realms, switch on or not`);
    P.W.close();
  }
  {
    const P=await player({them:{conceded:true}});
    cannot(await trySend(P,PRIV,'Are you there?'),'while the game goes on, no one writes privately to a realm that has left (as before)',/left the game/);
    P.W.close();
    const Q=await player({them:{conceded:true},status:'complete'});
    can(await trySend(Q,PRIV,'Well fought'),'game over: a realm still standing writes privately to one that conceded');
    Q.W.close();
  }

  // ── the GM's switch ──
  const box=doc=>doc.getElementById('detail-block-eliminated');
  const flip=async(W,doc,on)=>{ const b=box(doc); b.checked=on; b.dispatchEvent(new W.Event('change',{bubbles:true})); await wait(100); };
  {
    const S=world();
    const {W,doc,errs}=await boot(S,'kingdoms-call-gm-portal.html','gm1');
    await W.eval(`openGame('G1')`); await wait(200);
    const b=box(doc), label=b&&b.closest('label');
    check(!!b&&!b.checked&&!!label&&/Block eliminated realms from sending dispatches/.test(label.textContent),
      'the game screen has the switch "Block eliminated realms from sending dispatches", off');
    if(b){ await flip(W,doc,true); }
    check(S.DB.games[0].block_eliminated_msgs===true,`turning it on saves the game's setting (${S.DB.games[0].block_eliminated_msgs})`);
    check(S.DB.games[1].block_eliminated_msgs===false,'and no other game\'s');
    noErrors(errs,'GM'); W.close();
    const R=await boot(S,'kingdoms-call-gm-portal.html','gm1');
    await R.W.eval(`openGame('G1')`); await wait(200);
    check(!!box(R.doc)&&box(R.doc).checked,'opened again, the switch shows on');
    if(box(R.doc)) await flip(R.W,R.doc,false);
    check(S.DB.games[0].block_eliminated_msgs===false,'turning it off saves that too');
    R.W.close();
  }
  {
    const S=world();
    const {W,doc,errs}=await boot(S,'kingdoms-call-gm-portal.html','ov1');
    await W.eval(`openGame('G2')`); await wait(200);
    if(box(doc)) await flip(W,doc,true);
    check(S.DB.games[1].block_eliminated_msgs===true,`the Overlord, in Master GM mode, sets it on another GM's game (${S.DB.games[1].block_eliminated_msgs})`);
    noErrors(errs,'Overlord'); W.close();
  }
  process.exit(fails?1:0);
})().catch(e=>{ console.error('HARNESS',e); process.exit(2); });
