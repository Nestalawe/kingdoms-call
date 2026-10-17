// ── LIVE UPDATE POLLING ────
// A light background poll keeps the portal current without the player having to reload the page. It
// is deliberately NON-DESTRUCTIVE:
// • On the My Games list it simply re-renders the cards (turn number + status pills) when anything
// changes — there are no orders on that screen, so nothing can be lost.
// • While a report/orders screen is open it NEVER re-renders or navigates on its own (that would
// blank out unsaved orders). It only reveals a "new turn resolved" banner offering a manual
// Refresh, so the player decides when to reload — protecting any orders they are mid-way through.
let _pollTimer=null;
let _lastMyGamesSig=null;
const POLL_MS=20000;

function _activeSectionId(){
  const s=document.querySelector('section.section-active');
  return s?s.id:null;
}

function startUpdatePolling(){
  if(_pollTimer) return;              // never stack timers
  _pollTimer=setInterval(pollForUpdates, POLL_MS);
}

async function pollForUpdates(){
  if(!currentUser) return;
  if(document.hidden) return;         // don't poll a backgrounded tab
  try{
    // One light query: this player's slots (turn/status live on the game rows we fetch next).
    const {data:mySlots}=await sb.from('game_players').select('id,game_id,player_index,orders_submitted').eq('user_id',currentUser.id);
    if(!mySlots||!mySlots.length) return;
    const gameIds=[...new Set(mySlots.map(s=>s.game_id))];
    const {data:games}=await sb.from('games').select('id,turn,status').in('id',gameIds);
    const gById=Object.fromEntries((games||[]).map(g=>[g.id,g]));
    // rivals' submission flags feed the "N of M realms have sent orders" line, so they must be part
    // of the change signature or the tally would sit stale until the turn resolved.
    // (Exempt realms are not filtered out here — this is change-detection only; loadMyGames does the
    // real, game_state-aware tally when it repaints.)
    const {data:pollSlots}=await fetchGameSlots(gameIds);
    const _tally={};
    (pollSlots||[]).forEach(r=>{ if(r.is_bot) return; const t=_tally[r.game_id]=_tally[r.game_id]||[0,0]; t[1]++; if(r.orders_submitted) t[0]++; });

    // Signature of everything the My Games cards show — cheap change-detection.
    const active=_activeSectionId();
    // 2026-09-28 (Toby item 3): unread Dispatches are part of what the cards show, so they are part
    // of the change signature — but only counted while the list is on screen.
    const _unread=(active==='sec-games')?await fetchUnreadDispatchCounts(mySlots, pollSlots):{};
    const sig=mySlots.map(s=>{const g=gById[s.game_id]||{};const t=_tally[s.game_id]||[0,0];return `${s.id}:${g.turn||0}:${g.status||''}:${s.orders_submitted?1:0}:${t[0]}/${t[1]}:u${_unread[String(s.game_id)]||0}`;}).sort().join('|');

    if(active==='sec-games'){
      // Safe to repaint the list — no order state lives here.
      if(sig!==_lastMyGamesSig){ _lastMyGamesSig=sig; loadMyGames(); }
    } else if(active==='sec-report' && currentGamePlayer){
      // A report/orders screen is open. Do NOT touch it — just surface a notice if THIS game
      // advanced.
      const g=gById[currentGamePlayer.game_id];
      const openLiveTurn=currentGamePlayer._liveTurn||0;
      if(g && (g.turn||0)>openLiveTurn){
        const b=document.getElementById('new-turn-banner');
        if(b) b.style.display='flex';
      }
    }
    _lastMyGamesSig=sig;
  }catch(e){ /* transient network/RLS hiccup — try again next tick */ }
}

// Manual refresh from the new-turn banner. Re-opens the current report (fetches the fresh
// turn_report); the player triggered it, so replacing the current view is expected. Any draft they
// had already saved is reloaded from the server by openReport; a draft only typed but not saved is
// theirs to re-enter.
function refreshOpenReport(){
  const b=document.getElementById('new-turn-banner');
  if(b) b.style.display='none';
  if(currentGamePlayerId) openReport(currentGamePlayerId);
}

async function loadMyGames(){
  const el=document.getElementById('my-games-list');
  // Step 1: get player's own slots
  const {data:mySlots,error}=await sb.from('game_players').select('*').eq('user_id',currentUser.id);
  if(error){el.innerHTML=kcHtml`<div class="msg-error">${error.message}</div>`;return;}
  if(!mySlots||mySlots.length===0){
    el.innerHTML='<div style="color:#3a3224;font-size:.85rem;font-style:italic">You are not enrolled in any games yet. Join an open game below.</div>';
    return;
  }
  // Step 2: fetch each game separately (avoids RLS join issue). Disk-IO (2026-09-25): light columns
  // only — the cards need name / turn / status and the meta summary, never the world.
  const gameIds=mySlots.map(s=>s.game_id);
  const {data:games,error:gErr}=await fetchGamesLite(gameIds);
  if(gErr){el.innerHTML=kcHtml`<div class="msg-error">${gErr.message}</div>`;return;}
  const gamesById=Object.fromEntries((games||[]).map(g=>[g.id,g]));
  // every slot in those games, so each card can show HOW MANY realms have sent their orders. Counts
  // only — never which realms, and never what they ordered.
  const {data:allSlots}=await fetchGameSlots(gameIds);
  const slotsByGame={};
  (allSlots||[]).forEach(s=>{ (slotsByGame[s.game_id]=slotsByGame[s.game_id]||[]).push(s); });
  // 2026-09-28 (Toby item 3): unread Dispatches per game, for the ✉ badge on each card.
  const unreadByGame=await fetchUnreadDispatchCounts(mySlots, allSlots);
  const cardOf=slot=>{
    const g=gamesById[slot.game_id];
    if(!g) return kcHtml`<div class="msg-info">Game data not available yet — the GM may still be setting up.</div>`;
    const statusLabel=slot.orders_submitted?'Orders submitted':g.status==='active'?'Orders needed':g.status==='setup'?'Waiting to start':'Complete';
    const pillClass=slot.orders_submitted?'pill-blue':g.status==='active'?'pill-amber':g.status==='setup'?'pill-green':'';
    // 2026-09-27 (Toby item 1): the GM can ARCHIVE a game — it is put away, not deleted. The card
    // still opens and the whole Chronicle is still readable; the pill just says no turn is coming.
    const _arch=gameArchivedP(g)?kcHtml` <span class="pill" style="background:#e4d4b0;color:#4a3105">🗄 Archived by the GM</span>`:'';
    const tally=ordersInTextP(g,slotsByGame[slot.game_id]), deadline=turnDeadlineText(g);
    return kcHtml`<div class="game-card clickable" onclick="openGameFresh(${kcArg(String(slot.id))})"${gameArchivedP(g)?kcHtml` style="opacity:.85"`:''}>
      <div class="gc-name">${g.name} <span class="pill ${pillClass}">${statusLabel}</span>${_arch}${unreadDispatchPillP(unreadByGame[String(slot.game_id)])}</div>
      <div class="gc-meta">
        Your realm: <strong>${slot.display_name||'(joining…)'}</strong> ·
        Turn ${g.turn||0}
      </div>
      ${tally?kcHtml`<div class="gc-meta" style="margin-top:3px">${tally}</div>`:''}
      ${deadline?kcHtml`<div class="gc-meta" style="margin-top:3px">${deadline}</div>`:''}
    </div>`;
  };
  // 2026-09-28 (Toby item 2): archived games move to their own card below Open Games.
  const _liveSlots=mySlots.filter(slot=>{ const g=gamesById[slot.game_id]; return !(g&&gameArchivedP(g)); });
  const _archSlots=mySlots.filter(slot=>{ const g=gamesById[slot.game_id]; return !!(g&&gameArchivedP(g)); });
  el.innerHTML=_liveSlots.length
    ? kcHtml`${_liveSlots.map(cardOf)}`
    : '<div style="color:#3a3224;font-size:.85rem;font-style:italic">No active games — your archived games are listed further down.</div>';
  renderArchivedGamesCard(_archSlots.map(cardOf));
}
// ── ARCHIVED GAMES CARD (2026-09-28, Toby item 2) ────
// Minimised state is remembered per browser: once the player folds the card it stays folded on
// every later visit until they open it again. localStorage can be unavailable (private windows,
// blocked site data) — every access is wrapped, and the card then simply starts open.
const ARCH_CARD_KEY='kc_archived_games_min';
function archivedCardMinimised(){ try{ return localStorage.getItem(ARCH_CARD_KEY)==='1'; }catch(e){ return false; } }
function renderArchivedGamesCard(cards){
  const card=document.getElementById('archived-games-card'); if(!card) return;
  if(!cards.length){ card.style.display='none'; return; }
  card.style.display='';
  const cnt=document.getElementById('archived-games-count'); if(cnt) cnt.textContent=`(${cards.length})`;
  const list=document.getElementById('archived-games-list'); if(list) list.innerHTML=kcHtml`${cards}`;
  applyArchivedCardState();
}
function applyArchivedCardState(){
  const min=archivedCardMinimised();
  const list=document.getElementById('archived-games-list'); if(list) list.style.display=min?'none':'';
  const b=document.getElementById('archived-games-toggle');
  if(b){ b.innerHTML=min?'&#9656; show':'&#9662; minimise'; b.setAttribute('aria-expanded',min?'false':'true'); }
}
function toggleArchivedGamesCard(){
  const min=!archivedCardMinimised();
  try{ if(min) localStorage.setItem(ARCH_CARD_KEY,'1'); else localStorage.removeItem(ARCH_CARD_KEY); }catch(e){}
  applyArchivedCardState();
}
// ── UNREAD DISPATCHES ON THE GAME CARDS (2026-09-28, Toby item 3) ────
// The same rule the Dispatches panel uses (msgUnreadIn): a dispatch is unread when its id is above
// the highest id this realm has marked seen in that dispatch's channel, and it was not sent by this
// realm. Row-Level Security already limits game_messages to what this player may read (their own,
// addressed to them, or public), so no filtering on addressee is needed here. Only games with two or
// more HUMAN realms have messaging at all. Light columns only — never the message bodies. If the
// tables do not exist yet (the GM has not run the SQL) the query errors and every count is simply 0.
async function fetchUnreadDispatchCounts(mySlots, allSlots){
  const out={};
  try{
    const humans={};
    _msgArr(allSlots).forEach(s=>{ if(s&&!s.is_bot){ const k=String(s.game_id); humans[k]=(humans[k]||0)+1; } });
    const mine={};
    _msgArr(mySlots).forEach(s=>{ const k=String(s.game_id); if((humans[k]||0)>=2&&_msgNum(s.player_index)!=null) mine[k]=_msgNum(s.player_index); });
    const ids=Object.keys(mine); if(!ids.length) return out;
    const {data:rows,error}=await sb.from(KC_MSG_TABLE).select('id,game_id,from_index,to_indexes,scope').in('game_id',ids).order('id',{ascending:false}).limit(3000);
    if(error||!rows) return out;
    let reads=[];
    try{
      const r=await sb.from(KC_MSG_READS).select('game_id,player_index,reads').in('game_id',ids).eq('user_id',currentUser.id);
      if(!r.error) reads=_msgArr(r.data);
    }catch(e){}
    const seenBy={};
    reads.forEach(r=>{ const k=String(r.game_id); if(mine[k]!==_msgNum(r.player_index)) return; const m=r.reads; seenBy[k]=(m&&typeof m==='object'&&!Array.isArray(m))?m:{}; });
    rows.forEach(r=>{
      const k=String(r.game_id); if(!(k in mine)) return;
      if(_msgNum(r.from_index)===mine[k]) return;
      const ch=msgChannelKeyOf(r);
      const seen=_msgNum((seenBy[k]||{})[ch])||0;
      if((_msgNum(r.id)||0)>seen) out[k]=(out[k]||0)+1;
    });
  }catch(e){ /* a convenience only — no badge on any failure */ }
  return out;
}
function unreadDispatchPillP(n){
  if(!n) return '';
  return kcHtml` <span class="pill" style="background:#a32020;color:#fff" title="${n} unread dispatch${n!==1?'es':''} — open the game and choose ✉ Dispatches">✉ ${n>99?'99+':n} new</span>`;
}

// ── Orders-in tally ────
// Players asked to see how many rivals the turn is still waiting on. Deliberately a COUNT ONLY —
// never which realms have sent orders, and never a hint of what was ordered. Mirrors the GM
// portal's own tally (loadGames / ordersWaitingOn): bot slots (no user_id) and conceded or
// extinguished realms are exempt and appear on neither side of the fraction, so the number matches
// the GM's readiness pill.
function parseGameStateP(g){
  try{ return typeof g.game_state==='string'?JSON.parse(g.game_state):(g.game_state||{}); }catch(e){ return {}; }
}
// ── games.meta (Disk-IO fix, 2026-09-25) ────
// The GM portal writes a ~1 KB summary of each game beside its game_state: {v, turnMode,
// exempt:[player indices], …}. My Games used to pull every game's full world (hundreds of KB per
// game, on every page load) just to read the turn mode and which realms are exempt from orders;
// it now reads the summary and only falls back to the world for a row that has none.
const GAME_LITE_COLS_P='id,name,gm_user_id,status,turn,max_players,created_at,meta';
function gameMetaP(g){
  if(!g||g.meta==null) return null;
  try{ const m=typeof g.meta==='string'?JSON.parse(g.meta):g.meta; return (m&&typeof m==='object'&&m.v)?m:null; }catch(e){ return null; }
}
// ARCHIVED (2026-09-27, Toby item 1). The GM portal writes `archived` onto game_state and mirrors it
// into meta; nothing is deleted, so an archived game still opens and still shows every past turn.
function gameArchivedP(g){
  const m=gameMetaP(g);
  if(m&&m.archived!==undefined) return !!m.archived;
  return !!parseGameStateP(g).archived;
}
// Light read of games by id; if the meta column does not exist yet (the GM has not run the
// one-line migration) the query errors on the unknown column and we fall back to the full rows.
async function fetchGamesLite(ids){
  let r=await sb.from('games').select(GAME_LITE_COLS_P).in('id',ids);
  if(r.error&&/meta/i.test(r.error.message||'')) r=await sb.from('games').select('*').in('id',ids);
  return r;
}
function realmExemptFromOrdersP(G,idx){
  const pl=((G&&G.players)||[])[idx];
  if(!pl) return false;
  if(pl.conceded||pl._eliminated) return true;
  const hasProv=((pl.provinces)||[]).length>0;
  const hasChar=((G&&G.characters)||[]).some(c=>c&&c.alive&&c.player===idx);
  return !hasProv&&!hasChar;
}
function realmExemptInP(g,idx){
  const m=gameMetaP(g);
  if(m&&Array.isArray(m.exempt)) return m.exempt.includes(idx);
  return realmExemptFromOrdersP(parseGameStateP(g),idx);
}
function ordersInTextP(g,slots){
  if(!g||g.status!=='active') return '';
  const need=(slots||[]).filter(p=>p&&!p.is_bot&&!realmExemptInP(g,p.player_index));
  if(need.length===0) return '';
  const inN=need.filter(p=>p.orders_submitted).length;
  const waiting=need.length-inN;
  const head=kcHtml`📜 <strong>${inN} of ${need.length}</strong> realm${need.length!==1?'s':''} have sent orders`;
  return waiting===0
    ? kcHtml`${head} — every realm is in, so the turn can be run.`
    : kcHtml`${head} — still waiting on ${waiting} more.`;
}

// ── Turn running mode (mirror of the GM portal's turnMode; read-only here) ────
// The GM chooses manual / automatic / automatic-with-deadline. Players are shown the deadline (in
// their own local time), and the COUNT of realms whose orders are in — never which ones.
function turnModeOfGame(g){
  let gs=gameMetaP(g); if(!gs){ try{ gs=typeof g.game_state==='string'?JSON.parse(g.game_state):(g.game_state||{}); }catch(e){ gs={}; } }
  const tm=(gs&&gs.turnMode&&typeof gs.turnMode==='object')?gs.turnMode:{};
  return {mode:['manual','auto','deadline'].includes(tm.mode)?tm.mode:'manual',nextDeadlineAt:tm.nextDeadlineAt||null};
}
function fmtDeadlineP(iso){
  if(!iso) return '';
  try{ return new Date(iso).toLocaleString(undefined,{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}); }catch(e){ return String(iso); }
}
function turnDeadlineText(g){
  if(!g||g.status!=='active') return '';
  const tm=turnModeOfGame(g);
  if(tm.mode==='auto') return kcHtml`⚙️ Turn ${g.turn} resolves automatically as soon as every realm has sent its orders.`;
  if(tm.mode==='deadline'&&tm.nextDeadlineAt){
    const late=Date.now()>=new Date(tm.nextDeadlineAt).getTime();
    return kcHtml`⏱ Turn ${g.turn} deadline: <strong>${fmtDeadlineP(tm.nextDeadlineAt)}</strong> (your local time)${late?' — passed; the turn is being resolved':''}. It resolves at that time, or sooner if every realm has sent its orders. Orders not in by then hold (Defend).`;
  }
  return '';
}

async function loadOpenGames(){
  const el=document.getElementById('open-games-list');
  // Get my game IDs to exclude them
  const {data:mySlots}=await sb.from('game_players').select('game_id').eq('user_id',currentUser.id);
  const myGameIds=new Set((mySlots||[]).map(s=>s.game_id));

  // Fetch setup-status games separately (no join — avoids RLS blocking)
  const {data:games,error}=await sb.from('games').select('*').eq('status','setup');
  if(error){el.innerHTML=kcHtml`<div class="msg-error">${error.message}</div>`;return;}
  if(!games||games.length===0){
    el.innerHTML='<div style="color:#3a3224;font-size:.85rem;font-style:italic">No open games at the moment. Ask your GM to create one.</div>';
    return;
  }
  // Fetch player counts for these games
  const gameIds=games.map(g=>g.id);
  const {data:allSlots}=await fetchGameSlots(gameIds);
  const slotsByGame={};
  (allSlots||[]).forEach(s=>{
    if(!slotsByGame[s.game_id]) slotsByGame[s.game_id]=[];
    slotsByGame[s.game_id].push(s);
  });
  // fetch GM display names + parse world size for each game.
  const gmIds=[...new Set(games.map(g=>g.gm_user_id).filter(Boolean))];
  const gmNameById={};
  if(gmIds.length){
    const {data:gmProfiles}=await sb.from('profiles').select('id,name').in('id',gmIds);
    (gmProfiles||[]).forEach(pr=>{ gmNameById[pr.id]=pr.name; });
  }
  // these keys were 'small'/'medium'/'large'/'huge' — a naming from before the map ladder became
  // p2..p10, so SIZE_LABEL[cfg.mapSize] NEVER matched and every joinable game was advertised as
  // "Medium (12×8)" whatever its real size. Keyed to the real mapSize values now, and the
  // dimensions match the GM portal's sizemap (both must change together).
  const SIZE_LABEL={p2:'2 realms (8×5)',p3:'3 realms (8×7)',p4:'4 realms (9×7)',p5:'5 realms (12×7)',
    p6:'6 realms (15×7)',p7:'7 realms (16×7)',p8:'8 realms (17×8)',p9:'9 realms (16×11)',p10:'10 realms (16×11)'};
  const gameInfo=g=>{
    let cfg={}; try{ cfg=typeof g.game_state==='string'?JSON.parse(g.game_state):(g.game_state||{}); }catch(e){}
    // 2026-09-25: the GM's sea share (20–80%); games made before the setting read as the 35% default.
    const _sp=parseInt(cfg.seaPct); const seaPct=Number.isFinite(_sp)?Math.max(20,Math.min(80,_sp)):35;
    return { gm: gmNameById[g.gm_user_id]||'the Game Master', size: (SIZE_LABEL[cfg.mapSize]||'—')+', '+seaPct+'% sea' };
  };
  // Human-joinable capacity = max players minus GM bot realms (bots stay hidden from players). An
  // all-bot game has capacity 0 and never appears as joinable.
  const humanCapOf=g=>{
    let cfg={}; try{ cfg=typeof g.game_state==='string'?JSON.parse(g.game_state):(g.game_state||{}); }catch(e){}
    const maxP=g.max_players||4;
    if(cfg.allBot===true) return 0;
    const bots=Math.max(0,Math.min(parseInt(cfg.botCount)||0,maxP));
    return Math.max(0,maxP-bots);
  };

  // Visibility gate: a Private game (game_state.visibility==='private') is only visible to the
  // players in its `invited` list. Games with no `visibility` key (all pre-existing games, and
  // every game once it goes active) read as Public, so running games are unaffected. This is a
  // UI-level gate matching the existing client-side capacity filter — see note in DEV_LOG about
  // tightening with RLS later.
  const visOf=g=>{
    let cfg={}; try{ cfg=typeof g.game_state==='string'?JSON.parse(g.game_state):(g.game_state||{}); }catch(e){}
    const isPrivate=cfg.visibility==='private';
    return { private:isPrivate, invited:(isPrivate&&Array.isArray(cfg.invited))?cfg.invited:[] };
  };
  const canSee=g=>{
    const v=visOf(g);
    return !v.private || v.invited.includes(currentUser.id);
  };

  const openGames=games.filter(g=>{
    if(myGameIds.has(g.id)) return false;
    if(!canSee(g)) return false; // private game this player wasn't invited to
    const joined=(slotsByGame[g.id]||[]).filter(p=>!p.is_bot).length;
    return joined<humanCapOf(g);
  });

  if(openGames.length===0){
    el.innerHTML='<div style="color:#3a3224;font-size:.85rem;font-style:italic">No open games at the moment. Ask your GM to create one.</div>';
    return;
  }
  el.innerHTML=kcHtml`${openGames.map(g=>{
    const joined=(slotsByGame[g.id]||[]).filter(p=>!p.is_bot).length;
    const maxP=humanCapOf(g); // human-facing capacity; reserved bot slots stay hidden
    const info=gameInfo(g);
    const privBadge=visOf(g).private?kcHtml` <span class="pill pill-blue">🔒 Invited</span>`:'';
    return kcHtml`<div class="game-card clickable" onclick="showJoinGame(${kcArg(String(g.id))},${kcArg(g.name)},${kcArg(maxP)},${kcArg(joined)},${kcArg(info.gm)},${kcArg(info.size)})">
      <div class="gc-name">${g.name} <span class="pill pill-green">Open</span>${privBadge}</div>
      <div class="gc-meta">GM: <strong>${info.gm}</strong> · World: ${info.size} · ${joined}/${maxP} players joined</div>
      <div class="gc-meta" style="opacity:.7">Click to join this game</div>
    </div>`;
  })}`;
}

