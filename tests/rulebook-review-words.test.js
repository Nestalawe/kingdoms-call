// 2026-10-15 (a player's review of the rulebook) — every sentence the review found that the game
// contradicts now says what the game does: the cast chance at 7, the once-a-turn skill rise, slipping
// through a camp, the carry-on casualties, the standings' five turns, no 3-realm ally step, the Defend
// step, Hunting Rumours' lack of a roll, the lair counts, which items fight, the three-round limit, Druid
// items to 9, ferrying, the beaten skeletons' step, Mithril, the Druid table, the four attack rules,
// the battle's own heading, Rest, the home lair, grave decay, the Druid ward, Hand of Death's cap, the
// volley, turn 2's recruiting and two links. Level 0 (static): reads site/ text and the engine's
// constants; nothing runs. (The constants sit in the GM portal's source, and the claims are words.)
const fs=require('fs'), path=require('path');
const SITE=process.env.KC_SITE||path.join(__dirname,'..','site');
const stripTags=s=>{ let t=String(s); for(;;){ const u=t.replace(/<[^>]*>/g,''); if(u===t) return u; t=u; } }; // until stable (as the other words tests do)
const read=f=>fs.readFileSync(path.join(SITE,f),'utf8');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const G=read('kingdoms-call-gm-portal.html'), RH=read('kingdoms-call-rules.html'), IH=read('kingdoms-call-rules-intro.html');
const R=stripTags(RH).replace(/\s+/g,' '), I=stripTags(IH).replace(/\s+/g,' ');
const num=re=>{ const m=re.exec(G); return m?+m[1]:NaN; };
ok(R.length>100000&&I.length>20000,'both rulebooks were read');

// Cast chance: 30% + 10% a level, at most 95%; training counts to 5 (80%), and only an item's levels carry it on.
// (Toby, 2026-10-15: the books follow the game. guard-cast-chance holds the figures.)
const base=num(/const SPELL_CAST_BASE=(\d+)/);
ok(base===30,`the engine's cast base is 30% (got ${base})`);
ok(R.includes('80% at 5. Trained levels past 5 do not raise it')&&!R.includes('80% at 5, 90% at 7')&&!R.includes('95% from 7'),'the rulebook stops trained cast chance at 80% (level 5), not 90% or 95% at 7');

// A skill rises from experience once a turn (R-056); the ×0.8 follows Practice rises only.
ok(!R.includes('each time a skill has already risen in a turn'),'the rulebook drops "each time a skill has already risen in a turn"');
ok(R.includes('each Practice rise of a skill earlier in the turn makes its next chance from experience ×0.8'),'the rulebook ties the ×0.8 to Practice rises');

// Slipping through a camp: 60% − 8% a unit.
const sB=num(/ENC_BREAK_RANKS_BASE=(\d+)/), sU=num(/ENC_BREAK_RANKS_PER_UNIT=(\d+)/), five=sB-5*sU;
ok(five===20,`behind five units the engine gives ${five}%`);
ok(R.includes('behind five, one time in five')&&!R.includes('behind five, one time in four'),'the rulebook says "one time in five"');

// Carry-on casualties add 35% a round.
ok(num(/CARRYON_DEATH_STEP=(0\.\d+)/)===0.35,'the engine\'s carry-on step is 0.35');
ok(!R.includes('×1.35 for every carry-on round'),'the losing side\'s step no longer says ×1.35 a round');
ok(R.includes('+35% for every carry-on round'),'the losing side\'s step says +35% a round');

// Standings from turn 5, claims from turn 10: five turns between.
const pub=num(/const TITLES_PUBLIC_FROM_TURN=(\d+)/), claim=num(/const RECKONING_MIN_TURN=(\d+)/);
ok(claim-pub===5,`standings are public ${claim-pub} turns before a claim`);
ok(R.includes('five full turns before the throne itself can be claimed')&&!R.includes('four full turns before'),'the rulebook says five full turns');

// No alliance in a game of three realms or fewer, so no 3-realm ally step.
ok(!R.includes('+17 points each in a 3-realm game'),'the ally step no longer quotes a 3-realm figure');
ok(/<tr><td class="num">3<\/td><td class="num">50%<\/td><td class="num">—<\/td><td class="num">—<\/td>/.test(RH),'the bar-at-a-glance row for 3 realms has no ally columns');

// The Defend step sits between the non-moving orders and the Moves (R-007).
ok(!R.includes('Characters on Defend are counted last'),'the turn section no longer says Defend is counted last');

// Hunting Rumours has no roll (R-035).
ok(!R.includes('A failed roll is simply a fact not learned'),'Hunting Rumours no longer mentions a failed roll');

// Lair counts follow the readiness table.
ok(!R.includes('a dozen Moderate lairs'),'"a dozen Moderate lairs" is gone');
ok(R.includes('six to eight Moderate lairs to be ready for Powerful'),'the climb says six to eight Moderate lairs');

// Only equipped (and slotless) items go into a fight.
ok(!R.includes('all of their magic items into the fight'),'personal combat no longer says every item fights');
ok(R.includes('every magic item they have equipped, and every item that needs no slot'),'personal combat says equipped and slotless items fight');

// The three-round limit is for lingering wounds and to-hit penalties; stuns follow their spell.
ok(R.includes('A stun or a silence is not a lingering wound'),'the three-round rule says stuns and silences follow their spell');

// Items carry Druid to 9 (R-036).
ok(!/same holds for Naval, Druid, Sage/.test(R),'the item note no longer stops Druid at 5');
ok(R.includes('and Druid, which counts every level to 9'),'the benefit-cap paragraph names Druid as the exception');

// Ferrying: heavy foot and Mountain Guns take half a hull; no "siege".
ok(!R.includes('though the ship alone could not'),'the wrong griffon example is gone');
ok(!/cavalry, siege, walking creatures/.test(R)&&!/cavalry, siege, ships and beasts/.test(R),'the hull and lift lists no longer name "siege"');
ok(/the Great Turtles, whose Island Back carries two units a hull/.test(R),'the ferrying section names the Great Turtles among the carriers');

// The beaten skeletons' step and the retired Eagle Riders' flight (R-095).
ok(!R.includes('steps 2 and 3 above pass them by'),'skeletons pass step 2 only');
ok(!R.includes('Eagle Riders always fly clear'),'"Eagle Riders always fly clear" is gone');

// Mithril: a gift to dwarves of a dwarven realm, not a relic.
ok(!R.includes('A few relics are never found in lairs'),'Mithril is no longer called a relic');
ok(R.includes('every dwarven character of a dwarven realm bears a suit of mithril'),'the rulebook\'s Dwarven gift names the dwarven realm');
ok(I.includes('every character of a dwarven realm wears mithril'),'the intro\'s Dwarven row names the dwarven realm');

// Druid for fleets: other races' only.
ok(!R.includes('Creatures, Monsters and fleets'),'the Druid paragraph no longer says every fleet needs Druid');

// Four rules, and the battle list's own heading.
ok(R.includes('Four rules that apply to every attack')&&!R.includes('Three rules that apply to every attack'),'"Four rules that apply to every attack", in both places');
ok(/<h3[^>]*>The battle, step by step<\/h3>/.test(RH),'the battle sequence has its own heading');

// Rest heals 30% of maximum HP.
const rest=num(/const REST_HEAL_PCT=(0\.\d+)/);
ok(R.includes(`Rest — recover ${Math.round(rest*100)}% of maximum hit points`),`the orders list says Rest heals ${Math.round(rest*100)}%`);

// Every home holds a Weak lair (R-018).
ok(R.includes('Every home province holds a Weak lair'),'the world section promises the home lair');

// Graves crumble 10% a turn.
ok(/\?0\.05:0\.10;/.test(G),'the engine\'s grave decay is 10% (5% under an Undead realm)');
ok(R.includes('grave has a 10% chance a turn to crumble'),'the rulebook gives the 10% grave decay');

// The Druid ward misses elementals and aberrations.
ok((R.match(/fey, elementals and aberrations/g)||[]).length>=2,'both Druid-ward lists name elementals and aberrations');

// Hand of Death reaches 60% only against a guardian weak to Necromancy.
ok(R.includes('reached only against a guardian weak to Necromancy'),'Hand of Death says when its 60% is reached');

// The volley's Archery bonus multiplies.
ok(R.includes('then 10% more for every level of your Archery'),'the volley says the Archery bonus multiplies');

// Turn 2: a second province doesn't double recruiting.
ok(!R.includes('your recruiting capacity has doubled'),'turn 2 no longer says recruiting doubles');

// The intro's Druid ladder starts at 3.
ok(I.includes('wild creatures and monsters (Druid 3–5)'),'the intro\'s Druid row says 3–5');

// Two links.
ok(/see <a href="#items">Sage discoveries<\/a>/.test(RH),'Research links to the Sage discoveries in the items section');
ok(!/<a href="#armies">the wage rule<\/a>/.test(RH)&&/<a href="#recruit-limits">how many you may raise<\/a>/.test(RH),'Recruit Armies links to "how many you may raise"');
ok(/<h3 id="recruit-limits">How many you may raise in a turn<\/h3>/.test(RH),'the recruit-limit heading carries its anchor');

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
