// ── RESOLVE TURN — FULL INLINE ENGINE ────
// This is a self-contained turn resolver embedded directly in the portal. It processes all 5 phases
// for all characters, resolves actions, updates the game state, generates new turn reports, and
// pushes everything to Supabase.

// fields of study a player can never choose or see listed — found only as a side result of
// researching any other field (see case 'research').
const RESEARCH_HIDDEN_CATS=new Set(['Heroic','Special']);
// the odds of an unlooked-for find in a HIDDEN field (Heroic / Special), expressed against the
// character's ordinary Sage discovery chance. Divisor 5 with a 10% ceiling.
const HIDDEN_DISCOVERY_DIVISOR=5;
const HIDDEN_DISCOVERY_CAP_PCT=10;
// ── RESEARCH CHOICE (2026-09-21, Toby) ── a successful Research order no longer hands over one random
// discovery: it turns up TWO in the chosen field, held on the realm as a pending choice
// (`pl.pendingDiscoveryChoices`: {key, turn, charId, charName, category, options:[id,id]}). In the
// NEXT turn's orders the player keeps one; the other is FORGOTTEN for good (`pl.forgottenDiscoveries`,
// ids) and never comes up again from Research, a Breakthrough or the Grand Library. No choice sent
// (bots, or a player who left it blank) → one is kept at random. Options awaiting a choice are also
// withheld from every other roll, so the same discovery is never offered twice at once.
function discBlockedIds(pl){
  const s=new Set(((pl&&pl.forgottenDiscoveries)||[]).map(String));
  ((pl&&pl.pendingDiscoveryChoices)||[]).forEach(p=>(p&&p.options||[]).forEach(id=>s.add(String(id))));
  return s;
}
// ── Discovery eligibility & generic effect readers ────
// Race/alignment discoveries carry `race` / `alignment`; a realm can only research, breakthrough,
// Grand-Library or steal (spy) a discovery it is eligible for. Their effects are data-driven
// (`effect.kind`) and read through discEffectsOf / discSumOf at the relevant engine hooks.
const DISC_BY_ID={}; SAGE_DISCOVERIES_P.forEach(d=>{ DISC_BY_ID[d.id]=d; });
function discEligible(d, pl){
  if(!d) return false;
  if(d.race && (!pl || pl.race!==d.race)) return false;
  if(d.alignment && (!pl || pl.alignment!==d.alignment)) return false;
  return true;
}
// 2026-09-21 rebalance: a discovery may carry a SECOND, smaller effect (`effect2`) — used by the
// Espionage and exploration discoveries whose single lever was too weak on its own. Both are read
// through the same generic hooks, so every effect below applies to either slot.
function discEffectsOf(pl, kind){
  if(!pl) return [];
  const out=[];
  (pl.discoveries||[]).forEach(d=>{ const t=d&&DISC_BY_ID[d.id]; if(!t) return; [t.effect,t.effect2].forEach(e=>{ if(e&&e.kind===kind) out.push(e); }); });
  return out;
}
// Tunable magnitude of a discovery still wired by id (its row in SAGE_DISCOVERIES_P holds the number).
function discParam(id, field, dflt){ const d=DISC_BY_ID[id]; const v=d&&d.effect?d.effect[field]:undefined; return (v==null)?dflt:v; }
// sd14 Taxation Records: +pct% of province income (integer maths, rounded down), capped.
function taxRecordsGold(income, capG){ const pc=Math.round(discParam('sd14','pct',0.05)*100); const raw=Math.floor((income||0)*pc/100);
  return Math.min(capG!=null?capG:discParam('sd14','max',99), raw); }
// ── TAX-BONUS CEILING (Toby 2026-09-24) ─────────────────────────────────────────────────────
// No single source of extra TAX INCOME may pay more than 5% of the realm's BASE tax income — the
// bare sum of its provinces' tax, before consecration, Bless, enslavement, earthquakes, discoveries
// or anything else. It binds each province-tax discovery, Taxation Records, and the magic items
// that pay tax gold (their combined total). Always at least 1g, so a small realm still gains.
const TAX_BONUS_CAP_PCT=0.05;
function realmBaseTax(gs, pi){
  const provs=(gs&&gs.world&&gs.world.provinces)||[];
  return provs.reduce((s,pv)=>s+((pv&&pv.owner===pi)?(pv.tax||0):0),0);
}
function taxBonusCap(baseTax){ return Math.max(1, Math.floor((baseTax||0)*TAX_BONUS_CAP_PCT)); }
// Magic items that pay tax gold (`taxBonus` flat, `taxPerProv` per province) share ONE ceiling:
// the flat bonuses are paid first, the per-province gold fills whatever is left.
function capItemTaxGold(taxBonus, perProvBonus, capG){
  const flat=Math.min(taxBonus||0, capG);
  const perProv=Math.min(perProvBonus||0, Math.max(0, capG-flat));
  return {taxBonus:flat, perProvBonus:perProv, cut:((taxBonus||0)+(perProvBonus||0))-(flat+perProv)};
}
// CEILINGS (Toby 2026-09-21): however many discoveries a realm stacks, the unit-strength multiplier
// they give any one unit never exceeds ×1.30, and the own-ground fortification bonus (defOwn) never
// exceeds +30%.
const DISC_STR_CAP=1.30;
const DISC_DEFOWN_CAP=0.30;
// Does a `tax` effect pay on this province? Filters: minTax / maxTax (the province's own tax),
// terrains, race (the province's folk), ownRace / foreign (folk of / not of the king's race),
// coastal, garrisoned, home (the realm's founding capital).
function discTaxMatch(e, pv, gs, pi, pl){
  const t=pv.tax||0;
  if(e.minTax!=null&&t<e.minTax) return false;
  if(e.maxTax!=null&&t>e.maxTax) return false;
  if(e.terrains&&!e.terrains.includes(pv.terrain)) return false;
  if(e.race&&pv.race!==e.race) return false;
  if(e.ownRace&&!(pl&&pv.race&&pv.race===pl.race)) return false;
  if(e.foreign&&!(pl&&pv.race&&pv.race!==pl.race)) return false;
  if(e.coastal&&!discProvCoastal(gs,pv)) return false;
  if(e.garrisoned&&!((pv.garrisonArmies||[]).length>0)) return false;
  if(e.home&&homeFounderOf(gs,pv.id)!==pi) return false;
  return true;
}
// Module-level coastal test for the discovery helpers (provIsCoastal itself lives inside runTurn's
// scope, so the report builder cannot call it). Same rule: a land province with a sea neighbour.
function discProvCoastal(gs, pv){
  if(!gs||!gs.world||!pv||pv.terrain==='sea') return false;
  return getNeighborsP(pv,gs.world.cols,gs.world.rows,gs.world.provinces).some(n=>n&&n.terrain==='sea');
}
// Per-province `tax` discovery gold. `acc` (a Map, one per realm per collection) tracks what each
// capped effect (`max`) has already paid this turn, so a capped discovery never pays more than its
// ceiling however large the realm grows. Shared by the collector and the report forecast.
function discTaxAdd(pl, pv, gs, pi, acc, capG){
  let add=0;
  discEffectsOf(pl,'tax').forEach(e=>{ if(!discTaxMatch(e,pv,gs,pi,pl)) return; let b=e.bonus||0;
    // every province-tax discovery is capped: at `capG` (5% of the realm's base tax income) and, if
    // its row still carries a fixed `max`, at that too. `acc` tracks what each effect has paid.
    const lim=(capG!=null)?Math.min(capG, e.max!=null?e.max:capG):e.max;
    if(lim!=null){ const u=acc.get(e)||0; b=Math.max(0,Math.min(b,lim-u)); acc.set(e,u+b); }
    add+=b; });
  return add;
}
// `upkeep` discoveries: the wage of one army after every matching cut (minimum 1g per unit). The
// per-turn ceiling on what a single upkeep discovery may save is now the SAME 5%-of-base-income cap
// the tax discoveries use (2026-09-26, Toby): `capG` replaces whatever fixed `max` the row carried,
// so Goblin Warrens' old flat 1g becomes 5% of the realm's base tax income and grows with the realm.
// `acc` tracks what each capped effect has already saved this turn.
function discUpkeepWage(pl, a, w, acc, capG){
  if(!pl||!a||a._isSkeletal) return w;
  let out=w;
  discEffectsOf(pl,'upkeep').forEach(e=>{ if(!discUnitMatch(e,a)) return; let cut=Math.min(-(e.delta||0), out-1); if(cut<=0) return;
    const lim=(capG!=null)?capG:e.max;
    if(lim!=null){ const u=acc.get(e)||0; cut=Math.min(cut,lim-u); if(cut<=0) return; acc.set(e,u+cut); }
    out-=cut; });
  return out;
}
// Hero wage after discoveries: `heroWage` cuts (optionally only for heroes of given alignments) then
// the `heroWageCap` ceiling. Minimum 1g. Both are capped per turn at `capG` (5% of base income).
function discHeroWage(pl, h, raw, acc, capG){
  let w=raw;
  discEffectsOf(pl,'heroWage').forEach(e=>{ if(e.heroAlign&&!e.heroAlign.includes(h.alignment)) return; let cut=Math.min(e.amount||0, w-1); if(cut<=0) return;
    const lim=(capG!=null)?capG:e.max;
    if(lim!=null){ const u=acc.get(e)||0; cut=Math.min(cut,lim-u); if(cut<=0) return; acc.set(e,u+cut); }
    w-=cut; });
  discEffectsOf(pl,'heroWageCap').forEach(e=>{ if(e.cap==null||w<=e.cap) return; let cut=w-Math.max(1,e.cap); const lim=(capG!=null)?capG:e.max; if(lim!=null){ const u=acc.get(e)||0; cut=Math.min(cut,lim-u); if(cut<=0) return; acc.set(e,u+cut); } w-=cut; });
  return Math.max(1,w);
}
// `maxHp` discoveries for one character (filters: king, heroOnly, skill — at least one trained level).
function discMaxHpFor(pl, ch){
  if(!pl||!ch) return 0;
  return discSumOf(pl,'maxHp','hp',e=>(!e.king||!!ch.isKing)&&(!e.heroOnly||!ch.isKing)&&(!e.skill||(((ch.skills||{})[e.skill]||0)>=1)));
}
// Chance (0..1) that a newly raised unit of this type starts one tier higher (`recruitQ`).
function discRecruitQChance(pl, armyType){
  return Math.min(1,discSumOf(pl,'recruitQ','pct',e=>discUnitMatch(e,armyType,true)));
}
// Per-terrain explore multiplier from `explore` discoveries (shipped in the report so the player
// portal's preview no longer parses description text).
function discExploreMult(pl, terrain){
  let m=1; discEffectsOf(pl,'explore').forEach(e=>{ if(!e.terrains||e.terrains.includes(terrain)) m*=(e.mult||1); }); return m;
}
function discSumOf(pl, kind, field, pred){
  let s=0; discEffectsOf(pl,kind).forEach(e=>{ if(!pred||pred(e)) s+=(e[field]||0); }); return s;
}
const DISC_CLS_SETS={
  cavalry:new Set(['Free Lances','Gilded Lances','Warg Riders','Eagle Riders','Noble Griffons','Stag Riders','Ironhoof Rams']),
  infantry:new Set(['Shieldwall Levies','Dwarven Guard','Orc Berserkers','Men-at-Arms']),
  missile:new Set(KC_UNIT_CLASS.missile),
  fleet:new Set(KC_UNIT_CLASS.carrier),
  flyer:new Set(KC_UNIT_CLASS.aerial),
  garrison:new Set(KC_UNIT_CLASS.garrison),
};
// Garrison units always muster into the province garrison when recruited (2026-09-23c, Toby).
function isGarrisonUnitType(t){ return DISC_CLS_SETS.garrison.has(t); }
function discUnitIs(cls, army, typeOnly){
  const t=typeOnly?army:(army&&army.type);
  if(cls==='primal') return CREATURE_ARMIES.has(t)||MONSTER_ARMIES.has(t);
  if(cls==='creature') return CREATURE_ARMIES.has(t);
  if(cls==='monster') return MONSTER_ARMIES.has(t);
  if(cls==='skeletal') return !typeOnly&&!!(army&&army._isSkeletal);
  // 2026-09-27 (Toby item 1): the four HUMANOID RACIAL FLYERS — Eagle Riders, Noble Griffons,
  // Gnomish Gyrocopters and Wyvern Riders (FLYING_TYPES) — are riders and crews of the playable
  // races, raised in their own race's provinces and carrying that race on `army.race`. They sit in
  // CREATURE_ARMIES / MONSTER_ARMIES for the Druid and Druidic/Evil rules (their MOUNTS are beasts),
  // but for everything that asks "is this one of my own people?" they are their race's soldiers and
  // must take the same benefits and penalties as the rest of the racial roster. Every RACE-keyed
  // effect already reached them through `army.race`; this class was the one place that did not, so a
  // realm's humanoid creed discoveries (recruit cost, upkeep, promotion, death reduction, mercenary
  // price) skipped exactly those four units. They are folded in here. Fleets and the skeletal dead
  // stay out, as do the true wild beasts.
  if(cls==='humanoid') return (FLYING_TYPES.has(t)||(!CREATURE_ARMIES.has(t)&&!MONSTER_ARMIES.has(t)))&&!DISC_CLS_SETS.fleet.has(t)&&!(army&&army._isSkeletal);
  const st=DISC_CLS_SETS[cls]; return !!(st&&st.has(t));
}
// Does a unit-filtered effect (race / types / cls) apply to this army? (typeOnly: `army` is a type
// name.)
function discUnitMatch(e, army, typeOnly){
  if(!e) return false;
  const t=typeOnly?army:(army&&army.type);
  if(e.types && !e.types.includes(t)) return false;
  if(e.cls && !discUnitIs(e.cls, army, typeOnly)) return false;
  if(e.race){ const r=typeOnly?(ARMY_RACE_OF_TYPE[t]||null):(army&&army.race||null); if(r!==e.race) return false; }
  if(Array.isArray(e.quality)){ const q=typeOnly?'Average':((army&&army.quality)||'Average'); if(!e.quality.includes(q)) return false; }
  return true;
}
// Realm-level recruit cost of one unit: sd16 Shipbuilding (fleets half, rounded up) then the race /
// alignment `recruitCost` discoveries (delta, then factor; minimum 1g). Per-character reductions
// (Druid L6 half-price beasts) are applied by the engine on top. Used by the engine AND the report
// builders so the player portal's recruit preview shows the realm's real price.
const _FLEET_TYPES_DISC=new Set(KC_UNIT_CLASS.carrier);
function realmRecruitCost(pl, armyType, baseCost){
  let c=(baseCost||2); // sd16 Shipbuilding is now an ordinary `recruitCost` factor effect (cls fleet)
  discEffectsOf(pl,'recruitCost').forEach(e=>{ if(!discUnitMatch(e, armyType, true)) return; if(e.delta) c+=e.delta; if(e.factor) c=Math.ceil(c*e.factor); });
  return Math.max(1,c);
}
const ARMY_RACE_OF_TYPE={'Shieldwall Levies':'Human','Free Lances':'Human','Yeoman Longbows':'Human','Gilded Lances':'Human','Human Garrison':'Human','Men-at-Arms':'Human',
  'Elven Bowmen':'Elven','Forest Wardens':'Elven','Shadow Archers':'Elven','Eagle Riders':'Elven','Elven Galleys':'Elven','Elven Garrison':'Elven','Stag Riders':'Elven',
  'Dwarven Guard':'Dwarven','Ironwood Crossbows':'Dwarven','Mountain Guns':'Dwarven','Dwarf Ironclads':'Dwarven','Gnomish Gyrocopters':'Dwarven','Dwarf Garrison':'Dwarven','Ironhoof Rams':'Dwarven',
  'Warg Riders':'Orcish','Orc Berserkers':'Orcish','Goblin Horde':'Orcish','Wyvern Riders':'Orcish','Orcish Longships':'Orcish','Black Arrows':'Orcish','Orc Garrison':'Orcish'};



// Spells available in encounters as CA tactic (subset of above)


// opts.auto — called by the auto-turn watcher: no confirm dialog, status goes to the watcher banner
// opts.game — the game row to run (defaults to currentGame); the watcher may run a game the GM
// isn't viewing
// ── PENDING SYNTHETIC ENCOUNTER PLANS (2026-09-21) ────
// A pre-order card for a hero a realm only INTENDS to take into service (hired_/resurrect_/charm_)
// carries an encounter plan as well as orders. The plan used to be written onto the real character
// at ingestion, so a player who lost the race — or never landed the cast at all — still set that
// hero's combat stance, and an encounter plan PERSISTS from turn to turn. Plans on synthetic cards
// are now held here and applied only inside the branch where the hero actually enters service.
function applyPendingSynthPlan(G, hero, pi){
  if(!G||!hero||!Array.isArray(G._pendingSynthPlans)) return false;
  const p=G._pendingSynthPlans.find(x=>x&&x.heroId===hero.id&&x.player===pi&&x.plan);
  if(!p) return false;
  hero.encounterPlan=p.plan;
  return true;
}

