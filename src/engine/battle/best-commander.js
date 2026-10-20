// ── THE BEST COMMANDER (plan P1-08b: lifted out of resolveTurn) ────
// Which of a realm's heroes leads a pooled host (commandScore, pickBattleCommander), the hand-over of command and its
// line, and a host's total strength (armyTotalStr). Each takes the turn's context first (src/engine/turn/context.js),
// but commandHandoverLine, which reads none.
// ── BEST COMMANDER TAKES THE FIELD ────
// When two or more of a realm's characters pool their armies into ONE battle — an attacker joined
// by unified contingents, or a defender reinforced by everyone standing in the province — the
// combined host is led by whichever of them gets the MOST out of it, not by whoever happened to
// give the order or happened to sit earliest in G.characters. Strict best score wins: the
// veterans recognise the better general and fall in behind him.
//
// commandScore is the engine's own arithmetic, not a proxy: every pooled unit is run through
// armStr under that candidate (so Druid shortfall, same-race leading, alignment and item army
// bonuses, terrain and the sea penalty all count), then multiplied by that candidate's Tactical
// on land units and Naval on hulls exactly as the battle will, then folded through the terrain
// battle lines
// (sd09 Flanking Doctrine included). Curses, Psychic Blast negation and the Strategist minor title
// are honoured because they are read the same way the battle reads them.
function commandScore(turnContext, cand, pooled, prov, isAttacker) {
  const { G } = turnContext;
  if (!cand || !pooled || !pooled.length) return 0;
  const align = (cand.player != null ? (G.players[cand.player] || {}).alignment : null) || 'Neutral';
  const terrain = (prov && prov.terrain) || 'plain';
  let tact = cand._tacticalNegated
    ? 0
    : effStat(turnContext, cand, 'tactical') + (charMinor(turnContext, cand, 'strategist') ? 1 : 0);
  if (cand._curseHalveStat === 'tactical') tact = Math.floor(tact / 2);
  const tacB = terrain === 'sea' ? 1 : tacMulted(Math.min(2.0, 1 + tact * 0.2), cand);
  let nav = effStat(turnContext, cand, 'naval');
  if (cand._curseHalveStat === 'naval') nav = Math.floor(nav / 2);
  const navB = 1 + nav * 0.2;
  const _coast = provIsCoastal(G, prov);
  const rows = pooled
    .filter((a) => a)
    .map((a) => {
      let base = 0;
      try {
        base = armStr(turnContext, a, cand, align, terrain, {
          force: pooled,
          enemyForce: [],
          isAttacker: !!isAttacker,
          coastal: _coast,
        });
      } catch (e) {
        base = unitBaseStrength(a);
      }
      const fly = FLYING_TYPES.has(a.type),
        sea = SEA_TYPES.has(a.type);
      return { a, base: base * (sea ? navB : tacB), fly, sea }; // flyers take Tactical (2026-09-23c); `a` so the grid can place by type
    });
  return battleLineTotal(
    rows,
    battleFrontWidth(terrain),
    cand.player != null && hasDisc(turnContext, cand.player, 'sd09'),
    { terrain, tac: tact },
  );
}
// Choose the leader of a pooled force. `deflt` is whoever would have led before (the mover, or
// the standing defender); `joiners` are the characters whose troops are folding in. Returns the
// winner plus the rest, and whether command actually changed hands (for the narrative line).
function pickBattleCommander(turnContext, deflt, joiners, pooled, prov, isAttacker) {
  const cands = [deflt, ...(joiners || [])].filter((x) => x && x.alive !== false);
  if (cands.length <= 1) return { leader: deflt, others: (joiners || []).slice(), changed: false };
  let best = deflt,
    bestS = commandScore(turnContext, deflt, pooled, prov, isAttacker);
  cands.forEach((x) => {
    if (x === deflt) return;
    const sc = commandScore(turnContext, x, pooled, prov, isAttacker);
    if (sc > bestS) {
      bestS = sc;
      best = x;
    }
  });
  return { leader: best, others: cands.filter((x) => x !== best), changed: best !== deflt };
}
// Battles run on shallow copies; this returns the LIVE character behind one (or the object itself
// if it is already the real thing, as in the resumed-battle and hunt paths).
function realCharOf(turnContext, x) {
  const { G } = turnContext;
  if (!x || x.id == null) return x;
  return (G.characters || []).find((y) => y && y.id === x.id) || x;
}
// Move a real character to a province, keeping both provinces' character lists straight. Used
// when a pooled host falls back together after a lost battle.
function relocateChar(turnContext, ch, provId) {
  const { G } = turnContext;
  if (!ch || provId == null || ch.location === provId) return;
  const from = G.world.provinces[ch.location],
    to = G.world.provinces[provId];
  if (from && Array.isArray(from.characters)) from.characters = from.characters.filter((id) => id !== ch.id);
  if (to) {
    to.characters = to.characters || [];
    if (!to.characters.includes(ch.id)) to.characters.push(ch.id);
    ch.location = to.id;
    ch.locationName = to.name;
  }
}
// Battles are fought on shallow COPIES of the commander ({...leader, armies:[pooled]}). Write it
// all back onto the real character. `armies` and `location` are excluded: the pooled army list is
// split back to its owners by the caller, and the fall-back is applied to the whole party by
// relocateChar.
function syncLeaderCopy(turnContext, real, copy) {
  const { G } = turnContext;
  if (!real || !copy || real === copy) return;
  Object.keys(copy).forEach((k) => {
    if (k === 'armies' || k === 'location' || k === 'locationName' || k === '_reinforcedBy') return;
    // 2026-09-17 belt-and-braces: hpEarned only ever RISES. A copy made before the fight carries
    // a stale snapshot, so a blind write-back could roll a hardening won during the fight back
    // off the real character. Take the larger of the two and the rollback becomes impossible,
    // whatever future code path forgets to mirror it.
    if (k === 'hpEarned') {
      real.hpEarned = Math.max(real.hpEarned || 0, copy.hpEarned || 0);
      return;
    }
    // 2026-09-23c: the copy's item list is authoritative (items spent in the fight) EXCEPT for loot
    // handed to the real character during the fight (handleHeroDeath), which the copy may not hold.
    if (k === 'items') {
      const _cp = Array.isArray(copy.items) ? copy.items : [];
      const _loot = (Array.isArray(real.items) ? real.items : []).filter(
        (it) => it && _KC_LOOT_GAINED.has(it) && !_cp.includes(it),
      );
      real.items = _loot.length ? _cp.concat(_loot) : _cp;
      return;
    }
    real[k] = copy[k];
  });
  syncMaxHp(real, G.players); // keep maxHp in step with whatever the write-back landed on
}
// The line the Chronicle prints when command changes hands.
function commandHandoverLine(leader, deflt, provName) {
  return `\u{1F396} ${leader.name} takes command of the combined host at ${provName} \u2014 the most seasoned captain on the field, and ${deflt.name}'s troops fall in behind him.`;
}

function armyTotalStr(turnContext, ch, prov) {
  const { G } = turnContext;
  return (ch.armies || []).reduce(
    (s, a) => s + armStr(turnContext, a, ch, G.players[ch.player]?.alignment, prov.terrain),
    0,
  );
}
