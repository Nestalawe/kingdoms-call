// ════════════════════════════════════════════════════════════════════════════════════════════════════
// DISPATCHES — realm-to-realm messaging (2026-09-27, Toby)
// ════════════════════════════════════════════════════════════════════════════════════════════════════
// This is the column that replaced the left desktop panel's duplicate Report tab. What it is, and
// what it deliberately is not:
//
//  * It is NOT part of the turn report. A dispatch is written straight to public.game_messages and
//    read back by a short poll, so it arrives within seconds — no waiting for the GM to resolve the
//    turn — and it stays in that table for the life of the game, so nothing is lost between turns.
//  * Scope is ONE GAME. Every row carries game_id, and the channel list is built from that game's
//    realms only. There is no cross-game inbox.
//  * WHO you may write to: any realm you have MET — report.diplomacy.known, the same encountered
//    list the Diplomacy card renders — that is played by a HUMAN, singly or in any combination. Plus
//    one public channel that every realm in the game reads, met or not.
//  * Bots are left OUT of the roster: a bot cannot read a dispatch, so offering it would be a message
//    into the void. A bot row is the only game_players row with a null user_id (the GM portal's
//    isBotRow relies on exactly that), which is how they are told apart here without having to ship a
//    bot flag down in the turn report.
//  * A game with ONE human realm (solo against bots) gets no messaging at all — the tab is never
//    shown, on either the desktop panel or the phone tab bar.
//
// CHANNELS. A channel key is derived from the message itself, so both ends compute the same key:
//     public                        → 'public'
//     private, participants a,b,…   → 'p:' + the sorted unique realm indices, dash-joined, SENDER
//                                     INCLUDED.
// A two-realm conversation is therefore one channel whichever side writes into it, and a dispatch
// addressed to two realms at once becomes its own conference thread rather than landing separately in
// two 1:1 threads.
//
// UNREAD. game_message_reads holds one row per (game, realm) carrying a {channelKey: lastMessageId}
// map. Message IDS are compared, never timestamps, so a clock skew between two players' browsers
// cannot silently mark a dispatch as read.
//
// SECURITY. Forging a sender is prevented by the TABLE, not by this code: the insert policy requires
// from_index to be the realm the signed-in account actually holds in that game, and from_user_id to
// be auth.uid(). The "must have met them" rule, by contrast, is enforced only in this UI — a
// determined player could address an unmet realm straight through the API. That leaks nothing (they
// still cannot READ anything not addressed to them) and is recorded in DEV_LOG as a known limit.
const KC_MSG_TABLE='game_messages';
const KC_MSG_READS='game_message_reads';
const MSG_POLL_MS=8000;      // tick length while the Dispatches view is open
const MSG_SLOW_EVERY=4;      // … and one tick in four when it is not (≈32s, for the unread badge)
const MSG_MAX_LEN=500;   // the database refuses longer (P0-23, ruling D-05)
const MSG_PAGE=400;          // most recent dispatches loaded on entry; later ones arrive by id, and
                             // anything older is fetched a page at a time by loadOlderMessages()
let _msgGameId=null, _msgMyIndex=null, _msgMyName='', _msgMyColor=null;
let _msgRows=[], _msgIds=new Set(), _msgMaxId=0, _msgMinId=0, _msgMoreOlder=false, _msgLoadingOlder=false;
let _msgReported=new Set();   // ids of dispatches this player has reported (P0-24), as strings
let _msgReads={};            // channelKey -> highest message id this realm has seen
let _msgRealms={};           // realm index -> {index,name,color,human,met,conceded,eliminated}
let _msgChannel='public';
let _msgExtraGroups=[];      // conference channels opened this session that carry no messages yet
let _msgTimer=null, _msgTick=0, _msgBusy=false, _msgSending=false;
let _msgTableOk=null;        // null = not probed, false = the SQL has not been run
let _msgErr=null, _msgReadsDirty=false, _msgReadSaveTimer=null;
// R-075 (P0-25): what this realm may send. _msgOut: null, 'conceded' or 'eliminated' (its dynasty extinguished), from
// its own turn report. _msgGameOver: the game has ended. _msgBlockOut: the GM's switch (games.block_eliminated_msgs).
let _msgOut=null, _msgGameOver=false, _msgBlockOut=false;

function _msgNum(v){ const n=Number(v); return Number.isFinite(n)?n:null; }
function _msgArr(v){ return Array.isArray(v)?v:[]; }

// ── channel keys ──
function msgChannelKeyOf(row){
  if(!row) return 'public';
  if(row.scope==='public'||!_msgArr(row.to_indexes).length) return 'public';
  return msgGroupKey([_msgNum(row.from_index), ..._msgArr(row.to_indexes).map(_msgNum)]);
}
// Sorted, de-duplicated, numeric — the ONE place a key is spelled, so the sender's key and the
// recipient's key cannot drift apart.
function msgGroupKey(indices){
  const set=[...new Set(_msgArr(indices).map(_msgNum).filter(i=>i!=null))].sort((a,b)=>a-b);
  return 'p:'+set.join('-');
}
function msgParticipantsOf(key){
  if(!key||key==='public') return [];
  return String(key).slice(2).split('-').map(_msgNum).filter(i=>i!=null);
}
function msgRealmName(i){ const r=_msgRealms[i]; return (r&&r.name)||('Realm '+((_msgNum(i)||0)+1)); }
function msgRealmColour(i){
  const r=_msgRealms[i];
  const hex=(r&&r.color)||null;
  if(!hex) return '#c9b189';
  // The thread sits on a very dark ground, so a realm colour is lifted for contrast the same way the
  // map tooltip lifts its symbols — hue kept, lightness raised only as far as it must be.
  try{ return _tintForDarkTooltip?_tintForDarkTooltip(hex):hex; }catch(e){ return hex; }
}

// ── ROSTER ── who is in this game, who is human, and whom this realm has met.
async function loadMessageRoster(gameId, report){
  const known={};
  _msgArr(report&&report.diplomacy&&report.diplomacy.known).forEach(k=>{
    const i=_msgNum(k&&k.index); if(i==null) return;
    known[i]={index:i,name:k.name||('Realm '+(i+1)),color:k.color||null,alignment:k.alignment||null,
              conceded:!!k.conceded,eliminated:!!k.eliminated,relation:k.relation||'neutral'};
  });
  // Which slots are human comes from get_game_slots (P0-20): it never gives names, so a met realm is named
  // from the report (or "Realm N").
  let humans=new Set(), total=0;
  try{
    const {data:slots,error}=await fetchGameSlots([gameId]);
    if(error) throw error;
    _msgArr(slots).forEach(s=>{
      const i=_msgNum(s.player_index); if(i==null) return;
      total++;
      if(!s.is_bot) humans.add(i);
    });
  }catch(e){ _msgErr='Could not read the realm roster: '+(e&&e.message||e); }
  _msgRealms={};
  Object.values(known).forEach(k=>{ _msgRealms[k.index]={...k,human:humans.has(k.index),met:true}; });
  // My own realm, for the "you" label on my dispatches.
  if(_msgMyIndex!=null) _msgRealms[_msgMyIndex]={index:_msgMyIndex,name:_msgMyName||msgRealmName(_msgMyIndex),
    color:_msgMyColor,human:true,met:true,conceded:false,eliminated:false,mine:true};
  // Messaging exists only where there is someone to message: two or more HUMAN realms in the game.
  _msgEnabled=humans.size>=2;
  return {humans:humans.size,total};
}
// The realms this player may address privately: met, human, and not themselves.
function msgContacts(){
  return Object.values(_msgRealms)
    .filter(r=>r&&r.met&&r.human&&r.index!==_msgMyIndex)
    .sort((a,b)=>a.index-b.index);
}
function msgChannelIsSendable(key){ return msgChannelOpen(key)&&!msgOutReason(key); }
function msgChannelOpen(key){
  if(key==='public') return true;
  const others=msgParticipantsOf(key).filter(i=>i!==_msgMyIndex);
  if(!others.length) return false;
  // Every addressee gone from the game → nothing to send to. One still standing is enough. Once the game is over,
  // every realm may write privately again (R-075), to a realm that left as much as from one.
  return others.some(i=>{ const r=_msgRealms[i]; return r&&r.human&&(_msgGameOver||(!r.conceded&&!r.eliminated)); });
}
// R-075 (P0-25): until the game is over, a realm that has conceded or been extinguished sends no private dispatches,
// and none at all while the GM's switch is on. Returns the reason the composer shows, or null when it may send.
// Enforced on this screen only: the database can't yet tell who is out (that lives in the world), until P2-04.
function msgOutReason(key){
  if(!_msgOut||_msgGameOver) return null;
  if(_msgBlockOut) return msgOutWho()+', and your GM has blocked conceded and extinguished realms from sending any dispatches until the game is over.';
  if(key!=='public') return msgOutPrivateOff()+' You can still write to 📣 All Realms.';
  return null;
}
function msgOutWho(){ return _msgOut==='eliminated'?'Your dynasty is extinguished':'Your realm has conceded'; }
// Said on the public channel too, so a realm that is out knows before it looks for a private one.
function msgOutPrivateOff(){ return (_msgOut&&!_msgGameOver)?msgOutWho()+', so you send no private dispatches until the game is over.':''; }
function msgChannelLabel(key){
  if(key==='public') return '📣 All Realms';
  const others=msgParticipantsOf(key).filter(i=>i!==_msgMyIndex);
  if(!others.length) return 'Private note';
  if(others.length===1) return msgRealmName(others[0]);
  return others.map(i=>msgRealmName(i)).join(' + ');
}

// ── ENTRY POINT ── called by openReport once the report is in hand.
async function initMessaging(gameId, myIndex, report, game){
  const same=(String(_msgGameId)===String(gameId) && _msgMyIndex===_msgNum(myIndex));
  _msgGameId=gameId!=null?String(gameId):null;
  _msgMyIndex=_msgNum(myIndex);
  _msgMyName=(report&&report.playerName)||'';
  _msgMyColor=(report&&report.kingdom&&report.kingdom.color)||null;
  { const k=(report&&report.kingdom)||{};
    _msgOut=k.conceded?'conceded':k.eliminated?'eliminated':null;
    _msgGameOver=!!((game&&game.status==='complete')||(report&&report.titles&&report.titles.gameOver));
    _msgBlockOut=!!(game&&game.block_eliminated_msgs); }
  if(!same){ _msgRows=[]; _msgIds=new Set(); _msgMaxId=0; _msgMinId=0; _msgMoreOlder=false; _msgReported=new Set();
             _msgReads={}; _msgChannel='public'; _msgExtraGroups=[]; _msgErr=null; }
  await loadMessageRoster(gameId, report);
  { const h=document.getElementById('msg-col-title');   // the tab already says "Dispatches"; the column
    if(h) h.textContent='✉ Dispatches — '+(_msgMyName||'your realm'); }  // header says who is writing
  const mt=document.getElementById('mt-messages'); if(mt) mt.style.display=_msgEnabled?'':'none';
  const dt=document.getElementById('desk-msg-tab'); if(dt) dt.style.display=_msgEnabled?'':'none';
  try{ applyDeskViews(); }catch(e){}
  if(!_msgEnabled){ stopMessagePolling(); updateMsgBadges(); return; }
  if(_msgTableOk===null) await probeMessagesTable();
  if(!same) await loadMessageReads();
  _msgBindChannelClicks(); _msgBindComposerKeys();
  renderMessageChannels(); renderMessageThread();
  await loadMyReports();                       // which dispatches this player has reported (P0-24)
  await refreshMessages(true);
  startMessagePolling();
}
async function probeMessagesTable(){
  try{
    const {error}=await sb.from(KC_MSG_TABLE).select('id').limit(1);
    _msgTableOk=!error;
    if(error) _msgErr=error.message;
  }catch(e){ _msgTableOk=false; _msgErr=String(e&&e.message||e); }
  return _msgTableOk;
}
async function loadMessageReads(){
  if(!_msgGameId||_msgMyIndex==null) return;
  try{
    const {data,error}=await sb.from(KC_MSG_READS).select('reads')
      .eq('game_id',_msgGameId).eq('player_index',_msgMyIndex).maybeSingle();
    if(error) throw error;
    const r=data&&data.reads;
    _msgReads=(r&&typeof r==='object'&&!Array.isArray(r))?{...r}:{};
  }catch(e){ _msgReads={}; }   // no row yet, or the table is missing — everything reads as unread
}
function queueMessageReadSave(){
  _msgReadsDirty=true;
  if(_msgReadSaveTimer) return;
  _msgReadSaveTimer=setTimeout(()=>{ _msgReadSaveTimer=null; saveMessageReads(); }, 1200);
}
async function saveMessageReads(){
  if(!_msgReadsDirty||!_msgGameId||_msgMyIndex==null||!currentUser) return;
  _msgReadsDirty=false;
  try{
    await sb.from(KC_MSG_READS).upsert({
      game_id:_msgGameId, player_index:_msgMyIndex, user_id:currentUser.id,
      reads:_msgReads, updated_at:new Date().toISOString()
    },{onConflict:'game_id,player_index'});
  }catch(e){ /* read marks are a convenience; a failure only means a badge lingers */ }
}

// ── POLLING ── one timer. Every tick while the view is open; one tick in four otherwise, which keeps
// the unread badge live without a request every 8 seconds for a panel nobody is looking at.
function startMessagePolling(){
  if(_msgTimer) return;
  _msgTimer=setInterval(()=>{
    _msgTick++;
    if(document.hidden) return;
    if(!_msgEnabled||!_msgGameId) return;
    if(_activeSectionId()!=='sec-report') return;
    if(!_msgViewVisible() && (_msgTick%MSG_SLOW_EVERY)!==0) return;
    refreshMessages(false);
  }, MSG_POLL_MS);
}
// 2026-10-09 (Toby item 2): the unread count on the ✉ Dispatches tab. Off the Dispatches view the poll
// runs only one tick in four (≈32s), so a dispatch that arrived while the player read the report or
// the map could take half a minute to show — long enough to look like no count at all. Any switch of
// view, and coming back to the browser tab, now asks for new dispatches at once (one small query for
// ids above the newest held). try/catch: a view switch can run before the tail of the script has
// declared the messaging state (see _msgEnabled above).
function refreshMsgBadgeSoon(){
  try{ if(_msgEnabled&&_msgGameId&&_activeSectionId()==='sec-report') refreshMessages(false); }catch(e){}
}
function stopMessagePolling(){ if(_msgTimer){ clearInterval(_msgTimer); _msgTimer=null; } }
function _msgViewVisible(){
  if(_activeSectionId()!=='sec-report') return false;
  const lay=document.getElementById('rp-layout'); if(!lay) return false;
  if(lay.classList.contains('desk')) return _deskLeftView==='messages';
  return lay.classList.contains('mv-messages');
}

// ── FETCH ── first call pulls the most recent MSG_PAGE rows; every later call asks only for ids above
// the highest already held, so a long game does not re-download its whole correspondence each tick.
async function refreshMessages(force){
  if(!_msgEnabled||!_msgGameId) return;
  if(_msgBusy&&!force) return;
  if(_msgTableOk===null) await probeMessagesTable();
  if(!_msgTableOk){ renderMessageThread(); return; }
  _msgBusy=true;
  try{
    const cols='id,turn,from_index,to_indexes,scope,body,created_at';
    let q=sb.from(KC_MSG_TABLE).select(cols).eq('game_id',_msgGameId);
    q=(_msgMaxId>0)
      ? q.gt('id',_msgMaxId).order('id',{ascending:true}).limit(MSG_PAGE)
      : q.order('id',{ascending:false}).limit(MSG_PAGE);
    const {data,error}=await q;
    if(error) throw error;
    let rows=_msgArr(data);
    const wasFirst=(_msgMaxId<=0);
    if(wasFirst){ rows=rows.slice().reverse(); _msgMoreOlder=rows.length>=MSG_PAGE; } // newest-first page → chronological
    const added=_msgAbsorb(rows);
    _msgErr=null;
    if(added||force){ renderMessageChannels(); renderMessageThread(); }
    updateMsgBadges();
  }catch(e){
    _msgErr=String(e&&e.message||e);
    renderMessageThread();
  }finally{ _msgBusy=false; }
}

// Fold a fetched page into the held rows, ignoring anything already there (a poll and a manual refresh
// can overlap). Returns how many were new, and keeps the id watermarks in step.
function _msgAbsorb(rows){
  let added=0;
  _msgArr(rows).forEach(r=>{
    const id=_msgNum(r&&r.id); if(id==null||_msgIds.has(id)) return;
    _msgIds.add(id); _msgRows.push(r); added++;
    if(id>_msgMaxId) _msgMaxId=id;
    if(_msgMinId===0||id<_msgMinId) _msgMinId=id;
  });
  if(added) _msgRows.sort((a,b)=>_msgNum(a.id)-_msgNum(b.id));
  return added;
}
// A game that has run to hundreds of dispatches loads only its most recent page on entry; this walks
// back through the rest one page at a time, so nothing written is ever out of reach.
async function loadOlderMessages(){
  if(_msgLoadingOlder||!_msgMoreOlder||!_msgGameId||_msgMinId<=0) return;
  _msgLoadingOlder=true; renderMessageThread();
  try{
    const {data,error}=await sb.from(KC_MSG_TABLE)
      .select('id,turn,from_index,to_indexes,scope,body,created_at')
      .eq('game_id',_msgGameId).lt('id',_msgMinId).order('id',{ascending:false}).limit(MSG_PAGE);
    if(error) throw error;
    const page=_msgArr(data);
    _msgMoreOlder=page.length>=MSG_PAGE;
    _msgAbsorb(page.slice().reverse());
  }catch(e){ _msgErr=String(e&&e.message||e); }
  finally{ _msgLoadingOlder=false; renderMessageChannels(); renderMessageThread(); }
}

// ── UNREAD ──
function msgRowsOf(key){ return _msgRows.filter(r=>msgChannelKeyOf(r)===key); }
function msgUnreadIn(key){
  const seen=_msgNum(_msgReads[key])||0;
  return msgRowsOf(key).filter(r=>(_msgNum(r.id)||0)>seen && _msgNum(r.from_index)!==_msgMyIndex).length;
}
function msgUnreadTotal(){ return msgChannelKeys().reduce((n,k)=>n+msgUnreadIn(k),0); }
function markChannelRead(key){
  const rows=msgRowsOf(key); if(!rows.length) return;
  const top=rows.reduce((m,r)=>Math.max(m,_msgNum(r.id)||0),0);
  if((_msgNum(_msgReads[key])||0)>=top) return;
  _msgReads[key]=top; queueMessageReadSave(); updateMsgBadges(); renderMessageChannels();
}
function updateMsgBadges(){
  const n=_msgEnabled?msgUnreadTotal():0;
  const txt=n?(n>99?'99+':String(n)):'';
  ['desk-msg-badge','mt-msg-badge'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    el.className=txt?'msg-tabbadge':'';
    el.textContent=txt;
  });
}

// ── CHANNEL LIST ── public, then every met human realm (whether or not it has been written to yet),
// then any conference thread that exists in the history or was opened this session.
function msgChannelKeys(){
  const keys=['public'];
  msgContacts().forEach(r=>{ const k=msgGroupKey([_msgMyIndex,r.index]); if(!keys.includes(k)) keys.push(k); });
  const groups=new Set();
  _msgRows.forEach(r=>{ const k=msgChannelKeyOf(r); if(k!=='public'&&!keys.includes(k)) groups.add(k); });
  _msgExtraGroups.forEach(k=>{ if(k!=='public'&&!keys.includes(k)) groups.add(k); });
  return keys.concat([...groups].sort());
}
function setMsgChannel(key){
  _msgChannel=key||'public';
  renderMessageChannels(); renderMessageThread();
  if(_msgViewVisible()) markChannelRead(_msgChannel);
  const ta=document.getElementById('msg-input'); if(ta) try{ ta.focus(); }catch(e){}
}
function renderMessageChannels(){
  const el=document.getElementById('msg-channels'); if(!el) return;
  const keys=msgChannelKeys();
  if(!keys.includes(_msgChannel)) _msgChannel='public';
  el.innerHTML=kcHtml`${keys.map(k=>{
    const others=msgParticipantsOf(k).filter(i=>i!==_msgMyIndex);
    const gone=k!=='public'&&!msgChannelIsSendable(k);
    const dot=(k==='public')
      ? kcHtml`<span class="mc-dot" style="background:#7d5fb5"></span>`
      : (others.length===1?kcHtml`<span class="mc-dot" style="background:${msgRealmColour(others[0])}"></span>`
                          :kcHtml`<span class="mc-dot" style="background:linear-gradient(90deg,${others.slice(0,3).map(i=>msgRealmColour(i)).join(',')})"></span>`);
    const u=msgUnreadIn(k);
    return kcHtml`<button type="button" class="msg-chan${k===_msgChannel?' active':''}${gone?' gone':''}" data-ch="${k}" title="${msgChannelLabel(k)}${gone?' — no longer in the game':''}">${
      dot}<span class="mc-label">${msgChannelLabel(k)}</span>${
      u?kcHtml`<span class="mc-unread">${u>99?'99+':u}</span>`:''}</button>`;
  })}`;
  updateMsgComposer();
}
// One delegated listener rather than an inline onclick per chip: a channel key would otherwise have to
// survive being written into an HTML attribute and read back as JavaScript.
function _msgBindChannelClicks(){
  const el=document.getElementById('msg-channels'); if(!el||el._bound) return;
  el._bound=true;
  el.addEventListener('click',ev=>{
    const b=ev.target&&ev.target.closest?ev.target.closest('.msg-chan'):null;
    if(b&&b.dataset&&b.dataset.ch) setMsgChannel(b.dataset.ch);
  });
}

// ── THREAD ──
function _msgWhen(iso){
  const d=new Date(iso); if(isNaN(d)) return '';
  return d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}
function _msgDay(iso){
  const d=new Date(iso); if(isNaN(d)) return '';
  return d.toLocaleDateString([], {weekday:'short',day:'numeric',month:'short'});
}
function renderMessageThread(){
  const el=document.getElementById('msg-thread'); if(!el) return;
  if(!_msgEnabled){ el.innerHTML='<div class="msg-empty">This game has only one human realm, so there is no one to send dispatches to.</div>'; return; }
  if(_msgTableOk===false){
    el.innerHTML=kcHtml`<div class="msg-empty">Dispatches are not switched on for this server yet — the <strong>game_messages</strong> table is missing. Ask your GM to run the messaging SQL shown on their portal.${
      _msgErr?kcHtml`<br><span style="font-size:.72rem;opacity:.7">${_msgErr}</span>`:''}</div>`;
    updateMsgComposer(); return;
  }
  // Keep the thread pinned to the foot when it already was — a dispatch arriving mid-read must not
  // yank the view, but the normal case is "show me the newest".
  const atBottom=(el.scrollHeight-el.scrollTop-el.clientHeight)<60;
  const rows=msgRowsOf(_msgChannel);
  const older=_msgMoreOlder
    ? kcHtml`<button type="button" class="msg-chan" style="align-self:center" onclick="loadOlderMessages()"${_msgLoadingOlder?kcHtml` disabled`:''}>${
      _msgLoadingOlder?'Loading…':'↑ Earlier dispatches'}</button>`
    : '';
  if(!rows.length){
    const who=_msgChannel==='public'?'every realm in the game':msgChannelLabel(_msgChannel);
    el.innerHTML=kcHtml`${older}<div class="msg-empty">No dispatches here yet.<br>Anything you write goes to <strong>${who}</strong>.</div>`;
    updateMsgComposer(); return;
  }
  const seen=_msgNum(_msgReads[_msgChannel])||0;
  let lastDay=null; const html=[older];
  rows.forEach(r=>{
    const day=_msgDay(r.created_at);
    if(day&&day!==lastDay){ lastDay=day; html.push(kcHtml`<div class="msg-day">${day}</div>`); }
    const from=_msgNum(r.from_index);
    const mine=from===_msgMyIndex;
    const pub=(r.scope==='public'||!_msgArr(r.to_indexes).length);
    const others=_msgArr(r.to_indexes).map(_msgNum).filter(i=>i!=null&&i!==from);
    const showTo=pub?'to all realms':(others.length>1?('to '+others.map(i=>msgRealmName(i)).join(', ')):'');
    const fresh=!mine&&(_msgNum(r.id)||0)>seen;
    const meta=[
      kcHtml`<span class="msg-from" style="color:${msgRealmColour(from)}">${mine?(msgRealmName(from)+' (you)'):msgRealmName(from)}</span>`,
      showTo?kcHtml`<span class="msg-to">${showTo}</span>`:'',
      kcHtml`<span class="msg-when">${r.turn!=null?('T'+r.turn+' · '):''}${_msgWhen(r.created_at)}</span>`,
      fresh?kcHtml`<span class="mc-unread" title="New since you last read this thread">new</span>`:'',
      mine?'':_msgReported.has(String(r.id))?kcHtml`<span class="msg-reported" title="Your GM (or the Overlord) can see this dispatch">⚑ Reported</span>`
        :kcHtml`<button type="button" class="msg-report" title="Show this dispatch to your GM" onclick="reportMessage(${kcArg(_msgNum(r.id)||0)})">⚑ Report</button>`];
    html.push(kcHtml`<div class="msg-bubble${mine?' mine':''}${pub&&!mine?' pub':''}"><div class="msg-meta">${meta}</div>${r.body}</div>`);
  });
  el.innerHTML=kcHtml`${html}`;
  if(atBottom) el.scrollTop=el.scrollHeight;
  updateMsgComposer();
}
function onMessagesShown(){
  _msgBindChannelClicks();
  renderMessageChannels(); renderMessageThread();
  const el=document.getElementById('msg-thread'); if(el) el.scrollTop=el.scrollHeight;
  markChannelRead(_msgChannel);
  refreshMessages(true);
}

// ── REPORT (P0-24, rulings D-01 and D-13g) ── a player shows a dispatch they received to the game's GM, or to the
// Overlord when the GM plays in the game (gm_reported_messages decides). One report per dispatch; the player sees
// their own reports (message_reports' read rule), so a reported dispatch stays marked after a reload.
async function loadMyReports(){
  if(!_msgGameId) return;
  const {data,error}=await sb.from('message_reports').select('message_id').eq('game_id',String(_msgGameId));
  if(!error) _msgReported=new Set(_msgArr(data).map(r=>String(r.message_id)));
}
async function reportMessage(id){
  const r=_msgRows.find(x=>_msgNum(x.id)===_msgNum(id));
  if(!r||_msgMyIndex==null||_msgNum(r.from_index)===_msgMyIndex) return;
  const why=prompt('Report this dispatch?\n\nYour GM will see it, with your reason (or the Overlord will, if your GM plays in this game). The sender isn\'t told.\n\nReason (optional):','');
  if(why==null) return;
  const {error}=await sb.from('message_reports').insert({message_id:_msgNum(id),game_id:String(_msgGameId),
    reporter_index:_msgMyIndex,reason:String(why).trim().slice(0,500)||null});
  if(error&&error.code!=='23505'){ _msgErr='Report not sent: '+String(error.message||error); updateMsgComposer(); return; }
  _msgReported.add(String(id)); _msgErr=null;
  renderMessageThread();
}

// ── COMPOSER ──
function updateMsgComposer(){
  const btn=document.getElementById('msg-send-btn'), ta=document.getElementById('msg-input'),
        hint=document.getElementById('msg-hint'), note=document.getElementById('msg-note');
  if(!btn||!ta) return;
  const sendable=_msgEnabled&&_msgTableOk!==false&&msgChannelIsSendable(_msgChannel);
  const len=(ta.value||'').trim().length;
  btn.disabled=!sendable||!len||_msgSending;
  ta.disabled=!sendable;
  if(hint){
    // a realm that can't send sees why; one that can sees who will read it and how much room is left
    hint.innerHTML=!sendable
      ? kcHtml`${_msgTableOk===false?'Messaging is not active on this server.':(msgOutReason(_msgChannel)||'Every realm in this conversation has left the game.')}`
      : kcHtml`${_msgChannel==='public'
          ? kcHtml`Public — <strong>every realm in this game</strong> will read this.${msgOutPrivateOff()?' '+msgOutPrivateOff():''}`
          : 'Private to '+msgChannelLabel(_msgChannel)+'.'} <span style="opacity:.75">Ctrl+Enter sends. ${MSG_MAX_LEN-len} left.</span>`;
  }
  if(note){ note.style.display=_msgErr&&_msgTableOk!==false?'block':'none'; note.textContent=_msgErr||''; }
}
function onMsgInput(){ updateMsgComposer(); }
// Ctrl/Cmd+Enter sends; a bare Enter stays a newline, because a dispatch is usually a paragraph and
// not a chat line.
function _msgBindComposerKeys(){
  const ta=document.getElementById('msg-input'); if(!ta||ta._bound) return;
  ta._bound=true;
  ta.addEventListener('keydown',ev=>{
    if(ev.key==='Enter'&&(ev.ctrlKey||ev.metaKey)){ ev.preventDefault(); sendMessage(); }
  });
}
async function sendMessage(){
  const ta=document.getElementById('msg-input'); if(!ta) return;
  const body=(ta.value||'').trim();
  if(!body||_msgSending||!_msgEnabled||!_msgGameId||_msgMyIndex==null) return;
  if(!msgChannelIsSendable(_msgChannel)) return;
  const key=_msgChannel;
  const pub=(key==='public');
  const to=pub?[]:msgParticipantsOf(key).filter(i=>i!==_msgMyIndex);
  if(!pub&&!to.length) return;
  _msgSending=true; updateMsgComposer();
  const turn=_msgNum(currentGamePlayer&&currentGamePlayer._liveTurn)||_msgNum(currentReport&&currentReport._liveTurn);
  try{
    const {error}=await sb.from(KC_MSG_TABLE).insert({
      game_id:_msgGameId, turn:turn, from_index:_msgMyIndex,
      from_user_id:(currentUser&&currentUser.id)||null,
      to_indexes:to, scope:pub?'public':'private',
      body:body.slice(0,MSG_MAX_LEN)
    });
    if(error) throw error;
    ta.value=''; _msgErr=null;
    await refreshMessages(true);                 // straight back out of the table, so the sender sees it
    const th=document.getElementById('msg-thread'); if(th) th.scrollTop=th.scrollHeight;
    markChannelRead(key);
  }catch(e){
    // P0-23: the database's limits. Its rate refusals (10 a minute, 300 a day) are written for players, so they
    // show as they are; its length check is reworded. The dispatch stays in the box either way.
    const m=String(e&&e.message||e);
    _msgErr=(e&&e.hint==='kc_dispatch_rate')?m
      :/game_messages_body_len/.test(m)?'A dispatch can be at most '+MSG_MAX_LEN+' characters. Shorten it and send again.'
      :'Dispatch not sent: '+m;
  }finally{ _msgSending=false; updateMsgComposer(); }
}

// ── CONFERENCE PICKER ── address one private dispatch to several met realms at once.
function toggleMsgGroupPicker(force){
  const p=document.getElementById('msg-group-pick'); if(!p) return;
  const open=(force===undefined)?(p.style.display!=='block'):!!force;
  p.style.display=open?'block':'none';
  if(!open) return;
  const list=document.getElementById('msg-group-list');
  const cs=msgContacts();
  if(list) list.innerHTML=cs.length
    ? kcHtml`${cs.map(r=>kcHtml`<label><input type="checkbox" value="${r.index}"><span style="color:${msgRealmColour(r.index)}">${r.name}</span>${
        (r.conceded||r.eliminated)?kcHtml` <span style="opacity:.6;font-size:.72rem">(out)</span>`:''}</label>`)}`
    : '<span style="font-size:.76rem;color:#8a7a5c">You have not met another player\'s realm yet.</span>';
}
function createMsgGroup(){
  const list=document.getElementById('msg-group-list'); if(!list) return;
  const picked=[...list.querySelectorAll('input[type=checkbox]:checked')].map(c=>_msgNum(c.value)).filter(i=>i!=null);
  if(!picked.length) return;
  const key=msgGroupKey([_msgMyIndex,...picked]);
  if(!_msgExtraGroups.includes(key)) _msgExtraGroups.push(key);
  toggleMsgGroupPicker(false);
  setMsgChannel(key);
}
// Leaving or backgrounding the tab flushes the read marks (the save is debounced, so a pending one
// would otherwise be lost); coming back to it pulls anything that arrived meanwhile straight away
// rather than waiting out the poll.
window.addEventListener('pagehide',()=>{ try{ saveMessageReads(); }catch(e){} });
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){ try{ saveMessageReads(); }catch(e){} }
  else if(_msgEnabled&&_msgViewVisible()){ try{ refreshMessages(true); }catch(e){} }
  else refreshMsgBadgeSoon(); // the unread count on the Dispatches tab, too
});

