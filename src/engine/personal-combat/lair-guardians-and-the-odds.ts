// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcRng } from '../rng.ts';
import { monsterCat } from '../names.ts';
import { guardianCanUseItem, monsterCatLabel } from '../items/tiers-and-hoards.ts';
import { ensureLairHoard } from '../world/tables.ts';
import { _ITEM_ALT_BASE, isLegendaryItem } from '../rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';
import { guardianPassives } from '../heroes/skills-and-hp.ts';
import { pcArmourMerge, transferableItems } from './helpers.ts';
import { d100 } from '../dice-and-army-names.ts';
import { pushBattlecry } from '../battle/battle-report-lines-and-force-markers.ts';
import {
  autoEncounterPlan,
  pcApplyFx,
  pcCharCombatant,
  pcHasRanged,
  pcMonsterCombatant,
} from './speed-encounter-plans-and-combatants.ts';
import { resolvePersonalCombat } from './resolve-personal-combat.ts';
import { DUEL_FLEE_DROP } from './duels-and-character-encounters.ts';
import { narrateAll, narrate } from '../turn/events-and-their-audiences.ts';

// ── PERSONAL COMBAT: LAIR GUARDIANS AND THE ODDS (plan P1-08f: lifted out of resolveTurn) ────
// What a guardian's nature makes it weak or strong against (monsterTraits), the guardian as a combatant
// (pcBuildGuardian), the odds Hunting Rumours reads to a hero (simulateLairOdds, rumourOddsBand) and a hero's fight with
// a lair's guardian (resolveEncounter). pcBuildGuardian, simulateLairOdds and resolveEncounter take the turn's context
// first (src/engine/turn/context.ts); monsterTraits and rumourOddsBand read no turn state.
// Derive a monster's combat weaknesses/resistances and closing speed from its nature, so that
// different strategies suit different monsters (no single dominant encounter plan).
// mods.melee/archery/spell — <1 resists that approach, >1 is vulnerable to it
// pacifiable — a beast that Talk (Druid) can turn aside
// closeRounds — rounds to reach melee (fast 1 / medium 2 / slow 3): the archer's window
export function monsterTraits(m) {
  const n = (m.name || '').toLowerCase();
  const mods = { melee: 1, archery: 1, spell: 1 };
  // category-driven (name regex only refines flyers/armour and covers legacy saves).
  const cat = monsterCat(m);
  const undead = cat === 'undead';
  const demon = cat === 'fiend';
  const flyer =
    /harpy|wasp|bat|wyvern|eagle|roc\b|manticore|dragon|wyrm|drake|griffon|sprite|pixie|storm eagle|vulture|chimera|sphinx|banshee|dracolich|imp/.test(
      n,
    );
  const armoured =
    cat === 'giant' ||
    cat === 'construct' ||
    /knight|basilisk|rock|stone|gargoyle|ironclad|carapace|turtle|crab|colossus|mummif/.test(n);
  const beast = cat === 'beast' || cat === 'vermin';
  // Sept 2026 guardian balance pass: the melee swings were the main driver of tier outliers
  // (armoured giants and constructs at ×0.65 melee were effectively 50% tougher than their HP;
  // beasts at ×1.2 were paper). Narrowed to ×0.8 / ×1.1; the spell and arrow swings keep their
  // flavour.
  if (undead) {
    mods.spell += 0.5;
    mods.archery -= 0.3;
  } // magic-vulnerable, arrows pass through bone
  if (demon) {
    mods.spell += 0.3;
  } // holy/magic bites deeper (Holy Symbol also ×1.5)
  if (flyer) {
    mods.archery += 0.4;
  } // shot out of the sky
  if (armoured) {
    mods.melee -= 0.2;
    mods.spell += 0.3;
  } // blades turn aside; magic ignores armour
  if (beast && !undead) {
    mods.melee += 0.1;
  } // soft-bodied, blades bite
  // 2026-10-08 (Toby item 4): A GUARDIAN NEVER RESISTS AND IS WEAK TO THE SAME THING, and what is
  // on its card wins. These hidden multipliers are never shown to a player, so where one pushes
  // against the creature's passive (its hide turns blows, it shrugs off arrows or spells) or
  // against its weakness (arrows, a school of magic), the hidden one is dropped.
  {
    const _fxs = guardianPassives(m).map((p) => p.fx),
      w = m.weak || {},
      has = (k) => _fxs.some((fx) => fx.ward === k || fx[k]);
    if (has('meleeDR')) mods.melee = Math.min(1, mods.melee);
    if (has('arrowDR')) mods.archery = Math.min(1, mods.archery);
    if (has('spellPct')) mods.spell = Math.min(1, mods.spell);
    if (w.kind === 'archery') mods.archery = Math.max(1, mods.archery);
    if (w.kind === 'school') mods.spell = Math.max(1, mods.spell);
  }
  for (const k in mods) mods[k] = Math.max(0.4, Math.min(1.8, mods[k]));
  const pacifiable = beast && !undead && !demon;
  const closeRounds = { fast: 2, medium: 3, slow: 4 }[m.speed || 'medium'] || 3;
  return { mods, pacifiable, closeRounds };
}

// Resolves a full encounter between a character and a feature monster.
// All of the fighting is delegated to the unified personal-combat engine — this function
// handles only the framing (scene description) and the feature-level consequences
// (treasure stolen, monster cleared, hero slain).
// Returns {won, fled, damageToHero, heroHpAfter, heroKilled, narrative:[...strings]} ── THE
// GUARDIAN AS A COMBATANT (2026-09-17 (late)) ── factored out of resolveEncounter so the Hunting
// Rumours simulation builds the guardian EXACTLY as a real lair fight does — hoard items wielded,
// nature-based vulnerabilities, pacifiable flag. `m` may be the live feature.monster (a real
// fight) or a deep copy of it (a simulation); the hoard is read from the feature either way.
export function pcBuildGuardian(turnContext, feature, m, narrative) {
  const { G } = turnContext;
  narrative = narrative || [];
  const traits = monsterTraits(m);
  const mon = pcMonsterCombatant(m);
  // a guardian that can wield the hoard's magic brings it into the fight — skill items raise its
  // Melee/Archery/HP, combat-use items are drunk/read when the moment is right.
  ensureLairHoard(feature, G);
  {
    const _wield = (feature.hoardItems || []).filter((it) => guardianCanUseItem(m, it));
    if (_wield.length) {
      mon.wielded = _wield;
      mon.combatItems = [];
      mon._hpItemBonus = 0;
      _wield.forEach((it) => {
        const e = it.effect || {};
        if (e.stat === 'melee') mon.melee = (mon.melee || 0) + (e.bonus || 0);
        else if (e.stat === 'archery') mon.archery = (mon.archery || 0) + (e.bonus || 0);
        else if (e.stat === 'maxHp' && mon.hp >= mon.maxHp) {
          mon.maxHp += e.bonus;
          mon.hp += e.bonus;
          mon._hpItemBonus += e.bonus;
        } else if (e.stat === 'combatUse') mon.combatItems.push(it);
        else if (e.stat === 'armour') mon.arm = pcArmourMerge(mon.arm, e, it.name); // a guardian in the hoard's armour
        if (e.pc) pcApplyFx(mon, e.pc, it.name); // a guardian wearing a new rider item feels it too
        if ((_ITEM_ALT_BASE[it.name] || it.name) === 'Warbringer Gauntlets') mon.gauntlets = true;
      });
      narrate(narrative, {
        kind: "the guardian has turned the hoard's magic to its own use",
        mName: m.name,
        wieldedItemNames: _wield.map((x) => x.name).join(', '),
      });
    }
  }
  // The monster's nature decides what hurts it: blades, arrows or magic.
  mon.vuln = { melee: traits.mods.melee, archery: traits.mods.archery, spell: traits.mods.spell };
  mon.pacifiable = !!traits.pacifiable;
  return mon;
}

// ── HUNTING RUMOURS: THE ODDS (2026-09-17 (late), Toby item 3) ────
// "The likelihood the hero has of defeating the guardian" is MEASURED, not estimated: the real
// personal-combat engine fights the lair RUMOUR_SIM_FIGHTS times in the background, on deep
// copies of the hero and the guardian, and the kill rate is banded into one of five narrative
// lines. A kill is the only success — death, flight, a 20-round draw and a mercy plea all leave
// the guardian on its hoard. The hero fights as they stand TODAY (current HP, current kit, their
// own Encounter Plan if they have set one, else the standard plan an unordered character fights
// with).
//
// ISOLATION. Every combat write goes through `ref` (hp, mercy items, _mercyFledTurn, skill gains
// in trySkillGain, _selfHealUsed, _hpFull) — so both combatants are built from JSON copies with
// ids no live character carries. The two writes that reach OUTSIDE the refs are guarded here:
// `_pcSimulating` mutes trySkillGain, and pcLearnWeakness's realm-level record is snapshotted and
// restored, so a weakness that happens to bite in the sandbox teaches the realm nothing.
export const RUMOUR_SIM_FIGHTS = 300;
// (`_pcSimulating` itself is declared beside trySkillGain, above every call site, so it can never be read in its TDZ.)
export const RUMOUR_ODDS_BANDS = [
  // upper bound of the band (kill %), and the line read to the player
  {
    max: 20,
    text: (g) =>
      `the talk is grim: you would have no real chance against the ${g} — it would leave you in the dust with the rest`,
  },
  {
    max: 40,
    text: (g) =>
      `the odds are against you: the ${g} would most likely be the end of you, though a lucky hand might yet see it done`,
  },
  {
    max: 60,
    text: (g) => `it could go either way: you and the ${g} are evenly matched, and the dice will decide who walks out`,
  },
  { max: 80, text: (g) => `the odds favour you: you would likely bring the ${g} down, but not without real danger` },
  {
    max: 90,
    text: (g) => `the talk is confident: you should bring the ${g} down, though it could still cost you dearly`,
  }, // Sept 2026: the 80–90 band split out so a 90%+ reading exists
  {
    max: 101,
    text: (g) => `the talk is certain: you are all but sure to defeat the ${g} — only ill fortune could turn it`,
  },
];
export function rumourOddsBand(pct) {
  return RUMOUR_ODDS_BANDS.find((b) => pct < b.max) || RUMOUR_ODDS_BANDS[RUMOUR_ODDS_BANDS.length - 1];
}
export function simulateLairOdds(turnContext, c, feature, fights) {
  const { G } = turnContext;
  fights = fights || RUMOUR_SIM_FIGHTS;
  const m0 = feature && feature.monster;
  if (!c || !m0) return null;
  const pl = c.player != null ? G.players[c.player] : null;
  const _kwSnap = pl ? JSON.stringify(pl._knownWeak || {}) : null;
  const _prevSim = turnContext._pcSimulating;
  turnContext._pcSimulating = true;
  let wins = 0,
    ran = 0;
  try {
    const heroSrc = JSON.parse(JSON.stringify(c));
    // a plan of their own if set; else the standard unordered-character plan
    const ownPlan =
      c.encounterPlan && Array.isArray(c.encounterPlan.tactics) && c.encounterPlan.tactics.length
        ? c.encounterPlan.tactics.slice()
        : null;
    for (let i = 0; i < fights; i++) {
      const hc = JSON.parse(JSON.stringify(heroSrc));
      hc.id = 'rumour_sim_' + i; // no live character carries this id
      hc.encounterPlan = { tactics: ownPlan || autoEncounterPlan(turnContext, hc), duelStance: 'accept', _auto: true };
      const mc = JSON.parse(JSON.stringify(m0));
      if (mc._hpFull == null) mc._hpFull = mc.hp || 10;
      mc.hp = mc._hpFull;
      const hero = pcCharCombatant(turnContext, hc);
      hero.tactics = hc.encounterPlan.tactics.slice();
      hero._vsGuardian = true;
      const mon = pcBuildGuardian(turnContext, feature, mc, []);
      const res = resolvePersonalCombat(turnContext, hero, mon, { maxRounds: 20, feature });
      ran++;
      if (res && res.winner === hero && !res.fledBy && !res.parley && !res.stoleBy) wins++;
    }
  } catch (e) {
    console.warn('simulateLairOdds failed', e);
  } finally {
    turnContext._pcSimulating = _prevSim;
    if (pl) pl._knownWeak = JSON.parse(_kwSnap);
  }
  if (!ran) return null;
  return { pct: Math.round((100 * wins) / ran), wins, fights: ran };
}

export function resolveEncounter(turnContext, c, feature, prov, tactics, effStat, rng, player) {
  const { G } = turnContext;
  const m = feature.monster || { name: 'creature', hp: 10, power: '', minG: 1, maxG: 3 };
  const narrative = [];
  const startHp = c.hp || 10;
  const traits = monsterTraits(m);

  // ── Opening description ──
  const featureDescs = {
    'Ancient Battlefield': 'crosses the bones of a long-forgotten battle and stumbles upon',
    'Ruined Watchtower': 'climbs the crumbling stones of',
    'Goblin Camp': 'sneaks into the firelit clearing of',
    'Dragon Eyrie': 'ascends a treacherous cliff to the mouth of',
    'Buried Pyramid': 'descends into the dust-choked chambers of',
    'Haunted Grove': 'pushes through thorned branches into',
    'Lost City': 'wanders the weed-cracked streets of',
    default: 'approaches',
  };
  const entryVerb = featureDescs[feature.name] || featureDescs.default;
  narrate(narrative, {
    kind: 'the hero enters the feature',
    cName: c.name,
    entryVerb,
    featureName: feature.name,
    provName: prov.name,
  });
  const monsterPower = m.power || '';
  const powerDesc = monsterPower ? ` (${monsterPower})` : '';
  // Describe the creature by its FULL stature, not its current (possibly wounded) health, so the
  // description doesn't shrink just because someone else bloodied it earlier this turn.
  const monFullHp = m._hpFull != null ? m._hpFull : m.hp || 10;
  const monHp = m.hp != null ? m.hp : monFullHp;
  const monHpDesc =
    { Weak: 'a dangerous', Moderate: 'a formidable', Powerful: 'a fearsome', Legendary: 'a legendary' }[m.power] ||
    'a formidable'; // by tier (the old HP thresholds predate the rescale)
  narrate(narrative, {
    kind: 'within lurks the guardian blocking the path',
    monHpDesc,
    mName: m.name,
    wordsIfMonsterCatLabelM: monsterCatLabel(m) ? ` — ${monsterCatLabel(m).toLowerCase()}` : '',
    powerDesc,
  });
  if (monHp < monFullHp) {
    const frac = monHp / monFullHp;
    const woundDesc =
      frac <= 0.25
        ? 'grievously wounded and bleeding from a dozen cuts'
        : frac <= 0.5
          ? 'badly wounded, favouring one side'
          : 'nursing fresh wounds';
    narrate(narrative, {
      kind: 'the guardian is already wounded by someone before',
      woundDesc,
      cName: c.name,
      monHp,
      monFullHp,
    });
  }
  pushBattlecry(narrative, c, `the ${m.name}`);

  // ── Build both sides and hand the fight to the engine ──
  const hero = pcCharCombatant(turnContext, c);
  if (Array.isArray(tactics) && tactics.length) hero.tactics = tactics.slice();
  // this fight is against a lair guardian, so every blow the creature lands on the character is
  // held to PC_HIT_CAP_FRAC of their maximum HP (see pcTakeHit). Set on the CHARACTER's
  // combatant, so the cap can never apply to the hero's own blows, to a PvP duel, or to any fight
  // that has no guardian in it.
  hero._vsGuardian = true;
  const mon = pcBuildGuardian(turnContext, feature, m, narrative);
  narrate(narrative, {
    kind: "the guardian's speed and plan",
    mName: m.name,
    monSpeedName: mon.speedName,
    wordsIfMonSpeedNameFast: mon.speedName === 'fast' ? ' (it closes two ranges at a stride)' : '',
    wordsIfPcHasRangedMon: pcHasRanged(mon) ? ', and fights at range as well as close' : '',
    guardianTactics: mon.tactics.slice(0, 6).join(', '),
  });

  const res = resolvePersonalCombat(turnContext, hero, mon, { maxRounds: 20, feature });
  narrateAll(narrative, res.narrative);

  // ── Outcome ──
  let won = false,
    fled = false;
  if (res.parley) {
    won = true;
    narrate(narrative, { kind: 'after tense negotiations the guardian agrees', mName: m.name });
  } else if (res.stoleBy === hero) {
    // Escaped with the loot: the hero withdraws safely but the creature still holds the site.
    fled = true;
    m._treasureStolen = true;
    narrate(narrative, { kind: 'the hero slips away with the prize', cName: c.name, mName: m.name });
  } else if (res.fledBy === hero) {
    fled = true;
    narrate(narrative, { kind: 'the hero turns and flees from the guardian', cName: c.name, mName: m.name });
    // a character who flees a lair guardian has the same DUEL_FLEE_DROP chance of dropping one
    // magic item in the scramble as when fleeing a duel. Anything dropped joins the lair's
    // hoardItems — it is treasure for whoever finally clears the lair, and the guardian wields it
    // in every later fight (the wield block above rebuilds from hoardItems on each encounter).
    {
      const _realC = (c && c.id != null && (G.characters || []).find((r) => r && r.id === c.id)) || c;
      const _pool = transferableItems(_realC.items || []);
      if (_pool.length) {
        const _roll = d100(),
          _chance = Math.round(DUEL_FLEE_DROP * 100);
        narrate(narrative, {
          kind: 'the runner scrambles clear with a chance of dropping something',
          runnerName: c.name,
          chance: _chance,
          roll: _roll,
          rollChanceMark: _roll <= _chance ? ' ✓' : ' ✗',
        });
        if (_roll <= _chance) {
          const _it = _pool[Math.floor(kcRng() * _pool.length)];
          _realC.items = (_realC.items || []).filter((x) => x !== _it);
          if (c !== _realC && Array.isArray(c.items))
            c.items = c.items.filter((x) => x !== _it && !(x && x.name === _it.name && x.tier === _it.tier));
          delete _it.equipped;
          ensureLairHoard(feature, G);
          feature.hoardItems = (feature.hoardItems || []).concat([_it]);
          narrate(narrative, {
            kind: 'in the rout the hero drops an item into the hoard',
            cName: c.name,
            itName: _it.name,
            wordsIfIsLegendaryItemIt: isLegendaryItem(_it) ? ' (Legendary)' : '',
            mName: m.name,
            wordsIfGuardianCanUseItemMIt: guardianCanUseItem(m, _it)
              ? ', and the beast will turn it against the next intruder'
              : '',
          });
        }
      }
    }
  } else if (res.winner === hero) {
    won = true;
    narrate(narrative, {
      kind: 'with a final effort the guardian is defeated',
      blowOrBurst: rng(0, 1) ? 'decisive blow' : 'burst of effort',
      mName: m.name,
    });
  } else if (res.winner === mon) {
    narrate(narrative, { kind: 'the hero falls to their knees overwhelmed', cName: c.name, mName: m.name });
  } else {
    narrate(narrative, {
      kind: 'neither the hero nor the guardian gains the upper hand',
      cName: c.name,
      mName: m.name,
      cName2: c.name,
    });
  }

  // ── 2026-09-10: the guardian heals to FULL at the end of every combat. Wounds no longer carry
  // between searches in a turn — each challenger faces the creature whole.
  if (!won && m) {
    if (m._hpFull == null) m._hpFull = m.hp || 10;
    m.hp = m._hpFull;
    if (res.bHp != null && res.bHp < mon.maxHp - (mon._hpItemBonus || 0))
      narrate(narrative, { kind: 'the guardian draws back into its lair', mName: m.name });
  }

  const heroHp = res.aHp;
  c.hp = Math.max(0, heroHp);
  const heroKilled = heroHp <= 0;
  const damageToHero = Math.max(0, startHp - heroHp);
  return { won, fled, damageToHero, heroHpAfter: Math.max(0, heroHp), heroKilled, narrative };
}
