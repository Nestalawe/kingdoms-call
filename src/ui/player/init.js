// ── PLAYER-TO-PLAYER DISPATCHES (compose) — RETIRED 2026-09-27 (Toby item 4) ────
// This was the turn-bound composer at the head of the Orders column: you queued up to one message
// per recipient per turn and the GM engine delivered it into their next report. The ✉ Dispatches
// tab replaces it outright — real threads, sent and read at once, no waiting for a turn to resolve.
// The composer UI is gone from the orders form.
//
// What is deliberately KEPT:
//  · `collectMessages()` still exists and now always returns [], so the submit payload shape is
//    unchanged and an older GM build reading `orders.messages` still parses it.
//  · The engine's delivery code and the Chronicle's "Dispatches" section are untouched, so dispatch
//    lines already written into past turn reports still render when a player browses their history.
// To restore the old composer, put the `<div id="dispatch-compose"></div>` back in _realmTop and
// re-add the render/sync helpers — nothing else was removed.
function collectMessages(){ return []; }
let currentGamePlayerId = null; // last game_player row opened — lets UI actions re-render the report
// The report currently shown on the map (current turn, or a past-turn snapshot when browsing
// history)
let viewingReport = null;
// Which past turn the player is currently viewing (null = the current/latest turn). See
// refreshTurnNavHighlight().
let viewedTurn = null;
// Restyle the turn-nav buttons: the current turn is full crimson; the past turn currently being
// viewed (if any) is a LIGHTER crimson; all others are the plain outlined style. Buttons carry
// their turn number in data-turn and the navigator stores the resolved turn in data-resolved, so
// this can be re-run on its own whenever the viewed turn changes without rebuilding the buttons.
// ── TURN NUMBERING, PLAYER-FACING (2026-09-27, Toby) ──────────────────────────────────────────
// ONE number everywhere: the turn the realm is living through — games.turn. That is what the GM
// portal, the player's game list, the turn-mode/deadline line and the Orders card all show.
// The report header used to name the most recent RESOLVED turn instead (games.turn − 1), and the
// history buttons were numbered the same way, so a realm on Turn 13 read "Turn 12" in exactly
// those two places and 13 everywhere else. Both now read the live turn.
// The per-turn snapshots in turn_logs are still KEYED by the resolved turn (turn_logs.turn =
// games.turn − 1 at the moment the row was written). That key lives in the database and is NOT
// renumbered — snapshotTurnLabel() converts it to the turn the player knew it as: the report
// written when turn N finished is the briefing acted on during turn N+1, and the founding
// snapshot (key 0) is the Turn 1 briefing.
function snapshotTurnLabel(key){ return (parseInt(key)||0)+1; }
function refreshTurnNavHighlight(){
  const navEl=document.getElementById('turn-nav-btns');
  if(!navEl) return;
  const resolved=parseInt(navEl.dataset.resolved??'-1');
  [...navEl.children].forEach(btn=>{
    const d=parseInt(btn.dataset.turn);
    const isCurrent=d===resolved;
    const isViewed=(viewedTurn!=null)&&(d===viewedTurn)&&!isCurrent;
    let bg='transparent',border='var(--stone)',color='var(--stone)';
    if(isCurrent){ bg='var(--crimson)'; border='var(--crimson)'; color='#fff'; }
    else if(isViewed){ bg='#b34a4a'; border='var(--crimson)'; color='#fff'; } // lighter crimson = the turn on screen
    btn.style.cssText=`font-size:.68rem;padding:2px 8px;border:1px solid ${border};background:${bg};color:${color};cursor:pointer;border-radius:2px`;
  });
}

// ── INIT ────
async function init(){
  try{
    document.getElementById('spinner').style.display='none';
    const {data:{session},error} = await sb.auth.getSession();
    if(error) throw error;
    if(session){ currentUser=session.user; await onSignedIn(); }
    else show('sec-auth');
  } catch(e){
    document.getElementById('spinner').style.display='block';
    document.getElementById('spinner').textContent='Connection error: '+e.message+'. Check your internet connection and refresh.';
    console.error('Init failed:',e);
  }
}

// scroll the report column to one of its main sections, keeping the target heading clear of the
// sticky jump-bar. On desktop the middle column is its own scroll container; on a phone
// (single-column view) the page scrolls, so fall back to scrollIntoView there.
function jumpToReportSection(id){
  const tgt=document.getElementById(id); if(!tgt) return;
  if(tgt.style.display==='none') return;
  const col=document.getElementById('rp-report-col');
  const bar=document.getElementById('report-jumpbar');
  const barH=bar?bar.offsetHeight:0;
  if(col && col.scrollHeight>col.clientHeight && getComputedStyle(col).overflowY!=='visible'){
    const top=col.scrollTop+tgt.getBoundingClientRect().top-col.getBoundingClientRect().top-barH;
    col.scrollTo({top:Math.max(0,top),behavior:'smooth'});
  } else {
    tgt.style.scrollMarginTop=barH+'px';
    tgt.scrollIntoView({behavior:'smooth',block:'start'});
  }
}
function show(id){
  try{ _closeMapTip(); }catch(e){} // dismiss any province popup when leaving/entering a section
  // leaving the report drops the "#game=…" address, so a refresh from any other screen does not
  // bounce back into a report.
  if(id!=='sec-report'&&/^#game=/.test(location.hash||'')){ try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){} }
  if(id!=='sec-report'){ try{ stopMessagePolling(); saveMessageReads(); }catch(e){} } // no dispatch poll off the report screen
  document.querySelectorAll('section').forEach(s=>s.classList.remove('section-active'));
  document.getElementById(id)?.classList.add('section-active');
  // On a phone, default the report screen to the Report view the first time it's shown.
  if(id==='sec-report'){ ensureMobileDefault(); if(window.innerWidth<821) teardownDeskLayout(); else setupDeskLayout(); }
}

