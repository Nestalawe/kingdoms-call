import { kcRng } from '../rng.ts';
import { homeProvinceIdFor } from '../grand-design.ts';
import { recordDeadHeroSighting } from '../graves.ts';
import { discoverFeat, featDiscovered } from '../sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import { d100 } from '../dice-and-army-names.ts';
import { TM } from '../titles/perks.ts';
import { DISC_BY_ID, discBlockedIds, discEligible } from '../discoveries.ts';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { SKILLGAIN_STD, trySkillGain } from '../heroes/experience-skill-rises-and-earned-hp.ts';
import {
  emit,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from '../turn/events-and-their-audiences.ts';
import { botTaxIncome } from '../bots/strategy.ts';
import { theDefendersAsTheSpyNamesThem } from './the-facts-what-a-spy-learns-lines-record.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import { theOneThePickFell } from '../orders/spells/what-an-action-spell-of-the-cast-spell-order-is-handed.ts';
import type { ADefenderAsTheSpyNamesIt } from './the-facts-what-a-spy-learns-lines-record.ts';
import type { Character, ProvinceFeature, Realm } from '../../schemas/saved-game-state.ts';
import type { TurnContext } from '../turn/context.ts';

/** A province as a successful spy reads it: its id, name, owner and tax, and its neutral defenders and features (none:
 *  none listed). */
interface AProvinceAsTheSpyReadsIt {
  readonly id: number;
  readonly name: string;
  readonly owner: number | null;
  readonly tax: number;
  readonly neutralDefenders?: readonly ADefenderAsTheSpyNamesIt[] | null | undefined;
  readonly features?: readonly ProvinceFeature[] | null | undefined;
}
/** A hero as the count of a crown's heroes reads him (a gap passed over). */
type AHeroAsTheCrownsCountReadsHim = Pick<Character, 'alive' | 'player' | 'isKing'> | null | undefined;
/** A realm's warning of a rival's agents, as the spy writes it: the realm of a spy who serves none is null. */
interface AWarningAsTheSpyWritesIt {
  provId: number;
  provName: string;
  byPlayer: number | null;
  byName: string;
  turn: number;
}
/** The realm an index names where the code reads it unguarded: there is one (else the old read threw a TypeError). */
function theRealmTheIndexNames(realm: Realm | undefined): Realm {
  if (realm === undefined) throw new TypeError('no realm at this index');
  return realm;
}

// ── WHAT A SPY LEARNS (plan P1-08c: lifted out of resolveTurn) ────
// Everything a successful spy learns about a province, for the Spy order and the Neutral Broker's paid intelligence
// alike. It takes the turn's context first (src/engine/turn/context.ts).
// Returns {won, narrative:[strings]} ── PAGAN: Blood Harvest ── After a battle a Pagan character
// WINS, the old gods' tithe: the Blood Harvest row's gold per enemy unit destroyed, claimed as
// offerings from the fallen. Called from both battle paths (combatVsNPC covers neutral guards AND
// leaderless garrisons,
// which are fought as a garrison copy through the same function).
// Everything a SUCCESSFUL spy learns about a province — shared by the Spy action and the Neutral
// Broker's paid remote intelligence (identical effect by design).
export function applySpySuccess(turnContext: TurnContext, c: Character, sprov: AProvinceAsTheSpyReadsIt) {
  const { G } = turnContext;
  trySkillGain(turnContext, c, 'spy', SKILLGAIN_STD); // Spy: successful espionage
  const actingP = c.player === null ? undefined : G.players[c.player]; // a hero of no realm: G.players[null], none
  if (actingP) {
    actingP._spiedProvincesThisTurn ??= [];
    if (!actingP._spiedProvincesThisTurn.includes(sprov.id)) actingP._spiedProvincesThisTurn.push(sprov.id);
    // 2026-10-15 (Toby, D2): a province spy shows every character there and the army units each
    // leads (the report's province intel), and the characters in the provinces around it — but no
    // hero's skills. Those take a Spy on the hero.
  }
  emit(turnContext, {
    type: 'explore',
    fact: {
      kind: 'a spy learns who holds a province, its tax and its defenders',
      heroName: c.name,
      provinceName: sprov.name,
      ownerRealmName: sprov.owner !== null ? theRealmTheIndexNames(G.players[sprov.owner]).name : null,
      tax: sprov.tax,
      defenders: theDefendersAsTheSpyNamesThem(sprov.neutralDefenders ?? []),
    },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    spy: true,
    province: sprov.id,
  });
  // ── spying a KING's HOME (founding capital) reveals realm-wide secrets — total tax income, how
  // many heroes the crown commands, and a Spy-scaled chance to lift ONE Sage discovery
  // (the target keeps theirs; the spy gains it as if researched). Fires for the regular Spy order
  // and the Neutral Broker's remote intel alike, since both route through here.
  {
    let _homeKing: number | null = null;
    for (let _pi = 0; _pi < G.players.length; _pi++) {
      if (homeProvinceIdFor(G, _pi) === sprov.id) {
        _homeKing = _pi;
        break;
      }
    }
    if (_homeKing != null && _homeKing !== c.player) {
      const _kp = theRealmTheIndexNames(G.players[_homeKing]); // homeProvinceIdFor named a home only for a realm
      const _kIncome = botTaxIncome(G, _homeKing);
      const _kHeroes = (asItsGuardReadsIt(G.characters) ?? []).filter(
        (x: AHeroAsTheCrownsCountReadsHim) => x?.alive && x.player === _homeKing && !x.isKing,
      ).length;
      emit(turnContext, {
        type: 'spy',
        fact: {
          kind: "a spy learns a king's home's tax income and heroes",
          realmName: _kp.name,
          taxIncome: _kIncome,
          heroes: _kHeroes,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        province: sprov.id,
      });
      const _spyLvl = effStat(turnContext, c, 'spy');
      const _stealPct = Math.max(5, Math.min(95, 10 + _spyLvl * 10));
      const _mine = new Set((actingP?.discoveries ?? []).map((d) => d.id));
      const _blkSpy = discBlockedIds(actingP);
      const _stealable = (_kp.discoveries ?? []).filter(
        (d) => !_mine.has(d.id) && !_blkSpy.has(d.id) && discEligible(DISC_BY_ID[d.id], actingP),
      ); // a spy cannot carry off a race/alignment secret the realm cannot use
      if (_stealable.length > 0) {
        const _sr = d100();
        emit(turnContext, {
          type: 'spy',
          fact: {
            kind: "a spy rifles a king's archives for a discovery",
            heroName: c.name,
            spyLevel: _spyLvl,
            realmName: _kp.name,
            chance: _stealPct,
            roll: _sr,
          },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
          province: sprov.id,
        });
        if (_sr <= _stealPct) {
          const _disc = theOneThePickFell(_stealable[Math.floor(kcRng() * _stealable.length)]);
          const thief = theRealmTheIndexNames(actingP); // a hero of no realm: G.players[null], none (a TypeError)
          thief.discoveries ??= [];
          thief.discoveries.push({
            id: _disc.id,
            name: _disc.name,
            category: _disc.category,
            desc: _disc.desc,
            turnDiscovered: G.turn,
          });
          try {
            TM(c).discoveries += 1;
          } catch {
            // the title merit's count never stops the theft
          }
          emit(turnContext, {
            type: 'spy',
            fact: {
              kind: "a spy copies a secret from a king's archives",
              heroName: c.name,
              discoveryName: _disc.name,
              realmName: _kp.name,
            },
            audience: { actor: c.player, realms: [c.player] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
            province: sprov.id,
          });
        }
      }
    }
  }
  // ── Counter-intelligence alert — the spied province's owner is warned a rival's agents were at
  // work (naming the KINGDOM, not the agent). Suppressed if the spy is disguised (The Shadow
  // minor title, or sd23 Disguise Techniques set c._spyDisguised before this call).
  if (sprov.owner != null && sprov.owner !== c.player && !c._spyDisguised) {
    const _byName = c.player != null ? (G.players[c.player]?.name ?? '') || 'an unknown power' : 'unknown agents';
    const _vp = G.players[sprov.owner];
    if (_vp) {
      _vp._spiedOnThisTurn ??= [];
      const warnings: AWarningAsTheSpyWritesIt[] = _vp._spiedOnThisTurn;
      warnings.push({
        provId: sprov.id,
        provName: sprov.name,
        byPlayer: c.player,
        byName: _byName,
        turn: G.turn,
      });
    }
    // this alert belongs ONLY to the pried-upon owner: filed under no hero, never the PRYING character (the report
    // filter, ownCharIds.has(e.charId), would surface it in the spy's OWN report).
    emit(turnContext, {
      type: 'spy',
      fact: {
        kind: "a province's watch catches a rival's agents prying",
        provinceName: sprov.name,
        pryingRealmName: c.player != null ? (G.players[c.player]?.name ?? '') || null : null,
        theSpyServesARealm: c.player != null,
      },
      audience: { actor: null, realms: [sprov.owner] },
      hero: null,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: sprov.id,
    });
  }
  c.merits = (c.merits || 0) + 1;
  (sprov.features ?? [])
    .filter((f) => !featDiscovered(f, c.player))
    .forEach((f) => {
      if (kcRng() < 0.5) discoverFeat(f, c.player);
    });
  if (c.player !== null) recordDeadHeroSighting(turnContext, c.player, sprov.id); // a hero of no realm: it finds none at G.players[null], and records nothing
}
