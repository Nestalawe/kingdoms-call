// ══ MOVE ANALYSIS (2026-09-26, Toby item 1) ═══════════════════════════════════════════════════
// Before a Move order is submitted, tell the player what KIND of move it is — a land march, a
// voyage, or a flight — and warn them when they are ordering a column into the sea that their
// hulls and flyers cannot carry. Every set and every rule below mirrors the GM engine exactly
// (AERIAL_TYPES / SEA_TYPES / CARRIER_TYPES / FLYING_TYPES, isAirCarriable, getFlyCapability,
// getSeaCapability and seaLiftShortfall). If any of those change in the engine, change these too —
// a warning that disagrees with the resolver is worse than no warning at all.
const PO_SEA_TYPES=new Set(KC_UNIT_CLASS.sea);
const PO_CARRIER_TYPES=new Set(KC_UNIT_CLASS.carrier);
const PO_AERIAL_TYPES=new Set(KC_UNIT_CLASS.aerial);
const PO_FLYING_TYPES=new Set(KC_UNIT_CLASS.flying);
const PO_CAVALRY_TYPES=new Set(KC_UNIT_CLASS.cavalry);
const PO_CREATURE_TYPES=new Set(KC_UNIT_CLASS.creature);
const PO_MONSTER_TYPES=new Set(KC_UNIT_CLASS.monster);
// Light foot take half a hull; everything else takes a whole one (engine: LIGHT_ARMIES).
const PO_LIGHT_TYPES=new Set([...KC_UNIT_CLASS.lightFoot,'__projected foot__']); // a unit the player has ordered raised or summoned earlier this turn — counted as light foot
// The stand-in type for a unit an earlier order will produce whose TYPE cannot be known in advance
// (a grave raised by Skeletal Armies or Harvest the Field). It belongs to no aerial, sea, creature
// or monster set, so poAirCarriable treats it as humanoid foot and PO_LIGHT_TYPES prices it at half
// a hull — the commonest case by far for a raised or harvested unit.
const PO_PROJECTED_FOOT='__projected foot__';
// A humanoid flyer lifts ONE foot soldier. Horses, hulls, sea-beasts and walking creatures or
// monsters are too heavy or unsuitable and can only go aboard ship.
function poAirCarriable(t){
  if(PO_AERIAL_TYPES.has(t)||PO_SEA_TYPES.has(t)) return false;
  if(PO_CREATURE_TYPES.has(t)||PO_MONSTER_TYPES.has(t)) return false;
  if(PO_CAVALRY_TYPES.has(t)) return false;
  return true;
}
// Can the WHOLE column take to the air? Every foot soldier must be liftable and there must be a
// humanoid flyer for each one; self-flying units ride for free.
function poFlyCapability(armies){
  const A=(armies||[]).filter(Boolean);
  if(!A.length) return false;
  let carriers=0, carried=0, selfFly=false;
  for(const a of A){
    if(PO_FLYING_TYPES.has(a.type)){ carriers++; selfFly=true; continue; }
    if(PO_AERIAL_TYPES.has(a.type)){ selfFly=true; continue; }
    if(poAirCarriable(a.type)){ carried++; continue; }
    return false; // grounded — nothing can lift it
  }
  return selfFly && carriers>=carried;
}
// The engine's getSeaCapability, plus the figures the note needs to explain itself.
// cap: 'all' (nothing to carry), 'sea' (hulls and flyers lift the lot), 'land' (cannot put to sea).
function poSeaAnalysis(armies, navalRaw){
  const A=(armies||[]).filter(Boolean);
  const hulls=A.reduce((s,a)=>s+(PO_CARRIER_TYPES.has(a.type)?((KC_CARRIER_BERTHS&&KC_CARRIER_BERTHS[a.type])||1):0),0);   // berths, as the engine counts them: a turtle's Island Back offers two
  const seaBeasts=A.filter(a=>PO_SEA_TYPES.has(a.type)&&!PO_CARRIER_TYPES.has(a.type)).length;
  const flyers=A.filter(a=>PO_FLYING_TYPES.has(a.type)).length;
  const aerial=A.filter(a=>PO_AERIAL_TYPES.has(a.type)).length;
  const land=A.filter(a=>!PO_AERIAL_TYPES.has(a.type)&&!PO_SEA_TYPES.has(a.type));
  const navalL8=(navalRaw||0)>=8;                   // NAVAL L8: one hull carries what once needed two
  const hullCap=hulls*(navalL8?2:1);
  const out={cap:'all',hulls,seaBeasts,flyers,aerial,landCount:land.length,hullCap,navalL8,
             lifted:poFlyCapability(A),allAerial:A.length>0&&A.every(a=>PO_AERIAL_TYPES.has(a.type)),
             allSea:A.length>0&&A.every(a=>PO_SEA_TYPES.has(a.type)),
             total:A.length,mustSail:0,short:0,shortNames:[]};
  if(!A.length||!land.length) return out;           // empty, or only flyers and hulls
  if(out.lifted){ out.cap='sea'; return out; }      // the flyers carry the whole column
  const capOf=a=>PO_LIGHT_TYPES.has(a.type)?0.5:1;
  const mustSail=land.filter(a=>!poAirCarriable(a.type));   // horses, siege, beasts — ship or nothing
  const liftable=land.filter(a=>poAirCarriable(a.type));
  out.mustSail=mustSail.length;
  let room=hullCap-mustSail.reduce((s,a)=>s+capOf(a),0);
  if(room<0){
    out.cap='land';
    // How many of the ship-only units have no berth, cheapest-first, so the message can name them.
    let over=-room, i=0;
    const order=mustSail.slice().sort((a,b)=>capOf(b)-capOf(a));
    while(over>0&&i<order.length){ out.shortNames.push(order[i].unitName||order[i].type); over-=capOf(order[i]); i++; }
    out.short=out.shortNames.length;
    return out;
  }
  let byAir=0; const airQueue=[];
  liftable.slice().sort((a,b)=>capOf(a)-capOf(b)).forEach(a=>{ const c2=capOf(a); if(room>=c2) room-=c2; else { byAir++; airQueue.push(a); } });
  if(byAir<=flyers){ out.cap='sea'; return out; }
  out.cap='land';
  out.short=byAir-flyers;
  out.shortNames=airQueue.slice(flyers).map(a=>a.unitName||a.type);
  return out;
}
// The notice shown under a Move order's dropdown: what kind of move this is, and a warning when the
// column cannot be carried to a sea province. `destProv` is a worldMeta province (may be undefined
// for an unmapped hex, in which case only the column's own capability is described).
// ── THE HOST AS IT WILL STAND AT THIS PHASE (2026-09-26) ────
// The notice below used to read the units the hero leads RIGHT NOW, so a column that recruits three
// hulls in Spring and sails in Early Summer was told it had no lift. It now reads the host the hero
// will actually be leading when the move resolves.
// projectedLedArmies already folds in every order that hands units about — this hero's own Recruit,
// Pick Up, Leave/Transfer and Disband, AND other characters' Recruit "mustered to" this hero and
// Leave/Transfer handed to this hero, each resolved at the phase it fires. On top of that, the
// orders below CREATE units, and are added here:
//   · Perform Rite/Wild Hunt — two Veteran beasts of the province's own wild type
//   · Elemental Summon       — one elemental (it walks; the engine does not count it as winged)
//   · Skeletal Armies        — one to three raised graves (by the caster's Necromancy)
//   · Harvest the Field      — one raised grave
// A raised grave's TYPE cannot be known in advance, so it is counted as humanoid foot
// (PO_PROJECTED_FOOT) — the commonest case, and the one the lift maths cares about.
// A Blood Offering's sacrifices are taken back OUT of the host.
// Orders whose units can be neither typed nor counted in advance (Awaken Grove, Wild Calling,
// Control Undead, Raise Wraiths, Death's Dominion) are listed in `uncounted` and named in the note
// rather than guessed at.
const PO_UNCOUNTABLE_ACTIONS=new Set(['Awaken Grove','Wild Calling']);
const PO_UNCOUNTABLE_SPELLS=new Set(['Control Undead','Raise Wraiths',"Death's Dominion",'Phantom Host']);
function projectedMoveHost(charId, ph){
  const report=currentReport||{};
  const ch=(report.characters||[]).find(x=>String(x.id)===String(charId));
  const out={armies:[],uncounted:[],gained:0,base:0};
  if(!ch) return out;
  out.armies=(typeof projectedLedArmies==='function')?projectedLedArmies(ch.id, ph):((ch.armies||[]).map(a=>({...a})));
  out.base=(ch.armies||[]).length;
  out.sameFrom=[];
  const pod=report.provinceOrderData||{};
  const add=(a)=>{ out.armies.push(a); out.gained++; };
  // ── SAME-PHASE HAND-OVERS (2026-09-28, Toby item 5) ────
  // The engine resolves every non-moving order of a phase (Leave/Transfer, Recruit, casting …) BEFORE
  // any Move in that phase, and a transfer to a hero who is about to march is ordered ahead of his
  // move. So troops another of your characters hands to this hero — or recruits straight into his
  // column — in the SAME phase as the move really do march with him. projectedLedArmies only counts
  // other characters' orders from strictly earlier phases, so those are added here. Both sides must
  // be standing in the same province at the start of the phase (the engine refuses the hand-over
  // otherwise).
  {
    const myLoc=(typeof predictedLocation==='function')?predictedLocation(ch.id,ph):null;
    const _memo=new Map();
    (report.characters||[]).forEach(o=>{
      if(!o||o.alive===false||String(o.id)===String(ch.id)) return;
      const oAct=(document.getElementById(`po-action-${o.id}-${ph}`)||{}).value||'';
      if(oAct!=='Recruit Armies'&&oAct!=='Leave/Transfer Army') return;
      const oLoc=predictedLocation(o.id,ph);
      if(!myLoc||!oLoc||oLoc.id!==myLoc.id) return;
      const oTgt=String((document.getElementById(`po-target-${o.id}-${ph}`)||{}).value||'');
      const toks=oTgt.split(',').map(t=>t.trim()).filter(Boolean);
      let got=[];
      if(oAct==='Recruit Armies'){
        if(!toks.includes('to:'+ch.id)) return;
        got=(typeof _projRecruitUnits==='function'?_projRecruitUnits(toks):[]).filter(u=>!_isAutoGarrisonRecruit(u)); // garrison units never join a character
      } else {
        const oExtra=(document.getElementById(`po-extra-${o.id}-${ph}`)||{}).value||'';
        if(String(oExtra)!==String(ch.id)) return;
        const oArm=projectedLedArmies(o.id, ph, _memo);
        if(toks.includes('all')) got=oArm.slice();
        else { const pool=oArm.slice(); toks.forEach(val=>{ const i=pool.findIndex(x=>(x.unitName||x.type)===val||x.type===val); if(i>=0) got.push(pool.splice(i,1)[0]); }); }
      }
      if(!got.length) return;
      got.forEach(u=>add({...u,_projected:true}));
      out.sameFrom.push(`${got.length} unit${got.length!==1?'s':''} ${oAct==='Recruit Armies'?'recruited for him':'handed over'} by ${o.name}`);
    });
  }
  for(let p=0;p<ph;p++){
    const act=(document.getElementById(`po-action-${charId}-${p}`)||{}).value||'';
    if(!act) continue;
    const tgt=String((document.getElementById(`po-target-${charId}-${p}`)||{}).value||'').trim();
    if(act==='Perform Rite'){
      if(tgt==='Wild Hunt'){
        const loc=predictedLocation(charId,p);
        const wt=loc?((pod[loc.id]||{}).wildHuntType):null;
        if(wt){ add({type:wt,quality:'Veteran',unitName:`${wt} (bound by the Wild Hunt)`,_projected:true});
                add({type:wt,quality:'Veteran',unitName:`${wt} (bound by the Wild Hunt)`,_projected:true}); }
        else out.uncounted.push('the Wild Hunt');
      } else {
        // Blood Offering — the sacrificed units are gone by the time the column marches.
        const ex=String((document.getElementById(`po-extra-${charId}-${p}`)||{}).value||'');
        const m=/S:([0-9,]*)\|E:/.exec(ex);
        if(m){
          const atThen=(typeof projectedLedArmies==='function')?projectedLedArmies(charId,p):[];
          m[1].split(',').filter(Boolean).map(Number).forEach(i=>{
            const a=atThen[i]; if(!a) return;
            const j=out.armies.findIndex(x=>(x.unitName||x.type)===(a.unitName||a.type));
            if(j>=0){ out.armies.splice(j,1); }
          });
        }
      }
      continue;
    }
    if(act==='Harvest the Field'){ add({type:PO_PROJECTED_FOOT,quality:'Average',unitName:'a grave you expect to raise this turn',_projected:true}); continue; }
    if(act==='Cast Spell'){
      if(tgt==='Elemental Summon'){ add({type:'Air Elemental',quality:'Veteran',unitName:'the elemental you expect to summon',_projected:true}); continue; }
      if(tgt==='Skeletal Armies'){
        const lv=Math.max(0,Math.min(5,Math.round((typeof effSkillP==='function'?effSkillP(ch,'necromancy'):((ch.skills||{}).necromancy||0))||0)));
        const n=lv>=5?3:lv>=3?2:1;
        for(let k=0;k<n;k++) add({type:PO_PROJECTED_FOOT,quality:'Average',unitName:'a grave you expect to raise this turn',_projected:true});
        continue;
      }
      if(PO_UNCOUNTABLE_SPELLS.has(tgt)) out.uncounted.push(tgt);
      continue;
    }
    if(PO_UNCOUNTABLE_ACTIONS.has(act)) out.uncounted.push(act);
  }
  out.uncounted=[...new Set(out.uncounted)];
  return out;
}
function poMoveModeNote(ch, destProv, host, fromProv){
  const H=host||{armies:((ch&&ch.armies)||[]).map(a=>({...a})),uncounted:[],gained:0,base:((ch&&ch.armies)||[]).length};
  const A=H.armies||[];
  const an=poSeaAnalysis(A,((ch&&ch.skills)||{}).naval||0);
  const destSea=!!(destProv&&destProv.terrain==='sea');
  const destKnown=!!(destProv&&destProv.terrain);
  // Where the column SETS OUT FROM at this phase — after any earlier move this turn, not where the
  // hero stands now (2026-09-27, Toby item 6). Needed because the land→land ban on naval units only
  // bites when the leg starts on land.
  const fromSea=!!(fromProv&&fromProv.terrain==='sea');
  const fromKnown=!!(fromProv&&fromProv.terrain);
  // One footnote for every verdict: what the count is based on, and what could not be counted.
  const _foot=(()=>{
    const bits=[];
    const diff=(A.length)-(H.base||0);
    const _same=(H.sameFrom||[]);
    if(diff!==0||H.gained) bits.push(`counting your ${_same.length?`orders this turn, including this phase's hand-overs (${_same.join('; ')} — these resolve before any move)`:'earlier orders this turn'} — ${A.length} unit${A.length!==1?'s':''} under command by then${diff>0?` (${diff} more than now)`:diff<0?` (${-diff} fewer than now)`:''}`);
    if((H.uncounted||[]).length) bits.push(kcHtml`<strong>not counted:</strong> ${H.uncounted.join(', ')} — there is no telling in advance what they will bring`);
    return bits.length?kcHtml`<div style="opacity:.85;margin-top:2px">${kcJoinP(bits,' · ')}.</div>`:'';
  })();
  const box=(bg,bd,fg,html)=>kcHtml`<div style="font-size:.72rem;color:${fg};background:${bg};border:1px solid ${bd};border-radius:2px;padding:3px 6px;margin-top:3px">${html}${_foot}</div>`;
  const good=h=>box('#eaf5e2','#7ea45f','#1f4410',h);
  const warn=h=>box('#fff3e0','#e0b070','#7a3c00',h);
  const bad =h=>box('#fdeaea','#c06060','#7a1010',h);
  const where=destProv?kcHtml` into <strong>${destProv.name||'that province'}</strong>`:'';
  if(!A.length) return good(kcHtml`🚶 <strong>Solo ride</strong> — ${ch.name} leads no troops${where}, and travels by land or takes passage over water freely.`);
  // ── SHIPS CANNOT CROSS LAND (2026-09-27, Toby item 6) ───────────────────────────────────────────
  // The engine refuses a land→land step outright while the column leads ANY naval unit — fleet or
  // sea-beast, coastal or not ("cannot march overland while leading naval units"). The old note
  // said only that the hulls "can only follow along a coast", which read as though a coast-to-coast
  // march were legal; it is not, and the order was silently wasted. This is now a hard red warning,
  // raised BEFORE every other verdict so it cannot be buried, and it names the way out.
  const _navalAboard=an.hulls+an.seaBeasts;
  if(_navalAboard>0 && !fromSea && !destSea && fromKnown && destKnown){
    const _names=[...new Set(A.filter(a=>PO_SEA_TYPES.has(a.type)).map(a=>a.unitName||a.type))];
    return bad(kcHtml`⛔ <strong>This move will be refused — ships cannot cross land.</strong> ${ch.name} would be marching from one land province${fromProv?kcHtml` (<strong>${fromProv.name||'here'}</strong>)`:''} to another${where} while leading ${_navalAboard} naval unit${_navalAboard!==1?'s':''} (${_names.slice(0,3).join(', ')}${_names.length>3?'…':''}). There is no coast-to-coast march for a fleet. Either <strong>Leave/Transfer</strong> the ships into this province's garrison in an earlier phase and march without them, or sail instead — from a land province a fleet may only move to an <strong>adjacent sea province</strong>.`);
  }
  // A column that can fly crosses anything.
  if(an.allAerial) return good(kcHtml`🦅 <strong>Flying move</strong> — every unit is winged, so the column crosses land and sea alike and needs no fleet.`);
  if(an.lifted)   return good(kcHtml`🦅 <strong>Flying move</strong> — the ${an.flyers} humanoid flyer${an.flyers!==1?'s':''} lift the whole column${where}; land and sea are both open to it.`);
  if(an.allSea){
    if(destSea) return good(kcHtml`⛵ <strong>Naval move</strong> — a fleet of ${an.total} at sea${where}.`);
    return fromSea
      ? good(kcHtml`⛵ <strong>Coastal landing</strong> — the fleet puts in${where}. A landing is only possible on a <strong>coastal</strong> province; an inland hex will turn it back.`)
      : warn(kcHtml`⛵ <strong>Naval move</strong> — this column is all ships and sea-beasts. From a land province its only legal move is to an <strong>adjacent sea province</strong>; it cannot march overland.`);
  }
  if(destSea){
    if(an.cap!=='land'){
      const carried=an.landCount;
      return good(kcHtml`⛵ <strong>Naval move</strong> — ${an.hulls} hull${an.hulls!==1?'s':''}${an.navalL8?' (Naval 8: each carries double)':''}${an.flyers?` and ${an.flyers} flyer${an.flyers!==1?'s':''}`:''} carry ${carried} land unit${carried!==1?'s':''} out to sea.`);
    }
    return bad(kcHtml`⚠ <strong>Not enough lift for a sea crossing.</strong> ${ch.name} leads ${an.landCount} land unit${an.landCount!==1?'s':''} but only ${an.hulls} hull${an.hulls!==1?'s':''}${an.flyers?` and ${an.flyers} humanoid flyer${an.flyers!==1?'s':''}`:' and no flyers'}. About ${an.short} unit${an.short!==1?'s':''} would be left ashore${an.shortNames.length?` (${an.shortNames.slice(0,3).join(', ')}${an.shortNames.length>3?'…':''})`:''}. Recruit or bring more ships, send the surplus elsewhere, or choose a land province.`);
  }
  // Land destination (or an unmapped hex).
  const bits=[];
  if(an.aerial&&!an.allAerial) bits.push(`${an.aerial} winged unit${an.aerial!==1?'s':''} march with the rest`);
  if(_navalAboard>0){
    // Reaching here means the hard case above did not apply: either the column sets out from SEA
    // (a legal coastal landing), or one of the two hexes is not mapped yet and the ban cannot be
    // confirmed — which is a risk worth naming.
    if(fromSea) return good(kcHtml`⛵ <strong>Coastal landing</strong>${where} — the ships put in and the land units come ashore.${bits.length?` (${bits.join('; ')}.)`:''} Once ashore the column cannot march on while it still leads ships: leave them in the garrison first.`);
    return warn(kcHtml`⚠ <strong>Land march with ships in the column.</strong> ${ch.name} leads ${_navalAboard} naval unit${_navalAboard!==1?'s':''}, and a column carrying ships or sea-beasts <strong>cannot step from one land province to another</strong> — if this leg turns out to start and end on land the order will be refused. Leave the hulls behind to march, or sail to an adjacent sea province.${bits.length?` (${bits.join('; ')}.)`:''}`);
  }
  return good(kcHtml`🛡 <strong>Land march</strong>${where}${destKnown?'':' (destination not yet mapped)'}${bits.length?` — ${bits.join('; ')}.`:'.'}`);
}
// The province a Move order SETS OUT from at this phase, with its terrain — predictedLocation gives
// only {id,name}, so the full worldMeta record is looked up for the terrain the note needs.
function moveOriginProv(charId, ph){
  const provs=(currentReport&&currentReport.worldMeta&&currentReport.worldMeta.provinces)||[];
  const loc=(typeof predictedLocation==='function')?predictedLocation(charId,ph):null;
  if(!loc) return null;
  return provs.find(p=>p.id===loc.id)||{id:loc.id,name:loc.name};
}
// Recompute the notice under one Move order (the dropdown's onchange; later phases are rebuilt
// wholesale by onMoveEdited, which regenerates the note with them).
function refreshMoveModeNote(charId, ph){
  const host=document.getElementById(`po-move-mode-${charId}-${ph}`);
  if(!host) return;
  const ch=(currentReport&&currentReport.characters||[]).find(c=>String(c.id)===String(charId));
  if(!ch){ host.innerHTML=''; return; }
  const tgt=(getOrderTarget(charId,ph)||'').trim();
  const provs=(currentReport&&currentReport.worldMeta&&currentReport.worldMeta.provinces)||[];
  let dest=null;
  if(tgt.startsWith('prov:')){ const id=parseInt(tgt.slice(5)); if(!isNaN(id)) dest=provs.find(p=>p.id===id)||null; }
  host.innerHTML=poMoveModeNote(ch,dest,projectedMoveHost(charId,ph),moveOriginProv(charId,ph));
}
// Every Move notice on the form, rebuilt. A Recruit, Pick Up, Leave/Transfer, Disband, rite or
// summoning in ANY phase — this hero's or another of the player's — changes the host a later move
// sets out with, so the notices are refreshed wholesale whenever an order changes rather than only
// when the move's own dropdown is touched.
function refreshAllMoveModeNotes(){
  const chars=(currentReport&&currentReport.characters)||[];
  chars.forEach(c=>{ if(!c||c.alive===false) return;
    for(let p=0;p<=4;p++){ if(document.getElementById(`po-move-mode-${c.id}-${p}`)) refreshMoveModeNote(c.id,p); } });
}
// ── The direction a Move order should DEFAULT to (2026-09-26, Toby item 2) ────
// A fresh Move order opened North West every time, whatever the player had already ordered this
// turn, so a column marching east had to be re-pointed in every phase. It now opens on the compass
// direction of the most recent EARLIER move order this turn (the options carry absolute province
// ids, so the direction is recovered by matching the target against the six neighbours of wherever
// the character set out from). No earlier move — or that direction is off the map from here — and
// the list simply opens as it always did.
function lastMoveDirOf(charId, beforePhase){
  const report=currentReport;
  if(!report||!report.worldMeta) return null;
  const wm=report.worldMeta, cols=wm.cols, rows=wm.rows, provs=wm.provinces||[];
  const HEX=KC_HEX_DIRS.slice();
  const EV=[[-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]];
  const OD=[[-1,0],[-1,1],[0,-1],[0,1],[1,0],[1,1]];
  let found=null;
  for(let ph=0; ph<beforePhase; ph++){
    const action=document.getElementById(`po-action-${charId}-${ph}`)?.value;
    if(action!=='Move') continue;
    const tgt=(getOrderTarget(charId,ph)||'').trim();
    if(!tgt) continue;
    if(tgt.startsWith('dir:')){ const d=tgt.slice(4); if(HEX.indexOf(d)>=0) found=d; continue; }
    if(!tgt.startsWith('prov:')) continue;
    const toId=parseInt(tgt.slice(5)); if(isNaN(toId)) continue;
    const from=predictedLocation(charId,ph); if(!from) continue;
    const fp=provs.find(p=>p.id===from.id); if(!fp||fp.row==null) continue;
    if(toId===fp.id) continue;                       // "stay here" is not a direction
    const offs=(fp.row%2===0)?EV:OD;
    for(let i=0;i<6;i++){
      const nr=fp.row+offs[i][0]; if(nr<0||nr>=rows) continue;
      const nc=((fp.col+offs[i][1])%cols+cols)%cols;
      if(nr*cols+nc===toId){ found=HEX[i]; break; }
    }
  }
  return found;
}

const SKILL_LABELS={...KC_SKILL_LABELS};

// Encounter plan tactics (AK 5.0-5.8) How a commander answers the call to single combat at the
// start of an army battle.
const DUEL_STANCES=[
  {code:'challenge',label:'⚔ Challenge — ride out and demand single combat'},
  {code:'accept',   label:'🛡 Accept — will not initiate, but will answer a challenge'},
  {code:'refuse',   label:'🏳 Refuse — will not duel (−20% strength if challenged)'},
];
const ENCOUNTER_TACTICS=[
  {code:'ME',label:'Melee — close and fight in hand-to-hand combat'},
  {code:'FI',label:'Fire Arrow — move to bow range and shoot (requires Archery skill; 2 arrows at Archery 3+)'},
  {code:'CA',label:'Cast Spell — combat spells: Lightning Bolt, Fireball, Psychic Blast, Telekinetic Storm, Hand of Death, Curse, Control Undead, Holy Symbol, Spiritwrack, Mirror Image, Invisibility, Charm',hasSpell:true},
  {code:'CS',label:'Cast from School — during the pre-battle magic phase, cast a RANDOM battle spell from a chosen school (White, Elemental, Psychic or Necromancy)',hasSchool:true},
  // Parley is withdrawn for now. `retired` keeps the label resolvable for an older Chronicle entry
  // while every picker below filters it out. Mirrors ENCOUNTER_TACTICS in the GM engine.
  {code:'TA',label:'Talk — attempt to negotiate or parley',retired:true},
  {code:'ST',label:'Steal — attempt to steal treasure (requires Thief skill)'},
  {code:'FL',label:'Flee — attempt to escape from the encounter (does not affect duels; see Duel stance)'},
  {code:'SC',label:'Scout — scout the lair for secrets and special functions',retired:true}, // withdrawn; mirrors SCOUT_ENABLED in the GM engine
];

// ── Royal succession skill allocation ────
// The crowned heir keeps their base skills; the player spends 4 points on top of that, max +2 into
// any single skill — exactly the join-screen rule (join skills add on top of the king's base
// {melee:2,archery:1,sage:1}). _heirBase is the untouchable floor.
const HEIR_TEMPERS_LIST=KC_TEMPERS.slice();
function heirBaseSkills(c){ return (c&&c._heirBase)||(c&&c.skills)||{}; }
function heirAddedTo(c,skill){ const b=heirBaseSkills(c); return ((c.skills||{})[skill]||0)-(b[skill]||0); }
function heirTotalAdded(c){
  const b=heirBaseSkills(c), s=c.skills||{}, keys=new Set([...Object.keys(s),...Object.keys(b)]);
  let t=0; keys.forEach(k=>{ t+=Math.max(0,(s[k]||0)-(b[k]||0)); }); return t;
}
function heirPointsRemaining(c){ return 4-heirTotalAdded(c); }

// Build the succession panel (name + temper + skill pips, styled like the join screen). Returns ''
// when the player has no heir awaiting setup.
function heirSelectorHTML(chars){
  const heir=(chars||[]).find(c=>c._isHeir);
  if(!heir) return '';
  const remaining=heirPointsRemaining(heir);
  const pip=skill=>{
    const lvl=(heir.skills||{})[skill]||0;               // resulting level (base + allocated)
    const added=heirAddedTo(heir,skill);
    const displayName=SKILL_LABELS[skill]||skill;
    const minusOff=added<=0;                              // may not reduce below the crowned base
    const plusOff=remaining<=0||added>=2;                 // 4-point budget, +2-per-skill cap
    return kcHtml`<div class="skill-pip">
      <button onclick="allocateHeirSkill(${kcArg(heir.id)},${kcArg(String(skill))},-1)" ${minusOff?'disabled':''}>−</button>
      <span class="sk-name" onmousemove="showSkillTip(event,${kcArg(String(skill))})" onmouseleave="hideSkillTip()">${displayName}</span>
      <span class="sk-val">${lvl}</span>
      <button onclick="allocateHeirSkill(${kcArg(heir.id)},${kcArg(String(skill))},1)" ${plusOff?'disabled':''}>+</button>
    </div>`;
  };
  const grid=kcHtml`<div class="skill-cols">${SKILL_COLUMNS.map(col=>
    kcHtml`<div class="skill-col"><div class="skill-col-head">${col.head}</div>${col.skills.map(pip)}</div>`
  )}</div>`;
  return kcHtml`<div style="background:#fff8e8;border:2px solid var(--gold);border-radius:3px;padding:10px 12px;margin-bottom:14px">
    <div style="font-family:'Cinzel',serif;font-size:.82rem;color:var(--gold);margin-bottom:4px">👑 Royal Succession — Name, Temper &amp; Skills</div>
    <div style="font-size:.76rem;color:#444;margin-bottom:8px">A new monarch has risen. Name them, choose their Temper, and spend their <strong>${remaining}</strong> remaining skill point${remaining!==1?'s':''} before submitting orders. New skills take effect this turn — buy a magic school and you can cast from it right away.</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px">
      <label style="font-size:.74rem;color:#231e16">Name
        <input id="heir-name" value="${heir.name||''}" maxlength="40" oninput="setHeirName(${kcArg(heir.id)},this.value)"
          style="margin-left:4px;font-size:.76rem;padding:3px 6px;border:1px solid var(--stone);border-radius:2px;width:200px">
      </label>
      <label style="font-size:.74rem;color:#231e16">Temper
        <select id="heir-temper" onchange="setHeirTemper(${kcArg(heir.id)},this.value)"
          style="margin-left:4px;font-size:.76rem;padding:3px 6px;border:1px solid var(--stone);border-radius:2px">
          ${HEIR_TEMPERS_LIST.map(t=>kcHtml`<option value="${t}"${heir.temper===t?' selected':''}>${t}</option>`)}
        </select>
      </label>
      <span class="pts-remaining" style="margin-left:auto">${remaining} point${remaining!==1?'s':''} remaining</span>
    </div>
    ${grid}
  </div>`;
}

// ════
// HERO ORDER — players reorder their heroes in the orders column
// ════
// The ▲ ▼ buttons move the hero's whole CARD in the DOM rather than rebuilding the form, so every
// half-typed order, target and encounter plan in the column survives a reorder untouched. Any cards
// injected under a hero (a hired hero, a resurrection or charm pre-order) are siblings that follow
// their parent block, so they travel with it as a group — see heroGroupP().
function heroOrderFromOrdersP(existingOrders){
  try{
    const r=typeof existingOrders==='string'?JSON.parse(existingOrders||'{}'):(existingOrders||{});
    return (Array.isArray(r.heroOrder)&&r.heroOrder.length)?r.heroOrder.map(String):null;
  }catch(e){ return null; }
}
function applyHeroOrderP(chars, order){
  const list=[...(chars||[])];
  if(order&&order.length){
    const rank=new Map(order.map((id,i)=>[String(id),i]));
    list.sort((a,b)=>(rank.has(String(a.id))?rank.get(String(a.id)):1e9)-(rank.has(String(b.id))?rank.get(String(b.id)):1e9));
    return list;
  }
  return list.sort((a,b)=>((a.isKing||a._isHeir)?0:1)-((b.isKing||b._isHeir)?0:1));
}
function heroBlocksP(){
  const form=document.getElementById('orders-form');
  return form?[...form.querySelectorAll(':scope > .orders-char-block[data-hero]')]:[];
}
// A hero's block plus every element that follows it up to the next hero block — i.e. the injected
// hired-hero / resurrect / charm cards that `charBlock.after(card)` parked underneath it.
function heroGroupP(block){
  const g=[block];
  let n=block.nextElementSibling;
  while(n && !(n.classList.contains('orders-char-block') && n.hasAttribute('data-hero'))){ g.push(n); n=n.nextElementSibling; }
  return g;
}
// The arrangement as it stands right now: read from the DOM when the editable column is on screen,
// otherwise the last known copy (the read-only submitted view has no hero blocks to read).
function currentHeroOrderP(){
  const fromDom=heroBlocksP().map(b=>b.getAttribute('data-hero'));
  return fromDom.length?fromDom:(_heroOrder||[]).slice();
}
function moveHeroBlock(charId, dir){
  const blocks=heroBlocksP();
  const i=blocks.findIndex(b=>b.getAttribute('data-hero')===String(charId));
  const j=i+dir;
  if(i<0||j<0||j>=blocks.length) return;
  const gA=heroGroupP(blocks[i]), gB=heroGroupP(blocks[j]);
  if(dir>0){ let ref=gB[gB.length-1]; gA.forEach(n=>{ ref.after(n); ref=n; }); }
  else { const anchor=gB[0]; gA.forEach(n=>anchor.parentNode.insertBefore(n,anchor)); }
  _heroOrder=heroBlocksP().map(b=>b.getAttribute('data-hero'));
  refreshHeroMoveButtonsP();
  try{ blocks[i].scrollIntoView({block:'nearest',behavior:'smooth'}); }catch(e){} // not every environment has it
  persistHeroOrder();
}
// 2026-10-08 (Toby item 5): "Group by location" puts heroes standing in the same province next to
// each other. Provinces come in the order their first hero already appears (so the king's stays on
// top), and heroes keep their old order inside each province. Each hero moves with the cards parked
// under it, and the result is remembered exactly like a ▲▼ reorder.
function groupHeroesByLocation(){
  const blocks=heroBlocksP(); if(blocks.length<2) return;
  const chars=(currentReport&&currentReport.characters)||[];
  const locOf=id=>{ const c=chars.find(x=>String(x.id)===String(id)); return c?String(c.locationId!=null?c.locationId:(c.locationName||'?')):'?'; };
  const firstSeen=new Map();
  blocks.forEach(b=>{ const k=locOf(b.getAttribute('data-hero')); if(!firstSeen.has(k)) firstSeen.set(k,firstSeen.size); });
  const sorted=blocks.map((b,i)=>({b,i,k:firstSeen.get(locOf(b.getAttribute('data-hero')))})).sort((x,y)=>x.k-y.k||x.i-y.i);
  if(sorted.every((s,i)=>s.i===i)) return;   // already grouped
  // The last hero's group runs to the end of the form, so re-appending every group in the new order
  // leaves the blocks above the heroes (realm, discoveries, heir) where they are.
  const parent=blocks[0].parentNode;
  sorted.map(s=>heroGroupP(s.b)).flat().forEach(n=>parent.appendChild(n));
  _heroOrder=heroBlocksP().map(b=>b.getAttribute('data-hero'));
  refreshHeroMoveButtonsP();
  persistHeroOrder();
}
// Re-disable the first ▲ and the last ▼ after every move.
function refreshHeroMoveButtonsP(){
  const blocks=heroBlocksP();
  blocks.forEach((b,i)=>{
    const up=b.querySelector('.hero-move-up'), dn=b.querySelector('.hero-move-down');
    if(up) up.disabled=(i===0);
    if(dn) dn.disabled=(i>=blocks.length-1);
  });
}
// Persist the arrangement on its own, MERGED into whatever orders payload is already stored, so a
// reorder never rewrites (or un-submits) the orders themselves. The engine picks `heroOrder` out of
// the payload and keeps it on the realm from then on.
async function persistHeroOrder(){
  const gp=currentGamePlayer;
  if(!gp||!gp.id||!_heroOrder.length) return;
  // Never write while a past-turn report is on screen (same guard doSaveOrders uses).
  if(document.getElementById('prev-report-banner')?.style.display==='block') return;
  let raw={};
  try{ raw=typeof gp.orders==='string'?JSON.parse(gp.orders||'{}'):(gp.orders||{}); }catch(e){ raw={}; }
  if(!raw||typeof raw!=='object') raw={};
  // Keep the payload in the new {orders,encounterPlans,forTurn} shape so the stale-draft guard and
  // the engine's format sniff both still recognise it after a bare reorder on an otherwise empty
  // form.
  if(raw.orders===undefined) raw.orders={};
  if(raw.encounterPlans===undefined) raw.encounterPlans={};
  if(raw.forTurn==null) raw.forTurn=(currentReport&&(currentReport._liveTurn||currentReport.turn))||1;
  raw.heroOrder=_heroOrder.slice();
  const payload=JSON.stringify(raw);
  const {error}=await sb.from('game_players').update({orders:payload}).eq('id',gp.id);
  if(error){ console.warn('persistHeroOrder:',error.message); return; }
  gp.orders=payload;
}

