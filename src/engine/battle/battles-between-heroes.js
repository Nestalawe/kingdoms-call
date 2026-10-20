import { KC_UNIT_CLASS, PRIMAL_ARMY_DEFS_P } from '../../content/kingdoms-call-data.js';
import { kcRng } from '../rng.js';
import {
  BATTLE_MAGIC_SPELL_NAMES,
  FANATIC_CHANCE_BY_ALIGN,
  QUALITY_TIERS,
  SKILL_LABELS,
  n0,
  ownedUnitName,
} from '../army-tables.js';
import { battleMarginBand, rollUnitFates } from './fates.js';
import {
  battleDeploy,
  battleFacedClauses,
  battleFacing,
  battleGrid,
  battleGridLines,
  battleLineTotal,
  battleMovesLine,
  battleScout,
  battleScoutLine,
  battleWidthLine,
  rollBattleWidth,
} from './lines.js';
import {
  ARCHERY_MISSILE_PCT,
  UNDEAD_SKEL_HERO_FAN,
  UNDEAD_SKEL_KING_FAN,
  aAn,
  ladderFm,
  ladderLines,
} from './ladder.js';
import {
  AERIAL_TYPES,
  FLYING_TYPES,
  MONSTER_ARMIES,
  OPEN_COUNTRY,
  RUN_THEM_DOWN_PCT,
  SEA_TYPES,
  countType,
  isHalfOrMore,
  rideThemDownBonus,
  shieldFortHolds,
  tacMulted,
} from '../units/movement.js';
import {
  abilityMissileUnits,
  abilityVolleys,
  applyFlakScreen,
  archeryBlockedBy,
  eyesOfTheForestLine,
  missileDamageMult,
  missileTargetPool,
  unitBaseStrength,
} from './strength.js';
import { homeFounderOf } from '../grand-design.js';
import { battleFortune, fortuneNarrative, shuffleP } from './fortune.js';
import { recordBattleGraves } from '../graves.js';
import { isConsecrated } from '../heroes/fame-and-consecration.js';
import { activeItems, hasItemBase } from '../items/equipment.js';
import { humanXPMult } from '../units/drill-and-spoils.js';
import { d100, describeArmy, dispFloor, pick, rng } from '../dice-and-army-names.js';
import { applyWraithTouch, clearPhantomCopies, getNeighborsP, injectPhantoms } from '../world/map-helpers.js';
import { perkTier } from '../titles/perks.js';
import { SPELL_CAST_BASE, magicL8CastBonus, primalStrikeChance } from '../chances-and-lair-grades.js';
import {
  DISC_DEFOWN_CAP,
  discDeathMult,
  discFanaticApplies,
  discPromo,
  discSum,
  discoveryArmyBonus,
  hasDisc,
} from '../discoveries.js';
import { telSpell } from '../turn/log-line-helpers.js';
import {
  completeDefendWatches,
  noteBattleLoss,
  noteFieldBattle,
  recordBattleCmdrs,
} from '../turn/mercenary-ids-and-battle-records.js';
import { charMinor } from '../titles/title-holders-and-battle-merit.js';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.js';
import {
  REIGN_OF_FEAR_MULT,
  SEA_LAND_PENALTY,
  applyMissileHit,
  armStr,
  bestCurseSkill,
  curseSkillLabel,
  finishSide,
  illusoryTerrainMult,
  isAirborneAtSea,
  kinNarrative,
  ladderRow,
  provIsCoastal,
} from './terrain-and-unit-strength.js';
import {
  bestRetreat,
  getSeaCapability,
  navalSplitRetreat,
  retreatOptions,
  seaTrapLine,
} from '../units/sea-lift-stranding-and-retreats.js';
import { realCharOf } from './best-commander.js';
import { SKILLGAIN_COMMON, SKILLGAIN_STD, trySkillGain } from '../heroes/experience-skill-rises-and-earned-hp.js';
import { druidShortfallLine, forceMarker, terrainNoteList } from './battle-report-lines-and-force-markers.js';
import { consumeTerror, reignOfFearHere, spreadTerror } from './evil-terror.js';
import { pickBattleSpell } from '../magic/pre-battle-spell-choice.js';
import { bloodHarvest, ironThroneRaise } from './blood-harvest-and-iron-throne.js';
import { raidLandedHere } from './raid-the-coast-and-landing-parties.js';
import { ensureEncounterPlan } from '../personal-combat/speed-encounter-plans-and-combatants.js';
import { magicItemsLine } from '../personal-combat/duels-and-character-encounters.js';
import {
  BATTLE_ARMY_SPELLS,
  CARRYON_DEATH_CAP,
  CARRYON_DEATH_STEP,
  DEF_VERBS,
  SEA_AIRBORNE_FLYER_PENALTY,
  SEA_AIRBORNE_LAND_PENALTY,
  WIN_VERBS,
} from './battles-against-province-defenders.js';
import { preBattleDuel } from './pre-battle-duels.js';

// ── BATTLES BETWEEN TWO HEROES' HOSTS (plan P1-08h: lifted out of resolveTurn) ────
// The army battle between two commanders' hosts in one province (combatVsChar): the duel before it
// (battle/pre-battle-duels.js), the battle spells, the lines and volleys, the units' fates, the retreats and the
// battle's report lines. It takes the turn's context first (src/engine/turn/context.js). The battle against a
// province's own defenders is combatVsNPC (battle/battles-against-province-defenders.js), with the constants both read.
// Returns {won, narrative:[strings]}
export function combatVsChar(turnContext, atk, def, prov) {
  const { G, _tel } = turnContext;
  turnContext._combatSkillProv = prov && prov.id != null ? prov.id : null; // battle-series key (cleared at each loop boundary)
  // a resumed battle is another carry-on round (deadlier); a fresh clash resets the count.
  if (prov) {
    if (atk && atk._resumeBattle && !atk._openingClash) prov._carryOnRounds = (prov._carryOnRounds || 0) + 1;
    else prov._carryOnRounds = 0;
  }
  ensureEncounterPlan(turnContext, atk);
  ensureEncounterPlan(turnContext, def); // bots/NPCs get auto battle-magic + duel tactics
  // Record both sides' commanders for this province/phase BEFORE any fighting (a duel death or a
  // nested processOrder can clobber _logCtx mid-battle). atk/def are pooled copies but keep the
  // real commander's id, so the per-player report can file the battle under either player's hero.
  recordBattleCmdrs(turnContext, prov && prov.id, turnContext._logCtx && turnContext._logCtx.phase, [
    atk && atk.id,
    def && def.id,
  ]);
  const _fieldIds = noteFieldBattle(turnContext, atk, def, prov); // one battle per phase, for both sides (item 7)
  // TACTICAL L6 (10%/unit) & War Drum (20%/unit) — decide ONCE per side which units fight a tier
  // higher this battle.
  [atk, def].forEach((_ld) => {
    if (_ld && Array.isArray(_ld.armies)) {
      const _tac = perkTier(_ld, 'tactical') > 0,
        _drum = activeItems(_ld).some((it) => it && it.drumTierUp);
      _ld.armies.forEach((a) => {
        if (a) {
          a._tacUp = _tac && kcRng() < 0.1;
          a._drumUp = _drum && kcRng() < 0.2;
        }
      });
    }
  });
  const narrative = [];
  const _atkLA = !!(atk && atk._lightningAdvanceTurn === G.turn); // MARCH L9 Lightning Advance
  if (_atkLA) {
    (def.armies || []).forEach((a) => {
      if (a) a._laNoTerrain = true;
    });
    narrative.push(
      `⚡ ${atk.name}'s Lightning Advance catches ${def.name} completely unready — no terrain advantage, no pre-battle magic and no answering volley.`,
    );
  }
  applyWraithTouch(atk.armies || [], def.armies || [], narrative);
  applyWraithTouch(def.armies || [], atk.armies || [], narrative); // Wraith's Touch
  injectPhantoms(atk, realCharOf(turnContext, atk));
  injectPhantoms(def, realCharOf(turnContext, def)); // PHANTASMAL/PHANTOM HOST: spectral doubles join the fight (removed at battle end)
  // Battle-scoped psychic negations start clear each battle (set by pre-battle magic below).
  if (atk) {
    atk._druidNegated = false;
    atk._tacticalNegated = false;
    atk._tacticalHalved = false;
    atk._tacticalMult = 1;
    atk._curseHalveStat = null;
    if (atk._massConfusedTurn === G.turn) atk._tacticalNegated = true;
  }
  if (def) {
    def._druidNegated = false;
    def._tacticalNegated = false;
    def._tacticalHalved = false;
    def._tacticalMult = 1;
    def._curseHalveStat = null;
    if (def._massConfusedTurn === G.turn) def._tacticalNegated = true;
  }
  const atkArmies = atk.armies || [];
  const defArmies = def.armies || [];
  // ── TITLE MERIT casualty tally ────
  // army arrays AFTER this function returned — but every branch below ends with
  // `atk.armies=atkArmies.filter(a=>!a._died…)`, so the caller only ever saw SURVIVORS. Both
  // casualty counts were therefore always 0, tm.marshal never left 0, and computeStandings
  // requires merit > 0 to hand out the Title. The battle now reports its own losses.
  // `atkArmies`/`defArmies` keep pointing at the ORIGINAL arrays (filter returns a new one), so a
  // sweep at the end sees every _died flag; the naval branch SPLICES in place, so it tallies
  // first. Phantom copies are illusions and are never counted as real losses.
  let _mAtkLost = 0,
    _mDefLost = 0;
  const _tallyLost = () => {
    (atkArmies || []).forEach((a) => {
      if (a && a._died && !a._phantom && !a._meritTallied) {
        a._meritTallied = true;
        _mAtkLost++;
      }
    });
    (defArmies || []).forEach((a) => {
      if (a && a._died && !a._phantom && !a._meritTallied) {
        a._meritTallied = true;
        _mDefLost++;
      }
    });
  };
  let atkTact = atk._tacticalNegated
    ? 0
    : effStat(turnContext, atk, 'tactical') + (charMinor(turnContext, atk, 'strategist') ? 1 : 0);
  if (atk._curseHalveStat === 'tactical') atkTact = Math.floor(atkTact / 2); // LEVEL 6+ PERK — Grand Tactician
  let defTact = def._tacticalNegated
    ? 0
    : effStat(turnContext, def, 'tactical') + (charMinor(turnContext, def, 'strategist') ? 1 : 0);
  if (def._curseHalveStat === 'tactical') defTact = Math.floor(defTact / 2); // LEVEL 6+ PERK — Grand Tactician
  // Tactical bonus only applies in land provinces
  const isPvPSea = prov.terrain === 'sea';
  let atkTactBonus = isPvPSea ? 1 : Math.min(2.0, 1 + atkTact * 0.2); // cap ×2.0
  let defTactBonus = isPvPSea ? 1 : Math.min(2.0, 1 + defTact * 0.2); // cap ×2.0

  // frame how the battle began for PvP too — who advanced, into whose province.
  const _pvpHeldBy =
    prov.owner != null && G.players[prov.owner]
      ? `${G.players[prov.owner].name}`
      : `${G.players[def.player]?.name || def.name}`;
  if (!atk._resumeBattle)
    narrative.push(
      `➡️ ${atk.name} (${G.players[atk.player]?.name}) moves into ${prov.name}, held by ${_pvpHeldBy} — a battle is initiated.`,
    );
  narrative.push(`⚔ **Battle for ${prov.name}**`);
  {
    const _ia = magicItemsLine(atk),
      _id = magicItemsLine(def);
    if (_ia) narrative.push(_ia);
    if (_id) narrative.push(_id);
  } // item 5
  {
    const _kA = kinNarrative(atkArmies, atk, G.players[atk.player]?.race || null, `${atk.name}'s host`);
    if (_kA) narrative.push(_kA); // item 7
    const _kD = kinNarrative(defArmies, def, G.players[def.player]?.race || null, `${def.name}'s host`);
    if (_kD) narrative.push(_kD);
  }
  // each side's army strength on the ground: every per-unit modifier (terrain, kinship, Dwarven
  // Bulwark, unit abilities, Druid bond…) — before Tactical, battle lines, force-wide multipliers
  // and the dice. 2026-09-23b: now built with the SAME ctx the battle uses (it had none, so a
  // defending Dwarven host showed 32 here and fought from 48); it equals the ladder's "Units" stage
  // before any pre-battle volleys or spells land.
  // Reign of Fear (2026-10-13): read before the Terror is consumed below — an attacker whose own Terror still
  // grips this province has its Monsters at ×1.5 (an Evil realm only; armStr checks the alignment). Since
  // 2026-10-12 (Toby) it fires only when attacking: a defender never has it.
  const _fearAtk = reignOfFearHere(prov, atk.player),
    _fearDef = false;
  {
    const _dcC = provIsCoastal(G, prov);
    const _aS = Math.round(
      (atkArmies || []).reduce(
        (t, a) =>
          t +
          (a && !a._phantom
            ? armStr(turnContext, a, atk, G.players[atk.player]?.alignment, prov.terrain, {
                force: atkArmies,
                enemyForce: defArmies,
                isAttacker: true,
                amphibious: !!atk._amphibiousAssault,
                coastal: _dcC,
                reignOfFear: _fearAtk,
              })
            : 0),
        0,
      ),
    );
    const _dS = Math.round(
      (defArmies || []).reduce(
        (t, a) =>
          t +
          (a && !a._phantom
            ? armStr(turnContext, a, def, G.players[def.player]?.alignment, prov.terrain, {
                force: defArmies,
                enemyForce: atkArmies,
                isAttacker: false,
                coastal: _dcC,
                reignOfFear: _fearDef,
              })
            : 0),
        0,
      ),
    );
    narrative.push(
      forceMarker(
        turnContext,
        `${atk.name} (${G.players[atk.player]?.name})`,
        atk.player,
        'attacker',
        atkArmies,
        `attacks ${prov.name}${atkTact > 0 ? ` under Tactical ${atkTact} command` : ''} — army strength ${_aS}, with`,
      ),
    );
    narrative.push(
      forceMarker(
        turnContext,
        `${def.name} (${G.players[def.player]?.name})`,
        def.player,
        'defender',
        defArmies,
        `${DEF_VERBS[0]} ${prov.name}${defTact > 0 ? ` under Tactical ${defTact} command` : ''} — army strength ${_dS}, with`,
      ),
    );
  }
  // Evil Terror: a province terrorised on a previous turn demoralises whoever defends it now
  // (stacking).
  consumeTerror(prov, defArmies, narrative);
  for (const [_f, _h, _hn, _ar] of [
    [_fearAtk, atk, atk.name, atkArmies],
    [_fearDef, def, def.name, defArmies],
  ]) {
    if (_f && G.players[_h.player]?.alignment === 'Evil' && _ar.some((a) => a && MONSTER_ARMIES.has(a.type)))
      narrative.push(
        `💀 Reign of Fear — ${prov.name} still cowers under ${_hn}'s Terror, and the monsters of the host fight at ×${REIGN_OF_FEAR_MULT}.`,
      );
  }

  // ── DUEL BEFORE BATTLE (Adventurer Kings rules) ── A commander challenges to a duel if their
  // encounter plan contains an aggressive action (Melee/Fire Arrow/Cast offensive spell) AND no
  // Flee anywhere in the plan. To REFUSE a challenge, the FIRST tactic must be Flee. Flee
  // anywhere else means the commander fights the duel first, then flees. Any Flee in the plan
  // means they won't challenge. Flee always works but reduces that commander's troops by 25%.
  // Otherwise one commander is slain and the loser's troops are reduced by 25%. ── The challenge
  // to single combat ── Driven entirely by each commander's Duel Stance, set in the player
  // portal.
  const _duelOutcome = preBattleDuel(turnContext, atk, def, narrative);
  const atkMorale = _duelOutcome.atkMorale,
    defMorale = _duelOutcome.defMorale;
  // `||.alive===false` — see combatVsNPC: either commander may already be dead, leading a
  // leaderless host into a battle that has run over from an earlier phase.
  const atkCmdrSlain = !!_duelOutcome.atkSlain || atk.alive === false;
  const defCmdrSlain = !!_duelOutcome.defSlain || def.alive === false;
  // A commander slain in the duel takes their skills to the grave: the host fights on under the
  // senior surviving captain — demoralised (handled above), and with no Tactical, Archery, Naval,
  // Druid or spellcraft for this battle. Their surviving armies are dispersed AFTER the battle
  // (garrison / retreat / mercenaries) by the end-of-phase fallen-commander sweep.
  if (atkCmdrSlain) {
    narrative.push(
      `⚑ With ${atk.name} cut down before the lines were joined, the senior captain of the host takes command — the attack goes in regardless, though without their fallen leader's guiding hand.`,
    );
    atkTact = 0;
    atkTactBonus = 1;
    atk._druidNegated = true;
    atk._tacticalNegated = true;
  }
  if (defCmdrSlain) {
    narrative.push(
      `⚑ With ${def.name} slain before their army, a steady-handed veteran steps into command — the defence holds its ground, leaderless but unbowed.`,
    );
    defTact = 0;
    defTactBonus = 1;
    def._druidNegated = true;
    def._tacticalNegated = true;
  }

  // once a commander falls in the pre-battle duel, the rest of the report must not keep speaking
  // of "their" forces — the host now answers to the stand-in who took up the banner. These
  // display names are used everywhere below the duel; before the duel (deployment, the duel
  // itself, the death notice) the real names still stand.
  const atkName = atkCmdrSlain ? `${atk.name}'s leaderless host` : atk.name; // item 12
  const defName = defCmdrSlain ? `${def.name}'s leaderless host` : def.name; // item 12

  // No challenge issued: nobody is shamed and no duel is fought, whatever the stances were.

  // Province and defender bonuses Item 4: home ground belongs ONLY to the province's founding
  // owner — defending their own capital (×1.2, ×1.5 total with the defender's edge) or attacking
  // to win it back (×1.5).
  const _founderP = homeFounderOf(G, prov.id);
  const isHome = _founderP != null && def.player === _founderP && prov.owner === _founderP;
  const atkHomeP = _founderP != null && atk.player === _founderP && prov.owner !== _founderP;
  const atkHomeBonusP = atkHomeP ? 1.5 : 1;
  if (atkHomeP)
    narrative.push(
      `🏠 ${atkName} fights to win back ${prov.name}, the realm's own capital — home ground lends the assault ×1.5 strength.`,
    );
  let defBonus = 1.25 * (isHome ? 1.2 : 1);
  // sd03 Siege Engines (and the race `siege` discoveries rd09 / ro10) — previously sd03 was
  // honoured only in battles against neutral guards, never in realm-vs-realm battles.
  {
    let _sg = discSum(
      turnContext,
      atk.player,
      'siege',
      'delta',
      (e) => !e.withTypes || atkArmies.some((a) => a && e.withTypes.includes(a.type)),
    );
    if (_sg > 0) {
      defBonus = Math.max(1, defBonus - _sg);
      narrative.push(
        `  🏰 ${atkName}'s siegecraft wears down the defenders' fortifications (province bonus −${_sg.toFixed(2)}).`,
      );
    }
  }
  // GOOD — Righteous Defence: +10% when a Good player defends a province they own.
  if (prov.owner === def.player && G.players[def.player]?.alignment === 'Good') {
    defBonus *= 1.1;
    narrative.push(`✝ Righteous Defence — ${defName}'s host defends ground held justly (+10% defence).`);
  }
  {
    const _dOwnP =
      prov.owner != null && prov.owner === def.player
        ? Math.min(
            DISC_DEFOWN_CAP,
            discSum(
              turnContext,
              def.player,
              'defOwn',
              'pct',
              (e) => !e.home || homeFounderOf(G, prov.id) === def.player,
            ),
          )
        : 0;
    if (_dOwnP > 0) {
      defBonus *= 1 + _dOwnP;
      narrative.push(`  🛡 ${defName}'s realm holds its own ground the harder (+${dispFloor(_dOwnP * 100)}% defence).`);
    }
  } // defOwn discoveries
  if (
    isHome &&
    prov.owner === def.player &&
    activeItems(def).some((it) => it.effect && it.effect.stat === 'homeDefBonus')
  ) {
    defBonus *= 1.25;
    narrative.push(`  🛡 ${defName}'s Banner of the Realm rallies the home defense (+25%).`);
  }
  if (activeItems(atk).some((it) => it.effect && it.effect.stat === 'siegeBonus')) {
    defBonus = 1 + (defBonus - 1) * 0.5;
    narrative.push(`  🏰 ${atkName}'s siege mastery halves the defenders' fortifications.`);
  }
  if (isHome) narrative.push(`The defenders fight on home ground, gaining ×1.5 total defensive bonus.`);
  // (2026-09-23d: "📊 X leads the defense: Tactical N" retired — the deployment line and the ladder both name it.)

  // Fanaticism
  const atkFanChance = { ...FANATIC_CHANCE_BY_ALIGN };
  const defFanChance = { ...FANATIC_CHANCE_BY_ALIGN };
  const atkAlign = G.players[atk.player]?.alignment || 'Neutral';
  const defAlign = G.players[def.player]?.alignment || 'Neutral';
  // (The Wyverns' Dread, −15% to the other side's fanaticism, was retired with the unit abilities,
  // 2026-10-11: Terror From Above now bears on the enemy's strongest front unit, in battleFaceSide.)
  const _atkFanPct = Math.max(
    0,
    (atkFanChance[atkAlign] ?? 0.1) +
      discSum(turnContext, atk.player, 'fanatic', 'pct', (e) => discFanaticApplies(e, 'atk', prov.terrain, atkArmies)),
  ); // fanatic discoveries
  let _defFanPct = Math.max(
    0,
    (defFanChance[defAlign] ?? 0.1) +
      discSum(turnContext, def.player, 'fanatic', 'pct', (e) => discFanaticApplies(e, 'def', prov.terrain, defArmies)),
  );
  // DIVINE — Consecrate: defenders on consecrated ground are TWICE as likely to be seized by
  // fanatical zeal (they fight before the altars of their gods).
  const _consecratedHere =
    def.player != null && isConsecrated(G.players[def.player], prov.id) && prov.owner === def.player;
  if (_consecratedHere) {
    _defFanPct = Math.min(1, _defFanPct * 2);
  }
  const atkFanatic = kcRng() < _atkFanPct;
  const defFanatic = kcRng() < _defFanPct;
  // Skeletal armies are always fanatical ONLY when led by the Undead king in person.
  const atkSkelFanatic = atkAlign === 'Undead' && atk.isKing && atkArmies.some((a) => a._isSkeletal);
  const defSkelFanatic = defAlign === 'Undead' && def.isKing && defArmies.some((a) => a._isSkeletal);
  const atkSkelHero = atkAlign === 'Undead' && !atk.isKing && atkArmies.some((a) => a._isSkeletal);
  const defSkelHero = defAlign === 'Undead' && !def.isKing && defArmies.some((a) => a._isSkeletal);
  // Evil: Monster armies +25%. (Wild Ferocity, the Druidic ×1.25 with any Creature, retired 2026-10-13.)
  const atkEvilMonster = atkAlign === 'Evil' && atkArmies.some((a) => MONSTER_ARMIES.has(a.type));
  const defEvilMonster = defAlign === 'Evil' && defArmies.some((a) => MONSTER_ARMIES.has(a.type));
  // Strongest fervour counts (max) — the old precedence chain let a ×1.3 zeal roll mask the
  // skeletal bonus once that bonus rose above it.
  const atkFanMult = Math.max(
    1,
    atkFanatic ? 1.3 : 1,
    atkSkelFanatic ? UNDEAD_SKEL_KING_FAN : 1,
    atkEvilMonster ? 1.25 : 1,
    atkSkelHero ? UNDEAD_SKEL_HERO_FAN : 1,
  );
  const defFanMult = Math.max(
    1,
    defFanatic ? 1.3 : 1,
    defSkelFanatic ? UNDEAD_SKEL_KING_FAN : 1,
    defEvilMonster ? 1.25 : 1,
    defSkelHero ? UNDEAD_SKEL_HERO_FAN : 1,
  );
  const _pct = (m) => Math.round((m - 1) * 100);
  if (atkSkelFanatic)
    narrative.push(
      `${atkName}'s skeletal legions fight with undying fanaticism under their Undead king! (+${_pct(UNDEAD_SKEL_KING_FAN)}% strength)`,
    );
  if (defSkelFanatic)
    narrative.push(
      `${defName}'s skeletal legions fight with undying fanaticism under their Undead king! (+${_pct(UNDEAD_SKEL_KING_FAN)}% strength)`,
    );
  if (atkEvilMonster && !atkFanatic) narrative.push(`${atkName}'s monsters are driven to savage fury! (+25% strength)`);
  if (defEvilMonster && !defFanatic) narrative.push(`${defName}'s monsters are driven to savage fury! (+25% strength)`);
  if (atkSkelHero)
    narrative.push(
      `${atkName}'s skeletal legions know no fear (+${_pct(UNDEAD_SKEL_HERO_FAN)}% strength — undying fanaticism).`,
    );
  if (defSkelHero)
    narrative.push(
      `${defName}'s skeletal legions know no fear (+${_pct(UNDEAD_SKEL_HERO_FAN)}% strength — undying fanaticism).`,
    );
  if (atkFanatic && !atkSkelFanatic && !atkSkelHero)
    narrative.push(`${atkName}'s forces fight with fanatical zeal! (+30% attacking strength)`);
  if (defFanatic && !defSkelFanatic && !defSkelHero && _consecratedHere)
    narrative.push(
      `✨ On the consecrated ground of ${prov.name}, ${defName}'s defenders fight before the altars of their gods with fanatical zeal! (+30% defending strength)`,
    );
  else if (defFanatic && !defSkelFanatic && !defSkelHero)
    narrative.push(`${defName}'s forces fight with fanatical zeal! (+30% defending strength)`);

  // Terrain sets the front-line width — how many units fight in the front row (the rest form a
  // reduced-effect reserve). This is the ONE source of truth for the front width, used by BOTH
  // the narrative here and the front-line strength computation below, so they can never disagree.
  // mechanic used a fixed 3 — the "battlefront one wide vs three wide" inconsistency Toby saw.)
  let pvpFront = rollBattleWidth(prov.terrain); // 2026-10-11: rolled once per battle, shared by both sides; the scout may take one wider or narrower (battleDeploy); the report names it with the grid

  // Compute strengths — mirrors combatVsNPC with full bonuses
  const MISSILE_A = new Set(KC_UNIT_CLASS.missile);
  const atkArch = atkCmdrSlain ? 0 : effStat(turnContext, atk, 'archery');
  const atkArchBonus = 1 + atkArch * ARCHERY_MISSILE_PCT; // +5%/level (2026-09-23b) · sd07 Fire Arrows now via armStr (unitStr missile)
  const defArch = defCmdrSlain ? 0 : effStat(turnContext, def, 'archery');
  const defArchBonus = 1 + defArch * ARCHERY_MISSILE_PCT;
  let atkNav = atkCmdrSlain ? 0 : effStat(turnContext, atk, 'naval');
  if (atk._curseHalveStat === 'naval') atkNav = Math.floor(atkNav / 2);
  const atkNavBonus = 1 + atkNav * 0.2;
  let defNav = defCmdrSlain ? 0 : effStat(turnContext, def, 'naval');
  if (def._curseHalveStat === 'naval') defNav = Math.floor(defNav / 2);
  const defNavBonus = 1 + defNav * 0.2;
  const atkAlign2 = G.players[atk.player]?.alignment || 'Neutral';
  const defAlign2 = G.players[def.player]?.alignment || 'Neutral';

  const pvpTerrain = prov.terrain;
  const pvpIsLand = pvpTerrain !== 'sea';
  const _pvpCoastal = provIsCoastal(G, prov); // Sea Giants' Tidal Might
  // 2026-09-23b: pvpArmStr split into ctx + command-stage builders so the battle rows, the strength
  // ladder and the stay-or-retreat check all use ONE definition. Per unit: armStr (terrain, kin,
  // Bulwark…) × Archery (missile units) × Naval (fleets) or Tactical (land and air units — flyers
  // since 2026-09-23c; land battles only) × Illusory Terrain.
  function _pvpCtx(isAtk, force, enemy) {
    return {
      force,
      enemyForce: enemy,
      isAttacker: isAtk,
      amphibious: isAtk && !!atk._amphibiousAssault,
      coastal: _pvpCoastal,
      reignOfFear: isAtk ? _fearAtk : _fearDef,
    };
  }
  function _pvpCmd(a, isAtk) {
    const hero = isAtk ? atk : def,
      cmd = [];
    const arch = isAtk ? atkArch : defArch,
      archB = isAtk ? atkArchBonus : defArchBonus;
    if (MISSILE_A.has(a.type)) cmd.push({ key: 'arch', label: `Archery ${arch} ${ladderFm(archB)}`, m: archB });
    const isFly = FLYING_TYPES.has(a.type),
      isSea = SEA_TYPES.has(a.type);
    if (isSea) {
      const nv = isAtk ? atkNav : defNav,
        nb = isAtk ? atkNavBonus : defNavBonus;
      cmd.push({ key: 'nav', label: `Naval ${nv} ${ladderFm(nb)}`, m: nb });
    } else if (pvpIsLand) {
      const tm = tacMulted(isAtk ? atkTactBonus : defTactBonus, hero);
      cmd.push({ key: 'tac', label: `Tactical ${isAtk ? atkTact : defTact} ${ladderFm(tm)}`, m: tm });
    }
    if (isAtk ? _atkIllActiveP : _defIllActiveP)
      cmd.push({
        key: 'ill',
        label: `illusory terrain ${ladderFm(illusoryTerrainMult(a.type))}`,
        m: illusoryTerrainMult(a.type),
      });
    return cmd;
  }
  function _pvpRow(a, isAtk, force, enemy) {
    return ladderRow(
      turnContext,
      a,
      isAtk ? atk : def,
      isAtk ? atkAlign2 : defAlign2,
      pvpTerrain,
      _pvpCtx(isAtk, force, enemy),
      _pvpCmd(a, isAtk),
    );
  }

  // ════
  // PRE-BATTLE PHASE 1: MAGIC (both sides)
  // ════
  const BATTLE_MAGIC_PVP = new Set(BATTLE_MAGIC_SPELL_NAMES);

  function applyPreBattleMagic(caster, targets, narr, enemyCmdr) {
    const tactics = caster.encounterPlan?.tactics || [];
    const pick = pickBattleSpell(turnContext, tactics, caster, enemyCmdr, targets);
    if (!pick || targets.length === 0) return;
    const spellName = pick.spellName;
    const school = pick.school;
    const spellLvl = effStat(turnContext, caster, school);
    if (spellLvl < 1) return;
    const castChance = Math.min(
      95,
      SPELL_CAST_BASE +
        spellLvl * 10 +
        magicL8CastBonus(caster) +
        discSum(
          turnContext,
          caster.player,
          'cast',
          'pct',
          (e) => (!e.school || e.school === school) && (!e.ctx || e.ctx === 'battle'),
        ),
    ); // cast discoveries · 2026-09-11: base 30
    const castRoll = d100();
    telSpell(turnContext, caster, spellName, school, spellLvl, castChance, castRoll, 'battle');
    narr.push(
      `✨ **Pre-battle Magic: ${caster.name} casts ${spellName}** (${SKILL_LABELS[school] || school} ${spellLvl}) — ${castChance}% [roll ${castRoll}${castRoll <= castChance ? ' ✓' : ' ✗'}]`,
    );
    if (castRoll > castChance) {
      narr.push(`  Spell fizzles.`);
      return;
    }
    // no school gain from pre-battle magic — see resolveBattle's cast.
    if (spellName === 'Fireball') {
      if (targets.length > 0) {
        const _ember = caster && activeItems(caster).some((it) => it && it.emberTwo);
        const _fbHits = targets
          .slice()
          .sort((a, b) => unitBaseStrength(b) - unitBaseStrength(a))
          .slice(0, _ember ? 2 : 1);
        _fbHits.forEach((d) => {
          const cut = Math.max(1, Math.round(unitBaseStrength(d) * 0.5));
          d._tempStrReduction = (d._tempStrReduction || 0) + cut;
        });
        narr.push(
          `  🔥 Fireball halves the enemy's ${_fbHits.length > 1 ? 'two strongest units' : 'strongest unit'}, ${_fbHits.map((d) => d.unitName || d.type).join(' and ')}.`,
        );
      }
    } else if (spellName === 'Telekinetic Storm') {
      if (enemyCmdr) {
        if (effStat(turnContext, enemyCmdr, 'tactical') > 0 && !isPvPSea) {
          enemyCmdr._tacticalHalved = true;
          enemyCmdr._tacticalMult = 0.5;
          narr.push(
            `  🌀 Telekinetic Storm scatters ${enemyCmdr.name}'s formations — their Tactical command is cut to half effectiveness this battle.`,
          );
        } else {
          enemyCmdr._tacticalHalved = true;
          narr.push(`  🌀 Telekinetic Storm rages, but ${enemyCmdr.name} has no tactical command to disrupt here.`);
        }
      }
    } else if (spellName === 'Psychic Blast') {
      if (enemyCmdr) {
        enemyCmdr._druidNegated = true;
        narr.push(
          `  🧠 Psychic Blast severs ${enemyCmdr.name}'s bond with their beasts — their Druid skill is negated this battle.`,
        );
      }
    } else if (spellName === 'Lightning Bolt') {
      const n = Math.min(targets.length, Math.max(1, Math.min(spellLvl, 5)));
      shuffleP(targets)
        .slice(0, n)
        .forEach((d) => {
          d._tempStrReduction = (d._tempStrReduction || 0) + Math.max(1, Math.round(unitBaseStrength(d) * 0.2));
        });
      narr.push(`  ⚡ Lightning Bolt: ${n} enemy unit${n !== 1 ? 's' : ''} lose 20% strength.`);
    } else if (spellName === 'Curse') {
      if (enemyCmdr) {
        enemyCmdr._curseHalveStat = bestCurseSkill(turnContext, enemyCmdr);
        narr.push(
          `  ☠ Curse withers ${enemyCmdr.name}'s ${curseSkillLabel(enemyCmdr._curseHalveStat)} — halved for this battle.`,
        );
      }
    } else if (spellName === 'Control Undead') {
      const ui = targets
        .map((a, i) => ({ a, i }))
        .filter(
          (x) =>
            x.a._isSkeletal || x.a.race === 'Undead' || /Skelet|Bone|Wraith|Zombie|Ghoul|Lich/i.test(x.a.type || ''),
        );
      if (ui.length > 0) {
        const pick = ui[Math.floor(kcRng() * ui.length)];
        const unit = targets.splice(pick.i, 1)[0];
        caster.armies = caster.armies || [];
        caster.armies.push(unit);
        const rc = G.characters[caster.id];
        if (rc && rc !== caster) {
          rc.armies = rc.armies || [];
          rc.armies.push(unit);
        }
        narr.push(`  ☠ Control Undead turns the ${unit.unitName || unit.type} to ${caster.name}'s side!`);
      } else narr.push(`  ☠ Control Undead finds no enemy undead to turn.`);
    } else if (spellName === 'Holy Symbol') {
      const ud = targets.filter(
        (d) => d._isSkeletal || /Skelet|Bone|Wraith|Zombie|Ghoul|Lich|Undead/i.test(d.type || ''),
      );
      if (ud.length > 0) {
        ud.forEach((d) => {
          d._tempStrReduction = (d._tempStrReduction || 0) + Math.ceil(unitBaseStrength(d) * 0.25);
        });
        narr.push(`  ✝ Holy Symbol: ${ud.length} enemy undead unit${ud.length !== 1 ? 's' : ''} at 75% str.`);
      } else narr.push(`  ✝ Holy Symbol: no enemy undead to smite.`);
    } else if (spellName === 'Spiritwrack') {
      const md = targets.filter((d) => MISSILE_A.has(d.type));
      if (md.length > 0) {
        md.forEach((d) => {
          d._tempStrReduction = (d._tempStrReduction || 0) + Math.ceil(unitBaseStrength(d) * 0.5);
        });
        narr.push(`  Spiritwrack: ${md.length} enemy missile unit${md.length !== 1 ? 's' : ''} at half str.`);
      } else narr.push(`  Spiritwrack: enemy fields no missile troops.`);
    }
  }
  if (!atkCmdrSlain) applyPreBattleMagic(atk, defArmies, narrative, def);
  if (!defCmdrSlain && !_atkLA) applyPreBattleMagic(def, atkArmies, narrative, atk);

  // Army battle spells (primal/special units)
  function applyArmyBattleSpells(heroChar, myArmies, enemyArmies, narr) {
    const druLvl = heroChar._druidNegated ? 0 : effStat(turnContext, heroChar, 'druid');
    myArmies.forEach((a) => {
      let armySpells = BATTLE_ARMY_SPELLS[a.type] || [];
      const _isPrimalP = !armySpells.length && PRIMAL_ARMY_DEFS_P[a.type]?.spells;
      if (_isPrimalP) armySpells = PRIMAL_ARMY_DEFS_P[a.type].spells.filter((s) => s.dmg && s.dmg[1] > 0);
      if (!armySpells.length || !enemyArmies.length) return;
      const sp = armySpells[Math.floor(kcRng() * armySpells.length)];
      const _pvpStrikeChance = primalStrikeChance(druLvl, heroChar._druidNegated ? null : heroChar, a.type);
      const _pvpHit = kcRng() * 100 < _pvpStrikeChance;
      if (!_pvpHit && _isPrimalP)
        narr.push(
          `〰 ${a.unitName || a.type} gather for **${sp.name}**, but the moment passes — the strike never lands (${_pvpStrikeChance}% chance${druLvl > 0 ? `, Druid ${druLvl}` : ', no commanding Druid'}).`,
        );
      if (_pvpHit) {
        narr.push(`✨ ${a.unitName || a.type} — **${sp.name}**: "${sp.flavour}"`);
        if (sp.target === 'all') {
          const dmg = rng(sp.dmg[0], sp.dmg[1]);
          enemyArmies.forEach((d) => {
            d._tempStrReduction = (d._tempStrReduction || 0) + dmg;
          });
          narr.push(`  Hits all ${enemyArmies.length} enemy units: −${dmg} str.`);
        } else {
          const d = enemyArmies[Math.floor(kcRng() * enemyArmies.length)];
          const dmg = rng(sp.dmg[0], sp.dmg[1]);
          d._tempStrReduction = (d._tempStrReduction || 0) + dmg;
          narr.push(`  Hits ${d.unitName || d.type}: −${dmg} str.`);
        }
      }
    });
  }
  applyArmyBattleSpells(atk, atkArmies, defArmies, narrative);
  if (!_atkLA) applyArmyBattleSpells(def, defArmies, atkArmies, narrative);

  // ════
  // PRE-BATTLE PHASE 2: ARCHERY (both sides)
  // ════
  const MISSILE_PVP = new Set(KC_UNIT_CLASS.missile);
  function applyPreBattleArchery(heroChar, myForce, enemyArmies, myCount, narr, isAtk) {
    // ELF — Ambush: Forest Wardens defending their own woods deny the enemy an archery phase — unless
    // Eagle Riders fly with the shooters (Eyes of the Forest).
    {
      const _eyes = eyesOfTheForestLine(enemyArmies, pvpTerrain, myForce, heroChar.name);
      if (_eyes) narr.push(_eyes);
    }
    if (archeryBlockedBy(enemyArmies, pvpTerrain, myForce)) {
      narr.push(
        `🌲 ${heroChar.name}'s archers can find no target — Forest Wardens hold the thickets and the volley never comes.`,
      );
      return;
    }
    const myMissile = abilityMissileUnits(myForce, pvpTerrain);
    if (!myMissile.length || !enemyArmies.length) return;
    const archLvl = effStat(turnContext, heroChar, 'archery');
    const hasQ = hasItemBase(heroChar, 'Quiver of the Hawk');
    const _manyQ = hasItemBase(heroChar, 'Quiver of Many Arrows');
    const volleys = (hasQ ? 2 : 1) + (_manyQ ? 1 : 0);
    const _prepared = myMissile.some((a) => abilityVolleys(a, isAtk) > 1); // HUMAN — Prepared Ground: defending Longbows loose twice
    narr.push(
      `🏹 ${heroChar.name}'s archery: ${myMissile.length} unit${myMissile.length !== 1 ? 's' : ''}${hasQ ? ' (double volleys)' : ''}${_manyQ ? ' (+1 shot)' : ''}${_prepared ? ' (Prepared Ground: the Longbows loose twice)' : ''}`,
    );
    myMissile.forEach((a) => {
      for (let v = 0; v < volleys + abilityVolleys(a, isAtk) - 1; v++) {
        const pool = missileTargetPool(enemyArmies, 0, a, myForce); // winged riders first, else any random target; firer passed for Punch Through's cap; the force for Eyes of the Forest
        if (!pool.length) break;
        const t = pool[Math.floor(kcRng() * pool.length)];
        const dmgMult = missileDamageMult(a, myForce, pvpTerrain, t, isAtk);
        const hit = applyMissileHit(t, archLvl, a, { dmgMult });
        if (hit.immune)
          narr.push(
            `  ${a.unitName || a.type} → ${t.unitName || t.type}: shot glances off the ${hit.why || 'armoured hull'}.`,
          );
        else if (hit.dmg > 0)
          narr.push(
            `  ${a.unitName || a.type} → ${t.unitName || t.type}: −${hit.dmg} str${hit.isFly ? ' (×2 vs flying!)' : ''}${hit.thickHide ? ' (Thick Hide: half)' : ''}${dmgMult > 1 ? ` (${a.type} ability ×${dmgMult.toFixed(2)})` : ''}${hit.capped ? ' (softened to the limit)' : ''}.`,
          );
        else narr.push(`  ${a.unitName || a.type} → ${t.unitName || t.type}: already softened as far as arrows allow.`);
      }
    });
  }
  // DWARF — Flak Screen runs before the arrows fly.
  applyFlakScreen(atkArmies, defArmies, atk.name, narrative);
  applyFlakScreen(defArmies, atkArmies, def.name, narrative);
  applyPreBattleArchery(atk, atkArmies, defArmies, atkArmies.length, narrative, true);
  if (!_atkLA) applyPreBattleArchery(def, defArmies, atkArmies, defArmies.length, narrative, false);

  // ── PRIMAL — Breach and Swamp ── Whale Cohorts rise beneath a hull and roll it over. 25% per
  // cohort to sink one enemy fleet unit outright, before either side's strength is counted.
  function applyBreachAndSwamp(myForce, enemyForce, myName, narr) {
    const pods = (myForce || []).filter((a) => a && a.type === 'Whale Cohort');
    if (!pods.length) return;
    pods.forEach(() => {
      const hulls = (enemyForce || []).filter((a) => a && SEA_TYPES.has(a.type) && !a._died);
      if (!hulls.length) return;
      if (kcRng() >= 0.25) return;
      const t = hulls[Math.floor(kcRng() * hulls.length)];
      t._died = true;
      narr.push(
        `🌊 A ${myName} whale cohort breaches beneath the ${t.unitName || t.type} and rolls her over — she goes down with all hands before a shot is fired.`,
      );
    });
  }
  applyBreachAndSwamp(atkArmies, defArmies, atk.name, narrative);
  applyBreachAndSwamp(defArmies, atkArmies, def.name, narrative);
  // Remove anything sunk before strengths are counted.
  if (atkArmies.some((a) => a._died) || defArmies.some((a) => a._died)) {
    recordBattleGraves(
      turnContext,
      prov,
      atkArmies.filter((a) => a._died),
      atk && atk.player,
    );
    recordBattleGraves(
      turnContext,
      prov,
      defArmies.filter((a) => a._died),
      def && def.player,
    ); // Elven escape per side
    _tallyLost(); // splices in place below — count the sunk before they are gone
    for (let i = atkArmies.length - 1; i >= 0; i--) if (atkArmies[i]._died) atkArmies.splice(i, 1);
    for (let i = defArmies.length - 1; i >= 0; i--) if (defArmies[i]._died) defArmies.splice(i, 1);
    atk.armies = atkArmies;
    def.armies = defArmies;
  }

  // Terrain notes for PvP
  {
    const _ta = terrainNoteList(atkArmies, pvpTerrain),
      _td = terrainNoteList(defArmies, pvpTerrain); // 2026-09-23d: per side, one format
    if (_ta || _td)
      narrative.push(
        `📊 Terrain (${pvpTerrain}): ${[_ta ? `${atkName} — ${_ta}` : null, _td ? `${defName} — ${_td}` : null].filter(Boolean).join('; ')}`,
      );
  }
  if (
    !pvpIsLand &&
    (atkArmies.some((a) => !AERIAL_TYPES.has(a.type) && !SEA_TYPES.has(a.type)) ||
      defArmies.some((a) => !AERIAL_TYPES.has(a.type) && !SEA_TYPES.has(a.type)))
  ) {
    // 2026-09-23e: flying beasts excluded
    const _airA = isAirborneAtSea(atkArmies),
      _airD = isAirborneAtSea(defArmies);
    if (_airA || _airD)
      narrative.push(
        `⚠ ${_airA && _airD ? 'Both hosts are' : (_airA ? atkName : defName) + "'s host is"} airborne over open water: land units carried by flyers fight at ×${SEA_AIRBORNE_LAND_PENALTY}, and the flyers carrying them at ×${SEA_AIRBORNE_FLYER_PENALTY}.`,
      );
    if (
      (atkArmies.some((a) => !AERIAL_TYPES.has(a.type) && !SEA_TYPES.has(a.type)) && !_airA) ||
      (defArmies.some((a) => !AERIAL_TYPES.has(a.type) && !SEA_TYPES.has(a.type)) && !_airD)
    )
      narrative.push(`⚠ Land units fighting at sea: ×${SEA_LAND_PENALTY} strength penalty.`);
  }

  // Battle lines for PvP — front-line width (pvpFront) is declared above as the single source of
  // truth.
  const pvpAtkCt = atkArmies.length;
  const pvpDefCt = defArmies.length;

  // Illusory Terrain (per-unit): a side that did NOT cast the illusion is disoriented — each unit
  // fights as though caught in the worst terrain for its kind (min −15%), folded into its
  // strength.
  const _illCasterP = prov._illusoryTerrain ? prov._illusoryTerrain.caster : null;
  const _atkIllActiveP = _illCasterP != null && atk.player !== _illCasterP;
  const _defIllActiveP = _illCasterP != null && def.player !== _illCasterP;
  // PvP battle lines: sort by strength desc (flying first), strongest in front row. 2026-09-11:
  // each side's OWN Flanking Tactics.
  const atkFlankPvp = hasDisc(turnContext, atk.player, 'sd09'),
    defFlankPvp = hasDisc(turnContext, def.player, 'sd09');
  const atkSorted = [...atkArmies]
    .map((a) => _pvpRow(a, true, atkArmies, defArmies))
    .sort((x, y) => y.fly - x.fly || y.s - x.s);
  const defSorted = [...defArmies]
    .map((a) => _pvpRow(a, false, defArmies, atkArmies))
    .sort((x, y) => y.fly - x.fly || y.s - x.s);
  // Ground units fill four terrain-width lines (×1 / ×0.5 / ×0.25 / ×0.125); flyers always front.
  // `s` is the final per-unit strength — renamed into `base` once, so the totals AND the
  // narrative sort on the same figure.
  const atkRows = atkSorted.map((x) => ({ ...x, base: x.s })),
    defRows = defSorted.map((x) => ({ ...x, base: x.s }));
  const atkRaw = battleLineTotal(atkRows, pvpFront, atkFlankPvp); // undamaged, before whole-force (2026-09-24)
  const defRaw = battleLineTotal(defRows, pvpFront, defFlankPvp);

  // (2026-09-23d: the standalone Archery / Naval notes are retired — the Battle-stats ladder names
  // "Archery N ×m on K units" and "Naval N ×m on K units" exactly where they apply.)

  // Druid shortfall warnings — only when a penalty actually applies (skeletal/exempt units are
  // free)
  // 2026-09-23d: one line per side (was one per unit).
  {
    const _dl = druidShortfallLine(turnContext, atkName, atk, atkArmies, atkAlign2);
    if (_dl) narrative.push(_dl);
    const _dd = druidShortfallLine(turnContext, defName, def, defArmies, defAlign2);
    if (_dd) narrative.push(_dd);
  }

  // Discovery bonus
  const atkDiscBonus = 1 + discoveryArmyBonus(atk.player);
  const defDiscBonus = 1 + discoveryArmyBonus(def.player);
  if (atkDiscBonus > 1)
    narrative.push(`${atkName}'s realm discoveries: +${((atkDiscBonus - 1) * 100).toFixed(0)}% army str.`);
  if (defDiscBonus > 1)
    narrative.push(`${defName}'s realm discoveries: +${((defDiscBonus - 1) * 100).toFixed(0)}% army str.`);

  // (Illusory Terrain is applied per-unit above, folded into each side's strength.)
  if (_atkIllActiveP)
    narrative.push(
      `  🌫 The ever-shifting illusory ground of ${prov.name} throws ${atkName}'s forces into confusion — every unit fights as though mired in the worst terrain for its kind (at least −15% strength).`,
    );
  if (_defIllActiveP)
    narrative.push(
      `  🌫 The ever-shifting illusory ground of ${prov.name} throws ${defName}'s forces into confusion — every unit fights as though mired in the worst terrain for its kind (at least −15% strength).`,
    );
  // WHITE L7 — Sanctuary: enemies of the warding caster fight at −25% in the warded province this
  // turn.
  const _sanctBy = prov && prov._sanctuaryTurn === G.turn ? prov._sanctuaryBy : null;
  const atkSanct = _sanctBy != null && atk.player !== _sanctBy ? 0.75 : 1;
  const defSanct = _sanctBy != null && def.player !== _sanctBy ? 0.75 : 1;
  if (atkSanct < 1)
    narrative.push(`  ✨ The sanctuary wards of ${prov.name} sap ${atkName}'s attackers (−25% strength).`);
  if (defSanct < 1)
    narrative.push(`  ✨ The sanctuary wards of ${prov.name} sap ${defName}'s attackers (−25% strength).`);
  // ── L7/L9 MASTERY ORDER battle modifiers (turn-stamped flags set in the action phase) ──
  let atkOrd = 1,
    defOrd = 1;
  if (atk._grandStratagemTurn === G.turn) {
    atkOrd *= 1.2;
    narrative.push(`  📜 ${atkName} unfolds a Grand Stratagem — the attack lands at +20% strength.`);
  }
  if (def._grandStratagemTurn === G.turn) {
    defOrd *= 1.2;
    narrative.push(`  📜 ${defName} unfolds a Grand Stratagem — the defence holds at +20% strength.`);
  }
  if (def._feignedRetreatTurn === G.turn) {
    defOrd *= 1.25;
    narrative.push(`  🏳 ${defName}'s Feigned Retreat springs shut — the counter-attack strikes at +25% strength.`);
  }
  if (raidLandedHere(turnContext, atk, prov)) {
    atkOrd *= 1.25;
    narrative.push(`  ⚓ ${atkName} storms ashore in a Raid the Coast — the amphibious assault hits at +25% strength.`);
  } // 2026-09-23e: only a coast attacked from the sea
  // DIVINE — Consecrate: Undead and Evil hosts sicken on hallowed ground (−15% attacking a
  // consecrated province).
  const _consecPenalty = _consecratedHere && (atkAlign === 'Undead' || atkAlign === 'Evil') ? 0.85 : 1;
  if (_consecPenalty < 1)
    narrative.push(
      `✨ The ground of ${prov.name} is consecrated — ${atkName}'s ${atkAlign.toLowerCase()} host falters on hallowed earth (−15% strength).`,
    );
  // Post-multiplier base strengths — every battle-level multiplier folded in, BEFORE the dice.
  // BUG FIX: the defender's Tactical bonus was applied TWICE — once per-unit inside pvpArmStr
  // (already folded into defRaw, exactly like the attacker's) and AGAIN as an explicit
  // ×defTactBonus here. The attacker only gets it once (no ×atkTactBonus below), so this
  // over-strengthened every PvP land defender with Tactical skill (×1.44 at Tac 2 up to ×4.0 at
  // Tac 5). defRaw already carries it; drop the duplicate so both sides are symmetric.
  void atkRaw;
  void defRaw;
  // 2026-09-24 (Toby): whole-force multipliers per unit BEFORE pre-battle damage (finishSide). These
  // lists are the single source of each side's force product — the ladder prints them as they are.
  const _pAtkFM = [
    { label: 'fanaticism', m: atkFanMult },
    { label: 'discoveries', m: atkDiscBonus },
    { label: 'duel morale', m: atkMorale },
    { label: 'consecrated ground', m: _consecPenalty },
    { label: 'sanctuary wards', m: atkSanct },
    { label: 'orders', m: atkOrd },
    { label: 'home ground', m: atkHomeBonusP },
  ];
  const _pDefFM = [
    { label: 'fanaticism', m: defFanMult },
    { label: "defender's position", m: defBonus },
    { label: 'duel morale', m: defMorale },
    { label: 'discoveries', m: defDiscBonus },
    { label: 'sanctuary wards', m: defSanct },
    { label: 'orders', m: defOrd },
  ];
  const _gA = {},
    _gD = {};
  finishSide(atkRows, pvpFront, atkFlankPvp, _pAtkFM, {
    terrain: pvpTerrain,
    tac: atkTact,
    enemy: defRows,
    enemyTac: defTact,
    out: _gA,
  });
  finishSide(defRows, pvpFront, defFlankPvp, _pDefFM, {
    terrain: pvpTerrain,
    tac: defTact,
    enemy: atkRows,
    enemyTac: atkTact,
    out: _gD,
  });
  // 2026-10-11 Battle lines III: the better-explored side picks the width and lines up second; the
  // commanders then shift their lines, one swap per Tactical level (a defender without a realm, a
  // wanderer on its own ground, knows it fully). finishSide's grids are replaced by the deploy's.
  const _explA = (prov.exploredBy || {})[atk.player] || 0,
    _explD = def.player == null ? 100 : (prov.exploredBy || {})[def.player] || 0;
  const _dep = battleDeploy(atkRows, defRows, {
    terrain: pvpTerrain,
    roll: pvpFront,
    tacA: atkTact,
    tacD: defTact,
    flankA: atkFlankPvp,
    flankD: defFlankPvp,
    scout: battleScout(_explA, _explD),
  });
  _gA.grid = _dep.gA;
  _gD.grid = _dep.gD;
  pvpFront = _dep.W;
  // Who each company fought, for the fate lines (2026-10-12, Toby): read now, while the rows carry the deploy's facing.
  const _facedA = battleFacedClauses(_dep.gA, String(def.name || defName || '').replace(' (wandering)', '')),
    _facedD = battleFacedClauses(_dep.gD, String(atk.name || atkName || '').replace(' (wandering)', '')); // the commanders' plain names, not "X's leaderless host"
  const atkBaseStr = _gA.grid.face.total,
    defBaseStr = _gD.grid.face.total;
  narrative.push(battleWidthLine(pvpTerrain, pvpFront));
  narrative.push(battleScoutLine(_dep, atkName, defName, _explA, _explD));
  {
    const _mv = battleMovesLine(_dep, atkName, defName);
    if (_mv) narrative.push(_mv);
  }
  narrative.push(...battleGridLines(defName, _gD.grid, true), ...battleGridLines(atkName, _gA.grid, false));
  // Dice basis unified with the NPC path: each side rolls 0 to 70% of the stronger side's
  // POST-multiplier strength, so luck scales with what the armies are actually worth in battle.
  // Item 9: fortune of battle — one swing, applied as a pair of luck multipliers (see
  // battleFortune).
  const _fortP = battleFortune();
  const atkDice = _fortP.atk,
    defDice = _fortP.def;
  const atkStr = atkBaseStr * atkDice;
  const defStr = defBaseStr * defDice;
  // Phantasmal Armies lasts only until the end of the next battle the hero is in — clear it now.
  [atk, def].forEach((x) => {
    if (!x) return;
    const rx = G.characters[x.id];
    if (rx) delete rx._phantasmalBonus;
    delete x._phantasmalBonus;
  });

  // ── STAT BLOCK ── 2026-09-23b: a three-stage strength LADDER per side (see ladderLines) replaces
  // the old "(incl. …)" list, which omitted every per-unit modifier (Dwarven Bulwark, kinship,
  // terrain, the Druid creature bond, arrows) and listed Tactical as army-wide though flyers and
  // fleets never get it. The Whole-force list below MUST mirror atkBaseStr / defBaseStr above —
  // the harness asserts lineTotal × Π(m) === baseStr for both sides.
  narrative.push(`📊 **Battle stats:**`);
  narrative.push(
    ...ladderLines('Attacker', atkName, atkRows, pvpFront, atkFlankPvp, _pAtkFM, atkBaseStr, {
      grid: _gA.grid,
      tact:
        pvpIsLand && atkTactBonus > 1
          ? {
              mult: tacMulted(atkTactBonus, atk),
              label: `Tactical ${atkTact} ${ladderFm(tacMulted(atkTactBonus, atk))}`,
            }
          : null,
    }),
  );
  narrative.push(
    ...ladderLines('Defender', defName, defRows, pvpFront, defFlankPvp, _pDefFM, defBaseStr, {
      grid: _gD.grid,
      tact:
        pvpIsLand && defTactBonus > 1
          ? {
              mult: tacMulted(defTactBonus, def),
              label: `Tactical ${defTact} ${ladderFm(tacMulted(defTactBonus, def))}`,
            }
          : null,
    }),
  );
  narrative.push(`  ${fortuneNarrative(atkName, defName, atkBaseStr, defBaseStr, _fortP)}`);

  const won = atkStr >= defStr;
  // ORC — Raiders' Muster (2026-10-11, Toby): an orcish province that sees an orc win this turn gains a
  // Goblin Horde at turn's end (the end-of-turn pass reads the flag).
  {
    const _wp = won ? atk.player : def.player;
    if (prov.race === 'Orcish' && _wp != null && G.players[_wp] && G.players[_wp].race === 'Orcish')
      prov._raidersMuster = G.turn;
  }
  // Tactical gain deferred to the end of the battle narrative — see the return below.
  const _rollTacticalGainPvP = prov.terrain !== 'sea';
  const _rollNavalGainPvP = prov.terrain === 'sea'; // sea-battle winner trains Naval (mirrors Tactical on land)
  const _rollDruidGainPvP = [...atkArmies, ...defArmies].some((a) => a && PRIMAL_ARMY_DEFS_P[a.type]); // primal (Creature/Monster) units on EITHER side: both commanders may train Druid — winner full, loser half (2026-09-21)
  const margin = Math.abs(atkStr - defStr);
  const totalStrPvP = Math.max(1, atkStr + defStr);
  const margRatioPvP = margin / totalStrPvP;
  const _bandPvP = battleMarginBand(margRatioPvP);
  const isNarrowPvP = _bandPvP.max <= 0.1;
  const isDecisivePvP = _bandPvP.max > 0.3;
  const severity = _bandPvP.label;
  narrative.push(
    `📊 Outcome: **${won ? atk.name : def.name} wins** — ${severity} (margin ${(margRatioPvP * 100).toFixed(0)}% of combined strength after fortune)`,
  );
  // Evil: a decisive victory by an Evil commander terrorises the battle province and all adjacent
  // provinces (stacking).
  const _pvpWinner = won ? atk : def;
  if (
    isDecisivePvP &&
    G.players[_pvpWinner.player]?.alignment === 'Evil' &&
    (_pvpWinner.encounterPlan?.evilMode || 'terror') === 'terror'
  ) {
    spreadTerror(turnContext, prov, _pvpWinner.player, narrative);
  }

  const closenessRatioPvP = Math.min(atkStr, defStr) / Math.max(atkStr, defStr);
  const tiers = QUALITY_TIERS.slice();
  const xpMultPvP = [1.5, 1.0, 0.6, 0.3, 0];
  function xpChancePvP(base, quality) {
    return base * (xpMultPvP[tiers.indexOf(quality)] ?? 0);
  }

  // Margin-based chances
  const _carryMultPvP = Math.min(CARRYON_DEATH_CAP, 1 + CARRYON_DEATH_STEP * (prov._carryOnRounds || 0)); // item 3
  const winDeathPvP = _bandPvP.winDeath * _carryMultPvP;
  const loseDeathPvP = _bandPvP.loseDeath * _carryMultPvP;
  const winXPPvP = _bandPvP.winXP;
  const loseXPPvP = _bandPvP.loseXP;
  const loseDemotePvP = _bandPvP.loseDemote;
  const atkSteelMultOf = (a) => discDeathMult(turnContext, atk.player, a, 'atk'); // per-unit deathRed discoveries (sd05 now one of them)
  const defSteelMultOf = (a) => discDeathMult(turnContext, def.player, a, 'def');
  const atkTacMult = perkTier(atk, 'tactical') >= 3 ? 0.5 : 1; // TACTICAL L8: on a LOSS, atk's units half as likely to die/disband
  const defTacMult = perkTier(def, 'tactical') >= 3 ? 0.5 : 1;
  // ── UNIT ABILITIES: casualty & retreat ── HUMAN — Ride Them Down: light horse are murder on a
  // broken enemy. +6pp per Free Lances unit in the WINNING force to each losing unit's
  // destruction roll, capped +18pp.
  const _rideAtk = rideThemDownBonus(atkArmies, pvpTerrain, atk);
  const _rideDef = rideThemDownBonus(defArmies, pvpTerrain, def);
  if (_rideAtk > 0 && !OPEN_COUNTRY.has(pvpTerrain))
    narrative.push(
      `📯 ${atkName}'s War-Horn of the Plains sounds — the Free Lances ride the broken enemy down even in ${pvpTerrain} country.`,
    );
  if (_rideDef > 0 && !OPEN_COUNTRY.has(pvpTerrain))
    narrative.push(
      `📯 ${defName}'s War-Horn of the Plains sounds — the Free Lances ride the broken enemy down even in ${pvpTerrain} country.`,
    );
  if (_rideAtk === 0 && countType(atkArmies, 'Free Lances') > 0)
    narrative.push(
      `🐎 ${atkName}'s Free Lances find no room to ride in ${pvpTerrain} country — the broken enemy scatters into cover.`,
    );
  if (_rideDef === 0 && countType(defArmies, 'Free Lances') > 0)
    narrative.push(
      `🐎 ${defName}'s Free Lances find no room to ride in ${pvpTerrain} country — the broken enemy scatters into cover.`,
    );
  // HUMAN — Cut the Line: a corsair-heavy victor leaves no line of retreat by sea.
  const _cutAtk = isHalfOrMore(atkArmies, 'Corsair Fleet');
  const _cutDef = isHalfOrMore(defArmies, 'Corsair Fleet');
  // DWARF — Shield Fort (replaces Hold the Line): a Guard-heavy force never routs — it conducts a
  // FIGHTING WITHDRAWAL behind locked shields. Retreat path available: it withdraws in good order
  // (immune to Ride Them Down and to demotion-in-retreat). Trapped: it holds its ground contested
  // WITHOUT the no-escape extra casualties. The old unconditional pin is gone — a beaten Guard
  // force no longer chains itself to a lost field.
  const _sfAtk = shieldFortHolds(atkArmies, _dep && _dep.gA); // 2026-10-11 (Toby): half the FRONT LINE is Guard, a Dwarf Garrison counting
  const _sfDef = shieldFortHolds(defArmies, _dep && _dep.gD);
  // ORC — Run Them Down (2026-10-09, Toby item 7): a warg-heavy victor runs the beaten army down ON
  // THE FIELD. When at least half the winning force are Warg Riders, every beaten unit's chance of
  // being destroyed in the rout rises by RUN_THEM_DOWN_PCT, on any ground — instead of the old
  // automatic chase after the beaten commander, which marched the victor off in later phases on
  // orders nobody gave. There is no follow-up move or pursuit now. A Shield Fort withdrawal is
  // immune, exactly as it is to Ride Them Down.
  const _wargAtk = isHalfOrMore(atkArmies, 'Warg Riders');
  const _wargDef = isHalfOrMore(defArmies, 'Warg Riders');
  // PRIMAL (2026-10-13, the beast abilities): the Manticores hunt a broken foe down on any ground, and at sea the sharks tear into
  // beaten crews — each +RUN_THEM_DOWN_PCT to the loser's destruction rolls when at least half the winning force is theirs,
  // as the Wargs' Run Them Down; a Shield Fort withdrawal is immune to both.
  const _mantAtk = isHalfOrMore(atkArmies, 'Manticore Pride'),
    _mantDef = isHalfOrMore(defArmies, 'Manticore Pride');
  const _sharkAtk = pvpTerrain === 'sea' && isHalfOrMore(atkArmies, 'Shark Shoals'),
    _sharkDef = pvpTerrain === 'sea' && isHalfOrMore(defArmies, 'Shark Shoals');
  const _huntPct = (mant, shark) => (mant ? RUN_THEM_DOWN_PCT : 0) + (shark ? RUN_THEM_DOWN_PCT : 0);
  const _huntLines = (mant, shark, sf, winner, loser, narr) => {
    if (mant)
      narr.push(
        sf
          ? `🛡 ${loser}'s Dwarven Guard lock shields as they give ground — ${winner}'s Manticore Pride find no broken backs to hunt.`
          : `🦂 ${winner}'s Manticore Pride hunt the broken companies down before they can get clear (+${dispFloor(RUN_THEM_DOWN_PCT * 100)}% losses to ${loser}).`,
      );
    if (shark)
      narr.push(
        sf
          ? `🛡 ${loser}'s Dwarven Guard lock shields as they give ground — ${winner}'s Shark Shoals find nothing in the water.`
          : `🦈 Feeding Frenzy — ${winner}'s Shark Shoals tear into ${loser}'s beaten crews as they founder (+${dispFloor(RUN_THEM_DOWN_PCT * 100)}% losses to ${loser}).`,
      );
  };
  // (The Eagle Riders' Skyward Retreat was retired with the unit abilities, 2026-10-11.)
  const _noEscapeRoll = (force, name, narr) => {
    (force || []).forEach((a) => {
      if (kcRng() < 0.15) {
        a._died = true;
        narr.push(`— ${ownedUnitName(name, a)} are cut down with no escape!`);
      }
    });
  };
  const atkMilMultOf = (a) => 1 + discPromo(turnContext, atk.player, a); // per-unit promo discoveries
  const defMilMultOf = (a) => 1 + discPromo(turnContext, def.player, a);

  prov._hadBattleThisTurn = true;
  // a beaten force that still has a road home normally retreats — but if it ends the fight
  // STRONGER than the victor (its surviving units outweigh theirs, so it could expect to win a
  // rematch), it may instead hold the field and fight on. Chance scales with how much stronger it
  // is, capped at 75%. "Stay" leaves the province contested (_battleUnresolved), and the
  // stalled-battle resolver grinds the carry-on each following phase until it breaks one way or
  // the other.
  // 2026-09-23b ROOT CAUSE FIX: _survStr summed BARE armStr (no ctx, no Tactical, no defender
  // bonus, no discoveries), so two Elven eagle units (≈39) "outweighed" an Elite Dwarven Guard (32
  // bare) that actually fights at ≈120 (Bulwark ×1.5, Tactical ×2.0, defender ×1.25) — and the
  // beaten eagles were told they were "still the stronger host" and kept in a hopeless carry-on.
  // Survivors are now valued exactly as the battle values a unit (ladder rows: ctx, Archery /
  // Naval / Tactical, battle lines) × every force-wide multiplier that would carry into a rematch.
  // Left out: this battle's arrows/spells (_tempStrReduction — cleared at battle end), the random
  // Tactical-L6 / War-Drum tier-ups and the random fanaticism roll (all re-rolled next round).
  const _atkFanDet = Math.max(
    1,
    atkSkelFanatic ? UNDEAD_SKEL_KING_FAN : 1,
    atkEvilMonster ? 1.25 : 1,
    atkSkelHero ? UNDEAD_SKEL_HERO_FAN : 1,
  );
  const _defFanDet = Math.max(
    1,
    defSkelFanatic ? UNDEAD_SKEL_KING_FAN : 1,
    defEvilMonster ? 1.25 : 1,
    defSkelHero ? UNDEAD_SKEL_HERO_FAN : 1,
  );
  const _survStr = (isAtk) => {
    const clean = (f) =>
      (f || [])
        .filter((a) => a && !a._died && !a._disbanded)
        .map((a) => {
          const c = { ...a };
          delete c._tempStrReduction;
          delete c._terrorMult;
          delete c._archeryRed;
          delete c._tacUp;
          delete c._drumUp;
          delete c._flakTargeted;
          return c;
        });
    const mine = clean(isAtk ? atk.armies : def.armies),
      foe = clean(isAtk ? def.armies : atk.armies);
    if (!mine.length) return 0;
    const rows = mine.map((a) => _pvpRow(a, isAtk, mine, foe)),
      foeRows = foe.map((a) => _pvpRow(a, !isAtk, foe, mine));
    // Both grids and who faces whom, exactly as a rematch would place them (2026-10-11).
    const myFlank = isAtk ? atkFlankPvp : defFlankPvp,
      foeFlank = isAtk ? defFlankPvp : atkFlankPvp,
      myTac = isAtk ? atkTact : defTact,
      foeTac = isAtk ? defTact : atkTact;
    const gMe = battleGrid(rows, pvpFront, pvpTerrain, {
      flank: myFlank,
      tac: myTac,
      enemy: foeRows,
      enemyTac: foeTac,
    });
    const gFoe = battleGrid(foeRows, pvpFront, pvpTerrain, {
      flank: foeFlank,
      tac: foeTac,
      enemy: rows,
      enemyTac: myTac,
    });
    battleFacing(isAtk ? gMe : gFoe, isAtk ? gFoe : gMe, pvpTerrain);
    const tot = gMe.face.total;
    return isAtk
      ? tot * _atkFanDet * atkDiscBonus * atkMorale * _consecPenalty * atkSanct * atkOrd * atkHomeBonusP
      : tot * _defFanDet * defBonus * defMorale * defDiscBonus * defSanct * defOrd;
  };
  let _stayLo = 0,
    _stayWi = 0;
  const _wantsToStay = (loserForce, loserCh) => {
    if (!loserForce || loserForce.length === 0) return false;
    const loIsAtk = loserCh === atk;
    const lo = _survStr(loIsAtk),
      wi = _survStr(!loIsAtk);
    _stayLo = lo;
    _stayWi = wi;
    if (lo <= wi) return false; // not actually the stronger host — retreat
    const stayChance = Math.max(0, Math.min(0.75, lo / Math.max(1, wi) - 1));
    return kcRng() < stayChance;
  };
  let _heldField = false; // the beaten side stays on the field (stay / trapped / Deathless / Shield Fort)
  // 2026-09-23b: a casualty section with no line at all (the victor's lone unit came through
  // untouched) printed a bare header. Any unit that got no line of its own is reported as surviving
  // — same wording as combatVsNPC. (Each unit writes at most one line in these loops.)
  const survLine = (force, n0) => {
    const f = (force || []).filter(Boolean),
      got = narrative.length - n0;
    if (got < f.length) narrative.push(`— ${got > 0 ? 'All other' : 'All'} forces survive the engagement.`);
    else if (!f.length && got === 0) narrative.push(`— No units were left on the field to count.`);
  };
  if (won) {
    const _winVerb = pick(WIN_VERBS),
      _headIdx = narrative.length;
    narrative.push(
      `After ${aAn(severity)} ${severity} battle, ${atkName}'s forces ${_winVerb} ${defName}'s army and seize ${prov.name}!`,
    );
    narrative.push(`⚔ **${atkName}'s forces** (attacker):`); // Winning attacker
    const _cas0 = narrative.length;
    rollUnitFates(atkArmies, {
      owner: atkName,
      won: true,
      dieAt: (a) => winDeathPvP * atkSteelMultOf(a),
      promoteTo: (a) =>
        winDeathPvP * atkSteelMultOf(a) +
        xpChancePvP(winXPPvP * atkMilMultOf(a), a.quality) * humanXPMult(a, atk.player, G),
      faced: _facedA,
      say: (l) => narrative.push(l),
    });
    survLine(atkArmies, _cas0);
    narrative.push(`🛡 **${defName}'s forces** (defender):`);
    const _rideAtkEff = _sfDef ? 0 : _rideAtk + (_wargAtk ? RUN_THEM_DOWN_PCT : 0) + _huntPct(_mantAtk, _sharkAtk);
    if (_rideAtk > 0 && _sfDef)
      narrative.push(
        `🛡 ${defName}'s Dwarven Guard lock shields as they give ground — ${atkName}'s Free Lances find no broken backs to ride down.`,
      );
    else if (_rideAtk > 0)
      narrative.push(
        `🐎 ${atkName}'s Free Lances ride down the broken companies (+${dispFloor(_rideAtk * 100)}% losses to ${defName}).`,
      );
    if (_wargAtk)
      narrative.push(
        _sfDef
          ? `🛡 ${defName}'s Dwarven Guard lock shields as they give ground — ${atkName}'s Warg Riders find no broken backs to run down.`
          : `🐺 ${atkName}'s Warg Riders run down the broken companies before they can get clear (+${dispFloor(RUN_THEM_DOWN_PCT * 100)}% losses to ${defName}).`,
      );
    _huntLines(_mantAtk, _sharkAtk, _sfDef, atkName, defName, narrative);
    // Losing defender
    const _cas1 = narrative.length;
    rollUnitFates(defArmies, {
      owner: defName,
      won: false,
      dieAt: (a) => loseDeathPvP * defSteelMultOf(a) * defTacMult + _rideAtkEff,
      demoteAt: (a) => loseDemotePvP * defTacMult,
      promoteTo: (a) =>
        loseDemotePvP + xpChancePvP(loseXPPvP * defMilMultOf(a), a.quality) * humanXPMult(a, def.player, G),
      shieldFort: _sfDef,
      faced: _facedD,
      say: (l) => narrative.push(l),
    });
    survLine(defArmies, _cas1);
    recordBattleGraves(
      turnContext,
      prov,
      atkArmies.filter((a) => a._died),
      atk && atk.player,
    );
    recordBattleGraves(
      turnContext,
      prov,
      defArmies.filter((a) => a._died),
      def && def.player,
    );
    bloodHarvest(turnContext, atk, defArmies.filter((a) => a._died).length, narrative);
    ironThroneRaise(
      turnContext,
      atk,
      defArmies.filter((a) => a._died),
      narrative,
    ); // GRAND DESIGN — Evil
    atk.armies = atkArmies.filter((a) => !a._died && !a._disbanded);
    def.armies = defArmies.filter((a) => !a._died && !a._disbanded);
    // Losing defender retreat
    const defAdjProvs = getNeighborsP(prov, G.world.cols, G.world.rows, G.world.provinces);
    const _defRetSc = getSeaCapability(def.armies || [], def); // only ground the beaten force could legally enter
    let defFriendlyAdj = retreatOptions(turnContext, def, prov, def.armies || []); // own/allied ground it could legally enter, or the unowned sea it sailed from (2026-09-23c)
    // HUMAN — Cut the Line: corsairs close the sea lanes behind a beaten enemy.
    if (_cutAtk && defFriendlyAdj.length > 0) {
      const overland = defFriendlyAdj.filter((p2) => p2.terrain !== 'sea');
      if (overland.length < defFriendlyAdj.length) {
        narrative.push(`⛵ ${atkName}'s corsairs close the sea lanes — ${defName} cannot slip away by water.`);
        defFriendlyAdj = overland;
      }
    }
    // DWARF — Shield Fort: trapped, the Guard hold contested WITHOUT extra no-escape losses; with
    // a path open, they withdraw in good order (mechanics applied above) — no pin.
    const _dmDef =
      def.armies.length > 0 && def.armies.every((a) => a._isSkeletal) && G.players[def.player]?.alignment === 'Undead';
    // 2026-09-27 (Toby item 3): the naval split. Evaluated once, ahead of the branch chain, so a
    // mixed column whose hulls can still sail is never filed as "nowhere to retreat". A host that
    // is still the stronger and means to fight on (_wantsToStay) keeps that choice, and a dead
    // commander never retreats — both are checked first. Cut the Line closes the water to it too.
    const _defStays = defFriendlyAdj.length > 0 && _wantsToStay(def.armies, def, atk.armies, atk);
    const _navalDef =
      _defStays || def.alive === false || def.killedThisTurn
        ? ''
        : navalSplitRetreat(turnContext, def, prov, def.armies, narrative, defName, _cutAtk);
    if (_navalDef) {
      if (_navalDef === 'stay') {
        prov._battleUnresolved = true;
        _heldField = true;
      }
    } else if (defFriendlyAdj.length === 0) {
      {
        const _st = seaTrapLine(defName, def, prov, def.armies);
        if (_st) narrative.push(_st);
      }
      if (_dmDef) {
        // UNDEAD — Deathless March: the dead do not panic. A trapped all-skeletal force takes no
        // flight casualties; it simply stands among the living's fear, contesting the ground.
        narrative.push(
          `💀 Deathless March — ${defName}'s skeletal host has no fear to exploit: none are cut down in flight, and the dead stand their ground in ${prov.name}.`,
        );
        prov._battleUnresolved = true;
        _heldField = true;
      } else if (_sfDef && def.armies.length > 0) {
        narrative.push(
          `🛡 Shield Fort — with no road out, ${defName}'s Dwarven Guard lock shields where they stand. None are cut down in flight, and ${prov.name} remains contested.`,
        );
        prov._battleUnresolved = true;
        _heldField = true;
      } else {
        narrative.push(`${defName} has nowhere to retreat — their forces take additional casualties!`);
        _noEscapeRoll(def.armies, def.name, narrative);
        def.armies = def.armies.filter((a) => !a._died && !a._disbanded);
        if (def.armies.length > 0) prov._battleUnresolved = true;
        _heldField = true; // trapped survivors fight again next phase
      }
    } else if (_defStays) {
      // still the stronger host — the defender refuses to yield and fights on.
      narrative.push(
        `${defName}'s forces are pushed back but not broken — still the stronger host (${n0(_stayLo)} vs ${n0(_stayWi)} on the same footing, before fortune), they hold their ground in ${prov.name} and re-form to fight on rather than retreat.`,
      );
      prov._battleUnresolved = true;
      _heldField = true;
    } else if (def.alive === false || def.killedThisTurn) {
      // the commander is already dead (e.g. slain in the pre-battle duel) — a corpse does not
      // retreat, and a force wiped to the last has nothing left to fall back with. Any leaderless
      // survivors are dispersed after the battle by disperseDeadCharArmies (which logs where they
      // go), so we say nothing about a retreat here.
      if ((def.armies || []).length === 0)
        narrative.push(`📊 ${defName}'s force is destroyed to the last — commander and column both.`);
    } else {
      if (_sfDef && def.armies.length > 0)
        narrative.push(`🛡 Shield Fort — ${defName}'s Dwarven Guard withdraw in good order behind locked shields.`);
      const defFromProv = G.world.provinces[def._attackedFrom];
      // never retreat INTO the contested province (stale _attackedFrom guard).
      const defRetreatTo =
        defFromProv && defFromProv.id !== prov.id && defFriendlyAdj.some((p2) => p2.id === defFromProv.id)
          ? defFromProv
          : bestRetreat(
              turnContext,
              def,
              defFriendlyAdj.filter((p2) => p2.id !== prov.id),
            ) || defFriendlyAdj[0]; // adjacent only; with a choice, the most valuable ground wins
      narrative.push(`${defName} retreats to ${defRetreatTo.name}.`);
      const defSurvivors2 = def.armies || [];
      if (defSurvivors2.length > 0) narrative.push(`📊 ${defName}'s surviving forces: ${describeArmy(defSurvivors2)}.`);
      else narrative.push(`📊 ${defName}'s forces are completely destroyed — they retreat alone.`);
      prov.characters = (prov.characters || []).filter((id) => id !== def.id);
      defRetreatTo.characters = defRetreatTo.characters || [];
      if (!defRetreatTo.characters.includes(def.id)) defRetreatTo.characters.push(def.id);
      def.location = defRetreatTo.id; // a forced retreat does NOT consume the character's move points.
    }
    if (_heldField)
      narrative[_headIdx] =
        `After ${aAn(severity)} ${severity} battle, ${atkName}'s forces ${_winVerb} ${defName}'s army — but ${defName}'s survivors do not yield ${prov.name}.`;
  } else {
    const _headIdx = narrative.length;
    narrative.push(
      `${atkName}'s assault is repelled! After ${aAn(severity)} ${severity} engagement, ${defName} drives the attackers from ${prov.name}.`,
    );
    narrative.push(`⚔ **${atkName}'s forces** (attacker):`); // Losing attacker
    const _rideDefEff = _sfAtk ? 0 : _rideDef + (_wargDef ? RUN_THEM_DOWN_PCT : 0) + _huntPct(_mantDef, _sharkDef);
    if (_rideDef > 0 && _sfAtk)
      narrative.push(
        `🛡 ${atkName}'s Dwarven Guard lock shields as they give ground — ${defName}'s Free Lances find no broken backs to ride down.`,
      );
    else if (_rideDef > 0)
      narrative.push(
        `🐎 ${defName}'s Free Lances ride down the broken companies (+${dispFloor(_rideDef * 100)}% losses to ${atkName}).`,
      );
    if (_wargDef)
      narrative.push(
        _sfAtk
          ? `🛡 ${atkName}'s Dwarven Guard lock shields as they give ground — ${defName}'s Warg Riders find no broken backs to run down.`
          : `🐺 ${defName}'s Warg Riders run down the broken companies before they can get clear (+${dispFloor(RUN_THEM_DOWN_PCT * 100)}% losses to ${atkName}).`,
      );
    _huntLines(_mantDef, _sharkDef, _sfAtk, defName, atkName, narrative);
    const _cas2 = narrative.length;
    rollUnitFates(atkArmies, {
      owner: atkName,
      won: false,
      diedVerb: 'were annihilated in the rout!',
      dieAt: (a) => loseDeathPvP * atkSteelMultOf(a) * atkTacMult + _rideDefEff,
      demoteAt: (a) => loseDemotePvP * atkTacMult,
      promoteTo: (a) =>
        loseDemotePvP + xpChancePvP(loseXPPvP * atkMilMultOf(a), a.quality) * humanXPMult(a, atk.player, G),
      shieldFort: _sfAtk,
      faced: _facedA,
      say: (l) => narrative.push(l),
    });
    survLine(atkArmies, _cas2);
    narrative.push(`🛡 **${defName}'s forces** (defender):`);
    // Winning defender — small death chance, good XP chance
    const _cas3 = narrative.length;
    rollUnitFates(defArmies, {
      owner: defName,
      won: true,
      promoteVerb: 'are hardened by victory to',
      dieAt: (a) => winDeathPvP * defSteelMultOf(a),
      promoteTo: (a) =>
        winDeathPvP * defSteelMultOf(a) +
        xpChancePvP(winXPPvP * defMilMultOf(a), a.quality) * humanXPMult(a, def.player, G),
      faced: _facedD,
      say: (l) => narrative.push(l),
    });
    survLine(defArmies, _cas3);
    recordBattleGraves(
      turnContext,
      prov,
      atkArmies.filter((a) => a._died),
      atk && atk.player,
    );
    recordBattleGraves(
      turnContext,
      prov,
      defArmies.filter((a) => a._died),
      def && def.player,
    );
    bloodHarvest(turnContext, def, atkArmies.filter((a) => a._died).length, narrative);
    ironThroneRaise(
      turnContext,
      def,
      atkArmies.filter((a) => a._died),
      narrative,
    ); // GRAND DESIGN — Evil
    atk.armies = atkArmies.filter((a) => !a._died && !a._disbanded);
    def.armies = defArmies.filter((a) => !a._died && !a._disbanded);
    // Losing attacker retreat
    const atkAdjProvs = getNeighborsP(prov, G.world.cols, G.world.rows, G.world.provinces);
    const _atkRetSc = getSeaCapability(atk.armies || [], atk); // only ground the beaten force could legally enter
    let atkFriendlyAdj = retreatOptions(turnContext, atk, prov, atk.armies || []); // own/allied ground it could legally enter, or the unowned sea it sailed from (2026-09-23c)
    // HUMAN — Cut the Line: corsairs close the sea lanes behind a beaten enemy.
    if (_cutDef && atkFriendlyAdj.length > 0) {
      const overland = atkFriendlyAdj.filter((p2) => p2.terrain !== 'sea');
      if (overland.length < atkFriendlyAdj.length) {
        narrative.push(`⛵ ${defName}'s corsairs close the sea lanes — ${atkName} cannot slip away by water.`);
        atkFriendlyAdj = overland;
      }
    }
    // DWARF — Shield Fort: trapped, the Guard hold contested WITHOUT extra no-escape losses; with
    // a path open, they withdraw in good order (mechanics applied above) — no pin.
    const _dmAtk =
      atk.armies.length > 0 && atk.armies.every((a) => a._isSkeletal) && G.players[atk.player]?.alignment === 'Undead';
    // 2026-09-27 (Toby item 3): the naval split — see the defender's block above for the reasoning.
    const _atkStays = atkFriendlyAdj.length > 0 && _wantsToStay(atk.armies, atk, def.armies, def);
    const _navalAtk =
      _atkStays || atk.alive === false || atk.killedThisTurn
        ? ''
        : navalSplitRetreat(turnContext, atk, prov, atk.armies, narrative, atkName, _cutDef);
    if (_navalAtk) {
      if (_navalAtk === 'stay') {
        prov._battleUnresolved = true;
        _heldField = true;
      }
    } else if (atkFriendlyAdj.length === 0) {
      {
        const _st = seaTrapLine(atkName, atk, prov, atk.armies);
        if (_st) narrative.push(_st);
      }
      if (_dmAtk) {
        narrative.push(
          `💀 Deathless March — ${atkName}'s skeletal host has no fear to exploit: none are cut down in flight, and the dead stand their ground in ${prov.name}.`,
        );
        prov._battleUnresolved = true;
        _heldField = true;
      } else if (_sfAtk && atk.armies.length > 0) {
        narrative.push(
          `🛡 Shield Fort — with no road out, ${atkName}'s Dwarven Guard lock shields where they stand. None are cut down in flight, and ${prov.name} remains contested.`,
        );
        prov._battleUnresolved = true;
        _heldField = true;
      } else {
        narrative.push(
          `${atkName} has nowhere to retreat — their forces take additional casualties, ${prov.terrain === 'sea' ? 'hemmed in on open water' : 'cut down against the walls'} with no escape!`,
        );
        _noEscapeRoll(atk.armies, atk.name, narrative);
        atk.armies = atk.armies.filter((a) => !a._died && !a._disbanded);
        if (atk.armies.length > 0) prov._battleUnresolved = true;
        _heldField = true; // trapped survivors fight again next phase
      }
    } else if (_atkStays) {
      // still the stronger host — the attacker refuses to break off and fights on.
      narrative.push(
        `${atkName}'s assault is thrown back but their host is still the stronger (${n0(_stayLo)} vs ${n0(_stayWi)} on the same footing, before fortune) — they hold the field in ${prov.name} and re-form to press the attack again rather than retreat.`,
      );
      prov._battleUnresolved = true;
      _heldField = true;
    } else if (atk.alive === false || atk.killedThisTurn) {
      // commander already slain — a corpse does not retreat; a force wiped to the last has
      // nothing to fall back with. Leaderless survivors are dispersed after the battle.
      if ((atk.armies || []).length === 0)
        narrative.push(`📊 ${atkName}'s force is destroyed to the last — commander and column both.`);
    } else {
      if (_sfAtk && atk.armies.length > 0)
        narrative.push(`🛡 Shield Fort — ${atkName}'s Dwarven Guard withdraw in good order behind locked shields.`);
      const fromProv = G.world.provinces[atk._attackedFrom];
      // never retreat INTO the contested province (stale _attackedFrom guard).
      const retreatTo =
        fromProv && fromProv.id !== prov.id && atkFriendlyAdj.some((p2) => p2.id === fromProv.id)
          ? fromProv
          : bestRetreat(
              turnContext,
              atk,
              atkFriendlyAdj.filter((p2) => p2.id !== prov.id),
            ) || atkFriendlyAdj[0]; // adjacent only; with a choice, the most valuable ground wins
      narrative.push(`${atkName} retreats to ${retreatTo.name}.`);
      // Summarise surviving attacker armies
      const atkSurvivors = atk.armies || [];
      if (atkSurvivors.length > 0) narrative.push(`📊 ${atkName}'s surviving forces: ${describeArmy(atkSurvivors)}.`);
      else narrative.push(`📊 ${atkName}'s forces are completely destroyed — they retreat alone.`);
      prov.characters = (prov.characters || []).filter((id) => id !== atk.id);
      retreatTo.characters = retreatTo.characters || [];
      if (!retreatTo.characters.includes(atk.id)) retreatTo.characters.push(atk.id);
      atk.location = retreatTo.id; // a forced retreat does NOT consume the character's move points.
    }
    if (_heldField)
      narrative[_headIdx] =
        `${atkName}'s assault is repelled! After ${aAn(severity)} ${severity} engagement, ${defName} throws the attackers back — but they are not yet driven from ${prov.name}.`;
  }

  // Battle-magic strength reductions last only for this battle — units recover afterward.
  [...(atk.armies || []), ...(def.armies || [])].forEach((a) => {
    delete a._tempStrReduction;
    delete a._terrorMult;
    delete a._archeryRed;
    delete a._tacUp;
    delete a._drumUp;
    delete a._laNoTerrain;
    delete a._flakTargeted;
  });
  clearPhantomCopies(atk, !won, realCharOf(turnContext, atk));
  clearPhantomCopies(def, won, realCharOf(turnContext, def)); // remove phantom fighting-copies; the beaten side loses all its phantasmal armies

  // AK [3.15]: "A character's Defend order is canceled if he loses a battle, to prevent further
  // needless defeats." atk/def are pooled copies, so resolve back to the real character by id.
  noteBattleLoss(turnContext, won ? def.id : atk.id, narrative);
  completeDefendWatches(turnContext, _fieldIds, narrative); // item 15: a watch that has fought is done, win or lose
  if (_rollTacticalGainPvP) trySkillGain(turnContext, won ? atk : def, 'tactical', SKILLGAIN_STD, narrative); // Tactical: won a land battle
  if (_rollNavalGainPvP) trySkillGain(turnContext, won ? atk : def, 'naval', SKILLGAIN_STD, narrative); // Naval: won a sea battle
  trySkillGain(
    turnContext,
    won ? def : atk,
    prov.terrain === 'sea' ? 'naval' : 'tactical',
    SKILLGAIN_COMMON,
    narrative,
  ); // batch item 11: the beaten general who lives learns a little
  if (_rollDruidGainPvP) {
    trySkillGain(turnContext, won ? atk : def, 'druid', SKILLGAIN_STD, narrative);
    trySkillGain(turnContext, won ? def : atk, 'druid', SKILLGAIN_STD, narrative, 0.5);
  } // Druid: winner full, loser half
  // onlooker summary (see combatVsNPC). atkName/defName reflect a slain commander's leaderless
  // host.
  const summaryText = `⚔ Battle at ${prov.name}: ${won ? `${atkName}'s forces defeat ${defName}` : `${defName}'s forces hold against ${atkName}`}.`;
  _tallyLost();
  try {
    _tel.battles.push({
      ph: turnContext._logCtx.phase ?? turnContext._currentPhase,
      prov: prov.id,
      terrain: prov.terrain,
      kind: 'pvp',
      atkPi: atk.player,
      atkChar: atk.id,
      defPi: def.player,
      defChar: def.id,
      atkStr: Math.round(atkBaseStr),
      defStr: Math.round(defBaseStr),
      S: Math.round((_fortP.S || 0) * 1000) / 1000,
      atkUnits: (atk.armies || []).filter((a) => a && !a._phantom).length + _mAtkLost,
      defUnits: (def.armies || []).filter((a) => a && !a._phantom).length + _mDefLost,
      won,
      atkLost: _mAtkLost,
      defLost: _mDefLost,
      carry: prov._carryOnRounds || 0,
    });
  } catch (_te) {}
  return { won, narrative, summaryText, atkLost: _mAtkLost, defLost: _mDefLost };
}
