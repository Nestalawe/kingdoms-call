// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { armySizeBand, enemyCharVisibleTo } from '../../views/visibility.ts';
import { d100 } from '../dice-and-army-names.ts';
import { perkTier } from '../titles/perks.ts';
import { buildTurnReport } from '../../views/turn-report.ts';
import { hasDisc } from '../discoveries.ts';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { emit } from './events-and-their-audiences.ts';

// ── EVERY REALM'S REPORT, BUILT AFTER THE SAVE (plan P1-08d: lifted out of resolveTurn) ────
// buildReports rolls each hero's Spy stealth once, then builds each realm's report from the turn's log: what that
// realm saw (its own deeds, lines sent to it, and public events where it had eyes at the time), its battle markers,
// its province intelligence, its spies' lingering sight, unmet realms left nameless, and its Clairvoyance feed.
// resolveTurn hands it to the shell wrapped with the turn's context ({state, log, buildReports}); the shell calls it
// once the turn is saved. It takes the turn's context first (src/engine/turn/context.ts) and reads the values
// resolveTurn joins to it: _reports (built once a turn), presenceByPhase, clairWatch, battleCommanders and _tel.
export function buildReports(turnContext) {
  const { _reports, freshPlayers, G, turnLog, presenceByPhase, battleCommanders, clairWatch, _tel } = turnContext;
  if (_reports.built) throw new Error('buildReports() runs once a turn');
  _reports.built = true;
  const activePlayers = freshPlayers.filter((p) => p.user_id);
  // ── Spy stealth — rolled ONCE per character before any report is built, so every player's
  // report reads the same result. 5% per Spy level (capped at level 5 → 25% max). A character who
  // passes is stamped _unspottedTurn and is dropped from other players' PASSIVE sightings (map
  // markers, hero-sighting lists, presence-based province intel). A deliberate Spy still finds
  // them.
  (G.characters || []).forEach((c) => {
    if (!c || !c.alive) return;
    // an Invisibility cast this turn was stamped BEFORE the turn counter advanced (§7); re-stamp it
    // to the report's turn so every report-time visibility check (which compares against
    // gameState.turn, like _unspottedTurn) still treats the caster as unseen. Spies do not pierce
    // it.
    if (c._invisTurn === G.turn - 1) {
      c._invisTurn = G.turn;
      c._unspottedTurn = G.turn;
    }
    const _lvl = Math.min(5, effStat(turnContext, c, 'spy'));
    const _shimmer = perkTier(c, 'illusory') >= 1; // ILLUSORY L6 (Shimmer)
    if (_lvl <= 0 && !_shimmer) return;
    // Spy grants a small chance to slip away unseen (5%/level). Shimmer makes this character HALF
    // as likely to be seen at all, so the odds of passing unnoticed rise sharply.
    let _seenPct = 100 - _lvl * 5;
    if (_shimmer) _seenPct = _seenPct * 0.5;
    if (d100() > _seenPct) {
      c._unspottedTurn = G.turn;
      emit(turnContext, {
        type: 'system',
        text: `[Intelligence] 🕶 ${c.name} moved unseen this turn — ${_shimmer ? 'the Shimmer of illusory magic blurred them from watching eyes' : 'Spy ' + _lvl + ' kept them out of enemy sightings'}.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: c.id,
        phase: 0,
      });
    }
  });
  const reports = [];
  for (const gp of activePlayers) {
    const report = buildTurnReport(G, gp.player_index);
    // Build a per-player chronicle using the structured log metadata
    const pi = gp.player_index;
    const playerOwnedProvs = new Set(G.players[pi]?.provinces || []);
    const playerCharProvs = new Set(
      (G.characters || []).filter((c) => c.player === pi && c.alive).map((c) => c.location),
    );
    // Build the full set of province IDs this player can see
    const playerVisitedProvs = new Set([...playerOwnedProvs]);
    G.world.provinces.forEach((p) => {
      if ((p.visitedBy || []).includes(pi)) playerVisitedProvs.add(p.id);
    });
    (G.characters || []).filter((c) => c.player === pi && c.alive).forEach((c) => playerVisitedProvs.add(c.location));
    // sd20 Messenger Birds: receive intel from provinces 2 steps from owned provinces
    if (hasDisc(turnContext, pi, 'sd20')) {
      const offEven = [
        [-1, -1],
        [-1, 0],
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 0],
      ];
      const offOdd = [
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, 0],
        [1, 1],
      ];
      const extendReach = (id) => {
        const pv = G.world.provinces[id];
        if (!pv) return;
        const offs = pv.row % 2 === 0 ? offEven : offOdd;
        offs.forEach(([dr, dc]) => {
          const nr = pv.row + dr;
          if (nr < 0 || nr >= G.world.rows) return;
          const nc = (((pv.col + dc) % G.world.cols) + G.world.cols) % G.world.cols;
          const nb = G.world.provinces[nr * G.world.cols + nc];
          if (nb) playerVisitedProvs.add(nb.id);
        });
      };
      [...playerOwnedProvs].forEach(extendReach);
      [...playerVisitedProvs].forEach(extendReach); // second ring = 2 steps
    }

    // Build set of this player's own character IDs
    const ownCharIds = new Set((G.characters || []).filter((c) => c.player === pi).map((c) => c.id));

    // earliest phase this player spied each province this turn (spy sees battles at that phase or
    // later in the same province).
    const spyPhaseByProv = {};
    turnLog.forEach((e) => {
      if (e.actor === pi && e.spy && e.provinceId != null) {
        const ph = e.phase ?? 0;
        if (spyPhaseByProv[e.provinceId] === undefined || ph < spyPhaseByProv[e.provinceId])
          spyPhaseByProv[e.provinceId] = ph;
      }
    });
    // True if this player could witness a battle in prov at phase ph: a character present there at
    // that phase, or a spy on that province in the same phase or earlier.
    const canSeeBattle = (prov, ph) => {
      if (prov == null) return false;
      if (ph != null && presenceByPhase[ph] && presenceByPhase[ph].get(prov)?.has(pi)) return true;
      const sp = spyPhaseByProv[prov];
      if (sp !== undefined && (ph == null || sp <= ph)) return true;
      return false;
    };

    // a non-participant may witness a battle only if a character of theirs was PRESENT in the
    // province at that phase — spies/scouts no longer see battles they weren't near.
    const charPresentAt = (prov, ph) => {
      if (prov == null) return false;
      if (ph != null && presenceByPhase[ph] && presenceByPhase[ph].get(prov)?.has(pi)) return true;
      return false;
    };
    // 2026-09-27 (Toby item 6): can this realm SEE what happens in a province right now? Its own
    // ground, a character of its own standing there at that phase, or a spy on it that phase or
    // earlier. Having once walked through the province is explicitly NOT enough.
    const canSeeProvinceNow = (prov, ph) => {
      if (prov == null) return false;
      if (playerOwnedProvs.has(prov)) return true;
      return canSeeBattle(prov, ph);
    };

    const _filteredLog = turnLog.filter((e) => {
      // 0. Written for everyone EXCEPT these realms (the private half of a logSplit pair covers them)
      if (Array.isArray(e.notFor) && e.notFor.includes(pi)) return false;
      // 1. Directly targeted at this player (wages, intel notifications, spell hits etc.)
      if ((e.targets || []).includes(pi)) return true;
      // 2. This player's own character performed the action
      if (e.actor === pi) return true;
      // 4. Entry attributed to one of this player's own characters (charId or charIds match)
      if (e.charId != null && ownCharIds.has(e.charId)) return true;
      if (Array.isArray(e.charIds) && e.charIds.some((id) => ownCharIds.has(id))) return true;
      // 3. Public events. a battle the player did NOT take part in is visible ONLY as a one-line
      // result SUMMARY, and only if they had a character present in the province at the battle's
      // phase. The full blow-by-blow (battleDetail) is for participants alone. Non-combat public
      // events keep the broader "province you can see" visibility.
      // 3a. WORLD ANNOUNCEMENTS. A public entry with NO province is not
      // something that happened *somewhere* — it is something the whole world is told: a realm
      // conceding, the Reckoning being called, a claim collapsing, the crown's price falling,
      // the game being decided and its final standings.
      //
      // ROOT CAUSE of "nobody is told when a player concedes": the province test below was the
      // ONLY gate on public entries, so any public line with `provinceId: null` failed it and
      // fell through to "Everything else: hidden". Nine separate world announcements were being
      // written to the log every game and shown to nobody — the entire endgame commentary
      // included. They were public in name only.
      if (e.public && e.provinceId == null) return true;
      if (e.public && e.provinceId != null) {
        if (e.type === 'combat') {
          if (e.summary) {
            if (e.phase != null) return charPresentAt(e.provinceId, e.phase);
            return canSeeProvinceNow(e.provinceId, e.phase);
          }
          return false; // battle detail — participants only (handled by the targets/actor/charId checks above)
        }
        // 2026-09-27 (Toby item 6) — ROOT CAUSE of "another realm's Call to Arms turned up in my
        // Realm Events". A public entry carrying a province was shown to anyone in
        // `playerVisitedProvs`, which is every province the realm has EVER set foot in (plus the
        // Messenger Birds ring). So a realm that marched through Wendmeadow on turn 2 went on
        // reading every public line written there for the rest of the game — musters, rites,
        // resurrections, spell results — with no spy, no character standing there and no claim on
        // the ground. A public event in a province now needs EYES THERE at the time: the province
        // is the viewer's own, or one of their characters stood in it that phase, or they spied it
        // that phase or earlier. That is the same standard battle summaries have used since
        // 2026-09-26; memory of the MAP is unaffected (that is built separately, from visitedBy).
        return canSeeProvinceNow(e.provinceId, e.phase);
      }
      // Everything else: hidden
      return false;
    });

    // the map's crossed-swords icon marks provinces where this player WITNESSED a real battle this
    // turn — an actual battle occurred (_hadBattleThisTurn) AND the player has a visible line OF
    // THAT BATTLE (participated, or saw it from a character standing in the province).
    //
    // 2026-09-26 (Toby item 5) — ROOT CAUSE of "I can see a battle icon in a province I have never
    // set foot in". This counted EVERY entry of type 'combat' that reached the player's filtered
    // log, and 'combat' is the engine's catch-all type for far more than battle narrative: a
    // defender falling back carries the id of the province he RETREATED INTO (and is written to the
    // attacker as well), Plague / Earthquake / Flood / warded-spell lines are logged as 'combat'
    // with `env:true` on a province the caster merely reached, a hero's death notice carries
    // wherever the body lies, and so on. Any one of those on a province that separately saw an army
    // battle lit the crossed swords for a player who never witnessed the fighting — most visibly
    // one province away from their own hero.
    //
    // Only emitBattle writes actual battle narrative, and it stamps every one of its lines
    // (including the onlookers' one-line summary) with a `battleId`. That stamp is now the test, so
    // the marker can only follow a battle report the player genuinely received, and the environment
    // lines are excluded outright.
    const _visibleBattleProvs = new Set(
      _filteredLog
        .filter(
          (e) =>
            e.type === 'combat' &&
            e.battleId != null &&
            e.provinceId != null &&
            !e.env &&
            !/^\[Intel/i.test(e.text || ''),
        )
        .map((e) => e.provinceId),
    );
    // …and ground this player's own characters actually STOOD ON at some phase this turn is
    // witnessed by definition, whatever the log looks like — so a battle site can never lose its
    // marker because a path set _hadBattleThisTurn without writing a battle report.
    const _presentProvsAnyPhase = new Set();
    presenceByPhase.forEach((m) => {
      if (m)
        m.forEach((who, provId) => {
          if (who && who.has(pi)) _presentProvsAnyPhase.add(provId);
        });
    });
    (report.worldMeta?.provinces || []).forEach((pv) => {
      if (!pv) return;
      const _witnessed = _visibleBattleProvs.has(pv.id) || _presentProvsAnyPhase.has(pv.id);
      const realBattle = !!G.world.provinces[pv.id]?._hadBattleThisTurn;
      pv.hadBattle = realBattle && _witnessed;
      // the ORANGE ongoing-battle marker (battleUnresolved) was set unconditionally in
      // buildTurnReport and never visibility-gated, so a carry-on fight anywhere on the map lit up
      // for every player. Restrict it to a battle this player can actually witness, exactly like
      // the crossed-swords marker above.
      if (pv.battleUnresolved) pv.battleUnresolved = _witnessed;
    });

    // ── Province character intel (Intelligence → Province Reports) ──
    // For each province the player has visibility into (a character present at end of turn, or a
    // Spy action there this turn), list the characters they can see (own / neutral / enemy) with
    // the NUMBER of army units each leads. Actual unit types/qualities are only revealed for a
    // province this player SPIED this turn (own characters' armies are always known).
    const ownCharLocsPi = new Set(
      (G.characters || []).filter((c) => c.alive && c.player === pi).map((c) => c.location),
    );
    const provinceCharIntel = [];
    (G.world.provinces || []).forEach((p) => {
      const spied = spyPhaseByProv[p.id] !== undefined;
      const hasPresence = ownCharLocsPi.has(p.id);
      if (!hasPresence && !spied) return; // no line of sight and not spied → no intel
      const here = (G.characters || []).filter((c) => c.alive && c.location === p.id);
      // 2026-10-15 (D1): the one sight rule, as the map and the hero sightings use it (Invisibility,
      // a Spy piercing stealth, another realm's hero always seen beside yours, the wanderers' cloak).
      const _pciCtx = {
        ownedProvIds: new Set(),
        ownCharLocs: ownCharLocsPi,
        spiedThisTurn: new Set(Object.keys(spyPhaseByProv).map(Number)),
      };
      const visible = here.filter((c) => c.player === pi || enemyCharVisibleTo(G, pi, c, _pciCtx));
      if (visible.length === 0) return;
      // Only surface as an intel entry if there is a non-own character present, or the player spied
      // it.
      if (!visible.some((c) => c.player !== pi) && !spied) return;
      const _spiedSkillsPi = (G.players[pi] && G.players[pi]._spiedHeroSkills) || {};
      const characters = visible.map((c) => {
        const category = c.player === pi ? 'own' : c.player === null ? 'neutral' : 'enemy';
        const showDetail = c.player === pi || spied;
        const armies = c.armies || [];
        // for a non-own hero we've spied (now or previously), attach their known skills.
        const spyRec = c.player !== pi ? _spiedSkillsPi[c.id] : null;
        return {
          name: c.name,
          isKing: !!c.isKing,
          category,
          isNeutralGuard: !!c._isNeutralGuard,
          kingdom: c.player != null && c.player !== pi ? G.players[c.player]?.name || 'an enemy realm' : null,
          color: c.player != null ? G.players[c.player]?.color : null,
          ...(c.player === pi ? { armyCount: armies.length } : { armyBand: armySizeBand(armies.length) }), // D1: rough size for anyone not yours
          armies: showDetail
            ? armies.map((a) => ({ type: a.type, quality: a.quality, unitName: a.unitName || '' }))
            : null,
          spiedSkills: spyRec ? spyRec.skills : null,
          spiedTurn: spyRec ? spyRec.turn : null,
        };
      });
      provinceCharIntel.push({ provId: p.id, provName: p.name, spied, characters });
    });
    report.provinceCharIntel = provinceCharIntel;

    // ── Spy Activity — for each province this player SPIED, what OTHER realms' characters did
    // there in the phases AFTER the spy arrived (the agent's lingering line of sight). Rebuilt from
    // the resolved turnLog: entries in the spied province, at a LATER phase, attributed to a
    // character this player does not own. Machine-format battle force markers are skipped.
    const spyActivity = [];
    Object.keys(spyPhaseByProv).forEach((pidStr) => {
      const pid = parseInt(pidStr);
      const afterPh = spyPhaseByProv[pid];
      const seen = new Set();
      const lines = [];
      turnLog.forEach((e) => {
        if (e.provinceId !== pid) return;
        if (e.phase == null || e.phase <= afterPh) return;
        if (e.charId == null || ownCharIds.has(e.charId)) return;
        if (/^\u2691FORCE\u2691/.test(e.text || '')) return; // skip ⚑FORCE⚑ battle markers
        const key = e.phase + '|' + e.text;
        if (seen.has(key)) return;
        seen.add(key);
        lines.push({ phase: e.phase, text: e.text });
      });
      if (lines.length) {
        lines.sort((a, b) => a.phase - b.phase);
        spyActivity.push({
          provId: pid,
          provName: G.world.provinces[pid]?.name || 'a distant province',
          sincePhase: afterPh + 1,
          lines,
        });
      }
    });
    report.spyActivity = spyActivity;

    // A battle line carries the attacker's (or ranking force's) charId. If that is not one of this
    // player's own characters but they DID field a commander in that battle, re-file the line under
    // their own hero so a defended/resumed battle lands in that hero's Chronicle section rather
    // than
    // in Realm Events. Non-participants (line-of-sight viewers) still get null → Realm Events.
    const _reattributeCharId = (e) => {
      if (e.charId != null && ownCharIds.has(e.charId)) return e.charId;
      // an entry naming several characters (a duel/battle names both combatants) is filed under
      // whichever one belongs to THIS viewer.
      if (Array.isArray(e.charIds)) {
        const own = e.charIds.find((id) => ownCharIds.has(id));
        if (own != null) return own;
      }
      if (e.type === 'combat' && e.provinceId != null && e.phase != null && e.phase >= 0 && e.phase <= 4) {
        const cmds = battleCommanders[e.provinceId + '@' + e.phase];
        if (cmds) {
          const own = cmds.find((id) => ownCharIds.has(id));
          if (own != null) return own;
        }
      }
      return null;
    };
    // ── UNMET REALMS STAY NAMELESS in broadcast lines (2026-09-27, Toby item 3) ──────────────────
    // A handful of announcements go to EVERY realm — a concession, the Reckoning called or broken,
    // a province claimed "for <realm>" — and they printed the realm's name to readers whose scouts
    // had never found it. For a line this realm is NOT a party to (not its actor, not addressed to
    // it), every realm it has not met is rewritten as "an unknown realm". Lines it is a party to are
    // left alone (a battle you fought names your foe — you have met them by fighting). Longest names
    // first, so "The Outriders II" is not half-replaced by "The Outriders". Once the game is over the
    // whole field is revealed, as on the Titles card. The ✉ Dispatches tab is unaffected.
    const _metHere = new Set([pi, ...((G.players[pi] || {})._encountered || [])]);
    const _unmetNames = G.gameOver
      ? []
      : (G.players || [])
          .map((pl, i) => (pl && pl.name && !_metHere.has(i) ? pl.name : null))
          .filter(Boolean)
          .filter((nm) => !(G.players || []).some((pl, i) => pl && pl.name === nm && _metHere.has(i))) // a name shared with a met realm is not a secret
          .sort((a, b) => b.length - a.length);
    const _reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const _unmetRe = _unmetNames.length
      ? new RegExp('(^|[^A-Za-z0-9])(' + _unmetNames.map(_reEsc).join('|') + ')(?![A-Za-z0-9])', 'g')
      : null;
    const _maskText = (e) => {
      if (!_unmetRe || typeof e.text !== 'string') return e.text;
      if (e.actor === pi || (e.targets || []).includes(pi)) return e.text;
      return e.text.replace(_unmetRe, (m, pre, nm, off, whole) => {
        const before = whole.slice(0, off + pre.length);
        const cap = !/[A-Za-z0-9]/.test(before) || /[.!?:—]\s*$/.test(before);
        return pre + (cap ? 'An unknown realm' : 'an unknown realm');
      });
    };
    report.lastTurnLog = _filteredLog.map((e) => ({
      // Preserve charId and phase so the player portal can group entries correctly
      type: e.type,
      text: _maskText(e),
      charId: _reattributeCharId(e),
      phase: e.phase ?? null,
      pinNotice: !!e.pinNotice, // battle-lock notice — the player portal hoists this to the top of its phase
      env: !!e.env, // routed to Province Reports, kept OUT of Chronicle / Realm Events
      ...(e.gameEnd ? { gameEnd: true } : {}), // 2026-09-28: shown at the TOP of the player report, under the Game-is-Decided banner
      ...(e.battleId != null ? { battleId: e.battleId, bTier: e.bTier } : {}), // 2026-09-23d: battle folding (player portal)
    }));
    // ── Task 7(a): CLAIRVOYANCE FEED ────
    // If this player watched an enemy character via Clairvoyance, surface everything that character
    // did (or that befell them) from the cast phase onward — filed into KINGDOM EVENTS (charId
    // null, not env), prefixed so it reads as scried intelligence. Deduped against what the player
    // already sees, and internal battle-force markers / raw roll lines are skipped.
    {
      const _watch = clairWatch[pi];
      if (_watch && _watch.charId != null) {
        const W = _watch.charId,
          F = _watch.fromPhase || 0;
        const _seenKeys = new Set(
          report.lastTurnLog.map((e) => (e.phase == null ? 'x' : e.phase) + '|' + (e.text || '')),
        );
        turnLog.forEach((e) => {
          if (e.phase == null || e.phase < F) return;
          const aboutW = e.charId === W || (Array.isArray(e.charIds) && e.charIds.includes(W));
          if (!aboutW) return;
          const t = e.text || '';
          if (t.startsWith('\u2691FORCE\u2691')) return; // internal battle-force marker
          if (t.startsWith('\u{1F4CA}')) return; // 📊 raw roll lines — too noisy for a scry feed
          const key = (e.phase == null ? 'x' : e.phase) + '|' + t;
          if (_seenKeys.has(key)) return; // already visible to this player
          _seenKeys.add(key);
          report.lastTurnLog.push({
            type: 'system',
            text: '\u{1F52E} Clairvoyance \u2014 ' + t,
            charId: null,
            phase: e.phase,
            pinNotice: false,
            env: false,
          });
        });
        // and where the watched character stands as the turn ends.
        {
          const _wc = (G.characters || []).find((x) => x && x.id === W);
          if (_wc && _wc.alive && _wc.location != null) {
            const _wp = G.world.provinces[_wc.location];
            report.lastTurnLog.push({
              type: 'system',
              text: `\u{1F52E} Clairvoyance \u2014 as the turn ends, ${_wc.name} stands in ${_wp ? _wp.name : 'parts unknown'}. They are marked on your map.`,
              charId: null,
              phase: null,
              pinNotice: false,
              env: false,
            });
          }
        }
      }
    }
    report.provinceEvents = _filteredLog
      .filter((e) => e.env)
      .map((e) => ({
        text: e.text,
        phase: e.phase ?? null,
        provinceId: e.provinceId ?? null,
        provName: e.provinceId != null && G.world.provinces[e.provinceId] ? G.world.provinces[e.provinceId].name : null,
      }));
    reports.push({ gp, report });
  }

  // Clear per-turn battle flags now that every player's report (and its hadBattle markers) is
  // built.
  G.world.provinces.forEach((p) => {
    delete p._hadBattleThisTurn;
    delete p._combatPlayersThisTurn;
  });
  return { reports, tel: { gs: G, collected: _tel } };
}
