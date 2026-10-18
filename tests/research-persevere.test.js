// 2026-10-13 (item 18) — Research gains Perseverance, as Practice has: every Research order that
// fails makes the same hero's next Research this turn ×1.2 likelier, cumulatively; a discovery
// resets it, and each turn starts afresh. Level 0 (static): the rulebook and the order form's note
// say so. The engine's part (five Research orders with the rolls fixed) moved down in plan P1-08j4:
// tests/unit/research-and-practice-orders-called-directly.test.ts.
const {readPage}=require('./lib/boot');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const rules=readPage('kingdoms-call-rules.html'), pp=readPage('kingdoms-call-player-portal.html');
ok(/Research[^<]*<\/strong>[\s\S]{0,600}Perseverance[\s\S]{0,200}×1\.2/.test(rules)||/Perseverance applies to Research too/.test(rules),'the rulebook gives Research the same Perseverance');
ok(/Each failed Research this turn makes the hero's next one ×1\.2 likelier/.test(pp),'the order form\'s Research note says so');
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
