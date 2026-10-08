// 2026-10-08 (item 12) — the price of hiring a wandering hero is the same in the turn report, the
// Hire Hero dropdown, the Broker list and the order ledger: the price the hire really charges.
// A hero who has grown while wandering asks a premium for skill on top of the alignment rate. The
// report quoted it; the order form worked the price out from alignment alone and quoted less.
// One real turn builds a real report (GM portal); the player portal then renders it.
const {bootScenario}=require('./lib/scenario');
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const sc=await bootScenario();
  const r=await sc.turn({prepare(S){
    const king=S.characters.find(c=>c.alive&&c.player===0&&c.isKing);
    const home=S.world.provinces[king.location];
    // A seasoned wanderer of the realm's own alignment, standing in the capital: alignment rate 2g,
    // and 15 skill levels → a 3g premium.
    const id=Math.max(...S.characters.map(c=>c.id))+1;
    S.characters.push({id,name:'Wenna the Seasoned (wandering)',player:null,alive:true,race:'Human',alignment:S.players[0].alignment,
      temper:'Brave',hp:20,maxHp:20,skills:{melee:6,tactical:5,march:4},items:[],armies:[],location:home.id,locationName:home.name,pay:1});
    home.characters=[...(home.characters||[]),id];
    return {id,king};
  }});
  const {id}=r.extra;
  const rep=r.reports[0];
  ok(!!rep,'realm 0 received a report');
  const seen=(rep.heroSightings||[]).find(s=>/Wenna/.test(s.name));
  const avail=Object.values(rep.provinceOrderData||{}).flatMap(pd=>pd.availableHeroes||[]).find(h=>h.id===id);
  ok(!!seen&&!!avail,'the wanderer is in the report and offered for hire (staging)');
  if(!seen||!avail){ console.log(`\n${pass} pass, ${fail} fail`); process.exit(1); }
  const price=seen.pay;
  ok(price===5,`the report quotes the full price: 2g alignment rate + 3g for skill = 5g (quotes ${price}g)`);
  ok(avail.hireWage===price,`the hire data carries the same price (${avail.hireWage}g)`);

  // The player portal, rendering that report.
  const errs=[];
  const d=bootJsdom(readPage('kingdoms-call-player-portal.html'),{supabase:{createClient:()=>cannedStub({rows:()=>({}),writes:[]})},
    setup(w){ w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message)));
      w.console.error=(...a)=>errs.push('console.error: '+a.map(String).join(' ')); w.console.warn=()=>{}; w.console.log=()=>{}; }});
  await new Promise(res=>setTimeout(res,400)); const P=d.window;
  P.__rep=rep; P.eval(`currentGamePlayer={id:'gpx',orders:null}; currentReport=__rep;`);
  P.buildOrdersForm(P.eval('currentReport.characters'),false,null,rep.turn);
  const king=(rep.characters||[]).find(c=>c.isKing);
  const opt=html=>{ const m=String(html).match(/<option[^>]*value="(?:hire:)?\d+"[^>]*>[^<]*Wenna[^<]*<\/option>/); return m?m[0]:''; };
  const g=html=>{ const m=opt(html).match(/(\d+)g\/turn/); return m?+m[1]:null; };
  const hireHtml=P.buildTargetField(king,0,{action:'Hire Hero'});
  ok(g(hireHtml)===price,`the Hire Hero dropdown quotes ${price}g (quotes ${g(hireHtml)}g: ${opt(hireHtml).replace(/<[^>]+>/g,'').trim()})`);
  // The Broker list (a Neutral king) reads the same figure.
  P.eval(`currentReport.kingdom.alignment='Neutral';`);
  const brokerHtml=P.buildTargetField(king,0,{action:'Broker'});
  ok(g(brokerHtml)===price,`the Broker list quotes ${price}g (quotes ${g(brokerHtml)}g)`);
  P.eval(`currentReport.kingdom.alignment=${JSON.stringify(rep.kingdom.alignment)};`);
  // The order ledger counts the same gold for a queued hire.
  const sel=P.document.getElementById(`po-action-${king.id}-0`);
  if(sel){ if(![...sel.options].some(o=>o.value==='Hire Hero')){ const o=P.document.createElement('option'); o.value='Hire Hero'; sel.appendChild(o); }
    sel.value='Hire Hero'; P.onActionChange(king.id,0);
    const t=P.document.getElementById(`po-target-${king.id}-0`); if(t) t.value=String(id); }
  const L=P.computeOrderLedgerP();
  const hg=L&&L.cats&&L.cats.heroes&&L.cats.heroes.g;
  ok(hg===price,`the order ledger counts ${price}g for the hire (counts ${hg}g)`);

  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length+errs.length}`);
  [...sc.errs,...errs].slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length||errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
