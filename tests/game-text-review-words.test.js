// 2026-10-15 (a player's review of the rulebook) — text players read in the game said what the game
// doesn't do: a Flood let "only fleets" pass (flyers cross too), a broken watch held "no further ground
// this year" (a turn is a season), the Wildwarden counted griffons and eagles (soldiers since R-093),
// Dragon Taming named the winged riders (it covers the four flying beasts only) and the Explorer 8
// perk promised a rise on every Explore (a province gains it once). Level 0 (static): reads site/ text
// and the data file's class lists; nothing runs. (The messages are literals; the effects are tested
// by the scenarios that already cover them.)
const fs=require('fs'), path=require('path'), vm=require('vm');
const SITE=process.env.KC_SITE||path.join(__dirname,'..','site');
const stripTags=s=>{ let t=String(s); for(;;){ const u=t.replace(/<[^>]*>/g,''); if(u===t) return u; t=u; } };
const read=f=>fs.readFileSync(path.join(SITE,f),'utf8');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const G=read('kingdoms-call-gm-portal.html'), D=read('kingdoms-call-data.js'), R=stripTags(read('kingdoms-call-rules.html')).replace(/\s+/g,' ');
const ctx={}; vm.createContext(ctx); vm.runInContext(D+';this.C=KC_UNIT_CLASS;this.S=SAGE_DISCOVERIES_P;this.M=MASTERY_UNLOCKS;',ctx);
ok(ctx.C&&ctx.C.tamedFlyer&&ctx.C.tamedFlyer.length>0&&ctx.C.creature.length>0,'the data file\'s class lists were read');

// Flood: fleets and flyers.
const flood=(G.match(/calls up the deluge[^`]*`/)||[''])[0];
ok(flood.length>0,'the Flood cast message was found');
ok(!/only fleets may pass/.test(flood)&&/only fleets and flyers may pass/.test(flood),'the Flood cast message lets flyers pass');
ok(/Turn a land province to sea for the turn — land armies there are stranded; only fleets and flyers pass\./.test(R),'the spellbook\'s Flood row lets flyers pass');

// A broken watch: this turn, not this year.
ok(!/no further ground this year/.test(G)&&/no further ground this turn/.test(G),'the broken-watch message says "this turn"');
ok(!/rides out to nothing more this year/.test(R)&&/rides out to nothing more this turn/.test(R),'the Defend example says "this turn"');

// The Wildwarden counts Creatures only; the riders are soldiers.
const wild=(D.match(/\{key:'wild',[^\n]*/)||[''])[0];
ok(wild.length>0,'the Wildwarden title was found');
ok(!/griffons|eagles/i.test(wild),'the Wildwarden no longer names griffons or eagles');

// Dragon Taming names the flying beasts it covers, and no rider.
const sd40=(ctx.S||[]).find(d=>d.id==='sd40');
ok(!!sd40,'Dragon Taming was read');
if(sd40){
  ctx.C.tamedFlyer.forEach(t=>ok(sd40.desc.includes(t),`Dragon Taming names ${t}`));
  ctx.C.flying.forEach(t=>ok(!sd40.desc.includes(t),`Dragon Taming no longer names ${t}`));
}

// Explorer 8: once per province.
const ex8=(ctx.M&&ctx.M.explorer&&ctx.M.explorer[8])||'';
ok(ex8.length>0,'the Explorer 8 perk was read');
ok(/once per province/.test(ex8),'the Explorer 8 perk says a province gains it once');
ok(/!prov\._richSurveyed/.test(G),'the engine still grants the Explorer 8 rise once per province');

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
