// ── INLINE GAME GENERATION ENGINE ────
// Self-contained mini game engine for the portal
// (mirrors the logic in kingdoms-call-gm.html / game.js)

const TERRAIN_COLORS_P={...KC_TERRAIN_COLORS};
const RACES_P=KC_HUMANOID_RACES.slice();
// The four playable humanoid races, as a Set, for world-gen membership tests (a province race is
// either one of these, null for open sea, or a 'Primal:<sub-race>' string).
const HUMANOID_RACES_GEN=new Set(RACES_P);
const LAND_TERRAINS_GEN=['plain','desert','forest','jungle','mountain'];
// Each race's heartland. Province race allocation is weighted towards these terrains, so most Human
// provinces are plains, most Elven ones forest, and so on — while any race can still turn up
// anywhere. See the allocation pass in generateNewGame.
const SIGNATURE_TERRAIN_P={Human:'plain',Elven:'forest',Dwarven:'mountain',Orcish:'desert'};
// How much more likely a race is to be placed in its signature terrain than in any other. 6 puts
// roughly two thirds of a terrain's provinces with its signature race while leaving every race
// genuinely possible everywhere.
const SIGNATURE_WEIGHT_P=6;

// Every humanoid province offers 2 or 3 recruitable land types PLUS its racial garrison (and, on a
// coast, its race's fleet). 2026-10-14 (Toby, item 15): two three times in four, three one time in
// four (provincePoolSize), chosen at random from the units of the province's race that suit its
// terrain — its PROVINCE_ARMIES_P cell, never a unit from another terrain. A cell with only two land
// units (Human forest, Elven desert and mountain, Dwarven forest) always gives both.
// 2026-09-12: there were too many humanoid flyers in play. Half the provinces that would have
// offered one now offer another ground unit of the same cell instead, where the cell has one to
// spare; where it has none, the flyer stays (since item 15 nothing is borrowed from another terrain).
// The king's home province is untouched (fullRaceLandRoster always grants the complete racial roster).
function provincePoolSize(rnd){ return (rnd||kcRng)()<0.75?2:3; }
const GEN_FLYER_TYPES=new Set(KC_UNIT_CLASS.flying);
const FLYER_PROVINCE_KEEP=0.5; // share of would-be flyer offers that survive
function buildHumanoidPool(terrain, race, count, rnd){
  const full=(PROVINCE_ARMIES_P[terrain]||{})[race]||['Shieldwall Levies'];
  const garrison=full.filter(t=>t.toLowerCase().includes('garrison'));
  const local=full.filter(t=>!t.toLowerCase().includes('garrison') && !SEA_TYPES_GEN.has(t));
  const shuffled=shuffleP(local, rnd);
  const types=shuffled.slice(0,count);
  // Ground units this province could offer instead of a flyer: only its own terrain's (item 15:
  // every unit offered suits the province). A cell with nothing to spare keeps its flyer.
  const localSpare=shuffled.slice(count).filter(t=>!GEN_FLYER_TYPES.has(t));
  for(let i=0;i<types.length;i++){
    if(!GEN_FLYER_TYPES.has(types[i])) continue;
    if(rnd()<FLYER_PROVINCE_KEEP) continue;                       // this one keeps its flyers
    let sub=null;
    while(localSpare.length&&!sub){ const t=localSpare.shift(); if(!types.includes(t)) sub=t; }
    if(sub) types[i]=sub;                                          // otherwise nothing to swap to — keep the flyer
  }
  return{types, garrison};
}
// A king's home province recruits EVERY land unit of his race — not just the roster of the home's
// own terrain. Union of the race's PROVINCE_ARMIES_P cells across all land terrains, non-garrison
// types first (in table order), the racial garrison last. Fleets are never added here: a coastal
// home earns its racial fleet through the coastal / Naval-skill rules.
function fullRaceLandRoster(race){
  const seen=new Set(), types=[], garrison=[];
  LAND_TERRAINS_GEN.forEach(t=>{
    ((PROVINCE_ARMIES_P[t]||{})[race]||[]).forEach(u=>{
      if(seen.has(u)||SEA_TYPES_GEN.has(u)) return;
      seen.add(u);
      (u.toLowerCase().includes('garrison')?garrison:types).push(u);
    });
  });
  return [...types,...garrison];
}
// ── WORLD-GEN TUNING ── Share of LAND provinces that are Primal (wild Creature / Monster country).
// The remainder is split exactly equally between the four humanoid races.
const PRIMAL_LAND_CHANCE=0.30;
// Share of coastal HUMANOID provinces that also offer their race's naval unit, on top of their 2-3
// land types and their garrison. Primal and raceless coasts never offer one.
const COASTAL_NAVAL_CHANCE=0.80;
// Recruitable naval/fleet unit types (used during map generation, e.g. to keep them out of a king's
// starting land armies). Mirrors SEA_TYPES used in the resolution engine. 2026-09-17: a humanoid
// shipyard province turns out TWO hulls a season, not one. Every province offering one of these
// five types raises its per-turn recruit cap for that type from 1 to 2, the same allowance
// garrisons have had. Fleets are the slowest thing in the game to accumulate (one race, one hull
// type, only on a coast) and a navy was taking twice as long to build as an army. Read through
// twoATurn below.
const HUMANOID_FLEET_TYPES=new Set(['Galleon Fleet','Corsair Fleet','Elven Galleys','Dwarf Ironclads','Orcish Longships']);
// The types a province raises TWO of in a turn: garrison units, the humanoid fleets, and — 2026-10-11
// (Toby, the army roster, decision 9) — the Goblin Horde wherever it is offered (the horde's numbers are
// its point). Everything else is one a turn outside the founder's own capital, which turns out two of
// anything. Read by getRecruitLimit (the engine's gate) and by the order form's `maxPerTurn` payload
// (buildTurnReport); tests/goblins-two-a-turn holds the two together.
function twoATurn(armyType){ const t=String(armyType||''); return t.toLowerCase().includes('garrison')||HUMANOID_FLEET_TYPES.has(t)||t==='Goblin Horde'; }
const SEA_TYPES_GEN=new Set(KC_UNIT_CLASS.sea);

// DRUID ARMY LEVEL TABLE — a commander's Druid must be >= a unit's level, or it fights at −20% per
// level short. A commander leads his OWN race's units as if he had Druid 1.
// 2026-09-27 (Toby: collapse to one source): this table used to exist THREE times — here and twice
// in the player portal — and the player-portal copies had drifted (they lacked level 1, so a
// foreign-race unit under a Druid-0 commander showed no penalty while the engine applied −20%).
// The ONE copy is now KC_DRUID_LEVELS in kingdoms-call-data.js; this builds the engine's Sets
// from it, in the same level order (getDruidLevel walks the levels ascending).
const DRUID_ARMY_LEVELS_P=Object.fromEntries(Object.entries(KC_DRUID_LEVELS).map(([lvl,types])=>[lvl,new Set(types)]));

// sd40 Dragon Taming: the winged beasts a realm with the discovery leads without any Druid penalty
// (Gnomish Gyrocopters are machines, not beasts, and are deliberately NOT tamed).
const TAMED_FLYER_TYPES_D=new Set(KC_UNIT_CLASS.tamedFlyer);
// Returns the Druid level required to lead a given army type
// The unit's TYPE word (2026-10-11): infantry, ranged, cavalry, flyer or naval, from the shared
// KC_UNIT_TYPE table. Anything the table has never heard of (an old save, a test fixture) is infantry,
// which is what such a unit already does in battle: it holds a place in the line.
function unitTypeOf(armyType){ return (typeof KC_UNIT_TYPE!=='undefined'&&KC_UNIT_TYPE[armyType])||'infantry'; }
function getDruidLevel(armyType){
  for(const [lvl, armies] of Object.entries(DRUID_ARMY_LEVELS_P)){
    if(armies.has(armyType)) return parseInt(lvl);
  }
  return 0; // own race / unknown defaults to 0
}

// Returns the effective quality after druid shortfall penalty shortfall of N = -N quality tiers
// (each missing level = 20% str penalty)
// ── BEAST COMMAND (2026-10-12, Toby item 24) ── A hero may lead only as many Creature and Monster units as his Druid
// level. Counted: every living beast in the column — not skeletons (the dead need no Druid), nor a summoned grove,
// Wild Hunt beasts or phantoms, which leave at the turn's end. A realm's own heroes only (a province's chieftain
// commands its own beasts). The rule bites where a beast would JOIN a column (Recruit Armies, Pick Up Army,
// Leave/Transfer to a hero, Wild Calling): a hero already over it keeps what he leads and takes on no more.
const BEAST_CMD_TYPES=new Set([...KC_UNIT_CLASS.creature,...KC_UNIT_CLASS.monster]);
function beastCommandCount(a){ return !!a&&BEAST_CMD_TYPES.has(a.type)&&!a._isSkeletal&&!a._temporary&&a._wildHuntUntilTurn==null&&!a._phantom; }
function beastsLed(c){ return ((c&&c.armies)||[]).filter(beastCommandCount).length; }
function beastCommandRoom(c, chars){ if(!c||c.player==null) return Infinity; return Math.max(0, (effSkillOf(c,'druid',chars||[])|0)-beastsLed(c)); }
function beastCommandWords(c, chars){ const d=effSkillOf(c,'druid',chars||[])|0; return `${c.name} can lead only ${d} Creature or Monster unit${d!==1?'s':''} (Druid ${d})`; }
function druIdPenaltyMult(heroChar, army, playerAlignment, tamed){
  // Skeletal armies never suffer Druid penalties — they are already dead
  if(army._isSkeletal) return 1.0;
  // Neutral guard heroes natively command their province's armies — no Druid penalty
  if(heroChar&&heroChar._isNeutralGuard) return 1.0;
  const armyType=army.type;
  const heroRace=heroChar.race;

  const armyRace=army.race;
  // ── SAME-RACE RULE ── Every commander (king or hero) can lead troops of their OWN race as if
  // they had at least Druid level 1 for that race — no Druid training is needed to command your own
  // people. Leading other races or exotic creatures still requires the appropriate Druid skill.
  // (Note: a unit's race is the race of the province it was raised in, so troops recruited in a
  // conquered province of another race count as that race and are led cross-race unless the
  // commander shares it.)
  const sameRace=!!(armyRace&&armyRace===heroRace);

  // Druidic alignment: no Druid penalty for Creature armies (they follow willingly). Keyed on the
  // KINGDOM's alignment (playerAlignment) — NOT the commander's personal alignment — so EVERY
  // character of a Druidic realm (king and heroes alike) leads Creatures freely, even though a
  // Druidic king's heroes are seeded with a randomised personal alignment near his own
  // (Good/Druidic/Neutral) and so are usually NOT personally Druidic. A personally-Druidic
  // wandering hero (player===null, so no realm alignment is passed) also qualifies via the second
  // clause. (druIdPenaltyMult is module-level; the runTurn-local G is out of scope here, so we rely
  // on the caller passing the realm alignment — which every combat call site does.)
  const CREATURE_ARMIES_D=new Set(KC_UNIT_CLASS.creature);
  if(CREATURE_ARMIES_D.has(armyType)&&(playerAlignment==='Druidic'||heroChar.alignment==='Druidic')) return 1.0;
  // Evil alignment (2026-10-13, Toby, Creatures and Monsters I): the mirror — no Druid penalty for Monster
  // armies under an Evil realm (or a personally Evil wandering commander). They are driven, not led.
  const MONSTER_ARMIES_D=new Set(KC_UNIT_CLASS.monster);
  if(MONSTER_ARMIES_D.has(armyType)&&(playerAlignment==='Evil'||heroChar.alignment==='Evil')) return 1.0;

  // sd40 Dragon Taming: the caller (inside runTurn, where G is visible) passes tamed=true when the
  // commander's realm holds the discovery and the army is a winged beast — no Druid penalty at all.
  if(tamed) return 1.0;
  const required=getDruidLevel(armyType);
  if(required===0) return 1.0;

  // Psychic Blast (battle magic): this commander's Druid skill has been negated for the battle.
  let rawDruid=heroChar._druidNegated?0:Math.max(0,Math.min(5,(heroChar.skills?.druid||0)+(dedupeItemsByName(activeItems(heroChar)).reduce((s,it)=>s+(it.effect?.stat==='druid'?it.effect.bonus:0),0))));
  // Curse (battle magic): if Druid is the commander's cursed ability, it is halved for the battle.
  if(heroChar._curseHalveStat==='druid') rawDruid=Math.floor(rawDruid/2);
  // Same-race troops are led as if the commander had at least Druid 1 for that race
  // (but a negated commander loses even that — their bond is severed).
  const herodruid=(sameRace&&!heroChar._druidNegated)?Math.max(1,rawDruid):rawDruid;
  const shortfall=Math.max(0,required-herodruid);
  if(shortfall===0) return 1.0;

  // 20% strength penalty per level of shortfall
  return Math.max(0.1,1-(shortfall*0.20));
}
const ALIGNMENTS_P=KC_ALIGNMENTS.slice();
// ── Alignment spectrum & hero hire economics ────
// ALIGNMENTS_P doubles as the moral SPECTRUM: Divine(0) … Neutral(3) … Undead(6). A wandering
// hero's wage is 2g base +1g per 2 steps of distance from the hiring KINGDOM's alignment — Neutral
// kings sit mid-spectrum and hire everyone at 2–3g; Divine and Undead kings pay through the nose
// for the far side. Distance 6 (Divine<->Undead) is an outright refusal: no wage buys that service
// (waived by sd31 Diplomatic Protocols, at the maximum 5g).
function alignDistP(a,b){
  const i=ALIGNMENTS_P.indexOf(a), j=ALIGNMENTS_P.indexOf(b);
  if(i<0||j<0) return 0;
  return Math.abs(i-j);
}
// A hero's SKILL premium on top of the alignment base. Neutral heroes now grow while they wander
// (progressNeutralHeroes + battle experience), so a chieftain who has held his province for twenty
// turns is a far better buy than a fresh wanderer — and used to cost exactly the same, because the
// hire wage was alignment-only. The premium mirrors the in-service wage formula (ceil(total/4))
// with the starting hero's one gold taken off, so a freshly generated 3-point wanderer still hires
// at the old 2–5g and every point earned since shows up in the asking price.
function heroSkillTotal(ch){ return Object.values((ch&&ch.skills)||{}).reduce((s,v)=>s+(v||0),0); }
function heroSkillWage(ch){ return Math.max(0, Math.ceil(heroSkillTotal(ch)/4)-1); }
function heroHireWage(kingdomAlign, heroAlign, waiveBan, hero){
  const d=alignDistP(kingdomAlign, heroAlign);
  if(d>=6&&!waiveBan) return null;               // Divine <-> Undead: will never serve
  return 2+Math.floor(Math.min(d,6)/2)+(hero?heroSkillWage(hero):0);
}
const TEMPERS_P=KC_TEMPERS.slice();
function temperOf(t){ return TEMPER_TRAITS[t]||TEMPER_TRAITS.Brave; }
// A feature's steal-able treasure as a plain number. Tolerates the legacy {gold:n} shape that
// pre-v1054 sea features saved, so old games don't throw when a thief lifts from them.
function featureTreasure(f){
  if(!f) return 0;
  const t=f.treasure;
  if(t==null) return 0;
  if(typeof t==='object') return Math.max(0, t.gold||0);
  return Math.max(0, t||0);
}
function setFeatureTreasure(f, v){
  v=Math.max(0, Math.round(v));
  if(f && typeof f.treasure==='object' && f.treasure) f.treasure.gold=v; else if(f) f.treasure=v;
}
// the gold a hero collects for CLEARING a feature guardian is a tier-band roll. We roll it ONCE and
// cache it on the feature, so a Scout can report the EXACT figure a clearer will receive and the
// victory branch pays out that same amount (rolled here if the site was never scouted).
const ENCOUNTER_CLEAR_GOLD_BANDS={Weak:[5,8],Moderate:[12,18],Powerful:[20,30],Legendary:[40,60]}; // was 5–12 / 14–28 / 30–50 / 55–90
function encounterClearGold(feat){
  if(!feat) return 0;
  if(feat._hoardV2) return featureTreasure(feat); // the one hoard figure
  if(feat._clearGold==null){
    const band=ENCOUNTER_CLEAR_GOLD_BANDS[(feat.monster&&feat.monster.power)||'Weak']||[1,5];
    feat._clearGold=Math.floor(kcRng()*(band[1]-band[0]+1))+band[0];
  }
  return feat._clearGold;
}
