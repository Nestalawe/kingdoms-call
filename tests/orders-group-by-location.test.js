// 2026-10-08 (item 5) — the orders column's "group by location" button puts heroes standing in the
// same province next to each other, keeps each hero's injected cards with them, and keeps the
// existing collapse-all / expand-all buttons working on every hero.
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
const PPF=process.argv[2]||'kingdoms-call-player-portal.html';
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const WRITES=[];
(async()=>{
  const errs=[];
  const d=bootJsdom(readPage(PPF),{supabase:{createClient:()=>cannedStub({rows:()=>({}),writes:WRITES})},
    setup(w){
      w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message)));
      w.console.error=(...a)=>errs.push('console.error: '+a.map(String).join(' '));
      w.console.warn=()=>{};w.console.log=()=>{};}});
  await new Promise(r=>setTimeout(r,400)); const P=d.window, doc=P.document;
  if(typeof P.buildOrdersForm!=='function'){ console.log('player portal: buildOrdersForm not found'); errs.slice(0,3).forEach(e=>console.log(e)); process.exit(1); }

  // Five made-up heroes over three provinces, deliberately interleaved: Ashford, Brackenmoor, Ashford, Cold Fen, Brackenmoor.
  const hero=(id,name,locationId,locationName,extra={})=>({id,name,player:0,locationId,locationName,hp:20,maxHp:20,
    armies:[],items:[],skills:{},effectiveSpeed:3,effectiveSeaSpeed:3,...extra});
  const chars=[
    hero('h1','Aldric',  11,'Ashford',    {isKing:true}),
    hero('h2','Brannoc', 12,'Brackenmoor'),
    hero('h3','Corvin',  11,'Ashford'),
    hero('h4','Dunmore', 13,'Cold Fen'),
    hero('h5','Elspeth', 12,'Brackenmoor'),
  ];
  P.eval(`currentGamePlayer={id:'gpx',orders:null};`);
  P.eval(`currentReport=${JSON.stringify({turn:3,_liveTurn:3,characters:chars,kingdom:{gold:100,alignment:'Good'},
    worldMeta:{provinces:[{id:11,name:'Ashford'},{id:12,name:'Brackenmoor'},{id:13,name:'Cold Fen'}]}})};`);
  P.buildOrdersForm(P.eval('currentReport.characters'),false,null,3);
  const order=()=>[...doc.querySelectorAll('#orders-form > .orders-char-block[data-hero]')].map(b=>b.getAttribute('data-hero'));
  ok(order().join()==='h1,h2,h3,h4,h5',`the form starts in the given order (${order().join()})`);

  // A card parked under Brannoc (as the hire / resurrect / charm cards are) must travel with him.
  const parked=doc.createElement('div'); parked.id='parked-under-h2'; parked.className='orders-char-block';
  doc.querySelector('#orders-form > .orders-char-block[data-hero="h2"]').after(parked);

  const btn=doc.querySelector('#orders-sticky-top button[onclick*="groupHeroesByLocation"]');
  ok(!!btn,'a "group by location" button sits in the orders header');
  ok(typeof P.groupHeroesByLocation==='function','groupHeroesByLocation exists');
  if(btn) btn.click(); else if(typeof P.groupHeroesByLocation==='function') P.groupHeroesByLocation();
  ok(order().join()==='h1,h3,h2,h5,h4',`heroes are grouped by province, first-seen province first, each group in its old order (${order().join()})`);
  const after=doc.getElementById('parked-under-h2');
  ok(after&&after.previousElementSibling&&after.previousElementSibling.getAttribute('data-hero')==='h2','a card parked under a hero moves with that hero');
  ok(P.eval('_heroOrder.join()')==='h1,h3,h2,h5,h4','the new arrangement is remembered like a manual reorder');
  const blocks=[...doc.querySelectorAll('#orders-form > .orders-char-block[data-hero]')];
  ok(blocks[0].querySelector('.hero-move-up').disabled && blocks[blocks.length-1].querySelector('.hero-move-down').disabled,'the first ▲ and last ▼ are disabled after grouping');
  if(btn) btn.click();
  ok(order().join()==='h1,h3,h2,h5,h4','grouping twice changes nothing');

  // Collapse all / expand all, labelled in words.
  const collapse=doc.querySelector('#orders-sticky-top button[onclick="collapseAllSections(\'#orders-column\',true)"]');
  const expand=doc.querySelector('#orders-sticky-top button[onclick="collapseAllSections(\'#orders-column\',false)"]');
  ok(collapse&&/collapse all/i.test(collapse.textContent),`the collapse button says "Collapse all" (${collapse&&collapse.textContent})`);
  ok(expand&&/expand all/i.test(expand.textContent),`the expand button says "Expand all" (${expand&&expand.textContent})`);
  if(collapse) collapse.click();
  ok(blocks.every(b=>b.classList.contains('sec-collapsed')),'collapse all folds every hero');
  if(expand) expand.click();
  ok(blocks.every(b=>!b.classList.contains('sec-collapsed')),'expand all opens every hero');

  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length?1:0);
})();
