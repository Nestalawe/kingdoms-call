import {
  ALL_MAGIC_ITEMS_P,
  KC_ITEM_SLOT_CAP,
  LEGENDARY_ITEMS_P,
  _VARIANT_BANK,
} from '../../content/kingdoms-call-data.ts';
import { SKILL_LABELS } from '../army-tables.ts';
import { HOARD_CATEGORIES } from './hoard-categories.ts';
import { kcRng } from '../rng.ts';
import {
  anItemIsACombatItem,
  theRoleAnItemsEffectsGiveIt,
  theTemperAHerosItemsGiveHim,
  theWorthOfACombatUse,
  theWorthOfAnItemsEffect,
  theWorthOfAnItemsRiders,
  theWorthOfAWard,
} from '../rules/the-registry-of-magic-item-effects.ts';
import {
  ITEMS_BY_TIER,
  ITEM_LORE_BY_NAME,
  itemHoardCategory,
  lairItemTier,
  preferFreshEffects,
} from './tiers-and-hoards.ts';
import {
  _ITEM_ALT_BASE,
  isLegendaryItem,
  itemSlot,
  itemUsableBy,
} from '../rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';
import type {
  ItemOfTheseRules,
  RaceAndAlignment,
} from '../rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';

// Its types (plan P1-10b10): each parameter typed as wide as the body's guards (plan P1-10's Decision 2), so each guard
// stays. The load-time pass reads the content's rows through one wide shape (AnItemOfTheTreasury), and a table read by
// any name is read through a typed local inside its function.
/** A magic item of the content's tables (ALL_MAGIC_ITEMS_P, with the clones tiers-and-hoards.ts adds). */
type AMagicItem = (typeof ALL_MAGIC_ITEMS_P)[number];
/** A ward as the scores read it: an armour's effect, or a rider's. */
interface AWardAsTheScoresReadIt {
  readonly ward?: string | undefined;
  readonly amt?: number | undefined;
  readonly pct?: number | undefined;
}
/** A rider (an effect's `pc`) as the scores read it. */
interface ARiderAsTheScoresReadIt extends AWardAsTheScoresReadIt {
  readonly hitBonus?: number | undefined;
  readonly dmgBonus?: number | undefined;
  readonly burn?: number | undefined;
  readonly drain?: number | undefined;
  readonly aura?: number | undefined;
}
/** An item's effect as the roles, the scores, the skills and the temper read it: each field they read that a content
 *  row's or a saved copy's effect may set, each optional (the saved item's schema allows a 0 in any of them). */
export interface AnEffectAsTheseRulesReadIt extends AWardAsTheScoresReadIt {
  readonly stat?: string | undefined;
  readonly bonus?: number | undefined;
  readonly spell?: string | undefined;
  readonly temper?: string | undefined;
  readonly pc?: ARiderAsTheScoresReadIt | null | undefined;
  readonly use?: string | undefined;
  readonly rounds?: number | undefined;
  readonly dmg?: readonly number[] | undefined;
  readonly times?: number | undefined;
  readonly dot?: readonly number[] | undefined;
  readonly stun?: number | undefined;
  readonly hitPen?: number | undefined;
  readonly melee?: number | undefined;
  readonly archery?: number | undefined;
  readonly hitBonus?: number | undefined;
  readonly absorb?: number | undefined;
  readonly reflect?: number | undefined;
  readonly images?: number | undefined;
  readonly fleeBonus?: number | undefined;
  readonly toHitReduce?: number | undefined;
}
/** An item as the roles and the scores read it: these rules' item, and its effect as they read it (or none). */
interface AnItemAsItsWorthIsRead extends ItemOfTheseRules {
  readonly effect?: AnEffectAsTheseRulesReadIt | null | undefined;
}
/** A magic item of the treasury as the load-time pass reads and writes it: a content row (ALL_MAGIC_ITEMS_P, the
 *  relics of LEGENDARY_ITEMS_P, the minted versions) through one wide shape, with the marks the pass writes on it. */
interface AnItemOfTheTreasury extends AnItemAsItsWorthIsRead {
  tier: number;
  slot?: string | undefined;
  readonly lore?: string | undefined;
  _variantOf?: string | undefined;
  _score?: number | undefined;
  _drop?: boolean | undefined;
}
/** A bank of names a kind of item is minted from (_VARIANT_BANK's rows; a weapon's has its bows' and staves' too). */
interface ABankOfNames {
  readonly adj: readonly string[];
  readonly noun: readonly string[];
}
/** An item as the slots read and write it: these rules' item, its effect as they read it, and whether it is worn. */
export interface AnItemAsTheSlotsReadIt extends AnItemAsItsWorthIsRead {
  equipped?: boolean | undefined;
}
/** A hero as his items are read: his race and alignment, and the items he carries (a gap among them, or none, in an
 *  older save). The items' list isn't `readonly`: the body tests it with `Array.isArray`. */
export interface AHeroAsHisItemsAreRead<AnItem extends AnItemAsTheSlotsReadIt> extends RaceAndAlignment {
  readonly items?: (AnItem | null | undefined)[] | null | undefined;
}
/** An item as the save's upgrade re-stamps it: these rules' item, its tier and its words. */
interface AnItemAsTheUpgradeReadsIt extends AnItemAsItsWorthIsRead {
  tier?: number | undefined;
  desc?: string | undefined;
}
/** A list of items as the save's upgrade reads it: a gap among them, or none. */
type ItemsAsTheUpgradeReadsThem = readonly (AnItemAsTheUpgradeReadsIt | null | undefined)[] | null | undefined;
/** A province as the save's upgrade reads it: its features (a gap among them, or none), each with its hoard. */
interface AProvinceAsTheItemsTiersUpgradeReadsIt {
  readonly features?:
    readonly ({ readonly hoardItems?: ItemsAsTheUpgradeReadsThem } | null | undefined)[] | null | undefined;
}
/** A realm as the save's upgrade reads it: any realm (`object`: today's save has no vault), and the vault an older
 *  save's may hold, tested with `Array.isArray` (so not `readonly`). */
type ARealmAsTheItemsTiersUpgradeReadsIt = object & {
  readonly vault?: (AnItemAsTheUpgradeReadsIt | null | undefined)[] | null | undefined;
};
/** The state as the save's upgrade of the items' tiers reads it: every list it guards may be missing. */
interface TheStateAsTheItemsTiersUpgradeReadsIt {
  readonly characters?: readonly { readonly items?: ItemsAsTheUpgradeReadsThem }[] | null | undefined;
  readonly world?:
    { readonly provinces?: readonly AProvinceAsTheItemsTiersUpgradeReadsIt[] | null | undefined } | null | undefined;
  readonly players?: readonly (ARealmAsTheItemsTiersUpgradeReadsIt | null | undefined)[] | null | undefined;
}

// ── EQUIPMENT SLOTS ────
// Worn/wielded items occupy a slot; only ONE per slot (two rings) can be EQUIPPED, and only
// equipped slot items give their effect. Everything without a slot is always active.
// `activeItems(c)` is the single gate every effect read goes through; it normalises first
// (auto-equips an empty slot with the first item held, trims any over-cap), so pre-existing saves
// and new pick-ups need no migration.
export const ITEM_SLOT_CAP = { ...KC_ITEM_SLOT_CAP }; // shield slot added 2026-09-10 · combat ×2 added 2026-09-11

export const LEGENDARY_NAMES_P = new Set(LEGENDARY_ITEMS_P.map((it) => it.name));

// == ITEM TIERS AND STOCK ====
// FOUR tiers, named for the guardians that hold them: 1 Weak, 2 Moderate, 3 Powerful, 4 LEGENDARY.
// A lair holds exactly one item, of its own guardian's tier, so the tier a player sees IS the
// danger they beat. Three things happen in this pass, in order:
//
// 1. SCORE every curated design on how much it actually does in play (itemPowerScore).
// 2. RE-TIER by that score, kind by kind, so the simplest items are Weak and the strongest are
// LEGENDARY - the tier written in the table above is only a starting hint and is overwritten.
// Band sizes follow how common each guardian is, so the stock roughly matches the demand.
// 3. TOP UP any (kind x tier) that is short, by minting further named versions of the designs
// already in that band. Combat items and legendary relics are NEVER minted: one name each.
//
// Item count falls from ~860 to ~600 because a lair now takes one item instead of up to three.
// ══ ITEM ROLE — what an item is FOR, the axis that gates its tier (Toby, 2026-09-24) ══
// Rule 1: a Weak (easy) lair holds nothing that helps a hero in a fight; it holds the kit of the heroes
// doing OTHER jobs — leading armies, spying, thieving, exploring, running the purse. Rule 2: Moderate
// holds the first rung of combat kit. Rule 3: Powerful the second rung. (Rule 4, legendary relics, is
// the curated list — a separate piece of work.) Strength still orders items WITHIN a band; role decides
// which bands an item may hold at all. Role is read from the same `effect.stat` the duel engine reads
// (pcCharCombatant), so an item can never be filed as combat for a power it does not have.
//   COMBAT  : melee, archery, maxHp, armour wards, pc riders, combat-use consumables, temper, aura, and
//             the duel schools elemental / white / illusory (measured 2026-09-24: a +1 in any of these is
//             worth a +1 weapon or a DR-1 armour in a lair fight — claude/claude_school_study_0924.js);
//             a +2 or better in psychic / necromancy; any utility stat that carries a pc rider.
//   UTILITY : the field skills (tactical, march, naval, sage, spy, thief, explorer, druid), tax and army
//             and unit-type bonuses, siege, home defence, fleet, spell charms, oracle/hidden/promote,
//             and a +1 in psychic or necromancy (measured: worth less than the weakest ward in the game,
//             and both are realm schools — the spy's and the army-raiser's) — but ONLY when that +1
//             carries no pc rider of its own; a rider makes it combat whatever the stat (2026-09-27).
// A combat item's floor is Moderate; a utility item may sit anywhere. Toby's ruling: a utility item in a
// weapon/armour/shield slot (Boots of the Wind, Tyrant's Sceptre) stays eligible for Weak — giving up
// the slot to carry it is the trade.
// The role an item effect gives (maxHp, armour, mithrilArmour, pc, combatUse, temper, aura) is the items' registry's
// (treasury, "an item's role": plan P1-19t); the skills' items' roles are these.
export const ITEM_COMBAT_STATS = new Set(['melee', 'archery']);
export const ITEM_DUEL_SCHOOLS = new Set(['elemental', 'white', 'illusory']);
export const ITEM_FIELD_SCHOOLS = new Set(['psychic', 'necromancy']);
export function itemRole(it: AnItemAsItsWorthIsRead | null | undefined) {
  const e: AnEffectAsTheseRulesReadIt = it?.effect ?? {};
  const s = e.stat;
  // the sets read by any stat: an effect with no stat is in none of them
  const combatStats: ReadonlySet<string | undefined> = ITEM_COMBAT_STATS;
  const duelSchools: ReadonlySet<string | undefined> = ITEM_DUEL_SCHOOLS;
  const fieldSchools: ReadonlySet<string | undefined> = ITEM_FIELD_SCHOOLS;
  const itsEffectsRole = it ? theRoleAnItemsEffectsGiveIt(it) : null;
  if (itsEffectsRole) return itsEffectsRole;
  if (combatStats.has(s) || duelSchools.has(s)) return 'combat';
  // A pc RIDER outranks the stat it rides on (2026-09-27). The field-schools test used to run first
  // and return early, so a Necromancy +1 item carrying a duel effect - Rod of the Pale Court, a DR-2
  // ward against undead and fiends - was filed utility and could sit in a Weak lair, against rule 1.
  // The rider is read the same way pcCharCombatant reads it, so this cannot file anything as combat
  // for a power it does not have.
  if (e.pc) return 'combat';
  if (fieldSchools.has(s)) return (Number(e.bonus) || 0) >= 2 ? 'combat' : 'utility';
  return 'utility';
}
// the lowest ordinary tier an item may hold: combat never below Moderate
export function itemTierFloor(it: AnItemAsItsWorthIsRead | null | undefined) {
  return itemRole(it) === 'combat' ? 2 : 1;
}
export function itemAllowedInTier(it: AnItemAsItsWorthIsRead | null | undefined, t: number) {
  return isLegendaryItem(it) ? t === 4 : t >= itemTierFloor(it) && t <= 3;
}
// Stock per kind, per tier, per ROLE: [utility, combat]. Weak is sized like the old 306-item tier
// (a ten-realm map seats ~240 Weak lairs and every name is unique game-wide), all of it utility;
// Moderate and Powerful carry a utility minority (the +2 field skills, the big ledgers and horns) beside
// the combat kit. Weapon at Powerful stays 25: every one is a hand-written design.
export const ITEM_TIER_TARGET: Readonly<
  Partial<Record<number, Readonly<Partial<Record<string, readonly [utility: number, combat: number]>>>>>
> = {
  1: {
    trinket: [90, 0],
    ring: [50, 0],
    amulet: [40, 0],
    cloak: [40, 0],
    helm: [40, 0],
    weapon: [12, 0],
    armour: [12, 0],
    shield: [4, 0],
    combat: [0, 0],
  },
  2: {
    trinket: [12, 12],
    ring: [8, 16],
    amulet: [5, 20],
    cloak: [5, 20],
    helm: [5, 20],
    weapon: [2, 30],
    armour: [2, 36],
    shield: [0, 30],
    combat: [0, 70],
  }, // combat items are one name each (never minted), so their band is simply every design worth its floor
  3: {
    trinket: [4, 6],
    ring: [2, 8],
    amulet: [2, 8],
    cloak: [2, 8],
    helm: [2, 8],
    weapon: [1, 25],
    armour: [0, 10],
    shield: [0, 10],
    combat: [0, 12],
  },
};
export function itemTierTarget(tier: number, cat: string, role: string | null | undefined) {
  const forTier: Readonly<Partial<Record<string, readonly [number, number]>>> = ITEM_TIER_TARGET[tier] ?? {};
  const o: readonly [number, number] = forTier[cat] ?? [0, 0];
  return role == null ? o[0] + o[1] : role === 'utility' ? o[0] : o[1];
}
// A COMBAT item must also be worth its band: Powerful takes nothing under 4.5 (more than a bare +1
// skill, which scores 3), Moderate nothing under 2 (a DR-1 ring, 1.2, is filler). A band the designs
// cannot fill is topped up by minting from what did qualify, never by promoting a trinket.
export const ITEM_COMBAT_SCORE_FLOOR = { 3: 4.5, 2: 2.0 };

// --- How strong is this item, really? ------------------------------------------------------ One
// number per item, on a rough 0-10 scale, so that "simplest" and "strongest" mean something a
// machine can sort. Every branch reads the SAME effect fields the combat engine reads, so an item
// cannot score for a power it does not actually have.
export function _wardScore(fx: AWardAsTheScoresReadIt | null | undefined) {
  if (!fx?.ward) return 0;
  // the items' registry weighs each ward of its own (treasury, "an item's worth: a ward": plan P1-19t); a ward it holds
  // no effect for is worth 2
  return theWorthOfAWard(fx) ?? 2;
}
export function _pcScore(pc: ARiderAsTheScoresReadIt | null | undefined) {
  if (!pc) return 0;
  // the items' registry weighs each rider (treasury, "an item's worth: a rider": plan P1-19t), then the riders' ward
  return theWorthOfAnItemsRiders(pc) + _wardScore(pc);
}
export function _useScore(e: AnEffectAsTheseRulesReadIt) {
  // the items' registry weighs each combat use (treasury, "an item's worth: a combat use": plan P1-19t); a use it holds
  // no effect for is worth 3
  return theWorthOfACombatUse(e) ?? 3;
}
export function itemPowerScore(it: AnItemAsItsWorthIsRead | null | undefined) {
  if (!it) return 0;
  const e: AnEffectAsTheseRulesReadIt = it.effect ?? {};
  // The items' registry weighs an item by its kind (treasury, "an item's worth": a combat item its use, armour its ward
  // and its bonus, a charm its spell, ... plan P1-19t); a skill's item, or one the registry holds no worth for, is worth
  // so much a point of its bonus, or a one-off power with no number to read.
  let s =
    theWorthOfAnItemsEffect(it, e, { ofItsCombatUse: () => _useScore(e), ofItsWard: () => _wardScore(e) }) ??
    (typeof e.bonus === 'number' ? (e.bonus || 0) * 3 : 3);
  if (e.pc) s += _pcScore(e.pc);
  // A realm-wide effect (a banner worth +25 army strength, say) would otherwise swamp the scale;
  // the ordering is all that matters here, so the top end is clamped. NOTE: this means two
  // realm-wide items of different size can score alike - the unslotted pile is therefore not
  // compared against the relics on this scale (see the harness), because an army banner and a
  // duelling ring are not the same kind of thing measured the same way.
  return Math.min(12, Math.round(s * 10) / 10);
}

export const _VARIANT_EPITHETS = [
  'of the Long March',
  'of Grey Water',
  'of the Ninth Hour',
  'of the Old Road',
  'of the Broken Field',
  'of the Quiet Watch',
  'of the Last Winter',
  'of the Wandering Host',
  'of Thornfall',
  'of the Cold Ford',
  'of the Iron Year',
  'of the Second Vigil',
];

(function _retierAndBalanceItems() {
  // the treasury and the relics through one wide shape (the same arrays), so the pass may write its marks on them
  const treasury: AnItemOfTheTreasury[] = ALL_MAGIC_ITEMS_P;
  const relics: readonly AnItemOfTheTreasury[] = LEGENDARY_ITEMS_P;
  // the legendary tier is now the curated LEGENDARY_ITEMS_P list and nothing else. Any older entry
  // bearing a relic's name (and any alt-named clone of one) is removed outright, so a relic's
  // effect exists exactly once in the whole treasury, and the relic itself is re-added from the
  // list below.
  const curated = treasury.filter(
    (it) => !it._variantOf && !LEGENDARY_NAMES_P.has(it.name) && !LEGENDARY_NAMES_P.has(_ITEM_ALT_BASE[it.name] ?? ''),
  );
  treasury.length = 0;
  curated.forEach((it) => {
    it.tier = it.tier === 3 || it.tier === 4 ? 2 : it.tier;
    treasury.push(it);
  }); // drop the old tier-3 "legendary" hint
  relics.forEach((it) => treasury.push(it));

  const byCat: Partial<Record<string, AnItemOfTheTreasury[]>> = {};
  treasury.forEach((it) => {
    const c = itemHoardCategory(it);
    (byCat[c] ??= []).push(it);
  });

  Object.keys(byCat).forEach((cat) => {
    const list = byCat[cat];
    if (!list) return; // each key holds the list the loop above made
    // An alt-named clone must land in the same tier as its base, so tier only the BASES and let the
    // clones follow. (_ITEM_ALT_BASE maps a clone's name back to its base.)
    const bases = list.filter((it) => !_ITEM_ALT_BASE[it.name]);
    const tierScoreOf: Partial<Record<string, number>> = {};
    bases.forEach((it) => {
      it._score = itemPowerScore(it);
      tierScoreOf[it.name] = it._score;
    });
    // each base was scored just above (Number() reads a score as the subtraction did)
    bases.sort((a, b) => Number(a._score) - Number(b._score) || a.name.localeCompare(b.name));
    // LEGENDARY is exactly the curated relic list - never a promotion by score.
    const legs = LEGENDARY_NAMES_P;
    bases.forEach((it) => {
      if (legs.has(it.name)) it.tier = 4;
    });
    // Everything that is not a relic - bases AND their alt-named clones - is ranked by score, then
    // SPLIT BY ROLE (itemRole) and each role banded on its own: Powerful takes the strongest of the
    // role up to its (kind x tier x role) target, Moderate the next, Weak the next - and a COMBAT item
    // never falls below Moderate (itemTierFloor), so a Weak lair holds nothing that helps in a
    // fight. A clone carries its base's score. Whatever no band has room for is the weakest material
    // of its kind and role and is DROPPED from the treasury outright.
    const ordinary = list.filter((it) => !legs.has(it.name));
    if (!ordinary.length) return;
    ordinary.forEach((it) => {
      const b = _ITEM_ALT_BASE[it.name];
      const baseScore = b ? tierScoreOf[b] : undefined;
      it._score = baseScore ?? itemPowerScore(it);
    });
    // Strongest first. Among items of equal worth, a CURATED design outranks a repeated name and a
    // race- or alignment-bound design outranks a plain one, so the material that gets shed is the
    // interchangeable filler rather than something written for a particular people.
    const _rank = (it: AnItemOfTheTreasury) =>
      (_ITEM_ALT_BASE[it.name] || it._variantOf ? 2 : 0) + (it.race || it.alignment ? -1 : 0);
    ordinary.sort((a, b) => Number(b._score) - Number(a._score) || _rank(a) - _rank(b) || a.name.localeCompare(b.name));
    ['utility', 'combat'].forEach((role) => {
      const pool = ordinary.filter((it) => itemRole(it) === role);
      let k = 0;
      [3, 2, 1].forEach((t) => {
        let n = 0;
        const want = itemTierTarget(t, cat, role);
        // the floors read by any tier
        const floors: Readonly<Partial<Record<number, number>>> = ITEM_COMBAT_SCORE_FLOOR;
        const floor = role === 'combat' ? Number(floors[t]) || 0 : 0;
        while (k < pool.length && n < want) {
          const it = pool[k];
          // k is below the pool's length, so `it` is always there; each was scored above
          if (!it || !itemAllowedInTier(it, t) || Number(it._score) < floor) break;
          it.tier = t;
          n++;
          k++;
        } // pool is strongest-first, so the first item under the band's floor ends the band
      });
      for (const dropped of pool.slice(k)) dropped._drop = true;
    });
  });

  // --- Top up short (kind x tier) bands with minted versions ------------------------------- Shed
  // the surplus decided above before topping up, so a band is never filled with material that is
  // about to be thrown away.
  {
    const keep = treasury.filter((it) => !it._drop);
    treasury.length = 0;
    keep.forEach((it) => {
      delete it._drop;
      treasury.push(it);
    });
  }
  // a name that may be missing is looked up as Set.has does: it is never taken
  const taken = new Set<string | undefined>(treasury.map((it) => it.name));
  const minted: AnItemOfTheTreasury[] = [];
  HOARD_CATEGORIES.forEach((cat) => {
    // the banks read by any kind's name
    const banks: Readonly<Partial<Record<string, ABankOfNames>>> = _VARIANT_BANK;
    const bank = banks[cat];
    if (!bank) return; // combat items have no bank: one name each, by ruling
    const nounsFor = (seed: AnItemOfTheTreasury) => {
      if (cat !== 'weapon') return bank.noun;
      const weaponBank = _VARIANT_BANK.weapon; // the bank above, its kind being 'weapon'
      const st = seed.effect?.stat;
      if (st === 'archery') return weaponBank.bow;
      // Magic schools AND command relics take a staff, rod or sceptre; blades and hafts are for the
      // items that sharpen the bearer's own arm.
      const focusStats: readonly (string | undefined)[] = [
        'white',
        'psychic',
        'illusory',
        'elemental',
        'necromancy',
        'druid',
        'undeadBonus',
        'armyBonus',
        'taxBonus',
        'tactical',
        'naval',
        'sage',
      ];
      if (focusStats.includes(st)) return weaponBank.focus;
      return bank.noun;
    };
    const namesFor = (seed: AnItemOfTheTreasury) => {
      const nouns = nounsFor(seed),
        out: string[] = [];
      bank.adj.forEach((a) => {
        nouns.forEach((nn) => out.push(a + ' ' + nn));
      });
      _VARIANT_EPITHETS.forEach((e) => {
        nouns.forEach((nn) => out.push(nn + ' ' + e));
      });
      return out;
    };
    [1, 2, 3].forEach((t) => {
      ['utility', 'combat'].forEach((role) => {
        const want = itemTierTarget(t, cat, role);
        const inBand = treasury.filter((it) => it.tier === t && itemHoardCategory(it) === cat && itemRole(it) === role);
        // Seeds are of the SAME ROLE as the slots they fill (a Weak ring is minted from a Weak ring, never
        // from a duelling ring), usable by anyone, and never a combat-use item (one name each, by
        // ruling). If a band holds nothing but race- or alignment-bound designs, seed from those
        // instead and let the minted versions carry the same binding - a short band would otherwise
        // leave the stocker handing that kind's lairs an item of the wrong tier.
        const plain = (it: AnItemOfTheTreasury) => !anItemIsACombatItem(it);
        let seeds = inBand.filter((it) => plain(it) && !it.race && !it.alignment);
        if (!seeds.length) seeds = inBand.filter(plain);
        if (!seeds.length) return;
        let made = inBand.length,
          si = 0,
          guard = 0;
        const cursor: Partial<Record<string, number>> = {};
        while (made < want && guard++ < 3000) {
          const seed = seeds[si++ % seeds.length];
          if (!seed) continue; // seeds isn't empty, so a seed is always there
          const names = namesFor(seed);
          let k = cursor[seed.name] ?? 0, // a cursor holds a whole number
            nm = null;
          while (k < names.length) {
            const cand = names[k++];
            if (!taken.has(cand)) {
              nm = cand;
              break;
            }
          }
          cursor[seed.name] = k;
          if (!nm) continue;
          taken.add(nm);
          minted.push({
            ...seed,
            effect: { ...seed.effect },
            name: nm,
            slot: cat === 'trinket' ? undefined : cat,
            tier: t,
            _variantOf: seed.name,
          });
          made++;
        }
      });
    });
  });
  minted.forEach((it) => {
    if (it.slot === undefined) delete it.slot;
    treasury.push(it);
  });

  // --- Rebuild the derived tables ----------------------------------------------------------
  const theFourTiers: readonly (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];
  theFourTiers.forEach((t) => {
    ITEMS_BY_TIER[t].length = 0;
  });
  // the tiers' lists read by any tier, through the treasury's wide shape (the same lists)
  const byTier: Readonly<Partial<Record<number, AnItemOfTheTreasury[]>>> = ITEMS_BY_TIER;
  treasury.forEach((it) => {
    const tierList = byTier[it.tier || 1];
    // every tier the pass gives is 1 to 4; another threw here before, reading `push` of undefined
    if (!tierList) throw new TypeError(`No list of the items of tier ${String(it.tier)}`);
    tierList.push(it);
    if (it.lore && !ITEM_LORE_BY_NAME[it.name]) ITEM_LORE_BY_NAME[it.name] = it.lore;
  });
})();

// Items already sitting in a save carry whatever tier they were given when they were rolled.
// Re-stamp them from the master table by name on load, so a relic won three turns ago still scores
// as legendary and a Weak find still reads as Weak. Runs in the save's upgrade at the head of every
// turn (engine/saves/upgrade-a-saved-game-and-check-it.ts, plan P1-15a).
export function migrateItemTiers(gs: TheStateAsTheItemsTiersUpgradeReadsIt | null | undefined) {
  if (!gs) return;
  // a name that may be missing is looked up as Map.get does: no item is filed under it
  const byName = new Map<string | undefined, { readonly tier: number }>();
  ALL_MAGIC_ITEMS_P.forEach((it) => byName.set(it.name, it));
  // the labels read by any school's name
  const labels: Readonly<Partial<Record<string, string>>> = SKILL_LABELS;
  // An item the treasury no longer carries (dropped from a band in a later re-cut) keeps its own tier,
  // but never below its ROLE's floor - a healing draught in a pack is Moderate whatever it was rolled as.
  const fix = (it: AnItemAsTheUpgradeReadsIt | null | undefined) => {
    if (!it?.name) return;
    const m = byName.get(it.name) ?? byName.get(_ITEM_ALT_BASE[it.name]);
    if (m) {
      if (it.tier !== m.tier) it.tier = m.tier;
    } else if (!isLegendaryItem(it) && ((it.tier ?? 0) || 1) < itemTierFloor(it)) it.tier = itemTierFloor(it);
    // 2026-10-13 (item 7, Toby): an item rolled before the descriptions named their school with a
    // capital ("casts Charm (Psychic Magic)") carries the old lower-case copy; mend it in place.
    if (typeof it.desc === 'string')
      it.desc = it.desc.replace(
        /\((white|psychic|illusory|elemental|necromancy)\)/g,
        (w, k: string) => `(${(labels[k] ?? '') || k})`,
      );
  };
  (gs.characters ?? []).forEach((c) => {
    (c.items ?? []).forEach(fix);
  });
  (gs.world?.provinces ?? []).forEach((p) => {
    (p.features ?? []).forEach((f) => {
      if (f) (f.hoardItems ?? []).forEach(fix);
    });
  });
  (gs.players ?? []).forEach((pl) => {
    if (pl && Array.isArray(pl.vault)) pl.vault.forEach(fix);
  });
}

// Puts a hero's items in order: an item he can't use comes off, and each slot holds as many as it may (those he wears
// first, then the first others he carries). It writes only a flag that changes (P1-12b2), so on a hero whose items
// are already in order it is only a read: the reports read items through it (activeItems), and building them writes
// nothing to the world.
export function normaliseEquipment(c: AHeroAsHisItemsAreRead<AnItemAsTheSlotsReadIt> | null | undefined) {
  if (!c || !Array.isArray(c.items)) return;
  // the caps read by any slot's name: a slot not in the table has none, and a count is never at or under NaN
  const caps: Readonly<Partial<Record<string, number>>> = ITEM_SLOT_CAP;
  const count: Partial<Record<string, number>> = {};
  c.items.forEach((it) => {
    if (it && !itemUsableBy(it, c)) {
      if (itemSlot(it) && it.equipped !== false) it.equipped = false;
      return;
    }
    const sl = itemSlot(it);
    if (!sl) {
      if (it?.equipped !== undefined) delete it.equipped;
      return;
    }
    if (!it) return; // itemSlot gives no slot for no item, so `it` is always there
    if (it.equipped === true) {
      if ((count[sl] ?? 0) >= Number(caps[sl])) it.equipped = false;
      else count[sl] = (count[sl] ?? 0) + 1;
    }
  });
  c.items.forEach((it) => {
    if (it && !itemUsableBy(it, c)) return;
    const sl = itemSlot(it);
    if (!sl || !it || it.equipped === true) return; // itemSlot gives no slot for no item
    if ((count[sl] ?? 0) < Number(caps[sl])) {
      it.equipped = true;
      count[sl] = (count[sl] ?? 0) + 1;
    } else if (it.equipped !== false) it.equipped = false;
  });
}
// 2026-10-13 (Toby, item 10): every time a hero gains an item, the report says whether they put
// it on at once or have no room for it. Call it AFTER the items are in `ch.items`: a gained item's
// old `equipped` flag (from its last owner) is dropped, normaliseEquipment re-slots it exactly as
// every effect read will, and the record says what came of each (its words: theWordsOfTheItemsAHeroGained,
// src/views/prose/the-words-of-the-items-a-hero-gained.ts, plan P1-12d21). Returns null when there is nothing to
// say.
/** How a hero carries an item he has just gained, as the line tells it (settleTheItemsAHeroGained): one of four ways,
 *  with the item's name, and for an item with no room its slot and the names of the items worn there. */
export type HowAHeroCarriesAnItemHeGained =
  /** He cannot use it ("Aldric cannot use the Elven Bow and carries it unused."). */
  | { readonly kind: 'he cannot use it'; readonly itemName: string }
  /** It needs no slot ("The Tome of Tactics needs no slot: it works for Aldric at once."). */
  | { readonly kind: 'it needs no slot'; readonly itemName: string }
  /** He puts it on at once ("Aldric equips the Blade of Fury at once."). */
  | { readonly kind: 'he equips it at once'; readonly itemName: string }
  /** No room in its slot: the slot, and the items worn there ("the weapon slot already holds the Sword of …"). */
  | {
      readonly kind: 'he has no room for it';
      readonly itemName: string;
      readonly slot: string;
      readonly wornNames: readonly string[];
    };
/** The items a hero has just gained, and how he carries each, copied as the line is told. */
export interface TheItemsAHeroGained {
  readonly heroName: string;
  readonly items: readonly HowAHeroCarriesAnItemHeGained[];
}
export function settleTheItemsAHeroGained(
  ch: (AHeroAsHisItemsAreRead<AnItemAsTheSlotsReadIt> & { readonly name: string }) | null | undefined,
  items: readonly (AnItemAsTheSlotsReadIt | null | undefined)[] | null | undefined,
): TheItemsAHeroGained | null {
  if (!ch || !Array.isArray(ch.items)) return null;
  const carried = ch.items; // the list just tested
  const got = (items ?? []).filter((it): it is AnItemAsTheSlotsReadIt => !!it && carried.includes(it));
  if (!got.length) return null;
  got.forEach((it) => {
    delete it.equipped;
  });
  normaliseEquipment(ch);
  return {
    heroName: ch.name,
    items: got.map((it): HowAHeroCarriesAnItemHeGained => {
      const itemName = it.name;
      if (!itemUsableBy(it, ch)) return { kind: 'he cannot use it', itemName };
      const sl = itemSlot(it);
      if (!sl) return { kind: 'it needs no slot', itemName };
      if (it.equipped === true) return { kind: 'he equips it at once', itemName };
      const wornNames = carried
        .filter((x): x is AnItemAsTheSlotsReadIt => !!x && x !== it && x.equipped === true && itemSlot(x) === sl)
        .map((x) => x.name);
      return { kind: 'he has no room for it', itemName, slot: sl, wornNames };
    }),
  };
}
export function activeItems<AnItem extends AnItemAsTheSlotsReadIt>(
  c: AHeroAsHisItemsAreRead<AnItem> | null | undefined,
): AnItem[] {
  if (!c || !Array.isArray(c.items)) return [];
  normaliseEquipment(c);
  return c.items.filter((it): it is AnItem => !!it && itemUsableBy(it, c) && (!itemSlot(it) || it.equipped === true));
}
// Does the character carry (active/equipped) an item whose BASE name is `base`? Resolves the two
// alternate names of every tier-1/2 item, so 'Falcon\'s Quiver' counts as the Quiver of the Hawk.
export function hasItemBase(c: AHeroAsHisItemsAreRead<AnItemAsTheSlotsReadIt> | null | undefined, base: string) {
  return activeItems(c).some(
    (it: AnItemAsTheSlotsReadIt | null | undefined) =>
      it?.name && ((_ITEM_ALT_BASE[it.name] ?? '') || it.name) === base,
  );
}
// the temper a character FIGHTS with — an equipped temper item overrides their own.
export function effTemper(
  c:
    | (AHeroAsHisItemsAreRead<AnItemAsTheSlotsReadIt> & { readonly temper?: string | null | undefined })
    | null
    | undefined,
) {
  if (!c) return 'Brave';
  // the items' registry (plan P1-19p)
  return theTemperAHerosItemsGiveHim(activeItems(c)) ?? ((c.temper ?? '') || 'Brave');
}
export function rollMagicItem(
  monsterPower: string,
  taken: ReadonlySet<string> | null | undefined,
  takenEff: ReadonlySet<string> | null | undefined,
) {
  const takenNames = taken ?? new Set<string>();
  const t = lairItemTier(monsterPower); // the guardian's power IS the tier
  // the tiers' lists read by any tier
  const byTier: Readonly<Partial<Record<number, AMagicItem[]>>> = ITEMS_BY_TIER;
  const tierList = byTier[t];
  const inTier = preferFreshEffects(
    (tierList?.length ? tierList : ALL_MAGIC_ITEMS_P).filter((it) => !takenNames.has(it.name)),
    takenEff,
  );
  if (inTier?.length) return inTier[Math.floor(kcRng() * inTier.length)];
  let anyLeft: AMagicItem[] | null | undefined = ALL_MAGIC_ITEMS_P.filter(
    (it) => !takenNames.has(it.name) && itemFallbackOk(it, t),
  );
  if (!anyLeft.length) anyLeft = ALL_MAGIC_ITEMS_P.filter((it) => !takenNames.has(it.name));
  anyLeft = preferFreshEffects(anyLeft, takenEff);
  return anyLeft?.length ? anyLeft[Math.floor(kcRng() * anyLeft.length)] : null;
}
// When a tier is spent, a WEAK lair may still take any utility item of any tier (rule 1 survives
// exhaustion); a combat item reaches a Weak lair only when the treasury is otherwise bare.
export function itemFallbackOk(it: AnItemAsItsWorthIsRead | null | undefined, t: number | null | undefined) {
  return t == null || t !== 1 || itemRole(it) === 'utility';
}
export function _skillItem(
  c:
    | (AHeroAsHisItemsAreRead<AnItemAsTheSlotsReadIt> & {
        readonly skills?: Readonly<Partial<Record<string, number>>> | null | undefined;
      })
    | null
    | undefined,
  stat: string,
) {
  const skills: Readonly<Partial<Record<string, number>>> = c?.skills ?? {};
  const base = Number(skills[stat]) || 0;
  const bonus = activeItems(c).reduce(
    (s, it: AnItemAsTheSlotsReadIt | null | undefined) =>
      s + (it?.effect?.stat === stat ? Number(it.effect.bonus) || 0 : 0),
    0,
  ); // equipped only
  return Math.max(0, Math.min(9, base + bonus)); // TITLES count skill levels up to 9 (benefits still cap at 5 via effStat)
}
