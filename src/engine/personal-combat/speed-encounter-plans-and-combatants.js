import { NPC_SCHOOL_SPELL } from '../army-tables.js';
import { temperOf } from '../world/tables.js';
import { GUARDIAN_BODY_CAP_PCT, _escapesTheEnd, monsterCat } from '../names.js';
import { activeItems, effTemper } from '../items/equipment.js';
import { dedupeItemsByName, guardianPassives } from '../heroes/skills-and-hp.js';
import { pcArmourMerge, pcArmourOf } from './helpers.js';
import { rng } from '../dice-and-army-names.js';
import { pcSkillCap, perkTier, skillLevel } from '../titles/perks.js';
import { discSum, hasDisc } from '../discoveries.js';
import { charMinor } from '../titles/title-holders-and-battle-merit.js';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.js';
import { ARCHERY_FIELDCRAFT_PCT } from './melee-flight-and-archery.js';

// ── PERSONAL COMBAT: SPEED, ENCOUNTER PLANS AND COMBATANTS (plan P1-08e: lifted out of resolveTurn) ────
// The engine's overview, then who acts first and who can change range (speed), the plan an un-ordered character fights
// by (autoEncounterPlan, ensureEncounterPlan) and their answer to a challenge (duelStanceOf), and the two combatant
// builders: a character (pcCharCombatant) and a guardian (pcMonsterCombatant), with their passives and item riders.
// autoEncounterPlan, ensureEncounterPlan and pcCharCombatant take the turn's context first (src/engine/turn/context.js); the rest read no
// turn state.
// ====
// UNIFIED PERSONAL COMBAT ENGINE (character-vs-character duels AND monster/feature encounters)
// ---------------------------------------------------------------------------- A "personal
// combat" is a round-based, hit-point duel between two Combatants. Each Combatant is either a
// CHARACTER (uses effStat skills + their Encounter Plan tactics) or a MONSTER (uses its own
// melee/archery/hp/spells + a simple AI). Every round each side performs the next tactic in its
// plan, resolving to-hit, damage, and any status effects. Combat spells are dispatched to
// pcCastCombatSpell(), which is where the CSV "Personal combat effect" for each spell lives.
//
// This engine is intentionally data-driven via a shared STATUS block so new spell effects can be
// added without touching the round loop:
// hp, maxHp current / maximum hit points
// stun rounds the combatant cannot act
// hitPenalty % penalty to this combatant's own to-hit (decays 5%/round)
// dodge incoming-attack difficulty multiplier vs THIS combatant
// (1 = normal, 0.5 = twice as hard to hit — Invisibility)
// meleeHalvedRounds rounds this combatant's melee damage is halved (Spiritwrack)
// silenceRounds rounds this combatant cannot cast or use archery (Spiritwrack)
// dot: [{dmg, rounds, label}] damage-over-time stacks applied at round start (Fireball etc.)
// mirrorImages decoy hits that soak incoming melee/arrows (Mirror Image)
// freeAttacksForFoe attacker gets this many un-retaliated strikes (Psychic Blast)
// fleeBonus flat % added to this combatant's flee attempts
// bestAbilityHalved flags that Curse has halved their best combat ability
// ----------------------------------------------------------------------------

// ── Speed model ────
// Numeric speed decides who acts first each round and whether a combatant can change range
// (advance to firing range, or break away from melee to fire).
// monsters: fast 3 / medium 2 / slow 1 characters: 2 + any bonus
export function pcSpeedOf(cbt) {
  if (!cbt) return 2;
  if (cbt.kind === 'monster') return { fast: 3, medium: 2, slow: 1 }[cbt.speedName || 'medium'] || 2;
  return 2 + (cbt.speedBonus || 0);
}
export function pcHasRanged(cbt) {
  if (!cbt) return false;
  if (cbt.kind === 'monster') return (cbt.archery || 0) > 0 || !!cbt.ranged;
  return (cbt.archery || 0) > 0;
}
export const PC_RANGES = ['spell', 'bow', 'melee'];
export function pcRangeStep(from, dir) {
  const i = Math.max(0, Math.min(2, PC_RANGES.indexOf(from) + dir));
  return PC_RANGES[i];
}
// Chance to change range. Advancing into firing range is a test of one's own speed; breaking back
// out of melee is an opposed contest — a faster foe pins you in place.
export function pcMoveCheck(actor, foe, mode) {
  const a = pcSpeedOf(actor),
    f = pcSpeedOf(foe);
  // a slow guardian is not penalised when ADVANCING to firing range (counts as medium).
  const aAdv = actor.kind === 'monster' ? Math.max(2, a) : a;
  let chance = mode === 'withdraw' ? 40 + 15 * (a - f) + temperOf(actor.temper).withdrawMod : 60 + 15 * (aAdv - 2);
  // FIELDCRAFT — a trained archer is good at KEEPING range, not only at shooting from it.
  if (actor.kind === 'character') {
    const _arc = actor.archeryRaw != null ? actor.archeryRaw : actor.archery || 0;
    if (_arc > 0) chance += ARCHERY_FIELDCRAFT_PCT * _arc;
  }
  return Math.max(10, Math.min(90, chance));
}

// --- NPC encounter plans ---------------------------------------------------- Neutral guards and
// wandering heroes never receive orders, so they need a plan of their own. It is built from their
// skills — best weapon first, opening with magic since every combat starts at spell range — and
// from their Temper. Berserk and Brave commit to a fight
// (aggressive actions, no Flee anywhere), so they will ISSUE a pre-battle challenge.
// Cautious and Cowardly open with Flee, so they REFUSE a challenge rather than risk single combat
// — trading 20% of their force's strength for their commander's life.
export const NPC_SPELL_BY_SCHOOL = { ...NPC_SCHOOL_SPELL };
export function autoEncounterPlan(turnContext, ch) {
  const melee = effStat(turnContext, ch, 'melee'),
    arch = effStat(turnContext, ch, 'archery');
  // NOT a copy of KC_MAGIC_SCHOOLS/KC_SKILLS: this ORDER is the tie-break priority. Leave it hand-kept (2026-09-27).
  const schools = ['elemental', 'necromancy', 'psychic', 'white', 'illusory'];
  const bestSchool = schools.reduce(
    (b, sk) => (effStat(turnContext, ch, sk) > effStat(turnContext, ch, b) ? sk : b),
    'elemental',
  );
  const magic = effStat(turnContext, ch, bestSchool);
  const temper = effTemper(ch); // equipped temper item overrides
  const avoids = temper === 'Cautious' || temper === 'Cowardly';
  // ── BATTLE-MAGIC tactics (pre-battle phase only; the personal-combat plan-filter strips CS:).
  // ── a neutral hero should put every spell they know to good use when a player attacks. List a
  // CS: entry for EVERY battle-capable school they have skill in, strongest first, so
  // pickBattleSpell casts the best USEFUL spell against whatever the enemy actually fields
  // (illusory has no battle spells, so it is skipped here — but still used in personal combat).
  const battlePlan = ['elemental', 'necromancy', 'psychic', 'white']
    .filter((s) => effStat(turnContext, ch, s) > 0)
    .sort((a, b) => effStat(turnContext, ch, b) - effStat(turnContext, ch, a))
    .map((s) => 'CS:' + s);
  // ── PERSONAL-COMBAT tactics (the 6-action budget). ──
  const plan = [];
  // A CA: spell so they also cast in a personal encounter/duel (the plan-filter keeps CA:).
  if (magic > 0) plan.push('CA:' + NPC_SPELL_BY_SCHOOL[bestSchool]);
  // Sept 2026 (bot hunter tactics): a player-led (bot) character readies a SECOND spell — the
  // per-fight cap allows two from level 2 — from a second school they know.
  // 2026-09-27 (Toby item 2): ONE ATTEMPT PER DISTINCT SPELL. The old line pushed the SAME spell
  // a second time whenever the best school stood at 2+ ("Lightning Bolt, Lightning Bolt"), which
  // is what Toby was seeing in bot plans. A second CA: entry is now added only when it is a
  // DIFFERENT spell — the next school the hero actually knows — whatever the best school's level.
  if (ch.player != null && magic > 0) {
    const second = schools
      .filter((s) => s !== bestSchool && effStat(turnContext, ch, s) > 0)
      .sort((x, y) => effStat(turnContext, ch, y) - effStat(turnContext, ch, x))[0];
    if (second && NPC_SPELL_BY_SCHOOL[second] && NPC_SPELL_BY_SCHOOL[second] !== NPC_SPELL_BY_SCHOOL[bestSchool])
      plan.push('CA:' + NPC_SPELL_BY_SCHOOL[second]);
  }
  // Final guard on the spell slots (2026-09-27, Toby item 2): whatever built the list above, no
  // spell may be attempted twice in one plan. Done here, before the bow and blade actions fill
  // the budget, so a dropped duplicate frees a real action rather than leaving a short plan.
  {
    const _seen = new Set();
    for (let i = plan.length - 1; i >= 0; i--) {
      const s = String(plan[i]).toUpperCase();
      if (!s.startsWith('CA:')) continue;
      if (_seen.has(s)) plan.splice(i, 1);
      else _seen.add(s);
    }
  }
  if (arch > 0) {
    // A Berserk charges regardless; everyone else works the bow while the range allows it.
    const shots = temper === 'Berserk' ? 1 : arch >= melee ? 3 : 1;
    for (let i = 0; i < shots; i++) plan.push('FI');
  }
  while (plan.length < (avoids ? 5 : 6)) plan.push('ME');
  // A wary NPC keeps an exit in hand — but at the END of the plan, not the start. Duel avoidance
  // is the Duel Stance's job now; putting FL first here would make them bolt from every monster
  // and character encounter on the opening action.
  if (avoids) plan.push('FL');
  // CS: entries lead (battle phase reads them first); the 6-action combat plan follows.
  return [...battlePlan, ...plan.slice(0, 6)];
}
// How a commander answers the call to single combat, set per character in the player portal.
// 'challenge' — rides out and demands a duel 'accept' — will not initiate, but answers a
// challenge 'refuse' — will not duel; costs their force 20% strength if challenged (a player's
// default since 2026-10-13, Toby: a hero with no stance set no longer answers a challenge)
export const DUEL_STANCES_P = ['challenge', 'accept', 'refuse'];
export const NPC_DUEL_STANCE_BY_TEMPER = { Berserk: 'challenge', Brave: 'challenge', Cautious: 'accept', Cowardly: 'refuse' };
export function duelStanceOf(ch) {
  const v = ch && ch.encounterPlan && ch.encounterPlan.duelStance;
  if (DUEL_STANCES_P.includes(v)) return v;
  // NPC commanders have no orders, so Temper decides — across all THREE stances, not just the two
  // extremes. Berserk and Brave ride out and demand single combat; Cautious will answer a
  // challenge but won't issue one; only the Cowardly refuse outright and shame their own ranks.
  if (ch && ch.player === null) return NPC_DUEL_STANCE_BY_TEMPER[effTemper(ch)] || 'accept';
  return 'refuse';
}

// Give any un-ordered character (player === null) a plan the moment one is needed.
export function ensureEncounterPlan(turnContext, ch) {
  const { _botPlayerIdx } = turnContext;
  if (!ch) return null;
  const t = ch.encounterPlan && ch.encounterPlan.tactics;
  // Auto-plan NEUTRAL characters (NPCs) — and BOT-controlled ones, which never submit a plan
  // through the portal. Without this a bot commander casts no battle magic and fights duels with
  // no tactics.
  const isBotCh = ch.player != null && _botPlayerIdx && _botPlayerIdx.has(ch.player);
  if ((ch.player === null || isBotCh) && (!Array.isArray(t) || t.length === 0)) {
    const kept =
      ch.encounterPlan && ch.encounterPlan._botStance && DUEL_STANCES_P.includes(ch.encounterPlan.duelStance)
        ? ch.encounterPlan.duelStance
        : null; // Sept 2026: a bot's own stance (botSetDuelStances) is a judgement, not a temper
    ch.encounterPlan = {
      tactics: autoEncounterPlan(turnContext, ch),
      notes: '',
      _auto: true,
      duelStance: kept || NPC_DUEL_STANCE_BY_TEMPER[effTemper(ch)] || 'accept',
      _botStance: !!kept,
    };
  }
  return ch.encounterPlan;
}

// --- Combatant builders -----------------------------------------------------
export function pcNewStatus() {
  return {
    stun: 0,
    hitPenalty: 0,
    dodge: 1,
    meleeHalvedRounds: 0,
    silenceRounds: 0,
    dot: [],
    mirrorImages: 0,
    freeAttacksForFoe: 0,
    fleeBonus: 0,
    fleePenalty: 0,
    reflect: 0,
    absorb: 0,
    incomingDmgBonus: 0,
    bestAbilityHalved: false,
    nextAttackFails: 0,
    hitPenaltyFixed: 0, // a to-hit penalty that lasts the whole fight (does NOT fade 5%/round)
    _pending: [],
  }; // riders waiting to take hold at the start of the next round
}
// "Melee 6" alone looks like a bug when the sheet says 4. Show the boost and its size: "Archery 6
// (4 +2 bonus)". Monsters and unboosted characters print the plain figure.
export function pcSkillLabel(cbt, stat) {
  const cur = (cbt && cbt[stat]) || 0,
    base = cbt && cbt[stat + 'Base'];
  const cap = stat === 'melee' ? 'Melee' : 'Archery';
  // Only a RAISED figure is annotated. A trained level above the effect cap (e.g. Melee 9
  // fighting as 5) prints plainly — that is the cap at work, not a penalty, and the mastery perks
  // are named elsewhere.
  if (base == null || cur <= base) return `${cap} ${cur}`;
  return `${cap} ${cur} (${base} +${cur - base} bonus)`;
}
export function pcCharCombatant(turnContext, ch) {
  ensureEncounterPlan(turnContext, ch);
  const maxHp = ch.maxHp || 20;
  // Rage (AK §2.4): a Berserker shrugs off pain.
  const rg = temperOf(effTemper(ch)).rageHp;
  const rageHp = rg ? rng(rg[0], rg[1]) : 0;
  const cbt = {
    kind: 'character',
    ref: ch,
    name: ch.name,
    player: ch.player,
    // the unkillable wanderer never enters a fight at 0 HP (a stale 0 from a past escape would
    // end it before round 1).
    hp:
      ((ch.hp != null ? ch.hp : maxHp) <= 0 && _escapesTheEnd(ch)
        ? Math.max(1, Math.round(maxHp / 2))
        : ch.hp != null
          ? ch.hp
          : maxHp) + rageHp,
    maxHp: maxHp + rageHp,
    // LEVEL 6+ SKILL PERKS — Champion (melee) / Master Archer (archery): +1 per level past 5.
    // 2026-09-26 (Toby item 3) — THE CEILING OF 9 IS THE CEILING. effSkillOf already clamps
    // training + items + aura to SKILL_MAX, but the minor titles (Duelist, Widowmaker, Relic
    // Hunter) and sd37 Veteran Training were added AFTERWARDS and so rode straight past it: a
    // Melee 4 hero with +5 of items and two of those bonuses fought at "Melee 11 (4 +7 bonus)".
    // Every one of those figures now goes through pcSkillCap, so nothing a character carries or
    // holds can put Melee or Archery above 9 in a duel — for the hit chance OR for the damage.
    melee: pcSkillCap(
      effStat(turnContext, ch, 'melee') +
        (charMinor(turnContext, ch, 'duelist') ? 1 : 0) +
        (charMinor(turnContext, ch, 'widowmaker') ? 1 : 0) +
        (charMinor(turnContext, ch, 'relichunter') ? 1 : 0) +
        (ch.player != null && hasDisc(turnContext, ch.player, 'sd37') ? 1 : 0),
    ), // sd37 Veteran Training
    archery: pcSkillCap(
      effStat(turnContext, ch, 'archery') +
        (charMinor(turnContext, ch, 'marksman') ? 1 : 0) +
        (charMinor(turnContext, ch, 'widowmaker') ? 1 : 0) +
        (charMinor(turnContext, ch, 'relichunter') ? 1 : 0) +
        (ch.player != null && hasDisc(turnContext, ch.player, 'sd37') ? 1 : 0),
    ), // sd37 Veteran Training
    // Damage scales on the raw 1–9 level (levels 6–9 exist above the effStat cap of 5) — but an
    // item, aura or title that raises the skill now counts too, so a "+2 Melee" blade is felt in
    // the DAMAGE as well as the hit chance. Whichever is higher wins; nothing is lost either way.
    meleeRaw: pcSkillCap(
      Math.max(
        skillLevel(ch, 'melee'),
        effStat(turnContext, ch, 'melee') +
          (charMinor(turnContext, ch, 'duelist') ? 1 : 0) +
          (charMinor(turnContext, ch, 'widowmaker') ? 1 : 0) +
          (charMinor(turnContext, ch, 'relichunter') ? 1 : 0) +
          (ch.player != null && hasDisc(turnContext, ch.player, 'sd37') ? 1 : 0),
      ),
    ),
    archeryRaw: pcSkillCap(
      Math.max(
        skillLevel(ch, 'archery'),
        effStat(turnContext, ch, 'archery') +
          (charMinor(turnContext, ch, 'marksman') ? 1 : 0) +
          (charMinor(turnContext, ch, 'widowmaker') ? 1 : 0) +
          (charMinor(turnContext, ch, 'relichunter') ? 1 : 0) +
          (ch.player != null && hasDisc(turnContext, ch.player, 'sd37') ? 1 : 0),
      ),
    ),
    // the character's OWN trained level, so the narrative can say why "Archery 6" exceeds what
    // the sheet shows (items, titles, discoveries, aura, mastery perks).
    meleeBase: skillLevel(ch, 'melee'),
    archeryBase: skillLevel(ch, 'archery'),
    temper: effTemper(ch),
    alignment: ch.alignment, // an equipped temper item overrides the wearer's own
    school: {
      white: effStat(turnContext, ch, 'white'),
      psychic: effStat(turnContext, ch, 'psychic'),
      illusory: effStat(turnContext, ch, 'illusory'),
      elemental: effStat(turnContext, ch, 'elemental'),
      necromancy: effStat(turnContext, ch, 'necromancy'),
    },
    tactics: ((ch.encounterPlan && ch.encounterPlan.tactics) || ['ME']).slice(),
    tacIdx: 0,
    planExhausted: false,
    neverFlees: false,
    speedBonus: ch._speedBonus || 0,
    specials: [],
    mithril: activeItems(ch).some((it) => it.effect && it.effect.stat === 'mithrilArmour'), // −2 melee damage taken
    mithrilDR: 2 + (ch.player != null ? discSum(turnContext, ch.player, 'mithril', 'extra') : 0), // rd08 Mithril Craft — 3 instead of 2
    combatItems: dedupeItemsByName(activeItems(ch)).filter((it) => it.effect && it.effect.stat === 'combatUse'), // once-per-fight potions/scrolls
    arm: pcArmourOf(activeItems(ch)), // worn armour wards (see pcArmourOf / pcTakeHit)
    status: pcNewStatus(),
    castSpells: [],
    castSchool: {}, // per-combat spell limits
    isUndead: ch.alignment === 'Undead',
    // ── LEVEL 6/8 SKILL PERKS (personal combat) ──
    // Math.max(raw, effStat+minors) versions above — "+2 Melee" items never reached the damage
    // roll.)
    perkParry: perkTier(ch, 'melee') >= 1, // MELEE L6 — Parry
    perkCounter: perkTier(ch, 'melee') >= 3, // MELEE L8 — Counterattack
    perkImpale: perkTier(ch, 'archery') >= 1, // ARCHERY L6 — Impalement
    perkTrueshot: perkTier(ch, 'archery') >= 3, // ARCHERY L8 — Trueshot
    perkElemArmour: perkTier(ch, 'elemental') >= 1, // ELEMENTAL L6 — Elemental Armour
  };
  pcApplyItemFx(cbt, activeItems(ch)); // weapons / helms / cloaks / rings / amulets with combat riders
  return cbt;
}
// A monster's default action plan. Monsters get Fire actions only if they actually have a ranged
// attack (archery > 0, or an explicit `ranged` flag), and each of their special abilities appears
// in the plan as an MS: action — the monster equivalent of Cast. Plans run longer than a
// character's six so the creature stays unpredictable; when it runs out it simply keeps swinging,
// because monsters never flee. 2026-09-15: does this ability restore the guardian's OWN health?
// Tested with the very same patterns pcMonsterSpecial parses the heal out of, so the detector and
// the effect can never disagree — an ability this returns true for is exactly an ability that
// would heal.
// (A `drain` PASSIVE — Undying Thirst, Sanguine Feeding — is not an ability on the plan and is not
// covered here; it leeches a share of each melee blow and is unchanged.)
export function pcSpecialHealsSelf(sp) {
  const eff = String((sp && sp.effect) || '');
  return /heals half/i.test(eff) || /(?:regains|gains)\s*\+?\d+\s*HP/i.test(eff) || /heal|regenerat/i.test(eff);
}
export function pcMonsterPlan(m) {
  // A GUARDIAN DOES NOT OPEN BY HEALING. Now healing abilities are pulled out of the rotation
  // entirely and appended ONCE at the very end of the plan, so a guardian reaches for them only
  // if the fight has run long. pcMonsterSpecial enforces the once-per-combat rule as well, so two
  // different heal abilities cannot both fire.
  const all = m.spells || [];
  const heals = all.filter(pcSpecialHealsSelf).map((s) => 'MS:' + s.name);
  const specials = all.filter((s) => !pcSpecialHealsSelf(s)).map((s) => 'MS:' + s.name);
  const ranged = (m.archery || 0) > 0 || !!m.ranged;
  const room = Math.max(1, 12 - heals.length); // leave the tail free for the heals
  const plan = [];
  if (specials.length) plan.push(specials[0]);
  if (ranged) plan.push('FI');
  plan.push('ME');
  let si = 1,
    guard = 0;
  while (plan.length < room && guard++ < 40) {
    plan.push('ME');
    if (ranged && plan.length % 4 === 0) plan.push('FI');
    if (specials.length && plan.length % 3 === 0) {
      plan.push(specials[si % specials.length]);
      si++;
    }
  }
  return plan.slice(0, room).concat(heals);
}
// A guardian's PASSIVE: `m.passive` = {name, fx, desc}. Ward-style fx (meleeDR, arrowDR, dodge,
// regen, thorns, spellPct, cap, lowHp, secondWind, stunImmune, dotImmune) fold into the
// combatant's `arm` table exactly like worn armour; aura / burn / drain / hitBonus / dmgBonus are
// read by the engine directly. 2026-09-11: ONE applier for every fx table — guardian passives AND
// the new items' `effect.pc` riders. Stacking: wards merge, aura/drain take the best,
// burn/hitBonus/dmgBonus add.
export function pcApplyFx(cbt, fx, name) {
  if (!cbt || !fx) return;
  if (fx.ward) cbt.arm = pcArmourMerge(cbt.arm, fx, name);
  if (fx.aura > 0) cbt.aura = Math.max(cbt.aura || 0, fx.aura); // foe −N% to hit for the whole fight (status.auraPenalty)
  if (fx.burn > 0) cbt.burn = (cbt.burn || 0) + fx.burn; // foe at melee range takes N each round
  if (fx.drain > 0) cbt.drain = Math.max(cbt.drain || 0, fx.drain); // heals this fraction of melee damage dealt
  if (fx.hitBonus > 0) cbt.status.hitBonus = (cbt.status.hitBonus || 0) + fx.hitBonus;
  if (fx.dmgBonus > 0) cbt.dmgBonus = (cbt.dmgBonus || 0) + fx.dmgBonus;
}
export function pcApplyMonsterPassive(cbt, m) {
  // 2026-10-14 (batch item 7): every perk of the guardian, not just one. `passiveName` stays the
  // first (its signature perk); `_perkName` names the perk behind each effect for the narrative.
  const ps = guardianPassives(m);
  if (!ps.length) return;
  cbt.perks = ps.map((p) => ({ name: p.name, desc: p.desc || '' }));
  cbt._perkName = {};
  cbt.passiveName = ps[0].name;
  cbt.passiveDesc = ps[0].desc || '';
  ps.forEach((p) => {
    const k = p.fx.ward || Object.keys(p.fx)[0];
    if (k && !cbt._perkName[k]) cbt._perkName[k] = p.name;
    pcApplyFx(cbt, p.fx, p.name);
  });
}
// Items a CHARACTER wears that carry a personal-combat rider (`effect.pc`) — one copy of each
// name counts.
export function pcApplyItemFx(cbt, items) {
  dedupeItemsByName(items || []).forEach((it) => {
    if (it && it.effect && it.effect.pc) pcApplyFx(cbt, it.effect.pc, it.name);
  });
}
export function pcMonsterCombatant(m) {
  // a guardian enters EVERY fight at full health — it heals completely at the end of each combat
  // (see resolveEncounter). _hpFull is the creature's undamaged total; m.hp is only consulted
  // when _hpFull was never set (fresh table creature).
  const maxHp = m._hpFull != null ? m._hpFull : m.hp || 10;
  const curHp = maxHp;
  const nm = m.name || 'creature';
  const undeadWords = [
    'Lich',
    'Vampi',
    'Death',
    'Bone',
    'Skeleton',
    'Wraith',
    'Ghoul',
    'Ghost',
    'Zombie',
    'Drowned',
    'Wight',
    'Mummif',
    'Banshee',
    'Dracolich',
  ];
  const cbt = {
    kind: 'monster',
    ref: m,
    name: nm,
    player: null,
    hp: curHp,
    maxHp,
    melee: m.melee || 1,
    archery: m.archery || 0,
    ranged: !!m.ranged,
    temper: 'None',
    neverFlees: true, // guardians carry no hero-style temper (no second wind, no "(Brave)")
    school: { white: 0, psychic: 0, illusory: 0, elemental: 0, necromancy: 0 },
    specials: (m.spells || []).slice(),
    speedName: m.speed || 'medium',
    tactics: pcMonsterPlan(m),
    tacIdx: 0,
    planExhausted: false,
    pacifiable: false,
    vuln: { melee: 1, archery: 1, spell: 1 },
    status: pcNewStatus(),
    castSpells: [],
    castSchool: {},
    isUndead: monsterCat(m) === 'undead' || undeadWords.some((w) => nm.includes(w)),
    cat: monsterCat(m),
    weak: m.weak ? { ...m.weak } : null, // the flaw a player can learn and exploit
    power: m.power || 'Weak', // 2026-09-26: read by the Spiritwrack shrug (Powerful / Legendary guardians)
  };
  pcApplyMonsterPassive(cbt, m);
  // band-wide body cap — see GUARDIAN_BODY_CAP_PCT. Merged AFTER the creature's own passive so
  // pcArmourMerge can reconcile the two; the merge keeps the looser of the two caps, which is
  // correct here because the band figure is a floor on toughness, not a ceiling on it.
  {
    const _bandCap = GUARDIAN_BODY_CAP_PCT[m.power] || 0;
    const _ownCap = (cbt.arm && cbt.arm.cap) || 0;
    if (_bandCap > 0) cbt.arm = pcArmourMerge(cbt.arm, { ward: 'cap', pct: _bandCap }, 'its sheer bulk');
    if (_ownCap > 0 && _ownCap < _bandCap) cbt.arm.cap = _ownCap;
  } // a perk's tighter cap (Elder Titan, Kraken: 15%) is never loosened by the grade's
  return cbt;
}
