// ── EVEN DISTRIBUTION PER PLAYER (2026-09-11, Toby: "so players won't keep finding the same type
// of
// item all the time") ────
// Balancing the WORLD's hoards (84.5) does not by itself balance what any one realm finds: a player
// works their own corner of the map, and a corner is a small sample. Two passes fix that.
//
// 1. REGIONAL STOCKING (below). Every lair is assigned to the nearest king's home province, and the
// category counter is kept PER REGION — so each realm's own neighbourhood holds an even spread of
// weapons, armour, shields, helms, cloaks, rings, amulets, combat items and trinkets, not just the
// world as a whole. A realm that never leaves home still sees one of everything.
// 2. A CORRECTIVE DRAW (rollMagicItemFor). Items won in play — bonus finds, newly discovered ruins —
// are drawn from whichever category THAT player has found least of so far, so a run of, say, four
// rings is answered by the next find being something else. Per-player tallies live on the player
// record (`_itemsFoundByCat`) and are kept by noteItemFound().
// A lair's contents are still fixed at generation and a scout report still tells the truth about
// them — nothing is decided at the moment of opening the chest.
function lairRegionOf(gs, prov){
  const pls=(gs&&gs.players)||[];
  if(!prov||!pls.length) return 0;
  const provs=(gs.world&&gs.world.provinces)||[]; const cols=(gs.world&&gs.world.cols)||0;
  let best=0, bestD=Infinity;
  for(let i=0;i<pls.length;i++){
    const hid=homeProvinceIdFor(gs,i); const hp=(hid!=null)?provs[hid]:null; if(!hp) continue;
    const d=hexDistP(prov,hp,cols);
    if(d<bestD){ bestD=d; best=i; }
  }
  return best;
}
// Remember what a realm has actually WON, by category — the tally the corrective draw reads.
function noteItemFound(gs, playerIndex, it){
  if(!gs||playerIndex==null||!it) return;
  const pl=(gs.players||[])[playerIndex]; if(!pl) return;
  if(!pl._itemsFoundByCat) pl._itemsFoundByCat={};
  migrateHoardTally(pl);
  const cat=itemHoardCategory(it);
  pl._itemsFoundByCat[cat]=(pl._itemsFoundByCat[cat]||0)+1;
}
// A lair-tier roll for a NAMED player: same tier odds as rollMagicItem, but among the categories
// this realm has found least of. Falls back to the plain roll when no category has stock in the
// chosen tier.
function rollMagicItemFor(gs, playerIndex, monsterPower, taken, takenEff){
  taken=taken||new Set();
  if(!takenEff) takenEff=awardedEffectSet(gs);
  const pl=(gs&&gs.players||[])[playerIndex];
  if(!pl) return rollMagicItem(monsterPower, taken, takenEff);
  migrateHoardTally(pl);
  const found=pl._itemsFoundByCat||{};
  const t=lairItemTier(monsterPower);
  const avail=(c,tt)=>ALL_MAGIC_ITEMS_P.filter(it=>!isLegendaryItem(it)&&(tt==null?itemFallbackOk(it,t):it.tier===tt)&&!taken.has(it.name)&&itemHoardCategory(it)===c);
  let atTier=true;
  let live=HOARD_CATEGORIES.filter(c=>avail(c,t).length>0);
  if(!live.length){ atTier=false; live=HOARD_CATEGORIES.filter(c=>avail(c,null).length>0); }
  if(!live.length) return rollMagicItem(monsterPower, taken, takenEff);
  const low=Math.min(...live.map(c=>found[c]||0));
  const cats=shuffleP(live.filter(c=>(found[c]||0)===low));
  const cat=cats[0];
  const pool=preferFreshEffects(avail(cat, atTier?t:null), takenEff);
  return pool.length?pool[Math.floor(kcRng()*pool.length)]:rollMagicItem(monsterPower, taken, takenEff);
}
function ensureAllLairHoards(gs){
  const provs=(gs&&gs.world&&gs.world.provinces)||[];
  const powOf=f=>((f.monster&&f.monster.power)||'Weak');
  const lairs=[];
  ['Legendary','Powerful','Moderate','Weak'].forEach(pw=>{
    const tier=[]; provs.forEach(p=>(p.features||[]).forEach(f=>{ if(f&&!f.ritualSite&&powOf(f)===pw) tier.push({f,prov:p}); }));
    shuffleP(tier).forEach(x=>lairs.push(x)); // {f,prov} pairs — the province is NEVER stored on the feature (game_state is JSON-serialised, and that would be circular)
  });
  if(!lairs.length) return;
  if(!Array.isArray(gs._awardedItems)) gs._awardedItems=[];
  // Gold + migration for every lair; item SLOTS are rolled here but not filled (ensureLairHoard's
  // own item rolls are bypassed by pre-marking _hoardV2 below).
  const work=[];
  lairs.forEach(({f,prov})=>{
    const fresh=!f._hoardV2 && !f.cleared;
    ensureLairHoard(f,gs,{noItems:true});
    if(!fresh) return;
    const T=LAIR_ITEM_ODDS[powOf(f)]||LAIR_ITEM_ODDS.Weak;
    let slots=0; if(kcRng()<T.itemChance) slots++; if(kcRng()<T.bonusItem) slots++; if(kcRng()<(T.thirdItem||0)) slots++;
    work.push({f,slots,power:powOf(f),region:lairRegionOf(gs,prov),provId:prov.id,prov});
  });
  if(!work.length) return;
  const taken=new Set(gs._awardedItems);
  // Effects already spent map-wide, plus a per-province tally. The map-wide set is a PREFERENCE (a
  // huge map can outrun the 394 distinct designs); the province set is a HARD BAR, because two
  // renamed copies of one item sitting in the same province is the case players actually notice.
  const takenEff=awardedEffectSet(gs);
  const provEff={};
  const provSet=(id)=>provEff[id]||(provEff[id]=new Set());
  // Effects within `r` provinces of a lair (item 5): every province already holding a stocked item,
  // its own effects included — a lair stocked in an older save counts too.
  const _cols=(gs.world&&gs.world.cols)||0;
  provs.forEach(p=>(p.features||[]).forEach(f=>{ if(f&&!f.ritualSite&&!f.cleared) (f.hoardItems||[]).forEach(it=>provSet(p.id).add(itemEffectKey(it))); }));
  const effectsNear=(prov,r)=>{ const out=new Set(); if(r<0) return out;
    for(const id in provEff){ const q=provs[id]; if(!q||!provEff[id].size) continue; if(hexDistP(prov,q,_cols)<=r) provEff[id].forEach(k=>out.add(k)); }
    return out; };
  const byName=new Map(); ALL_MAGIC_ITEMS_P.forEach(it=>byName.set(it.name,it));
  // counts are kept PER REGION (nearest home province), so each realm's own neighbourhood gets an
  // even spread rather than only the world as a whole. `_all` keeps the world-level tally for the
  // harness and for the fallback when a region is somehow empty.
  const regCount={}, catCount={}; HOARD_CATEGORIES.forEach(c=>catCount[c]=0);
  const countsFor=(r)=>regCount[r]||(regCount[r]=Object.fromEntries(HOARD_CATEGORIES.map(c=>[c,0])));
  gs._awardedItems.forEach(n=>{ const it=byName.get(n); if(it) catCount[itemHoardCategory(it)]=(catCount[itemHoardCategory(it)]||0)+1; });
  const give=(f,base,reg,provId)=>{ taken.add(base.name); takenEff.add(itemEffectKey(base)); if(provId!=null) provSet(provId).add(itemEffectKey(base));
    gs._awardedItems.push(base.name); const id=(gs.nextItemId||0); gs.nextItemId=id+1;
    f.hoardItems.push({...base,effect:{...base.effect},id});
    const cat=itemHoardCategory(base); catCount[cat]=(catCount[cat]||0)+1;
    if(reg!=null) countsFor(reg)[cat]=(countsFor(reg)[cat]||0)+1; };
  // 1. Legendaries — all of them, whatever the map size.
  let legs=shuffleP(ALL_MAGIC_ITEMS_P.filter(it=>isLegendaryItem(it)&&!taken.has(it.name)));
  for(const w of work){ if(!legs.length) break; if(w.slots>0){ give(w.f,legs.pop(),w.region,w.provId); w.slots--; } }
  let guard=0; while(legs.length&&guard++<50){ for(const w of work){ if(!legs.length) break; give(w.f,legs.pop(),w.region,w.provId); } }
  // 2. Everything else, category-balanced.
  // Items of a given kind still available AT A GIVEN TIER (legendaries are dealt separately above).
  const untakenT=(cat,t)=>ALL_MAGIC_ITEMS_P.filter(it=>!isLegendaryItem(it)&&it.tier===t&&!taken.has(it.name)&&itemHoardCategory(it)===cat);
  const untakenAny=(cat,t)=>ALL_MAGIC_ITEMS_P.filter(it=>!isLegendaryItem(it)&&!taken.has(it.name)&&itemHoardCategory(it)===cat&&itemFallbackOk(it,t));
  for(const w of work){
    const rc=countsFor(w.region);
    const t=lairItemTier(w.power); // a lair holds an item of its OWN guardian's tier
    while(w.slots>0){
      // Kinds that still have stock at this tier; if the tier is spent, fall back to any tier of
      // that kind rather than leaving the lair empty.
      let atTier=true;
      let cats=HOARD_CATEGORIES.filter(c=>untakenT(c,t).length>0);
      if(!cats.length){ atTier=false; cats=HOARD_CATEGORIES.filter(c=>untakenAny(c,t).length>0); }
      if(!cats.length){ atTier=false; cats=HOARD_CATEGORIES.filter(c=>untakenAny(c,null).length>0); } // last resort: the "never empty" ruling outranks rule 1 on a bare treasury
      if(!cats.length){ w.slots=0; break; }
      const inCatOf=(cat)=>atTier?untakenT(cat,t):(untakenAny(cat,t).length?untakenAny(cat,t):untakenAny(cat,null));
      // Item 5: an effect already in a lair within LAIR_EFFECT_SPREAD provinces is barred, and the
      // kinds are narrowed to those that still have something else to give. The distance shrinks
      // only when no kind does (0 = this province; -1 = no bar at all).
      let nearOk=cats, barred=new Set();
      for(let r=LAIR_EFFECT_SPREAD;r>=-1;r--){
        barred=effectsNear(w.prov,r);
        nearOk=cats.filter(c=>inCatOf(c).some(it=>!barred.has(itemEffectKey(it))));
        if(nearOk.length) break;
      }
      if(!nearOk.length){ nearOk=cats; barred=new Set(); }
      // Lowest count IN THIS REGION first; the world tally breaks ties, so the map stays level too.
      const low=Math.min(...nearOk.map(c=>rc[c]||0));
      const tiedR=nearOk.filter(c=>(rc[c]||0)===low);
      const lowW=Math.min(...tiedR.map(c=>catCount[c]||0));
      const pool=shuffleP(tiedR.filter(c=>(catCount[c]||0)===lowW));
      const cat=pool[0];
      const inCat=inCatOf(cat);
      // Effect filter: never an effect barred nearby while any alternative exists, then prefer a
      // design nothing on the map carries yet.
      let cand=inCat.filter(it=>!barred.has(itemEffectKey(it)));
      if(!cand.length) cand=inCat;
      cand=preferFreshEffects(cand, takenEff);
      // …and of those, the effect with the most copies still in the treasury, so a design that
      // exists under many names is spread over the whole map rather than left to pile up in the
      // last lairs stocked (where the bar above would have nothing else to offer).
      { const n={}; cand.forEach(it=>{ const k=itemEffectKey(it); n[k]=(n[k]||0)+1; });
        const most=Math.max(...Object.values(n)); cand=cand.filter(it=>n[itemEffectKey(it)]===most); }
      const pick=cand[Math.floor(kcRng()*cand.length)];
      give(w.f,pick,w.region,w.provId); w.slots--;
    }
  }
  // Item 5, repair: on the largest maps the last Weak lairs stocked can have nothing left but an
  // effect already close by. Swap such a lair's item with another freshly stocked lair's item of the
  // same kind and tier (so every count above is unchanged) whenever that moves the two repeats
  // further apart. A swap is only made if the closer of the two pairs ends up further away.
  const one=work.filter(w=>w.f.hoardItems.length===1&&!isLegendaryItem(w.f.hoardItems[0]));
  const holders=new Map();   // effect → lairs holding it
  const hk=(w)=>itemEffectKey(w.f.hoardItems[0]);
  one.forEach(w=>{ const k=hk(w); if(!holders.has(k)) holders.set(k,[]); holders.get(k).push(w); });
  const gap=(w,k,skip)=>{ let m=Infinity; for(const v of (holders.get(k)||[])){ if(v===w||v===skip) continue; const d=hexDistP(w.prov,v.prov,_cols); if(d<m) m=d; } return m; };
  for(let pass=0;pass<2;pass++){
    for(const w of one){
      const ka=hk(w), gw=gap(w,ka);
      if(!(gw<=LAIR_EFFECT_SPREAD)) continue;
      const a=w.f.hoardItems[0];
      let best=null, bestMin=gw;
      for(const v of one){
        if(v===w) continue;
        const b=v.f.hoardItems[0], kb=itemEffectKey(b);
        if(kb===ka||b.tier!==a.tier||itemHoardCategory(b)!==itemHoardCategory(a)) continue;
        const before=Math.min(gw,gap(v,kb));
        if(before>=bestMin&&best) continue;
        const after=Math.min(gap(w,kb,v),gap(v,ka,w));
        if(after>before&&after>bestMin){ best=v; bestMin=after; }
      }
      if(!best) continue;
      const b=best.f.hoardItems[0], kb=itemEffectKey(b);
      holders.set(ka,holders.get(ka).filter(x=>x!==w).concat([best]));
      holders.set(kb,holders.get(kb).filter(x=>x!==best).concat([w]));
      w.f.hoardItems[0]=b; best.f.hoardItems[0]=a;
    }
  }
}
