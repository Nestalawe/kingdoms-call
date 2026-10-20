import { kcRng } from '../rng.js';
import { COMBAT_ONLY_TACTICS, SKILL_LABELS } from '../army-tables.js';
import { homeFounderOf, homeProvinceIdFor } from '../grand-design.js';
import { _escapesTheEnd, _garrethEscapeLine } from '../names.js';
import { GRAND_HEIST_RICH_TAX } from '../items/tiers-and-hoards.js';
import { activeItems, gainedItemNote } from '../items/equipment.js';
import { applyItemMaxHp, transferableItems } from '../personal-combat/helpers.js';
import { d100, describeArmy, dispFloor, fmtRoll, rng } from '../dice-and-army-names.js';
import { markProvinceCombat } from '../bots/intel.js';
import { TM, noteEspionage, perkTier, skillLevel } from '../titles/perks.js';
import { discParam, discSum, hasDisc } from '../discoveries.js';
import { emitNarrLine } from '../turn/log-line-helpers.js';
import { areEnemies } from '../realms/relations-and-captures.js';
import { charMinor } from '../titles/title-holders-and-battle-merit.js';
import { effStat, isVanished, oddsNote, statNote } from '../heroes/effective-skills-and-hidden-heroes.js';
import { provIsCoastal } from '../battle/terrain-and-unit-strength.js';
import {
  SKILLGAIN_COMMON,
  SKILLGAIN_STD,
  awardKillXP,
  trySkillGain,
} from '../heroes/experience-skill-rises-and-earned-hp.js';
import { applySpySuccess } from '../espionage/what-a-spy-learns.js';
import { duelStanceOf, ensureEncounterPlan } from '../personal-combat/speed-encounter-plans-and-combatants.js';
import { resolveCharVsChar } from '../personal-combat/duels-and-character-encounters.js';
import { reportHeroFall } from '../heroes/hero-death-and-leaderless-hosts.js';

// ── THE ESPIONAGE ORDERS (plan P1-08j6: the sixth family taken out of processOrder in resolveTurn) ──
// Spy (on the province he stands in, or on a hero beside him), Steal (a magic item or gold from a hero beside him, or
// the garrison's pay), Sabotage (an enemy province's coffers and one company of its garrison), Grand Heist (the vaults
// of an enemy's capital or rich country, and a parcel on its roads), Assassinate (an enemy hero beside him) and Vanish
// (nothing can bring him to bay for the rest of the turn), each once processOrder has read the order and checked he may
// act (a mastery order once a turn, never for a hero held by an enchantment). Before them, the two helpers the Spy,
// Steal and Grand Heist orders share, nested in processOrder until this row: a thief caught in the act, and an item
// lifted from a hero's pack. Each takes the turn's context first (src/engine/turn/context.js), then the values
// processOrder worked out before it that it reads, in the order processOrder declares them. Each body keeps
// processOrder's indent (plan P1-08's Decisions); a case-level break became a return.
// ── THIEF: caught in the act ────
// A thief detected mid-theft is set upon by the victim: a PERSONAL duel on both encounter plans
// (the thief is well advised to lead with FLEE), unless the victim's duel stance is REFUSE — then
// the victim lets the thief go and merely raises the alarm. A Vanished thief (Thief 9) is never
// brought to bay at all.
export function thiefCaughtScuffle(turnContext, prov, thief, victim, what) {
  const { G, log } = turnContext;
  const targetsPi = [thief.player, victim.player].filter((x) => x != null);
  if (thief._vanishTurn === G.turn) {
    log('system', `${victim.name} raises the alarm, but ${thief.name} has already melted into the shadows. (Vanish)`, {
      actor: thief.player,
      targets: targetsPi,
      provinceId: prov.id,
      charIds: [thief.id, victim.id],
    });
    return;
  }
  ensureEncounterPlan(turnContext, victim);
  if (duelStanceOf(victim) === 'refuse') {
    log(
      'system',
      `${victim.name} catches ${thief.name} ${what}, but wants no part in a brawl — the thief is driven off empty-handed.`,
      { actor: thief.player, targets: targetsPi, provinceId: prov.id, public: false, charIds: [thief.id, victim.id] },
    );
    return;
  }
  const COMBAT_ONLY = COMBAT_ONLY_TACTICS;
  const filterPlan = (plan) =>
    ((plan && plan.tactics) || ['ME']).filter(
      (t) => COMBAT_ONLY.has(String(t).split(':')[0].toUpperCase()) || String(t).toUpperCase().startsWith('CA:'),
    );
  ensureEncounterPlan(turnContext, thief);
  const atkPlan = filterPlan(thief.encounterPlan);
  if (!atkPlan.length) atkPlan.push('ME');
  const defPlan = filterPlan(victim.encounterPlan);
  if (!defPlan.length) defPlan.push('ME');
  const _duelChars = [thief.id, victim.id];
  log('combat', `⚔ ${victim.name} catches ${thief.name} ${what} — blades are drawn!`, {
    actor: thief.player,
    targets: targetsPi,
    provinceId: prov.id,
    public: true,
    charIds: _duelChars,
  });
  markProvinceCombat(prov, [thief.player, victim.player]); // purple swords: a personal combat, not a field battle
  const enc = resolveCharVsChar(
    turnContext,
    thief,
    victim,
    atkPlan,
    defPlan,
    prov,
    (...a) => effStat(turnContext, ...a),
    rng,
    G,
  );
  enc.narrative.forEach((line) =>
    emitNarrLine(turnContext, 'combat', line, {
      actor: thief.player,
      targets: targetsPi,
      provinceId: prov.id,
      charIds: _duelChars,
    }),
  );
  thief.hp = Math.max(1, enc.atkHp);
  if (victim.player !== null) victim.hp = Math.max(1, enc.defHp);
  if (enc.atkKilled || enc.atkHp <= 0) {
    if (_escapesTheEnd(thief)) {
      if (thief.hp != null && thief.hp <= 0) thief.hp = 1;
      log('combat', _garrethEscapeLine(thief), {
        actor: thief.player,
        targets: targetsPi,
        provinceId: prov.id,
        public: true,
        charIds: _duelChars,
      });
    } else {
      reportHeroFall(turnContext, thief, victim, `${thief.name} is cut down — a thief's end.`, {
        actor: thief.player,
        targets: targetsPi,
        provinceId: prov.id,
        public: true,
        charIds: _duelChars,
      });
      awardKillXP(turnContext, victim, thief);
    }
  }
  if (enc.defKilled || enc.defHp <= 0) {
    if (_escapesTheEnd(victim)) {
      if (victim.hp != null && victim.hp <= 0) victim.hp = 1;
      log('combat', _garrethEscapeLine(victim), {
        actor: thief.player,
        targets: targetsPi,
        provinceId: prov.id,
        public: true,
        charIds: _duelChars,
      });
    } else {
      reportHeroFall(turnContext, victim, thief, `${victim.name} is slain by the cornered thief!`, {
        actor: thief.player,
        targets: targetsPi,
        provinceId: prov.id,
        public: true,
        charIds: _duelChars,
      });
      awardKillXP(turnContext, thief, victim);
    }
  }
}
// Shared: lift a random magic item from a victim (null if none, or if the victim is a master
// thief).
export function liftRandomItem(turnContext, thief, victim) {
  const { G } = turnContext;
  const items = victim.items || [];
  const pool = transferableItems(items); // a granted Mithril suit cannot be lifted off its wearer
  if (!pool.length) return null;
  if (perkTier(victim, 'thief') >= 3) return { guarded: true }; // THIEF L8: a master thief's own pockets cannot be picked
  // the thief grabs what comes to hand — the pick is weighted TOWARD the lesser trinkets. Weak
  // 8: Moderate 4: Powerful 2: Legendary 1, so a hero carrying one item of each tier loses the
  // Weak one 53% of the time and the Legendary one under 7%.
  const STEAL_TIER_W = { 1: 8, 2: 4, 3: 2, 4: 1 };
  const wsum = pool.reduce((t, x) => t + (STEAL_TIER_W[x.tier || 1] || 8), 0);
  let r = kcRng() * wsum,
    it = pool[pool.length - 1];
  for (const x of pool) {
    r -= STEAL_TIER_W[x.tier || 1] || 8;
    if (r < 0) {
      it = x;
      break;
    }
  }
  items.splice(items.indexOf(it), 1);
  applyItemMaxHp(victim, it);
  thief.items = thief.items || [];
  thief.items.push(it);
  applyItemMaxHp(thief, it);
  it._stolenTurn = G.turn; // a charmed hero's automatic Send Item hands over this turn's loot first
  return it;
}
// Spy: the province he stands in (what it holds, and the realm's secrets if it is a capital), or a hero beside him (every skill, item and company); a hero spied on may catch the spy.
export function resolveSpyOrder(turnContext, c, target, prov) {
  const { G, log } = turnContext;
  const hasCrystalOrb = activeItems(c).some((it) => it.effect?.stat === 'oracle');
  // sd21 Forgery Arts: +15% spy success chance
  const targetProvForSpy = G.world.provinces[parseInt(target)];
  // spy / counterSpy discoveries — optionally scoped to the TARGET province's terrain, to coastal
  // ground or (counterSpy) to the defender's capital. sd21 / sd19 are now ordinary effects.
  const _spyProv = String(target || '').startsWith('char:') ? prov : targetProvForSpy || prov;
  const _spyScope = (e, ownerPi) =>
    (!e.terrains || (_spyProv && e.terrains.includes(_spyProv.terrain))) &&
    (!e.coastal || (_spyProv && provIsCoastal(G, _spyProv))) &&
    (!e.home || (_spyProv && ownerPi != null && homeFounderOf(G, _spyProv.id) === ownerPi));
  const spyBonus = discSum(turnContext, c.player, 'spy', 'pct', (e) => _spyScope(e, null)); // spy discoveries
  const cipherPenalty =
    targetProvForSpy && targetProvForSpy.owner !== null && targetProvForSpy.owner !== c.player
      ? discSum(turnContext, targetProvForSpy.owner, 'counterSpy', 'pct', (e) => _spyScope(e, targetProvForSpy.owner))
      : 0; // counterSpy discoveries
  // ── Item 10: SPY ON A CHARACTER ── target 'char:<id>' names a non-own character standing
  // in the same province. Success 25% +10%/Spy level (Master Spy / Crystal Orb: automatic)
  // reveals every skill level, every magic item and every army unit they lead. Success or
  // not, the spy may be CAUGHT: 20% +10%/target Spy −10%/own Spy, +15% in the target realm's
  // own land,
  // −15% in this realm's own land (clamped 5–95; The Shadow is never caught). Caught → a personal
  // combat, unless the target's Encounter Plan stance is Refuse (same scuffle as a caught
  // thief).
  if (String(target || '').startsWith('char:')) {
    const _tid = String(target).slice(5);
    const _tgt = (G.characters || []).find((x) => x && String(x.id) === _tid && x.alive);
    if (!_tgt || _tgt.location !== c.location || _tgt.player === c.player) {
      log(
        'system',
        `${c.name} looks for ${_tgt ? _tgt.name : 'their quarry'} in ${prov.name}, but they are not to be found here — the spying comes to nothing.`,
        { actor: c.player, targets: [c.player], provinceId: prov.id },
      );
      return;
    }
    if (activeItems(_tgt).some((it) => it && it.effect && it.effect.stat === 'hidden')) {
      log(
        'system',
        `${c.name} shadows ${_tgt.name} through ${prov.name}, but can never quite fix on a face — nothing is learned. (Cloak of Many Faces)`,
        { actor: c.player, targets: [c.player], provinceId: prov.id },
      );
      return;
    }
    const _mySpy = effStat(turnContext, c, 'spy'),
      _tgSpy = effStat(turnContext, _tgt, 'spy');
    const _masterSpy = perkTier(c, 'spy') > 0;
    const _auto = hasCrystalOrb || _masterSpy;
    const _chance = Math.max(
      5,
      Math.min(
        95,
        dispFloor(
          (0.25 +
            0.1 * _mySpy +
            spyBonus +
            discSum(turnContext, c.player, 'spyChar', 'pct', (e) => _spyScope(e, null))) *
            100,
        ),
      ),
    ); // + spyChar discoveries (optionally scoped to where it happens)
    const _roll = d100();
    const _ok = _auto || _roll <= _chance;
    log(
      'system',
      `📊 Spy on ${_tgt.name} — ${c.name} (Spy ${_mySpy}) in ${prov.name}: ${_auto ? `automatic success (${hasCrystalOrb ? 'Crystal Orb' : 'Master Spy'})` : fmtRoll(_chance, _roll)}`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
    if (_ok) {
      TM(c).spyActions = (TM(c).spyActions || 0) + 1; // TITLE MERIT: Spymaster
      noteEspionage(G, c, prov.id, 'read one of your heroes');
      trySkillGain(turnContext, c, 'spy', SKILLGAIN_STD);
      const _ap = G.players[c.player];
      // 2026-10-15 (Toby, D2/D9): every skill, the magic items carried and the army units led, kept for
      // the report's hero sightings — for a wandering hero or a local chieftain as for a rival's hero.
      if (_ap) {
        _ap._spiedHeroSkills = _ap._spiedHeroSkills || {};
        _ap._spiedHeroSkills[_tgt.id] = {
          name: _tgt.name,
          isKing: !!_tgt.isKing,
          alignment: _tgt.alignment || null,
          race: _tgt.race || null,
          kingdom: _tgt.player != null ? G.players[_tgt.player]?.name || null : null,
          skills: { ...(_tgt.skills || {}) },
          items: (_tgt.items || []).map((it) => it && it.name).filter(Boolean),
          armies: (_tgt.armies || []).map((a) => ({ type: a.type, quality: a.quality, unitName: a.unitName || '' })),
          turn: G.turn,
        };
      }
      const _sk =
        Object.entries(_tgt.skills || {})
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `${SKILL_LABELS[k] || k} ${v}`)
          .join(', ') || 'no skills to speak of';
      const _it = (_tgt.items || []).map((it) => it.name).join(', ') || 'no magic items';
      const _ar = (_tgt.armies || []).length ? describeArmy(_tgt.armies) : 'no armies';
      log(
        'spy',
        `[Intelligence] 🔍 ${c.name}'s report on ${_tgt.name}${_tgt.player != null ? ` of ${G.players[_tgt.player]?.name}` : ''} (${_tgt.race || '?'}, ${_tgt.alignment || '?'}${_tgt.isKing ? ', king' : ''}): skills — ${_sk}. Items — ${_it}. Leads — ${_ar}.`,
        { actor: c.player, targets: [c.player], provinceId: prov.id, spy: true },
      );
    } else {
      log('system', `${c.name} watches ${_tgt.name} closely in ${prov.name}, but learns nothing of use.`, {
        actor: c.player,
        targets: [c.player],
        provinceId: prov.id,
      });
      trySkillGain(turnContext, c, 'spy', SKILLGAIN_COMMON); // batch item 11: a failed attempt is a small chance to learn
    }
    // Caught?
    if (!charMinor(turnContext, c, 'shadow')) {
      let _catch = 20 + 10 * _tgSpy - 10 * _mySpy;
      const _tgRealmLand = _tgt.player != null && prov.owner === _tgt.player,
        _myLand = prov.owner === c.player;
      if (_tgRealmLand) _catch += 15;
      if (_myLand) _catch -= 15;
      if (_tgt.player != null)
        _catch += discSum(turnContext, _tgt.player, 'catchSpy', 'pct', (e) => _spyScope(e, _tgt.player)); // catchSpy discoveries (sd63 Informer Rewards)
      _catch = Math.max(5, Math.min(95, _catch));
      const _cr = d100();
      log(
        'system',
        `📊 Detection — ${_tgt.name}${statNote(turnContext, c.player, _tgt, 'spy')} noticing ${c.name}${_tgRealmLand ? ' in their own land' : _myLand ? ' in your land' : ''}: ${oddsNote(turnContext, c.player, _tgt, _catch, _cr)}`,
        { actor: c.player, targets: [c.player], provinceId: prov.id },
      );
      if (_cr <= _catch) {
        if (_tgt.player != null)
          log(
            'system',
            `[Intelligence] ${c.name}${c.player != null ? ` (${G.players[c.player]?.name})` : ''} was caught spying on ${_tgt.name} in ${prov.name}.`,
            { actor: c.player, targets: [_tgt.player], provinceId: prov.id, charId: _tgt.id },
          );
        thiefCaughtScuffle(turnContext, prov, c, _tgt, 'spying on them');
      }
    } else
      log('system', `${c.name} slips away unseen. (The Shadow)`, {
        actor: c.player,
        targets: [c.player],
        provinceId: prov.id,
      });
    return;
  }
  // LEVEL 6+ SKILL PERK — Master Spy: at Spy 6+, espionage never fails (as the Crystal Orb).
  const masterSpy = perkTier(c, 'spy') > 0;
  // Disguise is decided fresh for EVERY spy order — the flag lives on the character record
  // and persists in the save, so leaving it set once made a spy invisible for the rest of the
  // game.
  c._spyDisguised = false;
  if (charMinor(turnContext, c, 'shadow')) c._spyDisguised = true; // MINOR TITLE — The Shadow: spies never detected
  // show the spy's success chance and the actual roll (previously neither was reported).
  const _spyChance = dispFloor((0.2 + effStat(turnContext, c, 'spy') * 0.2 + spyBonus - cipherPenalty) * 100);
  const _autoSpy = hasCrystalOrb || masterSpy;
  const _spyRoll = d100();
  const success = _autoSpy || _spyRoll <= _spyChance;
  log(
    'system',
    `📊 Spy — ${c.name} (Spy ${effStat(turnContext, c, 'spy')}) in ${prov.name}: ${_autoSpy ? `automatic success (${hasCrystalOrb ? 'Crystal Orb' : 'Master Spy'})` : fmtRoll(_spyChance, _spyRoll)}`,
    { actor: c.player, targets: [c.player], provinceId: prov.id },
  );
  // sd23 Disguise Techniques: 50% HARDER to be discovered — the counter-intelligence alert
  // that would otherwise always fire is turned aside half the time.
  if (success && !c._spyDisguised && hasDisc(turnContext, c.player, 'sd23')) {
    const _dgRoll = d100();
    const _dgPct = Math.round(discParam('sd23', 'pct', 0.5) * 100);
    if (_dgRoll <= _dgPct) c._spyDisguised = true;
    log(
      'system',
      `📊 Disguise Techniques — ${c.name} works under a false face in ${prov.name}: ${fmtRoll(_dgPct, _dgRoll)} — ${c._spyDisguised ? 'the disguise holds; no alarm is raised.' : 'the disguise slips; the province\u2019s watch will report the intrusion.'}`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
  }
  if (success) {
    TM(c).spyActions = (TM(c).spyActions || 0) + 1; // TITLE MERIT: Spymaster
    noteEspionage(G, c, prov.id, 'spied out the province');
    applySpySuccess(turnContext, c, prov);
  } else {
    log(
      'system',
      `${c.name}'s espionage in ${prov.name} yields little — the attempt went undetected but nothing useful was learned.`,
      { actor: c.player, targets: [c.player] },
    );
    trySkillGain(turnContext, c, 'spy', SKILLGAIN_COMMON);
  } // batch item 11: a failed attempt is a small chance to learn
  return;
}
// Steal: a magic item (or, failing one, gold) from a hero beside him, or the pay of a rival's garrison; a thief who fails may be caught.
export function resolveStealOrder(turnContext, c, target, prov, player) {
  const { log, G } = turnContext;
  // ── STEAL ── Needs Thief 1+. Targets: a character in the province (magic item, or 5% of
  // their realm's treasury — the player chooses via `extra`, defaulting to an item when one
  // is carried), or the province GARRISON paymaster (target 'garrison': 1g per garrison unit
  // from the owning realm). Success: 50% + 10%/Thief
  // (cap L5), halved against a commander leading troops (or the guarded paymaster). A failed attempt is
  // noticed unless the thief slips away (Thief × 20%, cap 95%); a noticed thief is brought to
  // a duel unless the victim's duel stance is REFUSE (thiefCaughtScuffle above).
  const thiefLevel = effStat(turnContext, c, 'thief');
  if (thiefLevel < 1) {
    log('system', `${c.name} has no Thief skill — light fingers take training.`, {
      actor: c.player,
      targets: [c.player],
    });
    return;
  }
  const _tgtRaw = String(target || '')
    .trim()
    .toLowerCase();
  // cap at 95%. 50 + 10×5 reached a flat 100 at Thief 5, and nothing in this engine is ever
  // certain — every other roll is clamped short of it. The halved variants (a target leading
  // troops, a guarded paymaster) floor out of this figure, so they cap at 47%.
  const stealBase = Math.min(95, 50 + 10 * Math.min(thiefLevel, 5));
  const escapeChance = Math.min(95, thiefLevel * 20); // chance to slip away unnoticed on a failure
  if (_tgtRaw === 'garrison') {
    // (e) The garrison paymaster: 1g per unit standing garrison here, from the province's owner.
    const _gN = (prov.garrisonArmies || []).length;
    if (prov.owner == null || prov.owner === c.player || _gN === 0) {
      log(
        'system',
        `${c.name} finds no enemy paymaster to rob in ${prov.name} — it needs a rival's garrison standing here.`,
        { actor: c.player, targets: [c.player], provinceId: prov.id },
      );
      return;
    }
    const ownerP = G.players[prov.owner];
    const chance = Math.floor(stealBase / 2);
    const roll = d100();
    log(
      'system',
      `📊 Steal — ${c.name} (Thief ${thiefLevel}) goes for the garrison paymaster of ${prov.name} (${_gN} unit${_gN !== 1 ? 's' : ''}, guarded — halved): ${fmtRoll(chance, roll)}`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
    if (roll <= chance) {
      noteEspionage(G, c, prov.id, 'robbed the garrison paymaster');
      const take = Math.min(ownerP.gold || 0, _gN);
      if (take > 0) {
        ownerP.gold -= take;
        player.gold = (player.gold || 0) + take;
        c.merits = (c.merits || 0) + 1;
      }
      log('hire', `💰 ${c.name} lifts ${take}g from the garrison paymaster's strongbox in ${prov.name}.`, {
        actor: c.player,
        targets: [c.player],
        provinceId: prov.id,
      });
      if (take > 0)
        log(
          'system',
          `[Intelligence] The garrison paymaster of ${prov.name} was robbed of ${take}g — ${c.name} (${G.players[c.player]?.name}) is suspected.`,
          { actor: c.player, targets: [prov.owner], provinceId: prov.id },
        );
      trySkillGain(turnContext, c, 'thief', SKILLGAIN_STD);
    } else if (kcRng() * 100 >= escapeChance) {
      const dmg = rng(1, 4);
      c.hp = Math.max(1, c.hp - dmg);
      log(
        'combat',
        `${c.name} is caught by the garrison guards of ${prov.name} and beaten back — ${dmg} damage taken.`,
        { actor: c.player, targets: [c.player], provinceId: prov.id },
      );
      log(
        'system',
        `[Intelligence] ${c.name} (${G.players[c.player]?.name}) was caught trying to rob the garrison paymaster of ${prov.name}.`,
        { actor: c.player, targets: [prov.owner], provinceId: prov.id },
      );
    } else
      log('system', `${c.name}'s attempt on the paymaster of ${prov.name} fails, but the thief slips away unnoticed.`, {
        actor: c.player,
        targets: [c.player],
        provinceId: prov.id,
      });
    if (roll > chance) trySkillGain(turnContext, c, 'thief', SKILLGAIN_COMMON); // batch item 11: a failed attempt is a small chance to learn
    return;
  }
  const targetId = parseInt(target);
  const victim = G.characters.find((ch) => ch.alive && ch.id === targetId && ch.location === c.location);
  if (!victim) {
    log('system', `${c.name} finds no suitable target to steal from in ${prov.name}.`, {
      actor: c.player,
      targets: [c.player],
    });
    return;
  }
  if (victim.player === c.player) {
    log('system', `${c.name} will not rob a comrade.`, { actor: c.player, targets: [c.player] });
    return;
  }
  if (isVanished(turnContext, victim)) {
    log('system', `${c.name} reaches for ${victim.name}'s purse and closes on nothing — the man has vanished.`, {
      actor: c.player,
      targets: [c.player],
      provinceId: prov.id,
    });
    return;
  }
  // the player never chooses the prize and is never told whether the target carries anything.
  // A magic item is lifted if one can be (random, weighted toward the weaker tiers — see
  // liftRandomItem); a target with nothing liftable is robbed of gold instead. The saved
  // `extra` ('item'/'gold') from older order forms is ignored.
  const hasItems = transferableItems(victim.items || []).length > 0;
  const wantGold = !hasItems;
  if (wantGold && victim.player == null) {
    log('system', `${c.name} finds ${victim.name} carries no purse worth the risk and no magic to lift.`, {
      actor: c.player,
      targets: [c.player],
      provinceId: prov.id,
    });
    return;
  }
  const leadsArmies = (victim.armies || []).length > 0;
  let stealChance = stealBase;
  if (leadsArmies) stealChance = Math.floor(stealChance / 2);
  const stealRoll = d100();
  log(
    'system',
    `📊 Steal — ${c.name} (Thief ${thiefLevel}) targets ${victim.name} (${wantGold ? 'gold' : 'a magic item'}): ${fmtRoll(stealChance, stealRoll)}${leadsArmies ? ' (halved — target leads armies)' : ''}`,
    { actor: c.player, targets: [c.player], provinceId: prov.id },
  );
  if (stealRoll <= stealChance) {
    noteEspionage(G, c, prov.id, wantGold ? 'picked a hero\u2019s purse' : 'lifted a magic item from a hero');
    if (wantGold) {
      const purse = G.players[victim.player]?.gold || 0;
      const take = Math.min(purse, Math.max(1, Math.floor(purse * 0.05)));
      if (purse <= 0) {
        log('system', `${c.name} picks ${victim.name}'s purse — and finds it empty.`, {
          actor: c.player,
          targets: [c.player],
          provinceId: prov.id,
        });
      } else {
        G.players[victim.player].gold -= take;
        player.gold = (player.gold || 0) + take;
        c.merits = (c.merits || 0) + 1;
        log(
          'hire',
          `💰 ${c.name} deftly lifts ${take}g from ${victim.name}'s strongbox (5% of the realm's treasury).`,
          { actor: c.player, targets: [c.player], provinceId: prov.id },
        );
        log(
          'system',
          `[Intelligence] ${c.name} (${G.players[c.player]?.name}) has stolen ${take}g from ${victim.name}!`,
          { actor: c.player, targets: [victim.player], provinceId: prov.id, charId: victim.id },
        );
      }
    } else {
      const stolen = liftRandomItem(turnContext, c, victim);
      if (stolen && stolen.guarded) {
        log(
          'system',
          `${c.name}'s fingers find nothing — ${victim.name} keeps every trinket sewn tight; a master thief cannot be robbed of their own.`,
          { actor: c.player, targets: [c.player], provinceId: prov.id },
        );
      } else {
        c.merits = (c.merits || 0) + 2;
        log('hire', `${c.name} deftly lifts the ${stolen.name} from ${victim.name}!`, {
          actor: c.player,
          targets: [c.player],
          provinceId: prov.id,
          public: false,
        });
        log('hire', gainedItemNote(c, [stolen]), {
          actor: c.player,
          targets: [c.player],
          provinceId: prov.id,
          public: false,
        }); // item 10
        if (victim.player !== null)
          log(
            'system',
            `[Intelligence] ${c.name} (${G.players[c.player]?.name}) has stolen the ${stolen.name} from ${victim.name}!`,
            { actor: c.player, targets: [victim.player], provinceId: prov.id, charId: victim.id },
          );
      }
    }
    trySkillGain(turnContext, c, 'thief', SKILLGAIN_STD);
  } else {
    const caught = kcRng() * 100 >= escapeChance;
    if (caught)
      thiefCaughtScuffle(turnContext, prov, c, victim, `with a hand in their ${wantGold ? 'strongbox' : 'pack'}`);
    else
      log('system', `${c.name}'s theft attempt on ${victim.name} fails but the thief slips away undetected.`, {
        actor: c.player,
        targets: [c.player],
      });
    trySkillGain(turnContext, c, 'thief', SKILLGAIN_COMMON); // batch item 11: a failed attempt is a small chance to learn
  }
  return;
}
// Sabotage (Spy 7): an enemy province yields no tax this turn, and one company of its garrison is put to the torch.
export function resolveSabotageOrder(turnContext, c, target) {
  const { log, G } = turnContext;
  if (skillLevel(c, 'spy') < 7) {
    log('system', `${c.name} lacks the Spy mastery (7) to attempt Sabotage.`, { actor: c.player, targets: [c.player] });
    return;
  }
  const tp = G.world.provinces[parseInt(target)];
  if (!tp || tp.owner == null || tp.owner === c.player) {
    log('system', `${c.name}: Sabotage needs a valid enemy province you have seen.`, {
      actor: c.player,
      targets: [c.player],
    });
    return;
  }
  if (!areEnemies(turnContext, c.player, tp.owner)) {
    log(
      'system',
      `${c.name}: you are not at war with the owner of ${tp.name} — Sabotage would be an act of war. Declare war first.`,
      { actor: c.player, targets: [c.player] },
    );
    return;
  }
  tp._sabotagedForTurn = G.turn;
  let disbanded = '';
  if ((tp.garrisonArmies || []).length > 0) {
    const u = tp.garrisonArmies.splice(Math.floor(kcRng() * tp.garrisonArmies.length), 1)[0];
    disbanded = u ? ` A ${u.quality || ''} ${u.type} of its garrison is put to the torch.` : '';
  }
  log('spy', `🕵 ${c.name}'s agents sabotage ${tp.name} — its coffers yield nothing this turn.${disbanded}`, {
    actor: c.player,
    targets: [c.player, tp.owner].filter((x) => x != null),
    provinceId: tp.id,
  });
  TM(c).spyActions = (TM(c).spyActions || 0) + 1; // TITLE MERIT: Spymaster
  noteEspionage(G, c, tp.id, 'worked sabotage');
  trySkillGain(turnContext, c, 'spy', SKILLGAIN_STD);
  return;
}
// Grand Heist (Thief 7): a quarter of an enemy's treasury from the vaults of its capital or rich country he stands in, and a parcel cut from its couriers.
export function resolveGrandHeistOrder(turnContext, c, ph, prov) {
  const { log, G } = turnContext;
  // ── GRAND HEIST ────
  // The TARGET is the PROVINCE the thief is standing in, not any one hero — the job is
  // breaking into a realm's vaults, and the realm robbed is whoever holds the ground.
  // • PLACE — the province must be held by a realm you are at WAR with, and be either their
  // HOME CAPITAL or RICH country (tax base ≥ GRAND_HEIST_RICH_TAX).
  // • ONCE per turn per thief — the attempt is spent whether it succeeds or fails.
  // • ODDS — 60% + 5% per Thief level past 5, HALVED if the vaults are guarded: a garrison
  // stands here, or an enemy commander of that realm is here at the head of troops.
  // • TAKE — 25% of the realm's treasury (THIEF L8 doubles it; the realm is floored at 0), plus
  // ONE magic item taken from that realm's COURIER TRAFFIC — a parcel sent by a Send Item
  // order earlier this turn and still on the road. What a hero carries in their own pack is
  // never touched by a heist; that is the Steal order's business.
  // • CAUGHT — a failed heist is noticed unless the thief slips away (Thief × 20%, cap 95%).
  // If a hero of the robbed realm is standing here they run the thief down (a duel, unless
  // their stance is Refuse); otherwise the garrison guards beat him off.
  if (skillLevel(c, 'thief') < 7) {
    log('system', `${c.name} lacks the Thief mastery (7) for a Grand Heist.`, { actor: c.player, targets: [c.player] });
    return;
  }
  if (c._grandHeistTurn === G.turn) {
    log(
      'system',
      `${c.name} has already attempted a Grand Heist this turn — one great job a season is all the nerves will bear.`,
      { actor: c.player, targets: [c.player] },
    );
    return;
  }
  const vp = prov.owner;
  if (vp == null || vp === c.player) {
    log(
      'system',
      `${c.name} looks for vaults to crack in ${prov.name}, but no rival crown holds this ground — a Grand Heist is staged in an enemy's own country.`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
    return;
  }
  if (!areEnemies(turnContext, c.player, vp)) {
    log(
      'system',
      `${c.name}: you are not at war with ${G.players[vp]?.name || 'this realm'} — a Grand Heist would be an act of war. Declare war first.`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
    return;
  }
  const _ghHome = homeProvinceIdFor(G, vp) === prov.id;
  const _ghRich = (prov.tax || 0) >= GRAND_HEIST_RICH_TAX;
  if (!_ghHome && !_ghRich) {
    log(
      'system',
      `${c.name} casts an eye over ${prov.name} and finds nothing worth the risk — a Grand Heist is staged in an enemy's home capital or in rich country (tax ${GRAND_HEIST_RICH_TAX}+; this province: ${prov.tax || 0}).`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
    return;
  }
  c._grandHeistTurn = G.turn; // the attempt is spent, win or lose
  // Who could catch him, and how well watched are the vaults?
  const _ghWardens = (G.characters || []).filter((x) => x && x.alive && x.player === vp && x.location === prov.id);
  const _ghGuarded = (prov.garrisonArmies || []).length > 0 || _ghWardens.some((x) => (x.armies || []).length > 0);
  const _hLvl = skillLevel(c, 'thief');
  let _hChance = Math.min(95, 60 + 5 * (_hLvl - 5));
  if (_ghGuarded) _hChance = Math.floor(_hChance / 2);
  const _hRoll = d100();
  log(
    'system',
    `📊 Grand Heist — ${c.name} (Thief ${_hLvl}) cracks the vaults of ${_ghHome ? 'the enemy capital of ' : 'the rich province of '}${prov.name} (${G.players[vp]?.name || 'an enemy realm'}): ${fmtRoll(_hChance, _hRoll)}${_ghGuarded ? ' (halved — the vaults are guarded)' : ''}`,
    { actor: c.player, targets: [c.player], provinceId: prov.id },
  );
  if (_hRoll <= _hChance) {
    noteEspionage(G, c, prov.id, 'cracked the vaults');
    const purse = G.players[vp]?.gold || 0;
    let take = Math.floor(purse * 0.25);
    if (perkTier(c, 'thief') >= 3) take *= 2; // THIEF L8: gold stolen doubled — the thief takes the full amount even if the realm cannot cover it (floored at 0 below)
    const parts = [];
    let _heistItem = null;
    if (take > 0) {
      G.players[vp].gold = Math.max(0, purse - take);
      G.players[c.player].gold = (G.players[c.player].gold || 0) + take;
      parts.push(`${take}g lifted from the vaults`);
    }
    // ── COURIER INTERCEPT ── one item from a parcel still on the road inside the robbed
    // realm.
    const _ghParcels = (G._itemDeliveries || []).filter((d) => {
      if (!d || !Array.isArray(d.items) || !d.items.length) return false;
      const dest = (G.characters || []).find((ch) => ch && ch.id === d.toId);
      return !!dest && dest.player === vp;
    });
    if (_ghParcels.length) {
      const _p = _ghParcels[Math.floor(kcRng() * _ghParcels.length)];
      const _it = _p.items.splice(Math.floor(kcRng() * _p.items.length), 1)[0];
      c.items = c.items || [];
      c.items.push(_it);
      applyItemMaxHp(c, _it);
      _heistItem = _it;
      parts.push(`the ${_it.name} cut from a courier's satchel on the road`);
      const _dest = (G.characters || []).find((ch) => ch && ch.id === _p.toId); // the parcel's intended recipient
      log(
        'system',
        `📦 A courier of ${G.players[vp]?.name} is waylaid on the road — ${_it.name}${_p.fromName ? `, sent by ${_p.fromName}` : ''}${_dest ? ` and bound for ${_dest.name}` : ''}, never arrives.`,
        { actor: null, targets: [vp], provinceId: prov.id, charId: _dest ? _dest.id : null, phase: ph },
      );
    } else parts.push(`though no courier of theirs was on the road to waylay`);
    c.merits = (c.merits || 0) + 2;
    const msg = parts.join(' — and ');
    log(
      'hire',
      `💰 ${c.name} pulls off a Grand Heist in ${prov.name}${msg ? ` — ${msg}!` : ', but finds little worth taking.'}`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
    if (_heistItem) {
      const _gn = gainedItemNote(c, [_heistItem]);
      if (_gn) log('hire', _gn, { actor: c.player, targets: [c.player], provinceId: prov.id });
    } // item 10
    log(
      'system',
      `[Intelligence] ${c.name} (${G.players[c.player]?.name}) staged a Grand Heist in ${prov.name}${msg ? `: ${msg}` : ''}.`,
      { actor: c.player, targets: [vp], provinceId: prov.id },
    );
    trySkillGain(turnContext, c, 'thief', SKILLGAIN_STD);
  } else {
    trySkillGain(turnContext, c, 'thief', SKILLGAIN_COMMON); // batch item 11: a failed attempt is a small chance to learn
    const caught = kcRng() * 100 >= Math.min(95, _hLvl * 20);
    if (!caught) {
      log('system', `${c.name}'s Grand Heist in ${prov.name} comes to nothing, but the thief slips away undetected.`, {
        actor: c.player,
        targets: [c.player],
        provinceId: prov.id,
      });
      return;
    }
    // A hero of the robbed realm gives chase; failing that, the guards do.
    const _ghCatcher = _ghWardens.find((x) => !x.isKing) || _ghWardens[0] || null;
    if (_ghCatcher) thiefCaughtScuffle(turnContext, prov, c, _ghCatcher, `breaking into the vaults of ${prov.name}`);
    else {
      const dmg = rng(1, 4);
      c.hp = Math.max(1, c.hp - dmg);
      log(
        'combat',
        `${c.name} is caught at the vaults of ${prov.name} and beaten back by the guards — ${dmg} damage taken.`,
        { actor: c.player, targets: [c.player], provinceId: prov.id },
      );
      log(
        'system',
        `[Intelligence] A thief — ${c.name} (${G.players[c.player]?.name}) — was driven off the vaults of ${prov.name}.`,
        { actor: c.player, targets: [vp], provinceId: prov.id },
      );
    }
  }
  return;
}
// Assassinate (Spy 9): a knife in the dark for an enemy hero beside him.
export function resolveAssassinateOrder(turnContext, c, target, prov) {
  const { log, G } = turnContext;
  if (skillLevel(c, 'spy') < 9) {
    log('system', `${c.name} lacks the Spy mastery (9) to Assassinate.`, { actor: c.player, targets: [c.player] });
    return;
  }
  const victim = G.characters.find(
    (ch) => ch.alive && ch.id === parseInt(target) && ch.location === c.location && ch.player !== c.player,
  );
  if (!victim) {
    log('system', `${c.name} finds no enemy hero to assassinate in ${prov.name} this phase.`, {
      actor: c.player,
      targets: [c.player],
    });
    return;
  }
  if (isVanished(turnContext, victim)) {
    log(
      'spy',
      `${c.name} stalks ${victim.name} through ${prov.name} and never once catches sight of them — the mark has vanished.`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
    return;
  }
  if (victim.player != null && !areEnemies(turnContext, c.player, victim.player)) {
    log(
      'system',
      `${c.name}: you are not at war with ${victim.name}'s crown — an assassination would be an act of war. Declare war first.`,
      { actor: c.player, targets: [c.player] },
    );
    return;
  }
  const chance = Math.min(80, 25 + skillLevel(c, 'spy') * 6) - (victim.isKing ? 25 : 0);
  const roll = d100();
  markProvinceCombat(prov, [c.player, victim.player]); // purple swords: knife-work counts as a personal combat
  // The roll line is the ASSASSIN'S working: it names their own Spy level and the odds, so it
  // goes to their realm alone. The victim's realm is told an attempt was made on their hero —
  // they would certainly notice a knife in the dark — but never the assassin's skill or the
  // numbers behind it. (Before 2026-09-26 both realms got the full line, handing the victim
  // the attacker's Spy level for free.)
  log(
    'spy',
    `📊 Assassination — ${c.name} (Spy ${skillLevel(c, 'spy')}) stalks ${victim.name}: ${chance}% (roll ${roll}${roll <= chance ? ' ✓' : ' ✗'})${victim.isKing ? ' (king — heavily guarded)' : ''}`,
    { actor: c.player, charIds: [c.id, victim.id].filter((v) => v != null), targets: [c.player], provinceId: prov.id },
  );
  if (victim.player != null && victim.player !== c.player)
    log(
      'spy',
      `🗡 An attempt is made on ${victim.name}'s life${victim.isKing ? ' — the royal guard close ranks' : ''}.`,
      {
        actor: victim.player,
        charIds: [victim.id].filter((v) => v != null),
        targets: [victim.player],
        provinceId: prov.id,
      },
    );
  if (roll <= chance) {
    if (_escapesTheEnd(victim)) {
      log('combat', _garrethEscapeLine(victim), {
        actor: c.player,
        targets: [c.player].filter((x) => x != null),
        provinceId: prov.id,
        public: true,
      });
    } else {
      reportHeroFall(
        turnContext,
        victim,
        c,
        `🗡 ${c.name}'s blade finds ${victim.name} in the dark — the hero is slain!`,
        {
          actor: c.player,
          targets: [c.player, victim.player].filter((x) => x != null),
          provinceId: prov.id,
          public: true,
        },
      );
      awardKillXP(turnContext, c, victim);
      c.merits = (c.merits || 0) + 2;
      TM(c).spyActions = (TM(c).spyActions || 0) + 1; // TITLE MERIT: Spymaster — only a blade that lands
      noteEspionage(G, c, prov.id, 'put a blade in one of your heroes');
    }
  } else {
    log('spy', `${c.name}'s attempt on ${victim.name} fails — the mark slips the knife.`, {
      actor: c.player,
      charIds: [c.id, victim.id].filter((v) => v != null),
      targets: [c.player, victim.player].filter((x) => x != null),
      provinceId: prov.id,
    });
  }
  trySkillGain(turnContext, c, 'spy', SKILLGAIN_STD);
  return;
}
// Vanish (Thief 9): for the rest of the turn nothing can bring him to bay or harm him.
export function resolveVanishOrder(turnContext, c, prov) {
  const { log, G } = turnContext;
  if (skillLevel(c, 'thief') < 9) {
    log('system', `${c.name} lacks the Thief mastery (9) to Vanish.`, { actor: c.player, targets: [c.player] });
    return;
  }
  c._vanishTurn = G.turn;
  log(
    'move',
    `🌫 ${c.name} melts into the shadows — for the rest of the turn nothing can bring them to bay and nothing can harm them: no pursuit, Encounter or ambush, no hostile spell, no blade, no assassin's knife.`,
    { actor: c.player, targets: [c.player], provinceId: prov.id },
  );
  trySkillGain(turnContext, c, 'thief', SKILLGAIN_STD);
  return;
}
