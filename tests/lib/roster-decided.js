// tests/lib/roster-decided.js: the humanoid army roster Toby decided on 2026-10-11 (the army-balance
// work): every unit's race, type, cost (recruit price and wage), base strength, land move rate and
// terrain multipliers (a terrain not listed is ×1). tests/roster reads the game's tables against it and
// tests/roster-words reads the rulebooks against it, so the engine and the books cannot drift apart.
//
// Flyers fight at ×1 on any ground or water except under the trees (×0.75 in forest and jungle: Toby, 2026-10-12,
// item 19) and fleets at ×1 everywhere; a land unit at sea fights at ×0.75 (SEA_LAND_PENALTY), which is not a
// terrain-table entry. `isNew` marks the four units this roster
// added; `garrison` the militia that musters straight into the province; `retired` a unit no world offers
// any more and no book names (the engine keeps its figures for companies already raised).
const OPEN={plain:1.15,desert:1.15,forest:0.75,jungle:0.7,mountain:0.75};   // the human heavy horse
const WOODS_FLYER={forest:0.75,jungle:0.75};   // every flyer, under the trees (item 19, 2026-10-12)
const ROSTER={
  // ── Human ──
  'Shieldwall Levies':  {race:'Human',  type:'infantry',cost:2,str:4,speed:2,terr:{plain:1.1,forest:0.9,jungle:0.85,mountain:0.9}},
  'Men-at-Arms':        {race:'Human',  type:'infantry',cost:3,str:6,speed:2,terr:{plain:1.1,forest:0.9,jungle:0.85,mountain:0.9},isNew:true},
  'Yeoman Longbows':    {race:'Human',  type:'ranged',  cost:2,str:4,speed:2,terr:{plain:1.1,desert:0.9,forest:0.85,jungle:0.8}},
  'Free Lances':        {race:'Human',  type:'cavalry', cost:3,str:6,speed:4,terr:OPEN},
  'Gilded Lances':      {race:'Human',  type:'cavalry', cost:4,str:7,speed:3,terr:OPEN},
  'Noble Griffons':     {race:'Human',  type:'flyer',   cost:4,str:6,speed:5,terr:WOODS_FLYER},
  'Galleon Fleet':      {race:'Human',  type:'naval',   cost:3,str:5,speed:3,terr:{}},
  'Corsair Fleet':      {race:'Human',  type:'naval',   cost:3,str:4,speed:4,terr:{},retired:true},   // 2026-10-15 (Toby, D3): gone from every book; the engine keeps its figures for companies already raised
  'Human Garrison':     {race:'Human',  type:'infantry',cost:1,str:2,speed:1,terr:{desert:0.9},garrison:true},
  // ── Elven ──
  'Forest Wardens':     {race:'Elven',  type:'infantry',cost:2,str:4,speed:3,terr:{desert:0.9,forest:1.1,jungle:1.1,mountain:0.85}},
  'Elven Bowmen':       {race:'Elven',  type:'ranged',  cost:3,str:5,speed:2,terr:{desert:0.8,forest:1.15,jungle:1.1}},
  'Shadow Archers':     {race:'Elven',  type:'ranged',  cost:4,str:7,speed:3,terr:{plain:0.9,desert:0.85,forest:1.1,jungle:1.1}},
  'Stag Riders':        {race:'Elven',  type:'cavalry', cost:3,str:6,speed:4,terr:{plain:1.1,forest:1.1,mountain:0.85},isNew:true},
  'Eagle Riders':       {race:'Elven',  type:'flyer',   cost:4,str:6,speed:5,terr:WOODS_FLYER},
  'Elven Galleys':      {race:'Elven',  type:'naval',   cost:3,str:5,speed:4,terr:{}},
  'Elven Garrison':     {race:'Elven',  type:'infantry',cost:1,str:2,speed:1,terr:{desert:0.85,forest:1.1,jungle:1.1,mountain:0.9},garrison:true},
  // ── Dwarven ──
  'Dwarven Guard':      {race:'Dwarven',type:'infantry',cost:3,str:6,speed:2,terr:{plain:0.9,desert:0.9,forest:0.9,jungle:0.85,mountain:1.1}},
  'Ironwood Crossbows': {race:'Dwarven',type:'ranged',  cost:2,str:4,speed:2,terr:{forest:0.9,jungle:0.85,mountain:1.1}},
  'Mountain Guns':      {race:'Dwarven',type:'ranged',  cost:4,str:7,speed:2,terr:{plain:0.85,desert:0.85,forest:0.8,jungle:0.75,mountain:1.1}},
  'Ironhoof Rams':      {race:'Dwarven',type:'cavalry', cost:3,str:6,speed:3,terr:{desert:0.9,forest:0.9,jungle:0.85},isNew:true},
  'Gnomish Gyrocopters':{race:'Dwarven',type:'flyer',   cost:3,str:5,speed:4,terr:WOODS_FLYER},
  'Dwarf Ironclads':    {race:'Dwarven',type:'naval',   cost:4,str:7,speed:2,terr:{}},
  'Dwarf Garrison':     {race:'Dwarven',type:'infantry',cost:1,str:2,speed:1,terr:{plain:0.9,desert:0.85,forest:0.9,jungle:0.85,mountain:1.15},garrison:true},
  // ── Orcish ──
  'Goblin Horde':       {race:'Orcish', type:'infantry',cost:2,str:3,speed:2,terr:{mountain:0.9}},
  'Orc Berserkers':     {race:'Orcish', type:'infantry',cost:3,str:6,speed:3,terr:{desert:1.05,forest:1.1,jungle:1.05,mountain:0.9}},
  'Black Arrows':       {race:'Orcish', type:'ranged',  cost:2,str:4,speed:2,terr:{forest:0.9,jungle:0.9,mountain:0.9},isNew:true},
  'Warg Riders':        {race:'Orcish', type:'cavalry', cost:3,str:6,speed:4,terr:{plain:1.1,desert:1.1,forest:0.9,jungle:0.8,mountain:0.8}},
  'Wyvern Riders':      {race:'Orcish', type:'flyer',   cost:4,str:6,speed:5,terr:WOODS_FLYER},
  'Orcish Longships':   {race:'Orcish', type:'naval',   cost:3,str:5,speed:3,terr:{}},
  'Orc Garrison':       {race:'Orcish', type:'infantry',cost:1,str:2,speed:1,terr:{desert:0.9,mountain:0.9},garrison:true},
};
const LAND_TERRAINS=['plain','desert','forest','jungle','mountain'];
const SEA_LAND_PENALTY=0.75;
// Where each new unit is raised (PROVINCE_ARMIES_P cells it joins, after the units already there).
const NEW_UNIT_PROVINCES={
  'Men-at-Arms':  ['plain','jungle','mountain'],
  'Stag Riders':  ['forest','jungle','plain'],
  'Ironhoof Rams':['mountain','plain','desert'],
  'Black Arrows': ['plain','desert','forest','jungle','mountain'],
};
const NEW_UNITS=Object.keys(ROSTER).filter(u=>ROSTER[u].isNew);
const RACES=['Human','Elven','Dwarven','Orcish'];
const unitsOf=(race,pred=()=>true)=>Object.keys(ROSTER).filter(u=>ROSTER[u].race===race&&pred(ROSTER[u]));
// A unit that stands on the ground: infantry, ranged or cavalry (the terrain table applies to it, and it fights at ×0.75 at sea).
// A flyer reads the terrain table too, but has no sea penalty.
const isLand=d=>d.type==='infantry'||d.type==='ranged'||d.type==='cavalry';
module.exports={WOODS_FLYER,ROSTER,LAND_TERRAINS,SEA_LAND_PENALTY,NEW_UNIT_PROVINCES,NEW_UNITS,RACES,unitsOf,isLand};
