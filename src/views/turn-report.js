// ── EVIL TERROR: the constants and the reading (2026-10-12, Toby items 21 and 23) ── −10% a stack (more where
// Reign of Terror set the province's own share), at most three stacks. Module level so the engine (spreadTerror,
// consumeTerror) and the report (an Evil realm sees each province's Terror on the map and in its report) read the
// same figures. terrorReadingOf(p, viewer) → {pct, stacks, byYou} or null when no Terror grips the province.
const TERROR_PCT_PER_STACK=0.10, TERROR_MAX_STACKS=3;
function terrorReadingOf(p, viewer){
  const n=Math.min(TERROR_MAX_STACKS, (p&&p._terrorStacks)|0);
  if(!(n>0)||p._terrorTurn===undefined) return null;
  const per=(typeof p._terrorPct==='number'&&p._terrorPct>0)?p._terrorPct:TERROR_PCT_PER_STACK;
  return {pct:Math.round(per*n*100), stacks:n, byYou:p._terrorisedBy===viewer};
}
function buildTurnReport(gameState, playerIndex){
  const player=gameState.players[playerIndex];
  const chars=gameState.characters.filter(c=>c.player===playerIndex&&(c.alive||c.killedThisTurn));
  // honour the player's own arrangement of their heroes (set from the orders column and kept on the
  // realm). Array.sort is stable, so heroes the arrangement does not name — newly hired, raised or
  // crowned — fall in after the named ones in engine order. This drives both the report's character
  // list and, through it, next turn's orders column.
  { const _ho=Array.isArray(player&&player.heroOrder)?player.heroOrder.map(String):[];
    if(_ho.length){
      const _rank=new Map(_ho.map((id,i)=>[String(id),i]));
      chars.sort((a,b)=>(_rank.has(String(a.id))?_rank.get(String(a.id)):1e9)-(_rank.has(String(b.id))?_rank.get(String(b.id)):1e9));
    } }
  // ── TITLES: per-character holdings (Items 1 & 2). Computed once; public from turn 5. ──
  const _titlesPublic=((gameState.turn||1)>=TITLES_PUBLIC_FROM_TURN)||!!gameState.gameOver;
  let _stdT={titles:{}}, _minT={};
  if(_titlesPublic){ try{ _stdT=computeStandings(gameState); _minT=computeMinorTitles(gameState); }catch(e){ _stdT={titles:{}}; _minT={}; } }
  const ownedProvIds=new Set(player.provinces||[]);
  const visitedProvIds=new Set(gameState.world.provinces.filter(p=>(p.visitedBy||[]).includes(playerIndex)).map(p=>p.id));

  // Build neighbour sets for visibility — adjacent to visited/owned
  const{cols,rows,provinces}=gameState.world;
  const adjacentProvIds=new Set();
  const offsets_even=[[-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]];
  const offsets_odd= [[-1,0],[-1,1],[0,-1],[0,1],[1,0],[1,1]];
  provinces.forEach(p=>{
    if(!visitedProvIds.has(p.id)&&!ownedProvIds.has(p.id)) return;
    const offsets=p.row%2===0?offsets_even:offsets_odd;
    offsets.forEach(([dr,dc])=>{
      const nr=p.row+dr; if(nr<0||nr>=rows) return;
      const nc=((p.col+dc)%cols+cols)%cols;
      const nid=nr*cols+nc;
      if(!visitedProvIds.has(nid)&&!ownedProvIds.has(nid)) adjacentProvIds.add(nid);
    });
  });

  const ownedProvinces=gameState.world.provinces.filter(p=>ownedProvIds.has(p.id)).map(p=>({
    id:p.id,name:p.name,terrain:p.terrain,tax:p.tax,race:p.race,population:p.population,
    owner:p.owner,   // the Steal form needs to know whose garrison stands here (paymaster target)
    // Only show features that have been discovered based on exploration threshold At 100% explored
    // all features visible; threshold = 100/totalFeatures per feature
    features:(()=>{
      const total=(p.features||[]).length;
      const explored=(p.exploredBy&&p.exploredBy[playerIndex])||0;
      return (p.features||[]).map((f,idx)=>{
        const threshold=total>0?Math.ceil(100/total)*(idx+1):100;
        const known=featDiscovered(f,playerIndex);
        // a ritual site in your OWN province is always visible — you hold the ground and know your
        // own standing stones. Other features still follow the explore-threshold reveal.
        const canSee=known||(explored>=threshold)||!!f.ritualSite;
        if(!canSee) return null;
        return{name:f.name,discovered:canSee,cleared:f.cleared,ritualSite:!!f.ritualSite,monsterPower:(f.monster&&f.monster.power)||f.tier||'',monsterCat:monsterCatLabel(f.monster),treasure:known?f.treasure:null};
      }).filter(Boolean);
    })(),
    neutralDefenders:(()=>{
      // Get armies from the neutral guard hero if one exists, otherwise fall back to province array
      const ng=gameState.characters.find(c=>c.alive&&c.player===null&&c._isNeutralGuard&&c.location===p.id);
      const defs=ng?(ng.armies||[]):(p.neutralDefenders||[]);
      return defs.map(d=>({type:d.type,quality:d.quality,unitName:d.unitName||''}));
    })(),
    neutralGuard:(()=>{
      const ng=gameState.characters.find(c=>c.alive&&c.player===null&&c._isNeutralGuard&&c.location===p.id);
      return ng?{id:ng.id,name:ng.name,race:ng.race,skills:ng.skills}:null;
    })(),
    armyTypes:p.armyTypes,
    // Unled (garrisoned) armies the player keeps in this province — recruited directly to the
    // garrison, or left behind here by one of their characters.
    garrisonArmies:(p.garrisonArmies||[]).map(a=>({type:a.type,quality:a.quality,unitName:a.unitName||'',race:a.race||null,skeletal:!!a._isSkeletal,wildHunt:(a._wildHuntUntilTurn!=null),wildHuntUntil:(a._wildHuntUntilTurn!=null?a._wildHuntUntilTurn:null),
      // 2026-09-23 (item 7): an unled unit's own pace — base speed plus the realm's Road / `move`
      // discoveries for a speed-1/2 land unit (no commander, so no March, Naval or title bonus).
      ...garrisonMoveRate(a, gameState.players[playerIndex])})),
    grandDesign:(p.grandDesign?{name:p.grandDesign.name,ownerName:(gameState.players[p.grandDesign.owner]||{}).name||null,active:gdActiveFor(gameState,p.grandDesign.owner)}:null), // Wonder of the age
    explored:(p.exploredBy&&p.exploredBy[playerIndex])||0,
    characters:(p.characters||[]).map(cid=>{
      const c=gameState.characters[cid];
      // A fallen character is shown ONLY by the ☠ marker (from visibleDeadHeroes), never as a
      // living character circle. This owned-province list omitted the c.alive filter that
      // liveChars() applies, so a corpse lying in your own province drew a second, colourless
      // (grey) character icon on top of its skull. Filter the dead out here to match liveChars().
      // 2026-09-09: carry the SAME fields as the worldMeta liveChars() list (owner name/colour,
      // wanderer/chieftain flags, army count). The portal now keeps the worldMeta list; this is
      // belt-and-braces.
      if(!(c&&c.alive)) return null;
      const _own=c.player===playerIndex;
      return{id:c.id,name:c.name,isOwn:_own,isKing:c.isKing,
        isWanderer:c.player===null, isNeutralGuard:!!c._isNeutralGuard,
        ownerName:c.player!=null&&!_own?(gameState.players[c.player]?.name||null):null,
        armyCount:(c.armies||[]).length,
        ownerColor:c.player!==null?gameState.players[c.player]?.color:null};
    }).filter(Boolean),
  }));

  const ARMY_SPEED_P=ARMY_SPEED_MASTER; // alias → master table at top of script

  const charReports=chars.map(c=>{
    const prov=gameState.world.provinces[c.location];
    const armies=(c.armies||[]).map(a=>({type:a.type,quality:a.quality,speed:ARMY_SPEED_P[a.type]||3,unitName:a.unitName,race:a.race||null,cost:((a._temporary||a._wildHuntUntilTurn!=null)?0:(a._isSkeletal?1:(ARMY_COST_MASTER[a.type]||2))),skeletal:!!a._isSkeletal,temporary:!!a._temporary,wildHunt:(a._wildHuntUntilTurn!=null),wildHuntUntil:(a._wildHuntUntilTurn!=null?a._wildHuntUntilTurn:null)})); // Wild Hunt tag
    // 2026-09-09e: these were read RAW, so an item granting March or Naval was left out of the
    // speed the player was shown while the engine moved them at the higher rate. Same stack as
    // setMovePool.
    const marchLvl=effSkillOf(c,'march',gameState.characters||[]);
    const navalLvl=effSkillOf(c,'naval',gameState.characters||[]);
    const _repPl=(c.player!=null)?(gameState.players[c.player]||null):null;
    function repSpd(a){
      const base=a.speed||3;
      const SEA_T=new Set(KC_UNIT_CLASS.sea);
      const FLY_T=new Set(KC_UNIT_CLASS.aerial); // every flyer, riders and winged beasts (item 14)
      if(SEA_T.has(a.type)) return base+navalSpeedBonus(base,navalLvl); // the engine's naval table (was +navalLvl)
      if(FLY_T.has(a.type)) return base;
      // Road Network (sd13) and the race/alignment `move` discoveries (Toll Roads, Caravan Roads…)
      // add to Speed 1–2 land units in the engine (computeMovePoolMax) but were missing here, so
      // the order form showed a Road-Network Dwarven Guard column at 2 while it actually marched at
      // 3.
      let _road=0;
      if(base<=2&&_repPl){ discEffectsOf(_repPl,'move').forEach(e=>{ if(discUnitMatch(e,a)) _road+=(e.extra||0); }); } // sd13 Road Network is now a `move` effect
      return base+marchSpeedBonus(marchLvl)+_road;
    }
    const SEA_UNIT_TYPES=new Set(KC_UNIT_CLASS.sea);
    // Winged units cross sea without a fleet (matches AERIAL_TYPES in the engine).
    const AERIAL_UNIT_TYPES=new Set(KC_UNIT_CLASS.aerial);
    const landArmiesRep=armies.filter(a=>!SEA_UNIT_TYPES.has(a.type));
    const seaArmiesRep=armies.filter(a=>SEA_UNIT_TYPES.has(a.type));
    const trueLandRep=armies.filter(a=>!SEA_UNIT_TYPES.has(a.type)&&!AERIAL_UNIT_TYPES.has(a.type));
    let effSpd=armies.length===0?5:landArmiesRep.length>0?Math.min(...landArmiesRep.map(a=>repSpd(a))):0;
    // Sea speed: use fleets if present; else all-flying/empty forces cross by air at their land
    // speed. 2026-09-12: the squadron sails at its SLOWEST ship and a lone hero takes passage at a
    // flat 5 — both as the engine does.
    let effSeaSpd=seaArmiesRep.length>0?Math.min(...seaArmiesRep.map(a=>repSpd(a)))
      :armies.length===0?5
      :(trueLandRep.length===0?(landArmiesRep.length>0?Math.min(...landArmiesRep.map(a=>repSpd(a))):5):0);
    // ── FLYING CARRY (report mirror of getFlyCapability) ── If the humanoid flyers can lift every
    // foot soldier in the force (1 each, nothing grounded left behind), the column takes to the
    // air: it moves at the flyers' pace (carried infantry no longer slow it) and crosses sea
    // freely.
    {
      const FLY_CARRIERS_REP=new Set(KC_UNIT_CLASS.flying);
      const CAV_REP=new Set(KC_UNIT_CLASS.cavalry);
      const CRE_REP=new Set(KC_UNIT_CLASS.creature);
      const MON_REP=new Set(KC_UNIT_CLASS.monster);
      const repAirCarriable=(t)=>!(AERIAL_UNIT_TYPES.has(t)||SEA_UNIT_TYPES.has(t)||CRE_REP.has(t)||MON_REP.has(t)||CAV_REP.has(t));
      let carriers=0,carried=0,selfFly=false,grounded=false;
      armies.forEach(a=>{
        if(FLY_CARRIERS_REP.has(a.type)){carriers++;selfFly=true;}
        else if(AERIAL_UNIT_TYPES.has(a.type)){selfFly=true;}
        else if(repAirCarriable(a.type)){carried++;}
        else grounded=true;
      });
      const canFlyRep=armies.length>0 && !grounded && selfFly && carriers>=carried && !armies.every(a=>AERIAL_UNIT_TYPES.has(a.type));
      if(canFlyRep){
        const flyerSpeeds=armies.filter(a=>AERIAL_UNIT_TYPES.has(a.type)).map(a=>repSpd(a));
        if(flyerSpeeds.length){ effSpd=Math.min(...flyerSpeeds); effSeaSpd=effSpd; }
      }
      // the force's FLYING pace for the army summary line — the slowest flyer when the whole column
      // takes to the air (all winged, or the flyers carry every foot soldier); 0 when anything is
      // left on the ground.
      var _effAirSpd=0;
      if(armies.length>0&&(canFlyRep||armies.every(a=>AERIAL_UNIT_TYPES.has(a.type)))){
        const _fs=armies.filter(a=>AERIAL_UNIT_TYPES.has(a.type)).map(a=>repSpd(a));
        if(_fs.length) _effAirSpd=Math.min(..._fs);
      }
    }
    // ── PER-UNIT MOVEMENT RATE (2026-09-23, Toby item 7) ── each led unit's OWN rate, exactly as
    // computeMovePoolMax prices it: base speed + the March table (one rate for all) + Road
    // / race `move` discoveries (speed 1–2 land units) for land units; base + the Naval table for
    // sea units; flyers (riders and winged beasts) are untouched by March. Items that raise March / Naval count (repSpd reads
    // the effective skill). The Swift / Sea-Wolf minor titles add +1 to land / sea pace. The
    // COLUMN still moves at its slowest unit (and a lifted column at its flyers' pace) — that figure
    // is the header's "Land: N/turn".
    { const _mh=(gameState._minorHolders||{});
      const _swift=!!(_mh.swift&&_mh.swift.charId===c.id), _seawolf=!!(_mh.seawolf&&_mh.seawolf.charId===c.id);
      armies.forEach(a=>{ const _sea=SEA_UNIT_TYPES.has(a.type);
        a.moveRate=repSpd(a)+(_sea?(_seawolf?1:0):(_swift?1:0));
        a.moveKind=_sea?'sea':(AERIAL_UNIT_TYPES.has(a.type)?'air':'land'); });
      // the column pace quoted in the orders header must match computeMovePoolMax, which adds the
      // Swift / Sea-Wolf +1 to the land / sea pool (whenever that pool exists). The report left
      // both out, so a Swift holder was shown one province slower than he actually marched.
      if(_swift&&effSpd>0) effSpd+=1;
      if(_seawolf&&effSeaSpd>0) effSeaSpd+=1; }
    return{
      id:c.id,name:c.name,isKing:c.isKing,race:c.race,alignment:c.alignment,temper:c.temper,temperEff:effTemper(c), // Item 7
      hp:c.hp,maxHp:c.maxHp,skills:c.skills||{},aptitude:c.aptitude||{},armies,
      // 2026-09-09e: the EFFECTIVE skill of each ability and where the difference comes from,
      // computed
      // by skillBonusBreakdown — the very function the engine's effStat uses — so the player's own
      // character card can show exactly the numbers the turn will be resolved with.
      skillEff:(()=>{ const out={};
        ABILITIES_P.forEach(k=>{ const b=skillBonusBreakdown(c,k,gameState.characters||[]);
          if(b.base>0||b.total>0) out[k]={base:b.base,total:b.total,bonus:b.bonus,items:b.items,aura:b.aura,curse:b.curse,sources:b.sources}; });
        return out; })(),
      // Cast chance per school, exactly as the action phase will roll it (see castChanceFor).
      // Includes the flat 95% of a spell worked from an ITEM and whether a Wailing Phylactery still
      // has its free Necromancy casting in hand this turn, so the order form can quote either.
      castChance:(()=>{
        const out={};
        MAGIC_L8_SCHOOLS.forEach(sc=>{
          const r=castChanceFor(c,sc,gameState.players[c.player],{chars:gameState.characters||[]});
          if(r.level>0) out[sc]={level:r.level,chance:r.chance,arcane:r.arcane||0,mastery:r.l8||0,discovery:r.disc||0};
        });
        return out; })(),
      castFromItem:95,
      // ── ORDER SUCCESS CHANCES ────
      // The odds the action phase will roll for this character, by the engine's own formulas, so an
      // order form can quote them before the turn is filed. Where an unknowable factor applies — an
      // enemy realm's counter-espionage, a guarded vault, a mentor practising alongside — the note
      // in the portal says so rather than pretending the figure is final.
      orderChance:(()=>{
        const pl=gameState.players[c.player]||{};
        const has=(id)=>(pl.discoveries||[]).some(d=>d&&d.id===id);
        const eff=(k)=>effSkillOf(c,k,gameState.characters||[]);
        const raw=(k)=>Math.max(0,Math.min(9,((c.skills||{})[k])||0));
        const items=activeItems(c);
        const out={};
        // SPY — 20% + 20% per level, + Forgery Arts and any spy discoveries. Automatic with a
        // Crystal Orb or at Spy 6+. An enemy's Cipher Scripts can cut it by up to 25%.
        out.spy={ auto:(items.some(it=>it.effect&&it.effect.stat==='oracle')||raw('spy')>=6),
                  autoWhy:items.some(it=>it.effect&&it.effect.stat==='oracle')?'Crystal Orb':(raw('spy')>=6?'Master Spy':''),
                  level:eff('spy'),
                  chance:dispFloor((0.2+eff('spy')*0.2+discSumOf(pl,'spy','pct',e=>!e.terrains&&!e.coastal))*100) }; // unscoped spy discoveries only (terrain/coastal ones depend on the target)
        // RESEARCH — Sage level x 5%, doubled for Neutral realms, + Loreseeker.
        { const per=5;
          out.research={ level:eff('sage'), rawLevel:raw('sage'),
            chance:eff('sage')*per+((pl.alignment==='Neutral')?eff('sage')*5:0)
                   +((( _minT&&_minT.loreseeker)||((gameState._minorHolders||{}).loreseeker)||{}).charId===c.id?per:0)
                   +discSumOf(pl,'research','pct',e=>!e.field) }; }
        // ASSASSINATE (Spy 9) — 25% + 6% per RAW Spy level, cap 80, less 25 against a king.
        out.assassinate={ level:raw('spy'), chance:Math.min(80,25+raw('spy')*6), kingPenalty:25 };
        // STEAL / GRAND HEIST — the thief's own odds before the target's circumstances.
        out.steal={ level:eff('thief'), chance:Math.min(95,50+10*Math.min(eff('thief'),5)), escape:Math.min(95,eff('thief')*20) }; // 95% ceiling, matching the engine
        out.grandHeist={ level:raw('thief'), chance:Math.min(95,60+5*Math.max(0,raw('thief')-5)), escape:Math.min(95,raw('thief')*20) };
        // PRACTICE — the solo chance at each level; a peer adds half as much again, a mentor makes
        // it certain.
        out.practice={ byLevel:[25,20,15,10,5], astro:0, discovery:discSumOf(pl,'practice','pct',e=>!e.skills)*100,
          bySkill:(()=>{ const m={}; discEffectsOf(pl,'practice').forEach(e=>{ (e.skills||[]).forEach(k=>{ m[k]=(m[k]||0)+(e.pct||0)*100; }); }); return m; })() }; // sd26 is now a `practice` effect; skill-scoped practice discoveries itemised per skill
        // BLOCKADE (Naval 7) — the blockade forms half the time.
        out.blockade={ chance:50 };
        return out; })(),
      necroAutoReady:!!(!c._necroAutoUsed&&activeItems(c).some(it=>it.effect&&it.effect.stat==='necroAuto')),
      // EVERY bonus that is not already folded into the skill itself — minor titles and the Veteran
      // Training discovery — with the `kind` that colours it and the `scope` that says when it
      // bites. Single source: extraSkillBonuses at module level. This replaces the old hand-rolled
      // list, which knew only the four personal-combat titles and so left The Strategist's +1
      // Tactical, The Swift, The Sea-Wolf and The Loreseeker invisible.
      skillExtra:(()=>{
        // Prefer this report's freshly-computed holders; fall back to the set the last turn
        // resolved with, so a character sees their own perk even before titles become public.
        const mh={}; MINOR_TITLES.forEach(t=>{ const h=(_minT&&_minT[t.key])||((gameState._minorHolders||{})[t.key]); if(h) mh[t.key]=h; });
        return extraSkillBonuses(c, gameState, mh); })(),
      // Kept as-is for any cached older player portal: the personal-combat subset only, same shape.
      combatSkillBonus:(()=>{
        const mh={}; MINOR_TITLES.forEach(t=>{ const h=(_minT&&_minT[t.key])||((gameState._minorHolders||{})[t.key]); if(h) mh[t.key]=h; });
        const all=extraSkillBonuses(c, gameState, mh), out={};
        Object.keys(all).forEach(sk=>{ const only=all[sk].filter(x=>x.scope==='combat'); if(only.length) out[sk]=only; });
        return out; })(),items:(normaliseEquipment(c),(c.items||[]).map(it=>it?({...it,slot:itemSlot(it),lore:itemLore(it),acquiredThisTurn:itemAcquiredThisTurn(c,it)}):it)),pay:c.pay||0,
      locationId:c.location,locationName:prov?.name||'Unknown',merits:c.merits,
      effectiveSpeed:effSpd,effectiveSeaSpeed:effSeaSpd,effectiveAirSpeed:_effAirSpd,
      hiredInPhase:c.hiredInPhase??-1,  // -1 = was hired before this turn
      encounterPlan:c.encounterPlan||{tactics:['ME'],notes:''},
      alive:c.alive!==false, killedThisTurn:!!c.killedThisTurn,   // so the report can show a fallen hero's own section
      _isHeir:!!c._isHeir, _pendingSkillAllocation:c._pendingSkillAllocation||0, // royal succession skill choice
      // Titles/perks this character holds, and any won THIS turn are flagged via titles.gains.
      titlesHeld:_titlesPublic?TITLE_DEFS.filter(t=>_stdT.titles[t.key]&&_stdT.titles[t.key].charId===c.id).map(t=>({key:t.key,name:t.name,perk:t.perk,req:t.req})):[],
      minorHeld:_titlesPublic?MINOR_TITLES.filter(t=>_minT[t.key]&&_minT[t.key].charId===c.id).map(t=>({key:t.key,name:t.name,perk:t.perk,req:t.req})):[],
    };
  });

  // Enemy/wandering characters visible to this player (in same province as one of our chars)
  const ownCharLocs=new Set(gameState.characters.filter(c=>c.alive&&c.player===playerIndex).map(c=>c.location));
  // 2026-10-15 (Toby, D1): the one sight rule decides who is listed (Invisibility and the wanderers'
  // cloak hide them here too), and another realm's hero gives away only name, realm and the rough size
  // of their army (leadsArmies says whether there is one, for Charm and Telekinetic Storm). A wandering
  // hero's race, alignment and the rest stay public, as the Hire list shows them.
  const _vcCtx={ownedProvIds:new Set(player.provinces||[]),ownCharLocs,spiedThisTurn:new Set(player._spiedProvincesThisTurn||[])};
  const visibleChars=gameState.characters.filter(c=>c.alive&&c.player!==playerIndex&&ownCharLocs.has(c.location)&&enemyCharVisibleTo(gameState,playerIndex,c,_vcCtx)).map(c=>({
    id:c.id,name:c.name,locationId:c.location,locationName:gameState.world.provinces[c.location]?.name||'?',
    isKing:c.isKing,...(c.player==null?{race:c.race,alignment:c.alignment}:{}),
    leadsArmies:(c.armies||[]).length>0, armyBand:armySizeBand((c.armies||[]).length),
    player:c.player, isWandering:c.player===null,
    // Wandering heroes are unowned and public (like a hireable hero), so it is safe to surface
    // their full detail — the player portal needs it to build a Charm order card if this hero is
    // charmed into their service. Owned enemy heroes get NONE of this (no intel leak).
    // Charm-eligible heroes (unowned OR enemy) leading NO armies are surfaced in full so the player
    // portal can build a Charm order card for them. They're standing unarmed in a province where
    // you have a character — close enough for your hero to take their measure. A hero leading
    // troops isn't charmable, so gets none of this (no intel leak on a fielded commander). A hero
    // charmed last turn is closed to Charm for the whole of this one — surfaced so the order form
    // can grey them out rather than let the player spend a cast on a mind that cannot be swayed.
    charmImmune:(c._charmImmuneTurn===(gameState.turn||1)),
    // an ENEMY hero's skills are never sent — a charmer must not learn them. A wandering hero's are
    // public (the Hire list shows them), so they still travel.
    ...((c.player==null&&!c.isKing&&(c.armies||[]).length===0)?{skills:{...(c.skills||{})},temper:c.temper||null,hp:c.hp,maxHp:c.maxHp,pay:c.pay}:{}),
  }));

  // ── Persistent "ever seen" character intel (Clairvoyance targeting) ── AK: Clairvoyance may
  // target "any character the player has seen at any point in the game". The engine records
  // sightings into player.seenCharIntel each phase (updateProvinceMemory); the report surfaces the
  // whole record here, refreshed with anything visible right now.
  const everSeenChars=(()=>{
    const rec={...((player&&player.seenCharIntel)||{})};
    visibleChars.forEach(v=>{ rec[v.id]={id:v.id,name:v.name,isKing:v.isKing,race:v.race,alignment:v.alignment,
      player:v.player,isWandering:v.isWandering,lastSeenTurn:gameState.turn,lastLocId:v.locationId,lastLocName:v.locationName}; });
    // Own characters are always "seen" but are never Clairvoyance targets worth listing — skip
    // them. Task 7(b): neutral/wandering heroes (player==null) cannot be Clairvoyance targets —
    // drop them.
    return Object.values(rec).filter(x=>{
      const live=gameState.characters.find(ch=>ch.id===x.id);
      return live&&live.alive&&live.player!=null; // dead handled by the spell's dead-target report; neutrals excluded
    });
  })();

  // Helper: get the single most notable skill for display (highest level; random if tie)
  // 2026-09-13: keep in step with skillFameLabel() in the player portal — a hero who is not yours
  // is known by reputation, not by an exact skill level. Three bands across levels 1–9. 2026-09-13:
  // both now delegate to the module-level helpers, so the Intelligence report, the Hire dropdown
  // and the Broker dropdown cannot describe the same hero differently.
  function skillFameLabel(level){ return skillFameLabelM(level); }
  function topSkill(char){ return topSkillOf(char); }

  const intel=[];

  // set of provinces this player spied THIS turn. Details of armies the player does NOT control
  // (neutral guards / enemy forces) are only revealed for provinces they actually spied, making Spy
  // the sole way to learn enemy/neutral force composition.
  const spiedThisTurn=new Set(player._spiedProvincesThisTurn||[]);
  const nearSpied=nearSpiedProvIds(gameState,spiedThisTurn); // D2: seen as if a hero stood there

  // enemy characters a hero may set out to Encounter. Visibility follows the intel rules — an enemy
  // is targetable if they stand in a province you OWN, a province where you have a character
  // (same-province line of sight), or a province you SPIED this turn. A character who moved
  // UNSPOTTED is hidden from passive sightings unless you spied where they now stand; a cloaked
  // (Veil / hidden-item) hero cannot be picked out at all. The Encounter order then chases the
  // quarry wherever they go, so the list need only reflect where they were last seen. Items 1 & 12:
  // the list is exactly the characters the MAP shows (one shared rule, enemyCharVisibleTo). A
  // visible character who still cannot be hunted (Cloak of Many Faces) is carried with
  // `untargetable` so the order form can show WHY instead of silently dropping them.
  const _visCtx={ownedProvIds,ownCharLocs,spiedThisTurn,nearSpied}; // D2: the map's rule, next-to-spied included
  const encounterTargets=gameState.characters
    .filter(c=>c.alive&&c.player!==null&&c.player!==playerIndex&&enemyCharVisibleTo(gameState,playerIndex,c,_visCtx))
    .map(c=>({id:c.id,name:c.name,isKing:!!c.isKing,locationId:c.location,
      locationName:gameState.world.provinces[c.location]?.name||'?',leadsArmy:(c.armies||[]).length>0,
      untargetable:encounterUntargetableReason(c)}));

  // Province-level intelligence (visited non-owned)
  gameState.world.provinces.filter(p=>visitedProvIds.has(p.id)&&!ownedProvIds.has(p.id)).forEach(p=>{
    if(p.owner!==null&&p.owner!==playerIndex) intel.push(`${p.name} (${p.terrain}): controlled by ${gameState.players[p.owner]?.name||'unknown realm'}.`);
    const guardNPC=gameState.characters.find(c=>c.alive&&c.player===null&&c._isNeutralGuard&&c.location===p.id);
    const guardArmies=guardNPC?(guardNPC.armies||[]):(p.neutralDefenders||[]);
    if(guardArmies.length>0){
      const guardLabel=guardNPC?`${guardNPC.name} leads: `:'';
      if(spiedThisTurn.has(p.id)){
        // Spied this turn → full force composition revealed.
        intel.push(`${p.name}: ${guardLabel}${guardArmies.length} neutral defender${guardArmies.length>1?'s':''} — ${guardArmies.map(d=>d.unitName?`${d.unitName} (${d.type}, ${d.quality})`:`${d.quality} ${d.type}`).join(', ')}. 🔍`);
      } else {
        // Not spied → only the count is known; composition is hidden until spied.
        intel.push(`${p.name}: ${guardLabel}${guardArmies.length} neutral defender${guardArmies.length>1?'s':''} (composition unknown — Spy this province to reveal).`);
      }
    }
  });

  // Known features across all visited/owned provinces
  const knownFeatures=[];
  // A discovered feature under one of your OWN characters must appear even when the province is
  // neither owned nor previously-visited (e.g. a Pagan hero standing on a discovered ritual site in
  // unowned land) — otherwise the site shows on the map but not in the report or order forms.
  const _kfOcc=new Set(gameState.characters.filter(c=>c.alive&&c.player===playerIndex).map(c=>c.location));
  gameState.world.provinces.filter(p=>visitedProvIds.has(p.id)||ownedProvIds.has(p.id)||_kfOcc.has(p.id)).forEach(p=>{
    const _rum=((gameState.players||[])[playerIndex]||{})._lairRumours||{};
    (p.features||[]).forEach((f,_fi)=>{
      if(!(featDiscovered(f,playerIndex)||(ownedProvIds.has(p.id)&&!!f.ritualSite))) return;
      knownFeatures.push({province:p.name,name:f.name,cleared:f.cleared,
      rumour:(!f.cleared&&_rum[lairRumourKey(p.id,_fi)])||null,   // hoard learned by Hunting Rumours
      ritualSite:!!f.ritualSite,
      monster:f.ritualSite?'':(f.monster?.name||'unknown guardian'),
      monsterCat:f.ritualSite?'':monsterCatLabel(f.monster),
      monsterPower:(f.monster&&f.monster.power)||f.tier||'',
      isOwned:ownedProvIds.has(p.id)});
    });
  });

  // Provinces visible to this player: owned OR containing one of their characters
  // (declared here — used by dead-hero, mercenary, and hero-sighting intel below)
  const playerCharLocations=new Set(gameState.characters.filter(c=>c.player===playerIndex&&c.alive).map(c=>c.location));
  // a province you SPIED this turn counts as seen at END OF TURN, exactly as if you had a character
  // standing in it — your agent is still there when the season closes and reports what he finds.
  // Without this a successful Spy revealed force composition in the intel text but the hex itself
  // stayed on the border/remembered tier, which draws NO characters — so the enemy and neutral
  // heroes your spy had just walked among were missing from the map and the hero lists.
  const visibleProvIds=new Set([...ownedProvIds,...playerCharLocations,...spiedThisTurn]);

  // Dead heroes visible to this player — in provinces they own or have a character in Dead heroes
  // visible this turn:
  // - Own dead heroes always visible
  // - Others only if: this player saw them die this turn (seenDeadHeroIds)
  // OR had a spy/explore in that province this turn
  const seenThisTurn=new Set(gameState.players[playerIndex]?.seenDeadHeroIds||[]);
  const knownEver=new Set(gameState.players[playerIndex]?.knownDeadHeroIds||[]);
  const visibleDeadHeroes=(gameState.heroGraveyard||[]).filter(g=>{
    if(g.player===playerIndex) return true; // always see own dead heroes
    if(seenThisTurn.has(g.id)) return true;  // witnessed the fall this turn
    // also list a fallen hero whose body lies in a province this player can see right now — you
    // know they are there because you have eyes on the ground.
    if(g.location!=null && visibleProvIds.has(g.location)) return true;
    return false;
  }).map(g=>({id:g.id,name:g.name,player:g.player,killedOnTurn:g.killedOnTurn,
    race:g.race||null, alignment:g.alignment||null, topSkill:topSkill(g), // the fallen keep their fame
    locationName:gameState.world.provinces[g.location]?.name||'unknown',
    locationId:g.location,
    isOwn:g.player===playerIndex,
    isKing:!!g.isKing,
    // 2026-09-27 (Toby item 10): the realm that held this hero WHEN THEY FELL (null = neutral), and
    // whether that puts them beyond this realm's Resurrect. `player` was already on the graveyard
    // record and on the Resurrect dropdown's own list; it simply never reached the map tooltip or the
    // Fallen Heroes card, so a player could not tell whose body they were looking at.
    servedOther:graveServedOther(g,playerIndex),
    inVisibleProv:visibleProvIds.has(g.location)}));
  // Dead heroes this player knows of (for Resurrect targeting). 2026-09-12: the list and the MAP
  // must never disagree again. Anything the map shows as a body (visibleDeadHeroes) is listed here
  // too; entries the rules forbid raising carry raisable:false and a plain-language `whyNot`, and
  // the portal renders them greyed with the reason. Silently omitting them is what produced "I can
  // see him but he isn't in the dropdown". Inclusion = the map's rule (own / witnessed / body in a
  // province you own or stand in) PLUS every grave you have ever known of, since the engine
  // (`_graveKnown`) still lets you march back to it.
  const _mapVisibleIds=new Set(visibleDeadHeroes.map(g=>g.id));
  const knownDeadHeroes=(gameState.heroGraveyard||[])
    .filter(g=>g && (g.player===playerIndex||knownEver.has(g.id)||seenThisTurn.has(g.id)
      ||(g.location!=null&&visibleProvIds.has(g.location))||_mapVisibleIds.has(g.id)))
    .map(g=>{
      const locId=g.location; // a monarch's resting place is fixed at death (see monarchRestProvId)
      // Why this body may or may not be raised — mirrors the guards in `white_resurrect` exactly.
      let raisable=true, whyNot='';
      if(g._monarch){
        if(g.player!==playerIndex){ raisable=false; whyNot='a fallen crown answers only to its own realm'; }
        else if((gameState.players[playerIndex]||{})._resurrectableMonarchId!==g.id){ raisable=false; whyNot='passed beyond recall — only your most recently fallen monarch may be restored'; }
      } else if(g.isKing){ raisable=false; whyNot='kings cannot be resurrected'; }
      else if(graveServedOther(g,playerIndex)){ raisable=false; whyNot='once served another realm — only heroes who never served a rival crown may be raised'; }
      return {id:g.id,name:g.name,killedOnTurn:g.killedOnTurn,race:g.race||null,
      skills:g.skills||{},alignment:g.alignment||'Neutral',temper:g.temper||'Brave',locationId:locId,
      locationName:gameState.world.provinces[locId]?.name||'unknown',
      isMonarch:g._monarch===true,
      isKing:!!g.isKing,
      raisable, whyNot,
      player:(g.player!=null?g.player:null), // the realm the body served, so the form can name it
      wasOwnHero:g.player===playerIndex};
    });

  // Mercenary sightings — visible if in owned province or where player has a character
  const mercIntel=[];
  (gameState.mercenaries||[]).forEach(merc=>{
    if(!visibleProvIds.has(merc.location)) return;
    const p2=gameState.world.provinces[merc.location];
    mercIntel.push({
      id:merc.id,type:merc.type,quality:merc.quality,unitName:merc.unitName,
      race:merc.race||null,
      // Hire price, so the Recruit Armies order form can list mercenaries beside native units.
      // Neutral realms get 1g off (min 1g) — mirrored from the recruit handler.
      cost:Math.max(1,(ARMY_COST_MASTER[merc.type]||2)-(player&&player.alignment==='Neutral'?2:0)+(player?discSumOf(player,'merc','delta',e=>!e.cls||discUnitIs(e.cls,merc.type,true)):0)), // + merc discoveries
      location:p2?.name||'unknown',locationId:merc.location,isSea:merc.isSea,
    });
  });

  // Hero sightings — all wandering and enemy heroes visible to this player Visible if in an owned
  // province OR in a province where one of this player's characters is present

  const heroSightings=[];
  // persisted spy intel on non-own heroes: full skill sets learned via a Spy (or Clairvoyance) at
  // some point, refreshed on each new spy. Keyed by hero id.
  const spiedHeroSkills=(player&&player._spiedHeroSkills)||{};
  const fmtSkills=(sk)=>Object.entries(sk||{}).filter(([,v])=>v>0)
    .sort((a,b)=>b[1]-a[1]||ALL_SKILLS.indexOf(a[0])-ALL_SKILLS.indexOf(b[0]))
    .map(([k,v])=>`${SKILL_LABELS[k]||k} ${v}`).join(', ');
  // a co-located enemy/neutral hero gives away only a ROUGH idea of how many armies they lead (a
  // glance across the field, not a muster roll). Spying still reveals exact units.
  const _armyBand=(n)=>'leads '+armySizeBand(n);
  gameState.characters.filter(c=>c.alive&&c.player!==playerIndex).forEach(c=>{
    const inOwned=ownedProvIds.has(c.location);
    // Items 1 & 12: same rule as the map and the Encounter list (enemyCharVisibleTo).
    if(!enemyCharVisibleTo(gameState,playerIndex,c,{ownedProvIds,ownCharLocs:playerCharLocations,spiedThisTurn,nearSpied})) return;
    const prov=gameState.world.provinces[c.location];
    if(!prov) return;
    const ts=topSkill(c);
    const topStr=ts?`${skillFameLabel(ts.level)} ${SKILL_LABELS[ts.skill]||ts.skill}`:'no notable skills';
    // If this hero has been spied, we know their FULL skill list (as of the spy).
    const spyRec=spiedHeroSkills[c.id];
    const spiedSkills=spyRec?spyRec.skills:null;
    const spiedSkillStr=spiedSkills?fmtSkills(spiedSkills):null;
    const skillDisplay=spiedSkillStr?`known skills (spied turn ${spyRec.turn}): ${spiedSkillStr}`:topStr;
    // The sighting text puts this straight after a full stop, so give it a capital.
    const skillSentence=skillDisplay.charAt(0).toUpperCase()+skillDisplay.slice(1);
    if(c.player===null){
      // Wandering/neutral hero. the hire cost is the alignment-distance wage for THIS realm (2g
      // base +1g per two steps of alignment distance) — the same figure the hire order actually
      // charges — NOT the hero's stale internal `pay` field (which is a spawn artefact and always
      // reads ~1g). A null wage means the Divine<->Undead gulf: they will not serve this crown (the
      // sd31 waiver, if the realm holds it, is applied at the real hire). Guards keep their beast
      // label; a defeated guard now wandering (player===null, not a guard) shows a proper race (see
      // runTurn normaliser).
      const _wWage=c._isNeutralGuard?null:heroHireWage(player?.alignment||'Neutral', c.alignment, (player?.discoveries||[]).some(d=>d&&d.id==='sd31'), c); // 2026-10-08 item 12: sd31 waives the gulf, exactly as the hire does
      const _wHireTxt=c._isNeutralGuard?'':(_wWage!=null?` Available to hire for ${_wWage}g/turn.`:' Will not serve your crown — the alignment gulf is too wide.');
      heroSightings.push({
        type:c._isNeutralGuard?'neutral_guard':'wandering',
        name:c.name,race:c.race,alignment:c.alignment,temper:c.temper,
        locationName:prov.name,locationId:c.location,
        topSkill:ts,pay:_wWage,
        armyBand:_armyBand((c.armies||[]).length),
        spiedSkills:spiedSkills||null, spiedTurn:spyRec?spyRec.turn:null,
        spiedItems:(spyRec&&spyRec.items)||null, spiedArmies:(spyRec&&spyRec.armies)||null,
        inOwnedProvince:inOwned,
        text:`Wandering hero ${c.name} (${c.race}, ${c.alignment}) is in ${prov.name}. ${skillSentence}.${_wHireTxt}`,
      });
    } else {
      // Another realm's hero. 2026-10-15 (Toby, D1): without a Spy you learn only the name, the
      // realm and the rough size of the army they lead, wherever they stand (your own land too): no
      // race, alignment or renown. What a Spy has read (spiedSkills) is still shown.
      const enemyKingdom=gameState.players[c.player]?.name||'unknown realm';
      const _band=_armyBand((c.armies||[]).length);
      heroSightings.push({
        type:'enemy',
        name:c.name,kingdom:enemyKingdom,kingdomColor:gameState.players[c.player]?.color||null,
        locationName:prov.name,locationId:c.location,
        armyBand:_band,
        spiedSkills:spiedSkills||null, spiedTurn:spyRec?spyRec.turn:null,
        spiedItems:(spyRec&&spyRec.items)||null, spiedArmies:(spyRec&&spyRec.armies)||null,
        inOwnedProvince:inOwned,
        text:`${c.name} of ${enemyKingdom} is in ${inOwned?'your province of ':''}${prov.name}, and ${_band}.${spiedSkillStr?` Known skills (spied turn ${spyRec.turn}): ${spiedSkillStr}.`:''}`,
      });
    }
  });

  // Also add intel text entries for the chronicle
  heroSightings.forEach(s=>intel.push(s.text));

  // ── tiered map visibility (last-seen fog of war) ──
  const mem=(player&&player._provMemory)||{};
  // Provinces adjacent to a province this player OWNS. Their core info and CURRENT ownership are
  // always visible — you watch your own borders continuously all turn.
  const ownedAdjacentIds=new Set();
  provinces.forEach(p=>{
    if(!ownedProvIds.has(p.id)) return;
    const offs=p.row%2===0?offsets_even:offsets_odd;
    offs.forEach(([dr,dc])=>{
      const nr=p.row+dr; if(nr<0||nr>=rows) return;
      const nc=((p.col+dc)%cols+cols)%cols;
      const nid=nr*cols+nc;
      if(!ownedProvIds.has(nid)) ownedAdjacentIds.add(nid);
    });
  });

  // the character this realm watches with Clairvoyance is drawn wherever they end the turn —
  // including border and remembered hexes (which otherwise never show characters) and a never-seen
  // hex.
  const _clairId=(player&&player._clairCharThisTurn!=null)?player._clairCharThisTurn:null;
  const _clairChar=(_clairId!=null)?(gameState.characters||[]).find(x=>x&&x.id===_clairId&&x.alive&&x.player!==playerIndex):null;
  const _clairLoc=_clairChar?_clairChar.location:null;
  // World meta — full hex grid with visibility-appropriate data for map rendering
  const worldMeta={
    cols,rows,
    centreCol:mapCentreColFor(gameState,playerIndex),
    provinces:provinces.map(p=>{
      // Compute neighbour IDs for the map renderer
      const offsets=p.row%2===0?offsets_even:offsets_odd;
      const neighbors=offsets.map(([dr,dc])=>{
        const nr=p.row+dr; if(nr<0||nr>=rows) return null;
        const nc=((p.col+dc)%cols+cols)%cols;
        return nr*cols+nc;
      }).filter(n=>n!==null);

      const isOwned=ownedProvIds.has(p.id);
      // a spied province is drawn at the LIVE tier — full current info and line-of-sight
      // characters. liveChars() still filters every non-own character through enemyCharVisibleTo,
      // which already treats a deliberate Spy as piercing stealth, so this changes WHICH HEXES draw
      // characters, never WHO is visible within one.
      const isLive=!isOwned && (ownCharLocs.has(p.id)||spiedThisTurn.has(p.id)); // character here now, or spied this turn
      const isBorder=!isOwned && !isLive && ownedAdjacentIds.has(p.id);  // adjacent to your own land
      const memo=mem[p.id];
      // Illusory Terrain: enemies of the caster see a false terrain until they enter or it fades.
      const _apparentTerrain=(p._illusoryTerrain && p._illusoryTerrain.caster!==playerIndex) ? p._illusoryTerrain.fake : p.terrain;
      const explored=(p.exploredBy&&p.exploredBy[playerIndex])||0;
      // does THIS player lead an army here right now? Computed straight from character locations
      // (c.location), so the field-banner never depends on prov.characters staying in sync — a king
      // or hero leading troops always flies a flag wherever they actually stand.
      const _ownArmyHere=(gameState.characters||[]).some(c=>c&&c.alive&&c.player===playerIndex&&c.location===p.id&&(c.armies||[]).length>0);
      // Live-visible characters here: own characters always; enemy/neutral only where this player
      // currently has a character present. Enemy units/characters are NEVER shown as "last seen" —
      // only when visible at the end of the turn (line of sight).
      const liveChars=()=>(p.characters||[]).map(cid=>{
        const c=gameState.characters[cid];
        if(!c||!c.alive) return null;
        const isOwn=c.player===playerIndex;
        // The only thing that still hides them is moving in UNSEEN (below).
        const coLoc=ownCharLocs.has(p.id), ownHere=ownedProvIds.has(p.id);
        // Line of sight: a non-own character is visible only where you have a character
        // (co-location) or you OWN the province (your garrison/subjects report anyone in your
        // land). Items 1 & 12: the map, the hero lists and the Encounter target list all use the
        // ONE rule in enemyCharVisibleTo (line of sight, Invisibility, Spy pierce, Spy-contest in
        // owned land, flat unspotted cloak elsewhere).
        if(!isOwn && !enemyCharVisibleTo(gameState,playerIndex,c,{ownedProvIds,ownCharLocs,spiedThisTurn,nearSpied})) return null;
        void coLoc; void ownHere;
        return{id:c.id,name:c.name,isOwn,isKing:c.isKing,
          isWanderer:c.player===null,
          // A neutral character is either the sworn guardian of this province ("local chieftain")
          // or a masterless hero passing through ("wandering"). The portal needs the distinction to
          // label them correctly — they are otherwise indistinguishable client-side.
          isNeutralGuard:!!c._isNeutralGuard,
          ownerName:c.player!=null&&!isOwn?(gameState.players[c.player]?.name||null):null,
          // 2026-10-15 (Toby, D1): your own hero's exact count; anyone else's rough size only
          ...(isOwn?{armyCount:(c.armies||[]).length}:{armyBand:armySizeBand((c.armies||[]).length)}),
          ownerColor:c.player!==null?gameState.players[c.player]?.color:null};
      }).filter(Boolean);
      const _clairCharsHere=()=>(_clairChar&&p.id===_clairLoc)?[{id:_clairChar.id,name:_clairChar.name,isOwn:false,isKing:_clairChar.isKing,
        isWanderer:_clairChar.player===null,isNeutralGuard:!!_clairChar._isNeutralGuard,
        ownerName:_clairChar.player!=null?(gameState.players[_clairChar.player]?.name||null):null,
        armyBand:armySizeBand((_clairChar.armies||[]).length),ownerColor:_clairChar.player!==null?gameState.players[_clairChar.player]?.color:null,clairvoyant:true}]:[];

      if(isOwned){
        // Full live info — your own province.
        return{id:p.id,row:p.row,col:p.col,name:p.name,terrain:p.terrain,tier:'owned',
          isHomeCapitalOfOwner:(p.owner!=null&&homeProvinceIdFor(gameState,p.owner)===p.id), // Grand Heist needs to know a capital when it sees one
          tax:p.tax,wealth:p.tax>=7?'Rich':p.tax>=4?'Prosperous':'Poor', ownArmyHere:_ownArmyHere,
          consecrated:isConsecrated(gameState.players[playerIndex],p.id), // DIVINE — Consecrate: mark the realm's holy ground so the player can confirm it is active
          hadBattle:!!p._hadBattleThisTurn, hadCombat:(p._combatPlayersThisTurn||[]).includes(playerIndex), battleUnresolved:!!p._battleUnresolved, /* item 14 */
          race:p.race,owner:p.owner,ownerName:p.owner!==null?gameState.players[p.owner]?.name:null,ownerColor:p.owner!==null?gameState.players[p.owner]?.color:null,
          armyTypes:p.armyTypes,neighbors,explored,
          features:(p.features||[]).filter(f=>featDiscovered(f,playerIndex)).map(f=>({name:f.name,cleared:!!f.cleared,ritualSite:!!f.ritualSite,power:((f.monster&&f.monster.power)||'')})),
          grandDesign:(p.grandDesign?{name:p.grandDesign.name,ownerName:(gameState.players[p.grandDesign.owner]||{}).name||null,active:gdActiveFor(gameState,p.grandDesign.owner)}:null), // a Wonder of the age is visible to anyone who can see the province
          characters:liveChars(), ownArmyHere:_ownArmyHere,
        };
      } else if(isLive){
        // You have a character standing here right now — full current info + line-of-sight
        // characters.
        return{id:p.id,row:p.row,col:p.col,name:p.name,terrain:_apparentTerrain,tier:'live',race:p.race,
          isHomeCapitalOfOwner:(p.owner!=null&&homeProvinceIdFor(gameState,p.owner)===p.id), // Grand Heist eligibility
          wealth:p.tax>=7?'Rich':p.tax>=4?'Prosperous':'Poor',
          consecrated:provinceConsecrated(gameState,p), // holy ground is visible to anyone who can see the province
          owner:p.owner,ownerName:p.owner!==null?gameState.players[p.owner]?.name:null,ownerColor:p.owner!==null?gameState.players[p.owner]?.color:null,
          armyTypes:p.armyTypes,neighbors,explored,hadBattle:!!p._hadBattleThisTurn, hadCombat:(p._combatPlayersThisTurn||[]).includes(playerIndex), battleUnresolved:!!p._battleUnresolved, /* item 14 */
          features:(p.features||[]).filter(f=>featDiscovered(f,playerIndex)).map(f=>({name:f.name,cleared:!!f.cleared,ritualSite:!!f.ritualSite,power:((f.monster&&f.monster.power)||'')})),
          grandDesign:(p.grandDesign?{name:p.grandDesign.name,ownerName:(gameState.players[p.grandDesign.owner]||{}).name||null,active:gdActiveFor(gameState,p.grandDesign.owner)}:null), // a Wonder of the age is visible to anyone who can see the province
          characters:liveChars(), ownArmyHere:_ownArmyHere,
          // a character standing here sees the standing garrison, whoever owns it — the map pop-up
          // reports how many units are garrisoned (type and quality only).
          garrisonArmies:(p.garrisonArmies||[]).map(a=>({type:a.type,quality:a.quality,unitName:a.unitName||''})),
        };
      } else if(isBorder){
        // Adjacent to your land: current core info + CURRENT ownership. No enemy units/characters.
        return{id:p.id,row:p.row,col:p.col,name:p.name,terrain:_apparentTerrain,tier:'border',race:p.race,
          isHomeCapitalOfOwner:(p.owner!=null&&homeProvinceIdFor(gameState,p.owner)===p.id), // crown marker
          wealth:p.tax>=7?'Rich':p.tax>=4?'Prosperous':'Poor',
          consecrated:provinceConsecrated(gameState,p), // holy ground is visible to anyone who can see the province
          owner:p.owner,ownerName:p.owner!==null?gameState.players[p.owner]?.name:null,ownerColor:p.owner!==null?gameState.players[p.owner]?.color:null,
          armyTypes:p.armyTypes,neighbors,explored,hadBattle:!!p._hadBattleThisTurn, hadCombat:(p._combatPlayersThisTurn||[]).includes(playerIndex), battleUnresolved:!!p._battleUnresolved, /* item 14 */
          features:(p.features||[]).filter(f=>featDiscovered(f,playerIndex)).map(f=>({name:f.name,cleared:!!f.cleared,ritualSite:!!f.ritualSite,power:((f.monster&&f.monster.power)||'')})),
          grandDesign:(p.grandDesign?{name:p.grandDesign.name,ownerName:(gameState.players[p.grandDesign.owner]||{}).name||null,active:gdActiveFor(gameState,p.grandDesign.owner)}:null), // a Wonder of the age is visible to anyone who can see the province
          characters:nearSpied.has(p.id)?liveChars():_clairCharsHere(), ownArmyHere:_ownArmyHere, // D2: next to a spied province
        };
      } else if(memo){
        // Remembered: frozen at the last phase one of your characters could see it. Core info and
        // ownership are as last observed (may be out of date); no live units/characters shown.
        return{id:p.id,row:p.row,col:p.col,name:memo.name,terrain:memo.terrain,tier:'remembered',race:memo.race,
          wealth:memo.tax>=7?'Rich':memo.tax>=4?'Prosperous':'Poor',
          owner:memo.owner,ownerName:memo.ownerName??null,ownerColor:memo.ownerColor??null,
          armyTypes:memo.armyTypes||[],neighbors,explored,seenTurn:memo.turn,
          isHomeCapitalOfOwner:!!memo.isHomeCapitalOfOwner, // crown marker, as it stood when last observed
          // hadCombat is NOT sent on the remembered tier. All three sword markers — red (battle),
          // orange (battle still raging) and purple (personal combat) — now share exactly one
          // visibility rule: owned, live or border.
          features:memo.features||[],
          characters:nearSpied.has(p.id)?liveChars():_clairCharsHere(), ownArmyHere:_ownArmyHere, // D2: next to a spied province
        };
      } else {
        // Unknown — just the grid position so we can draw an empty hex.
        // 2026-10-15 (D2): next to a spied province, the characters there are seen as if a hero stood
        // there, so the hex is drawn as the Clairvoyant's is, with the ground as it now stands.
        const _nearChars=nearSpied.has(p.id)?liveChars():[];
        if(_nearChars.length){
          return{id:p.id,row:p.row,col:p.col,name:p.name,terrain:_apparentTerrain,tier:'remembered',race:p.race,
            wealth:p.tax>=7?'Rich':p.tax>=4?'Prosperous':'Poor',owner:p.owner,ownerName:p.owner!==null?gameState.players[p.owner]?.name:null,
            ownerColor:p.owner!==null?gameState.players[p.owner]?.color:null,armyTypes:p.armyTypes||[],neighbors,explored,seenTurn:gameState.turn,
            isHomeCapitalOfOwner:(p.owner!=null&&homeProvinceIdFor(gameState,p.owner)===p.id),
            features:[],characters:_nearChars,ownArmyHere:_ownArmyHere};
        }
        if(_clairChar&&p.id===_clairLoc){
          // Never seen by this realm, but the Clairvoyant sees through the watched character's
          // eyes.
          return{id:p.id,row:p.row,col:p.col,name:p.name,terrain:_apparentTerrain,tier:'remembered',race:p.race,
            wealth:p.tax>=7?'Rich':p.tax>=4?'Prosperous':'Poor',owner:p.owner,ownerName:p.owner!==null?gameState.players[p.owner]?.name:null,
            ownerColor:p.owner!==null?gameState.players[p.owner]?.color:null,armyTypes:p.armyTypes||[],neighbors,explored,seenTurn:gameState.turn,
            isHomeCapitalOfOwner:(p.owner!=null&&homeProvinceIdFor(gameState,p.owner)===p.id), // crown marker
            features:[],characters:_clairCharsHere(),ownArmyHere:_ownArmyHere};
        }
        return{id:p.id,row:p.row,col:p.col,terrain:null,tier:'unknown',neighbors};
      }
    }),
  };

  // Tax Income forecast — mirror the end-of-turn tax-collection engine so the player sees an
  // accurate projection of what they'll actually collect. We include every PERSISTENT modifier the
  // engine applies (discovery bonuses sd11/sd15/sd18, Ring of Wealth, Merchant's Ledger, Merchant
  // Guilds interest sd12, Neutral trade bonus, and any lingering _earthquakeTax reduction). We
  // deliberately do NOT fold in the two SAME-TURN transient effects (Bless Province / Earthquake
  // no-tax), since those depend on orders not yet given this turn and can't be forecast at turn
  // start.
  const hasDiscR=(id)=>(player.discoveries||[]).some(d=>d.id===id);
  // track each income modifier separately so the Tax Income box can itemise WHAT is lifting
  // (or cutting) the realm's revenue — mirroring the end-of-turn collection engine.
  let _sdAgri=0,_sdMining=0,_sdAqueduct=0,_sdGrand=0,_eqReduction=0,_sdCreed=0,_enslaveReduction=0,_consecG=0,_sdRecords=0;
  let _rawTaxBase=0;
  // 2026-09-09. The box is a NEXT-turn projection and had drifted from the collector: it ignored
  // the Enslave resentment (-1 tax for 3 turns, persistent) and every heritage / creed `tax` and
  // `interest` discovery. Any base difference shifts the floor(base x 20%) Neutral bonus by a gold
  // too. All of those are persistent, so they belong in the forecast; the deliberate omissions are
  // still only the SAME-TURN transients (Bless, Consecrate, Earthquake no-tax, Sabotage). Keep this
  // loop and the end-of-turn collector in step.
  const _taxAccR=new Map(); // per-effect gold paid so far (capped `tax` discoveries)
  // the 5%-of-base ceiling every tax-gold source shares. Base = the bare province tax of the land
  // held now, before any bonus or penalty — computed up front so the loop below can cap as it goes.
  const _baseTaxR=realmBaseTax(gameState,playerIndex), _taxCapR=taxBonusCap(_baseTaxR);
  const _nextTurn=(gameState.turn||0); // reports are built AFTER the turn counter advances, so gameState.turn is already the turn whose end-of-turn collection this forecasts
  const provTaxIncome=(player.provinces||[]).reduce((s,pid)=>{
    const pv=gameState.world.provinces[pid]; if(!pv) return s;
    let t=pv.tax||0; _rawTaxBase+=t; // the bare province tax, before any bonus or penalty
    // Consecrate is PERSISTENT (player.consecratedProvIds — broken only when the province changes
    // hands), not a one-turn effect, so it belongs in the forecast. Same position and rounding as
    // the collector: after Bless (a transient we still skip), before Enslave / earthquake damage.
    if(isConsecrated(player,pv.id)){ const _cb=t; t=Math.round(t*1.5); _consecG+=(t-_cb); }
    if(pv._enslavedUntil!=null&&pv._enslavedUntil>=_nextTurn){ const _e0=t; t=Math.max(0,t-1); _enslaveReduction+=(_e0-t); } // EVIL — Enslave resentment
    const _t0=t;
    if(pv._earthquakeTax) t=Math.max(0,t-(pv._earthquakeTax||0)); // lingering earthquake damage
    _eqReduction+=(_t0-t);                                        // gold lost to earthquakes (positive)
    // every province-tax discovery (Advanced Agriculture, Mining, Aqueducts … heritage & creed) now
    // runs through discTaxAdd, capped exactly as the collector caps it.
    { const _dt=discTaxAdd(player,pv,gameState,playerIndex,_taxAccR,_taxCapR); t+=_dt; _sdCreed+=_dt; }
    if(gdActiveFor(gameState,playerIndex,'Good')&&(pv.garrisonArmies||[]).length>0){ t+=2; _sdGrand+=2; } // GRAND DESIGN — Good: +2 tax per garrisoned province (only while the Wonder's province is held)
    return s+t;
  },0);
  const _pChars=(gameState.characters||[]).filter(c=>c.player===playerIndex&&c.alive);
  const _itemStat=(st)=>_pChars.reduce((s,c)=>s+(activeItems(c).reduce((a,it)=>a+(it.effect&&it.effect.stat===st?it.effect.bonus:0),0)),0);
  // item tax gold (Ring of Wealth & co, Merchant's Ledger) — together capped at 5% of base tax
  const _taxBonusRaw=_pChars.reduce((s,c)=>s+(c.taxBonus||0),0)+_itemStat('taxBonus');
  const ledgers=_pChars.some(c=>activeItems(c).some(it=>it.effect&&it.effect.stat==='taxPerProv'));
  const _perProvRaw=ledgers?(gameState.world.provinces||[]).filter(pv=>pv.owner===playerIndex).length:0; // Merchant's Ledger
  const _itemTaxR=capItemTaxGold(_taxBonusRaw,_perProvRaw,_taxCapR);
  const taxBonus=_itemTaxR.taxBonus, perProvBonus=_itemTaxR.perProvBonus;
  const interestBonus=discEffectsOf(player,'interest').reduce((s2,e)=>s2+Math.min(_taxCapR,Math.floor((player.gold||0)*(e.pct||0))),0); // Merchant Guilds + creed interest discoveries (as collected)
  _sdRecords=hasDiscR('sd14')?taxRecordsGold(provTaxIncome,_taxCapR):0; // sd14 Taxation Records — keep in step with the collector
  const neutralTradeBonus=neutralTradeGold(player,provTaxIncome);
  // title perks that add tax-season gold (mirrors the end-of-turn collection). computeStandings /
  // computeMinorTitles are module-level and already used above, so the report builder can read the
  // live holders without runTurn's G-scoped helpers. Each perk is tracked separately for
  // itemisation. 2026-09-17: `throneG` / `vaultG` REMOVED. The Throne and the Vaultkeeper once paid
  // tax-season gold; when they became pure intel titles the payout was dropped but the two
  // variables were left behind, declared at 0 and never assigned. They were still summed into
  // titlePerkGold, still shipped in the report, and still itemised by the player portal — two
  // income lines that could never print. Gone, along with their report fields.
  let cutpurseG=0,championG=0,castellanG=0,_hostLeaderChar=null;
  try{
    if(!_titlesPublic) throw 'titles-hidden'; // Item: title perks (incl. their tax gold) take effect only once Titles are revealed at turn 5 — matching the gated end-of-turn collection.
    const _std=(computeStandings(gameState).titles)||{};
    const _min=(computeMinorTitles(gameState))||{};
    const _holdsTitle=(key)=>!!(_std[key]&&_std[key].playerIndex===playerIndex);
    const _charHasMinor=(key)=>!!(_min[key]&&_pChars.some(c=>c.id===_min[key].charId));
    if(_charHasMinor('cutpurse')) cutpurseG=2;
    if(_charHasMinor('champion')) championG=2;
    if(_charHasMinor('castellan')){ const _owned=(gameState.world.provinces||[]).filter(pv=>pv.owner===playerIndex).length; castellanG=Math.floor(_owned/5); }
    if(_charHasMinor('hostleader')) _hostLeaderChar=_pChars.find(c=>c.id===_min.hostleader.charId)||null; // wage forecast mirror
  }catch(e){}
  const titlePerkGold=cutpurseG+championG+castellanG;
  const baseTaxIncome=provTaxIncome; // province tax after persistent modifiers (before the flat bonuses)
  const thiefStipend=_pChars.reduce((sm,ch)=>sm+(perkTier(ch,'thief')>0?5:0),0); // THIEF L6: +5g income per Thief-6 character
  const taxIncome=provTaxIncome+taxBonus+perProvBonus+interestBonus+neutralTradeBonus+_sdRecords+titlePerkGold+thiefStipend;
  // Tax Income box ledger: bare base, then one line per SOURCE. Every Sage discovery that pays gold
  // (Agriculture, Mining, Aqueducts, Taxation Records, Merchant Guilds interest, heritage / creed tax
  // and interest discoveries) is rolled into ONE total. Must satisfy
  // rawTaxBase + bonuses − reductions === taxIncome (asserted by the tax ledger test).
  const sageDiscG=_sdAgri+_sdMining+_sdAqueduct+_sdCreed+_sdRecords+interestBonus;
  const ARMY_COST_TR=ARMY_COST_MASTER; // alias → master table at top of script
  const playerCharsForWages=gameState.characters.filter(c=>c.player===playerIndex&&c.alive);
  const allArmiesForWages=playerCharsForWages.flatMap(c=>c.armies||[]);
  const garrisonArmiesForWages=gameState.world.provinces.filter(p=>p.owner===playerIndex).flatMap(p=>p.garrisonArmies||[]);
  // Build structured data for order dropdowns availableHeroes: per province, wandering heroes
  // visible to this player
  const availableHeroesByProv={};
  gameState.world.provinces.forEach(p=>{
    // use the SAME visibility rule as the map / Wandering Heroes sightings — a province you OWN or
    // where one of your characters stands right now, and never a hero who moved unspotted /
    // invisible this turn.
    const provHeroes=gameState.characters.filter(c=>
      c.player===null && c.alive && c.location===p.id && !c._isNeutralGuard && !c._justDefeated &&
      enemyCharVisibleTo(gameState,playerIndex,c,{ownedProvIds,ownCharLocs:playerCharLocations,spiedThisTurn}) // Items 1 & 12: one rule
    );
    if(provHeroes.length>0){
      availableHeroesByProv[p.id]=provHeroes.map(h=>({
        id:h.id, name:h.name, race:h.race, alignment:h.alignment, temper:h.temper,
        topSkill:topSkill(h), pay:h.pay||1, // 2026-09-24 (Toby item 8): fame only — the full skill list no longer ships, so the order form cannot leak it
        // 2026-10-08 (Toby item 12): what hiring this hero will actually cost THIS realm — alignment
        // distance AND the skill premium, with sd31's waiver — the same figure the Wandering Heroes
        // report quotes and the hire charges. null: will not serve this crown. The order form used to
        // work the price out from alignment alone, so it quoted less than the report for any hero
        // who had grown while wandering.
        hireWage:heroHireWage(player?.alignment||'Neutral', h.alignment, (player?.discoveries||[]).some(d=>d&&d.id==='sd31'), h),
        locationId:p.id, locationName:p.name,
      }));
    }
  });

  // provinceOrderData: per-province data needed for order dropdowns
  const provinceOrderData={};
  // also expose provinces ADJACENT to owned/visited ones — the map already shows these neighbours
  // and their recruitable units, so a player may queue a conditional recruit that only fires if
  // they capture the province this turn. canRecruit stays false until owned.
  gameState.world.provinces.filter(p=>ownedProvIds.has(p.id)||visitedProvIds.has(p.id)||adjacentProvIds.has(p.id)||playerCharLocations.has(p.id)).forEach(p=>{
    const ARMY_COST_OD=ARMY_COST_MASTER; // alias → master table at top of script
    const isOwned=ownedProvIds.has(p.id);
    const isVisited=visitedProvIds.has(p.id);
    const isAdjacent=adjacentProvIds.has(p.id);
    const isHome=isOwned&&homeFounderOf(gameState,p.id)===playerIndex; // 2026-09-24 (Toby item 10): the FOUNDER's own capital, still held — a captured rival seat is not 'home'
    provinceOrderData[p.id]={
      name:p.name, terrain:p.terrain, race:p.race, tax:p.tax,
      isOwned, isVisited, isAdjacent, isHome,
      // the Explore order note reads pd.explored, but this builder never emitted it — so the orders
      // section always showed "0% mapped" while the map pop-up
      // (worldMeta, which DOES carry it) showed the true figure. Same per-player source as the map:
      // exploredBy[playerIndex], never the legacy shared p.explored (that holds whichever player
      // explored the province most recently, so it leaks/misreports across realms).
      explored:(p.exploredBy&&p.exploredBy[playerIndex])||0,
      // Rite of the Wild Hunt: resolve the type the ENGINE will bind (first primal type in the
      // province's pool) and its price — the cost of ONE beast — so the player's order form
      // displays exactly what will be charged instead of re-deriving it and drifting.
      wildHuntType:((p.armyTypes||[]).find(t=>PRIMAL_ARMY_DEFS_P[t])||null),
      wildHuntCost:(()=>{ const t=(p.armyTypes||[]).find(x=>PRIMAL_ARMY_DEFS_P[x]); return t?wildHuntPrice(t):null; })(),
      canRecruit:isOwned,
      // Primal sea beasts are only offered where they can actually be summoned: at sea.
      armyTypes:(p.armyTypes||[]).filter(at=>!(PRIMAL_SEA_NAMES.has(at)&&p.terrain!=='sea')).map(at=>({
        type:at, cost:realmRecruitCost((gameState.players||[])[playerIndex],at,ARMY_COST_OD[at]||2), // realm discounts shown in the preview
        maxPerTurn:(twoATurn(at)||isHome)?2:1, // the same gate as getRecruitLimit (garrisons, fleets, Goblin Hordes; two of anything at the founder's capital)
      })),
      features:(()=>{
        const total=(p.features||[]).length;
        const exploredHere=(p.exploredBy&&p.exploredBy[playerIndex])||0;
        return (p.features||[]).map((f,idx)=>({f,idx})).filter(({f,idx})=>{
          if(f.cleared) return false;
          const threshold=total>0?Math.ceil(100/total)*(idx+1):100;
          return featDiscovered(f,playerIndex)||(exploredHere>=threshold)||(isOwned&&!!f.ritualSite);
        }).map(({f,idx})=>({name:f.name,idx,ritualSite:!!f.ritualSite,monsterPower:(f.monster&&f.monster.power)||f.tier||'',monster:(f.monster&&f.monster.name)||'',monsterCat:monsterCatLabel(f.monster)}));
      })(),
      availableHeroes:availableHeroesByProv[p.id]||[],
      // don't leak an ADJACENT enemy province's garrison composition — only owned/visited provinces
      // (which already exposed it) carry garrison detail; adjacent-only entries exist purely to
      // surface recruitable unit TYPES for a conditional recruit.
      garrisonArmies:(isOwned||isVisited)?(p.garrisonArmies||[]).map(a=>({type:a.type,quality:a.quality,unitName:a.unitName||'',race:a.race||null,skeletal:!!a._isSkeletal,wildHunt:(a._wildHuntUntilTurn!=null),wildHuntUntil:(a._wildHuntUntilTurn!=null?a._wildHuntUntilTurn:null)})):[],
    };
  });

  const _druidHalfWageR=new Set();
  playerCharsForWages.forEach(ch=>{ if(perkTier(ch,'druid')>0||gdActiveFor(gameState,playerIndex,'Druidic'))(ch.armies||[]).forEach(a=>{ if(CREATURE_ARMIES.has(a.type)||MONSTER_ARMIES.has(a.type)) _druidHalfWageR.add(a); }); }); // DRUID L6 + GRAND DESIGN Druidic (report mirror)
  const _upkAccR=new Map(); let _discUpkeepR=0; // `upkeep` discoveries (mirrors the collector)
  let armyWages=[...allArmiesForWages,...garrisonArmiesForWages].reduce((s,a)=>{ if(a._temporary||a._wildHuntUntilTurn!=null) return s; /* Wild Hunt beasts serve the old gods, not a paymaster */ if(a._isSkeletal) return s+1; /* skeletons are a flat 1g everywhere */ let w=ARMY_COST_TR[a.type]||2; if(_druidHalfWageR.has(a)) w=Math.max(1,Math.floor(w*0.5)); { const _w0=w; w=discUpkeepWage(player,a,w,_upkAccR,_taxCapR); _discUpkeepR+=_w0-w; } return s+w; },0);
  // 2026-09-09. The forecast skipped three PERSISTENT discounts the collector applies — the
  // Host-Leader minor title (−1g per unit he leads, floor 0 on the total), Granaries sd17 (−1g per
  // hero) and every heritage/creed `heroWage` discovery (−Ng per hero), all with the collector's
  // max(1,…) floor. The only wage effect still left out on purpose is the same-turn Orc war-spoils
  // half-wage (depends on a battle not yet fought). Keep in step with ~17220.
  let hostLeaderG=0;
  if(_hostLeaderChar){ const led=(_hostLeaderChar.armies||[]).filter(a=>!a._temporary&&a._wildHuntUntilTurn==null).length; hostLeaderG=Math.min(armyWages,led); armyWages=Math.max(0,armyWages-led); }
  const _hwAccR=new Map(); // heroWage / heroWageCap discoveries (Granaries, Inspiring Leadership, creeds) — mirrors the collector
  let heroWageDisc=0;
  let heroWages=playerCharsForWages.filter(c=>!c.isKing).reduce((s,h)=>{ const raw=(h.pay||0); const w=discHeroWage(player,h,raw,_hwAccR,_taxCapR); heroWageDisc+=Math.max(0,raw-w); return s+w; },0);
  // 2026-09-10 item 3: when this report follows a resolved turn, "Your Realm" shows the wages the
  // collector ACTUALLY charged (stamped in p._lastWages) — identical to the Realm Events line by
  // construction. The roster-based figures computed above become a "next turn" note only when they
  // differ (e.g. units disbanded for non-payment, escaped units returning, skeleton rises, a new
  // heir on the payroll).
  let nextArmyWages=null, nextHeroWages=null, orcSpoilsG=0;
  { const lw=player._lastWages;
    if(lw && lw.turn===(gameState.turn||1)-1){
      if(lw.armyWages!==armyWages) nextArmyWages=armyWages;
      if(lw.heroWages!==heroWages) nextHeroWages=heroWages;
      armyWages=lw.armyWages; heroWages=lw.heroWages; hostLeaderG=lw.hostLeaderG||0; heroWageDisc=lw.heroWageDisc||0; orcSpoilsG=lw.orcSpoilsG||0;
    } }
  // EVIL sees the Terror (2026-10-12, Toby item 23): every province of the map that Terror grips carries its
  // reading, the realm's own provinces in the report's list too, and a province it has visited but does not hold
  // gets an intel line. No other crown is told.
  if((player&&player.alignment)==='Evil'){
    const _tr=id=>terrorReadingOf(gameState.world.provinces[id], playerIndex);
    (worldMeta.provinces||[]).forEach(r=>{ if(!r) return; const t=_tr(r.id); if(t) r.terror=t; });
    (ownedProvinces||[]).forEach(r=>{ if(!r) return; const t=_tr(r.id); if(t) r.terror=t; });
    gameState.world.provinces.filter(p=>p&&visitedProvIds.has(p.id)&&!ownedProvIds.has(p.id)).forEach(p=>{ const t=_tr(p.id);
      if(t) intel.push(`${p.name}: 💀 Terror ${t.pct}% (${t.stacks} stack${t.stacks!==1?'s':''}${t.byYou?', your own':''}) — its next defenders fight at −${t.pct}%.`); });
  }
  return{
    playerIndex,playerName:player.name,turnNumber:gameState.turn,
    kingdom:{conceded:!!player.conceded,eliminated:!!player._eliminated,gold:player.gold,merits:player.merits,taxIncome,baseTaxIncome,rawTaxBase:_rawTaxBase,sageDiscG,thiefStipend,taxBonus,perProvBonus,taxBonusCapG:_taxCapR,taxBonusCutG:_itemTaxR.cut,interestBonus,neutralTradeBonus,sdAgri:_sdAgri,sdMining:_sdMining,sdAqueduct:_sdAqueduct,sdGrand:_sdGrand,sdCreed:_sdCreed,sdRecords:_sdRecords,enslaveReduction:_enslaveReduction,earthquakeReduction:_eqReduction,cutpurseG,championG,castellanG,consecG:_consecG,hostLeaderG,heroWageDisc,orcSpoilsG,armyWages,heroWages,nextArmyWages,nextHeroWages,alignment:player.alignment,race:player.race,color:player.color},
    exploreDiscMult:Object.fromEntries(['plain','desert','forest','mountain','jungle','sea'].map(t=>[t,discExploreMult(player,t)])), // player portal explore preview
    discoveries:(player.discoveries||[]).map(d=>{ const m=DISC_BY_ID[d.id]; return {id:d.id,name:(m&&m.name)||d.name,category:(m&&m.category)||d.category,desc:(m&&m.desc)||d.desc,turnDiscovered:d.turnDiscovered}; }), // master text wins over the copy stored at discovery time
    // the Research order's category dropdown — every category this realm is eligible for, with how
    // many of its discoveries are already known (the portal greys out exhausted ones). Names and
    // effects of the discoveries themselves are never sent.
    // RESEARCH CHOICE: pairs awaiting the player's pick this turn (names and effects shown — the player found them)
    pendingDiscoveryChoices:(player.pendingDiscoveryChoices||[]).filter(p=>p&&Array.isArray(p.options)).map(p=>({key:p.key,turn:p.turn,charName:p.charName||'',category:p.category||'',options:p.options.map(id=>{ const m=DISC_BY_ID[id]; return m?{id,name:m.name,category:m.category,desc:m.desc}:null; }).filter(Boolean)})),
    researchCategories:(()=>{ const known=new Set((player.discoveries||[]).map(d=>d.id)); discBlockedIds(player).forEach(id=>known.add(id)); const m={}; // forgotten / awaiting-choice discoveries count as spent for the field's tally
      SAGE_DISCOVERIES_P.filter(d=>discEligible(d,player)&&!RESEARCH_HIDDEN_CATS.has(d.category)).forEach(d=>{ const e=m[d.category]||(m[d.category]={name:d.category,total:0,known:0}); e.total++; if(known.has(d.id)) e.known++; }); // hidden fields never listed
      return Object.values(m); })(),
    // Dead heroes — from persistent graveyard (any turn) for Resurrect targeting Any dead hero
    // visible to this player can be resurrected — except (2026-09-23) a body that ever served another realm (graveServedOther)
    deadHeroes:(gameState.heroGraveyard||[]).filter(g=>g.player===playerIndex||(visibleProvIds.has(g.location)&&!g._monarch)).map(g=>{const locId=g.location;return{id:g.id,name:g.name,killedOnTurn:g.killedOnTurn,locationId:locId,isMonarch:g._monarch===true,wasOwnHero:g.player===playerIndex};}),
    characters:charReports,ownedProvinces,intel,
    // the hero arrangement, so the player portal keeps it on a fresh turn even before any draft
    // exists (the orders payload is wiped after every run).
    heroOrder:(Array.isArray(player&&player.heroOrder)?player.heroOrder.map(String):[]),
    // Tasks 1 & 4: colour lookups so the portal can tint EVERY realm name and character name in any
    // report line in the controlling player's colour. Realm names are public; character names are
    // limited to living (or just-fallen) NON-cloaked characters — a Cloak of Many Faces stays
    // anonymous, so nothing hidden leaks — and the portal only visibly tints names that actually
    // appear in the rendered text.
    allKingdoms:(gameState.players||[]).map((p,i)=>({index:i,name:(p&&p.name)||('Realm '+(i+1)),color:(p&&p.color)||null})),
    nameColors:(gameState.characters||[]).filter(c=>c&&c.name&&(c.alive||c.killedThisTurn)&&!(activeItems(c).some(it=>it&&it.effect&&it.effect.stat==='hidden'))).map(c=>({name:c.name,color:(c.player!=null?(gameState.players[c.player]?.color||null):null),neutral:(c.player==null),guard:!!(c.player==null&&c._isNeutralGuard)})), // guard → chieftain-brown tint
    visitedProvinceIds:[...visitedProvIds],
    worldMeta, availableHeroesByProv, provinceOrderData,
    knownFeatures, heroSightings,
    visibleChars, encounterTargets, everSeenChars,
    mercIntel,
    visibleDeadHeroes,
    knownDeadHeroes,
    // every province this realm knows holds battlefield graves, with the turn it was learned.
    // Deliberately stale-tolerant — the graves may since have been raised.
    graveIntel:graveIntelFor(gameState, gameState.players[playerIndex]),
    // guardian weaknesses this realm has learned — by scouting one, or by watching one bite. Keyed
    // by guardian NAME, so the lesson applies to every lair holding that kind.
    knownGuardianWeaknesses:(()=>{
      const known=(player&&player._knownWeak)||{}; const out={};
      MONSTERS_P.forEach(m=>{ if(m&&m.weak&&known[m.name]) out[m.name]={name:m.weak.name,desc:m.weak.desc}; });
      return out;
    })(),
    // ── DIPLOMACY (KC alliance system) ── realms this player has encountered, with the current
    // relation. The portal renders Treat / Declare War controls against this list (king-only).
    diplomacy:(()=>{
      const rels=gameState.relations||{};
      const relOf=(o)=>{ if(o===playerIndex) return 'self'; const k=playerIndex<o?playerIndex+'-'+o:o+'-'+playerIndex; return rels[k]||'neutral'; };
      const enc=(player._encountered||[]);
      return { alliancesAllowed:(gameState.players||[]).length>3, safeStartUntil:(gameState.safeStart?SAFE_START_TURN:null), known: enc.filter(o=>o!==playerIndex&&gameState.players[o]).map(o=>({
        index:o,
        name:gameState.players[o]?.name||('Realm '+(o+1)),
        color:gameState.players[o]?.color||null,
        alignment:gameState.players[o]?.alignment||null,
        // 2026-09-27 (Toby item 7): a realm that has quit the game is no longer a party anyone can
        // treat with. The portal shows the state and withdraws every diplomacy control against it.
        conceded:!!gameState.players[o]?.conceded,
        // 2026-10-08 (Toby item 3c): 'peace' / 'alliance' when this realm sent us an overture last
        // turn (see 6d in runTurn), so the card can show it beside the realm's name.
        offeredUs:(((player._overturesIn||[]).find(x=>x&&x.from===o)||{}).kind)||null,
        concededTurn:gameState.players[o]?.concededTurn||null,
        eliminated:!!gameState.players[o]?._eliminated,
        relation:relOf(o)
      })) };
    })(),
    // ── VICTORY & TITLES ── standings board (public from turn 5), Reckoning status, and whether
    // this player may Call the Reckoning right now.
    titles:(()=>{
      const turn=gameState.turn||1;
      const st=computeStandings(gameState);
      const myShare=reckoningBlocShare(gameState, playerIndex);
      const _elig=reckoningCallEligibility(gameState, playerIndex); // bloc bar + caller's own floor
      const kingAlive=(gameState.characters||[]).some(c=>c.alive&&c.isKing&&c.player===playerIndex);
      const rk=gameState.reckoning||null, over=gameState.gameOver||null;
      const isPublic=turn>=TITLES_PUBLIC_FROM_TURN || !!over;
      const _race=isPublic?titleRaceFor(gameState, st, playerIndex):{}; // this realm's best contender per title, as percentages only
      // ── UNMET REALMS STAY NAMELESS (2026-09-27, Toby item 3) ────────────────────────────────────
      // The Titles & Victory card listed every realm in the world by name — standings board, title
      // holders, minor titles, a title lost to a rival, the Reckoning claimant — which handed a
      // player the name of every crown in the game on the turn the titles went public, long before
      // their scouts had found any of them. The title INTEL lines have respected `_encountered`
      // since 2026-09-24 (see the `met` helper on the intel sweep); the payload did not.
      // A realm is named only once this player has met it — the same list that gates Treat /
      // Declare War, and the same list the Dispatches tab uses. An unmet realm is still counted in
      // the standings (its score and its titles are public knowledge); only its name, its
      // character's name and its colour are withheld. The ONE exception is the end-of-game board:
      // once the world is judged, every realm is revealed with the final result.
      const _metSet=new Set([playerIndex, ...((player._encountered)||[])]);
      const _reveal=!!over;                                   // game over → the whole field is named
      const _metPi=(pi)=>pi==null||_reveal||_metSet.has(pi);
      const UNMET_REALM='An unknown realm', UNMET_CHAR='an unknown champion';
      const _realmNm=(pi)=>pi==null?null:(_metPi(pi)?(gameState.players[pi]?.name||('Realm '+(pi+1))):UNMET_REALM);
      const _realmCol=(pi)=>(pi!=null&&_metPi(pi))?(gameState.players[pi]?.color||null):null;
      const _charNm=(pi,nm)=>(!nm)?null:(_metPi(pi)?nm:UNMET_CHAR);
      return {
        publicFromTurn:TITLES_PUBLIC_FROM_TURN,
        public:isPublic,
        gains:(gameState._titleGainsByPlayer||{})[playerIndex]||[],   // titles this player won this turn
        losses:((gameState._titleLossesByPlayer||{})[playerIndex]||[]).map(l=>(l&&l.newHolderIndex!=null&&!_metPi(l.newHolderIndex))
          ? {...l, newHolderName:UNMET_REALM, newCharName:(l.newCharName?UNMET_CHAR:null)}
          : l), // titles this player LOST this turn — a rival they have not met is not named
        // the bar THIS realm must carry — its own bloc's size raises it. The solo bar is shipped
        // alongside so the portal can say what an alliance is costing.
        threshold:_elig.threshold,
        soloThreshold:_elig.soloThreshold,
        blocSize:_elig.blocSize,
        allyStep:_elig.allyStep,
        reckoningMinTurn:RECKONING_MIN_TURN,
        myShare,
        myOwnShare:_elig.ownShare,        // this realm's tax base WITHOUT its allies
        callerMin:_elig.callerMin,        // the personal floor a claimant must clear
        callBlockedReason:_elig.reason,   // 'tooEarly' | 'blocShort' | 'callerShort' | null
        canCallReckoning: isPublic && kingAlive && !rk && !over && _elig.ok,
        kingAlive, // Orders → Realm shows why the call is unavailable
        reckoning: rk?{byName:_realmNm(rk.by), calledTurn:rk.calledTurn, resolveAtTurn:rk.resolveAtTurn, mine:rk.by===playerIndex||(rk.bloc||[]).includes(playerIndex)}:null,
        gameOver: over?{winner:over.winner, winnerName:over.winner!=null?(gameState.players[over.winner]?.name||null):null, byElimination:!!over.byElimination, byConcession:!!over.byConcession, byReckoning:!!over.byReckoning, standings:(over.standings||[]).map(s=>({...s,titleNames:(s.titles||[]).map(k=>_TITLE_LABEL[k]||k)}))}:null,
        standings: isPublic?st.standings.map(s=>({...s, name:_realmNm(s.index), color:_realmCol(s.index), unmet:!_metPi(s.index), titleNames:(s.titles||[]).map(k=>_TITLE_LABEL[k]||k)})):null,
        holders: isPublic?Object.fromEntries(TITLE_DEFS.map(t=>{ const h=st.titles[t.key]; const hc=h.charId!=null?(gameState.characters||[]).find(c=>c.id===h.charId):null; return [t.key,{name:t.name,prize:t.prize,holderIndex:h.playerIndex,holderName:_realmNm(h.playerIndex),charName:_charNm(h.playerIndex,hc?hc.name:null),unmet:h.playerIndex!=null&&!_metPi(h.playerIndex),kingdomLevel:!!t.kingdomLevel,req:t.req,perk:t.perk,mine:h.playerIndex===playerIndex,race:_race[t.key]||null}]; })):null,
        minor: isPublic?(()=>{
          const mh=computeMinorTitles(gameState);
          const chById=id=>(gameState.characters||[]).find(c=>c.id===id);
          const all=MINOR_TITLES.map(t=>{ const h=mh[t.key]; const holder=h?chById(h.charId):null; const _pi=h?h.playerIndex:null; return {key:t.key,name:t.name,perk:t.perk,req:t.req,holderName:_charNm(_pi,holder?holder.name:null),kingdomName:_realmNm(_pi),unmet:_pi!=null&&!_metPi(_pi),holderIndex:_pi,mine:!!(h&&h.playerIndex===playerIndex)}; });
          return { all, mine: all.filter(x=>x.mine) };
        })():null,
      };
    })(),
    // Which GM build wrote this report. The player portal shows it when a feature the report should
    // carry is missing (e.g. the title-race percentages, added in v2026.09.20-0153), so a stale
    // uploaded GM portal is visible at a glance instead of looking like a player-portal bug.
    engineStamp:(typeof runningBuildStamp==='function'?runningBuildStamp():null),
    // 2026-09-23 (Toby item 6): prices the orders-column spending tracker needs and the player portal
    // has no table for — each unit type's per-turn WAGE (its recruit price after this realm's
    // `upkeep` discoveries; skeletal units are a flat 1g) and the Harvest the Field price, as the engine
    // charges them. (The Awaken the Wild surcharge went with the order, 2026-10-12.)
    orderPrices:(()=>{ const unitWage={}; Object.keys(ARMY_COST_MASTER).forEach(t=>{ unitWage[t]=discUpkeepWage(player,{type:t},ARMY_COST_MASTER[t]||2,new Map(),_taxCapR); });
      return {unitWage, unitCost:{...ARMY_COST_MASTER}, harvest:Math.max(0,2+discSumOf(player,'harvestCost','delta')), brokerSpy:2}; })(),
    lastTurnLog:[{type:'system',text:`Turn ${gameState.turn} begins. ${player.name} stands ready.`}],
  };
}


// ── SNAPSHOT of one realm's situation, from a parsed game state. Module level: uses only module-level
// helpers (unitBaseStrength, relOfReport, consecratedIds), so buildGameResultRows can call it on any
// loaded state, not just inside runTurn.
function telRealmSnapshot(gs, pi){
  const pl=(gs&&gs.players||[])[pi]; if(!pl) return null;
  const provs=(gs.world&&gs.world.provinces)||[];
  const owned=provs.filter(p=>p&&p.owner===pi);
  const chars=(gs.characters||[]).filter(c=>c&&c.player===pi&&c.alive);
  const king=chars.find(c=>c.isKing)||null;
  const unitRec=a=>({t:a.type,q:a.quality||'Average',...(a._isSkeletal?{sk:1}:{})});
  let ledUnits=0, ledStr=0, garUnits=0, garStr=0;
  const characters=chars.map(c=>{
    const units=(c.armies||[]).filter(a=>a&&!a._phantom);
    units.forEach(a=>{ ledUnits++; ledStr+=unitBaseStrength(a); });
    const pv=(c.location!=null)?provs[c.location]:null;
    const skills={}; Object.entries(c.skills||{}).forEach(([k,v])=>{ if(v>0) skills[k]=v; });
    return {id:c.id, name:c.name, king:!!c.isKing, loc:c.location, terrain:pv?pv.terrain:null, home:!!(pv&&pv.owner===pi),
      hp:c.hp, maxHp:c.maxHp, skills, units:units.map(unitRec), items:(c.items||[]).map(it=>it&&it.name).filter(Boolean)};
  });
  owned.forEach(p=>(p.garrisonArmies||[]).forEach(a=>{ if(a){ garUnits++; garStr+=unitBaseStrength(a); } }));
  // heroes who fell THIS turn, as they were at death (the Hall of Fame counts their peaks; no totals
  // above include them). Units and items are what death left on them, usually nothing.
  const fallen=(gs.characters||[]).filter(c=>c&&c.player===pi&&!c.alive&&c.killedThisTurn).map(c=>{
    const skills={}; Object.entries(c.skills||{}).forEach(([k,v])=>{ if(v>0) skills[k]=v; });
    return {id:c.id, name:c.name, king:!!c.isKing, fell:1, hp:0, maxHp:c.maxHp, skills,
      units:(c.armies||[]).filter(a=>a&&!a._phantom).map(unitRec), items:(c.items||[]).map(it=>it&&it.name).filter(Boolean)};
  });
  const tax=owned.reduce((s,p)=>s+(p.tax||0),0);
  const worldTax=provs.reduce((s,p)=>s+((p&&p.tax)||0),0);
  const rel={enemies:[],allies:[]};
  (gs.players||[]).forEach((o,oi)=>{ if(oi===pi||!o) return; const r=relOfReport(gs,pi,oi); if(r==='enemy') rel.enemies.push(oi); else if(r==='allied') rel.allies.push(oi); });
  const explored=provs.filter(p=>p&&Array.isArray(p.visitedBy)&&p.visitedBy.includes(pi)).length;
  const legNames=(typeof LEGENDARY_NAMES_P!=='undefined')?LEGENDARY_NAMES_P:new Set();
  let items=0, relics=0; chars.forEach(c=>(c.items||[]).forEach(it=>{ if(!it) return; items++; if(legNames.has(it.name)) relics++; }));
  return {
    gold:Math.round(pl.gold||0), provinces:owned.length, land:owned.filter(p=>p.terrain!=='sea').length, sea:owned.filter(p=>p.terrain==='sea').length,
    tax, taxShare:worldTax>0?Math.round(1000*tax/worldTax)/10:0,
    chars:chars.length, heroes:chars.length-(king?1:0), kingAlive:!!king, kingHp:king?king.hp:null,
    ledUnits, ledStr:Math.round(ledStr), garUnits, garStr:Math.round(garStr), units:ledUnits+garUnits, str:Math.round(ledStr+garStr),
    items, relics, discoveries:(pl.discoveries||[]).length, consecrated:consecratedIds(pl).length,
    explored, conceded:!!pl.conceded, eliminated:!!pl._eliminated, rel, characters,
    ...(fallen.length?{fallen}:{}),
  };
}
// The orders a realm gave this turn, as resolved by runTurn's ingestion (humans' submitted orders,
// bots' planned ones, Defend for anything missing). One entry per living character, five phases each.
function telOrdersFor(gs, pi, extras){
  const chars=(gs.characters||[]).filter(c=>c&&c.player===pi&&c.alive);
  const byChar={};
  chars.forEach(c=>{
    const slots=(gs.turnOrders||{})[c.id]||[];
    byChar[c.id]={name:c.name, king:!!c.isKing, ph:[0,1,2,3,4].map(i=>{
      const o=slots[i]; if(!o) return {a:'defend'};
      const r={a:String(o.action||'defend').toLowerCase()};
      if(o.target!=null&&o.target!=='') r.t=String(o.target).slice(0,80);
      if(o.extra!=null&&o.extra!=='') r.x=String(o.extra).slice(0,80);
      if(o.desc) r.d=String(o.desc).slice(0,140);
      if(o._pinned) r.pinned=1;
      if(o._unifiedWith!=null) r.unified=o._unifiedWith;
      return r;
    })};
  });
  const out={chars:byChar};
  if(extras){ Object.entries(extras).forEach(([k,v])=>{ if(v!==undefined&&v!==null&&!(Array.isArray(v)&&!v.length)&&!(typeof v==='object'&&!Array.isArray(v)&&!Object.keys(v).length)) out[k]=v; }); }
  return out;
}
