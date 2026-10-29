import { kcRng } from '../rng.ts';
import { SEA_TYPES } from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { shuffleP } from '../battle/fortune.ts';
import { _escapesTheEnd, _garrethEscapeLine } from '../names.ts';
import { d100 } from '../dice-and-army-names.ts';
import { markProvinceCombat } from '../bots/intel.ts';
import { getNeighborsP } from '../world/map-helpers.ts';
import { skillLevel } from '../titles/perks.ts';
import { areEnemies } from '../realms/relations-and-captures.ts';
import { SKILLGAIN_STD, awardKillXP, trySkillGain } from '../heroes/experience-skill-rises-and-earned-hp.ts';
import { pcCharCombatant } from '../personal-combat/speed-encounter-plans-and-combatants.ts';
import { reportHeroFall } from '../heroes/hero-death-and-leaderless-hosts.ts';
import type { Character, Province } from '../../schemas/saved-game-state.ts';
import type { TurnContext } from '../turn/context.ts';
import { emit, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from '../turn/events-and-their-audiences.ts';

// ── THE WAR MASTERY ORDERS (plan P1-08j8: the eighth family taken out of processOrder in resolveTurn) ──
// The masteries a hero of level 7 or 9 in a war skill may order once a turn (processOrder checks that first): Naval's
// Blockade (a sea sealed against enemy fleets, half the time) and Raid the Coast (an amphibious assault's bonus);
// Melee's Challenge (single combat with an enemy hero who leads no army) and Rampage (companies cut down and their
// commander bloodied); Archery's Rain of Arrows (companies felled) and Sniper's Mark (wounds and a chance to slay); and
// the battle-strength flags a later battle this turn reads: Tactical's Feigned Retreat and Grand Stratagem, March's
// Lightning Advance. Each takes the turn's context first (src/engine/turn/context.ts), then the values processOrder
// worked out before it that it reads, in the order processOrder declares them. Each body keeps processOrder's indent
// (plan P1-08's Decisions); a case-level break became a return.
// Blockade (Naval 7): a sea the hero is in or beside, sealed against enemy fleets this turn, half the time.
export function resolveBlockadeOrder(turnContext: TurnContext, c: Character, target: string) {
  const { G } = turnContext;
  if (skillLevel(c, 'naval') < 7) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero lacks the Naval mastery to raise a Blockade', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const sp = G.world.provinces[parseInt(target)];
  if (!sp || sp.terrain !== 'sea') {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a Blockade must target a sea province', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const heroProv = G.world.provinces[c.location];
  if (!heroProv) throw new TypeError("the hero's province isn't on the map"); // never met: a hero stands on the map
  const adj = new Set(getNeighborsP(heroProv, G.world.cols, G.world.rows, G.world.provinces).map((p) => p.id));
  if (sp.id !== c.location && !adj.has(sp.id)) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a Blockade must seal a sea the hero is in or beside', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (!(c.armies || []).some((a) => SEA_TYPES.has(a.type))) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a Blockade must be thrown by a fleet', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  } // NAVAL L7: must lead a naval unit / sea creature
  if (kcRng() < 0.5) {
    // NAVAL L7: the blockade forms only half the time
    sp._blockadeTurn = G.turn;
    sp._blockadeBy = c.player;
    emit(turnContext, {
      type: 'move',
      fact: { kind: 'a hero throws a Blockade across a sea', heroName: c.name, provinceName: sp.name },
      audience: { actor: c.player, realms: [c.player], seen: 'there' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: sp.id,
    });
  } else {
    emit(turnContext, {
      type: 'move',
      fact: { kind: 'the fleet cannot close the waters in time', heroName: c.name, provinceName: sp.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: sp.id,
    });
  }
  trySkillGain(turnContext, c, 'naval', SKILLGAIN_STD);
  return;
}
// Challenge (Melee 7): single combat with an enemy hero beside him who leads no army.
export function resolveChallengeOrder(turnContext: TurnContext, c: Character, target: string, prov: Province) {
  const { G } = turnContext;
  if (skillLevel(c, 'melee') < 7) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero lacks the Melee mastery to issue a Challenge', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const foe = G.characters.find(
    (ch) => ch.alive && ch.id === parseInt(target) && ch.location === c.location && ch.player !== c.player,
  );
  if (!foe) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero finds no enemy hero to challenge', heroName: c.name, provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (foe.player != null && !areEnemies(turnContext, c.player, foe.player)) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a Challenge of a hero whose crown is not at war is refused', heroName: c.name, foeName: foe.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if ((foe.armies || []).length > 0) {
    emit(turnContext, {
      type: 'combat',
      fact: { kind: 'a hero at the head of an army will not answer a Challenge', foeName: foe.name, heroName: c.name },
      audience: { actor: c.player, realms: [c.player, foe.player].filter((x) => x != null) },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      heroes: [c.id, foe.id].filter((v) => v != null),
      province: prov.id,
    });
    return;
  }
  markProvinceCombat(prov, [c.player, foe.player]); // purple swords: a personal duel, not a field battle
  const A = pcCharCombatant(turnContext, c),
    B = pcCharCombatant(turnContext, foe);
  const aScore = (A.melee + A.archery) * 3 + (c.hp || 20) + d100() / 4;
  const bScore = (B.melee + B.archery) * 3 + (foe.hp || 20) + d100() / 4;
  const win = aScore >= bScore;
  const winner = win ? c : foe,
    loser = win ? foe : c;
  const dmg = 8 + Math.floor(Math.abs(aScore - bScore) / 6);
  loser.hp = Math.max(0, (loser.hp || 20) - dmg);
  emit(turnContext, {
    type: 'combat',
    fact: {
      kind: 'a hero calls another to single combat',
      heroName: c.name,
      foeName: foe.name,
      winnerName: winner.name,
      loserName: loser.name,
      wounds: dmg,
    },
    audience: { actor: c.player, realms: [c.player, foe.player].filter((x) => x != null), seen: 'battle' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  if (loser.hp <= 0) {
    if (_escapesTheEnd(loser)) {
      if (loser.hp <= 0) loser.hp = 1;
      emit(turnContext, {
        type: 'combat',
        fact: _garrethEscapeLine(loser),
        audience: { actor: c.player, realms: [c.player].filter((x) => x != null), seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    } else {
      reportHeroFall(
        turnContext,
        loser,
        winner,
        { kind: 'a hero is slain outside a battle', heroName: loser.name, how: 'in the duel', killerName: null },
        {
          audience: { actor: c.player, realms: [c.player, foe.player].filter((x) => x != null), seen: 'battle' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        },
      );
      awardKillXP(turnContext, winner, loser);
    }
  }
  if (win) c.merits = (c.merits || 0) + 2;
  trySkillGain(turnContext, c, 'melee', SKILLGAIN_STD);
  return;
}
// Rampage (Melee 9): companies of an enemy host beside him cut down, and its commander bloodied.
export function resolveRampageOrder(turnContext: TurnContext, c: Character, target: string, prov: Province) {
  const { G } = turnContext;
  if (skillLevel(c, 'melee') < 9) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero lacks the Melee mastery to Rampage', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const foe = G.characters.find(
    (ch) => ch.alive && ch.id === parseInt(target) && ch.location === c.location && ch.player !== c.player,
  );
  if (!foe || (foe.armies || []).length === 0) {
    emit(turnContext, {
      type: 'combat',
      fact: { kind: 'a hero finds no enemy force to fall upon', heroName: c.name, provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (foe.player != null && !areEnemies(turnContext, c.player, foe.player)) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a Rampage on a host whose crown is not at war is refused', heroName: c.name, foeName: foe.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const src = foe.armies;
  const kills = Math.min(src.length, 2 + Math.floor(skillLevel(c, 'melee') / 2));
  const idxs = shuffleP(src.map((_, i) => i))
    .slice(0, kills)
    .sort((a, b) => b - a);
  idxs.forEach((i) => src.splice(i, 1));
  const hd = 6 + skillLevel(c, 'melee');
  foe.hp = Math.max(1, (foe.hp || 20) - hd);
  emit(turnContext, {
    type: 'combat',
    fact: {
      kind: "a hero goes on a Rampage through a host's ranks",
      heroName: c.name,
      foeName: foe.name,
      kills: kills,
    },
    audience: { actor: c.player, realms: [c.player, foe.player].filter((x) => x != null), seen: 'battle' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  c.merits = (c.merits || 0) + 1;
  trySkillGain(turnContext, c, 'melee', SKILLGAIN_STD);
  return;
}
// Rain of Arrows (Archery 7): companies of an enemy host beside him felled by the volley.
export function resolveRainOfArrowsOrder(turnContext: TurnContext, c: Character, target: string, prov: Province) {
  const { G } = turnContext;
  if (skillLevel(c, 'archery') < 7) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero lacks the Archery mastery for a Rain of Arrows', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const foe = G.characters.find(
    (ch) => ch.alive && ch.id === parseInt(target) && ch.location === c.location && ch.player !== c.player,
  );
  if (!foe || (foe.armies || []).length === 0) {
    emit(turnContext, {
      type: 'combat',
      fact: { kind: 'a hero finds no enemy force to volley', heroName: c.name, provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (foe.player != null && !areEnemies(turnContext, c.player, foe.player)) {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'a Rain of Arrows on a host whose crown is not at war is refused',
        heroName: c.name,
        foeName: foe.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const src = foe.armies;
  const kills = Math.min(src.length, 1 + Math.floor(skillLevel(c, 'archery') / 2));
  const idxs = shuffleP(src.map((_, i) => i))
    .slice(0, kills)
    .sort((a, b) => b - a);
  idxs.forEach((i) => src.splice(i, 1));
  emit(turnContext, {
    type: 'combat',
    fact: { kind: 'a hero looses a Rain of Arrows on a host', heroName: c.name, foeName: foe.name, kills: kills },
    audience: { actor: c.player, realms: [c.player, foe.player].filter((x) => x != null), seen: 'battle' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  trySkillGain(turnContext, c, 'archery', SKILLGAIN_STD);
  return;
}
// Sniper's Mark (Archery 9): wounds to an enemy hero beside him, and a chance to slay him.
export function resolveSnipersMarkOrder(turnContext: TurnContext, c: Character, target: string, prov: Province) {
  const { G } = turnContext;
  if (skillLevel(c, 'archery') < 9) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "a hero lacks the Archery mastery for a Sniper's Mark", heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const foe = G.characters.find(
    (ch) => ch.alive && ch.id === parseInt(target) && ch.location === c.location && ch.player !== c.player,
  );
  if (!foe) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero finds no enemy commander to mark', heroName: c.name, provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (foe.player != null && !areEnemies(turnContext, c.player, foe.player)) {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: "a Sniper's Mark on a hero whose crown is not at war is refused",
        heroName: c.name,
        foeName: foe.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const dmg = 8 + skillLevel(c, 'archery');
  foe.hp = Math.max(0, (foe.hp || 20) - dmg);
  const killChance = Math.min(40, 10 + skillLevel(c, 'archery') * 3) - (foe.isKing ? 15 : 0);
  const roll = d100();
  emit(turnContext, {
    type: 'combat',
    fact: {
      kind: "a hero takes a Sniper's Mark on an enemy hero",
      heroName: c.name,
      foeName: foe.name,
      wounds: dmg,
      theWoundsFellHim: foe.hp <= 0,
      killChance: killChance,
      roll: roll,
    },
    audience: { actor: c.player, realms: [c.player, foe.player].filter((x) => x != null), seen: 'battle' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  if (foe.hp <= 0 || roll <= killChance) {
    if (_escapesTheEnd(foe)) {
      foe.hp = Math.max(1, foe.hp);
      emit(turnContext, {
        type: 'combat',
        fact: _garrethEscapeLine(foe),
        audience: { actor: c.player, realms: [c.player].filter((x) => x != null), seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    } else {
      foe.hp = 0;
      reportHeroFall(
        turnContext,
        foe,
        c,
        { kind: 'a hero is slain outside a battle', heroName: foe.name, how: 'by the shot', killerName: null },
        {
          audience: { actor: c.player, realms: [c.player, foe.player].filter((x) => x != null), seen: 'battle' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        },
      );
      awardKillXP(turnContext, c, foe);
      c.merits = (c.merits || 0) + 2;
    }
  }
  trySkillGain(turnContext, c, 'archery', SKILLGAIN_STD);
  return;
}
// Feigned Retreat (Tactical 7): his counter-attack strikes harder this turn.
export function resolveFeignedRetreatOrder(turnContext: TurnContext, c: Character, prov: Province) {
  const { G } = turnContext;
  if (skillLevel(c, 'tactical') < 7) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero lacks the Tactical mastery for a Feigned Retreat', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  c._feignedRetreatTurn = G.turn;
  emit(turnContext, {
    type: 'combat',
    fact: { kind: 'a hero lays a Feigned Retreat', heroName: c.name },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  trySkillGain(turnContext, c, 'tactical', SKILLGAIN_STD);
  return;
}
// Grand Stratagem (Tactical 9): his next battle this turn is fought at greater strength.
export function resolveGrandStratagemOrder(turnContext: TurnContext, c: Character, prov: Province) {
  const { G } = turnContext;
  if (skillLevel(c, 'tactical') < 9) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero lacks the Tactical mastery for a Grand Stratagem', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  c._grandStratagemTurn = G.turn;
  emit(turnContext, {
    type: 'combat',
    fact: { kind: 'a hero sets a Grand Stratagem in motion', heroName: c.name },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  trySkillGain(turnContext, c, 'tactical', SKILLGAIN_STD);
  return;
}
// Lightning Advance (March 9): any enemy he attacks this turn is caught unready.
export function resolveLightningAdvanceOrder(turnContext: TurnContext, c: Character, prov: Province) {
  const { G } = turnContext;
  if (skillLevel(c, 'march') < 9) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero lacks the March mastery for a Lightning Advance', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  c._lightningAdvanceTurn = G.turn;
  emit(turnContext, {
    type: 'move',
    fact: { kind: 'a hero orders a Lightning Advance', heroName: c.name },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  trySkillGain(turnContext, c, 'march', SKILLGAIN_STD);
  return;
}
// Raid the Coast (Naval 9): an assault from the sea this turn strikes harder, and plunders the treasury it takes.
export function resolveRaidTheCoastOrder(turnContext: TurnContext, c: Character, prov: Province) {
  const { G } = turnContext;
  if (skillLevel(c, 'naval') < 9) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero lacks the Naval mastery to Raid the Coast', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (!(c.armies || []).some((a) => SEA_TYPES.has(a.type))) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a Raid the Coast must be led by a fleet', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  } // NAVAL L9: must lead a naval unit / sea creature
  c._raidCoastTurn = G.turn;
  emit(turnContext, {
    type: 'move',
    fact: { kind: 'a hero readies a Raid the Coast', heroName: c.name },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  trySkillGain(turnContext, c, 'naval', SKILLGAIN_STD);
  return;
}
