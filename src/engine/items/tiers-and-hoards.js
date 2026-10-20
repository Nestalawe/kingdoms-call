// ── GUARDIAN CATEGORY, SHOWN TO THE PLAYER ────
// The category already decided which hoard items a guardian could wield, and White Magic's double
// damage against the undead and fiends turns on it — but it was never printed, so a player reading
// "Guardian: Barrow Wight" had to know the bestiary to tell what kind of thing they were sending a
// hero against. Every player-facing list now prints it beside the name. Display only; no mechanic
// moves. Shipped on the feature payloads as `monsterCat` and rendered by the player portal.
const MONSTER_CAT_LABELS = {
  humanoid: 'Humanoid',
  undead: 'Undead',
  beast: 'Beast',
  vermin: 'Vermin',
  giant: 'Giant',
  dragon: 'Dragon',
  fiend: 'Fiend',
  fey: 'Fey',
  aberration: 'Aberration',
  elemental: 'Elemental',
  construct: 'Construct',
};
function monsterCatLabel(m) {
  if (!m) return '';
  const c = monsterCat(m);
  return MONSTER_CAT_LABELS[c] || '';
}
// Which of a lair's items this guardian can bring to bear.
// A guardian's use of its hoard is decided by its TYPE alone (MONSTER_CAT_ITEM_USE). Race- and
// alignment-bound items are deliberately NOT gated here: itemUsableBy() binds them to characters of
// that race/alignment, but a guardian wields whatever its kind can hold (confirmed 2026-09-21, Toby).
function guardianCanUseItem(m, it) {
  const pol = MONSTER_CAT_ITEM_USE[monsterCat(m)] || 'none';
  if (pol === 'none' || !it) return false;
  if (pol === 'all') return true;
  const sl = itemSlot(it);
  return !sl || _TRINKET_SLOTS.has(sl);
}
// ── PAGAN TUNING ──
const RITUAL_SITE_NAMES = ['Standing Stones', 'Blood Altar', 'Circle of the Old Gods'];
const RITUAL_SITE_CHANCE_HUMANOID = 0.25; // share of humanoid land provinces with one (Blood Offering only there)
const WILD_HUNT_COST = 6; // fallback price if a bound type is missing from ARMY_COST_MASTER
const WILD_HUNT_UNITS = 2; // units bound per rite
// the rite is priced at the cost of ONE of the beasts bound, however many answer the horn — bind
// two Stone Giants (5g each) and the offering is 5g, not 6g and not 10g. Declared as a
// function so the ARMY_COST_MASTER lookup happens at call time, not at load (see the ITEMS_BY_TIER
// temporal-dead-zone gotcha).
function wildHuntPrice(type) {
  return ARMY_COST_MASTER[type] || WILD_HUNT_COST;
}
const GRAND_HEIST_RICH_TAX = 7; // tax base at/above which a province is rich enough to stage a Grand Heist in (a realm's home capital always qualifies)
const WILD_HUNT_TURNS = 1; // extra full turns the bound creatures serve beyond this one
const BLOOD_HARVEST_PER_UNIT = 1; // gold per enemy unit destroyed in a Pagan victory
const FEATURE_POOLS_P = {
  plain: [
    'Ancient Battlefield',
    'Ruined Watchtower',
    'Goblin Camp',
    'Roadside Shrine',
    'Bandit Stronghold',
    'Old Graveyard',
    'Collapsed Aqueduct',
    'Abandoned Fort',
    'Plague Village',
    'Sunken Road Shrine',
    'Mercenary Encampment',
    'Burning Mill',
  ],
  desert: [
    'Buried Pyramid',
    'Sand Drake Lair',
    'Oasis Temple',
    'Forgotten Tomb',
    'Sphinx Lair',
    'Glass City',
    'Scorpion Den',
    'Lost Caravan Ruins',
    'Sand Dune Fortress',
    'Sun God Shrine',
    'Bone Maze',
    'Mirage Palace',
  ],
  forest: [
    'Haunted Grove',
    'Elven Ruins',
    'Spider Warren',
    'Druid Circle',
    'Dark Elf Camp',
    'Wolf Den',
    "Witch's Hut",
    'Overgrown Barrow',
    'Treant Hollow',
    'Bandit Cave',
    'Ruined Monastery',
    'Fey Crossing',
  ],
  jungle: [
    'Lost City',
    'Serpent Temple',
    'Giant Insect Nest',
    'Overgrown Fortress',
    'Sunken Palace',
    'Tribe Village',
    'Vine-Choked Ziggurat',
    'Stone Idol',
    'Piranha Pool',
    'Cursed Well',
    'Monkey King Lair',
    'Poison Garden',
  ],
  mountain: [
    'Dragon Eyrie',
    'Dwarven Mine',
    'Troll Bridge',
    "Giant's Hall",
    'Frozen Crypt',
    'Eagle Aerie',
    'Crystal Cave',
    'Old Observatory',
    'Collapsed Mine Shaft',
    'Golem Workshop',
    'High Temple',
    'Glacier Tomb',
  ],
  sea: [
    'Sea Cave',
    'Pirate Cove',
    'Sunken Ship',
    'Kraken Lair',
    'Mermaid Grotto',
    'Ghost Galleon',
    'Coral Fortress',
    'Lighthouse Ruin',
  ],
};

(function _tripleLowerTierItems() {
  const extra = [];
  ALL_MAGIC_ITEMS_P.forEach((it) => {
    if (it.tier !== 1 && it.tier !== 2) return;
    if (it.effect && it.effect.stat === 'combatUse') return; // ONE version of each combat item — no clones (their alt names stay in _ITEM_ALT_BASE so items already in saves still resolve)
    (_ITEM_NAME_ALTS[it.name] || []).forEach((nm) => {
      extra.push({ ...it, effect: { ...it.effect }, name: nm }); // same effect/desc/tier, new name
    });
  });
  extra.forEach((it) => ALL_MAGIC_ITEMS_P.push(it));
})();

const ITEM_TIER_OF_POWER = { Weak: 1, Moderate: 2, Powerful: 3, Legendary: 4 };
function isLegendaryItem(it) {
  return !!it && it.tier === 4;
}
const ITEMS_BY_TIER = { 1: [], 2: [], 3: [], 4: [] };
ALL_MAGIC_ITEMS_P.forEach((it) => {
  (ITEMS_BY_TIER[it.tier || 1] || ITEMS_BY_TIER[1]).push(it);
});
// ── Item lore ── every base item carries `lore`: a short narrative that also states the effect in
// plain words. Clones inherit it by the spread above. Items already sitting in saves or lair hoards
// predate the field, so lookups go BY NAME (falling back to the terse desc) — see itemLore /
// itemLoreLines.
const ITEM_LORE_BY_NAME = {};
ALL_MAGIC_ITEMS_P.forEach((it) => {
  if (it && it.lore) ITEM_LORE_BY_NAME[it.name] = it.lore;
});
function itemLore(it) {
  if (!it) return '';
  return (
    it.lore ||
    ITEM_LORE_BY_NAME[it.name] ||
    (it.effect && it.effect.stat === 'mithrilArmour' ? MITHRIL_ARMOUR.lore : '') ||
    it.desc ||
    ''
  );
}
// One chronicle line per item — "📜 The Blade of Fury — <lore>" — used when items are won from a
// lair.
function itemLoreLines(items) {
  return (items || [])
    .filter(Boolean)
    .map((d) => `📜 The ${d.name}${isLegendaryItem(d) ? ' (LEGENDARY)' : ''} — ${itemLore(d)}`)
    .join('\n');
}
// Loot quality climbs with the monster's tier: tougher foes yield rarer (higher-tier) items.
// UNIQUENESS. `taken` is a Set of item names already found this game; the roll never returns one
// already claimed. It prefers the tier the monster's power rolled; if that tier is exhausted it
// falls back to any remaining untaken item (any tier); if the whole treasury has been claimed it
// returns null (the lair then yields gold only). With every tier-1/2 item now existing in three
// named versions, exhaustion is rare even on the biggest maps.
// ── EFFECT-LEVEL UNIQUENESS (2026-09-26) ──────────────────────────────────────────────────
// Name uniqueness alone is not enough. Every tier-1 and tier-2 design exists under three names
// (_tripleLowerTierItems) plus any minted versions, so 288 tier-1 NAMES sit on only 107 distinct
// tier-1 EFFECTS. Two lairs could hand out "Blade of Fury" and "Sword of Wrath" — different names,
// the same Melee +2 — and a player reasonably reads that as the game repeating itself. The roll now
// PREFERS an effect nothing else on the map carries, and only re-uses one when the tier has no
// unused effect left. `itemEffectKey` is the signature: the effect alone. (It used to add the slot
// and tier, so an amulet and a trinket both giving Mountain Guns +4 counted as two different finds;
// 2026-10-13, item 5, Toby: to a player they are the same thing found twice.)
function itemEffectKey(it) {
  if (!it) return '?';
  if (!it.effect) return 'name:' + it.name;
  return JSON.stringify(it.effect);
}
// 2026-10-13 (item 5, Toby): heroes were opening two lairs in one turn and finding the same effect in
// both. Lairs within this many provinces of each other never hold the same effect while the treasury
// has any other choice; the distance shrinks a step at a time (down to "not in the same province")
// only when nothing else is left.
const LAIR_EFFECT_SPREAD = 3;
// Rebuilds the set of effects already handed out from gs._awardedItems (names are what saves keep),
// so an existing game adopts the rule without a migration field of its own.
function awardedEffectSet(gs) {
  const s = new Set();
  if (!gs || !Array.isArray(gs._awardedItems)) return s;
  const byName = new Map();
  ALL_MAGIC_ITEMS_P.forEach((it) => byName.set(it.name, it));
  gs._awardedItems.forEach((n) => {
    const it = byName.get(n);
    if (it) s.add(itemEffectKey(it));
  });
  return s;
}
// Narrows a candidate list to items whose effect is still unspent; returns the list untouched when
// that would leave nothing, so a bare tier still yields an item rather than an empty lair.
function preferFreshEffects(pool, takenEff) {
  if (!takenEff || !takenEff.size || !pool || !pool.length) return pool;
  const fresh = pool.filter((it) => !takenEff.has(itemEffectKey(it)));
  return fresh.length ? fresh : pool;
}
function rollMagicItem(monsterPower, taken, takenEff) {
  taken = taken || new Set();
  const t = lairItemTier(monsterPower); // the guardian's power IS the tier
  const inTier = preferFreshEffects(
    (ITEMS_BY_TIER[t] && ITEMS_BY_TIER[t].length ? ITEMS_BY_TIER[t] : ALL_MAGIC_ITEMS_P).filter(
      (it) => !taken.has(it.name),
    ),
    takenEff,
  );
  if (inTier.length) return inTier[Math.floor(kcRng() * inTier.length)];
  let anyLeft = ALL_MAGIC_ITEMS_P.filter((it) => !taken.has(it.name) && itemFallbackOk(it, t));
  if (!anyLeft.length) anyLeft = ALL_MAGIC_ITEMS_P.filter((it) => !taken.has(it.name));
  anyLeft = preferFreshEffects(anyLeft, takenEff);
  return anyLeft.length ? anyLeft[Math.floor(kcRng() * anyLeft.length)] : null;
}
// When a tier is spent, a WEAK lair may still take any utility item of any tier (rule 1 survives
// exhaustion); a combat item reaches a Weak lair only when the treasury is otherwise bare.
function itemFallbackOk(it, t) {
  return t == null || t !== 1 || itemRole(it) === 'utility';
}
// ── LAIR HOARDS ── every lair's gold AND magic items are decided at world generation
// (or, for a game saved before this build, once at the start of the next turn) and stored on the feature:
// `treasure` (gold, one figure — what a clearer takes and what a thief chips at) and `hoardItems`
// (full item records, unique game-wide via gs._awardedItems). Scout reports them exactly; a
// guardian that can wield them turns them on the challenger; a thief may lift one (`_stolenItems`
// remembers what went); a slain challenger's kit joins the hoard. Legendary lairs are stocked first
// so the rarest tiers go to the toughest guardians; once the treasury is exhausted a lair simply
// holds gold. 2026-09-11: EXACTLY ONE item per lair, always - no second or third find, and no empty
// hoard. The item's tier is the guardian's own power: a Weak lair holds a Weak item, a Legendary
// lair a LEGENDARY relic. (Kept as a table so a future change of heart needs one edit, not twenty.)
const LAIR_ITEM_ODDS = {
  Weak: { itemChance: 1.0, bonusItem: 0, thirdItem: 0 },
  Moderate: { itemChance: 1.0, bonusItem: 0, thirdItem: 0 },
  Powerful: { itemChance: 1.0, bonusItem: 0, thirdItem: 0 },
  Legendary: { itemChance: 1.0, bonusItem: 0, thirdItem: 0 },
}; // was 40/0, 80/15, 100/40, 100/100/50
function ensureLairHoard(f, gs, opts) {
  if (!f || f.ritualSite) return;
  const _noItems = !!(opts && opts.noItems); // balanced stocking (ensureAllLairHoards) fills items itself
  f.hoardItems = Array.isArray(f.hoardItems) ? f.hoardItems : [];
  if (Array.isArray(f.lairItems) && f.lairItems.length) {
    f.hoardItems.push(...f.lairItems);
    f.lairItems = [];
  }
  if (f._hoardV2) return;
  f._hoardV2 = true;
  const power = (f.monster && f.monster.power) || 'Weak';
  const band = ENCOUNTER_CLEAR_GOLD_BANDS[power] || [1, 5];
  const gold = f._clearGold != null ? f._clearGold : Math.floor(kcRng() * (band[1] - band[0] + 1)) + band[0];
  delete f._clearGold;
  setFeatureTreasure(f, gold);
  // Thief revision: remember the hoard as it stood at generation — a thief's cut is a share of the
  // ORIGINAL pile, so each successive theft takes a like amount until it runs dry.
  if (f._hoardGoldOrig == null) f._hoardGoldOrig = gold;
  if (f.cleared || !gs || _noItems) return;
  if (!Array.isArray(gs._awardedItems)) gs._awardedItems = [];
  const taken = new Set(gs._awardedItems);
  const takenEff = awardedEffectSet(gs);
  const T = LAIR_ITEM_ODDS[power] || LAIR_ITEM_ODDS.Weak;
  const roll = () => {
    const base = rollMagicItem(power, taken, takenEff);
    if (!base) return;
    taken.add(base.name);
    takenEff.add(itemEffectKey(base));
    gs._awardedItems.push(base.name);
    const id = gs.nextItemId || 0;
    gs.nextItemId = id + 1;
    f.hoardItems.push({ ...base, effect: { ...base.effect }, id });
  };
  if (kcRng() < T.itemChance) roll();
  if (kcRng() < T.bonusItem) roll();
  if (kcRng() < (T.thirdItem || 0)) roll();
}
// The tier a lair of this power holds. Since 2026-09-11 this is simply the guardian's own power.
function lairItemTier(power) {
  return ITEM_TIER_OF_POWER[power] || 1;
}
// BALANCED STOCKING. At world generation (and for any lair still unstocked in an older save):
// 1. every LEGENDARY (tier-3) item is placed — toughest guardians first, one per lair, then a second round if
// there are more legendaries than lairs — whatever the map size;
// 2. every other hoard slot is filled so the item CATEGORIES (weapon, armour, shield, helm, cloak, ring, amulet,
// combat item, unslotted trinket) come out in equal proportion: each slot goes to the category with the
// fewest items placed so far, preferring the tier the lair's power would have rolled.
// Names stay unique game-wide (gs._awardedItems). Lairs created later in play (Discover Lost Ruin
// etc.) still draw through rollMagicItem.
function itemHoardCategory(it) {
  return itemSlot(it) || 'trinket';
}
// the Consumable slot became the Combat Item slot. A live save still holds its old tally under the
// retired key; fold it into the new one so the even-distribution draw does not decide the realm has
// never found a combat item and flood it with them. Called by BOTH the writer (noteItemFound) and
// the reader (rollMagicItemFor) — patching only one leaves the other stale.
function migrateHoardTally(pl) {
  if (!pl || !pl._itemsFoundByCat) return;
  const t = pl._itemsFoundByCat;
  if (t.consumable != null) {
    t.combat = (t.combat || 0) + t.consumable;
    delete t.consumable;
  }
}
