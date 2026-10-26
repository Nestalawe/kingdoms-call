// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kitTactics } from '../alignment-prototypes.ts';
import { unitBaseStrength } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import { heroHireWage } from '../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import {
  BOT_AERIAL_TYPES,
  BOT_CARRIER_TYPES,
  BOT_HEX_DIRS,
  BOT_SEA_ALL,
  botBattleForce,
  botConceded,
  botForceStrength,
  botNeighbourProv,
  botNoteLand,
  botRelationRaw,
  botSeesChar,
  botTargetDefence,
  botTuning,
  botTurnCache,
  botVisibleCharsIn,
} from './intel.ts';
import { botCanFly, botLairDir, botPlanAssaults, botSeaCap } from './war.ts';
import {
  BOT_FLYING_TYPES,
  BOT_NAVAL_TYPES,
  botAssumedChar,
  botAtWar,
  botCoastalFleetType,
  botCoastalPorts,
  botEnemyDefence,
  botFieldRecruitTokens,
  botFlyerPorts,
  botFrontierTarget,
  botGarrisonOrder,
  botHeroCap,
  botHireBias,
  botHireOrder,
  botHomeId,
  botIsValuable,
  botLandReach,
  botLedger,
  botLiftable,
  botMoveOrder,
  botNearbyThreat,
  botPassable,
  botPathDirs,
  botPathLen,
  botRaiseTargets,
  botRecruitOrder,
  botRoles,
  botSchoolLimit,
  botSeaReach,
  botSpend,
  botUnderAttack,
} from './strategy.ts';
import {
  botChainHops,
  botDefenderOrders,
  botDefenderPost,
  botDistantStrike,
  botHomeThreat,
  botRoamOrders,
  botRoleWork,
  botScanTargets,
  botSpecialistOrders,
  botSpecialistRoles,
  botZoneOf,
} from './specialists.ts';
import {
  BOT_INFILTRATE_RANGE,
  botAirReach,
  botAirStrike,
  botBeastMusterPlan,
  botConsecrateTarget,
  botInfiltrateOrders,
  botInfiltrateSchool,
  botItemPre,
  botLairPlan,
  botMasteryPre,
  botNearestOf,
  botOnlySkeletal,
  botOrphanHostOrders,
  botRitePre,
  botRunSlayerSchool,
  botSeaStrike,
  botSetDuelStances,
  botSignaturePre,
  botSpareBerths,
} from './missions.ts';
import {
  botBeatableLairIn,
  botCastPlan,
  botFillOrders,
  botHuntTarget,
  botOffensiveMagic,
  botPathAny,
  botPathLenAny,
  botPlannedAttackTarget,
  botPracticeFallback,
  botRaidTarget,
} from './spellcraft.ts';

// ══ RAISE THE FALLEN (2026-09-28, Toby: bots with white mages resurrect their heroes) ════
// Before any other plan, each body the realm may raise — one of ITS OWN fallen heroes whose death it knows of (never
// one who served another realm; the engine refuses those too), or its most recently fallen MONARCH (the engine lets
// only his own realm recall him; the regent steps down) — gets the nearest white mage (White 1+, not a general with
// a host, not badly hurt). He walks there through our own / unowned land (a monarch's body lies at the home or the
// richest held province) and casts Resurrect on that body as often as his White allows in the phases left — a
// second cast only matters if the first fizzles (the engine allows one raise per body per turn). A body more than
// four hops away is walked toward over several years (up to eight hops). Richest bodies first: the king, then by skill.
// botRaiseTargets (the bodies this realm may raise) is in bots/strategy.ts; botResurrectErrands, below, sends the mages.
export function botResurrectErrands(G, pi, all, roles, assigned) {
  const targets = botRaiseTargets(G, pi);
  if (!targets.length) return;
  const D = (botTurnCache(G).raiseDiag = botTurnCache(G).raiseDiag || []);
  targets.forEach(({ g, loc }) => {
    const X = G.world.provinces[loc];
    if (!X || X.terrain === 'sea') return;
    let best = null;
    all.forEach((c) => {
      if (assigned.has(c.id) || c._isHeir || ((c.skills || {}).white || 0) < 1) return;
      if (roles.leaders.includes(c.id) && (c.armies || []).length) return; // a general with a host keeps to the war
      const hp = c.hp != null ? c.hp : c.maxHp || 20;
      if (hp < (c.maxHp || 20) * 0.5) return;
      const P = G.world.provinces[c.location];
      if (!P) return;
      const path = P.id === X.id ? [] : botPathDirs(G, pi, P, X.id, 8, true);
      if (!path || path.length > 8) return;
      if (!best || path.length < best.path.length) best = { c, path };
    });
    if (!best) {
      D.push({ pi, grave: g.id, monarch: !!g._monarch, mage: null });
      return;
    }
    const c = best.c;
    const mv = [];
    best.path.slice(0, 5).forEach((d) => mv.push(botMoveOrder(d, 'To raise ' + g.name)));
    if (best.path.length <= 4) {
      const casts = Math.min(botSchoolLimit((c.skills || {}).white || 0), 5 - mv.length);
      for (let i = 0; i < casts; i++)
        mv.push({ action: 'cast_spell', target: 'Resurrect', extra: String(g.id), desc: 'Resurrect ' + g.name });
    }
    G.turnOrders[c.id] = botFillOrders(G, pi, c, [], mv);
    assigned.add(c.id);
    D.push({ pi, grave: g.id, monarch: !!g._monarch, mage: c.id, hops: best.path.length });
  });
}
export function runBotMovement(G, botIdxSet, hooks) {
  hooks = hooks || {};
  if (!botIdxSet || !botIdxSet.size || !G.world) return;
  G.turnOrders = G.turnOrders || {};
  if (typeof hooks.terrainMult === 'function') botTurnCache(G).terrainMult = hooks.terrainMult; // the engine's unit×terrain figure, for botBattleForce
  botIdxSet.forEach((pi) => {
    if (botConceded(G, pi)) return; // a conceded realm only ever Defends
    const T = botTuning(G, pi); // per-realm overlays (alignment / race)
    botSetDuelStances(G, pi, hooks.duelSim); // Sept 2026 (Toby): duel by judgement, not temper
    botNoteLand(G, pi); // expansion-pressure bookkeeping (once per turn)
    const L = botLedger(G, pi),
      roles = botRoles(G, pi);
    const all = (G.characters || []).filter((c) => c && c.alive && c.player === pi && !c._isHeir);
    const chars = all.filter((c) => (c.armies || []).length > 0);
    const assigned = new Set();
    botPlanAssaults(G, pi, chars, assigned); // concentrated assaults (gang up on strong provinces)
    // 2026-09-28: the ADMIRAL and the FLYING GENERAL plan first, so their hulls / flyers are bought before the
    // land general's muster spends the year's gold (the study found them at port with no money 2 years in 3).
    const _rolePri = (c) => (c._botRole === 'admiral' || c._botRole === 'skygeneral' ? 0 : 1);
    const leaders = all.filter((c) => roles.leaders.includes(c.id)).sort((a, b) => _rolePri(a) - _rolePri(b));
    const leaderAt = (provId) => leaders.find((l) => l.location === provId) || null;
    const homeId = botHomeId(G, pi);
    const homeThreat = botHomeThreat(G, pi);
    const heroClaimed = new Set(); // one seeker per wandering hero
    // ── COMPANIONS: every general leading a host gets an unarmed hero at his side —
    // ideally a mage, who casts offensive / supporting / defensive spells for him in the early phases
    // and then follows a phase behind. A co-located companion is also the natural recipient when a
    // grown host splits. One companion per general, the biggest host choosing first; scored on magic
    // (×3) minus distance, within 6 hops through any land. ──
    const magicScore = (x) => {
      const s = x.skills || {};
      return (s.elemental || 0) + (s.necromancy || 0) + (s.psychic || 0) + (s.illusory || 0) + (s.white || 0);
    };
    const escortOf = {}; // companion id → the general it escorts
    const defCovered = new Set(); // provinces a field host or a posted defender already guards
    leaders.forEach((l) => {
      if ((l.armies || []).length >= 3) defCovered.add(l.location);
    });
    {
      const spare = all.filter(
        (x) =>
          !roles.leaders.includes(x.id) && !(x.armies || []).length && !x.isKing && !roles.defenders.includes(x.id),
      );
      leaders
        .filter((l) => (l.armies || []).length > 0)
        .sort((a, b) => (b.armies || []).length - (a.armies || []).length)
        .forEach((l) => {
          let best = null;
          spare.forEach((h) => {
            if (escortOf[h.id] != null) return;
            const d = h.location === l.location ? 0 : botPathLenAny(G, G.world.provinces[h.location], l.location, 6);
            if (d == null) return;
            const sc = magicScore(h) * 3 - d;
            if (!best || sc > best.sc) best = { h, sc };
          });
          if (best) escortOf[best.h.id] = l;
        });
    }
    const spec = botSpecialistRoles(G, pi, new Set(Object.keys(escortOf).map(Number))); // scholar / scout / spy / thief
    // Feeders and unarmed characters are planned after the leaders so a leader's muster claims the
    // province's recruit slots first.
    botResurrectErrands(G, pi, all, roles, assigned); // 2026-09-28 (Toby): white mages raise the realm's fallen first
    const ordered = [...leaders, ...all.filter((c) => !roles.leaders.includes(c.id))];
    ordered.forEach((c) => {
      if (assigned.has(c.id)) return;
      const P = G.world.provinces[c.location];
      if (!P) return;
      const isLeader = roles.leaders.includes(c.id);
      const armed = (c.armies || []).length > 0;
      const pre = [];
      const hire = botHireOrder(G, pi, c, L);
      if (hire) pre.push(hire);
      // Sept 2026 (review R10): a king under 75% health with no host on the doorstep rests the year out.
      if (c.isKing && !homeThreat && !botUnderAttack(G, pi)) {
        const _khp = c.hp != null ? c.hp : c.maxHp || 20,
          _kmhp = c.maxHp || 20;
        if (_khp < _kmhp * 0.75) {
          const o = [...pre];
          while (o.length < 5) o.push({ action: 'rest', target: '', extra: '', desc: 'Rest & heal (the crown)' });
          G.turnOrders[c.id] = o;
          assigned.add(c.id);
          return;
        }
      }
      // Sept 2026 (review R2): the alignment's signature order, where it applies here and now.
      {
        const sig = botSignaturePre(G, pi, c, P, L);
        if (sig) pre.push(sig);
      }
      {
        const ip = botItemPre(G, pi, c, roles);
        if (ip && pre.length < 2) pre.push(ip);
      } // Sept 2026 (review R3): kit
      // ── INFILTRATOR: a Necromancy / Elemental caster who is not running a
      // field army goes behind the enemy line and conjures a host in undefended ground, taking the
      // province outright. Unarmed he ranges the full 5 hops; carrying skeletons he raised himself he
      // only steps to an ADJACENT undefended province (an armed column marching into defended ground
      // would have to fight, and this force cannot). Ranked ahead of companion/feeder duty because
      // taking provinces is the bot's whole purpose. ──
      if (!isLeader && !c.isKing && !c._isHeir) {
        const _infSchool = !armed || botOnlySkeletal(c) ? botInfiltrateSchool(c) : null;
        if (_infSchool) {
          const _inf = botInfiltrateOrders(G, pi, c, pre, _infSchool, armed ? 1 : BOT_INFILTRATE_RANGE);
          if (_inf) {
            G.turnOrders[c.id] = _inf;
            assigned.add(c.id);
            return;
          }
        }
      }
      // ── DEFENDER: hold a post whose watch covers the most unguarded owned land (Sept 2026, Toby). ──
      if (!isLeader && !c.isKing && roles.defenders.includes(c.id)) {
        const post = botDefenderPost(G, pi, c, defCovered);
        if (post) c._botPost = post.X.id;
        const dO = botDefenderOrders(G, pi, c, pre, post, L);
        if (dO) {
          const at = post && post.d === 0 ? post.X : P;
          botZoneOf(G, at).forEach((q) => defCovered.add(q.id));
          G.turnOrders[c.id] = dO;
          assigned.add(c.id);
          return;
        }
      }
      // ── FEEDER standing with a leader: hand the whole column over, then drill/hold. ──
      if (!isLeader && armed) {
        const ld = leaderAt(c.location);
        if (ld) {
          G.turnOrders[c.id] = botFillOrders(
            G,
            pi,
            c,
            [...pre, { action: 'leave_army', target: 'all', extra: String(ld.id), desc: 'Hand column to ' + ld.name }],
            [],
          );
          assigned.add(c.id);
          return;
        }
      }
      // ── SPLIT: a leader whose column has grown well past the
      // front line (terrain width ≤6, the rest fight at ×0.5) hands the weaker half to an unarmed
      // character standing here, who holds and drills it this year and marches it as a second host
      // next year (botRoles makes any holder of ≥3 units a leader). Two fronts, one battle per phase
      // each — the single mega-stack was conquering one province a turn with 16 units in reserve. ──
      if (isLeader && armed && (c.armies || []).length >= (roles.defenders.length ? 8 : 10)) {
        // Sept 2026: an unarmed DEFENDER standing here takes the column first (it is his post's
        // garrison); otherwise a mage stays the general's companion and a fighter takes it.
        const rcpt = all
          .filter(
            (o) =>
              o.id !== c.id &&
              o.location === c.location &&
              !(o.armies || []).length &&
              !assigned.has(o.id) &&
              !heroClaimed.has(o.id) &&
              (G.turnOrders[o.id] || []).every((x) => x == null),
          )
          .sort(
            (a, b) =>
              (roles.defenders.includes(a.id) ? -100 : 0) +
              magicScore(a) -
              ((roles.defenders.includes(b.id) ? -100 : 0) + magicScore(b)),
          )[0];
        if (rcpt) {
          const ranked = (c.armies || [])
            .filter((a) => a && !a._isSkeletal && !BOT_SEA_ALL.has(a.type))
            .map((a) => ({ a, v: unitBaseStrength(a) }))
            .sort((x, y) => x.v - y.v);
          const give = ranked.slice(0, Math.floor((c.armies || []).length / 2)).map((x) => x.a);
          if (give.length >= 3) {
            pre.push({
              action: 'leave_army',
              target: give.map((a) => a.unitName || a.type).join(','),
              extra: String(rcpt.id),
              desc: 'Split the host — ' + give.length + ' units to ' + rcpt.name,
            });
            const proxy = { ...rcpt, armies: give };
            G.turnOrders[rcpt.id] = botFillOrders(
              G,
              pi,
              proxy,
              [{ action: 'defend', target: '', extra: '', desc: 'Hold' }],
              [],
            );
            assigned.add(rcpt.id);
          }
        }
      }
      // ── MUSTER before marching: a leader raises field troops where it stands; anyone leaves a
      // single-unit garrison behind (only when the march still keeps at least 2 hops). ──
      let recruitTypes = [];
      if (P.owner === pi) {
        if (isLeader) {
          const toks = botFieldRecruitTokens(G, pi, c, P, L);
          const ro = botRecruitOrder(toks, null);
          if (ro) {
            pre.push(ro);
            recruitTypes = toks.map((t) => t.split('|')[0]);
          }
        }
      }
      const reach = Math.min(3, armed ? botLandReach(c, recruitTypes) : 5);
      if (P.owner === pi && 5 - pre.length - 1 >= 2 && reach >= 2) {
        const go = botGarrisonOrder(G, pi, P, L);
        if (go) pre.push(go);
      }
      const maxHops = Math.max(0, Math.min(reach, 5 - pre.length));
      // 2026-09-28: the hops a SEA-GOING column may sail — its ships set the pace, not the foot they carry.
      const seaHops =
        armed && botSeaCap(c.armies) !== 'land' ? Math.max(0, Math.min(3, botSeaReach(c) || reach, 5 - pre.length)) : 0;
      const myStr = botBattleForce(G, c, null, 'plain'); // battle-model strength on open ground (Druid, front line, Tactical)
      // ── UNARMED: chase a wandering hero within 3 hops (hire on arrival); an unarmed LEADER goes
      // home to
      // raise a host; a feeder with nothing to do here walks to a free muster province. ──
      if (!armed) {
        const hp = c.hp != null ? c.hp : c.maxHp || 20,
          mhp = c.maxHp || 20;
        // ── SEEK A WANDERER first — a new hero outranks a
        // turn of escort duty; the recruit becomes the next companion. ──
        let bestH = null;
        const _heroesNow = (G.characters || []).filter(
          (x) => x && x.alive && x.player === pi && !x.isKing && !x._isHeir,
        ).length;
        // ── 2026-09-17: THE WANDERER MUST BE ONE THE REALM CAN SEE. ────
        // (owned ground, a character of ours standing there, or a Spy this turn; never a hero who
        // moved in unspotted or is cloaked), so a bot now only chases wanderers it has actually
        // seen.
        if (_heroesNow < botHeroCap(G, pi))
          (G.characters || []).forEach((h) => {
            if (!(h && h.alive && h.player === null && !h._isNeutralGuard && !h._justDefeated)) return;
            if (!botSeesChar(G, pi, h)) return;
            if (heroHireWage((G.players[pi] || {}).alignment || 'Neutral', h.alignment, false, h) == null) return;
            if (h.location === c.location || heroClaimed.has(h.id)) return;
            // seekers walk through neutral country too (an unarmed character is never engaged by a
            // guard), up to 5 hops — the whole of an unarmed character's reach.
            const d = botPathLenAny(G, P, h.location, 5);
            if (d == null) return;
            const de = d - botHireBias(G, pi, h);
            if (!bestH || de < bestH.de) bestH = { h, d, de };
          });
        if (bestH && maxHops > 0) {
          const path = botPathAny(G, P, bestH.h.location, 5);
          if (path && path.length === bestH.d) {
            heroClaimed.add(bestH.h.id);
            const mv = path.map((d) => botMoveOrder(d, 'Seek ' + bestH.h.name));
            if (pre.length + mv.length < 5)
              mv.push({ action: 'hire', target: String(bestH.h.id), extra: '', desc: 'Hire ' + bestH.h.name });
            G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, mv);
            return;
          }
        }
        // ── ROAM FOR WANDERERS (2026-09-26, Toby item 5): a court under three heroes sends every hero who is
        // not the general out to find them — no wanderer is in sight, so he walks to the nearest land the
        // realm has never set foot in (wanderers are seen only from where our characters stand) and
        // explores it on arrival. Kings never roam. ──
        if (!c.isKing && !isLeader && _heroesNow < 3 && maxHops > 0) {
          const rm = botRoamOrders(G, pi, c, pre);
          if (rm) {
            G.turnOrders[c.id] = rm;
            assigned.add(c.id);
            return;
          }
        }
        // ── A LEADERLESS HOST (2026-09-26, Toby): a fallen commander's army garrisoned nearby is taken up by the
        // nearest free hero before anything else he might do this year. ──
        if (!c.isKing && !isLeader && !roles.defenders.includes(c.id)) {
          const oh = botOrphanHostOrders(G, pi, c, pre);
          if (oh) {
            G.turnOrders[c.id] = oh;
            assigned.add(c.id);
            return;
          }
        }
        // ── An unarmed ADMIRAL walks to the nearest port, an unarmed FLYING GENERAL to the nearest eyrie —
        // that is where each raises his column (2026-09-26, Toby items 6 / 8). ──
        if (c._botRole === 'admiral' || c._botRole === 'skygeneral') {
          const grounds = c._botRole === 'admiral' ? botCoastalPorts(G, pi) : botFlyerPorts(G, pi);
          const g = botNearestOf(G, pi, c, grounds, true);
          if (g && g.d > 0) {
            const path = botPathDirs(G, pi, P, g.X.id, maxHops, true);
            if (path && path.length) {
              G.turnOrders[c.id] = botFillOrders(
                G,
                pi,
                c,
                pre,
                path.map((d) =>
                  botMoveOrder(d, (c._botRole === 'admiral' ? 'To the port of ' : 'To the eyrie at ') + g.X.name),
                ),
              );
              assigned.add(c.id);
              return;
            }
          }
          if (g && g.d === 0) {
            G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, []);
            assigned.add(c.id);
            return;
          } // at his muster ground: recruit (pre) and hold
        }
        // ── COMPANION: stand with the general, cast for him, follow a phase behind. ──
        const gen = escortOf[c.id];
        if (gen && !isLeader) {
          const lo = G.turnOrders[gen.id] || [];
          if (c.location === gen.location) {
            const firstMovePh = (() => {
              const i = lo.findIndex((o) => o && o.action === 'move');
              return i < 0 ? 5 : i;
            })();
            const genAttacks = lo.some((o) => o && o.action === 'move' && /^(Attack|Assault)/.test(o.desc || ''));
            // Casts: offence on enemies standing here, buffs for the general (only while he is
            // still here — the engine resolves a friendly cast before its co-located target's own
            // move), defence, economy.
            const casts = botCastPlan(G, pi, c, P, {
              max: 3,
              fighting: genAttacks ? gen : null,
              siege: genAttacks ? botPlannedAttackTarget(G, gen) : null,
              threat: botNearbyThreat(G, pi, c),
            })
              .filter((o) => !(genAttacks && o.target === 'Flood'))
              .filter((o, i) => o.extra !== String(gen.id) || pre.length + i < firstMovePh); // Sept 2026: a Flood would strand OUR assault too
            // Follow the general's path one phase behind, only into ground that is ours / allied,
            // land he simply walks into, or his first assault when the battle model gives him a 2×
            // edge.
            const follow = [];
            let cur = P;
            for (const o of lo) {
              if (!o || o.action !== 'move') continue;
              let N = null;
              if (String(o.target).startsWith('dir:')) {
                const d = BOT_HEX_DIRS.indexOf(String(o.target).slice(4));
                N = botNeighbourProv(G, cur, d);
              } else N = G.world.provinces[+o.target];
              if (!N || N.terrain === 'sea') break;
              const safe =
                N.owner === pi ||
                (N.owner != null && botRelationRaw(G, pi, N.owner) === 'allied') ||
                (follow.length === 0 && /^Advance/.test(o.desc || '')) ||
                (follow.length === 0 &&
                  /^(Attack|Assault)/.test(o.desc || '') &&
                  botBattleForce(G, gen, null, N.terrain) >= 2 * botTargetDefence(G, pi, N));
              if (!safe) break;
              follow.push({ ...o, desc: 'Follow ' + gen.name });
              cur = N;
            }
            const lead = [...pre, ...casts];
            const lag = botPracticeFallback(G, pi, c, { moving: follow.length > 0 }) || {
              action: 'defend',
              target: '',
              extra: '',
              desc: 'Hold',
            };
            while (follow.length && lead.length < firstMovePh + 1 && lead.length < 5) lead.push({ ...lag });
            G.turnOrders[c.id] = botFillOrders(G, pi, c, lead, follow);
            assigned.add(c.id);
            return;
          } else {
            const path = (botPathAny(G, P, gen.location, 6) || [])
              .slice(0, Math.max(0, 5 - pre.length))
              .map((d) => botMoveOrder(d, 'Join ' + gen.name));
            if (path.length) {
              G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, path);
              assigned.add(c.id);
              return;
            }
          }
        }
        // ── WAR ROLES for unarmed characters (self-play batch): RAIDER (offensive magic into enemy
        // land),
        // HUNTER (run down a beatable enemy hero), SPY (rifle an enemy capital's archives). Only when at
        // war, only for non-leaders, and only when the target is within reach.
        if (!isLeader && botAtWar(G, pi)) {
          if (hp >= mhp * 0.7) {
            // HUNTER: a beatable enemy hero within 4 hops — Encounter runs the chase over the phases.
            // Hunter tactics (Sept 2026): the quarry must be beatable on the ENGINE's own duel
            // model — runTurn hands in a Monte-Carlo forecast (`hooks.duelSim`) that fights cloned
            // copies with both sides' real plans, items and tempers; the hunt goes ahead only at
            // >=65% wins and <=20% risk of being felled. The rating pre-filter keeps the sim cheap.
            // Hunters also set out only at >=85% health.
            const hunt = hp >= mhp * 0.85 ? botHuntTarget(G, pi, c, 4, hooks.duelSim) : null;
            if (hunt && hunt.mem) {
              const path = (botPathAny(G, P, hunt.loc, 4) || []).slice(0, Math.max(0, 4 - pre.length));
              if (path.length) {
                const o = [...pre, ...path.map((d) => botMoveOrder(d, 'Stalk ' + hunt.e.name))];
                while (o.length < 5)
                  o.push({ action: 'defend', target: '', extra: '', desc: 'Lie in wait for ' + hunt.e.name });
                G.turnOrders[c.id] = o;
                assigned.add(c.id);
                return;
              }
            } else if (hunt) {
              G.turnOrders[c.id] = botFillOrders(
                G,
                pi,
                c,
                [...pre, { action: 'encounter', target: String(hunt.e.id), extra: '', desc: 'Hunt ' + hunt.e.name }],
                [],
              );
              assigned.add(c.id);
              return;
            }
            // RAIDER: walk into enemy land and cast; Invisibility first if the school allows.
            if (botOffensiveMagic(c) >= 1) {
              const raid = botRaidTarget(G, pi, P, 5);
              if (raid) {
                const path = botPathAny(G, P, raid.P.id, 5) || [];
                const mv = path
                  .slice(0, Math.max(0, 4 - pre.length))
                  .map((d) => botMoveOrder(d, 'Raid ' + raid.P.name));
                let dest = P;
                for (const m of mv) {
                  const d = BOT_HEX_DIRS.indexOf(m.target.slice(4));
                  const N = botNeighbourProv(G, dest, d);
                  if (!N) break;
                  dest = N;
                }
                const inEnemy =
                  dest.owner != null && dest.owner !== pi && botRelationRaw(G, pi, dest.owner) === 'enemy';
                const cloak =
                  inEnemy && ((c.skills || {}).illusory || 0) >= 1 && pre.length + mv.length < 5
                    ? [{ action: 'cast_spell', target: 'Invisibility', extra: '', desc: 'Cast Invisibility' }]
                    : [];
                const casts = botCastPlan(G, pi, c, dest, { max: 5 - pre.length - mv.length - cloak.length });
                if (casts.length || mv.length) {
                  G.turnOrders[c.id] = botFillOrders(G, pi, c, [...pre, ...cloak, ...mv, ...casts], []);
                  assigned.add(c.id);
                  return;
                }
              }
            }
            // SPY: an at-war enemy capital holding discoveries we lack, within 5 hops — go and rifle its archives.
            if (((c.skills || {}).spy || 0) >= 2) {
              const mine = new Set(((G.players[pi] || {}).discoveries || []).map((d) => d.id));
              let bestK = null;
              (G.players || []).forEach((pl, j) => {
                if (!pl || j === pi || botRelationRaw(G, pi, j) !== 'enemy') return;
                if (!(pl.discoveries || []).some((d) => !mine.has(d.id))) return;
                const hid = pl.homeProvinceId;
                const H = G.world.provinces[hid];
                if (!H || H.owner !== j) return;
                const d = botPathLenAny(G, P, hid, 5);
                if (d == null) return;
                if (!bestK || d < bestK.d) bestK = { hid, d, name: pl.name };
              });
              if (bestK) {
                const path = (botPathAny(G, P, bestK.hid, 5) || [])
                  .slice(0, Math.max(0, 4 - pre.length))
                  .map((d) => botMoveOrder(d, 'Infiltrate ' + bestK.name));
                const spy = { action: 'spy', target: '', extra: '', desc: 'Spy on ' + bestK.name };
                const rest = [];
                while (pre.length + path.length + rest.length < 5 && rest.length < 2) rest.push({ ...spy });
                G.turnOrders[c.id] = botFillOrders(G, pi, c, [...pre, ...path, ...rest], []);
                assigned.add(c.id);
                return;
              }
            }
          }
        }
        // ── review II A7: a Melee-7 hero Challenges a rival here when the forecast (on known skills) says 70%+. ──
        if (!isLeader && hp >= mhp * 0.85) {
          const mo = botMasteryPre(G, pi, c, P, { duelSim: hooks.duelSim });
          if (mo && mo.action === 'challenge') {
            G.turnOrders[c.id] = botFillOrders(G, pi, c, [...pre, mo], []);
            assigned.add(c.id);
            return;
          }
        }
        // ── review II A4: a fighter standing where an at-war unarmed rival stands runs him down first (duel sim ≥ 50%, felled ≤ 10%). ──
        if (
          !isLeader &&
          !c.isKing &&
          P.owner === pi &&
          botAtWar(G, pi) &&
          hp >= mhp * 0.85 &&
          ((c.skills || {}).melee >= 3 || (c.skills || {}).archery >= 3) &&
          typeof hooks.duelSim === 'function'
        ) {
          const sneak = botVisibleCharsIn(G, pi, P).filter(
            (e) =>
              e &&
              e.alive &&
              e.player != null &&
              e.player !== pi &&
              !e.isKing &&
              !(e.armies || []).length &&
              botRelationRaw(G, pi, e.player) === 'enemy' &&
              e._invisTurn !== G.turn,
          )[0];
          if (sneak) {
            const f = hooks.duelSim(c, botAssumedChar(G, pi, sneak), 24);
            if (f && f.win >= 0.5 && f.felled <= 0.1) {
              G.turnOrders[c.id] = botFillOrders(
                G,
                pi,
                c,
                [...pre, { action: 'encounter', target: String(sneak.id), extra: '', desc: 'Run down ' + sneak.name }],
                [],
              );
              assigned.add(c.id);
              return;
            }
          }
        }
        // ── LAIR RAIDER: a fighter walks to a beatable discovered lair within 4 hops (hoard + Monster-Bane merit). ──
        // ── BEAST MUSTER (PROTOTYPE round 5, Toby): a Druidic or Evil realm's hero with room to lead walks to the
        // nearest beast province of the realm's and recruits its beasts (the king and the generals too, while no war is on).
        {
          const _bk = kitTactics(G, pi);
          if (
            (_bk === 'Druidic' || _bk === 'Evil') &&
            (!(isLeader || c.isKing) || !botAtWar(G, pi)) &&
            hp >= mhp * 0.6
          ) {
            const bm = botBeastMusterPlan(G, pi, c, P, L, _bk, 4);
            if (bm && pre.length + bm.path.length < 5) {
              const mv = [
                ...bm.path.map((d) => botMoveOrder(d, 'Muster the beasts of ' + bm.X.name)),
                {
                  action: 'recruit',
                  target: bm.toks.join(','),
                  extra: '',
                  desc: 'Recruit the beasts of ' + bm.X.name,
                  prov: bm.X.id,
                },
              ];
              G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, mv);
              assigned.add(c.id);
              return;
            }
          }
        }
        // PROTOTYPE (ideas round 4): a lair-hunting realm sends its generals too while it is not at war (never the king).
        const _hunting = G.botLairHunting === true && !botAtWar(G, pi);
        if ((_hunting || !isLeader) && !c.isKing && hp >= mhp * 0.7) {
          const lo = botLairPlan(G, pi, c, pre, L);
          if (lo) {
            G.turnOrders[c.id] = lo;
            assigned.add(c.id);
            return;
          }
        }
        // ── SPECIALISTS: scholar / scout / spy / thief (Sept 2026, Toby). Wounded heroes fall through to Rest. ──
        if (!isLeader && hp >= mhp * 0.6) {
          const role = spec.byId[c.id]; // Sept 2026: a non-leading king may be the slayer or the scholar
          if (role) {
            const so = botSpecialistOrders(G, pi, c, pre, role, L);
            if (so) {
              G.turnOrders[c.id] = so;
              assigned.add(c.id);
              return;
            }
          }
        }
        if (isLeader && homeId != null && c.location !== homeId) {
          const path = botPathDirs(G, pi, P, homeId, maxHops, true);
          if (path && path.length) {
            G.turnOrders[c.id] = botFillOrders(
              G,
              pi,
              c,
              pre,
              path.map((d) => botMoveOrder(d, 'Return to raise a host')),
            );
            return;
          }
        }
        if (!isLeader && P.owner === pi && (leaderAt(c.location) || !(P.armyTypes || []).length)) {
          // Find the nearest owned land province with recruitable units and no other friendly
          // character.
          let bestM = null;
          (G.world.provinces || []).forEach((x) => {
            if (!x || x.owner !== pi || x.terrain === 'sea' || x.id === P.id || !(x.armyTypes || []).length) return;
            if (all.some((o) => o.id !== c.id && o.location === x.id)) return;
            const d = botPathLen(G, pi, P, x.id, true);
            if (d == null || d > 4) return;
            const sc = (x.tax || 0) - d * 2;
            if (!bestM || sc > bestM.sc) bestM = { x, sc, d };
          });
          if (bestM) {
            const path = botPathDirs(G, pi, P, bestM.x.id, maxHops, true);
            if (path && path.length) {
              G.turnOrders[c.id] = botFillOrders(
                G,
                pi,
                c,
                pre,
                path.map((d) => botMoveOrder(d, 'March to muster at ' + bestM.x.name)),
              );
              return;
            }
          }
        }
        // 2026-09-26 (Toby): an unarmed LEADER (or feeder) with no muster to make works his SECONDARY role this year.
        if (!c.isKing && c._botRole2 && c._botRole !== 'admiral' && c._botRole !== 'skygeneral') {
          const w2 = botRoleWork(G, pi, c, pre, c._botRole2, L);
          if (w2) {
            G.turnOrders[c.id] = w2;
            assigned.add(c.id);
            return;
          }
        }
        if (pre.length) {
          G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, []);
        }
        return; // else: idle — economy / actions passes give it work
      }
      // ── FEEDER with a column: march it to the nearest field army (defenders were handled above). ──
      if (!isLeader && !roles.defenders.includes(c.id)) {
        let bestL = null;
        leaders.forEach((l) => {
          const d = botPathLen(G, pi, P, l.location, false);
          if (d != null && (!bestL || d < bestL.d)) bestL = { l, d };
        });
        if (bestL && maxHops > 0) {
          const path = botPathDirs(G, pi, P, bestL.l.location, maxHops, false);
          if (path && path.length) {
            G.turnOrders[c.id] = botFillOrders(
              G,
              pi,
              c,
              pre,
              path.map((d) => botMoveOrder(d, 'Bring troops to ' + bestL.l.name)),
            );
            return;
          }
        }
        // no leader reachable — behave as a small host of its own (falls through)
      }
      // ── LEADER (or stranded feeder): threat / hold / reinforce / attack / expand. ──
      const visited = new Set([P.id]);
      const scan = botScanTargets(G, pi, c, P, myStr, T, visited);
      const { best, reinforce, maxThreat, threatDir } = scan;
      // DEFENCE: don't abandon a threatened capital or Rich province if it would fall the moment we leave
      // and our move isn't the counter-attack that destroys that very force.
      if (P.owner === pi && botIsValuable(G, P, pi) && maxThreat > 0) {
        let remaining = 0;
        (P.characters || []).forEach((id) => {
          if (id === c.id) return;
          const f = (G.characters || []).find((x) => x && x.id === id);
          if (f && f.alive && f.player === pi) remaining += botForceStrength(f.armies);
        });
        (P.garrisonArmies || []).forEach((a) => {
          remaining += unitBaseStrength(a);
        });
        const provinceWouldFall = maxThreat >= remaining;
        const bestAttacksTheThreat = best && best.dirIdx === threatDir;
        if (provinceWouldFall && !bestAttacksTheThreat) {
          G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, []);
          return;
        } // hold, drill, watch
      }
      // HOME THREAT: the PRIMARY host answers a human host massing within 2 hops of the capital —
      // marches on it if it can win, otherwise falls back to stand on the capital. Only when the
      // capital would actually fall as it stands.
      if (
        c.id === roles.primaryId &&
        homeThreat &&
        homeId != null &&
        !(best && best.dirIdx === threatDir && maxThreat > 0)
      ) {
        const H = G.world.provinces[homeId];
        if (homeThreat.force > botEnemyDefence(G, H, pi, pi) - (c.location === homeId ? myStr : 0)) {
          const margin = c.isKing ? T.kingAttackMargin : T.heroAttackMargin;
          if (myStr >= homeThreat.force * margin) {
            // Path to a province adjacent to the threat, then strike.
            const TP = G.world.provinces[homeThreat.provId];
            let bestAdj = null;
            for (let i = 0; i < 6; i++) {
              const N = botNeighbourProv(G, TP, i);
              if (!N || !botPassable(G, pi, N)) continue;
              const d = botPathLen(G, pi, P, N.id, false);
              if (d != null && (!bestAdj || d < bestAdj.d)) bestAdj = { N, d };
            }
            if (bestAdj && bestAdj.d < maxHops) {
              const path = botPathDirs(G, pi, P, bestAdj.N.id, maxHops, false) || [];
              const mv = path.map((d) => botMoveOrder(d, 'March on the invader'));
              for (let i = 0; i < 6; i++) {
                const K = botNeighbourProv(G, bestAdj.N, i);
                if (K && K.id === TP.id) {
                  mv.push(botMoveOrder(i, 'Attack the invader'));
                  break;
                }
              }
              G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, mv);
              return;
            }
          }
          if (c.location !== homeId) {
            const path = botPathDirs(G, pi, P, homeId, maxHops, false);
            if (path && path.length) {
              G.turnOrders[c.id] = botFillOrders(
                G,
                pi,
                c,
                pre,
                path.map((d) => botMoveOrder(d, 'Fall back to the capital')),
              );
              return;
            }
          } else {
            G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, []);
            return;
          } // stand on the capital
        }
      }
      // REINFORCE a neighbouring valuable province about to fall (unless the counter-attack is
      // available).
      if (reinforce && !(best && best.dirIdx === threatDir && maxThreat > 0)) {
        G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, [botMoveOrder(reinforce.dirIdx, 'Reinforce')]);
        return;
      }
      if (maxHops <= 0 && seaHops <= 0) {
        G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, []);
        return;
      }
      // ── ADMIRAL without hulls (2026-09-26, Toby item 6): a fleet is raised at a port, so an admiral leading a
      // land column elsewhere marches to the nearest port first (his muster order there buys the hulls). ──
      if (c._botRole === 'admiral' && !(c.armies || []).some((a) => a && BOT_CARRIER_TYPES.has(a.type))) {
        const g = botNearestOf(G, pi, c, botCoastalPorts(G, pi), false);
        if (g && g.d > 0) {
          const path = botPathDirs(G, pi, P, g.X.id, maxHops, false);
          if (path && path.length) {
            G.turnOrders[c.id] = botFillOrders(
              G,
              pi,
              c,
              pre,
              path.map((d) => botMoveOrder(d, 'To the port of ' + g.X.name)),
            );
            return;
          }
        }
      }
      // ── ADMIRAL waits for the general (item 7): with berths to spare and a general standing here with
      // foot soldiers to embark, the fleet stays in harbour this year (the general hands them over below —
      // leaders plan in order, the admiral first) and sails loaded next year. ──
      if (
        c._botRole === 'admiral' &&
        botSpareBerths(c) > 0 &&
        all.some(
          (o) =>
            o.id !== c.id &&
            o.location === c.location &&
            roles.leaders.includes(o.id) &&
            o._botRole !== 'admiral' &&
            o._botRole !== 'skygeneral' &&
            (o.armies || []).some((a) => a && botLiftable(a.type) && !BOT_SEA_ALL.has(a.type)) &&
            !botScanTargets(G, pi, o, P, botBattleForce(G, o, null, 'plain'), T, new Set([P.id])).best,
        )
      ) {
        G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, []);
        return;
      }
      // ── FLYING GENERAL (2026-09-26, Toby item 8): airborne, he strikes over sea and behind the front; grounded
      // (too few flyers for the foot he leads), he goes to the nearest eyrie and musters flyers there. ──
      if (c._botRole === 'skygeneral') {
        if (botCanFly(c.armies)) {
          const as = botAirStrike(G, pi, c, P, myStr, T, Math.max(1, Math.min(5, botAirReach(c), 5 - pre.length)));
          if (as && as.moves.length) {
            const buff =
              (c.armies || []).length >= 3 && pre.length <= 2
                ? botCastPlan(G, pi, c, P, { max: 1, fighting: c }).find((o) =>
                    ['Oratory', 'Phantasmal Armies'].includes(o.target),
                  )
                : null;
            const pre2 = buff ? [...pre, buff] : pre;
            G.turnOrders[c.id] = botFillOrders(G, pi, c, pre2, as.moves);
            return;
          }
        } else {
          const g = botNearestOf(G, pi, c, botFlyerPorts(G, pi), false);
          if (g && g.d > 0) {
            const path = botPathDirs(G, pi, P, g.X.id, maxHops, false);
            if (path && path.length) {
              G.turnOrders[c.id] = botFillOrders(
                G,
                pi,
                c,
                pre,
                path.map((d) => botMoveOrder(d, 'To the eyrie at ' + g.X.name)),
              );
              return;
            }
          }
          if (g && g.d === 0) {
            // 2026-09-28 (Toby: bots never take the sea by air): he usually arrives leading a whole land column
            // and waited years for a flyer per foot soldier. Now the foot his flyers (held + raised this year)
            // cannot carry, and anything that can never fly, is left in the eyrie's garrison — next year the
            // column is airborne.
            const _fly =
              (c.armies || []).filter((a) => a && BOT_FLYING_TYPES.has(a.type)).length +
              (recruitTypes.some((t) => BOT_FLYING_TYPES.has(t)) ? 1 : 0);
            if (_fly > 0 && pre.length < 5) {
              const ground = (c.armies || []).filter((a) => a && !BOT_AERIAL_TYPES.has(a.type));
              const lift = ground
                .filter((a) => botLiftable(a.type))
                .sort((x, y) => unitBaseStrength(y) - unitBaseStrength(x));
              const drop = [...ground.filter((a) => !botLiftable(a.type)), ...lift.slice(_fly)];
              if (drop.length)
                pre.push({
                  action: 'leave_army',
                  target: drop.map((a) => a.unitName || a.type).join(','),
                  extra: '-1',
                  desc: 'Leave the foot at the eyrie',
                });
            }
            G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, []);
            return;
          }
        } // at the eyrie: muster flyers (pre) and hold
      }
      // ── ADMIRAL WITH A FLEET (2026-09-28, Toby: bots never take the sea): the water is his front. He sails
      // for the best winnable sea / landing FIRST; with nothing to sail for he keeps the fleet in harbour.
      // Before this he fell through to the land general's target, left his hulls in the garrison to march
      // (shedFleet), then walked back to a port to buy new ones — a loop in which the fleet never sailed. ──
      if (c._botRole === 'admiral' && (c.armies || []).some((a) => a && BOT_CARRIER_TYPES.has(a.type))) {
        const ss = seaHops > 0 ? botSeaStrike(G, pi, c, P, myStr, T, seaHops) : null;
        if (ss && ss.moves.length) {
          const mo = botMasteryPre(G, pi, c, P, { fightAhead: ss.N && ss.N.terrain !== 'sea', fromSea: true });
          const pre2 = mo && pre.length <= 2 ? [...pre, mo] : pre;
          G.turnOrders[c.id] = botFillOrders(G, pi, c, pre2, ss.moves);
          return;
        }
        if (!(best && best.N.terrain === 'sea')) {
          G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, []);
          return;
        }
      }
      // A host carrying ships cannot march overland: leave the hulls in this province's garrison
      // first
      // (one phase) when the chosen move is land→land. They are picked up again if a naval move is chosen later.
      const shedFleet = () => {
        if (P.terrain === 'sea' || P.owner !== pi) return false;
        const hulls = (c.armies || []).filter((a) => a && BOT_SEA_ALL.has(a.type));
        if (!hulls.length || hulls.length === (c.armies || []).length) return false;
        pre.push({
          action: 'leave_army',
          target: hulls.map((a) => a.type).join(','),
          extra: '-1',
          desc: 'Leave the fleet in harbour',
        });
        return true;
      };
      if (best && best.N.terrain !== 'sea' && P.terrain !== 'sea' && shedFleet() && pre.length >= 5) {
        G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, []);
        return;
      }
      if (best) {
        // A real fight ahead: one buff cast first (Oratory > Elemental Summon > Phantasmal Armies)
        // when the host has 3+ units and a phase to spare — a Veteran elemental or +1 quality tier
        // decides battles.
        if (best.targetStr > 0 && (c.armies || []).length >= 2 && pre.length <= 3) {
          // 2026-09-26 (idea 1): every planned fight, from two units
          const rite = botRitePre(G, pi, c, P, L, true);
          if (rite) pre.push(rite); // Pagan: the Wild Hunt / a Blood Offering before the clash
          {
            const mo = botMasteryPre(G, pi, c, P, { fightAhead: true });
            if (mo && pre.length <= 2) pre.push(mo);
          } // review II A7
          const buff = botCastPlan(G, pi, c, P, { max: 1, fighting: c }).find((o) =>
            ['Oratory', 'Elemental Summon', 'Phantasmal Armies'].includes(o.target),
          );
          if (buff && pre.length <= 3) pre.push(buff);
        }
        const moves = [botMoveOrder(best.dirIdx, best.targetStr > 0 ? 'Attack' : 'Advance')];
        visited.add(best.N.id);
        let str = myStr,
          fights = 0;
        if (best.targetStr > 0) {
          str *= 0.85;
          fights = 1;
        }
        moves.push(...botChainHops(G, pi, c, best.N, str, T, maxHops - 1, visited, fights));
        G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, moves);
        return;
      }
      // ── JOIN FORCES (2026-09-26, Toby item 7): a general with nothing to attack, standing with the ADMIRAL,
      // puts his foot soldiers aboard — every liftable unit the hulls have room for — so the fleet carries
      // them over the water. He keeps whatever cannot sail and raises a fresh column. ──
      if (isLeader && c._botRole !== 'admiral' && c._botRole !== 'skygeneral') {
        const adm = all.find(
          (o) =>
            o.id !== c.id &&
            o.location === c.location &&
            o._botRole === 'admiral' &&
            (o.armies || []).some((a) => a && BOT_CARRIER_TYPES.has(a.type)),
        );
        const spare = adm ? botSpareBerths(adm) : 0;
        if (adm && spare > 0) {
          const give = (c.armies || [])
            .filter((a) => a && botLiftable(a.type) && !BOT_SEA_ALL.has(a.type) && !a._isSkeletal)
            .sort((x, y) => unitBaseStrength(y) - unitBaseStrength(x))
            .slice(0, spare);
          if (give.length) {
            G.turnOrders[c.id] = botFillOrders(
              G,
              pi,
              c,
              [
                ...pre,
                {
                  action: 'leave_army',
                  target: give.map((a) => a.unitName || a.type).join(','),
                  extra: String(adm.id),
                  desc: 'Embark ' + give.length + ' unit' + (give.length > 1 ? 's' : '') + ' with ' + adm.name,
                },
              ],
              [],
            );
            return;
          }
        }
      }
      // Nothing winnable HERE (a field host expands before it raids lairs — lairs are for the
      // unarmed): look across the whole realm for a winnable province and march on it. Before this
      // a host parked on an edge beside one over-strong guard held for the rest of the game while
      // easier land sat three hops away behind its own borders.
      const ds = botDistantStrike(G, pi, c, P, myStr, T, maxHops);
      if (ds) {
        if (
          ds.moves.some((m) => {
            const d = BOT_HEX_DIRS.indexOf(m.target.slice(4));
            const N = botNeighbourProv(G, P, d);
            return N && N.terrain !== 'sea';
          }) &&
          P.terrain !== 'sea' &&
          shedFleet() &&
          pre.length >= 5
        ) {
          G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, []);
          return;
        }
        G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, ds.moves);
        return;
      }
      // Sept 2026 (Toby: hire as much as possible): a host with nothing to attack walks to a seen wanderer and hires him.
      {
        const heroesNow = (G.characters || []).filter(
          (x) => x && x.alive && x.player === pi && !x.isKing && !x._isHeir,
        ).length;
        let bestH = null;
        if (heroesNow < botHeroCap(G, pi))
          (G.characters || []).forEach((h) => {
            if (!(
              h &&
              h.alive &&
              h.player === null &&
              !h._isNeutralGuard &&
              !h._justDefeated &&
              botSeesChar(G, pi, h) &&
              !heroClaimed.has(h.id) &&
              h.location !== c.location
            ))
              return;
            if (heroHireWage((G.players[pi] || {}).alignment || 'Neutral', h.alignment, false, h) == null) return;
            const d = botPathLen(G, pi, P, h.location, false);
            if (d == null || d > maxHops - 1) return;
            const de = d - botHireBias(G, pi, h);
            if (!bestH || de < bestH.de) bestH = { h, d, de };
          });
        if (bestH) {
          const wage = heroHireWage((G.players[pi] || {}).alignment || 'Neutral', bestH.h.alignment, false, bestH.h);
          const path = botPathDirs(G, pi, P, bestH.h.location, maxHops - 1, false) || [];
          if (path.length === bestH.d && wage != null && L.budget >= wage) {
            heroClaimed.add(bestH.h.id);
            botSpend(L, wage);
            L.hired = L.hired || new Set();
            L.hired.add(bestH.h.id);
            G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, [
              ...path.map((d) => botMoveOrder(d, 'Ride to ' + bestH.h.name)),
              { action: 'hire', target: String(bestH.h.id), extra: '', desc: 'Hire ' + bestH.h.name },
            ]);
            return;
          }
        }
      }
      // Sept 2026 (Toby: naval): a sea-capable host with no land target sails — claim the sea, land on an enemy coast.
      {
        const ss =
          c._botRole === 'admiral' || botSeaCap(c.armies) !== 'land'
            ? botSeaStrike(G, pi, c, P, myStr, T, Math.max(maxHops, seaHops))
            : null;
        if (ss && ss.moves.length) {
          const mo = botMasteryPre(G, pi, c, P, { fightAhead: ss.N && ss.N.terrain !== 'sea', fromSea: true });
          const pre2 = mo && pre.length <= 2 ? [...pre, mo] : pre;
          G.turnOrders[c.id] = botFillOrders(G, pi, c, pre2, ss.moves);
          return;
        }
      }
      // A Divine king with holy ground still to claim walks to the richest consecratable province (review §2).
      if ((c.isKing || (kitTactics(G, pi) === 'Divine' && (c.skills || {}).white >= 1)) && maxHops >= 1) {
        const ct = botConsecrateTarget(G, pi, c, maxHops - 1); // PROTOTYPE tactics: any White hero carries the light
        if (ct && ct.d > 0) {
          const path = botPathDirs(G, pi, P, ct.X.id, maxHops - 1, false) || [];
          if (path.length === ct.d) {
            G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, [
              ...path.map((d) => botMoveOrder(d, 'Carry the light to ' + ct.X.name)),
              { action: 'consecrate', target: '', extra: '', desc: 'Consecrate ' + ct.X.name },
            ]);
            return;
          }
        }
      }
      // A beatable lair in our own adjacent land — go clear it (hoard + strength).
      const ld = botLairDir(G, P, c, pi);
      if (ld >= 0) {
        const LP = botNeighbourProv(G, P, ld);
        const li = botBeatableLairIn(G, c, LP);
        const mv = [botMoveOrder(ld, 'Raid lair')];
        if (li >= 0) mv.push({ action: 'search', target: String(li), extra: '', desc: 'Search Lair', prov: LP.id });
        G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, mv);
        return;
      }
      // Nothing winnable anywhere in reach: march for the frontier (multi-hop) and strike from
      // there if hops remain.
      const ft = botFrontierTarget(G, pi, P);
      if (ft != null) {
        if (P.terrain !== 'sea' && shedFleet() && pre.length >= 5) {
          G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, []);
          return;
        }
        const path = botPathDirs(G, pi, P, ft, maxHops, false);
        if (path && path.length) {
          const moves = [];
          let cur = P;
          for (const d of path) {
            const N = botNeighbourProv(G, cur, d);
            if (!N) break;
            moves.push(botMoveOrder(d, 'Advance to frontier'));
            visited.add(N.id);
            cur = N;
          }
          moves.push(...botChainHops(G, pi, c, cur, myStr, T, maxHops - moves.length, visited, 0));
          G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, moves);
          return;
        }
      }
      // ── RAISE ARMIES WHERE THEY CAN BE RAISED (2026-09-26, Toby items 1/7): a leader with nothing to attack and
      // no frontier does not stand and drill — he marches to the best owned province that recruits field
      // troops (a coastal port first when the realm has an admiral to carry him) and musters there. ──
      if (
        isLeader &&
        !(P.owner === pi && (P.armyTypes || []).some((t) => t && !/garrison/i.test(t) && !BOT_NAVAL_TYPES.has(t)))
      ) {
        const hasAdm = all.some((o) => o._botRole === 'admiral');
        let bestM = null;
        (G.world.provinces || []).forEach((x) => {
          if (
            !x ||
            x.owner !== pi ||
            x.terrain === 'sea' ||
            x.id === P.id ||
            !(x.armyTypes || []).some((t) => t && !/garrison/i.test(t) && !BOT_NAVAL_TYPES.has(t))
          )
            return;
          const d = botPathLen(G, pi, P, x.id, false);
          if (d == null || d > 6) return;
          const sc = (x.tax || 0) - d * 2 + (hasAdm && botCoastalFleetType(x) ? 6 : 0);
          if (!bestM || sc > bestM.sc) bestM = { x, sc, d };
        });
        if (bestM) {
          const path = botPathDirs(G, pi, P, bestM.x.id, maxHops, false);
          if (path && path.length) {
            G.turnOrders[c.id] = botFillOrders(
              G,
              pi,
              c,
              pre,
              path.map((d) => botMoveOrder(d, 'March to muster at ' + bestM.x.name)),
            );
            return;
          }
        }
      }
      // At the edge with nothing winnable: hold, watch and drill (muster orders still apply).
      G.turnOrders[c.id] = botFillOrders(G, pi, c, pre, []);
    });
    botRunSlayerSchool(G, pi, roles); // 2026-09-28 (Toby): mentors for the slayer, in their spare phases
  });
}
