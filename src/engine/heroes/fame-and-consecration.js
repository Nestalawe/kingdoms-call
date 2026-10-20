// ── HERO FAME ── a wandering hero's reputation is described, never numbered: the Hire and Broker
// dropdowns quote the same words the Intelligence report uses. Module level; buildPlayerReport's
// own copies delegate here so the two can never drift apart.
function skillFameLabelM(level) {
  const l = level || 0;
  return l >= 7 ? 'has a heroic level of' : l >= 4 ? 'legendary for' : 'renowned for';
}
function topSkillOf(char) {
  const skills = Object.entries((char && char.skills) || {}).filter(([, v]) => v > 0);
  if (!skills.length) return null;
  const maxLevel = Math.max(...skills.map(([, v]) => v));
  const tied = skills.filter(([, v]) => v === maxLevel);
  // Deterministic tie-break by canonical skill order, so the same hero reads the same everywhere.
  tied.sort((a, b) => ALL_SKILLS.indexOf(a[0]) - ALL_SKILLS.indexOf(b[0]));
  const [sk, lv] = tied[0];
  return { skill: sk, level: lv };
}
function itemNameList(items, withDesc) {
  const wd = withDesc !== false;
  return (items || [])
    .map((d) => (isLegendaryItem(d) ? 'the LEGENDARY ' : 'the ') + d.name + (wd && d.desc ? ' (' + d.desc + ')' : ''))
    .join(', ');
}
// Which race / alignment an item is bound to, if any; an item a character cannot use is inert in
// their hands. 2026-09-10 item 3: race-bound items were tagged 'Elf'/'Dwarf'/'Orc' while characters
// carry 'Elven'/ 'Dwarven'/'Orcish', so every non-Human race-bound item was inert in its OWN race's
// hands. The item data now uses the canonical names; this alias map keeps items already rolled into
// saved games working.
const _ITEM_RACE_ALIAS = { ...KC_ITEM_RACE_ALIAS };
function itemRaceOf(it) {
  const r = it && it.race;
  return r ? _ITEM_RACE_ALIAS[r] || r : r;
}
function itemUsableBy(it, c) {
  if (!it) return false;
  if (it.race && (!c || c.race !== itemRaceOf(it))) return false;
  if (it.alignment && (!c || c.alignment !== it.alignment)) return false;
  return true;
}

// ── MITHRIL ARMOUR ── A GRANTED (never lair-rolled) relic worn by Dwarven characters of a Dwarven
// realm. Kept out of ALL_MAGIC_ITEMS_P so rollMagicItem never awards it and every qualifying dwarf
// can hold their own copy. Effect stat 'mithrilArmour' reduces melee damage dealt to the wearer by
// 2 (applied per-hit in pcMeleeDamage; non-stacking — one suit is enough).
const MITHRIL_ARMOUR = {
  name: 'Mithril Armour',
  slot: 'armour',
  desc: 'Melee and arrow attacks against the wearer deal 2 less damage',
  lore: "A suit of the dwarves' own mithril, light as linen and harder than steel; granted to every dwarven character of a dwarven realm and never found in a lair. Every melee blow or arrow that lands on the wearer deals 2 less damage (never below 1).",
  effect: { stat: 'mithrilArmour', bonus: 2 },
  tier: 1,
};
// duplicate items of the SAME type (same name) do NOT stack — a character may hold several, but
// only ONE of each name has any effect. Every place that sums item effects runs the item list
// through this first. (Different items that happen to share a stat still stack normally.) a Divine
// realm may now hold MULTIPLE consecrated provinces — up to the king's White skill level, that many
// at any one time. Consecration is stored as a LIST
// (player.consecratedProvIds); this helper returns it, migrating any legacy single `consecratedProvId`
// save into the list on first read.
// 2026-09-24 (Toby item 7): only the profane profit from casting down altars — an UNDEAD realm's
// column always rises a level, an EVIL realm's has a 50% chance per unit, everyone else gains nothing.
const CONSEC_CAPTURE_XP_PCT_BY_ALIGNMENT = { Undead: 100, Evil: 50 };
function consecCaptureXpPct(pl) {
  return (pl && CONSEC_CAPTURE_XP_PCT_BY_ALIGNMENT[pl.alignment]) || 0;
}
function consecratedIds(pl) {
  if (!pl) return [];
  if (!Array.isArray(pl.consecratedProvIds)) {
    pl.consecratedProvIds = pl.consecratedProvId != null ? [pl.consecratedProvId] : [];
    if ('consecratedProvId' in pl) delete pl.consecratedProvId; // fold the old single field into the list
  }
  return pl.consecratedProvIds;
}
function isConsecrated(pl, provId) {
  return consecratedIds(pl).includes(provId);
}
// DIVINE RETURN needs holy ground. The consecrated provinces a realm still OWNS — the only places a
// fallen Divine character can be restored. `nearestConsecratedProv` picks the one closest (hex
// distance, ties → the richer) to where the body lies.
function ownedConsecratedProvs(state, pi) {
  const pl = (state.players || [])[pi];
  if (!pl) return [];
  return consecratedIds(pl)
    .map((id) => state.world.provinces[id])
    .filter((pv) => pv && pv.owner === pi);
}
function nearestConsecratedProv(state, pi, fromProvId) {
  const list = ownedConsecratedProvs(state, pi);
  if (!list.length) return null;
  const from = fromProvId != null ? state.world.provinces[fromProvId] : null;
  if (!from) return list[0];
  let best = null,
    bd = Infinity;
  list.forEach((pv) => {
    const d = hexDistP(from, pv, state.world.cols);
    if (d < bd || (d === bd && (pv.tax || 0) > ((best && best.tax) || 0))) {
      bd = d;
      best = pv;
    }
  });
  return best;
}
// a neutral province guard becomes an ordinary wandering hero (hireable, listed under Wandering
// Heroes, labelled "(wandering)"). Used when a guard survives the loss of his last unit, and by the
// turn-start / pre-report safety net for any guard left troopless or standing in a player's land.
function demoteGuardToWanderer(h) {
  if (!h) return;
  h._isNeutralGuard = false; // (armies are left as they are — the combat site has already emptied them)
  const base = String(h.name || '')
    .replace(/\s*\(wandering\)/gi, '')
    .trim();
  h.name = base + ' (wandering)';
}
// the inverse of demoteGuardToWanderer. The ' (wandering)' suffix is baked into the NAME, so EVERY
// path that puts a masterless hero into a realm's service must take it off again — the Hire order
// did, but Charm's permanent join and Resurrect did not, leaving heroes called "Marigold the Bright
// (wandering)" serving a crown. One helper, used by all of them.
function claimWandererName(h) {
  if (!h) return;
  h.name = String(h.name || '')
    .replace(/\s*\(wandering\)/gi, '')
    .trim();
}
// Safety net for saves already carrying the bug (and for any future path that forgets): no
// character who serves a crown may wear the wandering tag. Run at turn start. Returns the number
// repaired.
function normaliseOwnedNames(gs) {
  let n = 0;
  (gs.characters || []).forEach((c) => {
    if (!c || c.player == null) return;
    if (/\(wandering\)/i.test(String(c.name || ''))) {
      claimWandererName(c);
      n++;
    }
  });
  return n;
}
// Safety net: every living neutral "guard" who leads no troops, or who stands in a province a
// player now owns, is really a wanderer — normalise them. Returns the number repaired.
function normaliseStrandedGuards(gs) {
  let n = 0;
  (gs.characters || []).forEach((c) => {
    if (!c || c.player !== null || !c.alive || !c._isNeutralGuard) return;
    const pv = ((gs.world && gs.world.provinces) || [])[c.location];
    if ((c.armies || []).length === 0 || (pv && pv.owner != null)) {
      demoteGuardToWanderer(c);
      n++;
    }
  });
  return n;
}
// consecration is holy ground anyone can SEE (altars, standing stones), not a private fact of the
// owner. This tells us whether a province is consecrated by its CURRENT owner, so the map can mark
// it for every player who can see the province — not only the Divine king who blessed it.
function provinceConsecrated(gs, prov) {
  if (!prov || prov.owner == null) return false;
  const owner = gs && gs.players && gs.players[prov.owner];
  return !!owner && isConsecrated(owner, prov.id);
}
// relation lookup usable at MODULE level (buildTurnReport can't reach the runTurn-nested
// areEnemies/relationBetween). Relations live in gs.relations keyed "min-max".
function relOfReport(gs, a, b) {
  if (a == null || b == null || a === b) return 'neutral';
  const k = a < b ? a + '-' + b : b + '-' + a;
  return (gs.relations || {})[k] || 'neutral';
}
// Deterministic 0..1 roll so the same (turn, viewer, enemy, province) always resolves the same way
// — the map is built once, but this keeps a GM preview and the saved report identical, and re-rolls
// each turn.
function detRoll(turn, viewerPi, charId, provId) {
  let h = 2166136261 >>> 0;
  const s = turn + '|' + viewerPi + '|' + charId + '|' + provId;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h >>> 0) / 4294967296;
}
// Detection of an ENEMY character lurking in a province you OWN but have no character standing in.
// Chance = your exploration% of the province, −20%/enemy Spy level (cap L5), +10%/highest friendly
// (own or allied) Spy level present (cap L5), clamped 5–95%. Replaces the flat _unspottedTurn cloak
// for owned provinces. Kings roll exactly as heroes do. Returns true if spotted.
function spotEnemyInOwnedProvince(gs, viewerPi, prov, enemyChar, turn) {
  // turn: the report's turn (default gs.turn)
  // 2026-09-21 — A PROVINCE YOU HOLD IS GROUND YOU KNOW.
  // This read `exploredBy[viewerPi]`, and NOTHING writes that on conquest — only marching in does,
  // at +10% (+5%/Explorer) a visit. So a province taken by the sword sat at 10–20% "explored" for
  // its new owner forever, and the sum below fell straight through the 5% floor against any hero
  // with a single point of Spy. The result: the surviving heroes of a realm whose lands had all
  // been overrun could stand still in the conqueror's own province and be invisible ~95% of turns
  // — never in a sighting, never on the map, never in the Encounter list, so no one could get at
  // them at all. This function is ONLY ever called for a province the viewer owns (see
  // enemyCharVisibleTo), so the owner's knowledge of the ground is full by definition: his
  // tax-collectors, garrison and villagers walk it every day, whatever share of it his explorers
  // happened to chart. The contest that remains is the one that was always meant to be here — the
  // lurker's Spy against the watchers'.
  const explored = 100;
  const enemySpy = Math.min(5, (enemyChar.skills && enemyChar.skills.spy) || 0);
  let friendlySpy = 0;
  (prov.characters || []).forEach((cid) => {
    const f = gs.characters[cid];
    if (!f || !f.alive || f.player == null) return;
    const friendly = f.player === viewerPi || relOfReport(gs, viewerPi, f.player) === 'allied';
    if (friendly) friendlySpy = Math.max(friendlySpy, (f.skills && f.skills.spy) || 0);
  });
  friendlySpy = Math.min(5, friendlySpy);
  // …and no one hides in another realm's land indefinitely. The floor is 25%, not 5%: a Spy-5 hero
  // squatting in a province you hold is now found roughly every fourth turn instead of every
  // twentieth, so a hunt can always eventually be brought to him. Shimmer still halves it.
  let chance = Math.max(
    25,
    Math.min(
      95,
      explored -
        20 * enemySpy +
        10 * friendlySpy +
        discSumOf(
          gs.players && gs.players[viewerPi],
          'spotLurker',
          'pct',
          (e) =>
            (!e.terrains || e.terrains.includes(prov.terrain)) &&
            (!e.home || homeFounderOf(gs, prov.id) === viewerPi) &&
            (!e.coastal || discProvCoastal(gs, prov)),
        ),
    ),
  ); // + spotLurker discoveries (sd60 Watch Houses)
  if (perkTier(enemyChar, 'illusory') >= 1) chance = Math.max(5, chance * 0.5); // ILLUSORY L6 (Shimmer): half as likely to be found
  return detRoll(turn != null ? turn : gs.turn, viewerPi, enemyChar.id, prov.id) * 100 < chance;
}
