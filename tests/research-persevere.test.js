// 2026-10-13 (item 18) — Research gains Perseverance, as Practice has: every Research order that
// fails makes the same hero's next Research this turn ×1.2 likelier, cumulatively; a discovery
// resets it, and each turn starts afresh. Level 0 (static): the rulebook and the order form's note
// say so. The engine's part (five Research orders with the rolls fixed) moved down in plan P1-08j4:
// tests/unit/research-and-practice-orders-called-directly.test.ts.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Item 18 (2026-10-13): Research has Perseverance, as Practice does: the rulebook and the order form's note say so. The
// engine's part (a Sage 5 king researching five times, each failure making the next ×1.2 likelier, cumulatively: 25%,
// 30%, 36%, 43%; a discovery resets it; the 📊 line says why) moved down in P1-08j4 to
// `unit/research-and-practice-orders-called-directly.test.ts`, with its hooks on the two research rolls
const {readPage}=require('./lib/boot');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
// the player portal's words, read from src/ by their syntax tree (tests/lib/source.ts; until plan P1-09a, the built
// page's text)
const rules=readPage('kingdoms-call-rules.html'), pp=require('./lib/source.ts').pageText('kingdoms-call-player-portal.html');
ok(/Research[^<]*<\/strong>[\s\S]{0,600}Perseverance[\s\S]{0,200}×1\.2/.test(rules)||/Perseverance applies to Research too/.test(rules),'the rulebook gives Research the same Perseverance');
ok(/Each failed Research this turn makes the hero's next one ×1\.2 likelier/.test(pp),'the order form\'s Research note says so');
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
