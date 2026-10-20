// Home placement: the stretch of generateNewGame (src/engine/world/generate.ts) that picks each king's home cell, cut
// out by its syntax tree (tests/lib/source.ts: the statements from the one declaring cellIdRC through the one declaring
// cellDistRC, and from eligibleCells through homeCells) and run on its own, many times a map size. Until plan P1-09a
// the two stretches were cut out of the built GM portal between exact lines.
const {statementsBetween}=require('./lib/source.ts');
const helpers=statementsBetween('engine/world/generate.ts','generateNewGame','cellIdRC','cellDistRC');
const place=statementsBetween('engine/world/generate.ts','generateNewGame','eligibleCells','homeCells');
const body=`
return (function(cols,rows,nPlayers){
  const setupPlayers=new Array(nPlayers).fill(0).map((_,i)=>({id:i}));
${helpers}
${place}
  return {homeCells,homeMin,cellDistRC};
});`;
// The cut-out code draws its dice from kcRng (src/engine/rng.ts, not in the cut): here, this process's seeded Math.random.
const make=new Function('kcRng',body)(()=>Math.random());

const sizes={p2:[8,5,2],p3:[8,7,3],p4:[9,7,4],p5:[12,7,5],p6:[15,7,6],p7:[16,7,7],p8:[17,8,8],p9:[16,11,9],p10:[16,11,10]};
const RUNS=parseInt(process.env.RUNS||'200');
let fails=0;
console.log('map      cols x rows  realms  runs  minDist: min/avg/max   pairsAtMin avg   nnAvg   <4 fails  t/run(ms)');
for(const [k,[cols,rows,n]] of Object.entries(sizes)){
  let mins=[],nn=[],atmin=[],bad=0; const t0=Date.now();
  for(let i=0;i<RUNS;i++){
    const r=make(cols,rows,n);
    const hc=r.homeCells, D=r.cellDistRC;
    let mn=Infinity,cnt=0; const near=new Array(n).fill(Infinity);
    for(let a=0;a<n;a++)for(let b=a+1;b<n;b++){const d=D(hc[a],hc[b]);near[a]=Math.min(near[a],d);near[b]=Math.min(near[b],d);if(d<mn){mn=d;cnt=1;}else if(d===mn)cnt++;}
    mins.push(mn); atmin.push(cnt); nn.push(near.reduce((s,x)=>s+x,0)/n);
    if(mn<4){bad++;}
    if(new Set(hc.map(h=>h.id)).size!==n) throw new Error('duplicate home cell');
    hc.forEach(h=>{ if(h.r<1||h.r>rows-2) throw new Error('home on edge row'); });
  }
  const t=(Date.now()-t0)/RUNS;
  const avg=a=>(a.reduce((s,x)=>s+x,0)/a.length).toFixed(2);
  fails+=bad;
  console.log(`${k.padEnd(8)} ${String(cols).padStart(4)} x ${String(rows).padStart(2)}  ${String(n).padStart(6)} ${String(RUNS).padStart(5)}   ${Math.min(...mins)}/${avg(mins)}/${Math.max(...mins)}          ${avg(atmin).padStart(6)}        ${avg(nn).padStart(5)}   ${String(bad).padStart(6)}   ${t.toFixed(1)}`);
}
console.log(fails===0?'ALL OK — every layout keeps >=4 hexes (3 empty provinces) between every pair of capitals':`FAIL: ${fails} layouts below the floor`);
