// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcRng } from '../rng.ts';
import { isLegendaryItem } from '../rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';
import { activeItems, gainedItemNote } from '../items/equipment.ts';
import { transferableItems } from './helpers.ts';
import { d100 } from '../dice-and-army-names.ts';
import { perkTier } from '../titles/perks.ts';
import { pushBattlecry } from '../battle/battle-report-lines-and-force-markers.ts';
import { pcCharCombatant } from './speed-encounter-plans-and-combatants.ts';
import { resolvePersonalCombat } from './resolve-personal-combat.ts';

// ── PERSONAL COMBAT: DUELS AND CHARACTER ENCOUNTERS (plan P1-08f: lifted out of resolveTurn) ────
// The magic items a fighter brings to bear (magicItemsLine), the item a character may drop when they break off a fight
// with another character (duelFleeItemDrop), a duel between two commanders (resolveDuel) and a character's Encounter
// with another character (resolveCharVsChar). duelFleeItemDrop, resolveDuel and resolveCharVsChar take the turn's
// context first (src/engine/turn/context.ts); magicItemsLine reads no turn state.
// which magic items a combatant brings to bear — announced at the start of a battle or duel so
// every item "in play" is acknowledged (passive stat items boost the fight; Mithril also calls
// out each blow it turns aside, see pcTakeHit). Only combat-relevant effects are listed.
export const _COMBAT_ITEM_STATS = new Set([
  'melee',
  'archery',
  'druid',
  'tactical',
  'mithrilArmour',
  'armour',
  'maxHp',
  'white',
  'black',
  'pagan',
  'psychic',
  'elemental',
  'illusory',
  'necromancy',
  'spellcasting',
  'pc',
  'combatUse',
]); // + illusory, pc riders, combat-item riders. consumables
export function magicItemsLine(ch) {
  const its = activeItems(ch).filter(
    (it) => it && it.name && (!it.effect || _COMBAT_ITEM_STATS.has(it.effect.stat) || it.effect.combat),
  );
  if (!its.length) return null;
  return `  ⚜ ${ch.name} bears ${its.map((it) => it.name + (isLegendaryItem(it) ? ' (Legendary)' : '')).join(', ')} into the fight.`;
}
// ── FLEE SPOILS ── A character who breaks off a duel or an Encounter against another character
// has a DUEL_FLEE_DROP chance of dropping one magic item in the scramble; the character who held
// the field keeps it. Mithril never drops (granted relic). Both ends are resolved on the REAL
// character records since fights are often fought on pooled copies. Returns the item or null.
export const DUEL_FLEE_DROP = 0.5; // 2026-09-10 item 2: raised 30% → 50%; the same odds apply to a flight from a lair guardian (lairFleeItemDrop)
export function duelFleeItemDrop(turnContext, runnerCbt, stayerCbt, narrative) {
  const { G } = turnContext;
  if (!runnerCbt || !stayerCbt || runnerCbt.kind !== 'character' || stayerCbt.kind !== 'character') return null;
  const _real = (x) => (x && x.id != null && (G.characters || []).find((r) => r && r.id === x.id)) || x;
  const runner = _real(runnerCbt.ref),
    stayer = _real(stayerCbt.ref);
  if (!runner || !stayer || runner === stayer) return null;
  const pool = transferableItems(runner.items || []);
  if (!pool.length) return null;
  const roll = d100(),
    chance = Math.round(DUEL_FLEE_DROP * 100);
  narrative.push(
    `  ${runner.name} scrambles clear — ${chance}% chance of dropping something in the rout [roll ${roll}${roll <= chance ? ' ✓' : ' ✗'}]`,
  );
  if (roll > chance) return null;
  const it = pool[Math.floor(kcRng() * pool.length)];
  runner.items = (runner.items || []).filter((x) => x !== it);
  if (runnerCbt.ref !== runner && Array.isArray(runnerCbt.ref.items))
    runnerCbt.ref.items = runnerCbt.ref.items.filter(
      (x) => x !== it && !(x && it && x.name === it.name && x.tier === it.tier),
    ); // keep the battle copy in step
  delete it.equipped; // re-slotted by normaliseEquipment on the new owner
  stayer.items = (stayer.items || []).concat([it]);
  if (stayerCbt.ref !== stayer && Array.isArray(stayerCbt.ref.items))
    stayerCbt.ref.items = stayerCbt.ref.items.concat([it]);
  narrative.push(
    `  💎 In the rout ${runner.name} drops ${it.name}${isLegendaryItem(it) ? ' (Legendary)' : ''} — ${stayer.name} claims it.`,
  );
  {
    const _gn = gainedItemNote(stayer, [it]);
    if (_gn) narrative.push('  ' + _gn);
  } // item 10
  return it;
}
export function resolveDuel(turnContext, atk, def, narrative) {
  const _ia = magicItemsLine(atk),
    _ib = magicItemsLine(def); // item 5
  if (_ia) narrative.push(_ia);
  if (_ib) narrative.push(_ib);
  const A = pcCharCombatant(turnContext, atk),
    B = pcCharCombatant(turnContext, def);
  turnContext._duelFoes = new Map([
    [atk.id, String(def.name || '').replace(/\s*\(wandering\)/i, '')],
    [def.id, String(atk.name || '').replace(/\s*\(wandering\)/i, '')],
  ]); // item 6
  let res;
  try {
    res = resolvePersonalCombat(turnContext, A, B, { maxRounds: 20, heldFieldWins: true });
  } finally {
    turnContext._duelFoes = null;
  } // a duel's field held is a win (preBattleDuel awards it)
  narrative.push(...res.narrative);
  if (res.fledBy) {
    const runner = res.fledBy.ref,
      stayer = runner === atk ? def : atk;
    narrative.push(`${runner.name} breaks off the duel and slips away — ${stayer.name} holds the field.`);
    duelFleeItemDrop(turnContext, res.fledBy, res.fledBy === A ? B : A, narrative); // flee spoils
    // Nobody is slain, but breaking off IS losing the duel — the caller demoralises their force.
    return { fled: runner, heldField: stayer };
  }
  return { winner: res.winner ? res.winner.ref : null, loser: res.loser ? res.loser.ref : null };
}

// ── ENCOUNTER ENGINE (AK 5.0–5.8) ────
// Resolves a full encounter between a character and a feature monster. Returns {won, fled,
// damageToHero, narrative:[...strings]} Character vs Character encounter (triggered by 'Encounter
// Character' order). Runs on the unified personal-combat engine — identical rounds, ranges and
// alternation to duels and monster encounters. The only difference is who is on the other side.
export function resolveCharVsChar(turnContext, atk, def, atkTactics, defTactics, prov, effStat, rng, G) {
  const narrative = [];
  narrative.push(
    `${atk.name} (${atk.race}, ${atk.temper}) meets ${def.name} (${def.race}, ${def.player !== null ? G.players[def.player]?.name : 'wandering'}) in a personal encounter.`,
  );
  pushBattlecry(narrative, atk, def.name);
  pushBattlecry(narrative, def, atk.name);

  const A = pcCharCombatant(turnContext, atk),
    B = pcCharCombatant(turnContext, def);
  if (Array.isArray(atkTactics) && atkTactics.length) A.tactics = atkTactics.slice();
  if (Array.isArray(defTactics) && defTactics.length) B.tactics = defTactics.slice();

  const res = resolvePersonalCombat(turnContext, A, B, { maxRounds: 20 });
  narrative.push(...res.narrative);

  // A successful Steal in a character encounter is a pickpocketing of the victim's treasury.
  // THIEF L8: a master thief's own purse cannot be picked.
  const _pickProof = (x) => perkTier(x, 'thief') >= 3;
  if (res.stoleBy === A && def.player !== null && atk.player !== null && _pickProof(def)) {
    narrative.push(
      `${atk.name} goes for ${def.name}'s purse and comes away with nothing — a master thief keeps their own coin far better hidden.`,
    );
  } else if (res.stoleBy === B && atk.player !== null && def.player !== null && _pickProof(atk)) {
    narrative.push(
      `${def.name} goes for ${atk.name}'s purse and comes away with nothing — a master thief keeps their own coin far better hidden.`,
    );
  } else if (res.stoleBy === A && def.player !== null && atk.player !== null) {
    const purse = G.players[def.player]?.gold || 0;
    const stolen = Math.min(purse, rng(1, 5));
    if (stolen > 0) {
      G.players[def.player].gold -= stolen;
      G.players[atk.player].gold = (G.players[atk.player].gold || 0) + stolen;
      narrative.push(`${atk.name} lifts ${stolen}g from ${def.name}'s purse and is gone.`);
    } else narrative.push(`${atk.name} finds ${def.name}'s purse empty.`);
  } else if (res.stoleBy === B && atk.player !== null && def.player !== null) {
    const purse = G.players[atk.player]?.gold || 0;
    const stolen = Math.min(purse, rng(1, 5));
    if (stolen > 0) {
      G.players[atk.player].gold -= stolen;
      G.players[def.player].gold = (G.players[def.player].gold || 0) + stolen;
      narrative.push(`${def.name} lifts ${stolen}g from ${atk.name}'s purse and is gone.`);
    }
  }
  if (res.fledBy) {
    narrative.push(`${res.fledBy.name} breaks away and escapes the encounter.`);
    duelFleeItemDrop(turnContext, res.fledBy, res.fledBy === A ? B : A, narrative);
  } // flee spoils

  const atkHp = res.aHp,
    defHp = res.bHp;
  // A felled commander is not always slain — a third of the time the fight ends in capitulation
  // rather than death. Kings are always spared this way.
  let atkKilled = false,
    defKilled = false;
  if (atkHp <= 0) {
    narrative.push(`${atk.name} is overwhelmed!`);
    atkKilled = atk.isKing ? false : kcRng() < 0.3;
  }
  if (defHp <= 0) {
    narrative.push(`${def.name} is overcome!`);
    defKilled = !def.isKing && def.player !== null && kcRng() < 0.3;
  }

  return { atkHp, defHp, atkKilled, defKilled, narrative };
}
