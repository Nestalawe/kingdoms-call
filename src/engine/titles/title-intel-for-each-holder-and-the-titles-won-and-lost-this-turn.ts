// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { TITLE_DEFS } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { SEA_TYPES } from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { unitBaseStrength } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import { noteGraveIntel } from '../graves.ts';
import { dispFloor } from '../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { TITLES_PUBLIC_FROM_TURN, TITLE_CREATURE_ARMIES, TITLE_MONSTER_ARMIES } from './perks.ts';
import { MINOR_TITLES, computeMinorTitles, computeStandings } from './reckoning.ts';
import { emit, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from '../turn/events-and-their-audiences.ts';

// ── THE TITLES AT THE TURN'S END (plan P1-08k6: the last stages taken out of the end of resolveTurn's body) ─────────
// Once the new turn is done (new-turn-war-academy-informants-divine-resurrection-graves-mercenaries-wanderers-and-the-
// final-reconcile.js: the final reconcile and the stranded guards), two stages, in this order, each once a turn:
//   1. the title intel: from turn 5 (TITLES_PUBLIC_FROM_TURN), or once the game is over, the realm holding each title
//      is told what it shows of the realms it has met (the Throne, the Vaultkeeper, the Grand Marshal, the Sea Lord,
//      the Monster-Bane, the Loremaster, who may copy one rival's fresh discovery, the Archmage, the Hierophant, the
//      Deathpriest, who files what Grave-sight finds under Graveyards Known, the Spymaster, the Cartographer, the
//      Beastlord and the Wildwarden), with one line for the realms it hasn't met;
//   2. the title changes: each realm's titles won and lost since last turn's snapshot (every title held, the first
//      turn they are public), for the report, and this turn's snapshot.
// Each was an immediately-invoked function in resolveTurn; each is a named function now, taking the turn's context
// (src/engine/turn/context.ts) and nothing else: it reads no value of the phase loop's. The bodies keep resolveTurn's
// indent inside the function they were (plan P1-08's Decisions).

// ── IMPERIAL TITLE INTEL (Items 1, 2, 4) ── Titles are AWARDED here, AFTER all turn resolution
// (combat, conquest, tax, resurrection, wandering-drift) and the final reconcile — so this ONE
// end-of-turn standings computation is what every title benefit reports from. The intel lines,
// the holders board and each report's gains/losses therefore never disagree on who holds what.
// Each rival / piece of intel is its OWN line, and any character named carries their province.
// Gated: nothing emits before Titles go public (turn 5) or once the game is over.
// Every line is a fact (plan P1-12d13): the title intelligence's kinds (titles/the-facts-the-title-intelligence-lines-
// record.ts), each holding a realm as the line names it, a province's name as the world holds it (null where it has
// none), counts and figures; the prose writes the words, each line's "[The Throne] " first
// (src/views/prose/the-words-of-the-title-intelligence-lines.ts).
export function imperialTitleIntelEachHoldersReportOnRivalRealmsAndTheLoremastersCopy(turnContext) {
  const { G } = turnContext;
  const _pub = (G.turn || 1) >= TITLES_PUBLIC_FROM_TURN || !!G.gameOver;
  if (!_pub) return;
  let STD;
  try {
    STD = computeStandings(G);
  } catch (e) {
    return;
  }
  const TH = STD.titles || {};
  const provs = G.world.provinces || [];
  const holder = (key) => {
    const h = TH[key];
    return h && h.playerIndex != null ? h.playerIndex : null;
  };
  // 2026-09-24 (Toby item 5): a title tells its holder nothing about a realm the crown has not
  // yet MET (player._encountered — the same list that gates Treat / Declare War). Unmet realms
  // are neither named nor measured; one closing line per title says how many stay in the dark.
  const met = (pi, i) => i === pi || ((G.players[pi] || {})._encountered || []).includes(i);
  const unmetLine = (pi, title) => {
    const n = (G.players || []).filter(
      (pl, i) => pl && i !== pi && !pl.conceded && !pl.eliminated && !met(pi, i),
    ).length;
    if (n > 0)
      emit(turnContext, {
        type: 'system',
        fact: { kind: "a title's holder learns how many realms his crown has not met", title, count: n },
        audience: { actor: pi, realms: [pi] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
  };
  const isNaval = (t) => SEA_TYPES.has(t);
  const kindStr = (ch, naval) =>
    (ch.armies || [])
      .filter((a) => (naval ? isNaval(a.type) : !isNaval(a.type)))
      .reduce((s, a) => s + unitBaseStrength(a), 0);
  // Strongest land/sea force for a rival → the COMMANDING character, so we can name them AND give
  // their current province.
  const strongestChar = (pi, naval) => {
    let best = -1,
      bc = null;
    (G.characters || [])
      .filter((c) => c.alive && c.player === pi)
      .forEach((c) => {
        const st = kindStr(c, naval);
        if (st > best) {
          best = st;
          bc = c;
        }
      });
    return best > 0 ? bc : null;
  };
  // THE THRONE — each rival's share of the world tax base. Uses the SAME denominator as the
  // Reckoning (STD.worldTax = every province, land AND sea), so these %s correlate across
  // reports. 2026-09-09: every comparative title report now opens with the holder's OWN figure,
  // so the rivals' numbers can be read against something.
  {
    const pi = holder('throne');
    if (pi != null) {
      const world = STD.worldTax || 1;
      const own = dispFloor((100 * (STD.taxByPlayer[pi] || 0)) / world);
      emit(turnContext, {
        type: 'system',
        fact: { kind: "the Throne's holder learns his realm's share of the world tax base", percent: own },
        audience: { actor: pi, realms: [pi] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      G.players.forEach((pl, i) => {
        if (i === pi || !met(pi, i)) return;
        const pct = Math.round((100 * (STD.taxByPlayer[i] || 0)) / world);
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: "the Throne's holder learns a rival's share of the world tax base",
            realm: { realmName: G.players[i]?.name || null, seat: i },
            percent: pct,
          },
          audience: { actor: pi, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
      });
      unmetLine(pi, 'throne');
    }
  }
  // THE VAULTKEEPER — each rival's treasury (own line).
  {
    const pi = holder('vault');
    if (pi != null) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: "the Vaultkeeper's holder learns his realm's treasury", gold: G.players[pi]?.gold || 0 },
        audience: { actor: pi, realms: [pi] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      G.players.forEach((pl, i) => {
        if (i === pi || !met(pi, i)) return;
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: "the Vaultkeeper's holder learns a rival's treasury",
            realm: { realmName: G.players[i]?.name || null, seat: i },
            gold: pl.gold || 0,
          },
          audience: { actor: pi, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
      });
      unmetLine(pi, 'vault');
    }
  }
  // THE GRAND MARSHAL — each rival's strongest land army: commander + province (own line).
  {
    const pi = holder('marshal');
    if (pi != null) {
      let any = false;
      {
        const oc = strongestChar(pi, false);
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: "the Grand Marshal's holder learns his realm's strongest land army",
            army: oc
              ? { commanderName: oc.name, provinceName: provs[oc.location]?.name || null, strength: kindStr(oc, false) }
              : null,
          },
          audience: { actor: pi, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
      }
      G.players.forEach((pl, i) => {
        if (i === pi || !met(pi, i)) return;
        const c = strongestChar(i, false);
        if (c) {
          any = true;
          emit(turnContext, {
            type: 'system',
            fact: {
              kind: "the Grand Marshal's holder learns a rival's strongest land army",
              realm: { realmName: G.players[i]?.name || null, seat: i },
              army: {
                commanderName: c.name,
                provinceName: provs[c.location]?.name || null,
                strength: kindStr(c, false),
              },
            },
            audience: { actor: pi, realms: [pi] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          });
        }
      });
      if (!any)
        emit(turnContext, {
          type: 'system',
          fact: { kind: "the Grand Marshal's holder learns no rival fields a land army" },
          audience: { actor: pi, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
      unmetLine(pi, 'marshal');
    }
  }
  // THE SEA LORD — each rival's strongest fleet: commander + province (own line).
  {
    const pi = holder('sea');
    if (pi != null) {
      let any = false;
      {
        const oc = strongestChar(pi, true);
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: "the Sea Lord's holder learns his realm's strongest fleet",
            fleet: oc
              ? { commanderName: oc.name, provinceName: provs[oc.location]?.name || null, strength: kindStr(oc, true) }
              : null,
          },
          audience: { actor: pi, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
      }
      G.players.forEach((pl, i) => {
        if (i === pi || !met(pi, i)) return;
        const c = strongestChar(i, true);
        if (c) {
          any = true;
          emit(turnContext, {
            type: 'system',
            fact: {
              kind: "the Sea Lord's holder learns a rival's strongest fleet",
              realm: { realmName: G.players[i]?.name || null, seat: i },
              fleet: {
                commanderName: c.name,
                provinceName: provs[c.location]?.name || null,
                strength: kindStr(c, true),
              },
            },
            audience: { actor: pi, realms: [pi] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          });
        }
      });
      if (!any)
        emit(turnContext, {
          type: 'system',
          fact: { kind: "the Sea Lord's holder learns no rival fields a fleet" },
          audience: { actor: pi, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
      unmetLine(pi, 'sea');
    }
  }
  // THE MONSTER-BANE — 2026-09-17: was the single runner-up for the title. Now the foremost
  // monster-slayer of EVERY rival realm, each on their own line with province and tally, so the
  // holder can see the whole field coming rather than only the nearest challenger. An unsworn
  // hero
  // (player==null) is nobody's champion and is left out.
  {
    const pi = holder('monster');
    if (pi != null) {
      const bestOf = (i) => {
        let b = null,
          bm = 0;
        (G.characters || [])
          .filter((c) => c.alive && c.player === i)
          .forEach((c) => {
            const m = (c.tm && c.tm.monster) || 0;
            if (m > bm) {
              bm = m;
              b = c;
            }
          });
        return b ? { c: b, m: bm } : null;
      };
      const own = bestOf(pi);
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "the Monster-Bane's holder learns his realm's champion",
          champion: own
            ? { heroName: own.c.name, provinceName: provs[own.c.location]?.name || null, monsterBlood: own.m }
            : null,
        },
        audience: { actor: pi, realms: [pi] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      let any = false;
      G.players.forEach((pl, i) => {
        if (i === pi || !met(pi, i)) return;
        const r = bestOf(i);
        if (r) {
          any = true;
          emit(turnContext, {
            type: 'system',
            fact: {
              kind: "the Monster-Bane's holder learns a rival's champion",
              realm: { realmName: G.players[i]?.name || null, seat: i },
              champion: { heroName: r.c.name, provinceName: provs[r.c.location]?.name || null, monsterBlood: r.m },
            },
            audience: { actor: pi, realms: [pi] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          });
        }
      });
      if (!any)
        emit(turnContext, {
          type: 'system',
          fact: { kind: "the Monster-Bane's holder learns no rival's hero has drawn monster-blood" },
          audience: { actor: pi, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
      unmetLine(pi, 'monster');
    }
  }
  // THE LOREMASTER — 2026-09-17: was this turn's discoveries only, which in most turns is nothing
  // at all. Now the FULL holding of every rival realm, so the holder can see the whole shape of
  // what others know. The free copy still comes from what was discovered THIS turn: the title
  // reads a rival's library, it does not empty it.
  {
    const pi = holder('lore');
    if (pi != null) {
      const tt = G.turn - 1;
      const fresh = [];
      let anyHeld = false;
      G.players.forEach((pl, i) => {
        if (i === pi || !met(pi, i)) return;
        const ds = (pl && pl.discoveries) || [];
        if (ds.length) {
          anyHeld = true;
          emit(turnContext, {
            type: 'system',
            fact: {
              kind: "the Loremaster's holder learns a rival's discoveries",
              realm: { realmName: G.players[i]?.name || null, seat: i },
              discoveries: ds.map((d) => d.name),
            },
            audience: { actor: pi, realms: [pi] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          });
        } else
          emit(turnContext, {
            type: 'system',
            fact: {
              kind: "the Loremaster's holder learns a rival holds no discoveries",
              realm: { realmName: G.players[i]?.name || null, seat: i },
            },
            audience: { actor: pi, realms: [pi] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          });
        ds.forEach((d) => {
          if (d.turnDiscovered === tt) fresh.push({ d, i });
        });
      });
      if (!anyHeld)
        emit(turnContext, {
          type: 'system',
          fact: { kind: "the Loremaster's holder learns no rival has learned anything worth copying" },
          audience: { actor: pi, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
      const lp = G.players[pi];
      if (lp && fresh.length) {
        const owned = new Set((lp.discoveries || []).map((d) => d.id));
        const learn = fresh.filter((f) => !owned.has(f.d.id));
        if (learn.length) {
          const pk = learn[Math.floor(kcRng() * learn.length)].d;
          (lp.discoveries = lp.discoveries || []).push({
            id: pk.id,
            name: pk.name,
            category: pk.category,
            desc: pk.desc,
            turnDiscovered: G.turn,
          });
          emit(turnContext, {
            type: 'system',
            fact: { kind: "the Loremaster's scholars copy a rival's fresh discovery", discoveryName: pk.name },
            audience: { actor: pi, realms: [pi] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          });
        }
      }
      unmetLine(pi, 'lore');
    }
  }
  // THE ARCHMAGE — 2026-09-17: the foremost mage of each school OUTSIDE the holder's own realm.
  // Naming the holder's own archmage back to them was the one line in the whole title system that
  // told a player something they already knew; this is a rivals' board.
  {
    const pi = holder('arch');
    if (pi != null) {
      const tot = (c) => Object.values(c.skills || {}).reduce((s, v) => s + (v || 0), 0);
      ['white', 'psychic', 'illusory', 'elemental', 'necromancy'].forEach((sk) => {
        let best = null,
          bl = -1,
          bt = -1;
        (G.characters || [])
          .filter((c) => c.alive && c.player !== pi && (c.player == null || met(pi, c.player)))
          .forEach((c) => {
            const l = (c.skills && c.skills[sk]) || 0;
            if (l > bl || (l === bl && tot(c) > bt)) {
              bl = l;
              bt = tot(c);
              best = c;
            }
          });
        if (best && bl > 0)
          emit(turnContext, {
            type: 'system',
            fact: {
              kind: "the Archmage's holder learns a school's foremost mage outside his realm",
              school: sk,
              heroName: best.name,
              level: bl,
              realm:
                best.player != null ? { realmName: G.players[best.player]?.name || null, seat: best.player } : null,
              provinceName: provs[best.location]?.name || null,
            },
            audience: { actor: pi, realms: [pi] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          });
        else
          emit(turnContext, {
            type: 'system',
            fact: { kind: "the Archmage's holder learns of no mage of a school outside his realm", school: sk },
            audience: { actor: pi, realms: [pi] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          });
      });
      unmetLine(pi, 'arch');
    }
  }
  // THE HIEROPHANT — 2026-09-17: was the largest skeletal army, which is the Deathpriest's ground
  // and read as a necromancer's perk on a title of the White faith. Now the priest reads the
  // dead: every fallen hero this realm can SEE gives up the skills they carried in life.
  // Visibility mirrors buildTurnReport's `visibleDeadHeroes` — own dead, a fall witnessed this
  // turn, or a body lying in a province the realm holds or has a character standing in — so the
  // title never reveals a corpse the player could not already see on their map, only what that
  // corpse knew.
  {
    const pi = holder('hiero');
    if (pi != null) {
      const seen = new Set((G.players[pi] && G.players[pi].seenDeadHeroIds) || []);
      const eyes = new Set(provs.filter((pv) => pv && pv.owner === pi).map((pv) => pv.id));
      (G.characters || [])
        .filter((c) => c && c.alive && c.player === pi)
        .forEach((c) => {
          if (c.location != null) eyes.add(c.location);
        });
      const vis = (G.heroGraveyard || []).filter(
        (g) => g && (g.player === pi || seen.has(g.id) || (g.location != null && eyes.has(g.location))),
      );
      if (vis.length) {
        vis.forEach((g) => {
          const skills = Object.entries(g.skills || {})
            .filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([skill, level]) => ({ skill, level }));
          emit(turnContext, {
            type: 'system',
            fact: {
              kind: "the Hierophant's holder hears what a fallen hero knew",
              heroName: g.name,
              realm: g.player != null ? { realmName: G.players[g.player]?.name || null, seat: g.player } : null,
              isKing: !!g.isKing,
              provinceName: provs[g.location]?.name || null,
              skills,
            },
            audience: { actor: pi, realms: [pi] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          });
        });
      } else
        emit(turnContext, {
          type: 'system',
          fact: { kind: "the Hierophant's holder finds no fallen hero to read" },
          audience: { actor: pi, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
    }
  }
  // THE DEATHPRIEST — Grave-sight: each province with Crack/Elite dead (own line). Item 8: every
  // Grave-sight find is also written into the realm's graveyard lore, so the Deathpriest's
  // provinces appear in the report's Graveyards Known alongside what their own necromancers have
  // walked over. The reading is PARTIAL — the title picks out crack and elite dead only and is
  // blind to whatever lesser ranks lie beside them — so it is flagged as such and the report says
  // "at least". A province with no crack/elite dead is left alone, never marked bare: Grave-sight
  // seeing nothing worth naming there is not the same as seeing empty ground.
  {
    const pi = holder('necro');
    if (pi != null) {
      let any = false;
      const _dpl = G.players[pi];
      (G.world.provinces || []).forEach((pv) => {
        if (!pv) return;
        const _fine = (pv.battleGraves || []).filter((g) => g && (g.quality === 'Crack' || g.quality === 'Elite'));
        const n = _fine.length;
        if (n > 0) {
          any = true;
          if (_dpl) noteGraveIntel(_dpl, pv.id, G.turn, _fine, { partial: true });
          emit(turnContext, {
            type: 'system',
            fact: {
              kind: "the Deathpriest's Grave-sight finds crack and elite dead in a province",
              provinceName: provs[pv.id]?.name || null,
              count: n,
            },
            audience: { actor: pi, realms: [pi] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          });
        }
      });
      if (!any)
        emit(turnContext, {
          type: 'system',
          fact: { kind: "the Deathpriest's Grave-sight finds no crack or elite dead" },
          audience: { actor: pi, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
    }
  }
  // ── THE FOUR NEW TITLES ────
  // THE SPYMASTER — the counter-intelligence ledger. Every successful act of espionage worked
  // against THIS realm's provinces this turn, named with the realm that worked it and where. This
  // is the RAW ledger: a disguised agent who beat the province watch is still listed here, which
  // is the whole point of the title. Only espionage against ground this realm actually owns is
  // reported.
  {
    const pi = holder('spy');
    if (pi != null) {
      const led = (G._espionageLedger || []).filter(
        (e) => e && provs[e.provId] && provs[e.provId].owner === pi && e.byPi !== pi,
      );
      if (led.length) {
        // NAME THE AGENT, not the crown. Knowing "Arden pried into your lands" is barely
        // actionable; knowing WHICH hero did it, and where they were standing when they did,
        // tells you who to hunt and where they are. The realm is still given, after the name.
        led.forEach((e) => {
          emit(turnContext, {
            type: 'system',
            fact: {
              kind: "the Spymaster's holder learns of an act of espionage against his lands",
              agentIsKing: !!e.isKing,
              agentName: e.charName || null,
              agentsRealm: e.byPi != null ? { realmName: G.players[e.byPi]?.name || null, seat: e.byPi } : null,
              whatTheAgentDid: e.kind,
              provinceName: provs[e.provId]?.name || null,
            },
            audience: { actor: pi, realms: [pi] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          });
        });
        // A hero who worked twice in one turn is ONE name on the roll, with a count — the per-act
        // lines above already carry the detail, and the roll is meant to be read at a glance.
        const byChar = new Map();
        led.forEach((e) => {
          const k = e.charId;
          const r = byChar.get(k) || { name: e.charName, pi: e.byPi, n: 0 };
          r.n++;
          byChar.set(k, r);
        });
        const heroes = [...byChar.values()]
          .sort((a, b) => b.n - a.n)
          .map((r) => ({
            heroName: r.name || null,
            realm: r.pi != null ? { realmName: G.players[r.pi]?.name || null, seat: r.pi } : null,
            times: r.n,
          }));
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: "the Spymaster's holder learns who intruded into his lands this turn",
            intrusions: led.length,
            heroes,
          },
          audience: { actor: pi, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
      } else
        emit(turnContext, {
          type: 'system',
          fact: { kind: "the Spymaster's holder learns no hand was raised against his lands" },
          audience: { actor: pi, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
    }
  }
  // ── 2026-09-17: ALL THREE ARE NOW RIVAL-BY-RIVAL BOARDS ────
  // These three shipped as WORLD-facing lines (the far horizon, the breeding grounds, battles on
  // wild ground). Toby's ruling: each should say something about every OTHER player, the shape
  // the Throne, Vaultkeeper, Grand Marshal and Sea Lord already use. One line per rival, opening
  // with the holder's own figure so the rivals' numbers can be read against something.
  //
  // THE CARTOGRAPHER — the rival atlas. For each realm: how many provinces they have charted to
  // 100%, and their mapped ground as a share of the whole world. `exploredBy` is already kept per
  // realm per province, so this is a straight read — nothing new is tracked for it.
  {
    const pi = holder('carto');
    if (pi != null) {
      const land = provs.filter((pv) => pv);
      const world = land.length || 1;
      const atlas = (i) => {
        let full = 0,
          pts = 0;
        land.forEach((pv) => {
          const e = (pv.exploredBy && pv.exploredBy[i]) || 0;
          pts += e;
          if (e >= 100) full++;
        });
        return { full, pct: Math.round(pts / world) }; // pts is a sum of 0-100 figures, so /world is the mean = the share
      };
      const own = atlas(pi);
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "the Cartographer's holder learns his realm's atlas",
          fullyCharted: own.full,
          percentMapped: own.pct,
        },
        audience: { actor: pi, realms: [pi] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      let any = false;
      G.players.forEach((pl, i) => {
        if (i === pi || !met(pi, i)) return;
        any = true;
        const a = atlas(i);
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: "the Cartographer's holder learns a rival's atlas",
            realm: { realmName: G.players[i]?.name || null, seat: i },
            fullyCharted: a.full,
            percentMapped: a.pct,
          },
          audience: { actor: pi, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
      });
      if (!any)
        emit(turnContext, {
          type: 'system',
          fact: { kind: "the Cartographer's holder finds no rival realm to survey" },
          audience: { actor: pi, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
      unmetLine(pi, 'carto');
    }
  }
  // THE BEASTLORD — the rival menagerie. For each realm: how many Monster-category units they
  // field, and the province holding their largest monster host. Garrisoned beasts are counted in
  // the TOTAL (a realm can muster straight into a garrison) but the named host is always a
  // commander's, because a garrison cannot march at you.
  {
    const pi = holder('beast');
    if (pi != null) {
      const census = (i, set) => {
        let total = 0,
          best = null,
          bn = 0;
        (G.characters || [])
          .filter((c) => c && c.alive && c.player === i)
          .forEach((c) => {
            const n = (c.armies || []).filter((a) => a && set.has(a.type)).length;
            total += n;
            if (n > bn) {
              bn = n;
              best = c;
            }
          });
        provs.forEach((pv) => {
          if (pv && pv.owner === i) total += (pv.garrisonArmies || []).filter((a) => a && set.has(a.type)).length;
        });
        return { total, best, bn };
      };
      const line = (i, realm) => {
        const r = census(i, TITLE_MONSTER_ARMIES);
        if (r.total === 0) {
          emit(turnContext, {
            type: 'system',
            fact: { kind: "the Beastlord's holder learns a realm has no monsters under arms", realm },
            audience: { actor: pi, realms: [pi] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          });
          return;
        }
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: "the Beastlord's holder learns a realm's monsters under arms",
            realm,
            units: r.total,
            largestHost: r.best
              ? { units: r.bn, heroName: r.best.name, provinceName: provs[r.best.location]?.name || null }
              : null,
          },
          audience: { actor: pi, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
      };
      line(pi, null);
      let any = false;
      G.players.forEach((pl, i) => {
        if (i === pi || !met(pi, i)) return;
        any = true;
        line(i, { realmName: G.players[i]?.name || null, seat: i });
      });
      if (!any)
        emit(turnContext, {
          type: 'system',
          fact: { kind: "the Beastlord's holder finds no rival realm to reckon" },
          audience: { actor: pi, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
      unmetLine(pi, 'beast');
    }
  }
  // THE WILDWARDEN — the rival wild host. The same census, for the free beasts: thunderbirds, ents,
  // bears, giants, unicorns, mammoths, rocs, whale cohorts and great turtles (KC_UNIT_CLASS.creature). Deliberately symmetrical with the Beastlord's board so
  // a player holding both reads one format twice rather than two.
  {
    const pi = holder('wild');
    if (pi != null) {
      const census = (i, set) => {
        let total = 0,
          best = null,
          bn = 0;
        (G.characters || [])
          .filter((c) => c && c.alive && c.player === i)
          .forEach((c) => {
            const n = (c.armies || []).filter((a) => a && set.has(a.type)).length;
            total += n;
            if (n > bn) {
              bn = n;
              best = c;
            }
          });
        provs.forEach((pv) => {
          if (pv && pv.owner === i) total += (pv.garrisonArmies || []).filter((a) => a && set.has(a.type)).length;
        });
        return { total, best, bn };
      };
      const line = (i, realm) => {
        const r = census(i, TITLE_CREATURE_ARMIES);
        if (r.total === 0) {
          emit(turnContext, {
            type: 'system',
            fact: { kind: "the Wildwarden's holder learns the wild answers to no one in a realm", realm },
            audience: { actor: pi, realms: [pi] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          });
          return;
        }
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: "the Wildwarden's holder learns a realm's creatures in the field",
            realm,
            units: r.total,
            largestHost: r.best
              ? { units: r.bn, heroName: r.best.name, provinceName: provs[r.best.location]?.name || null }
              : null,
          },
          audience: { actor: pi, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
      };
      line(pi, null);
      let any = false;
      G.players.forEach((pl, i) => {
        if (i === pi || !met(pi, i)) return;
        any = true;
        line(i, { realmName: G.players[i]?.name || null, seat: i });
      });
      if (!any)
        emit(turnContext, {
          type: 'system',
          fact: { kind: "the Wildwarden's holder finds no rival realm to reckon" },
          audience: { actor: pi, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
      unmetLine(pi, 'wild');
    }
  }
}

// ── TITLE CHANGES ── compare this turn's holders to last turn's snapshot so each player's report
// can announce titles their characters/realm newly won this turn (with how + effect).
export function titleChangesTheTitlesEachRealmWonAndLostSinceLastTurn(turnContext) {
  const { G } = turnContext;
  let curMajor = {},
    curMinor = {};
  try {
    const st = computeStandings(G);
    TITLE_DEFS.forEach((t) => {
      const h = st.titles[t.key] || {};
      curMajor[t.key] = {
        charId: h.charId != null ? h.charId : null,
        playerIndex: h.playerIndex != null ? h.playerIndex : null,
        kingdomLevel: !!t.kingdomLevel,
      };
    });
    const mh = computeMinorTitles(G);
    MINOR_TITLES.forEach((t) => {
      const h = mh[t.key] || {};
      curMinor[t.key] = {
        charId: h.charId != null ? h.charId : null,
        playerIndex: h.playerIndex != null ? h.playerIndex : null,
      };
    });
  } catch (e) {
    curMajor = {};
    curMinor = {};
  }
  const prev = G._titlesSnapshot || null;
  const nowPublic = (G.turn || 1) >= TITLES_PUBLIC_FROM_TURN || !!G.gameOver;
  // The FIRST turn titles go public, announce every title a player currently holds (their initial
  // standing). After that, announce only titles that change hands. `firstPublic` is true when we
  // are public now but the previous snapshot was taken while NOT public (or there is no prior
  // snapshot).
  const firstPublic = nowPublic && !(prev && prev.wasPublic);
  const gainsByPlayer = {};
  const lossesByPlayer = {}; // title CHANGES also notify the previous holder they lost it.
  if (nowPublic) {
    const chName = (id) => {
      const c = (G.characters || []).find((x) => x.id === id);
      return c ? c.name : null;
    };
    const pName = (pi) => {
      const p = G.players[pi];
      return p ? p.name : null;
    };
    // A title changed hands away from `was` — record the loss for the OLD holder (a rival now
    // holds it, or it has fallen vacant). Never fired on the first public reveal (no prior public
    // holder), and never when the same realm keeps it via a different character.
    const recordLoss = (scope, t, cur, was) => {
      if (firstPublic) return;
      const hadHolder = t.kingdomLevel ? was.playerIndex != null : was.charId != null;
      const nowDifferent = t.kingdomLevel ? cur.playerIndex !== was.playerIndex : cur.charId !== was.charId;
      if (!hadHolder || !nowDifferent) return;
      const loserPi = was.playerIndex;
      if (loserPi == null || loserPi === cur.playerIndex) return; // same realm kept it → not a loss
      (lossesByPlayer[loserPi] = lossesByPlayer[loserPi] || []).push({
        scope,
        key: t.key,
        name: t.name,
        kingdomLevel: !!t.kingdomLevel,
        vacant: cur.playerIndex == null,
        newHolderIndex: cur.playerIndex != null ? cur.playerIndex : null, // 2026-09-27 item 3: lets the report withhold the name of a realm this player has not met
        newHolderName: cur.playerIndex != null ? pName(cur.playerIndex) : null,
        newCharName: t.kingdomLevel || cur.charId == null ? null : chName(cur.charId),
      });
    };
    TITLE_DEFS.forEach((t) => {
      const cur = curMajor[t.key] || {},
        was = (prev && prev.major && prev.major[t.key]) || {};
      const changed = firstPublic
        ? cur.playerIndex != null // first reveal → any current holder
        : t.kingdomLevel
          ? cur.playerIndex != null && cur.playerIndex !== was.playerIndex
          : cur.charId != null && cur.charId !== was.charId;
      if (changed) {
        const pi = cur.playerIndex;
        if (pi != null)
          (gainsByPlayer[pi] = gainsByPlayer[pi] || []).push({
            scope: 'major',
            key: t.key,
            name: t.name,
            charName: t.kingdomLevel ? null : chName(cur.charId),
            kingdomName: pName(pi),
            kingdomLevel: !!t.kingdomLevel,
            perk: t.perk,
            req: t.req,
            initial: firstPublic,
          });
      }
      recordLoss('major', t, cur, was);
    });
    MINOR_TITLES.forEach((t) => {
      const cur = curMinor[t.key] || {},
        was = (prev && prev.minor && prev.minor[t.key]) || {};
      const changed = firstPublic ? cur.charId != null : cur.charId != null && cur.charId !== was.charId;
      if (changed) {
        const pi = cur.playerIndex;
        if (pi != null)
          (gainsByPlayer[pi] = gainsByPlayer[pi] || []).push({
            scope: 'minor',
            key: t.key,
            name: t.name,
            charName: chName(cur.charId),
            kingdomName: pName(pi),
            perk: t.perk,
            req: t.req,
            initial: firstPublic,
          });
      }
      recordLoss('minor', t, cur, was);
    });
  }
  G._titleGainsByPlayer = gainsByPlayer;
  G._titleLossesByPlayer = lossesByPlayer;
  G._titlesSnapshot = { major: curMajor, minor: curMinor, wasPublic: nowPublic };
}
