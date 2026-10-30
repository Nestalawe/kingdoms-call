import { kcRng } from '../rng.ts';
import { monsterCat } from '../names.ts';
import { guardianCanUseItem } from '../items/tiers-and-hoards.ts';
import { ensureLairHoard } from '../world/tables.ts';
import { isLegendaryItem } from '../rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';
import {
  anItemIsACombatItem,
  anItemIsWornAsArmour,
  whatAHoardsItemDoesForTheGuardianWhoWieldsIt,
} from '../rules/the-registry-of-magic-item-effects.ts';
import { guardianPassives } from '../heroes/skills-and-hp.ts';
import { pcArmourMerge, transferableItems } from './helpers.ts';
import { asItsGuardReadsIt } from './to-hit-wounds-stuns-and-courage.ts';
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
import {
  aGuardianAsItsKindIsRead,
  aListAsTheLineTellsIt,
  theNamesAsTheLineTellsThem,
} from './the-facts-a-personal-combats-lines-record.ts';
import type { TurnContext } from '../turn/context.ts';
import type { NarrativeLine } from '../turn/events-and-their-audiences.ts';
import type { Character, Item } from '../../schemas/saved-game-state.ts';
import type { AGuardianAsHisFighterIsBuilt, AHeroAsAFightTakesHim } from './helpers.ts';

/** A guardian as its traits are read (monsterTraits): its name, kind, perks, weakness and speed. */
type AGuardianAsItsTraitsAreRead = Pick<
  AGuardianAsHisFighterIsBuilt,
  'name' | 'cat' | 'passives' | 'passive' | 'weak' | 'speed'
>;
/** A perk's riders as the hidden multipliers test them: its ward, or the ward's own field. */
interface APerksRidersAsTheTraitsTestThem {
  readonly ward?: string | undefined;
  readonly meleeDR?: unknown;
  readonly arrowDR?: unknown;
  readonly spellPct?: unknown;
}
/** A lair's guardian as a fight at his lair reads and writes him (pcBuildGuardian, simulateLairOdds, resolveEncounter):
 *  a lair's guardian, a copy of one, or the creature a lair of none is fought as. His hit points are written back after
 *  a fight, and his treasure marked stolen. */
interface ALairsGuardian extends AGuardianAsHisFighterIsBuilt {
  readonly name: string;
  hp?: number | undefined;
  _hpFull?: number | null | undefined;
  readonly minG?: number | undefined;
  readonly maxG?: number | undefined;
  _treasureStolen?: boolean | undefined;
}
/** A lair as its guardian is fought there (pcBuildGuardian, simulateLairOdds): its guardian and the hoard he takes up,
 *  which ensureLairHoard stocks first (a stocked hoard is marked `_hoardV2`; a ritual site has none). */
interface ALairAsItsGuardianIsFoughtThere {
  readonly name?: string | undefined;
  readonly monster?: ALairsGuardian | null | undefined;
  readonly _hoardV2?: boolean | undefined;
  readonly ritualSite?: boolean | undefined;
  hoardItems?: Item[] | null | undefined;
}
/** A lair as a hero fights its guardian there (resolveEncounter): its name, its guardian and its hoard. */
interface ALairAsAHeroFightsAtIt extends ALairAsItsGuardianIsFoughtThere {
  readonly name: string;
}
/** A hero as the rout's dropped item reads him: his items, guarded (a hero an untyped caller stages may have none). */
interface AHeroAsTheRoutsDropGuardsHim {
  items?: Item[] | null | undefined;
}
/** A hoard's item as the guardian who wields it reads its effect (an item an untyped caller stages may have none). */
interface AnItemAsItsEffectIsGuarded {
  readonly effect?: Item['effect'] | null | undefined;
}

/** A copy of `value` made through JSON, as the Hunting Rumours fight on: the copy has the original's type once
 *  `itsJsonIsTheOriginals` has found its JSON the same as the original's (Theo's form, 2026-10-30, plan P1-10b14). */
function aCopyMadeThroughJson<Value>(value: Value): Value {
  const copy: unknown = JSON.parse(JSON.stringify(value));
  if (!itsJsonIsTheOriginals(copy, value)) throw new Error('a copy made through JSON differs from its original');
  return copy;
}
/** Whether a copy's JSON is its original's: the check that types a copy made through JSON as its original. */
function itsJsonIsTheOriginals<Value>(copy: unknown, original: Value): copy is Value {
  return JSON.stringify(copy) === JSON.stringify(original);
}

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
export function monsterTraits(m: AGuardianAsItsTraitsAreRead) {
  const n = (m.name ?? '').toLowerCase();
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
    // guardianPassives keeps only the perks that have riders, so each `fx` is there
    const _fxs: readonly (APerksRidersAsTheTraitsTestThem | null | undefined)[] = guardianPassives(m).map((p) => p.fx),
      kind = m.weak?.kind,
      has = (k: 'meleeDR' | 'arrowDR' | 'spellPct') => _fxs.some((fx) => fx?.ward === k || fx?.[k]);
    if (has('meleeDR')) mods.melee = Math.min(1, mods.melee);
    if (has('arrowDR')) mods.archery = Math.min(1, mods.archery);
    if (has('spellPct')) mods.spell = Math.min(1, mods.spell);
    if (kind === 'archery') mods.archery = Math.max(1, mods.archery);
    if (kind === 'school') mods.spell = Math.max(1, mods.spell);
  }
  const approaches: readonly (keyof typeof mods)[] = ['melee', 'archery', 'spell']; // the order `for (k in mods)` read
  for (const k of approaches) mods[k] = Math.max(0.4, Math.min(1.8, mods[k]));
  const pacifiable = beast && !undead && !demon;
  // the table read by any speed; it holds no 0, so `?? 3` gives what `|| 3` gave
  const closeRoundsBySpeed: Readonly<Partial<Record<string, number>>> = { fast: 2, medium: 3, slow: 4 };
  const closeRounds = closeRoundsBySpeed[(m.speed ?? '') || 'medium'] ?? 3;
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
export function pcBuildGuardian(
  turnContext: Pick<TurnContext, 'G'>,
  feature: ALairAsItsGuardianIsFoughtThere,
  m: ALairsGuardian,
  narrative?: NarrativeLine[] | null,
) {
  const { G } = turnContext;
  narrative ??= [];
  const traits = monsterTraits(m);
  const mon = pcMonsterCombatant(m);
  // a guardian that can wield the hoard's magic brings it into the fight — skill items raise its
  // Melee/Archery/HP, combat-use items are drunk/read when the moment is right.
  ensureLairHoard(feature, G);
  {
    const _wield = (feature.hoardItems ?? []).filter((it) => guardianCanUseItem(m, it));
    if (_wield.length) {
      mon.wielded = _wield;
      const combatItems: Item[] = [];
      mon.combatItems = combatItems;
      mon._hpItemBonus = 0;
      _wield.forEach((it) => {
        const theItemAsGuarded: AnItemAsItsEffectIsGuarded = it;
        const e: Partial<Item['effect']> = theItemAsGuarded.effect ?? {};
        const _does = whatAHoardsItemDoesForTheGuardianWhoWieldsIt(it); // its hit points and its gauntlets: the items' registry (plan P1-19s)
        if (e.stat === 'melee') mon.melee = (mon.melee || 0) + (Number(e.bonus) || 0);
        else if (e.stat === 'archery') mon.archery = (mon.archery || 0) + (Number(e.bonus) || 0);
        else if (_does.theHpItAddsAtFullHealth !== undefined && mon.hp >= mon.maxHp) {
          mon.maxHp += _does.theHpItAddsAtFullHealth;
          mon.hp += _does.theHpItAddsAtFullHealth;
          mon._hpItemBonus = (mon._hpItemBonus ?? 0) + _does.theHpItAddsAtFullHealth; // 0 above, a number since
        } else if (anItemIsACombatItem(it)) combatItems.push(it);
        else if (anItemIsWornAsArmour(it)) mon.arm = pcArmourMerge(mon.arm, e, it.name); // a guardian in the hoard's armour
        if (e.pc) pcApplyFx(mon, e.pc, it.name); // a guardian wearing a new rider item feels it too
        if (_does.itDrivesHisBlowsHome) mon.gauntlets = true;
      });
      narrate(narrative, {
        kind: "the guardian has turned the hoard's magic to its own use",
        mName: m.name,
        wieldedItemNames: theNamesAsTheLineTellsThem(_wield),
      });
    }
  }
  // The monster's nature decides what hurts it: blades, arrows or magic.
  mon.vuln = { melee: traits.mods.melee, archery: traits.mods.archery, spell: traits.mods.spell };
  mon.pacifiable = traits.pacifiable;
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
    text: (g: string) =>
      `the talk is grim: you would have no real chance against the ${g} — it would leave you in the dust with the rest`,
  },
  {
    max: 40,
    text: (g: string) =>
      `the odds are against you: the ${g} would most likely be the end of you, though a lucky hand might yet see it done`,
  },
  {
    max: 60,
    text: (g: string) =>
      `it could go either way: you and the ${g} are evenly matched, and the dice will decide who walks out`,
  },
  {
    max: 80,
    text: (g: string) => `the odds favour you: you would likely bring the ${g} down, but not without real danger`,
  },
  {
    max: 90,
    text: (g: string) => `the talk is confident: you should bring the ${g} down, though it could still cost you dearly`,
  }, // Sept 2026: the 80–90 band split out so a 90%+ reading exists
  {
    max: 101,
    text: (g: string) =>
      `the talk is certain: you are all but sure to defeat the ${g} — only ill fortune could turn it`,
  },
];
export function rumourOddsBand(pct: number) {
  return RUMOUR_ODDS_BANDS.find((b) => pct < b.max) ?? RUMOUR_ODDS_BANDS[RUMOUR_ODDS_BANDS.length - 1];
}
export function simulateLairOdds(
  turnContext: TurnContext,
  c: Character | null | undefined,
  feature: ALairAsAHeroFightsAtIt | null | undefined,
  fights?: number,
) {
  const { G } = turnContext;
  fights = (fights ?? 0) || RUMOUR_SIM_FIGHTS; // 0 and NaN fight the full count, as `||` gave
  const m0 = feature?.monster;
  if (!c || !feature || !m0) return null; // no lair, no guardian: `feature && feature.monster` gave none
  const pl = c.player != null ? G.players[c.player] : null;
  const knownWeakBefore = pl ? aCopyMadeThroughJson(pl._knownWeak ?? {}) : null;
  const _prevSim = turnContext._pcSimulating;
  turnContext._pcSimulating = true;
  let wins = 0,
    ran = 0;
  try {
    const heroSrc = aCopyMadeThroughJson(c);
    // a plan of their own if set; else the standard unordered-character plan
    const ownTactics = c.encounterPlan?.tactics;
    const ownPlan = Array.isArray(ownTactics) && ownTactics.length ? ownTactics.slice() : null;
    for (let i = 0; i < fights; i++) {
      // the copy's id is a string: the fighter's hero may be such a copy (AHeroAsAFightTakesHim)
      const hc: AHeroAsAFightTakesHim = aCopyMadeThroughJson(heroSrc);
      hc.id = `rumour_sim_${String(i)}`; // no live character carries this id
      hc.encounterPlan = { tactics: ownPlan ?? autoEncounterPlan(turnContext, hc), duelStance: 'accept', _auto: true };
      const mc = aCopyMadeThroughJson(m0);
      mc._hpFull ??= (mc.hp ?? 0) || 10;
      mc.hp = mc._hpFull;
      const hero = pcCharCombatant(turnContext, hc);
      const tactics = hc.encounterPlan.tactics;
      if (!tactics) throw new TypeError("Cannot read properties of undefined (reading 'slice')"); // set just above
      hero.tactics = tactics.slice();
      hero._vsGuardian = true;
      const mon = pcBuildGuardian(turnContext, feature, mc, []);
      const res = asItsGuardReadsIt(resolvePersonalCombat(turnContext, hero, mon, { maxRounds: 20, feature }));
      ran++;
      if (res?.winner === hero && !res.fledBy && !res.parley && !res.stoleBy) wins++;
    }
  } catch (e) {
    console.warn('simulateLairOdds failed', e);
  } finally {
    turnContext._pcSimulating = _prevSim;
    if (pl && knownWeakBefore) pl._knownWeak = aCopyMadeThroughJson(knownWeakBefore);
  }
  if (!ran) return null;
  return { pct: Math.round((100 * wins) / ran), wins, fights: ran };
}

export function resolveEncounter(
  turnContext: TurnContext,
  c: Character,
  feature: ALairAsAHeroFightsAtIt,
  prov: { readonly name: string },
  tactics: string[] | null | undefined,
  effStat: unknown,
  rng: (min: number, max: number) => number,
  player: unknown,
) {
  const { G } = turnContext;
  const m: ALairsGuardian = feature.monster ?? { name: 'creature', hp: 10, power: '', minG: 1, maxG: 3 };
  const narrative: NarrativeLine[] = [];
  const startHp = c.hp || 10;
  const traits = monsterTraits(m);

  // ── Opening description ──
  narrate(narrative, {
    kind: 'the hero enters the feature',
    cName: c.name,
    featureName: feature.name,
    provName: prov.name,
  });
  const monsterPower = m.power ?? '';
  // Describe the creature by its FULL stature, not its current (possibly wounded) health, so the
  // description doesn't shrink just because someone else bloodied it earlier this turn.
  const monFullHp = m._hpFull ?? ((m.hp ?? 0) || 10);
  const monHp = m.hp ?? monFullHp;
  narrate(narrative, {
    kind: 'within lurks the guardian blocking the path',
    mPower: m.power,
    mName: m.name,
    mKind: aGuardianAsItsKindIsRead(m),
    monsterPower,
  });
  if (monHp < monFullHp) {
    narrate(narrative, {
      kind: 'the guardian is already wounded by someone before',
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
    monFightsAtRange: pcHasRanged(mon),
    guardianTactics: aListAsTheLineTellsIt(mon.tactics.slice(0, 6)),
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
      // read as the guards read them (a hero or a world an untyped caller stages may hold no id or list)
      const theHeroAsGuarded: { readonly id?: Character['id'] | null | undefined } = c;
      const theStateAsGuarded: { readonly characters?: readonly (Character | null | undefined)[] | null | undefined } =
        G;
      const theRealHero =
        theHeroAsGuarded.id != null ? (theStateAsGuarded.characters ?? []).find((r) => r?.id === c.id) : undefined;
      const _realC: AHeroAsTheRoutsDropGuardsHim = theRealHero ?? c; // a hero found is an object: `||` gave him
      const _pool = transferableItems(_realC.items ?? []);
      if (_pool.length) {
        const _roll = d100(),
          _chance = Math.round(DUEL_FLEE_DROP * 100);
        narrate(narrative, {
          kind: 'the runner scrambles clear with a chance of dropping something',
          runnerName: c.name,
          chance: _chance,
          roll: _roll,
        });
        if (_roll <= _chance) {
          const _it = _pool[Math.floor(kcRng() * _pool.length)];
          if (!_it) throw new TypeError('Cannot convert undefined or null to object'); // the index is within the pool
          _realC.items = (_realC.items ?? []).filter((x) => x !== _it);
          if (c !== _realC && Array.isArray(c.items))
            c.items = c.items.filter(
              (x: Item | null | undefined) => x !== _it && !(x?.name === _it.name && x.tier === _it.tier),
            );
          delete _it.equipped;
          ensureLairHoard(feature, G);
          feature.hoardItems = (feature.hoardItems ?? []).concat([_it]);
          narrate(narrative, {
            kind: 'in the rout the hero drops an item into the hoard',
            cName: c.name,
            itName: _it.name,
            itIsLegendary: isLegendaryItem(_it),
            mName: m.name,
            theGuardianCanUseIt: guardianCanUseItem(m, _it),
          });
        }
      }
    }
  } else if (res.winner === hero) {
    won = true;
    narrate(narrative, {
      kind: 'with a final effort the guardian is defeated',
      aDecisiveBlow: rng(0, 1),
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
  if (!won) {
    // m is the lair's guardian or the stand-in above: never missing
    m._hpFull ??= (m.hp ?? 0) || 10;
    m.hp = m._hpFull;
    const theGuardiansHp = asItsGuardReadsIt(res.bHp);
    if (theGuardiansHp != null && theGuardiansHp < mon.maxHp - (Number(mon._hpItemBonus) || 0))
      narrate(narrative, { kind: 'the guardian draws back into its lair', mName: m.name });
  }

  const heroHp = res.aHp;
  c.hp = Math.max(0, heroHp);
  const heroKilled = heroHp <= 0;
  const damageToHero = Math.max(0, startHp - heroHp);
  return { won, fled, damageToHero, heroHpAfter: Math.max(0, heroHp), heroKilled, narrative };
}
