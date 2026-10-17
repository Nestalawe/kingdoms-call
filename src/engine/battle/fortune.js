// ── FORTUNE OF BATTLE ── the dice step of every army battle. Instead of two additive rolls off the
// stronger side's strength, ONE swing S is drawn from a fixed, symmetric fortune curve and applied
// as a pair of luck multipliers: attacker × e^(S/2), defender × e^(-S/2). Only the RATIO of the two
// luck factors decides the fight, so luck is proportional to each side's own strength. The curve is
// anchored: a swing that overturns a 2× advantage happens 20% of the time, one that overturns 3×
// happens 10%, and none ever overturns 4× — straight-line interpolation between anchors (in
// log-ratio space). Win chances by ratio: 1.1× 54%, 1.3× 61%, 1.5× 68%, 2× 80%, 3× 90%, 4× 100%.
const FORTUNE_CURVE=[[-Math.log(4),0],[-Math.log(3),0.10],[-Math.log(2),0.20],[0,0.50],[Math.log(2),0.80],[Math.log(3),0.90],[Math.log(4),1]];
function battleFortune(){
  const u=kcRng();
  for(let i=1;i<FORTUNE_CURVE.length;i++){
    const [a,fa]=FORTUNE_CURVE[i-1],[b,fb]=FORTUNE_CURVE[i];
    if(u<=fb){ const S=a+(b-a)*((u-fa)/(fb-fa)); return {S, atk:Math.exp(S/2), def:Math.exp(-S/2)}; }
  }
  return {S:0,atk:1,def:1};
}
// ── FORTUNE NARRATIVE ── the report no longer prints "strength × fortune 0.50 = …" per side
// (players read that as their army being weakened). Strengths are shown untouched; fortune is
// described as what it did to the EDGE: the pre-fortune ratio and win chance, which side luck ran
// with and how rare the roll was, and the post-fortune edge.
function fortuneCdf(x){ const C=FORTUNE_CURVE; if(x<=C[0][0]) return 0; for(let i=1;i<C.length;i++){ const [a,fa]=C[i-1],[b,fb]=C[i]; if(x<=b) return fa+(fb-fa)*((x-a)/(b-a)); } return 1; }
// Attacker's win chance for a strength ratio r = atk/def: P(S > -ln r).
function fortuneWinChance(r){ if(!(r>0)) return 0; if(!isFinite(r)) return 1; return 1-fortuneCdf(-Math.log(r)); }
function fortuneEdgeNum(r){ const e=r>=1?r:(r>0?1/r:Infinity); return !isFinite(e)?'∞×':`${e>=10?e.toFixed(0):e.toFixed(1)}×`; }
function fortuneEdgeText(r){ const e=r>=1?r:(r>0?1/r:Infinity); if(!isFinite(e)) return 'total superiority'; if(e<1.05) return 'an even match'; return `a ${fortuneEdgeNum(r)} edge`; }
function fortuneNarrative(atkLabel, defLabel, atkBase, defBase, fort){
  if(!(defBase>0)) return `${atkLabel} meets no effective resistance — **${atkLabel} wins**.`;
  if(!(atkBase>0)) return `${atkLabel} brings no effective strength — **${defLabel} wins**.`;
  const r0=atkBase/defBase, r1=(atkBase*fort.atk)/(defBase*fort.def);
  const favoured=r0>=1?atkLabel:defLabel, winner=r1>=1?atkLabel:defLabel;
  const pAtk=fortuneWinChance(r0), pFav=r0>=1?pAtk:1-pAtk;
  const edge=`${favoured} holds ${fortuneEdgeText(r0)} (${dispFloor(pFav*100)}% to win)`;
  const S=fort.S||0, small=Math.abs(S)<Math.log(1.15);
  let luck;
  if(small) luck=`Fortune of battle: an even roll — luck played little part`;
  else {
    const side=S>0?atkLabel:defLabel, tail=S>0?1-fortuneCdf(S):fortuneCdf(S);
    const adv=tail<=0.05?'strongly':tail<=0.20?'firmly':'mildly';
    const rare=tail<0.25?` (a 1-in-${Math.min(1000,Math.max(4,Math.round(1/Math.max(tail,1e-4))))} roll)`:'';
    luck=`Fortune of battle: luck ran ${adv} with ${side}${rare}`;
  }
  let outcome;
  if(winner===favoured){
    const luckWithWinner=(S>0)===(winner===atkLabel);
    outcome=small?` — **${winner} wins**.`
      :(luckWithWinner?` and widened the edge to ${fortuneEdgeNum(r1)} — **${winner} wins**.`
                      :` and trimmed the edge to ${fortuneEdgeNum(r1)} — not enough: **${winner} wins**.`);
  } else outcome=` and overturned it — ${winner} finishes ${fortuneEdgeNum(r1)} ahead and **wins**.`;
  return `${edge}. ${luck}${outcome}`;
}
// unbiased Fisher-Yates shuffle (returns a NEW array; rnd defaults to kcRng). Every former
// `.sort(()=>Math.random()-0.5)` now goes through here — that comparator is not a fair shuffle
// (engine-dependent, and it leaves elements near their original positions far more often than
// chance), which skewed "pick n at random" draws toward the front of the list.
function shuffleP(arr, rnd=kcRng){ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
const ABILITIES_P=KC_SKILLS.slice();
