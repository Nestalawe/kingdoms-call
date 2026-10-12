// tests/lib/primal-decided.js: the Creature and Monster roster Toby decided on 2026-10-13 (the army-balance
// work, second programme): every wild unit's family, type, cost (recruit price and wage), base strength, land
// move rate, the Druid level to lead it and its terrain multipliers (a terrain not listed is ×1; flyers and
// naval units have none). tests/primal-roster reads the game's tables against it and tests/primal-words reads
// the rulebooks against it, so the engine and the books cannot drift apart.
//
// `status` says where a unit is in the programme: 'live' units are held to this table now; 'coming' units
// arrive in their own PR (and are not yet in any table). Since Creatures and Monsters VI (2026-10-13) every unit is
// live; the field stays for the next beast. Three of today's units were renamed or replaced on
// 2026-10-13 (Creatures and Monsters II): Giant Eagles → Thunderbirds, Kraken Tentacles → Eldritch Kraken,
// Leviathan Pods → Dread Hydras (a land Monster of the same power; Leviathan companies and waters become
// Eldritch Kraken, since a land beast cannot swim). RENAMED lists the old names: they are in no table.
//
// Why the strengths are higher than the humanoid units': a realm's own-race troops always carry the kinship
// bonus (×1.44), which no beast gets. The band here (about 2.6–2.75 strength a gold at Druid 4, 2.4–2.6 at
// Druid 5) is what the battle run-through of 2026-10-13 needed for a beast to be worth its gold on neutral
// ground and clearly more on its home ground. Whale Cohort and Shark Shoals stay weak on purpose.
const ROSTER={
  // ── Creatures (9) ──
  'Whale Cohort':    {family:'Creature',type:'naval',   cost:3,str:4, speed:5,druid:3,terr:{},status:'live'},
  'Thunderbirds':    {family:'Creature',type:'flyer',   cost:4,str:11,speed:5,druid:4,terr:{},status:'live'},
  'Forest Ents':     {family:'Creature',type:'infantry',cost:4,str:11,speed:2,druid:4,terr:{plain:0.9,desert:0.75,forest:1.15,jungle:1.15,mountain:0.9},status:'live'},
  'Great Bears':     {family:'Creature',type:'infantry',cost:4,str:11,speed:3,druid:4,terr:{desert:0.8,forest:1.1,mountain:1.1},status:'live'},   // 2026-10-13 (Creatures and Monsters IV)
  'Stone Giants':    {family:'Creature',type:'infantry',cost:5,str:13,speed:2,druid:4,terr:{plain:0.9,desert:0.9,forest:0.9,jungle:0.8,mountain:1.15},status:'live'},
  'Unicorn Herd':    {family:'Creature',type:'cavalry', cost:5,str:13,speed:4,druid:4,terr:{plain:1.1,forest:1.1,jungle:0.9,mountain:0.85},status:'live'},   // IV
  'Mammoth Host':    {family:'Creature',type:'infantry',cost:5,str:13,speed:2,druid:4,terr:{plain:1.1,desert:0.85,forest:0.8,jungle:0.75},status:'live'},   // IV
  'Great Turtles':   {family:'Creature',type:'naval',   cost:5,str:13,speed:2,druid:4,terr:{},status:'live'},   // IV: in the prosperous seas; recruited, never awakened (Toby, 2026-10-13)
  'Crimson Rocs':    {family:'Creature',type:'flyer',   cost:6,str:15,speed:5,druid:5,terr:{},status:'live'},
  // ── Monsters (9) ──
  'Shark Shoals':    {family:'Monster', type:'naval',   cost:3,str:5, speed:5,druid:3,terr:{},status:'live'},   // 2026-10-13 (Creatures and Monsters III)
  'Cave Trolls':     {family:'Monster', type:'infantry',cost:4,str:11,speed:2,druid:4,terr:{desert:0.85,forest:1.1,jungle:1.05,mountain:1.15},status:'live'},
  'Basilisk Brood':  {family:'Monster', type:'infantry',cost:4,str:11,speed:2,druid:4,terr:{plain:0.9,desert:1.1,jungle:1.1,mountain:0.9},status:'live'},
  'Manticore Pride': {family:'Monster', type:'flyer',   cost:5,str:13,speed:5,druid:4,terr:{},status:'live'},
  'Sea Giants':      {family:'Monster', type:'naval',   cost:5,str:13,speed:3,druid:4,terr:{},status:'live'},
  'Eldritch Kraken': {family:'Monster', type:'naval',   cost:6,str:15,speed:2,druid:4,terr:{},status:'live'},
  'Titan Warbeasts': {family:'Monster', type:'infantry',cost:7,str:18,speed:2,druid:5,terr:{plain:1.1,desert:1.1,forest:0.8,jungle:0.75,mountain:0.8},status:'live'},
  'Elder Dragons':   {family:'Monster', type:'flyer',   cost:8,str:19,speed:5,druid:5,terr:{},status:'live'},
  'Dread Hydras':    {family:'Monster', type:'infantry',cost:8,str:19,speed:2,druid:5,terr:{desert:0.85,forest:1.05,jungle:1.1,mountain:0.9},status:'live'},
};
// The old names and what became of them in the tables (a running game's Leviathan company becomes Eldritch Kraken).
const RENAMED={'Giant Eagles':'Thunderbirds','Kraken Tentacles':'Eldritch Kraken','Leviathan Pods':'Dread Hydras'};
const MIGRATED={'Giant Eagles':'Thunderbirds','Kraken Tentacles':'Eldritch Kraken','Leviathan Pods':'Eldritch Kraken'};
const RACE_RENAMED={'Primal:Giant Eagle':'Primal:Thunderbird','Primal:Leviathan':'Primal:Kraken'};
// Awaken the Wild: the Creature a Druidic caller of each Druid level may call out of the land (the Great Turtles and
// the Whale Cohort are never awakened: they are recruited where they swim — Toby, 2026-10-13, Creatures and Monsters IV).
// (In the order the data file lists them: the new three are appended, since the order is the dropdown's.)
const AWAKEN_TIERS={'Thunderbirds':1,'Forest Ents':2,'Stone Giants':3,'Crimson Rocs':3,'Great Bears':2,'Unicorn Herd':3,'Mammoth Host':3};
// Call from the Pit (Evil's mirror of Awaken the Wild): the Monster a caller of each Druid level may call.
const PIT_TIERS={'Cave Trolls':1,'Basilisk Brood':2,'Manticore Pride':3,'Titan Warbeasts':3};
const REIGN_OF_FEAR=1.5;   // an Evil realm's Monsters in a province under its Terror
const LAND_TERRAINS=['plain','desert','forest','jungle','mountain'];
const LIVE=Object.keys(ROSTER).filter(u=>ROSTER[u].status==='live');
const COMING=Object.keys(ROSTER).filter(u=>ROSTER[u].status==='coming');
const isLand=d=>d.type==='infantry'||d.type==='ranged'||d.type==='cavalry';
module.exports={ROSTER,RENAMED,MIGRATED,RACE_RENAMED,AWAKEN_TIERS,PIT_TIERS,REIGN_OF_FEAR,LAND_TERRAINS,LIVE,COMING,isLand};
