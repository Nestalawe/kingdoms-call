// ── INTRUSION WARNINGS (plan P1-08b: lifted out of resolveTurn) ────
// After each phase, the warnings a realm gets of enemy heroes in its land or beside its own heroes. It takes the turn's
// context first (src/engine/turn/context.js): the state, the seasons' names and the turn's warnings so far
// (_intrusionAcc), which resolveTurn's flushIntrusionNotifications writes into the log.
  // ── INTRUSION NOTIFICATIONS ────
  // After each phase resolves, scan for situations where players need to be notified about things
  // happening in their territory or in provinces where their heroes are present.
  function generateIntrusionNotifications(turnContext,ph){
    const {SEASONS, G, _intrusionAcc}=turnContext;
    const phaseLabel=SEASONS[ph];
    G.players.forEach((targetPlayer,targetPi)=>{
      const targetOwnedProvs=new Set(targetPlayer.provinces||[]);
      const targetCharProvs=new Set(
        (G.characters||[]).filter(c=>c.player===targetPi&&c.alive).map(c=>c.location)
      );
      const targetKnownProvs=new Set([...targetOwnedProvs,...targetCharProvs]);

      // Check every other player's characters
      G.players.forEach((actingPlayer,actingPi)=>{
        if(actingPi===targetPi) return;
        const actingChars=(G.characters||[]).filter(c=>c.player===actingPi&&c.alive);
        actingChars.forEach(ac=>{
          const acProv=G.world.provinces[ac.location];
          if(!acProv) return;
          if(ac._invisTurn===G.turn) return; // 2026-10-15 (Toby): a hero under Invisibility is not noticed
          const inOwnedProv=targetOwnedProvs.has(ac.location);
          // 2026-10-15 (Toby): a lone enemy lurking in your land with none of your heroes there is
          // reported only if your people spot them — the same roll the report makes for this hero,
          // province and turn (the report is built after the turn counter advances, hence G.turn+1).
          if(inOwnedProv&&!targetCharProvs.has(ac.location)&&!(ac.armies||[]).length&&relOfReport(G,targetPi,actingPi)==='enemy'
             &&!spotEnemyInOwnedProvince(G,targetPi,acProv,ac,G.turn+1)) return;
          const inKnownProv=targetKnownProvs.has(ac.location);
          if(!inKnownProv) return; // target doesn't know about this province

          // 2026-10-15 (Toby, D1): the same rough size the map gives, whatever the watcher's Spy
          const forceDesc=armySizeBand((ac.armies||[]).length);

          // Accumulate the sighting; a single consolidated line per (target, hero, province) is
          // emitted after the turn resolves (see flushIntrusionNotifications). actor is left null
          // on the eventual log so the spotted (intruding) player never receives the owner's line.
          const branch=inOwnedProv?'own':'known';
          const key=`${targetPi}|${ac.id}|${ac.location}|${branch}`;
          let rec=_intrusionAcc.get(key);
          if(!rec){ rec={targetPi, branch, actingName:actingPlayer.name, acName:ac.name, provName:acProv.name, provId:ac.location, phases:[], forceByPhase:{}}; _intrusionAcc.set(key,rec); }
          if(!rec.phases.includes(ph)) rec.phases.push(ph);
          rec.forceByPhase[ph]=forceDesc;
        });
      });

      // (Wandering hero sightings are reported once at end of turn in the Intelligence
      // section's "Wandering Heroes" list — no need to log each phase's movement here.)
    });
  }
