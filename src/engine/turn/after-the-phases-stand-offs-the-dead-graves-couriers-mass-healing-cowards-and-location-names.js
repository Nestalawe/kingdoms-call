// ── AFTER THE PHASES (plan P1-08k3: the first stage taken out of resolveTurn's own body) ──────────────────────────
// Once the turn's five phases are played (no phase is current any more, and every later line is filed after them),
// the turn settles what the seasons left, in this order:
//   1. a stand-off struck in the last phase is flagged, so the saved map shows the province contested;
//   2. the dead need a master: skeletal companies led by a character with no Necromancy, or left in a garrison, crumble;
//   3. graves underfoot: a necromancer who never moved senses the battlefield dead where he stands;
//   4. neutral heroes may learn a skill; a consecrated province that has changed hands loses its blessing;
//   5. couriers deliver the parcels sent across provinces; Elven companies that slipped a lost battle reach home;
//   6. skill rises still pending are told; a fallen commander's host garrisons, retreats or scatters; intrusions are
//      told once each; wounded lair guardians recover; Mass Healing mends friends standing with a White master;
//   7. every maximum HP is resynced (with a save's one-time note on the earned-HP pool);
//   8. a coward spared on the field makes his way home, his host left behind, and the provinces' lists are rebuilt;
//   9. every hero's location name is brought up to date.
// It takes the turn's context (src/engine/turn/context.js) and nothing else: it reads no value of the phase loop's.
// The body keeps resolveTurn's indent (plan P1-08's Decisions).

function afterThePhasesStandOffsTheDeadGravesCouriersMassHealingCowardsAndLocationNames(turnContext){
  const {G, log, _elvenEscapeQueue}=turnContext;
  // A stand-off struck in the final phase is still a stand-off: flag it now so the state that is
  // SAVED (and every player's map) shows the province as contested, and the fight is joined at the
  // first sweep of next turn rather than being invisible for a whole season.
  flagEnemyStandoffs(turnContext);

  // ── THE DEAD NEED A MASTER ────
  // A skeletal unit is animate only while someone is animating it. It must be led by a CHARACTER
  // (hero or king) with at least Necromancy 1; left with anyone else, or set down as a province
  // garrison where nobody leads it at all, it falls apart. The owning realm is always told, by name
  // and place, so a host does not quietly shrink between turns.
  //
  // Read through `effStat`, so a character who holds the school only through an ITEM still keeps
  // the dead standing — the magic is what matters, not where it came from.
  //
  // TIMING, deliberately: this runs ONCE at END OF TURN rather than after every phase. The rule is
  // absolute (you cannot hold skeletons without a necromancer) but a realm is still free to move a
  // skeletal host between two necromancers within a turn — dropping it to a garrison in phase 2 and
  // picking it up in phase 3 is a legitimate manoeuvre, and an end-of-phase sweep would destroy the
  // host mid-handover.
  {
    const _crumbled={}; // playerIndex -> [ "N unit(s) under X in Y" ]
    const _note=(pi,txt)=>{ if(pi==null) return; (_crumbled[pi]=_crumbled[pi]||[]).push(txt); };
    // (a) led by a character with no Necromancy
    (G.characters||[]).forEach(c=>{
      if(!c||c.player==null||!Array.isArray(c.armies)||!c.armies.length) return;
      if(effStat(turnContext,c,'necromancy')>=1) return;
      const dead=c.armies.filter(a=>a&&a._isSkeletal);
      if(!dead.length) return;
      c.armies=c.armies.filter(a=>!(a&&a._isSkeletal));
      const pv=G.world.provinces[c.location];
      _note(c.player,`${dead.length} skeletal unit${dead.length!==1?'s':''} under ${c.name}${pv?` in ${pv.name}`:''} — ${c.name} has no Necromancy to hold them together`);
    });
    // (b) set down as a garrison, where no character leads them at all
    (G.world.provinces||[]).forEach(pv=>{
      if(!pv||!Array.isArray(pv.garrisonArmies)||!pv.garrisonArmies.length) return;
      const dead=pv.garrisonArmies.filter(a=>a&&a._isSkeletal);
      if(!dead.length) return;
      pv.garrisonArmies=pv.garrisonArmies.filter(a=>!(a&&a._isSkeletal));
      _note(pv.owner,`${dead.length} skeletal unit${dead.length!==1?'s':''} left to garrison ${pv.name} — no one was left to command them`);
    });
    Object.keys(_crumbled).forEach(k=>{
      const pi=+k, lines=_crumbled[k];
      const total=lines.length;
      log('hire',`\u{1F480} The dead will not stand alone. ${lines.join('; ')}. ${total===1?'It crumbles':'They crumble'} to dust — a skeletal host holds together only while a character of at least Necromancy 1 leads it.`,{actor:pi,targets:[pi],system:true});
    });
  }

  // ── GRAVES UNDERFOOT ────
  // Every character with at least one level of Necromancy senses the battlefield dead of the ground
  // they stand on. They learn only THAT graves are there, never what lies in them — Control
  // Undead's province scan is what buys the roll of the dead, and it records its own richer entry
  // when it is cast (see necromancy_control __scan__). Item 7: the reading now happens at EVERY
  // march-in during the phase loop as well
  // (see senseGravesUnderfoot at the move choke-point), so a necromancer marching three provinces
  // reads all three, not only the one they stop in. This end-of-turn sweep therefore only catches
  // whoever never moved — senseGravesUnderfoot's own per-turn guard skips anyone already read here.
  (G.characters||[]).forEach(c=>{
    if(!c||!c.alive||c.player==null) return;
    const pv=G.world.provinces[c.location]; if(!pv) return;
    senseGravesUnderfoot(G, c, pv, (p2)=>log('explore',`💀 ${c.name} feels the dead of ${p2.name} stirring underfoot — battlefield graves lie in this province, though nothing tells how many or what they hold.`,{actor:c.player,targets:[c.player],provinceId:p2.id}));
  });

  // ── NEUTRAL HERO PROGRESSION (2026-09-17 (late), Toby item 1) ────
  // Wandering heroes and local chieftains do not stand still while nobody commands them. From the
  // END of turn NEUTRAL_PROG_FROM_TURN onward, every living neutral hero (player===null — wanderers
  // and neutral-guard chieftains alike) rolls NEUTRAL_PROG_PCT once a turn. On a success, exactly
  // ONE skill point is gained:
  // • sharing a province with another neutral hero → they learn from them: the skill raised is the
  // OTHER hero's highest skill (a random one of them if several tie);
  // • alone → one of their own EXISTING skills (level ≥1), chosen at random.
  // Never more than one point per hero per turn, never past SKILL_MAX. A learner already at the cap
  // in the peer's best skill falls back to the alone rule rather than wasting the roll. Implemented
  // in progressNeutralHeroes (module scope) so the harness can drive it directly.
  // 2026-09-23 (Toby): 25% a turn (was 50%), and never past level 5 by this route (NEUTRAL_PROG_CAP).
  progressNeutralHeroes(G, (txt,pv)=>log('system',txt,{targets:[],provinceId:pv?pv.id:null,system:true}));

  // ── DE-CONSECRATION ── A consecrated province that has passed out of the Divine king's hands
  // this turn (captured by an enemy, or otherwise no longer owned) loses its blessing — which also
  // frees a slot so the king may hallow new ground next turn (up to his White skill level).
  (G.players||[]).forEach((pl,pi)=>{
    if(!pl) return;
    const list=consecratedIds(pl);
    if(!list.length) return;
    const kept=list.filter(pid=>{ const pv=G.world.provinces[pid]; return pv && pv.owner===pi; });
    if(kept.length!==list.length){
      list.filter(pid=>!kept.includes(pid)).forEach(pid=>{
        const pv=G.world.provinces[pid];
        if(pv) log('system',`✨ The consecration of ${pv.name} is broken — it has passed from ${pl.name}'s hands, and the hallowed light departs. The crown may sanctify new ground in its place.`,{actor:pi,targets:[pi],provinceId:pid,public:true,env:true});
      });
      pl.consecratedProvIds=kept;
    }
  });

  // ── COURIER DELIVERIES ── Cross-province Send Item arrivals reach their recipient now, as the
  // season closes, so the items are in hand from the START of next turn (not usable this turn). If
  // the recipient fell this turn the parcel routes to their king (if one lives), else it is lost.
  if(Array.isArray(G._itemDeliveries) && G._itemDeliveries.length){
    G._itemDeliveries.forEach(d=>{
      // A parcel whose contents were cut out by a Grand Heist is no parcel at all — skip it rather
      // than announce an empty courier arriving.
      if(!d||!Array.isArray(d.items)||d.items.length===0) return;
      let dest=(G.characters||[]).find(ch=>ch&&ch.id===d.toId&&ch.alive);
      if(!dest){
        const _orig=(G.characters||[]).find(ch=>ch&&ch.id===d.toId);
        const pi=_orig?_orig.player:null;
        dest=(pi!=null)?(G.characters||[]).find(ch=>ch&&ch.alive&&ch.player===pi&&ch.isKing):null;
      }
      const nm=(d.items||[]).map(it=>it.name).join(', ');
      if(!dest){
        if(nm) log('hire',`📦 A courier bearing ${nm}${d.fromName?` from ${d.fromName}`:''} finds no one left to receive it — the parcel is lost.`,{actor:null,targets:[],phase:99});
        return;
      }
      dest.items=dest.items||[];
      (d.items||[]).forEach(item=>{ dest.items.push(item); applyItemMaxHp(dest,item); /* item 6 */ });
      log('hire',`📦 A courier reaches ${dest.name} with ${nm}${d.fromName?` from ${d.fromName}`:''} — delivered as the season closes, ready to use next turn.`,{actor:dest.player,targets:[dest.player],charId:dest.id,phase:99});
      { const _gn=gainedItemNote(dest,d.items); if(_gn) log('hire',_gn,{actor:dest.player,targets:[dest.player],charId:dest.id,phase:99}); } // item 10
    });
    G._itemDeliveries=[];
  }

  // ── ELVEN ESCAPE delivery ── Units that slipped a lost battle make for home NOW, when the turn's
  // fighting is done and ownership is final. Each is placed in the king's home province (or the
  // realm's wealthiest remaining province if the home has fallen); a dynasty that holds no land at
  // all has nowhere to run to, and those survivors are lost. They arrive as garrison of the
  // province.
  if(Array.isArray(_elvenEscapeQueue) && _elvenEscapeQueue.length){
    const _byPlayer={};
    _elvenEscapeQueue.forEach(e=>{ (_byPlayer[e.player]=_byPlayer[e.player]||[]).push(e.unit); });
    Object.keys(_byPlayer).forEach(pk=>{
      const pi=+pk; const units=_byPlayer[pk];
      const destId=monarchRestProvId(G, pi);
      const dest=(destId!=null)?G.world.provinces[destId]:null;
      if(!dest){
        log('combat',`🍃 ${units.length} Elven unit${units.length!==1?'s':''} broke free of battle and made for home — but ${G.players[pi]?.name||'the realm'} holds no land left to return to, and they scatter into the wild, lost.`,{actor:null,targets:[pi],phase:99});
        return;
      }
      dest.garrisonArmies=dest.garrisonArmies||[];
      units.forEach(u=>dest.garrisonArmies.push(u));
      log('combat',`🍃 ${units.map(u=>u.unitName||u.type).join(', ')} (${units.length} unit${units.length!==1?'s':''}) slipped away from battle and have found their way home to ${dest.name}, rejoining the garrison there.`,{actor:pi,targets:[pi],provinceId:dest.id,phase:99,public:false});
    });
    _elvenEscapeQueue.length=0;
  }

  // Item 12 safety net: flush any incidental skill-rises that were earned after the last in-phase
  // flush (none expected today, but this guarantees no such line is ever silently dropped).
  resolveAllPendingSkillGains(turnContext);
  if(turnContext._deferredSkillLogs.length){ writeDeferredSkillLines(turnContext,turnContext._deferredSkillLogs); turnContext._deferredSkillLogs=[]; }

  // ── Fallen-commander backstop ── The per-phase sweep deliberately leaves a leaderless host in
  // place while its province is still contested. The turn is over now, so nothing is left to fight:
  // whatever survived garrisons, retreats or scatters. This also bounds the state — no army can
  // stay attached to a corpse across a turn boundary, whatever happened during the turn.
  (G.characters||[]).forEach(dc=>{
    if(dc.alive) { delete dc._leaderlessHost; return; }
    delete dc._leaderlessHost;
    if((dc.armies||[]).length>0) disperseDeadCharArmies(turnContext,dc);
    delete dc._slainBy; // a commander who fell with no host keeps no note of the killer in the saved state
  });

  // Intel collapse: emit one consolidated intrusion line per (target, hero, province) now that all
  // phases are resolved, instead of a separate line each phase.
  flushIntrusionNotifications(turnContext);

  // Wounded feature guardians recover over the year between turns.
  healFeatureMonsters(turnContext);

  // ── WHITE L6 (Mass Healing) ── A master of the White arts standing among friendly characters at
  // year's end mends their wounds: each own/allied living character sharing their province (the
  // healer included) heals HALF their max HP. Runs after all combat.
  {
    const _mhDone=new Set();
    (G.characters||[]).forEach(healer=>{
      if(!healer||!healer.alive||healer.player==null||healer.location==null) return;
      if(perkTier(healer,'white')<1) return; // WHITE L6+
      (G.characters||[]).forEach(t=>{
        if(!t||!t.alive||t.location!==healer.location||_mhDone.has(t.id)) return;
        const friendly=(t.player===healer.player)||(t.player!=null&&relOfReport(G,healer.player,t.player)==='allied');
        if(!friendly) return;
        const max=t.maxHp||20;
        if((t.hp==null?max:t.hp)<max){
          const _before=(t.hp==null?max:t.hp);
          t.hp=Math.min(max,_before+Math.max(1,Math.ceil(max*MASS_HEALING_PCT))); _mhDone.add(t.id);
          log('system',`✨ ${healer.name}'s Mass Healing washes over ${t.id===healer.id?'them':t.name} — ${t.id===healer.id?'their':t.name+"'s"} wounds close (+${t.hp-_before} HP → ${t.hp}/${max}${t.hp>=max?', fully restored':''}).`,{actor:t.player,targets:[t.player],charId:t.id,provinceId:t.location});
        } else { _mhDone.add(t.id); }
      });
    });
  }

  // ── MAX-HP SYNC ── every living character's maximum HP is resynced (earned pool + kit + realm
  // discoveries) at the close of the turn and any change is announced in their Chronicle. Combat
  // wins announce their own gain at the moment of victory (rollHpGain); this catches item/discovery
  // moves.
  _MAXHP_PLAYERS=G.players;
  (G._maxHpMigration||[]).forEach(r=>{ // one-time note for saves migrated to the earned-HP pool
    const ch=(G.characters||[]).find(c=>c&&c.id===r.charId); if(!ch) return;
    log('system',`📜 A new reckoning of vigour: ${ch.name}'s maximum HP is now earned in battle rather than set by skill — ${r.old} becomes ${r.nu}. Victories over lair guardians and enemy commanders will raise it from here.`,{actor:r.player,targets:[r.player],charId:ch.id,public:true});
  });
  delete G._maxHpMigration;
  syncAllMaxHp(turnContext); // end-of-turn pass (also run after every phase — see the phase loop)

  // ── Spared cowards slink home ── A Cowardly commander who begged for mercy this turn abandons
  // the field; by next turn they have made their way back to their king's seat (home province, or
  // the wealthiest province still held if home has fallen). Done after all phases so it reads the
  // final ownership map. Characters with no land left (dynasty landless) simply stay where they
  // fled.
  // 2026-09-26 (Toby item 7) — HE RUNS; THE HOST DOES NOT. A man who throws down his sword and begs
  // for his life does not then lead his army home in good order. Whatever he was leading STAYS on
  // the ground he fled from: it falls in behind another commander of his realm still standing
  // there, or takes its place in the province garrison if the realm holds the ground, or — on
  // foreign soil with nobody left to lead it — meets exactly the fate a fallen commander's
  // leaderless host meets (falls back to adjacent friendly land, else scatters as mercenaries).
  (G.characters||[]).forEach(c=>{
    if(c._mercyFledTurn!==G.turn || !c.alive) return;
    const dest=monarchRestProvId(G, c.player);
    if(dest!=null && dest!==c.location){
      abandonHostOnFlight(turnContext,c); // the host stays on the field he ran from — see the note above
      c.location=dest;
      log('system',`🏳 ${c.name}, spared on the field, makes their way back to ${G.world.provinces[dest]?.name||'safety'}.`,{actor:c.player,targets:[c.player],charId:c.id,provinceId:dest});
    }
  });
  reconcileProvinceCharacters(turnContext); // rebuild province.characters after any mercy relocations

  // 6. Update location names for all characters
  (G.characters||[]).forEach(c=>{
    const p=G.world.provinces[c.location];
    if(p)c.locationName=p.name;
  });
}
