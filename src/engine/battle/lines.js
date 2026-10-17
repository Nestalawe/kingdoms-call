// ── SKELETONS AND THE CASUALTY LOOPS ────
// change quality" — skeletons cannot promote or demote — but the guard sat above the DEATH roll as
// well, so a skeletal unit was immortal: in combatVsChar (all four branches, winner and loser
// alike) it could never be destroyed at all, and in combatVsNPC it was immortal on the winning
// side. That is why skeletal hosts "hardly ever die". The guard now sits on the QUALITY branches
// only; skeletons roll for destruction at exactly the same rate as anyone else, and their line says
// their bones crumble to dust (they leave no grave — see recordBattleGraves). Deathless March (an
// all-skeletal Undead force is never cut down in FLIGHT) is untouched: that is a rout rule, not an
// immunity.

// ── BATTLE LINES — ONE source of truth for every battle site (NPC attack, NPC defence, PvP both
// sides, the stay-or-retreat estimate, and the bots' battle model). 2026-10-11 (Toby): ROWS AND
// COLUMNS. The ground allows a front of so many units, rolled fresh for each battle (plains and
// desert 6–8, forest and jungle 4–6, mountain 2–4, sea 8–10) and the same for both sides. Each side
// is placed by unit TYPE (KC_UNIT_TYPE):
//   • flanks (plains and desert only): up to Tactical+1 cavalry fight at full strength and take no
//     place in the front;
//   • front: infantry and the rest of the cavalry, strongest first; a ranged unit steps into an empty
//     front place only when nothing else can, and fights there at ×0.75;
//   • second line: a ranged unit standing behind a fighter in its own column shoots over it at FULL
//     strength; anything else in the second line fights at ×0.5;
//   • reserve: ×0.25 for the next `width` units, ×0.125 beyond (sd09 Flanking Tactics lifts the
//     ×0.5 / ×0.25 / ×0.125 steps, as it always has);
//   • the winged riders and the flying beasts (KC_UNIT_CLASS.aerial) fight from the air and take no
//     place: full strength up to the enemy's ground units in line plus their flyers (never fewer than 2),
//     and ×0.5 beyond that. (2026-10-13, the beast abilities: the flying beasts used to hold a place like
//     infantry. Archers still single out the riders only, and hit them twice as hard: FLYING_TYPES.)
// At sea the hulls and sea-beasts take the front before any carried land unit, and there are no
// flanks. Columns fill strongest-in-the-centre, so the grid a report prints is the grid that was
// scored. Who faces whom is then read off the two grids (battleFacing, below the print helpers).
const BATTLE_FRONT_RANGE={plain:[6,8],desert:[6,8],sea:[8,10],forest:[4,6],jungle:[4,6],mountain:[2,4]};
const BATTLE_FLANK_TERRAINS=new Set(['plain','desert']);
const BATTLE_LINE_MULTS=[1,0.5,0.25,0.125];       // front · second line (not shooting over) · reserve · deep reserve
const BATTLE_LINE_MULTS_FLANK=[1,0.75,0.5,0.25];  // sd09's fallback if its data row carries no `lines`
const BATTLE_RANGED_IN_FRONT=0.75, BATTLE_FLYER_BEYOND_CAP=0.5, BATTLE_FLYER_CAP_MIN=2, BATTLE_FLANK_TAC_CAP=5;
// Own copies of the three class lists the grid reads (each consumer builds its own, see the data file).
const GRID_FLY_TYPES=new Set(KC_UNIT_CLASS.aerial), GRID_CAV_TYPES=new Set(KC_UNIT_CLASS.cavalry), GRID_SEA_TYPES=new Set(KC_UNIT_CLASS.sea);
// The width this battle's ground allows: ONE roll per battle, shared by both sides.
function rollBattleWidth(terrain){ const r=BATTLE_FRONT_RANGE[terrain]||BATTLE_FRONT_RANGE.plain; return r[0]+Math.floor(Math.random()*(r[1]-r[0]+1)); }
// The middle of the range: what the bots' estimates and the Strategist's command score assume.
function battleFrontWidth(terrain){ const r=BATTLE_FRONT_RANGE[terrain]||BATTLE_FRONT_RANGE.plain; return Math.round((r[0]+r[1])/2); }
function flankLineMults(){ const l=(typeof DISC_BY_ID!=='undefined'&&DISC_BY_ID.sd09&&DISC_BY_ID.sd09.effect&&DISC_BY_ID.sd09.effect.lines); return (Array.isArray(l)&&l.length===4)?l:BATTLE_LINE_MULTS_FLANK; }
// A row's place comes from its unit's type: 'fly' for the winged riders and the flying beasts (no place
// in the line), 'cav', 'arc' (ranged), and 'foot' for everything else — infantry, the walking and
// swimming beasts, fleets, elementals, and any type the tables have never heard of. A row with no unit on it (the
// bots' estimates) falls back on its own `fly` flag.
function battleRole(row, terrain){
  const t=row&&row.a&&row.a.type;
  if(t==null) return (row&&row.fly)?'fly':'foot';
  if(GRID_FLY_TYPES.has(t)) return 'fly';
  if(terrain!=='sea'&&GRID_CAV_TYPES.has(t)) return 'cav';   // no horse charges at sea
  if(unitTypeOf(t)==='ranged') return 'arc';
  return 'foot';
}
// Short unit codes for the grid print (5 characters; a type not listed uses its first 5 letters).
const UNIT_SHORT={'Shieldwall Levies':'Levy','Free Lances':'FreeL','Yeoman Longbows':'Bow','Gilded Lances':'Gild','Noble Griffons':'Grif','Galleon Fleet':'Gall','Corsair Fleet':'Cors','Human Garrison':'Garr','Men-at-Arms':'MaA',
  'Elven Bowmen':'EBow','Forest Wardens':'Ward','Shadow Archers':'Shad','Eagle Riders':'Eagl','Elven Galleys':'Gally','Elven Garrison':'Garr','Stag Riders':'Stag',
  'Dwarven Guard':'Guard','Ironwood Crossbows':'Xbow','Mountain Guns':'Gun','Gnomish Gyrocopters':'Gyro','Dwarf Ironclads':'Iron','Dwarf Garrison':'Garr','Ironhoof Rams':'Ram',
  'Warg Riders':'Warg','Orc Berserkers':'Bers','Goblin Horde':'Gob','Wyvern Riders':'Wyv','Orcish Longships':'Long','Orc Garrison':'Garr','Black Arrows':'BlkAr','Whale Cohort':'Whale','Shark Shoals':'Shark','Great Bears':'Bear','Unicorn Herd':'Unicn','Mammoth Host':'Mamth','Great Turtles':'Turtl',
  'Stone Giants':'Giant','Forest Ents':'Ent','Thunderbirds':'Thund','Crimson Rocs':'Roc','Cave Trolls':'Troll','Manticore Pride':'Manti','Basilisk Brood':'Basil','Sea Giants':'SeaGt','Eldritch Kraken':'Krakn','Elder Dragons':'Drago','Titan Warbeasts':'Titan','Dread Hydras':'Hydra',
  'Air Elemental':'AirEl','Fire Elemental':'FirEl','Earth Elemental':'ErtEl','Water Elemental':'WatEl','Darkness Elemental':'DrkEl'};
function shortUnit(row){ const t=(row&&row.a&&row.a.type)||(row&&row.name)||'unit'; return UNIT_SHORT[t]||String(t).replace(/[^A-Za-z]/g,'').slice(0,5); }
// Place one side and score it. rows: [{a, base, fly, …}] with `base` the unit's FINAL per-unit
// strength (every modifier and this battle's pre-battle damage already in). opts: {tac, flank,
// enemy, enemyTac} — `enemy` is the other side's rows (or its placed grid), needed only for the
// flyer cap; without it flyers are uncapped (the bots' estimates). Returns the grid: the front and
// second lines as cells per column, the reserve, the flanks, the flyers, every row's place and
// multiplier (also stamped on the row as `_g`, never on the army), and `total`.
function battleGrid(rows, width, terrain, opts){
  opts=opts||{}; const W=Math.max(1,width|0);
  const mults=opts.flank?flankLineMults():BATTLE_LINE_MULTS;
  const tac=Math.max(0,Math.min(BATTLE_FLANK_TAC_CAP,(opts.tac|0)));
  const R=(rows||[]).filter(Boolean).map(r=>({r, role:battleRole(r,terrain), s:(+r.base||0)}));
  const byS=(a,b)=>b.s-a.s;
  const fly=R.filter(x=>x.role==='fly').sort(byS);
  let cav=R.filter(x=>x.role==='cav').sort(byS);
  // Flank slots (Unit abilities, 2026-10-11): on open ground Tactical + 1 riders; on rough ground one, and
  // only for the cavalry bred for it (Stag Riders in forest and jungle: Through the Trees; Ironhoof Rams
  // in the mountains: Crag Charge); none at sea. On open ground a slot no rider fills may be held by
  // Eagle Riders (Stoop on the Horses), who leave the air for the flank.
  const open=BATTLE_FLANK_TERRAINS.has(terrain);
  const slots=open?tac+1:(terrain==='sea'?0:1);
  let flanks=[];
  if(open){ flanks=cav.slice(0,slots); cav=cav.slice(slots); }
  else if(slots){ const i=cav.findIndex(x=>abilityFlanksRough(x,terrain)); if(i>=0){ flanks=[cav[i]]; cav=cav.filter((_,k)=>k!==i); } }
  if(open&&flanks.length<slots){ const eagles=fly.filter(x=>typeOfX(x)==='Eagle Riders').slice(0,slots-flanks.length); eagles.forEach(e=>{ flanks.push(e); fly.splice(fly.indexOf(e),1); }); }
  const seaFirst=x=>(terrain==='sea'&&x.r.a&&GRID_SEA_TYPES.has(x.r.a.type))?1:0;   // at sea the hulls hold the front
  const fighters=R.filter(x=>x.role==='foot').concat(cav).sort((a,b)=>(seaFirst(b)-seaFirst(a))||byS(a,b));
  const arcs=R.filter(x=>x.role==='arc').sort(byS);
  const front=fighters.slice(0,W), spare=fighters.slice(W);
  const back=arcs.slice(0,front.length); let arcLeft=arcs.slice(front.length);
  while(front.length<W&&arcLeft.length) front.push(arcLeft.shift());            // only when nothing else can
  const pool=back.concat(spare,arcLeft);                                         // ranged behind fighters first
  const second=pool.slice(0,W), reserve=pool.slice(W);
  // Columns: a centred block, the strongest at the most central column, alternating outwards.
  const mid=(W-1)/2, order=[...Array(W).keys()].sort((a,b)=>(Math.abs(a-mid)-Math.abs(b-mid))||(a-b));
  const frontCells=Array(W).fill(null), secondCells=Array(W).fill(null);
  { const n=front.length, off=Math.floor((W-n)/2);
    const occ=[...Array(n).keys()].map(k=>k+off).sort((a,b)=>(Math.abs(a-mid)-Math.abs(b-mid))||(a-b));
    front.forEach((x,k)=>{ frontCells[occ[k]]=x; }); }
  { const a=second.filter(x=>x.role==='arc'), o=second.filter(x=>x.role!=='arc');
    order.forEach(c=>{ if(frontCells[c]&&frontCells[c].role!=='arc'&&a.length) secondCells[c]=a.shift(); });
    const q=a.concat(o); order.forEach(c=>{ if(!secondCells[c]&&q.length) secondCells[c]=q.shift(); }); }
  // Flyer cap: the enemy's ground units in line (front and flanks) plus their flyers, never below 2.
  let cap=Infinity, E=opts.enemy;
  if(E){ if(Array.isArray(E)) E=battleGrid(E,W,terrain,{tac:opts.enemyTac}); cap=Math.max(BATTLE_FLYER_CAP_MIN, E.front.filter(Boolean).length+E.flanks.length+E.fly.length); }
  return battleRegrid({W,terrain,front:frontCells,second:secondCells,reserve,flanks,fly,cap:isFinite(cap)?cap:null,mults,
    frontSet:frontCells.filter(Boolean).map(x=>x.role).sort().join()});   // the kinds of unit the front was deployed with (battleLegal)
}
// Score a grid from its cells: every unit's place and multiplier (stamped on the row as `_g`) and the
// total. battleGrid ends here, and the line-up (battleBestSwap) calls it again after every swap.
function battleRegrid(g){
  const W=g.W, mults=g.mults||BATTLE_LINE_MULTS, cap=g.cap==null?Infinity:g.cap; const units=[]; let total=0;
  const put=(x,place,col,mult,why)=>{ const s={place,col,mult,why}; x.r._g=s; units.push({row:x.r,place,col,mult,why}); total+=x.s*mult; };
  g.front.forEach((x,c)=>{ if(!x) return;
    if(x.role==='arc'&&typeOfX(x)==='Black Arrows') put(x,'front',c,1,'Brawling Archers in the front line');   // the orcs' archers fight hand to hand at full strength
    else put(x,'front',c,x.role==='arc'?BATTLE_RANGED_IN_FRONT:1,x.role==='arc'?'ranged in the front line':'front line'); });
  g.second.forEach((x,c)=>{ if(!x) return; const f=g.front[c];
    if(x.role==='arc'&&f&&f.role!=='arc') put(x,'second',c,1,'shooting over the '+shortUnit(f.r));
    else if(typeOfX(x)==='Titan Warbeasts') put(x,'second',c,1,'Colossal Bulk: full strength from the second line');   // the Titans reach over the front (2026-10-13, the beast abilities)
    else put(x,'second',c,mults[1],'second line'); });
  g.reserve.forEach((x,k)=>put(x,'reserve',k,k<W?mults[2]:mults[3],k<W?'reserve':'deep reserve'));
  g.flanks.forEach((x,k)=>put(x,'flank',k,1,'on the flank'));
  g.fly.forEach((x,k)=>put(x,'air',k,k<cap?1:BATTLE_FLYER_BEYOND_CAP,k<cap?'in the air':'in the air, beyond the line'));
  g.units=units; g.total=total; return g;
}
// The old entry point, kept for the estimates that only need a total (the bots, the Strategist's
// command score, the stay-or-retreat test). opts as battleGrid's, plus `terrain`.
function battleLineTotal(rows,width,flank,opts){ return battleGrid(rows,width,(opts&&opts.terrain)||null,Object.assign({},opts||{},{flank})).total; }
// ── The grid in the report ── one line names the ground, then two 📊 lines a side: cells five wide,
// "·" for an empty place, the defender's second line above its front and the attacker's below, so the
// two fronts meet in the middle. The portals draw a 📊 line that contains "│" in monospace.
const GROUND_WORDS={plain:['open ground','allows'],desert:['desert','allows'],forest:['forest','allows'],jungle:['jungle','allows'],mountain:['mountains','allow'],sea:['open water','allows']};
function battleWidthLine(terrain, W){ const g=GROUND_WORDS[terrain]||[String(terrain||'ground'),'allows']; return `📊 Battle lines — the ${g[0]} ${g[1]} a front of ${W}.`; }
function battleGridLines(label, g, defender){
  if(!g) return [];
  const cell=x=>(x?shortUnit(x.r):'·').padEnd(5).slice(0,5);
  const lab=String(label||'').split(/\s+/)[0].slice(0,8).padEnd(8);
  const extras=[];
  if(g.flanks.length) extras.push('flanks: '+g.flanks.map(x=>shortUnit(x.r)).join(', '));
  if(g.fly.length) extras.push('air: '+g.fly.map(x=>shortUnit(x.r)).join(', '));
  if(g.reserve.length) extras.push('reserve: '+g.reserve.map(x=>shortUnit(x.r)).join(', '));
  const l1=`📊 ${lab} 1st │ ${g.front.map(cell).join(' ')} │${extras.length?' '+extras.join(' · '):''}`;
  const l2=g.second.some(Boolean)?`📊 ${lab} 2nd │ ${g.second.map(cell).join(' ')} │`:null;
  return defender?[l2,l1].filter(Boolean):[l1,l2].filter(Boolean);
}
// The ladder's Battle-lines stage: every unit's place and multiplier, grouped.
function battleGridStage(g){
  const groups=new Map();
  g.units.forEach(u=>{ const k=`${u.place} ×${u.mult}`; if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(shortUnit(u.row)); });
  return [...groups].map(([k,v])=>`${k}: ${v.join(', ')}`).join('; ');
}
// ── WHO FACES WHOM (Battle lines II, 2026-10-11, Toby) ── Once both grids stand, each unit's place is
// read against the enemy's. A front unit fights the enemy unit in its own column, and the matchup
// counts (BATTLE_FACING.front: my role → the enemy's → multiplier). A second-line ranged unit shooting
// over its fighter hits the enemy front unit in its column (BATTLE_FACING.back). Where one front is
// wider, its units with nobody opposite wrap round the enemy line's end (×1.2) and that end unit is
// struck from the side (×0.9), unless a spare enemy flank rider guards it. Flank riders pair off in
// duels; a rider left over guards a threatened end; a rider with no duel and no end to guard rides
// free (×1.3) and, on open ground, turns the enemy's flank: their second-line ranged units fight at
// ×0.75, unless infantry anchor both ends of their line. Each effect multiplies the unit's placed
// strength; the ladder's "Who faces whom" stage names them, and every row is stamped _faced for the
// report. Both fronts are centred blocks, so a column inside the enemy's span always has an enemy in
// it. The matchup abilities of single unit types come with the Unit abilities PR.
const BATTLE_FACING={
  front:{cav:{arc:1.25,foot:0.85},foot:{cav:1.15,arc:1.25}},   // anything unlisted is ×1 (foot v foot, cav v cav, a ranged unit caught in the front…)
  back:{foot:1.25,cav:0.75},                                    // shooting the enemy front unit opposite; ranged v ranged ×1
  wrap:1.2, sideHit:0.9, freeFlank:1.3, turned:0.75,
};
const faceMult=(t,a,b)=>{ const r=t&&t[a]; const m=r&&r[b]; return typeof m==='number'?m:1; };
const backMult=r=>{ const m=BATTLE_FACING.back[r]; return typeof m==='number'?m:1; };
// ── UNIT ABILITIES IN THE LINE (2026-10-11, Toby) ── Every humanoid unit has a matchup ability, read here
// when a unit meets another (faces, is met by, duels, guards) or shoots over its fighter, and one more
// ability, some of which also live here (Shieldwall, Sergeants, Driven Before Them, Terror From Above,
// Dive on the Bowmen, Flak Gunners, the flank slots above) and the rest in the volley, fate and
// end-of-turn code. Each returns the multiplier and the names that moved it, for the ladder and the
// report. tests/abilities-* hold every one of them.
const ABILITY_WOODS=new Set(['forest','jungle']);
const GRID_GARRISON_TYPES=new Set(KC_UNIT_CLASS.garrison);
const typeOfX=x=>x&&x.r&&x.r.a&&x.r.a.type;
const abilityHas=(g,type)=>!!g&&['front','second','reserve','flanks','fly'].some(k=>(g[k]||[]).some(x=>x&&typeOfX(x)===type));
// The cavalry that may take the one flank slot rough ground allows (2026-10-13, the beast abilities: the Unicorn Herd's
// Through the Glades joins the Stag Riders in the woods).
const GRID_MONSTER_TYPES=new Set(KC_UNIT_CLASS.monster);
function abilityFlanksRough(x, terrain){ const t=typeOfX(x); return (ABILITY_WOODS.has(terrain)&&(t==='Stag Riders'||t==='Unicorn Herd'))||(terrain==='mountain'&&t==='Ironhoof Rams'); }
// x meets e (both placed cells {r, role, s}): the role matchup, then x's ability, then e's. where:
// 'front' (facing or met), 'duel' (flank riders), 'guard' (a rider guarding a line end); meIsAtk: x's side attacks.
function abilityFront(x, e, terrain, where, meIsAtk){
  const t=typeOfX(x), et=typeOfX(e); let m=faceMult(BATTLE_FACING.front,x.role,e.role); const names=[];
  if(t==='Men-at-Arms'&&e.role==='cav'){ m=1.25; names.push('Halberds'); }
  if(t==='Gilded Lances'&&e.role==='foot'){ m=1.15; names.push('Lance Charge'); }
  if(t==='Orc Berserkers'&&e.role==='foot'){ m*=1.15; names.push('Frenzy'); }
  if(t==='Warg Riders'&&e.role==='cav'){ m=1.25; names.push('Wolves Panic Horses'); }
  if(t==='Eagle Riders'&&e.role==='cav'){ m=1.25; names.push('Stoop on the Horses'); }
  if(t==='Free Lances'&&where==='duel'){ m*=1.15; names.push('Harriers'); }
  if(t==='Forest Wardens'&&ABILITY_WOODS.has(terrain)){ m*=1.15; names.push('Woodland Skirmish'); }
  if(t==='Orc Garrison'&&!meIsAtk&&e.role==='foot'){ m*=1.15; names.push('Bloodthirsty'); }
  // The beasts (2026-10-13, Creatures and Monsters V): the walking beasts' matchups, and the unicorns' Purity.
  if(t==='Great Bears'&&e.role==='foot'){ m*=1.15; names.push('Maul'); }
  if(t==='Mammoth Host'&&e.role==='foot'){ m*=1.15; names.push('Trample'); }
  if(t==='Dread Hydras'&&e.role==='foot'){ m*=1.25; names.push('Many Heads'); }
  if(t==='Unicorn Herd'&&(GRID_MONSTER_TYPES.has(et)||(e.r&&e.r.a&&e.r.a._isSkeletal))){ m*=1.25; names.push('Purity'); }
  // 2026-10-12 (Toby): Purity breaks a Spear Hedge or a Boulder Wall — the Unicorn Herd is never held to their ×0.75 cap.
  if(et==='Shieldwall Levies'&&x.role==='cav'&&m>0.75){ if(t==='Unicorn Herd') names.push('Purity breaks the Spear Hedge'); else { m=0.75; names.push('Spear Hedge'); } }
  if(et==='Stone Giants'&&x.role==='cav'&&m>0.75){ if(t==='Unicorn Herd') names.push('Purity breaks the Boulder Wall'); else { m=0.75; names.push('Boulder Wall'); } }
  if(et==='Dwarven Guard'&&x.role==='foot'){ m*=0.85; names.push('Unbreakable'); }
  if(et==='Dwarf Garrison'&&x.role==='foot'&&terrain==='mountain'){ m*=0.9; names.push('Stone Halls'); }
  if(et==='Elven Garrison'&&x.role==='cav'&&ABILITY_WOODS.has(terrain)){ m*=0.85; names.push('Thorn Hedge'); }
  return {m, why:names.map(n=>', '+n).join('')};
}
// x, a second-line ranged unit, shoots e, an enemy front unit.
function abilityBack(x, e){
  const t=typeOfX(x), et=typeOfX(e); let m=backMult(e.role); const names=[];
  if(t==='Yeoman Longbows'&&e.role==='cav'){ m=1; names.push('Bodkin Points'); }
  if(t==='Elven Bowmen'&&e.role==='cav'){ m=1.25; names.push('Volley at the Charge'); }
  if(t==='Shadow Archers'&&e.role==='arc'){ m=1.25; names.push('Marksmen'); }
  if(t==='Ironwood Crossbows'&&(UNIT_BASE_STR[et]||0)>=6){ m*=1.25; names.push('Armour-Piercing'); }
  if(t==='Mountain Guns'){ m*=1.15; names.push('Bombard'); }
  if(et==='Goblin Horde'){ m*=0.75; names.push('Arrow Fodder'); }
  return {m, why:names.map(n=>', '+n).join('')};
}
// The engagement: each side's span of the front, the columns where it overlaps the enemy's span
// (nearest the centre first), how many flank duels there are, and which overlapping enemy columns each
// side's spare riders cover (alternating sides, nearest first). Riders left after that ride free.
function battleEngage(gA,gD){
  const span=g=>{ const i=g.front.map((x,k)=>x?k:-1).filter(k=>k>=0); return i.length?[i[0],i[i.length-1]]:null; };
  const over=(me,ts)=>{ const L=[],R=[]; if(ts) me.front.forEach((x,i)=>{ if(x&&i<ts[0]) L.unshift(i); if(x&&i>ts[1]) R.push(i); }); return {L,R}; };
  const sA=span(gA), sD=span(gD), duel=Math.min(gA.flanks.length,gD.flanks.length);
  const E={A:{span:sA,duel,over:over(gA,sD),blocking:[],free:gA.flanks.length-duel},
           D:{span:sD,duel,over:over(gD,sA),blocking:[],free:gD.flanks.length-duel}};
  for(const [k,ko] of [['A','D'],['D','A']]){ const e=E[k]; const o={L:[...E[ko].over.L],R:[...E[ko].over.R]}; let side='L';
    while(e.free>0&&(o.L.length||o.R.length)){ const s=o[side].length?side:(side==='L'?'R':'L'); e.blocking.push({col:o[s].shift(),side:s}); e.free--; side=side==='L'?'R':'L'; } }
  return E;
}
// Face one side against the other. me / them: the two grids (same W); mine / theirs: their engagement;
// meIsAtk: `me` is the attacker (Hold the Gate and Bloodthirsty belong to a defending garrison).
function battleFaceSide(me, them, mine, theirs, terrain, meIsAtk){
  const byRow=new Map(me.units.map(u=>[u.row,u]));
  const units=[]; let total=0;
  const put=(x,m,kind,vs,why)=>{ const u=byRow.get(x.r); const pm=u?u.mult:1; const f={m,kind,vs:vs?vs.r:null,why}; if(x.r._g) x.r._g.face=f; x.r._faced=f;
    units.push({row:x.r,place:u?u.place:'?',s:x.s,placeMult:pm,m,kind,vs:f.vs,why}); total+=x.s*pm*m; };
  const idx=me.front.map((x,i)=>x?i:-1).filter(i=>i>=0);
  const guardOf=new Map(theirs.blocking.map((b,j)=>[b.col,them.flanks[theirs.duel+j]]));   // my overlapping column → the enemy rider covering it
  const myOver=new Set([...mine.over.L,...mine.over.R]);
  const covered=new Set(mine.blocking.map(b=>b.col));                                       // the enemy's overlapping columns my riders cover
  const hitL=theirs.over.L.some(c=>!covered.has(c)), hitR=theirs.over.R.some(c=>!covered.has(c));
  const endHit=new Set(); if(idx.length){ if(hitL) endHit.add(idx[0]); if(hitR) endHit.add(idx[idx.length-1]); }
  const footish=x=>!!x&&x.role==='foot';
  const anchored=idx.length>0&&footish(me.front[idx[0]])&&footish(me.front[idx[idx.length-1]]);
  const freeRiders=them.flanks.slice(theirs.duel+theirs.blocking.length);
  const rams=freeRiders.some(x=>typeOfX(x)==='Ironhoof Rams');                             // Battering Horns: a free Ram turns even an anchored line
  const turned=BATTLE_FLANK_TERRAINS.has(terrain)&&freeRiders.length>0&&(!anchored||rams);
  // Terror From Above: with Wyvern Riders on the other side, my strongest front unit fights ×0.85.
  let terrorCol=-1; if(abilityHas(them,'Wyvern Riders')) me.front.forEach((x,c)=>{ if(x&&(terrorCol<0||x.s>me.front[terrorCol].s)) terrorCol=c; });
  me.front.forEach((x,c)=>{ if(!x) return; const e=them.front[c]; const t=typeOfX(x); let m=1, kind='even', vs=null, why=shortUnit(x.r);
    if(e){ vs=e; const f=abilityFront(x,e,terrain,'front',meIsAtk); m=f.m; kind='faces'; why+=` v ${shortUnit(e.r)}${f.why}`; }
    else if(myOver.has(c)){ const g=guardOf.get(c);
      if(g){ vs=g; const f=abilityFront(x,g,terrain,'front',meIsAtk); m=f.m; kind='met'; why+=` met by ${shortUnit(g.r)}${f.why}`; }
      else { const ts=theirs.span; vs=ts?them.front[c<ts[0]?ts[0]:ts[1]]:null; m=BATTLE_FACING.wrap; kind='wraps'; why+=' wraps the end'; } }
    if(endHit.has(c)){ const held=t==='Dwarven Guard'?'Unbreakable':t==='Forest Ents'?'Rooted':(!meIsAtk&&GRID_GARRISON_TYPES.has(t))?'Hold the Gate':null;   // never hit from the side (Rooted: the Ents, 2026-10-13)
      if(held) why+=`, ${held}`; else { m*=BATTLE_FACING.sideHit; why+=', hit from the side'; } }
    const s=me.second[c];
    if((t==='Shieldwall Levies'||t==='Human Garrison')&&s&&s.role==='arc'){ m*=1.25; why+=', Shieldwall'; }   // Town Watch: a garrison counts as Levies
    if(t==='Shieldwall Levies'&&[c-1,c+1].some(j=>me.front[j]&&typeOfX(me.front[j])==='Men-at-Arms')){ m*=1.1; why+=', Sergeants'; }
    if(t==='Orc Berserkers'){ const n=[c-1,c+1].filter(j=>me.front[j]&&typeOfX(me.front[j])==='Goblin Horde').length; if(n){ const g=1+Math.min(0.3,0.1*n); m*=g; why+=`, Driven Before Them ×${g.toFixed(1)}`; } }
    if(c===terrorCol){ m*=0.85; why+=', Terror From Above'; }
    put(x,m,kind,vs,why); });
  // Dive on the Bowmen: with Noble Griffons on the other side, my strongest shooting archer fights ×0.75.
  let dive=null; if(abilityHas(them,'Noble Griffons')) me.second.forEach((x,c)=>{ const f=me.front[c]; if(x&&x.role==='arc'&&f&&f.role!=='arc'&&(!dive||x.s>dive.s)) dive=x; });
  me.second.forEach((x,c)=>{ if(!x) return; const f=me.front[c];
    if(x.role==='arc'&&f&&f.role!=='arc'){ let e=them.front[c]; let m=1, why=shortUnit(x.r);
      if(typeOfX(x)==='Shadow Archers'){ const cands=them.front.filter(Boolean); if(cands.length) e=cands.reduce((b,y)=>abilityBack(x,y).m*y.s>abilityBack(x,b).m*b.s?y:b); }   // Marksmen: they pick the best target along the line
      if(e){ const b=abilityBack(x,e); m=b.m; why+=` shoots ${shortUnit(e.r)}${b.why}`; } else why+=' shoots at an empty column';
      if(turned){ m*=BATTLE_FACING.turned; why+=(rams&&anchored)?', flank turned (Battering Horns)':', flank turned'; }
      if(x===dive){ m*=0.75; why+=', Griffon dive'; }
      put(x,m,e?'shoots':'even',e||null,why); }
    else put(x,1,'even',null,shortUnit(x.r)); });
  me.reserve.forEach(x=>put(x,1,'even',null,shortUnit(x.r)));
  me.flanks.forEach((x,i)=>{
    if(i<mine.duel){ const e=them.flanks[i]; const f=abilityFront(x,e,terrain,'duel',meIsAtk); put(x,f.m,'duel',e,`${shortUnit(x.r)} duels ${shortUnit(e.r)}${f.why}`); }
    else if(i<mine.duel+mine.blocking.length){ const e=them.front[mine.blocking[i-mine.duel].col]; const f=e?abilityFront(x,e,terrain,'guard',meIsAtk):{m:1,why:''}; put(x,f.m,'guards',e||null,`${shortUnit(x.r)} guards the end v ${e?shortUnit(e.r):'nobody'}${f.why}`); }
    else put(x,BATTLE_FACING.freeFlank,'free',null,`${shortUnit(x.r)} rides free`); });
  const enemyFlyers=them.fly.length>0||them.flanks.some(x=>x.role==='fly');
  // Storm Wings (2026-10-13, the beast abilities): with Thunderbirds on the other side, every unit of mine in the air fights ×0.85.
  const storm=abilityHas(them,'Thunderbirds');
  me.fly.forEach(x=>{ let m=1, why=shortUnit(x.r), kind='even';
    if(typeOfX(x)==='Gnomish Gyrocopters'&&enemyFlyers){ m*=1.25; why+=', Flak Gunners'; kind='faces'; }
    if(storm){ m*=0.85; why+=', Storm Wings'; }
    put(x,m,kind,null,why); });
  return {total,units,turned,anchored,duels:mine.duel,guarding:mine.blocking.length,free:mine.free};
}
// Both sides at once (the engagement is shared). Stamps g.face on each grid; g.face.total is the
// strength the dice see. gA is the attacker's grid.
function battleFacing(gA,gD,terrain){
  if(!gA||!gD) return null;
  const E=battleEngage(gA,gD);
  gA.face=battleFaceSide(gA,gD,E.A,E.D,terrain,true); gD.face=battleFaceSide(gD,gA,E.D,E.A,terrain,false);
  return {atk:gA.face,def:gD.face};
}
// The ladder's stage: every matchup that moved a figure, grouped, then how many stood even.
function battleFacingStage(g){
  const f=g&&g.face; if(!f) return '';
  const groups=new Map(); let even=0;
  f.units.forEach(u=>{ if(Math.abs(u.m-1)<1e-9){ even++; return; } const k=`${u.why} ${ladderFm(u.m)}`; groups.set(k,(groups.get(k)||0)+1); });
  const parts=[...groups].map(([k,n])=>n>1?`${k} (${n} units)`:k);
  if(even) parts.push(`${even} even`);
  return parts.join('; ');
}
// ── WHO EACH COMPANY FOUGHT (2026-10-12, Toby: the battle reports say who beat whom) ── From a faced grid, a
// map army → the clause its fate line carries: "facing X", "shooting X over the line", "in a flank duel with
// X", "guarding the end against X", "wrapping the line at X", "met at the end of the line by X", "riding free
// round the flank", "fighting from the air", "in the second line", "in the reserve", "shooting at an empty
// column", "with nobody opposite" — X the enemy company as ownedUnitName writes it (enemyOwner is that side's
// name). Read it right after the deploy, while the rows still carry the deploy's facing: the stay-or-retreat
// estimate faces the survivors afresh later.
function battleFacedClauses(g, enemyOwner){
  const m=new Map(); if(!g||!Array.isArray(g.units)) return m;
  g.units.forEach(u=>{
    const r=u&&u.row, f=r&&r._faced; if(!r||!r.a) return;
    const vs=(f&&f.vs&&f.vs.a)?ownedUnitName(enemyOwner,f.vs.a):null; let c=null;
    if(vs) switch(f.kind){
      case 'faces': c=`facing ${vs}`; break;
      case 'met': c=`met at the end of the line by ${vs}`; break;
      case 'wraps': c=`wrapping the line at ${vs}`; break;
      case 'shoots': c=`shooting ${vs} over the line`; break;
      case 'duel': c=`in a flank duel with ${vs}`; break;
      case 'guards': c=`guarding the end against ${vs}`; break;
      default: c=null; }
    if(!c){ const k=f?f.kind:'', p=u.place;
      if(k==='free') c='riding free round the flank';
      else if(k==='wraps') c='wrapping the end of the line';
      else if(k==='guards') c='guarding the end of the line';
      else if(p==='air'||r.fly) c='fighting from the air';
      else if(p==='reserve') c='in the reserve';
      else if(p==='second') c=/empty column/.test((f&&f.why)||'')?'shooting at an empty column':'in the second line';
      else c='with nobody opposite'; }
    m.set(r.a,c); });
  return m;
}
// ── THE SCOUT'S ADVANTAGE AND THE LINE-UP (Battle lines III, 2026-10-11, Toby) ── The side that knows
// the ground better (the higher exploration of the province; a province's own guard or garrison knows
// it fully; ties go to the defender) takes the rolled front or one wider or narrower, whichever suits
// it on the two default deployments, and lines up second: seeing the enemy's line, it may shift its own
// (up to BATTLE_LINEUP_MAX swaps). Then the commanders take turns, the side that did not scout first,
// one swap per level of Tactical (counted to 5). A swap exchanges two places in the front or the second
// line; it is legal only while the front stays one unbroken block holding the same kinds of unit it was
// deployed with, so a line can be reordered, or a unit traded for one of its own kind behind it, but
// never thinned or stiffened with archers. 2026-10-12 (Toby item 18): nor slid sideways so that the fronts
// no longer meet — the narrower front must stand wholly within the wider front's span (battleFrontsMeet), so a
// front unit stands with nobody opposite only once every enemy front unit already has someone opposite it.
// Every swap is judged with both sides faced (battleFacing), as the mover would see it, and only an improving
// swap is made. Nothing here is random.
const BATTLE_LINEUP_MAX=30;
function battleScout(explAtk, explDef){ return ((+explAtk||0)>(+explDef||0))?'atk':'def'; }
function battleWidthChoices(terrain, roll){ const r=BATTLE_FRONT_RANGE[terrain]||BATTLE_FRONT_RANGE.plain; return [roll-1,roll,roll+1].filter(w=>w>=r[0]&&w<=r[1]); }
function battleLegal(g){
  const occ=g.front.map(Boolean), f=occ.indexOf(true), l=occ.lastIndexOf(true);
  if(f>=0) for(let c=f;c<=l;c++) if(!occ[c]) return false;
  return g.front.filter(Boolean).map(x=>x.role).sort().join()===g.frontSet;
}
// The two fronts meet (item 18): the narrower stands within the wider's span; two fronts of one size hold the
// same columns. The deploy's centred blocks always meet; a swap that would part them is not legal.
function battleFrontsMeet(g1, g2){
  const sp=g=>{ const o=g.front.map(Boolean); return [o.indexOf(true),o.lastIndexOf(true),o.filter(Boolean).length]; };
  const [a0,a1,an]=sp(g1), [b0,b1,bn]=sp(g2);
  if(!an||!bn) return true;
  return an<=bn?(a0>=b0&&a1<=b1):(b0>=a0&&b1<=a1);
}
// log(my faced strength / theirs), both grids faced afresh.
function battleLineRatio(gA, gD, terrain, meIsAtk){ battleFacing(gA,gD,terrain); const r=Math.log(Math.max(gA.face.total,1e-9)/Math.max(gD.face.total,1e-9)); return meIsAtk?r:-r; }
// The best single legal swap for `me`; makes it and returns it, or returns null when none improves.
function battleBestSwap(me, them, terrain, meIsAtk){
  const gA=meIsAtk?me:them, gD=meIsAtk?them:me;
  const base=battleLineRatio(gA,gD,terrain,meIsAtk); let best=null, gain=1e-9;
  const cells=[]; for(let c=0;c<me.W;c++){ cells.push(['front',c]); cells.push(['second',c]); }
  for(let i=0;i<cells.length;i++) for(let j=i+1;j<cells.length;j++){
    const [ra,ca]=cells[i],[rb,cb]=cells[j], a=me[ra][ca], b=me[rb][cb];
    if(!a&&!b) continue; if(a&&b&&a.role===b.role&&a.s===b.s) continue;   // nothing to gain from twins
    me[ra][ca]=b; me[rb][cb]=a;
    if(battleLegal(me)&&battleFrontsMeet(me,them)){ battleRegrid(me); const g=battleLineRatio(gA,gD,terrain,meIsAtk)-base; if(g>gain){ gain=g; best=[i,j]; } }
    me[ra][ca]=a; me[rb][cb]=b;
  }
  if(!best){ battleRegrid(me); battleFacing(gA,gD,terrain); return null; }
  const [ra,ca]=cells[best[0]],[rb,cb]=cells[best[1]]; const t=me[ra][ca]; me[ra][ca]=me[rb][cb]; me[rb][cb]=t;
  battleRegrid(me); battleFacing(gA,gD,terrain);
  return {from:[ra,ca],to:[rb,cb],gain};
}
// Deploy both sides. rowsA / rowsD: finished rows (finishSide). o: {terrain, roll, tacA, tacD, flankA,
// flankD, scout:'atk'|'def'}. Returns {W, gA, gD, scout, lineup, moves:{scout, other}, roll}, both grids
// faced on their final layout.
function battleDeploy(rowsA, rowsD, o){
  const build=w=>({gA:battleGrid(rowsA,w,o.terrain,{flank:o.flankA,tac:o.tacA,enemy:rowsD,enemyTac:o.tacD}), gD:battleGrid(rowsD,w,o.terrain,{flank:o.flankD,tac:o.tacD,enemy:rowsA,enemyTac:o.tacA})});
  const scoutAtk=o.scout==='atk'; let pick=null;
  for(const w of battleWidthChoices(o.terrain,o.roll)){ const g=build(w); const r=battleLineRatio(g.gA,g.gD,o.terrain,scoutAtk); if(!pick||r>pick.r+1e-9) pick={w,r,gA:g.gA,gD:g.gD}; }
  if(!pick){ const g=build(o.roll); pick={w:o.roll,r:0,gA:g.gA,gD:g.gD}; }
  const W=pick.w, gA=pick.gA, gD=pick.gD, me=scoutAtk?gA:gD, other=scoutAtk?gD:gA;
  let lineup=0; while(lineup<BATTLE_LINEUP_MAX&&battleBestSwap(me,other,o.terrain,scoutAtk)) lineup++;
  const capT=t=>Math.max(0,Math.min(BATTLE_FLANK_TAC_CAP,(t|0)));
  let mo=capT(scoutAtk?o.tacD:o.tacA), ms=capT(scoutAtk?o.tacA:o.tacD); const moves={scout:0,other:0};
  while(mo>0||ms>0){ let moved=false;
    if(mo>0){ mo--; if(battleBestSwap(other,me,o.terrain,!scoutAtk)){ moves.other++; moved=true; } }
    if(ms>0){ ms--; if(battleBestSwap(me,other,o.terrain,scoutAtk)){ moves.scout++; moved=true; } }
    if(!moved) break; }
  battleFacing(gA,gD,o.terrain);
  return {W,gA,gD,scout:o.scout,lineup,moves,roll:o.roll};
}
// The report's two lines: who scouted and what front it chose; how many times each line shifted.
function battleScoutLine(d, atkName, defName, explAtk, explDef){
  const atk=d.scout==='atk', s=atk?atkName:defName, o=atk?defName:atkName, mine=atk?explAtk:explDef, theirs=atk?explDef:explAtk;
  // 2026-10-13 (Toby, item 17): say WHICH side has explored the province more, never the figures —
  // a battle report must not tell a realm its rival's exploration of the province.
  const why=mine>theirs?`knows the ground better (${s}'s side has explored more of it than ${o}'s)`:`knows the ground as well as the enemy (neither side has explored more of it), and the defender's claim stands`;
  const w=d.W===d.roll?`takes the front of ${d.W} the dice allow`:(d.W>d.roll?`widens the front from ${d.roll} to ${d.W}`:`narrows the front from ${d.roll} to ${d.W}`);
  return `📊 Scouting — ${s} ${why}: ${s} ${w} and lines up second${d.lineup?` (${d.lineup} ${d.lineup===1?'adjustment':'adjustments'})`:''}.`;
}
function battleMovesLine(d, atkName, defName){
  if(!d.moves.other&&!d.moves.scout) return null;
  const atk=d.scout==='atk', s=atk?atkName:defName, o=atk?defName:atkName;
  const n=k=>k===0?'holds the line as it stands':k===1?'shifts the line once':k===2?'shifts the line twice':`shifts the line ${k} times`;
  return `📊 Tactics — ${o} ${n(d.moves.other)}; ${s} ${n(d.moves.scout)}.`;
}
