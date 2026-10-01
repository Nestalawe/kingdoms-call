const fs=require('fs'); const {sitePath}=require('./lib/boot');
const src=fs.readFileSync(sitePath('kingdoms-call-gm-portal.html'),'utf8');
function grab(startMark,endMark){
  const a=src.indexOf(startMark); if(a<0) throw new Error('missing '+startMark);
  const b=src.indexOf(endMark,a); if(b<0) throw new Error('missing '+endMark);
  return src.slice(a,b+endMark.length);
}
const helpers=grab('  const cellIdRC=(r,c)=>r*cols+c;','  const cellDistRC=(a,b)=>{let dc=Math.abs(a.c-b.c);dc=Math.min(dc,cols-dc);const dr=Math.abs(a.r-b.r);return Math.max(dc,dr,(dc+dr)>>1);};');
const place=grab('  const eligibleCells=[];','  let homeCells=_pick[0], homeMin=_pick[1][0];');
const body=`
return (function(cols,rows,nPlayers){
  const setupPlayers=new Array(nPlayers).fill(0).map((_,i)=>({id:i}));
${helpers}
${place}
  return {homeCells,homeMin,cellDistRC};
});`;
const make=new Function(body)();

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
