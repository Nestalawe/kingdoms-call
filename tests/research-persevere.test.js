// 2026-10-13 (item 18) — Research gains Perseverance, as Practice has: every Research order that
// fails makes the same hero's next Research this turn ×1.2 likelier, cumulatively; a discovery
// resets it, and each turn starts afresh. A real turn (the Research orders live inside runTurn):
// a Sage 5 king researches in all five seasons with the rolls fixed through hooks on the two
// research rolls (the hidden-field roll always misses). The 📊 lines quote the chance used.
// The rulebook and the order form's note say so.
const {readPage}=require('./lib/boot'); const {bootScenario,order,plan}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const MAIN="        const dRoll=d100();\n", SIDE="        { const _sRoll=d100(); const _sChance";
(async()=>{
  const sc=await bootScenario({inject:[
    [MAIN,"        const dRoll=(window.__RR&&window.__RR.length)?window.__RR.shift():d100();\n"],
    [SIDE,"        { const _sRoll=100; const _sChance"]]});
  const W=sc.W; let king;
  W.__RR=[100,100,100,1,100];   // fail, fail, fail, find, fail
  const r=await sc.turn({realms:2,alignments:['Good','Good'],
    prepare(S){ king=S.characters.find(c=>c.alive&&c.player===0&&c.isKing); king.skills.sage=5; king.items=[]; return king; },
    orders:(S,k)=>({[k.id]:plan(order('research','any'),order('research','any'),order('research','any'),order('research','any'),order('research','any'))})});
  const lines=r.text(king.id).split('\n').filter(l=>/📊 Research/.test(l));
  const pc=lines.map(l=>+((/(\d+)% chance/.exec(l)||[])[1]));
  ok(lines.length===5,`five Research rolls were made (${lines.length})`);
  const B=pc[0];
  ok(B>=25,`the first Research rolls at the plain chance (${B}%)`);
  ok(pc[1]===Math.floor(B*1.2),`after one failure: ×1.2 (${pc[1]}%, expected ${Math.floor(B*1.2)}%)`);
  ok(pc[2]===Math.floor(B*1.44),`after two: ×1.44 (${pc[2]}%, expected ${Math.floor(B*1.44)}%)`);
  ok(pc[3]===Math.floor(B*1.728),`after three: ×1.728 (${pc[3]}%, expected ${Math.floor(B*1.728)}%)`);
  ok(pc[4]===B,`a discovery resets it (${pc[4]}%)`);
  ok(/×1\.20 for 1 earlier failed Research this turn/.test(lines[1]||''),`the line says why (${(lines[1]||'').slice(0,200)})`);
  ok(!lines.some(l=>/undefined|NaN/.test(l)),'no undefined or NaN');
  const K=r.S2.characters.find(c=>c.id===king.id);
  ok(K&&K._researchFailStreak&&K._researchFailStreak.n===1,'the streak after the last failure is one');

  const rules=readPage('kingdoms-call-rules.html'), pp=readPage('kingdoms-call-player-portal.html');
  ok(/Research[^<]*<\/strong>[\s\S]{0,600}Perseverance[\s\S]{0,200}×1\.2/.test(rules)||/Perseverance applies to Research too/.test(rules),'the rulebook gives Research the same Perseverance');
  ok(/Each failed Research this turn makes the hero's next one ×1\.2 likelier/.test(pp),'the order form\'s Research note says so');
  console.log(`\n${pass} pass, ${fail} fail · page errors ${sc.errs.length}`);
  sc.errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||sc.errs.length?1:0);
})().catch(e=>{ console.log(e.stack); process.exit(1); });
