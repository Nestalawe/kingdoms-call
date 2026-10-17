// ── EQUIPMENT SLOTS ────
// Worn/wielded items occupy a slot; only ONE per slot (two rings) can be EQUIPPED, and only
// equipped slot items give their effect. Everything without a slot is always active.
// `activeItems(c)` is the single gate every effect read goes through; it normalises first
// (auto-equips an empty slot with the first item held, trims any over-cap), so pre-existing saves
// and new pick-ups need no migration.
const ITEM_SLOT_CAP={...KC_ITEM_SLOT_CAP}; // shield slot added 2026-09-10 · combat ×2 added 2026-09-11
const ITEM_SLOT_OF={
  'Blade of Fury':'weapon','Elven Longbow':'weapon','Staff of the Wildwood':'weapon','Sword of the First Emperor':'weapon','Black Sceptre':'weapon',
  'Warbringer Gauntlets':'armour','Gloves of the Nightcrawler':'armour','Boots of the Wind':'armour',
  'Tower Shield of the Wall':'shield','Anvil-Brand Shield':'shield','Shield of the Innocent':'shield', // shield slot; overrides any stale inline slot — see itemSlot
  "Traveller's Cloak":'cloak','Shadowcloak':'cloak','Veil of Illusions':'cloak','Cloak of Many Faces':'cloak',
  "Sage's Crown":'helm','Crown of Command':'helm','Imperial Regalia':'helm',
  'Ring of the Explorer':'ring',"Death's Finger Ring":'ring',"Siege Master's Ring":'ring','Ring of Wealth':'ring',
  'Mithril Armour':'armour', // the granted suit now occupies the armour slot
  "Mind's Eye Amulet":'amulet','Amulet of Fortitude':'amulet','Iron Heart Talisman':'amulet','Eagle-Eye Pendant':'amulet',"Legionnaire's Mark":'amulet',
};
// the two alternate-named clones of every tier-1/2 item share the base item's slot (previously
// 'Sword of Wrath' etc. had no slot and so were ALWAYS active, bypassing Equip Items).
const _ITEM_ALT_BASE={}; Object.entries(_ITEM_NAME_ALTS).forEach(([base,alts])=>alts.forEach(a=>{_ITEM_ALT_BASE[a]=base;}));
const _SHIELD_BASES=new Set(['Tower Shield of the Wall','Anvil-Brand Shield','Shield of the Innocent','Kite Shield of the Marches','Bronze Buckler','Oaken Roundshield','Mirror-Bright Shield','Shield of the Ward-Saints','Dragonbone Shield']);
function itemSlot(it){ if(!it) return null;
  // a SHIELD is a shield even when its power is a once-per-fight ward - the Anvil-Brand Shield is
  // strapped to the arm, not drunk. The shield test therefore comes first.
  if(_SHIELD_BASES.has(_ITEM_ALT_BASE[it.name]||it.name)) return 'shield';
  if(it.effect&&it.effect.stat==='combatUse') return 'combat'; // every other potion, scroll or device is a COMBAT ITEM and takes a Combat Item slot (two per character). This test runs BEFORE `it.slot` is read, so items saved with the old inline slot:'consumable' re-resolve here with no migration.
  if(it.effect&&it.effect.stat==='mithrilArmour') return 'armour';  // Mithril is worn in the armour slot // 2026-09-10: shields moved to their own slot — beats a stale inline slot on a saved copy
  if(it.slot!==undefined) return it.slot||null; return ITEM_SLOT_OF[it.name]||ITEM_SLOT_OF[_ITEM_ALT_BASE[it.name]]||null; }

const LEGENDARY_NAMES_P=new Set(LEGENDARY_ITEMS_P.map(it=>it.name));

// == ITEM TIERS AND STOCK ====
// FOUR tiers, named for the guardians that hold them: 1 Weak, 2 Moderate, 3 Powerful, 4 LEGENDARY.
// A lair holds exactly one item, of its own guardian's tier, so the tier a player sees IS the
// danger they beat. Three things happen in this pass, in order:
//
// 1. SCORE every curated design on how much it actually does in play (itemPowerScore).
// 2. RE-TIER by that score, kind by kind, so the simplest items are Weak and the strongest are
// LEGENDARY - the tier written in the table above is only a starting hint and is overwritten.
// Band sizes follow how common each guardian is, so the stock roughly matches the demand.
// 3. TOP UP any (kind x tier) that is short, by minting further named versions of the designs
// already in that band. Combat items and legendary relics are NEVER minted: one name each.
//
// Item count falls from ~860 to ~600 because a lair now takes one item instead of up to three.
// ══ ITEM ROLE — what an item is FOR, the axis that gates its tier (Toby, 2026-09-24) ══
// Rule 1: a Weak (easy) lair holds nothing that helps a hero in a fight; it holds the kit of the heroes
// doing OTHER jobs — leading armies, spying, thieving, exploring, running the purse. Rule 2: Moderate
// holds the first rung of combat kit. Rule 3: Powerful the second rung. (Rule 4, legendary relics, is
// the curated list — a separate piece of work.) Strength still orders items WITHIN a band; role decides
// which bands an item may hold at all. Role is read from the same `effect.stat` the duel engine reads
// (pcCharCombatant), so an item can never be filed as combat for a power it does not have.
//   COMBAT  : melee, archery, maxHp, armour wards, pc riders, combat-use consumables, temper, aura, and
//             the duel schools elemental / white / illusory (measured 2026-09-24: a +1 in any of these is
//             worth a +1 weapon or a DR-1 armour in a lair fight — claude/claude_school_study_0924.js);
//             a +2 or better in psychic / necromancy; any utility stat that carries a pc rider.
//   UTILITY : the field skills (tactical, march, naval, sage, spy, thief, explorer, druid), tax and army
//             and unit-type bonuses, siege, home defence, fleet, spell charms, oracle/hidden/promote,
//             and a +1 in psychic or necromancy (measured: worth less than the weakest ward in the game,
//             and both are realm schools — the spy's and the army-raiser's) — but ONLY when that +1
//             carries no pc rider of its own; a rider makes it combat whatever the stat (2026-09-27).
// A combat item's floor is Moderate; a utility item may sit anywhere. Toby's ruling: a utility item in a
// weapon/armour/shield slot (Boots of the Wind, Tyrant's Sceptre) stays eligible for Weak — giving up
// the slot to carry it is the trade.
const ITEM_COMBAT_STATS=new Set(['melee','archery','maxHp','armour','mithrilArmour','pc','combatUse','temper','aura']);
const ITEM_DUEL_SCHOOLS=new Set(['elemental','white','illusory']);
const ITEM_FIELD_SCHOOLS=new Set(['psychic','necromancy']);
function itemRole(it){
  const e=(it&&it.effect)||{}; const s=e.stat;
  if(ITEM_COMBAT_STATS.has(s)||ITEM_DUEL_SCHOOLS.has(s)) return 'combat';
  // A pc RIDER outranks the stat it rides on (2026-09-27). The field-schools test used to run first
  // and return early, so a Necromancy +1 item carrying a duel effect - Rod of the Pale Court, a DR-2
  // ward against undead and fiends - was filed utility and could sit in a Weak lair, against rule 1.
  // The rider is read the same way pcCharCombatant reads it, so this cannot file anything as combat
  // for a power it does not have.
  if(e.pc) return 'combat';
  if(ITEM_FIELD_SCHOOLS.has(s)) return ((e.bonus||0)>=2)?'combat':'utility';
  return 'utility';
}
// the lowest ordinary tier an item may hold: combat never below Moderate
function itemTierFloor(it){ return itemRole(it)==='combat'?2:1; }
function itemAllowedInTier(it,t){ return isLegendaryItem(it) ? t===4 : (t>=itemTierFloor(it)&&t<=3); }
// Stock per kind, per tier, per ROLE: [utility, combat]. Weak is sized like the old 306-item tier
// (a ten-realm map seats ~240 Weak lairs and every name is unique game-wide), all of it utility;
// Moderate and Powerful carry a utility minority (the +2 field skills, the big ledgers and horns) beside
// the combat kit. Weapon at Powerful stays 25: every one is a hand-written design.
const ITEM_TIER_TARGET={
  1:{trinket:[90,0],ring:[50,0],amulet:[40,0],cloak:[40,0],helm:[40,0],weapon:[12,0],armour:[12,0],shield:[4,0],combat:[0,0]},
  2:{trinket:[12,12],ring:[8,16],amulet:[5,20],cloak:[5,20],helm:[5,20],weapon:[2,30],armour:[2,36],shield:[0,30],combat:[0,70]}, // combat items are one name each (never minted), so their band is simply every design worth its floor
  3:{trinket:[4,6],ring:[2,8],amulet:[2,8],cloak:[2,8],helm:[2,8],weapon:[1,25],armour:[0,10],shield:[0,10],combat:[0,12]},
};
function itemTierTarget(tier,cat,role){ const o=(ITEM_TIER_TARGET[tier]||{})[cat]||[0,0]; return role==null?(o[0]+o[1]):(role==='utility'?o[0]:o[1]); }
// A COMBAT item must also be worth its band: Powerful takes nothing under 4.5 (more than a bare +1
// skill, which scores 3), Moderate nothing under 2 (a DR-1 ring, 1.2, is filler). A band the designs
// cannot fill is topped up by minting from what did qualify, never by promoting a trinket.
const ITEM_COMBAT_SCORE_FLOOR={3:4.5,2:2.0};

// --- How strong is this item, really? ------------------------------------------------------ One
// number per item, on a rough 0-10 scale, so that "simplest" and "strongest" mean something a
// machine can sort. Every branch reads the SAME effect fields the combat engine reads, so an item
// cannot score for a power it does not actually have.
function _wardScore(fx){
  if(!fx||!fx.ward) return 0;
  const w=fx.ward, a=fx.amt||0, p=fx.pct||0;
  const FLAT={stunImmune:3,dotImmune:3,firstHit:2.5,secondWind:4,buckler:2.5};
  if(FLAT[w]!=null) return FLAT[w]+(p?p/10:0);
  if(['meleeDR','arrowDR','natureDR','darkDR','thorns','regen','roundWard'].includes(w)) return a*1.2; // roundWard is an AMOUNT (a ward of N a round) — it scored 0 while listed among the percentages, which dropped the Shield of the Ward-Saints from the treasury
  if(['dodge','block','arrowBlock','spellBlock','spellPct','cap','lowHp','openGuard','resist'].includes(w)) return p/7;
  return 2;
}
function _pcScore(pc){
  if(!pc) return 0;
  return (pc.hitBonus||0)/4+(pc.dmgBonus||0)*1.2+(pc.burn||0)*1.5+(pc.drain||0)*5+(pc.aura||0)/4+_wardScore(pc);
}
function _useScore(e){
  const avg=a=>a?(a[0]+a[1])/2:0;
  switch(e.use){
    case 'heal': return (e.amt||5)/2.5;
    case 'hot': return ((e.amt||3)*(e.rounds||3))/3;
    case 'secondwind': return (e.amt||10)/2.5+1;
    case 'dmg': case 'bane': case 'banestun':
      return avg(e.dmg)/3*(e.times||1)+(e.dot?e.dot[0]*e.dot[1]/2:0)+(e.stun||0)*2+(e.hitPen||0)/6+(e.use==='dmg'?0:-1);
    case 'drain': return avg(e.dmg)/2.2;
    case 'stun': return (e.stun||1)*2.5;
    case 'pen': return (e.hitPen||15)/6;
    case 'weak': return 2.5*((e.melee||0)+(e.archery||0));
    case 'buff': return 3*((e.melee||0)+(e.archery||0));
    case 'focus': return (e.hitBonus||10)/4;
    case 'absorb': return (e.absorb||10)/3+(e.reflect||0);
    case 'mirror': return (e.images||2)*1.5;
    case 'flee': return (e.fleeBonus||25)/12+(e.toHitReduce||0)/8;
    case 'invis': return (e.toHitReduce||25)/6;
    case 'terror': return 3+(e.hitPen||15)/10;
    case 'silence': return (e.rounds||3)*1.2;
    case 'dispel': return 3;
    default: return 3;
  }
}
function itemPowerScore(it){
  if(!it) return 0;
  const e=it.effect||{};
  let s=0;
  if(e.stat==='combatUse') s=_useScore(e);
  else if(e.stat==='maxHp') s=(e.bonus||0)*0.7;
  else if(e.stat==='armour'||e.stat==='mithrilArmour') s=_wardScore(e)+(e.bonus||0)*3;
  else if(e.stat==='pc') s=0;
  else if(e.stat==='taxBonus') s=(e.bonus||0)*1.2;
  else if(e.stat==='temper') s=3;
  else if(e.stat==='castSpell'){
    // A charm that casts a spell once a turn: worth what the spell is worth, so a Resurrect charm
    // is
    // not filed beside a +1 trinket. SPELL_DEFS_P is a `const` declared FURTHER DOWN the file, and this
    // pass runs at load - `typeof` does NOT save you from a temporal-dead-zone const, it throws too
    // (the same trap that once hung the portal on the loading spinner), so the read is wrapped.
    let _sl=0; try{ const sp=SPELL_DEFS_P[e.spell]; _sl=(sp&&(sp.level||sp.lvl||sp.minLevel))||0; }catch(_e){ _sl=0; }
    s=3+(_sl||2)*1.2;
  }
  else if(typeof e.bonus==='number') s=(e.bonus||0)*3;
  else s=3;                                   // a one-off power with no number to read
  if(e.pc) s+=_pcScore(e.pc);
  // A realm-wide effect (a banner worth +25 army strength, say) would otherwise swamp the scale;
  // the ordering is all that matters here, so the top end is clamped. NOTE: this means two
  // realm-wide items of different size can score alike - the unslotted pile is therefore not
  // compared against the relics on this scale (see the harness), because an army banner and a
  // duelling ring are not the same kind of thing measured the same way.
  return Math.min(12, Math.round(s*10)/10);
}

const _VARIANT_EPITHETS=['of the Long March','of Grey Water','of the Ninth Hour','of the Old Road','of the Broken Field','of the Quiet Watch','of the Last Winter','of the Wandering Host','of Thornfall','of the Cold Ford','of the Iron Year','of the Second Vigil'];

(function _retierAndBalanceItems(){
  // the legendary tier is now the curated LEGENDARY_ITEMS_P list and nothing else. Any older entry
  // bearing a relic's name (and any alt-named clone of one) is removed outright, so a relic's
  // effect exists exactly once in the whole treasury, and the relic itself is re-added from the
  // list below.
  const curated=ALL_MAGIC_ITEMS_P.filter(it=>!it._variantOf
    && !LEGENDARY_NAMES_P.has(it.name)
    && !LEGENDARY_NAMES_P.has(_ITEM_ALT_BASE[it.name]||''));
  ALL_MAGIC_ITEMS_P.length=0;
  curated.forEach(it=>{ it.tier=(it.tier===3||it.tier===4)?2:it.tier; ALL_MAGIC_ITEMS_P.push(it); }); // drop the old tier-3 "legendary" hint
  LEGENDARY_ITEMS_P.forEach(it=>ALL_MAGIC_ITEMS_P.push(it));

  const byCat={};
  ALL_MAGIC_ITEMS_P.forEach(it=>{ const c=itemHoardCategory(it); (byCat[c]=byCat[c]||[]).push(it); });

  Object.keys(byCat).forEach(cat=>{
    const list=byCat[cat];
    // An alt-named clone must land in the same tier as its base, so tier only the BASES and let the
    // clones follow. (_ITEM_ALT_BASE maps a clone's name back to its base.)
    const bases=list.filter(it=>!_ITEM_ALT_BASE[it.name]);
    const tierScoreOf={};
    bases.forEach(it=>{ it._score=itemPowerScore(it); tierScoreOf[it.name]=it._score; });
    bases.sort((a,b)=>(a._score-b._score)||a.name.localeCompare(b.name));
    // LEGENDARY is exactly the curated relic list - never a promotion by score.
    const legs=LEGENDARY_NAMES_P;
    bases.forEach(it=>{ if(legs.has(it.name)) it.tier=4; });
    // Everything that is not a relic - bases AND their alt-named clones - is ranked by score, then
    // SPLIT BY ROLE (itemRole) and each role banded on its own: Powerful takes the strongest of the
    // role up to its (kind x tier x role) target, Moderate the next, Weak the next - and a COMBAT item
    // never falls below Moderate (itemTierFloor), so a Weak lair holds nothing that helps in a
    // fight. A clone carries its base's score. Whatever no band has room for is the weakest material
    // of its kind and role and is DROPPED from the treasury outright.
    const ordinary=list.filter(it=>!legs.has(it.name));
    if(!ordinary.length) return;
    ordinary.forEach(it=>{ const b=_ITEM_ALT_BASE[it.name]; it._score=(b&&tierScoreOf[b]!=null)?tierScoreOf[b]:itemPowerScore(it); });
    // Strongest first. Among items of equal worth, a CURATED design outranks a repeated name and a
    // race- or alignment-bound design outranks a plain one, so the material that gets shed is the
    // interchangeable filler rather than something written for a particular people.
    const _rank=it=>((_ITEM_ALT_BASE[it.name]||it._variantOf)?2:0)+((it.race||it.alignment)?-1:0);
    ordinary.sort((a,b)=>(b._score-a._score)||(_rank(a)-_rank(b))||a.name.localeCompare(b.name));
    ['utility','combat'].forEach(role=>{
      const pool=ordinary.filter(it=>itemRole(it)===role);
      let k=0;
      [3,2,1].forEach(t=>{
        let n=0; const want=itemTierTarget(t,cat,role);
        const floor=(role==='combat'&&ITEM_COMBAT_SCORE_FLOOR[t])||0;
        while(k<pool.length&&n<want){ const it=pool[k]; if(!itemAllowedInTier(it,t)||it._score<floor) break; it.tier=t; n++; k++; } // pool is strongest-first, so the first item under the band's floor ends the band
      });
      for(;k<pool.length;k++) pool[k]._drop=true;
    });
  });

  // --- Top up short (kind x tier) bands with minted versions ------------------------------- Shed
  // the surplus decided above before topping up, so a band is never filled with material that is
  // about to be thrown away.
  { const keep=ALL_MAGIC_ITEMS_P.filter(it=>!it._drop);
    ALL_MAGIC_ITEMS_P.length=0; keep.forEach(it=>{ delete it._drop; ALL_MAGIC_ITEMS_P.push(it); }); }
  const taken=new Set(ALL_MAGIC_ITEMS_P.map(it=>it.name));
  const minted=[];
  HOARD_CATEGORIES.forEach(cat=>{
    const bank=_VARIANT_BANK[cat]; if(!bank) return; // combat items have no bank: one name each, by ruling
    const nounsFor=(seed)=>{
      if(cat!=='weapon') return bank.noun;
      const st=(seed.effect||{}).stat;
      if(st==='archery') return bank.bow;
      // Magic schools AND command relics take a staff, rod or sceptre; blades and hafts are for the
      // items that sharpen the bearer's own arm.
      if(['white','psychic','illusory','elemental','necromancy','druid','undeadBonus','armyBonus','taxBonus','tactical','naval','sage'].includes(st)) return bank.focus;
      return bank.noun;
    };
    const namesFor=(seed)=>{
      const nouns=nounsFor(seed), out=[];
      bank.adj.forEach(a=>nouns.forEach(nn=>out.push(a+' '+nn)));
      _VARIANT_EPITHETS.forEach(e=>nouns.forEach(nn=>out.push(nn+' '+e)));
      return out;
    };
    [1,2,3].forEach(t=>['utility','combat'].forEach(role=>{
      const want=itemTierTarget(t,cat,role);
      const inBand=ALL_MAGIC_ITEMS_P.filter(it=>it.tier===t&&itemHoardCategory(it)===cat&&itemRole(it)===role);
      // Seeds are of the SAME ROLE as the slots they fill (a Weak ring is minted from a Weak ring, never
      // from a duelling ring), usable by anyone, and never a combat-use item (one name each, by
      // ruling). If a band holds nothing but race- or alignment-bound designs, seed from those
      // instead and let the minted versions carry the same binding - a short band would otherwise
      // leave the stocker handing that kind's lairs an item of the wrong tier.
      const plain=it=>!(it.effect&&it.effect.stat==='combatUse');
      let seeds=inBand.filter(it=>plain(it)&&!it.race&&!it.alignment);
      if(!seeds.length) seeds=inBand.filter(plain);
      if(!seeds.length) return;
      let made=inBand.length, si=0, guard=0; const cursor={};
      while(made<want&&guard++<3000){
        const seed=seeds[si++%seeds.length];
        const names=namesFor(seed);
        let k=cursor[seed.name]||0, nm=null;
        while(k<names.length){ const cand=names[k++]; if(!taken.has(cand)){ nm=cand; break; } }
        cursor[seed.name]=k;
        if(!nm) continue;
        taken.add(nm);
        minted.push({...seed, effect:{...seed.effect}, name:nm, slot:(cat==='trinket'?undefined:cat), tier:t, _variantOf:seed.name});
        made++;
      }
    }));
  });
  minted.forEach(it=>{ if(it.slot===undefined) delete it.slot; ALL_MAGIC_ITEMS_P.push(it); });

  // --- Rebuild the derived tables ----------------------------------------------------------
  [1,2,3,4].forEach(t=>{ ITEMS_BY_TIER[t].length=0; });
  ALL_MAGIC_ITEMS_P.forEach(it=>{
    ITEMS_BY_TIER[it.tier||1].push(it);
    if(it.lore&&!ITEM_LORE_BY_NAME[it.name]) ITEM_LORE_BY_NAME[it.name]=it.lore;
  });
})();

// Items already sitting in a save carry whatever tier they were given when they were rolled.
// Re-stamp them from the master table by name on load, so a relic won three turns ago still scores
// as legendary and a Weak find still reads as Weak. Runs beside ensureAllLairHoards at the head of
// every turn.
function migrateItemTiers(gs){
  if(!gs) return;
  const byName=new Map(); ALL_MAGIC_ITEMS_P.forEach(it=>byName.set(it.name,it));
  // An item the treasury no longer carries (dropped from a band in a later re-cut) keeps its own tier,
  // but never below its ROLE's floor - a healing draught in a pack is Moderate whatever it was rolled as.
  const fix=(it)=>{ if(!it||!it.name) return; const m=byName.get(it.name)||byName.get(_ITEM_ALT_BASE[it.name]); if(m){ if(it.tier!==m.tier) it.tier=m.tier; } else if(!isLegendaryItem(it)&&(it.tier||1)<itemTierFloor(it)) it.tier=itemTierFloor(it);
    // 2026-10-13 (item 7, Toby): an item rolled before the descriptions named their school with a
    // capital ("casts Charm (Psychic Magic)") carries the old lower-case copy; mend it in place.
    if(typeof it.desc==='string') it.desc=it.desc.replace(/\((white|psychic|illusory|elemental|necromancy)\)/g,(w,k)=>`(${SKILL_LABELS[k]||k})`); };
  (gs.characters||[]).forEach(c=>(c.items||[]).forEach(fix));
  ((gs.world&&gs.world.provinces)||[]).forEach(p=>(p.features||[]).forEach(f=>{ if(f) (f.hoardItems||[]).forEach(fix); }));
  (gs.players||[]).forEach(pl=>{ if(pl&&Array.isArray(pl.vault)) pl.vault.forEach(fix); });
}

function normaliseEquipment(c){
  if(!c||!Array.isArray(c.items)) return;
  const count={};
  c.items.forEach(it=>{ if(it&&!itemUsableBy(it,c)){ if(itemSlot(it)) it.equipped=false; return; } const sl=itemSlot(it); if(!sl){ if(it&&it.equipped!==undefined) delete it.equipped; return; }
    if(it.equipped===true){ if((count[sl]||0)>=ITEM_SLOT_CAP[sl]) it.equipped=false; else count[sl]=(count[sl]||0)+1; } });
  c.items.forEach(it=>{ if(it&&!itemUsableBy(it,c)) return; const sl=itemSlot(it); if(!sl||it.equipped===true) return;
    if((count[sl]||0)<ITEM_SLOT_CAP[sl]){ it.equipped=true; count[sl]=(count[sl]||0)+1; } else it.equipped=false; });
}
// 2026-10-13 (Toby, item 10): every time a hero gains an item, the report says whether they put
// it on at once or have no room for it. Call it AFTER the items are in `ch.items`: a gained item's
// old `equipped` flag (from its last owner) is dropped, normaliseEquipment re-slots it exactly as
// every effect read will, and the line says what came of it. Returns '' when there is nothing to
// say.
const KC_SLOT_WORDS={weapon:'weapon slot',armour:'armour slot',shield:'shield slot',cloak:'cloak slot',helm:'helm slot',ring:'both ring slots',amulet:'amulet slot',combat:'both combat-item slots'};
function gainedItemNote(ch, items){
  if(!ch||!Array.isArray(ch.items)) return '';
  const got=(items||[]).filter(it=>it&&ch.items.includes(it));
  if(!got.length) return '';
  got.forEach(it=>{ delete it.equipped; });
  normaliseEquipment(ch);
  return '🎒 '+got.map(it=>{
    const nm='the '+it.name;
    if(!itemUsableBy(it,ch)) return `${ch.name} cannot use ${nm} and carries it unused.`;
    const sl=itemSlot(it);
    if(!sl) return `${nm[0].toUpperCase()+nm.slice(1)} needs no slot: it works for ${ch.name} at once.`;
    if(it.equipped===true) return `${ch.name} equips ${nm} at once.`;
    const worn=ch.items.filter(x=>x&&x!==it&&x.equipped===true&&itemSlot(x)===sl).map(x=>'the '+x.name);
    return `${ch.name} has no room to equip ${nm}: ${worn.length?`the ${KC_SLOT_WORDS[sl]||sl+' slot'} already ${worn.length>1?'hold':'holds'} ${worn.join(' and ')}`:`the ${KC_SLOT_WORDS[sl]||sl+' slot'} is full`}, so it goes in the pack (an Equip Items order can swap it in).`;
  }).join(' ');
}
function activeItems(c){ if(!c||!Array.isArray(c.items)) return []; normaliseEquipment(c); return c.items.filter(it=>it&&itemUsableBy(it,c)&&(!itemSlot(it)||it.equipped===true)); }
// Does the character carry (active/equipped) an item whose BASE name is `base`? Resolves the two
// alternate names of every tier-1/2 item, so 'Falcon\'s Quiver' counts as the Quiver of the Hawk.
function hasItemBase(c, base){ return activeItems(c).some(it=>it&&it.name&&((_ITEM_ALT_BASE[it.name]||it.name)===base)); }
// the temper a character FIGHTS with — an equipped temper item overrides their own.
function effTemper(c){ if(!c) return 'Brave'; const it=activeItems(c).find(x=>x&&x.effect&&x.effect.stat==='temper'&&x.effect.temper); return (it&&it.effect.temper)||c.temper||'Brave'; }

