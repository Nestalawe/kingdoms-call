// 2026-10-13 (item 10) — whenever a hero gains an item, the report says whether they equip it at
// once or have no room for it (the slot already holds another item), or that it needs no slot, or
// that they cannot use it.
//   Unit: gainedItemNote (module level, booted GM portal) on staged heroes.
//   Static: every way a hero gains an item (lair hoard, lair theft, bones of the fallen, a dead
//     hero's possessions, the mercy price, a drop in the rout, Send Item by hand and by courier,
//     Steal Item, the Grand Heist) writes the note straight after its own line.
//   Scenario: a real Send Item between two heroes of one realm puts the note in the recipient's
//     report (Send Item lives inside runTurn).
const {readPage}=require('./lib/boot'); const {bootScenario}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const sc=await bootScenario(); const W=sc.W;
  const ITEMS=W.eval('ALL_MAGIC_ITEMS_P');
  ok(Array.isArray(ITEMS)&&ITEMS.length>20,'the item table was read');
  const item=n=>{ const it=ITEMS.find(x=>x.name===n); if(!it) throw new Error('no item '+n); return JSON.parse(JSON.stringify(it)); };
  const note=(ch,its)=>W.gainedItemNote(ch,its);
  const hero=(items=[])=>({id:'h',name:'Aldric',race:'Human',alignment:'Good',player:0,items});

  // A free slot: equipped at once.
  { const h=hero(); const b=item('Blade of Fury'); h.items.push(b);
    const t=note(h,[b]); ok(/^🎒 Aldric equips the Blade of Fury at once\.$/.test(t),`free weapon slot: "${t}"`); ok(b.equipped===true,'…and the blade is worn'); }
  // The slot already holds a weapon: no room, and the old one stays on.
  { const old=item('Sword of the First Emperor'); const h=hero([old]); W.activeItems(h); const b=item('Blade of Fury'); h.items.push(b);
    const t=note(h,[b]);
    ok(/Aldric has no room to equip the Blade of Fury: the weapon slot already holds the Sword of the First Emperor, so it goes in the pack/.test(t),`full weapon slot: "${t}"`);
    ok(old.equipped===true&&b.equipped===false,'…the old weapon is still worn and the new one is not'); }
  // An item that was worn by its last owner keeps no claim on the slot.
  { const old=item('Sword of the First Emperor'); const h=hero([old]); W.activeItems(h); const b=item('Blade of Fury'); b.equipped=true; h.items.push(b);
    const t=note(h,[b]); ok(/has no room to equip the Blade of Fury/.test(t)&&old.equipped===true,`a weapon taken from someone who wore it: "${t}"`); }
  // Two rings fill both ring slots.
  { const r1=item('Ring of the Explorer'), r2=item('Ring of Wealth'); const h=hero([r1,r2]); W.activeItems(h); const r3=item("Siege Master's Ring"); h.items.push(r3);
    const t=note(h,[r3]); ok(/both ring slots already hold the Ring of the Explorer and the Ring of Wealth/.test(t),`full ring slots: "${t}"`); }
  // An item with no slot works at once.
  { const free=ITEMS.find(x=>!W.itemSlot(x)&&!x.race&&!x.alignment); ok(!!free,'there is an item with no slot');
    if(free){ const f=JSON.parse(JSON.stringify(free)); const h=hero([f]); const t=note(h,[f]); ok(new RegExp('needs no slot: it works for Aldric at once').test(t),`no-slot item: "${t}"`); } }
  // An item the hero cannot use.
  { const raced=ITEMS.find(x=>x.race&&W.itemRaceOf(x)!=='Human'); ok(!!raced,'there is a race-bound item');
    if(raced){ const r=JSON.parse(JSON.stringify(raced)); const h=hero([r]); const t=note(h,[r]); ok(/Aldric cannot use the .* and carries it unused\./.test(t),`unusable item: "${t}"`); } }
  // Several at once, in one line.
  { const h=hero(); const b=item('Blade of Fury'), s=item('Sword of the First Emperor'); h.items.push(b,s);
    const t=note(h,[b,s]); ok(/equips the Blade of Fury at once\. Aldric has no room to equip the Sword of the First Emperor/.test(t),`two weapons at once: "${t}"`); }
  ok(note(hero(),[item('Blade of Fury')])==='','nothing to say for an item the hero does not hold');

  // ── Static: every gain path writes the note ──
  // Each gain line is found by its message in the GM portal's code, and the note must come within a few statements
  // after it, whatever the lines (tests/lib/source.ts; until plan P1-09a it was within a few lines of the built page).
  const {statementsFollowing}=require('./lib/source.ts');
  const PATHS=[
    ['lair hoard', /hauls out \$\{itemNameList\(baseDrops,false\)\}/, 4],
    ['lair theft', /out from under the guardian's nose!/, 2],
    ['bones of the fallen', /Among the bones of the fallen, \$\{c\.name\} recovers/, 3],
    ['a dead hero\'s possessions', /takes \$\{deadChar\.name\}'s possessions from the fallen/, 2],
    ['the mercy price', /as the price of mercy\./, 2],
    ['a drop in the rout', /In the rout \$\{runner\.name\} drops/, 2],
    ['Send Item by hand', /receives \$\{_names\} from \$\{c\.name\}/, 2],
    ['Send Item by courier', /A courier reaches \$\{dest\.name\} with/, 2],
    ['Steal Item', /deftly lifts the \$\{stolen\.name\} from/, 2],
    ['the Grand Heist', /pulls off a Grand Heist in/, 2],
  ];
  PATHS.forEach(([what,re,within])=>{ const at=statementsFollowing('kingdoms-call-gm-portal.html',re,within);
    ok(!!at,`found the ${what} line`);
    ok(!!at&&/gainedItemNote\(/.test(at.text),`${what}: the equip note follows`); });

  // ── Scenario: a real Send Item ──
  let giver, recip;
  const r=await sc.turn({realms:2,
    prepare(S){
      const king=S.characters.find(c=>c.alive&&c.player===0&&c.isKing);
      giver=king; recip=S.characters.find(c=>c.alive&&c.player===0&&!c.isKing);
      if(!recip){ recip={...JSON.parse(JSON.stringify(king)),id:'r1',name:'Brannoc',isKing:false,armies:[],items:[]}; S.characters.push(recip); }
      recip.location=king.location; recip.race=king.race; recip.alignment=king.alignment;
      recip.items=[item('Sword of the First Emperor')]; king.items=[item('Blade of Fury'),item('Ring of the Explorer')];
    },
    orders:()=>({[giver.id]:[{action:'give_item',target:'0,1',extra:String(recip.id),desc:''},...[1,2,3,4].map(()=>({action:'rest',target:'',extra:'',desc:''}))]})});
  const lines=(r.log||[]).filter(e=>(e.targets||[]).includes(0)).map(e=>e.text||''); // realm 0's own lines
  const i=lines.findIndex(t=>/ receives /.test(t)&&/Blade of Fury/.test(t)&&/Ring of the Explorer/.test(t));
  ok(i>=0,'the recipient\'s report says the items arrived');
  const n=lines.find(t=>/^🎒 /.test(t)&&/Blade of Fury/.test(t))||'';
  ok(/has no room to equip the Blade of Fury: the weapon slot already holds the Sword of the First Emperor/.test(n),`…and that the blade would not fit: "${n}"`);
  ok(/equips the Ring of the Explorer at once/.test(n),'…and that the ring went straight on');
  const R=r.S2.characters.find(c=>c.id===recip.id); const blade=(R&&R.items||[]).find(x=>x.name==='Blade of Fury');
  ok(!!blade&&blade.equipped===false,'the saved world agrees: the blade is in the pack');
  ok(!lines.some(t=>/undefined|NaN|\[object Object\]/.test(t)),'no undefined, NaN or [object Object] in the report');

  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs?sc.errs.length:0}`);
  process.exit(fail?1:0);
})().catch(e=>{ console.log(e.stack); process.exit(1); });
