// 2026-10-08 (item 13) — orders written against a WANDERING hero never become an attack on a realm.
// From play: a player hired wandering heroes, and later that turn a bot's hero attacked them. Bots
// plan "walk to the wanderer and Charm him" at the top of the turn; once the player had hired him,
// the Charm seized the player's new hero or provoked a fight with him. And the engine let an
// Encounter name a wanderer at all, which the order form never offers.
// Bot plans are ordinary orders by the time they resolve, so realm 1's orders are written here by
// hand: one hero in the capital where realm 0's king hires the wanderer in Spring.
const {bootScenario,order,plan}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const sc=await bootScenario();
  const place=(S,c,p)=>{ S.world.provinces.forEach(q=>{ q.characters=(q.characters||[]).filter(id=>id!==c.id); }); p.characters=[...(p.characters||[]),c.id]; c.location=p.id; c.locationName=p.name; };
  const wanderer=(S,id,name,p)=>{ S.characters.push({id,name:name+' (wandering)',player:null,alive:true,race:'Human',alignment:S.players[0].alignment,
    temper:'Brave',hp:20,maxHp:20,skills:{melee:1},items:[],armies:[],location:p.id,locationName:p.name,pay:1}); p.characters=[...(p.characters||[]),id]; };
  const r=await sc.turn({prepare(S){
    S.relations=S.relations||{}; S.relations['0-1']='enemy';
    const king=S.characters.find(c=>c.alive&&c.player===0&&c.isKing);
    const home=S.world.provinces[king.location];
    const top=Math.max(...S.characters.map(c=>c.id));
    wanderer(S,top+1,'Wenna',home);   // hired by realm 0 in Spring
    wanderer(S,top+2,'Osric',home);   // nobody hires him
    const H=S.characters.find(c=>c.alive&&c.player===1&&!c.isKing);
    place(S,H,home); H.armies=[]; H.skills={...(H.skills||{}),psychic:5,melee:5}; H.hp=H.maxHp=30;
    return {king,H,W:top+1,O:top+2};
  },orders:(S,c)=>({
    [c.king.id]:plan(order('hire',c.W)),
    [c.H.id]:plan(order('rest'),order('cast_spell','Charm',c.W),order('encounter',c.W),order('encounter',c.O)),
  })});
  const {H,W,O}=r.extra;
  const S2=r.S2, w=S2.characters.find(c=>c.id===W), o=S2.characters.find(c=>c.id===O);
  const t=r.text();
  ok(w&&w.player===0,'realm 0 hired Wenna in Spring (staging)');
  ok(w&&w.player===0&&!w._charmTempControl&&!w._charmedByPlayer,'Wenna is still realm 0\'s at the end of the turn — never seized by the Charm');
  ok(!/Charm (grips|sways) Wenna/.test(t)&&!/Wenna feels the enchantment/.test(t),'the Charm neither takes hold of Wenna nor provokes her');
  ok(/spell meant to win a masterless wanderer is never worked/.test(t),'the caster\'s report says why the Charm was not worked');
  ok(!/sets out to run down Wenna/.test(t),'no Encounter is set on Wenna, hired that same turn');
  ok(!/sets out to run down Osric/.test(t),'no Encounter is set on Osric, a wanderer');
  ok(/will not hunt Wenna/.test(t)&&/will not hunt Osric/.test(t),'the hunter\'s report says why');
  ok(o&&o.player==null&&o.alive,'Osric wanders on, unharmed');

  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
