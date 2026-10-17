// ══ GRAVEYARD LORE ════
// A character with any Necromancy at all feels the battlefield dead underfoot. At the end of their
// last phase they learn that a province they stand in HOLDS graves — nothing more. A stronger
// effect (Control Undead's province scan) records the roll of the dead as well.
//
// Stored per REALM, not per character, and kept forever: `pl._graveIntel[provId] =
// { turn, detail:[{k:'Average Orc Berserkers', n:2}]|null, detailTurn:N|null }`
// The record is deliberately allowed to go stale — the graves may have been raised or rotted since
// — so the report always stamps the turn it was learned. Detail once learned is never downgraded to
// a bare sensing; it just keeps its own (older) turn stamp. `opts.partial` marks a reading that saw
// only SOME of what lies here — the Deathpriest's Grave-sight, which picks out the crack and elite
// dead across the whole world but is blind to the lesser ranks beside them. A partial reading is
// still the freshest thing the realm knows, so it replaces an older full one, but it is flagged so
// the report can say "at least". A partial reading with nothing to show is NOT treated as "seen
// bare" — the title simply found no crack or elite dead there, which says nothing about whether
// other graves lie in the province.
function noteGraveIntel(pl, provId, turn, graves, opts){
  if(!pl||provId==null) return;
  if(!pl._graveIntel||typeof pl._graveIntel!=='object'||Array.isArray(pl._graveIntel)) pl._graveIntel={};
  const partial=!!(opts&&opts.partial);
  const list=Array.isArray(graves)?graves:null;
  // Standing in the province and finding it bare is knowledge too: forget the old record rather
  // than keep promising graves the character can see are not there. (Never on a partial reading.)
  if(list&&list.length===0){ if(!partial) delete pl._graveIntel[provId]; return; }
  const prev=pl._graveIntel[provId]||{};
  const rec={turn:turn, detail:prev.detail||null, detailTurn:prev.detailTurn||null, detailPartial:!!prev.detailPartial};
  if(list&&list.length){
    const counts={}; list.forEach(g=>{ const k=`${g&&g.quality||'Average'} ${g&&g.type||'unit'}`; counts[k]=(counts[k]||0)+1; });
    rec.detail=Object.entries(counts).map(([k,n])=>({k,n})); rec.detailTurn=turn; rec.detailPartial=partial;
  }
  pl._graveIntel[provId]=rec;
}
// ══ RAISING THE DEAD: THE BEST FIRST ════
// The dead do not queue by lot: the most experienced rise first. Ties within an experience tier go
// to the heavier unit (base strength), and only then to chance. Returns the grave record, already
// removed from prov.battleGraves, or null if there are none. 2026-09-15 — RAISING THE DEAD TELLS
// YOU NOTHING ELSE. The count is gone from Skeletal Armies, Harvest the Field, Raise Wraiths and
// Death's Dominion alike. The Control Undead SCAN still reports the roll of the dead in full:
// naming them is the whole point of it.
// Skeletal Armies: how many grave units one successful cast raises, by the caster's effective
// Necromancy (0-5 benefit scale): 1 at level 1-2, 2 at level 3-4, 3 at level 5+.
function skeletalRaiseCount(lvl){ lvl=lvl||0; return lvl>=5?3:lvl>=3?2:1; }
function takeBestGrave(prov){
  const gs=(prov&&prov.battleGraves)||[];
  if(!gs.length) return null;
  const qi=g=>{ const i=QUALITY_TIERS.indexOf(g&&g.quality); return i<0?1:i; }; // unknown quality ≈ Average
  const str=g=>{ try{ return unitBaseStrength({type:g.type,quality:g.quality||'Average'}); }catch(e){ return 0; } };
  let best=0,bq=-1,bs=-1;
  gs.forEach((g,i)=>{ const q=qi(g), s=str(g); if(q>bq||(q===bq&&s>bs)){ bq=q; bs=s; best=i; } });
  return gs.splice(best,1)[0];
}
// ── GRAVES UNDERFOOT, PROVINCE BY PROVINCE ────
// A necromancer feels the battlefield dead of EVERY province they set foot in, not only the one
// they happen to finish the turn standing in. Called from the move choke-point as each march-in
// lands, and again in the end-of-turn sweep for any character who never moved. One reading per
// province per character per turn (tracked on `c._gravesSensedTurn` / `c._gravesSensedIds`), so a
// column that marches back and forth does not spam the Chronicle — and a province read on the way
// through is already in `_graveIntel`, so it shows up in the report's Graveyards Known either way.
// `emit` is the log function to use (the callers differ in phase/context), or null for silent.
function senseGravesUnderfoot(state, c, pv, emit){
  if(!c||!c.alive||c.player==null||!pv) return false;
  // SCOPE TRAP: runTurn declares its own effStat() helper, which is invisible to
  // this module-level function — calling it threw ReferenceError and aborted EVERY turn. Go straight
  // to the shared source of truth instead; runTurn's effStat() is only a thin wrapper over this.
  if(effSkillOf(c,'necromancy',(state&&state.characters)||[])<1) return false;
  const pl=(state.players||[])[c.player]; if(!pl) return false;
  if(c._gravesSensedTurn!==state.turn){ c._gravesSensedTurn=state.turn; c._gravesSensedIds=[]; }
  if(!Array.isArray(c._gravesSensedIds)) c._gravesSensedIds=[];
  if(c._gravesSensedIds.includes(pv.id)) return false;   // already read this ground this turn
  c._gravesSensedIds.push(pv.id);
  const n=((pv.battleGraves)||[]).length;
  if(n===0){ noteGraveIntel(pl, pv.id, state.turn, []); return false; } // bare ground is knowledge too
  noteGraveIntel(pl, pv.id, state.turn, null); // existence only — Control Undead buys the roll of the dead
  if(typeof emit==='function') emit(pv);
  return true;
}
// The realm's graveyard lore, shaped for the player report ("Graveyards known").
function graveIntelFor(gs, pl){
  if(!gs||!pl||!pl._graveIntel) return [];
  return Object.keys(pl._graveIntel).map(k=>{
    const pv=gs.world&&gs.world.provinces&&gs.world.provinces[k]; const rec=pl._graveIntel[k]||{};
    return {provinceId:isNaN(+k)?k:+k, name:(pv&&pv.name)||'an unmapped province',
            turn:rec.turn||null, detail:rec.detail||null, detailTurn:rec.detailTurn||null,
            detailPartial:!!rec.detailPartial};
  }).sort((a,b)=>(b.turn||0)-(a.turn||0)||String(a.name).localeCompare(String(b.name)));
}
