// ── TITLE HOLDERS AND BATTLE MERIT (plan P1-08a: lifted out of resolveTurn) ────
// Who holds a Title or a minor title this turn (G._titleHolders and G._minorHolders, worked out once at the start of
// the turn: see "LIVE TITLE PERKS" in resolveTurn), and the merit a battle earns. Each takes the turn's context first
// (src/engine/turn/context.js).
  // ── TITLE MERIT: battles ── Grand Marshal (land) / Sea Lord (sea): the winner gains +1 per enemy
  // unit destroyed; the loser loses 1 per own unit lost. Counted from the pooled battle copies,
  // which still carry _died flags at the call site. 2026-09-16: credited for EVERY battle — a rival
  // realm, a neutral province's chieftain and his guard, a leaderless neutral guard, or an enemy
  // realm's bare garrison alike. The bucket is chosen off the province's terrain, so one helper
  // pays the Grand Marshal ashore and the Sea Lord at sea. 2026-09-12: reads
  // combatVsChar/combatVsNPC's OWN casualty counts. A leaderless defence
  // (an enemy realm's garrison) has no commander to debit, so only the attacker's merit moves; the
  // attacker is still debited for their own dead when a garrison throws them back.
  function creditBattle(turnContext, atkChar, defChar, battle, prov){
    const {G}=turnContext;
    if(!atkChar||!battle||atkChar.player==null) return;
    // WAR ASSESSMENT news (2026-09-29): a battle between two realms is remembered a few turns.
    { const _dp=(defChar&&defChar.player!=null)?defChar.player:((prov&&prov.owner!=null)?prov.owner:null);
      if(_dp!=null&&_dp!==atkChar.player) noteRealmBattle(G,prov?prov.id:null,atkChar.player,_dp,!!battle.won,battle.atkLost,battle.defLost); }
    // 2026-09-21: a commander killed in this battle's pre-battle duel earns nothing from it.
    // handleHeroDeath docks 25% of accumulated Title merit AT the moment of death, so anything
    // credited afterwards escapes that penalty entirely and can swing a Title race.
    if(atkChar.alive===false) return;
    const bucket=(prov&&prov.terrain==='sea')?'sea':'marshal';
    const atkLost=battle.atkLost||0, defLost=battle.defLost||0;
    const defCmdr=(defChar&&defChar.player!=null)?defChar:null;
    if(battle.won){ TM(atkChar)[bucket]+=defLost; if(defCmdr) TM(defCmdr)[bucket]-=defLost; }
    else          { if(defCmdr) TM(defCmdr)[bucket]+=atkLost; TM(atkChar)[bucket]-=atkLost; }
    // THE BEASTLORD AND THE WILDWARDEN. The WINNER is credited one point for every Monster- or
    // Creature-category unit still under their banner when the fighting stops. Counted from the
    // survivors on purpose: a commander who threw a dragon into the line and lost it has won the
    // field but not shown mastery of the beast. The loser is not debited \u2014 unlike the
    // Marshal's ledger these titles only ever rise, matching the Monster-Bane's shape.
    const victor=battle.won?atkChar:defCmdr;
    if(victor&&victor.alive!==false) (victor.armies||[]).forEach(a=>creditBeastUnit(TM(victor),a,1)); // a dead victor showed no mastery of the beast
  }

  function charHoldsTitle(turnContext,c,key){ const {G}=turnContext; return !!(c&&G._titleHolders&&G._titleHolders[key]&&G._titleHolders[key].charId!=null&&G._titleHolders[key].charId===c.id); }
  function playerHoldsTitle(turnContext,pi,key){ const {G}=turnContext; return !!(G._titleHolders&&G._titleHolders[key]&&G._titleHolders[key].playerIndex===pi); }
  function charMinor(turnContext,c,key){ const {G}=turnContext; return !!(c&&G._minorHolders&&G._minorHolders[key]&&G._minorHolders[key].charId===c.id); }
