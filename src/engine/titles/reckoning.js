import { KC_MAGIC_SCHOOLS, KC_UNIT_CLASS, TITLE_DEFS } from '../../content/kingdoms-call-data.js';
import { CREATURE_ARMIES, MONSTER_ARMIES } from '../units/movement.js';
import { ITEMS_BY_TIER } from '../items/tiers-and-hoards.js';
import { activeItems } from '../items/equipment.js';
import { botConceded } from '../bots/intel.js';
import { RECKONING_CALLER_MIN_FRAC, RECKONING_MIN_TURN, RELIC_PRIZE_EACH, _MAGIC_SCHOOLS, _skillItem, reckoningAllyStepPct, reckoningDecayOf, reckoningThreshold, skillLevel } from './perks.js';

export function _legendaryNames() {
  return new Set((ITEMS_BY_TIER[4] || []).map((it) => it.name));
}
// THE SEA LORD NO LONGER COUNTS THE WAVES. `SEA_LORD_PROVINCE_PTS` gave one merit point per sea
// province the character's REALM held, folded into every one of that realm's characters. It was the
// only territorial component in any character title, and it meant a realm that ruled the deep could
// hold the Sea Lord's baton on geography alone with a mediocre admiral. Withdrawn: the title is now
// the admiral's own Naval skill and the battles they have actually won at sea.
export function _charTitleMerit(c, ctx) {
  const tm = c.tm || {};
  const magic = _MAGIC_SCHOOLS.reduce((s, sc) => s + _skillItem(c, sc), 0);
  const spellItems = activeItems(c).filter((it) => it.effect && _MAGIC_SCHOOLS.includes(it.effect.stat)).length;
  return {
    // 2026-09-16 \u2014 ROOT CAUSE of "The Grand Marshal shows as vacant even though it is
    // awarded". It was not a display fault: the title really WAS vacant. `marshal` was the only one
    // of the nine titles whose metric was PURE battle merit with no standing component, and
    // computeStandings requires merit > 0 to hand a title out. tm.marshal only ever moves in a
    // player-vs-player land battle (creditBattle), and it moves DOWN for the loser \u2014 so in any
    // game where the realms have not yet fought each other on land, or where the wins and losses
    // have cancelled, every character sat at 0 and the title fell vacant while all eight others
    // were held. The Sea Lord has always carried `_skillItem(c,'naval')` as its standing component
    // for exactly this reason; the Grand Marshal now carries Tactical the same way. A realm's best
    // general holds the marshal's baton from turn one, and battle merit decides it the moment
    // anyone fights.
    marshal: (tm.marshal || 0) + _skillItem(c, 'tactical'),
    sea: (tm.sea || 0) + _skillItem(c, 'naval'),
    monster: tm.monster || 0,
    // the Loremaster was a THREE-SKILL BUNDLE (Explorer + Spy + Sage) that also counted every map
    // feature stumbled across at double weight. It swallowed the whole espionage and exploration
    // space, so no Spy or Explorer character could ever be honoured for what they actually did.
    // Explorer now belongs to the Cartographer and Spy to the Spymaster; the Loremaster keeps the
    // scholar's own skill and the discoveries their research has produced, at one point apiece.
    lore: _skillItem(c, 'sage') + (tm.discoveries || 0),
    arch: magic + spellItems,
    // Druid withdrawn \u2014 the Hierophant is a title of the White faith, and folding in a second
    // skill let a druid with no holy casts at all out-score a working priest.
    hiero: _skillItem(c, 'white') + (tm.holyCasts || 0),
    necro: _skillItem(c, 'necromancy') + (tm.darkCasts || 0),
    // ── 2026-09-17: the four new titles ────
    // `tm.spyActions` counts SUCCESSES only (see the spy/sabotage/assassination sites); a failed
    // infiltration earns nothing. `tm.explored` banks raw percentage POINTS of ground mapped and is
    // divided down here, so the accumulator keeps its precision and only the score is coarse.
    spy: _skillItem(c, 'spy') + (tm.spyActions || 0),
    carto: _skillItem(c, 'explorer') + Math.floor((tm.explored || 0) / 10),
    // Pure deed titles, like the Monster-Bane: no standing skill floor, so they sit vacant until
    // somebody actually musters beasts. That is intended \u2014 there is no "beast skill" to stand
    // on.
    beast: tm.monsterHost || 0,
    wild: tm.wildHost || 0,
  };
}
// A realm's Reckoning bloc = THAT REALM AND ITS OWN DIRECT ALLIES. Nobody else.
//
// ROOT CAUSE of "the bloc maths makes no sense once players can ally freely". Toby's own example:
// in a 4-realm game A is allied with B and C, and B is separately allied with D. Those are two
// blocs (A+B+C, and B+D), but the
// closure walked A→B→D and returned all four realms as ONE bloc holding 100% of the world, so every
// one of them could Call the Reckoning on the strength of an alliance that half of them were not
// party to — including realms actively at war with each other. Measured over 30,000 random mature
// worlds the closure made a claim callable in 53% of them against 44.6% for direct allies, with an
// average "bloc" of 3.3 realms.
//
// A claim is now carried by the realms the claimant is ACTUALLY allied to. An ally's own alliances
// are that ally's business; they bring themselves to the claim, not their friends. Each of those
// allies also raises the bar (reckoningAllyStepPct), so a bloc is a real commitment rather than a
// free ride, and a bloc padded with tiny passengers is worse than no bloc at all.
export function alliedBloc(state, pi) {
  const rel = state.relations || {},
    np = (state.players || []).length;
  const key = (a, b) => (a < b ? a + '-' + b : b + '-' + a);
  const out = [pi];
  for (let y = 0; y < np; y++) {
    if (y !== pi && rel[key(pi, y)] === 'allied') out.push(y);
  }
  return out;
}
// Main scoring — pure function over a game state. Returns titles, relics, per-realm standings, tax.
export function computeStandings(state) {
  const players = state.players || [];
  const chars = (state.characters || []).filter((c) => c && c.player != null && c.alive);
  // Reckoning tax base counts EVERY province — land AND sea (owned sea now carries features,
  // guardians and real tax, so a fleet realm's waters DO count toward the Reckoning). Both the
  // per-player share (numerator) and the world total (denominator) include sea.
  const taxByPlayer = players.map((p, pi) =>
    ((state.world && state.world.provinces) || []).reduce((s, pv) => s + (pv && pv.owner === pi ? pv.tax || 0 : 0), 0),
  );
  // Denominator = every province in the world (owned or neutral-and-conquerable), sea included.
  const worldTax = ((state.world && state.world.provinces) || []).reduce((s, pv) => {
    if (!pv) return s;
    return s + (pv.tax || 0);
  }, 0);
  const goldByPlayer = players.map((p) => (p && p.gold) || 0);
  const perChar = {};
  // the per-alignment \u00d71.25 lane boost is gone (see ALIGN_TITLE_BOOST's obituary above). A
  // character's merit is now exactly what their deeds, skills and holdings come to, whatever creed
  // their realm follows.
  chars.forEach((c) => {
    perChar[c.id] = _charTitleMerit(c);
  });
  const titles = {};
  TITLE_DEFS.forEach((t) => {
    if (t.key === 'throne' || t.key === 'vault') {
      const metric = t.key === 'throne' ? taxByPlayer : goldByPlayer;
      let best = -1,
        bi = -1;
      metric.forEach((v, pi) => {
        if (v > best) {
          best = v;
          bi = pi;
        }
      });
      const king = chars.find((c) => c.isKing && c.player === bi);
      titles[t.key] = {
        playerIndex: bi >= 0 && best > 0 ? bi : null,
        charId: bi >= 0 && best > 0 && king ? king.id : null,
        merit: best,
        prize: t.prize,
        name: t.name,
      };
    } else {
      let best = -Infinity,
        bc = null;
      chars.forEach((c) => {
        const v = perChar[c.id][t.key] || 0;
        if (v > best) {
          best = v;
          bc = c;
        }
      });
      titles[t.key] = {
        playerIndex: bc && best > 0 ? bc.player : null,
        charId: bc && best > 0 ? bc.id : null,
        merit: best > -Infinity ? best : 0,
        prize: t.prize,
        name: t.name,
      };
    }
  });
  const legNames = _legendaryNames(),
    relics = [];
  chars.forEach((c) =>
    (c.items || []).forEach((it) => {
      if (it && legNames.has(it.name)) relics.push({ item: it.name, charId: c.id, playerIndex: c.player });
    }),
  );
  const standings = players.map((p, pi) => ({
    index: pi,
    name: (p && p.name) || 'Realm ' + (pi + 1),
    color: (p && p.color) || null,
    alignment: (p && p.alignment) || null,
    score: 0,
    titles: [],
    relics: 0,
  }));
  TITLE_DEFS.forEach((t) => {
    const h = titles[t.key];
    if (h && h.playerIndex != null) {
      standings[h.playerIndex].score += t.prize;
      standings[h.playerIndex].titles.push(t.key);
    }
  });
  relics.forEach((r) => {
    if (r.playerIndex != null) {
      standings[r.playerIndex].score += RELIC_PRIZE_EACH;
      standings[r.playerIndex].relics++;
    }
  });
  return {
    titles,
    relics,
    standings,
    taxByPlayer,
    worldTax,
    goldByPlayer,
    threshold: reckoningThreshold(players.length, reckoningDecayOf(state)),
    perChar,
  };
}
// THE TITLE RACE, as one realm sees it. For every Imperial Title: which of this realm's living
// characters stands highest, and where that puts them —
//   • not the holder → `pct` = their merit as a whole percentage of the HOLDER's (floored, 0-100);
//   • the holder     → `leadPct` = 100 − (the closest RIVAL-realm character's merit as a percentage
//                       of the holder's), i.e. how many percentage points clear they are. A rival
//                       is a character of ANOTHER realm; the holder's own second-best is no rival.
// Realm titles (Throne, Vaultkeeper) use the realm metric and name the king. Only percentages are
// shipped — never a rival's name or raw merit — so this leaks nothing the standings board does not.
export function titleRaceFor(state, st, pi) {
  const chars = (state.characters || []).filter((c) => c && c.player != null && c.alive);
  const out = {};
  const pctOf = (v, top) => (top > 0 ? Math.max(0, Math.min(100, Math.floor((Math.max(0, v) / top) * 100 + 1e-9))) : 0);
  TITLE_DEFS.forEach((t) => {
    const h = (st.titles || {})[t.key] || {};
    const held = h.playerIndex != null,
      top = held ? h.merit || 0 : 0,
      mine = held && h.playerIndex === pi;
    let myBest = 0,
      myChar = null,
      rivalBest = 0;
    if (t.key === 'throne' || t.key === 'vault') {
      const metric = (t.key === 'throne' ? st.taxByPlayer : st.goldByPlayer) || [];
      myBest = metric[pi] || 0;
      const k = chars.find((c) => c.isKing && c.player === pi);
      myChar = k || null;
      metric.forEach((v, i) => {
        if (i !== pi && (v || 0) > rivalBest) rivalBest = v || 0;
      });
    } else {
      let b = -Infinity;
      chars.forEach((c) => {
        const v = ((st.perChar || {})[c.id] || {})[t.key] || 0;
        if (c.player === pi) {
          if (v > b) {
            b = v;
            myChar = c;
          }
        } else if (v > rivalBest) rivalBest = v;
      });
      myBest = b > -Infinity ? b : 0;
      if (mine && h.charId != null) {
        const hc = chars.find((c) => c.id === h.charId);
        if (hc) myChar = hc;
      }
    }
    out[t.key] = {
      charName: myChar && (myBest > 0 || mine) ? myChar.name : null,
      vacant: !held,
      mine,
      pct: !held || mine ? null : pctOf(myBest, top),
      leadPct: mine ? 100 - pctOf(rivalBest, top) : null,
      unchallenged: mine && !(rivalBest > 0),
    };
  });
  return out;
}
// Winner at a Reckoning: highest standing, ties broken by tax base then treasury.
export function reckoningWinner(state) {
  const s = computeStandings(state);
  let best = null;
  s.standings.forEach((st) => {
    if (!best) {
      best = st;
      return;
    }
    const a = [st.score, s.taxByPlayer[st.index], s.goldByPlayer[st.index]];
    const b = [best.score, s.taxByPlayer[best.index], s.goldByPlayer[best.index]];
    if (a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])))) best = st;
  });
  return { winner: best, standings: s };
}
// Share of world tax base held by a player's allied bloc (bloc-aware Reckoning threshold).
export function reckoningBlocShare(state, pi) {
  const s = computeStandings(state);
  const bloc = alliedBloc(state, pi);
  const blocTax = bloc.reduce((sum, b) => sum + (s.taxByPlayer[b] || 0), 0);
  return s.worldTax > 0 ? blocTax / s.worldTax : 0;
}
// A realm's OWN share of the world tax base — allies excluded.
export function reckoningOwnShare(state, pi) {
  const s = computeStandings(state);
  return s.worldTax > 0 ? (s.taxByPlayer[pi] || 0) / s.worldTax : 0;
}
// The bar THIS realm's claim must carry — its own bloc's size decides it.
export function reckoningThresholdFor(state, pi) {
  return reckoningThreshold((state.players || []).length, reckoningDecayOf(state), alliedBloc(state, pi).length);
}
// May THIS realm lodge the claim? Bloc share carries the bar; the caller still has to be a
// contributor worth naming; and no claim at all stands before RECKONING_MIN_TURN. Returns {ok,
// blocShare, ownShare, threshold, callerMin, blocSize, soloThreshold, minTurn, reason}.
// `reason` is one of null | 'tooEarly' | 'blocShort' | 'callerShort'.
export function reckoningCallEligibility(state, pi) {
  const nP = (state.players || []).length,
    dec = reckoningDecayOf(state);
  const bloc = alliedBloc(state, pi);
  const thr = reckoningThreshold(nP, dec, bloc.length);
  const callerMin = thr * RECKONING_CALLER_MIN_FRAC;
  const blocShare = reckoningBlocShare(state, pi);
  const ownShare = reckoningOwnShare(state, pi);
  const tooEarly = (state.turn || 1) < RECKONING_MIN_TURN && !state.gameOver;
  const reason = tooEarly ? 'tooEarly' : blocShare < thr ? 'blocShort' : ownShare < callerMin ? 'callerShort' : null;
  return {
    ok: !reason,
    blocShare,
    ownShare,
    threshold: thr,
    callerMin,
    reason,
    blocSize: bloc.length,
    allyStep: reckoningAllyStepPct(nP) / 100,
    soloThreshold: reckoningThreshold(nP, dec, 1),
    minTurn: RECKONING_MIN_TURN,
  };
}
// Phase 5 — a bot KING calls the Reckoning when it dominates the world, so bots actually END (and
// win) games instead of expanding forever. Bots never ally, so this is always a single-realm claim.
// The engine (12151) re-checks share ≥ threshold at resolution, so this only needs to add eligible
// bot kings to the reckoningCalls set built from human orders. During a rival's active Reckoning a
// trailing bot keeps warring/expanding as usual, which naturally pressures the claimant (focused
// anti-leader targeting is a later tuning pass).
export function runBotReckoning(G, botIdxSet, reckoningCalls) {
  if (!botIdxSet || !botIdxSet.size || !reckoningCalls) return;
  if (G.reckoning || G.gameOver) return; // a claim is already live / game already decided
  if ((G.turn || 0) < RECKONING_MIN_TURN) return; // no claim before turn 10
  botIdxSet.forEach((pi) => {
    if (botConceded(G, pi)) return; // a conceded realm claims nothing
    const kingAlive = (G.characters || []).some((c) => c && c.alive && c.isKing && c.player === pi);
    if (kingAlive && reckoningCallEligibility(G, pi).ok) reckoningCalls.add(pi); // bloc bar AND the caller's own floor
  });
}
export const _TITLE_LABEL = {
  throne: 'Throne',
  vault: 'Vaultkeeper',
  marshal: 'Grand Marshal',
  sea: 'Sea Lord',
  monster: 'Monster-Bane',
  lore: 'Loremaster',
  arch: 'Archmage',
  hiero: 'Hierophant',
  necro: 'Deathpriest',
  spy: 'Spymaster',
  carto: 'Cartographer',
  beast: 'Beastlord',
  wild: 'Wildwarden',
};

// ── MINOR TITLES ── 20 honorary titles that do NOT count toward victory but each grant the holding
// character a small perk. Each is awarded every turn to the single best living character by its
// metric (ties → first found; a metric of 0 leaves the title vacant). See the design doc.
export const MINOR_CAV = new Set(KC_UNIT_CLASS.cavalry); // flyers are not cavalry — matches CAVALRY_TYPES and the rulebook
export const MINOR_HEAVY = new Set([
  'Mountain Guns',
  'Dwarf Ironclads',
  'Galleon Fleet',
  'Corsair Fleet',
  'Elven Galleys',
  'Orcish Longships',
  'Whale Cohort',
  'Great Turtles',
  'Siege Towers',
]); // the ferries count (the turtles since Island Back, 2026-10-13)
export const _BEST_SCHOOL = (c) => Math.max(0, ...KC_MAGIC_SCHOOLS.map((s) => skillLevel(c, s)));
export const MINOR_TITLES = [
  {
    key: 'duelist',
    name: 'The Duelist',
    perk: '+1 melee in personal combat',
    req: 'Highest Melee skill of any living character.',
    metric: (c) => skillLevel(c, 'melee'),
  },
  {
    key: 'marksman',
    name: 'The Marksman',
    perk: '+1 archery in personal combat',
    req: 'Highest Archery skill.',
    metric: (c) => skillLevel(c, 'archery'),
  },
  {
    key: 'strategist',
    name: 'The Strategist',
    perk: '+1 Tactical command in battle',
    req: 'Highest Tactical skill.',
    metric: (c) => skillLevel(c, 'tactical'),
  },
  {
    key: 'swift',
    name: 'The Swift',
    perk: '+1 land movement point',
    req: 'Highest March skill.',
    metric: (c) => skillLevel(c, 'march'),
  },
  {
    key: 'seawolf',
    name: 'The Sea-Wolf',
    perk: '+1 sea movement point',
    req: 'Highest Naval skill.',
    metric: (c) => skillLevel(c, 'naval'),
  },
  {
    key: 'shadow',
    name: 'The Shadow',
    perk: 'your spies are never detected',
    req: 'Highest Spy skill.',
    metric: (c) => skillLevel(c, 'spy'),
  },
  {
    key: 'cutpurse',
    name: 'The Cutpurse',
    perk: '+2g personal stipend each turn',
    req: 'Highest Thief skill.',
    metric: (c) => skillLevel(c, 'thief'),
  },
  {
    key: 'naturalist',
    name: 'The Naturalist',
    perk: 'Creature & Monster armies you lead +5%',
    req: 'Highest Druid skill.',
    metric: (c) => skillLevel(c, 'druid'),
  },
  {
    key: 'loreseeker',
    name: 'The Loreseeker',
    perk: '+5% Sage discovery chance',
    req: 'Highest Sage skill.',
    metric: (c) => skillLevel(c, 'sage'),
  },
  {
    key: 'trailblazer',
    name: 'The Trailblazer',
    perk: '+5% exploration',
    req: 'Highest Explorer skill.',
    metric: (c) => skillLevel(c, 'explorer'),
  },
  {
    key: 'colossus',
    name: 'The Colossus',
    perk: '+2 HP recovered when resting',
    req: 'Highest maximum HP.',
    metric: (c) => c.maxHp || 20,
  },
  {
    key: 'widowmaker',
    name: 'The Widowmaker',
    perk: '+1 melee & +1 archery in combat',
    req: 'Most enemy characters slain in personal combat.',
    metric: (c) => (c.tm && c.tm.duelKills) || 0,
  },
  {
    key: 'champion',
    name: 'Champion of the People',
    perk: '+2g personal stipend each turn',
    req: 'Most merits earned in play.',
    metric: (c) => c.merits || 0,
  },
  {
    key: 'hostleader',
    name: 'The Host-Leader',
    perk: 'army wages −1 per unit (min 1)',
    req: 'Leads the largest number of army units.',
    metric: (c) => (c.armies || []).length,
  },
  {
    key: 'cavalier',
    name: 'The Cavalier',
    perk: 'cavalry you lead +5%',
    req: 'Leads the most cavalry units.',
    metric: (c) => (c.armies || []).filter((a) => MINOR_CAV.has(a.type)).length,
  },
  {
    key: 'beastmaster',
    name: 'The Beastmaster',
    perk: 'Creature & Monster armies you lead +5%',
    req: 'Leads the most Creature and Monster units.',
    metric: (c) => (c.armies || []).filter((a) => CREATURE_ARMIES.has(a.type) || MONSTER_ARMIES.has(a.type)).length,
  },
  {
    key: 'ironclad',
    name: 'The Ironclad',
    perk: 'heavy & fleet units you lead +5%',
    req: 'Leads the most heavy and fleet units.',
    metric: (c) => (c.armies || []).filter((a) => MINOR_HEAVY.has(a.type)).length,
  },
  {
    key: 'relichunter',
    name: 'The Relic-Hunter',
    perk: '+1 melee & +1 archery in combat',
    req: 'Carries the most magic items.',
    metric: (c) => (c.items || []).length,
  },
  {
    key: 'castellan',
    name: 'The Castellan',
    perk: '+1g per turn for every 5 provinces held',
    req: 'The king holding the most provinces.',
    metric: (c, st) =>
      c.isKing ? ((st.world && st.world.provinces) || []).filter((pv) => pv.owner === c.player).length : 0,
  },
  {
    key: 'warlock',
    name: 'The Warlock',
    perk: '+1 spell of your best school/turn',
    req: 'Highest single magic-school level.',
    metric: (c) => _BEST_SCHOOL(c),
  },
];
export function computeMinorTitles(state) {
  const chars = (state.characters || []).filter((c) => c && c.player != null && c.alive);
  const out = {};
  MINOR_TITLES.forEach((t) => {
    let best = 0,
      bc = null;
    chars.forEach((c) => {
      const v = t.metric(c, state) || 0;
      if (v > best) {
        best = v;
        bc = c;
      }
    });
    if (bc) out[t.key] = { charId: bc.id, playerIndex: bc.player, name: t.name, perk: t.perk };
  });
  return out;
}

// ── EXTRA SKILL BONUSES ────
// skillBonusBreakdown covers everything that changes the skill ITSELF — equipped items, the Crown
// of Command aura and the Curse spell. It does NOT cover the bonuses the engine adds at the point
// of use: the minor titles and the Veteran Training discovery. Those were invisible on the
// character card (only the four personal-combat ones were shipped, and nothing said where they came
// from), so a player holding The Strategist saw no sign of the +1 Tactical every one of his battles
// is fought with. This is the single module-level place those are enumerated; both the report card
// and the orders column render from it, and every entry carries a `kind` (for colour) and a `scope`
// (for when it applies), so the display can never claim a personal-combat bonus applies to a
// battle.
//
// SCOPES: 'always' — folded into the skill itself (handled by skillBonusBreakdown)
// 'combat' — personal combat only (duels, encounters, lair fights) — pcCharCombatant
// 'battle' — army battles only — combatVsChar / combatVsNPC command bonus
// 'move' — movement points only — computeMovePoolMax
// 'order' — the order's own success roll only (e.g. Sage research)
// Every entry here must correspond to a REAL engine site; the harness asserts each one.
export const SKILL_EXTRA_MINORS = [
  // key skills delta kind scope
  ['duelist', ['melee'], 1, 'title', 'combat'],
  ['marksman', ['archery'], 1, 'title', 'combat'],
  ['widowmaker', ['melee', 'archery'], 1, 'title', 'combat'],
  ['relichunter', ['melee', 'archery'], 1, 'title', 'combat'],
  ['strategist', ['tactical'], 1, 'title', 'battle'],
  ['swift', ['march'], 1, 'title', 'move'],
  ['seawolf', ['naval'], 1, 'title', 'move'],
  ['loreseeker', ['sage'], 1, 'title', 'order'],
];
export const SKILL_EXTRA_SCOPE_NOTE = {
  combat: 'personal combat only',
  battle: 'army battles only',
  move: 'movement points only',
  order: 'this skill’s own order roll only',
};
// `minorHolders` is the freshly-computed map where one is to hand; the last resolved turn's map is
// the fallback, so a character still sees their own perk before Titles go public.
export function extraSkillBonuses(c, state, minorHolders) {
  const out = {};
  if (!c) return out;
  const mh = minorHolders || (state && state._minorHolders) || {};
  const nameOf = (k) => (MINOR_TITLES.find((t) => t.key === k) || {}).name || k;
  const add = (skill, label, delta, kind, scope) => {
    (out[skill] = out[skill] || []).push({ label, delta, kind, scope, note: SKILL_EXTRA_SCOPE_NOTE[scope] || '' });
  };
  SKILL_EXTRA_MINORS.forEach(([key, skills, delta, kind, scope]) => {
    const h = mh[key];
    if (!(h && h.charId === c.id)) return;
    skills.forEach((sk) => add(sk, nameOf(key), delta, kind, scope));
  });
  // sd37 Veteran Training — a realm-wide Heroic discovery, +1 melee/archery in personal combat.
  const pl = state && state.players && c.player != null ? state.players[c.player] : null;
  if (pl && (pl.discoveries || []).some((d) => d && d.id === 'sd37')) {
    add('melee', 'Veteran Training', 1, 'discovery', 'combat');
    add('archery', 'Veteran Training', 1, 'discovery', 'combat');
  }
  return out;
}
