// 2026-10-13 (Toby, Creatures and Monsters VI) — Island Back: the Great Turtles carry two units a hull. The decided
// table's last ability, left out of the beast-abilities PR because it is a sea-lift rule, not a battle-line one.
//   • the data file: the Great Turtles are a carrier (KC_UNIT_CLASS.carrier) and KC_CARRIER_BERTHS gives them two
//     berths (both portals' guard lists named the table until P1-06c removed the guards);
//   • the engine (getSeaCapability and seaLiftShortfall, top-level functions called directly in its bare vm): a
//     turtle carries two heavy units or four light foot where a galleon carries one or two; a third heavy unit is a
//     shortfall; a Whale Cohort still carries one; the rule they share with the player portal (seaLiftOfAColumn, in
//     src/engine/rules-on-plain-values/ since plan P1-11b4) counts two berths and names the unit left ashore;
//   • the player portal's Move notice (poSeaAnalysis, module level), which counts through seaLiftOfAColumn, counts the
//     same berths, and doubles them under a leader of Naval 8;
//   • a turn: a hero with a turtle and two Gilded Lances puts out from his coast into his own waters and arrives with
//     everyone aboard; with three Gilded Lances the move is blocked for want of a berth;
//   • the words: the rulebook's Naval row, Sea-beasts row and turtle row, and the player portal's blurb, say so.
// Level 2 (scenario) for the turn, played in the engine's bare vm (tests/lib/scenario-in-the-vm.ts); the rest is level
// 0/1 in the same file. The blurb is read from src/ by their syntax tree (tests/lib/source.ts).
// Until plan P1-09a the turn was played on the GM portal, a code-anchor hook at "  // 4. Run all 5 phases" handed the
// two functions back, and the lists and the blurb were matched in the built pages' text.
const fs=require('fs');
const {scenarioInTheVm, order, plan}=require('./lib/scenario-in-the-vm.ts');
const {entriesOf}=require('./lib/source.ts');
const {readPage,bootJsdom,sitePath}=require('./lib/boot'); const {nullStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const strip=s=>{ let t=String(s); for(;;){ const u=t.replace(/<[^>]*>/g,''); if(u===t) return u; t=u; } };
const norm=s=>strip(s).replace(/[’‘]/g,"'").replace(/\s+/g,' ');

(async()=>{
  const sc=scenarioInTheVm({seed:1});
  const W=sc.W;
  const L={getSeaCapability:W.getSeaCapability,seaLiftShortfall:W.seaLiftShortfall,seaLiftOfAColumn:W.seaLiftOfAColumn};

  // ── The data file ──
  ok(W.eval("KC_UNIT_CLASS.carrier.includes('Great Turtles')&&KC_UNIT_CLASS.primalSea.includes('Great Turtles')&&KC_UNIT_CLASS.sea.includes('Great Turtles')"),'the Great Turtles are a carrier, and still a primal sea beast');
  ok(W.eval("typeof KC_CARRIER_BERTHS!=='undefined'&&KC_CARRIER_BERTHS['Great Turtles']===2"),"KC_CARRIER_BERTHS gives the Great Turtles two berths (Island Back)");
  ok(W.eval("typeof KC_CARRIER_BERTHS==='undefined'||Object.keys(KC_CARRIER_BERTHS).every(t=>KC_UNIT_CLASS.carrier.includes(t))"),'every unit with a berth count is a carrier');
  const rules=fs.readFileSync(sitePath('kingdoms-call-rules.html'),'utf8');
  // (Until P1-06c it also checked KC_CARRIER_BERTHS is on both portals' data-file guard lists. The guards are gone: the
  // data file is bundled into each page, and a table a page imports that is missing stops the build.)

  // ── The engine's lift ──
  const u=(type,n)=>Array.from({length:n||1},(_,i)=>({type,quality:'Average',unitName:`${type} ${i+1}`}));
  const cap=(...groups)=>L.getSeaCapability([].concat(...groups),null), short=(...groups)=>L.seaLiftShortfall([].concat(...groups),null);
  ok(cap(u('Great Turtles'),u('Gilded Lances',2))==='sea',`a turtle carries two Gilded Lances (got ${cap(u('Great Turtles'),u('Gilded Lances',2))})`);
  ok(cap(u('Great Turtles'),u('Gilded Lances',3))==='land'&&short(u('Great Turtles'),u('Gilded Lances',3))>0,`…but not three (got ${cap(u('Great Turtles'),u('Gilded Lances',3))}, shortfall ${short(u('Great Turtles'),u('Gilded Lances',3))})`);
  ok(cap(u('Great Turtles'),u('Shieldwall Levies',4))==='sea',`…or four companies of light foot (got ${cap(u('Great Turtles'),u('Shieldwall Levies',4))})`);
  ok(cap(u('Galleon Fleet'),u('Gilded Lances',2))==='land','a galleon still carries one heavy unit, not two');
  ok(cap(u('Whale Cohort'),u('Gilded Lances',2))==='land','a whale cohort still carries one');
  ok(cap(u('Great Turtles'),u('Galleon Fleet'),u('Gilded Lances',3))==='sea','a turtle and a galleon together carry three');
  ok(short(u('Great Turtles'),u('Gilded Lances',2))===0&&cap(u('Sea Giants'),u('Gilded Lances'))==='land','no shortfall for two aboard a turtle; a Sea Giant still carries nothing');
  { const lift=(naval8,...groups)=>L.seaLiftOfAColumn([].concat(...groups),naval8);
    const two=lift(false,u('Great Turtles'),u('Gilded Lances',2)), three=lift(false,u('Great Turtles'),u('Gilded Lances',3));
    ok(two.answer==='sea'&&two.berths===2&&two.unitsLeftAshore.length===0,`the shared rule (seaLiftOfAColumn) counts two berths on a turtle and leaves no one ashore (${two.answer}, ${two.berths} berths)`);
    ok(three.answer==='land'&&three.unitsLeftAshore.length===1&&three.unitsLeftAshore[0].type==='Gilded Lances',`…and with three Gilded Lances names the one left ashore (${three.answer}, ${three.unitsLeftAshore.map(a=>a.unitName).join(', ')})`);
    const mastered=lift(true,u('Great Turtles'),u('Gilded Lances',4));
    ok(mastered.answer==='sea'&&mastered.berthsUnderItsLeader===4,`…and under a leader of Naval 8 the turtle's two berths carry four (${mastered.answer}, ${mastered.berthsUnderItsLeader})`); }

  // ── The player portal's Move notice ──
  { const errors=[]; const dom=bootJsdom(readPage('kingdoms-call-player-portal.html'),{supabase:{createClient:()=>nullStub()},url:'https://example.org/pp',
      setup(w){ w.addEventListener('error',e=>errors.push(String(e.error&&e.error.stack||e.message))); w.console.error=()=>{}; w.console.warn=()=>{}; w.console.log=()=>{}; }});
    await new Promise(r=>setTimeout(r,1200)); const P=dom.window;
    ok(errors.length===0,'the player portal boots'+(errors.length?' — '+errors[0].split('\n')[0]:''));
    const an=(armies)=>P.poSeaAnalysis(armies,0);
    const two=an([].concat(u('Great Turtles'),u('Gilded Lances',2))), three=an([].concat(u('Great Turtles'),u('Gilded Lances',3)));
    ok(two&&two.cap==='sea'&&two.hullCap===2,`the move analysis counts two berths on a turtle (cap ${two&&two.cap}, hullCap ${two&&two.hullCap})`);
    ok(three&&three.cap==='land','…and reads three heavy units as one too many');
    const four=(naval)=>P.poSeaAnalysis([].concat(u('Great Turtles'),u('Gilded Lances',4)),naval);
    ok(four(8).cap==='sea'&&four(8).hullCap===4&&four(8).navalL8===true,`…under a leader of Naval 8 a turtle carries four (cap ${four(8).cap}, hullCap ${four(8).hullCap})`);
    ok(four(7).cap==='land'&&four(7).hullCap===2&&four(7).short===2,`…and under Naval 7 two (cap ${four(7).cap}, hullCap ${four(7).hullCap}, ${four(7).short} short)`);
    // a unit the player's earlier orders will raise, whose type can't be known yet ('__projected foot__', the notice's
    // stand-in), takes half a hull, as light foot do: a galleon carries two
    const graves=an([].concat(u('Galleon Fleet'),[1,2].map(i=>({type:'__projected foot__',quality:'Average',unitName:`a grave ${i}`,_projected:true}))));
    ok(graves&&graves.cap==='sea'&&graves.short===0,`…and two graves still to be raised take one galleon's berth (cap ${graves&&graves.cap}, ${graves&&graves.short} short)`);
    dom.window.close(); }

  // ── A turn: putting out with a turtle ──
  const sail=async(heavy)=>{
    const r=await sc.turn({realms:2,seaPct:35,prepare(S){
      const k=S.characters.find(c=>c.isKing&&c.player===0);
      const nbrs=p=>W.getNeighborsP(p,S.world.cols,S.world.rows,S.world.provinces).filter(Boolean);
      const own=(p)=>{ S.players.forEach(pl=>{ pl.provinces=(pl.provinces||[]).filter(x=>x!==p.id); }); p.owner=0; S.players[0].provinces.push(p.id); p.neutralDefenders=[]; p.npcArmies=0; p.garrisonArmies=[]; };
      const coast=S.world.provinces.find(p=>p&&p.terrain!=='sea'&&nbrs(p).some(n=>n.terrain==='sea')); const sea=nbrs(coast).find(n=>n.terrain==='sea');
      own(coast); own(sea);
      S.characters=S.characters.filter(c=>c.player!=null||(c.location!==sea.id&&c.location!==coast.id));
      k.location=coast.id; k.armies=[].concat(u('Great Turtles').map(a=>({...a,race:'Primal'})),u('Gilded Lances',heavy).map(a=>({...a,race:'Human'})));
      return {k:k.id,coast:coast.id,sea:sea.id};
    },orders:(S,x)=>({ [x.k]:plan(order('move',x.sea)) })});
    const k2=r.S2.characters.find(c=>c.id===r.extra.k);
    return {text:r.text(r.extra.k), at:k2.location, armies:(k2.armies||[]).length, x:r.extra};
  };
  { const s=await sail(2);
    ok(s.at===s.x.sea&&s.armies===3,`a king with a turtle and two Gilded Lances puts to sea and arrives with all three companies (at ${s.at===s.x.sea?'sea':'coast'}, ${s.armies} companies)`);
    ok(!/cannot put to sea|too few hulls|left holding/.test(s.text),'nothing is blocked or stranded'); }
  { const s=await sail(3);
    ok(s.at===s.x.coast&&/cannot put to sea/.test(s.text),`with three Gilded Lances the move is blocked for want of a berth — ${(s.text.split('\n').find(l=>/cannot put to sea/.test(l))||'no block line').slice(0,200)}`);
    ok(/2 berths?|two berths|berths? of shipping/.test(s.text)||/need 3 (hulls?|berths?)/.test(s.text),'…and the block line counts berths, not hulls'); }

  // ── The words ──
  const row=(name,lead)=>norm((new RegExp(`<tr><td><strong>${name}</strong></td><td>${lead||''}[\\s\\S]*?</tr>`).exec(rules)||[''])[0]);
  ok(/Great Turtles/.test(row('Naval','Warships'))&&/two/.test(row('Naval','Warships')),`the rulebook's Naval kinds-of-unit row names the Great Turtles among the ferries, two units a hull — "${row('Naval','Warships').slice(0,160)}…"`);
  ok(/Island Back/.test(row('Great Turtles'))&&/two/.test(row('Great Turtles'))&&!/carries? nothing|carry nothing/.test(row('Great Turtles')),`the turtle row names Island Back and no longer says they carry nothing — "${row('Great Turtles').slice(-200)}"`);
  ok(/turtles/i.test(row('Sea-beasts'))&&/(carr(y|ies)|ferr(y|ies)) /.test(row('Sea-beasts')),"the Sea-beasts row makes the turtles the exception to 'they carry nothing'");
  const blurb=(entriesOf('content/unit-abilities-their-names-numbers-and-words.ts','UNIT_ABILITIES').find(e=>e.key==='Great Turtles')||{value:''}).value;
  ok(/Island Back/.test(blurb)&&/two/.test(blurb)&&!/carry nothing/.test(blurb),`the player portal's turtle blurb names Island Back — "${blurb.slice(0,140)}…"`);
  const turtle=JSON.stringify(W.eval("PRIMAL_ARMY_DEFS_P['Great Turtles']")||{});
  ok(/Island Back/.test(turtle)&&!/carry nothing/.test(turtle),"the data file's turtle description names Island Back and no longer says they carry nothing");

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
