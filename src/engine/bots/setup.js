// Read {botCount, allBot} from a game's setup-phase config (stored in game_state at creation).
function botConfigFor(game){
  let cfg=gameMetaOf(game)||{}; if(!cfg.v){ try{ cfg=typeof game.game_state==='string'?JSON.parse(game.game_state):game.game_state||{}; }catch(e){} }
  const maxP=game.max_players||0;
  const allBot=cfg.allBot===true;
  const botCount=allBot?maxP:Math.max(0,Math.min(parseInt(cfg.botCount)||0,maxP));
  return {botCount, allBot};
}
// Read {private, invited[]} from a game's setup-phase game_state. Games with no `visibility` key
// (all pre-existing games, and every game once it goes active) read as Public with no invite list.
function gameVisibility(game){
  let cfg=gameMetaOf(game)||{}; if(!cfg.v){ try{ cfg=typeof game.game_state==='string'?JSON.parse(game.game_state):game.game_state||{}; }catch(e){} }
  const isPrivate=cfg.visibility==='private';
  return { private:isPrivate, invited:(isPrivate&&Array.isArray(cfg.invited))?cfg.invited:[] };
}
// Alignment → four starting skill points, drawn from each alignment's Title signature lane
// (see KC-design-victory-and-titles.md §5). Real engine skills only (SKILL_LABELS). Each totals 4.
const BOT_SKILL_BUILD={
  // Sept 2026 (bot strategy batch): every build now carries Tactical >=1 so the bot king can drill
  // his host from turn 1 — Divine swaps druid->tactical, Neutral drops a Sage point, Pagan drops an
  // Explorer point.
  Divine:  {white:2, tactical:1, melee:1},
  Good:    {melee:1, tactical:1, march:1, white:1},
  Druidic: {druid:2, tactical:1, archery:1},
  Neutral: {sage:1, tactical:1, spy:1, thief:1},
  Pagan:   {explorer:1, elemental:1, tactical:1, melee:1},
  Evil:    {melee:2, tactical:1, necromancy:1},
  Undead:  {necromancy:2, melee:1, tactical:1},
};
// Divine & Undead are one-per-game — mirrors the human join rule (player portal
// UNIQUE_ALIGNS_CHECK).
const BOT_UNIQUE_ALIGNS=['Divine','Undead'];
// Race → a signature unit whose faction-name pool (ARMY_UNIT_NAMES) we borrow for realm names.
// This reuses existing themed pools rather than inventing new name content (the engine has no
// realm-name generator: human players type theirs).
const BOT_KINGDOM_NAME_UNIT={Human:'Free Lances', Elven:'Elven Bowmen', Dwarven:'Dwarven Guard', Orcish:'Orc Berserkers'};
const _usedBotKingdomNames=new Set();
function _capRealm(s){ return String(s).replace(/^the\b/,'The'); }
function botKingdomName(race){
  const unit=BOT_KINGDOM_NAME_UNIT[race]||'Free Lances';
  const pool=(typeof ARMY_UNIT_NAMES!=='undefined'&&ARMY_UNIT_NAMES[unit])||['the Free Company'];
  for(let att=0;att<400;att++){
    const nm=pool[Math.floor(kcRng()*pool.length)];
    if(!_usedBotKingdomNames.has(nm)){ _usedBotKingdomNames.add(nm); return _capRealm(nm); }
  }
  const base=pool[Math.floor(kcRng()*pool.length)];
  let n=2,nm; do{ nm=`${base} ${_toRoman(n)}`; n++; }while(_usedBotKingdomNames.has(nm));
  _usedBotKingdomNames.add(nm); return _capRealm(nm);
}
// Pick a bot alignment: spread across the field, never duplicate a unique alignment already taken.
function pickBotAlignment(takenCounts){
  const used=new Set(Object.keys(takenCounts).filter(a=>takenCounts[a]>0));
  const legal=ALIGNMENTS_P.filter(a=> !(BOT_UNIQUE_ALIGNS.includes(a)&&used.has(a)) );
  const unused=legal.filter(a=>!used.has(a));
  const pool=unused.length?unused:legal.filter(a=>!BOT_UNIQUE_ALIGNS.includes(a));
  const safePool=pool.length?pool:['Neutral'];
  let bestN=Infinity; safePool.forEach(a=>{ const n=takenCounts[a]||0; if(n<bestN)bestN=n; });
  const ties=safePool.filter(a=>(takenCounts[a]||0)===bestN);
  return ties[Math.floor(kcRng()*ties.length)];
}
// ── BALANCED ALIGNMENT SPREAD ────
// With humans in the game the bots' alignments are no longer merely "spread out": they are chosen
// so that EACH human faces roughly half bots who would ally with them and half who would go to war.
// Under the item 3 rule a bot's stance toward a human is fixed by the spectrum — alignDistP <= 1 is
// a future ally, >= 2 is a future enemy — so the alignments ARE the diplomacy, decided at world
// gen.
//
// Greedy, one bot slot at a time. For each legal candidate alignment we count, per human, whether
// that candidate would be a friend of theirs, and charge the side that human already has MORE of:
//
// cost = Σ_humans ( candidate is that human's friend ? friendsSoFar[h]: foesSoFar[h] )
//
// so every pick fills whichever column is currently shorter for each human, and the two converge on
// half and half. A small spread term keeps alignment variety (and so a varied world) when the
// balance term ties, and ties are then broken at random. Divine/Undead uniqueness is honoured
// exactly as
// pickBotAlignment does. `humanAligns` empty (an all-bot game) → fall back to pickBotAlignment.
function pickBotAlignmentBalanced(takenCounts, humanAligns, friends, foes){
  if(!humanAligns||!humanAligns.length) return pickBotAlignment(takenCounts);
  const used=new Set(Object.keys(takenCounts).filter(a=>takenCounts[a]>0));
  const legal=ALIGNMENTS_P.filter(a=> !(BOT_UNIQUE_ALIGNS.includes(a)&&used.has(a)) );
  const pool=legal.length?legal:['Neutral'];
  let best=null;
  pool.forEach(a=>{
    let cost=0;
    humanAligns.forEach((ha,h)=>{
      const friendly=alignDistP(a,ha)<=BOT_ALLY_ALIGN_DIST;
      cost += friendly ? (friends[h]||0) : (foes[h]||0);
    });
    cost += (takenCounts[a]||0)*0.25;                 // mild preference for an alignment not yet in play
    if(!best||cost<best.cost) best={cost,ties:[a]};
    else if(Math.abs(cost-best.cost)<1e-9) best.ties.push(a);
  });
  return best.ties[Math.floor(kcRng()*best.ties.length)];
}
// Generate `count` bot setup objects, indexed startIndex..startIndex+count-1 (kept CONTIGUOUS with
// the human indices so generateNewGame's array-position player id matches
// game_players.player_index). humanSetups seed the alignment spread + uniqueness so bots avoid
// clustering on the humans' choices, and drive the half-friendly / half-hostile balance described
// above.
function generateBotSetups(humanSetups, count, startIndex){
  const takenCounts={};
  (humanSetups||[]).forEach(s=>{ if(s.alignment) takenCounts[s.alignment]=(takenCounts[s.alignment]||0)+1; });
  const humanAligns=(humanSetups||[]).map(s=>s&&s.alignment).filter(Boolean);
  const friends=humanAligns.map(()=>0), foes=humanAligns.map(()=>0);
  const bots=[];
  for(let i=0;i<count;i++){
    const alignment=pickBotAlignmentBalanced(takenCounts,humanAligns,friends,foes);
    humanAligns.forEach((ha,h)=>{ if(alignDistP(alignment,ha)<=BOT_ALLY_ALIGN_DIST) friends[h]++; else foes[h]++; });
    takenCounts[alignment]=(takenCounts[alignment]||0)+1;
    const race=RACES_P[Math.floor(kcRng()*RACES_P.length)];
    const temper=TEMPERS_P[Math.floor(kcRng()*TEMPERS_P.length)];
    const skills={...(BOT_SKILL_BUILD[alignment]||BOT_SKILL_BUILD.Neutral)};
    bots.push({
      id:startIndex+i, isBot:true,
      kingName:nextHeroName(alignment),
      kingdomName:botKingdomName(race),
      race, alignment, temper, skills,
    });
  }
  return bots;
}

