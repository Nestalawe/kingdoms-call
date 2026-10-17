// ══ BOT PLAYERS — Phase 1: existence & identity ════
// GM-controlled bot realms. Phase 1 generates a bot's identity and persists its row; bots do NOT
// act yet (they submit no orders, so runTurn defaults their characters to Defend). A bot is marked
// by an `isBot:true` flag INSIDE its game_players.turn_report JSON — no Supabase column is required
// (an unknown insert column would be rejected). Bot rows have user_id === null.
function isBotRow(p){
  if(!p||p.user_id) return false;
  // Disk-IO (2026-09-25): the game list and the auto-turn watcher now fetch slots WITHOUT
  // turn_report (it is the biggest column in the table). On such a row the only rows with no
  // user_id are bots — commitTurn0 deletes every user_id-null row before it inserts the bots, and
  // a human's row always carries a user_id — so a missing turn_report field reads as a bot.
  if(p.turn_report===undefined) return true;
  try{ const r=typeof p.turn_report==='string'?JSON.parse(p.turn_report):p.turn_report; if(r&&r.isBot===true) return true; }catch(e){}
  return false;
}
// ════
// TURN RUNNING MODES (Sept 2026) — manual / auto / deadline. The mode lives inside game_state
// (setup cfg before Turn 0, then G.turnMode once the game is active) so no schema change is needed
// and the player portal can read it too.
// {mode:'manual'|'auto'|'deadline', time:'HH:MM', everyDays:N, nextDeadlineAt:ISO|null, turnRanAt:ISO|null}
// 'auto': the watcher in this GM tab runs the turn as soon as every non-exempt human realm has
// submitted. 'deadline': as 'auto', OR once the fixed clock deadline has passed (whichever comes
// first). The deadline is
// the first HH:MM (this computer's clock) strictly after the last run + (everyDays-1) days.
// Exempt realms (never waited on): bots, conceded realms, extinguished dynasties (_eliminated), and
// realms with neither a living character nor a province.
// ════
const TURN_MODES={manual:'Manual — GM runs each turn',auto:'Automatic — runs when all orders are in',deadline:'Automatic with deadline'};
function parseGameState(game){
  if(!game) return {};
  try{ const gs=typeof game.game_state==='string'?JSON.parse(game.game_state):game.game_state; return gs||{}; }catch(e){ return {}; }
}
function normalizeTurnMode(tm){
  tm=(tm&&typeof tm==='object')?tm:{};
  const mode=['manual','auto','deadline'].includes(tm.mode)?tm.mode:'manual';
  const time=/^\d{2}:\d{2}$/.test(tm.time||'')?tm.time:'20:00';
  const everyDays=Math.max(1,Math.min(30,parseInt(tm.everyDays)||1));
  return {mode,time,everyDays,nextDeadlineAt:tm.nextDeadlineAt||null,turnRanAt:tm.turnRanAt||null};
}
// ════
// GAME META — the light summary column (Disk-IO fix, 2026-09-25)
// ════
// Supabase warned that the project was exhausting its Disk IO budget. Measured on a 6-realm game
// after four turns: `select('*, game_players(*)')` returned ~810 KB (game_state 474 KB + six
// reports of 33–53 KB), and the auto-turn watcher issued exactly that query once a minute per open
// GM tab — ~1.1 GB a day per game, all of it TOAST reads of columns the tick never looks at. It
// only wanted the turn mode and which realms are exempt from orders; the player portal's My Games
// list wanted the same two things and pulled the whole world for them too.
// `games.meta` (jsonb, ~1 KB) now carries that summary, written by every code path that writes
// game_state: {v, turnMode, exempt:[player indices], realms, seaPct, mapSize, maxPlayers,
// botCount, allBot, botDifficulty, visibility, invited}. Readers prefer meta and fall back to
// parsing game_state, so a row that predates the column still works; backfillGameMeta stamps
// those once. The column is in the database's migrations (supabase/); if it's ever missing,
// probeGameMeta() leaves _kcHasMeta=false, no write mentions the column (an unknown column would
// fail the whole turn save) and the heavy selects are used as before, with a message on the game list.
let _kcHasMeta=false;
// The plain "missing from the database" message every probe below shows. Since P0-17 the database changes
// only through migrations, applied by the deploy before the site goes live, so there is no SQL to paste:
// seeing this means the database is behind this copy of the site.
function kcMissingMsg(title,what,effect){
  return kcHtml`<div class="msg-error"><strong>${title}</strong> — the database has no ${what}, so ${effect}. The deploy adds it to the database before the site goes live, so this copy of the site is ahead of its database: tell Theo.</div>`;
}
async function probeGameMeta(){
  try{
    const {error}=await sb.from('games').select('id,meta').limit(1);
    _kcHasMeta=!error;
    if(error) console.warn('games.meta probe:',error.message);
  }catch(e){ _kcHasMeta=false; }
  const el=document.getElementById('msg-games');
  if(el) el.innerHTML=_kcHasMeta?'':kcMissingMsg('Disk-IO fix not active',kcHtml`<code>games.meta</code> column`,'this tab is still pulling every game\'s full world and reports once a minute');
  return _kcHasMeta;
}
function gameMetaOf(game){
  if(!game||game.meta==null) return null;
  try{ const m=typeof game.meta==='string'?JSON.parse(game.meta):game.meta; return (m&&typeof m==='object'&&m.v)?m:null; }catch(e){ return null; }
}
// gs = the parsed game_state (setup cfg before Turn 0, the world G after it).
function buildGameMeta(gs){
  gs=(gs&&typeof gs==='object')?gs:{};
  const m={v:1, turnMode:normalizeTurnMode(gs.turnMode)};
  ['mapSize','maxPlayers','botCount','allBot','botDifficulty','botDiplomacy','safeStart','visibility','invited'].forEach(k=>{ if(gs[k]!==undefined) m[k]=gs[k]; });
  // ARCHIVE (2026-09-27, Toby item 1). The flag lives in game_state — the one place every writer
  // round-trips — and is copied up into meta here so the LIGHT games-list read can see it without
  // pulling the world. Because meta is rebuilt from game_state on every save, a later turn
  // resolution cannot silently drop it.
  if(gs.archived){ m.archived=true; if(gs.archivedAt) m.archivedAt=gs.archivedAt; }
  const sp=gs.seaPct!=null?gs.seaPct:(gs.world&&gs.world.seaPct!=null?gs.world.seaPct:null);
  if(sp!=null) m.seaPct=sp;
  if(Array.isArray(gs.players)){
    m.realms=gs.players.length;
    m.exempt=gs.players.map((pl,i)=>realmExemptFromOrders(gs,i)?i:-1).filter(i=>i>=0);
  }
  return m;
}
// Spread into any games insert/update that writes game_state: `{game_state:…, ...metaPatch(gs)}`.
function metaPatch(gs){ return _kcHasMeta?{meta:buildGameMeta(gs)}:{}; }
// Column lists for the two list-style reads. With the column in place they carry no world and no
// report; without it the old heavy shape is used so nothing is lost.
const GAME_LITE_COLS='id,name,gm_user_id,status,turn,max_players,max_turns,created_at,meta';
const PLAYER_LITE_COLS='id,game_id,user_id,player_index,display_name,orders_submitted';
function gamesListCols(){ return _kcHasMeta?`${GAME_LITE_COLS}, game_players(${PLAYER_LITE_COLS})`:'*, game_players(*)'; }
// ════════════════════════════════════════════════════════════════════════════════════════════════
// ARCHIVE A GAME (2026-09-27, Toby item 1)
// ════════════════════════════════════════════════════════════════════════════════════════════════
// Deleting a game destroys it. Archiving puts it away: the row, its world, its players, its turn
// logs, its dispatches, its telemetry and its Hall-of-Fame record are ALL kept exactly as they are —
// the game simply drops out of the main list, and the auto-turn watcher stops watching it. The GM
// sees archived games by switching the list to Archived, and can restore one at any time.
//
// NO SCHEMA CHANGE. The flag is `archived` on game_state (the object every save round-trips) and is
// mirrored into `meta` by buildGameMeta, so the light list read sees it without pulling the world.
// A build that predates this feature simply ignores the key.
//
// An archived game is NOT hidden from the leaderboard — nothing is deleted, so the Hall of Fame
// keeps its record. To take a finished game off the board, use the Hall-of-Fame `hidden` flag
// instead; that is what it is for.
function gameArchived(game){
  const m=gameMetaOf(game);
  if(m&&m.archived!==undefined) return !!m.archived;
  return !!parseGameState(game).archived;
}
function gameArchivedAt(game){
  const m=gameMetaOf(game);
  if(m&&m.archivedAt) return m.archivedAt;
  return parseGameState(game).archivedAt||null;
}
let _showArchived=false;   // which list the GM is looking at
// Set or clear the flag. Reads the full row (game_state is the source of truth), writes it back
// with a conditional guard on `turn` so an archive click can never clobber a turn another tab
// resolved in the meantime.
async function setGameArchived(gameId, archived){
  if(!gameId) return;
  const msg=document.getElementById('detail-msg')||document.getElementById('msg-games');
  if(msg) msg.innerHTML=kcHtml`<div class="msg-info">${archived?'Archiving':'Restoring'}…</div>`;
  const {data:row,error}=await sb.from('games').select('id,turn,game_state').eq('id',gameId).single();
  if(error||!row){ if(msg) msg.innerHTML=kcHtml`<div class="msg-error">${(error&&error.message)||'Game not found.'}</div>`; return; }
  const gs=parseGameState(row);
  if(archived){ gs.archived=true; gs.archivedAt=new Date().toISOString(); }
  else { delete gs.archived; delete gs.archivedAt; }
  let q=sb.from('games').update({game_state:JSON.stringify(gs),...metaPatch(gs)}).eq('id',gameId);
  if(row.turn!=null) q=q.eq('turn',row.turn);       // the turn must not have moved under us
  const {data:done,error:e2}=await q.select('id').maybeSingle();
  if(e2){ if(msg) msg.innerHTML=kcHtml`<div class="msg-error">${e2.message}</div>`; return; }
  if(!done){ if(msg) msg.innerHTML='<div class="msg-error">The turn advanced while you were archiving — reload and try again.</div>'; return; }
  if(msg) msg.innerHTML='';
  _showArchived=archived;    // land on the list the game just moved into
  show('sec-games');
  loadGames();
}
function toggleArchivedView(){ _showArchived=!_showArchived; loadGames(); }
// One-off: any of this GM's games saved before the column existed gets its meta computed from
// game_state now, so the light reads never have to fall back for it again.
async function backfillGameMeta(){
  if(!_kcHasMeta||!currentUser) return 0;
  try{
    const {data,error}=await sb.from('games').select('id,game_state').eq('gm_user_id',currentUser.id).is('meta',null);
    if(error||!data||!data.length) return 0;
    let n=0;
    for(const g of data){ const {error:e2}=await sb.from('games').update({meta:buildGameMeta(parseGameState(g))}).eq('id',g.id); if(!e2) n++; }
    if(n) console.log(`[meta] backfilled ${n} game(s)`);
    if(n&&document.getElementById('sec-games')?.classList.contains('section-active')) loadGames();
    return n;
  }catch(e){ return 0; }
}
// ════
// GAME TELEMETRY (2026-09-25) — every realm's orders, situation and results, turn by turn
// ════
// Two Supabase tables, written by the GM portal only (the player portal never touches them):
//   turn_events  — ONE row per realm per resolved turn: the orders that realm gave (human or bot),
//                  a compact snapshot of its situation BEFORE the turn (gold, land, tax, armies,
//                  every character's place / health / skills / units / items), the same snapshot
//                  AFTER, and what happened to it in between (every battle with the pre-dice
//                  strengths, lair fights, provinces taken and lost, characters killed, spells
//                  cast and whether they took). ~3–8 KB a row.
//   game_results — ONE row per realm when a game ends: final rank, score, how the game was won,
//                  the turn the realm dropped out, and its final snapshot.
// Both are read by the STATS tab (see openStats) — the balance view — and both export as CSV/JSON
// so the same rows can be used as (situation → orders → outcome) examples to tune the bots.
// Neither table is ever read on the turn path, and a failed write never blocks a turn: the write is
// best-effort, the error is kept in _kcTelLastErr and shown on the game list.
// The tables are in the database's migrations (supabase/). If they're ever missing, probeTelemetry()
// leaves _kcHasTel=false, nothing is written, and the game list says so.
// game_id is TEXT (not a foreign key) so the rows survive a game being deleted — finished test games
// are usually deleted to tidy the list, and their data is the whole point. The Stats tab has a
// "forget deleted games" button for when that is NOT wanted.
const KC_TEL_V=1;                 // bump when the row shape changes (rows carry it in build)
let _kcHasTel=false, _kcTelLastErr=null;
async function probeTelemetry(){
  try{
    const a=await sb.from('turn_events').select('id').limit(1);
    const b=await sb.from('game_results').select('id').limit(1);
    _kcHasTel=!a.error&&!b.error;
    if(a.error) console.warn('turn_events probe:',a.error.message);
    if(b.error) console.warn('game_results probe:',b.error.message);
  }catch(e){ _kcHasTel=false; }
  renderTelemetryBanner();
  return _kcHasTel;
}
function renderTelemetryBanner(){
  const el=document.getElementById('msg-telemetry'); if(!el) return;
  if(!_kcHasTel){
    el.innerHTML=kcMissingMsg('📈 Game telemetry not active',kcHtml`<code>turn_events</code> / <code>game_results</code> tables`,'nothing is being recorded for the Stats tab or for bot training');
  } else if(_kcTelLastErr){
    el.innerHTML=kcHtml`<div class="msg-error"><strong>📈 Telemetry write failed</strong> on the last turn run: ${_kcTelLastErr}. The turn itself was saved; only the statistics row was lost.</div>`;
  } else el.innerHTML='';
}
// ════════════════════════════════════════════════════════════════════════════════════════════════
// DISPATCHES — the player-to-player messaging tables (2026-09-27)
// ════════════════════════════════════════════════════════════════════════════════════════════════
// The messaging UI lives entirely in the PLAYER portal (it replaced the duplicate Report tab beside
// the map). The GM portal carries only this: a probe so the game list can say when the tables are
// missing, and the two deletes that keep a removed game from leaving dispatches behind. No turn-path
// code touches these tables, so a messaging fault can never cost a turn.
//
// WHAT THE POLICIES GUARANTEE, and what they do not:
//  * A dispatch can only be INSERTED with from_index = the realm the signed-in account actually holds
//    in that game, and from_user_id = auth.uid(). A player cannot write in another realm's name.
//  * A dispatch can only be READ by its sender, its addressees, or anybody in the game if it is
//    public — plus the GM of that game. THE GM CAN THEREFORE READ PRIVATE DIPLOMACY. That is a
//    referee power, deliberate and easy to revoke: a migration that drops the second
//    `or exists (…games…)` branch of the read policy.
//  * "You may only write to a realm you have MET" is enforced in the player portal's UI only — the
//    encountered list lives inside game_state, which the access rules cannot read. Bypassing it would let a
//    player write to a stranger; it would NOT let them read anything more.
//  * Nobody can UPDATE a dispatch and only the game's GM can DELETE one, so a message cannot be
//    edited or withdrawn after it is sent — which is what "messages don't get lost" has to mean.
// game_id is TEXT and casts the other side (gp.game_id::text) so it does not matter whether the games
// table's key is uuid or text, and the rows outlive the game row itself. The tables and their policies
// are in supabase/schemas/, with their tests in supabase/tests/.
let _kcHasMsg=false;
async function probeMessaging(){
  try{
    const a=await sb.from('game_messages').select('id').limit(1);
    const b=await sb.from('game_message_reads').select('game_id').limit(1);
    _kcHasMsg=!a.error&&!b.error;
    if(a.error) console.warn('game_messages probe:',a.error.message);
    if(b.error) console.warn('game_message_reads probe:',b.error.message);
  }catch(e){ _kcHasMsg=false; }
  renderMessagingBanner();
  return _kcHasMsg;
}
function renderMessagingBanner(){
  const el=document.getElementById('msg-messaging'); if(!el) return;
  el.innerHTML=_kcHasMsg?'':kcMissingMsg('✉ Player messaging not active',kcHtml`<code>game_messages</code> / <code>game_message_reads</code> tables`,'the Dispatches panel in the player portal cannot send or receive');
}
