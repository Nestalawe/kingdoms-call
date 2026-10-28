// The Dispatches box keeps to the database's limits (P0-23, ruling D-05). Page level (jsdom, the player portal on
// the in-memory database of lib/stub-db.js, a Dispatches channel open):
//   - a dispatch is at most 500 characters: the box stops there and counts down from 500;
//   - a dispatch the database refuses for its rate (10 a minute, 300 a day) or its length shows the reason in plain
//     words, and the text stays in the box to send later.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The Dispatches box keeps to the database's limits (P0-23, D-05): at most 500 characters, counting down from 500; a
// dispatch refused for its rate shows the database's own words, one refused for its length says "at most 500
// characters", and the text stays in the box (`INSERT_ERRORS` in the stand-in database)
const {readPage,bootJsdom}=require('./lib/boot'); const {makeStub}=require('./lib/stub-db');

let fails=0;
const check=(c,m)=>{ if(!c){ fails++; console.log('FAIL '+m); } else console.log('ok   '+m); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));

async function boot(){
  const S=makeStub();
  S.DB.profiles.push({id:'p1',name:'Test Player One'});
  S.setUser('p1');
  const errs=[];
  const dom=bootJsdom(readPage('kingdoms-call-player-portal.html'),{supabase:S.supabase,setup(w){
    w.addEventListener('error',e=>errs.push(e.error&&e.error.stack||e.message));
    w.onunhandledrejection=e=>errs.push(String(e.reason&&e.reason.stack||e.reason));
    w.console.warn=()=>{}; w.console.log=()=>{}; w.console.error=(...a)=>errs.push(a.join(' '));
  }});
  await wait(900);
  const W=dom.window;
  // a public channel open in game G1, as realm 0
  W.eval(`_msgEnabled=true; _msgTableOk=true; _msgGameId='G1'; _msgMyIndex=0; _msgChannel='public'; updateMsgComposer();`);
  return {S,W,doc:W.document,errs};
}
const send=async(W,doc,text)=>{ doc.getElementById('msg-input').value=text; await W.eval('sendMessage()'); await wait(30); };

(async()=>{
  {
    const {W,doc,errs}=await boot();
    check(doc.getElementById('msg-input').getAttribute('maxlength')==='500','the box takes at most 500 characters');
    check(/(^|\D)500 left/.test(doc.getElementById('msg-hint').textContent),'and counts down from 500');
    doc.getElementById('msg-input').value='x'.repeat(480); W.eval('updateMsgComposer()');
    check(/(^|\D)20 left/.test(doc.getElementById('msg-hint').textContent),'20 left after 480');
    check(!errs.length,'no page errors'+(errs.length?': '+errs[0].split('\n')[0]:''));
    W.close();
  }
  {
    const {S,W,doc}=await boot();
    S.INSERT_ERRORS.game_messages={code:'P0001',hint:'kc_dispatch_rate',details:null,
      message:'You\'re sending dispatches too quickly. Try again in a minute.'};
    await send(W,doc,'Peace on the river');
    const note=doc.getElementById('msg-note').textContent;
    check(note==='You\'re sending dispatches too quickly. Try again in a minute.',`too many: the database's own words, as they are (got "${note}")`);
    check(doc.getElementById('msg-input').value==='Peace on the river','and the dispatch stays in the box');
    S.INSERT_ERRORS.game_messages={code:'23514',hint:null,details:null,
      message:'new row for relation "game_messages" violates check constraint "game_messages_body_len"'};
    await send(W,doc,'Peace on the river');
    const note2=doc.getElementById('msg-note').textContent;
    check(/at most 500 characters/.test(note2)&&!/violates|constraint/.test(note2),`too long: says so in plain words (got "${note2}")`);
    W.close();
  }
  process.exit(fails?1:0);
})().catch(e=>{ console.error('HARNESS',e); process.exit(2); });
