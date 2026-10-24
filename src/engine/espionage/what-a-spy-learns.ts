// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcRng } from '../rng.ts';
import { homeProvinceIdFor } from '../grand-design.ts';
import { recordDeadHeroSighting } from '../graves.ts';
import { discoverFeat, featDiscovered } from '../sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import { d100, fmtRoll } from '../dice-and-army-names.ts';
import { TM } from '../titles/perks.ts';
import { DISC_BY_ID, discBlockedIds, discEligible } from '../discoveries.ts';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { SKILLGAIN_STD, trySkillGain } from '../heroes/experience-skill-rises-and-earned-hp.ts';
import { emit, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from '../turn/events-and-their-audiences.ts';
import { botTaxIncome } from '../bots/strategy.ts';

// ── WHAT A SPY LEARNS (plan P1-08c: lifted out of resolveTurn) ────
// Everything a successful spy learns about a province, for the Spy order and the Neutral Broker's paid intelligence
// alike. It takes the turn's context first (src/engine/turn/context.ts).
// Returns {won, narrative:[strings]} ── PAGAN: Blood Harvest ── After a battle a Pagan character
// WINS, the old gods' tithe: +BLOOD_HARVEST_PER_UNIT gold per enemy unit destroyed, claimed as
// offerings from the fallen. Called from both battle paths (combatVsNPC covers neutral guards AND
// leaderless garrisons,
// which are fought as a garrison copy through the same function).
// Everything a SUCCESSFUL spy learns about a province — shared by the Spy action and the Neutral
// Broker's paid remote intelligence (identical effect by design).
export function applySpySuccess(turnContext, c, sprov) {
  const { G } = turnContext;
  trySkillGain(turnContext, c, 'spy', SKILLGAIN_STD); // Spy: successful espionage
  const actingP = G.players[c.player];
  if (actingP) {
    actingP._spiedProvincesThisTurn = actingP._spiedProvincesThisTurn || [];
    if (!actingP._spiedProvincesThisTurn.includes(sprov.id)) actingP._spiedProvincesThisTurn.push(sprov.id);
    // 2026-10-15 (Toby, D2): a province spy shows every character there and the army units each
    // leads (the report's province intel), and the characters in the provinces around it — but no
    // hero's skills. Those take a Spy on the hero.
  }
  const defs = (sprov.neutralDefenders || []).map((d) => `${d.quality} ${d.type}`).join(', ') || 'none';
  emit(turnContext, {
    type: 'explore',
    text: `${c.name} spies on ${sprov.name}: controlled by ${sprov.owner !== null ? G.players[sprov.owner].name : 'no-one'}, tax ${sprov.tax}g, defenders: ${defs}.`,
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    spy: true,
    province: sprov.id,
  });
  // ── spying a KING's HOME (founding capital) reveals realm-wide secrets — total tax income, how
  // many heroes the crown commands, and a Spy-scaled chance to lift ONE Sage discovery
  // (the target keeps theirs; the spy gains it as if researched). Fires for the regular Spy order
  // and the Neutral Broker's remote intel alike, since both route through here.
  {
    let _homeKing = null;
    for (let _pi = 0; _pi < G.players.length; _pi++) {
      if (homeProvinceIdFor(G, _pi) === sprov.id) {
        _homeKing = _pi;
        break;
      }
    }
    if (_homeKing != null && _homeKing !== c.player) {
      const _kp = G.players[_homeKing];
      const _kIncome = botTaxIncome(G, _homeKing);
      const _kHeroes = (G.characters || []).filter((x) => x && x.alive && x.player === _homeKing && !x.isKing).length;
      emit(turnContext, {
        type: 'spy',
        text: `[Intelligence] Home-capital intelligence on ${_kp.name}: the crown draws ~${_kIncome}g in tax income each turn and commands ${_kHeroes} hero${_kHeroes === 1 ? '' : 'es'} beyond the king.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: sprov.id,
      });
      const _spyLvl = effStat(turnContext, c, 'spy');
      const _stealPct = Math.max(5, Math.min(95, 10 + _spyLvl * 10));
      const _mine = new Set((G.players[c.player]?.discoveries || []).map((d) => d.id));
      const _blkSpy = discBlockedIds(G.players[c.player]);
      const _stealable = (_kp.discoveries || []).filter(
        (d) => !_mine.has(d.id) && !_blkSpy.has(String(d.id)) && discEligible(DISC_BY_ID[d.id], G.players[c.player]),
      ); // a spy cannot carry off a race/alignment secret the realm cannot use
      if (_stealable.length > 0) {
        const _sr = d100();
        emit(turnContext, {
          type: 'spy',
          text: `[Intelligence] 📊 Discovery theft — ${c.name} (Spy ${_spyLvl}) rifling ${_kp.name}'s archives: ${fmtRoll(_stealPct, _sr)}`,
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: sprov.id,
        });
        if (_sr <= _stealPct) {
          const _disc = _stealable[Math.floor(kcRng() * _stealable.length)];
          if (!G.players[c.player].discoveries) G.players[c.player].discoveries = [];
          G.players[c.player].discoveries.push({
            id: _disc.id,
            name: _disc.name,
            category: _disc.category,
            desc: _disc.desc,
            turnDiscovered: G.turn,
          });
          try {
            TM(c).discoveries += 1;
          } catch (_e) {}
          emit(turnContext, {
            type: 'spy',
            text: `[Intelligence] 🗝 ${c.name} copies the secret of "${_disc.name}" from ${_kp.name}'s archives — your scholars now hold it as their own.`,
            audience: { actor: c.player, realms: [c.player] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            province: sprov.id,
          });
        }
      }
    }
  }
  // ── Counter-intelligence alert — the spied province's owner is warned a rival's agents were at
  // work (naming the KINGDOM, not the agent). Suppressed if the spy is disguised (The Shadow
  // minor title, or sd23 Disguise Techniques set c._spyDisguised before this call).
  if (sprov.owner != null && sprov.owner !== c.player && !c._spyDisguised) {
    const _byName = c.player != null ? G.players[c.player]?.name || 'an unknown power' : 'unknown agents';
    const _vp = G.players[sprov.owner];
    if (_vp) {
      _vp._spiedOnThisTurn = _vp._spiedOnThisTurn || [];
      _vp._spiedOnThisTurn.push({
        provId: sprov.id,
        provName: sprov.name,
        byPlayer: c.player,
        byName: _byName,
        turn: G.turn,
      });
    }
    // this alert belongs ONLY to the pried-upon owner. Passing charId:null is not enough —
    // emit's `hero ?? _logCtx.charId` would fall back to the PRYING character, and the
    // report filter (ownCharIds.has(e.charId)) would then surface it in the spy's OWN report.
    // Detach the character context for this one line so its charId truly resolves to null.
    const _savedCtxChar = turnContext._logCtx.charId;
    turnContext._logCtx.charId = null;
    emit(turnContext, {
      type: 'spy',
      text: `[Intelligence] 🕵 Counter-intelligence: your watch in ${sprov.name} caught ${_byName}'s agents prying this turn.`,
      audience: { actor: null, realms: [sprov.owner] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: sprov.id,
    });
    turnContext._logCtx.charId = _savedCtxChar;
  }
  c.merits = (c.merits || 0) + 1;
  (sprov.features || [])
    .filter((f) => !featDiscovered(f, c.player))
    .forEach((f) => {
      if (kcRng() < 0.5) discoverFeat(f, c.player);
    });
  recordDeadHeroSighting(turnContext, c.player, sprov.id);
}
